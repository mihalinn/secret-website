/* ============================================================
   PDF圧縮ツール - pdfcompress.js (pdf-lib In-place Version)
   ============================================================ */

const { PDFDocument, PDFName, PDFRawStream } = PDFLib;

// グローバル変数
let pdfBytes = null;
let compressedPdfBytes = null;
let processLog = [];

// --------------------------------------------------
//  UI Helpers
// --------------------------------------------------

function addLog(msg) {
    console.log(msg);
    processLog.push(msg);
    const logArea = document.getElementById('log-area');
    if (logArea) {
        logArea.value = processLog.join('\n');
        logArea.scrollTop = logArea.scrollHeight;
    }
}

function updateProgress(percent, text) {
    const bar = document.getElementById('progress-fill');
    const txt = document.getElementById('progress-text');
    if (bar) bar.style.width = percent + '%';
    if (txt) txt.textContent = text;
}

window.toggleLog = function () {
    const logArea = document.getElementById('log-area');
    if (logArea) {
        logArea.style.display = (logArea.style.display === 'none') ? 'block' : 'none';
    }
};

window.resetAll = function () {
    pdfBytes = null;
    compressedPdfBytes = null;
    document.getElementById('drop-zone').style.display = 'flex';
    document.getElementById('settings-panel').style.display = 'none';
    document.getElementById('progress-area').style.display = 'none';
    document.getElementById('result-area').style.display = 'none';
    processLog = [];
    if (document.getElementById('log-area')) document.getElementById('log-area').value = '';
};

// --------------------------------------------------
//  File Handling
// --------------------------------------------------

