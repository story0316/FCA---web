/**
 * relocation.js — 이사 비용 지원 신청
 * Route: #/relocation
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS_KEY = 'hr_relocation_requests';

const MOVE_REASONS = { job_change: '발령·직무변경', company_required: '회사 요청', etc: '기타' };
const REASON_ICONS = { job_change: '🔄', company_required: '🏢', etc: '📦' };

const STATUS_META = {
  pending:  { label: '검토 중', bg: '#FEF3C7', color: '#D97706' },
  approved: { label: '승인',    bg: '#D1FAE5', color: '#059669' },
  rejected: { label: '반려',    bg: '#FEE2E2', color: '#EF4444' },
};

function _load() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } }
function _save(d) { localStorage.setItem(LS_KEY, JSON.stringify(d)); }
function _id() { return 'rel_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5); }
function _today() { return new Date().toISOString().slice(0, 10); }
function _session() { try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; } }
function _uid()   { return _session().empId || _session().userId || 'EMP001'; }
function _uname() { return _session().name || '직원'; }
function _udept() { return _session().dept || _session().department || '일반'; }

function _demoRelocation() {
  const uid = _uid(); const name = _uname(); const dept = _udept();
  return [
    { id: `rel_${uid}_1`, empId: uid, empName: name, dept, reason: 'job_change', fromAddr: '서울시 마포구 합정동', toAddr: '경기도 성남시 분당구', moveDate: '2026-07-01', estimatedCost: 800000, status: 'approved', reqDate: '2026-05-15' },
  ];
}

function _merged() {
  const demo = _demoRelocation();
  const saved = _load();
  return [...demo.filter(d => !saved.find(x => x.id === d.id)), ...saved];
}

let _tab = 'apply';
let _form = {};

function _blankForm() {
  return { reason: 'job_change', fromAddr: '', toAddr: '', moveDate: '', estimatedCost: '' };
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
    <button id="rel-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700;color:var(--text)">📦 이사 비용 지원</div>
      <div style="font-size:11px;color:var(--text-muted)">총 ${all.length}건 · 검토 중 ${all.filter(r => r.status === 'pending').length}건</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['apply', '신청하기'], ['history', '신청 내역']].map(([k, l]) => `
    <button class="rel-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab === k ? '#4F46E5' : 'transparent'};
             color:${_tab === k ? '#4F46E5' : 'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">
    ${_tab === 'apply' ? _renderForm() : _renderHistory(all)}
  </div>
</div>`;

  root.querySelector('#rel-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.rel-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _render(root); }));
  if (_tab === 'apply') _bindForm(root, empId, session);
}

function _renderForm() {
  return `
<div style="max-width:480px;margin:0 auto">
  <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border-radius:12px;padding:12px 16px;margin-bottom:16px;color:#fff">
    <div style="font-size:13px;font-weight:700;margin-bottom:2px">💰 이사 비용 실비 지원</div>
    <div style="font-size:11px;opacity:0.85">연 1회 · 최대 100만원 · 영수증 제출 후 정산</div>
  </div>

  <div style="margin-bottom:14px">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;font-weight:600">이사 사유 <span style="color:#EF4444">*</span></div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${Object.entries(MOVE_REASONS).map(([k, v]) => `
      <button class="rel-reason" data-key="${k}"
        style="display:flex;align-items:center;gap:12px;padding:12px 14px;
               border:2px solid ${_form.reason === k ? '#4F46E5' : 'var(--border)'};
               border-radius:12px;background:${_form.reason === k ? '#EEF2FF' : 'var(--card-bg)'};cursor:pointer;text-align:left">
        <span style="font-size:20px">${REASON_ICONS[k]}</span>
        <span style="font-size:13px;font-weight:600;color:${_form.reason === k ? '#4F46E5' : 'var(--text)'}">${v}</span>
      </button>`).join('')}
    </div>
  </div>

  <div style="margin-bottom:12px">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">현 주소 <span style="color:#EF4444">*</span></div>
    <input id="rel-from" type="text" placeholder="현재 거주지 주소" value="${_form.fromAddr}"
      style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text)">
  </div>

  <div style="margin-bottom:12px">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">이사 예정지 <span style="color:#EF4444">*</span></div>
    <input id="rel-to" type="text" placeholder="이사할 새 주소" value="${_form.toAddr}"
      style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text)">
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">이사일 <span style="color:#EF4444">*</span></div>
      <input id="rel-date" type="date" value="${_form.moveDate}"
        style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">예상 비용 (원) <span style="color:#EF4444">*</span></div>
      <input id="rel-cost" type="number" min="0" max="1000000" placeholder="0" value="${_form.estimatedCost}"
        style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
  </div>

  <button id="rel-submit"
    style="width:100%;padding:13px;border:none;border-radius:12px;background:#4F46E5;color:#fff;font-size:14px;font-weight:700;cursor:pointer">
    신청하기
  </button>
</div>`;
}

function _renderHistory(all) {
  if (!all.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">📦</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:6px">신청 내역이 없습니다</div>
      <button onclick="document.querySelector('[data-tab=apply]')?.click()" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">이사 지원 신청</button>
    
  <div style="font-size:12px">이사 비용 지원을 신청해 보세요</div>
</div>`;

  return `<div style="max-width:480px;margin:0 auto">${all.slice().reverse().map(r => {
    const meta = STATUS_META[r.status] || STATUS_META.pending;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:24px">${REASON_ICONS[r.reason] || '📦'}</span>
      <div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">${MOVE_REASONS[r.reason] || r.reason}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:1px">이사일 ${r.moveDate}</div>
      </div>
    </div>
    <span style="padding:3px 9px;border-radius:6px;font-size:11px;font-weight:600;background:${meta.bg};color:${meta.color};white-space:nowrap">${meta.label}</span>
  </div>
  <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">
    ${r.fromAddr} → ${r.toAddr}
  </div>
  <div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:6px;border-top:1px solid var(--border)">
    <span style="padding:2px 8px;background:#EEF2FF;border-radius:5px;font-size:11px;color:#4F46E5;font-weight:600">
      예상 ${(r.estimatedCost || 0).toLocaleString()}원
    </span>
    <span style="padding:2px 8px;background:#F1F5F9;border-radius:5px;font-size:11px;color:var(--text-muted)">신청 ${r.reqDate}</span>
  </div>
</div>`;
  }).join('')}</div>`;
}

function _bindForm(root, empId, session) {
  root.querySelectorAll('.rel-reason').forEach(btn => {
    btn.addEventListener('click', () => { _form.reason = btn.dataset.key; _render(root); });
  });

  root.querySelector('#rel-submit')?.addEventListener('click', () => {
    _form.fromAddr = root.querySelector('#rel-from')?.value.trim() || '';
    _form.toAddr = root.querySelector('#rel-to')?.value.trim() || '';
    _form.moveDate = root.querySelector('#rel-date')?.value || '';
    _form.estimatedCost = parseInt(root.querySelector('#rel-cost')?.value) || '';

    if (!_form.fromAddr) { showToast('현 주소를 입력해 주세요.', 'error'); return; }
    if (!_form.toAddr) { showToast('이사 예정지를 입력해 주세요.', 'error'); return; }
    if (!_form.moveDate) { showToast('이사일을 선택해 주세요.', 'error'); return; }
    if (!_form.estimatedCost) { showToast('예상 비용을 입력해 주세요.', 'error'); return; }
    if (_form.estimatedCost > 1000000) { showToast('최대 지원 금액은 100만원입니다.', 'warning'); }

    const saved = _load();
    saved.push({
      id: _id(),
      empId,
      empName: session.name || '직원',
      dept: session.department || '미지정',
      reason: _form.reason,
      fromAddr: _form.fromAddr,
      toAddr: _form.toAddr,
      moveDate: _form.moveDate,
      estimatedCost: _form.estimatedCost,
      status: 'pending',
      reqDate: _today(),
    });
    _save(saved);
    showToast('이사 비용 지원 신청이 완료되었습니다.', 'success')
    addNotification({ type: 'success', title: '이사 지원', body: '이사 비용 지원 신청이 완료되었습니다.' });
    _form = _blankForm();
    _tab = 'history';
    _render(root);
  });
}
