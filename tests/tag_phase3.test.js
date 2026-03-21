import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractCode, setupTestEnvironment } from './test-utils.js';

setupTestEnvironment();

// 必要なコードブロックを抽出
const parseDateCode  = extractCode('function parseDateString(', '\nfunction ');
const memorialCode   = extractCode('// --- Memorial Tag Logic ---', '// --- Tag Logic ---');
const tagLogicCode   = extractCode('// --- Tag Logic ---', '// --- Tag UI ---');

/**
 * getTodayMemorialOshis / getEffectiveImagePool をテスト用に生成する
 * @param {object} mockAppSettings
 * @param {Date} fakeToday - vi.setSystemTime に渡す日付
 */
function makePhase3(mockAppSettings, fakeToday) {
    const code = `
        ${parseDateCode}
        ${tagLogicCode}
        ${memorialCode}
        return { getTodayMemorialOshis, getEffectiveImagePool };
    `;
    return new Function('appSettings', code)(mockAppSettings);
}

// ---------- getTodayMemorialOshis ----------

describe('getTodayMemorialOshis', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('記念日がない場合は空配列を返す', () => {
        vi.setSystemTime(new Date('2026-03-21'));
        const { getTodayMemorialOshis } = makePhase3({
            oshiList: [{ name: 'A', memorial_dates: [] }],
            localImageMeta: {}
        });
        expect(getTodayMemorialOshis()).toEqual([]);
    });

    it('今日が is_annual 記念日の推しを返す', () => {
        vi.setSystemTime(new Date('2026-03-21'));
        const oshi = { name: 'A', tags: [], memorial_dates: [{ date: '3/21', is_annual: true }] };
        const { getTodayMemorialOshis } = makePhase3({ oshiList: [oshi], localImageMeta: {} });
        expect(getTodayMemorialOshis()).toHaveLength(1);
        expect(getTodayMemorialOshis()[0].name).toBe('A');
    });

    it('is_annual:false かつ年が違う場合はマッチしない', () => {
        vi.setSystemTime(new Date('2026-03-21'));
        const oshi = { name: 'A', tags: [], memorial_dates: [{ date: '2025/3/21', is_annual: false }] };
        const { getTodayMemorialOshis } = makePhase3({ oshiList: [oshi], localImageMeta: {} });
        expect(getTodayMemorialOshis()).toEqual([]);
    });

    it('is_annual:false かつ年が一致する場合はマッチする', () => {
        vi.setSystemTime(new Date('2026-03-21'));
        const oshi = { name: 'A', tags: [], memorial_dates: [{ date: '2026/3/21', is_annual: false }] };
        const { getTodayMemorialOshis } = makePhase3({ oshiList: [oshi], localImageMeta: {} });
        expect(getTodayMemorialOshis()).toHaveLength(1);
    });

    it('複数推しのうち今日が記念日の推しのみ返す', () => {
        vi.setSystemTime(new Date('2026-03-21'));
        const oshiA = { name: 'A', tags: [], memorial_dates: [{ date: '3/21', is_annual: true }] };
        const oshiB = { name: 'B', tags: [], memorial_dates: [{ date: '4/01', is_annual: true }] };
        const { getTodayMemorialOshis } = makePhase3({ oshiList: [oshiA, oshiB], localImageMeta: {} });
        const result = getTodayMemorialOshis();
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('A');
    });
});

// ---------- getEffectiveImagePool ----------

describe('getEffectiveImagePool', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('記念日なしの場合 orderedKeys をそのまま返す', () => {
        vi.setSystemTime(new Date('2026-03-21'));
        const { getEffectiveImagePool } = makePhase3({
            oshiList: [{ name: 'A', tags: [], memorial_dates: [] }],
            localImageMeta: {}
        });
        expect(getEffectiveImagePool([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it('記念日あり・タグ一致画像あり → 絞り込んだプールを返す', () => {
        vi.setSystemTime(new Date('2026-03-21'));
        const oshi = { name: 'A', tags: [], memorial_dates: [{ date: '3/21', is_annual: true }] };
        const meta = {
            1: { tags: ['A'] },    // 一致
            2: { tags: ['B'] },    // 不一致
            3: { tags: ['A', 'C'] } // 一致
        };
        const { getEffectiveImagePool } = makePhase3({ oshiList: [oshi], localImageMeta: meta });
        expect(getEffectiveImagePool([1, 2, 3])).toEqual([1, 3]);
    });

    it('記念日あり・タグ一致画像なし → orderedKeys にフォールバック', () => {
        vi.setSystemTime(new Date('2026-03-21'));
        const oshi = { name: 'A', tags: [], memorial_dates: [{ date: '3/21', is_annual: true }] };
        const meta = {
            1: { tags: ['X'] },
            2: { tags: ['Y'] }
        };
        const { getEffectiveImagePool } = makePhase3({ oshiList: [oshi], localImageMeta: meta });
        expect(getEffectiveImagePool([1, 2])).toEqual([1, 2]);
    });

    it('推し名ではなく oshiList[].tags のタグで一致する', () => {
        vi.setSystemTime(new Date('2026-03-21'));
        const oshi = { name: 'A', tags: ['衣装B'], memorial_dates: [{ date: '3/21', is_annual: true }] };
        const meta = {
            1: { tags: ['衣装B'] },
            2: { tags: ['その他'] }
        };
        const { getEffectiveImagePool } = makePhase3({ oshiList: [oshi], localImageMeta: meta });
        expect(getEffectiveImagePool([1, 2])).toEqual([1]);
    });

    it('複数の記念日推し → 和集合タグでマッチ', () => {
        vi.setSystemTime(new Date('2026-03-21'));
        const oshiA = { name: 'A', tags: [], memorial_dates: [{ date: '3/21', is_annual: true }] };
        const oshiB = { name: 'B', tags: [], memorial_dates: [{ date: '3/21', is_annual: true }] };
        const meta = {
            1: { tags: ['A'] },
            2: { tags: ['B'] },
            3: { tags: ['C'] }
        };
        const { getEffectiveImagePool } = makePhase3({ oshiList: [oshiA, oshiB], localImageMeta: meta });
        expect(getEffectiveImagePool([1, 2, 3])).toEqual([1, 2]);
    });

    it('localImageMeta が空でも orderedKeys にフォールバックする', () => {
        vi.setSystemTime(new Date('2026-03-21'));
        const oshi = { name: 'A', tags: [], memorial_dates: [{ date: '3/21', is_annual: true }] };
        const { getEffectiveImagePool } = makePhase3({ oshiList: [oshi], localImageMeta: {} });
        expect(getEffectiveImagePool([1, 2, 3])).toEqual([1, 2, 3]);
    });
});
