/**
 * config_mgmt.js – Config Management (Settings Library) admin page
 * HR Competency OS
 *
 * Lets HR admins view and understand the 7 config module types.
 */

import { getUser }    from '../../auth.js';
import { showToast }  from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

// ── Module-level state ────────────────────────────────────────
let _root    = null;
let _orgId   = null;
let _orgName = '';
let _activeTab = 'scale';
let _configs = {};        // keyed by type, each value is array of config records
let _expandedIds = new Set();

// ── Tab definitions ───────────────────────────────────────────
const TABS = [
  {
    key:   'scale',
    label: '척도 설정',
    type:  'scale',
    icon:  '📏',
    sidebarTitle: '척도 설정 (Scale)',
    sidebarDesc:
      '평가 문항에 사용되는 척도를 정의합니다. 몇 점 척도를 사용할지, 각 점수의 레이블(예: 매우 미흡 ~ 매우 우수)과 의미를 설정합니다. 척도는 점수 산출과 결과 해석의 기준이 됩니다.',
  },
  {
    key:   'policy',
    label: '진단자 정책',
    type:  'policy',
    icon:  '👥',
    sidebarTitle: '진단자 정책 (Evaluator Policy)',
    sidebarDesc:
      '평가에 참여하는 진단자 유형(자기 평가·상사·동료·부하·HR 등)을 정의합니다. 각 역할별 필수 여부, 최소/최대 인원, 익명 여부 등을 설정합니다.',
  },
  {
    key:   'workflow',
    label: '워크플로우',
    type:  'workflow',
    icon:  '🔄',
    sidebarTitle: '워크플로우 (Workflow)',
    sidebarDesc:
      '평가 진행의 단계별 흐름을 정의합니다. 자가 평가 → 상사 평가 → HR 검토 → 결과 공개 등 단계 이름, 순서, 담당자, 알림 규칙을 설정합니다.',
  },
  {
    key:   'weight',
    label: '가중치',
    type:  'weight',
    icon:  '⚖️',
    sidebarTitle: '가중치 설정 (Weight)',
    sidebarDesc:
      '최종 점수 산출 시 각 진단자 유형(자가·상사·동료 등)의 반영 비율을 정의합니다. 예: 자가 20% + 상사 50% + 동료 30%. 역량 카테고리별 가중치도 설정 가능합니다.',
  },
  {
    key:   'calibration',
    label: '보정 규칙',
    type:  'calibration',
    icon:  '🎛️',
    sidebarTitle: '보정 규칙 (Calibration)',
    sidebarDesc:
      '평가자 간 점수 편차를 줄이기 위한 보정(Calibration) 방식을 정의합니다. 강제 배분법, 편차 조정, 정규화 등 다양한 방법 중 사용 방식을 선택·설정합니다.',
  },
  {
    key:   'evidence',
    label: '증빙 규칙',
    type:  'evidence',
    icon:  '📎',
    sidebarTitle: '증빙 규칙 (Evidence)',
    sidebarDesc:
      '평가 결과를 뒷받침하는 증빙 자료 첨부 규칙을 정의합니다. 어떤 조건(예: 점수 상위/하위 N%)에서 증빙을 요구할지, 허용 파일 형식과 크기 제한 등을 설정합니다.',
  },
  {
    key:   'scoring',
    label: '채점 규칙',
    type:  'scoring',
    icon:  '🧮',
    sidebarTitle: '채점 규칙 (Scoring)',
    sidebarDesc:
      '점수를 계산하는 알고리즘과 집계 방식을 정의합니다. 평균·가중평균·최빈값 등의 집계 방법, 문항별 점수 반영 방식, 결측값 처리 정책 등을 설정합니다.',
  },
];

// ── Preview field parsers (one per tab type) ──────────────────

