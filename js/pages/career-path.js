/**
 * career-path.js — 경력 개발 경로
 */

import {getUser, isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

function _session() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}'); } catch { return {}; } }

const LS = 'hr_career_paths';

const CAREER_TRACKS = [
  {
    id: 'hr-bp',
    title: 'HR Business Partner',
    family: 'HR',
    icon: '👥',
    level: '과장~부장',
    competencies: [
      { name: '전략적 HRM',       weight: 5 },
      { name: '조직 진단·변화관리', weight: 5 },
      { name: '노무법령 전문성',    weight: 4 },
      { name: '비즈니스 파트너십',  weight: 5 },
      { name: '데이터 분석',        weight: 3 },
      { name: '코칭 & 퍼실리테이션',weight: 4 },
    ],
    recommendedTrainings: ['전략적 HRM 인증과정', '조직개발 심화', '노무사 자격증', '비즈니스 전략 이해'],
    avgYears: 8,
  },
  {
    id: 'frontend-lead',
    title: '프론트엔드 테크리드',
    family: '개발',
    icon: '💻',
    level: '시니어',
    competencies: [
      { name: 'React/TypeScript',   weight: 5 },
      { name: '성능 최적화',        weight: 5 },
      { name: '아키텍처 설계',      weight: 5 },
      { name: '코드 리뷰 & 멘토링', weight: 4 },
      { name: '프로젝트 관리',      weight: 3 },
      { name: '커뮤니케이션',       weight: 4 },
    ],
    recommendedTrainings: ['시스템 설계 심화', 'Web Performance 인증', 'AWS Solutions Architect', '테크 리더십 과정'],
    avgYears: 7,
  },
  {
    id: 'data-analyst',
    title: '데이터 분석가',
    family: '데이터',
    icon: '📊',
    level: '주니어~시니어',
    competencies: [
      { name: 'SQL & 데이터 추출', weight: 5 },
      { name: '통계 분석',         weight: 5 },
      { name: '시각화 (Tableau 등)', weight: 4 },
      { name: 'Python/R',           weight: 4 },
      { name: '비즈니스 인사이트', weight: 5 },
      { name: '프레젠테이션',      weight: 3 },
    ],
    recommendedTrainings: ['SQL 고급 과정', 'Python 데이터 분석', 'Tableau 인증', 'A/B Testing 이론'],
    avgYears: 5,
  },
  {
    id: 'product-manager',
    title: '프로덕트 매니저',
    family: '기획',
    icon: '🎯',
    level: '대리~과장',
    competencies: [
      { name: '제품 전략',          weight: 5 },
      { name: '사용자 리서치',      weight: 5 },
      { name: '데이터 분석',        weight: 4 },
      { name: '스테이크홀더 관리', weight: 5 },
      { name: 'Agile/Scrum',        weight: 4 },
      { name: '커뮤니케이션',       weight: 5 },
    ],
    recommendedTrainings: ['제품 관리 인증(CPM)', 'UX 리서치 방법론', 'SQL 기초', 'OKR 워크숍'],
    avgYears: 6,
  },
  {
    id: 'marketing-manager',
    title: '마케팅 매니저',
    family: '마케팅',
    icon: '📢',
    level: '과장~차장',
    competencies: [
      { name: '디지털 마케팅',     weight: 5 },
      { name: '데이터 기반 의사결정', weight: 5 },
      { name: '브랜드 전략',       weight: 4 },
      { name: '예산 관리',         weight: 4 },
      { name: '팀 리더십',         weight: 5 },
      { name: '콘텐츠 기획',       weight: 3 },
    ],
    recommendedTrainings: ['Google Analytics 4 인증', '퍼포먼스 마케팅 심화', '브랜드 전략 과정', 'B2B SaaS 마케팅'],
    avgYears: 7,
  },
];

function _getData() { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } }
function _save(d) { localStorage.setItem(LS, JSON.stringify(d)); }

let _tab = 'explore';
let _selectedTrackId = null;
let _myScores = {};

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  const user = getUser();
  const data = _getData();
  const uid  = _session().empId || _session().userId || user?.id || 'demo';
  const myData = data[uid] || {};
  _selectedTrackId = myData.targetTrackId || null;
  _myScores = myData.scores || {};
  _tab = 'explore';
  _draw(root);
}

export function unmount() {
  _tab = 'explore';
  _selectedTrackId = null;
  _myScores = {};
}

