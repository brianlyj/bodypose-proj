import './style.css';
import { ComicRenderer } from './renderer.js';
import { DemoScene, GraphicLayers, surface } from './scene.js';
import { FistTrigger, Transformation, selectHand } from './gesture.js';
import { VisionPipeline } from './vision.js';

const icons = {
  bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>',
  camera:'<path d="M14 6h-4L8 9H4v11h16V9h-4l-2-3Z"/><circle cx="12" cy="14" r="3"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  fist:'<path d="M7 12V5a2 2 0 0 1 4 0v5-6a2 2 0 0 1 4 0v6-4a2 2 0 0 1 4 0v9l-3 6H9l-5-7a2 2 0 0 1 3-2Zm0 0 4 3"/>',
  split:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  circle:'<circle cx="12" cy="12" r="7"/>',
  reset:'<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
};
const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;

document.querySelector('#app').innerHTML = `
  <header class="site-header">
    <a class="brand" href="./" aria-label="Afterimage home"><span class="brand-symbol">${icon('bolt')}</span>AFTERIMAGE<span class="brand-dot">®</span></a>
    <span class="header-description">A LITTLE LESS REALITY.</span>
    <button class="text-button" id="help">How it works <span>↗</span></button>
  </header>
  <main>
    <div class="intro"><div><div class="eyebrow"><span class="tiny-dot"></span> REAL-TIME CREATIVE PLAYGROUND</div><h1>Reality, <em>remixed.</em></h1></div><p>Your camera. A different universe.<br>Make a fist to cross over.</p></div>
    <div class="studio-layout">
      <section class="preview-column" aria-label="Live effect preview">
        <div class="stage-header"><div><span class="mono">01 /</span> THE STUDIO</div><div class="stage-stats"><span id="source-badge">DEMO SOURCE</span><span><i class="tiny-dot"></i> <b id="fps">—</b> FPS</span></div></div>
        <div class="stage" id="stage">
          <canvas id="output" width="960" height="540" aria-label="Animated comic camera output"></canvas>
          <div class="stage-corner top-left"><span class="live-dot"></span><span id="mode-label">COMIC WORLD</span></div>
          <span class="stage-corner top-right">AF / 001</span>
          <span class="stage-corner bottom-left" id="scene-caption">ILLUSTRATED DEMO · ENABLE CAMERA TO STEP IN</span>
          <button class="stage-corner fullscreen" id="fullscreen" aria-label="Expand preview">${icon('expand')}</button>
          <div id="hand-cursor" class="hand-cursor" hidden>${icon('fist')}</div>
          <div id="stage-message" class="stage-message" hidden><span class="spinner"></span><strong>Getting your camera ready</strong><span>Loading vision models on your device…</span></div>
          <div class="compare-label" id="compare-label" hidden><span>ORIGINAL</span><span>COMIC</span></div>
        </div>
        <div class="transport"><div class="view-switch" role="group" aria-label="Preview view"><button class="selected" id="view-full" aria-pressed="true">Full effect</button><button id="view-compare" aria-pressed="false">${icon('split')} Compare</button></div><div class="capture-actions"><button class="icon-button" id="snapshot" aria-label="Save snapshot" title="Save PNG snapshot">${icon('camera')}</button><button id="record" class="record-button">${icon('circle')} <span>Record</span></button></div></div>
        <div class="gesture-strip"><div class="gesture-symbol">${icon('fist')}</div><div class="gesture-copy"><strong id="gesture-label">A fist. A whole new world.</strong><span id="gesture-detail">Hold a fist to transform. Open your palm to rearm.</span></div><button class="transform-button" id="transform">Transform ${icon('bolt')}<kbd>SPACE</kbd></button></div>
        <div class="under-preview"><span><i class="privacy-dot"></i> Camera frames stay on your device</span><button id="demo-fist" class="text-button">Try a demo fist ${icon('arrow')}</button></div>
        <div class="notice" id="notice" role="status" aria-live="polite" hidden></div>
      </section>
      <aside class="control-panel" aria-label="Effect controls">
        <section class="panel-section input-section"><div class="section-title"><h2>Make it yours</h2><span class="mono">01—03</span></div><button id="camera" class="camera-button">${icon('camera')} <span>Enable camera</span> ${icon('arrow')}</button><div class="source-info"><span id="camera-state">Previewing the illustrated demo</span><button id="return-demo" hidden>Use demo</button></div><select id="camera-select" aria-label="Camera device" hidden></select></section>
        <section class="panel-section"><div class="section-title"><h2><span class="number">01</span> Color story</h2><span class="small-label" id="palette-name">ELECTRIC</span></div><div class="palette-options"><button class="palette selected" data-palette="0" aria-label="Electric blue palette" aria-pressed="true"><span style="--swatch:#153bf4"></span><span style="--swatch:#faed26"></span><span style="--swatch:#f22584"></span>${icon('check')}</button><button class="palette" data-palette="1" aria-label="Ultraviolet palette" aria-pressed="false"><span style="--swatch:#8a24dd"></span><span style="--swatch:#fc529b"></span><span style="--swatch:#45f3c5"></span></button></div>
          <label class="slider-label" for="intensity">Effect intensity <output id="intensity-value">100%</output></label><input id="intensity" type="range" min="0" max="100" value="100" />
          <label class="slider-label" for="smoothing">Ink softness <output id="smoothing-value">3</output></label><input id="smoothing" type="range" min="1" max="6" value="3" step="0.5" />
          <label class="slider-label" for="halftone">Print texture <output id="halftone-value">55%</output></label><input id="halftone" type="range" min="0" max="100" value="55" />
        </section>
        <section class="panel-section"><div class="section-title"><h2><span class="number">02</span> Build your world</h2><button id="reset" class="icon-button subtle" aria-label="Reset effect controls">${icon('reset')}</button></div><div class="layer-grid">
          ${[['rays','Burst rays'],['flames','Color flames'],['shapes','Floating shapes'],['title','Title graphic']].map(([id,label])=>`<label class="toggle-row"><span>${label}</span><input type="checkbox" id="${id}" checked /><span class="switch" aria-hidden="true"></span></label>`).join('')}
          </div><label class="sr-only" for="title-text">Title graphic text, up to three words</label><input id="title-text" class="title-input" type="text" maxlength="32" value="BREAK THE FRAME" aria-describedby="title-hint"/><span class="field-hint" id="title-hint">Up to three words. Make a statement.</span></section>
        <section class="panel-section trigger-section"><div class="section-title"><h2><span class="number">03</span> The switch</h2><span class="trigger-badge">FIST GESTURE</span></div><div class="trigger-status"><span class="tiny-dot" id="tracking-dot"></span><span id="tracking-label">Camera needed for hand tracking</span></div><div class="hold-track"><div id="hold-progress"></div></div><div class="trigger-notes"><span>HOLD 0.26s</span><span>OPEN PALM TO REARM</span></div></section>
      </aside>
    </div>
    <footer><span>MADE OF PIXELS. POWERED BY YOU.</span><span class="footer-detail">Comic camera study <span>✳</span> Inspired by Epoh’s visual experiment</span></footer>
  </main>
  <dialog id="help-dialog"><button class="icon-button dialog-close" id="close-help" aria-label="Close instructions">${icon('close')}</button><div class="eyebrow">CROSS INTO COMIC MODE</div><h2>Put your hand<br>in the picture.</h2><ol><li><strong>Enable your camera.</strong> Allow camera access and wait for the local vision models to load.</li><li><strong>Close your fist.</strong> Keep it visible for a quarter of a second. The transformation bursts from your hand.</li><li><strong>Open, then close again.</strong> Opening your palm rearms the trigger. The next fist takes you back.</li></ol><p>Space or the Transform button works too. Compare shows the original on the left and the comic treatment on the right. Snapshots are PNG; recordings are silent video.</p><p class="help-note">Good front lighting and a clear hand silhouette help tracking. The demo is an illustration; use your camera for the live effect.</p></dialog>
`;

