const GAS_URL_KEY = 'driving_report_gas_url';
const THEME_KEY = 'attendance_theme';
const DRIVER_LIST_KEY = 'driving_report_driver_list';
const CHECKER_LIST_KEY = 'driving_report_checker_list';
const LAST_DRIVER_KEY = 'driving_report_last_driver';
const LAST_CHECKER_PRE_KEY = 'driving_report_last_checker_pre';
const LAST_CHECKER_POST_KEY = 'driving_report_last_checker_post';
const HISTORY_KEY = 'driving_report_history';

const DEFAULT_DRIVERS = ['運転者A', '運転者B'];
const DEFAULT_CHECKERS = ['管理者A', '管理者B'];

document.addEventListener('DOMContentLoaded', () => {
    initDate();
    loadSettings();
    initDropdowns(); // Load lists
    initTheme(); // Initialize Theme
    setupEventListeners();

    // Attempt to load autosaved data LAST (to overwrite defaults)
    loadFromLocal();

    // Start auto-saving loop or bind events (we bind events in setupEventListeners)
});

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

function updateDayOfWeek() {
    const dateInput = document.getElementById('report-date');
    const label = document.getElementById('report-day-of-week');
    if (!dateInput || !label) return;

    const dateVal = new Date(dateInput.value);
    if (isNaN(dateVal)) {
        label.textContent = '';
        return;
    }
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    label.textContent = `(${days[dateVal.getDay()]})`;
}

function loadSettings() {
    // Optional: Load URL into the modal input immediately? 
    // Not strictly necessary if openSettingsModal does it, but good for sendReport if it reads DOM
    const savedUrl = localStorage.getItem(GAS_URL_KEY);
    if (savedUrl) {
        const input = document.getElementById('gas-url-input');
        if (input) input.value = savedUrl;
    }
}

function initDropdowns() {
    // Drivers
    updateDropdownOptions(DRIVER_LIST_KEY, ['driver-name'], DEFAULT_DRIVERS);
    const lastDriver = localStorage.getItem(LAST_DRIVER_KEY);
    if (lastDriver) document.getElementById('driver-name').value = lastDriver;

    // Checkers (Pre & Post)
    updateDropdownOptions(CHECKER_LIST_KEY, ['pre-checker', 'post-checker'], DEFAULT_CHECKERS);
    const lastPreChecker = localStorage.getItem(LAST_CHECKER_PRE_KEY);
    if (lastPreChecker) document.getElementById('pre-checker').value = lastPreChecker;

    // Post checker defaults to Pre checker if not set? No, let's load last used.
    const lastPostChecker = localStorage.getItem(LAST_CHECKER_POST_KEY);
    if (lastPostChecker) document.getElementById('post-checker').value = lastPostChecker;
}

function updateDropdownOptions(storageKey, elementIds, defaultList) {
    let listStr = localStorage.getItem(storageKey);
    let list = [];
    if (listStr) {
        list = JSON.parse(listStr);
    } else {
        list = defaultList;
        localStorage.setItem(storageKey, JSON.stringify(list));
    }

    elementIds.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;

        const currentVal = select.value;
        select.innerHTML = '<option value="">選択してください</option>';
        list.forEach(item => {
            const option = document.createElement('option');
            option.value = item;
            option.textContent = item;
            select.appendChild(option);
        });

        // Preserve value if still exists
        if (list.includes(currentVal)) {
            select.value = currentVal;
        }
    });
}

// ------------------------------------------------------------------
// Theme Handling
// ------------------------------------------------------------------
function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        updateThemeIcon(true);
    } else {
        document.documentElement.removeAttribute('data-theme');
        updateThemeIcon(false);
    }
}

function toggleTheme() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem(THEME_KEY, 'dark');
        updateThemeIcon(false);
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem(THEME_KEY, 'light');
        updateThemeIcon(true);
    }
}

function updateThemeIcon(isLight) {
    const btn = document.getElementById('theme-btn');
    if (btn) {
        // Light Mode -> Show Moon (to switch to Dark)
        // Dark Mode  -> Show Sun  (to switch to Light)
        btn.innerHTML = isLight ? '&#9790;' : '&#9728;';
    }
}

// ------------------------------------------------------------------
// Unified Settings Modal
// ------------------------------------------------------------------
function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    modal.style.display = 'flex';

    // Default tab
    switchTab('driver');
    renderDriverList();
    renderCheckerList();

    // Load GAS URL
    const savedUrl = localStorage.getItem(GAS_URL_KEY);
    if (savedUrl) {
        document.getElementById('gas-url-input').value = savedUrl;
    }
}

