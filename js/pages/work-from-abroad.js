/**
 * work-from-abroad.js — 해외 원격근무 신청
 * Route: #/work-from-abroad
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
const TODAY = new Date().toISOString().slice(0,10);

const LS_KEY = 'hr_work_from_abroad';

const TIMEZONES = ['UTC+9', 'UTC+0', 'UTC-5', 'UTC+1', 'UTC+8'];

const STATUS_META = {
  pending:  { label: '검토 중',  bg: '#FEF3C7', color: '#D97706' },
  approved: { label: '승인',     bg: '#D1FAE5', color: '#059669' },
  rejected: { label: '반려',     bg: '#FEE2E2', color: '#EF4444' },
};

function _load() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } }
function _save(d) { localStorage.setItem(LS_KEY, JSON.stringify(d)); }
function _id() { return 'wfa_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5); }
function _today() { return new Date().toISOString().slice(0, 10); }
function _session() { try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; } }
function _empId()   { return _session().empId || _session().userId || 'EMP001'; }
function _empName() { return _session().name || '직원'; }
function _dept()    { return _session().dept || _session().department || '일반'; }

function _demoWFA() {
  const uid = _empId(); const name = _empName(); const dept = _dept();
  return [
    { id: `wfa_${uid}_1`, empId: uid, empName: name, dept, country: '태국',     city: '방콕',   startDate: '2026-07-01', endDate: '2026-07-14', purpose: '디지털 노마드 업무 환경 체험',   timezone: 'UTC+7', status: 'approved', reqDate: '2026-05-20' },
    { id: `wfa_${uid}_2`, empId: uid, empName: name, dept, country: '포르투갈', city: '리스본', startDate: '2026-09-01', endDate: '2026-09-30', purpose: '장기 해외 원격근무 테스트', timezone: 'UTC+1', status: 'pending',  reqDate: '2026-06-01' },
  ];
}

function _merged() {
  const demo = _demoWFA();
  const saved = _load();
  return [...demo.filter(d => !saved.find(x => x.id === d.id)), ...saved];
}

let _tab = 'apply';
let _form = {};

function _blankForm() {
  return { country: '', city: '', startDate: _today(), endDate: _today(), purpose: '', timezone: 'UTC+9' };
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
    <button id="wfa-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700;color:var(--text)">🌍 해외 원격근무 신청</div>
      <div style="font-size:11px;color:var(--text-muted)">총 ${all.length}건 · 검토 중 ${all.filter(r => r.status === 'pending').length}건</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['apply', '신청하기'], ['history', '신청 내역']].map(([k, l]) => `
    <button class="wfa-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab === k ? '#4F46E5' : 'transparent'};
             color:${_tab === k ? '#4F46E5' : 'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">
    ${_tab === 'apply' ? _renderForm() : _renderHistory(all)}
  </div>
</div>`;

  root.querySelector('#wfa-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.wfa-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _render(root); }));
  if (_tab === 'apply') _bindForm(root, empId, session);
}

function _renderForm() {
  const days = Math.max(1, Math.round((new Date(_form.endDate) - new Date(_form.startDate)) / 86400000) + 1);
  return `
<div style="max-width:480px;margin:0 auto">
  <div style="background:#EEF2FF;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#4F46E5;line-height:1.5">
    💡 해외 원격근무는 최대 30일 이내, 사전 승인 필수입니다.
  </div>

  <div style="margin-bottom:12px">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">국가 <span style="color:#EF4444">*</span></div>
    <input id="wfa-country" type="text" placeholder="예: 태국, 포르투갈, 독일" value="${_form.country}"
      style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text)">
  </div>

  <div style="margin-bottom:12px">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">도시 <span style="color:#EF4444">*</span></div>
    <input id="wfa-city" type="text" placeholder="예: 방콕, 리스본, 베를린" value="${_form.city}"
      style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text)">
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">시작일 <span style="color:#EF4444">*</span></div>
      <input id="wfa-start" type="date" value="${_form.startDate}"
        style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text)" min="${TODAY}">
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">종료일 <span style="color:#EF4444">*</span></div>
      <input id="wfa-end" type="date" value="${_form.endDate}"
        style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text)" min="${TODAY}">
    </div>
  </div>

  <div style="background:#EEF2FF;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#4F46E5;font-weight:700;text-align:center">
    총 ${days}일
  </div>

  <div style="margin-bottom:12px">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">현지 시간대 <span style="color:#EF4444">*</span></div>
    <select id="wfa-tz"
      style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text)">
      ${TIMEZONES.map(t => `<option value="${t}" ${_form.timezone === t ? 'selected' : ''}>${t}</option>`).join('')}
    </select>
  </div>

  <div style="margin-bottom:16px">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">근무 목적 <span style="color:#EF4444">*</span></div>
    <textarea maxlength="500" id="wfa-purpose" rows="3" placeholder="해외 원격근무 신청 사유를 입력해 주세요"
      style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text);resize:none">${_form.purpose}</textarea>
  </div>

  <button id="wfa-submit"
    style="width:100%;padding:13px;border:none;border-radius:12px;background:#4F46E5;color:#fff;font-size:14px;font-weight:700;cursor:pointer">
    신청하기
  </button>
</div>`;
}

function _renderHistory(all) {
  if (!all.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">🌍</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:6px">신청 내역이 없습니다</div>
      <button onclick="document.querySelector('[data-tab=apply]')?.click()" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">해외 원격근무 신청</button>
    
  <div style="font-size:12px">해외 원격근무를 신청해 보세요</div>
</div>`;

  return `<div style="max-width:480px;margin:0 auto">${all.slice().reverse().map(r => {
    const meta = STATUS_META[r.status] || STATUS_META.pending;
    const days = Math.max(1, Math.round((new Date(r.endDate) - new Date(r.startDate)) / 86400000) + 1);
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div>
      <div style="font-size:14px;font-weight:700;color:var(--text)">${r.country} · ${r.city}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${r.startDate} ~ ${r.endDate} (${days}일)</div>
    </div>
    <span style="padding:3px 9px;border-radius:6px;font-size:11px;font-weight:600;background:${meta.bg};color:${meta.color};white-space:nowrap">${meta.label}</span>
  </div>
  <div style="display:flex;gap:6px;flex-wrap:wrap">
    <span style="padding:2px 8px;background:#F1F5F9;border-radius:5px;font-size:11px;color:var(--text-muted)">⏰ ${r.timezone}</span>
    <span style="padding:2px 8px;background:#F1F5F9;border-radius:5px;font-size:11px;color:var(--text-muted)">신청 ${r.reqDate}</span>
  </div>
  ${r.purpose ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">${r.purpose}</div>` : ''}
</div>`;
  }).join('')}</div>`;
}

function _bindForm(root, empId, session) {
  root.querySelector('#wfa-start')?.addEventListener('change', e => { _form.startDate = e.target.value; _render(root); });
  root.querySelector('#wfa-end')?.addEventListener('change', e => { _form.endDate = e.target.value; _render(root); });

  root.querySelector('#wfa-submit')?.addEventListener('click', () => {
    _form.country = root.querySelector('#wfa-country')?.value.trim() || '';
    _form.city = root.querySelector('#wfa-city')?.value.trim() || '';
    _form.startDate = root.querySelector('#wfa-start')?.value || _today();
    _form.endDate = root.querySelector('#wfa-end')?.value || _today();
    _form.purpose = root.querySelector('#wfa-purpose')?.value.trim() || '';
    _form.timezone = root.querySelector('#wfa-tz')?.value || 'UTC+9';

    if (!_form.country) { showToast('국가를 입력해 주세요.', 'error'); return; }
    if (!_form.city) { showToast('도시를 입력해 주세요.', 'error'); return; }
    if (!_form.purpose) { showToast('근무 목적을 입력해 주세요.', 'error'); return; }
    if (new Date(_form.endDate) < new Date(_form.startDate)) { showToast('종료일이 시작일보다 빠릅니다.', 'error'); return; }

    const saved = _load();
    saved.push({
      id: _id(),
      empId,
      empName: session.name || '직원',
      dept: session.department || '미지정',
      country: _form.country,
      city: _form.city,
      startDate: _form.startDate,
      endDate: _form.endDate,
      purpose: _form.purpose,
      timezone: _form.timezone,
      status: 'pending',
      reqDate: _today(),
    });
    _save(saved);
    showToast('해외 원격근무 신청이 제출되었습니다.', 'success')
    addNotification({ type: 'success', title: '해외 원격근무', body: '해외 원격근무 신청이 제출되었습니다.' });
    _form = _blankForm();
    _tab = 'history';
    _render(root);
  });
}
