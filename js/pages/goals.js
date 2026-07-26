/**
 * goals.js – OKR 목표 설정 & 체크인
 * Phase 4B: Performance Management
 */

import {getUser, isAdmin, isApplicant } from '../auth.js';
import { api } from '../api.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

function _session() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}'); } catch { return {}; } }

const _isDemo = () => localStorage.getItem('hr_token') === 'demo-token';

let _root = null;
let _activePeriod = 'H1';

const LS_GOALS    = 'hr_okr_goals';
const LS_CHECKINS = 'hr_okr_checkins';

// ── Helpers ────────────────────────────────────────────────────

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _periodDeadline(period) {
  const yr = new Date().getFullYear();
  if (period === 'H1')    return new Date(yr, 5, 30);   // June 30
  if (period === 'H2')    return new Date(yr, 11, 31);  // Dec 31
  if (period === 'ANNUAL') return new Date(yr, 11, 31);
  return null;
}

function _daysLeft(period) {
  const deadline = _periodDeadline(period);
  if (!deadline) return null;
  return Math.ceil((deadline.getTime() - Date.now()) / 86400000);
}

function _urgencyBadge(period, progress) {
  const days = _daysLeft(period);
  if (days === null || days < 0) return '';
  if (days > 60) return '';
  const behind = days <= 30 && progress < 70;
  const critical = days <= 14 && progress < 50;
  const color  = critical ? '#DC2626' : behind ? '#D97706' : '#059669';
  const bgColor = critical ? '#FEF2F2' : behind ? '#FFFBEB' : '#F0FDF4';
  const icon   = critical ? '🔴' : behind ? '⚠️' : '⏰';
  return `<span style="font-size:0.68rem;font-weight:700;padding:2px 8px;border-radius:20px;background:${bgColor};color:${color};flex-shrink:0;white-space:nowrap">${icon} D-${days}</span>`;
}

function getGoals() {
  try { return JSON.parse(localStorage.getItem(LS_GOALS) || '[]'); } catch { return []; }
}

function saveGoals(goals) {
  localStorage.setItem(LS_GOALS, JSON.stringify(goals));
}

function getCheckins() {
  try { return JSON.parse(localStorage.getItem(LS_CHECKINS) || '[]'); } catch { return []; }
}

function saveCheckins(checkins) {
  localStorage.setItem(LS_CHECKINS, JSON.stringify(checkins));
}

