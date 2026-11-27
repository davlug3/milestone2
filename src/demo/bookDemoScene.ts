import { planPhotoPages, bookSheetCount } from "../paper/bookPhotoLayout";
import { browserAssets } from "../rendering/sceneAssets";
import {createSceneRenderer} from "../rendering/sceneRenderer";
import {geometrySession} from "../rendering/geometrySession";
import {visualStyle,addStyleControl} from "../rendering/visualStyle";
import {createRenderPasses,type PassName} from "../rendering/renderPasses";
import {browserQuality,QUALITY_PROFILES,qualityOptions,changeQuality} from "../rendering/quality";
import {createOrnamentalPlant} from "../rendering/ornamentalPlant";
import {createFlowerVase} from "../rendering/flowerVase";
import {createStudioWall} from "../rendering/studioWall";
import {restingPageWear,freePageWear} from "../paper/pageShape";
import {createDeskProps} from "../rendering/deskProps";
import { loadingStage, loadingReady } from "../playback/loading";
import { bindPreviewViewport } from "../playback/viewport";
import { PlaybackClock, createPlaybackControls } from "../playback/transport";
import * as THREE from "three";
import { BlenderExport } from "../rendering/blenderExport";
import { StudioTracer, PhysicalCamera, type RenderMode } from "../rendering/studioTracer";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { cameraVerticalFov, cinematicCameraPose, CAMERA_SENSOR_W_MM, CAMERA_FOCAL_MM, BOOK_ASPECT } from "../rendering/cinematicCamera";
import { BOOK_DIMENSIONS as BASE_BOOK_DIMENSIONS } from "../config/bookConfig";
import { createBookMaterials } from "../book/materials";
import { createCover } from "../book/cover";
import { DomeShadows } from "../rendering/domeShadows";
import { addStudioLighting } from "../rendering/lighting";
import { createStudioTable } from "../rendering/studioTable";
import { createClothTexture } from "../rendering/surfaceTextures";
import type { PaperSimulation } from "../physics/PaperSimulation";
import { TurnHandoff } from "../physics/TurnHandoff";
import { RenderPose, PLAYBACK_RATE } from "../physics/RenderPose";
import { bindingLoad, bindingLift } from "../book/bindingFlex";
import { ThickSheetGeometry } from "../paper/ThickSheetGeometry";
import { createPagePrints } from "../paper/PagePrints";
import { createParticle } from "../physics/Particle";
import type { PageTurnController } from "../animation/PageTurnController";
import {makeTurn,type TurnSpec} from "./bookTurnSimulation";
import { Heightfield } from "../physics/Heightfield";
import { clamp01, smootherstep } from "../animation/easing";
import {
  HINGE_DROP_START,
  coverPose,
  openCoverSurface,
} from "../book/coverRig";
import {
  BIND_RAMP,
  spineClothTopY,
  spinePlaneEdges,
  spinePlaneY,
} from "../book/spineBinding";
import {
  TEXT_BLOCK_THICKNESS,
  TEXT_SHEET_THICKNESS,
  textRoot,
  textStackY,
  textPageY,
} from "../book/textBlockBinding";
import {
  headbandGeometry,
  spineCoverGeometry,
  updateSpineCoverGeometry,
} from "../book/spineRig";

/**
 * Animated hardcover book demo with a play/pause button.
 *
 * All configured sheets are represented individually. All sheets have a deterministic curved rest state from initialization;
 * the first eight use the high-resolution XPBD turn solver. The
 * full material spine unfolds as a constant-length arc, independent of the
 * hardcover's outer spine. No solid page wedge remains.
 *
 * Playback is deterministic in an absolute timeline `time` (seconds).
 */

interface TurnWindow {
  start: number;
  dur: number;
  settle: number;
}

interface PageInstance {
  sim: PaperSimulation;
  geo: ThickSheetGeometry;
  mesh: THREE.Mesh;
  controller: PageTurnController;
  handoff: TurnHandoff;
  renderPose: RenderPose;
  window: TurnWindow;
  stepped: number;
  maxSteps: number;
  restY: number;
  index: number;
  landY: number;
  baked: boolean;
  /** Last `stepped` value at which the GPU geometry was refreshed. */
  geoStep: number;
}

