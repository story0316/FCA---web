/**
 * expense.js — 경비 신청 (직원용)
 * Route: #/expense
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_expenses';

const EXPENSE_TYPES = {
  transport: '교통비',
  meal: '식대',
  accommodation: '숙박비',
  supplies: '소모품',
  education: '교육비',
  etc: '기타',
};

const TYPE_ICON = {
  transport: '🚌', meal: '🍽️', accommodation: '🏨',
  supplies: '🖊️', education: '📚', etc: '📦',
};

const STATUS_META = {
  pending:  { label: '검토 중', bg: '#FEF3C7', color: '#D97706' },
  approved: { label: '승인',   bg: '#D1FAE5', color: '#059669' },
  rejected: { label: '반려',   bg: '#FEE2E2', color: '#EF4444' },
};

function _demoExpenses() {
  const uid = _uid(); const name = _uname(); const dept = _udept();
  return [
    { id: `exp_${uid}_1`, empId: uid, empName: name, dept, type: 'meal', amount: 45000, purpose: '팀 점심 미팅 (5명)', receiptUrl: '', date: '2026-06-03', status: 'approved', reqDate: '2026-06-03' },
    { id: `exp_${uid}_2`, empId: uid, empName: name, dept, type: 'transport', amount: 12500, purpose: '고객사 방문 교통비', receiptUrl: '', date: '2026-06-02', status: 'approved', reqDate: '2026-06-02' },
    { id: `exp_${uid}_3`, empId: uid, empName: name, dept, type: 'education', amount: 150000, purpose: '온라인 강의 수강료', receiptUrl: '', date: '2026-05-28', status: 'pending', reqDate: '2026-05-28' },
  ];
}

function _load() {
  const demo = _demoExpenses();
  try {
    const saved = JSON.parse(localStorage.getItem(LS) || '[]');
  if (!saved || !saved.length) { root.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:40px;margin-bottom:10px">🧾</div><div style="font-size:14px;font-weight:600;margin-bottom:4px">지출 내역이 없습니다.</div><div style="font-size:12px;margin-bottom:14px">경비를 신청하면 여기에 표시됩니다.</div><button onclick="location.hash='#/expense-claim'" style="padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">경비 신청</button></div>`; return; }
    return [...demo.filter(d => !saved.find(x => x.id === d.id)), ...saved];
  } catch { return [...demo]; }
}
function _save(list) { localStorage.setItem(LS, JSON.stringify(list)); }
function _uid()  { try { return JSON.parse(localStorage.getItem('hr_session') || '{}').empId  || 'EMP001'; } catch { return 'EMP001'; } }
function _uname(){ try { return JSON.parse(localStorage.getItem('hr_session') || '{}').name   || '사용자'; } catch { return '사용자'; } }
function _udept(){ try { return JSON.parse(localStorage.getItem('hr_session') || '{}').dept   || '소속 미지정'; } catch { return '소속 미지정'; } }
function _today(){ return new Date().toISOString().slice(0, 10); }

let _tab = 'apply';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'apply';
  _draw(root);
}

export function unmount() { _tab = 'apply'; }

function _draw(root) {
  const uid  = _uid();
  const mine = _load().filter(e => e.empId === uid).sort((a, b) => b.reqDate.localeCompare(a.reqDate));

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="exp-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">💸 경비 신청</div>
      <div style="font-size:11px;color:var(--text-muted)">신청 내역 ${mine.length}건</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['apply','신청하기'],['history','신청 내역']].map(([k,l]) => `
    <button class="exp-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab === 'apply' ? _renderApply() : _renderHistory(mine)}
  </div>
</div>`;

  root.querySelector('#exp-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.exp-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(root); }));

  if (_tab === 'apply') {
    root.querySelector('#exp-submit-btn')?.addEventListener('click', () => _handleSubmit(root, uid));
  }
}

function _renderApply() {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">경비 유형 <span style="color:#EF4444">*</span></label>
    <select id="exp-type"
      style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text)">
      ${Object.entries(EXPENSE_TYPES).map(([k,v]) =>
        `<option value="${k}">${TYPE_ICON[k] || '📦'} ${v}</option>`
      ).join('')}
    </select>
  </div>

  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">금액 (원) <span style="color:#EF4444">*</span></label>
    <input id="exp-amount" type="number" min="0" placeholder="예: 15000" min="0"
      style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);
             border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
  </div>

  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">사용일 <span style="color:#EF4444">*</span></label>
    <input id="exp-date" type="date" value="${_today()}"
      style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);
             border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
  </div>

  <div style="margin-bottom:16px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">사용 목적 <span style="color:#EF4444">*</span></label>
    <textarea maxlength="500" id="exp-purpose" placeholder="예: 팀 점심 식대 (개발팀 5명)"
      style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);
             border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);
             height:80px;resize:vertical"></textarea>
  </div>

  <button id="exp-submit-btn"
    style="width:100%;background:#4F46E5;color:#fff;border:none;border-radius:12px;
           padding:13px;font-size:14px;font-weight:700;cursor:pointer">신청하기</button>
</div>`;
}

function _renderHistory(mine) {
  if (!mine.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:48px;margin-bottom:12px">💸</div>
  <div style="font-size:15px;font-weight:600;margin-bottom:6px">신청 내역이 없어요</div>
  <div style="font-size:13px">경비를 신청하면 여기에 표시됩니다.</div>
</div>`;

  return mine.map(e => {
    const s = STATUS_META[e.status] || STATUS_META.pending;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:22px">${TYPE_ICON[e.type] || '📦'}</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${EXPENSE_TYPES[e.type] || e.type}</div>
        <div style="font-size:11px;color:var(--text-muted)">${e.date} · ${e.purpose}</div>
      </div>
    </div>
    <div style="text-align:right;flex-shrink:0;margin-left:10px">
      <div style="font-size:14px;font-weight:800;color:var(--text)">${(e.amount||0).toLocaleString()}원</div>
      <span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:8px;
        background:${s.bg};color:${s.color}">${s.label}</span>
    </div>
  </div>
</div>`;
  }).join('');
}

function _handleSubmit(root, uid) {
  const type    = root.querySelector('#exp-type')?.value;
  const amount  = parseInt(root.querySelector('#exp-amount')?.value || '0');
  const date    = root.querySelector('#exp-date')?.value;
  const purpose = root.querySelector('#exp-purpose')?.value.trim();

  if (!type)              { showToast('경비 유형을 선택해 주세요.', 'error'); return; }
  if (!amount || amount <= 0) { showToast('금액을 올바르게 입력해 주세요.', 'error'); return; }
  if (!date)              { showToast('사용일을 선택해 주세요.', 'error'); return; }
  if (!purpose)           { showToast('사용 목적을 입력해 주세요.', 'error'); return; }

  const all = _load();
  const newItem = {
    id: 'exp_' + Date.now(),
    empId: uid, empName: _uname(), dept: _udept(),
    type, amount, purpose, receiptUrl: '',
    date, status: 'pending',
    reqDate: _today(),
  };
  _save([...all.filter(x => !_demoExpenses().find(d => d.id === x.id)), newItem]);
  showToast('경비 신청이 완료되었습니다.', 'success')
    addNotification({ type: 'success', title: '비용 청구', body: '경비 신청이 완료되었습니다.' });
  _tab = 'history';
  _draw(root);
}
