/**
 * study-group-admin.js — 스터디 그룹 관리 (관리자)
 */
import { showToast } from '../../components/toast.js'
import { addNotification } from '../../components/notification-hub.js';

const LS_GROUPS  = 'hr_study_groups';
const LS_MEMBERS = 'hr_study_members';

const LEGACY_GROUP_IDS = new Set(['SG001','SG002','SG003','SG004']);

const LEGACY_MEMBER_IDS = new Set(['SGM001','SGM002','SGM003','SGM004','SGM005']);

function _getGroups() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_GROUPS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_GROUP_IDS.has(r.id));
    if (cleaned.length !== list.length) _saveGroups(cleaned);
    return cleaned;
  } catch { return []; }
}
function _saveGroups(l) { localStorage.setItem(LS_GROUPS, JSON.stringify(l)); }
function _getMembers() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_MEMBERS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_MEMBER_IDS.has(r.id));
    if (cleaned.length !== list.length) localStorage.setItem(LS_MEMBERS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}

let _tab    = 'groups';
let _selGrp = null;
let _root   = null;

export function render(root) { _root=root; _tab='groups'; _selGrp=null; _draw(); }
export function unmount() { _root=null;
  _tab = 'groups';
}

function _draw() {
  const groups  = _getGroups();
  const members = _getMembers();

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['groups','스터디 목록'],['members','멤버 현황']].map(([k,l])=>`
    <button class="sga-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='groups' ? _renderGroups(groups, members) : _renderMembers(groups, members)}
  </div>
</div>`;

  _root.querySelectorAll('.sga-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _selGrp=null; _draw(); }));
  _bindEvents();
}

function _renderGroups(groups, members) {
  const active = groups.filter(g=>g.status==='open').length;
  const total  = members.length;

  return `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
  ${[['스터디 수',`${groups.length}개`,'#4F46E5'],['총 멤버',`${total}명`,'#10B981']].map(([l,v,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:20px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8">${l}</div>
  </div>`).join('')}
</div>

${groups.map(g=>{
  const cnt = members.filter(m=>m.groupId===g.id).length;
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px">
    <span style="font-size:24px;flex-shrink:0">${g.icon}</span>
    <div style="flex:1">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
        <span style="font-size:13px;font-weight:700">${g.title}</span>
        <span style="font-size:10px;background:#EEF2FF;color:#4F46E5;padding:1px 6px;border-radius:99px">${g.category}</span>
      </div>
      <div style="font-size:11px;color:#94A3B8">리더: ${g.leaderName} · ${g.day}</div>
    </div>
    <span style="font-size:11px;font-weight:700;color:${g.status==='open'?'#10B981':'#94A3B8'}">${g.status==='open'?'운영중':'종료'}</span>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px">
    <span style="color:#94A3B8">멤버 ${cnt}/${g.capacity}명</span>
    ${g.status==='open' ? `
    <button class="sga-close" data-id="${g.id}"
      style="padding:3px 8px;font-size:10px;border:1px solid #94A3B8;color:#94A3B8;background:none;border-radius:6px;cursor:pointer">종료</button>` : ''}
  </div>
</div>`; }).join('')}`;
}

function _renderMembers(groups, members) {
  const filtered = _selGrp ? members.filter(m=>m.groupId===_selGrp) : members;
  return `
<div style="margin-bottom:10px">
  <select id="sga-filter"
    style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
           background:var(--bg);color:var(--text);font-size:12px">
    <option value="">전체 스터디</option>
    ${groups.map(g=>`<option value="${g.id}" ${_selGrp===g.id?'selected':''}>${g.title}</option>`).join('')}
  </select>
</div>
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700">
    ${_selGrp ? groups.find(g=>g.id===_selGrp)?.title : '전체'} · ${filtered.length}명
  </div>
  ${!filtered.length ? `<div style="padding:24px;text-align:center;color:#94A3B8;font-size:12px">멤버가 없습니다.</div>` :
  filtered.map(m=>{
    const g = groups.find(x=>x.id===m.groupId);
    return `
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:12px;font-weight:600">${m.empName}${g&&g.leader===m.empId?' 👑':''}</div>
      ${!_selGrp?`<div style="font-size:10px;color:#94A3B8">${g?g.title:''}</div>`:''}
    </div>
    <span style="font-size:11px;color:#94A3B8">${m.joinedAt}</span>
  </div>`; }).join('')}
</div>`;
}

function _bindEvents() {
  _root.querySelector('#sga-filter')?.addEventListener('change',e=>{ _selGrp=e.target.value||null; _draw(); });

  _root.querySelectorAll('.sga-close').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const groups=_getGroups(); const g=groups.find(x=>x.id===btn.dataset.id); if(!g) return;
      g.status='closed'; _saveGroups(groups);
      showToast('스터디가 종료됐습니다.', 'info');
    addNotification({ type: 'info', title: '스터디 그룹 관리', body: '스터디가 종료됐습니다.' }); _draw();
    });
  });
}
export function mount(root) { return render(root); }
