// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractCode, loadModule, setupTestEnvironment } from './test-utils.js';

// 環境セットアップ (Blob polyfill, fake-indexeddb patch)
setupTestEnvironment();

// script.js からクラスと関数を抽出
const dbClassCode = extractCode('class LocalImageDB {', 'const localImageDB = new LocalImageDB();');
const helpersCode = extractCode('// Helper: Blob to Base64', '// --- State Persistence');
const { LocalImageDB, base64ToBlob, blobToBase64, areBlobsEqual } = loadModule(
    [dbClassCode, helpersCode],
    ['LocalImageDB', 'base64ToBlob', 'blobToBase64', 'areBlobsEqual']
);

describe('LocalImageDB システム', () => {
    let db;

    beforeEach(async () => {
        // テストごとにユニークなデータベース名を使用
        db = new LocalImageDB('TestDB_' + Date.now());
    });

    afterEach(async () => {
        if (db) await db.clearAll();
    });

    it('base64ToBlob が Data URI を正しく処理できること', () => {
        const dataURI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        const blob = base64ToBlob(dataURI, 'image/png');
        expect(blob).toBeDefined();
        expect(blob.type).toBe('image/png');
        expect(blob.size).toBeGreaterThan(0);
    });

    it('areBlobsEqual が同一の Blob を正しく判定できること', async () => {
        const b1 = new Blob(['hello'], { type: 'text/plain' });
        const b2 = new Blob(['hello'], { type: 'text/plain' });
        const b3 = new Blob(['world'], { type: 'text/plain' });

        expect(await areBlobsEqual(b1, b2)).toBe(true);
        expect(await areBlobsEqual(b1, b3)).toBe(false);
    });

    it('画像の追加と取得ができること', async () => {
        const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
        await db.addImage(file);

        const images = await db.getAllImages();
        expect(images).toHaveLength(1);
        expect(images[0].file.name).toBe('test.txt');
    });

    it('空のデータベースで getAllImages が空配列を返すこと', async () => {
        const images = await db.getAllImages();
        expect(images).toEqual([]);
    });

    it('エクスポートとインポートのフローが正しく動作すること', async () => {
        const file1 = new File(['image1'], 'img1.png', { type: 'image/png' });
        const file2 = new File(['image2'], 'img2.png', { type: 'image/png' });
        await db.addImage(file1);
        await db.addImage(file2);

        // エクスポート: gzip blob が1ファイル返される
        const chunks = await db.exportData();
        expect(chunks.length).toBe(1);
        expect(chunks[0].filename).toMatch(/oshikoyo_images_backup_.+\.json\.gz$/);

        // blob を展開して JSON パース
        const arrayBuffer = await chunks[0].blob.arrayBuffer();
        const inputStream = new ReadableStream({
            start(controller) {
                controller.enqueue(new Uint8Array(arrayBuffer));
                controller.close();
            }
        });
        const decompressed = inputStream.pipeThrough(new DecompressionStream('gzip'));
        const text = await new Response(decompressed).text();
        const backupData = JSON.parse(text);
        expect(backupData.version).toBe(2);
        expect(backupData.images).toHaveLength(2);

        // クリア
        await db.clearAll();
        expect(await db.getAllImages()).toHaveLength(0);

        // インポート
        const result = await db.importData(backupData);
        expect(result.added).toBe(2);

        const restored = await db.getAllImages();
        expect(restored).toHaveLength(2);
        expect(restored[0].file.name).toBe('img1.png');
    });

    it('getAllKeys がキーの配列を返すこと', async () => {
        const file1 = new File(['a'], 'a.png', { type: 'image/png' });
        const file2 = new File(['b'], 'b.png', { type: 'image/png' });
        await db.addImage(file1);
        await db.addImage(file2);

        const keys = await db.getAllKeys();
        expect(keys).toHaveLength(2);
        keys.forEach(k => expect(typeof k).toBe('number'));
    });

    it('updateImage が既存レコードを上書き保存できること', async () => {
        const original = new File(['original'], 'img.png', { type: 'image/png' });
        await db.addImage(original);
        const [{ id }] = await db.getAllImages();

        const updated = new File(['updated'], 'img.jpg', { type: 'image/jpeg' });
        await db.updateImage(id, updated);

        const images = await db.getAllImages();
        expect(images).toHaveLength(1);
        expect(images[0].file.name).toBe('img.jpg');
        expect(images[0].file.type).toBe('image/jpeg');
    });

    it('インポート時の重複排除ロジックが動作すること', async () => {
        const file1 = new File(['duplicate'], 'dup.png', { type: 'image/png' });
        await db.addImage(file1);

        const encoded = await blobToBase64(file1);
        const importPayload = {
            images: [
                {
                    name: 'dup.png',
                    type: 'image/png',
                    data: encoded,
                    lastModified: Date.now()
                },
                {
                    name: 'new.png',
                    type: 'image/png',
                    data: 'data:image/plain;base64,' + Buffer.from('new').toString('base64'),
                    lastModified: Date.now()
                }
            ]
        };

        const result = await db.importData(importPayload);
        expect(result.skipped).toBe(1);
        expect(result.added).toBe(1);

        const all = await db.getAllImages();
        expect(all).toHaveLength(2);
    });
});
