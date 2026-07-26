/**
 * search.js — 전체 메뉴 검색 (#/search)
 */

import { MENU_INDEX, DOMAINS } from '../data/menu-index.js';
import { getRecents, getFrequent } from '../utils/nav-recents.js';
import { isAdmin } from '../auth.js';

let _root  = null;
let _query = '';
let _menuIndex = MENU_INDEX; // role 필터 적용 후 캐싱
let _domains   = DOMAINS;

export async function mount(root) {
  _root  = root;
  _query = '';
  // role 필터: admin 전용 메뉴는 관리자에게만 노출
  const admin = isAdmin();
  _menuIndex = MENU_INDEX.filter(f => !f.roles || f.roles.includes('admin') ? admin : true);
  _domains   = DOMAINS.map(d => ({
    ...d,
    features: d.features.filter(f => !f.roles || f.roles.includes('admin') ? admin : true),
  })).filter(d => d.features.length > 0);
  _draw();
}

export function unmount() {
  _root  = null;
  _query = '';
}

function _draw() {
  if (!_root) return;

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">

  <!-- 검색 헤더 -->
  <div style="flex-shrink:0;padding:12px 16px 0;background:var(--bg)">
    <div style="display:flex;align-items:center;gap:10px;
                background:var(--card-bg);border:1.5px solid var(--border);
                border-radius:14px;padding:10px 14px">
      <span style="font-size:18px;flex-shrink:0">🔍</span>
      <input id="search-input" type="text" placeholder="기능, 메뉴 이름으로 검색..."
        value="${_esc(_query)}"
        style="flex:1;border:none;background:none;font-size:14px;color:var(--text);
               outline:none;min-width:0"
        autocomplete="off" autocorrect="off" spellcheck="false">
      <button id="search-clear" style="display:${_query ? 'flex' : 'none'};
        background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:16px;
        padding:0;align-items:center;flex-shrink:0">✕</button>
    </div>
  </div>

  <!-- 결과 영역 -->
  <div class="page-content" style="flex:1;overflow-y:auto;padding:12px 16px 24px" id="search-body">
    ${_query ? _renderResults() : _renderDefault()}
  </div>

</div>`;

  // 이벤트
  const input = _root.querySelector('#search-input');
  const clear = _root.querySelector('#search-clear');

  input.addEventListener('input', () => {
    _query = input.value;
    clear.style.display = _query ? 'flex' : 'none';
    _root.querySelector('#search-body').innerHTML =
      _query ? _renderResults() : _renderDefault();
    _bindItemClicks();
  });

  clear.addEventListener('click', () => {
    _query = '';
    input.value = '';
    clear.style.display = 'none';
    _root.querySelector('#search-body').innerHTML = _renderDefault();
    _bindItemClicks();
    input.focus();
  });

  // 자동 포커스
  setTimeout(() => input.focus(), 80);
  _bindItemClicks();
}

// ── 기본 화면 (검색어 없을 때) ────────────────────────────────

function _renderDefault() {
  const recents  = getRecents(6);
  const frequent = getFrequent(6);

  const recentItems = recents
    .map(r => _menuItemByHash(r.hash))
    .filter(Boolean);

  const freqItems = frequent
    .map(r => _menuItemByHash(r.hash))
    .filter(Boolean)
    .filter(f => !recentItems.find(r => r.hash === f.hash))
    .slice(0, 6);

  return `
${recentItems.length ? `
<div style="margin-bottom:20px">
  <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.06em;
              text-transform:uppercase;margin-bottom:10px">최근 방문</div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
    ${recentItems.map(item => _gridCard(item)).join('')}
  </div>
</div>` : ''}

${freqItems.length ? `
<div style="margin-bottom:20px">
  <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.06em;
              text-transform:uppercase;margin-bottom:10px">자주 쓰는 기능</div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
    ${freqItems.map(item => _gridCard(item)).join('')}
  </div>
</div>` : ''}

${!recentItems.length && !freqItems.length ? `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:48px;margin-bottom:12px">🔍</div>
  <div style="font-size:14px;font-weight:600;color:var(--text-muted);margin-bottom:6px">
    메뉴를 검색하세요
  </div>
  <div style="font-size:12px;line-height:1.7">
    휴가, 급여, 교육 등 기능 이름으로<br>빠르게 찾을 수 있습니다.
  </div>
</div>` : ''}

<!-- 도메인 빠른 탐색 -->
<div>
  <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.06em;
              text-transform:uppercase;margin-bottom:10px">도메인별 탐색</div>
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">
    ${_domains.map(d => `
    <button class="search-domain-btn" data-id="${d.id}"
      style="display:flex;align-items:center;gap:10px;padding:12px;
             background:var(--card-bg);border:1.5px solid var(--border);
             border-radius:12px;cursor:pointer;text-align:left;transition:border-color .15s">
      <span style="font-size:22px;flex-shrink:0">${d.icon}</span>
      <div style="min-width:0">
        <div style="font-size:12px;font-weight:700;color:var(--text);
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.nameKo}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:1px">${d.features.length}개 기능</div>
      </div>
    </button>`).join('')}
  </div>
</div>`;
}

// ── 검색 결과 ────────────────────────────────────────────────

function _renderResults() {
  const q = _query.toLowerCase().trim();
  const results = _menuIndex.filter(item =>
    item.title.toLowerCase().includes(q) ||
    item.domain.toLowerCase().includes(q)
  );

  if (!results.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:48px;margin-bottom:12px">😅</div>
  <div style="font-size:14px;font-weight:600;color:var(--text-muted);margin-bottom:6px">
    "${_esc(_query)}" 검색 결과가 없습니다
  </div>
  <div style="font-size:12px;margin-bottom:20px">다른 키워드로 검색해 보세요.</div>
  <button onclick="window.location.hash='#/ai-consult'"
    style="padding:9px 20px;background:#4F46E5;color:#fff;border:none;
           border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">
    🤖 AI 상담으로 찾아보기
  </button>
</div>`;

  // 도메인별 그룹핑
  const grouped = {};
  results.forEach(item => {
    if (!grouped[item.domain]) grouped[item.domain] = [];
    grouped[item.domain].push(item);
  });

  return `
<div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">
  <span style="font-weight:700;color:var(--text)">${results.length}개</span> 결과
</div>
${Object.entries(grouped).map(([domain, items]) => `
<div style="margin-bottom:16px">
  <div style="font-size:11px;font-weight:700;color:var(--text-muted);
              margin-bottom:8px;letter-spacing:.04em">${domain}</div>
  ${items.map(item => _listRow(item)).join('')}
</div>`).join('')}`;
}

