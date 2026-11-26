import {browserAssets,type SceneAssets} from "../rendering/sceneAssets";
import {createPaperGrain,paintPaperWear} from "./paperWear";
import * as THREE from "three";
import {type PhotoPage} from "./bookPhotoLayout";

export const IDS = [10,11,15,16,17,18,19,20,28,29,31,33,37,43,49,57,61,65,73,77,83,84,88,94];
const WIDTH = 512;
const HEIGHT = 660;

/** Shared image cache and a unique, UV-stable printed layout for every face. */
export function createPagePrints(edge: THREE.Material, anisotropy: number, pages: readonly PhotoPage[], scale=1, assets:SceneAssets=browserAssets, photoBase=import.meta.env.BASE_URL+"page-photos/") {
  const grain=createPaperGrain();
  const blank=new THREE.MeshPhysicalMaterial({color:0xf4efe4,roughness:.82,bumpMap:grain.bump,bumpScale:.000035});
  const images = new Map<string, Promise<HTMLImageElement | null>>();
  const textures: THREE.CanvasTexture[] = [];
  const materials: THREE.MeshStandardMaterial[] = [];
  let disposed = false;
  let loadedFaces = 0;
  let failedFaces = 0;
  const photoRoot=assets.resolve(photoBase);
  const load = (id: string) => {
    let pending = images.get(id);
    if (!pending) {
      pending=assets.image(assets.resolve(id,photoRoot)).catch(()=>null);
      images.set(id, pending);
    }
    return pending;
  };
  function drawPhoto(ctx: CanvasRenderingContext2D, image: HTMLImageElement | null, x: number, y: number, w: number, h: number) {
    if (!image) {
      ctx.fillStyle = "#e0ded8";
      ctx.fillRect(x,y,w,h);
      return;
    }
    const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
    const dw=image.naturalWidth*scale, dh=image.naturalHeight*scale;
    ctx.drawImage(image,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
  }
  function face(page: number) {
    const canvas = assets.canvas();
    canvas.width = Math.round(WIDTH*scale);
    canvas.height = Math.round(HEIGHT*scale);
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale,scale);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, anisotropy);
    textures.push(texture);
    const material = new THREE.MeshPhysicalMaterial({ map: texture, color: 0xffffff, roughness: 0.79 + .035*Math.sin(page*2.399), roughnessMap:grain.roughness, bumpMap:grain.bump,bumpScale:.000035, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.78, sheen: 0.12, sheenRoughness: 1, sheenColor: new THREE.Color(0xf4efe4) });
    materials.push(material);
    const {boxes,photos: names}=pages[page-1];
    function paint(photos: (HTMLImageElement|null)[]) {
      ctx.fillStyle = "#f4efe4";
      ctx.fillRect(0,0,WIDTH,HEIGHT);
      boxes.forEach(([x,y,w,h], i) => drawPhoto(ctx,photos[i] ?? null,x,y,w,h));
      paintPaperWear(ctx,WIDTH,HEIGHT,page);
      texture.needsUpdate = true;
    }
    paint([]);
    void Promise.all(names.map(load)).then(photos => {
      if (disposed) return;
      paint(photos);
      if (photos.every(Boolean)) loadedFaces++;
      else failedFaces++;
    });
    return material;
  }
  return {
    sheet(index: number): THREE.Material[] { return [index*2<pages.length?face(index*2+1):blank,index*2+1<pages.length?face(index*2+2):blank,edge]; },
    status: () => ({ totalFaces: textures.length, loadedFaces, failedFaces }),
    dispose() {
      disposed = true;
      textures.forEach(t => t.dispose());
      materials.forEach(m => m.dispose());
      blank.dispose();
      grain.bump.dispose();grain.roughness.dispose();
      images.clear();
    }
  };
}
