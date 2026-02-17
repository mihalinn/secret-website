// ============================================================
//  勤怠詳細作成ツール - attendance.js
// ============================================================

// --------------------------------------------------
//  定数
// --------------------------------------------------
const STANDARD_START = '09:00';
const STANDARD_END = '17:45';
const DEFAULT_RETURN = '16:00';

let DEFAULTS = {
    'start-type': '(出社)',
    'start-time': STANDARD_START,
    'conn-1': '～',
    'middle-type': '外勤',
    'visit-count': '1件',
    'middle-type-2': '高崎市',
    'return-type': '(帰社)',
    'return-time': '16:00',
    'conn-2': '(継続)',
    'end-content': '付帯業務',
    'end-type': '(退社)',
    'end-time': STANDARD_END,
};

// --------------------------------------------------
//  デフォルト設定 (LocalStorage)
// --------------------------------------------------
const STORAGE_KEY_DEFAULTS = 'attendance_defaults';

function loadDefaults() {
    const json = localStorage.getItem(STORAGE_KEY_DEFAULTS);
    if (json) {
        try {
            const saved = JSON.parse(json);
            DEFAULTS = { ...DEFAULTS, ...saved };
        } catch (e) {
            console.error('Defaults load error:', e);
        }
    }
}

function saveCurrentAsDefaults() {
    const newDefaults = {};
    for (const key of Object.keys(DEFAULTS)) {
        const el = document.getElementById(key);
        if (el) {
            newDefaults[key] = el.value;
        }
    }
    DEFAULTS = newDefaults;
    localStorage.setItem(STORAGE_KEY_DEFAULTS, JSON.stringify(DEFAULTS));

    const msg = document.getElementById('msg-save-default');
    if (msg) {
        msg.textContent = '保存しました';
        setTimeout(() => msg.textContent = '', 2000);
    }
}

// --------------------------------------------------
//  ユーティリティ
// --------------------------------------------------

/** "HH:MM" → "HHMM" */
function formatTime(timeVal) {
    if (!timeVal) return '';
    return timeVal.replace(':', '');
}

/** "HH:MM" → 分に変換 */
function getMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

/** 分 → "HH:MM" */
function toTimeString(totalMin) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/** 要素の値を取得 */
function val(id) {
    return document.getElementById(id).value;
}

// --------------------------------------------------
//  時刻調整
// --------------------------------------------------
function adjTime(id, mins) {
    const el = document.getElementById(id);

    // 空の場合はデフォルト値をセット
    if (!el.value) {
        el.value = DEFAULTS[id] || STANDARD_END;
    }

    let cur = getMinutes(el.value);

    // ±15 の場合は15分刻みのキリの良い時間にスナップ
    if (Math.abs(mins) === 15) {
        if (mins > 0) {
            cur = (Math.floor(cur / 15) + 1) * 15;
        } else {
            cur = (Math.ceil(cur / 15) - 1) * 15;
        }
    } else {
        cur += mins;
    }

    // 0:00 〜 23:59 にラップ
    if (cur < 0) cur += 24 * 60;
    if (cur >= 24 * 60) cur -= 24 * 60;

    el.value = toTimeString(cur);
    el.dispatchEvent(new Event('input'));
    el.dispatchEvent(new Event('change'));
}

// --------------------------------------------------
//  接続自動切替（早出 → 休5）
// --------------------------------------------------
function updateConnectors() {
    const startType = val('start-type');
    const conn1 = document.getElementById('conn-1');
    const startTime = document.getElementById('start-time');

    if (startType === '(早出)' || startType === '(早出・直行)') {
        conn1.value = '(休5)';
        startTime.value = '08:30';
    } else {
        conn1.value = '～';
        startTime.value = STANDARD_START;
    }
    generateReport();
}

