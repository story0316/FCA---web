/**
 * analytics.js – Organizational Competency Analytics page
 * HR Competency OS
 *
 * HR Admin view: heatmap, KPI cards, gap analysis, team comparison bar chart.
 * Uses Canvas 2D API for the team bar chart (no external deps).
 */

import { api }         from '../api.js';
import { getUser, isApplicant } from '../auth.js';
import { Heatmap }     from '../components/heatmap.js';
import { showToast }   from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const FONT_FAMILY = "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif";

let _root              = null;
let _heatmap           = null;
let _orgData           = null;
let _orgId             = null;
let _cycle             = 'CYCLE_DEMO_001';
let _resizeRAF         = null;
let _excludeIncomplete = false;
let _orgGoals          = null;
let _orgEmployees      = null;

// ── localStorage keys ──────────────────────────────────────────
const LS_SURVEY = 'hr_survey_responses';
const LS_COMP   = 'hr_comp_sessions';
const LS_DIAG   = 'hr_diag_results';

const PHASE_META = [
  { id: 'hiring',      name: '채용',   icon: '🎯', color: '#4F46E5', total: 4 },
  { id: 'onboarding',  name: '온보딩', icon: '🚀', color: '#10B981', total: 3 },
  { id: 'performance', name: '평가',   icon: '📊', color: '#F59E0B', total: 4 },
  { id: 'development', name: '육성',   icon: '🌱', color: '#059669', total: 3 },
  { id: 'engagement',  name: '재직',   icon: '💡', color: '#8B5CF6', total: 6 },
  { id: 'offboarding', name: '퇴직',   icon: '🏁', color: 'var(--text-muted)', total: 4 },
];

// ── Demo fallback data ────────────────────────────────────────
const DEMO_DATA = {
  org_name: '데모 조직',
  avg_score: 3.6,
  l3_rate: 42,
  high_risk_gap: 3,
  interview_completion: 78,
  heatmap: {
    employees: ['직원 A', '직원 B', '직원 C', '직원 D', '직원 E'],
    competencies: ['AI 활용', '데이터 분석', '커뮤니케이션', '리더십', '문제 해결'],
    scores: [
      [3.8, 4.1, 3.5, 3.3, 4.0],
      [2.5, 3.2, 4.0, 3.8, 3.5],
      [4.2, 3.9, 3.1, 2.8, 4.5],
      [3.0, 2.7, 4.3, 4.1, 3.6],
      [4.5, 4.0, 3.8, 3.2, 3.9],
    ],
  },
  gaps: [
    { competency_name: 'AI 활용 능력',  as_is: 3.6, to_be: 4.5, gap: 0.9 },
    { competency_name: '데이터 분석',    as_is: 3.6, to_be: 4.2, gap: 0.6 },
    { competency_name: '리더십',         as_is: 3.4, to_be: 4.0, gap: 0.6 },
    { competency_name: '커뮤니케이션',   as_is: 3.7, to_be: 4.0, gap: 0.3 },
    { competency_name: '문제 해결',      as_is: 3.9, to_be: 4.5, gap: 0.6 },
  ],
  team_scores: [
    { team_name: '개발팀',   avg_score: 3.9 },
    { team_name: '기획팀',   avg_score: 3.5 },
    { team_name: '마케팅팀', avg_score: 3.7 },
    { team_name: '운영팀',   avg_score: 3.2 },
    { team_name: '인사팀',   avg_score: 3.6 },
  ],
};

// ── Public API ────────────────────────────────────────────────

