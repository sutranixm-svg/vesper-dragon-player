import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  root: fromRoot('./'),
  publicDir: fromRoot('../public'),
  base: '/',
  plugins: [react()],
  resolve: { alias: { '@': fromRoot('../') } },
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { outDir: fromRoot('./app/renderer'), emptyOutDir: true },
});
