/**
 * my_application.js – Application detail page
 * Sections: Resume/Form, Interview Schedule, Offer Letter
 * HR Competency OS — Phase 3
 */

import { api }       from '../../api.js';
import { showToast } from '../../components/toast.js';
import { getUser }   from '../../auth.js';

// ── Module state ────────────────────────────────────────────────
let _root = null;

// ── Constants ───────────────────────────────────────────────────
const LS_APPLICANT = 'hr_applicant_data';
const LS_FORM      = 'hr_applicant_form';
const LS_RESUME    = 'hr_applicant_resume';
const LS_SALARY    = 'hr_salary_info';

const DEFAULT_APPLICANT = {
  processStep:  'PRE_INTERVIEW',
  jobPostingId: 'JOB_001',
  jobTitle:     'HR Business Partner',
  applyDate:    '2026-05-15',
  selectedSlot: null,
  offerStatus:  null,
};

const INTERVIEW_SLOTS = [
  { id: 'SLOT_1', label: '5/28(화) 14:00', duration: '60분', location: '화상 면접' },
  { id: 'SLOT_2', label: '5/29(수) 10:00', duration: '60분', location: '화상 면접' },
  { id: 'SLOT_3', label: '5/30(목) 15:00', duration: '60분', location: '화상 면접' },
];

const OFFER_DEMO = {
  position: 'HR Business Partner',
  salary:   5200,
  benefits: '점심 지원(15만원/월) · 교통비 실비 · 스톡옵션 검토',
  company:  '테크스타트업',
};

const STEP_ORDER = ['DOCUMENT','PRE_INTERVIEW','INTERVIEW_SCHEDULE','INTERVIEW','OFFER','ACCEPTED'];

// ── Helpers ─────────────────────────────────────────────────────
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getLS(key, fallback = null) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
  catch { return fallback; }
}

function setLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
}

function stepGte(current, target) {
  return STEP_ORDER.indexOf(current) >= STEP_ORDER.indexOf(target);
}

function sectionCard(id, title, content) {
  return `
    <div id="section-${id}" style="background:#fff;border-radius:var(--radius-md,10px);
         border:1px solid var(--border,#E2E8F0);box-shadow:0 1px 4px rgba(0,0,0,.06);overflow:hidden;">
      <div style="padding:16px 16px 0;">
        <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;color:var(--text,#1E293B);">${title}</h2>
      </div>
      <div style="padding:0 16px 20px;">${content}</div>
    </div>
  `;
}

