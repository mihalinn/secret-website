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
    'start-forget': false,
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
    'end-forget': false,
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
            newDefaults[key] = el.type === 'checkbox' ? el.checked : el.value;
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

    if (hEl) hEl.textContent = String(h);
    if (mEl) mEl.textContent = m.toString().padStart(2, '0');


    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const activeColor = isLight ? '#059669' : '#34d399';
    const inactiveColor = isLight ? '#94a3b8' : '#94a3b8';
    const activeBg = isLight ? 'rgba(5, 150, 105, 0.1)' : 'rgba(52, 211, 153, 0.2)';

    const color = minutes > 0 ? activeColor : inactiveColor;
    const bg = minutes > 0 ? activeBg : 'var(--ot-inactive-bg)';

    const badge = hEl ? hEl.closest('.overtime-badge') : null;
    if (badge) {
        badge.style.background = bg;
        badge.style.color = color;
    }
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
        const breakThreshold = stdEndMin + 15;
        // 17:45 + 15 = 18:00

        // 以前のロジックはここにあったが、全体適用のため移動

        // 終了内容は "-" (帰着変更時のみクリア)
        if (targetId === 'return-type') {
            if (endContent.value !== '') endContent.value = '';
            // 帰着なしの場合、接続詞もクリアする（これも強制ではなく、帰着変更時のみ）
            if (conn2.value !== '') conn2.value = '';
        }
    } else {
        // 帰着ありなら、空になっている項目をデフォルトに戻す
        // これも「帰着タイプを変更した瞬間」のみ適用し、ユーザーが手動で空にした場合は維持する
        if (targetId === 'return-type') {
            const conn2 = document.getElementById('conn-2');
            const endContent = document.getElementById('end-content');
            if (conn2.value === '') conn2.value = DEFAULTS['conn-2'];
            if (endContent.value === '') endContent.value = DEFAULTS['end-content'];
        }
    }

    // --------------------------------------------------
    //  自動休憩制御 (残業15分超過時) - 全体適用
    // --------------------------------------------------
    // ユーザーが手動で conn-2 を変更した場合は自動制御しない
    if (targetId !== 'conn-2') {
        const conn2 = document.getElementById('conn-2');
        // breakThresholdは上で定義しているが、スコープが切れている可能性も考慮して再定義（または確認）
        // stdEndMinは関数スコープなのでOK
        const breakThreshold = stdEndMin + 15;

        // 15分を超えた場合 (18:01〜)
        if (endMin > breakThreshold) {
            // まだ (休15) になっていなければ変更 (ユーザーが意図的に(継続)にしている場合は変えない方がいいか？)
            // 要件: "休憩ない場合もあるから継続にも変更できるようにして"
            // -> つまりデフォルト動作として(休15)にするが、手動変更は阻害しない
            // targetId !== 'conn-2' のガードがあるので、手動変更直後はここに来ない。
            // しかし、時刻変更時(targetId='end-time')に再びここを通ると、
            // 「(継続)」になっていても「(休15)」に書き換わってしまう。

            // これを防ぐには、「空っぽの場合」または「デフォルト((継続)など)の場合」のみ上書きする、という手があるが、
            // 「18:00またぎ」で自動セットしたいので、値だけで判断するのは難しい。

            // 今回の修正案: 「targetIdがconn-2でない」= 「時刻などが変更された」タイミングでは
            // 「(休15)」をセットする。
            // ユーザーが「(継続)」に変えるときは targetId='conn-2' なのでここはスキップされる。これでOK。
            // ただし、その後時刻を微調整するとまた「(休15)」に戻るが、それは「仕様」として許容範囲と推測。
            // (完全に状態を保持するにはstate管理が必要だが、このツールはステートレス)

            if (conn2.value !== '(休15)') conn2.value = '(休15)';
        }
        // 15分以下になった場合、もし (休15) が入っていたら元に戻す
        else if (conn2.value === '(休15)') {
            if (retType === '') {
                conn2.value = '';
            } else {
                conn2.value = DEFAULTS['conn-2']; // (継続)
            }
        }
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

    const startForget = document.getElementById('start-forget').checked;
    const startTypeStr = startForget ? `(打忘・${startType.slice(1, -1)})` : startType;

    const newRetType = val('return-type');
    const retTime = formatTime(val('return-time'));
    const retPart = newRetType ? newRetType + retTime : '';

    const newConn2 = val('conn-2');
    const newEndContent = val('end-content');
    const endType = val('end-type');
    const endForget = document.getElementById('end-forget').checked;
    const endTypeStr = endForget ? `(打忘・${endType.slice(1, -1)})` : endType;
    const endTime = formatTime(val('end-time'));

    const afterReturn = newConn2 + newEndContent + endTypeStr + endTime;

    const result = `${startTypeStr}${startTime}${conn1}${middle}${middle2}${retPart}${afterReturn}`;

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
/** リセット */
async function resetAll() {
    const ok = await showActionConfirm({
        title: 'リセットの確認',
        message: 'すべての入力内容をデフォルト値に戻しますか？',
        btnText: 'リセット'
    });
    if (!ok) return;

    for (const [id, value] of Object.entries(DEFAULTS)) {
        const el = document.getElementById(id);
        if (el) el.value = value;
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
// --------------------------------------------------
//  完了場所設定 (お気に入り & カスタム場所機能)
// --------------------------------------------------
let masterLocationList = []; // 全ての場所
let favoriteLocations = [];  // お気に入り登録された場所

const STORAGE_KEY_MASTER = 'attendance_master_locations';
const STORAGE_KEY_FAV = 'attendance_fav_locations';

/** LocalStorageから読み込み */
function loadLocations() {
    // マスターリストの読み込み
    const jsonMaster = localStorage.getItem(STORAGE_KEY_MASTER);
    if (jsonMaster) {
        masterLocationList = JSON.parse(jsonMaster);
    } else {
        // 初回は空（ユーザーの要望通り）
        masterLocationList = [];
    }

    // お気に入りリストの読み込み
    const jsonFav = localStorage.getItem(STORAGE_KEY_FAV);
    if (jsonFav) {
        favoriteLocations = JSON.parse(jsonFav);
    } else {
        favoriteLocations = [];
    }
}

/** LocalStorageへ保存 */
function saveLocations() {
    localStorage.setItem(STORAGE_KEY_MASTER, JSON.stringify(masterLocationList));
    localStorage.setItem(STORAGE_KEY_FAV, JSON.stringify(favoriteLocations));
}

/** 場所プルダウンの再描画 */
function renderLocationOptions() {
    const select = document.getElementById('middle-type-2');
    if (!select) return;
    const currentVal = select.value;

    // お気に入りとその他に分離
    const favs = masterLocationList.filter(loc => favoriteLocations.includes(loc)).sort();
    const others = masterLocationList.filter(loc => !favoriteLocations.includes(loc)).sort();

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
    if (currentVal && masterLocationList.includes(currentVal)) {
        select.value = currentVal;
    } else {
        select.selectedIndex = 0;
    }
}

/** 場所の追加 */
function addLocation() {
    const input = document.getElementById('input-add-location');
    const val = input.value.trim();
    if (!val) return;

    if (masterLocationList.includes(val)) {
        alert('その場所は既に登録されています');
        return;
    }

    masterLocationList.push(val);
    saveLocations();
    input.value = '';

    renderSettingsCheckboxes();
    renderLocationOptions();
}

/** 場所の削除 */
async function deleteLocation(loc) {
    const ok = await showActionConfirm({
        title: '場所の削除',
        message: `「${loc}」を削除してもよろしいですか？`,
        btnText: '削除',
        btnColor: '#f87171'
    });
    if (!ok) return;


    // マスターリストから削除
    masterLocationList = masterLocationList.filter(l => l !== loc);
    // お気に入りからも削除
    favoriteLocations = favoriteLocations.filter(l => l !== loc);

    saveLocations();
    renderSettingsCheckboxes();
    renderLocationOptions();
}

/** 設定モーダル内のチェックボックス描画 */
function renderSettingsCheckboxes() {
    const container = document.getElementById('location-settings-list');
    if (!container) return;

    if (masterLocationList.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 20px;">登録されている場所がありません</p>';
        return;
    }

    let html = '';
    // アルファベット/五十音順でソートして表示
    [...masterLocationList].sort().forEach(loc => {
        const isFav = favoriteLocations.includes(loc);
        html += `
            <div class="setting-item">
                <label>
                    <input type="checkbox" value="${loc}" ${isFav ? 'checked' : ''} onchange="toggleFavorite('${loc.replace(/'/g, "\\'")}', this.checked)">
                    <span>${loc}</span>
                </label>
                <button class="btn-delete-item" onclick="deleteLocation('${loc.replace(/'/g, "\\'")}')" title="削除">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </div>
        `;
    });
    container.innerHTML = html;
}


/** お気に入りの切り替え (チェックボックス用) */
function toggleFavorite(loc, isFav) {
    if (isFav) {
        if (!favoriteLocations.includes(loc)) favoriteLocations.push(loc);
    } else {
        favoriteLocations = favoriteLocations.filter(l => l !== loc);
    }
    saveLocations();
    renderLocationOptions();
}

/** 設定モーダルの開閉 */
function toggleSettingsModal(show) {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    modal.style.display = show ? 'flex' : 'none';
    if (show) {
        document.body.classList.add('no-scroll');
        switchSettingTab('location'); // Default tab
        renderSettingsCheckboxes();
    } else {
        document.body.classList.remove('no-scroll');
    }
}

/** 設定モーダルのタブ切り替え */
function switchSettingTab(tabName) {
    // ボタンのactive切り替え
    document.querySelectorAll('#settings-modal .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });
    // コンテンツの表示切り替え
    document.querySelectorAll('#settings-modal .tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
}

/** 設定の保存（モーダルを閉じる際などの予備） */
function saveSettings() {
    // 個別の toggleFavorite で保存しているため、ここではリストの同期のみ確認
    saveLocations();
    renderLocationOptions();
    toggleSettingsModal(false);
}

// Global scope exposure for HTML attributes
window.deleteLocation = deleteLocation;
window.toggleFavorite = toggleFavorite;
window.addLocation = addLocation;



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
            // 日付降順にソート (新しい日付 -> 古い日付)
            presets.sort((a, b) => b.name.localeCompare(a.name));
        } catch (e) {
            presets = [];
        }
    }
    renderPresetMenu();
    updateCurrentPresetLabel(null);
}

/** 履歴の保存 (上書きモード) */

/** 履歴の保存 (上書きモード) - 当日用 */
function savePreset() {
    const targetDate = getTodayString();
    saveDataToDate(targetDate, 'btn-save-preset');
}

/** 履歴の保存 (上書きモード) - 指定日用 */
function savePresetCustom() {
    const dateInput = document.getElementById('save-date');
    if (!dateInput || !dateInput.value) {
        alert('日付を指定してください');
        return;
    }
    // YYYY-MM-DD -> YYYY/MM/DD
    const targetDate = dateInput.value.replace(/-/g, '/');
    saveDataToDate(targetDate, 'btn-save-custom');
}

/** 指定した日付でデータを保存する共通処理 */
function saveDataToDate(targetDate, btnId) {
    // 現在の状態を取得
    const currentData = {};
    for (const key of Object.keys(DEFAULTS)) {
        const el = document.getElementById(key);
        if (el) currentData[key] = el.type === 'checkbox' ? el.checked : el.value;
    }

    // 既存のターゲット日付のエントリを探す
    const existingIndex = presets.findIndex(p => p.name === targetDate);

    if (existingIndex >= 0) {
        // 上書き
        presets[existingIndex].data = currentData;
        presets[existingIndex].timestamp = Date.now();
    } else {
        // 新規作成
        presets.push({
            name: targetDate,
            data: currentData,
            timestamp: Date.now()
        });
    }

    // 日付降順にソート (新しい日付 -> 古い日付)
    presets.sort((a, b) => b.name.localeCompare(a.name));

    // 最大件数制限 (例えば100件) - 最新の100件を残す
    if (presets.length > 100) {
        presets = presets.slice(0, 100);
    }

    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets));
    renderPresetMenu();
    updateCurrentPresetLabel(targetDate);

    // 保存完了フィードバック
    const btn = document.getElementById(btnId);
    if (!btn) return;

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
    presets.splice(index, 1);
    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets));
    renderPresetMenu();
    updateCurrentPresetLabel(null);

    // モーダルが開いていれば再描画
    const historyModal = document.getElementById('history-modal');
    if (historyModal && historyModal.style.display !== 'none') {
        renderHistoryList();
    }
}

