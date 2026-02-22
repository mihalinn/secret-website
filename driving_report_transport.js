/**
 * driving_report_transport.js
 * 外部（GAS）へのデータ送信、JSONエクスポート
 */

/**
 * JSONファイルとして保存
 */
function saveJsonReport() {
    const data = collectReportData();
    const fileName = `driving_report_${data.date}_${data.driver1 || '未選択'}.json`;
    const jsonStr = JSON.stringify(data, null, 2);

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * GASへ報告書を送信
 */
async function sendReport() {
    const url = document.getElementById('gas-url-input').value;
    const statusMsg = document.getElementById('status-msg');

    if (!url) {
        statusMsg.textContent = 'GASのURLが設定されていません';
        statusMsg.className = 'status-msg status-error';
        return;
    }

    if (!url.startsWith('https://')) {
        statusMsg.textContent = 'https:// で始まるURLのみ送信可能です';
        statusMsg.className = 'status-msg status-error';
        return;
    }

    const data = collectReportData();

    if (!data.date || !data.vehicleId || !data.driver1) {
        statusMsg.textContent = '日付、車両、記録1の運転者名は必須です';
        statusMsg.className = 'status-msg status-error';
        return;
    }

    if (!data.passcode) {
        statusMsg.textContent = '送信パスコードが設定されていません';
        statusMsg.className = 'status-msg status-error';
        return;
    }

    statusMsg.textContent = '送信中...';
    statusMsg.className = 'status-msg';

    const logContainer = document.getElementById('error-log-container');
    const logArea = document.getElementById('error-log');
    if (logContainer) logContainer.style.display = 'none';
    if (logArea) logArea.value = '';

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseText = await response.text();
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            if (responseText.includes('成功') || responseText.includes('success')) {
                result = { status: 'success' };
            } else {
                throw new Error('サーバーからの応答が解析できませんでした: ' + responseText);
            }
        }

        if (result.status === 'success') {
            statusMsg.textContent = '送信しました！';
            statusMsg.className = 'status-msg status-success';
        } else {
            throw new Error(`サーバーエラー: ${result.message || 'Unknown error'}`);
        }

    } catch (e) {
        console.error(e);
        statusMsg.textContent = '送信に失敗しました';
        statusMsg.className = 'status-msg status-error';

        if (logContainer && logArea) {
            logContainer.style.display = 'block';
            const timestamp = new Date().toISOString();
            logArea.value = `[${timestamp}]\nエラー: ${e.message}\n\nURL: ${url}`;
        }
    }
}

/* ============================================================
   クラウド同期 - GASからデータ取得・表示
   ============================================================ */

/**
 * GASから指定年月・車両のデータを1ヶ月分取得する
 */
