/**
 * peer-review.js — 360° 동료 피드백 (Phase 138)
 * 평가 작성 + 방사형 차트 결과 + Supabase performance_reviews 저장
 */

import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
import { RadarChart } from '../components/radar-chart.js';
import { api } from '../api.js';
import { isApplicant } from '../auth.js';

const LS_REVIEWS = 'hr_peer_reviews';
const LS_CYCLES  = 'hr_peer_cycles';

const COMPETENCIES = [
  { key:'collaboration', label:'협업·팀워크',  desc:'팀 목표를 위해 적극적으로 협력하는가?',    icon:'🤝' },
  { key:'communication', label:'커뮤니케이션', desc:'명확하고 효과적으로 소통하는가?',            icon:'💬' },
  { key:'reliability',   label:'신뢰·책임감',  desc:'맡은 업무를 약속대로 완수하는가?',          icon:'🎯' },
  { key:'initiative',    label:'주도성',        desc:'문제를 먼저 발견하고 해결책을 제시하는가?', icon:'🚀' },
  { key:'growth',        label:'성장 마인드',   desc:'배움에 열려있고 지속적으로 발전하는가?',    icon:'🌱' },
];

const SCORE_LABELS = ['', '매우 부족', '부족', '보통', '우수', '탁월'];
const SCORE_COLORS = ['', '#EF4444', '#F97316', '#F59E0B', '#3B82F6', '#10B981'];

const DEMO_PEERS = [];

const DEMO_CYCLE = { id:'CYC001', name:'2026년 상반기 동료 평가', deadline:'2026-06-30', active:true };

function _getUser() {
  try {
    const u = JSON.parse(localStorage.getItem('hr_user') || '{}');
    if (u.id) return u;
    const s = JSON.parse(localStorage.getItem('hr_session') || '{}');
    return { id: s.userId || 'EMP001', name: s.name || '직원' };
  } catch { return { id: 'EMP001', name: '직원' }; }
}

function _empId()   { return _getUser().id || 'EMP001'; }
function _empName() { return _getUser().name_ko || _getUser().name || '직원'; }

function _getCycle() {
  try { return JSON.parse(localStorage.getItem(LS_CYCLES) || 'null') || DEMO_CYCLE; }
  catch { return DEMO_CYCLE; }
}
function _getReviews() { try { return JSON.parse(localStorage.getItem(LS_REVIEWS) || '[]'); } catch { return []; } }
function _save(l) { localStorage.setItem(LS_REVIEWS, JSON.stringify(l)); }

let _tab     = 'write';
let _selPeer = null;
let _scores  = {};

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `
      <div class="page" style="display:flex;align-items:center;justify-content:center;height:100vh;background:var(--bg)">
        <div style="text-align:center;padding:40px 24px">
          <div style="font-size:48px;margin-bottom:16px">🔒</div>
          <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px">접근 제한</div>
          <div style="font-size:13px;color:var(--text-muted);line-height:1.6">재직 구성원만 이용할 수 있는 기능입니다.<br>입사 후 이용해 주세요.</div>
          <button onclick="window.navBack()" style="margin-top:20px;padding:10px 24px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">돌아가기</button>
        </div>
      </div>`;
    return;
  }
  _tab = 'write'; _selPeer = null; _scores = {};
  _render(root);
}
export function unmount() { _tab = 'write'; _selPeer = null; _scores = {}; }

// ── 메인 렌더 ───────────────────────────────────────────────
function _render(root) {
  const cycle      = _getCycle();
  const reviews    = _getReviews();
  const myWritten  = reviews.filter(r => r.reviewerId === _empId());
  const myReceived = reviews.filter(r => r.revieweeId === _empId());
  const writtenFor = new Set(myWritten.filter(r => r.cycleId === cycle.id).map(r => r.revieweeId));
  const pending    = DEMO_PEERS.filter(p => !writtenFor.has(p.id)).length;

  root.innerHTML = `
<div class="page" id="pr-page" style="background:var(--bg);display:flex;flex-direction:column;height:100vh;overflow:hidden">
  <div class="top-bar" style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="pr-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🔄 360° 동료 피드백</div>
      <div style="font-size:11px;color:var(--text-muted)">${cycle.name} · 마감 ${cycle.deadline}</div>
    </div>
    <button id="pr-share-btn"
      style="padding:6px 12px;background:#EEF2FF;color:#4F46E5;border:1.5px solid #C7D2FE;
             border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">🔗 공유</button>
  </div>

  <!-- 탭바 -->
  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['write','평가 작성'],['result','내 피드백 결과']].map(([k,l]) => `
    <button class="pr-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:3px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">
      ${l}${k==='write' && pending ? ` <span style="background:#EF4444;color:#fff;font-size:9px;border-radius:99px;padding:1px 5px;margin-left:2px">${pending}</span>` : ''}
    </button>`).join('')}
  </div>

  <div class="page-content" id="pr-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab === 'write'
      ? (_selPeer ? _renderForm(_selPeer, cycle) : _renderPeerList(DEMO_PEERS, writtenFor))
      : _renderResult(myReceived)}
  </div>
</div>`;

  _bindEvents(root, writtenFor, myReceived, cycle);

  // 방사형 차트 그리기 (result 탭)
  if (_tab === 'result' && myReceived.length) {
    requestAnimationFrame(() => _drawRadar(root, myReceived));
  }
}