export async function mount(container) {
  if (isApplicant()) {
    container.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _root         = container;
  _heatmap      = null;
  _orgData      = null;
  _orgGoals     = null;
  _orgEmployees = null;

  const user = getUser();
  _orgId = user?.org_id || user?.organization_id || 'demo';
  _cycle = window.appState?.cycle || 'CYCLE_DEMO_001';

  _renderShell(container, user);
  await _populateCycleSelect();
  await _loadData();

  // Re-render heatmap on window resize
  const _onResize = () => {
    if (_resizeRAF) cancelAnimationFrame(_resizeRAF);
    _resizeRAF = requestAnimationFrame(() => {
      if (_heatmap) _heatmap.render();
    });
  };
  window.addEventListener('resize', _onResize);
  _root._resizeHandler = _onResize;
}

export function unmount() {
  if (_heatmap) { _heatmap.destroy(); _heatmap = null;
  _root = null;
}
  if (_root?._resizeHandler) {
    window.removeEventListener('resize', _root._resizeHandler);
  }
  if (_resizeRAF) cancelAnimationFrame(_resizeRAF);
  _root    = null;
  _orgData = null;
}

// ── Shell render ──────────────────────────────────────────────

function _renderShell(root, user) {
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isSuperAdmin = user?.role === 'super_admin';

  root.innerHTML = `
    <div class="page">
      <!-- Top bar -->
      <div class="top-bar">
        <button class="btn btn-ghost btn-sm" onclick="window.navBack()" style="min-height:40px" aria-label="뒤로가기">‹</button>
        <div class="top-bar-title">조직 역량 분석</div>
        <div style="width:40px"></div>
      </div>

      <div class="page-content" id="analytics-content">

        <!-- Header + selectors -->
        <div class="card fade-in" style="margin-bottom:16px">
          <div class="card-header" style="margin-bottom:0">
            <div>
              <div class="card-title" id="org-name-title">조직 역량 분석</div>
              <div class="card-subtitle" id="org-subtitle">데이터 로딩 중…</div>
            </div>
          </div>

          <!-- Selectors row -->
          <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;align-items:flex-end">
            ${isSuperAdmin ? `
              <div style="flex:1;min-width:130px">
                <label style="font-size:0.72rem;color:var(--text-muted);display:block;margin-bottom:4px">조직 선택</label>
                <select id="org-select" class="form-select" style="width:100%;font-size:0.85rem">
                  <option value="">로딩 중…</option>
                </select>
              </div>
            ` : ''}
            <div style="flex:1;min-width:130px">
              <label style="font-size:0.72rem;color:var(--text-muted);display:block;margin-bottom:4px">평가 사이클</label>
              <select id="cycle-select" class="form-select" style="width:100%;font-size:0.85rem">
                <option value="CYCLE_DEMO_001">2024 상반기</option>
                <option value="CYCLE_DEMO_002">2024 하반기</option>
                <option value="CYCLE_DEMO_003">2025 상반기</option>
              </select>
            </div>
            <div style="flex:1;min-width:130px">
              <label style="font-size:0.72rem;color:var(--text-muted);display:block;margin-bottom:4px">상태 필터</label>
              <select id="status-filter-select" class="form-select" style="width:100%;font-size:0.85rem">
                <option value="">전체</option>
                <option value="completed">완료만</option>
                <option value="self_evaluation">자기평가 중</option>
                <option value="manager_evaluation">관리자평가 중</option>
              </select>
            </div>
            <label style="display:flex;align-items:center;gap:6px;font-size:0.78rem;color:var(--text);cursor:pointer;padding-bottom:2px;white-space:nowrap">
              <input type="checkbox" id="excl-incomplete-chk" ${_excludeIncomplete ? 'checked' : ''}
                     style="width:16px;height:16px;cursor:pointer">
              미완료 제외
            </label>
          </div>
        </div>

        <!-- KPI cards -->
        <div class="section-title fade-in fade-in-delay-1">📊 핵심 지표</div>
        <div id="kpi-grid" style="
          display:grid;
          grid-template-columns:repeat(2,1fr);
          gap:12px;
          margin-bottom:20px;
        " class="fade-in fade-in-delay-1">
          ${_renderKPISkeleton()}
        </div>

        <!-- Heatmap -->
        <div class="section-title fade-in fade-in-delay-2">🗺️ 역량 히트맵</div>
        <div class="card fade-in fade-in-delay-2" style="margin-bottom:20px;overflow:hidden;padding:16px">
          <div id="heatmap-legend" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;align-items:center">
            ${_renderHeatmapLegend()}
          </div>
          <div id="heatmap-container" style="overflow-x:auto;border-radius:var(--radius-sm)">
            <canvas id="heatmap-canvas" style="display:block"></canvas>
          </div>
          <div id="heatmap-detail" style="margin-top:12px;min-height:24px;font-size:0.82rem;color:var(--text-muted)">
            셀을 클릭하면 상세 정보가 표시됩니다.
          </div>
        </div>

        <!-- Gap analysis -->
        <div class="section-title fade-in fade-in-delay-3" style="display:flex;justify-content:space-between;align-items:center">
          <span>🎯 Gap 분석</span>
          <button id="gap-csv-btn" style="display:none;font-size:0.72rem;padding:3px 10px;border-radius:var(--radius-full);border:1px solid var(--border);background:var(--surface);color:var(--text-muted);cursor:pointer">📥 CSV</button>
        </div>
        <div class="card fade-in fade-in-delay-3" style="margin-bottom:20px;padding:16px" id="gap-section">
          <div class="skeleton" style="height:160px;border-radius:var(--radius-sm)"></div>
        </div>

        <!-- Team comparison -->
        <div class="section-title fade-in fade-in-delay-3">👥 팀별 역량 비교</div>
        <div class="card fade-in fade-in-delay-3" style="margin-bottom:20px;padding:16px" id="team-section">
          <canvas id="team-bar-canvas" style="display:block;width:100%"></canvas>
        </div>

        <!-- AI Org Insight -->
        <div id="ai-insight-section" style="display:none">
          <div class="section-title fade-in fade-in-delay-3">🤖 AI 조직 역량 인사이트</div>
          <div class="card fade-in fade-in-delay-3" style="margin-bottom:20px;padding:16px;background:#F0FDF4" id="ai-insight-card">
          </div>
        </div>

        <!-- Survey phase completion -->
        <div class="section-title fade-in fade-in-delay-3">📋 생애주기 서베이 완료 현황</div>
        <div class="card fade-in fade-in-delay-3" style="margin-bottom:20px;padding:16px" id="survey-phase-section">
          ${_renderSurveyPhaseSkeleton()}
        </div>

        <!-- HR Competency sessions -->
        <div class="section-title fade-in fade-in-delay-3">🌳 HR 직무역량 진단 이력</div>
        <div class="card fade-in fade-in-delay-3" style="margin-bottom:20px;padding:16px" id="hr-comp-section">
          ${_renderHRCompSkeleton()}
        </div>

        <!-- OKR 성과 현황 -->
        <div class="section-title fade-in fade-in-delay-3">🎯 OKR 성과 현황</div>
        <div class="card fade-in fade-in-delay-3" style="margin-bottom:20px;padding:16px" id="okr-perf-section">
          <div class="skeleton" style="height:120px;border-radius:8px"></div>
        </div>

      </div>

    </div>
  `;

  _bindShellEvents(root);
}

function _renderHeatmapLegend() {
  const stops = [
    { label: '낮음 (<2.5)', color: 'hsl(0,80%,60%)' },
    { label: '보통 (2.5–3.5)', color: 'hsl(50,80%,60%)' },
    { label: '양호 (3.5–4.0)', color: 'hsl(90,70%,52%)' },
    { label: '우수 (>4.0)', color: 'hsl(130,60%,45%)' },
  ];
  return stops.map(s => `
    <div style="display:flex;align-items:center;gap:5px;font-size:0.72rem;color:var(--text-muted)">
      <span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:${s.color}"></span>
      ${escapeHtml(s.label)}
    </div>
  `).join('');
}

function _renderKPISkeleton() {
  return Array(4).fill(0).map(() =>
    `<div class="skeleton" style="height:84px;border-radius:var(--radius-md)"></div>`
  ).join('');
}

// ── Cycle selector population ─────────────────────────────────

async function _populateCycleSelect() {
  if (!_root || _orgId === 'demo') return;
  try {
    const cycles = await api.assessment.listCycles(_orgId);
    if (!cycles || !cycles.length) return;
    const sel = _root.querySelector('#cycle-select');
    if (!sel) return;
    sel.innerHTML = cycles.map(c =>
      `<option value="${c.id}">${c.cycle_name || c.id}</option>`
    ).join('');
    // Keep appState cycle if it exists and is in the list
    const existing = cycles.find(c => c.id === _cycle);
    _cycle = existing ? _cycle : cycles[0].id;
    sel.value = _cycle;
  } catch { /* keep hardcoded fallback options */ }
}

// ── Data loading ──────────────────────────────────────────────

async function _loadData() {
  const opts = { excludeIncomplete: _excludeIncomplete };
  try {
    const [heatmapData, gapData, goalsData, empData] = await Promise.all([
      api.analytics.orgHeatmap(_orgId, _cycle, opts).catch(() => null),
      api.analytics.gap(_orgId, _cycle, opts).catch(() => null),
      api.performance.getOrgGoals(_orgId).catch(() => null),
      api.employees?.list(_orgId).catch(() => null),
    ]);

    if (heatmapData && (heatmapData.rows?.length || heatmapData.cols?.length)) {
      _orgData = _transformApiData(heatmapData, gapData);
    } else {
      _orgData = DEMO_DATA;
    }

    _orgGoals = goalsData || null;
    _orgEmployees = Array.isArray(empData) ? empData : (empData?.employees || null);
  } catch (err) {
    console.warn('[Analytics] API unavailable, using demo data:', err);
    _orgData = DEMO_DATA;
  }

  _renderAll();
}

function _transformApiData(heatmap, gap) {
  const rows = heatmap.rows || [];
  const cols = heatmap.cols || [];
  const data = heatmap.data || [];

  const allScores = data.flatMap(row => row.filter(s => s != null));
  const avgScore  = allScores.length
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length * 100) / 100
    : null;
  const l3Rate = allScores.length
    ? Math.round(allScores.filter(s => s >= 4.0).length / allScores.length * 100)
    : 0;

  const teamScores = rows.map((row, i) => {
    const vals = (data[i] || []).filter(s => s != null);
    const avg  = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100 : 0;
    return { team_name: row.team_name, avg_score: avg };
  });

  const gaps = (gap?.gaps || []).map(g => ({
    competency_name: g.competency_name_ko,
    as_is:           g.avg_score,
    to_be:           g.target_score,
    gap:             g.gap,
  }));

  return {
    org_name:   heatmap.org_id || '조직',
    avg_score:  avgScore,
    l3_rate:    l3Rate,
    high_risk_gap: (gap?.critical_gaps || []).length,
    interview_completion: null,
    heatmap: {
      employees:    rows.map(r => r.team_name),
      competencies: cols.map(c => c.comp_name),
      scores:       data,
    },
    gaps,
    team_scores:     teamScores,
    ai_insight:      heatmap.ai_insight || null,
    cycle_id:        heatmap.cycle_id,
    participant_count: heatmap.participant_count,
    exclude_incomplete: _excludeIncomplete,
  };
}

