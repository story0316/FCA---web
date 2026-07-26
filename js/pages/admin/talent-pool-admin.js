/**
 * talent-pool-admin.js — 인재풀 관리 (관리자)
 */

import { showToast } from '../../components/toast.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_talent_pool';

const POTENTIAL_LEVELS = [
  { key: 'high',   label: '고잠재력', color: '#10B981', bg: '#D1FAE5', icon: '🌟' },
  { key: 'medium', label: '중잠재력', color: '#3B82F6', bg: '#DBEAFE', icon: '⭐' },
  { key: 'low',    label: '관찰중',   color: '#94A3B8', bg: '#F1F5F9', icon: '👁️' },
];

const TAGS_PRESET = ['리더십', '기술 전문성', '글로벌', '혁신', '멘토', '승계 후보', '핵심 인재', '이탈 위험', '성장형', '전문가형'];

function _getPool() { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } }
function _savePool(l) { localStorage.setItem(LS, JSON.stringify(l)); }

function _syncPool(employees) {
  const pool = _getPool();
  const poolIds = new Set(pool.map(p => p.empId));
  const newEntries = employees
    .filter(e => !poolIds.has(e.id))
    .map(e => ({
      empId:     e.id,
      name:      e.name,
      dept:      e.dept || e.department || '미배정',
      jobTitle:  e.jobTitle || e.position || '직원',
      potential: 'medium',
      perfScore: e.competencyScore || null,
      tags:      [],
      successor: false,
      note:      '',
      updatedAt: new Date().toISOString(),
    }));
  if (newEntries.length) { pool.push(...newEntries); _savePool(pool); }
  return pool;
}

let _filter = 'all';
let _editId = null;
let _pool   = [];

export async function mount(root) {
  _filter = 'all'; _editId = null;
  root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">⏳</div><div style="font-size:13px">인재풀 로딩 중…</div></div>`;
  const employees = await loadDisplayEmployees();
  _pool = _syncPool(employees);
  _draw(root);
}

export function render(root) { _draw(root); }

export function unmount() {
  _filter = 'all';
  _editId  = null;
  _pool    = [];
}

