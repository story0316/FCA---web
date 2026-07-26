/**
 * team-calendar.js — 팀 일정 공유 캘린더 (직원)
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
const TODAY = new Date().toISOString().slice(0,10);

const LS = 'hr_team_calendar';

const EVENT_TYPES = [
  { key:'meeting',  label:'회의',     icon:'💬', color:'#4F46E5' },
  { key:'outing',   label:'외근·출장',icon:'🚗', color:'#F59E0B' },
  { key:'training', label:'교육·세미나',icon:'📚', color:'#8B5CF6' },
  { key:'deadline', label:'마감·납기',icon:'⚠️', color:'#EF4444' },
  { key:'event',    label:'행사·파티',icon:'🎉', color:'#EC4899' },
  { key:'vacation', label:'휴가',     icon:'🏖️', color:'#10B981' },
  { key:'etc',      label:'기타',     icon:'📅', color:'var(--text-muted)' },
];

const LEGACY_CAL_IDS = new Set(['CAL003','CAL004']);

function _getEvents() {
  const s = localStorage.getItem(LS);
  if (!s) return [];
  try {
    const d = JSON.parse(s);
    const cleaned = d.filter(e => !LEGACY_CAL_IDS.has(e.id));
    if (cleaned.length < d.length) localStorage.setItem(LS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}
function _save(l) { localStorage.setItem(LS, JSON.stringify(l)); }

const NOW = new Date();
let _year  = NOW.getFullYear();
let _month = NOW.getMonth(); // 0-indexed
let _view  = 'month'; // month | list
let _showForm = false;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _year=NOW.getFullYear(); _month=NOW.getMonth(); _view='month'; _showForm=false;
  _render(root);
}
export function unmount() { _view = 'month'; _showForm=false; }

function _render(root) {
  const events = _getEvents();
  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div class="top-bar" style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="tc-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">📅 팀 캘린더</div>
      <div style="font-size:11px;color:var(--text-muted)">${_year}년 ${_month+1}월 · ${events.length}개 일정</div>
    </div>
    <div style="display:flex;gap:4px">
      <button class="tc-view-btn" data-view="month" style="padding:5px 10px;font-size:11px;font-weight:600;border-radius:6px;cursor:pointer;border:1.5px solid ${_view==='month'?'#4F46E5':'var(--border)'};background:${_view==='month'?'#EEF2FF':'var(--card-bg)'};color:${_view==='month'?'#4F46E5':'var(--text-muted)'}">월</button>
      <button class="tc-view-btn" data-view="list" style="padding:5px 10px;font-size:11px;font-weight:600;border-radius:6px;cursor:pointer;border:1.5px solid ${_view==='list'?'#4F46E5':'var(--border)'};background:${_view==='list'?'#EEF2FF':'var(--card-bg)'};color:${_view==='list'?'#4F46E5':'var(--text-muted)'}">목록</button>
    </div>
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_view==='month' ? _renderMonth(events) : _renderList(events)}
  </div>
</div>`;

  root.querySelector('#tc-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.tc-view-btn').forEach(b=>b.addEventListener('click',()=>{ _view=b.dataset.view; _render(root); }));
  root.querySelector('#tc-prev')?.addEventListener('click',()=>{
    _month--; if (_month<0) { _month=11; _year--; } _render(root);
  });
  root.querySelector('#tc-next')?.addEventListener('click',()=>{
    _month++; if (_month>11) { _month=0; _year++; } _render(root);
  });

  root.querySelector('#tc-add-toggle')?.addEventListener('click',()=>{ _showForm=!_showForm; _render(root); });
  root.querySelector('#tc-save')?.addEventListener('click',()=>{
    const title = root.querySelector('#tc-title').value.trim();
    const type  = root.querySelector('#tc-type').value;
    const date  = root.querySelector('#tc-date').value;
    const endDate = root.querySelector('#tc-enddate').value||date;
    const shared  = root.querySelector('#tc-shared').checked;
    if (!title) { showToast('제목을 입력하세요.','error'); return; }
    if (!date)  { showToast('날짜를 선택하세요.','error'); return; }
    const et = EVENT_TYPES.find(t=>t.key===type);
    const list = _getEvents();
    list.push({
      id:'CAL_'+Date.now(), type, title, date, endDate,
      allDay:true, empId:_empId(), empName:_empName(),
      shared, color:et?.color||'#4F46E5',
      createdAt:new Date().toISOString(),
    });
    _save(list);
    showToast('일정이 등록되었습니다.','success');
    if (shared) addNotification({ type: 'system', title: `팀 일정 등록: ${title}`, body: '' });
    _showForm=false; _render(root);
  });

  root.querySelectorAll('.tc-del').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if (!confirm('일정을 삭제하시겠습니까?')) return;
      _save(_getEvents().filter(e=>e.id!==btn.dataset.id));
      showToast('삭제되었습니다.','info');
      _render(root);
    });
  });
}

function _daysInMonth(y,m) { return new Date(y,m+1,0).getDate(); }
function _firstDow(y,m)    { return new Date(y,m,1).getDay(); }

function _renderMonth(events) {
  const days     = _daysInMonth(_year,_month);
  const firstDow = _firstDow(_year,_month);
  const todayStr = new Date().toISOString().slice(0,10);
  const ymStr    = `${_year}-${String(_month+1).padStart(2,'0')}`;

  const monthEvents = events.filter(e=>{
    return (e.date.startsWith(ymStr)) || (e.endDate && e.endDate.startsWith(ymStr));
  });

  const cells = [];
  for (let i=0;i<firstDow;i++) cells.push(null);
  for (let d=1;d<=days;d++) cells.push(d);

  return `
<!-- 월 이동 헤더 -->
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
  <button id="tc-prev" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:4px">‹</button>
  <div style="font-size:15px;font-weight:700;color:var(--text)">${_year}년 ${_month+1}월</div>
  <button id="tc-next" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:4px">›</button>
</div>

<!-- 요일 헤더 -->
<div style="display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:4px">
  ${['일','월','화','수','목','금','토'].map((d,i)=>`
  <div style="text-align:center;font-size:11px;font-weight:700;padding:4px 0;
       color:${i===0?'#EF4444':i===6?'#3B82F6':'var(--text-muted)'}">${d}</div>`).join('')}
</div>

<!-- 달력 셀 -->
<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:14px">
  ${cells.map((d,i)=>{
    if (d===null) return `<div></div>`;
    const dateStr = `${ymStr}-${String(d).padStart(2,'0')}`;
    const dayEvents = monthEvents.filter(e=>e.date===dateStr);
    const isToday   = dateStr===todayStr;
    const dow = (firstDow+d-1)%7;
    return `
  <div style="min-height:52px;border-radius:8px;padding:3px;background:${isToday?'#EEF2FF':'transparent'};
       border:1px solid ${isToday?'#4F46E5':'transparent'}">
    <div style="text-align:center;font-size:11px;font-weight:${isToday?'800':'500'};margin-bottom:2px;
         color:${isToday?'#4F46E5':dow===0?'#EF4444':dow===6?'#3B82F6':'var(--text)'}">${d}</div>
    ${dayEvents.slice(0,2).map(e=>`
    <div style="font-size:8px;font-weight:600;padding:1px 3px;border-radius:3px;margin-bottom:1px;
         background:${e.color}22;color:${e.color};overflow:hidden;white-space:nowrap;text-overflow:ellipsis">
      ${e.title}
    </div>`).join('')}
    ${dayEvents.length>2?`<div style="font-size:8px;color:var(--text-muted);text-align:center">+${dayEvents.length-2}</div>`:''}
  </div>`;
  }).join('')}
</div>

<!-- 이번 달 일정 목록 -->
<div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px">${_month+1}월 일정 (${monthEvents.length}건)</div>
${!monthEvents.length
  ?`<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">이번 달 일정이 없습니다.</div>`
  :monthEvents.sort((a,b)=>a.date.localeCompare(b.date)).map(e=>_eventCard(e)).join('')}

<!-- 일정 추가 -->
${_renderAddForm()}`;
}

function _renderList(events) {
  const upcoming = events
    .filter(e=>e.date>= new Date().toISOString().slice(0,10))
    .sort((a,b)=>a.date.localeCompare(b.date));
  const past = events
    .filter(e=>e.date < new Date().toISOString().slice(0,10))
    .sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);

  return `
${_renderAddForm()}
<div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px">예정 일정 (${upcoming.length}건)</div>
${!upcoming.length?`<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">예정된 일정이 없습니다.</div>`:upcoming.map(e=>_eventCard(e)).join('')}
${past.length?`<div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-top:14px;margin-bottom:8px">지난 일정</div>${past.map(e=>_eventCard(e)).join('')}`:''}`;
}

function _eventCard(e) {
  const et = EVENT_TYPES.find(t=>t.key===e.type)||{icon:'📅',label:'기타'};
  const isOwn = e.empId===_empId();
  const dateRange = e.endDate && e.endDate!==e.date ? `${e.date} ~ ${e.endDate}` : e.date;
  return `
<div style="background:var(--card-bg);border-left:3px solid ${e.color};border-radius:0 10px 10px 0;
     padding:10px 12px;margin-bottom:6px;display:flex;align-items:center;gap:10px;
     border:1px solid var(--border);border-left:3px solid ${e.color}">
  <span style="font-size:16px;flex-shrink:0">${et.icon}</span>
  <div style="flex:1;min-width:0">
    <div style="font-size:12px;font-weight:700;color:var(--text)">${e.title}</div>
    <div style="font-size:10px;color:var(--text-muted);margin-top:1px">${dateRange} · ${e.empName}${e.shared?` · <span style="color:#4F46E5">공유</span>`:''}</div>
  </div>
  ${isOwn?`<button class="tc-del" data-id="${e.id}"
    style="background:#FEE2E2;color:#DC2626;border:none;border-radius:6px;padding:3px 8px;font-size:10px;cursor:pointer;flex-shrink:0">삭제</button>`:''}
</div>`;
}

function _renderAddForm() {
  return `
<button id="tc-add-toggle"
  style="width:100%;padding:10px;background:${_showForm?'#EEF2FF':'#4F46E5'};
         color:${_showForm?'#4F46E5':'#fff'};border:${_showForm?'1.5px solid #4F46E5':'none'};
         border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;margin-top:12px;margin-bottom:${_showForm?'10px':'0'}">
  ${_showForm?'✕ 취소':'+ 일정 추가'}
</button>

${_showForm?`
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
  <div style="margin-bottom:8px">
    <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:3px;font-weight:600">일정 유형</label>
    <select id="tc-type" style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text)">
      ${EVENT_TYPES.map(t=>`<option value="${t.key}">${t.icon} ${t.label}</option>`).join('')}
    </select>
  </div>
  <div style="margin-bottom:8px">
    <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:3px;font-weight:600">제목</label>
    <input id="tc-title" type="text" placeholder="일정 제목"
      style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
    <div>
      <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:3px;font-weight:600">시작일</label>
      <input id="tc-date" type="date" value="${new Date().toISOString().slice(0,10)}"
        style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;background:var(--bg);color:var(--text);box-sizing:border-box" min="${TODAY}">
    </div>
    <div>
      <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:3px;font-weight:600">종료일</label>
      <input id="tc-enddate" type="date" value="${new Date().toISOString().slice(0,10)}"
        style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;background:var(--bg);color:var(--text);box-sizing:border-box" min="${TODAY}">
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
    <input id="tc-shared" type="checkbox" checked style="width:16px;height:16px;accent-color:#4F46E5">
    <label for="tc-shared" style="font-size:12px;font-weight:600;color:var(--text);cursor:pointer">팀 공유 일정</label>
  </div>
  <button id="tc-save" style="width:100%;padding:10px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">등록하기</button>
</div>`:''}`;
}
