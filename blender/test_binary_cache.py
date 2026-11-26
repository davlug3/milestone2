import gzip,json,struct,tempfile,unittest
from pathlib import Path
from binary_cache import read_cache
from cache_utils import mesh_key
class BinaryTests(unittest.TestCase):
    def test_legacy_and_binary(self):
        data={"meshes":[{"id":1,"positions":"AQIDBA==","slots":[0]}]}
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/"frame.gz";p.write_bytes(gzip.compress(json.dumps(data).encode()))
            self.assertEqual(read_cache(p),data)
            meta=json.dumps({"meshes":[{"id":1,"positions":{"$binary":[0,4]},"slots":[0]}]}).encode()
            p.write_bytes(gzip.compress(b"M2CACHE2"+struct.pack("<I",len(meta))+meta+bytes([1,2,3,4])))
            decoded=read_cache(p)
            self.assertEqual(bytes(decoded["meshes"][0]["positions"]),bytes([1,2,3,4]))
            self.assertEqual(mesh_key(decoded["meshes"][0]),mesh_key(data["meshes"][0]))
    def test_bad_range(self):
        meta=json.dumps({"meshes":[{"positions":{"$binary":[0,9]}}]}).encode()
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/"bad.gz";p.write_bytes(gzip.compress(b"M2CACHE2"+struct.pack("<I",len(meta))+meta))
            with self.assertRaises(ValueError):read_cache(p)
if __name__=="__main__":unittest.main()
