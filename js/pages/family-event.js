/**
 * family-event.js — 경조사 지원 신청
 */

import {getUser, isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const TODAY = new Date().toISOString().slice(0,10);

function _session() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}'); } catch { return {}; } }
function _empId()   { const s = _session(); return s.empId || s.userId || getUser()?.id || 'demo'; }
function _empName() { const u = getUser(); return u?.name || u?.email?.split('@')[0] || '사용자'; }

const LS = 'hr_family_events';

const EVENT_TYPES = [
  { key: 'own_wedding',    label: '본인 결혼',  icon: '💍', days: 5,  gift: 300000 },
  { key: 'child_wedding',  label: '자녀 결혼',  icon: '🤵', days: 1,  gift: 100000 },
  { key: 'parent_death',   label: '부모 상',    icon: '🕯️', days: 5,  gift: 500000 },
  { key: 'spouse_death',   label: '배우자 상',  icon: '🕯️', days: 5,  gift: 500000 },
  { key: 'child_death',    label: '자녀 상',    icon: '🕯️', days: 3,  gift: 300000 },
  { key: 'own_birthday60', label: '본인 회갑',  icon: '🎂', days: 1,  gift: 100000 },
  { key: 'sibling_death',  label: '형제자매 상', icon: '🕯️', days: 3,  gift: 100000 },
  { key: 'grandparent_death', label: '조부모 상', icon: '🕯️', days: 2, gift: 100000 },
  { key: 'other',          label: '기타',       icon: '📋', days: 0,  gift: 0 },
];

const STATUS_META = {
  pending:  { label: '검토 중',  color: '#F59E0B', bg: '#FEF3C7' },
  approved: { label: '승인됨',   color: '#10B981', bg: '#D1FAE5' },
  rejected: { label: '반려됨',   color: '#EF4444', bg: '#FEE2E2' },
  paid:     { label: '지급완료', color: '#3B82F6', bg: '#DBEAFE' },
};

