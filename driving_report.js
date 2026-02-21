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

const DEFAULT_DRIVERS = ['(設定から名前を追加してください)'];
const DEFAULT_VEHICLES = ['(設定から車両名を追加してください)'];
const DEFAULT_CHECKERS = ['(設定から確認者名を追加してください)'];

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
    const savedPass = localStorage.getItem(PASSCODE_KEY);
    if (savedPass) {
        const input = document.getElementById('sys-passcode-input');
        if (input) input.value = savedPass;
    }
}

function initDropdowns() {
    // Drivers (for 3 rows)
    updateDropdownOptions(DRIVER_LIST_KEY, ['driver-name-1', 'driver-name-2', 'driver-name-3'], DEFAULT_DRIVERS);
    const lastDriver = localStorage.getItem(LAST_DRIVER_KEY);
    if (lastDriver) {
        document.getElementById('driver-name-1').value = lastDriver;
    }

    // Vehicles
    updateDropdownOptions(VEHICLE_LIST_KEY, ['vehicle-id'], DEFAULT_VEHICLES);
    const urlParams = new URLSearchParams(window.location.search);
    const urlVehicle = urlParams.get('vehicle');

    if (urlVehicle) {
        // If passed via URL (QR Code), prioritize it and save as last used
        document.getElementById('vehicle-id').value = urlVehicle;
        localStorage.setItem(LAST_VEHICLE_KEY, urlVehicle);
    } else {
        // Fallback to local storage
        const lastVehicle = localStorage.getItem(LAST_VEHICLE_KEY);
        if (lastVehicle) {
            document.getElementById('vehicle-id').value = lastVehicle;
        }
    }

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
        try {
            list = JSON.parse(listStr);
        } catch (e) {
            console.error('JSON parse error', e);
        }
    }

    // If list is null, undefined, or empty, fallback to defaults
    if (!list || list.length === 0) {
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
    renderVehicleList();

    // Load GAS URL and Passcode
    const savedUrl = localStorage.getItem(GAS_URL_KEY);
    if (savedUrl) {
        document.getElementById('gas-url-input').value = savedUrl;
    }
    const savedPass = localStorage.getItem(PASSCODE_KEY);
    if (savedPass) {
        document.getElementById('sys-passcode-input').value = savedPass;
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

function renderVehicleList() {
    renderListGeneric(VEHICLE_LIST_KEY, 'vehicle-list-container', (idx) => deleteItem(VEHICLE_LIST_KEY, idx, renderVehicleList));
}

function renderListGeneric(storageKey, containerId, onDelete) {
    const listStr = localStorage.getItem(storageKey);
    const list = listStr ? JSON.parse(listStr) : [];

    const container = document.getElementById(containerId);
    container.innerHTML = '';

    list.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'list-item';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = item;
        div.appendChild(nameSpan);

        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '4px';

        if (storageKey === VEHICLE_LIST_KEY) {
            const qrBtn = document.createElement('button');
            qrBtn.className = 'btn-qr-item';
            qrBtn.title = 'QRコードを表示';
            qrBtn.setAttribute('data-name', item);
            qrBtn.textContent = 'QR';
            qrBtn.addEventListener('click', () => showQRModal(item));
            btnContainer.appendChild(qrBtn);
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete-item';
        deleteBtn.title = '削除';
        deleteBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        `;
        deleteBtn.addEventListener('click', () => onDelete(index));
        btnContainer.appendChild(deleteBtn);

        div.appendChild(btnContainer);

        container.appendChild(div);
    });
}

function showQRModal(vehicleName) {
    const modal = document.getElementById('qr-modal');
    const qrContainer = document.getElementById('qr-code-container');
    const urlDisplay = document.getElementById('qr-url-display');
    const vehicleNameDisplay = document.getElementById('qr-vehicle-name');

    // Generate URL
    const baseUrl = window.location.origin + window.location.pathname;
    const targetUrl = `${baseUrl}?vehicle=${encodeURIComponent(vehicleName)}`;

    // Clear previous QR code
    qrContainer.innerHTML = '';

    // Generate new QR Code
    new QRCode(qrContainer, {
        text: targetUrl,
        width: 160,
        height: 160,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
    });

    urlDisplay.value = targetUrl;
    vehicleNameDisplay.textContent = vehicleName;
    modal.style.display = 'flex';
}

function printQRCode() {
    const qrContainer = document.getElementById('qr-code-container');
    const vehicleName = document.getElementById('qr-vehicle-name').textContent;
    const qrImg = qrContainer.querySelector('img');

    if (!qrImg) {
        alert('QRコードが生成されていません');
        return;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>QR Code Print - ${vehicleName}</title>
            <style>
                body {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    font-family: sans-serif;
                }
                .container {
                    text-align: center;
                    border: 2px solid #ccc;
                    padding: 40px;
                    border-radius: 20px;
                }
                h1 { margin-bottom: 20px; font-size: 24px; }
                img { width: 300px; height: 300px; }
                .footer { margin-top: 20px; color: #666; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>${vehicleName}</h1>
                <img src="${qrImg.src}" />
                <div class="footer">運行日報 車両用QRコード</div>
            </div>
            <script>
                window.onload = () => {
                    window.print();
                    window.onafterprint = () => window.close();
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// ------------------------------------------------------------------
// Custom Confirmation Modal
// ------------------------------------------------------------------
let currentConfirmResolve = null;

function showActionConfirm(options) {
    const { title, message, btnText, btnColor } = options;
    const modal = document.getElementById('action-confirm-modal');
    const titleEl = document.getElementById('action-confirm-title');
    const msgEl = document.getElementById('action-confirm-message');
    const executeBtn = document.getElementById('btn-action-execute');

    titleEl.textContent = title || '確認';
    msgEl.textContent = message || '実行しますか？';
    executeBtn.textContent = btnText || '実行';
    executeBtn.style.background = btnColor || ''; // Reset or set

    modal.style.display = 'flex';

    return new Promise((resolve) => {
        currentConfirmResolve = resolve;
    });
}

function closeActionConfirm(result) {
    document.getElementById('action-confirm-modal').style.display = 'none';
    if (currentConfirmResolve) {
        currentConfirmResolve(result);
        currentConfirmResolve = null;
    }
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

async function deleteItem(storageKey, index, renderFunc) {
    const confirmed = await showActionConfirm({
        title: '項目の削除',
        message: 'この項目を削除してもよろしいですか？',
        btnText: '削除',
        btnColor: '#ef4444' // Red for delete
    });

    if (!confirmed) return;

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

    document.getElementById('qr-modal').addEventListener('click', (e) => {
        if (e.target.id === 'qr-modal') document.getElementById('qr-modal').style.display = 'none';
    });

    // Action Confirm Modal
    document.getElementById('btn-action-cancel').addEventListener('click', () => closeActionConfirm(false));
    document.getElementById('btn-action-execute').addEventListener('click', () => closeActionConfirm(true));
    document.getElementById('action-confirm-modal').addEventListener('click', (e) => {
        if (e.target.id === 'action-confirm-modal') closeActionConfirm(false);
    });

    document.getElementById('btn-print-qr').addEventListener('click', printQRCode);

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

    // Vehicle Add
    const btnAddVehicle = document.getElementById('btn-add-vehicle');
    if (btnAddVehicle) {
        btnAddVehicle.addEventListener('click', () => {
            addItem(VEHICLE_LIST_KEY, 'input-add-vehicle', renderVehicleList);
        });
    }

    // GAS URL Auto Save
    document.getElementById('gas-url-input').addEventListener('input', (e) => {
        localStorage.setItem(GAS_URL_KEY, e.target.value);
    });

    // Passcode Auto Save
    const passInput = document.getElementById('sys-passcode-input');
    if (passInput) {
        passInput.addEventListener('input', (e) => {
            localStorage.setItem(PASSCODE_KEY, e.target.value);
        });
    }

    // JSON Save (Developer Tool)
    const btnSaveJson = document.getElementById('btn-save-json');
    if (btnSaveJson) {
        btnSaveJson.addEventListener('click', saveJsonReport);
    }

    // Save selection on change (track driver 1 as the last used)
    const driverSelect1 = document.getElementById('driver-name-1');
    if (driverSelect1) {
        driverSelect1.addEventListener('change', (e) => {
            localStorage.setItem(LAST_DRIVER_KEY, e.target.value);
        });
    }
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

    // Reset Button (Unified Popup)
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
        btnReset.addEventListener('click', async () => {
            const confirmed = await showActionConfirm({
                title: '入力内容のリセット',
                message: '現在入力中の内容をすべて消去してもよろしいですか？（送信済みのデータは消えません）',
                btnText: 'リセット',
                btnColor: '#ef4444'
            });
            if (confirmed) {
                resetForm();
            }
        });
    }

    // JSON Save Button and Temp Save Button Removed.

    // Auto-Save listeners
    // Periodically save to local storage if the modal is not open
    setInterval(() => {
        const modal = document.getElementById('settings-modal');
        if (modal && modal.style.display !== 'flex') {
            saveToLocal(); // Auto-save in the background
        }
    }, 5000); // 5 seconds
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

    // Main
    setVal('vehicle-id', data.vehicleId);

    // Drivers
    setVal('driver-name-1', data.driver1);
    setVal('driver-name-2', data.driver2);
    setVal('driver-name-3', data.driver3);

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

    setVal('destination-1', data.destination1);
    setVal('start-time-1', data.startTime1);
    setVal('start-meter-1', data.startMeter1);
    const preInsp1Radios = document.querySelectorAll('input[name="pre-inspection-1"]');
    preInsp1Radios.forEach(r => r.checked = false);
    if (data.preInspection1) {
        const r = document.querySelector(`input[name="pre-inspection-1"][value="${data.preInspection1}"]`);
        if (r) r.checked = true;
    }
    setVal('end-time-1', data.endTime1);
    setVal('end-meter-1', data.endMeter1);
    setVal('vehicle-return-1', data.vehicleReturn1);

    setVal('destination-2', data.destination2);
    setVal('start-time-2', data.startTime2);
    setVal('start-meter-2', data.startMeter2);
    const preInsp2Radios = document.querySelectorAll('input[name="pre-inspection-2"]');
    preInsp2Radios.forEach(r => r.checked = false);
    if (data.preInspection2) {
        const r = document.querySelector(`input[name="pre-inspection-2"][value="${data.preInspection2}"]`);
        if (r) r.checked = true;
    }
    setVal('end-time-2', data.endTime2);
    setVal('end-meter-2', data.endMeter2);
    setVal('vehicle-return-2', data.vehicleReturn2);

    setVal('destination-3', data.destination3);
    setVal('start-time-3', data.startTime3);
    setVal('start-meter-3', data.startMeter3);
    const preInsp3Radios = document.querySelectorAll('input[name="pre-inspection-3"]');
    preInsp3Radios.forEach(r => r.checked = false);
    if (data.preInspection3) {
        const r = document.querySelector(`input[name="pre-inspection-3"][value="${data.preInspection3}"]`);
        if (r) r.checked = true;
    }
    setVal('end-time-3', data.endTime3);
    setVal('end-meter-3', data.endMeter3);
    setVal('vehicle-return-3', data.vehicleReturn3);

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

    setVal('vehicle-id', '');
    setVal('pre-check-time', '');
    setVal('pre-check-method', '対面');
    setVal('pre-checker', '');
    setVal('pre-alcohol-val', '');
    document.querySelectorAll('input[name="pre-alcohol"]').forEach(r => r.checked = false);
    // Hide alcohol val input
    document.getElementById('pre-alcohol-val').style.display = 'none';


    // Rows
    for (let i = 1; i <= 3; i++) {
        setVal(`driver-name-${i}`, '');
        setVal(`destination-${i}`, '');
        setVal(`start-time-${i}`, '');
        setVal(`start-meter-${i}`, '');
        document.querySelectorAll(`input[name="pre-inspection-${i}"]`).forEach(r => r.checked = false);
        setVal(`end-time-${i}`, '');
        setVal(`end-meter-${i}`, '');
        setVal(`vehicle-return-${i}`, '');
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
    setVal('notes', '');
}

function toggleRowIfHasData(rowNum, data) {
    const hasData = data[`driver${rowNum}`] || data[`destination${rowNum}`] || data[`startTime${rowNum}`] || data[`startMeter${rowNum}`];
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
        vehicleId: document.getElementById('vehicle-id').value, // New vehicle select

        // 1. Pre-check
        preCheckTime: document.getElementById('pre-check-time').value,
        preCheckMethod: document.getElementById('pre-check-method').value,
        preChecker: document.getElementById('pre-checker').value, // Select value
        preAlcohol: document.querySelector('input[name="pre-alcohol"]:checked')?.value || '',
        preAlcoholVal: document.getElementById('pre-alcohol-val').value,

        // 2. Drive Info (3 Rows)
        driver1: document.getElementById('driver-name-1').value,
        destination1: document.getElementById('destination-1').value,
        startTime1: document.getElementById('start-time-1').value,
        startMeter1: document.getElementById('start-meter-1').value,
        preInspection1: document.querySelector('input[name="pre-inspection-1"]:checked')?.value || '',
        endTime1: document.getElementById('end-time-1').value,
        endMeter1: document.getElementById('end-meter-1').value,
        distance1: document.getElementById('calc-distance-1').textContent,
        vehicleReturn1: document.getElementById('vehicle-return-1').value,

        driver2: document.getElementById('driver-name-2').value,
        destination2: document.getElementById('destination-2').value,
        startTime2: document.getElementById('start-time-2').value,
        startMeter2: document.getElementById('start-meter-2').value,
        preInspection2: document.querySelector('input[name="pre-inspection-2"]:checked')?.value || '',
        endTime2: document.getElementById('end-time-2').value,
        endMeter2: document.getElementById('end-meter-2').value,
        distance2: document.getElementById('calc-distance-2').textContent,
        vehicleReturn2: document.getElementById('vehicle-return-2').value,

        driver3: document.getElementById('driver-name-3').value,
        destination3: document.getElementById('destination-3').value,
        startTime3: document.getElementById('start-time-3').value,
        startMeter3: document.getElementById('start-meter-3').value,
        preInspection3: document.querySelector('input[name="pre-inspection-3"]:checked')?.value || '',
        endTime3: document.getElementById('end-time-3').value,
        endMeter3: document.getElementById('end-meter-3').value,
        distance3: document.getElementById('calc-distance-3').textContent,
        vehicleReturn3: document.getElementById('vehicle-return-3').value,

        totalDistance: document.getElementById('calc-distance-total').textContent,
        isOver400km: parseFloat(document.getElementById('calc-distance-total').textContent || '0') > 400,

        // Post-check
        postCheckTime: document.getElementById('post-check-time').value,
        postCheckMethod: document.getElementById('post-check-method').value,
        postChecker: document.getElementById('post-checker').value, // Select value
        postAlcohol: document.querySelector('input[name="post-alcohol"]:checked')?.value || '',

        // Others
        refuelAmount: document.getElementById('refuel-amount').value,
        refuelMeter: document.getElementById('refuel-meter').value,
        notes: document.getElementById('notes').value,

        // Security
        passcode: document.getElementById('sys-passcode-input').value
    };
}

function saveJsonReport() {
    const data = collectReportData();
    const fileName = `driving_report_${data.date}_${data.driver1 || '未選択'}.json`;
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

    if (!url.startsWith('https://')) {
        statusMsg.textContent = 'セキュリティ保護のため、https:// で始まるURLのみ送信可能です';
        statusMsg.className = 'status-msg status-error';
        return;
    }

    // Collect Data
    const data = collectReportData();

    // Validation (Simple)
    if (!data.date || !data.vehicleId || !data.driver1) {
        statusMsg.textContent = '日付、車両、記録1の運転者名は必須です';
        statusMsg.className = 'status-msg status-error';
        return;
    }

    if (!document.getElementById('sys-passcode-input').value) {
        statusMsg.textContent = '送信パスコードが設定されていません (設定画面右上の歯車ボタンから入力してください)';
        statusMsg.className = 'status-msg status-error';
        return;
    }

    statusMsg.textContent = '送信中...';
    statusMsg.className = 'status-msg';

    // エラーログエリアを一旦隠す
    const logContainer = document.getElementById('error-log-container');
    const logArea = document.getElementById('error-log');
    if (logContainer) logContainer.style.display = 'none';
    if (logArea) logArea.value = '';

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
            throw new Error(`サーバーエラー: ${result.message || 'Unknown error'}`);
        }

    } catch (e) {
        console.error(e);
        statusMsg.textContent = '送信に失敗しました (詳細はログを確認)';
        statusMsg.className = 'status-msg status-error';

        // ログエリアを表示して詳細を出力
        const logContainer = document.getElementById('error-log-container');
        const logArea = document.getElementById('error-log');
        if (logContainer && logArea) {
            logContainer.style.display = 'block';
            const timestamp = new Date().toISOString();
            logArea.value = `[${timestamp}]\nエラーの種類: ${e.name}\nエラーメッセージ: ${e.message}\n\n送信先URL:\n${url}\n\n送信データ:\n${JSON.stringify(data, null, 2)}`;
        }
    }
}
