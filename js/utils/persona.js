/**
 * persona.js — HR Persona System
 *
 * Persona = UX work context layer (separate from DB role which governs security).
 * One user can hold multiple personas; the active one drives nav + admin tabs.
 */

export const PERSONAS = [
  {
    id: 'employee',
    label: '직원',
    icon: '👤',
    color: '#3B82F6',
    bg: '#EFF6FF',
    description: '나의 평가, 목표, 성장을 관리합니다',
    roleMin: 'staff',
    navItems: [
      { route: '#/dashboard',   icon: '🏠', label: '홈' },
      { route: '#/diagnostics', icon: '🎯', label: '조직기여',
        related: ['#/okr', '#/goal-setting', '#/reviews', '#/peer-review', '#/self-assessment',
                  '#/probation', '#/review-appeal', '#/assessment', '#/diagnostic',
                  '#/hr-competency', '#/survey', '#/interview', '#/pulse-survey',
                  '#/results', '#/employee-survey', '#/idea-box', '#/analytics'] },
      { route: '#/growth',      icon: '📈', label: '성장',
        related: ['#/idp', '#/journey', '#/training', '#/legal-edu', '#/certification',
                  '#/edu-support', '#/language-class', '#/workshop', '#/seminar',
                  '#/mentoring', '#/mentor-matching', '#/career-coaching', '#/career-path',
                  '#/skill-inventory', '#/one-on-one', '#/modules'] },
      { route: '#/payslip',     icon: '💰', label: '보상',
        related: ['#/salary-calc', '#/salary-contract', '#/salary-raise', '#/stock-option',
                  '#/benefits', '#/benefit-enroll', '#/welfare-points', '#/welfare-shop',
                  '#/flexible-benefit', '#/kudos', '#/peer-recognition', '#/award',
                  '#/tenure-award', '#/family-event', '#/raffle', '#/points-history'] },
      { route: '#/my',          icon: '🛟', label: '지원',
        related: ['#/attendance', '#/commute', '#/leave', '#/leave/apply', '#/parental-leave',
                  '#/loa', '#/overtime-request', '#/flexible-work', '#/remote-work',
                  '#/work-from-abroad', '#/expense', '#/business-trip', '#/expense-claim',
                  '#/document-request', '#/certificate', '#/info-update', '#/emergency-contact',
                  '#/childcare', '#/relocation', '#/internal-transfer', '#/org-chart',
                  '#/notice', '#/ai-consult', '#/more', '#/system-map', '#/approval',
                  '#/room-booking', '#/parking', '#/shuttle', '#/meal-ticket', '#/it-support',
                  '#/asset', '#/supplies', '#/book-order', '#/business-card', '#/salary-raise',
                  '#/personnel-order', '#/id-card', '#/uniform', '#/desk-setup',
                  '#/remote-equipment', '#/health-exam', '#/health-program', '#/wellness-check',
                  '#/counseling', '#/green-activity', '#/safety-report', '#/harassment-report',
                  '#/club', '#/study-group', '#/coffee-chat', '#/volunteer', '#/contest',
                  '#/market', '#/vote', '#/newsletter', '#/bulletin', '#/team-building',
                  '#/team-lunch', '#/team-calendar', '#/work-report'] },
    ],
    adminTabs: [],
    adminDefaultTab: null,
  },
  {
    id: 'manager',
    label: '팀장',
    icon: '👥',
    color: '#8B5CF6',
    bg: '#F5F3FF',
    description: '팀원 성과와 평가 현황을 관리합니다',
    roleMin: 'manager',
    navItems: [
      { route: '#/dashboard', icon: '🏠', label: '홈' },
      { route: '#/manager',   icon: '👥', label: '팀관리' },
      { route: '#/executive', icon: '🎯', label: '인재현황' },
      { route: '#/admin',     icon: '📊', label: '평가현황' },
      { route: '#/modules',   icon: '🧩', label: '모듈', related: ['#/module'] },
    ],
    adminTabs: ['instances', 'teamPerf', 'intelligence'],
    adminDefaultTab: 'instances',
  },
  {
    id: 'assessor',
    label: '평가담당자',
    icon: '📋',
    color: '#059669',
    bg: '#ECFDF5',
    description: '역량 프레임워크와 평가 사이클을 설계합니다',
    roleMin: 'hr_admin',
    navItems: [
      { route: '#/dashboard', icon: '🏠', label: '홈' },
      { route: '#/admin',     icon: '📋', label: '평가관리' },
      { route: '#/modules',   icon: '🧩', label: '모듈', related: ['#/module'] },
    ],
    adminTabs: ['employees', 'instances', 'templates', 'workflow', 'policies'],
    adminDefaultTab: 'templates',
  },
  {
    id: 'ld',
    label: '교육담당자',
    icon: '🎓',
    color: '#D97706',
    bg: '#FFFBEB',
    description: '진단 Kit과 학습 현황을 관리합니다',
    roleMin: 'hr_admin',
    navItems: [
      { route: '#/dashboard',   icon: '🏠', label: '홈' },
      { route: '#/admin',       icon: '🎓', label: '교육관리' },
      { route: '#/diagnostics', icon: '🔬', label: '진단', related: ['#/diagnostic', '#/hr-competency', '#/diagnostics'] },
      { route: '#/modules',     icon: '🧩', label: '모듈', related: ['#/module'] },
    ],
    adminTabs: ['kits', 'mapping', 'aptitude'],
    adminDefaultTab: 'kits',
  },
  {
    id: 'recruiter',
    label: '채용담당자',
    icon: '📢',
    color: '#EF4444',
    bg: '#FEF2F2',
    description: '채용 공고와 지원자를 관리합니다',
    roleMin: 'hr_admin',
    navItems: [
      { route: '#/dashboard', icon: '🏠', label: '홈' },
      { route: '#/admin',     icon: '📢', label: '채용관리' },
      { route: '#/jobs',      icon: '💼', label: '채용공고' },
      { route: '#/modules',   icon: '🧩', label: '모듈', related: ['#/module'] },
    ],
    adminTabs: ['recruit', 'alumniMgmt', 'assign'],
    adminDefaultTab: 'recruit',
  },
  {
    id: 'culture',
    label: '조직문화',
    icon: '🏢',
    color: '#0EA5E9',
    bg: '#F0F9FF',
    description: '조직 분위기와 참여도를 관리합니다',
    roleMin: 'hr_admin',
    navItems: [
      { route: '#/dashboard', icon: '🏠', label: '홈' },
      { route: '#/admin',     icon: '🏢', label: '조직관리' },
      { route: '#/survey',    icon: '📝', label: '서베이' },
      { route: '#/modules',   icon: '🧩', label: '모듈', related: ['#/module'] },
    ],
    adminTabs: ['intelligence', 'teamPerf'],
    adminDefaultTab: 'intelligence',
  },
  {
    id: 'hr_admin',
    label: 'HR 관리자',
    icon: '⚙️',
    color: '#6366F1',
    bg: '#EEF2FF',
    description: '모든 HR 기능에 자유롭게 접근합니다',
    roleMin: 'hr_admin',
    navItems: null, // null = use full default MEMBER nav
    adminTabs: 'all',
    adminDefaultTab: 'assign',
  },
];

