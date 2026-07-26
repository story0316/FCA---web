/**
 * idp.js – Individual Development Plan (IDP) page
 * HR Competency OS
 *
 * Displays personal growth roadmap with priority-filtered IDP cards.
 * Supports tap-cycle status changes and AI regeneration.
 */

import { isApplicant } from '../auth.js';
import { api }             from '../api.js';
import { getUser }         from '../auth.js';
import { showToast }       from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId() {
  const s = _session();
  return s.empId || s.userId || getUser()?.id || 'EMP001';
}

// ── Module-level state ─────────────────────────────────────────
let _root        = null;
let _items       = [];
let _activeTab   = 'all';   // 'all' | 'High' | 'Medium' | 'Low'
let _generating  = false;

// ── Status cycle for tap-to-advance ───────────────────────────
const STATUS_CYCLE = ['not_started', 'in_progress', 'completed'];

const STATUS_LABELS = {
  not_started: '시작 전',
  in_progress: '진행 중',
  completed:   '완료',
};

const STATUS_COLORS = {
  not_started: 'var(--text-light)',
  in_progress: 'var(--warning)',
  completed:   'var(--success)',
};

// ── Action type icons (spec-aligned) ──────────────────────────
const ACTION_ICONS = {
  study:    '📚',
  reading:  '📚',
  training: '🎓',
  mentoring:'🤝',
  project:  '🚀',
  rotation: '🔄',
  coaching: '💬',
  workshop: '🏫',
  online:   '💻',
  default:  '🌱',
};

// ── Demo data (fallback when API unavailable) ──────────────────
const DEMO_ITEMS = [
  {
    id:                   'IDP_DEMO_001',
    competency_id:        'COMP_CORE_AI',
    competency_name_ko:   'AI 활용 능력',
    gap_score:            0.7,
    priority:             'High',
    action_type:          'training',
    resource_title_ko:    'AI 리터러시 집중 교육 과정',
    target_date:          new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
    status:               'in_progress',
  },
  {
    id:                   'IDP_DEMO_002',
    competency_id:        'COMP_CORE_COMM',
    competency_name_ko:   '협업&소통',
    gap_score:            0.5,
    priority:             'Medium',
    action_type:          'mentoring',
    resource_title_ko:    '크로스팀 멘토링 프로그램',
    target_date:          new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
    status:               'not_started',
  },
  {
    id:                   'IDP_DEMO_003',
    competency_id:        'COMP_CORE_DATA',
    competency_name_ko:   '데이터 기반 사고',
    gap_score:            0.3,
    priority:             'Low',
    action_type:          'study',
    resource_title_ko:    '비즈니스 데이터 분석 자기학습',
    target_date:          new Date(Date.now() + 120 * 24 * 3600 * 1000).toISOString(),
    status:               'not_started',
  },
];

// ── Public API ─────────────────────────────────────────────────

export async function mount(container) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _root      = container;
  _items     = [];
  _activeTab = 'all';

  _renderShell(container);
  await _loadData();
}

export function unmount() {
  _root       = null;
  _items      = [];
  _generating = false;
}

// ── Shell render ───────────────────────────────────────────────

function _renderShell(root) {
  const now  = new Date();
  const dateStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;

  root.innerHTML = `
    <div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden">
      <!-- Top bar -->
      <div class="top-bar" style="flex-shrink:0">
        <button class="btn btn-ghost btn-sm" onclick="window.navBack()" style="min-height:40px" aria-label="뒤로가기">‹</button>
        <div class="top-bar-title">성장 계획 (IDP)</div>
        <button id="idp-csv-btn" class="btn btn-ghost btn-sm" style="font-size:0.75rem;padding:4px 10px" aria-label="CSV 내보내기">📥</button>
      </div>

      <div class="page-content" style="flex:1;overflow-y:auto" id="idp-content">

        <!-- Header card -->
        <div class="card fade-in" style="margin-bottom:16px">
          <div class="card-header">
            <div>
              <div class="card-title">개인 성장 로드맵 (IDP)</div>
              <div class="card-subtitle">${escapeHtml(dateStr)}</div>
            </div>
            <button
              class="btn btn-primary btn-sm"
              id="generate-btn"
              aria-label="AI IDP 재생성"
              style="white-space:nowrap"
            >+ AI IDP 재생성</button>
          </div>

          <!-- Summary strip (filled after data loads) -->
          <div id="idp-summary" style="margin-top:12px">
            <div class="skeleton" style="height:40px;border-radius:8px"></div>
          </div>
        </div>

        <!-- Priority tabs -->
        <div class="tab-bar fade-in fade-in-delay-1" id="priority-tabs" role="tablist" aria-label="우선순위 필터">
          ${_renderTabs()}
        </div>

        <!-- IDP card list -->
        <div id="idp-list" class="fade-in fade-in-delay-2">
          ${_renderSkeletonCards(3)}
        </div>

      </div>

    </div>
  `;

  _bindShellEvents(root);
}

