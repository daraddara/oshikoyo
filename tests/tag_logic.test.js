import { describe, it, expect } from 'vitest';
import { extractCode, setupTestEnvironment } from './test-utils.js';

setupTestEnvironment();

// タグユーティリティ関数を抽出
const tagLogicCode = extractCode('// --- Tag Logic ---', '// --- Tag UI ---');

function makeTagLogic(mockAppSettings) {
    return new Function('appSettings', `${tagLogicCode}; return { getImageTags, setImageTags, addTagsToMaster };`)(mockAppSettings);
}

describe('getImageTags', () => {
    it('存在する imgId のタグを返す', () => {
        const { getImageTags } = makeTagLogic({
            localImageMeta: { 42: { tags: ['誕生日', '衣装A'] } }
        });
        expect(getImageTags(42)).toEqual(['誕生日', '衣装A']);
    });

    it('返り値は元配列の参照である', () => {
        const meta = { 42: { tags: ['誕生日'] } };
        const { getImageTags } = makeTagLogic({ localImageMeta: meta });
        const result = getImageTags(42);
        expect(result).toBe(meta[42].tags); // 同じ参照であることを確認
    });

    it('存在しない imgId は [] を返す', () => {
        const { getImageTags } = makeTagLogic({ localImageMeta: {} });
        expect(getImageTags(99)).toEqual([]);
    });

    it('localImageMeta が undefined でも [] を返す', () => {
        const { getImageTags } = makeTagLogic({ localImageMeta: undefined });
        expect(getImageTags(1)).toEqual([]);
    });

    it('tags プロパティがない場合も [] を返す', () => {
        const { getImageTags } = makeTagLogic({ localImageMeta: { 5: {} } });
        expect(getImageTags(5)).toEqual([]);
    });

    it('空配列を返す際は凍結された単一の EMPTY_TAGS を返し無駄なアロケーションを防ぐ', () => {
        const { getImageTags } = makeTagLogic({ localImageMeta: {} });
        const empty1 = getImageTags(99);
        const empty2 = getImageTags(100);
        expect(Object.isFrozen(empty1)).toBe(true);
        expect(empty1).toBe(empty2); // 同じ参照であることを確認
    });
});

describe('setImageTags', () => {
    it('localImageMeta[id].tags に正しくセットされる', () => {
        const appSettings = { localImageMeta: {} };
        const { setImageTags } = makeTagLogic(appSettings);
        setImageTags(10, ['ライブ', '推しA']);
        expect(appSettings.localImageMeta[10].tags).toEqual(['ライブ', '推しA']);
    });

    it('localImageMeta が undefined でも初期化して動く', () => {
        const appSettings = { localImageMeta: undefined };
        const { setImageTags } = makeTagLogic(appSettings);
        setImageTags(7, ['衣装A']);
        expect(appSettings.localImageMeta[7].tags).toEqual(['衣装A']);
    });

    it('既存の他 ID のデータを上書きしない', () => {
        const appSettings = { localImageMeta: { 1: { tags: ['既存'] } } };
        const { setImageTags } = makeTagLogic(appSettings);
        setImageTags(2, ['新規']);
        expect(appSettings.localImageMeta[1].tags).toEqual(['既存']);
        expect(appSettings.localImageMeta[2].tags).toEqual(['新規']);
    });
});

describe('addTagsToMaster', () => {
    it('新規タグを appSettings.tags に追加する', () => {
        const appSettings = { tags: [] };
        const { addTagsToMaster } = makeTagLogic(appSettings);
        addTagsToMaster(['誕生日', 'ライブ']);
        expect(appSettings.tags).toEqual(['誕生日', 'ライブ']);
    });

    it('重複タグは追加しない', () => {
        const appSettings = { tags: ['誕生日'] };
        const { addTagsToMaster } = makeTagLogic(appSettings);
        addTagsToMaster(['誕生日', 'ライブ']);
        expect(appSettings.tags).toEqual(['誕生日', 'ライブ']);
    });

    it('空文字は追加しない', () => {
        const appSettings = { tags: [] };
        const { addTagsToMaster } = makeTagLogic(appSettings);
        addTagsToMaster(['', '  '.trim(), '有効タグ']);
        expect(appSettings.tags).toEqual(['有効タグ']);
    });

    it('appSettings.tags が undefined でも初期化して動く', () => {
        const appSettings = { tags: undefined };
        const { addTagsToMaster } = makeTagLogic(appSettings);
        addTagsToMaster(['タグ']);
        expect(appSettings.tags).toEqual(['タグ']);
    });
});
