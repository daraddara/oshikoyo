// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { extractCode, setupTestEnvironment } from './test-utils.js';

setupTestEnvironment();

// 必要な関数を抽出
const csvCode = extractCode('// --- Oshi CSV Import ---', '// --- Oshi Import (for modal) ---');
const tagCode  = extractCode('// --- Tag Logic ---', '// --- Tag UI ---');

function makeModule(mockAppSettings) {
    const code = `
        ${tagCode}
        ${csvCode}
        return { parseCSV, convertCsvRowsToOshiItems, OSHI_CSV_TEMPLATE_HEADERS };
    `;
    return new Function('appSettings', 'DEFAULT_SETTINGS', 'getTypeIdForLabel', code)(
        mockAppSettings,
        { event_types: [
            { id: 'bday',  label: '誕生日',       icon: 'cake' },
            { id: 'debut', label: 'デビュー記念日', icon: 'star' },
        ]},
        (label) => {
            const found = (mockAppSettings.event_types || []).find(t => t.label === label);
            return found ? found.id : null;
        }
    );
}

// ─── parseCSV ───────────────────────────────────────────────
describe('parseCSV', () => {
    let parseCSV;
    beforeEach(() => {
        ({ parseCSV } = makeModule({ event_types: [] }));
    });

    it('基本的なCSVを解析できる', () => {
        const csv = '名前,カラー\n推しA,#ff6b9d\n推しB,#3b82f6';
        const { headers, rows } = parseCSV(csv);
        expect(headers).toEqual(['名前', 'カラー']);
        expect(rows).toHaveLength(2);
        expect(rows[0]['名前']).toBe('推しA');
        expect(rows[1]['カラー']).toBe('#3b82f6');
    });

    it('UTF-8 BOMを除去できる', () => {
        const csv = '\uFEFF名前,カラー\n推しA,#ff6b9d';
        const { headers } = parseCSV(csv);
        expect(headers[0]).toBe('名前');
    });

    it('CRLFに対応できる', () => {
        const csv = '名前,カラー\r\n推しA,#ff6b9d\r\n推しB,#3b82f6';
        const { rows } = parseCSV(csv);
        expect(rows).toHaveLength(2);
    });

    it('クォートされたフィールド（カンマ含む）を正しく解析できる', () => {
        const csv = '名前,メモ\n推しA,"テキスト,カンマ入り"';
        const { rows } = parseCSV(csv);
        expect(rows[0]['メモ']).toBe('テキスト,カンマ入り');
    });

    it('空のCSV（ヘッダーのみ）は空配列を返す', () => {
        const { rows } = parseCSV('名前,カラー\n');
        expect(rows).toHaveLength(0);
    });

    it('1行以下のCSVはヘッダーなし・行なしを返す', () => {
        const { headers, rows } = parseCSV('名前のみ');
        expect(headers).toEqual([]);
        expect(rows).toHaveLength(0);
    });
});

