/**
 * growth.js – 내 성장 (My Growth)
 * Unified results + IDP with Meet/Exceed/Under visualization
 */

import { isApplicant } from '../auth.js';
import { api }          from '../api.js';
import { RadarChart }   from '../components/radar-chart.js';
import { showAskPopup } from '../components/ask-popup.js';
import { showToast }    from '../components/toast.js';
import { formatScore, determineLevel } from '../utils/score.js';
import { exportGoalsCsv, exportReviewsCsv, exportMeetingsCsv, exportGrowthReport } from '../utils/export.js';
import { getUser }      from '../auth.js';
import { addNotification } from '../components/notification-hub.js';

function _session() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}'); } catch { return {}; } }

let _root       = null;
let _radarChart = null;
let _activeTab  = 'overview';
let _managerCtx = null;

const LS_DIAG    = 'hr_diag_results';
const LS_HISTORY = 'hr_growth_history';

// ── Demo history seed (진단 이력 데모 데이터) ──────────────────
const DEMO_HISTORY = [
  { date:'2025-10-15', cycleName:'2025 상반기 진단', final_score:3.10, final_rating:'L2',
    scores:[{competency_id:'COMP_CORE_AI',name:'AI 활용 능력',as_is_score:2.8},{competency_id:'COMP_CORE_DATA',name:'데이터 분석',as_is_score:3.5},{competency_id:'COMP_CORE_COMM',name:'커뮤니케이션',as_is_score:2.9},{competency_id:'COMP_CORE_LEAD',name:'리더십',as_is_score:2.7},{competency_id:'COMP_CORE_PROB',name:'문제 해결',as_is_score:3.5}] },
  { date:'2025-12-20', cycleName:'2025 하반기 진단', final_score:3.35, final_rating:'L2',
    scores:[{competency_id:'COMP_CORE_AI',name:'AI 활용 능력',as_is_score:3.1},{competency_id:'COMP_CORE_DATA',name:'데이터 분석',as_is_score:3.7},{competency_id:'COMP_CORE_COMM',name:'커뮤니케이션',as_is_score:3.1},{competency_id:'COMP_CORE_LEAD',name:'리더십',as_is_score:2.9},{competency_id:'COMP_CORE_PROB',name:'문제 해결',as_is_score:3.7}] },
  { date:'2026-03-10', cycleName:'2026 상반기 진단', final_score:3.55, final_rating:'L2',
    scores:[{competency_id:'COMP_CORE_AI',name:'AI 활용 능력',as_is_score:3.4},{competency_id:'COMP_CORE_DATA',name:'데이터 분석',as_is_score:3.9},{competency_id:'COMP_CORE_COMM',name:'커뮤니케이션',as_is_score:3.3},{competency_id:'COMP_CORE_LEAD',name:'리더십',as_is_score:3.1},{competency_id:'COMP_CORE_PROB',name:'문제 해결',as_is_score:3.8}] },
  { date:'2026-06-01', cycleName:'2026 역량 진단',   final_score:3.74, final_rating:'L2',
    scores:[{competency_id:'COMP_CORE_AI',name:'AI 활용 능력',as_is_score:3.8},{competency_id:'COMP_CORE_DATA',name:'데이터 분석',as_is_score:4.1},{competency_id:'COMP_CORE_COMM',name:'커뮤니케이션',as_is_score:3.5},{competency_id:'COMP_CORE_LEAD',name:'리더십',as_is_score:3.3},{competency_id:'COMP_CORE_PROB',name:'문제 해결',as_is_score:4.0}] },
];

// ── Demo data ─────────────────────────────────────────────────

const DEMO_RESULTS = {
  scores: [
    { competency_id:'COMP_CORE_AI',   competency_name_ko:'AI 활용 능력',  as_is_score:3.8, to_be_score:4.5, level:'L2',
      ask:{ ability:{L1:'기본 AI 도구 사용',L2:'AI 솔루션 설계',L3:'AI 전략 수립'}, skill:{L1:'프롬프트 작성',L2:'파인튜닝',L3:'MLOps'}, knowledge:{L1:'AI 기초',L2:'머신러닝',L3:'AI 윤리'} } },
    { competency_id:'COMP_CORE_DATA', competency_name_ko:'데이터 분석',    as_is_score:4.1, to_be_score:4.5, level:'L3',
      ask:{ ability:{L1:'기초 통계',L2:'고급 모델링',L3:'인사이트 도출'}, skill:{L1:'Excel',L2:'SQL/Python',L3:'BI 구축'}, knowledge:{L1:'통계 개념',L2:'예측 분석',L3:'데이터 전략'} } },
    { competency_id:'COMP_CORE_COMM', competency_name_ko:'커뮤니케이션',   as_is_score:3.5, to_be_score:4.0, level:'L2',
      ask:{ ability:{L1:'메시지 전달',L2:'이해관계자 설득',L3:'문화 조성'}, skill:{L1:'문서 작성',L2:'협상',L3:'임원 보고'}, knowledge:{L1:'비즈니스 문서',L2:'설득 이론',L3:'조직 전략'} } },
    { competency_id:'COMP_CORE_LEAD', competency_name_ko:'리더십',          as_is_score:3.3, to_be_score:4.0, level:'L2',
      ask:{ ability:{L1:'팀원 동기부여',L2:'팀 목표 관리',L3:'비전 수립'}, skill:{L1:'피드백',L2:'성과 코칭',L3:'변화 관리'}, knowledge:{L1:'리더십 스타일',L2:'팀 역학',L3:'전략 리더십'} } },
    { competency_id:'COMP_CORE_PROB', competency_name_ko:'문제 해결',       as_is_score:4.0, to_be_score:4.5, level:'L2',
      ask:{ ability:{L1:'원인 분석',L2:'구조화 설계',L3:'조직 역량 강화'}, skill:{L1:'5-Why',L2:'가설 기반 분석',L3:'시스템 사고'}, knowledge:{L1:'기본 방법론',L2:'디자인 씽킹',L3:'시스템 다이나믹스'} } },
  ],
  final_score: 3.74,
  final_rating: 'L2',
};

const DEMO_IDP = [
  { competency_name_ko:'AI 활용 능력',  gap:0.7, priority:'High',   action_type:'training', resource_title_ko:'생성형 AI 활용 심화 과정',   target_date:'2024-12-31', status:'not_started' },
  { competency_name_ko:'리더십',         gap:0.7, priority:'High',   action_type:'mentoring',resource_title_ko:'리더십 코칭 프로그램',        target_date:'2024-12-31', status:'not_started' },
  { competency_name_ko:'커뮤니케이션',  gap:0.5, priority:'Medium', action_type:'study',    resource_title_ko:'비즈니스 커뮤니케이션 스킬업', target_date:'2025-03-31', status:'not_started' },
  { competency_name_ko:'문제 해결',      gap:0.5, priority:'Medium', action_type:'project',  resource_title_ko:'애자일 프로젝트 참여',          target_date:'2025-03-31', status:'in_progress' },
];

