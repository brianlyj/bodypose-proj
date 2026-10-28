import { Vector3, Quaternion, Matrix4, Euler } from 'three';

export const EXPRESSION_NAMES=['eyeBlinkLeft','eyeBlinkRight','jawOpen','mouthSmileLeft','mouthSmileRight','browInnerUp','browOuterUpLeft','browOuterUpRight'];
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:0));
const vec=p=>new Vector3(p.x,-p.y,-p.z);
const valid=p=>p&&[p.x,p.y,p.z].every(Number.isFinite)&&(p.visibility??1)>.55;
const midpoint=(a,b)=>a.clone().add(b).multiplyScalar(.5);

export function expressionWeights(categories=[]){
  const values=Object.fromEntries(categories.map(c=>[c.categoryName,clamp(c.score)]));
  return Object.fromEntries(EXPRESSION_NAMES.map(name=>{
    const value=values[name]??0;
    // Small classifier noise should not keep the mouth open or eyes half shut.
    const threshold=name.startsWith('eyeBlink')?.12:name==='jawOpen'?.10:.08;
    return [name,clamp((value-threshold)/(1-threshold))];
  }));
}

export function poseDirections(points=[]){
  const result={};
  const pair=(name,a,b)=>{
    if(!valid(points[a])||!valid(points[b]))return;
    const direction=vec(points[b]).sub(vec(points[a]));
    if(direction.lengthSq()<1e-5)return;
    // Depth is noisier than the image plane with a single webcam.
    direction.z=clamp(direction.z,-.7,.7);result[name]=direction.normalize();
  };
  if([11,12,23,24].every(i=>valid(points[i]))){
    const up=midpoint(vec(points[11]),vec(points[12])).sub(midpoint(vec(points[23]),vec(points[24]))).normalize();
    up.x=clamp(up.x,-.45,.45);up.z=clamp(up.z,-.4,.4);up.y=Math.max(.65,up.y);up.normalize();
    result.Spine=up;result.Chest=up;
  }
  for(const [side,shoulder,elbow,wrist,hip,knee,ankle,toe,index] of [
    ['Left',11,13,15,23,25,27,31,19],['Right',12,14,16,24,26,28,32,20],
  ]){
    pair(side+'UpperArm',shoulder,elbow);pair(side+'LowerArm',elbow,wrist);pair(side+'Hand',wrist,index);
    pair(side+'UpperLeg',hip,knee);pair(side+'LowerLeg',knee,ankle);pair(side+'Foot',ankle,toe);
  }
  return result;
}

