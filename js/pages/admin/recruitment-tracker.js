/**
 * recruitment-tracker.js — 채용 현황 트래커 (관리자)
 */

import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_recruitment_tracker';

const STAGES = [
  { key: 'sourcing',   label: '소싱',    color: '#94A3B8', bg: '#F1F5F9' },
  { key: 'screening',  label: '서류',    color: '#3B82F6', bg: '#DBEAFE' },
  { key: 'interview1', label: '1차면접', color: '#8B5CF6', bg: '#EDE9FE' },
  { key: 'interview2', label: '2차면접', color: '#F59E0B', bg: '#FEF3C7' },
  { key: 'offer',      label: '오퍼',    color: '#10B981', bg: '#D1FAE5' },
  { key: 'hired',      label: '입사확정', color: '#059669', bg: '#A7F3D0' },
  { key: 'dropped',    label: '탈락/취소', color: '#EF4444', bg: '#FEE2E2' },
];

const PRIORITIES = [
  { key: 'urgent', label: '긴급', color: '#EF4444', bg: '#FEE2E2' },
  { key: 'high',   label: '높음', color: '#F59E0B', bg: '#FEF3C7' },
  { key: 'normal', label: '보통', color: '#3B82F6', bg: '#DBEAFE' },
];

const DEMO_POSITIONS = [
  {
    id: 'POS001', title: '프론트엔드 개발자', dept: '개발', headcount: 2,
    priority: 'urgent', openDate: '2026-05-01', targetDate: '2026-06-30',
    recruiter: '김채용', candidates: [
      { id: 'C001', name: '이지원', stage: 'interview2', source: 'LinkedIn', appliedAt: '2026-05-10', note: '포트폴리오 우수' },
      { id: 'C002', name: '박현수', stage: 'offer',      source: '서치펌',   appliedAt: '2026-05-12', note: '희망연봉 협의중' },
      { id: 'C003', name: '최민서', stage: 'screening',  source: '잡코리아', appliedAt: '2026-05-20', note: '' },
    ],
  },
  {
    id: 'POS002', title: 'HR 제너럴리스트', dept: 'HR', headcount: 1,
    priority: 'high', openDate: '2026-05-15', targetDate: '2026-07-15',
    recruiter: '박인사', candidates: [
      { id: 'C004', name: '김수아', stage: 'interview1', source: '리퍼럴',   appliedAt: '2026-05-25', note: '경력 4년' },
      { id: 'C005', name: '이준혁', stage: 'dropped',    source: '사람인',   appliedAt: '2026-05-18', note: '불합격' },
    ],
  },
  {
    id: 'POS003', title: '그로스 마케터', dept: '마케팅', headcount: 1,
    priority: 'normal', openDate: '2026-06-01', targetDate: '2026-07-31',
    recruiter: '최채용', candidates: [
      { id: 'C006', name: '정은지', stage: 'sourcing', source: 'Wanted', appliedAt: '2026-06-02', note: '' },
    ],
  },
];

function _getAll() {
  try {
    const stored = JSON.parse(localStorage.getItem(LS) || '[]');
    const ids = new Set(stored.map(p => p.id));
    const merged = [...stored];
    DEMO_POSITIONS.forEach(d => { if (!ids.has(d.id)) merged.push(d); });
    return merged;
  } catch { return DEMO_POSITIONS; }
}
function _saveAll(l) { localStorage.setItem(LS, JSON.stringify(l)); }
function _cid() { return 'C' + Date.now().toString().slice(-6); }
function _pid() { return 'POS' + Date.now().toString().slice(-6); }

let _view      = 'list';   // list | kanban | add-pos
let _selPosId  = null;
let _addMode   = '';       // '' | candidate

export function render(root) { _view = 'list'; _selPosId = null; _addMode = ''; _draw(root); }
export function unmount()    { _view = 'list'; _selPosId = null; _addMode = ''; }

