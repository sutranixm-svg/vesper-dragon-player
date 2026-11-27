import test from 'node:test';
import assert from 'node:assert/strict';
import { clampPage, clampTime, clampVolume, favoriteIds, nextDragDepth, pageForTrack, readPrefs, withFavorites } from '../lib/player-state.ts';

test('seek and volume stay inside the playable range', () => {
  assert.equal(clampTime(10, 5, 30), 15);
  assert.equal(clampTime(2, -5, 30), 0);
  assert.equal(clampTime(28, 5, 30), 30);
  assert.equal(clampTime(Number.NaN, 4, 30), 4);
  assert.equal(clampTime(4, 1, Number.NaN), 0);
  assert.equal(clampVolume(72, 5), 77);
  assert.equal(clampVolume(3, -10), 0);
  assert.equal(clampVolume(98, 10), 100);
  assert.equal(clampVolume(Number.NaN), 0);
});

test('queue page follows the active track and never walks off the end', () => {
  assert.equal(pageForTrack(0, 5), 0);
  assert.equal(pageForTrack(7, 5), 1);
  assert.equal(pageForTrack(-1, 5), 0);
  assert.equal(clampPage(3, 2), 1);
  assert.equal(clampPage(-2, 4), 0);
  assert.equal(clampPage(0, 0), 0);
});

test('catalog favorites round-trip and local blobs stay out of storage', () => {
  const tracks = [
    { id: 'ash', src: '/audio/canticle-of-ash.wav', favorite: true },
    { id: 'chart-2', src: 'https://example.test/preview.m4a', favorite: false },
    { id: 'local', src: 'blob:http://localhost/file', favorite: true },
  ];
  assert.deepEqual(favoriteIds(tracks), ['ash']);
  const cleared = withFavorites(tracks, []);
  assert.equal(cleared[0].favorite, false);
  assert.equal(cleared[1].favorite, false);
  assert.equal(cleared[2].favorite, true);
  const marked = withFavorites(tracks, ['chart-2']);
  assert.equal(marked[0].favorite, false);
  assert.equal(marked[1].favorite, true);
  assert.equal(withFavorites(tracks, null)[0].favorite, true);
});

test('stored preferences ignore corrupt and out-of-range values', () => {
  assert.equal(readPrefs(null), null);
  assert.equal(readPrefs('{'), null);
  assert.equal(readPrefs('[]'), null);
  assert.equal(readPrefs('{"volume":"loud"}'), null);
  const prefs = readPrefs('{"volume":140,"shuffle":true,"repeat":false,"visuals":false,"favorites":["ash",3]}');
  assert.equal(prefs.volume, 100);
  assert.equal(prefs.shuffle, true);
  assert.equal(prefs.repeat, false);
  assert.equal(prefs.visuals, false);
  assert.equal(prefs.favorites, undefined);
});

test('drag depth stays positive while moving across child elements', () => {
  let depth = 0;
  depth = nextDragDepth(depth, 'enter');
  depth = nextDragDepth(depth, 'leave');
  depth = nextDragDepth(depth, 'enter');
  assert.equal(depth, 1);
  depth = nextDragDepth(depth, 'leave');
  depth = nextDragDepth(depth, 'enter');
  assert.equal(depth, 1);
  assert.equal(nextDragDepth(depth, 'drop'), 0);
  assert.equal(nextDragDepth(0, 'leave'), 0);
});
