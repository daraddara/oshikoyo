/**
 * おしこよ (Oshikoyo) ロジック & アプリケーション
 */

// --- Settings State ---
const DEFAULT_SETTINGS = {
    startOfWeek: 0, // 0: Sun, 1: Mon
    monthCount: 2,  // 1, 2
    layoutDirection: 'row', // 'row', 'column'
    // Oshi Settings (New List Structure)
    oshiList: [],
    // Global event type master — shared across all oshi
    event_types: [
        { id: 'bday',  label: '誕生日',       icon: 'cake' },
        { id: 'debut', label: 'デビュー記念日', icon: 'star' },
    ],
    // Media Settings
    mediaMode: 'single', // 'single', 'random', 'cycle'
    mediaPosition: 'top', // 'top', 'bottom', 'left', 'right'
    mediaSize: null,      // size of media area (width or height depending on position)
    mediaIntervalPreset: '1m', // '10s', '30s', '1m', '10m', '1h', '0:00', '4:00', 'startup'
    lastActiveInterval: '1m',
    layoutMode: 'smart', // 'smart', 'top', 'bottom', 'left', 'right'
    immersiveMode: false,
    localImageOrder: [], // ordered array of IndexedDB image keys
    tags: [],            // master tag list: string[]
    localImageMeta: {},  // { [id: number]: { tags: string[] } }
    memorialDisplayMode: 'preferred',  // 'preferred' (80/20) | 'exclusive' (100%)
    imageCompressMode: 'standard',     // 'off' | 'standard' | 'aggressive'
};

// --- IndexedDB Management ---
/**
 * IndexedDB management for local image storage.
 */
class LocalImageDB {
    /**
     * @param {string} dbName - The name of the IndexedDB.
     * @param {string} storeName - The name of the object store.
     */
    constructor(dbName = 'OshikoyoDB', storeName = 'images') {
        this.dbName = dbName;
        this.storeName = storeName;
        this.db = null;
    }

