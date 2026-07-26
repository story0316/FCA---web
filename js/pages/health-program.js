/**
 * health-program.js — 건강 프로그램 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS_PROGS  = 'hr_health_programs';
const LS_ENROLL = 'hr_hp_enrollments';

const DEMO_PROGS = [
  { id:'HP001', title:'요가 & 스트레칭', category:'운동', schedule:'매주 화·목 07:30', location:'본사 피트니스', capacity:20, instructor:'김요가', status:'active', fee:0 },
  { id:'HP002', title:'명상 & 마음챙김', category:'멘탈', schedule:'매주 수 12:30', location:'3층 명상실', capacity:15, instructor:'이마음', status:'active', fee:0 },
  { id:'HP003', title:'건강검진 설명회', category:'검진', schedule:'2026-07-01 14:00', location:'대회의실', capacity:50, instructor:'의무실', status:'active', fee:0 },
  { id:'HP004', title:'금연 지원 프로그램', category:'금연', schedule:'2026-06-10 시작 8주', location:'온라인', capacity:30, instructor:'금연클리닉', status:'active', fee:0 },
  { id:'HP005', title:'러닝 크루', category:'운동', schedule:'매주 월·수·금 07:00', location:'회사 주변', capacity:25, instructor:'자율', status:'active', fee:0 },
];

const CATEGORY_ICONS = { '운동':'🏃', '멘탈':'🧘', '검진':'🏥', '금연':'🚭', '기타':'💊' };

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }
function _getProgs() {
  const s = localStorage.getItem(LS_PROGS);
  if (!s) { localStorage.setItem(LS_PROGS, JSON.stringify(DEMO_PROGS)); return DEMO_PROGS; }
  try {
    const d = JSON.parse(s);
    return [...DEMO_PROGS.filter(dp=>!d.find(p=>p.id===dp.id)), ...d];
  } catch { return DEMO_PROGS; }
}
function _getEnrolls() { try { return JSON.parse(localStorage.getItem(LS_ENROLL)||'[]'); } catch { return []; } }
function _saveEnrolls(l) { localStorage.setItem(LS_ENROLL, JSON.stringify(l)); }

let _tab  = 'programs';
let _root = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _root=root; _tab='programs'; _render(); }
export function unmount() { _tab = 'programs'; _root=null; }

function _render() {
  const progs   = _getProgs();
  const enrolls = _getEnrolls();
  const mine    = enrolls.filter(e=>e.empId===_empId()&&e.status==='active');

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="hp-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1"><div style="font-size:15px;font-weight:700">🏋️ 건강 프로그램</div><div style="font-size:11px;color:var(--text-muted)">참가 ${mine.length}건</div></div>
    ${mine.length?`<div style="background:#10B981;color:#fff;border-radius:99px;padding:3px 10px;font-size:12px;font-weight:700">참가 ${mine.length}</div>`:''}
  </div>
  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['programs','프로그램'],['mine','내 신청']].map(([k,l])=>`
    <button class="hp-tab" data-tab="${k}" style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>
  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='mine' ? _renderMine(mine, progs) : _renderPrograms(progs, enrolls)}
  </div>
</div>`;

  _root.querySelector('#hp-back').addEventListener('click',()=>window.navBack());
  _root.querySelectorAll('.hp-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(); }));
  _bindEnroll();
}

function _renderPrograms(progs, enrolls) {
  const active = progs.filter(p=>p.status==='active');
  return active.map(p=>{
    const cnt     = enrolls.filter(e=>e.progId===p.id&&e.status==='active').length;
    const myEnrol = enrolls.find(e=>e.progId===p.id&&e.empId===_empId()&&e.status==='active');
    const icon    = CATEGORY_ICONS[p.category]||'💊';
    return `<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;gap:10px;margin-bottom:8px">
    <span style="font-size:28px">${icon}</span>
    <div style="flex:1">
      <div style="font-size:13px;font-weight:700">${p.title}</div>
      <div style="font-size:11px;color:var(--text-muted)">${p.category} · ${p.instructor}</div>
    </div>
    ${myEnrol?`<span style="font-size:11px;font-weight:700;color:#10B981">✓ 참가 중</span>`:''}
  </div>
  <div style="font-size:11px;color:var(--text-muted);background:var(--bg);border-radius:8px;padding:8px;margin-bottom:10px">
    <div>📅 ${p.schedule}</div>
    <div style="margin-top:2px">📍 ${p.location}</div>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:11px;color:var(--text-muted)">정원 ${cnt}/${p.capacity}명 · ${p.fee===0?'무료':p.fee.toLocaleString()+'원'}</span>
    ${myEnrol?
      `<button class="hp-leave" data-id="${p.id}" style="padding:7px 14px;background:none;border:1px solid var(--text-muted);color:var(--text-muted);border-radius:8px;font-size:11px;cursor:pointer">취소</button>`:
      cnt>=p.capacity?
      `<span style="font-size:11px;color:#EF4444;font-weight:700">정원 마감</span>`:
      `<button class="hp-enroll" data-id="${p.id}" style="padding:7px 14px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">신청</button>`}
  </div>
</div>`; }).join('');
}

function _renderMine(mine, progs) {
  if (!mine.length) return `<div style="text-align:center;padding:48px 16px;color:var(--text-muted)"><div style="font-size:40px;margin-bottom:10px">🏋️</div><div style="font-size:14px;font-weight:600;margin-bottom:4px">신청한 프로그램이 없습니다</div>
      <button onclick="location.hash='#/health-program'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">프로그램 보기</button>
    <div style="font-size:12px">건강 프로그램에 참여해 보세요!</div></div>`;
  return mine.map(e=>{
    const p = progs.find(x=>x.id===e.progId);
    const icon = CATEGORY_ICONS[p?.category]||'💊';
    return `<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;gap:8px;align-items:center">
    <span style="font-size:24px">${icon}</span>
    <div style="flex:1"><div style="font-size:13px;font-weight:700">${p?.title||e.progId}</div><div style="font-size:11px;color:var(--text-muted)">${p?.schedule||''} · 신청 ${e.enrolledAt}</div></div>
    <span style="font-size:11px;font-weight:700;color:#10B981">참가 중</span>
  </div>
</div>`; }).join('');
}

function _bindEnroll() {
  _root.querySelectorAll('.hp-enroll').forEach(btn=>btn.addEventListener('click',()=>{
    const enrolls = _getEnrolls();
    if (enrolls.find(e=>e.progId===btn.dataset.id&&e.empId===_empId()&&e.status==='active')) { showToast('이미 신청된 프로그램입니다.','error'); return; }
    enrolls.push({ id:'HE_'+Date.now(), progId:btn.dataset.id, empId:_empId(), empName:_empName(), enrolledAt:new Date().toISOString().slice(0,10), status:'active' });
    _saveEnrolls(enrolls); showToast('프로그램 신청이 완료됐습니다.','success')
    addNotification({ type: 'success', title: '건강 프로그램', body: '프로그램 신청이 완료됐습니다.' }); _render();
  }));
  _root.querySelectorAll('.hp-leave').forEach(btn=>btn.addEventListener('click',()=>{
    const enrolls = _getEnrolls();
    const e = enrolls.find(x=>x.progId===btn.dataset.id&&x.empId===_empId()&&x.status==='active'); if(!e) return;
    e.status='cancelled'; _saveEnrolls(enrolls); showToast('신청이 취소됐습니다.','info'); _render();
  }));
}
