/**
 * performance-review.js — 성과 평가 관리 (관리자)
 */

import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';

const LS_REVIEWS = 'hr_perf_reviews';
const LS_CYCLES  = 'hr_perf_cycles';

let _employees = [];

const COMPETENCIES = [
  '업무 전문성',
  '목표 달성',
  '팀워크·협업',
  '커뮤니케이션',
  '주도성·적극성',
  '성장·학습',
];

const RATING_META = {
  5: { label: 'Outstanding',  color: '#10B981', bg: '#D1FAE5' },
  4: { label: 'Exceeds',      color: '#3B82F6', bg: '#EFF6FF' },
  3: { label: 'Meets',        color: '#64748B', bg: '#F1F5F9' },
  2: { label: 'Below',        color: '#F59E0B', bg: '#FEF3C7' },
  1: { label: 'Unsatisfactory', color:'#EF4444', bg:'#FEF2F2' },
};

const LEGACY_CYCLE_IDS = new Set(['CYC001', 'CYC002']);
const LEGACY_IDS = new Set(['REV001','REV002','REV003','REV004','REV005','REV006']);

function _getCycles() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_CYCLES) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(c => !LEGACY_CYCLE_IDS.has(c.id));
    if (cleaned.length !== list.length) _saveCycles(cleaned);
    return cleaned;
  } catch { return []; }
}
function _saveCycles(l) { localStorage.setItem(LS_CYCLES, JSON.stringify(l)); }

function _getReviews() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_REVIEWS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_IDS.has(r.id));
    if (cleaned.length !== list.length) _saveReviews(cleaned);
    return cleaned;
  } catch { return []; }
}
function _saveReviews(l) { localStorage.setItem(LS_REVIEWS, JSON.stringify(l)); }

let _view = 'list';        // 'list' | 'cycle' | 'evaluate' | 'addCycle'
let _activeCycle = null;
let _activeReview = null;
let _root = null;

export async function mount(root) {
  _root = root; _view = 'list'; _activeCycle = null; _activeReview = null;
  _employees = await loadDisplayEmployees().catch(() => []);
  _renderPage(root);
}
export function render(root) { _root = root; _renderPage(root); }
export function unmount() { _view = 'list'; _activeCycle = null; _activeReview = null; _employees = []; _root = null; }

function _renderPage(root) {

  if (_view === 'cycle')    { _renderCycle(root); return; }
  if (_view === 'evaluate') { _renderEvaluate(root); return; }
  if (_view === 'addCycle') { _renderAddCycle(root); return; }
  _renderList(root);
}

