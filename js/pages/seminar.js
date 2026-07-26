/**
 * seminar.js — 세미나 신청 (직원용)
 * Route: #/seminar
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS_SEMINARS = 'hr_seminars';
const LS_ENROLL   = 'hr_seminar_enrollments';

const DEMO_SEMINARS = [
  { id: 'sem001', title: 'AI 시대의 HR 트렌드 2026', speaker: '박미래 교수 (연세대)', category: 'HR트렌드', date: '2026-06-20', venue: '본사 대강당 3F', maxHeadcount: 100, desc: 'AI가 HR 업무에 미치는 영향과 미래 인재 관리 전략에 대해 살펴봅니다.', fee: 0, status: 'open' },
  { id: 'sem002', title: '데이터 기반 의사결정 워크숍', speaker: '김데이터 이사 (빅데이터코리아)', category: '데이터분석', date: '2026-06-25', venue: '세미나실 201호', maxHeadcount: 30, desc: 'Excel과 Python을 활용한 실무 데이터 분석 워크숍입니다. (노트북 필지참)', fee: 50000, status: 'open' },
  { id: 'sem003', title: '리더십과 코칭 스킬', speaker: '이성장 코치 (GrowthLab)', category: '리더십', date: '2026-07-10', venue: '교육센터 B홀', maxHeadcount: 50, desc: '효과적인 팀 리더십과 구성원 코칭 역량을 키우는 실전 프로그램입니다.', fee: 0, status: 'open' },
  { id: 'sem004', title: '스타트업 마인드셋 강연', speaker: '최창업 대표 (넥스트유니콘)', category: '창업/혁신', date: '2026-06-15', venue: '본사 강당', maxHeadcount: 200, desc: '실리콘밸리 경험을 바탕으로 한 혁신적 사고방식 강연입니다.', fee: 0, status: 'closed' },
];

function _loadSeminars() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_SEMINARS) || '[]');
    return [...DEMO_SEMINARS.filter(d => !saved.find(x => x.id === d.id)), ...saved];
  } catch { return [...DEMO_SEMINARS]; }
}
function _loadEnroll() {
  try { return JSON.parse(localStorage.getItem(LS_ENROLL) || '[]'); } catch { return []; }
}
function _saveEnroll(list) { localStorage.setItem(LS_ENROLL, JSON.stringify(list)); }
function _uid()  { try { return JSON.parse(localStorage.getItem('hr_session') || '{}').empId  || 'EMP001'; } catch { return 'EMP001'; } }
function _uname(){ try { return JSON.parse(localStorage.getItem('hr_session') || '{}').name   || '사용자'; } catch { return '사용자'; } }
function _today(){ return new Date().toISOString().slice(0, 10); }
function _fmt(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth()+1}월 ${d.getDate()}일 (${['일','월','화','수','목','금','토'][d.getDay()]})`;
}

let _tab = 'list';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'list';
  _draw(root);
}

export function unmount() { _tab = 'list'; }

function _draw(root) {
  const uid      = _uid();
  const seminars = _loadSeminars();
  const enrolls  = _loadEnroll();
  const myEnrolls = enrolls.filter(e => e.empId === uid);

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="sem-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🎓 세미나 신청</div>
      <div style="font-size:11px;color:var(--text-muted)">내 신청 ${myEnrolls.length}건</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['list','세미나 목록'],['mine','내 신청']].map(([k,l]) => `
    <button class="sem-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab === 'list' ? _renderList(seminars, enrolls, uid) : _renderMine(myEnrolls, seminars)}
  </div>
</div>`;

  root.querySelector('#sem-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.sem-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(root); }));

  root.querySelectorAll('.sem-enroll-btn').forEach(btn => {
    btn.addEventListener('click', () => _handleEnroll(btn.dataset.id, root));
  });
}

function _renderList(seminars, enrolls, uid) {
  if (!seminars.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:48px;margin-bottom:12px">🎓</div>
  <div style="font-size:15px;font-weight:600;margin-bottom:6px">진행 중인 세미나가 없어요</div>
  <div style="font-size:13px">새 세미나가 등록되면 알려드립니다.</div>
</div>`;

  return seminars.map(s => {
    const enrolled = enrolls.find(e => e.empId === uid && e.seminarId === s.id);
    const isClosed = s.status === 'closed';
    const isEnrolled = !!enrolled;
    const btnDisabled = isClosed || isEnrolled;

    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <span style="padding:3px 8px;border-radius:6px;font-size:10px;font-weight:600;
      background:#EEF2FF;color:#4F46E5">${s.category}</span>
    <span style="font-size:10px;font-weight:600;padding:3px 8px;border-radius:6px;
      background:${isClosed?'#FEE2E2':'#D1FAE5'};color:${isClosed?'#EF4444':'#059669'}">
      ${isClosed ? '마감' : '신청 가능'}
    </span>
  </div>

  <div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:4px">${s.title}</div>
  <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">${s.speaker}</div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
    <div style="background:#F8FAFC;border-radius:8px;padding:8px">
      <div style="font-size:10px;color:var(--text-muted)">일시</div>
      <div style="font-size:11px;font-weight:600;color:var(--text)">${_fmt(s.date)}</div>
    </div>
    <div style="background:#F8FAFC;border-radius:8px;padding:8px">
      <div style="font-size:10px;color:var(--text-muted)">장소</div>
      <div style="font-size:11px;font-weight:600;color:var(--text)">${s.venue}</div>
    </div>
    <div style="background:#F8FAFC;border-radius:8px;padding:8px">
      <div style="font-size:10px;color:var(--text-muted)">정원</div>
      <div style="font-size:11px;font-weight:600;color:var(--text)">${s.maxHeadcount}명</div>
    </div>
    <div style="background:#F8FAFC;border-radius:8px;padding:8px">
      <div style="font-size:10px;color:var(--text-muted)">참가비</div>
      <div style="font-size:11px;font-weight:600;color:${s.fee===0?'#059669':'#4F46E5'}">
        ${s.fee === 0 ? '무료' : s.fee.toLocaleString()+'원'}
      </div>
    </div>
  </div>

  <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;line-height:1.5">${s.desc}</div>

  <button class="sem-enroll-btn" data-id="${s.id}"
    ${btnDisabled ? 'disabled' : ''}
    style="width:100%;padding:10px;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:${btnDisabled?'not-allowed':'pointer'};
           background:${isEnrolled?'#D1FAE5':isClosed?'#F1F5F9':'#4F46E5'};
           color:${isEnrolled?'#059669':isClosed?'var(--text-muted)':'#fff'}">
    ${isEnrolled ? '✓ 신청 완료' : isClosed ? '마감되었습니다' : '신청하기'}
  </button>
</div>`;
  }).join('');
}

function _renderMine(myEnrolls, seminars) {
  if (!myEnrolls.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:48px;margin-bottom:12px">📋</div>
  <div style="font-size:15px;font-weight:600;margin-bottom:6px">신청한 세미나가 없어요</div>
  <div style="font-size:13px">세미나 목록에서 원하는 세미나를 신청하세요.</div>
</div>`;

  return myEnrolls.sort((a,b)=>b.enrollDate.localeCompare(a.enrollDate)).map(e => {
    const sem = seminars.find(s => s.id === e.seminarId);
    if (!sem) return '';
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div style="flex:1;min-width:0;margin-right:10px">
      <div style="font-size:13px;font-weight:700;color:var(--text)">${sem.title}</div>
      <div style="font-size:11px;color:var(--text-muted)">${sem.speaker}</div>
    </div>
    <span style="flex-shrink:0;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:600;
      background:#D1FAE5;color:#059669">신청 완료</span>
  </div>
  <div style="display:flex;gap:12px;font-size:11px;color:var(--text-muted)">
    <span>📅 ${_fmt(sem.date)}</span>
    <span>📍 ${sem.venue}</span>
    ${sem.fee > 0 ? `<span>💰 ${sem.fee.toLocaleString()}원</span>` : '<span style="color:#059669">무료</span>'}
  </div>
  <div style="font-size:10px;color:var(--text-muted);margin-top:4px">신청일 ${e.enrollDate}</div>
</div>`;
  }).join('');
}

function _handleEnroll(seminarId, root) {
  const uid    = _uid();
  const uname  = _uname();
  const enrolls = _loadEnroll();
  const sem    = _loadSeminars().find(s => s.id === seminarId);
  if (!sem)                  { showToast('세미나 정보를 찾을 수 없습니다.', 'error'); return; }
  if (sem.status === 'closed'){ showToast('마감된 세미나입니다.', 'warning'); return; }
  if (enrolls.find(e => e.empId === uid && e.seminarId === seminarId)) {
    showToast('이미 신청한 세미나입니다.', 'warning'); return;
  }
  enrolls.push({
    id: 'enr_' + Date.now(),
    empId: uid, empName: uname,
    seminarId, seminarTitle: sem.title,
    enrollDate: _today(),
  });
  _saveEnroll(enrolls);
  showToast(`"${sem.title}" 신청이 완료되었습니다!`, 'success')
    addNotification({ type: 'success', title: '세미나', body: '"" 신청이 완료되었습니다!' });
  _draw(root);
}