// ─── convertCsvRowsToOshiItems ────────────────────────────────
describe('convertCsvRowsToOshiItems', () => {
    let convertCsvRowsToOshiItems;
    beforeEach(() => {
        const settings = {
            event_types: [
                { id: 'bday',  label: '誕生日',       icon: 'cake' },
                { id: 'debut', label: 'デビュー記念日', icon: 'star' },
            ]
        };
        ({ convertCsvRowsToOshiItems } = makeModule(settings));
    });

    it('基本フィールドを正しく変換できる', () => {
        const rows = [{ '名前': '推しA', 'カラー': '#ff6b9d', '誕生日': '3/21', 'デビュー記念日': '2019/9/1', 'タグ': '', 'イベント1_種別': '', 'イベント1_日付': '', 'イベント2_種別': '', 'イベント2_日付': '', 'イベント3_種別': '', 'イベント3_日付': '' }];
        const { items } = convertCsvRowsToOshiItems(rows, 'test.csv');
        expect(items).toHaveLength(1);
        expect(items[0].name).toBe('推しA');
        expect(items[0].color).toBe('#ff6b9d');
        expect(items[0].memorial_dates).toHaveLength(2);
        expect(items[0].memorial_dates[0]).toMatchObject({ type_id: 'bday', date: '3/21', is_annual: true });
    });

    it('タグをセミコロン区切りで分割できる', () => {
        const rows = [{ '名前': '推しA', 'カラー': '', '誕生日': '', 'デビュー記念日': '', 'タグ': 'VTuber;歌手', 'イベント1_種別': '', 'イベント1_日付': '', 'イベント2_種別': '', 'イベント2_日付': '', 'イベント3_種別': '', 'イベント3_日付': '' }];
        const { items } = convertCsvRowsToOshiItems(rows, 'test.csv');
        expect(items[0].tags).toEqual(['VTuber', '歌手']);
    });

    it('カスタムイベントを最大3件変換できる', () => {
        const rows = [{
            '名前': '推しA', 'カラー': '', '誕生日': '', 'デビュー記念日': '', 'タグ': '',
            'イベント1_種別': '活動周年', 'イベント1_日付': '2022/4/1',
            'イベント2_種別': '3Dお披露目', 'イベント2_日付': '2023/1/15',
            'イベント3_種別': '', 'イベント3_日付': ''
        }];
        const { items } = convertCsvRowsToOshiItems(rows, 'test.csv');
        expect(items[0].memorial_dates).toHaveLength(2);
        expect(items[0].memorial_dates[0].is_annual).toBe(true);
    });

    it('名前が空の行はスキップされる', () => {
        const rows = [
            { '名前': '', 'カラー': '#fff', '誕生日': '', 'デビュー記念日': '', 'タグ': '', 'イベント1_種別': '', 'イベント1_日付': '', 'イベント2_種別': '', 'イベント2_日付': '', 'イベント3_種別': '', 'イベント3_日付': '' },
            { '名前': '推しB', 'カラー': '', '誕生日': '', 'デビュー記念日': '', 'タグ': '', 'イベント1_種別': '', 'イベント1_日付': '', 'イベント2_種別': '', 'イベント2_日付': '', 'イベント3_種別': '', 'イベント3_日付': '' }
        ];
        const { items, skippedRows } = convertCsvRowsToOshiItems(rows, 'test.csv');
        expect(items).toHaveLength(1);
        expect(skippedRows).toBe(1);
    });

    it('種別のみ・日付のみのカスタムイベントはスキップされる', () => {
        const rows = [{
            '名前': '推しA', 'カラー': '', '誕生日': '', 'デビュー記念日': '', 'タグ': '',
            'イベント1_種別': '活動周年', 'イベント1_日付': '', // 日付なし
            'イベント2_種別': '', 'イベント2_日付': '2023/1/15', // 種別なし
            'イベント3_種別': '', 'イベント3_日付': ''
        }];
        const { items } = convertCsvRowsToOshiItems(rows, 'test.csv');
        expect(items[0].memorial_dates).toHaveLength(0);
    });
});

// ─── テンプレートヘッダー定義 ─────────────────────────────────
describe('OSHI_CSV_TEMPLATE_HEADERS', () => {
    it('必須列と任意列が正しく定義されている', () => {
        const { OSHI_CSV_TEMPLATE_HEADERS } = makeModule({ event_types: [] });
        expect(OSHI_CSV_TEMPLATE_HEADERS).toContain('名前');
        expect(OSHI_CSV_TEMPLATE_HEADERS).toContain('カラー');
        expect(OSHI_CSV_TEMPLATE_HEADERS).toContain('誕生日');
        expect(OSHI_CSV_TEMPLATE_HEADERS).toContain('タグ');
        expect(OSHI_CSV_TEMPLATE_HEADERS.filter(h => h.includes('イベント'))).toHaveLength(6); // 3組×2
    });
});