function _renderTabs() {
  const tabs = [
    { key: 'all',    label: '전체' },
    { key: 'High',   label: 'High' },
    { key: 'Medium', label: 'Medium' },
    { key: 'Low',    label: 'Low' },
  ];
  return tabs.map(t => `
    <button
      class="tab-btn${t.key === _activeTab ? ' active' : ''}"
      role="tab"
      aria-selected="${t.key === _activeTab}"
      data-tab="${escapeHtml(t.key)}"
    >${escapeHtml(t.label)}</button>
  `).join('');
}

function _renderSkeletonCards(n) {
  return Array(n).fill(0).map(() =>
    `<div class="skeleton skeleton-card" style="height:88px;margin-bottom:12px"></div>`
  ).join('');
}

// ── Data loading ───────────────────────────────────────────────

let _apiMeta = null;   // {completion_rate, total_items, completed_items}

async function _loadData() {
  const user   = getUser();
  const userId = _empId();
  const cycle  = window.appState?.cycle || '';

  try {
    const data = await api.idp.get(userId, cycle);
    if (data && data.items && data.items.length > 0) {
      _items = data.items;
      _apiMeta = {
        completion_rate: data.completion_rate ?? null,
        total_items: data.total_items ?? _items.length,
        completed_items: data.completed_items ?? 0,
      };
    } else if (Array.isArray(data) && data.length > 0) {
      _items = data;
      _apiMeta = null;
    } else {
      _items = DEMO_ITEMS;
      _apiMeta = null;
    }
  } catch (err) {
    console.warn('[IDP] API unavailable, using demo data:', err);
    _items = DEMO_ITEMS;
    _apiMeta = null;
  }

  _renderContent();
  _checkIdpDueNotifications();
  window.dispatchEvent(new CustomEvent('hr:navbadge', { detail: {
    idpItems: _items.map(i => ({ status: i.status, dueDate: i.target_date || i.dueDate })),
  }}));
}

function _checkIdpDueNotifications() {
  const user = getUser();
  if (!user?.id || user.id === 'demo') return;
  const now = Date.now();
  const overdue = _items.filter(item => {
    if (item.status === 'completed') return false;
    if (!item.target_date) return false;
    return new Date(item.target_date).getTime() < now + 7 * 86400000;
  });
  if (!overdue.length) return;

  const notifKey = `hr_idp_due_notif_${new Date().getFullYear()}_${new Date().getMonth()}`;
  if (localStorage.getItem(notifKey)) return;
  localStorage.setItem(notifKey, '1');

  addNotification({
    type:  'system',
    title: 'IDP 기한 임박',
    body:  `${overdue.length}건의 IDP 항목이 7일 이내 마감입니다. 진행 상황을 업데이트해 주세요.`,
    route: '#/idp',
  });
}

// ── Content rendering ──────────────────────────────────────────

function _renderContent() {
  if (!_root) return;

  _renderSummary();
  _renderTabBar();
  _renderCards();
}