    /**
     * Opens the IndexedDB connection.
     * @returns {Promise<IDBDatabase>}
     */
    async open() {
        if (this.db) return this.db;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { autoIncrement: true });
                }
            };
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * Adds an image file to the database.
     * @param {File} file - The image file to add.
     * @returns {Promise<number>} The key of the added image.
     */
    async addImage(file) {
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.add(file);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Adds multiple image files to the database in a single transaction.
     * @param {File[]} files - The image files to add.
     * @returns {Promise<Array<number>>} The keys of the added images.
     */
    async addImages(files) {
        if (!files || files.length === 0) return [];
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const keys = [];

            tx.oncomplete = () => resolve(keys);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(new Error('Transaction aborted'));

            for (const file of files) {
                const request = store.add(file);
                request.onsuccess = (e) => {
                    keys.push(e.target.result);
                };
            }
        });
    }

    /**
     * Retrieves all images and their keys from the database.
     * @returns {Promise<Array<{id: number, file: File}>>}
     */
    async getAllImages() {
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.getAll();
            const keyRequest = store.getAllKeys();

            let images = null;
            let keys = null;

            const checkDone = () => {
                if (images !== null && keys !== null) {
                    resolve(this.combineKeysAndValues(keys, images));
                }
            };

            request.onsuccess = () => {
                images = request.result;
                checkDone();
            };
            keyRequest.onsuccess = () => {
                keys = keyRequest.result;
                checkDone();
            };
            request.onerror = () => reject(request.error);
            keyRequest.onerror = () => reject(keyRequest.error);
        });
    }

    /**
     * Retrieves all keys from the image store.
     * @returns {Promise<Array<number>>}
     */
    async getAllKeys() {
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.getAllKeys();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Retrieves a single image by its key.
     * @param {number} key - The key of the image.
     * @returns {Promise<File>}
     */
    async getImage(key) {
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Deletes an image by its key.
     * @param {number} key - The key of the image to delete.
     * @returns {Promise<void>}
     */
    async deleteImage(key) {
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clears all images from the database.
     * @returns {Promise<void>}
     */
    async clearAll() {
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Exports image data as a single gzip-compressed JSON blob.
     * Images are loaded and encoded one at a time to keep peak memory at O(1 image).
     * @param {number[]} [orderedKeys] - Keys in desired export order. Defaults to DB key order.
     * @returns {Promise<Array<{filename: string, blob: Blob}>>}
     */
    async exportData(orderedKeys) {
        const keys = orderedKeys ?? await this.getAllKeys();
        if (keys.length === 0) return [];

        const encoder = new TextEncoder();
        const { readable, writable } = new TransformStream();
        const compressed = readable.pipeThrough(new CompressionStream('gzip'));
        const writer = writable.getWriter();

        // Start consuming the compressed stream before writing to avoid deadlock
        const blobPromise = new Response(compressed).blob();

        await writer.write(encoder.encode(`{"version":2,"timestamp":"${new Date().toISOString()}","images":[`));
        for (let i = 0; i < keys.length; i++) {
            const file = await this.getImage(keys[i]);
            const base64 = await blobToBase64(file);
            const imageData = JSON.stringify({
                id: keys[i],
                name: file.name,
                type: file.type,
                lastModified: file.lastModified,
                data: base64
            });
            await writer.write(encoder.encode((i > 0 ? ',' : '') + imageData));
        }
        await writer.write(encoder.encode(']}'));
        await writer.close();

        const blob = await blobPromise;
        const date = new Date().toISOString().slice(0, 10);
        return [{ filename: `oshikoyo_images_backup_${date}.json.gz`, blob }];
    }

    /**
     * Imports image data from a JSON object.
     * @param {object} jsonData - The imported JSON data.
     * @returns {Promise<{added: number, skipped: number}>}
     */
    async importData(jsonData) {
        await this.open();
        if (!jsonData || !jsonData.images || !Array.isArray(jsonData.images)) {
            throw new Error('Invalid backup file format');
        }

        const existingImages = await this.getAllImages();
        const sigMap = buildBlobSignatureMap(existingImages);
        let addedCount = 0, skippedCount = 0;
        const filesToAdd = [];

        for (const item of jsonData.images) {
            const blob = base64ToBlob(item.data, item.type);
            if (await isDuplicateBlob(blob, sigMap)) { skippedCount++; continue; }
            filesToAdd.push(new File([blob], item.name || 'imported_image', {
                type: item.type, lastModified: item.lastModified || Date.now()
            }));
            addedCount++;
        }

        if (filesToAdd.length > 0) await this.addImages(filesToAdd);
        return { added: addedCount, skipped: skippedCount };
    }

    /**
     * 元のIDで画像を一括復元する（全データ復元用）。
     * @param {Array<{id: number, file: File}>} images
     * @returns {Promise<void>}
     */
    async restoreImages(images) {
        if (!images || images.length === 0) return;
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            tx.oncomplete = () => resolve();
            tx.onerror  = () => reject(tx.error);
            tx.onabort  = () => reject(new Error('Transaction aborted'));
            for (const { id, file } of images) {
                store.put(file, id);
            }
        });
    }

    /**
     * 既存レコードを同一キーで上書き保存する（圧縮後ファイルの差し替え用）。
     * @param {number} key - 上書き対象のキー
     * @param {File} file - 新しいファイル
     * @returns {Promise<void>}
     */
    async updateImage(key, file) {
        await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.put(file, key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Helper to combine keys and values into objects.
     * @param {Array<number>} keys - Array of keys.
     * @param {Array<File>} values - Array of image files.
     * @returns {Array<{id: number, file: File}>}
     */
    combineKeysAndValues(keys, values) {
        return values.map((val, i) => ({ id: keys[i], file: val }));
    }
}

const localImageDB = new LocalImageDB();


let appSettings = { ...DEFAULT_SETTINGS };
const STORAGE_KEY = 'oshikoyo_settings';

// Helper: Blob to Base64
/**
 * Converts a Blob to a Base64 string.
 * @param {Blob} blob - The blob to convert.
 * @returns {Promise<string>}
 */
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // result looks like "data:image/png;base64,....."
            // We just want the comma onwards, or keep it all? 
            // Usually keeping it all is easier for img.src, but for clean data we might strip.
            // But base64ToBlob needs to know what to do. Let's keep it simple: keep the whole string.
            resolve(reader.result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Helper: Base64 to Blob
/**
 * Converts a Base64 string back to a Blob.
 * @param {string} base64 - The base64 string.
 * @param {string} mimeType - The fallback MIME type.
 * @returns {Blob}
 */
function base64ToBlob(base64, mimeType) {
    // Basic validation
    if (typeof base64 !== 'string' || base64.length === 0) {
        throw new Error('Invalid base64 data');
    }

    base64 = base64.trim(); // Ensure no surrounding whitespace

    // If it contains data URI prefix, strip it (or fetch it)
    if (base64.startsWith('data:')) {
        const commaIndex = base64.indexOf(',');
        if (commaIndex === -1) {
            throw new Error('Invalid Data URI: no comma found');
        }

        const metadata = base64.substring(0, commaIndex);
        const data = base64.substring(commaIndex + 1);

        const mimeMatch = metadata.match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : mimeType; // Fallback if regex fails, though unlikely for valid Data URI

        const bstr = atob(data);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    } else {
        // Raw base64
        try {
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            return new Blob([byteArray], { type: mimeType });
        } catch (e) {
            console.error("atob failure:", e);
            throw new Error('Failed to decode base64 string');
        }
    }
}

// Helper: Compare Blobs
/**
 * Compares two Blobs for equality by content.
 * @param {Blob} blob1 
 * @param {Blob} blob2 
 * @returns {Promise<boolean>}
 */
async function areBlobsEqual(blob1, blob2) {
    if (blob1.size !== blob2.size) return false;
    if (blob1.type !== blob2.type) return false;

    const buf1 = await blob1.arrayBuffer();
    const buf2 = await blob2.arrayBuffer();

    const len = buf1.byteLength;
    const remainder = len % 8;
    const mainLength = len - remainder;

    const view1 = new BigInt64Array(buf1, 0, mainLength / 8);
    const view2 = new BigInt64Array(buf2, 0, mainLength / 8);

    for (let i = 0; i < view1.length; i++) {
        if (view1[i] !== view2[i]) return false;
    }

    if (remainder > 0) {
        const tail1 = new Uint8Array(buf1, mainLength, remainder);
        const tail2 = new Uint8Array(buf2, mainLength, remainder);
        for (let i = 0; i < remainder; i++) {
            if (tail1[i] !== tail2[i]) return false;
        }
    }

    return true;
}

// Helper: Blob Deduplication Utilities

/**
 * 既存画像リストからサイズ+MIMEタイプのシグネチャマップを構築する。
 * @param {Array<{file: File}>} images
 * @returns {Map<string, Array<{file: Blob, hash: number|null}>>}
 */
function buildBlobSignatureMap(images) {
    const sigMap = new Map();
    for (const img of images) {
        const key = `${img.file.size}-${img.file.type}`;
        if (!sigMap.has(key)) sigMap.set(key, []);
        sigMap.get(key).push({ file: img.file, hash: null });
    }
    return sigMap;
}

/**
 * Blobのサンプリングハッシュを取得する（高速候補フィルタ用）。
 * @param {{file: Blob, hash: number|null}} obj
 * @returns {Promise<number>}
 */
async function getBlobHash(obj) {
    if (obj.hash !== null) return obj.hash;
    const buf = await obj.file.arrayBuffer();
    const view = new Uint8Array(buf);
    let hash = 5381;
    const len = view.length;
    const step = Math.max(1, Math.floor(len / 100000));
    for (let i = 0; i < len; i += step) {
        hash = ((hash << 5) + hash) + view[i];
    }
    obj.hash = hash;
    return hash;
}

/**
 * BlobがsigMap内の既存エントリと重複するか判定する。
 * 非重複の場合はsigMapに登録してバッチ内重複も防ぐ。
 * @param {Blob} blob
 * @param {Map} sigMap
 * @returns {Promise<boolean>}
 */
async function isDuplicateBlob(blob, sigMap) {
    const key = `${blob.size}-${blob.type}`;
    if (sigMap.has(key)) {
        const incomingObj = { file: blob, hash: null };
        const incomingHash = await getBlobHash(incomingObj);
        for (const candidate of sigMap.get(key)) {
            const candidateHash = await getBlobHash(candidate);
            if (incomingHash === candidateHash && await areBlobsEqual(candidate.file, blob)) {
                return true;
            }
        }
    }
    if (!sigMap.has(key)) sigMap.set(key, []);
    sigMap.get(key).push({ file: blob, hash: null });
    return false;
}

// Helper: Escape HTML
/**
 * Escapes special characters in a string to prevent XSS.
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string.
 */
function escapeHTML(str) {
    if (!str) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return str.replace(/[&<>"']/g, m => map[m]);
}

// --- State Persistence (Separate from Settings) ---
const STATE_KEY = 'oshikoyo_state';
let appState = {
    lastMediaKey: null,
    // Cycle mode specific state
    // mediaHistory: [] // Runtime only, or persistent? Let's make it persistent for better UX on refresh
    mediaHistory: [],
    mediaHistoryIndex: -1 // Point to current position in history
};

/**
 * Loads the application state from localStorage.
 */
function loadState() {
    try {
        const saved = localStorage.getItem(STATE_KEY);
        if (saved) {
            const loaded = JSON.parse(saved);
            appState = { ...appState, ...loaded };

            // Safety checks for new properties
            if (!appState.mediaHistory) appState.mediaHistory = [];
            if (typeof appState.mediaHistoryIndex === 'undefined') appState.mediaHistoryIndex = -1;
        }
    } catch (e) { console.error('Failed to load state', e); }
}

/**
 * Saves the application state to localStorage.
 */
function saveState() {
    try {
        localStorage.setItem(STATE_KEY, JSON.stringify(appState));
    } catch (e) { console.error('Failed to save state', e); }
}

// Helper: Get Contrast Color (Black or White)
function getContrastColor(hex) {
    if (!hex || !hex.startsWith('#')) return '#000000';
    hex = hex.replace('#', '');

    let r, g, b;
    if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    } else {
        return '#000000';
    }

    // YIQ equation
    var yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 140) ? '#1a1a1a' : '#ffffff'; // 140 threshold, using dark gray for black for softer look
}

/**
 * Converts hex color to rgba.
 * @param {string} hex 
 * @param {number} alpha 
 * @returns {string}
 */
function hexToRgba(hex, alpha) {
    if (!hex || !hex.startsWith('#')) return hex;
    hex = hex.replace('#', '');
    let r, g, b;
    if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
    } else {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Helper: Parse Date String to {month, day}
function parseDateString(str) {
    if (!str) return null;
    str = str.trim();

    // Format: "YYYY/MM/DD" or "YYYY-MM-DD"
    let match = str.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (match) {
        return { year: parseInt(match[1]), month: parseInt(match[2]), day: parseInt(match[3]) };
    }

    // Format: "M/D" (year-less, e.g., 1/15)
    match = str.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (match) {
        return { year: null, month: parseInt(match[1]), day: parseInt(match[2]) };
    }

    // Format: "M月D日"
    match = str.match(/^(\d{1,2})月(\d{1,2})日$/);
    if (match) {
        return { year: null, month: parseInt(match[1]), day: parseInt(match[2]) };
    }

    // Format: "YYYY-MM-DD" standard date input value
    match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
        return { year: parseInt(match[1]), month: parseInt(match[2]), day: parseInt(match[3]) };
    }

    return null;
}

// --- Holiday Logic ---
const HOLIDAY_EXCEPTIONS = {
    // 2019年天皇即位関連
    "2019-04-30": "国民の休日",
    "2019-05-01": "即位の日",
    "2019-05-02": "国民の休日",
    "2019-10-22": "即位礼正殿の儀",
    // 2020年オリンピック特例
    "2020-07-20": null, // 海の日（移動前）
    "2020-07-23": "海の日",
    "2020-07-24": "スポーツの日",
    "2020-08-10": "山の日",
    "2020-08-11": null, // 山の日（移動前）
    "2020-10-12": null, // スポーツの日（移動前）
    // 2021年オリンピック特例
    "2021-07-19": null, // 海の日（移動前）
    "2021-07-22": "海の日",
    "2021-07-23": "スポーツの日",
    "2021-08-08": "山の日",
    "2021-08-09": "振替休日",
    "2021-08-11": null, // 山の日（移動前）
    "2021-10-11": null, // スポーツの日（移動前）
    // 敬老の日と秋分の日で挟まれる国民の休日（シルバーウィーク）
    "2009-09-22": "国民の休日",
    "2015-09-22": "国民の休日",
    "2026-09-22": "国民の休日",
    "2032-09-21": "国民の休日",
    "2037-09-22": "国民の休日"
};

function getJPHoliday(date) {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const day = date.getDay();

    // フォーマット: YYYY-MM-DD
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    // 例外リストに存在する場合はそれを優先（特例や移動、新設など）
    if (HOLIDAY_EXCEPTIONS[dateStr] !== undefined) {
        return HOLIDAY_EXCEPTIONS[dateStr];
    }

    const isNthMonday = (n) => {
        if (day !== 1) return false;
        const min = (n - 1) * 7 + 1;
        const max = n * 7;
        return d >= min && d <= max;
    };

    const getVernalEquinox = (year) => {
        if (year <= 1947) return 0; // 祝日法施行前
        if (year <= 1979) return Math.floor(20.8357 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
        if (year <= 2099) return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
        return Math.floor(21.8510 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    };

    const getAutumnalEquinox = (year) => {
        if (year <= 1947) return 0; // 祝日法施行前
        if (year <= 1979) return Math.floor(23.2588 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
        if (year <= 2099) return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
        return Math.floor(24.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    };

    if (m === 1 && d === 1) return "元日";
    if (m === 2 && d === 11) return "建国記念の日";
    if (m === 2 && d === 23 && y >= 2020) return "天皇誕生日";
    if (m === 4 && d === 29) return y >= 2007 ? "昭和の日" : "みどりの日";
    if (m === 5 && d === 3) return "憲法記念日";
    if (m === 5 && d === 4) return y >= 2007 ? "みどりの日" : "国民の休日";
    if (m === 5 && d === 5) return "こどもの日";
    if (m === 8 && d === 11 && y >= 2016) return "山の日";
    if (m === 11 && d === 3) return "文化の日";
    if (m === 11 && d === 23) return "勤労感謝の日";
    if (m === 12 && d === 23 && y >= 1989 && y <= 2018) return "天皇誕生日";

    if (m === 1 && isNthMonday(2)) return y >= 2000 ? "成人の日" : null;
    if (m === 1 && d === 15 && y <= 1999) return "成人の日";

    if (m === 7 && isNthMonday(3)) return y >= 2003 ? "海の日" : null;
    if (m === 7 && d === 20 && y >= 1996 && y <= 2002) return "海の日";

    if (m === 9 && isNthMonday(3)) return y >= 2003 ? "敬老の日" : null;
    if (m === 9 && d === 15 && y <= 2002) return "敬老の日";

    if (m === 10 && isNthMonday(2)) return y >= 2020 ? "スポーツの日" : (y >= 2000 ? "体育の日" : null);
    if (m === 10 && d === 10 && y <= 1999) return "体育の日";

    if (m === 3 && d === getVernalEquinox(y)) return "春分の日";
    if (m === 9 && d === getAutumnalEquinox(y)) return "秋分の日";

    const yesterday = new Date(date);
    yesterday.setDate(d - 1);
    if (yesterday.getDay() === 0) {
        const yHol = getJPHoliday(yesterday);
        if (yHol && yHol !== "振替休日") return "振替休日";
    }

    return null;
}

// --- Calendar Generation ---

const TODAY = new Date();
let currentRefDate = new Date();

// Generate Weekday Header HTML based on startOfWeek
function getWeekdayHeaderHTML(startOfWeek) {
    const days = [
        { label: '日', cls: 'sunday' },
        { label: '月', cls: '' },
        { label: '火', cls: '' },
        { label: '水', cls: '' },
        { label: '木', cls: '' },
        { label: '金', cls: '' },
        { label: '土', cls: 'saturday' }
    ];

    // Rotate array if startOfWeek is 1 (Mon)
    let orderedDays = [...days];
    if (startOfWeek === 1) {
        const sun = orderedDays.shift(); // Remove Sun
        orderedDays.push(sun); // Add Sun to end
    }

    return orderedDays.map(d => `<span class="${d.cls}">${d.label}</span>`).join('');
}

// --- Popup Logic ---
function createPopup() {
    if (!document.getElementById('date-hover-popup')) {
        const p = document.createElement('div');
        p.id = 'date-hover-popup';
        document.body.appendChild(p);
    }
}

function showPopup(e, html) {
    const popup = document.getElementById('date-hover-popup');
    if (!popup) return;
    popup.innerHTML = html;
    popup.style.display = 'block';

    const rect = e.target.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();

    // Initial Position: Top-Center of cell
    let top = rect.top - popupRect.height - 10;
    let left = rect.left + (rect.width / 2) - (popupRect.width / 2);

    // Boundary Checks
    if (top < 10) {
        top = rect.bottom + 10; // Flip to bottom if clipping top
    }
    if (left < 10) {
        left = 10;
    } else if (left + popupRect.width > window.innerWidth - 10) {
        left = window.innerWidth - popupRect.width - 10;
    }

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
}

function hidePopup() {
    const popup = document.getElementById('date-hover-popup');
    if (popup) popup.style.display = 'none';
}

// SVGパスマップ (Lucide スタイル)
const EVENT_ICON_PATHS = {
    cake:   `<path d="M12 7v5"/><path d="M9 12h6v4H9z"/><path d="M5 16h14v4H5z"/><path d="M12 3a1 1 0 0 1 0 2 1 1 0 0 1 0-2z"/>`,
    star:   `<polygon points="12 2 15.09 8.26 22 9.27 17 14.24 18.18 21.02 12 17.77 5.82 21.02 7 14.24 2 9.27 8.91 8.26 12 2"/>`,
    music:  `<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>`,
    mic:    `<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>`,
    camera: `<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>`,
    heart:  `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>`,
    trophy: `<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>`,
    gift:   `<rect x="3" y="8" width="18" height="14" rx="2"/><path d="M21 12H3"/><path d="M12 8V22"/><path d="M8 8c0-2 1.5-4 4-4s4 2 4 4"/>`,
    tv:     `<rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/>`,
    flag:   `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>`,
    flower: `<path d="M12 5C12 5 6 9 6 14a6 6 0 0 0 12 0c0-5-6-9-6-9z"/><path d="M12 5V22"/><path d="M12 9C12 9 18 5.5 21 7c-2.5 4.33-7.5 5.5-9 2"/><path d="M12 9C12 9 6 5.5 3 7c2.5 4.33 7.5 5.5 9 2"/>`,
    zap:    `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
};

const EVENT_ICON_COLORS = {
    cake:   'icon-pink',
    star:   'icon-gold',
    music:  'icon-purple',
    mic:    'icon-purple',
    camera: 'icon-blue',
    heart:  'icon-red',
    trophy: 'icon-gold',
    gift:   'icon-green',
    tv:     'icon-blue',
    flag:   'icon-red',
    flower: 'icon-pink',
    zap:    'icon-yellow',
};

/** アイコンIDからSVG HTMLを返す */
function iconSVGHtml(iconId, svgClass) {
    const paths = EVENT_ICON_PATHS[iconId] || EVENT_ICON_PATHS.star;
    const color  = EVENT_ICON_COLORS[iconId] || 'icon-gold';
    return `<svg class="${svgClass} ${color}" viewBox="0 0 24 24">${paths}</svg>`;
}

/**
 * @param {'cake'|'star'|string} iconId
 * @param {boolean} isDark
 * @param {'popup'|'badge'} context
 */
function buildEventIcon(iconId, isDark, context) {
    if (context === 'badge') {
        return `<span class="day-icon-badge">${iconSVGHtml(iconId, 'day-icon-svg')}</span>`;
    }
    return `<span class="oshi-event-icon ${isDark ? 'is-dark' : ''}">${iconSVGHtml(iconId, 'oshi-event-svg')}</span>`;
}

function renderCalendar(container, year, month) {
    // Ensure popup exists
    createPopup();

    // Structure creation if empty
    if (!container.querySelector('.days-grid')) {
        container.innerHTML = `
            <div class="month-header"><h2 class="month-title"></h2></div>
            <div class="weekday-header">${getWeekdayHeaderHTML(appSettings.startOfWeek)}</div>
            <div class="days-grid"></div>
        `;
    }

    // Update Headers
    const headerEl = container.querySelector('.weekday-header');
    if (headerEl) headerEl.innerHTML = getWeekdayHeaderHTML(appSettings.startOfWeek);

    const title = container.querySelector('.month-title');
    const daysGrid = container.querySelector('.days-grid');

    title.textContent = `${year}年 ${month}月`;
    daysGrid.innerHTML = '';

    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);
    const daysInMonth = lastDayOfMonth.getDate();

    // Calculate Padding
    let startDayIndex = firstDayOfMonth.getDay() - appSettings.startOfWeek;
    if (startDayIndex < 0) startDayIndex += 7;

    const totalCellsFilled = startDayIndex + daysInMonth;
    const TOTAL_SLOTS = 42;

    // Padding Cells
    for (let i = 0; i < startDayIndex; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'day-cell is-other-month';
        daysGrid.appendChild(emptyCell);
    }

    // Pre-calculate parsed memorial dates and styles for each oshi
    const oshiEventDates = (appSettings.oshiList || []).map(oshi => {
        const textColor = oshi.color ? getContrastColor(oshi.color) : '#333';
        const textShadow = textColor === '#ffffff' ? '0 0 1px rgba(0,0,0,0.3)' : 'none';
        const escapedColor = oshi.color ? escapeHTML(oshi.color) : null;
        const rgbaBg = escapedColor ? hexToRgba(escapedColor, 0.85) : null;
        const baseStyle = rgbaBg ? `background-color: ${rgbaBg}; color: ${textColor}; text-shadow: ${textShadow};` : '';
        const isDarkIcon = textColor === '#1a1a1a';
        const escapedName = escapeHTML(oshi.name || '');

        return {
            ...oshi,
            textColor,
            textShadow,
            baseStyle,
            isDarkIcon,
            escapedName,
            parsedMemorialDates: (oshi.memorial_dates || []).map(md => ({
                ...md,
                parsed: parseDateString(md.date)
            }))
        };
    });

    // Optimization: Group events by day to avoid O(Days * Oshis) nested loop bottleneck
    const eventTypesMap = new Map((appSettings.event_types || []).map(t => [t.id, t]));
    const eventsByDay = Array.from({ length: daysInMonth + 1 }, () => []);

    oshiEventDates.forEach(oshi => {
        if (!oshi.name) return;
        const matchedEventsByDay = new Map();
        for (const md of oshi.parsedMemorialDates) {
            if (!md.parsed) continue;
            const { year: pYear, month: pMonth, day: pDay } = md.parsed;
            if (pMonth !== month || pDay < 1 || pDay > daysInMonth) continue;
            if (!md.is_annual && pYear && pYear !== year) continue;

            const typeInfo = eventTypesMap.get(md.type_id);
            const icon = typeInfo?.icon || 'star';
            const label = escapeHTML(typeInfo?.label || md.type_id);

            if (!matchedEventsByDay.has(pDay)) {
                matchedEventsByDay.set(pDay, []);
            }
            matchedEventsByDay.get(pDay).push({ label, icon });
        }

        matchedEventsByDay.forEach((matchedEvents, pDay) => {
            eventsByDay[pDay].push({ oshi, matchedEvents });
        });
    });

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
        const currentDate = new Date(year, month - 1, d);
        const dayOfWeek = currentDate.getDay(); // 0=Sun, 6=Sat
        const el = document.createElement('div');
        el.className = 'day-cell';

        if (dayOfWeek === 0) el.classList.add('is-sunday');
        if (dayOfWeek === 6) el.classList.add('is-saturday');

        const isToday = (
            currentDate.getFullYear() === TODAY.getFullYear() &&
            currentDate.getMonth() === TODAY.getMonth() &&
            currentDate.getDate() === TODAY.getDate()
        );
        if (isToday) el.classList.add('is-today');

        // Japanese Holiday
        const holidayName = getJPHoliday(currentDate);
        if (holidayName) el.classList.add('is-holiday');

        // Check Multi-Oshi Events
        let oshiMarkups = [];
        let oshiPopupEvents = [];
        let dayIcons = new Set();

        for (const { oshi, matchedEvents } of eventsByDay[d]) {
            const { baseStyle, isDarkIcon, escapedName } = oshi;

            matchedEvents.forEach(e => dayIcons.add(e.icon));

            const titleText = `${matchedEvents.map(e => e.label).join('・')}: ${escapedName}`;
            oshiMarkups.push(`<div class="oshi-event" style="${baseStyle}" title="${titleText}" data-oshi-name="${escapedName}">${escapedName}</div>`);

            const iconsHtml = matchedEvents.map(e => buildEventIcon(e.icon, isDarkIcon, 'popup'));
            oshiPopupEvents.push(`<div class="popup-event-row" style="${baseStyle}">${iconsHtml.join(' ')} ${escapedName} ${matchedEvents.map(e => e.label).join('・')}</div>`);
        }

        if (oshiMarkups.length > 0) {
            el.classList.add('is-oshi-date');
        }

        let html = `<div class="day-header"><span class="day-number">${d}</span>`;
        if (dayIcons.size > 0) {
            html += `<div class="day-icons">`;
            for (const iconId of dayIcons) {
                html += buildEventIcon(iconId, false, 'badge');
            }
            html += `</div>`;
        }
        html += `</div>`;
        if (holidayName) {
            html += `<span class="holiday-name">${escapeHTML(holidayName)}</span>`;
        }

        // Append Oshi Events
        if (oshiMarkups.length > 0) {
            html += `<div class="oshi-events-container">${oshiMarkups.join('')}</div>`;
        }

        el.innerHTML = html;

        // --- Popup Content Generation ---
        const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];
        const dayLabel = dayLabels[dayOfWeek];

        let popupHtml = `<div class="popup-header"><span class="popup-date">${month}月${d}日 (${dayLabel})</span>`;
        if (holidayName) {
            popupHtml += `<span class="popup-holiday">${escapeHTML(holidayName)}</span>`;
        }
        popupHtml += `</div>`;

        if (oshiPopupEvents.length > 0) {
            popupHtml += `<div class="popup-events-container">${oshiPopupEvents.join('')}</div>`;
        }

        // Attach Hover Logic
        el.addEventListener('mouseenter', (e) => showPopup(e, popupHtml));
        el.addEventListener('mouseleave', hidePopup);

        daysGrid.appendChild(el);
    }

    // Trailing Padding
    for (let i = totalCellsFilled; i < TOTAL_SLOTS; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'day-cell is-other-month';
        daysGrid.appendChild(emptyCell);
    }
}

function updateView() {
    const wrapper = document.getElementById('calendarWrapper');
    if (!wrapper) return;
    wrapper.innerHTML = ''; // Clear current views

    // Apply Layout Class
    // 1ヶ月表示時は方向設定を無視してcolumnで統一（設定値は保持）
    const effectiveDirection = appSettings.monthCount === 1 ? 'column' : appSettings.layoutDirection;
    wrapper.className = `calendar-wrapper direction-${effectiveDirection}`;

    // Apply Media Position Class to Main Layout
    const mainLayout = document.getElementById('mainLayout');
    if (mainLayout) {
        mainLayout.className = `main-layout pos-${appSettings.mediaPosition}`;
    }

    // Loop for Month Count
    let targetDate = new Date(currentRefDate); // Clone

    for (let i = 0; i < appSettings.monthCount; i++) {
        const section = document.createElement('section');
        section.className = 'calendar-month';
        section.id = `month-${i}`;

        const y = targetDate.getFullYear();
        const m = targetDate.getMonth() + 1;

        wrapper.appendChild(section);
        renderCalendar(section, y, m);

        // Advance 1 month
        targetDate.setMonth(targetDate.getMonth() + 1);
    }

    updateMediaArea('layout');
}

// --- Media Logic ---
// --- Settings Logic ---

function renderOshiList() {
    // Now only updates the count display in the main settings modal
    const countEl = document.getElementById('oshiCount');
    if (countEl) {
        countEl.textContent = (appSettings.oshiList || []).length;
    }
}

function openOshiManager() {
    renderOshiTable();
    renderEventTypeManager();
    document.getElementById('oshiManagementModal').showModal();
}

let _oshiDragSrcIndex = -1;
let _imgDragSrcIndex = -1;

/**
 * Returns image keys sorted by localImageOrder.
 * Keys not in order are appended at the end.
 * @param {number[]} dbKeys
 * @returns {number[]}
 */
function getOrderedImageKeys(dbKeys) {
    const order = appSettings.localImageOrder;
    if (!order || order.length === 0) return dbKeys;
    const dbSet = new Set(dbKeys);
    const ordered = order.filter(id => dbSet.has(id));
    const inOrder = new Set(ordered);
    for (const k of dbKeys) {
        if (!inOrder.has(k)) ordered.push(k);
    }
    return ordered;
}

// --- Memorial Tag Logic ---
function getTodayMemorialOshis() {
    const today = new Date();
    const m = today.getMonth() + 1, d = today.getDate(), y = today.getFullYear();
    return (appSettings.oshiList || []).filter(oshi =>
        (oshi.memorial_dates || []).some(md => {
            const parsed = parseDateString(md.date);
            if (!parsed || parsed.month !== m || parsed.day !== d) return false;
            if (!md.is_annual && parsed.year && parsed.year !== y) return false;
            return true;
        })
    );
}

function getEffectiveImagePool(orderedKeys) {
    const memOshis = getTodayMemorialOshis();
    if (memOshis.length === 0) return orderedKeys;
    const targetTags = new Set();
    memOshis.forEach(oshi => {
        if (oshi.name) targetTags.add(oshi.name);
        (oshi.tags || []).forEach(t => targetTags.add(t));
    });
    const preferred = orderedKeys.filter(id =>
        getImageTags(id).some(t => targetTags.has(t))
    );
    if (preferred.length === 0) return orderedKeys;
    if (appSettings.memorialDisplayMode === 'exclusive') return preferred;
    return Math.random() < 0.8 ? preferred : orderedKeys;
}

/**
 * 表示された画像のタグと記念日推しを照合し、カレンダー内の該当推し名を一時的に光らせる。
 * @param {number} imgId - 表示中の画像ID
 */
function highlightMemorialOshisForImage(imgId) {
    const memOshis = getTodayMemorialOshis();
    if (memOshis.length === 0) return;
    const imgTags = getImageTags(imgId);
    if (imgTags.length === 0) return;

    // タグが記念日推しと一致するか確認
    const matched = memOshis.filter(oshi => {
        const oshiTags = new Set([oshi.name, ...(oshi.tags || [])]);
        return imgTags.some(t => oshiTags.has(t));
    });
    if (matched.length === 0) return;

    const matchedNames = new Set(matched.map(o => o.name));
    document.querySelectorAll('.oshi-event').forEach(el => {
        if (matchedNames.has(el.dataset.oshiName)) {
            el.classList.remove('is-memorial-active');
            // force reflow to restart animation
            void el.offsetWidth;
            el.classList.add('is-memorial-active');
        }
    });
}

// --- Tag Logic ---
function getImageTags(imgId) {
    const meta = appSettings.localImageMeta || {};
    return meta[imgId]?.tags ? [...meta[imgId].tags] : [];
}

function setImageTags(imgId, tags) {
    if (!appSettings.localImageMeta) appSettings.localImageMeta = {};
    if (!appSettings.localImageMeta[imgId]) appSettings.localImageMeta[imgId] = {};
    appSettings.localImageMeta[imgId].tags = tags;
}

function addTagsToMaster(tags) {
    if (!appSettings.tags) appSettings.tags = [];
    tags.forEach(t => { if (t && !appSettings.tags.includes(t)) appSettings.tags.push(t); });
}

function renderOshiTable() {
    const tbody = document.getElementById('oshiTableBody');
    const emptyMsg = document.getElementById('oshiTableEmpty');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!appSettings.oshiList || appSettings.oshiList.length === 0) {
        if (emptyMsg) emptyMsg.style.display = 'block';
        return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';

    appSettings.oshiList.forEach((oshi, index) => {
        const row = document.createElement('tr');

        // D. ドラッグハンドル
        const handleCell = document.createElement('td');
        handleCell.className = 'oshi-handle-cell';
        handleCell.title = 'ドラッグして並び替え';
        handleCell.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>`;
        handleCell.addEventListener('mousedown', () => { row.draggable = true; });
        handleCell.addEventListener('click', (e) => e.stopPropagation());
        row.appendChild(handleCell);

        // Color swatch
        const colorCell = document.createElement('td');
        colorCell.className = 'oshi-color-cell';
        const swatch = document.createElement('span');
        swatch.className = 'oshi-color-swatch';
        swatch.style.backgroundColor = oshi.color || '#ccc';
        colorCell.appendChild(swatch);
        row.appendChild(colorCell);

        // Name
        const nameCell = document.createElement('td');
        nameCell.textContent = oshi.name || '-';
        row.appendChild(nameCell);

        // Tags
        const tagsCell = document.createElement('td');
        tagsCell.className = 'oshi-tags-cell';
        const tagList = oshi.tags || [];
        if (tagList.length > 0) {
            tagList.slice(0, 3).forEach(tag => {
                const chip = document.createElement('span');
                chip.className = 'oshi-tag-chip';
                chip.textContent = tag;
                tagsCell.appendChild(chip);
            });
            if (tagList.length > 3) {
                const more = document.createElement('span');
                more.className = 'oshi-tag-chip oshi-tag-chip--more';
                more.textContent = `+${tagList.length - 3}`;
                tagsCell.appendChild(more);
            }
        } else {
            tagsCell.textContent = '-';
        }
        row.appendChild(tagsCell);

        // Memorial dates count (C. バッジ表示)
        const datesCell = document.createElement('td');
        const datesCount = (oshi.memorial_dates || []).length;
        if (datesCount > 0) {
            const badge = document.createElement('span');
            badge.className = 'memorial-count-badge';
            badge.textContent = datesCount;
            datesCell.appendChild(badge);
        } else {
            datesCell.textContent = '-';
        }
        row.appendChild(datesCell);

        // Actions（編集・削除）
        const actCell = document.createElement('td');
        actCell.className = 'oshi-table-actions';

        // Edit Button
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn-icon-edit';
        editBtn.title = '編集';
        editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openOshiEditForm(index);
        });
        actCell.appendChild(editBtn);

        // Delete Button
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn-icon-delete';
        delBtn.title = '削除';
        delBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`「${oshi.name}」を削除しますか？`)) {
                appSettings.oshiList.splice(index, 1);
                renderOshiTable();
                renderOshiList();
            }
        });
        actCell.appendChild(delBtn);
        row.appendChild(actCell);

        // D. ドラッグ&ドロップ並び替え
        row.addEventListener('dragstart', (e) => {
            _oshiDragSrcIndex = index;
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => row.classList.add('is-dragging'), 0);
        });
        row.addEventListener('dragend', () => {
            row.draggable = false;
            row.classList.remove('is-dragging');
            tbody.querySelectorAll('.drag-over-top, .drag-over-bottom')
                .forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom'));
        });
        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (_oshiDragSrcIndex === index) return;
            tbody.querySelectorAll('.drag-over-top, .drag-over-bottom')
                .forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom'));
            const mid = row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
            row.classList.add(e.clientY < mid ? 'drag-over-top' : 'drag-over-bottom');
        });
        row.addEventListener('dragleave', (e) => {
            if (!row.contains(e.relatedTarget)) {
                row.classList.remove('drag-over-top', 'drag-over-bottom');
            }
        });
        row.addEventListener('drop', (e) => {
            e.preventDefault();
            if (_oshiDragSrcIndex === index) return;
            const mid = row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
            const tgt = e.clientY < mid ? index : index + 1;
            const copy = [...appSettings.oshiList];
            const [item] = copy.splice(_oshiDragSrcIndex, 1);
            copy.splice(_oshiDragSrcIndex < tgt ? tgt - 1 : tgt, 0, item);
            appSettings.oshiList = copy;
            saveSettings();
            renderOshiTable();
            renderOshiList();
        });

        tbody.appendChild(row);
    });
}

