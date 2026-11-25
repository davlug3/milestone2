import * as THREE from "three";

/** The path tracer's merger assigns one material slot per mesh, not per
 * geometry group. Preserve face/edge materials by giving it single-material
 * meshes. Share immutable indices/attributes with the original where safe. */
export class TraceScene {
  private entries = new Map<THREE.Mesh, { group: THREE.Group; parts: THREE.Mesh[]; geometry: THREE.BufferGeometry }>();
  private root = new THREE.Scene();
  update(source: THREE.Scene): THREE.Scene {
    source.updateMatrixWorld(true);
    this.root.background=source.background;
    this.root.environment=source.environment;
    this.root.environmentIntensity=source.environmentIntensity;
    this.root.backgroundIntensity=source.backgroundIntensity;
    this.root.environmentRotation.copy(source.environmentRotation);
    const seen=new Set<THREE.Mesh>();
    const lights:THREE.Object3D[]=[];
    source.traverseVisible(o=>{
      if((o as THREE.Light).isLight){
        const light=(o as THREE.Light).clone();
        light.position.setFromMatrixPosition(o.matrixWorld);
        light.quaternion.setFromRotationMatrix(o.matrixWorld);
        if(light instanceof THREE.SpotLight || light instanceof THREE.DirectionalLight){
          const original=o as THREE.SpotLight | THREE.DirectionalLight;
          light.target.position.setFromMatrixPosition(original.target.matrixWorld);
          lights.push(light.target);
        }
        lights.push(light);
      }
      if(!(o instanceof THREE.Mesh))return;
      seen.add(o);
      let e=this.entries.get(o);
      if(!e || e.geometry!==o.geometry){
        if(e){this.root.remove(e.group);e.parts.forEach(p=>{if(p.geometry!==e!.geometry)p.geometry.dispose();});}
        const group=new THREE.Group();
        group.matrixAutoUpdate=false;
        const parts:THREE.Mesh[]=[];
        if(Array.isArray(o.material)){
          for(const g of o.geometry.groups){
            const mat=o.material[g.materialIndex ?? 0];
            if(!mat || !g.count)continue;
            const geo=new THREE.BufferGeometry();
            for(const [key,attr] of Object.entries(o.geometry.attributes))geo.setAttribute(key,attr);
            const idx=o.geometry.index;
            const indices=new Uint32Array(g.count);
            for(let j=0;j<g.count;j++)indices[j]=idx?idx.getX(g.start+j):g.start+j;
            geo.setIndex(new THREE.BufferAttribute(indices,1));
            const part=new THREE.Mesh(geo,mat);group.add(part);parts.push(part);
          }
        }else{
          const part=new THREE.Mesh(o.geometry,o.material);group.add(part);parts.push(part);
        }
        e={group,parts,geometry:o.geometry};
        this.entries.set(o,e);
      }
      e.group.matrix.copy(o.matrixWorld);
      e.group.matrixWorldNeedsUpdate=true;
      this.root.add(e.group);
    });
    for(const [mesh,e] of this.entries)if(!seen.has(mesh)){
      this.root.remove(e.group);
      for(const p of e.parts)if(p.geometry!==e.geometry)p.geometry.dispose();
      this.entries.delete(mesh);
    }
    for(const child of [...this.root.children])if(!(child instanceof THREE.Group))this.root.remove(child);
    this.root.add(...lights);
    return this.root;
  }
  dispose(){
    for(const e of this.entries.values())for(const p of e.parts)if(p.geometry!==e.geometry)p.geometry.dispose();
    this.entries.clear();this.root.clear();
  }
}
