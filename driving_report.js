
const GAS_URL_KEY = 'driving_report_gas_url';
const THEME_KEY = 'attendance_theme';
const DRIVER_LIST_KEY = 'driving_report_driver_list';
const CHECKER_LIST_KEY = 'driving_report_checker_list';
const LAST_DRIVER_KEY = 'driving_report_last_driver';
const LAST_CHECKER_PRE_KEY = 'driving_report_last_checker_pre';
const LAST_CHECKER_POST_KEY = 'driving_report_last_checker_post';

const DEFAULT_DRIVERS = ['運転者A', '運転者B'];
const DEFAULT_CHECKERS = ['管理者A', '管理者B'];

document.addEventListener('DOMContentLoaded', () => {
    initDate();
    loadSettings();
    initDropdowns(); // Load lists
    initTheme(); // Initialize Theme
    setupEventListeners();
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
    // Date change -> update day of week
    document.getElementById('report-date').addEventListener('change', updateDayOfWeek);

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
    const data = {
        date: document.getElementById('report-date').value,
        driver: document.getElementById('driver-name').value, // Select value

        // 1. Pre-check
        preCheckTime: document.getElementById('pre-check-time').value,
        preCheckMethod: document.getElementById('pre-check-method').value,
        preChecker: document.getElementById('pre-checker').value, // Select value
        preAlcohol: document.querySelector('input[name="pre-alcohol"]:checked')?.value || '',
        preAlcoholVal: document.getElementById('pre-alcohol-val').value,

        // 2. Drive Info
        // 2. Drive Info (3 Rows)
        // We will flatten these fields for GAS convenience
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

        // 3. Others (Move inspection to Pre-check in logic if needed, but here simple JSON)
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

    // Validation (Simple)
    if (!data.date || !data.driver) {
        statusMsg.textContent = '日付と運転者名は必須です';
        statusMsg.className = 'status-msg status-error';
        return;
    }

    statusMsg.textContent = '送信中...';
    statusMsg.className = 'status-msg';

    try {
        // Note: GAS Web App needs `mode: 'no-cors'` for simple POSTs usually, 
        // but 'no-cors' prevents reading response. 
        // We assume the user implements standard `doPost` returning JSON.
        // Modern approach: `fetch(url, { method: 'POST', body: JSON.stringify(data) })`
        // However, GAS often has CORS issues. 
        // Best practice for simple send:

        const formData = new FormData();
        for (const key in data) {
            formData.append(key, data[key]);
        }

        await fetch(url, {
            method: 'POST',
            body: JSON.stringify(data),
            mode: 'no-cors', // Important for GAS if not properly handling OPTIONS
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Since 'no-cors' returns opaque response, we assume success if no network error.
        // Ideally user sets CORs headers in GAS, but 'no-cors' is safest default for simple fire-and-forget.

        statusMsg.textContent = '送信しました！';
        statusMsg.className = 'status-msg status-success';

        // Optional: Clear form?
        // document.location.reload(); 

    } catch (e) {
        console.error(e);
        statusMsg.textContent = '送信に失敗しました: ' + e.message;
        statusMsg.className = 'status-msg status-error';
    }
}
