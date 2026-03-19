import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractCode, loadModule } from './test-utils.js';

// --- updateToggleMonthsUI ---
const monthsUILogic = extractCode(
    'function updateToggleMonthsUI(',
    'function updateLayoutMenuUI('
);
const { updateToggleMonthsUI } = loadModule([monthsUILogic], ['updateToggleMonthsUI']);

// --- updateLayoutToggleUI ---
const layoutToggleLogic = extractCode(
    'function updateLayoutToggleUI(',
    'let mediaTimer = null;'
);
const { updateLayoutToggleUI } = loadModule([layoutToggleLogic], ['updateLayoutToggleUI']);

// ============================================================
describe('updateToggleMonthsUI', () => {
    beforeEach(() => {
        global.appSettings = { monthCount: 2 };
        document.body.innerHTML = '<button id="btnToggleMonths"></button>';
    });

    afterEach(() => {
        delete global.appSettings;
        document.body.innerHTML = '';
    });

    it('1ヶ月表示時: 単体カレンダーSVGが設定されること', () => {
        global.appSettings.monthCount = 1;
        updateToggleMonthsUI();

        const btn = document.getElementById('btnToggleMonths');
        expect(btn.innerHTML).toContain('<svg');
        // 大きめ単体カレンダー: width="18" height="20"
        expect(btn.innerHTML).toContain('width="18"');
        expect(btn.innerHTML).toContain('height="20"');
        // 2枚重ねを示すopacity="0.45"のgタグを含まないこと
        expect(btn.innerHTML).not.toContain('opacity="0.45"');
    });

    it('2ヶ月表示時: 2枚重ねカレンダーSVGが設定されること', () => {
        global.appSettings.monthCount = 2;
        updateToggleMonthsUI();

        const btn = document.getElementById('btnToggleMonths');
        expect(btn.innerHTML).toContain('<svg');
        // 後ろカレンダー: opacity="0.45" のgタグを含む
        expect(btn.innerHTML).toContain('opacity="0.45"');
        // 前カレンダーのrect (x="8" y="9")
        expect(btn.innerHTML).toContain('x="8"');
    });

    it('btnToggleMonthsが存在しない場合はエラーにならないこと', () => {
        document.body.innerHTML = '';
        global.appSettings.monthCount = 1;
        expect(() => updateToggleMonthsUI()).not.toThrow();
    });
});

// ============================================================
describe('updateLayoutToggleUI', () => {
    beforeEach(() => {
        global.appSettings = { layoutDirection: 'row' };
        document.body.innerHTML = '<svg id="layoutIcon"></svg>';
    });

    afterEach(() => {
        delete global.appSettings;
        document.body.innerHTML = '';
    });

    it('横並び(row)時: 横並びカレンダーSVGが設定されること', () => {
        global.appSettings.layoutDirection = 'row';
        updateLayoutToggleUI();

        const icon = document.getElementById('layoutIcon');
        // 横並び: 左カレンダー width="10" と右カレンダー x="13"
        expect(icon.innerHTML).toContain('width="10"');
        expect(icon.innerHTML).toContain('x="13"');
        // 縦並び用の幅広矩形 width="21" を含まないこと
        expect(icon.innerHTML).not.toContain('width="21"');
    });

    it('縦並び(column)時: 縦並びカレンダーSVGが設定されること', () => {
        global.appSettings.layoutDirection = 'column';
        updateLayoutToggleUI();

        const icon = document.getElementById('layoutIcon');
        // 縦並び: 上下カレンダー width="21"
        expect(icon.innerHTML).toContain('width="21"');
        // 上カレンダー y="1.5", 下カレンダー y="13.5"
        expect(icon.innerHTML).toContain('y="1.5"');
        expect(icon.innerHTML).toContain('y="13.5"');
        // 横並び用の x="13" y="3.5" w=10 は含まないこと
        expect(icon.innerHTML).not.toContain('width="10"');
    });

    it('layoutIconが存在しない場合はエラーにならないこと', () => {
        document.body.innerHTML = '';
        global.appSettings.layoutDirection = 'row';
        expect(() => updateLayoutToggleUI()).not.toThrow();
    });
});
