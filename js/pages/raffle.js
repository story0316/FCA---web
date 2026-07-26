import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LEGACY_RAFFLE_IDS = new Set(['RF001', 'RF002', 'RF003']);

const LS_RAFFLES = 'hr_raffles';
const LS_TICKETS = 'hr_raffle_tickets';

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId()   { return _session().empId || _session().userId || 'EMP001'; }
function _empName() { return _session().empName || '사용자'; }

function _getRaffles() {
  const raw = localStorage.getItem(LS_RAFFLES);
  if (!raw) return [];
  try {
    const d = JSON.parse(raw);
    const cleaned = d.filter(r => !LEGACY_RAFFLE_IDS.has(r.id));
    if (cleaned.length < d.length) localStorage.setItem(LS_RAFFLES, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}
function _saveRaffles(d) { localStorage.setItem(LS_RAFFLES, JSON.stringify(d)); }

function _getTickets()    { try { return JSON.parse(localStorage.getItem(LS_TICKETS) || '[]'); } catch { return []; } }
function _saveTickets(d)  { localStorage.setItem(LS_TICKETS, JSON.stringify(d)); }

let _root = null;
let _activeTab = 'open';

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
  _activeTab = 'open';
  _render();
}

export function unmount() {
  delete window._rfSetTab;
  delete window._rfApply;
  _root = null;
}

function _render() {
  if (!_root) return;
  const raffles = _getRaffles();
  const tickets = _getTickets();
  const myTicketRaffleIds = new Set(tickets.filter(t => t.empId === _empId()).map(t => t.raffleId));

  const openRaffles  = raffles.filter(r => r.status === 'open');
  const drawnRaffles = raffles.filter(r => r.status === 'drawn');

  _root.innerHTML = `
    <div class="page" style="height:100vh;overflow:hidden;background:var(--bg);display:flex;flex-direction:column;">
      <div style="background:var(--card-bg);padding:16px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);flex-shrink:0;">
        <button onclick="window.navBack()" style="background:none;border:none;font-size:20px;cursor:pointer;padding:4px;">←</button>
        <h1 style="margin:0;font-size:17px;font-weight:700;color:var(--text);">사내 추첨</h1>
      </div>
      <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0;">
        <button onclick="window._rfSetTab('open')"
          style="flex:1;padding:12px;border:none;background:none;font-size:14px;font-weight:600;cursor:pointer;color:${_activeTab==='open'?'#6366f1':'#6b7280'};border-bottom:2px solid ${_activeTab==='open'?'#6366f1':'transparent'};">
          진행 중
        </button>
        <button onclick="window._rfSetTab('drawn')"
          style="flex:1;padding:12px;border:none;background:none;font-size:14px;font-weight:600;cursor:pointer;color:${_activeTab==='drawn'?'#6366f1':'#6b7280'};border-bottom:2px solid ${_activeTab==='drawn'?'#6366f1':'transparent'};">
          당첨 결과
        </button>
      </div>
      <div class="page-content" style="overflow-y:auto;flex:1;padding:16px;display:flex;flex-direction:column;gap:12px;">
        ${_activeTab === 'open' ? _renderOpen(openRaffles, myTicketRaffleIds) : _renderDrawn(drawnRaffles)}
      </div>
    </div>`;

  window._rfSetTab = (t) => { _activeTab = t; _render(); };
  window._rfApply = _handleApply;
}

function _renderOpen(raffles, myTicketRaffleIds) {
  if (!raffles.length) return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:12px;">
      <span style="font-size:48px;">🎰</span>
      <p style="margin:0;font-size:15px;font-weight:600;color:var(--text);">진행 중인 추첨이 없습니다</p>
      <p style="margin:0;font-size:12px;color:var(--text-muted)">새로운 추첨 이벤트는 공지사항에서 확인하세요.</p>
      <button onclick="window.location.hash='#/notice'"
        style="padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">공지사항 보기</button>
    </div>`;

  return raffles.map(r => {
    const applied = myTicketRaffleIds.has(r.id);
    return `
      <div style="background:var(--card-bg);border-radius:14px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
          <span style="font-size:32px;">${r.icon}</span>
          <div style="flex:1;">
            <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:var(--text);">${r.title}</p>
            <p style="margin:0;font-size:13px;color:var(--text-muted);">🎁 ${r.prize}</p>
          </div>
        </div>
        <div style="display:flex;gap:16px;margin-bottom:14px;padding:10px;background:var(--bg);border-radius:8px;">
          <div style="flex:1;text-align:center;">
            <p style="margin:0 0 2px;font-size:11px;color:var(--text-muted);">응모 마감</p>
            <p style="margin:0;font-size:13px;font-weight:600;color:var(--text);">${r.deadline}</p>
          </div>
          <div style="flex:1;text-align:center;border-left:1px solid #e5e7eb;">
            <p style="margin:0 0 2px;font-size:11px;color:var(--text-muted);">추첨일</p>
            <p style="margin:0;font-size:13px;font-weight:600;color:var(--text);">${r.drawDate}</p>
          </div>
          <div style="flex:1;text-align:center;border-left:1px solid #e5e7eb;">
            <p style="margin:0 0 2px;font-size:11px;color:var(--text-muted);">응모자</p>
            <p style="margin:0;font-size:13px;font-weight:600;color:var(--text);">${r.participants}명</p>
          </div>
        </div>
        <button onclick="window._rfApply('${r.id}')" ${applied ? 'disabled' : ''}
          style="width:100%;padding:12px;background:${applied?'#f3f4f6':'#6366f1'};color:${applied?'#9ca3af':'#fff'};border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:${applied?'default':'pointer'};">
          ${applied ? '✓ 응모 완료' : '응모하기'}
        </button>
      </div>`;
  }).join('');
}

function _renderDrawn(raffles) {
  if (!raffles.length) return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:12px;">
      <span style="font-size:48px;">🏆</span>
      <p style="margin:0;font-size:15px;font-weight:600;color:var(--text);">당첨 결과가 없습니다</p>
    </div>`;

  return raffles.map(r => `
    <div style="background:var(--card-bg);border-radius:14px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
      <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
        <span style="font-size:32px;">${r.icon}</span>
        <div style="flex:1;">
          <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:var(--text);">${r.title}</p>
          <p style="margin:0;font-size:13px;color:var(--text-muted);">🎁 ${r.prize}</p>
        </div>
        <span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;background:var(--bg);color:var(--text-muted);">추첨완료</span>
      </div>
      <div style="padding:12px;background:#fef9c3;border-radius:8px;display:flex;align-items:center;gap:10px;">
        <span style="font-size:20px;">🏆</span>
        <div>
          <p style="margin:0 0 2px;font-size:12px;color:#713f12;">당첨자</p>
          <p style="margin:0;font-size:15px;font-weight:700;color:#713f12;">${r.winner || '미정'}</p>
        </div>
      </div>
      <p style="margin:8px 0 0;font-size:12px;color:var(--text-muted);">추첨일: ${r.drawDate} · 참여: ${r.participants}명</p>
    </div>`).join('');
}

function _handleApply(raffleId) {
  const raffles = _getRaffles();
  const raffle = raffles.find(r => r.id === raffleId);
  if (!raffle) { showToast('추첨 정보를 찾을 수 없습니다.', 'error'); return; }
  if (raffle.status !== 'open') { showToast('응모 기간이 종료되었습니다.', 'error'); return; }

  const tickets = _getTickets();
  const dup = tickets.find(t => t.empId === _empId() && t.raffleId === raffleId);
  if (dup) { showToast('이미 응모한 추첨입니다.', 'error'); return; }

  tickets.push({
    id: 'TK' + Date.now(),
    raffleId,
    empId: _empId(),
    empName: _empName(),
    createdAt: new Date().toISOString(),
  });
  _saveTickets(tickets);

  const idx = raffles.findIndex(r => r.id === raffleId);
  if (idx > -1) { raffles[idx].participants = (raffles[idx].participants || 0) + 1; _saveRaffles(raffles); }

  showToast(`${raffle.title} 응모가 완료되었습니다!`, 'success')
    addNotification({ type: 'success', title: '경품 응모', body: '응모가 완료되었습니다!' });
  _render();
}
