/**
 * performance-calibration.js — 성과 캘리브레이션 (9-Box 매트릭스)
 */

import { showToast } from '../../components/toast.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_calibration';

const PERF_LABELS  = ['낮음', '보통', '높음'];
const POTENTIAL_LABELS = ['낮음', '보통', '높음'];

const BOX_META = {
  '3-3': { label: '스타',       color: '#059669', bg: '#D1FAE5', desc: '고성과·고잠재력 — 핵심 인재, 패스트트랙' },
  '2-3': { label: '하이포텐셜', color: '#10B981', bg: '#D1FAE5', desc: '보통성과·고잠재력 — 코칭으로 빠른 성장 기대' },
  '1-3': { label: '수수께끼',   color: '#3B82F6', bg: '#DBEAFE', desc: '저성과·고잠재력 — 환경·역할 검토 필요' },
  '3-2': { label: '핵심 직원',  color: '#4F46E5', bg: '#EEF2FF', desc: '고성과·보통잠재 — 안정적 기여자, 전문화 지원' },
  '2-2': { label: '견고한 직원', color: '#64748B', bg: '#F1F5F9', desc: '보통성과·보통잠재 — 현 역할 유지, 동기부여 필요' },
  '1-2': { label: '이슈',       color: '#F59E0B', bg: '#FEF3C7', desc: '저성과·보통잠재 — 성과개선계획(PIP) 검토' },
  '3-1': { label: '전문가',     color: '#8B5CF6', bg: '#EDE9FE', desc: '고성과·저잠재 — 전문성 인정, 관리직 아닌 경로' },
  '2-1': { label: '유지 관찰',  color: '#F59E0B', bg: '#FEF3C7', desc: '보통성과·저잠재 — 현 포지션 적합성 검토' },
  '1-1': { label: '위험',       color: '#EF4444', bg: '#FEE2E2', desc: '저성과·저잠재력 — 즉각 조치 필요' },
};

const _PERF_SEEDS = [3,2,3,1,2,3,2,1,3,2,3,2,1,3,2,3,1,2,3,2];
const _POT_SEEDS  = [3,3,2,3,1,2,3,2,1,3,2,1,3,3,2,1,3,2,3,1];

function _syncData(employees) {
  const stored = localStorage.getItem(LS);
  const existing = stored ? JSON.parse(stored) : {};
  const map = { ...existing };
  employees.forEach((e, i) => {
    if (!map[e.id]) {
      map[e.id] = {
        empId:    e.id,
        name:     e.name,
        dept:     e.dept || e.department || '미배정',
        jobTitle: e.role || '직원',
        perf:     _PERF_SEEDS[i % _PERF_SEEDS.length],
        potential:_POT_SEEDS[i % _POT_SEEDS.length],
        note:     '',
        grade:    '',
      };
    }
  });
  localStorage.setItem(LS, JSON.stringify(map));
  return map;
}
function _save(d) { localStorage.setItem(LS, JSON.stringify(d)); }

let _view = 'matrix';
let _editId = null;
let _filterDept = '';
let _calData = {};

export async function mount(root) {
  _view = 'matrix'; _editId = null; _filterDept = '';
  root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">⏳</div><div style="font-size:13px">캘리브레이션 로딩 중…</div></div>`;
  const employees = await loadDisplayEmployees();
  _calData = _syncData(employees);
  _draw(root);
}
export function render(root) { _draw(root); }
export function unmount()    { _view = 'matrix'; _editId = null; _filterDept = ''; _calData = {}; }