// ── Section 1: Resume / Form ─────────────────────────────────────
function renderFormSection(form, resume) {
  const hasResume = resume && resume.fileName;
  const previewHtml = hasResume
    ? (resume.base64?.startsWith('data:image')
        ? `<img src="${esc(resume.base64)}" alt="이력서 미리보기" style="max-width:100%;max-height:160px;border-radius:6px;object-fit:contain;">`
        : `<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:24px;">📄</span><span style="font-size:13px;color:var(--text,#1E293B);">${esc(resume.fileName)}</span></div>`)
    : `<div style="text-align:center;color:var(--text-muted,#64748B);">
         <div style="font-size:32px;margin-bottom:6px;">📤</div>
         <p style="margin:0;font-size:13px;">PDF 또는 이미지 파일을 업로드하세요</p>
         <p style="margin:4px 0 0;font-size:11px;opacity:.7;">클릭하거나 파일을 드래그하세요</p>
       </div>`;

  const f = form || {};
  const showExit = !!(f.experience && f.experience.trim());

  return `
    <!-- File Upload -->
    <div id="upload-zone" style="border:2px dashed var(--border,#E2E8F0);border-radius:var(--radius-sm,8px);
         padding:24px 16px;text-align:center;cursor:pointer;margin-bottom:16px;
         background:#FAFAFA;transition:border-color .15s;" role="button" tabindex="0" aria-label="파일 업로드">
      <div id="upload-preview">${previewHtml}</div>
      <input type="file" id="resume-file-input" accept=".pdf,image/*" style="display:none;" aria-label="이력서 파일 선택">
    </div>

    <!-- Standard Form -->
    <form id="applicant-form" style="display:flex;flex-direction:column;gap:12px;">
      <div>
        <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted,#64748B);margin-bottom:4px;">이름</label>
        <input id="f-name" type="text" value="${esc(f.name)}" placeholder="홍길동"
          style="width:100%;padding:10px 12px;border:1.5px solid var(--border,#E2E8F0);border-radius:var(--radius-sm,8px);
                 font-size:14px;color:var(--text,#1E293B);box-sizing:border-box;outline:none;">
      </div>
      <div>
        <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted,#64748B);margin-bottom:4px;">연락처</label>
        <input id="f-phone" type="tel" value="${esc(f.phone)}" placeholder="010-0000-0000"
          style="width:100%;padding:10px 12px;border:1.5px solid var(--border,#E2E8F0);border-radius:var(--radius-sm,8px);
                 font-size:14px;color:var(--text,#1E293B);box-sizing:border-box;outline:none;">
      </div>
      <div>
        <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted,#64748B);margin-bottom:4px;">최종학력</label>
        <input id="f-education" type="text" value="${esc(f.education)}" placeholder="○○대학교 경영학과 졸업"
          style="width:100%;padding:10px 12px;border:1.5px solid var(--border,#E2E8F0);border-radius:var(--radius-sm,8px);
                 font-size:14px;color:var(--text,#1E293B);box-sizing:border-box;outline:none;">
      </div>
      <div>
        <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted,#64748B);margin-bottom:4px;">경력사항</label>
        <textarea id="f-experience" placeholder="주요 경력을 입력해주세요" rows="3"
          style="width:100%;padding:10px 12px;border:1.5px solid var(--border,#E2E8F0);border-radius:var(--radius-sm,8px);
                 font-size:14px;color:var(--text,#1E293B);box-sizing:border-box;resize:vertical;outline:none;">${esc(f.experience)}</textarea>
      </div>
      <div id="exit-reason-wrap" style="display:${showExit ? 'block' : 'none'};">
        <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted,#64748B);margin-bottom:4px;">이직 상세 사유</label>
        <textarea id="f-exit-reason" placeholder="이전 직장 퇴직 사유를 간략히 설명해주세요" rows="2"
          style="width:100%;padding:10px 12px;border:1.5px solid var(--border,#E2E8F0);border-radius:var(--radius-sm,8px);
                 font-size:14px;color:var(--text,#1E293B);box-sizing:border-box;resize:vertical;outline:none;">${esc(f.exitReason)}</textarea>
      </div>
      <div>
        <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted,#64748B);margin-bottom:4px;">자기소개</label>
        <textarea id="f-self-intro" placeholder="간단한 자기소개를 작성해주세요" rows="4"
          style="width:100%;padding:10px 12px;border:1.5px solid var(--border,#E2E8F0);border-radius:var(--radius-sm,8px);
                 font-size:14px;color:var(--text,#1E293B);box-sizing:border-box;resize:vertical;outline:none;">${esc(f.selfIntro)}</textarea>
      </div>
      <div>
        <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted,#64748B);margin-bottom:4px;">기대연봉 (만원)</label>
        <input id="f-salary" type="number" value="${esc(f.expectedSalary)}" placeholder="4500"
          style="width:100%;padding:10px 12px;border:1.5px solid var(--border,#E2E8F0);border-radius:var(--radius-sm,8px);
                 font-size:14px;color:var(--text,#1E293B);box-sizing:border-box;outline:none;">
      </div>
      <div>
        <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted,#64748B);margin-bottom:4px;">희망 복리후생</label>
        <input id="f-benefits" type="text" value="${esc(f.expectedBenefits)}" placeholder="유연근무, 재택근무, 점심지원 등"
          style="width:100%;padding:10px 12px;border:1.5px solid var(--border,#E2E8F0);border-radius:var(--radius-sm,8px);
                 font-size:14px;color:var(--text,#1E293B);box-sizing:border-box;outline:none;">
      </div>
      <button type="button" id="form-save-btn"
        style="width:100%;padding:13px;background:var(--primary,#4F46E5);color:#fff;border:none;
               border-radius:var(--radius-sm,8px);font-size:15px;font-weight:600;cursor:pointer;margin-top:4px;">
        저장하기
      </button>
    </form>
  `;
}

