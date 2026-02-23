/**
 * driving_report_settings.js
 * 設定モーダル、リスト管理、マスタデータ読み込み
 */

/**
 * 設定画面の初期化
 */
function loadSettings() {
    const gasUrl = localStorage.getItem(GAS_URL_KEY);
    if (gasUrl) {
        document.getElementById('gas-url-input').value = gasUrl;
    }
    const passcode = localStorage.getItem(PASSCODE_KEY);
    if (passcode) {
        document.getElementById('sys-passcode-input').value = passcode;
    }
}

/**
 * ドロップダウンの初期化
 */
function initDropdowns() {
    updateDropdownOptions(DRIVER_LIST_KEY, ['driver-name-1', 'driver-name-2', 'driver-name-3'], DEFAULT_DRIVERS);
    updateVehicleDropdowns(); // 車両はニックネーム対応の専用関数
    updateDropdownOptions(CHECKER_LIST_KEY, ['pre-checker', 'post-checker'], DEFAULT_CHECKERS);
    initDefaultSelects(); // デフォルト設定セレクトの初期化
}

/**
 * クラウド同期用セレクター（年・月）の初期化
 */
function initCloudSelectors() {
    const yearSelect = document.getElementById('cloud-year-select');
    const monthSelect = document.getElementById('cloud-month-select');
    if (!yearSelect || !monthSelect) return;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // 年: 今年、去年、一昨年
    yearSelect.innerHTML = '';
    for (let y = currentYear; y >= currentYear - 2; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y + '年';
        yearSelect.appendChild(opt);
    }

    // 月: 1-12
    monthSelect.innerHTML = '';
    for (let m = 1; m <= 12; m++) {
        const opt = document.createElement('option');
        opt.value = String(m).padStart(2, '0');
        opt.textContent = m + '月';
        if (m === currentMonth) opt.selected = true;
        monthSelect.appendChild(opt);
    }
}

/**
 * 設定モーダルを開く
 */
function openSettingsModal() {
    renderDriverList();
    renderVehicleList();
    renderCheckerList();
    const modal = document.getElementById('settings-modal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    switchTab('driver');
}

/**
 * 設定モーダルを閉じる
 */
function closeSettingsModal() {
    document.getElementById('settings-modal').style.display = 'none';
    document.body.style.overflow = '';
    initDropdowns(); // 変更を反映
}

/**
 * タブ切り替え
 */
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"], .tab-btn[onclick*="switchTab('${tabName}')"]`);
    if (btn) btn.classList.add('active');

    const content = document.getElementById(`tab-${tabName}`);
    if (content) content.classList.add('active');
}
window.switchTab = switchTab;

/**
 * 各種リストの描画
 */
function renderDriverList() { renderListGeneric(DRIVER_LIST_KEY, 'driver-list-container', renderDriverList); }
function renderCheckerList() { renderListGeneric(CHECKER_LIST_KEY, 'checker-list-container', renderCheckerList); }
function renderVehicleList() {
    const container = document.getElementById('vehicle-list-container');
    if (!container) return;

    const items = getVehicleList();
    container.innerHTML = '';

    items.forEach((v, index) => {
        const div = document.createElement('div');
        div.className = 'list-item';

        const deleteIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
        const qrIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`;
        const editIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;

        const displayName = v.nickname ? `<strong>${v.nickname}</strong> <span style="opacity:0.6;font-size:0.8em">${v.plate}</span>` : `<span>${v.plate}</span>`;
        const qrTarget = v.plate || v.nickname;
        const actionsHtml = `<button class="btn-edit-small" onclick="editVehicle(${index})" title="編集">${editIcon}</button><button class="btn-qr-small" onclick="showQRModal('${qrTarget}')" title="QR">${qrIcon}</button><button class="btn-delete" onclick="deleteItem('${VEHICLE_LIST_KEY}', ${index}, window.renderVehicleList)" title="削除">${deleteIcon}</button>`;

        div.innerHTML = `<span>${displayName}</span><div class="item-actions">${actionsHtml}</div>`;
        container.appendChild(div);
    });

    updateVehicleDropdowns();
}

function renderListGeneric(storageKey, containerId, onDelete) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let items = [];
    try {
        const json = localStorage.getItem(storageKey);
        if (json) items = JSON.parse(json);
    } catch (e) { console.error('Parse error', e); }

    container.innerHTML = '';
    items.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'list-item';

        const deleteIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
        const qrIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><line x1="7" y1="7" x2="7" y2="7"></line><line x1="17" y1="7" x2="17" y2="7"></line><line x1="17" y1="17" x2="17" y2="17"></line><line x1="7" y1="17" x2="7" y2="17"></line></svg>`;

        let actionsHtml = `<button class="btn-delete" onclick="deleteItem('${storageKey}', ${index}, window.${onDelete.name})" title="削除">${deleteIcon}</button>`;
        if (storageKey === VEHICLE_LIST_KEY) {
            actionsHtml = `<button class="btn-qr-small" onclick="showQRModal('${item}')" title="QR">${qrIcon}</button>` + actionsHtml;
        }

        div.innerHTML = `<span>${item}</span><div class="item-actions">${actionsHtml}</div>`;
        container.appendChild(div);
    });
}

