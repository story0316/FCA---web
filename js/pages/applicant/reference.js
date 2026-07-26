/**
 * reference.js – Applicant Reference Check Page
 * Steps: INTRO → CONSENT → REQUEST → STATUS
 * HR Competency OS — Phase 3
 */

import { getUser } from '../../auth.js';
import { showToast } from '../../components/toast.js';

let _root = null;
let _step = 'INTRO'; // 'INTRO' | 'CONSENT' | 'REQUEST' | 'STATUS'

const LS_KEY = 'hr_ref_my_request';
const LS_ALL = 'hr_ref_requests';

const LEGACY_REF_IDS = new Set(['REF_001']);
const LEGACY_REFEREE_IDS = new Set(['REFEREE_DEMO_01', 'REFEREE_DEMO_02']);

// ── localStorage helpers ──────────────────────────────────────────
function getMyRequest() {
  try {
    const r = JSON.parse(localStorage.getItem(LS_KEY));
    if (!r) return null;
    if (LEGACY_REF_IDS.has(r.id)) { localStorage.removeItem(LS_KEY); return null; }
    r.referees = (r.referees || []).filter(rf => !LEGACY_REFEREE_IDS.has(rf.id));
    return r;
  } catch { return null; }
}

function saveMyRequest(req) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(req));
    // Also update the global list
    let all = [];
    try { all = JSON.parse(localStorage.getItem(LS_ALL) || '[]'); } catch {}
    const idx = all.findIndex(r => r.id === req.id);
    if (idx >= 0) all[idx] = req; else all.push(req);
    localStorage.setItem(LS_ALL, JSON.stringify(all));
  } catch {}
}

function seedDemoData() {
  return null;
}

