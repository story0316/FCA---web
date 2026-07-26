/**
 * meal-ticket.js — 식권 신청 (직원용)
 * Route: #/meal-ticket
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_meal_tickets';
const MAX_TICKETS = 22;

function _demoMealTickets() {
  const uid = _uid(); const name = _uname(); const dept = _udept();
  return [
    { id: `meal_${uid}_1`, empId: uid, empName: name, dept, month: '2026-06', requested: 20, allocated: 20, status: 'allocated', reqDate: '2026-06-03' },
    { id: `meal_${uid}_2`, empId: uid, empName: name, dept, month: '2026-05', requested: 22, allocated: 22, status: 'allocated', reqDate: '2026-05-02' },
    { id: `meal_${uid}_3`, empId: uid, empName: name, dept, month: '2026-04', requested: 18, allocated: 18, status: 'allocated', reqDate: '2026-04-01' },
  ];
}

function _load() {
  const demo = _demoMealTickets();
  try {
    const saved = JSON.parse(localStorage.getItem(LS) || '[]');
    return [...demo.filter(d => !saved.find(x => x.id === d.id)), ...saved];
  } catch { return [...demo]; }
}
function _save(list) { localStorage.setItem(LS, JSON.stringify(list)); }
function _uid()  { try { return JSON.parse(localStorage.getItem('hr_session') || '{}').empId  || 'EMP001'; } catch { return 'EMP001'; } }
function _uname(){ try { return JSON.parse(localStorage.getItem('hr_session') || '{}').name   || '사용자'; } catch { return '사용자'; } }
function _udept(){ try { return JSON.parse(localStorage.getItem('hr_session') || '{}').dept   || '소속 미지정'; } catch { return '소속 미지정'; } }
function _currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
}
function _today(){ return new Date().toISOString().slice(0, 10); }
function _fmtMonth(m) {
  const [y, mo] = m.split('-');
  return `${y}년 ${parseInt(mo)}월`;
}

let _showForm = false;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _showForm = false;
  _draw(root);
}

export function unmount() { _showForm = false; }

function _draw(root) {
  const uid     = _uid();
  const all     = _load();
  const mine    = all.filter(t => t.empId === uid).sort((a, b) => b.month.localeCompare(a.month));
  const curMonth = _currentMonth();
  const curReq   = mine.find(t => t.month === curMonth);
  const history  = mine.filter(t => t.month !== curMonth);

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="mt-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🍱 식권 신청</div>
      <div style="font-size:11px;color:var(--text-muted)">${_fmtMonth(curMonth)}</div>
    </div>
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_renderHeader(curReq, curMonth)}
    ${!curReq || _showForm ? _renderForm(curMonth) : ''}
    ${_renderHistory(history)}
  </div>
</div>`;

  root.querySelector('#mt-back').addEventListener('click', () => window.navBack());

  root.querySelector('#mt-apply-btn')?.addEventListener('click', () => { _showForm = true; _draw(root); });
  root.querySelector('#mt-submit-btn')?.addEventListener('click', () => _handleSubmit(root, uid, curMonth));
  root.querySelector('#mt-cancel-btn')?.addEventListener('click', () => { _showForm = false; _draw(root); });
}

function _renderHeader(curReq, curMonth) {
  if (curReq) {
    const isAllocated = curReq.status === 'allocated';
    return `
<div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border-radius:16px;padding:20px;margin-bottom:16px;color:#fff">
  <div style="font-size:12px;opacity:0.85;margin-bottom:4px">이번 달 식권 현황 · ${_fmtMonth(curMonth)}</div>
  <div style="display:flex;align-items:flex-end;gap:8px;margin-bottom:8px">
    <div style="font-size:40px;font-weight:900">${isAllocated ? curReq.allocated : curReq.requested}</div>
    <div style="font-size:16px;opacity:0.85;margin-bottom:8px">매</div>
  </div>
  <div style="font-size:12px;background:rgba(255,255,255,0.2);display:inline-block;padding:4px 10px;border-radius:20px">
    ${isAllocated ? '✓ 지급 완료' : '⏳ 검토 중 · 신청 ' + curReq.requested + '매'}
  </div>
</div>`;
  }

  return `
<div style="background:var(--card-bg);border:2px dashed #C7D2FE;border-radius:16px;padding:20px;
     margin-bottom:16px;text-align:center">
  <div style="font-size:32px;margin-bottom:8px">🍱</div>
  <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px">이번 달 식권 신청 전</div>
  <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px">매월 1일~5일 신청 가능 / 최대 ${MAX_TICKETS}매</div>
  <button id="mt-apply-btn"
    style="background:#4F46E5;color:#fff;border:none;border-radius:10px;
           padding:10px 24px;font-size:13px;font-weight:700;cursor:pointer">
    식권 신청하기
  </button>
</div>`;
}

function _renderForm(curMonth) {
  return `
<div style="background:var(--card-bg);border:1px solid #C7D2FE;border-radius:14px;padding:16px;margin-bottom:16px">
  <div style="font-size:13px;font-weight:700;color:#4F46E5;margin-bottom:12px">
    ${_fmtMonth(curMonth)} 식권 신청
  </div>

  <div style="background:#EEF2FF;border-radius:10px;padding:10px;margin-bottom:14px;font-size:12px;color:#3730A3">
    📋 매월 1일~5일 신청 가능 / 최대 ${MAX_TICKETS}매
  </div>

  <div style="margin-bottom:14px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">
      신청 매수 <span style="color:#EF4444">*</span> <span style="color:var(--text-muted)">(최대 ${MAX_TICKETS}매)</span>
    </label>
    <input id="mt-count" type="number" min="1" max="${MAX_TICKETS}" placeholder="예: 20"
      style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);
             border-radius:10px;font-size:16px;font-weight:700;text-align:center;
             background:var(--bg);color:var(--text)">
  </div>

  <div style="display:flex;gap:8px">
    <button id="mt-cancel-btn"
      style="flex:1;padding:10px;border:1px solid var(--border);border-radius:10px;
             background:var(--bg);color:var(--text-muted);font-size:13px;cursor:pointer">취소</button>
    <button id="mt-submit-btn"
      style="flex:2;padding:10px;border:none;border-radius:10px;
             background:#4F46E5;color:#fff;font-size:13px;font-weight:700;cursor:pointer">신청하기</button>
  </div>
</div>`;
}

function _renderHistory(history) {
  if (!history.length) return `
<div style="text-align:center;padding:30px 20px;color:var(--text-muted)">
  <div style="font-size:32px;margin-bottom:8px">📋</div>
  <div style="font-size:13px;margin-bottom:14px">이전 신청 내역이 없습니다.</div>
  <button onclick="document.querySelector('#mt-apply-btn')?.click()" style="padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">식권 신청하기</button>
</div>`;

  return `
<div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:10px">이전 신청 내역</div>
${history.map(t => `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
     padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
  <div>
    <div style="font-size:13px;font-weight:700;color:var(--text)">${_fmtMonth(t.month)}</div>
    <div style="font-size:11px;color:var(--text-muted)">신청일 ${t.reqDate}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:15px;font-weight:800;color:#4F46E5">
      ${t.status === 'allocated' && t.allocated !== null ? t.allocated : t.requested}매
    </div>
    <span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:6px;
      background:${t.status==='allocated'?'#D1FAE5':'#FEF3C7'};
      color:${t.status==='allocated'?'#059669':'#D97706'}">
      ${t.status === 'allocated' ? '지급 완료' : '검토 중'}
    </span>
  </div>
</div>`).join('')}`;
}

function _handleSubmit(root, uid, curMonth) {
  const countEl = root.querySelector('#mt-count');
  const count   = parseInt(countEl?.value || '0');

  if (!count || count < 1)    { showToast('신청 매수를 입력해 주세요.', 'error'); return; }
  if (count > MAX_TICKETS)    { showToast(`최대 ${MAX_TICKETS}매까지 신청 가능합니다.`, 'warning'); return; }

  const all = _load();
  const existing = all.find(t => t.empId === uid && t.month === curMonth);
  if (existing) { showToast('이번 달 식권은 이미 신청하셨습니다.', 'warning'); return; }

  const newItem = {
    id: 'meal_' + Date.now(),
    empId: uid, empName: _uname(), dept: _udept(),
    month: curMonth, requested: count, allocated: null,
    status: 'pending', reqDate: _today(),
  };
  _save([...all.filter(x => !_demoMealTickets().find(d => d.id === x.id)), newItem]);
  showToast(`${count}매 신청이 완료되었습니다.`, 'success')
    addNotification({ type: 'success', title: '식권 신청', body: '매 신청이 완료되었습니다.' });
  _showForm = false;
  _draw(root);
}
