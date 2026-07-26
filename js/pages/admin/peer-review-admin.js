/**
 * peer-review-admin.js — 동료 평가 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';

const LS_REVIEWS = 'hr_peer_reviews';
const LS_CYCLES  = 'hr_peer_cycles';

const COMPETENCIES = [
  { key:'collaboration', label:'협업·팀워크' },
  { key:'communication', label:'커뮤니케이션' },
  { key:'reliability',   label:'신뢰·책임감' },
  { key:'initiative',    label:'주도성' },
  { key:'growth',        label:'성장 마인드' },
];

const DEFAULT_CYCLE = { id:'CYC001', name:'2026년 상반기 동료 평가', deadline:'2026-06-30', active:true, createdAt:'2026-06-01' };

function _getCycle() {
  try { return JSON.parse(localStorage.getItem(LS_CYCLES)||'null') || DEFAULT_CYCLE; }
  catch { return DEFAULT_CYCLE; }
}
function _getReviews() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_REVIEWS) || '[]');
    return Array.isArray(d) ? d : [];
  } catch { return []; }
}
function _saveCycle(c) { localStorage.setItem(LS_CYCLES, JSON.stringify(c)); }

let _tab       = 'cycle';
let _root      = null;
let _employees = [];

export async function mount(root) {
  _root = root;
  _tab  = 'cycle';
  _employees = await loadDisplayEmployees().catch(() => []);
  root.onclick = e => _handleClick(e);
  _draw();
}

export function unmount() {
  if (_root) _root.onclick = null;
  _root      = null;
  _tab       = 'cycle';
  _employees = [];
}

export function render(root) { mount(root); }

function _draw() {
  const cycle     = _getCycle();
  const reviews   = _getReviews();
  const cycleRevs = reviews.filter(r => r.cycleId === cycle.id);

  const submitters = new Set(cycleRevs.map(r => r.reviewerId));
  const totalEmp   = _employees.length;
  const submitted  = submitters.size;
  const rate       = totalEmp ? Math.round(submitted / totalEmp * 100) : 0;

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['cycle','사이클 관리'],['status','참여 현황'],['result','결과 분석']].map(([k,l])=>`
    <button class="pra-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='cycle'  ? _renderCycle(cycle, cycleRevs, submitted, rate, totalEmp)
    : _tab==='status' ? _renderStatus(cycle, reviews)
    :                   _renderResult(cycle, cycleRevs)}
  </div>
</div>`;
}

function _renderCycle(cycle, revs, submitted, rate, totalEmp) {
  if (!totalEmp) return `
<div style="text-align:center;padding:48px 20px;color:#94A3B8">
  <div style="font-size:40px;margin-bottom:10px">👥</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:4px">직원 데이터가 없습니다.</div>
  <div style="font-size:12px">직원 등록 후 동료 평가를 시작하세요.</div>
</div>`;

  return `
<!-- KPI -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
  ${[
    ['총 대상', `${totalEmp}명`, '#4F46E5'],
    ['제출 완료', `${submitted}명`, '#10B981'],
    ['제출률', `${rate}%`, rate>=80?'#10B981':'#F59E0B'],
  ].map(([l,v,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:18px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8;margin-top:1px">${l}</div>
  </div>`).join('')}
</div>

<!-- 현재 사이클 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
    <div>
      <div style="font-size:13px;font-weight:700">${cycle.name}</div>
      <div style="font-size:11px;color:#94A3B8;margin-top:2px">마감: ${cycle.deadline}</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;
                 background:${cycle.active?'#D1FAE5':'#F1F5F9'};color:${cycle.active?'#10B981':'#94A3B8'}">
      ${cycle.active?'진행중':'종료'}
    </span>
  </div>
  <div style="background:var(--bg);border-radius:8px;height:8px;overflow:hidden;margin-bottom:8px">
    <div style="height:100%;width:${rate}%;background:#10B981;transition:width .3s"></div>
  </div>
  <div style="font-size:11px;color:#64748B">총 제출 ${revs.length}건 · ${submitted}/${totalEmp}명 참여</div>
</div>

<!-- 마감일 변경 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:10px">마감일 변경</div>
  <div style="display:flex;gap:8px">
    <input id="pra-deadline" type="date" value="${cycle.deadline}"
      style="flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
             background:var(--bg);color:var(--text);font-size:12px">
    <button id="pra-save-deadline"
      style="padding:8px 14px;background:#4F46E5;color:#fff;border:none;border-radius:8px;
             font-size:12px;font-weight:700;cursor:pointer">저장</button>
  </div>
</div>`;
}

function _renderStatus(cycle, reviews) {
  const cycleRevs = reviews.filter(r => r.cycleId === cycle.id);

  if (!_employees.length) return `
<div style="text-align:center;padding:48px 20px;color:#94A3B8">
  <div style="font-size:40px;margin-bottom:10px">👥</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:4px">직원 데이터가 없습니다.</div>
  <div style="font-size:12px">직원 등록 후 참여 현황을 확인할 수 있습니다.</div>
</div>`;

  const total = _employees.length;
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700">
    직원별 제출 현황
  </div>
  ${_employees.map(emp => {
    const written   = cycleRevs.filter(r => r.reviewerId === emp.id).length;
    const received  = cycleRevs.filter(r => r.revieweeId === emp.id).length;
    const submitted = written >= total - 1;
    return `
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
    <div style="width:32px;height:32px;border-radius:50%;background:#EEF2FF;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#4F46E5;flex-shrink:0">${emp.name[0]}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:12px;font-weight:600">${emp.name}</div>
      <div style="font-size:10px;color:#94A3B8">${emp.dept || emp.department || ''}</div>
    </div>
    <div style="text-align:right;flex-shrink:0">
      <div style="font-size:11px;font-weight:700;color:${submitted?'#10B981':'#F59E0B'}">
        ${submitted?'완료':'미완료'}
      </div>
      <div style="font-size:10px;color:#94A3B8">작성 ${written} · 받음 ${received}</div>
    </div>
  </div>`; }).join('')}
</div>`;
}

function _renderResult(cycle, cycleRevs) {
  if (!cycleRevs.length) return `
<div style="text-align:center;padding:48px;color:#94A3B8">
  <div style="font-size:32px;margin-bottom:8px">📊</div>
  <div style="font-size:13px">아직 제출된 평가가 없습니다.</div>
</div>`;

  // avg per competency
  const avgs = COMPETENCIES.map(c=>{
    const vals = cycleRevs.map(r=>r.scores?.[c.key]).filter(v=>v!=null);
    const avg  = vals.length ? vals.reduce((s,v)=>s+v,0)/vals.length : 0;
    return { ...c, avg };
  });

  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
  <div style="font-size:13px;font-weight:700;margin-bottom:12px">역량별 평균 점수</div>
  ${avgs.map(c=>`
  <div style="margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
      <span style="font-weight:600">${c.label}</span>
      <span style="font-weight:700;color:#4F46E5">${c.avg.toFixed(1)}</span>
    </div>
    <div style="background:var(--bg);border-radius:6px;height:6px">
      <div style="height:100%;border-radius:6px;background:#4F46E5;width:${c.avg/5*100}%"></div>
    </div>
  </div>`).join('')}
</div>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700">개인별 평균</div>
  ${_employees.length ? _employees.map(emp => {
    const received = cycleRevs.filter(r => r.revieweeId === emp.id);
    if (!received.length) return `
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:12px;font-weight:600">${emp.name}</span>
    <span style="font-size:11px;color:#94A3B8">데이터 없음</span>
  </div>`;
    const allScores = received.flatMap(r => Object.values(r.scores || {}));
    const avg = allScores.reduce((s, v) => s + v, 0) / allScores.length;
    return `
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:12px;font-weight:600">${emp.name}</div>
      <div style="font-size:10px;color:#94A3B8">${emp.dept || emp.department || ''} · ${received.length}건 평가</div>
    </div>
    <span style="font-size:14px;font-weight:800;color:${avg>=4?'#10B981':avg>=3?'#3B82F6':'#F59E0B'}">${avg.toFixed(1)}</span>
  </div>`;
  }).join('') : '<div style="padding:20px;text-align:center;font-size:12px;color:#94A3B8">직원 데이터가 없습니다.</div>'}
</div>`;
}

function _handleClick(e) {
  const tab = e.target.closest('.pra-tab');
  if (tab) { _tab = tab.dataset.tab; _draw(); return; }

  if (e.target.closest('#pra-save-deadline')) {
    const d = _root.querySelector('#pra-deadline')?.value;
    if (!d) return;
    const cycle = _getCycle();
    cycle.deadline = d;
    _saveCycle(cycle);
    showToast('마감일이 변경됐습니다.', 'success');
    addNotification({ type: 'success', title: 'Peer Review (관리자)', body: '마감일이 변경됐습니다.' });
    _draw();
  }
}
