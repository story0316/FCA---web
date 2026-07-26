/**
 * interview.js – AI Competency Interview Page
 * HR Competency OS
 *
 * Flow:
 *   1. Load L2+ competencies from appState.resultsData or API
 *   2. User selects a competency chip
 *   3. POST /api/interview/start → receive session_id + question_ko
 *   4. InterviewUI handles STT recording
 *   5. POST /api/interview/evaluate → receive scores + feedback
 *   6. Display ScoreBar breakdown + text feedback
 *   7. "다음 역량" or "IDP 보기" navigation
 */

import { api }                                    from '../api.js';
import { navigate }                               from '../app.js';
import { InterviewUI }                            from '../components/interview-ui.js';
import { renderInterviewScoreBars, renderScoreBar } from '../components/score-bar.js';
import { showToast }                              from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
import { determineLevel }                         from '../utils/score.js';

// ── Module-level state ─────────────────────────────────────────
let _root         = null;
let _interviewUI  = null;

const _state = {
  competencies:   [],   // [{competency_id, competency_name_ko, level, ask}]
  selected:       null,
  sessionId:      null,
  questionKo:     null,
  completed:      new Set(),   // evaluated competency IDs
  recordings:     {},          // compId → {transcript, duration, saved_at}
  evalResults:    {},          // compId → evalResult
  phase:          'select',    // 'select'|'recording'|'saved'|'batch_eval'|'done'
};

const RECORDINGS_KEY = 'hr_iv_recordings';

function _saveRecordings() {
  try { localStorage.setItem(RECORDINGS_KEY, JSON.stringify(_state.recordings)); } catch (_) {}
}
function _loadRecordings() {
  try {
    const raw = localStorage.getItem(RECORDINGS_KEY);
    if (raw) _state.recordings = JSON.parse(raw) || {};
  } catch (_) { _state.recordings = {}; }
}

// ── Fallback demo competency ───────────────────────────────────
const DEMO_COMPETENCY = {
  competency_id:      'COMP_CORE_AI',
  competency_name_ko: 'AI 활용 능력',
  level:              'L2',
  ask: {
    ability:   { L1: '기본적인 AI 도구 사용', L2: 'AI 솔루션 설계 및 적용', L3: 'AI 전략 수립 및 조직 변환' },
    skill:     { L1: '프롬프트 작성', L2: '모델 파인튜닝 및 파이프라인 설계', L3: 'MLOps 및 AI 거버넌스' },
    knowledge: { L1: 'AI 기초 개념', L2: '머신러닝 알고리즘 이해', L3: 'AI 윤리 및 규제 프레임워크' },
  },
  interview_question: 'AI 도구를 활용하여 실제 업무 문제를 해결한 경험을 구체적으로 설명해 주세요. 어떤 맥락에서, 어떤 행동을 취했으며, 어떤 리스크를 고려했나요?',
};

// ── Public API ─────────────────────────────────────────────────

export async function mount(container) {
  _root = container;

  _state.selected    = null;
  _state.sessionId   = null;
  _state.questionKo  = null;
  _state.completed   = new Set();
  _state.evalResults = {};
  _state.phase       = 'select';
  _loadRecordings(); // restore saved answers from previous session

  renderSkeleton(container);
  _state.competencies = await loadInterviewCompetencies();
  renderPage(container);
}

export function unmount() {
  if (_interviewUI) {
    _interviewUI.destroy();
    _interviewUI = null;
  }
  _root = null;
}

// ── Data loading ───────────────────────────────────────────────

async function loadInterviewCompetencies() {
  // Priority 1: reuse cached results from results page
  const cached = window.appState?.resultsData;
  if (cached && Array.isArray(cached.scores) && cached.scores.length > 0) {
    const qualified = cached.scores.filter(s => {
      const lvl = s.level || determineLevel(s.as_is_score);
      return lvl === 'L2' || lvl === 'L3';
    });
    if (qualified.length > 0) return qualified;
  }

  // Priority 2: fetch from API
  const instanceId = window.appState?.instanceId || 'INST_DEMO_001';
  try {
    const data = await api.assessment.getResults(instanceId);
    if (data && Array.isArray(data.scores) && data.scores.length > 0) {
      const qualified = data.scores.filter(s => {
        const lvl = s.level || determineLevel(s.as_is_score);
        return lvl === 'L2' || lvl === 'L3';
      });
      if (qualified.length > 0) {
        // Cache for other pages
        window.appState = window.appState || {};
        window.appState.resultsData = data;
        return qualified;
      }
    }
  } catch (err) {
    console.warn('[Interview] Could not fetch results:', err);
  }

  // Fallback: show single demo competency
  return [DEMO_COMPETENCY];
}

