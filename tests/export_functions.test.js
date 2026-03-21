/**
 * @jest-environment jsdom
 *
 * エクスポート関数のテスト
 * - handleExportFullBackup: 全データ（設定＋画像）のダウンロード
 * - handleExportImageTagPackage: 画像＋タグパッケージのダウンロード
 * - handleOshiExport: 推しリストのダウンロード
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractCode, setupTestEnvironment } from './test-utils.js';

setupTestEnvironment();

// --- コード抽出 ---
const exportFullBackupCode = extractCode(
    'async function handleExportFullBackup() {',
    '\nasync function handleImportFullBackup('
);

const exportImageTagCode = extractCode(
    'async function handleExportImageTagPackage() {',
    '\nasync function handleImportImageTagPackage('
);

const exportOshiCode = extractCode(
    'function handleOshiExport() {',
    '\n// --- Oshi Import (for modal) ---'
);

const blobToBase64Code = extractCode(
    '// Helper: Blob to Base64',
    '// --- State Persistence'
);

// --- ファクトリ関数（依存注入） ---
function makeHandleExportFullBackup(mockLocalImageDB, mockAppSettings, mockShowToast) {
    const getOrderedImageKeys = (keys) => keys;
    return new Function(
        'localImageDB', 'appSettings', 'showToast', 'getOrderedImageKeys', 'blobToBase64',
        `${blobToBase64Code}; ${exportFullBackupCode}; return handleExportFullBackup;`
    )(mockLocalImageDB, mockAppSettings, mockShowToast, getOrderedImageKeys, null /* extracted */);
}

function makeHandleExportImageTagPackage(mockLocalImageDB, mockAppSettings, mockShowToast) {
    const getOrderedImageKeys = (keys) => keys;
    return new Function(
        'localImageDB', 'appSettings', 'showToast', 'getOrderedImageKeys', 'blobToBase64',
        `${blobToBase64Code}; ${exportImageTagCode}; return handleExportImageTagPackage;`
    )(mockLocalImageDB, mockAppSettings, mockShowToast, getOrderedImageKeys, null /* extracted */);
}

function makeHandleOshiExport(mockAppSettings, mockShowToast) {
    return new Function('appSettings', 'showToast',
        `${exportOshiCode}; return handleOshiExport;`
    )(mockAppSettings, mockShowToast);
}

// ===========================================================================
// handleExportFullBackup
// ===========================================================================
describe('handleExportFullBackup', () => {
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

    it('ダウンロードを実行しトーストを表示する', async () => {
        const mockDB = {
            getAllKeys: vi.fn().mockResolvedValue([1]),
            getImage: vi.fn().mockResolvedValue(new File(['img'], 'photo.jpg', { type: 'image/jpeg' })),
        };
        const mockSettings = { oshiList: [], startOfWeek: 0 };
        const fn = makeHandleExportFullBackup(mockDB, mockSettings, mockShowToast);

        await fn();

        expect(URL.createObjectURL).toHaveBeenCalledOnce();
        expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
        expect(clickSpy).toHaveBeenCalledOnce();
        expect(mockShowToast).toHaveBeenLastCalledWith('バックアップを保存しました');
    });

    it('画像が0件でもバックアップは実行される', async () => {
        const mockDB = {
            getAllKeys: vi.fn().mockResolvedValue([]),
            getImage: vi.fn(),
        };
        const mockSettings = { oshiList: [], startOfWeek: 0 };
        const fn = makeHandleExportFullBackup(mockDB, mockSettings, mockShowToast);

        await fn();

        expect(URL.createObjectURL).toHaveBeenCalledOnce();
        expect(clickSpy).toHaveBeenCalledOnce();
        expect(mockDB.getImage).not.toHaveBeenCalled();
    });

    it('ファイル名が oshikoyo_backup_YYYY-MM-DD.json.gz 形式である', async () => {
        const mockDB = {
            getAllKeys: vi.fn().mockResolvedValue([]),
            getImage: vi.fn(),
        };
        const fn = makeHandleExportFullBackup(mockDB, { oshiList: [] }, mockShowToast);

        const appendSpy = vi.spyOn(document.body, 'appendChild');
        await fn();

        const anchor = appendSpy.mock.calls[0][0];
        expect(anchor.tagName).toBe('A');
        expect(anchor.download).toMatch(/^oshikoyo_backup_\d{4}-\d{2}-\d{2}\.json\.gz$/);
    });
});

// ===========================================================================
// handleExportImageTagPackage
// ===========================================================================
describe('handleExportImageTagPackage', () => {
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

    it('画像が0件の場合はダウンロードせず専用トーストを表示する', async () => {
        const mockDB = { getAllKeys: vi.fn().mockResolvedValue([]) };
        const fn = makeHandleExportImageTagPackage(mockDB, { oshiList: [] }, mockShowToast);

        await fn();

        expect(URL.createObjectURL).not.toHaveBeenCalled();
        expect(clickSpy).not.toHaveBeenCalled();
        expect(mockShowToast).toHaveBeenCalledWith('書き出す画像がありません');
    });

    it('ダウンロードを実行しトーストを表示する', async () => {
        const mockDB = {
            getAllKeys: vi.fn().mockResolvedValue([1]),
            getImage: vi.fn().mockResolvedValue(new File(['img'], 'photo.jpg', { type: 'image/jpeg' })),
        };
        const mockSettings = { oshiList: [], localImageMeta: {} };
        const fn = makeHandleExportImageTagPackage(mockDB, mockSettings, mockShowToast);

        await fn();

        expect(URL.createObjectURL).toHaveBeenCalledOnce();
        expect(clickSpy).toHaveBeenCalledOnce();
        expect(mockShowToast).toHaveBeenLastCalledWith('書き出しました');
    });

    it('ファイル名が oshikoyo_images_YYYY-MM-DD.json.gz 形式である', async () => {
        const mockDB = {
            getAllKeys: vi.fn().mockResolvedValue([1]),
            getImage: vi.fn().mockResolvedValue(new File(['img'], 'photo.jpg', { type: 'image/jpeg' })),
        };
        const fn = makeHandleExportImageTagPackage(mockDB, { oshiList: [], localImageMeta: {} }, mockShowToast);

        const appendSpy = vi.spyOn(document.body, 'appendChild');
        await fn();

        const anchor = appendSpy.mock.calls[0][0];
        expect(anchor.download).toMatch(/^oshikoyo_images_\d{4}-\d{2}-\d{2}\.json\.gz$/);
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
