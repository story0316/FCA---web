/**
 * ask-popup.js – ASK (Ability/Skill/Knowledge) detail modal
 * HR Competency OS
 */

let activeOverlay = null;

/**
 * Shows the ASK popup for a competency.
 * @param {Object} competency – full competency object including ask fields
 * @param {{
 *   ability?: {L1: string, L2: string, L3: string},
 *   skill?:   {L1: string, L2: string, L3: string},
 *   knowledge?:{L1: string, L2: string, L3: string},
 *   items?: Array
 * }} askData – optional pre-fetched ASK data (overrides competency.ask)
 */
export function showAskPopup(competency, askData = null) {
  hideAskPopup();

  const ask = askData || competency?.ask || {};
  const name = competency?.name_ko || competency?.name || '역량 상세';
  const category = competency?.category || '';
  const currentScore = competency?.as_is_score;
  const targetScore  = competency?.to_be_score;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', name);

  overlay.innerHTML = `
    <div class="modal-content ask-popup-content">
      <div class="modal-handle"></div>
      <button class="modal-close" aria-label="닫기" id="ask-close">✕</button>

      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-right:36px">
        <div>
          <div class="modal-title" style="margin-bottom:4px">${escapeHtml(name)}</div>
          ${category ? `<span class="badge badge-primary">${escapeHtml(category)}</span>` : ''}
        </div>
      </div>

      ${(currentScore != null || targetScore != null) ? `
        <div style="display:flex;gap:12px;margin-bottom:20px">
          ${currentScore != null ? `
            <div class="stat-chip">
              <div class="stat-chip-value" style="color:var(--primary)">${Number(currentScore).toFixed(1)}</div>
              <div class="stat-chip-label">현재 점수</div>
            </div>` : ''}
          ${targetScore != null ? `
            <div class="stat-chip">
              <div class="stat-chip-value" style="color:var(--success)">${Number(targetScore).toFixed(1)}</div>
              <div class="stat-chip-label">목표 점수</div>
            </div>` : ''}
          ${(currentScore != null && targetScore != null) ? `
            <div class="stat-chip">
              <div class="stat-chip-value" style="color:${targetScore > currentScore ? 'var(--danger)' : 'var(--success)'}">
                ${targetScore > currentScore ? '+' : ''}${(targetScore - currentScore).toFixed(1)}
              </div>
              <div class="stat-chip-label">GAP</div>
            </div>` : ''}
        </div>` : ''}

      ${buildAskSection('💪 능력 (Ability)', ask.ability)}
      ${buildAskSection('🛠 스킬 (Skill)',   ask.skill)}
      ${buildAskSection('📚 지식 (Knowledge)', ask.knowledge)}

      ${(!ask.ability && !ask.skill && !ask.knowledge) ? buildFallbackItems(competency) : ''}

      <button class="btn btn-primary btn-block" id="ask-ok" style="margin-top:8px">확인</button>
    </div>
  `;

  document.body.appendChild(overlay);
  activeOverlay = overlay;

  // Trigger show animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add('visible'));
  });

  // Close handlers
  overlay.querySelector('#ask-close').addEventListener('click', hideAskPopup);
  overlay.querySelector('#ask-ok').addEventListener('click',    hideAskPopup);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideAskPopup();
  });

  // Trap focus
  const focusable = overlay.querySelectorAll('button');
  if (focusable.length) focusable[0].focus();

  // Keyboard close
  const keyHandler = (e) => {
    if (e.key === 'Escape') { hideAskPopup(); document.removeEventListener('keydown', keyHandler); }
  };
  document.addEventListener('keydown', keyHandler);
}

function buildAskSection(title, data) {
  if (!data) return '';

  const levels = ['L1', 'L2', 'L3'];
  const levelColors = { L1: 'l1', L2: 'l2', L3: 'l3' };
  const levelLabels = { L1: '기초', L2: '중급', L3: '전문' };

  // data can be object {L1, L2, L3} or array of strings
  let items = [];
  if (Array.isArray(data)) {
    items = data.map((text, i) => ({
      level: levels[i] || `L${i + 1}`,
      text,
    }));
  } else {
    items = levels
      .filter((l) => data[l])
      .map((l) => ({ level: l, text: data[l] }));
  }

  if (!items.length) return '';

  return `
    <div class="ask-popup-section">
      <div class="ask-popup-section-title">${title}</div>
      ${items.map(({ level, text }) => `
        <div class="ask-popup-item">
          <span class="ask-popup-item-level ${levelColors[level] || ''}" title="${level}">
            ${levelLabels[level] || level}
          </span>
          <span class="ask-popup-item-text">${escapeHtml(text)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function buildFallbackItems(competency) {
  // Show level_indicators or definition if no ASK data
  const def = competency?.definition_ko || competency?.definition || '';
  const indicators = competency?.level_indicators || {};

  if (!def && !Object.keys(indicators).length) return `
    <div class="empty-state" style="padding:24px 0">
      <div class="empty-state-desc">상세 ASK 정보가 없습니다.</div>
    </div>`;

  return `
    ${def ? `
      <div class="ask-popup-section">
        <div class="ask-popup-section-title">📋 역량 정의</div>
        <p style="font-size:0.875rem;color:var(--text-muted);line-height:1.7">${escapeHtml(def)}</p>
      </div>` : ''}
    ${Object.keys(indicators).length ? `
      <div class="ask-popup-section">
        <div class="ask-popup-section-title">📊 수준별 행동 지표</div>
        ${['L1','L2','L3'].filter(l => indicators[l]).map(l => `
          <div class="ask-popup-item">
            <span class="ask-popup-item-level ${l.toLowerCase()}">${l}</span>
            <span class="ask-popup-item-text">${escapeHtml(indicators[l])}</span>
          </div>`).join('')}
      </div>` : ''}
  `;
}

/**
 * Hides and removes the active ASK popup.
 */
export function hideAskPopup() {
  if (!activeOverlay) return;
  const overlay = activeOverlay;
  activeOverlay = null;
  overlay.classList.remove('visible');
  overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  setTimeout(() => overlay.remove(), 500);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
