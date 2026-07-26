/**
 * reviews.js – 성과 리뷰 사이클 + 1:1 미팅 기록
 * Phase 4B: Performance Management
 */

import {getUser, isAdmin, isApplicant } from '../auth.js';
import { api } from '../api.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
const TODAY = new Date().toISOString().slice(0,10);

function _session() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}'); } catch { return {}; } }

const _isDemo = () => localStorage.getItem('hr_token') === 'demo-token';

let _root = null;
let _activeTab = 'review';
let _pendingMeetingPrefill = null;
let _skipRender = false;
let _reviewerType = 'self'; // 'self' | 'manager' | 'peer'

const LS_REVIEWS = 'hr_perf_reviews';
const LS_ONEONS  = 'hr_one_on_ones';

// ── Helpers ────────────────────────────────────────────────────

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function genId() {
  return 'ID_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function openModal(el) {
  if (!el) return;
  el.style.display = 'flex';
  requestAnimationFrame(() => el.classList.add('visible'));
}

function closeModal(el) {
  if (!el) return;
  el.classList.remove('visible');
  el.addEventListener('transitionend', () => { el.style.display = 'none'; }, { once: true });
}

function getReviews() {
  try { return JSON.parse(localStorage.getItem(LS_REVIEWS) || '[]'); } catch { return []; }
}

function saveReviews(reviews) {
  localStorage.setItem(LS_REVIEWS, JSON.stringify(reviews));
}

function getOneOnOnes() {
  try { return JSON.parse(localStorage.getItem(LS_ONEONS) || '[]'); } catch { return []; }
}

function saveOneOnOnes(items) {
  localStorage.setItem(LS_ONEONS, JSON.stringify(items));
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

const _YEAR = new Date().getFullYear();
const REVIEW_CYCLE_LABEL = { H1: `${_YEAR} 상반기 리뷰`, H2: `${_YEAR} 하반기 리뷰`, ANNUAL: `${_YEAR} 연간 리뷰` };

const SCORE_LABELS = { 5: '탁월', 4: '우수', 3: '보통', 2: '미흡', 1: '부족' };
const SCORE_COLORS = { 5: '#10B981', 4: '#3B82F6', 3: '#F59E0B', 2: '#F97316', 1: '#EF4444' };

// Demo seed
function seedDemoData(userId) {
  const reviews = getReviews();
  if (reviews.length === 0) {
    saveReviews([
      {
        id: 'REV_DEMO_1',
        userId,
        cycle: 'H1',
        goalAchievement: 4,
        competencyScore: 3,
        keyAchievements: '역량 진단 응답률 75% 달성\n신규 진단Kit 3종 도입 완료',
        nextGoals: '하반기 채용 효율화 프로젝트 착수',
        managerComment: '전반적으로 우수한 성과를 보여주었습니다. 데이터 기반 의사결정 역량을 더 발전시켜 주세요.',
        selfComment: '상반기 목표의 80% 이상 달성. 하반기엔 팀 협업 역량을 강화할 계획입니다.',
        status: 'COMPLETED',
        submittedAt: '2025-06-30T18:00:00Z',
      },
    ]);
  }

  const meetings = getOneOnOnes();
  if (meetings.length === 0) {
    saveOneOnOnes([
      {
        id: 'ONO_DEMO_1',
        userId,
        managerName: '박지성 팀장',
        meetingDate: '2025-05-20',
        agenda: '역량 진단 프로젝트 중간 점검\n하반기 목표 조율\n커리어 개발 방향 논의',
        actionItems: [
          { id: 'AI_1', text: '역량 진단 응답률 개선 방안 보고서 작성', done: true },
          { id: 'AI_2', text: '하반기 채용 일정 조율 완료', done: false },
          { id: 'AI_3', text: 'L&D 매니저 인터뷰 일정 확인', done: false },
        ],
        note: '팀장님 피드백: 분석 역량은 우수하나, 이해관계자 커뮤니케이션 부분 보완 필요.',
        createdAt: '2025-05-20T14:00:00Z',
      },
      {
        id: 'ONO_DEMO_2',
        userId,
        managerName: '박지성 팀장',
        meetingDate: '2025-04-15',
        agenda: '상반기 OKR 점검\n개인 성장 계획 논의',
        actionItems: [
          { id: 'AI_1', text: 'OKR 체크인 주기 주간으로 변경', done: true },
          { id: 'AI_2', text: 'HRBP 역량 관련 외부 교육 신청', done: true },
        ],
        note: '',
        createdAt: '2025-04-15T14:00:00Z',
      },
    ]);
  }
}

// ── Mount / Unmount ────────────────────────────────────────────

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
  _activeTab = 'review';
  const user = getUser();
  if (_isDemo()) seedDemoData(user?.id || 'demo');

  const managerCtx = window.appState?.managerViewEmployee || null;
  if (managerCtx) {
    delete window.appState.managerViewEmployee;
    _activeTab = 'meeting';
    _pendingMeetingPrefill = managerCtx;
  }

  _skipRender = !_isDemo() && !getReviews().filter(r => r.userId === (user?.id || 'demo')).length;
  render();
  _syncFromApi(user?.id);

  if (managerCtx && _root) {
    // Auto-open meeting modal pre-filled for the employee
    const meetingBtn = _root.querySelector('#new-meeting-btn');
    if (meetingBtn) meetingBtn.click();
    const managerInput = _root.querySelector('#meeting-manager');
    if (managerInput) managerInput.value = managerCtx;
  }
}

