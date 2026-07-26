/**
 * pulse-survey.js — 주간 펄스 서베이 (직원 만족도 익명 체크)
 */

import {getUser, isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId() {
  const s = _session();
  return s.empId || s.userId || getUser()?.id || 'EMP001';
}

const LS_PULSE = 'hr_pulse_responses';

const DIMENSIONS = [
  { id: 'workload',     label: '업무량',       icon: '💼', desc: '업무량이 적절한가요?' },
  { id: 'teamwork',     label: '팀워크',       icon: '🤝', desc: '팀 협업이 잘 이뤄지고 있나요?' },
  { id: 'leadership',   label: '리더십',       icon: '🌟', desc: '리더의 지원이 충분한가요?' },
  { id: 'growth',       label: '성장',         icon: '📈', desc: '일에서 배우고 성장하고 있나요?' },
  { id: 'satisfaction', label: '전반적 만족',  icon: '😊', desc: '전반적인 회사 생활에 만족하나요?' },
];

const EMOJI_SCALE = [
  { score: 1, emoji: '😞', color: '#EF4444', label: '매우 불만족' },
  { score: 2, emoji: '😕', color: '#F97316', label: '불만족' },
  { score: 3, emoji: '😐', color: '#F59E0B', label: '보통' },
  { score: 4, emoji: '😊', color: '#22C55E', label: '만족' },
  { score: 5, emoji: '😄', color: '#10B981', label: '매우 만족' },
];

function _getResponses() {
  try { return JSON.parse(localStorage.getItem(LS_PULSE) || '[]'); } catch { return []; }
}

function _saveResponses(list) {
  localStorage.setItem(LS_PULSE, JSON.stringify(list));
}

function _getWeekKey(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay() + 1); // Monday
  return d.toISOString().slice(0, 10);
}

function _getThisWeekResponse(responses, userId) {
  const weekKey = _getWeekKey();
  return responses.find(r => r.weekKey === weekKey && r.userId === userId);
}

function _ensureDemo(responses) {
  if (responses.length) return responses;
  const today = new Date();
  const demo = [];
  for (let w = 7; w >= 1; w--) {
    const d = new Date(today);
    d.setDate(d.getDate() - w * 7);
    const weekKey = _getWeekKey(d);
    demo.push({
      id: 'P_' + weekKey + '_demo',
      weekKey, userId: 'demo',
      scores: {
        workload: Math.floor(Math.random() * 2) + 3,
        teamwork: Math.floor(Math.random() * 2) + 3,
        leadership: Math.floor(Math.random() * 2) + 3,
        growth: Math.floor(Math.random() * 2) + 3,
        satisfaction: Math.floor(Math.random() * 2) + 3,
      },
      comment: w === 1 ? '프로젝트 마감이 겹쳐 업무량이 좀 많았어요.' : '',
      submittedAt: d.toISOString(),
    });
  }
  _saveResponses(demo);
  return demo;
}

let _scores = {};
let _tab = 'survey'; // 'survey' | 'history'

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _scores = {};
  _renderPage(root);
}

export function unmount() { _tab = 'survey';
  _scores = {};
  _tab = 'survey';
}

function _renderPage(root) {
  const user = getUser();
  const userId = _empId();
  let responses = _getResponses();
  responses = _ensureDemo(responses);
  const thisWeek = _getThisWeekResponse(responses, userId);

  root.innerHTML = `
<div class="page" style="background:var(--bg)">
  <div class="top-bar">
    <button class="btn btn-ghost btn-sm" onclick="window.navBack()" style="padding:8px;min-height:40px">←</button>
    <div class="top-bar-title" style="flex:1;text-align:center">📊 주간 펄스 서베이</div>
    <div style="min-width:40px"></div>
  </div>

  <!-- 탭 -->
  <div style="display:flex;border-bottom:2px solid var(--border);background:var(--surface)">
    ${[{key:'survey',label:'이번 주 체크'},{key:'history',label:'내 이력'}].map(t => `
    <button class="pulse-tab" data-tab="${t.key}"
      style="flex:1;padding:12px;font-size:13px;font-weight:600;background:none;border:none;
             cursor:pointer;border-bottom:2px solid ${_tab===t.key?'#4F46E5':'transparent'};
             margin-bottom:-2px;color:${_tab===t.key?'#4F46E5':'var(--text-muted)'}">
      ${t.label}
    </button>`).join('')}
  </div>

  <div class="page-content" style="padding:16px">
    <div id="pulse-body"></div>
  </div>
</div>`;

  root.querySelectorAll('.pulse-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.tab; _renderPage(root); });
  });

  const body = root.querySelector('#pulse-body');
  if (_tab === 'survey') _renderSurveyForm(body, root, responses, userId, thisWeek);
  else _renderHistory(body, responses, userId);
}

