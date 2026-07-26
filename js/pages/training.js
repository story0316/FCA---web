/**
 * training.js — 사내 교육 카탈로그 (수강 신청 · 완료 기록)
 */

import {getUser, isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId() {
  const s = _session();
  return s.empId || s.userId || getUser()?.id || 'EMP001';
}

const LS_TRAINING   = 'hr_training_records';
const LS_CATALOG    = 'hr_training_catalog';

const DEMO_CATALOG = [
  { id: 'TR001', title: 'Git & GitHub 실전 활용', category: '개발', level: '중급', duration: 120,
    instructor: '이준혁', desc: 'Git flow, PR 리뷰, CI/CD 연동까지 실습 위주 교육', maxSeats: 20,
    scheduledAt: '2026-06-20 14:00', format: 'online', tags: ['git', 'github', 'devops'] },
  { id: 'TR002', title: '리더십 & 팀 커뮤니케이션', category: '리더십', level: '초급', duration: 90,
    instructor: '외부 강사', desc: '효과적인 피드백 방법, 심리적 안전감 조성, 팀 동기부여 기법', maxSeats: 15,
    scheduledAt: '2026-06-25 10:00', format: 'offline', tags: ['리더십', '커뮤니케이션'] },
  { id: 'TR003', title: '데이터 분석 입문 (Python)', category: '데이터', level: '입문', duration: 180,
    instructor: '박데이터', desc: 'Pandas, Matplotlib 기초와 실무 데이터 분석 케이스 스터디', maxSeats: 12,
    scheduledAt: '2026-07-05 09:00', format: 'online', tags: ['python', '데이터분석'] },
  { id: 'TR004', title: '개인정보보호법 실무 교육', category: '법무', level: '전체', duration: 60,
    instructor: 'HR팀', desc: '개인정보보호법 개정 사항 및 사내 개인정보 처리 지침 안내', maxSeats: 50,
    scheduledAt: '2026-06-30 15:00', format: 'online', tags: ['개인정보', '법정교육'], mandatory: true },
  { id: 'TR005', title: '프레젠테이션 스킬 UP', category: '커뮤니케이션', level: '중급', duration: 120,
    instructor: '외부 강사', desc: '피라미드 구조, 스토리텔링, 청중 분석으로 설득력 있는 발표 만들기', maxSeats: 16,
    scheduledAt: '2026-07-10 14:00', format: 'offline', tags: ['발표', '커뮤니케이션'] },
  { id: 'TR006', title: 'OKR 설정 & 운영 워크숍', category: '경영', level: '전체', duration: 90,
    instructor: '김전략', desc: '조직·팀·개인 OKR 설계 방법과 분기 리뷰 프로세스 실습', maxSeats: 30,
    scheduledAt: '2026-07-15 10:00', format: 'offline', tags: ['OKR', '성과관리'] },
];

const CATEGORY_COLOR = {
  '개발': '#3B82F6', '리더십': '#8B5CF6', '데이터': '#10B981',
  '법무': '#EF4444', '커뮤니케이션': '#F59E0B', '경영': '#EC4899',
};

const FORMAT_ICON = { online: '💻', offline: '🏢' };
const LEVEL_COLOR = { '입문': '#10B981', '중급': '#F59E0B', '고급': '#EF4444', '전체': 'var(--text-muted)' };

function _getRecords() {
  const saved = localStorage.getItem(LS_TRAINING);
  if (!saved) {
    const demo = [
      { userId: 'demo', courseId: 'TR006', status: 'enrolled',   enrolledAt: '2026-06-01', completedAt: null },
      { userId: 'demo', courseId: 'TR004', status: 'completed',  enrolledAt: '2026-05-10', completedAt: '2026-05-30' },
    ];
    localStorage.setItem(LS_TRAINING, JSON.stringify(demo));
    return demo;
  }
  return JSON.parse(saved);
}

function _saveRecords(list) {
  localStorage.setItem(LS_TRAINING, JSON.stringify(list));
}

function _getCatalog() {
  try {
    const saved = localStorage.getItem(LS_CATALOG);
    return saved ? JSON.parse(saved) : DEMO_CATALOG;
  } catch { return DEMO_CATALOG; }
}

let _filterCat = 'all';
let _selectedId = null;
let _tab = 'catalog'; // 'catalog' | 'my'

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _filterCat = 'all'; _selectedId = null; _tab = 'catalog';
  _renderPage(root);
}

