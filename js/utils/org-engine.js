/**
 * org-engine.js — 조직 트리 계산 헬퍼
 */

const LS_ORG = 'hr_org_structure';

const LEGACY_ORG_MANAGER_IDS = new Set(['EMP_CEO', 'EMP003', 'EMP004', 'EMP005', 'EMP006', 'EMP007', 'EMP008', 'EMP009', 'EMP010']);
const EMPTY_ORG = {
  departments: [],
  positions: ['인턴', '사원', '주임', '대리', '과장', '차장', '부장', '이사', '상무', '전무', '대표'],
  managers: {},
};

export function getOrgStructure() {
  const saved = localStorage.getItem(LS_ORG);
  if (!saved) return EMPTY_ORG;
  try {
    const org = JSON.parse(saved);
    const mgrs = org.managers || {};
    const isLegacy = Object.keys(mgrs).every(k => LEGACY_ORG_MANAGER_IDS.has(k)) && Object.keys(mgrs).length > 0 && org.departments?.some(d => d.id === 'DEPT_CEO');
    if (isLegacy) { localStorage.removeItem(LS_ORG); return EMPTY_ORG; }
    return org;
  } catch { return EMPTY_ORG; }
}

export function saveOrgStructure(org) {
  localStorage.setItem(LS_ORG, JSON.stringify(org));
}

/**
 * 부서 트리 빌드 (DFS)
 * @returns {Array<{dept, children, depth}>}
 */
export function buildTree(departments, parentId = null, depth = 0) {
  return departments
    .filter(d => d.parentId === parentId)
    .map(dept => ({
      dept,
      depth,
      children: buildTree(departments, dept.id, depth + 1),
    }));
}

/**
 * 트리를 선형 배열로 평탄화 (DFS pre-order)
 */
export function flattenTree(nodes) {
  const result = [];
  for (const node of nodes) {
    result.push(node);
    result.push(...flattenTree(node.children));
  }
  return result;
}

/**
 * 전체 인원수 합산 (하위 포함)
 */
export function totalHeadcount(deptId, departments) {
  const subtree = getAllDescendants(deptId, departments);
  return subtree.reduce((s, d) => s + (d.headcount || 0), 0)
    + (departments.find(d => d.id === deptId)?.headcount || 0);
}

function getAllDescendants(deptId, departments) {
  const children = departments.filter(d => d.parentId === deptId);
  return children.flatMap(c => [c, ...getAllDescendants(c.id, departments)]);
}

export function getTotalHeadcount(departments) {
  return departments
    .filter(d => d.parentId === null)
    .reduce((s, d) => s + totalHeadcount(d.id, departments), 0);
}