function generateToken() {
  return 'tok_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ── XSS helper ────────────────────────────────────────────────────
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Step indicator ────────────────────────────────────────────────
const STEPS = ['안내', '동의', '요청', '현황'];
function stepIndex() {
  return { INTRO: 0, CONSENT: 1, REQUEST: 2, STATUS: 3 }[_step] ?? 0;
}

function renderStepBar() {
  const cur = stepIndex();
  return `
    <div style="display:flex;align-items:center;padding:0 20px 20px;gap:0;">
      ${STEPS.map((label, i) => `
        <div style="display:flex;align-items:center;flex:1;min-width:0;">
          <div style="display:flex;flex-direction:column;align-items:center;flex:1">
            <div style="width:26px;height:26px;border-radius:50%;flex-shrink:0;
                        background:${i <= cur ? '#4F46E5' : '#E2E8F0'};
                        display:flex;align-items:center;justify-content:center;
                        font-size:11px;font-weight:700;color:${i <= cur ? '#fff' : '#94A3B8'}">
              ${i < cur ? '✓' : i + 1}
            </div>
            <span style="font-size:10px;margin-top:3px;font-weight:${i === cur ? '700' : '400'};
                         color:${i === cur ? '#4F46E5' : i < cur ? '#64748B' : '#94A3B8'}">
              ${label}
            </span>
          </div>
          ${i < STEPS.length - 1 ? `<div style="flex:1;height:2px;background:${i < cur ? '#4F46E5' : '#E2E8F0'};margin-bottom:14px;"></div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

// ── INTRO ─────────────────────────────────────────────────────────
function renderIntro(container) {
  container.innerHTML = `
    <div style="min-height:100vh;background:#F8FAFC;padding-bottom:80px;">
      <div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:52px 20px 32px;color:#fff;">
        <p style="margin:0 0 6px;font-size:13px;opacity:0.8;">채용 프로세스</p>
        <h1 style="margin:0;font-size:22px;font-weight:700;">📋 레퍼런스 체크</h1>
      </div>

      <div style="padding:20px 16px;">
        ${renderStepBar()}

        <div style="background:#fff;border-radius:10px;padding:20px;border:1px solid #E2E8F0;box-shadow:0 1px 4px rgba(0,0,0,.06);margin-bottom:16px;">
          <h2 style="margin:0 0 10px;font-size:16px;font-weight:700;color:#1E293B;">레퍼런스 체크란?</h2>
          <p style="margin:0 0 14px;font-size:13px;color:#475569;line-height:1.7;">
            과거 함께 일했던 분께 귀하의 업무 능력과 협업 스타일에 대한 의견을 구하는 절차입니다.
            모든 응답은 <strong>익명으로 처리</strong>되며 채용 결정의 참고 자료로만 활용됩니다.
          </p>

          <div style="display:flex;flex-direction:column;gap:10px;">
            ${[
              ['📝', '동의', '개인정보 수집 및 활용에 동의합니다.'],
              ['📨', '요청', '레퍼런스 제공자(최대 3명)에게 링크를 발송합니다.'],
              ['✅', '확인', '제공자의 응답 완료 여부를 실시간으로 확인합니다.'],
            ].map(([icon, title, desc]) => `
              <div style="display:flex;align-items:flex-start;gap:12px;padding:12px;
                          background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0;">
                <span style="font-size:20px;flex-shrink:0;">${icon}</span>
                <div>
                  <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#1E293B;">${title}</p>
                  <p style="margin:0;font-size:12px;color:#64748B;">${desc}</p>
                </div>
              </div>
            `).join('')}
          </div>

          <div style="margin-top:14px;padding:10px 14px;background:#EEF2FF;border-radius:8px;
                      display:flex;align-items:center;gap:8px;">
            <span style="font-size:16px;">⏱️</span>
            <span style="font-size:12px;color:#4F46E5;font-weight:500;">레퍼런스 제공자 응답 소요 시간: 약 10분</span>
          </div>
        </div>

        <button id="intro-next-btn" style="width:100%;padding:15px;background:#4F46E5;color:#fff;border:none;
               border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;
               box-shadow:0 2px 8px rgba(79,70,229,0.3);">
          시작하기 →
        </button>
      </div>
    </div>
  `;

  container.querySelector('#intro-next-btn').addEventListener('click', () => {
    _step = 'CONSENT';
    render(container);
  });
}

// ── CONSENT ───────────────────────────────────────────────────────
function renderConsent(container) {
  container.innerHTML = `
    <div style="min-height:100vh;background:#F8FAFC;padding-bottom:80px;">
      <div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:52px 20px 32px;color:#fff;">
        <h1 style="margin:0;font-size:20px;font-weight:700;">📋 레퍼런스 체크</h1>
      </div>

      <div style="padding:20px 16px;">
        ${renderStepBar()}

        <div style="background:#fff;border-radius:10px;padding:20px;border:1px solid #E2E8F0;
                    box-shadow:0 1px 4px rgba(0,0,0,.06);margin-bottom:14px;">
          <h2 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#1E293B;">개인정보 수집 및 이용 동의</h2>
          <div style="max-height:240px;overflow-y:auto;padding:14px;background:#F8FAFC;
                      border:1px solid #E2E8F0;border-radius:8px;font-size:12px;
                      color:#475569;line-height:1.8;margin-bottom:14px;">
            <strong>수집 항목:</strong> 레퍼런스 제공자 성명, 이메일, 직책, 응답 내용<br><br>
            <strong>수집 목적:</strong> 채용 심사를 위한 지원자 평판 조회<br><br>
            <strong>보유 기간:</strong> 채용 절차 종료 후 6개월<br><br>
            <strong>제3자 제공:</strong> 제공하지 않음<br><br>
            귀하는 동의를 거부할 권리가 있으나, 거부 시 레퍼런스 체크 진행이 불가할 수 있습니다.
            레퍼런스 제공자에게는 익명성이 보장되며, 응답 내용은 채용 담당자만 열람합니다.<br><br>
            레퍼런스 체크는 지원자의 요청에 의해 진행되며, HR 담당자는 제공자 개인정보를
            채용 목적 외에 사용하지 않습니다.
          </div>

          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px;">
            <input type="checkbox" id="consent-check" style="width:18px;height:18px;cursor:pointer;accent-color:#4F46E5;">
            <span style="font-size:13px;font-weight:600;color:#1E293B;">위 내용을 모두 읽고 동의합니다.</span>
          </label>
        </div>

        <button id="consent-next-btn" disabled
               style="width:100%;padding:15px;background:#E2E8F0;color:#94A3B8;border:none;
                      border-radius:10px;font-size:15px;font-weight:600;cursor:not-allowed;transition:all 0.2s;">
          동의하고 계속하기
        </button>
      </div>
    </div>
  `;

  const btn = container.querySelector('#consent-next-btn');
  container.querySelector('#consent-check').addEventListener('change', e => {
    if (e.target.checked) {
      btn.disabled = false;
      btn.style.background = '#4F46E5';
      btn.style.color = '#fff';
      btn.style.cursor = 'pointer';
      btn.style.boxShadow = '0 2px 8px rgba(79,70,229,0.3)';
    } else {
      btn.disabled = true;
      btn.style.background = '#E2E8F0';
      btn.style.color = '#94A3B8';
      btn.style.cursor = 'not-allowed';
      btn.style.boxShadow = 'none';
    }
  });

  btn.addEventListener('click', () => {
    _step = 'REQUEST';
    render(container);
  });
}

// ── REQUEST ───────────────────────────────────────────────────────
let _pendingReferees = [{ name: '', relation: '', email: '' }];

function renderRequest(container) {
  const relOptions = ['직속 상사', '동료', '부하직원', '외부 협력사/파트너', '기타'];

  container.innerHTML = `
    <div style="min-height:100vh;background:#F8FAFC;padding-bottom:80px;">
      <div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:52px 20px 32px;color:#fff;">
        <h1 style="margin:0;font-size:20px;font-weight:700;">📋 레퍼런스 체크</h1>
      </div>

      <div style="padding:20px 16px;">
        ${renderStepBar()}

        <div style="background:#fff;border-radius:10px;padding:20px;border:1px solid #E2E8F0;
                    box-shadow:0 1px 4px rgba(0,0,0,.06);margin-bottom:14px;">
          <h2 style="margin:0 0 4px;font-size:15px;font-weight:700;color:#1E293B;">레퍼런스 제공자 입력</h2>
          <p style="margin:0 0 16px;font-size:12px;color:#64748B;">최소 1명, 최대 3명까지 등록 가능합니다.</p>

          <div id="referee-list" style="display:flex;flex-direction:column;gap:14px;">
            ${_pendingReferees.map((r, i) => renderRefereeForm(r, i)).join('')}
          </div>

          <button id="add-referee-btn"
                  style="width:100%;margin-top:12px;padding:11px;background:none;
                         border:1.5px dashed #CBD5E1;border-radius:8px;color:#64748B;
                         font-size:13px;font-weight:600;cursor:pointer;${_pendingReferees.length >= 3 ? 'display:none' : ''}">
            + 제공자 추가 (${_pendingReferees.length}/3)
          </button>
        </div>

        <button id="send-request-btn"
               style="width:100%;padding:15px;background:#4F46E5;color:#fff;border:none;
                      border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;
                      box-shadow:0 2px 8px rgba(79,70,229,0.3);">
          요청 링크 발송하기 →
        </button>
      </div>
    </div>
  `;

  bindRequestEvents(container);
}

function renderRefereeForm(r, i) {
  const relOptions = ['직속 상사', '동료', '부하직원', '외부 협력사/파트너', '기타'];
  return `
    <div class="referee-form-card" data-idx="${i}"
         style="padding:14px;border:1.5px solid #E2E8F0;border-radius:8px;background:#FAFBFC;position:relative;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <span style="font-size:13px;font-weight:700;color:#4F46E5;">제공자 ${i + 1}</span>
        ${i > 0 ? `<button class="remove-referee-btn" data-idx="${i}"
                     style="background:none;border:none;color:#94A3B8;cursor:pointer;font-size:18px;padding:0 4px;">×</button>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <input class="referee-name" data-idx="${i}" type="text" placeholder="이름 *"
               value="${esc(r.name)}"
               style="width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:7px;
                      font-size:13px;color:#1E293B;box-sizing:border-box;outline:none;">
        <select class="referee-relation" data-idx="${i}"
                style="width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:7px;
                       font-size:13px;color:#1E293B;background:#fff;outline:none;appearance:none;">
          <option value="">관계 선택 *</option>
          ${relOptions.map(o => `<option value="${o}" ${r.relation === o ? 'selected' : ''}>${o}</option>`).join('')}
        </select>
        <input class="referee-email" data-idx="${i}" type="email" placeholder="이메일 주소 *"
               value="${esc(r.email)}"
               style="width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:7px;
                      font-size:13px;color:#1E293B;box-sizing:border-box;outline:none;">
      </div>
    </div>
  `;
}

function bindRequestEvents(container) {
  container.querySelector('#add-referee-btn')?.addEventListener('click', () => {
    if (_pendingReferees.length >= 3) return;
    _pendingReferees.push({ name: '', relation: '', email: '' });
    renderRequest(container);
  });

  container.querySelectorAll('.remove-referee-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.idx);
      _pendingReferees.splice(i, 1);
      renderRequest(container);
    });
  });

  // Live sync inputs → _pendingReferees
  container.querySelectorAll('.referee-name').forEach(el => {
    el.addEventListener('input', e => { _pendingReferees[Number(e.target.dataset.idx)].name = e.target.value; });
  });
  container.querySelectorAll('.referee-relation').forEach(el => {
    el.addEventListener('change', e => { _pendingReferees[Number(e.target.dataset.idx)].relation = e.target.value; });
  });
  container.querySelectorAll('.referee-email').forEach(el => {
    el.addEventListener('input', e => { _pendingReferees[Number(e.target.dataset.idx)].email = e.target.value; });
  });

  container.querySelector('#send-request-btn').addEventListener('click', () => {
    // Validate
    for (let i = 0; i < _pendingReferees.length; i++) {
      const r = _pendingReferees[i];
      if (!r.name.trim())     { showToast(`제공자 ${i + 1}: 이름을 입력하세요.`, 'error'); return; }
      if (!r.relation)        { showToast(`제공자 ${i + 1}: 관계를 선택하세요.`, 'error'); return; }
      if (!r.email.trim() || !r.email.includes('@')) { showToast(`제공자 ${i + 1}: 올바른 이메일을 입력하세요.`, 'error'); return; }
    }

    const user = getUser();
    // C-1: ATS applicantId 연결 (이름으로 매핑)
    const _atsList = (() => { try { return JSON.parse(localStorage.getItem('hr_applicants') || '[]'); } catch { return []; } })();
    const _appName  = user?.name_ko || user?.name || '이지원';
    const _atsMatch = _atsList.find(a => a.name === _appName);
    const req = {
      id: 'REF_' + Date.now(),
      applicantId:    _atsMatch?.id || null,
      applicantUserId: user?.id || 'demo',
      applicantName: _appName,
      jobTitle: (() => { try { return JSON.parse(localStorage.getItem('hr_applicant_data') || '{}').jobTitle || 'HR Business Partner'; } catch { return 'HR Business Partner'; } })(),
      consentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      referees: _pendingReferees.map((r, i) => ({
        id: `REFEREE_${Date.now()}_${i}`,
        token: generateToken(),
        name: r.name.trim(),
        relation: r.relation,
        email: r.email.trim(),
        status: 'pending',
        submittedAt: null,
        responses: {},
      })),
    };

    saveMyRequest(req);
    showLinksModal(container, req);
  });
}