// ── 서베이 폼 ────────────────────────────────────────────────

function _renderSurveyForm(container, root, responses, userId, existing) {
  const weekKey = _getWeekKey();
  const weekLabel = weekKey.replace(/-/g, '.') + ' 주간';

  if (existing) {
    _renderCompletedView(container, existing);
    return;
  }

  container.innerHTML = `
<div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border-radius:16px;
     padding:20px;color:#fff;margin-bottom:20px">
  <div style="font-size:12px;opacity:0.8;margin-bottom:4px">${weekLabel}</div>
  <div style="font-size:18px;font-weight:700;margin-bottom:6px">이번 주 어떠셨나요?</div>
  <div style="font-size:13px;opacity:0.85;line-height:1.6">
    익명으로 수집됩니다. 솔직한 피드백이 더 좋은 직장을 만들어요.
  </div>
</div>

${DIMENSIONS.map(dim => `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
     padding:16px;margin-bottom:10px">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
    <span style="font-size:20px">${dim.icon}</span>
    <div>
      <div style="font-size:14px;font-weight:700;color:var(--text)">${dim.label}</div>
      <div style="font-size:12px;color:var(--text-muted)">${dim.desc}</div>
    </div>
  </div>
  <div style="display:flex;justify-content:space-between;gap:8px;margin-top:12px" id="scale-${dim.id}">
    ${EMOJI_SCALE.map(s => `
    <button class="scale-btn" data-dim="${dim.id}" data-score="${s.score}"
      style="flex:1;padding:8px 4px;border:2px solid var(--border);border-radius:12px;
             cursor:pointer;text-align:center;background:var(--bg);transition:all .15s">
      <div style="font-size:22px;margin-bottom:2px">${s.emoji}</div>
      <div style="font-size:9px;color:var(--text-muted);line-height:1.2">${s.label}</div>
    </button>`).join('')}
  </div>
  <div id="score-${dim.id}" style="font-size:11px;color:var(--text-muted);text-align:right;margin-top:6px;height:14px"></div>
</div>`).join('')}

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
     padding:16px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:8px">💬 한마디 (선택)</div>
  <textarea maxlength="500" id="pulse-comment" placeholder="자유롭게 의견을 남겨주세요 (익명)"
    style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;
           font-size:13px;background:var(--bg);color:var(--text);height:80px;resize:none;
           box-sizing:border-box;font-family:inherit;line-height:1.5"></textarea>
</div>

<button id="submit-btn" class="btn btn-primary" style="width:100%;opacity:0.4;cursor:not-allowed"
  disabled>모든 항목에 응답 후 제출</button>`;

  container.querySelectorAll('.scale-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dim = btn.dataset.dim;
      const score = parseInt(btn.dataset.score);
      _scores[dim] = score;

      const scale = EMOJI_SCALE.find(s => s.score === score);
      container.querySelectorAll(`[data-dim="${dim}"]`).forEach(b => {
        b.style.borderColor = 'var(--border)';
        b.style.background = 'var(--bg)';
      });
      btn.style.borderColor = scale.color;
      btn.style.background = scale.color + '20';
      container.querySelector(`#score-${dim}`).textContent = `${score}점 · ${scale.label}`;

      const allDone = DIMENSIONS.every(d => _scores[d.id]);
      const submitBtn = container.querySelector('#submit-btn');
      if (allDone) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
        submitBtn.textContent = '제출하기 ✓';
      }
    });
  });

  container.querySelector('#submit-btn').addEventListener('click', () => {
    const comment = container.querySelector('#pulse-comment').value.trim();
    const newResp = {
      id: 'P_' + Date.now(),
      weekKey,
      userId,
      scores: { ..._scores },
      comment,
      submittedAt: new Date().toISOString(),
    };
    responses.push(newResp);
    _saveResponses(responses);
    addNotification({ type: 'success', title: '펄스 서베이', body: '주간 펄스 서베이가 제출되었습니다.' });
    showToast('서베이가 제출되었습니다. 감사합니다!', 'success');
    _renderPage(root);
  });
}

