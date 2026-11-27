"""Generate content-addressed, high-quality relative inverse-depth maps."""
import argparse,json,os,pathlib
import numpy as np
from PIL import Image,ImageOps,ImageFilter
import onnxruntime as ort
root=pathlib.Path(__file__).resolve().parents[1]
public=root/'slideshow2d/public'
parser=argparse.ArgumentParser()
parser.add_argument('--model',default=str(root/'.cache/depth/model.onnx'))
parser.add_argument('--size',type=int,default=518)
parser.add_argument('--ensemble',action='store_true')
parser.add_argument('--output',default='depth')
args=parser.parse_args()
options=ort.SessionOptions()
options.intra_op_num_threads=min(6,os.cpu_count() or 2)
session=ort.InferenceSession(args.model,sess_options=options,providers=['CPUExecutionProvider'])
inp=session.get_inputs()[0]
print('Depth model:',args.model,inp.name,inp.shape,flush=True)
mean=np.array([.485,.456,.406],dtype=np.float32)
std=np.array([.229,.224,.225],dtype=np.float32)
dest=public/args.output;dest.mkdir(exist_ok=True)
photos=json.loads((public/'photos.json').read_text())['photos']
for i,name in enumerate(photos):
    src=public/name
    out=dest/(src.stem+'.png')
    if out.exists():
        print(i+1,'/',len(photos),'cached',flush=True);continue
    im=ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    scale=args.size/max(im.size)
    w,h=[max(28,round(v*scale/14)*14) for v in im.size]
    if isinstance(inp.shape[-2],int):h=inp.shape[-2]
    if isinstance(inp.shape[-1],int):w=inp.shape[-1]
    a=(np.asarray(im.resize((w,h),Image.Resampling.LANCZOS),dtype=np.float32)/255.-mean)/std
    tensor=np.ascontiguousarray(a.transpose(2,0,1)[None])
    def infer(x):
        z=np.squeeze(session.run(None,{inp.name:np.ascontiguousarray(x)})[0])
        if z.ndim!=2 or not np.isfinite(z).all():raise ValueError('Invalid depth output')
        lo,hi=np.percentile(z,[2,98])
        if hi-lo<1e-6:raise ValueError('Constant depth')
        return (z-lo)/(hi-lo)
    z=infer(tensor)
    if args.ensemble:z=(z+infer(tensor[:,:,:,::-1])[:,::-1])*.5
    z=np.clip(z,0,1)
    # Pack 16-bit depth into RG so browser textures retain precision.
    z=np.asarray(Image.fromarray(z.astype(np.float32)).resize((w,h),Image.Resampling.BICUBIC))
    # Mild spatial regularization without heavily blurring silhouettes.
    q=np.uint16(np.clip(z,0,1)*65535+.5)
    rgba=np.zeros((h,w,3),dtype=np.uint8);rgba[:,:,0]=q>>8;rgba[:,:,1]=q&255;rgba[:,:,2]=255
    tmp=out.with_suffix('.tmp.png');Image.fromarray(rgba).save(tmp);tmp.replace(out)
    print(i+1,'/',len(photos),'depth',w,h,flush=True)
print('All depth maps ready',flush=True)
