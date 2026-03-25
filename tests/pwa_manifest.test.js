/**
 * PWA マニフェスト検証テスト
 *
 * manifest.json の必須フィールド・PWA要件・アイコンパスの整合性を確認する。
 * Service Worker やブラウザUI操作を伴わないため Vitest で実行する。
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');

let manifest;

beforeAll(() => {
    const raw = readFileSync(resolve(ROOT, 'manifest.json'), 'utf-8');
    manifest = JSON.parse(raw);
});

describe('PWA: manifest.json 必須フィールド', () => {
    it('name が存在する', () => {
        expect(typeof manifest.name).toBe('string');
        expect(manifest.name.length).toBeGreaterThan(0);
    });

    it('short_name が存在する', () => {
        expect(typeof manifest.short_name).toBe('string');
        expect(manifest.short_name.length).toBeGreaterThan(0);
    });

    it('start_url が存在する', () => {
        expect(typeof manifest.start_url).toBe('string');
    });

    it('display が standalone である', () => {
        expect(manifest.display).toBe('standalone');
    });

    it('background_color が存在する', () => {
        expect(typeof manifest.background_color).toBe('string');
        expect(manifest.background_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('theme_color が存在する', () => {
        expect(typeof manifest.theme_color).toBe('string');
        expect(manifest.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
});

describe('PWA: アイコン設定', () => {
    it('512x512 アイコンが定義されている', () => {
        const icon512 = manifest.icons.find(i => i.sizes === '512x512');
        expect(icon512).toBeDefined();
        expect(icon512.type).toBe('image/png');
    });

    it('アイコンファイルが実際に存在する', () => {
        manifest.icons.forEach(icon => {
            const iconPath = resolve(ROOT, icon.src);
            expect(existsSync(iconPath), `アイコンが見つかりません: ${icon.src}`).toBe(true);
        });
    });
});

describe('PWA: share_target 設定', () => {
    it('share_target が定義されている', () => {
        expect(manifest.share_target).toBeDefined();
    });

    it('share_target の action が share-target である', () => {
        expect(manifest.share_target.action).toBe('share-target');
    });

    it('share_target が POST メソッドを使用する', () => {
        expect(manifest.share_target.method).toBe('POST');
    });

    it('share_target が画像ファイルを受け付ける', () => {
        const files = manifest.share_target?.params?.files || [];
        expect(files.length).toBeGreaterThan(0);
        const imageFile = files.find(f => f.name === 'image');
        expect(imageFile).toBeDefined();
        expect(imageFile.accept).toContain('image/*');
    });
});

describe('PWA: Service Worker ファイル存在確認', () => {
    it('sw.js が存在する', () => {
        expect(existsSync(resolve(ROOT, 'sw.js'))).toBe(true);
    });

    it('sw.js がキャッシュ対象ファイルを定義している', () => {
        const swContent = readFileSync(resolve(ROOT, 'sw.js'), 'utf-8');
        expect(swContent).toContain('index.html');
        expect(swContent).toContain('style.css');
        expect(swContent).toContain('script.js');
        expect(swContent).toContain('manifest.json');
    });

    it('sw.js が Cache First 戦略を使用している', () => {
        const swContent = readFileSync(resolve(ROOT, 'sw.js'), 'utf-8');
        expect(swContent).toContain('caches.match');
    });

    it('sw.js が share-target エンドポイントを処理する', () => {
        const swContent = readFileSync(resolve(ROOT, 'sw.js'), 'utf-8');
        expect(swContent).toContain('/share-target');
        expect(swContent).toContain('Response.redirect');
    });
});
