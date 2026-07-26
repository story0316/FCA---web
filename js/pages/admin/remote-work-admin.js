/**
 * remote-work-admin.js — 재택근무 관리 (관리자)
 * export function render(root) + export function unmount()
 */

import { showToast } from '../../components/toast.js';
import { addNotification, addNotificationForUser } from '../../components/notification-hub.js';

const LS = 'hr_remote_work';

const WORK_TYPES = [
  { key:'wfh',    label:'재택근무', icon:'🏠' },
  { key:'hybrid', label:'거점 근무',icon:'📍' },
  { key:'field',  label:'외근',     icon:'🚗' },
];

const STATUS_META = {
  pending:  { label:'검토 중', color:'#F59E0B', bg:'#FEF3C7' },
  approved: { label:'승인',   color:'#10B981', bg:'#D1FAE5' },
  rejected: { label:'반려',   color:'#EF4444', bg:'#FEE2E2' },
};

const THIS_MONTH = new Date().toISOString().slice(0,7);

function _getAll() { try { return JSON.parse(localStorage.getItem(LS)||'[]'); } catch { return []; } }
function _save(l)  { localStorage.setItem(LS, JSON.stringify(l)); }

let _filter = 'pending';

export function render(root) { _filter='pending'; _draw(root); }
export function unmount() { _filter='pending'; }