function _renderList(root) {
  const cycles  = _getCycles();
  const reviews = _getReviews();
  const open    = cycles.find(c => c.status === 'open');
  const pendingCount = open ? reviews.filter(r => r.cycleId === open.id && r.status === 'pending').length : 0;
  const doneCount    = open ? reviews.filter(r => r.cycleId === open.id && r.status === 'done').length : 0;

  
  if (!cycles.length) { root.innerHTML = `<div style="text-align:center;padding:48px 20px;color:#94A3B8"><div style="font-size:40px;margin-bottom:10px">📊</div><div style="font-size:14px;font-weight:600;margin-bottom:4px">성과 평가 데이터가 없습니다.</div></div>`; return; }
root.innerHTML = `
<div style="padding:16px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
    <div style="font-size:15px;font-weight:700">📋 성과 평가 관리</div>
    <button id="add-cycle-btn" style="background:#4F46E5;color:#fff;border:none;border-radius:10px;
      padding:7px 12px;font-size:12px;font-weight:600;cursor:pointer">+ 평가 사이클</button>
  </div>

  ${open ? `
  <!-- 진행 중 배너 -->
  <div style="background:#EEF2FF;border:1.5px solid #4F46E5;border-radius:14px;padding:14px;margin-bottom:16px">
    <div style="font-size:12px;font-weight:700;color:#4338CA;margin-bottom:6px">🔔 진행 중인 평가</div>
    <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:8px">${open.name}</div>
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <div style="flex:1;background:#fff;border-radius:10px;padding:8px;text-align:center">
        <div style="font-size:16px;font-weight:800;color:#10B981">${doneCount}</div>
        <div style="font-size:10px;color:#64748B">완료</div>
      </div>
      <div style="flex:1;background:#fff;border-radius:10px;padding:8px;text-align:center">
        <div style="font-size:16px;font-weight:800;color:#F59E0B">${pendingCount}</div>
        <div style="font-size:10px;color:#64748B">대기</div>
      </div>
      <div style="flex:1;background:#fff;border-radius:10px;padding:8px;text-align:center">
        <div style="font-size:16px;font-weight:800;color:#64748B">${open.deadline}</div>
        <div style="font-size:10px;color:#64748B">마감일</div>
      </div>
    </div>
    <button class="cycle-btn" data-id="${open.id}"
      style="width:100%;background:#4F46E5;color:#fff;border:none;border-radius:10px;
             padding:10px;font-size:13px;font-weight:600;cursor:pointer">평가 진행하기</button>
  </div>` : ''}

  <!-- 평가 사이클 목록 -->
  <div style="font-size:12px;font-weight:700;color:#64748B;margin-bottom:8px">평가 사이클 이력</div>
  ${cycles.map(c => {
    const revs = reviews.filter(r => r.cycleId === c.id);
    const done = revs.filter(r => r.status === 'done').length;
    const avg  = done ? (revs.filter(r=>r.overall).reduce((s,r)=>s+r.overall,0)/done).toFixed(1) : '-';
    return `
  <div class="cycle-btn" data-id="${c.id}"
       style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
              padding:12px;margin-bottom:8px;cursor:pointer">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${c.name}</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">마감: ${c.deadline} · 평가 ${done}/${revs.length}명</div>
      </div>
      <span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:10px;
        color:${c.status==='open'?'#10B981':'#94A3B8'};background:${c.status==='open'?'#D1FAE5':'#F1F5F9'}">
        ${c.status==='open'?'진행 중':'완료'}
      </span>
    </div>
    ${done ? `<div style="margin-top:8px;font-size:12px;color:#4F46E5;font-weight:600">평균 ${avg}점 / 5점</div>` : ''}
  </div>`;
  }).join('')}

</div>`;

  root.querySelector('#add-cycle-btn').addEventListener('click', () => { _view = 'addCycle'; _renderPage(root); });
  root.querySelectorAll('.cycle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeCycle = _getCycles().find(c => c.id === btn.dataset.id) || null;
      _view = 'cycle';
      _renderPage(root);
    });
  });
}

