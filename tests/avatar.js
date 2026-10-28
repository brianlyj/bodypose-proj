import { MariAvatar } from '../src/avatar.js';
import { VisionPipeline } from '../src/vision.js';
import { Matrix4,Quaternion } from 'three';
const status=document.querySelector('#status'),list=document.querySelector('#results');
const pass=text=>{const li=document.createElement('li');li.textContent=`PASS — ${text}`;list.append(li);};
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
let pipeline,avatar;
try{
  avatar=await new MariAvatar().load();document.querySelector('#preview').append(avatar.source);
  assert(Object.keys(avatar.rig.bones).length===20,'Expected 20 bones');
  assert(avatar.rig.morphs.some(m=>m.morphTargetDictionary.jawOpen!==undefined),'Missing jaw morph');pass('Original Mari asset loads with 20 bones, skin weights and expression targets.');
  const hand=avatar.rig.bones.LeftHand,Vector=hand.position.constructor;
  for(let i=0;i<40;i++)avatar.draw(i*33);
  const rest=hand.getWorldPosition(new Vector());
  for(let i=0;i<40;i++)avatar.draw(2000+i*33,{demo:true});
  assert(hand.getWorldPosition(new Vector()).distanceTo(rest)>.25,'Hand did not follow the rig');
  const rendered=avatar.source.getContext('2d').getImageData(0,0,960,540).data;
  assert(rendered.some((v,i)=>i%4===0&&v>200),'Avatar did not render visible textured pixels');pass('Arm retargeting moves the skinned hand; textured avatar renders successfully.');
  for(let i=0;i<20;i++)avatar.draw(4000+i*20,{expressionPreview:{jawOpen:.85,eyeBlinkLeft:0,eyeBlinkRight:0}});
  const headPoint=avatar.facePoint();assert(headPoint.every(v=>v>0&&v<1)&&headPoint[1]<.5,'Avatar face origin is not above the torso');
  assert(avatar.rig.morphs.some(m=>m.morphTargetInfluences[m.morphTargetDictionary.jawOpen]>.7),'Demo expression did not open the avatar mouth');
  pass('Expression preview opens Mari’s mouth and projects the transformation origin onto her face.');
  const gl=avatar.renderer.getContext();assert(gl.getError()===gl.NO_ERROR,'Avatar WebGL error');pass('3D scene renders without WebGL errors.');
  let resolveFrame,rejectFrame;
  pipeline=new VisionPipeline(data=>resolveFrame(data),error=>rejectFrame(error),message=>status.textContent=message);
  await pipeline.init();const frame=document.createElement('canvas');frame.width=640;frame.height=480;const ctx=frame.getContext('2d');
  async function infer(file,timestamp){
    const image=new Image();image.src=`/tests/fixtures/${file}.jpg`;await image.decode();
    const scale=Math.min(frame.width/image.width,frame.height/image.height);ctx.fillStyle='#bbb';ctx.fillRect(0,0,640,480);ctx.drawImage(image,(640-image.width*scale)/2,(480-image.height*scale)/2,image.width*scale,image.height*scale);
    return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Avatar inference timed out')),60000);resolveFrame=result=>{clearTimeout(timeout);resolve(result);};rejectFrame=error=>{clearTimeout(timeout);reject(error);};pipeline.submit(frame,timestamp,{avatar:true});});
  }
  const pose=await infer('pose',1000);pose.bitmap.close();assert(pose.body.worldLandmarks[0]?.length===33,'Real body pose was not detected');pass(`Real pose image produces 33 body landmarks (${Math.round(pose.inferenceMs)} ms including first model load).`);
  const face=await infer('portrait',1500);face.bitmap.close();assert(face.face.landmarks[0]?.length>=468,'Real face was not detected');
  assert(face.face.blendshapes[0]?.categories.length>=50,'Face expression scores missing');assert(face.face.matrix[0]?.data.length===16,'Face rotation matrix missing');pass('Real face produces facial landmarks, expression coefficients and a head transformation matrix.');
  avatar.reset();avatar.update({...pose,face:face.face},5000);
  for(let i=0;i<20;i++)avatar.draw(5000+i*25);
  assert(avatar.status.body&&avatar.status.face,'Real results did not drive the avatar');pass('Real body and face results drive the avatar controller.');
  const movedFace=structuredClone(face.face);
  movedFace.matrix[0].data=new Matrix4().makeRotationY(.3).multiply(new Matrix4().fromArray(face.face.matrix[0].data)).toArray();
  avatar.update({face:movedFace},5500);
  for(let i=0;i<20;i++)avatar.draw(5500+i*25);
  const head=avatar.rig.bones.Head,restHead=avatar.rig.rest.Head.world;
  assert(head.getWorldQuaternion(new Quaternion()).angleTo(restHead)>.15,'Head rotation did not retarget');
  avatar.calibrate();avatar.update({face:movedFace},6000);
  for(let i=0;i<20;i++)avatar.draw(6000+i*25);
  assert(head.getWorldQuaternion(new Quaternion()).angleTo(restHead)<.05,'Head centering did not reset the neutral rotation');
  pass('Head turns retarget correctly, and Center head establishes a new neutral rotation.');
  for(let i=0;i<60;i++)avatar.draw(7000+i*33);
  assert(!avatar.status.body&&!avatar.status.face,'Stale tracking remained active');pass('Lost tracking releases the pose and expressions back to neutral.');
  status.textContent='ALL AVATAR CHECKS PASSED';
}catch(error){status.textContent=`FAILED: ${error.message}`;status.className='fail';console.error(error);}finally{pipeline?.dispose();}
let mode='rest';
for(const name of ['rest','wave','blink','mouth'])document.querySelector(`#${name}`).onclick=()=>{mode=name;avatar?.reset();};
function animate(now){
  if(avatar?.ready){
    if(mode==='blink'||mode==='mouth'){
      avatar.rig.lastFace=now;avatar.rig.expressions=mode==='blink'?{eyeBlinkLeft:1,eyeBlinkRight:1}:{jawOpen:1,mouthSmileLeft:.5,mouthSmileRight:.5};
    }
    avatar.draw(now,{demo:mode==='wave'});
  }requestAnimationFrame(animate);
}requestAnimationFrame(animate);
