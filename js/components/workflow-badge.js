/**
 * workflow-badge.js – Workflow status badge renderer
 * HR Competency OS
 */

const STATUS_MAP = {
  draft:           { label: '초안',          badge: 'badge-gray',    icon: '📝' },
  open:            { label: '진행 중',        badge: 'badge-info',    icon: '🔵' },
  self_assessment: { label: '자가 평가',      badge: 'badge-warning', icon: '⚡' },
  manager_review:  { label: '관리자 검토',    badge: 'badge-orange',  icon: '👔' },
  peer_review:     { label: '동료 평가',      badge: 'badge-info',    icon: '👥' },
  calibration:     { label: '조율 중',        badge: 'badge-purple',  icon: '⚖️' },
  hr_approval:     { label: 'HR 승인',        badge: 'badge-primary', icon: '🏛️' },
  finalized:       { label: '완료',           badge: 'badge-success', icon: '✅' },
  cancelled:       { label: '취소됨',         badge: 'badge-danger',  icon: '❌' },
};

/**
 * Returns a <span> element styled as a workflow status badge.
 * @param {string} status
 * @param {boolean} showIcon
 * @returns {HTMLSpanElement}
 */
export function renderWorkflowBadge(status, showIcon = true) {
  const config = STATUS_MAP[status] || {
    label: status || '알 수 없음',
    badge: 'badge-gray',
    icon:  '❓',
  };

  const span = document.createElement('span');
  span.className = `badge ${config.badge}`;
  span.setAttribute('title', config.label);
  span.innerHTML = `${showIcon ? config.icon + ' ' : ''}${config.label}`;
  return span;
}

/**
 * Returns the Korean label for a status string.
 */
export function statusLabel(status) {
  return STATUS_MAP[status]?.label || status;
}

/**
 * Returns all workflow steps in order for the stepper UI.
 */
export function getWorkflowSteps(purpose = 'annual') {
  if (purpose === 'peer_only') {
    return [
      { key: 'open',            label: '시작' },
      { key: 'peer_review',     label: '동료 평가' },
      { key: 'calibration',     label: '조율' },
      { key: 'finalized',       label: '완료' },
    ];
  }
  return [
    { key: 'open',            label: '시작' },
    { key: 'self_assessment', label: '자가 평가' },
    { key: 'manager_review',  label: '관리자 검토' },
    { key: 'calibration',     label: '조율' },
    { key: 'hr_approval',     label: 'HR 승인' },
    { key: 'finalized',       label: '완료' },
  ];
}

/**
 * Renders a horizontal workflow stepper into a container element.
 * @param {HTMLElement} container
 * @param {string} currentStatus
 * @param {string} purpose
 */
export function renderWorkflowStepper(container, currentStatus, purpose = 'annual') {
  const steps = getWorkflowSteps(purpose);
  const currentIdx = steps.findIndex(s => s.key === currentStatus);

  container.innerHTML = '';
  container.className = 'workflow-stepper';

  steps.forEach((step, i) => {
    // Line before (skip first)
    if (i > 0) {
      const line = document.createElement('div');
      line.className = `step-line${i <= currentIdx ? ' done' : ''}`;
      container.appendChild(line);
    }

    const item = document.createElement('div');
    const isDone   = i < currentIdx;
    const isActive = i === currentIdx;
    item.className = `step-item${isDone ? ' done' : ''}${isActive ? ' active' : ''}`;

    item.innerHTML = `
      <div class="step-circle">${isDone ? '✓' : i + 1}</div>
      <div class="step-label">${step.label}</div>
    `;
    container.appendChild(item);
  });
}
