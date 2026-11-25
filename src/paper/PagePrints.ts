import {createPaperGrain,paintPaperWear} from "./paperWear";
import * as THREE from "three";

const IDS = [10,11,15,16,17,18,19,20,28,29,31,33,37,43,49,57,61,65,73,77,83,84,88,94];
const WIDTH = 512;
const HEIGHT = 660;

/** Shared image cache and a unique, UV-stable printed layout for every face. */
export function createPagePrints(edge: THREE.Material, anisotropy: number) {
  const grain=createPaperGrain();
  const images = new Map<number, Promise<HTMLImageElement | null>>();
  const textures: THREE.CanvasTexture[] = [];
  const materials: THREE.MeshStandardMaterial[] = [];
  let disposed = false;
  let loadedFaces = 0;
  let failedFaces = 0;
  const load = (id: number) => {
    let pending = images.get(id);
    if (!pending) {
      pending = new Promise(resolve => {
        const image = new Image();
        const finish=(value:HTMLImageElement|null)=>{clearTimeout(timer);image.onload=null;image.onerror=null;resolve(value);};
        const timer=setTimeout(()=>finish(null),20000);
        image.onload = () => finish(image);
        image.onerror = () => finish(null);
        image.src = import.meta.env.BASE_URL + "page-photos/" + id + ".jpg";
      });
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
    const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
    const sw = w / scale, sh = h / scale;
    ctx.drawImage(image, (image.naturalWidth-sw)/2, (image.naturalHeight-sh)/2, sw, sh, x,y,w,h);
  }
  function face(page: number) {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d")!;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, anisotropy);
    textures.push(texture);
    const material = new THREE.MeshPhysicalMaterial({ map: texture, color: 0xffffff, roughness: 0.79 + .035*Math.sin(page*2.399), roughnessMap:grain.roughness, bumpMap:grain.bump,bumpScale:.000035, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.78, sheen: 0.12, sheenRoughness: 1, sheenColor: new THREE.Color(0xf4efe4) });
    materials.push(material);
    const layouts = [
      [[35,35,442,590]],
      [[35,35,442,288],[35,337,442,288]],
      [[35,35,442,338],[35,387,214,238],[263,387,214,238]],
      [[35,35,214,270],[263,35,214,270],[35,319,442,306]]
    ];
    const boxes = layouts[(page-1) % layouts.length];
    function paint(photos: (HTMLImageElement|null)[]) {
      ctx.fillStyle = "#f4efe4";
      ctx.fillRect(0,0,WIDTH,HEIGHT);
      boxes.forEach(([x,y,w,h], i) => drawPhoto(ctx,photos[i] ?? null,x,y,w,h));
      paintPaperWear(ctx,WIDTH,HEIGHT,page);
      texture.needsUpdate = true;
    }
    paint([]);
    void Promise.all(boxes.map((_, i) => load(IDS[((page-1)*5 + i*7) % IDS.length]))).then(photos => {
      if (disposed) return;
      paint(photos);
      if (photos.every(Boolean)) loadedFaces++;
      else failedFaces++;
    });
    return material;
  }
  return {
    sheet(index: number): THREE.Material[] { return [face(index*2+1),face(index*2+2),edge]; },
    status: () => ({ totalFaces: textures.length, loadedFaces, failedFaces }),
    dispose() {
      disposed = true;
      textures.forEach(t => t.dispose());
      materials.forEach(m => m.dispose());
      grain.bump.dispose();grain.roughness.dispose();
      images.clear();
    }
  };
}