// ── Full page render ───────────────────────────────────────────

function renderPage(root) {
  const comps    = _state.competencies;
  const total    = comps.length;
  const doneCount = _state.completed.size;

  root.innerHTML = `
    <div class="page">

      <!-- ── Top bar ── -->
      <div class="top-bar">
        <button class="btn btn-ghost btn-sm" id="iv-back-btn"
                style="min-height:40px" aria-label="뒤로 가기">← 뒤로</button>
        <div class="top-bar-title">AI 역량 인터뷰</div>
        <div style="width:60px"></div>
      </div>

      <div class="page-content" style="padding-bottom:40px">

        <!-- ── Progress counter ── -->
        <div class="fade-in" id="iv-progress-bar"
             style="display:flex;align-items:center;justify-content:space-between;
                    margin-bottom:16px">
          <div style="font-size:0.85rem;color:var(--text-muted)">
            <span id="iv-done-count">${doneCount}</span>
            <span style="color:var(--text-light)"> / ${total} 역량 완료</span>
          </div>
          <div style="height:6px;flex:1;margin:0 12px;background:var(--bg);
                      border-radius:999px;overflow:hidden">
            <div id="iv-progress-fill"
                 style="height:100%;border-radius:999px;background:var(--primary);
                        width:${total > 0 ? Math.round((doneCount / total) * 100) : 0}%;
                        transition:width 0.5s ease"></div>
          </div>
        </div>

        <!-- ── Competency chip grid ── -->
        <div class="section-title fade-in" style="margin-bottom:10px">역량 선택</div>
        <div id="iv-chip-grid" class="fade-in"
             style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px"
             role="group" aria-label="인터뷰 역량 목록">
          ${comps.map(c => renderChip(c)).join('')}
        </div>

        <!-- ── Batch evaluation button (shown when all recorded) ── -->
        <div id="iv-batch-wrap" style="display:none;margin-bottom:20px">
          <div style="font-size:0.8rem;color:var(--text-muted);text-align:center;margin-bottom:10px">
            모든 역량 답변이 저장되었습니다
          </div>
          <button class="btn btn-primary btn-block btn-lg" id="iv-batch-btn">
            🤖 AI 일괄 평가 시작
          </button>
        </div>

        <!-- ── Interview panel (hidden until selection) ── -->
        <div id="iv-panel" style="display:none">

          <!-- Selected competency header -->
          <div id="iv-comp-header" class="card fade-in"
               style="margin-bottom:16px;padding:16px;
                      background:linear-gradient(135deg,var(--primary),#7C3AED)">
            <div style="display:flex;align-items:center;
                        justify-content:space-between;margin-bottom:6px">
              <div id="iv-comp-name"
                   style="font-size:1rem;font-weight:700;color:#fff"></div>
              <span id="iv-comp-level" class="badge" style="font-size:0.8rem"></span>
            </div>
            <div id="iv-comp-desc"
                 style="font-size:0.78rem;color:rgba(255,255,255,0.75)">
              이 역량에 대한 심층 인터뷰를 진행합니다
            </div>
          </div>

          <!-- Question display -->
          <div id="iv-question-card" class="card fade-in"
               style="margin-bottom:16px;padding:16px;
                      border-left:4px solid var(--primary)">
            <div style="font-size:0.75rem;font-weight:600;
                        color:var(--primary);margin-bottom:8px;
                        text-transform:uppercase;letter-spacing:0.05em">
              인터뷰 질문
            </div>
            <div id="iv-question-text"
                 style="font-size:0.95rem;color:var(--text);
                        line-height:1.7;min-height:48px">
              <div class="skeleton skeleton-text" style="margin-bottom:6px"></div>
              <div class="skeleton skeleton-text short"></div>
            </div>
          </div>

          <!-- STT / Recording UI -->
          <div id="iv-recording-wrapper" class="card fade-in"
               style="margin-bottom:16px;padding:0;overflow:hidden">
            <div id="iv-interview-ui-mount"></div>
          </div>

          <!-- Submit button (controlled by InterviewUI, exposed here for styling) -->
          <button class="btn btn-primary btn-block" id="iv-evaluate-btn"
                  style="margin-bottom:16px;display:none"
                  disabled>
            💾 답변 저장
          </button>

          <!-- Evaluation result panel -->
          <div id="iv-result-panel" style="display:none">

            <div class="section-title" style="margin-bottom:12px">평가 결과</div>

            <!-- Score bars -->
            <div class="card fade-in" style="margin-bottom:16px;padding:16px">
              <div class="card-title" style="margin-bottom:12px">역량 점수 분석</div>
              <div id="iv-score-bars"></div>

              <!-- Total score -->
              <div id="iv-total-score"
                   style="display:flex;align-items:center;gap:10px;
                          margin-top:16px;padding-top:16px;
                          border-top:1px solid var(--border)">
                <div style="font-size:0.85rem;color:var(--text-muted);flex:1">
                  종합 점수
                </div>
                <div id="iv-total-value"
                     style="font-size:1.6rem;font-weight:800;color:var(--primary)">
                  –
                </div>
              </div>
            </div>

            <!-- Feedback text -->
            <div class="card fade-in" style="margin-bottom:16px;padding:16px">
              <div class="card-title" style="margin-bottom:10px">AI 피드백</div>
              <div id="iv-feedback-text"
                   style="font-size:0.9rem;color:var(--text);
                          line-height:1.75;white-space:pre-wrap"></div>
            </div>

            <!-- Strengths / Improvements -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
              <div class="card fade-in" style="padding:14px">
                <div style="font-size:0.8rem;font-weight:700;
                            color:#10B981;margin-bottom:8px">강점</div>
                <ul id="iv-strengths"
                    style="margin:0;padding-left:16px;
                           font-size:0.82rem;color:var(--text);
                           line-height:1.6;list-style:disc"></ul>
              </div>
              <div class="card fade-in" style="padding:14px">
                <div style="font-size:0.8rem;font-weight:700;
                            color:#F59E0B;margin-bottom:8px">개선 포인트</div>
                <ul id="iv-improvements"
                    style="margin:0;padding-left:16px;
                           font-size:0.82rem;color:var(--text);
                           line-height:1.6;list-style:disc"></ul>
              </div>
            </div>

            <!-- Navigation buttons -->
            <div id="iv-nav-buttons"
                 style="display:flex;flex-direction:column;gap:12px">
              <button class="btn btn-primary btn-block" id="iv-next-btn"
                      style="display:none">
                다음 역량 인터뷰 →
              </button>
              <button class="btn btn-success btn-block" id="iv-idp-btn"
                      style="display:none">
                IDP 보기
              </button>
              <button class="btn btn-ghost btn-sm" id="iv-retry-btn">
                다시 녹음하기
              </button>
            </div>

          </div><!-- /iv-result-panel -->

        </div><!-- /iv-panel -->

        <!-- ── Empty state when no L2+ comps ── -->
        ${_state.competencies.length === 0 ? `
          <div class="empty-state" style="padding:40px 0">
            <div class="empty-state-icon">🎯</div>
            <div class="empty-state-title">인터뷰 대상 역량이 없습니다</div>
            <div class="empty-state-desc">
              L2 이상의 역량이 있어야 AI 인터뷰를 진행할 수 있습니다.
            </div>
            <button class="btn btn-primary btn-sm"
                    onclick="window.location.hash='#/results'">
              결과 보기
            </button>
          </div>` : ''}

      </div><!-- /page-content -->
    </div><!-- /page -->
  `;

  bindEvents(root);
}

