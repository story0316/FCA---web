/**
 * vehicle-request.js — 법인차량 운행 신청 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
const TODAY = new Date().toISOString().slice(0,10);

const LS_VEHICLES = 'hr_vehicles';
const LS_REQS     = 'hr_vehicle_requests';

const DEMO_VEHICLES = [
  { id:'VH001', name:'쏘나타 (12가 3456)', type:'세단',  seats:5, fuel:'가솔린', icon:'🚗', available:true },
  { id:'VH002', name:'스타리아 (34나 5678)', type:'미니밴', seats:9, fuel:'디젤',   icon:'🚌', available:true },
  { id:'VH003', name:'카니발 (56다 7890)',   type:'SUV',   seats:7, fuel:'LPG',    icon:'🚙', available:false },
  { id:'VH004', name:'그랜저 (78라 1234)',   type:'세단',  seats:5, fuel:'하이브리드', icon:'🚗', available:true },
];

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }

function _getVehicles() {
  const s = localStorage.getItem(LS_VEHICLES);
  if (!s) { localStorage.setItem(LS_VEHICLES, JSON.stringify(DEMO_VEHICLES)); return DEMO_VEHICLES; }
  try {
    const d = JSON.parse(s);
    return [...DEMO_VEHICLES.filter(dv=>!d.find(v=>v.id===dv.id)), ...d];
  } catch { return DEMO_VEHICLES; }
}
function _getReqs() { try { return JSON.parse(localStorage.getItem(LS_REQS)||'[]'); } catch { return []; } }
function _saveReqs(l) { localStorage.setItem(LS_REQS, JSON.stringify(l)); }

const STATUS_META = {
  pending:  { label:'검토 중', color:'#F59E0B', bg:'#FEF3C7' },
  approved: { label:'승인',    color:'#3B82F6', bg:'#EFF6FF' },
  using:    { label:'사용중',  color:'#8B5CF6', bg:'#F5F3FF' },
  returned: { label:'반납 완료', color:'#10B981', bg:'#ECFDF5' },
  rejected: { label:'반려',    color:'#EF4444', bg:'#FEE2E2' },
};

let _tab  = 'reserve';
let _root = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _root=root; _tab='reserve'; _render(); }
export function unmount() { _tab = 'reserve'; _root=null; }

function _render() {
  const myReqs  = _getReqs().filter(r=>r.empId===_empId());
  const active  = myReqs.filter(r=>r.status==='approved'||r.status==='using').length;

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="vh-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🚗 법인차량 예약</div>
      <div style="font-size:11px;color:var(--text-muted)">가용 차량 ${_getVehicles().filter(v=>v.available).length}대</div>
    </div>
    ${active ? `<div style="background:#8B5CF6;color:#fff;border-radius:99px;padding:3px 10px;font-size:12px;font-weight:700">예약중 ${active}</div>` : ''}
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['reserve','예약하기'],['mine','내 예약']].map(([k,l])=>`
    <button class="vh-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='reserve' ? _renderReserve() : _renderMine(myReqs)}
  </div>
</div>`;

  _root.querySelector('#vh-back').addEventListener('click', ()=>window.navBack());
  _root.querySelectorAll('.vh-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(); }));
  if (_tab==='reserve') _bindReserve();
}

function _renderReserve() {
  const vehicles = _getVehicles();
  return `
<!-- 차량 목록 -->
${vehicles.map(v=>`
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
     padding:12px;margin-bottom:8px;opacity:${v.available?1:0.6}">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
    <span style="font-size:28px">${v.icon}</span>
    <div style="flex:1">
      <div style="font-size:13px;font-weight:700">${v.name}</div>
      <div style="font-size:11px;color:var(--text-muted)">${v.type} · ${v.seats}인승 · ${v.fuel}</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;
                 background:${v.available?'#D1FAE5':'#FEE2E2'};color:${v.available?'#10B981':'#EF4444'}">
      ${v.available?'가용':'사용중'}
    </span>
  </div>
  ${v.available ? `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
    <div>
      <div style="font-size:10px;font-weight:600;color:var(--text-muted);margin-bottom:3px">사용 일자</div>
      <input type="date" class="vh-date" data-vid="${v.id}"
        style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;
               background:var(--bg);color:var(--text);font-size:11px;box-sizing:border-box" min="${TODAY}">
    </div>
    <div>
      <div style="font-size:10px;font-weight:600;color:var(--text-muted);margin-bottom:3px">반납 일자</div>
      <input type="date" class="vh-enddate" data-vid="${v.id}"
        style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;
               background:var(--bg);color:var(--text);font-size:11px;box-sizing:border-box" min="${TODAY}">
    </div>
  </div>
  <input type="text" class="vh-purpose" data-vid="${v.id}" placeholder="사용 목적 (예: 거래처 방문)"
    style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;
           background:var(--bg);color:var(--text);font-size:11px;box-sizing:border-box;margin-bottom:8px">
  <button class="vh-book" data-id="${v.id}" data-name="${v.name}"
    style="width:100%;padding:8px;background:#4F46E5;color:#fff;border:none;border-radius:8px;
           font-size:12px;font-weight:700;cursor:pointer">예약 신청</button>
  ` : `<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:4px 0">현재 사용 중입니다</div>`}
</div>`).join('')}`;
}

function _renderMine(reqs) {
  const sorted = [...reqs].sort((a,b)=>b.reqDate.localeCompare(a.reqDate));
  if (!sorted.length) return `
<div style="text-align:center;padding:48px 16px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">🚗</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:4px">예약 내역이 없습니다</div>
      <button onclick="location.hash='#/vehicle-request'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">차량 예약</button>
    
  <div style="font-size:12px">법인차량을 예약해 보세요!</div>
</div>`;

  return sorted.map(r=>{
    const meta = STATUS_META[r.status]||STATUS_META.pending;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div>
      <div style="font-size:13px;font-weight:700">${r.vehicleName}</div>
      <div style="font-size:11px;color:var(--text-muted)">${r.useDate} ~ ${r.endDate}</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;
                 background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>
  <div style="font-size:11px;color:var(--text-muted)">${r.purpose}</div>
</div>`; }).join('');
}

function _bindReserve() {
  _root.querySelectorAll('.vh-book').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const vid     = btn.dataset.id;
      const date    = _root.querySelector(`.vh-date[data-vid="${vid}"]`)?.value;
      const endDate = _root.querySelector(`.vh-enddate[data-vid="${vid}"]`)?.value;
      const purpose = _root.querySelector(`.vh-purpose[data-vid="${vid}"]`)?.value.trim();
      if (!date) { showToast('사용 일자를 선택해 주세요.', 'error'); return; }
      if (!purpose) { showToast('사용 목적을 입력해 주세요.', 'error'); return; }
      const reqs = _getReqs();
      reqs.push({
        id:          'VR_'+Date.now(),
        empId:       _empId(),
        empName:     _empName(),
        vehicleId:   vid,
        vehicleName: btn.dataset.name,
        useDate:     date,
        endDate:     endDate||date,
        purpose,
        status:      'pending',
        reqDate:     new Date().toISOString().slice(0,10),
      });
      _saveReqs(reqs);
      showToast(`${btn.dataset.name} 예약 신청이 완료됐습니다.`, 'success')
    addNotification({ type: 'success', title: '차량 예약', body: '예약 신청이 완료됐습니다.' });
      _tab = 'mine';
      _render();
    });
  });
}
