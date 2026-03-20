/**
 * @jest-environment jsdom
 *
 * エクスポート関数のテスト
 * - handleExportImages: 画像データのダウンロード（バグ再発防止）
 * - handleExportSettings: 設定データのダウンロード
 * - handleOshiExport: 推しリストのダウンロード
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractCode, setupTestEnvironment } from './test-utils.js';

setupTestEnvironment();

// --- コード抽出 ---
const exportImagesCode = extractCode(
    'async function handleExportImages() {',
    '\nfunction handleExportSettings() {'
);

const exportSettingsCode = extractCode(
    'function handleExportSettings() {',
    '\n// Helper: Validate Imported Settings'
);

const exportOshiCode = extractCode(
    'function handleOshiExport() {',
    '\n// --- Oshi Import (for modal) ---'
);

// --- ファクトリ関数（依存注入） ---
function makeHandleExportImages(mockLocalImageDB, mockShowToast) {
    // getOrderedImageKeys: テストではカスタム順不要のためパススルー
    const getOrderedImageKeys = (keys) => keys;
    return new Function('localImageDB', 'showToast', 'getOrderedImageKeys',
        `${exportImagesCode}; return handleExportImages;`
    )(mockLocalImageDB, mockShowToast, getOrderedImageKeys);
}

function makeHandleExportSettings(mockAppSettings) {
    return new Function('appSettings',
        `${exportSettingsCode}; return handleExportSettings;`
    )(mockAppSettings);
}

function makeHandleOshiExport(mockAppSettings, mockShowToast) {
    return new Function('appSettings', 'showToast',
        `${exportOshiCode}; return handleOshiExport;`
    )(mockAppSettings, mockShowToast);
}

// ===========================================================================
// handleExportImages
// ===========================================================================
describe('handleExportImages', () => {
    let clickSpy;
    let mockShowToast;

    beforeEach(() => {
        mockShowToast = vi.fn();
        // a.click() の実行を捕捉（実際のダウンロードは発生させない）
        clickSpy = vi.spyOn(HTMLElement.prototype, 'click').mockImplementation(() => {});
        URL.createObjectURL.mockReturnValue('blob:test-url');
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it('画像が0件の場合はダウンロードせず専用トーストを表示する', async () => {
        const mockDB = {
            getAllKeys: vi.fn().mockResolvedValue([]),
            exportData: vi.fn().mockResolvedValue([]),
        };
        const fn = makeHandleExportImages(mockDB, mockShowToast);

        await fn();

        expect(mockDB.exportData).toHaveBeenCalledOnce();
        expect(URL.createObjectURL).not.toHaveBeenCalled();
        expect(clickSpy).not.toHaveBeenCalled();
        expect(mockShowToast).toHaveBeenCalledWith('書き出す画像がありません');
    });

    it('ダウンロードを実行しトーストを表示する', async () => {
        const chunks = [{ filename: 'oshikoyo_images_backup_2026-03-20.json.gz', blob: new Blob(['gz'], { type: 'application/gzip' }) }];
        const mockDB = {
            getAllKeys: vi.fn().mockResolvedValue([1]),
            exportData: vi.fn().mockResolvedValue(chunks),
        };
        const fn = makeHandleExportImages(mockDB, mockShowToast);

        await fn();

        expect(URL.createObjectURL).toHaveBeenCalledOnce();
        expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
        expect(clickSpy).toHaveBeenCalledOnce();
        expect(mockShowToast).toHaveBeenLastCalledWith('書き出しました');
    });

    it('正しいファイル名が設定される', async () => {
        const filename = 'oshikoyo_images_backup_2026-03-20.json.gz';
        const chunks = [{ filename, blob: new Blob(['gz'], { type: 'application/gzip' }) }];
        const mockDB = {
            getAllKeys: vi.fn().mockResolvedValue([1]),
            exportData: vi.fn().mockResolvedValue(chunks),
        };
        const fn = makeHandleExportImages(mockDB, mockShowToast);

        // ダウンロード時に <a download="..."> が設定されることを確認
        const appendSpy = vi.spyOn(document.body, 'appendChild');
        await fn();

        const anchor = appendSpy.mock.calls[0][0];
        expect(anchor.tagName).toBe('A');
        expect(anchor.download).toBe(filename);
    });
});

// ===========================================================================
// handleExportSettings
// ===========================================================================
describe('handleExportSettings', () => {
    let clickSpy;

    beforeEach(() => {
        clickSpy = vi.spyOn(HTMLElement.prototype, 'click').mockImplementation(() => {});
        URL.createObjectURL.mockReturnValue('blob:test-url');
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it('ObjectURL を作成しダウンロードを実行する', () => {
        const mockSettings = { oshiList: [], startOfWeek: 0 };
        const fn = makeHandleExportSettings(mockSettings);

        fn();

        expect(URL.createObjectURL).toHaveBeenCalledOnce();
        expect(clickSpy).toHaveBeenCalledOnce();
        expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
    });

    it('ファイル名が oshikoyo_settings_YYYY-MM-DD.json 形式である', () => {
        const mockSettings = { oshiList: [], startOfWeek: 0 };
        const fn = makeHandleExportSettings(mockSettings);

        const appendSpy = vi.spyOn(document.body, 'appendChild');
        fn();

        const anchor = appendSpy.mock.calls[0][0];
        expect(anchor.download).toMatch(/^oshikoyo_settings_\d{4}-\d{2}-\d{2}\.json$/);
    });
});

// ===========================================================================
// handleOshiExport
// ===========================================================================
describe('handleOshiExport', () => {
    let clickSpy;
    let mockShowToast;

    beforeEach(() => {
        mockShowToast = vi.fn();
        clickSpy = vi.spyOn(HTMLElement.prototype, 'click').mockImplementation(() => {});
        URL.createObjectURL.mockReturnValue('blob:test-url');
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it('oshiList が空の場合はダウンロードせずトーストを表示する', () => {
        const mockSettings = { oshiList: [] };
        const fn = makeHandleOshiExport(mockSettings, mockShowToast);

        fn();

        expect(URL.createObjectURL).not.toHaveBeenCalled();
        expect(clickSpy).not.toHaveBeenCalled();
        expect(mockShowToast).toHaveBeenCalledWith('エクスポートするデータがありません。');
    });

    it('oshiList がある場合はダウンロードを実行し件数をトーストに表示する', () => {
        const mockSettings = {
            oshiList: [
                { name: '推しA', color: '#ff0000', memorial_dates: [] },
                { name: '推しB', color: '#00ff00', memorial_dates: [] },
            ]
        };
        const fn = makeHandleOshiExport(mockSettings, mockShowToast);

        fn();

        expect(URL.createObjectURL).toHaveBeenCalledOnce();
        expect(clickSpy).toHaveBeenCalledOnce();
        expect(mockShowToast).toHaveBeenCalledWith('2件のデータをエクスポートしました');
    });

    it('ファイル名が oshi_list_YYYY-MM-DD.json 形式である', () => {
        const mockSettings = { oshiList: [{ name: '推しA', color: '#ff0000', memorial_dates: [] }] };
        const fn = makeHandleOshiExport(mockSettings, mockShowToast);

        const appendSpy = vi.spyOn(document.body, 'appendChild');
        fn();

        const anchor = appendSpy.mock.calls[0][0];
        expect(anchor.download).toMatch(/^oshi_list_\d{4}-\d{2}-\d{2}\.json$/);
    });
});