export function unmount() { _filterCat = 'all'; _selectedId = null; _tab = 'catalog'; }

function _renderPage(root) {
  if (_selectedId) { _renderDetail(root); return; }
  _renderList(root);
}

function _renderList(root) {
  const user = getUser();
  const userId = _empId();
  const catalog = _getCatalog();
  const records = _getRecords().filter(r => r.userId === userId);
  const cats = ['all', ...new Set(catalog.map(c => c.category))];

  const myEnrolled   = records.filter(r => r.status === 'enrolled').length;
  const myCompleted  = records.filter(r => r.status === 'completed').length;

  const filtered = _filterCat === 'all'
    ? catalog
    : catalog.filter(c => c.category === _filterCat);

  root.innerHTML = `
<div class="page" style="background:var(--bg);display:flex;flex-direction:column;height:100vh;overflow:hidden">
  <div class="top-bar" style="flex-shrink:0">
    <button class="btn btn-ghost btn-sm" onclick="window.navBack()" style="padding:8px;min-height:40px">←</button>
    <div class="top-bar-title" style="flex:1;text-align:center">🎓 사내 교육</div>
    <div style="min-width:40px"></div>
  </div>

  <!-- 탭 -->
  <div style="flex-shrink:0;display:flex;border-bottom:2px solid var(--border);background:var(--surface)">
    ${[{key:'catalog',label:`전체 과정 (${catalog.length})`},{key:'my',label:`내 수강 (${myEnrolled+myCompleted})`}].map(t => `
    <button class="tr-tab" data-tab="${t.key}"
      style="flex:1;padding:12px;font-size:13px;font-weight:600;background:none;border:none;
             cursor:pointer;border-bottom:2px solid ${_tab===t.key?'#4F46E5':'transparent'};
             margin-bottom:-2px;color:${_tab===t.key?'#4F46E5':'var(--text-muted)'}">
      ${t.label}
    </button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">

    ${_tab === 'my' ? _renderMyTraining(records, catalog) : `

    <!-- 카테고리 필터 -->
    <div style="display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin-bottom:14px;padding-bottom:4px">
      ${cats.map(c => {
        const color = c === 'all' ? '#4F46E5' : CATEGORY_COLOR[c] || 'var(--text-muted)';
        return `<button class="cat-btn" data-cat="${c}"
          style="flex-shrink:0;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;
                 cursor:pointer;border:2px solid ${_filterCat===c?color:'var(--border)'};
                 background:${_filterCat===c?color+'15':'var(--card-bg)'};
                 color:${_filterCat===c?color:'var(--text-muted)'}">${c === 'all' ? '전체' : c}</button>`;
      }).join('')}
    </div>

    <!-- 과정 목록 -->
    ${filtered.map(course => {
      const rec = records.find(r => r.courseId === course.id);
      const catColor = CATEGORY_COLOR[course.category] || 'var(--text-muted)';
      return `
    <div class="course-card" data-id="${course.id}"
      style="background:var(--card-bg);border:1px solid ${course.mandatory?'#EF4444':'var(--border)'};
             border-radius:14px;padding:14px;margin-bottom:10px;cursor:pointer;transition:border-color .15s"
      onmouseover="this.style.borderColor='${course.mandatory?'#EF4444':'#4F46E5'}'"
      onmouseout="this.style.borderColor='${course.mandatory?'#EF4444':'var(--border)'}'">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div style="flex:1;min-width:0;margin-right:8px">
          <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px">
            ${course.mandatory ? '<span style="background:#FEE2E2;color:#DC2626;font-size:10px;padding:2px 5px;border-radius:4px;font-weight:700;margin-right:4px">필수</span>' : ''}
            ${course.title}
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <span style="font-size:11px;padding:2px 7px;border-radius:8px;font-weight:600;
              background:${catColor}15;color:${catColor}">${course.category}</span>
            <span style="font-size:11px;color:${LEVEL_COLOR[course.level] || 'var(--text-muted)'};font-weight:600">${course.level}</span>
            <span style="font-size:11px;color:var(--text-muted)">${FORMAT_ICON[course.format]} ${course.format === 'online' ? '온라인' : '오프라인'} · ${course.duration}분</span>
          </div>
        </div>
        ${rec
          ? `<span style="font-size:11px;padding:3px 8px;border-radius:8px;font-weight:600;flex-shrink:0;
              background:${rec.status==='completed'?'#D1FAE5':'#EEF2FF'};
              color:${rec.status==='completed'?'#065F46':'#4338CA'}">
              ${rec.status === 'completed' ? '✓ 완료' : '수강 중'}</span>`
          : ''}
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">
        📅 ${course.scheduledAt} · 강사: ${course.instructor}
      </div>
      <div style="font-size:12px;color:var(--text);line-height:1.5;
           white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${course.desc}</div>
    </div>`;
    }).join('')}`}

  </div>
</div>`;

  root.querySelectorAll('.tr-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.tab; _renderPage(root); });
  });
  root.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => { _filterCat = btn.dataset.cat; _renderPage(root); });
  });
  root.querySelectorAll('.course-card').forEach(card => {
    card.addEventListener('click', () => { _selectedId = card.dataset.id; _renderPage(root); });
  });
  root.querySelectorAll('.complete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const records = _getRecords();
      const idx = records.findIndex(r => r.userId === userId && r.courseId === btn.dataset.id);
      if (idx >= 0) {
        records[idx].status = 'completed';
        records[idx].completedAt = new Date().toISOString().slice(0, 10);
        _saveRecords(records);
        const course = catalog.find(c => c.id === btn.dataset.id);
        addNotification({ type: 'system', title: `"${course?.title}" 교육을 완료했습니다! 🎓`, body: '' });
        showToast('수강 완료 처리되었습니다!', 'success');
        _renderPage(root);
      }
    });
  });
}