function _renderSummary() {
  const summaryEl = _root?.querySelector('#idp-summary');
  if (!summaryEl) return;

  const totalGap  = _items.reduce((acc, it) => acc + (it.gap_score || 0), 0);
  const avgGap    = _items.length ? (totalGap / _items.length) : 0;
  const highCount = _items.filter(it => it.priority === 'High' || it.priority === 'high').length;
  const completedCount = _items.filter(it => it.status === 'completed').length;
  const completionRate = _apiMeta?.completion_rate != null
    ? _apiMeta.completion_rate
    : (_items.length > 0 ? Math.round(completedCount / _items.length * 100) : 0);

  const progressBar = `
    <div style="margin-top:8px;padding:0 2px">
      <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">
        <span>완료율</span>
        <span style="font-weight:600;color:var(--success)">${completionRate.toFixed(1)}%</span>
      </div>
      <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${Math.min(completionRate, 100)}%;background:var(--success);border-radius:3px;transition:width 0.6s ease"></div>
      </div>
    </div>
  `;

  summaryEl.innerHTML = `
    <div style="
      background:rgba(79,70,229,0.06);
      border:1px solid rgba(79,70,229,0.15);
      border-radius:var(--radius-sm);
      padding:12px 16px;
    ">
      <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:120px">
          <span style="font-size:1.4rem">📊</span>
          <div>
            <div style="font-size:0.72rem;color:var(--text-muted);line-height:1.2">평균 Gap</div>
            <div style="font-size:1.3rem;font-weight:700;color:var(--primary)">${avgGap.toFixed(1)}</div>
          </div>
        </div>
        <div style="width:1px;height:36px;background:var(--border)"></div>
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:120px">
          <span style="font-size:1.4rem">🔴</span>
          <div>
            <div style="font-size:0.72rem;color:var(--text-muted);line-height:1.2">High 우선순위</div>
            <div style="font-size:1.3rem;font-weight:700;color:var(--danger)">${highCount}개</div>
          </div>
        </div>
        <div style="width:1px;height:36px;background:var(--border)"></div>
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:120px">
          <span style="font-size:1.4rem">✅</span>
          <div>
            <div style="font-size:0.72rem;color:var(--text-muted);line-height:1.2">완료</div>
            <div style="font-size:1.3rem;font-weight:700;color:var(--success)">${completedCount}개</div>
          </div>
        </div>
      </div>
      ${progressBar}
    </div>
  `;
}

function _renderTabBar() {
  const tabsEl = _root?.querySelector('#priority-tabs');
  if (!tabsEl) return;
  tabsEl.innerHTML = _renderTabs();

  // Rebind tab clicks
  tabsEl.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeTab = btn.dataset.tab;
      _renderTabBar();
      _renderCards();
    });
  });
}

function _renderCards() {
  const listEl = _root?.querySelector('#idp-list');
  if (!listEl) return;

  const filtered = _activeTab === 'all'
    ? _items
    : _items.filter(it => it.priority === _activeTab);

  if (!filtered.length) {
    listEl.innerHTML = `
      <div class="empty-state" style="padding:40px 0">
        <div class="empty-state-icon">🎯</div>
        <div class="empty-state-title">해당 우선순위 항목이 없습니다</div>
        <div class="empty-state-desc">다른 탭을 선택하거나 AI IDP를 재생성해 보세요.</div>
        <button onclick="document.getElementById('generate-btn')?.click()"
          style="margin-top:8px;padding:10px 22px;background:#6366f1;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">
          AI IDP 재생성
        </button>
      </div>
    `;
    return;
  }

  listEl.innerHTML = '';

  // Overdue/urgent banner
  const now = Date.now();
  const overdueItems = filtered.filter(it => {
    if (it.status === 'completed' || !it.target_date) return false;
    return new Date(it.target_date).getTime() < now;
  });
  const urgentItems = filtered.filter(it => {
    if (it.status === 'completed' || !it.target_date) return false;
    const days = Math.ceil((new Date(it.target_date).getTime() - now) / 86400000);
    return days >= 0 && days <= 7;
  });
  if (overdueItems.length > 0) {
    const banner = document.createElement('div');
    banner.style.cssText = 'background:#FEF2F2;border:1.5px solid #FCA5A5;border-radius:var(--radius-md);padding:10px 14px;margin-bottom:12px;font-size:0.8rem;color:#DC2626;font-weight:600;';
    banner.textContent = `⚠️ ${overdueItems.length}개 항목이 마감일을 초과했습니다. 빠르게 업데이트하세요.`;
    listEl.appendChild(banner);
  } else if (urgentItems.length > 0) {
    const banner = document.createElement('div');
    banner.style.cssText = 'background:#FFF7ED;border:1.5px solid #FDBA74;border-radius:var(--radius-md);padding:10px 14px;margin-bottom:12px;font-size:0.8rem;color:#C2410C;font-weight:600;';
    banner.textContent = `⏰ ${urgentItems.length}개 항목의 마감이 7일 이내입니다. 상태를 업데이트하세요.`;
    listEl.appendChild(banner);
  }

  for (const item of filtered) {
    const wrapper = _buildCardWrapper(item);
    listEl.appendChild(wrapper);
  }
}

// ── Card building ──────────────────────────────────────────────

function _buildCardWrapper(item) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'margin-bottom:12px;position:relative';
  wrapper.setAttribute('data-item-id', item.id || '');
  _populateCard(wrapper, item);
  return wrapper;
}

