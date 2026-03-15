import { describe, it, expect } from 'vitest';
import { extractCode, loadModule, setupTestEnvironment } from './test-utils.js';

// Ensure test environment is setup (polyfills Blob.arrayBuffer, etc)
setupTestEnvironment();

// Extract getContrastColor from script.js
const utilsLogic = extractCode('// Helper: Get Contrast Color (Black or White)', '// --- Holiday Logic ---');
const { getContrastColor, parseDateString, hexToRgba } = loadModule([utilsLogic], ['getContrastColor', 'parseDateString', 'hexToRgba']);

// Extract blobToBase64 from script.js
const base64Logic = extractCode('// Helper: Blob to Base64', '// Helper: Base64 to Blob');
const { blobToBase64 } = loadModule([base64Logic], ['blobToBase64']);

// Extract getWeekdayHeaderHTML from script.js
const weekdayHeaderLogic = extractCode('// Generate Weekday Header HTML based on startOfWeek', '// --- Popup Logic ---');
const { getWeekdayHeaderHTML } = loadModule([weekdayHeaderLogic], ['getWeekdayHeaderHTML']);

// Extract base64ToBlob from script.js
const base64ToBlobLogic = extractCode('// Helper: Base64 to Blob', '// Helper: Compare Blobs');
const { base64ToBlob } = loadModule([base64ToBlobLogic], ['base64ToBlob']);

describe('getWeekdayHeaderHTML', () => {
    it('should generate headers starting with Sunday when startOfWeek is 0', () => {
        const expectedHTML = '<span class="sunday">日</span><span class="">月</span><span class="">火</span><span class="">水</span><span class="">木</span><span class="">金</span><span class="saturday">土</span>';
        expect(getWeekdayHeaderHTML(0)).toBe(expectedHTML);
    });

    it('should generate headers starting with Monday when startOfWeek is 1', () => {
        const expectedHTML = '<span class="">月</span><span class="">火</span><span class="">水</span><span class="">木</span><span class="">金</span><span class="saturday">土</span><span class="sunday">日</span>';
        expect(getWeekdayHeaderHTML(1)).toBe(expectedHTML);
    });

    it('should default to Sunday start for invalid startOfWeek values (not explicitly handled, but tests current behavior)', () => {
        // According to the function, it only checks startOfWeek === 1 to shift the array.
        // Therefore, any other value like 2, -1, or undefined will default to Sunday start.
        const expectedHTML = '<span class="sunday">日</span><span class="">月</span><span class="">火</span><span class="">水</span><span class="">木</span><span class="">金</span><span class="saturday">土</span>';
        expect(getWeekdayHeaderHTML(undefined)).toBe(expectedHTML);
        expect(getWeekdayHeaderHTML(2)).toBe(expectedHTML);
    });
});

describe('base64ToBlob', () => {
    it('should throw an error for invalid base64 data types', () => {
        expect(() => base64ToBlob(null, 'image/png')).toThrow('Invalid base64 data');
        expect(() => base64ToBlob(undefined, 'image/png')).toThrow('Invalid base64 data');
        expect(() => base64ToBlob('', 'image/png')).toThrow('Invalid base64 data');
        expect(() => base64ToBlob(123, 'image/png')).toThrow('Invalid base64 data');
        expect(() => base64ToBlob({}, 'image/png')).toThrow('Invalid base64 data');
    });

    it('should throw an error for invalid Data URI missing a comma', () => {
        const invalidDataUri = 'data:image/png;base64SGVsbG8gV29ybGQ=';
        expect(() => base64ToBlob(invalidDataUri, 'image/png')).toThrow('Invalid Data URI: no comma found');
    });

    it('should throw an error for invalid base64 encoding (atob failure)', () => {
        // 'invalid_base64!' contains invalid characters for base64
        expect(() => base64ToBlob('invalid_base64!', 'image/png')).toThrow('Failed to decode base64 string');
    });

    it('should convert raw base64 string to a Blob with the specified mimeType', async () => {
        // "Hello World" in base64 is "SGVsbG8gV29ybGQ="
        const rawBase64 = 'SGVsbG8gV29ybGQ=';
        const blob = base64ToBlob(rawBase64, 'text/plain');

        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe('text/plain');

        const buffer = await blob.arrayBuffer();
        const text = new TextDecoder().decode(buffer);
        expect(text).toBe('Hello World');
    });

    it('should convert a data URI to a Blob and extract the mimeType from the URI', async () => {
        // "Hello World" encoded as a text/plain data URI
        const dataUri = 'data:text/plain;base64,SGVsbG8gV29ybGQ=';
        // Passing a different fallback mimeType to verify it uses the one from the URI
        const blob = base64ToBlob(dataUri, 'image/png');

        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe('text/plain');

        const buffer = await blob.arrayBuffer();
        const text = new TextDecoder().decode(buffer);
        expect(text).toBe('Hello World');
    });

    it('should fallback to provided mimeType if data URI parsing fails to find mimeType', async () => {
        // Data URI missing the mime part before the semicolon, e.g., "data:;base64,..."
        // The regex in the function is `/:(.*?);/` so "data:;base64," matches empty string
        // Actually, "data:;base64," has metadata "data:" which doesn't contain a semicolon.
        // Wait, the code does `metadata.match(/:(.*?);/)`. If metadata is "data:base64", it might fail.
        // Let's test a simple valid case without mime type in data uri.
        const dataUri = 'data:base64,SGVsbG8gV29ybGQ=';
        const blob = base64ToBlob(dataUri, 'application/octet-stream');

        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe('application/octet-stream');

        const buffer = await blob.arrayBuffer();
        const text = new TextDecoder().decode(buffer);
        expect(text).toBe('Hello World');
    });
});

