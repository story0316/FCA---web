/**
 * salary-raise-admin.js — 연봉 인상 요청 검토
 */

import { loadDisplayEmployees } from '../../data/demo_employees.js';
import { showToast } from '../../components/toast.js'
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_salary_raise_requests';

const REASONS = {
  performance: { label: '우수한 성과',      icon: '🏆' },
  market:      { label: '시장 대비 낮음',    icon: '📊' },
  role:        { label: '직무 범위 확대',    icon: '📈' },
  tenure:      { label: '장기 근속',         icon: '⏳' },
  skill:       { label: '전문 역량 향상',    icon: '🎓' },
  other:       { label: '기타',              icon: '💬' },
};

const STATUS_META = {
  draft:       { label: '임시저장',  bg: '#F1F5F9', color: '#64748B' },
  pending:     { label: '검토 중',   bg: '#FEF3C7', color: '#D97706' },
  approved:    { label: '승인',      bg: '#D1FAE5', color: '#059669' },
  negotiating: { label: '협의 중',   bg: '#EFF6FF', color: '#3B82F6' },
  rejected:    { label: '반려',      bg: '#FEE2E2', color: '#EF4444' },
};

const ANNUAL_RAISE_BUDGET_PCT = 5; // 연봉 총액의 5% 인상 예산

let _employees = [];

function _load()    { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } }
function _save(d)   { localStorage.setItem(LS, JSON.stringify(d)); }
function _emp(id)   { return _employees.find(e => e.id === id || e.employee_id === id); }

const SALARY_BY_POS = { '사원':3200,'주임':3600,'대리':4200,'과장':5000,'차장':5800,'부장':6800,'이사':8500 };

function _seedDemo(all) {
  if (all.length >= 6) return all;
  const seeded = [...all];
  const statuses = ['pending','pending','approved','negotiating','rejected','pending'];
  _employees.slice(0, 6).forEach((emp, i) => {
    const pos = emp.position || emp.role || '대리';
    const base = (SALARY_BY_POS[pos] || 4200) * 10000;
    const target = Math.round(base * (1 + [0.08,0.12,0.10,0.15,0.07,0.09][i]));
    seeded.push({
      id:            `demo_srr_${emp.id}`,
      userId:        emp.id || emp.employee_id,
      userName:      emp.name,
      dept:          emp.department || emp.dept || '기타',
      position:      pos,
      currentSalary: base,
      targetSalary:  target,
      reasons:       [['performance','market','role','tenure','skill','other'][i]],
      achievements:  ['Q1 목표 135% 달성, 팀 생산성 20% 개선','3년 연속 S등급, 팀 리딩 역할 확대','신규 서비스 론칭 핵심 기여','5년 근속, AWS 자격증 취득','마케팅 캠페인 ROI 250%','기타 사유'][i],
      detail:        '',
      status:        statuses[i],
      adminComment:  statuses[i]==='approved'?'승인 처리됩니다. 다음 달 급여부터 반영됩니다.':statuses[i]==='rejected'?'현재 예산 상황으로 반영이 어렵습니다.':'',
      createdAt:     new Date(Date.now() - i * 86400000 * 5).toISOString(),
    });
  });
  return seeded;
}

let _tab = 'pending';
let _sel = null;

export async function mount(root) {
  _tab = 'pending'; _sel = null;
  root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">⏳</div><div style="font-size:13px">로딩 중…</div></div>`;
  _employees = await loadDisplayEmployees();
  _draw(root);
}

export function render(root) { _tab = 'pending'; _sel = null; _draw(root); }
export function unmount() { _tab = 'pending'; _sel = null; _employees = []; }