function buildPreviewFields(type, cfg) {
  if (!cfg) return [];
  try {
    switch (type) {
      case 'scale': {
        const points = cfg.points ?? cfg.scale_points ?? cfg.max_score ?? null;
        const labels = cfg.labels || cfg.scale_labels || [];
        const preview = [];
        if (points != null) preview.push({ key: '척도', val: `${points}점 척도` });
        if (Array.isArray(labels) && labels.length) {
          const sample = labels
            .slice(0, 3)
            .map(l => String(l?.label || l?.name || l || ''))
            .filter(Boolean)
            .join(' · ');
          if (sample) preview.push({ key: '레이블 예시', val: sample });
        }
        return preview;
      }

      case 'policy': {
        const types = cfg.evaluator_types || cfg.types || cfg.roles || [];
        if (Array.isArray(types) && types.length) {
          return [{ key: '진단자 유형', val: types.map(t => String(t?.name || t)).join(', ') }];
        }
        return [];
      }

      case 'workflow': {
        const steps = cfg.steps || cfg.workflow_steps || [];
        const count = steps.length;
        if (!count) return [];
        const firstName = steps[0]?.name || steps[0]?.step || String(steps[0] || '');
        const lastName  = steps[count - 1]?.name || steps[count - 1]?.step || String(steps[count - 1] || '');
        const preview = [{ key: '단계 수', val: `${count}단계` }];
        if (firstName) preview.push({ key: '시작 단계', val: firstName });
        if (lastName && lastName !== firstName) preview.push({ key: '종료 단계', val: lastName });
        return preview;
      }

      case 'weight': {
        const w       = cfg.weights || cfg;
        const self    = w.self    ?? w.self_weight    ?? null;
        const manager = w.manager ?? w.manager_weight ?? null;
        const peer    = w.peer    ?? w.peer_weight    ?? null;
        const preview = [];
        if (self    != null) preview.push({ key: '자가',   val: `${self}%`    });
        if (manager != null) preview.push({ key: '상사',   val: `${manager}%` });
        if (peer    != null) preview.push({ key: '동료',   val: `${peer}%`    });
        return preview;
      }

      case 'calibration': {
        const method = cfg.method || cfg.calibration_method || cfg.type || '';
        return method ? [{ key: '보정 방식', val: String(method) }] : [];
      }

      case 'evidence': {
        const conditions = cfg.conditions || cfg.triggers || cfg.rules || [];
        const count = Array.isArray(conditions) ? conditions.length : 0;
        return count ? [{ key: '조건 수', val: `${count}개 트리거 조건` }] : [];
      }

      case 'scoring': {
        const method = cfg.method || cfg.scoring_method || cfg.algorithm || '';
        return method ? [{ key: '채점 방식', val: String(method) }] : [];
      }

      default:
        return [];
    }
  } catch {
    return [];
  }
}

// ── Mount / Unmount ───────────────────────────────────────────

export async function mount(container) {
  _root    = container;
  const user = getUser();
  _orgId   = user?.org_id || user?.organization_id || null;
  _orgName = user?.org_name || user?.organization_name || '내 조직';
  _activeTab   = 'scale';
  _expandedIds = new Set();
  _configs     = {};

  renderShell(container);
  await loadTabData(_activeTab);
}

export function unmount() {
  _root        = null;
  _orgId       = null;
  _orgName     = '';
  _activeTab   = 'scale';
  _expandedIds = new Set();
  _configs     = {};
}

// ── Shell ─────────────────────────────────────────────────────