function showLinksModal(container, req) {
  const baseUrl = window.location.origin + window.location.pathname;
  const overlay = document.createElement('div');
  overlay.id = 'links-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;';
  overlay.innerHTML = `
    <div style="width:100%;background:#fff;border-radius:20px 20px 0 0;padding:22px 18px 36px;max-height:80vh;overflow-y:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="margin:0;font-size:16px;font-weight:700;color:#1E293B;">📨 요청 링크 생성 완료</h3>
        <button id="links-close-btn" style="background:none;border:none;font-size:22px;color:#94A3B8;cursor:pointer;">×</button>
      </div>
      <p style="margin:0 0 16px;font-size:13px;color:#64748B;">아래 링크를 각 제공자에게 전달하세요.<br>데모 환경에서는 직접 열어볼 수 있습니다.</p>

      ${req.referees.map(r => {
        const url = `${baseUrl}#/reference-check?token=${r.token}`;
        return `
          <div style="margin-bottom:14px;padding:14px;background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0;">
            <div style="font-size:13px;font-weight:700;color:#1E293B;margin-bottom:2px;">${esc(r.name)} · ${esc(r.relation)}</div>
            <div style="font-size:12px;color:#64748B;margin-bottom:8px;">${esc(r.email)}</div>
            <div style="display:flex;gap:6px;">
              <input readonly value="${esc(url)}" id="link-input-${r.id}"
                     style="flex:1;padding:8px 10px;border:1px solid #E2E8F0;border-radius:6px;
                            font-size:11px;color:#475569;background:#fff;min-width:0;outline:none;">
              <button class="copy-link-btn" data-id="${r.id}" data-url="${esc(url)}"
                      style="padding:8px 12px;background:#4F46E5;color:#fff;border:none;border-radius:6px;
                             font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0;">
                복사
              </button>
            </div>
            <button class="open-link-btn" data-token="${r.token}"
                    style="width:100%;margin-top:6px;padding:8px;background:none;border:1.5px solid #4F46E5;
                           color:#4F46E5;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">
              🔗 링크 열기 (데모)
            </button>
          </div>
        `;
      }).join('')}

      <button id="links-done-btn"
              style="width:100%;padding:14px;background:#4F46E5;color:#fff;border:none;
                     border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;margin-top:8px;">
        확인 — 상태 페이지로 이동
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#links-close-btn').addEventListener('click', () => {
    overlay.remove();
    _step = 'STATUS';
    render(container);
  });
  overlay.querySelector('#links-done-btn').addEventListener('click', () => {
    overlay.remove();
    _step = 'STATUS';
    render(container);
  });

  overlay.querySelectorAll('.copy-link-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.url;
      navigator.clipboard?.writeText(url).then(() => showToast('링크가 복사되었습니다.', 'success'))
        .catch(() => {
          const inp = overlay.querySelector(`#link-input-${btn.dataset.id}`);
          if (inp) { inp.select(); document.execCommand('copy'); }
          showToast('링크가 복사되었습니다.', 'success');
        });
    });
  });

  overlay.querySelectorAll('.open-link-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.hash = `#/reference-check?token=${btn.dataset.token}`;
      overlay.remove();
    });
  });
}

