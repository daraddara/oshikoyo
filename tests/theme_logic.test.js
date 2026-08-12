/**
 * テーマ機能（推しをまとめたデータセット）のユニットテスト
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { extractCode, setupTestEnvironment } from './test-utils.js';

setupTestEnvironment();

const themeCode = extractCode('// --- Theme Logic ---', '// --- Memorial Tag Logic ---');
const tagLogicCode = extractCode('// --- Tag Logic ---', '// --- Tag UI ---');
const themeIoCode = extractCode('// --- Theme Export / Import ---', '// --- Oshi Export ---');

/**
 * テーマの書き出し・取り込みロジックをテスト用に生成する。
 * @param {Object} mockAppSettings - appSettings のモック
 * @returns {Object} テーマ入出力関連関数
 */
function makeThemeIo(mockAppSettings) {
    const code = `
        const DEFAULT_SETTINGS = { event_types: [
            { id: 'bday', label: '誕生日', icon: 'cake' },
            { id: 'debut', label: 'デビュー記念日', icon: 'star' },
        ] };
        ${tagLogicCode}
        ${themeCode}
        ${themeIoCode}
        return { buildThemeExportData, importThemePackage, sanitizeFileName };
    `;
    return new Function('appSettings', code)(mockAppSettings);
}

/**
 * テーマロジックをテスト用に生成する。
 * @param {Object} mockAppSettings - appSettings のモック
 * @returns {Object} テーマ関連関数
 */
function makeThemeLogic(mockAppSettings) {
    const code = `
        ${tagLogicCode}
        ${themeCode}
        return {
            generateEntityId, ensureOshiIds, normalizeThemes, getThemes, getActiveTheme,
            isOshiInTheme, getThemeOshis, getThemeTagSet, getVisibleOshiList,
            getThemeIdsForOshi, setThemesForOshi, removeOshiFromThemes,
            getUniqueThemeName, migrateGroupsToThemes, computeThemeStorage, formatBytes,
            THEME_DEFAULT_COLOR, THEME_NAME_MAX,
        };
    `;
    return new Function('appSettings', code)(mockAppSettings);
}

// ---------- ensureOshiIds ----------

describe('ensureOshiIds', () => {
    it('id がない推しに一意な id を採番する', () => {
        const { ensureOshiIds } = makeThemeLogic({});
        const result = ensureOshiIds([{ name: 'A' }, { name: 'B' }]);
        expect(result[0].id).toMatch(/^os_/);
        expect(result[1].id).toMatch(/^os_/);
        expect(result[0].id).not.toBe(result[1].id);
    });

    it('既存の id はそのまま保持する', () => {
        const { ensureOshiIds } = makeThemeLogic({});
        const result = ensureOshiIds([{ id: 'os_keep', name: 'A' }]);
        expect(result[0].id).toBe('os_keep');
    });

    it('id が重複している場合は後続を再採番する', () => {
        const { ensureOshiIds } = makeThemeLogic({});
        const result = ensureOshiIds([{ id: 'dup', name: 'A' }, { id: 'dup', name: 'B' }]);
        expect(result[0].id).toBe('dup');
        expect(result[1].id).not.toBe('dup');
    });

    it('空配列・undefined を渡しても落ちない', () => {
        const { ensureOshiIds } = makeThemeLogic({});
        expect(ensureOshiIds([])).toEqual([]);
        expect(ensureOshiIds(undefined)).toEqual([]);
    });
});

// ---------- normalizeThemes ----------

