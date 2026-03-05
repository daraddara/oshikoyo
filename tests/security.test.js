import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractCode, loadModule, setupTestEnvironment } from './test-utils.js';

// Extract necessary code blocks from script.js
const constants = extractCode('const DEFAULT_SETTINGS = {', '};') + '};';
const escapeHTML = extractCode('function escapeHTML(str) {', '}');
const contrastColorLogic = extractCode('function getContrastColor(hex) {', '}');
const parseDateLogic = extractCode('function parseDateString(str) {', '}');
const holidayLogic = extractCode('// --- Holiday Logic ---', '// --- Calendar Generation ---');
const calendarLogic = extractCode('// --- Calendar Generation ---', 'function updateView() {');

// Mock external dependencies and globals
setupTestEnvironment();

// Create the module
const module = loadModule([
    'let appSettings = { startOfWeek: 0, oshiList: [] };',
    'const TODAY = new Date(2024, 0, 1);',
    constants,
    escapeHTML,
    contrastColorLogic,
    parseDateLogic,
    holidayLogic,
    'function createPopup() {}',
    'function showPopup() {}',
    'function hidePopup() {}',
    'function getWeekdayHeaderHTML() { return ""; }',
    calendarLogic
], ['renderCalendar', 'appSettings']);

const { renderCalendar, appSettings } = module;

describe('Security: XSS Vulnerability in renderCalendar', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="calendar-container"></div>';
    });

    it('should demonstrate XSS via oshi name', () => {
        const container = document.getElementById('calendar-container');
        const xssPayload = '<img src=x onerror=alert("XSS")>';

        // Setup oshi with XSS payload
        appSettings.oshiList = [{
            name: xssPayload,
            birthday: '2024/01/01', // Match the day being rendered
            color: '#3b82f6'
        }];

        // Render January 2024
        renderCalendar(container, 2024, 1);

        // Check if the payload is present as raw HTML in the day cell
        const dayCell = container.querySelector('.day-cell.is-oshi-date');
        expect(dayCell).not.toBeNull();

        // If fixed, innerHTML will contain the escaped payload
        // and no img tag should be created by the browser/jsdom
        const img = dayCell.querySelector('img');
        expect(img).toBeNull();

        // The escaped content should be visible as text
        expect(dayCell.innerHTML).toContain('&lt;img src=x onerror=alert("XSS")&gt;');
    });
});
