'use client';

import {
  ChevronDown, Crown, Disc3, FileAudio, Heart, ListMusic, Maximize2,
  MoreHorizontal, Pause, Play, Plus, Repeat2, Search, Shield, Shuffle,
  SkipBack, SkipForward, Sparkles, Upload, Volume2,
} from 'lucide-react';
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

type Track = { id: string; title: string; artist: string; collection: string; src: string; duration?: number; tone: string; favorite?: boolean };

const demoTracks: Track[] = [
  { id: 'ash', title: 'Canticle of Ash', artist: 'The Hollow Choir', collection: 'Reliquary I', src: '/audio/canticle-of-ash.wav', tone: '#7e2732', favorite: true },
  { id: 'vespers', title: 'Vespers at Blackmere', artist: 'Aveline', collection: 'Nocturnes', src: '/audio/vespers-at-blackmere.wav', tone: '#3d4f50' },
  { id: 'rose', title: 'The Last Rose of Rouen', artist: 'Morrow & Vale', collection: 'Reliquary II', src: '/audio/last-rose-of-rouen.wav', tone: '#6e4d26' },
];

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '0:00';
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
};

export default function Home() {
  const [tracks, setTracks] = useState<Track[]>(demoTracks);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(72);
  const [repeat, setRepeat] = useState(false);
  const [dragging, setDragging] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const active = tracks[activeIndex];

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume / 100; }, [volume]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.load(); setProgress(0); setDuration(active?.duration ?? 0);
    if (playing) audio.play().catch(() => setPlaying(false));
  }, [activeIndex]);

  const queue = useMemo(() => tracks.map((track, index) => ({ ...track, index })), [tracks]);
  const togglePlayback = async () => {
    const audio = audioRef.current; if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { try { await audio.play(); setPlaying(true); } catch { setPlaying(false); } }
  };
  const moveTrack = (delta: number) => setActiveIndex((index) => (index + delta + tracks.length) % tracks.length);
  const addFiles = (files: FileList | File[]) => {
    const audioFiles = Array.from(files).filter((file) => file.type.startsWith('audio/'));
    if (!audioFiles.length) return;
    const imported = audioFiles.map((file, index): Track => ({
      id: `${file.name}-${file.lastModified}`, title: file.name.replace(/\.[^/.]+$/, ''), artist: 'Local manuscript',
      collection: 'Imported archive', src: URL.createObjectURL(file), tone: ['#5f3138', '#3b5054', '#735830'][index % 3],
    }));
    setTracks((current) => [...current, ...imported]); setActiveIndex(tracks.length); setPlaying(false);
  };
  const onFiles = (event: ChangeEvent<HTMLInputElement>) => { if (event.target.files) addFiles(event.target.files); event.target.value = ''; };
  const onDrop = (event: DragEvent<HTMLElement>) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); };

  return (
    <main className={`player-shell ${dragging ? 'is-dragging' : ''}`} onDragEnter={(e) => { e.preventDefault(); setDragging(true); }} onDragOver={(e) => e.preventDefault()} onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }} onDrop={onDrop}>
      <audio ref={audioRef} src={active?.src} loop={repeat} onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} onEnded={() => { if (!repeat) moveTrack(1); }} />
      <div className="ambient-glow" aria-hidden="true" />

      <header className="topbar glass-panel">
        <div className="brand-lockup"><span className="brand-sigil"><Crown /></span><div><strong>Vesper</strong><small>THE OBSIDIAN ARCHIVE</small></div></div>
        <label className="search-field"><Search aria-hidden="true" /><input aria-label="Search the archive" placeholder="Search the archive…" /><kbd>⌘ K</kbd></label>
        <div className="top-actions"><Button className="import-button" variant="ghost" onClick={() => fileRef.current?.click()}><Upload /> Import audio</Button><button className="profile-button" aria-label="Open profile"><Shield /><ChevronDown /></button></div>
      </header>

      <div className="workspace">
        <aside className="library glass-panel">
          <div className="section-label"><span>Library</span><button aria-label="Add audio" onClick={() => fileRef.current?.click()}><Plus /></button></div>
          <nav className="library-nav" aria-label="Music library">
            <button className="active"><Disc3 /><span>Now playing</span><i>01</i></button>
            <button><Sparkles /><span>Discoveries</span><i>12</i></button>
            <button><Heart /><span>Favourites</span><i>08</i></button>
            <button><ListMusic /><span>Collections</span><i>04</i></button>
          </nav>
          <div className="recent-heading"><span>Recently inscribed</span><button>View all</button></div>
          <div className="mini-library">
            {tracks.slice(0, 4).map((track, index) => <button key={track.id} className={index === activeIndex ? 'active' : ''} onClick={() => setActiveIndex(index)}><span className="mini-cover" style={{ '--tone': track.tone } as React.CSSProperties}><Shield /></span><span><strong>{track.title}</strong><small>{track.artist}</small></span><MoreHorizontal /></button>)}
          </div>
          <button className="drop-card" onClick={() => fileRef.current?.click()}><FileAudio /><span><strong>Open a local manuscript</strong><small>MP3, WAV, M4A or FLAC</small></span></button>
          <input ref={fileRef} className="sr-only" type="file" accept="audio/*" multiple onChange={onFiles} />
        </aside>

        <section className="turntable glass-panel" aria-label="Now playing">
          <div className="turntable-head"><span>NO. {String(activeIndex + 1).padStart(2, '0')}</span><span className="status"><i className={playing ? 'live' : ''} /> {playing ? 'PLAYING' : 'PAUSED'}</span><button aria-label="Expand player"><Maximize2 /></button></div>
          <div className="deck"><div className="record-plinth"><div className={`vinyl ${playing ? 'spinning' : ''}`}><div className="vinyl-grooves" /><div className="record-label" style={{ '--tone': active?.tone } as React.CSSProperties}><Crown /><span>VESPER</span><small>{active?.collection}</small></div></div><div className={`tonearm ${playing ? 'engaged' : ''}`} aria-hidden="true"><i /><span /></div><span className="deck-screw s1" /><span className="deck-screw s2" /><span className="deck-screw s3" /><span className="deck-screw s4" /></div></div>
          <div className="track-title"><p>{active?.collection}</p><h1>{active?.title}</h1><span>{active?.artist}</span></div>
          <div className="transport">
            <div className="time-row"><span>{formatTime(progress)}</span><span>{formatTime(duration)}</span></div>
            <Slider aria-label="Track progress" min={0} max={Math.max(duration, 1)} value={[Math.min(progress, duration || 1)]} onValueChange={(value) => { const next = Array.isArray(value) ? value[0] : value; setProgress(next); if (audioRef.current) audioRef.current.currentTime = next; }} className="progress-slider" />
            <div className="transport-buttons"><Button variant="ghost" size="icon" aria-label="Shuffle"><Shuffle /></Button><Button variant="ghost" size="icon-lg" aria-label="Previous track" onClick={() => moveTrack(-1)}><SkipBack /></Button><Button className="main-play" size="icon-lg" aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlayback}>{playing ? <Pause /> : <Play />}</Button><Button variant="ghost" size="icon-lg" aria-label="Next track" onClick={() => moveTrack(1)}><SkipForward /></Button><Button className={repeat ? 'is-active' : ''} variant="ghost" size="icon" aria-label="Repeat" onClick={() => setRepeat((value) => !value)}><Repeat2 /></Button></div>
          </div>
        </section>

        <aside className="queue glass-panel">
          <div className="queue-header"><div><span>Up next</span><small>{tracks.length} inscriptions</small></div><button><MoreHorizontal /></button></div>
          <div className="queue-list">{queue.map((track) => <button key={track.id} className={track.index === activeIndex ? 'active' : ''} onClick={() => setActiveIndex(track.index)}><span className="queue-index">{track.index === activeIndex && playing ? <i className="equalizer"><b /><b /><b /></i> : String(track.index + 1).padStart(2, '0')}</span><span className="queue-cover" style={{ '--tone': track.tone } as React.CSSProperties}><Shield /></span><span className="queue-copy"><strong>{track.title}</strong><small>{track.artist}</small></span><span className="queue-time">{track.duration ? formatTime(track.duration) : '—'}</span></button>)}</div>
          <div className="sound-panel"><div className="sound-title"><span><Volume2 /> Chamber volume</span><strong>{volume}</strong></div><Slider aria-label="Volume" min={0} max={100} value={[volume]} onValueChange={(value) => setVolume(Array.isArray(value) ? value[0] : value)} className="volume-slider" /><div className="sound-meta"><span>QUIET</span><span>GRAND HALL</span></div></div>
        </aside>
      </div>

      <footer className="statusbar"><span><i /> Local archive ready</span><span>LOSSLESS • 48 kHz</span><span>VSP-01 / BLACK GLASS</span></footer>
      {dragging && <div className="drop-overlay"><FileAudio /><strong>Release to inscribe</strong><span>Your music never leaves this device</span></div>}
    </main>
  );
}