function _draw(root) {
  if (_selPosId) { _drawPos(root); return; }
  if (_view === 'add-pos') { _drawAddPos(root); return; }

  const positions = _getAll();
  const active = positions.filter(p => !['hired', 'dropped'].includes(p.priority === 'dropped'));
  const totalCandidates = positions.reduce((n, p) => n + p.candidates.length, 0);
  const inProgress = positions.reduce((n, p) => n + p.candidates.filter(c => !['hired','dropped'].includes(c.stage)).length, 0);
  const hired = positions.reduce((n, p) => n + p.candidates.filter(c => c.stage === 'hired').length, 0);

  root.innerHTML = `
<!-- KPI -->
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
  ${[
    { label: '포지션', val: positions.length,   color: '#4F46E5' },
    { label: '전체후보', val: totalCandidates,  color: '#3B82F6' },
    { label: '진행중',  val: inProgress,        color: '#F59E0B' },
    { label: '입사확정', val: hired,            color: '#10B981' },
  ].map(k => `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
      <div style="font-size:18px;font-weight:800;color:${k.color}">${k.val}</div>
      <div style="font-size:10px;color:#64748B;margin-top:2px">${k.label}</div>
    </div>`).join('')}
</div>

<!-- 액션 -->
<div style="display:flex;justify-content:flex-end;margin-bottom:14px">
  <button id="rt-add-pos"
    style="padding:8px 14px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">
    + 포지션 추가
  </button>
</div>

<!-- 포지션 목록 -->
${positions.map(pos => {
  const pri = PRIORITIES.find(p => p.key === pos.priority) || PRIORITIES[2];
  const counts = {};
  STAGES.forEach(s => { counts[s.key] = pos.candidates.filter(c => c.stage === s.key).length; });
  const activeCount = pos.candidates.filter(c => !['hired','dropped'].includes(c.stage)).length;
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
    <div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
        <span style="font-size:13px;font-weight:700;color:var(--text)">${pos.title}</span>
        <span style="padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:${pri.bg};color:${pri.color}">${pri.label}</span>
      </div>
      <div style="font-size:11px;color:#64748B">${pos.dept} · ${pos.headcount}명 채용 · 담당: ${pos.recruiter}</div>
      <div style="font-size:11px;color:#64748B">목표일 ${pos.targetDate}</div>
    </div>
    <button class="rt-view-pos" data-id="${pos.id}"
      style="padding:6px 12px;background:#EEF2FF;color:#4F46E5;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">
      상세 보기
    </button>
  </div>
  <!-- 파이프라인 요약 -->
  <div style="display:flex;gap:4px;overflow-x:auto">
    ${STAGES.filter(s=>s.key!=='dropped').map(s => `
      <div style="flex-shrink:0;text-align:center;padding:5px 8px;border-radius:8px;
                  background:${counts[s.key]?s.bg:'var(--bg)'};border:1px solid ${counts[s.key]?s.color:'var(--border)'}">
        <div style="font-size:14px;font-weight:800;color:${counts[s.key]?s.color:'#94A3B8'}">${counts[s.key]||0}</div>
        <div style="font-size:9px;color:${counts[s.key]?s.color:'#94A3B8'};white-space:nowrap">${s.label}</div>
      </div>`).join('')}
    ${counts.dropped ? `<div style="flex-shrink:0;text-align:center;padding:5px 8px;border-radius:8px;background:#FEE2E2;border:1px solid #EF4444">
      <div style="font-size:14px;font-weight:800;color:#EF4444">${counts.dropped}</div>
      <div style="font-size:9px;color:#EF4444">탈락</div>
    </div>` : ''}
  </div>
</div>`;
}).join('')}`;

  root.querySelector('#rt-add-pos')?.addEventListener('click', () => { _view = 'add-pos'; _draw(root); });
  root.querySelectorAll('.rt-view-pos').forEach(btn => {
    btn.addEventListener('click', () => { _selPosId = btn.dataset.id; _draw(root); });
  });
}

function _drawPos(root) {
  const positions = _getAll();
  const pos = positions.find(p => p.id === _selPosId);
  if (!pos) { _selPosId = null; _draw(root); return; }

  root.innerHTML = `
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
  <div>
    <div style="font-size:14px;font-weight:700;color:var(--text)">${pos.title}</div>
    <div style="font-size:11px;color:#64748B">${pos.dept} · 목표 ${pos.targetDate}</div>
  </div>
  <button id="rt-back" style="padding:6px 12px;border:1.5px solid var(--border);border-radius:8px;background:none;font-size:12px;cursor:pointer;color:#64748B">← 목록</button>
