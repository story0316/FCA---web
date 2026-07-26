/**
 * template_builder.js – Template Builder admin page
 * HR Competency OS
 *
 * Lets HR admins compose Assessment Templates from modular config pieces.
 */

import { api }        from '../../api.js';
import { getUser }    from '../../auth.js';
import { showToast }  from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

// ── Module-level state ────────────────────────────────────────
let _root       = null;
let _orgId      = null;
let _orgName    = '';
let _templates  = [];
let _families   = [];
let _competencies = [];
let _configs    = {};        // keyed by type: scale|policy|workflow|weight|calibration
let _selectedTemplateId = null;
let _isReadOnly = false;
let _previewOpen = false;

// ── Purpose map ───────────────────────────────────────────────
const PURPOSE_OPTIONS = [
  { value: 'hire',        label: '채용심사' },
  { value: 'onboarding',  label: '온보딩' },
  { value: 'review',      label: '정기평가' },
  { value: 'promotion',   label: '승진심사' },
  { value: 'leadership',  label: '리더십' },
  { value: 'rotation',    label: '순환배치' },
  { value: 'tna',         label: 'TNA' },
  { value: 'succession',  label: '승계' },
];

const PURPOSE_BADGE_COLORS = {
  hire:       '#4F46E5',
  onboarding: '#10B981',
  review:     '#F59E0B',
  promotion:  '#EF4444',
  leadership: '#8B5CF6',
  rotation:   '#3B82F6',
  tna:        '#06B6D4',
  succession: '#EC4899',
};

const LEVEL_OPTIONS = [
  { value: 'L1', label: 'L1' },
  { value: 'L2', label: 'L2' },
  { value: 'L3', label: 'L3' },
];

const CATEGORY_LABELS = {
  core:       '핵심역량',
  leadership: '리더십역량',
  functional: '직무역량',
  future:     '미래역량',
};

const CATEGORY_COLORS = {
  core:       '#4F46E5',
  leadership: '#8B5CF6',
  functional: '#10B981',
  future:     '#F59E0B',
};

const CONFIG_TYPES = [
  { key: 'scale',       label: '척도 설정',      field: 'scale_config_id'       },
  { key: 'policy',      label: '진단자 정책',     field: 'evaluator_policy_id'   },
  { key: 'workflow',    label: '워크플로우',      field: 'workflow_config_id'    },
  { key: 'weight',      label: '가중치 설정',     field: 'weight_config_id'      },
  { key: 'calibration', label: '보정 설정',       field: 'calibration_config_id' },
];

// ── Mount / Unmount ───────────────────────────────────────────

export async function mount(container) {
  _root = container;
  const user = getUser();
  _orgId   = user?.org_id || user?.organization_id || null;
  _orgName = user?.org_name || user?.organization_name || '내 조직';

  renderShell(container);
  await loadAllData();
}

export function unmount() {
  _root            = null;
  _orgId           = null;
  _orgName         = '';
  _templates       = [];
  _families        = [];
  _competencies    = [];
  _configs         = {
  _selectedTemplateId = null;
};
  _selectedTemplateId = null;
  _isReadOnly      = false;
}

// ── Shell render (skeleton before data) ──────────────────────