// ── Full content render ───────────────────────────────────────

function _renderAll() {
  if (!_root || !_orgData) return;
  _updateHeader();
  _renderKPIs();
  _renderHeatmap();
  _renderGapBars();
  _renderTeamBarChart();
  _renderAiInsight();
  _renderSurveyPhaseChart();
  _renderHRCompHistory();
  _renderOkrPerf();
}

function _renderAiInsight() {
  const section = _root?.querySelector('#ai-insight-section');
  const card    = _root?.querySelector('#ai-insight-card');
  if (!section || !card) return;

  const insight = _orgData?.ai_insight;
  if (!insight) { section.style.display = 'none'; return; }

  section.style.display = 'block';
  card.innerHTML = `
    <div style="font-size:0.82rem;font-weight:700;color:#059669;margin-bottom:8px">🤖 AI 조직 인사이트</div>
    <div style="font-size:0.8rem;color:var(--text);line-height:1.65;white-space:pre-wrap">${escapeHtml(insight)}</div>
    ${_orgData.exclude_incomplete ? '<div style="margin-top:8px;font-size:0.72rem;color:var(--text-muted)">※ 미완료 평가 제외 기준으로 분석</div>' : ''}
  `;
}

function _updateHeader() {
  const titleEl    = _root.querySelector('#org-name-title');
  const subtitleEl = _root.querySelector('#org-subtitle');
  const orgName    = _orgData.org_name || '조직';
  if (titleEl)    titleEl.textContent = `${orgName} 역량 분석`;
  if (subtitleEl) subtitleEl.textContent = `사이클: ${_cycle}`;
}

