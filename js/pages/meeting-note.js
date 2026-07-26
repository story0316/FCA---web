/**
 * meeting-note.js — 1:1 미팅 노트 (아젠다 · 액션아이템 · 히스토리)
 */

import {getUser, isAdmin, isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
const TODAY = new Date().toISOString().slice(0,10);

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId() {
  const s = _session();
  return s.empId || s.userId || getUser()?.id || 'EMP001';
}

const LS_MEETINGS = 'hr_meeting_notes';

const DEMO_PEERS = [];
const LEGACY_MEETING_IDS = new Set(['M001','M002','M003']);

const STATUS_META = {
  scheduled: { label: '예정', color: '#3B82F6', bg: '#EFF6FF' },
  done:      { label: '완료', color: '#10B981', bg: '#ECFDF5' },
  cancelled: { label: '취소', color: 'var(--text-muted)', bg: '#F1F5F9' },
};

function _getMeetings() {
  const saved = localStorage.getItem(LS_MEETINGS);
  if (!saved) return [];
  try {
    const d = JSON.parse(saved);
    const cleaned = d.filter(m => !LEGACY_MEETING_IDS.has(m.id));
    if (cleaned.length < d.length) localStorage.setItem(LS_MEETINGS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}

function _saveMeetings(list) {
  localStorage.setItem(LS_MEETINGS, JSON.stringify(list));
}

let _view = 'list'; // 'list' | 'detail' | 'new'
let _selectedId = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _view = 'list'; _selectedId = null;
  _renderPage(root);
}

export function unmount() { _view = 'list'; _selectedId = null; }

function _renderPage(root) {
  if (_view === 'detail') { _renderDetail(root); return; }
  if (_view === 'new')    { _renderNewForm(root); return; }
  _renderList(root);
}

// ── 목록 ─────────────────────────────────────────────────────

function _renderList(root) {
  const user = getUser();
  const userId = _empId();
  const meetings = _getMeetings().filter(m => m.userId === userId)
    .sort((a, b) => b.date.localeCompare(a.date));

  const upcoming = meetings.filter(m => m.status === 'scheduled');
  const past     = meetings.filter(m => m.status !== 'scheduled');

  const pendingActions = meetings
    .flatMap(m => (m.actions || []).filter(a => !a.done))
    .length;

  root.innerHTML = `
<div class="page" style="background:var(--bg)">
  <div class="top-bar">
    <button class="btn btn-ghost btn-sm" onclick="window.navBack()" style="padding:8px;min-height:40px">←</button>
    <div class="top-bar-title" style="flex:1;text-align:center">💬 1:1 미팅</div>
    <button id="new-btn" style="padding:8px 12px;background:#4F46E5;color:#fff;border:none;
      border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;min-height:40px">+ 예약</button>
  </div>

  <div class="page-content" style="padding:16px">

    ${pendingActions > 0 ? `
    <div style="background:#FEF3C7;border-radius:12px;padding:12px;margin-bottom:14px;
         border-left:4px solid #F59E0B;display:flex;align-items:center;gap:10px">
      <span style="font-size:20px">⚡</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:#92400E">미완료 액션아이템 ${pendingActions}건</div>
        <div style="font-size:11px;color:#78350F;margin-top:2px">이전 미팅에서 합의된 항목을 완료해주세요</div>
      </div>
    </div>` : ''}

    ${upcoming.length ? `
    <div style="font-size:12px;font-weight:700;color:var(--text-muted);letter-spacing:0.05em;margin-bottom:8px">📅 예정된 미팅</div>
    ${upcoming.map(m => _meetingCard(m)).join('')}
    <div style="height:1px;background:var(--border);margin:14px 0"></div>` : ''}

    <div style="font-size:12px;font-weight:700;color:var(--text-muted);letter-spacing:0.05em;margin-bottom:8px">
      🕐 지난 미팅 (${past.length}건)
    </div>

    ${past.length
      ? past.map(m => _meetingCard(m)).join('')
      : `<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:13px">
           <div style="font-size:36px;margin-bottom:8px">💬</div>
           <div style="margin-bottom:14px">아직 진행된 미팅이 없습니다.<br>첫 1:1 미팅을 예약해보세요!</div>
           <button onclick="document.querySelector('#new-btn')?.click()" style="padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">미팅 예약</button>
         </div>`}

  </div>
</div>`;

  root.querySelector('#new-btn').addEventListener('click', () => { _view = 'new'; _renderPage(root); });
  root.querySelectorAll('.meeting-card').forEach(card => {
    card.addEventListener('click', () => { _selectedId = card.dataset.id; _view = 'detail'; _renderPage(root); });
  });
}

function _meetingCard(m) {
  const st = STATUS_META[m.status] || STATUS_META.scheduled;
  const pendingCnt = (m.actions || []).filter(a => !a.done).length;
  return `
<div class="meeting-card" data-id="${m.id}"
  style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
         padding:14px;margin-bottom:8px;cursor:pointer;transition:border-color .15s"
  onmouseover="this.style.borderColor='#4F46E5'" onmouseout="this.style.borderColor='var(--border)'">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:24px">${m.peerAvatar}</span>
      <div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">${m.peerName}</div>
        <div style="font-size:11px;color:var(--text-muted)">${m.peerRole}</div>
      </div>
    </div>
    <span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:10px;
      color:${st.color};background:${st.bg}">${st.label}</span>
  </div>
  <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">
    📅 ${m.date} ${m.time} · ${m.duration}분
  </div>
  ${m.agenda ? `<div style="font-size:12px;color:var(--text);line-height:1.5;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
    ${m.agenda.split('\n')[0]}...</div>` : ''}
  ${pendingCnt > 0 ? `<div style="margin-top:6px;font-size:11px;color:#F59E0B;font-weight:600">
    ⚡ 미완료 액션 ${pendingCnt}건</div>` : ''}
</div>`;
}

// ── 상세/노트 편집 ──────────────────────────────────────────

function _renderDetail(root) {
  const meetings = _getMeetings();
  const m = meetings.find(x => x.id === _selectedId);
  if (!m) { _view = 'list'; _renderPage(root); return; }

  const st = STATUS_META[m.status] || STATUS_META.scheduled;

  root.innerHTML = `
<div class="page" style="background:var(--bg)">
  <div class="top-bar">
    <button id="back-btn" class="btn btn-ghost btn-sm" style="padding:8px;min-height:40px">←</button>
    <div class="top-bar-title" style="flex:1;text-align:center">미팅 상세</div>
    ${m.status === 'scheduled' ? `
    <button id="done-btn" style="padding:6px 10px;background:#10B981;color:#fff;border:none;
      border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;min-height:40px">완료 처리</button>` : '<div style="min-width:40px"></div>'}
  </div>

  <div class="page-content" style="padding:16px">

    <!-- 상단 정보 -->
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span style="font-size:32px">${m.peerAvatar}</span>
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--text)">${m.peerName}</div>
          <div style="font-size:12px;color:var(--text-muted)">${m.peerRole}</div>
        </div>
        <span style="margin-left:auto;font-size:12px;font-weight:600;padding:3px 9px;
          border-radius:10px;color:${st.color};background:${st.bg}">${st.label}</span>
      </div>
      <div style="font-size:13px;color:var(--text-muted)">📅 ${m.date} ${m.time} · ${m.duration}분</div>
    </div>

    <!-- 아젠다 -->
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">📋 아젠다</div>
      ${m.status === 'scheduled'
        ? `<textarea maxlength="500" id="agenda-edit" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text);height:80px;resize:none;
             box-sizing:border-box;font-family:inherit;line-height:1.5">${m.agenda || ''}</textarea>
           <button id="save-agenda-btn" style="margin-top:8px;padding:7px 14px;background:#EEF2FF;
             color:#4338CA;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">
             저장</button>`
        : `<div style="font-size:13px;color:var(--text);line-height:1.8;white-space:pre-line">${m.agenda || '없음'}</div>`}
    </div>

    <!-- 미팅 노트 -->
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">📝 미팅 노트</div>
      <textarea maxlength="500" id="notes-edit" placeholder="미팅 중 논의된 내용을 기록하세요..."
        style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:10px;
               font-size:13px;background:var(--bg);color:var(--text);height:120px;resize:none;
               box-sizing:border-box;font-family:inherit;line-height:1.5">${m.notes || ''}</textarea>
      <button id="save-notes-btn" style="margin-top:8px;padding:7px 14px;background:#EEF2FF;
        color:#4338CA;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">
        저장</button>
    </div>

    <!-- 액션아이템 -->
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">⚡ 액션아이템</div>
      <div id="actions-list">
        ${(m.actions || []).map(a => `
        <div class="action-item" data-id="${a.id}"
          style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
          <button class="toggle-action" data-id="${a.id}"
            style="width:22px;height:22px;border-radius:6px;flex-shrink:0;cursor:pointer;
                   border:2px solid ${a.done?'#10B981':'var(--border)'};
                   background:${a.done?'#10B981':'transparent'};color:#fff;font-size:11px;
                   display:flex;align-items:center;justify-content:center">
            ${a.done ? '✓' : ''}
          </button>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;color:var(--text);${a.done?'text-decoration:line-through;color:var(--text-muted)':''}">${a.text}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${a.assignee} · ${a.dueDate}</div>
          </div>
        </div>`).join('')}
      </div>
      <!-- 새 액션 추가 -->
      <div style="display:flex;gap:6px;margin-top:10px">
        <input id="new-action" type="text" placeholder="새 액션아이템..."
          style="flex:1;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;
                 font-size:12px;background:var(--bg);color:var(--text)">
        <input id="action-due" type="date" value="${new Date(Date.now()+86400000*7).toISOString().slice(0,10)}"
          style="padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:11px;
                 background:var(--bg);color:var(--text);width:110px" min="${TODAY}">
        <button id="add-action-btn" style="padding:8px 10px;background:#4F46E5;color:#fff;
          border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">추가</button>
      </div>
    </div>

  </div>
</div>`;

  root.querySelector('#back-btn').addEventListener('click', () => { _view = 'list'; _renderPage(root); });

  root.querySelector('#save-agenda-btn')?.addEventListener('click', () => {
    const val = root.querySelector('#agenda-edit').value;
    const list = _getMeetings();
    const idx = list.findIndex(x => x.id === m.id);
    if (idx >= 0) { list[idx].agenda = val; _saveMeetings(list); }
    showToast('아젠다가 저장되었습니다.', 'success')
    addNotification({ type: 'success', title: '회의록', body: '아젠다가 저장되었습니다.' });
  });

  root.querySelector('#save-notes-btn').addEventListener('click', () => {
    const val = root.querySelector('#notes-edit').value;
    const list = _getMeetings();
    const idx = list.findIndex(x => x.id === m.id);
    if (idx >= 0) { list[idx].notes = val; _saveMeetings(list); }
    showToast('노트가 저장되었습니다.', 'success')
    addNotification({ type: 'success', title: '회의록', body: '노트가 저장되었습니다.' });
  });

  root.querySelector('#done-btn')?.addEventListener('click', () => {
    const list = _getMeetings();
    const idx = list.findIndex(x => x.id === m.id);
    if (idx >= 0) { list[idx].notes = root.querySelector('#notes-edit').value; list[idx].status = 'done'; _saveMeetings(list); }
    showToast('미팅이 완료 처리되었습니다.', 'success')
    addNotification({ type: 'success', title: '회의록', body: '미팅이 완료 처리되었습니다.' });
    _view = 'list'; _renderPage(root);
  });

  root.querySelectorAll('.toggle-action').forEach(btn => {
    btn.addEventListener('click', () => {
      const list = _getMeetings();
      const idx  = list.findIndex(x => x.id === m.id);
      if (idx < 0) return;
      const act  = list[idx].actions.find(a => a.id === btn.dataset.id);
      if (act) { act.done = !act.done; _saveMeetings(list); _renderDetail(root); }
    });
  });

  root.querySelector('#add-action-btn').addEventListener('click', () => {
    const text = root.querySelector('#new-action').value.trim();
    if (!text) return;
    const due  = root.querySelector('#action-due').value;
    const list = _getMeetings();
    const idx  = list.findIndex(x => x.id === m.id);
    if (idx >= 0) {
      list[idx].actions = list[idx].actions || [];
      list[idx].actions.push({ id: 'A_' + Date.now(), text, done: false, assignee: '나', dueDate: due });
      _saveMeetings(list);
      _renderDetail(root);
    }
  });
}

// ── 새 미팅 예약 ─────────────────────────────────────────────

function _renderNewForm(root) {
  const user = getUser();
  const today = new Date().toISOString().slice(0, 10);

  root.innerHTML = `
<div class="page" style="background:var(--bg)">
  <div class="top-bar">
    <button id="back-btn" class="btn btn-ghost btn-sm" style="padding:8px;min-height:40px">←</button>
    <div class="top-bar-title" style="flex:1;text-align:center">1:1 미팅 예약</div>
    <div style="min-width:40px"></div>
  </div>

  <div class="page-content" style="padding:16px">

    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">상대방 선택</div>
      ${DEMO_PEERS.length
        ? `<div id="peer-grid" style="display:flex;flex-direction:column;gap:6px">
        ${DEMO_PEERS.map(p => `
        <button class="peer-btn" data-id="${p.id}" data-name="${p.name}" data-role="${p.role}" data-avatar="${p.avatar}"
          style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:2px solid var(--border);
                 border-radius:10px;cursor:pointer;background:var(--bg);text-align:left">
          <span style="font-size:22px">${p.avatar}</span>
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--text)">${p.name}</div>
            <div style="font-size:11px;color:var(--text-muted)">${p.role}</div>
          </div>
        </button>`).join('')}
        </div>`
        : `<input id="peer-name-input" type="text" placeholder="상대방 이름 (예: 홍길동 팀장)"
            style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;
                   font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">`}
    </div>

    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px">
      ${_ff('meet-date', '날짜', today, 'date')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${_ff('meet-time', '시간', '10:00', 'time')}
        ${_ff('meet-dur',  '소요시간(분)', '30', 'number')}
      </div>
      <div style="margin-top:10px">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">아젠다</label>
        <textarea maxlength="500" id="meet-agenda" placeholder="논의할 항목을 입력하세요..."
          style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:10px;
                 font-size:13px;background:var(--bg);color:var(--text);height:80px;resize:none;
                 box-sizing:border-box;font-family:inherit;line-height:1.5"></textarea>
      </div>
    </div>

    <button id="save-btn" class="btn btn-primary" style="width:100%">미팅 예약하기</button>

  </div>
</div>`;

  let selectedPeer = null;

  root.querySelector('#back-btn').addEventListener('click', () => { _view = 'list'; _renderPage(root); });

  root.querySelectorAll('.peer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.peer-btn').forEach(b => { b.style.borderColor = 'var(--border)'; b.style.background = 'var(--bg)'; });
      btn.style.borderColor = '#4F46E5'; btn.style.background = '#EEF2FF';
      selectedPeer = { id: btn.dataset.id, name: btn.dataset.name, role: btn.dataset.role, avatar: btn.dataset.avatar };
    });
  });

  root.querySelector('#save-btn').addEventListener('click', () => {
    if (!selectedPeer) {
      const nameInput = root.querySelector('#peer-name-input');
      if (nameInput) {
        const name = nameInput.value.trim();
        if (!name) { showToast('상대방 이름을 입력하세요.', 'error'); return; }
        selectedPeer = { id: 'PEER_' + Date.now(), name, role: '', avatar: '👤' };
      } else {
        showToast('상대방을 선택하세요.', 'error'); return;
      }
    }
    const date = root.querySelector('#meet-date').value;
    if (!date) { showToast('날짜를 선택하세요.', 'error'); return; }
    const userId = _empId();
    const meetings = _getMeetings();
    meetings.unshift({
      id: 'M_' + Date.now(), userId,
      peerId: selectedPeer.id, peerName: selectedPeer.name,
      peerRole: selectedPeer.role, peerAvatar: selectedPeer.avatar,
      date, time: root.querySelector('#meet-time').value,
      duration: parseInt(root.querySelector('#meet-dur').value) || 30,
      agenda: root.querySelector('#meet-agenda').value.trim(),
      notes: '', status: 'scheduled', actions: [],
      createdAt: new Date().toISOString(),
    });
    _saveMeetings(meetings);
    showToast('미팅이 예약되었습니다.', 'success')
    addNotification({ type: 'success', title: '회의록', body: '미팅이 예약되었습니다.' });
    _view = 'list'; _renderPage(root);
  });
}

function _ff(id, label, value, type) {
  return `<div style="margin-bottom:10px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">${label}</label>
    <input id="${id}" type="${type}" value="${value}"
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>`;
}
