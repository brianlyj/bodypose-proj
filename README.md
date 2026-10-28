# Afterimage — live comic camera

A local browser recreation of the visual techniques in [Epoh's TouchDesigner reel](https://www.instagram.com/reel/De4DsHxjtjd/). This is an original implementation based on the public breakdown, not a port of his unpublished project or an exact visual match.

## Run

Requires Node.js 22.12+ and a recent Chrome or Edge browser with WebGL 2.

```sh
npm install
npm run setup
npm run dev
```

Open the printed localhost URL. `setup` copies MediaPipe's WASM runtime and downloads Google's gesture and selfie-segmentation models into `public/`. After setup, camera processing and model inference are local. No camera frames are uploaded. The UI optionally loads Google Fonts; system fonts are used offline.

1. Preview the illustrated demo, or click **Enable camera** and allow webcam access.
2. Hold a closed fist in view for 260 ms. Thirteen angular sections reveal the other world from your hand position.
3. Open your palm for at least 180 ms to rearm, then close it again to return.
4. **Space** or **Transform** is the manual fallback. **Try a demo fist** exercises the same gesture state machine with a clearly labelled simulated input.
5. **Compare** shows original and processed views. Save a PNG snapshot or record up to 60 seconds of silent WebM/MP4 video (depending on browser support).

**Use demo** releases the camera. The app asks for camera permission only after Enable camera is clicked. No microphone is requested.

## Effect pipeline

- A mirrored 640×360 webcam frame goes into a classic Web Worker.
- MediaPipe SelfieSegmenter creates a foreground-confidence mask. GestureRecognizer supplies closed-fist/open-palm classification and hand landmarks.
- The worker returns the exact source frame with its mask, avoiding segmentation lag around moving edges. Only one inference is in flight at a time; frames are dropped instead of queued.
- A WebGL 2 pass applies four-quadrant Kuwahara smoothing at half output resolution.
- The compositor combines quantized blue shading, a top-to-bottom gradient, internal ink lines, an expanded pink outline and directional orange rim.
- Background layers include camera halftone, 22 rays changing four times per second, three flame contours, rotating shaded geometric forms and editable angled text.
- A separate gesture latch requires a stable fist, fires once, and requires an explicit open palm to rearm. The screen transition has 13 hand-centred wedges and takes 900 ms.

The reference uses NVIDIA Background TOP; this browser version uses MediaPipe segmentation and does not require an NVIDIA GPU. Hair, fine fingers and fast motion can still produce mask artifacts. Good front lighting and a clear hand silhouette improve results. Inference speed varies by CPU; the animated graphics render independently. Full-body pose tracking is not needed for this effect.

## Project layout

| File | Purpose |
| --- | --- |
| `src/main.js` | Camera lifecycle, UI, capture and frame scheduling |
| `src/renderer.js` | WebGL smoothing, shading, layers and transition shaders |
| `src/scene.js` | Animated demo portrait, low-poly geometry and typography |
| `src/gesture.js` | Debounced fist latch and reversible transition state |
| `src/vision.js` | Worker lifecycle and bounded frame transfer |
| `public/vision-worker.js` | Local MediaPipe inference |
| `scripts/setup-assets.mjs` | Download pinned model revisions and copy package WASM |

## Verify / build

```sh
npm test
npm run build
npm run preview
```

Run `node scripts/test-assets.mjs` once to download the public Google test images. While the development server is running, `/tests/browser.html` runs the WebGL and local vision pipeline checks. `/tests/camera.html` tests the app with a synthetic camera stream and includes a permission-denial control. These pages do not request the real webcam. A physical camera and hand are still needed to assess tracking quality in your own lighting.

Keep `public/models`, `public/wasm`, and `public/vendor` together with the production build. `npm run build` copies them into `dist/`. Serve on localhost or HTTPS for webcam access. Models and runtime binaries are ignored by Git and restored with `npm run setup`.

## Sources

- [MediaPipe image segmentation](https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter/web_js)
- [MediaPipe gesture recognition](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer/web_js)
- MediaPipe runtime is Apache-2.0; model metadata and terms are available from the linked Google documentation. Custom app code and graphics are in this repository.
