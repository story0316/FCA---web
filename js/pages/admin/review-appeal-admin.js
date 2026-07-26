/**
 * review-appeal-admin.js — 평가 이의 신청 관리 (관리자)
 */

import { showToast } from '../../components/toast.js';
import { addNotification, addNotificationForUser } from '../../components/notification-hub.js';

const LS = 'hr_review_appeals';

const LEGACY_IDS = new Set(['RA001','RA002','RA003']);

const STATUS_META = {
  pending:   { label:'접수',      color:'#F59E0B', bg:'#FEF3C7' },
  reviewing: { label:'검토 중',   color:'#3B82F6', bg:'#DBEAFE' },
  resolved:  { label:'처리 완료', color:'#10B981', bg:'#D1FAE5' },
  rejected:  { label:'기각',      color:'#EF4444', bg:'#FEE2E2' },
};

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

let _tab = 'pending';
let _root = null;

export function render(root) { _root = root; _tab = 'pending'; _draw(); }
export function unmount() { _root = null;
  _tab = 'pending';
}

function _draw() {
  const all       = _load();
  const pending   = all.filter(r => r.status === 'pending');
  const reviewing = all.filter(r => r.status === 'reviewing');
  const resolved  = all.filter(r => r.status === 'resolved');

  const tabs = [
    { key:'pending', label:`처리 대기 (${pending.length + reviewing.length})` },
    { key:'all',     label:`전체 (${all.length})` },
  ];

  const list = _tab === 'pending' ? all.filter(r => r.status === 'pending' || r.status === 'reviewing') : all;

  _root.innerHTML = `
<div style="padding:16px;max-width:600px;margin:0 auto">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button id="ra-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text)">&#8592;</button>
    <h2 style="margin:0;font-size:17px;font-weight:700;color:var(--text)">평가 이의 신청 관리</h2>
  </div>

  <!-- Stats -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
    ${[
      { label:'접수',      val:pending.length,   color:'#F59E0B' },
      { label:'검토 중',   val:reviewing.length, color:'#3B82F6' },
      { label:'처리 완료', val:resolved.length,  color:'#10B981' },
    ].map(s=>`
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;text-align:center">
      <div style="font-size:20px;font-weight:700;color:${s.color}">${s.val}</div>
      <div style="font-size:11px;color:#64748B;margin-top:2px">${s.label}</div>
    </div>`).join('')}
  </div>

  <!-- Tabs -->
  <div style="display:flex;gap:6px;margin-bottom:14px">
    ${tabs.map(t=>`
    <button class="ra-tab" data-tab="${t.key}" style="
      padding:7px 14px;font-size:12px;font-weight:600;border-radius:20px;cursor:pointer;
      border:1.5px solid ${_tab===t.key?'#4F46E5':'var(--border)'};
      background:${_tab===t.key?'#EEF2FF':'var(--card-bg)'};
      color:${_tab===t.key?'#4F46E5':'#64748B'}">${t.label}</button>`).join('')}
  </div>

  <!-- List -->
  <div id="ra-list">
    ${list.length === 0
      ? `<div style="text-align:center;padding:48px 0;color:#94A3B8">
           <div style="font-size:36px;margin-bottom:8px">&#9989;</div>
           <div style="font-size:13px">처리 대기 중인 이의 신청이 없습니다.</div>
         </div>`
      : list.map(r => _card(r)).join('')}
  </div>
</div>`;

  _bindEvents();
}

function _card(r) {
  const sm = STATUS_META[r.status] || STATUS_META.pending;
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
    <div>
      <div style="font-size:14px;font-weight:700;color:var(--text)">${r.empName}</div>
      <div style="font-size:11px;color:#64748B;margin-top:2px">${r.dept} · 신청일 ${r.reqDate}</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${sm.bg};color:${sm.color}">${sm.label}</span>
  </div>
  <div style="display:grid;gap:5px;margin-bottom:10px">
    ${[
      ['평가 연도', `${r.evalYear}년 ${r.period}`],
      ['이의 사유', r.reason],
      ['상세 내용', r.detail],
      ['요청 사항', r.desired],
    ].map(([k,v])=>`
    <div style="display:flex;gap:8px;font-size:12px">
      <span style="color:#94A3B8;min-width:64px">${k}</span>
      <span style="color:var(--text);flex:1">${v}</span>
    </div>`).join('')}
    ${r.resolution ? `
    <div style="display:flex;gap:8px;font-size:12px">
      <span style="color:#94A3B8;min-width:64px">처리 결과</span>
      <span style="color:var(--text);flex:1">${r.resolution}</span>
    </div>` : ''}
  </div>
  ${r.status === 'pending' ? `
  <button class="ra-review" data-id="${r.id}" style="width:100%;padding:9px;background:#3B82F6;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">검토 시작</button>
  ` : ''}
  ${r.status === 'reviewing' ? `
  <textarea class="ra-resolution" data-id="${r.id}" rows="3" placeholder="처리 결과를 입력하세요..."
    style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;
           resize:vertical;margin-bottom:8px;background:var(--card-bg);color:var(--text)"></textarea>
  <div style="display:flex;gap:8px">
    <button class="ra-resolve" data-id="${r.id}" style="flex:1;padding:9px;background:#10B981;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">처리 완료</button>
    <button class="ra-reject"  data-id="${r.id}" style="flex:1;padding:9px;background:#EF4444;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">기각</button>
  </div>` : ''}
</div>`;
}

function _bindEvents() {
  _root.querySelector('#ra-back')?.addEventListener('click', () => window.navBack());

  _root.querySelectorAll('.ra-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.tab; _draw(); });
  });

  _root.querySelectorAll('.ra-review').forEach(btn => {
    btn.addEventListener('click', () => {
      const all = _load();
      const idx = all.findIndex(r => r.id === btn.dataset.id);
      if (idx < 0) return;
      all[idx].status = 'reviewing';
      _save(all);
      showToast('검토가 시작되었습니다.');
      addNotification({ type: 'info', title: '평가 이의 관리', body: '검토가 시작되었습니다.' });
      _draw();
    });
  });

  _root.querySelectorAll('.ra-resolve').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const ta = _root.querySelector(`.ra-resolution[data-id="${id}"]`);
      const resolution = ta ? ta.value.trim() : '';
      if (!resolution) { showToast('처리 결과를 입력해 주세요.'); return; }
      const all = _load();
      const idx = all.findIndex(r => r.id === id);
      if (idx < 0) return;
      all[idx].status = 'resolved';
      all[idx].resolution = resolution;
      _save(all);
      showToast('처리 완료되었습니다.');
      const r = all[idx];
      if (r?.empId) addNotificationForUser(r.empId, { type: 'success', title: '평가 이의신청 처리 완료', body: `이의신청이 처리되었습니다: ${resolution}`, route: '#/reviews' });
      _draw();
    });
  });

  _root.querySelectorAll('.ra-reject').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const ta = _root.querySelector(`.ra-resolution[data-id="${id}"]`);
      const resolution = ta ? ta.value.trim() : '기각 처리되었습니다.';
      const all = _load();
      const idx = all.findIndex(r => r.id === id);
      if (idx < 0) return;
      all[idx].status = 'rejected';
      all[idx].resolution = resolution || '기각';
      _save(all);
      showToast('기각 처리되었습니다.');
      const r = all[idx];
      if (r?.empId) addNotificationForUser(r.empId, { type: 'error', title: '평가 이의신청 기각', body: `이의신청이 기각되었습니다.${resolution ? ` 사유: ${resolution}` : ''}`, route: '#/reviews' });
      _draw();
    });
  });
}
export function mount(root) { return render(root); }
