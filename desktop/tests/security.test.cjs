const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { isAppUrl, resolveAsset, isExternalUrl, byteRange } = require('../app/security.cjs');
const root = path.resolve('test-renderer');
test('only packaged app URLs may navigate inside the window', () => {
  assert.equal(isAppUrl('vesper://app/'), true);
  for (const url of ['https://app/', 'file:///C:/Windows/win.ini', 'vesper://other/', 'vesper://user@app/', 'vesper://app:90/']) assert.equal(isAppUrl(url), false);
});
test('assets resolve inside the packaged renderer', () => {
  assert.equal(resolveAsset(root, 'vesper://app/'), path.join(root, 'index.html'));
  assert.equal(resolveAsset(root, 'vesper://app/audio/test.wav?v=1'), path.join(root, 'audio/test.wav'));
  for (const url of ['vesper://app/%2e%2e%2foutside', 'vesper://app/%5coutside', 'vesper://app/C%3a/test', 'vesper://app/%00', 'vesper://app/%E0%A4%A', 'vesper://other/file']) assert.equal(resolveAsset(root, url), null);
});
test('external navigation accepts only expected HTTPS destinations', () => {
  assert.equal(isExternalUrl('https://music.apple.com/us/album/test'), true);
  assert.equal(isExternalUrl('https://github.com/sutranixm-svg/vesper-dragon-player/releases'), true);
  for (const url of ['file:///C:/test.exe', 'javascript:alert(1)', 'http://music.apple.com/', 'https://music.apple.com.evil.test/', 'https://user@music.apple.com/', 'https://music.apple.com:444/']) assert.equal(isExternalUrl(url), false);
});
test('audio ranges support seeking, suffixes and invalid request rejection', () => {
  assert.deepEqual(byteRange(null, 1000), { start: 0, end: 999, partial: false });
  assert.deepEqual(byteRange('bytes=100-199', 1000), { start: 100, end: 199, partial: true });
  assert.deepEqual(byteRange('bytes=900-', 1000), { start: 900, end: 999, partial: true });
  assert.deepEqual(byteRange('bytes=-100', 1000), { start: 900, end: 999, partial: true });
  assert.deepEqual(byteRange('bytes=0-9999', 1000), { start: 0, end: 999, partial: true });
  for (const value of ['bytes=1000-', 'bytes=-0', 'bytes=-', 'bytes=2-1', 'bytes=0-10,20-30']) assert.equal(byteRange(value, 1000), null);
});
