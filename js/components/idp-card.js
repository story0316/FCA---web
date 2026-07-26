/**
 * idp-card.js – IDP (Individual Development Plan) card renderer
 * HR Competency OS
 */

const ACTION_ICONS = {
  study:    '📖',
  training: '🎓',
  mentoring:'👥',
  project:  '🚀',
  rotation: '🔄',
  coaching: '💬',
  workshop: '🏫',
  reading:  '📚',
  online:   '💻',
  default:  '🌱',
};

const ACTION_LABELS = {
  study:    '자기학습',
  training: '교육훈련',
  mentoring:'멘토링',
  project:  '프로젝트',
  rotation: '순환근무',
  coaching: '코칭',
  workshop: '워크숍',
  reading:  '독서',
  online:   '온라인강의',
};

/**
 * Renders a single IDP item card.
 * @param {{
 *   id?: string,
 *   competency_name?: string,
 *   competency_id?: string,
 *   action_type?: string,
 *   resource_title?: string,
 *   resource_url?: string,
 *   gap?: number,
 *   as_is?: number,
 *   to_be?: number,
 *   target_date?: string,
 *   status?: string,
 *   priority?: string,
 *   description?: string
 * }} item
 * @returns {HTMLElement}
 */
export function renderIdpCard(item) {
  const {
    competency_name = '역량',
    action_type     = 'default',
    resource_title  = '학습 리소스',
    resource_url,
    gap             = 0,
    as_is,
    to_be,
    target_date,
    status          = 'pending',
    description     = '',
  } = item;

  const icon      = ACTION_ICONS[action_type]  || ACTION_ICONS.default;
  const typeLabel = ACTION_LABELS[action_type] || action_type;
  const gapValue  = typeof gap === 'number' ? gap : (to_be && as_is ? to_be - as_is : 0);
  const isDone    = status === 'done' || status === 'completed';

  const card = document.createElement('div');
  card.className = 'idp-card fade-in';
  card.setAttribute('role', 'article');

  card.innerHTML = `
    <div class="idp-card-icon" style="${isDone ? 'background:rgba(16,185,129,0.1)' : ''}">
      ${isDone ? '✅' : icon}
    </div>
    <div class="idp-card-body">
      <div class="idp-card-competency">${escapeHtml(competency_name)}</div>
      <div class="idp-card-title" style="${isDone ? 'text-decoration:line-through;color:var(--text-muted)' : ''}">
        ${escapeHtml(resource_title)}
      </div>
      <div class="idp-card-meta">
        <span class="badge badge-gray" style="font-size:0.7rem">${escapeHtml(typeLabel)}</span>
        ${gapValue > 0.05 ? `
          <span class="idp-card-gap">
            <span>▲</span> GAP ${Number(gapValue).toFixed(1)}
          </span>` : ''}
        ${target_date ? `
          <span class="idp-card-date">
            📅 ${formatDate(target_date)}
          </span>` : ''}
        ${isDone ? `<span class="badge badge-success">완료</span>` : ''}
      </div>
      ${description ? `
        <div style="margin-top:6px;font-size:0.78rem;color:var(--text-muted);line-height:1.5">
          ${escapeHtml(description)}
        </div>` : ''}
    </div>
    ${resource_url ? `
      <a href="${escapeHtml(resource_url)}" target="_blank" rel="noopener"
         style="color:var(--primary);font-size:1.1rem;align-self:center;text-decoration:none"
         aria-label="리소스 열기">→</a>` : ''}
  `;

  // Mark done on double-tap/click
  card.addEventListener('dblclick', () => {
    const newDone = !isDone;
    item.status = newDone ? 'done' : 'pending';
    const updated = renderIdpCard(item);
    card.replaceWith(updated);
  });

  return card;
}

/**
 * Groups IDP items by priority into sections.
 * @param {Array} items
 * @returns {{ urgent: Array, short: Array, maintain: Array }}
 */
export function groupByPriority(items) {
  const groups = { urgent: [], short: [], maintain: [] };
  for (const item of items) {
    const priority = item.priority || inferPriority(item);
    if (groups[priority]) {
      groups[priority].push(item);
    } else {
      groups.short.push(item);
    }
  }
  return groups;
}

function inferPriority(item) {
  const gap = item.gap ?? ((item.to_be || 0) - (item.as_is || 0));
  if (gap >= 1.5) return 'urgent';
  if (gap >= 0.5) return 'short';
  return 'maintain';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
  } catch {
    return dateStr;
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
