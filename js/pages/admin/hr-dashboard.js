/**
 * hr-dashboard.js — HR 법적 KPI 통합 대시보드 (#/admin/hr-dashboard)
 */

import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';
import { getAllLeaveRequests } from '../../utils/leave-engine.js';
import { getOrgStructure, getTotalHeadcount } from '../../utils/org-engine.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';

// ── 법정 기준 ──────────────────────────────────────────────────
const DISABILITY_QUOTA = 0.031; // 장애인 의무고용률 3.1%

function _getDisabilityStatus(stats) {
  const required = Math.ceil(stats.totalEmployees * DISABILITY_QUOTA);
  return { required };
}

function _getEduStatus() {
  const schedule = JSON.parse(localStorage.getItem('hr_legal_edu_schedule') || '[]');
  if (!schedule.length) return { done: 0, total: 0, pct: null };
  const done  = schedule.filter(s => s.status === 'completed').length;
  const total = schedule.length;
  return { done, total, pct: Math.round(done / total * 100) };
}

function _getLeaveStats() {
  const requests = getAllLeaveRequests();
  const pending  = requests.filter(r => r.status === 'pending').length;
  return { pending };
}

function _getHarassmentStats() {
  try {
    const reports = JSON.parse(localStorage.getItem('hr_harassment_reports') || '[]');
    const pending = reports.filter(r => !['resolved', 'closed'].includes(r.status)).length;
    return { pending, available: true };
  } catch {
    return { pending: 0, available: false };
  }
}

function _kpiColor(good, warn) {
  if (good) return { color: '#059669', bg: '#D1FAE5', icon: '🟢' };
  if (warn) return { color: '#D97706', bg: '#FEF3C7', icon: '🟡' };
  return { color: '#DC2626', bg: '#FEE2E2', icon: '🔴' };
}

let _employees = [];

export async function mount(root) {
  _employees = await loadDisplayEmployees();
  render(root);
}

