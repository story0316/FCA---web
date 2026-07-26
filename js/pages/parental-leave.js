/**
 * parental-leave.js — 모성보호 신청 (#/parental-leave)
 * 남녀고용평등법 제19조, 근로기준법 제74조 기준
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId() {
  const s = _session();
  return s.empId || s.userId || s.id || 'EMP001';
}

const TODAY = new Date().toISOString().slice(0,10);

const LS_PARENTAL = 'hr_parental_leave_requests';

const PARENTAL_TYPES = [
  {
    id:      'parental',
    label:   '육아휴직',
    icon:    '👶',
    color:   '#10B981',
    basis:   '남녀고용평등법 제19조',
    maxDays: 365,
    isPaid:  false,
    desc:    '만 8세 이하(초등 2학년 이하) 자녀 양육 목적. 1년 이내. 고용보험 급여 지급.',
  },
  {
    id:      'parental_short',
    label:   '육아기 근로시간 단축',
    icon:    '⏱️',
    color:   '#6366F1',
    basis:   '남녀고용평등법 제19조의2',
    maxDays: 365,
    isPaid:  true,
    desc:    '주 15~35시간으로 단축. 최대 1년(육아휴직 미사용분 가산 가능).',
  },
  {
    id:      'maternity',
    label:   '출산전후휴가',
    icon:    '🤱',
    color:   '#EC4899',
    basis:   '근로기준법 제74조',
    maxDays: 90,
    isPaid:  true,
    desc:    '출산 전후 총 90일(다태아 120일). 출산 후 최소 45일 이상.',
  },
  {
    id:      'miscarriage',
    label:   '유산·사산 휴가',
    icon:    '🌸',
    color:   '#F97316',
    basis:   '근로기준법 제74조',
    maxDays: 90,
    isPaid:  true,
    desc:    '임신 기간에 따라 5~90일 부여.',
  },
];

const STATUS_MAP = {
  pending:   { label: '검토 중', icon: '⏳', color: '#F59E0B', bg: '#FEF3C7' },
  approved:  { label: '승인',   icon: '✅', color: '#059669', bg: '#D1FAE5' },
  rejected:  { label: '반려',   icon: '❌', color: '#DC2626', bg: '#FEE2E2' },
};

let _selectedType = null;

function _getRequests(userId) {
  return JSON.parse(localStorage.getItem(LS_PARENTAL) || '[]')
    .filter(r => r.userId === userId);
}

function _saveRequest(req) {
  const all = JSON.parse(localStorage.getItem(LS_PARENTAL) || '[]');
  all.push(req);
  localStorage.setItem(LS_PARENTAL, JSON.stringify(all));
}

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
  const userId = _empId();
  const requests = _getRequests(userId);

  root.innerHTML = `
<div class="page" id="parental-leave-page">
  <header class="top-bar">
    <button class="btn-icon back-btn" aria-label="뒤로">&#8592;</button>
    <h1 class="page-title">모성보호 신청</h1>
  </header>

  <div class="page-content">

    <!-- 제도 선택 -->
    <div class="pl-section">
      <div class="pl-section-title">신청할 제도를 선택하세요</div>
      <div class="pl-type-list">
        ${PARENTAL_TYPES.map(t => `
          <div class="pl-type-card${_selectedType===t.id?' selected':''}" data-type="${t.id}"
               style="--tc:${t.color}">
            <div class="ptc-left">
              <span class="ptc-icon">${t.icon}</span>
              <div>
                <div class="ptc-label">${t.label}</div>
                <div class="ptc-basis">${t.basis}</div>
              </div>
            </div>
            <span class="ptc-arrow">${_selectedType===t.id ? '▲' : '▼'}</span>
          </div>
          ${_selectedType===t.id ? `<div class="pl-type-detail">
            <p>${t.desc}</p>
            <form class="pl-form" id="pl-form">
              <label class="form-label">시작일 <span class="req">*</span></label>
              <input type="date" id="pl-start" class="form-input" min="${TODAY}" value="${TODAY}" required>
              <label class="form-label" style="margin-top:12px">종료일 <span class="req">*</span></label>
              <input type="date" id="pl-end" class="form-input" min="${TODAY}" required>
              <label class="form-label" style="margin-top:12px">사유 / 자녀 정보</label>
              <textarea maxlength="500" id="pl-reason" class="form-textarea" rows="2"
                placeholder="예: 2024년 3월 출생 자녀 육아"></textarea>
              <button type="submit" class="pl-submit-btn" style="background:${t.color}">신청하기</button>
            </form>
          </div>` : ''}
        `).join('')}
      </div>
    </div>

    <!-- 신청 내역 -->
    ${requests.length ? `
    <div class="pl-section">
      <div class="pl-section-title">신청 내역</div>
      ${requests.map(r => {
        const t = PARENTAL_TYPES.find(x => x.id === r.type);
        const s = STATUS_MAP[r.status] || STATUS_MAP.pending;
        return `<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:14px;font-weight:700">${t?.icon} ${t?.label}</span>
            <span style="font-size:12px;padding:3px 10px;border-radius:20px;font-weight:600;color:${s.color};background:${s.bg}">${s.icon} ${s.label}</span>
          </div>
          <div style="font-size:12px;color:var(--text-secondary)">${r.startDate} ~ ${r.endDate}</div>
          ${r.reason ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:2px">${r.reason}</div>` : ''}
        </div>`;
      }).join('')}
    </div>` : `
    <div class="pl-section">
      <div class="pl-section-title">신청 내역</div>
      <div style="text-align:center;padding:32px 20px;color:var(--text-muted)">
        <div style="font-size:40px;margin-bottom:12px">📋</div>
        <div style="font-size:14px;font-weight:600;margin-bottom:6px">신청 내역이 없습니다</div>
        <div style="font-size:12px">위 휴직·휴가 유형을 선택해 신청하세요</div>
      </div>
    </div>`}

    <!-- 법적 안내 -->
    <div class="pl-notice">
      <div style="font-size:13px;font-weight:700;color:#1D4ED8;margin-bottom:6px">📌 법적 보호</div>
      <ul style="margin:0;padding-left:16px;font-size:12px;color:#1E40AF;line-height:1.8">
        <li>육아휴직 신청 시 사업주는 30일 이내 허용해야 합니다</li>
        <li>육아휴직을 이유로 한 불이익 처우는 위법입니다</li>
        <li>고용보험 육아휴직 급여 최대 월 150만원 지급</li>
      </ul>
    </div>

  </div>
</div>
${_styles()}`;

  _bindEvents(root, userId);
}

function _bindEvents(root, userId) {
  root.querySelector('.back-btn').addEventListener('click', () => window.navBack());

  root.addEventListener('click', e => {
    const card = e.target.closest('.pl-type-card');
    if (card && !e.target.closest('.pl-form')) {
      _selectedType = _selectedType === card.dataset.type ? null : card.dataset.type;
      render(root);
    }
  });

  root.querySelector('#pl-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const start  = root.querySelector('#pl-start').value;
    const end    = root.querySelector('#pl-end').value;
    const reason = root.querySelector('#pl-reason').value.trim();
    if (!start || !end || end < start) {
      showToast('날짜를 올바르게 입력해 주세요.', 'error');
      return;
    }
    _saveRequest({
      id:        'PL' + Date.now(),
      userId,
      type:      _selectedType,
      startDate: start,
      endDate:   end,
      reason,
      status:    'pending',
      createdAt: new Date().toISOString().slice(0, 10),
    });
    _selectedType = null;
    showToast('모성보호 신청이 접수되었습니다. 검토 후 안내드리겠습니다. ✅', 'success')
    addNotification({ type: 'success', title: '육아휴직', body: '모성보호 신청이 접수되었습니다. 검토 후 안내드리겠습니다. ✅' });
    render(root);
  });
}

function _styles() {
  return `<style>
#parental-leave-page .top-bar { display:flex; align-items:center; padding:12px 16px; gap:10px; background:var(--bg); border-bottom:1px solid var(--border); flex-shrink:0; }
#parental-leave-page .page-title { flex:1; font-size:18px; font-weight:700; margin:0; }
.pl-section { padding:16px 16px 0; }
.pl-section-title { font-size:14px; font-weight:700; margin-bottom:12px; }
.pl-type-list { display:flex; flex-direction:column; gap:8px; margin-bottom:8px; }
.pl-type-card { display:flex; align-items:center; justify-content:space-between; background:var(--card-bg); border:2px solid var(--border); border-radius:12px; padding:14px; cursor:pointer; transition:.15s; }
.pl-type-card.selected { border-color:var(--tc, #4F46E5); background:color-mix(in srgb, var(--tc,#4F46E5) 8%, transparent); }
.ptc-left  { display:flex; align-items:center; gap:12px; }
.ptc-icon  { font-size:22px; flex-shrink:0; }
.ptc-label { font-size:14px; font-weight:700; }
.ptc-basis { font-size:11px; color:var(--text-secondary); margin-top:2px; }
.ptc-arrow { font-size:12px; color:var(--text-secondary); }
.pl-type-detail { background:var(--surface,#F8FAFC); border-radius:0 0 12px 12px; padding:14px 16px; margin-top:-8px; border:2px solid var(--border); border-top:none; margin-bottom:8px; }
.pl-type-detail p { font-size:13px; color:var(--text-secondary); line-height:1.6; margin:0 0 12px; }
.pl-form { display:flex; flex-direction:column; gap:4px; }
.form-label { font-size:13px; font-weight:600; }
.req { color:#EF4444; }
.form-input, .form-textarea { width:100%; padding:9px 12px; border:1.5px solid var(--border); border-radius:10px; font-size:14px; background:var(--card-bg); color:var(--text); box-sizing:border-box; margin-top:4px; }
.form-textarea { resize:vertical; }
.form-input:focus, .form-textarea:focus { outline:none; border-color:#4F46E5; }
.pl-submit-btn { width:100%; border:none; border-radius:10px; padding:12px; font-size:15px; font-weight:700; color:#fff; cursor:pointer; margin-top:14px; }
.pl-notice { margin:16px 16px 100px; background:#EFF6FF; border-radius:12px; padding:14px 16px; border:1px solid #BFDBFE; }
</style>`;
}

export function unmount() {
  _selectedType = null;
}
