/**
 * export.js — Data export utilities
 *
 * exportCsv(filename, rows)       — download a CSV file
 * exportGoalsCsv(userId)          — OKR goals + KR progress
 * exportReviewsCsv(userId)        — performance reviews
 * exportMeetingsCsv(userId)       — 1:1 meeting records
 * exportGrowthReport(user, data)  — printable HTML report (opens print dialog)
 */

// ── CSV core ──────────────────────────────────────────────────

function _toCsv(rows) {
  return rows.map(row =>
    row.map(cell => {
      const s = String(cell ?? '').replace(/"/g, '""');
      return /[",\n\r]/.test(s) ? `"${s}"` : s;
    }).join(',')
  ).join('\r\n');
}

export function exportCsv(filename, rows) {
  const bom  = '﻿'; // UTF-8 BOM for Excel
  const blob = new Blob([bom + _toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── OKR Goals ─────────────────────────────────────────────────

export function exportGoalsCsv(userId) {
  let goals = [];
  try { goals = JSON.parse(localStorage.getItem('hr_okr_goals') || '[]'); } catch {}
  let checkins = [];
  try { checkins = JSON.parse(localStorage.getItem('hr_okr_checkins') || '[]'); } catch {}

  const mine = goals.filter(g => !userId || g.userId === userId);
  if (!mine.length) return false;

  const PERIOD = { H1: '상반기', H2: '하반기', ANNUAL: '연간' };

  const rows = [['기간', '목표(Objective)', 'Key Result', '진척률(%)', '단위', '최근 체크인']];
  mine.forEach(g => {
    const period = PERIOD[g.period] || g.period || '';
    (g.keyResults || []).forEach((kr, i) => {
      const relatedCk = checkins.filter(c => c.goalId === g.id && c.krId === kr.id);
      relatedCk.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      const lastCk = relatedCk[0];
      rows.push([
        period,
        i === 0 ? (g.objective || '') : '',
        kr.text || '',
        kr.progress ?? 0,
        kr.unit || '%',
        lastCk ? `${lastCk.date || ''} (${lastCk.progress ?? ''}%) ${lastCk.comment || ''}`.trim() : '',
      ]);
    });
    if (!(g.keyResults || []).length) {
      rows.push([period, g.objective || '', '', '', '', '']);
    }
  });

  exportCsv(`OKR_목표_${_dateTag()}.csv`, rows);
  return true;
}

// ── Performance Reviews ───────────────────────────────────────

export function exportReviewsCsv(userId) {
  let reviews = [];
  try { reviews = JSON.parse(localStorage.getItem('hr_perf_reviews') || '[]'); } catch {}

  const mine = reviews.filter(r => !userId || r.userId === userId);
  if (!mine.length) return false;

  const rows = [['날짜', '목표 달성도', '역량 발휘도', '핵심 성과', '개선점', '다음 목표']];
  mine.forEach(r => {
    rows.push([
      r.date || '',
      r.goalAchievement ?? '',
      r.competencyDemo ?? '',
      r.highlights || '',
      r.improvements || '',
      r.nextGoals || '',
    ]);
  });

  exportCsv(`성과리뷰_${_dateTag()}.csv`, rows);
  return true;
}

// ── 1:1 Meetings ──────────────────────────────────────────────

export function exportMeetingsCsv(userId) {
  let meetings = [];
  try { meetings = JSON.parse(localStorage.getItem('hr_one_on_ones') || '[]'); } catch {}

  const mine = meetings.filter(m => !userId || m.userId === userId);
  if (!mine.length) return false;

  const rows = [['날짜', '상대방', '의제', '주요 논의 내용', '액션 아이템', '완료 여부']];
  mine.forEach(m => {
    const actions = (m.actionItems || []);
    if (actions.length) {
      actions.forEach((ai, i) => {
        rows.push([
          i === 0 ? (m.date || '') : '',
          i === 0 ? (m.partner || '') : '',
          i === 0 ? (m.agenda || '') : '',
          i === 0 ? (m.notes || '') : '',
          ai.text || '',
          ai.done ? '완료' : '미완료',
        ]);
      });
    } else {
      rows.push([m.date || '', m.partner || '', m.agenda || '', m.notes || '', '', '']);
    }
  });

  exportCsv(`1대1미팅_${_dateTag()}.csv`, rows);
  return true;
}

// ── Growth Report (printable HTML) ───────────────────────────

export function exportGrowthReport(user, assessmentData, period = 'all') {
  const name = user?.name_ko || user?.name || user?.email || '구성원';
  const today = new Date().toLocaleDateString('ko-KR');

  // period filter: 'q1'|'q2'|'q3'|'q4' = 해당 분기, 'h1'|'h2' = 상반기/하반기, 'all' = 전체
  const now = new Date();
  const year = now.getFullYear();
  const _periodLabel = { q1:'1분기', q2:'2분기', q3:'3분기', q4:'4분기', h1:'상반기', h2:'하반기', all:'전체' }[period] || '전체';
  function _inPeriod(dateStr) {
    if (period === 'all' || !dateStr) return true;
    const d = new Date(dateStr);
    if (isNaN(d)) return true;
    const m = d.getMonth() + 1;
    if (period === 'q1') return m >= 1 && m <= 3;
    if (period === 'q2') return m >= 4 && m <= 6;
    if (period === 'q3') return m >= 7 && m <= 9;
    if (period === 'q4') return m >= 10 && m <= 12;
    if (period === 'h1') return m >= 1 && m <= 6;
    if (period === 'h2') return m >= 7 && m <= 12;
    return true;
  }

  let goals = [];
  try { goals = JSON.parse(localStorage.getItem('hr_okr_goals') || '[]').filter(g => g.userId === user?.id && _inPeriod(g.createdAt || g.startDate)); } catch {}
  let reviews = [];
  try { reviews = JSON.parse(localStorage.getItem('hr_perf_reviews') || '[]').filter(r => r.userId === user?.id && _inPeriod(r.date)); } catch {}
  let idpItems = [];
  try { idpItems = JSON.parse(localStorage.getItem('hr_idp_items') || '[]').filter(i => i.userId === user?.id || !i.userId); } catch {}
  let peerReceived = [];
  try { peerReceived = JSON.parse(localStorage.getItem('hr_peer_reviews') || '[]').filter(r => r.revieweeId === user?.id && _inPeriod(r.date)); } catch {}

  const scores = assessmentData?.scores || [];

  function avgPct(gs) {
    const all = gs.flatMap(g => g.keyResults || []);
    if (!all.length) return 0;
    return Math.round(all.reduce((s, kr) => s + (kr.progress || 0), 0) / all.length);
  }

  const overallOkr = avgPct(goals);
  const latestReview = reviews.length
    ? [...reviews].sort((a, b) => new Date(b.date||0) - new Date(a.date||0))[0]
    : null;

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${name} 성장 리포트 — ${today}</title>
<style>
  body { font-family: 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif; color: #1E293B; margin: 0; padding: 24px; font-size: 13px; line-height: 1.6; }
  h1 { font-size: 20px; font-weight: 800; margin-bottom: 4px; }
  h2 { font-size: 14px; font-weight: 700; color: #4F46E5; margin: 20px 0 8px; border-bottom: 1.5px solid #E2E8F0; padding-bottom: 4px; }
  .meta { color: #64748B; font-size: 12px; margin-bottom: 20px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .kpi { text-align: center; padding: 12px; border: 1px solid #E2E8F0; border-radius: 8px; }
  .kpi-value { font-size: 24px; font-weight: 800; color: #4F46E5; }
  .kpi-label { font-size: 11px; color: #64748B; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
  th { background: #F8FAFC; padding: 8px 10px; text-align: left; font-weight: 700; color: #475569; border-bottom: 1.5px solid #E2E8F0; }
  td { padding: 7px 10px; border-bottom: 1px solid #F1F5F9; }
  .bar { height: 6px; background: #E2E8F0; border-radius: 3px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 3px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>${_esc(name)} 성장 리포트</h1>
  <div class="meta">생성일: ${today} · 기간: ${_periodLabel}</div>

  <div class="grid" style="grid-template-columns:1fr 1fr 1fr 1fr">
    <div class="kpi">
      <div class="kpi-value">${scores.length ? (scores.reduce((s,c)=>s+Number(c.as_is_score||0),0)/scores.length).toFixed(1) : '-'}</div>
      <div class="kpi-label">역량 평균 점수</div>
    </div>
    <div class="kpi">
      <div class="kpi-value" style="color:${overallOkr>=80?'#059669':overallOkr>=50?'#D97706':'#DC2626'}">${goals.length ? overallOkr + '%' : '-'}</div>
      <div class="kpi-label">OKR 평균 진척</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${peerReceived.length ? (peerReceived.reduce((s,r)=>s+(r.overallScore||0),0)/peerReceived.length).toFixed(1) : '-'}</div>
      <div class="kpi-label">동료 평가 평균</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${idpItems.length}</div>
      <div class="kpi-label">IDP 개발 과제</div>
    </div>
  </div>

  ${scores.length ? `
  <h2>📊 역량 진단 결과</h2>
  <table>
    <tr><th>역량</th><th>현재 점수</th><th>목표 점수</th><th>진척도</th></tr>
    ${scores.map(s => `
      <tr>
        <td>${_esc(s.competency_name_ko || '')}</td>
        <td>${Number(s.as_is_score||0).toFixed(1)}</td>
        <td>${Number(s.to_be_score||0).toFixed(1)}</td>
        <td>
          <div class="bar"><div class="bar-fill" style="width:${Math.min(100,Number(s.as_is_score||0)/5*100)}%;background:${Number(s.as_is_score||0)>=Number(s.to_be_score||0)?'#059669':'#4F46E5'}"></div></div>
        </td>
      </tr>`).join('')}
  </table>` : ''}

  ${goals.length ? `
  <h2>🎯 OKR 현황</h2>
  <table>
    <tr><th>기간</th><th>목표</th><th>Key Result</th><th>진척률</th></tr>
    ${goals.flatMap(g => (g.keyResults||[]).map((kr,i) => `
      <tr>
        <td>${i===0?(g.period||''):('')} </td>
        <td>${i===0?_esc(g.objective||''):''}</td>
        <td>${_esc(kr.text||'')}</td>
        <td>${kr.progress??0}%</td>
      </tr>`)).join('')}
  </table>` : ''}

  ${latestReview ? `
  <h2>📋 최근 성과 리뷰 (${latestReview.date||''})</h2>
  <table>
    <tr><th>항목</th><th>내용</th></tr>
    <tr><td>목표 달성도</td><td>${latestReview.goalAchievement??'-'} / 5</td></tr>
    <tr><td>역량 발휘도</td><td>${latestReview.competencyDemo??'-'} / 5</td></tr>
    ${latestReview.highlights ? `<tr><td>핵심 성과</td><td>${_esc(latestReview.highlights)}</td></tr>` : ''}
    ${latestReview.improvements ? `<tr><td>개선 영역</td><td>${_esc(latestReview.improvements)}</td></tr>` : ''}
  </table>` : ''}

  ${peerReceived.length ? (() => {
    const compMap = {};
    peerReceived.forEach(r => {
      Object.entries(r.scores || {}).forEach(([k, v]) => {
        if (!compMap[k]) compMap[k] = { total: 0, count: 0 };
        compMap[k].total += Number(v);
        compMap[k].count++;
      });
    });
    const compRows = Object.entries(compMap).map(([k, {total, count}]) =>
      `<tr><td>${_esc(k)}</td><td>${(total/count).toFixed(1)}</td></tr>`).join('');
    return `
  <h2>👥 동료 평가 결과 (${peerReceived.length}건)</h2>
  <table>
    <tr><th>역량 항목</th><th>평균 점수 (5점 만점)</th></tr>
    ${compRows || `<tr><td colspan="2" style="color:#64748B">역량별 세부 점수 없음</td></tr>`}
    <tr style="background:#F0F9FF;font-weight:700">
      <td>종합 평균</td>
      <td>${(peerReceived.reduce((s,r)=>s+(r.overallScore||0),0)/peerReceived.length).toFixed(1)}</td>
    </tr>
  </table>`;
  })() : ''}

  ${idpItems.length ? `
  <h2>📈 개인 성장 계획 (IDP)</h2>
  <table>
    <tr><th>역량</th><th>개발 과제</th><th>우선순위</th><th>상태</th></tr>
    ${idpItems.slice(0,10).map(item => `
      <tr>
        <td>${_esc(item.competency_name_ko||'')}</td>
        <td>${_esc(item.resource_title_ko||item.action_type||'')}</td>
        <td>${_esc(item.priority||'')}</td>
        <td>${_esc(item.status||'')}</td>
      </tr>`).join('')}
  </table>` : ''}
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
  return true;
}

// ── Helpers ───────────────────────────────────────────────────

function _dateTag() {
  return new Date().toISOString().slice(0, 10);
}

function _esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
