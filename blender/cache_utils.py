"""Cache helpers independent of Blender, for fast unit testing."""
import hashlib, json

def mesh_key(mesh):
    fields=[mesh.get(k) for k in ("positions","indices","normals","uv","faceMaterials","slots")]
    return hashlib.sha256(json.dumps(fields,separators=(",",":")).encode()).digest()

def resume_start(first_needed,checkpoint_interval,count):
    if not isinstance(checkpoint_interval,int) or checkpoint_interval<=0:return 0
    if first_needed<0 or first_needed>=count:return 0
    return first_needed//checkpoint_interval*checkpoint_interval

def complete_checkpoint(frame,ids):
    meshes=frame.get("meshes",[])
    return len(meshes)==len(ids) and {m["id"] for m in meshes}==set(ids) and all("positions" in m and "matrix" in m for m in meshes)