export function render(root) {
  const org     = getOrgStructure();
  const orgTotal = getTotalHeadcount(org.departments);
  const total   = _employees.length || orgTotal || 0;
  const dis     = _getDisabilityStatus({ totalEmployees: total });
  const edu     = _getEduStatus();
  const leave   = _getLeaveStats();
  const harassment = _getHarassmentStats();

  const eduKpi   = edu.pct === null
    ? _kpiColor(false, false)
    : _kpiColor(edu.pct === 100, edu.pct >= 75);
  const leaveKpi = _kpiColor(leave.pending === 0, leave.pending <= 2);
  const harassmentKpi = harassment.available
    ? _kpiColor(harassment.pending === 0, harassment.pending <= 1)
    : { color: '#94A3B8', bg: '#F1F5F9', icon: '⚪' };

  root.innerHTML = `
<div id="hr-dashboard-wrap">

  <!-- 헤더 -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
    <div>
      <div style="font-size:16px;font-weight:800">HR 법적 KPI 현황</div>
      <div style="font-size:12px;color:#64748B;margin-top:2px">${new Date().toLocaleDateString('ko-KR')} 기준 · 전체 ${total > 0 ? total + '명' : '인원 데이터 없음'}</div>
    </div>
    <button id="refresh-btn" style="background:#EEF2FF;color:#4338CA;border:none;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer">🔄 새로고침</button>
  </div>

  <!-- KPI 카드 그리드 -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">

    ${_kpiCard('재직 인원', total > 0 ? `${total}명` : '—', '현재',
      total > 0 ? _kpiColor(true, true) : { color: '#94A3B8', bg: '#F1F5F9', icon: '⚪' },
      total > 0 ? 'Company DB 기준' : '직원 데이터 없음')}

    ${_kpiCard('법정교육', edu.pct !== null ? `${edu.done}/${edu.total}` : '—', '완료',
      eduKpi, edu.pct !== null ? `달성률 ${edu.pct}%` : '교육 일정 데이터 없음')}

    ${_kpiCard('장애인 고용', '—', total > 0 ? `(의무 ${dis.required}명)` : '인원 데이터 없음',
      { color: '#94A3B8', bg: '#F1F5F9', icon: '⚪' },
      '장애인 고용 현황 데이터 없음')}

    ${_kpiCard('주 52h 초과', '—', '데이터 없음',
      { color: '#94A3B8', bg: '#F1F5F9', icon: '⚪' }, '근무시간 기록 API 연동 필요')}

    ${_kpiCard('괴롭힘 신고', harassment.available ? `${harassment.pending}건` : '—',
      harassment.available ? '미처리' : '데이터 없음',
      harassmentKpi, harassment.available ? '실제 신고 접수 기준' : '신고 데이터 확인 불가')}

    ${_kpiCard('휴가 미승인', `${leave.pending}건`, '대기 중',
      leaveKpi, '어드민 > 휴가 관리에서 처리')}

  </div>

  <!-- 법적 리스크 알림 -->
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px">
    <div style="font-size:14px;font-weight:700;margin-bottom:12px">⚠️ 법적 리스크 알림</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${edu.pct !== null && edu.pct < 100 ? _riskItem(true, `법정교육 미이수 ${edu.total - edu.done}종 — 과태료 위험`) : ''}
      ${_riskItem(leave.pending > 3, `휴가 승인 지연 ${leave.pending}건 — 직원 불만 위험`)}
      ${_riskItem(harassment.available && harassment.pending > 0, `괴롭힘 신고 ${harassment.pending}건 미처리 — 신속한 확인 필요`)}
      <div style="color:#94A3B8;font-size:11px;margin-top:4px">⚪ 주 52h 초과 및 장애인 고용 현황은 원천 데이터 연동 후 표시됩니다.</div>
      <div style="font-size:12px;color:#10B981;font-weight:600;margin-top:4px">✅ 연차 관리 시스템 운영 중</div>
      <div style="font-size:12px;color:#10B981;font-weight:600">✅ 임금명세서 교부 시스템 구축</div>
    </div>
  </div>

  <!-- 바로가기 -->
  <div style="font-size:14px;font-weight:700;margin-bottom:10px">빠른 이동</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    ${[
      ['📅', '휴가 승인', '#/admin/leave'],
      ['📚', '법정교육', ''],
      ['🛡️', '괴롭힘 신고', ''],
      ['⏱️', '근무시간', ''],
      ['🏢', '조직도', ''],
      ['💰', '임금명세서', ''],
    ].map(([icon, label, href]) => `
    <button class="shortcut-btn" data-href="${href}"
      style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;text-align:left">
      <span style="font-size:18px">${icon}</span>${label}
    </button>`).join('')}
  </div>

</div>`;

  _bindEvents(root);
}

function _kpiCard(title, value, sub, kpi, hint) {
  return `
<div style="background:var(--card-bg);border:1.5px solid ${kpi.color}40;border-radius:14px;padding:14px">
  <div style="font-size:12px;color:#64748B;margin-bottom:6px">${title}</div>
  <div style="display:flex;align-items:flex-end;gap:6px;margin-bottom:4px">
    <span style="font-size:24px;font-weight:800;color:${kpi.color}">${value}</span>
    <span style="font-size:12px;color:#94A3B8;margin-bottom:3px">${sub}</span>
  </div>
  <div style="display:flex;align-items:center;gap:6px">
    <span style="font-size:14px">${kpi.icon}</span>
    <span style="font-size:11px;color:${kpi.color}">${hint}</span>
  </div>
</div>`;
}

function _riskItem(isRisk, text) {
  if (!isRisk) return '';
  return `<div style="display:flex;gap:8px;align-items:flex-start;background:#FEF2F2;border-radius:8px;padding:8px 10px">
    <span style="font-size:14px;flex-shrink:0">🚨</span>
    <span style="font-size:13px;color:#DC2626">${text}</span>
  </div>`;
}

function _bindEvents(root) {
  root.querySelector('#refresh-btn')?.addEventListener('click', async () => {
    _employees = await loadDisplayEmployees();
    render(root);
    showToast('KPI가 갱신되었습니다.', 'success');
    addNotification({ type: 'success', title: 'HR 대시보드', body: 'KPI가 갱신되었습니다.' });
  });

  root.addEventListener('click', e => {
    const btn = e.target.closest('.shortcut-btn');
    if (btn?.dataset.href) {
      location.hash = btn.dataset.href;
    } else if (btn) {
      showToast('해당 기능은 어드민 탭에서 확인하세요.', 'info');
    }
  });
}

export function unmount() { _employees = []; }
