/**
 * workshop-admin.js — 워크샵·단체활동 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS           = 'hr_workshops';
const LS_ENROLLMENTS = 'hr_ws_enrollments';

const DEMO_WORKSHOPS = [
  { id:'WS001', title:'2026 상반기 워크샵',  date:'2026-07-04', endDate:'2026-07-05', location:'강원도 속초', category:'워크샵', capacity:50, enrolled:38, cost:0, desc:'팀 빌딩 및 상반기 성과 공유', icon:'🏕️', status:'open' },
  { id:'WS002', title:'리더십 개발 캠프',    date:'2026-07-18', endDate:'2026-07-19', location:'경기도 가평', category:'리더십', capacity:20, enrolled:15, cost:0, desc:'팀장급 이상 리더십 역량 강화', icon:'🎯', status:'open' },
  { id:'WS003', title:'팀 스포츠 데이',      date:'2026-06-21', endDate:'2026-06-21', location:'올림픽공원', category:'스포츠',  capacity:100, enrolled:72, cost:0, desc:'전사 스포츠 대회 및 친목', icon:'⚽', status:'open' },
  { id:'WS004', title:'신입사원 OT 캠프',    date:'2026-06-14', endDate:'2026-06-15', location:'충청북도 음성', category:'교육', capacity:30, enrolled:12, cost:0, desc:'2026년 상반기 신입사원 OT', icon:'🎓', status:'open' },
  { id:'WS005', title:'사내 봉사 활동',      date:'2026-06-28', endDate:'2026-06-28', location:'서울 노원구', category:'봉사',   capacity:40, enrolled:28, cost:0, desc:'지역사회 봉사 및 CSR 활동', icon:'❤️', status:'open' },
];

const LEGACY_ENROLL_IDS = new Set(['WE001','WE002','WE003','WE004','WE005']);

function _getWorkshops() {
  const s = localStorage.getItem(LS);
  if (!s) { localStorage.setItem(LS, JSON.stringify(DEMO_WORKSHOPS)); return DEMO_WORKSHOPS; }
  try {
    const d = JSON.parse(s);
    return [...DEMO_WORKSHOPS.filter(dw=>!d.find(w=>w.id===dw.id)), ...d];
  } catch { return DEMO_WORKSHOPS; }
}
function _save(l) { localStorage.setItem(LS, JSON.stringify(l)); }
function _getEnrollments() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_ENROLLMENTS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_ENROLL_IDS.has(r.id));
    if (cleaned.length !== list.length) localStorage.setItem(LS_ENROLLMENTS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}

let _tab       = 'workshops';
let _selWs     = null;
let _showAdd   = false;
let _root      = null;

export function render(root) { _root=root; _tab='workshops'; _selWs=null; _showAdd=false; _draw(); }
export function unmount() { _root=null;
  _tab = 'workshops';
}

function _draw() {
  const workshops   = _getWorkshops();
  const enrollments = _getEnrollments();

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['workshops','워크샵 관리'],['enrollments','신청자 목록'],['add','워크샵 등록']].map(([k,l])=>`
    <button class="wsa-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='workshops'   ? _renderWorkshops(workshops, enrollments)
    : _tab==='enrollments' ? _renderEnrollments(workshops, enrollments)
    :                        _renderAdd()}
  </div>
</div>`;

  _root.querySelectorAll('.wsa-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _selWs=null; _draw(); }));
  _bindEvents();
}

function _renderWorkshops(workshops, enrollments) {
  const total    = workshops.length;
  const upcoming = workshops.filter(w=>new Date(w.date)>=new Date()).length;
  return `
<!-- KPI -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
  ${[
    ['총 프로그램', `${total}건`, '#4F46E5'],
    ['예정', `${upcoming}건`, '#10B981'],
  ].map(([l,v,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:20px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8">${l}</div>
  </div>`).join('')}
</div>

${workshops.map(w=>{
  const enrolled = enrollments.filter(e=>e.workshopId===w.id).length;
  const pct = Math.round(enrolled/w.capacity*100);
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div style="display:flex;gap:8px;align-items:center">
      <span style="font-size:20px">${w.icon}</span>
      <div>
        <div style="font-size:13px;font-weight:700">${w.title}</div>
        <div style="font-size:11px;color:#94A3B8">${w.date} · ${w.location}</div>
      </div>
    </div>
    <span style="font-size:11px;font-weight:600;padding:3px 8px;border-radius:8px;background:#EEF2FF;color:#4F46E5">${w.category}</span>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:6px">
    <span style="color:#64748B">신청 ${enrolled}/${w.capacity}명</span>
    <span style="font-weight:700;color:${pct>=100?'#EF4444':pct>=80?'#F59E0B':'#10B981'}">${pct}%</span>
  </div>
  <div style="background:var(--bg);border-radius:4px;height:4px">
    <div style="height:100%;border-radius:4px;background:#4F46E5;width:${Math.min(pct,100)}%"></div>
  </div>
</div>`; }).join('')}`;
}

function _renderEnrollments(workshops, enrollments) {
  const wsFilter = _selWs;
  const list = wsFilter ? enrollments.filter(e=>e.workshopId===wsFilter) : enrollments;
  const ws   = wsFilter ? workshops.find(w=>w.id===wsFilter) : null;

  return `
<div style="margin-bottom:10px">
  <select id="wsa-filter"
    style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
           background:var(--bg);color:var(--text);font-size:12px">
    <option value="">전체 워크샵</option>
    ${workshops.map(w=>`<option value="${w.id}" ${wsFilter===w.id?'selected':''}>${w.title}</option>`).join('')}
  </select>
</div>

${!list.length ? `
<div style="text-align:center;padding:40px;color:#94A3B8">
  <div style="font-size:32px;margin-bottom:8px">👥</div>
  <div style="font-size:13px">신청자가 없습니다.</div>
</div>` : `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700">
    ${ws?ws.title:'전체'} · ${list.length}명
  </div>
  ${list.map(e=>{
    const w = workshops.find(x=>x.id===e.workshopId);
    return `
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:12px;font-weight:600">${e.empName}</div>
      ${!wsFilter?`<div style="font-size:10px;color:#94A3B8">${w?w.title:''}</div>`:''}
    </div>
    <span style="font-size:11px;color:#94A3B8">${e.enrolledAt}</span>
  </div>`; }).join('')}
</div>`}`;
}

function _renderAdd() {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:14px">새 워크샵 등록</div>

  <div style="display:flex;flex-direction:column;gap:10px">
    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">제목 *</div>
      <input id="wsa-title" type="text" placeholder="워크샵 제목"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
               background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">시작일 *</div>
        <input id="wsa-date" type="date"
          style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
                 background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">종료일</div>
        <input id="wsa-enddate" type="date"
          style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
                 background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
      </div>
    </div>
    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">장소</div>
      <input id="wsa-loc" type="text" placeholder="장소"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
               background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">카테고리</div>
        <select id="wsa-cat"
          style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
                 background:var(--bg);color:var(--text);font-size:12px">
          ${['워크샵','리더십','스포츠','교육','봉사','기타'].map(c=>`<option>${c}</option>`).join('')}
        </select>
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">정원</div>
        <input id="wsa-cap" type="number" value="30" min="1"
          style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
                 background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
      </div>
    </div>
    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">설명</div>
      <textarea id="wsa-desc" rows="2" placeholder="프로그램 설명"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
               background:var(--bg);color:var(--text);font-size:12px;resize:none;box-sizing:border-box"></textarea>
    </div>
    <button id="wsa-submit"
      style="padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;
             font-size:13px;font-weight:700;cursor:pointer">등록</button>
  </div>
</div>`;
}

function _bindEvents() {
  _root.querySelector('#wsa-filter')?.addEventListener('change', e=>{
    _selWs = e.target.value || null; _draw();
  });

  _root.querySelector('#wsa-submit')?.addEventListener('click',()=>{
    const title = _root.querySelector('#wsa-title')?.value.trim();
    const date  = _root.querySelector('#wsa-date')?.value;
    if (!title||!date) { showToast('제목과 시작일을 입력해 주세요.', 'error'); return; }
    const catIcons = { 워크샵:'🏕️', 리더십:'🎯', 스포츠:'⚽', 교육:'🎓', 봉사:'❤️', 기타:'📅' };
    const cat = _root.querySelector('#wsa-cat')?.value || '기타';
    const ws  = _getWorkshops();
    ws.push({
      id:       'WS'+Date.now(),
      title,
      date,
      endDate:  _root.querySelector('#wsa-enddate')?.value || date,
      location: _root.querySelector('#wsa-loc')?.value || '-',
      category: cat,
      capacity: parseInt(_root.querySelector('#wsa-cap')?.value)||30,
      enrolled: 0,
      cost:     0,
      desc:     _root.querySelector('#wsa-desc')?.value || '',
      icon:     catIcons[cat]||'📅',
      status:   'open',
    });
    _save(ws);
    showToast('워크샵이 등록됐습니다.', 'success')
      addNotification({ type: 'success', title: 'Workshop (관리자)', body: '워크샵이 등록됐습니다.' });
    _tab='workshops'; _draw();
  });
}
export function mount(root) { return render(root); }
