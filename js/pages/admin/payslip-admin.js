/**
 * payslip-admin.js — 관리자 임금명세서 생성·발급
 * admin_dashboard.js 탭으로 lazy-load됨
 */

import { showToast } from '../../components/toast.js'
import { addNotification } from '../../components/notification-hub.js';
import {
  getAllPayslips, buildPayslip, savePayslip,
  getSalaryRecord, fmtKRW,
} from '../../utils/payslip-engine.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';

let _filterYear  = new Date().getFullYear();
let _filterMonth = new Date().getMonth() + 1;

export function render(root) {
  _renderPage(root);
}

function _renderPage(root) {
  const slips = getAllPayslips();

  root.innerHTML = `
<div id="payslip-admin-wrap">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap">
    <select id="year-filter" style="${_selectStyle()}">
      ${[2026, 2025].map(y => `<option ${y===_filterYear?'selected':''}>${y}</option>`).join('')}
    </select>
    <select id="month-filter" style="${_selectStyle()}">
      ${Array.from({length:12},(_,i)=>i+1).map(m =>
        `<option value="${m}" ${m===_filterMonth?'selected':''}>${m}월</option>`
      ).join('')}
    </select>
    <button id="gen-all-btn" style="${_btnStyle('#4F46E5')}">📋 전직원 명세서 생성</button>
  </div>

  <div id="ps-admin-list">
    ${_renderList(slips, _filterYear, _filterMonth)}
  </div>
</div>`;

  _bindEvents(root, slips);
}

function _renderList(slips, year, month) {
  const filtered = slips.filter(s => s.year === year && s.month === month);

  if (!filtered.length) {
    return `<div style="text-align:center;padding:48px 20px;color:#94A3B8">
      <div style="font-size:40px;margin-bottom:10px">📄</div>
      <div style="font-size:13px;font-weight:600;margin-bottom:6px">${year}년 ${month}월 명세서가 없습니다</div>
      <div style="font-size:12px">"전직원 명세서 생성" 버튼을 눌러 생성하세요.</div>
    </div>`;
  }

  return filtered.map(s => `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
            padding:14px 16px;margin-bottom:10px;display:flex;align-items:center;gap:12px">
  <div style="flex:1">
    <div style="font-size:14px;font-weight:700">${s.userId === 'demo' ? '나 (데모)' : s.userId}</div>
    <div style="font-size:12px;color:#64748B;margin-top:2px">
      기본급 ${fmtKRW(s.baseSalary)} · 실수령 <strong style="color:#4F46E5">${fmtKRW(s.netPay)}</strong>
    </div>
    <div style="font-size:11px;color:#94A3B8;margin-top:2px">
      ${s.issuedAt ? `발급 ${new Date(s.issuedAt).toLocaleDateString('ko-KR')}` : '미발급'}
      ${s.confirmedByEmployee ? ' · 직원 확인 ✅' : ''}
    </div>
  </div>
  <div style="display:flex;gap:6px">
    ${!s.issuedAt ? `<button class="btn-issue" data-id="${s.id}" style="${_btnStyle('#059669','small')}">발급</button>` : ''}
    <button class="btn-detail" data-id="${s.id}" style="${_btnStyle('#64748B','small')}">상세</button>
  </div>
</div>`).join('');
}

function _bindEvents(root, allSlips) {
  root.querySelector('#year-filter').addEventListener('change', e => {
    _filterYear = +e.target.value;
    root.querySelector('#ps-admin-list').innerHTML = _renderList(getAllPayslips(), _filterYear, _filterMonth);
  });
  root.querySelector('#month-filter').addEventListener('change', e => {
    _filterMonth = +e.target.value;
    root.querySelector('#ps-admin-list').innerHTML = _renderList(getAllPayslips(), _filterYear, _filterMonth);
  });

  root.querySelector('#gen-all-btn').addEventListener('click', () => {
    const employees = ['demo', 'emp01', 'emp02', 'emp03'];
    let created = 0;
    for (const uid of employees) {
      const existing = getAllPayslips().find(
        s => s.userId === uid && s.year === _filterYear && s.month === _filterMonth
      );
      if (!existing) {
        const rec = getSalaryRecord(uid);
        const slip = buildPayslip(uid, _filterYear, _filterMonth, 176, 0, 0, 0, rec);
        savePayslip(slip);
        created++;
      }
    }
    showToast(created > 0 ? `${created}건 명세서가 생성되었습니다.` : '이미 생성된 명세서가 있습니다.', 'success');
    root.querySelector('#ps-admin-list').innerHTML = _renderList(getAllPayslips(), _filterYear, _filterMonth);
  });

  root.addEventListener('click', e => {
    const issueBtn = e.target.closest('.btn-issue');
    if (issueBtn) {
      const slip = getAllPayslips().find(s => s.id === issueBtn.dataset.id);
      if (slip) {
        slip.issuedAt = new Date().toISOString();
        savePayslip(slip);
        showToast('명세서가 발급되었습니다. ✅', 'success')
      addNotification({ type: 'success', title: 'payslip admin', body: '명세서가 발급되었습니다. ✅' });
        root.querySelector('#ps-admin-list').innerHTML = _renderList(getAllPayslips(), _filterYear, _filterMonth);
      }
    }
  });
}

function _selectStyle() {
  return 'border:1.5px solid var(--border);border-radius:8px;padding:7px 12px;font-size:13px;background:var(--card-bg);color:var(--text);cursor:pointer;';
}
function _btnStyle(bg, size = 'normal') {
  const p = size === 'small' ? '6px 12px' : '8px 16px';
  return `background:${bg};color:#fff;border:none;border-radius:8px;padding:${p};font-size:13px;font-weight:600;cursor:pointer;`;
}

export function unmount() {}
export async function mount(root) { return render(root); }