function closeSettingsModal() {
    document.getElementById('settings-modal').style.display = 'none';
    // Init Dropdowns again to reflect changes
    initDropdowns();
}

function switchTab(tabName) {
    // Buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Content
    document.querySelectorAll('.tab-content').forEach(content => {
        if (content.id === `tab-${tabName}`) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });
}

// ---- Render Lists ----
function renderDriverList() {
    renderListGeneric(DRIVER_LIST_KEY, 'driver-list-container', (idx) => deleteItem(DRIVER_LIST_KEY, idx, renderDriverList));
}

function renderCheckerList() {
    renderListGeneric(CHECKER_LIST_KEY, 'checker-list-container', (idx) => deleteItem(CHECKER_LIST_KEY, idx, renderCheckerList));
}

function renderListGeneric(storageKey, containerId, onDelete) {
    const listStr = localStorage.getItem(storageKey);
    const list = listStr ? JSON.parse(listStr) : [];

    const container = document.getElementById(containerId);
    container.innerHTML = '';

    list.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <span>${item}</span>
            <button class="btn-delete-item" title="削除">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        `;

        // Bind click
        div.querySelector('.btn-delete-item').addEventListener('click', () => onDelete(index));
        container.appendChild(div);
    });
}

// ---- Add/Delete Logic ----
function addItem(storageKey, inputId, renderFunc) {
    const input = document.getElementById(inputId);
    const val = input.value.trim();
    if (!val) return;

    let listStr = localStorage.getItem(storageKey);
    let list = listStr ? JSON.parse(listStr) : [];

    if (list.includes(val)) {
        alert('すでに登録されています');
        return;
    }

    list.push(val);
    localStorage.setItem(storageKey, JSON.stringify(list));
    renderFunc();
    input.value = '';
}

function deleteItem(storageKey, index, renderFunc) {
    if (!confirm('削除しますか？')) return;

    let listStr = localStorage.getItem(storageKey);
    let list = listStr ? JSON.parse(listStr) : [];

    list.splice(index, 1);
    localStorage.setItem(storageKey, JSON.stringify(list));
    renderFunc();
}

// ------------------------------------------------------------------
// Event Listeners
// ------------------------------------------------------------------
function setupEventListeners() {
    // Date change -> load data for that date or reset
    document.getElementById('report-date').addEventListener('change', (e) => {
        updateDayOfWeek();
        loadFromHistory(e.target.value);
    });

    // Theme Toggle
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }

    // Main Settings Button
    document.getElementById('btn-settings').addEventListener('click', openSettingsModal);

    // Modal Close
    document.getElementById('btn-close-modal').addEventListener('click', closeSettingsModal);
    document.getElementById('settings-modal').addEventListener('click', (e) => {
        if (e.target.id === 'settings-modal') closeSettingsModal();
    });

    // Tab Switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.getAttribute('data-tab'));
        });
    });

    // Driver Add
    document.getElementById('btn-add-driver').addEventListener('click', () => {
        addItem(DRIVER_LIST_KEY, 'input-add-driver', renderDriverList);
    });

    // Checker Add
    document.getElementById('btn-add-checker').addEventListener('click', () => {
        addItem(CHECKER_LIST_KEY, 'input-add-checker', renderCheckerList);
    });

    // GAS URL Auto Save
    document.getElementById('gas-url-input').addEventListener('input', (e) => {
        localStorage.setItem(GAS_URL_KEY, e.target.value);
    });

    // Save selection on change
    document.getElementById('driver-name').addEventListener('change', (e) => {
        localStorage.setItem(LAST_DRIVER_KEY, e.target.value);
    });
    document.getElementById('pre-checker').addEventListener('change', (e) => {
        localStorage.setItem(LAST_CHECKER_PRE_KEY, e.target.value);
    });
    document.getElementById('post-checker').addEventListener('change', (e) => {
        localStorage.setItem(LAST_CHECKER_POST_KEY, e.target.value);
    });

    // "Now" buttons
    document.querySelectorAll('.btn-now').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.target.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input) {
                const now = new Date();
                const hh = String(now.getHours()).padStart(2, '0');
                const mm = String(now.getMinutes()).padStart(2, '0');
                input.value = `${hh}:${mm}`;
            }
        });
    });

    // Row Toggle Buttons
    document.querySelectorAll('.btn-toggle-row').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = btn.getAttribute('data-target');
            const target = document.getElementById(targetId);
            if (target) {
                if (target.style.display === 'none') {
                    target.style.display = 'block';
                    btn.innerHTML = '&#9650; 閉じる';
                } else {
                    target.style.display = 'none';
                    btn.innerHTML = '&#9660; 開く';
                }
            }
        });
    });

    // Distance Calculation
    // IDs: start-meter-1..3, end-meter-1..3, calc-distance-1..3, calc-distance-total
    function calcDistance() {
        let total = 0;
        for (let i = 1; i <= 3; i++) {
            const start = parseFloat(document.getElementById(`start-meter-${i}`).value) || 0;
            const end = parseFloat(document.getElementById(`end-meter-${i}`).value) || 0;
            const dist = (end > start) ? (end - start) : 0;

            document.getElementById(`calc-distance-${i}`).textContent = dist.toFixed(1);
            total += dist;
        }
        document.getElementById('calc-distance-total').textContent = total.toFixed(1);
    }

    // Bind listeners for 1..3
    for (let i = 1; i <= 3; i++) {
        document.getElementById(`start-meter-${i}`).addEventListener('input', calcDistance);
        document.getElementById(`end-meter-${i}`).addEventListener('input', calcDistance);
    }

    // Alcohol Check Visibility
    document.querySelectorAll('input[name="pre-alcohol"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const valInput = document.getElementById('pre-alcohol-val');
            if (e.target.value === '有') {
                valInput.style.display = 'block';
            } else {
                valInput.style.display = 'none';
                valInput.value = '';
            }
        });
    });

    // Send Button
    document.getElementById('btn-send-gas').addEventListener('click', sendReport);

    // JSON Save Button
    const btnSaveJson = document.getElementById('btn-save-json');
    if (btnSaveJson) {
        btnSaveJson.addEventListener('click', saveJsonReport);
    }

    // Manual Temp Save Button
    const btnTempSave = document.getElementById('btn-temp-save');
    if (btnTempSave) {
        btnTempSave.addEventListener('click', manualSave);
    }

    // Reset Button
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            if (confirm('入力内容をリセットしますか？\n（日付・運転者名は保持されます）')) {
                resetForm();
                // Also clear history for this date? 
                // Resetting form visually is one thing, but if we don't clear history, it might come back on reload.
                // Requirement: "Input reset". Usually implies clearing data.
                // Let's clear the history for the current date too.
                const dateVal = document.getElementById('report-date').value;
                if (dateVal) {
                    let history = {};
                    try {
                        const json = localStorage.getItem(HISTORY_KEY);
                        if (json) history = JSON.parse(json);
                    } catch (e) { }

                    delete history[dateVal];
                    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
                }
                alert('リセットしました');
            }
        });
    }

    // Auto-Save listeners removed per user request.
    // Data is only saved when "Temporary Save" is clicked.
}

// ------------------------------------------------------------------
// History Save / Load
// ------------------------------------------------------------------
function saveToLocal() {
    // 1. Get current history
    let history = {};
    try {
        const json = localStorage.getItem(HISTORY_KEY);
        if (json) history = JSON.parse(json);
    } catch (e) { console.error('History parse error', e); }

    // 2. Add current data
    const data = collectReportData();
    if (!data.date) return; // Should not happen

    history[data.date] = data;

    // 3. Save back
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

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

// Load data for specific date, or reset if none
function loadFromLocal() {
    // Initial load: use current date value
    const dateEl = document.getElementById('report-date');
    if (dateEl && dateEl.value) {
        loadFromHistory(dateEl.value);
    }
}

function loadFromHistory(dateStr) {
    if (!dateStr) return;

    let history = {};
    try {
        const json = localStorage.getItem(HISTORY_KEY);
        if (json) history = JSON.parse(json);
    } catch (e) { console.error('History parse error', e); }

    const data = history[dateStr];

    if (data) {
        // Data exists -> Fill form
        console.log(`Loading data for ${dateStr}`);
        fillForm(data);
    } else {
        // No data -> Reset form
        console.log(`No data for ${dateStr}, resetting form`);
        resetForm();
    }
}

function fillForm(data) {
    // Helper to set value safely
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    setVal('driver-name', data.driver);

    // Pre-check
    setVal('pre-check-time', data.preCheckTime);
    setVal('pre-check-method', data.preCheckMethod);
    setVal('pre-checker', data.preChecker);
    setVal('pre-alcohol-val', data.preAlcoholVal);

    // Radio: Pre-Alcohol
    const preAlcoholRadios = document.querySelectorAll('input[name="pre-alcohol"]');
    preAlcoholRadios.forEach(r => r.checked = false);
    if (data.preAlcohol) {
        const r = document.querySelector(`input[name="pre-alcohol"][value="${data.preAlcohol}"]`);
        if (r) r.checked = true;
    }

    // Inspection: Pre-Inspection
    const preInspectRadios = document.querySelectorAll('input[name="pre-inspection"]');
    preInspectRadios.forEach(r => r.checked = false);
    if (data.preInspection) {
        const r = document.querySelector(`input[name="pre-inspection"][value="${data.preInspection}"]`);
        if (r) r.checked = true;
    }

    // Rows 1-3
    setVal('destination-1', data.destination1);
    setVal('start-time-1', data.startTime1);
    setVal('start-meter-1', data.startMeter1);
    setVal('end-time-1', data.endTime1);
    setVal('end-meter-1', data.endMeter1);

    setVal('destination-2', data.destination2);
    setVal('start-time-2', data.startTime2);
    setVal('start-meter-2', data.startMeter2);
    setVal('end-time-2', data.endTime2);
    setVal('end-meter-2', data.endMeter2);

    setVal('destination-3', data.destination3);
    setVal('start-time-3', data.startTime3);
    setVal('start-meter-3', data.startMeter3);
    setVal('end-time-3', data.endTime3);
    setVal('end-meter-3', data.endMeter3);

    toggleRowIfHasData(2, data);
    toggleRowIfHasData(3, data);

    // Re-calc distances
    ['start-meter-1', 'end-meter-1', 'start-meter-2', 'end-meter-2', 'start-meter-3', 'end-meter-3'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value) el.dispatchEvent(new Event('input'));
    });
    // Explicitly call calcDistance as fallback
    if (typeof calcDistance === 'function') calcDistance();

    // Post-check
    setVal('post-check-time', data.postCheckTime);
    setVal('post-check-method', data.postCheckMethod);
    setVal('post-checker', data.postChecker);

    const postAlcoholRadios = document.querySelectorAll('input[name="post-alcohol"]');
    postAlcoholRadios.forEach(r => r.checked = false);
    if (data.postAlcohol) {
        const r = document.querySelector(`input[name="post-alcohol"][value="${data.postAlcohol}"]`);
        if (r) r.checked = true;
    }

    // Others
    setVal('refuel-amount', data.refuelAmount);
    setVal('refuel-meter', data.refuelMeter);
    setVal('vehicle-return', data.vehicleReturn);
    setVal('notes', data.notes);

    // Trigger Pre-Alcohol change for visibility
    if (data.preAlcohol) {
        const r = document.querySelector(`input[name="pre-alcohol"][value="${data.preAlcohol}"]`);
        if (r) r.dispatchEvent(new Event('change'));
    }
}

function resetForm() {
    // Clear all inputs except Date
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };

    setVal('driver-name', '');

    setVal('pre-check-time', '');
    setVal('pre-check-method', '対面');
    setVal('pre-checker', '');
    setVal('pre-alcohol-val', '');
    document.querySelectorAll('input[name="pre-alcohol"]').forEach(r => r.checked = false);
    // Hide alcohol val input
    document.getElementById('pre-alcohol-val').style.display = 'none';

    document.querySelectorAll('input[name="pre-inspection"]').forEach(r => r.checked = false);

    // Rows
    for (let i = 1; i <= 3; i++) {
        setVal(`destination-${i}`, '');
        setVal(`start-time-${i}`, '');
        setVal(`start-meter-${i}`, '');
        setVal(`end-time-${i}`, '');
        setVal(`end-meter-${i}`, '');
        const distSpan = document.getElementById(`calc-distance-${i}`);
        if (distSpan) distSpan.textContent = '0';

        // Collapse 2 and 3
        if (i > 1) {
            const body = document.getElementById(`row-${i}-body`);
            const btn = document.querySelector(`.btn-toggle-row[data-target="row-${i}-body"]`);
            if (body) body.style.display = 'none';
            if (btn) btn.innerHTML = '&#9660; 開く';
        }
    }
    const totalSpan = document.getElementById('calc-distance-total');
    if (totalSpan) totalSpan.textContent = '0';

    setVal('post-check-time', '');
    setVal('post-check-method', '対面');
    setVal('post-checker', '');
    document.querySelectorAll('input[name="post-alcohol"]').forEach(r => r.checked = false);

    setVal('refuel-amount', '');
    setVal('refuel-meter', '');
    setVal('vehicle-return', '');
    setVal('notes', '');
}

function toggleRowIfHasData(rowNum, data) {
    const hasData = data[`destination${rowNum}`] || data[`startTime${rowNum}`] || data[`startMeter${rowNum}`];
    const body = document.getElementById(`row-${rowNum}-body`);
    const btn = document.querySelector(`.btn-toggle-row[data-target="row-${rowNum}-body"]`);

    if (hasData) {
        if (body) body.style.display = 'block';
        if (btn) btn.innerHTML = '&#9650; 閉じる';
    } else {
        if (body) body.style.display = 'none';
        if (btn) btn.innerHTML = '&#9660; 開く';
    }
}

function collectReportData() {
    return {
        date: document.getElementById('report-date').value,
        driver: document.getElementById('driver-name').value, // Select value

        // 1. Pre-check
        preCheckTime: document.getElementById('pre-check-time').value,
        preCheckMethod: document.getElementById('pre-check-method').value,
        preChecker: document.getElementById('pre-checker').value, // Select value
        preAlcohol: document.querySelector('input[name="pre-alcohol"]:checked')?.value || '',
        preAlcoholVal: document.getElementById('pre-alcohol-val').value,

        // 2. Drive Info (3 Rows)
        destination1: document.getElementById('destination-1').value,
        startTime1: document.getElementById('start-time-1').value,
        startMeter1: document.getElementById('start-meter-1').value,
        endTime1: document.getElementById('end-time-1').value,
        endMeter1: document.getElementById('end-meter-1').value,
        distance1: document.getElementById('calc-distance-1').textContent,

        destination2: document.getElementById('destination-2').value,
        startTime2: document.getElementById('start-time-2').value,
        startMeter2: document.getElementById('start-meter-2').value,
        endTime2: document.getElementById('end-time-2').value,
        endMeter2: document.getElementById('end-meter-2').value,
        distance2: document.getElementById('calc-distance-2').textContent,

        destination3: document.getElementById('destination-3').value,
        startTime3: document.getElementById('start-time-3').value,
        startMeter3: document.getElementById('start-meter-3').value,
        endTime3: document.getElementById('end-time-3').value,
        endMeter3: document.getElementById('end-meter-3').value,
        distance3: document.getElementById('calc-distance-3').textContent,

        totalDistance: document.getElementById('calc-distance-total').textContent,

        // 3. Others
        preInspection: document.querySelector('input[name="pre-inspection"]:checked')?.value || '',

        // Post-check
        postCheckTime: document.getElementById('post-check-time').value,
        postCheckMethod: document.getElementById('post-check-method').value,
        postChecker: document.getElementById('post-checker').value, // Select value
        postAlcohol: document.querySelector('input[name="post-alcohol"]:checked')?.value || '',

        // Others
        refuelAmount: document.getElementById('refuel-amount').value,
        refuelMeter: document.getElementById('refuel-meter').value,
        vehicleReturn: document.getElementById('vehicle-return').value,
        notes: document.getElementById('notes').value
    };
}

function saveJsonReport() {
    const data = collectReportData();
    const fileName = `driving_report_${data.date}_${data.driver}.json`;
    const jsonStr = JSON.stringify(data, null, 2);

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function sendReport() {
    // Read from the new input in modal
    const url = document.getElementById('gas-url-input').value;
    const statusMsg = document.getElementById('status-msg');

    if (!url) {
        statusMsg.textContent = 'GASのURLが設定されていません (設定メニューから入力してください)';
        statusMsg.className = 'status-msg status-error';
        return;
    }

    // Collect Data
    const data = collectReportData();

    // Validation (Simple)
    if (!data.date || !data.driver) {
        statusMsg.textContent = '日付と運転者名は必須です';
        statusMsg.className = 'status-msg status-error';
        return;
    }

    statusMsg.textContent = '送信中...';
    statusMsg.className = 'status-msg';

    try {
        // GASのCORS制約を回避するため、Content-Typeを text/plain に設定します。
        // application/json を指定するとブラウザがプリフライトリクエスト(OPTIONS)を送りますが、
        // GASはこれをハンドルできないため "Failed to fetch" エラーになります。
        // text/plain で送っても、GAS側で JSON.parse(e.postData.contents) を行えば問題なく動作します。

        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // GASはリダイレクト等の影響でJSONではなく文字列（"成功"など）を返す場合があります。
        // 強固にするため、テキストとして受け取ってからJSONパースを試みます。
        const responseText = await response.text();
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            // JSONでなかった場合、文字列に "成功" や "success" が含まれていれば成功とみなす
            if (responseText.includes('成功') || responseText.includes('success')) {
                result = { status: 'success' };
            } else {
                throw new Error('サーバーからの応答が解析できませんでした: ' + responseText);
            }
        }

        if (result.status === 'success') {
            statusMsg.textContent = '送信しました！';
            statusMsg.className = 'status-msg status-success';
        } else {
            throw new Error(result.message || 'Unknown error from server');
        }

    } catch (e) {
        console.error(e);
        statusMsg.textContent = '送信に失敗しました: ' + e.message;
        statusMsg.className = 'status-msg status-error';
    }
}
