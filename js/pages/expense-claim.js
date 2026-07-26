/**
 * expense-claim.js — 경비 정산 신청
 */

import {getUser, isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js'
import { addNotification } from '../components/notification-hub.js';

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId() {
  const s = _session();
  return s.empId || s.userId || getUser()?.id || 'EMP001';
}

const LS = 'hr_expense_claims';

const CATEGORIES = [
  { key: 'transport',    label: '교통비',    icon: '🚌' },
  { key: 'meal',         label: '식대',      icon: '🍽️' },
  { key: 'accommodation',label: '숙박비',    icon: '🏨' },
  { key: 'office',       label: '사무용품',  icon: '🖊️' },
  { key: 'entertainment',label: '접대비',    icon: '🥂' },
  { key: 'training',     label: '교육비',    icon: '📚' },
  { key: 'communication',label: '통신비',    icon: '📱' },
  { key: 'other',        label: '기타',      icon: '📦' },
];

const STATUS_META = {
  draft:    { label: '임시 저장', bg: '#F1F5F9', color: 'var(--text-muted)' },
  submitted:{ label: '검토 중',  bg: '#FEF3C7', color: '#D97706' },
  approved: { label: '승인',     bg: '#D1FAE5', color: '#059669' },
  rejected: { label: '반려',     bg: '#FEE2E2', color: '#EF4444' },
  paid:     { label: '지급 완료',bg: '#EDE9FE', color: '#7C3AED' },
};

function _load() { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } }
function _save(d) { localStorage.setItem(LS, JSON.stringify(d)); }
function _id()   { return 'exp_' + Date.now() + '_' + Math.random().toString(36).slice(2,6); }

let _tab = 'form';
let _form = { category: 'meal', date: new Date().toISOString().slice(0,10), amount: '', purpose: '', note: '', items: [] };

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'form';
  _form = { category: 'meal', date: new Date().toISOString().slice(0,10), amount: '', purpose: '', note: '', items: [] };
  _draw(root);
}
export function unmount() { _tab = 'form';}

function _draw(root) {
  const user = getUser();
  const userId = _empId();
  const all = _load().filter(e => e.userId === userId);
  const totalPending = all.filter(e => e.status === 'submitted').reduce((s,e) => s + (e.totalAmount||0), 0);

  root.innerHTML = `
<div class="page-content" style="padding:16px;max-width:480px;margin:0 auto">
  <!-- 헤더 -->
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button onclick="window.navBack()" style="background:none;border:none;font-size:20px;cursor:pointer;padding:0">←</button>
    <div>
      <div style="font-size:17px;font-weight:800;color:var(--text)">경비 정산</div>
      <div style="font-size:11px;color:var(--text-muted)">검토 중 ${totalPending.toLocaleString()}원</div>
    </div>
  </div>

  <!-- 탭 -->
  <div style="display:flex;background:#F1F5F9;border-radius:10px;padding:3px;margin-bottom:16px">
    ${[{k:'form',l:'신청'},{k:'history',l:'내역'}].map(t=>`
      <button class="ec-tab" data-t="${t.k}"
        style="flex:1;padding:8px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;
               background:${_tab===t.k?'#fff':'transparent'};color:${_tab===t.k?'#4F46E5':'var(--text-muted)'};
               box-shadow:${_tab===t.k?'0 1px 4px rgba(0,0,0,0.1)':'none'}">
        ${t.l}
      </button>`).join('')}
  </div>

  ${_tab === 'form'    ? _renderForm()        : ''}
  ${_tab === 'history' ? _renderHistory(all)  : ''}
</div>`;

  root.querySelectorAll('.ec-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _draw(root); });
  });

  if (_tab === 'form') _bindForm(root);
}

function _renderForm() {
  return `
<!-- 카테고리 -->
<div style="margin-bottom:14px">
  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">카테고리</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">
    ${CATEGORIES.map(c=>`
      <button class="ec-cat" data-key="${c.key}"
        style="padding:8px 4px;border:2px solid ${_form.category===c.key?'#4F46E5':'var(--border)'};
               border-radius:10px;background:${_form.category===c.key?'#EEF2FF':'var(--card-bg)'};
               cursor:pointer;text-align:center">
        <div style="font-size:20px">${c.icon}</div>
        <div style="font-size:10px;color:${_form.category===c.key?'#4F46E5':'var(--text-muted)'};margin-top:2px">${c.label}</div>
      </button>`).join('')}
  </div>
</div>

<!-- 날짜 + 금액 -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
  <div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">지출 날짜</div>
    <input id="ec-date" type="date" value="${_form.date}"
      style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--card-bg);color:var(--text)">
  </div>
  <div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">금액 (원)</div>
    <input id="ec-amount" type="number" min="0" placeholder="0" value="${_form.amount}"
      style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--card-bg);color:var(--text)">
  </div>
</div>

<!-- 목적 -->
<div style="margin-bottom:12px">
  <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">지출 목적 <span style="color:#EF4444">*</span></div>
  <input id="ec-purpose" type="text" placeholder="예: 고객사 미팅 식대" value="${_form.purpose}"
    style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--card-bg);color:var(--text)">
</div>

<!-- 비고 -->
<div style="margin-bottom:16px">
  <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">비고</div>
  <textarea maxlength="500" id="ec-note" rows="2" placeholder="영수증 번호, 추가 설명 등"
    style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--card-bg);color:var(--text);resize:none">${_form.note}</textarea>
</div>

<!-- 합계 미리보기 -->
<div style="background:#EEF2FF;border-radius:10px;padding:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
  <span style="font-size:12px;color:#4F46E5;font-weight:700">신청 금액</span>
  <span style="font-size:20px;font-weight:900;color:#4F46E5">${_form.amount ? parseInt(_form.amount).toLocaleString() : '0'}원</span>
</div>

<!-- 버튼 -->
<div style="display:flex;gap:8px">
  <button id="ec-draft" style="flex:1;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--card-bg);color:var(--text-muted);font-size:13px;font-weight:600;cursor:pointer">임시 저장</button>
  <button id="ec-submit" style="flex:2;padding:12px;border:none;border-radius:10px;background:#4F46E5;color:#fff;font-size:13px;font-weight:700;cursor:pointer">제출하기</button>
</div>`;
}

