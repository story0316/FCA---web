/**
 * seminar-admin.js — 세미나 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS_SEMINARS = 'hr_seminars';
const LS_ENROLL   = 'hr_seminar_enrollments';

const DEMO_SEMINARS = [
  { id:'SEM001', title:'리더십 코칭 워크숍',       instructor:'김현우 코치',   category:'리더십',  datetime:'2026-06-20T14:00', location:'대회의실 A',  capacity:30, fee:0,      desc:'팀 리더를 위한 실전 코칭 스킬 향상 프로그램입니다.', status:'open', createdAt:'2026-06-01' },
  { id:'SEM002', title:'데이터 분석 입문',          instructor:'박지은 강사',   category:'데이터',  datetime:'2026-06-25T10:00', location:'교육실 2층',  capacity:20, fee:50000,  desc:'Python 기반 데이터 분석 기초 과정으로 실습 위주로 진행됩니다.', status:'open', createdAt:'2026-06-02' },
  { id:'SEM003', title:'효과적인 커뮤니케이션',     instructor:'이미래 강사',   category:'커뮤니케이션', datetime:'2026-07-05T13:00', location:'대회의실 B', capacity:40, fee:0, desc:'조직 내 커뮤니케이션 스킬과 갈등 해결 방법을 배웁니다.', status:'open', createdAt:'2026-06-03' },
  { id:'SEM004', title:'디자인 씽킹 워크숍',       instructor:'최현진 퍼실리테이터', category:'혁신', datetime:'2026-07-10T09:00', location:'크리에이티브룸', capacity:15, fee:30000, desc:'문제를 창의적으로 해결하는 디자인 씽킹 방법론을 실습합니다.', status:'closed', createdAt:'2026-05-15' },
];

const LEGACY_ENROLL_IDS = new Set(['ENR001','ENR002','ENR003','ENR004','ENR005']);

function _loadSeminars() {
  const s = localStorage.getItem(LS_SEMINARS);
  if (!s) { localStorage.setItem(LS_SEMINARS, JSON.stringify(DEMO_SEMINARS)); return DEMO_SEMINARS; }
  try {
    const d = JSON.parse(s);
    return [...DEMO_SEMINARS.filter(dm => !d.find(r => r.id === dm.id)), ...d];
  } catch { return DEMO_SEMINARS; }
}

function _saveSeminars(list) { localStorage.setItem(LS_SEMINARS, JSON.stringify(list)); }

function _loadEnrollments() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_ENROLL) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_ENROLL_IDS.has(r.id));
    if (cleaned.length !== list.length) _saveEnrollments(cleaned);
    return cleaned;
  } catch { return []; }
}

function _saveEnrollments(list) { localStorage.setItem(LS_ENROLL, JSON.stringify(list)); }

let _tab = '세미나목록';
let _root = null;

export function render(root) { _root = root; _tab = '세미나목록'; _draw(); }
export function unmount() { _root = null;
  _tab = '세미나목록';
}

function _draw() {
  const seminars    = _loadSeminars();
  const enrollments = _loadEnrollments();
  const openCount   = seminars.filter(s => s.status === 'open').length;
  const totalEnroll = enrollments.length;

  _root.innerHTML = `
<div style="padding:0">
  <!-- 탭 -->
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[
      ['세미나목록', '세미나 목록'],
      ['신청현황',   '신청 현황'],
      ['세미나등록', '세미나 등록'],
    ].map(([k, l]) => `
    <button class="sea-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab === k ? 'var(--primary)' : 'transparent'};
             color:${_tab === k ? 'var(--primary)' : '#94A3B8'}">${l}</button>`).join('')}
  </div>

  <div style="padding:14px 16px">
    <!-- 통계 카드 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
      ${[
        { l: '진행 중 세미나', v: openCount + '개',      c: '#4F46E5' },
        { l: '총 신청 인원',   v: totalEnroll + '명',     c: '#10B981' },
      ].map(k => `
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
           padding:14px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:${k.c}">${k.v}</div>
        <div style="font-size:11px;color:#64748B;margin-top:3px">${k.l}</div>
      </div>`).join('')}
    </div>

    ${_tab === '세미나목록' ? _renderSeminars(seminars, enrollments) :
      _tab === '신청현황'   ? _renderEnrollments(seminars, enrollments) :
      _renderRegisterForm()}
  </div>
</div>`;

  _root.querySelectorAll('.sea-tab').forEach(b =>
    b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderSeminars(seminars, enrollments) {
  if (!seminars.length) return `
  <div style="text-align:center;padding:40px 20px;color:#94A3B8">
    <div style="font-size:36px;margin-bottom:8px">🎓</div>
    <div style="font-size:13px;font-weight:600">등록된 세미나가 없습니다</div>
    <div style="font-size:12px;margin-top:4px">세미나 등록 탭에서 새 세미나를 추가하세요</div>
  </div>`;

  return seminars.map(sem => {
    const count = enrollments.filter(e => e.seminarId === sem.id).length;
    const isOpen = sem.status === 'open';
    return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:14px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:8px;
            color:${isOpen ? '#059669' : '#94A3B8'};background:${isOpen ? '#D1FAE5' : '#F1F5F9'}">${isOpen ? '모집 중' : '마감'}</span>
          <span style="font-size:11px;color:#64748B">${sem.category}</span>
        </div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${sem.title}</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">${sem.instructor}</div>
        <div style="font-size:11px;color:#94A3B8;margin-top:1px">${sem.datetime ? sem.datetime.replace('T',' ') : ''} · ${sem.location}</div>
        <div style="font-size:11px;color:#94A3B8;margin-top:1px">정원 ${sem.capacity}명 · 참가비 ${sem.fee ? sem.fee.toLocaleString() + '원' : '무료'}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;margin-left:8px">
        <div style="font-size:16px;font-weight:800;color:#4F46E5">${count}명</div>
        <div style="font-size:10px;color:#94A3B8">신청</div>
      </div>
    </div>
    ${isOpen ? `
    <button class="sea-close" data-id="${sem.id}"
      style="width:100%;background:#FEF3C7;color:#92400E;border:none;border-radius:8px;
             padding:8px;font-size:12px;font-weight:600;cursor:pointer;margin-top:8px">🔒 모집 마감 처리</button>` : ''}
  </div>`;
  }).join('');
}

function _renderEnrollments(seminars, enrollments) {
  if (!enrollments.length) return `
  <div style="text-align:center;padding:40px 20px;color:#94A3B8">
    <div style="font-size:36px;margin-bottom:8px">📋</div>
    <div style="font-size:13px;font-weight:600">신청 내역이 없습니다</div>
  </div>`;

  // Group by seminar
  const grouped = {};
  enrollments.forEach(e => {
    if (!grouped[e.seminarId]) grouped[e.seminarId] = { title: e.seminarTitle, items: [] };
    grouped[e.seminarId].items.push(e);
  });

  return Object.entries(grouped).map(([semId, group]) => `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:14px;margin-bottom:10px">
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">
      ${group.title}
      <span style="font-size:11px;font-weight:600;color:#4F46E5;background:#EEF2FF;
        padding:2px 8px;border-radius:8px;margin-left:6px">${group.items.length}명</span>
    </div>
    ${group.items.map(e => `
    <div style="display:flex;justify-content:space-between;align-items:center;
         padding:7px 0;border-bottom:1px solid var(--border)">
      <div>
        <span style="font-size:12px;font-weight:600;color:var(--text)">${e.empName}</span>
        <span style="font-size:11px;color:#64748B;margin-left:6px">${e.dept}</span>
      </div>
      <span style="font-size:11px;color:#94A3B8">${e.enrolledAt}</span>
    </div>`).join('')}
  </div>`).join('');
}

function _renderRegisterForm() {
  return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
    <div style="font-size:13px;font-weight:700;margin-bottom:14px">새 세미나 등록</div>
    ${_field('sea-title',    '제목',             'text',           '세미나 제목을 입력하세요')}
    ${_field('sea-instructor','강사',            'text',           '강사명 또는 기관명')}
    <div style="margin-bottom:12px">
      <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">카테고리</label>
      <select id="sea-category" style="width:100%;padding:9px;border:1.5px solid var(--border);
        border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
        ${['리더십','데이터','커뮤니케이션','혁신','기술','기타'].map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
    </div>
    ${_field('sea-datetime', '일시',             'datetime-local', '')}
    ${_field('sea-location', '장소',             'text',           '회의실 또는 온라인')}
    ${_field('sea-capacity', '정원',             'number',         '20')}
    ${_field('sea-fee',      '참가비 (원)',       'number',         '0')}
    <div style="margin-bottom:12px">
      <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">설명</label>
      <textarea id="sea-desc" rows="3" placeholder="세미나 설명을 입력하세요"
        style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
               font-size:13px;background:var(--bg);color:var(--text);resize:vertical;box-sizing:border-box"></textarea>
    </div>
    <button id="sea-submit"
      style="width:100%;background:var(--primary,#4F46E5);color:#fff;border:none;border-radius:10px;
             padding:12px;font-size:14px;font-weight:700;cursor:pointer;margin-top:4px">등록하기</button>
  </div>`;
}

function _field(id, label, type, placeholder) {
  return `<div style="margin-bottom:12px">
    <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">${label}</label>
    <input id="${id}" type="${type}" placeholder="${placeholder}"
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>`;
}

function _bindEvents() {
  if (!_root) return;

  _root.querySelectorAll('.sea-close').forEach(btn =>
    btn.addEventListener('click', () => {
      const list = _loadSeminars();
      const idx  = list.findIndex(s => s.id === btn.dataset.id);
      if (idx >= 0) { list[idx].status = 'closed'; list[idx].closedAt = new Date().toISOString().slice(0,10); _saveSeminars(list); }
      showToast('세미나 모집이 마감되었습니다.', 'info');
      _draw();
    }));

  const submitBtn = _root.querySelector('#sea-submit');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const title      = (_root.querySelector('#sea-title')?.value || '').trim();
      const instructor = (_root.querySelector('#sea-instructor')?.value || '').trim();
      const datetime   = _root.querySelector('#sea-datetime')?.value || '';
      const location   = (_root.querySelector('#sea-location')?.value || '').trim();
      const capacity   = parseInt(_root.querySelector('#sea-capacity')?.value || '0', 10);
      const fee        = parseInt(_root.querySelector('#sea-fee')?.value || '0', 10);
      const category   = _root.querySelector('#sea-category')?.value || '기타';
      const desc       = (_root.querySelector('#sea-desc')?.value || '').trim();

      if (!title)    { showToast('제목을 입력하세요.', 'error'); return; }
      if (!datetime) { showToast('일시를 입력하세요.', 'error'); return; }
      if (!location) { showToast('장소를 입력하세요.', 'error'); return; }

      const list = _loadSeminars();
      list.push({
        id:         'SEM_' + Date.now(),
        title, instructor, category, datetime, location, capacity, fee, desc,
        status:     'open',
        createdAt:  new Date().toISOString().slice(0, 10),
      });
      _saveSeminars(list);
      showToast('세미나가 등록되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Seminar (관리자)', body: '세미나가 등록되었습니다.' });
      _tab = '세미나목록';
      _draw();
    });
  }
}
export function mount(root) { return render(root); }
