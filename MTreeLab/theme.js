/* Apply before styles load, so a saved night theme never flashes a light page. */
(function () {
  'use strict';
  const key = 'mtree-theme';
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const valid = value => value === 'light' || value === 'dark';
  let choice = null;
  try {
    const saved = localStorage.getItem(key);
    if (valid(saved)) choice = saved;
  } catch { /* Theme switching still works when storage is unavailable. */ }

  function apply(theme) {
    root.dataset.theme = theme;
    const dark = theme === 'dark';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111c23' : '#f8f7f2');
    const button = document.getElementById('theme-toggle');
    if (button) {
      button.setAttribute('aria-pressed', String(dark));
      button.title = dark ? '切换日间模式 / Switch to light mode' : '切换暗夜模式 / Switch to dark mode';
      button.querySelector('.theme-label').textContent = dark ? '日间' : '暗夜';
    }
  }

  const preferred = () => choice || (system.matches ? 'dark' : 'light');
  apply(preferred());
  document.addEventListener('DOMContentLoaded', () => {
    apply(preferred());
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      choice = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, choice); } catch { /* Session-only fallback. */ }
      apply(choice);
    });
  });
  system.addEventListener('change', () => { if (!choice) apply(preferred()); });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    choice = valid(event.newValue) ? event.newValue : null;
    apply(preferred());
  });
})();
