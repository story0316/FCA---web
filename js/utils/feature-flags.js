/**
 * feature-flags.js — 기능 패키지 토글 시스템
 *
 * 관리자가 어드민 패널에서 기능 패키지를 켜고 끌 수 있음.
 * 비활성 패키지: 하단 Nav 숨김 + 라우터에서 "준비 중" 화면 반환.
 * 설정은 localStorage(hr_feature_flags)에 즉시 저장.
 */

const STORAGE_KEY = 'hr_feature_flags';

// ── 패키지 레지스트리 ──────────────────────────────────────────
export const FEATURE_PACKAGES = [
  {
    key:         'diagnostics',
    label:       '역량 진단',
    icon:        '🔬',
    description: '역량 카드 진단, 진단 결과, HR 직무역량 트리, 진단Kit',
    defaultOn:   true,
    routes:      ['#/diagnostics', '#/assessment', '#/results', '#/hr-competency', '#/diagnostic'],
    navKeys:     ['#/diagnostics'],
  },
  {
    key:         'growth',
    label:       '내 성장',
    icon:        '📈',
    description: '내성장 탭 (역량·IDP·성과), 내여정, IDP 개발계획',
    defaultOn:   true,
    routes:      ['#/growth', '#/idp', '#/journey'],
    navKeys:     ['#/growth'],
  },
  {
    key:         'performance',
    label:       '성과 관리',
    icon:        '🎯',
    description: 'OKR 목표 설정·체크인, 성과 리뷰, 1:1 미팅 기록',
    defaultOn:   true,
    routes:      ['#/goals', '#/reviews'],
    navKeys:     ['#/goals', '#/reviews'],
  },
  {
    key:         'analytics',
    label:       '조직 분석',
    icon:        '📊',
    description: '역량 분포 히트맵, OKR×역량 상관 분석, 경영진 인재 현황',
    defaultOn:   true,
    routes:      ['#/analytics', '#/executive'],
    navKeys:     ['#/analytics'],
  },
  {
    key:         'survey',
    label:       '서베이',
    icon:        '📝',
    description: '생애주기 서베이 (입사·재직·퇴직 단계별)',
    defaultOn:   true,
    routes:      ['#/survey'],
    navKeys:     [],
  },
  {
    key:         'interview',
    label:       'AI 인터뷰',
    icon:        '🤖',
    description: 'AI 역량 인터뷰 (시뮬레이션 기반)',
    defaultOn:   true,
    routes:      ['#/interview'],
    navKeys:     [],
  },
  {
    key:         'recruiting',
    label:       '채용 관리',
    icon:        '📢',
    description: '채용공고, 지원자 세그먼트 전체, 어드민 채용 탭',
    defaultOn:   true,
    routes:      ['#/jobs', '#/applicant', '#/applicant/apply', '#/applicant/profile'],
    navKeys:     ['#/jobs'],
    adminTabs:   ['recruit'],
  },
  {
    key:         'alumni',
    label:       '동문 관리',
    icon:        '🏅',
    description: '동문 대시보드, 재입사 협의, 어드민 동문 탭',
    defaultOn:   true,
    routes:      ['#/alumni', '#/alumni/boomerang'],
    navKeys:     ['#/alumni', '#/alumni/boomerang'],
    adminTabs:   ['alumniMgmt'],
  },
  {
    key:         'manager',
    label:       '팀장 뷰',
    icon:        '👔',
    description: '팀장 전용 팀원 역량·성과 현황 대시보드',
    defaultOn:   true,
    routes:      ['#/manager'],
    navKeys:     [],
  },
];

// ── 내부 상태 ──────────────────────────────────────────────────
let _flags = null;

function _load() {
  if (_flags) return _flags;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    _flags = raw ? JSON.parse(raw) : _defaults();
  } catch {
    _flags = _defaults();
  }
  return _flags;
}

function _defaults() {
  const d = {};
  for (const pkg of FEATURE_PACKAGES) d[pkg.key] = pkg.defaultOn;
  return d;
}

// ── Public API ─────────────────────────────────────────────────

/** 패키지 키가 활성화되어 있는지 반환 */
export function isEnabled(key) {
  const flags = _load();
  // 키가 없으면 defaultOn 적용
  if (!(key in flags)) {
    const pkg = FEATURE_PACKAGES.find(p => p.key === key);
    return pkg ? pkg.defaultOn : true;
  }
  return Boolean(flags[key]);
}

/** route 문자열이 활성 패키지에 속하는지 반환 */
export function isRouteEnabled(route) {
  for (const pkg of FEATURE_PACKAGES) {
    if (pkg.routes.includes(route) && !isEnabled(pkg.key)) return false;
  }
  return true;
}

/** nav 항목 route가 활성 패키지에 속하는지 반환 */
export function isNavEnabled(route) {
  for (const pkg of FEATURE_PACKAGES) {
    if (pkg.navKeys.includes(route) && !isEnabled(pkg.key)) return false;
  }
  return true;
}

/** 어드민 탭 key가 활성 패키지에 속하는지 반환 */
export function isAdminTabEnabled(tabKey) {
  for (const pkg of FEATURE_PACKAGES) {
    if ((pkg.adminTabs || []).includes(tabKey) && !isEnabled(pkg.key)) return false;
  }
  return true;
}

/** 플래그 맵 전체 반환 (어드민 UI용) */
export function getAllFlags() {
  return { ..._load() };
}

/** 플래그 업데이트 후 저장 */
export function setFlag(key, value) {
  const flags = _load();
  flags[key] = Boolean(value);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
  _flags = flags;
}

/** 여러 플래그 한번에 저장 */
export function saveFlags(map) {
  const flags = _load();
  Object.assign(flags, map);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
  _flags = flags;
}

/** 전체 초기화 (기본값으로 되돌리기) */
export function resetFlags() {
  _flags = _defaults();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_flags));
}
