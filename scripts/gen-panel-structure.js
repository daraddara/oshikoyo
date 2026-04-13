#!/usr/bin/env node
/**
 * gen-panel-structure.js
 *
 * index.html を解析してデスクトップ・モバイル設定パネルの構造を
 * docs/PANEL_STRUCTURE.md に出力する。
 *
 * 使用方法: npm run gen-panels
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT     = path.resolve(__dirname, '..');
const HTML_SRC = path.join(ROOT, 'index.html');
const OUT_FILE = path.join(ROOT, 'docs', 'PANEL_STRUCTURE.md');

const html = fs.readFileSync(HTML_SRC, 'utf8');

// ─────────────────────────────────────────────
// パネル対応定義
// ─────────────────────────────────────────────
const PANEL_PAIRS = [
    {
        label:   '全般',
        desktop: 'tabPanelGeneral',
        mobile:  'mobileSubPanel-general',
    },
    {
        label:   '記念日表示',
        desktop: null,
        mobile:  'mobileSubPanel-memorial',
        note:    'デスクトップでは tabPanelGeneral 内に含まれる',
    },
    {
        label:   'カレンダー',
        desktop: 'tabPanelCalendar',
        mobile:  null,
        note:    'モバイルでは mobileSubPanel-general 内に含まれる',
    },
    {
        label:   'イベント管理',
        desktop: 'tabPanelEvent',
        mobile:  'mobileSubPanel-events',
    },
    {
        label:   '画像・ストレージ',
        desktop: 'tabPanelMedia',
        mobile:  'mobileSubPanel-media',
    },
    {
        label:   'データ・バックアップ',
        desktop: 'tabPanelBackup',
        mobile:  'mobileSubPanel-data',
    },
    {
        label:   'アプリ情報',
        desktop: 'tabPanelAppInfo',
        mobile:  'mobileSubPanel-appinfo',
    },
];

// ─────────────────────────────────────────────
// HTML パーサユーティリティ
// ─────────────────────────────────────────────

/** 指定 ID の div 要素の内容を抽出（ネスト対応） */
function extractDivById(src, id) {
    const marker = `id="${id}"`;
    const markerIdx = src.indexOf(marker);
    if (markerIdx === -1) return null;

    // マーカーが含まれるタグの開始 '<' を探す
    let tagStart = markerIdx;
    while (tagStart > 0 && src[tagStart] !== '<') tagStart--;

    let depth = 0;
    let i = tagStart;

    while (i < html.length) {
        if (src[i] !== '<') { i++; continue; }

        // スクリプト・スタイル・SVGを丸ごとスキップ
        const skipMatch = src.slice(i).match(/^<(script|style|svg)[\s>]/i);
        if (skipMatch) {
            const tag = skipMatch[1].toLowerCase();
            const closeTag = `</${tag}>`;
            const closeIdx = src.indexOf(closeTag, i + 1);
            i = closeIdx !== -1 ? closeIdx + closeTag.length : src.length;
            continue;
        }

        if (/^<div[\s>]/i.test(src.slice(i))) {
            depth++;
            i++;
        } else if (/^<\/div\s*>/i.test(src.slice(i))) {
            depth--;
            if (depth === 0) {
                return src.slice(tagStart, i + src.slice(i).indexOf('>') + 1);
            }
            i++;
        } else {
            i++;
        }
    }
    return null;
}

/** コンテンツ内の id 属性値を列挙（パネル自身のIDを除く） */
function extractIds(content, selfId) {
    if (!content) return [];
    const ids = [];
    const re = /\sid="([^"]+)"/g;
    let m;
    while ((m = re.exec(content)) !== null) {
        if (m[1] !== selfId) ids.push(m[1]);
    }
    return ids;
}

/** コンテンツ内の name 属性値を列挙（重複除去） */
function extractNames(content) {
    if (!content) return [];
    const names = new Set();
    const re = /\sname="([^"]+)"/g;
    let m;
    while ((m = re.exec(content)) !== null) names.add(m[1]);
    return [...names];
}

