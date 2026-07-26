/**
 * bulletin-admin.js — 게시판 관리 (관리자)
 */

import { showToast } from '../../components/toast.js'
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_bulletin_posts';

const LEGACY_IDS = new Set(['BP001', 'BP002', 'BP003', 'BP004', 'BP005']);

const today = new Date().toISOString().slice(0, 10);

function _load() {
  try {
    const d = JSON.parse(localStorage.getItem(LS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_IDS.has(r.id));
    if (cleaned.length !== list.length) _save(cleaned);
    return cleaned;
  } catch { return []; }
}
function _save(list) { localStorage.setItem(LS, JSON.stringify(list)); }

let _tab = 'all';
let _root = null;

export function render(root) { _root = root; _tab = 'all'; _draw(); }
export function unmount() { _root = null;
  _tab = 'all';
}

function _draw() {
  const all     = _load();
  const flagged = all.filter(p => p.status === 'flagged');
  const todayPosts = all.filter(p => p.date === today);

  // Category stats
  const catMap = {};
  all.forEach(p => {
    if (p.status === 'removed') return;
    const key = p.categoryLabel || p.category;
    catMap[key] = (catMap[key] || 0) + 1;
  });

  const tabs = [
    { key:'all',      label:`전체 게시물 (${all.filter(p=>p.status!=='removed').length})` },
    { key:'flagged',  label:`신고됨 (${flagged.length})` },
    { key:'catstat',  label:'카테고리 통계' },
  ];

  let listHtml = '';
  if (_tab === 'all') {
    const visible = all.filter(p => p.status !== 'removed');
    listHtml = visible.length === 0
      ? `<div style="text-align:center;padding:48px 0;color:#94A3B8">
           <div style="font-size:36px;margin-bottom:8px">&#128218;</div>
           <div style="font-size:13px">게시물이 없습니다.</div>
         </div>`
      : visible.map(p => _postCard(p, false)).join('');
  } else if (_tab === 'flagged') {
    listHtml = flagged.length === 0
      ? `<div style="text-align:center;padding:48px 0;color:#94A3B8">
           <div style="font-size:36px;margin-bottom:8px">&#128683;</div>
           <div style="font-size:13px">신고된 게시물이 없습니다.</div>
         </div>`
      : flagged.map(p => _postCard(p, true)).join('');
  } else {
    listHtml = Object.entries(catMap).length === 0
      ? `<div style="text-align:center;padding:48px 0;color:#94A3B8"><div style="font-size:13px">데이터 없음</div></div>`
      : Object.entries(catMap).sort((a,b)=>b[1]-a[1]).map(([cat, cnt]) => {
          const maxCnt = Math.max(...Object.values(catMap));
          const pct = Math.round((cnt / maxCnt) * 100);
          return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
    <span style="font-size:13px;font-weight:600;color:var(--text)">${cat}</span>
    <span style="font-size:13px;font-weight:700;color:#4F46E5">${cnt}건</span>
  </div>
  <div style="background:#E2E8F0;border-radius:4px;height:8px;overflow:hidden">
    <div style="width:${pct}%;background:#4F46E5;height:100%;border-radius:4px;transition:width 0.3s"></div>
  </div>
</div>`;
        }).join('');
  }

  _root.innerHTML = `
<div style="padding:16px;max-width:600px;margin:0 auto">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button id="bl-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text)">&#8592;</button>
    <h2 style="margin:0;font-size:17px;font-weight:700;color:var(--text)">게시판 관리</h2>
  </div>

  <!-- Stats -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
    ${[
      { label:'총 게시물', val:all.filter(p=>p.status!=='removed').length, color:'#4F46E5' },
      { label:'신고됨',    val:flagged.length,    color:'#EF4444' },
      { label:'오늘 등록', val:todayPosts.length, color:'#10B981' },
    ].map(s=>`
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;text-align:center">
      <div style="font-size:20px;font-weight:700;color:${s.color}">${s.val}</div>
      <div style="font-size:11px;color:#64748B;margin-top:2px">${s.label}</div>
    </div>`).join('')}
  </div>

  <!-- Tabs -->
  <div style="display:flex;gap:6px;margin-bottom:14px;overflow-x:auto;padding-bottom:2px">
    ${tabs.map(t=>`
    <button class="bl-tab" data-tab="${t.key}" style="
      padding:7px 14px;font-size:12px;font-weight:600;border-radius:20px;cursor:pointer;white-space:nowrap;
      border:1.5px solid ${_tab===t.key?'#4F46E5':'var(--border)'};
      background:${_tab===t.key?'#EEF2FF':'var(--card-bg)'};
      color:${_tab===t.key?'#4F46E5':'#64748B'}">${t.label}</button>`).join('')}
  </div>

  <!-- List -->
  <div id="bl-list">${listHtml}</div>
</div>`;

  _bindEvents();
}

function _postCard(p, showRestore) {
  return `
<div style="background:var(--card-bg);border:1px solid ${p.status==='flagged'?'#FECACA':'var(--border)'};border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="flex:1;margin-right:8px">
      <div style="font-size:13px;font-weight:700;color:var(--text);line-height:1.4">${p.title}</div>
      <div style="font-size:11px;color:#64748B;margin-top:2px">${p.authorName} · ${p.categoryLabel} · ${p.date}</div>
    </div>
    ${p.status === 'flagged' ? `<span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;background:#FEE2E2;color:#EF4444;white-space:nowrap">신고됨</span>` : ''}
  </div>
  <div style="display:flex;gap:12px;font-size:11px;color:#94A3B8;margin-bottom:10px">
    <span>&#128065; ${p.views}</span>
    <span>&#10084; ${p.likes}</span>
  </div>
  <div style="display:flex;gap:8px">
    ${showRestore ? `<button class="bl-restore" data-id="${p.id}" style="flex:1;padding:8px;background:#10B981;color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer">복원</button>` : ''}
    <button class="bl-delete" data-id="${p.id}" style="flex:1;padding:8px;background:#EF4444;color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer">삭제</button>
  </div>
</div>`;
}

function _bindEvents() {
  _root.querySelector('#bl-back')?.addEventListener('click', () => window.navBack());

  _root.querySelectorAll('.bl-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.tab; _draw(); });
  });

  _root.querySelectorAll('.bl-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('게시물을 삭제하시겠습니까?')) return;
      const all = _load();
      const idx = all.findIndex(p => p.id === btn.dataset.id);
      if (idx < 0) return;
      all[idx].status = 'removed';
      _save(all);
      showToast('게시물이 삭제되었습니다.');
      addNotification({ type: 'success', title: '게시판 관리', body: '게시물이 삭제되었습니다.' });
      _draw();
    });
  });

  _root.querySelectorAll('.bl-restore').forEach(btn => {
    btn.addEventListener('click', () => {
      const all = _load();
      const idx = all.findIndex(p => p.id === btn.dataset.id);
      if (idx < 0) return;
      all[idx].status = 'active';
      _save(all);
      showToast('게시물이 복원되었습니다.');
      addNotification({ type: 'success', title: '게시판 관리', body: '게시물이 복원되었습니다.' });
      _draw();
    });
  });
}
export function mount(root) { return render(root); }
