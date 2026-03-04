/**
 * @jest-environment jsdom
 */

// Note: If jsdom is not set up in vitest config, we might need to rely on basic string checks or setup.
// Checking package.json will verify if jsdom is available.

import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

describe('DOM Structure', () => {
    const htmlPath = path.resolve(__dirname, '../index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    it('should have key elements required by script.js', () => {
        // Critical elements that caused the crash if missing
        expect(htmlContent).toContain('id="mediaMode"');
        expect(htmlContent).toContain('id="btnSettings"');
        expect(htmlContent).toContain('id="settingsModal"');
    });

    it('should have valid select structure for mediaMode', () => {
        // Ensure the tag is opened correctly
        expect(htmlContent).toMatch(/<select[^>]*id="mediaMode"/);
    });

    it('should have new settings guide and reset button', () => {
        expect(htmlContent).toContain('class="settings-guide"');
        expect(htmlContent).toContain('id="btnResetLayout"');
    });
});
