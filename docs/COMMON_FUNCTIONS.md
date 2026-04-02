# 共通関数リファレンス (Common Functions Reference)

`src/script.js` 内で定義されている、再利用可能な主要関数およびクラスのリストです。

## 1. ストレージ / データベース管理
| 関数/クラス名 | 内容 |
|:---|:---|
| `LocalImageDB` (Class) | IndexedDB (`OshikoyoDB`) を操作するためのラッパークラス。画像の追加・削除・取得、Gzipエクスポート/インポートを担当。 |
| `loadSettings()` / `saveSettings()` | `localStorage` (`oshikoyo_settings`) への設定保存と読み込み。 |
| `loadState()` / `saveState()` | `localStorage` (`oshikoyo_state`) への実行時状態（最後に表示した画像等）の保存と読み込み。 |

## 2. 画像処理 / メディア管理
| 関数名 | 内容 |
|:---|:---|
| `blobToBase64(blob)` | Blob を Data URI 形式の Base64 文字列に変換。 |
| `base64ToBlob(base64, type)` | Base64 文字列を Blob に戻す（インポート用）。 |
| `isDuplicateBlob(blob, sigMap)` | 画像の重複チェック（サイズ、MIME、サンプリングハッシュによる高速判定）。 |
| `compressImageFile(file, maxDimension, quality)` | `canvas` を使用した画像リサイズおよび JPEG 圧縮。最大ピクセル数と品質を指定して圧縮。 |
| `updateMediaArea(mode)` | 画像表示エリアの更新。ランダム、サイクル、手動切り替え（旧固定）の各ロジックを含む。 |

## 3. カレンダーロジック
| 関数名 | 内容 |
|:---|:---|
| `getJPHoliday(date)` | 日本の祝日計算（特例措置や振替休日にも対応）。 |
| `parseDateString(str)` | "M/D", "YYYY/M/D", "M月D日" などの多様な日付形式をパース。 |
| `renderCalendar(container, y, m)` | 指定した DOM コンテナに 1 ヶ月分のカレンダーを描画。 |
| `getTodayMemorialOshis()` | 今日の日付に対応する「推し」の記念日情報を取得。 |

## 4. UI ユーティリティ
| 関数名 | 内容 |
|:---|:---|
| `escapeHTML(str)` | XSS 対策のための HTML エスケープ。 |
| `getContrastColor(hex)` | 背景色に応じた最適な文字色（黒系/白系）を計算。 |
| `showToast(msg, type)` | 画面下部にトースト通知を表示。 |
| `showPopup(e, html)` | デスクトップ表示時のホバーポップアップ制御。 |

## 5. 画像表示・レイアウト制御
| 関数名 | 内容 |
|:---|:---|
| `applyAutoLayout(img)` | 画像のアスペクト比を判定し、スマートモード時にレイアウトを自動調整（縦長→左配置、横長→上配置）。 |
| `renderDefaultMedia(displayArea)` | 画像未登録時のデフォルト画像をメディアエリアに描画。 |
| `renderMediaRecord(record, displayArea)` | IndexedDB から取得した画像/動画レコードをメディアエリアに描画。 |
| `setupMediaTimer(isInit)` | 画像切り替えタイマーを設定・再起動。間隔プリセット（10s〜毎日指定時刻）に応じて `setInterval` または `setTimeout` を使い分ける。 |
| `seedDefaultImages()` | 初回起動時（DBが空のとき）にデフォルト画像2枚（横長・縦長）をIndexedDBへ自動登録。 |

## 6. モバイル対応
| 関数名 | 内容 |
|:---|:---|
| `isMobile()` | 画面幅によるモバイル端末判定（768px以下）。 |
| `openDayDetailSheet(label, html)` | モバイル専用のボトムシート（日付詳細）を表示。 |
| `setupSwipeGestures()` | モバイルでのスワイプによる月移動などのジェスチャー制御。 |
| `setupMobileTabBar()` | ボトムタブナビゲーションバーを生成・初期化。ホーム/カレンダー/推し管理/設定の4タブ。 |
| `renderMobilePlaybackPopover()` | ホームタブタップ時に表示する再生モード選択ポップオーバーを描画（表示モード・切り替え間隔）。 |
| `updateMobileHomeTabIndicator()` | 手動モード時にホームタブへピンインジケーター（`.mobile-home-dot`）を表示/非表示。 |
| `switchMobileTab(tabName)` | モバイルタブを切り替え、対応するパネルを表示。 |
