# Afterimage — live comic camera

A local browser recreation of the visual techniques in [Epoh's TouchDesigner reel](https://www.instagram.com/reel/De4DsHxjtjd/). This is an original implementation based on the public breakdown, not a port of his unpublished project or an exact visual match.

## Run

Requires Node.js 22.12+ and a recent Chrome or Edge browser with WebGL 2.

```sh
npm install
npm run setup
npm run dev
```

Open the printed localhost URL. `setup` copies MediaPipe's WASM runtime and downloads Google's gesture, face, pose and selfie-segmentation models into `public/`. After setup, camera processing and model inference are local. No camera frames are uploaded. The UI optionally loads Google Fonts; system fonts are used offline.

1. Preview the illustrated demo, or click **Enable camera** and allow webcam access.
2. Choose a trigger beneath the preview. **Open eyes + mouth** is the default: keep both eyes clearly open and open your mouth for 350 ms. Close your mouth for 300 ms to rearm, then repeat to return. Blinking or losing face tracking does not rearm it.
3. **Fist** remains an option: hold a closed fist in view for 260 ms, then open your palm for 180 ms to rearm. Only the selected trigger is active. Both triggers work in Mari and Comic camera modes.
4. **Space** or **Transform** is the manual fallback. **Try a demo expression / fist** exercises the selected trigger with clearly labelled simulated input.
5. **Compare** shows original and processed views. Save a PNG snapshot or record up to 60 seconds of silent WebM/MP4 video (depending on browser support).

**Use demo** releases the camera. The app asks for camera permission only after Enable camera is clicked. No microphone is requested.

## Mari body and face tracking

**Mari avatar** is the default studio subject. Click **Enable camera**, face forward, then use **Center head** to set your neutral head direction. Keep shoulders and hands visible for upper-body tracking; move back enough to include knees and ankles for leg motion. The small mirrored camera preview helps with framing. Tracking and rendering remain local.

- A 20-bone skinned rig follows shoulders, arms, wrists, spine, legs and feet. Motion stays centered on the stage.
- Head rotation follows the face model relative to your calibrated neutral pose.
- Eight expression controls support separate left/right blinks, mouth opening, left/right smile, inner brow raise and outer brow raises.
- **Test motion** previews the rig without a camera and is explicitly labelled simulated. Starting it releases an active webcam.
- The selected trigger toggles the comic world, with the transition starting at Mari's face or tracked hand. Compare, snapshots and recordings use the avatar output.
- Switch to **Comic camera** to use the original person-cutout effect.

The supplied `Reference-mari.glb` was static: it had no bones, skin weights, morph targets or animations. The original is retained at `assets/source/Reference-mari.glb`. A derivative with the stage removed, normalized scale, skeleton, weights and simplified expression targets is at `public/avatars/Mari-rigged.glb`. The editable Blender scene is `assets/Mari-webcam-rig.blend`; `assets/rig-report.json` records its bones and targets. Rebuild it with Blender 5.2:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python scripts/rig-mari.py
```

This is a practical webcam rig with approximate skin weighting, not a full facial production rig. It does not add finger articulation, eye-gaze controls, cloth physics or foot locking. Extreme bends can clip the skirt/hair. A single camera estimates depth; hidden joints return to rest, and body/face tracking fades to neutral after lost detection. Full-body framing makes the face smaller and can reduce expression accuracy.

The original asset is **[Blue Archive] -Mari (Idol)- | Chibi + Stage** by **VückyZ**, licensed **CC BY 4.0**. See `public/avatars/CREDITS.txt` for the source link, license and modifications.

## Effect pipeline

- A mirrored 640×360 webcam frame goes into a classic Web Worker.
- MediaPipe SelfieSegmenter creates a foreground-confidence mask in Comic camera mode. FaceLandmarker supplies facial expression scores for the expression trigger and Mari's face rig. GestureRecognizer supplies closed-fist/open-palm classification when Fist is selected; hand inference is skipped in expression mode. PoseLandmarker runs for Mari's body rig.
- The worker returns the exact source frame with its mask, avoiding segmentation lag around moving edges. Only one inference is in flight at a time; frames are dropped instead of queued.
- A WebGL 2 pass applies four-quadrant Kuwahara smoothing at half output resolution.
- The compositor combines quantized blue shading, a top-to-bottom gradient, internal ink lines, an expanded pink outline and directional orange rim.
- Background layers include camera halftone, 22 rays changing four times per second, three flame contours, rotating shaded geometric forms and editable angled text.
- Independent face and fist latches require a stable hold and fire once until explicitly rearmed. The face latch requires raw `jawOpen >= 0.5` and both `eyeBlink` scores `<= 0.25`; `jawOpen <= 0.2` rearms it. Missing scores or a lost face never count as open eyes. The screen transition has 13 face- or hand-centred wedges and takes 900 ms.

The reference uses NVIDIA Background TOP; this browser version uses MediaPipe segmentation and does not require an NVIDIA GPU. Hair, fine fingers and fast motion can still produce mask artifacts. Good front lighting and a clear hand silhouette improve results. Inference speed varies by CPU; the animated graphics render independently. Full-body pose tracking is not needed for this effect.

## Project layout

| File | Purpose |
| --- | --- |
| `src/main.js` | Camera lifecycle, UI, capture and frame scheduling |
| `src/renderer.js` | WebGL smoothing, shading, layers and transition shaders |
| `src/scene.js` | Animated demo portrait, low-poly geometry and typography |
| `src/gesture.js` | Face-score extraction, debounced expression/fist latches and reversible transition state |
| `src/vision.js` | Worker lifecycle and bounded frame transfer |
| `src/avatar.js` | Three.js Mari rendering and avatar silhouette for the comic effect |
| `src/retarget.js` | Pose-to-bone rotations, expression mapping, smoothing and head calibration |
| `public/vision-worker.js` | Local MediaPipe inference |
| `scripts/setup-assets.mjs` | Download pinned model revisions and copy package WASM |
| `scripts/rig-mari.py` | Reproducible Mari skeleton, skinning and expression export |

## Verify / build

```sh
npm test
npm run build
npm run preview
```

Run `node scripts/test-assets.mjs` once to download the public Google test images. While the development server is running, `/tests/browser.html` runs comic rendering, real hand recognition, real face detection in Comic camera mode, and an explicitly simulated positive expression trigger. `/tests/avatar.html` verifies the rig, body/face models, expression preview, head calibration and tracking loss. `/tests/camera.html` tests the app with a synthetic camera stream and includes a permission-denial control. These pages do not request the real webcam. A physical camera is still needed to assess tracking quality in your own lighting.

Keep `public/models`, `public/wasm`, and `public/vendor` together with the production build. `npm run build` copies them into `dist/`. Serve on localhost or HTTPS for webcam access. Models and runtime binaries are ignored by Git and restored with `npm run setup`.

## Sources

- [MediaPipe image segmentation](https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter/web_js)
- [MediaPipe gesture recognition](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer/web_js)
- MediaPipe runtime is Apache-2.0; model metadata and terms are available from the linked Google documentation. Custom app code and graphics are in this repository.
