// ============================================================
//  勤怠詳細作成ツール - attendance.js
// ============================================================

// --------------------------------------------------
//  定数
// --------------------------------------------------
const STANDARD_START = '09:00';
const STANDARD_END = '17:45';
const DEFAULT_RETURN = '16:00';

const DEFAULTS = {
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
//  初期化
// --------------------------------------------------
// --------------------------------------------------
//  初期化
// --------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
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

    generateReport();
    calcOvertime();
});
