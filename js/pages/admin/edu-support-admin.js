/**
 * edu-support-admin.js — 교육비 지원 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification, addNotificationForUser } from '../../components/notification-hub.js';

const LS = 'hr_edu_support';

const SUPPORT_TYPES = [
  { key:'language', label:'어학원·자격증', icon:'🌍' },
  { key:'graduate', label:'대학원 학비',   icon:'🎓' },
  { key:'seminar',  label:'세미나·컨퍼런스', icon:'🎤' },
  { key:'online',   label:'온라인 강의',   icon:'💻' },
  { key:'book',     label:'도서 구매',     icon:'📚' },
  { key:'cert',     label:'자격증 시험',   icon:'📋' },
];

const LEGACY_RECORDS = new Map([
  ['ES001', ['김민준', 'Coursera Machine Learning']],
  ['ES002', ['박지호', '영단기 토익 정규반']],
  ['ES003', ['이서연', 'HR Tech 컨퍼런스 2026']],
  ['ES004', ['정유리', 'AWS Solutions Architect']],
]);

const STATUS_META = {
  pending:  { label:'검토 중', color:'#F59E0B', bg:'#FEF3C7' },
  approved: { label:'승인',   color:'#10B981', bg:'#ECFDF5' },
  rejected: { label:'반려',   color:'#EF4444', bg:'#FEF2F2' },
  paid:     { label:'지급 완료', color:'#3B82F6', bg:'#EFF6FF' },
};

function _getAll() {
  try {
    const d = JSON.parse(localStorage.getItem(LS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => {
      const signature = LEGACY_RECORDS.get(r.id);
      return !signature || r.empName !== signature[0] || r.courseName !== signature[1];
    });
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
    ${[['pending',`대기${pending?` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending}</span>`:''}`],['all','전체 내역']].map(([k,l])=>`
    <button class="esa-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_renderList(all)}
  </div>
</div>`;

  _root.querySelectorAll('.esa-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderList(all) {
  const filtered = _tab==='pending' ? all.filter(r=>r.status==='pending')
    : [...all].sort((a,b)=>b.reqDate.localeCompare(a.reqDate));

  const pendN  = all.filter(r=>r.status==='pending').length;
  const apprN  = all.filter(r=>r.status==='approved'||r.status==='paid').length;
  const totalAmt = all.filter(r=>r.status==='approved'||r.status==='paid').reduce((s,r)=>s+r.amount,0);

  return `
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
  ${[['대기',`${pendN}건`,'#F59E0B'],['승인',`${apprN}건`,'#10B981'],['지원액',`${(totalAmt/10000).toFixed(0)}만원`,'#4F46E5']].map(([l,v,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:16px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8">${l}</div>
  </div>`).join('')}
</div>

${!filtered.length ? `
<div style="text-align:center;padding:48px 20px;color:#94A3B8">
  <div style="font-size:36px;margin-bottom:10px">🎓</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:4px">${_tab==='pending' ? '대기 중인 신청이 없습니다.' : '교육비 지원 신청 내역이 없습니다.'}</div>
  <div style="font-size:12px">직원이 교육비 지원을 신청하면 여기에 표시됩니다.</div>
</div>` : filtered.map(r=>{
  const meta = STATUS_META[r.status]||STATUS_META.pending;
  const type = SUPPORT_TYPES.find(t=>t.key===r.type);
  return `
<div style="background:var(--card-bg);border:1px solid ${r.status==='pending'?'#FCD34D':'var(--border)'};border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div>
      <div style="font-size:13px;font-weight:700">${r.empName}</div>
      <div style="font-size:11px;color:#94A3B8">${type?type.icon+' '+type.label:r.type} · ${r.reqDate}</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;
                 background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>
  <div style="font-size:12px;font-weight:600;margin-bottom:4px">${r.courseName}</div>
  <div style="font-size:14px;font-weight:800;color:#4F46E5;margin-bottom:6px">${r.amount.toLocaleString()}원</div>
  ${r.reason?`<div style="font-size:11px;color:#64748B;background:var(--bg);border-radius:8px;padding:8px;margin-bottom:${r.status==='pending'?'10':'0'}px">${r.reason}</div>`:''}
  ${r.status==='pending' ? `
  <div style="display:flex;gap:6px">
    <button class="esa-approve" data-id="${r.id}"
      style="flex:1;padding:8px;background:#10B981;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">승인</button>
    <button class="esa-reject" data-id="${r.id}"
      style="flex:1;padding:8px;background:none;border:1px solid #EF4444;color:#EF4444;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">반려</button>
  </div>` : ''}
  ${r.status==='approved' ? `
  <button class="esa-pay" data-id="${r.id}"
    style="width:100%;padding:8px;background:#3B82F6;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">지급 처리</button>` : ''}
</div>`; }).join('')}`;
}

function _bindEvents() {
  _root.querySelectorAll('.esa-approve').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const all=_getAll(); const r=all.find(x=>x.id===btn.dataset.id); if(!r) return;
      r.status='approved'; _saveAll(all);
      showToast(`${r.empName} 교육비 지원 승인됐습니다.`, 'success');
      addNotification({ type: 'success', title: '교육비 지원 승인 (관리자)', body: '교육비 지원 승인됐습니다.' });
      if (r.empId) addNotificationForUser(r.empId, { type: 'success', title: '교육비 지원 승인', body: '교육비 지원 신청이 승인되었습니다.', route: '#/edu-support' });
      _draw();
    });
  });

  _root.querySelectorAll('.esa-reject').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const all=_getAll(); const r=all.find(x=>x.id===btn.dataset.id); if(!r) return;
      r.status='rejected'; _saveAll(all);
      showToast('반려 처리됐습니다.', 'info');
      if (r.empId) addNotificationForUser(r.empId, { type: 'error', title: '교육비 지원 반려', body: '교육비 지원 신청이 반려되었습니다.', route: '#/edu-support' });
      _draw();
    });
  });

  _root.querySelectorAll('.esa-pay').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const all=_getAll(); const r=all.find(x=>x.id===btn.dataset.id); if(!r) return;
      r.status='paid'; _saveAll(all);
      showToast('지급 완료 처리됐습니다.', 'success')
      addNotification({ type: 'success', title: 'Edu Support (관리자)', body: '지급 완료 처리됐습니다.' }); _draw();
    });
  });
}
export function mount(root) { return render(root); }