function _draw(root) {
  if (_editId) { _drawEdit(root); return; }

  const pool = _pool.length ? _pool : _getPool();
  const filtered = _filter === 'all'
    ? pool
    : _filter === 'successor'
      ? pool.filter(p => p.successor)
      : pool.filter(p => p.potential === _filter);

  const counts = { all: pool.length, high: 0, medium: 0, low: 0, successor: 0 };
  pool.forEach(p => {
    counts[p.potential] = (counts[p.potential] || 0) + 1;
    if (p.successor) counts.successor++;
  });

  root.innerHTML = `
<!-- KPI -->
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
  ${[
    { label: '전체', val: counts.all,       color: '#4F46E5' },
    { label: '고잠재', val: counts.high||0,   color: '#10B981' },
    { label: '승계후보', val: counts.successor||0, color: '#F59E0B' },
    { label: '부서수', val: new Set(pool.map(p=>p.dept)).size, color: '#8B5CF6' },
  ].map(k => `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
      <div style="font-size:18px;font-weight:800;color:${k.color}">${k.val}</div>
      <div style="font-size:10px;color:#64748B;margin-top:2px">${k.label}</div>
    </div>`).join('')}
</div>

<!-- 필터 -->
<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
  ${[
    { key: 'all',       label: `전체 (${counts.all})`,           active: _filter==='all',       color: '#4F46E5', bg: '#EEF2FF' },
    { key: 'high',      label: `🌟 고잠재력 (${counts.high||0})`,  active: _filter==='high',      color: '#10B981', bg: '#D1FAE5' },
    { key: 'medium',    label: `⭐ 중잠재력 (${counts.medium||0})`,active: _filter==='medium',    color: '#3B82F6', bg: '#DBEAFE' },
    { key: 'low',       label: `👁️ 관찰중 (${counts.low||0})`,    active: _filter==='low',       color: '#94A3B8', bg: '#F1F5F9' },
    { key: 'successor', label: `🏆 승계후보 (${counts.successor||0})`, active: _filter==='successor', color: '#F59E0B', bg: '#FEF3C7' },
  ].map(f => `
    <button class="tp-filter" data-f="${f.key}"
      style="padding:5px 12px;font-size:11px;font-weight:600;border-radius:8px;cursor:pointer;
             border:1.5px solid ${f.active?f.color:'var(--border)'};
             background:${f.active?f.bg:'var(--card-bg)'};color:${f.active?f.color:'#64748B'}">
      ${f.label}
    </button>`).join('')}
</div>

<!-- 목록 -->
${!filtered.length
  ? `<div style="text-align:center;padding:48px;color:#94A3B8;font-size:13px">해당 조건의 직원이 없습니다.</div>`
  : filtered.map(p => {
    const pl = POTENTIAL_LEVELS.find(x => x.key === p.potential) || POTENTIAL_LEVELS[1];
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div>
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:13px;font-weight:700;color:var(--text)">${p.name}</span>
        ${p.successor ? `<span style="font-size:10px;padding:2px 6px;background:#FEF3C7;color:#D97706;border-radius:6px;font-weight:700">🏆 승계후보</span>` : ''}
      </div>
      <div style="font-size:11px;color:#64748B;margin-top:2px">${p.dept} · ${p.jobTitle}</div>
    </div>
    <div style="display:flex;gap:6px;align-items:center">
      <span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${pl.bg};color:${pl.color}">${pl.icon} ${pl.label}</span>
      <button class="tp-edit-btn" data-id="${p.empId}"
        style="padding:5px 10px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">편집</button>
    </div>
  </div>
  ${p.tags.length ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">${p.tags.map(t=>`<span style="padding:2px 7px;background:#EEF2FF;border-radius:6px;font-size:10px;color:#4F46E5">#${t}</span>`).join('')}</div>` : ''}
  ${p.note ? `<div style="font-size:11px;color:#64748B;font-style:italic">${p.note}</div>` : ''}
</div>`;
  }).join('')}`;

  root.querySelectorAll('.tp-filter').forEach(btn => {
    btn.addEventListener('click', () => { _filter = btn.dataset.f; _draw(root); });
  });

  root.querySelectorAll('.tp-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => { _editId = btn.dataset.id; _draw(root); });
  });
}

