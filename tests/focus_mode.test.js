/**
 * フォーカスモード（group/activeFilter）のユニットテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractCode, setupTestEnvironment } from './test-utils.js';

setupTestEnvironment();

const parseDateCode  = extractCode('function parseDateString(', '\nfunction ');
const memorialCode   = extractCode('// --- Memorial Tag Logic ---', '// --- Tag Logic ---');
const tagLogicCode   = extractCode('// --- Tag Logic ---', '// --- Tag UI ---');
const settingsCode   = extractCode('function loadSettings()', '\nfunction showToast(');

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

// ---------- getGroupHasTodayEvent / getEffectiveImagePool (group filter) ----------

function makeFocusMode(mockAppSettings, fakeToday) {
    const code = `
        ${parseDateCode}
        ${tagLogicCode}
        ${memorialCode}

        function getGroupHasTodayEvent(group) {
            return getTodayMemorialOshis().some(o => o.group === group);
        }

        return { getTodayMemorialOshis, getEffectiveImagePool, getGroupHasTodayEvent };
    `;
    return new Function('appSettings', code)(mockAppSettings);
}

describe('getGroupHasTodayEvent', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('今日が記念日の推しが指定グループに属する場合 true を返す', () => {
        vi.setSystemTime(new Date('2026-03-21'));
        const oshi = { name: 'A', group: 'グループA', tags: [], memorial_dates: [{ date: '3/21', is_annual: true }] };
        const { getGroupHasTodayEvent } = makeFocusMode({
            oshiList: [oshi], localImageMeta: {}, activeFilter: null,
        });
        expect(getGroupHasTodayEvent('グループA')).toBe(true);
    });

    it('今日が記念日の推しが別グループに属する場合 false を返す', () => {
        vi.setSystemTime(new Date('2026-03-21'));
        const oshi = { name: 'A', group: 'グループB', tags: [], memorial_dates: [{ date: '3/21', is_annual: true }] };
        const { getGroupHasTodayEvent } = makeFocusMode({
            oshiList: [oshi], localImageMeta: {}, activeFilter: null,
        });
        expect(getGroupHasTodayEvent('グループA')).toBe(false);
    });

    it('今日の記念日がない場合 false を返す', () => {
        vi.setSystemTime(new Date('2026-03-21'));
        const oshi = { name: 'A', group: 'グループA', tags: [], memorial_dates: [{ date: '4/01', is_annual: true }] };
        const { getGroupHasTodayEvent } = makeFocusMode({
            oshiList: [oshi], localImageMeta: {}, activeFilter: null,
        });
        expect(getGroupHasTodayEvent('グループA')).toBe(false);
    });
});

describe('getEffectiveImagePool — groupフィルター', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

    it('activeFilter=null の場合は既存挙動と変わらない（全pool）', () => {
        vi.setSystemTime(new Date('2026-03-21'));
        const { getEffectiveImagePool } = makeFocusMode({
            oshiList: [{ name: 'A', group: 'G1', tags: [], memorial_dates: [] }],
            localImageMeta: {},
            activeFilter: null,
        });
        expect(getEffectiveImagePool([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it('activeFilter指定・タグ一致画像あり → 絞り込まれる', () => {
        vi.setSystemTime(new Date('2026-03-21'));
        const oshi = { name: 'A', group: 'G1', tags: [], memorial_dates: [] };
        const meta = {
            1: { tags: ['A'] },
            2: { tags: ['B'] },
        };
        const { getEffectiveImagePool } = makeFocusMode({
            oshiList: [oshi], localImageMeta: meta, activeFilter: 'G1',
        });
        expect(getEffectiveImagePool([1, 2])).toEqual([1]);
    });

    it('activeFilter指定・一致画像なし → フォールバックで全pool', () => {
        vi.setSystemTime(new Date('2026-03-21'));
        const oshi = { name: 'A', group: 'G1', tags: [], memorial_dates: [] };
        const meta = {
            1: { tags: ['X'] },
            2: { tags: ['Y'] },
        };
        const { getEffectiveImagePool } = makeFocusMode({
            oshiList: [oshi], localImageMeta: meta, activeFilter: 'G1',
        });
        expect(getEffectiveImagePool([1, 2])).toEqual([1, 2]);
    });

    it('記念日ロジックが先に適用され、groupフィルターが後絞りする', () => {
        vi.setSystemTime(new Date('2026-03-21'));
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const oshiA = { name: 'A', group: 'G1', tags: [], memorial_dates: [{ date: '3/21', is_annual: true }] };
        const oshiB = { name: 'B', group: 'G2', tags: [], memorial_dates: [{ date: '3/21', is_annual: true }] };
        const meta = {
            1: { tags: ['A'] },  // G1
            2: { tags: ['B'] },  // G2
            3: { tags: ['C'] },  // 無関係
        };
        // exclusiveで記念日プールは[1,2]、さらにG1フィルターで[1]
        const { getEffectiveImagePool } = makeFocusMode({
            oshiList: [oshiA, oshiB], localImageMeta: meta,
            memorialDisplayMode: 'exclusive', activeFilter: 'G1',
        });
        expect(getEffectiveImagePool([1, 2, 3])).toEqual([1]);
    });
});
