/**
 * self-assessment-admin.js — 자기평가 관리 (관리자)
 */
import { showToast } from '../../components/toast.js'
import { addNotification } from '../../components/notification-hub.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';

const LS = 'hr_self_assessments';

const COMPETENCIES = [
  { key:'expertise',     label:'업무 전문성' },
  { key:'goal',          label:'목표 달성' },
  { key:'collaboration', label:'협업·팀워크' },
  { key:'communication', label:'커뮤니케이션' },
  { key:'initiative',    label:'주도성·혁신' },
  { key:'growth',        label:'성장·학습' },
];

let _employees = [];

const HALF = new Date().getMonth() < 6 ? '상반기' : '하반기';
const CYCLE_NAME = `${new Date().getFullYear()}년 ${HALF} 자기평가`;

const LEGACY_IDS = new Set(['SA001','SA002','SA003','SA004']);

function _getAll() {
  try {
    const d = JSON.parse(localStorage.getItem(LS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_IDS.has(r.id));
    if (cleaned.length !== list.length) localStorage.setItem(LS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}

let _tab  = 'status';
let _root = null;

export function render(root) { _root = root; _tab='status'; _draw(); }
export function unmount() { _root = null;
  _tab = 'status';
}

function _draw() {
  const assessments = _getAll();
  const submitted   = assessments.filter(a=>a.cycle===CYCLE_NAME && a.submitted);

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['status','제출 현황'],['analysis','역량 분석']].map(([k,l])=>`
    <button class="saa-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='status' ? _renderStatus(submitted) : _renderAnalysis(submitted)}
  </div>
</div>`;

  _root.querySelectorAll('.saa-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
}

function _renderStatus(submitted) {
  const rate = Math.round(submitted.length/Math.max(_employees.length, 1)*100);
  const submittedIds = new Set(submitted.map(a=>a.empId));

  return `
<!-- KPI -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
  ${[
    ['평가 사이클', CYCLE_NAME.slice(5), '#4F46E5'],
    ['제출 완료', `${submitted.length}명`, '#10B981'],
    ['제출률', `${rate}%`, rate>=80?'#10B981':'#F59E0B'],
  ].map(([l,v,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:${v.length>6?'12':'18'}px;font-weight:800;color:${c};line-height:1.2">${v}</div>
    <div style="font-size:10px;color:#94A3B8;margin-top:1px">${l}</div>
  </div>`).join('')}
</div>

<!-- 제출률 bar -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
  <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px">
    <span style="font-weight:600">전체 제출률</span>
    <span style="font-weight:700;color:#4F46E5">${submitted.length} / ${_employees.length}명</span>
  </div>
  <div style="background:var(--bg);border-radius:6px;height:8px">
    <div style="height:100%;border-radius:6px;background:#4F46E5;width:${rate}%"></div>
  </div>
</div>

<!-- 직원별 현황 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700">직원별 현황</div>
  ${_employees.map(emp=>{
    const a = submitted.find(s=>s.empId===emp.id);
    return `
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
    <div style="width:32px;height:32px;border-radius:50%;background:#EEF2FF;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#4F46E5;flex-shrink:0">${emp.name[0]}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:12px;font-weight:600">${emp.name}</div>
      <div style="font-size:10px;color:#94A3B8">${emp.dept} · ${emp.position}</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;
                 background:${a?'#D1FAE5':'#FEF3C7'};color:${a?'#10B981':'#D97706'}">
      ${a?'제출 완료':'미제출'}
    </span>
  </div>`; }).join('')}
</div>`;
}

function _renderAnalysis(submitted) {
  if (!submitted.length) return `
<div style="text-align:center;padding:48px;color:#94A3B8">
  <div style="font-size:32px;margin-bottom:8px">📊</div>
  <div style="font-size:13px">제출된 자기평가가 없습니다.</div>
</div>`;

  const avgs = COMPETENCIES.map(c=>{
    const vals = submitted.map(a=>a.scores?.[c.key]).filter(v=>v!=null);
    const avg  = vals.length ? vals.reduce((s,v)=>s+v,0)/vals.length : 0;
    return { ...c, avg };
  });
  const best  = [...avgs].sort((a,b)=>b.avg-a.avg)[0];
  const worst = [...avgs].sort((a,b)=>a.avg-b.avg)[0];

  return `
<!-- 요약 -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
  <div style="background:#D1FAE5;border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:10px;color:#065F46;margin-bottom:2px">최고 역량</div>
    <div style="font-size:12px;font-weight:800;color:#10B981">${best.label}</div>
    <div style="font-size:16px;font-weight:800;color:#10B981">${best.avg.toFixed(1)}</div>
  </div>
  <div style="background:#FEF3C7;border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:10px;color:#92400E;margin-bottom:2px">개발 필요</div>
    <div style="font-size:12px;font-weight:800;color:#F59E0B">${worst.label}</div>
    <div style="font-size:16px;font-weight:800;color:#F59E0B">${worst.avg.toFixed(1)}</div>
  </div>
</div>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
  <div style="font-size:13px;font-weight:700;margin-bottom:12px">역량별 평균</div>
  ${avgs.map(c=>`
  <div style="margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
      <span style="font-weight:600">${c.label}</span>
      <span style="font-weight:700;color:#4F46E5">${c.avg.toFixed(1)} / 5</span>
    </div>
    <div style="background:var(--bg);border-radius:6px;height:6px">
      <div style="height:100%;border-radius:6px;background:#4F46E5;width:${c.avg/5*100}%"></div>
    </div>
  </div>`).join('')}
</div>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700">제출자별 평균</div>
  ${submitted.map(a=>{
    const vals = Object.values(a.scores||{}).filter(v=>v!=null);
    const avg  = vals.length ? vals.reduce((s,v)=>s+v,0)/vals.length : 0;
    return `
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:12px;font-weight:600">${a.empName}</div>
      <div style="font-size:10px;color:#94A3B8">${a.dept}</div>
    </div>
    <span style="font-size:14px;font-weight:800;color:${avg>=4?'#10B981':avg>=3?'#3B82F6':'#F59E0B'}">${avg.toFixed(1)}</span>
  </div>`; }).join('')}
</div>`;
}
export async function mount(root) {
  _employees = await loadDisplayEmployees();
  return render(root);
}
