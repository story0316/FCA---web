/**
 * boomerang.js – Re-hire Negotiation Page
 * HR Competency OS — Phase 3
 *
 * Tabs:
 *   1. 나의 신청 (자기신청) — form or applied status card
 *   2. HR 연락 목록       — contacts sent by HR recruiters
 */

import { showToast } from '../../components/toast.js';


// ── Module state ─────────────────────────────────────────────────
let _root      = null;
let _activeTab = 'apply';

// ── localStorage keys ────────────────────────────────────────────
const LS_APPLICATION = 'hr_boomerang_application';
const LS_CONTACTS    = 'hr_alumni_contacts';

// ── Demo data ────────────────────────────────────────────────────
const DEMO_HR_CONTACT = {
  id:            'CONTACT_001',
  recruiterName: 'HR 매니저',
  jobTitle:      'HR Business Partner',
  message:       '안녕하세요, 박동문님! 지난번 함께 일했던 기억이 좋아서 연락드립니다. 다시 함께 일하고 싶은 마음이 있으시다면 편하게 연락 주세요.',
  status:        'SENT',
  createdAt:     '2026-05-22T10:00:00Z',
};

const JOB_OPTIONS = [
  'HR Business Partner',
  'C&B 전문가',
  'L&D 매니저',
  'TA 스페셜리스트',
];

// ── Helpers ──────────────────────────────────────────────────────
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function lsGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota exceeded – silently ignore */ }
}

function getApplication() {
  return lsGet(LS_APPLICATION, null);
}

