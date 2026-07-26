/**
 * reference_check.js – Reference Check Respondent Page (No Login Required)
 * Route: #/reference-check?token=...
 * Steps: CONFIRM → SURVEY → REVIEW → SUBMITTED
 * HR Competency OS — Phase 3
 */

let _root  = null;
let _step  = 'CONFIRM';
let _token = null;
let _req   = null;
let _ref   = null;
let _answers = {};

const LS_ALL      = 'hr_ref_requests';
const LS_PROGRESS = (token) => `hr_ref_progress_${token}`;

// ── Questions ─────────────────────────────────────────────────────
const QUESTIONS = [
  { id: 'Q_REL',         type: 'select',   label: '신청인과의 관계',
    options: ['직속 상사', '동료', '부하직원', '외부 협력사/파트너', '기타'] },
  { id: 'Q_TENURE',      type: 'select',   label: '함께 일한 기간',
    options: ['6개월 미만', '6개월~1년', '1~2년', '2~3년', '3년 이상'] },
  { id: 'Q_PERFORM',     type: 'scale5',   label: '전반적인 직무 능력을 평가해주세요.',
    note: '1점(매우 미흡) ~ 5점(매우 우수)' },
  { id: 'Q_STRENGTH',    type: 'textarea', label: '가장 두드러진 강점을 구체적인 사례와 함께 설명해주세요.',
    placeholder: '예: "데이터 기반 의사결정을 잘하며, OO 프로젝트에서 ..."' },
  { id: 'Q_COMM',        type: 'scale5',   label: '소통 및 팀 협업 능력을 평가해주세요.',
    note: '1점(매우 미흡) ~ 5점(매우 우수)' },
  { id: 'Q_COMM_DESC',   type: 'textarea', label: '소통/협업 스타일을 좀 더 설명해주세요.',
    placeholder: '의사소통 방식, 갈등 해결 방식 등을 포함해주세요.' },
  { id: 'Q_LEAD',        type: 'scale5',   label: '리더십 및 주도성을 평가해주세요.',
    note: '1점(매우 미흡) ~ 5점(매우 우수)' },
  { id: 'Q_TRUST',       type: 'scale5',   label: '신뢰도·성실성을 평가해주세요.',
    note: '1점(매우 미흡) ~ 5점(매우 우수)' },
  { id: 'Q_IMPROVE',     type: 'textarea', label: '개선이 필요하다고 생각하는 점을 솔직하게 알려주세요.',
    placeholder: '건설적인 피드백은 지원자의 성장에 도움이 됩니다.' },
  { id: 'Q_REHIRE',      type: 'yesno',    label: '기회가 된다면 다시 함께 일하고 싶으신가요?' },
  { id: 'Q_REHIRE_REASON', type: 'textarea', label: '위 답변에 대한 이유를 간략히 설명해주세요.',
    placeholder: '간략히 설명해주세요.' },
  { id: 'Q_COMMENT',     type: 'textarea', label: '추가로 공유하고 싶은 내용이 있으시면 자유롭게 작성해주세요.',
    placeholder: '(선택 사항)', optional: true },
];

const REQUIRED_IDS = QUESTIONS.filter(q => !q.optional).map(q => q.id);

// ── Helpers ───────────────────────────────────────────────────────
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getToken() {
  try {
    const search = window.location.hash.split('?')[1] || '';
    return new URLSearchParams(search).get('token');
  } catch { return null; }
}

