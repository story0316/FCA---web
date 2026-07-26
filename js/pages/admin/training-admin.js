/**
 * training-admin.js — 교육 과정 관리 (관리자)
 * export function render(root) + export function unmount()
 */

import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS_CATALOG = 'hr_training_catalog';
const LS_RECORDS = 'hr_training_records';

const CATEGORIES = ['개발', '리더십', '데이터', '법무', '커뮤니케이션', '경영', '기타'];
const FORMATS    = ['online', 'offline'];
const LEVELS     = ['입문', '중급', '고급', '전체'];

const CATEGORY_COLOR = {
  '개발':'#3B82F6','리더십':'#8B5CF6','데이터':'#10B981',
  '법무':'#EF4444','커뮤니케이션':'#F59E0B','경영':'#EC4899','기타':'#64748B',
};

const DEMO_CATALOG = [
  { id:'TR001', title:'Git & GitHub 실전 활용', category:'개발', level:'중급', duration:120, instructor:'이준혁', maxSeats:20, scheduledAt:'2026-06-20 14:00', format:'online', mandatory:false },
  { id:'TR002', title:'리더십 & 팀 커뮤니케이션', category:'리더십', level:'초급', duration:90, instructor:'외부 강사', maxSeats:15, scheduledAt:'2026-06-25 10:00', format:'offline', mandatory:false },
  { id:'TR003', title:'데이터 분석 입문 (Python)', category:'데이터', level:'입문', duration:180, instructor:'박데이터', maxSeats:12, scheduledAt:'2026-07-05 09:00', format:'online', mandatory:false },
  { id:'TR004', title:'개인정보보호법 실무 교육', category:'법무', level:'전체', duration:60, instructor:'HR팀', maxSeats:50, scheduledAt:'2026-06-30 15:00', format:'online', mandatory:true },
  { id:'TR005', title:'프레젠테이션 스킬 UP', category:'커뮤니케이션', level:'중급', duration:120, instructor:'외부 강사', maxSeats:16, scheduledAt:'2026-07-10 14:00', format:'offline', mandatory:false },
];

function _getCatalog() {
  const s = localStorage.getItem(LS_CATALOG);
  if (!s) { localStorage.setItem(LS_CATALOG, JSON.stringify(DEMO_CATALOG)); return DEMO_CATALOG; }
  try { return JSON.parse(s); } catch { return DEMO_CATALOG; }
}
function _saveCatalog(l) { localStorage.setItem(LS_CATALOG, JSON.stringify(l)); }
function _getRecords() { try { return JSON.parse(localStorage.getItem(LS_RECORDS)||'[]'); } catch { return []; } }

let _view = 'list'; // list | add
let _selCourse = null;

export function render(root) { _view = 'list'; _selCourse = null; _draw(root); }
export function unmount() { _view = 'list'; _selCourse = null; }

function _draw(root) {
  if (_view === 'add')    { _drawAdd(root); return; }
  if (_selCourse)         { _drawDetail(root, _selCourse); return; }
  _drawList(root);
}

function _drawList(root) {
  const catalog = _getCatalog();
  const records = _getRecords();

  const totalCourses    = catalog.length;
  const totalEnrollments = records.filter(r=>r.status!=='cancelled').length;
  const completions      = records.filter(r=>r.status==='completed').length;
  const mandatoryCnt     = catalog.filter(c=>c.mandatory).length;

  root.innerHTML = `
<!-- KPI -->
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:14px">
  ${[
    {label:'개설 과정', value:totalCourses+'개',   color:'#4F46E5'},
    {label:'수강 신청', value:totalEnrollments+'건',color:'#3B82F6'},
    {label:'이수 완료', value:completions+'건',     color:'#10B981'},
    {label:'필수 교육', value:mandatoryCnt+'개',    color:'#EF4444'},
  ].map(k=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:8px;text-align:center">
    <div style="font-size:14px;font-weight:800;color:${k.color}">${k.value}</div>
    <div style="font-size:9px;color:#64748B;margin-top:1px">${k.label}</div>
  </div>`).join('')}
</div>

<button id="ta-add-btn"
  style="width:100%;padding:11px;background:#4F46E5;color:#fff;border:none;border-radius:10px;
         font-size:13px;font-weight:700;cursor:pointer;margin-bottom:14px">+ 새 과정 등록</button>

