import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { expressionWeights,poseDirections } from '../src/retarget.js';

test('facial coefficients reject noise, missing values and invalid values',()=>{
  const weights=expressionWeights([{categoryName:'jawOpen',score:.05},{categoryName:'eyeBlinkLeft',score:1},{categoryName:'mouthSmileRight',score:NaN}]);
  assert.equal(weights.jawOpen,0);assert.equal(weights.eyeBlinkLeft,1);assert.equal(weights.eyeBlinkRight,0);assert.equal(weights.mouthSmileRight,0);
});
test('pose maps camera coordinates into avatar coordinates without swapping limbs',()=>{
  const p=Array.from({length:33},()=>({x:0,y:0,z:0,visibility:0}));
  p[11]={x:.2,y:-.5,z:0,visibility:1};p[13]={x:.5,y:-.5,z:0,visibility:1};p[15]={x:.5,y:-.8,z:0,visibility:1};
  const d=poseDirections(p);assert.deepEqual(d.LeftUpperArm.toArray(),[1,0,0]);assert.equal(d.LeftLowerArm.y,1);assert.equal(d.RightUpperArm,undefined);
  p[13].visibility=.1;assert.equal(poseDirections(p).LeftUpperArm,undefined);
});
function glb(path){const b=fs.readFileSync(path),len=b.readUInt32LE(12);return {b,g:JSON.parse(b.subarray(20,20+len).toString()),bin:28+len};}
test('export has a complete skeleton and facial targets while the source remains static',()=>{
  const {g}=glb(new URL('../public/avatars/Mari-rigged.glb',import.meta.url));
  const original=glb(new URL('../assets/source/Reference-mari.glb',import.meta.url)).g;
  assert.equal(original.skins,undefined);assert.ok(g.skins.length>0);assert.equal(g.skins[0].joints.length,20);
  for(const name of ['Head','Hips','LeftHand','RightFoot'])assert.ok(g.nodes.some(n=>n.name===name));
  const names=new Set(g.meshes.flatMap(m=>m.extras?.targetNames??[]));
  for(const name of ['eyeBlinkLeft','eyeBlinkRight','jawOpen','mouthSmileLeft','browInnerUp'])assert.ok(names.has(name),name);
  assert.ok(!g.materials.some(m=>m.name==='stage'));
});
test('every exported skin weight is finite and normalized',()=>{
  const {b,g,bin}=glb(new URL('../public/avatars/Mari-rigged.glb',import.meta.url));let checked=0;
  for(const mesh of g.meshes)for(const p of mesh.primitives){
    const a=g.accessors[p.attributes.WEIGHTS_0],v=g.bufferViews[a.bufferView];assert.equal(a.componentType,5126);
    for(let i=0;i<a.count;i++){
      const offset=bin+(v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??16);
      const values=Array.from({length:4},(_,j)=>b.readFloatLE(offset+j*4));
      assert.ok(values.every(w=>Number.isFinite(w)&&w>=0&&w<=1));assert.ok(Math.abs(values.reduce((x,y)=>x+y,0)-1)<.001);checked++;
    }
  }
  assert.ok(checked>10000);
});