function _renderHistory(all) {
  if (!all.length) return `
<div style="text-align:center;padding:40px 16px;color:var(--text-muted)">
  <div style="font-size:32px;margin-bottom:8px">🧾</div>
  <div style="font-size:13px;font-weight:600;margin-bottom:4px">신청 내역이 없습니다</div>
  <div style="font-size:12px;margin-bottom:14px">신청 탭에서 경비를 등록해 보세요.</div>
  <button onclick="document.querySelector('[data-t=form]')?.click()" style="padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">경비 신청</button>
</div>`;

  const monthly = {};
  all.forEach(e => {
    const m = (e.date || '').slice(0,7);
    if (!monthly[m]) monthly[m] = [];
    monthly[m].push(e);
  });

  return Object.entries(monthly).sort((a,b) => b[0].localeCompare(a[0])).map(([month, items]) => {
    const total = items.reduce((s,e) => s + (e.totalAmount||0), 0);
    return `
<div style="margin-bottom:14px">
  <div style="display:flex;justify-content:space-between;margin-bottom:6px">
    <span style="font-size:12px;font-weight:700;color:var(--text)">${month.replace('-','년 ')}월</span>
    <span style="font-size:12px;color:#4F46E5;font-weight:700">${total.toLocaleString()}원</span>
  </div>
  ${items.map(e => {
    const cat = CATEGORIES.find(c => c.key === e.category) || { icon:'📦', label:'기타' };
    const meta = STATUS_META[e.status] || STATUS_META.submitted;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:6px;display:flex;align-items:center;gap:12px">
  <span style="font-size:24px">${cat.icon}</span>
  <div style="flex:1">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:13px;font-weight:700;color:var(--text)">${e.purpose || cat.label}</span>
      <span style="font-size:13px;font-weight:700;color:var(--text)">${(e.totalAmount||0).toLocaleString()}원</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:3px">
      <span style="font-size:11px;color:var(--text-muted)">${e.date || ''} · ${cat.label}</span>
      <span style="padding:2px 7px;border-radius:5px;font-size:11px;font-weight:600;background:${meta.bg};color:${meta.color}">${meta.label}</span>
    </div>
    ${e.adminComment ? `<div style="font-size:11px;color:#EF4444;margin-top:4px">💬 ${e.adminComment}</div>` : ''}
  </div>
</div>`;
  }).join('')}
</div>`;
  }).join('');
}

function _bindForm(root) {
  root.querySelectorAll('.ec-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      _form.category = btn.dataset.key;
      _draw(root);
    });
  });

  const dateEl   = root.querySelector('#ec-date');
  const amountEl = root.querySelector('#ec-amount');
  const purposeEl= root.querySelector('#ec-purpose');
  const noteEl   = root.querySelector('#ec-note');

  const sync = () => {
    _form.date    = dateEl?.value    || _form.date;
    _form.amount  = amountEl?.value  || _form.amount;
    _form.purpose = purposeEl?.value || _form.purpose;
    _form.note    = noteEl?.value    || _form.note;
  };

  [dateEl, amountEl, purposeEl, noteEl].forEach(el => {
    el?.addEventListener('input', () => {
      _form.date    = dateEl?.value    || '';
      _form.amount  = amountEl?.value  || '';
      _form.purpose = purposeEl?.value || '';
      _form.note    = noteEl?.value    || '';
    });
  });

  const draftBtn  = root.querySelector('#ec-draft');
  const submitBtn = root.querySelector('#ec-submit');

  draftBtn?.addEventListener('click', () => {
    sync();
    _saveEntry('draft', root);
  });
  submitBtn?.addEventListener('click', () => {
    sync();
    if (!_form.purpose.trim()) { showToast('지출 목적을 입력해 주세요.', 'error'); return; }
    if (!_form.amount || parseInt(_form.amount) <= 0) { showToast('금액을 입력해 주세요.', 'error'); return; }
    _saveEntry('submitted', root);
  });
}

function _saveEntry(status, root) {
  const user = getUser();
  const userId = user?.id || user?.employee_id || 'demo';
  const all = _load();
  all.push({
    id:          _id(),
    userId,
    category:    _form.category,
    date:        _form.date,
    totalAmount: parseInt(_form.amount) || 0,
    purpose:     _form.purpose,
    note:        _form.note,
    status,
    createdAt:   new Date().toISOString(),
  });
  _save(all);
  const msg = status === 'draft' ? '임시 저장되었습니다.' : '경비 신청이 제출되었습니다.';
  showToast(msg);
  addNotification({ type: 'success', title: '경비 신청', body: msg });
  _form = { category: 'meal', date: new Date().toISOString().slice(0,10), amount: '', purpose: '', note: '' };
  _tab = 'history';
  _draw(root);
}
