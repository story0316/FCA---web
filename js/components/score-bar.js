/**
 * score-bar.js – Animated horizontal score bar
 * HR Competency OS
 */

/**
 * Renders an animated score bar element.
 * @param {string} label
 * @param {number} score     – raw score value
 * @param {number} maxScore  – max value (default 100)
 * @param {string} color     – CSS color or variable (default: var(--primary))
 * @returns {HTMLElement}
 */
export function renderScoreBar(label, score, maxScore = 100, color = 'var(--primary)') {
  const pct = maxScore > 0 ? Math.min((score / maxScore) * 100, 100) : 0;

  const container = document.createElement('div');
  container.className = 'score-bar';

  container.innerHTML = `
    <div class="score-bar-header">
      <span class="score-bar-label">${escapeHtml(label)}</span>
      <span class="score-bar-value" style="color:${color}">${Number(score).toFixed(1)}</span>
    </div>
    <div class="score-bar-track">
      <div class="score-bar-fill" style="width:0%;background:${color}"></div>
    </div>
  `;

  // Animate fill on next frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const fill = container.querySelector('.score-bar-fill');
      if (fill) fill.style.width = `${pct}%`;
    });
  });

  return container;
}

/**
 * Renders multiple score bars for AI interview results.
 * @param {{label: string, score: number, maxScore?: number, color?: string}[]} items
 * @returns {HTMLElement}
 */
export function renderScoreBars(items) {
  const wrapper = document.createElement('div');
  wrapper.className = 'score-bars-wrapper';

  for (const item of items) {
    const bar = renderScoreBar(
      item.label,
      item.score,
      item.maxScore || 100,
      item.color   || 'var(--primary)'
    );
    wrapper.appendChild(bar);
  }

  return wrapper;
}

/**
 * Standard AI interview score breakdown labels.
 */
export const INTERVIEW_SCORE_LABELS = {
  context_score:  { label: '맥락 이해도',  color: '#4F46E5' },
  action_score:   { label: '실행의 구체성', color: '#10B981' },
  risk_score:     { label: '리스크 센싱',  color: '#F59E0B' },
};

/**
 * Renders the standard three interview score bars.
 * @param {{ context_score, action_score, risk_score }} scores
 * @returns {HTMLElement}
 */
export function renderInterviewScoreBars(scores) {
  const items = Object.entries(INTERVIEW_SCORE_LABELS)
    .filter(([key]) => scores[key] != null)
    .map(([key, cfg]) => ({
      label:    cfg.label,
      score:    scores[key],
      maxScore: 100,
      color:    cfg.color,
    }));

  return renderScoreBars(items);
}

function escapeHtml(str) {
  return String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
