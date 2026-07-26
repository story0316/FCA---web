/**
 * survey.js – Survey Page (Redesigned)
 * HR Competency OS
 *
 * Tabs: 직무 서베이 | 참여 이력 | 면접관 조회
 * Special: Job interest selector → auto-generate pulse survey
 */

import { LIFECYCLE_PHASES, LIFECYCLE_SURVEYS } from '../data/lifecycle_surveys.js';
import { getUser, isAdmin, isApplicant as _isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js'
import { addNotification } from '../components/notification-hub.js';
import { navigate } from '../app.js';
import { api } from '../api.js';
import { loadDisplayEmployees } from '../data/demo_employees.js';

// ── localStorage keys ─────────────────────────────────────────
const RESPONSES_KEY  = 'hr_survey_responses';
const TECH_TREE_KEY  = 'hr_tech_tree';
const JOB_PREF_KEY   = 'hr_job_interest';

// ── Scale labels ──────────────────────────────────────────────
const SCALE5_LABELS = ['', '전혀 아니다', '아니다', '보통', '그렇다', '매우 그렇다'];

// ── Job interest definitions ──────────────────────────────────
const JOB_INTERESTS = [
  {
    id: 'hr',       label: 'HR/인사',       icon: '👥', color: '#4F46E5',
    competencies: ['채용·TA', '노무관리', 'HRBP', 'L&D/OD', 'C&B'],
    questions: [
      { id: 'hr_q1', text: '채용 공고 작성부터 합격자 선발까지 전 과정을 혼자 진행할 수 있다.', type: 'scale5', required: true },
      { id: 'hr_q2', text: '근로계약서, 취업규칙 등 노무 서류 작성 및 검토에 자신 있다.', type: 'scale5', required: true },
      { id: 'hr_q3', text: '구성원 성과 관리 및 피드백 프로세스를 설계할 수 있다.', type: 'scale5', required: true },
      { id: 'hr_q4', text: '교육 니즈 분석(TNA)부터 프로그램 기획까지 수행한 경험이 있다.', type: 'scale5', required: true },
      { id: 'hr_q5', text: '가장 자신 있는 HR 전문 영역은?', type: 'choice', required: true,
        options: ['채용/TA', '노무관리', 'HRBP', 'L&D/OD', 'C&B/보상', '조직문화', '아직 탐색 중'] },
      { id: 'hr_q6', text: '본 직무를 통해 달성하고 싶은 목표를 자유롭게 적어주세요.', type: 'text', required: false, placeholder: 'ex) HR 데이터 기반 의사결정 체계 구축...' },
    ],
  },
  {
    id: 'dev',      label: '개발/엔지니어링', icon: '💻', color: '#0EA5E9',
    competencies: ['기술역량', '문제해결', '협업', '코드품질', '아키텍처'],
    questions: [
      { id: 'dev_q1', text: '주력 프로그래밍 언어로 프로덕션 수준의 코드를 작성할 수 있다.', type: 'scale5', required: true },
      { id: 'dev_q2', text: '요구사항을 분석하고 기술 스펙을 스스로 정의할 수 있다.', type: 'scale5', required: true },
      { id: 'dev_q3', text: '코드 리뷰, PR 작성 등 팀 협업 개발 경험이 충분하다.', type: 'scale5', required: true },
      { id: 'dev_q4', text: '현재 주력 기술 스택을 선택해 주세요.', type: 'checklist', required: true,
        options: ['Frontend (React/Vue/Angular)', 'Backend (Node/Spring/Django)', 'iOS/Android (Mobile)', 'Data/AI (Python/ML)', 'DevOps/Cloud', '기타'] },
      { id: 'dev_q5', text: '개발 역량 강화를 위해 집중하고 싶은 분야가 있다면 적어주세요.', type: 'text', required: false, placeholder: 'ex) 시스템 설계, 성능 최적화...' },
    ],
  },
  {
    id: 'marketing', label: '마케팅',         icon: '📣', color: '#F59E0B',
    competencies: ['브랜드', '디지털마케팅', '콘텐츠', 'CRM', '데이터분석'],
    questions: [
      { id: 'mkt_q1', text: '마케팅 캠페인을 기획부터 성과 측정까지 독립적으로 실행할 수 있다.', type: 'scale5', required: true },
      { id: 'mkt_q2', text: 'SNS, 검색광고 등 디지털 채널 운영 경험이 풍부하다.', type: 'scale5', required: true },
      { id: 'mkt_q3', text: '고객 데이터를 분석하여 인사이트를 도출할 수 있다.', type: 'scale5', required: true },
      { id: 'mkt_q4', text: '주요 경험 채널을 모두 선택해 주세요.', type: 'checklist', required: true,
        options: ['SNS/콘텐츠 마케팅', '검색광고(SEA/SEM)', 'CRM/이메일', '브랜드 전략', '퍼포먼스 마케팅', 'PR/언론홍보'] },
      { id: 'mkt_q5', text: '이 직무에서 가장 기여하고 싶은 부분을 적어주세요.', type: 'text', required: false, placeholder: 'ex) 브랜드 인지도 향상, 전환율 최적화...' },
    ],
  },
  {
    id: 'sales',    label: '영업/BD',         icon: '🤝', color: '#10B981',
    competencies: ['영업역량', '고객관리', '협상', '사업개발', '네트워킹'],
    questions: [
      { id: 'sales_q1', text: '신규 고객 발굴부터 계약 체결까지 전 과정을 주도할 수 있다.', type: 'scale5', required: true },
      { id: 'sales_q2', text: '고객의 니즈를 파악하고 맞춤 솔루션을 제안하는 역량이 높다.', type: 'scale5', required: true },
      { id: 'sales_q3', text: '숫자 기반으로 영업 목표를 설정하고 달성 전략을 수립할 수 있다.', type: 'scale5', required: true },
      { id: 'sales_q4', text: '주력 영업 유형을 선택해 주세요.', type: 'choice', required: true,
        options: ['B2B 기업 영업', 'B2C 소비자 영업', '파트너십/BD', '해외 영업', '채널 세일즈', '아직 탐색 중'] },
      { id: 'sales_q5', text: '가장 자신 있는 영업 강점을 자유롭게 작성해 주세요.', type: 'text', required: false, placeholder: 'ex) 관계 구축, 협상 능력, 시장 분석...' },
    ],
  },
  {
    id: 'planning', label: '기획/전략',        icon: '🔭', color: '#8B5CF6',
    competencies: ['전략기획', '데이터분석', '프로젝트관리', '커뮤니케이션', '문제해결'],
    questions: [
      { id: 'plan_q1', text: '복잡한 문제를 구조화하고 해결 방안을 논리적으로 도출할 수 있다.', type: 'scale5', required: true },
      { id: 'plan_q2', text: '데이터를 기반으로 인사이트를 도출하고 의사결정을 지원할 수 있다.', type: 'scale5', required: true },
      { id: 'plan_q3', text: '프로젝트 전반을 일정, 리소스, 리스크 측면에서 관리할 수 있다.', type: 'scale5', required: true },
      { id: 'plan_q4', text: '가장 관심 있는 기획 분야를 선택해 주세요.', type: 'choice', required: true,
        options: ['신규 사업 기획', '경영전략/BM', 'IT/서비스 기획', '마케팅 기획', 'PMO/프로젝트 관리', '아직 탐색 중'] },
      { id: 'plan_q5', text: '기획 역량 향상을 위해 필요하다고 생각하는 것을 적어주세요.', type: 'text', required: false, placeholder: 'ex) 데이터 분석 툴, 전략 프레임워크...' },
    ],
  },
  {
    id: 'design',   label: '디자인',          icon: '🎨', color: '#EC4899',
    competencies: ['UX리서치', 'UI디자인', '비주얼디자인', '프로토타이핑', '브랜딩'],
    questions: [
      { id: 'des_q1', text: '사용자 리서치를 바탕으로 UX 흐름을 설계할 수 있다.', type: 'scale5', required: true },
      { id: 'des_q2', text: 'Figma, Sketch 등 디자인 툴로 고퀄리티 산출물을 제작할 수 있다.', type: 'scale5', required: true },
      { id: 'des_q3', text: '개발팀과의 협업을 위한 디자인 핸드오프 경험이 있다.', type: 'scale5', required: true },
      { id: 'des_q4', text: '주력 디자인 분야를 선택해 주세요.', type: 'choice', required: true,
        options: ['UX/프로덕트 디자인', 'UI/그래픽 디자인', '브랜드/BI 디자인', '모션/영상', '패키지/인쇄', '아직 탐색 중'] },
      { id: 'des_q5', text: '디자이너로서 가장 중요하게 생각하는 가치를 적어주세요.', type: 'text', required: false, placeholder: 'ex) 사용자 중심 사고, 일관된 브랜드 경험...' },
    ],
  },
  {
    id: 'finance',  label: '재무/회계',        icon: '📊', color: 'var(--text-muted)',
    competencies: ['재무분석', '회계처리', '예산관리', '세무', '리스크관리'],
    questions: [
      { id: 'fin_q1', text: '재무제표를 읽고 경영 인사이트를 도출할 수 있다.', type: 'scale5', required: true },
      { id: 'fin_q2', text: '예산 수립 및 실적 분석 업무를 독립적으로 수행할 수 있다.', type: 'scale5', required: true },
      { id: 'fin_q3', text: '세무, 회계 처리 관련 법규 및 기준을 이해하고 있다.', type: 'scale5', required: true },
      { id: 'fin_q4', text: '주력 업무 영역을 선택해 주세요.', type: 'choice', required: true,
        options: ['재무기획/FP&A', '일반 회계', '세무', '내부감사', '원가회계', '아직 탐색 중'] },
      { id: 'fin_q5', text: '재무/회계 역량 향상을 위해 필요한 것을 작성해 주세요.', type: 'text', required: false, placeholder: 'ex) ERP 시스템 활용, IFRS 이해...' },
    ],
  },
  {
    id: 'ops',      label: '운영/CS',         icon: '⚙️', color: '#059669',
    competencies: ['운영관리', '고객서비스', '프로세스개선', '품질관리', '커뮤니케이션'],
    questions: [
      { id: 'ops_q1', text: '운영 프로세스를 분석하고 효율화 방안을 제안할 수 있다.', type: 'scale5', required: true },
      { id: 'ops_q2', text: '고객 불만이나 이슈를 신속·정확하게 처리하는 역량이 높다.', type: 'scale5', required: true },
      { id: 'ops_q3', text: '데이터를 활용해 운영 KPI를 설정하고 모니터링할 수 있다.', type: 'scale5', required: true },
      { id: 'ops_q4', text: '주력 운영 유형을 선택해 주세요.', type: 'choice', required: true,
        options: ['고객 지원/CS', '서비스 운영', '물류/SCM', '품질관리/QA', '시설/총무', '아직 탐색 중'] },
      { id: 'ops_q5', text: '이 직무에서 가장 잘 할 수 있는 강점을 작성해 주세요.', type: 'text', required: false, placeholder: 'ex) 멀티태스킹, 위기 대응, 시스템 구축...' },
    ],
  },
];

// ── Interviewers state (populated in mount() from DB) ─────────
let _interviewers = [];

function _buildInterviewers(employees) {
  const extras = [
    { id: 'INT_001', name: '정하늘', role: 'Senior Recruiter', dept: '채용팀', avatar: '👩', level: 'L2',
      specialty: ['채용/TA', 'Interviewing', '인재발굴'], availability: '가능',
      jobAreas: ['hr', 'dev', 'marketing', 'sales'] },
    { id: 'INT_002', name: '오세준', role: 'Tech Lead', dept: '개발팀', avatar: '👨', level: 'L3',
      specialty: ['Backend', 'Architecture', 'Code Review'], availability: '가능',
      jobAreas: ['dev'] },
    { id: 'INT_003', name: '임지수', role: 'UX Design Manager', dept: '디자인팀', avatar: '👩', level: 'M',
      specialty: ['UX Research', 'Product Design', 'Figma'], availability: '조율 필요',
      jobAreas: ['design'] },
    { id: 'INT_004', name: '한승우', role: '영업팀장', dept: '영업팀', avatar: '🧑', level: 'M',
      specialty: ['B2B 영업', 'BD', '협상'], availability: '가능',
      jobAreas: ['sales'] },
    { id: 'INT_005', name: '노유진', role: 'CFO 실', dept: '재무팀', avatar: '👩', level: 'L3',
      specialty: ['FP&A', '재무분석', '예산관리'], availability: '가능',
      jobAreas: ['finance'] },
  ];
  const fromDB = employees.map(e => ({
    id: e.id, name: e.name, role: e.role || e.position || '직원', dept: e.dept || e.department || '기타',
    avatar: e.avatar || '👤', level: e.level || 'L1',
    specialty: e.keyCompetencies || [],
    availability: '가능',
    jobAreas: ['hr'],
  }));
  return [...fromDB, ...extras];
}

// ── Module-level state ────────────────────────────────────────
let _root         = null;
let _activeTab    = 'survey';   // 'survey' | 'history'
let _selectedJobs = [];         // JOB_INTERESTS ids (multi-select)
let _activeSurvey = null;       // { survey, questionIndex }
let _answers      = {};
let _mode         = 'list';     // 'list' | 'running' | 'submitted'
let _timers       = [];

// ── Legacy phase state (for lifecycle survey runner) ──────────
let _currentPhase = 'hiring';

// ── XSS helper ────────────────────────────────────────────────
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ══════════════════════════════════════════════════════════════
// localStorage helpers
// ══════════════════════════════════════════════════════════════

function saveResponse(surveyId, answers, meta = {}) {
  const survey = (LIFECYCLE_SURVEYS || []).find(s => s.id === surveyId);
  const payload = {
    answers,
    surveyName:  meta.name || survey?.name_ko || surveyId,
    phase:       meta.phase || survey?.phase || null,
    jobId:       meta.jobId || null,
    submittedAt: new Date().toISOString(),
  };
  try {
    const all = JSON.parse(localStorage.getItem(RESPONSES_KEY) || '{}');
    all[surveyId] = payload;
    localStorage.setItem(RESPONSES_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn('[Survey] saveResponse error:', e);
  }
  api.survey.saveResponse(surveyId, payload).catch(() => {});
}

function getResponse(surveyId) {
  try {
    const all = JSON.parse(localStorage.getItem(RESPONSES_KEY) || '{}');
    return all[surveyId] || null;
  } catch { return null; }
}

function isCompleted(surveyId) {
  return Boolean(getResponse(surveyId));
}

function getAllResponses() {
  try {
    return JSON.parse(localStorage.getItem(RESPONSES_KEY) || '{}');
  } catch { return {}; }
}

function getTechTreeState() {
  try { return JSON.parse(localStorage.getItem(TECH_TREE_KEY) || '{}'); }
  catch { return {}; }
}

function markCourseComplete(courseId) {
  const state = getTechTreeState();
  state[courseId] = { completedAt: new Date().toISOString() };
  localStorage.setItem(TECH_TREE_KEY, JSON.stringify(state));
}

function isCourseAvailable(course, completedIds) {
  if (!course.prerequisites || !course.prerequisites.length) return true;
  return course.prerequisites.every(id => completedIds.includes(id));
}

function getSavedJobInterests() {
  try {
    const raw = localStorage.getItem(JOB_PREF_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      return parsed ? [String(parsed)] : [];
    } catch {
      // Legacy: plain string stored without JSON encoding (e.g. "hr")
      return [raw];
    }
  } catch { return []; }
}

function toggleJobInterest(jobId) {
  try {
    const current = getSavedJobInterests();
    const idx = current.indexOf(jobId);
    if (idx >= 0) { current.splice(idx, 1); } else { current.push(jobId); }
    localStorage.setItem(JOB_PREF_KEY, JSON.stringify(current));

    // Sync to career summary
    const jobs = current.map(id => JOB_INTERESTS.find(j => j.id === id)).filter(Boolean);
    const summary = (() => { try { return JSON.parse(localStorage.getItem('hr_career_summary') || '{}'); } catch { return {}; } })();
    summary.jobAreaIds    = current;
    summary.jobAreaLabels = jobs.map(j => j.label);
    if (!summary.targetJob || summary.targetJob === 'HR Business Partner') {
      summary.targetJob = jobs[0]?.label || summary.targetJob;
    }
    summary.updatedAt = new Date().toISOString().slice(0, 10);
    localStorage.setItem('hr_career_summary', JSON.stringify(summary));
  } catch {}
}

// ══════════════════════════════════════════════════════════════
// Main page render
// ══════════════════════════════════════════════════════════════

function renderPage() {
  if (!_root) return;

  // Running a survey (full-screen runner)
  if (_mode === 'running' || _mode === 'submitted') {
    _root.innerHTML = `<div class="page" style="background:var(--bg)">${renderRunnerShell()}</div>`;
    bindRunnerEvents();
    return;
  }

  const tabs = [
    { id: 'survey',  label: '직무 서베이', icon: '🗳️' },
    { id: 'history', label: '참여 이력',   icon: '📋' },
  ];

  const tabBar = tabs.map(t => {
    const active = t.id === _activeTab;
    return `
      <button class="sv-tab-btn" data-tab="${t.id}" style="
        flex:0 0 auto;padding:10px 16px;border:none;background:none;cursor:pointer;
        font-size:0.83rem;font-weight:${active ? '700' : '500'};
        color:${active ? 'var(--primary)' : 'var(--text-muted)'};
        border-bottom:2.5px solid ${active ? 'var(--primary)' : 'transparent'};
        white-space:nowrap;transition:all 150ms;
      ">${t.icon} ${esc(t.label)}</button>
    `;
  }).join('');

  let contentHtml = '';
  if (_activeTab === 'survey')      contentHtml = renderSurveyTab();
  else if (_activeTab === 'history') contentHtml = renderHistoryTab();

  _root.innerHTML = `
    <div class="page" style="background:var(--bg);display:flex;flex-direction:column;height:100vh;overflow:hidden">
      <div class="top-bar" style="flex-shrink:0">
        <button class="top-bar-back" id="survey-back" aria-label="뒤로가기">‹</button>
        <div class="top-bar-title">서베이</div>
      </div>

      <div style="
        background:var(--surface);border-bottom:1px solid var(--border);
        display:flex;overflow-x:auto;scrollbar-width:none;flex-shrink:0;
      " id="sv-tab-bar">
        ${tabBar}
      </div>

      <div class="page-content" style="flex:1;overflow-y:auto" id="sv-content">
        ${contentHtml}
      </div>
    </div>
    <style>#sv-tab-bar::-webkit-scrollbar{display:none}</style>
  `;

  bindPageEvents();
}

// ══════════════════════════════════════════════════════════════
// Tab: 직무 서베이
// ══════════════════════════════════════════════════════════════

function renderSurveyTab() {
  const selectedJobs    = _selectedJobs.length ? _selectedJobs : getSavedJobInterests();
  const selectedJobObjs = selectedJobs.map(id => JOB_INTERESTS.find(j => j.id === id)).filter(Boolean);
  const isHR            = isAdmin();
  const phases          = Array.isArray(LIFECYCLE_PHASES) ? LIFECYCLE_PHASES : [];

  const isApplicant = _isApplicant();

  // ── Job chips ──────────────────────────────────────────────────
  const jobChips = JOB_INTERESTS.map(j => {
    const active = selectedJobs.includes(j.id);
    return `
      <button class="job-chip" data-job="${j.id}" style="
        flex:0 0 auto;padding:7px 13px;border-radius:var(--radius-full);
        border:1.5px solid ${active ? j.color : 'var(--border)'};
        background:${active ? j.color : 'var(--surface)'};
        color:${active ? '#fff' : 'var(--text-muted)'};
        font-size:0.8rem;font-weight:${active ? '700' : '500'};
        cursor:pointer;white-space:nowrap;transition:all 120ms;
      ">${active ? '✓ ' : ''}${j.icon} ${esc(j.label)}</button>`;
  }).join('');

  // ── Compact pulse rows ─────────────────────────────────────────
  const pulseRows = selectedJobObjs.length
    ? selectedJobObjs.map(j => {
        const done = isCompleted(`pulse_${j.id}`);
        return `
          <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;
            border-bottom:1px solid var(--border);last-child:border-bottom:none;">
            <div style="width:38px;height:38px;border-radius:10px;flex-shrink:0;
              background:${j.color}12;display:flex;align-items:center;justify-content:center;font-size:1.25rem;">
              ${j.icon}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:0.88rem;font-weight:700;color:var(--text);margin-bottom:2px;">
                ${esc(j.label)} 역량 진단
              </div>
              <div style="font-size:0.72rem;color:var(--text-muted);">
                ${j.questions.length}문항 &middot; 약 ${Math.ceil(j.questions.length * 0.8)}분
                ${done ? ' &middot; <span style="color:#10B981;font-weight:600;">완료</span>' : ''}
              </div>
            </div>
            <button class="pulse-start-btn" data-job-id="${esc(j.id)}" style="
              flex-shrink:0;padding:8px 16px;border:none;border-radius:8px;cursor:pointer;
              background:${done ? '#10B981' : j.color};color:#fff;
              font-size:0.8rem;font-weight:700;white-space:nowrap;">
              ${done ? '재진단' : '시작 →'}
            </button>
          </div>`;
      }).join('')
    : `<div style="padding:28px 16px;text-align:center;color:var(--text-muted);font-size:0.85rem;line-height:1.7;">
         위에서 관심 직무를 선택하면<br>맞춤 진단이 자동 생성됩니다 ✨
       </div>`;

  // ── Phase chips & surveys ──────────────────────────────────────
  const phaseChips = phases.map(p => {
    const active = p.id === _currentPhase;
    return `
      <button class="phase-chip" data-phase="${p.id}" style="
        flex:0 0 auto;padding:6px 12px;border-radius:var(--radius-full);
        border:1.5px solid ${active ? p.color : 'var(--border)'};
        background:${active ? p.color + '18' : 'var(--surface)'};
        color:${active ? p.color : 'var(--text-muted)'};
        font-size:0.78rem;font-weight:${active ? '700' : '500'};
        cursor:pointer;white-space:nowrap;
      ">${p.icon} ${esc(p.name_ko)}</button>`;
  }).join('');

  const phaseSurveys = (LIFECYCLE_SURVEYS || []).filter(s => {
    if (s.phase !== _currentPhase) return false;
    return isHR || s.audience === 'employee' || s.audience === 'both';
  });

  const lifecycleRows = phaseSurveys.length
    ? phaseSurveys.map(s => renderLifecycleSurveyCard(s, isHR)).join('')
    : `<div style="color:var(--text-muted);font-size:0.82rem;text-align:center;padding:16px 0;">이 단계에 해당 서베이가 없습니다.</div>`;

  return `
    <div class="fade-in" style="display:flex;flex-direction:column;gap:20px;">

      <!-- ① 관심 직무 -->
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <span style="font-size:0.82rem;font-weight:700;color:var(--text);">🎯 관심 직무</span>
          <span style="font-size:0.72rem;color:${selectedJobs.length ? 'var(--primary)' : 'var(--text-muted)'};">
            ${selectedJobs.length ? `${selectedJobs.length}개 선택 · 탭으로 해제` : '복수 선택 가능'}
          </span>
        </div>
        <div style="display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px;">
          ${jobChips}
        </div>
      </div>

      <!-- ② 맞춤 역량 진단 -->
      <div>
        <div style="font-size:0.82rem;font-weight:700;color:var(--text);margin-bottom:10px;">
          📋 맞춤 역량 진단
          ${selectedJobObjs.length ? `<span style="font-weight:400;font-size:0.72rem;color:var(--text-muted);margin-left:6px;">선택 직무 기반 자동 생성</span>` : ''}
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;">
          ${pulseRows}
        </div>
      </div>

      <!-- ③ 라이프사이클 서베이 (지원자 제외) -->
      ${isApplicant ? '' : `
      <div>
        <div style="font-size:0.82rem;font-weight:700;color:var(--text);margin-bottom:10px;">
          📅 라이프사이클 서베이
        </div>
        <div style="display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin-bottom:12px;padding-bottom:2px;">
          ${phaseChips}
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;">
          ${lifecycleRows}
        </div>
      </div>
      `}

    </div>
  `;
}

function renderLifecycleSurveyCard(survey, isHR) {
  const completed  = isCompleted(survey.id);
  const isTechTree = survey.special_type === 'tech_tree';
  const btnBg      = completed ? '#10B981' : 'var(--primary)';
  const btnLabel   = isTechTree ? '열기' : completed ? '완료' : '시작';

  return `
    <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;
      border-bottom:1px solid var(--border);">
      <div style="width:36px;height:36px;border-radius:8px;flex-shrink:0;
        background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:1.15rem;">
        ${esc(survey.icon || '📋')}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.88rem;font-weight:600;color:var(--text);margin-bottom:2px;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${esc(survey.name_ko)}
        </div>
        <div style="font-size:0.72rem;color:var(--text-muted);">
          ${survey.question_count || 0}문항 &middot; 약 ${survey.estimated_minutes || 5}분
          ${completed ? ' &middot; <span style="color:#10B981;font-weight:600;">완료</span>' : ''}
        </div>
      </div>
      <button class="lifecycle-start-btn" data-survey-id="${esc(survey.id)}" style="
        flex-shrink:0;padding:7px 14px;border:none;border-radius:8px;cursor:pointer;
        background:${btnBg};color:#fff;font-size:0.8rem;font-weight:700;">
        ${btnLabel}
      </button>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════
// Tab: 참여 이력
// ══════════════════════════════════════════════════════════════

function renderHistoryTab() {
  const all = getAllResponses();
  const entries = Object.entries(all)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  if (!entries.length) {
    return `
      <div class="empty-state" style="min-height:50vh">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-title">참여 이력이 없습니다</div>
        <div class="empty-state-desc">직무 서베이 또는 라이프사이클 서베이에 참여해 보세요.</div>
        <button class="btn btn-primary" style="margin-top:16px" id="go-survey-tab">서베이 보러가기</button>
      </div>
    `;
  }

  const techTreeState = getTechTreeState();
  const techCount = Object.keys(techTreeState).length;

  const listHtml = entries.map(e => {
    const isPulse = e.id.startsWith('pulse_');
    const jobId = isPulse ? e.id.replace('pulse_', '') : null;
    const job = jobId ? JOB_INTERESTS.find(j => j.id === jobId) : null;
    const icon = job ? job.icon : '📋';
    const color = job ? job.color : 'var(--primary)';
    const date = e.submittedAt ? new Date(e.submittedAt).toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'short', day: 'numeric'
    }) : '';
    const answerCount = typeof e.answers === 'object' ? Object.keys(e.answers).length : 0;

    return `
      <div style="display:flex;align-items:center;gap:12px;padding:14px;
        background:var(--surface);border-radius:var(--radius-sm);
        border:1px solid var(--border);margin-bottom:10px">
        <div style="width:38px;height:38px;border-radius:50%;flex-shrink:0;
          background:${color}18;display:flex;align-items:center;justify-content:center;
          font-size:1.1rem">${icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:0.9rem;color:var(--text);
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${esc(e.surveyName || e.id)}
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">
            ${date} &nbsp;·&nbsp; ${answerCount}문항 응답
            ${isPulse ? `&nbsp;·&nbsp;<span style="color:${color};font-weight:600">직무 진단</span>` : ''}
          </div>
        </div>
        <span style="font-size:1rem;flex-shrink:0">✅</span>
      </div>
    `;
  }).join('');

  return `
    <div class="fade-in">
      <!-- Summary chips -->
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        <div style="padding:8px 14px;border-radius:var(--radius-sm);background:var(--surface);
          border:1px solid var(--border);text-align:center;flex:1;min-width:80px">
          <div style="font-size:1.3rem;font-weight:800;color:var(--primary)">${entries.length}</div>
          <div style="font-size:0.7rem;color:var(--text-muted)">총 참여</div>
        </div>
        <div style="padding:8px 14px;border-radius:var(--radius-sm);background:var(--surface);
          border:1px solid var(--border);text-align:center;flex:1;min-width:80px">
          <div style="font-size:1.3rem;font-weight:800;color:#10B981">
            ${entries.filter(e => e.id.startsWith('pulse_')).length}
          </div>
          <div style="font-size:0.7rem;color:var(--text-muted)">직무 진단</div>
        </div>
        <div style="padding:8px 14px;border-radius:var(--radius-sm);background:var(--surface);
          border:1px solid var(--border);text-align:center;flex:1;min-width:80px">
          <div style="font-size:1.3rem;font-weight:800;color:#F59E0B">${techCount}</div>
          <div style="font-size:0.7rem;color:var(--text-muted)">이수 과정</div>
        </div>
      </div>

      <!-- Entry list -->
      <div style="font-size:0.78rem;font-weight:700;color:var(--text);margin-bottom:10px">
        참여 서베이 목록 (${entries.length}건)
      </div>
      ${listHtml}
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════
// Tab: 면접관 조회
// ══════════════════════════════════════════════════════════════

let _interviewerSearch = '';
let _interviewerJobFilter = '';

function renderInterviewerTab() {
  const savedJobs = _selectedJobs.length ? _selectedJobs : getSavedJobInterests();
  const savedJob  = savedJobs[0] || null;  // primary for display hint

  const jobFilterChips = [
    { id: '', label: '전체' },
    ...JOB_INTERESTS.map(j => ({ id: j.id, label: j.label, icon: j.icon, color: j.color })),
  ].map(j => {
    const active = (_interviewerJobFilter || '') === j.id;
    const color = j.color || 'var(--primary)';
    return `
      <button class="iv-filter-btn" data-filter="${j.id || ''}" style="
        flex:0 0 auto;padding:6px 12px;border-radius:var(--radius-full);
        border:1.5px solid ${active ? color : 'var(--border)'};
        background:${active ? color + '18' : 'var(--surface)'};
        color:${active ? color : 'var(--text-muted)'};
        font-size:0.78rem;font-weight:${active ? '700' : '500'};
        cursor:pointer;white-space:nowrap;
      ">${j.icon ? j.icon + ' ' : ''}${esc(j.label)}</button>
    `;
  }).join('');

  const filtered = _interviewers.filter(iv => {
    const q = _interviewerSearch.toLowerCase();
    const matchSearch = !q || iv.name.includes(q) || iv.role.toLowerCase().includes(q) ||
      iv.dept.includes(q) || iv.specialty.some(s => s.toLowerCase().includes(q));
    const matchJob = !_interviewerJobFilter || (iv.jobAreas || []).includes(_interviewerJobFilter);
    return matchSearch && matchJob;
  });

  const cards = filtered.map(iv => {
    const availColor = iv.availability === '가능' ? '#10B981' : '#F59E0B';
    return `
      <div style="padding:14px;background:var(--surface);border-radius:var(--radius-sm);
        border:1px solid var(--border);margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <div style="width:40px;height:40px;border-radius:50%;background:var(--bg);
            display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0">
            ${iv.avatar || '👤'}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:0.92rem;color:var(--text)">${esc(iv.name)}</div>
            <div style="font-size:0.75rem;color:var(--text-muted)">${esc(iv.role)} · ${esc(iv.dept)}</div>
          </div>
          <span style="flex-shrink:0;font-size:0.7rem;font-weight:700;
            padding:3px 8px;border-radius:var(--radius-full);
            background:${availColor}18;color:${availColor}">
            ${esc(iv.availability)}
          </span>
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          ${(iv.specialty || []).map(s => `
            <span style="font-size:0.7rem;padding:2px 8px;border-radius:4px;
              background:var(--bg);color:var(--text-muted);border:1px solid var(--border)">
              ${esc(s)}
            </span>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="fade-in">
      ${savedJobs.length ? `
        <div style="padding:10px 14px;background:#EEF2FF;border-radius:var(--radius-sm);
          margin-bottom:12px;font-size:0.82rem;color:var(--primary)">
          💡 관심 직무 <strong>${savedJobs.map(id => esc(JOB_INTERESTS.find(j=>j.id===id)?.label||'')).join(', ')}</strong> 기준 면접관이 강조 표시됩니다.
        </div>
      ` : ''}

      <!-- Search -->
      <div style="position:relative;margin-bottom:10px">
        <input id="iv-search" type="search" placeholder="이름, 직무, 전문분야 검색..."
          value="${esc(_interviewerSearch)}"
          style="width:100%;padding:10px 12px 10px 36px;border-radius:var(--radius-sm);
            border:1.5px solid var(--border);background:var(--surface);
            font-size:0.85rem;color:var(--text);font-family:inherit;outline:none;
            box-sizing:border-box">
        <span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);
          color:var(--text-muted);font-size:0.9rem;pointer-events:none">🔍</span>
      </div>

      <!-- Job filter chips -->
      <div style="display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin-bottom:14px;padding-bottom:4px">
        ${jobFilterChips}
      </div>

      <!-- Results -->
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:10px">
        ${filtered.length}명의 면접관
      </div>
      ${cards || `<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:0.85rem">검색 결과가 없습니다.</div>`}
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════
// Survey Runner (pulse + lifecycle)
// ══════════════════════════════════════════════════════════════

function renderRunnerShell() {
  if (_mode === 'submitted') return renderSubmitted();
  if (!_activeSurvey) return '';

  const { survey, questionIndex } = _activeSurvey;
  const questions = Array.isArray(survey.questions) ? survey.questions : [];
  const total = questions.length;

  if (!total) return `
    <div class="empty-state" style="min-height:50vh">
      <div class="empty-state-icon">📭</div>
      <div class="empty-state-title">문항이 없습니다</div>
      <button class="btn btn-primary" id="runner-cancel" style="margin-top:16px">돌아가기</button>
    </div>
  `;

  const q = questions[questionIndex];
  const pct = Math.round((questionIndex / total) * 100);
  const isLast = questionIndex === total - 1;
  const accentColor = survey._color || 'var(--primary)';

  return `
    <div class="top-bar">
      <button class="top-bar-back" id="runner-cancel" aria-label="서베이 취소">✕</button>
      <div class="top-bar-title" style="font-size:0.92rem">${esc(survey.name_ko || survey.name)}</div>
      <div style="font-size:0.75rem;color:var(--text-muted)">${questionIndex+1}/${total}</div>
    </div>

    <div class="page-content">
      <!-- Progress -->
      <div style="margin-bottom:20px">
        <div class="progress-bar">
          <div class="progress-bar-fill" style="width:${pct}%;background:${accentColor};transition:width 0.4s ease"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:4px;
          font-size:0.72rem;color:var(--text-muted)">
          <span>진행률 ${pct}%</span>
          <span>문항 ${questionIndex+1} / ${total}</span>
        </div>
      </div>

      <!-- Question -->
      <div class="card" style="padding:24px 20px;margin-bottom:20px" id="question-card">
        ${q.category ? `<div style="font-size:0.72rem;font-weight:700;color:${accentColor};
          letter-spacing:.06em;margin-bottom:8px">${esc(q.category)}</div>` : ''}
        <div style="font-size:0.97rem;font-weight:600;color:var(--text);line-height:1.6;
          word-break:keep-all;margin-bottom:20px">
          ${q.required ? '<span style="color:var(--danger);margin-right:2px">*</span>' : ''}${esc(q.text)}
        </div>
        ${renderQuestionInput(q, accentColor)}
      </div>

      <!-- Nav -->
      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost" id="runner-prev" style="flex:1;${questionIndex===0?'opacity:0.4':''}">← 이전</button>
        <button class="btn btn-primary" id="runner-next" style="flex:2;background:${accentColor}">
          ${isLast ? '제출 완료' : '다음 →'}
        </button>
      </div>
    </div>
  `;
}

function renderSubmitted() {
  const survey = _activeSurvey?.survey;
  const isJobPulse = survey?._jobId;
  const job = isJobPulse ? JOB_INTERESTS.find(j => j.id === survey._jobId) : null;

  // Compute rough score for pulse surveys
  let scoreHtml = '';
  if (isJobPulse && job) {
    const scaleAnswers = Object.entries(_answers)
      .filter(([k]) => k.startsWith(job.id + '_q'))
      .map(([, v]) => typeof v === 'number' ? v : null)
      .filter(v => v !== null);
    if (scaleAnswers.length) {
      const avg = scaleAnswers.reduce((a, b) => a + b, 0) / scaleAnswers.length;
      const pct = Math.round((avg / 5) * 100);
      const label = pct >= 80 ? '매우 적합' : pct >= 60 ? '적합' : pct >= 40 ? '보통' : '개발 필요';
      const color = pct >= 80 ? '#10B981' : pct >= 60 ? '#4F46E5' : pct >= 40 ? '#F59E0B' : '#EF4444';
      scoreHtml = `
        <div style="margin:16px 0;padding:16px;background:var(--bg);border-radius:var(--radius-sm);text-align:center">
          <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:6px">역량 자가진단 점수</div>
          <div style="font-size:2rem;font-weight:800;color:${color}">${pct}점</div>
          <div style="font-size:0.82rem;font-weight:700;color:${color}">${label}</div>
          <div style="margin-top:10px;background:var(--border);border-radius:4px;height:8px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width 1s ease"></div>
          </div>
        </div>
      `;
    }
  }

  return `
    <div class="top-bar">
      <div class="top-bar-title">제출 완료</div>
    </div>
    <div class="page-content">
      <div class="fade-in" style="text-align:center;padding:24px 0">
        <div style="font-size:3.5rem;margin-bottom:14px">✅</div>
        <div style="font-size:1.1rem;font-weight:800;color:var(--text);margin-bottom:6px">
          ${esc(survey?.name_ko || survey?.name || '서베이')} 완료!
        </div>
        <div style="font-size:0.88rem;color:var(--text-muted);margin-bottom:20px">
          응답이 저장되었습니다. 감사합니다!
        </div>
        ${scoreHtml}
        <button class="btn btn-primary btn-block" id="submitted-done" style="margin-top:8px">
          이력 확인하기
        </button>
        <button class="btn btn-ghost btn-block" id="submitted-back" style="margin-top:8px">
          서베이 목록으로
        </button>
      </div>
    </div>
  `;
}

// ── Question input renderers ──────────────────────────────────
const SCALE5_LABELS_ALL = ['', '전혀 아니다', '아니다', '보통', '그렇다', '매우 그렇다'];

function renderQuestionInput(q, accentColor) {
  const saved = _answers[q.id];

  switch (q.type) {
    case 'scale5': return `
      <div>
        <div style="display:flex;justify-content:space-between;font-size:0.68rem;
          color:var(--text-muted);margin-bottom:8px">
          <span>전혀 아니다</span><span>매우 그렇다</span>
        </div>
        <div style="display:flex;gap:8px" role="radiogroup">
          ${[1,2,3,4,5].map(n => `
            <button class="scale-btn" data-q-id="${esc(q.id)}" data-val="${n}" style="
              flex:1;min-height:48px;border-radius:var(--radius-sm);
              border:2px solid ${saved===n ? accentColor : 'var(--border)'};
              background:${saved===n ? accentColor : 'var(--surface)'};
              color:${saved===n ? '#fff' : 'var(--text-muted)'};
              font-size:0.9rem;font-weight:700;cursor:pointer;
              display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
            " title="${SCALE5_LABELS_ALL[n]}">
              <span>${n}</span>
              <span style="font-size:0.52rem;opacity:0.75">
                ${n===1?'전혀':n===3?'보통':n===5?'매우':''}
              </span>
            </button>
          `).join('')}
        </div>
      </div>`;

    case 'choice': return `
      <div style="display:flex;flex-direction:column;gap:8px" role="radiogroup">
        ${(q.options||[]).map((opt,i) => {
          const val = typeof opt==='object' ? (opt.value??opt.label??i) : opt;
          const lbl = typeof opt==='object' ? (opt.label??String(val)) : String(opt);
          const sel = saved===val || saved===String(val);
          return `
            <button class="choice-btn" data-q-id="${esc(q.id)}" data-val="${esc(String(val))}" style="
              width:100%;padding:11px 16px;text-align:left;border-radius:var(--radius-sm);
              border:2px solid ${sel ? accentColor : 'var(--border)'};
              background:${sel ? accentColor+'15' : 'var(--surface)'};
              color:${sel ? accentColor : 'var(--text)'};
              font-size:0.875rem;font-weight:${sel?'700':'500'};
              cursor:pointer;display:flex;align-items:center;gap:10px;
            " aria-pressed="${sel}">
              <span style="width:16px;height:16px;border-radius:50%;flex-shrink:0;border:2px solid ${sel?accentColor:'var(--border)'};background:${sel?accentColor:'transparent'};display:flex;align-items:center;justify-content:center">
                ${sel?'<span style="width:6px;height:6px;background:var(--card-bg);border-radius:50%;display:block"></span>':''}
              </span>
              ${esc(lbl)}
            </button>`;
        }).join('')}
      </div>`;

    case 'checklist': return `
      <div style="display:flex;flex-direction:column;gap:8px">
        ${(q.options||[]).map((opt,i) => {
          const val = typeof opt==='object' ? (opt.value??opt.label??i) : opt;
          const lbl = typeof opt==='object' ? (opt.label??String(val)) : String(opt);
          const savedArr = Array.isArray(saved) ? saved : [];
          const checked = savedArr.includes(String(val));
          return `
            <label class="checkbox-item${checked?' selected':''}" style="cursor:pointer">
              <input type="checkbox" class="checklist-cb"
                data-q-id="${esc(q.id)}" data-val="${esc(String(val))}"
                ${checked?'checked':''} style="width:18px;height:18px;accent-color:${accentColor};flex-shrink:0">
              <span class="checkbox-item-label">${esc(lbl)}</span>
            </label>`;
        }).join('')}
      </div>`;

    case 'text': return `
      <textarea maxlength="500" class="form-textarea" id="text-answer-${esc(q.id)}"
        placeholder="${esc(q.placeholder||'응답을 입력해 주세요...')}"
        rows="4" style="resize:vertical">${esc(saved||'')}</textarea>`;

    default:
      return `<div style="color:var(--text-muted);font-size:0.85rem">지원되지 않는 유형: ${esc(q.type)}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════
// Event binding
// ══════════════════════════════════════════════════════════════

function bindPageEvents() {
  if (!_root) return;

  // Back
  _root.querySelector('#survey-back')?.addEventListener('click', () => navigate('#/dashboard'));

  // Tab switching
  _root.querySelectorAll('.sv-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeTab = btn.dataset.tab;
      renderPage();
    });
  });

  // Job chips (multi-select toggle)
  _root.querySelectorAll('.job-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const jobId = btn.dataset.job;
      toggleJobInterest(jobId);
      _selectedJobs = getSavedJobInterests();
      renderPage();
    });
  });

  // Pulse survey start
  _root.querySelectorAll('.pulse-start-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const jobId = btn.dataset.jobId;
      const job = JOB_INTERESTS.find(j => j.id === jobId);
      if (!job) return;
      const survey = {
        id: `pulse_${jobId}`,
        name_ko: `${job.label} 역량 진단 서베이`,
        questions: job.questions,
        _color: job.color,
        _jobId: jobId,
      };
      _activeSurvey = { survey, questionIndex: 0 };
      _answers = {};
      _mode = 'running';
      renderPage();
    });
  });

  // Lifecycle survey start
  _root.querySelectorAll('.lifecycle-start-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const surveyId = btn.dataset.surveyId;
      const survey = (LIFECYCLE_SURVEYS || []).find(s => s.id === surveyId);
      if (!survey) return;
      if (survey.special_type === 'tech_tree') {
        showToast('테크 트리는 준비 중입니다.', 'info');
        return;
      }
      const phase = (LIFECYCLE_PHASES || []).find(p => p.id === survey.phase);
      const enriched = { ...survey, _color: phase?.color || 'var(--primary)' };
      _activeSurvey = { survey: enriched, questionIndex: 0 };
      _answers = {};
      _mode = 'running';
      renderPage();
    });
  });

  // Phase chips
  _root.querySelectorAll('.phase-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      _currentPhase = btn.dataset.phase;
      renderPage();
    });
  });

  // Go to survey tab from history empty state
  _root.querySelector('#go-survey-tab')?.addEventListener('click', () => {
    _activeTab = 'survey';
    renderPage();
  });

  // Interviewer search
  const ivSearch = _root.querySelector('#iv-search');
  if (ivSearch) {
    ivSearch.addEventListener('input', () => {
      _interviewerSearch = ivSearch.value;
      const content = _root.querySelector('#sv-content');
      if (content) content.innerHTML = renderInterviewerTab();
      bindInterviewerEvents();
    });
  }

  // Interviewer filter chips
  bindInterviewerEvents();
}

