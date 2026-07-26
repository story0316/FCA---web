/**
 * raffle-admin.js — 추첨 관리 (관리자)
 */

import { showToast } from '../../components/toast.js'
import { addNotification } from '../../components/notification-hub.js';

const LS_RAFFLES = 'hr_raffles';
const LS_TICKETS = 'hr_raffle_tickets';
const LEGACY_TICKET_IDS = new Set(['TK001', 'TK002', 'TK003', 'TK004', 'TK005']);
const LEGACY_RAFFLE_IDS = new Set(['RF001', 'RF002', 'RF003']);

function _loadRaffles() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_RAFFLES) || '[]');
    const list = Array.isArray(saved) ? saved : [];
    const cleaned = list.filter(item => !LEGACY_RAFFLE_IDS.has(item.id));
    if (cleaned.length !== list.length) _saveRaffles(cleaned);
    return cleaned;
  }
  catch { return []; }
}
function _saveRaffles(list) { localStorage.setItem(LS_RAFFLES, JSON.stringify(list)); }

function _loadTickets() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_TICKETS) || '[]');
    const list = Array.isArray(saved) ? saved : [];
    const cleaned = list.filter(item => !LEGACY_TICKET_IDS.has(item.id));
    if (cleaned.length !== list.length) _saveTickets(cleaned);
    return cleaned;
  }
  catch { return []; }
}
function _saveTickets(list) { localStorage.setItem(LS_TICKETS, JSON.stringify(list)); }

let _tab = 'manage';
let _root = null;

export function render(root) { _root = root; _tab = 'manage'; _draw(); }
export function unmount() { _root = null;
  _tab = 'manage';
}

function _draw() {
  const raffles = _loadRaffles();
  const tickets = _loadTickets();
  const open    = raffles.filter(r => r.status === 'open');
  const drawn   = raffles.filter(r => r.status === 'drawn');

  const tabs = [
    { key:'manage', label:'추첨 관리' },
    { key:'create', label:'추첨 생성' },
  ];

  let contentHtml = '';
  if (_tab === 'manage') {
    contentHtml = raffles.length === 0
      ? `<div style="text-align:center;padding:48px 0;color:#94A3B8">
           <div style="font-size:36px;margin-bottom:8px">&#127381;</div>
           <div style="font-size:13px">추첨이 없습니다.</div>
         </div>`
      : raffles.map(r => {
          const rTickets = tickets.filter(t => t.raffleId === r.id);
          return _raffleCard(r, rTickets);
        }).join('');
  } else {
    contentHtml = _createForm();
  }

  _root.innerHTML = `
<div style="padding:16px;max-width:600px;margin:0 auto">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button id="rf-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text)">&#8592;</button>
    <h2 style="margin:0;font-size:17px;font-weight:700;color:var(--text)">추첨 관리</h2>
  </div>

  <!-- Stats -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
    ${[
      { label:'진행 중',    val:open.length,    color:'#10B981' },
      { label:'완료',       val:drawn.length,   color:'#94A3B8' },
      { label:'총 참가',    val:tickets.length, color:'#4F46E5' },
    ].map(s=>`
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;text-align:center">
      <div style="font-size:20px;font-weight:700;color:${s.color}">${s.val}</div>
      <div style="font-size:11px;color:#64748B;margin-top:2px">${s.label}</div>
    </div>`).join('')}
  </div>

  <!-- Tabs -->
  <div style="display:flex;gap:6px;margin-bottom:14px">
    ${tabs.map(t=>`
    <button class="rf-tab" data-tab="${t.key}" style="
      padding:7px 14px;font-size:12px;font-weight:600;border-radius:20px;cursor:pointer;
      border:1.5px solid ${_tab===t.key?'#4F46E5':'var(--border)'};
      background:${_tab===t.key?'#EEF2FF':'var(--card-bg)'};
      color:${_tab===t.key?'#4F46E5':'#64748B'}">${t.label}</button>`).join('')}
  </div>

  <!-- Content -->
  <div id="rf-content">${contentHtml}</div>
</div>`;

  _bindEvents();
}

function _raffleCard(r, rTickets) {
  const isOpen  = r.status === 'open';
  const isDrawn = r.status === 'drawn';
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
    <div>
      <div style="font-size:14px;font-weight:700;color:var(--text)">${r.title}</div>
      <div style="font-size:11px;color:#64748B;margin-top:2px">상품: ${r.prize}</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;
      background:${isOpen?'#D1FAE5':'#F1F5F9'};
      color:${isOpen?'#10B981':'#94A3B8'}">${isOpen?'진행 중':'완료'}</span>
  </div>
  <div style="display:grid;gap:4px;margin-bottom:10px">
    <div style="font-size:12px;color:#64748B">마감: ${r.deadline}</div>
    <div style="font-size:12px;color:#64748B">참가자: ${rTickets.length}명
      ${rTickets.length > 0 ? ` (${rTickets.map(t=>t.empName).join(', ')})` : ''}
    </div>
    ${isDrawn && r.winner ? `<div style="font-size:12px;font-weight:600;color:#10B981">당첨자: ${r.winner}</div>` : ''}
  </div>
  ${isOpen ? `
  <button class="rf-draw" data-id="${r.id}" style="width:100%;padding:10px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">&#127381; 추첨 실행</button>
  ` : ''}
</div>`;
}

