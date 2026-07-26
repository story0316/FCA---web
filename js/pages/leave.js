/**
 * leave.js — 연차·휴가 현황 페이지 (#/leave)
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
import { LEAVE_TYPES, LEAVE_TYPE_MAP, LEAVE_STATUS } from '../data/leave-types.js';
import {
  getLeaveBalance, getLeaveRequests, cancelLeaveRequest, saveLeaveRequest,
} from '../utils/leave-engine.js';
import { api } from '../api.js';

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId() {
  const s = _session();
  return s.empId || s.userId || s.id || 'EMP001';
}

const DEMO_USER_ID  = 'demo';
const DEMO_HIRE     = '2024-03-15';

export async function render(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  const user      = JSON.parse(localStorage.getItem('hr_user') || '{}');
  const userId    = user.id || DEMO_USER_ID;
  const hireDate  = user.hireDate || DEMO_HIRE;

  // Supabase 신청 내역을 로컬에 병합 (leave-engine 단일 진실점 사용)
  const remote = await api.leave.getRequests(userId);
  if (remote && remote.length) {
    const existingIds = new Set(getLeaveRequests(userId).map(r => r.id));
    const toAdd = remote
      .filter(r => !existingIds.has(r.id))
      .map(r => ({
        id: r.id, userId, type: r.leave_type,
        startDate: r.start_date, endDate: r.end_date,
        days: r.days, reason: r.reason, status: r.status,
        deductDays: r.days, createdAt: r.created_at,
      }));
    toAdd.forEach(r => saveLeaveRequest(r));
  }

  const balance   = getLeaveBalance(userId, hireDate);
  const requests  = getLeaveRequests(userId);

  root.innerHTML = `
<div class="page" id="leave-page">
  <header class="top-bar">
    <button class="btn-icon back-btn" aria-label="뒤로">&#8592;</button>
    <h1 class="page-title">연차·휴가</h1>
    <a href="#/leave/apply" class="btn-primary btn-sm">+ 신청</a>
  </header>

  <div class="page-content" id="leave-content">

    <!-- 연차 잔여 카드 -->
    <section class="leave-balance-card">
      <div class="balance-header">
        <span class="balance-label">올해 연차</span>
        <span class="balance-year">${new Date().getFullYear()}년</span>
      </div>
      <div class="balance-ring-wrap">
        <svg class="balance-ring" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" fill="none" stroke="#E2E8F0" stroke-width="10"/>
          <circle cx="60" cy="60" r="50" fill="none" stroke="#4F46E5" stroke-width="10"
            stroke-dasharray="${_arc(balance.remaining, balance.entitlement)} 314"
            stroke-dashoffset="78.5"
            stroke-linecap="round"/>
        </svg>
        <div class="balance-center">
          <span class="balance-remaining">${balance.remaining}</span>
          <span class="balance-unit">일 남음</span>
        </div>
      </div>
      <div class="balance-row">
        <div class="balance-item">
          <span class="bi-val">${balance.entitlement}</span>
          <span class="bi-lbl">총 발생</span>
        </div>
        <div class="balance-item">
          <span class="bi-val used">${balance.used}</span>
          <span class="bi-lbl">사용</span>
        </div>
        <div class="balance-item">
          <span class="bi-val remain">${balance.remaining}</span>
          <span class="bi-lbl">잔여</span>
        </div>
      </div>
      <p class="balance-hint">입사일 ${hireDate} · 근속 ${balance.years}년차</p>
    </section>

    <!-- 유형별 요약 -->
    <section class="leave-types-bar">
      ${LEAVE_TYPES.filter(t => t.id !== 'other').map(t => `
        <div class="lt-chip">
          <span class="lt-icon">${t.icon}</span>
          <span class="lt-name">${t.label}</span>
        </div>
      `).join('')}
      <a href="#/leave/apply" class="lt-chip lt-add">
        <span class="lt-icon">＋</span>
        <span class="lt-name">신청</span>
      </a>
    </section>

    <!-- 신청 내역 -->
    <section class="leave-requests-section">
      <h2 class="section-title">신청 내역</h2>
      ${_renderRequests(requests)}
    </section>

  </div>
</div>
${_styles()}`;

  _bindEvents(root, userId, hireDate);
}

function _arc(remaining, total) {
  if (!total) return 0;
  const ratio = Math.min(1, remaining / total);
  return Math.round(ratio * 314);
}

function _renderRequests(requests) {
  if (!requests.length) {
    return `<div class="empty-state">
      <div class="es-icon">📋</div>
      <p class="es-text">신청 내역이 없습니다.</p>
      <a href="#/leave/apply" class="btn-primary">첫 휴가 신청하기</a>
    </div>`;
  }

  const sorted = [...requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return sorted.map(r => {
    const type   = LEAVE_TYPE_MAP[r.type] || LEAVE_TYPE_MAP.other;
    const status = LEAVE_STATUS[r.status] || LEAVE_STATUS.pending;
    const canCancel = r.status === 'pending';

    return `<div class="leave-card" data-id="${r.id}">
      <div class="lc-left">
        <span class="lc-icon" style="background:${type.color}20;color:${type.color}">${type.icon}</span>
      </div>
      <div class="lc-body">
        <div class="lc-row1">
          <span class="lc-type">${type.label}</span>
          <span class="lc-status-badge" style="color:${status.color};background:${status.bg}">
            ${status.icon} ${status.label}
          </span>
        </div>
        <div class="lc-dates">${r.startDate}${r.startDate !== r.endDate ? ` ~ ${r.endDate}` : ''} · ${r.days}일</div>
        ${r.reason ? `<div class="lc-reason">${r.reason}</div>` : ''}
        ${canCancel ? `<button class="btn-cancel-leave" data-id="${r.id}">취소</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function _bindEvents(root, userId, hireDate) {
  root.querySelector('.back-btn')?.addEventListener('click', () => window.navBack());

  root.addEventListener('click', e => {
    const btn = e.target.closest('.btn-cancel-leave');
    if (!btn) return;
    const id = btn.dataset.id;
    
    cancelLeaveRequest(id);
    api.leave.cancelRequest(id);
    showToast('휴가 신청이 취소되었습니다.', 'info');
      addNotification({ type: 'info', title: '휴가 신청', body: '휴가 신청이 취소되었습니다.' });
    const content = root.querySelector('#leave-content');
    const balance  = getLeaveBalance(userId, hireDate);
    const requests = getLeaveRequests(userId);
    content.querySelector('.leave-requests-section').innerHTML =
      `<h2 class="section-title">신청 내역</h2>${_renderRequests(requests)}`;
    content.querySelector('.balance-remaining').textContent = balance.remaining;
    content.querySelector('.bi-val.used').textContent       = balance.used;
    content.querySelector('.bi-val.remain').textContent     = balance.remaining;
  });
}

function _styles() {
  return `<style>
/* ── leave page ────────────────────────────── */
#leave-page .top-bar { display:flex; align-items:center; padding:12px 16px; gap:10px; background:var(--bg); border-bottom:1px solid var(--border); flex-shrink:0; }
#leave-page .page-title { flex:1; font-size:18px; font-weight:700; margin:0; }
#leave-page .btn-sm { padding:6px 14px; font-size:13px; border-radius:8px; text-decoration:none; background:#4F46E5; color:#fff; font-weight:600; }

