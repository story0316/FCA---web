/**
 * team-calendar-admin.js — 팀 캘린더 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';

const LS = 'hr_team_calendar';

const EVENT_TYPES = [
  { key:'meeting',  label:'회의',      icon:'💬', color:'#4F46E5' },
  { key:'outing',   label:'외근·출장', icon:'🚗', color:'#F59E0B' },
  { key:'training', label:'교육·세미나',icon:'📚', color:'#8B5CF6' },
  { key:'deadline', label:'마감·납기', icon:'⚠️', color:'#EF4444' },
  { key:'event',    label:'행사·파티', icon:'🎉', color:'#EC4899' },
  { key:'vacation', label:'휴가',      icon:'🏖️', color:'#10B981' },
  { key:'etc',      label:'기타',      icon:'📅', color:'#64748B' },
];

const LEGACY_IDS = new Set(['CAL001','CAL002','CAL003','CAL004','CAL005']);

function _getEvents() {
  try {
    const d = JSON.parse(localStorage.getItem(LS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_IDS.has(r.id));
    if (cleaned.length !== list.length) _save(cleaned);
    return cleaned;
  } catch { return []; }
}
function _save(l) { localStorage.setItem(LS, JSON.stringify(l)); }

let _tab      = 'list';
let _showForm = false;
let _root     = null;
let _employees = [];

export async function mount(root) {
  _root = root; _tab='list'; _showForm=false;
  _employees = await loadDisplayEmployees().catch(() => []);
  _draw();
}
export function render(root) { _root = root; _tab='list'; _showForm=false; _draw(); }
export function unmount() { _root = null; _tab = 'list'; _employees = []; }

function _draw() {
  const events = _getEvents();
  const now    = new Date();
  const thisMonth = events.filter(e=>{
    const d = new Date(e.date);
    return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth();
  }).sort((a,b)=>a.date.localeCompare(b.date));
  const upcoming = events.filter(e=>new Date(e.date)>=now)
    .sort((a,b)=>a.date.localeCompare(b.date)).slice(0,20);

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['list','일정 목록'],['add','일정 등록']].map(([k,l])=>`
    <button class="tca-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='list' ? _renderList(thisMonth, upcoming, events) : _renderForm()}
  </div>
</div>`;

  _root.querySelectorAll('.tca-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderList(thisMonth, upcoming, allEvents) {
  const now = new Date();
  return `
<!-- KPI -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
  ${[
    ['이번달 일정', `${thisMonth.length}건`, '#4F46E5'],
    ['예정 일정', `${upcoming.length}건`, '#10B981'],
    ['전체 일정', `${allEvents.length}건`, '#64748B'],
  ].map(([l,v,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:18px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8;margin-top:1px">${l}</div>
  </div>`).join('')}
</div>

${thisMonth.length===0 && upcoming.length===0 ? `
<div style="text-align:center;padding:48px;color:#94A3B8">
  <div style="font-size:32px;margin-bottom:8px">📅</div>
  <div style="font-size:13px">등록된 일정이 없습니다.</div>
</div>` : `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700">
    예정 일정 (최근 ${Math.min(upcoming.length,20)}건)
  </div>
  ${upcoming.map(ev=>{
    const t = EVENT_TYPES.find(t=>t.key===ev.type)||EVENT_TYPES[6];
    return `
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
    <span style="font-size:18px;flex-shrink:0">${t.icon}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:12px;font-weight:600">${ev.title}</div>
      <div style="font-size:10px;color:#94A3B8">${ev.date}${ev.endDate&&ev.endDate!==ev.date?` ~ ${ev.endDate}`:''} · ${ev.empName}</div>
    </div>
    <button class="tca-del" data-id="${ev.id}"
      style="padding:4px 8px;font-size:10px;border:1px solid #EF4444;color:#EF4444;background:none;border-radius:6px;cursor:pointer">삭제</button>
  </div>`; }).join('')}
</div>`}`;
}

function _renderForm() {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:14px">새 일정 등록</div>

  <div style="margin-bottom:10px">
    <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">일정 제목 *</div>
    <input id="tca-title" type="text" placeholder="일정 제목 입력"
      style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
             background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
  </div>

  <div style="margin-bottom:10px">
    <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">유형</div>
    <select id="tca-type"
      style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
             background:var(--bg);color:var(--text);font-size:12px">
      ${EVENT_TYPES.map(t=>`<option value="${t.key}">${t.icon} ${t.label}</option>`).join('')}
    </select>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">시작일 *</div>
      <input id="tca-date" type="date"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
               background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
    </div>
    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">종료일</div>
      <input id="tca-enddate" type="date"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
               background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
    </div>
  </div>

  <div style="margin-bottom:14px">
    <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">대상자</div>
    <select id="tca-target"
      style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
             background:var(--bg);color:var(--text);font-size:12px">
      <option value="EMP_ALL">전체</option>
      ${_employees.map(e=>`<option value="${e.id}">${e.name}</option>`).join('')}
    </select>
  </div>

  <button id="tca-submit"
    style="width:100%;padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;
           font-size:13px;font-weight:700;cursor:pointer">일정 등록</button>
</div>`;
}

function _bindEvents() {
  _root.querySelectorAll('.tca-del').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const events = _getEvents();
      const idx    = events.findIndex(e=>e.id===btn.dataset.id);
      if (idx<0) return;
      const title  = events[idx].title;
      if (!confirm(`"${title}" 일정을 삭제하시겠습니까?`)) return;
      events.splice(idx,1);
      _save(events);
      showToast(`"${title}" 일정이 삭제됐습니다.`, 'info');
      _draw();
    });
  });

  _root.querySelector('#tca-submit')?.addEventListener('click',()=>{
    const title  = _root.querySelector('#tca-title')?.value.trim();
    const type   = _root.querySelector('#tca-type')?.value;
    const date   = _root.querySelector('#tca-date')?.value;
    const endDate= _root.querySelector('#tca-enddate')?.value || date;
    const target = _root.querySelector('#tca-target')?.value;
    const targetNames = Object.fromEntries([['EMP_ALL','전체'], ..._employees.map(e=>[e.id, e.name])]);
    if (!title || !date) { showToast('제목과 시작일을 입력해 주세요.', 'error'); return; }
    const t = EVENT_TYPES.find(t=>t.key===type)||EVENT_TYPES[6];
    const events = _getEvents();
    events.push({
      id:      'CAL'+Date.now(),
      type,
      title,
      date,
      endDate,
      allDay:  true,
      empId:   target,
      empName: targetNames[target]||'전체',
      shared:  true,
      color:   t.color,
    });
    _save(events);
    showToast('일정이 등록됐습니다.', 'success')
      addNotification({ type: 'success', title: 'Team Calendar (관리자)', body: '일정이 등록됐습니다.' });
    _tab = 'list';
    _draw();
  });
}