describe('normalizeThemes', () => {
    const oshiList = [{ id: 'os1', name: 'A' }, { id: 'os2', name: 'B' }];

    it('存在しない推しIDの参照を除去する', () => {
        const { normalizeThemes } = makeThemeLogic({});
        const result = normalizeThemes(
            [{ id: 'th1', name: 'T1', color: '#f472b6', oshiIds: ['os1', 'os_gone'] }],
            oshiList
        );
        expect(result[0].oshiIds).toEqual(['os1']);
    });

    it('名前が空のテーマは除去する', () => {
        const { normalizeThemes } = makeThemeLogic({});
        const result = normalizeThemes(
            [{ id: 'th1', name: '   ', oshiIds: [] }, { id: 'th2', name: 'OK', oshiIds: [] }],
            oshiList
        );
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('OK');
    });

    it('不正なカラーはデフォルトカラーに置換する', () => {
        const { normalizeThemes, THEME_DEFAULT_COLOR } = makeThemeLogic({});
        const result = normalizeThemes([{ id: 'th1', name: 'T', color: 'red', oshiIds: [] }], oshiList);
        expect(result[0].color).toBe(THEME_DEFAULT_COLOR);
    });

    it('重複した推しIDを1件にまとめる', () => {
        const { normalizeThemes } = makeThemeLogic({});
        const result = normalizeThemes(
            [{ id: 'th1', name: 'T', oshiIds: ['os1', 'os1', 'os2'] }],
            oshiList
        );
        expect(result[0].oshiIds).toEqual(['os1', 'os2']);
    });

    it('テーマID が重複する場合は再採番する', () => {
        const { normalizeThemes } = makeThemeLogic({});
        const result = normalizeThemes(
            [{ id: 'same', name: 'T1', oshiIds: [] }, { id: 'same', name: 'T2', oshiIds: [] }],
            oshiList
        );
        expect(result[0].id).not.toBe(result[1].id);
    });

    it('配列でない入力は空配列を返す', () => {
        const { normalizeThemes } = makeThemeLogic({});
        expect(normalizeThemes(null, oshiList)).toEqual([]);
        expect(normalizeThemes('themes', oshiList)).toEqual([]);
    });

    it('テーマ名は最大長で切り詰められる', () => {
        const { normalizeThemes, THEME_NAME_MAX } = makeThemeLogic({});
        const result = normalizeThemes([{ id: 't', name: 'あ'.repeat(50), oshiIds: [] }], oshiList);
        expect(result[0].name).toHaveLength(THEME_NAME_MAX);
    });
});

// ---------- 所属判定・絞り込み ----------

describe('テーマによる推しの絞り込み', () => {
    let settings;

    beforeEach(() => {
        settings = {
            oshiList: [
                { id: 'os1', name: 'A', tags: ['ライブ'] },
                { id: 'os2', name: 'B', tags: [] },
                { id: 'os3', name: 'C', tags: ['衣装'] },
            ],
            themes: [
                { id: 'th1', name: 'T1', color: '#f472b6', oshiIds: ['os1', 'os3'] },
                { id: 'th2', name: 'T2', color: '#60a5fa', oshiIds: ['os2'] },
            ],
            activeThemeId: null,
        };
    });

    it('activeThemeId が null の場合 getActiveTheme は null を返す', () => {
        const { getActiveTheme } = makeThemeLogic(settings);
        expect(getActiveTheme()).toBeNull();
    });

    it('テーマ未選択なら全推しが表示対象になる', () => {
        const { getVisibleOshiList } = makeThemeLogic(settings);
        expect(getVisibleOshiList()).toHaveLength(3);
    });

    it('テーマ選択中は所属推しのみが表示対象になる', () => {
        settings.activeThemeId = 'th1';
        const { getVisibleOshiList } = makeThemeLogic(settings);
        expect(getVisibleOshiList().map(o => o.id)).toEqual(['os1', 'os3']);
    });

    it('isOshiInTheme は theme が null なら常に true', () => {
        const { isOshiInTheme } = makeThemeLogic(settings);
        expect(isOshiInTheme({ id: 'os1' }, null)).toBe(true);
    });

    it('id を持たない推しはテーマに所属しないと判定される', () => {
        const { isOshiInTheme } = makeThemeLogic(settings);
        expect(isOshiInTheme({ name: 'ID無し' }, settings.themes[0])).toBe(false);
    });

    it('getThemeTagSet は推し名とタグの和集合を返す', () => {
        const { getThemeTagSet } = makeThemeLogic(settings);
        const tags = getThemeTagSet(settings.themes[0]);
        expect([...tags].sort()).toEqual(['A', 'C', 'ライブ', '衣装'].sort());
    });

    it('1人の推しが複数テーマに所属できる（多対多）', () => {
        settings.themes[1].oshiIds.push('os1');
        const { getThemeIdsForOshi } = makeThemeLogic(settings);
        expect(getThemeIdsForOshi('os1').sort()).toEqual(['th1', 'th2']);
    });
});

