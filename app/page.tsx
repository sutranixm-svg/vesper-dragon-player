'use client';

import {
  ChevronLeft, ChevronRight, Crown, Disc3, ExternalLink, FileAudio, Heart, ListMusic,
  Pause, Play, Plus, Repeat2, Search, Shuffle, SkipBack, SkipForward, Upload, Volume2, Zap,
} from 'lucide-react';
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { AudioVisualizer } from '@/components/audio-visualizer';
import chartTracks from '@/lib/chart-tracks.json';
import {
  PREFS_KEY, clampPage, clampTime, clampVolume, favoriteIds, nextDragDepth, pageForTrack, readPrefs, withFavorites,
} from '@/lib/player-state';

type Track = {
  id: string; title: string; artist: string; collection: string; src: string; duration?: number;
  tone: string; favorite?: boolean; preview?: boolean; chartRank?: number; officialUrl?: string; artwork?: string;
};

const demoTracks: Track[] = [
  { id: 'ash', title: 'Canticle of Ash', artist: 'The Hollow Choir', collection: 'Reliquary I', src: '/audio/canticle-of-ash.wav', tone: '#7e2732', favorite: true },
  { id: 'vespers', title: 'Vespers at Blackmere', artist: 'Aveline', collection: 'Nocturnes', src: '/audio/vespers-at-blackmere.wav', tone: '#3d4f50' },
  { id: 'rose', title: 'The Last Rose of Rouen', artist: 'Morrow & Vale', collection: 'Reliquary II', src: '/audio/last-rose-of-rouen.wav', tone: '#6e4d26' },
];

const QUEUE_PAGE_SIZE = 5;
const RESTART_THRESHOLD = 3;

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
};

const sliderNumber = (value: number | readonly number[]) => (Array.isArray(value) ? value[0] : value);

const catalogTracks = () => [...chartTracks, ...demoTracks] as Track[];

const subscribePrefs = (onStoreChange: () => void) => {
  window.addEventListener('storage', onStoreChange);
  return () => window.removeEventListener('storage', onStoreChange);
};
const readPrefsSnapshot = () => {
  try { return localStorage.getItem(PREFS_KEY) ?? ''; } catch { return ''; }
};
const emptyPrefsSnapshot = () => '';

