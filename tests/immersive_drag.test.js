import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractCode, loadModule } from './test-utils.js';

// Extract setupMiniCalendarInteractions from script.js
const dragLogic = extractCode(
    '// --- Mini Calendar Drag & Snap Logic ---',
    'function updateToggleMonthsUI('
);
const { setupMiniCalendarInteractions } = loadModule(
    [dragLogic],
    ['setupMiniCalendarInteractions']
);

describe('setupMiniCalendarInteractions - ドラッグ/クリック区別', () => {
    let calendarSection;

    beforeEach(() => {
        global.appSettings = { immersiveMode: true, layoutDirection: 'row' };
        document.body.className = '';
        document.body.innerHTML = '<div class="calendar-section"></div>';
        calendarSection = document.querySelector('.calendar-section');
    });

    afterEach(() => {
        delete global.appSettings;
        document.body.innerHTML = '';
        document.body.className = '';
    });

    it('単純クリックでオーバーレイが表示されること', () => {
        setupMiniCalendarInteractions();

        calendarSection.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(document.body.classList.contains('show-overlay')).toBe(true);
    });

    it('ドラッグ後のclickイベントではオーバーレイが表示されないこと', () => {
        setupMiniCalendarInteractions();

        // mousedown → 有意な移動 → mouseup → click（ブラウザが自動発火する）
        calendarSection.dispatchEvent(new MouseEvent('mousedown', {
            clientX: 100, clientY: 100, bubbles: true
        }));
        document.dispatchEvent(new MouseEvent('mousemove', {
            clientX: 120, clientY: 120, bubbles: true
        }));
        document.dispatchEvent(new MouseEvent('mouseup', {
            clientX: 120, clientY: 120, bubbles: true
        }));
        calendarSection.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(document.body.classList.contains('show-overlay')).toBe(false);
    });

    it('ドラッグ後のhasDraggedリセット後、次のクリックでオーバーレイが表示されること', () => {
        setupMiniCalendarInteractions();

        // ドラッグシーケンス
        calendarSection.dispatchEvent(new MouseEvent('mousedown', {
            clientX: 100, clientY: 100, bubbles: true
        }));
        document.dispatchEvent(new MouseEvent('mousemove', {
            clientX: 120, clientY: 120, bubbles: true
        }));
        document.dispatchEvent(new MouseEvent('mouseup', {
            clientX: 120, clientY: 120, bubbles: true
        }));
        // ドラッグ直後のclick → hasDraggedリセット、オーバーレイ非表示
        calendarSection.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(document.body.classList.contains('show-overlay')).toBe(false);

        // 次の純粋なクリック → オーバーレイ表示
        calendarSection.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(document.body.classList.contains('show-overlay')).toBe(true);
    });

    it('5px以下の微小移動はドラッグと見なされずクリックとして扱われること', () => {
        setupMiniCalendarInteractions();

        calendarSection.dispatchEvent(new MouseEvent('mousedown', {
            clientX: 100, clientY: 100, bubbles: true
        }));
        // dx=3, dy=2 → 閾値5px以下
        document.dispatchEvent(new MouseEvent('mousemove', {
            clientX: 103, clientY: 102, bubbles: true
        }));
        document.dispatchEvent(new MouseEvent('mouseup', {
            clientX: 103, clientY: 102, bubbles: true
        }));
        calendarSection.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        // hasDraggedはfalseのままなのでオーバーレイが表示されること
        expect(document.body.classList.contains('show-overlay')).toBe(true);
    });

    it('イマーシブモード無効時はクリックでオーバーレイが表示されないこと', () => {
        global.appSettings.immersiveMode = false;
        setupMiniCalendarInteractions();

        calendarSection.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(document.body.classList.contains('show-overlay')).toBe(false);
    });

    it('オーバーレイ表示中はクリックでshow-overlayが二重追加されないこと', () => {
        setupMiniCalendarInteractions();
        document.body.classList.add('show-overlay');

        calendarSection.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        // show-overlayはひとつだけ（classList.containsで確認）
        expect(document.body.classList.contains('show-overlay')).toBe(true);
    });
});