/**
 * アイテム追加
 */
function addItem(storageKey, inputId, renderFunc) {
    const input = document.getElementById(inputId);
    if (!input || !input.value.trim()) return;

    let items = [];
    try {
        const json = localStorage.getItem(storageKey);
        if (json) items = JSON.parse(json);
    } catch (e) { }

    items.push(input.value.trim());
    try {
        localStorage.setItem(storageKey, JSON.stringify(items));
    } catch (e) {
        alert('リストの保存に失敗しました。ブラウザのストレージ容量が不足している可能性があります。');
        console.error('Storage full?', e);
    }
    input.value = '';
    renderFunc();
}

/**
 * アイテム削除
 */
async function deleteItem(storageKey, index, renderFunc) {
    const confirmed = await showActionConfirm({
        title: '削除の確認',
        message: 'この項目を削除してもよろしいですか？',
        btnText: '削除',
        btnColor: '#f87171'
    });
    if (!confirmed) return;

    let items = [];
    try {
        const json = localStorage.getItem(storageKey);
        if (json) items = JSON.parse(json);
    } catch (e) { }

    items.splice(index, 1);
    try {
        localStorage.setItem(storageKey, JSON.stringify(items));
    } catch (e) { console.error('Storage error during delete', e); }
    renderFunc();
}

/**
 * ドロップダウンのオプション更新
 */
function updateDropdownOptions(storageKey, elementIds, defaultList) {
    let items = [];
    try {
        const json = localStorage.getItem(storageKey);
        if (json) items = JSON.parse(json);
    } catch (e) { }

    if (items.length === 0) items = defaultList;

    elementIds.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;

        const currentVal = select.value;
        select.innerHTML = '';

        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '-- 選択してください --';
        select.appendChild(emptyOpt);

        items.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item;
            opt.textContent = item;
            select.appendChild(opt);
        });

        if (Array.from(select.options).some(o => o.value === currentVal)) {
            select.value = currentVal;
        }
    });
}

/**
 * QRコード表示モーダル
 */
function showQRModal(vehicleName) {
    const modal = document.getElementById('qr-modal');
    const title = document.getElementById('qr-vehicle-name');
    const container = document.getElementById('qr-code-container');
    const urlDisplay = document.getElementById('qr-url-display');

    if (title) title.textContent = vehicleName;
    container.innerHTML = '';

    const qrUrl = `${window.location.origin}${window.location.pathname}?vehicle=${encodeURIComponent(vehicleName)}`;
    if (urlDisplay) urlDisplay.value = qrUrl;

    console.log('[QR] Generating URL (length:', qrUrl.length, '):', qrUrl);

    try {
        new QRCode(container, {
            text: qrUrl,
            width: 256,
            height: 256,
            correctLevel: QRCode.CorrectLevel.L // 容量を最大化するためにLに設定
        });
    } catch (e) {
        console.error('[QR] Error generating QR code:', e);
        container.innerHTML = '<p style="color:red;font-size:0.8rem;">QRコード生成失敗。URLが長すぎます。</p>';
    }

    modal.style.display = 'flex';
}

/**
 * QRコードモーダルを閉じる
 */
function closeQrModal() {
    document.getElementById('qr-modal').style.display = 'none';
}

