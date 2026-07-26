/**
 * applicant_dashboard.js – Applicant Home Dashboard
 * HR Competency OS — Phase 3
 */

import { getUser }            from '../../auth.js';
import { showToast }          from '../../components/toast.js';
import { DEMO_JOB_POSTINGS }  from '../../data/demo_jobs.js';

// ── Module state ────────────────────────────────────────────────
let _root = null;

// ── Constants ───────────────────────────────────────────────────
const LS_APPLICANT = 'hr_applicant_data';
const LS_USER      = 'hr_user';

const DEFAULT_APPLICANT = {
  processStep:   'PRE_INTERVIEW',
  jobPostingId:  'JOB_001',
  jobTitle:      'HR Business Partner',
  applyDate:     '2026-05-15',
  selectedSlot:  null,
  offerStatus:   null,
};

const PROCESS_STEPS = [
  { id: 'DOCUMENT',           icon: '📋', label: '서류 접수' },
  { id: 'PRE_INTERVIEW',      icon: '🎤', label: '사전 진단' },
  { id: 'INTERVIEW_SCHEDULE', icon: '📅', label: '면접 조율' },
  { id: 'INTERVIEW',          icon: '🤝', label: '면접 진행' },
  { id: 'OFFER',              icon: '📜', label: '오퍼 레터' },
  { id: 'ACCEPTED',           icon: '✅', label: '입사 완료' },
];

const CTA_MAP = {
  DOCUMENT:           { label: '지원서 작성/확인',  route: '#/applicant/apply' },
  PRE_INTERVIEW:      { label: '사전 진단 시작',    route: '#/diagnostic' },
  INTERVIEW_SCHEDULE: { label: '면접 일정 선택',    route: '#/applicant/apply' },
  INTERVIEW:          { label: '면접 현황 확인',    route: '#/applicant/apply' },
  OFFER:              { label: '오퍼 레터 확인',    route: '#/applicant/apply' },
  ACCEPTED:           { label: '마이 페이지',       route: '#/applicant/profile' },
};

// ── Interview slot helpers ───────────────────────────────────────
function generateInterviewSlots() {
  const slots = [];
  const TIMES = ['10:00', '14:00', '16:00'];
  let day = new Date();
  day.setDate(day.getDate() + 2);
  let weekdays = 0;
  while (weekdays < 4) {
    const dow = day.getDay();
    if (dow !== 0 && dow !== 6) {
      const dateStr = day.toISOString().slice(0, 10);
      const label   = day.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
      TIMES.forEach(time => {
        slots.push({ id: `slot_${dateStr}_${time.replace(':', '')}`, dateStr, label, time });
      });
      weekdays++;
    }
    day.setDate(day.getDate() + 1);
  }
  return slots;
}

function saveApplicantSlot(slot) {
  try {
    const raw  = localStorage.getItem(LS_APPLICANT);
    const data = raw ? JSON.parse(raw) : { ...DEFAULT_APPLICANT };
    data.selectedSlot = slot;
    localStorage.setItem(LS_APPLICANT, JSON.stringify(data));
  } catch {}
}

// ── Helpers ─────────────────────────────────────────────────────
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getApplicantData() {
  try {
    const raw = localStorage.getItem(LS_APPLICANT);
    return raw ? { ...DEFAULT_APPLICANT, ...JSON.parse(raw) } : { ...DEFAULT_APPLICANT };
  } catch {
    return { ...DEFAULT_APPLICANT };
  }
}

function getUserName() {
  try {
    const u = JSON.parse(localStorage.getItem(LS_USER) || '{}');
    return u.name_ko || u.name || u.email?.split('@')[0] || '지원자';
  } catch {
    return getUser()?.name_ko || getUser()?.email?.split('@')[0] || '지원자';
  }
}

function getCurrentStepIndex(stepId) {
  return PROCESS_STEPS.findIndex(s => s.id === stepId);
}

