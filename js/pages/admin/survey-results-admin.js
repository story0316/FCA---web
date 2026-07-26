/**
 * survey-results-admin.js — 설문 결과 분석 (관리자)
 */

const LS_SURVEYS   = 'hr_internal_surveys';
const LS_RESPONSES = 'hr_survey_responses_v2';

const DEMO_SURVEYS = [
  {
    id: 'SV001',
    title: '2026년 상반기 직원 만족도 조사',
    deadline: '2026-06-30',
    anonymous: true,
    status: 'active',
    createdAt: '2026-06-01',
    questions: [
      { id: 'q1', type: 'scale5', text: '현재 업무 환경에 만족하십니까?' },
      { id: 'q2', type: 'scale5', text: '회사의 복리후생 수준에 만족하십니까?' },
      { id: 'q3', type: 'scale5', text: '업무를 통해 성장하고 있다고 느끼십니까?' },
      { id: 'q4', type: 'choice', text: '현재 가장 개선이 필요한 분야는?',
        options: ['근무 환경', '보상 체계', '커뮤니케이션', '성장 기회', '워크라이프 밸런스'] },
      { id: 'q5', type: 'text', text: '회사에 바라는 점이나 제안 사항' },
    ],
  },
  {
    id: 'SV002',
    title: '사내 복지포인트 사용 현황 파악',
    deadline: '2026-06-20',
    anonymous: false,
    status: 'active',
    createdAt: '2026-06-03',
    questions: [
      { id: 'q1', type: 'choice', text: '복지포인트를 주로 어떤 용도로 사용하십니까?',
        options: ['건강/의료', '자기계발', '여가/문화', '가족친화', '생활편의'] },
      { id: 'q2', type: 'scale5', text: '현재 복지포인트 한도(연 60만원)는 충분합니까?' },
      { id: 'q3', type: 'choice', text: '추가되길 원하는 복지 카테고리는?',
        options: ['반려동물 케어', '홈클리닝', '구독서비스', '여행/숙박', '건강보조식품'] },
    ],
  },
];

const SCALE_LABELS = ['', '매우 불만족', '불만족', '보통', '만족', '매우 만족'];
const SCALE_COLORS = ['', '#EF4444', '#F59E0B', '#94A3B8', '#3B82F6', '#10B981'];

function _getSurveys() {
  try {
    const stored = JSON.parse(localStorage.getItem(LS_SURVEYS) || '[]');
    const ids = new Set(stored.map(s => s.id));
    const merged = [...stored];
    DEMO_SURVEYS.forEach(d => { if (!ids.has(d.id)) merged.push(d); });
    return merged;
  } catch { return DEMO_SURVEYS; }
}

function _getResponses() { try { return JSON.parse(localStorage.getItem(LS_RESPONSES) || '[]'); } catch { return []; } }

function _seedDemoResponses() {
  const responses = _getResponses();
  if (responses.length) return;
  const TOTAL = 18;
  const demo = [];
  for (let i = 0; i < TOTAL; i++) {
    const sv = DEMO_SURVEYS[i % 2];
    const emp = `emp_seed_${i}`;
    const answers = {};
    sv.questions.forEach(q => {
      if (q.type === 'scale5') answers[q.id] = Math.ceil(Math.random() * 5);
      else if (q.type === 'choice') answers[q.id] = q.options[Math.floor(Math.random() * q.options.length)];
    });
    demo.push({ surveyId: sv.id, empId: sv.anonymous ? 'anon' : emp, answers, submittedAt: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString() });
  }
  localStorage.setItem(LS_RESPONSES, JSON.stringify(demo));
}

let _selectedSurveyId = null;

export function render(root) {
  _seedDemoResponses();
  _selectedSurveyId = null;
  _draw(root);
}

export function unmount() { _selectedSurveyId = null; }

