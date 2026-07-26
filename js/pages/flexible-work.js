/**
 * flexible-work.js — 유연근무 신청 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const TODAY = new Date().toISOString().slice(0,10);

const LS = 'hr_flexible_work';

const WORK_TYPES = [
  { key:'flextime',   label:'시차출퇴근',    icon:'⏰', desc:'출퇴근 시간을 조정하는 유연근무 (예: 10시 출근~19시 퇴근)' },
  { key:'compressed', label:'주4일 근무',    icon:'📅', desc:'주 4일 근무로 하루 10시간 근무 (월~목 집중 근무)' },
  { key:'halftime',   label:'반반차 활용',   icon:'🌗', desc:'오전 또는 오후만 근무하는 반일 스케줄 조정' },
  { key:'remote',     label:'재택+사무실 혼합', icon:'🏠', desc:'주 일부는 재택, 일부는 사무실 근무하는 하이브리드' },
];

const STATUS_META = {
  pending:  { label:'검토 중', color:'#F59E0B', bg:'#FEF3C7' },
  approved: { label:'승인',   color:'#10B981', bg:'#ECFDF5' },
  rejected: { label:'반려',   color:'#EF4444', bg:'#FEE2E2' },
  expired:  { label:'종료',   color:'var(--text-muted)', bg:'#F1F5F9' },
};

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }

function _getAll() { try { return JSON.parse(localStorage.getItem(LS)||'[]'); } catch { return []; } }
function _save(l)  { localStorage.setItem(LS, JSON.stringify(l)); }

let _tab     = 'request';
let _selType = 'flextime';
let _root    = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _root=root; _tab='request'; _selType='flextime'; _render(); }
export function unmount() { _tab = 'request'; _root=null; }

function _render() {
  const myReqs  = _getAll().filter(r=>r.empId===_empId());
  const active  = myReqs.filter(r=>r.status==='approved').length;

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="fw-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">⏰ 유연근무 신청</div>
      <div style="font-size:11px;color:var(--text-muted)">승인된 ${active}건</div>
    </div>
    ${active ? `<div style="background:#10B981;color:#fff;border-radius:99px;padding:3px 10px;font-size:12px;font-weight:700">적용중</div>` : ''}
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['request','신청하기'],['mine','내 신청']].map(([k,l])=>`
    <button class="fw-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='request' ? _renderRequest() : _renderMine(myReqs)}
  </div>
</div>`;

  _root.querySelector('#fw-back').addEventListener('click', ()=>window.navBack());
  _root.querySelectorAll('.fw-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(); }));
  if (_tab==='request') _bindRequest();
}

function _renderRequest() {
  const sel = WORK_TYPES.find(t=>t.key===_selType)||WORK_TYPES[0];
  return `
<!-- 근무 유형 -->
<div style="margin-bottom:14px">
  <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px">유연근무 유형</div>
  ${WORK_TYPES.map(t=>`
  <div class="fw-type" data-type="${t.key}"
    style="display:flex;align-items:center;gap:10px;padding:10px 12px;margin-bottom:6px;
           border-radius:10px;border:1.5px solid ${_selType===t.key?'#4F46E5':'var(--border)'};
           background:${_selType===t.key?'#EEF2FF':'var(--card-bg)'};cursor:pointer">
    <span style="font-size:20px">${t.icon}</span>
    <div style="flex:1">
      <div style="font-size:12px;font-weight:700;color:${_selType===t.key?'#4F46E5':'var(--text)'}">${t.label}</div>
      <div style="font-size:10px;color:var(--text-muted)">${t.desc}</div>
    </div>
    ${_selType===t.key?`<span style="color:#4F46E5">✓</span>`:''}
  </div>`).join('')}
</div>

<!-- 적용 기간 -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
  <div>
    <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">시작일 *</div>
    <input id="fw-start" type="date"
      style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
             background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box" min="${TODAY}">
  </div>
  <div>
    <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">종료일 *</div>
    <input id="fw-end" type="date"
      style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
             background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
  </div>
</div>

<!-- 세부 일정 -->
${_selType==='flextime' ? `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
  <div>
    <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">출근 시간</div>
    <select id="fw-in" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px">
      ${['07:00','08:00','09:00','10:00','11:00'].map(t=>`<option value="${t}">${t}</option>`).join('')}
    </select>
  </div>
  <div>
    <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">퇴근 시간</div>
    <select id="fw-out" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px">
      ${['16:00','17:00','18:00','19:00','20:00'].map(t=>`<option value="${t}" ${t==='18:00'?'selected':''}>${t}</option>`).join('')}
    </select>
  </div>
</div>` : ''}

<!-- 사유 -->
<div style="margin-bottom:14px">
  <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">신청 사유 *</div>
  <textarea maxlength="500" id="fw-reason" rows="3"
    placeholder="유연근무가 필요한 이유를 구체적으로 입력해 주세요"
    style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
           background:var(--bg);color:var(--text);font-size:12px;resize:none;box-sizing:border-box"></textarea>
</div>

<button id="fw-submit"
  style="width:100%;padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;
         font-size:13px;font-weight:700;cursor:pointer">신청</button>`;
}

function _renderMine(reqs) {
  const sorted = [...reqs].sort((a,b)=>b.startDate.localeCompare(a.startDate));
  if (!sorted.length) return `
<div style="text-align:center;padding:48px 16px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">⏰</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:4px">신청 내역이 없습니다</div>
      <button onclick="location.hash='#/flexible-work'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">유연근무 신청</button>
    
  <div style="font-size:12px">유연근무가 필요하면 신청해 보세요!</div>
</div>`;

  return sorted.map(r=>{
    const meta = STATUS_META[r.status]||STATUS_META.pending;
    const wt   = WORK_TYPES.find(t=>t.key===r.workType)||WORK_TYPES[0];
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div style="display:flex;gap:8px;align-items:center">
      <span style="font-size:20px">${wt.icon}</span>
      <div>
        <div style="font-size:13px;font-weight:700">${wt.label}</div>
        <div style="font-size:11px;color:var(--text-muted)">${r.startDate} ~ ${r.endDate}</div>
      </div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;
                 background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>
  <div style="font-size:11px;color:var(--text-muted)">${r.reason}</div>
  ${r.schedule?`<div style="font-size:11px;color:var(--text-muted);margin-top:3px">⏰ ${r.schedule}</div>`:''}
</div>`; }).join('');
}

function _bindRequest() {
  _root.querySelectorAll('.fw-type').forEach(el=>{
    el.addEventListener('click',()=>{ _selType=el.dataset.type; _render(); });
  });

  _root.querySelector('#fw-submit')?.addEventListener('click',()=>{
    const start  = _root.querySelector('#fw-start')?.value;
    const end    = _root.querySelector('#fw-end')?.value;
    const reason = _root.querySelector('#fw-reason')?.value.trim();
    if (!start || !end) { showToast('적용 기간을 입력해 주세요.', 'error'); return; }
    if (!reason) { showToast('신청 사유를 입력해 주세요.', 'error'); return; }
    const inTime  = _root.querySelector('#fw-in')?.value;
    const outTime = _root.querySelector('#fw-out')?.value;
    const schedule= inTime && outTime ? `${inTime} 출근 / ${outTime} 퇴근` : null;
    const reqs = _getAll();
    const wt   = WORK_TYPES.find(t=>t.key===_selType)||WORK_TYPES[0];
    reqs.push({
      id:        'FW_'+Date.now(),
      empId:     _empId(),
      empName:   _empName(),
      workType:  _selType,
      startDate: start,
      endDate:   end,
      schedule,
      reason,
      status:    'pending',
      reqDate:   new Date().toISOString().slice(0,10),
    });
    _save(reqs);
    showToast(`${wt.label} 신청이 완료됐습니다.`, 'success')
    addNotification({ type: 'success', title: '유연근무 신청', body: '신청이 완료됐습니다.' });
    _tab='mine'; _render();
  });
}
