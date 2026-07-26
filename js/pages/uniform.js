/**
 * uniform.js — 유니폼/업무복 신청
 * Route: #/uniform
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS_KEY = 'hr_uniform_requests';

const UNIFORM_TYPES = { top: '상의', bottom: '하의', shoes: '신발', jacket: '점퍼·재킷', accessory: '악세서리' };
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const STATUS_META = {
  pending:   { label: '검토 중',  bg: '#FEF3C7', color: '#D97706' },
  approved:  { label: '승인',     bg: '#D1FAE5', color: '#059669' },
  delivered: { label: '지급 완료', bg: '#EDE9FE', color: '#7C3AED' },
};

const TYPE_ICONS = { top: '👕', bottom: '👖', shoes: '👟', jacket: '🧥', accessory: '🧣' };

function _load() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } }
function _save(d) { localStorage.setItem(LS_KEY, JSON.stringify(d)); }
function _id() { return 'uni_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5); }
function _today() { return new Date().toISOString().slice(0, 10); }
function _session() { try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; } }
function _empId()   { return _session().empId || _session().userId || 'EMP001'; }
function _empName() { return _session().name || '직원'; }
function _dept()    { return _session().dept || _session().department || '일반'; }

function _demoUniforms() {
  const uid = _empId(); const name = _empName(); const dept = _dept();
  return [
    { id: `uni_${uid}_1`, empId: uid, empName: name, dept, type: 'top',    size: 'M', quantity: 2, reason: '기존 상의 마모로 교체 신청', status: 'delivered', reqDate: '2026-03-10' },
    { id: `uni_${uid}_2`, empId: uid, empName: name, dept, type: 'jacket', size: 'M', quantity: 1, reason: '신규 입사 지급 요청',         status: 'approved',  reqDate: '2026-04-15' },
  ];
}

function _merged() {
  const demo = _demoUniforms();
  const saved = _load();
  return [...demo.filter(d => !saved.find(x => x.id === d.id)), ...saved];
}

let _tab = 'apply';
let _form = {};

function _blankForm() {
  return { type: 'top', size: 'M', quantity: 1, reason: '' };
}

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
  _form = _blankForm();
  _render(root);
}

export function unmount() { _tab = 'apply';}

function _render(root) {
  const empId = _empId();
  const all = _merged().filter(r => r.empId === empId);

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="uni-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700;color:var(--text)">👕 유니폼 신청</div>
      <div style="font-size:11px;color:var(--text-muted)">총 ${all.length}건 · 검토 중 ${all.filter(r => r.status === 'pending').length}건</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['apply', '신청하기'], ['history', '신청 내역']].map(([k, l]) => `
    <button class="uni-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab === k ? '#4F46E5' : 'transparent'};
             color:${_tab === k ? '#4F46E5' : 'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">
    ${_tab === 'apply' ? _renderForm() : _renderHistory(all)}
  </div>
</div>`;

  root.querySelector('#uni-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.uni-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _render(root); }));
  if (_tab === 'apply') _bindForm(root, empId, session);
}

function _renderForm() {
  return `
<div style="max-width:480px;margin:0 auto">
  <div style="margin-bottom:14px">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">유니폼 구분 <span style="color:#EF4444">*</span></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
      ${Object.entries(UNIFORM_TYPES).map(([k, v]) => `
      <button class="uni-type" data-key="${k}"
        style="padding:12px 6px;border:2px solid ${_form.type === k ? '#4F46E5' : 'var(--border)'};
               border-radius:10px;background:${_form.type === k ? '#EEF2FF' : 'var(--card-bg)'};cursor:pointer">
        <div style="font-size:22px;margin-bottom:2px">${TYPE_ICONS[k]}</div>
        <div style="font-size:11px;color:${_form.type === k ? '#4F46E5' : 'var(--text-muted)'};font-weight:600">${v}</div>
      </button>`).join('')}
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">사이즈 <span style="color:#EF4444">*</span></div>
      <select id="uni-size"
        style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text)">
        ${SIZES.map(s => `<option value="${s}" ${_form.size === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">수량 <span style="color:#EF4444">*</span></div>
      <input id="uni-qty" type="number" min="1" max="5" value="${_form.quantity}"
        style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
  </div>

  <div style="margin-bottom:16px">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">신청 사유 <span style="color:#EF4444">*</span></div>
    <textarea maxlength="500" id="uni-reason" rows="3" placeholder="신청 사유를 입력해 주세요 (예: 기존 유니폼 마모, 신규 배정)"
      style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text);resize:none">${_form.reason}</textarea>
  </div>

  <button id="uni-submit"
    style="width:100%;padding:13px;border:none;border-radius:12px;background:#4F46E5;color:#fff;font-size:14px;font-weight:700;cursor:pointer">
    신청하기
  </button>
</div>`;
}

function _renderHistory(all) {
  if (!all.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">👕</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:6px">신청 내역이 없습니다</div>
      <button onclick="document.querySelector('[data-tab=apply]')?.click()" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">유니폼 신청</button>
    
  <div style="font-size:12px">유니폼을 신청해 보세요</div>
</div>`;

  return `<div style="max-width:480px;margin:0 auto">${all.slice().reverse().map(r => {
    const meta = STATUS_META[r.status] || STATUS_META.pending;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:24px">${TYPE_ICONS[r.type] || '👕'}</span>
      <div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">${UNIFORM_TYPES[r.type] || r.type} · ${r.size} · ${r.quantity}개</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:1px">신청일 ${r.reqDate}</div>
      </div>
    </div>
    <span style="padding:3px 9px;border-radius:6px;font-size:11px;font-weight:600;background:${meta.bg};color:${meta.color};white-space:nowrap">${meta.label}</span>
  </div>
  ${r.reason ? `<div style="font-size:11px;color:var(--text-muted);padding-top:6px;border-top:1px solid var(--border)">${r.reason}</div>` : ''}
</div>`;
  }).join('')}</div>`;
}

function _bindForm(root, empId, session) {
  root.querySelectorAll('.uni-type').forEach(btn => {
    btn.addEventListener('click', () => { _form.type = btn.dataset.key; _render(root); });
  });

  root.querySelector('#uni-submit')?.addEventListener('click', () => {
    _form.size = root.querySelector('#uni-size')?.value || 'M';
    _form.quantity = parseInt(root.querySelector('#uni-qty')?.value) || 1;
    _form.reason = root.querySelector('#uni-reason')?.value.trim() || '';

    if (_form.quantity < 1 || _form.quantity > 5) { showToast('수량은 1~5개 사이로 입력해 주세요.', 'error'); return; }
    if (!_form.reason) { showToast('신청 사유를 입력해 주세요.', 'error'); return; }

    const saved = _load();
    saved.push({
      id: _id(),
      empId,
      empName: session.name || '직원',
      dept: session.department || '미지정',
      type: _form.type,
      size: _form.size,
      quantity: _form.quantity,
      reason: _form.reason,
      status: 'pending',
      reqDate: _today(),
    });
    _save(saved);
    showToast('유니폼 신청이 완료되었습니다.', 'success')
    addNotification({ type: 'success', title: '유니폼 신청', body: '유니폼 신청이 완료되었습니다.' });
    _form = _blankForm();
    _tab = 'history';
    _render(root);
  });
}
