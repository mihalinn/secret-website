/**
 * driving_report_scanner.js
 * QRコードスキャン関連のロジック
 */

/**
 * QRスキャナーを開始
 */
function startQrScanner() {
    const modal = document.getElementById('qr-scan-modal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const statusEl = document.getElementById('qr-status');
    statusEl.textContent = 'カメラを起動しています...';
    statusEl.style.color = 'var(--text-secondary)';

    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("qr-reader");
    }

    const qrboxSize = (viewWidth, viewHeight) => {
        const minEdge = Math.min(viewWidth, viewHeight);
        const size = Math.floor(minEdge * 0.7);
        return { width: size, height: size };
    };

    const config = {
        fps: 10,
        qrbox: qrboxSize,
        aspectRatio: 1.0
    };

    html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
            console.log(`QR Scanned: ${decodedText}`);
            handleScannedQr(decodedText);
        },
        (errorMessage) => { /* ignore parse errors */ }
    ).then(() => {
        statusEl.textContent = 'QRコードをスキャンしてください';
        statusEl.style.color = 'var(--accent)';
    }).catch(err => {
        console.error(err);
        statusEl.textContent = 'カメラの起動に失敗しました。';
        statusEl.style.color = '#ff6b6b';
    });
}

/**
 * QRスキャナーを停止
 */
function stopQrScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            console.log("QR Scanner stopped.");
        }).catch(err => console.error(err));
    }
    document.getElementById('qr-scan-modal').style.display = 'none';
    document.body.style.overflow = '';
}

/**
 * スキャン結果の処理
 */
function handleScannedQr(decodedText) {
    let vehicleName = "";
    if (decodedText.includes('vehicle=')) {
        const urlParams = new URLSearchParams(decodedText.split('?')[1]);
        vehicleName = urlParams.get('vehicle');
    } else {
        vehicleName = decodedText;
    }

    if (vehicleName) {
        const select = document.getElementById('vehicle-id');
        const options = Array.from(select.options).map(o => o.value);

        if (options.includes(vehicleName)) {
            select.value = vehicleName;
            try {
                localStorage.setItem(LAST_VEHICLE_KEY, vehicleName);
            } catch (e) { console.error('Scanner save error', e); }

            // 履歴読み込みと保存
            if (typeof loadFromHistory === 'function') {
                const dateEl = document.getElementById('report-date');
                loadFromHistory(dateEl.value, vehicleName);
            }
            if (typeof saveToLocal === 'function') saveToLocal();

            const statusEl = document.getElementById('qr-status');
            statusEl.textContent = `車両「${vehicleName}」を選択しました！`;
            statusEl.style.color = '#4ade80';

            setTimeout(stopQrScanner, 1000);
        } else {
            alert(`車両「${vehicleName}」がリストに見つかりません。設定から追加してください。`);
        }
    }
}

/**
 * URLパラメータの処理
 */
function handleUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const vehicleName = urlParams.get('vehicle');

    if (vehicleName) {
        const select = document.getElementById('vehicle-id');
        const options = Array.from(select.options).map(o => o.value);
        if (options.includes(vehicleName)) {
            select.value = vehicleName;
            try {
                localStorage.setItem(LAST_VEHICLE_KEY, vehicleName);
            } catch (e) { }
            if (typeof loadFromHistory === 'function') {
                const dateEl = document.getElementById('report-date');
                loadFromHistory(dateEl.value, vehicleName);
            }
        }
    }
}
