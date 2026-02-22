/**
 * driving_report_events.js
 * イベントリスナーの集約
 */

function setupEventListeners() {
    const varAccent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();

    // 日付変更 -> 履歴読み込み
    document.getElementById('report-date').addEventListener('change', (e) => {
        if (typeof updateDayOfWeek === 'function') updateDayOfWeek();
        if (typeof loadFromHistory === 'function') {
            const vehicleId = document.getElementById('vehicle-id').value;
            loadFromHistory(e.target.value, vehicleId);
        }
        // クラウド同期セレクターを連動
        syncCloudSelectors();
    });

    // 設定・モード関連
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    document.getElementById('btn-settings').addEventListener('click', openSettingsModal);
    document.getElementById('btn-close-modal').addEventListener('click', closeSettingsModal);
    document.getElementById('settings-modal').addEventListener('click', (e) => {
        if (e.target.id === 'settings-modal') closeSettingsModal();
    });

    // QRスキャン関連
    const btnScanVehicle = document.getElementById('btn-scan-vehicle');
    if (btnScanVehicle) btnScanVehicle.addEventListener('click', startQrScanner);
    document.getElementById('btn-close-qr-modal').addEventListener('click', stopQrScanner);
    document.getElementById('btn-cancel-qr').addEventListener('click', stopQrScanner);
    document.getElementById('qr-scan-modal').addEventListener('click', (e) => {
        if (e.target.id === 'qr-scan-modal') stopQrScanner();
    });

    // QR表示関連
    const btnCloseQr = document.getElementById('btn-close-qr');
    if (btnCloseQr) {
        btnCloseQr.addEventListener('click', () => {
            document.getElementById('qr-modal').style.display = 'none';
        });
    }
    const qrModal = document.getElementById('qr-modal');
    if (qrModal) {
        qrModal.addEventListener('click', (e) => {
            if (e.target.id === 'qr-modal') qrModal.style.display = 'none';
        });
    }
    document.getElementById('btn-print-qr').addEventListener('click', printQRCode);

    // タブ切り替え
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (typeof switchTab === 'function') switchTab(btn.getAttribute('data-tab'));
        });
    });

    // リスト追加
    document.getElementById('btn-add-driver').addEventListener('click', () => addItem(DRIVER_LIST_KEY, 'input-add-driver', renderDriverList));
    document.getElementById('btn-add-checker').addEventListener('click', () => addItem(CHECKER_LIST_KEY, 'input-add-checker', renderCheckerList));
    const btnAddVehicle = document.getElementById('btn-add-vehicle');
    if (btnAddVehicle) btnAddVehicle.addEventListener('click', () => addItem(VEHICLE_LIST_KEY, 'input-add-vehicle', renderVehicleList));

    // 設定値の自動保存
    document.getElementById('gas-url-input').addEventListener('input', (e) => {
        try { localStorage.setItem(GAS_URL_KEY, e.target.value); } catch (e) { }
    });
    const passInput = document.getElementById('sys-passcode-input');
    if (passInput) passInput.addEventListener('input', (e) => {
        try { localStorage.setItem(PASSCODE_KEY, e.target.value); } catch (e) { }
    });

    // 選択値の自動保存
    const driverSelect1 = document.getElementById('driver-name-1');
    if (driverSelect1) {
        driverSelect1.addEventListener('change', (e) => {
            try { localStorage.setItem(LAST_DRIVER_KEY, e.target.value); } catch (e) { }
            if (typeof saveToLocal === 'function') saveToLocal();
        });
    }
    const vehicleSelect = document.getElementById('vehicle-id');
    if (vehicleSelect) {
        vehicleSelect.addEventListener('change', (e) => {
            try { localStorage.setItem(LAST_VEHICLE_KEY, e.target.value); } catch (e) { }
            const dateVal = document.getElementById('report-date').value;
            if (typeof loadFromHistory === 'function') loadFromHistory(dateVal, e.target.value);
            if (typeof saveToLocal === 'function') saveToLocal();

            // クラウド同期セレクターを連動
            syncCloudSelectors();
        });
    }

    ['pre-checker', 'post-checker'].forEach(id => {
        document.getElementById(id).addEventListener('change', (e) => {
            const key = id === 'pre-checker' ? LAST_CHECKER_PRE_KEY : LAST_CHECKER_POST_KEY;
            try { localStorage.setItem(key, e.target.value); } catch (e) { }
            if (typeof saveToLocal === 'function') saveToLocal();
        });
    });

    // 「今」ボタン
    document.querySelectorAll('.btn-now').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input) {
                const now = new Date();
                input.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            }
        });
    });

    // 行の開閉
    document.querySelectorAll('.btn-toggle-row').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const target = document.getElementById(targetId);
            if (target) {
                const isHidden = target.style.display === 'none';
                target.style.display = isHidden ? 'block' : 'none';
                btn.innerHTML = isHidden
                    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><polyline points="18 15 12 9 6 15"></polyline></svg> 閉じる'
                    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><polyline points="6 9 12 15 18 9"></polyline></svg> 開く';
            }
        });
    });

    // メーター入力時の距離計算
    for (let i = 1; i <= 3; i++) {
        document.getElementById(`start-meter-${i}`).addEventListener('input', calcDistance);
        document.getElementById(`end-meter-${i}`).addEventListener('input', calcDistance);
    }

    // アルコールチェック表示切り替え
    document.querySelectorAll('input[name="pre-alcohol"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const valInput = document.getElementById('pre-alcohol-val');
            valInput.style.display = e.target.value === '有' ? 'block' : 'none';
            if (e.target.value !== '有') valInput.value = '';
        });
    });

    // 送信・保存ボタン
    document.getElementById('btn-send-gas').addEventListener('click', sendReport);
    const btnSaveJson = document.getElementById('btn-save-json');
    if (btnSaveJson) btnSaveJson.addEventListener('click', saveJsonReport);

    // インポート関連
    const setupImport = (btnId, inputId, handler) => {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);
        if (btn && input) {
            btn.addEventListener('click', () => input.click());
            input.addEventListener('change', handler);
        }
    };

    // リスト保存と画面更新の共通化
    const saveAndRefreshLists = (data) => {
        try {
            if (data.drivers) localStorage.setItem(DRIVER_LIST_KEY, JSON.stringify(data.drivers));
            if (data.checkers) localStorage.setItem(CHECKER_LIST_KEY, JSON.stringify(data.checkers));
            if (data.vehicles) localStorage.setItem(VEHICLE_LIST_KEY, JSON.stringify(data.vehicles));
            initDropdowns();
            renderDriverList();
            renderCheckerList();
            renderVehicleList();
        } catch (e) {
            console.error('List save error during import', e);
            alert('保存に失敗しました。容量不足の可能性があります。');
        }
    };

    // JSONインポート
    setupImport('btn-import-config', 'input-import-config', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const confirmed = await showActionConfirm({
            title: '設定のインポート',
            message: 'リストを上書きしますか？',
            btnText: '読み込む',
            btnColor: varAccent
        });
        if (!confirmed) { e.target.value = ''; return; }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                saveAndRefreshLists(data);
                alert('インポート完了');
            } catch (err) { alert('解析失敗'); }
            e.target.value = '';
        };
        reader.readAsText(file);
    });

    // CSVインポート
    setupImport('btn-import-csv', 'input-import-csv', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const rows = parseCSV(event.target.result);
                if (rows.length < 2) throw new Error('データ不足');

                const drivers = [], checkers = [], vehicles = [];
                for (let i = 1; i < rows.length; i++) {
                    if (rows[i][0]) drivers.push(rows[i][0].trim());
                    if (rows[i][1]) checkers.push(rows[i][1].trim());
                    if (rows[i][2]) vehicles.push(rows[i][2].trim());
                }
                const uniqueDrivers = [...new Set(drivers)], uniqueCheckers = [...new Set(checkers)], uniqueVehicles = [...new Set(vehicles)];

                const confirmed = await showActionConfirm({
                    title: 'インポートの確認',
                    message: `運転者:${uniqueDrivers.length}件、確認者:${uniqueCheckers.length}件、車両:${uniqueVehicles.length}件 を登録しますか？`,
                    btnText: '実行'
                });
                if (confirmed) {
                    saveAndRefreshLists({
                        drivers: uniqueDrivers,
                        checkers: uniqueCheckers,
                        vehicles: uniqueVehicles
                    });
                }
            } catch (err) { alert('CSV解析失敗'); }
            e.target.value = '';
        };
        reader.readAsText(file);
    });

    // リセット
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
        btnReset.addEventListener('click', async () => {
            const confirmed = await showActionConfirm({
                title: 'リセットの確認',
                message: '入力内容をすべて消去しますか？',
                btnText: 'リセット'
            });
            if (confirmed) resetForm();
        });
    }

    // クラウド更新ボタン
    const btnRefreshCloud = document.getElementById('btn-refresh-cloud');
    if (btnRefreshCloud) {
        btnRefreshCloud.addEventListener('click', () => {
            if (typeof fetchMonthlyData === 'function') fetchMonthlyData();
        });
    }

    // クラウド用セレクター変更時に自動更新
    ['cloud-vehicle-select', 'cloud-year-select', 'cloud-month-select'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                if (typeof fetchMonthlyData === 'function') fetchMonthlyData();
            });
        }
    });

    // 拡大縮小スライダー
    const zoomRange = document.getElementById('cloud-zoom-range');
    const zoomVal = document.getElementById('cloud-zoom-val');
    if (zoomRange && zoomVal) {
        zoomRange.addEventListener('input', (e) => {
            const val = e.target.value;
            zoomVal.textContent = val + '%';
            applyCloudZoom(val);
        });
    }

    // ピンチズーム（二本指操作）
    const ssWrap = document.getElementById('cloud-ss-wrap');
    if (ssWrap && zoomRange) {
        let lastDist = 0;
        ssWrap.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                lastDist = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
            }
        }, { passive: true });

        ssWrap.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && lastDist > 0) {
                const dist = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
                const diff = dist - lastDist;
                if (Math.abs(diff) > 2) { // 微小な動きは無視
                    let newVal = parseInt(zoomRange.value, 10) + (diff > 0 ? 2 : -2);
                    newVal = Math.max(50, Math.min(150, newVal));
                    zoomRange.value = newVal;
                    zoomVal.textContent = newVal + '%';
                    applyCloudZoom(newVal);
                    lastDist = dist;
                }
            }
        }, { passive: true });

        ssWrap.addEventListener('touchend', () => {
            lastDist = 0;
        }, { passive: true });
    }

    // メインタブ切り替えボタン（設定モーダルの .tab-btn とは別の .main-tab-btn を使用）
    document.querySelectorAll('.main-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchMainTab(btn.getAttribute('data-main-tab'));
        });
    });
}

