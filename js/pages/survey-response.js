/**
 * survey-response.js — 사내 설문 응답
 */

import {getUser, isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

function _session() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}'); } catch { return {}; } }
function _empId()   { const s = _session(); return s.empId || s.userId || getUser()?.id || 'demo'; }
function _empName() { const u = getUser(); return u?.name || u?.email?.split('@')[0] || '사용자'; }

const LS_SURVEYS  = 'hr_internal_surveys';
const LS_RESPONSES = 'hr_survey_responses_v2';

const DEMO_SURVEYS = [
  {
    id: 'SV001',
    title: '2026년 상반기 직원 만족도 조사',
    desc: '근무 환경, 복리후생, 성장 기회에 대한 솔직한 의견을 들려주세요.',
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
      { id: 'q5', type: 'text', text: '회사에 바라는 점이나 제안 사항을 자유롭게 작성해주세요. (선택)' },
    ],
  },
  {
    id: 'SV002',
    title: '사내 복지포인트 사용 현황 파악',
    desc: '복지포인트 활용도와 희망 카테고리를 조사합니다.',
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
  {
    id: 'SV003',
    title: '재택근무 만족도 조사',
    desc: '재택근무 시행 이후 업무 효율과 만족도를 측정합니다.',
    deadline: '2026-05-31',
    anonymous: true,
    status: 'closed',
    createdAt: '2026-05-15',
    questions: [
      { id: 'q1', type: 'scale5', text: '재택근무 시 업무 효율성은 사무실 대비 어떻습니까?' },
      { id: 'q2', type: 'scale5', text: '재택근무 제도에 전반적으로 만족하십니까?' },
    ],
  },
];

const SCALE_LABELS = ['', '매우 불만족', '불만족', '보통', '만족', '매우 만족'];
const SCALE_COLORS = ['', '#EF4444', '#F59E0B', 'var(--text-muted)', '#3B82F6', '#10B981'];

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
function _saveResponse(r) {
  const all = _getResponses();
  const idx = all.findIndex(x => x.surveyId === r.surveyId && x.empId === r.empId);
  if (idx !== -1) all[idx] = r; else all.push(r);
  localStorage.setItem(LS_RESPONSES, JSON.stringify(all));
}

let _tab       = 'active';
let _activeSurveyId = null;
let _answers   = {};

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'active';
  _activeSurveyId = null;
  _answers = {};
  _draw(root);
}

export function unmount() {
  _tab = 'active';
  _activeSurveyId = null;
  _answers = {};
}

