/**
 * childcare.js — 육아 지원 신청
 * Route: #/childcare
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS_KEY = 'hr_childcare';

const CARE_TYPES = {
  daycare:     '어린이집 지원',
  babysitter:  '아이돌봄 서비스',
  emergency:   '긴급 돌봄',
  after_school: '방과후 돌봄',
};

const CARE_ICONS = { daycare: '🏫', babysitter: '👶', emergency: '🆘', after_school: '📚' };

const STATUS_META = {
  pending:  { label: '검토 중', bg: '#FEF3C7', color: '#D97706' },
  approved: { label: '승인',    bg: '#D1FAE5', color: '#059669' },
  rejected: { label: '반려',    bg: '#FEE2E2', color: '#EF4444' },
};

function _load() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } }
function _save(d) { localStorage.setItem(LS_KEY, JSON.stringify(d)); }
function _id() { return 'cc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5); }
function _today() { return new Date().toISOString().slice(0, 10); }
function _session() { try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; } }
function _uid()   { return _session().empId || _session().userId || 'EMP001'; }
function _uname() { return _session().name || '직원'; }
function _udept() { return _session().dept || _session().department || '일반'; }

function _demoChildcare() {
  const uid = _uid(); const name = _uname(); const dept = _udept();
  return [
    { id: `cc_${uid}_1`, empId: uid, empName: name, dept, type: 'daycare', childName: '자녀 1', childAge: 3, startDate: '2026-07-01', monthlyFee: 450000, status: 'approved', reqDate: '2026-05-10' },
    { id: `cc_${uid}_2`, empId: uid, empName: name, dept, type: 'after_school', childName: '자녀 2', childAge: 8, startDate: '2026-06-01', monthlyFee: 300000, status: 'pending', reqDate: '2026-06-01' },
  ];
}

function _merged() {
  const demo = _demoChildcare();
  const saved = _load();
  return [...demo.filter(d => !saved.find(x => x.id === d.id)), ...saved];
}

let _tab = 'apply';
let _form = {};

function _blankForm() {
  return { type: 'daycare', childName: '', childAge: '', startDate: _today(), monthlyFee: '' };
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
  const session = _session();
  const empId = _uid();
  const all = _merged().filter(r => r.empId === empId);

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="cc-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700;color:var(--text)">👶 육아 지원 신청</div>
      <div style="font-size:11px;color:var(--text-muted)">총 ${all.length}건 · 검토 중 ${all.filter(r => r.status === 'pending').length}건</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['apply', '신청하기'], ['history', '신청 내역']].map(([k, l]) => `
    <button class="cc-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab === k ? '#4F46E5' : 'transparent'};
             color:${_tab === k ? '#4F46E5' : 'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">
    ${_tab === 'apply' ? _renderForm() : _renderHistory(all)}
  </div>
</div>`;

  root.querySelector('#cc-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.cc-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _render(root); }));
  if (_tab === 'apply') _bindForm(root, empId, session);
}

function _renderForm() {
  return `
<div style="max-width:480px;margin:0 auto">
  <div style="margin-bottom:14px">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;font-weight:600">지원 유형 <span style="color:#EF4444">*</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${Object.entries(CARE_TYPES).map(([k, v]) => `
      <button class="cc-type" data-key="${k}"
        style="padding:14px 8px;border:2px solid ${_form.type === k ? '#4F46E5' : 'var(--border)'};
               border-radius:12px;background:${_form.type === k ? '#EEF2FF' : 'var(--card-bg)'};cursor:pointer;text-align:center">
        <div style="font-size:24px;margin-bottom:4px">${CARE_ICONS[k]}</div>
        <div style="font-size:12px;color:${_form.type === k ? '#4F46E5' : 'var(--text)'};font-weight:600">${v}</div>
      </button>`).join('')}
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">자녀 이름 <span style="color:#EF4444">*</span></div>
      <input id="cc-child-name" type="text" placeholder="자녀 이름" value="${_form.childName}"
        style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">나이 <span style="color:#EF4444">*</span></div>
      <input id="cc-child-age" type="number" min="0" max="18" placeholder="만 나이" value="${_form.childAge}"
        style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">희망 시작일 <span style="color:#EF4444">*</span></div>
      <input id="cc-start" type="date" value="${_form.startDate}"
        style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">월 비용 (원) <span style="color:#EF4444">*</span></div>
      <input id="cc-fee" type="number" min="0" placeholder="월 비용" value="${_form.monthlyFee}"
        style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
  </div>

  <button id="cc-submit"
    style="width:100%;padding:13px;border:none;border-radius:12px;background:#4F46E5;color:#fff;font-size:14px;font-weight:700;cursor:pointer">
    신청하기
  </button>
</div>`;
}

function _renderHistory(all) {
  if (!all.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">👶</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:6px">신청 내역이 없습니다</div>
      <button onclick="document.querySelector('[data-tab=apply]')?.click()" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">신청하기</button>
    
  <div style="font-size:12px">육아 지원을 신청해 보세요</div>
</div>`;

  return `<div style="max-width:480px;margin:0 auto">${all.slice().reverse().map(r => {
    const meta = STATUS_META[r.status] || STATUS_META.pending;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:24px">${CARE_ICONS[r.type] || '👶'}</span>
      <div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">${CARE_TYPES[r.type] || r.type}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">자녀: ${r.childName} (만 ${r.childAge}세)</div>
      </div>
    </div>
    <span style="padding:3px 9px;border-radius:6px;font-size:11px;font-weight:600;background:${meta.bg};color:${meta.color};white-space:nowrap">${meta.label}</span>
  </div>
  <div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:6px;border-top:1px solid var(--border)">
    <span style="padding:2px 8px;background:#F1F5F9;border-radius:5px;font-size:11px;color:var(--text-muted)">시작 ${r.startDate}</span>
    <span style="padding:2px 8px;background:#F1F5F9;border-radius:5px;font-size:11px;color:#4F46E5;font-weight:600">${(r.monthlyFee || 0).toLocaleString()}원/월</span>
  </div>
</div>`;
  }).join('')}</div>`;
}

function _bindForm(root, empId, session) {
  root.querySelectorAll('.cc-type').forEach(btn => {
    btn.addEventListener('click', () => { _form.type = btn.dataset.key; _render(root); });
  });

  root.querySelector('#cc-submit')?.addEventListener('click', () => {
    _form.childName = root.querySelector('#cc-child-name')?.value.trim() || '';
    _form.childAge = parseInt(root.querySelector('#cc-child-age')?.value) || '';
    _form.startDate = root.querySelector('#cc-start')?.value || _today();
    _form.monthlyFee = parseInt(root.querySelector('#cc-fee')?.value) || '';

    if (!_form.childName) { showToast('자녀 이름을 입력해 주세요.', 'error'); return; }
    if (_form.childAge === '' || _form.childAge < 0) { showToast('자녀 나이를 올바르게 입력해 주세요.', 'error'); return; }
    if (!_form.monthlyFee) { showToast('월 비용을 입력해 주세요.', 'error'); return; }

    const saved = _load();
    saved.push({
      id: _id(),
      empId,
      empName: session.name || '직원',
      dept: session.department || '미지정',
      type: _form.type,
      childName: _form.childName,
      childAge: _form.childAge,
      startDate: _form.startDate,
      monthlyFee: _form.monthlyFee,
      status: 'pending',
      reqDate: _today(),
    });
    _save(saved);
    showToast('육아 지원 신청이 완료되었습니다.', 'success')
    addNotification({ type: 'success', title: '육아 지원', body: '육아 지원 신청이 완료되었습니다.' });
    _form = _blankForm();
    _tab = 'history';
    _render(root);
  });
}
