/**
 * payslip.js — 직원용 급여명세서 조회 (#/payslip)
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
import { getPayslips, savePayslip, fmtKRW } from '../utils/payslip-engine.js';

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId() {
  const s = _session();
  return s.empId || s.userId || s.id || 'EMP001';
}

const DEMO_USER_ID = 'demo';

export function render(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  const user   = JSON.parse(localStorage.getItem('hr_user') || '{}');
  const userId = user.id || DEMO_USER_ID;
  const slips  = getPayslips(userId);
  const unread = slips.filter(s => !s.isRead).length;

  root.innerHTML = `
<div class="page" id="payslip-page">
  <header class="top-bar">
    <button class="btn-icon back-btn" aria-label="뒤로">&#8592;</button>
    <h1 class="page-title">급여명세서</h1>
    ${unread > 0 ? `<span class="ps-unread-badge">${unread}건 미확인</span>` : ''}
  </header>

  <div class="page-content">
    ${slips.length === 0 ? _renderEmpty() : `
      <div class="slip-list" id="slip-list">
        ${slips.map((s, i) => _renderSlipCard(s, i === 0)).join('')}
      </div>
    `}
  </div>
</div>
${_styles()}`;

  _bindEvents(root, slips, userId);
}

function _renderEmpty() {
  return `<div class="empty-state">
    <div class="es-icon">💰</div>
    <p class="es-text">아직 발급된 급여명세서가 없습니다.</p>
    <button onclick="window.location.hash='#/ai-consult'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">HR 문의하기</button>
  </div>`;
}

function _renderSlipCard(slip, expanded) {
  const title  = `${slip.year}년 ${slip.month}월 급여명세서`;
  const issued = slip.issuedAt ? new Date(slip.issuedAt).toLocaleDateString('ko-KR') : '발급 대기';
  const unreadDot = !slip.isRead ? '<span class="ps-new-dot">NEW</span>' : '';

  return `
<div class="slip-card ${expanded ? 'expanded' : ''} ${!slip.isRead ? 'unread' : ''}" data-id="${slip.id}">
  <div class="slip-summary">
    <div class="slip-header">
      <div>
        <div class="slip-title">${title} ${unreadDot}</div>
        <div class="slip-issued">발급일 ${issued}</div>
      </div>
      <div class="slip-net-preview">${fmtKRW(slip.netPay)}</div>
    </div>
    <div class="slip-toggle">
      <span class="toggle-label">${expanded ? '닫기 ▲' : '상세 보기 ▼'}</span>
    </div>
  </div>

  <div class="slip-detail" ${expanded ? '' : 'style="display:none"'}>
    <!-- 지급 항목 -->
    <div class="slip-section">
      <div class="slip-section-title">지급 항목</div>
      <div class="slip-row">
        <span>기본급</span><span>${fmtKRW(slip.baseSalary)}</span>
      </div>
      ${(slip.allowances || []).map(a => `
        <div class="slip-row">
          <span>${a.label}</span><span>${fmtKRW(a.amount)}</span>
        </div>`).join('')}
      ${slip.overtimePay > 0 ? `<div class="slip-row">
        <span>연장근로수당 <small>(${slip.overtimeHours}h)</small></span>
        <span>${fmtKRW(slip.overtimePay)}</span></div>` : ''}
      ${slip.nightPay > 0 ? `<div class="slip-row">
        <span>야간근로수당 <small>(${slip.nightHours}h)</small></span>
        <span>${fmtKRW(slip.nightPay)}</span></div>` : ''}
      ${slip.holidayPay > 0 ? `<div class="slip-row">
        <span>휴일근로수당 <small>(${slip.holidayHours}h)</small></span>
        <span>${fmtKRW(slip.holidayPay)}</span></div>` : ''}
      <div class="slip-row total">
        <span>지급 합계</span><span>${fmtKRW(slip.grossPay)}</span>
      </div>
    </div>

    <!-- 공제 항목 -->
    <div class="slip-section">
      <div class="slip-section-title">공제 항목</div>
      ${(slip.deductions || []).map(d => `
        <div class="slip-row deduct">
          <span>${d.label}</span><span>- ${fmtKRW(d.amount)}</span>
        </div>`).join('')}
      <div class="slip-row total deduct">
        <span>공제 합계</span><span>- ${fmtKRW(slip.totalDeduction)}</span>
      </div>
    </div>

    <!-- 실수령액 -->
    <div class="slip-net-box">
      <span class="net-label">실수령액</span>
      <span class="net-amount">${fmtKRW(slip.netPay)}</span>
    </div>

    <!-- 근무시간 -->
    <div class="slip-hours">
      <div class="sh-item"><span class="sh-val">${slip.normalHours}h</span><span class="sh-lbl">소정</span></div>
      <div class="sh-item"><span class="sh-val">${slip.overtimeHours}h</span><span class="sh-lbl">연장</span></div>
      <div class="sh-item"><span class="sh-val">${slip.nightHours}h</span><span class="sh-lbl">야간</span></div>
      <div class="sh-item"><span class="sh-val">${slip.holidayHours}h</span><span class="sh-lbl">휴일</span></div>
    </div>

    <button class="btn-print" data-id="${slip.id}">🖨️ 인쇄 / PDF 저장</button>
  </div>
</div>`;
}

function _bindEvents(root, slips, userId) {
  root.querySelector('.back-btn').addEventListener('click', () => window.navBack());

  root.addEventListener('click', e => {
    // Toggle card
    const card = e.target.closest('.slip-card');
    if (card && !e.target.closest('.btn-print')) {
      const id     = card.dataset.id;
      const detail = card.querySelector('.slip-detail');
      const lbl    = card.querySelector('.toggle-label');
      const open   = card.classList.toggle('expanded');
      detail.style.display = open ? '' : 'none';
      lbl.textContent      = open ? '닫기 ▲' : '상세 보기 ▼';

      // 열면 읽음 처리
      if (open && card.classList.contains('unread')) {
        const slip = slips.find(s => s.id === id);
        if (slip && !slip.isRead) {
          slip.isRead = true;
          savePayslip(slip);
          card.classList.remove('unread');
          card.querySelector('.ps-new-dot')?.remove();
          // 헤더 배지 업데이트
          const badge = root.querySelector('.ps-unread-badge');
          if (badge) {
            const remaining = slips.filter(s => !s.isRead).length;
            if (remaining > 0) badge.textContent = `${remaining}건 미확인`;
            else badge.remove();
          }
        }
      }
    }

    // Print
    const printBtn = e.target.closest('.btn-print');
    if (printBtn) {
      e.stopPropagation();
      const id   = printBtn.dataset.id;
      const slip = slips.find(s => s.id === id);
      if (slip) _printSlip(slip);
    }
  });
}

function _printSlip(slip) {
  const win = window.open('', '_blank', 'width=600,height=800');
  if (!win) { showToast('팝업 차단을 해제해 주세요.', 'error'); return; }

  const title = `${slip.year}년 ${slip.month}월 급여명세서`;
  const allRows = (slip.allowances || []).map(a =>
    `<tr><td>${a.label}</td><td class="r">${fmtKRW(a.amount)}</td></tr>`).join('');
  const dedRows = (slip.deductions || []).map(d =>
    `<tr><td>${d.label}</td><td class="r red">- ${fmtKRW(d.amount)}</td></tr>`).join('');

  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${title}</title>
<style>
body{font-family:'Noto Sans KR',sans-serif;padding:32px;font-size:14px;color:#1e293b}
h2{text-align:center;margin-bottom:24px}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
th{background:#f1f5f9;padding:8px 12px;text-align:left;font-size:13px}
td{padding:8px 12px;border-bottom:1px solid #e2e8f0}
.r{text-align:right}.red{color:#dc2626}
.net{font-size:18px;font-weight:700;text-align:right;padding:16px 0;border-top:2px solid #1e293b}
@media print{button{display:none}}
</style></head><body>
<h2>${title}</h2>
<table><tr><th colspan="2">지급 항목</th></tr>
<tr><td>기본급</td><td class="r">${fmtKRW(slip.baseSalary)}</td></tr>
${allRows}
${slip.overtimePay > 0 ? `<tr><td>연장근로수당 (${slip.overtimeHours}h)</td><td class="r">${fmtKRW(slip.overtimePay)}</td></tr>` : ''}
${slip.nightPay > 0 ? `<tr><td>야간근로수당 (${slip.nightHours}h)</td><td class="r">${fmtKRW(slip.nightPay)}</td></tr>` : ''}
${slip.holidayPay > 0 ? `<tr><td>휴일근로수당 (${slip.holidayHours}h)</td><td class="r">${fmtKRW(slip.holidayPay)}</td></tr>` : ''}
<tr><td><strong>지급 합계</strong></td><td class="r"><strong>${fmtKRW(slip.grossPay)}</strong></td></tr>
</table>
<table><tr><th colspan="2">공제 항목</th></tr>
${dedRows}
<tr><td><strong>공제 합계</strong></td><td class="r red"><strong>- ${fmtKRW(slip.totalDeduction)}</strong></td></tr>
</table>
<div class="net">실수령액: ${fmtKRW(slip.netPay)}</div>
<button onclick="window.print()">🖨️ 인쇄</button>
</body></html>`);
  win.document.close();
}

function _styles() {
  return `<style>
#payslip-page .top-bar { display:flex; align-items:center; padding:12px 16px; gap:10px; background:var(--bg); border-bottom:1px solid var(--border); flex-shrink:0; }
#payslip-page .page-title { flex:1; font-size:18px; font-weight:700; margin:0; }

.slip-list { padding:12px 16px 100px; display:flex; flex-direction:column; gap:12px; }

.slip-card { background:var(--card-bg); border-radius:14px; border:1px solid var(--border); overflow:hidden; }
.slip-summary { padding:16px; cursor:pointer; }
.slip-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; }
.slip-title { font-size:15px; font-weight:700; }
.slip-issued { font-size:12px; color:var(--text-secondary); margin-top:2px; }
.slip-net-preview { font-size:16px; font-weight:800; color:#4F46E5; }
.slip-toggle { text-align:right; }
.toggle-label { font-size:12px; color:#6366F1; font-weight:500; }

.slip-detail { padding:0 16px 16px; border-top:1px solid var(--border); }
.slip-section { margin-bottom:14px; padding-top:12px; }
.slip-section-title { font-size:12px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:.05em; margin-bottom:8px; }
.slip-row { display:flex; justify-content:space-between; padding:5px 0; font-size:14px; border-bottom:1px dashed var(--border); }
.slip-row:last-child { border:none; }
.slip-row.total { font-weight:700; border-top:1px solid var(--border); padding-top:8px; }
.slip-row.deduct span:last-child { color:#EF4444; }

.slip-net-box { display:flex; justify-content:space-between; align-items:center; background:#EEF2FF; border-radius:10px; padding:14px 16px; margin-bottom:14px; }
.net-label  { font-size:14px; font-weight:600; color:#4338CA; }
.net-amount { font-size:22px; font-weight:800; color:#4F46E5; }

.slip-hours { display:flex; justify-content:space-around; background:var(--surface,#F8FAFC); border-radius:10px; padding:12px; margin-bottom:14px; }
.sh-item { text-align:center; }
.sh-val  { display:block; font-size:16px; font-weight:700; }
.sh-lbl  { font-size:11px; color:var(--text-secondary); }

.btn-print { width:100%; background:transparent; border:1.5px solid var(--border); border-radius:10px; padding:10px; font-size:14px; cursor:pointer; color:var(--text); }

.empty-state { text-align:center; padding:60px 20px; }
.es-icon { font-size:40px; margin-bottom:12px; }
.es-text { color:var(--text-secondary); }

.ps-unread-badge { background:#EF4444; color:#fff; font-size:11px; font-weight:700; padding:3px 8px; border-radius:20px; margin-left:auto; }
.ps-new-dot { display:inline-block; background:#EF4444; color:#fff; font-size:10px; font-weight:700; padding:1px 5px; border-radius:4px; margin-left:6px; vertical-align:middle; }
.slip-card.unread { border-color:#C7D2FE; box-shadow:0 0 0 2px #EEF2FF; }
</style>`;
}

export function unmount() {}
