/**
 * hr-report.js — HR 보고서 자동 생성 (Phase 136)
 * Supabase 실데이터 + localStorage 병합, 출력(PDF) 지원
 */

import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';
import { api } from '../../api.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';

const LS_LEAVE   = 'hr_leave_requests';
const LS_ONBOARD = 'hr_onboarding_tasks';
const LS_HARASS  = 'hr_harassment_reports';
const LS_LEGAL   = 'hr_legal_edu_records';

function _get(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

let _period      = 'monthly';
let _targetMonth = new Date().toISOString().slice(0, 7);
let _loading     = false;

export async function render(root) {
  _injectPrintStyle();
  await _renderPage(root);
}

export function unmount() {
  _period      = 'monthly';
  _targetMonth = new Date().toISOString().slice(0, 7);
  const el = document.getElementById('hr-report-print-style');
  if (el) el.remove();
}

async function _renderPage(root) {
  const now = new Date();
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }

  root.innerHTML = `
<div id="hr-report-wrap" style="padding:16px">

  <!-- 헤더 -->
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px" class="no-print">
    <div style="font-size:16px;font-weight:700">📈 HR 보고서</div>
    <div style="display:flex;gap:8px">
      <button id="print-btn"
        style="background:#10B981;color:#fff;border:none;border-radius:10px;
               padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer">🖨️ 출력/PDF</button>
      <button id="export-btn"
        style="background:#4F46E5;color:#fff;border:none;border-radius:10px;
               padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer">📥 CSV</button>
    </div>
  </div>

  <!-- 기간 선택 -->
  <div style="display:flex;gap:8px;margin-bottom:16px" class="no-print">
    <button class="period-btn ${_period==='monthly'?'active':''}" data-p="monthly"
      style="padding:7px 16px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;
             border:2px solid ${_period==='monthly'?'#4F46E5':'var(--border)'};
             background:${_period==='monthly'?'#EEF2FF':'var(--card-bg)'};
             color:${_period==='monthly'?'#4338CA':'var(--text)'}">월간</button>
    <button class="period-btn ${_period==='quarterly'?'active':''}" data-p="quarterly"
      style="padding:7px 16px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;
             border:2px solid ${_period==='quarterly'?'#4F46E5':'var(--border)'};
             background:${_period==='quarterly'?'#EEF2FF':'var(--card-bg)'};
             color:${_period==='quarterly'?'#4338CA':'var(--text)'}">분기</button>
    <select id="month-sel"
      style="margin-left:auto;padding:6px 10px;border:1.5px solid var(--border);
             border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
      ${months.map(m => `<option value="${m}" ${m===_targetMonth?'selected':''}>${m}</option>`).join('')}
    </select>
  </div>

  <!-- 보고서 본문 -->
  <div id="report-body">
    <div style="text-align:center;padding:40px;color:var(--text-muted)">
      <div style="font-size:24px;margin-bottom:8px">⏳</div>
      <div style="font-size:14px">데이터 불러오는 중...</div>
    </div>
  </div>

</div>`;

  root.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => { _period = btn.dataset.p; _renderPage(root); });
  });
  root.querySelector('#month-sel').addEventListener('change', e => {
    _targetMonth = e.target.value; _renderPage(root);
  });
  root.querySelector('#print-btn').addEventListener('click', () => _printReport());
  root.querySelector('#export-btn').addEventListener('click', () => _exportCSV());

  await _loadAndRender(root.querySelector('#report-body'));
}

async function _loadAndRender(container) {
  const [y, m] = _targetMonth.split('-').map(Number);
  const isQ = _period === 'quarterly';

  const startM = isQ ? (Math.ceil(m / 3) - 1) * 3 + 1 : m;
  const endM   = isQ ? Math.ceil(m / 3) * 3 : m;
  const startDate = `${y}-${String(startM).padStart(2,'0')}-01`;
  const endDate   = `${y}-${String(endM).padStart(2,'0')}-31`;

  const user = JSON.parse(localStorage.getItem('hr_user') || '{}');
  const orgId = user.org_id || 'ORG001';

  // Supabase + localStorage 병합
  const [remoteLeave, remoteCommute, remoteOkr, remotePerf, remoteHeadcount, displayEmployees] = await Promise.all([
    api.report.getLeaveStats(orgId, startDate, endDate),
    api.report.getCommuteStats(orgId, startDate, endDate),
    api.report.getOkrStats(orgId),
    api.report.getPerformanceStats(orgId),
    api.report.getHeadcount(orgId).catch(() => null),
    loadDisplayEmployees(orgId).catch(() => []),
  ]);

  const data = _buildReportData(y, m, isQ, { remoteLeave, remoteCommute, remoteOkr, remotePerf, remoteHeadcount, displayEmployees });
  _renderReport(container, y, m, isQ, data);
}

