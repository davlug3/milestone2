// Lightweight 2D image warp; no meshes, lighting or 3D reconstruction.
export function createParallax(highQuality=false){
 const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true});
 if(!gl)throw Error('WebGL2 unavailable for parallax');
 function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
 const vs=shader(gl.VERTEX_SHADER,`#version 300 es
 out vec2 uv;
 void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=vec2(p.x,1.-p.y);gl_Position=vec4(p*2.-1.,0.,1.);}`);
 const fs=shader(gl.FRAGMENT_SHADER,`#version 300 es
 precision highp float;
 in vec2 uv;out vec4 color;
 uniform sampler2D photo,depth;uniform float strength;uniform bool packedDepth;
 float getDepth(vec2 p){vec2 d=texture(depth,p).rg;return packedDepth?(d.r*65280.+d.g*255.)/65535.:d.r;}
 void main(){
  vec2 center=vec2(.5),v=uv-center;
  float d=getDepth(uv);
  vec2 texel=1./vec2(textureSize(depth,0));
  float discontinuity=max(abs(getDepth(uv+vec2(texel.x*2.,0.))-getDepth(uv-vec2(texel.x*2.,0.))),abs(getDepth(uv+vec2(0.,texel.y*2.))-getDepth(uv-vec2(0.,texel.y*2.))));
  float stable=1.-.45*smoothstep(.035,.22,discontinuity);
  // Inverse-depth-driven radial displacement. Edges taper to zero.
  float edge=smoothstep(0.,.08,min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y)));
  vec2 sampleUV=clamp(center+v/(1.+strength*edge*stable*(d-.25)),0.,1.);
  for(int i=0;i<2;i++){float z=getDepth(sampleUV);sampleUV=mix(sampleUV,clamp(center+v/(1.+strength*edge*stable*(z-.25)),0.,1.),.45);}
  color=texture(photo,sampleUV);
 }`);
 const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 gl.useProgram(program);const amount=gl.getUniformLocation(program,'strength');gl.uniform1i(gl.getUniformLocation(program,'photo'),0);gl.uniform1i(gl.getUniformLocation(program,'depth'),1);gl.uniform1i(gl.getUniformLocation(program,'packedDepth'),highQuality?1:0);
 const vao=gl.createVertexArray();gl.bindVertexArray(vao);
 const cache=new WeakMap();
 function texture(image){let t=cache.get(image);if(t)return t;t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);cache.set(image,t);return t;}
 return {render(image,depth,w,h,strength){
  w=Math.max(1,Math.round(w));h=Math.max(1,Math.round(h));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  gl.viewport(0,0,w,h);gl.useProgram(program);gl.bindVertexArray(vao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture(image));gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,texture(depth));gl.uniform1f(amount,strength);gl.drawArrays(gl.TRIANGLES,0,3);return canvas;
 }};
}