function renderShell(container) {
  container.innerHTML = `
    <div class="page tb-page" style="min-height:100vh;background:var(--bg);font-family:var(--font-ko)">

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
        <button id="tb-back-btn" class="btn btn-ghost btn-sm" aria-label="뒤로가기"
                style="display:flex;align-items:center;gap:4px;padding:6px 10px">
          ← 뒤로
        </button>
        <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0">
          <span style="color:var(--text-muted);font-size:13px">${escapeHtml(_orgName)}</span>
          <span style="color:var(--text-muted)">›</span>
          <span style="font-size:15px;font-weight:700;color:var(--text)">템플릿 빌더</span>
        </div>
      </div>

      <!-- Two-column body -->
      <div id="tb-body" style="
        display:flex;
        gap:0;
        min-height:calc(100vh - 56px);
      ">

        <!-- LEFT: template list -->
        <aside id="tb-left" style="
          width:260px;
          min-width:260px;
          background:var(--surface);
          border-right:1px solid var(--border);
          display:flex;
          flex-direction:column;
          overflow:hidden;
        ">
          <div style="padding:14px 16px 10px;border-bottom:1px solid var(--border)">
            <div style="font-size:13px;font-weight:600;color:var(--text-muted);text-transform:uppercase;
                        letter-spacing:.05em;margin-bottom:10px">기존 템플릿</div>
            <button id="tb-new-btn" class="btn btn-primary" style="width:100%;font-size:13px;padding:8px">
              + 새 템플릿
            </button>
          </div>
          <div id="tb-template-list" style="flex:1;overflow-y:auto;padding:8px 0">
            ${renderSkeletonList(4)}
          </div>
        </aside>

        <!-- RIGHT: config form -->
        <main id="tb-right" style="flex:1;min-width:0;overflow-y:auto;padding:24px 20px 48px">
          <div id="tb-form-area">
            ${renderEmptyFormPrompt()}
          </div>
        </main>

      </div>

      <!-- Template preview modal (assembled surface) -->
      <div id="tb-preview-backdrop" style="display:none;position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:1000"></div>
      <div id="tb-preview-modal" style="display:none;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);
        width:min(960px, calc(100vw - 24px)); max-height:min(84vh, 760px); overflow:hidden; z-index:1001;
        background:var(--surface); border:1px solid var(--border); border-radius:12px; box-shadow:0 16px 48px rgba(0,0,0,0.25);
      "></div>

      <!-- Mobile responsive style -->
      <style>
        @media (max-width: 640px) {
          #tb-body { flex-direction: column !important; }
          #tb-left {
            width: 100% !important;
            min-width: unset !important;
            border-right: none !important;
            border-bottom: 1px solid var(--border);
            max-height: 220px;
          }
        }
        .tb-template-item {
          display:flex;
          flex-direction:column;
          gap:4px;
          padding:10px 14px;
          cursor:pointer;
          border-radius:var(--radius-sm);
          margin:2px 8px;
          transition:background var(--transition-fast);
          border:1.5px solid transparent;
        }
        .tb-template-item:hover { background:#F1F5F9; }
        .tb-template-item.selected {
          background:#EEF2FF;
          border-color:var(--primary-light);
        }
        .tb-form-section {
          margin-bottom:24px;
        }
        .tb-form-section-title {
          font-size:12px;
          font-weight:700;
          color:var(--text-muted);
          text-transform:uppercase;
          letter-spacing:.06em;
          margin-bottom:10px;
          padding-bottom:6px;
          border-bottom:1px solid var(--border);
        }
        .tb-field { margin-bottom:16px; }
        .tb-label {
          display:block;
          font-size:13px;
          font-weight:600;
          color:var(--text);
          margin-bottom:6px;
        }
        .tb-input, .tb-select {
          width:100%;
          padding:9px 12px;
          border:1.5px solid var(--border);
          border-radius:var(--radius-sm);
          font-size:14px;
          color:var(--text);
          background:var(--surface);
          box-sizing:border-box;
          transition:border-color var(--transition-fast);
          font-family:var(--font-ko);
        }
        .tb-input:focus, .tb-select:focus {
          outline:none;
          border-color:var(--primary);
          box-shadow:0 0 0 3px rgba(79,70,229,.12);
        }
        .tb-radio-card {
          display:flex;
          align-items:flex-start;
          gap:10px;
          padding:10px 12px;
          border:1.5px solid var(--border);
          border-radius:var(--radius-sm);
          cursor:pointer;
          margin-bottom:6px;
          transition:border-color var(--transition-fast),background var(--transition-fast);
          background:var(--surface);
        }
        .tb-radio-card:hover { background:#F8FAFC; }
        .tb-radio-card.checked {
          border-color:var(--primary);
          background:#EEF2FF;
        }
        .tb-radio-card input[type=radio] { margin-top:2px;accent-color:var(--primary); }
        .tb-comp-group { margin-bottom:12px; }
        .tb-comp-group-label {
          font-size:11px;
          font-weight:700;
          text-transform:uppercase;
          letter-spacing:.07em;
          margin-bottom:6px;
          padding:3px 8px;
          border-radius:var(--radius-sm);
          display:inline-block;
          color:#fff;
        }
        .tb-comp-item {
          display:flex;
          align-items:center;
          gap:8px;
          padding:6px 10px;
          border-radius:var(--radius-sm);
          cursor:pointer;
          transition:background var(--transition-fast);
        }
        .tb-comp-item:hover { background:#F1F5F9; }
        .tb-comp-item input[type=checkbox] { accent-color:var(--primary);width:16px;height:16px; }
        .tb-badge {
          display:inline-block;
          font-size:10px;
          font-weight:600;
          padding:2px 7px;
          border-radius:var(--radius-full);
          color:#fff;
          vertical-align:middle;
        }
        .tb-readonly-banner {
          display:flex;
          align-items:center;
          gap:10px;
          padding:10px 14px;
          background:#FFF7ED;
          border:1px solid #FED7AA;
          border-radius:var(--radius-sm);
          margin-bottom:16px;
          font-size:13px;
          color:#92400E;
        }
      </style>
    </div>
  `;

  // Bind static events
  _root.querySelector('#tb-back-btn')?.addEventListener('click', () => {
    window.location.hash = '#/dashboard';
  });
  _root.querySelector('#tb-new-btn')?.addEventListener('click', () => {
    startNewTemplate();
  });
}

