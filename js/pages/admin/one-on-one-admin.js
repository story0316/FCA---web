/**
 * one-on-one-admin.js — 1:1 면담 요청 관리 (관리자)
 */

import { showToast } from '../../components/toast.js'
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_one_on_one';

const LEGACY_IDS = new Set(['OO001', 'OO002', 'OO003']);

const STATUS_META = {
  pending:   { label:'대기',  color:'#F59E0B', bg:'#FEF3C7' },
  confirmed: { label:'확정',  color:'#3B82F6', bg:'#DBEAFE' },
  completed: { label:'완료',  color:'#10B981', bg:'#D1FAE5' },
  cancelled: { label:'취소',  color:'#94A3B8', bg:'#F1F5F9' },
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
  const all = _load();
  const pending   = all.filter(r => r.status === 'pending');
  const confirmed = all.filter(r => r.status === 'confirmed');
  const completed = all.filter(r => r.status === 'completed');

  const tabs = [
    { key:'pending', label:`대기 (${pending.length})` },
    { key:'all',     label:`전체 (${all.length})` },
  ];

  const list = _tab === 'pending' ? pending : all;

  _root.innerHTML = `
<div style="padding:16px;max-width:600px;margin:0 auto">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button id="oo-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text)">&#8592;</button>
    <h2 style="margin:0;font-size:17px;font-weight:700;color:var(--text)">1:1 면담 관리</h2>
  </div>

  <!-- Stats -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
    ${[
      { label:'대기',  val:pending.length,   color:'#F59E0B' },
      { label:'확정',  val:confirmed.length, color:'#3B82F6' },
      { label:'완료',  val:completed.length, color:'#10B981' },
    ].map(s=>`
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;text-align:center">
      <div style="font-size:20px;font-weight:700;color:${s.color}">${s.val}</div>
      <div style="font-size:11px;color:#64748B;margin-top:2px">${s.label}</div>
    </div>`).join('')}
  </div>

  <!-- Tabs -->
  <div style="display:flex;gap:6px;margin-bottom:14px">
    ${tabs.map(t=>`
    <button class="oo-tab" data-tab="${t.key}" style="
      padding:7px 14px;font-size:12px;font-weight:600;border-radius:20px;cursor:pointer;
      border:1.5px solid ${_tab===t.key?'#4F46E5':'var(--border)'};
      background:${_tab===t.key?'#EEF2FF':'var(--card-bg)'};
      color:${_tab===t.key?'#4F46E5':'#64748B'}">${t.label}</button>`).join('')}
  </div>

  <!-- List -->
  <div id="oo-list">
    ${list.length === 0
      ? `<div style="text-align:center;padding:48px 0;color:#94A3B8">
           <div style="font-size:36px;margin-bottom:8px">💬</div>
           <div style="font-size:13px">면담 요청이 없습니다.</div>
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
      ['주제', r.topic],
      ['희망 일시', r.prefDate],
      ...(r.note ? [['메모', r.note]] : []),
      ...(r.confirmedDate ? [['확정 일시', r.confirmedDate]] : []),
    ].map(([k,v])=>`
    <div style="display:flex;gap:8px;font-size:12px">
      <span style="color:#94A3B8;min-width:60px">${k}</span>
      <span style="color:var(--text);flex:1">${v}</span>
    </div>`).join('')}
  </div>
  ${r.status === 'pending' ? `
  <div style="display:flex;gap:8px;margin-bottom:8px">
    <input class="oo-date" data-id="${r.id}" type="datetime-local"
      value="${r.prefDate ? r.prefDate.replace(' ','T') : ''}"
      style="flex:1;padding:8px;border:1px solid var(--border);border-radius:8px;font-size:12px;background:var(--card-bg);color:var(--text)">
  </div>
  <div style="display:flex;gap:8px">
    <button class="oo-confirm" data-id="${r.id}" style="flex:1;padding:9px;background:#3B82F6;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">일정 확정</button>
    <button class="oo-cancel"  data-id="${r.id}" style="flex:1;padding:9px;background:#F1F5F9;color:#64748B;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">취소</button>
  </div>` : ''}
  ${r.status === 'confirmed' ? `
  <button class="oo-complete" data-id="${r.id}" style="width:100%;padding:9px;background:#10B981;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">완료 처리</button>
  ` : ''}
</div>`;
}

function _bindEvents() {
  _root.querySelector('#oo-back')?.addEventListener('click', () => window.navBack());

  _root.querySelectorAll('.oo-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.tab; _draw(); });
  });

  _root.querySelectorAll('.oo-confirm').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const dateInput = _root.querySelector(`.oo-date[data-id="${id}"]`);
      const confirmedDate = dateInput ? dateInput.value.replace('T',' ') : '';
      if (!confirmedDate) { showToast('일시를 선택해 주세요.'); return; }
      const all = _load();
      const idx = all.findIndex(r => r.id === id);
      if (idx < 0) return;
      all[idx].status = 'confirmed';
      all[idx].confirmedDate = confirmedDate;
      _save(all);
      showToast('면담 일정이 확정되었습니다.');
      addNotification({ type: 'success', title: '1:1 면담 관리', body: '면담 일정이 확정되었습니다.' });
      _draw();
    });
  });

  _root.querySelectorAll('.oo-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      const all = _load();
      const idx = all.findIndex(r => r.id === btn.dataset.id);
      if (idx < 0) return;
      all[idx].status = 'cancelled';
      _save(all);
      showToast('면담 요청이 취소되었습니다.');
      addNotification({ type: 'info', title: '1:1 면담 관리', body: '면담 요청이 취소되었습니다.' });
      _draw();
    });
  });

  _root.querySelectorAll('.oo-complete').forEach(btn => {
    btn.addEventListener('click', () => {
      const all = _load();
      const idx = all.findIndex(r => r.id === btn.dataset.id);
      if (idx < 0) return;
      all[idx].status = 'completed';
      _save(all);
      showToast('면담이 완료 처리되었습니다.');
      addNotification({ type: 'success', title: '1:1 면담 관리', body: '면담이 완료 처리되었습니다.' });
      _draw();
    });
  });
}
export function mount(root) { return render(root); }
