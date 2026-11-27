/** Pure playback helpers. The UI keeps the audio element; these only clamp and persist. */

export type PlayerPrefs = {
  volume: number;
  shuffle: boolean;
  repeat: boolean;
  visuals: boolean;
  favorites: string[];
};

export const PREFS_KEY = 'vesper-player-prefs';

export function clampTime(current: number, delta: number, duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const base = Number.isFinite(current) ? current : 0;
  return Math.min(duration, Math.max(0, base + delta));
}

export function clampVolume(volume: number, delta = 0) {
  const base = Number.isFinite(volume) ? volume : 0;
  return Math.min(100, Math.max(0, Math.round(base + delta)));
}

export function clampPage(page: number, pageCount: number) {
  if (pageCount <= 0) return 0;
  return Math.min(Math.max(0, page), pageCount - 1);
}

export function pageForTrack(activePosition: number, pageSize: number) {
  if (activePosition < 0 || pageSize <= 0) return 0;
  return Math.floor(activePosition / pageSize);
}

type FavTrack = { id: string; src: string; favorite?: boolean };

export function favoriteIds(tracks: readonly FavTrack[]) {
  return tracks.filter((track) => track.favorite && !track.src.startsWith('blob:')).map((track) => track.id);
}

export function withFavorites<T extends FavTrack>(tracks: readonly T[], ids: readonly string[] | null | undefined) {
  if (!ids) return tracks as T[];
  const favorite = new Set(ids);
  return tracks.map((track) => (track.src.startsWith('blob:') ? track : { ...track, favorite: favorite.has(track.id) }));
}

export function readPrefs(raw: string | null): Partial<PlayerPrefs> | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== 'object') return null;
    const prefs: Partial<PlayerPrefs> = {};
    if (typeof data.volume === 'number' && Number.isFinite(data.volume)) prefs.volume = clampVolume(data.volume);
    if (typeof data.shuffle === 'boolean') prefs.shuffle = data.shuffle;
    if (typeof data.repeat === 'boolean') prefs.repeat = data.repeat;
    if (typeof data.visuals === 'boolean') prefs.visuals = data.visuals;
    if (Array.isArray(data.favorites) && data.favorites.every((id) => typeof id === 'string')) prefs.favorites = data.favorites;
    return Object.keys(prefs).length ? prefs : null;
  } catch {
    return null;
  }
}

/** Drag-enter and drag-leave both bubble, so a depth count stays true while the pointer is inside. */
export function nextDragDepth(depth: number, event: 'enter' | 'leave' | 'drop') {
  if (event === 'drop') return 0;
  if (event === 'enter') return depth + 1;
  return Math.max(0, depth - 1);
}
