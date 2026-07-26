/**
 * survey-builder.js — 커스텀 설문 빌더 (관리자)
 */

import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS_SURVEYS  = 'hr_surveys';
const LS_ANSWERS  = 'hr_survey_answers';

const Q_TYPES = [
  { key:'text',   label:'주관식',   icon:'✏️' },
  { key:'radio',  label:'단일 선택', icon:'🔘' },
  { key:'check',  label:'다중 선택', icon:'☑️' },
  { key:'scale',  label:'척도 (1-5)', icon:'📊' },
];

const DEMO_SURVEYS = [
  {
    id:'SVY001', title:'2026 상반기 조직 문화 설문', status:'closed', createdAt:'2026-01-15',
    deadline:'2026-01-31', respondents:42, total:50,
    questions:[
      { id:'q1', type:'scale', text:'전반적인 직장 만족도는 어느 정도입니까?', required:true, options:[] },
      { id:'q2', type:'radio', text:'가장 개선이 필요한 영역은?', required:true, options:['소통','복지','업무 환경','성장 기회','보상'] },
      { id:'q3', type:'text',  text:'조직 문화 개선을 위한 제안 사항을 자유롭게 작성해 주세요.', required:false, options:[] },
    ],
  },
  {
    id:'SVY002', title:'2026 하반기 업무 환경 설문', status:'active', createdAt:'2026-06-01',
    deadline:'2026-06-30', respondents:18, total:50,
    questions:[
      { id:'q1', type:'scale', text:'재택근무 제도에 대한 만족도는?', required:true, options:[] },
      { id:'q2', type:'check', text:'선호하는 근무 형태를 모두 선택해 주세요.', required:true, options:['전일 사무실','전일 재택','하이브리드(주 2-3일 재택)','탄력 근무'] },
    ],
  },
];

const LEGACY_ANSWER_EMP_IDS = new Set(['EMP001','EMP002']);

function _getSurveys() {
  const s = localStorage.getItem(LS_SURVEYS);
  if (!s) { localStorage.setItem(LS_SURVEYS, JSON.stringify(DEMO_SURVEYS)); return DEMO_SURVEYS; }
  try { return JSON.parse(s); } catch { return DEMO_SURVEYS; }
}
function _saveSurveys(l) { localStorage.setItem(LS_SURVEYS, JSON.stringify(l)); }

function _getAnswers() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_ANSWERS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_ANSWER_EMP_IDS.has(r.empId));
    if (cleaned.length !== list.length) localStorage.setItem(LS_ANSWERS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}

let _view   = 'list';   // 'list' | 'create' | 'results'
let _active = null;
let _draft  = { title:'', deadline:'', questions:[] };

export function render(root) { _renderPage(root); }
export function unmount() { _view = 'list'; _active = null; _draft = { title:'', deadline:'', questions:[] }; }

function _renderPage(root) {
  if (_view === 'create')  { _renderCreate(root); return; }
  if (_view === 'results') { _renderResults(root); return; }
  _renderList(root);
}

function _renderList(root) {
  const surveys = _getSurveys();
  if (!surveys.length) { root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:48px;margin-bottom:12px">📋</div><div style="font-size:14px;font-weight:600;margin-bottom:6px">설문이 없습니다.</div><div style="font-size:12px">데이터가 축적되면 자동으로 표시됩니다.</div></div>`; return; }
  const answers = _getAnswers();
  const active  = surveys.filter(s => s.status === 'active').length;

  root.innerHTML = `
<div style="padding:16px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
    <div style="font-size:15px;font-weight:700">📋 설문 관리</div>
    <button id="create-btn" style="background:#4F46E5;color:#fff;border:none;border-radius:10px;
      padding:7px 12px;font-size:12px;font-weight:600;cursor:pointer">+ 설문 생성</button>
  </div>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
    ${[
      { label:'전체 설문', value:surveys.length+'개',  color:'#4F46E5' },
      { label:'진행 중',   value:active+'개',           color:'#10B981' },
      { label:'총 응답',   value:answers.length+'건',   color:'#3B82F6' },
    ].map(k=>`
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
         padding:10px;text-align:center">
      <div style="font-size:18px;font-weight:800;color:${k.color}">${k.value}</div>
      <div style="font-size:10px;color:#64748B;margin-top:2px">${k.label}</div>
    </div>`).join('')}
  </div>

  ${surveys.map(sv => {
    const pct = sv.total ? Math.round((sv.respondents/sv.total)*100) : 0;
    return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:14px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--text)">${sv.title}</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">마감: ${sv.deadline} · 문항 ${sv.questions.length}개</div>
      </div>
      <span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:10px;flex-shrink:0;margin-left:8px;
        color:${sv.status==='active'?'#10B981':'#94A3B8'};
        background:${sv.status==='active'?'#D1FAE5':'#F1F5F9'}">
        ${sv.status==='active'?'진행 중':'완료'}
      </span>
    </div>
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#94A3B8;margin-bottom:4px">
        <span>응답률</span><span>${sv.respondents}/${sv.total}명 (${pct}%)</span>
      </div>
      <div style="background:#E2E8F0;border-radius:99px;height:5px">
        <div style="background:${pct>=80?'#10B981':pct>=50?'#3B82F6':'#F59E0B'};height:5px;border-radius:99px;width:${pct}%"></div>
      </div>
    </div>
    <div style="display:flex;gap:6px">
      <button class="results-btn" data-id="${sv.id}"
        style="flex:1;background:#EEF2FF;color:#4338CA;border:none;border-radius:8px;
               padding:7px;font-size:12px;font-weight:600;cursor:pointer">📊 결과 보기</button>
      ${sv.status==='active' ? `
      <button class="close-btn" data-id="${sv.id}"
        style="background:#FEE2E2;color:#DC2626;border:none;border-radius:8px;
               padding:7px 12px;font-size:12px;font-weight:600;cursor:pointer">마감</button>` : ''}
    </div>
  </div>`;
  }).join('')}
</div>`;

  root.querySelector('#create-btn').addEventListener('click', () => {
    _draft = { title:'', deadline:'', questions:[] };
    _view = 'create';
    _renderPage(root);
  });

  root.querySelectorAll('.results-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _active = _getSurveys().find(s => s.id === btn.dataset.id);
      _view = 'results';
      _renderPage(root);
    });
  });

  root.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const list = _getSurveys();
      const idx  = list.findIndex(s => s.id === btn.dataset.id);
      if (idx >= 0) { list[idx].status = 'closed'; _saveSurveys(list); }
      showToast('설문이 마감되었습니다.', 'info');
      _renderPage(root);
    });
  });
}