/** イベントタイプ管理リストを描画 */
function renderEventTypeManager() {
    const list = document.getElementById('eventTypeManagerList');
    if (!list) return;
    const types = appSettings.event_types || [];
    if (types.length === 0) {
        list.innerHTML = '<p class="et-empty">タイプが登録されていません</p>';
        return;
    }
    list.innerHTML = types.map(t => {
        const isBuiltin = t.id === 'bday' || t.id === 'debut';
        const svg = iconSVGHtml(t.icon || 'star', 'et-icon-svg');
        const action = isBuiltin
            ? '<span class="et-builtin">組込み</span>'
            : `<button type="button" class="et-delete" data-type-id="${escapeHTML(t.id)}">削除</button>`;
        return `<div class="event-type-row">${svg}<span class="et-label">${escapeHTML(t.label)}</span>${action}</div>`;
    }).join('');
    list.querySelectorAll('.et-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteEventType(btn.dataset.typeId));
    });
}

/** カスタムイベントタイプを削除 */
function deleteEventType(typeId) {
    appSettings.event_types = (appSettings.event_types || []).filter(t => t.id !== typeId);
    saveSettings();
    renderEventTypeManager();
}

// --- Oshi Edit Form Helpers ---

/** event_types からラベルを引く (見つからなければ type_id をそのまま返す) */
function getLabelForTypeId(typeId) {
    const found = (appSettings.event_types || []).find(t => t.id === typeId);
    return found ? found.label : typeId;
}

/** ラベルから type_id を引く (見つからなければ null) */
function getTypeIdForLabel(label) {
    const found = (appSettings.event_types || []).find(t => t.label === label);
    return found ? found.id : null;
}

/** typeId に対応するアイコンIDを取得 */
function getIconForTypeId(typeId) {
    const found = (appSettings.event_types || []).find(t => t.id === typeId);
    return found ? (found.icon || 'star') : 'star';
}

/** datalist に現在の event_types を反映する */
function updateEventTypeDatalist() {
    const dl = document.getElementById('eventTypeDatalist');
    if (!dl) return;
    dl.innerHTML = (appSettings.event_types || [])
        .map(t => `<option value="${escapeHTML(t.label)}">`)
        .join('');
}

function updateTagDatalist() {
    const dl = document.getElementById('tagDatalist');
    if (!dl) return;
    const oshiNames = (appSettings.oshiList || []).map(o => o.name).filter(Boolean);
    const allOptions = [...new Set([...oshiNames, ...(appSettings.tags || [])])];
    dl.innerHTML = allOptions.map(t => `<option value="${escapeHTML(t)}">`).join('');
}

// --- Tag UI ---
function createTagInputUI(initialTags, onChange) {
    const area = document.createElement('div');
    area.className = 'tag-input-area';
    let tags = [...initialTags];

    function commitInput(input) {
        const v = input.value.trim().replace(/,$/, '');
        if (v && !tags.includes(v)) {
            tags.push(v);
            addTagsToMaster([v]);
            onChange([...tags]);
            render();
        } else {
            input.value = '';
        }
    }

    function render() {
        area.innerHTML = '';
        tags.forEach((tag, i) => {
            const badge = document.createElement('span');
            badge.className = 'tag-badge';
            const txt = document.createTextNode(tag);
            const rm = document.createElement('button');
            rm.type = 'button';
            rm.className = 'tag-remove';
            rm.textContent = '×';
            rm.addEventListener('click', (e) => {
                e.stopPropagation();
                tags.splice(i, 1);
                onChange([...tags]);
                render();
            });
            badge.appendChild(txt);
            badge.appendChild(rm);
            area.appendChild(badge);
        });
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('list', 'tagDatalist');
        input.placeholder = tags.length ? '' : 'タグを追加...';
        input.addEventListener('focus', () => { input.dataset.prev = input.value; input.value = ''; });
        input.addEventListener('blur', () => { commitInput(input); });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                commitInput(input);
            } else if (e.key === 'Backspace' && !input.value && tags.length) {
                tags.pop();
                onChange([...tags]);
                render();
            }
        });
        area.appendChild(input);
    }

    area.addEventListener('click', (e) => {
        if (e.target === area) area.querySelector('input')?.focus();
    });
    render();
    return area;
}

/** 記念日行を1行追加する */
function addMemorialDateRow(md = null) {
    const list = document.getElementById('memorialDatesList');
    if (!list) return;

    const row = document.createElement('div');
    row.className = 'memorial-date-row';

    // アイコン選択ボタン
    const initIconId = md ? getIconForTypeId(md.type_id) : 'star';
    row.dataset.iconId = initIconId;

    const iconBtn = document.createElement('button');
    iconBtn.type = 'button';
    iconBtn.className = 'mdate-icon-btn';
    iconBtn.title = 'アイコンを変更';
    iconBtn.innerHTML = iconSVGHtml(initIconId, 'mdate-icon-svg');

    // アイコンピッカー (position:fixed で配置)
    const picker = document.createElement('div');
    picker.className = 'icon-picker-popup';
    picker.innerHTML = Object.keys(EVENT_ICON_PATHS).map(id =>
        `<button type="button" class="icon-chip${id === initIconId ? ' is-selected' : ''}" data-icon-id="${id}" title="${id}">${iconSVGHtml(id, 'icon-chip-svg')}</button>`
    ).join('');

    const updateIconUI = (id) => {
        row.dataset.iconId = id;
        iconBtn.innerHTML = iconSVGHtml(id, 'mdate-icon-svg');
        picker.querySelectorAll('.icon-chip').forEach(c =>
            c.classList.toggle('is-selected', c.dataset.iconId === id)
        );
    };

    iconBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.icon-picker-popup.is-open').forEach(p => {
            if (p !== picker) p.classList.remove('is-open');
        });
        if (!picker.classList.contains('is-open')) {
            const rect = iconBtn.getBoundingClientRect();
            picker.style.top  = `${rect.bottom + 4}px`;
            picker.style.left = `${rect.left}px`;
        }
        picker.classList.toggle('is-open');
    });

    picker.querySelectorAll('.icon-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            updateIconUI(chip.dataset.iconId);
            picker.classList.remove('is-open');
        });
    });

    // タイプ入力 (datalist コンボボックス)
    const typeInput = document.createElement('input');
    typeInput.type = 'text';
    typeInput.className = 'mdate-type';
    typeInput.setAttribute('list', 'eventTypeDatalist');
    typeInput.placeholder = 'タイプ (例: 誕生日)';
    if (md) typeInput.value = getLabelForTypeId(md.type_id);

    // フォーカス時に値をクリアして全オプションを表示（datalist は現在値でフィルタするため）
    typeInput.addEventListener('focus', () => {
        typeInput.dataset.prevValue = typeInput.value;
        typeInput.value = '';
    });

    // タイプが変わったらアイコンを自動更新
    typeInput.addEventListener('change', () => {
        delete typeInput.dataset.prevValue;
        const typeId = getTypeIdForLabel(typeInput.value.trim());
        if (typeId) updateIconUI(getIconForTypeId(typeId));
    });

    // フォーカスアウト時、何も選ばなかった場合は元の値に戻す
    typeInput.addEventListener('blur', () => {
        if ('prevValue' in typeInput.dataset && !typeInput.value.trim()) {
            typeInput.value = typeInput.dataset.prevValue;
            delete typeInput.dataset.prevValue;
        }
    });

    // 日付入力
    const dateInput = document.createElement('input');
    dateInput.type = 'text';
    dateInput.className = 'mdate-date';
    dateInput.placeholder = 'M/D または YYYY/M/D';
    if (md) dateInput.value = md.date;

    // 毎年チェックボックス
    const annualLabel = document.createElement('label');
    annualLabel.className = 'mdate-annual-label';
    const annualCheck = document.createElement('input');
    annualCheck.type = 'checkbox';
    annualCheck.className = 'mdate-annual';
    annualCheck.checked = md ? md.is_annual : true;
    annualLabel.appendChild(annualCheck);
    annualLabel.appendChild(document.createTextNode('毎年'));

    // 日付変更時に毎年のデフォルト値を自動設定
    dateInput.addEventListener('change', () => {
        const hasYear = /^\d{4}/.test(dateInput.value.trim());
        annualCheck.checked = !hasYear;
    });

    // 削除ボタン
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'mdate-delete';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', () => row.remove());

    row.append(iconBtn, picker, typeInput, dateInput, annualLabel, deleteBtn);
    list.appendChild(row);
}

// --- Oshi Edit Form ---

/** カラーチップ・ピッカー・テキスト入力を一括同期する */
function syncOshiColorUI(hex) {
    const textEl = document.getElementById('oshiEditColor');
    const chipEl = document.getElementById('oshiColorChip');
    const pickerEl = document.getElementById('oshiColorPicker');
    if (textEl) textEl.value = hex;
    if (chipEl) chipEl.style.backgroundColor = hex;
    if (pickerEl) pickerEl.value = hex;
}

/** '#' 有無を許容して #rrggbb 形式を返す。不正な場合は null */
function normalizeHex(input) {
    let val = input.trim();
    if (!val.startsWith('#')) val = '#' + val;
    return /^#[0-9a-fA-F]{6}$/.test(val) ? val.toLowerCase() : null;
}

function openOshiEditForm(index = -1) {
    const titleEl = document.getElementById('oshiEditTitle');
    const indexEl = document.getElementById('oshiEditIndex');
    const nameEl = document.getElementById('oshiEditName');

    indexEl.value = index;

    // datalist を最新の event_types で更新
    updateEventTypeDatalist();

    // 記念日リストをリセット
    const listEl = document.getElementById('memorialDatesList');
    if (listEl) listEl.innerHTML = '';

    if (index >= 0 && appSettings.oshiList && appSettings.oshiList[index]) {
        // Edit mode
        const oshi = appSettings.oshiList[index];
        titleEl.textContent = '編集';
        nameEl.value = oshi.name || '';
        syncOshiColorUI(oshi.color || '#3b82f6');
        (oshi.memorial_dates || []).forEach(md => addMemorialDateRow(md));
    } else {
        // Add mode
        titleEl.textContent = '新規追加';
        nameEl.value = '';
        syncOshiColorUI('#3b82f6');
    }

    // タグ入力UIを初期化
    updateTagDatalist();
    const currentOshiTags = (index >= 0 ? appSettings.oshiList[index]?.tags : null) || [];
    const existingTagArea = document.getElementById('oshiTagInputArea');
    if (existingTagArea) {
        const tagUI = createTagInputUI(currentOshiTags, () => {});
        tagUI.id = 'oshiTagInputArea';
        existingTagArea.replaceWith(tagUI);
    }

    document.getElementById('oshiEditModal').showModal();
}

function saveOshiFromForm() {
    const index = parseInt(document.getElementById('oshiEditIndex').value);
    const name = document.getElementById('oshiEditName').value.trim();
    const color = normalizeHex(document.getElementById('oshiEditColor').value) || '#3b82f6';

    if (!name) {
        alert('名前を入力してください');
        return;
    }

    // 記念日リストを収集
    if (!appSettings.event_types) appSettings.event_types = [...DEFAULT_SETTINGS.event_types];
    const memorial_dates = [];
    document.querySelectorAll('#memorialDatesList .memorial-date-row').forEach(row => {
        const typeLabel = row.querySelector('.mdate-type').value.trim();
        const date = row.querySelector('.mdate-date').value.trim();
        const is_annual = row.querySelector('.mdate-annual').checked;
        if (!typeLabel || !date) return; // 空行はスキップ

        const iconId = row.dataset.iconId || 'star';
        let typeId = getTypeIdForLabel(typeLabel);
        if (!typeId) {
            // 新規タイプ作成
            typeId = 'ev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            appSettings.event_types.push({ id: typeId, label: typeLabel, icon: iconId });
        } else {
            // 既存タイプのアイコンが変更されていれば更新
            const existing = appSettings.event_types.find(t => t.id === typeId);
            if (existing && existing.icon !== iconId) existing.icon = iconId;
        }
        memorial_dates.push({ type_id: typeId, date, is_annual });
    });

    if (!appSettings.oshiList) appSettings.oshiList = [];

    // タグを収集
    const tagBadges = [...document.querySelectorAll('#oshiTagInputArea .tag-badge')];
    const tags = tagBadges.map(b => b.childNodes[0].textContent.trim()).filter(Boolean);
    addTagsToMaster(tags);

    const oshiData = {
        name,
        color,
        memorial_dates,
        tags,
    };

    if (index >= 0) {
        // Update existing
        appSettings.oshiList[index] = oshiData;
    } else {
        // Add new
        appSettings.oshiList.push(oshiData);
    }

    document.getElementById('oshiEditModal').close();
    renderOshiTable();
    renderOshiList();
}

// --- Oshi Export ---
function handleOshiExport() {
    if (!appSettings.oshiList || appSettings.oshiList.length === 0) {
        showToast('エクスポートするデータがありません。');
        return;
    }
    showOshiExportDialog();
}