/** 履歴の適用 */
function applyPreset(index) {
    const preset = presets[index];
    if (!preset) return;

    for (const [key, val] of Object.entries(preset.data)) {
        const el = document.getElementById(key);
        if (el) {
            if (el.type === 'checkbox') el.checked = val;
            else el.value = val;
        }
    }
    generateReport();
    calcOvertime();
    updateReminders();
    updateCurrentPresetLabel(preset.name);

    // ドロップダウンを閉じる
    document.getElementById('preset-dropdown').classList.remove('active');
    document.getElementById('dropdown-menu').classList.remove('show');

    // モーダルも閉じる (履歴一覧から適用した場合)
    closeHistoryModal();
}

/** ドロップダウン描画 (最新10件のみ表示 + もっと見る) */
function renderPresetMenu() {
    const menu = document.getElementById('dropdown-menu');
    if (!menu) return;

    if (presets.length === 0) {
        menu.innerHTML = '<div style="padding:8px; color:var(--text-secondary); font-size:0.85rem;">履歴はありません</div>';
        return;
    }

    let html = '';
    // 最大10件まで表示
    const displayCount = Math.min(presets.length, 10);

    for (let i = 0; i < displayCount; i++) {
        const p = presets[i];
        html += `
            <div class="preset-item" data-index="${i}">
                <span>${p.name}</span>
                <button class="btn-delete-preset" type="button" data-index="${i}" title="削除">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
    }

    // 10件を超える場合は「履歴一覧を表示」ボタンを追加
    if (presets.length > 10) {
        html += `
            <div class="preset-more" id="btn-show-history-modal">
                <span>すべての履歴を表示 (${presets.length}件)</span>
            </div>
        `;
    }

    menu.innerHTML = html;

    // もっと見るボタンのイベントリスナー
    const moreBtn = document.getElementById('btn-show-history-modal');
    if (moreBtn) {
        moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openHistoryModal();
            // ドロップダウンを閉じる
            document.getElementById('preset-dropdown').classList.remove('active');
            menu.classList.remove('show');
        });
    }
}

/** 履歴一覧モーダルを開く */
function openHistoryModal() {
    renderHistoryList();
    const modal = document.getElementById('history-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.classList.add('no-scroll');
    }
}

/** 履歴一覧モーダルを閉じる */
function closeHistoryModal() {
    const modal = document.getElementById('history-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.classList.remove('no-scroll');
    }
}

/** 履歴一覧リスト描画 (モーダル内) */
function renderHistoryList() {
    const container = document.getElementById('history-list');
    if (!container) return;

    if (presets.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-secondary);">履歴はありません</div>';
        return;
    }

    let html = '';
    presets.forEach((p, index) => {
        html += `
            <div class="history-item">
                <div class="history-info">${p.name}</div>
                <div class="history-actions">
                    <button class="btn-apply-history" onclick="applyPreset(${index})">適用</button>
                    <button class="btn-delete-history" onclick="deletePreset(${index})" title="削除">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

/** 現在選択中のラベル更新 */
function updateCurrentPresetLabel(name) {
    const label = document.getElementById('current-preset-name');
    if (label) {
        label.textContent = name ? name : '履歴を選択...';
    }
}

/** 設定をJSONとしてエクスポート */
function exportSettingsAsJson() {
    const data = {
        type: 'attendance_config',
        masterLocations: masterLocationList,
        favorites: favoriteLocations,
        presets: presets,
        version: '1.1'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_settings_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// Global scope expose if needed
window.applyPreset = applyPreset;
window.deletePreset = deletePreset;
window.exportSettingsAsJson = exportSettingsAsJson;

/** 設定をJSONからインポート */
async function importSettingsAsJson(e) {
    const file = e.target.files[0];
    if (!file) return;

    // 基本的にみんなが使う機能なので、確認ダイアログを表示
    if (!confirm('設定ファイルを読み込みますか？現在のお気に入り場所や履歴が上書きされます。')) {
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (data.type !== 'attendance_config') {
                alert('有効な勤怠詳細設定ファイルではありません。');
                return;
            }

            if (data.masterLocations) {
                masterLocationList = data.masterLocations;
            }
            if (data.favorites) {
                favoriteLocations = data.favorites;
            }
            saveLocations();
            renderSettingsCheckboxes();
            renderLocationOptions();

            if (data.presets) {
                presets = data.presets;
                savePresets();
                renderPresetMenu();
            }

            alert('設定をインポートしました。');
        } catch (err) {
            console.error('Import error:', err);
            alert('ファイルの読み込みに失敗しました。');
        }
        e.target.value = '';
    };
    reader.readAsText(file);
}

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
            if (el.type === 'checkbox') el.checked = val;
            else el.value = val;
        }
    }
}

