/**
 * counseling-admin.js — 심리 상담 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_counseling_requests';

const LEGACY_IDS = new Set(['CR001', 'CR002', 'CR003']);

const STATUS_META = {
  pending:   { label:'대기',  color:'#F59E0B', bg:'#FEF3C7' },
  confirmed: { label:'확정',  color:'#3B82F6', bg:'#EFF6FF' },
  completed: { label:'완료',  color:'#10B981', bg:'#ECFDF5' },
  cancelled: { label:'취소',  color:'#94A3B8', bg:'#F1F5F9' },
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
  const all     = _getAll();
  const pending = all.filter(r=>r.status==='pending').length;

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['pending',`대기${pending?` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending}</span>`:''}`],['all','전체']].map(([k,l])=>`
    <button class="csa-tab" data-tab="${k}" style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;white-space:nowrap;border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_renderList(all)}
  </div>
</div>`;

  _root.querySelectorAll('.csa-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderList(all) {
  const filtered = _tab==='pending' ? all.filter(r=>r.status==='pending') : [...all].sort((a,b)=>b.reqDate.localeCompare(a.reqDate));
  const pend=all.filter(r=>r.status==='pending').length, conf=all.filter(r=>r.status==='confirmed').length, done=all.filter(r=>r.status==='completed').length;
  return `
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
  ${[['대기',`${pend}건`,'#F59E0B'],['확정',`${conf}건`,'#3B82F6'],['완료',`${done}건`,'#10B981']].map(([l,v,c])=>`<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800;color:${c}">${v}</div><div style="font-size:10px;color:#94A3B8">${l}</div></div>`).join('')}
</div>
${!filtered.length?`<div style="text-align:center;padding:40px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">🧠</div><div style="font-size:13px">해당 예약이 없습니다.</div></div>`:filtered.map(r=>{
  const meta=STATUS_META[r.status]||STATUS_META.pending;
  return `<div style="background:var(--card-bg);border:1px solid ${r.status==='pending'?'#FCD34D':'var(--border)'};border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;margin-bottom:8px">
    <div><div style="font-size:13px;font-weight:700">${r.empName} · ${r.topic}</div><div style="font-size:11px;color:#94A3B8">${r.counselorName} · ${r.reqDate}</div></div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>
  ${r.prefDate?`<div style="font-size:11px;color:#64748B;margin-bottom:8px">희망 일시: ${r.prefDate}</div>`:''}
  ${r.status==='pending'?`<div style="display:flex;gap:6px;align-items:center"><input id="csa-dt-${r.id}" type="datetime-local" style="flex:1;padding:6px 8px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:11px" value="${r.prefDate?.replace(' ','T')||''}">
  <button class="csa-confirm" data-id="${r.id}" style="padding:6px 12px;background:#3B82F6;color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">일정 확정</button>
  <button class="csa-cancel" data-id="${r.id}" style="padding:6px 10px;background:none;border:1px solid #94A3B8;color:#94A3B8;border-radius:8px;font-size:11px;cursor:pointer">취소</button></div>`:''}
  ${r.status==='confirmed'?`<button class="csa-complete" data-id="${r.id}" style="width:100%;padding:8px;background:#10B981;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">상담 완료 처리</button>`:''}
</div>`; }).join('')}`;
}

function _bindEvents() {
  _root.querySelectorAll('.csa-confirm').forEach(btn=>btn.addEventListener('click',()=>{
    const dt=_root.querySelector(`#csa-dt-${btn.dataset.id}`)?.value;
    if (!dt) { showToast('일시를 선택해 주세요.','error'); return; }
    const all=_getAll(); const r=all.find(x=>x.id===btn.dataset.id); if(!r) return;
    r.status='confirmed'; r.confirmedDate=dt.replace('T',' '); _saveAll(all);
    showToast('상담 일정이 확정됐습니다.','success')
      addNotification({ type: 'success', title: 'Counseling (관리자)', body: '상담 일정이 확정됐습니다.' }); _draw();
  }));
  _root.querySelectorAll('.csa-complete').forEach(btn=>btn.addEventListener('click',()=>{
    const all=_getAll(); const r=all.find(x=>x.id===btn.dataset.id); if(!r) return;
    r.status='completed'; _saveAll(all); showToast('상담 완료 처리됐습니다.','success')
      addNotification({ type: 'success', title: 'Counseling (관리자)', body: '상담 완료 처리됐습니다.' }); _draw();
  }));
  _root.querySelectorAll('.csa-cancel').forEach(btn=>btn.addEventListener('click',()=>{
    const all=_getAll(); const r=all.find(x=>x.id===btn.dataset.id); if(!r) return;
    r.status='cancelled'; _saveAll(all); showToast('취소 처리됐습니다.','info'); _draw();
  }));
}
export function mount(root) { return render(root); }
