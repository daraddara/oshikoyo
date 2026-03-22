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

function makeExportOshiAsCsv(mockAppSettings, mockShowToast) {
    return new Function('appSettings', 'showToast',
        `${exportOshiCode}; return exportOshiAsCsv;`
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
        // jsdom does not implement showModal/close for <dialog>
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        // Remove any dialogs left in the DOM
        document.querySelectorAll('dialog').forEach(d => d.remove());
    });

    it('oshiList が空の場合はダイアログを開かずトーストを表示する', () => {
        const mockSettings = { oshiList: [] };
        const fn = makeHandleOshiExport(mockSettings, mockShowToast);

        fn();

        expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();
        expect(mockShowToast).toHaveBeenCalledWith('エクスポートするデータがありません。');
    });

    it('oshiList がある場合はエクスポートダイアログを表示する', () => {
        const mockSettings = {
            oshiList: [{ name: '推しA', color: '#ff0000', memorial_dates: [] }]
        };
        const fn = makeHandleOshiExport(mockSettings, mockShowToast);

        fn();

        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();
    });

    it('JSON形式ボタンをクリックするとダウンロードを実行し件数をトーストに表示する', () => {
        const mockSettings = {
            oshiList: [
                { name: '推しA', color: '#ff0000', memorial_dates: [] },
                { name: '推しB', color: '#00ff00', memorial_dates: [] },
            ]
        };
        const fn = makeHandleOshiExport(mockSettings, mockShowToast);
        fn();

        // .click() on HTMLElement is mocked; invoke onclick directly
        document.getElementById('oshiExportJson').onclick();

        expect(URL.createObjectURL).toHaveBeenCalledOnce();
        expect(mockShowToast).toHaveBeenCalledWith('2件のデータをエクスポートしました');
    });

    it('JSON形式のファイル名が oshi_list_YYYY-MM-DD.json 形式である', () => {
        const mockSettings = { oshiList: [{ name: '推しA', color: '#ff0000', memorial_dates: [] }] };
        const fn = makeHandleOshiExport(mockSettings, mockShowToast);

        const appendSpy = vi.spyOn(document.body, 'appendChild');
        fn();
        document.getElementById('oshiExportJson').onclick();

        const anchors = appendSpy.mock.calls.map(c => c[0]).filter(el => el.tagName === 'A');
        expect(anchors[0].download).toMatch(/^oshi_list_\d{4}-\d{2}-\d{2}\.json$/);
    });
});

// ===========================================================================
// exportOshiAsCsv
// ===========================================================================
describe('exportOshiAsCsv', () => {
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

    it('CSVファイルをダウンロードしトーストを表示する', () => {
        const mockSettings = {
            oshiList: [{ name: '推しA', color: '#ff69b4', memorial_dates: [], tags: [] }],
            event_types: []
        };
        const fn = makeExportOshiAsCsv(mockSettings, mockShowToast);
        fn();

        expect(URL.createObjectURL).toHaveBeenCalledOnce();
        expect(clickSpy).toHaveBeenCalledOnce();
        expect(mockShowToast).toHaveBeenCalledWith('1件のデータをCSVでエクスポートしました');
    });

    it('ファイル名が oshi_list_YYYY-MM-DD.csv 形式である', () => {
        const mockSettings = {
            oshiList: [{ name: '推しA', color: '#ff0000', memorial_dates: [], tags: [] }],
            event_types: []
        };
        const fn = makeExportOshiAsCsv(mockSettings, mockShowToast);

        // Capture the <a> element via createElement spy
        let capturedAnchor;
        const origCreate = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation((tag) => {
            const el = origCreate(tag);
            if (tag === 'a') capturedAnchor = el;
            return el;
        });
        fn();
        expect(capturedAnchor.download).toMatch(/^oshi_list_\d{4}-\d{2}-\d{2}\.csv$/);
    });

    it('bday・debut・カスタムイベント・タグを正しくCSVに変換する', () => {
        const createdBlobs = [];
        const origBlob = global.Blob;
        global.Blob = class extends origBlob {
            constructor(parts, opts) { super(parts, opts); createdBlobs.push(parts.join('')); }
        };

        const mockSettings = {
            oshiList: [{
                name: '推しA',
                color: '#ff69b4',
                memorial_dates: [
                    { type_id: 'bday',  date: '3/21', is_annual: true },
                    { type_id: 'debut', date: '2019/9/1', is_annual: true },
                    { type_id: 'ev_abc', date: '2022/4/1', is_annual: true },
                ],
                tags: ['VTuber', '歌手']
            }],
            event_types: [
                { id: 'bday',   label: '誕生日' },
                { id: 'debut',  label: 'デビュー記念日' },
                { id: 'ev_abc', label: '3Dお披露目' },
            ]
        };
        const fn = makeExportOshiAsCsv(mockSettings, mockShowToast);
        fn();

        const csvText = createdBlobs[0].replace('\uFEFF', ''); // remove BOM
        const lines = csvText.split('\r\n');
        expect(lines[0]).toBe('名前,カラー,誕生日,デビュー記念日,イベント1_種別,イベント1_日付,イベント2_種別,イベント2_日付,イベント3_種別,イベント3_日付,タグ');
        expect(lines[1]).toMatch(/^# 書式:/); // 書式説明コメント行
        expect(lines[2]).toBe('推しA,#ff69b4,3/21,2019/9/1,3Dお披露目,2022/4/1,,,,, VTuber;歌手'.replace(' ', ''));

        global.Blob = origBlob;
    });

    it('カスタムイベントが4件以上の場合は警告トーストを表示する', () => {
        const mockSettings = {
            oshiList: [{
                name: '推しA',
                color: '#ff0000',
                memorial_dates: [
                    { type_id: 'ev_1', date: '1/1', is_annual: true },
                    { type_id: 'ev_2', date: '2/1', is_annual: true },
                    { type_id: 'ev_3', date: '3/1', is_annual: true },
                    { type_id: 'ev_4', date: '4/1', is_annual: true }, // 4件目 → 省略
                ],
                tags: []
            }],
            event_types: [
                { id: 'ev_1', label: 'A' },
                { id: 'ev_2', label: 'B' },
                { id: 'ev_3', label: 'C' },
                { id: 'ev_4', label: 'D' },
            ]
        };
        const fn = makeExportOshiAsCsv(mockSettings, mockShowToast);
        fn();

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.stringContaining('一部省略'),
            expect.any(Number)
        );
    });
});
