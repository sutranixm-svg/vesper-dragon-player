/** Audio measurements only: no wall-clock oscillators or invented beat timing. */
export const amplitudeFromDb = (db: number) => Number.isFinite(db) && db > -90 ? 10 ** (db / 20) : 0;
export function rmsOf(samples: ArrayLike<number>) {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] ** 2;
  return Math.sqrt(sum / samples.length);
}
export function spectrumBands(db: ArrayLike<number>, sampleRate: number, fftSize: number, count: number) {
  const result = new Float32Array(count), hz = sampleRate / fftSize;
  const highest = Math.min(14000, sampleRate * .45), lowest = 40;
  for (let band = 0; band < count; band++) {
    const low = lowest * (highest / lowest) ** (band / count), high = lowest * (highest / lowest) ** ((band + 1) / count);
    const first = Math.max(1, Math.floor(low / hz));
    const end = Math.min(db.length, Math.max(first + 1, Math.ceil(high / hz)));
    let power = 0;
    for (let i = first; i < end; i++) power += amplitudeFromDb(db[i]) ** 2;
    result[band] = Math.min(1, Math.sqrt(Math.sqrt(power / Math.max(1, end - first))) * 1.8);
  }
  return result;
}
export class RhythmDetector {
  private previous = new Float32Array(0);
  private bassAverage = 0;
  private fluxAverage = 0;
  private fluxVariance = 0;
  private lastBeat = -Infinity;
  private lastTime: number | null = null;
  private envelope = 0;
  private pulse = 0;
  reset() {
    this.previous = new Float32Array(0);
    this.bassAverage = this.fluxAverage = this.fluxVariance = this.envelope = this.pulse = 0;
    this.lastBeat = -Infinity; this.lastTime = null;
  }
  update(wave: ArrayLike<number>, db: ArrayLike<number>, sampleRate: number, fftSize: number, time: number) {
    const initialized = this.lastTime !== null && time >= this.lastTime;
    if (this.lastTime !== null && time < this.lastTime) this.reset();
    const dt = this.lastTime === null ? 1 / 60 : Math.max(0, Math.min(.1, time - this.lastTime));
    this.lastTime = time;
    const hz = sampleRate / fftSize, start = Math.max(1, Math.floor(40 / hz)), end = Math.min(db.length, Math.ceil(240 / hz));
    if (this.previous.length !== db.length) this.previous = new Float32Array(db.length);
    let power = 0, flux = 0;
    for (let i = start; i < end; i++) {
      const current = amplitudeFromDb(db[i]); power += current * current;
      flux += Math.max(0, current - this.previous[i]); this.previous[i] = current;
    }
    const bass = Math.sqrt(power / Math.max(1, end - start)); flux /= Math.max(1, end - start);
    const rms = rmsOf(wave), threshold = Math.max(.0008, this.fluxAverage + 1.8 * Math.sqrt(this.fluxVariance));
    const beat = initialized && rms > .004 && bass > Math.max(.004, this.bassAverage * 1.15)
      && flux > threshold && time - this.lastBeat >= .18;
    if (beat) { this.lastBeat = time; this.pulse = 1; } else this.pulse *= Math.exp(-dt / .14);
    const adaptation = 1 - Math.exp(-dt / .55), difference = flux - this.fluxAverage;
    this.fluxAverage += adaptation * difference;
    this.fluxVariance = (1 - adaptation) * (this.fluxVariance + adaptation * difference * difference);
    this.bassAverage += adaptation * (bass - this.bassAverage);
    this.envelope += (rms - this.envelope) * (1 - Math.exp(-dt / (rms > this.envelope ? .018 : .12)));
    return { beat, pulse:this.pulse, rms, bass, energy:Math.min(1, this.envelope * 4), flux };
  }
}
