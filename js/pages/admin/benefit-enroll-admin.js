/**
 * benefit-enroll-admin.js — 선택적 복리후생 가입 현황 (관리자)
 */
import { showToast } from '../../components/toast.js'
import { addNotification } from '../../components/notification-hub.js';

const LS_KEY = 'hr_benefit_enrollments';

const BENEFITS = [
  { id:'health-plus',  label:'실손의료보험',  cost:15000,  icon:'🏥' },
  { id:'dental',       label:'치과 보험',    cost:8000,   icon:'🦷' },
  { id:'gym',          label:'피트니스 지원', cost:30000,  icon:'💪' },
  { id:'gym-subsidy',  label:'통근 교통비',   cost:50000,  icon:'🚌' },
  { id:'mental-health',label:'심리상담 지원',  cost:5000,   icon:'🧠' },
  { id:'childcare',    label:'육아 보조금',   cost:150000, icon:'👶' },
];

const LEGACY_EMP_IDS = new Set(['EMP001','EMP002','EMP003','EMP004','EMP005','EMP006','EMP007','EMP008','EMP009','EMP010','EMP011','EMP012']);

function _getData() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    // Support both array format and map format
    const arr = Array.isArray(raw)
      ? raw
      : Object.entries(raw).map(([empId, v]) => ({
          empId,
          empName: v.empName || empId,
          dept: v.dept || '',
          enrolledIds: v.enrolledIds || [],
          monthlyCost: v.monthlyCost || 0,
        }));
    const cleaned = arr.filter(r => !LEGACY_EMP_IDS.has(r.empId));
    if (cleaned.length !== arr.length) localStorage.setItem(LS_KEY, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}

let _tab  = 'overview';
let _root = null;

export function render(root) { _root = root; _tab = 'overview'; _draw(); }
export function unmount()    { _root = null; _tab = 'overview'; }

// ── Main draw ───────────────────────────────────────────────────
function _draw() {
  const records = _getData();
  if (!records||!records.length){_root.innerHTML=`<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:48px;margin-bottom:12px">🎁</div><div style="font-size:14px;font-weight:600;margin-bottom:6px">복리후생 신청이 없습니다.</div><div style="font-size:12px">데이터가 축적되면 자동으로 표시됩니다.</div></div>`;return;}

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['overview','개요'],['employees','임직원별']].map(([k,l])=>`
    <button data-tab="${k}"
      style="padding:10px 18px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;flex-shrink:0;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='overview' ? _renderOverview(records) : _renderEmployees(records)}
  </div>
</div>`;

  _root.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
    _tab = b.dataset.tab; _draw();
  }));
}

