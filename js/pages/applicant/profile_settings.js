/**
 * profile_settings.js – Applicant profile & received offers
 * Sections: Visibility toggles + Received HR offers inbox
 * HR Competency OS — Phase 3
 */

import { api }       from '../../api.js';
import { showToast } from '../../components/toast.js';

// ── Module state ────────────────────────────────────────────────
let _root = null;

// ── Constants ───────────────────────────────────────────────────
const LS_VISIBILITY      = 'hr_profile_visibility';
const LS_OFFERS          = 'hr_received_offers';
const LS_JOB_INTEREST    = 'hr_job_interest';
const LS_SURVEY_RESP     = 'hr_survey_responses';
const LS_COMP_SESSIONS   = 'hr_comp_sessions';
const LS_CAREER_SUMMARY  = 'hr_career_summary';
const LS_USER            = 'hr_user';

const DEFAULT_VISIBILITY = { resume: false, competency: false, diagnostic: false };

// Job interest label map (matches survey.js JOB_INTERESTS)
const JOB_AREA_LABELS = {
  hr:        { label: 'HR/인사',       icon: '👥', color: '#4F46E5' },
  dev:       { label: '개발/엔지니어링', icon: '💻', color: '#0EA5E9' },
  marketing: { label: '마케팅',         icon: '📣', color: '#F59E0B' },
  sales:     { label: '영업/BD',        icon: '🤝', color: '#10B981' },
  planning:  { label: '기획/전략',      icon: '🔭', color: '#8B5CF6' },
  design:    { label: '디자인',         icon: '🎨', color: '#EC4899' },
  finance:   { label: '재무/회계',      icon: '📊', color: '#64748B' },
  ops:       { label: '운영/CS',        icon: '⚙️', color: '#059669' },
};

const DEMO_OFFERS = [
  {
    id:            'OFFER_RD_001',
    recruiterName: 'HR 매니저',
    orgName:       '테크스타트업',
    jobTitle:      'HR Business Partner',
    message:       '안녕하세요 이지원님! 역량진단 결과를 보고 연락드립니다. 저희 팀에 꼭 맞는 분인 것 같습니다. 한 번 이야기 나눠보실 수 있을까요?',
    status:        'SENT',
    createdAt:     '2026-05-20T09:00:00Z',
  },
];

const STATUS_CONFIG = {
  SENT:       { label: '새오퍼',   bg: '#DBEAFE', color: '#1D4ED8' },
  INTERESTED: { label: '관심있음', bg: '#D1FAE5', color: '#065F46' },
  DECLINED:   { label: '거절',     bg: '#F1F5F9', color: '#64748B' },
};

// ── Helpers ─────────────────────────────────────────────────────
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getLS(key, fallback) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
  catch { return fallback; }
}

function setLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
}

function getUserName() {
  try {
    const u = JSON.parse(localStorage.getItem(LS_USER) || '{}');
    return u.name_ko || u.name || u.email?.split('@')[0] || '지원자';
  } catch { return '지원자'; }
}

function getJobInterests() {
  try {
    const raw = localStorage.getItem(LS_JOB_INTEREST);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      return parsed ? [String(parsed)] : [];
    } catch {
      // Legacy: plain string stored without JSON encoding (e.g. "hr")
      return [raw];
    }
  } catch { return []; }
}

function getSurveyStats() {
  try {
    const all = JSON.parse(localStorage.getItem(LS_SURVEY_RESP) || '{}');
    const entries = Object.values(all).filter(v => v?.submittedAt);
    const pulse = entries.filter(v => v.jobId);
    return { total: entries.length, pulse: pulse.length };
  } catch { return { total: 0, pulse: 0 }; }
}