function _renderMyTraining(records, catalog) {
  const enrolled  = records.filter(r => r.status === 'enrolled');
  const completed = records.filter(r => r.status === 'completed');
  if (!records.length) return `<div style="text-align:center;padding:40px;color:var(--text-muted)">
    <div style="font-size:36px;margin-bottom:10px">🎓</div>
    <div style="font-weight:600;margin-bottom:6px">수강 중인 교육이 없습니다</div>
      <button onclick="document.querySelector('[data-tab=catalog]')?.click()" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">교육 과정 보기</button>
    
    <div style="font-size:13px">전체 과정 탭에서 원하는 교육을 신청해보세요!</div>
  </div>`;

  return `
${enrolled.length ? `
<div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px">📚 수강 중 (${enrolled.length})</div>
${enrolled.map(r => {
  const course = catalog.find(c => c.id === r.courseId);
  if (!course) return '';
  return `<div class="course-card" data-id="${course.id}"
    style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
           padding:12px;margin-bottom:8px;cursor:pointer">
    <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px">${course.title}</div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">📅 ${course.scheduledAt}</div>
    <button class="complete-btn" data-id="${course.id}"
      style="width:100%;background:#10B981;color:#fff;border:none;border-radius:8px;
             padding:8px;font-size:13px;font-weight:600;cursor:pointer">✓ 완료 처리</button>
  </div>`;
}).join('')}
<div style="height:1px;background:var(--border);margin:12px 0"></div>` : ''}

${completed.length ? `
<div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px">✅ 완료 (${completed.length})</div>
${completed.map(r => {
  const course = catalog.find(c => c.id === r.courseId);
  if (!course) return '';
  return `<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
      padding:12px;margin-bottom:8px;opacity:0.75">
    <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:3px">${course.title}</div>
    <div style="font-size:11px;color:var(--text-muted)">완료일: ${r.completedAt || r.enrolledAt}</div>
  </div>`;
}).join('')}` : ''}`;
}

