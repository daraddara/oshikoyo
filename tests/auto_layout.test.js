import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { extractCode, loadModule } from './test-utils.js';

// Extract applyAutoLayout from script.js
const autoLayoutLogic = extractCode('function applyAutoLayout(img) {', '/**\n * Saves settings to localStorage');
const { applyAutoLayout } = loadModule([autoLayoutLogic], ['applyAutoLayout']);

describe('applyAutoLayout', () => {
    beforeEach(() => {
        // Mock global appSettings
        global.appSettings = {
            autoLayoutMode: true,
            mediaPosition: 'top',
            layoutDirection: 'row'
        };

        // Mock dependencies
        global.saveSettingsSilently = vi.fn();
        global.updateLayoutToggleUI = vi.fn();
        global.updateView = vi.fn();

        // Mock console methods to keep test output clean, but allow spy
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete global.appSettings;
        delete global.saveSettingsSilently;
        delete global.updateLayoutToggleUI;
        delete global.updateView;
    });

    it('should change layout to Top/Row for Landscape image (ratio >= 1.2)', () => {
        global.appSettings.mediaPosition = 'left';
        global.appSettings.layoutDirection = 'column';

        const mockImg = { naturalWidth: 1200, naturalHeight: 600 };
        applyAutoLayout(mockImg);

        expect(global.appSettings.mediaPosition).toBe('top');
        expect(global.appSettings.layoutDirection).toBe('row');
        expect(global.saveSettingsSilently).toHaveBeenCalled();
        expect(global.updateLayoutToggleUI).toHaveBeenCalled();
        expect(global.updateView).toHaveBeenCalled();
    });

    it('should change layout to Left/Column for Portrait image (invRatio >= 1.2)', () => {
        const mockImg = { naturalWidth: 600, naturalHeight: 1200 };
        applyAutoLayout(mockImg);

        expect(global.appSettings.mediaPosition).toBe('left');
        expect(global.appSettings.layoutDirection).toBe('column');
        expect(global.saveSettingsSilently).toHaveBeenCalled();
        expect(global.updateLayoutToggleUI).toHaveBeenCalled();
        expect(global.updateView).toHaveBeenCalled();
    });

    it('should change layout to Top/Row for Default/Square image', () => {
        global.appSettings.mediaPosition = 'left';
        global.appSettings.layoutDirection = 'column';

        const mockImg = { naturalWidth: 1000, naturalHeight: 1000 };
        applyAutoLayout(mockImg);

        expect(global.appSettings.mediaPosition).toBe('top');
        expect(global.appSettings.layoutDirection).toBe('row');
        expect(global.saveSettingsSilently).toHaveBeenCalled();
        expect(global.updateLayoutToggleUI).toHaveBeenCalled();
        expect(global.updateView).toHaveBeenCalled();
    });

    it('should not change layout if autoLayoutMode is false', () => {
        global.appSettings.autoLayoutMode = false;
        global.appSettings.mediaPosition = 'top';
        global.appSettings.layoutDirection = 'row';

        const mockImg = { naturalWidth: 600, naturalHeight: 1200 }; // Portrait, normally triggers Left/Column
        applyAutoLayout(mockImg);

        expect(global.appSettings.mediaPosition).toBe('top');
        expect(global.appSettings.layoutDirection).toBe('row');
        expect(global.saveSettingsSilently).not.toHaveBeenCalled();
    });

    it('should skip adjustment if image dimensions are zero', () => {
        const mockImg1 = { naturalWidth: 0, naturalHeight: 600 };
        const mockImg2 = { naturalWidth: 1200, naturalHeight: 0 };
        const mockImg3 = { naturalWidth: 0, naturalHeight: 0 };

        applyAutoLayout(mockImg1);
        applyAutoLayout(mockImg2);
        applyAutoLayout(mockImg3);

        expect(console.warn).toHaveBeenCalledTimes(3);
        expect(global.saveSettingsSilently).not.toHaveBeenCalled();
    });

    it('should not call update functions if layout is already optimal', () => {
        // Landscape image, already Top/Row
        global.appSettings.mediaPosition = 'top';
        global.appSettings.layoutDirection = 'row';

        const mockImg = { naturalWidth: 1200, naturalHeight: 600 };
        applyAutoLayout(mockImg);

        expect(global.saveSettingsSilently).not.toHaveBeenCalled();
        expect(global.updateLayoutToggleUI).not.toHaveBeenCalled();
        expect(global.updateView).not.toHaveBeenCalled();
    });
});
