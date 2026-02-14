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
    if (btn) btn.textContent = theme === 'light' ? '\u2600' : '\u263E';
}

/** 保存済みテーマを適用（各ページの初期化前に呼ぶ） */
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButton(savedTheme);
}

// ページ読み込み時にテーマを適用
document.addEventListener('DOMContentLoaded', initTheme);
