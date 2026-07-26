/**
 * points-admin.js — 포인트 관리 (관리자)
 */

import { showToast } from '../../components/toast.js'
import { addNotification } from '../../components/notification-hub.js';

const LS_HISTORY = 'hr_points_history';
const LS_BALANCE = 'hr_points_balance';

const LEGACY_EMP_IDS = new Set(['EMP001','EMP002','EMP003','EMP004','EMP005']);

function _loadBalances() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_BALANCE) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_EMP_IDS.has(r.empId));
    if (cleaned.length !== list.length) _saveBalances(cleaned);
    return cleaned;
  } catch { return []; }
}
function _saveBalances(list) { localStorage.setItem(LS_BALANCE, JSON.stringify(list)); }

function _loadHistory() {
  try { return JSON.parse(localStorage.getItem(LS_HISTORY)||'[]'); }
  catch { return []; }
}
function _saveHistory(list) { localStorage.setItem(LS_HISTORY, JSON.stringify(list)); }

let _tab = 'status';
let _root = null;

export function render(root) { _root = root; _tab = 'status'; _draw(); }
export function unmount() { _root = null;
  _tab = 'status';
}

function _draw() {
  const balances = _loadBalances().sort((a,b) => b.balance - a.balance);
  const total    = balances.reduce((sum, b) => sum + b.balance, 0);
  const avg      = balances.length > 0 ? Math.round(total / balances.length) : 0;

  const tabs = [
    { key:'status', label:'포인트 현황' },
    { key:'grant',  label:'포인트 지급' },
  ];

  let contentHtml = '';
  if (_tab === 'status') {
    contentHtml = balances.length === 0
      ? `<div style="text-align:center;padding:48px 0;color:#94A3B8">
           <div style="font-size:36px;margin-bottom:8px">&#128176;</div>
           <div style="font-size:13px">직원 데이터가 없습니다.</div>
         </div>`
      : balances.map((b, i) => `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px">
  <div style="font-size:18px;font-weight:800;color:${i===0?'#F59E0B':i===1?'#94A3B8':i===2?'#CD7C2F':'#CBD5E1'};min-width:28px;text-align:center">${i+1}</div>
  <div style="flex:1">
    <div style="font-size:14px;font-weight:700;color:var(--text)">${b.empName}</div>
    <div style="font-size:11px;color:#64748B">${b.dept}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:15px;font-weight:700;color:#4F46E5">${b.balance.toLocaleString()}P</div>
  </div>
</div>`).join('');
  } else {
    const options = balances.map(b => `<option value="${b.empId}">${b.empName} (${b.dept}) — ${b.balance.toLocaleString()}P</option>`).join('');
    contentHtml = `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="display:grid;gap:12px">
    <div>
      <label style="display:block;font-size:12px;font-weight:600;color:#64748B;margin-bottom:4px">직원 선택</label>
      <select id="pt-emp" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--card-bg);color:var(--text)">
        <option value="">직원을 선택하세요</option>
        ${options}
      </select>
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;color:#64748B;margin-bottom:4px">지급 포인트</label>
      <input id="pt-amount" type="number" min="100" step="100" placeholder="예: 10000"
        style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;color:#64748B;margin-bottom:4px">지급 사유</label>
      <input id="pt-reason" type="text" placeholder="예: 우수 성과 보상"
        style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
    <button id="pt-grant" style="padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">포인트 지급</button>
  </div>
</div>`;
  }

  _root.innerHTML = `
<div style="padding:16px;max-width:600px;margin:0 auto">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button id="pt-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text)">&#8592;</button>
    <h2 style="margin:0;font-size:17px;font-weight:700;color:var(--text)">포인트 관리</h2>
  </div>

  <!-- Stats -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
    ${[
      { label:'총 지급 포인트', val:total.toLocaleString()+'P', color:'#4F46E5' },
      { label:'평균 잔액',      val:avg.toLocaleString()+'P',   color:'#10B981' },
      { label:'직원 수',         val:balances.length+'명',      color:'#64748B' },
    ].map(s=>`
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;text-align:center">
      <div style="font-size:16px;font-weight:700;color:${s.color}">${s.val}</div>
      <div style="font-size:11px;color:#64748B;margin-top:2px">${s.label}</div>
    </div>`).join('')}
  </div>

  <!-- Tabs -->
  <div style="display:flex;gap:6px;margin-bottom:14px">
    ${tabs.map(t=>`
    <button class="pt-tab" data-tab="${t.key}" style="
      padding:7px 14px;font-size:12px;font-weight:600;border-radius:20px;cursor:pointer;
      border:1.5px solid ${_tab===t.key?'#4F46E5':'var(--border)'};
      background:${_tab===t.key?'#EEF2FF':'var(--card-bg)'};
      color:${_tab===t.key?'#4F46E5':'#64748B'}">${t.label}</button>`).join('')}
  </div>

  <!-- Content -->
  <div id="pt-content">${contentHtml}</div>
</div>`;

  _bindEvents();
}

function _bindEvents() {
  _root.querySelector('#pt-back')?.addEventListener('click', () => window.navBack());

  _root.querySelectorAll('.pt-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.tab; _draw(); });
  });

  _root.querySelector('#pt-grant')?.addEventListener('click', () => {
    const empId  = _root.querySelector('#pt-emp')?.value;
    const amount = parseInt(_root.querySelector('#pt-amount')?.value);
    const reason = _root.querySelector('#pt-reason')?.value.trim();
    if (!empId)     { showToast('직원을 선택해 주세요.'); return; }
    if (!amount || amount <= 0) { showToast('올바른 포인트를 입력해 주세요.'); return; }
    if (!reason)    { showToast('지급 사유를 입력해 주세요.'); return; }

    const balances = _loadBalances();
    const idx = balances.findIndex(b => b.empId === empId);
    if (idx < 0) return;
    balances[idx].balance += amount;
    _saveBalances(balances);

    const history = _loadHistory();
    history.push({
      id: 'PT' + Date.now(),
      empId,
      empName: balances[idx].empName,
      type: 'grant',
      amount,
      reason,
      date: new Date().toISOString().slice(0, 10),
    });
    _saveHistory(history);

    showToast(`${balances[idx].empName}에게 ${amount.toLocaleString()}P 지급되었습니다.`);
    addNotification({ type: "success", title: "포인트 관리", body: `${balances[idx].empName}에게 ${amount.toLocaleString()}P 지급되었습니다.` });
    _tab = 'status';
    _draw();
  });
}
export function mount(root) { return render(root); }