export class AvatarRetargeter {
  constructor(root){
    this.root=root;this.bones={};this.rest={};this.morphs=[];this.lastBody=-Infinity;this.lastFace=-Infinity;
    this.targets={};this.expressions={};this.headTarget=null;this.neutralHead=null;this.lastHead=null;
    root.updateMatrixWorld(true);
    root.traverse(o=>{
      if(o.isBone){
        this.bones[o.name]=o;
        this.rest[o.name]={local:o.quaternion.clone(),world:o.getWorldQuaternion(new Quaternion()),
          direction:new Vector3(0,1,0).applyQuaternion(o.getWorldQuaternion(new Quaternion()))};
      }
      if(o.morphTargetDictionary)this.morphs.push(o);
    });
    for(const name of ['Hips','Head','LeftUpperArm','RightUpperArm','LeftLowerLeg','RightLowerLeg']){
      if(!this.bones[name])throw new Error(`Mari's rig is missing ${name}.`);
    }
  }
  calibrate(){this.neutralHead=this.lastHead?.clone()??null;}
  reset(){this.targets={};this.expressions={};this.lastBody=this.lastFace=-Infinity;this.headTarget=null;this.neutralHead=null;}
  update(data,now){
    const points=data.body?.worldLandmarks?.[0]??[];
    const directions=poseDirections(points);
    if(Object.keys(directions).length){this.targets=directions;this.lastBody=now;}
    const face=data.face;
    if(face?.landmarks?.length){
      this.expressions=expressionWeights(face.blendshapes?.[0]?.categories);
      this.lastFace=now;
      const values=face.matrix?.[0]?.data;
      if(values?.length===16&&values.every(Number.isFinite)){
        const rotation=new Matrix4().extractRotation(new Matrix4().fromArray(values));
        this.lastHead=new Quaternion().setFromRotationMatrix(rotation).normalize();
        this.neutralHead??=this.lastHead.clone();
        const delta=this.lastHead.clone().multiply(this.neutralHead.clone().invert());
        const e=new Euler().setFromQuaternion(delta,'YXZ');
        e.x=clamp(e.x,-.55,.55);e.y=clamp(e.y,-.8,.8);e.z=clamp(e.z,-.5,.5);
        this.headTarget=new Quaternion().setFromEuler(e).multiply(this.rest.Head.world);
      }
    }
  }
  neutralDirections(){
    return {LeftUpperArm:new Vector3(.3,-1,0).normalize(),RightUpperArm:new Vector3(-.3,-1,0).normalize(),
      LeftLowerArm:new Vector3(.15,-1,.04).normalize(),RightLowerArm:new Vector3(-.15,-1,.04).normalize(),
      LeftHand:new Vector3(.15,-1,.04).normalize(),RightHand:new Vector3(-.15,-1,.04).normalize()};
  }
  applyWorldRotation(name,world,alpha){
    const bone=this.bones[name];if(!bone)return;
    const local=bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(world);
    bone.quaternion.slerp(local,alpha);bone.updateWorldMatrix(false,true);
  }
  step(now,dt,{demo=false,expressionPreview=null}={}){
    const alpha=1-Math.exp(-Math.min(dt,.1)*14);
    let targets=this.neutralDirections(),expressions={},head=null;
    if(demo){
      const t=now/1000;
      targets={...targets,LeftUpperArm:new Vector3(.8,.25+.2*Math.sin(t),0).normalize(),
        LeftLowerArm:new Vector3(.35*Math.sin(t*3),1,.1).normalize(),LeftHand:new Vector3(.3*Math.sin(t*3),1,.1).normalize(),
        Spine:new Vector3(Math.sin(t)*.08,1,0).normalize(),Chest:new Vector3(Math.sin(t)*.08,1,0).normalize()};
      head=new Quaternion().setFromEuler(new Euler(.04*Math.sin(t),.20*Math.sin(t*.8),.06*Math.sin(t))).multiply(this.rest.Head.world);
      const blink=Math.max(0,1-Math.abs((t%4)-.2)/.1);
      expressions={eyeBlinkLeft:blink,eyeBlinkRight:blink,jawOpen:(Math.sin(t*2)+1)*.3,mouthSmileLeft:.55,mouthSmileRight:.55,browInnerUp:.2};
    }else{
      if(now-this.lastBody<800)targets={...targets,...this.targets};
      if(now-this.lastFace<800){expressions=this.expressions;head=this.headTarget;}
    }
    if(expressionPreview)expressions={...expressions,...expressionPreview};
    this.root.updateMatrixWorld(true);
    // Parent-first traversal prevents rotations from being counted twice.
    for(const [name,bone] of Object.entries(this.bones)){
      const rest=this.rest[name];
      if(name==='Head'&&head)this.applyWorldRotation(name,head,alpha);
      else if(targets[name]){
        const desired=new Quaternion().setFromUnitVectors(rest.direction,targets[name]).multiply(rest.world);
        this.applyWorldRotation(name,desired,alpha);
      }else{bone.quaternion.slerp(rest.local,alpha);bone.updateWorldMatrix(false,true);}
    }
    for(const mesh of this.morphs){
      for(const [name,index] of Object.entries(mesh.morphTargetDictionary)){
        const target=expressions[name]??0;
        mesh.morphTargetInfluences[index]+=(target-mesh.morphTargetInfluences[index])*alpha;
      }
    }
    return {body:now-this.lastBody<800,face:now-this.lastFace<800,expressions};
  }
}
