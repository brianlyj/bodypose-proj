import { mkdir, cp, stat, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(path.join(root, 'public/models'), { recursive: true });
await cp(path.join(root, 'node_modules/@mediapipe/tasks-vision/wasm'), path.join(root, 'public/wasm'), { recursive: true });
await mkdir(path.join(root, 'public/vendor'), { recursive: true });
await cp(path.join(root, 'node_modules/@mediapipe/tasks-vision/vision_bundle.js'), path.join(root, 'public/vendor/vision_bundle.js'));
const models = [
  ['gesture_recognizer.task', 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task'],
  ['selfie_segmenter.tflite', 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite'],
  ['pose_landmarker_lite.task', 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'],
  ['face_landmarker.task', 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'],
];
for (const [name, url] of models) {
  const target = path.join(root, 'public/models', name);
  if (await stat(target).then(s => s.size > 1000).catch(() => false)) { console.log(`${name} already available`); continue; }
  console.log(`Downloading ${name} from Google MediaPipe…`);
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length < 1000) throw new Error(`${name}: incomplete model`);
  await writeFile(`${target}.tmp`, data);
  await rename(`${target}.tmp`, target);
}
console.log('Models and WASM are local. Camera frames stay on this device.');