// ── 이벤트 바인딩 ────────────────────────────────────────────
function _bindEvents(root, writtenFor, myReceived, cycle) {
  root.querySelector('#pr-back')?.addEventListener('click', () => {
    if (_selPeer) { _selPeer = null; _scores = {}; _render(root); }
    else window.navBack();
  });

  root.querySelectorAll('.pr-tab').forEach(b => b.addEventListener('click', () => {
    _tab = b.dataset.tab; _selPeer = null; _render(root);
  }));

  // 공유 버튼 — URL 클립보드 복사
  root.querySelector('#pr-share-btn')?.addEventListener('click', () => {
    const link = `${location.origin}${location.pathname}#/peer-review?target=${_empId()}`;
    navigator.clipboard?.writeText(link).then(() => {
      showToast('피드백 링크가 복사되었습니다.', 'success');
    }).catch(() => {
      showToast('링크: ' + link, 'info', 5000);
    });
  });

  if (_tab === 'write' && !_selPeer) {
    root.querySelectorAll('.pr-peer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _selPeer = DEMO_PEERS.find(p => p.id === btn.dataset.id);
        _scores  = {};
        _render(root);
      });
    });
  }

  if (_selPeer) _bindFormEvents(root, cycle);
}

// ── 평가 폼 이벤트 ───────────────────────────────────────────
function _bindFormEvents(root, cycle) {
  root.querySelectorAll('.pr-star-row').forEach(row => {
    const comp = row.dataset.comp;
    row.querySelectorAll('.pr-star').forEach(star => {
      star.addEventListener('click', () => {
        _scores[comp] = parseInt(star.dataset.val);
        _updateStarRow(root, comp, _scores[comp]);
        _updateAvgBadge(root);
      });
    });
  });

  root.querySelector('#pr-submit')?.addEventListener('click', async () => {
    const comment = root.querySelector('#pr-comment')?.value.trim();
    const missing = COMPETENCIES.filter(c => !_scores[c.key]);
    if (missing.length) { showToast(`"${missing[0].label}" 점수를 선택하세요.`, 'error'); return; }
    if (!comment) { showToast('종합 의견을 작성해주세요.', 'error'); return; }

    const entry = {
      id: 'PR_' + Date.now(),
      cycleId: cycle.id,
      reviewerId: _empId(), reviewerName: _empName(),
      revieweeId: _selPeer.id, revieweeName: _selPeer.name,
      scores: { ..._scores },
      comment,
      createdAt: new Date().toISOString(),
    };

    const list = _getReviews();
    list.push(entry);
    _save(list);

    // Supabase performance_reviews 저장
    const user = _getUser();
    if (user.id) {
      const avgScore = Object.values(_scores).reduce((a, b) => a + b, 0) / Object.keys(_scores).length;
      api.performance?.saveReview?.({
        id: entry.id,
        reviewerId: user.id,
        revieweeId: _selPeer.id,
        cycleId: cycle.id,
        overallScore: parseFloat(avgScore.toFixed(1)),
        scores: _scores,
        comment,
        evaluatorType: 'peer',
        status: 'completed',
        submittedAt: entry.createdAt,
      }).catch(() => {});
    }

    showToast(`${_selPeer.name}님 평가 완료!`, 'success')
    addNotification({ type: 'success', title: '동료 평가', body: '님 평가 완료!' });
    addNotification({ type: 'system', title: `동료 평가 제출: ${_selPeer.name}`, body: '' });
    _selPeer = null; _scores = {};
    _render(root);
  });
}

