// ============================================================
//  PDF圧縮ツール - pdfcompress.js
//  MuPDF (WASM) 完全リライト版 - 全ページラスタライズ方式
//  "Re-distilling" Strategy: PDF -> Image -> New PDF
// ============================================================

import * as mupdf from './mupdf.js';

// グローバル変数
let pdfBytes = null;
let compressedPdfBytes = null;
let processLog = []; // ログ配列

// ログ出力用関数
function addLog(msg) {
    console.log(msg);
    processLog.push(msg);
    const logArea = document.getElementById('log-area');
    if (logArea) {
        logArea.value = processLog.join('\n');
        logArea.scrollTop = logArea.scrollHeight;
    }
}

// ログ表示切り替え
window.toggleLog = function () {
    const logArea = document.getElementById('log-area');
    if (logArea) {
        logArea.style.display = (logArea.style.display === 'none') ? 'block' : 'none';
    }
};

// ファイル選択時の処理
window.handleFileSelect = async function (event) {
    let file = null;
    if (event.target && event.target.files) {
        file = event.target.files[0];
    } else if (event.dataTransfer && event.dataTransfer.files) {
        file = event.dataTransfer.files[0];
    }

    if (!file) return;

    if (file.type !== 'application/pdf') {
        alert('PDFファイルを選択してください。');
        return;
    }

    // UIリセット (ID修正: upload-area -> drop-zone & settings-panel separation)
    // HTML構造: 
    // - drop-zone (初期表示)
    // - settings-panel (ファイル選択後)
    // - progress-area (処理中)
    // - result-area (完了後)

    document.getElementById('drop-zone').style.display = 'none';
    document.getElementById('settings-panel').style.display = 'none';

    // Show progress area
    const progressArea = document.getElementById('progress-area');
    if (progressArea) progressArea.style.display = 'block';

    document.getElementById('result-area').style.display = 'none';

    processLog = [];
    const logArea = document.getElementById('log-area');
    if (logArea) logArea.value = '';

    // プログレスバー初期化
    updateProgress(0, '準備中...');

    try {
        pdfBytes = await file.arrayBuffer();
        addLog(`File loaded: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

        // 圧縮開始
        setTimeout(() => startCompress(pdfBytes), 100);
    } catch (error) {
        console.error(error);
        alert('ファイルの読み込みに失敗しました。');
        resetAll();
    }
};

// 圧縮のメイン処理
window.startCompress = async function (buffer) {
    try {
        addLog("Initializing MuPDF WASM...");
        updateProgress(5, "エンジン起動中...");

        if (!mupdf) throw new Error("MuPDF module not loaded.");

        addLog("Loading Source PDF...");
        updateProgress(10, "PDF解析中...");

        let srcDoc;
        try {
            srcDoc = new mupdf.PDFDocument(buffer);
        } catch (e) {
            srcDoc = new mupdf.PDFDocument(new Uint8Array(buffer));
        }

        const pageCount = srcDoc.countPages();
        addLog(`Total Pages: ${pageCount}`);

        const dstDoc = new mupdf.PDFDocument();
        const targetDPI = 150;
        const scale = targetDPI / 72;
        const matrix = mupdf.Matrix.scale(scale, scale);
        addLog(`Target DPI: ${targetDPI} (Scale: ${scale.toFixed(2)})`);

        for (let i = 0; i < pageCount; i++) {
            const progress = 10 + Math.floor(((i + 1) / pageCount) * 80);
            updateProgress(progress, `ページ処理中... (${i + 1}/${pageCount})`);
            addLog(`Processing Page ${i + 1}...`);

            try {
                const srcPage = srcDoc.loadPage(i);
                const bounds = srcPage.getBounds();
                const w = bounds[2] - bounds[0];
                const h = bounds[3] - bounds[1];

                const pixmap = srcPage.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);
                const img = new mupdf.Image(pixmap);
                const imgRef = dstDoc.addImage(img);

                const imgName = "I" + i;
                const content = `q ${w} 0 0 ${h} 0 0 cm /${imgName} Do Q`;
                const newPage = dstDoc.addPage(bounds, 0, null, content);

                const xobjDict = dstDoc.newDictionary();
                xobjDict.put(imgName, imgRef);
                const resDict = dstDoc.newDictionary();
                resDict.put("XObject", xobjDict);
                newPage.put("Resources", resDict);

                addLog(` -> Rasterized & Added.`);
            } catch (err) {
                addLog(`Error on verification page ${i + 1}: ${err.message}`);
            }
        }

        updateProgress(95, "ファイル生成中...");
        addLog("Saving PDF...");

        // "compress" or "clean" or "linearize"
        // compress-images is for ghostscript/cpdf commonly, mupdf JS might just take "compress"
        const outData = dstDoc.saveToBuffer("compress");

        compressedPdfBytes = outData;
        addLog(`Compression Complete!`);
        addLog(`Original: ${(buffer.byteLength / 1024).toFixed(1)} KB`);
        addLog(`Compressed: ${(outData.length / 1024).toFixed(1)} KB`);

        showResult(buffer.byteLength, outData.length);

    } catch (error) {
        addLog("Fatal Error: " + error.message);
        console.error(error);
        alert('圧縮中にエラーが発生しました。\n詳細はログを確認してください。');

        const progressArea = document.getElementById('progress-area');
        if (progressArea) progressArea.style.display = 'none';

        const dropZone = document.getElementById('drop-zone');
        if (dropZone) dropZone.style.display = 'block';
    }
};

function updateProgress(percent, text) {
    const bar = document.getElementById('progress-fill'); // ID fixed: progress-bar-fill -> progress-fill?
    // Check HTML: id="progress-fill"
    const txt = document.getElementById('progress-text');
    if (bar) bar.style.width = percent + '%';
    if (txt) txt.textContent = text;
}

window.resetAll = function () {
    location.reload();
};

window.downloadResult = function () {
    if (!compressedPdfBytes) return;
    const blob = new Blob([compressedPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'compressed_mupdf.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

function showResult(originalSize, compressedSize) {
    document.getElementById('progress-area').style.display = 'none';
    document.getElementById('result-area').style.display = 'flex';

    document.getElementById('original-size').textContent = formatSize(originalSize);
    document.getElementById('compressed-size').textContent = formatSize(compressedSize);

    const reduction = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
    document.getElementById('reduction-rate').textContent = `${reduction}%`;
}

function formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================================
//  Event Listeners Initialization
// ============================================================

const initApp = () => {
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('drop-zone');

    if (fileInput) {
        fileInput.addEventListener('change', window.handleFileSelect);
    }

    if (dropZone) {
        dropZone.addEventListener('click', () => {
            if (fileInput) fileInput.click();
        });

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        dropZone.addEventListener('dragover', () => {
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            dropZone.classList.remove('dragover');
            const dt = e.dataTransfer;
            const files = dt.files;

            // Call handleFileSelect with mock event
            window.handleFileSelect({ target: { files: files } });
        });
    }

    // Check if mupdf loaded
    if (typeof mupdf !== 'undefined') {
        addLog("System Ready. Waiting for file...");
    } else {
        addLog("Warning: MuPDF module not yet loaded.");
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
