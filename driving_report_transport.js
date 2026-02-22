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
