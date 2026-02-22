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
    return {
        date: document.getElementById('report-date').value,
        vehicleId: document.getElementById('vehicle-id').value,
        preCheckTime: document.getElementById('pre-check-time').value,
        preCheckMethod: document.getElementById('pre-check-method').value,
        preChecker: document.getElementById('pre-checker').value,
        preAlcohol: document.querySelector('input[name="pre-alcohol"]:checked')?.value || '',
        preAlcoholVal: document.getElementById('pre-alcohol-val').value,

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