function showOshiExportDialog() {
    const count = appSettings.oshiList.length;
    const dlg = document.createElement('dialog');
    dlg.className = 'settings-modal';
    dlg.style.background = 'transparent';
    dlg.style.padding = '0';
    dlg.innerHTML = `
        <div style="padding:24px;min-width:320px;max-width:440px;width:90vw;box-sizing:border-box;background:var(--bg-color);border-radius:var(--border-radius)">
            <h3 style="margin:0 0 8px;font-size:1rem">推しデータをエクスポート</h3>
            <p style="margin:0 0 20px;font-size:0.88rem;color:var(--text-secondary)">${count}件の推しデータを書き出します。</p>
            <div style="display:flex;gap:12px;margin-bottom:20px">
                <button type="button" id="oshiExportJson" style="flex:1;padding:12px 8px;border:1px solid rgba(0,0,0,0.15);border-radius:10px;background:var(--card-bg);cursor:pointer;text-align:center">
                    <div style="font-size:1.2rem;margin-bottom:4px">📄</div>
                    <div style="font-weight:600;font-size:0.9rem;margin-bottom:4px">JSON形式</div>
                    <div style="font-size:0.75rem;color:var(--text-secondary)">全データを完全に保存<br>（推奨）</div>
                </button>
                <button type="button" id="oshiExportCsv" style="flex:1;padding:12px 8px;border:1px solid rgba(0,0,0,0.15);border-radius:10px;background:var(--card-bg);cursor:pointer;text-align:center">
                    <div style="font-size:1.2rem;margin-bottom:4px">📊</div>
                    <div style="font-weight:600;font-size:0.9rem;margin-bottom:4px">CSV形式</div>
                    <div style="font-size:0.75rem;color:var(--text-secondary)">テンプレートと同じ形式<br>Excelで編集可能</div>
                </button>
            </div>
            <div style="display:flex;justify-content:flex-end">
                <button type="button" id="oshiExportCancel" class="btn-cancel">キャンセル</button>
            </div>
        </div>
    `;
    document.body.appendChild(dlg);
    dlg.showModal();

    dlg.querySelector('#oshiExportCancel').onclick = () => { dlg.close(); dlg.remove(); };

    dlg.querySelector('#oshiExportJson').onclick = () => {
        dlg.close(); dlg.remove();
        const dataStr = JSON.stringify(appSettings.oshiList, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `oshi_list_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`${count}件のデータをエクスポートしました`);
    };

    dlg.querySelector('#oshiExportCsv').onclick = () => {
        dlg.close(); dlg.remove();
        exportOshiAsCsv();
    };
}

function escapeCsvField(str) {
    if (str == null) return '';
    const s = String(str);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

function exportOshiAsCsv() {
    const rows = [OSHI_CSV_TEMPLATE_HEADERS.join(',')];
    let truncatedCount = 0;

    appSettings.oshiList.forEach(oshi => {
        const dates = oshi.memorial_dates || [];
        const bday  = (dates.find(d => d.type_id === 'bday')  || {}).date || '';
        const debut = (dates.find(d => d.type_id === 'debut') || {}).date || '';
        const custom = dates.filter(d => d.type_id !== 'bday' && d.type_id !== 'debut');

        if (custom.length > 3) truncatedCount++;

        const eventCols = [];
        for (let i = 0; i < 3; i++) {
            const ev = custom[i];
            if (ev) {
                const typeEntry = (appSettings.event_types || []).find(t => t.id === ev.type_id);
                eventCols.push(escapeCsvField(typeEntry ? typeEntry.label : ev.type_id));
                eventCols.push(escapeCsvField(ev.date));
            } else {
                eventCols.push('', '');
            }
        }

        const tags = (oshi.tags || []).join(';');
        rows.push([
            escapeCsvField(oshi.name),
            escapeCsvField(oshi.color),
            escapeCsvField(bday),
            escapeCsvField(debut),
            ...eventCols,
            escapeCsvField(tags)
        ].join(','));
    });

    const bom = '\uFEFF';
    const blob = new Blob([bom + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oshi_list_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    if (truncatedCount > 0) {
        showToast(`CSVエクスポート完了（${truncatedCount}件: カスタム記念日が4件以上のため一部省略）`, 4000);
    } else {
        showToast(`${appSettings.oshiList.length}件のデータをCSVでエクスポートしました`);
    }
}

// --- Oshi CSV Import ---

const OSHI_CSV_TEMPLATE_HEADERS = [
    '名前', 'カラー', '誕生日', 'デビュー記念日',
    'イベント1_種別', 'イベント1_日付',
    'イベント2_種別', 'イベント2_日付',
    'イベント3_種別', 'イベント3_日付',
    'タグ'
];

/**
 * CSVテンプレートファイルをダウンロードする。
 */
function downloadOshiCsvTemplate() {
    const sample = [
        OSHI_CSV_TEMPLATE_HEADERS.join(','),
        '推しA,#ff6b9d,3/21,2019/9/1,3Dお披露目,2022/4/1,,,,,VTuber;歌手',
        '推しB,#3b82f6,11/5,,,,,,,,'
    ].join('\r\n');
    const bom = '\uFEFF'; // UTF-8 BOM（Excelで文字化けしないように）
    const blob = new Blob([bom + sample], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'oshi_template.csv';
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * CSV テキストを解析してオブジェクト配列に変換する。
 * クォート・CRLF・UTF-8 BOM に対応。
 * @param {string} text - CSVテキスト
 * @returns {{ headers: string[], rows: Object[] }} ヘッダーと行データ
 */
function parseCSV(text) {
    // BOM 除去
    const cleaned = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
    const lines = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    /**
     * 1行分のCSVをフィールド配列に分割する（クォート対応）。
     * @param {string} line
     * @returns {string[]}
     */
    function splitLine(line) {
        const fields = [];
        let cur = '';
        let inQuote = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuote) {
                if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
                else if (ch === '"') { inQuote = false; }
                else { cur += ch; }
            } else {
                if (ch === '"') { inQuote = true; }
                else if (ch === ',') { fields.push(cur.trim()); cur = ''; }
                else { cur += ch; }
            }
        }
        fields.push(cur.trim());
        return fields;
    }

    const nonEmptyLines = lines.filter(l => l.trim() !== '');
    if (nonEmptyLines.length < 2) return { headers: [], rows: [] };

    const headers = splitLine(nonEmptyLines[0]).map(h => h.trim());
    const rows = nonEmptyLines.slice(1).map(line => {
        const fields = splitLine(line);
        const obj = {};
        headers.forEach((h, i) => { obj[h] = (fields[i] || '').trim(); });
        return obj;
    });
    return { headers, rows };
}

/**
 * CSV行オブジェクトを推しデータに変換する。
 * @param {Object[]} rows - parseCSV の出力
 * @param {string} fileName - エラー表示用ファイル名
 * @returns {{ items: Object[], skippedRows: number }} 変換結果
 */
function convertCsvRowsToOshiItems(rows, fileName) {
    const items = [];
    let skippedRows = 0;

    rows.forEach((row, idx) => {
        const name = row['名前'] || row['name'] || '';
        if (!name) { skippedRows++; return; } // 名前なしはスキップ

        const color = row['カラー'] || row['color'] || '';
        const memorial_dates = [];

        // 誕生日・デビュー記念日
        const birthday = row['誕生日'] || row['birthday'] || '';
        const debut = row['デビュー記念日'] || row['debutDate'] || '';
        if (birthday) memorial_dates.push({ type_id: 'bday', date: birthday, is_annual: true });
        if (debut)    memorial_dates.push({ type_id: 'debut', date: debut, is_annual: true });

        // カスタムイベント（最大3組）
        if (!appSettings.event_types) appSettings.event_types = [...DEFAULT_SETTINGS.event_types];
        for (let n = 1; n <= 3; n++) {
            const label = (row[`イベント${n}_種別`] || '').trim();
            const date  = (row[`イベント${n}_日付`] || '').trim();
            if (!label || !date) continue;

            let typeId = getTypeIdForLabel(label);
            if (!typeId) {
                typeId = 'ev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
                appSettings.event_types.push({ id: typeId, label, icon: 'star' });
            }
            memorial_dates.push({ type_id: typeId, date, is_annual: true });
        }

        // タグ（セミコロン区切り）
        const tagRaw = row['タグ'] || row['tags'] || '';
        const tags = tagRaw ? tagRaw.split(';').map(t => t.trim()).filter(Boolean) : [];

        items.push({ name, color, memorial_dates, tags });
    });

    return { items, skippedRows };
}

/**
 * CSVインポートのプレビューダイアログを表示し、確認後にインポートを実行する。
 * @param {Object[]} newItems - 追加対象の推しデータ
 * @param {number} dupeCount - 重複スキップ件数
 * @param {number} errorRowCount - 不正行スキップ件数
 * @param {Function} onConfirm - 確定時コールバック
 */
function showOshiCsvPreview(newItems, dupeCount, errorRowCount, onConfirm) {
    const dlg = document.createElement('dialog');
    dlg.className = 'settings-modal';
    dlg.style.background = 'transparent';
    dlg.style.padding = '0';
    dlg.innerHTML = `
        <div style="padding:24px;min-width:340px;max-width:480px;width:90vw;box-sizing:border-box;background:var(--bg-color);border-radius:var(--border-radius)">
            <h3 style="margin:0 0 12px;font-size:1rem">CSVインポート確認</h3>
            <ul style="list-style:none;padding:0;margin:0 0 12px;display:flex;flex-direction:column;gap:4px;font-size:0.9rem">
                <li>追加: <strong>${newItems.length} 件</strong></li>
                ${dupeCount > 0 ? `<li style="color:var(--text-secondary)">重複スキップ: ${dupeCount} 件（同名の推しが既存）</li>` : ''}
                ${errorRowCount > 0 ? `<li style="color:var(--text-secondary)">不正行スキップ: ${errorRowCount} 件（名前が空等）</li>` : ''}
            </ul>
            ${newItems.length > 0 ? `
            <div style="max-height:280px;overflow-y:auto;border:1px solid rgba(0,0,0,0.1);border-radius:8px;padding:8px 12px;margin-bottom:16px;font-size:0.85rem">
                ${newItems.map(o => `<div style="display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid rgba(0,0,0,0.05)">
                    <span style="width:16px;height:16px;border-radius:50%;background:${escapeHTML(o.color||'#ccc')};flex-shrink:0;display:inline-block;border:1px solid rgba(0,0,0,0.15)"></span>
                    <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(o.name)}</span>
                    ${o.memorial_dates.length > 0 ? `<span style="color:var(--text-secondary);font-size:0.78rem;flex-shrink:0">記念日 ${o.memorial_dates.length}件</span>` : ''}
                </div>`).join('')}
            </div>` : `<p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:16px">追加できる推しがありません。</p>`}
            <div style="display:flex;justify-content:flex-end;gap:10px">
                <button type="button" id="csvPreviewCancel" class="btn-cancel">キャンセル</button>
                ${newItems.length > 0 ? `<button type="button" id="csvPreviewConfirm" class="btn-primary">追加する</button>` : ''}
            </div>
        </div>
    `;
    document.body.appendChild(dlg);
    dlg.showModal();

    dlg.querySelector('#csvPreviewCancel').onclick = () => { dlg.close(); dlg.remove(); };
    const confirmBtn = dlg.querySelector('#csvPreviewConfirm');
    if (confirmBtn) {
        confirmBtn.onclick = () => { dlg.close(); dlg.remove(); onConfirm(); };
    }
}

// --- Oshi Import (for modal) ---
function handleOshiImportFromModal(files) {
    if (!files || files.length === 0) return;

    const existingNames = new Set((appSettings.oshiList || []).map(o => o.name));
    const totalFiles = files.length;
    let processedCount = 0;

    // 全ファイル読み込み後にまとめてプレビューを出すため、結果を収集
    const allNewItems = [];
    let totalDupes = 0;
    let totalErrorRows = 0;
    const errorMessages = [];

    Array.from(files).forEach(file => {
        const isCsv = file.name.toLowerCase().endsWith('.csv');
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                if (isCsv) {
                    // --- CSV パス ---
                    const { rows } = parseCSV(e.target.result);
                    if (rows.length === 0) {
                        errorMessages.push(`${file.name}: データが空です`);
                        processedCount++;
                        checkAllLoaded();
                        return;
                    }
                    const { items, skippedRows } = convertCsvRowsToOshiItems(rows, file.name);
                    totalErrorRows += skippedRows;

                    items.forEach(item => {
                        if (existingNames.has(item.name)) { totalDupes++; return; }
                        existingNames.add(item.name);
                        allNewItems.push(item);
                    });
                } else {
                    // --- JSON パス ---
                    const data = JSON.parse(e.target.result);
                    if (!Array.isArray(data) || data.length === 0) {
                        errorMessages.push(`${file.name}: 有効なデータがありません`);
                        processedCount++;
                        checkAllLoaded();
                        return;
                    }
                    const rawItems = data.map(item => {
                        const birthday  = item['誕生日']     || item.birthday  || '';
                        const debutDate = item['周年記念日'] || item.debutDate || '';
                        const memorial_dates = [];
                        if (birthday)  memorial_dates.push({ type_id: 'bday',  date: birthday,  is_annual: true });
                        if (debutDate) memorial_dates.push({ type_id: 'debut', date: debutDate, is_annual: true });
                        return {
                            name: item['メンバー名'] || item.name || '',
                            color: item['公式カラー (Hex/系統)'] || item.color || '',
                            memorial_dates,
                            tags: Array.isArray(item.tags) ? item.tags : [],
                        };
                    }).filter(item => item.name);

                    rawItems.forEach(item => {
                        if (existingNames.has(item.name)) { totalDupes++; return; }
                        existingNames.add(item.name);
                        allNewItems.push(item);
                    });
                }
            } catch (err) {
                console.error('Import error:', err);
                errorMessages.push(`${file.name}: 解析に失敗しました`);
            }

            processedCount++;
            checkAllLoaded();
        };

        reader.onerror = () => {
            errorMessages.push(`${file.name}: 読み込みに失敗しました`);
            processedCount++;
            checkAllLoaded();
        };

        reader.readAsText(file, 'UTF-8');
    });

    function checkAllLoaded() {
        if (processedCount < totalFiles) return;

        if (errorMessages.length > 0 && allNewItems.length === 0) {
            showToast('エラー: ' + errorMessages.slice(0, 2).join(' / '), 5000);
            return;
        }

        // プレビューダイアログを表示してから確定
        showOshiCsvPreview(allNewItems, totalDupes, totalErrorRows, () => {
            if (!appSettings.oshiList) appSettings.oshiList = [];
            appSettings.oshiList.push(...allNewItems);
            addTagsToMaster(allNewItems.flatMap(o => o.tags || []));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
            renderOshiTable();
            renderOshiList();

            let message = `インポート完了: ${allNewItems.length}件追加`;
            if (totalDupes > 0) message += `, ${totalDupes}件スキップ（重複）`;
            if (totalErrorRows > 0) message += `, ${totalErrorRows}件スキップ（不正行）`;
            showToast(message);
        });
    }
}

function handleFileImport() {
    const fileInput = document.getElementById('importJson');
    const files = fileInput.files;
    if (!files || files.length === 0) return;

    const totalFiles = files.length; // Cache length before clearing input
    let processedCount = 0;
    let addedCount = 0;
    let skippedCount = 0;

    const existingNames = new Set((appSettings.oshiList || []).map(o => o.name));

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data)) {
                    // Map to internal format
                    const rawItems = data.map(item => ({
                        name: item['メンバー名'] || item.name || 'Unknown',
                        birthday: item['誕生日'] || item.birthday,
                        debutDate: item['周年記念日'] || item.debutDate,
                        color: item['公式カラー (Hex/系統)'] || item.color,
                        fanArtTag: item['ファンアートタグ'] || item.fanArtTag,
                    }));

                    // Deduplication Logic
                    const newItems = rawItems.filter(item => {
                        if (existingNames.has(item.name)) {
                            skippedCount++;
                            return false;
                        }
                        existingNames.add(item.name);
                        return true;
                    });

                    addedCount += newItems.length;
                    appSettings.oshiList = [...(appSettings.oshiList || []), ...newItems];
                }
            } catch (err) {
                console.error('Failed to parse JSON', err);
                alert(`${file.name} の読み込みに失敗しました: ${err.message}`);
            } finally {
                processedCount++;
                if (processedCount === totalFiles) {
                    renderOshiList();
                    fileInput.value = ''; // Reset

                    let msg = `${totalFiles} ファイルのインポートが完了しました。`;
                    if (addedCount > 0) msg += `\n(${addedCount}件追加)`;
                    if (skippedCount > 0) msg += `\n(${skippedCount}件は重複のためスキップされました)`;

                    alert(msg);
                }
            }
        };
        reader.readAsText(file);
    });
}

// --- Local Media UI Handlers ---

/**
 * navigator.storage.estimate() を使ってストレージインジケーターを更新する。
 * 未対応ブラウザでは非表示のまま。
 */
async function updateStorageIndicator() {
    const wrap  = document.getElementById('storageIndicatorWrap');
    const bar   = document.getElementById('storageIndicatorBar');
    const label = document.getElementById('storageIndicatorLabel');
    if (!wrap) return;

    if (!navigator.storage || !navigator.storage.estimate) {
        wrap.hidden = true;
        return;
    }

    try {
        const { quota, usage } = await navigator.storage.estimate();
        if (!quota) { wrap.hidden = true; return; }
        const pct = Math.min(100, Math.round((usage / quota) * 100));
        if (label) label.textContent =
            `使用中: ${(usage / 1024 / 1024).toFixed(1)} MB / 上限: ${(quota / 1024 / 1024).toFixed(0)} MB`;
        if (bar) bar.style.width = `${pct}%`;
        wrap.hidden = false;
    } catch {
        wrap.hidden = true;
    }
}

async function updateLocalMediaUI() {
    const countEl = document.getElementById('localImageCount');
    if (countEl) {
        const keys = await localImageDB.getAllKeys();
        countEl.textContent = keys.length;
    }
}

function openImageLightbox(src, onDelete = null, imgId = null) {
    const dlg = document.createElement('dialog');
    dlg.className = 'img-lightbox-dialog';

    // Security: Create the image element safely to prevent XSS via src attribute injection
    const imgLightboxInner = document.createElement('div');
    imgLightboxInner.className = 'img-lightbox-inner';

    const imgEl = document.createElement('img');
    imgEl.src = src;
    imgEl.alt = '';

    imgLightboxInner.appendChild(imgEl);

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'img-lightbox-close';
    closeBtn.title = '閉じる';
    closeBtn.textContent = '×';
    imgLightboxInner.appendChild(closeBtn);

    if (onDelete) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'img-lightbox-delete';
        deleteBtn.type = 'button';
        deleteBtn.title = '削除';
        deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
        imgLightboxInner.appendChild(deleteBtn);
    }

    dlg.appendChild(imgLightboxInner);

    const close = () => { dlg.close(); dlg.remove(); };
    dlg.addEventListener('click', (e) => {
        if (e.target === dlg || e.target.classList.contains('img-lightbox-close')) close();
    });
    if (onDelete) {
        dlg.querySelector('.img-lightbox-delete').addEventListener('click', async () => {
            close();
            await onDelete();
        });
    }
    if (imgId !== null) {
        updateTagDatalist();
        const tagSection = document.createElement('div');
        tagSection.className = 'img-lightbox-tags';
        const tagUI = createTagInputUI(getImageTags(imgId), (newTags) => {
            setImageTags(imgId, newTags);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
            if (showUntaggedOnly) {
                // タグなしフィルター中にタグを付与した場合、グリッドを再描画して即時除外
                renderLocalImageManager();
            } else {
                const gridItem = document.querySelector(`.local-image-item[data-img-id="${imgId}"]`);
                if (gridItem) {
                    gridItem.querySelector('.img-tag-indicator')?.remove();
                    if (newTags.length > 0) {
                        const dot = document.createElement('div');
                        dot.className = 'img-tag-indicator';
                        dot.title = newTags.join(', ');
                        dot.textContent = newTags.length;
                        gridItem.appendChild(dot);
                    }
                }
            }
        });
        tagSection.appendChild(tagUI);
        dlg.querySelector('.img-lightbox-inner').appendChild(tagSection);
    }
    dlg.addEventListener('close', () => dlg.remove());
    document.body.appendChild(dlg);
    dlg.showModal();
}

let imageTagFilter = new Set(); // タグフィルター状態（セッション中に保持）
let showUntaggedOnly = false;   // タグなし画像のみ表示フィルター（imageTagFilter と排他）

async function renderLocalImageManager() {
    const list = document.getElementById('localImageList');
    if (!list) return;

    // Check keys first to avoid unnecessary loading state
    const keys = await localImageDB.getAllKeys();
    if (keys.length === 0) {
        list.innerHTML = '<p style="grid-column: 1/-1; color:#888;">画像がありません</p>';
        return;
    }

    // Simple clear & loading
    list.innerHTML = '<p style="grid-column: 1/-1;">読み込み中...</p>';

    // Get all keys (lighter than getting all blobs)
    // To show thumbnails, we actually need blobs. 
    // If there are many, we should implement pagination.
    // For now, let's limit to recent 50 or just show all if < 100.
    // Let's grab all data for now (assuming users won't upload 1000s immediately).

    const allImages = await localImageDB.getAllImages();
    list.innerHTML = '';

    if (allImages.length === 0) {
        // Should be covered by keys check, but safety net
        list.innerHTML = '<p style="grid-column: 1/-1; color:#888;">画像がありません</p>';
        return;
    }

    // Sort by saved order
    const idToImage = new Map(allImages.map(item => [item.id, item]));
    const orderedIds = getOrderedImageKeys(allImages.map(item => item.id));
    const sortedImages = orderedIds.map(id => idToImage.get(id)).filter(Boolean);

    // --- Filter bar ---
    const allTagsSet = new Set();
    sortedImages.forEach(item => getImageTags(item.id).forEach(t => allTagsSet.add(t)));

    // Remove stale filter tags (image deleted etc.)
    [...imageTagFilter].forEach(t => { if (!allTagsSet.has(t)) imageTagFilter.delete(t); });

    const untaggedCount = sortedImages.filter(item => getImageTags(item.id).length === 0).length;

    // showUntaggedOnly をリセット（タグなし画像が0件になった場合）
    if (untaggedCount === 0) showUntaggedOnly = false;

    const filterContainer = list.parentElement.querySelector('.img-filter-bar');
    if (filterContainer) filterContainer.remove();

    if (allTagsSet.size > 0) {
        const filterBar = document.createElement('div');
        filterBar.className = 'img-filter-bar';

        const allChip = document.createElement('button');
        allChip.className = 'img-filter-chip' + (!showUntaggedOnly && imageTagFilter.size === 0 ? ' active' : '');
        allChip.textContent = 'すべて';
        allChip.type = 'button';
        allChip.onclick = () => { imageTagFilter.clear(); showUntaggedOnly = false; renderLocalImageManager(); };
        filterBar.appendChild(allChip);

        [...allTagsSet].sort().forEach(tag => {
            const chip = document.createElement('button');
            chip.className = 'img-filter-chip' + (imageTagFilter.has(tag) ? ' active' : '');
            chip.textContent = tag;
            chip.type = 'button';
            chip.onclick = () => {
                showUntaggedOnly = false;
                if (imageTagFilter.has(tag)) imageTagFilter.delete(tag);
                else imageTagFilter.add(tag);
                renderLocalImageManager();
            };
            filterBar.appendChild(chip);
        });

        // 「タグなし」チップ：タグなし画像が存在する場合のみ表示
        if (untaggedCount > 0) {
            const untaggedChip = document.createElement('button');
            untaggedChip.className = 'img-filter-chip img-filter-chip--untagged' + (showUntaggedOnly ? ' active' : '');
            untaggedChip.textContent = `タグなし (${untaggedCount})`;
            untaggedChip.type = 'button';
            untaggedChip.title = 'タグが設定されていない画像のみ表示';
            untaggedChip.onclick = () => {
                showUntaggedOnly = !showUntaggedOnly;
                imageTagFilter.clear();
                renderLocalImageManager();
            };
            filterBar.appendChild(untaggedChip);
        }

        list.insertAdjacentElement('beforebegin', filterBar);
    }

    // Filter images
    let displayImages;
    if (showUntaggedOnly) {
        displayImages = sortedImages.filter(item => getImageTags(item.id).length === 0);
    } else if (imageTagFilter.size === 0) {
        displayImages = sortedImages;
    } else {
        displayImages = sortedImages.filter(item =>
            [...imageTagFilter].some(t => getImageTags(item.id).includes(t))
        );
    }

    const fragment = document.createDocumentFragment();

    displayImages.forEach(item => {
        const div = document.createElement('div');
        div.className = 'local-image-item';
        div.dataset.imgId = item.id;

        const img = document.createElement('img');
        img.src = URL.createObjectURL(item.file);
        img.alt = item.file.name || '';
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', () => openImageLightbox(img.src, async () => {
            await localImageDB.deleteImage(item.id);
            appSettings.localImageOrder = (appSettings.localImageOrder || []).filter(id => id !== item.id);
            if (appSettings.localImageMeta) delete appSettings.localImageMeta[item.id];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
            URL.revokeObjectURL(img.src);
            div.remove();
            const list = document.getElementById('localImageList');
            if (list && list.children.length === 0) {
                list.innerHTML = '<p style="grid-column: 1/-1; color:#888;">画像がありません</p>';
            }
            await updateLocalImageCount();
            updateStorageIndicator();
        }, item.id));

        const handle = document.createElement('div');
        handle.className = 'img-drag-handle';
        handle.title = '並び替え';
        handle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="2"/><circle cx="15" cy="5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="19" r="2"/><circle cx="15" cy="19" r="2"/></svg>`;
        handle.addEventListener('mousedown', () => { div.draggable = true; });

        const btnDel = document.createElement('button');
        btnDel.type = 'button';
        btnDel.className = 'btn-img-delete';
        btnDel.title = '削除';
        btnDel.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;

        btnDel.onclick = async (e) => {
            // Check if overlay already exists
            if (div.querySelector('.delete-confirm-overlay')) return;

            // Add Visual State
            div.classList.add('is-deleting');

            // Create Overlay
            const overlay = document.createElement('div');
            overlay.className = 'delete-confirm-overlay';

            overlay.innerHTML = `
                <div class="delete-confirm-text">削除?</div>
                <div class="delete-confirm-actions">
                    <button class="btn-confirm-delete" type="button">はい</button>
                    <button class="btn-cancel-delete" type="button">いいえ</button>
                </div>
            `;

            // stopPropagation to prevent other clicks if any
            overlay.addEventListener('click', (ev) => ev.stopPropagation());

            // Handle Yes
            const btnYes = overlay.querySelector('.btn-confirm-delete');
            btnYes.addEventListener('click', async (ev) => {
                ev.stopPropagation(); // Prevent bubbling
                await localImageDB.deleteImage(item.id);
                appSettings.localImageOrder = (appSettings.localImageOrder || []).filter(id => id !== item.id);
                if (appSettings.localImageMeta) delete appSettings.localImageMeta[item.id];
                localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
                URL.revokeObjectURL(img.src);
                renderLocalImageManager();
                updateLocalMediaUI();
                updateStorageIndicator();
            });

            // Handle No
            const btnNo = overlay.querySelector('.btn-cancel-delete');
            btnNo.addEventListener('click', (ev) => {
                ev.stopPropagation();
                div.removeChild(overlay);
                div.classList.remove('is-deleting');
            });

            div.appendChild(overlay);
        };

        div.appendChild(img);
        div.appendChild(handle);
        div.appendChild(btnDel);
        const imageTags = getImageTags(item.id);
        if (imageTags.length > 0) {
            const dot = document.createElement('div');
            dot.className = 'img-tag-indicator';
            dot.title = imageTags.join(', ');
            dot.textContent = imageTags.length;
            div.appendChild(dot);
        }
        fragment.appendChild(div);
    });

    list.appendChild(fragment);
    if (!list.dataset.dndReady) {
        list.dataset.dndReady = '1';
        setupImageGridDnD(list);
    }
}