// ---------- 所属の更新・削除 ----------

describe('setThemesForOshi / removeOshiFromThemes', () => {
    let settings;

    beforeEach(() => {
        settings = {
            oshiList: [{ id: 'os1', name: 'A' }],
            themes: [
                { id: 'th1', name: 'T1', color: '#f472b6', oshiIds: ['os1'] },
                { id: 'th2', name: 'T2', color: '#60a5fa', oshiIds: [] },
            ],
            activeThemeId: null,
        };
    });

    it('チェックされたテーマにのみ所属させる', () => {
        const { setThemesForOshi } = makeThemeLogic(settings);
        setThemesForOshi('os1', ['th2']);
        expect(settings.themes[0].oshiIds).toEqual([]);
        expect(settings.themes[1].oshiIds).toEqual(['os1']);
    });

    it('同じテーマに重複して追加しない', () => {
        const { setThemesForOshi } = makeThemeLogic(settings);
        setThemesForOshi('os1', ['th1']);
        setThemesForOshi('os1', ['th1']);
        expect(settings.themes[0].oshiIds).toEqual(['os1']);
    });

    it('推し削除時に全テーマの所属から取り除かれる', () => {
        settings.themes[1].oshiIds.push('os1');
        const { removeOshiFromThemes } = makeThemeLogic(settings);
        removeOshiFromThemes('os1');
        expect(settings.themes[0].oshiIds).toEqual([]);
        expect(settings.themes[1].oshiIds).toEqual([]);
    });
});

// ---------- テーマ名の一意化 ----------

describe('getUniqueThemeName', () => {
    it('重複しない名前はそのまま返す', () => {
        const { getUniqueThemeName } = makeThemeLogic({ themes: [{ id: 't', name: '既存', oshiIds: [] }] });
        expect(getUniqueThemeName('新規')).toBe('新規');
    });

    it('重複する場合は連番を付与する', () => {
        const { getUniqueThemeName } = makeThemeLogic({ themes: [{ id: 't', name: '既存', oshiIds: [] }] });
        expect(getUniqueThemeName('既存')).toBe('既存 (2)');
    });

    it('連番も重複する場合はさらに繰り上げる', () => {
        const { getUniqueThemeName } = makeThemeLogic({
            themes: [
                { id: 't1', name: '既存', oshiIds: [] },
                { id: 't2', name: '既存 (2)', oshiIds: [] },
            ],
        });
        expect(getUniqueThemeName('既存')).toBe('既存 (3)');
    });
});

// ---------- 旧グループからの移行 ----------