describe('getContrastColor', () => {
    it('should return white for dark colors', () => {
        expect(getContrastColor('#000000')).toBe('#ffffff');
        expect(getContrastColor('#333333')).toBe('#ffffff');
        expect(getContrastColor('#000080')).toBe('#ffffff'); // Navy
    });

    it('should return dark gray for light colors', () => {
        expect(getContrastColor('#ffffff')).toBe('#1a1a1a');
        expect(getContrastColor('#eeeeee')).toBe('#1a1a1a');
        expect(getContrastColor('#ffff00')).toBe('#1a1a1a'); // Yellow
    });

    it('should handle 3-digit hex codes', () => {
        expect(getContrastColor('#000')).toBe('#ffffff');
        expect(getContrastColor('#fff')).toBe('#1a1a1a');
    });

    it('should return black (#000000) for invalid inputs', () => {
        expect(getContrastColor(null)).toBe('#000000');
        expect(getContrastColor(undefined)).toBe('#000000');
        expect(getContrastColor('')).toBe('#000000');
        expect(getContrastColor('ffffff')).toBe('#000000'); // Missing #
        expect(getContrastColor('#ff')).toBe('#000000'); // Invalid length
        expect(getContrastColor('#ffff')).toBe('#000000'); // Invalid length
    });

    it('should handle threshold edge cases', () => {
        // YIQ = ((r * 299) + (g * 587) + (b * 114)) / 1000
        // Threshold is 140

        // Example: #8c8c8c (140, 140, 140)
        // YIQ = (140 * 299 + 140 * 587 + 140 * 114) / 1000 = 140000 / 1000 = 140
        expect(getContrastColor('#8c8c8c')).toBe('#1a1a1a');

        // Example: Slightly below 140
        // #8b8b8b (139, 139, 139)
        // YIQ = 139
        expect(getContrastColor('#8b8b8b')).toBe('#ffffff');
    });
});

