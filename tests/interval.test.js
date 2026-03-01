import { describe, it, expect } from 'vitest';
import { extractCode, loadModule } from './test-utils.js';

// script.js からロジックを抽出 (DHMS 変換関数)
const intervalLogic = extractCode('// Helper: Seconds <-> DHMS', '// --- State Persistence');
const { secondsToDHMS, dhmsToSeconds } = loadModule([intervalLogic], ['secondsToDHMS', 'dhmsToSeconds']);

describe('時間間隔変換ロジック (DHMS)', () => {
    it('秒から DHMS オブジェクトへ正しく変換できること', () => {
        // 1日 + 1時間 + 1分 + 1秒 = 90061秒
        const res = secondsToDHMS(90061);
        expect(res).toEqual({ d: 1, h: 1, m: 1, s: 1 });

        expect(secondsToDHMS(45)).toEqual({ d: 0, h: 0, m: 0, s: 45 });
        expect(secondsToDHMS(125)).toEqual({ d: 0, h: 0, m: 2, s: 5 });
    });

    it('DHMS 値から合計秒数へ正しく変換できること', () => {
        expect(dhmsToSeconds(1, 1, 1, 1)).toBe(90061);
        expect(dhmsToSeconds(0, 0, 0, 45)).toBe(45);
        expect(dhmsToSeconds(0, 0, 2, 5)).toBe(125);
    });

    it('相互変換（往復）が正しく行えること', () => {
        const sec = 123456;
        const dhms = secondsToDHMS(sec);
        const back = dhmsToSeconds(dhms.d, dhms.h, dhms.m, dhms.s);
        expect(back).toBe(sec);
    });
});
