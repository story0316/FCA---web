/**
 * volunteer.js — 자원봉사 신청 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS_ACTS = 'hr_volunteer_acts';
const LS_ENROLL = 'hr_volunteer_enroll';

const DEMO_ACTS = [
  { id:'VOL001', title:'한강 환경 정화 봉사', category:'환경', date:'2026-06-21', time:'09:00', location:'한강 뚝섬 유원지', capacity:20, desc:'한강 쓰레기 수거 및 환경 정화 활동', icon:'♻️', status:'open' },
  { id:'VOL002', title:'노인 복지관 급식 봉사', category:'복지', date:'2026-06-28', time:'11:00', location:'강남 노인복지관', capacity:15, desc:'독거 어르신 점심 식사 보조 및 말벗 봉사', icon:'🍲', status:'open' },
  { id:'VOL003', title:'아동 도서관 독서 지원', category:'교육', date:'2026-07-05', time:'10:00', location:'구립 어린이 도서관', capacity:10, desc:'초등학생 대상 독서 지도 및 학습 도우미', icon:'📚', status:'open' },
  { id:'VOL004', title:'장애인 생활 지원 봉사', category:'복지', date:'2026-07-12', time:'09:00', location:'장애인복지관', capacity:12, desc:'장애인 생활 보조 및 이동 지원 활동', icon:'🤝', status:'open' },
];

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }

function _getActs() {
  const s = localStorage.getItem(LS_ACTS);
  if (!s) { localStorage.setItem(LS_ACTS, JSON.stringify(DEMO_ACTS)); return DEMO_ACTS; }
  try {
    const d = JSON.parse(s);
    return [...DEMO_ACTS.filter(da=>!d.find(a=>a.id===da.id)), ...d];
  } catch { return DEMO_ACTS; }
}
function _saveActs(l) { localStorage.setItem(LS_ACTS, JSON.stringify(l)); }
function _getEnroll() { try { return JSON.parse(localStorage.getItem(LS_ENROLL)||'[]'); } catch { return []; } }
function _saveEnroll(l) { localStorage.setItem(LS_ENROLL, JSON.stringify(l)); }

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
  const acts    = _getActs();
  const enroll  = _getEnroll();
  const myEnroll= enroll.filter(e=>e.empId===_empId());
  const myIds   = new Set(myEnroll.map(e=>e.actId));

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="vol-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🤲 자원봉사</div>
      <div style="font-size:11px;color:var(--text-muted)">신청 ${myEnroll.length}건</div>
    </div>
    ${myEnroll.length ? `<div style="background:#10B981;color:#fff;border-radius:99px;padding:3px 10px;font-size:12px;font-weight:700">참여 ${myEnroll.length}</div>` : ''}
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['list','봉사 목록'],['mine','내 신청']].map(([k,l])=>`
    <button class="vol-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='list' ? _renderList(acts, myIds) : _renderMine(myEnroll, acts)}
  </div>
</div>`;

  _root.querySelector('#vol-back').addEventListener('click', ()=>window.navBack());
  _root.querySelectorAll('.vol-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(); }));
  _bindList();
}

function _renderList(acts, myIds) {
  const upcoming = acts.filter(a=>new Date(a.date)>=new Date()).sort((a,b)=>a.date.localeCompare(b.date));

  return upcoming.map(a=>{
    const enrolled = myIds.has(a.id);
    const enroll   = _getEnroll();
    const cnt      = enroll.filter(e=>e.actId===a.id).length;
    const full     = cnt >= a.capacity;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;gap:10px;margin-bottom:8px">
    <span style="font-size:28px;flex-shrink:0">${a.icon}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:700">${a.title}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${a.date} ${a.time} · ${a.location}</div>
    </div>
    <span style="font-size:10px;background:#EEF2FF;color:#4F46E5;padding:2px 7px;border-radius:99px;font-weight:600;height:fit-content">${a.category}</span>
  </div>
  <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">${a.desc}</div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
    <span style="font-size:11px;color:var(--text-muted)">참가 ${cnt}/${a.capacity}명</span>
    <span style="font-size:11px;font-weight:700;color:${full?'#EF4444':cnt/a.capacity>=0.8?'#F59E0B':'#10B981'}">${Math.round(cnt/a.capacity*100)}%</span>
  </div>
  <button class="vol-join" data-id="${a.id}" data-title="${a.title}" ${enrolled||full?'disabled':''}
    style="width:100%;padding:9px;border:none;border-radius:8px;font-size:12px;font-weight:700;
           cursor:${enrolled||full?'not-allowed':'pointer'};
           background:${enrolled?'#D1FAE5':full?'#F1F5F9':'#4F46E5'};
           color:${enrolled?'#10B981':full?'var(--text-muted)':'#fff'}">
    ${enrolled?'✓ 신청 완료':full?'마감':'신청하기'}
  </button>
</div>`; }).join('');
}

function _renderMine(myEnroll, acts) {
  if (!myEnroll.length) return `
<div style="text-align:center;padding:48px 16px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">🤲</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:4px">신청한 봉사가 없습니다</div>
      <button onclick="location.hash='#/volunteer'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">봉사활동 보기</button>
    
  <div style="font-size:12px">자원봉사에 참여해 보세요!</div>
</div>`;

  return myEnroll.map(e=>{
    const a = acts.find(x=>x.id===e.actId);
    if (!a) return '';
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;gap:10px;align-items:center">
    <span style="font-size:24px">${a.icon}</span>
    <div style="flex:1">
      <div style="font-size:13px;font-weight:700">${a.title}</div>
      <div style="font-size:11px;color:var(--text-muted)">${a.date} ${a.time} · ${a.location}</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;background:#ECFDF5;color:#10B981">신청완료</span>
  </div>
</div>`; }).join('');
}

function _bindList() {
  _root.querySelectorAll('.vol-join').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if (btn.disabled) return;
      const enroll = _getEnroll();
      enroll.push({ id:'VE_'+Date.now(), empId:_empId(), empName:_empName(), actId:btn.dataset.id, enrollAt:new Date().toISOString().slice(0,10) });
      _saveEnroll(enroll);
      showToast(`"${btn.dataset.title}" 봉사 신청이 완료됐습니다.`, 'success')
    addNotification({ type: 'success', title: '봉사활동', body: '"" 봉사 신청이 완료됐습니다.' });
      _render();
    });
  });
}