function renderShell(container) {
  const activeTabDef = TABS.find(t => t.key === _activeTab) || TABS[0];

  container.innerHTML = `
    <div class="page cm-page" style="min-height:100vh;background:var(--bg);font-family:var(--font-ko)">

      <!-- Top bar -->
      <div class="top-bar" style="
        background:var(--surface);
        border-bottom:1px solid var(--border);
        padding:0 16px;
        height:56px;
        display:flex;
        align-items:center;
        gap:12px;
        position:sticky;top:0;z-index:100;
      ">
        <button id="cm-back-btn" class="btn btn-ghost btn-sm" aria-label="뒤로가기"
                style="display:flex;align-items:center;gap:4px;padding:6px 10px">
          ← 뒤로
        </button>
        <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0">
          <span style="color:var(--text-muted);font-size:13px">${escapeHtml(_orgName)}</span>
          <span style="color:var(--text-muted)">›</span>
          <span style="font-size:15px;font-weight:700;color:var(--text)">설정 라이브러리</span>
        </div>
      </div>

      <!-- Tab row -->
      <div id="cm-tabs" style="
        background:var(--surface);
        border-bottom:1px solid var(--border);
        overflow-x:auto;
        -webkit-overflow-scrolling:touch;
        scrollbar-width:none;
        white-space:nowrap;
        padding:0 12px;
        display:flex;
        gap:2px;
      ">
        ${TABS.map(tab => renderTabButton(tab)).join('')}
      </div>

      <!-- Main content: sidebar + list -->
      <div style="display:flex;gap:0;min-height:calc(100vh - 56px - 52px)">

        <!-- Content area -->
        <div id="cm-content" style="flex:1;min-width:0;padding:20px 16px 48px;overflow-y:auto">
          ${renderSkeletonCards(3)}
        </div>

        <!-- Sidebar -->
        <aside id="cm-sidebar" style="
          width:240px;
          min-width:240px;
          background:var(--surface);
          border-left:1px solid var(--border);
          padding:20px 16px;
          overflow-y:auto;
          display:flex;
          flex-direction:column;
          gap:0;
        ">
          ${renderSidebar(activeTabDef)}
        </aside>

      </div>

      <style>
        .cm-tab-btn {
          display:inline-flex;
          align-items:center;
          gap:5px;
          padding:14px 14px 12px;
          font-size:13px;
          font-weight:500;
          color:var(--text-muted);
          background:transparent;
          border:none;
          border-bottom:2px solid transparent;
          cursor:pointer;
          white-space:nowrap;
          transition:color var(--transition-fast),border-color var(--transition-fast);
          font-family:var(--font-ko);
        }
        .cm-tab-btn:hover { color:var(--text); }
        .cm-tab-btn.active {
          color:var(--primary);
          border-bottom-color:var(--primary);
          font-weight:700;
        }
        .cm-config-card {
          background:var(--surface);
          border:1.5px solid var(--border);
          border-radius:var(--radius-md);
          margin-bottom:12px;
          overflow:hidden;
          transition:box-shadow var(--transition-fast),border-color var(--transition-fast);
        }
        .cm-config-card:hover {
          box-shadow:var(--shadow-md);
          border-color:var(--primary-light);
        }
        .cm-config-card-header {
          display:flex;
          align-items:flex-start;
          gap:12px;
          padding:14px 16px;
          cursor:pointer;
        }
        .cm-config-card-meta {
          flex:1;min-width:0;
        }
        .cm-config-card-name {
          font-size:14px;font-weight:700;color:var(--text);
          margin-bottom:4px;
        }
        .cm-config-card-desc {
          font-size:13px;color:var(--text-muted);line-height:1.5;
        }
        .cm-preview-pills {
          display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;
        }
        .cm-preview-pill {
          display:inline-flex;align-items:center;gap:4px;
          padding:3px 9px;border-radius:var(--radius-full);
          background:#EEF2FF;color:var(--primary);
          font-size:11px;font-weight:600;
        }
        .cm-preview-pill .pill-key { color:var(--text-muted);font-weight:500; }
        .cm-json-toggle {
          display:inline-flex;align-items:center;gap:4px;
          padding:4px 10px;
          border:1px solid var(--border);
          border-radius:var(--radius-full);
          background:transparent;
          font-size:11px;color:var(--text-muted);
          cursor:pointer;margin-top:8px;
          transition:background var(--transition-fast),color var(--transition-fast);
          font-family:var(--font-ko);
        }
        .cm-json-toggle:hover { background:#F1F5F9;color:var(--text); }
        .cm-json-block {
          background:#1E293B;
          color:#E2E8F0;
          padding:14px 16px;
          font-size:12px;
          font-family:'JetBrains Mono','Fira Code','Courier New',monospace;
          overflow-x:auto;
          border-top:1px solid var(--border);
          line-height:1.6;
          white-space:pre;
        }
        .cm-sidebar-title {
          font-size:13px;font-weight:700;color:var(--text);
          margin-bottom:8px;
          padding-bottom:8px;
          border-bottom:1px solid var(--border);
        }
        .cm-sidebar-desc {
          font-size:13px;color:var(--text-muted);line-height:1.7;
        }
        .cm-sidebar-all {
          margin-top:20px;
          padding-top:16px;
          border-top:1px solid var(--border);
        }
        .cm-sidebar-all-item {
          display:flex;align-items:flex-start;gap:8px;
          padding:7px 0;
          font-size:12px;
          color:var(--text-muted);
          cursor:pointer;
          border-radius:var(--radius-sm);
          transition:color var(--transition-fast);
        }
        .cm-sidebar-all-item:hover { color:var(--primary); }
        .cm-sidebar-all-item.current { color:var(--primary);font-weight:600; }
        @media (max-width: 720px) {
          #cm-sidebar { display:none !important; }
        }
        @media (max-width: 480px) {
          .cm-tab-btn { padding:12px 10px; font-size:12px; }
        }
      </style>
    </div>
  `;

  bindShellEvents();
}

