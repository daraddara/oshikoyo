// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractCode, loadModule, setupTestEnvironment } from './test-utils.js';

// 環境セットアップと基本モック
setupTestEnvironment();

// script.js からロジックを抽出
const mediaUpdateCode = extractCode('function prepareMediaContentLayer', 'function adjustMediaLayout');
const { updateMediaArea } = loadModule([mediaUpdateCode], ['updateMediaArea']);

describe('updateMediaArea ロジック (メディア表示更新)', () => {
    let mockArea, mockContainer, mockMainLayout;

    beforeEach(() => {
        vi.clearAllMocks();

        // DOM 要素のモック作成
        mockArea = { style: {} };
        mockContainer = {
            style: {},
            innerHTML: '',
            querySelector: vi.fn(),
            appendChild: vi.fn()
        };
        mockMainLayout = { classList: { add: vi.fn(), remove: vi.fn() } };

        // document.getElementById の戻り値を定義
        vi.spyOn(document, 'getElementById').mockImplementation((id) => {
            if (id === 'mediaArea') return mockArea;
            if (id === 'mediaContainer') return mockContainer;
            if (id === 'mainLayout') return mockMainLayout;
            return null;
        });

        // グローバル変数の初期化
        global.appSettings = { mediaMode: 'random', mediaPosition: 'right', localImageOrder: [] };
        global.appState = { lastMediaKey: 'key1', mediaHistory: [], mediaHistoryIndex: -1 };
        global.localImageDB = {
            getAllKeys: vi.fn().mockResolvedValue(['key1', 'key2']),
            getImage: vi.fn().mockResolvedValue(new Blob(['test'], { type: 'image/png' }))
        };
        global.currentMediaObjectURL = null;
        global.adjustMediaLayout = vi.fn();
        global.saveState = vi.fn();
        // パススルー（localImageOrder が空なので DB キー順をそのまま返す）
        global.getOrderedImageKeys = (keys) => keys;
        global.getEffectiveImagePool = (keys) => keys; // パススルー（記念日フィルターはPhase3テストで個別検証）
        global.highlightMemorialOshisForImage = vi.fn(); // ハイライト処理はスキップ
    });

    it('mode が "layout" の場合、画像取得は行わずレイアウト調整のみ実行されること', async () => {
        await updateMediaArea('layout');

        expect(global.adjustMediaLayout).toHaveBeenCalled();
        expect(global.localImageDB.getAllKeys).not.toHaveBeenCalled();
    });

    it('mode が "advance"（デフォルト）の場合、画像を取得して表示が更新されること', async () => {
        await updateMediaArea('advance');

        expect(global.adjustMediaLayout).toHaveBeenCalled();
        expect(global.localImageDB.getAllKeys).toHaveBeenCalled();
        expect(global.localImageDB.getImage).toHaveBeenCalled();
    });

    it('mode が "restore" の場合、state に保存されたキーを使用して画像を取得すること', async () => {
        await updateMediaArea('restore');

        expect(global.adjustMediaLayout).toHaveBeenCalled();
        expect(global.localImageDB.getImage).toHaveBeenCalledWith('key1');
    });

    it('画像が存在しない場合、プレースホルダーが表示されること', async () => {
        global.localImageDB.getAllKeys.mockResolvedValue([]);

        await updateMediaArea('advance');

        const contentLayer = mockContainer.appendChild.mock.calls.find(call => call[0].className === 'media-content-layer')[0];
        expect(contentLayer.innerHTML).toContain('media-empty-state');
    });
});

describe('single モード（手動切り替え）の prev/next ナビゲーション', () => {
    let mockArea, mockContainer, mockMainLayout;

    beforeEach(() => {
        vi.clearAllMocks();

        mockArea = { style: {} };
        mockContainer = {
            style: {},
            innerHTML: '',
            querySelector: vi.fn().mockReturnValue(null),
            appendChild: vi.fn()
        };
        mockMainLayout = { classList: { add: vi.fn(), remove: vi.fn() } };

        vi.spyOn(document, 'getElementById').mockImplementation((id) => {
            if (id === 'mediaArea') return mockArea;
            if (id === 'mediaContainer') return mockContainer;
            if (id === 'mainLayout') return mockMainLayout;
            return null;
        });

        global.appSettings = { mediaMode: 'single', mediaPosition: 'right', localImageOrder: [] };
        global.appState = { lastMediaKey: null, mediaHistory: [], mediaHistoryIndex: -1 };
        global.localImageDB = {
            getAllKeys: vi.fn().mockResolvedValue(['key1', 'key2', 'key3']),
            getImage: vi.fn().mockResolvedValue(new Blob(['test'], { type: 'image/png' }))
        };
        global.currentMediaObjectURL = null;
        global.adjustMediaLayout = vi.fn();
        global.getOrderedImageKeys = (keys) => keys;
        global.getEffectiveImagePool = (keys) => keys;
        global.highlightMemorialOshisForImage = vi.fn();
        // single モードの currentCycleIndex は初期値 -1 から始める
        global.currentCycleIndex = -1;
    });

    it('next で最初の画像（index 0）が表示されること', async () => {
        await updateMediaArea('next');
        expect(global.localImageDB.getImage).toHaveBeenCalledWith('key1');
    });

    it('next を2回呼ぶと2番目の画像（index 1）が表示されること', async () => {
        await updateMediaArea('next');
        global.localImageDB.getImage.mockClear();
        await updateMediaArea('next');
        expect(global.localImageDB.getImage).toHaveBeenCalledWith('key2');
    });

    it('prev で前の画像に戻ること', async () => {
        global.currentCycleIndex = 1; // key2 を表示中
        global.appState = { lastMediaKey: 'key2', mediaHistory: [], mediaHistoryIndex: -1 };
        await updateMediaArea('prev');
        expect(global.localImageDB.getImage).toHaveBeenCalledWith('key1');
    });

    it('next が末尾を超えると先頭に戻ること（ループ）', async () => {
        global.currentCycleIndex = 2; // key3（末尾）を表示中
        global.appState = { lastMediaKey: 'key3', mediaHistory: [], mediaHistoryIndex: -1 };
        await updateMediaArea('next');
        expect(global.localImageDB.getImage).toHaveBeenCalledWith('key1');
    });

    it('advance（resetToTodayMedia）で先頭画像に戻ること', async () => {
        global.currentCycleIndex = 2; // key3 を表示中
        global.appState = { lastMediaKey: 'key3', mediaHistory: [], mediaHistoryIndex: -1 };
        await updateMediaArea('advance');
        expect(global.localImageDB.getImage).toHaveBeenCalledWith('key1');
    });
});
