/**
 * wage-ledger.js — 임금대장 관리 (D5)
 * 직원별 급여 이력 조회 및 수정
 */

import { showToast } from '../../components/toast.js';
import { fmtKRW } from '../../utils/payslip-engine.js';
import { addNotification } from '../../components/notification-hub.js';

const LS_WAGE = 'hr_wage_ledger';

const LEGACY_USER_IDS = new Set(['EMP001','EMP002','EMP003','EMP004','EMP005','demo']);

function _getLedger() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_WAGE) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_USER_IDS.has(r.userId));
    if (cleaned.length !== list.length) _saveLedger(cleaned);
    return cleaned;
  } catch { return []; }
}

function _saveLedger(list) {
  localStorage.setItem(LS_WAGE, JSON.stringify(list));
}

let _selected = null;

export function render(root) {
  _renderPage(root);
}

function _renderPage(root) {

  const ledger    = _getLedger();
  const totalBase = ledger.reduce((s, e) => s + e.baseSalary, 0);

  
  if (!ledger.length) { root.innerHTML = `<div style="text-align:center;padding:48px 20px;color:#94A3B8"><div style="font-size:40px;margin-bottom:10px">💳</div><div style="font-size:14px;font-weight:600;margin-bottom:4px">임금 대장이 없습니다.</div></div>`; return; }
root.innerHTML = `
<div id="wage-ledger-wrap">

  <!-- 요약 -->
  <div style="background:#EEF2FF;border-radius:12px;padding:14px 16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:12px;color:#4338CA">월 기본급 합계</div>
      <div style="font-size:22px;font-weight:800;color:#4F46E5">${fmtKRW(totalBase)}</div>
    </div>
    <div>
      <div style="font-size:12px;color:#4338CA">직원 수</div>
      <div style="font-size:22px;font-weight:800;color:#4F46E5">${ledger.length}명</div>
    </div>
    <button id="export-wage-csv" style="${_btnStyle('#4F46E5')}">CSV</button>
  </div>

  <!-- 직원 목록 -->
  <div id="wage-list">
    ${ledger.map(e => _renderRow(e)).join('')}
  </div>

  <!-- 상세 패널 -->
  <div id="wage-detail">${_selected ? _renderDetail(_getLedger().find(e => e.userId === _selected)) : ''}</div>

</div>`;

  _bindEvents(root);
}

function _renderRow(e) {
  const isSelected = _selected === e.userId;
  return `
<div class="wage-row ${isSelected ? 'selected' : ''}" data-id="${e.userId}"
     style="background:var(--card-bg);border:${isSelected ? '2px solid #4F46E5' : '1px solid var(--border)'};border-radius:12px;padding:12px 14px;margin-bottom:8px;cursor:pointer">
  <div style="display:flex;align-items:center;justify-content:space-between">
    <div>
      <span style="font-size:14px;font-weight:700">${e.name}</span>
      <span style="font-size:12px;color:#64748B;margin-left:8px">${e.dept} · ${e.position}</span>
    </div>
    <div style="text-align:right">
      <div style="font-size:15px;font-weight:800;color:#4F46E5">${fmtKRW(e.baseSalary)}</div>
      <div style="font-size:11px;color:#94A3B8">기본급</div>
    </div>
  </div>
</div>`;
}

function _renderDetail(e) {
  if (!e) return '';
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-top:4px">
  <div style="font-size:14px;font-weight:700;margin-bottom:12px">${e.name} 급여 이력</div>
  ${e.history.length ? e.history.map(h => `
  <div style="display:flex;gap:10px;align-items:center;font-size:13px;padding:8px 0;border-bottom:1px dashed var(--border)">
    <span style="color:#64748B;min-width:80px">${h.date}</span>
    <span style="text-decoration:line-through;color:#94A3B8">${fmtKRW(h.prev)}</span>
    <span style="color:#64748B">→</span>
    <span style="font-weight:700;color:#059669">${fmtKRW(h.next)}</span>
    <span style="color:#94A3B8;margin-left:auto">${h.reason}</span>
  </div>`).join('') : '<div style="color:#94A3B8;font-size:13px;padding:8px 0">이력 없음</div>'}
  <button class="btn-salary-change" data-id="${e.userId}"
    style="${_btnStyle('#10B981')} margin-top:14px;width:100%">
    💰 급여 변경 등록
  </button>
</div>`;
}

function _bindEvents(root) {
  root.querySelector('#wage-list')?.addEventListener('click', e => {
    const row = e.target.closest('.wage-row');
    if (!row) return;
    _selected = _selected === row.dataset.id ? null : row.dataset.id;
    _renderPage(root);
  });

  root.addEventListener('click', e => {
    const changeBtn = e.target.closest('.btn-salary-change');
    if (!changeBtn) return;
    const id      = changeBtn.dataset.id;
    const ledger  = _getLedger();
    const emp     = ledger.find(e => e.userId === id);
    if (!emp) return;
    const newSal = prompt(`${emp.name}의 새 기본급을 입력하세요 (현재: ${emp.baseSalary.toLocaleString()}원):`);
    if (!newSal) return;
    const num = parseInt(newSal.replace(/,/g, ''), 10);
    if (isNaN(num) || num < 0) { showToast('올바른 금액을 입력해 주세요.', 'error'); return; }
    const reason = prompt('변경 사유:') || '급여 조정';
    emp.history.unshift({ date: new Date().toISOString().slice(0, 10), prev: emp.baseSalary, next: num, reason });
    emp.baseSalary = num;
    _saveLedger(ledger);
    showToast(`${emp.name}의 급여가 변경되었습니다. ✅`, 'success')
      addNotification({ type: 'success', title: 'Wage Ledger (관리자)', body: '의 급여가 변경되었습니다. ✅' });
    _renderPage(root);
  });

  root.querySelector('#export-wage-csv')?.addEventListener('click', () => {
    const ledger = _getLedger();
    const rows   = [
      ['이름', '부서', '직위', '기본급'],
      ...ledger.map(e => [e.name, e.dept, e.position, e.baseSalary]),
    ];
    const csv  = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = '임금대장.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast('임금대장 CSV 다운로드 완료', 'success')
      addNotification({ type: 'success', title: 'Wage Ledger (관리자)', body: '임금대장 CSV 다운로드 완료' });
  });
}

function _btnStyle(bg) {
  return `background:${bg};color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;`;
}

export function unmount() {
  _selected = null;
}
export function mount(root) { return render(root); }
