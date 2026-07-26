/**
 * employee-survey-admin.js — 직원 설문 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS_SURVEYS   = 'hr_emp_surveys';
const LS_RESPONSES = 'hr_emp_survey_responses';

const DEMO_SURVEYS = [
  {
    id: 'SRV001',
    title: '2026 상반기 조직문화 만족도 조사',
    description: '상반기 업무 환경 및 조직문화에 대한 의견을 공유해 주세요.',
    questions: ['현재 업무 환경에 만족하시나요?', '팀 내 협업은 원활한가요?', '개선이 필요한 점이 있다면 무엇인가요?'],
    anonymous: true,
    deadline: '2026-06-30',
    status: 'open',
    createdAt: '2026-06-01',
  },
  {
    id: 'SRV002',
    title: '복리후생 제도 개선 의견 수렴',
    description: '현재 복리후생 제도에 대한 여러분의 의견을 들려주세요.',
    questions: ['가장 만족스러운 복리후생은 무엇인가요?', '추가 도입을 희망하는 제도는?', '현재 이용 빈도가 낮은 혜택은?'],
    anonymous: false,
    deadline: '2026-07-15',
    status: 'open',
    createdAt: '2026-06-02',
  },
  {
    id: 'SRV003',
    title: '2025 하반기 직무 만족도 조사',
    description: '직무 관련 만족도를 평가해 주세요.',
    questions: ['현재 맡은 업무가 적성에 맞나요?', '성장 기회가 충분하다고 느끼나요?', '직무 교육이 더 필요한가요?'],
    anonymous: true,
    deadline: '2026-01-31',
    status: 'closed',
    createdAt: '2026-01-01',
  },
];

const LEGACY_RESP_IDS = new Set(['RESP001','RESP002','RESP003','RESP004','RESP005']);

function _loadSurveys() {
  const s = localStorage.getItem(LS_SURVEYS);
  if (!s) { localStorage.setItem(LS_SURVEYS, JSON.stringify(DEMO_SURVEYS)); return DEMO_SURVEYS; }
  try {
    const d = JSON.parse(s);
    return [...DEMO_SURVEYS.filter(dm => !d.find(r => r.id === dm.id)), ...d];
  } catch { return DEMO_SURVEYS; }
}

function _saveSurveys(list) { localStorage.setItem(LS_SURVEYS, JSON.stringify(list)); }

function _loadResponses() {
  const s = localStorage.getItem(LS_RESPONSES);
  if (!s) return [];
  try {
    const d = JSON.parse(s);
    const cleaned = d.filter(r => !LEGACY_RESP_IDS.has(r.id));
    if (cleaned.length < d.length) localStorage.setItem(LS_RESPONSES, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}

function _saveResponses(list) { localStorage.setItem(LS_RESPONSES, JSON.stringify(list)); }

let _tab = '설문 목록';
let _root = null;

export function render(root) { _root = root; _tab = '설문 목록'; _draw(); }
export function unmount() { _root = null;
  _tab = '설문 목록';
}

function _draw() {
  if (!_root) return;
  const surveys   = _loadSurveys().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const responses = _loadResponses().sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
  const openSurveys = surveys.filter(s => s.status === 'open');

  const tabList = ['설문 목록', '응답 현황', '설문 등록'];

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${tabList.map(k => `
    <button class="esa-tab" data-tab="${k}"
      style="padding:10px 18px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab === k ? 'var(--primary)' : 'transparent'};
             color:${_tab === k ? 'var(--primary)' : '#94A3B8'}">${k}</button>`).join('')}
  </div>

  <div style="padding:14px 16px">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
      ${[
        { l: '전체 설문',  v: surveys.length   + '개', c: '#3B82F6' },
        { l: '진행 중',    v: openSurveys.length + '개', c: '#10B981' },
        { l: '총 응답',    v: responses.length + '건', c: '#8B5CF6' },
      ].map(k => `
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
           padding:12px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:${k.c}">${k.v}</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">${k.l}</div>
      </div>`).join('')}
    </div>

    ${_tab === '설문 목록'  ? _renderSurveyList(surveys, responses) :
      _tab === '응답 현황'  ? _renderResponses(responses, surveys) :
      _renderNewSurveyForm()}
  </div>
</div>`;

  _bindEvents();
}

function _renderSurveyList(surveys, responses) {
  if (!surveys.length) return `
  <div style="text-align:center;padding:48px 20px;color:#94A3B8">
    <div style="font-size:40px;margin-bottom:10px">📋</div>
    <div style="font-size:14px;font-weight:600;margin-bottom:4px">등록된 설문이 없습니다</div>
    <div style="font-size:12px">설문 등록 탭에서 새 설문을 만들어보세요</div>
  </div>`;

  return surveys.map(s => {
    const respCount = responses.filter(r => r.surveyId === s.id).length;
    const isOpen    = s.status === 'open';
    return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:14px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
      <div style="flex:1;min-width:0;margin-right:8px">
        <div style="font-size:13px;font-weight:700;color:var(--text);line-height:1.4">${s.title}</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">${s.description}</div>
      </div>
      <span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:10px;
        flex-shrink:0;
        color:${isOpen ? '#059669' : '#64748B'};background:${isOpen ? '#D1FAE5' : '#F1F5F9'}">
        ${isOpen ? '진행 중' : '마감됨'}
      </span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
      <span style="font-size:11px;background:#EFF6FF;color:#1D4ED8;padding:2px 8px;border-radius:8px">
        응답 ${respCount}건
      </span>
      <span style="font-size:11px;color:#94A3B8">${s.anonymous ? '🔒 익명' : '👤 기명'}</span>
      <span style="font-size:11px;color:#94A3B8">마감: ${s.deadline}</span>
    </div>
    ${isOpen ? `
    <button class="esa-close" data-id="${s.id}"
      style="width:100%;background:#FEF3C7;color:#92400E;border:none;border-radius:8px;
             padding:8px;font-size:12px;font-weight:600;cursor:pointer">🔒 설문 마감 처리</button>` : ''}
  </div>`;
  }).join('');
}

function _renderResponses(responses, surveys) {
  if (!responses.length) return `
  <div style="text-align:center;padding:48px 20px;color:#94A3B8">
    <div style="font-size:40px;margin-bottom:10px">📝</div>
    <div style="font-size:14px;font-weight:600;margin-bottom:4px">응답 내역이 없습니다</div>
    <div style="font-size:12px">아직 제출된 설문 응답이 없어요</div>
  </div>`;

  return responses.map(r => {
    const survey = surveys.find(s => s.id === r.surveyId);
    const title  = survey ? survey.title : r.surveyTitle || '(설문 정보 없음)';
    return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:14px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700;color:var(--text);line-height:1.4">${title}</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">
          ${r.anonymous ? '🔒 익명' : `👤 ${r.empName}`} · ${r.submittedAt}
        </div>
      </div>
    </div>
    ${r.answers && r.answers.length ? `
    <div style="margin-top:6px">
      ${r.answers.map((a, i) => `
      <div style="font-size:11px;color:#64748B;margin-bottom:3px">
        <span style="color:#94A3B8">Q${i+1}.</span> ${a}
      </div>`).join('')}
    </div>` : ''}
  </div>`;
  }).join('');
}

function _renderNewSurveyForm() {
  return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px">
    <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px">📋 새 설문 등록</div>

    <div style="margin-bottom:12px">
      <label style="font-size:12px;font-weight:600;color:#64748B;display:block;margin-bottom:4px">설문 제목 *</label>
      <input id="esa-title" type="text" placeholder="설문 제목을 입력하세요"
        style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;
               font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>

    <div style="margin-bottom:12px">
      <label style="font-size:12px;font-weight:600;color:#64748B;display:block;margin-bottom:4px">설문 설명</label>
      <textarea id="esa-desc" placeholder="설문 목적 및 안내 사항을 입력하세요" rows="3"
        style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;
               font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box;resize:vertical"></textarea>
    </div>

    <div style="margin-bottom:12px">
      <label style="font-size:12px;font-weight:600;color:#64748B;display:block;margin-bottom:8px">문항 (최대 3개)</label>
      ${[1,2,3].map(i => `
      <input id="esa-q${i}" type="text" placeholder="문항 ${i}"
        style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;
               font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box;margin-bottom:6px">`).join('')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <div>
        <label style="font-size:12px;font-weight:600;color:#64748B;display:block;margin-bottom:4px">마감일 *</label>
        <input id="esa-deadline" type="date"
          style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;
                 font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
      </div>
      <div style="display:flex;align-items:flex-end;padding-bottom:10px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
          <input id="esa-anonymous" type="checkbox" style="width:16px;height:16px;cursor:pointer">
          <span style="font-size:12px;font-weight:600;color:#64748B">익명 설문</span>
        </label>
      </div>
    </div>

    <button id="esa-submit"
      style="width:100%;background:var(--primary);color:#fff;border:none;border-radius:10px;
             padding:12px;font-size:14px;font-weight:700;cursor:pointer">
      설문 등록하기
    </button>
  </div>`;
}

function _bindEvents() {
  if (!_root) return;

  _root.querySelectorAll('.esa-tab').forEach(b =>
    b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(); }));

  _root.querySelectorAll('.esa-close').forEach(btn =>
    btn.addEventListener('click', () => {
      const list = _loadSurveys();
      const idx  = list.findIndex(s => s.id === btn.dataset.id);
      if (idx >= 0) { list[idx].status = 'closed'; list[idx].closedAt = new Date().toISOString().slice(0,10); _saveSurveys(list); }
      showToast('설문이 마감 처리되었습니다.', 'info');
      _draw();
    }));

  const submitBtn = _root.querySelector('#esa-submit');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const title    = (_root.querySelector('#esa-title')?.value || '').trim();
      const desc     = (_root.querySelector('#esa-desc')?.value || '').trim();
      const q1       = (_root.querySelector('#esa-q1')?.value || '').trim();
      const q2       = (_root.querySelector('#esa-q2')?.value || '').trim();
      const q3       = (_root.querySelector('#esa-q3')?.value || '').trim();
      const deadline = (_root.querySelector('#esa-deadline')?.value || '').trim();
      const anon     = _root.querySelector('#esa-anonymous')?.checked || false;

      if (!title) { showToast('설문 제목을 입력해주세요.', 'error'); return; }
      if (!deadline) { showToast('마감일을 선택해주세요.', 'error'); return; }
      const questions = [q1, q2, q3].filter(q => q.length > 0);
      if (!questions.length) { showToast('문항을 1개 이상 입력해주세요.', 'error'); return; }

      const list = _loadSurveys();
      const newSurvey = {
        id: 'SRV' + Date.now(),
        title,
        description: desc,
        questions,
        anonymous: anon,
        deadline,
        status: 'open',
        createdAt: new Date().toISOString().slice(0,10),
      };
      list.push(newSurvey);
      _saveSurveys(list);
      showToast('설문이 등록되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Employee Survey (관리자)', body: '설문이 등록되었습니다.' });
      _tab = '설문 목록';
      _draw();
    });
  }
}
export function mount(root) { return render(root); }