window.handleFileSelect = async function (event) {
    let file = null;
    if (event.target && event.target.files && event.target.files.length > 0) {
        file = event.target.files[0];
    } else if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        file = event.dataTransfer.files[0];
    }

    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        alert('PDFファイルを選択してください。');
        return;
    }

    // UI状態のリセット
    document.getElementById('drop-zone').style.display = 'none';
    document.getElementById('progress-area').style.display = 'none';
    document.getElementById('result-area').style.display = 'none';
    document.getElementById('settings-panel').style.display = 'flex';

    processLog = [];
    addLog(`File selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    document.getElementById('file-info').textContent = file.name;
    document.getElementById('file-meta').textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;

    try {
        pdfBytes = await file.arrayBuffer();
        // プレビュー表示
        generatePreview(pdfBytes);
    } catch (err) {
        console.error(err);
        alert('ファイルの読み込みに失敗しました。');
        window.resetAll();
    }
};

async function generatePreview(buffer) {
    try {
        // Preview は MuPDF を使用（高速なため。mupdf.jsが読み込まれている前提）
        if (typeof mupdf === 'undefined') return;
        const srcDoc = mupdf.Document.openDocument(new Uint8Array(buffer), "application/pdf");
        const srcPage = srcDoc.loadPage(0);
        const pixmap = srcPage.toPixmap(mupdf.Matrix.scale(0.2, 0.2), mupdf.ColorSpace.DeviceRGB, false);
        const canvas = document.getElementById('preview-canvas');
        if (canvas) {
            canvas.width = pixmap.getWidth();
            canvas.height = pixmap.getHeight();
            const ctx = canvas.getContext('2d');
            const imageData = ctx.createImageData(canvas.width, canvas.height);
            imageData.data.set(pixmap.getSamples());
            ctx.putImageData(imageData, 0, 0);
        }
    } catch (e) {
        console.warn("Preview failed", e);
    }
}

// --------------------------------------------------
//  Core Compression Logic (pdf-lib In-place)
// --------------------------------------------------

window.startCompress = async function () {
    if (!pdfBytes) return;

    document.getElementById('settings-panel').style.display = 'none';
    document.getElementById('progress-area').style.display = 'block';
    updateProgress(0, "PDFの読み込み中...");

    await new Promise(r => setTimeout(r, 50));

    try {
        const quality = parseInt(document.getElementById('quality-slider').value) / 100;
        const targetDpi = parseInt(document.getElementById('dpi-slider').value);

        addLog(`処理開始: 画質=${quality}, 目標DPI=${targetDpi}`);

        // 1. PDFを読み込む
        const pdfDoc = await PDFDocument.load(pdfBytes, {
            ignoreEncryption: true,
            updateMetadata: false
        });

        // 2. 画像オブジェクトを検索
        const images = [];
        pdfDoc.context.enumerateIndirectObjects().forEach(([ref, obj]) => {
            if (obj instanceof PDFRawStream) {
                const dict = obj.dict;
                if (dict.get(PDFName.of('Subtype')) === PDFName.of('Image')) {
                    images.push({ ref, obj, dict });
                }
            }
        });

        addLog(`検出画像数: ${images.length}`);

        let compressedCount = 0;
        let skippedCount = 0;

        for (let i = 0; i < images.length; i++) {
            const { ref, obj, dict } = images[i];
            updateProgress(Math.floor((i / images.length) * 90), `画像 ${i + 1}/${images.length}...`);

            try {
                // 画像属性の取得
                const filter = dict.get(PDFName.of('Filter'))?.toString();
                const widthObj = pdfDoc.context.lookup(dict.get(PDFName.of('Width')));
                const heightObj = pdfDoc.context.lookup(dict.get(PDFName.of('Height')));

                if (!widthObj || !heightObj) { skippedCount++; continue; }

                // pdf-lib の内部表現に対応した数値取得
                const width = widthObj.numberValue || widthObj.value || (typeof widthObj.toString === 'function' ? Number(widthObj.toString()) : 0);
                const height = heightObj.numberValue || heightObj.value || (typeof heightObj.toString === 'function' ? Number(heightObj.toString()) : 0);

                // 現状、再圧縮は JPEG (/DCTDecode) に最適化
                if (filter !== '/DCTDecode') {
                    skippedCount++;
                    continue;
                }

                const originalBytes = obj.getContents();

                // 解像度調整（スケール計算: 150dpiを基準とする簡易ロジック）
                const scale = Math.min(1.0, targetDpi / 150);
                const compressedBytes = await recompressImage(originalBytes, quality, scale, width, height);

                if (compressedBytes && compressedBytes.length < originalBytes.length) {
                    // 新しい画像リソースを一旦作成（属性取得のため）
                    const newImage = await pdfDoc.embedJpg(compressedBytes);
                    const newImageStream = pdfDoc.context.lookup(newImage.ref);

                    // 元のオブジェクトIDの実体（obj）の中身を、新しい画像データで直接上書き
                    // これにより、PDF内部の参照関係（ページリソースなど）を壊さずに軽量化が可能
                    obj.contents = compressedBytes;
                    obj.dict.set(PDFName.of('Length'), PDFLib.PDFNumber.of(compressedBytes.length));

                    // 解像度（Width/Height）も必要に応じて更新
                    const dw = Math.floor(width * scale);
                    const dh = Math.floor(height * scale);
                    obj.dict.set(PDFName.of('Width'), PDFLib.PDFNumber.of(dw));
                    obj.dict.set(PDFName.of('Height'), PDFLib.PDFNumber.of(dh));

                    compressedCount++;
                    addLog(`[Obj ${ref.objectNumber}] 圧縮OK: ${originalBytes.length} -> ${compressedBytes.length}`);
                } else {
                    skippedCount++;
                }

            } catch (imageErr) {
                console.warn(`画像処理エラー [Obj ${ref.objectNumber}]:`, imageErr);
                skippedCount++;
            }
        }

        updateProgress(95, "保存中...");
        const finalBytes = await pdfDoc.save();
        compressedPdfBytes = finalBytes;

        addLog(`完了: ${compressedCount}枚圧縮, ${skippedCount}枚スキップ`);
        showResult(pdfBytes.byteLength, compressedPdfBytes.length);

    } catch (err) {
        addLog("Error: " + err.message);
        console.error(err);
        alert("エラーが発生しました。");
        window.resetAll();
    }
};

/**
 * 画像の再圧縮（Canvas使用）
 */
async function recompressImage(bytes, quality, scale, width, height) {
    return new Promise((resolve, reject) => {
        const blob = new Blob([bytes], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        const img = new Image();

        img.onload = () => {
            URL.revokeObjectURL(url);

            const dw = Math.floor(width * scale);
            const dh = Math.floor(height * scale);

            const canvas = document.createElement('canvas');
            canvas.width = dw;
            canvas.height = dh;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, dw, dh);

            canvas.toBlob((blob) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(new Uint8Array(reader.result));
                reader.readAsArrayBuffer(blob);
            }, 'image/jpeg', quality);
        };

        img.onerror = (e) => {
            URL.revokeObjectURL(url);
            reject(e);
        };

        img.src = url;
    });
}

function showResult(original, compressed) {
    document.getElementById('progress-area').style.display = 'none';
    document.getElementById('result-area').style.display = 'block';

    document.getElementById('original-size').textContent = formatSize(original);
    document.getElementById('compressed-size').textContent = formatSize(compressed);
    const rate = ((original - compressed) / original * 100).toFixed(1);
    document.getElementById('reduction-rate').textContent = `${rate}%`;
}

function formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

window.downloadResult = function () {
    if (!compressedPdfBytes) return;
    const blob = new Blob([compressedPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'compressed_managed.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// --------------------------------------------------
//  Settings UI Logic
// --------------------------------------------------

window.selectPreset = function (btn) {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const dpi = btn.dataset.dpi;
    const quality = btn.dataset.quality;

    document.getElementById('dpi-slider').value = dpi;
    document.getElementById('dpi-value').textContent = dpi;
    document.getElementById('quality-slider').value = quality;
    document.getElementById('quality-value').textContent = quality + '%';
};

// --------------------------------------------------
//  Initialization
// --------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    const mainCard = document.getElementById('main-card');
    const fileInput = document.getElementById('file-input');

    const dpiSlider = document.getElementById('dpi-slider');
    dpiSlider.addEventListener('input', (e) => {
        document.getElementById('dpi-value').textContent = e.target.value;
    });

    const qualitySlider = document.getElementById('quality-slider');
    qualitySlider.addEventListener('input', (e) => {
        document.getElementById('quality-value').textContent = e.target.value + '%';
    });

    const preventDefaults = (e) => { e.preventDefault(); e.stopPropagation(); };

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(name => {
        mainCard.addEventListener(name, preventDefaults, false);
    });

    mainCard.addEventListener('dragover', () => { mainCard.classList.add('drag-over'); });

    ['dragleave', 'drop'].forEach(name => {
        mainCard.addEventListener(name, () => { mainCard.classList.remove('drag-over'); });
    });

    mainCard.addEventListener('drop', window.handleFileSelect);

    document.getElementById('drop-zone').addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', window.handleFileSelect);
});