const ACTIVE_KEY = 'hr_active_persona';
const ROLE_ORDER = { staff: 0, employee: 0, manager: 1, director: 2, hr_admin: 3, admin: 3, super_admin: 4 };

export function getPersonaDef(id) {
  return PERSONAS.find(p => p.id === id) || PERSONAS[0];
}

export function getActivePersona() {
  return localStorage.getItem(ACTIVE_KEY) || 'employee';
}

export function setActivePersona(id) {
  localStorage.setItem(ACTIVE_KEY, id);
  window.dispatchEvent(new CustomEvent('hr:persona-change', { detail: { id } }));
}

export function clearActivePersona() {
  localStorage.removeItem(ACTIVE_KEY);
}

export function getUserPersonas(user) {
  if (!user) return ['employee'];

  // Explicit persona list from DB/login response
  let stored = user.personas;
  if (typeof stored === 'string') {
    try { stored = JSON.parse(stored); } catch { stored = null; }
  }
  if (Array.isArray(stored) && stored.length > 0) return stored;

  // Demo mode: all personas
  if (localStorage.getItem('hr_token') === 'demo-token') return PERSONAS.map(p => p.id);

  // Default by role
  const level = ROLE_ORDER[user.role] ?? 0;
  if (level >= 3) return ['employee', 'hr_admin'];
  if (level >= 1) return ['employee', 'manager'];
  return ['employee'];
}

// Returns nav items for persona. Appends "전환" item if user has multiple personas.
export function getPersonaNavItems(personaId, userPersonaIds = []) {
  const def = getPersonaDef(personaId);
  if (!def.navItems) return null; // signal: use default nav
  const items = [...def.navItems];
  if (userPersonaIds.length > 1) {
    items.push({ route: '#/persona-select', icon: '🔀', label: '전환' });
  }
  return items;
}

export function getPersonaAdminTabs(personaId) {
  return getPersonaDef(personaId).adminTabs || [];
}

export function getPersonaAdminDefaultTab(personaId) {
  return getPersonaDef(personaId).adminDefaultTab || 'assign';
}

export function canUsePersona(user, personaId) {
  const def = getPersonaDef(personaId);
  if (!def.roleMin || def.roleMin === 'staff') return true;
  const userLevel = ROLE_ORDER[user?.role] ?? 0;
  const reqLevel  = ROLE_ORDER[def.roleMin] ?? 0;
  return userLevel >= reqLevel;
}