describe('hexToRgba', () => {
    it('should return the original string if missing hash or invalid', () => {
        expect(hexToRgba(null, 1)).toBeNull();
        expect(hexToRgba(undefined, 1)).toBeUndefined();
        expect(hexToRgba('', 1)).toBe('');
        expect(hexToRgba('ff0000', 1)).toBe('ff0000');
    });

    it('should correctly parse 3-character hex codes', () => {
        expect(hexToRgba('#f00', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
        expect(hexToRgba('#0f0', 1)).toBe('rgba(0, 255, 0, 1)');
        expect(hexToRgba('#00f', 0)).toBe('rgba(0, 0, 255, 0)');
        expect(hexToRgba('#fff', 0.8)).toBe('rgba(255, 255, 255, 0.8)');
    });

    it('should correctly parse 6-character hex codes', () => {
        expect(hexToRgba('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
        expect(hexToRgba('#00ff00', 1)).toBe('rgba(0, 255, 0, 1)');
        expect(hexToRgba('#0000ff', 0)).toBe('rgba(0, 0, 255, 0)');
        expect(hexToRgba('#ffffff', 0.8)).toBe('rgba(255, 255, 255, 0.8)');
        expect(hexToRgba('#8c8c8c', 0.3)).toBe('rgba(140, 140, 140, 0.3)');
    });
});

describe('parseDateString', () => {
    it('should parse "YYYY/MM/DD" format', () => {
        expect(parseDateString('2023/05/12')).toEqual({ month: 5, day: 12 });
        expect(parseDateString('2023/5/2')).toEqual({ month: 5, day: 2 });
    });

    it('should parse "YYYY-MM-DD" format', () => {
        expect(parseDateString('2023-05-12')).toEqual({ month: 5, day: 12 });
        expect(parseDateString('2023-5-2')).toEqual({ month: 5, day: 2 });
    });

    it('should parse "M/D" format', () => {
        expect(parseDateString('5/12')).toEqual({ month: 5, day: 12 });
        expect(parseDateString('12/5')).toEqual({ month: 12, day: 5 });
        expect(parseDateString('05/02')).toEqual({ month: 5, day: 2 });
    });

    it('should parse "M月D日" format', () => {
        expect(parseDateString('5月12日')).toEqual({ month: 5, day: 12 });
        expect(parseDateString('12月5日')).toEqual({ month: 12, day: 5 });
        expect(parseDateString('05月02日')).toEqual({ month: 5, day: 2 });
    });

    it('should handle "YYYY-MM-DD" standard date input value', () => {
        expect(parseDateString('2023-05-12')).toEqual({ month: 5, day: 12 });
        // NOTE: The function code has two blocks that match YYYY-MM-DD.
        // We're essentially covering both blocks with this and the first YYYY-MM-DD test.
    });

    it('should trim whitespace from the input string', () => {
        expect(parseDateString('  2023/05/12  ')).toEqual({ month: 5, day: 12 });
        expect(parseDateString('\t5/12\n')).toEqual({ month: 5, day: 12 });
        expect(parseDateString(' 5月12日 ')).toEqual({ month: 5, day: 12 });
    });

    it('should return null for invalid inputs', () => {
        expect(parseDateString(null)).toBeNull();
        expect(parseDateString(undefined)).toBeNull();
        expect(parseDateString('')).toBeNull();
        expect(parseDateString('   ')).toBeNull(); // Only whitespace
        expect(parseDateString('invalid-date')).toBeNull();
        expect(parseDateString('2023/13/45')).toEqual({ month: 13, day: 45 }); // Regex matches, semantic validation is not part of parseDateString as currently written.
        expect(parseDateString('23-05-12')).toBeNull(); // Missing digits in year
        expect(parseDateString('2023-05')).toBeNull(); // Incomplete
    });
});

describe('blobToBase64', () => {
    it('should convert a Blob to a Base64 string', async () => {
        // Create a simple text blob
        const textData = 'test data';
        const blob = new Blob([textData], { type: 'text/plain' });

        // Wait for the conversion
        const base64String = await blobToBase64(blob);

        // Assert it starts with the correct data URI prefix and contains the correct encoded text
        expect(base64String).toMatch(/^data:text\/plain;base64,/);

        // "test data" in base64 is "dGVzdCBkYXRh"
        expect(base64String).toBe('data:text/plain;base64,dGVzdCBkYXRh');
    });

    it('should reject the promise if FileReader encounters an error', async () => {
        // We'll mock FileReader's readAsDataURL to simulate an error
        const originalFileReader = global.FileReader;

        // A minimal mock FileReader that just throws an error when readAsDataURL is called
        class MockFileReader {
            constructor() {
                this.error = new Error('Simulated FileReader error');
            }
            readAsDataURL() {
                if (this.onerror) {
                    this.onerror(this.error);
                }
            }
        }

        global.FileReader = MockFileReader;

        try {
            const blob = new Blob(['error test'], { type: 'text/plain' });
            await expect(blobToBase64(blob)).rejects.toThrow('Simulated FileReader error');
        } finally {
            // Restore original FileReader
            global.FileReader = originalFileReader;
        }
    });
});
