/**
 * nav-recents.js — 방문 기록 유틸
 * 검색 페이지(search.js)와 홈 대시보드(dashboard.js)에서 사용
 */

const LS_KEY = 'hr_nav_recents';
const MAX    = 20;

// 제외할 라우트 (기록 불필요)
const SKIP = new Set([
  '#/login', '#/register', '#/mode', '#/persona-select',
  '#/change-password', '#/search', '#/dashboard',
]);

function _load() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}

function _save(list) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}

/**
 * 라우트 방문 기록 — app.js 라우트 전환마다 호출
 */
export function recordVisit(hash) {
  if (!hash || SKIP.has(hash)) return;
  const now  = Date.now();
  const list = _load();
  const idx  = list.findIndex(r => r.hash === hash);

  if (idx !== -1) {
    list[idx].count++;
    list[idx].lastAt = now;
    // 최신 항목을 앞으로
    const [item] = list.splice(idx, 1);
    list.unshift(item);
  } else {
    list.unshift({ hash, count: 1, lastAt: now });
  }

  _save(list.slice(0, MAX));
}

/**
 * 최근 방문 n개 반환 (시간순)
 */
export function getRecents(n = 5) {
  return _load().slice(0, n);
}

/**
 * 자주 쓴 기능 n개 반환 (방문 횟수순)
 */
export function getFrequent(n = 5) {
  return [..._load()]
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

/**
 * 기록 초기화
 */
export function clearRecents() {
  _save([]);
}
