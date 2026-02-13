/**
 * esbuild configuration for web2figma.
 *
 * Builds both the Chrome Extension and the Figma Plugin.
 *
 * Usage:
 *   node esbuild.config.mjs                     # Build both
 *   node esbuild.config.mjs --target=extension   # Build extension only
 *   node esbuild.config.mjs --target=plugin      # Build plugin only
 *   node esbuild.config.mjs --watch              # Watch mode (both)
 */

import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const target = args.find(a => a.startsWith('--target='))?.split('=')[1] ?? 'all';
const watch = args.includes('--watch');

/** Copy static files to dist */
function copyStatic(src, dest) {
  const destDir = dirname(dest);
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
  if (existsSync(src)) copyFileSync(src, dest);
}

/** Chrome Extension build config */
const extensionConfigs = [
  // Content script (injected into pages — no module, IIFE)
  {
    entryPoints: [resolve(__dirname, 'extension/src/content/extractor.ts')],
    outfile: resolve(__dirname, 'dist/extension/content.js'),
    bundle: true,
    format: 'iife',
    target: 'chrome120',
    platform: 'browser',
    minify: !watch,
  },
  // Service worker (background, ES module)
  {
    entryPoints: [resolve(__dirname, 'extension/src/background/service-worker.ts')],
    outfile: resolve(__dirname, 'dist/extension/service-worker.js'),
    bundle: true,
    format: 'esm',
    target: 'chrome120',
    platform: 'browser',
    minify: !watch,
  },
  // Popup (Preact, ES module)
  {
    entryPoints: [resolve(__dirname, 'extension/src/popup/Popup.tsx')],
    outfile: resolve(__dirname, 'dist/extension/popup/popup.js'),
    bundle: true,
    format: 'esm',
    target: 'chrome120',
    platform: 'browser',
    minify: !watch,
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    jsx: 'transform',
    define: {
      'process.env.NODE_ENV': watch ? '"development"' : '"production"',
    },
  },
];

/** Figma Plugin build config */
const pluginConfigs = [
  // Plugin sandbox (runs in Figma's sandbox — no DOM)
  {
    entryPoints: [resolve(__dirname, 'figma-plugin/src/main.ts')],
    outfile: resolve(__dirname, 'dist/plugin/plugin.js'),
    bundle: true,
    format: 'iife',
    target: 'es2020',
    platform: 'browser',
    minify: !watch,
  },
  // Plugin UI (Preact, loaded in iframe)
  {
    entryPoints: [resolve(__dirname, 'figma-plugin/src/ui/App.tsx')],
    outfile: resolve(__dirname, 'dist/plugin/ui.js'),
    bundle: true,
    format: 'iife',
    target: 'es2020',
    platform: 'browser',
    minify: !watch,
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    jsx: 'transform',
    define: {
      'process.env.NODE_ENV': watch ? '"development"' : '"production"',
    },
  },
];

async function build() {
  const configs = [];
  if (target === 'all' || target === 'extension') configs.push(...extensionConfigs);
  if (target === 'all' || target === 'plugin') configs.push(...pluginConfigs);

  if (watch) {
    const contexts = await Promise.all(configs.map(c => esbuild.context(c)));
    await Promise.all(contexts.map(ctx => ctx.watch()));
    console.log('[web2figma] Watching for changes...');
  } else {
    await Promise.all(configs.map(c => esbuild.build(c)));

    // Copy static files
    if (target === 'all' || target === 'extension') {
      copyStatic(
        resolve(__dirname, 'extension/manifest.json'),
        resolve(__dirname, 'dist/extension/manifest.json')
      );
      copyStatic(
        resolve(__dirname, 'extension/src/popup/index.html'),
        resolve(__dirname, 'dist/extension/popup/index.html')
      );
      copyStatic(
        resolve(__dirname, 'extension/src/popup/styles.css'),
        resolve(__dirname, 'dist/extension/popup/styles.css')
      );
      // Create icons directory placeholder
      const iconsDir = resolve(__dirname, 'dist/extension/icons');
      if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true });
    }

    if (target === 'all' || target === 'plugin') {
      copyStatic(
        resolve(__dirname, 'figma-plugin/manifest.json'),
        resolve(__dirname, 'dist/plugin/manifest.json')
      );
      copyStatic(
        resolve(__dirname, 'figma-plugin/src/ui/index.html'),
        resolve(__dirname, 'dist/plugin/ui.html')
      );
    }

    console.log(`[web2figma] Built: ${target}`);
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
