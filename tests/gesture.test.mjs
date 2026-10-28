import test from 'node:test';
import assert from 'node:assert/strict';
import { FistTrigger, Transformation, selectHand } from '../src/gesture.js';

const fist = { name: 'Closed_Fist', score: .94, point: [.21,.62] };
const open = { name: 'Open_Palm', score: .96 };

test('brief detections and low-confidence fists do not transform', () => {
  const trigger = new FistTrigger();
  assert.equal(trigger.update(fist,0).fired,false);
  assert.equal(trigger.update(fist,150).fired,false);
  trigger.update({},170);
  assert.equal(trigger.update(fist,300).fired,false);
  trigger.update({...fist,score:.3},500);
  assert.equal(trigger.update(fist,600).progress,0);
});
test('sustained fist fires once, including when the same fist leaves and re-enters', () => {
  const trigger = new FistTrigger();trigger.update(fist,0);
  const result=trigger.update(fist,270);
  assert.equal(result.fired,true);assert.deepEqual(result.point,[.21,.62]);
  assert.equal(trigger.update(fist,350).fired,false);
  trigger.update({},450);trigger.update(fist,600);
  assert.equal(trigger.update(fist,900).fired,false);
});
test('an explicit sustained open palm rearms the next fist', () => {
  const trigger = new FistTrigger();trigger.update(fist,0);trigger.update(fist,300);
  trigger.update(open,400);assert.equal(trigger.armed,false);
  trigger.update(open,600);assert.equal(trigger.armed,true);
  trigger.update(fist,650);assert.equal(trigger.update(fist,950).fired,true);
});
test('stalled inference cannot complete a continuous hold', () => {
  const trigger=new FistTrigger();trigger.update(fist,0);
  assert.equal(trigger.update(fist,800).fired,false);
  assert.equal(trigger.update(fist,1100).fired,true);
});

test('a turned open hand can rearm, while an uncertain fist still cannot activate', () => {
  const trigger=new FistTrigger();trigger.update(fist,0);trigger.update(fist,300);
  trigger.update({...open,score:.6},400);trigger.update({...open,score:.6},600);
  assert.equal(trigger.armed,true);
  trigger.update({...fist,score:.6},650);
  assert.equal(trigger.update({...fist,score:.6},950).fired,false);
});
test('two hands: a confident fist has priority over an open palm', () => {
  const landmarks=Array.from({length:21},()=>({x:.2,y:.6}));
  const result=selectHand({gestures:[[{categoryName:'Open_Palm',score:.99}],[{categoryName:'Closed_Fist',score:.9}]],landmarks:[landmarks,landmarks]},true);
  assert.equal(result.name,'Closed_Fist');assert.deepEqual(result.point,[.8,.6]);
  assert.deepEqual(selectHand({gestures:[]}).landmarks,[]);
});
test('mirroring is optional and the transition origin stays aligned', () => {
  const landmarks=Array.from({length:21},()=>({x:.25,y:.5}));
  const hand=selectHand({gestures:[[{categoryName:'Closed_Fist',score:.99}]],landmarks:[landmarks]},false);
  assert.deepEqual(hand.point,[.25,.5]);
  const transition=new Transformation(false);transition.toggle(0,hand.point);
  assert.deepEqual(transition.sample(450).origin,[.25,.5]);
});
test('transformation is reversible and ignores inputs while a transition is in flight', () => {
  const transition=new Transformation(false);
  assert.equal(transition.toggle(100,[.2,.3]),true);
  assert.equal(transition.sample(550).progress,.5);
  assert.equal(transition.toggle(600),false);
  assert.equal(transition.sample(1000).to,1);
  assert.equal(transition.toggle(1100),true);
  assert.equal(transition.sample(2000).to,0);
});