describe('migrateGroupsToThemes', () => {
    it('既存の所属グループごとにテーマを生成する', () => {
        const settings = {
            oshiList: [
                { id: 'os1', name: 'A', group: 'グループA' },
                { id: 'os2', name: 'B', group: 'グループB' },
                { id: 'os3', name: 'C', group: 'グループA' },
            ],
            themes: [],
        };
        const { migrateGroupsToThemes } = makeThemeLogic(settings);
        migrateGroupsToThemes(settings);
        expect(settings.themes.map(t => t.name)).toEqual(['グループA', 'グループB']);
        expect(settings.themes[0].oshiIds).toEqual(['os1', 'os3']);
        expect(settings.themes[1].oshiIds).toEqual(['os2']);
    });

    it('グループ未設定の推しはどのテーマにも入らない', () => {
        const settings = {
            oshiList: [{ id: 'os1', name: 'A', group: '' }, { id: 'os2', name: 'B' }],
            themes: [],
        };
        const { migrateGroupsToThemes } = makeThemeLogic(settings);
        migrateGroupsToThemes(settings);
        expect(settings.themes).toEqual([]);
    });

    it('旧 activeFilter の選択状態を activeThemeId に引き継ぐ', () => {
        const settings = {
            oshiList: [{ id: 'os1', name: 'A', group: 'グループA' }],
            themes: [],
            activeFilter: 'グループA',
        };
        const { migrateGroupsToThemes } = makeThemeLogic(settings);
        migrateGroupsToThemes(settings);
        expect(settings.activeThemeId).toBe(settings.themes[0].id);
    });

    it('一度移行したら再実行してもテーマを再生成しない', () => {
        const settings = {
            oshiList: [{ id: 'os1', name: 'A', group: 'グループA' }],
            themes: [],
        };
        const { migrateGroupsToThemes } = makeThemeLogic(settings);
        migrateGroupsToThemes(settings);
        settings.themes = [];  // ユーザーが全テーマを削除した状況
        migrateGroupsToThemes(settings);
        expect(settings.themes).toEqual([]);
    });

    it('既にテーマが存在する場合は上書きしない', () => {
        const settings = {
            oshiList: [{ id: 'os1', name: 'A', group: 'グループA' }],
            themes: [{ id: 'th_existing', name: '手動作成', color: '#f472b6', oshiIds: [] }],
        };
        const { migrateGroupsToThemes } = makeThemeLogic(settings);
        migrateGroupsToThemes(settings);
        expect(settings.themes).toHaveLength(1);
        expect(settings.themes[0].name).toBe('手動作成');
    });
});

// ---------- テーマの書き出しデータ ----------

describe('buildThemeExportData', () => {
    const settings = {
        oshiList: [
            { id: 'os1', name: 'A', color: '#ff0000', tags: ['ライブ'], group: 'グループA',
              memorial_dates: [{ type_id: 'bday', date: '3/21', is_annual: true }] },
            { id: 'os2', name: 'B', color: '#00ff00', tags: [], group: '',
              memorial_dates: [{ type_id: 'ev_custom', date: '5/05', is_annual: true }] },
            { id: 'os3', name: 'C', color: '#0000ff', tags: [], group: '', memorial_dates: [] },
        ],
        themes: [{ id: 'th1', name: 'T1', color: '#f472b6', oshiIds: ['os1', 'os2'] }],
        activeThemeId: null,
        event_types: [
            { id: 'bday', label: '誕生日', icon: 'cake' },
            { id: 'debut', label: 'デビュー記念日', icon: 'star' },
            { id: 'ev_custom', label: '初ライブ', icon: 'star' },
        ],
    };

    it('テーマに所属する推しのみを含める', () => {
        const { buildThemeExportData } = makeThemeIo(settings);
        const data = buildThemeExportData(settings.themes[0]);
        expect(data.oshiList.map(o => o.name)).toEqual(['A', 'B']);
    });

    it('テーマパッケージであることを示す type と version を持つ', () => {
        const { buildThemeExportData } = makeThemeIo(settings);
        const data = buildThemeExportData(settings.themes[0]);
        expect(data.type).toBe('theme_package');
        expect(data.version).toBe(1);
        expect(data.theme).toEqual({ name: 'T1', color: '#f472b6' });
    });

    it('所属推しが使用しているイベントタイプのみを含める', () => {
        const { buildThemeExportData } = makeThemeIo(settings);
        const data = buildThemeExportData(settings.themes[0]);
        expect(data.event_types.map(t => t.id).sort()).toEqual(['bday', 'ev_custom']);
    });

    it('内部IDは書き出さない（取り込み先で採番するため）', () => {
        const { buildThemeExportData } = makeThemeIo(settings);
        const data = buildThemeExportData(settings.themes[0]);
        expect(data.oshiList[0].id).toBeUndefined();
    });
});

describe('sanitizeFileName', () => {
    it('ファイル名に使えない文字を置換する', () => {
        const { sanitizeFileName } = makeThemeIo({ oshiList: [], themes: [] });
        expect(sanitizeFileName('a/b:c*d?e')).toBe('a_b_c_d_e');
    });

    it('空文字はフォールバック名を返す', () => {
        const { sanitizeFileName } = makeThemeIo({ oshiList: [], themes: [] });
        expect(sanitizeFileName('   ')).toBe('theme');
    });
});

