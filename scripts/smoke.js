'use strict';

// Worker smoke (design D1): syntax-check every .js under src/ and module-load
// src/server.js. No WhatsApp session or external services needed — a light
// proxy for "the worker boots" in CI.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'src');

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });

const files = walk(srcDir);
for (const file of files) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}
console.log(`[smoke] syntax OK for ${files.length} files`);

require(path.join(srcDir, 'server'));
console.log('[smoke] module graph OK');
process.exit(0);