function _draw(root) {
  const raw = _load();
  const all = _seedDemo(raw);

  const depts = [...new Set(_employees.map(e => e.department || e.dept || '기타'))].sort();
  const totalBase = _employees.reduce((s, e) => {
    const pos = e.position || e.role || '대리';
    return s + (SALARY_BY_POS[pos] || 4200) * 10000;
  }, 0);
  const budgetAmt   = Math.round(totalBase * ANNUAL_RAISE_BUDGET_PCT / 100);
  const approvedAmt = all.filter(r => r.status === 'approved')
    .reduce((s, r) => s + ((r.targetSalary - r.currentSalary) || 0), 0);
  const budgetPct   = Math.min(100, Math.round(approvedAmt / budgetAmt * 100));
  const budgetColor = budgetPct >= 80 ? '#EF4444' : budgetPct >= 60 ? '#F59E0B' : '#10B981';

  const counts = {};
  Object.keys(STATUS_META).forEach(k => { counts[k] = all.filter(r => r.status === k).length; });

  root.innerHTML = `
<!-- 예산 소진 게이지 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="display:flex;justify-content:space-between;margin-bottom:6px">
    <span style="font-size:12px;font-weight:700;color:var(--text)">연봉 인상 예산 소진 (${ANNUAL_RAISE_BUDGET_PCT}%)</span>
    <span style="font-size:12px;color:${budgetColor};font-weight:700">${Math.round(approvedAmt/10000).toLocaleString()}만원 / ${Math.round(budgetAmt/10000).toLocaleString()}만원</span>
  </div>
  <div style="height:10px;background:#E2E8F0;border-radius:5px;overflow:hidden">
    <div style="height:100%;width:${budgetPct}%;background:${budgetColor};border-radius:5px;transition:width .4s"></div>
  </div>
  <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:10px;color:#94A3B8">
    <span>0</span><span style="color:${budgetColor};font-weight:700">${budgetPct}%</span><span>100%</span>
  </div>
</div>

<!-- KPI -->
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:14px">
  ${[
    { l:'검토 중',  v: counts.pending||0,     c:'#F59E0B' },
    { l:'협의 중',  v: counts.negotiating||0, c:'#3B82F6' },
    { l:'승인',     v: counts.approved||0,    c:'#10B981' },
    { l:'반려',     v: counts.rejected||0,    c:'#EF4444' },
  ].map(k=>`
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:8px;text-align:center">
      <div style="font-size:20px;font-weight:900;color:${k.c}">${k.v}</div>
      <div style="font-size:10px;color:#64748B">${k.l}</div>
    </div>`).join('')}
</div>

<!-- 탭 -->
<div style="display:flex;border-bottom:1px solid var(--border);margin-bottom:12px;overflow-x:auto">
  ${[
    {k:'pending',l:'검토 중'},{k:'negotiating',l:'협의'},{k:'approved',l:'승인'},{k:'rejected',l:'반려'},{k:'dept',l:'부서별'}
  ].map(t=>`
    <button class="sra-tab" data-t="${t.k}"
      style="flex:1;min-width:56px;padding:8px 4px;font-size:11px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab===t.k?'#4F46E5':'transparent'};color:${_tab===t.k?'#4F46E5':'#64748B'}">
      ${t.l}
    </button>`).join('')}
</div>

${_tab === 'dept' ? _renderDept(all, depts) : _renderList(all)}
<div id="sra-detail">${_sel ? _renderDetail(all) : ''}</div>`;

  root.querySelectorAll('.sra-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _sel = null; _draw(root); });
  });

  root.querySelectorAll('.sra-item').forEach(el => {
    el.addEventListener('click', () => {
      _sel = _sel === el.dataset.id ? null : el.dataset.id;
      document.getElementById('sra-detail').innerHTML = _renderDetail(_seedDemo(_load()));
      _bindDetail(root);
    });
  });

  _bindDetail(root);
}

function _renderList(all) {
  const filtered = all.filter(r => r.status === _tab);
  if (!filtered.length) return `<div style="text-align:center;padding:28px;color:#94A3B8;font-size:12px">${STATUS_META[_tab]?.label} 건이 없습니다</div>`;

  return filtered.map(r => {
    const meta = STATUS_META[r.status] || STATUS_META.pending;
    const diff = r.targetSalary - r.currentSalary;
    const pct  = r.currentSalary ? ((diff / r.currentSalary) * 100).toFixed(1) : '?';
    const pctColor = parseFloat(pct) > 15 ? '#EF4444' : parseFloat(pct) > 8 ? '#F59E0B' : '#10B981';
    return `
<div class="sra-item" data-id="${r.id}"
  style="background:var(--card-bg);border:1px solid ${_sel===r.id?'#4F46E5':'var(--border)'};
         border-radius:11px;padding:12px;margin-bottom:7px;cursor:pointer">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div>
      <div style="font-size:13px;font-weight:700;color:var(--text)">${r.userName || r.userId}</div>
      <div style="font-size:11px;color:#64748B">${r.dept} · ${r.position} · ${r.createdAt?.slice(0,10)||''}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:14px;font-weight:900;color:${pctColor}">+${pct}%</div>
      <div style="font-size:10px;color:#94A3B8">+${Math.round(diff/10000)}만원</div>
    </div>
  </div>
  <div style="display:flex;gap:5px;flex-wrap:wrap">
    ${(r.reasons||[]).map(k => { const rr = REASONS[k]; return rr ? `<span style="font-size:10px;padding:2px 6px;background:#EEF2FF;border-radius:5px;color:#4F46E5">${rr.icon} ${rr.label}</span>` : ''; }).join('')}
  </div>
</div>`;
  }).join('');
}