function renderTabButton(tab) {
  const isActive = tab.key === _activeTab;
  return `
    <button class="cm-tab-btn${isActive ? ' active' : ''}"
            data-tab-key="${tab.key}"
            aria-selected="${isActive}"
            aria-label="${tab.label} 탭">
      <span aria-hidden="true">${tab.icon}</span>
      ${escapeHtml(tab.label)}
    </button>`;
}

function renderSidebar(tabDef) {
  if (!tabDef) return '';
  return `
    <div>
      <div class="cm-sidebar-title">${escapeHtml(tabDef.sidebarTitle)}</div>
      <div class="cm-sidebar-desc">${escapeHtml(tabDef.sidebarDesc)}</div>
    </div>
    <div class="cm-sidebar-all">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);
                  text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">
        모든 설정 유형
      </div>
      ${TABS.map(t => `
        <div class="cm-sidebar-all-item${t.key === _activeTab ? ' current' : ''}"
             data-sidebar-tab="${t.key}"
             role="button" tabindex="0"
             aria-label="${t.label} 탭으로 이동">
          <span>${t.icon}</span>
          <span>${escapeHtml(t.label)}</span>
        </div>`).join('')}
    </div>`;
}

// ── Events ────────────────────────────────────────────────────

function bindShellEvents() {
  _root?.querySelector('#cm-back-btn')?.addEventListener('click', () => {
    window.location.hash = '#/dashboard';
  });

  // Tab clicks
  _root?.querySelectorAll('.cm-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tabKey));
  });
}

function rebindSidebarEvents() {
  _root?.querySelectorAll('[data-sidebar-tab]').forEach(el => {
    const activate = () => switchTab(el.dataset.sidebarTab);
    el.addEventListener('click', activate);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') activate(); });
  });
}

async function switchTab(key) {
  if (key === _activeTab) return;
  _activeTab = key;
  _expandedIds = new Set();

  // Update tab button states
  _root?.querySelectorAll('.cm-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tabKey === key);
  });

  // Update sidebar
  const sidebarEl = _root?.querySelector('#cm-sidebar');
  const tabDef    = TABS.find(t => t.key === key);
  if (sidebarEl && tabDef) {
    sidebarEl.innerHTML = renderSidebar(tabDef);
    rebindSidebarEvents();
  }

  // Show loading
  const contentEl = _root?.querySelector('#cm-content');
  if (contentEl) contentEl.innerHTML = renderSkeletonCards(3);

  await loadTabData(key);
}

// ── Data loading ──────────────────────────────────────────────