function _buildReportData(y, m, isQ, remote) {
  const startM = isQ ? (Math.ceil(m / 3) - 1) * 3 + 1 : m;
  const endM   = isQ ? Math.ceil(m / 3) * 3 : m;

  const inRange = (dateStr) => {
    if (!dateStr) return false;
    const [dy, dm] = dateStr.slice(0, 7).split('-').map(Number);
    return dy === y && dm >= startM && dm <= endM;
  };

  // 휴가: Supabase 우선, fallback localStorage
  let leaves;
  if (remote.remoteLeave && remote.remoteLeave.length) {
    leaves = remote.remoteLeave;
    leaves = leaves.map(l => ({
      ...l,
      status: l.status,
      days: l.days || 1,
      leaveType: l.leave_type,
    }));
  } else {
    leaves = _get(LS_LEAVE).filter(l => inRange(l.startDate));
  }

  const leaveCount    = leaves.length;
  const leaveApproved = leaves.filter(l => l.status === 'approved').length;
  const leavePending  = leaves.filter(l => l.status === 'pending').length;
  const leaveRejected = leaves.filter(l => l.status === 'rejected').length;
  const leaveDays     = leaves.filter(l => l.status === 'approved')
    .reduce((s, l) => s + Number(l.days || l.deductDays || 1), 0);

  // 출퇴근 — Supabase 없으면 localStorage fallback
  const commuteLogs = remote.remoteCommute
    || JSON.parse(localStorage.getItem('hr_commute_logs') || '[]');
  const remoteWorkers = new Set(commuteLogs.filter(l => l.work_type === 'remote').map(l => l.user_id)).size;
  const lateLogs = commuteLogs.filter(l => {
    if (!l.check_in) return false;
    const [h] = l.check_in.split(':').map(Number);
    return h >= 10;
  }).length;

  // OKR
  const okrs = remote.remoteOkr || [];
  const okrDone  = okrs.filter(o => o.status === 'done' || o.progress >= 100).length;
  const okrRate  = okrs.length ? Math.round(okrDone / okrs.length * 100) : 0;

  // 성과 리뷰
  const perfs = remote.remotePerf || [];
  const perfDone = perfs.filter(p => p.status === 'completed').length;
  const perfAvgScore = perfs.length
    ? (perfs.reduce((s, p) => s + (p.overall_score || 0), 0) / perfs.length).toFixed(1)
    : '-';

  // localStorage 데이터
  const harass  = _get(LS_HARASS).filter(h => inRange(h.reportedAt?.slice(0,10)));
  const eduRec  = _get(LS_LEGAL);
  const onboard = _get(LS_ONBOARD);

  const headcount = remote.remoteHeadcount?.total
    || (remote.displayEmployees?.length || 0)
    || JSON.parse(localStorage.getItem('hr_wage_ledger') || '[]').length
    || 0;
  const eduTotal  = headcount;
  const eduDone   = eduRec.filter(e => e.completed).length;

  const harassCount    = harass.length;
  const harassResolved = harass.filter(h => h.status === 'resolved').length;
  const harassPending  = harass.filter(h => h.status !== 'resolved').length;

  const onboardingDone = onboard.filter(e => e.tasks?.every(t => t.done)).length;
  const onboardingOverdue = onboard.reduce((s, e) => {
    return s + (e.tasks || []).filter(t => !t.done && _isDDayOver(e.startDate, t.dueDay)).length;
  }, 0);

  // 리스크
  const risks = [];
  if (eduTotal - eduDone > 0)
    risks.push({ level: 'mid', msg: `법정교육(성희롱 예방) 미이수 ${eduTotal - eduDone}명 — 과태료 위험` });
  if (harassPending > 0)
    risks.push({ level: 'high', msg: `괴롭힘·성희롱 신고 미처리 ${harassPending}건 — 즉시 조사 의무` });
  if (onboardingOverdue > 0)
    risks.push({ level: 'mid', msg: `온보딩 지연 태스크 ${onboardingOverdue}건 — 근로계약서 등 필수항목 확인` });
  if (leavePending > 3)
    risks.push({ level: 'mid', msg: `휴가 승인 대기 ${leavePending}건 — 결재 지연 주의` });

  return {
    headcount,
    leaveCount, leaveApproved, leavePending, leaveRejected, leaveDays,
    remoteWorkers, lateLogs,
    okrRate, okrDone, okrTotal: okrs.length,
    perfDone, perfTotal: perfs.length, perfAvgScore,
    eduRate: eduTotal > 0 ? Math.round(eduDone / eduTotal * 100) : null,
    eduDone, eduTotal,
    harassCount, harassResolved, harassPending,
    onboarding: onboard.length, onboardingDone, onboardingOverdue,
    hasRemoteData: !!(remote.remoteLeave || remote.remoteOkr),
    risks,
  };
}

