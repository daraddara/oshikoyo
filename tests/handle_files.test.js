import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractCode, loadModule, setupTestEnvironment } from './test-utils.js';

// Setup environment for JSDOM and polyfills
setupTestEnvironment();

// Extract Preview Logic from script.js
const previewLogic = extractCode('// --- Preview Logic ---', 'function setupPreviewModal() {');

const setupCode = `
    function updateTagDatalist() {}
    function createTagInputUI() { return { id: null, replaceWith: () => {} }; }
    ${previewLogic}
    return {
        handleFiles,
        renderPreview,
        getPendingPreviewFiles: () => pendingPreviewFiles,
        setPendingPreviewFiles: (val) => { pendingPreviewFiles = val; }
    };
`;
const moduleCode = new Function(setupCode);

describe('handleFiles', () => {
    let handleFiles, renderPreview, getPendingPreviewFiles, setPendingPreviewFiles;
    let mockModal, mockGrid;

    beforeEach(() => {
        const exports = moduleCode();
        handleFiles = exports.handleFiles;
        renderPreview = exports.renderPreview;
        getPendingPreviewFiles = exports.getPendingPreviewFiles;
        setPendingPreviewFiles = exports.setPendingPreviewFiles;

        // Mock DOM elements
        mockModal = {
            showModal: vi.fn(),
            close: vi.fn()
        };
        mockGrid = {
            innerHTML: '',
            appendChild: vi.fn(), querySelectorAll: vi.fn(() => [])
        };

        global.document.getElementById = vi.fn((id) => {
            if (id === 'previewModal') return mockModal;
            if (id === 'previewGrid') return mockGrid;
            return null;
        });

        global.document.createElement = vi.fn(() => ({
            appendChild: vi.fn(), querySelectorAll: vi.fn(() => []),
            appendChild: vi.fn(), querySelectorAll: vi.fn(() => []),
        }));

        vi.clearAllMocks();
    });

    it('should return early if files is null', async () => {
        await handleFiles(null);
        expect(getPendingPreviewFiles()).toEqual([]);
        expect(mockModal.showModal).not.toHaveBeenCalled();
    });

    it('should return early if files is undefined', async () => {
        await handleFiles(undefined);
        expect(getPendingPreviewFiles()).toEqual([]);
        expect(mockModal.showModal).not.toHaveBeenCalled();
    });

    it('should return early if files array is empty', async () => {
        await handleFiles([]);
        expect(getPendingPreviewFiles()).toEqual([]);
        expect(mockModal.showModal).not.toHaveBeenCalled();
    });

    it('should filter out non-image files and not show modal if no images remain', async () => {
        const files = [
            { type: 'text/plain', name: 'test.txt' },
            { type: 'application/pdf', name: 'test.pdf' }
        ];
        await handleFiles(files);
        expect(getPendingPreviewFiles()).toEqual([]);
        expect(mockModal.showModal).not.toHaveBeenCalled();
    });

    it('should populate pendingPreviewFiles and show modal if image files are present', async () => {
        const files = [
            { type: 'image/png', name: 'test.png' },
            { type: 'text/plain', name: 'test.txt' }
        ];
        await handleFiles(files);

        const pending = getPendingPreviewFiles();
        expect(pending.length).toBe(1);
        expect(pending[0].name).toBe('test.png');
        expect(mockModal.showModal).toHaveBeenCalled();
    });
});
