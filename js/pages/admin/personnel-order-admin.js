/**
 * personnel-order-admin.js — 인사발령 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';

const LS = 'hr_personnel_orders';

const ORDER_TYPES = [
  { key:'promotion',  label:'승진',     icon:'⬆️' },
  { key:'transfer',   label:'전배',     icon:'🔄' },
  { key:'department', label:'부서 이동', icon:'🏢' },
  { key:'title',      label:'직책 변경', icon:'🏷️' },
  { key:'salary',     label:'연봉 조정', icon:'💰' },
  { key:'other',      label:'기타',     icon:'📋' },
];

const TYPE_META = {
  promotion:  { label:'승진',     icon:'⬆️', color:'#10B981' },
  transfer:   { label:'전배',     icon:'🔄', color:'#3B82F6' },
  department: { label:'부서 이동', icon:'🏢', color:'#8B5CF6' },
  title:      { label:'직책 변경', icon:'🏷️', color:'#F59E0B' },
  salary:     { label:'연봉 조정', icon:'💰', color:'#EC4899' },
  other:      { label:'기타',     icon:'📋', color:'#64748B' },
};

let _employees = [];

const LEGACY_IDS = new Set(['PO001','PO002','PO003','PO004','PO005']);

function _getOrders() {
  try {
    const d = JSON.parse(localStorage.getItem(LS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_IDS.has(r.id));
    if (cleaned.length !== list.length) _save(cleaned);
    return cleaned;
  } catch { return []; }
}
function _save(l) { localStorage.setItem(LS, JSON.stringify(l)); }

let _tab  = 'list';
let _root = null;

export function render(root) { _root=root; _tab='list'; _draw(); }
export function unmount() { _root=null;
  _tab = 'list';
}

function _draw() {
  const orders = _getOrders();

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['list','발령 목록'],['issue','발령 등록']].map(([k,l])=>`
    <button class="poa-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='list' ? _renderList(orders) : _renderIssue()}
  </div>
</div>`;

  _root.querySelectorAll('.poa-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderList(orders) {
  const sorted   = [...orders].sort((a,b)=>b.effectiveDate.localeCompare(a.effectiveDate));
  const thisYear = new Date().getFullYear();
  const thisYearOrders = orders.filter(o=>o.effectiveDate.startsWith(String(thisYear)));

  return `
<!-- KPI -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
  ${[
    ['총 발령', `${orders.length}건`, '#4F46E5'],
    [`${thisYear}년`, `${thisYearOrders.length}건`, '#10B981'],
  ].map(([l,v,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:20px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8">${l}</div>
  </div>`).join('')}
</div>

${!orders.length ? `<div style="text-align:center;padding:48px 20px;color:#94A3B8"><div style="font-size:40px;margin-bottom:10px">📋</div><div style="font-size:14px;font-weight:600;margin-bottom:4px">발령 내역이 없습니다</div><div style="font-size:12px">발령 등록 탭에서 인사 발령을 등록해 주세요.</div></div>` : `<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  ${sorted.map(o=>{
    const meta = TYPE_META[o.type]||TYPE_META.other;
    return `
  <div style="padding:12px 14px;border-bottom:1px solid var(--border)">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:16px">${meta.icon}</span>
        <div>
          <span style="font-size:12px;font-weight:700">${o.empName}</span>
          <span style="font-size:11px;color:${meta.color};margin-left:6px">${meta.label}</span>
        </div>
      </div>
      <span style="font-size:11px;color:#94A3B8">${o.effectiveDate}</span>
    </div>
    <div style="font-size:11px;color:#64748B">${o.dept} · ${o.fromValue} → ${o.toValue}</div>
    ${o.note?`<div style="font-size:10px;color:#94A3B8;margin-top:2px">${o.note}</div>`:''}
  </div>`; }).join('')}
</div>`}`;
}

function _renderIssue() {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:14px">인사발령 등록</div>

  <div style="display:flex;flex-direction:column;gap:10px">
    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">대상 직원 *</div>
      <select id="poa-emp"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
               background:var(--bg);color:var(--text);font-size:12px">
        <option value="">선택</option>
        ${_employees.map(e=>`<option value="${e.id}" data-name="${e.name}" data-dept="${e.dept}">${e.name} (${e.dept} · ${e.position||''})</option>`).join('')}
      </select>
    </div>

    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">발령 유형 *</div>
      <select id="poa-type"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
               background:var(--bg);color:var(--text);font-size:12px">
        ${ORDER_TYPES.map(t=>`<option value="${t.key}">${t.icon} ${t.label}</option>`).join('')}
      </select>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">변경 전 *</div>
        <input id="poa-from" type="text" placeholder="예: 사원, 개발1팀"
          style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
                 background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">변경 후 *</div>
        <input id="poa-to" type="text" placeholder="예: 대리, 개발2팀"
          style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
                 background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
      </div>
    </div>

    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">발령 일자 *</div>
      <input id="poa-date" type="date"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
               background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
    </div>

    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">비고</div>
      <input id="poa-note" type="text" placeholder="발령 사유 또는 참고 사항"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
               background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
    </div>

    <button id="poa-submit"
      style="padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;
             font-size:13px;font-weight:700;cursor:pointer">발령 등록</button>
  </div>
</div>`;
}

function _bindEvents() {
  _root.querySelector('#poa-submit')?.addEventListener('click',()=>{
    const empSel = _root.querySelector('#poa-emp');
    const empId  = empSel?.value;
    const empName= empSel?.options[empSel.selectedIndex]?.dataset.name;
    const dept   = empSel?.options[empSel.selectedIndex]?.dataset.dept;
    const type   = _root.querySelector('#poa-type')?.value;
    const from   = _root.querySelector('#poa-from')?.value.trim();
    const to     = _root.querySelector('#poa-to')?.value.trim();
    const date   = _root.querySelector('#poa-date')?.value;
    const note   = _root.querySelector('#poa-note')?.value.trim();

    if (!empId || !from || !to || !date) {
      showToast('대상 직원, 변경 전/후, 발령 일자를 입력해 주세요.', 'error'); return;
    }
    const orders = _getOrders();
    orders.push({
      id:            'PO'+Date.now(),
      empId,
      empName:       empName||empId,
      type,
      effectiveDate: date,
      fromValue:     from,
      toValue:       to,
      dept:          dept||'-',
      note,
      status:        'active',
      issuedAt:      new Date().toISOString().slice(0,10),
    });
    _save(orders);
    showToast(`${empName||empId} 인사발령이 등록됐습니다.`, 'success')
      addNotification({ type: 'success', title: 'Personnel Order (관리자)', body: '인사발령이 등록됐습니다.' });
    _tab='list'; _draw();
  });
}
export async function mount(root) {
  _employees = await loadDisplayEmployees();
  return render(root);
}