function _draw(root) {
  const all = _getAll().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const pendingCnt  = all.filter(r=>r.status==='pending').length;
  const approvedCnt = all.filter(r=>r.status==='approved').length;

  // 이번 달 재택 일수 집계 (팀원별)
  const monthlyMap = {};
  all.filter(r=>r.status==='approved').forEach(r=>{
    const days = (r.dates||[]).filter(d=>d.startsWith(THIS_MONTH)).length;
    if (days) monthlyMap[r.empName] = (monthlyMap[r.empName]||0)+days;
  });
  const topUsers = Object.entries(monthlyMap).sort((a,b)=>b[1]-a[1]).slice(0,5);

  const filtered = _filter==='all' ? all : all.filter(r=>r.status===_filter);

  root.innerHTML = `
<!-- KPI -->
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
  ${[
    {label:'검토 대기', value:pendingCnt+'건',            color:'#F59E0B', key:'pending'},
    {label:'이번 달 승인', value:approvedCnt+'건',        color:'#10B981', key:'approved'},
    {label:'팀원 수',    value:new Set(all.map(r=>r.empId)).size+'명', color:'#4F46E5', key:'all'},
  ].map(k=>`
  <div class="rwa-filter" data-filter="${k.key}"
    style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
           padding:10px;text-align:center;cursor:pointer;
           border-bottom:3px solid ${_filter===k.key?k.color:'transparent'}">
    <div style="font-size:15px;font-weight:800;color:${k.color}">${k.value}</div>
    <div style="font-size:10px;color:#64748B;margin-top:1px">${k.label}</div>
  </div>`).join('')}
</div>

<!-- 이번 달 상위 재택 현황 -->
${topUsers.length ? `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="font-size:12px;font-weight:700;color:#64748B;margin-bottom:8px">${THIS_MONTH} 재택 현황 TOP</div>
  ${topUsers.map(([name,days])=>`
  <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
    <div style="font-size:12px;font-weight:600;color:var(--text)">${name}</div>
    <div style="display:flex;align-items:center;gap:6px">
      <div style="width:80px;background:#E2E8F0;border-radius:99px;height:4px">
        <div style="background:#4F46E5;height:4px;border-radius:99px;width:${Math.min(100,(days/8)*100)}%"></div>
      </div>
      <span style="font-size:11px;font-weight:700;color:${days>=8?'#EF4444':'#4F46E5'}">${days}일</span>
    </div>
  </div>`).join('')}
</div>` : ''}

<!-- 신청 목록 -->
${!filtered.length
  ? `<div style="text-align:center;padding:40px;color:#94A3B8;font-size:13px">신청 건이 없습니다.</div>`
  : filtered.map(r=>{
    const t = WORK_TYPES.find(x=>x.key===r.type)||{icon:'🏠',label:r.type};
    const s = STATUS_META[r.status]||STATUS_META.pending;
    const dateStr = r.dates?.length===1 ? r.dates[0] : `${r.dates?.[0]} ~ ${r.dates?.[r.dates.length-1]}`;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
      <span style="font-size:20px;flex-shrink:0">${t.icon}</span>
      <div style="min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--text)">${r.empName} · ${r.dept||''}</div>
        <div style="font-size:11px;color:#64748B;margin-top:1px">${t.label} · ${dateStr} (${r.dates?.length||0}일)</div>
      </div>
    </div>
    <span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:8px;
      color:${s.color};background:${s.bg};flex-shrink:0;margin-left:8px">${s.label}</span>
  </div>
  <div style="font-size:11px;color:#64748B;margin-bottom:8px;line-height:1.5">${r.reason}</div>
  ${r.status==='pending' ? `
  <div style="display:flex;gap:8px;align-items:center">
    <input class="rwa-comment" data-id="${r.id}" type="text" placeholder="의견 (선택)"
      style="flex:1;padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;background:var(--bg);color:var(--text)">
    <button class="rwa-approve" data-id="${r.id}"
      style="padding:7px 14px;background:#D1FAE5;color:#065F46;border:1px solid #6EE7B7;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">승인</button>
    <button class="rwa-reject" data-id="${r.id}"
      style="padding:7px 14px;background:#FEE2E2;color:#991B1B;border:1px solid #FCA5A5;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">반려</button>
  </div>` : r.comment ? `<div style="font-size:11px;font-weight:600;color:${s.color}">💬 ${r.comment}</div>` : ''}
</div>`;
  }).join('')}`;

  root.querySelectorAll('.rwa-filter').forEach(btn=>{
    btn.addEventListener('click',()=>{ _filter=btn.dataset.filter; _draw(root); });
  });

  root.querySelectorAll('.rwa-approve').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const id      = btn.dataset.id;
      const req     = _getAll().find(r=>r.id===id);
      const comment = root.querySelector(`.rwa-comment[data-id="${id}"]`)?.value.trim()||'승인되었습니다.';
      _setStatus(id,'approved',comment);
      showToast('승인 처리되었습니다.','success');
      addNotification({ type: 'success', title: '재택근무 승인 (관리자)', body: '재택근무 신청이 승인되었습니다.' });
      if (req?.empId) addNotificationForUser(req.empId, { type: 'success', title: '재택근무 신청 승인', body: '재택근무 신청이 승인되었습니다.', route: '#/remote-work' });
      _draw(root);
    });
  });

  root.querySelectorAll('.rwa-reject').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const id      = btn.dataset.id;
      const req     = _getAll().find(r=>r.id===id);
      const comment = root.querySelector(`.rwa-comment[data-id="${id}"]`)?.value.trim();
      if (!comment) { showToast('반려 사유를 입력하세요.','error'); return; }
      _setStatus(id,'rejected',comment);
      showToast('반려 처리되었습니다.','info');
      addNotification({ type: 'error', title: '재택근무 반려 (관리자)', body: '재택근무 신청이 반려되었습니다.' });
      if (req?.empId) addNotificationForUser(req.empId, { type: 'error', title: '재택근무 신청 반려', body: `재택근무 신청이 반려되었습니다. 사유: ${comment}`, route: '#/remote-work' });
      _draw(root);
    });
  });
}

function _setStatus(id, status, comment) {
  const list = _getAll();
  const idx  = list.findIndex(r=>r.id===id);
  if (idx!==-1) { list[idx].status=status; list[idx].comment=comment; _save(list); }
}
export function mount(root) { return render(root); }
