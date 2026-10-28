export class VisionPipeline {
  constructor(onResult, onError, onStatus = () => {}) {
    this.onResult = onResult; this.onError = onError; this.busy = false; this.ready = false;
    this.onStatus = onStatus;
    this.sequence = 0; this.epoch = 0; this.pending = new Map();
  }
  async init() {
    if (this.ready) return;
    if (this.initializing) return this.initializing;
    this.initializing = new Promise((resolve, reject) => {
      const base = new URL(import.meta.env.BASE_URL, location.href).href;
      this.worker = new Worker(`${base}vision-worker.js`);
      const timer = setTimeout(() => { this.dispose(); reject(new Error('Model loading timed out. Run npm run setup and try again.')); }, 90000);
      this.worker.onmessage = ({ data }) => {
        if (data.type === 'status') this.onStatus(data.message);
        if (data.type === 'ready') { clearTimeout(timer); this.ready = true; resolve(); }
        if (data.type === 'result') {
          this.busy = false;
          const expectedEpoch = this.pending.get(data.id);
          this.pending.delete(data.id);
          if (expectedEpoch !== this.epoch) { data.bitmap.close(); return; }
          this.onResult(data);
        }
        if (data.type === 'error') {
          this.busy = false; this.pending.delete(data.id);
          if (!this.ready) { clearTimeout(timer); this.dispose(); reject(new Error(data.message)); }
          else this.onError(new Error(data.message));
        }
      };
      this.worker.onerror = event => {
        clearTimeout(timer); const error = new Error(event.message || 'Vision worker failed to start. Run npm run setup.');
        this.dispose(); reject(error); this.onError(error);
      };
      this.worker.postMessage({ type: 'init', base });
    }).finally(() => { this.initializing = null; });
    return this.initializing;
  }
  async submit(canvas, timestamp) {
    if (!this.ready || this.busy) return false;
    this.busy = true;
    const id = ++this.sequence, epoch = this.epoch;
    try {
      const bitmap = await createImageBitmap(canvas);
      if (epoch !== this.epoch || !this.worker) { bitmap.close(); this.busy = false; return false; }
      this.pending.set(id, epoch);
      this.worker.postMessage({ type: 'frame', bitmap, timestamp, id }, [bitmap]);
      return true;
    } catch (error) { this.busy = false; this.onError(error); return false; }
  }
  invalidate() { this.epoch++; }
  dispose() { this.invalidate(); this.worker?.terminate(); this.worker = null; this.busy = this.ready = false; this.pending.clear(); }
}
