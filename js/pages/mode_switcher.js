/**
 * mode_switcher.js — Admin Proxy: switch between any registered user/persona
 */

import { getUser, setUser, getToken, setToken } from '../auth.js';
import { showToast } from '../components/toast.js'
import { addNotification } from '../components/notification-hub.js';

const PROXY_KEY = 'fca_proxy_original';

const DEMO_PERSONAS = [
  { icon: '🎯', label: '지원자',    name: '이지원',   home: '#/applicant',  user: { id: 'APPLICANT_001', org_id: 'ORG001', name_ko: '이지원',   email: 'jiwon.lee@applicant.com',     role: 'staff',    level_code: 'L1', user_status: 'APPLICANT' } },
  { icon: '💼', label: '구성원',    name: '김민준',   home: '#/dashboard',  user: { id: 'MEMBER_001',    org_id: 'ORG001', name_ko: '김민준',   email: 'minjun.kim@techstartup.com',  role: 'staff',    level_code: 'L2', user_status: 'MEMBER' } },
  { icon: '🏅', label: '동문',      name: '박동문',   home: '#/alumni',     user: { id: 'ALUMNI_001',    org_id: 'ORG001', name_ko: '박동문',   email: 'dongmun.park@alumni.com',     role: 'staff',    level_code: 'L3', user_status: 'ALUMNI' } },
  { icon: '👔', label: 'HR Admin', name: 'HR매니저', home: '#/dashboard',  user: { id: 'HR_ADMIN_001',  org_id: 'ORG001', name_ko: 'HR매니저', email: 'hr@techstartup.com',          role: 'hr_admin', level_code: 'L4', user_status: 'MEMBER' } },
  { icon: '👥', label: '팀장',      name: '박팀장',   home: '#/manager',    user: { id: 'MANAGER_001',   org_id: 'ORG001', name_ko: '박팀장',   email: 'manager@techstartup.com',     role: 'hr_admin', level_code: 'L3', user_status: 'MEMBER' } },
  { icon: '🏢', label: '경영진',    name: '최임원',   home: '#/executive',  user: { id: 'EXEC_001',      org_id: 'ORG001', name_ko: '최임원',   email: 'exec@techstartup.com',        role: 'hr_admin', level_code: 'L4', user_status: 'MEMBER' } },
];

const STATUS_HOME = { APPLICANT: '#/applicant', MEMBER: '#/dashboard', ALUMNI: '#/alumni' };

function isProxying() {
  return Boolean(localStorage.getItem(PROXY_KEY));
}

function switchToUser(user, token) {
  if (!isProxying()) {
    localStorage.setItem(PROXY_KEY, JSON.stringify({
      token: localStorage.getItem('hr_token'),
      user:  localStorage.getItem('hr_user'),
    }));
  }
  setToken(token);
  setUser(user);
}

function returnToAdmin() {
  try {
    const orig = JSON.parse(localStorage.getItem(PROXY_KEY));
    localStorage.setItem('hr_token', orig.token);
    localStorage.setItem('hr_user', orig.user);
    localStorage.removeItem(PROXY_KEY);
    return true;
  } catch { return false; }
}

function getRegisteredUsers() {
  try { return JSON.parse(localStorage.getItem('fca_registered_users') || '[]'); }
  catch { return []; }
}