function openPreviewModal(html) {
  const back = document.getElementById('tb-preview-backdrop');
  const modal = document.getElementById('tb-preview-modal');
  if (!back || !modal) return;
  _previewOpen = true;
  back.style.display = 'block';
  modal.style.display = 'block';
  modal.innerHTML = html;
  back.onclick = () => closePreviewModal();
}

function closePreviewModal() {
  const back = document.getElementById('tb-preview-backdrop');
  const modal = document.getElementById('tb-preview-modal');
  _previewOpen = false;
  if (back) back.style.display = 'none';
  if (modal) { modal.style.display = 'none'; modal.innerHTML = ''; }
}

function isLocalBackend() {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

function fmtCfgName(cfg) {
  if (!cfg) return '—';
  return escapeHtml(cfg.name_ko || cfg.name || cfg.id || '—');
}

function renderPreviewModal(data) {
  const t = data?.template || {};
  const cfg = data?.configs || {};
  const comps = data?.competencies || [];

  const level = t.target_level_code ? escapeHtml(t.target_level_code) : 'ALL';
  const purpose = t.purpose ? escapeHtml(String(t.purpose)) : '—';

  const header = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);gap:12px">
      <div style="min-width:0">
        <div style="font-weight:800;color:var(--text);font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${escapeHtml(t.name_ko || '템플릿 미리보기')}
        </div>
        <div style="margin-top:2px;font-size:12px;color:var(--text-muted)">
          purpose=${purpose} · level=${level} · competencies=${comps.length}
        </div>
      </div>
      <button id="tb-preview-close" class="btn btn-ghost btn-sm" style="min-width:72px">닫기</button>
    </div>
  `;

  const cfgGrid = `
    <div style="padding:14px 16px;border-bottom:1px solid var(--border);background:var(--surface-alt,#F8FAFC)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="card" style="padding:12px;border-radius:10px">
          <div style="font-size:11px;color:var(--text-muted);font-weight:700;margin-bottom:4px">Scale</div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">${fmtCfgName(cfg.scale)}</div>
        </div>
        <div class="card" style="padding:12px;border-radius:10px">
          <div style="font-size:11px;color:var(--text-muted);font-weight:700;margin-bottom:4px">Evaluator</div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">${fmtCfgName(cfg.evaluator_policy)}</div>
        </div>
        <div class="card" style="padding:12px;border-radius:10px">
          <div style="font-size:11px;color:var(--text-muted);font-weight:700;margin-bottom:4px">Workflow</div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">${fmtCfgName(cfg.workflow)}</div>
        </div>
        <div class="card" style="padding:12px;border-radius:10px">
          <div style="font-size:11px;color:var(--text-muted);font-weight:700;margin-bottom:4px">Scoring</div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">${fmtCfgName(cfg.scoring)}</div>
        </div>
      </div>
    </div>
  `;

  const body = `
    <div style="overflow:auto;max-height:calc(min(84vh, 760px) - 128px)">
      <div style="padding:14px 16px">
        <div style="font-size:12px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Competencies</div>
        ${comps.map(c => {
          const inds = c.indicators || [];
          const subtitle = inds.length ? `${inds.length} indicators` : 'no indicators';
          const sample = inds.slice(0, 2).map(i => `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">• ${escapeHtml(i.indicator_ko || '')}</div>`).join('');
          return `
            <div class="card" style="padding:12px 12px;margin-bottom:10px;border-radius:10px">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
                <div style="min-width:0">
                  <div style="font-weight:800;color:var(--text);font-size:13px">${escapeHtml(c.name_ko || c.name || c.id)}</div>
                  <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${escapeHtml(c.category || '')} · ${subtitle}</div>
                </div>
                <div style="flex-shrink:0;font-size:11px;color:var(--text-muted)">${escapeHtml(c.org_id || '')}</div>
              </div>
              ${sample}
              ${inds.length > 2 ? `<div style="font-size:11px;color:var(--primary);margin-top:6px">+ ${inds.length - 2} more</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  openPreviewModal(header + cfgGrid + body);
  document.getElementById('tb-preview-close')?.addEventListener('click', () => closePreviewModal());
}

async function openTemplatePreview(tmpl) {
  const templateId = tmpl?.id || _selectedTemplateId;
  if (!templateId) {
    showToast('템플릿을 먼저 선택해 주세요.', 'error');
    return;
  }

  if (!isLocalBackend()) {
    showToast('조립 미리보기는 로컬 서버에서만 지원합니다.', 'error');
    return;
  }

  const token = localStorage.getItem('hr_token');
  if (!token || token === 'demo-token') {
    showToast('데모 모드에서는 서버 기반 미리보기를 사용할 수 없습니다.', 'error');
    return;
  }

  try {
    const back = document.getElementById('tb-preview-backdrop');
    const modal = document.getElementById('tb-preview-modal');
    if (back && modal) {
      back.style.display = 'block';
      modal.style.display = 'block';
      modal.innerHTML = `<div style=\"padding:18px;color:var(--text-muted)\">불러오는 중...</div>`;
      back.onclick = () => closePreviewModal();
    }

    const r = await fetch(`/api/templates/${encodeURIComponent(templateId)}/preview`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!r.ok) throw new Error(await r.text());
    const d = await r.json();
    renderPreviewModal(d);
  } catch (e) {
    closePreviewModal();
    showToast('미리보기 로드 실패', 'error');
  }
}

// ── Demo fallback data ────────────────────────────────────────

const DEMO_TEMPLATES_TB = [
  { id:'TPL_001', name_ko:'일반 직원 역량 평가', purpose:'review',
    target_level_code:'L1', target_family_id:'FAM_COMMON',
    competency_set:['COMP_CORE_AI','COMP_CORE_DATA','COMP_CORE_COMM','COMP_CORE_LEAD','COMP_CORE_PROB'],
    scale_config_id:'SCL_5PT', evaluator_policy_id:'POL_SELF', workflow_config_id:'WF_BASIC',
    weight_config_id:'WGT_EQUAL', calibration_config_id:'CAL_NONE',
    description_ko:'전 직원 공통 핵심 역량 + 직무 역량을 평가합니다.' },
  { id:'TPL_002', name_ko:'HR 전문가 역량 평가', purpose:'review',
    target_level_code:'L2', target_family_id:'FAM_HR',
    competency_set:['COMP_CORE_AI','COMP_CORE_DATA','COMP_CORE_COMM','COMP_CORE_LEAD','COMP_CORE_PROB','COMP_FUNC_OD','COMP_FUNC_TA','COMP_FUTURE_AI'],
    scale_config_id:'SCL_5PT', evaluator_policy_id:'POL_360', workflow_config_id:'WF_FULL',
    weight_config_id:'WGT_MGMT', calibration_config_id:'CAL_BASIC',
    description_ko:'HR 직군의 핵심 역량 및 미래 역량을 평가합니다.' },
];

const DEMO_COMPETENCIES_TB = [
  { id:'COMP_CORE_AI',   category:'core',       name_ko:'AI 활용 능력',  ability_ko:'AI 솔루션 설계 및 적용',    skill_ko:'모델 파인튜닝 및 파이프라인 설계', knowledge_ko:'머신러닝 알고리즘 이해' },
  { id:'COMP_CORE_DATA', category:'core',       name_ko:'데이터 분석',   ability_ko:'고급 데이터 모델링',         skill_ko:'SQL/Python 활용',              knowledge_ko:'예측 분석 기법' },
  { id:'COMP_CORE_COMM', category:'core',       name_ko:'커뮤니케이션',  ability_ko:'다양한 이해관계자 설득',      skill_ko:'협상 및 퍼실리테이션',          knowledge_ko:'설득 커뮤니케이션 이론' },
  { id:'COMP_CORE_LEAD', category:'leadership', name_ko:'리더십',        ability_ko:'팀 목표 설정 및 관리',       skill_ko:'성과 관리 및 코칭',             knowledge_ko:'팀 역학 및 갈등 관리' },
  { id:'COMP_CORE_PROB', category:'core',       name_ko:'문제 해결',     ability_ko:'복잡한 문제 구조화 및 해결', skill_ko:'가설 기반 접근 및 데이터 분석',  knowledge_ko:'디자인 씽킹 및 애자일' },
  { id:'COMP_FUNC_OD',   category:'functional', name_ko:'조직 개발',     ability_ko:'OD 전략 수립 및 실행',       skill_ko:'조직 진단 및 변화 관리',        knowledge_ko:'조직 이론 및 변화 모델' },
  { id:'COMP_FUNC_TA',   category:'functional', name_ko:'인재 확보',     ability_ko:'채용 전략 수립',             skill_ko:'인터뷰 및 평가',               knowledge_ko:'노동시장 분석' },
  { id:'COMP_FUTURE_AI', category:'future',     name_ko:'AI 리터러시',   ability_ko:'AI 기반 업무 혁신 주도',     skill_ko:'생성형 AI 도구 활용',           knowledge_ko:'AI 윤리 및 규제 이해' },
];

const DEMO_FAMILIES_TB = [
  { id:'FAM_COMMON', name_ko:'공통 (전 직군)', name_en:'Common' },
  { id:'FAM_HR',     name_ko:'HR',             name_en:'Human Resources' },
  { id:'FAM_ENG',    name_ko:'개발/엔지니어링', name_en:'Engineering' },
  { id:'FAM_PM',     name_ko:'제품/기획',       name_en:'Product' },
];

const DEMO_CONFIGS_TB = {
  scale: [
    { id:'SCL_5PT',  name:'5점 척도 (1-매우 미흡 ~ 5-탁월)', config_json: JSON.stringify({ min:1, max:5, labels:['매우 미흡','미흡','보통','우수','탁월'] }) },
    { id:'SCL_3PT',  name:'3점 척도 (1-미흡 ~ 3-우수)',       config_json: JSON.stringify({ min:1, max:3, labels:['미흡','보통','우수'] }) },
    { id:'SCL_7PT',  name:'7점 척도 (1-매우 미흡 ~ 7-최고)',  config_json: JSON.stringify({ min:1, max:7 }) },
  ],
  policy: [
    { id:'POL_SELF', name:'자기 평가 (Self Only)',            config_json: JSON.stringify({ evaluators:['self'] }) },
    { id:'POL_360',  name:'360도 다면 (Self + 상사 + 동료)',  config_json: JSON.stringify({ evaluators:['self','manager','peer'] }) },
    { id:'POL_MGR',  name:'상사 평가 (Manager Only)',         config_json: JSON.stringify({ evaluators:['manager'] }) },
  ],
  workflow: [
    { id:'WF_BASIC', name:'기본 (자기평가 → 완료)',             config_json: JSON.stringify({ steps:['self','complete'] }) },
    { id:'WF_FULL',  name:'전체 (자기→상사→보정→최종)',         config_json: JSON.stringify({ steps:['self','manager','calibration','approved'] }) },
  ],
  weight: [
    { id:'WGT_EQUAL', name:'균등 가중치 (Self 100%)',          config_json: JSON.stringify({ self:1.0 }) },
    { id:'WGT_MGMT',  name:'관리자 중심 (Self 30% / 상사 50% / 동료 20%)', config_json: JSON.stringify({ self:0.3, manager:0.5, peer:0.2 }) },
  ],
  calibration: [
    { id:'CAL_NONE',  name:'보정 없음',                        config_json: JSON.stringify({ method:'none' }) },
    { id:'CAL_BASIC', name:'팀 평균 비교 보정',                config_json: JSON.stringify({ method:'team_avg_compare' }) },
  ],
};

// ── Data loading ──────────────────────────────────────────────

async function loadAllData() {
  if (!_orgId) {
    _orgId = 'ORG001'; // fallback for demo
  }

  const configTypes = ['scale', 'policy', 'workflow', 'weight', 'calibration', 'evidence', 'scoring'];

  const [
    templatesResult,
    familiesResult,
    competenciesResult,
  ] = await Promise.allSettled([
    api.templates.list(_orgId),
    api.org.families ? api.org.families(_orgId) : Promise.resolve(null),
    api.competencies.list(_orgId),
  ]);

  _templates    = (templatesResult.status === 'fulfilled' && templatesResult.value?.length)
                  ? templatesResult.value : DEMO_TEMPLATES_TB;
  _families     = (familiesResult.status === 'fulfilled' && familiesResult.value?.length)
                  ? familiesResult.value : DEMO_FAMILIES_TB;
  _competencies = (competenciesResult.status === 'fulfilled' && competenciesResult.value?.length)
                  ? competenciesResult.value : DEMO_COMPETENCIES_TB;

  // Prefer API configs when available; fall back to demo configs.
  const cfgResults = await Promise.allSettled(
    configTypes.map(t => (api.configs && typeof api.configs.list === 'function') ? api.configs.list(_orgId, t) : Promise.resolve(null))
  );
  configTypes.forEach((type, i) => {
    const r = cfgResults[i];
    const items = (r && r.status === 'fulfilled') ? r.value : null;
    _configs[type] = (items && Array.isArray(items) && items.length) ? items : (DEMO_CONFIGS_TB[type] || []);
  });

  renderTemplateList();
}

// ── Left panel ────────────────────────────────────────────────

function renderTemplateList() {
  const listEl = _root?.querySelector('#tb-template-list');
  if (!listEl) return;

  if (!_templates.length) {
    listEl.innerHTML = `
      <div style="text-align:center;padding:32px 16px;color:var(--text-muted);font-size:13px">
        <div style="font-size:28px;margin-bottom:8px">📋</div>
        <div>저장된 템플릿이 없습니다</div>
        <div style="margin-top:4px;font-size:12px">새 템플릿을 만들어 보세요</div>
      </div>`;
    return;
  }

  listEl.innerHTML = _templates.map(t => {
    const purposeLabel = PURPOSE_OPTIONS.find(p => p.value === t.purpose)?.label || t.purpose || '';
    const purposeColor = PURPOSE_BADGE_COLORS[t.purpose] || '#64748B';
    const isSelected   = t.id === _selectedTemplateId;
    return `
      <div class="tb-template-item${isSelected ? ' selected' : ''}"
           data-template-id="${escapeHtml(String(t.id || ''))}"
           role="button" tabindex="0"
           aria-label="${escapeHtml(t.name_ko || t.name || '템플릿')} 선택">
        <div style="font-size:13px;font-weight:600;color:var(--text);
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${escapeHtml(t.name_ko || t.name || '(이름 없음)')}
        </div>
        <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">
          ${purposeLabel ? `<span class="tb-badge" style="background:${purposeColor}">${escapeHtml(purposeLabel)}</span>` : ''}
          ${t.target_level_code ? `<span style="font-size:11px;color:var(--text-muted)">${escapeHtml(t.target_level_code)}</span>` : ''}
        </div>
      </div>`;
  }).join('');

  // Bind click events
  listEl.querySelectorAll('.tb-template-item').forEach(item => {
    const activate = () => {
      const id = item.dataset.templateId;
      loadTemplatePreview(id);
    };
    item.addEventListener('click', activate);
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') activate(); });
  });
}

function loadTemplatePreview(templateId) {
  const tmpl = _templates.find(t => String(t.id) === String(templateId));
  if (!tmpl) return;

  _selectedTemplateId = tmpl.id;
  _isReadOnly = true;

  // Re-render left list to show selection
  renderTemplateList();

  // Populate form in read-only preview mode
  renderForm(tmpl, true);
}

// ── New template ──────────────────────────────────────────────

function startNewTemplate() {
  _selectedTemplateId = null;
  _isReadOnly = false;

  // Deselect in left list
  _root?.querySelectorAll('.tb-template-item.selected').forEach(el => el.classList.remove('selected'));

  renderForm(null, false);
}

// ── Form render ───────────────────────────────────────────────

function renderForm(tmpl, readOnly) {
  const formArea = _root?.querySelector('#tb-form-area');
  if (!formArea) return;

  const val = (field) => escapeHtml(String(tmpl?.[field] ?? ''));

  // Competency set: parse from template
  const selectedCompIds = new Set(
    (tmpl?.competency_set || tmpl?.competency_set_json || tmpl?.competency_ids || []).map(String)
  );

  // Group competencies by category
  const grouped = groupBy(_competencies, c => c.category || 'core');

  // Config radio sections
  const configSections = CONFIG_TYPES.map(ct => {
    const items   = _configs[ct.key] || [];
    const current = tmpl?.[ct.field];
    return renderConfigRadioSection(ct, items, current, readOnly);
  }).join('');

  formArea.innerHTML = `
    ${readOnly ? `
      <div class="tb-readonly-banner">
        <span style="font-size:16px">👁</span>
        <div>
          <div style="font-weight:600">미리보기 모드</div>
          <div style="font-size:12px;margin-top:1px">이 템플릿을 기반으로 새 템플릿을 만들려면 편집 버튼을 누르세요.</div>
        </div>
        <button id="tb-edit-from-preview-btn" class="btn btn-ghost btn-sm"
                style="margin-left:auto;white-space:nowrap">편집하기</button>
      </div>` : ''}

    <div style="max-width:720px">
      <!-- 기본 정보 -->
      <div class="tb-form-section">
        <div class="tb-form-section-title">기본 정보</div>

        <div class="tb-field">
          <label class="tb-label" for="tb-name">템플릿명</label>
          <input id="tb-name" class="tb-input" type="text"
                 placeholder="예: 2025 상반기 승진심사"
                 value="${val('name_ko')}"
                 ${readOnly ? 'readonly' : ''}>
        </div>

        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <div class="tb-field" style="flex:1;min-width:160px">
            <label class="tb-label" for="tb-purpose">목적</label>
            <select id="tb-purpose" class="tb-select" ${readOnly ? 'disabled' : ''}>
              <option value="">선택하세요</option>
              ${PURPOSE_OPTIONS.map(p => `
                <option value="${p.value}" ${tmpl?.purpose === p.value ? 'selected' : ''}>
                  ${p.label}
                </option>`).join('')}
            </select>
          </div>

          <div class="tb-field" style="flex:1;min-width:140px">
            <label class="tb-label" for="tb-family">대상 직군</label>
            <select id="tb-family" class="tb-select" ${readOnly ? 'disabled' : ''}>
              <option value="">전체 직군</option>
              ${_families.map(f => `
                <option value="${escapeHtml(String(f.id || ''))}"
                  ${String(tmpl?.target_family_id) === String(f.id) ? 'selected' : ''}>
                  ${escapeHtml(f.name_ko || f.name || '')}
                </option>`).join('')}
            </select>
          </div>

          <div class="tb-field" style="flex:0 0 120px">
            <label class="tb-label" for="tb-level">대상 레벨</label>
            <select id="tb-level" class="tb-select" ${readOnly ? 'disabled' : ''}>
              <option value="">전체</option>
              ${LEVEL_OPTIONS.map(l => `
                <option value="${l.value}" ${tmpl?.target_level_code === l.value ? 'selected' : ''}>
                  ${l.label}
                </option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- 역량 세트 -->
      <div class="tb-form-section">
        <div class="tb-form-section-title">역량 세트</div>
        ${_competencies.length ? `
          <div id="tb-competency-list" style="
            border:1.5px solid var(--border);
            border-radius:var(--radius-md);
            padding:12px;
            max-height:320px;
            overflow-y:auto;
            background:var(--surface);
          ">
            ${Object.entries(grouped).map(([cat, comps]) => {
              const catLabel = CATEGORY_LABELS[cat] || cat;
              const catColor = CATEGORY_COLORS[cat] || '#64748B';
              return `
                <div class="tb-comp-group">
                  <div>
                    <span class="tb-comp-group-label" style="background:${catColor}">${catLabel}</span>
                  </div>
                  ${comps.map(c => `
                    <label class="tb-comp-item">
                      <input type="checkbox"
                             data-comp-id="${escapeHtml(String(c.id || ''))}"
                             ${selectedCompIds.has(String(c.id)) ? 'checked' : ''}
                             ${readOnly ? 'disabled' : ''}>
                      <span style="font-size:13px;color:var(--text)">
                        ${escapeHtml(c.name_ko || c.name || '')}
                      </span>
                      <span class="tb-badge" style="background:${catColor};margin-left:auto">
                        ${catLabel}
                      </span>
                    </label>`).join('')}
                </div>`;
            }).join('')}
          </div>` : `
          <div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px;
                      border:1.5px dashed var(--border);border-radius:var(--radius-md)">
            역량 데이터를 불러올 수 없습니다.
          </div>`}
      </div>

      <!-- 모듈 설정 -->
      <div class="tb-form-section">
        <div class="tb-form-section-title">모듈 설정</div>
        ${configSections}
      </div>

      <!-- 액션 버튼 -->
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px;flex-wrap:wrap">
        <button id="tb-preview-btn" class="btn btn-ghost">조립 미리보기</button>
        ${readOnly ? '' : `
          <button id="tb-cancel-btn" class="btn btn-ghost">취소</button>
          <button id="tb-save-btn" class="btn btn-primary" style="min-width:100px">저장하기</button>
        `}
      </div>
    </div>
  `;

  // Bind form events
  formArea.querySelector('#tb-preview-btn')?.addEventListener('click', () => {
    openTemplatePreview(tmpl);
  });
  if (readOnly) {
    formArea.querySelector('#tb-edit-from-preview-btn')?.addEventListener('click', () => {
      _isReadOnly = false;
      renderForm(tmpl, false);
    });
  } else {
    formArea.querySelector('#tb-cancel-btn')?.addEventListener('click', () => {
      formArea.innerHTML = renderEmptyFormPrompt();
      _selectedTemplateId = null;
      _root?.querySelectorAll('.tb-template-item.selected').forEach(el => el.classList.remove('selected'));
    });
    formArea.querySelector('#tb-save-btn')?.addEventListener('click', () => {
      saveTemplate(tmpl);
    });
  }
}

function renderConfigRadioSection(configType, items, currentValue, readOnly) {
  const hasItems = items && items.length > 0;

  if (!hasItems) {
    return `
      <div class="tb-field">
        <label class="tb-label">${escapeHtml(configType.label)}</label>
        <div style="font-size:13px;color:var(--text-muted);padding:8px 0">
          설정 항목이 없습니다.
        </div>
      </div>`;
  }

  return `
    <div class="tb-field">
      <label class="tb-label">${escapeHtml(configType.label)}</label>
      <div>
        ${items.map(item => {
          const itemId    = String(item.id || '');
          const isChecked = String(currentValue) === itemId;
          const cfg       = tryParseJson(item.config_json);
          const preview   = buildConfigPreview(configType.key, cfg, item);
          return `
            <label class="tb-radio-card${isChecked ? ' checked' : ''}">
              <input type="radio"
                     name="config_${escapeHtml(configType.field)}"
                     value="${escapeHtml(itemId)}"
                     ${isChecked ? 'checked' : ''}
                     ${readOnly ? 'disabled' : ''}
                     style="flex-shrink:0">
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:600;color:var(--text)">
                  ${escapeHtml(item.name_ko || item.name || itemId)}
                </div>
                ${preview ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">${preview}</div>` : ''}
              </div>
            </label>`;
        }).join('')}
      </div>
    </div>`;
}

function buildConfigPreview(type, cfg, raw) {
  if (!cfg && !raw) return '';
  try {
    switch (type) {
      case 'scale': {
        const pts = cfg?.points || cfg?.scale_points;
        const labels = cfg?.labels || [];
        const labelPreview = Array.isArray(labels) && labels.length
          ? labels.slice(0, 3).map(l => escapeHtml(String(l?.label || l || ''))).join(' · ')
          : '';
        return pts ? `${escapeHtml(String(pts))}점 척도${labelPreview ? ' · ' + labelPreview : ''}` : '';
      }
      case 'policy': {
        const types = cfg?.evaluator_types || cfg?.types || [];
        return Array.isArray(types) && types.length
          ? '평가자: ' + types.map(t => escapeHtml(String(t))).join(', ')
          : '';
      }
      case 'workflow': {
        const steps = cfg?.steps || [];
        const count = steps.length;
        const first = steps[0]?.name || steps[0]?.step || '';
        const last  = steps[count - 1]?.name || steps[count - 1]?.step || '';
        return count ? `${count}단계${first ? ' · ' + escapeHtml(first) : ''}${last && last !== first ? ' → ' + escapeHtml(last) : ''}` : '';
      }
      case 'weight': {
        const w = cfg?.weights || cfg;
        const self    = w?.self    ?? w?.self_weight;
        const manager = w?.manager ?? w?.manager_weight;
        const peer    = w?.peer    ?? w?.peer_weight;
        const parts   = [];
        if (self    != null) parts.push(`자가 ${self}%`);
        if (manager != null) parts.push(`상사 ${manager}%`);
        if (peer    != null) parts.push(`동료 ${peer}%`);
        return parts.join(' · ');
      }
      case 'calibration': {
        const method = cfg?.method || cfg?.calibration_method || '';
        return method ? `방식: ${escapeHtml(String(method))}` : '';
      }
      default:
        return '';
    }
  } catch {
    return '';
  }
}

// ── Save ──────────────────────────────────────────────────────

async function saveTemplate(baseTmpl) {
  const formArea = _root?.querySelector('#tb-form-area');
  if (!formArea) return;

  const nameInput = formArea.querySelector('#tb-name');
  const purposeEl = formArea.querySelector('#tb-purpose');
  const familyEl  = formArea.querySelector('#tb-family');
  const levelEl   = formArea.querySelector('#tb-level');

  const name_ko = nameInput?.value?.trim();
  if (!name_ko) {
    showToast('템플릿명을 입력해 주세요.', 'warning');
    nameInput?.focus();
    return;
  }

  // Collect checked competency IDs
  const competencyIds = Array.from(
    formArea.querySelectorAll('input[type=checkbox][data-comp-id]:checked')
  ).map(el => el.dataset.compId);

  // Collect selected config IDs
  const configData = {};
  CONFIG_TYPES.forEach(ct => {
    const radio = formArea.querySelector(`input[name="config_${ct.field}"]:checked`);
    configData[ct.field] = radio?.value || null;
  });

  const payload = {
    name_ko,
    purpose:              purposeEl?.value  || null,
    target_family_id:     familyEl?.value   || null,
    target_level_code:    levelEl?.value    || null,
    competency_set:       competencyIds,
    ...configData,
  };

  const saveBtn = formArea.querySelector('#tb-save-btn');
  if (saveBtn) {
    saveBtn.disabled   = true;
    saveBtn.textContent = '저장 중…';
  }

  try {
    const result = await api.templates.create(_orgId, payload);
    showToast('템플릿 저장 완료', 'success')
      addNotification({ type: 'success', title: 'template_builder', body: '템플릿 저장 완료' });

    // Refresh template list
    const updated = await api.templates.list(_orgId).catch(() => null);
    if (updated) _templates = updated;
    renderTemplateList();

    // Switch to read-only preview of new template
    if (result?.id) {
      _selectedTemplateId = result.id;
      const newTmpl = { ...payload, id: result.id };
      _templates = _templates.length
        ? _templates
        : [newTmpl];
      renderForm({ ...payload, ...result }, true);
      renderTemplateList();
    } else {
      formArea.innerHTML = renderEmptyFormPrompt();
    }
  } catch (err) {
    console.error('[TemplateBuilder] Save error:', err);
    showToast(err.message || '저장 중 오류가 발생했습니다.', 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled    = false;
      saveBtn.textContent = '저장하기';
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────

function renderEmptyFormPrompt() {
  return `
    <div style="
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      min-height:320px;color:var(--text-muted);text-align:center;padding:40px 20px;
    ">
      <div style="font-size:48px;margin-bottom:16px">📋</div>
      <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:8px">
        템플릿을 선택하거나 새로 만드세요
      </div>
      <div style="font-size:13px;line-height:1.6">
        왼쪽에서 기존 템플릿을 선택하면 미리보기를 볼 수 있습니다.<br>
        새 템플릿을 만들려면 <strong>새 템플릿</strong> 버튼을 누르세요.
      </div>
    </div>`;
}

function renderSkeletonList(n) {
  return Array(n).fill(0).map(() => `
    <div style="padding:10px 14px;margin:2px 8px">
      <div class="skeleton" style="height:16px;border-radius:4px;margin-bottom:6px"></div>
      <div class="skeleton" style="height:12px;width:60%;border-radius:4px"></div>
    </div>`).join('');
}

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
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