function _updateStarRow(root, comp, val) {
  const row = root.querySelector(`.pr-star-row[data-comp="${comp}"]`);
  if (!row) return;
  row.querySelectorAll('.pr-star').forEach(s => {
    const v = parseInt(s.dataset.val);
    s.textContent = v <= val ? '★' : '☆';
    s.style.color = v <= val ? '#F59E0B' : '#CBD5E1';
  });
  const lbl = row.querySelector('.pr-score-label');
  if (lbl) { lbl.textContent = SCORE_LABELS[val]; lbl.style.color = SCORE_COLORS[val]; }
}

function _updateAvgBadge(root) {
  const vals = Object.values(_scores);
  if (!vals.length) return;
  const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  const el = root.querySelector('#pr-avg-score');
  if (el) { el.textContent = avg; el.style.color = SCORE_COLORS[Math.round(parseFloat(avg))] || '#F59E0B'; }
}

// ── 피어 목록 ────────────────────────────────────────────────
function _renderPeerList(peers, writtenFor) {
  if (!peers.length) return `
    <div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
      <div style="font-size:40px;margin-bottom:10px">🔄</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:4px">평가 대상이 없습니다</div>
      <div style="font-size:12px">관리자가 동료 평가 사이클을 설정하면 평가할 수 있습니다.</div>
    </div>`;
  const done  = peers.filter(p => writtenFor.has(p.id)).length;
  const total = peers.length;
  const pct   = total ? Math.round((done / total) * 100) : 0;

  return `
<div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border-radius:14px;
     padding:16px;margin-bottom:14px;color:#fff">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <div style="font-size:13px;font-weight:700">평가 진행률</div>
    <div style="font-size:20px;font-weight:900">${pct}%</div>
  </div>
  <div style="background:rgba(255,255,255,0.25);border-radius:99px;height:6px;margin-bottom:6px">
    <div style="background:var(--card-bg);height:6px;border-radius:99px;width:${pct}%;transition:width 0.3s"></div>
  </div>
  <div style="font-size:11px;opacity:0.8">${done}/${total}명 완료 · 마감: ${DEMO_CYCLE.deadline}</div>
</div>

<div style="background:#EEF2FF;border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:#4338CA;line-height:1.6">
  💡 모든 평가는 <strong>익명</strong>으로 처리됩니다. 동료의 성장을 위해 진솔하게 작성해주세요.
</div>

${peers.map(p => {
  const isDone = writtenFor.has(p.id);
  return `
<div style="background:var(--card-bg);border:1.5px solid ${isDone?'#D1FAE5':'var(--border)'};
     border-radius:12px;padding:14px;margin-bottom:8px;
     display:flex;align-items:center;justify-content:space-between">
  <div style="display:flex;align-items:center;gap:12px">
    <div style="width:42px;height:42px;border-radius:50%;
         background:${isDone?'#D1FAE5':'#EEF2FF'};
         display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;
         color:${isDone?'#10B981':'#4F46E5'};flex-shrink:0">${p.name[0]}</div>
    <div>
      <div style="font-size:14px;font-weight:700;color:var(--text)">${p.name}</div>
      <div style="font-size:11px;color:var(--text-muted)">${p.dept} · ${p.position}</div>
    </div>
  </div>
  ${isDone
    ? `<span style="font-size:12px;font-weight:600;padding:5px 12px;border-radius:8px;background:#D1FAE5;color:#10B981">완료 ✓</span>`
    : `<button class="pr-peer-btn" data-id="${p.id}"
         style="padding:8px 14px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">평가하기</button>`}
</div>`;
}).join('')}`;
}