/**
 * クラウドテーブルにズームを適用する
 */
function applyCloudZoom(percent) {
    const table = document.querySelector('.crt-table');
    const scroll = document.querySelector('.crt-scroll');
    if (!table || !scroll) return;

    const scale = percent / 100;
    table.classList.add('zoomable');
    table.style.transform = `scale(${scale})`;

    // スケールに合わせてコンテナの高さを調整（はみ出し防止）
    const rect = table.getBoundingClientRect();
    // 実際の内容の高さ = scale前の高さ * scale
    // 元の高さ = table.offsetHeight
    scroll.style.paddingBottom = (table.offsetHeight * (scale - 1) > 0) ? (table.offsetHeight * (scale - 1)) + 'px' : '0';
    // 横幅も同様に調整（スクロール範囲を確保）
    scroll.style.marginRight = (table.offsetWidth * (scale - 1) > 0) ? (table.offsetWidth * (scale - 1)) + 'px' : '0';
}

/**
 * メインコンテンツのタブ切り替え
 * 設定モーダル用の switchTab() とは別関数
 */
function switchMainTab(tabId) {
    document.querySelectorAll('.main-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-main-tab') === tabId);
    });
    document.querySelectorAll('.main-tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `main-tab-${tabId}`);
    });

    // クラウドタブを開いたときは自動で最新データを取得
    if (tabId === 'cloud' && typeof fetchMonthlyData === 'function') {
        fetchMonthlyData();
    }
}

window.switchMainTab = switchMainTab;

/**
 * 入力フォームの日付・車両をクラウド同期セレクターに同期させ、再取得を行う
 */
function syncCloudSelectors() {
    const reportDate = document.getElementById('report-date').value;
    const vehicleId = document.getElementById('vehicle-id').value;

    const cloudYear = document.getElementById('cloud-year-select');
    const cloudMonth = document.getElementById('cloud-month-select');
    const cloudVehicle = document.getElementById('cloud-vehicle-select');

    if (!reportDate || !cloudYear || !cloudMonth || !cloudVehicle) return;

    const [y, m] = reportDate.split('-');

    // 値を同期（存在する場合のみ）
    if (Array.from(cloudYear.options).some(o => o.value === y)) cloudYear.value = y;
    cloudMonth.value = m;
    if (Array.from(cloudVehicle.options).some(o => o.value === vehicleId)) cloudVehicle.value = vehicleId;

    // クラウドデータの自動取得を実行
    if (typeof fetchMonthlyData === 'function') {
        fetchMonthlyData();
    }
}
