import fs from 'fs';
import path from 'path';
import { vi } from 'vitest';
import 'fake-indexeddb/auto';

/**
 * script.js から特定のコードブロックを抽出します。
 * @param {string} startMarker 抽出開始の目印となる文字列
 * @param {string} endMarker 抽出終了の目印となる文字列
 * @returns {string} 抽出されたコード
 */
export function extractCode(startMarker, endMarker) {
    const scriptPath = path.resolve(__dirname, '../script.js');
    const content = fs.readFileSync(scriptPath, 'utf8');

    const startIndex = content.indexOf(startMarker);
    if (startIndex === -1) throw new Error(`始点マーカーが見つかりません: ${startMarker}`);

    const endIndex = content.indexOf(endMarker, startIndex);
    if (endIndex === -1) throw new Error(`終点マーカーが見つかりません: ${endMarker}`);

    return content.slice(startIndex, endIndex);
}

/**
 * 複数のコードブロックを一つの関数にまとめて評価し、エクスポートされたオブジェクトを返します。
 * @param {string[]} codeBlocks 評価するコード文字列の配列
 * @param {string[]} exports エクスポートする変数名の配列
 * @returns {Object} 抽出された要素を含むオブジェクト
 */
export function loadModule(codeBlocks, exports) {
    const combinedCode = codeBlocks.join('\n');
    const setupCode = `
        ${combinedCode}
        return { ${exports.join(', ')} };
    `;
    return new Function(setupCode)();
}

/**
 * JSDOM 環境に必要なポリフィルとグローバルモックをセットアップします。
 */
export function setupTestEnvironment() {
    // Blob.arrayBuffer のポリフィル
    if (global.Blob && !Blob.prototype.arrayBuffer) {
        Blob.prototype.arrayBuffer = function () {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error);
                reader.readAsArrayBuffer(this);
            });
        };
    }

    // fake-indexeddb 用の structuredClone パッチ
    globalThis.structuredClone = val => val;

    // 基本的な DOM モック
    if (global.document) {
        document.getElementById = vi.fn();
        document.querySelector = vi.fn();
        document.createElement = vi.fn(() => ({
            style: {},
            classList: { add: vi.fn(), remove: vi.fn() },
            appendChild: vi.fn(),
            innerHTML: ''
        }));
    } else {
        global.document = {
            getElementById: vi.fn(),
            querySelector: vi.fn(),
            createElement: vi.fn(() => ({
                style: {},
                classList: { add: vi.fn(), remove: vi.fn() },
                appendChild: vi.fn(),
                innerHTML: ''
            })),
            body: { appendChild: vi.fn() }
        };
    }

    if (global.URL) {
        URL.createObjectURL = vi.fn();
        URL.revokeObjectURL = vi.fn();
    } else {
        global.URL = {
            createObjectURL: vi.fn(),
            revokeObjectURL: vi.fn()
        };
    }

    if (global.localStorage) {
        localStorage.getItem = vi.fn();
        localStorage.setItem = vi.fn();
        localStorage.removeItem = vi.fn();
        localStorage.clear = vi.fn();
    } else {
        global.localStorage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn()
        };
    }
}
