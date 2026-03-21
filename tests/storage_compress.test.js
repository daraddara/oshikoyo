// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractCode, setupTestEnvironment } from './test-utils.js';

setupTestEnvironment();

const compressionCode = extractCode('// --- Image Compression ---', '// --- Preview Logic ---');

/**
 * Image / Canvas API をモックして compressImageFile・applyImageCompression をロードする。
 * @param {object} mockAppSettings
 * @param {object} imageProps - { naturalWidth, naturalHeight } で Image のモック挙動を指定
 * @param {Blob|null} toBlobResult - canvas.toBlob に渡す Blob（null で失敗テスト）
 */
function makeCompressionModule(mockAppSettings, imageProps = { naturalWidth: 800, naturalHeight: 600 }, toBlobResult = new Blob(['img'], { type: 'image/jpeg' }), mockLocalImageDB = null) {
    const mockCtx = {
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
    };

    let capturedCanvasSize = { width: 0, height: 0 };

    const mockCanvas = {
        get width()  { return capturedCanvasSize.width; },
        set width(v) { capturedCanvasSize.width = v; },
        get height() { return capturedCanvasSize.height; },
        set height(v){ capturedCanvasSize.height = v; },
        getContext: vi.fn(() => mockCtx),
        toBlob: vi.fn((cb) => cb(toBlobResult)),
    };

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'canvas') return mockCanvas;
        return originalCreateElement(tag);
    });

    // Image コンストラクタのモック
    class MockImage {
        constructor() {
            this._src = '';
            this.naturalWidth  = imageProps.naturalWidth;
            this.naturalHeight = imageProps.naturalHeight;
            this.onload  = null;
            this.onerror = null;
        }
        set src(val) {
            this._src = val;
            // 次のマイクロタスクで onload を発火
            Promise.resolve().then(() => { if (this.onload) this.onload(); });
        }
        get src() { return this._src; }
    }

    // URL.createObjectURL / revokeObjectURL をスタブ化
    vi.stubGlobal('URL', {
        ...URL,
        createObjectURL: vi.fn(() => 'blob:mock-url'),
        revokeObjectURL: vi.fn(),
    });

    const code = `
        ${compressionCode}
        return { compressImageFile, applyImageCompression, compressAllExistingImages };
    `;

    const mod = new Function('appSettings', 'Image', 'localImageDB', code)(
        mockAppSettings,
        MockImage,
        mockLocalImageDB
    );

    return { mod, mockCanvas, mockCtx, capturedCanvasSize };
}

// ─── compressImageFile ────────────────────────────────────────────────────────

describe('compressImageFile', () => {
    afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

    it('GIF はそのまま返す（Canvas を使わない）', async () => {
        const { mod, mockCanvas } = makeCompressionModule({ imageCompressMode: 'standard' });
        const gif = new File(['gif'], 'anim.gif', { type: 'image/gif' });
        const result = await mod.compressImageFile(gif, 2560, 0.88);
        expect(result).toBe(gif);
        expect(mockCanvas.getContext).not.toHaveBeenCalled();
    });

    it('PNG → image/jpeg・拡張子 .jpg で返る', async () => {
        const { mod } = makeCompressionModule({ imageCompressMode: 'standard' });
        const png = new File(['png'], 'photo.png', { type: 'image/png' });
        const result = await mod.compressImageFile(png, 2560, 0.88);
        expect(result.type).toBe('image/jpeg');
        expect(result.name).toBe('photo.jpg');
    });

    it('横長画像 4096×2048 を maxDimension 2560 でリサイズ → 2560×1280', async () => {
        const { mod, capturedCanvasSize } = makeCompressionModule(
            { imageCompressMode: 'standard' },
            { naturalWidth: 4096, naturalHeight: 2048 }
        );
        const file = new File(['x'], 'wide.jpg', { type: 'image/jpeg' });
        await mod.compressImageFile(file, 2560, 0.88);
        expect(capturedCanvasSize.width).toBe(2560);
        expect(capturedCanvasSize.height).toBe(1280);
    });

    it('縦長画像 1080×3840 を maxDimension 2560 でリサイズ → 720×2560', async () => {
        const { mod, capturedCanvasSize } = makeCompressionModule(
            { imageCompressMode: 'standard' },
            { naturalWidth: 1080, naturalHeight: 3840 }
        );
        const file = new File(['x'], 'tall.png', { type: 'image/png' });
        await mod.compressImageFile(file, 2560, 0.88);
        expect(capturedCanvasSize.width).toBe(720);
        expect(capturedCanvasSize.height).toBe(2560);
    });

    it('800×600（maxDimension 2560以下）→ リサイズなし・JPEG変換のみ', async () => {
        const { mod, capturedCanvasSize } = makeCompressionModule(
            { imageCompressMode: 'standard' },
            { naturalWidth: 800, naturalHeight: 600 }
        );
        const file = new File(['x'], 'small.png', { type: 'image/png' });
        const result = await mod.compressImageFile(file, 2560, 0.88);
        expect(capturedCanvasSize.width).toBe(800);
        expect(capturedCanvasSize.height).toBe(600);
        expect(result.type).toBe('image/jpeg');
    });

    it('canvas.toBlob が null → reject する', async () => {
        const { mod } = makeCompressionModule(
            { imageCompressMode: 'standard' },
            { naturalWidth: 800, naturalHeight: 600 },
            null // toBlob に null を渡す
        );
        const file = new File(['x'], 'fail.png', { type: 'image/png' });
        await expect(mod.compressImageFile(file, 2560, 0.88)).rejects.toThrow();
    });
});