function _draw(root) {
  if (_editId) { _drawEdit(root); return; }

  const data = Object.keys(_calData).length ? _calData
    : (() => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } })();
  const employees = Object.values(data);
  if (!employees || !employees.length) { root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:48px;margin-bottom:12px">📈</div><div style="font-size:14px;font-weight:600;margin-bottom:6px">성과 조정 데이터가 없습니다.</div><div style="font-size:12px">데이터가 축적되면 자동으로 표시됩니다.</div></div>`; return; }
  const depts = ['', ...[...new Set(employees.map(e => e.dept))].sort()];

  const filtered = _filterDept
    ? employees.filter(e => e.dept === _filterDept)
    : employees;

  root.innerHTML = `
<!-- 상단 -->
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
  <select id="cal-dept-filter"
    style="padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;background:var(--bg);color:var(--text)">
    ${depts.map(d=>`<option value="${d}" ${_filterDept===d?'selected':''}>${d||'전체 부서'}</option>`).join('')}
  </select>
  <div style="display:flex;gap:6px">
    <button class="cal-view-btn" data-v="matrix"
      style="padding:6px 12px;border:1.5px solid ${_view==='matrix'?'#4F46E5':'var(--border)'};border-radius:8px;background:${_view==='matrix'?'#EEF2FF':'var(--card-bg)'};color:${_view==='matrix'?'#4F46E5':'#64748B'};font-size:11px;font-weight:700;cursor:pointer">
      9-Box</button>
    <button class="cal-view-btn" data-v="list"
      style="padding:6px 12px;border:1.5px solid ${_view==='list'?'#4F46E5':'var(--border)'};border-radius:8px;background:${_view==='list'?'#EEF2FF':'var(--card-bg)'};color:${_view==='list'?'#4F46E5':'#64748B'};font-size:11px;font-weight:700;cursor:pointer">
      목록</button>
  </div>
</div>

${_view === 'matrix' ? _renderMatrix(filtered) : _renderList(filtered)}`;

  root.querySelector('#cal-dept-filter')?.addEventListener('change', e => {
    _filterDept = e.target.value;
    _draw(root);
  });
  root.querySelectorAll('.cal-view-btn').forEach(btn => {
    btn.addEventListener('click', () => { _view = btn.dataset.v; _draw(root); });
  });
  root.querySelectorAll('.cal-edit-emp').forEach(btn => {
    btn.addEventListener('click', () => { _editId = btn.dataset.id; _draw(root); });
  });
}

function _renderMatrix(employees) {
  const grid = {};
  for (let p = 3; p >= 1; p--)
    for (let q = 1; q <= 3; q++)
      grid[`${q}-${p}`] = employees.filter(e => e.perf === q && e.potential === p);

  return `
<!-- 레이블 -->
<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px">
  <div style="width:50px"></div>
  ${PERF_LABELS.map(l=>`<div style="flex:1;text-align:center;font-size:10px;color:#64748B;font-weight:600">${l}</div>`).join('')}
</div>

<!-- 9박스 그리드 -->
<div style="display:flex;gap:4px">
  <!-- Y축 레이블 -->
  <div style="display:flex;flex-direction:column;gap:4px;width:50px">
    ${[...POTENTIAL_LABELS].reverse().map(l=>`
      <div style="flex:1;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;font-size:10px;color:#64748B;font-weight:600;min-height:80px">${l}</div>`).join('')}
  </div>
  <!-- 셀 -->
  <div style="flex:1;display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px">
    ${[3,2,1].flatMap(pot => [1,2,3].map(perf => {
      const key  = `${perf}-${pot}`;
      const meta = BOX_META[key];
      const emps = grid[key] || [];
      return `
<div style="background:${meta.bg};border:1.5px solid ${meta.color}40;border-radius:10px;padding:8px;min-height:80px;position:relative">
  <div style="font-size:10px;font-weight:700;color:${meta.color};margin-bottom:4px">${meta.label}</div>
  <div style="display:flex;flex-wrap:wrap;gap:3px">
    ${emps.slice(0,6).map(e=>`
      <button class="cal-edit-emp" data-id="${e.empId}" title="${e.name}"
        style="padding:2px 6px;background:#fff;border:1px solid ${meta.color}60;border-radius:10px;font-size:9px;font-weight:600;color:${meta.color};cursor:pointer;white-space:nowrap">
        ${e.name.slice(0,3)}
      </button>`).join('')}
    ${emps.length > 6 ? `<span style="font-size:9px;color:${meta.color}">+${emps.length-6}</span>` : ''}
  </div>
  <div style="position:absolute;bottom:4px;right:6px;font-size:11px;font-weight:800;color:${meta.color}">${emps.length}</div>
</div>`;
    })).join('')}
  </div>
</div>

<!-- 축 레이블 -->
<div style="display:flex;margin-top:6px">
  <div style="width:56px"></div>
  <div style="flex:1;text-align:center;font-size:10px;color:#64748B">← 성과 →</div>
</div>
<div style="font-size:10px;color:#94A3B8;text-align:right;margin-top:2px">↑ 잠재력</div>

<!-- 범례 -->
<div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:6px">
  ${Object.entries(BOX_META).map(([k,m])=>`
    <span style="padding:3px 8px;border-radius:10px;background:${m.bg};color:${m.color};font-size:10px;font-weight:700;border:1px solid ${m.color}40">${m.label}</span>`).join('')}
</div>`;
}