function _draw(root) {
  const user = getUser();
  const uid  = _session().empId || _session().userId || user?.id || 'demo';
  const data = _getData();
  const myData = data[uid] || {};
  const targetTrack = _selectedTrackId ? CAREER_TRACKS.find(t => t.id === _selectedTrackId) : null;

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden">
  <div class="page-header" style="flex-shrink:0;background:var(--card-bg);border-bottom:1px solid var(--border);padding:16px;display:flex;align-items:center;gap:12px">
    <button onclick="window.navBack()"
      style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0;line-height:1">←</button>
    <div>
      <div style="font-size:16px;font-weight:700;color:var(--text)">경력 개발 경로</div>
      <div style="font-size:11px;color:var(--text-muted)">목표 직무 설정 · 역량 갭 분석</div>
    </div>
  </div>

  <div style="flex-shrink:0;display:flex;border-bottom:1px solid var(--border);background:var(--card-bg)">
    <button class="cp-tab" data-t="explore"
      style="flex:1;padding:12px;font-size:13px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab==='explore'?'#4F46E5':'transparent'};color:${_tab==='explore'?'#4F46E5':'var(--text-muted)'}">
      경로 탐색</button>
    <button class="cp-tab" data-t="gap"
      style="flex:1;padding:12px;font-size:13px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab==='gap'?'#4F46E5':'transparent'};color:${_tab==='gap'?'#4F46E5':'var(--text-muted)'}">
      역량 갭${targetTrack ? ' ✓' : ''}</button>
    <button class="cp-tab" data-t="plan"
      style="flex:1;padding:12px;font-size:13px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab==='plan'?'#4F46E5':'transparent'};color:${_tab==='plan'?'#4F46E5':'var(--text-muted)'}">
      개발 계획</button>
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">
    ${_tab === 'explore' ? _renderExplore(targetTrack) : ''}
    ${_tab === 'gap'     ? _renderGap(targetTrack)     : ''}
    ${_tab === 'plan'    ? _renderPlan(targetTrack, myData) : ''}
  </div>
</div>`;

  root.querySelectorAll('.cp-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _draw(root); });
  });

  root.querySelectorAll('.cp-select-track').forEach(btn => {
    btn.addEventListener('click', () => {
      _selectedTrackId = btn.dataset.id;
      _myScores = {};
      const data2 = _getData();
      data2[uid] = { ...(data2[uid] || {}), targetTrackId: _selectedTrackId, scores: {} };
      _save(data2);
      showToast('목표 직무가 설정되었습니다!', 'success');
      addNotification({ type: 'info', title: '경력 경로 설정', message: `목표: ${CAREER_TRACKS.find(t=>t.id===_selectedTrackId)?.title}` });
      _tab = 'gap';
      _draw(root);
    });
  });

  if (_tab === 'gap' && targetTrack) {
    root.querySelectorAll('.cp-score-range').forEach(input => {
      input.addEventListener('input', () => {
        const cname = input.dataset.comp;
        _myScores[cname] = Number(input.value);
        const label = root.querySelector(`.cp-score-label[data-comp="${CSS.escape(cname)}"]`);
        if (label) label.textContent = `${input.value} / 5`;
      });
    });

    root.querySelector('#cp-save-scores')?.addEventListener('click', () => {
      const data2 = _getData();
      data2[uid] = { ...(data2[uid] || {}), scores: { ..._myScores } };
      _save(data2);
      showToast('역량 자가평가가 저장되었습니다.', 'success');
    });
  }
}

function _renderExplore(targetTrack) {
  return `
${targetTrack ? `
<div style="background:#EEF2FF;border:1.5px solid #C7D2FE;border-radius:12px;padding:12px;margin-bottom:14px">
  <div style="font-size:12px;color:#4F46E5;font-weight:700;margin-bottom:2px">현재 목표 직무</div>
  <div style="font-size:14px;font-weight:800;color:#4F46E5">${targetTrack.icon} ${targetTrack.title}</div>
  <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${targetTrack.family} · 평균 ${targetTrack.avgYears}년 경력</div>
</div>` : `
<div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:12px;padding:12px;margin-bottom:14px">
  <div style="font-size:12px;color:#D97706;font-weight:700">아래에서 목표 직무를 선택하세요</div>
</div>`}

${CAREER_TRACKS.map(t => {
  const isTarget = _selectedTrackId === t.id;
  return `
<div style="background:var(--card-bg);border:${isTarget?'2px solid #4F46E5':'1px solid var(--border)'};border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:28px">${t.icon}</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${t.title}</div>
        <div style="font-size:11px;color:var(--text-muted)">${t.family} · ${t.level} · 평균 ${t.avgYears}년</div>
      </div>
    </div>
    ${isTarget
      ? `<span style="padding:5px 10px;background:#EEF2FF;color:#4F46E5;border-radius:8px;font-size:11px;font-weight:700">✓ 목표 설정됨</span>`
      : `<button class="cp-select-track" data-id="${t.id}"
          style="padding:5px 12px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">
          목표 설정
        </button>`}
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:5px">
    ${t.competencies.map(c => `<span style="padding:3px 8px;background:#F1F5F9;border-radius:6px;font-size:10px;color:#475569">${c.name}</span>`).join('')}
  </div>
</div>`;
}).join('')}`;
}

function _renderGap(targetTrack) {
  if (!targetTrack) {
    return `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
      <div style="font-size:40px;margin-bottom:12px">🎯</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:6px">목표 직무를 먼저 설정해주세요</div>
      <div style="font-size:12px">경로 탐색 탭에서 목표 직무를 선택하면 역량 갭을 분석할 수 있습니다</div>
    </div>`;
  }

  return `
<div style="margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">${targetTrack.icon} ${targetTrack.title}</div>
  <div style="font-size:12px;color:var(--text-muted)">현재 역량 수준을 1~5점으로 자가평가하세요</div>
</div>

${targetTrack.competencies.map(c => {
  const myScore = _myScores[c.name] ?? 0;
  const gap = c.weight - myScore;
  const gapColor = gap <= 0 ? '#10B981' : gap <= 1 ? '#F59E0B' : '#EF4444';
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <span style="font-size:12px;font-weight:700;color:var(--text)">${c.name}</span>
    <div style="display:flex;align-items:center;gap:6px">
      <span style="font-size:10px;color:var(--text-muted)">목표 ${c.weight}/5</span>
      <span class="cp-score-label" data-comp="${c.name}"
        style="font-size:12px;font-weight:700;color:#4F46E5">${myScore} / 5</span>
    </div>
  </div>
  <!-- 목표 바 -->
  <div style="position:relative;height:8px;background:#E2E8F0;border-radius:4px;margin-bottom:6px">
    <div style="position:absolute;left:0;top:0;height:100%;border-radius:4px;background:#E2E8F0;width:100%"></div>
    <div style="position:absolute;left:0;top:0;height:100%;border-radius:4px;background:#CBD5E1;width:${c.weight*20}%"></div>
    <div style="position:absolute;left:0;top:0;height:100%;border-radius:4px;background:#4F46E5;width:${myScore*20}%;transition:width .3s"></div>
  </div>
  <input type="range" class="cp-score-range" data-comp="${c.name}" min="0" max="5" step="1" value="${myScore}"
    style="width:100%;accent-color:#4F46E5;cursor:pointer">
  ${gap > 0 ? `<div style="margin-top:6px;font-size:10px;font-weight:700;color:${gapColor}">갭 ${gap}점 — ${gap>=2?'집중 개발 필요':'거의 도달'}</div>` : `<div style="margin-top:6px;font-size:10px;font-weight:700;color:#10B981">✅ 목표 달성</div>`}
</div>`;
}).join('')}

<button id="cp-save-scores"
  style="width:100%;padding:13px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-top:8px">
  자가평가 저장
</button>`;
}

function _renderPlan(targetTrack, myData) {
  if (!targetTrack) {
    return `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
      <div style="font-size:40px;margin-bottom:12px">📋</div>
      <div style="font-size:14px;font-weight:600">목표 직무를 먼저 설정해주세요</div>
    </div>`;
  }

  const scores = myData.scores || {};
  const gaps = targetTrack.competencies
    .map(c => ({ ...c, myScore: scores[c.name] ?? 0, gap: c.weight - (scores[c.name] ?? 0) }))
    .sort((a, b) => b.gap - a.gap);

  const totalGap = gaps.reduce((n, g) => n + Math.max(0, g.gap), 0);
  const maxGap   = gaps.reduce((n, g) => n + g.weight, 0);
  const readiness = Math.round((1 - totalGap / maxGap) * 100);

  return `
<!-- 준비도 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px;text-align:center">
  <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">목표 직무 준비도</div>
  <div style="font-size:36px;font-weight:900;color:${readiness>=80?'#10B981':readiness>=50?'#F59E0B':'#EF4444'}">${readiness}%</div>
  <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${targetTrack.icon} ${targetTrack.title}</div>
  <div style="height:10px;background:#E2E8F0;border-radius:5px;margin-top:12px;overflow:hidden">
    <div style="height:100%;background:${readiness>=80?'#10B981':readiness>=50?'#F59E0B':'#4F46E5'};border-radius:5px;width:${readiness}%;transition:width .5s"></div>
  </div>
</div>

<!-- 우선 개발 역량 -->
<div style="margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px">📌 우선 개발 역량 (갭 큰 순)</div>
  ${gaps.filter(g => g.gap > 0).slice(0,3).map((g, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;margin-bottom:6px">
      <span style="width:22px;height:22px;border-radius:50%;background:${i===0?'#EF4444':i===1?'#F59E0B':'#3B82F6'};color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</span>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:700;color:var(--text)">${g.name}</div>
        <div style="font-size:10px;color:var(--text-muted)">현재 ${g.myScore}/5 → 목표 ${g.weight}/5 (갭 ${g.gap})</div>
      </div>
    </div>`).join('')}
  ${!gaps.filter(g => g.gap > 0).length ? `<div style="font-size:12px;color:#10B981;text-align:center;padding:12px">🎉 모든 역량이 목표를 달성했습니다!</div>` : ''}
</div>

<!-- 추천 교육 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">📚 추천 교육 과정</div>
  ${targetTrack.recommendedTrainings.map(t => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:14px">🎓</span>
      <span style="font-size:12px;color:#475569">${t}</span>
    </div>`).join('')}
</div>

<div style="margin-top:14px;padding:12px;background:#EEF2FF;border-radius:10px;font-size:11px;color:#4F46E5;text-align:center">
  역량 갭 탭에서 자가평가를 완료하면 준비도가 업데이트됩니다
</div>`;
}