// ---------- テーマの取り込み（マージ） ----------

describe('importThemePackage', () => {
    let settings;

    beforeEach(() => {
        settings = {
            oshiList: [{ id: 'os_existing', name: '既存推し', color: '#ff0000', tags: [], group: '', memorial_dates: [] }],
            themes: [],
            tags: [],
            event_types: [
                { id: 'bday', label: '誕生日', icon: 'cake' },
                { id: 'debut', label: 'デビュー記念日', icon: 'star' },
            ],
            localImageOrder: [],
            localImageMeta: {},
        };
    });

    const pkg = (overrides = {}) => ({
        version: 1, type: 'theme_package',
        theme: { name: '取り込みテーマ', color: '#60a5fa' },
        oshiList: [
            { name: '新規推し', color: '#123456', tags: ['ライブ'], group: 'G',
              memorial_dates: [{ type_id: 'bday', date: '1/01', is_annual: true }] },
        ],
        event_types: [],
        ...overrides,
    });

    it('テーマを追加し、新規の推しを登録する', async () => {
        const { importThemePackage } = makeThemeIo(settings);
        const result = await importThemePackage(pkg());
        expect(result.addedOshis).toBe(1);
        expect(result.reusedOshis).toBe(0);
        expect(settings.oshiList).toHaveLength(2);
        expect(settings.themes).toHaveLength(1);
        expect(settings.themes[0].name).toBe('取り込みテーマ');
    });

    it('同名の推しは既存を再利用してテーマに追加する', async () => {
        const { importThemePackage } = makeThemeIo(settings);
        const result = await importThemePackage(pkg({
            oshiList: [{ name: '既存推し', color: '#123456', tags: [], group: '', memorial_dates: [] }],
        }));
        expect(result.addedOshis).toBe(0);
        expect(result.reusedOshis).toBe(1);
        expect(settings.oshiList).toHaveLength(1);
        expect(settings.themes[0].oshiIds).toEqual(['os_existing']);
    });

    it('テーマ名が重複する場合は連番を付けて作成する', async () => {
        settings.themes = [{ id: 'th_x', name: '取り込みテーマ', color: '#f472b6', oshiIds: [] }];
        const { importThemePackage } = makeThemeIo(settings);
        const result = await importThemePackage(pkg());
        expect(result.themeName).toBe('取り込みテーマ (2)');
        expect(settings.themes).toHaveLength(2);
    });

    it('未知のイベントタイプのみをマージする', async () => {
        const { importThemePackage } = makeThemeIo(settings);
        await importThemePackage(pkg({
            event_types: [
                { id: 'bday', label: '誕生日（別名）', icon: 'cake' },
                { id: 'ev_new', label: '初配信', icon: 'star' },
            ],
        }));
        expect(settings.event_types).toHaveLength(3);
        expect(settings.event_types.find(t => t.id === 'bday').label).toBe('誕生日');
        expect(settings.event_types.find(t => t.id === 'ev_new').label).toBe('初配信');
    });

    it('取り込んだ推しのタグをマスタータグに登録する', async () => {
        const { importThemePackage } = makeThemeIo(settings);
        await importThemePackage(pkg());
        expect(settings.tags).toContain('ライブ');
    });

    it('新規の推しには一意な id が採番される', async () => {
        const { importThemePackage } = makeThemeIo(settings);
        await importThemePackage(pkg());
        const added = settings.oshiList.find(o => o.name === '新規推し');
        expect(added.id).toMatch(/^os_/);
        expect(settings.themes[0].oshiIds).toContain(added.id);
    });

    it('不正なカラーはデフォルト値に置換される', async () => {
        const { importThemePackage } = makeThemeIo(settings);
        await importThemePackage(pkg({
            theme: { name: 'T', color: 'javascript:alert(1)' },
            oshiList: [{ name: 'X', color: '<script>', tags: [], memorial_dates: [] }],
        }));
        expect(settings.themes[0].color).toBe('#f472b6');
        expect(settings.oshiList.find(o => o.name === 'X').color).toBe('#3b82f6');
    });

    it('名前のない推しは取り込まない', async () => {
        const { importThemePackage } = makeThemeIo(settings);
        const result = await importThemePackage(pkg({
            oshiList: [{ name: '', color: '#123456' }, { color: '#123456' }],
        }));
        expect(result.addedOshis).toBe(0);
        expect(settings.oshiList).toHaveLength(1);
    });

    it('不正な記念日エントリは除外される', async () => {
        const { importThemePackage } = makeThemeIo(settings);
        await importThemePackage(pkg({
            oshiList: [{
                name: 'Y', color: '#123456', tags: [],
                memorial_dates: [
                    { type_id: 'bday', date: '1/01', is_annual: true },
                    { type_id: 123, date: '2/02' },
                    null,
                ],
            }],
        }));
        expect(settings.oshiList.find(o => o.name === 'Y').memorial_dates).toHaveLength(1);
    });
});

