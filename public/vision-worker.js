/* Classic worker: MediaPipe's WASM loader uses importScripts. All inference stays on this device. */
self.postMessage({ type: 'status', message: 'Loading local MediaPipe runtime…' });
importScripts('./vendor/vision_bundle.js');
let segmenter, recognizer, pose, face, modelBase;
const input = new OffscreenCanvas(640, 360);
const inputContext = input.getContext('2d');

async function initialize(base) {
  modelBase=base;
  self.postMessage({ type: 'status', message: 'Resolving local WASM runtime…' });
  const files = await Vision.FilesetResolver.forVisionTasks(`${base}wasm`);
  self.postMessage({ type: 'status', message: 'Initializing person segmentation…' });
  // CPU inference in a worker keeps UI animation responsive and avoids sharing GPU contexts.
  segmenter = await Vision.ImageSegmenter.createFromOptions(files, {
    canvas: new OffscreenCanvas(1, 1),
    baseOptions: { modelAssetPath: `${base}models/selfie_segmenter.tflite`, delegate: 'CPU' },
    runningMode: 'VIDEO', outputCategoryMask: false, outputConfidenceMasks: true,
  });
  self.postMessage({ type: 'status', message: 'Initializing hand gesture recognition…' });
  recognizer = await Vision.GestureRecognizer.createFromOptions(files, {
    canvas: new OffscreenCanvas(1, 1),
    baseOptions: { modelAssetPath: `${base}models/gesture_recognizer.task`, delegate: 'CPU' },
    runningMode: 'VIDEO', numHands: 2,
    minHandDetectionConfidence: 0.55, minHandPresenceConfidence: 0.55, minTrackingConfidence: 0.55,
  });
  self.postMessage({ type: 'ready', labels: segmenter.getLabels() });
}

async function initializeAvatar(){
  if(pose)return;
  self.postMessage({type:'status',message:'Loading local body tracking…'});
  const files=await Vision.FilesetResolver.forVisionTasks(`${modelBase}wasm`);
  pose=await Vision.PoseLandmarker.createFromOptions(files,{
    canvas:new OffscreenCanvas(1,1),baseOptions:{modelAssetPath:`${modelBase}models/pose_landmarker_lite.task`,delegate:'CPU'},
    runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.5,
  });
}

async function initializeFace(){
  if(face)return;
  self.postMessage({type:'status',message:'Loading local face tracking…'});
  const files=await Vision.FilesetResolver.forVisionTasks(`${modelBase}wasm`);
  face=await Vision.FaceLandmarker.createFromOptions(files,{
    canvas:new OffscreenCanvas(1,1),baseOptions:{modelAssetPath:`${modelBase}models/face_landmarker.task`,delegate:'CPU'},
    runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:true,outputFacialTransformationMatrixes:true,
    minFaceDetectionConfidence:.5,minFacePresenceConfidence:.5,minTrackingConfidence:.5,
  });
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') { await initialize(data.base); return; }
    if (data.type !== 'frame') return;
    const { bitmap, timestamp, id } = data;
    const started = performance.now();
    try {
      if (!segmenter || !recognizer) throw new Error('Vision models are not ready.');
      if (input.width !== bitmap.width || input.height !== bitmap.height) { input.width = bitmap.width; input.height = bitmap.height; }
      inputContext.drawImage(bitmap, 0, 0);
      let mask=new Uint8Array(0),width=0,height=0,body=null,expression=null;
      if(data.avatar){
        await initializeAvatar();
        const p=pose.detectForVideo(input,timestamp);
        body={landmarks:p.landmarks,worldLandmarks:p.worldLandmarks};
      }else segmenter.segmentForVideo(input, timestamp, result => {
        // The binary selfie model emits a single person-confidence map.
        // Other binary variants may emit background and person separately.
        const person = result.confidenceMasks[result.confidenceMasks.length === 1 ? 0 : 1];
        width = person.width; height = person.height;
        const values = person.getAsFloat32Array();
        mask = new Uint8Array(values.length);
        for (let i = 0; i < values.length; i++) mask[i] = Math.round(Math.max(0, Math.min(1, values[i])) * 255);
      });
      if(data.avatar || data.trigger==='expression'){
        await initializeFace();
        const f=face.detectForVideo(input,timestamp);
        expression={landmarks:f.faceLandmarks,blendshapes:f.faceBlendshapes,matrix:f.facialTransformationMatrixes};
      }
      const hands = data.trigger==='expression' ? {gestures:[],landmarks:[]} : recognizer.recognizeForVideo(input, timestamp);
      // Return the very same image with its mask: segmentation latency cannot misalign edges.
      self.postMessage({ type: 'result', id, bitmap, timestamp, mask, width, height,
        hands: { gestures: hands.gestures, landmarks: hands.landmarks },
        avatar:!!data.avatar,body,face:expression,
        inferenceMs: performance.now() - started }, [mask.buffer, bitmap]);
    } catch (error) { bitmap.close(); throw error; }
  } catch (error) { self.postMessage({ type: 'error', message: error.message || String(error), id: data.id }); }
};
