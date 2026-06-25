#!/usr/bin/env node
import { context, build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');
const watch = process.argv.includes('--watch');

const entries = {
  content: resolve(root, 'src/content.ts'),
  background: resolve(root, 'src/background.ts'),
  'popup/popup': resolve(root, 'src/popup/popup.ts'),
};

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: entries,
  bundle: true,
  outdir: dist,
  format: 'iife',
  target: ['chrome110'],
  platform: 'browser',
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
  logLevel: 'info',
  legalComments: 'none',
};

async function copyStatic() {
  await cp(resolve(root, 'src/manifest.json'), resolve(dist, 'manifest.json'));
  await mkdir(resolve(dist, 'popup'), { recursive: true });
  await cp(resolve(root, 'src/popup/popup.html'), resolve(dist, 'popup/popup.html'));
  await cp(resolve(root, 'src/popup/popup.css'), resolve(dist, 'popup/popup.css'));
  if (existsSync(resolve(root, 'src/icons'))) {
    await cp(resolve(root, 'src/icons'), resolve(dist, 'icons'), { recursive: true });
  }
}

async function run() {
  if (existsSync(dist)) {
    await rm(dist, { recursive: true, force: true });
  }
  await mkdir(dist, { recursive: true });

  if (watch) {
    const ctx = await context(options);
    await ctx.watch();
    await copyStatic();
    console.log('[build] watching for changes…');
  } else {
    await build(options);
    await copyStatic();
    console.log('[build] done →', dist);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
