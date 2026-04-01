import { describe, it, expect } from 'vitest';
import { extractCode } from './test-utils.js';

const escapeCsvFieldCode = extractCode(
    'function escapeCsvField(str) {',
    '\nfunction exportOshiAsCsv() {'
);

const escapeCsvField = new Function('str', `${escapeCsvFieldCode}; return escapeCsvField(str);`);

describe('CSV Injection (Formula Injection) in escapeCsvField', () => {
    it('should prepend a single quote to fields starting with "="', () => {
        expect(escapeCsvField('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    });

    it('should prepend a single quote to fields starting with "+"', () => {
        expect(escapeCsvField('+1+2+3')).toBe("'+1+2+3");
    });

    it('should prepend a single quote to fields starting with "-"', () => {
        expect(escapeCsvField('-5+10')).toBe("'-5+10");
    });

    it('should prepend a single quote to fields starting with "@"', () => {
        expect(escapeCsvField('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
    });

    it('should handle normal fields normally', () => {
        expect(escapeCsvField('Normal Name')).toBe('Normal Name');
    });

    it('should handle fields with commas and quotes normally (with CSV escaping)', () => {
        expect(escapeCsvField('Name, with comma')).toBe('"Name, with comma"');
        expect(escapeCsvField('Name with "quote"')).toBe('"Name with ""quote"""');
    });
});