</div>

<!-- 후보자 추가 -->
<button id="rt-add-cand"
  style="width:100%;padding:10px;background:#EEF2FF;color:#4F46E5;border:1.5px dashed #4F46E5;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:14px">
  + 후보자 추가
</button>

${_addMode === 'candidate' ? _renderAddCandidateForm(pos.id) : ''}

<!-- 후보자 목록 -->
${STAGES.map(stg => {
  const cands = pos.candidates.filter(c => c.stage === stg.key);
  if (!cands.length) return '';
  return `
<div style="margin-bottom:12px">
  <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
    <span style="width:8px;height:8px;border-radius:50%;background:${stg.color};display:inline-block"></span>
    <span style="font-size:12px;font-weight:700;color:var(--text)">${stg.label}</span>
    <span style="font-size:11px;color:#64748B">(${cands.length}명)</span>
  </div>
  ${cands.map(c => `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">${c.name}</div>
          <div style="font-size:11px;color:#64748B">${c.source} · ${c.appliedAt}</div>
          ${c.note ? `<div style="font-size:11px;color:#64748B;margin-top:3px">${c.note}</div>` : ''}
        </div>
        <select class="rt-stage-sel" data-posid="${pos.id}" data-cid="${c.id}"
          style="padding:5px 8px;border:1.5px solid ${stg.color};border-radius:8px;font-size:11px;font-weight:700;
                 background:${stg.bg};color:${stg.color};cursor:pointer">
          ${STAGES.map(s => `<option value="${s.key}" ${c.stage===s.key?'selected':''}>${s.label}</option>`).join('')}
        </select>
      </div>
    </div>`).join('')}
</div>`;
}).join('')}

${!pos.candidates.length ? `<div style="text-align:center;padding:40px 20px;color:#94A3B8">
  <div style="font-size:36px;margin-bottom:8px">👤</div>
  <div style="font-size:13px;font-weight:600;margin-bottom:4px">후보자가 없습니다</div>
  <div style="font-size:11px">위 "후보자 추가" 버튼으로 추가해주세요.</div>
</div>` : ''}`;

  root.querySelector('#rt-back')?.addEventListener('click', () => { _selPosId = null; _addMode = ''; _draw(root); });
  root.querySelector('#rt-add-cand')?.addEventListener('click', () => { _addMode = _addMode === 'candidate' ? '' : 'candidate'; _drawPos(root); });

  root.querySelectorAll('.rt-stage-sel').forEach(sel => {
    sel.addEventListener('change', () => {
      const positions2 = _getAll();
      const p2 = positions2.find(x => x.id === sel.dataset.posid);
      const c = p2?.candidates.find(x => x.id === sel.dataset.cid);
      if (c) { c.stage = sel.value; _saveAll(positions2); }
      const stg = STAGES.find(s => s.key === sel.value);
      if (stg) { sel.style.borderColor = stg.color; sel.style.background = stg.bg; sel.style.color = stg.color; }
      showToast('단계가 업데이트되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Recruitment Tracker (관리자)', body: '단계가 업데이트되었습니다.' });
    });
  });

  const form = root.querySelector('#rt-cand-form');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const name   = root.querySelector('#rtc-name').value.trim();
      const source = root.querySelector('#rtc-source').value.trim();
      const note   = root.querySelector('#rtc-note').value.trim();
      if (!name) { showToast('후보자 이름을 입력해주세요.', 'error'); return; }
      const positions2 = _getAll();
      const p2 = positions2.find(x => x.id === _selPosId);
      if (p2) {
        p2.candidates.push({ id: _cid(), name, source: source || '직접입력', stage: 'sourcing', appliedAt: new Date().toISOString().slice(0,10), note });
        _saveAll(positions2);
      }
      showToast('후보자가 추가되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Recruitment Tracker (관리자)', body: '후보자가 추가되었습니다.' });
      _addMode = '';
      _drawPos(root);
    });
  }
}

function _renderAddCandidateForm() {
  return `
