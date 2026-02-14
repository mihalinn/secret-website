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
    'middle-type-2': '',
    'visit-count-2': '',
    'return-type': '(帰社)',
    'return-time': DEFAULT_RETURN,
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

    if (startType === '(早出)') {
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
function generateReport() {
    const startType = val('start-type');
    const startTime = formatTime(val('start-time'));
    const conn1 = val('conn-1');

    const midType = val('middle-type');
    const midCount = val('visit-count');
    const middle = midType + midCount;

    // 業務2（空でなければ追加）
    const midType2 = val('middle-type-2');
    const midCount2 = val('visit-count-2');
    const middle2 = midType2 ? ' ' + midType2 + midCount2 : '';

    const retType = val('return-type');
    const retTime = formatTime(val('return-time'));
    const retPart = retType ? retType + retTime : '';

    const conn2 = val('conn-2');
    const endContent = val('end-content');
    const endType = val('end-type');
    const endTime = formatTime(val('end-time'));

    const result = `${startType}${startTime}${conn1}${middle}${middle2}${retPart}${conn2}${endContent}${endType}${endTime}`;

    document.getElementById('result-text').textContent = result;

    // 早出なのに09:00以降の検証
    const startEl = document.getElementById('start-time');
    const startMin = getMinutes(val('start-time'));
    const stdStartMin = getMinutes(STANDARD_START);

    if (val('start-type') === '(早出)' && startMin >= stdStartMin) {
        startEl.style.borderColor = '#f87171';
        startEl.style.boxShadow = '0 0 0 1px rgba(248,113,113,0.5)';
    } else {
        startEl.style.borderColor = '';
        startEl.style.boxShadow = '';
    }

    // 帰着時刻 > 就業時刻の検証
    const retEl = document.getElementById('return-time');
    const returnMin = getMinutes(val('return-time'));
    const endMin = getMinutes(val('end-time'));

    if (returnMin > endMin) {
        retEl.style.borderColor = '#f87171';
        retEl.style.boxShadow = '0 0 0 1px rgba(248,113,113,0.5)';
    } else {
        retEl.style.borderColor = '';
        retEl.style.boxShadow = '';
    }

    // 就業時刻 < 17:45 の検証
    const endEl = document.getElementById('end-time');
    const endMin2 = getMinutes(val('end-time'));
    const stdEndMin = getMinutes(STANDARD_END);

    if (endMin2 < stdEndMin) {
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
window.addEventListener('DOMContentLoaded', () => {
    // 全入力要素に変更リスナーを登録
    document.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('input', () => {
            generateReport();
            calcOvertime();
        });
    });

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
