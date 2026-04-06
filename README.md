<p align="center">
  <img src="assets/logo/logo.png" width="400" alt="Oshikoyo Logo">
</p>

<h1 align="center">おしこよ</h1>

<p align="center">
  <strong>推し活専用カレンダー。あなたの「推し」との日常を、もっと身近に。</strong>
</p>

<p align="center">
  <a href="https://oshikoyo.pages.dev/">
    <img src="https://img.shields.io/badge/🚀%20今すぐ使ってみる-oshikoyo.pages.dev-FF69B4?style=for-the-badge" alt="Try Now">
  </a>
  &nbsp;
  <a href="https://github.com/daraddara/oshikoyo/issues">
    <img src="https://img.shields.io/github/issues/daraddara/oshikoyo?style=for-the-badge&color=lightblue" alt="GitHub Issues">
  </a>
</p>

---

## おしこよとは

卓上カレンダーを買い忘れたことがきっかけで作り始めた、個人開発の推し活カレンダーアプリです。

「推し」の誕生日・記念日をカレンダーに刻んで、その日に合わせた画像を表示できる。ただそれだけのことを、誰に気兼ねなく、自分のペースで楽しめるものを作りたかった——そんな動機から生まれました。

広告も、課金要素も、外部サーバーへのデータ送信も一切ありません。完全に個人開発・個人利用向けのアプリです。

---

## 特徴

### 🔒 完全ローカル完結・プライバシー保護

すべてのデータはあなたのデバイスのブラウザ（IndexedDB / localStorage）にのみ保存されます。画像も設定も、サーバーには一切送信されません。

### 👥 大規模な推し管理に対応

100人規模の推しを快適に管理。CSV インポート / エクスポートによる一括登録・バックアップに対応しています。

### 🗑️ いつでもリセット可能

全データ削除（初期化）機能を搭載。環境の引っ越しや気分転換のフルリセットも手軽に行えます。

### 📱 PWA 対応

ホーム画面に追加すれば、スマートフォン・PC いずれでもアプリ感覚で起動できます。

---

## 使い方

**3ステップではじめる：**

1. **アプリを開く** — [oshikoyo.pages.dev](https://oshikoyo.pages.dev/) にアクセス（またはホーム画面に追加）
2. **推しを登録する** — 設定の「推し管理」から個別追加、または CSV で一括インポート
3. **カレンダーを楽しむ** — 記念日が近づくと自動ハイライト。当日は推しの画像を優先表示

---

## ブラウザ対応・既知の制約

### PWA インストール

| ブラウザ | PWAインストール | ホーム画面追加 |
|---|---|---|
| Android Chrome | ✅ | ✅ |
| Android Edge | ✅ | ✅ |
| iOS Safari | ✅ | ✅ |

### Web Share Target（他アプリからの画像共有）

他のアプリから「共有」でおしこよに画像を直接送る機能です。

| ブラウザ | 対応状況 |
|---|---|
| Android Chrome | ✅ 対応 |
| Android Edge | ✗ 非対応（ブラウザの制限） |

> [!NOTE]
> Android Edge は PWA としての正常インストールには対応していますが、Web Share Target API（他アプリからの画像共有）を Android の Intent システムに登録しないため、共有先一覧に表示されません。これはアプリ側では解決できないブラウザの制限です。Edge をご利用の場合は、設定画面の「画像を追加」ボタンからファイルを直接選択してください。

---

## データとプライバシー

| 項目 | 詳細 |
|---|---|
| 画像・設定データの保存先 | **このデバイスのブラウザ（IndexedDB / localStorage）のみ** |
| サーバーへのアップロード | **なし** |
| 外部サービスへの画像送信 | **なし** |
| バックアップファイル（.json.gz）| ローカルへのダウンロードのみ。画像データが含まれます |
| 外部通信 | 祝日データの取得（GET リクエストのみ）に限定 |

> [!IMPORTANT]
> おしこよは**個人使用を目的としたアプリ**です。登録する画像や情報の著作権・肖像権については、ご自身の判断と責任においてご確認ください。バックアップファイルには登録画像のデータが含まれますので、ファイルの取り扱いにはご注意ください。

---

## 不具合報告・フィードバック

不具合の報告や機能要望は [GitHub Issues](https://github.com/daraddara/oshikoyo/issues) からお気軽にどうぞ。

個人開発のため、対応は不定期になります。すべての Issue に返信・対応できるとは限りませんが、報告はしっかり確認しています。

---

## ライセンス

本プロジェクトは [MIT License](./LICENSE) のもとで公開されています。

### サードパーティライセンス

| リソース | ライセンス | 表記先 |
| :--- | :--- | :--- |
| M PLUS Rounded 1c, Noto Sans JP, Outfit (Google Fonts) | SIL Open Font License 1.1 | https://scripts.sil.org/OFL |
| Lucide Icons | ISC License | https://lucide.dev/license |
| Holidays JP API | MIT License | https://holidays-jp.github.io/ |