function _draw(root) {
  if (_selectedSurveyId) { _drawResults(root); return; }

  const surveys = _getSurveys();
  const responses = _getResponses();

  if (!surveys.length) {
    root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8">
      <div style="font-size:48px;margin-bottom:12px">📋</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:6px;color:#64748B">설문 결과가 없습니다</div>
      <div style="font-size:12px">설문이 등록되면 자동으로 표시됩니다.</div>
    </div>`;
    return;
  }

  root.innerHTML = `
<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px">설문 목록</div>
${surveys.map(sv => {
  const svResps = responses.filter(r => r.surveyId === sv.id);
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div>
      <div style="font-size:13px;font-weight:700;color:var(--text)">${sv.title}</div>
      <div style="font-size:11px;color:#64748B">${sv.questions.length}개 문항 · ${sv.anonymous?'익명':'실명'} · ${sv.status==='active'?'진행중':'종료'}</div>
    </div>
    <button class="sra-view" data-id="${sv.id}"
      style="padding:6px 12px;background:#EEF2FF;color:#4F46E5;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">
      결과 보기
    </button>
  </div>
  <div style="display:flex;gap:10px">
    <div style="text-align:center;flex:1;background:var(--bg);border-radius:8px;padding:8px">
      <div style="font-size:18px;font-weight:800;color:#4F46E5">${svResps.length}</div>
      <div style="font-size:10px;color:#64748B">응답수</div>
    </div>
    <div style="text-align:center;flex:1;background:var(--bg);border-radius:8px;padding:8px">
      <div style="font-size:18px;font-weight:800;color:#10B981">${sv.questions.length}</div>
      <div style="font-size:10px;color:#64748B">문항수</div>
    </div>
    <div style="text-align:center;flex:1;background:var(--bg);border-radius:8px;padding:8px">
      <div style="font-size:14px;font-weight:800;color:#F59E0B">${sv.deadline}</div>
      <div style="font-size:10px;color:#64748B">마감일</div>
    </div>
  </div>
</div>`;
}).join('')}`;

  root.querySelectorAll('.sra-view').forEach(btn => {
    btn.addEventListener('click', () => { _selectedSurveyId = btn.dataset.id; _draw(root); });
  });
}

function _drawResults(root) {
  const surveys   = _getSurveys();
  const sv        = surveys.find(s => s.id === _selectedSurveyId);
  if (!sv) { _selectedSurveyId = null; _draw(root); return; }

  const responses = _getResponses().filter(r => r.surveyId === _selectedSurveyId);
  const n = responses.length;

  root.innerHTML = `
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;color:var(--text);flex:1">${sv.title}</div>
  <button id="sra-back" style="padding:6px 12px;border:1.5px solid var(--border);border-radius:8px;background:none;font-size:12px;cursor:pointer;color:#64748B;flex-shrink:0">← 목록</button>
</div>

<!-- 응답 KPI -->
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
  ${[
    { label:'응답자',  val: n,                                              color:'#4F46E5' },
    { label:'완료율',  val: `${Math.round(n/20*100)}%`,                    color:'#10B981' },
    { label:'문항수',  val: sv.questions.length,                            color:'#F59E0B' },
  ].map(k=>`
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
      <div style="font-size:20px;font-weight:800;color:${k.color}">${k.val}</div>
      <div style="font-size:10px;color:#64748B;margin-top:2px">${k.label}</div>
    </div>`).join('')}
</div>

<!-- 문항별 결과 -->
${sv.questions.map(q => _renderQuestionResult(q, responses)).join('')}`;

  root.querySelector('#sra-back')?.addEventListener('click', () => { _selectedSurveyId = null; _draw(root); });
}

function _renderQuestionResult(q, responses) {
  const answers = responses.map(r => r.answers?.[q.id]).filter(a => a !== undefined);
  if (!answers.length) return '';

  if (q.type === 'scale5') {
    const counts = [0, 0, 0, 0, 0, 0];
    answers.forEach(a => { if (a >= 1 && a <= 5) counts[a]++; });
    const total = answers.length;
    const avg = total ? (answers.reduce((s, a) => s + a, 0) / total).toFixed(1) : '-';
    const favourable = counts[4] + counts[5];

    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:4px">${q.text}</div>
  <div style="font-size:11px;color:#64748B;margin-bottom:10px">평균 ${avg} / 5 · 긍정 응답 ${Math.round(favourable/total*100)}%</div>
  ${[1,2,3,4,5].map(v => {
    const cnt = counts[v];
    const pct = total ? Math.round(cnt / total * 100) : 0;
    return `
<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
  <span style="font-size:11px;color:${SCALE_COLORS[v]};font-weight:600;min-width:56px;white-space:nowrap">${SCALE_LABELS[v]}</span>
  <div style="flex:1;height:12px;background:#E2E8F0;border-radius:6px;overflow:hidden">
    <div style="height:100%;background:${SCALE_COLORS[v]};border-radius:6px;width:${pct}%;transition:width .3s"></div>
  </div>
  <span style="font-size:11px;color:#64748B;min-width:36px;text-align:right">${cnt}명 (${pct}%)</span>
</div>`;
  }).join('')}
</div>`;
  }

  if (q.type === 'choice') {
    const counts2 = {};
    q.options.forEach(o => { counts2[o] = 0; });
    answers.forEach(a => { if (counts2[a] !== undefined) counts2[a]++; });
    const total = answers.length;
    const sorted = Object.entries(counts2).sort((a, b) => b[1] - a[1]);

    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px">${q.text}</div>
  ${sorted.map(([opt, cnt], i) => {
    const pct = total ? Math.round(cnt / total * 100) : 0;
    const colors = ['#4F46E5','#10B981','#F59E0B','#8B5CF6','#3B82F6'];
    const c = colors[i % colors.length];
    return `
<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
  <span style="font-size:11px;color:var(--text);min-width:80px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${opt}</span>
  <div style="flex:1;height:14px;background:#E2E8F0;border-radius:7px;overflow:hidden">
    <div style="height:100%;background:${c};border-radius:7px;width:${pct}%;transition:width .3s"></div>
  </div>
  <span style="font-size:11px;font-weight:700;color:${c};min-width:44px;text-align:right">${cnt}명 (${pct}%)</span>
</div>`;
  }).join('')}
</div>`;
  }

  if (q.type === 'text') {
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">${q.text}</div>
  <div style="font-size:11px;color:#64748B;margin-bottom:8px">${answers.length}개 응답</div>
  ${answers.slice(0, 5).map(a => `
    <div style="padding:8px;background:var(--bg);border-radius:8px;font-size:11px;color:#475569;margin-bottom:6px;line-height:1.5">${a}</div>`).join('')}
  ${answers.length > 5 ? `<div style="font-size:11px;color:#94A3B8;text-align:center">외 ${answers.length-5}개 응답</div>` : ''}
</div>`;
  }

  return '';
}
export function mount(root) { return render(root); }
