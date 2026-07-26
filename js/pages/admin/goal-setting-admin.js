/**
 * goal-setting-admin.js — 목표 설정 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_goals';

const LEGACY_IDS = new Set(['GOAL001', 'GOAL002', 'GOAL003', 'GOAL004', 'GOAL005', 'GOAL006']);

function _load() {
  try {
    const d = JSON.parse(localStorage.getItem(LS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_IDS.has(r.id));
    if (cleaned.length !== list.length) _save(cleaned);
    return cleaned;
  } catch { return []; }
}

function _save(list) { localStorage.setItem(LS, JSON.stringify(list)); }

function _avgProgress(goal) {
  if (!goal.keyResults || !goal.keyResults.length) return 0;
  const sum = goal.keyResults.reduce((s, kr) => s + (kr.progress || 0), 0);
  return Math.round(sum / goal.keyResults.length);
}

let _tab = '전체목표';
let _root = null;

export function render(root) { _root = root; _tab = '전체목표'; _draw(); }
export function unmount() { _root = null;
  _tab = '전체목표';
}

function _draw() {
  const all       = _load().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const active    = all.filter(g => g.status === 'active');
  const completed = all.filter(g => g.status === 'completed');

  _root.innerHTML = `
<div style="padding:0">
  <!-- 탭 -->
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['전체목표','전체 목표'],['부서별현황','부서별 현황']].map(([k,l]) => `
    <button class="gsa-tab" data-tab="${k}"
      style="padding:10px 18px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab === k ? 'var(--primary)' : 'transparent'};
             color:${_tab === k ? 'var(--primary)' : '#94A3B8'}">${l}</button>`).join('')}
  </div>

  <div style="padding:14px 16px">
    <!-- 통계 카드 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
      ${[
        { l: '활성 목표',  v: active.length    + '개', c: '#4F46E5' },
        { l: '완료 목표',  v: completed.length + '개', c: '#10B981' },
      ].map(k => `
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
           padding:14px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:${k.c}">${k.v}</div>
        <div style="font-size:11px;color:#64748B;margin-top:3px">${k.l}</div>
      </div>`).join('')}
    </div>

    ${_tab === '전체목표' ? _renderGoals(all) : _renderDepts(all)}
  </div>
</div>`;

  _root.querySelectorAll('.gsa-tab').forEach(b =>
    b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderGoals(all) {
  if (!all.length) return `
  <div style="text-align:center;padding:40px 20px;color:#94A3B8">
    <div style="font-size:36px;margin-bottom:8px">🎯</div>
    <div style="font-size:13px;font-weight:600">등록된 목표가 없습니다</div>
  </div>`;

  return all.map(g => {
    const avg    = _avgProgress(g);
    const isActive = g.status === 'active';
    const pColor = avg >= 80 ? '#10B981' : avg >= 50 ? '#F59E0B' : '#EF4444';
    return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:14px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:8px;
            color:${isActive ? '#4F46E5' : '#059669'};background:${isActive ? '#EEF2FF' : '#D1FAE5'}">${isActive ? '활성' : '완료'}</span>
          <span style="font-size:11px;color:#64748B">${g.dept}</span>
        </div>
        <div style="font-size:13px;font-weight:700;color:var(--text);
             white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${g.title}</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">${g.empName} · ${g.createdAt}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;margin-left:8px">
        <div style="font-size:18px;font-weight:800;color:${pColor}">${avg}%</div>
        <div style="font-size:10px;color:#94A3B8">달성률</div>
      </div>
    </div>
    <!-- 진행률 바 -->
    <div style="height:8px;background:#E2E8F0;border-radius:4px;overflow:hidden;margin-bottom:8px">
      <div style="height:100%;width:${Math.min(avg,100)}%;background:${pColor};border-radius:4px;transition:width .4s"></div>
    </div>
    <!-- KR 요약 -->
    <div style="font-size:11px;color:#94A3B8">
      KR ${g.keyResults ? g.keyResults.length : 0}개 ·
      완료 ${g.keyResults ? g.keyResults.filter(kr => kr.progress >= 100).length : 0}개
    </div>
    ${isActive ? `
    <button class="gsa-complete" data-id="${g.id}"
      style="width:100%;background:#D1FAE5;color:#065F46;border:none;border-radius:8px;
             padding:8px;font-size:12px;font-weight:600;cursor:pointer;margin-top:10px">✅ 완료 처리</button>` : ''}
  </div>`;
  }).join('');
}

function _renderDepts(all) {
  if (!all.length) return `
  <div style="text-align:center;padding:40px 20px;color:#94A3B8">
    <div style="font-size:36px;margin-bottom:8px">🏢</div>
    <div style="font-size:13px;font-weight:600">데이터가 없습니다</div>
  </div>`;

  // Group by dept
  const depts = {};
  all.forEach(g => {
    if (!depts[g.dept]) depts[g.dept] = [];
    depts[g.dept].push(g);
  });

  const maxAvg = Math.max(1, ...Object.values(depts).map(gs => {
    const total = gs.reduce((s, g) => s + _avgProgress(g), 0);
    return Math.round(total / gs.length);
  }));

  return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
    <div style="font-size:13px;font-weight:700;margin-bottom:14px">부서별 목표 현황</div>
    ${Object.entries(depts).map(([dept, goals]) => {
      const avgArr  = goals.map(_avgProgress);
      const deptAvg = Math.round(avgArr.reduce((s,v) => s+v, 0) / avgArr.length);
      const barPct  = Math.round(deptAvg / maxAvg * 100);
      const color   = deptAvg >= 75 ? '#10B981' : deptAvg >= 50 ? '#F59E0B' : '#EF4444';
      const active  = goals.filter(g => g.status === 'active').length;
      const done    = goals.filter(g => g.status === 'completed').length;
      return `
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <div>
          <span style="font-size:12px;font-weight:700;color:var(--text)">${dept}</span>
          <span style="font-size:11px;color:#94A3B8;margin-left:6px">총 ${goals.length}개 (활성 ${active} / 완료 ${done})</span>
        </div>
        <span style="font-size:13px;font-weight:800;color:${color}">${deptAvg}%</span>
      </div>
      <div style="height:10px;background:#E2E8F0;border-radius:5px;overflow:hidden">
        <div style="height:100%;width:${barPct}%;background:${color};border-radius:5px;transition:width .4s"></div>
      </div>
    </div>`;
    }).join('')}
  </div>`;
}

function _bindEvents() {
  if (!_root) return;

  _root.querySelectorAll('.gsa-complete').forEach(btn =>
    btn.addEventListener('click', () => {
      const list = _load();
      const idx  = list.findIndex(g => g.id === btn.dataset.id);
      if (idx >= 0) { list[idx].status = 'completed'; list[idx].completedAt = new Date().toISOString().slice(0,10); _save(list); }
      showToast('목표가 완료 처리되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Goal Setting (관리자)', body: '목표가 완료 처리되었습니다.' });
      _draw();
    }));
}
export function mount(root) { return render(root); }
