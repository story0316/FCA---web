/**
 * welfare-admin.js — 복지 포인트 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';

const LS_KEY       = 'hr_welfare_admin';
const ANNUAL_LIMIT = 600000;

const CATEGORIES = [
  { key:'culture', label:'문화·여가',   icon:'🎭', color:'#7C3AED' },
  { key:'health',  label:'건강·스포츠', icon:'💪', color:'#10B981' },
  { key:'edu',     label:'자기계발',    icon:'📚', color:'#3B82F6' },
  { key:'family',  label:'가족 친화',   icon:'👨‍👩‍👧', color:'#F59E0B' },
  { key:'meal',    label:'식사·카페',   icon:'🍽️', color:'#EF4444' },
  { key:'other',   label:'기타',        icon:'🎁', color:'#94A3B8' },
];

function _getData() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (saved && Array.isArray(saved.records)) {
      return {
        records: saved.records,
        allocations: saved.allocations || {},
        limit: saved.limit || ANNUAL_LIMIT,
      };
    }
  } catch {}
  return { records:[], allocations:{}, limit: ANNUAL_LIMIT };
}
function _save(d) { localStorage.setItem(LS_KEY, JSON.stringify(d)); }

let _tab       = 'overview';
let _root      = null;
let _employees = [];

export async function mount(root) {
  _root = root; _tab = 'overview';
  root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">⏳</div><div style="font-size:13px">데이터 로딩 중…</div></div>`;
  _employees = await loadDisplayEmployees();
  _draw();
}
export function render(root) { _root = root; _tab = 'overview'; _draw(); }
export function unmount()    { _root = null; _tab = 'overview'; _employees = []; }

// ── Aggregation helpers ─────────────────────────────────────────
function _buildEmpMap(data) {
  const { records, allocations, limit } = data;
  const map = {};
  // 실 직원 기준으로 맵 구성; localStorage 기록에만 있는 이전 직원도 포함
  _employees.forEach(e => {
    map[e.id] = {
      id: e.id, name: e.name,
      dept: e.dept || e.department || '미배정',
      pos: e.role || '팀원',
      used: 0, limit: allocations[e.id] || limit,
    };
  });
  // 기존 기록에 있는 직원이 목록에 없어도 표시 (퇴사자 등)
  records.forEach(r => {
    if (!map[r.empId]) {
      map[r.empId] = { id: r.empId, name: r.empName, dept: r.dept || '미배정', pos: r.pos || '팀원', used: 0, limit: allocations[r.empId] || limit };
    }
    if (r.status === 'approved') map[r.empId].used += r.amount;
  });
  return Object.values(map);
}

// ── Main render ─────────────────────────────────────────────────
function _draw() {
  const data = _getData();

  if (!_employees.length && !data.records.length) {
    _root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8">
      <div style="font-size:48px;margin-bottom:12px">🎁</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:6px;color:var(--text)">복지 포인트 데이터가 없습니다</div>
      <div style="font-size:12px;margin-bottom:20px">직원을 등록한 뒤 실제 지급·사용 내역을 연결해 주세요.</div>
      <button id="wa-empty-cta" style="padding:9px 16px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">직원 관리로 이동</button>
    </div>`;
    _root.querySelector('#wa-empty-cta')?.addEventListener('click', () => {
      window.location.hash = '#/admin';
    });
    return;
  }

  const emps        = _buildEmpMap(data);
  const totalBudget = emps.reduce((s,e)=>s+e.limit, 0);
  const totalUsed   = emps.reduce((s,e)=>s+e.used, 0);
  const avgRate     = totalBudget ? Math.round((totalUsed/totalBudget)*100) : 0;
  const fullUsers   = emps.filter(e=>e.used >= e.limit * 0.9).length;

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['overview','개요'],['employees','임직원별'],['settings','포인트 설정']].map(([k,l])=>`
    <button class="wa-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='overview'  ? _renderOverview(data, emps, totalBudget, totalUsed, avgRate, fullUsers)
    : _tab==='employees' ? _renderEmployees(emps)
    :                      _renderSettings(data, emps)}
  </div>
</div>`;

  _root.querySelectorAll('.wa-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindSettings(data, emps);
}

// ── Tab: 개요 ───────────────────────────────────────────────────
function _renderOverview(data, emps, totalBudget, totalUsed, avgRate, fullUsers) {
  const remaining = totalBudget - totalUsed;

  const byCat = {};
  CATEGORIES.forEach(c=>{ byCat[c.key]=0; });
  data.records.forEach(r=>{ if(r.status==='approved') byCat[r.category]=(byCat[r.category]||0)+r.amount; });

  const byDept = {};
  emps.forEach(e=>{ byDept[e.dept]=(byDept[e.dept]||0)+e.used; });
  const maxDept = Math.max(...Object.values(byDept), 1);

  const byMonth = {};
  data.records.forEach(r=>{
    if (r.status!=='approved') return;
    const m = r.date.slice(0,7);
    byMonth[m]=(byMonth[m]||0)+r.amount;
  });
  const months = Object.keys(byMonth).sort().slice(-6);
  const maxMo  = Math.max(...months.map(m=>byMonth[m]),1);

  return `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
  ${[
    ['총 예산', `${(totalBudget/10000).toFixed(0)}만원`, '📦', '#4F46E5'],
    ['총 사용액', `${(totalUsed/10000).toFixed(0)}만원`, '💸', '#10B981'],
    ['평균 사용률', `${avgRate}%`, '📊', '#F59E0B'],
    ['90% 이상 소진', `${fullUsers}명`, '⚠️', '#EF4444'],
  ].map(([l,v,ic,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px">
    <div style="font-size:18px;margin-bottom:4px">${ic}</div>
    <div style="font-size:18px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8;margin-top:2px">${l}</div>
  </div>`).join('')}
</div>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <div style="font-size:13px;font-weight:700">전사 복지 예산 현황</div>
    <div style="font-size:12px;color:#4F46E5;font-weight:700">잔여 ${(remaining/10000).toFixed(0)}만원</div>
  </div>
  <div style="background:#E2E8F0;border-radius:99px;height:10px;margin-bottom:4px">
    <div style="background:linear-gradient(90deg,#4F46E5,#7C3AED);height:10px;border-radius:99px;width:${avgRate}%"></div>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:10px;color:#94A3B8">
    <span>사용 ${totalUsed.toLocaleString()}원</span>
    <span>한도 ${totalBudget.toLocaleString()}원</span>
  </div>
</div>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
  <div style="font-size:13px;font-weight:700;margin-bottom:10px">카테고리별 사용 현황</div>
  ${CATEGORIES.map(c=>{
    const amt = byCat[c.key]||0;
    const pct = totalUsed ? Math.round((amt/totalUsed)*100) : 0;
    return `
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
    <span style="width:24px;text-align:center;font-size:15px">${c.icon}</span>
    <div style="flex:1;min-width:0">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px">
        <span style="color:var(--text);font-weight:600">${c.label}</span>
        <span style="color:${c.color};font-weight:700">${amt.toLocaleString()}원</span>
      </div>
      <div style="background:#E2E8F0;border-radius:99px;height:5px">
        <div style="background:${c.color};height:5px;border-radius:99px;width:${pct}%"></div>
      </div>
    </div>
    <span style="font-size:10px;color:#94A3B8;width:28px;text-align:right">${pct}%</span>
  </div>`;}).join('')}
</div>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
  <div style="font-size:13px;font-weight:700;margin-bottom:10px">부서별 사용액</div>
  ${Object.entries(byDept).sort((a,b)=>b[1]-a[1]).map(([dept,amt])=>{
    const pct = Math.round((amt/maxDept)*100);
    return `
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
    <div style="width:52px;font-size:11px;font-weight:600;color:var(--text);text-align:right">${dept}</div>
    <div style="flex:1">
      <div style="background:#E2E8F0;border-radius:99px;height:7px">
        <div style="background:#4F46E5;height:7px;border-radius:99px;width:${pct}%"></div>
      </div>
    </div>
    <div style="font-size:11px;font-weight:700;color:#4F46E5;width:64px;text-align:right">${amt.toLocaleString()}원</div>
  </div>`;}).join('')}
</div>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:12px">월별 사용 추이</div>
  ${months.length ? `<div style="display:flex;align-items:flex-end;gap:6px;height:70px">
    ${months.map(m=>{
      const amt = byMonth[m]||0;
      const h   = Math.round((amt/maxMo)*60)+4;
      return `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
      <div style="font-size:9px;color:#64748B">${amt?(amt/10000).toFixed(0)+'만':''}</div>
      <div style="width:100%;background:#4F46E5;border-radius:4px 4px 0 0;height:${h}px"></div>
      <div style="font-size:8px;color:#94A3B8">${m.slice(5)}월</div>
    </div>`;}).join('')}
  </div>` : '<div style="text-align:center;color:#94A3B8;font-size:12px;padding:16px">사용 이력이 없습니다.</div>'}
</div>`;
}

// ── Tab: 임직원별 ────────────────────────────────────────────────
function _renderEmployees(emps) {
  const sorted = [...emps].sort((a,b)=>b.used-a.used);
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:12px">
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);
       display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:13px;font-weight:700">임직원 복지 포인트 현황 (${emps.length}명)</div>
  </div>
  ${sorted.map(e=>{
    const pct  = Math.min(100, Math.round((e.used/e.limit)*100));
    const rem  = Math.max(0, e.limit-e.used);
    const clr  = pct>=90?'#EF4444':pct>=70?'#F59E0B':'#10B981';
    return `
  <div style="padding:12px 14px;border-bottom:1px solid var(--border)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <div>
        <span style="font-size:13px;font-weight:700;color:var(--text)">${e.name}</span>
        <span style="font-size:10px;color:#94A3B8;margin-left:6px">${e.dept}</span>
      </div>
      <div style="text-align:right">
        <div style="font-size:12px;font-weight:700;color:${clr}">${pct}% 사용</div>
        <div style="font-size:10px;color:#94A3B8">잔여 ${rem.toLocaleString()}원</div>
      </div>
    </div>
    <div style="background:#E2E8F0;border-radius:99px;height:6px">
      <div style="background:${clr};height:6px;border-radius:99px;width:${pct}%"></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:3px;font-size:10px;color:#94A3B8">
      <span>사용 ${e.used.toLocaleString()}원</span>
      <span>한도 ${e.limit.toLocaleString()}원</span>
    </div>
  </div>`;}).join('')}
</div>

<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
  ${[
    ['미사용', emps.filter(e=>e.used===0).length, '#94A3B8'],
    ['50% 미만', emps.filter(e=>e.used>0&&e.used<e.limit*0.5).length, '#3B82F6'],
    ['50~89%', emps.filter(e=>e.used>=e.limit*0.5&&e.used<e.limit*0.9).length, '#F59E0B'],
  ].map(([l,c,col])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:20px;font-weight:800;color:${col}">${c}</div>
    <div style="font-size:10px;color:#94A3B8">${l}</div>
  </div>`).join('')}
</div>`;
}

// ── Tab: 설정 ───────────────────────────────────────────────────
function _renderSettings(data, emps) {
  const { limit, allocations } = data;
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:12px">⚙️ 전사 연간 복지 한도</div>
  <div style="display:flex;gap:8px;align-items:flex-end">
    <div style="flex:1">
      <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">연간 기본 한도 (원)</label>
      <input id="wa-limit-input" type="number" value="${limit}"
        style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
               font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
    <button id="wa-save-limit"
      style="padding:9px 16px;background:#4F46E5;color:#fff;border:none;border-radius:10px;
             font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap">저장</button>
  </div>
  <div style="font-size:11px;color:#94A3B8;margin-top:6px">현재: 인당 ${limit.toLocaleString()}원 / 전사 ${((limit * emps.length)/10000).toFixed(0)}만원</div>
</div>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:12px">🎁 개인 추가 포인트 지급</div>

  <div style="margin-bottom:10px">
    <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">임직원 선택</label>
    <select id="wa-bonus-emp"
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text)">
      <option value="">— 선택 —</option>
      ${emps.map(e=>`<option value="${e.id}">${e.name} (${e.dept})</option>`).join('')}
    </select>
  </div>

  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">추가 지급액 (원)</label>
    <input id="wa-bonus-amt" type="number" placeholder="예: 50000"
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>

  <button id="wa-add-bonus"
    style="width:100%;padding:12px;background:#10B981;color:#fff;border:none;border-radius:10px;
           font-size:13px;font-weight:700;cursor:pointer">추가 지급</button>
</div>

${Object.keys(allocations).length > 0 ? `
<div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;padding:12px">
  <div style="font-size:12px;font-weight:700;color:#C2410C;margin-bottom:8px">개별 조정 현황</div>
  ${Object.entries(allocations).map(([id, lim])=>{
    const emp = emps.find(e=>e.id===id);
    return `
  <div style="display:flex;justify-content:space-between;align-items:center;
       padding:6px 0;border-bottom:1px solid #FED7AA;font-size:11px">
    <span style="font-weight:600">${emp?.name||id}</span>
    <span style="color:#C2410C;font-weight:700">${lim.toLocaleString()}원</span>
  </div>`;}).join('')}
</div>` : `
<div style="background:#F8FAFC;border:1px solid var(--border);border-radius:12px;
     padding:20px;text-align:center">
  <div style="font-size:24px;margin-bottom:6px">✅</div>
  <div style="font-size:12px;color:#94A3B8">개별 조정된 임직원이 없습니다.<br>전사 기본 한도(${limit.toLocaleString()}원)가 적용됩니다.</div>
</div>`}`;
}

// ── Event binding ───────────────────────────────────────────────
function _bindSettings(data, emps) {
  if (_tab !== 'settings') return;

  _root.querySelector('#wa-save-limit')?.addEventListener('click', () => {
    const v = parseInt(_root.querySelector('#wa-limit-input').value)||0;
    if (v < 100000 || v > 3000000) { showToast('한도는 10만원~300만원 사이로 설정하세요.', 'error'); return; }
    const d = _getData(); d.limit = v; _save(d);
    showToast('연간 한도가 업데이트되었습니다.', 'success');
    addNotification({ type: 'success', title: 'Welfare (관리자)', body: '연간 한도가 업데이트되었습니다.' });
    _draw();
  });

  _root.querySelector('#wa-add-bonus')?.addEventListener('click', () => {
    const empId = _root.querySelector('#wa-bonus-emp').value;
    const bonus = parseInt(_root.querySelector('#wa-bonus-amt').value)||0;
    if (!empId) { showToast('임직원을 선택하세요.', 'error'); return; }
    if (bonus <= 0) { showToast('추가 지급 금액을 입력하세요.', 'error'); return; }
    const d = _getData();
    d.allocations[empId] = (d.allocations[empId] || d.limit) + bonus;
    const emp = emps.find(e=>e.id===empId);
    _save(d);
    showToast(`${emp?.name||empId}에게 ${bonus.toLocaleString()}원 추가 지급되었습니다.`, 'success');
    addNotification({ type: 'success', title: 'Welfare (관리자)', body: `${emp?.name||empId}에게 ${bonus.toLocaleString()}원 추가 지급되었습니다.` });
    _draw();
  });
}