// ── 평가 폼 ──────────────────────────────────────────────────
function _renderForm(peer) {
  const avgScore = Object.keys(_scores).length
    ? (Object.values(_scores).reduce((a, b) => a + b, 0) / Object.keys(_scores).length).toFixed(1)
    : '-';

  return `
<!-- 대상자 카드 -->
<div style="display:flex;align-items:center;gap:12px;background:var(--card-bg);border:1px solid var(--border);
     border-radius:12px;padding:14px;margin-bottom:14px">
  <div style="width:46px;height:46px;border-radius:50%;background:#EEF2FF;
       display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#4F46E5">${peer.name[0]}</div>
  <div>
    <div style="font-size:14px;font-weight:700;color:var(--text)">${peer.name}</div>
    <div style="font-size:11px;color:var(--text-muted)">${peer.dept} · ${peer.position}</div>
  </div>
  <div style="margin-left:auto;text-align:center">
    <div id="pr-avg-score" style="font-size:22px;font-weight:900;color:#F59E0B">${avgScore}</div>
    <div style="font-size:9px;color:var(--text-muted)">평균 점수</div>
  </div>
</div>

<!-- 역량별 평가 -->
${COMPETENCIES.map(c => `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
    <span style="font-size:16px">${c.icon}</span>
    <span style="font-size:13px;font-weight:700;color:var(--text)">${c.label}</span>
  </div>
  <div style="font-size:10px;color:var(--text-muted);margin-bottom:8px">${c.desc}</div>
  <div class="pr-star-row" data-comp="${c.key}" style="display:flex;align-items:center;gap:4px">
    ${[1,2,3,4,5].map(v => `
    <button class="pr-star" data-val="${v}"
      style="font-size:30px;background:none;border:none;cursor:pointer;padding:0;line-height:1;
             color:${(_scores[c.key]||0)>=v?'#F59E0B':'#CBD5E1'}">${(_scores[c.key]||0)>=v?'★':'☆'}</button>`).join('')}
    <span class="pr-score-label" style="font-size:11px;font-weight:600;margin-left:6px;color:${SCORE_COLORS[_scores[c.key]||0]||'var(--text-muted)'}">
      ${_scores[c.key] ? SCORE_LABELS[_scores[c.key]] : '선택하세요'}
    </span>
  </div>
</div>`).join('')}

<!-- 종합 의견 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:14px">
  <label style="font-size:12px;font-weight:700;color:var(--text);display:block;margin-bottom:6px">종합 의견 (필수)</label>
  <textarea maxlength="500" id="pr-comment" rows="4" placeholder="${peer.name}님의 강점과 성장 기회를 구체적으로 작성해주세요."
    style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;
           font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box;resize:vertical;line-height:1.6"></textarea>
</div>

<button id="pr-submit"
  style="width:100%;background:#4F46E5;color:#fff;border:none;border-radius:12px;padding:14px;font-size:14px;font-weight:700;cursor:pointer">
  평가 제출
</button>`;
}