function _draw(root) {
  if (_activeSurveyId) { _drawForm(root); return; }

  const empId = _empId();
  const surveys = _getSurveys();
  const responses = _getResponses();
  const myResponseIds = new Set(responses.filter(r => r.empId === empId).map(r => r.surveyId));

  const active = surveys.filter(s => s.status === 'active');
  const closed = surveys.filter(s => s.status === 'closed');
  const shown  = _tab === 'active' ? active : closed;

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden">
  <div class="page-header" style="flex-shrink:0;background:var(--card-bg);border-bottom:1px solid var(--border);padding:16px;display:flex;align-items:center;gap:12px">
    <button onclick="window.navBack()"
      style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0;line-height:1">←</button>
    <div>
      <div style="font-size:16px;font-weight:700;color:var(--text)">사내 설문</div>
      <div style="font-size:11px;color:var(--text-muted)">진행 중인 설문에 참여해 주세요</div>
    </div>
  </div>

  <div style="flex-shrink:0;display:flex;border-bottom:1px solid var(--border);background:var(--card-bg)">
    <button class="sr-tab" data-t="active"
      style="flex:1;padding:12px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab==='active'?'#4F46E5':'transparent'};
             color:${_tab==='active'?'#4F46E5':'var(--text-muted)'}">진행중 (${active.length})</button>
    <button class="sr-tab" data-t="closed"
      style="flex:1;padding:12px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab==='closed'?'#4F46E5':'transparent'};
             color:${_tab==='closed'?'#4F46E5':'var(--text-muted)'}">종료됨 (${closed.length})</button>
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">
    ${!shown.length
      ? `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
          <div style="font-size:40px;margin-bottom:12px">📋</div>
          <div style="font-size:14px;font-weight:600;margin-bottom:4px">${_tab==='active'?'진행 중인 설문이 없습니다':'종료된 설문이 없습니다'}</div>
          <div style="font-size:12px">인사팀에서 설문을 등록하면 여기에 표시됩니다</div>
        </div>`
      : shown.map(sv => {
          const responded = myResponseIds.has(sv.id);
          const dday = _dday(sv.deadline);
          return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="flex:1">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:3px">${sv.title}</div>
      <div style="font-size:11px;color:var(--text-muted)">${sv.questions.length}개 문항 · ${sv.anonymous?'익명':'실명'} · 마감 ${sv.deadline}</div>
    </div>
    ${responded
      ? `<span style="padding:4px 10px;border-radius:20px;background:#D1FAE5;color:#059669;font-size:11px;font-weight:700;flex-shrink:0">✅ 완료</span>`
      : sv.status === 'active'
        ? `<span style="padding:4px 10px;border-radius:20px;background:${dday<=3?'#FEE2E2':'#FEF3C7'};color:${dday<=3?'#EF4444':'#D97706'};font-size:11px;font-weight:700;flex-shrink:0">D-${dday}</span>`
        : `<span style="padding:4px 10px;border-radius:20px;background:#F1F5F9;color:var(--text-muted);font-size:11px;font-weight:700;flex-shrink:0">종료</span>`}
  </div>
  <div style="font-size:12px;color:var(--text-muted);line-height:1.5;margin-bottom:10px">${sv.desc}</div>
  ${sv.status === 'active' && !responded
    ? `<button class="sr-start" data-id="${sv.id}"
        style="width:100%;padding:10px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">
        설문 참여하기
      </button>`
    : responded
      ? `<div style="font-size:11px;color:var(--text-muted);text-align:center">이미 응답하셨습니다. 감사합니다! 🙏</div>`
      : `<div style="font-size:11px;color:var(--text-muted);text-align:center">설문이 종료되었습니다.</div>`}
</div>`;
        }).join('')}
  </div>
</div>`;

  root.querySelectorAll('.sr-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _draw(root); });
  });
  root.querySelectorAll('.sr-start').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeSurveyId = btn.dataset.id;
      _answers = {};
      _draw(root);
    });
  });
}

function _dday(deadline) {
  const diff = Math.ceil((new Date(deadline) - new Date()) / 86400000);
  return Math.max(0, diff);
}