// --------------------------------------------------
//  残業計算
// --------------------------------------------------
function calcOvertime() {
    const startMin = getMinutes(val('start-time'));
    const endMin = getMinutes(val('end-time'));
    const conn1 = val('conn-1');
    const conn2 = val('conn-2');

    const stdStart = getMinutes(STANDARD_START);
    const stdEnd = getMinutes(STANDARD_END);

    let otMinutes = 0;

    // 早出分
    if (startMin < stdStart) {
        otMinutes += (stdStart - startMin);
        if (conn1 === '(休5)') otMinutes -= 5;
    }

    // 残業分
    if (endMin > stdEnd) {
        otMinutes += (endMin - stdEnd);
        if (conn2 === '(休15)') otMinutes -= 15;
    }

    otMinutes = Math.max(0, otMinutes);

    // 10分単位で切り捨て
    const roundedMin = Math.floor(otMinutes / 10) * 10;

    // 実績表示
    updateBadge('ot-actual', otMinutes);
    // 申請表示（10分切り捨て）
    updateBadge('ot-round', roundedMin);

    // 休憩時間計算
    let breakMinutes = 0;
    if (conn1 === '(休5)') breakMinutes += 5;
    if (conn2 === '(休15)') breakMinutes += 15;

    // 休憩表示更新
    updateBadge('break', breakMinutes);
}

/** 残業バッジの表示を更新 (h/m 別々の span) */
function updateBadge(prefix, minutes) {
    const hEl = document.getElementById(`${prefix}-h`);
    const mEl = document.getElementById(`${prefix}-m`);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;

    hEl.textContent = String(h);
    mEl.textContent = m.toString().padStart(2, '0');

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const activeColor = isLight ? '#059669' : '#34d399';
    const inactiveColor = isLight ? '#94a3b8' : '#94a3b8';
    const activeBg = isLight ? 'rgba(5, 150, 105, 0.1)' : 'rgba(52, 211, 153, 0.2)';

    const color = minutes > 0 ? activeColor : inactiveColor;
    const bg = minutes > 0 ? activeBg : 'var(--ot-inactive-bg)';

    const badge = hEl.closest('.overtime-badge');
    badge.style.background = bg;
    badge.style.color = color;
}