// ── Competency chip HTML ───────────────────────────────────────

function renderChip(comp) {
  const level      = comp.level || determineLevel(comp.as_is_score || 0);
  const isDone     = _state.completed.has(comp.competency_id);
  const isRecorded = !!_state.recordings[comp.competency_id];
  const isActive   = _state.selected?.competency_id === comp.competency_id;

  const chipBase = `
    border-radius:999px;padding:8px 16px;font-size:0.85rem;
    font-weight:500;cursor:pointer;border:none;
    transition:background 0.2s,transform 0.15s,box-shadow 0.15s;
    -webkit-tap-highlight-color:transparent;
    display:inline-flex;align-items:center;gap:6px;
    font-family:var(--font-ko);
  `;

  let chipStyle;
  if (isActive) {
    chipStyle = chipBase + 'background:var(--primary);color:#fff;box-shadow:0 2px 8px rgba(79,70,229,0.35);';
  } else if (isDone) {
    chipStyle = chipBase + 'background:#ECFDF5;color:#059669;border:1.5px solid #10B981;';
  } else if (isRecorded) {
    chipStyle = chipBase + 'background:#FFFBEB;color:#92400E;border:1.5px solid #F59E0B;';
  } else {
    chipStyle = chipBase + 'background:var(--bg);color:var(--text);border:1.5px solid var(--border);';
  }

  const prefix = isDone ? '✓ ' : isRecorded ? '💾 ' : '';

  return `
    <button class="iv-comp-chip"
            data-comp-id="${escapeHtml(comp.competency_id)}"
            style="${chipStyle}"
            aria-pressed="${isActive}"
            aria-label="${escapeHtml(comp.competency_name_ko)} ${level}">
      ${prefix}${escapeHtml(comp.competency_name_ko)}
      <span style="font-size:0.72rem;opacity:0.8">${escapeHtml(level)}</span>
    </button>
  `;
}