// ─── applyImageCompression ───────────────────────────────────────────────────

describe('applyImageCompression', () => {
    afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

    it('"off" のとき圧縮なしで元ファイルをそのまま返す', async () => {
        const { mod, mockCanvas } = makeCompressionModule({ imageCompressMode: 'off' });
        const files = [
            new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
            new File(['b'], 'b.png', { type: 'image/png' }),
        ];
        const result = await mod.applyImageCompression(files);
        expect(result).toBe(files); // 同一参照
        expect(mockCanvas.getContext).not.toHaveBeenCalled();
    });

    it('"standard" のとき maxDimension=2560, quality=0.88 で圧縮される', async () => {
        const { mod, mockCanvas } = makeCompressionModule(
            { imageCompressMode: 'standard' },
            { naturalWidth: 800, naturalHeight: 600 }
        );
        const files = [new File(['x'], 'img.png', { type: 'image/png' })];
        const result = await mod.applyImageCompression(files);
        expect(result).toHaveLength(1);
        expect(mockCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.88);
    });

    it('"aggressive" のとき maxDimension=1920, quality=0.78 で圧縮される', async () => {
        const { mod, capturedCanvasSize } = makeCompressionModule(
            { imageCompressMode: 'aggressive' },
            { naturalWidth: 3000, naturalHeight: 2000 }
        );
        const files = [new File(['x'], 'img.png', { type: 'image/png' })];
        await mod.applyImageCompression(files);
        // 長辺 3000 → 1920 にリサイズ
        expect(capturedCanvasSize.width).toBe(1920);
        expect(capturedCanvasSize.height).toBe(1280);
    });

    it('圧縮に失敗した場合は元ファイルでフォールバックされる', async () => {
        const { mod } = makeCompressionModule(
            { imageCompressMode: 'standard' },
            { naturalWidth: 800, naturalHeight: 600 },
            null // toBlob → null → reject
        );
        const original = new File(['x'], 'img.png', { type: 'image/png' });
        const result = await mod.applyImageCompression([original]);
        // エラー時は元ファイルが返る
        expect(result[0]).toBe(original);
    });
});

// ─── compressAllExistingImages ────────────────────────────────────────────────

