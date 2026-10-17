'use client';

import {
  Crown, Disc3, FileAudio, Heart, ListMusic,
  Pause, Play, Plus, Repeat2, Search, Shuffle,
  SkipBack, SkipForward, Upload, Volume2,
} from 'lucide-react';
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import chartTracks from '@/lib/chart-tracks.json';
import { ExternalLink, Zap } from 'lucide-react';
import { AudioVisualizer } from '@/components/audio-visualizer';

type Track = { id: string; title: string; artist: string; collection: string; src: string; duration?: number; tone: string; favorite?: boolean; preview?: boolean; chartRank?: number; officialUrl?: string; artwork?: string };

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
  const [tracks, setTracks] = useState<Track[]>([...chartTracks, ...demoTracks]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(72);
  const [repeat, setRepeat] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [query, setQuery] = useState('');
  const [shelf, setShelf] = useState('chart');
  const [shuffle, setShuffle] = useState(false);
  const [error, setError] = useState('');
  const [visuals, setVisuals] = useState(true);
  const [visualError, setVisualError] = useState(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const shouldPlay = useRef(false);
  const objectUrls = useRef<string[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const active = tracks[activeIndex];

  const prepareAudio = async () => {
    if (!audioRef.current) return;
    try {
      if (!audioContextRef.current) {
        const context = new AudioContext(); audioContextRef.current = context;
        const analyser = context.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = .8;
        const source = context.createMediaElementSource(audioRef.current); sourceRef.current = source;
        source.connect(context.destination);
        source.connect(analyser); analyserRef.current = analyser;
      }
      if (audioContextRef.current.state !== 'running') await audioContextRef.current.resume();
      setVisualError(false);
    } catch { setVisualError(true); }
  };
  useEffect(() => () => { sourceRef.current?.disconnect(); analyserRef.current?.disconnect(); void audioContextRef.current?.close(); }, []);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume / 100; }, [volume]);
  useEffect(() => () => objectUrls.current.forEach(url => URL.revokeObjectURL(url)), []);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.load(); setProgress(0); setDuration(0); setError(''); setPlaying(false);
    if (active.src && shouldPlay.current) audio.play().catch(() => { shouldPlay.current = false; setError('请点击播放重试，或打开官方入口'); });
    if (!active.src) shouldPlay.current = false;
  }, [active.id, active.src]);

  const queue = useMemo(() => tracks.map((track, index) => ({ ...track, index })).filter(track =>
    (shelf === 'all' || (shelf === 'chart' && track.preview) || (shelf === 'favorites' && track.favorite) || (shelf === 'local' && !track.preview)) &&
    `${track.title} ${track.artist}`.toLowerCase().includes(query.toLowerCase())
  ), [tracks, shelf, query]);
  const selectTrack = (index: number) => { shouldPlay.current = playing; setActiveIndex(index); };
  const togglePlayback = async () => {
    const audio = audioRef.current; if (!audio || !active.src) return;
    setError('');
    if (playing) { shouldPlay.current = false; audio.pause(); }
    else { try { await prepareAudio(); shouldPlay.current = true; await audio.play(); } catch { shouldPlay.current = false; setError('试听暂不可用，请打开官方入口，或稍后重试'); } }
  };
  const moveTrack = (delta: number, continuePlaying = playing) => {
    const candidates = queue.filter(track => track.src);
    if (!candidates.length) return;
    const current = candidates.findIndex(track => track.index === activeIndex);
    const alternatives = candidates.filter(track => track.index !== activeIndex);
    const next = shuffle && alternatives.length ? alternatives[Math.floor(Math.random() * alternatives.length)] : candidates[(current + delta + candidates.length) % candidates.length];
    shouldPlay.current = continuePlaying;
    if (next.index === activeIndex && audioRef.current) { audioRef.current.currentTime = 0; if (continuePlaying) void audioRef.current.play().catch(() => setError('请点击播放重试')); }
    else setActiveIndex(next.index);
  };
  const addFiles = (files: FileList | File[]) => {
    const audioFiles = Array.from(files).filter((file) => file.type.startsWith('audio/') || /\.(mp3|wav|m4a|flac|ogg|aac)$/i.test(file.name));
    if (!audioFiles.length) { setError('请选择 MP3、WAV、M4A、FLAC 或 OGG 音频'); return; }
    const imported = audioFiles.map((file, index): Track => ({
      id: crypto.randomUUID(), title: file.name.replace(/\.[^/.]+$/, ''), artist: 'Local audio',
      collection: 'Imported archive', src: URL.createObjectURL(file), tone: ['#5f3138', '#3b5054', '#735830'][index % 3],
    }));
    objectUrls.current.push(...imported.map(track => track.src));
    shouldPlay.current = false; audioRef.current?.pause(); setTracks((current) => [...current, ...imported]); setActiveIndex(tracks.length); setPlaying(false); setShelf('local'); setQuery('');
  };
  const onFiles = (event: ChangeEvent<HTMLInputElement>) => { if (event.target.files) addFiles(event.target.files); event.target.value = ''; };
  const onDrop = (event: DragEvent<HTMLElement>) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); };

  return (
    <main className={`player-shell ${dragging ? 'is-dragging' : ''}`} onDragEnter={(e) => { e.preventDefault(); setDragging(true); }} onDragOver={(e) => e.preventDefault()} onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }} onDrop={onDrop}>
      <audio ref={audioRef} crossOrigin="anonymous" src={active.src || undefined} preload="metadata" loop={repeat} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} onError={() => { shouldPlay.current = false; setPlaying(false); setError('此音频暂不可用，请重试或打开官方入口'); }} onEnded={() => { if (!repeat) moveTrack(1, true); }} />
      <img className="cinema-background" src="/bruce-lee-background.png" alt="李小龙黄色运动服武术姿态主题背景" />
      <div className="cinema-shade" aria-hidden="true" />

      <header className="topbar glass-panel">
        <div className="brand-lockup"><span className="brand-sigil"><Zap /></span><div><strong>Vesper</strong><small>THE DRAGON EDITION</small></div></div>
        <label className="search-field"><Search aria-hidden="true" /><input aria-label="搜索歌名或歌手" placeholder="搜索歌名或歌手…" value={query} onChange={e => setQuery(e.target.value)} /><span>20 HITS</span></label>
        <div className="top-actions"><Button className="import-button" variant="ghost" onClick={() => fileRef.current?.click()}><Upload /> 导入音频</Button><span className="edition-tag">李小龙 · 致敬版</span></div>
      </header>
      <div className="edition-heading"><span>黑胶之声 / 龙之精神</span><strong>BE WATER.</strong><span>BRUCE LEE CINEMA TRIBUTE</span></div>
      <div className="workspace">
        <aside className="library glass-panel">
          <div className="section-label"><span>Library</span><button aria-label="Add audio" onClick={() => fileRef.current?.click()}><Plus /></button></div>
          <nav className="library-nav" aria-label="Music library">
            <button className={shelf === 'chart' ? 'active' : ''} onClick={() => setShelf('chart')}><Zap /><span>全球英文热歌</span><i>20</i></button>
            <button className={shelf === 'all' ? 'active' : ''} onClick={() => setShelf('all')}><Disc3 /><span>全部音乐</span><i>{tracks.length}</i></button>
            <button className={shelf === 'favorites' ? 'active' : ''} onClick={() => setShelf('favorites')}><Heart /><span>我的收藏</span><i>{tracks.filter(t => t.favorite).length}</i></button>
            <button className={shelf === 'local' ? 'active' : ''} onClick={() => setShelf('local')}><ListMusic /><span>本地与原创</span><i>{tracks.filter(t => !t.preview).length}</i></button>
          </nav>
          <div className="chart-note"><span>GLOBAL ENGLISH / 20</span><h2>世界在听</h2><p>选自 Billboard Global 200<br />2026 年 10 月 17 日周榜<br />英文曲目精选，按原榜名次排序</p><a href="https://ca.billboard.com/charts/billboard-global-200/2026-10-17" target="_blank" rel="noreferrer">查看榜单来源 <ExternalLink size={11} /></a></div>
          <div className="listening-note">20 首 Apple Music 官方试听<br />完整版请打开官方平台<br />可用性可能因地区而异</div>
          <button className="drop-card" onClick={() => fileRef.current?.click()}><FileAudio /><span><strong>拖入你自己的完整歌曲</strong><small>MP3 · WAV · M4A · FLAC</small></span></button>
          <input ref={fileRef} className="sr-only" type="file" accept="audio/*" multiple onChange={onFiles} />
        </aside>

        <section className="turntable glass-panel" aria-label="Now playing">
          <div className="turntable-head"><span>{active.chartRank ? `GLOBAL #${active.chartRank}` : 'LOCAL RECORD'}</span><span className="status"><i className={playing ? 'live' : ''} /> {playing ? 'PLAYING' : 'PAUSED'}</span><button aria-label="收藏歌曲" aria-pressed={!!active.favorite} onClick={() => setTracks(current => current.map(track => track.id === active.id ? { ...track, favorite: !track.favorite } : track))}><Heart fill={active.favorite ? 'currentColor' : 'none'} /></button></div>
          <div className="deck"><div className="record-plinth"><div className={`vinyl ${playing ? 'spinning' : ''}`}><div className="vinyl-grooves" /><div className="record-label" style={{ '--tone': active?.tone } as React.CSSProperties}><Crown /><span>VESPER</span><small>{active?.collection}</small></div></div><div className={`tonearm ${playing ? 'engaged' : ''}`} aria-hidden="true"><i /><span /></div><span className="deck-screw s1" /><span className="deck-screw s2" /><span className="deck-screw s3" /><span className="deck-screw s4" /></div></div>
          <div className="track-title"><p>{active?.collection}</p><h1>{active?.title}</h1><span>{active?.artist}</span></div>
          <div className="track-links">{active.officialUrl && <a href={active.officialUrl} target="_blank" rel="noreferrer">{active.src ? '在 Apple Music 听完整版' : '在 Apple Music 搜索歌曲'} <ExternalLink size={12} /></a>}{active.preview && <span>{active.src ? '试听片段 · 非完整版' : '暂无试听源'}</span>}</div>
          <div className="transport">
            <div className="visualizer-panel">
              <div className="visualizer-heading"><span>{visualError ? '音频分析暂不可用' : playing && visuals ? 'LIVE WAVE / 实时律动' : 'SOUND IN MOTION'}</span><Button variant="ghost" size="xs" aria-pressed={visuals} onClick={() => setVisuals(value => !value)}>{visuals ? '律动 开' : '律动 关'}</Button></div>
              <AudioVisualizer analyser={analyserRef} playing={playing} enabled={visuals && !visualError} trackId={active.id} />
            </div>
            <div className="time-row"><span>{formatTime(progress)}</span><span>{formatTime(duration)}</span></div>
            <Slider aria-label="Track progress" disabled={!active.src || !duration} min={0} max={Math.max(duration, 1)} value={[Math.min(progress, duration || 1)]} onValueChange={(value) => { const next = Array.isArray(value) ? value[0] : value; if (duration && audioRef.current) { setProgress(next); audioRef.current.currentTime = next; } }} className="progress-slider" />
            <div className="transport-buttons"><Button variant="ghost" size="icon" aria-label="Shuffle" aria-pressed={shuffle} className={shuffle ? 'is-active' : ''} onClick={() => setShuffle(v => !v)}><Shuffle /></Button><Button variant="ghost" size="icon-lg" aria-label="Previous track" onClick={() => moveTrack(-1)}><SkipBack /></Button><Button className="main-play" disabled={!active.src} size="icon-lg" aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlayback}>{playing ? <Pause /> : <Play />}</Button><Button variant="ghost" size="icon-lg" aria-label="Next track" onClick={() => moveTrack(1)}><SkipForward /></Button><Button className={repeat ? 'is-active' : ''} aria-pressed={repeat} variant="ghost" size="icon" aria-label="Repeat" onClick={() => setRepeat((value) => !value)}><Repeat2 /></Button></div>
            <p className="playback-message" role="status">{error}</p>
          </div>
        </section>

        <aside className="queue glass-panel">
          <div className="queue-header"><div><span>{shelf === 'chart' ? 'Global English' : shelf === 'favorites' ? '我的收藏' : shelf === 'local' ? '本地与原创' : '全部音乐'}</span><small>{queue.length} TRACKS · {shelf === 'chart' ? '2026.10.17' : 'YOUR LIBRARY'}</small></div><ListMusic size={17} /></div>
          <div className="queue-list">{queue.map((track) => <button key={track.id} className={track.index === activeIndex ? 'active' : ''} onClick={() => selectTrack(track.index)}><span className="queue-index">{track.index === activeIndex && playing ? <i className="equalizer"><b /><b /><b /></i> : track.chartRank ? `#${track.chartRank}` : '•'}</span><span className="queue-cover" style={{ '--tone': track.tone } as React.CSSProperties}>{track.artwork ? <img src={track.artwork} alt="" loading="lazy" /> : <Disc3 />}</span><span className="queue-copy"><strong>{track.title}</strong><small>{track.artist}</small></span><span className="queue-time">{track.preview ? track.src ? '试听' : '外链' : '本地'}</span></button>)}{!queue.length && <p className="empty-list">{query ? '没有找到匹配歌曲' : '这里还没有歌曲'}</p>}</div>
          <div className="sound-panel"><div className="sound-title"><span><Volume2 /> Chamber volume</span><strong>{volume}</strong></div><Slider aria-label="Volume" min={0} max={100} value={[volume]} onValueChange={(value) => setVolume(Array.isArray(value) ? value[0] : value)} className="volume-slider" /><div className="sound-meta"><span>QUIET</span><span>GRAND HALL</span></div></div>
        </aside>
      </div>

      <footer className="statusbar"><span><i /> {playing ? '正在播放' : '准备就绪'}</span><span>{active.preview ? 'APPLE MUSIC · PREVIEW' : 'LOCAL AUDIO'}</span><span>VSP-02 / DRAGON GLASS</span></footer>
      {dragging && <div className="drop-overlay"><FileAudio /><strong>Release to inscribe</strong><span>Your music never leaves this device</span></div>}
    </main>
  );
}
