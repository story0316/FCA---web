/**
 * notification-hub.js – In-app notification bell + panel
 * HR Competency OS
 *
 * Exports:
 *   mountNotificationBell()   – add bell button to DOM
 *   unmountNotificationBell() – remove bell + panel
 *   addNotification(notif)    – add a notification + update badge
 *   getUnreadCount()          – returns number
 */

import { getUserStatus, getUser } from '../auth.js';

// ── Constants ─────────────────────────────────────────────────
const LS_KEY   = 'hr_notifications';
const MAX_NOTIFS = 50;

// Type → accent color
const TYPE_COLORS = {
  offer:       '#4F46E5',
  interview:   '#F59E0B',
  diagnostic:  '#10B981',
  boomerang:   '#8B5CF6',
  risk:        '#EF4444',
  system:      '#64748B',
};

// ── Module state ──────────────────────────────────────────────
let _mounted   = false;
let _bellEl    = null;
let _panelEl   = null;
let _toastEl   = null;

// ── Public API ────────────────────────────────────────────────

export function mountNotificationBell() {
  if (_mounted) return;
  _mounted = true;

  // Seed demo notifications if needed
  const status = getUserStatus();
  _seedIfEmpty(status);

  // Create bell button
  _bellEl = document.createElement('button');
  _bellEl.id = 'notif-bell-btn';
  _bellEl.setAttribute('aria-label', '알림');
  _bellEl.setAttribute('aria-haspopup', 'true');
  _bellEl.setAttribute('aria-expanded', 'false');

  Object.assign(_bellEl.style, {
    position:       'fixed',
    top:            'calc(var(--safe-top,0px) + 10px)',
    right:          '16px',
    zIndex:         '810',
    width:          '36px',
    height:         '36px',
    borderRadius:   '50%',
    background:     'var(--surface,#fff)',
    border:         '1.5px solid var(--border,#E2E8F0)',
    cursor:         'pointer',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    boxShadow:      '0 2px 8px rgba(0,0,0,0.10)',
    fontSize:       '1.1rem',
    WebkitTapHighlightColor: 'transparent',
    transition:     'transform 0.15s',
    padding:        '0',
    lineHeight:     '1',
  });

  _bellEl.innerHTML = `
    🔔
    <span id="notif-badge" style="
      position:absolute;
      top:-3px;right:-3px;
      min-width:16px;height:16px;
      border-radius:8px;
      background:#EF4444;
      color:#fff;
      font-size:0.6rem;
      font-weight:700;
      display:flex;align-items:center;justify-content:center;
      padding:0 3px;
      box-sizing:border-box;
      border:2px solid var(--surface,#fff);
      line-height:1;
    "></span>
  `;

  _bellEl.addEventListener('click', _togglePanel);
  _bellEl.addEventListener('mouseenter', () => { _bellEl.style.transform = 'scale(1.1)'; });
  _bellEl.addEventListener('mouseleave', () => { _bellEl.style.transform = ''; });

  document.body.appendChild(_bellEl);
  _updateBadge();
}

export function unmountNotificationBell() {
  _bellEl?.remove();
  _panelEl?.remove();
  _toastEl?.remove();
  _bellEl = _panelEl = _toastEl = null;
  _mounted = false;
}

export function addNotification(notif) {
  const userId = getUser()?.id || null;
  const notifications = _load();
  const entry = {
    id:        notif.id || _uid(),
    type:      notif.type || 'system',
    title:     notif.title || '',
    body:      notif.body  || '',
    read:      false,
    createdAt: notif.createdAt || new Date().toISOString(),
    route:     notif.route || '#/',
    userId,
  };
  notifications.unshift(entry);
  _save(notifications.slice(0, MAX_NOTIFS));
  _updateBadge();
  _showToast(entry);
}

export function getUnreadCount() {
  return _loadForUser().filter(n => !n.read).length;
}

// 특정 유저(신청자)에게 알림을 직접 기록 — 관리자 승인/반려 시 사용
export function addNotificationForUser(targetUserId, notif) {
  if (!targetUserId) { addNotification(notif); return; }
  const notifications = _load();
  const entry = {
    id:        notif.id || _uid(),
    type:      notif.type || 'system',
    title:     notif.title || '',
    body:      notif.body  || '',
    read:      false,
    createdAt: notif.createdAt || new Date().toISOString(),
    route:     notif.route || '#/',
    userId:    targetUserId,
  };
  notifications.unshift(entry);
  _save(notifications.slice(0, MAX_NOTIFS));
  _updateBadge();
}

