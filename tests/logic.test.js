import { describe, it, expect } from 'vitest';
import { extractCode, loadModule } from './test-utils.js';

// script.js からロジックを抽出
const holidayLogic = extractCode('// --- Holiday Logic ---', '// --- Calendar Generation ---');
const { getJPHoliday } = loadModule([holidayLogic], ['getJPHoliday']);

describe('祝日判定ロジック (getJPHoliday)', () => {
    it('2024年の祝日を正しく判定できること', () => {
        expect(getJPHoliday(new Date(2024, 0, 1))).toBe('元日');
        expect(getJPHoliday(new Date(2024, 0, 8))).toBe('成人の日');
        expect(getJPHoliday(new Date(2024, 1, 11))).toBe('建国記念の日');
        expect(getJPHoliday(new Date(2024, 1, 23))).toBe('天皇誕生日');
        expect(getJPHoliday(new Date(2024, 2, 20))).toBe('春分の日');
    });

    it('振替休日を正しく判定できること', () => {
        // 2024年2月11日（建国記念の日）は日曜日 -> 2月12日が振替休日
        expect(getJPHoliday(new Date(2024, 1, 12))).toBe('振替休日');
    });
});