// ─────────────────────────────────────────────
// Markdown 生成
// ─────────────────────────────────────────────

const now = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' JST';

const lines = [];

lines.push(`# 設定パネル構造リファレンス`);
lines.push('');
lines.push('> **このファイルは自動生成です。編集しないでください。**  ');
lines.push(`> 生成: \`npm run gen-panels\` / 最終更新: ${now}`);
lines.push('');
lines.push('設定パネルはデスクトップ（`#settingsModal` 内の `#tabPanel*`）と');
lines.push('モバイル（`#mobileSubPanel-*`）で独立した HTML 要素として並行存在します。');
lines.push('**設定パネルを変更する場合は対応するパネル（下表参照）も必ず確認し、');
lines.push('変更後に `npm run gen-panels` を実行してこのドキュメントを更新してください。**');
lines.push('');

// 対応表
lines.push('## パネル対応表');
lines.push('');
lines.push('| 機能 | デスクトップ ID | モバイル ID | 備考 |');
lines.push('|---|---|---|---|');
for (const p of PANEL_PAIRS) {
    const dt = p.desktop ? `\`#${p.desktop}\`` : '—';
    const mb = p.mobile  ? `\`#${p.mobile}\``  : '—';
    lines.push(`| ${p.label} | ${dt} | ${mb} | ${p.note || ''} |`);
}
lines.push('');

// 命名規則
lines.push('## ID 命名規則');
lines.push('');
lines.push('| 種別 | デスクトップ | モバイル |');
lines.push('|---|---|---|');
lines.push('| ボタン | `btn*` | `btnMs*` または `btnMobile*` |');
lines.push('| input name 属性 | `name="foo"` | `name="ms-foo"` |');
lines.push('| ストレージ表示 | `*Label` / `*Bar` | `ms*Label` / `ms*Bar` |');
lines.push('| インストールセクション | `settingGroup*` | `mobileSetting*` |');
lines.push('');

// 各パネルの要素詳細
lines.push('## 各パネルの要素一覧');
lines.push('');
lines.push('> `id` / `name` 属性を持つ要素のみ列挙しています。');
lines.push('');

for (const p of PANEL_PAIRS) {
    lines.push(`### ${p.label}`);
    lines.push('');

    if (p.note) {
        lines.push(`> ${p.note}`);
        lines.push('');
    }

    const dtContent = p.desktop ? extractDivById(html, p.desktop) : null;
    const mbContent = p.mobile  ? extractDivById(html, p.mobile)  : null;

    const dtIds   = extractIds(dtContent, p.desktop);
    const mbIds   = extractIds(mbContent, p.mobile);
    const dtNames = extractNames(dtContent);
    const mbNames = extractNames(mbContent);

    // デスクトップ
    if (p.desktop) {
        lines.push(`**デスクトップ** \`#${p.desktop}\``);
        lines.push('');
        if (dtIds.length) {
            lines.push('IDs:');
            dtIds.forEach(id => lines.push(`- \`#${id}\``));
        } else {
            lines.push('IDs: _（なし）_');
        }
        if (dtNames.length) {
            lines.push('');
            lines.push('name 属性:');
            dtNames.forEach(n => lines.push(`- \`${n}\``));
        }
        lines.push('');
    }

    // モバイル
    if (p.mobile) {
        lines.push(`**モバイル** \`#${p.mobile}\``);
        lines.push('');
        if (mbIds.length) {
            lines.push('IDs:');
            mbIds.forEach(id => lines.push(`- \`#${id}\``));
        } else {
            lines.push('IDs: _（なし）_');
        }
        if (mbNames.length) {
            lines.push('');
            lines.push('name 属性:');
            mbNames.forEach(n => lines.push(`- \`${n}\``));
        }
        lines.push('');
    }

    lines.push('---');
    lines.push('');
}

// ─────────────────────────────────────────────
// 出力
// ─────────────────────────────────────────────
const output = lines.join('\n');
fs.writeFileSync(OUT_FILE, output, 'utf8');
console.log(`✅ ${OUT_FILE} を生成しました`);