function genId() {
  return 'OKR_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

const _YEAR = new Date().getFullYear();
const PERIOD_LABEL = { H1: `${_YEAR} 상반기`, H2: `${_YEAR} 하반기`, ANNUAL: `${_YEAR} 연간` };

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

// Progress color
function progressColor(p) {
  if (p >= 80) return 'var(--success)';
  if (p >= 50) return 'var(--warning)';
  return 'var(--danger)';
}

// Demo seed data
function seedDemoGoals(userId) {
  const existing = getGoals();
  if (existing.length > 0) return;

  const demos = [
    {
      id: 'OKR_DEMO_1',
      userId,
      period: 'H1',
      objective: 'HR 역량 고도화를 통한 조직 성과 향상',
      keyResults: [
        { id: 'KR1', text: '역량 진단 응답률 80% 달성', progress: 75, unit: '%' },
        { id: 'KR2', text: '신규 진단Kit 3종 도입 완료', progress: 100, unit: '종' },
        { id: 'KR3', text: '직원 만족도 설문 평균 4.2점 이상', progress: 60, unit: '점' },
      ],
      status: 'IN_PROGRESS',
      createdAt: '2025-01-15T09:00:00Z',
    },
    {
      id: 'OKR_DEMO_2',
      userId,
      period: 'H1',
      objective: '채용 프로세스 효율화',
      keyResults: [
        { id: 'KR1', text: '평균 채용 기간 45일 → 30일로 단축', progress: 40, unit: '일' },
        { id: 'KR2', text: '채용 지원자 만족도 4.0점 이상', progress: 85, unit: '점' },
      ],
      status: 'IN_PROGRESS',
      createdAt: '2025-02-01T09:00:00Z',
    },
  ];

  saveGoals(demos);
}

// ── Mount / Unmount ────────────────────────────────────────────

export async function mount(container) {
  if (isApplicant()) {
    container.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _root = container;
  _activePeriod = 'H1';
  const user = getUser();
  if (_isDemo()) {
    seedDemoGoals(user?.id || 'demo');
    render();
  } else {
    render(true); // true = show loading skeleton
  }
  _syncGoalsFromApi(user?.id);
}

export function unmount() {
  _root = null;
}

async function _syncGoalsFromApi(userId) {
  if (!userId || userId === 'demo') return;
  try {
    const data = await api.performance?.getGoals?.(userId);
    if (Array.isArray(data) && data.length) {
      saveGoals(data);
    }
  } catch { /* network not available — keep localStorage */ } finally {
    if (_root) renderGoalList(_activePeriod);
    _checkDeadlineNotifications(userId);
  }
}

function _checkDeadlineNotifications(userId) {
  const now       = new Date();
  const monthEnd  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysLeft  = Math.ceil((monthEnd - now) / 86400000);
  if (daysLeft > 14) return;

  const goals = getGoals().filter(g => g.userId === userId && g.status === 'IN_PROGRESS');
  const atRisk = goals.filter(g => {
    const krs = g.keyResults || [];
    const avgPct = krs.length
      ? krs.reduce((s, kr) => s + (kr.progress || 0), 0) / krs.length
      : 0;
    return avgPct < 80;
  });
  if (!atRisk.length) return;

  const notifKey = `hr_okr_deadline_notif_${now.getFullYear()}_${now.getMonth()}`;
  if (localStorage.getItem(notifKey)) return;
  localStorage.setItem(notifKey, '1');

  addNotification({
    type:  'system',
    title: `OKR 마감 ${daysLeft}일 전`,
    body:  `${atRisk.length}개 목표가 80% 미만 진척입니다. 체크인을 업데이트해 주세요.`,
    route: '#/goals',
  });
}

// ── Render ─────────────────────────────────────────────────────

function render(loading = false) {
  if (!_root) return;
  const user = getUser();

  _root.innerHTML = `
    <div class="page" style="background:var(--bg);height:100vh;overflow:hidden;display:flex;flex-direction:column">
      <div class="top-bar">
        <button class="btn btn-ghost btn-sm" onclick="window.navBack()" style="padding:8px">←</button>
        <div class="top-bar-title">OKR 목표 관리</div>
        <button class="btn btn-primary btn-sm" id="add-goal-btn" style="font-size:0.75rem">+ 목표 추가</button>
      </div>

      <!-- Period tabs — .page-content 밖으로 분리해 flex-shrink:0 고정 -->
      <div style="display:flex;gap:8px;padding:10px 16px;overflow-x:auto;scrollbar-width:none;
                  flex-shrink:0;border-bottom:1px solid var(--border);background:var(--bg)">
          ${Object.entries(PERIOD_LABEL).map(([k, v]) => `
            <button class="period-tab${k === 'H1' ? ' active' : ''}" data-period="${k}"
              style="flex-shrink:0;padding:6px 16px;border-radius:var(--radius-full);
                     border:1.5px solid var(--border);background:var(--surface);
                     font-size:0.8rem;cursor:pointer;color:var(--text-muted);
                     transition:all var(--transition-fast)">
              ${v}
            </button>
          `).join('')}
        </div>

      <!-- 스크롤 컨테이너 -->
      <div class="page-content" style="flex:1;overflow-y:auto">

        <!-- OKR list -->
        <div id="goals-list"></div>

        <!-- Empty state (hidden by default) -->
        <div id="goals-empty" class="empty-state" style="display:none;min-height:200px">
          <div class="empty-state-icon">🎯</div>
          <div class="empty-state-title">이번 기간 목표가 없습니다</div>
          <div class="empty-state-desc">+ 목표 추가 버튼으로 OKR을 설정해 보세요.</div>
        </div>

      </div>
    </div>

    <!-- Add/Edit Goal Modal -->
    <div id="goal-modal" class="modal-overlay" style="display:none">
      <div class="modal-sheet" style="max-height:90vh;overflow-y:auto">
        <div class="modal-handle"></div>
        <div style="padding:16px 20px">
          <div style="font-weight:700;font-size:1rem;margin-bottom:16px" id="modal-title">목표 추가</div>

          <div class="form-group">
            <label class="form-label">기간</label>
            <select id="goal-period" class="form-control" style="width:100%">
              ${Object.entries(PERIOD_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
            </select>
          </div>

          <div class="form-group" style="margin-top:12px">
            <label class="form-label">목표 (Objective)</label>
            <textarea maxlength="500" id="goal-objective" class="form-control" rows="2"
              placeholder="달성하고 싶은 핵심 목표를 작성하세요" style="resize:none"></textarea>
          </div>

          <div class="form-group" style="margin-top:12px">
            <label class="form-label">상위 목표 연결 (OKR Cascade) <span style="font-size:0.72rem;color:var(--text-muted);font-weight:400">— 선택사항</span></label>
            <select id="goal-parent" class="form-control" style="width:100%">
              <option value="">— 상위 목표 없음 (독립 목표)</option>
            </select>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">팀·조직 목표와 연결하면 기여도를 추적할 수 있습니다</div>
          </div>

          <div style="margin-top:12px">
            <label class="form-label">핵심 결과 (Key Results)</label>
            <div id="kr-list"></div>
            <button id="add-kr-btn" class="btn btn-ghost btn-sm"
              style="margin-top:8px;font-size:0.8rem;color:var(--primary)">
              + KR 추가 (최대 4개)
            </button>
          </div>

          <div style="display:flex;gap:8px;margin-top:20px">
            <button class="btn btn-outline btn-block" id="modal-cancel-btn">취소</button>
            <button class="btn btn-primary btn-block" id="modal-save-btn">저장</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Check-in Modal -->
    <div id="checkin-modal" class="modal-overlay" style="display:none">
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div style="padding:16px 20px">
          <div style="font-weight:700;font-size:1rem;margin-bottom:4px">체크인</div>
          <div id="checkin-kr-label" style="font-size:0.8rem;color:var(--text-muted);margin-bottom:16px"></div>

          <div class="form-group">
            <label class="form-label">현재 진척률 (%)</label>
            <div style="display:flex;align-items:center;gap:12px">
              <input type="range" id="checkin-progress" min="0" max="100" step="5" value="50"
                style="flex:1;accent-color:var(--primary)">
              <span id="checkin-progress-val"
                style="min-width:36px;text-align:right;font-weight:700;color:var(--primary)">50%</span>
            </div>
          </div>

          <div class="form-group" style="margin-top:12px">
            <label class="form-label">코멘트 (선택)</label>
            <textarea maxlength="500" id="checkin-comment" class="form-control" rows="2"
              placeholder="진척 상황이나 이슈를 간단히 기록하세요" style="resize:none"></textarea>
          </div>

          <div style="display:flex;gap:8px;margin-top:20px">
            <button class="btn btn-outline btn-block" id="checkin-cancel-btn">취소</button>
            <button class="btn btn-primary btn-block" id="checkin-save-btn">저장</button>
          </div>
        </div>
      </div>
    </div>`;

  bindEvents();
  if (loading) {
    const list = _root.querySelector('#goals-list');
    if (list) list.innerHTML = [1, 2].map(() =>
      '<div class="skeleton" style="height:100px;border-radius:12px;margin-bottom:16px"></div>'
    ).join('');
  } else {
    renderGoalList('H1');
  }
}

// ── Goal list render ───────────────────────────────────────────

function renderGoalList(period) {
  if (!_root) return;
  const user = getUser();
  const all = getGoals().filter(g => g.userId === (user?.id || 'demo') && g.period === period);
  const list = _root.querySelector('#goals-list');
  const empty = _root.querySelector('#goals-empty');

  if (!all.length) {
    list.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = all.map(goal => {
    const avgProgress = Math.round(
      goal.keyResults.reduce((s, kr) => s + kr.progress, 0) / goal.keyResults.length
    );
    const parentGoal = goal.parentGoalId
      ? getGoals().find(g => g.id === goal.parentGoalId)
      : null;
    return `
      <div class="card" style="margin-bottom:16px;border-left:4px solid ${parentGoal ? 'var(--warning)' : 'var(--primary)'}">
        ${parentGoal ? `
          <div style="font-size:0.7rem;color:var(--warning);font-weight:600;margin-bottom:6px;
                      display:flex;align-items:center;gap:4px">
            <span>🔗</span>
            <span>상위 목표: ${esc(parentGoal.objective)}</span>
          </div>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div style="font-weight:700;font-size:0.9rem;flex:1;margin-right:8px">${esc(goal.objective)}</div>
          <div style="display:flex;gap:6px;flex-shrink:0;align-items:center">
            ${_urgencyBadge(goal.period, avgProgress)}
            <button class="btn btn-ghost btn-sm edit-goal-btn" data-id="${goal.id}"
              style="font-size:0.75rem;padding:4px 8px">편집</button>
            <button class="btn btn-ghost btn-sm delete-goal-btn" data-id="${goal.id}"
              style="font-size:0.75rem;padding:4px 8px;color:var(--danger)">삭제</button>
          </div>
        </div>

        <!-- Overall progress -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${avgProgress}%;background:${progressColor(avgProgress)};
                        border-radius:4px;transition:width 0.4s ease"></div>
          </div>
          <span style="font-size:0.8rem;font-weight:700;color:${progressColor(avgProgress)};min-width:36px;text-align:right">
            ${avgProgress}%
          </span>
        </div>

        <!-- Key Results -->
        <div style="display:flex;flex-direction:column;gap:10px">
          ${goal.keyResults.map(kr => `
            <div style="background:var(--bg);border-radius:var(--radius-sm);padding:10px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <div style="font-size:0.8rem;color:var(--text);flex:1;margin-right:8px">${esc(kr.text)}</div>
                <button class="btn btn-ghost btn-sm checkin-btn"
                  data-goal="${goal.id}" data-kr="${kr.id}"
                  style="font-size:0.7rem;padding:2px 8px;color:var(--primary);flex-shrink:0">
                  체크인
                </button>
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden">
                  <div style="height:100%;width:${kr.progress}%;background:${progressColor(kr.progress)};
                              border-radius:3px"></div>
                </div>
                <span style="font-size:0.75rem;color:${progressColor(kr.progress)};min-width:32px;text-align:right;font-weight:600">
                  ${kr.progress}%
                </span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
  }).join('');

  // Bind goal-specific buttons
  list.querySelectorAll('.edit-goal-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  list.querySelectorAll('.delete-goal-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteGoal(btn.dataset.id));
  });
  list.querySelectorAll('.checkin-btn').forEach(btn => {
    btn.addEventListener('click', () => openCheckinModal(btn.dataset.goal, btn.dataset.kr));
  });
}

// ── Event bindings ─────────────────────────────────────────────

let _editingGoalId = null;
let _editingKrGoalId = null;
let _editingKrId = null;

function bindEvents() {
  if (!_root) return;

  // Period tabs
  _root.querySelectorAll('.period-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _root.querySelectorAll('.period-tab').forEach(b => {
        b.classList.remove('active');
        b.style.background = 'var(--surface)';
        b.style.color = 'var(--text-muted)';
        b.style.borderColor = 'var(--border)';
      });
      btn.classList.add('active');
      btn.style.background = 'var(--primary)';
      btn.style.color = '#fff';
      btn.style.borderColor = 'var(--primary)';
      _activePeriod = btn.dataset.period;
      renderGoalList(_activePeriod);
    });
    // Style active tab initially
    if (btn.classList.contains('active')) {
      btn.style.background = 'var(--primary)';
      btn.style.color = '#fff';
      btn.style.borderColor = 'var(--primary)';
    }
  });

  // Add goal button
  _root.querySelector('#add-goal-btn')?.addEventListener('click', () => openAddModal());

  // Modal cancel
  _root.querySelector('#modal-cancel-btn')?.addEventListener('click', closeGoalModal);
  _root.querySelector('#checkin-cancel-btn')?.addEventListener('click', closeCheckinModal);

  // Add KR button
  _root.querySelector('#add-kr-btn')?.addEventListener('click', addKrField);

  // Goal modal save
  _root.querySelector('#modal-save-btn')?.addEventListener('click', saveGoal);

  // Checkin progress slider
  const slider = _root.querySelector('#checkin-progress');
  const valEl  = _root.querySelector('#checkin-progress-val');
  slider?.addEventListener('input', () => { valEl.textContent = slider.value + '%'; });

  // Checkin save
  _root.querySelector('#checkin-save-btn')?.addEventListener('click', saveCheckin);
}

// ── Modal helpers ──────────────────────────────────────────────

function _populateParentSelect(excludeId = null) {
  const sel = _root?.querySelector('#goal-parent');
  if (!sel) return;
  const user = getUser();
  const uid  = _session().empId || _session().userId || user?.id || 'demo';
  const others = getGoals().filter(g => g.userId === uid && g.id !== excludeId);
  sel.innerHTML = '<option value="">— 상위 목표 없음 (독립 목표)</option>'
    + others.map(g => `<option value="${esc(g.id)}">[${esc(PERIOD_LABEL[g.period] || g.period)}] ${esc(g.objective)}</option>`).join('');
}

function openAddModal() {
  _editingGoalId = null;
  const modal = _root.querySelector('#goal-modal');
  _root.querySelector('#modal-title').textContent = '목표 추가';
  _root.querySelector('#goal-objective').value = '';
  _root.querySelector('#goal-period').value = 'H1';
  _populateParentSelect();
  resetKrFields([
    { id: genId(), text: '', progress: 0 },
    { id: genId(), text: '', progress: 0 },
  ]);
  openModal(modal);
}

function openEditModal(goalId) {
  const goals = getGoals();
  const goal = goals.find(g => g.id === goalId);
  if (!goal) return;
  _editingGoalId = goalId;

  const modal = _root.querySelector('#goal-modal');
  _root.querySelector('#modal-title').textContent = '목표 편집';
  _root.querySelector('#goal-objective').value = goal.objective;
  _root.querySelector('#goal-period').value = goal.period;
  _populateParentSelect(goalId);
  const parentSel = _root.querySelector('#goal-parent');
  if (parentSel) parentSel.value = goal.parentGoalId || '';
  resetKrFields(goal.keyResults);
  openModal(modal);
}

function closeGoalModal() {
  if (_root) closeModal(_root.querySelector('#goal-modal'));
  _editingGoalId = null;
}

function resetKrFields(krs) {
  const container = _root.querySelector('#kr-list');
  container.innerHTML = '';
  krs.forEach(kr => addKrField(kr));
}

function addKrField(kr = null) {
  const container = _root.querySelector('#kr-list');
  if (container.children.length >= 4) {
    showToast('KR은 최대 4개까지 추가할 수 있습니다.', 'warning');
    return;
  }
  const id = (kr && kr.id) ? kr.id : genId();
  const text = (kr && kr.text) ? kr.text : '';
  const div = document.createElement('div');
  div.dataset.krId = id;
  div.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center';
  div.innerHTML = `
    <input type="text" class="form-control kr-text-input" value="${esc(text)}"
      placeholder="측정 가능한 핵심 결과를 작성하세요"
      style="flex:1;font-size:0.85rem">
    <button class="btn btn-ghost btn-sm remove-kr-btn"
      style="padding:4px 8px;color:var(--danger);flex-shrink:0">✕</button>`;
  div.querySelector('.remove-kr-btn').addEventListener('click', () => div.remove());
  container.appendChild(div);
}

function saveGoal() {
  const objective    = _root.querySelector('#goal-objective').value.trim();
  const period       = _root.querySelector('#goal-period').value;
  const parentGoalId = _root.querySelector('#goal-parent')?.value || null;
  if (!objective) { showToast('목표를 입력해주세요.', 'warning'); return; }

  const krDivs = _root.querySelectorAll('#kr-list [data-kr-id]');
  const keyResults = [];
  let hasKr = false;
  krDivs.forEach(div => {
    const text = div.querySelector('.kr-text-input').value.trim();
    if (text) {
      hasKr = true;
      keyResults.push({ id: div.dataset.krId, text, progress: 0 });
    }
  });
  if (!hasKr) { showToast('핵심 결과(KR)를 1개 이상 입력해주세요.', 'warning'); return; }

  const user = getUser();
  const goals = getGoals();

  let savedGoal;
  if (_editingGoalId) {
    const idx = goals.findIndex(g => g.id === _editingGoalId);
    if (idx !== -1) {
      const existingGoal = goals[idx];
      const mergedKRs = keyResults.map(kr => {
        const existing = existingGoal.keyResults.find(e => e.id === kr.id);
        return existing ? { ...kr, progress: existing.progress } : kr;
      });
      goals[idx] = { ...existingGoal, objective, period, keyResults: mergedKRs, parentGoalId: parentGoalId || null };
      savedGoal = goals[idx];
    }
  } else {
    savedGoal = {
      id: genId(),
      userId: user?.id || 'demo',
      period,
      objective,
      keyResults,
      parentGoalId: parentGoalId || null,
      status: 'IN_PROGRESS',
      createdAt: new Date().toISOString(),
    };
    goals.push(savedGoal);
  }

  saveGoals(goals);
  closeGoalModal();
  showToast('목표가 저장되었습니다.', 'success');
  if (savedGoal && !_isDemo()) {
    api.performance?.saveGoal?.(savedGoal).catch(() =>
      showToast('서버 저장 실패 — 로컬에 임시 보관됩니다.', 'warning')
    );
  }
  const activePeriod = _root.querySelector('.period-tab.active')?.dataset.period || 'H1';
  renderGoalList(activePeriod);
}

function deleteGoal(goalId) {
  const goals = getGoals().filter(g => g.id !== goalId);
  saveGoals(goals);
  if (!_isDemo()) {
    api.performance?.deleteGoal?.(goalId).catch(() =>
      showToast('서버 삭제 실패 — 새로고침 후 재시도해주세요.', 'warning')
    );
  }
  showToast('목표가 삭제되었습니다.', 'info');
  const activePeriod = _root.querySelector('.period-tab.active')?.dataset.period || 'H1';
  renderGoalList(activePeriod);
}

// ── Check-in ───────────────────────────────────────────────────

function openCheckinModal(goalId, krId) {
  _editingKrGoalId = goalId;
  _editingKrId     = krId;

  const goals = getGoals();
  const goal  = goals.find(g => g.id === goalId);
  const kr    = goal?.keyResults.find(k => k.id === krId);
  if (!kr) return;

  const modal    = _root.querySelector('#checkin-modal');
  const labelEl  = _root.querySelector('#checkin-kr-label');
  const slider   = _root.querySelector('#checkin-progress');
  const valEl    = _root.querySelector('#checkin-progress-val');
  const commentEl= _root.querySelector('#checkin-comment');

  labelEl.textContent = kr.text;
  slider.value = kr.progress;
  valEl.textContent   = kr.progress + '%';
  commentEl.value     = '';

  openModal(modal);
}

function closeCheckinModal() {
  if (_root) closeModal(_root.querySelector('#checkin-modal'));
  _editingKrGoalId = null;
  _editingKrId     = null;
}

function saveCheckin() {
  const progress = parseInt(_root.querySelector('#checkin-progress').value, 10);
  const comment  = _root.querySelector('#checkin-comment').value.trim();

  const goals = getGoals();
  const goal  = goals.find(g => g.id === _editingKrGoalId);
  if (!goal) return;
  const kr = goal.keyResults.find(k => k.id === _editingKrId);
  if (!kr) return;

  kr.progress = progress;
  saveGoals(goals);

  const checkins = getCheckins();
  checkins.unshift({
    id: genId(),
    goalId: _editingKrGoalId,
    krId: _editingKrId,
    progress,
    comment,
    createdAt: new Date().toISOString(),
  });
  saveCheckins(checkins.slice(0, 100));

  if (!_isDemo()) {
    api.performance?.saveCheckin?.({ goalId: _editingKrGoalId, krId: _editingKrId, progress, comment })
      .catch(() => showToast('체크인 서버 저장 실패 — 로컬에 임시 보관됩니다.', 'warning'));
  }
  closeCheckinModal();
  showToast('체크인이 저장되었습니다.', 'success');
  const activePeriod = _root.querySelector('.period-tab.active')?.dataset.period || 'H1';
  renderGoalList(activePeriod);
}
