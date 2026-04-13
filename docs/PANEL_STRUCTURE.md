# 設定パネル構造リファレンス

> **このファイルは自動生成です。編集しないでください。**  
> 生成: `npm run gen-panels` / 最終更新: 2026-04-13 05:59 JST

設定パネルはデスクトップ（`#settingsModal` 内の `#tabPanel*`）と
モバイル（`#mobileSubPanel-*`）で独立した HTML 要素として並行存在します。
**設定パネルを変更する場合は対応するパネル（下表参照）も必ず確認し、
変更後に `npm run gen-panels` を実行してこのドキュメントを更新してください。**

## パネル対応表

| 機能 | デスクトップ ID | モバイル ID | 備考 |
|---|---|---|---|
| 全般 | `#tabPanelGeneral` | `#mobileSubPanel-general` |  |
| 記念日表示 | — | `#mobileSubPanel-memorial` | デスクトップでは tabPanelGeneral 内に含まれる |
| カレンダー | `#tabPanelCalendar` | — | モバイルでは mobileSubPanel-general 内に含まれる |
| イベント管理 | `#tabPanelEvent` | `#mobileSubPanel-events` |  |
| 画像・ストレージ | `#tabPanelMedia` | `#mobileSubPanel-media` |  |
| データ・バックアップ | `#tabPanelBackup` | `#mobileSubPanel-data` |  |
| アプリ情報 | `#tabPanelAppInfo` | `#mobileSubPanel-appinfo` |  |

## ID 命名規則

| 種別 | デスクトップ | モバイル |
|---|---|---|
| ボタン | `btn*` | `btnMs*` または `btnMobile*` |
| input name 属性 | `name="foo"` | `name="ms-foo"` |
| ストレージ表示 | `*Label` / `*Bar` | `ms*Label` / `ms*Bar` |
| インストールセクション | `settingGroup*` | `mobileSetting*` |

## 各パネルの要素一覧

> `id` / `name` 属性を持つ要素のみ列挙しています。

### 全般

**デスクトップ** `#tabPanelGeneral`

IDs:
- `#btnResetLayout`
- `#oshiCount`
- `#btnOpenOshiManager`

name 属性:
- `startOfWeek`
- `memorialDisplayMode`

**モバイル** `#mobileSubPanel-general`

IDs:
- `#btnMsResetLayout`
- `#msHolidayLastSync`
- `#msBtnSyncHolidays`

name 属性:
- `ms-startOfWeek`

---

### 記念日表示

> デスクトップでは tabPanelGeneral 内に含まれる

**モバイル** `#mobileSubPanel-memorial`

IDs: _（なし）_

name 属性:
- `ms-memorialDisplayMode`

---

### カレンダー

> モバイルでは mobileSubPanel-general 内に含まれる

**デスクトップ** `#tabPanelCalendar`

IDs:
- `#holidayLastSync`
- `#btnSyncHolidays`

---

### イベント管理

**デスクトップ** `#tabPanelEvent`

IDs:
- `#btnSettingsClearAllEvents`
- `#settingsEventTypeList`
- `#etAddRow`
- `#settingsEtIconBtn`
- `#settingsEtNameInput`
- `#btnAddEventType`

**モバイル** `#mobileSubPanel-events`

IDs:
- `#btnMobileClearAllEvents`
- `#mobileEventTypeList`
- `#mobileEtAddRow`
- `#mobileEtIconBtn`
- `#mobileEtNameInput`
- `#btnMobileAddEventType`

---

### 画像・ストレージ

**デスクトップ** `#tabPanelMedia`

IDs:
- `#localMediaSettings`
- `#storageIndicatorWrap`
- `#storageIndicatorBar`
- `#storageIndicatorLabel`
- `#localImageCount`
- `#btnClearLocal`
- `#btnCompressExisting`
- `#btnLocalFolder`
- `#inputLocalFolder`
- `#btnLocalFiles`
- `#inputLocalFiles`
- `#btnClipboardPaste`
- `#localImageList`

name 属性:
- `imageCompressMode`

**モバイル** `#mobileSubPanel-media`

IDs:
- `#btnMsCompressExisting`
- `#msStorageIndicatorWrap`
- `#msStorageIndicatorBar`
- `#msStorageIndicatorLabel`
- `#msLocalImageCount`
- `#btnMsClearLocal`
- `#mobileLocalImageList`
- `#btnMsLocalFiles`
- `#btnMsClipboardPaste`
- `#btnMsImportImageTag`
- `#btnMsExportImageTag`

name 属性:
- `ms-imageCompressMode`

---

### データ・バックアップ

**デスクトップ** `#tabPanelBackup`

IDs:
- `#btnFactoryReset`
- `#btnExportFullBackup`
- `#btnImportFullBackup`
- `#inputFullBackup`
- `#btnExportImageTag`
- `#btnImportImageTag`
- `#inputImageTag`

**モバイル** `#mobileSubPanel-data`

IDs:
- `#btnMobileFactoryReset`
- `#btnMsExportFullBackup`
- `#btnMsImportFullBackup`

---

### アプリ情報

**デスクトップ** `#tabPanelAppInfo`

IDs:
- `#btnCheckUpdate`
- `#settingGroupInstall`
- `#settingInstallDesc`
- `#btnInstallApp`
- `#btnAppInfoCsvTemplate`

**モバイル** `#mobileSubPanel-appinfo`

IDs:
- `#btnMsCheckUpdate`
- `#mobileSettingGroupInstall`
- `#mobileSettingInstallDesc`
- `#mobileBtnInstallApp`

---