// Global scope exports for onclick attributes
window.addItem = addItem;
window.deleteItem = deleteItem;
window.showQRModal = showQRModal;
window.closeQrModal = closeQrModal;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.renderDriverList = renderDriverList;
window.renderCheckerList = renderCheckerList;
window.renderVehicleList = renderVehicleList;
window.printQRCode = printQRCode;
window.startQrScanner = typeof startQrScanner !== 'undefined' ? startQrScanner : null;
window.stopQrScanner = typeof stopQrScanner !== 'undefined' ? stopQrScanner : null;

/**
 * QRコード印刷
 */
function printQRCode() {
    const printWindow = window.open('', '_blank');
    const qrContent = document.getElementById('qr-code-container').innerHTML;
    const title = document.getElementById('qr-vehicle-name').textContent;

    printWindow.document.write(`
        <html>
            <head>
                <title>QR Code Print</title>
                <style>
                    body { font-family: sans-serif; text-align: center; padding: 40px; }
                    .container { border: 2px solid #333; padding: 40px; display: inline-block; border-radius: 20px; }
                    h2 { margin-bottom: 20px; }
                    img { width: 300px; height: 300px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>${title}</h2>
                    ${qrContent}
                    <p style="margin-top:20px; color:#666;">このQRコードをスキャンして車両を選択できます</p>
                </div>
                <script>
                    window.onload = () => {
                        window.print();
                        setTimeout(() => window.close(), 500);
                    };
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}

/**
 * 車両リストを取得（旧形式の文字列配列にも自動対応）
 */
function getVehicleList() {
    let items = [];
    try {
        const json = localStorage.getItem(VEHICLE_LIST_KEY);
        if (json) items = JSON.parse(json);
    } catch (e) { return []; }

    // 旧形式（文字列配列）を新形式に自動変換
    if (items.length > 0 && typeof items[0] === 'string') {
        items = items.map(s => ({ nickname: '', plate: s }));
        localStorage.setItem(VEHICLE_LIST_KEY, JSON.stringify(items));
    }
    return items;
}

/**
 * ニックネーム付き車両追加
 */
function addVehicleWithNickname() {
    const nicknameInput = document.getElementById('input-add-vehicle-nickname');
    const plateInput = document.getElementById('input-add-vehicle');
    const nickname = nicknameInput ? nicknameInput.value.trim() : '';
    const plate = plateInput ? plateInput.value.trim() : '';

    if (!plate && !nickname) return;

    const items = getVehicleList();
    items.push({ nickname: nickname, plate: plate || nickname });
    localStorage.setItem(VEHICLE_LIST_KEY, JSON.stringify(items));

    if (nicknameInput) nicknameInput.value = '';
    if (plateInput) plateInput.value = '';
    renderVehicleList();
}

/**
 * 車両用ドロップダウン更新（ニックネーム対応）
 */
function updateVehicleDropdowns() {
    const items = getVehicleList();
    const elementIds = ['vehicle-id', 'cloud-vehicle-select'];

    elementIds.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;

        const currentVal = select.value;
        select.innerHTML = '';

        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '-- 選択してください --';
        select.appendChild(emptyOpt);

        items.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.plate || v.nickname;
            opt.textContent = v.nickname ? `${v.nickname}（${v.plate}）` : v.plate;
            select.appendChild(opt);
        });

        if (Array.from(select.options).some(o => o.value === currentVal)) {
            select.value = currentVal;
        }
    });
}

/**
 * 車両のニックネーム・ナンバーをインライン編集
 */
function editVehicle(index) {
    const items = getVehicleList();
    if (index < 0 || index >= items.length) return;

    const container = document.getElementById('vehicle-list-container');
    if (!container) return;
    const listItem = container.children[index];
    if (!listItem) return;

    const v = items[index];

    // インライン編集フォームに置き換え
    listItem.className = 'list-item list-item-editing';
    listItem.innerHTML = `
        <div class="vehicle-edit-form">
            <div class="vehicle-edit-fields">
                <div class="vehicle-edit-field">
                    <label>ニックネーム</label>
                    <input type="text" class="input-add-item" value="${v.nickname || ''}" placeholder="例: 1号車" id="edit-nickname-${index}">
                </div>
                <div class="vehicle-edit-field">
                    <label>ナンバー</label>
                    <input type="text" class="input-add-item" value="${v.plate || ''}" placeholder="例: 品川300あ1234" id="edit-plate-${index}">
                </div>
            </div>
            <div class="vehicle-edit-actions">
                <button class="btn-action-accent vehicle-edit-save" onclick="saveVehicleEdit(${index})">✓ 保存</button>
                <button class="btn-action-secondary vehicle-edit-cancel" onclick="renderVehicleList()">キャンセル</button>
            </div>
        </div>
    `;

    // ニックネーム欄にフォーカス
    const nicknameInput = document.getElementById('edit-nickname-' + index);
    if (nicknameInput) nicknameInput.focus();
}

/**
 * インライン編集の保存
 */
function saveVehicleEdit(index) {
    const items = getVehicleList();
    if (index < 0 || index >= items.length) return;

    const nicknameInput = document.getElementById('edit-nickname-' + index);
    const plateInput = document.getElementById('edit-plate-' + index);

    const newNickname = nicknameInput ? nicknameInput.value.trim() : '';
    const newPlate = plateInput ? plateInput.value.trim() : '';

    if (!newNickname && !newPlate) return;

    items[index] = {
        nickname: newNickname,
        plate: newPlate || items[index].plate
    };
    localStorage.setItem(VEHICLE_LIST_KEY, JSON.stringify(items));
    renderVehicleList();
}

/**
 * デフォルト設定セレクトの初期化
 */
function initDefaultSelects() {
    // デフォルト車両セレクト
    const defaultVehicle = document.getElementById('default-vehicle-select');
    if (defaultVehicle) {
        const vehicles = getVehicleList();
        const savedVal = localStorage.getItem(DEFAULT_VEHICLE_KEY) || '';
        defaultVehicle.innerHTML = '<option value="">なし（手動選択）</option>';
        vehicles.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.plate || v.nickname;
            opt.textContent = v.nickname ? `${v.nickname}（${v.plate}）` : v.plate;
            defaultVehicle.appendChild(opt);
        });
        defaultVehicle.value = savedVal;

        defaultVehicle.addEventListener('change', () => {
            localStorage.setItem(DEFAULT_VEHICLE_KEY, defaultVehicle.value);
        });
    }

    // デフォルト運転者セレクト
    const defaultDriver = document.getElementById('default-driver-select');
    if (defaultDriver) {
        let drivers = [];
        try {
            const json = localStorage.getItem(DRIVER_LIST_KEY);
            if (json) drivers = JSON.parse(json);
        } catch (e) { }
        if (drivers.length === 0) drivers = DEFAULT_DRIVERS;

        const savedVal = localStorage.getItem(DEFAULT_DRIVER_KEY) || '';
        defaultDriver.innerHTML = '<option value="">なし（手動選択）</option>';
        drivers.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            defaultDriver.appendChild(opt);
        });
        defaultDriver.value = savedVal;

        defaultDriver.addEventListener('change', () => {
            localStorage.setItem(DEFAULT_DRIVER_KEY, defaultDriver.value);
        });
    }
}

/**
 * デフォルト値の適用（フォーム起動時）
 */
function applyDefaults() {
    // デフォルト車両（フォーム + クラウド同期の両方に適用）
    const defaultVehicle = localStorage.getItem(DEFAULT_VEHICLE_KEY);
    if (defaultVehicle) {
        ['vehicle-id', 'cloud-vehicle-select'].forEach(selectId => {
            const sel = document.getElementById(selectId);
            if (sel && !sel.value) {
                if (Array.from(sel.options).some(o => o.value === defaultVehicle)) {
                    sel.value = defaultVehicle;
                }
            }
        });
    }

    // デフォルト運転者（記録1のみ）
    const defaultDriver = localStorage.getItem(DEFAULT_DRIVER_KEY);
    if (defaultDriver) {
        const driverSelect = document.getElementById('driver-name-1');
        if (driverSelect && !driverSelect.value) {
            if (Array.from(driverSelect.options).some(o => o.value === defaultDriver)) {
                driverSelect.value = defaultDriver;
            }
        }
    }

    // メーターのローカルバックアップ復元（GASデータがない場合のフォールバック）
    const lastMeter = localStorage.getItem(LAST_METER_KEY);
    if (lastMeter) {
        const startMeter1 = document.getElementById('start-meter-1');
        if (startMeter1 && !startMeter1.value) {
            startMeter1.value = lastMeter;
        }
    }
}