function _renderCompletedView(container, resp) {
  const avg = (Object.values(resp.scores).reduce((s, v) => s + v, 0) / DIMENSIONS.length).toFixed(1);
  const avgScale = EMOJI_SCALE.find(s => s.score === Math.round(parseFloat(avg))) || EMOJI_SCALE[2];

  container.innerHTML = `
<div style="background:linear-gradient(135deg,#10B981,#059669);border-radius:16px;
     padding:24px;color:#fff;margin-bottom:20px;text-align:center">
  <div style="font-size:48px;margin-bottom:8px">${avgScale.emoji}</div>
  <div style="font-size:22px;font-weight:800;margin-bottom:4px">평균 ${avg}점</div>
  <div style="font-size:13px;opacity:0.85">이번 주 서베이 완료 · ${resp.submittedAt.slice(0,10)}</div>
</div>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="font-size:13px;font-weight:700;margin-bottom:12px">항목별 점수</div>
  ${DIMENSIONS.map(dim => {
    const score = resp.scores[dim.id] || 0;
    const scale = EMOJI_SCALE.find(s => s.score === score) || EMOJI_SCALE[2];
    return `
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
    <span style="font-size:16px">${dim.icon}</span>
    <div style="flex:1">
      <div style="display:flex;justify-content:space-between;margin-bottom:3px">
        <span style="font-size:12px;font-weight:600;color:var(--text)">${dim.label}</span>
        <span style="font-size:12px;color:${scale.color};font-weight:700">${score}점 ${scale.emoji}</span>
      </div>
      <div style="background:var(--border);border-radius:4px;height:6px">
        <div style="background:${scale.color};height:100%;width:${score*20}%;border-radius:4px;transition:width .5s"></div>
      </div>
    </div>
  </div>`;
  }).join('')}
</div>

${resp.comment ? `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">💬 내가 남긴 한마디</div>
  <div style="font-size:13px;color:var(--text);line-height:1.6;font-style:italic">"${resp.comment}"</div>
</div>` : ''}

<div style="text-align:center;padding:16px;font-size:12px;color:var(--text-muted)">
  다음 주 월요일에 새 서베이가 열립니다.
</div>`;
}

// ── 이력 ────────────────────────────────────────────────────

function _renderHistory(container, responses, userId) {
  const myHistory = responses.filter(r => r.userId === userId)
    .sort((a, b) => b.weekKey.localeCompare(a.weekKey));

  if (!myHistory.length) {
    container.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text-muted)">
      <div style="font-size:40px;margin-bottom:10px">📊</div>
      <div style="font-weight:600;margin-bottom:6px">서베이 이력이 없습니다</div>
      <button onclick="location.hash='#/pulse-survey'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">서베이 참여</button>
    
      <div style="font-size:13px">주간 서베이에 참여해보세요!</div>
    </div>`;
    return;
  }

  container.innerHTML = `
<div style="font-size:13px;font-weight:700;margin-bottom:12px">최근 서베이 이력</div>
${myHistory.slice(0, 8).map(r => {
  const avg = (Object.values(r.scores).reduce((s, v) => s + v, 0) / DIMENSIONS.length);
  const scale = EMOJI_SCALE.find(s => s.score === Math.round(avg)) || EMOJI_SCALE[2];
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
     padding:14px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <div style="font-size:13px;font-weight:600;color:var(--text)">${r.weekKey} 주</div>
    <div style="font-size:18px;font-weight:800;color:${scale.color}">${scale.emoji} ${avg.toFixed(1)}점</div>
  </div>
  <div style="display:flex;gap:8px">
    ${DIMENSIONS.map(d => {
      const s = r.scores[d.id] || 0;
      const sc = EMOJI_SCALE.find(x => x.score === s) || EMOJI_SCALE[2];
      return `<div style="flex:1;text-align:center">
        <div style="font-size:14px">${d.icon}</div>
        <div style="font-size:10px;color:${sc.color};font-weight:700">${s}</div>
      </div>`;
    }).join('')}
  </div>
  ${r.comment ? `<div style="font-size:11px;color:var(--text-muted);margin-top:8px;font-style:italic">"${r.comment.slice(0,50)}${r.comment.length>50?'…':''}"</div>` : ''}
</div>`;
}).join('')}`;
}