function _populateCard(wrapper, item) {
  wrapper.innerHTML = '';

  const actionIcon = ACTION_ICONS[item.action_type] || ACTION_ICONS.default;
  const status     = item.status || 'not_started';
  const priority   = item.priority || 'Low';

  const priorityColor = {
    High:   'var(--danger)',
    Medium: 'var(--warning)',
    Low:    'var(--info)',
  }[priority] || 'var(--text-muted)';

  const targetDate = _formatDate(item.target_date);

  const card = document.createElement('div');
  card.className = 'card fade-in';
  card.setAttribute('role', 'article');
  card.setAttribute('aria-label', `IDP 항목: ${item.competency_name_ko || ''}`);
  card.style.cssText = 'padding:14px 16px;cursor:pointer;user-select:none;transition:transform 150ms ease,box-shadow 150ms ease';

  card.innerHTML = `
    <div style="display:flex;gap:12px;align-items:flex-start">
      <!-- Action icon -->
      <div style="
        width:44px;height:44px;min-width:44px;
        border-radius:var(--radius-sm);
        background:rgba(79,70,229,0.08);
        display:flex;align-items:center;justify-content:center;
        font-size:1.4rem;
        flex-shrink:0;
      " aria-hidden="true">${actionIcon}</div>

      <!-- Body -->
      <div style="flex:1;min-width:0">
        <!-- Top row: competency + priority badge -->
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px">
          <span style="font-size:0.72rem;font-weight:600;color:${priorityColor};
            border:1px solid ${priorityColor};border-radius:var(--radius-full);
            padding:2px 8px;flex-shrink:0">${escapeHtml(priority)}</span>
          <span style="font-size:0.82rem;font-weight:600;color:var(--text);
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${escapeHtml(item.competency_name_ko || '역량')}
          </span>
          ${item.gap_score != null ? `
            <span style="font-size:0.72rem;color:var(--danger);margin-left:auto;flex-shrink:0">
              ▲ GAP ${Number(item.gap_score).toFixed(1)}
            </span>` : ''}
        </div>

        <!-- Resource title -->
        <div style="font-size:0.9rem;color:var(--text);font-weight:500;
          margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${escapeHtml(item.resource_title_ko || '학습 리소스')}
        </div>

        <!-- Meta: date + due badge + status -->
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${targetDate ? `
            <span style="font-size:0.75rem;color:var(--text-muted)">📅 ${escapeHtml(targetDate)}</span>
          ` : ''}
          ${_dueBadge(item.target_date, status)}
          <!-- Status badge (tap to cycle) -->
          <button
            class="status-cycle-btn"
            aria-label="상태 변경: ${escapeHtml(STATUS_LABELS[status])}"
            style="
              border:none;background:none;cursor:pointer;padding:0;
              font-size:0.75rem;font-weight:600;
              color:${STATUS_COLORS[status] || 'var(--text-muted)'};
              display:flex;align-items:center;gap:4px;
            "
          >
            <span style="
              display:inline-block;width:7px;height:7px;border-radius:50%;
              background:${STATUS_COLORS[status] || 'var(--text-muted)'};
            "></span>
            ${escapeHtml(STATUS_LABELS[status] || status)}
          </button>
        </div>
      </div>
    </div>
  `;

  // Tap-cycle status
  const statusBtn = card.querySelector('.status-cycle-btn');
  statusBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    await _cycleStatus(item, wrapper);
  });

  // Card press animation
  card.addEventListener('pointerdown', () => {
    card.style.transform = 'scale(0.98)';
    card.style.boxShadow = 'none';
  });
  card.addEventListener('pointerup',   () => { card.style.transform = ''; card.style.boxShadow = ''; });
  card.addEventListener('pointerleave',() => { card.style.transform = ''; card.style.boxShadow = ''; });

  wrapper.appendChild(card);
}