export default function Home() {
  const prefsRaw = useSyncExternalStore(subscribePrefs, readPrefsSnapshot, emptyPrefsSnapshot);
  const storedPrefs = useMemo(() => readPrefs(prefsRaw || null), [prefsRaw]);
  const [imported, setImported] = useState<Track[]>([]);
  const [volumeOverride, setVolumeOverride] = useState<number | null>(null);
  const [repeatOverride, setRepeatOverride] = useState<boolean | null>(null);
  const [shuffleOverride, setShuffleOverride] = useState<boolean | null>(null);
  const [visualsOverride, setVisualsOverride] = useState<boolean | null>(null);
  const [favoriteOverride, setFavoriteOverride] = useState<string[] | null>(null);
  const volume = volumeOverride ?? storedPrefs?.volume ?? 72;
  const repeat = repeatOverride ?? storedPrefs?.repeat ?? false;
  const shuffle = shuffleOverride ?? storedPrefs?.shuffle ?? false;
  const visuals = visualsOverride ?? storedPrefs?.visuals ?? true;
  const tracks = useMemo(
    () => [...withFavorites(catalogTracks(), favoriteOverride ?? storedPrefs?.favorites), ...imported],
    [favoriteOverride, storedPrefs, imported],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [query, setQuery] = useState('');
  const [shelf, setShelf] = useState('chart');
  const [queuePage, setQueuePage] = useState(0);
  const [error, setError] = useState('');
  const [visualError, setVisualError] = useState(false);
  const [audioRunning, setAudioRunning] = useState(false);
  const [analysisReset, setAnalysisReset] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const shouldPlay = useRef(false);
  const playGeneration = useRef(0);
  const objectUrls = useRef<string[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrubbing = useRef(false);
  const dragDepth = useRef(0);
  const dragFrame = useRef(0);
  const unmutedVolume = useRef(72);
  const positionSecond = useRef(-1);
  const active = tracks[activeIndex] ?? tracks[0];

  const prepareAudio = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (!audioContextRef.current) {
        const context = new AudioContext({ latencyHint: 'interactive' });
        audioContextRef.current = context;
        const analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.12;
        analyser.minDecibels = -90;
        analyser.maxDecibels = -10;
        const gain = context.createGain();
        gain.gain.value = volume / 100;
        gainRef.current = gain;
        const source = context.createMediaElementSource(audio);
        sourceRef.current = source;
        source.connect(analyser);
        analyser.connect(gain);
        gain.connect(context.destination);
        analyserRef.current = analyser;
        audio.volume = 1;
      }
      if (audioContextRef.current.state !== 'running') await audioContextRef.current.resume();
      setVisualError(false);
    } catch {
      setVisualError(true);
    }
  };

  useEffect(() => () => {
    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    gainRef.current?.disconnect();
    void audioContextRef.current?.close();
    cancelAnimationFrame(dragFrame.current);
  }, []);

  useEffect(() => {
    if (gainRef.current && audioContextRef.current) {
      gainRef.current.gain.setTargetAtTime(volume / 100, audioContextRef.current.currentTime, 0.025);
    } else if (audioRef.current) audioRef.current.volume = volume / 100;
    if (volume > 0) unmutedVolume.current = volume;
  }, [volume]);

  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const prefsTouched = volumeOverride != null || shuffleOverride != null || repeatOverride != null || visualsOverride != null || favoriteOverride != null;
  useEffect(() => {
    if (!prefsTouched) return;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        volume,
        shuffle,
        repeat,
        visuals,
        favorites: favoriteOverride ?? storedPrefs?.favorites ?? favoriteIds(catalogTracks()),
      }));
    } catch { /* private mode and full storage can refuse the write */ }
  }, [prefsTouched, volume, shuffle, repeat, visuals, favoriteOverride, storedPrefs]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const generation = ++playGeneration.current;
    audio.load();
    setProgress(0);
    setDuration(0);
    setError('');
    setPlaying(false);
    setAudioRunning(false);
    positionSecond.current = -1;
    if (!active?.src) { shouldPlay.current = false; return; }
    if (!shouldPlay.current) return;
    void audioContextRef.current?.resume();
    audio.play().then(() => {
      if (generation !== playGeneration.current || !shouldPlay.current) audio.pause();
    }).catch(() => {
      if (generation !== playGeneration.current) return;
      shouldPlay.current = false;
      setError('请点击播放重试，或打开官方入口');
    });
    return () => { playGeneration.current += 1; };
  }, [active?.id, active?.src]);

  const queue = useMemo(() => tracks.map((track, index) => ({ ...track, index })).filter((track) =>
    (shelf === 'all' || (shelf === 'chart' && track.preview) || (shelf === 'favorites' && track.favorite) || (shelf === 'local' && !track.preview))
    && `${track.title} ${track.artist}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [tracks, shelf, query]);
  const queuePageCount = Math.max(1, Math.ceil(queue.length / QUEUE_PAGE_SIZE));
  const visibleQueue = queue.slice(queuePage * QUEUE_PAGE_SIZE, (queuePage + 1) * QUEUE_PAGE_SIZE);
  const activeQueuePosition = queue.findIndex((track) => track.index === activeIndex);

  useEffect(() => {
    setQueuePage((page) => clampPage(page, queuePageCount));
  }, [queuePageCount]);

  // Follow the playing track when the shelf, search, or track changes.
  // Favorite toggles keep the page the listener is browsing.
  useEffect(() => {
    setQueuePage(pageForTrack(activeQueuePosition, QUEUE_PAGE_SIZE));
  }, [activeQueuePosition, shelf, query]);

  const seekTo = (time: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const next = clampTime(time, 0, audio.duration);
    audio.currentTime = next;
    setProgress(next);
  };

  const moveTrack = (delta: number, continuePlaying = playing || shouldPlay.current) => {
    const candidates = queue.filter((track) => track.src);
    if (!candidates.length) return;
    const current = candidates.findIndex((track) => track.index === activeIndex);
    const alternatives = candidates.filter((track) => track.index !== activeIndex);
    const next = shuffle && alternatives.length
      ? alternatives[Math.floor(Math.random() * alternatives.length)]
      : candidates[(current + delta + candidates.length) % candidates.length];
    shouldPlay.current = continuePlaying;
    if (next.index === activeIndex && audioRef.current) {
      audioRef.current.currentTime = 0;
      setProgress(0);
      if (continuePlaying) {
        void audioRef.current.play().catch(() => setError('请点击播放重试'));
      }
    } else setActiveIndex(next.index);
  };

  const previousTrack = () => {
    const audio = audioRef.current;
    if (!shuffle && audio && Number.isFinite(audio.currentTime) && audio.currentTime > RESTART_THRESHOLD) {
      audio.currentTime = 0;
      setProgress(0);
      return;
    }
    moveTrack(-1);
  };

  const pausePlayback = () => {
    playGeneration.current += 1;
    shouldPlay.current = false;
    audioRef.current?.pause();
  };

  const startPlayback = async () => {
    const audio = audioRef.current;
    if (!audio || !active?.src || shouldPlay.current) return;
    const generation = ++playGeneration.current;
    shouldPlay.current = true;
    setError('');
    try {
      await prepareAudio();
      if (generation !== playGeneration.current || !shouldPlay.current) return;
      await audio.play();
      if (generation !== playGeneration.current || !shouldPlay.current) audio.pause();
    } catch {
      if (generation !== playGeneration.current) return;
      shouldPlay.current = false;
      setError('试听暂不可用，请打开官方入口，或稍后重试');
    }
  };

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || !active?.src) return;
    if (shouldPlay.current || (!audio.paused && !audio.ended)) pausePlayback();
    else await startPlayback();
  };

  const nudgeVolume = (delta: number) => setVolumeOverride(clampVolume(volume, delta));
  const toggleMute = () => {
    if (volume > 0) { unmutedVolume.current = volume; setVolumeOverride(0); }
    else setVolumeOverride(unmutedVolume.current || 72);
  };

  const controls = useRef({
    toggle: async () => {},
    play: async () => {},
    pause: () => {},
    seekBy: (_delta: number) => {},
    seekTo: (_time: number) => {},
    nudgeVolume: (_delta: number) => {},
    toggleMute: () => {},
    previous: () => {},
    next: () => {},
  });
  useEffect(() => {
    controls.current = {
      toggle: togglePlayback,
      play: startPlayback,
      pause: pausePlayback,
      seekBy: (delta: number) => seekTo((audioRef.current?.currentTime ?? 0) + delta),
      seekTo,
      nudgeVolume,
      toggleMute,
      previous: previousTrack,
      next: () => moveTrack(1),
    };
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const sliderFocused = !!target?.closest('[data-slot="slider"], [role="slider"]');
      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        void controls.current.toggle();
        return;
      }
      if (sliderFocused && event.key.startsWith('Arrow')) return;
      if (event.key === 'ArrowRight' && event.shiftKey) { event.preventDefault(); controls.current.next(); }
      else if (event.key === 'ArrowLeft' && event.shiftKey) { event.preventDefault(); controls.current.previous(); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); controls.current.seekBy(5); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); controls.current.seekBy(-5); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); controls.current.nudgeVolume(5); }
      else if (event.key === 'ArrowDown') { event.preventDefault(); controls.current.nudgeVolume(-5); }
      else if (event.key === 'm' || event.key === 'M') { event.preventDefault(); controls.current.toggleMute(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !active) return;
    const artwork = active.artwork ? [{ src: active.artwork, sizes: '100x100', type: 'image/jpeg' }] : [];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: active.title, artist: active.artist, album: active.collection, artwork,
    });
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    const bind = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* this action is not supported here */ }
    };
    bind('play', () => { void controls.current.play(); });
    bind('pause', () => controls.current.pause());
    bind('previoustrack', () => controls.current.previous());
    bind('nexttrack', () => controls.current.next());
    bind('seekbackward', () => controls.current.seekBy(-5));
    bind('seekforward', () => controls.current.seekBy(5));
    bind('seekto', (details) => { if (details.seekTime != null) controls.current.seekTo(details.seekTime); });
    bind('stop', () => controls.current.pause());
  }, [active, playing]);

  const selectTrack = (index: number) => {
    shouldPlay.current = playing || shouldPlay.current;
    setActiveIndex(index);
  };

  const addFiles = (files: FileList | File[]) => {
    const audioFiles = Array.from(files).filter((file) => file.type.startsWith('audio/') || /\.(mp3|wav|m4a|flac|ogg|aac)$/i.test(file.name));
    if (!audioFiles.length) { setError('请选择 MP3、WAV、M4A、FLAC 或 OGG 音频'); return; }
    const added = audioFiles.map((file, index): Track => ({
      id: crypto.randomUUID(),
      title: file.name.replace(/\.[^/.]+$/, ''),
      artist: 'Local audio',
      collection: 'Imported archive',
      src: URL.createObjectURL(file),
      tone: ['#5f3138', '#3b5054', '#735830'][index % 3],
    }));
    objectUrls.current.push(...added.map((track) => track.src));
    shouldPlay.current = false;
    playGeneration.current += 1;
    audioRef.current?.pause();
    setPlaying(false);
    setShelf('local');
    setQuery('');
    setActiveIndex(catalogTracks().length + imported.length);
    setImported((current) => [...current, ...added]);
  };

  const onFiles = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = '';
  };

  const syncDrag = () => {
    cancelAnimationFrame(dragFrame.current);
    dragFrame.current = requestAnimationFrame(() => setDragging(dragDepth.current > 0));
  };
  const onDragEnter = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    dragDepth.current = nextDragDepth(dragDepth.current, 'enter');
    syncDrag();
  };
  const onDragLeave = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    dragDepth.current = nextDragDepth(dragDepth.current, 'leave');
    syncDrag();
  };
  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    dragDepth.current = nextDragDepth(dragDepth.current, 'drop');
    syncDrag();
    addFiles(event.dataTransfer.files);
  };

  const publishPosition = (audio: HTMLAudioElement) => {
    if (!('mediaSession' in navigator) || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const second = Math.floor(audio.currentTime);
    if (second === positionSecond.current) return;
    positionSecond.current = second;
    try {
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        playbackRate: audio.playbackRate || 1,
        position: Math.min(Math.max(0, audio.currentTime), audio.duration),
      });
    } catch { /* a seek can briefly report a position the browser rejects */ }
  };

  const emptyCopy = query.trim()
    ? '没有找到匹配歌曲'
    : shelf === 'favorites'
      ? '还没有收藏。点唱盘旁的心形，把一首歌留在这里。'
      : '这里还没有歌曲';

  return (
    <main
      className={`player-shell ${dragging ? 'is-dragging' : ''}`}
      onDragEnter={onDragEnter}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        src={active?.src || undefined}
        preload="metadata"
        loop={repeat}
        onPlay={() => setPlaying(true)}
        onPlaying={() => setAudioRunning(true)}
        onWaiting={() => setAudioRunning(false)}
        onSeeking={() => { if (!scrubbing.current) setAudioRunning(false); }}
        onSeeked={(event) => {
          if (!scrubbing.current) {
            setAnalysisReset((value) => value + 1);
            setAudioRunning(!event.currentTarget.paused && event.currentTarget.readyState >= 3);
          }
          publishPosition(event.currentTarget);
        }}
        onPause={() => { setPlaying(false); setAudioRunning(false); }}
        onTimeUpdate={(event) => {
          if (!scrubbing.current) setProgress(event.currentTarget.currentTime);
          publishPosition(event.currentTarget);
        }}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onError={() => {
          shouldPlay.current = false;
          setPlaying(false);
          setAudioRunning(false);
          setError('此音频暂不可用，请重试或打开官方入口');
        }}
        onEnded={() => { setAudioRunning(false); if (!repeat) moveTrack(1, true); }}
      />
      <img className="cinema-background" src="/bruce-lee-background.png" alt="李小龙黄色运动服武术姿态主题背景" />
      <div className="cinema-shade" aria-hidden="true" />
      <div className="film-grain" aria-hidden="true" />
      <div className="film-vignette" aria-hidden="true" />

      <header className="topbar glass-panel">
        <div className="brand-lockup"><span className="brand-sigil"><Zap /></span><div><strong>Vesper</strong><small>THE DRAGON EDITION</small></div></div>
        <label className="search-field">
          <Search aria-hidden="true" />
          <input aria-label="搜索歌名或歌手" placeholder="搜索歌名或歌手…" value={query} onChange={(event) => setQuery(event.target.value)} />
          <span>{query.trim() ? `${queue.length} HITS` : '20 HITS'}</span>
        </label>
        <div className="top-actions">
          <Button className="import-button" variant="ghost" onClick={() => fileRef.current?.click()}><Upload /> 导入音频</Button>
          <span className="edition-tag">李小龙 · 致敬版</span>
        </div>
      </header>
      <div className="edition-heading"><span>黑胶之声 / 龙之精神</span><strong>BE WATER.</strong><span>BRUCE LEE CINEMA TRIBUTE</span></div>
      <div className="workspace">
        <aside className="library glass-panel">
          <div className="section-label"><span>Library</span><button aria-label="Add audio" onClick={() => fileRef.current?.click()}><Plus /></button></div>
          <nav className="library-nav" aria-label="Music library">
            <button className={shelf === 'chart' ? 'active' : ''} onClick={() => setShelf('chart')}><Zap /><span>全球英文热歌</span><i>20</i></button>
            <button className={shelf === 'all' ? 'active' : ''} onClick={() => setShelf('all')}><Disc3 /><span>全部音乐</span><i>{tracks.length}</i></button>
            <button className={shelf === 'favorites' ? 'active' : ''} onClick={() => setShelf('favorites')}><Heart /><span>我的收藏</span><i>{tracks.filter((track) => track.favorite).length}</i></button>
            <button className={shelf === 'local' ? 'active' : ''} onClick={() => setShelf('local')}><ListMusic /><span>本地与原创</span><i>{tracks.filter((track) => !track.preview).length}</i></button>
          </nav>
          <div className="chart-note"><span>GLOBAL ENGLISH / 20</span><h2>世界在听</h2><p>选自 Billboard Global 200<br />2026 年 10 月 17 日周榜<br />英文曲目精选，按原榜名次排序</p><a href="https://ca.billboard.com/charts/billboard-global-200/2026-10-17" target="_blank" rel="noreferrer">查看榜单来源 <ExternalLink size={11} /></a></div>
          <div className="listening-note">20 首 Apple Music 官方试听<br />完整版请打开官方平台<br />可用性可能因地区而异</div>
          <button className="drop-card" onClick={() => fileRef.current?.click()}><FileAudio /><span><strong>拖入你自己的完整歌曲</strong><small>MP3 · WAV · M4A · FLAC</small></span></button>
          <input ref={fileRef} className="sr-only" type="file" accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg,.aac" multiple onChange={onFiles} />
        </aside>

        <section className="turntable glass-panel" aria-label="Now playing">
          <div className="turntable-head">
            <span>{active?.chartRank ? `GLOBAL #${active.chartRank}` : 'LOCAL RECORD'}</span>
            <span className="status"><i className={playing ? 'live' : ''} /> {playing ? 'PLAYING' : 'PAUSED'}</span>
            <button aria-label="收藏歌曲" aria-pressed={!!active?.favorite} onClick={() => {
              if (!active) return;
              const next = tracks.map((track) => track.id === active.id ? { ...track, favorite: !track.favorite } : track);
              if (active.src.startsWith('blob:')) setImported(next.filter((track) => track.src.startsWith('blob:')));
              else setFavoriteOverride(favoriteIds(next));
            }}><Heart fill={active?.favorite ? 'currentColor' : 'none'} /></button>
          </div>
          <div className="deck">
            <button type="button" className="record-plinth" aria-label={playing ? '暂停唱盘' : '播放唱盘'} onClick={() => void togglePlayback()}>
              <div className={`vinyl ${audioRunning ? 'spinning' : ''}`}><div className="vinyl-grooves" /><div className="record-label" style={{ '--tone': active?.tone } as React.CSSProperties}><Crown /><span>VESPER</span><small>{active?.collection}</small></div></div>
              <div className={`tonearm ${playing ? 'engaged' : ''}`} aria-hidden="true"><i /><span /></div>
              <span className="deck-screw s1" /><span className="deck-screw s2" /><span className="deck-screw s3" /><span className="deck-screw s4" />
            </button>
          </div>
          <div className="now-playing-copy">
            <div className="track-title"><p>{active?.collection}</p><h1>{active?.title}</h1><span>{active?.artist}</span></div>
            <div className="track-links">
              {active?.officialUrl && <a href={active.officialUrl} target="_blank" rel="noreferrer">{active.src ? '在 Apple Music 听完整版' : '在 Apple Music 搜索歌曲'} <ExternalLink size={12} /></a>}
              {active?.preview && <span>{active.src ? '试听片段 · 非完整版' : '暂无试听源'}</span>}
            </div>
          </div>
          <div className="transport">
            <div className="visualizer-panel">
              <div className="visualizer-heading">
                <span>{visualError ? '音频分析暂不可用' : audioRunning && visuals ? 'LIVE / 音频驱动' : playing ? '等待音频信号' : 'SOUND IN MOTION'}</span>
                <Button variant="ghost" size="xs" aria-pressed={visuals} onClick={() => setVisualsOverride(!visuals)}>{visuals ? '律动 开' : '律动 关'}</Button>
              </div>
              <AudioVisualizer analyser={analyserRef} playing={audioRunning} enabled={visuals && !visualError} trackId={active?.id ?? ''} resetKey={analysisReset} />
              <div className="visualizer-legend"><span>频谱 · 实时声波</span><span><i /> 低频重拍</span></div>
            </div>
            <div className="time-row"><span>{formatTime(progress)}</span><span>{formatTime(duration)}</span></div>
            <Slider
              aria-label="Track progress"
              disabled={!active?.src || !duration}
              min={0}
              max={Math.max(duration, 1)}
              value={[Math.min(progress, duration || 1)]}
              onValueChange={(value) => {
                scrubbing.current = true;
                const next = sliderNumber(value);
                setProgress(next);
                const audio = audioRef.current;
                if (audio && Number.isFinite(audio.duration)) audio.currentTime = next;
              }}
              onValueCommitted={() => {
                scrubbing.current = false;
                const audio = audioRef.current;
                if (audio) setAudioRunning(!audio.paused && audio.readyState >= 3);
                setAnalysisReset((value) => value + 1);
              }}
              className="progress-slider"
            />
            <div className="transport-buttons">
              <Button variant="ghost" size="icon" aria-label="Shuffle" aria-pressed={shuffle} className={shuffle ? 'is-active' : ''} onClick={() => setShuffleOverride(!shuffle)}><Shuffle /></Button>
              <Button variant="ghost" size="icon-lg" aria-label="Previous track" onClick={previousTrack}><SkipBack /></Button>
              <Button className="main-play" disabled={!active?.src} size="icon-lg" aria-keyshortcuts="Space" aria-label={playing ? 'Pause' : 'Play'} onClick={() => void togglePlayback()}>{playing ? <Pause /> : <Play />}</Button>
              <Button variant="ghost" size="icon-lg" aria-label="Next track" onClick={() => moveTrack(1)}><SkipForward /></Button>
              <Button className={repeat ? 'is-active' : ''} aria-pressed={repeat} variant="ghost" size="icon" aria-label="Repeat" onClick={() => setRepeatOverride(!repeat)}><Repeat2 /></Button>
            </div>
            <div className="transport-volume">
              <Volume2 aria-hidden="true" />
              <Slider aria-label="Volume" min={0} max={100} value={[volume]} onValueChange={(value) => setVolumeOverride(clampVolume(sliderNumber(value)))} className="volume-slider" />
              <strong>{volume}</strong>
            </div>
            <p className="playback-message" role="status">{error}</p>
          </div>
        </section>

        <aside className="queue glass-panel">
          <div className="queue-header">
            <div>
              <span>{shelf === 'chart' ? 'Global English' : shelf === 'favorites' ? '我的收藏' : shelf === 'local' ? '本地与原创' : '全部音乐'}</span>
              <small>{queue.length} TRACKS · {shelf === 'chart' ? '2026.10.17' : 'YOUR LIBRARY'}</small>
            </div>
            <ListMusic size={17} />
          </div>
          <div className="queue-list">
            {visibleQueue.map((track) => (
              <button key={track.id} className={track.index === activeIndex ? 'active' : ''} onClick={() => selectTrack(track.index)}>
                <span className="queue-index">{track.index === activeIndex && playing ? <span className="now-playing-dot" aria-label="正在播放" /> : track.chartRank ? `#${track.chartRank}` : '•'}</span>
                <span className="queue-cover" style={{ '--tone': track.tone } as React.CSSProperties}>{track.artwork ? <img src={track.artwork} alt="" loading="lazy" /> : <Disc3 />}</span>
                <span className="queue-copy"><strong>{track.title}</strong><small>{track.artist}</small></span>
                <span className="queue-time">{track.preview ? track.src ? '试听' : '外链' : '本地'}</span>
              </button>
            ))}
            {!queue.length && <p className="empty-list">{emptyCopy}</p>}
          </div>
          {queue.length > QUEUE_PAGE_SIZE && (
            <div className="queue-pager" aria-label="歌单分页">
              <button aria-label="上一页" disabled={queuePage === 0} onClick={() => setQueuePage((page) => Math.max(0, page - 1))}><ChevronLeft /></button>
              <span><strong>{queuePage + 1}</strong> / {queuePageCount}</span>
              <button aria-label="下一页" disabled={queuePage >= queuePageCount - 1} onClick={() => setQueuePage((page) => Math.min(queuePageCount - 1, page + 1))}><ChevronRight /></button>
            </div>
          )}
          <div className="sound-panel">
            <div className="sound-title"><span><Volume2 /> Chamber volume</span><strong>{volume}</strong></div>
            <Slider aria-label="Volume" min={0} max={100} value={[volume]} onValueChange={(value) => setVolumeOverride(clampVolume(sliderNumber(value)))} className="volume-slider" />
            <div className="sound-meta"><span>QUIET</span><span>GRAND HALL</span></div>
          </div>
        </aside>
      </div>

      <footer className="statusbar"><span><i /> {playing ? '正在播放' : '准备就绪'}</span><span>{active?.preview ? 'APPLE MUSIC · PREVIEW' : 'LOCAL AUDIO'}</span><span>VSP-02 / DRAGON GLASS</span></footer>
      {dragging && <div className="drop-overlay"><FileAudio /><strong>Release to inscribe</strong><span>Your music never leaves this device</span></div>}
    </main>
  );
}
