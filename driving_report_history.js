/**
 * driving_report_history.js
 * 履歴の保存・読み込みロジック
 */

// オートセーブのタイマー
setInterval(() => {
    const modal = document.getElementById('settings-modal');
    const qrModal = document.getElementById('qr-scan-modal');
    const qrDisplayModal = document.getElementById('qr-modal');

    // いずれかのモーダルが表示されている時はオートセーブをスキップ
    const isModalVisible = (m) => m && m.style.display !== 'none' && m.style.display !== '';

    if (!isModalVisible(modal) && !isModalVisible(qrModal) && !isModalVisible(qrDisplayModal)) {
        saveToLocal();
    }
}, 5000);

/**
 * ローカルストレージへ保存
 */
function saveToLocal() {
    let history = {};
    try {
        const json = localStorage.getItem(HISTORY_KEY);
        if (json) history = JSON.parse(json);
    } catch (e) { console.error('History parse error', e); }

    const data = typeof collectReportData === 'function' ? collectReportData() : {};
    if (!data.date) return;

    const historyKey = data.vehicleId ? `${data.date}_${data.vehicleId}` : data.date;
    history[historyKey] = data;

    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
        console.error('History save error (Storage full?)', e);
        // 必要に応じて古い履歴の削除などを検討
    }
}

/**
 * 手動保存
 */
function manualSave() {
    saveToLocal();
    const statusMsg = document.getElementById('status-msg');
    if (statusMsg) {
        statusMsg.textContent = '一時保存しました';
        statusMsg.className = 'status-msg status-success';
        setTimeout(() => {
            statusMsg.textContent = '';
            statusMsg.className = 'status-msg';
        }, 2000);
    }
}

/**
 * 現在の選択（日付・車両）に基づいて読み込み
 */
function loadFromLocal() {
    const dateEl = document.getElementById('report-date');
    const vehicleEl = document.getElementById('vehicle-id');
    if (dateEl && dateEl.value) {
        const vId = vehicleEl ? vehicleEl.value : '';
        loadFromHistory(dateEl.value, vId);
    }
}

/**
 * 特定の履歴を読み込み
 */
function loadFromHistory(dateStr, vehicleId = '') {
    if (!dateStr) return;

    let history = {};
    try {
        const json = localStorage.getItem(HISTORY_KEY);
        if (json) history = JSON.parse(json);
    } catch (e) { console.error('History parse error', e); }

    let data = null;
    if (vehicleId) {
        data = history[`${dateStr}_${vehicleId}`];
    } else {
        data = history[dateStr];
    }

    if (data) {
        if (typeof fillForm === 'function') fillForm(data);
    } else {
        if (typeof resetFormExceptHeader === 'function') resetFormExceptHeader();
    }
}

/**
 * 現在の選択に基づいて履歴を削除
 */
function removeFromHistory() {
    const dateEl = document.getElementById('report-date');
    const vehicleEl = document.getElementById('vehicle-id');
    if (!dateEl || !dateEl.value) return;

    const dateStr = dateEl.value;
    const vehicleId = vehicleEl ? vehicleEl.value : '';

    let history = {};
    try {
        const json = localStorage.getItem(HISTORY_KEY);
        if (json) history = JSON.parse(json);
    } catch (e) { return; }

    const historyKey = vehicleId ? `${dateStr}_${vehicleId}` : dateStr;
    if (history[historyKey]) {
        delete history[historyKey];
        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
            console.log('[History] Removed entry:', historyKey);
        } catch (e) { console.error('History remove error', e); }
    }
}

window.removeFromHistory = removeFromHistory;
