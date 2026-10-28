import { mkdir, writeFile } from 'node:fs/promises';
await mkdir(new URL('../tests/fixtures/', import.meta.url), { recursive: true });
const assets = [
  ['fist.jpg', 'https://storage.googleapis.com/mediapipe-assets/tasks/testdata/vision/fist.jpg'],
  ['right_hands.jpg', 'https://storage.googleapis.com/mediapipe-assets/tasks/testdata/vision/right_hands.jpg'],
  ['woman_hands.jpg', 'https://storage.googleapis.com/mediapipe-tasks/hand_landmarker/woman_hands.jpg'],
];
for (const [name, url] of assets) {
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`${name}: ${response.status}`);
  await writeFile(new URL(`../tests/fixtures/${name}`,import.meta.url),Buffer.from(await response.arrayBuffer()));
  console.log(`Saved Google MediaPipe test fixture: ${name}`);
}
