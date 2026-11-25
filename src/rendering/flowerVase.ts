import * as THREE from "three";
/** Small handmade ceramic vase and asymmetric botanical arrangement. */
export function createFlowerVase(scene:THREE.Scene){
 const root=new THREE.Group();root.name="ceramic-vase-with-flowers";root.position.set(-.29,0,-.208);scene.add(root);
 const ceramic=new THREE.MeshPhysicalMaterial({color:0xc4b69c,roughness:.72,clearcoat:.08});
 const inside=new THREE.MeshStandardMaterial({color:0x514a3d,roughness:.9});
 const stem=new THREE.MeshStandardMaterial({color:0x52613a,roughness:.86});
 const leaf=new THREE.MeshStandardMaterial({color:0x647344,roughness:.88,side:THREE.DoubleSide});
 const ivory=new THREE.MeshStandardMaterial({color:0xe3d7bd,roughness:.85,side:THREE.DoubleSide});
 const blush=new THREE.MeshStandardMaterial({color:0xb98378,roughness:.85,side:THREE.DoubleSide});
 const pollen=new THREE.MeshStandardMaterial({color:0xb49a53,roughness:.9});
 const mats=[ceramic,inside,stem,leaf,ivory,blush,pollen],geos=new Set<THREE.BufferGeometry>();
 function mesh(g:THREE.BufferGeometry,m:THREE.Material,p:THREE.Vector3,parent:THREE.Group=root){
  const o=new THREE.Mesh(g,m);o.position.copy(p);o.castShadow=o.receiveShadow=true;parent.add(o);geos.add(g);return o;
 }
 const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
 // Continuous outer and inner profile, so the vessel has a real open mouth.
 const profile=[[0,0],[.021,0],[.025,.008],[.029,.026],[.028,.048],[.021,.068],[.014,.083],[.016,.088],[.016,.091],[.012,.091],[.011,.086],[.016,.067],[.023,.045],[.020,.013],[0,.007]].map(([r,y])=>new THREE.Vector2(r,y));
 mesh(new THREE.LatheGeometry(profile,40),ceramic,v(0,0,0));
 mesh(new THREE.CylinderGeometry(.010,.010,.002,20),inside,v(0,.072,0));
 const petalGeo=new THREE.SphereGeometry(1,10,6),leafGeo=new THREE.SphereGeometry(1,10,6),centerGeo=new THREE.SphereGeometry(.004,12,8);
 const ends=[[-.032,.192,-.012],[.019,.222,-.012],[.038,.174,.011],[-.017,.159,.025],[.008,.188,.034],[-.043,.166,-.023]];
 for(let i=0;i<ends.length;i++){
  const [x,y,z]=ends[i],tip=v(x,y,z),start=v((i%3-1)*.003,.075,(i%2-.5)*.004);
  const curve=new THREE.QuadraticBezierCurve3(start,v(x*.28,y*.68,z*.30),tip);
  mesh(new THREE.TubeGeometry(curve,12,.0011,6,false),stem,v(0,0,0));
  for(let j=0;j<2;j++){
   const t=.32+j*.27,point=curve.getPoint(t),a=i*2.39+j*2.1;
   const l=mesh(leafGeo,leaf,point.clone().add(v(Math.cos(a)*.013,.009,Math.sin(a)*.013)));
   l.scale.set(.005,.022,.0014);l.quaternion.setFromUnitVectors(v(0,1,0),v(Math.cos(a),.6,Math.sin(a)).normalize());
  }
  const bloom=new THREE.Group();bloom.position.copy(tip);bloom.quaternion.setFromUnitVectors(v(0,1,0),v(x*5,.65,z*5+.3).normalize());root.add(bloom);
  const count=7+i%3;
  for(let j=0;j<count;j++){
   const a=j*2*Math.PI/count+i*.47,r=.008+(i%3)*.001;
   const petal=mesh(petalGeo,i%3===1?blush:ivory,v(Math.cos(a)*r,.0015,Math.sin(a)*r),bloom);
   petal.scale.set(.011,.0025,.0045);petal.rotation.y=-a;petal.rotation.z=.12*Math.sin(j*2.1+i);
  }
  mesh(centerGeo,pollen,v(0,.003,0),bloom);
 }
 return ()=>{scene.remove(root);geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());};
}
