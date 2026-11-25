"""Import the exact Three.js mesh cache and render with Cycles."""
import bpy, sys, os, json, gzip, base64, time, argparse
import numpy as np
from mathutils import Matrix, Vector
from pathlib import Path

def args():
    p=argparse.ArgumentParser()
    p.add_argument("--cache",required=True)
    p.add_argument("--output",required=True)
    p.add_argument("--width",type=int,default=1920)
    p.add_argument("--height",type=int,default=1080)
    p.add_argument("--samples",type=int,default=128)
    p.add_argument("--noise",type=float,default=.01)
    p.add_argument("--bounces",type=int,default=8)
    p.add_argument("--device",choices=["OPTIX","CUDA","CPU"],default="OPTIX")
    return p.parse_args(sys.argv[sys.argv.index("--")+1:])

def read(path):
    with gzip.open(path,"rt",encoding="utf-8") as f: return json.load(f)
def arr(s,dtype): return np.frombuffer(base64.b64decode(s),dtype=dtype)
def log(*a): print("[cycles]",*a,flush=True)
def mat4(a): return Matrix(np.array(a).reshape((4,4),order="F").tolist())
# Three Y-up to Blender Z-up, preserving handedness.
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))

def configure(a):
    scene=bpy.context.scene
    scene.render.engine="CYCLES"
    if a.device!="CPU":
        prefs=bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type=a.device
        prefs.refresh_devices()
        devices=[d for d in prefs.devices if d.type==a.device]
        if not devices: raise RuntimeError("No "+a.device+" GPU detected; use native Windows Blender via BLENDER_PATH if WSL cannot access OptiX")
        for d in prefs.devices:d.use=d in devices
        scene.cycles.device="GPU"
        log("GPU:",", ".join(d.name for d in devices))
    else: scene.cycles.device="CPU";log("Explicit CPU rendering")
    scene.cycles.samples=a.samples
    scene.cycles.use_adaptive_sampling=True
    scene.cycles.adaptive_threshold=a.noise
    scene.cycles.max_bounces=a.bounces
    scene.cycles.use_denoising=True
    scene.cycles.denoiser="OPTIX" if a.device=="OPTIX" else "OPENIMAGEDENOISE"
    scene.render.use_persistent_data=True
    scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.render.image_settings.color_mode="RGB"
    scene.view_settings.view_transform="AgX"
    scene.view_settings.exposure=-.36
    scene.world=bpy.data.worlds.new("Low-key studio")
    scene.world.use_nodes=True
    bg=scene.world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value=(.24,.28,.36,1);bg.inputs["Strength"].default_value=.16
    # Radiometric conversions between Three and Cycles are not exact.
    def light(name,pos,target,color,power,kind,size):
        data=bpy.data.lights.new(name,kind);data.color=color;data.energy=power
        if kind=="AREA":data.shape="DISK";data.size=size
        else:data.angle=size
        obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj)
        obj.location=C@Vector(pos);direction=C@Vector(target)-obj.location
        obj.rotation_euler=direction.to_track_quat("-Z","Y").to_euler()
    light("Warm soft key",(-.62,.88,.34),(0,.03,-.02),(1,.77,.55),35,"AREA",.44)
    light("Cool rim",(.95,.64,-.9),(0,.03,0),(.55,.69,1),.42,"SUN",.15)
    light("Faint fill",(.18,.42,.58),(0,.03,0),(1,.88,.76),.12,"SUN",.22)
    cam=bpy.data.cameras.new("35mm cinematic");cam.type="PERSP";cam.sensor_fit="VERTICAL";cam.sensor_height=24
    cam.dof.use_dof=True;cam.dof.aperture_blades=6;cam.dof.aperture_rotation=.15
    obj=bpy.data.objects.new("Camera",cam);scene.collection.objects.link(obj);scene.camera=obj
    return scene,obj

