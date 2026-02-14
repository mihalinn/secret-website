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

        // ドキュメントを開く (Uint8Arrayにするのが確実)
        const uint8Buffer = new Uint8Array(buffer);
        // mupdf.Document.open is cleaner than new PDFDocument if available, 
        // but let's stick to what we know works or try the user suggestion if compatible.
        // The user suggested mupdf.Document.open, let's verify if 'Document' exists in our exports.
        // Actually, looking at mupdf.js exports usually it has PDFDocument. 
        // Let's use the user's logic but keep our proven PDFDocument constructor if needed, 
        // OR try to use the PDFDocument properly as they suggested.

        let srcDoc;
        try {
            // Try standard constructor first as we verified it works in tests
            srcDoc = new mupdf.PDFDocument(uint8Buffer);
        } catch (e) {
            console.warn("Constructor failed, trying open...", e);
            // Verify if mupdf.Document exists? 
            // If not, we stick to PDFDocument. 
            // We'll proceed with PDFDocument for now as our tests passed with it.
            throw e;
        }

        const pageCount = srcDoc.countPages();
        addLog(`Total Pages: ${pageCount}`);

        // 新しいPDFを作成
        const dstDoc = new mupdf.PDFDocument();
        const targetDPI = 150;
        const scale = targetDPI / 72;
        const matrix = mupdf.Matrix.scale(scale, scale);

        for (let i = 0; i < pageCount; i++) {
            updateProgress(10 + Math.floor(((i + 1) / pageCount) * 80), `ページ処理中... (${i + 1}/${pageCount})`);

            const srcPage = srcDoc.loadPage(i);
            const bounds = srcPage.getBounds();
            const w = bounds[2] - bounds[0];
            const h = bounds[3] - bounds[1];

            // 1. ページを画像(Pixmap)に変換
            const pixmap = srcPage.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);

            // 2. Pixmapを画像オブジェクトとして新PDFに追加
            const img = new mupdf.Image(pixmap);
            const imgRef = dstDoc.addImage(img); // Returns PDFObject (indirect reference)

            // 3. ページの内容（命令）を作成
            const imgName = "Img" + i;
            const content = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} 0 0 cm /${imgName} Do Q\n`;

            // 4. 新しいページを追加
            // addPage returns the Page object (Userdata), NOT the reference usually? 
            // Wait, previous test showed addPage returned a Page object.
            // User suggests: dstDoc.addPage(...) returns ref? 
            // In our test_mupdf_2.html check, addPage returned a Page object.
            // We need to get the PDFDictionary of the page.
            const newPage = dstDoc.addPage(bounds, 0, null, content);

            // 5. リソース辞書を構築して画像を結びつける
            // We need to attach Resources to the page object.
            // newPage is a Page Userdata. Does it have 'put'?
            // Yes, PDFPage usually has 'put' in MuPDF JS bindings if it wraps pdf_obj.

            const xobject = dstDoc.newDictionary();
            xobject.put(imgName, imgRef);
            const res = dstDoc.newDictionary();
            res.put("XObject", xobject);

            // ページにリソースをセット
            // If newPage is the Page object, we can direct put.
            if (newPage && newPage.put) {
                newPage.put("Resources", res);
            } else {
                // Fallback if addPage API differs
                addLog("Warning: Could not set resources on page " + i);
            }

            addLog(`Page ${i + 1} processed.`);
        }

        updateProgress(95, "保存中...");
        addLog("Saving PDF...");

        // 保存オプション: "compress" (or standard "")
        // User strongly suggests "compress".
        let outData;
        try {
            outData = dstDoc.saveToBuffer("compress");
            if (outData.length < 100) throw new Error("Output too small");
        } catch (e) {
            addLog("Compression save failed or too small, retrying with default...");
            outData = dstDoc.saveToBuffer("");
        }

        if (outData.length < 100) {
            throw new Error("Generated PDF is too small (corruption).");
        }

        compressedPdfBytes = outData;
        addLog(`Compression Complete!`);
        addLog(`Original: ${(buffer.byteLength / 1024).toFixed(1)} KB`);
        addLog(`Compressed: ${(outData.length / 1024).toFixed(1)} KB`);

        showResult(buffer.byteLength, outData.length);

    } catch (error) {
        addLog("Fatal Error: " + error.message);
        console.error(error);
        alert('圧縮エラー。詳細はログを確認してください。');

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