function lookupToken(token) {
  try {
    const all = JSON.parse(localStorage.getItem(LS_ALL) || '[]');
  if (!all || !all.length) { root.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:40px;margin-bottom:10px">🔍</div><div style="font-size:14px;font-weight:600;margin-bottom:4px">레퍼런스 체크 내역이 없습니다.</div></div>`; return; }
    for (const req of all) {
      const ref = (req.referees || []).find(r => r.token === token);
      if (ref) return { req, ref };
    }
  } catch {}
  return null;
}

function saveProgress() {
  if (!_token) return;
  try { localStorage.setItem(LS_PROGRESS(_token), JSON.stringify(_answers)); } catch {}
}

function loadProgress() {
  if (!_token) return;
  try {
    const saved = localStorage.getItem(LS_PROGRESS(_token));
    if (saved) _answers = { ...JSON.parse(saved), ..._answers };
  } catch {}
}

function submitAnswers() {
  try {
    const all = JSON.parse(localStorage.getItem(LS_ALL) || '[]');
    const reqIdx = all.findIndex(r => r.id === _req.id);
    if (reqIdx < 0) return;
    const refIdx = all[reqIdx].referees.findIndex(r => r.token === _token);
    if (refIdx < 0) return;
    all[reqIdx].referees[refIdx].status      = 'completed';
    all[reqIdx].referees[refIdx].submittedAt = new Date().toISOString();
    all[reqIdx].referees[refIdx].responses   = { ..._answers };
    localStorage.setItem(LS_ALL, JSON.stringify(all));

    // Also update hr_ref_my_request if same applicant
    try {
      const mine = JSON.parse(localStorage.getItem('hr_ref_my_request') || 'null');
      if (mine && mine.id === _req.id) {
        mine.referees[refIdx] = all[reqIdx].referees[refIdx];
        localStorage.setItem('hr_ref_my_request', JSON.stringify(mine));
      }
    } catch {}

    // Clear progress
    localStorage.removeItem(LS_PROGRESS(_token));

    // Push notification for applicant: referee completed
    try {
      const notifs = JSON.parse(localStorage.getItem('hr_notifications') || '[]');
      const refName = _ref.name || '추천인';
      notifs.unshift({
        id: `NOTIF_REF_${Date.now()}`,
        type: 'system',
        title: `${refName}님이 레퍼런스 체크를 완료했습니다`,
        body: '레퍼런스 탭에서 진행 현황을 확인하세요.',
        route: '#/applicant/reference',
        read: false,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('hr_notifications', JSON.stringify(notifs));
    } catch {}
  } catch (e) { console.error('[RefCheck] submit error:', e); }
}

// ── CONFIRM step ──────────────────────────────────────────────────
function renderConfirm(container) {
  container.innerHTML = `
    <div style="min-height:100vh;background:#F8FAFC;display:flex;flex-direction:column;">
      <div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:52px 20px 36px;color:#fff;">
        <p style="margin:0 0 6px;font-size:13px;opacity:0.8;">레퍼런스 체크 요청</p>
        <h1 style="margin:0;font-size:22px;font-weight:700;">📋 평판 조회 설문</h1>
      </div>

      <div style="padding:24px 16px;flex:1;">
        <div style="background:var(--card-bg);border-radius:12px;padding:20px;border:1px solid #E2E8F0;
                    box-shadow:0 2px 8px rgba(0,0,0,.08);margin-bottom:20px;">
          <div style="text-align:center;margin-bottom:18px;">
            <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#4F46E5,#7C3AED);
                        display:inline-flex;align-items:center;justify-content:center;
                        font-size:28px;margin-bottom:12px;">📋</div>
            <h2 style="margin:0 0 6px;font-size:18px;font-weight:700;color:#1E293B;">레퍼런스 체크 요청</h2>
          </div>

          <div style="padding:14px;background:#EEF2FF;border-radius:8px;margin-bottom:16px;">
            <p style="margin:0 0 4px;font-size:12px;color:#6366F1;font-weight:500;">요청인</p>
            <p style="margin:0;font-size:16px;font-weight:700;color:#4F46E5;">${esc(_req.applicantName)}</p>
            <p style="margin:4px 0 0;font-size:12px;color:var(--text-muted);">${esc(_req.jobTitle)} 지원</p>
          </div>

          <div style="padding:14px;background:#F8FAFC;border-radius:8px;margin-bottom:16px;border:1px solid #E2E8F0;">
            <p style="margin:0 0 4px;font-size:12px;color:var(--text-muted);font-weight:500;">응답자</p>
            <p style="margin:0;font-size:15px;font-weight:700;color:#1E293B;">${esc(_ref.name)}</p>
            <p style="margin:2px 0 0;font-size:12px;color:var(--text-muted);">${esc(_ref.relation)}</p>
          </div>

          <p style="margin:0 0 16px;font-size:13px;color:#475569;line-height:1.7;">
            <strong>${esc(_req.applicantName)}</strong>님이 귀하께 직업 역량에 대한 레퍼런스 체크를 요청했습니다.
            모든 응답은 <strong>익명으로 처리</strong>되며 채용 담당자만 열람합니다.
          </p>

          <div style="display:flex;align-items:center;gap:8px;padding:10px;background:#FFFBEB;
                      border-radius:8px;border:1px solid #FDE68A;margin-bottom:4px;">
            <span>⏱️</span>
            <span style="font-size:12px;color:#92400E;">예상 소요 시간: 약 10분 · 총 ${QUESTIONS.length}문항</span>
          </div>
        </div>

        <button id="start-survey-btn"
               style="width:100%;padding:16px;background:#4F46E5;color:#fff;border:none;
                      border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;
                      box-shadow:0 3px 10px rgba(79,70,229,0.35);">
          시작하기 →
        </button>

        <p style="text-align:center;margin-top:12px;font-size:11px;color:var(--text-muted);">
          응답 내용은 자동 저장됩니다
        </p>
      </div>
    </div>
  `;

  container.querySelector('#start-survey-btn').addEventListener('click', () => {
    _step = 'SURVEY';
    render(container);
  });
}

// ── SURVEY step ───────────────────────────────────────────────────
function renderSurvey(container) {
  const answered = REQUIRED_IDS.filter(id => _answers[id] !== undefined && _answers[id] !== '').length;
  const pct = Math.round((answered / REQUIRED_IDS.length) * 100);

  const questionsHtml = QUESTIONS.map((q, idx) => {
    let inputHtml = '';
    const val = _answers[q.id];

    if (q.type === 'select') {
      inputHtml = `
        <select class="ref-input" data-qid="${q.id}"
                style="width:100%;padding:10px 12px;border:1.5px solid ${val ? '#4F46E5' : '#E2E8F0'};
                       border-radius:8px;font-size:13px;color:${val ? '#1E293B' : 'var(--text-muted)'};
                       background:var(--card-bg);outline:none;appearance:none;">
          <option value="">선택해주세요</option>
          ${q.options.map(o => `<option value="${esc(o)}" ${val === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}
        </select>`;
    } else if (q.type === 'scale5') {
      inputHtml = `
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
          ${[1,2,3,4,5].map(n => `
            <button class="scale-btn" data-qid="${q.id}" data-val="${n}"
                    style="width:52px;height:52px;border-radius:12px;border:2px solid ${val === n ? '#4F46E5' : '#E2E8F0'};
                           background:${val === n ? '#4F46E5' : '#fff'};color:${val === n ? '#fff' : 'var(--text-muted)'};
                           font-size:16px;font-weight:700;cursor:pointer;transition:all 0.15s;flex-shrink:0;">
              ${n}
            </button>`).join('')}
        </div>
        ${q.note ? `<p style="margin:6px 0 0;font-size:11px;color:var(--text-muted);text-align:center;">${esc(q.note)}</p>` : ''}`;
    } else if (q.type === 'yesno') {
      inputHtml = `
        <div style="display:flex;gap:10px;">
          <button class="yesno-btn" data-qid="${q.id}" data-val="yes"
                  style="flex:1;padding:14px;border-radius:10px;border:2px solid ${val === 'yes' ? '#059669' : '#E2E8F0'};
                         background:${val === 'yes' ? '#ECFDF5' : '#fff'};color:${val === 'yes' ? '#059669' : 'var(--text-muted)'};
                         font-size:15px;font-weight:700;cursor:pointer;transition:all 0.15s;">
            예 👍
          </button>
          <button class="yesno-btn" data-qid="${q.id}" data-val="no"
                  style="flex:1;padding:14px;border-radius:10px;border:2px solid ${val === 'no' ? '#EF4444' : '#E2E8F0'};
                         background:${val === 'no' ? '#FEF2F2' : '#fff'};color:${val === 'no' ? '#EF4444' : 'var(--text-muted)'};
                         font-size:15px;font-weight:700;cursor:pointer;transition:all 0.15s;">
            아니요 👎
          </button>
        </div>`;
    } else if (q.type === 'textarea') {
      inputHtml = `
        <textarea maxlength="500" class="ref-input" data-qid="${q.id}" rows="3"
                  placeholder="${esc(q.placeholder || '')}"
                  style="width:100%;padding:10px 12px;border:1.5px solid ${val ? '#4F46E5' : '#E2E8F0'};
                         border-radius:8px;font-size:13px;color:#1E293B;
                         box-sizing:border-box;resize:vertical;min-height:80px;outline:none;
                         line-height:1.6;">${esc(val || '')}</textarea>`;
    }

    return `
      <div class="q-card" id="qcard-${q.id}"
           style="background:var(--card-bg);border-radius:10px;padding:18px 16px;
                  border:1.5px solid ${val !== undefined && val !== '' ? '#C7D2FE' : '#E2E8F0'};
                  box-shadow:0 1px 4px rgba(0,0,0,.05);margin-bottom:12px;">
        <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:12px;">
          <span style="width:22px;height:22px;border-radius:50%;background:#4F46E5;color:#fff;
                       font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;
                       flex-shrink:0;margin-top:1px;">${idx + 1}</span>
          <div>
            <p style="margin:0;font-size:13px;font-weight:600;color:#1E293B;line-height:1.5;">${esc(q.label)}</p>
            ${q.optional ? '<span style="font-size:10px;color:var(--text-muted);">(선택)</span>' : ''}
          </div>
        </div>
        ${inputHtml}
        <div class="q-error" id="qerr-${q.id}" style="display:none;margin-top:6px;font-size:11px;color:#EF4444;">
          ⚠ 필수 항목입니다.
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div style="min-height:100vh;background:#F8FAFC;padding-bottom:100px;">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:52px 20px 20px;color:#fff;">
        <h1 style="margin:0 0 12px;font-size:18px;font-weight:700;">📋 레퍼런스 설문</h1>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="flex:1;height:6px;background:rgba(255,255,255,0.3);border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:var(--card-bg);border-radius:3px;transition:width 0.4s;"></div>
          </div>
          <span style="font-size:12px;font-weight:700;min-width:36px;text-align:right;">${pct}%</span>
        </div>
        <p style="margin:6px 0 0;font-size:11px;opacity:0.75;">${answered}/${REQUIRED_IDS.length} 필수 항목 응답</p>
      </div>

      <div style="padding:16px 16px 0;">
        <div style="padding:10px 14px;background:#EEF2FF;border-radius:8px;border:1px solid #C7D2FE;
                    margin-bottom:16px;font-size:12px;color:#4F46E5;">
          💡 <strong>${esc(_req.applicantName)}</strong>님에 대한 솔직한 의견을 주시면 큰 도움이 됩니다.
        </div>

        ${questionsHtml}

        <button id="go-review-btn"
               style="width:100%;padding:15px;background:#4F46E5;color:#fff;border:none;
                      border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;
                      box-shadow:0 3px 10px rgba(79,70,229,0.3);margin-top:4px;">
          답변 확인하기 →
        </button>
      </div>
    </div>
  `;

  // Bind input events
  container.querySelectorAll('.ref-input').forEach(el => {
    el.addEventListener('input', e => {
      _answers[e.target.dataset.qid] = e.target.value;
      saveProgress();
      document.getElementById(`qcard-${e.target.dataset.qid}`)?.style.setProperty('border-color', e.target.value ? '#C7D2FE' : '#E2E8F0');
    });
    el.addEventListener('change', e => {
      _answers[e.target.dataset.qid] = e.target.value;
      saveProgress();
    });
  });

  container.querySelectorAll('.scale-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const qid = btn.dataset.qid;
      const val = Number(btn.dataset.val);
      _answers[qid] = val;
      saveProgress();
      container.querySelectorAll(`.scale-btn[data-qid="${qid}"]`).forEach(b => {
        const sel = Number(b.dataset.val) === val;
        b.style.background   = sel ? '#4F46E5' : '#fff';
        b.style.color        = sel ? '#fff'    : 'var(--text-muted)';
        b.style.borderColor  = sel ? '#4F46E5' : '#E2E8F0';
      });
      document.getElementById(`qcard-${qid}`)?.style.setProperty('border-color', '#C7D2FE');
    });
  });

  container.querySelectorAll('.yesno-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const qid = btn.dataset.qid;
      const val = btn.dataset.val;
      _answers[qid] = val;
      saveProgress();
      container.querySelectorAll(`.yesno-btn[data-qid="${qid}"]`).forEach(b => {
        const isYes = b.dataset.val === 'yes';
        const sel   = b.dataset.val === val;
        b.style.borderColor  = sel ? (isYes ? '#059669' : '#EF4444') : '#E2E8F0';
        b.style.background   = sel ? (isYes ? '#ECFDF5' : '#FEF2F2') : '#fff';
        b.style.color        = sel ? (isYes ? '#059669' : '#EF4444') : 'var(--text-muted)';
      });
      document.getElementById(`qcard-${qid}`)?.style.setProperty('border-color', '#C7D2FE');
    });
  });

  container.querySelector('#go-review-btn').addEventListener('click', () => {
    // Check required fields
    let hasError = false;
    QUESTIONS.filter(q => !q.optional).forEach(q => {
      const err = container.querySelector(`#qerr-${q.id}`);
      const val = _answers[q.id];
      const missing = val === undefined || val === '';
      if (err) err.style.display = missing ? 'block' : 'none';
      if (missing) hasError = true;
    });
    if (hasError) {
      // Scroll to first error
      const firstErr = container.querySelector('.q-error[style*="block"]');
      firstErr?.closest('.q-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    _step = 'REVIEW';
    render(container);
  });
}

// ── REVIEW step ───────────────────────────────────────────────────
function renderReview(container) {
  const SCALE_LABELS = ['', '매우 미흡', '미흡', '보통', '우수', '매우 우수'];

  function displayVal(q) {
    const v = _answers[q.id];
    if (v === undefined || v === '') return q.optional ? '<em style="color:var(--text-muted)">(미응답)</em>' : '<span style="color:#EF4444">미응답</span>';
    if (q.type === 'scale5') return `${v}점 (${SCALE_LABELS[v] || ''})`;
    if (q.type === 'yesno')  return v === 'yes' ? '예 👍' : '아니요 👎';
    return esc(String(v));
  }

  container.innerHTML = `
    <div style="min-height:100vh;background:#F8FAFC;padding-bottom:100px;">
      <div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:52px 20px 28px;color:#fff;">
        <h1 style="margin:0 0 6px;font-size:18px;font-weight:700;">📋 답변 확인</h1>
        <p style="margin:0;font-size:13px;opacity:0.8;">제출 전 내용을 검토해주세요</p>
      </div>

      <div style="padding:16px 16px 0;">
        <div style="background:var(--card-bg);border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0;
                    box-shadow:0 1px 4px rgba(0,0,0,.05);margin-bottom:14px;">
          <p style="margin:0 0 2px;font-size:12px;color:var(--text-muted);">대상자</p>
          <p style="margin:0;font-size:15px;font-weight:700;color:#4F46E5;">${esc(_req.applicantName)}</p>
        </div>

        ${QUESTIONS.map((q, idx) => `
          <div style="background:var(--card-bg);border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0;
                      box-shadow:0 1px 3px rgba(0,0,0,.04);margin-bottom:10px;">
            <p style="margin:0 0 4px;font-size:11px;color:var(--text-muted);font-weight:600;">Q${idx + 1}${q.optional ? ' (선택)' : ''}</p>
            <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#1E293B;">${esc(q.label)}</p>
            <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">${displayVal(q)}</p>
          </div>
        `).join('')}

        <div style="display:flex;gap:10px;margin-top:8px;">
          <button id="back-to-survey-btn"
                  style="flex:1;padding:14px;background:var(--card-bg);color:#4F46E5;border:2px solid #4F46E5;
                         border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;">
            ✏️ 수정하기
          </button>
          <button id="submit-ref-btn"
                  style="flex:2;padding:14px;background:#4F46E5;color:#fff;border:none;
                         border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;
                         box-shadow:0 3px 10px rgba(79,70,229,0.3);">
            제출하기 →
          </button>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#back-to-survey-btn').addEventListener('click', () => {
    _step = 'SURVEY';
    render(container);
  });

  container.querySelector('#submit-ref-btn').addEventListener('click', () => {
    submitAnswers();
    _step = 'SUBMITTED';
    render(container);
  });
}

// ── SUBMITTED step ────────────────────────────────────────────────
function renderSubmitted(container) {
  container.innerHTML = `
    <div style="min-height:100vh;background:#F8FAFC;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px 60px;">

      <!-- Success icon -->
      <div style="width:88px;height:88px;border-radius:50%;background:linear-gradient(135deg,#059669,#10B981);
                  display:flex;align-items:center;justify-content:center;font-size:40px;
                  box-shadow:0 8px 24px rgba(5,150,105,0.35);margin-bottom:28px;">
        ✅
      </div>

      <h1 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#1E293B;text-align:center;">감사합니다!</h1>
      <p style="margin:0 0 6px;font-size:15px;color:#475569;text-align:center;line-height:1.7;">
        응답이 성공적으로 제출되었습니다.
      </p>
      <p style="margin:0 0 32px;font-size:13px;color:var(--text-muted);text-align:center;line-height:1.7;">
        HR 담당자에게 안전하게 전달됩니다.<br>
        소중한 시간을 내주셔서 감사합니다. 🙏
      </p>

      <!-- Action buttons -->
      <div style="display:flex;flex-direction:column;gap:12px;width:100%;max-width:320px;margin-bottom:32px;">
        <a href="https://www.naver.com" target="_blank" rel="noopener"
           style="display:block;padding:15px 20px;background:linear-gradient(135deg,#4F46E5,#7C3AED);
                  color:#fff;border-radius:12px;text-align:center;text-decoration:none;
                  font-size:15px;font-weight:700;box-shadow:0 4px 14px rgba(79,70,229,0.35);">
          🏠 홈페이지 둘러보기
        </a>
        <button id="close-window-btn"
                style="padding:13px 20px;background:var(--card-bg);color:var(--text-muted);border:1.5px solid #E2E8F0;
                       border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;width:100%;">
          ✕ 창 닫기
        </button>
      </div>

      <!-- Promo card -->
      <div style="background:var(--card-bg);border-radius:14px;border:1.5px solid #E2E8F0;padding:18px 20px;max-width:320px;width:100%;
                  box-shadow:0 2px 12px rgba(0,0,0,0.05);">
        <div style="font-size:0.72rem;font-weight:700;color:#4F46E5;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px;">
          HR Competency OS
        </div>
        <p style="margin:0 0 12px;font-size:13px;color:#475569;line-height:1.65;">
          AI 기반 역량 평가 · OKR 관리 · 성장 트래킹을 한 곳에서. 우리 플랫폼에 대해 더 알고 싶으시다면 아래 링크를 방문해 보세요.
        </p>
        <a href="https://www.naver.com" target="_blank" rel="noopener"
           style="font-size:13px;font-weight:600;color:#4F46E5;text-decoration:none;
                  display:flex;align-items:center;gap:4px;">
          자세히 알아보기 →
        </a>
      </div>

    </div>
  `;

  container.querySelector('#close-window-btn')?.addEventListener('click', () => {
    if (window.history.length > 1) {
      window.navBack();
    } else {
      window.close();
    }
  });
}

// ── INVALID TOKEN ─────────────────────────────────────────────────
function renderInvalid(container) {
  container.innerHTML = `
    <div style="min-height:100vh;background:#F8FAFC;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;">
      <div style="font-size:56px;margin-bottom:20px;">🔗</div>
      <h2 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#1E293B;text-align:center;">유효하지 않은 링크입니다</h2>
      <p style="margin:0;font-size:14px;color:var(--text-muted);text-align:center;line-height:1.7;">
        링크가 만료되었거나 잘못된 URL입니다.<br>
        요청자에게 새로운 링크를 요청해주세요.
      </p>
    </div>
  `;
}

// ── ALREADY SUBMITTED ─────────────────────────────────────────────
function renderAlreadyDone(container) {
  container.innerHTML = `
    <div style="min-height:100vh;background:#F8FAFC;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px 60px;">
      <div style="font-size:60px;margin-bottom:20px;">✅</div>
      <h2 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#1E293B;text-align:center;">이미 제출하셨습니다</h2>
      <p style="margin:0 0 28px;font-size:14px;color:var(--text-muted);text-align:center;line-height:1.7;">
        레퍼런스 체크 설문이 이미 완료되었습니다.<br>
        소중한 시간을 내주셔서 감사합니다. 🙏
      </p>
      <div style="display:flex;flex-direction:column;gap:12px;width:100%;max-width:320px;">
        <a href="https://www.naver.com" target="_blank" rel="noopener"
           style="display:block;padding:14px 20px;background:linear-gradient(135deg,#4F46E5,#7C3AED);
                  color:#fff;border-radius:12px;text-align:center;text-decoration:none;
                  font-size:14px;font-weight:700;box-shadow:0 4px 14px rgba(79,70,229,0.3);">
          🏠 홈페이지 둘러보기
        </a>
        <button id="close-done-btn"
                style="padding:12px 20px;background:var(--card-bg);color:var(--text-muted);border:1.5px solid #E2E8F0;
                       border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;width:100%;">
          ✕ 창 닫기
        </button>
      </div>
    </div>
  `;

  container.querySelector('#close-done-btn')?.addEventListener('click', () => {
    if (window.history.length > 1) window.navBack();
    else window.close();
  });
}

// ── Main render ───────────────────────────────────────────────────
function render(container) {
  container.scrollTo?.(0, 0);
  window.scrollTo(0, 0);
  if (_step === 'CONFIRM')   renderConfirm(container);
  else if (_step === 'SURVEY')    renderSurvey(container);
  else if (_step === 'REVIEW')    renderReview(container);
  else if (_step === 'SUBMITTED') renderSubmitted(container);
}

// ── Public API ────────────────────────────────────────────────────
export async function mount(container) {
  _root = container;
  _token = getToken();

  if (!_token) { renderInvalid(container); return; }

  const found = lookupToken(_token);
  if (!found) { renderInvalid(container); return; }

  _req = found.req;
  _ref = found.ref;

  if (_ref.status === 'completed') { renderAlreadyDone(container); return; }

  // Load any saved progress
  try {
    const saved = localStorage.getItem(LS_PROGRESS(_token));
    _answers = saved ? JSON.parse(saved) : {};
  } catch { _answers = {}; }

  _step = 'CONFIRM';
  render(container);
}

export function unmount() {
  _root = null;
  _answers = {};
}
