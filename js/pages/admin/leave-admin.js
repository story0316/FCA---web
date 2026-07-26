/**
 * leave-admin.js — 관리자 휴가 승인 관리 (#/admin/leave)
 */

import { showToast } from '../../components/toast.js';
import { addNotification, addNotificationForUser } from '../../components/notification-hub.js';
import { LEAVE_TYPE_MAP, LEAVE_STATUS } from '../../data/leave-types.js';
import { getAllLeaveRequests, updateRequestStatus } from '../../utils/leave-engine.js';
import { showFormModal } from '../../components/form-modal.js';

export function render(root) {
  root.innerHTML = `
<div class="page" id="leave-admin-page">
  <header class="top-bar">
    <button class="btn-icon back-btn" aria-label="뒤로">&#8592;</button>
    <h1 class="page-title">휴가 승인 관리</h1>
    <div class="filter-wrap">
      <select id="status-filter" class="filter-select">
        <option value="all">전체</option>
        <option value="pending" selected>검토중</option>
        <option value="approved">승인</option>
        <option value="rejected">반려</option>
        <option value="cancelled">취소</option>
      </select>
    </div>
  </header>

  <div class="page-content" id="admin-leave-content">
    ${_renderList(getAllLeaveRequests(), 'pending')}
  </div>
</div>
${_styles()}`;

  _bindEvents(root);
}

function _renderList(requests, statusFilter) {
  const filtered = statusFilter === 'all'
    ? requests
    : requests.filter(r => r.status === statusFilter);

  if (!filtered.length) {
    return `<div class="empty-state">
      <div class="es-icon">📭</div>
      <p class="es-text">해당 상태의 신청 건이 없습니다.</p>
    </div>`;
  }

  const sorted = [...filtered].sort((a, b) => {
    // pending first, then by date desc
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  return sorted.map(r => {
    const type   = LEAVE_TYPE_MAP[r.type] || LEAVE_TYPE_MAP.other;
    const status = LEAVE_STATUS[r.status] || LEAVE_STATUS.pending;
    const isPending = r.status === 'pending';

    return `<div class="admin-leave-card" data-id="${r.id}">
      <div class="alc-header">
        <span class="alc-icon" style="background:${type.color}20;color:${type.color}">${type.icon}</span>
        <div class="alc-meta">
          <div class="alc-name">${r.userName || r.userId}</div>
          <div class="alc-type">${type.label} · ${r.days}일</div>
        </div>
        <span class="alc-badge" style="color:${status.color};background:${status.bg}">
          ${status.icon} ${status.label}
        </span>
      </div>
      <div class="alc-body">
        <div class="alc-row">
          <span class="alc-key">기간</span>
          <span>${r.startDate}${r.startDate !== r.endDate ? ` ~ ${r.endDate}` : ''}</span>
        </div>
        ${r.reason ? `<div class="alc-row">
          <span class="alc-key">사유</span>
          <span>${r.reason}</span>
        </div>` : ''}
        <div class="alc-row">
          <span class="alc-key">신청일</span>
          <span>${r.createdAt}</span>
        </div>
      </div>
      ${isPending ? `<div class="alc-actions">
        <button class="btn-approve" data-id="${r.id}">✅ 승인</button>
        <button class="btn-reject"  data-id="${r.id}">❌ 반려</button>
      </div>` : ''}
    </div>`;
  }).join('');
}

function _bindEvents(root) {
  root.querySelector('.back-btn').addEventListener('click', () => window.navBack());

  const filter  = root.querySelector('#status-filter');
  const content = root.querySelector('#admin-leave-content');

  filter.addEventListener('change', () => {
    content.innerHTML = _renderList(getAllLeaveRequests(), filter.value);
  });

  content.addEventListener('click', async e => {
    const approveBtn = e.target.closest('.btn-approve');
    const rejectBtn  = e.target.closest('.btn-reject');

    if (approveBtn) {
      const id  = approveBtn.dataset.id;
      const req = getAllLeaveRequests().find(r => r.id === id);
      updateRequestStatus(id, 'approved');
      showToast('휴가 신청이 승인되었습니다. ✅', 'success');
      addNotification({ type: 'success', title: '휴가 승인 (관리자)', body: '휴가 신청이 승인되었습니다.' });
      if (req?.userId) addNotificationForUser(req.userId, { type: 'success', title: '휴가 신청 승인', body: `${LEAVE_TYPE_MAP[req.type]?.label || '휴가'} 신청이 승인되었습니다.`, route: '#/leave' });
      content.innerHTML = _renderList(getAllLeaveRequests(), filter.value);
    }

    if (rejectBtn) {
      const id     = rejectBtn.dataset.id;
      const req    = getAllLeaveRequests().find(r => r.id === id);
      const result = await showFormModal({
        title: '반려 사유',
        fields: [{ name: 'note', label: '사유 (선택)', placeholder: '반려 사유를 입력하세요.' }],
        confirmLabel: '반려 처리',
      });
      if (result === null) return;
      const note = result.note || '';
      updateRequestStatus(id, 'rejected', note);
      showToast('휴가 신청이 반려되었습니다.', 'info');
      addNotification({ type: 'error', title: '휴가 반려 (관리자)', body: '휴가 신청이 반려되었습니다.' });
      if (req?.userId) addNotificationForUser(req.userId, { type: 'error', title: '휴가 신청 반려', body: `${LEAVE_TYPE_MAP[req.type]?.label || '휴가'} 신청이 반려되었습니다.${note ? ` 사유: ${note}` : ''}`, route: '#/leave' });
      content.innerHTML = _renderList(getAllLeaveRequests(), filter.value);
    }
  });
}

function _styles() {
  return `<style>
#leave-admin-page .top-bar { display:flex; align-items:center; padding:12px 16px; gap:10px; background:var(--bg); border-bottom:1px solid var(--border); flex-shrink:0; }
#leave-admin-page .page-title { flex:1; font-size:18px; font-weight:700; margin:0; }
.filter-select { border:1.5px solid var(--border); border-radius:8px; padding:6px 10px; font-size:13px; background:var(--card-bg); color:var(--text); cursor:pointer; }

.admin-leave-card { background:var(--card-bg); border-radius:14px; padding:16px; margin:12px 16px; border:1px solid var(--border); box-shadow:0 1px 4px rgba(0,0,0,.06); }
.alc-header { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
.alc-icon { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }
.alc-meta { flex:1; }
.alc-name { font-size:15px; font-weight:700; }
.alc-type { font-size:12px; color:var(--text-secondary); margin-top:2px; }
.alc-badge { font-size:12px; padding:4px 10px; border-radius:20px; font-weight:600; white-space:nowrap; }

.alc-body { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
.alc-row { display:flex; gap:8px; font-size:13px; }
.alc-key { color:var(--text-secondary); min-width:36px; flex-shrink:0; }

.alc-actions { display:flex; gap:10px; }
.btn-approve,.btn-reject { flex:1; border:none; border-radius:10px; padding:10px; font-size:14px; font-weight:600; cursor:pointer; }
.btn-approve { background:#D1FAE5; color:#059669; }
.btn-reject  { background:#FEE2E2; color:#DC2626; }
.btn-approve:active { background:#A7F3D0; }
.btn-reject:active  { background:#FECACA; }

.empty-state { text-align:center; padding:60px 20px; }
.es-icon { font-size:40px; margin-bottom:12px; }
.es-text { color:var(--text-secondary); }
</style>`;
}

export function unmount() {}
export function mount(root) { return render(root); }
