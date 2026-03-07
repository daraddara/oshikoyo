import { describe, it, expect } from 'vitest';
import { extractCode, loadModule } from './test-utils.js';

// Extract getContrastColor from script.js
const utilsLogic = extractCode('// Helper: Get Contrast Color (Black or White)', '// --- Holiday Logic ---');
const { getContrastColor, parseDateString } = loadModule([utilsLogic], ['getContrastColor', 'parseDateString']);

// Extract getWeekdayHeaderHTML from script.js
const weekdayHeaderLogic = extractCode('// Generate Weekday Header HTML based on startOfWeek', '// --- Popup Logic ---');
const { getWeekdayHeaderHTML } = loadModule([weekdayHeaderLogic], ['getWeekdayHeaderHTML']);

describe('getWeekdayHeaderHTML', () => {
    it('should generate headers starting with Sunday when startOfWeek is 0', () => {
        const expectedHTML = '<span class="sunday">日</span><span class="">月</span><span class="">火</span><span class="">水</span><span class="">木</span><span class="">金</span><span class="saturday">土</span>';
        expect(getWeekdayHeaderHTML(0)).toBe(expectedHTML);
    });

    it('should generate headers starting with Monday when startOfWeek is 1', () => {
        const expectedHTML = '<span class="">月</span><span class="">火</span><span class="">水</span><span class="">木</span><span class="">金</span><span class="saturday">土</span><span class="sunday">日</span>';
        expect(getWeekdayHeaderHTML(1)).toBe(expectedHTML);
    });

    it('should default to Sunday start for invalid startOfWeek values (not explicitly handled, but tests current behavior)', () => {
        // According to the function, it only checks startOfWeek === 1 to shift the array.
        // Therefore, any other value like 2, -1, or undefined will default to Sunday start.
        const expectedHTML = '<span class="sunday">日</span><span class="">月</span><span class="">火</span><span class="">水</span><span class="">木</span><span class="">金</span><span class="saturday">土</span>';
        expect(getWeekdayHeaderHTML(undefined)).toBe(expectedHTML);
        expect(getWeekdayHeaderHTML(2)).toBe(expectedHTML);
    });
});

describe('getContrastColor', () => {
    it('should return white for dark colors', () => {
        expect(getContrastColor('#000000')).toBe('#ffffff');
        expect(getContrastColor('#333333')).toBe('#ffffff');
        expect(getContrastColor('#000080')).toBe('#ffffff'); // Navy
    });

    it('should return dark gray for light colors', () => {
        expect(getContrastColor('#ffffff')).toBe('#1a1a1a');
        expect(getContrastColor('#eeeeee')).toBe('#1a1a1a');
        expect(getContrastColor('#ffff00')).toBe('#1a1a1a'); // Yellow
    });

    it('should handle 3-digit hex codes', () => {
        expect(getContrastColor('#000')).toBe('#ffffff');
        expect(getContrastColor('#fff')).toBe('#1a1a1a');
    });

    it('should return black (#000000) for invalid inputs', () => {
        expect(getContrastColor(null)).toBe('#000000');
        expect(getContrastColor(undefined)).toBe('#000000');
        expect(getContrastColor('')).toBe('#000000');
        expect(getContrastColor('ffffff')).toBe('#000000'); // Missing #
        expect(getContrastColor('#ff')).toBe('#000000'); // Invalid length
        expect(getContrastColor('#ffff')).toBe('#000000'); // Invalid length
    });

    it('should handle threshold edge cases', () => {
        // YIQ = ((r * 299) + (g * 587) + (b * 114)) / 1000
        // Threshold is 140

        // Example: #8c8c8c (140, 140, 140)
        // YIQ = (140 * 299 + 140 * 587 + 140 * 114) / 1000 = 140000 / 1000 = 140
        expect(getContrastColor('#8c8c8c')).toBe('#1a1a1a');

        // Example: Slightly below 140
        // #8b8b8b (139, 139, 139)
        // YIQ = 139
        expect(getContrastColor('#8b8b8b')).toBe('#ffffff');
    });
});

describe('parseDateString', () => {
    it('should parse "YYYY/MM/DD" format', () => {
        expect(parseDateString('2023/05/12')).toEqual({ month: 5, day: 12 });
        expect(parseDateString('2023/5/2')).toEqual({ month: 5, day: 2 });
    });

    it('should parse "YYYY-MM-DD" format', () => {
        expect(parseDateString('2023-05-12')).toEqual({ month: 5, day: 12 });
        expect(parseDateString('2023-5-2')).toEqual({ month: 5, day: 2 });
    });

    it('should parse "M/D" format', () => {
        expect(parseDateString('5/12')).toEqual({ month: 5, day: 12 });
        expect(parseDateString('12/5')).toEqual({ month: 12, day: 5 });
        expect(parseDateString('05/02')).toEqual({ month: 5, day: 2 });
    });

    it('should parse "M月D日" format', () => {
        expect(parseDateString('5月12日')).toEqual({ month: 5, day: 12 });
        expect(parseDateString('12月5日')).toEqual({ month: 12, day: 5 });
        expect(parseDateString('05月02日')).toEqual({ month: 5, day: 2 });
    });

    it('should handle "YYYY-MM-DD" standard date input value', () => {
        expect(parseDateString('2023-05-12')).toEqual({ month: 5, day: 12 });
        // NOTE: The function code has two blocks that match YYYY-MM-DD.
        // We're essentially covering both blocks with this and the first YYYY-MM-DD test.
    });

    it('should trim whitespace from the input string', () => {
        expect(parseDateString('  2023/05/12  ')).toEqual({ month: 5, day: 12 });
        expect(parseDateString('\t5/12\n')).toEqual({ month: 5, day: 12 });
        expect(parseDateString(' 5月12日 ')).toEqual({ month: 5, day: 12 });
    });

    it('should return null for invalid inputs', () => {
        expect(parseDateString(null)).toBeNull();
        expect(parseDateString(undefined)).toBeNull();
        expect(parseDateString('')).toBeNull();
        expect(parseDateString('   ')).toBeNull(); // Only whitespace
        expect(parseDateString('invalid-date')).toBeNull();
        expect(parseDateString('2023/13/45')).toEqual({ month: 13, day: 45 }); // Regex matches, semantic validation is not part of parseDateString as currently written.
        expect(parseDateString('23-05-12')).toBeNull(); // Missing digits in year
        expect(parseDateString('2023-05')).toBeNull(); // Incomplete
    });
});