// ── STATUS ────────────────────────────────────────────────────────
function renderStatus(container) {
  const req = getMyRequest();
  if (!req) {
    _step = 'INTRO';
    render(container);
    return;
  }

  const baseUrl = window.location.origin + window.location.pathname;
  const total = req.referees.length;
  const done  = req.referees.filter(r => r.status === 'completed').length;
  const pct   = total ? Math.round((done / total) * 100) : 0;

  const statusMap = { pending: { label: '대기 중', color: '#F59E0B', bg: '#FFFBEB' }, in_progress: { label: '진행 중', color: '#3B82F6', bg: '#EFF6FF' }, completed: { label: '완료', color: '#059669', bg: '#ECFDF5' } };

  container.innerHTML = `
    <div style="min-height:100vh;background:#F8FAFC;padding-bottom:80px;">
      <div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:52px 20px 32px;color:#fff;">
        <h1 style="margin:0;font-size:20px;font-weight:700;">📋 레퍼런스 체크</h1>
      </div>

      <div style="padding:20px 16px;">
        ${renderStepBar()}

        <!-- 진행률 -->
        <div style="background:#fff;border-radius:10px;padding:18px 16px;border:1px solid #E2E8F0;
                    box-shadow:0 1px 4px rgba(0,0,0,.06);margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <h2 style="margin:0;font-size:15px;font-weight:700;color:#1E293B;">응답 현황</h2>
            <span style="font-size:14px;font-weight:800;color:${pct === 100 ? '#059669' : '#4F46E5'}">${pct}%</span>
          </div>
          <div style="height:8px;background:#E2E8F0;border-radius:4px;overflow:hidden;margin-bottom:8px;">
            <div style="height:100%;width:${pct}%;background:${pct === 100 ? '#059669' : '#4F46E5'};border-radius:4px;transition:width 0.6s;"></div>
          </div>
          <p style="margin:0;font-size:12px;color:#64748B;">${done}/${total}명 응답 완료</p>
        </div>

        <!-- 제공자 목록 -->
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px;">
          ${req.referees.map(r => {
            const st = statusMap[r.status] || statusMap.pending;
            const url = `${baseUrl}#/reference-check?token=${r.token}`;
            return `
              <div style="background:#fff;border-radius:10px;padding:16px;border:1px solid #E2E8F0;
                          box-shadow:0 1px 3px rgba(0,0,0,.05);">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                  <div>
                    <div style="font-size:14px;font-weight:700;color:#1E293B;">${esc(r.name)}</div>
                    <div style="font-size:12px;color:#64748B;">${esc(r.relation)} · ${esc(r.email)}</div>
                  </div>
                  <span style="padding:3px 10px;background:${st.bg};color:${st.color};
                               border-radius:20px;font-size:11px;font-weight:700;flex-shrink:0;">
                    ${r.status === 'completed' ? '✅' : '⏳'} ${st.label}
                  </span>
                </div>
                ${r.status === 'completed'
                  ? `<p style="margin:0;font-size:11px;color:#64748B;">완료: ${new Date(r.submittedAt).toLocaleString('ko-KR', { month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' })}</p>`
                  : `<button class="resend-btn" data-url="${esc(url)}" data-token="${r.token}"
                             style="margin-top:4px;width:100%;padding:8px;background:none;border:1px solid #E2E8F0;
                                    border-radius:6px;font-size:12px;color:#64748B;cursor:pointer;">
                       🔗 링크 재발송 / 열기 (데모)
                     </button>`
                }
              </div>
            `;
          }).join('')}
        </div>

        ${pct === 100 ? `
          <div style="padding:14px;background:#ECFDF5;border:1.5px solid #6EE7B7;border-radius:10px;
                      text-align:center;color:#059669;font-weight:600;font-size:14px;">
            ✅ 모든 레퍼런스 체크가 완료되었습니다! HR 담당자에게 전달됩니다.
          </div>
        ` : ''}
      </div>
    </div>
  `;

  container.querySelectorAll('.resend-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.hash = `#/reference-check?token=${btn.dataset.token}`;
    });
  });
}

// ── Main render ───────────────────────────────────────────────────
function render(container) {
  if (_step === 'INTRO')    renderIntro(container);
  else if (_step === 'CONSENT') renderConsent(container);
  else if (_step === 'REQUEST') renderRequest(container);
  else if (_step === 'STATUS')  renderStatus(container);
}

// ── Public API ────────────────────────────────────────────────────
export async function mount(container) {
  _root = container;

  // If already has a request → go straight to STATUS
  const existing = getMyRequest();
  if (existing && existing.referees?.length > 0) {
    _step = 'STATUS';
  } else {
    _step = 'INTRO';
    _pendingReferees = [{ name: '', relation: '', email: '' }];
  }

  render(container);
}

export function unmount() {
  document.getElementById('links-modal-overlay')?.remove();
  _root = null;
}