// --------------------------------------------------
//  レポート生成
// --------------------------------------------------
function generateReport(e) {
    const targetId = e ? e.target.id : null;

    // --------------------------------------------------
    //  依存関係の自動制御（UIへの反映）
    // --------------------------------------------------
    const midType = val('middle-type');

    if (targetId === 'middle-type') {
        const visitCount = document.getElementById('visit-count');
        const midType2 = document.getElementById('middle-type-2');
        if (midType === '付帯業務') {
            if (visitCount.value !== '') visitCount.value = '';
            if (midType2.value !== '') midType2.value = '';
        } else {
            // 付帯業務以外に戻った時、空ならデフォルト復帰
            if (visitCount.value === '') visitCount.value = DEFAULTS['visit-count'];
            if (midType2.value === '') midType2.value = DEFAULTS['middle-type-2'];
        }
    }

    const retType = val('return-type');
    const endMin = getMinutes(val('end-time'));
    const stdEndMin = getMinutes(STANDARD_END); // 17:45
    const isOvertime = endMin > stdEndMin;

    if (retType === '') {
        const conn2 = document.getElementById('conn-2');
        const endContent = document.getElementById('end-content');

        // 残業発生時のみ (休15) を強制、それ以外は "-"
        if (isOvertime) {
            if (conn2.value === '') conn2.value = '(休15)';
        } else {
            if (conn2.value !== '') conn2.value = '';
        }

        // 終了内容は "-" (帰着変更時のみクリア)
        if (targetId === 'return-type') {
            if (endContent.value !== '') endContent.value = '';
        }
    } else {
        // 帰着ありなら、空になっている項目をデフォルトに戻す
        const conn2 = document.getElementById('conn-2');
        const endContent = document.getElementById('end-content');
        if (conn2.value === '') conn2.value = DEFAULTS['conn-2'];
        if (endContent.value === '') endContent.value = DEFAULTS['end-content'];
    }

    // --------------------------------------------------
    //  結果組み立て（再取得）
    // --------------------------------------------------
    // UIを書き換えたので再取得が必要
    const startType = val('start-type');
    const startTime = formatTime(val('start-time'));
    const conn1 = val('conn-1');
    const newMidType = val('middle-type'); // 付帯業務なら変わってないが念のため

    // 業務内容の組み立て
    let middle = '';
    let middle2 = '';

    // 付帯業務だろうと何だろうと、値が入っていればそのまま連結
    // ユーザーの「例外」を許容するため
    // newMidType は上部で定義済み
    // const newMidType = val('middle-type'); 
    const midCount = val('visit-count');
    middle = newMidType + midCount;

    const midType2 = val('middle-type-2');
    middle2 = midType2 ? ' ' + midType2 + '完了' : '';

    const newRetType = val('return-type');
    const retTime = formatTime(val('return-time'));
    const retPart = newRetType ? newRetType + retTime : '';

    const newConn2 = val('conn-2');
    const newEndContent = val('end-content');
    const endType = val('end-type');
    const endTime = formatTime(val('end-time'));
    // 帰着なし（"-"）の場合の制御
    // 残業有無にかかわらず、UI上の値をそのまま使う
    // (休15) もしくは (継続) など、ユーザーが選択した内容を尊重
    afterReturn = newConn2 + newEndContent + endType + endTime;

    const result = `${startType}${startTime}${conn1}${middle}${middle2}${retPart}${afterReturn}`;

    document.getElementById('result-text').textContent = result;

    calcOvertime();// 始業時刻の検証
    const startEl = document.getElementById('start-time');
    const startMin = getMinutes(val('start-time'));
    const stdStartMin = getMinutes(STANDARD_START);

    const isEarly = val('start-type') === '(早出)' || val('start-type') === '(早出・直行)';
    const isRegular = val('start-type') === '(出社)' || val('start-type') === '(直行)';

    let hasStartError = false;

    // 早出なのに09:00以降
    if (isEarly && startMin >= stdStartMin) {
        hasStartError = true;
    }
    // 通常（出社・直行）なのに09:00より前
    else if (isRegular && startMin < stdStartMin) {
        hasStartError = true;
    }

    if (hasStartError) {
        startEl.style.borderColor = '#f87171';
        startEl.style.boxShadow = '0 0 0 1px rgba(248,113,113,0.5)';
    } else {
        startEl.style.borderColor = '';
        startEl.style.boxShadow = '';
    }

    // 帰着時刻 > 就業時刻の検証
    const retEl = document.getElementById('return-time');
    const returnMin = getMinutes(val('return-time'));
    // endMin は上部で定義済みなので再利用
    // const endMin = getMinutes(val('end-time')); 

    if (returnMin > endMin) {
        retEl.style.borderColor = '#f87171';
        retEl.style.boxShadow = '0 0 0 1px rgba(248,113,113,0.5)';
    } else {
        retEl.style.borderColor = '';
        retEl.style.boxShadow = '';
    }

    // 就業時刻 < 17:45 の検証
    const endEl = document.getElementById('end-time');
    // endMin, stdEndMin は上部で定義済み
    // const endMinVal = getMinutes(val('end-time'));
    // const stdEndMinVal = getMinutes(STANDARD_END);

    if (endMin < stdEndMin) {
        endEl.style.borderColor = '#f87171';
        endEl.style.boxShadow = '0 0 0 1px rgba(248,113,113,0.5)';
    } else {
        endEl.style.borderColor = '';
        endEl.style.boxShadow = '';
    }

    calcOvertime();
    updateReminders();
}

// --------------------------------------------------
//  コピー
// --------------------------------------------------
function copyResult() {
    const text = document.getElementById('result-text').textContent;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector('.btn-icon');
        const original = btn.innerHTML;
        btn.innerHTML = 'Copied!';
        setTimeout(() => btn.innerHTML = original, 1200);
    });
}

/** 要素のテキストをコピー（残業時間/分の個別コピー用） */
function copyText(el) {
    const text = el.textContent;
    navigator.clipboard.writeText(text).then(() => {
        const original = el.textContent;
        el.textContent = '!';
        setTimeout(() => el.textContent = original, 800);
    });
}

// --------------------------------------------------
//  リセット
// --------------------------------------------------
function resetAll() {
    for (const [id, value] of Object.entries(DEFAULTS)) {
        document.getElementById(id).value = value;
    }
    generateReport();
}