// ── Mount / Unmount ───────────────────────────────────────────

export async function mount(container) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _root = container;
  _activeTab = 'overview';
  _managerCtx = window.appState?.managerViewEmployee || null;
  if (_managerCtx) delete window.appState.managerViewEmployee;
  renderSkeleton(container);
  const data = await fetchResults();
  renderPage(container, data);
}

export function unmount() {
  if (_radarChart) { _radarChart.destroy(); _radarChart = null; }
  _root = null;
}

// ── Data fetch ────────────────────────────────────────────────

async function fetchResults() {
  const instanceId = window.appState?.instanceId;
  await _ensureHistory();

  // Demo mode: always return demo data (unless hr_comp_sessions also exist, in which case
  // demo users still see the full radar demo — hr_comp results visible via diagnostics tab)
  if (!instanceId && _isDemoGrowth()) return DEMO_RESULTS;

  if (instanceId) {
    try {
      const data = await api.assessment.getResults(instanceId);
      if (data && Array.isArray(data.scores) && data.scores.length > 0) return data;
    } catch {}
    if (_isDemoGrowth()) return DEMO_RESULTS;
  }

  // Fallback: HR 직무역량트리 sessions (hr_competency.js writes here)
  const hrSessions = _getHrCompSessions();
  if (hrSessions.length > 0) return { _source: 'hr_competency', hrSessions };

  return null;
}

const _isDemoGrowth = () => localStorage.getItem('hr_token') === 'demo-token';

async function _ensureHistory() {
  try {
    const user = getUser();
    if (user?.id) {
      const res = await api.performance?.getHistory?.(user.id).catch(() => null);
      if (res?.history?.length) {
        const merged = _mergeHistory(
          res.history.map(h => ({ ...h, scores: typeof h.scores_json === 'string' ? JSON.parse(h.scores_json) : (h.scores || []) })),
          JSON.parse(localStorage.getItem(LS_HISTORY) || '[]'),
        );
        localStorage.setItem(LS_HISTORY, JSON.stringify(merged.slice(-12)));
        _checkLevelUpMilestone(merged, user.id);
        return;
      }
    }
    if (_isDemoGrowth()) {
      const raw = localStorage.getItem(LS_HISTORY);
      if (!raw || JSON.parse(raw).length === 0) {
        localStorage.setItem(LS_HISTORY, JSON.stringify(DEMO_HISTORY));
      }
    }
  } catch {
    if (_isDemoGrowth()) {
      const raw = localStorage.getItem(LS_HISTORY);
      if (!raw || JSON.parse(raw).length === 0) {
        localStorage.setItem(LS_HISTORY, JSON.stringify(DEMO_HISTORY));
      }
    }
  }
}

function _checkLevelUpMilestone(history, userId) {
  try {
    if (history.length < 2) return;
    const LEVEL_ORDER = ['L1', 'L2', 'L3'];
    const prev = history[history.length - 2];
    const curr = history[history.length - 1];
    const prevIdx = LEVEL_ORDER.indexOf(prev.final_rating);
    const currIdx = LEVEL_ORDER.indexOf(curr.final_rating);
    if (currIdx > prevIdx && currIdx >= 0) {
      const seenKey = `hr_milestone_levelup_${userId}_${curr.date}`;
      if (localStorage.getItem(seenKey)) return;
      localStorage.setItem(seenKey, '1');
      addNotification({
        id:    `levelup_${userId}_${curr.date}`,
        type:  'system',
        title: `🎉 레벨업! ${prev.final_rating} → ${curr.final_rating}`,
        body:  `역량 수준이 향상되었습니다. 계속 성장해 나가세요!`,
        route: '#/growth',
      });
    }
  } catch {}
}

