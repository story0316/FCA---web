/**
 * career-coaching-admin.js — 커리어 코칭 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS_REQS     = 'hr_coaching_requests';
const LS_SESSIONS = 'hr_coaching_sessions';

const COACHES = [
  { id:'COACH001', name:'이상훈 코치', title:'커리어 전문 코치', areas:['리더십 전환','커리어 설계','팀 관리'], avatar:'🎯', avail:true },
  { id:'COACH002', name:'박선영 코치', title:'직무 역량 전문가', areas:['기술 역량','직무 전환','성과 관리'],  avatar:'📊', avail:true },
  { id:'COACH003', name:'김태원 코치', title:'임원 코칭 전문가', areas:['임원 리더십','조직 변화','스트레스 관리'], avatar:'💡', avail:false },
];

const LEGACY_IDS = new Set(['CC001', 'CC002', 'CC003', 'CC004']);

const STATUS_META = {
  pending:   { label:'검토 중',  color:'#F59E0B', bg:'#FEF3C7' },
  scheduled: { label:'일정 확정', color:'#3B82F6', bg:'#EFF6FF' },
  completed: { label:'완료',     color:'#10B981', bg:'#ECFDF5' },
  cancelled: { label:'취소',     color:'#94A3B8', bg:'#F1F5F9' },
};

function _getReqs() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_REQS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_IDS.has(r.id));
    if (cleaned.length !== list.length) _saveReqs(cleaned);
    return cleaned;
  } catch { return []; }
}
function _saveReqs(l) { localStorage.setItem(LS_REQS, JSON.stringify(l)); }

let _tab  = 'requests';
let _root = null;

export function render(root) { _root=root; _tab='requests'; _draw(); }
export function unmount() { _root=null;
  _tab = 'requests';
}

function _draw() {
  const reqs    = _getReqs();
  const pending = reqs.filter(r=>r.status==='pending').length;

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['requests',`신청 목록${pending?` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending}</span>`:''}`],['coaches','코치 현황']].map(([k,l])=>`
    <button class="cca-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='requests' ? _renderRequests(reqs) : _renderCoaches(reqs)}
  </div>
</div>`;

  _root.querySelectorAll('.cca-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderRequests(reqs) {
  const pending   = reqs.filter(r=>r.status==='pending').length;
  const scheduled = reqs.filter(r=>r.status==='scheduled').length;
  const completed = reqs.filter(r=>r.status==='completed').length;

  const kpi = `
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
  ${[
    ['대기', `${pending}건`, '#F59E0B'],
    ['확정', `${scheduled}건`, '#3B82F6'],
    ['완료', `${completed}건`, '#10B981'],
  ].map(([l,v,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:18px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8">${l}</div>
  </div>`).join('')}
</div>`;

  if (!reqs.length) return kpi + `<div style="text-align:center;padding:48px 20px;color:#94A3B8"><div style="font-size:40px;margin-bottom:10px">🧑‍🏫</div><div style="font-size:14px;font-weight:600;margin-bottom:4px">코칭 신청이 없습니다</div><div style="font-size:12px">직원이 코칭을 신청하면 여기에 표시됩니다.</div></div>`;

  return kpi + [...reqs].sort((a,b)=>b.reqDate.localeCompare(a.reqDate)).map(r=>{
  const meta = STATUS_META[r.status]||STATUS_META.pending;
  return `
<div style="background:var(--card-bg);border:1px solid ${r.status==='pending'?'#FCD34D':'var(--border)'};border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div>
      <div style="font-size:13px;font-weight:700">${r.empName}</div>
      <div style="font-size:11px;color:#94A3B8">${r.coachName} · ${r.topic}</div>
      <div style="font-size:10px;color:#94A3B8;margin-top:1px">신청 ${r.reqDate}${r.prefDate?` · 희망 ${r.prefDate}`:''}</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;
                 background:${meta.bg};color:${meta.color};white-space:nowrap">${meta.label}</span>
  </div>
  <div style="font-size:11px;color:#64748B;margin-bottom:${r.status==='pending'||r.status==='scheduled'?'10':'0'}px;
              background:var(--bg);border-radius:8px;padding:8px">${r.goal}</div>
  ${r.sessionDate?`<div style="font-size:11px;color:#3B82F6;margin-bottom:10px">📅 확정 일시: ${r.sessionDate}</div>`:''}
  ${r.status==='pending' ? `
  <div style="display:flex;gap:6px;align-items:center">
    <input id="cca-date-${r.id}" type="datetime-local"
      style="flex:1;padding:6px 8px;border:1px solid var(--border);border-radius:8px;
             background:var(--bg);color:var(--text);font-size:11px">
    <button class="cca-schedule" data-id="${r.id}"
      style="padding:6px 12px;background:#3B82F6;color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">일정 확정</button>
    <button class="cca-cancel" data-id="${r.id}"
      style="padding:6px 10px;background:none;border:1px solid #94A3B8;color:#94A3B8;border-radius:8px;font-size:11px;cursor:pointer">취소</button>
  </div>` : ''}
  ${r.status==='scheduled' ? `
  <button class="cca-complete" data-id="${r.id}"
    style="width:100%;padding:8px;background:#10B981;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">세션 완료 처리</button>` : ''}
</div>`; }).join('');
}

function _renderCoaches(reqs) {
  return COACHES.map(c=>{
    const cReqs = reqs.filter(r=>r.coachId===c.id);
    const active = cReqs.filter(r=>r.status==='pending'||r.status==='scheduled').length;
    const done   = cReqs.filter(r=>r.status==='completed').length;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px">
    <div style="width:44px;height:44px;border-radius:50%;background:#EEF2FF;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${c.avatar}</div>
    <div style="flex:1">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
        <span style="font-size:14px;font-weight:700">${c.name}</span>
        <span style="font-size:10px;padding:1px 6px;border-radius:99px;font-weight:700;
                     background:${c.avail?'#D1FAE5':'#F1F5F9'};color:${c.avail?'#10B981':'#94A3B8'}">${c.avail?'활성':'비활성'}</span>
      </div>
      <div style="font-size:11px;color:#64748B">${c.title}</div>
    </div>
  </div>
  <div style="display:flex;gap:8px;margin-bottom:8px">
    ${[['진행중',active,'#3B82F6'],['완료',done,'#10B981'],['전체',cReqs.length,'#64748B']].map(([l,v,co])=>`
    <div style="flex:1;background:var(--bg);border-radius:8px;padding:8px;text-align:center">
      <div style="font-size:16px;font-weight:700;color:${co}">${v}</div>
      <div style="font-size:10px;color:#94A3B8">${l}</div>
    </div>`).join('')}
  </div>
  <div style="display:flex;gap:4px;flex-wrap:wrap">
    ${c.areas.map(a=>`<span style="font-size:10px;background:#EEF2FF;color:#4F46E5;padding:3px 8px;border-radius:99px">${a}</span>`).join('')}
  </div>
</div>`; }).join('');
}

function _bindEvents() {
  _root.querySelectorAll('.cca-schedule').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const dt = _root.querySelector(`#cca-date-${btn.dataset.id}`)?.value;
      if (!dt) { showToast('일시를 선택해 주세요.', 'error'); return; }
      const reqs=_getReqs(); const r=reqs.find(x=>x.id===btn.dataset.id); if(!r) return;
      r.status='scheduled'; r.sessionDate=dt.replace('T',' ');
      _saveReqs(reqs);
      showToast(`${r.empName} 코칭 일정이 확정됐습니다.`, 'success')
      addNotification({ type: 'success', title: 'Career Coaching (관리자)', body: '코칭 일정이 확정됐습니다.' }); _draw();
    });
  });

  _root.querySelectorAll('.cca-complete').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const reqs=_getReqs(); const r=reqs.find(x=>x.id===btn.dataset.id); if(!r) return;
      r.status='completed';
      _saveReqs(reqs);
      showToast('세션 완료 처리됐습니다.', 'success')
      addNotification({ type: 'success', title: 'Career Coaching (관리자)', body: '세션 완료 처리됐습니다.' }); _draw();
    });
  });

  _root.querySelectorAll('.cca-cancel').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const reqs=_getReqs(); const r=reqs.find(x=>x.id===btn.dataset.id); if(!r) return;
      r.status='cancelled';
      _saveReqs(reqs);
      showToast('신청이 취소됐습니다.', 'info'); _draw();
    });
  });
}
export function mount(root) { return render(root); }
