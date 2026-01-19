import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// script.js のロジックをテストするために、簡易的な環境を構築します
// 実際のファイルからロジックを読み込むか、ここにロジックをコピーします。
// 今回は script.js 内の getJPHoliday 関数等を抽出してテストします。

const scriptPath = path.resolve(__dirname, '../script.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

// テスト用に getJPHoliday 関数を eval か Function で取得（簡易版）
// 本来は script.js をモジュール化するのが望ましいが、現状の vanilla JS 形式を維持
const getJPHoliday = new Function('date', `
    ${scriptContent.split('// --- Holiday Logic ---')[1].split('// --- Calendar Generation ---')[0]}
    return getJPHoliday(date);
`);

describe('祝日計算ロジック (getJPHoliday)', () => {
    it('元日 (1月1日) を正しく判定できる', () => {
        expect(getJPHoliday(new Date(2024, 0, 1))).toBe('元日');
    });

    it('成人の日 (1月第2月曜日) を正しく判定できる', () => {
        expect(getJPHoliday(new Date(2024, 0, 8))).toBe('成人の日'); // 2024年1月8日は第2月曜
    });

    it('春分の日を計算できる (2024年)', () => {
        expect(getJPHoliday(new Date(2024, 2, 20))).toBe('春分の日');
    });

    it('振替休日を判定できる (2024年2月12日)', () => {
        // 2月11日(日) 建国記念の日 -> 2月12日(月) 振替休日
        expect(getJPHoliday(new Date(2024, 1, 12))).toBe('振替休日');
    });

    it('祝日でない日は null を返す', () => {
        expect(getJPHoliday(new Date(2024, 0, 2))).toBeNull();
    });
});
