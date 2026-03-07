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
    vi.spyOn(document, 'addEventListener').mockImplementation(() => {});

    // Dynamically import script.js
    const imported = await import('../script.js');
    scriptModule = imported.default || imported;
});

describe('Security: XSS Vulnerability in renderCalendar via oshi.color', () => {
    beforeEach(() => {
        // Reset DOM container for tests
        document.body.innerHTML = '<div id="calendar-container"></div>';

        // Reset internal app settings list (via the exported appSettings object)
        if (scriptModule && scriptModule.appSettings) {
            scriptModule.appSettings.oshiList = [];
        }
    });

    it('should NOT be vulnerable to XSS via oshi color', () => {
        const container = document.getElementById('calendar-container');
        // Payload to break out of style attribute and div tag
        const xssPayload = '";><img src=x onerror=window.xss_vulnerable=true>';

        const list = [{
            name: 'Test Oshi',
            birthday: '2024/01/01',
            color: xssPayload
        }];

        if (scriptModule && scriptModule.appSettings) {
            scriptModule.appSettings.oshiList = list;
        } else {
            throw new Error("appSettings was not exported from script.js");
        }

        // Initialize flag
        window.xss_vulnerable = false;

        // Render January 2024
        scriptModule.renderCalendar(container, 2024, 1);

        // If FIXED, the img tag should NOT be present as an element
        const img = container.querySelector('img[src="x"]');
        expect(img).toBeNull();

        // And the flag should still be false
        expect(window.xss_vulnerable).toBe(false);

        // The payload should be present as ESCAPED text in the innerHTML
        const innerHTML = container.innerHTML;
        // In original setup `borderStyle` used `${escapedColor}` directly inside border-left, meaning the color was escaped properly.
        // `baseStyle` does the same. JSDOM serializes the `style` attribute back into `&quot;;><img`
        expect(innerHTML).toContain('&quot;;><img');
    });

    it('should NOT crash when oshi.color is missing', () => {
        const container = document.getElementById('calendar-container');
        const list = [{
            name: 'No Color Oshi',
            birthday: '2024/01/01',
            color: null // or undefined
        }];

        if (scriptModule && scriptModule.appSettings) {
            scriptModule.appSettings.oshiList = list;
        }

        // Should not throw
        expect(() => scriptModule.renderCalendar(container, 2024, 1)).not.toThrow();

        const dayCell = container.querySelector('.day-cell.is-oshi-date');
        expect(dayCell).not.toBeNull();
        expect(dayCell.textContent).toContain('No Color Oshi');
    });
});