function getLatestCompScore() {
  try {
    const sessions = JSON.parse(localStorage.getItem(LS_COMP_SESSIONS) || '[]');
    if (!Array.isArray(sessions) || !sessions.length) return null;
    const latest = sessions[sessions.length - 1];
    if (!Array.isArray(latest.scores) || !latest.scores.length) return null;
    const avg = latest.scores.reduce((s, c) => s + Number(c.as_is_score || c.score || 3), 0) / latest.scores.length;
    return { avg: avg.toFixed(1), count: latest.scores.length, date: latest.savedAt || null };
  } catch { return null; }
}

function getCareerSummary() {
  return getLS(LS_CAREER_SUMMARY, {});
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  } catch { return iso || ''; }
}

function getOffers() {
  const stored = getLS(LS_OFFERS, null);
  if (!stored || !Array.isArray(stored) || stored.length === 0) return [...DEMO_OFFERS];
  return stored;
}

// ── Render: Profile Summary (연동 섹션) ──────────────────────────
function renderProfileSummary() {
  const name         = getUserName();
  const jobIds       = getJobInterests();
  const surveyStats  = getSurveyStats();
  const compScore    = getLatestCompScore();
  const summary      = getCareerSummary();
  const targetJob    = summary.targetJob || null;

  const jobChips = jobIds.length
    ? jobIds.map(id => {
        const area = JOB_AREA_LABELS[id];
        if (!area) return '';
        return `<span style="display:inline-flex;align-items:center;gap:5px;padding:5px 12px;
                    border-radius:20px;font-size:13px;font-weight:600;
                    background:${area.color}18;color:${area.color};border:1.5px solid ${area.color}40;">
                  ${area.icon} ${esc(area.label)}
                </span>`;
      }).join('')
    : `<button id="go-survey-btn" style="display:inline-flex;align-items:center;gap:5px;padding:5px 12px;
              border-radius:20px;font-size:13px;font-weight:600;border:1.5px dashed #CBD5E1;
              background:transparent;color:#94A3B8;cursor:pointer;">
        ＋ 관심 직무 선택하기 (복수 선택 가능)
       </button>`;

  const compSection = compScore
    ? `<div style="display:flex;align-items:center;gap:10px;">
        <div style="flex:1;height:6px;background:#E2E8F0;border-radius:3px;overflow:hidden;">
          <div style="width:${Math.round((Number(compScore.avg)/5)*100)}%;height:100%;
                      background:#4F46E5;border-radius:3px;"></div>
        </div>
        <span style="font-size:13px;font-weight:700;color:#4F46E5;min-width:32px;">${compScore.avg}</span>
        <span style="font-size:11px;color:#94A3B8;">/ 5.0</span>
       </div>`
    : `<button id="go-career-btn" style="font-size:12px;color:#4F46E5;background:none;border:none;
              cursor:pointer;padding:0;font-weight:600;">역량 진단 시작하기 →</button>`;

  return `
    <div style="background:#fff;border-radius:var(--radius-md,10px);border:1px solid var(--border,#E2E8F0);
                padding:18px 16px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06);">

      <!-- 이름 + 목표 직무 -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#4F46E5,#7C3AED);
                    display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">
          👤
        </div>
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text,#1E293B);">${esc(name)}님</div>
          ${targetJob
            ? `<div style="font-size:12px;color:#64748B;">목표 직무: ${esc(targetJob)}</div>`
            : `<div style="font-size:12px;color:#94A3B8;">목표 직무를 설정해보세요</div>`}
        </div>
      </div>

      <!-- 관심 분야 -->
      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.05em;">
            관심 분야
          </div>
          ${jobIds.length ? `<button id="go-survey-btn" style="font-size:11px;color:#4F46E5;background:none;
              border:none;cursor:pointer;padding:0;font-weight:600;">＋ 추가</button>` : ''}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">${jobChips}</div>
      </div>

      <!-- 역량 진단 -->
      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.05em;">
            역량 진단
          </div>
          ${compScore ? `<span style="font-size:10px;color:#94A3B8;">
            ${compScore.count}개 역량 측정됨</span>` : ''}
        </div>
        ${compSection}
      </div>

      <!-- 설문 참여 현황 -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
        <div style="background:#F8FAFC;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:20px;font-weight:800;color:#4F46E5;">${surveyStats.total}</div>
          <div style="font-size:11px;color:#64748B;">서베이 참여</div>
        </div>
        <div style="background:#F8FAFC;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:20px;font-weight:800;color:#10B981;">${surveyStats.pulse}</div>
          <div style="font-size:11px;color:#64748B;">직무 진단</div>
        </div>
      </div>

      <!-- 퀵 액션 -->
      <div style="display:flex;gap:8px;">
        <button id="quick-survey-btn" style="flex:1;padding:9px;background:#EEF2FF;color:#4F46E5;border:none;
                border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">
          🗳️ 서베이 참여
        </button>
        <button id="quick-career-btn" style="flex:1;padding:9px;background:#F0FDF4;color:#059669;border:none;
                border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">
          💼 커리어 프로필
        </button>
      </div>
    </div>
  `;
}

// ── Render: Visibility Toggles ───────────────────────────────────
function renderToggleRow(key, icon, label, checked) {
  return `
    <div style="padding:14px 0;border-bottom:1px solid var(--border,#E2E8F0);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div style="display:flex;align-items:center;gap:10px;flex:1;">
          <span style="font-size:20px;">${icon}</span>
          <span style="font-size:14px;font-weight:500;color:var(--text,#1E293B);">${esc(label)}</span>
        </div>
        <button
          role="switch"
          aria-checked="${checked}"
          data-toggle-key="${esc(key)}"
          style="
            width:44px;height:24px;border-radius:12px;border:none;cursor:pointer;
            background:${checked ? 'var(--primary,#4F46E5)' : '#CBD5E1'};
            position:relative;transition:background .2s;flex-shrink:0;padding:0;
          "
          aria-label="${esc(label)} 공개 ${checked ? '설정됨' : '해제됨'}"
        >
          <span style="
            position:absolute;top:2px;left:${checked ? '22' : '2'}px;
            width:20px;height:20px;border-radius:50%;background:#fff;
            box-shadow:0 1px 3px rgba(0,0,0,.2);transition:left .2s;display:block;
          "></span>
        </button>
      </div>
      <div class="toggle-note" data-note-key="${esc(key)}"
        style="margin-top:6px;font-size:12px;color:var(--text-muted,#64748B);
               display:${checked ? 'block' : 'none'};padding-left:30px;">
        HR 담당자가 이 정보를 열람하고 직접 오퍼를 보낼 수 있습니다.
      </div>
    </div>
  `;
}

function renderVisibilitySection(vis) {
  return `
    <div style="background:#fff;border-radius:var(--radius-md,10px);
         border:1px solid var(--border,#E2E8F0);padding:16px;
         box-shadow:0 1px 4px rgba(0,0,0,.06);margin-bottom:16px;">
      <h2 style="margin:0 0 4px;font-size:16px;font-weight:700;color:var(--text,#1E293B);">내 정보 공개 설정</h2>
      <p style="margin:0 0 4px;font-size:12px;color:var(--text-muted,#64748B);">공개 항목은 HR 담당자에게 노출됩니다.</p>
      ${renderToggleRow('resume',     '📄', '이력서 공개',           vis.resume)}
      ${renderToggleRow('competency', '📊', '역량진단 결과 공개',     vis.competency)}
      ${renderToggleRow('diagnostic', '🧠', '인적성 검사 공개',       vis.diagnostic)}
    </div>
  `;
}

// ── Render: Received Offers ──────────────────────────────────────
function renderOfferCard(offer) {
  const statusCfg = STATUS_CONFIG[offer.status] || STATUS_CONFIG['SENT'];
  const preview   = offer.message?.length > 80
    ? offer.message.slice(0, 80) + '...'
    : (offer.message || '');
  const isSent    = offer.status === 'SENT';

  return `
    <div class="offer-card" data-offer-id="${esc(offer.id)}"
      style="background:#fff;border-radius:var(--radius-sm,8px);border:1px solid var(--border,#E2E8F0);
             padding:14px 16px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,.05);">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;">
        <div>
          <p style="margin:0;font-size:14px;font-weight:600;color:var(--text,#1E293B);">${esc(offer.orgName)}</p>
          <p style="margin:2px 0 0;font-size:12px;color:var(--text-muted,#64748B);">
            ${esc(offer.recruiterName)} · ${esc(offer.jobTitle)}
          </p>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">
          <span style="display:inline-block;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600;
                       background:${statusCfg.bg};color:${statusCfg.color};">
            ${esc(statusCfg.label)}
          </span>
          <span style="font-size:11px;color:var(--text-muted,#64748B);">${esc(formatDate(offer.createdAt))}</span>
        </div>
      </div>
      <p style="margin:0 0 10px;font-size:13px;color:var(--text-muted,#64748B);line-height:1.5;">${esc(preview)}</p>
      ${isSent ? `
        <div style="display:flex;gap:8px;">
          <button class="offer-interest-btn" data-offer-id="${esc(offer.id)}"
            style="flex:1;padding:9px;background:#D1FAE5;color:#065F46;border:none;
                   border-radius:var(--radius-sm,8px);font-size:13px;font-weight:600;cursor:pointer;">
            💚 관심있음
          </button>
          <button class="offer-decline-btn" data-offer-id="${esc(offer.id)}"
            style="flex:1;padding:9px;background:#F1F5F9;color:var(--text-muted,#64748B);border:none;
                   border-radius:var(--radius-sm,8px);font-size:13px;font-weight:600;cursor:pointer;">
            ✕ 거절
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderOffersSection(offers) {
  const cardsHtml = offers.length > 0
    ? offers.map(renderOfferCard).join('')
    : `<p style="text-align:center;color:var(--text-muted,#64748B);font-size:13px;padding:20px 0;">받은 오퍼가 없습니다.</p>`;

  return `
    <div style="background:#fff;border-radius:var(--radius-md,10px);
         border:1px solid var(--border,#E2E8F0);padding:16px;
         box-shadow:0 1px 4px rgba(0,0,0,.06);">
      <h2 style="margin:0 0 14px;font-size:16px;font-weight:700;color:var(--text,#1E293B);">💌 받은 오퍼</h2>
      <div id="offers-list">${cardsHtml}</div>
    </div>
  `;
}

// ── Full Render ──────────────────────────────────────────────────
function render(container) {
  const vis    = { ...DEFAULT_VISIBILITY, ...getLS(LS_VISIBILITY, {}) };
  const offers = getOffers();

  container.innerHTML = `
    <div id="profile-settings" style="min-height:100vh;background:var(--bg,#F8FAFC);padding:0 0 80px;">
      <!-- Page Header -->
      <div style="background:#fff;padding:48px 16px 16px;border-bottom:1px solid var(--border,#E2E8F0);">
        <div style="max-width:480px;margin:0 auto;">
          <button id="back-btn" style="background:none;border:none;cursor:pointer;font-size:20px;padding:0;margin-bottom:8px;">←</button>
          <h1 style="margin:0;font-size:20px;font-weight:700;color:var(--text,#1E293B);">프로필 설정</h1>
          <p style="margin:4px 0 0;font-size:13px;color:var(--text-muted,#64748B);">공개 범위 및 받은 오퍼 관리</p>
        </div>
      </div>

      <div style="max-width:480px;margin:0 auto;padding:16px;">
        ${renderProfileSummary()}
        ${renderVisibilitySection(vis)}
        ${renderOffersSection(offers)}
        <div style="margin-top:16px;padding:14px 16px;background:#fff;border-radius:var(--radius-md,10px);
             border:1px solid var(--border,#E2E8F0);display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:0.85rem;color:var(--text-muted,#64748B)">🔒 비밀번호 변경</span>
          <a href="#/change-password" style="font-size:0.8rem;font-weight:600;color:var(--primary,#4F46E5);text-decoration:none">변경하기 →</a>
        </div>
      </div>
    </div>
  `;

  bindEvents(container, vis, offers);
}

// ── Event Binding ────────────────────────────────────────────────
function bindEvents(container, vis, offers) {
  // Back button
  container.querySelector('#back-btn')?.addEventListener('click', () => window.location.hash = '#/applicant');

  // Profile summary quick actions
  container.querySelector('#quick-survey-btn')?.addEventListener('click', () => { window.location.hash = '#/survey'; });
  container.querySelector('#quick-career-btn')?.addEventListener('click', () => { window.location.hash = '#/applicant/career'; });
  container.querySelector('#go-survey-btn')?.addEventListener('click', () => { window.location.hash = '#/survey'; });
  container.querySelector('#go-career-btn')?.addEventListener('click', () => { window.location.hash = '#/applicant/career'; });

  // ── Visibility Toggles ─────────────────────────────────────────
  container.querySelectorAll('[data-toggle-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key     = btn.dataset.toggleKey;
      const current = btn.getAttribute('aria-checked') === 'true';
      const next    = !current;

      // Update button state
      btn.setAttribute('aria-checked', String(next));
      btn.style.background = next ? 'var(--primary,#4F46E5)' : '#CBD5E1';
      const knob = btn.querySelector('span');
      if (knob) knob.style.left = next ? '22px' : '2px';

      // Update note visibility
      const note = container.querySelector(`[data-note-key="${CSS.escape(key)}"]`);
      if (note) note.style.display = next ? 'block' : 'none';

      // Persist
      const latest = { ...DEFAULT_VISIBILITY, ...getLS(LS_VISIBILITY, {}) };
      latest[key] = next;
      setLS(LS_VISIBILITY, latest);
      api.applicant.updateVisibility(latest).catch(() => {});
      showToast(next ? '공개로 설정되었습니다.' : '비공개로 설정되었습니다.', 'success');
    });
  });

  // ── Offer Buttons ──────────────────────────────────────────────
  container.querySelectorAll('.offer-interest-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const offerId = btn.dataset.offerId;
      updateOfferStatus(offerId, 'INTERESTED', container, offers);
    });
  });

  container.querySelectorAll('.offer-decline-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const offerId = btn.dataset.offerId;
      updateOfferStatus(offerId, 'DECLINED', container, offers);
    });
  });
}

function updateOfferStatus(offerId, newStatus, container, offers) {
  const updated = offers.map(o =>
    o.id === offerId ? { ...o, status: newStatus } : o
  );

  // Persist (merge with demo if needed)
  setLS(LS_OFFERS, updated);
  api.offers.respond(offerId, newStatus, null).catch(() => {});

  const statusCfg = STATUS_CONFIG[newStatus] || STATUS_CONFIG['SENT'];
  showToast(
    newStatus === 'INTERESTED' ? '💚 관심있음으로 표시했습니다.' : '거절 처리되었습니다.',
    newStatus === 'INTERESTED' ? 'success' : 'info'
  );

  // Re-render only the offer card
  const card = container.querySelector(`.offer-card[data-offer-id="${CSS.escape(offerId)}"]`);
  if (card) {
    const offer    = updated.find(o => o.id === offerId);
    const tempDiv  = document.createElement('div');
    tempDiv.innerHTML = renderOfferCard(offer);
    const newCard = tempDiv.firstElementChild;
    card.replaceWith(newCard);

    // Rebind buttons on new card
    newCard.querySelector('.offer-interest-btn')?.addEventListener('click', e => {
      updateOfferStatus(e.currentTarget.dataset.offerId, 'INTERESTED', container, updated);
    });
    newCard.querySelector('.offer-decline-btn')?.addEventListener('click', e => {
      updateOfferStatus(e.currentTarget.dataset.offerId, 'DECLINED', container, updated);
    });
  }
}

// ── Public API ──────────────────────────────────────────────────
export async function mount(container) {
  _root = container;
  render(container);
}

export function unmount() {
  _root = null;
}
