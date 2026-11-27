import { CAMERA_FOCAL_MM, cameraVerticalFov, cinematicCameraPose } from "../src/rendering/cinematicCamera";
const duration = 30;
const first = cinematicCameraPose(0, duration);
if(CAMERA_FOCAL_MM !== 100) throw Error("Expected 100mm lens");
for (const [t, y, z, targetY] of [[0,.58,.88,.065],[duration,.54,.48,.025]]) {
  const p = cinematicCameraPose(t,duration);
  const dx = .02;
  const expectedDistance = Math.hypot(dx,y-targetY,z)*85/35;
  const delta = p.position.map((v,j)=>v-p.target[j]);
  const tilt = Math.atan2(delta[1],Math.hypot(delta[0],delta[2]));
  const oldTilt = Math.atan2(y-targetY,Math.hypot(dx,z));
  if(Math.abs(Math.hypot(...delta)-expectedDistance)>1e-9 || Math.abs(tilt-oldTilt-5*Math.PI/180)>1e-9) throw Error("Camera elevation or framing distance changed unexpectedly");
  console.log("Camera endpoint",t,"pitch", (tilt*180/Math.PI).toFixed(2),"degrees","height",p.position[1].toFixed(3),"m");
}
let prevDistance = Infinity, prevTilt = -Infinity;
for (let i = 0; i <= 100; i++) {
  const p = cinematicCameraPose(duration * i / 100, duration);
  const delta = p.position.map((v,j) => v - p.target[j]);
  const distance = Math.hypot(...delta);
  const tilt = Math.atan2(delta[1], Math.hypot(delta[0],delta[2]));
  if (distance > prevDistance + 1e-9 || tilt < prevTilt - 1e-9) throw Error("Camera motion not monotonic");
  prevDistance = distance; prevTilt = tilt;
}
if (Math.abs(cameraVerticalFov(1.5) - (2 * Math.atan(24 / (2 * CAMERA_FOCAL_MM)) * 180 / Math.PI)) > 0.001) throw Error("Incorrect lens field of view");
if (JSON.stringify(first) !== JSON.stringify(cinematicCameraPose(-1,duration))) throw Error("Seek clamp failed");
console.log("PASS: fixed lens full-frame gate, monotonic dolly and downward tilt");
