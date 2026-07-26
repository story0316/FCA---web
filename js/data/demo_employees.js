/**
 * demo_employees.js — DB 기반 직원 데이터 로더
 *
 * 이전: 하드코딩 더미 배열 (박서연, 이준혁 등 — DB와 무관한 픽션 데이터)
 * 현재: api.employees.list()를 통해 공통 DB(integrated_company.db)의 실제 직원 데이터를 로드
 *
 * 공통 DB 단일 진실점:
 *   organizations, users, user_profiles, growth_history → integrated_company.db
 *   평가·OKR·IDP → hr_competency.db (FC 고유)
 *
 * 하위 호환: DEMO_EMPLOYEES 심볼을 그대로 export하되 빈 배열로 초기화.
 * 사용처(headcount-plan.js, talent-pool-admin.js 등)는 loadEmployees()를 사용해야 함.
 */

import { api } from '../api.js';

// ── 하위 호환용 정적 내보내기 (직접 사용 금지 — loadEmployees() 사용) ──────
export let DEMO_EMPLOYEES = [];

/**
 * 현재 로그인 사용자의 org_id 기준으로 공통 DB에서 직원 목록을 로드한다.
 * API 실패 시 localStorage 캐시 → 빈 배열 순으로 폴백한다.
 *
 * @param {string} [orgId] 조직 ID (생략 시 hr_user.org_id 자동 참조)
 * @param {string} [status='MEMBER'] 직원 상태 필터
 * @returns {Promise<Array>} 직원 객체 배열 (api.employees 응답 구조)
 */
export async function loadEmployees(orgId, status = 'MEMBER') {
  try {
    const user = JSON.parse(localStorage.getItem('hr_user') || '{}');
    const oid  = orgId || user.org_id;
    if (!oid) return [];

    // 관리자 전체 목록 시도 → 권한 없으면 공개 디렉터리로 폴백
    let employees = await api.employees.list(oid, { status });
    if (!employees || !employees.length) {
      employees = await api.employees.directory(oid);
    }
    if (employees && employees.length) {
      localStorage.setItem(`_emp_cache_${oid}`, JSON.stringify(employees));
      DEMO_EMPLOYEES = employees;
      return employees;
    }
  } catch (_) { /* 네트워크 오류 → 캐시 시도 */ }

  // 오프라인 폴백: 마지막으로 로드된 캐시 사용
  try {
    const user = JSON.parse(localStorage.getItem('hr_user') || '{}');
    const oid  = orgId || user.org_id;
    const cached = JSON.parse(localStorage.getItem(`_emp_cache_${oid}`) || '[]');
    DEMO_EMPLOYEES = cached;
    return cached;
  } catch (_) {
    return [];
  }
}

/**
 * 직원 ID로 단일 직원을 로드한다.
 * @param {string} userId
 */
export async function loadEmployee(userId) {
  try {
    return await api.employees.get(userId);
  } catch (_) {
    return null;
  }
}

/**
 * DB 직원 레코드를 레거시 DEMO_EMPLOYEES 형식으로 변환한다.
 * (org-chart, talent-pool 등 레거시 컬럼명 호환용)
 *
 * DB 컬럼       → 레거시 컬럼
 * name_ko      → name
 * department   → dept
 * level_code   → level
 * hire_date    → hireDate / tenure(개월수)
 * enps_score   → enpsScore
 * enpsHistory  → enpsHistory (array)
 * avatar_url   → avatar
 */
export function toDisplayEmployee(emp) {
  const hireDate   = emp.hire_date ? new Date(emp.hire_date) : null;
  const tenureMonths = hireDate
    ? Math.floor((Date.now() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
    : (emp.years_experience || 0) * 12;

  return {
    id:                 emp.id,
    name:               emp.name_ko,
    dept:               emp.department || '미지정',
    role:               _roleLabel(emp.role),
    level:              emp.level_code || 'L1',
    managerId:          emp.manager_id || null,
    avatar:             emp.avatar_url || emp.avatar || '👤',
    tenure:             tenureMonths,
    hireDate:           emp.hire_date || null,
    lastAssessmentDate: emp.last_assessment_date || emp.lastAssessmentDate || null,
    lastIdpUpdate:      emp.lastIdpUpdate || null,
    competencyScore:    emp.competencyScore ?? emp.competency_score ?? 0,
    enpsScore:          emp.enps_score ?? emp.enpsScore ?? null,
    enpsHistory:        Array.isArray(emp.enpsHistory) ? emp.enpsHistory : [],
    keyCompetencies:    emp.keyCompetencies || [],
    family_id:          emp.family_id || null,
    org_id:             emp.org_id,
    email:              emp.email,
    user_status:        emp.user_status || 'MEMBER',
    // 원본 레코드도 보존
    _raw: emp,
  };
}

/**
 * loadEmployees() 결과를 toDisplayEmployee()로 일괄 변환
 */
export async function loadDisplayEmployees(orgId, status = 'MEMBER') {
  const emps = await loadEmployees(orgId, status);
  return emps.map(toDisplayEmployee);
}

function _roleLabel(role) {
  const MAP = {
    director:  '디렉터',
    manager:   '매니저',
    hr_admin:  'HR 어드민',
    staff:     '팀원',
    admin:     '관리자',
  };
  return MAP[role] || role;
}

// ── 레거시 MGR_NODE / KEY_ROLES — 동적 생성으로 교체 예정 ───────────────────
// 기존 참조 코드가 런타임 오류 없이 동작하도록 빈 구조 유지
export const MGR_NODE = null;   // 사용처에서 로그인 사용자로 교체할 것
export const KEY_ROLES = [];    // 추후 DB succession_plans 테이블 연동 예정
