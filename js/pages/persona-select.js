/**
 * persona-select.js — Persona picker shown after login or via nav "전환" button.
 *
 * Shows all personas assigned to the user as large tappable cards.
 * Selecting a persona stores the active choice and navigates to the right home.
 */

import { PERSONAS, getUserPersonas, setActivePersona, getPersonaDef, clearActivePersona } from '../utils/persona.js';
import { getUser } from '../auth.js';

let _root = null;

export function mount(root) {
  _root = root;
  const user      = getUser();
  const available = getUserPersonas(user)
    .map(id => getPersonaDef(id))
    .filter(Boolean);

  // Single persona → skip picker
  if (available.length <= 1) {
    setActivePersona(available[0]?.id || 'employee');
    window.location.hash = '#/dashboard';
    return;
  }

  const name = user?.name_ko || user?.name || user?.email?.split('@')[0] || '사용자';

  root.innerHTML = `
    <div style="
      min-height:100vh;
      background:linear-gradient(160deg,#F0F4FF 0%,#F8F0FF 100%);
      display:flex;flex-direction:column;align-items:center;
      justify-content:flex-start;padding:48px 20px 40px;
    ">
      <!-- App icon -->
      <div style="
        width:72px;height:72px;border-radius:20px;
        background:#1E293B;display:flex;align-items:center;
        justify-content:center;font-size:2.2rem;
        margin-bottom:24px;
        box-shadow:0 8px 32px rgba(30,41,59,.20);
      ">🎯</div>

      <h1 style="font-size:1.4rem;font-weight:800;margin-bottom:6px;text-align:center;color:#1E293B">
        어떤 역할로 시작할까요?
      </h1>
      <p style="font-size:0.85rem;color:var(--text-muted);text-align:center;margin:0 0 36px;max-width:300px;line-height:1.6">
        <strong>${name}</strong>님은 여러 역할을 맡고 있어요.<br>지금 집중할 모드를 선택하세요.
      </p>

      <!-- Persona cards -->
      <div style="width:100%;max-width:420px;display:flex;flex-direction:column;gap:10px">
        ${available.map(p => `
          <button class="persona-pick-btn" data-id="${p.id}"
            style="
              display:flex;align-items:center;gap:16px;
              padding:16px 18px;border-radius:16px;
              border:2px solid rgba(0,0,0,.06);
              background:rgba(255,255,255,.9);
              backdrop-filter:blur(8px);
              cursor:pointer;text-align:left;width:100%;
              box-shadow:0 2px 12px rgba(0,0,0,.06);
              transition:all .15s ease;
            ">
            <div style="
              width:48px;height:48px;border-radius:14px;
              background:${p.bg};flex-shrink:0;
              display:flex;align-items:center;justify-content:center;
              font-size:1.7rem;
            ">${p.icon}</div>
            <div style="flex:1">
              <div style="font-weight:700;font-size:0.97rem;color:#1E293B;margin-bottom:2px">${p.label}</div>
              <div style="font-size:0.76rem;color:var(--text-muted);line-height:1.4">${p.description}</div>
            </div>
            <div style="color:#CBD5E1;font-size:1.2rem;flex-shrink:0">›</div>
          </button>
        `).join('')}
      </div>

      <!-- Logout link -->
      <button id="ps-logout" style="
        margin-top:32px;background:none;border:none;cursor:pointer;
        font-size:0.82rem;color:var(--text-muted);padding:8px 16px;
      ">로그아웃</button>
    </div>`;

  // Hover effect
  root.querySelectorAll('.persona-pick-btn').forEach(btn => {
    const p = getPersonaDef(btn.dataset.id);
    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = p.color;
      btn.style.background  = p.bg;
      btn.style.transform   = 'translateY(-1px)';
      btn.style.boxShadow   = `0 6px 20px ${p.color}28`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.borderColor = 'rgba(0,0,0,.06)';
      btn.style.background  = 'rgba(255,255,255,.9)';
      btn.style.transform   = '';
      btn.style.boxShadow   = '0 2px 12px rgba(0,0,0,.06)';
    });
    btn.addEventListener('click', () => {
      setActivePersona(p.id);
      if (p.adminDefaultTab) {
        window.location.hash = `#/admin?tab=${p.adminDefaultTab}`;
      } else {
        window.location.hash = '#/dashboard';
      }
    });
  });

  root.querySelector('#ps-logout')?.addEventListener('click', () => {
    clearActivePersona();
    import('../auth.js').then(m => m.logout());
  });
}

export function unmount() {
  _root = null;
}
