import { ComicRenderer } from '../src/renderer.js';
import { DemoScene, GraphicLayers, surface } from '../src/scene.js';
import { VisionPipeline } from '../src/vision.js';
import { selectHand, FistTrigger, Transformation } from '../src/gesture.js';

const resultList=document.querySelector('#results');
function pass(message){const li=document.createElement('li');li.textContent=`PASS — ${message}`;resultList.append(li);}
function assert(value,message){if(!value)throw new Error(message);}
let pipeline;
try{
  const canvas=document.querySelector('#canvas'),renderer=new ComicRenderer(canvas,{width:640,height:360});
  const scene=new DemoScene().draw(1),layers=new GraphicLayers();
  const settings={intensity:1,smoothing:3,halftone:.55,outline:5,palette:0,rays:true,flames:true,shapes:true,title:true,titleText:'TEST THE FRAME',split:false};
  renderer.setFrame(scene.source,scene.mask);
  const gl=renderer.gl,pixels=()=>{const data=new Uint8Array(640*360*4);gl.readPixels(0,0,640,360,gl.RGBA,gl.UNSIGNED_BYTE,data);return data;};
  const render=transition=>renderer.render({time:1,settings,transition,chest:scene.chest,...layers.draw(1,settings)});
  render({from:0,to:0,progress:1,origin:[.25,.5]});const before=pixels();
  render({from:0,to:1,progress:.45,origin:[.25,.5]});const middle=pixels();
  render({from:0,to:1,progress:1,origin:[.25,.5]});const after=pixels();
  const difference=(a,b)=>a.reduce((sum,value,i)=>sum+Math.abs(value-b[i]),0)/a.length;
  assert(gl.getError()===gl.NO_ERROR,'WebGL error');
  assert(difference(before,after)>20,'Effect did not change the source');
  assert(difference(before,middle)>5&&difference(after,middle)>5,'Transition intermediate frame is not distinct');
  pass('WebGL shaders compile and render distinct original, transition and comic frames.');

  const orientation=surface(640,360),ctx=orientation.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,640,180);ctx.fillStyle='#0000ff';ctx.fillRect(0,180,640,180);
  renderer.setFrame(orientation,scene.mask);render({from:0,to:0,progress:1,origin:[.5,.5]});
  const top=new Uint8Array(4),bottom=new Uint8Array(4);gl.readPixels(30,300,1,1,gl.RGBA,gl.UNSIGNED_BYTE,top);gl.readPixels(30,30,1,1,gl.RGBA,gl.UNSIGNED_BYTE,bottom);
  assert(top[0]>240&&bottom[2]>240,'Source orientation is inverted');pass('Video texture orientation is correct.');
  const bitmap=await createImageBitmap(orientation);renderer.setFrame(bitmap,scene.mask);bitmap.close();render({from:0,to:0,progress:1,origin:[.5,.5]});
  gl.readPixels(30,300,1,1,gl.RGBA,gl.UNSIGNED_BYTE,top);gl.readPixels(30,30,1,1,gl.RGBA,gl.UNSIGNED_BYTE,bottom);
  assert(top[0]>240&&bottom[2]>240,'Worker ImageBitmap orientation is inverted');pass('Worker ImageBitmap orientation matches its mask.');
  settings.split=true;render({from:1,to:1,progress:1,origin:[.5,.5]});gl.readPixels(30,300,1,1,gl.RGBA,gl.UNSIGNED_BYTE,top);assert(top[0]>240&&top[1]<10,'Comparison did not retain original pixels on the left');pass('Comparison retains the unprocessed image on the left.');settings.split=false;

  const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));assert(png?.size>1000,'PNG export failed');pass(`PNG snapshot exports (${png.size} bytes).`);
  if(window.MediaRecorder&&canvas.captureStream){
    const stream=canvas.captureStream(10),recorder=new MediaRecorder(stream),chunks=[];
    await new Promise((resolve,reject)=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=resolve;recorder.onerror=reject;recorder.start();let n=0;const timer=setInterval(()=>{render({from:0,to:1,progress:++n/6,origin:[.25,.5]});if(n===6){clearInterval(timer);recorder.stop();}},100);});
    stream.getTracks().forEach(t=>t.stop());assert(new Blob(chunks).size>1000,'Recording is empty');pass('Canvas recording produces non-empty video.');
  }

  document.querySelector('#status').textContent='Loading real local models; no webcam is accessed…';
  let resolveFrame,rejectFrame;
  pipeline=new VisionPipeline(data=>resolveFrame?.(data),error=>rejectFrame?.(error),message=>{document.querySelector('#status').textContent=message;});
  await pipeline.init();pass('Both MediaPipe models and WASM load from local files in a worker.');
  const frame=surface(640,360),frameCtx=frame.getContext('2d');
  async function infer(path,timestamp){
    const img=new Image();img.src=path;await img.decode();
    frameCtx.fillStyle='#bbb';frameCtx.fillRect(0,0,640,360);const scale=Math.min(640/img.width,360/img.height);frameCtx.drawImage(img,(640-img.width*scale)/2,(360-img.height*scale)/2,img.width*scale,img.height*scale);
    const result=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Inference timed out')),30000);resolveFrame=data=>{clearTimeout(timeout);resolve(data);};rejectFrame=error=>{clearTimeout(timeout);reject(error);};pipeline.submit(frame,timestamp);});
    return result;
  }
  const data=await infer('/tests/fixtures/fist.jpg',1000);const hand=selectHand(data.hands,false);data.bitmap.close();
  assert(hand.name==='Closed_Fist'&&hand.score>=.7,`Expected fist; got ${hand.name} ${hand.score}`);pass(`Real fist image recognized: ${hand.name}, ${(hand.score*100).toFixed(1)}% confidence (${Math.round(data.inferenceMs)} ms).`);
  const data2=await infer('/tests/fixtures/fist.jpg',1300);const hand2=selectHand(data2.hands,false);data2.bitmap.close();
  const latch=new FistTrigger(),transformation=new Transformation(false);latch.update(hand,1000);const event=latch.update(hand2,1300);
  assert(event.fired,'Actual recognition results did not fire trigger');transformation.toggle(1300,event.point);assert(transformation.sample(2200).to===1,'Gesture did not switch effect');pass('Real recognition results drive the hold latch and hand-centred transformation.');
  const portrait=await infer('/tests/fixtures/woman_hands.jpg',2000);
  const repeated=await infer('/tests/fixtures/woman_hands.jpg',2300);repeated.bitmap.close();
  assert(difference(data2.mask,portrait.mask)>15&&difference(portrait.mask,repeated.mask)<1,'Mask is stale or unstable');
  pass('The mask changes with the source image and remains stable on repeated frames.');
  let foreground=0,background=0;for(const value of portrait.mask){if(value>220)foreground++;if(value<30)background++;}
  assert(foreground>15000&&background>100000,'Person mask lacks adequate foreground/background coverage');
  const mask=surface(portrait.width,portrait.height),m=mask.getContext('2d'),rgba=m.createImageData(portrait.width,portrait.height);
  portrait.mask.forEach((value,i)=>{rgba.data[i*4]=rgba.data[i*4+1]=rgba.data[i*4+2]=value;rgba.data[i*4+3]=255;});m.putImageData(rgba,0,0);
  const sourcePreview=surface(640,360);sourcePreview.getContext('2d').drawImage(portrait.bitmap,0,0);document.body.append(sourcePreview,mask);
  renderer.setFrame(portrait.bitmap,mask);portrait.bitmap.close();render({from:1,to:1,progress:1,origin:hand.point});
  pass(`Real portrait segmentation has foreground (${foreground} pixels) and background (${background} pixels); synchronized frame renders through the comic pipeline.`);
  // Allow video tracking to reacquire after this deliberate jump between unrelated photos.
  const warmPalm=await infer('/tests/fixtures/right_hands.jpg',2600);warmPalm.bitmap.close();
  const palm=await infer('/tests/fixtures/right_hands.jpg',2850),palm2=await infer('/tests/fixtures/right_hands.jpg',3100);
  const open=selectHand(palm.hands,false),open2=selectHand(palm2.hands,false);palm.bitmap.close();palm2.bitmap.close();
  assert(open.name==='Open_Palm'&&open2.name==='Open_Palm',`Expected open palm; got ${open.name}/${open2.name}`);
  latch.update(open,2850);latch.update(open2,3100);assert(latch.armed,'Real open palm did not rearm the trigger');
  pass(`Real open palms rearm the fist trigger (${(open2.score*100).toFixed(1)}% confidence).`);
  document.querySelector('#status').textContent='ALL CHECKS PASSED';
}catch(error){document.querySelector('#status').textContent=`FAILED: ${error.message}`;document.querySelector('#status').className='fail';console.error(error);}finally{pipeline?.dispose();}