// --------------------------------------------------
//  申請リマインダー表示
// --------------------------------------------------
function updateReminders() {
    const startType = val('start-type');
    const endType = val('end-type');
    const reminders = [];

    // 1. 直行系 (始業)
    if (startType === '(直行)' || startType === '(早出・直行)') {
        reminders.push('当日の直行申請は済みましたか？');
    }

    // 2. 直帰 (終業)
    if (endType === '(直帰)') {
        reminders.push('直帰申請をしてください');
    }

    // 3. 車持 (終業)
    if (endType === '(車持)') {
        reminders.push('社用車持帰り申請をしてください');
    }

    // 4. 明日の直行確認 (直帰 or 車持 の場合)
    if (endType === '(直帰)' || endType === '(車持)') {
        reminders.push('明日直行する場合は、直行申請をしてください');
    }

    // 5. 残業予定時間申請 (固定表示 - 最上部)
    const otH = document.getElementById('ot-round-h').textContent;
    const otM = document.getElementById('ot-round-m').textContent;
    const otMsg = `残業予定時間申請をしてください (申請時間 ${otH}:${otM})`;

    const area = document.getElementById('reminder-area');

    // 固定表示があるため常に表示
    area.style.display = 'block';

    let html = '';

    // 特別なスタイルで最上部に表示
    html += `<div class="reminder-priority">${otMsg}</div>`;

    if (reminders.length > 0) {
        html += `<ul class="reminder-list">
            ${reminders.map(msg => `<li>${msg}</li>`).join('')}
        </ul>`;
    }

    area.innerHTML = html;
}

// --------------------------------------------------
//  完了場所設定 (お気に入り機能)
// --------------------------------------------------
const ALL_LOCATIONS = [
    '高崎市', '前橋市', '太田市', '伊勢崎市', '足利市', '桐生市', '館林市',
    '渋川市', '藤岡市', '安中市', 'みどり市', '富岡市', '沼田市',
    '大泉町', '玉村町', '邑楽町', '吉岡町', 'みなかみ町', '中之条町',
    '榛東村', '板倉町', '甘楽町', '東吾妻町', '千代田町', '明和町',
    '嬬恋村', '昭和村', '下仁田町', '草津町', '長野原町', '片品村',
    '高山村', '川場村', '神流町', '南牧村', '上野村'
];

let favoriteLocations = [];

const STORAGE_KEY_FAV = 'attendance_fav_locations';

/** LocalStorageから読み込み */
function loadFavorites() {
    const json = localStorage.getItem(STORAGE_KEY_FAV);
    if (json) {
        favoriteLocations = JSON.parse(json);
    } else {
        favoriteLocations = [];
    }
}

/** LocalStorageへ保存 */
function saveFavorites() {
    localStorage.setItem(STORAGE_KEY_FAV, JSON.stringify(favoriteLocations));
}

/** 場所プルダウンの再描画 */
function renderLocationOptions() {
    const select = document.getElementById('middle-type-2');
    const currentVal = select.value; // 選択状態を維持するため

    // お気に入りとその他に分離
    const favs = ALL_LOCATIONS.filter(loc => favoriteLocations.includes(loc));
    const others = ALL_LOCATIONS.filter(loc => !favoriteLocations.includes(loc));

    let html = '';

    // お気に入りグループ
    if (favs.length > 0) {
        favs.forEach(loc => {
            html += `<option value="${loc}">★ ${loc}</option>`;
        });
        html += `<option disabled>──────────</option>`;
    }

    // その他グループ
    others.forEach(loc => {
        html += `<option value="${loc}">${loc}</option>`;
    });

    // 空選択肢 (末尾)
    html += `<option value="">-</option>`;

    select.innerHTML = html;

    // 前回の選択値を復元（もしリストにあれば）
    // なければデフォルト値 or 先頭
    if (currentVal && (favs.includes(currentVal) || others.includes(currentVal))) {
        select.value = currentVal;
    } else {
        // 初期値(高崎市)があればそれ、なければ先頭
        if (favs.includes('高崎市') || others.includes('高崎市')) {
            select.value = '高崎市';
        } else {
            select.selectedIndex = 0;
        }
    }
}

/** 設定モーダルの開閉 */
function toggleSettingsModal(show) {
    const modal = document.getElementById('settings-modal');
    modal.style.display = show ? 'flex' : 'none';
    if (show) {
        renderSettingsCheckboxes();
    }
}

/** 設定モーダル内のチェックボックス描画 */
function renderSettingsCheckboxes() {
    const container = document.getElementById('location-settings-list');
    let html = '';
    ALL_LOCATIONS.forEach(loc => {
        const isFav = favoriteLocations.includes(loc);
        html += `
            <label class="setting-item">
                <input type="checkbox" value="${loc}" ${isFav ? 'checked' : ''}>
                <span>${loc}</span>
            </label>
        `;
    });
    container.innerHTML = html;
}

