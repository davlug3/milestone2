"""Offline checks of the actual notebook helper functions."""
import ast, json, tempfile, unittest, hashlib, os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
NB=json.loads((ROOT/'colab/Milestone2_Render.ipynb').read_text())
def helper(cell,name,env):
    tree=ast.parse(''.join(NB['cells'][cell]['source']))
    node=next(x for x in tree.body if isinstance(x,ast.FunctionDef) and x.name==name)
    exec(compile(ast.Module(body=[node],type_ignores=[]),'<notebook>','exec'),env)
    return env[name]
class Tests(unittest.TestCase):
    def test_cells_compile(self):
        for c in NB['cells']:
            if c['cell_type']=='code':compile(''.join(c['source']),'<colab>','exec')
    def test_patch_idempotent(self):
        patch=helper(3,'patch_renderer',{})
        old='    scene.cycles.denoiser="OPTIX" if a.device=="OPTIX" else "OPENIMAGEDENOISE"'
        patched=patch(old)
        self.assertEqual(patch(patched),patched)
        self.assertIn('denoising_use_gpu=True',patched)
        with self.assertRaises(RuntimeError):patch('unknown')
    def test_download_reuses_matching_file(self):
        env={'hashlib':hashlib,'os':os}
        helper(1,'file_hash',env)
        download=helper(1,'download',env)
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'test';p.write_bytes(b'data')
            # No Drive API available: any attempted network access fails this test.
            self.assertFalse(download('id',p,{'size':'4','md5Checksum':hashlib.md5(b'data').hexdigest()}))
    def test_duplicate_names_rejected(self):
        env={'children':lambda _: [{'name':'duplicate'},{'name':'duplicate'}]}
        index=helper(1,'index_files',env)
        with self.assertRaises(RuntimeError):index('folder')
    def test_upload_reuse_and_conflict(self):
        upload=helper(1,'upload',{'hashlib':hashlib})
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'test';p.write_bytes(b'data')
            record={'size':'4','md5Checksum':hashlib.md5(b'data').hexdigest()}
            self.assertEqual(upload(p,'folder',record),record)
            with self.assertRaises(RuntimeError):upload(p,'folder',{'size':'4','md5Checksum':'wrong'})
if __name__=='__main__':unittest.main()
