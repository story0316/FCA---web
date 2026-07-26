/**
 * legal-edu.js — 직원 법정교육 현황 (#/legal-edu)
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { LEGAL_EDU_TYPES, LEGAL_EDU_MAP, EDU_STATUS } from '../data/legal-edu-types.js';
import { addNotification } from '../components/notification-hub.js';

const LS_SCHEDULE = 'hr_legal_edu_schedule';
const LS_MY_EDU   = 'hr_my_edu_records';

// ── 데모 데이터 ───────────────────────────────────────────────

function _demoSchedule() {
  const y = new Date().getFullYear();
  return [
    {
      id:            'sexual_harassment',
      scheduledDate: `${y}-03-15`,
      completedDate: `${y}-03-15`,
      completedHours: 1,
      status:        'completed',
      provider:      '온라인 e-러닝',
    },
    {
      id:            'safety',
      scheduledDate: `${y}-03-20`,
      completedDate: `${y}-03-20`,
      completedHours: 6,
      status:        'completed',
      provider:      '안전보건공단 위탁',
    },
    {
      id:            'harassment_prevention',
      scheduledDate: `${y}-09-01`,
      completedDate: null,
      completedHours: 0,
      status:        'scheduled',
      provider:      null,
    },
    {
      id:            'privacy',
      scheduledDate: `${y}-10-15`,
      completedDate: null,
      completedHours: 0,
      status:        'scheduled',
      provider:      null,
    },
  ];
}

function _getSchedule() {
  if (!localStorage.getItem(LS_SCHEDULE)) {
    localStorage.setItem(LS_SCHEDULE, JSON.stringify(_demoSchedule()));
  }
  return JSON.parse(localStorage.getItem(LS_SCHEDULE));
}

function _dDay(dateStr) {
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  if (diff < 0)  return `D+${Math.abs(diff)}`;
  if (diff === 0) return 'D-Day';
  return `D-${diff}`;
}

// ── 렌더링 ────────────────────────────────────────────────────

export function render(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  const schedule = _getSchedule();
  if (!schedule || !schedule.length) { root.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:40px;margin-bottom:10px">⚖️</div><div style="font-size:14px;font-weight:600;margin-bottom:4px">법정 교육 일정이 없습니다.</div><div style="font-size:12px;margin-bottom:14px">HR 담당자에게 문의하세요.</div><button onclick="window.location.hash='#/ai-consult'" style="padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">HR 문의하기</button></div>`; return; }
  const done     = schedule.filter(s => s.status === 'completed').length;

  root.innerHTML = `
<div class="page" id="legal-edu-page">
  <header class="top-bar">
    <button class="btn-icon back-btn" aria-label="뒤로">&#8592;</button>
    <h1 class="page-title">법정교육 현황</h1>
  </header>

  <div class="page-content">

    <!-- 진행 요약 -->
    <div class="edu-summary-card">
      <div class="esc-left">
        <div class="esc-year">${new Date().getFullYear()}년 법정교육</div>
        <div class="esc-count">${done} / ${schedule.length} 완료</div>
        <div class="esc-bar-wrap">
          <div class="esc-bar" style="width:${Math.round(done/schedule.length*100)}%"></div>
        </div>
      </div>
      <div class="esc-ring">
        <svg viewBox="0 0 64 64" class="ring-svg">
          <circle cx="32" cy="32" r="26" fill="none" stroke="#E2E8F0" stroke-width="8"/>
          <circle cx="32" cy="32" r="26" fill="none" stroke="#10B981" stroke-width="8"
            stroke-dasharray="${Math.round(done/schedule.length*163)} 163"
            stroke-dashoffset="41"
            stroke-linecap="round"/>
        </svg>
        <div class="ring-label">${Math.round(done/schedule.length*100)}%</div>
      </div>
    </div>

    <!-- 교육별 카드 -->
    <div class="edu-list">
      ${schedule.map(s => _renderEduCard(s)).join('')}
    </div>

    <!-- 법적 의무 안내 -->
    <div class="legal-notice">
      <div class="ln-title">📋 법적 의무 안내</div>
      <div class="ln-body">미이수 시 과태료가 부과될 수 있습니다. 교육 일정을 확인하고 기한 내 이수를 완료하세요.</div>
    </div>

  </div>
</div>
${_styles()}`;

  _bindEvents(root);
}

function _renderEduCard(s) {
  const type   = LEGAL_EDU_MAP[s.id];
  const status = EDU_STATUS[s.status] || EDU_STATUS.scheduled;
  const dday   = s.status !== 'completed' ? _dDay(s.scheduledDate) : null;

  return `
<div class="edu-card" data-id="${s.id}">
  <div class="ec-left">
    <span class="ec-icon" style="background:${type.color}20;color:${type.color}">${type.icon}</span>
  </div>
  <div class="ec-body">
    <div class="ec-row1">
      <span class="ec-label">${type.label}</span>
      <span class="ec-badge" style="color:${status.color};background:${status.bg}">
        ${status.icon} ${status.label}
      </span>
    </div>
    <div class="ec-basis">${type.legalBasis}</div>
    <div class="ec-detail">
      ${s.status === 'completed'
        ? `이수일 ${s.completedDate} · ${s.completedHours}시간 · ${s.provider || ''}`
        : `예정일 ${s.scheduledDate} <strong style="color:${dday?.startsWith('D-') ? '#EF4444' : '#6366F1'}">${dday}</strong>`
      }
    </div>
    ${s.status !== 'completed' ? `<button class="btn-complete-edu" data-id="${s.id}">이수 완료 처리</button>` : ''}
  </div>
</div>`;
}

function _bindEvents(root) {
  root.querySelector('.back-btn').addEventListener('click', () => window.navBack());

  root.addEventListener('click', e => {
    const btn = e.target.closest('.btn-complete-edu');
    if (!btn) return;
    const id       = btn.dataset.id;
    const schedule = _getSchedule();
    const idx      = schedule.findIndex(s => s.id === id);
    if (idx < 0) return;
    const today = new Date().toISOString().slice(0, 10);
    schedule[idx] = {
      ...schedule[idx],
      status:         'completed',
      completedDate:  today,
      completedHours: LEGAL_EDU_MAP[id]?.minHours || 1,
      provider:       '자체 이수',
    };
    localStorage.setItem(LS_SCHEDULE, JSON.stringify(schedule));
    showToast('교육 이수가 완료 처리되었습니다. ✅', 'success')
    addNotification({ type: 'success', title: '법정 교육', body: '교육 이수가 완료 처리되었습니다. ✅' });
    render(root);
  });
}

function _styles() {
  return `<style>
#legal-edu-page .top-bar { display:flex; align-items:center; padding:12px 16px; gap:10px; background:var(--bg); border-bottom:1px solid var(--border); flex-shrink:0; }
#legal-edu-page .page-title { flex:1; font-size:18px; font-weight:700; margin:0; }

.edu-summary-card { display:flex; align-items:center; justify-content:space-between; background:var(--card-bg); border-radius:16px; margin:16px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,.07); }
.esc-year  { font-size:13px; color:var(--text-secondary); margin-bottom:4px; }
.esc-count { font-size:22px; font-weight:800; margin-bottom:12px; }
.esc-bar-wrap { width:140px; height:8px; background:var(--border); border-radius:4px; overflow:hidden; }
.esc-bar   { height:100%; background:#10B981; border-radius:4px; transition:width .5s; }
.esc-ring  { position:relative; width:64px; height:64px; flex-shrink:0; }
.ring-svg  { width:64px; height:64px; transform:rotate(0deg); }
.ring-label { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:800; color:#10B981; }

.edu-list { padding:0 16px; display:flex; flex-direction:column; gap:10px; margin-bottom:16px; }
.edu-card { display:flex; gap:12px; background:var(--card-bg); border-radius:12px; padding:14px; border:1px solid var(--border); }
.ec-left  { flex-shrink:0; }
.ec-icon  { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:20px; }
.ec-body  { flex:1; min-width:0; }
.ec-row1  { display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; }
.ec-label { font-size:14px; font-weight:700; }
.ec-badge { font-size:11px; padding:3px 8px; border-radius:20px; font-weight:600; white-space:nowrap; }
.ec-basis { font-size:11px; color:var(--text-secondary); margin-bottom:4px; }
.ec-detail { font-size:12px; color:var(--text-secondary); }
.btn-complete-edu { margin-top:8px; background:#EEF2FF; color:#4338CA; border:none; border-radius:8px; padding:5px 12px; font-size:12px; font-weight:600; cursor:pointer; }

.legal-notice { margin:0 16px 100px; background:#FEF3C7; border-radius:12px; padding:14px 16px; border:1px solid #FDE68A; }
.ln-title { font-size:13px; font-weight:700; color:#92400E; margin-bottom:6px; }
.ln-body  { font-size:12px; color:#78350F; line-height:1.6; }
</style>`;
}

export function unmount() {}