function _drawEdit(root) {
  const pool = _getPool();
  const p = pool.find(x => x.empId === _editId);
  if (!p) { _editId = null; _draw(root); return; }

  root.innerHTML = `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
    <div>
      <div style="font-size:14px;font-weight:700;color:var(--text)">${p.name} 편집</div>
      <div style="font-size:11px;color:#64748B">${p.dept} · ${p.jobTitle}</div>
    </div>
    <button id="tp-cancel" style="padding:6px 12px;border:1.5px solid var(--border);border-radius:8px;background:none;font-size:12px;cursor:pointer;color:#64748B">취소</button>
  </div>

  <!-- 잠재력 -->
  <div style="margin-bottom:14px">
    <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">잠재력 수준</div>
    <div style="display:flex;gap:8px">
      ${POTENTIAL_LEVELS.map(pl => `
        <label style="flex:1;cursor:pointer">
          <input type="radio" name="tp-potential" value="${pl.key}" ${p.potential===pl.key?'checked':''} style="display:none">
          <div class="tp-pot-opt" data-key="${pl.key}"
            style="padding:8px;border-radius:10px;text-align:center;border:2px solid ${p.potential===pl.key?pl.color:'var(--border)'};
                   background:${p.potential===pl.key?pl.bg:'var(--card-bg)'};transition:all .2s">
            <div style="font-size:18px">${pl.icon}</div>
            <div style="font-size:10px;font-weight:700;color:${p.potential===pl.key?pl.color:'#64748B'}">${pl.label}</div>
          </div>
        </label>`).join('')}
    </div>
  </div>

  <!-- 승계 후보 -->
  <label style="display:flex;align-items:center;gap:10px;margin-bottom:14px;cursor:pointer">
    <input id="tp-successor" type="checkbox" ${p.successor?'checked':''} style="width:16px;height:16px;cursor:pointer">
    <span style="font-size:13px;font-weight:600;color:var(--text)">🏆 승계 후보 지정</span>
  </label>

  <!-- 성과 점수 -->
  <div style="margin-bottom:14px">
    <label style="font-size:12px;font-weight:700;color:var(--text);display:block;margin-bottom:6px">성과 점수 (0~100)</label>
    <input id="tp-perf" type="number" min="0" max="100" value="${p.perfScore ?? ''}" placeholder="입력 안 함"
      style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>

  <!-- 태그 -->
  <div style="margin-bottom:14px">
    <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">태그 (복수 선택)</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${TAGS_PRESET.map(t => {
        const on = p.tags.includes(t);
        return `<button class="tp-tag-btn" data-tag="${t}"
          style="padding:5px 10px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;
                 border:1.5px solid ${on?'#4F46E5':'var(--border)'};
                 background:${on?'#EEF2FF':'var(--card-bg)'};color:${on?'#4F46E5':'#64748B'}">#${t}</button>`;
      }).join('')}
    </div>
  </div>

  <!-- 메모 -->
  <div style="margin-bottom:16px">
    <label style="font-size:12px;font-weight:700;color:var(--text);display:block;margin-bottom:6px">메모</label>
    <textarea id="tp-note" rows="3" placeholder="성장 관찰 포인트, 개발 계획 등…"
      style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;background:var(--bg);color:var(--text);resize:vertical;box-sizing:border-box">${p.note || ''}</textarea>
  </div>

  <button id="tp-save"
    style="width:100%;padding:13px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">
    저장
  </button>
</div>`;

  let currentTags = [...p.tags];
  let currentPotential = p.potential;

  root.querySelectorAll('.tp-tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag;
      if (currentTags.includes(tag)) {
        currentTags = currentTags.filter(t => t !== tag);
        btn.style.borderColor = 'var(--border)';
        btn.style.background  = 'var(--card-bg)';
        btn.style.color       = '#64748B';
      } else {
        currentTags.push(tag);
        btn.style.borderColor = '#4F46E5';
        btn.style.background  = '#EEF2FF';
        btn.style.color       = '#4F46E5';
      }
    });
  });

  root.querySelectorAll('.tp-pot-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      currentPotential = opt.dataset.key;
      root.querySelectorAll('input[name="tp-potential"]').forEach(r => { r.checked = r.value === currentPotential; });
      root.querySelectorAll('.tp-pot-opt').forEach(o => {
        const pl = POTENTIAL_LEVELS.find(x => x.key === o.dataset.key);
        const active = o.dataset.key === currentPotential;
        o.style.borderColor = active ? pl.color : 'var(--border)';
        o.style.background  = active ? pl.bg    : 'var(--card-bg)';
        o.querySelector('div:last-child').style.color = active ? pl.color : '#64748B';
      });
    });
  });

  root.querySelector('#tp-cancel')?.addEventListener('click', () => { _editId = null; _draw(root); });

  root.querySelector('#tp-save')?.addEventListener('click', () => {
    const perf = root.querySelector('#tp-perf').value;
    const note = root.querySelector('#tp-note').value.trim();
    const successor = root.querySelector('#tp-successor').checked;

    const list = _getPool();
    const idx  = list.findIndex(x => x.empId === _editId);
    if (idx !== -1) {
      list[idx].potential  = currentPotential;
      list[idx].tags       = currentTags;
      list[idx].perfScore  = perf ? Number(perf) : null;
      list[idx].note       = note;
      list[idx].successor  = successor;
      list[idx].updatedAt  = new Date().toISOString();
      _savePool(list);
    }
    showToast('인재 정보가 저장되었습니다.', 'success');
    addNotification({ type: 'success', title: 'Talent Pool (관리자)', body: '인재 정보가 저장되었습니다.' });
    _editId = null;
    _draw(root);
  });
}
