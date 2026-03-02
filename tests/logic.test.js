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

    it('2020年・2021年のオリンピック特例の移動を正しく判定できること', () => {
        // 2020年の移動
        expect(getJPHoliday(new Date(2020, 6, 20))).toBeNull(); // 本来の海の日
        expect(getJPHoliday(new Date(2020, 6, 23))).toBe('海の日');
        expect(getJPHoliday(new Date(2020, 6, 24))).toBe('スポーツの日');
        expect(getJPHoliday(new Date(2020, 9, 12))).toBeNull(); // 本来のスポーツの日

        // 2021年の移動
        expect(getJPHoliday(new Date(2021, 6, 19))).toBeNull(); // 本来の海の日
        expect(getJPHoliday(new Date(2021, 6, 22))).toBe('海の日');
        expect(getJPHoliday(new Date(2021, 6, 23))).toBe('スポーツの日');
        expect(getJPHoliday(new Date(2021, 7, 8))).toBe('山の日'); // 8月8日 (特例)
        expect(getJPHoliday(new Date(2021, 7, 9))).toBe('振替休日'); // 8月9日 (振替休日)
    });

    it('体育の日とスポーツの日の名称変更を正しく判定できること', () => {
        expect(getJPHoliday(new Date(2019, 9, 14))).toBe('体育の日'); // 2019年は体育の日
        expect(getJPHoliday(new Date(2020, 6, 24))).toBe('スポーツの日'); // 2020年以降はスポーツの日
        expect(getJPHoliday(new Date(2022, 9, 10))).toBe('スポーツの日'); // 2022年
    });

    it('天皇即位の特例休日（2019年）を判定できること', () => {
        expect(getJPHoliday(new Date(2019, 3, 30))).toBe('国民の休日');
        expect(getJPHoliday(new Date(2019, 4, 1))).toBe('即位の日');
        expect(getJPHoliday(new Date(2019, 4, 2))).toBe('国民の休日');
    });
});
