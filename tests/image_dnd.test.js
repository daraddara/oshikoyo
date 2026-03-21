// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { setupTestEnvironment } from './test-utils.js';

setupTestEnvironment();

/**
 * setupImageGridDnD の drop ハンドラーが行う localImageOrder 更新ロジックを
 * 純粋関数として再現してテストする。
 *
 * 元コード（src/script.js setupImageGridDnD drop ハンドラー）:
 *   const srcId = Number(items[_imgDragSrcIndex].dataset.imgId);
 *   const tgtId = Number(items[tgtIdx].dataset.imgId);
 *   const order = [...localImageOrder];
 *   const srcPos = order.indexOf(srcId);
 *   order.splice(srcPos, 1);
 *   const tgtPos = order.indexOf(tgtId);
 *   order.splice(insertBefore ? tgtPos : tgtPos + 1, 0, srcId);
 *
 * @param {number[]} localImageOrder - 全画像の現在の順序
 * @param {number[]} displayIds      - DOM に表示されているアイテムのID（フィルター後）
 * @param {number}   srcIdx          - ドラッグ元の DOM インデックス
 * @param {number}   tgtIdx          - ドロップ先の DOM インデックス
 * @param {boolean}  insertBefore    - true=tgt の前、false=tgt の後
 * @returns {number[]} 並び替え後の localImageOrder
 */
function applyDrop(localImageOrder, displayIds, srcIdx, tgtIdx, insertBefore) {
    const srcId = displayIds[srcIdx];
    const tgtId = displayIds[tgtIdx];

    const order = [...localImageOrder];
    const srcPos = order.indexOf(srcId);
    if (srcPos === -1) throw new Error(`srcId ${srcId} not in order`);
    order.splice(srcPos, 1);

    const tgtPos = order.indexOf(tgtId);
    if (tgtPos === -1) throw new Error(`tgtId ${tgtId} not in order`);
    order.splice(insertBefore ? tgtPos : tgtPos + 1, 0, srcId);

    return order;
}

// ─────────────────────────────────────────
// フィルターなし（全画像表示）
// ─────────────────────────────────────────
describe('D&D 並び替えロジック — フィルターなし', () => {
    it('前方移動: id=3(idx2) を id=1(idx0) の前に → [3,1,2]', () => {
        const result = applyDrop([1, 2, 3], [1, 2, 3], 2, 0, true);
        expect(result).toEqual([3, 1, 2]);
    });

    it('後方移動: id=1(idx0) を id=3(idx2) の後に → [2,3,1]', () => {
        const result = applyDrop([1, 2, 3], [1, 2, 3], 0, 2, false);
        expect(result).toEqual([2, 3, 1]);
    });

    it('隣接前方: id=2(idx1) を id=1(idx0) の前に → [2,1,3]', () => {
        const result = applyDrop([1, 2, 3], [1, 2, 3], 1, 0, true);
        expect(result).toEqual([2, 1, 3]);
    });

    it('隣接後方: id=2(idx1) を id=3(idx2) の後に → [1,3,2]', () => {
        const result = applyDrop([1, 2, 3], [1, 2, 3], 1, 2, false);
        expect(result).toEqual([1, 3, 2]);
    });
});

// ─────────────────────────────────────────
// フィルターあり（部分集合を表示）— バグ修正の検証
// ─────────────────────────────────────────
describe('D&D 並び替えロジック — フィルターあり', () => {
    // 全体: [A=1, B=2, C=3, D=4, E=5], 表示: [B=2, D=4]

    it('D(idx1)をB(idx0)の前に移動 → [1,4,2,3,5]', () => {
        const result = applyDrop([1, 2, 3, 4, 5], [2, 4], 1, 0, true);
        expect(result).toEqual([1, 4, 2, 3, 5]);
    });

    it('B(idx0)をD(idx1)の後に移動 → [1,3,4,2,5]', () => {
        const result = applyDrop([1, 2, 3, 4, 5], [2, 4], 0, 1, false);
        expect(result).toEqual([1, 3, 4, 2, 5]);
    });

    it('先頭フィルター画像を末尾へ: 表示[2,4,5], B→E後 → [1,3,4,5,2]', () => {
        const result = applyDrop([1, 2, 3, 4, 5], [2, 4, 5], 0, 2, false);
        expect(result).toEqual([1, 3, 4, 5, 2]);
    });

    it('末尾フィルター画像を先頭へ: 表示[2,4,5], E→B前 → [1,5,2,3,4]', () => {
        const result = applyDrop([1, 2, 3, 4, 5], [2, 4, 5], 2, 0, true);
        expect(result).toEqual([1, 5, 2, 3, 4]);
    });

    it('非連続画像を中間へ: 表示[1,5], 5→1後 → [1,5,2,3,4]は誤り→正:[1,5,2,3,4]を確認', () => {
        // 全体:[1,2,3,4,5], 表示:[1,5]
        // id=5(idx1)をid=1(idx0)の後に → 1の直後に5を挿入
        // 全体内: 5を抜くと[1,2,3,4], 1の後(idx1)に5 → [1,5,2,3,4]
        const result = applyDrop([1, 2, 3, 4, 5], [1, 5], 1, 0, false);
        expect(result).toEqual([1, 5, 2, 3, 4]);
    });

    it('フィルター内の隣接: 表示[2,4], D→B前(既にB直後) → [1,4,2,3,5]（変化なし確認）', () => {
        // 全体:[1,4,2,3,5], 表示:[2,4] ← DはBの直前に既にある
        // ここでB(idx0の2)をD(idx1の4)の前に動かす → 変化するはず
        const result = applyDrop([1, 4, 2, 3, 5], [2, 4], 0, 1, true);
        // 2を抜くと[1,4,3,5], 4のpos=1, insertBefore=true → splice(1,0,2) → [1,2,4,3,5]
        expect(result).toEqual([1, 2, 4, 3, 5]);
    });
});