// --- Backup & Restore ---

async function handleExportFullBackup() {
    showToast('バックアップを作成中...');
    const dbKeys = await localImageDB.getAllKeys();
    const orderedKeys = getOrderedImageKeys(dbKeys);
    const date = new Date().toISOString().slice(0, 10);

    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const compressed = readable.pipeThrough(new CompressionStream('gzip'));
    const writer = writable.getWriter();
    const blobPromise = new Response(compressed).blob();

    const header = JSON.stringify({
        version: 3, type: 'full_backup',
        timestamp: new Date().toISOString(),
        settings: appSettings
    });
    await writer.write(encoder.encode(header.slice(0, -1) + ',"images":['));
    for (let i = 0; i < orderedKeys.length; i++) {
        const file = await localImageDB.getImage(orderedKeys[i]);
        const base64 = await blobToBase64(file);
        const entry = JSON.stringify({
            id: orderedKeys[i], name: file.name,
            type: file.type, lastModified: file.lastModified, data: base64
        });
        await writer.write(encoder.encode((i > 0 ? ',' : '') + entry));
    }
    await writer.write(encoder.encode(']}'));
    await writer.close();

    const blob = await blobPromise;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `oshikoyo_backup_${date}.json.gz`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    showToast('バックアップを保存しました');
}

async function handleImportFullBackup(file) {
    if (!confirm('現在のすべてのデータ（画像・設定・タグ）を削除し、バックアップから復元します。続けますか？')) return;
    try {
        const decompressed = file.stream().pipeThrough(new DecompressionStream('gzip'));
        const json = JSON.parse(await new Response(decompressed).text());

        if (json.type !== 'full_backup' || json.version !== 3) {
            alert('全データバックアップ用のファイルではありません。');
            return;
        }

        await localImageDB.clearAll();

        const filesToRestore = (json.images || []).map(item => ({
            id: item.id,
            file: new File([base64ToBlob(item.data, item.type)], item.name || 'image', {
                type: item.type, lastModified: item.lastModified || Date.now()
            })
        }));
        await localImageDB.restoreImages(filesToRestore);

        appSettings = { ...DEFAULT_SETTINGS, ...json.settings };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));

        alert('復元が完了しました。画面を更新します。');
        location.reload();
    } catch (e) {
        console.error(e);
        alert('復元に失敗しました: ' + e.message);
    }
}

async function handleExportImageTagPackage() {
    const dbKeys = await localImageDB.getAllKeys();
    if (dbKeys.length === 0) { showToast('書き出す画像がありません'); return; }
    showToast('画像を書き出し中...');
    const orderedKeys = getOrderedImageKeys(dbKeys);
    const date = new Date().toISOString().slice(0, 10);

    const allTagStrings = new Set();
    for (const key of orderedKeys) {
        (appSettings.localImageMeta?.[key]?.tags ?? []).forEach(t => allTagStrings.add(t));
    }
    const tagMap = {};
    [...allTagStrings].forEach((label, i) => { tagMap[`t${i}`] = label; });
    const labelToId = Object.fromEntries(Object.entries(tagMap).map(([k, v]) => [v, k]));

    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const compressed = readable.pipeThrough(new CompressionStream('gzip'));
    const writer = writable.getWriter();
    const blobPromise = new Response(compressed).blob();

    const header = JSON.stringify({
        version: 1, type: 'image_tag_package',
        timestamp: new Date().toISOString(), tagMap
    });
    await writer.write(encoder.encode(header.slice(0, -1) + ',"images":['));
    for (let i = 0; i < orderedKeys.length; i++) {
        const key = orderedKeys[i];
        const file = await localImageDB.getImage(key);
        const base64 = await blobToBase64(file);
        const tags = (appSettings.localImageMeta?.[key]?.tags ?? []).map(t => labelToId[t]).filter(Boolean);
        const entry = JSON.stringify({
            name: file.name, type: file.type,
            lastModified: file.lastModified, data: base64, tags
        });
        await writer.write(encoder.encode((i > 0 ? ',' : '') + entry));
    }
    await writer.write(encoder.encode(']}'));
    await writer.close();

    const blob = await blobPromise;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `oshikoyo_images_${date}.json.gz`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    showToast('書き出しました');
}

async function handleImportImageTagPackage(file) {
    try {
        const decompressed = file.stream().pipeThrough(new DecompressionStream('gzip'));
        const json = JSON.parse(await new Response(decompressed).text());

        if (json.type !== 'image_tag_package') {
            alert('画像＋タグパッケージ用のファイルではありません。');
            return;
        }

        const tagMap = json.tagMap ?? {};
        const existingImages = await localImageDB.getAllImages();
        const sigMap = buildBlobSignatureMap(existingImages);

        let added = 0, skipped = 0;
        const filesToAdd = [];
        const pendingTags = [];

        for (const item of (json.images ?? [])) {
            const blob = base64ToBlob(item.data, item.type);
            if (await isDuplicateBlob(blob, sigMap)) { skipped++; continue; }
            filesToAdd.push(new File([blob], item.name || 'image', {
                type: item.type, lastModified: item.lastModified || Date.now()
            }));
            pendingTags.push((item.tags ?? []).map(id => tagMap[id]).filter(Boolean));
            added++;
        }

        if (filesToAdd.length > 0) {
            const newKeys = await localImageDB.addImages(filesToAdd);
            if (!appSettings.localImageMeta) appSettings.localImageMeta = {};
            newKeys.forEach((key, i) => {
                if (pendingTags[i].length > 0) appSettings.localImageMeta[key] = { tags: pendingTags[i] };
            });
            const masterTags = appSettings.tags ?? [];
            pendingTags.flat().forEach(t => { if (!masterTags.includes(t)) masterTags.push(t); });
            appSettings.tags = masterTags;
            appSettings.localImageOrder = [...(appSettings.localImageOrder ?? []), ...newKeys];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
        }

        alert(`取り込み完了: 追加 ${added} 件 / スキップ ${skipped} 件`);
        if (added > 0) { updateLocalMediaUI(); renderLocalImageManager(); }
    } catch (e) {
        console.error(e);
        alert('取り込みに失敗しました: ' + e.message);
    }
}

// Helper: Validate Imported Settings
function validateImportedSettings(data) {
    if (!data || typeof data !== 'object') return null;

    const validated = {};

    // Root properties
    if (typeof data.startOfWeek === 'number') validated.startOfWeek = data.startOfWeek;
    if (typeof data.monthCount === 'number') validated.monthCount = data.monthCount;
    if (typeof data.layoutDirection === 'string') validated.layoutDirection = data.layoutDirection;
    if (typeof data.mediaMode === 'string') validated.mediaMode = data.mediaMode;
    if (typeof data.mediaPosition === 'string') validated.mediaPosition = data.mediaPosition;
    if (typeof data.mediaSize === 'number' || data.mediaSize === null) validated.mediaSize = data.mediaSize;
    if (typeof data.mediaIntervalPreset === 'string') validated.mediaIntervalPreset = data.mediaIntervalPreset;
    if (typeof data.layoutMode === 'string') validated.layoutMode = data.layoutMode;
    if (typeof data.immersiveMode === 'boolean') validated.immersiveMode = data.immersiveMode;

    // Validate oshiList
    if (Array.isArray(data.oshiList)) {
        validated.oshiList = data.oshiList.map(item => {
            if (!item || typeof item !== 'object') return null;
            // memorial_dates の検証
            let memorial_dates = [];
            if (Array.isArray(item.memorial_dates)) {
                memorial_dates = item.memorial_dates
                    .filter(md => md && typeof md.type_id === 'string' && typeof md.date === 'string')
                    .map(md => ({
                        type_id: md.type_id,
                        date: md.date,
                        is_annual: typeof md.is_annual === 'boolean' ? md.is_annual : true
                    }));
            } else {
                // 旧形式からの変換
                if (typeof item.birthday === 'string' && item.birthday)
                    memorial_dates.push({ type_id: 'bday', date: item.birthday, is_annual: true });
                if (typeof item.debutDate === 'string' && item.debutDate)
                    memorial_dates.push({ type_id: 'debut', date: item.debutDate, is_annual: true });
            }
            return {
                name: typeof item.name === 'string' ? item.name : 'Unknown',
                color: typeof item.color === 'string' ? item.color : '#3b82f6',
                memorial_dates,
                tags: Array.isArray(item.tags) ? item.tags.filter(t => typeof t === 'string') : [],
            };
        }).filter(item => item !== null);
    } else {
        return null; // Reject if oshiList is missing or not an array
    }

    // Validate event_types
    if (Array.isArray(data.event_types)) {
        validated.event_types = data.event_types
            .filter(t => t && typeof t.id === 'string' && typeof t.label === 'string')
            .map(t => ({ id: t.id, label: t.label, icon: typeof t.icon === 'string' ? t.icon : 'star' }));
    }

    return validated;
}
// --- Validation Logic End ---


// --- Image Grid Drag & Drop Reorder ---
function setupImageGridDnD(list) {
    list.addEventListener('dragstart', (e) => {
        const item = e.target.closest('.local-image-item');
        if (!item) return;
        const items = [...list.querySelectorAll('.local-image-item')];
        _imgDragSrcIndex = items.indexOf(item);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => item.classList.add('is-img-dragging'), 0);
    });

    list.addEventListener('dragend', (e) => {
        const item = e.target.closest('.local-image-item');
        if (item) {
            item.draggable = false;
            item.classList.remove('is-img-dragging');
        }
        list.querySelectorAll('.drag-over-left, .drag-over-right')
            .forEach(el => el.classList.remove('drag-over-left', 'drag-over-right'));
        _imgDragSrcIndex = -1;
    });

    list.addEventListener('dragover', (e) => {
        e.preventDefault();
        const item = e.target.closest('.local-image-item');
        if (!item) return;
        const items = [...list.querySelectorAll('.local-image-item')];
        const idx = items.indexOf(item);
        if (idx === _imgDragSrcIndex) return;
        list.querySelectorAll('.drag-over-left, .drag-over-right')
            .forEach(el => el.classList.remove('drag-over-left', 'drag-over-right'));
        const rect = item.getBoundingClientRect();
        const insertBefore = e.clientX < rect.left + rect.width / 2;
        item.classList.add(insertBefore ? 'drag-over-left' : 'drag-over-right');
    });

    list.addEventListener('dragleave', (e) => {
        if (!list.contains(e.relatedTarget)) {
            list.querySelectorAll('.drag-over-left, .drag-over-right')
                .forEach(el => el.classList.remove('drag-over-left', 'drag-over-right'));
        }
    });

    list.addEventListener('drop', (e) => {
        e.preventDefault();
        const item = e.target.closest('.local-image-item');
        if (!item || _imgDragSrcIndex < 0) return;
        const items = [...list.querySelectorAll('.local-image-item')];
        const tgtIdx = items.indexOf(item);
        if (tgtIdx === _imgDragSrcIndex) return;

        const rect = item.getBoundingClientRect();
        const insertBefore = e.clientX < rect.left + rect.width / 2;

        // IDベースで並び替え：フィルター中でも全体順序を正しく操作できる
        const srcId = Number(items[_imgDragSrcIndex].dataset.imgId);
        const tgtId = Number(items[tgtIdx].dataset.imgId);

        const order = [...(appSettings.localImageOrder.length > 0
            ? appSettings.localImageOrder
            : items.map(el => Number(el.dataset.imgId)))];

        const srcPos = order.indexOf(srcId);
        if (srcPos === -1) return;
        order.splice(srcPos, 1);

        const tgtPos = order.indexOf(tgtId);
        if (tgtPos === -1) return;
        order.splice(insertBefore ? tgtPos : tgtPos + 1, 0, srcId);

        appSettings.localImageOrder = order;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
        renderLocalImageManager();
    });
}

// --- Drag & Drop / Paste Logic ---
function setupDragAndDrop() {
    const container = document.getElementById('mediaContainer');
    if (!container) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        container.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Visual indicators
    ['dragenter', 'dragover'].forEach(eventName => {
        container.addEventListener(eventName, () => container.classList.add('drag-active'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        container.addEventListener(eventName, () => container.classList.remove('drag-active'), false);
    });

    // Handle Drop
    // Detect Internal Drag
    container.addEventListener('dragstart', (e) => {
        if (e.target.tagName === 'IMG') {
            e.dataTransfer.setData('application/x-oshigoto-internal', 'true');
        }
    });

    container.addEventListener('drop', handleDrop, false);

    async function handleDrop(e) {
        // Ignore internal drops
        if (e.dataTransfer.getData('application/x-oshigoto-internal') === 'true') {
            return;
        }

        const dt = e.dataTransfer;
        const files = dt.files;
        await handleFiles(files);
    }

    // --- Layout Drag & Drop ---
    const dragHandle = document.getElementById('mediaDragHandle');
    const mainLayout = document.getElementById('mainLayout');
    const dropzones = document.querySelectorAll('.layout-dropzone');

    if (dragHandle && mainLayout) {
        // ドラッグ開始
        dragHandle.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('application/x-oshigoto-layout', 'true');
            // 少し遅らせてクラスを付与（即座だとドラッグイメージも半透明になる場合があるため）
            setTimeout(() => {
                mainLayout.classList.add('is-dragging-layout');
            }, 10);
        });

        // ドラッグ終了
        dragHandle.addEventListener('dragend', () => {
            mainLayout.classList.remove('is-dragging-layout');
            dropzones.forEach(zone => zone.classList.remove('drag-over'));
        });

        // ドロップゾーンのイベント
        dropzones.forEach(zone => {
            zone.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if (e.dataTransfer.types.includes('application/x-oshigoto-layout')) {
                    zone.classList.add('drag-over');
                }
            });

            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            zone.addEventListener('dragleave', () => {
                zone.classList.remove('drag-over');
            });

            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('drag-over');

                if (e.dataTransfer.types.includes('application/x-oshigoto-layout')) {
                    const newPos = zone.getAttribute('data-position');
                    if (newPos && ['top', 'bottom', 'left', 'right'].includes(newPos)) {
                        appSettings.mediaPosition = newPos;

                        // 位置が変わったらサイズ制約をリセットする
                        appSettings.mediaSize = null;

                        // 設定モーダルの内容を上書きしないよう直接保存とUI更新のみ行う
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
                        updateView();
                    }
                }
            });
        });
    }

    // --- Splitter Resizing ---
    const splitter = document.getElementById('layoutSplitter');
    const mediaArea = document.getElementById('mediaArea');
    if (splitter && mediaArea && mainLayout) {
        let isResizing = false;
        let startPos = 0;
        let startSize = 0;
        let direction = ''; // 'horizontal' (x-axis) or 'vertical' (y-axis)

        splitter.addEventListener('mousedown', (e) => {
            isResizing = true;
            mainLayout.classList.add('is-resizing');
            splitter.classList.add('is-resizing');

            const pos = appSettings.mediaPosition || 'right';
            if (pos === 'left' || pos === 'right') {
                direction = 'horizontal';
                startPos = e.clientX;
                startSize = mediaArea.offsetWidth;
            } else {
                direction = 'vertical';
                startPos = e.clientY;
                startSize = mediaArea.offsetHeight;
            }
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            let newSize = startSize;
            const pos = appSettings.mediaPosition || 'right';

            if (direction === 'horizontal') {
                const deltaX = e.clientX - startPos;
                // 'left' layout: image is on left, drag right (positive deltaX) increases width
                // 'right' layout: image is on right, drag left (negative deltaX) increases width
                newSize = pos === 'left' ? startSize + deltaX : startSize - deltaX;
            } else {
                const deltaY = e.clientY - startPos;
                // 'top' layout: image is top, drag down (positive deltaY) increases height
                // 'bottom' layout: image is bottom, drag up (negative deltaY) increases height
                newSize = pos === 'top' ? startSize + deltaY : startSize - deltaY;
            }

            // Constrain constraints
            const minSize = 250;
            const maxSize = direction === 'horizontal' ? window.innerWidth * 0.8 : window.innerHeight * 0.8;
            newSize = Math.max(minSize, Math.min(newSize, maxSize));

            if (direction === 'horizontal') {
                mediaArea.style.width = `${newSize}px`;
                mediaArea.style.maxWidth = `${newSize}px`;
            } else {
                const mediaContainer = document.getElementById('mediaContainer');
                if (mediaContainer) mediaContainer.style.height = `${newSize}px`;
            }

            appSettings.mediaSize = newSize;
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                mainLayout.classList.remove('is-resizing');
                splitter.classList.remove('is-resizing');

                if (appSettings.mediaSize) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
                }
            }
        });
    }
}

// --- Image Compression ---

/**
 * Canvas API を使って画像をリサイズ・JPEG変換する。
 * GIF はアニメーション保護のためそのまま返す。
 * @param {File} file 元ファイル
 * @param {number} maxDimension 長辺の最大px
 * @param {number} quality JPEG品質 (0-1)
 * @returns {Promise<File>} 圧縮後の File オブジェクト
 */
async function compressImageFile(file, maxDimension, quality) {
    if (file.type === 'image/gif') return file;

    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            const { naturalWidth: w, naturalHeight: h } = img;
            const longestSide = Math.max(w, h);
            const scale = longestSide > maxDimension ? maxDimension / longestSide : 1;
            const targetW = Math.round(w * scale);
            const targetH = Math.round(h * scale);

            const canvas = document.createElement('canvas');
            canvas.width  = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; // 透過PNG → 白背景合成
            ctx.fillRect(0, 0, targetW, targetH);
            ctx.drawImage(img, 0, 0, targetW, targetH);

            canvas.toBlob(blob => {
                if (!blob) { reject(new Error('canvas.toBlob が null を返しました')); return; }
                const newName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
                resolve(new File([blob], newName, { type: 'image/jpeg', lastModified: file.lastModified }));
            }, 'image/jpeg', quality);
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error(`画像の読み込みに失敗しました: ${file.name}`));
        };

        img.src = objectUrl;
    });
}

/**
 * appSettings.imageCompressMode に基づき画像リストを圧縮する。
 * @param {File[]} files
 * @returns {Promise<File[]>}
 */
async function applyImageCompression(files) {
    const mode = appSettings.imageCompressMode;
    if (mode === 'off' || !mode) return files;

    const params = mode === 'aggressive'
        ? { maxDimension: 1920, quality: 0.78 }
        : { maxDimension: 2560, quality: 0.88 }; // 'standard'

    return Promise.all(
        files.map(f => compressImageFile(f, params.maxDimension, params.quality).catch(() => f))
    );
}

/**
 * 登録済み全画像を現在の imageCompressMode 設定で一括圧縮・上書き保存する。
 * 圧縮設定が 'off' の場合は何もしない。
 * @returns {Promise<{compressed: number, skipped: number}>}
 */
async function compressAllExistingImages() {
    const mode = appSettings.imageCompressMode;
    if (mode === 'off') return { compressed: 0, skipped: 0 };

    const params = mode === 'aggressive'
        ? { maxDimension: 1920, quality: 0.78 }
        : { maxDimension: 2560, quality: 0.88 };

    const images = await localImageDB.getAllImages();
    let compressed = 0, skipped = 0;

    for (const { id, file } of images) {
        try {
            const result = await compressImageFile(file, params.maxDimension, params.quality);
            if (result !== file) {
                await localImageDB.updateImage(id, result);
                compressed++;
            } else {
                skipped++;
            }
        } catch {
            skipped++;
        }
    }
    return { compressed, skipped };
}

// --- Preview Logic ---
let pendingPreviewFiles = [];
let hasNewLocalImages = false;

async function handleFiles(files) {
    if (!files || files.length === 0) return;

    // Store files and show preview instead of immediate save
    pendingPreviewFiles = Array.from(files).filter(f => f.type.startsWith('image/'));

    if (pendingPreviewFiles.length > 0) {
        renderPreview();
        updateTagDatalist();
        const tagArea = document.getElementById('previewTagInputArea');
        if (tagArea) {
            const tagUI = createTagInputUI([], () => {});
            tagUI.id = 'previewTagInputArea';
            tagArea.replaceWith(tagUI);
        }
        document.getElementById('previewModal').showModal();
    }
}

