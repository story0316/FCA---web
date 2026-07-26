/**
 * team-building-admin.js — 팀 빌딩 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_team_building';

const STATUS_META = {
  pending:  { label:'검토 중', color:'#F59E0B', bg:'#FEF3C7' },
  approved: { label:'승인',   color:'#10B981', bg:'#ECFDF5' },
  rejected: { label:'반려',   color:'#EF4444', bg:'#FEF2F2' },
  completed:{ label:'완료',   color:'#94A3B8', bg:'#F1F5F9' },
};

const ACTIVITY_LABELS = { dinner:'팀 회식', sports:'스포츠 활동', workshop:'워크숍 여행', game:'게임·레크', culture:'문화·예술', etc:'기타' };

function _getAll() { try { return JSON.parse(localStorage.getItem(LS)||'[]'); } catch { return []; } }
function _saveAll(l) { localStorage.setItem(LS, JSON.stringify(l)); }

let _tab  = 'pending';
let _root = null;

export function render(root) { _root=root; _tab='pending'; _draw(); }
export function unmount() { _root=null;
  _tab = 'pending';
}

function _draw() {
  const all     = _getAll();
  const pending = all.filter(r=>r.status==='pending').length;

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['pending',`대기${pending?` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending}</span>`:''}`],['approved','승인'],['all','전체']].map(([k,l])=>`
    <button class="tba-tab" data-tab="${k}" style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;white-space:nowrap;border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">${_renderList(all)}</div>
</div>`;

  _root.querySelectorAll('.tba-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderList(all) {
  const filtered = _tab==='pending' ? all.filter(r=>r.status==='pending') : _tab==='approved' ? all.filter(r=>r.status==='approved'||r.status==='completed') : [...all].sort((a,b)=>b.reqDate.localeCompare(a.reqDate));
  const pend=all.filter(r=>r.status==='pending').length;
  const appr=all.filter(r=>r.status==='approved'||r.status==='completed').length;
  const totalBudget=all.filter(r=>r.status==='approved'||r.status==='completed').reduce((s,r)=>s+r.budget,0);
  return `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
  ${[['대기',`${pend}건`,'#F59E0B'],['승인',`${appr}건`,'#10B981']].map(([l,v,c])=>`<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:800;color:${c}">${v}</div><div style="font-size:10px;color:#94A3B8">${l}</div></div>`).join('')}
</div>
<div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border-radius:12px;padding:10px;margin-bottom:14px;color:#fff;text-align:center">
  <div style="font-size:10px;opacity:0.8">승인 예산 합계</div>
  <div style="font-size:18px;font-weight:800">${totalBudget.toLocaleString()}원</div>
</div>
${!filtered.length?`<div style="text-align:center;padding:40px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">🎊</div><div style="font-size:13px">해당 신청이 없습니다.</div></div>`:filtered.map(r=>{
  const meta=STATUS_META[r.status]||STATUS_META.pending;
  const typeLabel=ACTIVITY_LABELS[r.type]||r.type;
  return `<div style="background:var(--card-bg);border:1px solid ${r.status==='pending'?'#FCD34D':'var(--border)'};border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;margin-bottom:8px">
    <div><div style="font-size:13px;font-weight:700">${r.title}</div><div style="font-size:11px;color:#94A3B8">${r.empName} · ${r.dept} · ${typeLabel}</div></div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;background:var(--bg);border-radius:8px;padding:8px;font-size:11px;margin-bottom:${r.status==='pending'?'10':'0'}px">
    <div><span style="color:#94A3B8">예정일: </span><span style="font-weight:600">${r.eventDate}</span></div>
    <div><span style="color:#94A3B8">참가: </span><span style="font-weight:600">${r.headcount}명</span></div>
    <div><span style="color:#94A3B8">예산: </span><span style="font-weight:700;color:#4F46E5">${r.budget.toLocaleString()}원</span></div>
    <div><span style="color:#94A3B8">신청: </span><span>${r.reqDate}</span></div>
  </div>
  ${r.status==='pending'?`<div style="display:flex;gap:6px"><button class="tba-approve" data-id="${r.id}" style="flex:1;padding:8px;background:#10B981;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">승인</button><button class="tba-reject" data-id="${r.id}" style="flex:1;padding:8px;background:none;border:1px solid #EF4444;color:#EF4444;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">반려</button></div>`:''}
  ${r.status==='approved'?`<button class="tba-complete" data-id="${r.id}" style="width:100%;padding:7px;background:#10B981;color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">완료 처리</button>`:''}
</div>`; }).join('')}`;
}

function _bindEvents() {
  _root.querySelectorAll('.tba-approve').forEach(btn=>btn.addEventListener('click',()=>{
    const all=_getAll(); const r=all.find(x=>x.id===btn.dataset.id); if(!r) return;
    r.status='approved'; _saveAll(all); showToast(`${r.title} 팀 빌딩 승인됐습니다.`,'success')
      addNotification({ type: 'success', title: 'Team Building (관리자)', body: '팀 빌딩 승인됐습니다.' }); _draw();
  }));
  _root.querySelectorAll('.tba-reject').forEach(btn=>btn.addEventListener('click',()=>{
    const all=_getAll(); const r=all.find(x=>x.id===btn.dataset.id); if(!r) return;
    r.status='rejected'; _saveAll(all); showToast('반려 처리됐습니다.','info'); _draw();
  }));
  _root.querySelectorAll('.tba-complete').forEach(btn=>btn.addEventListener('click',()=>{
    const all=_getAll(); const r=all.find(x=>x.id===btn.dataset.id); if(!r) return;
    r.status='completed'; _saveAll(all); showToast('완료 처리됐습니다.','success')
      addNotification({ type: 'success', title: 'Team Building (관리자)', body: '완료 처리됐습니다.' }); _draw();
  }));
}
export function mount(root) { return render(root); }