function _renderDept(all, depts) {
  return depts.map(dept => {
    const dReqs = all.filter(r => r.dept === dept);
    if (!dReqs.length) return '';
    const total    = dReqs.reduce((s,r) => s + (r.targetSalary - r.currentSalary), 0);
    const approved = dReqs.filter(r=>r.status==='approved').reduce((s,r) => s + (r.targetSalary - r.currentSalary), 0);
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
    <span style="font-size:12px;font-weight:700;color:var(--text)">${dept}</span>
    <span style="font-size:11px;color:#4F46E5;font-weight:700">${dReqs.length}건 요청</span>
  </div>
  <div style="display:flex;gap:10px;font-size:11px;color:#64748B">
    <span>요청액 합계: <strong style="color:var(--text)">${Math.round(total/10000)}만원</strong></span>
    <span>승인액: <strong style="color:#10B981">${Math.round(approved/10000)}만원</strong></span>
  </div>
</div>`;
  }).join('');
}

function _renderDetail(all) {
  const r = all.find(x => x.id === _sel);
  if (!r) return '';
  const meta = STATUS_META[r.status] || STATUS_META.pending;
  const diff = r.targetSalary - r.currentSalary;
  const pct  = r.currentSalary ? ((diff / r.currentSalary) * 100).toFixed(1) : '?';

  return `
<div style="background:var(--card-bg);border:2px solid #4F46E5;border-radius:14px;padding:16px;margin-top:4px">
  <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:12px">상세 / 처리</div>
  <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px;font-size:12px">
    <div style="display:flex;gap:8px"><span style="color:#94A3B8;width:72px;flex-shrink:0">신청자</span><span style="font-weight:700;color:var(--text)">${r.userName}</span></div>
    <div style="display:flex;gap:8px"><span style="color:#94A3B8;width:72px;flex-shrink:0">소속/직급</span><span style="color:var(--text)">${r.dept} / ${r.position}</span></div>
    <div style="display:flex;gap:8px"><span style="color:#94A3B8;width:72px;flex-shrink:0">현재 연봉</span><span style="color:var(--text)">${Math.round(r.currentSalary/10000)}만원</span></div>
    <div style="display:flex;gap:8px"><span style="color:#94A3B8;width:72px;flex-shrink:0">희망 연봉</span><span style="font-weight:800;font-size:14px;color:#4F46E5">${Math.round(r.targetSalary/10000)}만원 (+${pct}%)</span></div>
    <div style="display:flex;gap:8px"><span style="color:#94A3B8;width:72px;flex-shrink:0">상태</span><span style="padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;background:${meta.bg};color:${meta.color}">${meta.label}</span></div>
  </div>
  ${r.achievements ? `<div style="background:#F8FAFC;border-radius:8px;padding:10px;margin-bottom:10px;font-size:11px;color:#64748B;line-height:1.6"><strong style="color:var(--text);display:block;margin-bottom:3px">주요 실적</strong>${r.achievements}</div>` : ''}
  <textarea id="sra-comment" placeholder="코멘트 입력" rows="2"
    style="width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--border);border-radius:8px;
           font-size:12px;background:var(--card-bg);color:var(--text);resize:none;margin-bottom:10px">${r.adminComment||''}</textarea>
  <div style="display:flex;gap:6px;flex-wrap:wrap">
    ${r.status!=='approved'    ? `<button id="sra-approve"    style="flex:1;padding:9px;background:#10B981;color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">✅ 승인</button>` : ''}
    ${r.status!=='negotiating' ? `<button id="sra-negotiate"  style="flex:1;padding:9px;background:#3B82F6;color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">🤝 협의</button>` : ''}
    ${r.status!=='rejected'    ? `<button id="sra-reject"     style="flex:1;padding:9px;background:#EF4444;color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">❌ 반려</button>` : ''}
  </div>
</div>`;
}

function _bindDetail(root) {
  const getComment = () => (root.querySelector('#sra-comment') || { value: '' }).value.trim();
  root.querySelector('#sra-approve')?.addEventListener('click',   () => _update(root, 'approved',    getComment()));
  root.querySelector('#sra-negotiate')?.addEventListener('click', () => _update(root, 'negotiating', getComment()));
  root.querySelector('#sra-reject')?.addEventListener('click',    () => _update(root, 'rejected',    getComment()));
}

function _update(root, newStatus, comment) {
  const all = _load();
  const idx = all.findIndex(r => r.id === _sel);
  if (idx < 0) { showToast('데모 데이터는 수정할 수 없습니다.', 'error'); _sel = null; _draw(root); return; }
  all[idx].status       = newStatus;
  all[idx].adminComment = comment;
  all[idx].processedAt  = new Date().toISOString();
  _save(all);
  showToast(`"${STATUS_META[newStatus]?.label}" 처리 완료`);
      addNotification({ type: "success", title: "연봉 인상 관리", body: `"${STATUS_META[newStatus]?.label}" 처리 완료` });
  _tab = newStatus;
  _sel = null;
  _draw(root);
}