const $ = id => document.getElementById(id);
const defaults = { intensity:1, smoothing:3, halftone:.55, outline:5, palette:0, rays:true, flames:true, shapes:true, title:true, titleText:'BREAK THE FRAME', split:false };
const settings = { ...defaults };
const demo = new DemoScene(), layers = new GraphicLayers(), trigger = new FistTrigger(), transition = new Transformation(true);
const capture = surface(640,360), maskCanvas=surface(256,144);
const video = document.createElement('video');video.playsInline=true;video.muted=true;
let renderer, source='demo', stream=null, session=0, starting=false, alive=true, lastInference=0, lastDemo=0;
let hand={ name:'None',score:0,point:[.28,.49],landmarks:[] }, chest=[.55,.29], demoGesture=null;
let frames=0, fpsStart=performance.now(), lastUI=0, lastVision=0, lastVideoTime=-1;
let recorder=null, recordStarted=0, recordingChunks=[], recordingMime='';
const pipeline = new VisionPipeline(onVision, error => { if(source==='camera') { showNotice(`Hand tracking stopped: ${error.message}`,true); useDemo(); pipeline.dispose(); } },message=>{ $('stage-message').querySelector('span:last-child').textContent=message; });

function showNotice(message,error=false){const el=$('notice');el.textContent=message;el.classList.toggle('error',error);el.hidden=false;}
function clearNotice(){$('notice').hidden=true;}
function setCameraButton(label,disabled=false){$('camera').querySelector('span').textContent=label;$('camera').disabled=disabled;}
function drawCover(ctx,image,w,h,mirror=false){
  const iw=image.videoWidth||image.width,ih=image.videoHeight||image.height,scale=Math.max(w/iw,h/ih);
  ctx.save();if(mirror){ctx.translate(w,0);ctx.scale(-1,1);}ctx.drawImage(image,(w-iw*scale)/2,(h-ih*scale)/2,iw*scale,ih*scale);ctx.restore();
}
async function enableCamera(deviceId){
  if(starting)return;
  if(!navigator.mediaDevices?.getUserMedia){showNotice('Camera access needs localhost or HTTPS and a browser with webcam support.',true);return;}
  const token=++session;starting=true;clearNotice();$('stage-message').hidden=false;setCameraButton('Starting camera…',true);
  let nextStream;
  try{
    // Request the camera only after the user's explicit button click.
    nextStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:1280},height:{ideal:720},facingMode:'user',...(deviceId?{deviceId:{exact:deviceId}}:{})}});
    if(token!==session){nextStream.getTracks().forEach(t=>t.stop());return;}
    await pipeline.init();
    if(token!==session){nextStream.getTracks().forEach(t=>t.stop());return;}
    stream?.getTracks().forEach(t=>t.stop());stream=nextStream;video.srcObject=stream;await video.play();
    if(token!==session){nextStream.getTracks().forEach(t=>t.stop());return;}
    source='camera';pipeline.invalidate();trigger.reset();hand={name:'None',score:0,point:[.5,.5],landmarks:[]};demoGesture=null;lastVision=0;lastInference=0;lastVideoTime=-1;
    transition.from=transition.to=0;transition.start=-Infinity;settings.split=false;syncCompare();
    $('source-badge').textContent='LIVE CAMERA';$('scene-caption').textContent='LIVE CAMERA · CLOSE YOUR FIST TO CROSS OVER';
    $('camera-state').textContent='Your camera is live';$('return-demo').hidden=false;$('demo-fist').hidden=true;setCameraButton('Camera enabled');
    const devices=await navigator.mediaDevices.enumerateDevices();
    const select=$('camera-select');select.replaceChildren();
    devices.filter(d=>d.kind==='videoinput').forEach((d,i)=>{const o=document.createElement('option');o.value=d.deviceId;o.textContent=d.label||`Camera ${i+1}`;select.append(o);});
    select.value=stream.getVideoTracks()[0].getSettings().deviceId;select.hidden=select.options.length<2;
    stream.getVideoTracks()[0].addEventListener('ended',()=>{if(source==='camera'&&!starting){useDemo();showNotice('The camera disconnected. Reconnect it and enable the camera again.',true);}});
  }catch(error){
    nextStream?.getTracks().forEach(t=>t.stop());
    if(token!==session)return;
    useDemo();
    const messages={NotAllowedError:'Camera permission was denied. Allow camera access for this site in your browser, then try again.',NotFoundError:'No camera was found. Connect a webcam and try again.',NotReadableError:'The camera is busy. Close other apps using it and try again.',OverconstrainedError:'That camera is unavailable. Try another camera.'};
    showNotice(messages[error.name]||`Could not start the camera: ${error.message}`,true);
  }finally{if(token===session){starting=false;$('stage-message').hidden=true;setCameraButton(source==='camera'?'Camera enabled':'Enable camera');}}
}
function useDemo(){
  session++;starting=false;source='demo';pipeline.invalidate();stream?.getTracks().forEach(t=>t.stop());stream=null;video.pause();video.srcObject=null;
  trigger.reset();demoGesture=null;hand={name:'None',score:0,point:[.28,.49],landmarks:[]};lastDemo=0;
  $('source-badge').textContent='DEMO SOURCE';$('scene-caption').textContent='ILLUSTRATED DEMO · ENABLE CAMERA TO STEP IN';
  $('camera-state').textContent='Previewing the illustrated demo';$('return-demo').hidden=true;$('camera-select').hidden=true;$('demo-fist').hidden=false;$('stage-message').hidden=true;setCameraButton('Enable camera');
}
function onVision(data){
  if(source!=='camera'){data.bitmap.close();return;}
  const ctx=maskCanvas.getContext('2d');maskCanvas.width=data.width;maskCanvas.height=data.height;
  const pixels=ctx.createImageData(data.width,data.height);let total=0,sumX=0,minY=data.height,maxY=0;
  for(let i=0;i<data.mask.length;i++){
    const value=data.mask[i],j=i*4;pixels.data[j]=pixels.data[j+1]=pixels.data[j+2]=value;pixels.data[j+3]=255;
    if(value>150&&i%4===0){const x=i%data.width,y=Math.floor(i/data.width);sumX+=x;total++;minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  }
  ctx.putImageData(pixels,0,0);renderer.setFrame(data.bitmap,maskCanvas);data.bitmap.close();
  if(total>data.mask.length*.005){const target=[sumX/total/data.width,1-(minY+(maxY-minY)*.67)/data.height];chest=chest.map((v,i)=>v*.7+target[i]*.3);}
  hand=selectHand(data.hands,false);lastVision=performance.now();processGesture(hand,lastVision);
  $('tracking-label').textContent=hand.landmarks.length?`${hand.name.replaceAll('_',' ')} · ${Math.round(hand.score*100)}%`:'Show your hand to the camera';
  $('tracking-dot').classList.toggle('active',hand.landmarks.length>0);
}
function processGesture(value,now){
  const event=trigger.update(value,now);$('hold-progress').style.width=`${event.progress*100}%`;
  if(event.fired)transform(value.point);
}
function transform(point=hand.point){
  settings.split=false;syncCompare();
  transition.toggle(performance.now(),point);
}
function syncCompare(){
  $('view-full').classList.toggle('selected',!settings.split);$('view-full').setAttribute('aria-pressed',String(!settings.split));
  $('view-compare').classList.toggle('selected',settings.split);$('view-compare').setAttribute('aria-pressed',String(settings.split));$('compare-label').hidden=!settings.split;
}
function download(blob,name){const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function stopRecording(){if(recorder?.state==='recording')recorder.stop();}
function toggleRecording(){
  if(recorder?.state==='recording'){stopRecording();return;}
  if(!window.MediaRecorder||!$('output').captureStream){showNotice('This browser cannot record the canvas. You can still save a snapshot.',true);return;}
  try{
    recordingChunks=[];const recordingStream=$('output').captureStream(30);
    recordingMime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
    if(!recordingMime){recordingStream.getTracks().forEach(t=>t.stop());throw new Error('No supported video format.');}
    recorder=new MediaRecorder(recordingStream,{mimeType:recordingMime,videoBitsPerSecond:6000000});
    recorder.ondataavailable=e=>{if(e.data.size)recordingChunks.push(e.data);};
    recorder.onstop=()=>{recordingStream.getTracks().forEach(t=>t.stop());if(recordingChunks.length)download(new Blob(recordingChunks,{type:recordingMime}),`afterimage-${Date.now()}.${recordingMime.includes('mp4')?'mp4':'webm'}`);$('record').classList.remove('recording');$('record').querySelector('span').textContent='Record';};
    recorder.onerror=()=>{showNotice('Recording failed. Please try again or save a snapshot.',true);stopRecording();};
    recorder.start(1000);recordStarted=performance.now();$('record').classList.add('recording');clearNotice();
  }catch(error){showNotice(`Could not record: ${error.message}`,true);}
}

function bindControls(){
  for(const [id,divide,suffix] of [['intensity',100,'%'],['smoothing',1,''],['halftone',100,'%']]){
    $(id).addEventListener('input',e=>{settings[id]=Number(e.target.value)/divide;$(`${id}-value`).textContent=`${e.target.value}${suffix}`;});
  }
  for(const id of ['rays','flames','shapes','title'])$(id).addEventListener('change',e=>{settings[id]=e.target.checked;});
  $('title-text').addEventListener('input',e=>{settings.titleText=e.target.value;});
  document.querySelectorAll('[data-palette]').forEach(button=>button.addEventListener('click',()=>{
    settings.palette=Number(button.dataset.palette);document.querySelectorAll('[data-palette]').forEach(b=>{const active=b===button;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});$('palette-name').textContent=settings.palette?'ULTRAVIOLET':'ELECTRIC';
  }));
  $('reset').addEventListener('click',()=>{Object.assign(settings,defaults);for(const [id,value] of [['intensity',100],['smoothing',3],['halftone',55]]){$(id).value=value;$(id).dispatchEvent(new Event('input'));}for(const id of ['rays','flames','shapes','title'])$(id).checked=true;$('title-text').value=settings.titleText;document.querySelector('[data-palette="0"]').click();syncCompare();});
  $('camera').addEventListener('click',()=>{if(source!=='camera')enableCamera();});
  $('return-demo').addEventListener('click',useDemo);$('camera-select').addEventListener('change',e=>enableCamera(e.target.value));
  $('transform').addEventListener('click',()=>transform());
  $('view-full').addEventListener('click',()=>{settings.split=false;syncCompare();});$('view-compare').addEventListener('click',()=>{settings.split=true;syncCompare();});
  $('demo-fist').addEventListener('click',()=>{if(source!=='demo'||transition.sample(performance.now()).animating)return;trigger.reset();demoGesture=performance.now();});
  document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','BUTTON','SELECT','TEXTAREA'].includes(document.activeElement.tagName)&&!$('help-dialog').open){e.preventDefault();transform();}});
  $('snapshot').addEventListener('click',()=>{$('output').toBlob(blob=>{if(blob)download(blob,`afterimage-${Date.now()}.png`);},'image/png');});
  $('record').addEventListener('click',toggleRecording);
  $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage').requestFullscreen();}catch{showNotice('Fullscreen is not available in this browser window.');}});
  $('help').addEventListener('click',()=>$('help-dialog').showModal());$('close-help').addEventListener('click',()=>$('help-dialog').close());
  $('help-dialog').addEventListener('click',event=>{if(event.target===$('help-dialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close();}});
}

function frame(now){
  if(!alive)return;
  const time=now/1000;
  if(source==='demo'){
    let fist=false;
    if(demoGesture!==null){const elapsed=now-demoGesture;fist=elapsed>400&&elapsed<1100;hand={name:fist?'Closed_Fist':'Open_Palm',score:1,point:[.28,.49],landmarks:[]};processGesture(hand,now);if(elapsed>1400){demoGesture=null;trigger.reset();}}
    if(now-lastDemo>40){const scene=demo.draw(time,fist);renderer.setFrame(scene.source,scene.mask);chest=scene.chest;hand.point=scene.hand;lastDemo=now;}
  }else if(video.readyState>=2&&!pipeline.busy&&now-lastInference>80&&video.currentTime!==lastVideoTime){
    lastInference=now;lastVideoTime=video.currentTime;drawCover(capture.getContext('2d'),video,640,360,true);pipeline.submit(capture,now);
  }
  renderer.render({time,settings,transition:transition.sample(now),chest,...layers.draw(time,settings)});
  frames++;
  if(now-fpsStart>1000){$('fps').textContent=Math.round(frames*1000/(now-fpsStart));frames=0;fpsStart=now;}
  if(now-lastUI>100){
    lastUI=now;const state=transition.sample(now);$('mode-label').textContent=settings.split?'SIDE BY SIDE':state.animating?'CROSSING OVER':state.to?'COMIC WORLD':'YOUR REALITY';
    $('transform').disabled=state.animating;$('demo-fist').disabled=state.animating||demoGesture!==null;
    if(source==='demo'){
      $('tracking-label').textContent=demoGesture!==null?'Simulated gesture · demo only':'Camera needed for hand tracking';$('tracking-dot').classList.toggle('active',demoGesture!==null);
      $('gesture-label').textContent='A fist. A whole new world.';$('gesture-detail').textContent='Try a demo fist, or enable your camera to step in.';
    }else{
      const stale=now-lastVision>1500;
      $('gesture-label').textContent=stale?'Finding your hand…':!trigger.armed?'Open your palm to rearm.':trigger.progress>0?'Hold that fist…':'Ready when you are.';
      $('gesture-detail').textContent='Close your fist to transform. Open, then close to return.';
      if(stale){$('tracking-label').textContent='Waiting for a camera frame…';$('tracking-dot').classList.remove('active');$('hold-progress').style.width='0%';trigger.update({},now);}
    }
    const cursor=$('hand-cursor');cursor.hidden=trigger.progress===0||settings.split;
    cursor.style.left=`${hand.point[0]*100}%`;cursor.style.top=`${hand.point[1]*100}%`;
    if(recorder?.state==='recording'){const seconds=Math.floor((now-recordStarted)/1000);$('record').querySelector('span').textContent=`Stop · ${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;if(seconds>=60)stopRecording();}
  }
  requestAnimationFrame(frame);
}

try{
  renderer=new ComicRenderer($('output'));bindControls();requestAnimationFrame(frame);
}catch(error){showNotice(error.message,true);$('camera').disabled=true;$('transform').disabled=true;$('record').disabled=true;$('snapshot').disabled=true;$('demo-fist').disabled=true;}
$('output').addEventListener('webglcontextlost',event=>{event.preventDefault();alive=false;useDemo();stopRecording();showNotice('The graphics context was interrupted. Reload the page to restart the effect.',true);});
window.addEventListener('pagehide',()=>{alive=false;stream?.getTracks().forEach(t=>t.stop());pipeline.dispose();stopRecording();renderer?.dispose();});
