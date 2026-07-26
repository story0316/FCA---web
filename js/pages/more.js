/**
 * more.js — 더보기 (#/more)
 * 도메인별 아코디언 전체 메뉴 탐색 (system-map 고도화)
 */

import { DOMAINS } from '../data/menu-index.js';
import { isAdmin, getUserStatus } from '../auth.js';

let _openId = DOMAINS[0]?.id || null;

export async function mount(root) {
  _openId = DOMAINS[0]?.id || null;
  _draw(root);
}

export function unmount() {
  _openId = null;
}

function _draw(root) {
  const admin  = isAdmin();
  // 도메인별 role 필터: admin role 표시 항목은 관리자에게만
  const visibleDomains = DOMAINS.map(d => ({
    ...d,
    features: d.features.filter(f => !f.roles || f.roles.includes('admin') ? admin : true),
  })).filter(d => d.features.length > 0);

  root.innerHTML = `
<div class="page" style="background:var(--bg)">
  <div class="top-bar">
    <div class="top-bar-title">☰ 더보기</div>
  </div>

  <div class="page-content" style="padding:0 0 32px">

    <!-- 퀵 메뉴 -->
    <div style="padding:12px 16px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;
                border-bottom:1px solid var(--border)">
      ${[
        { icon: '🤖', label: 'AI 상담',   hash: '#/ai-consult' },
        { icon: '📢', label: '공지사항',   hash: '#/notice' },
        { icon: '🗺️', label: '시스템맵',  hash: '#/system-map' },
        { icon: '⚙️', label: '어드민',    hash: '#/admin', adminOnly: true },
      ].filter(q => !q.adminOnly || admin).map(q => `
      <button onclick="window.location.hash='${q.hash}'"
        style="display:flex;flex-direction:column;align-items:center;gap:5px;
               padding:12px 4px;background:var(--card-bg);border:1.5px solid var(--border);
               border-radius:10px;cursor:pointer">
        <span style="font-size:22px">${q.icon}</span>
        <span style="font-size:10px;font-weight:600;color:var(--text)">${q.label}</span>
      </button>`).join('')}
    </div>

    <!-- 도메인 아코디언 -->
    <div id="more-accordion" style="padding:8px 16px 0">
      ${visibleDomains.map(d => _accordion(d)).join('')}
    </div>

  </div>
</div>`;

  _bindEvents(root, visibleDomains);
}

function _accordion(d) {
  const isOpen = _openId === d.id;
  return `
<div class="more-domain" data-id="${d.id}"
  style="border:1.5px solid ${isOpen ? d.color : 'var(--border)'};
         border-radius:14px;margin-bottom:8px;overflow:hidden;
         transition:border-color .2s;background:var(--card-bg)">

  <!-- 헤더 -->
  <button class="more-header" data-id="${d.id}"
    style="width:100%;display:flex;align-items:center;gap:12px;
           padding:14px 16px;background:none;border:none;cursor:pointer;text-align:left">
    <span style="font-size:24px;flex-shrink:0">${d.icon}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:700;color:var(--text)">${d.nameKo}</div>
      <div style="font-size:10px;color:${d.color};font-weight:600;margin-top:1px">${d.name}</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
      <span style="font-size:10px;color:var(--text-muted)">${d.features.length}개</span>
      <span class="more-chev" style="font-size:14px;color:var(--text-muted);transition:transform .2s;
                   transform:rotate(${isOpen ? '90' : '0'}deg)">›</span>
    </div>
  </button>

  <!-- 바디: 서브그룹 헤더 + 2열 그리드 -->
  <div class="more-body" data-id="${d.id}"
    style="display:${isOpen ? 'block' : 'none'};
           border-top:1px solid var(--border);padding:10px 12px 12px;
           background:${d.bg}">
    ${_renderFeatureGroups(d)}
  </div>

</div>`;
}

function _renderFeatureGroups(d) {
  const features = d.features;
  const hasGroups = features.some(f => f.group);
  if (!hasGroups) return _featureGrid(features, d);

  // group 순서 보존 (첫 등장 순)
  const groupOrder = [];
  features.forEach(f => {
    if (f.group && !groupOrder.includes(f.group)) groupOrder.push(f.group);
  });

  return groupOrder.map(g => {
    const items = features.filter(f => f.group === g);
    return `
<div style="margin-bottom:10px">
  <div style="font-size:10px;font-weight:700;color:${d.color};letter-spacing:.05em;
              text-transform:uppercase;padding:4px 2px 6px;opacity:.85">${g}</div>
  ${_featureGrid(items, d)}
</div>`;
  }).join('');
}

function _featureGrid(features, d) {
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
    ${features.map(f => `
    <button onclick="window.location.hash='${f.hash}'"
      style="display:flex;align-items:center;gap:8px;
             padding:9px 10px;background:var(--card-bg);border:1px solid var(--border);
             border-radius:10px;cursor:pointer;text-align:left;
             transition:border-color .15s,background .15s;min-height:0"
      onmouseover="this.style.borderColor='${d.color}';this.style.background='${d.bg}'"
      onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--card-bg)'">
      <span style="font-size:18px;flex-shrink:0;line-height:1">${f.icon}</span>
      <span style="font-size:12px;font-weight:600;color:var(--text);
                   line-height:1.3;word-break:keep-all;white-space:normal">${f.title}</span>
    </button>`).join('')}
  </div>`;
}

function _bindEvents(root, visibleDomains) {
  root.querySelectorAll('.more-header').forEach(btn => {
    btn.addEventListener('click', () => {
      const id   = btn.dataset.id;
      const prev = _openId;
      _openId    = _openId === id ? null : id;

      // 이전 열린 도메인 닫기
      if (prev && prev !== _openId) {
        const prevDomain = root.querySelector(`.more-domain[data-id="${prev}"]`);
        const prevBody   = root.querySelector(`.more-body[data-id="${prev}"]`);
        const prevChev   = prevDomain?.querySelector('.more-chev');
        const prevD      = visibleDomains.find(d => d.id === prev);
        if (prevBody)   prevBody.style.display = 'none';
        if (prevDomain) prevDomain.style.borderColor = 'var(--border)';
        if (prevChev)   prevChev.style.transform = 'rotate(0deg)';
        if (prevDomain && prevBody) prevBody.style.background = prevD?.bg || '';
      }

      // 현재 도메인 토글
      const domain = root.querySelector(`.more-domain[data-id="${id}"]`);
      const body   = root.querySelector(`.more-body[data-id="${id}"]`);
      const chev   = domain?.querySelector('.more-chev');
      const d      = visibleDomains.find(x => x.id === id);

      if (body) {
        const opening = body.style.display === 'none';
        body.style.display  = opening ? 'block' : 'none';
        if (domain) domain.style.borderColor = opening ? (d?.color || 'var(--border)') : 'var(--border)';
        if (chev)   chev.style.transform = opening ? 'rotate(90deg)' : 'rotate(0deg)';
      }
    });
  });
}
