/**
 * headcount-plan.js — 인력 계획 (관리자)
 */

import { showToast } from '../../components/toast.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_headcount_plan';
const YEAR = 2026;
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

function _defaultPlan(employees) {
  const depts = [...new Set(employees.map(e => e.dept || e.department || '기타'))].sort();
  return depts.map(dept => {
    const current = employees.filter(e => (e.dept || e.department || '기타') === dept).length;
    return {
      dept,
      current,
      targets:   { Q1: current, Q2: current, Q3: current + 1, Q4: current + 1 },
      hireTypes: { Q1: 0, Q2: 0, Q3: 1, Q4: 0 },
      notes: '',
    };
  });
}

function _getPlan(employees) {
  try {
    const stored = JSON.parse(localStorage.getItem(LS) || '[]');
    return stored.length ? stored : _defaultPlan(employees);
  } catch { return _defaultPlan(employees); }
}
function _savePlan(p) { localStorage.setItem(LS, JSON.stringify(p)); }

let _tab = 'plan';
let _editDept = null;
let _employees = [];

export async function mount(root) {
  _tab = 'plan'; _editDept = null;
  root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">⏳</div><div style="font-size:13px">직원 데이터 로딩 중…</div></div>`;
  _employees = await loadDisplayEmployees();
  _draw(root);
}
export function render(root) { _tab = 'plan'; _editDept = null; _draw(root); }
export function unmount() { _tab = 'plan'; _editDept = null; _employees = []; }

function _draw(root) {
  const plan = _getPlan(_employees);
  const totalCurrent = plan.reduce((n, d) => n + d.current, 0);
  const totalTargetQ4 = plan.reduce((n, d) => n + (d.targets.Q4 || d.current), 0);
  const totalHires = plan.reduce((n, d) => n + QUARTERS.reduce((s, q) => s + (d.hireTypes[q] || 0), 0), 0);

  root.innerHTML = `
<!-- KPI -->
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
  ${[
    { label: '현원',      val: totalCurrent,  color: '#4F46E5' },
    { label: `${YEAR}년말 목표`, val: totalTargetQ4, color: '#10B981' },
    { label: '순증',      val: `+${totalTargetQ4 - totalCurrent}`, color: '#F59E0B' },
    { label: '채용 계획',  val: totalHires,    color: '#3B82F6' },
  ].map(k => `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
      <div style="font-size:18px;font-weight:800;color:${k.color}">${k.val}</div>
      <div style="font-size:10px;color:#64748B;margin-top:2px">${k.label}</div>
    </div>`).join('')}
</div>

<!-- 탭 -->
<div style="display:flex;border-bottom:1px solid var(--border);margin-bottom:14px">
  ${[{k:'plan',l:'인력 계획'},{k:'chart',l:'추이 차트'},{k:'summary',l:'요약 보고'}].map(t=>`
    <button class="hc-tab" data-t="${t.k}"
      style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab===t.k?'#4F46E5':'transparent'};color:${_tab===t.k?'#4F46E5':'#64748B'}">
      ${t.l}
    </button>`).join('')}
</div>

${_tab === 'plan'    ? _renderPlanTab(plan)    : ''}
${_tab === 'chart'   ? _renderChartTab(plan)   : ''}
${_tab === 'summary' ? _renderSummaryTab(plan) : ''}`;

  root.querySelectorAll('.hc-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _draw(root); });
  });

  if (_tab === 'plan') {
    root.querySelectorAll('.hc-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => { _editDept = btn.dataset.dept; _drawEdit(root); });
    });
  }
}

