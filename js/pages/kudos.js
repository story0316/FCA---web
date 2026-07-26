/**
 * kudos.js — 동료 칭찬 시스템 (포인트 · 뱃지 · 리더보드)
 */

import {getUser, isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
import { loadDisplayEmployees } from '../data/demo_employees.js';

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId() {
  const s = _session();
  return s.empId || s.userId || getUser()?.id || 'EMP001';
}

const LS_KUDOS = 'hr_kudos';

let _employees = [];

const BADGES = [
  { id: 'teamwork',    icon: '🤝', label: '팀워크', color: '#3B82F6' },
  { id: 'innovation',  icon: '💡', label: '혁신',   color: '#8B5CF6' },
  { id: 'leadership',  icon: '🌟', label: '리더십', color: '#F59E0B' },
  { id: 'dedication',  icon: '🔥', label: '헌신',   color: '#EF4444' },
  { id: 'support',     icon: '🫂', label: '협력',   color: '#10B981' },
  { id: 'excellence',  icon: '🏆', label: '탁월함', color: '#EC4899' },
];

const LEGACY_KUDOS_IDS = new Set(['K001','K002','K003','K004','K005']);

function _getKudos() {
  const saved = localStorage.getItem(LS_KUDOS);
  if (!saved) return [];
  try {
    const d = JSON.parse(saved);
    const cleaned = d.filter(k => !LEGACY_KUDOS_IDS.has(k.id));
    if (cleaned.length < d.length) localStorage.setItem(LS_KUDOS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}

function _saveKudos(list) {
  localStorage.setItem(LS_KUDOS, JSON.stringify(list));
}

function _getLeaderboard(kudos) {
  const map = {};
  for (const k of kudos) {
    if (!map[k.toId]) map[k.toId] = { name: k.toName, avatar: k.toAvatar, points: 0, count: 0 };
    map[k.toId].points += k.points;
    map[k.toId].count++;
  }
  return Object.values(map).sort((a, b) => b.points - a.points);
}

function _getBadge(id) {
  return BADGES.find(b => b.id === id) || BADGES[0];
}

function _relTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return '방금 전';
  if (h < 24) return h + '시간 전';
  return Math.floor(h / 24) + '일 전';
}

let _tab = 'feed'; // feed | leaderboard | send

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _employees = await loadDisplayEmployees();
  _renderPage(root);
}

export function unmount() { _tab = 'feed'; }

function _renderPage(root) {
  const user = getUser();
  const myId = _empId();
  const kudos = _getKudos();
  const lb = _getLeaderboard(kudos);
  const myPoints = lb.find(e => e.name === (user?.name_ko || user?.name))?.points || 0;

  root.innerHTML = `
<div class="page" style="background:var(--bg);display:flex;flex-direction:column;height:100vh;overflow:hidden">
  <div class="top-bar" style="flex-shrink:0">
    <button class="btn btn-ghost btn-sm" onclick="window.navBack()" style="padding:8px;min-height:40px">←</button>
    <div class="top-bar-title" style="flex:1;text-align:center">🤝 칭찬 보내기</div>
    <div style="min-width:40px;text-align:right;font-size:12px;color:#F59E0B;font-weight:700;padding-right:4px">
      ⭐${myPoints}pt
    </div>
  </div>

  <!-- 탭 -->
  <div style="flex-shrink:0;display:flex;border-bottom:2px solid var(--border);background:var(--surface);padding:0 4px">
    ${[
      { key:'feed',        icon:'📰', label:'피드' },
      { key:'leaderboard', icon:'🏆', label:'리더보드' },
      { key:'send',        icon:'✉️',  label:'칭찬 보내기' },
    ].map(t => `
    <button class="kudos-tab-btn ${_tab===t.key?'active':''}" data-tab="${t.key}"
      style="flex:1;padding:12px 4px;font-size:13px;font-weight:600;background:none;border:none;
             cursor:pointer;border-bottom:2px solid ${_tab===t.key?'#4F46E5':'transparent'};
             margin-bottom:-2px;color:${_tab===t.key?'#4F46E5':'var(--text-muted)'}">
      ${t.icon} ${t.label}
    </button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">
    <div id="kudos-body"></div>
  </div>
</div>`;

  root.querySelectorAll('.kudos-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.tab; _renderPage(root); });
  });

  const body = root.querySelector('#kudos-body');
  if (_tab === 'feed')        _renderFeed(body, kudos, myId);
  if (_tab === 'leaderboard') _renderLeaderboard(body, lb);
  if (_tab === 'send')        _renderSendForm(body, root, kudos);
}

// ── 피드 ────────────────────────────────────────────────────

function _renderFeed(container, kudos, myId) {
  if (!kudos.length) {
    container.innerHTML = `<div style="text-align:center;padding:48px 24px;color:var(--text-muted)">
      <div style="font-size:48px;margin-bottom:12px">🤝</div>
      <div style="font-weight:600;margin-bottom:6px">아직 칭찬이 없습니다</div>
      <button onclick="location.hash='#/kudos'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">칭찬 보내기</button>
    
      <div style="font-size:13px">"칭찬 보내기" 탭에서 동료를 칭찬해보세요!</div>
    </div>`;
    return;
  }

  container.innerHTML = kudos.map(k => {
    const badge = _getBadge(k.badge);
    const isMe = k.toId === myId || k.fromId === myId;
    return `
<div style="background:var(--card-bg);border:1px solid ${isMe?'#4F46E5':'var(--border)'};
     border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
    <div style="font-size:28px">${k.fromAvatar}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;color:var(--text)">
        <strong>${k.fromName}</strong>
        <span style="color:var(--text-muted)"> → </span>
        <strong>${k.toName}</strong>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${_relTime(k.createdAt)}</div>
    </div>
    <div style="text-align:center;flex-shrink:0">
      <div style="font-size:20px">${badge.icon}</div>
      <div style="font-size:10px;font-weight:600;color:${badge.color}">${badge.label}</div>
    </div>
  </div>
  <div style="font-size:13px;color:var(--text);line-height:1.6;background:var(--bg);
       border-radius:10px;padding:10px 12px">"${k.message}"</div>
  <div style="font-size:11px;color:#F59E0B;font-weight:700;margin-top:8px;text-align:right">
    +${k.points}pt
  </div>
</div>`;
  }).join('');
}

// ── 리더보드 ─────────────────────────────────────────────────

function _renderLeaderboard(container, lb) {
  const medals = ['🥇', '🥈', '🥉'];
  container.innerHTML = `
<div style="text-align:center;margin-bottom:20px">
  <div style="font-size:28px">🏆</div>
  <div style="font-size:14px;font-weight:700;margin-top:4px">이달의 칭찬왕</div>
  <div style="font-size:12px;color:var(--text-muted);margin-top:2px">동료에게 가장 많은 칭찬을 받은 분들</div>
</div>

${lb.slice(0, 3).map((e, i) => `
<div style="background:${i===0?'linear-gradient(135deg,#F59E0B,#D97706)':'var(--card-bg)'};
     border:1px solid ${i===0?'#F59E0B':'var(--border)'};border-radius:14px;padding:14px;
     margin-bottom:10px;display:flex;align-items:center;gap:12px">
  <div style="font-size:28px">${medals[i] || (i+1) + '위'}</div>
  <div style="font-size:24px">${e.avatar}</div>
  <div style="flex:1">
    <div style="font-size:14px;font-weight:700;color:${i===0?'#fff':'var(--text)'}">${e.name}</div>
    <div style="font-size:11px;color:${i===0?'rgba(255,255,255,0.8)':'var(--text-muted)'}">${e.count}번 칭찬받음</div>
  </div>
  <div style="font-size:20px;font-weight:800;color:${i===0?'#fff':'#F59E0B'}">⭐${e.points}pt</div>
</div>`).join('')}

${lb.length > 3 ? `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
     padding:12px;margin-top:4px">
  ${lb.slice(3).map((e, i) => `
  <div style="display:flex;align-items:center;gap:10px;padding:8px 0;
      border-bottom:1px solid var(--border)">
    <div style="width:24px;text-align:center;font-size:13px;color:var(--text-muted);font-weight:600">${i+4}</div>
    <div style="font-size:18px">${e.avatar}</div>
    <div style="flex:1;font-size:13px;color:var(--text)">${e.name}</div>
    <div style="font-size:12px;font-weight:600;color:#F59E0B">⭐${e.points}pt</div>
  </div>`).join('')}
</div>` : ''}`;
}

// ── 칭찬 보내기 폼 ────────────────────────────────────────────

function _renderSendForm(container, root, kudos) {
  const user = getUser();

  container.innerHTML = `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:12px">칭찬 받을 동료</div>
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:4px" id="emp-grid">
    ${_employees.map(e => `
    <button class="emp-select-btn" data-id="${e.id}" data-name="${e.name}" data-avatar="${e.avatar}"
      style="display:flex;align-items:center;gap:8px;padding:10px;border:2px solid var(--border);
             border-radius:10px;cursor:pointer;background:var(--bg);text-align:left">
      <span style="font-size:20px">${e.avatar}</span>
      <div>
        <div style="font-size:12px;font-weight:600;color:var(--text)">${e.name}</div>
        <div style="font-size:10px;color:var(--text-muted)">${e.dept}</div>
      </div>
    </button>`).join('')}
  </div>
  <div id="selected-emp" style="display:none;margin-top:10px;background:#EEF2FF;border-radius:10px;
       padding:10px 12px;font-size:13px;color:#4338CA;font-weight:600"></div>
</div>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:10px">칭찬 뱃지</div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px" id="badge-grid">
    ${BADGES.map(b => `
    <button class="badge-select-btn" data-id="${b.id}"
      style="padding:12px 8px;border:2px solid var(--border);border-radius:10px;
             cursor:pointer;text-align:center;background:var(--bg)">
      <div style="font-size:22px;margin-bottom:4px">${b.icon}</div>
      <div style="font-size:11px;font-weight:600;color:var(--text)">${b.label}</div>
    </button>`).join('')}
  </div>
</div>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:8px">칭찬 메시지</div>
  <textarea maxlength="500" id="kudos-msg" placeholder="동료의 어떤 점이 훌륭했나요? (10자 이상)"
    style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;
           font-size:13px;background:var(--bg);color:var(--text);height:80px;resize:none;
           box-sizing:border-box;font-family:inherit;line-height:1.5"></textarea>
  <div style="font-size:11px;color:var(--text-muted);margin-top:4px;text-align:right">
    +10pt 상대방에게 지급
  </div>
</div>

<button id="send-kudos-btn" class="btn btn-primary" style="width:100%">🤝 칭찬 보내기</button>`;

  let selectedEmpId = null, selectedEmpName = null, selectedEmpAvatar = null;
  let selectedBadge = null;

  container.querySelectorAll('.emp-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.emp-select-btn').forEach(b => {
        b.style.borderColor = 'var(--border)';
        b.style.background = 'var(--bg)';
      });
      btn.style.borderColor = '#4F46E5';
      btn.style.background = '#EEF2FF';
      selectedEmpId = btn.dataset.id;
      selectedEmpName = btn.dataset.name;
      selectedEmpAvatar = btn.dataset.avatar;
      const sel = container.querySelector('#selected-emp');
      sel.style.display = '';
      sel.textContent = `✓ ${selectedEmpName}에게 칭찬을 보냅니다`;
    });
  });

  container.querySelectorAll('.badge-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.badge-select-btn').forEach(b => {
        b.style.borderColor = 'var(--border)';
        b.style.background = 'var(--bg)';
      });
      const badge = _getBadge(btn.dataset.id);
      btn.style.borderColor = badge.color;
      btn.style.background = badge.color + '20';
      selectedBadge = btn.dataset.id;
    });
  });

  container.querySelector('#send-kudos-btn').addEventListener('click', () => {
    if (!selectedEmpId) { showToast('칭찬 받을 동료를 선택하세요.', 'error'); return; }
    if (!selectedBadge) { showToast('칭찬 뱃지를 선택하세요.', 'error'); return; }
    const msg = container.querySelector('#kudos-msg').value.trim();
    if (msg.length < 10) { showToast('메시지를 10자 이상 입력하세요.', 'error'); return; }

    const fromUser = user?.name_ko || user?.name || '직원';
    const newKudo = {
      id: 'K_' + Date.now(),
      fromId: _empId(),
      fromName: fromUser,
      fromAvatar: '😊',
      toId: selectedEmpId,
      toName: selectedEmpName,
      toAvatar: selectedEmpAvatar,
      badge: selectedBadge,
      message: msg,
      points: 10,
      createdAt: new Date().toISOString(),
    };
    kudos.unshift(newKudo);
    _saveKudos(kudos);
    addNotification({ type: 'system', title: `${fromUser}님이 ${selectedEmpName}에게 칭찬을 보냈습니다! 🤝`, body: '' });
    showToast(`${selectedEmpName}에게 칭찬을 보냈습니다! ⭐+10pt`, 'success')
    addNotification({ type: 'success', title: '칭찬하기', body: '에게 칭찬을 보냈습니다! ⭐+10pt' });
    _tab = 'feed';
    _renderPage(root);
  });
}
