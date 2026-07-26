/**
 * internal-transfer.js — 사내 이동 신청
 */

import {getUser, isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const TODAY = new Date().toISOString().slice(0,10);

function _session() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}'); } catch { return {}; } }

const LS = 'hr_internal_transfers';

const TRANSFER_TYPES = [
  { key: 'dept',      label: '부서 이동',   icon: '🏢', desc: '다른 부서로의 이동 신청' },
  { key: 'role',      label: '직무 변경',   icon: '🔄', desc: '현 부서 내 직무/역할 변경' },
  { key: 'location',  label: '근무지 변경', icon: '📍', desc: '지사·지점 간 근무지 이동' },
  { key: 'promotion', label: '직급 이동',   icon: '⬆️', desc: '승진·직급 변경 신청' },
];

const DEPARTMENTS = [
  '개발팀', 'HR팀', '마케팅팀', '재무팀', '영업팀', '운영팀', '디자인팀', 'IT인프라팀', '법무팀', '전략기획팀',
];

const STATUS_META = {
  pending:   { label: '검토 중',  color: '#F59E0B', bg: '#FEF3C7' },
  approved:  { label: '승인됨',   color: '#10B981', bg: '#D1FAE5' },
  rejected:  { label: '반려됨',   color: '#EF4444', bg: '#FEE2E2' },
  withdrawn: { label: '취소됨',   color: 'var(--text-muted)', bg: '#F1F5F9' },
};

function _getAll() { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } }
function _save(l) { localStorage.setItem(LS, JSON.stringify(l)); }
function _id() { return 'it_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6); }

let _tab = 'apply';
let _selectedType = null;

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
  _selectedType = null;
  _draw(root);
}

export function unmount() {
  _tab = 'apply';
  _selectedType = null;
}

