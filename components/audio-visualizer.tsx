'use client';
import { useEffect, useRef, type RefObject } from 'react';
import { RhythmDetector, spectrumBands } from '@/lib/rhythm';

type Props = { analyser: RefObject<AnalyserNode | null>; playing: boolean; enabled: boolean; trackId: string; resetKey:number };
type Particle = { x:number; y:number; vx:number; vy:number; life:number; total:number; size:number };

export function AudioVisualizer({ analyser, playing, enabled, trackId, resetKey }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas=canvasRef.current, ctx=canvas?.getContext('2d');
    if(!canvas||!ctx)return;
    const host=canvas.closest<HTMLElement>('.turntable');
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    const detector=new RhythmDetector();
    let width=0,height=0,frame=0,last=0,lastAudioTime=-1;
    let wave=new Float32Array(0),bins=new Float32Array(0),bars=new Float32Array(0);
    let measured={beat:false,pulse:0,rms:0,bass:0,energy:0,flux:0};
    const particles:Particle[]=[];
    const reset=()=>{
      detector.reset();particles.length=0;bars.fill(0);wave.fill(0);lastAudioTime=-1;
      measured={beat:false,pulse:0,rms:0,bass:0,energy:0,flux:0};
      host?.style.setProperty('--audio-beat','0');host?.style.setProperty('--audio-energy','0');
    };
    const draw=(now:number)=>{
      const dt=last?Math.min((now-last)/1000,.08):1/60;last=now;
      if(!width||!height)return;
      const node=analyser.current;
      const live=!!(enabled&&playing&&!document.hidden&&node?.context.state==='running');
      ctx.clearRect(0,0,width,height);
      let onset=false;
      if(live&&node){
        if(wave.length!==node.fftSize){wave=new Float32Array(node.fftSize);bins=new Float32Array(node.frequencyBinCount);}
        if(node.context.currentTime!==lastAudioTime){
          node.getFloatTimeDomainData(wave);node.getFloatFrequencyData(bins);lastAudioTime=node.context.currentTime;
          measured=detector.update(wave,bins,node.context.sampleRate,node.fftSize,lastAudioTime);onset=measured.beat;
        }
        const target=spectrumBands(bins,node.context.sampleRate,node.fftSize,width<420?36:56);
        if(bars.length!==target.length)bars=new Float32Array(target.length);
        for(let i=0;i<bars.length;i++)bars[i]+=(target[i]-bars[i])*(1-Math.exp(-dt/(target[i]>bars[i] ? .018 : .10)));
      }else reset();
      host?.style.setProperty('--audio-beat',(reduced.matches?0:measured.pulse).toFixed(3));
      host?.style.setProperty('--audio-energy',(reduced.matches?0:measured.energy).toFixed(3));
      // Only an observed onset emits particles. Randomness affects shape, never timing.
      if(onset&&!reduced.matches){
        const count=width<420?12:22;
        for(let i=0;i<count&&particles.length<80;i++){
          const angle=Math.random()*Math.PI*2,speed=35+measured.energy*120,life=.28+Math.random()*.32;
          particles.push({x:width*.5,y:height*.44,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed*.55,life,total:life,size:.7+Math.random()*1.2});
        }
      }
      if(reduced.matches)particles.length=0;
      const mid=height*.44,glow=ctx.createLinearGradient(0,0,width,0);
      glow.addColorStop(0,'#926829');glow.addColorStop(.5,'#ffe8a4');glow.addColorStop(1,'#bb8c37');
      ctx.strokeStyle='#c5a66b35';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,mid);ctx.lineTo(width,mid);ctx.stroke();
      if(live){
        const step=width/Math.max(1,bars.length);
        ctx.fillStyle=glow;ctx.globalAlpha=reduced.matches?.4:.65;
        for(let i=0;i<bars.length;i++){const size=bars[i]*height*.34;if(size>.15)ctx.fillRect(i*step,mid-size,Math.max(1,step-3),size*2);}
        ctx.globalAlpha=1;ctx.beginPath();ctx.strokeStyle='#fff0c5';ctx.lineWidth=1.2;
        // The trace uses real PCM samples, independently of the beat detector.
        const points=Math.min(340,Math.floor(width));
        for(let i=0;i<=points;i++){
          const sample=wave[Math.min(wave.length-1,Math.floor(i/points*wave.length))]||0;
          const y=mid+sample*height*(reduced.matches?.12:.29);
          if(!i)ctx.moveTo(0,y);else ctx.lineTo(i/points*width,y);
        }
        ctx.stroke();
      }
      ctx.save();ctx.globalCompositeOperation='lighter';
      for(let i=particles.length-1;i>=0;i--){
        const p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue;}
        p.x+=p.vx*dt;p.y+=p.vy*dt;
        ctx.fillStyle='rgba(255,220,135,'+(p.life/p.total*.8)+')';
        ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();ctx.fillStyle='#b7974e25';ctx.fillRect(0,height-12,width,2);
      if(live){ctx.fillStyle='#f1cf76';ctx.fillRect(0,height-12,width*measured.energy,2);}
    };
    const resize=()=>{
      const bounds=canvas.getBoundingClientRect();width=bounds.width;height=bounds.height;
      const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);draw(performance.now());
    };
    const tick=(now:number)=>{if(now-last>=(reduced.matches?100:1000/60))draw(now);frame=requestAnimationFrame(tick);};
    const start=()=>{cancelAnimationFrame(frame);reset();if(document.hidden){ctx.clearRect(0,0,width,height);return;}draw(performance.now());if(playing&&enabled)frame=requestAnimationFrame(tick);};
    const observer=new ResizeObserver(resize);observer.observe(canvas);resize();start();
    document.addEventListener('visibilitychange',start);reduced.addEventListener('change',start);
    return()=>{cancelAnimationFrame(frame);reset();observer.disconnect();document.removeEventListener('visibilitychange',start);reduced.removeEventListener('change',start);};
  },[analyser,playing,enabled,trackId,resetKey]);
  return <canvas ref={canvasRef} className="audio-reactive-canvas" aria-label="真实音频频谱与波形；低频重拍触发粒子" role="img" />;
}