function bindInterviewerEvents() {
  if (!_root) return;
  _root.querySelectorAll('.iv-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _interviewerJobFilter = btn.dataset.filter || '';
      const content = _root.querySelector('#sv-content');
      if (content) content.innerHTML = renderInterviewerTab();
      bindInterviewerEvents();
      // Re-bind search
      const ivSearch = _root.querySelector('#iv-search');
      if (ivSearch) {
        ivSearch.addEventListener('input', () => {
          _interviewerSearch = ivSearch.value;
          const c = _root.querySelector('#sv-content');
          if (c) c.innerHTML = renderInterviewerTab();
          bindInterviewerEvents();
        });
      }
    });
  });
}

// ── Runner events ─────────────────────────────────────────────

function bindRunnerEvents() {
  if (!_root || !_activeSurvey) return;

  // Cancel / back
  _root.querySelector('#runner-cancel')?.addEventListener('click', () => {
    _mode = 'list';
    _activeSurvey = null;
    _answers = {};
    renderPage();
  });

  if (_mode === 'submitted') {
    _root.querySelector('#submitted-done')?.addEventListener('click', () => {
      _mode = 'list';
      _activeSurvey = null;
      _answers = {};
      _activeTab = 'history';
      renderPage();
    });
    _root.querySelector('#submitted-back')?.addEventListener('click', () => {
      _mode = 'list';
      _activeSurvey = null;
      _answers = {};
      renderPage();
    });
    return;
  }

  const { survey, questionIndex } = _activeSurvey;
  const questions = Array.isArray(survey.questions) ? survey.questions : [];
  const q = questions[questionIndex];
  if (!q) return;
  const accentColor = survey._color || 'var(--primary)';

  // Scale5
  _root.querySelectorAll('.scale-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const qId = btn.dataset.qId;
      const val = parseInt(btn.dataset.val, 10);
      _answers[qId] = val;
      _root.querySelectorAll(`.scale-btn[data-q-id="${qId}"]`).forEach(b => {
        const bv = parseInt(b.dataset.val, 10);
        const s = bv === val;
        b.style.borderColor = s ? accentColor : 'var(--border)';
        b.style.background  = s ? accentColor : 'var(--surface)';
        b.style.color       = s ? '#fff' : 'var(--text-muted)';
      });
    });
  });

  // Choice
  _root.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const qId = btn.dataset.qId;
      const val = btn.dataset.val;
      _answers[qId] = val;
      _root.querySelectorAll(`.choice-btn[data-q-id="${qId}"]`).forEach(b => {
        const s = b.dataset.val === val;
        b.style.borderColor = s ? accentColor : 'var(--border)';
        b.style.background  = s ? accentColor + '15' : 'var(--surface)';
        b.style.color       = s ? accentColor : 'var(--text)';
        b.style.fontWeight  = s ? '700' : '500';
        const dot = b.querySelector('span:first-child');
        if (dot) {
          dot.style.borderColor = s ? accentColor : 'var(--border)';
          dot.style.background  = s ? accentColor : 'transparent';
          dot.innerHTML = s ? '<span style="width:6px;height:6px;background:var(--card-bg);border-radius:50%;display:block"></span>' : '';
        }
      });
    });
  });

  // Checklist
  _root.querySelectorAll('.checklist-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const qId = cb.dataset.qId;
      const val = cb.dataset.val;
      const cur = Array.isArray(_answers[qId]) ? [..._answers[qId]] : [];
      if (cb.checked) { if (!cur.includes(val)) cur.push(val); }
      else { const i = cur.indexOf(val); if (i >= 0) cur.splice(i, 1); }
      _answers[qId] = cur;
      cb.closest('.checkbox-item')?.classList.toggle('selected', cb.checked);
    });
  });

  // Text
  const textEl = _root.querySelector(`#text-answer-${q.id}`);
  if (textEl) textEl.addEventListener('input', () => { _answers[q.id] = textEl.value; });

  // Prev
  _root.querySelector('#runner-prev')?.addEventListener('click', () => {
    if (questionIndex === 0) { _mode = 'list'; renderPage(); return; }
    _activeSurvey = { survey, questionIndex: questionIndex - 1 };
    renderPage();
    bindRunnerEvents();
  });

  // Next / Submit
  _root.querySelector('#runner-next')?.addEventListener('click', () => {
    if (q.required) {
      const ans = _answers[q.id];
      const empty = ans === undefined || ans === null || ans === '' || (Array.isArray(ans) && !ans.length);
      if (empty) {
        shakeCard();
        showToast('필수 문항입니다. 응답 후 진행해 주세요.', 'warning');
        return;
      }
    }
    if (questionIndex === questions.length - 1) {
      saveResponse(survey.id, { ..._answers }, {
        name: survey.name_ko || survey.name,
        phase: survey.phase || null,
        jobId: survey._jobId || null,
      });
      showToast('서베이 제출 완료! 응답해 주셔서 감사합니다. 🙏', 'success')
      addNotification({ type: 'success', title: 'survey', body: '서베이 제출 완료! 응답해 주셔서 감사합니다. 🙏' });
      _mode = 'submitted';
      renderPage();
      bindRunnerEvents();
    } else {
      _activeSurvey = { survey, questionIndex: questionIndex + 1 };
      renderPage();
      bindRunnerEvents();
    }
  });
}

