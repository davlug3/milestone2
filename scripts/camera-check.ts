import { cameraVerticalFov, cinematicCameraPose } from "../src/rendering/cinematicCamera";
const duration = 30;
const first = cinematicCameraPose(0, duration);
let prevDistance = Infinity, prevTilt = -Infinity;
for (let i = 0; i <= 100; i++) {
  const p = cinematicCameraPose(duration * i / 100, duration);
  const delta = p.position.map((v,j) => v - p.target[j]);
  const distance = Math.hypot(...delta);
  const tilt = Math.atan2(delta[1], Math.hypot(delta[0],delta[2]));
  if (distance > prevDistance + 1e-9 || tilt < prevTilt - 1e-9) throw Error("Camera motion not monotonic");
  prevDistance = distance; prevTilt = tilt;
}
if (Math.abs(cameraVerticalFov(1.5) - 37.8492888) > 0.001) throw Error("Incorrect 35mm field of view");
if (JSON.stringify(first) !== JSON.stringify(cinematicCameraPose(-1,duration))) throw Error("Seek clamp failed");
console.log("PASS: 35mm full-frame gate, monotonic dolly and downward tilt");
