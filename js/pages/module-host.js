/**
 * module-host.js — Shell page that mounts any module.
 *
 * Route: #/module/:moduleId
 * Parses the module ID from the hash, loads via module-loader, and renders it.
 */

import { mountModule } from '../module-loader.js';
import { getUser } from '../auth.js';

let _cleanup = null;

export async function mount(root) {
  const user = getUser();

  // Parse module ID from hash: #/module/team-checkin → team-checkin
  const moduleId = (window.location.hash.split('?')[0].split('/module/')[1] || '').trim();

  if (!moduleId) {
    root.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-muted)">
      모듈 ID가 없습니다.
    </div>`;
    return;
  }

  root.innerHTML = `
    <div class="page" style="background:var(--bg)">
      <div class="top-bar">
        <button class="top-bar-back" onclick="window.navBack()" aria-label="뒤로">‹</button>
        <div class="top-bar-title" id="module-title">모듈 로딩 중…</div>
      </div>
      <div id="module-container" class="page-content" style="padding:0"></div>
    </div>`;

  const container = root.querySelector('#module-container');
  const titleEl   = root.querySelector('#module-title');

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;padding:60px;gap:12px;color:var(--text-muted)">
      <div class="spinner"></div><span>모듈 불러오는 중…</span>
    </div>`;

  try {
    _cleanup = await mountModule(moduleId, container, user);

    // Update title from module's meta if available
    const modMeta = (await import('../module-loader.js').then(m => m.resolveModule(moduleId))).meta;
    if (modMeta?.name) titleEl.textContent = modMeta.name;
    else titleEl.textContent = moduleId;

  } catch (err) {
    container.innerHTML = `
      <div style="padding:32px;text-align:center">
        <div style="font-size:2.5rem;margin-bottom:12px">⚠️</div>
        <div style="font-weight:700;margin-bottom:8px">모듈을 불러올 수 없습니다</div>
        <div style="font-size:0.85rem;color:var(--text-muted)">${err.message}</div>
      </div>`;
  }
}

export function unmount() {
  if (_cleanup) {
    _cleanup.unmount();
    _cleanup = null;
  }
}
