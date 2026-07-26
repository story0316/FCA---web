/**
 * transfer-admin.js — 사내 이동 신청 관리
 */

import { loadDisplayEmployees } from '../../data/demo_employees.js';
import { showToast } from '../../components/toast.js'
import { addNotification } from '../../components/notification-hub.js';

const LS_TRANSFERS = 'hr_internal_transfers';

const TYPE_LABEL = { dept: '부서 이동', role: '직무 변경', location: '근무지 변경', promotion: '승진 요청' };
const STATUS_META = {
  pending:  { label: '검토 중',  bg: '#FEF3C7', color: '#D97706' },
  approved: { label: '승인',     bg: '#D1FAE5', color: '#059669' },
  rejected: { label: '반려',     bg: '#FEE2E2', color: '#EF4444' },
};

let _employees = [];

function _getTransfers() {
  try { return JSON.parse(localStorage.getItem(LS_TRANSFERS) || '[]'); } catch { return []; }
}
function _saveTransfers(list) {
  localStorage.setItem(LS_TRANSFERS, JSON.stringify(list));
}
function _emp(id) {
  return _employees.find(e => e.id === id || e.employee_id === id) || null;
}

let _tab = 'pending';
let _selected = null;

export async function mount(root) {
  _tab = 'pending'; _selected = null;
  root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">⏳</div><div style="font-size:13px">로딩 중…</div></div>`;
  _employees = await loadDisplayEmployees();
  _draw(root);
}

export function render(root) { _tab = 'pending'; _selected = null; _draw(root); }
export function unmount() { _tab = 'pending'; _selected = null; _employees = []; }

function _draw(root) {
  const all = _getTransfers();
  const counts = {
    pending:  all.filter(t => t.status === 'pending').length,
    approved: all.filter(t => t.status === 'approved').length,
    rejected: all.filter(t => t.status === 'rejected').length,
  };

  root.innerHTML = `
<!-- 탭 -->
<div style="display:flex;border-bottom:1px solid var(--border);margin-bottom:14px">
  ${[
    { k: 'pending',  l: `검토 중 (${counts.pending})`  },
    { k: 'approved', l: `승인 (${counts.approved})`     },
    { k: 'rejected', l: `반려 (${counts.rejected})`     },
  ].map(t => `
    <button class="ta-tab" data-t="${t.k}"
      style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab===t.k?'#4F46E5':'transparent'};color:${_tab===t.k?'#4F46E5':'#64748B'}">
      ${t.l}
    </button>`).join('')}
</div>

<!-- 목록 -->
<div id="ta-list">${_renderList(all)}</div>

<!-- 상세 패널 -->
<div id="ta-detail">${_selected ? _renderDetail(all) : ''}</div>`;

  root.querySelectorAll('.ta-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _selected = null; _draw(root); });
  });

  root.querySelectorAll('.ta-item').forEach(el => {
    el.addEventListener('click', () => {
      _selected = el.dataset.id;
      document.getElementById('ta-detail').innerHTML = _renderDetail(_getTransfers());
      _bindDetail(root);
    });
  });

  _bindDetail(root);
}

function _renderList(all) {
  const filtered = all.filter(t => t.status === _tab);
  if (!filtered.length) return `
<div style="text-align:center;padding:40px 16px;color:#94A3B8">
  <div style="font-size:32px;margin-bottom:8px">📭</div>
  <div style="font-size:13px">${STATUS_META[_tab]?.label || ''} 건이 없습니다</div>
</div>`;

  return filtered.map(t => {
    const emp = _emp(t.employeeId);
    const meta = STATUS_META[t.status] || STATUS_META.pending;
    return `
<div class="ta-item" data-id="${t.id}" style="background:var(--card-bg);border:1px solid ${_selected===t.id?'#4F46E5':'var(--border)'};
     border-radius:12px;padding:12px;margin-bottom:8px;cursor:pointer">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div>
      <div style="font-size:13px;font-weight:700;color:var(--text)">${emp ? emp.name : t.employeeId}</div>
      <div style="font-size:11px;color:#64748B">${emp ? (emp.department || emp.dept || '') : ''} · ${emp ? (emp.position || emp.role || '') : ''}</div>
    </div>
    <span style="padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <span style="padding:2px 8px;background:#EFF6FF;border-radius:6px;font-size:11px;color:#3B82F6">${TYPE_LABEL[t.type] || t.type}</span>
    <span style="font-size:11px;color:#94A3B8">${t.targetDept || t.targetRole || t.targetLocation || ''}</span>
    <span style="font-size:11px;color:#94A3B8;margin-left:auto">${t.createdAt ? t.createdAt.slice(0,10) : ''}</span>
  </div>
  ${t.reason ? `<div style="font-size:11px;color:#64748B;margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">${t.reason}</div>` : ''}
</div>`;
  }).join('');
}