// ── Skeleton ───────────────────────────────────────────────────

function renderSkeleton(root) {
  root.innerHTML = `
    <div class="page">
      <div class="top-bar">
        <button class="btn btn-ghost btn-sm" style="min-height:40px">← 뒤로</button>
        <div class="top-bar-title">AI 역량 인터뷰</div>
        <div style="width:60px"></div>
      </div>
      <div class="page-content">
        <div class="skeleton" style="height:24px;width:50%;margin-bottom:20px;border-radius:4px"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px">
          ${Array(3).fill(0).map(() =>
            `<div class="skeleton" style="height:38px;width:100px;border-radius:999px"></div>`
          ).join('')}
        </div>
        <div class="skeleton skeleton-card" style="height:200px"></div>
      </div>
    </div>`;
}

// ── Event binding ──────────────────────────────────────────────

function bindEvents(root) {
  root.querySelector('#iv-back-btn')?.addEventListener('click', () => {
    history.length > 1 ? window.navBack() : navigate('#/results');
  });

  root.querySelectorAll('.iv-comp-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const comp = _state.competencies.find(c => c.competency_id === chip.dataset.compId);
      if (comp) selectCompetency(root, comp);
    });
  });

  root.querySelector('#iv-batch-btn')?.addEventListener('click', () => {
    startBatchEvaluation(root);
  });

  // Restore batch button if all already recorded
  const allRecorded = _state.competencies.length > 0 &&
    _state.competencies.every(c => _state.recordings[c.competency_id]);
  const batchWrap = root.querySelector('#iv-batch-wrap');
  if (batchWrap && allRecorded) {
    batchWrap.style.display = 'block';
    const btn = root.querySelector('#iv-batch-btn');
    if (btn) btn.textContent = `🤖 AI 일괄 평가 시작 (${_state.competencies.length}개 답변)`;
  }
}

// ── Select competency → start interview ───────────────────────

