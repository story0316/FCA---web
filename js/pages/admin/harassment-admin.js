/**
 * harassment-admin.js — 관리자 괴롭힘 신고 처리 탭
 */

import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS_REPORTS = 'hr_harassment_reports';

const TYPE_MAP = {
  verbal:    { label: '언어적 괴롭힘', icon: '💬' },
  physical:  { label: '신체적 괴롭힘', icon: '✋' },
  exclusion: { label: '따돌림·고립',   icon: '🚫' },
  overwork:  { label: '과도한 업무',   icon: '📋' },
  other:     { label: '기타',          icon: '📢' },
};

const STATUS_MAP = {
  received:      { label: '접수됨',   icon: '📬', color: '#3B82F6', bg: '#DBEAFE' },
  investigating: { label: '조사 중',  icon: '🔍', color: '#F59E0B', bg: '#FEF3C7' },
  resolved:      { label: '처리 완료', icon: '✅', color: '#059669', bg: '#D1FAE5' },
};

const STATUS_NEXT = {
  received:      'investigating',
  investigating: 'resolved',
};

function _getReports() {
  return JSON.parse(localStorage.getItem(LS_REPORTS) || '[]')
    .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
}

function _updateStatus(id, status) {
  const reports = JSON.parse(localStorage.getItem(LS_REPORTS) || '[]');
  if (!reports||!reports.length){root.innerHTML=`<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:48px;margin-bottom:12px">🛡️</div><div style="font-size:14px;font-weight:600;margin-bottom:6px">신고 내역이 없습니다.</div><div style="font-size:12px">데이터가 축적되면 자동으로 표시됩니다.</div></div>`;return;}
  const idx     = reports.findIndex(r => r.id === id);
  if (idx >= 0) {
    reports[idx] = { ...reports[idx], status, updatedAt: new Date().toISOString() };
    localStorage.setItem(LS_REPORTS, JSON.stringify(reports));
  }
}

export function render(root) {
  _renderPage(root);
}

function _renderPage(root) {
  const reports  = _getReports();
  const pending  = reports.filter(r => r.status !== 'resolved').length;

  // Seed demo if empty
  if (!reports.length) {
    const demo = [
      {
        id: 'HR-DEMO01', reportedAt: new Date(Date.now()-3*86400000).toISOString(),
        type: 'verbal', incidentDate: new Date(Date.now()-4*86400000).toISOString().slice(0,10),
        description: '업무 중 지속적으로 폭언과 비하 발언을 들었습니다. 여러 동료가 목격하였습니다.',
        resolution: 'investigation', status: 'received', anonymousToken: 'HR-DEMO01',
      },
      {
        id: 'HR-DEMO02', reportedAt: new Date(Date.now()-10*86400000).toISOString(),
        type: 'exclusion', incidentDate: new Date(Date.now()-11*86400000).toISOString().slice(0,10),
        description: '의도적으로 회의에서 배제되고, 업무 관련 정보를 공유받지 못하고 있습니다.',
        resolution: 'mediation', status: 'investigating', anonymousToken: 'HR-DEMO02',
      },
    ];
    localStorage.setItem(LS_REPORTS, JSON.stringify(demo));
    return _renderPage(root);
  }

  root.innerHTML = `
<div id="harassment-admin-wrap">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <div style="background:#FEE2E2;color:#DC2626;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:700">
      ⚠️ 미처리 ${pending}건
    </div>
    <span style="font-size:13px;color:#64748B">전체 ${reports.length}건</span>
  </div>
  <div id="report-list">
    ${reports.map(r => _renderCard(r)).join('')}
  </div>
</div>`;

  _bindEvents(root);
}

function _renderCard(r) {
  const type   = TYPE_MAP[r.type]   || TYPE_MAP.other;
  const status = STATUS_MAP[r.status] || STATUS_MAP.received;
  const next   = STATUS_NEXT[r.status];
  const nextSt = next ? STATUS_MAP[next] : null;

  return `
<div class="hr-card" data-id="${r.id}" style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:18px">${type.icon}</span>
      <div>
        <div style="font-size:14px;font-weight:700">${type.label}</div>
        <div style="font-size:11px;color:#94A3B8">신고번호: ${r.id}</div>
      </div>
    </div>
    <span style="font-size:12px;padding:4px 10px;border-radius:20px;font-weight:600;color:${status.color};background:${status.bg}">
      ${status.icon} ${status.label}
    </span>
  </div>
  <div style="font-size:12px;color:#64748B;margin-bottom:8px">
    발생일 ${r.incidentDate} · 접수 ${r.reportedAt.slice(0,10)}
  </div>
  <div style="font-size:13px;color:var(--text);background:var(--surface,#F8FAFC);border-radius:8px;padding:10px;margin-bottom:12px;line-height:1.6;max-height:80px;overflow:hidden;text-overflow:ellipsis">
    ${r.description}
  </div>
  ${nextSt ? `
  <button class="btn-next-status" data-id="${r.id}" data-next="${STATUS_NEXT[r.status]}"
    style="width:100%;background:${nextSt.bg};color:${nextSt.color};border:none;border-radius:10px;
           padding:10px;font-size:13px;font-weight:700;cursor:pointer">
    → ${nextSt.label}(으)로 변경
  </button>` : `
  <div style="text-align:center;font-size:12px;color:#10B981;padding:6px">✅ 처리가 완료되었습니다</div>`}
</div>`;
}

function _bindEvents(root) {
  root.addEventListener('click', e => {
    const btn = e.target.closest('.btn-next-status');
    if (!btn) return;
    const { id, next } = btn.dataset;
    _updateStatus(id, next);
    const label = STATUS_MAP[next]?.label || next;
    showToast(`신고 상태가 "${label}"로 변경되었습니다.`, 'success')
      addNotification({ type: 'success', title: 'Harassment (관리자)', body: '신고 상태가 ""로 변경되었습니다.' });
    _renderPage(root);
  });
}

export function unmount() {}
export function mount(root) { return render(root); }