function _draw(root) {
  const user = getUser();
  const uid  = _session().empId || _session().userId || user?.id || 'demo';
  const myRequests = _getAll().filter(r => r.empId === uid).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden">
  <div class="page-header" style="flex-shrink:0;background:var(--card-bg);border-bottom:1px solid var(--border);padding:16px;display:flex;align-items:center;gap:12px">
    <button onclick="window.navBack()"
      style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0;line-height:1">←</button>
    <div>
      <div style="font-size:16px;font-weight:700;color:var(--text)">사내 이동 신청</div>
      <div style="font-size:11px;color:var(--text-muted)">부서·직무·근무지 이동 요청</div>
    </div>
  </div>

  <div style="flex-shrink:0;display:flex;border-bottom:1px solid var(--border);background:var(--card-bg)">
    <button class="it-tab" data-t="apply"
      style="flex:1;padding:12px;font-size:13px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab==='apply'?'#4F46E5':'transparent'};color:${_tab==='apply'?'#4F46E5':'var(--text-muted)'}">신청</button>
    <button class="it-tab" data-t="history"
      style="flex:1;padding:12px;font-size:13px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab==='history'?'#4F46E5':'transparent'};color:${_tab==='history'?'#4F46E5':'var(--text-muted)'}">신청 이력 (${myRequests.length})</button>
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">
    ${_tab === 'apply'   ? _renderApply()          : ''}
    ${_tab === 'history' ? _renderHistory(myRequests) : ''}
  </div>
</div>`;

  root.querySelectorAll('.it-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _draw(root); });
  });

  if (_tab === 'apply') _bindApply(root, uid, user);
}

function _renderApply() {
  const sel = _selectedType ? TRANSFER_TYPES.find(t => t.key === _selectedType) : null;

  return `
<!-- 이동 유형 -->
<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">이동 유형 선택</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
  ${TRANSFER_TYPES.map(t => {
    const active = _selectedType === t.key;
    return `<button class="it-type-btn" data-key="${t.key}"
      style="padding:12px;border-radius:12px;border:2px solid ${active?'#4F46E5':'var(--border)'};
             background:${active?'#EEF2FF':'var(--card-bg)'};cursor:pointer;text-align:left">
      <div style="font-size:22px;margin-bottom:4px">${t.icon}</div>
      <div style="font-size:12px;font-weight:700;color:${active?'#4F46E5':'var(--text)'}">${t.label}</div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:2px;line-height:1.4">${t.desc}</div>
    </button>`;
  }).join('')}
</div>

${sel ? `
<!-- 신청서 -->
<div style="background:#EEF2FF;border-radius:12px;padding:10px 12px;margin-bottom:14px">
  <div style="font-size:12px;font-weight:700;color:#4F46E5">${sel.icon} ${sel.label} 신청서</div>
</div>

<form id="it-form">
  <div style="display:flex;flex-direction:column;gap:12px">
    ${sel.key === 'dept' || sel.key === 'location' ? `
    <div>
      <label style="font-size:12px;font-weight:700;color:var(--text);display:block;margin-bottom:4px">현재 ${sel.key==='dept'?'부서':'근무지'}</label>
      <input id="it-from" type="text" placeholder="현재 ${sel.key==='dept'?'부서':'근무지'}" required
        style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
    <div>
      <label style="font-size:12px;font-weight:700;color:var(--text);display:block;margin-bottom:4px">희망 ${sel.key==='dept'?'부서':'근무지'} <span style="color:#EF4444">*</span></label>
      ${sel.key==='dept' ? `<select id="it-to" required
        style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text)">
        <option value="">선택하세요</option>
        ${DEPARTMENTS.map(d=>`<option value="${d}">${d}</option>`).join('')}
      </select>` : `<input id="it-to" type="text" placeholder="희망 근무지" required
        style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">`}
    </div>` : ''}

    ${sel.key === 'role' ? `
    <div>
      <label style="font-size:12px;font-weight:700;color:var(--text);display:block;margin-bottom:4px">현재 직무</label>
      <input id="it-from" type="text" placeholder="현재 담당 직무" required
        style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
    <div>
      <label style="font-size:12px;font-weight:700;color:var(--text);display:block;margin-bottom:4px">희망 직무 <span style="color:#EF4444">*</span></label>
      <input id="it-to" type="text" placeholder="희망하는 직무" required
        style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>` : ''}

    ${sel.key === 'promotion' ? `
    <div>
      <label style="font-size:12px;font-weight:700;color:var(--text);display:block;margin-bottom:4px">현재 직급</label>
      <input id="it-from" type="text" placeholder="현재 직급 (예: 대리)" required
        style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
    <div>
      <label style="font-size:12px;font-weight:700;color:var(--text);display:block;margin-bottom:4px">희망 직급 <span style="color:#EF4444">*</span></label>
      <input id="it-to" type="text" placeholder="희망 직급 (예: 과장)" required
        style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>` : ''}

    <div>
      <label style="font-size:12px;font-weight:700;color:var(--text);display:block;margin-bottom:4px">희망 시작일</label>
      <input id="it-date" type="date"
        style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box" min="${TODAY}">
    </div>

    <div>
      <label style="font-size:12px;font-weight:700;color:var(--text);display:block;margin-bottom:4px">신청 사유 <span style="color:#EF4444">*</span></label>
      <textarea maxlength="500" id="it-reason" rows="4" required placeholder="이동을 희망하는 이유, 역량 개발 목표 등을 구체적으로 작성해주세요."
        style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;background:var(--bg);color:var(--text);resize:vertical;box-sizing:border-box"></textarea>
    </div>

    <div style="background:#FEF3C7;border-radius:10px;padding:10px;font-size:11px;color:#D97706;line-height:1.6">
      ⚠️ 사내 이동 신청은 현 팀장 동의 후 HR팀 검토를 거칩니다.<br>
      승인까지 2~4주 소요될 수 있으며, 조직 상황에 따라 조정될 수 있습니다.
    </div>

    <button type="submit"
      style="width:100%;padding:13px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">
      신청하기
    </button>
  </div>
</form>` : `
<div style="text-align:center;padding:40px 20px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:12px">🔄</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:6px">이동 유형을 선택해주세요</div>
  <div style="font-size:12px">위에서 신청 유형을 선택하면 신청서가 표시됩니다</div>
</div>`}`;
}

function _renderHistory(requests) {
  if (!requests.length) {
    return `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
      <div style="font-size:40px;margin-bottom:12px">📋</div>
      <div style="font-size:14px;font-weight:600">신청 이력이 없습니다</div>
      <button onclick="document.querySelector('[data-t=apply]')?.click()" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">신청하기</button>
    
    </div>`;
  }
  return requests.map(r => {
    const t = TRANSFER_TYPES.find(x => x.key === r.transferType) || { icon: '🔄', label: r.transferType };
    const sm = STATUS_META[r.status] || STATUS_META.pending;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:22px">${t.icon}</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${t.label}</div>
        <div style="font-size:11px;color:var(--text-muted)">${r.createdAt.slice(0,10)} 신청</div>
      </div>
    </div>
    <span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${sm.bg};color:${sm.color};flex-shrink:0">${sm.label}</span>
  </div>
  ${r.from && r.to ? `<div style="font-size:12px;color:#475569;margin-bottom:6px">${r.from} → <strong>${r.to}</strong></div>` : ''}
  <div style="font-size:12px;color:var(--text-muted);line-height:1.5">${r.reason}</div>
  ${r.adminComment ? `<div style="margin-top:8px;padding:8px;background:var(--bg);border-radius:8px;font-size:11px;color:var(--text-muted)"><span style="font-weight:600">HR 코멘트:</span> ${r.adminComment}</div>` : ''}
  ${r.status === 'pending' ? `
    <button class="it-withdraw" data-id="${r.id}"
      style="margin-top:10px;padding:6px 12px;background:none;border:1.5px solid #EF4444;border-radius:8px;color:#EF4444;font-size:11px;font-weight:700;cursor:pointer">
      신청 취소
    </button>` : ''}
</div>`;
  }).join('');
}

