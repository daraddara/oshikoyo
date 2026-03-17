import { describe, it, expect } from 'vitest';
import { extractCode, loadModule } from './test-utils.js';

const codeBlocks = [
    extractCode('// Helper: Validate Imported Settings', '// --- Validation Logic End ---')
];

const { validateImportedSettings } = loadModule(codeBlocks, ['validateImportedSettings']);

describe('Security: Import Settings Validation', () => {
    it('should strip unknown properties', () => {
        const input = {
            startOfWeek: 1,
            maliciousProperty: '<script>alert("xss")</script>',
            oshiList: []
        };
        const result = validateImportedSettings(input);
        expect(result.maliciousProperty).toBeUndefined();
        expect(result.startOfWeek).toBe(1);
    });

    it('should reject missing or invalid oshiList', () => {
        const inputNoList = { startOfWeek: 1 };
        const inputInvalidList = { oshiList: "not an array" };

        expect(validateImportedSettings(inputNoList)).toBeNull();
        expect(validateImportedSettings(inputInvalidList)).toBeNull();
    });

    it('should sanitize oshiList item properties and set defaults', () => {
        const input = {
            oshiList: [
                {
                    name: 'Valid Name',
                    birthday: 12345, // invalid type
                    debutDate: '<script>alert(1)</script>', // string is allowed, but unexpected properties should be dropped
                    unknownProp: 'drop me'
                }
            ]
        };
        const result = validateImportedSettings(input);
        expect(result.oshiList[0].name).toBe('Valid Name');
        expect(result.oshiList[0].birthday).toBe(''); // Defaulted to empty string because of type mismatch
        expect(result.oshiList[0].debutDate).toBe('<script>alert(1)</script>'); // The script handles XSS at render time, but this ensures it's at least a string
        expect(result.oshiList[0].unknownProp).toBeUndefined();
    });

    it('should drop null or non-object items from oshiList', () => {
        const input = {
            oshiList: [
                { name: 'Oshi 1' },
                null,
                "invalid string item",
                { name: 'Oshi 2' }
            ]
        };
        const result = validateImportedSettings(input);
        expect(result.oshiList.length).toBe(2);
        expect(result.oshiList[0].name).toBe('Oshi 1');
        expect(result.oshiList[1].name).toBe('Oshi 2');
    });

    it('should prevent prototype pollution', () => {
        const payload = JSON.parse('{"__proto__":{"polluted":"yes"},"oshiList":[]}');
        const result = validateImportedSettings(payload);

        // Ensure __proto__ is not copied
        expect(result.__proto__).toBe(Object.prototype);
        expect({}.polluted).toBeUndefined();

        // Also verify the object itself doesn't contain the key
        expect(result.polluted).toBeUndefined();
    });

    it('should parse valid full settings correctly', () => {
        const input = {
            startOfWeek: 1,
            monthCount: 2,
            layoutDirection: 'column',
            mediaMode: 'random',
            mediaPosition: 'right',
            mediaSize: 300,
            mediaIntervalPreset: '10m',
            layoutMode: 'top',
            oshiList: [
                {
                    name: 'Test Oshi',
                    birthday: '2000/01/01',
                    debutDate: '2020/01/01',
                    color: '#ff0000',
                    fanArtTag: '#testart',
                    source: 'test_source.json'
                }
            ]
        };
        const result = validateImportedSettings(input);
        expect(result).toEqual(input);
    });
});
