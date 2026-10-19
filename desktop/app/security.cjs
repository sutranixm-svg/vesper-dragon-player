const path = require('node:path');

function isAppUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'vesper:' && url.hostname === 'app' && !url.port && !url.username && !url.password;
  } catch { return false; }
}
function resolveAsset(root, value) {
  if (!isAppUrl(value)) return null;
  try {
    const pathname = decodeURIComponent(new URL(value).pathname);
    if (/[\\:\0]/.test(pathname) || pathname.split('/').includes('..')) return null;
    const filename = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    const relative = path.relative(root, filename);
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? filename : null;
  } catch { return null; }
}
function isExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['music.apple.com', 'ca.billboard.com', 'github.com'].includes(url.hostname);
  } catch { return false; }
}
function byteRange(value, size) {
  if (!value) return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start < size && end >= start
    ? { start, end, partial: true } : null;
}
module.exports = { isAppUrl, resolveAsset, isExternalUrl, byteRange };
