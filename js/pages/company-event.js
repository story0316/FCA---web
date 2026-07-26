/**
 * company-event.js — 사내 행사 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

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
  { id:'EVT001', title:'2026 상반기 시무식',       category:'culture',  date:'2026-07-01', time:'10:00', location:'본사 대강당', capacity:200, rsvp:145, desc:'상반기 성과 발표 및 시상식, 음료·다과 제공', icon:'🏆', status:'open' },
  { id:'EVT002', title:'전사 풋살 대회',           category:'sports',   date:'2026-06-28', time:'14:00', location:'사내 운동장', capacity:50,  rsvp:38,  desc:'팀별 풋살 대회, 우승팀 상금 지급', icon:'⚽', status:'open' },
  { id:'EVT003', title:'AI 트렌드 세미나',         category:'seminar',  date:'2026-06-25', time:'15:00', location:'3층 세미나실', capacity:80, rsvp:62,  desc:'2026 AI 트렌드와 업무 적용 사례 발표', icon:'🤖', status:'open' },
  { id:'EVT004', title:'사랑의 헌혈 캠페인',       category:'charity',  date:'2026-06-20', time:'10:00', location:'1층 로비',   capacity:100, rsvp:28,  desc:'한국 혈액원과 함께하는 헌혈 봉사 캠페인', icon:'🩸', status:'open' },
  { id:'EVT005', title:'신입사원 환영 회식',       category:'dinner',   date:'2026-06-14', time:'18:30', location:'강남 레스토랑', capacity:30, rsvp:18, desc:'2026년 상반기 신입사원 환영 회식', icon:'🍾', status:'open' },
];

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }

function _getEvents() {
  const s = localStorage.getItem(LS_EVENTS);
  if (!s) { localStorage.setItem(LS_EVENTS, JSON.stringify(DEMO_EVENTS)); return DEMO_EVENTS; }
  try {
    const d = JSON.parse(s);
    return [...DEMO_EVENTS.filter(de=>!d.find(e=>e.id===de.id)), ...d];
  } catch { return DEMO_EVENTS; }
}
function _saveEvents(l) { localStorage.setItem(LS_EVENTS, JSON.stringify(l)); }
function _getRsvp() { try { return JSON.parse(localStorage.getItem(LS_RSVP)||'[]'); } catch { return []; } }
function _saveRsvp(l) { localStorage.setItem(LS_RSVP, JSON.stringify(l)); }

let _tab     = 'upcoming';
let _selCat  = '전체';
let _root    = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _root=root; _tab='upcoming'; _selCat='전체'; _render(); }
export function unmount() { _tab = 'upcoming'; _root=null; }

function _render() {
  const events = _getEvents();
  const rsvp   = _getRsvp();
  const myRsvp = rsvp.filter(r=>r.empId===_empId());
  const myIds  = new Set(myRsvp.map(r=>r.eventId));

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="ce-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🎉 사내 행사</div>
      <div style="font-size:11px;color:var(--text-muted)">참가 신청 ${myRsvp.length}건</div>
    </div>
    ${myRsvp.length ? `<div style="background:#4F46E5;color:#fff;border-radius:99px;padding:3px 10px;font-size:12px;font-weight:700">참가 ${myRsvp.length}</div>` : ''}
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['upcoming','행사 목록'],['mine','내 참가']].map(([k,l])=>`
    <button class="ce-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='upcoming' ? _renderList(events, myIds) : _renderMine(myRsvp, events)}
  </div>
</div>`;

  _root.querySelector('#ce-back').addEventListener('click', ()=>window.navBack());
  _root.querySelectorAll('.ce-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(); }));
  _bindList();
}

function _renderList(events, myIds) {
  const upcoming = events.filter(e=>new Date(e.date)>=new Date()).sort((a,b)=>a.date.localeCompare(b.date));

  return `
<!-- 카테고리 필터 -->
<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;margin-bottom:12px">
  ${['전체',...EVENT_CATEGORIES.map(c=>c.label)].map(c=>`
  <button class="ce-cat" data-cat="${c}"
    style="padding:6px 12px;border-radius:99px;border:none;cursor:pointer;white-space:nowrap;
           font-size:12px;font-weight:600;
           background:${_selCat===c?'#4F46E5':'var(--bg)'};
           color:${_selCat===c?'#fff':'var(--text-muted)'};
           border:1px solid ${_selCat===c?'#4F46E5':'var(--border)'}">${c}</button>`).join('')}
</div>

${upcoming.filter(e=>{
  if (_selCat==='전체') return true;
  const cat = EVENT_CATEGORIES.find(c=>c.key===e.category);
  return cat?.label===_selCat;
}).map(ev=>{
  const joined = myIds.has(ev.id);
  const full   = ev.rsvp >= ev.capacity;
  const pct    = Math.round(ev.rsvp/ev.capacity*100);
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
     padding:14px;margin-bottom:10px">
  <div style="display:flex;gap:10px;margin-bottom:8px">
    <span style="font-size:28px;flex-shrink:0">${ev.icon}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:700">${ev.title}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${ev.date} ${ev.time} · ${ev.location}</div>
    </div>
  </div>
  <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">${ev.desc}</div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
    <span style="font-size:11px;color:var(--text-muted)">참가 ${ev.rsvp}/${ev.capacity}명</span>
    <span style="font-size:11px;font-weight:700;color:${full?'#EF4444':pct>=80?'#F59E0B':'#10B981'}">${pct}%</span>
  </div>
  <div style="background:var(--bg);border-radius:4px;height:4px;margin-bottom:10px">
    <div style="height:100%;border-radius:4px;background:#4F46E5;width:${Math.min(pct,100)}%"></div>
  </div>
  <button class="ce-join" data-id="${ev.id}" data-title="${ev.title}" ${joined||full?'disabled':''}
    style="width:100%;padding:9px;border:none;border-radius:8px;font-size:12px;font-weight:700;
           cursor:${joined||full?'not-allowed':'pointer'};
           background:${joined?'#D1FAE5':full?'#F1F5F9':'#4F46E5'};
           color:${joined?'#10B981':full?'var(--text-muted)':'#fff'}">
    ${joined?'✓ 참가 신청 완료':full?'마감':'참가 신청'}
  </button>
</div>`; }).join('')}`;
}

function _renderMine(myRsvp, events) {
  if (!myRsvp.length) return `
<div style="text-align:center;padding:48px 16px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">🎉</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:4px">참가 신청한 행사가 없습니다</div>
      <button onclick="location.hash='#/company-event'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">행사 보기</button>
    
  <div style="font-size:12px">사내 행사에 참가해 보세요!</div>
</div>`;

  return myRsvp.map(r=>{
    const ev = events.find(e=>e.id===r.eventId);
    if (!ev) return '';
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;gap:10px;align-items:center">
    <span style="font-size:24px">${ev.icon}</span>
    <div style="flex:1">
      <div style="font-size:13px;font-weight:700">${ev.title}</div>
      <div style="font-size:11px;color:var(--text-muted)">${ev.date} ${ev.time} · ${ev.location}</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;background:#ECFDF5;color:#10B981">참가예정</span>
  </div>
</div>`; }).join('');
}

function _bindList() {
  _root.querySelectorAll('.ce-cat').forEach(b=>b.addEventListener('click',()=>{ _selCat=b.dataset.cat; _render(); }));

  _root.querySelectorAll('.ce-join').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if (btn.disabled) return;
      const rsvp = _getRsvp();
      rsvp.push({ id:'RSVP_'+Date.now(), empId:_empId(), empName:_empName(), eventId:btn.dataset.id, rsvpAt:new Date().toISOString().slice(0,10) });
      _saveRsvp(rsvp);
      const events = _getEvents();
      const ev = events.find(e=>e.id===btn.dataset.id); if(ev) ev.rsvp++;
      _saveEvents(events);
      showToast(`"${btn.dataset.title}" 참가 신청이 완료됐습니다.`, 'success')
    addNotification({ type: 'success', title: '사내 행사', body: '"" 참가 신청이 완료됐습니다.' });
      _render();
    });
  });
}