// ---------- テーマ別の画像使用量集計 ----------

describe('computeThemeStorage', () => {
    /** 専有・共有・無関係の画像が混在する構成 */
    const makeSettings = () => ({
        oshiList: [
            { id: 'os1', name: 'アリス', tags: [] },
            { id: 'os2', name: 'ボブ', tags: [] },
            { id: 'os3', name: 'キャロル', tags: ['共通'] },
        ],
        themes: [
            { id: 'th1', name: 'T1', color: '#f472b6', oshiIds: ['os1', 'os3'] },
            { id: 'th2', name: 'T2', color: '#60a5fa', oshiIds: ['os2', 'os3'] },
        ],
        activeThemeId: null,
        localImageMeta: {
            1: { tags: ['アリス'] },      // T1 専有
            2: { tags: ['ボブ'] },        // T2 専有
            3: { tags: ['共通'] },        // T1/T2 共有（キャロル経由）
            4: { tags: ['無関係'] },      // どのテーマにも属さない
            5: { tags: [] },              // タグなし
        },
    });

    const sizeMap = new Map([[1, 1000], [2, 2000], [3, 4000], [4, 8000], [5, 16000]]);
    const keys = [1, 2, 3, 4, 5];

    it('テーマに一致する画像の枚数と合計容量を返す', () => {
        const settings = makeSettings();
        const { computeThemeStorage } = makeThemeLogic(settings);
        const stat = computeThemeStorage(settings.themes[0], sizeMap, keys);
        expect(stat.imageCount).toBe(2);          // 画像1（専有）と画像3（共有）
        expect(stat.totalBytes).toBe(5000);
    });

    it('他テーマと共有している画像は専有に含めない', () => {
        const settings = makeSettings();
        const { computeThemeStorage } = makeThemeLogic(settings);
        const stat = computeThemeStorage(settings.themes[0], sizeMap, keys);
        expect(stat.exclusiveKeys).toEqual([1]);
        expect(stat.exclusiveBytes).toBe(1000);
    });

    it('どのテーマにも属さない画像・タグなし画像は集計対象外', () => {
        const settings = makeSettings();
        const { computeThemeStorage } = makeThemeLogic(settings);
        const t1 = computeThemeStorage(settings.themes[0], sizeMap, keys);
        const t2 = computeThemeStorage(settings.themes[1], sizeMap, keys);
        expect(t1.exclusiveKeys).not.toContain(4);
        expect(t1.exclusiveKeys).not.toContain(5);
        expect(t2.exclusiveKeys).not.toContain(4);
        expect(t2.exclusiveKeys).not.toContain(5);
    });

    it('テーマが1つだけなら一致画像はすべて専有になる', () => {
        const settings = makeSettings();
        settings.themes = [settings.themes[0]];
        const { computeThemeStorage } = makeThemeLogic(settings);
        const stat = computeThemeStorage(settings.themes[0], sizeMap, keys);
        expect(stat.exclusiveKeys).toEqual([1, 3]);
        expect(stat.exclusiveBytes).toBe(5000);
    });

    it('サイズ情報が欠けている画像は 0 バイトとして扱う', () => {
        const settings = makeSettings();
        const { computeThemeStorage } = makeThemeLogic(settings);
        const stat = computeThemeStorage(settings.themes[0], new Map(), keys);
        expect(stat.imageCount).toBe(2);
        expect(stat.totalBytes).toBe(0);
    });

    it('一致する画像がなければ空の結果を返す', () => {
        const settings = makeSettings();
        settings.localImageMeta = { 1: { tags: ['無関係'] } };
        const { computeThemeStorage } = makeThemeLogic(settings);
        const stat = computeThemeStorage(settings.themes[0], sizeMap, [1]);
        expect(stat).toEqual({ imageCount: 0, totalBytes: 0, exclusiveKeys: [], exclusiveBytes: 0 });
    });
});

