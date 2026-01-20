import { describe, it, expect } from 'vitest';

// Copy of the logic from script.js
function secondsToDHMS(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    seconds %= 3600 * 24;
    const h = Math.floor(seconds / 3600);
    seconds %= 3600;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return { d, h, m, s };
}

function dhmsToSeconds(d, h, m, s) {
    return (d * 86400) + (h * 3600) + (m * 60) + s;
}

describe('Interval Conversion Logic', () => {
    it('converts seconds to DHMS correctly', () => {
        // 1 day + 1 hour + 1 min + 1 sec
        // 86400 + 3600 + 60 + 1 = 90061
        const res = secondsToDHMS(90061);
        expect(res).toEqual({ d: 1, h: 1, m: 1, s: 1 });

        // Just seconds
        expect(secondsToDHMS(45)).toEqual({ d: 0, h: 0, m: 0, s: 45 });

        // Just minutes
        expect(secondsToDHMS(125)).toEqual({ d: 0, h: 0, m: 2, s: 5 });
    });

    it('converts DHMS to seconds correctly', () => {
        expect(dhmsToSeconds(1, 1, 1, 1)).toBe(90061);
        expect(dhmsToSeconds(0, 0, 0, 45)).toBe(45);
        expect(dhmsToSeconds(0, 0, 2, 5)).toBe(125);
    });

    it('round trips correctly', () => {
        const sec = 123456;
        const dhms = secondsToDHMS(sec);
        const back = dhmsToSeconds(dhms.d, dhms.h, dhms.m, dhms.s);
        expect(back).toBe(sec);
    });
});