export async function startBookDemo(container: HTMLElement): Promise<() => void> {
  const manifest=await browserAssets.json<{photos:string[]}>(import.meta.env.BASE_URL+"page-photos/manifest.json");
  if(!Array.isArray(manifest.photos)||!manifest.photos.length)throw Error("No book photos available");
  const photoPages=planPhotoPages(manifest.photos);
  const BOOK_DIMENSIONS={...BASE_BOOK_DIMENSIONS,sheetCount:bookSheetCount(photoPages.length)};
const W = BOOK_DIMENSIONS.width;
const H = BOOK_DIMENSIONS.height;
const CT = BOOK_DIMENSIONS.coverThickness;
const PBT = TEXT_BLOCK_THICKNESS;
// Case spine panel width: the closed book thickness. Open, it lies flat
// between the boards, so the open book is 2 * width + SPINE_PANEL_W long.
const SPINE_PANEL_W = 2 * CT + PBT;
// How far the spine cloth turns in onto the boards' outer faces (hides the
// board bevel at the hinge, so the case reads as one continuous surface).
const SPINE_TURN_IN = 0.003;
const NUM_SHEETS = BOOK_DIMENSIONS.sheetCount;
const NUM_TURNS = Math.max(0,Math.ceil((photoPages.length-1)/2));
const NUM_STATIC = NUM_SHEETS - NUM_TURNS;

const FIXED_DT = 1 / 120;


// --- Spine binding ---------------------------------------------------------
// The pages are bound on a cloth plane between the two cover hinges. A sheet's
// inner edge sits on this plane at `spineFanY` and ramps up to its stack height
// over BIND_RAMP. See src/book/spineBinding.ts.
const SPINE_Y = spinePlaneY(BOOK_DIMENSIONS);
const SPINE_CLOTH_Y = spineClothTopY(BOOK_DIMENSIONS);

// --- Cover geometry / collision -------------------------------------------
// The open front cover lies flat on the left; its inner lining is the top
// surface that landing pages must rest on.
const OPEN_COVER_CENTER_Y = CT / 2;
const OPEN_COVER = openCoverSurface(
  BOOK_DIMENSIONS,
  OPEN_COVER_CENTER_Y,
  SPINE_PANEL_W,
);
const PAGE_SHELL_HALF = 0.000125; // particle mid-surface to page face
const COVER_CONTACT_GAP = 0.00005;
// Particle-centre floor on the open cover (page underside just touches it).
const COVER_FLOOR_Y =
  OPEN_COVER.topY + PAGE_SHELL_HALF + COVER_CONTACT_GAP;
// Keep each page's fore-edge pin just above the floor, then stack upward.
const landBase = COVER_FLOOR_Y + 0.0002;
// Must exceed the bake clearance (0.0006) so each page lands just above the
// surface of the pages already stacked below it.
const landStep = 0.0008;

const TURN_DUR = 2.5;
const SETTLE_DUR = 0.5;

// --- Timeline --------------------------------------------------------------


const COVER_START = 0.6;
const COVER_END = 2.8; // 2.2 s hinge swing
const FIRST_TURN = 3.7;
// Keep the full settling window before starting the next sheet.
const TURN_GAP = TURN_DUR + SETTLE_DUR + 0.05;

const TIMELINE = {
  coverStart: COVER_START,
  coverEnd: COVER_END,
  turns: Array.from({ length: NUM_TURNS }, (_, k) => ({
    start: FIRST_TURN + k * TURN_GAP,
    dur: TURN_DUR,
    settle: SETTLE_DUR,
  })) as TurnWindow[],
  end: FIRST_TURN + NUM_TURNS * TURN_GAP + 0.5,
};


  loadingStage("Initializing WebGL renderer…");
  // --- Renderer / scene / camera ------------------------------------------
  const query=new URLSearchParams(location.search),style=visualStyle(query),luxury=style==="luxury";
  const qualityName=browserQuality(query),quality=QUALITY_PROFILES[qualityName];
  const geometryOnly=query.has("geometry-export");
  const renderer = createSceneRenderer(geometryOnly,{
    antialias: true,
    preserveDrawingBuffer: new URLSearchParams(location.search).has('export'),
    // Prefer the discrete/high-performance GPU when the client has one. This
    // is only a hint: browsers without a usable GPU fall back automatically.
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(query.has('export')||query.has('geometry-export')?1:Math.min(devicePixelRatio||1,quality.dpr));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = luxury?0.80:0.72;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(luxury?0x0c1713:0x0c0d10);
  scene.fog = new THREE.Fog(luxury?0x0c1713:0x0c0d10, 4.0, 9.0);
  let environment:THREE.WebGLRenderTarget|null=null;
  if(!geometryOnly){const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();environment=pmrem.fromScene(room,0.04);room.dispose();pmrem.dispose();scene.environment=environment.texture;}
  scene.environmentIntensity = luxury?.10:.085;

  // Full-frame 85mm prime; fit the full sensor gate to the viewport.
  const aspect = BOOK_ASPECT;
  const camera = new PhysicalCamera(cameraVerticalFov(aspect), aspect, 0.01, 100);
  camera.filmGauge = CAMERA_SENSOR_W_MM;
  camera.fStop = 4.5;
  camera.apertureBlades = 6;
  camera.apertureRotation = 0.15;
  const trace = new StudioTracer(renderer, scene, camera,quality);
  const blenderExport = new BlenderExport(scene,camera);
  let manualCamera = false;
  function updateCamera(t: number): void {
    if (manualCamera) return;
    const pose = cinematicCameraPose(t, TIMELINE.end);
    camera.position.set(...pose.position);
    camera.lookAt(...pose.target);
    camera.focusDistance = camera.position.distanceTo(new THREE.Vector3(...pose.target));
  }
  updateCamera(0);

  addStudioLighting(scene,luxury);
  const disposeTable = createStudioTable(scene,quality.woodSize);
  const disposeWall = createStudioWall(scene);
  const disposeProps = createDeskProps(scene);
  const disposeFlowers = createFlowerVase(scene);
  const disposePlant = createOrnamentalPlant(scene);

  // --- Static book parts (closed on the right; gutter at x=0) --------------
  const materials = createBookMaterials();
  const clothTexture = createClothTexture();
  materials.cover.bumpMap = clothTexture;
  materials.cover.bumpScale = 0.00016;
  materials.spine.bumpMap=clothTexture;
  materials.spine.bumpScale=.00012;
  materials.endpaper.bumpMap = clothTexture;
  materials.endpaper.bumpScale = 0.00004;
  loadingStage("Preparing book and paper textures…");
  const prints = createPagePrints(materials.paperEdge, renderer.capabilities.getMaxAnisotropy(),photoPages,quality.pageScale);

  const backCover = createCover(BOOK_DIMENSIONS, materials, "back");
  backCover.position.set(W / 2, CT / 2, 0);
  scene.add(backCover);

  // Every leaf, including the bottom/back leaf, has its own geometry.
  const topSheetY = textStackY(BOOK_DIMENSIONS, 0);
  const coverBottom = topSheetY + 0.0005;
  const closedCenterY = coverBottom + CT / 2;
  const boundBlock = new THREE.Group();
  boundBlock.name = "bound-text-block";
  scene.add(boundBlock);

  const staticSheetGeo = (index: number, u: number, existing?: ThickSheetGeometry): ThickSheetGeometry => {
    // Same material groups and material-coordinate UVs as the turning shells.
    const segments = 32;
    const rows = 9;
    const shell = existing ?? new ThickSheetGeometry(segments + 1, rows, TEXT_SHEET_THICKNESS);
    const particles = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c <= segments; c++) {
        const x = W * c / segments;
        particles.push(createParticle(x, textPageY(BOOK_DIMENSIONS, index, x, u)+restingPageWear(index,c/segments,r/(rows-1),u), (r/(rows-1) - 0.5) * H));
      }
    }
    shell.update(particles);
    return shell;
  };
  const staticSheets: { mesh: THREE.Mesh; index: number; shell: ThickSheetGeometry }[] = [];
  for (let i = 0; i < NUM_STATIC; i++) {
    const sheetIndex = NUM_TURNS + i;
    const isBackFlyleaf = sheetIndex === NUM_SHEETS - 1;
    const shell = staticSheetGeo(sheetIndex, 0);
    const m = new THREE.Mesh(
      shell.geometry,
      prints.sheet(sheetIndex),
    );
    m.name = isBackFlyleaf ? "back-flyleaf" : "static-sheet";
    m.receiveShadow = true;
    boundBlock.add(m);
    staticSheets.push({ mesh: m, index: sheetIndex, shell });
  }

  // Separate deforming text-block binding ribbon; not the outer case spine.
  const bindingGeo = new THREE.BufferGeometry();
  const bindingPositions = new Float32Array(NUM_SHEETS * 2 * 3);
  bindingGeo.setAttribute("position", new THREE.BufferAttribute(bindingPositions, 3));
  const bindingIndices: number[] = [];
  for (let i = 0; i < NUM_SHEETS - 1; i++) {
    const a = i * 2;
    bindingIndices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  bindingGeo.setIndex(bindingIndices);
  const bindingMaterial = materials.spineCloth.clone();
  const bindingUVs = new Float32Array(NUM_SHEETS * 2 * 2);
  for (let i=0;i<NUM_SHEETS;i++) for (let j=0;j<2;j++) {
    bindingUVs[(i*2+j)*2] = i / (NUM_SHEETS-1);
    bindingUVs[(i*2+j)*2+1] = j * 12;
  }
  bindingGeo.setAttribute('uv', new THREE.BufferAttribute(bindingUVs, 2));
  bindingMaterial.bumpMap = clothTexture;
  bindingMaterial.bumpScale = 0.00008;
  bindingMaterial.side = THREE.DoubleSide;
  const bindingMesh = new THREE.Mesh(bindingGeo, bindingMaterial);
  bindingMesh.name = "distributed-text-block-binding";
  bindingMesh.receiveShadow = true;
  boundBlock.add(bindingMesh);

  // The distributed cloth ribbon is the lining. Do not add a rigid slab
  // overlapping the cover hinges.
  // Hollow spine cover: a curved ribbon from the back cover's lower edge to the
  // front cover's hinge edge. It stays convex while the text block's spine
  // throws up inside it, leaving the hollow.
  const spineCoverGeo = spineCoverGeometry(
    0,
    BOOK_DIMENSIONS,
    closedCenterY,
    OPEN_COVER_CENTER_Y,
    SPINE_PANEL_W,
    SPINE_TURN_IN,
  );
  const spineCover = new THREE.Mesh(spineCoverGeo, materials.spine);
  spineCover.name = "spine-cover";
  spineCover.castShadow = true;
  spineCover.receiveShadow = true;
  scene.add(spineCover);
  function updateSpineCover(u: number): void {
    updateSpineCoverGeometry(
      spineCoverGeo,
      u,
      BOOK_DIMENSIONS,
      closedCenterY,
      OPEN_COVER_CENTER_Y,
      SPINE_PANEL_W,
      SPINE_TURN_IN,
    );
  }
  updateSpineCover(0);

  // Headbands: short cords lying ACROSS the spine at the head and tail ends of
  // the binding line. The text block now covers the whole spine panel, so they
  // sit just beyond the head/tail of the sheets (z) instead of inside them,
  // where they would cut through the pages.
  const headbandGeo = headbandGeometry(0.0009, 0.008);
  const headbands: THREE.Mesh[] = [];
  for (const z of [-H / 2 - 0.0012, H / 2 + 0.0012]) {
    const hb = new THREE.Mesh(headbandGeo, materials.headband);
    hb.rotation.z = Math.PI / 2; // cylinder axis along X
    hb.position.set(0, SPINE_CLOTH_Y + 0.0006, z);
    headbands.push(hb);
    hb.castShadow = true;
    scene.add(hb);
  }

  // Front cover: a rigid board hinged on the spine (x=0). The board is offset
  // +W/2 inside the pivot, so the pivot line is the book's hinge and rotation
  // alone opens the cover. Its hinge height is animated separately (see
  // coverPose) to model the hinge rolling down the spine as it goes flat.
  const frontCover = createCover(BOOK_DIMENSIONS, materials, "front");
  frontCover.position.x = W / 2;
  const coverPivot = new THREE.Group();
  coverPivot.name = "front-cover-hinge";
  coverPivot.position.set(0, closedCenterY, 0);
  coverPivot.add(frontCover);
  scene.add(coverPivot);

  // --- Heightfield (shared collision surface) ------------------------------
  const heightfield = new Heightfield({ width: W, height: H, nx: 120, nz: 110, paddingX: SPINE_PANEL_W });
  const gutterX = -W / 2; // local x of the spine
  // The right-hand stack starts at the spine (x = 0). Pages there must stay
  // above the sheet below them.
  const bakeMinX = gutterX - 0.04; // leave a 4cm gutter strip free (natural fan)
  function resetHeightfield(): void {
    heightfield.reset(COVER_FLOOR_Y);
  }
  resetHeightfield();

  // --- Turning sheets ------------------------------------------------------
  const cols = 25;
  const rows = 33;
  const pages: PageInstance[] = [];
  const turnSpec:TurnSpec={dims:BOOK_DIMENSIONS,cols,rows,dt:FIXED_DT,floor:COVER_FLOOR_Y,landBase,landStep,spineWidth:SPINE_PANEL_W,windows:TIMELINE.turns};

  for (let k = 0; k < NUM_TURNS; k++) {
    const win = TIMELINE.turns[k];
    const restY = textStackY(BOOK_DIMENSIONS, k);
    const landY = landBase + k * landStep; // first turned lands lowest

    // Surface of whatever is directly beneath this sheet on the right (the next
    // sheet down, or the top static sheet). The sheet below is itself bound on
    // the spine plane, so its surface is a ramp, not a flat height. Clamp a
    // shell thickness above it so the turning page cannot lie flush with it.
    const {sim,controller}=makeTurn(turnSpec,k,heightfield);
    const geo = new ThickSheetGeometry(cols, rows, 0.00025);
    const mesh = new THREE.Mesh(geo.geometry, prints.sheet(k));
    mesh.name =
      k === 0 ? "front-flyleaf" : `turning-page-${k}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.x = W / 2; // binding line at the group's x
    boundBlock.add(mesh);
    geo.update(sim.particles);

    const maxSteps = Math.ceil((win.dur + win.settle) / FIXED_DT);
    const handoff = new TurnHandoff();
    handoff.capture(sim.particles);
    const renderPose = new RenderPose();
    renderPose.reset(sim.particles);
    pages.push({ sim, geo, mesh, controller, handoff, renderPose, window: win, stepped: 0, maxSteps, restY, index: k, landY, baked: false, geoStep: -1 });
  }

  // Bake a settled sheet's top surface into the heightfield (outer region only).
  function bakePage(pg: PageInstance): void {
    const P = pg.sim.particles;
    const top = 0.0006; // half thickness + clearance so the next page clears bumps
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      if (p.x < bakeMinX) heightfield.splat(p.x, p.z, p.y + top, 2);
    }
  }

  // Shared transport; book physics and tracing stay scene-specific.
  const cacheEnabled=!geometryOnly&&!query.has("export")&&!query.has("live-physics");
  const turnCache=new Map<number,Float64Array>();
  let cacheError="",cacheDone=!cacheEnabled;
  const cacheWorker=cacheEnabled?new Worker(new URL("./bookTurnCache.worker.ts",import.meta.url),{type:"module"}):null;
  if(cacheWorker){
    cacheWorker.onmessage=({data})=>{
      if(data.kind==="page")turnCache.set(data.index,data.frames);
      else if(data.kind==="done"){cacheDone=true;cacheWorker.terminate();}
      else if(data.kind==="error"){cacheError=data.message;turnCache.clear();cacheDone=true;cacheWorker.terminate();}
    };
    cacheWorker.onerror=e=>{cacheError=e.message||"Simulation worker failed";turnCache.clear();cacheDone=true;cacheWorker.terminate();};
    cacheWorker.postMessage(turnSpec);
  }
  let time=0;
  let raf=0;
  const playback=new PlaybackClock(TIMELINE.end,PLAYBACK_RATE);
  const controls=createPlaybackControls({
    quality:{value:qualityName,options:qualityOptions(),onChange:changeQuality},
    modes:[{value:"real-time",label:"Real-time"},{value:"ray-traced",label:"Ray-traced preview"},{value:"cinematic",label:"Cinematic"}],
    onToggle:()=>setPlaying(!playback.playing),
    onRestart:()=>{seek(0);setPlaying(true);},
    onSeek:t=>{setPlaying(false);seek(t);},
    onMode:m=>setRenderMode(m as RenderMode),
    hidden:geometryOnly||new URLSearchParams(location.search).has("export"),
  });
  let photoRevision=-1;
  const domeAllowed=!geometryOnly&&!query.has("export");
  let domeEnabled=domeAllowed&&query.get("shadows")!=="studio";
  let dome:DomeShadows|null=null;
  let domeRevision=0;
  let previewPCSS=query.get("pcss")!=="0",previewGTAO=query.get("gtao")!=="0";
  if(domeAllowed){
    for(const [name,initial,change] of [
      ["PCSS",previewPCSS,(v:boolean)=>{previewPCSS=v;}],
      ["GTAO",previewGTAO,(v:boolean)=>{previewGTAO=v;}]
    ] as const){
      const label=document.createElement("label"),check=document.createElement("input");
      check.type="checkbox";check.checked=initial;check.onchange=()=>{change(check.checked);dome?.configure(previewPCSS,previewGTAO);domeRevision++;};
      label.append(check," "+name);controls.ui.append(label);
    }
  }
  function setDome(enabled:boolean){domeEnabled=domeAllowed&&enabled;if(!domeEnabled){dome?.dispose();dome=null;}domeRevision++;}
  if(domeAllowed){
    const label=document.createElement("label");label.textContent="Lighting ";
    const select=document.createElement("select");select.setAttribute("aria-label","Soft shadows");
    for(const [value,text] of [["studio","Studio (fast)"],["dome","Cinematic · low-key"]]){const opt=document.createElement("option");opt.value=value;opt.textContent=text;select.append(opt);}
    select.value=domeEnabled?"dome":"studio";select.onchange=()=>setDome(select.value==="dome");label.append(select);controls.ui.append(label);
  }
  let startupComplete=false;
  let gpuLost=false;
  const passes=createRenderPasses(renderer,scene,camera,mesh=>{
    for(let o:THREE.Object3D|null=mesh;o;o=o.parent)if(o===backCover||o===boundBlock||o===spineCover||o===coverPivot||pages.some(p=>p.mesh===o)||staticSheets.some(p=>p.mesh===o)||headbands.some(h=>h===o))return true;
    return false;
  },()=>{
    if(domeEnabled&&trace.mode==="real-time"){
      if(!dome){dome=new DomeShadows(renderer,scene,camera,qualityName==="mobile"?2:4);dome.configure(previewPCSS,previewGTAO);}
      camera.updateMatrixWorld();
      dome.draw(playback.playing,[time,photoRevision,domeRevision,...camera.matrixWorld.elements,...camera.projectionMatrix.elements].join(","));
    }else{dome?.invalidate();trace.draw(playback.playing&&trace.mode==="ray-traced");}
  });
  addStyleControl(controls.ui,style);
  passes.addUI(controls.ui,()=>{setPlaying(false);trace.invalidate();});
  function onContextLost(event:Event){event.preventDefault();gpuLost=true;setPlaying(false);controls.setFrameProgress({phase:"GPU context lost · recovering",ready:false});controls.samples.textContent="Graphics memory limit reached. If recovery stalls, reload in real-time mode.";}
  function onContextRestored(){dome?.dispose();dome=null;gpuLost=false;trace.recover();controls.mode.value="real-time";}
  renderer.domElement.addEventListener("webglcontextlost",onContextLost);
  renderer.domElement.addEventListener("webglcontextrestored",onContextRestored);
  loadingStage("Loading printed pages…",0,prints.status().totalFaces);
  function setRenderMode(mode:RenderMode){
    if(gpuLost||!["real-time","ray-traced","cinematic"].includes(mode))return;
    setPlaying(false);trace.setMode(mode);controls.mode.value=mode;
  }
  function setPlaying(next:boolean):void{
    if(next&&time>=TIMELINE.end)seek(0);
    if(next&&!cacheDone)return;
    playback.setPlaying(next);controls.sync(playback);
  }
  controls.sync(playback);

  function poseUnturned(pg: PageInstance, u: number): void {
    const root = textRoot(BOOK_DIMENSIONS, pg.index, u);
    pg.sim.reset();
    for (const p of pg.sim.particles) {
      const localX = p.x + W / 2;
      p.x = p.px = p.x + root.x;
      p.y = p.py = textPageY(BOOK_DIMENSIONS, pg.index, localX, u)+restingPageWear(pg.index,localX/W,p.z/H+.5,u);
    }
    // Pin the simulation's actual open attachment before it starts stepping.
    if (u === 1) {
      pg.controller.setProgress(0);
      pg.controller.apply(pg.sim.particles);
    }
    pg.handoff.capture(pg.sim.particles);
    pg.renderPose.reset(pg.sim.particles);
    pg.geo.update(pg.sim.particles);
    flexBases.delete(pg.geo.geometry);
    pg.geoStep = pg.stepped;
  }

  function resetPage(pg: PageInstance): void {
    pg.stepped = 0;
    pg.baked = false;
    poseUnturned(pg, 1);
  }

  function seek(t: number): void {
    if(!cacheDone)return;
    time = playback.seek(t);
    resetHeightfield();
    for (const pg of pages) resetPage(pg);
    stepPagesTo(time);
    lastBindingU = -1;
    updateCover(time);
    updateCamera(time);
    trace.invalidate();
  }

  function stepPagesTo(t: number): void {
    for (const pg of pages) {
      const target = Math.max(
        0,
        Math.min(pg.maxSteps, Math.floor((t - pg.window.start) / FIXED_DT)),
      );
      const cached=turnCache.get(pg.index);
      if(cached&&target>0&&target!==pg.stepped){
        const particles=pg.sim.particles,stride=particles.length*3;
        for(let i=0;i<particles.length;i++){
          const p=particles[i],j=(target-1)*stride+3*i;
          p.x=cached[j];p.y=cached[j+1];p.z=cached[j+2];
        }
        pg.renderPose.capture(particles);
        for(let i=0;i<particles.length;i++){
          const p=particles[i],j=target*stride+3*i;
          p.x=cached[j];p.y=cached[j+1];p.z=cached[j+2];
        }
        pg.stepped=target;
      }else if(!cached){
      while (pg.stepped < target) {
        const local = pg.stepped * FIXED_DT;
        const progress = clamp01(local / pg.window.dur);
        pg.renderPose.capture(pg.sim.particles);
        pg.controller.setProgress(progress);
        pg.controller.apply(pg.sim.particles);
        pg.sim.step();
        pg.stepped++;
      }
      }
      // Bake once the sheet has settled, so later sheets collide with it.
      if (!pg.baked && pg.stepped >= pg.maxSteps) {
        bakePage(pg);
        pg.baked = true;
      }
      // Draw between the two most recent solver states, one fixed tick behind.
      const moving = pg.stepped > 0 && pg.stepped < pg.maxSteps;
      if (moving || pg.stepped !== pg.geoStep) {
        const elapsed = Math.max(0, t - pg.window.start);
        const alpha = moving ? clamp01(elapsed / FIXED_DT - pg.stepped) : 1;
        const display = pg.renderPose.sample(pg.sim.particles, alpha);
        const blended=pg.handoff.pose(display, Math.max(0, (pg.stepped - 1 + alpha) * FIXED_DT));
        const progress=clamp01(elapsed/pg.window.dur);
        // Material coordinates survive the turn; do not mutate the solver particles.
        const shaped=progress>0&&progress<1?blended.map((p,i)=>({...p,y:p.y+freePageWear(pg.index,(i%cols)/(cols-1),Math.floor(i/cols)/(rows-1),progress)})):blended;
        pg.geo.update(shaped);
        flexBases.delete(pg.geo.geometry);
        pg.geoStep = pg.stepped;
      }
    }
  }

  const flexBases = new WeakMap<THREE.BufferGeometry, Float32Array>();
  const flexLoads = new WeakMap<THREE.BufferGeometry, number>();
  function flexGeometry(mesh: THREE.Mesh, load: number): void {
    const geo = mesh.geometry;
    const attr = geo.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    let base = flexBases.get(geo);
    if (base && flexLoads.get(geo) === load) return;
    if (!base) { base = arr.slice(); flexBases.set(geo, base); }
    flexLoads.set(geo, load);
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] = base[i + 1] + bindingLift(base[i] + mesh.position.x, SPINE_PANEL_W, load);
    }
    attr.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }
  let lastBindingU = -1;
  function updateCover(t: number): void {
    const u = clamp01(
      (t - TIMELINE.coverStart) / (TIMELINE.coverEnd - TIMELINE.coverStart),
    );
    const pose = coverPose(
      u,
      closedCenterY,
      OPEN_COVER_CENTER_Y,
      HINGE_DROP_START,
      SPINE_PANEL_W,
    );
    coverPivot.position.x = pose.hingeX;
    coverPivot.position.y = pose.hingeY;
    coverPivot.rotation.z = pose.angle;
    // The text block slides to the open binding line at the end of the cover
    // swing (u > 0.8, after the spine strip has flattened) and stays there.
    // The back attachment stays fixed in world space throughout opening.
    boundBlock.position.x = 0;
    if (u !== lastBindingU) {
      for (const pg of pages) if (pg.stepped === 0) poseUnturned(pg, u);
      for (const entry of staticSheets) {
        const root = textRoot(BOOK_DIMENSIONS, entry.index, u);
        staticSheetGeo(entry.index, u, entry.shell);
        flexBases.delete(entry.mesh.geometry);
        entry.mesh.position.x = root.x;
      }
      for (let i = 0; i < NUM_SHEETS; i++) {
        const root = textRoot(BOOK_DIMENSIONS, i, u);
        for (let j = 0; j < 2; j++) {
          const offset = (i * 2 + j) * 3;
          bindingPositions[offset] = root.x;
          bindingPositions[offset + 1] = root.y - PAGE_SHELL_HALF;
          bindingPositions[offset + 2] = (j - 0.5) * H;
        }
      }
      flexBases.delete(bindingGeo);
      bindingGeo.getAttribute("position").needsUpdate = true;
      bindingGeo.computeVertexNormals();
      bindingGeo.computeBoundingSphere();
      const frontRoot = textRoot(BOOK_DIMENSIONS, 0, u);
      for (const hb of headbands) {
        hb.position.x = frontRoot.x;
        hb.position.y = frontRoot.y;
      }
      lastBindingU = u;
    }
    // Existing opening arc remains active through the cover swing. The extra
    // elastic crown ramps in only near fully open, avoiding the moving board.
    const load = bindingLoad(t, u, TIMELINE.turns) * smootherstep(clamp01((u - 0.95) / 0.05));
    for (const pg of pages) flexGeometry(pg.mesh, load);
    for (const entry of staticSheets) flexGeometry(entry.mesh, load);
    flexGeometry(bindingMesh, load);
    const frontRoot = textRoot(BOOK_DIMENSIONS, 0, u);
    for (const hb of headbands) {
      hb.position.y = frontRoot.y + bindingLift(frontRoot.x, SPINE_PANEL_W, load);
    }
    updateSpineCover(u);
  }
  updateCover(0);


  // --- Main loop -----------------------------------------------------------
  function frame(now: number): void {
    if(gpuLost||trace.contextLost){controls.setFrameProgress({phase:"GPU context lost · recovering",ready:false});raf=requestAnimationFrame(frame);return;}
    if(playback.tick(now,passes.pass!=="beauty"||trace.mode!=="cinematic"||trace.complete,passes.pass==="beauty"&&trace.mode==="cinematic"?1/60:undefined)){
      time=playback.time;
      stepPagesTo(time);
      updateCover(time);
      updateCamera(time);
      trace.invalidate();
    }

    controls.sync(playback);
    const photoState=prints.status();
    const revision=photoState.loadedFaces+photoState.failedFaces;
    if(revision!==photoRevision){if(!startupComplete)loadingStage("Loading printed pages…",revision,photoState.totalFaces);photoRevision=revision;trace.invalidate();}
    if(!startupComplete&&revision>=photoState.totalFaces&&!cacheDone)loadingStage("Preparing page-turn simulation…",turnCache.size,NUM_TURNS);
    if(!geometryOnly)passes.render();
    if(!startupComplete&&revision>=photoState.totalFaces&&cacheDone){startupComplete=true;loadingReady();if(photoState.failedFaces)console.warn("[book] Some printed pages use placeholders:",photoState.failedFaces);}
    if(trace.contextLost){controls.setFrameProgress({phase:"GPU context lost · recovering",ready:false});raf=requestAnimationFrame(frame);return;}
    controls.mode.value=trace.mode;
    const raster=trace.mode==="real-time"||(playback.playing&&trace.mode==="ray-traced");
    controls.setFrameProgress(passes.pass!=="beauty"?{phase:"Render pass · "+passes.pass,ready:true}:raster?{phase:trace.mode==="ray-traced"?"Real-time playback · pause to trace":"Frame render · Real-time",ready:true}:{phase:trace.complete?"Frame complete":trace.phase,samples:trace.samples,target:trace.goal});
    const ds=domeEnabled&&trace.mode==="real-time"&&passes.pass==="beauty"?dome?.status():undefined;
    controls.samples.textContent=trace.error?"Ray tracing unavailable: "+trace.error:ds?(ds.error?"Dome unavailable: "+ds.error:"Cinematic · 3-point + ambient dome"):"";
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function resizeScene(width:number,height:number):void {
    camera.aspect=width/height;
    camera.fov=cameraVerticalFov(camera.aspect);
    camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
    trace.invalidate();
  }
  const fixedViewport=geometryOnly||new URLSearchParams(location.search).has("export");
  const unbindViewport=bindPreviewViewport(renderer.domElement,controls.ui,resizeScene,fixedViewport,BOOK_ASPECT);
  function onResize():void { if(fixedViewport)resizeScene(window.innerWidth,window.innerHeight); }
  window.addEventListener("resize", onResize);

  (window as unknown as { __demo: unknown }).__demo = {
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    seek,
    get time() {
      return time;
    },
    duration: TIMELINE.end,
    playbackRate: PLAYBACK_RATE,
    photoStatus: prints.status,
    shadowStatus:()=>({enabled:domeEnabled,...dome?.status()}),
    setDomeShadows:setDome,
    simulationCache:()=>({enabled:cacheEnabled,ready:cacheDone,pages:turnCache.size,total:NUM_TURNS,error:cacheError,bytes:[...turnCache.values()].reduce((n,a)=>n+a.byteLength,0)}),
    captureProduction:(t:number)=>{setRenderMode("real-time");passes.setPass("beauty");setPlaying(false);if(t<time||t===0)seek(t);else{time=playback.seek(t);stepPagesTo(time);updateCover(time);updateCamera(time);trace.invalidate();}return {beauty:passes.capture("beauty"),depth:passes.captureDepth32()};},
    capturePass:(t:number,pass:PassName)=>{setPlaying(false);if(t<time)seek(t);else{time=playback.seek(t);stepPagesTo(time);updateCover(time);updateCamera(time);}return passes.capture(pass);},
    passIds:()=>passes.idMap(),
    setPass:(value:string)=>{passes.setPass(value);trace.invalidate();},
    setRenderMode,
    ...geometrySession((t:number)=>{
      if(!geometryOnly)throw Error("Geometry export mode required");
      setPlaying(false);if(t<time||t===0)seek(t);else{time=playback.seek(t);stepPagesTo(time);updateCover(time);updateCamera(time);}
    },blenderExport),
    exportFrame: (t: number, samples: number, bounces: number) => {
      if (!new URLSearchParams(location.search).has('export')) throw Error('Export mode required');
      setPlaying(false);
      trace.setExportQuality(samples,bounces);
      if (trace.mode !== 'cinematic') setRenderMode('cinematic');
      if (t < time) seek(t);
      else {
        time = playback.seek(t);
        stepPagesTo(time); updateCover(time); updateCamera(time); trace.invalidate();
      }
    },
    captureFrame: () => {
      if (trace.mode !== 'cinematic' || !trace.complete || trace.error) throw Error('Frame not ready');
      return renderer.domElement.toDataURL('image/png');
    },
    renderStatus: () => ({quality:qualityName,mode:trace.mode,samples:trace.samples,target:trace.goal,error:trace.error,complete:trace.complete,phase:trace.phase}),
    /** WebGL backend actually in use (hardware GPU or software renderer). */
    gpu: () => {
      const gl = renderer.getContext();
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        renderer: ext
          ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
          : String(gl.getParameter(gl.RENDERER)),
        vendor: ext
          ? String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL))
          : String(gl.getParameter(gl.VENDOR)),
      };
    },
    /** Debug aid: show/hide every object with the given name. */
    debug: (name: string, visible: boolean) => {
      domeRevision++;
      scene.traverse((o) => {
        if (o.name === name) o.visible = visible;
      });
      trace.invalidate();
    },
    /** Debug aid: place the camera for close-up validation shots. */
    camera: (
      position: [number, number, number],
      lookAt: [number, number, number],
    ) => {
      manualCamera = true;
      camera.position.set(...position);
      camera.lookAt(lookAt[0], lookAt[1], lookAt[2]);
      camera.focusDistance=camera.position.distanceTo(new THREE.Vector3(...lookAt));
      trace.invalidate();
    },
    cinematicCamera: () => { manualCamera = false; updateCamera(time); trace.invalidate(); },
    cameraStatus: () => ({ focalLength: CAMERA_FOCAL_MM, sensor: [36,24], fov: camera.fov, position: camera.position.toArray(), manual: manualCamera }),
    /** Current cover pose + the open-cover collision surface (debug aid). */
    cover: () => {
      const u = clamp01(
        (time - TIMELINE.coverStart) / (TIMELINE.coverEnd - TIMELINE.coverStart),
      );
      const pose = coverPose(
        u,
        closedCenterY,
        OPEN_COVER_CENTER_Y,
        HINGE_DROP_START,
        SPINE_PANEL_W,
      );
      return {
        u,
        angle: pose.angle,
        hingeY: pose.hingeY,
        closedCenterY,
        openCenterY: OPEN_COVER_CENTER_Y,
        topY: OPEN_COVER.topY,
        floorY: COVER_FLOOR_Y,
        spinePlaneY: SPINE_Y,
        spineClothY: SPINE_CLOTH_Y,
        bindRamp: BIND_RAMP,
        spinePlane: spinePlaneEdges(
          u,
          BOOK_DIMENSIONS,
          closedCenterY,
          OPEN_COVER_CENTER_Y,
          SPINE_PANEL_W,
        ),
        bindingLineX: boundBlock.position.x,
        sheetCount: NUM_SHEETS,
        bindings: Array.from({ length: NUM_SHEETS }, (_, k) => ({
          index: k,
          current: (() => {
            const root = textRoot(BOOK_DIMENSIONS, k, u);
            const load = bindingLoad(time, u, TIMELINE.turns) * smootherstep(clamp01((u - 0.95) / 0.05));
            return { x: root.x, y: root.y + bindingLift(root.x, SPINE_PANEL_W, load) };
          })(),
          right: textRoot(BOOK_DIMENSIONS, k),
          left: textRoot(BOOK_DIMENSIONS, k),
        })),
      };
    },
    /** Current spine cover bounds + text-block morph (debug/validation aid). */
    spine: () => {
      const u = clamp01(
        (time - TIMELINE.coverStart) / (TIMELINE.coverEnd - TIMELINE.coverStart),
      );
      spineCoverGeo.computeBoundingBox();
      const box = spineCoverGeo.boundingBox;
      return {
        u,
        minX: box ? box.min.x : 0,
        maxX: box ? box.max.x : 0,
        minY: box ? box.min.y : 0,
        maxY: box ? box.max.y : 0,
        protrusion: box ? Math.max(0, -box.min.x) : 0,
      };
    },
    /** Per-page particle bounds in world space (debug/validation aid). */
    pageBounds: () =>
      pages.map((pg) => {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        for (const p of pg.sim.particles) {
          const wx = p.x + W / 2 + boundBlock.position.x; // world x
          if (wx < minX) minX = wx;
          if (wx > maxX) maxX = wx;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
          if (p.z < minZ) minZ = p.z;
          if (p.z > maxZ) maxZ = p.z;
        }
        const spine = pg.sim.particles[0];
        return {
          stepped: pg.stepped,
          restY: pg.restY,
          landY: pg.landY,
          spineX: spine.x + W / 2 + boundBlock.position.x,
          spineY: spine.y,
          minX,
          maxX,
          minY,
          maxY,
          minZ,
          maxZ,
        };
      }),
  };
  (window as unknown as { __sceneReady: boolean }).__sceneReady = true;

  return () => {
    dome?.dispose();
    cacheWorker?.terminate();turnCache.clear();
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    unbindViewport();
    controls.dispose();passes.dispose();
    for (const pg of pages) pg.geo.dispose();
    bindingGeo.dispose();
    bindingMaterial.dispose();
    for (const entry of staticSheets) entry.mesh.geometry.dispose();
    spineCoverGeo.dispose();
    headbandGeo.dispose();
    prints.dispose();
    disposePlant();
    disposeFlowers();
    disposeProps();
    disposeWall();
    disposeTable();
    clothTexture.dispose();
    scene.environment = null;
    trace.dispose();
    environment?.dispose();
    renderer.domElement.removeEventListener("webglcontextlost",onContextLost);
    renderer.domElement.removeEventListener("webglcontextrestored",onContextRestored);
    renderer.dispose();
  };
}