function _renderPlanTab(plan) {
  return `
<div style="overflow-x:auto">
  <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:480px">
    <thead>
      <tr style="background:var(--bg)">
        <th style="text-align:left;padding:8px 10px;border-bottom:2px solid var(--border);color:#64748B;font-size:11px">부서</th>
        <th style="text-align:center;padding:8px 6px;border-bottom:2px solid var(--border);color:#64748B;font-size:11px">현원</th>
        ${QUARTERS.map(q=>`<th style="text-align:center;padding:8px 6px;border-bottom:2px solid var(--border);color:#64748B;font-size:11px">${q}</th>`).join('')}
        <th style="text-align:center;padding:8px 6px;border-bottom:2px solid var(--border);color:#64748B;font-size:11px">채용수</th>
        <th style="padding:8px 6px;border-bottom:2px solid var(--border)"></th>
      </tr>
    </thead>
    <tbody>
      ${plan.map(d => {
        const totalH = QUARTERS.reduce((n, q) => n + (d.hireTypes[q] || 0), 0);
        const q4Target = d.targets.Q4 || d.current;
        const change = q4Target - d.current;
        return `
<tr style="border-bottom:1px solid var(--border)">
  <td style="padding:10px;font-weight:600;color:var(--text)">${d.dept}</td>
  <td style="text-align:center;padding:10px;color:#64748B">${d.current}</td>
  ${QUARTERS.map(q => `
    <td style="text-align:center;padding:10px">
      <span style="font-weight:700;color:${(d.targets[q]||d.current)>d.current?'#10B981':(d.targets[q]||d.current)<d.current?'#EF4444':'var(--text)'}">
        ${d.targets[q] ?? d.current}
      </span>
    </td>`).join('')}
  <td style="text-align:center;padding:10px;color:#3B82F6;font-weight:700">+${totalH}</td>
  <td style="text-align:center;padding:6px">
    <button class="hc-edit-btn" data-dept="${d.dept}"
      style="padding:4px 8px;background:#EEF2FF;color:#4F46E5;border:none;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer">편집</button>
  </td>
</tr>`;
      }).join('')}
    </tbody>
    <tfoot>
      <tr style="background:var(--bg);font-weight:700">
        <td style="padding:10px;color:var(--text)">합계</td>
        <td style="text-align:center;padding:10px;color:var(--text)">${plan.reduce((n,d)=>n+d.current,0)}</td>
        ${QUARTERS.map(q=>`<td style="text-align:center;padding:10px;color:#4F46E5">${plan.reduce((n,d)=>n+(d.targets[q]??d.current),0)}</td>`).join('')}
        <td style="text-align:center;padding:10px;color:#3B82F6">+${plan.reduce((n,d)=>n+QUARTERS.reduce((s,q)=>s+(d.hireTypes[q]||0),0),0)}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>
</div>`;
}

function _renderChartTab(plan) {
  const quarterTotals = QUARTERS.map(q => plan.reduce((n, d) => n + (d.targets[q] ?? d.current), 0));
  const maxVal = Math.max(...quarterTotals) * 1.15;

  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:14px">${YEAR}년 분기별 총 인원 목표</div>
  <div style="display:flex;align-items:flex-end;gap:12px;height:140px;padding:0 4px">
    ${QUARTERS.map((q, i) => {
      const val = quarterTotals[i];
      const h   = Math.round((val / maxVal) * 120);
      const prev = i > 0 ? quarterTotals[i-1] : plan.reduce((n,d)=>n+d.current,0);
      const diff = val - prev;
      return `
<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">
  <div style="font-size:11px;font-weight:700;color:${diff>0?'#10B981':diff<0?'#EF4444':'#64748B'};margin-bottom:4px">
    ${diff>0?'+':''}${diff}
  </div>
  <div style="font-size:14px;font-weight:800;color:#4F46E5;margin-bottom:4px">${val}</div>
  <div style="width:100%;height:${h}px;background:linear-gradient(to top,#4F46E5,#818CF8);border-radius:6px 6px 0 0"></div>
  <div style="font-size:11px;color:#64748B;margin-top:6px;font-weight:600">${q}</div>
</div>`;
    }).join('')}
  </div>
</div>

<!-- 부서별 증감 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">부서별 연간 증감</div>
  ${plan.map(d => {
    const change = (d.targets.Q4 ?? d.current) - d.current;
    const pct    = d.current ? Math.round(Math.abs(change) / d.current * 100) : 0;
    return `
<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
  <span style="font-size:12px;font-weight:600;color:var(--text);min-width:72px">${d.dept}</span>
  <div style="flex:1;height:12px;background:#E2E8F0;border-radius:6px;overflow:hidden">
    <div style="height:100%;background:${change>0?'#10B981':change<0?'#EF4444':'#E2E8F0'};border-radius:6px;width:${Math.min(100,pct*5)}%;transition:width .3s"></div>
  </div>
  <span style="font-size:12px;font-weight:700;color:${change>0?'#10B981':change<0?'#EF4444':'#64748B'};min-width:32px;text-align:right">${change>0?'+':''}${change}</span>
</div>`;
  }).join('')}
</div>`;
}

function _renderSummaryTab(plan) {
  const year = YEAR;
  const totalCurrent = plan.reduce((n,d)=>n+d.current,0);
  const totalQ4 = plan.reduce((n,d)=>n+(d.targets.Q4??d.current),0);
  const growDepts = plan.filter(d=>(d.targets.Q4??d.current)>d.current);
  const shrinkDepts = plan.filter(d=>(d.targets.Q4??d.current)<d.current);
  const totalHires = plan.reduce((n,d)=>n+QUARTERS.reduce((s,q)=>s+(d.hireTypes[q]||0),0),0);

  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:14px">📄 ${year}년 인력 계획 요약</div>
  <div style="font-size:12px;color:#475569;line-height:1.8">
    <p><strong>${year}년 12월 목표 인원:</strong> ${totalQ4}명 (현재 ${totalCurrent}명 대비 <span style="color:${totalQ4>totalCurrent?'#10B981':'#EF4444'}">${totalQ4>totalCurrent?'+':''}${totalQ4-totalCurrent}명</span>)</p>
    <p><strong>연간 채용 계획:</strong> ${totalHires}명</p>
    ${growDepts.length ? `<p><strong>증원 부서:</strong> ${growDepts.map(d=>`${d.dept}(+${(d.targets.Q4??d.current)-d.current})`).join(', ')}</p>` : ''}
    ${shrinkDepts.length ? `<p><strong>감원 예정:</strong> ${shrinkDepts.map(d=>`${d.dept}(${(d.targets.Q4??d.current)-d.current})`).join(', ')}</p>` : ''}
  </div>
</div>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">분기별 채용 계획</div>
  ${QUARTERS.map(q => {
    const hires = plan.reduce((n,d)=>n+(d.hireTypes[q]||0),0);
    const depts = plan.filter(d=>(d.hireTypes[q]||0)>0).map(d=>`${d.dept} ${d.hireTypes[q]}명`);
    return `
<div style="padding:10px 0;border-bottom:1px solid var(--border)">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
    <span style="font-size:12px;font-weight:700;color:var(--text)">${q}</span>
    <span style="font-size:13px;font-weight:800;color:#3B82F6">${hires}명</span>
  </div>
  <div style="font-size:11px;color:#64748B">${depts.join(' · ') || '채용 계획 없음'}</div>
</div>`;
  }).join('')}
</div>`;
}

