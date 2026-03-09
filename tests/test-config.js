/**
 * テスト実行時の共通設定管理
 */

const TEST_TIMEOUT_FACTOR = parseFloat(process.env.TEST_TIMEOUT_FACTOR || '1.0');

export const TEST_CONFIG = {
    // タイムアウト設定（基本値に倍率を適用）
    timeouts: {
        short: 5000 * TEST_TIMEOUT_FACTOR,
        medium: 10000 * TEST_TIMEOUT_FACTOR,
        long: 30000 * TEST_TIMEOUT_FACTOR,
        nav: 15000 * TEST_TIMEOUT_FACTOR,
    },

    // 視覚的比較の許容度
    visual: {
        maxDiffPixelRatio: 0.1,
        threshold: 0.2,
    },

    // リトライ設定
    retries: process.env.CI ? 2 : 1,

    // 並列実行数（WSL環境を考慮して制限可能）
    workers: process.env.WSL_DISTRO_NAME ? 1 : undefined,
};

export default TEST_CONFIG;
