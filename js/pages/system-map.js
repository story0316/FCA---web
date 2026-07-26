// System Map — HR 업무 도메인별 기능 탐색 페이지
import { DOMAINS } from '../data/menu-index.js';

let _selectedId = null;

export function render(container) {
  _selectedId = null;
  _draw(container);
}

function _draw(container) {
  container.innerHTML = `
    <div class="page" style="background:var(--bg)">
      <div class="topbar" style="display:flex;align-items:center;gap:10px;padding:0 16px">
        <button onclick="window.navBack()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:4px">←</button>
        <span style="font-size:16px;font-weight:700;color:var(--text)">HR 시스템 맵</span>
      </div>
      <div class="page-content" style="padding:16px">
        <p style="font-size:12px;color:var(--text-muted);margin:0 0 16px">도메인을 선택하면 해당 기능 목록을 확인할 수 있습니다.</p>
        <div id="sm-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
          ${DOMAINS.map(d => _domainCard(d)).join('')}
        </div>
        <div id="sm-detail" style="margin-top:16px"></div>
      </div>
    </div>
  `;
  _bindEvents(container);
}

function _domainCard(d) {
  const isSelected = _selectedId === d.id;
  return `
    <div class="sm-card" data-id="${d.id}" style="
      background:var(--card-bg);
      border:2px solid ${isSelected ? d.color : 'var(--border)'};
      border-radius:14px;
      padding:14px 12px;
      cursor:pointer;
      transition:border-color .15s,box-shadow .15s;
      ${isSelected ? `box-shadow:0 0 0 3px ${d.color}22` : ''}
    ">
      <div style="font-size:26px;margin-bottom:6px">${d.icon}</div>
      <div style="font-size:12px;font-weight:700;color:var(--text);line-height:1.3">${d.nameKo}</div>
      <div style="font-size:10px;color:${d.color};font-weight:600;margin-top:2px">${d.name}</div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:4px">${d.features.length}개 기능</div>
    </div>
  `;
}

function _renderDetail(container, domain) {
  const el = container.querySelector('#sm-detail');
  if (!domain) { el.innerHTML = ''; return; }

  el.innerHTML = `
    <div style="background:var(--card-bg);border:1.5px solid ${domain.color}44;border-radius:16px;padding:16px;animation:fadeIn .15s ease">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="font-size:24px">${domain.icon}</span>
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text)">${domain.nameKo}</div>
          <div style="font-size:11px;color:${domain.color};font-weight:600">${domain.name}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        ${domain.features.map(f => `
          <button onclick="window.location.hash='${f.hash}'" style="
            display:flex;flex-direction:column;align-items:center;gap:4px;
            padding:10px 4px;border-radius:10px;border:1px solid var(--border);
            background:var(--bg);cursor:pointer;
            transition:background .12s,border-color .12s;
          " onmouseover="this.style.background='${domain.bg}';this.style.borderColor='${domain.color}'"
             onmouseout="this.style.background='var(--bg)';this.style.borderColor='var(--border)'">
            <span style="font-size:20px">${f.icon}</span>
            <span style="font-size:10px;font-weight:600;color:var(--text);text-align:center;line-height:1.3">${f.title}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function _bindEvents(container) {
  container.querySelectorAll('.sm-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      _selectedId = _selectedId === id ? null : id;
      container.querySelectorAll('.sm-card').forEach(c => {
        const d = DOMAINS.find(x => x.id === c.dataset.id);
        c.style.border = `2px solid ${_selectedId === c.dataset.id ? d.color : 'var(--border)'}`;
        c.style.boxShadow = _selectedId === c.dataset.id ? `0 0 0 3px ${d.color}22` : '';
      });
      const domain = _selectedId ? DOMAINS.find(d => d.id === _selectedId) : null;
      _renderDetail(container, domain);
    });
  });
}

export function unmount() { _selectedId = null; }
