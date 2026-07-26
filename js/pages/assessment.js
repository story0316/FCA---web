/**
 * assessment.js – Assessment flow page
 * HR Competency OS
 * Flow: template selection → card swipe → completion → results CTA
 */

import { api } from '../api.js';
import { getUser, isApplicant } from '../auth.js';
import { CardSwipe } from '../components/card-swipe.js';
import { renderWorkflowStepper } from '../components/workflow-badge.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
import { getActiveKits } from '../data/diagnostic_kits.js';

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId() {
  const s = _session();
  return s.empId || s.userId || getUser()?.id || 'EMP001';
}

const EVALUATOR_LABELS = { self: '자기평가', manager: '상사평가', peer: '동료평가', subordinate: '부하평가', customer: '고객평가' };

let _root      = null;
let _cardSwipe = null;
let _state     = {
  step:          'templates', // templates | assessing | complete
  template:      null,
  cycleId:       null,
  instanceId:    null,
  evaluatorMode: false,
  evaluatorType: 'self',
  subjectName:   '',
  scores:        {},
};

export async function mount(root, appState) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _root  = root;
  _state = {
    step:          'templates',
    template:      null,
    cycleId:       appState?.cycleId       || null,
    instanceId:    appState?.instanceId    || null,
    evaluatorMode: appState?.evaluatorMode || false,
    evaluatorType: appState?.evaluatorType || 'self',
    subjectName:   appState?.subjectName   || '',
    scores:        {},
  };

  // If we have an existing instance (own or evaluator task), jump to assessing
  if (_state.instanceId) {
    await startAssessment(root, _state.instanceId);
  } else {
    await renderTemplateSelection(root);
  }
}

export function unmount() {
  if (_cardSwipe) { _cardSwipe.destroy(); _cardSwipe = null; }
  _root = null;
}