// ── Panel ─────────────────────────────────────────────────────

function _togglePanel() {
  if (_panelEl) {
    _closePanel();
  } else {
    _openPanel();
  }
}

function _openPanel() {
  if (_panelEl) return;

  const panel = document.createElement('div');
  panel.id = 'notif-panel';
  Object.assign(panel.style, {
    position:    'fixed',
    top:         'calc(var(--safe-top,0px) + 54px)',
    right:       '8px',
    width:       'min(320px, 90vw)',
    maxHeight:   '70vh',
    zIndex:      '139',
    background:  'var(--surface,#fff)',
    border:      '1.5px solid var(--border,#E2E8F0)',
    borderRadius:'14px',
    boxShadow:   '0 8px 32px rgba(0,0,0,0.14)',
    display:     'flex',
    flexDirection:'column',
    overflow:    'hidden',
    animation:   'notifSlideIn 0.2s ease',
  });

  panel.innerHTML = `
    <style>
      @keyframes notifSlideIn {
        from { opacity:0; transform:translateY(-8px) scale(0.97); }
        to   { opacity:1; transform:translateY(0)    scale(1); }
      }
      #notif-panel .notif-row {
        display:flex;align-items:flex-start;gap:10px;
        padding:11px 14px;cursor:pointer;
        border-bottom:1px solid var(--border,#E2E8F0);
        transition:background 0.12s;
        text-align:left;
      }
      #notif-panel .notif-row:last-child { border-bottom:none; }
      #notif-panel .notif-row:hover { background:var(--bg,#F8FAFC); }
      #notif-panel .notif-row.unread { background:#FAFAFE; }
    </style>

    <!-- Header -->
    <div style="
      display:flex;align-items:center;justify-content:space-between;
      padding:12px 14px 10px;
      border-bottom:1.5px solid var(--border,#E2E8F0);
      flex-shrink:0;
    ">
      <span style="font-weight:700;font-size:0.95rem;color:var(--text,#1E293B)">알림</span>
      <div style="display:flex;align-items:center;gap:8px">
        <button id="notif-read-all-btn" style="
          background:none;border:none;cursor:pointer;
          font-size:0.75rem;color:var(--primary,#4F46E5);
          font-weight:600;font-family:inherit;padding:2px 4px;
          border-radius:4px;
        ">모두 읽음</button>
        <button id="notif-clear-all-btn" style="
          background:none;border:none;cursor:pointer;
          font-size:0.75rem;color:var(--text-muted,#94A3B8);
          font-weight:600;font-family:inherit;padding:2px 4px;
          border-radius:4px;
        ">전체 삭제</button>
        <a href="#/notification-settings" id="notif-settings-btn" style="
          width:26px;height:26px;border-radius:50%;border:none;
          background:var(--border,#E2E8F0);cursor:pointer;
          font-size:0.8rem;display:flex;align-items:center;justify-content:center;
          color:var(--text,#1E293B);flex-shrink:0;text-decoration:none;
          title='알림 설정'
        ">⚙</a>
        <button id="notif-close-btn" style="
          width:26px;height:26px;border-radius:50%;border:none;
          background:var(--border,#E2E8F0);cursor:pointer;
          font-size:0.8rem;display:flex;align-items:center;justify-content:center;
          color:var(--text,#1E293B);flex-shrink:0;
        ">✕</button>
      </div>
    </div>

    <!-- List -->
    <div id="notif-list" style="overflow-y:auto;flex:1;overscroll-behavior:contain;"></div>
  `;

  // Render notification list
  _renderList(panel.querySelector('#notif-list'));

  // Event delegation on list
  panel.querySelector('#notif-list').addEventListener('click', e => {
    const row = e.target.closest('.notif-row');
    if (!row) return;
    const id    = row.dataset.id;
    const route = row.dataset.route;
    _markRead(id);
    _closePanel();
    if (route) window.location.hash = route;
  });

  panel.querySelector('#notif-read-all-btn').addEventListener('click', e => {
    e.stopPropagation();
    _markAllRead();
    _renderList(panel.querySelector('#notif-list'));
    _updateBadge();
  });

  panel.querySelector('#notif-clear-all-btn').addEventListener('click', e => {
    e.stopPropagation();
    _save([]);
    _renderList(panel.querySelector('#notif-list'));
    _updateBadge();
  });

  panel.querySelector('#notif-close-btn').addEventListener('click', e => {
    e.stopPropagation();
    _closePanel();
  });
  panel.querySelector('#notif-settings-btn')?.addEventListener('click', () => {
    _closePanel();
  });

  document.body.appendChild(panel);
  _panelEl = panel;

  // Update aria
  if (_bellEl) _bellEl.setAttribute('aria-expanded', 'true');

  // Click outside to close
  setTimeout(() => {
    document.addEventListener('click', _outsideClick, { capture: true });
  }, 0);
}

