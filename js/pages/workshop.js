/**
 * workshop.js — 워크샵·단체활동 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_workshops';

const DEMO_WORKSHOPS = [
  { id:'WS001', title:'2026 상반기 워크샵',       date:'2026-07-04', endDate:'2026-07-05', location:'강원도 속초', category:'워크샵',    capacity:50, enrolled:38, cost:0, desc:'팀 빌딩 및 상반기 성과 공유', icon:'🏕️', status:'open' },
  { id:'WS002', title:'리더십 개발 캠프',          date:'2026-07-18', endDate:'2026-07-19', location:'경기도 가평', category:'리더십',    capacity:20, enrolled:15, cost:0, desc:'팀장급 이상 리더십 역량 강화 프로그램', icon:'🎯', status:'open' },
  { id:'WS003', title:'팀 스포츠 데이',            date:'2026-06-21', endDate:'2026-06-21', location:'올림픽공원', category:'스포츠',    capacity:100, enrolled:72, cost:0, desc:'전사 스포츠 대회 및 친목 도모', icon:'⚽', status:'open' },
  { id:'WS004', title:'신입사원 OT 캠프',          date:'2026-06-14', endDate:'2026-06-15', location:'충청북도 음성', category:'교육',   capacity:30, enrolled:12, cost:0, desc:'2026년 상반기 신입사원 오리엔테이션', icon:'🎓', status:'open' },
  { id:'WS005', title:'사내 봉사 활동',            date:'2026-06-28', endDate:'2026-06-28', location:'서울 노원구', category:'봉사',     capacity:40, enrolled:28, cost:0, desc:'지역사회 봉사 및 CSR 활동', icon:'❤️', status:'open' },
];

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }

function _getWorkshops() {
  const s = localStorage.getItem(LS);
  if (!s) { localStorage.setItem(LS, JSON.stringify(DEMO_WORKSHOPS)); return DEMO_WORKSHOPS; }
  try {
    const d = JSON.parse(s);
    return [...DEMO_WORKSHOPS.filter(dw=>!d.find(w=>w.id===dw.id)), ...d];
  } catch { return DEMO_WORKSHOPS; }
}
function _save(l) { localStorage.setItem(LS, JSON.stringify(l)); }
function _getEnrollments() { try { return JSON.parse(localStorage.getItem('hr_ws_enrollments')||'[]'); } catch { return []; } }
function _saveEnrollments(l) { localStorage.setItem('hr_ws_enrollments', JSON.stringify(l)); }

let _tab  = 'list';
let _root = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _root=root; _tab='list'; _render(); }
export function unmount() { _tab = 'list'; _root=null; }

function _render() {
  const workshops   = _getWorkshops();
  const enrollments = _getEnrollments();
  const myEnrolled  = enrollments.filter(e=>e.empId===_empId());

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="ws-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🏕️ 워크샵·단체활동</div>
      <div style="font-size:11px;color:var(--text-muted)">예정 ${workshops.filter(w=>new Date(w.date)>=new Date()).length}건</div>
    </div>
    ${myEnrolled.length ? `<div style="background:#4F46E5;color:#fff;border-radius:99px;padding:3px 10px;font-size:12px;font-weight:700">신청 ${myEnrolled.length}</div>` : ''}
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['list','전체 목록'],['mine','내 신청']].map(([k,l])=>`
    <button class="ws-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='list' ? _renderList(workshops, enrollments) : _renderMine(myEnrolled, workshops)}
  </div>
</div>`;

  _root.querySelector('#ws-back').addEventListener('click', ()=>window.navBack());
  _root.querySelectorAll('.ws-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(); }));
  _bindList();
}

function _renderList(workshops, enrollments) {
  const myIds = new Set(enrollments.filter(e=>e.empId===_empId()).map(e=>e.workshopId));
  return workshops.map(w=>{
    const full      = w.enrolled >= w.capacity;
    const enrolled  = myIds.has(w.id);
    const pct       = Math.round(w.enrolled/w.capacity*100);
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
     padding:14px;margin-bottom:10px">
  <div style="display:flex;gap:10px;margin-bottom:8px">
    <span style="font-size:28px;flex-shrink:0">${w.icon}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:700">${w.title}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${w.date}${w.endDate!==w.date?` ~ ${w.endDate}`:''} · ${w.location}</div>
    </div>
    <span style="font-size:11px;font-weight:600;padding:3px 8px;border-radius:8px;flex-shrink:0;
                 background:#EEF2FF;color:#4F46E5">${w.category}</span>
  </div>
  <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">${w.desc}</div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <span style="font-size:11px;color:var(--text-muted)">참가 신청 ${w.enrolled}/${w.capacity}명</span>
    <span style="font-size:11px;font-weight:700;color:${full?'#EF4444':pct>=80?'#F59E0B':'#10B981'}">${pct}%</span>
  </div>
  <div style="background:var(--bg);border-radius:4px;height:4px;margin-bottom:10px">
    <div style="height:100%;border-radius:4px;background:${full?'#EF4444':'#4F46E5'};width:${Math.min(pct,100)}%"></div>
  </div>
  <button class="ws-enroll" data-id="${w.id}" data-title="${w.title}" ${enrolled||full?'disabled':''}
    style="width:100%;padding:9px;border:none;border-radius:8px;font-size:12px;font-weight:700;
           cursor:${enrolled||full?'not-allowed':'pointer'};
           background:${enrolled?'#D1FAE5':full?'#F1F5F9':'#4F46E5'};
           color:${enrolled?'#10B981':full?'var(--text-muted)':'#fff'}">
    ${enrolled?'✓ 신청 완료':full?'마감':'신청하기'}
  </button>
</div>`; }).join('');
}

function _renderMine(myEnrolled, workshops) {
  if (!myEnrolled.length) return `
<div style="text-align:center;padding:48px 16px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">🏕️</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:4px">신청한 활동이 없습니다</div>
      <button onclick="location.hash='#/workshop'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">워크샵 보기</button>
    
  <div style="font-size:12px">워크샵·단체활동에 참가해 보세요!</div>
</div>`;

  return myEnrolled.map(e=>{
    const w = workshops.find(x=>x.id===e.workshopId);
    if (!w) return '';
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;gap:10px;align-items:center">
    <span style="font-size:24px">${w.icon}</span>
    <div style="flex:1">
      <div style="font-size:13px;font-weight:700">${w.title}</div>
      <div style="font-size:11px;color:var(--text-muted)">${w.date} · ${w.location}</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;background:#D1FAE5;color:#10B981">신청완료</span>
  </div>
</div>`; }).join('');
}

function _bindList() {
  _root.querySelectorAll('.ws-enroll').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if (btn.disabled) return;
      const enrollments = _getEnrollments();
      enrollments.push({ id:'WE_'+Date.now(), empId:_empId(), empName:_empName(), workshopId:btn.dataset.id, enrolledAt:new Date().toISOString().slice(0,10) });
      _saveEnrollments(enrollments);
      const workshops = _getWorkshops();
      const w = workshops.find(x=>x.id===btn.dataset.id); if(w) w.enrolled++;
      _save(workshops);
      showToast(`"${btn.dataset.title}" 신청이 완료됐습니다.`, 'success')
    addNotification({ type: 'success', title: '워크샵', body: '"" 신청이 완료됐습니다.' });
      _render();
    });
  });
}