// Demo scores matching DEMO_RESULTS in growth.js
const DEMO_COMP_SCORES = {
  'COMP_CORE_AI':   3.8,
  'COMP_CORE_DATA': 4.1,
  'COMP_CORE_COMM': 3.5,
  'COMP_CORE_LEAD': 3.3,
  'COMP_CORE_PROB': 4.0,
};

function calcFitScore(jobId) {
  const job = DEMO_JOB_POSTINGS.find(j => j.id === jobId);
  if (!job || !job.required_competencies?.length) return null;

  // Try to get real scores from localStorage assessment results
  let userScores = { ...DEMO_COMP_SCORES };
  try {
    const raw = localStorage.getItem('hr_diag_results');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.scores)) {
        parsed.scores.forEach(s => { if (s.competency_id) userScores[s.competency_id] = Number(s.as_is_score); });
      }
    }
  } catch {}

  const required = job.required_competencies;
  const known    = required.filter(id => userScores[id] !== undefined);
  if (!known.length) return { pct: 72, jobTitle: job.title, note: '진단 데이터 기반 추정' };

  const matched = known.filter(id => userScores[id] >= 3.5).length;
  return {
    pct:      Math.round((matched / required.length) * 100),
    jobTitle: job.title,
    note:     `${matched}/${required.length} 핵심 역량 충족`,
  };
}

