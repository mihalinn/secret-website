/**
 * 走行距離の計算
 */
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
window.calcDistance = calcDistance;

/**
 * フォームにデータを流し込む
 */
function fillForm(data) {
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    setVal('vehicle-id', data.vehicleId);
    setVal('driver-name-1', data.driver1);
    setVal('driver-name-2', data.driver2);
    setVal('driver-name-3', data.driver3);

    setVal('pre-check-time', data.preCheckTime);
    setVal('pre-check-method', data.preCheckMethod);
    setVal('pre-checker', data.preChecker);
    setVal('pre-alcohol-val', data.preAlcoholVal);

    const preAlcoholRadios = document.querySelectorAll('input[name="pre-alcohol"]');
    preAlcoholRadios.forEach(r => r.checked = false);
    if (data.preAlcohol) {
        const r = document.querySelector(`input[name="pre-alcohol"][value="${data.preAlcohol}"]`);
        if (r) r.checked = true;
    }

    // Rows 1-3
    for (let i = 1; i <= 3; i++) {
        setVal(`destination-${i}`, data[`destination${i}`]);
        setVal(`start-time-${i}`, data[`startTime${i}`]);
        setVal(`start-meter-${i}`, data[`startMeter${i}`]);
        setVal(`end-time-${i}`, data[`endTime${i}`]);
        setVal(`end-meter-${i}`, data[`endMeter${i}`]);
        setVal(`vehicle-return-${i}`, data[`vehicleReturn${i}`]);

        const preInspRadios = document.querySelectorAll(`input[name="pre-inspection-${i}"]`);
        preInspRadios.forEach(r => r.checked = false);
        if (data[`preInspection${i}`]) {
            const r = document.querySelector(`input[name="pre-inspection-${i}"][value="${data[`preInspection${i}`]}"]`);
            if (r) r.checked = true;
        }
    }

    toggleRowIfHasData(2, data);
    toggleRowIfHasData(3, data);

    // 距離の再計算トリガー
    ['start-meter-1', 'end-meter-1', 'start-meter-2', 'end-meter-2', 'start-meter-3', 'end-meter-3'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value) el.dispatchEvent(new Event('input'));
    });
    if (typeof calcDistance === 'function') calcDistance();

    setVal('post-check-time', data.postCheckTime);
    setVal('post-check-method', data.postCheckMethod);
    setVal('post-checker', data.postChecker);

    const postAlcoholRadios = document.querySelectorAll('input[name="post-alcohol"]');
    postAlcoholRadios.forEach(r => r.checked = false);
    if (data.postAlcohol) {
        const r = document.querySelector(`input[name="post-alcohol"][value="${data.postAlcohol}"]`);
        if (r) r.checked = true;
    }

    setVal('refuel-amount', data.refuelAmount);
    setVal('refuel-meter', data.refuelMeter);
    setVal('notes', data.notes);

    if (data.preAlcohol) {
        const r = document.querySelector(`input[name="pre-alcohol"][value="${data.preAlcohol}"]`);
        if (r) r.dispatchEvent(new Event('change'));
    }
}

/**
 * フォームの完全リセット
 */
function resetForm() {
    // 1. ローカル履歴を明示的に削除
    if (typeof removeFromHistory === 'function') removeFromHistory();

    // 2. UIのリセット
    const vehicleEl = document.getElementById('vehicle-id');
    if (vehicleEl) vehicleEl.value = '';

    resetFormExceptHeader();

    console.log('[Form] Reset complete (UI & History)');
}

/**
 * ヘッダー（日付・車両）以外のフィールドをリセット
 */
function resetFormExceptHeader() {
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };

    setVal('pre-check-time', '');
    setVal('pre-check-method', '対面');
    setVal('pre-checker', '');
    setVal('pre-alcohol-val', '');
    document.querySelectorAll('input[name="pre-alcohol"]').forEach(r => r.checked = false);
    document.getElementById('pre-alcohol-val').style.display = 'none';

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

/**
 * データがある場合に行を展開
 */
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

/**
 * フォームデータの収集
 */
