import { spawn } from 'node:child_process';
import path from 'node:path';

// Keep build tools on the checkout's volume; Windows profile caches can be redirected.
const env = {
  ...process.env,
  ELECTRON_BUILDER_CACHE: process.env.ELECTRON_BUILDER_CACHE || path.resolve('outputs/electron-builder-cache'),
};
const child = spawn(process.execPath, [
  'node_modules/electron-builder/cli.js', '--config', 'desktop/electron-builder.json',
  '--win', 'nsis', 'portable', '--x64', '--publish', 'never',
], { stdio: 'inherit', env });
child.once('error', error => { console.error(error.message); process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code ?? 1; });
