// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractCode, loadModule, setupTestEnvironment } from './test-utils.js';

// 環境セットアップと基本モック
setupTestEnvironment();

// script.js からロジックを抽出
const mediaUpdateCode = extractCode('async function updateMediaArea', 'function adjustMediaLayout');
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
        global.appSettings = { mediaMode: 'random', mediaPosition: 'right' };
        global.appState = { lastMediaKey: 'key1', mediaHistory: [], mediaHistoryIndex: -1 };
        global.localImageDB = {
            getAllKeys: vi.fn().mockResolvedValue(['key1', 'key2']),
            getImage: vi.fn().mockResolvedValue(new Blob(['test'], { type: 'image/png' }))
        };
        global.currentMediaObjectURL = null;
        global.adjustMediaLayout = vi.fn();
        global.saveState = vi.fn();
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
        expect(contentLayer.innerHTML).toContain('assets/default_image.png');
    });
});
