/**
 * volunteer-admin.js — 자원봉사 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS_ACTS   = 'hr_volunteer_acts';
const LS_ENROLL = 'hr_volunteer_enroll';

const DEMO_ACTS = [
  { id:'VOL001', title:'한강 환경 정화 봉사', category:'환경', date:'2026-06-21', time:'09:00', location:'한강 뚝섬 유원지', capacity:20, desc:'한강 쓰레기 수거 및 환경 정화 활동', icon:'♻️', status:'open' },
  { id:'VOL002', title:'노인 복지관 급식 봉사', category:'복지', date:'2026-06-28', time:'11:00', location:'강남 노인복지관', capacity:15, desc:'독거 어르신 점심 식사 보조 및 말벗 봉사', icon:'🍲', status:'open' },
  { id:'VOL003', title:'아동 도서관 독서 지원', category:'교육', date:'2026-07-05', time:'10:00', location:'구립 어린이 도서관', capacity:10, desc:'초등학생 대상 독서 지도 및 학습 도우미', icon:'📚', status:'open' },
  { id:'VOL004', title:'장애인 생활 지원 봉사', category:'복지', date:'2026-07-12', time:'09:00', location:'장애인복지관', capacity:12, desc:'장애인 생활 보조 및 이동 지원 활동', icon:'🤝', status:'open' },
];

const LEGACY_ENROLL_IDS = new Set(['VE001','VE002','VE003','VE004']);

function _getActs() {
  const s = localStorage.getItem(LS_ACTS);
  if (!s) { localStorage.setItem(LS_ACTS, JSON.stringify(DEMO_ACTS)); return DEMO_ACTS; }
  try {
    const d = JSON.parse(s);
    return [...DEMO_ACTS.filter(da=>!d.find(a=>a.id===da.id)), ...d];
  } catch { return DEMO_ACTS; }
}
function _saveActs(l) { localStorage.setItem(LS_ACTS, JSON.stringify(l)); }
function _getEnroll() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_ENROLL) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_ENROLL_IDS.has(r.id));
    if (cleaned.length !== list.length) localStorage.setItem(LS_ENROLL, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}

const CATEGORIES = ['환경', '복지', '교육', '의료', '기타'];

let _tab    = 'acts';
let _selAct = null;
let _root   = null;

export function render(root) { _root=root; _tab='acts'; _selAct=null; _draw(); }
export function unmount() { _root=null;
  _tab = 'acts';
}

function _draw() {
  const acts   = _getActs();
  const enroll = _getEnroll();

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['acts','활동 목록'],['enroll','참가자 현황'],['create','활동 등록']].map(([k,l])=>`
    <button class="va-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='acts'   ? _renderActs(acts, enroll)
    : _tab==='enroll' ? _renderEnroll(acts, enroll)
    :                   _renderCreate()}
  </div>
</div>`;

  _root.querySelectorAll('.va-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _selAct=null; _draw(); }));
  _bindEvents();
}

function _renderActs(acts, enroll) {
  const total    = acts.length;
  const upcoming = acts.filter(a=>new Date(a.date)>=new Date()).length;
  const totalEnroll = enroll.length;

  return `
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
  ${[['전체',`${total}건`,'#4F46E5'],['예정',`${upcoming}건`,'#10B981'],['총 신청',`${totalEnroll}명`,'#F59E0B']].map(([l,v,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:18px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8">${l}</div>
  </div>`).join('')}
</div>

${[...acts].sort((a,b)=>a.date.localeCompare(b.date)).map(a=>{
  const cnt = enroll.filter(e=>e.actId===a.id).length;
  const pct = Math.round(cnt/a.capacity*100);
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px">
    <span style="font-size:24px;flex-shrink:0">${a.icon}</span>
    <div style="flex:1">
      <div style="font-size:13px;font-weight:700">${a.title}</div>
      <div style="font-size:11px;color:#94A3B8">${a.date} ${a.time} · ${a.location}</div>
    </div>
    <span style="font-size:10px;background:#EEF2FF;color:#4F46E5;padding:2px 7px;border-radius:99px">${a.category}</span>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
    <span style="color:#64748B">신청 ${cnt}/${a.capacity}명</span>
    <span style="font-weight:700;color:${pct>=100?'#EF4444':pct>=80?'#F59E0B':'#10B981'}">${pct}%</span>
  </div>
  <div style="background:var(--bg);border-radius:4px;height:4px">
    <div style="height:100%;border-radius:4px;background:#4F46E5;width:${Math.min(pct,100)}%"></div>
  </div>
</div>`; }).join('')}`;
}

function _renderEnroll(acts, enroll) {
  const filtered = _selAct ? enroll.filter(e=>e.actId===_selAct) : enroll;
  return `
<div style="margin-bottom:10px">
  <select id="va-filter"
    style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
           background:var(--bg);color:var(--text);font-size:12px">
    <option value="">전체 활동</option>
    ${acts.map(a=>`<option value="${a.id}" ${_selAct===a.id?'selected':''}>${a.title}</option>`).join('')}
  </select>
</div>
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700">
    ${_selAct ? acts.find(a=>a.id===_selAct)?.title : '전체'} · ${filtered.length}명
  </div>
  ${!filtered.length ? `<div style="padding:24px;text-align:center;color:#94A3B8;font-size:12px">참가자가 없습니다.</div>` :
  filtered.map(e=>{
    const a = acts.find(x=>x.id===e.actId);
    return `
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:12px;font-weight:600">${e.empName}</div>
      ${!_selAct?`<div style="font-size:10px;color:#94A3B8">${a?a.title:''}</div>`:''}
    </div>
    <span style="font-size:11px;color:#94A3B8">${e.enrollAt}</span>
  </div>`; }).join('')}
</div>`;
}

function _renderCreate() {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:14px">봉사 활동 등록</div>
  <div style="display:flex;flex-direction:column;gap:10px">
    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">활동명 *</div>
      <input id="va-title" type="text" placeholder="봉사 활동 제목"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
               background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">카테고리</div>
        <select id="va-cat" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px">
          ${CATEGORIES.map(c=>`<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">정원</div>
        <input id="va-cap" type="number" value="20" min="1"
          style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">일자 *</div>
        <input id="va-date" type="date" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">시간</div>
        <input id="va-time" type="time" value="09:00" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
      </div>
    </div>
    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">장소</div>
      <input id="va-loc" type="text" placeholder="봉사 장소"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
               background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
    </div>
    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">설명</div>
      <textarea id="va-desc" rows="2" placeholder="활동 설명"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
               background:var(--bg);color:var(--text);font-size:12px;resize:none;box-sizing:border-box"></textarea>
    </div>
    <button id="va-submit" style="padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">등록</button>
  </div>
</div>`;
}

function _bindEvents() {
  _root.querySelector('#va-filter')?.addEventListener('change',e=>{ _selAct=e.target.value||null; _draw(); });

  _root.querySelector('#va-submit')?.addEventListener('click',()=>{
    const title = _root.querySelector('#va-title')?.value.trim();
    const date  = _root.querySelector('#va-date')?.value;
    if (!title||!date) { showToast('활동명과 일자를 입력해 주세요.', 'error'); return; }
    const ICONS = { '환경':'♻️', '복지':'🤝', '교육':'📚', '의료':'🏥', '기타':'🌟' };
    const cat   = _root.querySelector('#va-cat')?.value||'기타';
    const acts  = _getActs();
    acts.push({
      id:       'VOL'+Date.now(),
      title,
      category: cat,
      date,
      time:     _root.querySelector('#va-time')?.value||'09:00',
      location: _root.querySelector('#va-loc')?.value||'-',
      capacity: parseInt(_root.querySelector('#va-cap')?.value)||20,
      desc:     _root.querySelector('#va-desc')?.value||'',
      icon:     ICONS[cat]||'🌟',
      status:   'open',
    });
    _saveActs(acts);
    showToast('봉사 활동이 등록됐습니다.', 'success')
      addNotification({ type: 'success', title: 'Volunteer (관리자)', body: '봉사 활동이 등록됐습니다.' });
    _tab='acts'; _draw();
  });
}
export function mount(root) { return render(root); }