function _renderCreate(root) {
  root.innerHTML = `
<div style="padding:16px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
    <button id="back-btn" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text)">←</button>
    <div style="font-size:15px;font-weight:700">📋 설문 생성</div>
  </div>

  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
    <div style="margin-bottom:10px">
      <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">설문 제목</label>
      <input id="sv-title" type="text" placeholder="예: 2026 하반기 직원 만족도 조사" value="${_draft.title}"
        style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
               font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
    <div>
      <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">응답 마감일</label>
      <input id="sv-deadline" type="date" value="${_draft.deadline}"
        style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
               font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
  </div>

  <!-- 문항 목록 -->
  <div id="questions-container">
    ${_draft.questions.map((q,i) => _renderQCard(q, i)).join('')}
  </div>

  <!-- 문항 추가 -->
  <div style="background:var(--card-bg);border:1.5px dashed var(--border);border-radius:14px;padding:12px;margin-bottom:10px">
    <div style="font-size:12px;font-weight:700;color:#64748B;margin-bottom:8px">+ 문항 추가</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px">
      ${Q_TYPES.map(t=>`
      <button class="add-q-btn" data-type="${t.key}"
        style="padding:8px;background:var(--bg);border:1.5px solid var(--border);border-radius:10px;
               font-size:12px;font-weight:600;cursor:pointer;color:var(--text)">
        ${t.icon} ${t.label}
      </button>`).join('')}
    </div>
  </div>

  <button id="publish-btn"
    style="width:100%;background:#10B981;color:#fff;border:none;border-radius:12px;
           padding:14px;font-size:14px;font-weight:700;cursor:pointer">발행하기</button>
</div>`;

  root.querySelector('#back-btn').addEventListener('click', () => { _view = 'list'; _renderPage(root); });

  root.querySelectorAll('.add-q-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _draft.title    = root.querySelector('#sv-title').value;
      _draft.deadline = root.querySelector('#sv-deadline').value;
      _draft.questions.push({
        id: 'q_'+Date.now(),
        type: btn.dataset.type,
        text: '',
        required: true,
        options: btn.dataset.type === 'text' || btn.dataset.type === 'scale' ? [] : ['옵션1','옵션2'],
      });
      _renderPage(root);
    });
  });

  root.querySelector('#publish-btn').addEventListener('click', () => {
    const title    = root.querySelector('#sv-title').value.trim();
    const deadline = root.querySelector('#sv-deadline').value;
    if (!title)    { showToast('설문 제목을 입력하세요.', 'error'); return; }
    if (!deadline) { showToast('마감일을 선택하세요.', 'error'); return; }
    if (!_draft.questions.length) { showToast('문항을 최소 1개 추가하세요.', 'error'); return; }

    const surveys = _getSurveys();
    surveys.push({
      id: 'SVY_'+Date.now(),
      title, deadline,
      status: 'active',
      createdAt: new Date().toISOString().slice(0,10),
      respondents: 0,
      total: 50,
      questions: _draft.questions,
    });
    _saveSurveys(surveys);
    showToast(`"${title}" 설문이 발행되었습니다.`, 'success')
      addNotification({ type: 'success', title: 'Survey Builder (관리자)', body: '"" 설문이 발행되었습니다.' });
    addNotification({ type: 'system', title: `새 설문 발행: ${title}`, body: '' });
    _view = 'list';
    _draft = { title:'', deadline:'', questions:[] };
    _renderPage(root);
  });
}

