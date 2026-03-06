import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { setupTestEnvironment } from './test-utils.js';

// Setup environment and test-utils first
setupTestEnvironment();

let scriptModule;

beforeAll(async () => {
    // Provide variables expected globally by script.js using vi.stubGlobal
    vi.stubGlobal('appSettings', { startOfWeek: 0, oshiList: [] });
    vi.stubGlobal('TODAY', new Date(2024, 0, 1));

    // Prevent DOMContentLoaded init from firing and modifying the DOM during test setup
    vi.spyOn(document, 'addEventListener').mockImplementation(() => { });

    // Dynamically import script.js
    const imported = await import('../script.js');
    scriptModule = imported.default || imported;
});

describe('Security: XSS Vulnerability in renderCalendar', () => {
    beforeEach(() => {
        // Reset DOM container for tests
        document.body.innerHTML = '<div id="calendar-container"></div>';

        // Reset internal app settings list (via the exported appSettings object)
        if (scriptModule && scriptModule.appSettings) {
            scriptModule.appSettings.oshiList = [];
        }
    });

    it('should demonstrate XSS via oshi name', () => {
        const container = document.createElement('div');
        container.id = 'calendar-container';
        container.querySelector = vi.fn((selector) => {
            if (selector === '.days-grid') {
                const daysGrid = document.createElement('div');
                daysGrid.className = 'days-grid';
                // Mock appendChild to just capture HTML instead of throwing if jsdom mock is incomplete
                daysGrid.appendChild = function (child) {
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
        container.querySelector = function (selector) {
            if (selector === '.days-grid') {
                const daysGrid = document.createElement('div');
                daysGrid.className = 'days-grid';
                daysGrid.appendChild = function (child) {
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

        // Assign the malicious payload to the module's exported appSettings
        const list = [{
            name: xssPayload,
            birthday: '2024/01/01', // Match the day being rendered (1/1/2024 since TODAY is mocked to this)
            color: '#3b82f6'
        }];

        if (scriptModule && scriptModule.appSettings) {
            scriptModule.appSettings.oshiList = list;
        } else {
            throw new Error("appSettings was not exported from script.js");
        }

        // Render January 2024
        scriptModule.renderCalendar(container, 2024, 1);

        // Verify the payload is present as raw escaped HTML in the day cell, not an actual img tag
        const dayCell = container.querySelector('.day-cell.is-oshi-date');
        expect(dayCell).not.toBeNull();

        const img = dayCell.querySelector('img');
        expect(img).toBeNull();

        // The escaped content should be visible as text
        expect(dayCell.innerHTML).toContain('&lt;img src=x onerror=alert(&quot;XSS&quot;)&gt;');
    });
});
