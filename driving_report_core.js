/**
 * driving_report_core.js
 * 定数定義、グローバル状態、および初期設定
 */

const GAS_URL_KEY = 'driving_report_gas_url';
const THEME_KEY = 'attendance_theme';
const DRIVER_LIST_KEY = 'driving_report_driver_list';
const VEHICLE_LIST_KEY = 'driving_report_vehicle_list';
const CHECKER_LIST_KEY = 'driving_report_checker_list';
const LAST_DRIVER_KEY = 'driving_report_last_driver';
const LAST_VEHICLE_KEY = 'driving_report_last_vehicle';
const LAST_CHECKER_PRE_KEY = 'driving_report_last_checker_pre';
const LAST_CHECKER_POST_KEY = 'driving_report_last_checker_post';
const HISTORY_KEY = 'driving_report_history';
const PASSCODE_KEY = 'driving_report_passcode';

let html5QrCode = null;

const DEFAULT_DRIVERS = ['(設定から名前を追加してください)'];
const DEFAULT_VEHICLES = ['(設定から車両名を追加してください)'];
const DEFAULT_CHECKERS = ['(設定から確認者名を追加してください)'];

/**
 * アプリの初期化
 */
document.addEventListener('DOMContentLoaded', () => {
    if (typeof initDate === 'function') initDate();
    if (typeof loadSettings === 'function') loadSettings();
    if (typeof initDropdowns === 'function') initDropdowns();
    if (typeof setupEventListeners === 'function') setupEventListeners();

    // 履歴の読み込み
    if (typeof loadFromLocal === 'function') loadFromLocal();

    // URLパラメータの処理（QRコードからの遷移等）
    if (typeof handleUrlParams === 'function') handleUrlParams();
});

/**
 * 日付の初期設定
 */
function initDate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    const dateInput = document.getElementById('report-date');
    if (dateInput) {
        dateInput.value = `${yyyy}-${mm}-${dd}`;
        updateDayOfWeek();
    }
}

/**
 * 曜日の更新
 */
function updateDayOfWeek() {
    const dateInput = document.getElementById('report-date');
    const label = document.getElementById('report-day-of-week');
    if (!dateInput || !label) return;

    if (!dateInput.value) {
        label.textContent = '';
        return;
    }
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const d = new Date(dateInput.value);
    label.textContent = `(${days[d.getDay()]})`;
}