function _isDDayOver(startDate, dueDay) {
  const due = new Date(startDate);
  due.setDate(due.getDate() + (dueDay || 30) - 1);
  return due < new Date();
}

function _renderReport(container, y, m, isQ, data) {
  const label = isQ
    ? `${y}년 ${Math.ceil(m / 3)}분기 (${y}-${String(Math.ceil(m/3)*3-2).padStart(2,'0')} ~ ${y}-${String(Math.ceil(m/3)*3).padStart(2,'0')})`
    : `${y}년 ${m}월`;

  container.innerHTML = `
    <!-- 보고서 커버 -->
    <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border-radius:14px;
         padding:20px;color:#fff;margin-bottom:16px" class="print-header">
      <div style="font-size:11px;opacity:0.8;margin-bottom:4px">HR 보고서 · ${new Date().toLocaleDateString('ko-KR')}</div>
      <div style="font-size:20px;font-weight:800">${label}</div>
      <div style="font-size:12px;opacity:0.8;margin-top:6px">${data.headcount > 0 ? `총 ${data.headcount}명 재직 기준` : '재직 인원 데이터 없음'}
        ${data.hasRemoteData ? '' : ' · <em>⚠️ 실데이터 없음 — localStorage 기준</em>'}</div>
    </div>

    <!-- KPI 요약 -->
    ${_kpiRow([
      { label:'휴가 신청',    value: data.leaveCount + '건',  sub: '승인 ' + data.leaveApproved + '건' },
      { label:'OKR 달성률',  value: data.okrRate + '%',       sub: data.okrDone + '/' + data.okrTotal + '건 완료' },
      { label:'법정교육 이수', value: data.eduTotal > 0 ? data.eduRate + '%' : '—', sub: data.eduTotal > 0 ? data.eduDone + '/' + data.eduTotal + '명' : '인원 데이터 없음' },
    ])}

    <!-- 섹션들 -->
    ${_section('📅 휴가 현황', `
      ${_row('신청 건수', data.leaveCount + '건')}
      ${_row('승인',      data.leaveApproved + '건')}
      ${_row('대기 중',   data.leavePending + '건', data.leavePending > 3 ? 'warn' : '')}
      ${_row('반려',      data.leaveRejected + '건')}
      ${_row('총 사용일수', data.leaveDays + '일')}
    `)}

    ${_section('⏱️ 근태 현황', `
      ${_row('재택근무 이용 인원', data.remoteWorkers + '명')}
      ${_row('지각 건수 (10시 이후 출근)', data.lateLogs + '건', data.lateLogs > 5 ? 'warn' : '')}
    `)}

    ${_section('📊 OKR · 성과', `
      ${_row('OKR 달성률',     data.okrRate + '%')}
      ${_row('완료 OKR 수',    data.okrDone + '/' + data.okrTotal + '건')}
      ${_row('성과리뷰 완료',  data.perfDone + '/' + data.perfTotal + '건')}
      ${_row('평균 성과 점수', data.perfAvgScore + '점')}
    `)}

    ${_section('📚 법정교육 현황', data.eduTotal > 0 ? `
      ${_row('성희롱 예방교육 이수율', data.eduRate + '%')}
      ${_row('이수 완료', data.eduDone + '명')}
      ${_row('미이수',    (data.eduTotal - data.eduDone) + '명', data.eduTotal - data.eduDone > 0 ? 'warn' : '')}
      ${data.eduTotal - data.eduDone > 0
        ? `<div style="background:#FEF3C7;border-radius:8px;padding:8px 10px;margin-top:6px;font-size:12px;color:#92400E">
            ⚠️ 미이수 ${data.eduTotal - data.eduDone}명 — 과태료 위험 (500만원 이하)</div>` : ''}
    ` : '<div style="color:#94A3B8;font-size:13px;text-align:center;padding:12px">재직 인원 데이터가 없어 이수율을 계산할 수 없습니다.</div>')}

    ${_section('🛡️ 괴롭힘·성희롱', `
      ${_row('신고 접수',   data.harassCount + '건')}
      ${_row('처리 완료',   data.harassResolved + '건')}
      ${_row('처리 중',     data.harassPending + '건', data.harassPending > 0 ? 'danger' : '')}
    `)}

    ${_section('🎉 온보딩 현황', `
      ${_row('진행 중',          data.onboarding + '명')}
      ${_row('완료 (100%)',      data.onboardingDone + '명')}
      ${_row('지연 태스크',      data.onboardingOverdue + '건', data.onboardingOverdue > 0 ? 'warn' : '')}
    `)}

    ${_section('⚖️ 법적 리스크 요약', `
      ${data.risks.length
        ? data.risks.map(r => `<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px">
            <span style="font-size:16px">${r.level==='high'?'🔴':r.level==='mid'?'🟡':'🟢'}</span>
            <div style="font-size:13px;color:var(--text)">${r.msg}</div>
          </div>`).join('')
        : '<div style="color:#10B981;font-size:13px">✅ 주요 법적 리스크 없음</div>'}
    `)}

    <!-- 인쇄용 서명란 -->
    <div class="print-only" style="display:none;margin-top:32px;border-top:2px solid #000;padding-top:16px">
      <div style="display:flex;justify-content:flex-end;gap:40px;font-size:13px">
        <div style="text-align:center">작성자<br><br>_______________</div>
        <div style="text-align:center">검토자<br><br>_______________</div>
        <div style="text-align:center">승인자<br><br>_______________</div>
      </div>
    </div>
  `;
}

