/**
 * workhours-report.js — 관리자 근무시간 리포트 (#/admin/workhours)
 */

import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';
import {
  calcWorkHours, classifyDayHours, weekSummary, WEEKLY_LIMIT,
} from '../../utils/workhours-engine.js';

const LEGACY_WH_USERIDS = new Set(['emp01','emp02','emp03','emp04','emp05','emp06','demo']);

function _getWeekData() {
  const s = localStorage.getItem('hr_workhours_report');
  if (!s) return [];
  try {
    const d = JSON.parse(s);
    const cleaned = d.filter(r => !LEGACY_WH_USERIDS.has(r.userId));
    if (cleaned.length < d.length) localStorage.setItem('hr_workhours_report', JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}

export function render(root) {
  const data = _getWeekData();
  if (!data.length) { root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:48px;margin-bottom:12px">⏱️</div><div style="font-size:14px;font-weight:600;margin-bottom:6px">근무 시간 데이터가 없습니다.</div><div style="font-size:12px">데이터가 축적되면 자동으로 표시됩니다.</div></div>`; return; }

  root.innerHTML = `
<div class="page" id="wh-report-page">
  <header class="top-bar">
    <button class="btn-icon back-btn" aria-label="뒤로">&#8592;</button>
    <h1 class="page-title">근무시간 리포트</h1>
    <button class="btn-export" id="export-csv">CSV</button>
  </header>

  <div class="page-content">

    <!-- 요약 카드 -->
    <div class="wh-summary-grid">
      <div class="wh-summary-card over52">
        <span class="wsc-val">${data.filter(d => d.weekly > 52).length}</span>
        <span class="wsc-lbl">52h 초과</span>
      </div>
      <div class="wh-summary-card warning">
        <span class="wsc-val">${data.filter(d => d.weekly > 48 && d.weekly <= 52).length}</span>
        <span class="wsc-lbl">48~52h 경계</span>
      </div>
      <div class="wh-summary-card normal">
        <span class="wsc-val">${data.filter(d => d.weekly <= 48).length}</span>
        <span class="wsc-lbl">정상 범위</span>
      </div>
    </div>

    <!-- 개인별 테이블 -->
    <div class="wh-table-wrap">
      <div class="wh-table-header">이번 주 근무시간 현황</div>
      ${data.map(d => _renderRow(d)).join('')}
    </div>

    <!-- 52h 초과 경보 -->
    ${data.some(d => d.weekly > 52) ? `
    <div class="over52-alert">
      <div class="oa-title">⚠️ 주 52시간 초과 경보</div>
      <div class="oa-body">
        ${data.filter(d => d.weekly > 52).map(d =>
          `<div class="oa-row"><strong>${d.name}</strong> ${d.weekly}h (초과 ${(d.weekly - 52).toFixed(1)}h)</div>`
        ).join('')}
      </div>
      <button class="btn-notify" id="notify-over52">📨 대상자에게 알림 발송</button>
    </div>` : ''}

  </div>
</div>
${_styles()}`;

  _bindEvents(root, data);
}

function _renderRow(d) {
  const pct    = Math.min(100, Math.round((d.weekly / WEEKLY_LIMIT) * 100));
  const isOver = d.weekly > WEEKLY_LIMIT;
  const isWarn = !isOver && d.weekly > 48;
  const barColor = isOver ? '#EF4444' : isWarn ? '#F59E0B' : '#10B981';

  return `
<div class="wh-row">
  <div class="wh-row-top">
    <div class="wh-name">${d.name} <span class="wh-dept">${d.dept}</span></div>
    <div class="wh-total ${isOver ? 'red' : isWarn ? 'orange' : ''}">${d.weekly}h</div>
  </div>
  <div class="wh-bar-wrap">
    <div class="wh-bar" style="width:${pct}%;background:${barColor}"></div>
  </div>
  <div class="wh-detail-row">
    <span>연장 ${d.overtime}h</span>
    <span>야간 ${d.night}h</span>
    <span>휴일 ${d.holiday}h</span>
    <span class="wh-limit">/ ${WEEKLY_LIMIT}h</span>
  </div>
</div>`;
}

function _bindEvents(root, data) {
  root.querySelector('.back-btn').addEventListener('click', () => window.navBack());

  root.querySelector('#export-csv')?.addEventListener('click', () => {
    const rows = [
      ['이름', '부서', '주간근무(h)', '연장(h)', '야간(h)', '휴일(h)', '52h초과여부'],
      ...data.map(d => [d.name, d.dept, d.weekly, d.overtime, d.night, d.holiday, d.weekly > 52 ? '초과' : '정상']),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `근무시간리포트_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV 파일이 다운로드되었습니다.', 'success')
      addNotification({ type: 'success', title: 'workhours report', body: 'CSV 파일이 다운로드되었습니다.' });
  });

  root.querySelector('#notify-over52')?.addEventListener('click', () => {
    showToast('52시간 초과 대상자에게 알림이 발송되었습니다. 📨', 'success')
      addNotification({ type: 'success', title: 'workhours report', body: '52시간 초과 대상자에게 알림이 발송되었습니다. 📨' });
  });
}

function _styles() {
  return `<style>
#wh-report-page .top-bar { display:flex; align-items:center; padding:12px 16px; gap:10px; background:var(--bg); border-bottom:1px solid var(--border); flex-shrink:0; }
#wh-report-page .page-title { flex:1; font-size:18px; font-weight:700; margin:0; }
.btn-export { background:#4F46E5; color:#fff; border:none; border-radius:8px; padding:6px 14px; font-size:13px; font-weight:600; cursor:pointer; }

.wh-summary-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; padding:16px; }
.wh-summary-card { background:var(--card-bg); border-radius:12px; padding:14px; text-align:center; border:1px solid var(--border); }
.wh-summary-card.over52 { border-color:#EF4444; background:#FEF2F2; }
.wh-summary-card.warning { border-color:#F59E0B; background:#FFFBEB; }
.wh-summary-card.normal  { border-color:#10B981; background:#F0FDF4; }
.wsc-val  { display:block; font-size:28px; font-weight:800; }
.wsc-lbl  { font-size:11px; color:var(--text-secondary); }
.over52 .wsc-val  { color:#EF4444; }
.warning .wsc-val { color:#F59E0B; }
.normal  .wsc-val { color:#10B981; }

.wh-table-wrap { margin:0 16px 16px; }
.wh-table-header { font-size:14px; font-weight:700; margin-bottom:10px; }
.wh-row { background:var(--card-bg); border:1px solid var(--border); border-radius:12px; padding:12px 14px; margin-bottom:8px; }
.wh-row-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
.wh-name { font-size:14px; font-weight:600; }
.wh-dept { font-size:11px; color:var(--text-secondary); font-weight:400; margin-left:6px; }
.wh-total { font-size:16px; font-weight:800; }
.wh-total.red    { color:#EF4444; }
.wh-total.orange { color:#F59E0B; }
.wh-bar-wrap { height:6px; background:var(--border); border-radius:3px; overflow:hidden; margin-bottom:8px; }
.wh-bar { height:100%; border-radius:3px; transition:width .4s; }
.wh-detail-row { display:flex; gap:14px; font-size:12px; color:var(--text-secondary); }
.wh-limit { margin-left:auto; color:var(--text-secondary); }

.over52-alert { margin:0 16px 16px; background:#FEF2F2; border:1.5px solid #EF4444; border-radius:12px; padding:16px; }
.oa-title { font-size:14px; font-weight:700; color:#DC2626; margin-bottom:10px; }
.oa-body  { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
.oa-row   { font-size:13px; }
.btn-notify { width:100%; background:#EF4444; color:#fff; border:none; border-radius:10px; padding:10px; font-size:14px; font-weight:600; cursor:pointer; }
</style>`;
}

export function unmount() {}
export function mount(root) { return render(root); }
