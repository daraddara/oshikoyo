// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractCode, loadModule, setupTestEnvironment } from '../tests/test-utils.js';

setupTestEnvironment();

const dbClassCode = extractCode('class LocalImageDB {', 'const localImageDB = new LocalImageDB();');
const helpersCode = extractCode('// Helper: Blob to Base64', '// --- State Persistence');
const { LocalImageDB, base64ToBlob, blobToBase64, areBlobsEqual } = loadModule(
    [dbClassCode, helpersCode],
    ['LocalImageDB', 'base64ToBlob', 'blobToBase64', 'areBlobsEqual']
);

describe('LocalImageDB Import Performance', () => {
    let db;

    beforeEach(async () => {
        db = new LocalImageDB('TestDB_Perf');
        await db.clearAll();
    });

    afterEach(async () => {
        if (db) await db.clearAll();
    });

    it('benchmarks importData for many images', async () => {
        const numImages = 500;
        const images = [];
        for (let i = 0; i < numImages; i++) {
            images.push({
                name: `img${i}.png`,
                type: 'image/png',
                data: 'data:image/png;base64,' + Buffer.from(`dummydata_${i}`).toString('base64'),
                lastModified: Date.now()
            });
        }

        const importPayload = { images };

        const start = performance.now();
        const result = await db.importData(importPayload);
        const end = performance.now();

        console.log(`\n\n=== PERFORMANCE ===\nImporting ${numImages} images took ${(end - start).toFixed(2)} ms`);
        expect(result.added).toBe(numImages);
    }, 60000); // 60s timeout
});
