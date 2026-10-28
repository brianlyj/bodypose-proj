/** A held fist fires once; an explicit open palm must rearm it. */
export class FistTrigger {
  constructor({ holdMs = 260, releaseMs = 180, confidence = 0.7, openConfidence = 0.55 } = {}) {
    Object.assign(this, { holdMs, releaseMs, confidence, openConfidence });
    this.reset();
  }
  reset() {
    this.armed = true;
    this.fistSince = null;
    this.openSince = null;
    this.lastTime = null;
    this.progress = 0;
  }
  update({ name = 'None', score = 0, point = [0.5, 0.5] } = {}, now) {
    // Lost inference frames cannot count toward a continuous gesture hold.
    if (this.lastTime !== null && now - this.lastTime > 450) {
      this.fistSince = this.openSince = null;
    }
    this.lastTime = now;
    let fired = false;
    if (score >= this.confidence && name === 'Closed_Fist') {
      this.openSince = null;
      if (this.armed) {
        this.fistSince ??= now;
        this.progress = Math.min(1, (now - this.fistSince) / this.holdMs);
        if (this.progress >= 1) { fired = true; this.armed = false; }
      }
    } else {
      this.fistSince = null;
      this.progress = 0;
      // Rearming is harmless by itself; tolerate the lower scores of a turned palm.
      if (score >= this.openConfidence && name === 'Open_Palm') {
        this.openSince ??= now;
        if (now - this.openSince >= this.releaseMs) this.armed = true;
      } else this.openSince = null;
    }
    return { fired, point, progress: this.progress, armed: this.armed };
  }
}

export function selectHand(result, mirror = true) {
  let best = { name: 'None', score: 0, point: [0.5, 0.5], landmarks: [] };
  for (let i = 0; i < (result.gestures?.length ?? 0); i++) {
    const category = result.gestures[i][0];
    const landmarks = result.landmarks?.[i] ?? [];
    if (!category || !landmarks.length) continue;
    const priority = category.categoryName === 'Closed_Fist' ? 2 : category.categoryName === 'Open_Palm' ? 1 : 0;
    const oldPriority = best.name === 'Closed_Fist' ? 2 : best.name === 'Open_Palm' ? 1 : 0;
    const threshold = category.categoryName === 'Open_Palm' ? .55 : .7;
    if ((category.score >= threshold && priority > oldPriority) || (priority === oldPriority && category.score > best.score)) {
      const palm = [0, 5, 9, 13, 17].map(j => landmarks[j]);
      const x = palm.reduce((s, p) => s + p.x, 0) / palm.length;
      const y = palm.reduce((s, p) => s + p.y, 0) / palm.length;
      best = { name: category.categoryName, score: category.score, point: [mirror ? 1 - x : x, y], landmarks };
    }
  }
  return best;
}

/** Read raw classifier scores, rather than the avatar's smoothed morph weights. */
export function readExpression(face, mirror = false) {
  const nose = face?.landmarks?.[0]?.[1];
  const scores = Object.fromEntries((face?.blendshapes?.[0]?.categories ?? []).map(c => [c.categoryName, c.score]));
  const tracked = !!nose && [nose.x, nose.y, scores.jawOpen, scores.eyeBlinkLeft, scores.eyeBlinkRight]
    .every(v => Number.isFinite(v) && v >= 0 && v <= 1);
  return {
    tracked,
    jawOpen: tracked ? scores.jawOpen : 0,
    leftEyeOpen: tracked ? 1 - scores.eyeBlinkLeft : 0,
    rightEyeOpen: tracked ? 1 - scores.eyeBlinkRight : 0,
    point: tracked ? [mirror ? 1 - nose.x : nose.x, nose.y] : [.5, .35],
  };
}

/** Both eyes + mouth must stay open; only relaxing the mouth rearms the latch. */
export class ExpressionTrigger {
  constructor({ holdMs = 350, releaseMs = 300, mouthThreshold = .5, eyeThreshold = .75, relaxedThreshold = .2 } = {}) {
    Object.assign(this, { holdMs, releaseMs, mouthThreshold, eyeThreshold, relaxedThreshold });
    this.reset();
  }
  reset() {
    this.armed = true;
    this.holdSince = this.relaxedSince = this.lastTime = null;
    this.progress = 0;
  }
  update({ tracked = false, jawOpen = 0, leftEyeOpen = 0, rightEyeOpen = 0, point = [.5, .35] } = {}, now) {
    if (this.lastTime !== null && now - this.lastTime > 500) this.holdSince = this.relaxedSince = null;
    this.lastTime = now;
    let fired = false;
    const valid = tracked && [jawOpen, leftEyeOpen, rightEyeOpen].every(v => Number.isFinite(v) && v >= 0 && v <= 1);
    const active = valid && jawOpen >= this.mouthThreshold && leftEyeOpen >= this.eyeThreshold && rightEyeOpen >= this.eyeThreshold;
    if (active) {
      this.relaxedSince = null;
      if (this.armed) {
        this.holdSince ??= now;
        this.progress = Math.min(1, (now - this.holdSince) / this.holdMs);
        if (this.progress >= 1) { fired = true; this.armed = false; }
      }
    } else {
      this.holdSince = null;
      this.progress = 0;
      // Blinking or losing the face must never rearm an already-open mouth.
      if (valid && jawOpen <= this.relaxedThreshold) {
        this.relaxedSince ??= now;
        if (now - this.relaxedSince >= this.releaseMs) this.armed = true;
      } else this.relaxedSince = null;
    }
    return { fired, point, progress: this.progress, armed: this.armed };
  }
}

export class Transformation {
  constructor(active = true) { this.from = this.to = active ? 1 : 0; this.start = -Infinity; this.origin = [0.5, 0.5]; }
  toggle(now, origin = [0.5, 0.5]) {
    if (this.sample(now).animating) return false;
    this.from = this.to; this.to = 1 - this.to; this.start = now;
    this.origin = origin.map(v => Math.max(0, Math.min(1, v)));
    return true;
  }
  sample(now, duration = 900) {
    const progress = Math.max(0, Math.min(1, (now - this.start) / duration));
    return { from: this.from, to: this.to, progress, animating: progress < 1, origin: this.origin };
  }
}
