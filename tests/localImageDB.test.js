// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import 'fake-indexeddb/auto'; // Mocks global indexedDB

// Helper to extract code from script.js
const scriptPath = path.resolve(__dirname, '../script.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

function extractCode() {
    // Extract LocalImageDB Class
    const startClass = scriptContent.indexOf('class LocalImageDB {');
    const endClass = scriptContent.indexOf('const localImageDB = new LocalImageDB();');
    if (startClass === -1 || endClass === -1) throw new Error('Could not find LocalImageDB class');
    const classStr = scriptContent.substring(startClass, endClass);

    // Extract base64ToBlob (and blobToBase64 if needed, but importData uses base64ToBlob)
    // We need blobToBase64 for exportData too.
    const startB2B_Helper = scriptContent.indexOf('function blobToBase64(');
    const endB2B_Helper = scriptContent.indexOf('// Helper: Base64 to Blob');
    const blob64Str = scriptContent.substring(startB2B_Helper, endB2B_Helper);

    const startB64Blob = scriptContent.indexOf('function base64ToBlob(');
    const endB64Blob = scriptContent.indexOf('// Helper: Compare Blobs');
    const b64BlobStr = scriptContent.substring(startB64Blob, endB64Blob);

    const startEq = scriptContent.indexOf('async function areBlobsEqual(');
    const endEq = scriptContent.indexOf('// Helper: Hex to RGB');
    const eqStr = scriptContent.substring(startEq, endEq);

    return { classStr, blob64Str, b64BlobStr, eqStr };
}

// Load the classes and functions into a scope
const { classStr, blob64Str, b64BlobStr, eqStr } = extractCode();

// Create a function that defines all these and returns the class
const loadModule = new Function(`
    ${blob64Str}
    ${b64BlobStr}
    ${eqStr}
    ${classStr}
    return { LocalImageDB, base64ToBlob, blobToBase64, areBlobsEqual };
`);

const { LocalImageDB, base64ToBlob, blobToBase64, areBlobsEqual } = loadModule();

// Patch structuredClone to bypass serialization in fake-indexeddb (fixes File -> {} issue)
globalThis.structuredClone = val => val;

// Polyfill ArrayBuffer for jsdom Blob if missing
if (!Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function () {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(this);
        });
    };
}

describe('LocalImageDB System', () => {
    let db;

    beforeEach(async () => {
        db = new LocalImageDB('TestDB_' + Date.now()); // Unique DB per test
    });

    afterEach(async () => {
        if (db) await db.clearAll();
    });

    it('base64ToBlob handles data URI correctly', () => {
        const dataURI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        const blob = base64ToBlob(dataURI, 'image/png');
        expect(blob).toBeDefined();
        expect(blob.type).toBe('image/png');
        expect(blob.size).toBeGreaterThan(0);
    });

    it('areBlobsEqual detects identical blobs', async () => {
        const b1 = new Blob(['hello'], { type: 'text/plain' });
        const b2 = new Blob(['hello'], { type: 'text/plain' });
        const b3 = new Blob(['world'], { type: 'text/plain' });

        expect(await areBlobsEqual(b1, b2)).toBe(true);
        expect(await areBlobsEqual(b1, b3)).toBe(false);
    });

    it('adds and retrieves images', async () => {
        const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
        await db.addImage(file);

        const images = await db.getAllImages();
        expect(images).toHaveLength(1);
        expect(images[0].file.name).toBe('test.txt');
    });

    it('getAllImages returns empty array for empty DB (Fix Check)', async () => {
        // This verifies the fix for the infinite hang bug
        const images = await db.getAllImages();
        expect(images).toEqual([]);
    });

    it('Export and Import Flow', async () => {
        // 1. Setup Initial Data
        const file1 = new File(['image1'], 'img1.png', { type: 'image/png' });
        const file2 = new File(['image2'], 'img2.png', { type: 'image/png' });
        await db.addImage(file1);
        await db.addImage(file2);

        // 2. Export
        const chunks = await db.exportData();
        expect(chunks.length).toBeGreaterThan(0);
        const backupData = chunks[0].data;
        expect(backupData.images).toHaveLength(2);
        expect(backupData.images[0].data).toContain('data:image/png;base64,');

        // 3. Clear DB
        await db.clearAll();
        expect(await db.getAllImages()).toHaveLength(0);

        // 4. Import
        const result = await db.importData(backupData);
        expect(result.added).toBe(2);
        expect(result.skipped).toBe(0);

        const restored = await db.getAllImages();
        expect(restored).toHaveLength(2);
        expect(restored[0].file.name).toBe('img1.png');
    });

    it('Import Deduplication Logic', async () => {
        // 1. Add an image
        const file1 = new File(['duplicate'], 'dup.png', { type: 'image/png' });
        await db.addImage(file1);

        // 2. Mock Import Data containing the SAME image
        // We need to construct data that produces the same blob.
        // base64 of 'duplicate': ZHVwbGljYXRl
        const base64 = 'ZHVwbGljYXRl'; // btoa('duplicate')
        // But base64ToBlob logic might differ slightly, let's use the helper.
        const encoded = await blobToBase64(file1);

        const importPayload = {
            images: [
                {
                    name: 'dup.png', // Same name
                    type: 'image/png',
                    data: encoded, // Same content
                    lastModified: Date.now()
                },
                {
                    name: 'new.png',
                    type: 'image/png',
                    data: 'data:image/plain;base64,' + Buffer.from('new').toString('base64'), // distinct
                    lastModified: Date.now()
                }
            ]
        };

        // 3. Import
        const result = await db.importData(importPayload);

        // Should skip 1, add 1
        expect(result.skipped).toBe(1);
        expect(result.added).toBe(1);

        const all = await db.getAllImages();
        expect(all).toHaveLength(2); // Original + New
    });
});