function getContacts() {
  let contacts = lsGet(LS_CONTACTS, null);
  if (!contacts || contacts.length === 0) {
    contacts = [{ ...DEMO_HR_CONTACT }];
    lsSet(LS_CONTACTS, contacts);
  }
  return contacts;
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

// ── Status badge ─────────────────────────────────────────────────
function statusBadge(status) {
  const map = {
    SENT:       { label: '새 메시지', bg: '#DBEAFE', color: '#1D4ED8' },
    INTERESTED: { label: '관심표명',  bg: '#D1FAE5', color: '#059669' },
    DECLINED:   { label: '거절',      bg: '#F1F5F9', color: '#94A3B8' },
    APPLIED:    { label: '신청완료',  bg: '#EEF2FF', color: '#4F46E5' },
  };
  const s = map[status] || map.SENT;
  return `<span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;
                        background:${s.bg};color:${s.color};">${s.label}</span>`;
}

// ── Render apply tab ─────────────────────────────────────────────
function renderApplyTab() {
  const app = getApplication();

  if (app && app.status === 'APPLIED') {
    return `
      <div style="background:#fff;border-radius:10px;padding:20px 16px;
                  border:1px solid #D1FAE5;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <span style="font-size:28px;">✅</span>
          <div>
            <h3 style="margin:0 0 2px;font-size:15px;font-weight:700;color:#059669;">신청 완료</h3>
            <p style="margin:0;font-size:12px;color:#64748B;">
              HR 담당자에게 전달되었습니다. 검토 후 연락드리겠습니다.
            </p>
          </div>
        </div>
        <div style="background:#F8FAFC;border-radius:8px;padding:14px;
                    border:1px solid #E2E8F0;display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;gap:8px;font-size:13px;">
            <span style="color:#64748B;width:80px;flex-shrink:0;">희망 직무</span>
            <span style="color:#1E293B;font-weight:600;">${esc(app.targetJobTitle || '-')}</span>
          </div>
          <div style="display:flex;gap:8px;font-size:13px;">
            <span style="color:#64748B;width:80px;flex-shrink:0;">현재 회사</span>
            <span style="color:#1E293B;">${esc(app.currentCompany || '-')}</span>
          </div>
          <div style="display:flex;gap:8px;font-size:13px;">
            <span style="color:#64748B;width:80px;flex-shrink:0;">신청일</span>
            <span style="color:#1E293B;">${esc(formatDate(app.appliedAt) || '-')}</span>
          </div>
        </div>
      </div>`;
  }

  // Not yet applied — show form
  const jobOptionHtml = JOB_OPTIONS.map(o =>
    `<option value="${esc(o)}">${esc(o)}</option>`
  ).join('');

  return `
    <div style="background:#fff;border-radius:10px;padding:20px 16px;
                border:1px solid #E2E8F0;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
      <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;color:#1E293B;">재입사 협의 신청</h3>
      <p style="margin:0 0 18px;font-size:12px;color:#64748B;">
        정보를 입력하시면 HR 담당자가 검토 후 연락드립니다.
      </p>

      <form id="boomerang-form" novalidate style="display:flex;flex-direction:column;gap:14px;">

        <div>
          <label style="display:block;font-size:13px;font-weight:600;color:#1E293B;margin-bottom:5px;">
            현재 회사 <span style="color:#EF4444;">*</span>
          </label>
          <input id="bm-company" type="text" placeholder="현재 재직 중인 회사명"
            style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #E2E8F0;
                   border-radius:8px;font-size:14px;outline:none;color:#1E293B;" />
        </div>

        <div>
          <label style="display:block;font-size:13px;font-weight:600;color:#1E293B;margin-bottom:5px;">
            현재 역할 <span style="color:#EF4444;">*</span>
          </label>
          <input id="bm-role" type="text" placeholder="현재 직책 또는 직무"
            style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #E2E8F0;
                   border-radius:8px;font-size:14px;outline:none;color:#1E293B;" />
        </div>

        <div>
          <label style="display:block;font-size:13px;font-weight:600;color:#1E293B;margin-bottom:5px;">
            재직 기간
          </label>
          <input id="bm-period" type="text" placeholder="예: 2024.04 ~ 현재"
            style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #E2E8F0;
                   border-radius:8px;font-size:14px;outline:none;color:#1E293B;" />
        </div>

        <div>
          <label style="display:block;font-size:13px;font-weight:600;color:#1E293B;margin-bottom:5px;">
            희망 직무 <span style="color:#EF4444;">*</span>
          </label>
          <select id="bm-job"
            style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #E2E8F0;
                   border-radius:8px;font-size:14px;outline:none;color:#1E293B;background:#fff;appearance:none;">
            <option value="">선택해 주세요</option>
            ${jobOptionHtml}
          </select>
        </div>

        <div>
          <label style="display:block;font-size:13px;font-weight:600;color:#1E293B;margin-bottom:5px;">
            재입사 희망 메시지
          </label>
          <textarea id="bm-message" rows="4"
            placeholder="재입사를 희망하는 이유나 전달하고 싶은 내용을 자유롭게 작성해 주세요."
            style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #E2E8F0;
                   border-radius:8px;font-size:14px;outline:none;color:#1E293B;resize:vertical;
                   font-family:inherit;line-height:1.5;"></textarea>
        </div>

        <button type="submit" id="bm-submit"
          style="width:100%;padding:14px;background:#4F46E5;color:#fff;border:none;
                 border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;
                 transition:opacity 0.15s;">
          재입사 협의 신청
        </button>
      </form>
    </div>`;
}

// ── Render contacts tab ──────────────────────────────────────────
function renderContactsTab() {
  const contacts = getContacts();

  if (!contacts.length) {
    return `<div style="text-align:center;padding:40px 20px;color:#64748B;font-size:14px;">
              아직 HR 연락이 없습니다.
            </div>`;
  }

  const cardsHtml = contacts.map((c, idx) => {
    const actionBtns = c.status === 'SENT' ? `
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button data-contact-idx="${idx}" data-action="INTERESTED"
          style="flex:1;padding:9px;background:#D1FAE5;color:#059669;border:none;border-radius:8px;
                 font-size:13px;font-weight:700;cursor:pointer;">
          💚 관심있음
        </button>
        <button data-contact-idx="${idx}" data-action="DECLINED"
          style="flex:1;padding:9px;background:#F1F5F9;color:#64748B;border:none;border-radius:8px;
                 font-size:13px;font-weight:700;cursor:pointer;">
          ✕ 거절
        </button>
      </div>` : '';

    return `
      <div style="background:#fff;border-radius:10px;padding:16px;
                  border:1px solid #E2E8F0;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px;">
          <div>
            <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1E293B;">${esc(c.recruiterName)}</p>
            <p style="margin:0;font-size:12px;color:#64748B;">${esc(c.jobTitle)}</p>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">
            ${statusBadge(c.status)}
            <span style="font-size:11px;color:#94A3B8;">${formatDate(c.createdAt)}</span>
          </div>
        </div>
        <p style="margin:0;font-size:13px;color:#1E293B;line-height:1.6;
                  background:#F8FAFC;border-radius:8px;padding:12px;border:1px solid #E2E8F0;">
          ${esc(c.message)}
        </p>
        ${actionBtns}
      </div>`;
  }).join('');

  return `<div style="display:flex;flex-direction:column;gap:12px;">${cardsHtml}</div>`;
}

// ── Full page render ─────────────────────────────────────────────
function render(container) {
  const isApply    = _activeTab === 'apply';
  const tabContent = isApply ? renderApplyTab() : renderContactsTab();

  const tabStyle = (active) => `
    flex:1;padding:10px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;
    transition:all 0.15s;
    background:${active ? '#4F46E5' : 'transparent'};
    color:${active ? '#fff' : '#64748B'};`;

  container.innerHTML = `
    <div id="boomerang-page" style="min-height:100vh;background:#F8FAFC;padding:0 0 80px;">

      <!-- 헤더 -->
      <div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);
                  padding:48px 20px 24px;color:#fff;">
        <button onclick="window.navBack()"
          style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:6px 12px;
                 border-radius:20px;font-size:13px;cursor:pointer;margin-bottom:12px;">
          ← 뒤로
        </button>
        <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;">💼 재입사 협의</h1>
        <p style="margin:0;font-size:13px;opacity:0.85;">HR팀과 재입사를 협의하세요</p>
      </div>

      <div style="padding:20px 16px;">

        <!-- 탭 -->
        <div style="display:flex;background:#E2E8F0;border-radius:10px;padding:4px;gap:4px;margin-bottom:20px;">
          <button data-tab="apply"
            style="${tabStyle(isApply)}">
            나의 신청
          </button>
          <button data-tab="contacts"
            style="${tabStyle(!isApply)}">
            HR 연락 목록
          </button>
        </div>

        <!-- 탭 콘텐츠 -->
        <div id="boomerang-tab-content">
          ${tabContent}
        </div>

      </div>
    </div>
  `;

  bindEvents(container);
}

// ── Event binding ────────────────────────────────────────────────
function bindEvents(container) {
  // Tab switching
  container.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeTab = btn.dataset.tab;
      render(container);
    });
  });

  // Form submission
  const form = container.querySelector('#boomerang-form');
  if (form) {
    const submitBtn = container.querySelector('#bm-submit');
    submitBtn && submitBtn.addEventListener('mouseenter', () => { submitBtn.style.opacity = '0.88'; });
    submitBtn && submitBtn.addEventListener('mouseleave', () => { submitBtn.style.opacity = '1'; });

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const company  = container.querySelector('#bm-company')?.value.trim();
      const role     = container.querySelector('#bm-role')?.value.trim();
      const period   = container.querySelector('#bm-period')?.value.trim();
      const jobEl    = container.querySelector('#bm-job');
      const jobTitle = jobEl?.value;
      const message  = container.querySelector('#bm-message')?.value.trim();

      if (!company) { showToast('현재 회사를 입력해 주세요.', 'warning'); return; }
      if (!role)    { showToast('현재 역할을 입력해 주세요.',    'warning'); return; }
      if (!jobTitle){ showToast('희망 직무를 선택해 주세요.',    'warning'); return; }

      const application = {
        currentCompany:  company,
        currentRole:     role,
        currentPeriod:   period,
        targetJobId:     `JOB_${jobTitle.replace(/\s/g, '_').toUpperCase()}`,
        targetJobTitle:  jobTitle,
        message:         message,
        status:          'APPLIED',
        appliedAt:       new Date().toISOString(),
      };

      lsSet(LS_APPLICATION, application);

      // Reflect in admin alumni mgmt list via shared key
      try {
        const requests = JSON.parse(localStorage.getItem('hr_boomerang_requests') || '[]');
        requests.unshift({ ...application, userName: application.currentCompany ? application.currentCompany : '동문' });
        localStorage.setItem('hr_boomerang_requests', JSON.stringify(requests));
      } catch {}

      showToast('✅ 신청이 완료되었습니다. 담당자가 검토 후 연락드립니다.', 'success', 4000);
      render(container);
    });
  }

  // Contact action buttons (관심있음 / 거절)
  container.querySelectorAll('[data-contact-idx][data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx    = parseInt(btn.dataset.contactIdx, 10);
      const action = btn.dataset.action;
      const contacts = getContacts();

      if (contacts[idx]) {
        contacts[idx].status = action;
        lsSet(LS_CONTACTS, contacts);

        const label = action === 'INTERESTED' ? '관심을 표명했습니다.' : '거절 의사를 전달했습니다.';
        const type  = action === 'INTERESTED' ? 'success' : 'info';
        showToast(`✅ ${label}`, type);
        render(container);
      }
    });
  });
}

// ── Public API ───────────────────────────────────────────────────
export async function mount(container, appState) {
  _root      = container;
  _activeTab = 'apply';
  render(container);
}

export function unmount() {
  _root = null;
}
