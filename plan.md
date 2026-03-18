1. **CSSクラス名の同期**
   - 以前のステップで誤って `body.is-immersive .calendar-day`, `.date-number`, `.events-container`, `.event-item` に追加してしまった没入モード用CSSスタイルを、JS側で実際に使われている正しいクラス名 (`.day-cell`, `.day-number`, `.oshi-events-container`, `.oshi-event`) に変更します。
2. **イベントリスナーの重複登録防止**
   - `src/script.js` 内の `setupMiniCalendarInteractions` で、イベントリスナーを登録する前に、既に登録済みかどうかを判定するフラグ（例: `calendarSection.dataset.interactionsSetup`）などを追加し、多重登録を防ぎます。
3. **Verification**
   - `git diff` で変更を確認し、`npm test && npm run e2e` でテスト・E2Eが通ることを確認します。必要に応じてPlaywrightでスクリーンショットを更新します。
4. **Pre-commit Steps**
   - `pre_commit_instructions` に従って最終確認を行います。
5. **Reply and Submit**
   - `reply_to_pr_comments` でコメントに返信し、`submit` で同一ブランチにプッシュします。
