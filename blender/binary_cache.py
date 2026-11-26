"""Read legacy gzip JSON and v2 typed binary payloads without Blender."""
import gzip,json,struct
MAGIC=b"M2CACHE2"
def read_cache(path):
    with gzip.open(path,"rb") as f: raw=f.read()
    if not raw.startswith(MAGIC):return json.loads(raw)
    if len(raw)<12:raise ValueError("Truncated binary cache header")
    size=struct.unpack_from("<I",raw,8)[0]
    end=12+size
    if end>len(raw):raise ValueError("Truncated binary cache metadata")
    data=json.loads(raw[12:end])
    payload=memoryview(raw)[end:]
    def unpack(ref):
        if not isinstance(ref,dict) or "$binary" not in ref:return ref
        offset,length=ref["$binary"]
        if type(offset) is not int or type(length) is not int or offset<0 or length<0 or offset+length>len(payload):
            raise ValueError("Invalid binary cache range")
        return payload[offset:offset+length]
    for mesh in data["meshes"]:
        for key in ("positions","normals","uv","indices","faceMaterials"):
            if key in mesh:mesh[key]=unpack(mesh[key])
    for tex in data.get("textures",[]):tex["png"]=unpack(tex["png"])
    return data
