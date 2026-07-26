/**
 * loa-admin.js — 휴직 신청 관리 (관리자)
 */

import { showToast } from '../../components/toast.js';
import { addNotificationForUser } from '../../components/notification-hub.js';

const LS = 'hr_loa_requests';

const LEGACY_IDS = new Set(['LA001', 'LA002', 'LA003']);

const STATUS_META = {
  pending:  { label:'검토 중',  color:'#F59E0B', bg:'#FEF3C7' },
  approved: { label:'승인',     color:'#10B981', bg:'#D1FAE5' },
  rejected: { label:'반려',     color:'#EF4444', bg:'#FEE2E2' },
  active:   { label:'휴직 중',  color:'#3B82F6', bg:'#DBEAFE' },
  ended:    { label:'종료',     color:'#94A3B8', bg:'#F1F5F9' },
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
  const pending = all.filter(r => r.status === 'pending');
  const active  = all.filter(r => r.status === 'active');

  const tabs = [
    { key:'pending', label:`검토 대기 (${pending.length})` },
    { key:'active',  label:`진행 중 (${active.length})` },
    { key:'all',     label:`전체 (${all.length})` },
  ];

  const list = _tab === 'pending' ? pending
             : _tab === 'active'  ? active
             : all;

  _root.innerHTML = `
<div style="padding:16px;max-width:600px;margin:0 auto">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button id="loa-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text)">&#8592;</button>
    <h2 style="margin:0;font-size:17px;font-weight:700;color:var(--text)">휴직 신청 관리</h2>
  </div>

  <!-- Stats -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
    ${[
      { label:'검토 대기', val:pending.length, color:'#F59E0B' },
      { label:'휴직 중',   val:active.length,  color:'#3B82F6' },
      { label:'전체',      val:all.length,     color:'#64748B' },
    ].map(s=>`
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;text-align:center">
      <div style="font-size:20px;font-weight:700;color:${s.color}">${s.val}</div>
      <div style="font-size:11px;color:#64748B;margin-top:2px">${s.label}</div>
    </div>`).join('')}
  </div>

  <!-- Tabs -->
  <div style="display:flex;gap:6px;margin-bottom:14px;overflow-x:auto;padding-bottom:2px">
    ${tabs.map(t=>`
    <button class="loa-tab" data-tab="${t.key}" style="
      padding:7px 14px;font-size:12px;font-weight:600;border-radius:20px;cursor:pointer;white-space:nowrap;
      border:1.5px solid ${_tab===t.key?'#4F46E5':'var(--border)'};
      background:${_tab===t.key?'#EEF2FF':'var(--card-bg)'};
      color:${_tab===t.key?'#4F46E5':'#64748B'}">${t.label}</button>`).join('')}
  </div>

  <!-- List -->
  <div id="loa-list">
    ${list.length === 0
      ? `<div style="text-align:center;padding:48px 0;color:#94A3B8">
           <div style="font-size:36px;margin-bottom:8px">📭</div>
           <div style="font-size:13px">신청 건이 없습니다.</div>
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
      ['유형', r.typeLabel],
      ['기간', `${r.startDate} ~ ${r.endDate}`],
      ['사유', r.reason],
      ['복직 계획', r.returnPlan],
    ].map(([k,v])=>`
    <div style="display:flex;gap:8px;font-size:12px">
      <span style="color:#94A3B8;min-width:60px">${k}</span>
      <span style="color:var(--text);flex:1">${v}</span>
    </div>`).join('')}
  </div>
  ${r.status === 'pending' ? `
  <div style="display:flex;gap:8px">
    <button class="loa-approve" data-id="${r.id}" style="flex:1;padding:9px;background:#10B981;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">승인</button>
    <button class="loa-reject"  data-id="${r.id}" style="flex:1;padding:9px;background:#EF4444;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">반려</button>
  </div>` : ''}
  ${r.status === 'approved' ? `
  <div style="display:flex;gap:8px">
    <button class="loa-activate" data-id="${r.id}" style="flex:1;padding:9px;background:#3B82F6;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">휴직 시작</button>
  </div>` : ''}
</div>`;
}

function _bindEvents() {
  _root.querySelector('#loa-back')?.addEventListener('click', () => window.navBack());

  _root.querySelectorAll('.loa-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.tab; _draw(); });
  });

  _root.querySelectorAll('.loa-approve').forEach(btn => {
    btn.addEventListener('click', () => _update(btn.dataset.id, 'approved'));
  });
  _root.querySelectorAll('.loa-reject').forEach(btn => {
    btn.addEventListener('click', () => _update(btn.dataset.id, 'rejected'));
  });
  _root.querySelectorAll('.loa-activate').forEach(btn => {
    btn.addEventListener('click', () => _update(btn.dataset.id, 'active'));
  });
}

function _update(id, status) {
  const all = _load();
  const idx = all.findIndex(r => r.id === id);
  if (idx < 0) return;
  all[idx].status = status;
  _save(all);
  const msgs = { approved:'승인되었습니다.', rejected:'반려되었습니다.', active:'휴직이 시작되었습니다.' };
  showToast(msgs[status] || '처리되었습니다.');
      addNotification({ type: 'success', title: '휴직 관리', body: msgs[status] || '처리되었습니다.' });
  const r = all[idx];
  if (r?.empId && (status === 'approved' || status === 'rejected')) {
    addNotificationForUser(r.empId, { type: status === 'approved' ? 'success' : 'error', title: status === 'approved' ? '휴직 신청 승인' : '휴직 신청 반려', body: status === 'approved' ? '휴직 신청이 승인되었습니다.' : '휴직 신청이 반려되었습니다.', route: '#/loa' });
  }
  _draw();
}
export function mount(root) { return render(root); }