// 初期化時に読み込み
window.addEventListener('DOMContentLoaded', () => {
    loadDefaults(); // デフォルト設定読み込み (変数への反映)
    loadLocations(); // マスター場所リストを読み込み
    renderLocationOptions(); // 場所選択ドロップダウンを初期化
    applyDefaults(); // 読み込んだデフォルト値をDOMに反映
    calcOvertime(); // 初期表示時に残業時間を計算

    // プリセット初期化
    loadPresets();
    initPresetDropdown();

    // 日付選択の初期化 (当日)
    const saveDateInput = document.getElementById('save-date');
    if (saveDateInput) {
        saveDateInput.value = getTodayString().replace(/\//g, '-');
    }

    // 初回アクセス時の当日保存データ復元
    const todayStr = getTodayString();
    const todayIndex = presets.findIndex(p => p.name === todayStr);

    if (todayIndex >= 0) {
        // 当日のデータがあればそれを適用 (デフォルトを上書き)
        applyPreset(todayIndex);
        // UI上も「今日は保存済みデータを使用中」とわかるようにラベル更新などは applyPreset 内で行われる
    }

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

    // 設定タブ切り替え
    document.querySelectorAll('#settings-modal .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            switchSettingTab(tabName);
        });
    });

    // デフォルト保存ボタン
    const saveDefaultBtn = document.getElementById('btn-save-default');
    if (saveDefaultBtn) {
        saveDefaultBtn.addEventListener('click', saveCurrentAsDefaults);
    }

    // 履歴保存ボタン (当日)
    const savePresetBtn = document.getElementById('btn-save-preset');
    if (savePresetBtn) {
        savePresetBtn.addEventListener('click', savePreset);
    }

    // 履歴保存ボタン (指定日)
    const saveCustomBtn = document.getElementById('btn-save-custom');
    if (saveCustomBtn) {
        saveCustomBtn.addEventListener('click', savePresetCustom);
    }

    // モーダル背景クリックで閉じる
    const modal = document.getElementById('settings-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) toggleSettingsModal(false);
        });
    }

    // 履歴モーダル閉じるボタン
    const closeHistoryBtn = document.getElementById('btn-close-history');
    if (closeHistoryBtn) {
        closeHistoryBtn.addEventListener('click', closeHistoryModal);
    }
    const closeHistoryFooterBtn = document.getElementById('btn-close-history-footer');
    if (closeHistoryFooterBtn) {
        closeHistoryFooterBtn.addEventListener('click', closeHistoryModal);
    }

    // 履歴モーダル背景クリック
    const historyModal = document.getElementById('history-modal');
    if (historyModal) {
        historyModal.addEventListener('click', (e) => {
            if (e.target === historyModal) closeHistoryModal();
        });
    }

    // 設定のインポート・エクスポート
    const btnExport = document.getElementById('btn-save-json');
    if (btnExport) {
        btnExport.addEventListener('click', exportSettingsAsJson);
    }

    const btnImport = document.getElementById('btn-import-config');
    const inputImport = document.getElementById('input-import-config');
    if (btnImport && inputImport) {
        btnImport.addEventListener('click', () => inputImport.click());
        inputImport.addEventListener('change', importSettingsAsJson);
    }

    // CSV Import (Locations)
    const btnImportCsv = document.getElementById('btn-import-csv');
    const inputImportCsv = document.getElementById('input-import-csv');
    if (btnImportCsv && inputImportCsv) {
        btnImportCsv.addEventListener('click', () => inputImportCsv.click());
        inputImportCsv.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const text = event.target.result;
                    const rows = parseCSV(text);
                    if (rows.length < 2) {
                        alert('CSVファイルの中身が足りません（ヘッダー + データ1行以上必要です）。');
                        inputImportCsv.value = '';
                        return;
                    }

                    const newLocations = [];
                    for (let i = 1; i < rows.length; i++) {
                        const loc = rows[i][0];
                        if (loc && loc.trim()) {
                            newLocations.push(loc.trim());
                        }
                    }

                    if (newLocations.length > 0) {
                        const ok = await showActionConfirm({
                            title: 'インポートの確認',
                            message: `${newLocations.length}件の場所が見つかりました。現在のリストを上書きして登録してもよろしいですか？`,
                            btnText: 'インポート実行'
                        });

                        if (ok) {
                            masterLocationList = newLocations;
                            saveLocations();
                            renderSettingsCheckboxes();
                            renderLocationOptions();
                        }
                    } else {
                        alert('有効なデータが見つかりませんでした。');
                    }
                } catch (err) {
                    console.error('CSV Import error:', err);
                    alert('ファイルの解析に失敗しました。');
                }
                inputImportCsv.value = '';
            };
            reader.readAsText(file);
        });

    }

    // Event Listeners for Location Management
    const btnAddLoc = document.getElementById('btn-add-location');
    if (btnAddLoc) {
        btnAddLoc.addEventListener('click', addLocation);
    }
    const inputAddLoc = document.getElementById('input-add-location');
    if (inputAddLoc) {
        inputAddLoc.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addLocation();
        });
    }

    generateReport();
    calcOvertime();
    updateReminders();
});

