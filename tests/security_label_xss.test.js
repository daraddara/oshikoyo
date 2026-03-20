import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { setupTestEnvironment } from './test-utils.js';

// Setup environment and test-utils first
setupTestEnvironment();

let scriptModule;

beforeAll(async () => {
    // Provide variables expected globally by script.js using vi.stubGlobal
    vi.stubGlobal('appSettings', {
        startOfWeek: 0,
        oshiList: [],
        event_types: [
            { id: 'bday', label: '誕生日', icon: 'cake' }
        ]
    });
    vi.stubGlobal('TODAY', new Date(2024, 0, 1));

    // Prevent DOMContentLoaded init from firing
    vi.spyOn(document, 'addEventListener').mockImplementation(() => { });

    // Dynamically import script.js
    const imported = await import('../src/script.js');
    scriptModule = imported.default || imported;
});

describe('Security: XSS Vulnerability in renderCalendar label', () => {
    beforeEach(() => {
        // Reset DOM container for tests
        document.body.innerHTML = '<div id="calendar-container"></div>';

        // Reset internal app settings
        if (scriptModule && scriptModule.appSettings) {
            scriptModule.appSettings.oshiList = [];
            scriptModule.appSettings.event_types = [
                { id: 'bday', label: '誕生日', icon: 'cake' }
            ];
        }
    });

    it('should be fixed and escape event type label', () => {
        const container = document.getElementById('calendar-container');
        const xssPayload = '<img src=x onerror=alert("XSS_LABEL")>';

        // Assign malicious label to event_types
        const eventTypes = [
            { id: 'bday', label: xssPayload, icon: 'cake' }
        ];
        const oshiList = [{
            name: 'Test Oshi',
            memorial_dates: [{ type_id: 'bday', date: '2024/01/01', is_annual: true }],
            color: '#3b82f6'
        }];

        if (scriptModule && scriptModule.appSettings) {
            scriptModule.appSettings.event_types = eventTypes;
            scriptModule.appSettings.oshiList = oshiList;
        } else {
            throw new Error("appSettings was not exported from script.js");
        }

        // Render January 2024
        scriptModule.renderCalendar(container, 2024, 1);

        // The day cell for 1/1 should be an oshi date
        const dayCell = container.querySelector('.day-cell.is-oshi-date');
        expect(dayCell).not.toBeNull();

        // Check for the img tag - it SHOULD NOT exist if fixed
        const img = dayCell.querySelector('img[onerror*="XSS_LABEL"]');
        expect(img).toBeNull();

        // The title attribute should contain the escaped payload
        const oshiEvent = dayCell.querySelector('.oshi-event');
        expect(oshiEvent.getAttribute('title')).toContain('&lt;img src=x onerror=alert(&quot;XSS_LABEL&quot;)&gt;');
    });
});