// ── 카드 / 행 컴포넌트 ────────────────────────────────────────

function _gridCard(item) {
  return `
<button class="search-item-btn" data-hash="${item.hash}"
  style="display:flex;flex-direction:column;align-items:center;gap:6px;
         padding:14px 8px;background:var(--card-bg);border:1.5px solid var(--border);
         border-radius:12px;cursor:pointer;text-align:center;transition:border-color .15s,background .15s">
  <span style="font-size:24px">${item.icon}</span>
  <span style="font-size:11px;font-weight:600;color:var(--text);line-height:1.3;
               word-break:keep-all">${_esc(item.title)}</span>
  <span style="font-size:9px;padding:2px 6px;border-radius:6px;
               background:${item.domainBg || '#F1F5F9'};color:${item.domainColor || 'var(--text-muted)'};
               font-weight:600">${item.domain}</span>
</button>`;
}

function _listRow(item) {
  return `
<button class="search-item-btn" data-hash="${item.hash}"
  style="display:flex;align-items:center;gap:12px;width:100%;padding:11px 12px;
         background:var(--card-bg);border:1.5px solid var(--border);border-radius:10px;
         cursor:pointer;margin-bottom:6px;text-align:left;transition:border-color .15s">
  <span style="font-size:22px;flex-shrink:0">${item.icon}</span>
  <div style="flex:1;min-width:0">
    <div style="font-size:13px;font-weight:600;color:var(--text)">${_esc(item.title)}</div>
    <div style="font-size:10px;color:var(--text-muted);margin-top:1px">${item.domain}</div>
  </div>
  <span style="font-size:14px;color:#CBD5E1;flex-shrink:0">›</span>
</button>`;
}

// ── 클릭 이벤트 바인딩 ────────────────────────────────────────

function _bindItemClicks() {
  if (!_root) return;

  _root.querySelectorAll('.search-item-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.hash = btn.dataset.hash;
    });
  });

  _root.querySelectorAll('.search-domain-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _query = _domains.find(d => d.id === btn.dataset.id)?.nameKo || '';
      const input = _root.querySelector('#search-input');
      if (input) input.value = _query;
      const clear = _root.querySelector('#search-clear');
      if (clear) clear.style.display = 'flex';
      _root.querySelector('#search-body').innerHTML = _renderResults();
      _bindItemClicks();
    });
  });
}

// ── 유틸 ─────────────────────────────────────────────────────

function _menuItemByHash(hash) {
  return _menuIndex.find(m => m.hash === hash) || null;
}

function _esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