// ── Skeletons for new sections ─────────────────────────────────

function _renderSurveyPhaseSkeleton() {
  return Array(6).fill(0).map(() => `<div class="skeleton" style="height:28px;border-radius:6px;margin-bottom:8px"></div>`).join('');
}

function _renderHRCompSkeleton() {
  return `<div class="skeleton" style="height:80px;border-radius:8px"></div>`;
}

// ── Survey phase completion chart ──────────────────────────────

function _renderSurveyPhaseChart() {
  const sectionEl = _root?.querySelector('#survey-phase-section');
  if (!sectionEl) return;

  let responses = {};
  try { responses = JSON.parse(localStorage.getItem(LS_SURVEY) || '{}'); } catch {}

  const diagResults = {};
  try { Object.assign(diagResults, JSON.parse(localStorage.getItem(LS_DIAG) || '{}')); } catch {}

  const completedByPhase = {};
  Object.values(responses).forEach(r => {
    if (r.phase) completedByPhase[r.phase] = (completedByPhase[r.phase] || 0) + 1;
  });

  const diagDone = Object.keys(diagResults).length;
  const totalSurveys = PHASE_META.reduce((s, p) => s + p.total, 0);
  const totalDone    = Object.keys(responses).length;

  sectionEl.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div style="font-size:0.82rem;color:var(--text-muted)">전체 완료율</div>
      <div style="font-size:0.9rem;font-weight:700;color:var(--primary)">${totalDone} / ${totalSurveys}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${PHASE_META.map(phase => {
        const done = completedByPhase[phase.id] || 0;
        const pct  = Math.round((done / phase.total) * 100);
        return `
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
              <div style="display:flex;align-items:center;gap:6px">
                <span style="font-size:0.85rem">${phase.icon}</span>
                <span style="font-size:0.8rem;font-weight:600;color:var(--text)">${escapeHtml(phase.name)}</span>
              </div>
              <span style="font-size:0.75rem;color:var(--text-muted)">${done}/${phase.total}</span>
            </div>
            <div style="height:10px;border-radius:5px;background:var(--border);overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${phase.color};border-radius:5px;transition:width 0.6s ease"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
    ${diagDone > 0 ? `
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:0.8rem;color:var(--text-muted)">🧩 진단 Kit 완료</div>
        <div style="font-size:0.88rem;font-weight:700;color:var(--primary)">${diagDone} / 5</div>
      </div>
    ` : ''}
  `;
}

// ── HR Competency session history ──────────────────────────────

function _renderHRCompHistory() {
  const sectionEl = _root?.querySelector('#hr-comp-section');
  if (!sectionEl) return;

  let sessions = [];
  try {
    const raw = JSON.parse(localStorage.getItem(LS_COMP) || '[]');
    sessions = Array.isArray(raw) ? raw : [];
  } catch {}

  if (!sessions.length) {
    sectionEl.innerHTML = `
      <div class="empty-state" style="min-height:80px">
        <div style="color:var(--text-muted);font-size:0.85rem;text-align:center">
          아직 HR 직무역량 진단 이력이 없습니다.<br>
          <a href="#/hr-competency" style="color:var(--primary)">직무역량 진단 시작하기 →</a>
        </div>
      </div>`;
    return;
  }

  // Summary stats
  const levelCounts = { L1: 0, L2: 0, L3: 0 };
  sessions.forEach(s => { if (s.level && levelCounts[s.level] !== undefined) levelCounts[s.level]++; });

  sectionEl.innerHTML = `
    <div style="display:flex;gap:12px;margin-bottom:14px">
      ${['L1','L2','L3'].map(lv => {
        const colors = { L1:'#F59E0B', L2:'#4F46E5', L3:'#10B981' };
        return `
          <div style="flex:1;text-align:center;padding:10px;border-radius:8px;background:${colors[lv]}15;border:1.5px solid ${colors[lv]}30">
            <div style="font-size:1.3rem;font-weight:800;color:${colors[lv]}">${levelCounts[lv]}</div>
            <div style="font-size:0.7rem;color:var(--text-muted)">${lv} 수준</div>
          </div>
        `;
      }).join('')}
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${sessions.slice(-5).reverse().map(s => {
        const levelColor = s.level === 'L3' ? '#10B981' : s.level === 'L2' ? '#4F46E5' : '#F59E0B';
        return `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface)">
            <div style="font-size:1rem">🌳</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:0.83rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                ${escapeHtml(s.jobName || s.jobId)}
              </div>
              <div style="font-size:0.71rem;color:var(--text-muted)">
                ${s.totalScore ? `${Number(s.totalScore).toFixed(0)}점` : ''}
                ${s.completedAt ? ' · ' + _fmtDate(s.completedAt) : ''}
              </div>
            </div>
            ${s.level ? `<span style="font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:var(--radius-full);background:${levelColor}20;color:${levelColor}">${s.level}</span>` : ''}
          </div>
        `;
      }).join('')}
    </div>
    <div style="text-align:center;margin-top:10px">
      <a href="#/hr-competency" style="font-size:0.8rem;color:var(--primary)">직무역량 진단 추가하기 →</a>
    </div>
  `;
}

// ── OKR 성과 현황 ──────────────────────────────────────────────

function _renderOkrPerf() {
  const sectionEl = _root?.querySelector('#okr-perf-section');
  if (!sectionEl) return;

  // Prefer live DB goals; fall back to localStorage
  let goals = _orgGoals;
  if (!goals) {
    try { goals = JSON.parse(localStorage.getItem('hr_okr_goals') || '[]'); } catch { goals = []; }
  }
  if (!goals?.length) {
    sectionEl.innerHTML = `
      <div class="empty-state" style="min-height:80px">
        <div style="color:var(--text-muted);font-size:0.85rem;text-align:center">
          아직 설정된 OKR 목표가 없습니다.<br>
          <a href="#/goals" style="color:var(--primary)">목표 설정하기 →</a>
        </div>
      </div>`;
    return;
  }

  const PERIOD_LABEL = { H1: '상반기', H2: '하반기', ANNUAL: '연간' };

  // Group by period
  const byPeriod = {};
  goals.forEach(g => {
    const p = g.period || 'H1';
    if (!byPeriod[p]) byPeriod[p] = [];
    byPeriod[p].push(g);
  });

  function avgProgress(gs) {
    const all = gs.flatMap(g => g.keyResults || []);
    if (!all.length) return 0;
    return Math.round(all.reduce((s, kr) => s + (kr.progress || 0), 0) / all.length);
  }

  function pColor(p) {
    if (p >= 80) return 'var(--success)';
    if (p >= 50) return 'var(--warning)';
    return 'var(--danger)';
  }

  const periodRows = Object.entries(byPeriod).map(([period, gs]) => {
    const avg  = avgProgress(gs);
    const done = gs.filter(g => avgProgress([g]) >= 80).length;
    const risk = gs.filter(g => g.keyResults?.length && avgProgress([g]) < 50).length;
    return { period, gs, avg, done, risk };
  });

  // Correlation: per-user avg OKR progress vs competency score from loaded employees
  const empScores = {};
  (_orgEmployees || []).forEach(e => {
    empScores[e.id] = e.competencyScore || e.competency_score || 0;
  });

  const userGoals = {};
  goals.forEach(g => {
    const uid = g.user_id || g.userId;
    if (uid) {
      if (!userGoals[uid]) userGoals[uid] = [];
      userGoals[uid].push(g);
    }
  });

  const correlationPoints = Object.entries(userGoals)
    .map(([uid, gs]) => ({
      uid,
      okrPct:    avgProgress(gs),
      compScore: empScores[uid] || 0,
      name:      gs[0]?.ownerName || uid,
    }))
    .filter(p => p.compScore > 0);

  sectionEl.innerHTML = `
    <!-- 기간별 요약 -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      ${periodRows.map(r => `
        <div style="flex:1;min-width:100px;text-align:center;padding:10px 8px;
                    border:1.5px solid ${pColor(r.avg)}40;border-radius:var(--radius-md);
                    background:${pColor(r.avg)}0A">
          <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">
            ${PERIOD_LABEL[r.period] || r.period}
          </div>
          <div style="font-size:1.1rem;font-weight:800;color:${pColor(r.avg)}">${r.avg}%</div>
          <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;margin:6px 0 4px">
            <div style="height:100%;width:${r.avg}%;background:${pColor(r.avg)};border-radius:2px"></div>
          </div>
          <div style="font-size:0.68rem;color:var(--text-muted)">${r.gs.length}개 목표 · 순항 ${r.done} · 위험 ${r.risk}</div>
        </div>`).join('')}
    </div>

    <!-- 역량 × OKR 상관 -->
    ${correlationPoints.length > 1 ? `
    <div style="margin-bottom:16px">
      <div style="font-weight:700;font-size:0.82rem;margin-bottom:8px;color:var(--text)">📉 역량 점수 × OKR 진척률 상관</div>
      <div style="position:relative;height:160px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px">
        <!-- Y axis label -->
        <div style="position:absolute;left:4px;top:50%;transform:translateY(-50%) rotate(-90deg);font-size:0.62rem;color:var(--text-muted);white-space:nowrap">OKR 진척률 (%)</div>
        <!-- X axis label -->
        <div style="position:absolute;bottom:4px;left:50%;transform:translateX(-50%);font-size:0.62rem;color:var(--text-muted)">역량 점수 (5점)</div>
        <!-- Dots -->
        ${correlationPoints.map(p => {
          const x = Math.min(95, Math.max(5, (p.compScore / 5) * 90 + 5));
          const y = Math.min(95, Math.max(5, 95 - (p.okrPct / 100) * 90));
          const c = p.okrPct >= 80 ? 'var(--success)' : p.okrPct >= 50 ? 'var(--warning)' : 'var(--danger)';
          return `<div title="${p.name} | 역량:${p.compScore.toFixed(1)} OKR:${p.okrPct}%"
            style="position:absolute;left:${x}%;top:${y}%;width:10px;height:10px;
                   border-radius:50%;background:${c};transform:translate(-50%,-50%);
                   border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.2)"></div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <!-- 개인별 목표 목록 -->
    <div>
      <div style="font-weight:700;font-size:0.82rem;margin-bottom:8px;color:var(--text)">📋 최근 목표 현황 (상위 5개)</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${goals.slice(-5).reverse().map(g => {
          const avg = avgProgress([g]);
          const krs = (g.keyResults || []).length;
          return `
            <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;
                        border:1px solid var(--border);border-radius:8px;background:var(--surface)">
              <div style="flex:1;min-width:0">
                <div style="font-size:0.82rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                  ${escapeHtml(g.objective || '(제목 없음)')}
                </div>
                <div style="font-size:0.71rem;color:var(--text-muted)">
                  ${PERIOD_LABEL[g.period] || g.period} · KR ${krs}개
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
                <div style="width:60px;height:5px;background:var(--border);border-radius:3px;overflow:hidden">
                  <div style="height:100%;width:${avg}%;background:${pColor(avg)};border-radius:3px"></div>
                </div>
                <span style="font-size:0.75rem;font-weight:700;color:${pColor(avg)};min-width:32px">${avg}%</span>
              </div>
            </div>`;
        }).join('')}
      </div>
      <div style="text-align:center;margin-top:10px">
        <a href="#/goals" style="font-size:0.8rem;color:var(--primary)">목표 관리하기 →</a>
      </div>
    </div>
  `;
}

function _fmtDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch { return ''; }
}

// ── KPI cards ─────────────────────────────────────────────────

function _renderKPIs() {
  const gridEl = _root?.querySelector('#kpi-grid');
  if (!gridEl) return;

  const d = _orgData;

  // Local stats
  let surveyDone = 0;
  try { surveyDone = Object.keys(JSON.parse(localStorage.getItem(LS_SURVEY) || '{}')).length; } catch {}
  let compDone = 0;
  try { const raw = JSON.parse(localStorage.getItem(LS_COMP) || '[]'); compDone = Array.isArray(raw) ? raw.length : 0; } catch {}

  const kpis = [
    {
      label: '평균 역량 점수',
      value: d.avg_score != null ? Number(d.avg_score).toFixed(2) : '-',
      icon:  '📊',
      color: 'var(--primary)',
      sub:   '/ 5.0 기준',
    },
    {
      label: 'L3 달성률',
      value: d.l3_rate != null ? `${d.l3_rate}%` : '-',
      icon:  '🏆',
      color: 'var(--success)',
      sub:   '목표 역량 수준',
    },
    {
      label: '서베이 완료',
      value: `${surveyDone}개`,
      icon:  '📋',
      color: '#059669',
      sub:   '생애주기 서베이',
    },
    {
      label: 'HR 직무역량 진단',
      value: `${compDone}회`,
      icon:  '🌳',
      color: '#8B5CF6',
      sub:   '직무 진단 이력',
    },
  ];

  gridEl.innerHTML = kpis.map(kpi => `
    <div class="card" style="
      padding:14px 16px;
      display:flex;flex-direction:column;gap:6px;
    ">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:1.2rem" aria-hidden="true">${kpi.icon}</span>
        <span style="font-size:0.72rem;color:var(--text-muted);font-weight:500">${escapeHtml(kpi.label)}</span>
      </div>
      <div style="font-size:1.6rem;font-weight:700;color:${kpi.color};line-height:1.1">
        ${escapeHtml(String(kpi.value))}
      </div>
      <div style="font-size:0.7rem;color:var(--text-light)">${escapeHtml(kpi.sub)}</div>
    </div>
  `).join('');
}

// ── Heatmap ───────────────────────────────────────────────────

function _renderHeatmap() {
  const canvas = _root?.querySelector('#heatmap-canvas');
  if (!canvas) return;

  if (_heatmap) { _heatmap.destroy(); _heatmap = null; }

  _heatmap = new Heatmap(canvas, { fontSize: 11 });

  const hm = _orgData.heatmap || {};
  _heatmap.setData({
    employees:    hm.employees    || [],
    competencies: hm.competencies || [],
    scores:       hm.scores       || [],
  });

  // Cell click → show detail
  _heatmap.addCellClickListener((empIdx, compIdx, score) => {
    const detailEl = _root?.querySelector('#heatmap-detail');
    if (!detailEl) return;

    const empName  = (hm.employees    || [])[empIdx]  || `직원 ${empIdx + 1}`;
    const compName = (hm.competencies || [])[compIdx] || `역량 ${compIdx + 1}`;
    const color    = score < 2.5 ? 'var(--danger)' : score < 3.5 ? 'var(--warning)' : 'var(--success)';

    detailEl.innerHTML = `
      <span style="font-weight:600;color:var(--text)">${escapeHtml(empName)}</span>
      ·
      <span style="color:var(--text-muted)">${escapeHtml(compName)}</span>
      ·
      <span style="font-weight:700;color:${color}">${Number(score).toFixed(1)}</span>
    `;
  });
}

// ── Gap bar chart ─────────────────────────────────────────────

function _renderGapBars() {
  const sectionEl = _root?.querySelector('#gap-section');
  if (!sectionEl) return;

  const gaps = (_orgData.gaps || []).slice().sort((a, b) => b.gap - a.gap);

  if (!gaps.length) {
    sectionEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🎯</div><div class="empty-state-title">GAP 데이터가 없습니다</div></div>`;
    return;
  }

  const maxGap = Math.max(...gaps.map(g => g.to_be || 5), 5);

  sectionEl.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      ${gaps.map(g => {
        const asIsW  = ((g.as_is  || 0) / maxGap * 100).toFixed(1);
        const toBeW  = ((g.to_be  || 0) / maxGap * 100).toFixed(1);
        const gapPct = ((g.gap    || 0) / maxGap * 100).toFixed(1);
        const gapColor = (g.gap || 0) >= 1.5 ? 'var(--danger)'
                       : (g.gap || 0) >= 0.5 ? 'var(--warning)'
                       : 'var(--success)';
        return `
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
              <span style="font-size:0.82rem;font-weight:500;color:var(--text)">${escapeHtml(g.competency_name || '')}</span>
              <span style="font-size:0.78rem;font-weight:700;color:${gapColor}">
                GAP ${Number(g.gap || 0).toFixed(1)}
              </span>
            </div>
            <div style="position:relative;height:18px;border-radius:var(--radius-full);
              background:var(--border);overflow:hidden">
              <!-- To-Be (target) background -->
              <div style="position:absolute;inset:0;width:${toBeW}%;
                background:rgba(79,70,229,0.12);border-radius:var(--radius-full)"></div>
              <!-- As-Is bar -->
              <div style="
                position:absolute;top:0;left:0;height:100%;
                width:${asIsW}%;
                background:var(--primary);
                border-radius:var(--radius-full);
                transition:width 600ms ease;
              "></div>
              <!-- Score labels -->
              <div style="position:absolute;inset:0;display:flex;align-items:center;
                justify-content:flex-end;padding-right:8px">
                <span style="font-size:0.68rem;font-weight:600;color:var(--text-muted)">
                  ${Number(g.as_is || 0).toFixed(1)} / ${Number(g.to_be || 0).toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
    <div style="display:flex;gap:16px;margin-top:12px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:5px;font-size:0.72rem;color:var(--text-muted)">
        <span style="display:inline-block;width:24px;height:4px;border-radius:2px;background:var(--primary)"></span>
        현재 (As-Is)
      </div>
      <div style="display:flex;align-items:center;gap:5px;font-size:0.72rem;color:var(--text-muted)">
        <span style="display:inline-block;width:24px;height:4px;border-radius:2px;background:rgba(79,70,229,0.25)"></span>
        목표 (To-Be)
      </div>
    </div>
  `;

  const csvBtn = _root?.querySelector('#gap-csv-btn');
  if (csvBtn) {
    csvBtn.style.display = 'block';
    csvBtn.onclick = () => {
      const BOM = '﻿';
      const header = '역량명,현재(As-Is),목표(To-Be),GAP\n';
      const rows = gaps.map(g =>
        `"${(g.competency_name || '').replace(/"/g, '""')}",${Number(g.as_is || 0).toFixed(2)},${Number(g.to_be || 0).toFixed(2)},${Number(g.gap || 0).toFixed(2)}`
      ).join('\n');
      const blob = new Blob([BOM + header + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: 'gap_analysis.csv' });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };
  }
}

// ── Team bar chart (Canvas 2D) ────────────────────────────────

function _renderTeamBarChart() {
  const canvas = _root?.querySelector('#team-bar-canvas');
  if (!canvas) return;

  const teams = _orgData.team_scores || [];
  if (!teams.length) {
    const section = _root?.querySelector('#team-section');
    if (section) section.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-title">팀 데이터가 없습니다</div></div>`;
    return;
  }

  // Sizing
  const dpr      = window.devicePixelRatio || 1;
  const parent   = canvas.parentElement;
  const cssWidth = parent ? (parent.clientWidth - 32) || 300 : 300;
  const barH     = 32;
  const barGap   = 10;
  const padLeft  = 72;   // left margin for team names
  const padRight = 60;   // right margin for score labels
  const padTop   = 20;
  const padBot   = 28;   // bottom margin for x-axis labels
  const chartH   = padTop + teams.length * (barH + barGap) + padBot;

  canvas.style.width  = cssWidth + 'px';
  canvas.style.height = chartH  + 'px';
  canvas.width  = Math.round(cssWidth * dpr);
  canvas.height = Math.round(chartH  * dpr);

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, chartH);

  const chartW  = cssWidth - padLeft - padRight;
  const maxVal  = 5;

  // X-axis gridlines + labels
  const gridVals = [1, 2, 3, 4, 5];
  ctx.save();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 3]);

  for (const val of gridVals) {
    const x = padLeft + (val / maxVal) * chartW;
    ctx.beginPath();
    ctx.moveTo(x, padTop);
    ctx.lineTo(x, padTop + teams.length * (barH + barGap));
    ctx.stroke();

    ctx.fillStyle    = 'var(--text-muted)';
    ctx.font         = `400 10px ${FONT_FAMILY}`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(val), x, padTop + teams.length * (barH + barGap) + 6);
  }
  ctx.setLineDash([]);
  ctx.restore();

  // Bars
  teams.forEach((team, i) => {
    const y     = padTop + i * (barH + barGap);
    const score = Math.max(0, Math.min(maxVal, team.avg_score || 0));
    const bw    = (score / maxVal) * chartW;

    // Bar background (track)
    ctx.save();
    ctx.fillStyle = '#F1F5F9';
    _roundRect(ctx, padLeft, y, chartW, barH, 6);
    ctx.fill();

    // Score bar — color based on score level
    const barColor = score >= 4.0 ? '#10B981'
                   : score >= 3.5 ? '#4F46E5'
                   : score >= 2.5 ? '#F59E0B'
                   : '#EF4444';

    if (bw > 0) {
      ctx.fillStyle = barColor;
      _roundRect(ctx, padLeft, y, bw, barH, 6);
      ctx.fill();
    }

    // Team name (left)
    ctx.fillStyle    = '#1E293B';
    ctx.font         = `500 11px ${FONT_FAMILY}`;
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    const nameLabel = String(team.team_name || '').slice(0, 6);
    ctx.fillText(nameLabel, padLeft - 8, y + barH / 2);

    // Score label (right of bar)
    ctx.fillStyle    = '#1E293B';
    ctx.font         = `700 11px ${FONT_FAMILY}`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(Number(score).toFixed(2), padLeft + bw + 8, y + barH / 2);

    ctx.restore();
  });

  // X-axis baseline
  ctx.save();
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(padLeft, padTop + teams.length * (barH + barGap));
  ctx.lineTo(padLeft + chartW, padTop + teams.length * (barH + barGap));
  ctx.stroke();
  ctx.restore();
}

