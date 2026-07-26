/**
 * results.js – Assessment Results Page
 * HR Competency OS
 *
 * 3-tab view: 역량진단 | 진단 Kit | 서베이 이력
 */

import { api }            from '../api.js';
import { navigate }       from '../app.js';
import { RadarChart }     from '../components/radar-chart.js';
import { showAskPopup }   from '../components/ask-popup.js';
import { formatScore, determineLevel } from '../utils/score.js';

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId() {
  const s = _session();
  return s.empId || s.userId || s.id || 'EMP001';
}

// ── Module-level refs ──────────────────────────────────────────
let _root       = null;
let _radarChart = null;
let _activeTab  = 'competency';

// ── localStorage keys ──────────────────────────────────────────
const LS_DIAG    = 'hr_diag_results';
const LS_SURVEY  = 'hr_survey_responses';
const LS_COMP    = 'hr_comp_sessions';
const LS_HISTORY = 'hr_growth_history';

// ── Kit metadata ────────────────────────────────────────────────
const DIAG_KITS = [
  { id: 'KIT_MBTI',      label: 'MBTI',     icon: '🧠', color: '#4F46E5' },
  { id: 'KIT_DISC',      label: 'DISC',     icon: '🎯', color: '#F59E0B' },
  { id: 'KIT_HOLLAND',   label: 'Holland',  icon: '🌐', color: '#10B981' },
  { id: 'KIT_BIRKMAN',   label: 'Birkman',  icon: '🔬', color: '#8B5CF6' },
  { id: 'KIT_INTERVIEW', label: 'AI 인터뷰', icon: '🎤', color: '#EF4444' },
];

const PHASE_META = {
  hiring:      { name: '채용',   icon: '🎯', color: '#4F46E5' },
  onboarding:  { name: '온보딩', icon: '🚀', color: '#10B981' },
  performance: { name: '평가',   icon: '📊', color: '#F59E0B' },
  development: { name: '육성',   icon: '🌱', color: '#059669' },
  engagement:  { name: '재직',   icon: '💡', color: '#8B5CF6' },
  offboarding: { name: '퇴직',   icon: '🏁', color: 'var(--text-muted)' },
};

// ── Demo fallback data ─────────────────────────────────────────
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
  show_ai_interview: true,
};

// ── Public API ─────────────────────────────────────────────────

export async function mount(container) {
  _root = container;
  _activeTab = 'competency';
  renderSkeleton(container);
  const data = await fetchResults();
  _saveGrowthSnapshot(data);
  renderPage(container, data);
}

export function unmount() {
  if (_radarChart) { _radarChart.destroy(); _radarChart = null; }
  _root = null;
}

// ── Growth history snapshot ────────────────────────────────────

function _saveGrowthSnapshot(data) {
  if (!data || !Array.isArray(data.scores) || data.scores.length === 0) return;
  if (data === DEMO_RESULTS) return;
  try {
    const history = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
    const today   = new Date().toISOString().slice(0, 10);
    const deduped = history.filter(h => h.date !== today);
    const entry = {
      id:          `GH_${today}_${Date.now()}`,
      date:        today,
      cycleName:   window.appState?.cycleName || '역량 진단',
      final_score: data.final_score,
      final_rating:data.final_rating,
      scores:      (data.scores || []).map(s => ({
        competency_id: s.competency_id,
        name:          s.competency_name_ko,
        as_is_score:   s.as_is_score,
      })),
    };
    deduped.push(entry);
    localStorage.setItem(LS_HISTORY, JSON.stringify(deduped.slice(-12)));

    // DB 동기화 (비동기, 실패해도 무시)
    api.performance?.saveHistory?.({
      ...entry,
      finalScore:  entry.final_score,
      finalRating: entry.final_rating,
    })?.catch(() => {});
  } catch {}
}

// ── Data fetching ──────────────────────────────────────────────

async function fetchResults() {
  const instanceId = window.appState?.instanceId || 'INST_DEMO_001';
  try {
    const data = await api.assessment.getResults(instanceId);
    if (data && Array.isArray(data.scores) && data.scores.length > 0) {
      // Propagate cycle_name for the header
      if (data.cycle_name) {
        window.appState = window.appState || {};
        window.appState.cycleName = data.cycle_name;
      }
      return data;
    }
    return DEMO_RESULTS;
  } catch (err) {
    console.warn('[Results] API error, using demo data:', err);
    return DEMO_RESULTS;
  }
}

