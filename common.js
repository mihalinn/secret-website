// ============================================================
//  共通スクリプト - common.js
// ============================================================

// --------------------------------------------------
//  テーマ切替
// --------------------------------------------------
function toggleTheme() {
    const root = document.documentElement;
    const isLight = root.getAttribute('data-theme') === 'light';
    const newTheme = isLight ? 'dark' : 'light';

    root.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeButton(newTheme);

    // テーマ変更イベントを発火（各ツールが必要に応じてリッスン）
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: newTheme } }));
}

/** テーマボタンのアイコンを更新 */
function updateThemeButton(theme) {
    const btn = document.getElementById('theme-btn');
    if (!btn) return;
    const moon = btn.querySelector('.icon-moon');
    const sun = btn.querySelector('.icon-sun');
    if (moon && sun) {
        moon.style.display = theme === 'light' ? 'none' : 'block';
        sun.style.display = theme === 'light' ? 'block' : 'none';
    } else {
        // Fallback for pages without SVG icons yet
        btn.textContent = theme === 'light' ? '\u2600' : '\u263E';
    }
}

/** 保存済みテーマを適用（各ページの初期化前に呼ぶ） */
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButton(savedTheme);
}

// ページ読み込み時にテーマを適用
document.addEventListener('DOMContentLoaded', initTheme);

/** 簡易CSVパース関数 */
function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    return lines.map(line => {
        const result = [];
        let startValueIndex = 0;
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') {
                inQuotes = !inQuotes;
            } else if (line[i] === ',' && !inQuotes) {
                result.push(line.substring(startValueIndex, i).replace(/^"(.*)"$/, '$1').replace(/""/g, '"'));
                startValueIndex = i + 1;
            }
        }
        result.push(line.substring(startValueIndex).replace(/^"(.*)"$/, '$1').replace(/""/g, '"'));
        return result;
    });
}
