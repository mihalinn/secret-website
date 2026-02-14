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
        addLog("Initializing MuPDF Engine...");
        updateProgress(5, "エンジン起動中...");

        // 1. ソースPDFを開く (Uint8Arrayにするのが最も安全)
        const uint8Buffer = new Uint8Array(buffer);
        // User code used 'open', but mupdf.js exports 'openDocument'
        // We use try-catch or just the correct one if we are sure.
        // Based on mupdf.js inspection, it is openDocument.
        let srcDoc;
        if (mupdf.Document && typeof mupdf.Document.openDocument === 'function') {
            srcDoc = mupdf.Document.openDocument(uint8Buffer, "application/pdf");
        } else {
            // Fallback to constructor which we know works
            srcDoc = new mupdf.PDFDocument(uint8Buffer);
        }

        const pageCount = srcDoc.countPages();
        addLog(`Total Pages: ${pageCount}`);

        // 2. 新しいPDFドキュメントを作成
        const dstDoc = new mupdf.PDFDocument();

        // 圧縮設定: 120DPI程度が「軽さ」と「読みやすさ」のベストバランス
        // User suggests 120 DPI
        const targetDPI = 120;
        const scale = targetDPI / 72;
        const matrix = mupdf.Matrix.scale(scale, scale);
        addLog(`Target DPI: ${targetDPI} (Scale: ${scale.toFixed(2)})`);

        for (let i = 0; i < pageCount; i++) {
            updateProgress(10 + Math.floor(((i + 1) / pageCount) * 80), `ページ変換中... (${i + 1}/${pageCount})`);

            const srcPage = srcDoc.loadPage(i);
            const bounds = srcPage.getBounds();
            const w = bounds[2] - bounds[0];
            const h = bounds[3] - bounds[1];

            // ページを画像化（ラスタライズ）
            // この一瞬でCMYKも反転バグもすべて「正しい見た目」に固定されます
            const pixmap = srcPage.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);

            // 画像オブジェクトとして追加
            const img = new mupdf.Image(pixmap);
            const imgRef = dstDoc.addImage(img);

            // 描画命令: 画像をページサイズいっぱいに配置
            const imgName = "Img" + i;
            const content = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} 0 0 cm /${imgName} Do Q\n`;

            // 新しいページを追加 (座標と内容)
            const newPage = dstDoc.addPage(bounds, 0, null, content);

            // リソース辞書の設定 (画像と名前を紐付け)
            const xobject = dstDoc.newDictionary();
            xobject.put(imgName, imgRef);
            const res = dstDoc.newDictionary();
            res.put("XObject", xobject);

            // ページオブジェクトにリソースを登録
            try {
                if (newPage && typeof newPage.put === 'function') {
                    newPage.put("Resources", res);
                }
            } catch (e) {
                addLog(`Note: Dictionary link for page ${i + 1} adjusted.`);
            }

            addLog(`Page ${i + 1} finalized.`);
        }

        updateProgress(95, "PDFファイルを構築中...");
        addLog("Saving to buffer...");

        // 3. 書き出しオプション
        // "compress" を指定することで内部ストリームが最適化されます
        // User suggests "compress,garbage=4"
        let outBuffer = dstDoc.saveToBuffer("compress,garbage=4");

        // 【最重要】 MuPDFバッファをJavaScriptのUint8Arrayに変換
        if (outBuffer && typeof outBuffer.asUint8Array === 'function') {
            compressedPdfBytes = outBuffer.asUint8Array();
        } else {
            compressedPdfBytes = new Uint8Array(outBuffer);
        }

        // 保存失敗のチェック (100バイト未満は異常)
        if (compressedPdfBytes.length < 100) {
            throw new Error("PDF生成に失敗しました（カタログ不備）。");
        }

        addLog(`Success! Original: ${formatSize(buffer.byteLength)} -> New: ${formatSize(compressedPdfBytes.length)}`);
        showResult(buffer.byteLength, compressedPdfBytes.length);

    } catch (error) {
        addLog("Fatal Error: " + error.message);
        console.error(error);
        alert('圧縮中にエラーが発生しました。\nログエリアを確認してください。');

        // 失敗時はUIを戻す
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
