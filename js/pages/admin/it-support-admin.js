/**
 * it-support-admin.js — IT 지원 티켓 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_it_tickets';

const CATEGORIES = [
  { key:'hardware', label:'하드웨어', icon:'🖥️' },
  { key:'software', label:'소프트웨어', icon:'💻' },
  { key:'network',  label:'네트워크', icon:'📡' },
  { key:'account',  label:'계정/권한', icon:'🔑' },
  { key:'mobile',   label:'모바일 기기', icon:'📱' },
  { key:'other',    label:'기타', icon:'🔧' },
];

const LEGACY_IDS = new Set(['IT001', 'IT002', 'IT003', 'IT004', 'IT005']);

const STATUS_META = {
  open:       { label:'접수',    color:'#F59E0B' },
  inprogress: { label:'처리중',  color:'#3B82F6' },
  resolved:   { label:'처리 완료', color:'#10B981' },
  closed:     { label:'종료',    color:'#94A3B8' },
};

const PRIORITY_META = {
  low:    { label:'낮음', color:'#10B981' },
  medium: { label:'보통', color:'#F59E0B' },
  high:   { label:'높음', color:'#EF4444' },
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

let _tab      = 'open';
let _selId    = null;
let _root     = null;

export function render(root) { _root=root; _tab='open'; _selId=null; _draw(); }
export function unmount() { _root=null;
  _tab = 'open';
}

function _draw() {
  const tickets = _getAll();
  const openQ   = tickets.filter(t=>t.status==='open').length;

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['open',`미처리${openQ?` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${openQ}</span>`:''}`],['all','전체'],['closed','완료']].map(([k,l])=>`
    <button class="ita-tab" data-tab="${k}"
      style="padding:10px 14px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_selId ? _renderDetail(tickets.find(t=>t.id===_selId), tickets)
             : _renderList(tickets)}
  </div>
</div>`;

  _root.querySelectorAll('.ita-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _selId=null; _draw(); }));
  _bindEvents();
}

function _renderList(allTickets) {
  const filtered = _tab==='open'
    ? allTickets.filter(t=>t.status==='open'||t.status==='inprogress')
    : _tab==='closed'
    ? allTickets.filter(t=>t.status==='resolved'||t.status==='closed')
    : allTickets;
  const sorted = [...filtered].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));

  const openN   = allTickets.filter(t=>t.status==='open').length;
  const inprogN = allTickets.filter(t=>t.status==='inprogress').length;
  const doneN   = allTickets.filter(t=>t.status==='resolved'||t.status==='closed').length;

  return `
<!-- KPI -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
  ${[
    ['미처리', `${openN}건`, '#F59E0B'],
    ['처리중', `${inprogN}건`, '#3B82F6'],
    ['완료', `${doneN}건`, '#10B981'],
  ].map(([l,v,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:18px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8">${l}</div>
  </div>`).join('')}
</div>

${!sorted.length ? `
<div style="text-align:center;padding:40px;color:#94A3B8">
  <div style="font-size:32px;margin-bottom:8px">✅</div>
  <div style="font-size:13px">처리할 티켓이 없습니다.</div>
</div>` : sorted.map(t=>{
  const meta = STATUS_META[t.status];
  const pri  = PRIORITY_META[t.priority];
  const cat  = CATEGORIES.find(c=>c.key===t.category)||CATEGORIES[5];
  return `
<div class="ita-card" data-id="${t.id}"
  style="background:var(--card-bg);border:1px solid ${t.status==='open'?'#FCD34D':'var(--border)'};
       border-radius:14px;padding:14px;margin-bottom:10px;cursor:pointer">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div style="flex:1;min-width:0;padding-right:8px">
      <div style="font-size:13px;font-weight:700">${t.title}</div>
      <div style="font-size:10px;color:#94A3B8;margin-top:1px">${t.empName} · ${cat.icon} ${cat.label} · ${t.createdAt}</div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">
      <span style="font-size:11px;font-weight:700;color:${meta.color}">${meta.label}</span>
      <span style="font-size:10px;font-weight:700;color:${pri.color}">우선순위 ${pri.label}</span>
    </div>
  </div>
  <div style="font-size:11px;color:#64748B">${t.description.slice(0,60)}${t.description.length>60?'…':''}</div>
</div>`; }).join('')}`;
}

function _renderDetail(ticket, allTickets) {
  if (!ticket) return '';
  const meta = STATUS_META[ticket.status];
  const pri  = PRIORITY_META[ticket.priority];
  const cat  = CATEGORIES.find(c=>c.key===ticket.category)||CATEGORIES[5];

  return `
<button id="ita-back-detail"
  style="display:flex;align-items:center;gap:4px;background:none;border:none;cursor:pointer;
         font-size:12px;color:#64748B;padding:0;margin-bottom:12px">← 목록으로</button>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
    <div>
      <div style="font-size:14px;font-weight:700;margin-bottom:3px">${ticket.title}</div>
      <div style="font-size:11px;color:#94A3B8">${ticket.empName} · ${cat.icon} ${cat.label} · ${ticket.createdAt}</div>
    </div>
    <span style="font-size:11px;font-weight:700;color:${meta.color}">${meta.label}</span>
  </div>
  <div style="font-size:12px;color:#64748B;line-height:1.5;margin-bottom:12px">${ticket.description}</div>
  ${ticket.reply ? `
  <div style="background:#EFF6FF;border-radius:8px;padding:10px;margin-bottom:12px">
    <div style="font-size:11px;font-weight:700;color:#1D4ED8;margin-bottom:4px">💬 IT팀 답변</div>
    <div style="font-size:12px;color:#1E40AF">${ticket.reply}</div>
  </div>` : ''}

  ${ticket.status==='open'||ticket.status==='inprogress' ? `
  <div style="margin-bottom:10px">
    <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">답변 / 처리 내용</div>
    <textarea id="ita-reply" rows="3" placeholder="처리 내용을 입력하세요"
      style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
             background:var(--bg);color:var(--text);font-size:12px;resize:none;box-sizing:border-box">${ticket.reply||''}</textarea>
  </div>
  <div style="display:flex;gap:6px">
    <button id="ita-inprogress"
      style="flex:1;padding:8px;background:#3B82F6;color:#fff;border:none;border-radius:8px;
             font-size:12px;font-weight:700;cursor:pointer">처리중으로</button>
    <button id="ita-resolve"
      style="flex:1;padding:8px;background:#10B981;color:#fff;border:none;border-radius:8px;
             font-size:12px;font-weight:700;cursor:pointer">처리 완료</button>
  </div>` : ''}
</div>`;
}

function _bindEvents() {
  _root.querySelectorAll('.ita-card').forEach(card=>{
    card.addEventListener('click',()=>{ _selId=card.dataset.id; _draw(); });
  });

  _root.querySelector('#ita-back-detail')?.addEventListener('click',()=>{ _selId=null; _draw(); });

  _root.querySelector('#ita-inprogress')?.addEventListener('click',()=>{
    const tickets=_getAll(); const t=tickets.find(x=>x.id===_selId); if(!t) return;
    t.status='inprogress';
    const reply=_root.querySelector('#ita-reply')?.value.trim();
    if(reply) t.reply=reply;
    _save(tickets); showToast('처리중 상태로 변경됐습니다.', 'success')
      addNotification({ type: 'success', title: 'It Support (관리자)', body: '처리중 상태로 변경됐습니다.' }); _draw();
  });

  _root.querySelector('#ita-resolve')?.addEventListener('click',()=>{
    const tickets=_getAll(); const t=tickets.find(x=>x.id===_selId); if(!t) return;
    t.status='resolved';
    const reply=_root.querySelector('#ita-reply')?.value.trim();
    if(reply) t.reply=reply;
    _save(tickets); showToast('처리 완료 처리됐습니다.', 'success')
      addNotification({ type: 'success', title: 'It Support (관리자)', body: '처리 완료 처리됐습니다.' }); _selId=null; _draw();
  });
}
export function mount(root) { return render(root); }
