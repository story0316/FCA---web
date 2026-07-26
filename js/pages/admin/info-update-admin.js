/**
 * info-update-admin.js — 개인정보 변경 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification, addNotificationForUser } from '../../components/notification-hub.js';

const LS = 'hr_info_updates';

const FIELD_LABELS = { address:'주소', phone:'연락처', emergency:'비상연락처', bank:'계좌정보', family:'가족관계', other:'기타' };

const LEGACY_IDS = new Set(['IU001', 'IU002', 'IU003', 'IU004']);

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
    ${[['pending',`검토 대기${pending?` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending}</span>`:''}`],['approved','승인'],['all','전체']].map(([k,l])=>`
    <button class="iua-tab" data-tab="${k}" style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;white-space:nowrap;border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">${_renderList(all)}</div>
</div>`;

  _root.querySelectorAll('.iua-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderList(all) {
  const filtered = _tab==='pending' ? all.filter(r=>r.status==='pending') : _tab==='approved' ? all.filter(r=>r.status==='approved') : [...all].sort((a,b)=>b.reqDate.localeCompare(a.reqDate));
  const pend=all.filter(r=>r.status==='pending').length, appr=all.filter(r=>r.status==='approved').length, rej=all.filter(r=>r.status==='rejected').length;
  return `
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
  ${[['대기',`${pend}건`,'#F59E0B'],['승인',`${appr}건`,'#10B981'],['반려',`${rej}건`,'#EF4444']].map(([l,v,c])=>`<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800;color:${c}">${v}</div><div style="font-size:10px;color:#94A3B8">${l}</div></div>`).join('')}
</div>
${!filtered.length?`<div style="text-align:center;padding:40px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">📋</div><div style="font-size:13px">해당 신청이 없습니다.</div></div>`:filtered.map(r=>{
  const statusMeta={ pending:{label:'검토 중',color:'#F59E0B',bg:'#FEF3C7'}, approved:{label:'승인',color:'#10B981',bg:'#ECFDF5'}, rejected:{label:'반려',color:'#EF4444',bg:'#FEF2F2'} };
  const meta=statusMeta[r.status]||statusMeta.pending;
  return `<div style="background:var(--card-bg);border:1px solid ${r.status==='pending'?'#FCD34D':'var(--border)'};border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;margin-bottom:8px">
    <div><div style="font-size:13px;font-weight:700">${r.empName} · ${FIELD_LABELS[r.field]||r.field} 변경</div><div style="font-size:11px;color:#94A3B8">${r.dept} · ${r.reqDate}</div></div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>
  <div style="background:var(--bg);border-radius:8px;padding:8px;margin-bottom:${r.status==='pending'?'10':'0'}px;font-size:11px">
    <div style="color:#94A3B8;margin-bottom:2px">변경 전: <span style="color:var(--text)">${r.oldVal||'(없음)'}</span></div>
    <div style="color:#94A3B8">변경 후: <span style="color:#4F46E5;font-weight:700">${r.newVal}</span></div>
    ${r.note?`<div style="color:#64748B;margin-top:4px">${r.note}</div>`:''}
  </div>
  ${r.status==='pending'?`<div style="display:flex;gap:6px"><button class="iua-approve" data-id="${r.id}" style="flex:1;padding:8px;background:#10B981;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">승인</button><button class="iua-reject" data-id="${r.id}" style="flex:1;padding:8px;background:none;border:1px solid #EF4444;color:#EF4444;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">반려</button></div>`:''}
</div>`; }).join('')}`;
}

function _bindEvents() {
  _root.querySelectorAll('.iua-approve').forEach(btn=>btn.addEventListener('click',()=>{
    const all=_getAll(); const r=all.find(x=>x.id===btn.dataset.id); if(!r) return;
    r.status='approved'; _saveAll(all);

    // F-2: 승인된 변경 내용을 hr_user에 즉시 반영
    try {
      const userKey = 'hr_user';
      const hrUser = JSON.parse(localStorage.getItem(userKey) || '{}');
      const fieldMap = { phone:'phone', address:'address', emergency:'emergencyContact', bank:'bankAccount', family:'family' };
      const userField = fieldMap[r.field];
      if (userField) { hrUser[userField] = r.newVal; localStorage.setItem(userKey, JSON.stringify(hrUser)); }
      // hr_session 동기화 (phone, name, dept 등)
      const session = JSON.parse(localStorage.getItem('hr_session') || '{}');
      if (userField && session) { session[userField] = r.newVal; localStorage.setItem('hr_session', JSON.stringify(session)); }
      // 인사 이력 기록
      const history = JSON.parse(localStorage.getItem('hr_personnel_history') || '[]');
      history.unshift({
        id: 'PH_INFO_' + Date.now(), userId: r.empId, name: r.empName, dept: r.dept,
        type: 'title_change', prevValue: r.oldVal || '(없음)', newValue: r.newVal,
        effectiveDate: new Date().toISOString().slice(0, 10),
        memo: `개인정보 업데이트 — ${FIELD_LABELS[r.field] || r.field}`,
      });
      localStorage.setItem('hr_personnel_history', JSON.stringify(history));
    } catch {}

    showToast(`${r.empName} 개인정보 변경이 승인됐습니다.`, 'success');
    addNotification({ type: 'success', title: '개인정보 변경 승인 (관리자)', body: '개인정보 변경이 승인됐습니다.' });
    if (r.empId) addNotificationForUser(r.empId, { type: 'success', title: '개인정보 변경 승인', body: '개인정보 변경 신청이 승인되었습니다.', route: '#/info-update' });
    _draw();
  }));
  _root.querySelectorAll('.iua-reject').forEach(btn=>btn.addEventListener('click',()=>{
    const all=_getAll(); const r=all.find(x=>x.id===btn.dataset.id); if(!r) return;
    r.status='rejected'; _saveAll(all);
    showToast('반려 처리됐습니다.', 'info');
    if (r.empId) addNotificationForUser(r.empId, { type: 'error', title: '개인정보 변경 반려', body: '개인정보 변경 신청이 반려되었습니다.', route: '#/info-update' });
    _draw();
  }));
}
export function mount(root) { return render(root); }