async function fetchMonthlyData() {
    const url = document.getElementById('gas-url-input').value;
    const year = document.getElementById('cloud-year-select').value;
    const month = document.getElementById('cloud-month-select').value;
    const vehicleId = document.getElementById('cloud-vehicle-select').value;
    const passcode = document.getElementById('sys-passcode-input').value;

    const statusLabel = document.getElementById('cloud-status-label');
    const updateTime = document.getElementById('cloud-last-update');
    const indicatorWrap = document.getElementById('cloud-indicator-wrap');
    const ssWrap = document.getElementById('cloud-ss-wrap');
    const emptyMsg = document.getElementById('cloud-empty-msg');

    if (!url || !year || !month || !vehicleId) {
        if (statusLabel) statusLabel.textContent = '条件を選択してください';
        return;
    }

    if (statusLabel) statusLabel.textContent = '同期中...';
    if (indicatorWrap) {
        indicatorWrap.classList.remove('active', 'error');
        indicatorWrap.classList.add('syncing');
    }

    try {
        const dateParam = `${year}-${month}-01`;
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({ action: 'read', date: dateParam, vehicleId, passcode, isMonthly: true }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();

        if (result.status === 'success' && result.values) {
            renderCloudSheet(result.values, year, month);

            if (ssWrap) ssWrap.style.display = 'block';
            if (emptyMsg) emptyMsg.style.display = 'none';
            if (statusLabel) statusLabel.textContent = '読込完了';
            if (indicatorWrap) {
                indicatorWrap.classList.remove('syncing');
                indicatorWrap.classList.add('active');
            }
            if (updateTime) updateTime.textContent = `更新: ${new Date().toLocaleTimeString()}`;

            // 現在入力中の日付があれば、その「前日までの最新メーター」で齟齬チェック・引き継ぎを行う
            const reportDate = document.getElementById('report-date').value;
            if (reportDate && reportDate.startsWith(`${year}-${month}`)) {
                const dayNum = parseInt(reportDate.split('-')[2], 10);
                // 当日より前の全データを対象にする
                const historicalValues = result.values.slice(0, (dayNum - 1) * 3);
                checkMeterConsistency(historicalValues);
            }
        } else {
            throw new Error(result.message || 'データなし');
        }
    } catch (e) {
        console.error('[Cloud] fetchMonthlyData error:', e);
        if (statusLabel) statusLabel.textContent = 'エラー';
        if (indicatorWrap) {
            indicatorWrap.classList.remove('syncing');
            indicatorWrap.classList.add('error');
        }
        if (updateTime) updateTime.textContent = '失敗: ' + e.message;
    }
}

/**
 * スプレッドシートを再現する水平テーブル形式で描画
 * GAS仕様: 1日3行、各行0-indexed で列番号に対応
 */
function renderCloudSheet(values, year, month) {
    const container = document.getElementById('cloud-cards-container');
    if (!container) return;

    const C = {
        driver: 2, destination: 3,
        checkTime: 6,
        checkFace: 7, checkTel: 9,
        checker: 11,
        alcAri: 12, alcNashi: 14,
        startTime: 16, endTime: 17,
        startMeter: 18, endMeter: 19, distance: 20,
        over400: 21, refuel: 22, inspection: 23, notes: 24, vehicleReturn: 25
    };

    const chk = (v) => v === true ? '☑' : '☐';
    const v = (val) => (val !== null && val !== undefined && val !== '') ? val : '';
    const fmtTime = (val) => {
        if (!val && val !== 0) return '';
        const s = String(val);
        const m = s.match(/T(\d{2}):(\d{2})/);
        return m ? `${m[1]}:${m[2]}` : s;
    };

    let bodyHtml = '';
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
        const dayIdx = (d - 1) * 3;
        const dayRowsRaw = values.slice(dayIdx, dayIdx + 3);
        if (dayRowsRaw.length === 0) break;

        const dateObj = new Date(year, month - 1, d);
        const dayLabel = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];
        const isSun = dayLabel === '日';
        const isSat = dayLabel === '土';

        const rows = dayRowsRaw.map((row, idx) => ({
            driver: v(row[C.driver]),
            dest: v(row[C.destination]),
            checkTime: fmtTime(row[C.checkTime]),
            checkFace: chk(row[C.checkFace]),
            checkTel: chk(row[C.checkTel]),
            checker: v(row[C.checker]),
            alcAri: chk(row[C.alcAri]),
            alcNashi: chk(row[C.alcNashi]),
            startTime: fmtTime(row[C.startTime]),
            endTime: fmtTime(row[C.endTime]),
            startMeter: v(row[C.startMeter]),
            endMeter: v(row[C.endMeter]),
            hasEndMeter: row[C.endMeter] !== '' && row[C.endMeter] != null,
            distance: v(row[C.distance]),
            over400: row[C.over400] === true,
            refuel: idx === 0 ? v(row[C.refuel]) : (idx === 1 ? v(row[C.refuel]) : ''),
            inspection: chk(row[C.inspection]),
            notes: idx === 0 ? v(row[C.notes]) : '',
            vehicleReturn: v(row[C.vehicleReturn]),
        }));

        bodyHtml += rows.map((r, idx) => `
            <tr class="${r.over400 ? 'crt-over400' : ''}">
                ${idx === 0 ? `<td rowspan="3" class="crt-td-date ${isSun ? 'crt-sun' : isSat ? 'crt-sat' : ''}">${d}</td>` : ''}
                ${idx === 0 ? `<td rowspan="3" class="crt-td-day ${isSun ? 'crt-sun' : isSat ? 'crt-sat' : ''}">${dayLabel}</td>` : ''}
                <td class="crt-td-driver">${r.driver}</td>
                <td class="crt-td-dest">${r.dest}</td>
                ${idx < 2 ? `
                    <td class="crt-td-center">${r.checkTime}</td>
                    <td class="crt-td-chk">${r.checkFace}</td><td class="crt-lbl">対面</td>
                    <td class="crt-td-chk">${r.checkTel}</td><td class="crt-lbl">電話</td>
                    <td class="crt-td-center">${r.checker}</td>
                    <td class="crt-td-chk">${r.alcAri}</td><td class="crt-lbl">有</td>
                    <td class="crt-td-chk">${r.alcNashi}</td><td class="crt-lbl">無</td>
                ` : `
                    <td></td><td></td><td></td><td></td><td></td>
                    <td></td><td></td><td></td><td></td><td></td>
                `}
                <td class="crt-td-center">${r.startTime}</td>
                <td class="crt-td-center">${r.endTime}</td>
                <td class="crt-td-meter">${r.startMeter}</td>
                <td class="crt-td-meter ${r.hasEndMeter ? 'crt-meter-end' : ''}">${r.endMeter}</td>
                <td class="crt-td-meter">${r.distance ? r.distance + ' km' : ''}</td>
                <td class="crt-td-center">${r.inspection}</td>
                <td class="crt-td-chk">${r.over400 ? '☑' : '☐'}</td>
                <td class="crt-td-meter">${idx === 0 ? (r.refuel ? r.refuel + ' L' : '') : idx === 1 ? (r.distance ? r.distance + ' km' : '') : ''}</td>
                <td class="crt-td-notes">${r.notes}</td>
                <td class="crt-td-center">${r.vehicleReturn}</td>
            </tr>`).join('');
    }

    const html = `
    <div class="crt-scroll">
    <table class="crt-table">
        <thead>
            <tr class="crt-head1">
                <th rowspan="2" class="crt-th-date">日</th>
                <th rowspan="2" class="crt-th-day">曜</th>
                <th rowspan="2" class="crt-th-sm">運転者</th>
                <th rowspan="2" class="crt-th-dest">訪問先・現場名等</th>
                <th colspan="10" class="crt-th-group">ALC確認<br><span style="font-size:0.6rem;font-weight:400;opacity:0.7">上段:乗車前／下段:乗車後</span></th>
                <th colspan="2">発着時刻</th>
                <th colspan="3" class="crt-th-group">メーター数</th>
                <th rowspan="2" class="crt-th-xs">点検</th>
                <th rowspan="2" class="crt-th-xs">400<br>超過</th>
                <th rowspan="2" class="crt-th-xs">上:給油<br><span style="font-size:0.6rem;opacity:0.7">下:km</span></th>
                <th rowspan="2" class="crt-th-notes">特記事項</th>
                <th rowspan="2" class="crt-th-xs">持帰</th>
            </tr>
            <tr class="crt-head2">
                <th class="crt-th-xs">確認時刻</th>
                <th colspan="2" class="crt-th-xs">対面</th>
                <th colspan="2" class="crt-th-xs">電話</th>
                <th class="crt-th-sm">確認者</th>
                <th colspan="2" class="crt-th-xs">有</th>
                <th colspan="2" class="crt-th-xs">無</th>
                <th class="crt-th-xs">出発</th>
                <th class="crt-th-xs">到着</th>
                <th class="crt-th-meter">開始m</th>
                <th class="crt-th-meter">終了m</th>
                <th class="crt-th-meter">距離</th>
            </tr>
        </thead>
        <tbody>
            ${bodyHtml}
        </tbody>
    </table>
    </div>`;

    container.innerHTML = html;

    // 現在のズーム値を再適用
    const zoomRange = document.getElementById('cloud-zoom-range');
    if (zoomRange && typeof applyCloudZoom === 'function') {
        applyCloudZoom(zoomRange.value);
    }
}



/**
 * スプレッドシートの終了メーターをフォームの開始メーターに自動引き継ぎ
 */
function checkMeterConsistency(values) {
    let lastEndMeter = null;
    for (let i = values.length - 1; i >= 0; i--) {
        const val = parseFloat(values[i][19]); // T列: 終了メーター
        if (!isNaN(val) && val > 0) {
            lastEndMeter = val;
            break;
        }
    }

    if (lastEndMeter === null) return;

    const startMeter1 = document.getElementById('start-meter-1');
    if (!startMeter1) return;

    if (!startMeter1.value) {
        // 空欄の場合は自動補完
        startMeter1.value = lastEndMeter;
        startMeter1.dispatchEvent(new Event('input'));
        console.log('[Cloud] 開始メーター自動引き継ぎ:', lastEndMeter);
    } else {
        const currentVal = parseFloat(startMeter1.value);
        if (currentVal !== lastEndMeter) {
            console.warn('[Cloud] メーター齟齬 - クラウド:', lastEndMeter, '/ フォーム入力:', currentVal);
        }
    }
}

window.fetchMonthlyData = fetchMonthlyData;

