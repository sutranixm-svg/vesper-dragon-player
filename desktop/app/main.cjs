const { app, BrowserWindow, Menu, dialog, protocol, session, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { isAppUrl, resolveAsset, isExternalUrl, byteRange } = require('./security.cjs');

const selfTest = process.argv.includes('--vesper-self-test');
if (selfTest) app.setPath('userData', path.join(app.getPath('temp'), 'vesper-self-test'));
app.setAppUserModelId('com.vesper.dragonplayer');
protocol.registerSchemesAsPrivileged([{
  scheme: 'vesper', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}]);
let mainWindow;

async function openExternal(value) {
  if (isExternalUrl(value)) await shell.openExternal(value);
}
async function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'Vesper · 黑胶音乐播放器', width: 1380, height: 960, minWidth: 360, minHeight: 600,
    backgroundColor: '#080808', show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, devTools: !app.isPackaged, backgroundThrottling: !selfTest },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { void openExternal(url); return { action: 'deny' }; });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) { event.preventDefault(); void openExternal(url); }
  });
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
  mainWindow.once('ready-to-show', () => { if (!selfTest) mainWindow.show(); });
  if (selfTest) {
    const { runSelfTest } = require('./self-test.cjs');
    await runSelfTest(mainWindow);
  } else await mainWindow.loadURL('vesper://app/');
}

if (!selfTest && !app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); } });
  app.whenReady().then(async () => {
    const root = path.join(__dirname, 'renderer');
    protocol.handle('vesper', async request => {
      const filename = resolveAsset(root, request.url);
      if (!filename || !['GET', 'HEAD'].includes(request.method)) return new Response('Not found', { status: 404 });
      try {
        const buffer = await fs.readFile(filename);
        const range = byteRange(request.headers.get('range'), buffer.length);
        if (!range) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${buffer.length}` } });
        const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.woff2': 'font/woff2' }[path.extname(filename)] || 'application/octet-stream';
        const headers = { 'Content-Type': mime, 'Content-Length': String(range.end - range.start + 1), 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff' };
        if (range.partial) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${buffer.length}`;
        return new Response(request.method === 'HEAD' ? null : buffer.subarray(range.start, range.end + 1), { status: range.partial ? 206 : 200, headers });
      }
      catch { return new Response('Not found', { status: 404 }); }
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: '文件', submenu: [{ role: 'quit', label: '退出 Vesper' }] },
      { label: '视图', submenu: [{ role: 'resetZoom', label: '实际大小' }, { role: 'zoomIn', label: '放大' }, { role: 'zoomOut', label: '缩小' }, { type: 'separator' }, { role: 'togglefullscreen', label: '全屏' }] },
      { label: '帮助', submenu: [
        { label: '下载更新', click: () => void openExternal('https://github.com/sutranixm-svg/vesper-dragon-player/releases') },
        { label: '关于 Vesper', click: () => void dialog.showMessageBox(mainWindow, { type: 'info', title: 'Vesper', message: `Vesper ${app.getVersion()} · The Dragon Edition`, detail: '本地音频可离线播放；榜单试听需要联网。\n导入的文件不会上传，关闭软件后需重新选择。\nAlt 键显示菜单。' }) },
      ] },
    ]));
    await createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
  }).catch(error => { console.error(error.message); app.exit(1); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
