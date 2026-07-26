/**
 * vehicle-admin.js — 법인차량 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification, addNotificationForUser } from '../../components/notification-hub.js';

const LS_VEHICLES = 'hr_vehicles';
const LS_REQS     = 'hr_vehicle_requests';

const DEMO_VEHICLES = [
  { id:'VH001', name:'쏘나타 (12가 3456)',    type:'세단',  seats:5, fuel:'가솔린', icon:'🚗', available:true },
  { id:'VH002', name:'스타리아 (34나 5678)',  type:'미니밴', seats:9, fuel:'디젤',   icon:'🚌', available:true },
  { id:'VH003', name:'카니발 (56다 7890)',    type:'SUV',   seats:7, fuel:'LPG',    icon:'🚙', available:false },
  { id:'VH004', name:'그랜저 (78라 1234)',    type:'세단',  seats:5, fuel:'하이브리드', icon:'🚗', available:true },
];

const LEGACY_REQ_IDS = new Set(['VR001','VR002','VR003','VR004']);

const STATUS_META = {
  pending:  { label:'검토 중', color:'#F59E0B' },
  approved: { label:'승인',    color:'#3B82F6' },
  using:    { label:'사용중',  color:'#8B5CF6' },
  returned: { label:'반납 완료', color:'#10B981' },
  rejected: { label:'반려',    color:'#EF4444' },
};

function _getVehicles() {
  const s = localStorage.getItem(LS_VEHICLES);
  if (!s) { localStorage.setItem(LS_VEHICLES, JSON.stringify(DEMO_VEHICLES)); return DEMO_VEHICLES; }
  try {
    const d = JSON.parse(s);
    return [...DEMO_VEHICLES.filter(dv=>!d.find(v=>v.id===dv.id)), ...d];
  } catch { return DEMO_VEHICLES; }
}
function _saveVehicles(l) { localStorage.setItem(LS_VEHICLES, JSON.stringify(l)); }
function _getReqs() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_REQS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_REQ_IDS.has(r.id));
    if (cleaned.length !== list.length) _saveReqs(cleaned);
    return cleaned;
  } catch { return []; }
}
function _saveReqs(l) { localStorage.setItem(LS_REQS, JSON.stringify(l)); }

let _tab  = 'reservations';
let _root = null;

export function render(root) { _root=root; _tab='reservations'; _draw(); }
export function unmount() { _root=null;
  _tab = 'reservations';
}

function _draw() {
  const reqs    = _getReqs();
  const pending = reqs.filter(r=>r.status==='pending').length;

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['reservations',`예약 현황${pending?` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending}</span>`:''}`],['vehicles','차량 관리']].map(([k,l])=>`
    <button class="va-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='reservations' ? _renderReservations(reqs) : _renderVehicles()}
  </div>
</div>`;

  _root.querySelectorAll('.va-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderReservations(reqs) {
  const pending  = reqs.filter(r=>r.status==='pending').length;
  const using    = reqs.filter(r=>r.status==='using').length;
  const approved = reqs.filter(r=>r.status==='approved').length;

  return `
<!-- KPI -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
  ${[
    ['대기', `${pending}건`, '#F59E0B'],
    ['승인/사용중', `${approved+using}건`, '#8B5CF6'],
    ['완료', `${reqs.filter(r=>r.status==='returned').length}건`, '#10B981'],
  ].map(([l,v,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:18px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8">${l}</div>
  </div>`).join('')}
</div>

${[...reqs].sort((a,b)=>b.reqDate.localeCompare(a.reqDate)).map(r=>{
  const meta = STATUS_META[r.status];
  return `
<div style="background:var(--card-bg);border:1px solid ${r.status==='pending'?'#FCD34D':'var(--border)'};
     border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div>
      <div style="font-size:13px;font-weight:700">${r.empName}</div>
      <div style="font-size:11px;color:#94A3B8">${r.reqDate}</div>
    </div>
    <span style="font-size:11px;font-weight:700;color:${meta.color}">${meta.label}</span>
  </div>
  <div style="font-size:12px;color:#64748B;margin-bottom:4px">🚗 ${r.vehicleName}</div>
  <div style="font-size:11px;color:#94A3B8;margin-bottom:${r.status==='pending'?'10':'0'}px">${r.useDate} ~ ${r.endDate} · ${r.purpose}</div>
  ${r.status==='pending' ? `
  <div style="display:flex;gap:6px">
    <button class="va-approve" data-id="${r.id}"
      style="flex:1;padding:8px;background:#3B82F6;color:#fff;border:none;border-radius:8px;
             font-size:12px;font-weight:700;cursor:pointer">승인</button>
    <button class="va-reject" data-id="${r.id}"
      style="flex:1;padding:8px;background:none;border:1px solid #EF4444;color:#EF4444;border-radius:8px;
             font-size:12px;font-weight:700;cursor:pointer">반려</button>
  </div>` : r.status==='approved'||r.status==='using' ? `
  <button class="va-return" data-id="${r.id}" data-vid="${r.vehicleId}"
    style="width:100%;padding:8px;background:#10B981;color:#fff;border:none;border-radius:8px;
           font-size:12px;font-weight:700;cursor:pointer;margin-top:8px">반납 처리</button>
  ` : ''}
</div>`; }).join('')}`;
}

function _renderVehicles() {
  const vehicles = _getVehicles();
  const using    = vehicles.filter(v=>!v.available).length;

  return `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
  ${[
    ['전체', `${vehicles.length}대`, '#4F46E5'],
    ['사용중', `${using}대`, '#8B5CF6'],
  ].map(([l,v,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:20px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8">${l}</div>
  </div>`).join('')}
</div>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  ${vehicles.map(v=>`
  <div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
    <span style="font-size:22px;flex-shrink:0">${v.icon}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:12px;font-weight:600">${v.name}</div>
      <div style="font-size:10px;color:#94A3B8">${v.type} · ${v.seats}인승 · ${v.fuel}</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;
                 background:${v.available?'#D1FAE5':'#FEE2E2'};color:${v.available?'#10B981':'#EF4444'}">
      ${v.available?'가용':'사용중'}
    </span>
  </div>`).join('')}
</div>`;
}

function _bindEvents() {
  _root.querySelectorAll('.va-approve').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const reqs = _getReqs(); const r=reqs.find(x=>x.id===btn.dataset.id); if(!r) return;
  if (!reqs||!reqs.length){_root.innerHTML=`<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:48px;margin-bottom:12px">🚗</div><div style="font-size:14px;font-weight:600;margin-bottom:6px">차량 예약이 없습니다.</div><div style="font-size:12px">데이터가 축적되면 자동으로 표시됩니다.</div></div>`;return;}
      r.status='approved'; _saveReqs(reqs);
      showToast(`${r.empName} 예약이 승인됐습니다.`, 'success');
      addNotification({ type: 'success', title: '법인차량 승인 (관리자)', body: '예약이 승인됐습니다.' });
      if (r.empId) addNotificationForUser(r.empId, { type: 'success', title: '법인차량 예약 승인', body: '법인차량 예약이 승인되었습니다.', route: '#/vehicle-request' });
      _draw();
    });
  });

  _root.querySelectorAll('.va-return').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const reqs=_getReqs(); const r=reqs.find(x=>x.id===btn.dataset.id); if(!r) return;
      r.status='returned';
      const vehicles=_getVehicles(); const v=vehicles.find(x=>x.id===btn.dataset.vid);
      if(v) v.available=true;
      _saveReqs(reqs); _saveVehicles(vehicles);
      showToast(`${r.empName} 반납 처리됐습니다.`, 'success')
      addNotification({ type: 'success', title: 'Vehicle (관리자)', body: '반납 처리됐습니다.' }); _draw();
    });
  });

  _root.querySelectorAll('.va-reject').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const reqs=_getReqs(); const r=reqs.find(x=>x.id===btn.dataset.id); if(!r) return;
      r.status='rejected'; _saveReqs(reqs);
      showToast(`반려 처리됐습니다.`, 'info');
      if (r.empId) addNotificationForUser(r.empId, { type: 'error', title: '법인차량 예약 반려', body: '법인차량 예약 신청이 반려되었습니다.', route: '#/vehicle-request' });
      _draw();
    });
  });
}
export function mount(root) { return render(root); }
