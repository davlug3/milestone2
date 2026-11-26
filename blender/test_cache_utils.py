import unittest
from cache_utils import mesh_key,resume_start,complete_checkpoint
class CacheTests(unittest.TestCase):
    def test_key(self):
        a={"id":1,"positions":"AAAA","slots":[0]};b={**a,"id":2}
        self.assertEqual(mesh_key(a),mesh_key(b))
        self.assertNotEqual(mesh_key(a),mesh_key({**a,"slots":[1]}))
    def test_resume(self):
        self.assertEqual(resume_start(283,120,2016),240)
        self.assertEqual(resume_start(283,None,2016),0)
    def test_checkpoint(self):
        self.assertTrue(complete_checkpoint({"meshes":[{"id":1,"positions":"A","matrix":[]}]},[1]))
        self.assertFalse(complete_checkpoint({"meshes":[{"id":1,"matrix":[]}]},[1]))
if __name__=="__main__":unittest.main()