function _renderQCard(q, idx) {
  const typeMeta = Q_TYPES.find(t=>t.key===q.type)||Q_TYPES[0];
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
     padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <span style="font-size:11px;font-weight:600;color:#4F46E5;background:#EEF2FF;
          padding:2px 8px;border-radius:8px">${typeMeta.icon} ${typeMeta.label}</span>
    <span style="font-size:11px;color:#94A3B8">Q${idx+1}</span>
  </div>
  <div style="font-size:12px;color:var(--text);line-height:1.4">${q.text||'(문항 텍스트 없음)'}</div>
  ${q.options.length ? `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">
    ${q.options.map(o=>`<span style="font-size:11px;background:var(--bg);padding:2px 8px;border-radius:6px;color:#64748B">${o}</span>`).join('')}
  </div>` : ''}
</div>`;
}

function _renderResults(root) {
  const sv = _active;
  if (!sv) { _view = 'list'; _renderPage(root); return; }
  const answers = _getAnswers().filter(a => a.surveyId === sv.id);
  const pct = sv.total ? Math.round((sv.respondents/sv.total)*100) : 0;

  root.innerHTML = `
<div style="padding:16px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
    <button id="back-btn" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text)">←</button>
    <div>
      <div style="font-size:14px;font-weight:700;color:var(--text)">${sv.title}</div>
      <div style="font-size:11px;color:#64748B">응답 ${sv.respondents}/${sv.total}명 · ${pct}% 응답률</div>
    </div>
  </div>

  <!-- 응답률 게이지 -->
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;font-size:11px;color:#94A3B8;margin-bottom:5px">
      <span>응답률</span><span>${pct}%</span>
    </div>
    <div style="background:#E2E8F0;border-radius:99px;height:8px">
      <div style="background:${pct>=80?'#10B981':pct>=50?'#3B82F6':'#F59E0B'};height:8px;border-radius:99px;width:${pct}%"></div>
    </div>
  </div>

  <!-- 문항별 결과 -->
  ${sv.questions.map((q,i) => {
    const qAnswers = answers.map(a => a.answers[q.id]).filter(v => v !== undefined && v !== '');
    return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">
    <div style="font-size:12px;font-weight:700;color:#64748B;margin-bottom:4px">Q${i+1}</div>
    <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:10px">${q.text}</div>
    ${_renderQResult(q, qAnswers)}
  </div>`;
  }).join('')}

  <!-- 텍스트 응답 -->
  ${answers.filter(a => sv.questions.some(q => q.type==='text' && a.answers[q.id])).length ? `
  <div style="font-size:12px;font-weight:700;color:#64748B;margin-bottom:8px">주관식 응답</div>
  ${answers.map(a => {
    const textQs = sv.questions.filter(q => q.type==='text');
    return textQs.map(q => a.answers[q.id] ? `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;
       padding:10px;margin-bottom:6px;font-size:12px;color:var(--text);line-height:1.5">
    "${a.answers[q.id]}"
  </div>` : '').join('');
  }).join('')}` : ''}
</div>`;

  root.querySelector('#back-btn').addEventListener('click', () => { _view = 'list'; _renderPage(root); });
}

function _renderQResult(q, answers) {
  if (!answers.length) return `<div style="font-size:12px;color:#94A3B8">응답 없음</div>`;

  if (q.type === 'scale') {
    const avg = answers.reduce((s,v)=>s+(+v||0),0)/answers.length;
    return `
    <div style="display:flex;align-items:center;gap:10px">
      <div style="font-size:28px;font-weight:900;color:#4F46E5">${avg.toFixed(1)}</div>
      <div style="flex:1">
        <div style="background:#E2E8F0;border-radius:99px;height:8px">
          <div style="background:#4F46E5;height:8px;border-radius:99px;width:${(avg/5)*100}%"></div>
        </div>
        <div style="font-size:10px;color:#94A3B8;margin-top:3px">5점 만점 · ${answers.length}명 응답</div>
      </div>
    </div>`;
  }

  if (q.type === 'text') {
    return `<div style="font-size:12px;color:#94A3B8">${answers.length}명 응답 (아래 주관식 응답 참조)</div>`;
  }

  // radio / check: count options
  const counts = {};
  answers.forEach(a => {
    const vals = Array.isArray(a) ? a : [a];
    vals.forEach(v => { counts[v] = (counts[v]||0)+1; });
  });
  const allOpts = q.options.length ? q.options : Object.keys(counts);
  const max = Math.max(...Object.values(counts), 1);

  return allOpts.map(opt => {
    const cnt = counts[opt]||0;
    const pct = Math.round((cnt/answers.length)*100);
    return `
    <div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
        <span style="color:var(--text)">${opt}</span>
        <span style="color:#64748B;font-weight:600">${cnt}명 (${pct}%)</span>
      </div>
      <div style="background:#E2E8F0;border-radius:99px;height:6px">
        <div style="background:#4F46E5;height:6px;border-radius:99px;width:${pct}%"></div>
      </div>
    </div>`;
  }).join('');
}
export function mount(root) { return render(root); }
