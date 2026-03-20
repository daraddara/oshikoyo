/**
 * loadSettings() の新規タグ関連フィールド マイグレーションテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractCode, setupTestEnvironment } from './test-utils.js';

setupTestEnvironment();

const settingsCode = extractCode('function loadSettings()', '\nfunction showToast(');

const DEFAULT_SETTINGS = {
    startOfWeek: 0,
    monthCount: 2,
    layoutDirection: 'row',
    oshiList: [],
    event_types: [
        { id: 'bday', label: '誕生日', icon: 'cake' },
        { id: 'debut', label: 'デビュー記念日', icon: 'star' },
    ],
    mediaMode: 'single',
    mediaPosition: 'top',
    mediaSize: null,
    mediaIntervalPreset: '1m',
    lastActiveInterval: '1m',
    layoutMode: 'smart',
    immersiveMode: false,
    localImageOrder: [],
    tags: [],
    localImageMeta: {},
};

const STORAGE_KEY = 'oshikoyo_settings';

function makeLoadSettings(savedData) {
    const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue(savedData ? JSON.stringify(savedData) : null),
        setItem: vi.fn(),
    };
    const code = `
        const STORAGE_KEY = '${STORAGE_KEY}';
        const DEFAULT_SETTINGS = ${JSON.stringify(DEFAULT_SETTINGS)};
        let appSettings = { ...DEFAULT_SETTINGS };
        const localStorage = mockLS;
        ${settingsCode}
        return { loadSettings, getAppSettings: () => appSettings };
    `;
    return new Function('mockLS', code)(mockLocalStorage);
}

describe('loadSettings マイグレーション — タグ関連フィールド', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    it('tags フィールドがない古いデータ → [] で初期化される', () => {
        const { loadSettings, getAppSettings } = makeLoadSettings({ startOfWeek: 1 });
        loadSettings();
        expect(getAppSettings().tags).toEqual([]);
    });

    it('tags フィールドが非配列 → [] で初期化される', () => {
        const { loadSettings, getAppSettings } = makeLoadSettings({ tags: 'invalid' });
        loadSettings();
        expect(getAppSettings().tags).toEqual([]);
    });

    it('tags フィールドが配列なら保持される', () => {
        const { loadSettings, getAppSettings } = makeLoadSettings({ tags: ['誕生日', 'ライブ'] });
        loadSettings();
        expect(getAppSettings().tags).toEqual(['誕生日', 'ライブ']);
    });

    it('localImageMeta フィールドがない古いデータ → {} で初期化される', () => {
        const { loadSettings, getAppSettings } = makeLoadSettings({ startOfWeek: 1 });
        loadSettings();
        expect(getAppSettings().localImageMeta).toEqual({});
    });

    it('localImageMeta が配列の場合 → {} で初期化される', () => {
        const { loadSettings, getAppSettings } = makeLoadSettings({ localImageMeta: [] });
        loadSettings();
        expect(getAppSettings().localImageMeta).toEqual({});
    });

    it('localImageMeta がオブジェクトなら保持される', () => {
        const meta = { 42: { tags: ['衣装A'] } };
        const { loadSettings, getAppSettings } = makeLoadSettings({ localImageMeta: meta });
        loadSettings();
        expect(getAppSettings().localImageMeta).toEqual(meta);
    });

    it('oshiList の各エントリに tags がない場合 → [] が付与される', () => {
        const { loadSettings, getAppSettings } = makeLoadSettings({
            oshiList: [
                { name: '推しA', color: '#ff0000', memorial_dates: [] },
                { name: '推しB', color: '#00ff00', memorial_dates: [] },
            ]
        });
        loadSettings();
        const list = getAppSettings().oshiList;
        expect(list[0].tags).toEqual([]);
        expect(list[1].tags).toEqual([]);
    });

    it('oshiList の既存 tags は保持される', () => {
        const { loadSettings, getAppSettings } = makeLoadSettings({
            oshiList: [
                { name: '推しA', color: '#ff0000', memorial_dates: [], tags: ['誕生日'] },
            ]
        });
        loadSettings();
        expect(getAppSettings().oshiList[0].tags).toEqual(['誕生日']);
    });

    it('localStorage に保存データがない場合はデフォルト値が使われる', () => {
        const { loadSettings, getAppSettings } = makeLoadSettings(null);
        loadSettings();
        const s = getAppSettings();
        expect(s.tags).toEqual([]);
        expect(s.localImageMeta).toEqual({});
        expect(s.oshiList).toEqual([]);
    });
});