/** 設定の保存 */
function saveSettings() {
    const checkboxes = document.querySelectorAll('#location-settings-list input[type="checkbox"]');
    favoriteLocations = [];
    checkboxes.forEach(cb => {
        if (cb.checked) {
            favoriteLocations.push(cb.value);
        }
    });
    saveFavorites();
    renderLocationOptions();
    toggleSettingsModal(false);
}

// --------------------------------------------------
//  履歴 (Presets) 機能
// --------------------------------------------------
const STORAGE_KEY_PRESETS = 'attendance_presets_v2';
let presets = [];

/** 今日の日付文字列 (YYYY/MM/DD) */
function getTodayString() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${dd}`;
}

/** 履歴の読み込み */
function loadPresets() {
    const json = localStorage.getItem(STORAGE_KEY_PRESETS);
    if (json) {
        try {
            presets = JSON.parse(json);
        } catch (e) {
            presets = [];
        }
    }
    renderPresetMenu();
    updateCurrentPresetLabel(null);
}

/** 履歴の保存 (上書きモード) */
function savePreset() {
    const today = getTodayString();

    // 現在の状態を取得
    const currentData = {};
    for (const key of Object.keys(DEFAULTS)) {
        const el = document.getElementById(key);
        if (el) currentData[key] = el.value;
    }

    // 既存の今日の日付のエントリを探す
    const existingIndex = presets.findIndex(p => p.name === today);

    if (existingIndex >= 0) {
        // 上書き
        presets[existingIndex].data = currentData;
        presets[existingIndex].timestamp = Date.now();
    } else {
        // 新規作成
        presets.unshift({
            name: today,
            data: currentData,
            timestamp: Date.now()
        });
    }

    // 最大件数制限 (例えば30件)
    if (presets.length > 30) {
        presets = presets.slice(0, 30);
    }

    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets));
    renderPresetMenu();
    updateCurrentPresetLabel(today);

    // 保存完了フィードバック
    const btn = document.getElementById('btn-save-preset');
    const originalHTML = btn.innerHTML;
    const span = btn.querySelector('span');
    if (span) span.textContent = 'Saved!';
    setTimeout(() => {
        btn.innerHTML = originalHTML;
    }, 1000);
}

/** 履歴の削除 */
function deletePreset(index, e) {
    if (e) e.stopPropagation();
    // UI側で2段階確認しているので、ここはダイアログ不要
    // if (!confirm('この履歴を削除しますか？')) return;

    presets.splice(index, 1);
    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets));
    renderPresetMenu();
    updateCurrentPresetLabel(null);
}

/** 履歴の適用 */
function applyPreset(index) {
    const preset = presets[index];
    if (!preset) return;

    for (const [key, val] of Object.entries(preset.data)) {
        const el = document.getElementById(key);
        if (el) el.value = val;
    }
    generateReport();
    calcOvertime();
    updateReminders();
    updateCurrentPresetLabel(preset.name);

    // ドロップダウンを閉じる
    document.getElementById('preset-dropdown').classList.remove('active');
    document.getElementById('dropdown-menu').classList.remove('show');
}

/** ドロップダウン描画 */
function renderPresetMenu() {
    const menu = document.getElementById('dropdown-menu');
    if (!menu) return;

    if (presets.length === 0) {
        menu.innerHTML = '<div style="padding:8px; color:var(--text-secondary); font-size:0.85rem;">履歴はありません</div>';
        return;
    }

    let html = '';
    presets.forEach((p, index) => {
        html += `
            <div class="preset-item" data-index="${index}">
                <span>${p.name}</span>
                <button class="btn-delete-preset" type="button" data-index="${index}" title="削除">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
    });
    menu.innerHTML = html;
}

/** 現在選択中のラベル更新 */
function updateCurrentPresetLabel(name) {
    const label = document.getElementById('current-preset-name');
    if (label) {
        label.textContent = name ? name : '履歴を選択...';
    }
}

// Global scope no longer needed but kept for safety if needed elsewhere
window.applyPreset = applyPreset;
window.deletePreset = deletePreset;