function _renderCycle(root) {
  const c = _activeCycle;
  if (!c) { _view = 'list'; _renderPage(root); return; }
  const allReviews = _getReviews().filter(r => r.cycleId === c.id);

  // 평가 대상자가 없으면 모든 직원 자동 추가 (open 사이클인 경우)
  if (c.status === 'open' && allReviews.length === 0) {
    const newRevs = _employees.map(e => ({
      id: 'REV_' + Date.now() + '_' + e.id,
      cycleId: c.id,
      empId: e.id,
      scores: {},
      comment: '',
      overall: null,
      status: 'pending',
    }));
    const existing = _getReviews();
    _saveReviews([...existing, ...newRevs]);
  }

  const reviews = _getReviews().filter(r => r.cycleId === c.id);
  const done    = reviews.filter(r => r.status === 'done');
  const pending = reviews.filter(r => r.status === 'pending');

  root.innerHTML = `
<div style="padding:16px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
    <button id="back-btn" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text)">←</button>
    <div>
      <div style="font-size:14px;font-weight:700;color:var(--text)">${c.name}</div>
      <div style="font-size:11px;color:#64748B">마감: ${c.deadline} · 완료 ${done.length}/${reviews.length}명</div>
    </div>
  </div>

  <!-- 미완료 -->
  ${pending.length ? `
  <div style="font-size:12px;font-weight:700;color:#F59E0B;margin-bottom:8px">⏳ 평가 대기 (${pending.length}명)</div>
  ${pending.map(r => {
    const emp = _employees.find(e => e.id === r.empId) || { name:'?', dept:'?', title:'?' };
    return `
  <div style="background:var(--card-bg);border:1.5px solid #FEF3C7;border-radius:12px;
       padding:12px;margin-bottom:8px;display:flex;align-items:center;gap:10px">
    <div style="flex:1">
      <div style="font-size:13px;font-weight:600;color:var(--text)">${emp.name}</div>
      <div style="font-size:11px;color:#64748B">${emp.dept} · ${emp.title}</div>
    </div>
    <button class="eval-btn" data-rev-id="${r.id}"
      style="background:#4F46E5;color:#fff;border:none;border-radius:8px;
             padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer">평가하기</button>
  </div>`;
  }).join('')}` : ''}

  <!-- 완료 -->
  ${done.length ? `
  <div style="font-size:12px;font-weight:700;color:#10B981;margin-bottom:8px;margin-top:${pending.length?'14px':'0'}">
    ✅ 평가 완료 (${done.length}명)
  </div>
  ${done.map(r => {
    const emp = _employees.find(e => e.id === r.empId) || { name:'?', dept:'?', title:'?' };
    const rm  = RATING_META[Math.round(r.overall)] || RATING_META[3];
    return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:12px;margin-bottom:8px;display:flex;align-items:center;gap:10px">
    <div style="flex:1">
      <div style="font-size:13px;font-weight:600;color:var(--text)">${emp.name}</div>
      <div style="font-size:11px;color:#64748B">${emp.dept} · ${r.comment?.slice(0,30) || '코멘트 없음'}${r.comment?.length>30?'…':''}</div>
    </div>
    <div style="text-align:right;flex-shrink:0">
      <div style="font-size:14px;font-weight:800;color:${rm.color}">${r.overall?.toFixed(1)}</div>
      <span style="font-size:10px;padding:2px 7px;border-radius:8px;font-weight:600;
        color:${rm.color};background:${rm.bg}">${rm.label}</span>
    </div>
  </div>`;
  }).join('')}` : ''}

</div>`;

  root.querySelector('#back-btn').addEventListener('click', () => { _view = 'list'; _renderPage(root); });
  root.querySelectorAll('.eval-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeReview = _getReviews().find(r => r.id === btn.dataset.revId) || null;
      _view = 'evaluate';
      _renderPage(root);
    });
  });
}

function _renderEvaluate(root) {
  const rev = _activeReview;
  if (!rev) { _view = 'cycle'; _renderPage(root); return; }
  const emp = _employees.find(e => e.id === rev.empId) || { name:'?', dept:'?', title:'?' };

  root.innerHTML = `
<div style="padding:16px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button id="back-btn" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text)">←</button>
    <div>
      <div style="font-size:14px;font-weight:700">${emp.name} 성과 평가</div>
      <div style="font-size:11px;color:#64748B">${emp.dept} · ${emp.title}</div>
    </div>
  </div>

  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px">
    ${COMPETENCIES.map(comp => {
      const cur = rev.scores[comp] || 0;
      return `
    <div style="margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">${comp}</div>
      <div style="display:flex;gap:6px">
        ${[1,2,3,4,5].map(n => `
        <button class="score-btn" data-comp="${comp}" data-score="${n}"
          style="flex:1;padding:8px 0;border:2px solid ${cur===n?RATING_META[n].color:'var(--border)'};
                 border-radius:10px;background:${cur===n?RATING_META[n].bg:'var(--bg)'};
                 color:${cur===n?RATING_META[n].color:'#94A3B8'};font-size:13px;
                 font-weight:700;cursor:pointer">${n}</button>`).join('')}
      </div>
      ${cur ? `<div style="font-size:10px;color:${RATING_META[cur].color};margin-top:4px;font-weight:600">
        ${RATING_META[cur].label}
      </div>` : ''}
    </div>`;
    }).join('')}

    <div style="margin-top:4px">
      <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">종합 코멘트</label>
      <textarea id="eval-comment" placeholder="강점, 개선점, 내년 목표 등…"
        style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
               font-size:13px;background:var(--bg);color:var(--text);
               box-sizing:border-box;height:80px;resize:vertical">${rev.comment || ''}</textarea>
    </div>
  </div>

  <button id="save-eval-btn"
    style="width:100%;background:#10B981;color:#fff;border:none;border-radius:12px;
           padding:14px;font-size:14px;font-weight:700;cursor:pointer">평가 완료</button>
</div>`;

  root.querySelector('#back-btn').addEventListener('click', () => { _view = 'cycle'; _renderPage(root); });

  root.querySelectorAll('.score-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const revs = _getReviews();
      const idx  = revs.findIndex(r => r.id === rev.id);
      if (idx >= 0) {
        revs[idx].scores[btn.dataset.comp] = parseInt(btn.dataset.score);
        _activeReview = revs[idx];
        _saveReviews(revs);
      }
      _renderPage(root);
    });
  });

  root.querySelector('#save-eval-btn').addEventListener('click', () => {
    const scores = _activeReview.scores;
    const filled = COMPETENCIES.filter(c => scores[c]);
    if (filled.length < COMPETENCIES.length) {
      showToast(`${COMPETENCIES.length - filled.length}개 항목을 평가해주세요.`, 'error');
      return;
    }
    const avg = Object.values(scores).reduce((s,v)=>s+v,0) / COMPETENCIES.length;
    const comment = root.querySelector('#eval-comment').value.trim();

    const revs = _getReviews();
    const idx  = revs.findIndex(r => r.id === _activeReview.id);
    if (idx >= 0) {
      revs[idx].overall = parseFloat(avg.toFixed(2));
      revs[idx].comment = comment;
      revs[idx].status  = 'done';
      _saveReviews(revs);
    }
    const emp2 = _employees.find(e => e.id === _activeReview.empId);
    showToast(`${emp2?.name}님 평가가 완료되었습니다.`, 'success')
      addNotification({ type: 'success', title: 'Performance Review (관리자)', body: '님 평가가 완료되었습니다.' });
    addNotification({ type: 'system', title: `성과 평가 완료: ${emp2?.name} (${avg.toFixed(1)}점)`, body: '' });
    _view = 'cycle';
    _renderPage(root);
  });
}

function _renderAddCycle(root) {
  root.innerHTML = `
<div style="padding:16px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button id="back-btn" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text)">←</button>
    <div style="font-size:15px;font-weight:700">📋 평가 사이클 생성</div>
  </div>
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
    ${_fld('cyc-name', '사이클 이름', '2026 하반기 성과 평가')}
    ${_fld('cyc-period', '평가 기간', '2026-H2')}
    ${_fld('cyc-deadline', '마감일', '', 'date')}
  </div>
  <button id="save-btn" style="width:100%;margin-top:14px;background:#4F46E5;color:#fff;border:none;
    border-radius:12px;padding:14px;font-size:14px;font-weight:700;cursor:pointer">생성하기</button>
</div>`;

  root.querySelector('#back-btn').addEventListener('click', () => { _view = 'list'; _renderPage(root); });
  root.querySelector('#save-btn').addEventListener('click', () => {
    const name = root.querySelector('#cyc-name').value.trim();
    if (!name) { showToast('사이클 이름을 입력하세요.', 'error'); return; }
    const cycles = _getCycles();
    cycles.forEach(c => { if (c.status === 'open') c.status = 'closed'; });
    cycles.push({
      id: 'CYC_' + Date.now(),
      name,
      period: root.querySelector('#cyc-period').value.trim(),
      status: 'open',
      deadline: root.querySelector('#cyc-deadline').value,
    });
    _saveCycles(cycles);
    showToast('평가 사이클이 생성되었습니다.', 'success');
    addNotification({ type: 'system', title: `새 평가 사이클 시작: ${name}`, body: '' });
    _view = 'list'; _renderPage(root);
  });
}

function _fld(id, label, placeholder, type = 'text') {
  return `<div style="margin-bottom:12px">
    <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">${label}</label>
    <input id="${id}" type="${type}" placeholder="${placeholder}"
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>`;
}
