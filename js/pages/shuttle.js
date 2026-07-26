/**
 * shuttle.js — 통근 셔틀버스 신청
 * Route: #/shuttle
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS_KEY = 'hr_shuttle_subscriptions';

const ROUTES = [
  { id: 'R1', name: '강남역 방면', time: '08:00 출발', seats: 40 },
  { id: 'R2', name: '판교역 방면', time: '08:20 출발', seats: 35 },
  { id: 'R3', name: '수원역 방면', time: '07:40 출발', seats: 30 },
];

const ROUTE_ICONS = { R1: '🚌', R2: '🚍', R3: '🚐' };

function _load() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } }
function _save(d) { localStorage.setItem(LS_KEY, JSON.stringify(d)); }
function _id() { return 'shu_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5); }
function _today() { return new Date().toISOString().slice(0, 10); }
function _thisMonth() { return new Date().toISOString().slice(0, 7); }
function _session() { try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; } }
function _uid()   { return _session().empId || _session().userId || 'EMP001'; }
function _uname() { return _session().name || '직원'; }

function _demoShuttle() {
  const uid = _uid(); const name = _uname();
  return [
    { id: `shu_${uid}_1`, empId: uid, empName: name, routeId: 'R1', routeName: '강남역 방면', month: '2026-05', status: 'active', reqDate: '2026-04-25' },
  ];
}

function _merged() {
  const demo = _demoShuttle();
  const saved = _load();
  return [...demo.filter(d => !saved.find(x => x.id === d.id)), ...saved];
}

let _tab = 'routes';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'routes';
  _render(root);
}

export function unmount() { _tab = 'routes';}

function _render(root) {
  const session = _session();
  const empId = _uid();
  const all = _merged().filter(r => r.empId === empId);
  const activeMonth = _thisMonth();
  const activeSubs = all.filter(r => r.status === 'active');

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="shu-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700;color:var(--text)">🚌 통근 셔틀 신청</div>
      <div style="font-size:11px;color:var(--text-muted)">구독 중 ${activeSubs.length}건</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['routes', '노선 신청'], ['mysubs', '내 구독']].map(([k, l]) => `
    <button class="shu-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab === k ? '#4F46E5' : 'transparent'};
             color:${_tab === k ? '#4F46E5' : 'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">
    ${_tab === 'routes' ? _renderRoutes(all, activeMonth) : _renderMySubs(all)}
  </div>
</div>`;

  root.querySelector('#shu-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.shu-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _render(root); }));

  if (_tab === 'routes') {
    root.querySelectorAll('.shu-apply-btn').forEach(btn => {
      btn.addEventListener('click', () => _applyRoute(btn.dataset.routeId, empId, session, root));
    });
  } else {
    root.querySelectorAll('.shu-cancel-btn').forEach(btn => {
      btn.addEventListener('click', () => _cancelSub(btn.dataset.id, root));
    });
  }
}

function _renderRoutes(all, activeMonth) {
  return `<div style="max-width:480px;margin:0 auto">
    <div style="background:#EEF2FF;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#4F46E5;line-height:1.5">
      📅 ${activeMonth} 신청 가능 · 매월 말까지 다음 달 신청
    </div>
    ${ROUTES.map(route => {
      const alreadySubscribed = all.some(r => r.routeId === route.id && r.month === activeMonth && r.status === 'active');
      return `
<div style="background:var(--card-bg);border:1.5px solid ${alreadySubscribed ? '#4F46E5' : 'var(--border)'};border-radius:14px;padding:16px;margin-bottom:12px">
  <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px">
    <span style="font-size:28px">${ROUTE_ICONS[route.id] || '🚌'}</span>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700;color:var(--text)">${route.name}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:2px">⏰ ${route.time}</div>
      <div style="font-size:12px;color:var(--text-muted)">💺 좌석 ${route.seats}석</div>
    </div>
    ${alreadySubscribed ? `<span style="padding:4px 10px;border-radius:8px;font-size:11px;font-weight:700;background:#EEF2FF;color:#4F46E5">구독 중</span>` : ''}
  </div>
  <button class="shu-apply-btn" data-route-id="${route.id}"
    ${alreadySubscribed ? 'disabled' : ''}
    style="width:100%;padding:10px;border:none;border-radius:10px;
           background:${alreadySubscribed ? '#F1F5F9' : '#4F46E5'};
           color:${alreadySubscribed ? 'var(--text-muted)' : '#fff'};
           font-size:13px;font-weight:700;cursor:${alreadySubscribed ? 'not-allowed' : 'pointer'}">
    ${alreadySubscribed ? '이미 신청한 노선입니다' : '이 노선 신청하기'}
  </button>
</div>`;
    }).join('')}
  </div>`;
}

function _renderMySubs(all) {
  const subs = all.slice().reverse();
  if (!subs.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">🚌</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:6px">구독 내역이 없습니다</div>
      <button onclick="location.hash='#/shuttle'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">셔틀 신청</button>
    
  <div style="font-size:12px">셔틀 노선을 신청해 보세요</div>
</div>`;

  return `<div style="max-width:480px;margin:0 auto">${subs.map(r => {
    const isActive = r.status === 'active';
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:24px">${ROUTE_ICONS[r.routeId] || '🚌'}</span>
      <div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">${r.routeName}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:1px">📅 ${r.month} 적용</div>
      </div>
    </div>
    <span style="padding:3px 9px;border-radius:6px;font-size:11px;font-weight:600;
      background:${isActive ? '#D1FAE5' : '#F1F5F9'};color:${isActive ? '#059669' : 'var(--text-muted)'};white-space:nowrap">
      ${isActive ? '구독 중' : '취소됨'}
    </span>
  </div>
  ${isActive ? `
  <button class="shu-cancel-btn" data-id="${r.id}"
    style="width:100%;padding:9px;border:1.5px solid #FEE2E2;border-radius:10px;background:transparent;color:#EF4444;font-size:13px;font-weight:600;cursor:pointer">
    구독 취소
  </button>` : ''}
</div>`;
  }).join('')}</div>`;
}

function _applyRoute(routeId, empId, session, root) {
  const route = ROUTES.find(r => r.id === routeId);
  if (!route) return;
  const saved = _load();
  saved.push({
    id: _id(),
    empId,
    empName: session.name || '직원',
    routeId: route.id,
    routeName: route.name,
    month: _thisMonth(),
    status: 'active',
    reqDate: _today(),
  });
  _save(saved);
  showToast(`${route.name} 셔틀을 신청했습니다.`, 'success')
    addNotification({ type: 'success', title: '셔틀 신청', body: '셔틀을 신청했습니다.' });
  _render(root);
}

function _cancelSub(id, root) {
  const saved = _load();
  const all = _merged();
  const target = all.find(r => r.id === id);
  if (!target) return;

  if (saved.find(r => r.id === id)) {
    const idx = saved.findIndex(r => r.id === id);
    saved[idx] = { ...saved[idx], status: 'cancelled' };
    _save(saved);
  } else {
    saved.push({ ...target, status: 'cancelled' });
    _save(saved);
  }
  showToast('셔틀 구독을 취소했습니다.', 'info');
  _render(root);
}