function _renderList(employees) {
  const sorted = [...employees].sort((a,b) => (b.perf+b.potential)-(a.perf+a.potential));
  return `
<div style="display:flex;flex-direction:column;gap:8px">
  ${sorted.map(e => {
    const key  = `${e.perf}-${e.potential}`;
    const meta = BOX_META[key] || { label:'미분류', color:'#94A3B8', bg:'#F1F5F9' };
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;display:flex;align-items:center;gap:10px">
  <div style="flex:1">
    <div style="font-size:13px;font-weight:700;color:var(--text)">${e.name}</div>
    <div style="font-size:11px;color:#64748B">${e.dept} · ${e.jobTitle}</div>
  </div>
  <span style="padding:4px 10px;border-radius:20px;background:${meta.bg};color:${meta.color};font-size:11px;font-weight:700">${meta.label}</span>
  <button class="cal-edit-emp" data-id="${e.empId}"
    style="padding:5px 10px;background:#EEF2FF;color:#4F46E5;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">편집</button>
</div>`;
  }).join('')}
</div>`;
}

function _drawEdit(root) {
  const data = _initData();
  const e = data[_editId];
  if (!e) { _editId = null; _draw(root); return; }

  const key  = `${e.perf}-${e.potential}`;
  const meta = BOX_META[key] || { label:'미분류', color:'#94A3B8', bg:'#F1F5F9', desc:'' };

  root.innerHTML = `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div>
      <div style="font-size:14px;font-weight:700;color:var(--text)">${e.name}</div>
      <div style="font-size:11px;color:#64748B">${e.dept} · ${e.jobTitle}</div>
    </div>
    <button id="cal-cancel" style="padding:6px 12px;border:1.5px solid var(--border);border-radius:8px;background:none;font-size:12px;cursor:pointer;color:#64748B">취소</button>
  </div>

  <!-- 현재 박스 표시 -->
  <div style="background:${meta.bg};border:1.5px solid ${meta.color};border-radius:10px;padding:10px;margin-bottom:16px;text-align:center">
    <div style="font-size:14px;font-weight:800;color:${meta.color}">${meta.label}</div>
    <div style="font-size:11px;color:${meta.color};margin-top:3px">${meta.desc}</div>
  </div>

  <!-- 성과 -->
  <div style="margin-bottom:14px">
    <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">성과 수준</div>
    <div style="display:flex;gap:8px">
      ${[1,2,3].map(v=>`
        <button class="cal-perf-btn" data-v="${v}"
          style="flex:1;padding:10px;border-radius:10px;border:2px solid ${e.perf===v?'#4F46E5':'var(--border)'};
                 background:${e.perf===v?'#EEF2FF':'var(--bg)'};cursor:pointer;font-size:12px;font-weight:700;
                 color:${e.perf===v?'#4F46E5':'#64748B'}">
          ${PERF_LABELS[v-1]}
        </button>`).join('')}
    </div>
  </div>

  <!-- 잠재력 -->
  <div style="margin-bottom:14px">
    <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">잠재력 수준</div>
    <div style="display:flex;gap:8px">
      ${[1,2,3].map(v=>`
        <button class="cal-pot-btn" data-v="${v}"
          style="flex:1;padding:10px;border-radius:10px;border:2px solid ${e.potential===v?'#4F46E5':'var(--border)'};
                 background:${e.potential===v?'#EEF2FF':'var(--bg)'};cursor:pointer;font-size:12px;font-weight:700;
                 color:${e.potential===v?'#4F46E5':'#64748B'}">
          ${POTENTIAL_LABELS[v-1]}
        </button>`).join('')}
    </div>
  </div>

  <!-- 등급 -->
  <div style="margin-bottom:14px">
    <label style="font-size:12px;font-weight:700;color:var(--text);display:block;margin-bottom:6px">성과 등급</label>
    <select id="cal-grade"
      style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text)">
      ${['','S','A','B','C','D'].map(g=>`<option value="${g}" ${e.grade===g?'selected':''}>${g||'미설정'}</option>`).join('')}
    </select>
  </div>

  <!-- 메모 -->
  <div style="margin-bottom:16px">
    <label style="font-size:12px;font-weight:700;color:var(--text);display:block;margin-bottom:6px">캘리브레이션 메모</label>
    <textarea id="cal-note" rows="3" placeholder="성과 근거, 관찰 내용…"
      style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;background:var(--bg);color:var(--text);resize:vertical;box-sizing:border-box">${e.note||''}</textarea>
  </div>

  <button id="cal-save"
    style="width:100%;padding:13px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">저장</button>
