/**
 * flexible-work-admin.js — 유연근무 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification, addNotificationForUser } from '../../components/notification-hub.js';

const LS = 'hr_flexible_work';

const WORK_TYPES = [
  { key:'flextime',   label:'시차출퇴근',     icon:'⏰' },
  { key:'compressed', label:'주4일 근무',     icon:'📅' },
  { key:'halftime',   label:'반반차 활용',    icon:'🌗' },
  { key:'remote',     label:'재택+사무실 혼합', icon:'🏠' },
];

const LEGACY_IDS = new Set(['FW001', 'FW002', 'FW003', 'FW004', 'FW005']);

const STATUS_META = {
  pending:  { label:'검토 중', color:'#F59E0B' },
  approved: { label:'승인',   color:'#10B981' },
  rejected: { label:'반려',   color:'#EF4444' },
  expired:  { label:'종료',   color:'#94A3B8' },
};

function _getAll() {
  try {
    const d = JSON.parse(localStorage.getItem(LS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_IDS.has(r.id));
    if (cleaned.length !== list.length) _save(cleaned);
    return cleaned;
  } catch { return []; }
}
function _save(l) { localStorage.setItem(LS, JSON.stringify(l)); }

let _tab  = 'pending';
let _root = null;

export function render(root) { _root=root; _tab='pending'; _draw(); }
export function unmount() { _root=null;
  _tab = 'pending';
}

function _draw() {
  const reqs    = _getAll();
  const pending = reqs.filter(r=>r.status==='pending').length;

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['pending',`대기${pending?` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending}</span>`:''}`],['approved','승인 현황'],['all','전체']].map(([k,l])=>`
    <button class="fwa-tab" data-tab="${k}"
      style="padding:10px 14px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_renderList(reqs)}
  </div>
</div>`;

  _root.querySelectorAll('.fwa-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderList(reqs) {
  const filtered = _tab==='pending'
    ? reqs.filter(r=>r.status==='pending')
    : _tab==='approved'
    ? reqs.filter(r=>r.status==='approved')
    : [...reqs].sort((a,b)=>b.reqDate.localeCompare(a.reqDate));

  const pendN = reqs.filter(r=>r.status==='pending').length;
  const apprN = reqs.filter(r=>r.status==='approved').length;

  return `
<!-- KPI -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
  ${[
    ['대기', `${pendN}건`, '#F59E0B'],
    ['승인', `${apprN}건`, '#10B981'],
    ['전체', `${reqs.length}건`, '#4F46E5'],
  ].map(([l,v,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:18px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8">${l}</div>
  </div>`).join('')}
</div>

${!filtered.length ? `
<div style="text-align:center;padding:40px;color:#94A3B8">
  <div style="font-size:32px;margin-bottom:8px">⏰</div>
  <div style="font-size:13px">해당 신청이 없습니다.</div>
</div>` : filtered.map(r=>{
  const meta = STATUS_META[r.status];
  const wt   = WORK_TYPES.find(t=>t.key===r.workType)||WORK_TYPES[0];
  return `
<div style="background:var(--card-bg);border:1px solid ${r.status==='pending'?'#FCD34D':'var(--border)'};
     border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="display:flex;gap:8px;align-items:center">
      <span style="font-size:20px">${wt.icon}</span>
      <div>
        <div style="font-size:13px;font-weight:700">${r.empName} · ${wt.label}</div>
        <div style="font-size:11px;color:#94A3B8">${r.startDate} ~ ${r.endDate}</div>
      </div>
    </div>
    <span style="font-size:11px;font-weight:700;color:${meta.color}">${meta.label}</span>
  </div>
  <div style="font-size:11px;color:#64748B;margin-bottom:${r.status==='pending'?'10':'0'}px">
    ${r.reason}${r.schedule?` · ${r.schedule}`:''}
  </div>
  ${r.status==='pending' ? `
  <div style="display:flex;gap:6px">
    <button class="fwa-approve" data-id="${r.id}"
      style="flex:1;padding:8px;background:#10B981;color:#fff;border:none;border-radius:8px;
             font-size:12px;font-weight:700;cursor:pointer">승인</button>
    <button class="fwa-reject" data-id="${r.id}"
      style="flex:1;padding:8px;background:none;border:1px solid #EF4444;color:#EF4444;border-radius:8px;
             font-size:12px;font-weight:700;cursor:pointer">반려</button>
  </div>` : ''}
</div>`; }).join('')}`;
}

function _bindEvents() {
  _root.querySelectorAll('.fwa-approve').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const reqs=_getAll(); const r=reqs.find(x=>x.id===btn.dataset.id); if(!r) return;
      r.status='approved'; _save(reqs);
      showToast(`${r.empName} 유연근무 승인됐습니다.`, 'success');
      addNotification({ type: 'success', title: '유연근무 승인 (관리자)', body: `${r.empName} 유연근무 승인됐습니다.` });
      if (r.empId) addNotificationForUser(r.empId, { type: 'success', title: '유연근무 신청 승인', body: '유연근무 신청이 승인되었습니다.', route: '#/flexible-work' });
      _draw();
    });
  });

  _root.querySelectorAll('.fwa-reject').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const reqs=_getAll(); const r=reqs.find(x=>x.id===btn.dataset.id); if(!r) return;
      r.status='rejected'; _save(reqs);
      showToast('반려 처리됐습니다.', 'info');
      addNotification({ type: 'error', title: '유연근무 반려 (관리자)', body: `${r.empName} 유연근무 반려됐습니다.` });
      if (r.empId) addNotificationForUser(r.empId, { type: 'error', title: '유연근무 신청 반려', body: '유연근무 신청이 반려되었습니다.', route: '#/flexible-work' });
      _draw();
    });
  });
}
export function mount(root) { return render(root); }