function _renderDetail(all) {
  const t = all.find(x => x.id === _selected);
  if (!t) return '';
  const emp = _emp(t.employeeId);
  const meta = STATUS_META[t.status] || STATUS_META.pending;

  return `
<div style="background:var(--card-bg);border:2px solid #4F46E5;border-radius:14px;padding:16px;margin-top:4px">
  <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:12px">상세 / 처리</div>

  <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px;font-size:12px">
    <div style="display:flex;gap:8px"><span style="color:#94A3B8;width:72px;flex-shrink:0">신청자</span><span style="font-weight:700;color:var(--text)">${emp ? emp.name : t.employeeId}</span></div>
    <div style="display:flex;gap:8px"><span style="color:#94A3B8;width:72px;flex-shrink:0">현 소속</span><span style="color:var(--text)">${emp ? (emp.department || emp.dept || '-') : '-'} / ${emp ? (emp.position || emp.role || '-') : '-'}</span></div>
    <div style="display:flex;gap:8px"><span style="color:#94A3B8;width:72px;flex-shrink:0">유형</span><span style="color:var(--text)">${TYPE_LABEL[t.type] || t.type}</span></div>
    ${t.targetDept     ? `<div style="display:flex;gap:8px"><span style="color:#94A3B8;width:72px;flex-shrink:0">희망 부서</span><span style="color:var(--text)">${t.targetDept}</span></div>` : ''}
    ${t.targetRole     ? `<div style="display:flex;gap:8px"><span style="color:#94A3B8;width:72px;flex-shrink:0">희망 직무</span><span style="color:var(--text)">${t.targetRole}</span></div>` : ''}
    ${t.targetLocation ? `<div style="display:flex;gap:8px"><span style="color:#94A3B8;width:72px;flex-shrink:0">희망 근무지</span><span style="color:var(--text)">${t.targetLocation}</span></div>` : ''}
    ${t.expectedDate   ? `<div style="display:flex;gap:8px"><span style="color:#94A3B8;width:72px;flex-shrink:0">희망 시기</span><span style="color:var(--text)">${t.expectedDate}</span></div>` : ''}
    ${t.reason         ? `<div style="display:flex;gap:8px"><span style="color:#94A3B8;width:72px;flex-shrink:0">사유</span><span style="color:var(--text)">${t.reason}</span></div>` : ''}
    <div style="display:flex;gap:8px"><span style="color:#94A3B8;width:72px;flex-shrink:0">현재 상태</span><span style="padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;background:${meta.bg};color:${meta.color}">${meta.label}</span></div>
  </div>

  <!-- 코멘트 -->
  <textarea id="ta-comment" placeholder="처리 코멘트 (선택)" rows="2"
    style="width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--border);border-radius:8px;
           font-size:12px;background:var(--card-bg);color:var(--text);resize:none;margin-bottom:10px">${t.adminComment || ''}</textarea>

  <!-- 처리 버튼 -->
  <div style="display:flex;gap:8px">
    ${t.status !== 'approved' ? `<button id="ta-approve" style="flex:1;padding:10px;background:#10B981;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">✅ 승인</button>` : ''}
    ${t.status !== 'rejected' ? `<button id="ta-reject"  style="flex:1;padding:10px;background:#EF4444;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">❌ 반려</button>` : ''}
    ${t.status !== 'pending'  ? `<button id="ta-reopen"  style="flex:1;padding:10px;background:#F59E0B;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">🔄 재검토</button>` : ''}
  </div>
</div>`;
}

function _bindDetail(root) {
  const approve = root.querySelector('#ta-approve');
  const reject  = root.querySelector('#ta-reject');
  const reopen  = root.querySelector('#ta-reopen');
  const getComment = () => (root.querySelector('#ta-comment') || { value: '' }).value.trim();

  if (approve) approve.addEventListener('click', () => _update(root, 'approved', getComment()));
  if (reject)  reject.addEventListener('click',  () => _update(root, 'rejected', getComment()));
  if (reopen)  reopen.addEventListener('click',  () => _update(root, 'pending',  getComment()));
}

function _update(root, newStatus, comment) {
  const all = _getTransfers();
  const idx = all.findIndex(x => x.id === _selected);
  if (idx < 0) return;
  all[idx].status = newStatus;
  all[idx].adminComment = comment;
  all[idx].processedAt = new Date().toISOString();
  _saveTransfers(all);
  const label = STATUS_META[newStatus]?.label || newStatus;
  showToast(`이동 신청이 "${label}" 처리되었습니다.`);
      addNotification({ type: "success", title: "발령 관리", body: `이동 신청이 "${label}" 처리되었습니다.` });
  _tab = newStatus;
  _selected = null;
  _draw(root);
}