function renderPreview() {
    const grid = document.getElementById('previewGrid');
    if (!grid) return;
    grid.innerHTML = '';

    pendingPreviewFiles.forEach(file => {
        const item = document.createElement('div');
        item.className = 'preview-item';
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        // clean up object url later? for preview it's short lived
        item.appendChild(img);
        grid.appendChild(item);
    });
}

function setupPreviewModal() {
    // Add Confirm Add Button
    document.getElementById('btnAddPreview').addEventListener('click', async () => {
        // Collect common tags before closing (DOM is still accessible)
        const tagBadges = [...document.querySelectorAll('#previewTagInputArea .tag-badge')];
        const commonTags = tagBadges.map(b => b.childNodes[0].textContent.trim()).filter(Boolean);
        if (commonTags.length) addTagsToMaster(commonTags);

        const modal = document.getElementById('previewModal');
        modal.close(); // Close first

        // Actually save（登録前に圧縮を適用）
        const filesToSave = await applyImageCompression(pendingPreviewFiles);
        const results = await localImageDB.addImages(filesToSave);
        const count = results.length;
        const lastKey = results[results.length - 1];

        if (count > 0) {
            appSettings.localImageOrder = [...(appSettings.localImageOrder || []), ...results];
            if (commonTags.length) {
                results.forEach(id => setImageTags(id, [...commonTags]));
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
            hasNewLocalImages = true;
            updateLocalMediaUI();
            updateStorageIndicator();

            if (document.getElementById('settingsModal').open) {
                renderLocalImageManager();
            }

            showToast(`${count} 枚の画像を追加しました！`);

            if (lastKey) {
                appState.lastMediaKey = lastKey;
                saveState();
                updateMediaArea('restore');
            }
        }

        pendingPreviewFiles = []; // Clear
    });

    // Cancel Button
    document.getElementById('btnCancelPreview').addEventListener('click', () => {
        pendingPreviewFiles = [];
        document.getElementById('previewModal').close();
    });
}





let controlsTimer = null;
function applyImmersiveState() {
    const calendarSection = document.querySelector('.calendar-section');
    if (appSettings.immersiveMode) {
        document.documentElement.classList.add('is-immersive');
        document.body.classList.add('is-immersive');

        // Auto-hide controls
        document.body.classList.add('controls-visible');
        setupImmersiveControlsTimer();

        document.addEventListener('mousemove', handleImmersiveMouseMove);

        // Create dismiss zone if not exists
        if (!document.querySelector('.overlay-dismiss-zone')) {
            const dismissZone = document.createElement('div');
            dismissZone.className = 'overlay-dismiss-zone';
            dismissZone.addEventListener('click', () => {
                document.body.classList.remove('show-overlay');
            });
            document.body.appendChild(dismissZone);
        }

    } else {
        document.documentElement.classList.remove('is-immersive');
        document.body.classList.remove('is-immersive');
        document.body.classList.remove('show-overlay');
        document.body.classList.remove('controls-visible');
        document.removeEventListener('mousemove', handleImmersiveMouseMove);
        if (controlsTimer) clearTimeout(controlsTimer);

        // Reset calendar section styles
        if (calendarSection) {
            calendarSection.style.top = '';
            calendarSection.style.bottom = '';
            calendarSection.style.left = '';
            calendarSection.style.right = '';
            calendarSection.style.transform = '';
        }
    }

    // Save original direction for full overlay restoring
    const calendarWrapper = document.getElementById('calendarWrapper');
    if (calendarWrapper) {
        calendarWrapper.style.setProperty('--original-direction', appSettings.layoutDirection);
    }
}

function setupImmersiveControlsTimer() {
    if (controlsTimer) clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => {
        if (!document.body.classList.contains('show-overlay') && !document.querySelector('.quick-media-controls:hover')) {
            document.body.classList.remove('controls-visible');
        }
    }, 3000);
}

function handleImmersiveMouseMove() {
    document.body.classList.add('controls-visible');
    setupImmersiveControlsTimer();
}

function initSettings() {
    // Open Modal
    document.getElementById('btnSettings').addEventListener('click', () => {
        // Basic
        const radiosStart = document.querySelectorAll('input[name="startOfWeek"]');
        radiosStart.forEach(r => { if (parseInt(r.value) === appSettings.startOfWeek) r.checked = true; });

        // Memorial Display Mode
        const radiosMemorial = document.querySelectorAll('input[name="memorialDisplayMode"]');
        radiosMemorial.forEach(r => { r.checked = r.value === (appSettings.memorialDisplayMode || 'preferred'); });

        // Auto Layout
        const checkAutoLayout = document.getElementById('checkAutoLayout');
        if (checkAutoLayout) checkAutoLayout.checked = !!appSettings.autoLayoutMode;

        // Media Button State Update
        updateQuickMediaButtons();
        updateLayoutMenuUI();

        // Interval Settings (Sync Custom UI)
        updateQuickMediaButtons();

        // Initialize Local UI visibility
        updateLocalMediaUI();

        // 画像タブが現在アクティブな場合、または新規追加があった場合に一覧を再描画
        const activePanel = document.querySelector('.settings-tab-panel.is-active');
        if (hasNewLocalImages || (activePanel && activePanel.dataset.panel === 'media')) {
            renderLocalImageManager();
            hasNewLocalImages = false;
        }

        // Render Oshi List
        renderOshiList();

        document.getElementById('settingsModal').showModal();
    });

    // Settings tab switching
    document.querySelectorAll('.settings-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('is-active'));
            document.querySelectorAll('.settings-tab-panel').forEach(p => p.classList.remove('is-active'));
            btn.classList.add('is-active');
            document.querySelector(`.settings-tab-panel[data-panel="${btn.dataset.tab}"]`).classList.add('is-active');
            if (btn.dataset.tab === 'media') {
                renderLocalImageManager();
                updateStorageIndicator();
                document.querySelectorAll('input[name="imageCompressMode"]').forEach(r => {
                    r.checked = (r.value === (appSettings.imageCompressMode || 'standard'));
                });
            }
        });
    });

    // Close Modal
    document.getElementById('btnClose').addEventListener('click', () => {
        document.getElementById('settingsModal').close();
    });

    // 全般タブ: 各コントロールの変更を即時保存・適用
    document.querySelectorAll('input[name="startOfWeek"]').forEach(r => {
        r.addEventListener('change', saveSettings);
    });
    document.querySelectorAll('input[name="memorialDisplayMode"]').forEach(r => {
        r.addEventListener('change', saveSettings);
    });
    const checkAutoLayout = document.getElementById('checkAutoLayout');
    if (checkAutoLayout) checkAutoLayout.addEventListener('change', saveSettings);

    // Reset Layout
    document.getElementById('btnResetLayout').addEventListener('click', resetLayoutToDefault);

    // --- Oshi Management Modal ---
    document.getElementById('btnOpenOshiManager').addEventListener('click', openOshiManager);
    document.getElementById('btnCloseOshiManager').addEventListener('click', () => {
        document.getElementById('oshiManagementModal').close();
    });

    // --- Oshi Management Toolbar ---
    document.getElementById('btnOshiAdd').addEventListener('click', () => openOshiEditForm(-1));
    document.getElementById('btnOshiExport').addEventListener('click', handleOshiExport);

    const inputOshiImport = document.getElementById('inputOshiImport');
    document.getElementById('btnOshiImport').addEventListener('click', () => inputOshiImport.click());
    document.getElementById('btnOshiCsvTemplate').addEventListener('click', downloadOshiCsvTemplate);
    inputOshiImport.addEventListener('change', (e) => {
        handleOshiImportFromModal(e.target.files);
        e.target.value = ''; // Reset for re-selection
    });

    // 空状態UIのボタン（同じ機能）
    document.getElementById('btnOshiAddEmpty').addEventListener('click', () => openOshiEditForm(-1));
    document.getElementById('btnOshiImportEmpty').addEventListener('click', () => inputOshiImport.click());
    document.getElementById('btnOshiCsvTemplateEmpty').addEventListener('click', downloadOshiCsvTemplate);

    // --- Oshi Edit Form ---
    document.getElementById('btnOshiEditSave').addEventListener('click', saveOshiFromForm);
    document.getElementById('btnOshiEditCancel').addEventListener('click', () => {
        document.getElementById('oshiEditModal').close();
    });
    document.getElementById('btnAddMemorialDate').addEventListener('click', () => addMemorialDateRow());

    // アイコンピッカーをクリック外で閉じる
    document.addEventListener('click', () => {
        document.querySelectorAll('.icon-picker-popup.is-open').forEach(p => p.classList.remove('is-open'));
    });

    // カラーチップ ↔ Hexテキスト ↔ ネイティブピッカー 同期
    const hexInput = document.getElementById('oshiEditColor');
    const colorPicker = document.getElementById('oshiColorPicker');
    const colorChip = document.getElementById('oshiColorChip');
    if (hexInput && colorPicker && colorChip) {
        // テキスト入力 → チップ・ピッカー更新
        hexInput.addEventListener('input', () => {
            const hex = normalizeHex(hexInput.value);
            if (hex) {
                colorChip.style.backgroundColor = hex;
                colorPicker.value = hex;
                hexInput.style.removeProperty('color');
            } else {
                hexInput.style.color = 'var(--danger, #ef4444)';
            }
        });
        // ピッカー選択 → テキスト・チップ更新
        colorPicker.addEventListener('input', () => {
            syncOshiColorUI(colorPicker.value);
        });
    }

    // --- New Media & Data Handlers ---

    // Local Import (Folder)
    const inputFolder = document.getElementById('inputLocalFolder');
    document.getElementById('btnLocalFolder').addEventListener('click', () => inputFolder.click());
    inputFolder.addEventListener('change', (e) => handleFiles(e.target.files));

    // Local Import (Files)
    const inputFiles = document.getElementById('inputLocalFiles');
    document.getElementById('btnLocalFiles').addEventListener('click', () => inputFiles.click());
    inputFiles.addEventListener('change', (e) => handleFiles(e.target.files));

    // Clipboard Paste Helper
    const handleClipboardPaste = async () => {
        try {
            if (!navigator.clipboard || !navigator.clipboard.read) {
                showToast('お使いのブラウザはクリップボードからの画像読み取りに対応していません。', 'warning');
                return;
            }
            const clipboardItems = await navigator.clipboard.read();
            let files = [];
            for (const item of clipboardItems) {
                const imageTypes = item.types.filter(type => type.startsWith('image/'));
                for (const type of imageTypes) {
                    const blob = await item.getType(type);
                    const file = new File([blob], `pasted-${Date.now()}.${type.split('/')[1] || 'png'}`, { type });
                    files.push(file);
                }
            }
            if (files.length > 0) {
                handleFiles(files); // Reuse preview logic
            } else {
                showToast('クリップボードに画像が見つかりませんでした。', 'warning');
            }
        } catch (err) {
            console.error('Failed to read clipboard:', err);
            showToast('クリップボードの読み取りに失敗しました。権限が許可されているか確認してください。', 'error');
        }
    };

    // Clipboard Paste (Settings)
    const btnClipboardPaste = document.getElementById('btnClipboardPaste');
    if (btnClipboardPaste) {
        btnClipboardPaste.addEventListener('click', handleClipboardPaste);
    }

    // Clipboard Paste (Global)
    const btnGlobalPaste = document.getElementById('btnGlobalPaste');
    if (btnGlobalPaste) {
        btnGlobalPaste.addEventListener('click', handleClipboardPaste);
    }

    // Global Paste Event Listener
    window.addEventListener('paste', (e) => {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            const items = (e.clipboardData || window.clipboardData).items;
            let files = [];
            for (let i = 0; i < items.length; i++) {
                if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
                    files.push(items[i].getAsFile());
                }
            }
            if (files.length > 0) {
                e.preventDefault();
                handleFiles(files);
            }
        }
    });

    // 圧縮設定ラジオ（change時に即時保存）
    document.querySelectorAll('input[name="imageCompressMode"]').forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.checked) {
                appSettings.imageCompressMode = radio.value;
                saveSettingsSilently();
            }
        });
    });

    // 既存画像を一括圧縮
    document.getElementById('btnCompressExisting').addEventListener('click', async () => {
        const mode = appSettings.imageCompressMode;
        if (mode === 'off') {
            showToast('圧縮設定を「標準」または「積極的」に切り替えてください');
            return;
        }
        const allKeys = await localImageDB.getAllKeys();
        if (allKeys.length === 0) {
            showToast('登録済みの画像がありません');
            return;
        }
        const modeLabel = mode === 'aggressive' ? '積極的（1920px）' : '標準（2560px）';
        if (!confirm(`登録済み ${allKeys.length} 枚の画像を${modeLabel}で圧縮します。この操作は元に戻せません。続けますか？`)) return;

        const btn = document.getElementById('btnCompressExisting');
        btn.disabled = true;
        btn.textContent = '圧縮中...';

        const { compressed, skipped } = await compressAllExistingImages();
        await updateStorageIndicator();
        renderLocalImageManager();
        btn.disabled = false;
        btn.textContent = '登録済みを一括圧縮';
        showToast(`${compressed} 枚を圧縮しました（${skipped} 枚スキップ）`);
    });

    // Clear Local
    document.getElementById('btnClearLocal').addEventListener('click', async () => {
        if (confirm('登録済みの画像をすべて削除します。よろしいですか？')) {
            await localImageDB.clearAll();
            appSettings.localImageOrder = [];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
            updateLocalMediaUI();
            updateStorageIndicator();
            renderLocalImageManager();
        }
    });

    // Full backup
    document.getElementById('btnExportFullBackup').addEventListener('click', handleExportFullBackup);
    const inputFullBackup = document.getElementById('inputFullBackup');
    document.getElementById('btnImportFullBackup').addEventListener('click', () => inputFullBackup.click());
    inputFullBackup.addEventListener('change', (e) => {
        if (e.target.files[0]) { handleImportFullBackup(e.target.files[0]); e.target.value = ''; }
    });

    // Image + Tag package
    document.getElementById('btnExportImageTag').addEventListener('click', handleExportImageTagPackage);
    const inputImageTag = document.getElementById('inputImageTag');
    document.getElementById('btnImportImageTag').addEventListener('click', () => inputImageTag.click());
    inputImageTag.addEventListener('change', (e) => {
        if (e.target.files[0]) { handleImportImageTagPackage(e.target.files[0]); e.target.value = ''; }
    });

    // (Legacy cleanup: mediaIntervalSelect listener removed)
}

function loadSettings() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // Validation: monthCount must be 1 or 2
            if (parsed.monthCount > 2) {
                parsed.monthCount = 2;
            }
            appSettings = { ...DEFAULT_SETTINGS, ...parsed };

            // Migration: Logic to move single oshi to list if list is empty but single exists
            if ((!appSettings.oshiList || appSettings.oshiList.length === 0) && appSettings.oshiName) {
                appSettings.oshiList = [{
                    name: appSettings.oshiName,
                    birthday: appSettings.oshiBirthday,
                    debutDate: appSettings.oshiDebutDay,
                    color: appSettings.oshiColor,
                }];
            }
            // Clear legacy properties explicitly as they are no longer in DEFAULT_SETTINGS
            delete appSettings.oshiName;
            delete appSettings.oshiBirthday;
            delete appSettings.oshiDebutDay;
            delete appSettings.oshiColor;

            // Migration: oshi の旧 birthday/debutDate を memorial_dates へ変換
            if (appSettings.oshiList) {
                appSettings.oshiList = appSettings.oshiList.map(oshi => {
                    if (oshi.birthday !== undefined || oshi.debutDate !== undefined) {
                        const memorial_dates = oshi.memorial_dates ? [...oshi.memorial_dates] : [];
                        if (oshi.birthday) memorial_dates.unshift({ type_id: 'bday',  date: oshi.birthday,  is_annual: true });
                        if (oshi.debutDate) memorial_dates.push({ type_id: 'debut', date: oshi.debutDate, is_annual: true });
                        const { birthday, debutDate, ...rest } = oshi;
                        return { ...rest, memorial_dates };
                    }
                    return oshi;
                });
            }
            // event_types がない（古いデータ）場合はデフォルトをマージ
            if (!appSettings.event_types || appSettings.event_types.length === 0) {
                appSettings.event_types = [...DEFAULT_SETTINGS.event_types];
            }

            // Fallback for removed 'none' mode
            if (appSettings.mediaMode === 'none') {
                appSettings.mediaMode = 'single';
            }

            // Migration: DHMS interval to preset
            if (!appSettings.mediaIntervalPreset && (appSettings.mediaIntervalRandom || appSettings.mediaIntervalCycle)) {
                const oldSec = appSettings.mediaIntervalRandom || appSettings.mediaIntervalCycle || 60;
                if (oldSec <= 10) appSettings.mediaIntervalPreset = '10s';
                else if (oldSec <= 30) appSettings.mediaIntervalPreset = '30s';
                else if (oldSec <= 60) appSettings.mediaIntervalPreset = '1m';
                else if (oldSec <= 600) appSettings.mediaIntervalPreset = '10m';
                else appSettings.mediaIntervalPreset = '1h';

                // Clean up old settings
                delete appSettings.mediaIntervalRandom;
                delete appSettings.mediaIntervalCycle;
            }

            // Migration: Initialize lastActiveInterval if it doesn't exist
            if (!appSettings.lastActiveInterval) {
                appSettings.lastActiveInterval = appSettings.mediaIntervalPreset || '1m';
            }

            // Migration: Initialize localImageOrder if missing
            if (!Array.isArray(appSettings.localImageOrder)) {
                appSettings.localImageOrder = [];
            }
            // Migration: Initialize tag-related fields if missing
            if (!Array.isArray(appSettings.tags)) {
                appSettings.tags = [];
            }
            if (!appSettings.localImageMeta || typeof appSettings.localImageMeta !== 'object' || Array.isArray(appSettings.localImageMeta)) {
                appSettings.localImageMeta = {};
            }
            appSettings.oshiList = (appSettings.oshiList || []).map(o =>
                ({ ...o, tags: Array.isArray(o.tags) ? o.tags : [] })
            );
            if (!appSettings.memorialDisplayMode) {
                appSettings.memorialDisplayMode = 'preferred';
            }
            if (!appSettings.imageCompressMode ||
                !['off', 'standard', 'aggressive'].includes(appSettings.imageCompressMode)) {
                appSettings.imageCompressMode = 'standard';
            }
        } catch (e) { }
    }
    // updateView(); // Removed to prevent double rendering on init
}

function showToast(message, duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    // Ensure toast container is on top of any open modals using Popover API
    if (container.showPopover) {
        try {
            // Re-stack: hide then show to bring to top of Top Layer
            if (container.matches(':popover-open')) {
                container.hidePopover();
            }
            container.showPopover();
        } catch (e) {
            // Fallback: popover API not supported or error
            console.warn('Popover API not fully supported:', e);
        }
    }

    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hiding');
        toast.addEventListener('animationend', () => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        });
    }, duration);
}

/**
 * レイアウト関連の設定（表示月数・レイアウト方向・画像位置・画像サイズ）を
 * デフォルト値にリセットし、UIに反映する。
 */
