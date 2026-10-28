import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AvatarRetargeter } from './retarget.js';
import { surface } from './scene.js';

export class MariAvatar {
  constructor(){
    this.source=surface(960,540);this.mask=surface(960,540);this.silhouette=surface(960,540);
    this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
    this.renderer.setSize(960,540);this.renderer.setPixelRatio(1);this.renderer.setClearColor(0,0);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(32,960/540,.05,30);
    this.camera.position.set(0,1.28,4.65);this.camera.lookAt(0,1.22,0);
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x8b7eac,2));
    this.lastTime=0;this.ready=false;this.status={body:false,face:false};
  }
  async load(){
    const gltf=await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}avatars/Mari-rigged.glb`);
    this.model=gltf.scene;this.scene.add(this.model);
    this.model.traverse(o=>{if(o.isMesh){o.frustumCulled=false;}});
    this.rig=new AvatarRetargeter(this.model);this.ready=true;
    return this;
  }
  update(data,now){this.latestPose=data.body?.landmarks?.[0];this.rig?.update(data,now);}
  calibrate(){this.rig?.calibrate();}
  reset(){this.rig?.reset();this.latestPose=null;}
  handPoint(cameraPoint=[.5,.5]){
    let name='LeftHand';
    if(this.latestPose?.[15]&&this.latestPose?.[16]){
      const distance=p=>Math.hypot(p.x-cameraPoint[0],p.y-cameraPoint[1]);
      name=distance(this.latestPose[15])<distance(this.latestPose[16])?'LeftHand':'RightHand';
    }
    const bone=this.rig?.bones[name];if(!bone)return [.5,.5];
    const p=bone.getWorldPosition(new THREE.Vector3()).project(this.camera);
    return [THREE.MathUtils.clamp((p.x+1)/2,0,1),THREE.MathUtils.clamp((1-p.y)/2,0,1)];
  }
  facePoint(){
    const head=this.rig?.bones.Head;if(!head)return [.5,.35];
    // Offset from the neck to the face, expressed in the head's original axes.
    const p=new THREE.Vector3(0,.17,.12).applyQuaternion(this.rig.rest.Head.world.clone().invert());
    head.localToWorld(p).project(this.camera);
    return [THREE.MathUtils.clamp((p.x+1)/2,0,1),THREE.MathUtils.clamp((1-p.y)/2,0,1)];
  }
  draw(now,{demo=false,expressionPreview=null}={}){
    if(!this.ready)return null;
    const dt=this.lastTime?(now-this.lastTime)/1000:1/30;this.lastTime=now;
    this.status=this.rig.step(now,dt,{demo,expressionPreview});this.renderer.render(this.scene,this.camera);
    const c=this.source.getContext('2d');
    const gradient=c.createRadialGradient(480,255,20,480,280,650);
    gradient.addColorStop(0,'#263a47');gradient.addColorStop(.65,'#151f2c');gradient.addColorStop(1,'#0e1420');
    c.fillStyle=gradient;c.fillRect(0,0,960,540);
    c.strokeStyle='#b7d7de12';c.lineWidth=1;
    for(let x=0;x<960;x+=48){c.beginPath();c.moveTo(x,0);c.lineTo(x,540);c.stroke();}
    for(let y=0;y<540;y+=48){c.beginPath();c.moveTo(0,y);c.lineTo(960,y);c.stroke();}
    c.fillStyle='#060a1260';c.beginPath();c.ellipse(480,499,105,14,0,0,Math.PI*2);c.fill();
    c.drawImage(this.renderer.domElement,0,0);
    const s=this.silhouette.getContext('2d');s.clearRect(0,0,960,540);s.drawImage(this.renderer.domElement,0,0);
    s.globalCompositeOperation='source-in';s.fillStyle='#fff';s.fillRect(0,0,960,540);s.globalCompositeOperation='source-over';
    const m=this.mask.getContext('2d');m.fillStyle='#000';m.fillRect(0,0,960,540);m.drawImage(this.silhouette,0,0);
    return {source:this.source,mask:this.mask,chest:[.5,.48]};
  }
  dispose(){
    this.model?.traverse(o=>{o.geometry?.dispose();for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){m.map?.dispose();m.dispose();}});
    this.renderer.dispose();
  }
}
