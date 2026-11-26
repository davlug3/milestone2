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
    p.add_argument("--passes",choices=["all","beauty"],default="all")
    p.add_argument("--format",choices=["PNG","EXR"],default="EXR")
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
    scene.cycles.adaptive_min_samples=16
    scene.cycles.diffuse_bounces=min(a.bounces,4)
    scene.cycles.glossy_bounces=min(a.bounces,4)
    scene.cycles.transmission_bounces=min(a.bounces,6)
    scene.cycles.denoiser="OPTIX" if a.device=="OPTIX" else "OPENIMAGEDENOISE"
    scene.render.use_persistent_data=True
    scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100
    # Blender 5.x filters the file-format enum by media_type.
    image_settings=scene.render.image_settings
    if hasattr(image_settings,"media_type"):
        image_settings.media_type="MULTI_LAYER_IMAGE" if a.format=="EXR" else "IMAGE"
    image_settings.file_format="OPEN_EXR_MULTILAYER" if a.format=="EXR" else "PNG"
    if a.format=="EXR":
        scene.render.image_settings.color_depth="16"
        scene.render.image_settings.exr_codec="ZIP"
    else:
        scene.render.image_settings.color_depth="16"
    if a.format=="EXR" or a.passes=="all":
        layer=scene.view_layers[0]
        for key in ["z","normal","position","uv","diffuse_color","diffuse_direct","diffuse_indirect","glossy_color","glossy_direct","glossy_indirect","transmission_color","transmission_direct","transmission_indirect","volume_direct","volume_indirect","emit","environment","ambient_occlusion","object_index","material_index","mist"]:
            if hasattr(layer,"use_pass_"+key):setattr(layer,"use_pass_"+key,True)
            elif hasattr(layer.cycles,"use_pass_"+key):setattr(layer.cycles,"use_pass_"+key,True)
    if a.format=="PNG":scene.render.image_settings.color_mode="RGB"
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
        if m.get("roughnessMap") is not None:
            node=texture(m["roughnessMap"]);sep=nodes.new("ShaderNodeSeparateColor");links.new(node.outputs["Color"],sep.inputs["Color"]);links.new(sep.outputs["Green"],bs.inputs["Roughness"])
        if m.get("normalMap") is not None:
            node=texture(m["normalMap"]);normal=nodes.new("ShaderNodeNormalMap");normal.inputs["Strength"].default_value=abs(m.get("normalScale",[1,1])[0]);links.new(node.outputs["Color"],normal.inputs["Color"]);links.new(normal.outputs["Normal"],bs.inputs["Normal"])
        if "emissive" in m:
            bs.inputs["Emission Color"].default_value=(*m["emissive"],1);bs.inputs["Emission Strength"].default_value=m["emissiveIntensity"]
            if m.get("emissiveMap") is not None:links.new(texture(m["emissiveMap"]).outputs["Color"],bs.inputs["Emission Color"])
        if m["bump"] is not None:
            node=texture(m["bump"]);bump=nodes.new("ShaderNodeBump");bump.inputs["Distance"].default_value=abs(m["bumpScale"])
            links.new(node.outputs["Color"],bump.inputs["Height"]);links.new(bump.outputs["Normal"],bs.inputs["Normal"])
        mat.pass_index=min(m["id"]+1,32767)
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
        obj=bpy.data.objects.new(m["name"],mesh);bpy.context.scene.collection.objects.link(obj);objs[m["id"]]=obj;obj.pass_index=min(m["id"]+1,32767)
    return objs

def sync_lights(scene, specs, objects):
    if not specs:return
    if not objects:
        for obj in list(scene.objects):
            if obj.type=="LIGHT":bpy.data.objects.remove(obj,do_unlink=True)
    for s in specs:
        i=s["id"];kind="SUN" if "Directional" in s["type"] else "POINT" if "Point" in s["type"] else "SPOT"
        if i not in objects:
            light=bpy.data.lights.new(s["name"],kind);obj=bpy.data.objects.new(s["name"],light);scene.collection.objects.link(obj);objects[i]=obj
        obj=objects[i];light=obj.data;light.color=s["color"];obj.location=C@Vector(s["position"])
        # Three intensity -> Cycles power is an approximate conversion, requiring calibration.
        light.energy=s["intensity"] if kind=="SUN" else s["intensity"]*4*np.pi
        if kind!="SUN":light.shadow_soft_size=max(.001,s["radius"])
        if kind=="SPOT":light.spot_size=min(3.13,s["angle"]*2);light.spot_blend=s["penumbra"]
        if kind!="POINT":
            direction=C@Vector(s["target"])-obj.location
            if direction.length>1e-8:obj.rotation_euler=direction.to_track_quat("-Z","Y").to_euler()