function _getAll() { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } }
function _save(l) { localStorage.setItem(LS, JSON.stringify(l)); }
function _id() { return 'fe_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

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
  const empId = _empId();
  const empName = _empName();
  const myEvents = _getAll().filter(e => e.empId === empId);

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden">
  <div class="page-header" style="flex-shrink:0;background:var(--card-bg);border-bottom:1px solid var(--border);padding:16px;display:flex;align-items:center;gap:12px">
    <button onclick="window.navBack()"
      style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0;line-height:1">←</button>
    <div>
      <div style="font-size:16px;font-weight:700;color:var(--text)">경조사 지원</div>
      <div style="font-size:11px;color:var(--text-muted)">경조금 · 경조휴가 신청</div>
    </div>
  </div>

  <div style="flex-shrink:0;display:flex;border-bottom:1px solid var(--border);background:var(--card-bg)">
    <button class="fe-tab" data-t="apply"
      style="flex:1;padding:12px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab==='apply'?'#4F46E5':'transparent'};
             color:${_tab==='apply'?'#4F46E5':'var(--text-muted)'}">신청</button>
    <button class="fe-tab" data-t="history"
      style="flex:1;padding:12px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab==='history'?'#4F46E5':'transparent'};
             color:${_tab==='history'?'#4F46E5':'var(--text-muted)'}">내 신청 이력 (${myEvents.length})</button>
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">
    ${_tab === 'apply' ? _renderApply() : _renderHistory(myEvents)}
  </div>
</div>`;

  root.querySelectorAll('.fe-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _draw(root); });
  });

  if (_tab === 'apply') {
    _bindApply(root, empId, empName);
  }
}

function _renderApply() {
  const sel = _selectedType ? EVENT_TYPES.find(t => t.key === _selectedType) : null;

  return `
<div style="margin-bottom:20px">
  <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">경조사 유형 선택</div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
    ${EVENT_TYPES.map(t => {
      const active = _selectedType === t.key;
      return `<button class="fe-type-btn" data-key="${t.key}"
        style="padding:10px 6px;border-radius:12px;border:1.5px solid ${active ? '#4F46E5' : 'var(--border)'};
               background:${active ? '#EEF2FF' : 'var(--card-bg)'};cursor:pointer;text-align:center">
        <div style="font-size:20px;margin-bottom:4px">${t.icon}</div>
        <div style="font-size:10px;font-weight:600;color:${active ? '#4F46E5' : 'var(--text)'};">${t.label}</div>
        ${t.days > 0 ? `<div style="font-size:9px;color:var(--text-muted);margin-top:2px">${t.days}일 · ${(t.gift/10000).toFixed(0)}만원</div>` : ''}
      </button>`;
    }).join('')}
  </div>
</div>

${sel ? `
<div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:12px;padding:12px;margin-bottom:16px">
  <div style="font-size:12px;font-weight:700;color:#4F46E5;margin-bottom:6px">${sel.icon} ${sel.label} 지원 내역</div>
  <div style="display:flex;gap:16px">
    <div style="flex:1;background:var(--card-bg);border-radius:8px;padding:10px;text-align:center">
      <div style="font-size:20px;font-weight:800;color:#4F46E5">${sel.days}일</div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:2px">경조 휴가</div>
    </div>
    <div style="flex:1;background:var(--card-bg);border-radius:8px;padding:10px;text-align:center">
      <div style="font-size:18px;font-weight:800;color:#10B981">${sel.gift > 0 ? (sel.gift/10000).toFixed(0)+'만원' : '-'}</div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:2px">경조금</div>
    </div>
  </div>
</div>

<form id="fe-form">
  <div style="display:flex;flex-direction:column;gap:12px">
    <div>
      <label style="font-size:12px;font-weight:600;color:var(--text);display:block;margin-bottom:4px">사유 상세 <span style="color:#EF4444">*</span></label>
      <input id="fe-note" type="text" required placeholder="예: 장인어른 별세 (2026-06-10)"
        style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div>
        <label style="font-size:12px;font-weight:600;color:var(--text);display:block;margin-bottom:4px">행사일 <span style="color:#EF4444">*</span></label>
        <input id="fe-event-date" type="date" required
          style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;color:var(--text);display:block;margin-bottom:4px">휴가 시작일</label>
        <input id="fe-leave-start" type="date"
          style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box" min="${TODAY}">
      </div>
    </div>
    <div>
      <label style="font-size:12px;font-weight:600;color:var(--text);display:block;margin-bottom:4px">계좌번호 (경조금 수령용)</label>
      <input id="fe-account" type="text" placeholder="은행명 계좌번호 (예: 국민은행 123-45-67890)"
        style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
    <div>
      <label style="font-size:12px;font-weight:600;color:var(--text);display:block;margin-bottom:4px">첨부서류 안내</label>
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;font-size:11px;color:var(--text-muted);line-height:1.6">
        • 결혼: 청첩장 사본<br>
        • 사망: 사망진단서 또는 가족관계증명서<br>
        • 회갑: 가족관계증명서<br>
        ※ 서류는 인사팀에 이메일 또는 직접 제출
      </div>
    </div>
    <button type="submit"
      style="width:100%;padding:13px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">
      신청하기
    </button>
  </div>
</form>` : `
<div style="text-align:center;padding:40px 20px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:12px">🎊</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:6px">경조사 유형을 선택해주세요</div>
  <div style="font-size:12px">해당 지원 혜택과 신청서가 표시됩니다</div>
</div>`}`;
}

function _renderHistory(events) {
  if (!events.length) {
    return `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
      <div style="font-size:40px;margin-bottom:12px">📋</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:6px">신청 이력이 없습니다</div>
      <button onclick="document.querySelector('[data-t=apply]')?.click()" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">신청하기</button>
    
      <div style="font-size:12px">경조사 발생 시 신청 탭에서 접수하세요</div>
    </div>`;
  }

  const sorted = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return sorted.map(ev => {
    const evType = EVENT_TYPES.find(t => t.key === ev.eventType) || { label: ev.eventType, icon: '📋' };
    const sm = STATUS_META[ev.status] || STATUS_META.pending;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:22px">${evType.icon}</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${evType.label}</div>
        <div style="font-size:11px;color:var(--text-muted)">${ev.createdAt.slice(0,10)} 신청</div>
      </div>
    </div>
    <span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;
                 background:${sm.bg};color:${sm.color}">${sm.label}</span>
  </div>
  <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">${ev.note}</div>
  <div style="display:flex;gap:8px">
    ${evType.days > 0 ? `<span style="padding:3px 8px;background:#F1F5F9;border-radius:6px;font-size:11px;color:#475569">🏖️ 경조휴가 ${evType.days}일</span>` : ''}
    ${evType.gift > 0 ? `<span style="padding:3px 8px;background:#F1F5F9;border-radius:6px;font-size:11px;color:#475569">💰 경조금 ${(evType.gift/10000).toFixed(0)}만원</span>` : ''}
    ${ev.eventDate ? `<span style="padding:3px 8px;background:#F1F5F9;border-radius:6px;font-size:11px;color:#475569">📅 ${ev.eventDate}</span>` : ''}
  </div>
  ${ev.adminComment ? `<div style="margin-top:8px;padding:8px;background:var(--bg);border-radius:8px;font-size:11px;color:var(--text-muted)">
    <span style="font-weight:600">담당자 코멘트:</span> ${ev.adminComment}</div>` : ''}
</div>`;
  }).join('');
}

function _bindApply(root, empId, empName) {
  root.querySelectorAll('.fe-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _selectedType = btn.dataset.key;
      _draw(root);
    });
  });

  const form = root.querySelector('#fe-form');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const _submitBtn = root.querySelector('button[type="submit"]');
    if (_submitBtn) _submitBtn.disabled = true;
    const note       = root.querySelector('#fe-note')?.value.trim();
    const eventDate  = root.querySelector('#fe-event-date')?.value;
    const leaveStart = root.querySelector('#fe-leave-start')?.value;
    const account    = root.querySelector('#fe-account')?.value.trim();

    if (!note || !eventDate) { showToast('사유 상세와 행사일을 입력해주세요.', 'error'); return; }

    const list = _getAll();
    list.push({
      id: _id(),
      empId,
      empName,
      eventType:   _selectedType,
      note,
      eventDate,
      leaveStart:  leaveStart || null,
      account:     account || null,
      status:      'pending',
      adminComment: null,
      createdAt:   new Date().toISOString(),
    });
    _save(list);
    showToast('경조사 지원을 신청했습니다.', 'success');
    if (_submitBtn) _submitBtn.disabled = false;
    addNotification({ type: 'info', title: '경조사 신청 접수', message: '검토 후 결과를 안내드립니다.' });
    _selectedType = null;
    _tab = 'history';
    _draw(root);
  });
}