function _mergeHistory(db, local) {
  const map = new Map();
  [...db, ...local].forEach(h => map.set(h.id || h.date, h));
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function _getHistory() {
  try {
    return JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
  } catch { return []; }
}

function _getHrCompSessions() {
  try {
    const raw = JSON.parse(localStorage.getItem('hr_comp_sessions') || '[]');
    return Array.isArray(raw) ? raw.filter(s => s.jobId) : [];
  } catch { return []; }
}

// ── Skeleton ──────────────────────────────────────────────────

function renderSkeleton(root) {
  root.innerHTML = `
    <div class="page">
      <div class="top-bar"><div class="top-bar-title">내 성장</div></div>
      <div class="page-content">
        <div class="skeleton" style="height:44px;border-radius:12px;margin-bottom:16px"></div>
        <div class="skeleton" style="height:300px;border-radius:16px;margin-bottom:20px"></div>
        ${[1,2,3].map(() => `<div class="skeleton skeleton-card" style="height:80px;margin-bottom:10px"></div>`).join('')}
      </div>
    </div>`;
}

// ── HR 직무역량 결과 페이지 (card-swipe 없이 hr_comp_sessions만 있는 경우) ──

function renderHrCompPage(root, sessions) {
  const levelColor = { L3: '#059669', L2: '#4F46E5', L1: '#D97706' };

  const sessionCards = [...sessions].reverse().map(s => {
    const score  = s.totalScore ?? s.result?.total_score ?? null;
    const level  = s.level   ?? s.result?.level ?? null;
    const date   = s.completedAt ? new Date(s.completedAt).toLocaleDateString('ko-KR') : '';
    const color  = levelColor[level] || 'var(--text-muted)';
    return `
      <div style="background:var(--surface);border:1px solid var(--border);
                  border-radius:var(--radius-md);padding:14px;margin-bottom:10px;
                  display:flex;align-items:center;gap:12px">
        <div style="width:42px;height:42px;border-radius:10px;background:#EEF2FF;
                    display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0">
          🌳
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:0.9rem;color:var(--text);
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${escapeHtml(s.jobName || s.jobId)}
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">${date}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          ${score != null ? `<div style="font-size:1.1rem;font-weight:800;color:${color}">${score}점</div>` : ''}
          ${level ? `<div style="font-size:0.7rem;font-weight:700;color:${color}">${escapeHtml(level)}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  root.innerHTML = `
    <div class="page" style="background:var(--bg)">
      <div class="top-bar">
        <div class="top-bar-title">내 성장</div>
      </div>
      <div class="page-content" style="padding-bottom:32px">

        <!-- 직무역량 진단 완료 배너 -->
        <div class="fade-in" style="text-align:center;padding:24px 20px;
                  background:linear-gradient(135deg,#EEF2FF,#F5F3FF);
                  border-radius:var(--radius-lg);border:1.5px solid #C7D2FE;margin-bottom:20px">
          <div style="font-size:2.5rem;margin-bottom:8px">🌳</div>
          <div style="font-weight:700;font-size:1rem;color:var(--text);margin-bottom:4px">
            HR 직무역량 진단 완료
          </div>
          <div style="font-size:0.82rem;color:var(--text-muted)">${sessions.length}개 직무 진단</div>
        </div>

        <!-- 세션 카드 목록 -->
        <div class="fade-in" style="margin-bottom:20px">
          <div style="font-weight:700;font-size:0.88rem;color:var(--text);margin-bottom:12px">📋 진단 이력</div>
          ${sessionCards}
        </div>

        <!-- 핵심역량 진단 추천 -->
        <div class="fade-in" style="background:#FFFBEB;border:1.5px solid #FDE68A;
                  border-radius:var(--radius-md);padding:16px;margin-bottom:20px">
          <div style="font-size:0.82rem;font-weight:700;color:#D97706;margin-bottom:6px">
            💡 통합 성장 분석을 원하시나요?
          </div>
          <div style="font-size:0.78rem;color:#92400E;line-height:1.6;margin-bottom:12px">
            5대 핵심역량 진단까지 완료하면 레이더 차트·IDP·성장 이력을 한눈에 볼 수 있습니다.
          </div>
          <button class="btn btn-primary btn-sm" onclick="window.location.hash='#/assessment'">
            📊 핵심역량 진단 시작하기 →
          </button>
        </div>

        <!-- 재진단 링크 -->
        <div class="fade-in" style="text-align:center">
          <a href="#/hr-competency" style="font-size:0.8rem;color:var(--primary);text-decoration:none;font-weight:600">
            🌳 HR 직무역량 트리 재진단하기
          </a>
        </div>

      </div>
    </div>
  `;
}

// ── Page render ───────────────────────────────────────────────

function renderPage(root, data) {
  // HR 직무역량트리 results with no card-swipe data yet
  if (data?._source === 'hr_competency') {
    renderHrCompPage(root, data.hrSessions);
    return;
  }

  if (!data) {
    root.innerHTML = `
      <div class="page">
        <div class="top-bar">
          <div class="top-bar-title">내 성장</div>
        </div>
        <div class="page-content" style="padding:32px 20px;text-align:center">
          <div style="font-size:3rem;margin-bottom:12px">📊</div>
          <div style="font-weight:700;font-size:1rem;margin-bottom:8px">진단 결과가 없습니다</div>
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:24px">
            역량 진단을 완료하면 성장 분석 결과를 확인할 수 있습니다.
          </div>
          <div style="display:flex;flex-direction:column;gap:10px;max-width:280px;margin:0 auto">
            <button class="btn btn-primary" onclick="window.location.hash='#/assessment'">
              📊 핵심역량 진단 시작하기 →
            </button>
            <button class="btn btn-outline" onclick="window.location.hash='#/hr-competency'">
              🌳 HR 직무역량 트리 진단하기 →
            </button>
          </div>
        </div>
      </div>
    `;
    return;
  }
  const { scores = [], final_score, final_rating } = data;
  window.appState = window.appState || {};
  window.appState.resultsData = data;

  const idpItems = fetchIdp(scores);
  const history  = _getHistory();
  const prevEntry = history.length >= 2 ? history[history.length - 2] : null;
  const delta = (prevEntry && final_score != null)
    ? (Number(final_score) - Number(prevEntry.final_score)).toFixed(2)
    : null;
  const deltaNum = delta !== null ? Number(delta) : 0;

  root.innerHTML = `
    <div class="page" style="background:var(--bg)">
      <div class="top-bar">
        <div class="top-bar-title">${_managerCtx ? `👥 ${_managerCtx}님 성장 계획` : '내 성장'}</div>
        <div style="position:relative">
          <button id="export-btn" class="btn btn-ghost btn-sm" style="min-height:40px;font-size:0.78rem">
            📤 내보내기
          </button>
          <div id="export-menu" style="display:none;position:absolute;right:0;top:44px;z-index:200;
               background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);
               box-shadow:var(--shadow-md);padding:4px;min-width:160px">
            <button class="export-item" data-action="goals"
                    style="display:block;width:100%;text-align:left;padding:8px 12px;border:none;
                           background:none;cursor:pointer;font-size:0.8rem;color:var(--text);border-radius:6px">
              🎯 OKR 목표 CSV
            </button>
            <button class="export-item" data-action="reviews"
                    style="display:block;width:100%;text-align:left;padding:8px 12px;border:none;
                           background:none;cursor:pointer;font-size:0.8rem;color:var(--text);border-radius:6px">
              📋 성과 리뷰 CSV
            </button>
            <button class="export-item" data-action="meetings"
                    style="display:block;width:100%;text-align:left;padding:8px 12px;border:none;
                           background:none;cursor:pointer;font-size:0.8rem;color:var(--text);border-radius:6px">
              💬 1:1 미팅 CSV
            </button>
            <hr style="border:none;border-top:1px solid var(--border);margin:4px 0">
            <div style="padding:4px 12px 2px;font-size:0.72rem;color:var(--text-muted);font-weight:600">📄 성장 리포트 인쇄</div>
            <button class="export-item" data-action="report" data-period="all"
                    style="display:block;width:100%;text-align:left;padding:5px 12px 5px 20px;border:none;
                           background:none;cursor:pointer;font-size:0.78rem;color:var(--primary);border-radius:6px">
              전체 기간
            </button>
            <button class="export-item" data-action="report" data-period="h1"
                    style="display:block;width:100%;text-align:left;padding:5px 12px 5px 20px;border:none;
                           background:none;cursor:pointer;font-size:0.78rem;color:var(--primary);border-radius:6px">
              상반기 (1~6월)
            </button>
            <button class="export-item" data-action="report" data-period="h2"
                    style="display:block;width:100%;text-align:left;padding:5px 12px 5px 20px;border:none;
                           background:none;cursor:pointer;font-size:0.78rem;color:var(--primary);border-radius:6px">
              하반기 (7~12월)
            </button>
            <button class="export-item" data-action="report" data-period="q1"
                    style="display:block;width:100%;text-align:left;padding:5px 12px 5px 20px;border:none;
                           background:none;cursor:pointer;font-size:0.78rem;color:var(--text-muted);border-radius:6px">
              1분기
            </button>
            <button class="export-item" data-action="report" data-period="q2"
                    style="display:block;width:100%;text-align:left;padding:5px 12px 5px 20px;border:none;
                           background:none;cursor:pointer;font-size:0.78rem;color:var(--text-muted);border-radius:6px">
              2분기
            </button>
            <button class="export-item" data-action="report" data-period="q3"
                    style="display:block;width:100%;text-align:left;padding:5px 12px 5px 20px;border:none;
                           background:none;cursor:pointer;font-size:0.78rem;color:var(--text-muted);border-radius:6px">
              3분기
            </button>
            <button class="export-item" data-action="report" data-period="q4"
                    style="display:block;width:100%;text-align:left;padding:5px 12px 5px 20px;border:none;
                           background:none;cursor:pointer;font-size:0.78rem;color:var(--text-muted);border-radius:6px">
              4분기
            </button>
          </div>
        </div>
      </div>

      <div class="page-content" style="padding-bottom:32px">

        ${_managerCtx ? `
        <!-- 매니저 컨텍스트 배너 -->
        <div style="margin-bottom:14px;padding:10px 14px;background:#EEF2FF;border-radius:var(--radius-sm);
                    display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div style="font-size:0.82rem;color:var(--primary)">
            <strong>${_managerCtx}님</strong>의 성장 계획을 보고 있습니다 (매니저 보기)
          </div>
          <button onclick="window.navBack()" style="font-size:0.72rem;color:var(--primary);background:none;
                  border:1px solid var(--primary-light);padding:3px 9px;border-radius:99px;cursor:pointer;white-space:nowrap">
            ← 팀관리
          </button>
        </div>` : ''}

        <!-- Summary header -->
        <div class="fade-in" style="margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <div style="font-size:1.5rem;font-weight:700;color:var(--text)">
              ${final_score != null ? Number(final_score).toFixed(1) : '-'}
              <span style="font-size:0.9rem;font-weight:400;color:var(--text-muted)"> / 5.0</span>
            </div>
            ${final_rating ? `<span class="badge ${levelBadge(final_rating)}" style="font-size:0.85rem;padding:4px 10px">${escapeHtml(final_rating)}</span>` : ''}
            ${delta !== null ? `
              <span style="font-size:0.8rem;font-weight:700;padding:3px 9px;border-radius:99px;
                background:${deltaNum >= 0 ? '#ECFDF5' : '#FFF1F2'};
                color:${deltaNum >= 0 ? '#059669' : '#E11D48'}">
                ${deltaNum >= 0 ? '▲' : '▼'} ${Math.abs(deltaNum).toFixed(2)} 이전 대비
              </span>` : ''}
            <div style="margin-left:auto;font-size:0.75rem;color:var(--text-muted)">역량 종합 점수</div>
          </div>
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;background:var(--border);padding:4px;border-radius:12px;margin-bottom:20px" class="fade-in">
          ${[
            { id:'overview', label:'개요',     icon:'📊' },
            { id:'detail',   label:'역량 상세', icon:'🔍' },
            { id:'idp',      label:'성장 계획', icon:'📈' },
            { id:'perf',     label:'성과',     icon:'🎯' },
          ].map(t => `
            <button data-tab="${t.id}" style="
              flex:1;padding:8px 4px;border:none;border-radius:8px;cursor:pointer;
              font-size:0.78rem;font-weight:600;transition:all 150ms;
              background:${_activeTab === t.id ? 'var(--surface)' : 'transparent'};
              color:${_activeTab === t.id ? 'var(--primary)' : 'var(--text-muted)'};
              box-shadow:${_activeTab === t.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none'}">
              ${t.icon} ${t.label}
            </button>
          `).join('')}
        </div>

        <!-- Tab content -->
        <div id="tab-content">
          ${renderTabContent(data, scores, idpItems)}
        </div>

        <!-- Quick links: 성과 관리 -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:24px" class="fade-in fade-in-delay-3">
          <a href="#/goals" style="text-decoration:none">
            <div style="padding:14px;border-radius:var(--radius-md);border:1.5px solid var(--border);
                        background:var(--surface);display:flex;align-items:center;gap:10px;
                        transition:border-color 0.15s,box-shadow 0.15s"
                 onmouseenter="this.style.borderColor='var(--primary-light)';this.style.boxShadow='var(--shadow-sm)'"
                 onmouseleave="this.style.borderColor='var(--border)';this.style.boxShadow='none'">
              <span style="font-size:1.3rem">🎯</span>
              <div>
                <div style="font-size:0.82rem;font-weight:700;color:var(--text)">OKR 목표</div>
                <div style="font-size:0.7rem;color:var(--text-muted)">목표 & 체크인</div>
              </div>
            </div>
          </a>
          <a href="#/reviews" style="text-decoration:none">
            <div style="padding:14px;border-radius:var(--radius-md);border:1.5px solid var(--border);
                        background:var(--surface);display:flex;align-items:center;gap:10px;
                        transition:border-color 0.15s,box-shadow 0.15s"
                 onmouseenter="this.style.borderColor='var(--primary-light)';this.style.boxShadow='var(--shadow-sm)'"
                 onmouseleave="this.style.borderColor='var(--border)';this.style.boxShadow='none'">
              <span style="font-size:1.3rem">📋</span>
              <div>
                <div style="font-size:0.82rem;font-weight:700;color:var(--text)">성과 리뷰</div>
                <div style="font-size:0.7rem;color:var(--text-muted)">리뷰 & 1:1</div>
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  `;

  bindEvents(root, data, scores, idpItems);
  if (_activeTab === 'overview') initRadar(root, scores);
}

// ── Tab routing ───────────────────────────────────────────────

function renderTabContent(data, scores, idpItems) {
  if (_activeTab === 'overview') return renderOverview(data, scores);
  if (_activeTab === 'detail')   return renderDetail(scores);
  if (_activeTab === 'idp')      return renderIdp(idpItems);
  if (_activeTab === 'perf')     return renderPerf();
  return '';
}

// ── Tab 1: 개요 (radar + MET) ─────────────────────────────────

function renderOverview(data, scores) {
  const { meet, exceed, under } = classifyScores(scores);
  return `
    <!-- Radar -->
    <div class="card fade-in" style="margin-bottom:20px;padding:20px">
      <div class="card-title" style="margin-bottom:12px">역량 레이더</div>
      <div style="position:relative;width:100%;max-width:380px;margin:0 auto">
        <canvas id="radar-canvas" width="380" height="380"
                style="width:100%;height:auto;touch-action:none"></canvas>
      </div>
      <div style="display:flex;justify-content:center;gap:20px;margin-top:12px">
        <div style="display:flex;align-items:center;gap:5px;font-size:0.75rem;color:var(--text-muted)">
          <div style="width:10px;height:10px;border-radius:50%;background:#4F46E5"></div>현재
        </div>
        <div style="display:flex;align-items:center;gap:5px;font-size:0.75rem;color:var(--text-muted)">
          <div style="width:10px;height:10px;border-radius:50%;border:2px solid #10B981;background:var(--card-bg)"></div>목표
        </div>
      </div>
    </div>

    <!-- Meet/Exceed/Under summary -->
    <div class="card fade-in" style="margin-bottom:20px;padding:16px">
      <div class="card-title" style="margin-bottom:14px">📊 목표 대비 달성 현황</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px">
        ${[
          { label:'초과 달성', count:exceed.length, color:'#059669', bg:'#ECFDF5', icon:'🏆' },
          { label:'목표 달성', count:meet.length,   color:'#4F46E5', bg:'#EEF2FF', icon:'✅' },
          { label:'개발 필요', count:under.length,  color:'#F59E0B', bg:'#FFFBEB', icon:'🎯' },
        ].map(s => `
          <div style="text-align:center;padding:12px 8px;background:${s.bg};border-radius:var(--radius-md)">
            <div style="font-size:1rem;margin-bottom:4px">${s.icon}</div>
            <div style="font-size:1.4rem;font-weight:800;color:${s.color}">${s.count}</div>
            <div style="font-size:0.68rem;color:${s.color};font-weight:600">${s.label}</div>
          </div>
        `).join('')}
      </div>

      ${[
        { list:exceed, label:'🏆 초과 달성', color:'#059669', bg:'#ECFDF5' },
        { list:meet,   label:'✅ 목표 달성', color:'#4F46E5', bg:'#EEF2FF' },
        { list:under,  label:'🎯 개발 필요', color:'#D97706', bg:'#FFFBEB' },
      ].filter(g => g.list.length > 0).map(g => `
        <div style="margin-bottom:10px">
          <div style="font-size:0.75rem;font-weight:700;color:${g.color};margin-bottom:6px">${g.label}</div>
          ${g.list.map(s => renderMETRow(s, g.color, g.bg)).join('')}
        </div>
      `).join('')}
    </div>

    <!-- 성장 타임라인 -->
    ${renderGrowthTimeline()}

    <!-- Go to detail -->
    <div style="text-align:center;margin-bottom:16px">
      <button class="btn btn-ghost btn-sm" data-tab="detail">역량 상세 보기 →</button>
    </div>
  `;
}

function renderGrowthTimeline() {
  const history = _getHistory();
  if (history.length < 2) return '';

  const recent   = history.slice(-6);
  const scores   = recent.map(h => Number(h.final_score));
  const minV     = Math.max(0,   Math.min(...scores) - 0.4);
  const maxV     = Math.min(5.0, Math.max(...scores) + 0.4);
  const W = 300; const H = 72; const PAD_X = 18; const PAD_Y = 12;

  const xOf = i  => PAD_X + (i / (recent.length - 1)) * (W - PAD_X * 2);
  const yOf = v  => PAD_Y + (1 - (v - minV) / (maxV - minV)) * (H - PAD_Y * 2);

  const pts    = recent.map((h, i) => ({ x: xOf(i), y: yOf(h.final_score), h }));
  const line   = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area   = line + ` L${pts[pts.length-1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`;
  const last   = pts[pts.length - 1];
  const prev   = pts[pts.length - 2];
  const deltaV = (last.h.final_score - prev.h.final_score);

  // Per-competency change table for last two snapshots
  const lastSnap = recent[recent.length - 1];
  const prevSnap = recent[recent.length - 2];
  const compRows = (lastSnap.scores || []).map(sc => {
    const prevSc = (prevSnap.scores || []).find(p => p.competency_id === sc.competency_id);
    const diff   = prevSc ? (Number(sc.as_is_score) - Number(prevSc.as_is_score)) : 0;
    const color  = diff > 0 ? '#059669' : diff < 0 ? '#E11D48' : 'var(--text-muted)';
    const sign   = diff > 0 ? '+' : '';
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">
        <div style="flex:1;font-size:0.78rem;color:var(--text)">${escapeHtml(sc.name || sc.competency_id)}</div>
        <div style="font-size:0.82rem;font-weight:700;color:var(--text)">${Number(sc.as_is_score).toFixed(1)}</div>
        <div style="font-size:0.75rem;font-weight:700;color:${color};min-width:36px;text-align:right">
          ${diff !== 0 ? sign + diff.toFixed(1) : '─'}
        </div>
      </div>`;
  }).join('');

  return `
    <div class="card fade-in" style="margin-bottom:20px;padding:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div class="card-title" style="margin:0">📈 성장 이력</div>
        <span style="font-size:0.8rem;font-weight:700;padding:3px 10px;border-radius:99px;
          background:${deltaV >= 0 ? '#ECFDF5' : '#FFF1F2'};
          color:${deltaV >= 0 ? '#059669' : '#E11D48'}">
          ${deltaV >= 0 ? '▲' : '▼'} ${Math.abs(deltaV).toFixed(2)}
        </span>
      </div>

      <!-- SVG 추이 차트 -->
      <svg viewBox="0 0 ${W} ${H + 20}" style="width:100%;height:auto;display:block;margin-bottom:12px"
           role="img" aria-label="역량 점수 추이">
        <defs>
          <linearGradient id="gh-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#4F46E5" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#4F46E5" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${area}" fill="url(#gh-grad)"/>
        <path d="${line}" fill="none" stroke="#4F46E5" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"/>
        ${pts.map((p, i) => `
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}"
                  r="${i === pts.length - 1 ? 5 : 3.5}"
                  fill="${i === pts.length - 1 ? '#4F46E5' : '#fff'}"
                  stroke="#4F46E5" stroke-width="2"/>
          <text x="${p.x.toFixed(1)}" y="${Math.max(10, p.y - 7).toFixed(1)}"
                text-anchor="middle" font-size="9"
                fill="${i === pts.length - 1 ? '#4F46E5' : 'var(--text-muted)'}"
                font-weight="${i === pts.length - 1 ? '700' : '400'}">
            ${p.h.final_score.toFixed(1)}
          </text>
          <text x="${p.x.toFixed(1)}" y="${H + 16}" text-anchor="middle" font-size="8" fill="var(--text-muted)">
            ${_shortDate(p.h.date)}
          </text>
        `).join('')}
      </svg>

      <!-- 역량별 변화 -->
      <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:6px;
                  text-transform:uppercase;letter-spacing:0.04em">
        역량별 변화 (이전 → 현재)
      </div>
      ${compRows}
    </div>
  `;
}

function _shortDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch { return ''; }
}

function renderMETRow(s, color, bg) {
  const asIs = Number(s.as_is_score || 0);
  const toBe = Number(s.to_be_score || 0);
  const gap  = (toBe - asIs).toFixed(1);
  const gapLabel = gap > 0 ? `GAP −${gap}` : gap < 0 ? `+${Math.abs(gap)} 초과` : '달성';

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;
                padding:8px 10px;background:${bg};border-radius:var(--radius-sm);margin-bottom:4px">
      <div style="font-size:0.83rem;font-weight:600;color:var(--text)">${escapeHtml(s.competency_name_ko)}</div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:0.83rem;font-weight:700;color:${color}">${formatScore(asIs)}</span>
        <span style="font-size:0.7rem;color:var(--text-muted)">/ ${formatScore(toBe)}</span>
        <span style="font-size:0.68rem;padding:2px 6px;border-radius:999px;background:${color}20;color:${color};font-weight:700">${gapLabel}</span>
      </div>
    </div>
  `;
}

// ── Tab 2: 역량 상세 ──────────────────────────────────────────

function getLinkedOkrs(competencyId) {
  try {
    const goals = JSON.parse(localStorage.getItem('hr_okr_goals') || '[]');
    return goals.filter(g => g.status !== 'DONE' && (g.linkedComps || []).includes(competencyId));
  } catch { return []; }
}

function renderDetail(scores) {
  return `
    <div class="fade-in">
      <div class="section-title" style="margin-bottom:12px">역량별 상세 점수</div>
      ${scores.map((s, idx) => renderScoreCard(s, idx)).join('')}
    </div>
  `;
}

function renderScoreCard(sc) {
  const level  = sc.level || determineLevel(sc.as_is_score);
  const asIs   = Number(sc.as_is_score || 0);
  const toBe   = Number(sc.to_be_score || 0);
  const gap    = toBe - asIs;
  const status = gap <= -0.3 ? 'exceed' : gap <= 0.4 ? 'meet' : 'under';
  const metColors = { exceed:['#059669','#ECFDF5','🏆 초과'], meet:['#4F46E5','#EEF2FF','✅ 달성'], under:['#D97706','#FFFBEB','🎯 개발필요'] };
  const [mc, mbg, mlabel] = metColors[status];

  return `
    <div class="comp-score-card card" role="button" tabindex="0"
         style="margin-bottom:12px;padding:16px;cursor:pointer;border-left:4px solid ${mc}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-weight:700;font-size:0.92rem;color:var(--text)">${escapeHtml(sc.competency_name_ko)}</div>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="badge ${levelBadge(level)}" style="font-size:0.7rem">${escapeHtml(level)}</span>
          <span style="padding:2px 7px;border-radius:999px;font-size:0.68rem;font-weight:700;background:${mbg};color:${mc}">${mlabel}</span>
        </div>
      </div>
      <div style="margin-bottom:6px">
        <div style="display:flex;justify-content:space-between;font-size:0.73rem;color:var(--text-muted);margin-bottom:3px">
          <span>현재 (As-Is)</span><span style="color:#4F46E5;font-weight:600">${formatScore(asIs)}</span>
        </div>
        <div style="background:#EEF2FF;border-radius:999px;height:7px;overflow:hidden">
          <div class="score-bar-fill-animate" style="height:100%;border-radius:999px;background:#4F46E5;width:0%;transition:width 0.7s ease" data-target="${Math.min((asIs/5)*100,100).toFixed(1)}"></div>
        </div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;font-size:0.73rem;color:var(--text-muted);margin-bottom:3px">
          <span>목표 (To-Be)</span><span style="color:#10B981;font-weight:600">${formatScore(toBe)}</span>
        </div>
        <div style="background:#ECFDF5;border-radius:999px;height:7px;overflow:hidden;border:1.5px solid #10B981">
          <div class="score-bar-fill-animate" style="height:100%;border-radius:999px;background:rgba(16,185,129,0.35);width:0%;transition:width 0.7s ease 0.1s" data-target="${Math.min((toBe/5)*100,100).toFixed(1)}"></div>
        </div>
      </div>
      <div style="margin-top:8px;font-size:0.72rem;color:var(--text-light);text-align:right">탭하여 ASK 상세 →</div>

      ${(() => {
        const linked = getLinkedOkrs(sc.competency_id);
        if (!linked.length) return '';
        return `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
          <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:4px">🎯 연결 OKR</div>
          ${linked.slice(0, 2).map(g => `
            <div style="font-size:0.72rem;color:var(--primary);cursor:pointer;margin-bottom:2px"
                 onclick="event.stopPropagation();window.location.hash='#/goals'">
              · ${escapeHtml((g.objective || '').substring(0, 32))}${(g.objective || '').length > 32 ? '…' : ''}
            </div>`).join('')}
        </div>`;
      })()}

      ${gap > 0.5 ? `
        <div style="margin-top:6px;font-size:0.7rem;padding:3px 8px;border-radius:var(--radius-sm);
                     display:inline-block;background:${gap > 1.0 ? 'var(--danger)' : 'var(--warning)'}15;
                     color:${gap > 1.0 ? 'var(--danger)' : 'var(--warning)'}">
          ${gap > 1.0 ? '🎓 심화 교육 권장' : '🤝 코칭 · 멘토링 권장'}
        </div>` : ''}
    </div>
  `;
}

// ── Tab 3: IDP ────────────────────────────────────────────────

function renderIdp(items) {
  const priorityColors = { High:'#EF4444', Medium:'#F59E0B', Low:'#10B981' };
  const actionIcons    = { study:'📚', training:'🎓', mentoring:'🤝', project:'💼', rotation:'🔄' };
  const statusColors   = { not_started:'var(--text-muted)', in_progress:'#4F46E5', completed:'#059669' };
  const statusLabels   = { not_started:'미시작', in_progress:'진행중', completed:'완료' };

  return `
    <div class="fade-in">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div class="section-title">개인 성장 계획 (IDP)</div>
        <span style="font-size:0.75rem;color:var(--text-muted)">${items.length}개 항목</span>
      </div>

      ${items.length === 0 ? `
        <div class="empty-state" style="min-height:30vh">
          <div class="empty-state-icon">📈</div>
          <div class="empty-state-title">IDP가 아직 없습니다</div>
          <div class="empty-state-desc">역량 진단 후 자동으로 성장 계획이 생성됩니다.</div>
          <button onclick="window.location.hash='#/diagnostics'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">역량 진단 시작</button>
        </div>
      ` : items.map(item => `
        <div class="card" style="margin-bottom:12px;padding:16px;
             border-left:4px solid ${priorityColors[item.priority] || 'var(--text-muted)'}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;gap:8px">
            <div>
              <div style="font-weight:700;font-size:0.9rem;color:var(--text);margin-bottom:3px">
                ${actionIcons[item.action_type] || '📌'} ${escapeHtml(item.resource_title_ko)}
              </div>
              <div style="font-size:0.75rem;color:var(--text-muted)">${escapeHtml(item.competency_name_ko)}</div>
            </div>
            <span style="padding:3px 9px;border-radius:999px;font-size:0.68rem;font-weight:700;
                         flex-shrink:0;background:${priorityColors[item.priority]}20;
                         color:${priorityColors[item.priority] || 'var(--text-muted)'}">
              ${item.priority}
            </span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;
                      font-size:0.72rem;color:var(--text-muted)">
            <span>📅 ${item.target_date || '-'}</span>
            <span style="padding:2px 8px;border-radius:999px;
                         background:${statusColors[item.status] || 'var(--text-muted)'}20;
                         color:${statusColors[item.status] || 'var(--text-muted)'};font-weight:600">
              ${statusLabels[item.status] || item.status}
            </span>
          </div>
          ${item.gap > 0 ? `
            <div style="margin-top:8px;height:5px;background:var(--border);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${Math.min(100, Math.round(item.gap / 2 * 100))}%;
                          background:${priorityColors[item.priority]};border-radius:3px"></div>
            </div>
            <div style="font-size:0.68rem;color:var(--text-light);margin-top:3px;text-align:right">
              GAP ${Number(item.gap).toFixed(1)}점 개발 필요
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

// ── Helpers ───────────────────────────────────────────────────

function classifyScores(scores) {
  const exceed = [], meet = [], under = [];
  for (const s of scores) {
    const asIs = Number(s.as_is_score || 0);
    const toBe = Number(s.to_be_score || 0);
    const gap  = toBe - asIs;
    if (gap <= -0.3)      exceed.push(s);
    else if (gap <= 0.4)  meet.push(s);
    else                  under.push(s);
  }
  return { exceed, meet, under };
}

function fetchIdp(scores) {
  try {
    const raw = localStorage.getItem('hr_idp_items');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  // auto-generate from scores
  return scores
    .filter(s => (Number(s.to_be_score || 0) - Number(s.as_is_score || 0)) > 0.3)
    .sort((a, b) => (Number(b.to_be_score) - Number(b.as_is_score)) - (Number(a.to_be_score) - Number(a.as_is_score)))
    .map(s => ({
      competency_name_ko: s.competency_name_ko,
      gap:                Number(s.to_be_score) - Number(s.as_is_score),
      priority:           (Number(s.to_be_score) - Number(s.as_is_score)) > 0.7 ? 'High' : 'Medium',
      action_type:        'training',
      resource_title_ko:  `${s.competency_name_ko} 역량 향상 프로그램`,
      target_date:        '2025-12-31',
      status:             'not_started',
    }));
}

function levelBadge(level) {
  switch (level) {
    case 'L3': return 'badge-success';
    case 'L2': return 'badge-primary';
    case 'L1': return 'badge-warning';
    default:   return 'badge-secondary';
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Events ────────────────────────────────────────────────────

function bindEvents(root, data, scores, idpItems) {
  // Export menu toggle
  const exportBtn  = root.querySelector('#export-btn');
  const exportMenu = root.querySelector('#export-menu');
  exportBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (exportMenu) exportMenu.style.display = exportMenu.style.display === 'none' ? 'block' : 'none';
  });
  document.addEventListener('click', () => {
    if (exportMenu) exportMenu.style.display = 'none';
  }, { once: true });

  root.querySelectorAll('.export-item').forEach(btn => {
    btn.addEventListener('click', () => {
      if (exportMenu) exportMenu.style.display = 'none';
      const user = getUser();
      const uid  = _session().empId || _session().userId || user?.id || 'demo';
      const action = btn.dataset.action;
      if (action === 'goals')    { if (!exportGoalsCsv(uid))    showToast('내보낼 OKR 목표 데이터가 없습니다.', 'warning'); else showToast('OKR 목표를 내보냈습니다.', 'success'); }
      if (action === 'reviews')  { if (!exportReviewsCsv(uid))  showToast('내보낼 성과 리뷰 데이터가 없습니다.', 'warning'); else showToast('성과 리뷰를 내보냈습니다.', 'success'); }
      if (action === 'meetings') { if (!exportMeetingsCsv(uid)) showToast('내보낼 1:1 미팅 데이터가 없습니다.', 'warning'); else showToast('1:1 미팅 기록을 내보냈습니다.', 'success'); }
      if (action === 'report')   { if (!exportGrowthReport(user, data, btn.dataset.period || 'all')) showToast('팝업 차단을 해제해 주세요.', 'error'); }
    });
  });

  // Hover effect on export items
  root.querySelectorAll('.export-item').forEach(item => {
    item.addEventListener('mouseenter', () => { item.style.background = 'var(--bg-subtle)'; });
    item.addEventListener('mouseleave', () => { item.style.background = 'none'; });
  });

  root.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeTab = btn.dataset.tab;
      renderPage(root, data);
    });
  });
  root.querySelectorAll('.comp-score-card').forEach((card, i) => {
    const sc = scores[i];
    if (!sc) return;
    card.addEventListener('click', () => {
      showAskPopup({ name_ko: sc.competency_name_ko, as_is_score: sc.as_is_score, to_be_score: sc.to_be_score, ask: sc.ask }, sc.ask || null);
    });
  });
}

// ── Radar init ────────────────────────────────────────────────

// ── Tab 4: 성과 (OKR + Reviews 통합) ─────────────────────────

function renderPerf() {
  const user = getUser();
  const uid  = _session().empId || _session().userId || user?.id || 'demo';

  let goals = [];
  try { goals = JSON.parse(localStorage.getItem('hr_okr_goals') || '[]').filter(g => g.userId === uid); }
  catch {}

  let reviews = [];
  try { reviews = JSON.parse(localStorage.getItem('hr_perf_reviews') || '[]').filter(r => r.userId === uid); }
  catch {}

  let meetings = [];
  try { meetings = JSON.parse(localStorage.getItem('hr_one_on_ones') || '[]').filter(m => m.userId === uid || m.empId === uid); }
  catch {}

  function avgPct(gs) {
    const all = gs.flatMap(g => g.keyResults || []);
    if (!all.length) return 0;
    return Math.round(all.reduce((s, kr) => s + (kr.progress || 0), 0) / all.length);
  }
  function pColor(p) {
    return p >= 80 ? 'var(--success)' : p >= 50 ? 'var(--warning)' : 'var(--danger)';
  }

  const PERIOD_LABEL = { H1: '상반기', H2: '하반기', ANNUAL: '연간' };
  const goalsByPeriod = {};
  goals.forEach(g => {
    const p = g.period || 'H1';
    if (!goalsByPeriod[p]) goalsByPeriod[p] = [];
    goalsByPeriod[p].push(g);
  });

  const latestReview = reviews.length
    ? [...reviews].sort((a, b) => new Date(b.date||0) - new Date(a.date||0))[0]
    : null;

  const pendingActions = meetings.flatMap(m => (m.actionItems||[]).filter(ai => !ai.done)).length;
  const totalActions   = meetings.flatMap(m => m.actionItems||[]).length;

  return `
    <!-- OKR 기간별 요약 -->
    <div style="font-weight:700;font-size:0.88rem;margin-bottom:10px">🎯 OKR 현황</div>
    ${Object.keys(goalsByPeriod).length ? `
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px">
        ${Object.entries(goalsByPeriod).map(([period, gs]) => {
          const avg  = avgPct(gs);
          const done = gs.filter(g => avgPct([g]) >= 80).length;
          return `
            <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 14px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <div style="font-weight:700;font-size:0.82rem">${PERIOD_LABEL[period] || period}</div>
                <span style="font-size:0.72rem;font-weight:700;color:${pColor(avg)}">${avg}%</span>
              </div>
              <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;margin-bottom:8px">
                <div style="height:100%;width:${avg}%;background:${pColor(avg)};border-radius:3px;transition:width .6s ease"></div>
              </div>
              <div style="display:flex;flex-direction:column;gap:4px">
                ${gs.map(g => {
                  const gAvg = avgPct([g]);
                  return `
                    <div style="display:flex;align-items:center;gap:8px">
                      <div style="font-size:0.75rem;color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                        ${escapeHtml(g.objective)}
                      </div>
                      <span style="font-size:0.7rem;font-weight:700;color:${pColor(gAvg)};flex-shrink:0">${gAvg}%</span>
                    </div>`;
                }).join('')}
              </div>
              <div style="margin-top:8px;font-size:0.68rem;color:var(--text-muted)">
                순항 ${done}/${gs.length}개 · <a href="#/goals" style="color:var(--primary)">상세 보기 →</a>
              </div>
            </div>`;
        }).join('')}
      </div>
    ` : `
      <div style="padding:16px;text-align:center;color:var(--text-muted);font-size:0.82rem;margin-bottom:20px">
        OKR 목표가 없습니다. <a href="#/goals" style="color:var(--primary)">목표 설정하기 →</a>
      </div>
      <button onclick="location.hash='#/goals'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">OKR 설정</button>
    `}

    <!-- 성과 리뷰 요약 -->
    <div style="font-weight:700;font-size:0.88rem;margin-bottom:10px">📋 최근 성과 리뷰</div>
    ${latestReview ? `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;margin-bottom:20px">
        <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">${latestReview.date ? latestReview.date.slice(0,10) : ''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div style="text-align:center;padding:8px;background:var(--bg);border-radius:8px">
            <div style="font-size:1.1rem;font-weight:800;color:var(--primary)">${latestReview.goalAchievement || '-'}</div>
            <div style="font-size:0.68rem;color:var(--text-muted)">목표 달성도</div>
          </div>
          <div style="text-align:center;padding:8px;background:var(--bg);border-radius:8px">
            <div style="font-size:1.1rem;font-weight:800;color:var(--primary)">${latestReview.competencyDemo || '-'}</div>
            <div style="font-size:0.68rem;color:var(--text-muted)">역량 발휘도</div>
          </div>
        </div>
        ${latestReview.highlights ? `<div style="font-size:0.78rem;color:var(--text);line-height:1.6">${escapeHtml(latestReview.highlights)}</div>` : ''}
        <div style="margin-top:8px;font-size:0.7rem;color:var(--text-muted)">
          <a href="#/reviews" style="color:var(--primary)">전체 리뷰 보기 →</a>
        </div>
      </div>
    ` : `
      <div style="padding:16px;text-align:center;color:var(--text-muted);font-size:0.82rem;margin-bottom:20px">
        성과 리뷰가 없습니다. <a href="#/reviews" style="color:var(--primary)">리뷰 작성하기 →</a>
      </div>`}

    <!-- 1:1 미팅 & 액션 -->
    <div style="font-weight:700;font-size:0.88rem;margin-bottom:10px">💬 1:1 미팅 요약</div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;margin-bottom:20px">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
        <div style="text-align:center">
          <div style="font-size:1.2rem;font-weight:800;color:var(--primary)">${meetings.length}</div>
          <div style="font-size:0.68rem;color:var(--text-muted)">총 미팅</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:1.2rem;font-weight:800;color:${totalActions - pendingActions > 0 ? 'var(--success)' : 'var(--text-muted)'}">${totalActions - pendingActions}</div>
          <div style="font-size:0.68rem;color:var(--text-muted)">완료 액션</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:1.2rem;font-weight:800;color:${pendingActions > 0 ? 'var(--warning)' : 'var(--text-muted)'}">${pendingActions}</div>
          <div style="font-size:0.68rem;color:var(--text-muted)">미완료 액션</div>
        </div>
      </div>
      ${meetings.length === 0 ? `<div style="text-align:center;font-size:0.75rem;color:var(--text-muted)">
        <a href="#/reviews" style="color:var(--primary)">1:1 미팅 기록하기 →</a>
      </div>` : `<div style="font-size:0.7rem;color:var(--text-muted);text-align:center">
        <a href="#/reviews" style="color:var(--primary)">미팅 관리하기 →</a>
      </div>`}
    </div>`;
}

function initRadar(root, scores) {
  const canvas = root.querySelector('#radar-canvas');
  if (!canvas) return;
  _radarChart = new RadarChart(canvas, { padding:50, fontSize:10, showLegend:false, animDuration:600 });
  const askMap = {};
  for (const sc of scores) { if (sc.competency_id) askMap[sc.competency_id] = sc.ask; }
  _radarChart.setData({
    labels:         scores.map(s => s.competency_name_ko),
    as_is:          scores.map(s => Number(s.as_is_score || 0)),
    to_be:          scores.map(s => Number(s.to_be_score || 0)),
    competency_ids: scores.map(s => s.competency_id),
    ask_data:       askMap,
  });
  _radarChart.addTapListener((compId, idx, askData) => {
    const sc = scores[idx];
    if (!sc) return;
    showAskPopup({ name_ko: sc.competency_name_ko, as_is_score: sc.as_is_score, to_be_score: sc.to_be_score }, askData || sc.ask || null);
  });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.querySelectorAll('.score-bar-fill-animate').forEach(el => {
      el.style.width = el.dataset.target + '%';
    });
  }));
}
