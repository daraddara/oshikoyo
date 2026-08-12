/**
 * テーマ機能（themes/activeThemeId）と旧フォーカスモードからの移行のユニットテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractCode, setupTestEnvironment } from './test-utils.js';

setupTestEnvironment();

const parseDateCode  = extractCode('function parseDateString(', '\nfunction ');
const memorialCode   = extractCode('// --- Memorial Tag Logic ---', '// --- Tag Logic ---');
const tagLogicCode   = extractCode('// --- Tag Logic ---', '// --- Tag UI ---');
const settingsCode   = extractCode('function loadSettings()', '\nfunction showToast(');
const themeCode      = extractCode('// --- Theme Logic ---', '// --- Memorial Tag Logic ---');

// ---------- マイグレーション: group / activeFilter ----------

const DEFAULT_SETTINGS_BASE = {
    startOfWeek: 0,
    monthCount: 2,
    layoutDirection: 'row',
    oshiList: [],
    event_types: [
        { id: 'bday', label: '誕生日', icon: 'cake' },
        { id: 'debut', label: 'デビュー記念日', icon: 'star' },
    ],
    mediaMode: 'single',
    mediaPosition: 'top',
    mediaSize: null,
    mediaIntervalPreset: '1m',
    lastActiveInterval: '1m',
    layoutMode: 'smart',
    immersiveMode: false,
    localImageOrder: [],
    tags: [],
    localImageMeta: {},
    memorialDisplayMode: 'preferred',
    imageCompressMode: 'standard',
    activeFilter: null,
    themes: [],
    activeThemeId: null,
    themesMigratedFromGroups: false,
};

const STORAGE_KEY = 'oshikoyo_settings';

function makeLoadSettings(savedData) {
    const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue(savedData ? JSON.stringify(savedData) : null),
        setItem: vi.fn(),
    };
    const code = `
        const STORAGE_KEY = '${STORAGE_KEY}';
        const INIT_KEY = 'oshikoyo_initialized';
        let storageWasCleared = false;
        const DEFAULT_SETTINGS = ${JSON.stringify(DEFAULT_SETTINGS_BASE)};
        let appSettings = { ...DEFAULT_SETTINGS };
        const localStorage = mockLS;
        ${themeCode}
        ${settingsCode}
        return { loadSettings, getAppSettings: () => appSettings };
    `;
    return new Function('mockLS', code)(mockLocalStorage);
}

describe('loadSettings マイグレーション — group / activeFilter', () => {
    it('groupフィールドがないoshiに "" を付与する', () => {
        const { loadSettings, getAppSettings } = makeLoadSettings({
            oshiList: [{ name: 'A', color: '#fff', memorial_dates: [], tags: [] }],
        });
        loadSettings();
        expect(getAppSettings().oshiList[0].group).toBe('');
    });

    it('既存のgroupがある場合はそのまま保持する', () => {
        const { loadSettings, getAppSettings } = makeLoadSettings({
            oshiList: [{ name: 'A', color: '#fff', memorial_dates: [], tags: [], group: 'グループA' }],
        });
        loadSettings();
        expect(getAppSettings().oshiList[0].group).toBe('グループA');
    });

    it('activeFilterがないデータにnullを付与する', () => {
        const { loadSettings, getAppSettings } = makeLoadSettings({
            oshiList: [],
        });
        loadSettings();
        expect(getAppSettings().activeFilter).toBeNull();
    });

    it('activeFilterが不正な型（数値）の場合nullに上書きする', () => {
        const { loadSettings, getAppSettings } = makeLoadSettings({
            oshiList: [],
            activeFilter: 42,
        });
        loadSettings();
        expect(getAppSettings().activeFilter).toBeNull();
    });

    it('activeFilterが文字列の場合そのまま保持する', () => {
        const { loadSettings, getAppSettings } = makeLoadSettings({
            oshiList: [],
            activeFilter: 'グループB',
        });
        loadSettings();
        expect(getAppSettings().activeFilter).toBe('グループB');
    });
});

// ---------- getEffectiveImagePool (テーマフィルター) ----------

function makeFocusMode(mockAppSettings) {
    const code = `
        ${parseDateCode}
        ${tagLogicCode}
        ${themeCode}
        ${memorialCode}
        return { getTodayMemorialOshis, getEffectiveImagePool, getActiveTheme, getThemeTagSet };
    `;
    return new Function('appSettings', code)(mockAppSettings);
}

describe('getEffectiveImagePool — テーマフィルター', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

    it('activeThemeId=null の場合は既存挙動と変わらない（全pool）', () => {
        vi.setSystemTime(new Date('2026-03-21'));
        const { getEffectiveImagePool } = makeFocusMode({
            oshiList: [{ id: 'os1', name: 'A', tags: [], memorial_dates: [] }],
            localImageMeta: {},
            themes: [{ id: 'th1', name: 'T1', color: '#f472b6', oshiIds: ['os1'] }],
            activeThemeId: null,
        });
        expect(getEffectiveImagePool([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it('テーマ選択中・タグ一致画像あり → 絞り込まれる', () => {
        vi.setSystemTime(new Date('2026-03-21'));
        const meta = {
            1: { tags: ['A'] },
            2: { tags: ['B'] },
        };
        const { getEffectiveImagePool } = makeFocusMode({
            oshiList: [
                { id: 'os1', name: 'A', tags: [], memorial_dates: [] },
                { id: 'os2', name: 'B', tags: [], memorial_dates: [] },
            ],
            localImageMeta: meta,
            themes: [{ id: 'th1', name: 'T1', color: '#f472b6', oshiIds: ['os1'] }],
            activeThemeId: 'th1',
        });
        expect(getEffectiveImagePool([1, 2])).toEqual([1]);
    });

    it('テーマ選択中・一致画像なし → フォールバックで全pool', () => {
        vi.setSystemTime(new Date('2026-03-21'));
        const meta = {
            1: { tags: ['X'] },
            2: { tags: ['Y'] },
        };
        const { getEffectiveImagePool } = makeFocusMode({
            oshiList: [{ id: 'os1', name: 'A', tags: [], memorial_dates: [] }],
            localImageMeta: meta,
            themes: [{ id: 'th1', name: 'T1', color: '#f472b6', oshiIds: ['os1'] }],
            activeThemeId: 'th1',
        });
        expect(getEffectiveImagePool([1, 2])).toEqual([1, 2]);
    });

    it('存在しないテーマIDを指している場合は絞り込みを行わない', () => {
        vi.setSystemTime(new Date('2026-03-21'));
        const { getEffectiveImagePool } = makeFocusMode({
            oshiList: [{ id: 'os1', name: 'A', tags: [], memorial_dates: [] }],
            localImageMeta: { 1: { tags: ['A'] }, 2: { tags: ['B'] } },
            themes: [],
            activeThemeId: 'th_missing',
        });
        expect(getEffectiveImagePool([1, 2])).toEqual([1, 2]);
    });

    it('推しのタグ経由でも一致する（推し名以外）', () => {
        vi.setSystemTime(new Date('2026-03-21'));
        const { getEffectiveImagePool } = makeFocusMode({
            oshiList: [{ id: 'os1', name: 'A', tags: ['ライブ'], memorial_dates: [] }],
            localImageMeta: { 1: { tags: ['ライブ'] }, 2: { tags: ['B'] } },
            themes: [{ id: 'th1', name: 'T1', color: '#f472b6', oshiIds: ['os1'] }],
            activeThemeId: 'th1',
        });
        expect(getEffectiveImagePool([1, 2])).toEqual([1]);
    });

    it('記念日ロジックが先に適用され、テーマフィルターが後絞りする', () => {
        vi.setSystemTime(new Date('2026-03-21'));
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const oshiA = { id: 'os1', name: 'A', tags: [], memorial_dates: [{ date: '3/21', is_annual: true }] };
        const oshiB = { id: 'os2', name: 'B', tags: [], memorial_dates: [{ date: '3/21', is_annual: true }] };
        const meta = {
            1: { tags: ['A'] },  // テーマ内
            2: { tags: ['B'] },  // テーマ外
            3: { tags: ['C'] },  // 無関係
        };
        // exclusiveで記念日プールは[1,2]、さらにテーマフィルターで[1]
        const { getEffectiveImagePool } = makeFocusMode({
            oshiList: [oshiA, oshiB], localImageMeta: meta,
            memorialDisplayMode: 'exclusive',
            themes: [{ id: 'th1', name: 'T1', color: '#f472b6', oshiIds: ['os1'] }],
            activeThemeId: 'th1',
        });
        expect(getEffectiveImagePool([1, 2, 3])).toEqual([1]);
    });
});