// ── 결과 탭 ─────────────────────────────────────────────────
function _renderResult(reviews) {
  if (!reviews.length) {
    return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:48px;margin-bottom:12px">💌</div>
  <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:6px">아직 받은 피드백이 없습니다</div>
      <button onclick="location.hash='#/peer-review'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">동료 평가 요청</button>
    
  <div style="font-size:12px;line-height:1.6">동료가 평가를 완료하면<br>역량 방사형 차트와 함께 표시됩니다.</div>
</div>`;
  }

  // 역량별 평균 계산
  const avgMap = {};
  COMPETENCIES.forEach(c => { avgMap[c.key] = []; });
  reviews.forEach(r => {
    Object.entries(r.scores || {}).forEach(([k, v]) => { if (avgMap[k]) avgMap[k].push(v); });
  });
  const avgs = COMPETENCIES.map(c => {
    const vals = avgMap[c.key];
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  });
  const overallAvg = (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(1);
  const maxComp = COMPETENCIES[avgs.indexOf(Math.max(...avgs))];
  const minComp = COMPETENCIES[avgs.indexOf(Math.min(...avgs))];

  return `
<!-- 총평 카드 -->
<div style="background:linear-gradient(135deg,#F59E0B,#EF4444);border-radius:14px;
     padding:18px;margin-bottom:14px;color:#fff">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <div>
      <div style="font-size:11px;opacity:0.85;margin-bottom:2px">${reviews.length}명이 평가한 나의 점수</div>
      <div style="font-size:36px;font-weight:900;line-height:1">${overallAvg}<span style="font-size:18px"> / 5</span></div>
    </div>
    <div style="font-size:44px">${parseFloat(overallAvg)>=4?'🌟':parseFloat(overallAvg)>=3?'👍':'💪'}</div>
  </div>
  <div style="display:flex;gap:12px;font-size:11px;opacity:0.9">
    <span>강점 ${maxComp?.icon} ${maxComp?.label} ${avgs[COMPETENCIES.indexOf(maxComp)]?.toFixed(1)}</span>
    <span>·</span>
    <span>성장 ${minComp?.icon} ${minComp?.label} ${avgs[COMPETENCIES.indexOf(minComp)]?.toFixed(1)}</span>
  </div>
</div>

<!-- 방사형 차트 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:12px">역량 방사형 차트</div>
  <div style="display:flex;justify-content:center">
    <canvas id="pr-radar" width="280" height="280"></canvas>
  </div>
</div>

<!-- 역량별 상세 바 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:10px">역량별 평균</div>
  ${COMPETENCIES.map((c, i) => {
    const avg = avgs[i];
    const pct = (avg / 5) * 100;
    return `
  <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
    <span style="font-size:18px;flex-shrink:0">${c.icon}</span>
    <div style="flex:1">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:12px;font-weight:600;color:var(--text)">${c.label}</span>
        <span style="font-size:12px;font-weight:700;color:${SCORE_COLORS[Math.round(avg)] || '#F59E0B'}">${avg.toFixed(1)}</span>
      </div>
      <div style="background:#E2E8F0;border-radius:99px;height:5px">
        <div style="background:${SCORE_COLORS[Math.round(avg)]||'#F59E0B'};height:5px;border-radius:99px;width:${pct}%;transition:width 0.4s"></div>
      </div>
    </div>
  </div>`;
  }).join('')}
</div>

<!-- 받은 코멘트 -->
<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px">받은 의견 (익명, ${reviews.length}건)</div>
${reviews.map(r => {
  const avg = Object.values(r.scores || {}).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(r.scores || {}).length);
  const stars = Math.round(avg);
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <div style="font-size:11px;color:var(--text-muted)">익명 · ${r.createdAt?.slice(0,10)||''}</div>
    <div style="font-size:13px;color:#F59E0B">${'★'.repeat(stars)}${'☆'.repeat(5-stars)}</div>
  </div>
  <div style="font-size:13px;color:var(--text);line-height:1.7;font-style:italic">"${r.comment}"</div>
</div>`;
}).join('')}
<div style="height:60px"></div>`;
}

// ── 방사형 차트 그리기 ────────────────────────────────────────
function _drawRadar(root, reviews) {
  const canvas = root.querySelector('#pr-radar');
  if (!canvas) return;

  const avgMap = {};
  COMPETENCIES.forEach(c => { avgMap[c.key] = []; });
  reviews.forEach(r => {
    Object.entries(r.scores || {}).forEach(([k, v]) => { if (avgMap[k]) avgMap[k].push(v); });
  });
  const avgs = COMPETENCIES.map(c => {
    const vals = avgMap[c.key];
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  });

  try {
    const chart = new RadarChart(canvas, {
      maxValue: 5,
      gridLevels: 5,
      padding: 50,
      showLegend: false,
      animDuration: 700,
    });
    chart.setData({
      labels: COMPETENCIES.map(c => c.label),
      as_is:  avgs,
      to_be:  [5, 5, 5, 5, 5],
    });
  } catch {
    // RadarChart 실패 시 SVG 폴백
    _drawRadarSVG(canvas, avgs);
  }
}

function _drawRadarSVG(canvas, avgs) {
  const size = 280;
  const cx = size / 2, cy = size / 2, r = 100;
  const n = avgs.length;
  const angles = avgs.map((_, i) => (Math.PI * 2 * i / n) - Math.PI / 2);

  const grid = [1, 2, 3, 4, 5].map(lv => {
    const pts = angles.map(a => `${cx + r * lv / 5 * Math.cos(a)},${cy + r * lv / 5 * Math.sin(a)}`).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="#E2E8F0" stroke-width="1"/>`;
  }).join('');

  const axes = angles.map((a, i) => {
    const lx = cx + (r + 22) * Math.cos(a);
    const ly = cy + (r + 22) * Math.sin(a);
    return `<line x1="${cx}" y1="${cy}" x2="${cx + r * Math.cos(a)}" y2="${cy + r * Math.sin(a)}" stroke="#E2E8F0" stroke-width="1"/>
      <text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="9" fill="var(--text-muted)">${COMPETENCIES[i].label}</text>`;
  }).join('');

  const dataPts = avgs.map((v, i) => `${cx + r * v / 5 * Math.cos(angles[i])},${cy + r * v / 5 * Math.sin(angles[i])}`).join(' ');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${grid}${axes}
    <polygon points="${dataPts}" fill="#4F46E533" stroke="#4F46E5" stroke-width="2"/>
    ${avgs.map((v, i) => `<circle cx="${cx + r * v / 5 * Math.cos(angles[i])}" cy="${cy + r * v / 5 * Math.sin(angles[i])}" r="4" fill="#4F46E5"/>`).join('')}
  </svg>`;

  const parent = canvas.parentElement;
  canvas.style.display = 'none';
  const div = document.createElement('div');
  div.innerHTML = svg;
  parent.appendChild(div.firstElementChild);
}
