import * as THREE from "three";

const IDS = [10,11,15,16,17,18,19,20,28,29,31,33,37,43,49,57,61,65,73,77,83,84,88,94];
const WIDTH = 512;
const HEIGHT = 660;

/** Shared image cache and a unique, UV-stable printed layout for every face. */
export function createPagePrints(edge: THREE.Material, anisotropy: number) {
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
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
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
      ctx.fillStyle = "#777";
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Photo unavailable", x + w/2, y + h/2);
      ctx.textAlign = "left";
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
    const material = new THREE.MeshStandardMaterial({ map: texture, color: 0xffffff, roughness: 0.92, metalness: 0 });
    materials.push(material);
    const layouts = [
      [[35,76,442,488]],
      [[35,76,442,226],[35,315,442,249]],
      [[35,76,442,270],[35,359,214,205],[263,359,214,205]],
      [[35,76,214,235],[263,76,214,235],[35,324,442,240]]
    ];
    const boxes = layouts[(page-1) % layouts.length];
    function paint(photos: (HTMLImageElement|null)[]) {
      ctx.fillStyle = "#f4efe4";
      ctx.fillRect(0,0,WIDTH,HEIGHT);
      ctx.fillStyle = "#343c40";
      ctx.font = "bold 21px sans-serif";
      ctx.fillText("PHOTO COLLECTION",35,48);
      ctx.fillStyle = "#777";
      ctx.fillRect(35,59,442,1);
      boxes.forEach(([x,y,w,h], i) => drawPhoto(ctx,photos[i] ?? null,x,y,w,h));
      ctx.fillStyle = "#555";
      ctx.font = "15px sans-serif";
      ctx.fillText("Sample imagery  /  Lorem Picsum",35,605);
      ctx.textAlign = "right";
      ctx.fillText(String(page).padStart(3,"0"),477,630);
      ctx.textAlign = "left";
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
      images.clear();
    }
  };
}