// ドロップダウン開閉制御 & イベント委譲
function initPresetDropdown() {
    const trigger = document.getElementById('dropdown-trigger');
    const menu = document.getElementById('dropdown-menu');
    const container = document.getElementById('preset-dropdown');

    if (trigger && menu) {
        // Toggle Open/Close
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('show');
            container.classList.toggle('active');
        });

        // Event Delegation for Menu Items
        menu.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.btn-delete-preset');
            const item = e.target.closest('.preset-item');

            if (deleteBtn) {
                e.stopPropagation(); // Stop bubbling

                // 2-step confirmation logic
                if (deleteBtn.classList.contains('confirm')) {
                    // Second click: Execute delete
                    const index = parseInt(deleteBtn.getAttribute('data-index'), 10);
                    deletePreset(index, e);
                } else {
                    // First click: Enter confirm state
                    // Reset any other open confirms first
                    document.querySelectorAll('.btn-delete-preset.confirm').forEach(btn => {
                        btn.classList.remove('confirm');
                    });

                    deleteBtn.classList.add('confirm');

                    // Auto-reset after 3 seconds
                    setTimeout(() => {
                        if (deleteBtn && document.body.contains(deleteBtn)) {
                            deleteBtn.classList.remove('confirm');
                        }
                    }, 3000);
                }
            } else if (item) {
                // Item Clicked
                const index = parseInt(item.getAttribute('data-index'), 10);
                applyPreset(index);
            }
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (container && !container.contains(e.target)) {
                menu.classList.remove('show');
                container.classList.remove('active');
            }
        });
    }
}


/** デフォルト値をDOMに適用 */
function applyDefaults() {
    for (const [key, val] of Object.entries(DEFAULTS)) {
        const el = document.getElementById(key);
        if (el) {
            // セレクトボックスで選択肢が存在しない場合は無視される（ブラウザ挙動）
            el.value = val;
        }
    }
}

// 初期化時に読み込み
window.addEventListener('DOMContentLoaded', () => {
    loadDefaults(); // デフォルト設定読み込み (変数への反映)
    loadFavorites();
    renderLocationOptions();
    applyDefaults(); // 読み込んだデフォルト値をDOMに反映

    // プリセット初期化
    loadPresets();
    initPresetDropdown();

    // 全入力要素に変更リスナーを登録
    document.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('input', (e) => {
            generateReport(e);
            calcOvertime();
        });
    });

    // 1. Start Type Change (Conn1/StartTime update)
    const startTypeSelect = document.getElementById('start-type');
    if (startTypeSelect) {
        startTypeSelect.addEventListener('change', updateConnectors);
    }

    // 2. Time Adjustment Buttons
    document.querySelectorAll('.btn-time-adj').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = btn.getAttribute('data-target');
            const minutes = parseInt(btn.getAttribute('data-minutes'), 10);
            if (targetId && !isNaN(minutes)) {
                adjTime(targetId, minutes);
            }
        });
    });

    // 3. Copy Result Button
    const copyBtn = document.getElementById('btn-copy-result');
    if (copyBtn) {
        copyBtn.addEventListener('click', copyResult);
    }

    // 4. Overtime Copy Targets
    document.querySelectorAll('.ot-copy-target').forEach(el => {
        el.addEventListener('click', function () {
            copyText(this);
        });
    });

    // 5. Theme Toggle
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }

    // 6. Reset Button
    const resetBtn = document.getElementById('btn-reset-all');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetAll);
    }

    // 時刻入力にマウスホイール対応（1分刻み）
    document.querySelectorAll('input[type="time"]').forEach(el => {
        el.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 1 : -1;
            adjTime(el.id, delta);
        }, { passive: false });
    });

    // テーマ変更時に色を再適用
    window.addEventListener('themechange', () => calcOvertime());

    // 設定ボタン
    const settingsBtn = document.getElementById('btn-settings');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => toggleSettingsModal(true));
    }

    // モーダル閉じる
    const closeBtn = document.getElementById('btn-close-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => toggleSettingsModal(false));
    }

    // 設定保存
    const saveBtn = document.getElementById('btn-save-settings');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveSettings);
    }

    // デフォルト保存ボタン
    const saveDefaultBtn = document.getElementById('btn-save-default');
    if (saveDefaultBtn) {
        saveDefaultBtn.addEventListener('click', saveCurrentAsDefaults);
    }

    // 履歴保存ボタン
    const savePresetBtn = document.getElementById('btn-save-preset');
    if (savePresetBtn) {
        savePresetBtn.addEventListener('click', savePreset);
    }

    // モーダル背景クリックで閉じる
    const modal = document.getElementById('settings-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) toggleSettingsModal(false);
        });
    }

    generateReport();
    calcOvertime();
    updateReminders();
});