describe('formatBytes', () => {
    it('0 バイトは "0 MB" を返す', () => {
        const { formatBytes } = makeThemeLogic({});
        expect(formatBytes(0)).toBe('0 MB');
    });

    it('0.1MB 未満は KB 表記になる', () => {
        const { formatBytes } = makeThemeLogic({});
        expect(formatBytes(50 * 1024)).toBe('50 KB');
    });

    it('0.1MB 以上は MB 表記（小数第1位）になる', () => {
        const { formatBytes } = makeThemeLogic({});
        expect(formatBytes(12.34 * 1024 * 1024)).toBe('12.3 MB');
    });
});

// ---------- デタッチ後の再取り込み（既存テーマへの統合） ----------

describe('importThemePackage — 既存テーマへの統合', () => {
    it('mergeIntoThemeId 指定時は新規テーマを作らず既存に統合する', async () => {
        const settings = {
            oshiList: [{ id: 'os_a', name: 'アリス', color: '#ff0000', tags: [], group: '', memorial_dates: [] }],
            themes: [{ id: 'th1', name: 'チームA', color: '#f472b6', oshiIds: ['os_a'] }],
            tags: [], event_types: [{ id: 'bday', label: '誕生日', icon: 'cake' }],
            localImageOrder: [], localImageMeta: {},
        };
        const { importThemePackage } = makeThemeIo(settings);
        const result = await importThemePackage({
            version: 1, type: 'theme_package',
            theme: { name: 'チームA', color: '#f472b6' },
            oshiList: [
                { name: 'アリス', color: '#ff0000', tags: [], memorial_dates: [] },
                { name: 'ダン', color: '#0000ff', tags: [], memorial_dates: [] },
            ],
            event_types: [],
        }, 'th1');

        expect(settings.themes).toHaveLength(1);
        expect(result.themeName).toBe('チームA');
        // 既存の os_a を保ちつつ、新規の推しが追加されている
        expect(settings.themes[0].oshiIds).toContain('os_a');
        expect(settings.themes[0].oshiIds).toHaveLength(2);
    });

    it('統合時に所属推しが重複しない', async () => {
        const settings = {
            oshiList: [{ id: 'os_a', name: 'アリス', color: '#ff0000', tags: [], group: '', memorial_dates: [] }],
            themes: [{ id: 'th1', name: 'チームA', color: '#f472b6', oshiIds: ['os_a'] }],
            tags: [], event_types: [], localImageOrder: [], localImageMeta: {},
        };
        const { importThemePackage } = makeThemeIo(settings);
        await importThemePackage({
            version: 1, type: 'theme_package',
            theme: { name: 'チームA', color: '#f472b6' },
            oshiList: [{ name: 'アリス', color: '#ff0000', tags: [], memorial_dates: [] }],
            event_types: [],
        }, 'th1');

        expect(settings.themes[0].oshiIds).toEqual(['os_a']);
    });

    it('存在しない mergeIntoThemeId を渡した場合は新規テーマを作成する', async () => {
        const settings = {
            oshiList: [], themes: [], tags: [], event_types: [],
            localImageOrder: [], localImageMeta: {},
        };
        const { importThemePackage } = makeThemeIo(settings);
        await importThemePackage({
            version: 1, type: 'theme_package',
            theme: { name: '新テーマ', color: '#f472b6' },
            oshiList: [], event_types: [],
        }, 'th_missing');

        expect(settings.themes).toHaveLength(1);
        expect(settings.themes[0].name).toBe('新テーマ');
    });
});
