import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// --- Mocks Setup ---
const mockGetElementById = vi.fn();
const mockQuerySelector = vi.fn();
const mockAdjustMediaLayout = vi.fn();
const mockLocalImageDB = {
    getAllKeys: vi.fn(),
    getImage: vi.fn(),
};
const mockRevokeObjectURL = vi.fn();
const mockCreateObjectURL = vi.fn();

// Global Scope Mocks
global.document = {
    getElementById: mockGetElementById,
    querySelector: mockQuerySelector,
    createElement: (tag) => ({ style: {}, classList: { add: vi.fn(), remove: vi.fn() }, appendChild: vi.fn() }),
};
global.URL = {
    revokeObjectURL: mockRevokeObjectURL,
    createObjectURL: mockCreateObjectURL,
};
global.localImageDB = mockLocalImageDB;
global.adjustMediaLayout = mockAdjustMediaLayout;

// App Variables
global.appSettings = {
    mediaMode: 'random',
    mediaPosition: 'right',
};
global.appState = {
    lastMediaKey: 'key1',
    mediaHistory: [],
    mediaHistoryIndex: -1
};
global.saveState = vi.fn();

// --- Load Script Logic ---
const scriptPath = path.resolve(__dirname, '../script.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

// Extract updateMediaArea function
// We look for "async function updateMediaArea" and matching brace
const startStr = 'async function updateMediaArea';
const startIndex = scriptContent.indexOf(startStr);
if (startIndex === -1) throw new Error('Could not find updateMediaArea function');

// Simple extraction: assume it ends before "function adjustMediaLayout" or end of file
// Looking at the file, adjustMediaLayout comes after.
const nextFuncStr = 'function adjustMediaLayout';
const endIndex = scriptContent.indexOf(nextFuncStr, startIndex);
if (endIndex === -1) throw new Error('Could not find end of updateMediaArea function');

// We need to be careful about not cutting off the last closing brace.
// The code structure in script.js is:
// ...
// }
// 
// function adjustMediaLayout() {
// ...
// So extracting up to nextFuncStr should include the closing brace of updateMediaArea, but also some whitespace.
// A safe bet is to assume standard formatting or use a bracket counter (complex).
// Or we can just grab the compiled JS string if we can.
// Let's try a simpler approach: Eval the specific block we identified in `logic.test.js` style?
// But `updateMediaArea` calls `adjustMediaLayout` which is global.

// Let's copy the function body string and create it.
// However `updateMediaArea` is async.
// Let's use `vm` or just simple eval in global scope if we can.
// Actually, since we are in a module (test file), defining a global function via eval works.

// Let's define it by slicing.
const functionCode = scriptContent.slice(startIndex, endIndex);

// We need to execute this code to define the function in the global scope? 
// Or just evaluate it to get the function reference.
// `eval(functionCode)` will define it in the current scope if strict mode allows, or we can assign it.

// Let's evaluate it.
// Note: Vitest runs in strict mode? 
// We can wrap it: `global.updateMediaArea = ...` isn't easy with function declaration syntax.
// We can change the declaration to expression?
const funcExpression = functionCode.replace('async function updateMediaArea', 'return async function updateMediaArea');
// Wait, that changes the internal name.
// Better: `(async function updateMediaArea... )`
// But we want to call it.

// Let's simply eval it. It should be available in the scope.
let updateMediaArea;
try {
    // We wrap in a block or IIFE that returns it
    // "async function foo() {}; return foo;"
    const setupCode = `
        ${functionCode}
        return updateMediaArea;
    `;
    updateMediaArea = new Function(setupCode)();
} catch (e) {
    console.error("Failed to parse function code:", e);
}


describe('updateMediaArea Logic', () => {

    beforeEach(() => {
        vi.clearAllMocks();

        // Default Mock Returns
        mockGetElementById.mockReturnValue({ // Generic Element
            style: {},
            classList: { add: vi.fn(), remove: vi.fn() }
        });
        mockLocalImageDB.getAllKeys.mockResolvedValue(['key1', 'key2']);
        mockLocalImageDB.getImage.mockResolvedValue(new Blob([]));

        // Reset Global State
        global.appSettings = { mediaMode: 'random', mediaPosition: 'right' };
        global.appState = { lastMediaKey: 'key1', mediaHistory: [], mediaHistoryIndex: -1 };
        global.currentMediaObjectURL = null; // simulate global var

        // Mock container with querySelector for content layer
        const mockContainer = {
            style: {},
            innerHTML: '',
            querySelector: vi.fn(),
            appendChild: vi.fn()
        };
        const mockArea = { style: {} };

        mockGetElementById.mockImplementation((id) => {
            if (id === 'mediaContainer') return mockContainer;
            if (id === 'mediaArea') return mockArea;
            if (id === 'mainLayout') return { classList: { add: vi.fn(), remove: vi.fn() } };
            return null;
        });
    });

    it('should NOT fetch images or update media when mode is "layout"', async () => {
        await updateMediaArea('layout');

        // Verification
        expect(mockAdjustMediaLayout).toHaveBeenCalled();
        expect(mockLocalImageDB.getAllKeys).not.toHaveBeenCalled();
        expect(mockLocalImageDB.getImage).not.toHaveBeenCalled();
    });

    it('should fetch images when mode is "advance" (default)', async () => {
        await updateMediaArea('advance');

        expect(mockAdjustMediaLayout).toHaveBeenCalled();
        expect(mockLocalImageDB.getAllKeys).toHaveBeenCalled();
        // Should fetch an image (random behavior)
        expect(mockLocalImageDB.getImage).toHaveBeenCalled();
    });

    it('should fetch key from state when mode is "restore"', async () => {
        await updateMediaArea('restore');

        expect(mockAdjustMediaLayout).toHaveBeenCalled();
        expect(mockLocalImageDB.getAllKeys).toHaveBeenCalled();
        expect(mockLocalImageDB.getImage).toHaveBeenCalledWith('key1');
    });
});