function collectReportData() {
    /**
     * 記録2・3が閉じている or 実質未使用（時刻・到着メーター未入力）なら空データ
     */
    function isRecordUsed(rowNum) {
        if (rowNum === 1) return true;
        const body = document.getElementById(`row-${rowNum}-body`);
        if (!body || body.style.display === 'none') return false;
        // 開いていても時刻も到着メーターもなければ未使用
        const endTime = document.getElementById(`end-time-${rowNum}`)?.value;
        const endMeter = document.getElementById(`end-meter-${rowNum}`)?.value;
        return !!(endTime || endMeter);
    }

    function getRowData(n) {
        if (!isRecordUsed(n)) {
            return { driver: '', destination: '', startTime: '', startMeter: '', preInspection: '', endTime: '', endMeter: '', distance: '0', vehicleReturn: '' };
        }
        return {
            driver: document.getElementById(`driver-name-${n}`).value,
            destination: document.getElementById(`destination-${n}`).value,
            startTime: document.getElementById(`start-time-${n}`).value,
            startMeter: document.getElementById(`start-meter-${n}`).value,
            preInspection: document.querySelector(`input[name="pre-inspection-${n}"]:checked`)?.value || '',
            endTime: document.getElementById(`end-time-${n}`).value,
            endMeter: document.getElementById(`end-meter-${n}`).value,
            distance: document.getElementById(`calc-distance-${n}`).textContent,
            vehicleReturn: document.getElementById(`vehicle-return-${n}`).value,
        };
    }

    const r1 = getRowData(1);
    const r2 = getRowData(2);
    const r3 = getRowData(3);

    return {
        date: document.getElementById('report-date').value,
        vehicleId: document.getElementById('vehicle-id').value,
        preCheckTime: document.getElementById('pre-check-time').value,
        preCheckMethod: document.getElementById('pre-check-method').value,
        preChecker: document.getElementById('pre-checker').value,
        preAlcohol: document.querySelector('input[name="pre-alcohol"]:checked')?.value || '',
        preAlcoholVal: document.getElementById('pre-alcohol-val').value,

        driver1: r1.driver, destination1: r1.destination,
        startTime1: r1.startTime, startMeter1: r1.startMeter,
        preInspection1: r1.preInspection, endTime1: r1.endTime,
        endMeter1: r1.endMeter, distance1: r1.distance,
        vehicleReturn1: r1.vehicleReturn,

        driver2: r2.driver, destination2: r2.destination,
        startTime2: r2.startTime, startMeter2: r2.startMeter,
        preInspection2: r2.preInspection, endTime2: r2.endTime,
        endMeter2: r2.endMeter, distance2: r2.distance,
        vehicleReturn2: r2.vehicleReturn,

        driver3: r3.driver, destination3: r3.destination,
        startTime3: r3.startTime, startMeter3: r3.startMeter,
        preInspection3: r3.preInspection, endTime3: r3.endTime,
        endMeter3: r3.endMeter, distance3: r3.distance,
        vehicleReturn3: r3.vehicleReturn,

        totalDistance: document.getElementById('calc-distance-total').textContent,
        isOver400km: parseFloat(document.getElementById('calc-distance-total').textContent || '0') > 400,

        postCheckTime: document.getElementById('post-check-time').value,
        postCheckMethod: document.getElementById('post-check-method').value,
        postChecker: document.getElementById('post-checker').value,
        postAlcohol: document.querySelector('input[name="post-alcohol"]:checked')?.value || '',

        refuelAmount: document.getElementById('refuel-amount').value,
        refuelMeter: document.getElementById('refuel-meter').value,
        notes: document.getElementById('notes').value,
        passcode: document.getElementById('sys-passcode-input').value
    };
}

window.fillForm = fillForm;
window.resetForm = resetForm;
window.resetFormExceptHeader = resetFormExceptHeader;
window.collectReportData = collectReportData;

/**
 * フォームバリデーション（送信時に警告表示。ブロックはしない）
 * @returns {boolean} 問題がなければ true
 */
