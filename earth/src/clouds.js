import * as THREE from 'three';
export async function createClouds(radius){
 const map=await new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL+'clouds-fair.png');
 map.colorSpace=THREE.NoColorSpace;map.wrapS=THREE.RepeatWrapping;map.anisotropy=8;map.generateMipmaps=true;map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;
 const material=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,side:THREE.FrontSide,
  uniforms:{map:{value:map},sun:{value:new THREE.Vector3(-.224,.5,-.837).normalize()},time:{value:0},strength:{value:1},blurLod:{value:0}},
  vertexShader:`varying vec3 n;void main(){n=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D map;uniform vec3 sun;uniform float time,strength,blurLod;varying vec3 n;
   void main(){
    vec3 p=normalize(n);
    vec2 uv=vec2(atan(-p.z,p.x)/6.28318530718+.5-time*.000035,asin(clamp(p.y,-1.,1.))/3.14159265359+.5);
    // Explicit texture footprint grows smoothly during the descent.
    // Use derivatives to retain automatic minification at globe scale.
    float d=textureGrad(map,uv,dFdx(uv)*exp2(blurLod),dFdy(uv)*exp2(blurLod)).a;
    float soft=textureLod(map,uv,blurLod).a;
    d=mix(d,soft,smoothstep(0.,2.,blurLod));
    float alpha=pow(d,.72)*.95*strength;
    float illumination=.62+.38*max(dot(p,sun),0.);
    vec3 c=mix(vec3(.48,.59,.73),vec3(.97,.98,1.),smoothstep(.1,.8,d))*illumination;
    if(alpha<.002)discard;
    gl_FragColor=vec4(c,alpha);
    #include <colorspace_fragment>
   }`
 });
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius+8500,256,128),material);mesh.renderOrder=5;
 return {mesh,update(camera,t){
  material.uniforms.time.value=t;
  const altitude=Math.max(1,camera.position.length()-radius);
  const b=Math.max(0,Math.min(1,Math.log(2500000/altitude)/Math.log(2500000/110000)));
  material.uniforms.blurLod.value=3.5*b*b*(3-2*b);
  const x=Math.max(0,Math.min(1,(t-8)/4));
  material.uniforms.strength.value=1-.78*x*x*(3-2*x);
 }};
}
