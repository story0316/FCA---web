/**
 * it-support.js — IT 지원 요청 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_it_tickets';

const CATEGORIES = [
  { key:'hardware', label:'하드웨어', icon:'🖥️' },
  { key:'software', label:'소프트웨어', icon:'💻' },
  { key:'network',  label:'네트워크', icon:'📡' },
  { key:'account',  label:'계정/권한', icon:'🔑' },
  { key:'mobile',   label:'모바일 기기', icon:'📱' },
  { key:'other',    label:'기타', icon:'🔧' },
];

const PRIORITIES = [
  { key:'low',    label:'낮음',  color:'#10B981' },
  { key:'medium', label:'보통',  color:'#F59E0B' },
  { key:'high',   label:'높음',  color:'#EF4444' },
];

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }

const STATUS_META = {
  open:       { label:'접수',    color:'#F59E0B', bg:'#FEF3C7' },
  inprogress: { label:'처리중',  color:'#3B82F6', bg:'#EFF6FF' },
  resolved:   { label:'처리 완료', color:'#10B981', bg:'#ECFDF5' },
  closed:     { label:'종료',    color:'var(--text-muted)', bg:'#F1F5F9' },
};

function _getAll() { try { return JSON.parse(localStorage.getItem(LS)||'[]'); } catch { return []; } }
function _save(l)  { localStorage.setItem(LS, JSON.stringify(l)); }

let _tab     = 'new';
let _selCat  = 'hardware';
let _selPri  = 'medium';
let _root    = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _root=root; _tab='new'; _selCat='hardware'; _selPri='medium'; _render(); }
export function unmount() { _tab = 'new'; _root=null; }

function _render() {
  const myTickets = _getAll().filter(t=>t.empId===_empId());
  const open      = myTickets.filter(t=>t.status==='open'||t.status==='inprogress').length;

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="it-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🖥️ IT 지원 요청</div>
      <div style="font-size:11px;color:var(--text-muted)">처리중 ${open}건</div>
    </div>
    ${open ? `<div style="background:#3B82F6;color:#fff;border-radius:99px;padding:3px 10px;font-size:12px;font-weight:700">${open}</div>` : ''}
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['new','새 요청'],['mine','내 티켓']].map(([k,l])=>`
    <button class="it-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='new' ? _renderNew() : _renderMine(myTickets)}
  </div>
</div>`;

  _root.querySelector('#it-back').addEventListener('click', ()=>window.navBack());
  _root.querySelectorAll('.it-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(); }));
  if (_tab==='new') _bindNew();
}

function _renderNew() {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:14px">IT 지원 요청서</div>

  <div style="margin-bottom:12px">
    <div style="font-size:11px;font-weight:600;margin-bottom:6px;color:var(--text-muted)">카테고리</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${CATEGORIES.map(c=>`
      <button class="it-cat" data-cat="${c.key}"
        style="padding:6px 10px;border-radius:8px;border:1.5px solid ${_selCat===c.key?'#4F46E5':'var(--border)'};
               background:${_selCat===c.key?'#EEF2FF':'var(--bg)'};cursor:pointer;font-size:11px;font-weight:600;
               color:${_selCat===c.key?'#4F46E5':'var(--text-muted)'}">${c.icon} ${c.label}</button>`).join('')}
    </div>
  </div>

  <div style="margin-bottom:12px">
    <div style="font-size:11px;font-weight:600;margin-bottom:6px;color:var(--text-muted)">우선순위</div>
    <div style="display:flex;gap:6px">
      ${PRIORITIES.map(p=>`
      <button class="it-pri" data-pri="${p.key}"
        style="flex:1;padding:7px;border-radius:8px;border:1.5px solid ${_selPri===p.key?p.color:'var(--border)'};
               background:${_selPri===p.key?p.color+'22':'var(--bg)'};cursor:pointer;font-size:11px;font-weight:700;
               color:${_selPri===p.key?p.color:'var(--text-muted)'}">${p.label}</button>`).join('')}
    </div>
  </div>

  <div style="margin-bottom:12px">
    <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">제목 *</div>
    <input id="it-title" type="text" placeholder="문제 제목을 간략히 입력하세요"
      style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
             background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
  </div>

  <div style="margin-bottom:14px">
    <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">상세 내용 *</div>
    <textarea maxlength="500" id="it-desc" rows="4" placeholder="증상, 오류 메시지, 발생 시점 등을 자세히 설명해 주세요"
      style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
             background:var(--bg);color:var(--text);font-size:12px;resize:none;box-sizing:border-box"></textarea>
  </div>

  <button id="it-submit"
    style="width:100%;padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;
           font-size:13px;font-weight:700;cursor:pointer">요청 접수</button>
</div>`;
}

function _renderMine(tickets) {
  const sorted = [...tickets].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  if (!sorted.length) return `
<div style="text-align:center;padding:48px 16px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">🖥️</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:4px">접수된 티켓이 없습니다</div>
      <button onclick="location.hash='#/it-support'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">IT 지원 요청</button>
    
  <div style="font-size:12px">IT 문제가 있으면 언제든 요청해 주세요!</div>
</div>`;

  return sorted.map(t=>{
    const meta = STATUS_META[t.status]||STATUS_META.open;
    const cat  = CATEGORIES.find(c=>c.key===t.category)||CATEGORIES[5];
    const pri  = PRIORITIES.find(p=>p.key===t.priority)||PRIORITIES[1];
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div style="flex:1;min-width:0;padding-right:8px">
      <div style="font-size:13px;font-weight:700">${t.title}</div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:1px">${cat.icon} ${cat.label} · ${t.createdAt}</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;
                 background:${meta.bg};color:${meta.color};flex-shrink:0">${meta.label}</span>
  </div>
  <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">${t.description}</div>
  ${t.reply ? `<div style="background:#EFF6FF;border-radius:6px;padding:8px;font-size:11px;color:#1D4ED8;margin-top:6px"><span style="font-weight:700">💬 IT팀: </span>${t.reply}</div>` : ''}
  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
    <span style="font-size:10px;font-weight:700" style="color:${pri.color}">• 우선순위: ${pri.label}</span>
  </div>
</div>`; }).join('');
}

function _bindNew() {
  _root.querySelectorAll('.it-cat').forEach(b=>b.addEventListener('click',()=>{ _selCat=b.dataset.cat; _render(); }));
  _root.querySelectorAll('.it-pri').forEach(b=>b.addEventListener('click',()=>{ _selPri=b.dataset.pri; _render(); }));

  _root.querySelector('#it-submit')?.addEventListener('click',()=>{
    const title = _root.querySelector('#it-title')?.value.trim();
    const desc  = _root.querySelector('#it-desc')?.value.trim();
    if (!title) { showToast('제목을 입력해 주세요.', 'error'); return; }
    if (!desc)  { showToast('상세 내용을 입력해 주세요.', 'error'); return; }
    const tickets = _getAll();
    tickets.push({
      id:          'IT_'+Date.now(),
      empId:       _empId(),
      empName:     _empName(),
      category:    _selCat,
      priority:    _selPri,
      title,
      description: desc,
      status:      'open',
      createdAt:   new Date().toISOString().slice(0,10),
      reply:       null,
    });
    _save(tickets);
    showToast('IT 지원 요청이 접수됐습니다.', 'success')
    addNotification({ type: 'success', title: 'IT 지원', body: 'IT 지원 요청이 접수됐습니다.' });
    _tab = 'mine';
    _render();
  });
}
