/**
 * overseas-admin.js — 해외 파견·연수 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification, addNotificationForUser } from '../../components/notification-hub.js';

const LS = 'hr_overseas_requests';

const LEGACY_IDS = new Set(['OV001', 'OV002', 'OV003']);

const STATUS_META = {
  pending:  { label:'검토 중', color:'#F59E0B', bg:'#FEF3C7' },
  approved: { label:'승인',   color:'#10B981', bg:'#ECFDF5' },
  rejected: { label:'반려',   color:'#EF4444', bg:'#FEF2F2' },
  ongoing:  { label:'진행 중', color:'#3B82F6', bg:'#EFF6FF' },
  completed:{ label:'완료',   color:'#94A3B8', bg:'#F1F5F9' },
};

function _getAll() {
  try {
    const d = JSON.parse(localStorage.getItem(LS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_IDS.has(r.id));
    if (cleaned.length !== list.length) _saveAll(cleaned);
    return cleaned;
  } catch { return []; }
}
function _saveAll(l) { localStorage.setItem(LS, JSON.stringify(l)); }

let _tab  = 'pending';
let _root = null;

export function render(root) { _root=root; _tab='pending'; _draw(); }
export function unmount() { _root=null;
  _tab = 'pending';
}

function _draw() {
  const all = _getAll();
  const pending = all.filter(r=>r.status==='pending').length;

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['pending',`대기${pending?` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending}</span>`:''}`],['approved','승인'],['all','전체']].map(([k,l])=>`
    <button class="ova-tab" data-tab="${k}" style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;white-space:nowrap;border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">${_renderList(all)}</div>
</div>`;

  _root.querySelectorAll('.ova-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderList(all) {
  const filtered = _tab==='pending' ? all.filter(r=>r.status==='pending') : _tab==='approved' ? all.filter(r=>r.status==='approved'||r.status==='ongoing') : [...all].sort((a,b)=>b.reqDate.localeCompare(a.reqDate));
  const pend=all.filter(r=>r.status==='pending').length, appr=all.filter(r=>r.status==='approved'||r.status==='ongoing').length;
  return `
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
  ${[['대기',`${pend}건`,'#F59E0B'],['승인',`${appr}건`,'#10B981'],['전체',`${all.length}건`,'#4F46E5']].map(([l,v,c])=>`<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800;color:${c}">${v}</div><div style="font-size:10px;color:#94A3B8">${l}</div></div>`).join('')}
</div>
${!filtered.length?`<div style="text-align:center;padding:40px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">✈️</div><div style="font-size:13px">해당 신청이 없습니다.</div></div>`:filtered.map(r=>{
  const meta=STATUS_META[r.status]||STATUS_META.pending;
  return `<div style="background:var(--card-bg);border:1px solid ${r.status==='pending'?'#FCD34D':'var(--border)'};border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;margin-bottom:8px">
    <div><div style="font-size:13px;font-weight:700">${r.empName} · ${r.destination}</div><div style="font-size:11px;color:#94A3B8">${r.typeLabel} · ${r.startDate}~${r.endDate}</div></div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>
  ${r.purpose?`<div style="font-size:11px;color:#64748B;background:var(--bg);border-radius:8px;padding:8px;margin-bottom:${r.status==='pending'?'10':'0'}px">${r.purpose}</div>`:''}
  ${r.status==='pending'?`<div style="display:flex;gap:6px"><button class="ova-approve" data-id="${r.id}" style="flex:1;padding:8px;background:#10B981;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">승인</button><button class="ova-reject" data-id="${r.id}" style="flex:1;padding:8px;background:none;border:1px solid #EF4444;color:#EF4444;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">반려</button></div>`:''}
</div>`; }).join('')}`;
}

function _bindEvents() {
  _root.querySelectorAll('.ova-approve').forEach(btn=>btn.addEventListener('click',()=>{
    const all=_getAll(); const r=all.find(x=>x.id===btn.dataset.id); if(!r) return;
    r.status='approved'; _saveAll(all);
    showToast(`${r.empName} 해외 파견·연수 승인됐습니다.`, 'success');
    addNotification({ type: 'success', title: '해외파견 승인 (관리자)', body: `${r.empName} 해외 파견·연수 승인됐습니다.` });
    if (r.empId) addNotificationForUser(r.empId, { type: 'success', title: '해외파견 신청 승인', body: `${r.typeLabel || '해외파견'} 신청이 승인되었습니다. (${r.destination})`, route: '#/overseas' });
    _draw();
  }));
  _root.querySelectorAll('.ova-reject').forEach(btn=>btn.addEventListener('click',()=>{
    const all=_getAll(); const r=all.find(x=>x.id===btn.dataset.id); if(!r) return;
    r.status='rejected'; _saveAll(all);
    showToast('반려 처리됐습니다.', 'info');
    addNotification({ type: 'error', title: '해외파견 반려 (관리자)', body: `${r.empName} 해외파견 신청이 반려됐습니다.` });
    if (r.empId) addNotificationForUser(r.empId, { type: 'error', title: '해외파견 신청 반려', body: `${r.typeLabel || '해외파견'} 신청이 반려되었습니다.`, route: '#/overseas' });
    _draw();
  }));
}
export function mount(root) { return render(root); }
