/**
 * health-program-admin.js — 건강 프로그램 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS_PROGS  = 'hr_health_programs';
const LS_ENROLL = 'hr_hp_enrollments';

const DEMO_PROGS = [
  { id:'HP001', title:'요가 & 스트레칭', category:'운동', schedule:'매주 화·목 07:30', location:'본사 피트니스', capacity:20, instructor:'김요가', status:'active', fee:0 },
  { id:'HP002', title:'명상 & 마음챙김', category:'멘탈', schedule:'매주 수 12:30', location:'3층 명상실', capacity:15, instructor:'이마음', status:'active', fee:0 },
  { id:'HP003', title:'건강검진 설명회', category:'검진', schedule:'2026-07-01 14:00', location:'대회의실', capacity:50, instructor:'의무실', status:'active', fee:0 },
  { id:'HP004', title:'금연 지원 프로그램', category:'금연', schedule:'2026-06-10 시작 8주', location:'온라인', capacity:30, instructor:'금연클리닉', status:'active', fee:0 },
  { id:'HP005', title:'러닝 크루', category:'운동', schedule:'매주 월·수·금 07:00', location:'회사 주변', capacity:25, instructor:'자율', status:'active', fee:0 },
];

const LEGACY_ENROLL_IDS = new Set(['HE001', 'HE002', 'HE003']);

function _getProgs() {
  const s = localStorage.getItem(LS_PROGS);
  if (!s) { localStorage.setItem(LS_PROGS, JSON.stringify(DEMO_PROGS)); return DEMO_PROGS; }
  try {
    const d = JSON.parse(s);
    return [...DEMO_PROGS.filter(dp=>!d.find(p=>p.id===dp.id)), ...d];
  } catch { return DEMO_PROGS; }
}
function _saveProgs(l) { localStorage.setItem(LS_PROGS, JSON.stringify(l)); }
function _getEnrolls() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_ENROLL) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(e => !LEGACY_ENROLL_IDS.has(e.id));
    if (cleaned.length !== list.length) localStorage.setItem(LS_ENROLL, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}

let _tab  = 'programs';
let _root = null;

export function render(root) { _root=root; _tab='programs'; _draw(); }
export function unmount() { _root=null;
  _tab = 'programs';
}

function _draw() {
  const progs   = _getProgs();
  const enrolls = _getEnrolls();

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['programs','프로그램 목록'],['enrolls','신청 현황'],['add','프로그램 등록']].map(([k,l])=>`
    <button class="hpa-tab" data-tab="${k}" style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;white-space:nowrap;border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='add' ? _renderAdd() : _tab==='enrolls' ? _renderEnrolls(progs, enrolls) : _renderPrograms(progs, enrolls)}
  </div>
</div>`;

  _root.querySelectorAll('.hpa-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderPrograms(progs, enrolls) {
  return `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
  ${[['프로그램',`${progs.filter(p=>p.status==='active').length}개`,'#4F46E5'],['총 신청',`${enrolls.filter(e=>e.status==='active').length}건`,'#10B981']].map(([l,v,c])=>`<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:${c}">${v}</div><div style="font-size:10px;color:#94A3B8">${l}</div></div>`).join('')}
</div>
${progs.map(p=>{
  const cnt=enrolls.filter(e=>e.progId===p.id&&e.status==='active').length;
  return `<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;margin-bottom:6px">
    <div><div style="font-size:13px;font-weight:700">${p.title}</div><div style="font-size:11px;color:#94A3B8">${p.category} · ${p.instructor}</div></div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;background:${p.status==='active'?'#ECFDF5':'#F1F5F9'};color:${p.status==='active'?'#10B981':'#94A3B8'}">${p.status==='active'?'운영 중':'종료'}</span>
  </div>
  <div style="font-size:11px;color:#64748B;margin-bottom:8px">${p.schedule} · ${p.location}</div>
  <div style="display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:12px;font-weight:700;color:#4F46E5">참가 ${cnt}/${p.capacity}명</span>
    ${p.status==='active'?`<button class="hpa-end" data-id="${p.id}" style="padding:5px 10px;background:none;border:1px solid #94A3B8;color:#94A3B8;border-radius:6px;font-size:10px;cursor:pointer">종료</button>`:''}
  </div>
</div>`; }).join('')}`;
}

function _renderEnrolls(progs, enrolls) {
  const active=enrolls.filter(e=>e.status==='active');
  return `
<div style="font-size:12px;font-weight:700;color:#64748B;margin-bottom:10px">총 ${active.length}건 신청 중</div>
${!active.length?`<div style="text-align:center;padding:40px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">🏋️</div><div style="font-size:13px">신청자가 없습니다.</div></div>`:active.map(e=>{
  const p=progs.find(x=>x.id===e.progId);
  return `<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
  <div><div style="font-size:12px;font-weight:700">${e.empName}</div><div style="font-size:10px;color:#94A3B8">${e.dept} · ${p?.title||e.progId}</div></div>
  <div style="font-size:10px;color:#94A3B8">${e.enrolledAt}</div>
</div>`; }).join('')}`;
}

function _renderAdd() {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:14px">건강 프로그램 등록</div>
  <div style="display:flex;flex-direction:column;gap:10px">
    <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">프로그램명 *</div>
      <input id="hpa-title" type="text" placeholder="예: 필라테스 클래스" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">카테고리</div>
        <input id="hpa-cat" type="text" placeholder="운동/멘탈/검진" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
      <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">정원</div>
        <input id="hpa-cap" type="number" value="20" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
    </div>
    <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">일정</div>
      <input id="hpa-sched" type="text" placeholder="예: 매주 화·목 07:30" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
    <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">장소</div>
      <input id="hpa-loc" type="text" placeholder="예: 본사 피트니스" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
    <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">강사/담당</div>
      <input id="hpa-inst" type="text" placeholder="강사명 또는 담당 부서" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
    <button id="hpa-submit" style="padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">등록하기</button>
  </div>
</div>`;
}

function _bindEvents() {
  _root.querySelectorAll('.hpa-end').forEach(btn=>btn.addEventListener('click',()=>{
    const progs=_getProgs(); const p=progs.find(x=>x.id===btn.dataset.id); if(!p) return;
    p.status='ended'; _saveProgs(progs); showToast('프로그램이 종료됐습니다.','info'); _draw();
  }));
  _root.querySelector('#hpa-submit')?.addEventListener('click',()=>{
    const title=_root.querySelector('#hpa-title')?.value.trim();
    if (!title) { showToast('프로그램명을 입력해 주세요.','error'); return; }
    const progs=_getProgs();
    progs.push({ id:'HP'+Date.now(), title, category:_root.querySelector('#hpa-cat')?.value.trim()||'기타', schedule:_root.querySelector('#hpa-sched')?.value.trim()||'미정', location:_root.querySelector('#hpa-loc')?.value.trim()||'미정', capacity:parseInt(_root.querySelector('#hpa-cap')?.value)||20, instructor:_root.querySelector('#hpa-inst')?.value.trim()||'미정', status:'active', fee:0 });
    _saveProgs(progs); showToast('프로그램이 등록됐습니다.','success')
      addNotification({ type: 'success', title: 'Health Program (관리자)', body: '프로그램이 등록됐습니다.' }); _tab='programs'; _draw();
  });
}
export function mount(root) { return render(root); }