function _drawForm(root) {
  const surveys = _getSurveys();
  const sv = surveys.find(s => s.id === _activeSurveyId);
  if (!sv) { _activeSurveyId = null; _draw(root); return; }

  root.innerHTML = `
<div class="page">
  <div class="page-header" style="background:var(--card-bg);border-bottom:1px solid var(--border);padding:16px;display:flex;align-items:center;gap:12px">
    <button id="sr-back"
      style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0;line-height:1">←</button>
    <div>
      <div style="font-size:14px;font-weight:700;color:var(--text)">${sv.title}</div>
      <div style="font-size:11px;color:var(--text-muted)">${sv.anonymous ? '익명 응답' : '실명 응답'} · ${sv.questions.length}개 문항</div>
    </div>
  </div>

  <div class="page-content" style="padding:16px">
    ${sv.anonymous ? `<div style="background:#EEF2FF;border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:#4F46E5">
      🔒 이 설문은 익명으로 처리되며 개인 정보는 수집되지 않습니다.
    </div>` : ''}

    <form id="sr-form">
      ${sv.questions.map((q, i) => `
        <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">
          <div style="font-size:12px;color:#4F46E5;font-weight:700;margin-bottom:6px">Q${i+1}</div>
          <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:10px;line-height:1.5">${q.text}</div>
          ${q.type === 'scale5' ? `
            <div style="display:flex;justify-content:space-between;gap:6px">
              ${[1,2,3,4,5].map(v => `
                <button type="button" class="sr-scale" data-qid="${q.id}" data-val="${v}"
                  style="flex:1;padding:10px 4px;border-radius:10px;border:2px solid var(--border);
                         background:var(--bg);cursor:pointer;font-size:11px;font-weight:700;color:var(--text-muted);
                         transition:all .15s">
                  <div style="font-size:16px;margin-bottom:2px">${['😞','😕','😐','😊','😄'][v-1]}</div>
                  ${v}
                </button>`).join('')}
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:4px;padding:0 2px">
              <span style="font-size:9px;color:var(--text-muted)">매우 불만족</span>
              <span style="font-size:9px;color:var(--text-muted)">매우 만족</span>
            </div>` : ''}
          ${q.type === 'choice' ? `
            <div style="display:flex;flex-direction:column;gap:6px">
              ${q.options.map((opt, oi) => `
                <button type="button" class="sr-choice" data-qid="${q.id}" data-val="${opt}"
                  style="padding:10px 12px;border-radius:8px;border:2px solid var(--border);background:var(--bg);
                         cursor:pointer;text-align:left;font-size:12px;color:#475569;font-weight:500;transition:all .15s">
                  ${opt}
                </button>`).join('')}
            </div>` : ''}
          ${q.type === 'text' ? `
            <textarea maxlength="500" class="sr-text" data-qid="${q.id}" rows="3" placeholder="여기에 입력하세요…"
              style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;
                     background:var(--bg);color:var(--text);resize:vertical;box-sizing:border-box"></textarea>` : ''}
        </div>`).join('')}

      <button type="submit"
        style="width:100%;padding:13px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-top:6px">
        제출하기
      </button>
    </form>
  </div>
</div>`;

  root.querySelector('#sr-back')?.addEventListener('click', () => { _activeSurveyId = null; _draw(root); });

  root.querySelectorAll('.sr-scale').forEach(btn => {
    btn.addEventListener('click', () => {
      const qid = btn.dataset.qid;
      _answers[qid] = Number(btn.dataset.val);
      root.querySelectorAll(`.sr-scale[data-qid="${qid}"]`).forEach(b => {
        const v = Number(b.dataset.val);
        const sel = v === _answers[qid];
        b.style.borderColor = sel ? SCALE_COLORS[v] : 'var(--border)';
        b.style.background  = sel ? (v >= 4 ? '#D1FAE5' : v === 3 ? '#F1F5F9' : '#FEE2E2') : 'var(--bg)';
        b.style.color       = sel ? SCALE_COLORS[v] : 'var(--text-muted)';
      });
    });
  });

  root.querySelectorAll('.sr-choice').forEach(btn => {
    btn.addEventListener('click', () => {
      const qid = btn.dataset.qid;
      _answers[qid] = btn.dataset.val;
      root.querySelectorAll(`.sr-choice[data-qid="${qid}"]`).forEach(b => {
        const sel = b.dataset.val === _answers[qid];
        b.style.borderColor = sel ? '#4F46E5' : 'var(--border)';
        b.style.background  = sel ? '#EEF2FF' : 'var(--bg)';
        b.style.color       = sel ? '#4F46E5' : '#475569';
        b.style.fontWeight  = sel ? '700' : '500';
      });
    });
  });

  root.querySelector('#sr-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const empId = _empId();

    // collect text answers
    root.querySelectorAll('.sr-text').forEach(ta => {
      if (ta.value.trim()) _answers[ta.dataset.qid] = ta.value.trim();
    });

    // validate required
    const required = sv.questions.filter(q => q.type !== 'text');
    const missing = required.filter(q => _answers[q.id] === undefined);
    if (missing.length) {
      showToast(`Q${sv.questions.indexOf(missing[0])+1} 문항에 응답해 주세요.`, 'error');
      return;
    }

    _saveResponse({ surveyId: sv.id, empId: sv.anonymous ? 'anon' : empId, answers: { ..._answers }, submittedAt: new Date().toISOString() });
    showToast('설문에 참여해 주셔서 감사합니다! 🙏', 'success');
    addNotification({ type: 'info', title: '설문 제출 완료', message: `'${sv.title}' 응답이 저장되었습니다.` });
    _activeSurveyId = null;
    _answers = {};
    _tab = 'active';
    _draw(root);
  });
}
