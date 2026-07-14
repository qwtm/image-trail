#!/usr/bin/env node

import { build } from 'esbuild';

await build({
  entryPoints: ['extension/src/destinations/destination-page.tsx'],
  outfile: 'extension/dist/src/destinations/destination-page.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
});