function _drawEdit(root) {
  const plan = _getPlan();
  const d = plan.find(x => x.dept === _editDept);
  if (!d) { _editDept = null; _draw(root); return; }

  root.innerHTML = `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div style="font-size:14px;font-weight:700;color:var(--text)">${d.dept} 인력 계획 편집</div>
    <button id="hc-cancel" style="padding:6px 12px;border:1.5px solid var(--border);border-radius:8px;background:none;font-size:12px;cursor:pointer;color:#64748B">취소</button>
  </div>

  <div style="margin-bottom:14px">
    <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:6px">현원: ${d.current}명</div>
  </div>

  <!-- 분기별 목표 인원 -->
  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">분기별 목표 인원</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
    ${QUARTERS.map(q => `
      <div>
        <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px">${q} 목표 인원</label>
        <input id="hc-target-${q}" type="number" min="0" value="${d.targets[q]??d.current}"
          style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
      </div>`).join('')}
  </div>

  <!-- 분기별 채용 계획 -->
  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">분기별 채용 인원</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
    ${QUARTERS.map(q => `
      <div>
        <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px">${q} 채용</label>
        <input id="hc-hire-${q}" type="number" min="0" value="${d.hireTypes[q]||0}"
          style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
      </div>`).join('')}
  </div>

  <!-- 메모 -->
  <div style="margin-bottom:16px">
    <label style="font-size:12px;font-weight:700;color:var(--text);display:block;margin-bottom:6px">메모</label>
    <textarea id="hc-notes" rows="2"
      style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;background:var(--bg);color:var(--text);resize:vertical;box-sizing:border-box">${d.notes||''}</textarea>
  </div>

  <button id="hc-save"
    style="width:100%;padding:13px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">저장</button>
</div>`;

  root.querySelector('#hc-cancel')?.addEventListener('click', () => { _editDept = null; _draw(root); });
  root.querySelector('#hc-save')?.addEventListener('click', () => {
    const plan2 = _getPlan();
    const idx = plan2.findIndex(x => x.dept === _editDept);
    if (idx !== -1) {
      const targets = {}, hireTypes = {};
      QUARTERS.forEach(q => {
        targets[q]   = Number(root.querySelector(`#hc-target-${q}`).value) || 0;
        hireTypes[q] = Number(root.querySelector(`#hc-hire-${q}`).value)   || 0;
      });
      plan2[idx].targets   = targets;
      plan2[idx].hireTypes = hireTypes;
      plan2[idx].notes     = root.querySelector('#hc-notes').value.trim();
      _savePlan(plan2);
    }
    showToast('인력 계획이 저장되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Headcount Plan (관리자)', body: '인력 계획이 저장되었습니다.' });
    _editDept = null;
    _draw(root);
  });
}