</div>`;

  let curPerf = e.perf, curPot = e.potential;

  const refreshBoxPreview = () => {
    const k2   = `${curPerf}-${curPot}`;
    const m2   = BOX_META[k2] || { label:'미분류', color:'#94A3B8', bg:'#F1F5F9', desc:'' };
    const preview = root.querySelector('.cal-box-preview');
    if (preview) {
      preview.style.background   = m2.bg;
      preview.style.borderColor  = m2.color;
      preview.querySelector('.cal-bp-label').textContent = m2.label;
      preview.querySelector('.cal-bp-desc').textContent  = m2.desc;
      preview.querySelector('.cal-bp-label').style.color = m2.color;
      preview.querySelector('.cal-bp-desc').style.color  = m2.color;
    }
  };

  root.querySelectorAll('.cal-perf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      curPerf = Number(btn.dataset.v);
      root.querySelectorAll('.cal-perf-btn').forEach(b => {
        const sel = Number(b.dataset.v) === curPerf;
        b.style.borderColor = sel ? '#4F46E5' : 'var(--border)';
        b.style.background  = sel ? '#EEF2FF' : 'var(--bg)';
        b.style.color       = sel ? '#4F46E5' : '#64748B';
      });
      refreshBoxPreview();
    });
  });

  root.querySelectorAll('.cal-pot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      curPot = Number(btn.dataset.v);
      root.querySelectorAll('.cal-pot-btn').forEach(b => {
        const sel = Number(b.dataset.v) === curPot;
        b.style.borderColor = sel ? '#4F46E5' : 'var(--border)';
        b.style.background  = sel ? '#EEF2FF' : 'var(--bg)';
        b.style.color       = sel ? '#4F46E5' : '#64748B';
      });
      refreshBoxPreview();
    });
  });

  root.querySelector('#cal-cancel')?.addEventListener('click', () => { _editId = null; _draw(root); });
  root.querySelector('#cal-save')?.addEventListener('click', () => {
    const grade = root.querySelector('#cal-grade').value;
    const note  = root.querySelector('#cal-note').value.trim();
    const data2 = _initData();
    data2[_editId] = { ...data2[_editId], perf: curPerf, potential: curPot, grade, note };
    _save(data2);
    showToast('캘리브레이션이 저장되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Performance Calibration (관리자)', body: '캘리브레이션이 저장되었습니다.' });
    _editId = null;
    _draw(root);
  });
}