describe('compressAllExistingImages', () => {
    afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

    it('"off" のとき { compressed: 0, skipped: 0 } を返し updateImage は呼ばれない', async () => {
        const mockDB = {
            getAllImages: vi.fn().mockResolvedValue([]),
            updateImage: vi.fn(),
        };
        const { mod } = makeCompressionModule({ imageCompressMode: 'off' }, undefined, undefined, mockDB);
        const result = await mod.compressAllExistingImages();
        expect(result).toEqual({ compressed: 0, skipped: 0 });
        expect(mockDB.updateImage).not.toHaveBeenCalled();
    });

    it('JPEG×2枚＋GIF×1枚 → { compressed: 2, skipped: 1 }・updateImage が2回呼ばれる', async () => {
        const jpeg1 = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
        const jpeg2 = new File(['b'], 'b.jpg', { type: 'image/jpeg' });
        const gif   = new File(['g'], 'g.gif', { type: 'image/gif' });
        const mockDB = {
            getAllImages: vi.fn().mockResolvedValue([
                { id: 1, file: jpeg1 },
                { id: 2, file: jpeg2 },
                { id: 3, file: gif },
            ]),
            updateImage: vi.fn().mockResolvedValue(undefined),
        };
        const { mod } = makeCompressionModule(
            { imageCompressMode: 'standard' },
            { naturalWidth: 800, naturalHeight: 600 },
            new Blob(['img'], { type: 'image/jpeg' }),
            mockDB
        );
        const result = await mod.compressAllExistingImages();
        expect(result.compressed).toBe(2);
        expect(result.skipped).toBe(1); // GIF はスキップ
        expect(mockDB.updateImage).toHaveBeenCalledTimes(2);
    });

    it('updateImage が例外を投げた場合は skipped にカウントされ処理が継続される', async () => {
        const jpeg1 = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
        const jpeg2 = new File(['b'], 'b.jpg', { type: 'image/jpeg' });
        const mockDB = {
            getAllImages: vi.fn().mockResolvedValue([
                { id: 1, file: jpeg1 },
                { id: 2, file: jpeg2 },
            ]),
            updateImage: vi.fn()
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(new Error('DB write error')),
        };
        const { mod } = makeCompressionModule(
            { imageCompressMode: 'standard' },
            { naturalWidth: 800, naturalHeight: 600 },
            new Blob(['img'], { type: 'image/jpeg' }),
            mockDB
        );
        const result = await mod.compressAllExistingImages();
        expect(result.compressed).toBe(1);
        expect(result.skipped).toBe(1);
    });
});

// ─── updateStorageIndicator ───────────────────────────────────────────────────

const storageIndicatorCode = extractCode('// --- Local Media UI Handlers ---', '\nasync function updateLocalMediaUI');

function makeStorageModule() {
    document.body.innerHTML = `
        <div id="storageIndicatorWrap" hidden>
            <div id="storageIndicatorBar" style="width:0%"></div>
            <p id="storageIndicatorLabel"></p>
        </div>
    `;
    const code = `
        ${storageIndicatorCode}
        return { updateStorageIndicator };
    `;
    return new Function(code)();
}

describe('updateStorageIndicator', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="storageIndicatorWrap" hidden>
                <div id="storageIndicatorBar" style="width:0%"></div>
                <p id="storageIndicatorLabel"></p>
            </div>
        `;
    });
    afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

    it('estimate() 成功 → ラベルに MB 表示・wrap が表示される', async () => {
        vi.stubGlobal('navigator', {
            storage: {
                estimate: vi.fn().mockResolvedValue({ quota: 1073741824, usage: 125829120 }),
            },
        });
        const { updateStorageIndicator } = makeStorageModule();
        await updateStorageIndicator();

        const label = document.getElementById('storageIndicatorLabel');
        const wrap  = document.getElementById('storageIndicatorWrap');
        expect(wrap.hidden).toBe(false);
        expect(label.textContent).toContain('120.0 MB');
        expect(label.textContent).toContain('1024 MB');
    });

    it('navigator.storage が未定義 → wrap は hidden のまま', async () => {
        vi.stubGlobal('navigator', {});
        const { updateStorageIndicator } = makeStorageModule();
        await updateStorageIndicator();
        expect(document.getElementById('storageIndicatorWrap').hidden).toBe(true);
    });

    it('estimate() が reject → wrap は hidden のまま', async () => {
        vi.stubGlobal('navigator', {
            storage: {
                estimate: vi.fn().mockRejectedValue(new Error('denied')),
            },
        });
        const { updateStorageIndicator } = makeStorageModule();
        await updateStorageIndicator();
        expect(document.getElementById('storageIndicatorWrap').hidden).toBe(true);
    });
});
