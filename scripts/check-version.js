#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const FILES = {
    'package.json':   { file: 'package.json',   pattern: /"version":\s*"([\d.]+)"/ },
    'src/script.js':  { file: 'src/script.js',  pattern: /const APP_VERSION\s*=\s*'v([\d.]+)'/ },
    'sw.js':          { file: 'sw.js',           pattern: /const CACHE_NAME\s*=\s*'oshikoyo-v([\d.]+)'/ },
};

let hasError = false;
const versions = {};

for (const [label, { file, pattern }] of Object.entries(FILES)) {
    const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const match = content.match(pattern);
    if (!match) {
        console.error(`ERROR: Version pattern not found in ${label}`);
        hasError = true;
    } else {
        versions[label] = match[1];
    }
}

if (hasError) process.exit(1);

const vals = Object.values(versions);
const allMatch = vals.every(v => v === vals[0]);

if (!allMatch) {
    console.error('Version mismatch detected!');
    const maxLen = Math.max(...Object.keys(versions).map(k => k.length));
    for (const [label, ver] of Object.entries(versions)) {
        const isMismatch = ver !== vals[0];
        console.error(`  ${label.padEnd(maxLen)}  ${ver}${isMismatch ? '   \u2190 MISMATCH' : ''}`);
    }
    console.error('\nRun: npm run bump patch  (or minor/major)');
    process.exit(1);
}

console.log(`Version OK: ${vals[0]} (all 3 files in sync)`);