async function loadTabData(type) {
  if (!_orgId) {
    renderContentError('조직 정보를 찾을 수 없습니다.');
    return;
  }

  // Return cached data if available
  if (_configs[type]) {
    renderConfigCards(type, _configs[type]);
    return;
  }

  try {
    const token   = localStorage.getItem('token');
    const res     = await fetch(`/api/org/${_orgId}/configs?type=${type}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    let items = [];
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        items = await res.json();
      }
    } else if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.hash = '#/login';
      return;
    }

    _configs[type] = Array.isArray(items) ? items : [];
    renderConfigCards(type, _configs[type]);
  } catch (err) {
    console.error(`[ConfigMgmt] Load error for type=${type}:`, err);
    _configs[type] = [];
    showToast(err.message || '데이터를 불러오는 중 오류가 발생했습니다.', 'error');
    renderContentError('데이터를 불러오는 중 오류가 발생했습니다.');
  }
}

// ── Content render ────────────────────────────────────────────

function renderConfigCards(type, items) {
  const contentEl = _root?.querySelector('#cm-content');
  if (!contentEl) return;

  // Guard: if tab has switched while loading, discard
  if (_activeTab !== type) return;

  const tabDef = TABS.find(t => t.type === type);

  if (!items || !items.length) {
    contentEl.innerHTML = `
      <div style="text-align:center;padding:56px 20px;color:var(--text-muted)">
        <div style="font-size:40px;margin-bottom:12px">${tabDef?.icon || '📦'}</div>
        <div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:6px">
          ${escapeHtml(tabDef?.label || type)} 설정이 없습니다
        </div>
        <div style="font-size:13px">아직 등록된 설정이 없습니다.</div>
      </div>`;
    return;
  }

  contentEl.innerHTML = `
    <div style="max-width:680px">
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
        ${escapeHtml(tabDef?.label || type)} · 총 ${items.length}개
      </div>
      ${items.map(item => renderConfigCard(type, item)).join('')}
    </div>`;

  // Bind JSON toggle buttons
  contentEl.querySelectorAll('.cm-json-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id      = btn.dataset.configId;
      const jsonEl  = contentEl.querySelector(`#cm-json-${id}`);
      const expanded = _expandedIds.has(id);
      if (expanded) {
        _expandedIds.delete(id);
        if (jsonEl) jsonEl.style.display = 'none';
        btn.textContent = 'JSON 보기 ▾';
      } else {
        _expandedIds.add(id);
        if (jsonEl) jsonEl.style.display = 'block';
        btn.textContent = 'JSON 닫기 ▴';
      }
    });
  });
}

function renderConfigCard(type, item) {
  const id       = String(item.id || item.config_id || Math.random().toString(36).slice(2));
  const nameKo   = item.name_ko || item.name || `설정 #${id}`;
  const desc     = item.description || item.desc || '';
  const rawJson  = item.config_json;
  const cfg      = tryParseJson(rawJson);

  const previewFields = buildPreviewFields(type, cfg);
  const isExpanded    = _expandedIds.has(id);
  const prettyJson    = cfg
    ? JSON.stringify(cfg, null, 2)
    : (typeof rawJson === 'string' ? rawJson : '(없음)');

  return `
    <div class="cm-config-card">
      <div class="cm-config-card-header">
        <div class="cm-config-card-meta">
          <div class="cm-config-card-name">${escapeHtml(nameKo)}</div>
          ${desc ? `<div class="cm-config-card-desc">${escapeHtml(desc)}</div>` : ''}

          ${previewFields.length ? `
            <div class="cm-preview-pills">
              ${previewFields.map(f => `
                <div class="cm-preview-pill">
                  <span class="pill-key">${escapeHtml(f.key)}</span>
                  <span>${escapeHtml(String(f.val))}</span>
                </div>`).join('')}
            </div>` : ''}

          <button class="cm-json-toggle"
                  data-config-id="${escapeHtml(id)}"
                  aria-expanded="${isExpanded}"
                  aria-label="JSON 원본 보기">
            ${isExpanded ? 'JSON 닫기 ▴' : 'JSON 보기 ▾'}
          </button>
        </div>
      </div>

      <div id="cm-json-${escapeHtml(id)}" class="cm-json-block"
           style="${isExpanded ? '' : 'display:none'}">${escapeHtml(prettyJson)}</div>
    </div>`;
}

// ── Helpers ───────────────────────────────────────────────────

function renderSkeletonCards(n) {
  return `<div style="max-width:680px">${Array(n).fill(0).map(() => `
    <div style="
      background:var(--surface);border:1.5px solid var(--border);
      border-radius:var(--radius-md);padding:16px;margin-bottom:12px;
    ">
      <div class="skeleton" style="height:18px;width:45%;border-radius:4px;margin-bottom:8px"></div>
      <div class="skeleton" style="height:13px;width:75%;border-radius:4px;margin-bottom:6px"></div>
      <div class="skeleton" style="height:13px;width:55%;border-radius:4px"></div>
    </div>`).join('')}</div>`;
}

function renderContentError(message) {
  const contentEl = _root?.querySelector('#cm-content');
  if (!contentEl) return;
  contentEl.innerHTML = `
    <div style="text-align:center;padding:56px 20px;color:var(--text-muted)">
      <div style="font-size:32px;margin-bottom:12px">⚠️</div>
      <div style="font-size:14px;color:var(--text)">${escapeHtml(message)}</div>
    </div>`;
}

function tryParseJson(val) {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return null; }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
