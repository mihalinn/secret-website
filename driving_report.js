
const GAS_URL_KEY = 'driving_report_gas_url';
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
    // Load GAS URL
    const savedUrl = localStorage.getItem(GAS_URL_KEY);
    if (savedUrl) {
        document.getElementById('gas-url').value = savedUrl;
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

function editList(storageKey, elementIds, title) {
    let listStr = localStorage.getItem(storageKey);
    let list = listStr ? JSON.parse(listStr) : [];

    const input = prompt(`${title}を設定します。\n名前をカンマ(,)区切りで入力してください。`, list.join(','));

    if (input !== null) {
        // Split, trim, filter empty
        const newList = input.split(',').map(s => s.trim()).filter(s => s);
        localStorage.setItem(storageKey, JSON.stringify(newList));
        updateDropdownOptions(storageKey, elementIds, newList);
    }
}

function setupEventListeners() {
    // Date change -> update day of week
    document.getElementById('report-date').addEventListener('change', updateDayOfWeek);

    // Edit Drivers
    document.getElementById('btn-edit-drivers').addEventListener('click', () => {
        editList(DRIVER_LIST_KEY, ['driver-name'], '運転者リスト');
    });

    // Edit Checkers
    document.getElementById('btn-edit-checkers').addEventListener('click', () => {
        editList(CHECKER_LIST_KEY, ['pre-checker', 'post-checker'], '確認者リスト');
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

    // Distance Calculation
    const startMeter = document.getElementById('start-meter');
    const endMeter = document.getElementById('end-meter');
    const calcLabel = document.getElementById('calc-distance');

    function calcDistance() {
        const start = parseFloat(startMeter.value) || 0;
        const end = parseFloat(endMeter.value) || 0;
        if (end > start) {
            calcLabel.textContent = (end - start).toFixed(1);
        } else {
            calcLabel.textContent = '0';
        }
    }

    startMeter.addEventListener('input', calcDistance);
    endMeter.addEventListener('input', calcDistance);

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

    // Save URL Button
    document.getElementById('btn-save-url').addEventListener('click', () => {
        const url = document.getElementById('gas-url').value;
        if (url) {
            localStorage.setItem(GAS_URL_KEY, url);
            alert('URLを保存しました');
        }
    });

    // Send Button
    document.getElementById('btn-send-gas').addEventListener('click', sendReport);
}

async function sendReport() {
    const url = document.getElementById('gas-url').value;
    const statusMsg = document.getElementById('status-msg');

    if (!url) {
        statusMsg.textContent = 'GASのURLが設定されていません';
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
        destination: document.getElementById('destination').value,
        startTime: document.getElementById('start-time').value,
        startMeter: document.getElementById('start-meter').value,
        endTime: document.getElementById('end-time').value,
        endMeter: document.getElementById('end-meter').value,
        distance: document.getElementById('calc-distance').textContent,

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