// ── Tab: 개요 ───────────────────────────────────────────────────
function _renderOverview(records) {
  const enrolled   = records.filter(r => r.enrolledIds.length > 0);
  const unenrolled = records.filter(r => r.enrolledIds.length === 0);
  const totalCost  = records.reduce((s, r) => s + r.monthlyCost, 0);
  const avgCost    = enrolled.length ? Math.round(totalCost / enrolled.length) : 0;

  // Per-benefit counts
  const benefitCounts = {};
  BENEFITS.forEach(b => { benefitCounts[b.id] = 0; });
  records.forEach(r => r.enrolledIds.forEach(id => { benefitCounts[id] = (benefitCounts[id] || 0) + 1; }));

  const sortedBenefits = [...BENEFITS].sort((a, b) => (benefitCounts[b.id] || 0) - (benefitCounts[a.id] || 0));
  const maxCount = Math.max(...Object.values(benefitCounts), 1);

  // Dept cost
  const deptCost = {};
  records.forEach(r => { deptCost[r.dept] = (deptCost[r.dept] || 0) + r.monthlyCost; });
  const maxDept = Math.max(...Object.values(deptCost), 1);

  return `
<!-- KPI cards -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
  ${[
    ['전체 가입자', `${enrolled.length}명`, '✅', '#4F46E5'],
    ['미가입',      `${unenrolled.length}명`, '⭕', '#EF4444'],
    ['월 총 지원액', `${(totalCost/10000).toFixed(1)}만원`, '💰', '#10B981'],
    ['인당 평균',   `${(avgCost/10000).toFixed(1)}만원`, '📊', '#F59E0B'],
  ].map(([l,v,ic,c]) => `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px">
    <div style="font-size:20px;margin-bottom:4px">${ic}</div>
    <div style="font-size:20px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:11px;color:#94A3B8;margin-top:2px">${l}</div>
  </div>`).join('')}
</div>

<!-- 복리후생별 가입 현황 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
  <div style="font-size:13px;font-weight:700;margin-bottom:12px">복리후생별 가입 현황</div>
  ${sortedBenefits.map(b => {
    const cnt = benefitCounts[b.id] || 0;
    const pct = Math.round((cnt / records.length) * 100);
    const barW = Math.round((cnt / maxCount) * 100);
    const monthlyCostTotal = cnt * b.cost;
    return `
  <div style="margin-bottom:12px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <span style="font-size:18px">${b.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px">
          <span style="font-size:12px;font-weight:600;color:var(--text)">${b.label}</span>
          <span style="font-size:11px;font-weight:700;color:#4F46E5">${cnt}명 가입</span>
        </div>
        <div style="background:#E2E8F0;border-radius:99px;height:6px">
          <div style="background:#4F46E5;height:6px;border-radius:99px;width:${barW}%;transition:width .3s"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:2px;font-size:10px;color:#94A3B8">
          <span>가입률 ${pct}%</span>
          <span>월 ${monthlyCostTotal.toLocaleString()}원</span>
        </div>
      </div>
    </div>
  </div>`;}).join('')}
</div>

<!-- 부서별 월 지원액 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:12px">부서별 월 지원액</div>
  ${Object.entries(deptCost).sort((a, b) => b[1] - a[1]).map(([dept, cost]) => {
    const pct = Math.round((cost / maxDept) * 100);
    return `
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
    <div style="width:52px;font-size:11px;font-weight:600;color:var(--text);text-align:right;flex-shrink:0">${dept}</div>
    <div style="flex:1">
      <div style="background:#E2E8F0;border-radius:99px;height:7px">
        <div style="background:#10B981;height:7px;border-radius:99px;width:${pct}%"></div>
      </div>
    </div>
    <div style="font-size:11px;font-weight:700;color:#10B981;width:72px;text-align:right">${cost.toLocaleString()}원</div>
  </div>`;}).join('')}
</div>`;
}

// ── Tab: 임직원별 ────────────────────────────────────────────────
function _renderEmployees(records) {
  const sorted = [...records].sort((a, b) => b.monthlyCost - a.monthlyCost);

  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);
       display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:13px;font-weight:700">임직원별 가입 현황 (${records.length}명)</div>
    <div style="font-size:11px;color:#94A3B8">월 지원액 기준 정렬</div>
  </div>
  ${sorted.map(r => {
    const benefitIcons = r.enrolledIds.map(id => {
      const b = BENEFITS.find(x => x.id === id);
      return b ? `<span title="${b.label}" style="font-size:16px">${b.icon}</span>` : '';
    }).join('');

    const costColor = r.monthlyCost >= 100000 ? '#EF4444'
                    : r.monthlyCost >= 50000  ? '#F59E0B'
                    : r.monthlyCost === 0     ? '#94A3B8'
                    : '#10B981';

    return `
  <div style="padding:12px 14px;border-bottom:1px solid var(--border)">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <span style="font-size:14px;font-weight:700;color:var(--text)">${r.empName}</span>
        <span style="font-size:11px;color:#94A3B8;margin-left:6px">${r.dept}</span>
        <div style="font-size:11px;color:#64748B;margin-top:3px">${r.enrolledIds.length}개 혜택 가입</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:15px;font-weight:800;color:${costColor}">${r.monthlyCost.toLocaleString()}원</div>
        <div style="font-size:10px;color:#94A3B8;margin-top:1px">월 지원</div>
      </div>
    </div>
    ${r.enrolledIds.length > 0
      ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${benefitIcons}</div>`
      : `<div style="margin-top:6px;font-size:11px;color:#94A3B8;background:#F8FAFC;border-radius:8px;padding:6px 10px">미가입</div>`}
  </div>`;}).join('')}
</div>`;
}
export function mount(root) { return render(root); }
