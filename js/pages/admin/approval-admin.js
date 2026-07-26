/**
 * approval-admin.js — 전자 결재 관리자
 * export function render(root) + export function unmount()
 */

import { showToast } from '../../components/toast.js';
import { addNotification, addNotificationForUser } from '../../components/notification-hub.js';

const LS = 'hr_approvals';

const DOC_TYPES = [
  { key:'leave',    label:'휴가 신청',   icon:'🏖️' },
  { key:'expense',  label:'지출 결의',   icon:'💸' },
  { key:'biz_trip', label:'출장 신청',   icon:'✈️' },
  { key:'purchase', label:'물품 구매',   icon:'🛒' },
  { key:'overtime', label:'초과근무',    icon:'⏰' },
  { key:'etc',      label:'기타',        icon:'📄' },
];

const STATUS_META = {
  pending:  { label:'결재 대기', color:'#F59E0B', bg:'#FEF3C7' },
  approved: { label:'승인',     color:'#10B981', bg:'#D1FAE5' },
  rejected: { label:'반려',     color:'#EF4444', bg:'#FEE2E2' },
};

function _getAll() { try { return JSON.parse(localStorage.getItem(LS)||'[]'); } catch { return []; } }
function _save(l)  { localStorage.setItem(LS, JSON.stringify(l)); }

let _filter = 'pending';

export function render(root) {
  _filter = 'pending';
  _draw(root);
}

export function unmount() { _filter = 'pending'; }

function _draw(root) {
  const all = _getAll().sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  const pendingCnt  = all.filter(a=>a.status==='pending').length;
  const approvedCnt = all.filter(a=>a.status==='approved').length;
  const rejectedCnt = all.filter(a=>a.status==='rejected').length;

  const filtered = _filter === 'all' ? all : all.filter(a=>a.status===_filter);

  root.innerHTML = `
<!-- KPI -->
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
  ${[
    {label:'결재 대기', value:pendingCnt+'건',  color:'#F59E0B', key:'pending'},
    {label:'승인',     value:approvedCnt+'건', color:'#10B981', key:'approved'},
    {label:'반려',     value:rejectedCnt+'건', color:'#EF4444', key:'rejected'},
  ].map(k=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:10px;text-align:center;cursor:pointer;border-bottom:3px solid ${_filter===k.key?k.color:'transparent'}"
       class="apv-filter-btn" data-filter="${k.key}">
    <div style="font-size:16px;font-weight:800;color:${k.color}">${k.value}</div>
    <div style="font-size:10px;color:#64748B;margin-top:1px">${k.label}</div>
  </div>`).join('')}
</div>

<!-- 전체 보기 버튼 -->
<div style="display:flex;gap:6px;margin-bottom:12px">
  <button class="apv-filter-btn" data-filter="all"
    style="padding:6px 14px;font-size:11px;font-weight:600;border-radius:8px;cursor:pointer;
           border:1.5px solid ${_filter==='all'?'#4F46E5':'var(--border)'};
           background:${_filter==='all'?'#EEF2FF':'var(--card-bg)'};
           color:${_filter==='all'?'#4F46E5':'#64748B'}">전체 (${all.length}건)</button>
</div>

<!-- 결재 문서 목록 -->
${!filtered.length
  ? `<div style="text-align:center;padding:40px;color:#94A3B8;font-size:13px">결재 문서가 없습니다.</div>`
  : filtered.map(d => {
    const t = DOC_TYPES.find(x=>x.key===d.type)||{icon:'📄',label:d.type};
    const s = STATUS_META[d.status]||STATUS_META.pending;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
      <span style="font-size:20px;flex-shrink:0">${t.icon}</span>
      <div style="min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--text)">${d.title}</div>
        <div style="font-size:11px;color:#64748B;margin-top:1px">${d.empName} · ${t.label} · ${d.createdAt?.slice(0,10)||''}</div>
      </div>
    </div>
    <span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:8px;
      color:${s.color};background:${s.bg};flex-shrink:0;margin-left:8px">${s.label}</span>
  </div>

  ${d.amount ? `<div style="font-size:12px;color:#4F46E5;font-weight:600;margin-bottom:4px">💰 ${d.amount.toLocaleString()}원</div>` : ''}
  ${d.dateFrom ? `<div style="font-size:11px;color:#94A3B8;margin-bottom:4px">📅 ${d.dateFrom}${d.dateTo&&d.dateTo!==d.dateFrom?` ~ ${d.dateTo}`:''}</div>` : ''}

  <div style="font-size:11px;color:#64748B;line-height:1.5;border-top:1px solid var(--border);
       padding-top:8px;margin-top:4px;margin-bottom:8px">${d.content}</div>

  ${d.status === 'pending' ? `
  <div style="display:flex;gap:8px;align-items:center">
    <input class="apv-comment" data-id="${d.id}" type="text" placeholder="의견 (선택)"
      style="flex:1;padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;background:var(--bg);color:var(--text)">
    <button class="apv-approve" data-id="${d.id}"
      style="padding:7px 14px;background:#D1FAE5;color:#065F46;border:1px solid #6EE7B7;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">승인</button>
    <button class="apv-reject" data-id="${d.id}"
      style="padding:7px 14px;background:#FEE2E2;color:#991B1B;border:1px solid #FCA5A5;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">반려</button>
  </div>` : d.comment ? `<div style="font-size:11px;font-weight:600;color:${s.color}">💬 ${d.comment}</div>` : ''}
</div>`;
  }).join('')}`;

  root.querySelectorAll('.apv-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => { _filter = btn.dataset.filter; _draw(root); });
  });

  root.querySelectorAll('.apv-approve').forEach(btn => {
    btn.addEventListener('click', () => {
      const id      = btn.dataset.id;
      const doc     = _getAll().find(d => d.id === id);
      const comment = root.querySelector(`.apv-comment[data-id="${id}"]`)?.value.trim()||'';
      _updateStatus(id, 'approved', comment || '승인되었습니다.');
      showToast('승인 처리되었습니다.', 'success');
      addNotification({ type: 'success', title: '결재 승인 (관리자)', body: '결재 문서가 승인되었습니다.' });
      if (doc?.empId) addNotificationForUser(doc.empId, { type: 'success', title: '결재 승인', body: `${doc.title || '결재 문서'}가 승인되었습니다.`, route: '#/approval' });
      _draw(root);
    });
  });

  root.querySelectorAll('.apv-reject').forEach(btn => {
    btn.addEventListener('click', () => {
      const id      = btn.dataset.id;
      const doc     = _getAll().find(d => d.id === id);
      const comment = root.querySelector(`.apv-comment[data-id="${id}"]`)?.value.trim();
      if (!comment) { showToast('반려 사유를 입력하세요.', 'error'); return; }
      _updateStatus(id, 'rejected', comment);
      showToast('반려 처리되었습니다.', 'info');
      addNotification({ type: 'error', title: '결재 반려 (관리자)', body: '결재 문서가 반려되었습니다.' });
      if (doc?.empId) addNotificationForUser(doc.empId, { type: 'error', title: '결재 반려', body: `${doc.title || '결재 문서'}가 반려되었습니다. 사유: ${comment}`, route: '#/approval' });
      _draw(root);
    });
  });
}

function _updateStatus(id, status, comment) {
  const list = _getAll();
  const idx  = list.findIndex(a => a.id === id);
  if (idx !== -1) { list[idx].status = status; list[idx].comment = comment; _save(list); }
}
export function mount(root) { return render(root); }