function resetLayoutToDefault() {
    appSettings.monthCount = DEFAULT_SETTINGS.monthCount;
    appSettings.layoutDirection = DEFAULT_SETTINGS.layoutDirection;
    appSettings.mediaPosition = DEFAULT_SETTINGS.mediaPosition;
    appSettings.mediaSize = null;

    // メディアエリアのインラインスタイルをクリア
    const mediaArea = document.getElementById('mediaArea');
    if (mediaArea) {
        mediaArea.style.width = '';
        mediaArea.style.maxWidth = '';
    }
    const mediaContainer = document.getElementById('mediaContainer');
    if (mediaContainer) {
        mediaContainer.style.height = '';
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
    updateToggleMonthsUI();
    updateLayoutToggleUI();
    updateView();
    showToast('配置をデフォルトに戻しました');
}

/**
 * 全般タブの設定を appSettings に反映して即時保存・適用する。
 * モーダルは閉じない（各コントロールの change イベントから呼ばれる）。
 */
function saveSettings() {
    // 週の始まり
    const startOfWeekEl = document.querySelector('input[name="startOfWeek"]:checked');
    if (startOfWeekEl) appSettings.startOfWeek = parseInt(startOfWeekEl.value);

    // 自動レイアウト
    const checkAutoLayout = document.getElementById('checkAutoLayout');
    if (checkAutoLayout) appSettings.autoLayoutMode = checkAutoLayout.checked;

    // 記念日表示モード
    const memorialModeEl = document.querySelector('input[name="memorialDisplayMode"]:checked');
    if (memorialModeEl) appSettings.memorialDisplayMode = memorialModeEl.value;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
    setupMediaTimer(true);
    updateToggleMonthsUI();
    updateView();
}

/**
 * Updates the active state of Quick Media Mode buttons based on current settings.
 */
function updateQuickMediaButtons() {
    // Legacy support (if any old buttons remain, though we replaced them)
    const mediaModeBtns = document.querySelectorAll('.media-mode-btn:not(.display-mode-btn)');
    mediaModeBtns.forEach(btn => {
        if (btn.getAttribute('data-mode') === appSettings.mediaMode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update unified Display Mode Button
    const displayBtn = document.querySelector('.display-mode-btn');
    if (displayBtn) {
        const iconRandom = displayBtn.querySelector('.icon-random');
        const iconCycle = displayBtn.querySelector('.icon-cycle');
        const iconSingle = displayBtn.querySelector('.icon-single');

        if (iconRandom) iconRandom.style.display = appSettings.mediaMode === 'random' ? 'block' : 'none';
        if (iconCycle) iconCycle.style.display = appSettings.mediaMode === 'cycle' ? 'block' : 'none';
        if (iconSingle) iconSingle.style.display = appSettings.mediaMode === 'single' ? 'block' : 'none';

        if (appSettings.mediaMode === 'random') {
            displayBtn.setAttribute('title', '表示モードの設定（現在はランダム中）');
            displayBtn.setAttribute('data-original-title', '表示モードの設定（現在はランダム中）');
        } else if (appSettings.mediaMode === 'cycle') {
            displayBtn.setAttribute('title', '表示モードの設定（現在はサイクル中）');
            displayBtn.setAttribute('data-original-title', '表示モードの設定（現在はサイクル中）');
        } else {
            displayBtn.setAttribute('title', '表示モードの設定（現在は固定中）');
            displayBtn.setAttribute('data-original-title', '表示モードの設定（現在は固定中）');
        }
    }

    updateIntervalMenu();
}

/**
 * Updates the active state of Interval dropdown items based on current settings and mode.
 */
function updateIntervalMenu() {
    const isFixed = appSettings.mediaMode === 'single';

    // Update Mode Items
    const modeItems = document.querySelectorAll('.mode-item');
    modeItems.forEach(item => {
        if (item.getAttribute('data-mode') === appSettings.mediaMode) {
            item.classList.add('is-active');
        } else {
            item.classList.remove('is-active');
        }
    });

    // Update Interval Section State
    const intervalSection = document.querySelector('.interval-section');
    if (intervalSection) {
        if (isFixed) {
            intervalSection.classList.add('disabled');
        } else {
            intervalSection.classList.remove('disabled');
        }
    }

    // Update Interval Items based on lastActiveInterval
    const intervalItems = document.querySelectorAll('.interval-item');
    const targetInterval = isFixed ? null : appSettings.lastActiveInterval;

    intervalItems.forEach(item => {
        if (targetInterval && item.getAttribute('data-value') === targetInterval) {
            item.classList.add('is-active');
        } else {
            item.classList.remove('is-active');
        }
    });
}

/**
 * Checks if the PWA was opened via Web Share Target and loads the shared image.
 */
async function checkSharedImage() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('shared') === 'true') {
        try {
            const cache = await caches.open('shared-image');
            const response = await cache.match('shared-image-file');
            if (response) {
                const blob = await response.blob();
                const file = new File([blob], `shared-${Date.now()}.${blob.type.split('/')[1] || 'png'}`, { type: blob.type });
                handleFiles([file]); // Pass to preview/import logic
                // Clean up
                await cache.delete('shared-image-file');
            }
            // Remove query param to prevent reload issues
            const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({ path: newUrl }, '', newUrl);
        } catch (error) {
            console.error('Failed to load shared image:', error);
            showToast('共有された画像の読み取りに失敗しました。', 'error');
        }
    }
}

function init() {
    loadSettings();
    loadState(); // Restore last state
    initSettings();
    checkSharedImage();
    setupDragAndDrop();
    setupPreviewModal();
    setupLayoutMenu();
    setupMiniCalendarInteractions();

    const dateDisplay = document.getElementById('currentDateDisplay');
    const resetToToday = () => {
        currentRefDate = new Date();
        updateView();
    };

    if (dateDisplay) {
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        dateDisplay.textContent = TODAY.toLocaleDateString('ja-JP', options);
        dateDisplay.addEventListener('click', resetToToday);
    }

    const btnTodayLogo = document.getElementById('btnTodayLogo');
    if (btnTodayLogo) {
        btnTodayLogo.addEventListener('click', resetToToday);
    }

    updateView();

    document.getElementById('btnPrev').addEventListener('click', () => {
        currentRefDate.setMonth(currentRefDate.getMonth() - 1);
        updateView();
    });

    document.getElementById('btnNext').addEventListener('click', () => {
        currentRefDate.setMonth(currentRefDate.getMonth() + 1);
        updateView();
    });

    // Unified Display Mode Control logic
    const displayModeBtn = document.querySelector('.display-mode-btn');
    const dropdown = document.querySelector('.interval-dropdown');

    // Move the dropdown to document.body to break out of overflow:hidden containers
    if (dropdown) {
        document.body.appendChild(dropdown);
    }

    if (displayModeBtn) {
        if (displayModeBtn.hasAttribute('title')) {
            displayModeBtn.setAttribute('data-original-title', displayModeBtn.getAttribute('title'));
        }

        displayModeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (dropdown) {
                const isOpen = dropdown.classList.contains('is-open');
                if (!isOpen) {
                    // Position the dropdown before showing it
                    const btnRect = e.currentTarget.getBoundingClientRect();
                    dropdown.style.top = `${btnRect.bottom + 8}px`;
                    // Align depending on screen position
                    const winW = window.innerWidth;
                    if (btnRect.left > winW / 2) {
                        dropdown.style.left = 'auto';
                        dropdown.style.right = `${winW - btnRect.right}px`;
                    } else {
                        dropdown.style.right = 'auto';
                        dropdown.style.left = `${btnRect.left}px`;
                    }

                    dropdown.classList.add('is-open');
                    e.currentTarget.removeAttribute('title');
                } else {
                    dropdown.classList.remove('is-open');
                    if (e.currentTarget.hasAttribute('data-original-title')) {
                        e.currentTarget.setAttribute('title', e.currentTarget.getAttribute('data-original-title'));
                    }
                }
            }
        });
    }

    const closeAllDropdowns = () => {
        document.querySelectorAll('.interval-dropdown.is-open').forEach(menu => {
            menu.classList.remove('is-open');
            // Check button title attribute restoration (the button is no longer a direct sibling due to body append)
            if (displayModeBtn && displayModeBtn.hasAttribute('data-original-title')) {
                displayModeBtn.setAttribute('title', displayModeBtn.getAttribute('data-original-title'));
            }
        });
    };



    document.addEventListener('click', (e) => {
        if (!e.target.closest('.interval-dropdown') && !e.target.closest('.display-mode-btn')) {
            closeAllDropdowns();
        }
    });

    // Close dropdown when scrolling main layout
    const mainLayout = document.getElementById('mainLayout');
    if (mainLayout) {
        mainLayout.addEventListener('scroll', closeAllDropdowns, { passive: true });
    }
    // Also close on window scroll or resize
    window.addEventListener('scroll', closeAllDropdowns, { passive: true });
    window.addEventListener('resize', closeAllDropdowns, { passive: true });

    // Handle Delegation for Mode Items and Interval Items
    // Because the dropdown is now attached to the body, it won't be caught by quickControls delegation.
    // We must attach an event listener directly to the dropdown or document body.
    if (dropdown) {
        dropdown.addEventListener('click', (e) => {
            const modeItem = e.target.closest('.mode-item');
            const intervalItem = e.target.closest('.interval-item');

            if (modeItem) {
                e.stopPropagation();
                e.preventDefault();

                const mode = modeItem.getAttribute('data-mode');
                if (mode && mode !== appSettings.mediaMode) {
                    if (appSettings.mediaMode === 'single' && (mode === 'random' || mode === 'cycle')) {
                        // Restore interval when leaving single mode
                        appSettings.mediaIntervalPreset = appSettings.lastActiveInterval || '1m';
                    }

                    appSettings.mediaMode = mode;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
                    updateQuickMediaButtons();
                    setupMediaTimer(true);
                    updateView();
                }
            } else if (intervalItem) {
                e.stopPropagation();
                e.preventDefault();

                if (appSettings.mediaMode === 'single') return; // Disabled in single mode

                // Close the dropdown after interval selection
                closeAllDropdowns();

                const val = intervalItem.getAttribute('data-value');
                if (val) {
                    appSettings.mediaIntervalPreset = val;
                    appSettings.lastActiveInterval = val;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
                    updateQuickMediaButtons();
                    setupMediaTimer(false); // Restart timer
                    showToast(`間隔を ${intervalItem.textContent} に設定しました`);
                    updateView();
                }
            }
        });
    }

    const quickControls = document.getElementById('quickMediaControls');
    if (quickControls) {
        quickControls.addEventListener('click', (e) => {
            // modeItem and intervalItem logic moved to the dropdown itself
            // since it was appended to the body
        });
    }
    updateQuickMediaButtons(); // Initialize active state

    // --- Toggle Display Months Button ---
    const btnToggleMonths = document.getElementById('btnToggleMonths');
    if (btnToggleMonths) {
        updateToggleMonthsUI();
        btnToggleMonths.addEventListener('click', () => {
            // 1 -> 2 -> 1
            appSettings.monthCount = (appSettings.monthCount % 2) + 1;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
            updateToggleMonthsUI();
            updateView();
        });
    }

    // --- Toggle Layout Button ---
    const btnToggleLayout = document.getElementById('btnToggleLayout');
    if (btnToggleLayout) {
        updateLayoutToggleUI();
        btnToggleLayout.addEventListener('click', () => {
            appSettings.layoutDirection = appSettings.layoutDirection === 'row' ? 'column' : 'row';
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));

            updateLayoutToggleUI();
            updateView();
        });
    }

    // Cycle check (Refactored to dynamic timer)
    setupMediaTimer(true);
}

/**
 * トグルボタンのSVGテキストを現在のmonthCountに同期する。
 */

// --- Mini Calendar Drag & Snap Logic ---
function setupMiniCalendarInteractions() {
    const calendarSection = document.querySelector('.calendar-section');
    if (!calendarSection) return;

    if (calendarSection.dataset.interactionsSetup) return;
    calendarSection.dataset.interactionsSetup = 'true';

    let isDragging = false;
    let hasDragged = false; // mousedown後に実際に移動が発生したかどうか
    let startX, startY, initialX, initialY;

    // Handle drag
    calendarSection.addEventListener('mousedown', (e) => {
        if (!appSettings.immersiveMode || document.body.classList.contains('show-overlay') || window.innerWidth <= 768) return;

        // Don't drag if clicking controls inside the calendar (if any are visible)
        if (e.target.closest('button') || e.target.tagName.toLowerCase() === 'input') return;

        isDragging = true;
        hasDragged = false;
        startX = e.clientX;
        startY = e.clientY;

        const rect = calendarSection.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;

        calendarSection.classList.add('is-dragging');
        e.preventDefault(); // Prevent text selection
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (!hasDragged && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
            hasDragged = true;
        }

        calendarSection.style.left = `${initialX + dx}px`;
        calendarSection.style.top = `${initialY + dy}px`;
        calendarSection.style.bottom = 'auto'; // Disable bottom/right to rely on top/left
        calendarSection.style.right = 'auto';
    });

    document.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        calendarSection.classList.remove('is-dragging');

        if (!hasDragged) return; // クリックの場合はsnap不要、clickイベントに任せる

        // Snap logic
        const rect = calendarSection.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const winW = window.innerWidth;
        const winH = window.innerHeight;

        const margin = 20;

        if (centerX < winW / 2) {
            calendarSection.style.left = `${margin}px`;
            calendarSection.style.right = 'auto';
        } else {
            calendarSection.style.right = `${margin}px`;
            calendarSection.style.left = 'auto';
        }

        if (centerY < winH / 2) {
            calendarSection.style.top = `${margin}px`;
            calendarSection.style.bottom = 'auto';
        } else {
            calendarSection.style.bottom = `${margin}px`;
            calendarSection.style.top = 'auto';
        }
    });

    // クリック（ドラッグなし）の場合のみオーバーレイ表示
    calendarSection.addEventListener('click', (e) => {
        if (hasDragged) {
            // ドラッグ後のclickイベントを無視してフラグをリセット
            hasDragged = false;
            return;
        }
        if (appSettings.immersiveMode && !document.body.classList.contains('show-overlay')) {
            document.body.classList.add('show-overlay');
        }
    });
}

function updateToggleMonthsUI() {
    const btn = document.getElementById('btnToggleMonths');
    if (!btn) return;

    if (appSettings.monthCount === 1) {
        // 1ヶ月表示: 案Cスタイルの大きめ単体カレンダー
        btn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="2" width="18" height="20" rx="1.5"/>
                <rect x="3" y="2" width="18" height="5" rx="1.5" fill="currentColor" fill-opacity="0.2" stroke="none"/>
                <line x1="3" y1="7" x2="21" y2="7"/>
                <line x1="9" y1="7" x2="9" y2="22" stroke-width="0.7"/>
                <line x1="15" y1="7" x2="15" y2="22" stroke-width="0.7"/>
                <line x1="3" y1="12" x2="21" y2="12" stroke-width="0.7"/>
                <line x1="3" y1="17" x2="21" y2="17" stroke-width="0.7"/>
            </svg>
        `;
    } else {
        // 2ヶ月表示: 案Cスタイルの2枚重ね（後ろ薄く・前フル）
        btn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <g opacity="0.45">
                    <rect x="1" y="2" width="14" height="13" rx="1.5"/>
                    <rect x="1" y="2" width="14" height="3.5" rx="1.5" fill="currentColor" fill-opacity="0.5" stroke="none"/>
                    <line x1="1" y1="5.5" x2="15" y2="5.5"/>
                    <line x1="5.67" y1="5.5" x2="5.67" y2="15" stroke-width="0.7"/>
                    <line x1="10.33" y1="5.5" x2="10.33" y2="15" stroke-width="0.7"/>
                    <line x1="1" y1="9.5" x2="15" y2="9.5" stroke-width="0.7"/>
                    <line x1="1" y1="13" x2="15" y2="13" stroke-width="0.7"/>
                </g>
                <rect x="8" y="9" width="15" height="13" rx="1.5"/>
                <rect x="8" y="9" width="15" height="3.5" rx="1.5" fill="currentColor" fill-opacity="0.2" stroke="none"/>
                <line x1="8" y1="12.5" x2="23" y2="12.5"/>
                <line x1="13" y1="12.5" x2="13" y2="22" stroke-width="0.7"/>
                <line x1="18" y1="12.5" x2="18" y2="22" stroke-width="0.7"/>
                <line x1="8" y1="16.5" x2="23" y2="16.5" stroke-width="0.7"/>
                <line x1="8" y1="20.5" x2="23" y2="20.5" stroke-width="0.7"/>
            </svg>
        `;
    }

    // 1ヶ月表示時はレイアウト方向トグルを非表示
    const layoutBtn = document.getElementById('btnToggleLayout');
    if (layoutBtn) {
        layoutBtn.style.display = appSettings.monthCount === 1 ? 'none' : '';
    }
}

/**
 * レイアウト切替ボタンのSVGアイコンを現在の状況に合わせて変更する。
 */

function updateLayoutMenuUI() {
    const layoutModeBtn = document.querySelector('.layout-mode-btn');
    if (!layoutModeBtn) return;

    // Update main icon based on setting
    const icons = {
        smart: layoutModeBtn.querySelector('.icon-layout-smart'),
        top: layoutModeBtn.querySelector('.icon-layout-top'),
        bottom: layoutModeBtn.querySelector('.icon-layout-bottom'),
        left: layoutModeBtn.querySelector('.icon-layout-left'),
        right: layoutModeBtn.querySelector('.icon-layout-right'),
        immersive: layoutModeBtn.querySelector('.icon-layout-immersive'),
    };

    Object.values(icons).forEach(icon => { if (icon) icon.style.display = 'none'; });

    // Display active layout mode icon
    if (icons[appSettings.layoutMode]) {
        icons[appSettings.layoutMode].style.display = 'block';
    }

    // Active state for pill: active if NOT smart
    if (appSettings.layoutMode !== 'smart') {
        layoutModeBtn.classList.add('active');
    } else {
        layoutModeBtn.classList.remove('active');
    }

    // Update active state in dropdown
    const layoutItems = document.querySelectorAll('.layout-item');
    layoutItems.forEach(item => {
        if (item.getAttribute('data-layout') === appSettings.layoutMode) {
            item.classList.add('is-active');
        } else {
            item.classList.remove('is-active');
        }
    });
}

function setupLayoutMenu() {
    const layoutModeBtn = document.querySelector('.layout-mode-btn');
    const layoutDropdown = document.querySelector('.layout-dropdown');

    if (layoutDropdown) {
        document.body.appendChild(layoutDropdown);
    }

    if (layoutModeBtn) {
        layoutModeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (layoutDropdown) {
                const isOpen = layoutDropdown.classList.contains('is-open');
                if (!isOpen) {
                    const btnRect = e.currentTarget.getBoundingClientRect();
                    layoutDropdown.style.top = `${btnRect.bottom + 8}px`;
                    const winW = window.innerWidth;
                    if (btnRect.left > winW / 2) {
                        layoutDropdown.style.left = 'auto';
                        layoutDropdown.style.right = `${winW - btnRect.right}px`;
                    } else {
                        layoutDropdown.style.right = 'auto';
                        layoutDropdown.style.left = `${btnRect.left}px`;
                    }
                    layoutDropdown.classList.add('is-open');
                } else {
                    layoutDropdown.classList.remove('is-open');
                }
            }
        });
    }

    const layoutItems = document.querySelectorAll('.layout-item');
    layoutItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const mode = e.currentTarget.getAttribute('data-layout');
            appSettings.layoutMode = mode;

            if (mode === 'immersive') {
                appSettings.immersiveMode = true;
            } else {
                appSettings.immersiveMode = false;
                if (mode !== 'smart') {
                    appSettings.mediaPosition = mode;
                    if (mode === 'top' || mode === 'bottom') {
                        appSettings.layoutDirection = 'row';
                    } else {
                        appSettings.layoutDirection = 'column';
                    }
                } else {
                    // If smart, trigger re-evaluation if we have a current image
                    const mainImg = document.querySelector('.media-main-img');
                    if (mainImg) {
                        applyAutoLayout(mainImg);
                    }
                }
            }
 
            applyImmersiveState();

            localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
            updateLayoutMenuUI();
            updateLayoutToggleUI();
            updateView();

            if (layoutDropdown) {
                layoutDropdown.classList.remove('is-open');
            }
        });
    });

    document.addEventListener('click', (e) => {
        if (layoutDropdown && layoutDropdown.classList.contains('is-open') && !e.target.closest('.layout-mode-control') && !e.target.closest('.layout-dropdown')) {
            layoutDropdown.classList.remove('is-open');
        }
    });
}