# One Cycles evaluation, multiple compositor PNG outputs. Technical buffers are
# encoded to bounded ranges; PNG is not a lossless replacement for float EXR.
PASS_SPECS={
 "albedo":("DiffCol",None),"diffuse-direct":("DiffDir",None),"diffuse-indirect":("DiffInd",None),
 "glossy-color":("GlossCol",None),"glossy-direct":("GlossDir",None),"glossy-indirect":("GlossInd",None),
 "transmission-color":("TransCol",None),"transmission-direct":("TransDir",None),"transmission-indirect":("TransInd",None),
 "volume-direct":("VolumeDir",None),"volume-indirect":("VolumeInd",None),"emission":("Emit",None),
 "environment":("Env",None),"ambient-occlusion":("AO",None),"depth":("Depth","depth"),
 "normal":("Normal","normal"),"position":("Position","position"),"uv":("UV",None),
 "object-id":("IndexOB","index"),"material-id":("IndexMA","index"),"mist":("Mist",None),"alpha":("Alpha",None)
}
def png_pass_outputs(scene,out):
    if bpy.app.version>=(5,0,0):
        tree=bpy.data.node_groups.new("PNG render passes","CompositorNodeTree")
        scene.compositing_node_group=tree
        tree.interface.new_socket(name="Image",in_out="OUTPUT",socket_type="NodeSocketColor")
        composite=tree.nodes.new("NodeGroupOutput")
    else:
        scene.use_nodes=True;tree=scene.node_tree;tree.nodes.clear()
        composite=tree.nodes.new("CompositorNodeComposite")
    layers=tree.nodes.new("CompositorNodeRLayers")
    layers.layer=scene.view_layers[0].name
    tree.links.new(layers.outputs["Image"],composite.inputs["Image"])
    outputs={}
    missing=[]
    for name,(socket,encoding) in PASS_SPECS.items():
        modern={"DiffCol":"Diffuse Color","DiffDir":"Diffuse Direct","DiffInd":"Diffuse Indirect","GlossCol":"Glossy Color","GlossDir":"Glossy Direct","GlossInd":"Glossy Indirect","TransCol":"Transmission Color","TransDir":"Transmission Direct","TransInd":"Transmission Indirect","VolumeDir":"Volume Direct","VolumeInd":"Volume Indirect","Emit":"Emission","Env":"Environment","AO":"Ambient Occlusion","IndexOB":"Object Index","IndexMA":"Material Index"}
        source=layers.outputs.get(modern.get(socket,socket)) or layers.outputs.get(socket)
        if source is None or not source.enabled:
            missing.append(name);continue
        if encoding in ("depth","index"):
            node=tree.nodes.new("ShaderNodeMath" if bpy.app.version>=(5,0,0) else "CompositorNodeMath")
            node.operation="MULTIPLY";node.inputs[1].default_value=.1 if encoding=="depth" else 1/65535
            node.use_clamp=True;tree.links.new(source,node.inputs[0]);source=node.outputs[0]
        elif encoding in ("normal","position"):
            node=tree.nodes.new("ShaderNodeVectorMath")
            node.operation="SCALE";node.inputs["Scale"].default_value=.5 if encoding=="normal" else .025
            tree.links.new(source,node.inputs[0])
            offset=tree.nodes.new("ShaderNodeVectorMath");offset.operation="ADD";offset.inputs[1].default_value=(.5,.5,.5)
            tree.links.new(node.outputs[0],offset.inputs[0]);source=offset.outputs[0]
        node=tree.nodes.new("CompositorNodeOutputFile")
        if hasattr(node.format,"media_type"):node.format.media_type="IMAGE"
        node.format.file_format="PNG";node.format.color_depth="16";node.format.color_mode="RGB";node.format.compression=15
        if hasattr(node,"save_as_render"):node.save_as_render=False
        if hasattr(node.format,"color_management"):
            node.format.color_management="OVERRIDE"
            node.format.view_settings.view_transform="Raw"
            node.format.view_settings.exposure=0
        folder=out/name;folder.mkdir(parents=True,exist_ok=True)
        if hasattr(node,"file_output_items"):
            node.directory=str(folder)
            node.file_name="pass-"
            node.file_output_items.clear()
            node.file_output_items.new("RGBA","image")
            target=node.inputs[0]
        else:
            node.base_path=str(folder);node.file_slots[0].path="pass-";target=node.inputs[0]
        tree.links.new(source,target);outputs[name]=node
    if missing:log("Unavailable native passes:",", ".join(missing))
    (out/"passes.json").write_text(json.dumps({"beauty":"frame-%06d.png","passes":list(outputs),"unavailable":missing,"encoding":{"depth":"distance / 10 meters, clamped","normal":"normal * 0.5 + 0.5","position":"world position / 40 + 0.5, clamped","object-id":"index / 65535","material-id":"index / 65535","lighting":"linear RGB clamped to PNG range"}},indent=2))
    return outputs

