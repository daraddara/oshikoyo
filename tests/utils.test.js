import { describe, it, expect } from 'vitest';
import { extractCode, loadModule } from './test-utils.js';

// Extract getContrastColor from script.js
const utilsLogic = extractCode('// Helper: Get Contrast Color (Black or White)', '// Helper: Parse Date String to {month, day}');
const { getContrastColor } = loadModule([utilsLogic], ['getContrastColor']);

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
