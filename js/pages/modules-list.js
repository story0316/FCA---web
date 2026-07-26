/**
 * modules-list.js — Module marketplace / installed modules page.
 *
 * Shows available modules (built-in + org-specific) and lets users launch them.
 * Admins can install/uninstall modules.
 */

import { getUser, isAdmin, isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

let _root = null;

// Mirrors BUILTIN_REGISTRY in module-loader.js
const BUILTIN_META = [
  {
    id:          'team-checkin',
    name:        '팀 분위기 체크',
    description: '주간 팀 무드를 이모지 5단계로 기록하고 4주 트렌드를 확인합니다.',
    status:      'active',
    icon:        '😊',
    permissions: [],
    builtin:     true,
  },
  {
    id:          'goal-tracker',
    name:        'OKR 진행 현황',
    description: '나의 OKR 목표와 진행률을 한눈에 확인하고 업데이트합니다.',
    status:      'active',
    icon:        '🎯',
    permissions: ['write:goals'],
    builtin:     true,
  },
  {
    id:          'family-event-workflow',
    name:        '경조사 신청·승인',
    description: '경조금과 경조휴가 신청부터 HR 승인·지급까지 관리합니다.',
    status:      'active',
    icon:        '🎊',
    permissions: [],
    builtin:     true,
  },
];

function isLocalBackend() {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

async function fetchModules(orgId) {
  if (!isLocalBackend()) return BUILTIN_META;
  try {
    const token = localStorage.getItem('hr_token');
    const r = await fetch(`/api/modules?org_id=${orgId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) throw new Error();
    const data = await r.json();
    return data.modules || [];
  } catch {
    return BUILTIN_META;
  }
}

async function fetchInstalls(orgId) {
  if (!isLocalBackend()) return new Set();
  try {
    const token = localStorage.getItem('hr_token');
    const r = await fetch(`/api/orgs/${orgId}/module-installs`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) throw new Error();
    const data = await r.json();
    return new Set((data.installs || []).map(i => i.module_id));
  } catch {
    return new Set();
  }
}

async function installModule(orgId, moduleId) {
  const token = localStorage.getItem('hr_token');
  const r = await fetch(`/api/orgs/${orgId}/module-installs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ module_id: moduleId }),
  });
  if (!r.ok) throw new Error('설치 실패');
}

