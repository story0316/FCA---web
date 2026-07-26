/**
 * personnel-order.js — 인사발령 확인 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_personnel_orders';

const TYPE_META = {
  promotion:  { label:'승진',   icon:'⬆️', color:'#10B981' },
  transfer:   { label:'전배',   icon:'🔄', color:'#3B82F6' },
  department: { label:'부서 이동', icon:'🏢', color:'#8B5CF6' },
  title:      { label:'직책 변경', icon:'🏷️', color:'#F59E0B' },
  salary:     { label:'연봉 조정', icon:'💰', color:'#EC4899' },
  other:      { label:'기타',   icon:'📋', color:'var(--text-muted)' },
};

function _session() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}'); } catch { return {}; } }
function _empId()   { return _session().empId || _session().userId || 'EMP001'; }
function _uname()   { return _session().name || '직원'; }
function _udept()   { return _session().dept || _session().department || '일반'; }

function _demoOrders() {
  const uid = _empId(); const name = _uname(); const dept = _udept();
  return [
    { id:`PO_${uid}_1`, empId:uid, empName:name, type:'promotion',  effectiveDate:'2026-04-01', fromValue:'사원', toValue:'대리',   dept, note:'연간 우수 성과 반영', status:'active', issuedAt:'2026-03-20' },
    { id:`PO_${uid}_2`, empId:uid, empName:name, type:'transfer',   effectiveDate:'2025-01-01', fromValue:'전팀', toValue:dept,     dept, note:'팀 재편에 따른 인사 발령', status:'active', issuedAt:'2024-12-15' },
    { id:`PO_${uid}_3`, empId:uid, empName:name, type:'salary',     effectiveDate:'2026-01-01', fromValue:'4,200만', toValue:'4,500만', dept, note:'연간 고과 반영 급여 조정', status:'active', issuedAt:'2025-12-20' },
  ];
}

function _getOrders() {
  const demo = _demoOrders();
  try {
    const saved = JSON.parse(localStorage.getItem(LS)||'[]');
    return [...demo.filter(d => !saved.find(x => x.id === d.id)), ...saved];
  } catch { return demo; }
}

let _root = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _root=root; _render(); }
export function unmount() { _root=null; }

function _render() {
  const myId     = _empId();
  const allOrders = _getOrders();
  // Merge demo orders for current user
  const myOrders  = [
    ..._demoOrders().filter(d=>d.empId===myId&&!allOrders.find(o=>o.id===d.id)),
    ...allOrders.filter(o=>o.empId===myId),
  ].sort((a,b)=>b.effectiveDate.localeCompare(a.effectiveDate));

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="po-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">📋 인사발령 내역</div>
      <div style="font-size:11px;color:var(--text-muted)">총 ${myOrders.length}건</div>
    </div>
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_renderOrders(myOrders)}
  </div>
</div>`;

  _root.querySelector('#po-back').addEventListener('click', ()=>window.navBack());
}

function _renderOrders(orders) {
  if (!orders.length) return `
<div style="text-align:center;padding:60px 16px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">📋</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:4px">인사발령 내역이 없습니다</div>
      <button onclick="location.hash='#/personnel-order'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">인사발령 조회</button>
    
  <div style="font-size:12px">인사발령 사항이 있으면 이 화면에 표시됩니다</div>
</div>`;

  const latest = orders[0];

  return `
<!-- 최근 발령 강조 -->
${latest ? (() => {
  const meta = TYPE_META[latest.type]||TYPE_META.other;
  return `
<div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border-radius:16px;padding:16px;margin-bottom:16px;color:#fff">
  <div style="font-size:11px;opacity:0.8;margin-bottom:4px">최근 인사발령</div>
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
    <span style="font-size:24px">${meta.icon}</span>
    <div>
      <div style="font-size:16px;font-weight:800">${meta.label}</div>
      <div style="font-size:12px;opacity:0.8">발령일: ${latest.effectiveDate}</div>
    </div>
  </div>
  <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:8px;font-size:12px">
    ${latest.fromValue} → ${latest.toValue}
  </div>
</div>`; })() : ''}

<!-- 전체 내역 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700">발령 이력</div>
  ${orders.map((o,i)=>{
    const meta = TYPE_META[o.type]||TYPE_META.other;
    return `
  <div style="padding:12px 14px;border-bottom:1px solid var(--border)${i===0?';background:#F8FAFF':''}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:16px">${meta.icon}</span>
        <span style="font-size:13px;font-weight:700;color:${meta.color}">${meta.label}</span>
        ${i===0?`<span style="font-size:10px;background:#EEF2FF;color:#4F46E5;padding:1px 6px;border-radius:99px;font-weight:700">최근</span>`:''}
      </div>
      <span style="font-size:11px;color:var(--text-muted)">${o.effectiveDate}</span>
    </div>
    <div style="font-size:12px;font-weight:600;margin-bottom:2px">${o.fromValue} → ${o.toValue}</div>
    <div style="font-size:11px;color:var(--text-muted)">${o.dept} · ${o.note}</div>
  </div>`; }).join('')}
</div>`;
}