async function _cycleStatus(item, wrapper) {
  const currentIdx  = STATUS_CYCLE.indexOf(item.status || 'not_started');
  const nextStatus  = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];

  // Optimistic update
  item.status = nextStatus;
  _populateCard(wrapper, item);

  // Sync summary
  _renderSummary();
  _renderCards();

  // Check all-complete milestone
  if (nextStatus === 'completed') {
    const allDone = _items.every(i => i.status === 'completed');
    if (allDone && _items.length > 0) {
      const user   = getUser();
      const userId = _empId();
      const seenKey = `hr_milestone_idp_all_${userId}_${new Date().getFullYear()}`;
      if (!localStorage.getItem(seenKey)) {
        localStorage.setItem(seenKey, '1');
        addNotification({
          id:    `idp_all_done_${userId}_${Date.now()}`,
          type:  'system',
          title: '🎊 IDP 전 항목 완료!',
          body:  `성장 계획 ${_items.length}건을 모두 달성했습니다. 수고하셨습니다!`,
          route: '#/growth',
        });
      }
    }
  }

  // Persist to API (fire-and-forget; show toast on error)
  try {
    const user   = getUser();
    const userId = _empId();
    await api.idp.update(userId, item.id, { status: nextStatus });
  } catch (err) {
    console.warn('[IDP] Status update failed:', err);
    showToast('상태 업데이트에 실패했습니다. 다시 시도해 주세요.', 'warning');
  }
}

// ── Generate button ────────────────────────────────────────────

async function _handleGenerate() {
  if (_generating) return;
  _generating = true;

  const btn = _root?.querySelector('#generate-btn');
  const origText = btn?.textContent || '+ AI IDP 재생성';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '생성 중…';
  }

  const user       = getUser();
  const userId = _empId();
  const instanceId = window.appState?.instance_id;
  const cycle      = window.appState?.cycle || '';

  const payload = instanceId
    ? { instance_id: instanceId }
    : { user_id: userId, cycle };

  try {
    const result = await api.idp.generate(payload);
    if (result?.idp_items?.length > 0) {
      _items = result.idp_items;
      _apiMeta = {
        completion_rate: 0,
        total_items: result.items_created || _items.length,
        completed_items: 0,
      };
      showToast(`IDP ${result.items_created || _items.length}건 생성 완료`, 'success')
    addNotification({ type: 'success', title: '개발 계획', body: 'IDP 건 생성 완료' });
    } else if (result?.items?.length > 0) {
      _items = result.items;
      _apiMeta = { completion_rate: result.completion_rate ?? 0, total_items: result.total_items, completed_items: result.completed_items };
      showToast('IDP가 재생성되었습니다.', 'success');
    } else {
      showToast('생성된 IDP 항목이 없습니다. 점수를 먼저 계산해주세요.', 'warning');
    }
    _activeTab = 'all';
    _renderContent();
  } catch (err) {
    console.warn('[IDP] Generate failed:', err);
    showToast('IDP 생성 중 오류가 발생했습니다.', 'error');
  } finally {
    _generating = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }
}

// ── Event binding ──────────────────────────────────────────────

function _bindShellEvents(root) {
  // Generate button
  root.querySelector('#generate-btn')?.addEventListener('click', _handleGenerate);

  // Tab bar (initial binding)
  root.querySelector('#priority-tabs')?.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeTab = btn.dataset.tab;
      _renderTabBar();
      _renderCards();
    });
  });

  // CSV export
  root.querySelector('#idp-csv-btn')?.addEventListener('click', () => {
    if (!_items.length) return;
    const BOM = '﻿';
    const header = '역량명,우선순위,상태,목표일,학습방법\n';
    const rows = _items.map(i => {
      const name   = (i.competency_name_ko || i.competency_name || '').replace(/"/g, '""');
      const prio   = i.priority || '';
      const status = i.status || '';
      const date   = i.target_date ? i.target_date.slice(0, 10) : '';
      const method = (i.learning_method || i.action_type || '').replace(/"/g, '""');
      return `"${name}",${prio},${status},${date},"${method}"`;
    }).join('\n');
    const blob = new Blob([BOM + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'idp_items.csv' });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

// ── Utilities ──────────────────────────────────────────────────

function _dueBadge(dateStr, status) {
  if (!dateStr || status === 'completed') return '';
  try {
    const deadline = new Date(dateStr);
    if (isNaN(deadline)) return '';
    const days = Math.ceil((deadline.getTime() - Date.now()) / 86400000);
    if (days < 0)   return `<span style="font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:20px;background:#FEF2F2;color:#DC2626;white-space:nowrap">🔴 D+${Math.abs(days)} 초과</span>`;
    if (days <= 7)  return `<span style="font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:20px;background:#FFF7ED;color:#C2410C;white-space:nowrap">⚠️ D-${days} 임박</span>`;
    if (days <= 30) return `<span style="font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:20px;background:#FFFBEB;color:#D97706;white-space:nowrap">⏰ D-${days}</span>`;
    return '';
  } catch { return ''; }
}

function _formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  } catch {
    return dateStr;
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
