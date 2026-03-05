import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractCode, loadModule, setupTestEnvironment } from './test-utils.js';

// Extract necessary code blocks from script.js
const constants = extractCode('const DEFAULT_SETTINGS = {', '};') + '};';
const escapeHTML = extractCode('function escapeHTML(str) {', '}\n\n// Helper: Hex to RGB') + '}';
const contrastColorLogic = extractCode('function getContrastColor(hex) {', '}\n\n// Helper: Parse Date String') + '}';
const parseDateLogic = extractCode('function parseDateString(str) {', '}\n\n// --- Holiday Logic ---') + '}';
const holidayLogic = extractCode('// --- Holiday Logic ---', '// --- Calendar Generation ---');
const calendarLogic = extractCode('function renderCalendar(container, year, month) {', 'function updateView() {');

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
], ['renderCalendar', 'appSettings', 'TODAY']);

const { renderCalendar, appSettings } = module;

describe('Security: XSS Vulnerability in renderCalendar', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="calendar-container"></div>';
    });

    it('should demonstrate XSS via oshi name', () => {
        const container = document.createElement('div');
        container.id = 'calendar-container';
        container.querySelector = vi.fn((selector) => {
            if (selector === '.days-grid') {
                const daysGrid = document.createElement('div');
                daysGrid.className = 'days-grid';
                // Mock appendChild to just capture HTML instead of throwing if jsdom mock is incomplete
                daysGrid.appendChild = function(child) {
                     if (!this.childNodes) this.childNodes = [];
                     this.childNodes.push(child);
                };
                return daysGrid;
            }
            if (selector === '.month-title' || selector === '.weekday-header') {
                return document.createElement('div');
            }
            return null;
        });
        // Override so we can actually find the cell in the array
        const originalQuerySelector = container.querySelector;
        let capturedCells = [];
        container.querySelector = function(selector) {
            if (selector === '.days-grid') {
                const daysGrid = document.createElement('div');
                daysGrid.className = 'days-grid';
                daysGrid.appendChild = function(child) {
                    capturedCells.push(child);
                };
                return daysGrid;
            }
            if (selector === '.month-title' || selector === '.weekday-header') {
                return document.createElement('div');
            }
            return null;
        }

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
        const dayCell = capturedCells.find(n => n.classList && n.classList.add && n.classList.add.mock && n.classList.add.mock.calls.some(c => c[0] === 'is-oshi-date'));
        expect(dayCell).toBeDefined();
        expect(dayCell).not.toBeNull();

        // If fixed, innerHTML will contain the escaped payload
        // and no img tag should be created by the browser/jsdom
        const img = dayCell.querySelector('img');
        expect(img).toBeNull();

        // The escaped content should be visible as text
        expect(dayCell.innerHTML).toContain('&lt;img src=x onerror=alert(&quot;XSS&quot;)&gt;');
    });
});
