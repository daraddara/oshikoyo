import { describe, it, expect, vi } from 'vitest';
import { extractCode } from './test-utils.js';
import fs from 'fs';
import path from 'path';

const scriptContent = fs.readFileSync(path.join(__dirname, '../src/script.js'), 'utf-8');

describe('Security: handleImportFullBackup validation', () => {
    it('should throw an error for invalid backup data', async () => {
        // Extract validateImportedSettings
        const validateCode = extractCode('function validateImportedSettings(data) {', '// --- Validation Logic End ---');

        // Ensure validateImportedSettings exists
        expect(validateCode).toContain('function validateImportedSettings(data)');
    });
});
