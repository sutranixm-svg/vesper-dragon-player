'use client';
import { useEffect, useRef, type RefObject } from 'react';

type Props = { analyser: RefObject<AnalyserNode | null>; playing: boolean; enabled: boolean; trackId: string };
export function AudioVisualizer({ analyser, playing, enabled, trackId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0, height = 0, frame = 0, last = 0, energy = 0;
    const wave = new Uint8Array(2048), bins = new Uint8Array(1024);
    const particles: { x: number; y: number; vx: number; vy: number; life: number; size: number }[] = [];
    const draw = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, .05) : 1 / 30; last = now;
      const node = analyser.current;
      const live = enabled && playing && node?.context.state === 'running';
      ctx.clearRect(0, 0, width, height);
      if (!width || !height) return;
      let bass = 0, rms = 0;
      if (live && node) {
        node.getByteTimeDomainData(wave); node.getByteFrequencyData(bins);
        const hz = node.context.sampleRate / node.fftSize;
        const lo = Math.max(1, Math.floor(30 / hz)), hi = Math.ceil(180 / hz);
        for (let i = lo; i <= hi; i++) bass += bins[i] / 255;
        bass /= hi - lo + 1;
        for (const sample of wave) rms += ((sample - 128) / 128) ** 2;
        rms = Math.sqrt(rms / wave.length);
      }
      energy += (bass - energy) * Math.min(1, dt * 12);
      const mid = height / 2;
      if (live && !reduced.matches && rms > .002) {
        const amount = Math.min(6, Math.floor((rms * 140 + energy * 28) * dt * 8));
        for (let i = 0; i < amount && particles.length < 100; i++) {
          const angle = Math.random() * Math.PI * 2, speed = 12 + energy * 85;
          particles.push({ x: width * (.12 + Math.random() * .76), y: mid, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .6 + Math.random() * .6, size: .7 + Math.random() * 1.6 });
        }
      }
      if (!live || reduced.matches) particles.length = 0;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.fillStyle = `rgba(245,199,78,${Math.min(.8, p.life)})`;
        ctx.shadowColor = '#efbd38'; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, '#b8871700'); gradient.addColorStop(.15, '#c99430'); gradient.addColorStop(.5, '#fff0a6'); gradient.addColorStop(.85, '#dca735'); gradient.addColorStop(1, '#b8871700');
      ctx.strokeStyle = gradient; ctx.lineWidth = live ? 1.6 : 1;
      ctx.shadowColor = '#e5b73a'; ctx.shadowBlur = live ? 5 + energy * 9 : 0;
      ctx.beginPath();
      const points = Math.min(400, Math.floor(width));
      for (let i = 0; i <= points; i++) {
        const sample = live ? (wave[Math.min(wave.length - 1, Math.floor(i / points * wave.length))] - 128) / 128 : 0;
        const y = mid + sample * height * (reduced.matches ? .12 : .36) * Math.sin(i / points * Math.PI);
        if (!i) ctx.moveTo(0, y); else ctx.lineTo(i / points * width, y);
      }
      ctx.stroke(); ctx.shadowBlur = 0;
    };
    const resize = () => {
      const bounds = canvas.getBoundingClientRect(); width = bounds.width; height = bounds.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(performance.now());
    };
    const tick = (now: number) => {
      if (now - last >= (reduced.matches ? 100 : 1000 / 30)) draw(now);
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      if (document.hidden) return;
      draw(performance.now());
      if (playing && enabled) frame = requestAnimationFrame(tick);
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize(); start();
    document.addEventListener('visibilitychange', start); reduced.addEventListener('change', start);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', start); reduced.removeEventListener('change', start); };
  }, [analyser, playing, enabled, trackId]);
  return <canvas ref={canvasRef} className="audio-reactive-canvas" aria-label="实时音频波形及低频驱动粒子" role="img" />;
}
