import test from 'node:test';
import assert from 'node:assert/strict';
import {RhythmDetector,rmsOf,spectrumBands} from '../lib/rhythm.ts';

function signal(amplitude, rate=48000, frequency=80){
  const wave=Float32Array.from({length:2048},(_,i)=>amplitude*Math.sin(2*Math.PI*frequency*i/rate));
  const db=new Float32Array(1024).fill(-Infinity);
  const bin=Math.round(frequency/(rate/2048));
  if(amplitude>0)for(let i=Math.max(1,bin-1);i<=bin+1;i++)db[i]=20*Math.log10(amplitude*(i===bin?1:.6));
  return {wave,db};
}
test('silence and sustained tones do not invent repeated beats',()=>{
  for(const amplitude of [0,.02,.25]){
    const d=new RhythmDetector(),s=signal(amplitude);
    for(let f=0;f<600;f++)assert.equal(d.update(s.wave,s.db,48000,2048,f/60).beat,false);
  }
});
for(const rate of [44100,48000])for(const bpm of [90,120,150])for(const amplitude of [.025,.15,.5]){
  test(`${bpm} BPM / ${rate} Hz / amplitude ${amplitude}: onsets stay on the input beat`,()=>{
    const d=new RhythmDetector(),hits=[],period=60/bpm;
    const expected=Array.from({length:10},(_,i)=>.5+i*period);
    for(let f=0;f<Math.ceil((expected.at(-1)+.3)*60);f++){
      const t=f/60,elapsed=t-.5;
      const a=elapsed<0?0:amplitude*Math.exp(-(elapsed%period)/.055);
      const s=signal(a,rate);
      if(d.update(s.wave,s.db,rate,2048,t).beat)hits.push(t);
    }
    assert.equal(hits.length,expected.length,JSON.stringify(hits));
    hits.forEach((t,i)=>assert(Math.abs(t-expected[i])<=1/30+.00001,`${t} vs ${expected[i]}`));
  });
}
test('high frequency energy is not reported as a bass beat',()=>{
  const d=new RhythmDetector(),zero=signal(0),high=signal(.3,48000,5000);
  d.update(zero.wave,zero.db,48000,2048,0);
  assert.equal(d.update(high.wave,high.db,48000,2048,.5).beat,false);
});
test('reset removes old bursts; spectrum is finite and silence maps to zero',()=>{
  const d=new RhythmDetector(),zero=signal(0),kick=signal(.2);
  d.update(zero.wave,zero.db,48000,2048,0);
  assert.equal(d.update(kick.wave,kick.db,48000,2048,.5).beat,true);
  d.reset();const reset=d.update(zero.wave,zero.db,48000,2048,1);
  assert.equal(reset.pulse,0);assert.equal(reset.energy,0);
  assert.equal(rmsOf([]),0);
  assert(spectrumBands(zero.db,48000,2048,36).every(v=>v===0));
  const low=spectrumBands(kick.db,48000,2048,36);
  const high=spectrumBands(signal(.2,48000,5000).db,48000,2048,36);
  assert(low.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
  assert(low.indexOf(Math.max(...low))<high.indexOf(Math.max(...high)));
});
