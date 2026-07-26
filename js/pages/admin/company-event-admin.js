/**
 * company-event-admin.js — 사내 행사 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS_EVENTS = 'hr_company_events';
const LS_RSVP   = 'hr_event_rsvp';

const EVENT_CATEGORIES = [
  { key:'culture',  label:'문화/파티', icon:'🎉' },
  { key:'sports',   label:'체육행사',  icon:'⚽' },
  { key:'seminar',  label:'세미나',    icon:'🎤' },
  { key:'charity',  label:'봉사/기부', icon:'❤️' },
  { key:'dinner',   label:'회식/식사', icon:'🍽️' },
  { key:'other',    label:'기타',      icon:'📅' },
];

const DEMO_EVENTS = [
  { id:'EVT001', title:'2026 상반기 시무식',   category:'culture',  date:'2026-07-01', time:'10:00', location:'본사 대강당',  capacity:200, rsvp:145, desc:'상반기 성과 발표 및 시상식', icon:'🏆', status:'open' },
  { id:'EVT002', title:'전사 풋살 대회',       category:'sports',   date:'2026-06-28', time:'14:00', location:'사내 운동장',  capacity:50,  rsvp:38,  desc:'팀별 풋살 대회, 우승팀 상금', icon:'⚽', status:'open' },
  { id:'EVT003', title:'AI 트렌드 세미나',     category:'seminar',  date:'2026-06-25', time:'15:00', location:'3층 세미나실', capacity:80,  rsvp:62,  desc:'2026 AI 트렌드와 업무 적용', icon:'🤖', status:'open' },
  { id:'EVT004', title:'사랑의 헌혈 캠페인',   category:'charity',  date:'2026-06-20', time:'10:00', location:'1층 로비',    capacity:100, rsvp:28,  desc:'한국 혈액원과 함께하는 헌혈', icon:'🩸', status:'open' },
  { id:'EVT005', title:'신입사원 환영 회식',   category:'dinner',   date:'2026-06-14', time:'18:30', location:'강남 레스토랑', capacity:30, rsvp:18,  desc:'2026 상반기 신입사원 환영', icon:'🍾', status:'open' },
];

const LEGACY_RSVP_IDS = new Set(['RSVP001', 'RSVP002', 'RSVP003', 'RSVP004', 'RSVP005']);

function _getEvents() {
  const s = localStorage.getItem(LS_EVENTS);
  if (!s) { localStorage.setItem(LS_EVENTS, JSON.stringify(DEMO_EVENTS)); return DEMO_EVENTS; }
  try {
    const d = JSON.parse(s);
    return [...DEMO_EVENTS.filter(de=>!d.find(e=>e.id===de.id)), ...d];
  } catch { return DEMO_EVENTS; }
}
function _saveEvents(l) { localStorage.setItem(LS_EVENTS, JSON.stringify(l)); }
function _getRsvp() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_RSVP) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_RSVP_IDS.has(r.id));
    if (cleaned.length !== list.length) localStorage.setItem(LS_RSVP, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}

let _tab    = 'events';
let _selEvt = null;
let _root   = null;

export function render(root) { _root=root; _tab='events'; _selEvt=null; _draw(); }
export function unmount() { _root=null;
  _tab = 'events';
}

function _draw() {
  const events = _getEvents();
  const rsvp   = _getRsvp();
  const upcoming = events.filter(e=>new Date(e.date)>=new Date()).length;

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['events','행사 목록'],['rsvp','참가자 현황'],['create','행사 등록']].map(([k,l])=>`
    <button class="cea-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='events' ? _renderEvents(events, rsvp)
    : _tab==='rsvp'   ? _renderRsvp(events, rsvp)
    :                   _renderCreate()}
  </div>
</div>`;

  _root.querySelectorAll('.cea-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _selEvt=null; _draw(); }));
  _bindEvents();
}

function _renderEvents(events, rsvp) {
  const total    = events.length;
  const upcoming = events.filter(e=>new Date(e.date)>=new Date()).length;
  const totalRsvp= rsvp.length;

  return `
<!-- KPI -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
  ${[
    ['전체 행사', `${total}건`, '#4F46E5'],
    ['예정 행사', `${upcoming}건`, '#10B981'],
    ['총 신청', `${totalRsvp}명`, '#F59E0B'],
  ].map(([l,v,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:18px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8">${l}</div>
  </div>`).join('')}
</div>

${[...events].sort((a,b)=>a.date.localeCompare(b.date)).map(ev=>{
  const evRsvp = rsvp.filter(r=>r.eventId===ev.id).length;
  const pct    = Math.round(evRsvp/ev.capacity*100);
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px">
    <span style="font-size:24px;flex-shrink:0">${ev.icon}</span>
    <div style="flex:1">
      <div style="font-size:13px;font-weight:700">${ev.title}</div>
      <div style="font-size:11px;color:#94A3B8">${ev.date} ${ev.time} · ${ev.location}</div>
    </div>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
    <span style="color:#64748B">신청 ${evRsvp}/${ev.capacity}명</span>
    <span style="font-weight:700;color:${pct>=100?'#EF4444':pct>=80?'#F59E0B':'#10B981'}">${pct}%</span>
  </div>
  <div style="background:var(--bg);border-radius:4px;height:4px">
    <div style="height:100%;border-radius:4px;background:#4F46E5;width:${Math.min(pct,100)}%"></div>
  </div>
</div>`; }).join('')}`;
}

function _renderRsvp(events, rsvp) {
  const evFilter = _selEvt;
  const list     = evFilter ? rsvp.filter(r=>r.eventId===evFilter) : rsvp;

  return `
<div style="margin-bottom:10px">
  <select id="cea-filter"
    style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
           background:var(--bg);color:var(--text);font-size:12px">
    <option value="">전체 행사</option>
    ${events.map(e=>`<option value="${e.id}" ${evFilter===e.id?'selected':''}>${e.title}</option>`).join('')}
  </select>
</div>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700">
    ${evFilter ? events.find(e=>e.id===evFilter)?.title : '전체'} · ${list.length}명
  </div>
  ${!list.length ? `<div style="padding:24px;text-align:center;color:#94A3B8;font-size:12px">참가자가 없습니다.</div>` :
  list.map(r=>{
    const ev = events.find(e=>e.id===r.eventId);
    return `
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:12px;font-weight:600">${r.empName}</div>
      ${!evFilter?`<div style="font-size:10px;color:#94A3B8">${ev?ev.title:''}</div>`:''}
    </div>
    <span style="font-size:11px;color:#94A3B8">${r.rsvpAt}</span>
  </div>`; }).join('')}
</div>`;
}

function _renderCreate() {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:14px">새 행사 등록</div>
  <div style="display:flex;flex-direction:column;gap:10px">
    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">행사명 *</div>
      <input id="cea-title" type="text" placeholder="행사 제목"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
               background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">카테고리</div>
        <select id="cea-cat" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px">
          ${EVENT_CATEGORIES.map(c=>`<option value="${c.key}">${c.icon} ${c.label}</option>`).join('')}
        </select>
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">정원</div>
        <input id="cea-cap" type="number" value="50" min="1"
          style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">일자 *</div>
        <input id="cea-date" type="date" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">시간</div>
        <input id="cea-time" type="time" value="10:00" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
      </div>
    </div>
    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">장소</div>
      <input id="cea-loc" type="text" placeholder="행사 장소"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
    </div>
    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">설명</div>
      <textarea id="cea-desc" rows="2" placeholder="행사 설명"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;resize:none;box-sizing:border-box"></textarea>
    </div>
    <button id="cea-submit" style="padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">등록</button>
  </div>
</div>`;
}

function _bindEvents() {
  _root.querySelector('#cea-filter')?.addEventListener('change',e=>{ _selEvt=e.target.value||null; _draw(); });

  _root.querySelector('#cea-submit')?.addEventListener('click',()=>{
    const title = _root.querySelector('#cea-title')?.value.trim();
    const date  = _root.querySelector('#cea-date')?.value;
    if (!title||!date) { showToast('행사명과 일자를 입력해 주세요.', 'error'); return; }
    const catKey = _root.querySelector('#cea-cat')?.value||'other';
    const cat = EVENT_CATEGORIES.find(c=>c.key===catKey)||EVENT_CATEGORIES[5];
    const events = _getEvents();
    events.push({
      id:       'EVT'+Date.now(),
      title,
      category: catKey,
      date,
      time:     _root.querySelector('#cea-time')?.value||'10:00',
      location: _root.querySelector('#cea-loc')?.value||'-',
      capacity: parseInt(_root.querySelector('#cea-cap')?.value)||50,
      rsvp:     0,
      desc:     _root.querySelector('#cea-desc')?.value||'',
      icon:     cat.icon,
      status:   'open',
    });
    _saveEvents(events);
    showToast('행사가 등록됐습니다.', 'success')
      addNotification({ type: 'success', title: 'Company Event (관리자)', body: '행사가 등록됐습니다.' });
    _tab='events'; _draw();
  });
}
export function mount(root) { return render(root); }