function _kpiRow(items) {
  return `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
    ${items.map(k => `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;text-align:center">
      <div style="font-size:20px;font-weight:800;color:#4F46E5">${k.value}</div>
      <div style="font-size:11px;font-weight:700;margin-top:2px;color:var(--text)">${k.label}</div>
      <div style="font-size:10px;color:#94A3B8;margin-top:2px">${k.sub}</div>
    </div>`).join('')}
  </div>`;
}

function _section(title, content) {
  return `<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
      padding:14px;margin-bottom:10px">
    <div style="font-size:13px;font-weight:700;margin-bottom:10px">${title}</div>
    ${content}
  </div>`;
}

function _row(label, value, level) {
  const color = level === 'danger' ? '#DC2626' : level === 'warn' ? '#D97706' : 'var(--text)';
  return `<div style="display:flex;justify-content:space-between;align-items:center;
      padding:5px 0;border-bottom:1px solid var(--border)">
    <span style="font-size:13px;color:#64748B">${label}</span>
    <span style="font-size:13px;font-weight:600;color:${color}">${value}</span>
  </div>`;
}

function _printReport() {
  window.print();
  showToast('브라우저의 "PDF로 저장"을 선택하면 PDF로 내보낼 수 있습니다.', 'info', 4000);
}

function _exportCSV() {
  const [y, m] = _targetMonth.split('-').map(Number);
  const isQ = _period === 'quarterly';
  const data = _buildReportData(y, m, isQ, { remoteLeave: null, remoteCommute: null, remoteOkr: null, remotePerf: null, remoteHeadcount: null, displayEmployees: [] });
  const rows = [
    ['항목', '값'],
    ['기간', _targetMonth],
    ['재직 인원', data.headcount],
    ['휴가 신청', data.leaveCount],
    ['휴가 승인', data.leaveApproved],
    ['총 휴가일수', data.leaveDays],
    ['지각 건수', data.lateLogs],
    ['OKR 달성률', data.okrRate + '%'],
    ['성과리뷰 완료', data.perfDone + '/' + data.perfTotal],
    ['법정교육 이수율', data.eduTotal > 0 ? data.eduRate + '%' : '데이터 없음'],
    ['괴롭힘 신고', data.harassCount],
    ['신고 미처리', data.harassPending],
    ['온보딩 진행 중', data.onboarding],
    ['온보딩 완료', data.onboardingDone],
    ['법적 리스크', data.risks.map(r => r.msg).join(' | ')],
  ];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `hr-report-${_targetMonth}.csv`; a.click();
  URL.revokeObjectURL(url);
  showToast('CSV 보고서가 다운로드되었습니다.', 'success');
  addNotification({ type: 'success', title: 'HR 보고서', body: 'CSV 보고서가 다운로드되었습니다.' });
}

function _injectPrintStyle() {
  if (document.getElementById('hr-report-print-style')) return;
  const s = document.createElement('style');
  s.id = 'hr-report-print-style';
  s.textContent = `
    @media print {
      body > * { display: none !important; }
      #hr-report-wrap { display: block !important; }
      .no-print { display: none !important; }
      .print-only { display: block !important; }
      #hr-report-wrap { padding: 0; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `;
  document.head.appendChild(s);
}

export async function mount(root) { return render(root); }
