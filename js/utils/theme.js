/**
 * theme.js — Dark / Light mode manager
 *
 * Persists user preference in localStorage.
 * Applies data-theme="dark" | "light" to <html>.
 */

const LS_KEY     = 'hr_theme';
const DARK_ATTR  = 'data-theme';
let _btnEl       = null;

// ── Public ─────────────────────────────────────────────────────

export function initTheme() {
  const saved = localStorage.getItem(LS_KEY);
  // Respect system preference when no stored value
  if (saved) {
    _apply(saved);
  } else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    _apply('dark');
  }
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute(DARK_ATTR) || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  _apply(next);
  localStorage.setItem(LS_KEY, next);
  _updateBtn();
}

export function isDark() {
  return document.documentElement.getAttribute(DARK_ATTR) === 'dark';
}

/** Mount a theme-toggle button into `container` and return it. */
export function mountThemeToggle(container) {
  if (_btnEl) return;
  _btnEl = document.createElement('button');
  _btnEl.id = 'theme-toggle-btn';
  _btnEl.setAttribute('aria-label', '테마 전환');
  Object.assign(_btnEl.style, {
    position:   'fixed',
    top:        '10px',
    right:      '52px',  // left of notification bell (~42px wide)
    zIndex:     '1100',
    width:      '36px',
    height:     '36px',
    borderRadius: '50%',
    border:     'none',
    background: 'var(--surface-raised)',
    boxShadow:  'var(--shadow-sm)',
    cursor:     'pointer',
    fontSize:   '1rem',
    display:    'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background var(--transition-base)',
  });
  _updateBtn();
  _btnEl.addEventListener('click', toggleTheme);
  document.body.appendChild(_btnEl);
}

export function unmountThemeToggle() {
  if (_btnEl) { _btnEl.remove(); _btnEl = null; }
}

// ── Internal ────────────────────────────────────────────────────

function _apply(theme) {
  document.documentElement.setAttribute(DARK_ATTR, theme);
}

function _updateBtn() {
  if (_btnEl) _btnEl.textContent = isDark() ? '☀️' : '🌙';
}
