#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LEVEL = process.argv[2];

if (!['patch', 'minor', 'major'].includes(LEVEL)) {
    console.error('Usage: npm run bump [patch|minor|major]');
    process.exit(1);
}

// Read current version from package.json
const pkgPath = path.join(ROOT, 'package.json');
const pkgContent = fs.readFileSync(pkgPath, 'utf8');
const pkgMatch = pkgContent.match(/"version":\s*"([\d.]+)"/);
if (!pkgMatch) { console.error('ERROR: version field not found in package.json'); process.exit(1); }

const [oldMajor, oldMinor, oldPatch] = pkgMatch[1].split('.').map(Number);

let newMajor = oldMajor, newMinor = oldMinor, newPatch = oldPatch;
if (LEVEL === 'patch') { newPatch++; }
else if (LEVEL === 'minor') { newMinor++; newPatch = 0; }
else if (LEVEL === 'major') { newMajor++; newMinor = 0; newPatch = 0; }

const oldVer = `${oldMajor}.${oldMinor}.${oldPatch}`;
const newVer = `${newMajor}.${newMinor}.${newPatch}`;

// Apply replacements
const updates = [
    {
        label: 'package.json',
        file: pkgPath,
        from: `"version": "${oldVer}"`,
        to:   `"version": "${newVer}"`,
    },
    {
        label: 'src/script.js',
        file: path.join(ROOT, 'src/script.js'),
        from: `const APP_VERSION = 'v${oldVer}'`,
        to:   `const APP_VERSION = 'v${newVer}'`,
    },
    {
        label: 'sw.js',
        file: path.join(ROOT, 'sw.js'),
        from: `const CACHE_NAME = 'oshikoyo-v${oldVer}'`,
        to:   `const CACHE_NAME = 'oshikoyo-v${newVer}'`,
    },
];

for (const { label, file, from, to } of updates) {
    const content = fs.readFileSync(file, 'utf8');
    if (!content.includes(from)) {
        console.error(`ERROR: Expected string not found in ${label}:\n  ${from}`);
        process.exit(1);
    }
    fs.writeFileSync(file, content.replace(from, to), 'utf8');
}

console.log(`Bumped version: ${oldVer} \u2192 ${newVer}`);
console.log(`  package.json     "version": "${newVer}"`);
console.log(`  src/script.js    APP_VERSION = 'v${newVer}'`);
console.log(`  sw.js            CACHE_NAME = 'oshikoyo-v${newVer}'`);