<form id="rt-cand-form" style="background:var(--bg);border:1.5px solid #4F46E5;border-radius:12px;padding:14px;margin-bottom:14px">
  <div style="font-size:12px;font-weight:700;color:#4F46E5;margin-bottom:10px">후보자 정보 입력</div>
  <div style="display:flex;flex-direction:column;gap:10px">
    <input id="rtc-name" type="text" required placeholder="후보자 이름 *"
      style="padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--card-bg);color:var(--text)">
    <input id="rtc-source" type="text" placeholder="소싱 채널 (예: LinkedIn, 사람인)"
      style="padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--card-bg);color:var(--text)">
    <input id="rtc-note" type="text" placeholder="메모"
      style="padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--card-bg);color:var(--text)">
    <button type="submit"
      style="padding:10px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">
      추가
    </button>
  </div>
</form>`;
}

function _drawAddPos(root) {
  root.innerHTML = `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
    <div style="font-size:14px;font-weight:700;color:var(--text)">포지션 추가</div>
    <button id="rt-pos-cancel" style="padding:6px 12px;border:1.5px solid var(--border);border-radius:8px;background:none;font-size:12px;cursor:pointer;color:#64748B">취소</button>
  </div>
  <form id="rt-pos-form" style="display:flex;flex-direction:column;gap:12px">
    <input id="rtp-title" type="text" required placeholder="포지션명 *"
      style="padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text)">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <input id="rtp-dept" type="text" placeholder="부서"
        style="padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text)">
      <input id="rtp-headcount" type="number" min="1" value="1" placeholder="채용 인원"
        style="padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text)">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--text);display:block;margin-bottom:4px">우선순위</label>
        <select id="rtp-priority" style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;background:var(--bg);color:var(--text)">
          ${PRIORITIES.map(p => `<option value="${p.key}">${p.label}</option>`).join('')}
        </select>
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--text);display:block;margin-bottom:4px">목표 완료일</label>
        <input id="rtp-target" type="date" style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;background:var(--bg);color:var(--text);box-sizing:border-box">
      </div>
    </div>
    <input id="rtp-recruiter" type="text" placeholder="채용 담당자"
      style="padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text)">
    <button type="submit"
      style="padding:13px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">
      포지션 등록
    </button>
  </form>
</div>`;

  root.querySelector('#rt-pos-cancel')?.addEventListener('click', () => { _view = 'list'; _draw(root); });
  root.querySelector('#rt-pos-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const title    = root.querySelector('#rtp-title').value.trim();
    const dept     = root.querySelector('#rtp-dept').value.trim();
    const headcount = Number(root.querySelector('#rtp-headcount').value) || 1;
    const priority = root.querySelector('#rtp-priority').value;
    const target   = root.querySelector('#rtp-target').value;
    const recruiter = root.querySelector('#rtp-recruiter').value.trim();
    if (!title) { showToast('포지션명을 입력해주세요.', 'error'); return; }
    const positions = _getAll();
    positions.push({ id: _pid(), title, dept: dept || '미정', headcount, priority, openDate: new Date().toISOString().slice(0,10), targetDate: target || '미정', recruiter: recruiter || '미배정', candidates: [] });
    _saveAll(positions);
    showToast('포지션이 등록되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Recruitment Tracker (관리자)', body: '포지션이 등록되었습니다.' });
    _view = 'list';
    _draw(root);
  });
}
export function mount(root) { return render(root); }
