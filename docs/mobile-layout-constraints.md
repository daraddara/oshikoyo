# モバイルレイアウト制約事項

> 調査日: 2026-03-23（初版）/ 2026-04-05 更新
> 本ドキュメントは v1.0.0 時点での設計制約・既知仕様をまとめた技術参照資料です。

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

**現在の対応**: モバイルUI全面刷新（v0.29〜）により、モバイルでは `body.is-mobile-ui` クラスによる専用レイアウトが適用される。`adjustMediaLayout()` はモバイル時に早期リターンし、CSS `order` による並び替えではなくボトムナビ・固定メディアエリアの構造で対応済み。

---

## 4. v1.0.0 時点の対応状況

| 対応内容 | 状態 |
|---|---|
| ナビバー日付テキストの折り返し防止（`white-space: nowrap`） | ✅ 完了 |
| モバイル600pxクエリのセレクター修正（`#currentDate` → `.current-date-display`） | ✅ 完了 |
| モバイルで強制1ヶ月表示（JS `effectiveMonthCount`） | ✅ 完了 |
| コントロールピルを下部中央固定 | ✅ 完了 |
| iOS セーフエリア対応（`viewport-fit=cover` + `env(safe-area-inset-bottom)`） | ✅ 完了 |
| モバイルでの画像上・カレンダー下順序 | ✅ `body.is-mobile-ui` + ボトムナビ構造で解決 |
| `pos-left`/`pos-right` のモバイル無効化 | ✅ モバイルUIでは設定UI非表示・`adjustMediaLayout()` 早期リターンで実質無効化済み |

---

## 5. v1.0.0 以降の既知制約

- `pos-left`/`pos-right` はデスクトップ（1100px以上）専用レイアウトであることに変更なし。モバイルからは設定 UI で選択不可の方向に整理することが望ましいが、現状は機能的な破綻はない（ISSUES.md 参照）。