export function mount(root) {
  const me = getUser();
  const proxying = isProxying();
  let proxyOrigUser = null;
  if (proxying) {
    try { proxyOrigUser = JSON.parse(JSON.parse(localStorage.getItem(PROXY_KEY)).user); } catch {}
  }

  const registeredUsers = getRegisteredUsers().filter(u => u.id !== (me?.id));

  root.innerHTML = `
    <div class="page" style="background:var(--bg);min-height:100vh">
      <div class="top-bar">
        <button class="btn btn-ghost btn-sm" onclick="window.navBack()" style="min-height:40px">← 뒤로</button>
        <div class="top-bar-title">Admin 프록시</div>
        <div style="width:40px"></div>
      </div>
      <div class="page-content" style="padding:16px;padding-bottom:80px">

        ${proxying ? `
        <div style="background:var(--warning-bg,#FEF3C7);border:1.5px solid var(--warning,#F59E0B);border-radius:8px;padding:12px 14px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div style="font-size:0.85rem;color:var(--warning-dark,#92400E)">
            🔀 <strong>${me?.name_ko || me?.email}</strong> 로 프록시 중<br>
            <span style="font-size:0.75rem">${proxyOrigUser ? '원래 계정: ' + (proxyOrigUser.name_ko || proxyOrigUser.email) : ''}</span>
          </div>
          <button id="btn-return" class="btn btn-sm" style="background:var(--warning,#F59E0B);color:#fff;white-space:nowrap;min-height:36px">
            관리자 복귀
          </button>
        </div>` : ''}

        <div class="card" style="padding:14px;margin-bottom:14px">
          <div style="font-weight:700;margin-bottom:4px;font-size:0.9rem">현재 접속</div>
          <div style="color:var(--text-muted);font-size:0.85rem">
            ${me?.name_ko || me?.email} · ${me?.role} · ${me?.user_status || 'MEMBER'}
          </div>
        </div>

        <div style="font-weight:700;font-size:0.85rem;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em">데모 페르소나</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
          ${DEMO_PERSONAS.map((p, i) => `
          <button data-demo="${i}" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 8px;
            border:1.5px solid var(--border);border-radius:8px;background:var(--surface-alt,#F8FAFC);
            cursor:pointer;transition:all 150ms;min-height:80px;
            ${me?.id === p.user.id ? 'border-color:var(--primary);background:var(--primary-light,#EEF2FF);' : ''}">
            <span style="font-size:1.4rem">${p.icon}</span>
            <span style="font-size:0.8rem;font-weight:700;color:var(--text)">${p.label}</span>
            <span style="font-size:0.7rem;color:var(--text-muted)">${p.name}</span>
          </button>`).join('')}
        </div>

        ${registeredUsers.length > 0 ? `
        <div style="font-weight:700;font-size:0.85rem;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em">가입 사용자</div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">
          ${registeredUsers.map((u, i) => `
          <button data-reg="${i}" style="display:flex;align-items:center;gap:12px;padding:10px 14px;
            border:1.5px solid var(--border);border-radius:8px;background:var(--surface);
            cursor:pointer;text-align:left;width:100%">
            <span style="font-size:1.3rem">👤</span>
            <div>
              <div style="font-size:0.85rem;font-weight:600;color:var(--text)">${u.name_ko}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">${u.email} · ${u.role} · ${u.user_status}</div>
            </div>
          </button>`).join('')}
        </div>` : ''}

      </div>
    </div>`;

  // Return to admin
  root.querySelector('#btn-return')?.addEventListener('click', () => {
    if (returnToAdmin()) {
      showToast('관리자 계정으로 돌아왔습니다.', 'success')
      addNotification({ type: 'success', title: 'mode_switcher', body: '관리자 계정으로 돌아왔습니다.' });
      window.location.hash = '#/dashboard';
    }
  });

  // Demo persona switch
  root.querySelectorAll('[data-demo]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = DEMO_PERSONAS[+btn.dataset.demo];
      switchToUser(p.user, 'proxy-demo-token');
      showToast(`${p.label} (${p.name}) 으로 전환됩니다.`, 'success')
      addNotification({ type: 'success', title: 'mode_switcher', body: '${p.label} (${p.name}) 으로 전환됩니다.' });
      window.location.hash = p.home || STATUS_HOME[p.user.user_status] || '#/dashboard';
    });
  });

  // Registered user switch
  root.querySelectorAll('[data-reg]').forEach(btn => {
    btn.addEventListener('click', () => {
      const u = registeredUsers[+btn.dataset.reg];
      const { _pw, ...safeUser } = u;
      switchToUser(safeUser, `local_${u.id}`);
      showToast(`${u.name_ko} 으로 전환됩니다.`, 'success')
      addNotification({ type: 'success', title: 'mode_switcher', body: '${u.name_ko} 으로 전환됩니다.' });
      window.location.hash = STATUS_HOME[u.user_status] || '#/dashboard';
    });
  });
}

export function unmount() {}