/* Balance card */
.leave-balance-card { margin:16px; background:var(--card-bg); border-radius:16px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,.08); }
.balance-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
.balance-label { font-size:16px; font-weight:700; }
.balance-year  { font-size:13px; color:var(--text-secondary); }
.balance-ring-wrap { position:relative; width:120px; margin:0 auto 16px; }
.balance-ring { width:120px; height:120px; transform:rotate(0deg); }
.balance-center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.balance-remaining { font-size:32px; font-weight:800; color:#4F46E5; line-height:1; }
.balance-unit { font-size:12px; color:var(--text-secondary); }
.balance-row { display:flex; justify-content:space-around; border-top:1px solid var(--border); padding-top:14px; margin-top:4px; }
.balance-item { text-align:center; }
.bi-val { display:block; font-size:22px; font-weight:700; }
.bi-val.used   { color:#EF4444; }
.bi-val.remain { color:#4F46E5; }
.bi-lbl { font-size:11px; color:var(--text-secondary); margin-top:2px; display:block; }
.balance-hint { text-align:center; font-size:12px; color:var(--text-secondary); margin:12px 0 0; }

/* Type chips */
.leave-types-bar { display:flex; gap:8px; padding:0 16px 8px; overflow-x:auto; scrollbar-width:none; }
.leave-types-bar::-webkit-scrollbar { display:none; }
.lt-chip { display:flex; flex-direction:column; align-items:center; background:var(--card-bg); border-radius:12px; padding:10px 14px; gap:4px; min-width:60px; text-decoration:none; color:var(--text); border:1px solid var(--border); flex-shrink:0; cursor:pointer; }
.lt-icon { font-size:20px; }
.lt-name { font-size:11px; color:var(--text-secondary); }
.lt-add { background:#4F46E510; border-color:#4F46E5; color:#4F46E5; }
.lt-add .lt-icon { font-size:18px; }

/* Request list */
.leave-requests-section { margin:8px 16px 0; }
.section-title { font-size:15px; font-weight:700; margin-bottom:12px; }
.leave-card { display:flex; gap:12px; background:var(--card-bg); border-radius:12px; padding:14px; margin-bottom:10px; border:1px solid var(--border); }
.lc-left { flex-shrink:0; }
.lc-icon { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:18px; }
.lc-body { flex:1; min-width:0; }
.lc-row1 { display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; }
.lc-type { font-size:14px; font-weight:600; }
.lc-status-badge { font-size:12px; padding:3px 8px; border-radius:20px; font-weight:500; }
.lc-dates  { font-size:12px; color:var(--text-secondary); margin-bottom:2px; }
.lc-reason { font-size:12px; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.btn-cancel-leave { margin-top:8px; background:transparent; border:1px solid #EF4444; color:#EF4444; border-radius:6px; padding:3px 10px; font-size:12px; cursor:pointer; }

/* Empty */
.empty-state { text-align:center; padding:40px 20px; }
.es-icon { font-size:40px; margin-bottom:12px; }
.es-text { color:var(--text-secondary); margin-bottom:16px; }
.btn-primary { display:inline-block; background:#4F46E5; color:#fff; border:none; border-radius:10px; padding:12px 24px; font-size:14px; font-weight:600; cursor:pointer; text-decoration:none; }
</style>`;
}

export function unmount() {}