<!-- 과정 목록 -->
${catalog.map(c => {
  const enrolled  = records.filter(r=>r.courseId===c.id && r.status!=='cancelled').length;
  const completed = records.filter(r=>r.courseId===c.id && r.status==='completed').length;
  const compRate  = c.maxSeats ? Math.round((completed/c.maxSeats)*100) : 0;
  const catColor  = CATEGORY_COLOR[c.category]||'#64748B';
  return `
<div class="ta-course-card" data-id="${c.id}"
  style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:8px;cursor:pointer">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;
          color:#fff;background:${catColor}">${c.category}</span>
        ${c.mandatory?`<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;background:#FEE2E2;color:#DC2626">필수</span>`:''}
        <span style="font-size:10px;color:#94A3B8">${c.format==='online'?'💻 온라인':'🏢 오프라인'}</span>
      </div>
      <div style="font-size:13px;font-weight:700;color:var(--text)">${c.title}</div>
      <div style="font-size:11px;color:#64748B;margin-top:2px">${c.instructor} · ${c.duration}분 · ${c.scheduledAt}</div>
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
    <div style="flex:1;background:#E2E8F0;border-radius:99px;height:4px">
      <div style="background:${catColor};height:4px;border-radius:99px;width:${Math.min(100,(enrolled/Math.max(1,c.maxSeats))*100)}%"></div>
    </div>
    <div style="font-size:11px;color:#64748B;flex-shrink:0">${enrolled}/${c.maxSeats}명 · 이수 ${completed}명</div>
  </div>
</div>`;
}).join('')}
${!catalog.length?`<div style="text-align:center;padding:40px;color:#94A3B8;font-size:13px">등록된 교육 과정이 없습니다.</div>`:''}`;

  root.querySelector('#ta-add-btn').addEventListener('click', () => { _view = 'add'; _draw(root); });
  root.querySelectorAll('.ta-course-card').forEach(card => {
    card.addEventListener('click', () => {
      _selCourse = _getCatalog().find(c=>c.id===card.dataset.id);
      _draw(root);
    });
  });
}

function _drawDetail(root, course) {
  const records   = _getRecords().filter(r=>r.courseId===course.id);
  const enrolled  = records.filter(r=>r.status==='enrolled');
  const completed = records.filter(r=>r.status==='completed');
  const catColor  = CATEGORY_COLOR[course.category]||'#64748B';

  root.innerHTML = `
<button id="ta-back-detail"
  style="display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;
         color:#4F46E5;font-size:13px;font-weight:600;padding:0;margin-bottom:14px">← 목록으로</button>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px">
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
    <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;color:#fff;background:${catColor}">${course.category}</span>
    <span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:6px;background:#EEF2FF;color:#4F46E5">${course.level}</span>
    ${course.mandatory?`<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:#FEE2E2;color:#DC2626">필수</span>`:''}
    <span style="font-size:10px;padding:2px 8px;border-radius:6px;background:var(--bg);color:#64748B">${course.format==='online'?'💻 온라인':'🏢 오프라인'}</span>
  </div>
  <div style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:6px">${course.title}</div>
  ${[['강사',course.instructor],['시간',course.duration+'분'],['일정',course.scheduledAt],['정원',course.maxSeats+'명']].map(([k,v])=>`
  <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">
    <span style="color:#64748B">${k}</span><span style="font-weight:600;color:var(--text)">${v}</span>
  </div>`).join('')}
</div>

<!-- 수강자 현황 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
  <div style="font-size:13px;font-weight:700;margin-bottom:10px">수강자 현황 (${records.length}명)</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
    <div style="background:#EEF2FF;border-radius:10px;padding:10px;text-align:center">
      <div style="font-size:18px;font-weight:800;color:#4F46E5">${enrolled.length}</div>
      <div style="font-size:10px;color:#64748B">수강 중</div>
    </div>
    <div style="background:#D1FAE5;border-radius:10px;padding:10px;text-align:center">
      <div style="font-size:18px;font-weight:800;color:#10B981">${completed.length}</div>
      <div style="font-size:10px;color:#64748B">이수 완료</div>
    </div>
  </div>

  ${records.length ? records.map(r=>`
  <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
    <div>
      <div style="font-size:12px;font-weight:600;color:var(--text)">${r.empName||r.empId}</div>
      <div style="font-size:10px;color:#94A3B8">${r.enrolledAt?.slice(0,10)||''}</div>
    </div>
    <div style="display:flex;align-items:center;gap:6px">
      <span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:8px;
        color:${r.status==='completed'?'#10B981':'#F59E0B'};
        background:${r.status==='completed'?'#D1FAE5':'#FEF3C7'}">
        ${r.status==='completed'?'이수':'수강중'}</span>
      ${r.status==='enrolled'?`<button class="ta-complete-btn" data-rec-id="${r.id}"
        style="font-size:10px;padding:3px 8px;background:#EEF2FF;color:#4F46E5;border:1px solid #C7D2FE;border-radius:6px;cursor:pointer">이수처리</button>`:''}
    </div>
  </div>`).join('') : `<div style="text-align:center;padding:20px;color:#94A3B8;font-size:12px">수강 신청자가 없습니다.</div>`}
</div>

<button id="ta-delete-course"
  style="width:100%;padding:10px;background:#FEE2E2;color:#DC2626;border:1px solid #FCA5A5;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">과정 삭제</button>`;

  root.querySelector('#ta-back-detail').addEventListener('click', () => { _selCourse=null; _draw(root); });

  root.querySelectorAll('.ta-complete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const recs = _getRecords();
      const idx  = recs.findIndex(r=>r.id===btn.dataset.recId);
      if (idx!==-1) { recs[idx].status='completed'; recs[idx].completedAt=new Date().toISOString(); localStorage.setItem(LS_RECORDS, JSON.stringify(recs)); }
      showToast('이수 처리되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Training (관리자)', body: '이수 처리되었습니다.' });
      _selCourse = _getCatalog().find(c=>c.id===course.id);
      _draw(root);
    });
  });

  root.querySelector('#ta-delete-course').addEventListener('click', () => {
    if (!confirm(`"${course.title}" 과정을 삭제하시겠습니까?`)) return;
    _saveCatalog(_getCatalog().filter(c=>c.id!==course.id));
    showToast('과정이 삭제되었습니다.', 'info');
    _selCourse = null;
    _draw(root);
  });
}

function _drawAdd(root) {
  root.innerHTML = `
<button id="ta-back-add"
  style="display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;
         color:#4F46E5;font-size:13px;font-weight:600;padding:0;margin-bottom:14px">← 목록으로</button>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="font-size:13px;font-weight:700;margin-bottom:12px">📚 교육 과정 등록</div>

  <div style="margin-bottom:10px">
    <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">과정명</label>
    <input id="ta-title" type="text" placeholder="예: 리더십 역량 개발 과정"
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
    <div>
      <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">카테고리</label>
      <select id="ta-cat" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
        ${CATEGORIES.map(c=>`<option>${c}</option>`).join('')}
      </select>
    </div>
    <div>
      <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">레벨</label>
      <select id="ta-level" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
        ${LEVELS.map(l=>`<option>${l}</option>`).join('')}
      </select>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
    <div>
      <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">형식</label>
      <select id="ta-format" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
        <option value="online">온라인</option>
        <option value="offline">오프라인</option>
      </select>
    </div>
    <div>
      <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">시간 (분)</label>
      <input id="ta-duration" type="number" value="90" min="30" step="30"
        style="width:100%;padding:9px 10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
    <div>
      <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">강사</label>
      <input id="ta-instructor" type="text" placeholder="강사명"
        style="width:100%;padding:9px 10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
    <div>
      <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">정원</label>
      <input id="ta-seats" type="number" value="20" min="1"
        style="width:100%;padding:9px 10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
  </div>

  <div style="margin-bottom:10px">
    <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">일정 (날짜 시간)</label>
    <input id="ta-schedule" type="datetime-local"
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>

  <div style="margin-bottom:16px;display:flex;align-items:center;gap:8px">
    <input id="ta-mandatory" type="checkbox" style="width:16px;height:16px;accent-color:#4F46E5">
    <label for="ta-mandatory" style="font-size:12px;font-weight:600;color:var(--text);cursor:pointer">필수 교육으로 지정</label>
  </div>

  <button id="ta-save-btn"
    style="width:100%;background:#4F46E5;color:#fff;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer">등록하기</button>
</div>`;

  root.querySelector('#ta-back-add').addEventListener('click', () => { _view='list'; _draw(root); });
  root.querySelector('#ta-save-btn').addEventListener('click', () => {
    const title      = root.querySelector('#ta-title').value.trim();
    const instructor = root.querySelector('#ta-instructor').value.trim();
    if (!title)      { showToast('과정명을 입력하세요.', 'error'); return; }
    if (!instructor) { showToast('강사명을 입력하세요.', 'error'); return; }

    const schedule = root.querySelector('#ta-schedule').value;
    const catalog  = _getCatalog();
    catalog.push({
      id: 'TR_'+Date.now(),
      title,
      category:    root.querySelector('#ta-cat').value,
      level:       root.querySelector('#ta-level').value,
      format:      root.querySelector('#ta-format').value,
      duration:    parseInt(root.querySelector('#ta-duration').value)||90,
      instructor,
      maxSeats:    parseInt(root.querySelector('#ta-seats').value)||20,
      scheduledAt: schedule ? schedule.replace('T',' ') : '',
      mandatory:   root.querySelector('#ta-mandatory').checked,
    });
    _saveCatalog(catalog);
    showToast('교육 과정이 등록되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Training (관리자)', body: '교육 과정이 등록되었습니다.' });
    _view = 'list';
    _draw(root);
  });
}
export function mount(root) { return render(root); }