async function uninstallModule(orgId, moduleId) {
  const token = localStorage.getItem('hr_token');
  const r = await fetch(`/api/orgs/${orgId}/module-installs/${moduleId}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!r.ok) throw new Error('제거 실패');
}

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _root = root;
  const user  = getUser();
  const orgId = user?.org_id || '';
  const admin = isAdmin();

  root.innerHTML = `
    <div class="page" style="background:var(--bg)">
      <div class="top-bar">
        <button class="top-bar-back" aria-label="뒤로">‹</button>
        <div class="top-bar-title">모듈 마켓플레이스</div>
        ${admin ? `<a href="#/admin?tab=moduleBuilder" class="btn btn-primary btn-sm"
           style="font-size:0.75rem;padding:6px 12px;text-decoration:none;margin-right:4px">
          🏗️ 빌더
        </a>` : ''}
      </div>
      <div class="page-content">
        <div style="padding:16px 16px 8px">
          <p style="font-size:0.82rem;color:var(--text-muted);margin:0 0 12px">
            모듈을 실행하거나 설치해 워크플로우를 확장하세요.
          </p>
        </div>
        <div id="module-list" style="padding:0 16px 80px">
          <div style="text-align:center;padding:32px;color:var(--text-muted)">
            <div class="spinner"></div>
          </div>
        </div>
      </div>
    </div>`;

  const listEl = root.querySelector('#module-list');

  const [mods, installs] = await Promise.all([
    fetchModules(orgId),
    fetchInstalls(orgId),
  ]);

  if (!mods.length) {
    listEl.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
      <div style="font-size:40px;margin-bottom:12px">🧩</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:4px">사용 가능한 모듈이 없습니다.</div>
      <div style="font-size:12px">관리자에게 모듈 활성화를 요청하세요.</div>
    </div>`;
    return;
  }

  // Group: builtin first, then custom
  const sorted = [...mods].sort((a, b) => {
    const aBuiltin = (a.meta || {}).builtin || a.builtin;
    const bBuiltin = (b.meta || {}).builtin || b.builtin;
    return (bBuiltin ? 1 : 0) - (aBuiltin ? 1 : 0);
  });

  const builtinCount = sorted.filter(m => (m.meta || {}).builtin || m.builtin).length;
  const customCount  = sorted.length - builtinCount;

  listEl.innerHTML = `
    ${builtinCount ? `<div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);
                                  text-transform:uppercase;letter-spacing:0.05em;
                                  margin-bottom:10px">기본 모듈</div>` : ''}
    ${sorted.map((m, idx) => {
    const meta        = m.meta || {};
    const isBuiltin   = meta.builtin || m.builtin;
    const isInstalled = installs.has(m.id) || isBuiltin;
    const permissions = (m.permissions || meta.permissions || []);
    const icon        = m.icon || '🧩';
    const isCustomSep = !isBuiltin && idx === builtinCount;

    return `
      ${isCustomSep && customCount ? `<div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);
                                                   text-transform:uppercase;letter-spacing:0.05em;
                                                   margin:16px 0 10px">사용자 모듈</div>` : ''}
      <div class="card" style="padding:16px;margin-bottom:12px;display:flex;align-items:flex-start;gap:14px"
           data-module-id="${m.id}">
        <div style="
          width:52px;height:52px;border-radius:14px;
          background:var(--primary-bg,#EEF2FF);
          display:flex;align-items:center;justify-content:center;
          font-size:1.8rem;flex-shrink:0;
        ">${icon}</div>

        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px">
            <span style="font-weight:700;font-size:0.95rem">${m.name}</span>
            ${isBuiltin ? `<span style="font-size:0.6rem;padding:1px 7px;border-radius:10px;
                                        background:#EEF2FF;color:#4F46E5;font-weight:700">내장</span>` : ''}
            ${isInstalled && !isBuiltin ? `<span style="font-size:0.6rem;padding:1px 7px;border-radius:10px;
                                                         background:#DCFCE7;color:#15803D;font-weight:700">설치됨</span>` : ''}
          </div>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:6px;line-height:1.4">
            ${m.description || ''}
          </div>
          ${permissions.length ? `
            <div style="display:flex;flex-wrap:wrap;gap:4px">
              ${permissions.map(p => `<span style="font-size:0.62rem;padding:2px 7px;border-radius:8px;
                                                    background:#FEF3C7;color:#D97706;font-weight:600">${p}</span>`).join('')}
            </div>
          ` : `
            <span style="font-size:0.65rem;color:#10B981;font-weight:600">✓ 권한 불필요</span>
          `}
        </div>

        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;align-items:stretch;min-width:60px">
          ${isInstalled ? `
            <a href="#/module/${m.id}" class="btn btn-primary btn-sm"
               style="text-align:center;text-decoration:none;font-size:0.78rem;padding:8px 12px;
                      white-space:nowrap">
              ▶ 실행
            </a>
          ` : ''}
          ${admin && !isBuiltin ? `
            <button class="${isInstalled ? 'uninstall-btn' : 'install-btn'} btn btn-sm"
                    data-id="${m.id}"
                    style="font-size:0.72rem;padding:6px 10px;white-space:nowrap;
                           background:var(--surface);border:1px solid var(--border);
                           color:${isInstalled ? '#EF4444' : 'var(--text)'}">
              ${isInstalled ? '제거' : '설치'}
            </button>
          ` : ''}
        </div>
      </div>`;
  }).join('')}`;


  if (admin) {
    listEl.querySelectorAll('.install-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        btn.textContent = '설치 중…';
        try {
          await installModule(orgId, id);
          showToast('모듈이 설치됐습니다.', 'success')
      addNotification({ type: 'success', title: 'modules list', body: '모듈이 설치됐습니다.' });
          mount(root);
        } catch (err) {
          showToast(err.message, 'error');
          btn.disabled = false;
          btn.textContent = '설치';
        }
      });
    });

    listEl.querySelectorAll('.uninstall-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        try {
          await uninstallModule(orgId, id);
          showToast('모듈이 제거됐습니다.', 'info');
          mount(root);
        } catch (err) {
          showToast(err.message, 'error');
          btn.disabled = false;
          btn.textContent = '제거';
        }
      });
    });
  }
}

export function unmount() {
  _root = null;
}