function _createForm() {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="display:grid;gap:12px">
    <div>
      <label style="display:block;font-size:12px;font-weight:600;color:#64748B;margin-bottom:4px">추첨 제목</label>
      <input id="rf-title" type="text" placeholder="예: 7월 행복 추첨"
        style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;color:#64748B;margin-bottom:4px">상품</label>
      <input id="rf-prize" type="text" placeholder="예: 스타벅스 기프티콘"
        style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;color:#64748B;margin-bottom:4px">마감일</label>
      <input id="rf-deadline" type="date"
        style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;color:#64748B;margin-bottom:4px">1인 최대 티켓</label>
      <input id="rf-max" type="number" value="1" min="1"
        style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
    <button id="rf-create" style="padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">생성</button>
  </div>
</div>`;
}

function _bindEvents() {
  _root.querySelector('#rf-back')?.addEventListener('click', () => window.navBack());

  _root.querySelectorAll('.rf-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.tab; _draw(); });
  });

  _root.querySelectorAll('.rf-draw').forEach(btn => {
    btn.addEventListener('click', () => {
      const raffleId = btn.dataset.id;
      const tickets  = _loadTickets();
      const raffles  = _loadRaffles();
      const idx = raffles.findIndex(r => r.id === raffleId);
      if (idx < 0) return;
      const participants = tickets.filter(t => t.raffleId === raffleId);
      let winner;
      if (!participants.length) {
        showToast('참가자가 없어 추첨을 실행할 수 없습니다.', 'warning');
        return;
      }
      winner = participants[Math.floor(Math.random() * participants.length)].empName;
      raffles[idx].status = 'drawn';
      raffles[idx].winner = winner;
      _saveRaffles(raffles);
      showToast(`추첨 완료! 당첨자: ${winner}`, 'success');
      addNotification({ type: "success", title: "추첨 관리", body: `추첨 완료! 당첨자: ${winner}` });
      _draw();
    });
  });

  _root.querySelector('#rf-create')?.addEventListener('click', () => {
    const title    = _root.querySelector('#rf-title')?.value.trim();
    const prize    = _root.querySelector('#rf-prize')?.value.trim();
    const deadline = _root.querySelector('#rf-deadline')?.value;
    const maxTickets = parseInt(_root.querySelector('#rf-max')?.value) || 1;
    if (!title || !prize || !deadline) { showToast('모든 항목을 입력해 주세요.'); return; }
    const raffles = _loadRaffles();
    const newId = 'RF' + String(Date.now()).slice(-6);
    raffles.push({ id:newId, title, prize, deadline, maxTickets, status:'open', winner:null, createdAt:new Date().toISOString().slice(0,10) });
    _saveRaffles(raffles);
    showToast('추첨이 생성되었습니다.');
      addNotification({ type: 'success', title: '추첨 관리', body: '추첨이 생성되었습니다.' });
    _tab = 'manage';
    _draw();
  });
}
export function mount(root) { return render(root); }