function _closePanel() {
  if (!_panelEl) return;
  _panelEl.remove();
  _panelEl = null;
  if (_bellEl) _bellEl.setAttribute('aria-expanded', 'false');
  document.removeEventListener('click', _outsideClick, { capture: true });
}

function _outsideClick(e) {
  if (
    _panelEl && !_panelEl.contains(e.target) &&
    _bellEl  && !_bellEl.contains(e.target)
  ) {
    _closePanel();
  }
}

// ── Render ────────────────────────────────────────────────────

function _renderList(container) {
  if (!container) return;
  const notifications = _loadForUser();

  if (notifications.length === 0) {
    container.innerHTML = `
      <div style="
        text-align:center;padding:36px 16px;
        color:var(--text-muted,#64748B);font-size:0.85rem;
      ">
        <div style="font-size:1.8rem;margin-bottom:8px">🔕</div>
        새 알림이 없습니다
      </div>
    `;
    return;
  }

  container.innerHTML = notifications.map(n => {
    const color  = TYPE_COLORS[n.type] || TYPE_COLORS.system;
    const unread = !n.read;
    return `
      <button
        class="notif-row${unread ? ' unread' : ''}"
        data-id="${_esc(n.id)}"
        data-route="${_esc(n.route)}"
        style="width:100%;background:${unread ? '#FAFAFE' : 'transparent'};border:none;font-family:inherit;"
        aria-label="${_esc(n.title)}"
      >
        <!-- Type accent bar -->
        <div style="
          width:3px;min-height:36px;border-radius:2px;
          background:${color};flex-shrink:0;align-self:stretch;
        "></div>

        <!-- Content -->
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;margin-bottom:2px;">
            <span style="
              font-size:0.82rem;font-weight:${unread ? '700' : '600'};
              color:var(--text,#1E293B);
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
            ">${_esc(n.title)}</span>
            ${unread ? `<span style="
              width:7px;height:7px;border-radius:50%;
              background:#4F46E5;flex-shrink:0;
            "></span>` : ''}
          </div>
          <div style="
            font-size:0.76rem;color:var(--text-muted,#64748B);
            margin-bottom:3px;
            display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
          ">${_esc(n.body)}</div>
          <div style="font-size:0.7rem;color:#94A3B8;">${_timeAgo(n.createdAt)}</div>
        </div>
      </button>
    `;
  }).join('');
}

// ── Badge ─────────────────────────────────────────────────────

function _updateBadge() {
  if (!_bellEl) return;
  const badge = _bellEl.querySelector('#notif-badge');
  if (!badge) return;
  const count = getUnreadCount();
  if (count === 0) {
    badge.style.display = 'none';
    badge.textContent = '';
  } else {
    badge.style.display = 'flex';
    badge.textContent = count > 99 ? '99+' : String(count);
  }
}

// ── Mark read ─────────────────────────────────────────────────

function _markRead(id) {
  const notifications = _load();
  const idx = notifications.findIndex(n => n.id === id);
  if (idx !== -1) {
    notifications[idx].read = true;
    _save(notifications);
    _updateBadge();
  }
}

function _markAllRead() {
  const userId = getUser()?.id || null;
  const notifications = _load().map(n => {
    if (!userId || !n.userId || n.userId === userId) return { ...n, read: true };
    return n;
  });
  _save(notifications);
  _updateBadge();
}

// ── Toast ─────────────────────────────────────────────────────

function _showToast(notif) {
  _toastEl?.remove();

  const toast = document.createElement('div');
  toast.id = 'notif-toast';
  const color = TYPE_COLORS[notif.type] || TYPE_COLORS.system;

  Object.assign(toast.style, {
    position:     'fixed',
    top:          'calc(var(--safe-top,0px) + 56px)',
    right:        '8px',
    width:        'min(300px,86vw)',
    zIndex:       '200',
    background:   'var(--surface,#fff)',
    border:       '1.5px solid var(--border,#E2E8F0)',
    borderLeft:   `4px solid ${color}`,
    borderRadius: '10px',
    padding:      '10px 12px',
    boxShadow:    '0 4px 16px rgba(0,0,0,0.12)',
    animation:    'notifToastIn 0.22s ease',
    cursor:       'pointer',
  });

  toast.innerHTML = `
    <style>
      @keyframes notifToastIn {
        from { opacity:0; transform:translateY(-10px); }
        to   { opacity:1; transform:translateY(0); }
      }
    </style>
    <div style="font-weight:700;font-size:0.8rem;color:var(--text,#1E293B);margin-bottom:2px;">
      🔔 ${_esc(notif.title)}
    </div>
    <div style="font-size:0.74rem;color:var(--text-muted,#64748B);
      display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
      ${_esc(notif.body)}
    </div>
  `;

  toast.addEventListener('click', () => {
    _markRead(notif.id);
    toast.remove();
    if (notif.route) window.location.hash = notif.route;
  });

  document.body.appendChild(toast);
  _toastEl = toast;

  setTimeout(() => {
    if (_toastEl === toast) {
      toast.style.transition = 'opacity 0.3s';
      toast.style.opacity = '0';
      setTimeout(() => { if (_toastEl === toast) { toast.remove(); _toastEl = null; } }, 320);
    }
  }, 3000);
}

// ── Seed demo notifications ───────────────────────────────────

function _seedIfEmpty(status) {
  const existing = _load();
  // Only seed if no notifications at all
  if (existing.length > 0) return;

  const now  = Date.now();
  const day  = 86400_000;

  const seeds = {
    APPLICANT: [
      {
        type:  'offer',
        title: '새 오퍼가 도착했습니다',
        body:  'HR 매니저님이 HR Business Partner 포지션 오퍼를 보냈습니다',
        route: '#/applicant/profile',
        createdAt: new Date(now - day * 0.3).toISOString(),
      },
      {
        type:  'interview',
        title: '면접 일정이 확정되었습니다',
        body:  '5/29(수) 10:00 화상 면접이 확정되었습니다',
        route: '#/applicant/apply',
        createdAt: new Date(now - day * 1.1).toISOString(),
      },
    ],
    MEMBER: [
      {
        type:  'diagnostic',
        title: '역량 진단 배정',
        body:  '관리자가 일반 직원 역량 평가를 배정했습니다',
        route: '#/assessment',
        createdAt: new Date(now - day * 0.5).toISOString(),
      },
      {
        type:  'system',
        title: '성장 계획 업데이트',
        body:  'IDP가 업데이트되었습니다. 확인해보세요',
        route: '#/growth',
        createdAt: new Date(now - day * 1.8).toISOString(),
      },
    ],
    ALUMNI: [
      {
        type:  'boomerang',
        title: 'HR에서 연락이 왔습니다',
        body:  'HR 매니저님이 재입사 관련 메시지를 보냈습니다',
        route: '#/alumni/boomerang',
        createdAt: new Date(now - day * 0.2).toISOString(),
      },
      {
        type:  'system',
        title: '반갑습니다, 박동문님',
        body:  '회사 소식이 업데이트되었습니다',
        route: '#/alumni',
        createdAt: new Date(now - day * 1.5).toISOString(),
      },
    ],
  };

  const list = (seeds[status] || seeds.MEMBER).map(s => ({
    id:        _uid(),
    type:      s.type,
    title:     s.title,
    body:      s.body,
    read:      false,
    createdAt: s.createdAt,
    route:     s.route,
  }));

  _save(list);
}

// ── localStorage helpers ──────────────────────────────────────

function _load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function _loadForUser() {
  const all = _load();
  const userId = getUser()?.id || null;
  if (!userId) return all;
  // userId 없는 구형 알림 + 현재 유저 알림만 표시
  return all.filter(n => !n.userId || n.userId === userId);
}

function _save(list) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {}
}

// ── Time formatting ───────────────────────────────────────────

function _timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff) || diff < 0) return '';
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);

  if (mins < 1)   return '방금 전';
  if (mins < 60)  return `${mins}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days === 1) return '어제';
  return `${days}일 전`;
}

// ── Misc helpers ──────────────────────────────────────────────

function _uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : `n-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

function _esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
