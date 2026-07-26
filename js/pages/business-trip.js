/**
 * business-trip.js — 출장 신청
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

const LS = 'hr_business_trips';

const PURPOSES = [
  { key: 'client',    label: '고객사 방문',   icon: '🤝' },
  { key: 'conf',      label: '컨퍼런스/전시', icon: '🎪' },
  { key: 'training',  label: '교육/연수',      icon: '📚' },
  { key: 'sales',     label: '영업/제안',      icon: '💼' },
  { key: 'audit',     label: '현장 실사',      icon: '🔍' },
  { key: 'other',     label: '기타',           icon: '✈️' },
];

const TRANSPORT = ['KTX/기차', '항공', '자동차', '버스', '기타'];

const STATUS_META = {
  draft:    { label: '임시저장',  bg: '#F1F5F9', color: 'var(--text-muted)' },
  pending:  { label: '검토 중',   bg: '#FEF3C7', color: '#D97706' },
  approved: { label: '승인',      bg: '#D1FAE5', color: '#059669' },
  rejected: { label: '반려',      bg: '#FEE2E2', color: '#EF4444' },
  completed:{ label: '완료',      bg: '#EDE9FE', color: '#7C3AED' },
};

function _load()    { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } }
function _save(d)   { localStorage.setItem(LS, JSON.stringify(d)); }
function _id()      { return 'bt_' + Date.now() + '_' + Math.random().toString(36).slice(2,5); }
function _today()   { return new Date().toISOString().slice(0,10); }

const BLANK = {
  purpose: 'client', destination: '', startDate: _today(), endDate: _today(),
  transport: 'KTX/기차', accommodation: false, budget: '',
  detail: '', companions: '',
};

let _tab = 'form';
let _form = { ...BLANK };

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'form'; _form = { ...BLANK, startDate: _today(), endDate: _today() };
  _draw(root);
}
export function unmount() { _tab = 'form';}

function _draw(root) {
  const user = getUser();
  const uid  = user?.id || user?.employee_id || 'demo';
  const all  = _load().filter(t => t.userId === uid);
  const pending = all.filter(t => t.status === 'pending').length;

  root.innerHTML = `
<div class="page-content" style="padding:16px;max-width:480px;margin:0 auto">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button onclick="window.navBack()" style="background:none;border:none;font-size:20px;cursor:pointer;padding:0">←</button>
    <div>
      <div style="font-size:17px;font-weight:800;color:var(--text)">출장 신청</div>
      <div style="font-size:11px;color:var(--text-muted)">검토 중 ${pending}건</div>
    </div>
  </div>

  <div style="display:flex;background:#F1F5F9;border-radius:10px;padding:3px;margin-bottom:16px">
    ${[{k:'form',l:'신청'},{k:'history',l:`내역 (${all.length})`}].map(t=>`
      <button class="bt-tab" data-t="${t.k}"
        style="flex:1;padding:8px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;
               background:${_tab===t.k?'#fff':'transparent'};color:${_tab===t.k?'#4F46E5':'var(--text-muted)'};
               box-shadow:${_tab===t.k?'0 1px 4px rgba(0,0,0,0.1)':'none'}">
        ${t.l}
      </button>`).join('')}
  </div>

  ${_tab === 'form'    ? _renderForm()      : ''}
  ${_tab === 'history' ? _renderHistory(all): ''}
</div>`;

  root.querySelectorAll('.bt-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _draw(root); });
  });

  if (_tab === 'form') _bindForm(root, uid);
}

function _renderForm() {
  const days = Math.max(1, Math.round((new Date(_form.endDate) - new Date(_form.startDate)) / 86400000) + 1);
  return `
<!-- 출장 목적 -->
<div style="margin-bottom:14px">
  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">출장 목적</div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
    ${PURPOSES.map(p=>`
      <button class="bt-purpose" data-key="${p.key}"
        style="padding:9px 4px;border:2px solid ${_form.purpose===p.key?'#4F46E5':'var(--border)'};
               border-radius:10px;background:${_form.purpose===p.key?'#EEF2FF':'var(--card-bg)'};cursor:pointer">
        <div style="font-size:20px">${p.icon}</div>
        <div style="font-size:10px;color:${_form.purpose===p.key?'#4F46E5':'var(--text-muted)'};margin-top:2px">${p.label}</div>
      </button>`).join('')}
  </div>
</div>

<!-- 목적지 -->
<div style="margin-bottom:12px">
  <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">출장지 <span style="color:#EF4444">*</span></div>
  <input id="bt-dest" type="text" placeholder="예: 서울 강남구, 부산 해운대구, 오사카"
    value="${_form.destination}"
    style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--card-bg);color:var(--text)">
</div>

<!-- 일정 -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
  <div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">출발일 <span style="color:#EF4444">*</span></div>
    <input id="bt-start" type="date" value="${_form.startDate}"
      style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--card-bg);color:var(--text)">
  </div>
  <div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">귀환일 <span style="color:#EF4444">*</span></div>
    <input id="bt-end" type="date" value="${_form.endDate}"
      style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--card-bg);color:var(--text)">
  </div>
</div>
<div style="background:#EEF2FF;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#4F46E5;font-weight:700;text-align:center">
  총 ${days}박 ${days}일 출장
</div>

<!-- 교통수단 -->
<div style="margin-bottom:12px">
  <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">교통수단</div>
  <div style="display:flex;gap:6px;flex-wrap:wrap">
    ${TRANSPORT.map(t=>`
      <button class="bt-trans" data-key="${t}"
        style="padding:7px 12px;border:2px solid ${_form.transport===t?'#4F46E5':'var(--border)'};
               border-radius:8px;background:${_form.transport===t?'#EEF2FF':'var(--card-bg)'};
               color:${_form.transport===t?'#4F46E5':'var(--text-muted)'};font-size:12px;font-weight:600;cursor:pointer">
        ${t}
      </button>`).join('')}
  </div>
</div>

<!-- 숙박 + 예산 -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
  <div style="display:flex;align-items:center;gap:8px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:10px">
    <input id="bt-accom" type="checkbox" ${_form.accommodation?'checked':''} style="width:16px;height:16px;accent-color:#4F46E5">
    <span style="font-size:12px;color:var(--text)">숙박 필요</span>
  </div>
  <div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">예상 경비 (원)</div>
    <input id="bt-budget" type="number" min="0" placeholder="0" value="${_form.budget}"
      style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--card-bg);color:var(--text)">
  </div>
</div>

<!-- 동행자 -->
<div style="margin-bottom:12px">
  <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">동행자 (선택)</div>
  <input id="bt-companions" type="text" placeholder="예: 김철수 대리, 이영희 과장"
    value="${_form.companions}"
    style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--card-bg);color:var(--text)">
</div>

<!-- 상세 내용 -->
<div style="margin-bottom:16px">
  <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">출장 상세 내용</div>
  <textarea maxlength="500" id="bt-detail" rows="2" placeholder="방문 목적, 미팅 내용 등"
    style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--card-bg);color:var(--text);resize:none">${_form.detail}</textarea>
</div>

<div style="display:flex;gap:8px">
  <button id="bt-draft"  style="flex:1;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--card-bg);color:var(--text-muted);font-size:13px;font-weight:600;cursor:pointer">임시저장</button>
  <button id="bt-submit" style="flex:2;padding:12px;border:none;border-radius:10px;background:#4F46E5;color:#fff;font-size:14px;font-weight:700;cursor:pointer">신청하기</button>
</div>`;
}

function _renderHistory(all) {
  if (!all.length) return `
<div style="text-align:center;padding:40px 16px;color:var(--text-muted)">
  <div style="font-size:32px;margin-bottom:8px">✈️</div>
  <div style="font-size:13px;font-weight:600;margin-bottom:4px">출장 신청 내역이 없습니다</div>
  <div style="font-size:12px;margin-bottom:14px">출장 신청을 등록해 보세요.</div>
  <button onclick="document.querySelector('[data-t=form]')?.click()" style="padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">출장 신청</button>
</div>`;

  return all.slice().reverse().map(t => {
    const meta = STATUS_META[t.status] || STATUS_META.pending;
    const purp = PURPOSES.find(p => p.key === t.purpose) || { icon:'✈️', label:'기타' };
    const days = Math.max(1, Math.round((new Date(t.endDate) - new Date(t.startDate)) / 86400000) + 1);
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div style="display:flex;gap:8px;align-items:center">
      <span style="font-size:22px">${purp.icon}</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${t.destination || '목적지 미기재'}</div>
        <div style="font-size:11px;color:var(--text-muted)">${t.startDate} ~ ${t.endDate} · ${days}박 ${days}일</div>
      </div>
    </div>
    <span style="padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>
  <div style="display:flex;gap:6px;flex-wrap:wrap">
    <span style="padding:2px 8px;background:#F1F5F9;border-radius:5px;font-size:11px;color:var(--text-muted)">${purp.label}</span>
    <span style="font-size:11px;color:var(--text-muted)">${t.transport}</span>
    ${t.accommodation ? '<span style="font-size:11px;color:var(--text-muted)">숙박 포함</span>' : ''}
    ${t.budget ? `<span style="font-size:11px;color:#4F46E5;font-weight:700">${parseInt(t.budget).toLocaleString()}원</span>` : ''}
  </div>
  ${t.adminComment ? `<div style="font-size:11px;color:#EF4444;margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">💬 ${t.adminComment}</div>` : ''}
</div>`;
  }).join('');
}

function _bindForm(root, uid) {
  root.querySelectorAll('.bt-purpose').forEach(btn => {
    btn.addEventListener('click', () => { _form.purpose = btn.dataset.key; _draw(root); });
  });
  root.querySelectorAll('.bt-trans').forEach(btn => {
    btn.addEventListener('click', () => { _form.transport = btn.dataset.key; _draw(root); });
  });

  const sync = () => {
    _form.destination   = root.querySelector('#bt-dest')?.value.trim()  || '';
    _form.startDate     = root.querySelector('#bt-start')?.value        || _today();
    _form.endDate       = root.querySelector('#bt-end')?.value          || _today();
    _form.accommodation = root.querySelector('#bt-accom')?.checked      || false;
    _form.budget        = root.querySelector('#bt-budget')?.value       || '';
    _form.companions    = root.querySelector('#bt-companions')?.value.trim() || '';
    _form.detail        = root.querySelector('#bt-detail')?.value.trim()|| '';
  };

  root.querySelector('#bt-start')?.addEventListener('change', () => { sync(); _draw(root); });
  root.querySelector('#bt-end')?.addEventListener('change',   () => { sync(); _draw(root); });
  root.querySelector('#bt-accom')?.addEventListener('change', () => { sync(); });

  const submit = (status) => {
    sync();
    if (!_form.destination) { showToast('출장지를 입력해 주세요.', 'error'); return; }
    if (!_form.startDate || !_form.endDate) { showToast('출장 일정을 입력해 주세요.', 'error'); return; }
    if (new Date(_form.endDate) < new Date(_form.startDate)) { showToast('귀환일이 출발일보다 빠릅니다.', 'error'); return; }
    const all = _load();
    all.push({
      id: _id(), userId: uid,
      ...JSON.parse(JSON.stringify(_form)),
      status,
      budget: parseInt(_form.budget) || 0,
      createdAt: new Date().toISOString(),
    });
    _save(all);
    showToast(status === 'draft' ? '임시 저장되었습니다.' : '출장 신청이 제출되었습니다.');
      addNotification({ type: 'success', title: '출장 신청', body: status === 'draft' ? '임시 저장되었습니다.' : '출장 신청이 제출되었습니다.' });
    _form = { ...BLANK, startDate: _today(), endDate: _today() };
    _tab = 'history';
    _draw(root);
  };

  root.querySelector('#bt-draft')?.addEventListener('click',  () => submit('draft'));
  root.querySelector('#bt-submit')?.addEventListener('click', () => submit('pending'));
}