function updateLayoutToggleUI() {
    const layoutIcon = document.getElementById('layoutIcon');
    if (!layoutIcon) return;

    if (appSettings.layoutDirection === 'row') {
        // 現在：横並び -> 横並び状態を示すアイコン
        layoutIcon.innerHTML = `
            <rect x="1" y="3.5" width="10" height="17" rx="1.5"/>
            <rect x="1" y="3.5" width="10" height="4" rx="1.5" fill="currentColor" fill-opacity="0.2" stroke="none"/>
            <line x1="1" y1="7.5" x2="11" y2="7.5"/>
            <line x1="4.33" y1="7.5" x2="4.33" y2="20.5" stroke-width="0.7"/>
            <line x1="7.67" y1="7.5" x2="7.67" y2="20.5" stroke-width="0.7"/>
            <line x1="1" y1="11.5" x2="11" y2="11.5" stroke-width="0.7"/>
            <line x1="1" y1="15.5" x2="11" y2="15.5" stroke-width="0.7"/>
            <rect x="13" y="3.5" width="10" height="17" rx="1.5"/>
            <rect x="13" y="3.5" width="10" height="4" rx="1.5" fill="currentColor" fill-opacity="0.2" stroke="none"/>
            <line x1="13" y1="7.5" x2="23" y2="7.5"/>
            <line x1="16.33" y1="7.5" x2="16.33" y2="20.5" stroke-width="0.7"/>
            <line x1="19.67" y1="7.5" x2="19.67" y2="20.5" stroke-width="0.7"/>
            <line x1="13" y1="11.5" x2="23" y2="11.5" stroke-width="0.7"/>
            <line x1="13" y1="15.5" x2="23" y2="15.5" stroke-width="0.7"/>
        `;
    } else {
        // 現在：縦並び -> 縦並び状態を示すアイコン
        layoutIcon.innerHTML = `
            <rect x="1.5" y="1.5" width="21" height="9" rx="1.5"/>
            <rect x="1.5" y="1.5" width="21" height="3.5" rx="1.5" fill="currentColor" fill-opacity="0.2" stroke="none"/>
            <line x1="1.5" y1="5" x2="22.5" y2="5"/>
            <line x1="6.75" y1="5" x2="6.75" y2="10.5" stroke-width="0.7"/>
            <line x1="12" y1="5" x2="12" y2="10.5" stroke-width="0.7"/>
            <line x1="17.25" y1="5" x2="17.25" y2="10.5" stroke-width="0.7"/>
            <line x1="1.5" y1="7.75" x2="22.5" y2="7.75" stroke-width="0.7"/>
            <rect x="1.5" y="13.5" width="21" height="9" rx="1.5"/>
            <rect x="1.5" y="13.5" width="21" height="3.5" rx="1.5" fill="currentColor" fill-opacity="0.2" stroke="none"/>
            <line x1="1.5" y1="17" x2="22.5" y2="17"/>
            <line x1="6.75" y1="17" x2="6.75" y2="22.5" stroke-width="0.7"/>
            <line x1="12" y1="17" x2="12" y2="22.5" stroke-width="0.7"/>
            <line x1="17.25" y1="17" x2="17.25" y2="22.5" stroke-width="0.7"/>
            <line x1="1.5" y1="19.75" x2="22.5" y2="19.75" stroke-width="0.7"/>
        `;
    }
}

let mediaTimer = null;
let currentCycleIndex = -1;

function setupMediaTimer(isInit = false) {
    if (mediaTimer) {
        clearInterval(mediaTimer);
        clearTimeout(mediaTimer);
        mediaTimer = null;
    }

    if (isInit) {
        updateMediaArea('restore');
    }

    if (appSettings.mediaMode === 'single') return;

    const preset = appSettings.mediaIntervalPreset || '1m';
    if (preset === 'startup') return;

    // --- Case 1: Fixed Interval (s, m, h) ---
    if (preset.includes('s') || preset.includes('m') || preset.includes('h')) {
        let seconds = 60;
        if (preset === '10s') seconds = 10;
        else if (preset === '30s') seconds = 30;
        else if (preset === '1m') seconds = 60;
        else if (preset === '10m') seconds = 600;
        else if (preset === '1h') seconds = 3600;

        mediaTimer = setInterval(() => {
            updateMediaArea('advance');
        }, seconds * 1000);
    }
    // --- Case 2: Specific Time (H:MM) ---
    else if (preset.includes(':')) {
        const scheduleNext = () => {
            const [targetH, targetM] = preset.split(':').map(Number);
            const now = new Date();
            const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetH, targetM, 0, 0);

            // If target time has already passed today, set for tomorrow
            if (target <= now) {
                target.setDate(target.getDate() + 1);
            }

            const diff = target - now;

            mediaTimer = setTimeout(() => {
                updateMediaArea('advance');
                scheduleNext(); // Recursive for next day
            }, diff);
        };

        scheduleNext();
    }
}

if (typeof document !== 'undefined') { document.addEventListener('DOMContentLoaded', init); }

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .catch(err => console.warn('Service Worker registration failed.', err));
    });
}

// --- Media Logic ---
let currentMediaObjectURL = null;

/**
 * プレースホルダーを削除し、コンテンツレイヤーを作成・取得する
 * @param {HTMLElement} container メディアコンテナ
 * @returns {HTMLElement} コンテンツレイヤー
 */
function prepareMediaContentLayer(container) {
    let contentLayer = container.querySelector('.media-content-layer');
    if (!contentLayer) {
        // Remove placeholder instead of full reset to preserve drag handle
        const placeholder = container.querySelector('.media-placeholder');
        if (placeholder) placeholder.remove();

        contentLayer = document.createElement('div');
        contentLayer.className = 'media-content-layer';
        contentLayer.style.width = '100%';
        contentLayer.style.height = '100%';
        contentLayer.style.display = 'flex';
        contentLayer.style.alignItems = 'center';
        contentLayer.style.justifyContent = 'center';
        container.appendChild(contentLayer);
    }
    return contentLayer;
}

/**
 * 手動ナビゲーションボタン（前後）の描画・削除を行う
 * @param {HTMLElement} contentLayer コンテンツレイヤー
 * @param {Function} handleNavigation ナビゲーション処理関数
 */
function updateMediaNavigation(contentLayer, handleNavigation) {
    if (appSettings.mediaMode === 'random' || appSettings.mediaMode === 'cycle') {
        if (!contentLayer.querySelector('.media-nav-btn.prev')) {
            const btnPrev = document.createElement('button');
            btnPrev.type = 'button';
            btnPrev.className = 'media-nav-btn prev';
            btnPrev.setAttribute('aria-label', '前の画像');
            btnPrev.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
            btnPrev.onclick = (e) => { e.stopPropagation(); handleNavigation('prev'); };
            contentLayer.appendChild(btnPrev);
        }
        if (!contentLayer.querySelector('.media-nav-btn.next')) {
            const btnNext = document.createElement('button');
            btnNext.type = 'button';
            btnNext.className = 'media-nav-btn next';
            btnNext.setAttribute('aria-label', '次の画像');
            btnNext.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
            btnNext.onclick = (e) => { e.stopPropagation(); handleNavigation('next'); };
            contentLayer.appendChild(btnNext);
        }
    } else {
        // Remove valid buttons if mode changed to single/none
        const existing = contentLayer.querySelectorAll('.media-nav-btn');
        existing.forEach(el => el.remove());
    }
}

/**
 * 画像・動画を表示するためのディスプレイエリアを作成・取得する
 * @param {HTMLElement} contentLayer コンテンツレイヤー
 * @returns {HTMLElement} ディスプレイエリア
 */
function getOrCreateMediaDisplayArea(contentLayer) {
    let displayArea = contentLayer.querySelector('.media-display-area');
    if (!displayArea) {
        displayArea = document.createElement('div');
        displayArea.className = 'media-display-area';
        displayArea.style.width = '100%';
        displayArea.style.height = '100%';
        displayArea.style.display = 'flex';
        displayArea.style.alignItems = 'center';
        displayArea.style.justifyContent = 'center';
        contentLayer.appendChild(displayArea);
    }
    return displayArea;
}

/**
 * 次に表示するメディアのキーを決定する
 * @param {string[]} keys ローカルDBのキー配列
 * @param {string} mode 更新モード('advance', 'restore', 'prev', 'next')
 * @returns {string|null} 対象のキー
 */
function determineTargetMediaKey(keys, mode) {
    let targetKey = null;

    if (mode === 'restore' && appState.lastMediaKey && keys.includes(appState.lastMediaKey)) {
        // Restore last state on boot
        targetKey = appState.lastMediaKey;

        // Sync index if in cycle mode
        if (appSettings.mediaMode === 'cycle') {
            currentCycleIndex = keys.indexOf(targetKey);
        }

        // Re-initialize history if empty but we have a restore key
        if (appState.mediaHistory.length === 0) {
            appState.mediaHistory = [targetKey];
            appState.mediaHistoryIndex = 0;
        } else {
            // If history exists, ensure index is valid
            if (appState.mediaHistoryIndex === -1 || appState.mediaHistoryIndex >= appState.mediaHistory.length) {
                appState.mediaHistoryIndex = appState.mediaHistory.length - 1;
            }
        }

    } else if (mode === 'prev') {
        // --- Previous Action ---
        if (appSettings.mediaMode === 'random') {
            if (appState.mediaHistoryIndex > 0) {
                appState.mediaHistoryIndex--;
                targetKey = appState.mediaHistory[appState.mediaHistoryIndex];
            } else {
                // Start of history
                targetKey = appState.mediaHistory[0];
            }
        } else if (appSettings.mediaMode === 'cycle') {
            // Simple decrement
            if (currentCycleIndex === -1) currentCycleIndex = 0;
            currentCycleIndex = (currentCycleIndex - 1 + keys.length) % keys.length;
            targetKey = keys[currentCycleIndex];
        }

    } else if (mode === 'next' || mode === 'advance') {
        // --- Next/Advance Action ---

        if (appSettings.mediaMode === 'random') {
            // Check if we are browsing history
            if (appState.mediaHistoryIndex < appState.mediaHistory.length - 1) {
                // Move forward in history
                appState.mediaHistoryIndex++;
                targetKey = appState.mediaHistory[appState.mediaHistoryIndex];
            } else {
                // Generate NEW random
                let nextKey;
                let attempts = 0;
                do {
                    nextKey = keys[Math.floor(Math.random() * keys.length)];
                    attempts++;
                } while (nextKey === appState.lastMediaKey && keys.length > 1 && attempts < 5);

                targetKey = nextKey;

                // Push to history
                appState.mediaHistory.push(targetKey);
                appState.mediaHistoryIndex = appState.mediaHistory.length - 1;

                // Limit history size
                if (appState.mediaHistory.length > 50) {
                    appState.mediaHistory.shift();
                    appState.mediaHistoryIndex--;
                }
            }

        } else if (appSettings.mediaMode === 'cycle') {
            // State-based rotation
            if (currentCycleIndex === -1) {
                currentCycleIndex = 0;
            } else {
                currentCycleIndex = (currentCycleIndex + 1) % keys.length;
            }
            targetKey = keys[currentCycleIndex];
        } else if (appSettings.mediaMode === 'single') {
            targetKey = keys[0];
        }
    } else {
        // Fallback/Default
        if (keys.length > 0) targetKey = keys[0];
    }

    return targetKey;
}

/**
 * デフォルトの画像を描画する
 * @param {HTMLElement} displayArea ディスプレイエリア
 */
function renderDefaultMedia(displayArea) {
    displayArea.innerHTML = '';
    const defaultImg = document.createElement('img');
    defaultImg.alt = "Default Image";
    defaultImg.style.cssText = 'width:100%; height:100%; object-fit:contain;';

    // Apply auto layout even for default image
    defaultImg.onload = () => {
        applyAutoLayout(defaultImg);
    };
    defaultImg.src = 'src/assets/default_image.png';

    displayArea.appendChild(defaultImg);
}

/**
 * 画像や動画などのメディアレコードを描画する
 * @param {Object} record ローカルDBから取得したメディア情報
 * @param {HTMLElement} displayArea ディスプレイエリア
 */
function renderMediaRecord(record, displayArea) {
    currentMediaObjectURL = URL.createObjectURL(record.file || record); // Handle File object safely

    // Determine content type
    const mime = (record.file ? record.file.type : record.type) || 'image/png';

    // Important: DO NOT clear contentLayer entirely, as it contains nav buttons and displayArea.
    // Clear ONLY the displayArea content.
    if (displayArea) {
        displayArea.innerHTML = '';
    }

    if (mime.startsWith('image/')) {
        // Create Background Layer (Blur)
        const backdrop = document.createElement('img');
        backdrop.className = 'media-backdrop';
        backdrop.src = currentMediaObjectURL;

        // Create Main Image Layer
        const mainImg = document.createElement('img');
        mainImg.className = 'media-main-img';
        mainImg.alt = "Oshi Media";

        // Aspect Ratio Detection & Auto Layout - Set handler BEFORE src
        mainImg.onload = () => {
            applyAutoLayout(mainImg);
        };
        mainImg.src = currentMediaObjectURL;

        if (displayArea) {
            displayArea.appendChild(backdrop);
            displayArea.appendChild(mainImg);
        }
    } else if (mime.startsWith('video/')) {
        const video = document.createElement('video');
        video.src = currentMediaObjectURL;
        video.autoplay = true;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'contain';
        if (displayArea) {
            displayArea.appendChild(video);
        }
    }
}

async function updateMediaArea(mode = 'advance') { // Changed to mode: 'advance'|'restore'|'layout'
    const area = document.getElementById('mediaArea');
    const container = document.getElementById('mediaContainer');
    if (!area || !container) return;

    area.style.display = 'block';
    adjustMediaLayout();

    if (mode === 'layout') return; // Stop here if only layout update is requested

    // Clean up previous ObjectURL if exists
    if (currentMediaObjectURL) {
        URL.revokeObjectURL(currentMediaObjectURL);
        currentMediaObjectURL = null;
    }

    // Prepare Container Structure (Content Layer + UI Layer)
    const contentLayer = prepareMediaContentLayer(container);

    // --- Manual Navigation Logic ---
    const handleNavigation = async (direction) => { // 'next' or 'prev'
        await updateMediaArea(direction === 'next' ? 'next' : 'prev');

        // Reset timer if it's an interval-based preset to prevent immediate switch
        const preset = appSettings.mediaIntervalPreset || '1m';
        if (preset.includes('s') || preset.includes('m') || preset.includes('h')) {
            setupMediaTimer(false);
        }
    };

    // Render Navigation Buttons (if not present)
    updateMediaNavigation(contentLayer, handleNavigation);

    // Helper to get or create image display area (to preserve buttons)
    const displayArea = getOrCreateMediaDisplayArea(contentLayer);

    // --- Logic: Local Only ---
    try {
        const dbKeys = await localImageDB.getAllKeys();
        const keys = getEffectiveImagePool(getOrderedImageKeys(dbKeys));
        if (keys.length === 0) {
            renderDefaultMedia(displayArea);
            return;
        }

        const targetKey = determineTargetMediaKey(keys, mode);

        // Save State
        if (targetKey) {
            appState.lastMediaKey = targetKey;
            saveState();

            const record = await localImageDB.getImage(targetKey);
            if (record) {
                renderMediaRecord(record, displayArea);
                highlightMemorialOshisForImage(targetKey);
            }
        }
    } catch (e) {
        console.error("Error in updateMediaArea:", e);
        if (displayArea) {
            displayArea.innerHTML = '<p class="media-placeholder">画像の読み込みエラー</p>';
        }
    }
}

/**
 * 画像のアスペクト比を判定し、おまかせモードならレイアウトを自動調整する。
 * @param {HTMLImageElement} img 判定対象の画像エレメント
 */
function applyAutoLayout(img) {
    if (appSettings.layoutMode !== 'smart') return;

    const w = img.naturalWidth;
    const h = img.naturalHeight;

    if (w === 0 || h === 0) {
        console.warn(`[AutoLayout] Image dimensions are zero (${w}x${h}). Skipping adjustment.`);
        return;
    }

    const ratio = w / h;
    const invRatio = h / w;

    let changed = false;
    if (ratio >= 1.2) {
        // Landscape -> Top Photo + Row Calendar
        if (appSettings.mediaPosition !== 'top' || appSettings.layoutDirection !== 'row') {
            appSettings.mediaPosition = 'top';
            appSettings.layoutDirection = 'row';
            changed = true;
        }
    } else if (invRatio >= 1.2) {
        // Portrait -> Left Photo + Column Calendar
        if (appSettings.mediaPosition !== 'left' || appSettings.layoutDirection !== 'column') {
            appSettings.mediaPosition = 'left';
            appSettings.layoutDirection = 'column';
            changed = true;
        }
    } else {
        // Default/Square -> Standard Top + Row
        if (appSettings.mediaPosition !== 'top' || appSettings.layoutDirection !== 'row') {
            appSettings.mediaPosition = 'top';
            appSettings.layoutDirection = 'row';
            changed = true;
        }
    }

    if (changed) {
        saveSettingsSilently();
        updateLayoutToggleUI();
        updateView(); // Re-render everything with new layout classes
    }
}

/**
 * Saves settings to localStorage without closing the modal or showing toast.
 */
function saveSettingsSilently() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
}

function adjustMediaLayout() {
    const area = document.getElementById('mediaArea');
    const container = document.getElementById('mediaContainer');
    if (!area || !container) return;

    // Reset manual styles first, except if we have a saved size that overrides default
    area.style.width = '';
    area.style.maxWidth = '';
    container.style.height = '';

    // Mobile Override
    if (window.innerWidth <= 768) {
        area.style.width = '100%';
        area.style.maxWidth = '100%';
        container.style.height = 'auto';
        return;
    }

    const pos = appSettings.mediaPosition || 'right';
    const header = document.querySelector('.header');

    // スプリッターの表示/非表示調整等
    const splitter = document.getElementById('layoutSplitter');
    if (splitter) {
        splitter.style.display = 'flex'; // Reset splitter state
    }

    // Gaps estimate: body padding (40) + main-layout padding-bottom (40) + 2x gap (48) + safety margin
    // Adjusted to ensure bottom margin prevents vertical scrollbars
    const gaps = 150;

    if (pos === 'top' || pos === 'bottom') {
        // --- Top/Bottom: Full Width (Centered) & Dynamic Height ---

        // Width: Match total calendar width
        let targetWidth = 550;
        if (appSettings.layoutDirection === 'row') {
            targetWidth = (550 * appSettings.monthCount) + (24 * (appSettings.monthCount - 1));
        }
        area.style.width = `${targetWidth}px`;
        area.style.maxWidth = '95vw';

        // Height: Fit to Remaining Window OR Use Saved Size
        if (appSettings.mediaSize) {
            container.style.height = `${appSettings.mediaSize}px`;
        } else {
            const calendarSection = document.querySelector('.calendar-section');
            if (calendarSection) {
                const calendarH = calendarSection.offsetHeight;
                const availableH = window.innerHeight - calendarH - gaps;

                // Minimum 250px
                container.style.height = `${Math.max(250, availableH)}px`;
            }
        }

    } else {
        // --- Left/Right: Fixed Width & Full Available Height ---

        // Width: Use Saved Size or Fixed 550px
        const currentWidth = appSettings.mediaSize || 550;
        area.style.width = `${currentWidth}px`;
        area.style.maxWidth = `${currentWidth}px`;

        // Height: Expand to fill available screen height (minimum matching calendar)
        // Decoupled from strict calendar height synchronization
        const calendarWrapper = document.getElementById('calendarWrapper');
        let minHeight = 400;
        if (calendarWrapper) {
            minHeight = calendarWrapper.offsetHeight;
        }

        const availableH = window.innerHeight - 100; // body padding + safety
        container.style.height = `${Math.max(minHeight, availableH)}px`;
    }
}



if (typeof window !== 'undefined') { window.addEventListener('resize', adjustMediaLayout); }

// script ends here

// --- Exports for Testing ---
/** @export */
window.appSettings = appSettings;
/** @export */
window.renderCalendar = renderCalendar;
/** @export */
window.escapeHTML = escapeHTML;
/** @export */
window.getContrastColor = getContrastColor;
/** @export */
window.parseDateString = parseDateString;
/** @export */
window.getWeekdayHeaderHTML = getWeekdayHeaderHTML;
/** @export */
window.getJPHoliday = getJPHoliday;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        appSettings,
        renderCalendar,
        escapeHTML,
        getContrastColor,
        parseDateString,
        getWeekdayHeaderHTML,
        getJPHoliday
    };
}

// Fallback for Vitest when loaded directly without transpilation matching standard browser env
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    // Prevent throw when `export` is encountered in a standard script context inside E2E browsers.
    // E2E UI testing uses standard scripts.
    try {
        if (typeof module !== 'undefined' && module.exports) {
            // We are in node tests, vitest can use module.exports
        }
    } catch (e) { }
} else if (typeof exports !== 'undefined' && typeof window === 'undefined') {
    // Only throw exports in node-like environments that are expecting it. E2E browser environments
    // running via <script src="script.js"> will throw SyntaxError on export.
} else {
    // We don't export in browser explicitly using ESM export token to avoid syntax errors.
    // Instead we rely on window.* that are populated above.
}
