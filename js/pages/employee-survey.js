/**
 * employee-survey.js — 임직원 설문
 * Route: #/employee-survey
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS_SURVEYS   = 'hr_emp_surveys';
const LS_RESPONSES = 'hr_emp_survey_responses';

const DEMO_SURVEYS = [
  {
    id: 'surv_001',
    title: '2026 상반기 직원 만족도 조사',
    desc: '회사 전반의 업무 환경과 복지에 대한 의견을 들려주세요.',
    questions: [
      { id: 'q1', text: '전반적인 업무 만족도를 평가해 주세요', type: 'rating5' },
      { id: 'q2', text: '팀 내 커뮤니케이션은 원활한가요?', type: 'yesno' },
      { id: 'q3', text: '회사 복지 제도에 대한 의견을 자유롭게 적어주세요', type: 'text' },
    ],
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    status: 'active',
    anonymous: true,
  },
  {
    id: 'surv_002',
    title: '원격근무 환경 개선 설문',
    desc: '원격근무 시 불편한 점과 개선 아이디어를 공유해 주세요.',
    questions: [
      { id: 'q1', text: '원격근무 환경에 전반적으로 만족하시나요?', type: 'yesno' },
      { id: 'q2', text: '현재 재택/원격 설비 지원에 만족하는 수준은?', type: 'rating5' },
      { id: 'q3', text: '원격근무에서 가장 불편한 점은 무엇인가요?', type: 'text' },
    ],
    startDate: '2026-06-01',
    endDate: '2026-07-15',
    status: 'active',
    anonymous: false,
  },
  {
    id: 'surv_003',
    title: '2025 하반기 조직문화 설문',
    desc: '조직문화 개선을 위한 설문입니다. 솔직한 의견을 부탁드립니다.',
    questions: [
      { id: 'q1', text: '현재 조직문화에 만족하십니까?', type: 'rating5' },
      { id: 'q2', text: '개선이 필요한 부분을 자유롭게 작성해 주세요', type: 'text' },
    ],
    startDate: '2025-11-01',
    endDate: '2025-11-30',
    status: 'closed',
    anonymous: true,
  },
];

function _loadSurveys() { try { return JSON.parse(localStorage.getItem(LS_SURVEYS) || '[]'); } catch { return []; } }
function _loadResponses() { try { return JSON.parse(localStorage.getItem(LS_RESPONSES) || '[]'); } catch { return []; } }
function _saveResponses(d) { localStorage.setItem(LS_RESPONSES, JSON.stringify(d)); }
function _id() { return 'resp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5); }
function _today() { return new Date().toISOString().slice(0, 10); }
function _session() { try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; } }

function _mergedSurveys() {
  const saved = _loadSurveys();
  return [...DEMO_SURVEYS.filter(d => !saved.find(x => x.id === d.id)), ...saved];
}

let _tab = 'list';
let _activeSurveyId = null;
let _answers = {};

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'list';
  _activeSurveyId = null;
  _answers = {};
  _render(root);
}

export function unmount() { _tab = 'list';}

function _render(root) {
  const session = _session();
  const empId = session.empId || session.userId || session.employee_id || 'EMP001';
  const surveys = _mergedSurveys();
  const responses = _loadResponses().filter(r => r.empId === empId);
  const completedIds = new Set(responses.map(r => r.surveyId));

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="surv-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700;color:var(--text)">📋 임직원 설문</div>
      <div style="font-size:11px;color:var(--text-muted)">참여 완료 ${completedIds.size}건</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['list', '설문 목록'], ['done', '완료한 설문']].map(([k, l]) => `
    <button class="surv-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab === k ? '#4F46E5' : 'transparent'};
             color:${_tab === k ? '#4F46E5' : 'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">
    ${_tab === 'list'
      ? (_activeSurveyId
          ? _renderSurveyForm(surveys.find(s => s.id === _activeSurveyId), empId)
          : _renderSurveyList(surveys, completedIds))
      : _renderCompleted(surveys, responses)}
  </div>
</div>`;

  root.querySelector('#surv-back').addEventListener('click', () => {
    if (_activeSurveyId) { _activeSurveyId = null; _answers = {}; _render(root); }
    else { window.navBack(); }
  });

  root.querySelectorAll('.surv-tab').forEach(b => b.addEventListener('click', () => {
    _tab = b.dataset.tab; _activeSurveyId = null; _answers = {}; _render(root);
  }));

  if (_tab === 'list' && !_activeSurveyId) {
    root.querySelectorAll('.surv-open-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _activeSurveyId = btn.dataset.id;
        _answers = {};
        _render(root);
      });
    });
  }

  if (_activeSurveyId) _bindSurveyForm(root, empId, session);
}

function _renderSurveyList(surveys, completedIds) {
  const active = surveys.filter(s => s.status === 'active');
  if (!active.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">📋</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:6px">참여 가능한 설문이 없습니다</div>
      <button onclick="location.hash='#/employee-survey'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">설문 참여</button>
    
  <div style="font-size:12px">새 설문이 등록되면 알림을 드립니다</div>
</div>`;

  return `<div style="max-width:480px;margin:0 auto">${active.map(s => {
    const done = completedIds.has(s.id);
    return `
<div style="background:var(--card-bg);border:1.5px solid ${done ? '#D1FAE5' : 'var(--border)'};border-radius:14px;padding:16px;margin-bottom:12px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="flex:1">
      <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px">${s.title}</div>
      <div style="font-size:12px;color:var(--text-muted);line-height:1.4">${s.desc}</div>
    </div>
    ${done ? `<span style="margin-left:8px;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;background:#D1FAE5;color:#059669;white-space:nowrap">완료</span>` : ''}
  </div>
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
    <span style="padding:2px 8px;background:#F1F5F9;border-radius:5px;font-size:11px;color:var(--text-muted)">📅 ~${s.endDate}</span>
    <span style="padding:2px 8px;background:#F1F5F9;border-radius:5px;font-size:11px;color:var(--text-muted)">❓ ${s.questions.length}문항</span>
    ${s.anonymous ? `<span style="padding:2px 8px;background:#FEF3C7;border-radius:5px;font-size:11px;color:#D97706">익명</span>` : ''}
  </div>
  <button class="surv-open-btn" data-id="${s.id}"
    ${done ? 'disabled' : ''}
    style="width:100%;padding:10px;border:none;border-radius:10px;
           background:${done ? '#F1F5F9' : '#4F46E5'};
           color:${done ? 'var(--text-muted)' : '#fff'};
           font-size:13px;font-weight:700;cursor:${done ? 'not-allowed' : 'pointer'}">
    ${done ? '이미 참여한 설문입니다' : '참여하기'}
  </button>
</div>`;
  }).join('')}</div>`;
}

function _renderSurveyForm(survey, empId) {
  if (!survey) return '<div style="padding:20px;text-align:center;color:var(--text-muted)">설문을 찾을 수 없습니다</div>';
  return `
<div style="max-width:480px;margin:0 auto">
  <div style="margin-bottom:16px">
    <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:6px">${survey.title}</div>
    <div style="font-size:12px;color:var(--text-muted)">${survey.desc}</div>
  </div>

  ${survey.questions.map((q, i) => `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:12px">
    <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:10px">
      <span style="color:#4F46E5;font-weight:800">Q${i + 1}.</span> ${q.text}
    </div>
    ${q.type === 'rating5' ? `
    <div style="display:flex;gap:8px;justify-content:center" id="rating-group-${q.id}">
      ${[1,2,3,4,5].map(n => `
      <button class="rating-btn" data-qid="${q.id}" data-val="${n}"
        style="width:44px;height:44px;border:2px solid var(--border);border-radius:50%;background:var(--bg);
               font-size:14px;font-weight:700;cursor:pointer;color:var(--text-muted);transition:all 0.15s">
        ${n}
      </button>`).join('')}
    </div>` : ''}
    ${q.type === 'yesno' ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <button class="yesno-btn" data-qid="${q.id}" data-val="yes"
        style="padding:11px;border:2px solid var(--border);border-radius:10px;background:var(--bg);font-size:13px;font-weight:600;cursor:pointer;color:var(--text-muted)">
        👍 네
      </button>
      <button class="yesno-btn" data-qid="${q.id}" data-val="no"
        style="padding:11px;border:2px solid var(--border);border-radius:10px;background:var(--bg);font-size:13px;font-weight:600;cursor:pointer;color:var(--text-muted)">
        👎 아니오
      </button>
    </div>` : ''}
    ${q.type === 'text' ? `
    <textarea maxlength="500" class="text-ans" data-qid="${q.id}" rows="3" placeholder="자유롭게 의견을 작성해 주세요"
      style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--card-bg);color:var(--text);resize:none"></textarea>` : ''}
  </div>`).join('')}

  <button id="surv-submit"
    style="width:100%;padding:13px;border:none;border-radius:12px;background:#4F46E5;color:#fff;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:8px">
    설문 제출하기
  </button>
  <button id="surv-cancel-form"
    style="width:100%;padding:11px;border:1.5px solid var(--border);border-radius:12px;background:transparent;color:var(--text-muted);font-size:13px;font-weight:600;cursor:pointer">
    취소
  </button>
</div>`;
}

function _renderCompleted(surveys, responses) {
  if (!responses.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">✅</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:6px">완료한 설문이 없습니다</div>
  <div style="font-size:12px">설문에 참여해 보세요</div>
</div>`;

  return `<div style="max-width:480px;margin:0 auto">${responses.slice().reverse().map(r => {
    const survey = surveys.find(s => s.id === r.surveyId);
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">
  <div style="display:flex;align-items:center;gap:10px">
    <span style="font-size:24px">✅</span>
    <div style="flex:1">
      <div style="font-size:14px;font-weight:700;color:var(--text)">${survey?.title || '설문'}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:2px">참여일 ${r.submittedAt?.slice(0,10) || ''}· ${r.answers?.length || 0}문항 응답</div>
    </div>
    <span style="padding:3px 9px;border-radius:6px;font-size:11px;font-weight:600;background:#D1FAE5;color:#059669">완료</span>
  </div>
</div>`;
  }).join('')}</div>`;
}

function _bindSurveyForm(root, empId, session) {
  root.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const qid = btn.dataset.qid;
      const val = parseInt(btn.dataset.val);
      _answers[qid] = val;
      root.querySelectorAll(`.rating-btn[data-qid="${qid}"]`).forEach(b => {
        const bv = parseInt(b.dataset.val);
        b.style.background = bv <= val ? '#4F46E5' : 'var(--bg)';
        b.style.color = bv <= val ? '#fff' : 'var(--text-muted)';
        b.style.borderColor = bv <= val ? '#4F46E5' : 'var(--border)';
      });
    });
  });

  root.querySelectorAll('.yesno-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const qid = btn.dataset.qid;
      _answers[qid] = btn.dataset.val;
      root.querySelectorAll(`.yesno-btn[data-qid="${qid}"]`).forEach(b => {
        const active = b.dataset.val === btn.dataset.val;
        b.style.background = active ? '#EEF2FF' : 'var(--bg)';
        b.style.borderColor = active ? '#4F46E5' : 'var(--border)';
        b.style.color = active ? '#4F46E5' : 'var(--text-muted)';
      });
    });
  });

  root.querySelector('#surv-cancel-form')?.addEventListener('click', () => {
    _activeSurveyId = null; _answers = {}; _render(root);
  });

  root.querySelector('#surv-submit')?.addEventListener('click', () => {
    const surveys = _mergedSurveys();
    const survey = surveys.find(s => s.id === _activeSurveyId);
    if (!survey) return;

    const textAnswers = {};
    root.querySelectorAll('.text-ans').forEach(ta => {
      textAnswers[ta.dataset.qid] = ta.value.trim();
    });
    Object.assign(_answers, textAnswers);

    const missing = survey.questions.find(q => {
      const a = _answers[q.id];
      return a === undefined || a === null || a === '';
    });
    if (missing) { showToast('모든 문항에 응답해 주세요.', 'error'); return; }

    const responses = _loadResponses();
    responses.push({
      id: _id(),
      empId,
      empName: survey.anonymous ? '익명' : (session.name || '직원'),
      surveyId: survey.id,
      answers: survey.questions.map(q => ({ qid: q.id, text: q.text, type: q.type, answer: _answers[q.id] })),
      submittedAt: new Date().toISOString(),
    });
    _saveResponses(responses);
    showToast('설문 응답이 제출되었습니다. 감사합니다!', 'success')
    addNotification({ type: 'success', title: '설문 참여', body: '설문 응답이 제출되었습니다. 감사합니다!' });
    _activeSurveyId = null;
    _answers = {};
    _tab = 'done';
    _render(root);
  });
}