def build(data,folder):
    images={}
    for t in data["textures"]:
        path=folder/("texture-%03d.png"%t["id"]);path.write_bytes(base64.b64decode(t["png"]))
        image=bpy.data.images.load(str(path),check_existing=False)
        image.colorspace_settings.name="sRGB" if t["srgb"] else "Non-Color"
        images[t["id"]]=(image,t)
    mats={}
    for m in data["materials"]:
        mat=bpy.data.materials.new("Material-%d"%m["id"]);mat.use_nodes=True
        nodes=mat.node_tree.nodes;links=mat.node_tree.links;bs=nodes.get("Principled BSDF")
        for name,value in [("Base Color",(*m["color"],1)),("Roughness",m["roughness"]),("Metallic",m["metalness"]),("Coat Weight",m["coat"]),("Coat Roughness",m["coatRoughness"]),("Sheen Weight",m["sheen"]),("Sheen Roughness",m["sheenRoughness"]),("Sheen Tint",(*m["sheenColor"],1))]:
            bs.inputs[name].default_value=value
        def texture(id):
            image,t=images[id];node=nodes.new("ShaderNodeTexImage");node.image=image
            uv=nodes.new("ShaderNodeTexCoord");mapping=nodes.new("ShaderNodeMapping")
            mapping.inputs["Scale"].default_value=(*t["repeat"],1)
            mapping.inputs["Location"].default_value=(*t["offset"],0)
            if not t["flipY"]:
                mapping.inputs["Scale"].default_value[1]*=-1
                mapping.inputs["Location"].default_value[1]=1-t["offset"][1]
            links.new(uv.outputs["UV"],mapping.inputs["Vector"]);links.new(mapping.outputs["Vector"],node.inputs["Vector"])
            return node
        if m["map"] is not None:
            node=texture(m["map"]);mix=nodes.new("ShaderNodeMixRGB");mix.blend_type="MULTIPLY";mix.inputs[0].default_value=1
            mix.inputs[2].default_value=(*m["color"],1);links.new(node.outputs["Color"],mix.inputs[1]);links.new(mix.outputs[0],bs.inputs["Base Color"])
        if m["bump"] is not None:
            node=texture(m["bump"]);bump=nodes.new("ShaderNodeBump");bump.inputs["Distance"].default_value=abs(m["bumpScale"])
            links.new(node.outputs["Color"],bump.inputs["Height"]);links.new(bump.outputs["Normal"],bs.inputs["Normal"])
        mats[m["id"]]=mat
    objs={}
    for m in data["meshes"]:
        pos=arr(m["positions"],"<f4").reshape(-1,3);faces=arr(m["indices"],"<u4").reshape(-1,3)
        mesh=bpy.data.meshes.new(m["name"]);mesh.from_pydata(pos.tolist(),[],faces.tolist());mesh.update()
        for slot in m["slots"]:mesh.materials.append(mats[slot])
        mesh.polygons.foreach_set("material_index",arr(m["faceMaterials"],"<u2").astype(np.int32))
        mesh.polygons.foreach_set("use_smooth",np.ones(len(mesh.polygons),dtype=np.bool_))
        if m["uv"]:
            uv=arr(m["uv"],"<f4").reshape(-1,2)
            layer=mesh.uv_layers.new(name="UVMap")
            layer.data.foreach_set("uv",uv[faces.ravel()].ravel())
        if m["normals"]:
            mesh.normals_split_custom_set_from_vertices(arr(m["normals"],"<f4").reshape(-1,3).tolist())
        obj=bpy.data.objects.new(m["name"],mesh);bpy.context.scene.collection.objects.link(obj);objs[m["id"]]=obj
    return objs

def main():
    a=args();folder=Path(a.cache);out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene,cam=configure(a)
    data=read(folder/"scene.json.gz");objs=build(data,folder)
    meta=json.loads((folder/"manifest.json").read_text())
    scene.render.fps=meta["fps"]
    log(len(objs),"meshes;",len(data["materials"]),"materials;",meta["count"],"frames")
    for i in range(meta["count"]):
        frame=read(folder/("frame-%06d.json.gz"%i))
        for m in frame["meshes"]:
            obj=objs[m["id"]];obj.matrix_world=C@mat4(m["matrix"])
            if "positions" in m:
                obj.data.vertices.foreach_set("co",arr(m["positions"],"<f4"));obj.data.update()
                # Normals recompute for deforming geometry (static custom normals retained).
                if obj.data.has_custom_normals:obj.data.normals_split_custom_set([(0,0,0)]*len(obj.data.loops))
        camera=frame["camera"];cam.matrix_world=C@mat4(camera["matrix"])
        cam.data.angle_y=camera["fov"]*np.pi/180
        cam.data.dof.focus_distance=camera["focus"];cam.data.dof.aperture_fstop=camera["fstop"]
        path=out/("frame-%06d.png"%i)
        if path.exists() and path.stat().st_size>100:log("Resume",i+1);continue
        start=time.monotonic();log("Rendering",i+1,"/",meta["count"])
        tmp=out/("frame-%06d.partial.png"%i);scene.render.filepath=str(tmp)
        bpy.ops.render.render(write_still=True);os.replace(tmp,path)
        log("Finished",i+1,"seconds",round(time.monotonic()-start,2))
if __name__=="__main__":main()
