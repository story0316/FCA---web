/**
 * score.js – Score computation and display utilities
 * HR Competency OS
 */

/**
 * Computes weighted composite score from multiple rater inputs.
 * @param {number|null} self       - Self rating (1-5)
 * @param {number|null} manager    - Manager rating (1-5)
 * @param {number|null} peerAvg    - Average peer rating (1-5)
 * @param {{self: number, manager: number, peer: number}} policyWeights
 * @returns {number} weighted score rounded to 2 decimal places
 */
export function computeWeightedScore(self, manager, peerAvg, policyWeights = { self: 0.1, manager: 0.5, peer: 0.4 }) {
  let totalWeight = 0;
  let weightedSum = 0;

  if (self != null && !isNaN(self)) {
    weightedSum += self * policyWeights.self;
    totalWeight += policyWeights.self;
  }
  if (manager != null && !isNaN(manager)) {
    weightedSum += manager * policyWeights.manager;
    totalWeight += policyWeights.manager;
  }
  if (peerAvg != null && !isNaN(peerAvg)) {
    weightedSum += peerAvg * policyWeights.peer;
    totalWeight += policyWeights.peer;
  }

  if (totalWeight === 0) return 0;

  // Normalize to handle missing raters
  const score = weightedSum / totalWeight;
  return Math.round(score * 100) / 100;
}

/**
 * Determines competency level based on score.
 * @param {number} score - 1 to 5
 * @returns {'L1'|'L2'|'L3'}
 */
export function determineLevel(score) {
  if (score < 3.0) return 'L1';
  if (score < 4.0) return 'L2';
  return 'L3';
}

/**
 * Maps score to CSS color variable name.
 * @param {number} score - 1 to 5
 * @returns {string} CSS variable string
 */
export function scoreToColor(score) {
  if (score < 2.0) return 'var(--danger)';
  if (score < 3.0) return '#F97316'; // orange
  if (score < 4.0) return 'var(--warning)';
  if (score < 4.5) return 'var(--info)';
  return 'var(--success)';
}

/**
 * Maps score to hex color for canvas rendering.
 * @param {number} score - 1 to 5
 * @returns {string} hex color
 */
export function scoreToHex(score) {
  if (score < 2.0) return '#EF4444';
  if (score < 3.0) return '#F97316';
  if (score < 4.0) return '#F59E0B';
  if (score < 4.5) return '#3B82F6';
  return '#10B981';
}

/**
 * Maps score to Korean label string.
 * @param {number} score - 1 to 5
 * @returns {string}
 */
export function scoreToLabel(score) {
  if (score < 2.0) return '미흡';
  if (score < 3.0) return '보완 필요';
  if (score < 4.0) return '보통';
  if (score < 4.5) return '우수';
  return '탁월';
}

/**
 * Maps level string to Korean display label.
 */
export function levelToLabel(level) {
  const map = { L1: 'Level 1', L2: 'Level 2', L3: 'Level 3' };
  return map[level] || level;
}

/**
 * Maps level string to Korean description.
 */
export function levelToDesc(level) {
  const map = {
    L1: '역량 개발 시작 단계',
    L2: '기본 역량 보유 단계',
    L3: '역량 전문가 단계',
  };
  return map[level] || '';
}

/**
 * Computes gap between as_is and to_be scores.
 * Positive gap means to_be > as_is (needs development).
 */
export function computeGap(asIs, toBe) {
  if (asIs == null || toBe == null) return 0;
  return Math.round((toBe - asIs) * 100) / 100;
}

/**
 * Sorts competencies by gap descending (biggest gap first).
 */
export function sortByGap(competencies) {
  return [...competencies].sort((a, b) => {
    const gapA = computeGap(a.as_is_score, a.to_be_score);
    const gapB = computeGap(b.as_is_score, b.to_be_score);
    return gapB - gapA;
  });
}

/**
 * Determines IDP priority based on gap size.
 */
export function gapToPriority(gap) {
  if (gap >= 1.5) return 'urgent';    // 즉시 보완
  if (gap >= 0.5) return 'short';     // 단기 개발
  return 'maintain';                   // 유지 강화
}

/**
 * Korean priority labels
 */
export const PRIORITY_LABELS = {
  urgent:   '🔴 즉시 보완',
  short:    '🟡 단기 개발',
  maintain: '🟢 유지 강화',
};

/**
 * Rating labels for 1-5 scale (Korean)
 */
export const RATING_LABELS = {
  1: '매우 미흡',
  2: '미흡',
  3: '보통',
  4: '우수',
  5: '탁월',
};

/**
 * Format score with one decimal place.
 */
export function formatScore(score) {
  if (score == null || isNaN(score)) return '-';
  return Number(score).toFixed(1);
}
