import { readFile } from 'node:fs/promises';
const seeds = JSON.parse(await readFile(new URL('../lib/chart-seeds.json', import.meta.url), 'utf8'));
const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const tracks = [];
for (const [rank, title, artist] of seeds) {
  const track = { id: `chart-${rank}`, title, artist, chartRank: rank, collection: 'Global English · 2026.10.17', src: '', tone: '#a77b18', preview: true, officialUrl: `https://music.apple.com/us/search?term=${encodeURIComponent(title + ' ' + artist)}` };
  try {
    const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(title + ' ' + artist)}&entity=song&country=US&limit=10`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { results } = await response.json();
    const match = results.find(r => normalize(r.trackName).split('feat')[0] === normalize(title) && normalize(r.artistName).includes(normalize(artist.split(' & ')[0])));
    if (match) Object.assign(track, { src: match.previewUrl || '', officialUrl: match.trackViewUrl, artwork: match.artworkUrl100, fullDuration: Math.round(match.trackTimeMillis / 1000) });
  } catch (error) { console.error(`${title}: ${error.message}`); }
  tracks.push(track);
  await new Promise(resolve => setTimeout(resolve, 600));
}
console.log(JSON.stringify(tracks, null, 2));
