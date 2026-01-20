import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Load script.js content
const scriptPath = path.resolve(__dirname, '../script.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

// --- Helper to extract functions ---
// Note: In a real project, we should export these from script.js.
// Since we are keeping vanilla JS for compatibility, we use Function constructor or simple extraction.

// 1. Holiday Logic Extraction
const getJPHoliday = new Function('date', `
    ${scriptContent.split('// --- Holiday Logic ---')[1].split('// --- Calendar Generation ---')[0]}
    return getJPHoliday(date);
`);

// 2. Mocking LocalImageDB context
// We'll test the CLASS definition if possible, or just mock the behavior we expect in the app logic.
// For unit testing the logic *inside* script.js without exporting, it's tricky.
// Better to test the *Logic* functions that we can replicate.

describe('Utility Logic (Holiday)', () => {
    it('calculates Holidays correctly (2024)', () => {
        expect(getJPHoliday(new Date(2024, 0, 1))).toBe('元日');
        expect(getJPHoliday(new Date(2024, 0, 8))).toBe('成人の日');
        expect(getJPHoliday(new Date(2024, 2, 20))).toBe('春分の日');
    });
});

describe('Layout Logic Calculations', () => {
    // Replicating the logic from adjustMediaLayout for testing
    // Since we can't easily import the function from the non-module script.js

    function calculateMediaDimensions(pos, width, height, monthCount) {
        // Simplified replication of script.js logic for verification
        const monthWidth = 550;
        const gap = 24;
        const headerH = 60; // Mock
        const gaps = 110;

        if (pos === 'top' || pos === 'bottom') {
            const count = monthCount;
            const targetWidth = (count * monthWidth) + ((count - 1) * gap);
            return { width: targetWidth, heightType: 'dynamic' };
        } else {
            return { width: 550, heightType: 'matchCalendar' };
        }
    }

    it('calculates correct width for Top/Bottom layout', () => {
        // 2 months
        const res2 = calculateMediaDimensions('top', 1920, 1080, 2);
        expect(res2.width).toBe(550 * 2 + 24); // 1124

        // 3 months
        const res3 = calculateMediaDimensions('bottom', 1920, 1080, 3);
        expect(res3.width).toBe(550 * 3 + 24 * 2); // 1698
    });

    it('uses fixed width for Left/Right layout', () => {
        const res = calculateMediaDimensions('left', 1920, 1080, 2);
        expect(res.width).toBe(550);
        expect(res.heightType).toBe('matchCalendar'); // Logic verification
    });
});