async function selectCompetency(root, comp) {
  // Guard: don't restart if already on this competency mid-evaluation
  if (_state.phase === 'evaluating') return;

  _state.selected   = comp;
  _state.phase      = 'recording';
  _state.sessionId  = null;
  _state.questionKo = null;

  // Refresh chip styles
  refreshChips(root);

  // Show panel
  const panel = root.querySelector('#iv-panel');
  if (panel) panel.style.display = 'block';

  // Update comp header
  const level = comp.level || determineLevel(comp.as_is_score || 0);
  const nameEl  = root.querySelector('#iv-comp-name');
  const levelEl = root.querySelector('#iv-comp-level');
  if (nameEl)  nameEl.textContent = comp.competency_name_ko;
  if (levelEl) {
    levelEl.textContent  = level;
    levelEl.className    = `badge ${levelBadgeClass(level)}`;
  }

  // Hide result panel, reset evaluate button
  const resultPanel = root.querySelector('#iv-result-panel');
  const evalBtn     = root.querySelector('#iv-evaluate-btn');
  if (resultPanel) resultPanel.style.display = 'none';
  if (evalBtn)     { evalBtn.style.display = 'none'; evalBtn.disabled = true; }

  // Reset InterviewUI
  if (_interviewUI) {
    _interviewUI.destroy();
    _interviewUI = null;
  }

  // Show question loading state
  const questionEl = root.querySelector('#iv-question-text');
  if (questionEl) {
    questionEl.innerHTML = `
      <div class="skeleton skeleton-text" style="margin-bottom:6px"></div>
      <div class="skeleton skeleton-text short"></div>`;
  }

  // Fetch question + session_id from API
  let question = comp.interview_question || null;
  let sessionId = null;

  const _isDemo = localStorage.getItem('hr_token') === 'demo-token';
  if (!_isDemo) {
    try {
      const startCall = api.interview.start({
        competency_id: comp.competency_id,
        level,
        instance_id: window.appState?.instanceId || null,
      });
      const timeout = new Promise(resolve => setTimeout(() => resolve(null), 6000));
      const resp = await Promise.race([startCall, timeout]);
      if (resp) {
        sessionId = resp.session_id || null;
        question  = resp.question_ko  || resp.question || question;
      }
    } catch (err) {
      console.warn('[Interview] /start API error, using fallback question:', err);
    }
  }

  // If still no question, use built-in fallback
  if (!question) {
    question = buildFallbackQuestion(comp, level);
  }

  _state.sessionId  = sessionId;
  _state.questionKo = question;

  // Display question
  if (questionEl) questionEl.textContent = question;

  // Mount InterviewUI in its container
  const uiMount = root.querySelector('#iv-interview-ui-mount');
  if (uiMount) {
    _interviewUI = new InterviewUI(uiMount, {
      maxDuration: 180,
      onComplete: (transcript, duration) => {
        handleTranscriptReady(root, transcript, duration);
      },
    });
    _interviewUI.setQuestion(question);

    // Wire submit button label and state to transcript length
    // InterviewUI has its own submit; we add our "AI 평가 요청" button above
    // Override the internal submit to call our evaluate flow instead
    const internalSubmit = uiMount.querySelector('#iu-submit');
    if (internalSubmit) {
      internalSubmit.textContent = '💾 답변 저장';
      // The onComplete callback already handles submission
    }
  }

  // Scroll to panel smoothly
  panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Build fallback question ────────────────────────────────────

function buildFallbackQuestion(comp, level) {
  const name = comp.competency_name_ko || '해당 역량';
  const levelDesc = {
    L2: `${name} 역량을 실제 업무에 적용한 경험을 구체적으로 설명해 주세요. 어떤 상황(맥락)에서, 어떤 행동을 취했으며, 어떤 결과를 얻었나요? 과정에서 마주한 리스크와 이를 어떻게 관리했는지도 포함해 주세요.`,
    L3: `${name} 역량에서 조직 전체에 영향을 미친 주도적 사례를 설명해 주세요. 전략적 판단, 리더십 발휘, 리스크 관리 관점에서 구체적으로 말씀해 주세요.`,
  };
  return levelDesc[level] || levelDesc.L2;
}

// ── Handle transcript ready → evaluate ────────────────────────

// ── Handle transcript ready → SAVE (no immediate eval) ────────
async function handleTranscriptReady(root, transcript, duration) {
  if (!transcript || transcript.trim().length < 20) {
    showToast('답변이 너무 짧습니다. 더 자세히 말씀해 주세요.', 'warning');
    return;
  }

  const compId = _state.selected?.competency_id;
  if (!compId) return;

  // Save recording to memory + localStorage (carry session_id for later evaluate)
  _state.recordings[compId] = {
    transcript,
    duration,
    saved_at: Date.now(),
    session_id: _state.sessionId || null,
    question_ko: _state.questionKo || null,
  };
  _saveRecordings();

  _state.phase = 'saved';

  // Show saved confirmation in the recording wrapper
  const wrapper = root.querySelector('#iv-recording-wrapper');
  if (wrapper) {
    wrapper.innerHTML = `
      <div style="padding:20px 16px;display:flex;align-items:center;gap:10px;
                  color:#059669;font-size:0.9rem;font-weight:500">
        💾 답변이 저장되었습니다 — 다음 역량을 선택하세요
      </div>`;
  }

  // Hide result panel (previous competency's result)
  const resultPanel = root.querySelector('#iv-result-panel');
  if (resultPanel) resultPanel.style.display = 'none';

  refreshChips(root);
  updateProgress(root);

  // Check if all competencies have been recorded
  const allRecorded = _state.competencies.length > 0 &&
    _state.competencies.every(c => _state.recordings[c.competency_id]);

  const batchWrap = root.querySelector('#iv-batch-wrap');
  if (batchWrap) {
    batchWrap.style.display = allRecorded ? 'block' : 'none';
    if (allRecorded) {
      const btn = root.querySelector('#iv-batch-btn');
      if (btn) btn.textContent = `🤖 AI 일괄 평가 시작 (${_state.competencies.length}개 답변)`;
      batchWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // Auto-advance to next unrecorded competency
  if (!allRecorded) {
    const next = _state.competencies.find(c => !_state.recordings[c.competency_id]);
    if (next) {
      setTimeout(() => selectCompetency(root, next), 400);
    }
  }
}

// ── Demo eval result fallback ──────────────────────────────────

function buildDemoEvalResult(transcript) {
  // Rough heuristic scores based on transcript length
  const len = transcript.trim().split(/\s+/).length;
  const base = Math.min(Math.max(len / 30, 0.3), 1.0);

  return {
    context_score: Math.round(base * 75 + Math.random() * 10),
    action_score:  Math.round(base * 80 + Math.random() * 10),
    risk_score:    Math.round(base * 65 + Math.random() * 15),
    total_score:   Math.round(base * 73 + Math.random() * 12),
    feedback_ko:   '답변에서 구체적인 상황 설명이 잘 나타났습니다. 행동의 구체성 측면에서 실제 수치나 타임라인을 포함하면 더욱 설득력 있는 답변이 될 것입니다. 리스크 인식과 관리 방안을 보다 구체적으로 언급하면 종합 점수가 향상될 수 있습니다.',
    strengths_ko:  ['상황 맥락을 논리적으로 설명함', '자신의 역할과 행동이 명확히 드러남'],
    improvements_ko: ['리스크 관리 방안 구체화 필요', '성과 측정 지표(수치) 보완 권장'],
  };
}

// ── Render evaluation result ───────────────────────────────────

function renderEvalResult(root, result) {
  const {
    context_score,
    action_score,
    risk_score,
    total_score,
    feedback_ko,
    strengths_ko    = [],
    improvements_ko = [],
  } = result;

  const resultPanel = root.querySelector('#iv-result-panel');
  if (!resultPanel) return;

  // Score bars
  const scoreBarsEl = root.querySelector('#iv-score-bars');
  if (scoreBarsEl) {
    scoreBarsEl.innerHTML = '';
    const bars = renderInterviewScoreBars({ context_score, action_score, risk_score });
    scoreBarsEl.appendChild(bars);
  }

  // Total score
  const totalEl = root.querySelector('#iv-total-value');
  if (totalEl && total_score != null) {
    totalEl.textContent = Number(total_score).toFixed(0);
    const pct = total_score / 100;
    totalEl.style.color = pct >= 0.75 ? 'var(--success)' : pct >= 0.5 ? 'var(--warning)' : 'var(--danger)';
  }

  // Feedback text
  const feedbackEl = root.querySelector('#iv-feedback-text');
  if (feedbackEl) feedbackEl.textContent = feedback_ko || '';

  // Strengths list
  const strengthsEl = root.querySelector('#iv-strengths');
  if (strengthsEl) {
    strengthsEl.innerHTML = strengths_ko.map(s => `<li>${escapeHtml(s)}</li>`).join('') ||
      '<li style="color:var(--text-light)">–</li>';
  }

  // Improvements list
  const improvementsEl = root.querySelector('#iv-improvements');
  if (improvementsEl) {
    improvementsEl.innerHTML = improvements_ko.map(s => `<li>${escapeHtml(s)}</li>`).join('') ||
      '<li style="color:var(--text-light)">–</li>';
  }

  // Show result panel
  resultPanel.style.display = 'block';

  // Navigation buttons
  const allDone   = _state.completed.size >= _state.competencies.length;
  const nextBtn   = root.querySelector('#iv-next-btn');
  const idpBtn    = root.querySelector('#iv-idp-btn');
  const retryBtn  = root.querySelector('#iv-retry-btn');

  if (allDone) {
    if (nextBtn) nextBtn.style.display = 'none';
    if (idpBtn)  idpBtn.style.display  = 'block';
  } else {
    if (nextBtn) nextBtn.style.display = 'block';
    if (idpBtn)  idpBtn.style.display  = 'none';
  }

  // Bind navigation buttons
  nextBtn?.addEventListener('click', () => {
    const remaining = _state.competencies.filter(
      c => !_state.completed.has(c.competency_id)
    );
    if (remaining.length > 0) {
      selectCompetency(root, remaining[0]);
      resultPanel.style.display = 'none';
    }
  }, { once: true });

  idpBtn?.addEventListener('click', () => {
    navigate('#/idp');
  }, { once: true });

  retryBtn?.addEventListener('click', () => {
    if (_state.selected) {
      // Remove from completed so the retry counts
      _state.completed.delete(_state.selected.competency_id);
      selectCompetency(root, _state.selected);
    }
  }, { once: true });

  // Scroll result into view
  resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Progress update ────────────────────────────────────────────

function updateProgress(root) {
  // Progress tracks recordings (not yet evaluations)
  const recordedCount = Object.keys(_state.recordings).length;
  const evalCount     = _state.completed.size;
  const total         = _state.competencies.length;
  const count         = evalCount > 0 ? evalCount : recordedCount;
  const pct           = total > 0 ? Math.round((count / total) * 100) : 0;

  const doneEl  = root.querySelector('#iv-done-count');
  const fillEl  = root.querySelector('#iv-progress-fill');

  if (doneEl) doneEl.textContent = String(count);
  if (fillEl) fillEl.style.width = `${pct}%`;
}

// ── Chip refresh ───────────────────────────────────────────────

function refreshChips(root) {
  root.querySelectorAll('.iv-comp-chip').forEach(chip => {
    const compId     = chip.dataset.compId;
    const isActive   = _state.selected?.competency_id === compId;
    const isDone     = _state.completed.has(compId);       // evaluated ✓
    const isRecorded = !!_state.recordings[compId];        // saved 💾

    const chipBase = `
      border-radius:999px;padding:8px 16px;font-size:0.85rem;
      font-weight:500;cursor:pointer;border:none;
      transition:background 0.2s,transform 0.15s,box-shadow 0.15s;
      -webkit-tap-highlight-color:transparent;
      display:inline-flex;align-items:center;gap:6px;
      font-family:var(--font-ko);
    `;

    const comp  = _state.competencies.find(c => c.competency_id === compId);
    const level = comp ? (comp.level || determineLevel(comp.as_is_score || 0)) : '';

    if (isActive) {
      chip.style.cssText = chipBase + 'background:var(--primary);color:#fff;box-shadow:0 2px 8px rgba(79,70,229,0.35);';
    } else if (isDone) {
      chip.style.cssText = chipBase + 'background:#ECFDF5;color:#059669;border:1.5px solid #10B981;';
    } else if (isRecorded) {
      chip.style.cssText = chipBase + 'background:#FFFBEB;color:#92400E;border:1.5px solid #F59E0B;';
    } else {
      chip.style.cssText = chipBase + 'background:var(--bg);color:var(--text);border:1.5px solid var(--border);';
    }

    chip.setAttribute('aria-pressed', isActive);

    const nameText = comp ? comp.competency_name_ko : compId;
    const prefix   = isDone ? '✓ ' : isRecorded ? '💾 ' : '';
    chip.innerHTML = `${prefix}${escapeHtml(nameText)}<span style="font-size:0.72rem;opacity:0.8">${escapeHtml(level)}</span>`;
  });
}

// ── Batch evaluation ───────────────────────────────────────────

async function startBatchEvaluation(root) {
  if (_state.phase === 'batch_eval') return;
  _state.phase = 'batch_eval';

  const btn = root.querySelector('#iv-batch-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> AI 평가 중...'; }

  // Hide interview panel while evaluating
  const panel = root.querySelector('#iv-panel');
  if (panel) panel.style.display = 'none';

  const isDemo = localStorage.getItem('hr_token') === 'demo-token';
  const comps  = _state.competencies;

  for (const comp of comps) {
    const rec = _state.recordings[comp.competency_id];
    if (!rec) continue;

    let result = null;
    if (!isDemo) {
      try {
        const apiCall = api.interview.evaluate({
          session_id:    rec.session_id || null,
          question_ko:   rec.question_ko || null,
          competency_id: comp.competency_id,
          level_code:    comp.level || 'L2',
          transcript:    rec.transcript,
          duration_seconds: rec.duration || 0,
        });
        const timeout = new Promise(r => setTimeout(() => r(null), 10000));
        result = await Promise.race([apiCall, timeout]);
      } catch (_) {}
    }
    if (!result) result = buildDemoEvalResult(rec.transcript);

    _state.evalResults[comp.competency_id] = result;
    _state.completed.add(comp.competency_id);
  }

  // Persist to Supabase (non-blocking; demo mode no-ops internally)
  const instanceId = window.appState?.instanceId || null;
  await api.interview.saveRecordings(instanceId, _state.recordings).catch(() => {});
  await api.interview.saveBatchResults(instanceId, _state.evalResults, _state.competencies).catch(() => {});

  // Clear saved recordings after successful evaluation
  _state.recordings = {};
  try { localStorage.removeItem(RECORDINGS_KEY); } catch (_) {}

  _state.phase = 'done';
  updateProgress(root);
  refreshChips(root);
  renderBatchResults(root);
}

function renderBatchResults(root) {
  const batchWrap = root.querySelector('#iv-batch-wrap');
  if (batchWrap) batchWrap.style.display = 'none';

  const content = root.querySelector('.page-content');
  if (!content) return;

  const rows = _state.competencies.map(comp => {
    const r = _state.evalResults[comp.competency_id];
    if (!r) return '';
    const total = Number(r.total_score || 0);
    const color = total >= 75 ? 'var(--success)' : total >= 50 ? 'var(--warning)' : 'var(--danger)';
    return `
      <div class="card fade-in" style="margin-bottom:12px;padding:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div style="font-weight:600;font-size:0.95rem">${escapeHtml(comp.competency_name_ko)}</div>
          <div style="font-size:1.5rem;font-weight:800;color:${color}">${total}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
          <span style="padding:3px 10px;border-radius:999px;font-size:0.76rem;background:#EEF2FF;color:#4F46E5">
            맥락 ${Number(r.context_score||0).toFixed(0)}
          </span>
          <span style="padding:3px 10px;border-radius:999px;font-size:0.76rem;background:#ECFDF5;color:#059669">
            실행 ${Number(r.action_score||0).toFixed(0)}
          </span>
          <span style="padding:3px 10px;border-radius:999px;font-size:0.76rem;background:#FFFBEB;color:#92400E">
            리스크 ${Number(r.risk_score||0).toFixed(0)}
          </span>
        </div>
        <div style="font-size:0.83rem;color:var(--text-muted);line-height:1.65">
          ${escapeHtml(r.feedback_ko || '')}
        </div>
        ${r.strengths_ko?.length ? `
          <div style="margin-top:8px;font-size:0.8rem">
            <span style="color:#059669;font-weight:600">강점:</span>
            ${r.strengths_ko.map(s => escapeHtml(s)).join(' · ')}
          </div>` : ''}
        ${r.improvements_ko?.length ? `
          <div style="margin-top:4px;font-size:0.8rem">
            <span style="color:#D97706;font-weight:600">개선 포인트:</span>
            ${r.improvements_ko.map(s => escapeHtml(s)).join(' · ')}
          </div>` : ''}
        ${r.level_adequate != null ? `
          <div style="margin-top:6px;font-size:0.75rem;padding:3px 8px;display:inline-block;
               border-radius:999px;${r.level_adequate ? 'background:#ECFDF5;color:#065F46' : 'background:#FEF2F2;color:#7F1D1D'}">
            ${r.level_adequate ? '✅ 현재 레벨 충족' : '⚠️ 레벨 도달 미충족'}
          </div>` : ''}
      </div>`;
  }).join('');

  const avgScore = (() => {
    const vals = _state.competencies
      .map(c => _state.evalResults[c.competency_id]?.total_score)
      .filter(v => v != null);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '--';
  })();

  content.innerHTML = `
    <div class="top-bar" style="margin:0 -16px 20px;padding:0 16px">
      <button class="btn btn-ghost btn-sm" onclick="window.navBack()" style="min-height:40px">← 뒤로</button>
      <div class="top-bar-title">AI 인터뷰 평가 완료</div>
      <div style="width:60px"></div>
    </div>

    <div class="card fade-in" style="margin-bottom:20px;padding:16px;
         background:linear-gradient(135deg,var(--primary),#7C3AED);color:#fff">
      <div style="font-size:0.8rem;opacity:0.85;margin-bottom:4px">종합 평균 점수</div>
      <div style="font-size:2.2rem;font-weight:800">${avgScore}</div>
      <div style="font-size:0.8rem;opacity:0.75;margin-top:4px">
        ${_state.competencies.length}개 역량 평가 완료
      </div>
    </div>

    <div class="section-title" style="margin-bottom:12px">역량별 상세 결과</div>
    ${rows}

    <div style="display:flex;flex-direction:column;gap:10px;margin-top:20px">
      <button class="btn btn-primary btn-block btn-lg" id="br-idp-btn">
        🎯 IDP 성장 계획 보기
      </button>
      <button class="btn btn-ghost btn-block" id="br-results-btn">
        📈 역량 진단 결과 보기
      </button>
    </div>
  `;

  content.querySelector('#br-idp-btn')?.addEventListener('click', () => navigate('#/idp'));
  content.querySelector('#br-results-btn')?.addEventListener('click', () => navigate('#/results'));
}

// ── Helpers ───────────────────────────────────────────────────

function levelBadgeClass(level) {
  switch (level) {
    case 'L3': return 'badge-success';
    case 'L2': return 'badge-primary';
    case 'L1': return 'badge-warning';
    default:   return 'badge-secondary';
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