// ── Render ──────────────────────────────────────────────────────
function render(container, data) {
  const name        = getUserName();
  const currentIdx  = getCurrentStepIndex(data.processStep);
  const currentStep = PROCESS_STEPS[currentIdx] || PROCESS_STEPS[0];
  const cta         = CTA_MAP[data.processStep] || CTA_MAP['PRE_INTERVIEW'];

  const stepsHtml = PROCESS_STEPS.map((step, idx) => {
    let bgColor = '#E2E8F0';
    let textColor = '#64748B';
    let borderColor = '#E2E8F0';
    let iconHtml = `<span style="font-size:16px;">${step.icon}</span>`;

    if (idx < currentIdx) {
      // Completed
      bgColor = '#D1FAE5';
      textColor = '#059669';
      borderColor = '#6EE7B7';
      iconHtml = `<span style="font-size:16px;">✅</span>`;
    } else if (idx === currentIdx) {
      // Current
      bgColor = '#4F46E5';
      textColor = '#fff';
      borderColor = '#4F46E5';
    }

    return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:0;">
        <div style="width:40px;height:40px;border-radius:50%;background:${bgColor};border:2px solid ${borderColor};
                    display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          ${iconHtml}
        </div>
        <span style="font-size:10px;color:${textColor};text-align:center;font-weight:${idx === currentIdx ? '700' : '400'};
                     line-height:1.2;word-break:keep-all;">${esc(step.label)}</span>
      </div>
      ${idx < PROCESS_STEPS.length - 1 ? `<div style="flex:0 0 8px;height:2px;background:${idx < currentIdx ? '#6EE7B7' : '#E2E8F0'};margin-top:-18px;"></div>` : ''}
    `;
  }).join('');

  container.innerHTML = `
    <div id="applicant-dashboard" style="min-height:100vh;background:var(--bg,#F8FAFC);padding:0 0 80px;">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:48px 20px 28px;color:#fff;">
        <p style="margin:0 0 4px;font-size:14px;opacity:0.85;">안녕하세요</p>
        <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;">${esc(name)}님 👋</h1>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.18);
                      padding:6px 12px;border-radius:20px;font-size:13px;">
            <span>📌</span>
            <span>지원 직무: ${esc(data.jobTitle)}</span>
          </div>
          <div style="display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,0.12);
                      padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;">
            <span>🔄</span><span>지원 중</span>
          </div>
        </div>
      </div>

      <div style="padding:20px 16px;display:flex;flex-direction:column;gap:16px;">

        <!-- Process Steps Card -->
        <div style="background:#fff;border-radius:var(--radius-md,10px);padding:20px 16px;
                    box-shadow:0 1px 4px rgba(0,0,0,0.08);border:1px solid var(--border,#E2E8F0);">
          <h2 style="margin:0 0 16px;font-size:14px;font-weight:600;color:var(--text,#1E293B);">
            채용 프로세스
          </h2>
          <div style="display:flex;align-items:flex-start;gap:0;">
            ${stepsHtml}
          </div>
          <div style="margin-top:16px;padding:10px 14px;background:#EEF2FF;border-radius:8px;
                      display:flex;align-items:center;gap:8px;">
            <span style="font-size:18px;">${currentStep.icon}</span>
            <div>
              <p style="margin:0;font-size:12px;color:#6366F1;font-weight:500;">현재 단계</p>
              <p style="margin:0;font-size:14px;font-weight:700;color:#4F46E5;">${esc(currentStep.label)}</p>
            </div>
          </div>
        </div>

        <!-- CTA / Interview Scheduling -->
        ${data.processStep === 'INTERVIEW_SCHEDULE' ? renderInterviewScheduler(data) : `
        <button id="cta-btn" style="width:100%;padding:15px;background:#4F46E5;color:#fff;border:none;
                border-radius:var(--radius-md,10px);font-size:15px;font-weight:600;cursor:pointer;
                box-shadow:0 2px 8px rgba(79,70,229,0.3);transition:opacity 0.15s;">
          ${esc(cta.label)} →
        </button>`}

        <!-- Quick Info Cards -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div style="background:#fff;border-radius:var(--radius-sm,8px);padding:14px;
                      border:1px solid var(--border,#E2E8F0);box-shadow:0 1px 3px rgba(0,0,0,0.06);">
            <p style="margin:0 0 4px;font-size:11px;color:var(--text-muted,#64748B);font-weight:500;">지원일</p>
            <p style="margin:0;font-size:13px;font-weight:600;color:var(--text,#1E293B);">${esc(data.applyDate)}</p>
          </div>
          <div style="background:#fff;border-radius:var(--radius-sm,8px);padding:14px;
                      border:1px solid var(--border,#E2E8F0);box-shadow:0 1px 3px rgba(0,0,0,0.06);">
            <p style="margin:0 0 4px;font-size:11px;color:var(--text-muted,#64748B);font-weight:500;">현재 단계</p>
            <p style="margin:0;font-size:13px;font-weight:600;color:#4F46E5;">${esc(currentStep.label)}</p>
          </div>
        </div>

        <!-- Competency Fit Score (입사 완료 이후에만 표시) -->
        ${(() => {
          if (data.processStep !== 'ACCEPTED') return '';
          const fit = calcFitScore(data.jobPostingId);
          if (!fit) return '';
          const pct    = fit.pct;
          const color  = pct >= 80 ? '#059669' : pct >= 60 ? '#4F46E5' : '#D97706';
          const label  = pct >= 80 ? '높은 적합도' : pct >= 60 ? '보통 적합도' : '역량 개발 필요';
          return `
          <div style="background:#fff;border-radius:var(--radius-sm,8px);padding:16px;
                      border:1px solid var(--border,#E2E8F0);box-shadow:0 1px 3px rgba(0,0,0,0.06);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
              <p style="margin:0;font-size:12px;font-weight:600;color:var(--text,#1E293B);">📊 직무 역량 적합도</p>
              <span style="font-size:11px;padding:2px 8px;border-radius:20px;
                           background:${color}18;color:${color};font-weight:600;">${label}</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="flex:1;height:8px;background:#E2E8F0;border-radius:4px;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width 0.6s ease;"></div>
              </div>
              <span style="font-size:16px;font-weight:800;color:${color};min-width:36px;">${pct}%</span>
            </div>
            <p style="margin:6px 0 0;font-size:11px;color:var(--text-muted,#64748B);">${esc(fit.note)}</p>
          </div>`;
        })()}

        <!-- Profile Link -->
        <div style="background:#fff;border-radius:var(--radius-sm,8px);padding:14px 16px;
                    border:1px solid var(--border,#E2E8F0);display:flex;align-items:center;
                    justify-content:space-between;cursor:pointer;" id="profile-link">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:20px;">👤</span>
            <div>
              <p style="margin:0;font-size:13px;font-weight:600;color:var(--text,#1E293B);">프로필 설정</p>
              <p style="margin:0;font-size:11px;color:var(--text-muted,#64748B);">공개 범위 및 받은 오퍼 관리</p>
            </div>
          </div>
          <span style="color:#94A3B8;font-size:16px;">›</span>
        </div>

      </div>
    </div>
  `;

  // Bind events
  const ctaBtn = container.querySelector('#cta-btn');
  if (ctaBtn) {
    ctaBtn.addEventListener('click', () => { window.location.hash = cta.route; });
    ctaBtn.addEventListener('mouseenter', () => { ctaBtn.style.opacity = '0.88'; });
    ctaBtn.addEventListener('mouseleave', () => { ctaBtn.style.opacity = '1'; });
  }

  // Interview slot selection
  container.querySelectorAll('.slot-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.background  = '#EEF2FF';
      btn.style.borderColor = '#4F46E5';
      btn.style.color       = '#4F46E5';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background  = '#F8FAFC';
      btn.style.borderColor = '#E2E8F0';
      btn.style.color       = '#1E293B';
    });
    btn.addEventListener('click', () => {
      try {
        const slot = JSON.parse(btn.dataset.slot);
        saveApplicantSlot(slot);
        showToast(`면접 일정 예약 완료! ${slot.label} ${slot.time} ✅`, 'success');
        const freshData = getApplicantData();
        render(container, freshData);
      } catch {}
    });
  });

  // Cancel slot
  container.querySelector('#slot-cancel-btn')?.addEventListener('click', () => {
    saveApplicantSlot(null);
    showToast('일정을 초기화했습니다.', 'info');
    const freshData = getApplicantData();
    render(container, freshData);
  });

  const profileLink = container.querySelector('#profile-link');
  if (profileLink) {
    profileLink.addEventListener('click', () => { window.location.hash = '#/applicant/profile'; });
  }
}

// ── Interview scheduler ──────────────────────────────────────────
function renderInterviewScheduler(data) {
  if (data.selectedSlot) {
    const slot = data.selectedSlot;
    return `
      <div style="background:#F0FDF4;border:1.5px solid #6EE7B7;border-radius:var(--radius-md,10px);padding:20px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <span style="font-size:28px">✅</span>
          <div>
            <p style="margin:0;font-size:13px;font-weight:700;color:#059669;">면접 일정 확정!</p>
            <p style="margin:0;font-size:12px;color:#064E3B;margin-top:2px">담당자가 확인 후 연락드립니다.</p>
          </div>
        </div>
        <div style="background:#fff;border-radius:8px;padding:12px 16px;border:1px solid #A7F3D0">
          <p style="margin:0 0 4px;font-size:11px;color:#64748B;font-weight:500;">선택한 면접 일정</p>
          <p style="margin:0;font-size:15px;font-weight:700;color:#1E293B">📅 ${esc(slot.label)} ${esc(slot.time)}</p>
        </div>
        <button id="slot-cancel-btn" style="margin-top:12px;width:100%;padding:10px;
                background:transparent;color:#64748B;border:1.5px solid #E2E8F0;
                border-radius:8px;font-size:13px;cursor:pointer;">
          일정 다시 선택
        </button>
      </div>`;
  }

  const slots = generateInterviewSlots();
  // Group by date
  const byDate = {};
  slots.forEach(s => {
    if (!byDate[s.dateStr]) byDate[s.dateStr] = { label: s.label, times: [] };
    byDate[s.dateStr].times.push(s);
  });

  return `
    <div style="background:#fff;border:1.5px solid #4F46E5;border-radius:var(--radius-md,10px);padding:20px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
        <span style="font-size:20px">📅</span>
        <div>
          <p style="margin:0;font-size:14px;font-weight:700;color:#1E293B;">면접 일정을 선택해 주세요</p>
          <p style="margin:0;font-size:11px;color:#64748B;margin-top:2px;">가능한 시간대를 클릭하면 바로 예약됩니다</p>
        </div>
      </div>
      ${Object.values(byDate).map(d => `
        <div style="margin-bottom:14px">
          <p style="margin:0 0 8px;font-size:11px;font-weight:600;color:#64748B;">${esc(d.label)}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${d.times.map(s => `
              <button class="slot-btn" data-slot='${JSON.stringify(s)}'
                style="padding:8px 16px;border:1.5px solid #E2E8F0;border-radius:8px;
                       background:#F8FAFC;color:#1E293B;font-size:13px;font-weight:600;
                       cursor:pointer;transition:all 0.15s;min-height:auto">
                ${esc(s.time)}
              </button>`).join('')}
          </div>
        </div>`).join('')}
    </div>`;
}

// ── Empty state ──────────────────────────────────────────────────
function renderEmpty(container) {
  container.innerHTML = `
    <div id="applicant-dashboard" style="min-height:100vh;background:var(--bg,#F8FAFC);padding:0 0 80px;">
      <div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:48px 20px 28px;color:#fff;">
        <p style="margin:0 0 4px;font-size:14px;opacity:0.85;">안녕하세요</p>
        <h1 style="margin:0;font-size:22px;font-weight:700;">채용 현황</h1>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  padding:60px 24px;text-align:center;gap:16px;">
        <div style="font-size:56px;line-height:1;">📋</div>
        <h2 style="margin:0;font-size:18px;font-weight:700;color:var(--text,#1E293B);">
          아직 지원한 공고가 없습니다
        </h2>
        <p style="margin:0;font-size:14px;color:var(--text-muted,#64748B);line-height:1.6;">
          채용 공고를 확인하고 첫 지원을 시작해보세요.<br>
          지원 후 여기서 전형 단계를 확인할 수 있습니다.
        </p>
        <button id="goto-jobs" style="margin-top:8px;padding:14px 28px;background:#4F46E5;color:#fff;
                border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;
                box-shadow:0 2px 8px rgba(79,70,229,0.3);">
          채용공고 보기 →
        </button>
        <div style="margin-top:24px;padding:16px;background:#fff;border-radius:10px;
                    border:1px solid var(--border,#E2E8F0);width:100%;max-width:320px;text-align:left;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:var(--text,#1E293B);">
            💼 커리어 프로필도 관리해보세요
          </p>
          <p style="margin:0 0 10px;font-size:12px;color:var(--text-muted,#64748B);line-height:1.5;">
            역량 진단·진단 Kit 결과를 공개하면 HR 담당자가 먼저 오퍼를 보낼 수 있습니다.
          </p>
          <button id="goto-career" style="padding:9px 16px;background:#EEF2FF;color:#4F46E5;
                  border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
            커리어 프로필 관리 →
          </button>
        </div>
      </div>
    </div>`;
  container.querySelector('#goto-jobs')?.addEventListener('click', () => {
    window.location.hash = '#/jobs';
  });
  container.querySelector('#goto-career')?.addEventListener('click', () => {
    window.location.hash = '#/applicant/career';
  });
}

// ── Public API ──────────────────────────────────────────────────
export async function mount(container) {
  _root = container;
  const raw = localStorage.getItem(LS_APPLICANT);
  if (!raw) {
    renderEmpty(container);
    return;
  }
  const data = getApplicantData();
  render(container, data);
}

export function unmount() {
  _root = null;
}