/** Draw a rounded rectangle path (no fill/stroke — caller does that). */
function _roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── Event binding ─────────────────────────────────────────────

function _bindShellEvents(root) {
  // Cycle selector
  const cycleSelect = root.querySelector('#cycle-select');
  if (cycleSelect) {
    cycleSelect.value = _cycle;
    cycleSelect.addEventListener('change', async (e) => {
      _cycle = e.target.value;
      const subtitleEl = root.querySelector('#org-subtitle');
      if (subtitleEl) subtitleEl.textContent = `사이클: ${_cycle} (로딩 중…)`;
      await _loadData();
    });
  }

  // Status filter selector
  const statusSelect = root.querySelector('#status-filter-select');
  if (statusSelect) {
    statusSelect.addEventListener('change', async () => {
      // status filter interacts with excludeIncomplete; if 'completed' selected, sync checkbox
      const val = statusSelect.value;
      const chk = root.querySelector('#excl-incomplete-chk');
      if (val === 'completed' && chk) { chk.checked = true; _excludeIncomplete = true; }
      await _loadData();
    });
  }

  // "미완료 제외" checkbox
  const exclChk = root.querySelector('#excl-incomplete-chk');
  if (exclChk) {
    exclChk.addEventListener('change', async (e) => {
      _excludeIncomplete = e.target.checked;
      // If unchecking, also reset status filter
      if (!_excludeIncomplete && statusSelect && statusSelect.value === 'completed') {
        statusSelect.value = '';
      }
      const subtitleEl = root.querySelector('#org-subtitle');
      if (subtitleEl) subtitleEl.textContent = `사이클: ${_cycle} (로딩 중…)`;
      await _loadData();
    });
  }

  // Org selector (super_admin only)
  const orgSelect = root.querySelector('#org-select');
  if (orgSelect) {
    _loadOrgList(orgSelect);
  }
}

async function _loadOrgList(selectEl) {
  try {
    // Try to get available orgs — if API not available, show placeholder
    const user = getUser();
    selectEl.innerHTML = `<option value="${escapeHtml(_orgId)}">${escapeHtml(_orgId)}</option>`;
    selectEl.addEventListener('change', async (e) => {
      _orgId = e.target.value;
      await _loadData();
    });
  } catch (err) {
    console.warn('[Analytics] Could not load org list:', err);
  }
}

// ── Utilities ─────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