// ── Section 2: Interview Schedule ───────────────────────────────
function renderScheduleSection(selectedSlot) {
  const slotsHtml = INTERVIEW_SLOTS.map(slot => {
    const isSelected = selectedSlot === slot.id;
    return `
      <div class="slot-card" data-slot="${esc(slot.id)}"
        style="border:2px solid ${isSelected ? 'var(--primary,#4F46E5)' : 'var(--border,#E2E8F0)'};
               border-radius:var(--radius-sm,8px);padding:14px 16px;cursor:pointer;
               background:${isSelected ? '#EEF2FF' : '#fff'};transition:all .15s;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:18px;height:18px;border-radius:50%;border:2px solid ${isSelected ? 'var(--primary,#4F46E5)' : '#CBD5E1'};
                      background:${isSelected ? 'var(--primary,#4F46E5)' : '#fff'};flex-shrink:0;display:flex;align-items:center;justify-content:center;">
            ${isSelected ? '<span style="width:6px;height:6px;border-radius:50%;background:#fff;display:block;"></span>' : ''}
          </div>
          <div style="flex:1;">
            <p style="margin:0;font-size:15px;font-weight:600;color:${isSelected ? 'var(--primary,#4F46E5)' : 'var(--text,#1E293B)'};">${esc(slot.label)}</p>
            <p style="margin:2px 0 0;font-size:12px;color:var(--text-muted,#64748B);">${esc(slot.duration)} · ${esc(slot.location)}</p>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    ${slotsHtml}
    <button id="confirm-slot-btn"
      style="width:100%;padding:13px;background:var(--primary,#4F46E5);color:#fff;border:none;
             border-radius:var(--radius-sm,8px);font-size:15px;font-weight:600;cursor:pointer;margin-top:4px;">
      면접 일정 확정
    </button>
  `;
}

// ── Section 3: Offer Letter ──────────────────────────────────────
function renderOfferSection(processStep) {
  const isAccepted = processStep === 'ACCEPTED';

  if (isAccepted) {
    return `
      <div style="text-align:center;padding:24px 0;">
        <div style="font-size:56px;margin-bottom:12px;">🎉</div>
        <h3 style="margin:0 0 8px;font-size:20px;font-weight:700;color:var(--text,#1E293B);">입사를 축하합니다!</h3>
        <p style="margin:0;font-size:14px;color:var(--text-muted,#64748B);">
          ${esc(OFFER_DEMO.company)} ${esc(OFFER_DEMO.position)}으로<br>새로운 여정을 시작하게 되었습니다.
        </p>
      </div>
    `;
  }

  return `
    <!-- Offer Card -->
    <div style="background:linear-gradient(135deg,#EEF2FF 0%,#F5F3FF 100%);border-radius:var(--radius-sm,8px);
         padding:20px;margin-bottom:16px;border:1px solid #C7D2FE;">
      <p style="margin:0 0 4px;font-size:12px;color:#6366F1;font-weight:600;">오퍼 레터</p>
      <p style="margin:0 0 2px;font-size:18px;font-weight:700;color:var(--text,#1E293B);">${esc(OFFER_DEMO.company)}</p>
      <p style="margin:0 0 12px;font-size:14px;color:var(--text-muted,#64748B);">${esc(OFFER_DEMO.position)}</p>
      <div style="display:flex;align-items:baseline;gap:4px;margin-bottom:10px;">
        <span style="font-size:24px;font-weight:700;color:var(--primary,#4F46E5);">연봉 ${Number(OFFER_DEMO.salary).toLocaleString()}만원</span>
      </div>
      <p style="margin:0;font-size:13px;color:var(--text-muted,#64748B);">${esc(OFFER_DEMO.benefits)}</p>
    </div>

    <!-- Action Buttons -->
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <button id="offer-accept-btn"
        style="flex:1;padding:12px 8px;background:#10B981;color:#fff;border:none;border-radius:var(--radius-sm,8px);
               font-size:14px;font-weight:600;cursor:pointer;">
        ✅ 수락
      </button>
      <button id="offer-negotiate-btn"
        style="flex:1;padding:12px 8px;background:#fff;color:var(--text,#1E293B);
               border:1.5px solid var(--border,#E2E8F0);border-radius:var(--radius-sm,8px);
               font-size:14px;font-weight:600;cursor:pointer;">
        💬 재협의 요청
      </button>
      <button id="offer-decline-btn"
        style="flex:1;padding:12px 8px;background:#fff;color:#EF4444;
               border:1.5px solid #FCA5A5;border-radius:var(--radius-sm,8px);
               font-size:14px;font-weight:600;cursor:pointer;">
        ❌ 거절
      </button>
    </div>

    <!-- Negotiate Panel (hidden) -->
    <div id="negotiate-panel" style="display:none;margin-bottom:12px;">
      <textarea id="negotiate-msg" placeholder="요청사항을 입력해주세요" rows="3"
        style="width:100%;padding:10px 12px;border:1.5px solid var(--border,#E2E8F0);border-radius:var(--radius-sm,8px);
               font-size:14px;box-sizing:border-box;resize:vertical;outline:none;margin-bottom:8px;"></textarea>
      <button id="negotiate-send-btn"
        style="width:100%;padding:11px;background:var(--primary,#4F46E5);color:#fff;border:none;
               border-radius:var(--radius-sm,8px);font-size:14px;font-weight:600;cursor:pointer;">
        전송
      </button>
    </div>

    <!-- Decline Panel (hidden) -->
    <div id="decline-panel" style="display:none;">
      <select id="decline-reason"
        style="width:100%;padding:10px 12px;border:1.5px solid var(--border,#E2E8F0);border-radius:var(--radius-sm,8px);
               font-size:14px;color:var(--text,#1E293B);box-sizing:border-box;margin-bottom:8px;background:#fff;outline:none;">
        <option value="">거절 사유 선택</option>
        <option value="처우 불일치">처우 불일치</option>
        <option value="타사이직">타사이직</option>
        <option value="개인사정">개인사정</option>
        <option value="기타">기타</option>
      </select>
      <textarea id="decline-msg" placeholder="추가 의견 (선택)" rows="2"
        style="width:100%;padding:10px 12px;border:1.5px solid var(--border,#E2E8F0);border-radius:var(--radius-sm,8px);
               font-size:14px;box-sizing:border-box;resize:vertical;outline:none;margin-bottom:8px;"></textarea>
      <button id="decline-submit-btn"
        style="width:100%;padding:11px;background:#EF4444;color:#fff;border:none;
               border-radius:var(--radius-sm,8px);font-size:14px;font-weight:600;cursor:pointer;">
        제출
      </button>
    </div>
  `;
}

// ── Full Render ──────────────────────────────────────────────────
function render(container) {
  const data     = getLS(LS_APPLICANT, DEFAULT_APPLICANT);
  const appData  = { ...DEFAULT_APPLICANT, ...data };
  const form     = getLS(LS_FORM, {});
  const resume   = getLS(LS_RESUME, null);
  const step     = appData.processStep;

  const showSchedule = stepGte(step, 'INTERVIEW_SCHEDULE');
  const showOffer    = stepGte(step, 'OFFER') || step === 'NEGOTIATING' || step === 'DECLINED';

  container.innerHTML = `
    <div id="my-application" style="min-height:100vh;background:var(--bg,#F8FAFC);padding:0 0 80px;">
      <!-- Page Header -->
      <div style="background:#fff;padding:48px 16px 16px;border-bottom:1px solid var(--border,#E2E8F0);">
        <div style="max-width:480px;margin:0 auto;">
          <button id="back-btn" style="background:none;border:none;cursor:pointer;font-size:20px;padding:0;margin-bottom:8px;">←</button>
          <h1 style="margin:0;font-size:20px;font-weight:700;color:var(--text,#1E293B);">내 지원서</h1>
          <p style="margin:4px 0 0;font-size:13px;color:var(--text-muted,#64748B);">${esc(appData.jobTitle)}</p>
        </div>
      </div>

      <div style="max-width:480px;margin:0 auto;padding:16px;display:flex;flex-direction:column;gap:16px;">

        <!-- Section 1: Resume & Form -->
        ${sectionCard('form', '📄 지원서', renderFormSection(form, resume))}

        <!-- Section 2: Interview Schedule -->
        ${showSchedule
          ? sectionCard('schedule', '📅 면접 일정', renderScheduleSection(appData.selectedSlot))
          : `<div style="background:#fff;border-radius:var(--radius-md,10px);border:1px solid var(--border,#E2E8F0);
               padding:20px;text-align:center;color:var(--text-muted,#64748B);font-size:13px;">
               📅 면접 일정 선택은 면접 조율 단계에서 활성화됩니다.
             </div>`
        }

        <!-- Section 3: Offer Letter -->
        ${showOffer
          ? sectionCard('offer', '📜 오퍼 레터', renderOfferSection(step))
          : `<div style="background:#fff;border-radius:var(--radius-md,10px);border:1px solid var(--border,#E2E8F0);
               padding:20px;text-align:center;color:var(--text-muted,#64748B);font-size:13px;">
               📜 오퍼 레터는 면접 완료 후 발송됩니다.
             </div>`
        }

      </div>
    </div>
  `;

  bindEvents(container, appData);
}

// ── Event Binding ────────────────────────────────────────────────
function bindEvents(container, appData) {
  // Back button
  container.querySelector('#back-btn')?.addEventListener('click', () => window.location.hash = '#/applicant');

  // ── File Upload ────────────────────────────────────────────────
  const uploadZone  = container.querySelector('#upload-zone');
  const fileInput   = container.querySelector('#resume-file-input');
  if (uploadZone && fileInput) {
    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
    uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.style.borderColor = 'var(--primary,#4F46E5)'; });
    uploadZone.addEventListener('dragleave', () => { uploadZone.style.borderColor = 'var(--border,#E2E8F0)'; });
    uploadZone.addEventListener('drop', e => {
      e.preventDefault();
      uploadZone.style.borderColor = 'var(--border,#E2E8F0)';
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFile(file, container);
    });
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) handleFile(file, container);
    });
  }

  // ── Experience → Exit Reason toggle ────────────────────────────
  const expArea  = container.querySelector('#f-experience');
  const exitWrap = container.querySelector('#exit-reason-wrap');
  if (expArea && exitWrap) {
    expArea.addEventListener('input', () => {
      exitWrap.style.display = expArea.value.trim() ? 'block' : 'none';
    });
  }

  // ── Save Form ──────────────────────────────────────────────────
  container.querySelector('#form-save-btn')?.addEventListener('click', () => {
    const formData = {
      name:             container.querySelector('#f-name')?.value || '',
      phone:            container.querySelector('#f-phone')?.value || '',
      education:        container.querySelector('#f-education')?.value || '',
      experience:       container.querySelector('#f-experience')?.value || '',
      selfIntro:        container.querySelector('#f-self-intro')?.value || '',
      expectedSalary:   container.querySelector('#f-salary')?.value || '',
      expectedBenefits: container.querySelector('#f-benefits')?.value || '',
      exitReason:       container.querySelector('#f-exit-reason')?.value || '',
    };
    setLS(LS_FORM, formData);
    api.applicant.saveProfile(formData).catch(() => {});
    showToast('지원서가 저장되었습니다.', 'success');
  });

  // ── Slot Selection ─────────────────────────────────────────────
  let selectedSlot = appData.selectedSlot || null;
  container.querySelectorAll('.slot-card').forEach(card => {
    card.addEventListener('click', () => {
      selectedSlot = card.dataset.slot;
      container.querySelectorAll('.slot-card').forEach(c => {
        const isNow = c.dataset.slot === selectedSlot;
        c.style.borderColor    = isNow ? 'var(--primary,#4F46E5)' : 'var(--border,#E2E8F0)';
        c.style.background     = isNow ? '#EEF2FF' : '#fff';
        const radio = c.querySelector('div > div');
        if (radio) {
          radio.style.borderColor  = isNow ? 'var(--primary,#4F46E5)' : '#CBD5E1';
          radio.style.background   = isNow ? 'var(--primary,#4F46E5)' : '#fff';
          radio.innerHTML = isNow ? '<span style="width:6px;height:6px;border-radius:50%;background:#fff;display:block;"></span>' : '';
        }
        const label = c.querySelector('p');
        if (label) label.style.color = isNow ? 'var(--primary,#4F46E5)' : 'var(--text,#1E293B)';
      });
    });
  });

  container.querySelector('#confirm-slot-btn')?.addEventListener('click', () => {
    if (!selectedSlot) { showToast('면접 일정을 선택해주세요.', 'warning'); return; }
    const updated = { ...appData, selectedSlot, processStep: 'INTERVIEW' };
    setLS(LS_APPLICANT, updated);
    api.applicant.updateProcessStep(null, 'INTERVIEW').catch(() => {});
    showToast('📅 구글 캘린더에 추가됨 (시뮬레이션)', 'success');
    render(container);
  });

  // ── Offer Actions ──────────────────────────────────────────────
  container.querySelector('#offer-accept-btn')?.addEventListener('click', () => {
    // 입사 예정일: 오퍼 수락 후 2주 뒤 기본값
    const hireDate = appData.hireDate
      || (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10); })();

    const updated = { ...appData, processStep: 'ACCEPTED', offerStatus: 'ACCEPTED', hireDate };
    setLS(LS_APPLICANT, updated);
    api.applicant.updateProcessStep(null, 'ACCEPTED').catch(() => {});

    // B-1: hr_user에 hireDate 및 user_status 업데이트
    try {
      const user = JSON.parse(localStorage.getItem('hr_user') || '{}');
      user.hireDate    = hireDate;
      user.user_status = 'MEMBER';
      user.name        = user.name || appData.applicantName;
      localStorage.setItem('hr_user', JSON.stringify(user));
      const session = JSON.parse(localStorage.getItem('hr_session') || '{}');
      session.hireDate = hireDate;
      localStorage.setItem('hr_session', JSON.stringify(session));
    } catch {}

    // B-2: hr_personnel_history에 입사 발령 자동 생성
    try {
      const form     = JSON.parse(localStorage.getItem('hr_applicant_form') || '{}');
      const user     = JSON.parse(localStorage.getItem('hr_user') || '{}');
      const empName  = form.name || appData.applicantName || user.name || '신규 입사자';
      const history  = JSON.parse(localStorage.getItem('hr_personnel_history') || '[]');
      history.push({
        id:            'PH_' + Date.now(),
        userId:        user.id || user.userId || 'NEW',
        name:          empName,
        dept:          appData.dept || '미배정',
        type:          'hire',
        prevValue:     '신규',
        newValue:      appData.jobTitle || '입사',
        effectiveDate: hireDate,
        memo:          '채용 시스템 자동 발령 (오퍼 수락)',
      });
      localStorage.setItem('hr_personnel_history', JSON.stringify(history));
    } catch {}

    // B-2: ATS hr_applicants stage도 offer → accepted 반영
    try {
      const list = JSON.parse(localStorage.getItem('hr_applicants') || '[]');
      const name = appData.applicantName;
      const idx  = list.findIndex(a => a.name === name);
      if (idx >= 0) { list[idx].stage = 'offer'; localStorage.setItem('hr_applicants', JSON.stringify(list)); }
    } catch {}

    // 관리자 알림 추가
    try {
      const notifs = JSON.parse(localStorage.getItem('hr_notifications') || '[]');
      notifs.unshift({
        id: `NOTIF_OFFER_${Date.now()}`,
        type: 'offer_accepted',
        title: `${appData.applicantName || '지원자'}님이 오퍼를 수락했습니다`,
        body: `입사 예정일: ${hireDate} · 온보딩을 준비하세요.`,
        route: '#/admin',
        read: false,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('hr_notifications', JSON.stringify(notifs));
    } catch {}
    showToast('🎉 오퍼를 수락하셨습니다! 입사를 축하합니다!', 'success', 5000);
    setTimeout(() => { window.location.hash = '#/applicant'; }, 1800);
  });

  container.querySelector('#offer-negotiate-btn')?.addEventListener('click', () => {
    const panel = container.querySelector('#negotiate-panel');
    const decPanel = container.querySelector('#decline-panel');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    if (decPanel) decPanel.style.display = 'none';
  });

  container.querySelector('#negotiate-send-btn')?.addEventListener('click', () => {
    const msg = container.querySelector('#negotiate-msg')?.value?.trim();
    if (!msg) { showToast('요청사항을 입력해주세요.', 'warning'); return; }
    const updated = { ...appData, offerStatus: 'NEGOTIATING' };
    setLS(LS_APPLICANT, updated);
    api.offers.respond(null, 'NEGOTIATING', msg).catch(() => {});
    showToast('💬 재협의 요청이 전송되었습니다.', 'success');
    const panel = container.querySelector('#negotiate-panel');
    if (panel) panel.style.display = 'none';
  });

  container.querySelector('#offer-decline-btn')?.addEventListener('click', () => {
    const panel = container.querySelector('#decline-panel');
    const negPanel = container.querySelector('#negotiate-panel');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    if (negPanel) negPanel.style.display = 'none';
  });

  container.querySelector('#decline-submit-btn')?.addEventListener('click', () => {
    const reason = container.querySelector('#decline-reason')?.value;
    const msg    = container.querySelector('#decline-msg')?.value?.trim();
    if (!reason) { showToast('거절 사유를 선택해주세요.', 'warning'); return; }
    const updated = { ...appData, offerStatus: 'DECLINED' };
    setLS(LS_APPLICANT, updated);
    api.offers.respond(null, 'DECLINED', `${reason}: ${msg}`).catch(() => {});
    showToast('거절 의사가 전달되었습니다.', 'info');
    const panel = container.querySelector('#decline-panel');
    if (panel) panel.style.display = 'none';
  });

  // ── Anchor auto-scroll ─────────────────────────────────────────
  const hash = window.location.hash;
  if (hash.includes('schedule')) {
    setTimeout(() => container.querySelector('#section-schedule')?.scrollIntoView({ behavior: 'smooth' }), 100);
  } else if (hash.includes('offer')) {
    setTimeout(() => container.querySelector('#section-offer')?.scrollIntoView({ behavior: 'smooth' }), 100);
  }
}

// ── File Handler ─────────────────────────────────────────────────
function handleFile(file, container) {
  const reader = new FileReader();
  reader.onload = e => {
    const base64   = e.target.result;
    const resumeData = { fileName: file.name, base64 };
    setLS(LS_RESUME, resumeData);
    const preview = container.querySelector('#upload-preview');
    if (preview) {
      if (base64.startsWith('data:image')) {
        preview.innerHTML = `<img src="${base64}" alt="이력서 미리보기" style="max-width:100%;max-height:160px;border-radius:6px;object-fit:contain;">`;
      } else {
        preview.innerHTML = `<div style="display:flex;align-items:center;gap:8px;justify-content:center;">
          <span style="font-size:24px;">📄</span>
          <span style="font-size:13px;color:var(--text,#1E293B);">${esc(file.name)}</span>
        </div>`;
      }
    }
    showToast('파일이 업로드되었습니다.', 'success');
  };
  reader.readAsDataURL(file);
}

// ── Public API ──────────────────────────────────────────────────
export async function mount(container) {
  _root = container;
  render(container);
}

export function unmount() {
  _root = null;
}
