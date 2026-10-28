import test from 'node:test';
import assert from 'node:assert/strict';
import { ExpressionTrigger, readExpression } from '../src/gesture.js';

const open={tracked:true,jawOpen:.8,leftEyeOpen:.95,rightEyeOpen:.9,point:[.3,.4]};
const relaxed={...open,jawOpen:.1};
const face=(scores={jawOpen:.8,eyeBlinkLeft:.05,eyeBlinkRight:.1})=>({
  landmarks:[[{}, {x:.3,y:.4}]],blendshapes:[{categories:Object.entries(scores).map(([categoryName,score])=>({categoryName,score}))}],
});

test('face scores retain mirrored camera coordinates and require every coefficient',()=>{
  const value=readExpression(face());
  assert.deepEqual(value,open);
  assert.deepEqual(readExpression(face(),true).point,[.7,.4]);
  for(const missing of ['jawOpen','eyeBlinkLeft','eyeBlinkRight']){
    const input=face();input.blendshapes[0].categories=input.blendshapes[0].categories.filter(c=>c.categoryName!==missing);
    assert.equal(readExpression(input).tracked,false);
  }
  assert.equal(readExpression(null).tracked,false);
  assert.equal(readExpression({...face(),landmarks:[]}).tracked,false);
  assert.equal(readExpression(face({jawOpen:NaN,eyeBlinkLeft:0,eyeBlinkRight:0})).tracked,false);
});

test('both open eyes and an open mouth are required continuously for 350 ms',()=>{
  for(const value of [{...open,jawOpen:.49},{...open,leftEyeOpen:.7},{...open,rightEyeOpen:.7},{...open,tracked:false}]){
    const t=new ExpressionTrigger();t.update(value,0);assert.equal(t.update(value,400).fired,false);
  }
  const t=new ExpressionTrigger();t.update(open,0);assert.equal(t.update(open,349).fired,false);
  assert.equal(t.update(open,350).fired,true);
});

test('a held expression fires once and preserves the face origin',()=>{
  const t=new ExpressionTrigger();t.update(open,0);const event=t.update(open,350);
  assert.equal(event.fired,true);assert.deepEqual(event.point,[.3,.4]);
  for(let now=400;now<2400;now+=100)assert.equal(t.update(open,now).fired,false);
});

test('closing the mouth for 300 ms rearms the next expression',()=>{
  const t=new ExpressionTrigger();t.update(open,0);t.update(open,350);
  t.update(relaxed,400);assert.equal(t.update(relaxed,699).armed,false);
  assert.equal(t.update(relaxed,700).armed,true);
  t.update(open,800);assert.equal(t.update(open,1150).fired,true);
});

test('blinking while the mouth remains open cannot rearm',()=>{
  const t=new ExpressionTrigger();t.update(open,0);t.update(open,350);
  t.update({...open,leftEyeOpen:0,rightEyeOpen:0},400);
  assert.equal(t.update({...open,leftEyeOpen:0,rightEyeOpen:0},750).armed,false);
  t.update(open,800);assert.equal(t.update(open,1150).fired,false);
});

test('lost faces cannot rearm; reentering with the same expression stays latched',()=>{
  const t=new ExpressionTrigger();t.update(open,0);t.update(open,350);
  t.update({},400);t.update({},750);t.update(open,900);
  assert.equal(t.update(open,1250).fired,false);
});

test('interrupted holds and inference gaps cannot count as continuous tracking',()=>{
  const t=new ExpressionTrigger();t.update(open,0);t.update({},300);
  assert.equal(t.update(open,400).progress,0);assert.equal(t.update(open,700).fired,false);
  assert.equal(t.update(open,750).fired,true);
  t.reset();t.update(open,0);assert.equal(t.update(open,600).progress,0);
  assert.equal(t.update(open,950).fired,true);
  t.update(relaxed,1000);assert.equal(t.update(relaxed,1600).armed,false);
  assert.equal(t.update(relaxed,1900).armed,true);
});

test('partly closing the mouth and invalid scores cannot rearm',()=>{
  const t=new ExpressionTrigger();t.update(open,0);t.update(open,350);
  for(const [i,value] of [{...open,jawOpen:.3},{...relaxed,jawOpen:NaN},{...relaxed,leftEyeOpen:Infinity}].entries()){
    t.update(value,400+i*800);assert.equal(t.update(value,750+i*800).armed,false);
  }
});
