/**
 * parking.js — 주차권 신청 (직원용)
 * Route: #/parking
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
const TODAY = new Date().toISOString().slice(0,10);

const LS = 'hr_parking_requests';

const PARKING_TYPES = {
  monthly: '월 정기권',
  daily: '일일권',
};

const STATUS_META = {
  pending:  { label: '검토 중', bg: '#FEF3C7', color: '#D97706' },
  approved: { label: '승인',   bg: '#D1FAE5', color: '#059669' },
  rejected: { label: '반려',   bg: '#FEE2E2', color: '#EF4444' },
};

function _demoParking() {
  const uid = _uid(); const name = _uname(); const dept = _udept();
  return [
    { id: `park_${uid}_1`, empId: uid, empName: name, dept, type: 'monthly', carNumber: '12가 3456', startDate: '2026-06-01', endDate: '2026-06-30', status: 'approved', reqDate: '2026-05-28' },
    { id: `park_${uid}_2`, empId: uid, empName: name, dept, type: 'daily', carNumber: '12가 3456', startDate: '2026-05-15', endDate: '2026-05-15', status: 'approved', reqDate: '2026-05-15' },
    { id: `park_${uid}_3`, empId: uid, empName: name, dept, type: 'daily', carNumber: '12가 3456', startDate: '2026-04-20', endDate: '2026-04-20', status: 'rejected', reqDate: '2026-04-19' },
  ];
}

function _load() {
  const demo = _demoParking();
  try {
    const saved = JSON.parse(localStorage.getItem(LS) || '[]');
    return [...demo.filter(d => !saved.find(x => x.id === d.id)), ...saved];
  } catch { return [...demo]; }
}
function _save(list) { localStorage.setItem(LS, JSON.stringify(list)); }
function _uid()  { try { return JSON.parse(localStorage.getItem('hr_session') || '{}').empId  || 'EMP001'; } catch { return 'EMP001'; } }
function _uname(){ try { return JSON.parse(localStorage.getItem('hr_session') || '{}').name   || '사용자'; } catch { return '사용자'; } }
function _udept(){ try { return JSON.parse(localStorage.getItem('hr_session') || '{}').dept   || '소속 미지정'; } catch { return '소속 미지정'; } }
function _today(){ return new Date().toISOString().slice(0, 10); }

let _tab = 'apply';
let _selType = 'monthly';

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
  _selType = 'monthly';
  _draw(root);
}

export function unmount() { _tab = 'apply'; _selType = 'monthly'; }

function _draw(root) {
  const uid  = _uid();
  const mine = _load().filter(p => p.empId === uid).sort((a, b) => b.reqDate.localeCompare(a.reqDate));

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="pk-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🅿️ 주차권 신청</div>
      <div style="font-size:11px;color:var(--text-muted)">신청 내역 ${mine.length}건</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['apply','신청하기'],['history','신청 내역']].map(([k,l]) => `
    <button class="pk-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab === 'apply' ? _renderApply() : _renderHistory(mine)}
  </div>
</div>`;

  root.querySelector('#pk-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.pk-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(root); }));

  if (_tab === 'apply') {
    root.querySelectorAll('.pk-type-btn').forEach(btn => {
      btn.addEventListener('click', () => { _selType = btn.dataset.type; _draw(root); });
    });
    root.querySelector('#pk-submit-btn')?.addEventListener('click', () => _handleSubmit(root, uid));
  }
}

function _renderApply() {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="margin-bottom:14px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:6px">주차권 유형 <span style="color:#EF4444">*</span></label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${Object.entries(PARKING_TYPES).map(([k,v]) => `
      <button class="pk-type-btn" data-type="${k}"
        style="padding:12px;border:2px solid ${_selType===k?'#4F46E5':'var(--border)'};
               border-radius:10px;background:${_selType===k?'#EEF2FF':'var(--bg)'};
               color:${_selType===k?'#4F46E5':'var(--text)'};font-size:13px;font-weight:600;cursor:pointer">
        ${k === 'monthly' ? '📅' : '📆'} ${v}
      </button>`).join('')}
    </div>
  </div>

  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">차량 번호 <span style="color:#EF4444">*</span></label>
    <input id="pk-car" type="text" placeholder="예: 12가 3456"
      style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);
             border-radius:10px;font-size:14px;font-weight:700;text-align:center;background:var(--bg);color:var(--text)">
  </div>

  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">${_selType === 'monthly' ? '시작일' : '이용일'} <span style="color:#EF4444">*</span></label>
    <input id="pk-start" type="date" value="${_today()}"
      style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);
             border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)" min="${TODAY}">
  </div>

  ${_selType === 'monthly' ? `
  <div style="margin-bottom:16px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">종료일 <span style="color:#EF4444">*</span></label>
    <input id="pk-end" type="date" value="${_today()}"
      style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);
             border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)" min="${TODAY}">
  </div>` : '<div id="pk-end-placeholder"></div>'}

  <button id="pk-submit-btn"
    style="width:100%;background:#4F46E5;color:#fff;border:none;border-radius:12px;
           padding:13px;font-size:14px;font-weight:700;cursor:pointer">신청하기</button>
</div>`;
}

function _renderHistory(mine) {
  if (!mine.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:48px;margin-bottom:12px">🅿️</div>
  <div style="font-size:15px;font-weight:600;margin-bottom:6px">신청 내역이 없어요</div>
  <div style="font-size:13px">주차권을 신청하면 여기에 표시됩니다.</div>
</div>`;

  return mine.map(p => {
    const s = STATUS_META[p.status] || STATUS_META.pending;
    const typeLabel = PARKING_TYPES[p.type] || p.type;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div>
      <div style="font-size:13px;font-weight:700;color:var(--text)">${p.carNumber}</div>
      <div style="font-size:11px;color:var(--text-muted)">${typeLabel}</div>
    </div>
    <span style="padding:4px 10px;border-radius:8px;font-size:11px;font-weight:600;
      background:${s.bg};color:${s.color}">${s.label}</span>
  </div>
  <div style="font-size:11px;color:var(--text-muted)">
    ${p.type === 'monthly' ? `${p.startDate} ~ ${p.endDate}` : p.startDate}
    <span style="color:var(--text-muted);margin-left:8px">신청일 ${p.reqDate}</span>
  </div>
</div>`;
  }).join('');
}

function _handleSubmit(root, uid) {
  const carNumber = root.querySelector('#pk-car')?.value.trim();
  const startDate = root.querySelector('#pk-start')?.value;
  const endDate   = _selType === 'monthly' ? root.querySelector('#pk-end')?.value : startDate;

  if (!carNumber)  { showToast('차량 번호를 입력해 주세요.', 'error'); return; }
  if (!startDate)  { showToast('날짜를 선택해 주세요.', 'error'); return; }
  if (_selType === 'monthly' && !endDate) { showToast('종료일을 선택해 주세요.', 'error'); return; }
  if (_selType === 'monthly' && endDate < startDate) { showToast('종료일이 시작일보다 앞설 수 없습니다.', 'error'); return; }

  const all = _load();
  const newItem = {
    id: 'park_' + Date.now(),
    empId: uid, empName: _uname(), dept: _udept(),
    type: _selType, carNumber, startDate, endDate,
    status: 'pending', reqDate: _today(),
  };
  _save([...all.filter(x => !_demoParking().find(d => d.id === x.id)), newItem]);
  showToast('주차권 신청이 완료되었습니다.', 'success')
    addNotification({ type: 'success', title: '주차 신청', body: '주차권 신청이 완료되었습니다.' });
  _tab = 'history';
  _draw(root);
}
