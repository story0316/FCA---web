/**
 * leave-apply.js — 휴가 신청 폼 (#/leave/apply)
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
import { LEAVE_TYPES, LEAVE_TYPE_MAP } from '../data/leave-types.js';
import {
  calcDeductDays, getLeaveBalance, saveLeaveRequest, getLeavePolicy,
} from '../utils/leave-engine.js';

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId() {
  const s = _session();
  return s.empId || s.userId || 'EMP001';
}

const DEMO_USER_ID = 'demo';
const DEMO_HIRE    = '2024-03-15';

let _selectedType = 'annual';

export function render(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  const user     = JSON.parse(localStorage.getItem('hr_user') || '{}');
  const userId   = _empId();
  const hireDate = _session().joinDate || user.hireDate || DEMO_HIRE;
  const balance  = getLeaveBalance(userId, hireDate);
  const policy   = getLeavePolicy();
  const today    = new Date().toISOString().slice(0, 10);

  root.innerHTML = `
<div class="page" id="leave-apply-page">
  <header class="top-bar">
    <button class="btn-icon back-btn" aria-label="뒤로">&#8592;</button>
    <h1 class="page-title">휴가 신청</h1>
  </header>

  <div class="page-content">
    <form id="leave-form" novalidate>

      <!-- 잔여 연차 배너 -->
      <div class="balance-banner">
        <span class="bb-icon">🌴</span>
        <span class="bb-text">잔여 연차 <strong>${balance.remaining}일</strong> / ${balance.entitlement}일</span>
      </div>

      <!-- 유형 선택 -->
      <section class="form-section">
        <label class="form-label">휴가 유형</label>
        <div class="type-grid" id="type-grid">
          ${LEAVE_TYPES.map(t => `
            <button type="button" class="type-btn${t.id === 'annual' ? ' selected' : ''}"
              data-type="${t.id}" style="--tc:${t.color}">
              <span class="tb-icon">${t.icon}</span>
              <span class="tb-label">${t.label}</span>
              ${t.deductsBalance ? '<span class="tb-tag">연차차감</span>' : ''}
            </button>
          `).join('')}
        </div>
        <p class="type-desc" id="type-desc">${LEAVE_TYPE_MAP['annual'].desc}</p>
      </section>

      <!-- 날짜 -->
      <section class="form-section" id="date-section">
        <label class="form-label">날짜</label>
        <div class="date-row">
          <div class="date-field">
            <label class="date-sub-label">시작일</label>
            <input type="date" id="start-date" class="form-input" value="${today}" min="${today}" required>
          </div>
          <span class="date-sep">~</span>
          <div class="date-field">
            <label class="date-sub-label">종료일</label>
            <input type="date" id="end-date" class="form-input" value="${today}" min="${today}" required>
          </div>
        </div>
        <div class="days-preview" id="days-preview">
          <span id="days-val">1</span>일 차감 예정
        </div>
      </section>

      <!-- 반차 시간 (half만) -->
      <section class="form-section hidden" id="half-section">
        <label class="form-label">반차 구분</label>
        <div class="toggle-group">
          <label class="tg-opt">
            <input type="radio" name="half-time" value="am" checked> 오전 반차
          </label>
          <label class="tg-opt">
            <input type="radio" name="half-time" value="pm"> 오후 반차
          </label>
        </div>
        <div class="days-preview">0.5일 차감 예정</div>
      </section>

      <!-- 사유 -->
      <section class="form-section">
        <label class="form-label" for="reason">
          사유 ${policy.requireReason ? '<span class="req">*</span>' : '(선택)'}
        </label>
        <textarea maxlength="500" id="reason" class="form-textarea" rows="3"
          placeholder="휴가 사유를 입력해 주세요." ${policy.requireReason ? 'required' : ''}></textarea>
      </section>

      <!-- 첨부 메모 -->
      <section class="form-section">
        <label class="form-label" for="attach-note">첨부 메모 <span class="opt-badge">선택</span></label>
        <input type="text" id="attach-note" class="form-input"
          placeholder="증빙 서류 등 참고 메모 (선택)">
      </section>

      <button type="submit" class="submit-btn" id="submit-btn">신청하기</button>
    </form>
  </div>
</div>
${_styles()}`;

  _bindEvents(root, userId, hireDate, balance);
}

function _bindEvents(root, userId, hireDate, balance) {
  root.querySelector('.back-btn').addEventListener('click', () => window.navBack());

  const typeGrid    = root.querySelector('#type-grid');
  const typeDesc    = root.querySelector('#type-desc');
  const dateSection = root.querySelector('#date-section');
  const halfSection = root.querySelector('#half-section');
  const startInput  = root.querySelector('#start-date');
  const endInput    = root.querySelector('#end-date');
  const daysVal     = root.querySelector('#days-val');
  const form        = root.querySelector('#leave-form');

  function updateDaysPreview() {
    if (_selectedType === 'half') return;
    const start = startInput.value;
    const end   = endInput.value;
    if (start && end && end >= start) {
      const d = calcDeductDays(_selectedType, start, end);
      daysVal.textContent = d;
    }
  }

  typeGrid.addEventListener('click', e => {
    const btn = e.target.closest('.type-btn');
    if (!btn) return;
    _selectedType = btn.dataset.type;
    typeGrid.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    typeDesc.textContent = LEAVE_TYPE_MAP[_selectedType]?.desc || '';

    const isHalf = _selectedType === 'half';
    dateSection.classList.toggle('hidden', isHalf);
    halfSection.classList.toggle('hidden', !isHalf);
    if (!isHalf) updateDaysPreview();
  });

  startInput.addEventListener('change', () => {
    if (endInput.value < startInput.value) endInput.value = startInput.value;
    endInput.min = startInput.value;
    updateDaysPreview();
  });
  endInput.addEventListener('change', updateDaysPreview);

  form.addEventListener('submit', e => {
    e.preventDefault();
    _submit(root, userId, hireDate, balance);
  });
}

function _submit(root, userId, hireDate, balance) {
  const typeObj = LEAVE_TYPE_MAP[_selectedType];
  const policy  = getLeavePolicy();

  let startDate, endDate, days;

  if (_selectedType === 'half') {
    startDate = new Date().toISOString().slice(0, 10);
    endDate   = startDate;
    days      = 0.5;
  } else {
    startDate = root.querySelector('#start-date').value;
    endDate   = root.querySelector('#end-date').value;
    if (!startDate || !endDate || endDate < startDate) {
      showToast('날짜를 올바르게 입력해 주세요.', 'error');
      return;
    }
    days = calcDeductDays(_selectedType, startDate, endDate);
  }

  const reason = root.querySelector('#reason').value.trim();
  if (policy.requireReason && !reason) {
    showToast('사유를 입력해 주세요.', 'error');
    return;
  }

  if (typeObj.deductsBalance && days > balance.remaining) {
    showToast(`잔여 연차(${balance.remaining}일)가 부족합니다.`, 'error');
    return;
  }

  const req = {
    id:          'lr' + Date.now(),
    userId,
    type:        _selectedType,
    status:      typeObj.requiresApproval ? 'pending' : 'approved',
    startDate,
    endDate,
    days,
    reason,
    attachNote:  root.querySelector('#attach-note').value.trim(),
    halfTime:    _selectedType === 'half'
                   ? (root.querySelector('[name=half-time]:checked')?.value || 'am')
                   : null,
    createdAt:   new Date().toISOString().slice(0, 10),
  };

  saveLeaveRequest(req);
  const leaveMsg = typeObj.requiresApproval ? '휴가 신청이 접수되었습니다. 승인을 기다려 주세요.' : '휴가가 등록되었습니다.';
  showToast(leaveMsg + ' ✅', 'success');
  addNotification({ type: 'success', title: '휴가 신청', body: leaveMsg });
  location.hash = '#/leave';
}

function _styles() {
  return `<style>
#leave-apply-page .top-bar { display:flex; align-items:center; padding:12px 16px; gap:10px; background:var(--bg); border-bottom:1px solid var(--border); flex-shrink:0; }
#leave-apply-page .page-title { flex:1; font-size:18px; font-weight:700; margin:0; }

.balance-banner { display:flex; align-items:center; gap:10px; background:#EEF2FF; border-radius:12px; padding:12px 16px; margin:16px; }
.bb-icon { font-size:20px; }
.bb-text { font-size:14px; color:#4338CA; }
.bb-text strong { font-size:18px; font-weight:800; }

.form-section { padding:0 16px 20px; }
.form-section.hidden { display:none; }
.form-label { display:block; font-size:14px; font-weight:600; margin-bottom:10px; }
.req { color:#EF4444; }
.opt-badge { font-size:11px; background:#F1F5F9; color:var(--text-muted); padding:2px 6px; border-radius:4px; font-weight:400; vertical-align:middle; margin-left:4px; }

.type-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:10px; }
.type-btn { display:flex; flex-direction:column; align-items:center; gap:4px; padding:10px 8px; border:2px solid var(--border); border-radius:12px; background:var(--card-bg); cursor:pointer; transition:all .15s; }
.type-btn.selected { border-color:var(--tc,#4F46E5); background:color-mix(in srgb, var(--tc,#4F46E5) 10%, transparent); }
.tb-icon  { font-size:22px; }
.tb-label { font-size:12px; font-weight:600; }
.tb-tag   { font-size:10px; color:#6366F1; background:#EEF2FF; padding:2px 5px; border-radius:4px; }
.type-desc { font-size:12px; color:var(--text-secondary); padding:0 4px; }

.date-row { display:flex; align-items:center; gap:8px; }
.date-field { flex:1; display:flex; flex-direction:column; gap:4px; }
.date-sub-label { font-size:12px; color:var(--text-secondary); }
.date-sep { font-size:18px; color:var(--text-secondary); padding-top:16px; }
.form-input { width:100%; padding:10px 12px; border:1.5px solid var(--border); border-radius:10px; font-size:14px; background:var(--card-bg); color:var(--text); box-sizing:border-box; }
.form-input:focus { outline:none; border-color:#4F46E5; }
.days-preview { margin-top:8px; font-size:13px; color:#4338CA; background:#EEF2FF; padding:6px 12px; border-radius:8px; }
#days-val { font-weight:700; font-size:16px; }

.toggle-group { display:flex; gap:16px; margin-bottom:8px; }
.tg-opt { display:flex; align-items:center; gap:6px; font-size:14px; cursor:pointer; }

.form-textarea { width:100%; padding:10px 12px; border:1.5px solid var(--border); border-radius:10px; font-size:14px; resize:vertical; background:var(--card-bg); color:var(--text); box-sizing:border-box; }
.form-textarea:focus { outline:none; border-color:#4F46E5; }

.submit-btn { display:block; width:calc(100% - 32px); margin:8px 16px 120px; background:#4F46E5; color:#fff; border:none; border-radius:12px; padding:16px; font-size:16px; font-weight:700; cursor:pointer; }
.submit-btn:active { opacity:.85; }
</style>`;
}

export function unmount() {
  _selectedType = 'annual';
}