function shakeCard() {
  const card = _root?.querySelector('#question-card');
  if (!card) return;
  if (!document.getElementById('shake-style')) {
    const s = document.createElement('style');
    s.id = 'shake-style';
    s.textContent = `@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}`;
    document.head.appendChild(s);
  }
  card.style.animation = '';
  requestAnimationFrame(() => { card.style.animation = 'shake 0.35s ease'; });
  const t = setTimeout(() => { if (card) card.style.animation = ''; }, 400);
  _timers.push(t);
}

// ══════════════════════════════════════════════════════════════
// mount / unmount
// ══════════════════════════════════════════════════════════════

export async function mount(root, state) {
  _root             = root;
  _activeTab        = 'survey';
  _selectedJobs     = getSavedJobInterests();
  _activeSurvey     = null;
  _answers          = {};
  _mode             = 'list';
  _timers           = [];
  _interviewerSearch     = '';
  _interviewerJobFilter  = '';
  _currentPhase     = (state && state.phase) || 'hiring';

  const employees = await loadDisplayEmployees();
  _interviewers = _buildInterviewers(employees);

  // Deep-link: direct to specific tab
  if (state && state.tab) _activeTab = state.tab;

  // Deep-link: specific survey
  if (state && state.surveyId) {
    const target = (LIFECYCLE_SURVEYS || []).find(s => s.id === state.surveyId);
    if (target) {
      _currentPhase = target.phase;
      const phase = (LIFECYCLE_PHASES || []).find(p => p.id === target.phase);
      const enriched = { ...target, _color: phase?.color || 'var(--primary)' };
      _activeSurvey = { survey: enriched, questionIndex: 0 };
      _mode = 'running';
    }
  }

  renderPage();
}

export function unmount() {
  _timers.forEach(t => clearTimeout(t));
  _timers        = [];
  _root          = null;
  _activeSurvey  = null;
  _answers       = {};
  _selectedJobs  = [];
  _currentPhase  = 'hiring';
  _mode          = 'list';
}