function _bindApply(root, uid, user) {
  root.querySelectorAll('.it-type-btn').forEach(btn => {
    btn.addEventListener('click', () => { _selectedType = btn.dataset.key; _draw(root); });
  });

  root.querySelector('#it-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const _submitBtn = root.querySelector('button[type="submit"]');
    if (_submitBtn) _submitBtn.disabled = true;
    const from   = root.querySelector('#it-from')?.value.trim() || '';
    const to     = root.querySelector('#it-to')?.value.trim();
    const reason = root.querySelector('#it-reason')?.value.trim();
    const date   = root.querySelector('#it-date')?.value;
    if (!to || !reason) { showToast('희망 대상과 신청 사유를 입력해주세요.', 'error'); return; }

    const empName = user?.name || user?.email?.split('@')[0] || '직원';
    const all = _getAll();
    all.push({
      id: _id(), empId: uid, empName,
      transferType: _selectedType,
      from, to, reason,
      desiredDate: date || null,
      status: 'pending',
      adminComment: null,
      createdAt: new Date().toISOString(),
    });
    _save(all);
    showToast('사내 이동 신청이 접수되었습니다.', 'success');
    if (_submitBtn) _submitBtn.disabled = false;
    addNotification({ type: 'info', title: '이동 신청 접수', message: '검토 후 결과를 안내드립니다.' });
    _selectedType = null;
    _tab = 'history';
    _draw(root);
  });

  root.querySelectorAll('.it-withdraw')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const all = _getAll();
      const idx = all.findIndex(r => r.id === btn.dataset.id);
      if (idx !== -1) { all[idx].status = 'withdrawn'; _save(all); }
      showToast('신청이 취소되었습니다.', 'success');
      _draw(root);
    });
  });
}
