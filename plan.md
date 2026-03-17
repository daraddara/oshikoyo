1. **没入モード時のCSS調整 (カレンダーと推し表示)**
   - `src/style.css` の `body.is-immersive .calendar-section` に対して、`width` を縮小（例: `300px` → `180px` 程度）、`padding` を減らします（例: `8px`）。さらに、`backdrop-filter` のぼかしや透過背景（例: `rgba(255, 255, 255, 0.4)` 等）を調整しグラスモーフィズムを強化します。
   - `body.is-immersive .day-cell` を追加/修正して、セル内のパディングと最小高さを削減（例: `aspect-ratio: auto; min-height: 24px;` 等）、フォントサイズも縮小（例: `.day-number` に対して `font-size: 10px; font-weight: 300;`）します。
   - `body.is-immersive .oshi-event`（推し予定の表示要素）をオーバーライドし、テキスト部分（`font-size: 0; color: transparent;`など）とアイコン表示を無効化（`display: none;`）し、幅・高さ3〜4pxの円形ドット（`border-radius: 50%`）にします。さらに、ドットを日付の下または横に配置できるよう、`oshi-events-container` のレイアウトも調整します。

2. **没入モード時のバックドロップ全画面化**
   - `body.is-immersive .media-backdrop` に対して、指定通り `blur(30px)` 以上（例: `blur(40px)`）を設定。左右の隙間を埋めるため `transform: scale(1.15);` などのスケールを強くかけ、ぼかしの境界が見えないようにします。

3. **コントロールUIの自動隠蔽（Auto-hide）**
   - 既存の `body.is-immersive .quick-media-controls` の opacity 指定に加えて、カレンダー自体も自動隠蔽の対象にします（`body.is-immersive .calendar-section` も `.controls-visible` 以外で opacity: 0 になるようにし、`pointer-events: none;` で非表示時はクリック無効化します）。
   - ホバー時に再表示させるため、ホバー用の CSS 指定も追加し、マウス移動時の JS で `controls-visible` が3秒後消えるロジックと連動させます。

4. **スナップ位置の微調整**
   - `src/script.js` 内の `setupMiniCalendarInteractions` でハードコードされている `margin = 24;` を `margin = 20;` に変更します。また CSS 側での初期 `bottom`、`right` 位置指定も `24px` から `20px` に微調整します。

5. **Pre-commit と Verification**
   - `pre_commit_instructions` に従って検証を実施。UIやレイアウト変更があるため、`npm run e2e` でスクリーンショットが更新される場合は適宜対処し、全テストに合格してからコミット・提出します。
