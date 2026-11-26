"""Cache helpers independent of Blender, for fast unit testing."""
import hashlib, json, base64, struct

def mesh_key(mesh):
    digest=hashlib.sha256()
    for k in ("positions","indices","normals","uv","faceMaterials"):
        value=mesh.get(k)
        if value is None:digest.update(b"\\x00");continue
        raw=base64.b64decode(value) if isinstance(value,str) else value
        digest.update(b"\\x01");digest.update(struct.pack("<Q",len(raw)));digest.update(raw)
    digest.update(json.dumps(mesh.get("slots"),separators=(",",":")).encode())
    return digest.digest()

def resume_start(first_needed,checkpoint_interval,count):
    if not isinstance(checkpoint_interval,int) or checkpoint_interval<=0:return 0
    if first_needed<0 or first_needed>=count:return 0
    return first_needed//checkpoint_interval*checkpoint_interval

def complete_checkpoint(frame,ids):
    meshes=frame.get("meshes",[])
    return len(meshes)==len(ids) and {m["id"] for m in meshes}==set(ids) and all("positions" in m and "matrix" in m for m in meshes)
