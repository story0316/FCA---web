/**
 * retention.js – Retention risk calculator
 * Uses employee signals to compute a 0-100 risk score.
 */

const DAY_MS = 1000 * 60 * 60 * 24;

function daysSince(dateStr) {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / DAY_MS);
}

/**
 * Calculates retention risk for a single employee.
 * @param {object} emp - employee object from demo_employees.js
 * @returns {{ score: number, level: 'HIGH'|'MEDIUM'|'LOW', signals: string[], actions: string[] }}
 */
export function calcRetentionRisk(emp) {
  let score = 0;
  const signals = [];
  const actions = [];

  // Signal 1: No competency assessment in 6+ months (+35)
  const assessDays = daysSince(emp.lastAssessmentDate);
  if (assessDays > 180) {
    score += 35;
    signals.push(`역량 진단 ${Math.round(assessDays / 30)}개월 미실시`);
    actions.push('역량 진단 실시 권장');
  }

  // Signal 2: Consecutive eNPS drop (+35)
  const h = emp.enpsHistory || [];
  if (h.length >= 2 && h[h.length - 1] < h[h.length - 2]) {
    score += 35;
    const latest = h[h.length - 1];
    signals.push(`eNPS ${h.join(' → ')} (연속 하락)`);
    if (latest <= 4) actions.push('1:1 면담 즉시 실시');
    else actions.push('팀 분위기 점검');
  }

  // Signal 3: No IDP update in 3+ months (+30)
  const idpDays = daysSince(emp.lastIdpUpdate);
  if (idpDays > 90) {
    score += 30;
    signals.push(`IDP ${Math.round(idpDays / 30)}개월 미갱신`);
    actions.push('IDP 업데이트 요청');
  }

  const level = score >= 70 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW';
  return { score, level, signals, actions };
}

/**
 * Returns all employees sorted by risk score (descending).
 */
export function getRankedRisks(employees) {
  return employees
    .map(emp => ({ emp, risk: calcRetentionRisk(emp) }))
    .sort((a, b) => b.risk.score - a.risk.score);
}

/**
 * Computes org-level summary stats.
 */
export function getOrgHealthSummary(employees) {
  const ranked = getRankedRisks(employees);
  const highRisk   = ranked.filter(r => r.risk.level === 'HIGH').length;
  const mediumRisk = ranked.filter(r => r.risk.level === 'MEDIUM').length;

  const avgScore = employees.reduce((s, e) => s + (e.competencyScore || 0), 0) / employees.length;
  const l3Count  = employees.filter(e => e.level === 'L3').length;
  const l3Rate   = Math.round((l3Count / employees.length) * 100);

  // Latest eNPS: average of last value in each employee's history
  const enpsValues = employees.map(e => (e.enpsHistory || []).slice(-1)[0]).filter(Boolean);
  const avgEnps = enpsValues.length
    ? Math.round((enpsValues.reduce((s, v) => s + v, 0) / enpsValues.length) * 10) / 10
    : 0;

  // Org health score: starts at 100, deduct for risks
  const orgHealth = Math.max(0, 100 - highRisk * 18 - mediumRisk * 8);

  return { orgHealth, highRisk, mediumRisk, l3Rate, avgEnps, avgScore: Math.round(avgScore * 10) / 10 };
}

export const RISK_COLOR = {
  HIGH:   'var(--danger)',
  MEDIUM: 'var(--warning)',
  LOW:    'var(--success)',
};

export const RISK_LABEL = {
  HIGH:   '🔴 고위험',
  MEDIUM: '🟡 주의',
  LOW:    '🟢 안정',
};