// ── Skeleton ───────────────────────────────────────────────────

function renderSkeleton(root) {
  root.innerHTML = `
    <div class="page">
      <div class="top-bar">
        <button class="btn btn-ghost btn-sm" style="min-height:40px">← 뒤로</button>
        <div class="top-bar-title">역량 진단 결과</div>
        <div style="width:60px"></div>
      </div>
      <div class="page-content">
        <div class="skeleton" style="height:44px;border-radius:12px;margin-bottom:16px"></div>
        <div class="skeleton" style="height:320px;border-radius:16px;margin-bottom:20px"></div>
        ${Array(3).fill(0).map(() => `<div class="skeleton skeleton-card" style="height:80px;margin-bottom:12px"></div>`).join('')}
      </div>
    </div>`;
}

// ── Full page render ───────────────────────────────────────────

function renderPage(root, data) {
  const { scores = [], final_score, final_rating, show_ai_interview } = data;

  const interviewCandidates = scores.filter(s => {
    const lvl = s.level || determineLevel(s.as_is_score);
    return lvl === 'L2' || lvl === 'L3';
  });
  const showInterviewBanner = show_ai_interview !== false && interviewCandidates.length > 0;
  window.appState = window.appState || {};
  window.appState.resultsData = data;

  root.innerHTML = `
    <div class="page">
      <div class="top-bar">
        <button class="btn btn-ghost btn-sm" id="results-back-btn" style="min-height:40px" aria-label="뒤로 가기">← 뒤로</button>
        <div class="top-bar-title">역량 진단 결과</div>
        <button id="results-share-btn" class="btn btn-outline btn-sm"
                style="font-size:0.72rem;padding:5px 10px;min-height:34px">
          🖨️ 저장
        </button>
      </div>

      <div class="page-content" style="padding-bottom:32px">

        <!-- Score summary header -->
        <div class="fade-in" style="margin-bottom:16px">
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:4px">
            ${escapeHtml(window.appState.cycleName || '2024 하반기 역량 진단')}
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <div style="font-size:1.5rem;font-weight:700;color:var(--text)">
              ${final_score != null ? Number(final_score).toFixed(1) : '-'}
              <span style="font-size:0.9rem;font-weight:400;color:var(--text-muted)"> / 5.0</span>
            </div>
            ${final_rating ? `<span class="badge ${levelBadgeClass(final_rating)}" style="font-size:0.85rem;padding:4px 10px">${escapeHtml(final_rating)}</span>` : ''}
          </div>
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;background:var(--border);padding:4px;border-radius:12px;margin-bottom:20px" class="fade-in">
          ${[
            { id: 'competency', label: '역량 진단', icon: '📊' },
            { id: 'kits',       label: '진단 Kit',  icon: '🧩' },
            { id: 'surveys',    label: '서베이',     icon: '📋' },
          ].map(t => `
            <button data-tab="${t.id}" style="
              flex:1;padding:8px 4px;border:none;border-radius:8px;cursor:pointer;
              font-size:0.78rem;font-weight:600;transition:all 150ms;
              background:${_activeTab === t.id ? 'var(--surface)' : 'transparent'};
              color:${_activeTab === t.id ? 'var(--primary)' : 'var(--text-muted)'};
              box-shadow:${_activeTab === t.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none'};
            ">${t.icon} ${t.label}</button>
          `).join('')}
        </div>

        <!-- Tab content -->
        <div id="tab-content">
          ${renderTabContent(data, showInterviewBanner, scores)}
        </div>

      </div>
    </div>
  `;

  bindEvents(root, data, scores, showInterviewBanner);
  if (_activeTab === 'competency') initRadarChart(root, scores);
}

// ── Tab content ────────────────────────────────────────────────

function renderTabContent(data, showInterviewBanner, scores) {
  if (_activeTab === 'competency') return renderCompetencyTab(data, showInterviewBanner, scores);
  if (_activeTab === 'kits')       return renderKitsTab();
  if (_activeTab === 'surveys')    return renderSurveysTab();
  return '';
}

// ── Tab 1: 역량 진단 ───────────────────────────────────────────

function renderCompetencyTab(data, showInterviewBanner, scores) {
  const aiSummary = data.ai_summary || null;
  const groupScores = data.group_scores || null;
  return `
    <!-- Radar chart -->
    <div class="card fade-in" style="margin-bottom:20px;padding:20px">
      <div class="card-title" style="margin-bottom:12px">레이더 차트</div>
      <div style="position:relative;width:100%;max-width:400px;margin:0 auto">
        <canvas id="radar-canvas" width="400" height="400"
                style="width:100%;height:auto;touch-action:none"
                aria-label="역량 레이더 차트"></canvas>
      </div>
      <div style="display:flex;justify-content:center;gap:20px;margin-top:12px">
        <div style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--text-muted)">
          <div style="width:12px;height:12px;border-radius:50%;background:#4F46E5"></div>As-Is
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--text-muted)">
          <div style="width:12px;height:12px;border-radius:50%;border:2px solid #10B981;background:var(--card-bg)"></div>To-Be
        </div>
      </div>
      <p style="text-align:center;font-size:0.75rem;color:var(--text-light);margin-top:8px">
        역량 이름을 탭하면 ASK 상세를 볼 수 있습니다
      </p>
    </div>

    ${showInterviewBanner ? `
      <div class="fade-in" style="background:linear-gradient(135deg,#064e3b,#065f46);border-radius:14px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:12px">
        <div>
          <div style="font-size:0.95rem;font-weight:700;color:#fff;margin-bottom:4px">AI 심층 인터뷰</div>
          <div style="font-size:0.8rem;color:#a7f3d0">AI 심층 인터뷰로 역량을 더 검증해보세요</div>
        </div>
        <button class="btn btn-sm" id="go-interview-btn" style="background:#10B981;color:#fff;white-space:nowrap;flex-shrink:0">인터뷰 시작</button>
      </div>` : ''}

    <div class="section-title fade-in" style="margin-bottom:12px">역량별 상세</div>
    <div id="score-cards" class="fade-in">
      ${scores.map((s, idx) => renderScoreCard(s, idx)).join('')}
    </div>

    ${groupScores ? `
    <!-- Group scores -->
    <div class="card fade-in" style="margin-top:16px;padding:14px">
      <div class="card-title" style="margin-bottom:10px">카테고리별 점수</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">
        ${['core','leadership','functional','future'].map(k => `
          <div style="background:var(--surface-raised,#F8FAFC);border-radius:8px;padding:8px 10px;text-align:center">
            <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:2px">${k === 'core' ? '핵심' : k === 'leadership' ? '리더십' : k === 'functional' ? '직무' : '미래'}</div>
            <div style="font-size:1.1rem;font-weight:700;color:var(--primary)">${groupScores[k] != null ? Number(groupScores[k]).toFixed(2) : '-'}</div>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    ${aiSummary ? `
    <!-- AI Summary -->
    <div class="card fade-in" style="margin-top:16px;padding:14px;background:#F0FDF4">
      <div style="font-size:0.82rem;font-weight:700;color:#059669;margin-bottom:8px">🤖 AI 역량 분석 요약</div>
      <div style="font-size:0.8rem;color:var(--text);line-height:1.6;white-space:pre-wrap">${escapeHtml(aiSummary)}</div>
    </div>` : ''}

    <!-- IDP CTA -->
    <div class="card fade-in" style="margin-top:16px;padding:16px;text-align:center;background:var(--primary-light,#EEF2FF)">
      <div style="font-size:0.9rem;font-weight:600;color:var(--primary);margin-bottom:8px">📈 개인 성장 계획(IDP) 수립하기</div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px">GAP 분석 기반으로 맞춤 학습 계획을 자동 생성합니다</div>
      <button id="idp-generate-btn" class="btn btn-primary btn-sm">🌱 IDP 자동 생성 →</button>
    </div>
  `;
}

// ── Tab 2: 진단 Kit ────────────────────────────────────────────

function renderKitsTab() {
  let diagResults = {};
  try { diagResults = JSON.parse(localStorage.getItem(LS_DIAG) || '{}'); } catch {}

  const completedCount = Object.keys(diagResults).length;

  const kitCards = DIAG_KITS.map(kit => {
    const result = diagResults[kit.id];
    const done   = !!result;
    const typeCode = result?.typeCode || null;
    const scores   = result?.scores  || null;

    return `
      <div class="card" style="margin-bottom:12px;padding:16px;cursor:pointer;opacity:${done ? 1 : 0.65}"
           onclick="window.location.hash='#/assessment'">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${done && (typeCode || scores) ? 10 : 0}px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:1.4rem">${kit.icon}</span>
            <div>
              <div style="font-weight:700;font-size:0.9rem;color:var(--text)">${escapeHtml(kit.label)}</div>
              <div style="font-size:0.72rem;color:var(--text-muted)">${done ? '완료됨' : '미완료'}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            ${typeCode ? `<span style="font-size:0.95rem;font-weight:800;color:${kit.color}">${escapeHtml(typeCode)}</span>` : ''}
            <span style="font-size:1rem">${done ? '✅' : '○'}</span>
          </div>
        </div>
        ${done && scores && typeof scores === 'object' && !Array.isArray(scores) ? renderScoreMini(scores, kit.color) : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="card fade-in" style="margin-bottom:16px;padding:14px;background:var(--primary-light,#EEF2FF)">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:0.88rem;font-weight:700;color:var(--primary)">🧩 진단 Kit 완료 현황</div>
        <div style="font-size:1.2rem;font-weight:800;color:var(--primary)">${completedCount} / ${DIAG_KITS.length}</div>
      </div>
      <div style="height:6px;background:var(--border);border-radius:3px;margin-top:8px;overflow:hidden">
        <div style="height:100%;width:${Math.round(completedCount/DIAG_KITS.length*100)}%;background:var(--primary);border-radius:3px;transition:width 0.6s ease"></div>
      </div>
    </div>
    <div class="fade-in">${kitCards}</div>
    ${completedCount < DIAG_KITS.length ? `
      <div style="text-align:center;margin-top:8px">
        <button class="btn btn-primary btn-sm" onclick="window.location.hash='#/assessment'">
          나머지 Kit 진단하기 →
        </button>
      </div>` : ''}
  `;
}

function renderScoreMini(scores, color) {
  const entries = Object.entries(scores).slice(0, 4);
  if (!entries.length) return '';
  const max = Math.max(...entries.map(([,v]) => Number(v) || 0), 100);
  return `
    <div style="display:flex;flex-direction:column;gap:5px;margin-top:8px">
      ${entries.map(([dim, val]) => {
        const pct = Math.min(100, Math.round((Number(val) || 0) / max * 100));
        return `
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:28px;font-size:0.68rem;color:var(--text-muted);text-align:right;flex-shrink:0">${escapeHtml(String(dim))}</div>
            <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${color};border-radius:3px"></div>
            </div>
            <div style="width:28px;font-size:0.68rem;color:var(--text-muted)">${Number(val).toFixed(0)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ── Tab 3: 서베이 이력 ─────────────────────────────────────────

function renderSurveysTab() {
  let surveyResp = {};
  try { surveyResp = JSON.parse(localStorage.getItem(LS_SURVEY) || '{}'); } catch {}

  let compSessions = [];
  try {
    const raw = JSON.parse(localStorage.getItem(LS_COMP) || '[]');
    compSessions = Array.isArray(raw) ? raw : [];
  } catch {}

  const completed = Object.entries(surveyResp);

  // Group by phase
  const byPhase = {};
  completed.forEach(([id, resp]) => {
    const phase = resp.phase || 'unknown';
    if (!byPhase[phase]) byPhase[phase] = [];
    byPhase[phase].push({ id, ...resp });
  });

  const phaseSections = Object.entries(byPhase).map(([phase, items]) => {
    const meta = PHASE_META[phase] || { name: phase, icon: '📌', color: 'var(--text-muted)' };
    return `
      <div style="margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="padding:3px 10px;border-radius:var(--radius-full);font-size:0.72rem;font-weight:700;background:${meta.color}20;color:${meta.color}">
            ${meta.icon} ${escapeHtml(meta.name)}
          </span>
          <span style="font-size:0.72rem;color:var(--text-muted)">${items.length}개 완료</span>
        </div>
        ${items.map(item => `
          <div class="card" style="margin-bottom:8px;padding:12px 14px;display:flex;align-items:center;gap:10px">
            <div style="font-size:1rem">✅</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:0.84rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                ${escapeHtml(item.surveyName || item.id)}
              </div>
              <div style="font-size:0.72rem;color:var(--text-muted)">${formatRelativeTime(item.submittedAt)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');

  const compSection = compSessions.length > 0 ? `
    <div class="section-title" style="margin:16px 0 10px">🌳 HR 직무역량 진단</div>
    ${compSessions.slice(-5).reverse().map(s => `
      <div class="card" style="margin-bottom:8px;padding:12px 14px;display:flex;align-items:center;gap:10px">
        <div style="font-size:1rem">🌳</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.84rem;font-weight:600;color:var(--text)">${escapeHtml(s.jobName || s.jobId)}</div>
          <div style="font-size:0.72rem;color:var(--text-muted)">
            ${s.level ? `수준: ${s.level}` : ''}${s.totalScore ? ` · ${Number(s.totalScore).toFixed(0)}점` : ''}
            · ${formatRelativeTime(s.completedAt || s.savedAt)}
          </div>
        </div>
        ${s.level ? `<span class="badge ${s.level === 'L3' ? 'badge-success' : s.level === 'L2' ? 'badge-primary' : 'badge-warning'}" style="font-size:0.72rem">${s.level}</span>` : ''}
      </div>
    `).join('')}
  ` : '';

  if (!completed.length && !compSessions.length) {
    return `
      <div class="empty-state" style="min-height:40vh">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-title">아직 완료한 서베이가 없습니다</div>
        <div class="empty-state-desc">생애주기 서베이를 진행해보세요.</div>
        <button class="btn btn-primary btn-sm" onclick="window.location.hash='#/survey'">서베이 시작 →</button>
      </div>
    `;
  }

  return `
    <div class="card fade-in" style="margin-bottom:16px;padding:14px;background:#ECFDF5">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:0.88rem;font-weight:700;color:#059669">📋 서베이 완료 현황</div>
        <div style="font-size:1.2rem;font-weight:800;color:#059669">${completed.length}개</div>
      </div>
    </div>
    ${phaseSections || '<div style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:16px">서베이 응답 이력이 없습니다</div>'}
    ${compSection}
    <div style="text-align:center;margin-top:12px">
      <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/survey'">서베이 더 보기 →</button>
    </div>
  `;
}

// ── Score card ─────────────────────────────────────────────────

function renderScoreCard(sc, idx) {
  const level   = sc.level || determineLevel(sc.as_is_score);
  const asIs    = Number(sc.as_is_score || 0);
  const toBe    = Number(sc.to_be_score || 0);
  const asisPct = Math.min((asIs / 5.0) * 100, 100).toFixed(1);
  const tobePct = Math.min((toBe / 5.0) * 100, 100).toFixed(1);

  return `
    <div class="comp-score-card card" role="button" tabindex="0"
         style="margin-bottom:12px;padding:16px;cursor:pointer;transition:transform 0.15s,box-shadow 0.15s"
         aria-label="${escapeHtml(sc.competency_name_ko)} 상세 보기">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-weight:600;font-size:0.95rem;color:var(--text)">${escapeHtml(sc.competency_name_ko)}</div>
        <span class="badge ${levelBadgeClass(level)}" style="font-size:0.75rem">${escapeHtml(level)}</span>
      </div>
      <div style="margin-bottom:6px">
        <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-muted);margin-bottom:4px">
          <span>As-Is (현재)</span><span style="color:#4F46E5;font-weight:600">${formatScore(asIs)}</span>
        </div>
        <div style="background:#EEF2FF;border-radius:999px;height:8px;overflow:hidden">
          <div class="score-bar-fill-animate" style="height:100%;border-radius:999px;background:#4F46E5;width:0%;transition:width 0.7s cubic-bezier(0.34,1.56,0.64,1)" data-target="${asisPct}"></div>
        </div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-muted);margin-bottom:4px">
          <span>To-Be (목표)</span><span style="color:#10B981;font-weight:600">${formatScore(toBe)}</span>
        </div>
        <div style="background:#ECFDF5;border-radius:999px;height:8px;overflow:hidden;border:1.5px solid #10B981">
          <div class="score-bar-fill-animate" style="height:100%;border-radius:999px;background:rgba(16,185,129,0.35);width:0%;transition:width 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.15s" data-target="${tobePct}"></div>
        </div>
      </div>
      ${_renderMultiRaterRow(sc)}
      <div style="margin-top:10px;font-size:0.75rem;color:var(--text-light);text-align:right">탭하여 ASK 상세 보기 →</div>
    </div>
  `;
}

function _renderMultiRaterRow(sc) {
  const self    = sc.self_score    != null ? Number(sc.self_score)    : null;
  const manager = sc.manager_score != null ? Number(sc.manager_score) : null;
  const peer    = sc.peer_avg      != null ? Number(sc.peer_avg)      : null;

  if (manager == null && peer == null) return '';

  const chip = (label, val, color) => val != null ? `
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;min-width:44px">
      <div style="font-size:0.78rem;font-weight:700;color:${color}">${val.toFixed(1)}</div>
      <div style="font-size:0.62rem;color:var(--text-muted)">${label}</div>
    </div>` : '';

  return `
    <div style="display:flex;gap:6px;margin-top:10px;padding:8px 10px;background:var(--bg-subtle,#F8FAFC);border-radius:8px;justify-content:flex-start">
      <div style="font-size:0.7rem;color:var(--text-muted);align-self:center;margin-right:4px;white-space:nowrap">평가자별</div>
      ${chip('본인', self, '#4F46E5')}
      ${chip('상사', manager, '#8B5CF6')}
      ${chip('동료', peer, '#0EA5E9')}
    </div>`;
}

// ── Share / Print sheet ────────────────────────────────────────

function _showShareSheet(root, data) {
  // Remove any existing sheet
  document.getElementById('_share-sheet')?.remove();

  const sheet = document.createElement('div');
  sheet.id = '_share-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');

  const score = data.final_score != null ? Number(data.final_score).toFixed(1) : '-';
  const rating = data.final_rating || '';
  const cycleName = escapeHtml(window.appState?.cycleName || '2024 하반기 역량 진단');

  sheet.innerHTML = `
    <div id="_share-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9998"></div>
    <div id="_share-panel" style="position:fixed;bottom:0;left:0;right:0;max-width:500px;margin:0 auto;background:var(--surface,#fff);border-radius:20px 20px 0 0;z-index:9999;padding:20px 20px 32px;box-shadow:0 -4px 24px rgba(0,0,0,0.15);animation:slideUp 0.22s ease-out">
      <div style="width:40px;height:4px;background:var(--border,#e2e8f0);border-radius:2px;margin:0 auto 18px"></div>
      <div style="font-weight:700;font-size:1rem;margin-bottom:4px">진단 결과 저장</div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:20px">${cycleName} · 종합 ${score} / 5.0 ${rating ? `(${rating})` : ''}</div>

      <div style="display:flex;flex-direction:column;gap:10px">
        <button id="_share-print" style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px;border:1.5px solid var(--border,#e2e8f0);background:var(--surface,#fff);cursor:pointer;font-size:0.9rem;font-weight:600;color:var(--text)">
          <span style="font-size:1.3rem">🖨️</span>
          <div style="text-align:left">
            <div>인쇄 / PDF 저장</div>
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:400">브라우저 인쇄 다이얼로그 열기</div>
          </div>
        </button>

        <button id="_share-idp" style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px;border:1.5px solid var(--border,#e2e8f0);background:var(--surface,#fff);cursor:pointer;font-size:0.9rem;font-weight:600;color:var(--text)">
          <span style="font-size:1.3rem">🌱</span>
          <div style="text-align:left">
            <div>성장 계획 세우기</div>
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:400">결과를 바탕으로 IDP 작성</div>
          </div>
        </button>

        <button id="_share-copy" style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px;border:1.5px solid var(--border,#e2e8f0);background:var(--surface,#fff);cursor:pointer;font-size:0.9rem;font-weight:600;color:var(--text)">
          <span style="font-size:1.3rem">📋</span>
          <div style="text-align:left">
            <div>텍스트 복사</div>
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:400">역량 점수 요약 클립보드에 복사</div>
          </div>
        </button>
      </div>

      <button id="_share-close" style="width:100%;margin-top:16px;padding:12px;border-radius:10px;border:none;background:var(--bg,#f8fafc);color:var(--text-muted);font-size:0.9rem;cursor:pointer">취소</button>
    </div>`;

  // Add slide-up animation if not already in document
  if (!document.getElementById('_share-anim-style')) {
    const st = document.createElement('style');
    st.id = '_share-anim-style';
    st.textContent = `@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
@media print{.top-bar,.bottom-nav,#results-share-btn,#results-back-btn,[data-tab],.badge-banner,#interview-banner{display:none!important}
.page-content{padding:0!important}.page{padding-bottom:0!important}}`;
    document.head.appendChild(st);
  }

  document.body.appendChild(sheet);

  const close = () => sheet.remove();

  sheet.querySelector('#_share-overlay').addEventListener('click', close);
  sheet.querySelector('#_share-close').addEventListener('click', close);

  sheet.querySelector('#_share-print').addEventListener('click', () => {
    close();
    // Brief delay so the sheet DOM is removed before print dialog captures the page
    setTimeout(() => window.print(), 120);
  });

  sheet.querySelector('#_share-idp').addEventListener('click', () => {
    close();
    navigate('#/idp');
  });

  sheet.querySelector('#_share-copy').addEventListener('click', async () => {
    const lines = [`📊 역량 진단 결과 — ${cycleName}`, `종합 점수: ${score} / 5.0 ${rating}`, ''];
    (data.scores || []).forEach(sc => {
      const s = Number(sc.as_is_score || 0).toFixed(1);
      const lvl = sc.level || '';
      lines.push(`• ${sc.competency_name_ko}: ${s} (${lvl})`);
    });
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      const btn = sheet.querySelector('#_share-copy div');
      if (btn) { btn.firstChild.textContent = '복사 완료! ✓'; }
    } catch {
      // fallback: show text in prompt for manual copy
      window.prompt('아래 텍스트를 복사하세요:', text);
    }
  });
}

// ── Event binding ──────────────────────────────────────────────

function bindEvents(root, data, scores, showInterviewBanner) {
  root.querySelector('#results-back-btn')?.addEventListener('click', () => {
    history.length > 1 ? window.navBack() : navigate('#/dashboard');
  });

  root.querySelector('#results-share-btn')?.addEventListener('click', () => {
    // Show share/print bottom sheet
    _showShareSheet(root, data);
  });

  root.querySelector('#go-interview-btn')?.addEventListener('click', () => navigate('#/interview'));

  root.querySelector('#idp-generate-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = '생성 중…';
    try {
      const user = (await import('../auth.js').then(m => m.getUser?.()))
        || JSON.parse(localStorage.getItem('hr_user') || 'null');
      const userId     = user?.id || user?.user_id;
      const instanceId = window.appState?.instanceId;
      const scores     = data?.scores || [];
      await api.idp.generate({ userId, instanceId, scores }).catch(() => null);
    } finally {
      btn.disabled = false;
      btn.textContent = original;
      navigate('#/idp');
    }
  });

  // Tab switching
  root.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeTab = btn.dataset.tab;
      renderPage(root, data);
    });
  });

  // Card tap → ASK popup (only in competency tab)
  root.querySelectorAll('.comp-score-card').forEach((card, i) => {
    card.addEventListener('click', () => {
      const sc = scores[i];
      if (!sc) return;
      showAskPopup({ name_ko: sc.competency_name_ko, as_is_score: sc.as_is_score, to_be_score: sc.to_be_score, ask: sc.ask }, sc.ask || null);
    });
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') card.click(); });
  });
}

// ── Radar chart ────────────────────────────────────────────────

function initRadarChart(root, scores) {
  const canvas = root.querySelector('#radar-canvas');
  if (!canvas) return;
  _radarChart = new RadarChart(canvas, { padding: 55, fontSize: 11, showLegend: false, animDuration: 700 });

  const askMap = {};
  for (const sc of scores) { if (sc.competency_id) askMap[sc.competency_id] = sc.ask; }

  _radarChart.setData({
    labels:         scores.map(s => s.competency_name_ko),
    as_is:          scores.map(s => Number(s.as_is_score  || 0)),
    to_be:          scores.map(s => Number(s.to_be_score  || 0)),
    competency_ids: scores.map(s => s.competency_id),
    ask_data:       askMap,
  });

  _radarChart.addTapListener((compId, idx, askData) => {
    const sc = scores[idx];
    if (!sc) return;
    showAskPopup({ name_ko: sc.competency_name_ko, as_is_score: sc.as_is_score, to_be_score: sc.to_be_score }, askData || sc.ask || null);
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.querySelectorAll('.score-bar-fill-animate').forEach(el => {
        el.style.width = el.dataset.target + '%';
      });
    });
  });
}

// ── Utilities ──────────────────────────────────────────────────

function levelBadgeClass(level) {
  switch (level) {
    case 'L3': return 'badge-success';
    case 'L2': return 'badge-primary';
    case 'L1': return 'badge-warning';
    default:   return 'badge-secondary';
  }
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return '방금';
    if (mins < 60) return `${mins}분 전`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}시간 전`;
    const days = Math.floor(hrs / 24);
    if (days < 7)  return `${days}일 전`;
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  } catch { return ''; }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