function validateForm() {
    // 前回のエラー表示をクリア
    document.querySelectorAll('.validation-error').forEach(el => el.classList.remove('validation-error'));
    document.querySelectorAll('.validation-warning').forEach(el => el.remove());

    const errors = [];

    // 必須チェック対象
    const requiredFields = [
        { id: 'vehicle-id', label: '車両' },
        { id: 'driver-name-1', label: '記録1 運転者' },
        { id: 'destination-1', label: '記録1 訪問先' },
        { id: 'start-time-1', label: '記録1 出発時刻' },
        { id: 'end-time-1', label: '記録1 到着時刻' },
        { id: 'start-meter-1', label: '記録1 出発メーター' },
        { id: 'end-meter-1', label: '記録1 到着メーター' },
        { id: 'pre-check-time', label: '乗車前 確認時刻' },
        { id: 'pre-checker', label: '乗車前 確認者' },
        { id: 'post-check-time', label: '乗車後 確認時刻' },
        { id: 'post-checker', label: '乗車後 確認者' },
    ];

    // 記録2・3が開いている場合は追加
    for (let i = 2; i <= 3; i++) {
        const body = document.getElementById(`row-${i}-body`);
        if (body && body.style.display !== 'none') {
            requiredFields.push(
                { id: `driver-name-${i}`, label: `記録${i} 運転者` },
                { id: `start-time-${i}`, label: `記録${i} 出発時刻` },
                { id: `end-time-${i}`, label: `記録${i} 到着時刻` },
                { id: `start-meter-${i}`, label: `記録${i} 出発メーター` },
                { id: `end-meter-${i}`, label: `記録${i} 到着メーター` },
            );
        }
    }

    // 未入力チェック
    requiredFields.forEach(f => {
        const el = document.getElementById(f.id);
        if (el && !el.value) {
            el.classList.add('validation-error');
            errors.push(f.label);
        }
    });

    // 時間・メーター矛盾チェック
    const timeWarnings = checkTimeConflicts();

    // 最初のエラー要素にスクロール
    const firstError = document.querySelector('.validation-error');
    if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    return errors.length === 0 && timeWarnings.length === 0;
}

/**
 * 時間・メーター矛盾チェック
 */
function checkTimeConflicts() {
    const warnings = [];

    for (let i = 1; i <= 3; i++) {
        const body = i === 1 ? true : (document.getElementById(`row-${i}-body`)?.style.display !== 'none');
        if (!body) continue;

        const startTime = document.getElementById(`start-time-${i}`)?.value;
        const endTime = document.getElementById(`end-time-${i}`)?.value;
        const startMeter = parseFloat(document.getElementById(`start-meter-${i}`)?.value);
        const endMeter = parseFloat(document.getElementById(`end-meter-${i}`)?.value);

        // 到着時刻 < 出発時刻
        if (startTime && endTime && endTime < startTime) {
            const el = document.getElementById(`end-time-${i}`);
            if (el) {
                el.classList.add('validation-error');
                showWarningBadge(el, `到着が出発より前です`);
            }
            warnings.push(`記録${i}: 到着時刻が出発時刻より前`);
        }

        // 到着メーター < 出発メーター
        if (!isNaN(startMeter) && !isNaN(endMeter) && endMeter < startMeter) {
            const el = document.getElementById(`end-meter-${i}`);
            if (el) {
                el.classList.add('validation-error');
                showWarningBadge(el, `到着メーターが出発より小さいです`);
            }
            warnings.push(`記録${i}: メーター逆転`);
        }
    }

    // 記録間の時系列チェック
    for (let i = 1; i <= 2; i++) {
        const nextBody = document.getElementById(`row-${i + 1}-body`);
        if (!nextBody || nextBody.style.display === 'none') continue;

        const prevEnd = document.getElementById(`end-time-${i}`)?.value;
        const nextStart = document.getElementById(`start-time-${i + 1}`)?.value;
        if (prevEnd && nextStart && nextStart < prevEnd) {
            const el = document.getElementById(`start-time-${i + 1}`);
            if (el) {
                el.classList.add('validation-error');
                showWarningBadge(el, `記録${i}の到着より前です`);
            }
            warnings.push(`記録${i + 1}の出発が記録${i}の到着より前`);
        }
    }

    return warnings;
}

/**
 * 警告バッジを要素の近くに表示
 */
function showWarningBadge(el, message) {
    const badge = document.createElement('div');
    badge.className = 'validation-warning';
    badge.textContent = '⚠️ ' + message;
    el.closest('.form-group')?.appendChild(badge);
}

/**
 * 記録2展開時にメーター自動コピー
 */
function copyMeterToRecord(fromRow, toRow) {
    const endMeter = document.getElementById(`end-meter-${fromRow}`);
    const startMeter = document.getElementById(`start-meter-${toRow}`);
    if (endMeter && startMeter && endMeter.value && !startMeter.value) {
        startMeter.value = endMeter.value;
    }
}

/**
 * メーターをlocalStorageにバックアップ
 */
function backupMeter(meterId) {
    const el = document.getElementById(meterId);
    if (el && el.value) {
        localStorage.setItem(LAST_METER_KEY, el.value);
    }
}

window.validateForm = validateForm;
window.checkTimeConflicts = checkTimeConflicts;
window.copyMeterToRecord = copyMeterToRecord;
window.backupMeter = backupMeter;
