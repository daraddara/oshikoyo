# モバイルレイアウト制約事項

> 調査日: 2026-03-23
> 対象ブランチ: fix/mobile-date-wrapping

---

## 1. モバイル端末のCSS幅実測値

| 端末 | ポートレート | ランドスケープ | `max-width: 768px` 適用 |
|---|---|---|---|
| Galaxy S25 | ~360px | ~780px | P: ✅ / L: ❌ |
| iPhone 15 Pro | 393px | 852px | P: ✅ / L: ❌ |
| iPhone SE (3rd) | 375px | 667px | P: ✅ / L: ❌ |
| iPad Pro 12.9" | 1024px | 1366px | ❌ / ❌ |

iPad Pro は両方向とも768pxを超えるため、PCと同じデスクトップレイアウトが適用される。これは正しい挙動。

---

## 2. 左右レイアウト（pos-left / pos-right）がモバイルで機能しない理由

### 設計上の要件

`pos-left` / `pos-right` は `flex-direction: row / row-reverse` による **横並びレイアウト**が前提。

- カレンダー: 550px（固定幅）
- 画像エリア: 550px（`adjustMediaLayout()` が inline style で設定）
- **最低必要幅: 1100px以上**

### スマートフォンの実態

スマートフォンはポートレート（~360px）・ランドスケープ（~800px）いずれも **1100px未満**。

### overflow による不可視問題

`.main-layout` に `overflow-x: hidden` が設定されており、幅超過分はクリップされる。

`flex-direction: row-reverse`（pos-left）の場合、画像エリアは左端（マイナスx座標方向）に配置されるため、完全にクリップされて不可視になる。

`flex-direction: row`（pos-right）の場合も、右端の画像エリアが viewport 外にはみ出す。

### まとめ

| 向き | CSS幅 | 1100px確保 | 結果 |
|---|---|---|---|
| ポートレート | ~360px | ❌ | 完全に機能しない |
| ランドスケープ | ~800px | ❌ | 同様にクリップされる |

これは特定環境の不具合ではなく、**レイアウト設計上の制約**。
`pos-left`/`pos-right` は、デスクトップ（1100px以上）専用のレイアウトと位置づける。

---

## 3. CSS `order` プロパティの実機挙動問題

`@media (max-width: 768px)` 内で以下を設定したが、Galaxy S25 / Chrome の実機では効果が確認できなかった：

```css
.media-area    { order: 1 !important; }
.calendar-section { order: 3 !important; }
```

- サーバーは正しいCSSを配信していることを `curl` で確認済み
- CSS 仕様上は `!important` が通常ルールに勝つはずだが、実機で未適用の状態を確認
- 根本原因は特定できていない（ブラウザの DevTools による直接検証が必要）

**代替策（TODO）**: `adjustMediaLayout()` JS 関数内でインラインスタイル（`element.style.order`）を使って設定する方法を今後の正式対応で採用予定。インラインスタイルは `!important` なしのCSSより確実に優先される。

---

## 4. 現在の仮対応状態（fix/mobile-date-wrapping ブランチ）

| 対応内容 | 状態 |
|---|---|
| ナビバー日付テキストの折り返し防止（`white-space: nowrap`） | ✅ 完了 |
| モバイル600pxクエリのセレクター修正（`#currentDate` → `.current-date-display`） | ✅ 完了 |
| モバイルで強制1ヶ月表示（JS `effectiveMonthCount`） | ✅ 完了 |
| コントロールピルを下部中央固定（仕様 3.1） | ✅ 完了 |
| iOS セーフエリア対応（`viewport-fit=cover` + `env(safe-area-inset-bottom)`） | ✅ 完了 |
| 画像高さ 35vh → 40vh（仕様 2.1 の 4:6 比率） | ✅ 完了 |
| モバイルでの画像上・カレンダー下順序（CSS `order`） | ⚠️ 仮対応（実機で動作未確認） |
| `pos-left`/`pos-right` のモバイル無効化 | ❌ 未実装（今後の正式対応） |

---

## 5. 今後の正式対応方針

- モバイル（768px以下）では `pos-left`/`pos-right` を選択不可にする、または強制的に `pos-top` に切り替えるロジックを追加する
- CSS `order` の問題は JS インラインスタイル方式で解決する
- 上記は別ブランチ・別PRで対応予定
