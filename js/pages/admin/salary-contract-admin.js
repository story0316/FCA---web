/**
 * salary-contract-admin.js — 연봉 계약 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';

const LS = 'hr_salary_contracts';

const LEGACY_IDS = new Set(['SC001','SC002','SC003','SC004']);

let _employees = [];

function _getAll() {
  try {
    const d = JSON.parse(localStorage.getItem(LS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_IDS.has(r.id));
    if (cleaned.length !== list.length) _saveAll(cleaned);
    return cleaned;
  } catch { return []; }
}
function _saveAll(l) { localStorage.setItem(LS, JSON.stringify(l)); }
function _fmtKRW(n) { return (n/10000).toFixed(0)+'만원'; }

let _tab  = 'pending';
let _root = null;

export function render(root) { _root=root; _tab='pending'; _draw(); }
export function unmount() { _root=null;
  _tab = 'pending';
}

function _draw() {
  const all     = _getAll();
  const pending = all.filter(c=>c.status==='pending_sign').length;

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['pending',`서명 대기${pending?` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending}</span>`:''}`],['all','전체'],['issue','계약서 발행']].map(([k,l])=>`
    <button class="sca-tab" data-tab="${k}" style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;white-space:nowrap;border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='issue' ? _renderIssue() : _renderList(all)}
  </div>
</div>`;

  _root.querySelectorAll('.sca-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderList(all) {
  const filtered = _tab==='pending' ? all.filter(c=>c.status==='pending_sign') : [...all].sort((a,b)=>b.year-a.year||a.empName.localeCompare(b.empName));
  const pend=all.filter(c=>c.status==='pending_sign').length, signed=all.filter(c=>c.status==='signed').length;

  const kpi = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
  ${[['서명 대기',pend+'명','#F59E0B'],['서명 완료',signed+'명','#10B981']].map(([l,v,co])=>'<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:'+co+'">'+v+'</div><div style="font-size:10px;color:#94A3B8">'+l+'</div></div>').join('')}
</div>`;

  if (!filtered.length) return kpi + '<div style="text-align:center;padding:48px 20px;color:#94A3B8"><div style="font-size:40px;margin-bottom:10px">📝</div><div style="font-size:14px;font-weight:600;margin-bottom:4px">계약서가 없습니다</div><div style="font-size:12px">계약서 발행 탭에서 계약서를 등록해 주세요.</div></div>';

  return kpi + filtered.map(c => {
    const borderColor = c.status==='pending_sign' ? '#FCD34D' : 'var(--border)';
    const badgeBg     = c.status==='pending_sign' ? '#FEF3C7' : '#ECFDF5';
    const badgeColor  = c.status==='pending_sign' ? '#92400E' : '#10B981';
    const badgeLabel  = c.status==='pending_sign' ? '서명 대기' : '서명 완료';
    return `<div style="background:var(--card-bg);border:1px solid ${borderColor};border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;margin-bottom:8px">
    <div><div style="font-size:13px;font-weight:700">${c.empName} · ${c.year}년</div><div style="font-size:11px;color:#94A3B8">${c.dept} · 발행 ${c.issuedDate}</div></div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;background:${badgeBg};color:${badgeColor}">${badgeLabel}</span>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;background:var(--bg);border-radius:8px;padding:8px;text-align:center;font-size:11px">
    <div><div style="font-weight:700;color:#4F46E5">${_fmtKRW(c.baseSalary)}</div><div style="color:#94A3B8">기본급</div></div>
    <div><div style="font-weight:700;color:#F59E0B">${_fmtKRW(c.bonus)}</div><div style="color:#94A3B8">성과급</div></div>
    <div><div style="font-weight:700;color:#10B981">${_fmtKRW(c.totalComp)}</div><div style="color:#94A3B8">총연봉</div></div>
  </div>
  ${c.signedDate ? '<div style="font-size:11px;color:#10B981;margin-top:6px">✓ ' + c.signedDate + ' 서명 완료</div>' : ''}
</div>`;
  }).join('');
}

function _renderIssue() {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:14px">연봉 계약서 발행</div>
  <div style="display:flex;flex-direction:column;gap:10px">
    <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">직원 *</div>
      <select id="sca-emp" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px">
        <option value="">선택</option>
        ${_employees.map(e=>`<option value="${e.id}" data-name="${e.name}" data-dept="${e.dept}">${e.name} (${e.dept})</option>`).join('')}
      </select></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
      <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">연도</div>
        <input id="sca-year" type="number" value="2026" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
      <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">기본급</div>
        <input id="sca-base" type="number" placeholder="원" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
      <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">성과급</div>
        <input id="sca-bonus" type="number" placeholder="원" value="0" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
    </div>
    <button id="sca-submit" style="padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">계약서 발행</button>
  </div>
</div>`;
}

function _bindEvents() {
  _root.querySelector('#sca-submit')?.addEventListener('click',()=>{
    const empSel = _root.querySelector('#sca-emp');
    const empId  = empSel?.value;
    const empOpt = empSel?.options[empSel.selectedIndex];
    const year   = parseInt(_root.querySelector('#sca-year')?.value);
    const base   = parseInt(_root.querySelector('#sca-base')?.value);
    const bonus  = parseInt(_root.querySelector('#sca-bonus')?.value)||0;
    if (!empId||!year||!base) { showToast('직원, 연도, 기본급을 입력해 주세요.','error'); return; }
    const all = _getAll();
    if (all.find(c=>c.empId===empId&&c.year===year)) { showToast('이미 해당 연도 계약서가 존재합니다.','error'); return; }
    all.push({ id:'SC'+Date.now(), empId, empName:empOpt?.dataset.name||empId, dept:empOpt?.dataset.dept||'', year, baseSalary:base, bonus, totalComp:base+bonus, status:'pending_sign', issuedDate:new Date().toISOString().slice(0,10), signedDate:null });
    _saveAll(all); showToast('계약서가 발행됐습니다.','success')
      addNotification({ type: 'success', title: 'Salary Contract (관리자)', body: '계약서가 발행됐습니다.' }); _tab='pending'; _draw();
  });
}
export async function mount(root) {
  _employees = await loadDisplayEmployees();
  return render(root);
}