def finish_png_passes(out,outputs,i):
    for name in outputs:
        folder=out/name
        generated=list(folder.glob("pass-*.png"))
        if len(generated)!=1:raise RuntimeError("Expected one compositor PNG for "+name+", found "+str(generated))
        os.replace(generated[0],folder/("frame-%06d.png"%i))

def main():
    a=args();folder=Path(a.cache);out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene,cam=configure(a)
    data=read(folder/"scene.json.gz");objs=build(data,folder);lights={}
    if "background" in data:
        bg=scene.world.node_tree.nodes.get("Background");bg.inputs["Color"].default_value=(*data["background"],1);bg.inputs["Strength"].default_value=max(.1,data.get("environmentIntensity",.2))
    meta=json.loads((folder/"manifest.json").read_text())
    scene.render.fps=meta["fps"]
    outputs=png_pass_outputs(scene,out) if a.format=="PNG" and a.passes=="all" else {}
    (out/"object-ids.json").write_text(json.dumps({str(obj.pass_index):obj.name for obj in objs.values()},indent=2))
    (out/"material-ids.json").write_text(json.dumps({str(m.pass_index):m.name for m in bpy.data.materials if m.pass_index},indent=2))
    log(len(objs),"meshes;",len(data["materials"]),"materials;",meta["count"],"frames")
    for i in range(meta["count"]):
        frame=read(folder/("frame-%06d.json.gz"%i))
        for m in frame["meshes"]:
            obj=objs[m["id"]];obj.matrix_world=C@mat4(m["matrix"]);obj.hide_render=not m.get("visible",True)
            if "positions" in m:
                obj.data.vertices.foreach_set("co",arr(m["positions"],"<f4"));obj.data.update()
                # Normals recompute for deforming geometry (static custom normals retained).
                if obj.data.has_custom_normals:obj.data.normals_split_custom_set([(0,0,0)]*len(obj.data.loops))
        sync_lights(scene,frame.get("lights",[]),lights)
        camera=frame["camera"];cam.matrix_world=C@mat4(camera["matrix"])
        cam.data.angle_y=camera["fov"]*np.pi/180
        cam.data.dof.focus_distance=camera["focus"];cam.data.dof.aperture_fstop=camera["fstop"]
        ext="exr" if a.format=="EXR" else "png"
        path=out/("frame-%06d.%s"%(i,ext))
        if path.exists() and path.stat().st_size>100 and all((out/name/path.name).exists() and (out/name/path.name).stat().st_size>100 for name in outputs):log("Resume",i+1);continue
        for name in outputs:
            for stale in (out/name).glob("pass-*.png"):stale.unlink()
        start=time.monotonic();log("Rendering",i+1,"/",meta["count"])
        tmp=out/("frame-%06d.partial.%s"%(i,ext));scene.render.filepath=str(tmp)
        bpy.ops.render.render(write_still=True)
        if outputs:finish_png_passes(out,outputs,i)
        os.replace(tmp,path)
        log("Finished",i+1,"seconds",round(time.monotonic()-start,2))
if __name__=="__main__":main()
