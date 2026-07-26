/**
 * trainer-admin.js — 사내 강사 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification, addNotificationForUser } from '../../components/notification-hub.js';

const LS_TRAINERS = 'hr_trainers';

const LEGACY_IDS = new Set(['TR001','TR002','TR003']);

function _getTrainers() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_TRAINERS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_IDS.has(r.id));
    if (cleaned.length !== list.length) _saveTrainers(cleaned);
    return cleaned;
  } catch { return []; }
}
function _saveTrainers(l) { localStorage.setItem(LS_TRAINERS, JSON.stringify(l)); }

let _tab  = 'pending';
let _root = null;

export function render(root) { _root=root; _tab='pending'; _draw(); }
export function unmount() { _root=null;
  _tab = 'pending';
}

function _draw() {
  const trainers = _getTrainers();
  const pending  = trainers.filter(t=>t.status==='pending').length;

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['pending',`승인 대기${pending?` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending}</span>`:''}`],['active','활동 중'],['all','전체']].map(([k,l])=>`
    <button class="tra-tab" data-tab="${k}" style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;white-space:nowrap;border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">${_renderList(trainers)}</div>
</div>`;

  _root.querySelectorAll('.tra-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderList(trainers) {
  const filtered = _tab==='pending' ? trainers.filter(t=>t.status==='pending') : _tab==='active' ? trainers.filter(t=>t.status==='active') : [...trainers].sort((a,b)=>b.appliedAt.localeCompare(a.appliedAt));
  const pend=trainers.filter(t=>t.status==='pending').length, act=trainers.filter(t=>t.status==='active').length;
  return `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
  ${[['대기',`${pend}명`,'#F59E0B'],['활동 중',`${act}명`,'#10B981']].map(([l,v,c])=>`<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:${c}">${v}</div><div style="font-size:10px;color:#94A3B8">${l}</div></div>`).join('')}
</div>
${!filtered.length?`<div style="text-align:center;padding:40px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">👨‍🏫</div><div style="font-size:13px">해당 강사가 없습니다.</div></div>`:filtered.map(t=>{
  const statusMeta={ pending:{label:'승인 대기',color:'#F59E0B',bg:'#FEF3C7'}, active:{label:'활동 중',color:'#10B981',bg:'#ECFDF5'}, inactive:{label:'비활동',color:'#94A3B8',bg:'#F1F5F9'} };
  const meta=statusMeta[t.status]||statusMeta.pending;
  return `<div style="background:var(--card-bg);border:1px solid ${t.status==='pending'?'#FCD34D':'var(--border)'};border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;margin-bottom:8px">
    <div><div style="font-size:13px;font-weight:700">${t.empName}</div><div style="font-size:11px;color:#94A3B8">${t.dept} · ${t.expertise}</div></div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">
    ${t.topics.map(tp=>`<span style="font-size:10px;background:#EEF2FF;color:#4F46E5;border-radius:4px;padding:2px 6px">${tp}</span>`).join('')}
  </div>
  ${t.status==='active'?`<div style="font-size:11px;color:#64748B;margin-bottom:8px">활동 이후 세션 ${t.sessions}회 · 활동 시작 ${t.activeSince}</div>`:''}
  ${t.status==='pending'?`<div style="display:flex;gap:6px"><button class="tra-approve" data-id="${t.id}" style="flex:1;padding:8px;background:#10B981;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">승인</button><button class="tra-reject" data-id="${t.id}" style="flex:1;padding:8px;background:none;border:1px solid #EF4444;color:#EF4444;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">거절</button></div>`:''}
  ${t.status==='active'?`<button class="tra-deactivate" data-id="${t.id}" style="width:100%;padding:7px;background:none;border:1px solid #94A3B8;color:#94A3B8;border-radius:8px;font-size:11px;cursor:pointer">비활성화</button>`:''}
</div>`; }).join('')}`;
}

function _bindEvents() {
  _root.querySelectorAll('.tra-approve').forEach(btn=>btn.addEventListener('click',()=>{
    const trainers=_getTrainers(); const t=trainers.find(x=>x.id===btn.dataset.id); if(!t) return;
    t.status='active'; t.activeSince=new Date().toISOString().slice(0,10); _saveTrainers(trainers);
    showToast(`${t.empName} 강사 승인됐습니다.`, 'success');
    addNotification({ type: 'success', title: '사내강사 승인 (관리자)', body: '강사 승인됐습니다.' });
    if (t.empId) addNotificationForUser(t.empId, { type: 'success', title: '사내강사 신청 승인', body: '사내강사 신청이 승인되었습니다.', route: '#/trainer' });
    _draw();
  }));
  _root.querySelectorAll('.tra-reject').forEach(btn=>btn.addEventListener('click',()=>{
    const trainers=_getTrainers(); const t=trainers.find(x=>x.id===btn.dataset.id); if(!t) return;
    t.status='rejected'; _saveTrainers(trainers);
    showToast('강사 신청이 거절됐습니다.', 'info');
    if (t.empId) addNotificationForUser(t.empId, { type: 'error', title: '사내강사 신청 반려', body: '사내강사 신청이 반려되었습니다.', route: '#/trainer' });
    _draw();
  }));
  _root.querySelectorAll('.tra-deactivate').forEach(btn=>btn.addEventListener('click',()=>{
    const trainers=_getTrainers(); const t=trainers.find(x=>x.id===btn.dataset.id); if(!t) return;
    t.status='inactive'; _saveTrainers(trainers); showToast('강사가 비활성화됐습니다.','info'); _draw();
  }));
}
export function mount(root) { return render(root); }