function _renderDetail(root) {
  const user = getUser();
  const userId = _empId();
  const catalog = _getCatalog();
  const course = catalog.find(c => c.id === _selectedId);
  if (!course) { _selectedId = null; _renderPage(root); return; }

  const records = _getRecords();
  const myRec = records.find(r => r.userId === userId && r.courseId === course.id);
  const enrolled = records.filter(r => r.courseId === course.id).length;
  const catColor = CATEGORY_COLOR[course.category] || 'var(--text-muted)';

  root.innerHTML = `
<div class="page" style="background:var(--bg)">
  <div class="top-bar">
    <button id="back-btn" class="btn btn-ghost btn-sm" style="padding:8px;min-height:40px">←</button>
    <div class="top-bar-title" style="flex:1;text-align:center">교육 상세</div>
    <div style="min-width:40px"></div>
  </div>

  <div class="page-content" style="padding:16px">

    <div style="background:linear-gradient(135deg,${catColor},${catColor}99);border-radius:16px;
         padding:20px;color:#fff;margin-bottom:16px">
      ${course.mandatory ? '<div style="font-size:11px;background:rgba(255,255,255,0.25);display:inline-block;padding:2px 8px;border-radius:6px;font-weight:700;margin-bottom:8px">필수 교육</div>' : ''}
      <div style="font-size:18px;font-weight:800;margin-bottom:6px;line-height:1.4">${course.title}</div>
      <div style="font-size:12px;opacity:0.85">${course.category} · ${course.level} · ${course.duration}분</div>
    </div>

    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${_drow2('강사', course.instructor)}
        ${_drow2('형식', FORMAT_ICON[course.format] + ' ' + (course.format === 'online' ? '온라인' : '오프라인'))}
        ${_drow2('일시', course.scheduledAt)}
        ${_drow2('정원', `${enrolled} / ${course.maxSeats}명`)}
      </div>
    </div>

    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:6px">교육 소개</div>
      <div style="font-size:13px;color:var(--text);line-height:1.8">${course.desc}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">
        ${(course.tags || []).map(t => `<span style="background:var(--bg);border:1px solid var(--border);
          padding:3px 9px;border-radius:10px;font-size:11px;color:var(--text-muted)">#${t}</span>`).join('')}
      </div>
    </div>

    ${myRec
      ? `<div style="background:${myRec.status==='completed'?'#D1FAE5':'#EEF2FF'};border-radius:12px;
           padding:14px;text-align:center;margin-bottom:10px">
           <div style="font-size:20px;margin-bottom:4px">${myRec.status==='completed'?'✅':'📚'}</div>
           <div style="font-size:13px;font-weight:700;color:${myRec.status==='completed'?'#065F46':'#4338CA'}">
             ${myRec.status === 'completed' ? `수강 완료 · ${myRec.completedAt}` : '수강 신청 완료'}
           </div>
         </div>
         ${myRec.status === 'enrolled' ? `<button id="complete-btn" class="btn btn-primary" style="width:100%">
           ✓ 수강 완료 처리</button>` : ''}`
      : `<button id="enroll-btn" class="btn btn-primary" style="width:100%">수강 신청하기</button>`}

  </div>
</div>`;

  root.querySelector('#back-btn').addEventListener('click', () => { _selectedId = null; _renderPage(root); });

  root.querySelector('#enroll-btn')?.addEventListener('click', () => {
    const records = _getRecords();
    records.push({ userId, courseId: course.id, status: 'enrolled', enrolledAt: new Date().toISOString().slice(0,10), completedAt: null });
    _saveRecords(records);
    addNotification({ type: 'system', title: `"${course.title}" 교육을 신청했습니다! 🎓`, body: '' });
    showToast('수강 신청 완료!', 'success');
    _renderDetail(root);
  });

  root.querySelector('#complete-btn')?.addEventListener('click', () => {
    const records = _getRecords();
    const idx = records.findIndex(r => r.userId === userId && r.courseId === course.id);
    if (idx >= 0) { records[idx].status = 'completed'; records[idx].completedAt = new Date().toISOString().slice(0,10); _saveRecords(records); }
    addNotification({ type: 'system', title: `"${course.title}" 교육을 완료했습니다! 🎓`, body: '' });
    showToast('수강 완료 처리되었습니다!', 'success');
    _renderDetail(root);
  });
}

function _drow2(label, value) {
  return `<div>
    <div style="font-size:10px;color:var(--text-muted);font-weight:600;margin-bottom:2px">${label}</div>
    <div style="font-size:13px;color:var(--text);font-weight:500">${value}</div>
  </div>`;
}