// ── Step 1: Template Selection ────────────────────────────────
async function renderTemplateSelection(root) {
  const activeKits = getActiveKits();

  root.innerHTML = `
    <div class="page">
      <div class="top-bar">
        <button class="top-bar-back" aria-label="뒤로">‹</button>
        <div class="top-bar-title">역량 진단 시작</div>
      </div>

      <div class="page-content">
        <div class="section-title">역량 평가 템플릿</div>
        <div class="section-subtitle">본인에게 해당하는 직무/직급의 템플릿을 선택하세요.</div>

        <div id="template-list" class="template-grid">
          ${Array(2).fill(0).map(() => `<div class="skeleton skeleton-card" style="height:120px"></div>`).join('')}
        </div>

        <div id="template-actions" style="display:none;margin-top:20px">
          <button class="btn btn-primary btn-block btn-lg" id="start-btn">
            선택한 템플릿으로 시작
          </button>
        </div>

        ${activeKits.length ? `
          <div style="margin-top:32px">
            <div class="section-title" style="margin-bottom:4px">인적성 · 진단 Kit</div>
            <div class="section-subtitle" style="margin-bottom:14px">
              역량 평가와 별도로 성격·행동 유형을 파악하는 진단 도구입니다.
            </div>
            <div id="kit-list" style="display:flex;flex-direction:column;gap:10px">
              ${activeKits.map(kit => `
                <div class="card" style="padding:16px;display:flex;align-items:center;gap:14px;cursor:pointer"
                     data-kit-id="${kit.id}" role="button" tabindex="0">
                  <div style="font-size:2rem;line-height:1">${kit.icon}</div>
                  <div style="flex:1;min-width:0">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
                      <div style="font-weight:700;font-size:0.95rem">${escapeHtml(kit.name_ko)}</div>
                      <span style="padding:2px 8px;background:${kit.color}20;color:${kit.color};
                                   border-radius:999px;font-size:0.72rem;font-weight:700">
                        ${escapeHtml(kit.tag_ko || kit.type)}
                      </span>
                    </div>
                    <div style="font-size:0.8rem;color:var(--text-muted);
                                overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;
                                -webkit-box-orient:vertical;word-break:keep-all">
                      ${escapeHtml(kit.description_ko)}
                    </div>
                    <div style="margin-top:6px;font-size:0.75rem;color:var(--text-light)">
                      ${kit.question_count}문항 · ${kit.vendor}
                    </div>
                  </div>
                  <div style="color:var(--primary);font-size:1.2rem;flex-shrink:0">›</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

      </div>

    </div>
  `;

  const user  = getUser();
  const orgId = user?.org_id || user?.organization_id;

  try {
    const templates = await api.templates.list(orgId);
    renderTemplates(root, templates || getDemoTemplates());
  } catch (err) {
    renderTemplates(root, getDemoTemplates());
  }

  // Kit click handlers
  root.querySelectorAll('[data-kit-id]').forEach(card => {
    const go = () => {
      window.location.hash = `#/diagnostic?kit=${card.dataset.kitId}`;
    };
    card.addEventListener('click', go);
    card.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  });
}

function renderTemplates(root, templates) {
  const listEl = root.querySelector('#template-list');
  if (!listEl) return;

  if (!templates.length) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-title">사용 가능한 템플릿이 없습니다</div>
        <div class="empty-state-desc">HR 담당자에게 문의해 주세요.</div>
      </div>`;
    return;
  }

  let selected = null;

  listEl.innerHTML = templates.map((t, i) => `
    <div class="template-card fade-in" data-id="${t.id || t.template_id}" tabindex="0" role="radio">
      <div class="template-card-title">${escapeHtml(t.name || t.name_ko || '템플릿 ' + (i + 1))}</div>
      <div class="template-card-desc">${escapeHtml(t.description || t.description_ko || '')}</div>
      <div class="template-card-meta">
        ${t.job_family ? `<span class="badge badge-info">${escapeHtml(t.job_family)}</span>` : ''}
        ${t.level      ? `<span class="badge badge-gray">${escapeHtml(t.level)}</span>` : ''}
        ${t.competency_count ? `<span class="badge badge-primary">${t.competency_count}개 역량</span>` : ''}
      </div>
    </div>
  `).join('');

  // Selection logic
  const actionsEl = root.querySelector('#template-actions');
  listEl.querySelectorAll('.template-card').forEach(card => {
    function select() {
      listEl.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selected = templates.find(t => (t.id || t.template_id) === card.dataset.id) || templates[0];
      actionsEl.style.display = 'block';
    }
    card.addEventListener('click',  select);
    card.addEventListener('keydown', e => { if (e.key === 'Enter') select(); });
  });

  // Start button
  root.querySelector('#start-btn')?.addEventListener('click', async () => {
    if (!selected) { showToast('템플릿을 선택해 주세요.', 'warning'); return; }
    await createAndStart(root, selected);
  });
}

async function createAndStart(root, template) {
  const user  = getUser();
  const orgId = user?.org_id || user?.organization_id;
  const btn   = root.querySelector('#start-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> 생성 중...'; }

  try {
    const cycle = await api.assessment.createCycle({
      org_id:      orgId,
      template_id: template.id || template.template_id,
      name:        template.name || template.name_ko || '역량 진단 ' + new Date().toLocaleDateString('ko'),
      purpose:     template.purpose || 'self_assessment',
    });

    // In demo mode cycle is null — use a stable demo ID
    _state.cycleId = cycle?.id || cycle?.cycle_id || 'CYCLE_DEMO_001';

    const instance = await api.assessment.createInstance(_state.cycleId, {
      assessee_id:   _empId(),
      assessor_id:   _empId(),
      assessor_role: 'self',
    });

    // In demo mode instance is null — use a stable demo ID
    _state.instanceId = instance?.id || instance?.instance_id || 'INST_DEMO_001';
    _state.template   = template;

    await startAssessment(root, _state.instanceId, template);

  } catch (err) {
    showToast(err.message || '평가를 시작할 수 없습니다.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '선택한 템플릿으로 시작'; }
  }
}

// ── Step 2: Card Swipe Assessment ─────────────────────────────
async function startAssessment(root, instanceId, template) {
  _state.step = 'assessing';

  const evalLabel = _state.evaluatorMode
    ? (EVALUATOR_LABELS[_state.evaluatorType] || '평가')
    : '자가 평가';
  const titleSuffix = _state.evaluatorMode && _state.subjectName
    ? ` — ${_state.subjectName} 님`
    : '';

  root.innerHTML = `
    <div class="page">
      <div class="top-bar">
        <button class="top-bar-back" id="assess-back" aria-label="뒤로">‹</button>
        <div class="top-bar-title">역량 ${evalLabel}${titleSuffix}</div>
        <button class="top-bar-action" id="assess-save">임시 저장</button>
      </div>

      <div class="assessment-header">
        <div class="assessment-step-label">STEP 2 · 역량 평가</div>
        <div id="assess-stepper"></div>
      </div>

      <div id="assess-swipe-area" style="padding:0 16px 16px">
        <div class="loading-overlay">
          <div class="spinner spinner-lg"></div>
          <span>역량 목록을 불러오는 중...</span>
        </div>
      </div>

    </div>
  `;

  // Render stepper
  const stepperEl = root.querySelector('#assess-stepper');
  if (stepperEl) {
    renderWorkflowStepper(stepperEl, 'self_assessment');
  }

  // Back button
  root.querySelector('#assess-back')?.addEventListener('click', () => {
    if (_state.scores && Object.keys(_state.scores).length > 0) {
      showToast('평가가 중단됩니다. 현재까지의 응답은 저장되지 않습니다.', 'warning');
    }
    window.location.hash = '#/assessment';
  });

  // Load competencies
  try {
    const user  = getUser();
    const orgId = user?.org_id || user?.organization_id;
    const status = await api.assessment.getStatus(instanceId);
    const templateId = status?.template_id || template?.id;

    let competencies = [];
    if (templateId && orgId) {
      competencies = await api.competencies.list(orgId, { template_id: templateId }) || [];
    } else if (orgId) {
      competencies = await api.competencies.list(orgId) || [];
    }

    if (!competencies.length) {
      competencies = getDemoCompetencies();
    }

    renderSwipeUI(root, instanceId, competencies);
  } catch (err) {
    console.error('[Assessment]', err);
    showToast('역량 목록을 불러오지 못했습니다.', 'error');
    renderSwipeUI(root, instanceId, getDemoCompetencies());
  }
}

function renderSwipeUI(root, instanceId, competencies) {
  const swipeArea = root.querySelector('#assess-swipe-area');
  if (!swipeArea) return;

  swipeArea.innerHTML = '';

  if (_cardSwipe) { _cardSwipe.destroy(); }

  _cardSwipe = new CardSwipe(swipeArea, {
    onScore: (compId, score) => {
      _state.scores[compId] = score;
    },
    onComplete: async (allScores) => {
      _state.scores = allScores;
      await submitScores(root, instanceId, allScores);
    },
  });

  _cardSwipe.load(competencies);

  // Save button
  root.querySelector('#assess-save')?.addEventListener('click', async () => {
    if (!Object.keys(_state.scores).length) {
      showToast('저장할 응답이 없습니다.', 'info');
      return;
    }
    try {
      await api.assessment.submitResponses(instanceId, { responses: buildResponseArray(_state.scores), partial: true });
      showToast('임시 저장되었습니다.', 'success')
      addNotification({ type: 'success', title: 'assessment', body: '임시 저장되었습니다.' });
    } catch { showToast('저장 실패', 'error'); }
  });
}

// ── Step 3: Submit + Completion ───────────────────────────────
async function submitScores(root, instanceId, scores) {
  try {
    await api.assessment.submitResponses(instanceId, {
      responses: buildResponseArray(scores),
      partial: false,
    });

    if (!_state.evaluatorMode) {
      // Trigger score computation (self only)
      try { await api.assessment.computeScores(instanceId); } catch { /* non-fatal */ }
      // Transition to next status (self only)
      try { await api.assessment.transition(instanceId, 'manager_review'); } catch { /* non-fatal */ }
    }

    renderCompletion(root, instanceId);
  } catch (err) {
    showToast(err.message || '제출 중 오류가 발생했습니다.', 'error');
  }
}

function renderCompletion(root, instanceId) {
  _state.step = 'complete';

  // startAssessment renders #assess-swipe-area, not .page-content
  const content = root.querySelector('#assess-swipe-area') || root.querySelector('.page-content');
  if (!content) return;

  const isEval = _state.evaluatorMode;
  const evalLabel = isEval ? (EVALUATOR_LABELS[_state.evaluatorType] || '평가') : '자가 평가';

  content.innerHTML = `
    <div class="completion-screen">
      <div class="completion-icon">${isEval ? '👏' : '🎉'}</div>
      <div class="completion-title">${isEval ? evalLabel + ' 완료!' : '자가 평가 완료!'}</div>
      <div class="completion-desc" style="margin-bottom:24px">
        ${isEval
          ? `${_state.subjectName ? `<strong>${escapeHtml(_state.subjectName)}</strong> 님에 대한 ` : ''}${evalLabel}가 완료되었습니다.<br>소중한 평가 의견에 감사드립니다.`
          : '모든 역량에 대한 자가 평가가 완료되었습니다.<br>결과를 확인하거나 AI 인터뷰를 시작해 보세요.'
        }
      </div>
      ${!isEval ? `
      <button class="btn btn-primary btn-block btn-lg" id="view-result-btn">
        📈 결과 확인하기
      </button>` : ''}
      <button class="btn ${isEval ? 'btn-primary' : 'btn-secondary'} btn-block" id="back-home-btn" style="margin-top:10px">
        🏠 홈으로 돌아가기
      </button>
    </div>
  `;

  root.querySelector('#view-result-btn')?.addEventListener('click', () => {
    window.appState = window.appState || {};
    window.appState.instanceId = instanceId;
    window.location.hash = '#/results';
  });
  root.querySelector('#back-home-btn')?.addEventListener('click', () => {
    window.location.hash = '#/dashboard';
  });
}

// ── Helpers ───────────────────────────────────────────────────
function buildResponseArray(scores) {
  const role = _state.evaluatorMode ? (_state.evaluatorType || 'peer') : 'self';
  return Object.entries(scores).map(([competency_id, score]) => ({
    competency_id,
    score,
    assessor_role:  role,
    evaluator_type: role,
  }));
}

function getDemoTemplates() {
  return [
    {
      id: 'tpl_001',
      name: '일반 직원 역량 평가',
      description: '전 직원 공통 핵심 역량 + 직무 역량을 평가합니다.',
      job_family: '공통',
      level: '사원~과장',
      competency_count: 8,
      purpose: 'annual',
    },
    {
      id: 'tpl_002',
      name: '팀장 리더십 역량 평가',
      description: '팀장급 이상의 리더십 및 전략적 사고 역량을 평가합니다.',
      job_family: '리더십',
      level: '차장~임원',
      competency_count: 10,
      purpose: 'annual',
    },
  ];
}

function getDemoCompetencies() {
  return [
    { id: 'c1', name_ko: '전략적 사고',    category: '핵심 역량', description_ko: '조직의 방향과 연계하여 업무를 기획하고 실행합니다.' },
    { id: 'c2', name_ko: '커뮤니케이션',   category: '핵심 역량', description_ko: '다양한 상대와 명확하고 효과적으로 소통합니다.' },
    { id: 'c3', name_ko: '문제 해결력',    category: '핵심 역량', description_ko: '복잡한 문제를 분석하고 창의적인 해결책을 도출합니다.' },
    { id: 'c4', name_ko: '협업과 팀워크',  category: '핵심 역량', description_ko: '팀원들과 협력하여 공동 목표를 달성합니다.' },
    { id: 'c5', name_ko: '결과 지향성',    category: '성과 역량', description_ko: '높은 기준을 설정하고 목표 달성에 집중합니다.' },
    { id: 'c6', name_ko: '변화 대응력',    category: '성과 역량', description_ko: '빠르게 변화하는 환경에 유연하게 적응합니다.' },
    { id: 'c7', name_ko: '고객 중심 사고', category: '직무 역량', description_ko: '내/외부 고객의 니즈를 파악하고 가치를 창출합니다.' },
    { id: 'c8', name_ko: '데이터 활용',    category: '미래 역량', description_ko: '데이터를 수집, 분석하여 의사결정에 활용합니다.' },
  ];
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