export function unmount() {
  _root = null;
}

async function _syncFromApi(userId) {
  if (!userId || userId === 'demo') return;
  try {
    const [reviews, meetings] = await Promise.all([
      api.performance?.getReviews?.(userId).catch(() => null),
      api.performance?.getMeetings?.(userId).catch(() => null),
    ]);
    if (Array.isArray(reviews) && reviews.length) saveReviews(reviews);
    if (Array.isArray(meetings) && meetings.length) saveOneOnOnes(meetings);
  } catch { /* keep localStorage */ } finally {
    if (_root) {
      renderTab(_activeTab);
      _syncTabVisual(_activeTab);
    }
  }
}

// ── Render ─────────────────────────────────────────────────────

function render() {
  if (!_root) return;

  _root.innerHTML = `
    <div class="page" style="background:var(--bg);height:100vh;overflow:hidden;display:flex;flex-direction:column">
      <div class="top-bar">
        <button class="btn btn-ghost btn-sm" onclick="window.navBack()" style="padding:8px">←</button>
        <div class="top-bar-title">성과 리뷰</div>
        <div style="width:60px"></div>
      </div>

      <!-- Tabs -->
      <div style="display:flex;border-bottom:1.5px solid var(--border);background:var(--surface);
                  flex-shrink:0;z-index:10">
        <button class="review-tab active" data-tab="review"
          style="flex:1;padding:12px;border:none;background:none;font-size:0.85rem;
                 font-weight:600;cursor:pointer;color:var(--primary);
                 border-bottom:2.5px solid var(--primary)">
          📋 성과 리뷰
        </button>
        <button class="review-tab" data-tab="meeting"
          style="flex:1;padding:12px;border:none;background:none;font-size:0.85rem;
                 font-weight:600;cursor:pointer;color:var(--text-muted);
                 border-bottom:2.5px solid transparent">
          🤝 1:1 미팅
        </button>
      </div>

      <!-- Tab content -->
      <div class="page-content" id="review-tab-content" style="flex:1;overflow-y:auto"></div>
    </div>

    <!-- Review Form Modal -->
    <div id="review-modal" class="modal-overlay" style="display:none">
      <div class="modal-sheet" style="max-height:90vh;overflow-y:auto">
        <div class="modal-handle"></div>
        <div style="padding:16px 20px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div style="font-weight:700;font-size:1rem" id="review-modal-title">성과 리뷰 작성</div>
            <span id="review-type-badge" style="font-size:0.72rem;padding:3px 10px;border-radius:99px;font-weight:700;background:#EEF2FF;color:#4F46E5;">본인 자기평가</span>
          </div>
          <!-- 리뷰어 유형 선택 -->
          <div style="display:flex;gap:6px;margin-bottom:16px">
            ${[['self','본인 자기평가'],['manager','상사 리뷰'],['peer','동료 평가']].map(([v,l]) => `
              <button class="review-type-btn" data-rtype="${v}"
                style="flex:1;padding:7px 4px;border-radius:8px;font-size:0.72rem;font-weight:600;
                       cursor:pointer;border:1.5px solid ${v==='self'?'var(--primary)':'var(--border)'};
                       background:${v==='self'?'#EEF2FF':'var(--surface)'};
                       color:${v==='self'?'var(--primary)':'var(--text-muted)'};
                       transition:all 0.15s;">${l}</button>`).join('')}
          </div>

          <div class="form-group">
            <label class="form-label">리뷰 사이클</label>
            <select id="review-cycle" class="form-control">
              ${Object.entries(REVIEW_CYCLE_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
            </select>
          </div>

          <div class="form-group" style="margin-top:12px">
            <label class="form-label">목표 달성도</label>
            <div style="display:flex;gap:8px" id="goal-score-btns">
              ${[5,4,3,2,1].map(s => `
                <button class="score-btn" data-score="${s}" data-type="goal"
                  style="flex:1;padding:8px 4px;border-radius:var(--radius-sm);
                         border:1.5px solid var(--border);font-size:0.75rem;cursor:pointer;
                         background:var(--surface);color:var(--text-muted)">
                  ${s}<br><span style="font-size:0.65rem">${SCORE_LABELS[s]}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="form-group" style="margin-top:12px">
            <label class="form-label">역량 발휘도</label>
            <div style="display:flex;gap:8px" id="comp-score-btns">
              ${[5,4,3,2,1].map(s => `
                <button class="score-btn" data-score="${s}" data-type="comp"
                  style="flex:1;padding:8px 4px;border-radius:var(--radius-sm);
                         border:1.5px solid var(--border);font-size:0.75rem;cursor:pointer;
                         background:var(--surface);color:var(--text-muted)">
                  ${s}<br><span style="font-size:0.65rem">${SCORE_LABELS[s]}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="form-group" style="margin-top:12px">
            <label class="form-label">핵심 성과</label>
            <textarea maxlength="500" id="review-achievements" class="form-control" rows="3"
              placeholder="이번 기간 주요 성과를 기입하세요" style="resize:none"></textarea>
          </div>

          <div class="form-group" style="margin-top:12px">
            <label class="form-label">다음 기간 목표</label>
            <textarea maxlength="500" id="review-next-goals" class="form-control" rows="2"
              placeholder="다음 기간에 달성할 목표를 기입하세요" style="resize:none"></textarea>
          </div>

          <div class="form-group" style="margin-top:12px">
            <label class="form-label">자기 평가</label>
            <textarea maxlength="500" id="review-self-comment" class="form-control" rows="2"
              placeholder="자신의 성과에 대한 의견을 작성하세요" style="resize:none"></textarea>
          </div>

          <div style="display:flex;gap:8px;margin-top:20px">
            <button class="btn btn-outline btn-block" id="review-cancel-btn">취소</button>
            <button class="btn btn-primary btn-block" id="review-save-btn">제출</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Meeting Form Modal -->
    <div id="meeting-modal" class="modal-overlay" style="display:none">
      <div class="modal-sheet" style="max-height:90vh;overflow-y:auto">
        <div class="modal-handle"></div>
        <div style="padding:16px 20px">
          <div style="font-weight:700;font-size:1rem;margin-bottom:16px">1:1 미팅 기록</div>

          <div class="form-group">
            <label class="form-label">미팅 날짜</label>
            <input type="date" id="meeting-date" class="form-control" min="${TODAY}">
          </div>

          <div class="form-group" style="margin-top:12px">
            <label class="form-label">상대방 (관리자/동료)</label>
            <input type="text" id="meeting-manager" class="form-control"
              placeholder="예: 박지성 팀장">
          </div>

          <div class="form-group" style="margin-top:12px">
            <label class="form-label">주요 의제</label>
            <textarea maxlength="500" id="meeting-agenda" class="form-control" rows="3"
              placeholder="미팅 주요 의제를 작성하세요" style="resize:none"></textarea>
          </div>

          <div class="form-group" style="margin-top:12px">
            <label class="form-label">액션 아이템</label>
            <div id="action-items-list"></div>
            <button id="add-action-btn" class="btn btn-ghost btn-sm"
              style="margin-top:8px;font-size:0.8rem;color:var(--primary)">
              + 아이템 추가
            </button>
          </div>

          <div class="form-group" style="margin-top:12px">
            <label class="form-label">메모 (선택)</label>
            <textarea maxlength="500" id="meeting-note" class="form-control" rows="2"
              placeholder="미팅 메모 또는 특이사항" style="resize:none"></textarea>
          </div>

          <div style="display:flex;gap:8px;margin-top:20px">
            <button class="btn btn-outline btn-block" id="meeting-cancel-btn">취소</button>
            <button class="btn btn-primary btn-block" id="meeting-save-btn">저장</button>
          </div>
        </div>
      </div>
    </div>`;

  bindEvents();
  _syncTabVisual(_activeTab);
  if (_skipRender) {
    const content = _root.querySelector('#review-tab-content');
    if (content) content.innerHTML = [1, 2].map(() =>
      '<div class="skeleton" style="height:90px;border-radius:12px;margin:16px 0"></div>'
    ).join('');
    _skipRender = false;
  } else {
    renderTab(_activeTab);
  }
}

// ── Tab renderer ───────────────────────────────────────────────

function renderTab(tab) {
  if (!_root) return;
  const content = _root.querySelector('#review-tab-content');

  if (tab === 'review') {
    renderReviewTab(content);
  } else {
    renderMeetingTab(content);
  }
}

function renderReviewTab(content) {
  const user = getUser();
  const reviews = getReviews().filter(r => r.userId === (user?.id || 'demo'));

  // Stats strip
  let statsHtml = '';
  if (reviews.length > 0) {
    const SCORE_WEIGHT = { '5-Outstanding': 5, '4-Exceeds': 4, '3-Meets': 3, '2-Below': 2, '1-Unsatisfactory': 1, 5: 5, 4: 4, 3: 3, 2: 2, 1: 1 };
    const goScores = reviews.filter(r => r.goalAchievement).map(r => SCORE_WEIGHT[r.goalAchievement] || Number(r.goalAchievement) || 0);
    const coScores = reviews.filter(r => r.competencyScore || r.competencyDemo).map(r => SCORE_WEIGHT[r.competencyScore || r.competencyDemo] || Number(r.competencyScore || r.competencyDemo) || 0);
    const avgGo  = goScores.length ? (goScores.reduce((s, v) => s + v, 0) / goScores.length).toFixed(1) : '-';
    const avgCo  = coScores.length ? (coScores.reduce((s, v) => s + v, 0) / coScores.length).toFixed(1) : '-';
    const withComment = reviews.filter(r => r.managerComment).length;
    statsHtml = `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:12px 0">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:10px;text-align:center">
          <div style="font-size:1.2rem;font-weight:800;color:var(--primary)">${reviews.length}</div>
          <div style="font-size:0.68rem;color:var(--text-muted)">총 리뷰</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:10px;text-align:center">
          <div style="font-size:1.2rem;font-weight:800;color:var(--success)">${avgGo}</div>
          <div style="font-size:0.68rem;color:var(--text-muted)">목표 달성 avg</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:10px;text-align:center">
          <div style="font-size:1.2rem;font-weight:800;color:var(--warning)">${withComment}/${reviews.length}</div>
          <div style="font-size:0.68rem;color:var(--text-muted)">관리자 코멘트</div>
        </div>
      </div>`;
  }

  const headerHtml = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 0 8px">
      <div style="font-weight:700;font-size:0.95rem">성과 리뷰 이력</div>
      <button class="btn btn-primary btn-sm" id="new-review-btn" style="font-size:0.75rem">
        + 새 리뷰
      </button>
    </div>
    ${statsHtml}`;

  if (!reviews.length) {
    content.innerHTML = headerHtml + `
      <div class="empty-state" style="min-height:200px">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-title">성과 리뷰가 없습니다</div>
        <div class="empty-state-desc">+ 새 리뷰 버튼으로 성과를 기록해 보세요.</div>
      </div>`;
  } else {
    const cardsHtml = reviews.map(r => {
      const gScore = r.goalAchievement;
      const cScore = r.competencyScore || r.competencyDemo;
      return `
        <div class="card" style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <div style="font-weight:700;font-size:0.9rem">${esc(REVIEW_CYCLE_LABEL[r.cycle] || r.cycle)}</div>
                ${(() => {
                  const t = r.reviewerType || 'self';
                  const lbl = { self:'본인 자기평가', manager:'상사 리뷰', peer:'동료 평가' }[t] || t;
                  const col = { self:'#4F46E5', manager:'#059669', peer:'#D97706' }[t] || 'var(--text-muted)';
                  return `<span style="font-size:0.65rem;padding:2px 7px;border-radius:99px;font-weight:700;background:${col}18;color:${col};border:1px solid ${col}30;">${lbl}</span>`;
                })()}
              </div>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">
                ${(r.submittedAt || r.date) ? '제출: ' + formatDate(r.submittedAt || r.date) : '작성 중'}
              </div>
            </div>
            <span class="badge" style="background:${r.status === 'COMPLETED' ? 'var(--success)' : 'var(--warning)'}20;
                  color:${r.status === 'COMPLETED' ? 'var(--success)' : 'var(--warning)'};
                  border:1px solid ${r.status === 'COMPLETED' ? 'var(--success)' : 'var(--warning)'}40">
              ${r.status === 'COMPLETED' ? '완료' : '진행 중'}
            </span>
          </div>

          <div style="display:flex;gap:8px;margin-bottom:10px">
            <div style="flex:1;background:${SCORE_COLORS[gScore]}15;border-radius:var(--radius-sm);
                        padding:8px;text-align:center">
              <div style="font-size:0.7rem;color:var(--text-muted)">목표 달성도</div>
              <div style="font-size:1.2rem;font-weight:700;color:${SCORE_COLORS[gScore]}">${gScore}</div>
              <div style="font-size:0.7rem;color:${SCORE_COLORS[gScore]}">${SCORE_LABELS[gScore]}</div>
            </div>
            <div style="flex:1;background:${SCORE_COLORS[cScore]}15;border-radius:var(--radius-sm);
                        padding:8px;text-align:center">
              <div style="font-size:0.7rem;color:var(--text-muted)">역량 발휘도</div>
              <div style="font-size:1.2rem;font-weight:700;color:${SCORE_COLORS[cScore]}">${cScore}</div>
              <div style="font-size:0.7rem;color:${SCORE_COLORS[cScore]}">${SCORE_LABELS[cScore]}</div>
            </div>
          </div>

          ${r.keyAchievements ? `
            <div style="margin-bottom:8px">
              <div style="font-size:0.75rem;font-weight:600;color:var(--text-muted);margin-bottom:4px">핵심 성과</div>
              <div style="font-size:0.82rem;color:var(--text);white-space:pre-line">${esc(r.keyAchievements)}</div>
            </div>` : ''}

          ${r.managerComment ? `
            <div style="background:var(--bg);border-radius:var(--radius-sm);padding:8px;margin-top:8px">
              <div style="font-size:0.72rem;font-weight:600;color:var(--primary);margin-bottom:4px">💬 관리자 코멘트</div>
              <div style="font-size:0.82rem;color:var(--text)">${esc(r.managerComment)}</div>
            </div>` : isAdmin() ? `
            <button class="btn btn-ghost btn-sm mgr-comment-btn" data-review-id="${esc(r.id)}"
              style="margin-top:8px;font-size:0.78rem;color:var(--primary);padding:4px 10px;
                     border:1px dashed var(--primary)30;border-radius:var(--radius-sm)">
              + 관리자 코멘트 추가
            </button>` : ''}
        </div>`;
    }).join('');
    content.innerHTML = headerHtml + cardsHtml;
  }

  content.querySelector('#new-review-btn')?.addEventListener('click', openReviewModal);
  content.querySelectorAll('.mgr-comment-btn').forEach(btn => {
    btn.addEventListener('click', () => openManagerCommentModal(btn.dataset.reviewId));
  });
}

function renderMeetingTab(content) {
  const user = getUser();
  const uid  = _session().empId || _session().userId || user?.id || 'demo';
  const meetings = getOneOnOnes()
    .filter(m => m.userId === uid || m.empId === uid)
    .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));

  const managerBanner = _pendingMeetingPrefill ? `
    <div style="margin-bottom:10px;padding:10px 14px;background:#EEF2FF;border-radius:var(--radius-sm);
                display:flex;align-items:center;gap:8px;font-size:0.82rem;color:var(--primary)">
      <span>💬</span>
      <span><strong>${esc(_pendingMeetingPrefill)}님</strong>과의 1:1 미팅을 기록해 주세요.</span>
    </div>` : '';

  const headerHtml = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 0 8px">
      <div style="font-weight:700;font-size:0.95rem">1:1 미팅 기록</div>
      <button class="btn btn-primary btn-sm" id="new-meeting-btn" style="font-size:0.75rem">
        + 기록 추가
      </button>
    </div>
    ${managerBanner}`;

  if (!meetings.length) {
    content.innerHTML = headerHtml + `
      <div class="empty-state" style="min-height:200px">
        <div class="empty-state-icon">🤝</div>
        <div class="empty-state-title">1:1 미팅 기록이 없습니다</div>
        <div class="empty-state-desc">+ 기록 추가 버튼으로 미팅을 기록해 보세요.</div>
      </div>`;
  } else {
    const cardsHtml = meetings.map(m => {
      const totalActions = m.actionItems?.length || 0;
      const doneActions  = m.actionItems?.filter(a => a.done).length || 0;
      return `
        <div class="card" style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
            <div>
              <div style="font-weight:700;font-size:0.9rem">${esc(m.managerName || m.partner || '매니저')}과의 미팅</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">${m.meetingDate || m.date || formatDate(m.createdAt)}</div>
            </div>
            ${totalActions > 0 ? `
              <span style="font-size:0.75rem;padding:3px 8px;border-radius:var(--radius-full);
                     background:${doneActions === totalActions ? 'var(--success)' : 'var(--primary)'}15;
                     color:${doneActions === totalActions ? 'var(--success)' : 'var(--primary)'}">
                ${doneActions}/${totalActions} 완료
              </span>` : ''}
          </div>

          ${m.agenda ? `
            <div style="margin-bottom:8px">
              <div style="font-size:0.72rem;font-weight:600;color:var(--text-muted);margin-bottom:4px">의제</div>
              <div style="font-size:0.82rem;color:var(--text);white-space:pre-line">${esc(m.agenda)}</div>
            </div>` : ''}

          ${m.actionItems?.length ? `
            <div style="margin-bottom:8px">
              <div style="font-size:0.72rem;font-weight:600;color:var(--text-muted);margin-bottom:6px">액션 아이템</div>
              ${m.actionItems.map(a => `
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                  <input type="checkbox" ${a.done ? 'checked' : ''}
                    data-meeting="${m.id}" data-action="${a.id}"
                    class="action-checkbox"
                    style="accent-color:var(--primary);width:16px;height:16px;flex-shrink:0">
                  <span style="font-size:0.82rem;color:var(--text);${a.done ? 'text-decoration:line-through;color:var(--text-muted)' : ''}">
                    ${esc(a.text)}
                  </span>
                </div>`).join('')}
            </div>` : ''}

          ${m.note ? `
            <div style="background:var(--bg);border-radius:var(--radius-sm);padding:8px">
              <div style="font-size:0.72rem;font-weight:600;color:var(--text-muted);margin-bottom:4px">메모</div>
              <div style="font-size:0.82rem;color:var(--text)">${esc(m.note)}</div>
            </div>` : ''}
        </div>`;
    }).join('');
    content.innerHTML = headerHtml + cardsHtml;
  }

  content.querySelector('#new-meeting-btn')?.addEventListener('click', openMeetingModal);

  // Action item checkbox toggle
  content.querySelectorAll('.action-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const meetings2 = getOneOnOnes();
      const mtg = meetings2.find(m => m.id === cb.dataset.meeting);
      if (mtg) {
        const ai = mtg.actionItems.find(a => a.id === cb.dataset.action);
        if (ai) ai.done = cb.checked;
        saveOneOnOnes(meetings2);
      }
    });
  });
}

// ── Event bindings ─────────────────────────────────────────────

let _goalScore = 0;
let _compScore = 0;

function _syncTabVisual(tab) {
  if (!_root) return;
  _root.querySelectorAll('.review-tab').forEach(b => {
    const isActive = b.dataset.tab === tab;
    b.classList.toggle('active', isActive);
    b.style.color = isActive ? 'var(--primary)' : 'var(--text-muted)';
    b.style.borderBottom = isActive ? '2.5px solid var(--primary)' : '2.5px solid transparent';
  });
}

function bindEvents() {
  if (!_root) return;

  // Tab switching
  _root.querySelectorAll('.review-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeTab = btn.dataset.tab;
      _syncTabVisual(_activeTab);
      renderTab(_activeTab);
    });
  });

  // 리뷰어 유형 선택
  const RTYPE_LABEL = { self: '본인 자기평가', manager: '상사 리뷰', peer: '동료 평가' };
  const RTYPE_COLOR = { self: '#4F46E5', manager: '#059669', peer: '#D97706' };
  const RTYPE_BG    = { self: '#EEF2FF',  manager: '#DCFCE7', peer: '#FEF3C7' };
  _root.querySelectorAll('.review-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _reviewerType = btn.dataset.rtype;
      _root.querySelectorAll('.review-type-btn').forEach(b => {
        const v = b.dataset.rtype;
        const active = v === _reviewerType;
        b.style.borderColor = active ? `var(--primary)` : 'var(--border)';
        b.style.background  = active ? RTYPE_BG[v]  : 'var(--surface)';
        b.style.color       = active ? RTYPE_COLOR[v]: 'var(--text-muted)';
      });
      const badge = _root.querySelector('#review-type-badge');
      if (badge) {
        badge.textContent = RTYPE_LABEL[_reviewerType];
        badge.style.background = RTYPE_BG[_reviewerType];
        badge.style.color = RTYPE_COLOR[_reviewerType];
      }
    });
  });

  // Review modal
  _root.querySelector('#review-cancel-btn')?.addEventListener('click', closeReviewModal);
  _root.querySelector('#review-save-btn')?.addEventListener('click', saveReview);

  // Score buttons (review modal)
  _root.querySelectorAll('.score-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      const score = parseInt(btn.dataset.score, 10);
      if (type === 'goal') _goalScore = score;
      if (type === 'comp') _compScore = score;
      _root.querySelectorAll(`.score-btn[data-type="${type}"]`).forEach(b => {
        const s = parseInt(b.dataset.score, 10);
        b.style.background = s === score ? SCORE_COLORS[score] : 'var(--surface)';
        b.style.color      = s === score ? '#fff' : 'var(--text-muted)';
        b.style.borderColor= s === score ? SCORE_COLORS[score] : 'var(--border)';
      });
    });
  });

  // Meeting modal
  _root.querySelector('#meeting-cancel-btn')?.addEventListener('click', closeMeetingModal);
  _root.querySelector('#meeting-save-btn')?.addEventListener('click', saveMeeting);
  _root.querySelector('#add-action-btn')?.addEventListener('click', addActionItem);
}

// ── Review modal ───────────────────────────────────────────────

function openReviewModal() {
  _goalScore = 0;
  _compScore = 0;
  _reviewerType = isAdmin() ? 'manager' : 'self';
  const modal = _root.querySelector('#review-modal');
  _root.querySelector('#review-achievements').value = '';
  _root.querySelector('#review-next-goals').value   = '';
  _root.querySelector('#review-self-comment').value = '';
  // Reset score buttons
  _root.querySelectorAll('.score-btn').forEach(b => {
    b.style.background = 'var(--surface)';
    b.style.color      = 'var(--text-muted)';
    b.style.borderColor= 'var(--border)';
  });
  // Sync reviewer type buttons to current default
  const RTYPE_COLOR = { self: '#4F46E5', manager: '#059669', peer: '#D97706' };
  const RTYPE_BG    = { self: '#EEF2FF',  manager: '#DCFCE7', peer: '#FEF3C7' };
  _root.querySelectorAll('.review-type-btn').forEach(b => {
    const v = b.dataset.rtype;
    const active = v === _reviewerType;
    b.style.borderColor = active ? RTYPE_COLOR[v] : 'var(--border)';
    b.style.background  = active ? RTYPE_BG[v]    : 'var(--surface)';
    b.style.color       = active ? RTYPE_COLOR[v] : 'var(--text-muted)';
  });
  const RTYPE_LABEL = { self:'본인 자기평가', manager:'상사 리뷰', peer:'동료 평가' };
  const badge = _root.querySelector('#review-type-badge');
  if (badge) {
    badge.textContent = RTYPE_LABEL[_reviewerType];
    badge.style.background = RTYPE_BG[_reviewerType];
    badge.style.color = RTYPE_COLOR[_reviewerType];
  }
  openModal(modal);
}

function closeReviewModal() {
  if (_root) closeModal(_root.querySelector('#review-modal'));
}

function saveReview() {
  if (!_goalScore || !_compScore) {
    showToast('목표 달성도와 역량 발휘도를 선택해주세요.', 'warning');
    return;
  }
  const achievements = _root.querySelector('#review-achievements').value.trim();
  const nextGoals    = _root.querySelector('#review-next-goals').value.trim();
  const selfComment  = _root.querySelector('#review-self-comment').value.trim();
  const cycle        = _root.querySelector('#review-cycle').value;

  if (!achievements) { showToast('핵심 성과를 입력해주세요.', 'warning'); return; }

  const user = getUser();
  const reviews = getReviews();
  const newReview = {
    id: genId(),
    userId: user?.id || 'demo',
    cycle,
    reviewerType: _reviewerType || 'self',
    goalAchievement: _goalScore,
    competencyScore: _compScore,
    keyAchievements: achievements,
    nextGoals,
    selfComment,
    managerComment: '',
    status: 'COMPLETED',
    submittedAt: new Date().toISOString(),
  };

  reviews.unshift(newReview);
  saveReviews(reviews);
  closeReviewModal();
  showToast('성과 리뷰가 제출되었습니다.', 'success');
  renderReviewTab(_root.querySelector('#review-tab-content'));

  // In-app notification for the reviewer
  const _YEAR = new Date().getFullYear();
  const CYCLE_LBL = { H1: `${_YEAR} 상반기`, H2: `${_YEAR} 하반기`, ANNUAL: `${_YEAR} 연간` };
  addNotification({
    type:  'system',
    title: '성과 리뷰 제출 완료',
    body:  `${CYCLE_LBL[cycle] || cycle} 성과 리뷰가 제출되었습니다. 관리자 코멘트를 기다려주세요.`,
    route: '#/reviews',
  });

  if (!_isDemo()) {
    api.performance?.saveReview?.(newReview).catch(() =>
      showToast('서버 저장 실패 — 로컬에 임시 보관됩니다.', 'warning')
    );
  }
}

// ── Meeting modal ──────────────────────────────────────────────

function openMeetingModal() {
  const modal = _root.querySelector('#meeting-modal');
  const today = new Date().toISOString().slice(0, 10);
  _root.querySelector('#meeting-date').value   = today;
  _root.querySelector('#meeting-manager').value = _pendingMeetingPrefill || '';
  _root.querySelector('#meeting-agenda').value = '';
  _root.querySelector('#meeting-note').value   = '';
  _root.querySelector('#action-items-list').innerHTML = '';
  _pendingMeetingPrefill = null;
  addActionItem();
  openModal(modal);
}

function closeMeetingModal() {
  if (_root) closeModal(_root.querySelector('#meeting-modal'));
}

function addActionItem() {
  const list = _root.querySelector('#action-items-list');
  const id   = genId();
  const div  = document.createElement('div');
  div.dataset.actionId = id;
  div.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center';
  div.innerHTML = `
    <input type="text" class="form-control action-text-input"
      placeholder="액션 아이템을 작성하세요" style="flex:1;font-size:0.85rem">
    <button class="btn btn-ghost btn-sm remove-action-btn"
      style="padding:4px 8px;color:var(--danger);flex-shrink:0">✕</button>`;
  div.querySelector('.remove-action-btn').addEventListener('click', () => div.remove());
  list.appendChild(div);
}

function saveMeeting() {
  const date    = _root.querySelector('#meeting-date').value;
  const manager = _root.querySelector('#meeting-manager').value.trim();
  const agenda  = _root.querySelector('#meeting-agenda').value.trim();
  const note    = _root.querySelector('#meeting-note').value.trim();

  if (!manager) { showToast('상대방을 입력해주세요.', 'warning'); return; }

  const actionDivs = _root.querySelectorAll('#action-items-list [data-action-id]');
  const actionItems = [];
  actionDivs.forEach(div => {
    const text = div.querySelector('.action-text-input').value.trim();
    if (text) actionItems.push({ id: div.dataset.actionId, text, done: false });
  });

  const user = getUser();
  const meetings = getOneOnOnes();
  const newMeeting = {
    id: genId(),
    userId: user?.id || 'demo',
    managerName: manager,
    meetingDate: date,
    agenda,
    actionItems,
    note,
    createdAt: new Date().toISOString(),
  };

  meetings.unshift(newMeeting);
  saveOneOnOnes(meetings);
  closeMeetingModal();
  showToast('1:1 미팅이 기록되었습니다.', 'success');
  renderMeetingTab(_root.querySelector('#review-tab-content'));
  if (!_isDemo()) {
    api.performance?.saveMeeting?.(newMeeting).catch(() =>
      showToast('서버 저장 실패 — 로컬에 임시 보관됩니다.', 'warning')
    );
  }
}

// ── Manager comment modal ──────────────────────────────────────

function openManagerCommentModal(reviewId) {
  document.getElementById('_mgr-comment-modal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = '_mgr-comment-modal';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;
    display:flex;align-items:flex-end;justify-content:center
  `;

  const reviews = getReviews();
  const review  = reviews.find(r => r.id === reviewId);
  const existing = review?.managerComment || '';

  overlay.innerHTML = `
    <div style="
      background:var(--surface);border-radius:16px 16px 0 0;
      padding:20px 20px 32px;width:100%;max-width:480px;
    ">
      <div style="width:36px;height:4px;border-radius:2px;background:var(--border);margin:0 auto 16px"></div>
      <div style="font-weight:700;font-size:0.95rem;margin-bottom:14px">💬 관리자 코멘트 작성</div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px">
        ${esc(REVIEW_CYCLE_LABEL[review?.cycle] || review?.cycle || '')} · 직원 코멘트에 대한 피드백을 작성하세요
      </div>
      <textarea maxlength="500" id="_mgr-comment-text" class="form-control" rows="4"
        placeholder="성과에 대한 평가 및 다음 기간 기대사항을 작성해 주세요"
        style="resize:none;font-size:0.85rem">${esc(existing)}</textarea>
      <div style="display:flex;gap:10px;margin-top:14px">
        <button id="_mgr-cancel" class="btn btn-ghost" style="flex:1">취소</button>
        <button id="_mgr-save" class="btn btn-primary" style="flex:2">저장</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#_mgr-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#_mgr-save').addEventListener('click', async () => {
    const comment = overlay.querySelector('#_mgr-comment-text').value.trim();
    if (!comment) { showToast('코멘트를 입력해주세요.', 'warning'); return; }
    const allReviews = getReviews();
    const idx = allReviews.findIndex(r => r.id === reviewId);
    if (idx !== -1) {
      allReviews[idx].managerComment = comment;
      saveReviews(allReviews);
    }
    overlay.remove();
    renderReviewTab(_root?.querySelector('#review-tab-content'));
    showToast('관리자 코멘트가 저장되었습니다.', 'success');
    if (!_isDemo()) {
      api.performance?.saveManagerComment?.(reviewId, comment).catch(() =>
        showToast('서버 저장 실패 — 로컬에 임시 보관됩니다.', 'warning')
      );
    }
  });
}
