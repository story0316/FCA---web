/**
 * commute.js — 출퇴근 체크인
 */

import {getUser, isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
import { api } from '../api.js';

function _session() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}'); } catch { return {}; } }

const LS = 'hr_commute_logs';

const WORK_TYPES = [
  { key: 'office',   label: '사무실 출근', icon: '🏢', color: '#4F46E5' },
  { key: 'remote',   label: '재택근무',    icon: '🏠', color: '#10B981' },
  { key: 'field',    label: '외근/현장',   icon: '🚗', color: '#F59E0B' },
  { key: 'business', label: '출장',        icon: '✈️', color: '#8B5CF6' },
];

const STD_IN  = '09:00';
const STD_OUT = '18:00';

function _getLogs() { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } }
function _saveLogs(l) { localStorage.setItem(LS, JSON.stringify(l)); }
function _todayStr() { return new Date().toISOString().slice(0, 10); }
function _nowStr()   { return new Date().toTimeString().slice(0, 5); }
function _id()       { return 'cm_' + Date.now(); }

function _minsDiff(t1, t2) {
  const [h1, m1] = t1.split(':').map(Number);
  const [h2, m2] = t2.split(':').map(Number);
  return (h2 * 60 + m2) - (h1 * 60 + m1);
}
function _fmtMins(mins) {
  if (mins < 0) return '-';
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

let _tab = 'today';
let _selectedType = 'office';
let _viewMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  const user = getUser();
  const uid  = _session().empId || _session().userId || user?.id || 'demo';
  _tab = 'today';
  _viewMonth = new Date().toISOString().slice(0, 7);

  // Supabase 데이터를 로컬에 병합 (로그인 사용자만)
  const remote = await api.commute.getLogs(uid);
  if (remote && remote.length) {
    const local = _getLogs().filter(l => l.empId !== uid);
    const merged = [
      ...local,
      ...remote.map(r => ({
        id: r.id, empId: uid, date: r.date,
        workType: r.work_type, checkIn: r.check_in, checkOut: r.check_out,
      })),
    ];
    _saveLogs(merged);
  }

  const logs = _getLogs();
  const today = _todayStr();
  const todayLog = logs.find(l => l.empId === uid && l.date === today);
  _selectedType = todayLog?.workType || 'office';
  _draw(root);
}

export function unmount() {
  _tab = 'today';
  _selectedType = 'office';
}

function _draw(root) {
  const user = getUser();
  const uid  = _session().empId || _session().userId || user?.id || 'demo';
  const logs  = _getLogs();
  const today = _todayStr();
  const todayLog = logs.find(l => l.empId === uid && l.date === today);

  const [y, m] = _viewMonth.split('-');
  const monthLogs = logs.filter(l => l.empId === uid && l.date.startsWith(_viewMonth));

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden">
  <div class="page-header" style="flex-shrink:0;background:var(--card-bg);border-bottom:1px solid var(--border);padding:16px;display:flex;align-items:center;gap:12px">
    <button onclick="window.navBack()"
      style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0;line-height:1">←</button>
    <div>
      <div style="font-size:16px;font-weight:700;color:var(--text)">출퇴근</div>
      <div style="font-size:11px;color:var(--text-muted)" id="cm-clock">${_nowStr()}</div>
    </div>
  </div>

  <div style="flex-shrink:0;display:flex;border-bottom:1px solid var(--border);background:var(--card-bg)">
    <button class="cm-tab" data-t="today"
      style="flex:1;padding:12px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab==='today'?'#4F46E5':'transparent'};color:${_tab==='today'?'#4F46E5':'var(--text-muted)'}">오늘</button>
    <button class="cm-tab" data-t="month"
      style="flex:1;padding:12px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab==='month'?'#4F46E5':'transparent'};color:${_tab==='month'?'#4F46E5':'var(--text-muted)'}">월간 현황</button>
    <button class="cm-tab" data-t="history"
      style="flex:1;padding:12px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab==='history'?'#4F46E5':'transparent'};color:${_tab==='history'?'#4F46E5':'var(--text-muted)'}">이력</button>
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">
    ${_tab === 'today'   ? _renderToday(todayLog, today)        : ''}
    ${_tab === 'month'   ? _renderMonth(monthLogs, y, m)        : ''}
    ${_tab === 'history' ? _renderHistory(logs.filter(l=>l.empId===uid)) : ''}
  </div>
</div>`;

  root.querySelectorAll('.cm-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _draw(root); });
  });

  if (_tab === 'today') _bindToday(root, uid, todayLog, today, logs);

  if (_tab === 'month') {
    root.querySelectorAll('.cm-month-nav').forEach(btn => {
      btn.addEventListener('click', () => {
        const [cy, cm2] = _viewMonth.split('-').map(Number);
        const d = new Date(cy, cm2 - 1 + Number(btn.dataset.d));
        _viewMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        _draw(root);
      });
    });
  }
}

function _renderToday(todayLog, today) {
  const wt = WORK_TYPES.find(t => t.key === _selectedType) || WORK_TYPES[0];
  const now = _nowStr();
  const isLate = todayLog?.checkIn && _minsDiff(STD_IN, todayLog.checkIn) > 0;
  const workMins = todayLog?.checkIn && todayLog?.checkOut
    ? _minsDiff(todayLog.checkIn, todayLog.checkOut) - 60 /* lunch */
    : null;

  return `
<!-- 날짜 표시 -->
<div style="text-align:center;margin-bottom:20px">
  <div style="font-size:28px;font-weight:900;color:var(--text)">${now}</div>
  <div style="font-size:13px;color:var(--text-muted);margin-top:4px">${today}</div>
</div>

<!-- 근무 유형 선택 -->
<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">근무 유형</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px">
  ${WORK_TYPES.map(t => {
    const active = _selectedType === t.key;
    return `<button class="cm-type-btn" data-key="${t.key}"
      style="padding:12px;border-radius:12px;border:2px solid ${active?t.color:'var(--border)'};
             background:${active?t.color+'1A':'var(--card-bg)'};cursor:pointer;text-align:center;
             transition:all .2s">
      <div style="font-size:22px;margin-bottom:4px">${t.icon}</div>
      <div style="font-size:11px;font-weight:700;color:${active?t.color:'var(--text-muted)'}">${t.label}</div>
    </button>`;
  }).join('')}
</div>

<!-- 상태 카드 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
    <div style="text-align:center;padding:10px;background:${todayLog?.checkIn?'#EEF2FF':'var(--bg)'};border-radius:10px">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">출근</div>
      <div style="font-size:20px;font-weight:800;color:${todayLog?.checkIn?'#4F46E5':'var(--text-muted)'}">${todayLog?.checkIn || '--:--'}</div>
      ${isLate ? `<div style="font-size:9px;color:#EF4444;margin-top:2px">지각</div>` : todayLog?.checkIn ? `<div style="font-size:9px;color:#10B981;margin-top:2px">정시</div>` : ''}
    </div>
    <div style="text-align:center;padding:10px;background:${todayLog?.checkOut?'#D1FAE5':'var(--bg)'};border-radius:10px">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">퇴근</div>
      <div style="font-size:20px;font-weight:800;color:${todayLog?.checkOut?'#10B981':'var(--text-muted)'}">${todayLog?.checkOut || '--:--'}</div>
      ${workMins !== null ? `<div style="font-size:9px;color:var(--text-muted);margin-top:2px">실근무 ${_fmtMins(workMins)}</div>` : ''}
    </div>
  </div>
  ${todayLog?.checkIn && !todayLog?.checkOut ? `
    <div style="background:#FEF3C7;border-radius:8px;padding:8px;text-align:center;font-size:12px;color:#D97706;margin-bottom:12px">
      근무 중 · ${_fmtMins(_minsDiff(todayLog.checkIn, now))} 경과
    </div>` : ''}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <button id="cm-checkin"
      style="padding:13px;background:${todayLog?.checkIn?'#E2E8F0':'#4F46E5'};color:${todayLog?.checkIn?'var(--text-muted)':'#fff'};
             border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:${todayLog?.checkIn?'not-allowed':'pointer'}">
      ${todayLog?.checkIn ? `✓ 출근 완료` : '출근 체크인'}
    </button>
    <button id="cm-checkout"
      style="padding:13px;background:${!todayLog?.checkIn||todayLog?.checkOut?'#E2E8F0':'#10B981'};
             color:${!todayLog?.checkIn||todayLog?.checkOut?'var(--text-muted)':'#fff'};
             border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:${!todayLog?.checkIn||todayLog?.checkOut?'not-allowed':'pointer'}">
      ${todayLog?.checkOut ? '✓ 퇴근 완료' : '퇴근 체크아웃'}
    </button>
  </div>
</div>

<!-- 오늘 근무 유형 표시 -->
${todayLog ? `<div style="text-align:center;font-size:12px;color:var(--text-muted)">
  ${wt.icon} ${wt.label} · ${todayLog.workType === 'office' ? '사무실' : todayLog.workType === 'remote' ? '재택' : todayLog.workType === 'field' ? '외근' : '출장'}
</div>` : ''}`;
}

function _bindToday(root, uid, todayLog, today, logs) {
  root.querySelectorAll('.cm-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _selectedType = btn.dataset.key;
      _draw(root);
    });
  });

  root.querySelector('#cm-checkin')?.addEventListener('click', async () => {
    if (todayLog?.checkIn) return;
    const now = _nowStr();
    const id  = _id();
    const allLogs = _getLogs();
    allLogs.push({ id, empId: uid, date: today, workType: _selectedType, checkIn: now, checkOut: null });
    _saveLogs(allLogs);
    const isLate = _minsDiff(STD_IN, now) > 0;
    showToast(`출근 체크인 완료 ${now}${isLate ? ' (지각)' : ''}`, isLate ? 'error' : 'success');
    addNotification({ type: 'info', title: '출근 완료', message: `${now} ${WORK_TYPES.find(t=>t.key===_selectedType)?.label}` });
    api.commute.saveLog({ id, date: today, workType: _selectedType, checkIn: now, checkOut: null });
    _draw(root);
  });

  root.querySelector('#cm-checkout')?.addEventListener('click', async () => {
    if (!todayLog?.checkIn || todayLog?.checkOut) return;
    const now = _nowStr();
    const allLogs = _getLogs();
    const idx = allLogs.findIndex(l => l.empId === uid && l.date === today);
    if (idx !== -1) { allLogs[idx].checkOut = now; _saveLogs(allLogs); }
    const workMins = _minsDiff(todayLog.checkIn, now) - 60;
    showToast(`퇴근 완료 ${now} · 실근무 ${_fmtMins(Math.max(0, workMins))}`, 'success')
    addNotification({ type: 'success', title: '통근', body: '퇴근 완료  · 실근무' });
    api.commute.saveLog({ id: todayLog.id, date: today, workType: todayLog.workType, checkIn: todayLog.checkIn, checkOut: now });
    _draw(root);
  });
}

function _renderMonth(monthLogs, y, m) {
  const monthName = `${y}년 ${Number(m)}월`;
  const workdays  = monthLogs.length;
  const ontime    = monthLogs.filter(l => l.checkIn && _minsDiff(STD_IN, l.checkIn) <= 0).length;
  const late      = monthLogs.filter(l => l.checkIn && _minsDiff(STD_IN, l.checkIn) > 0).length;
  const totalWork = monthLogs.reduce((n, l) => {
    if (!l.checkIn || !l.checkOut) return n;
    return n + Math.max(0, _minsDiff(l.checkIn, l.checkOut) - 60);
  }, 0);
  const byType = {};
  WORK_TYPES.forEach(t => { byType[t.key] = monthLogs.filter(l => l.workType === t.key).length; });

  return `
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
  <button class="cm-month-nav" data-d="-1"
    style="padding:6px 12px;border:1.5px solid var(--border);border-radius:8px;background:none;cursor:pointer;font-size:12px;color:var(--text-muted)">← 이전</button>
  <span style="font-size:14px;font-weight:700;color:var(--text)">${monthName}</span>
  <button class="cm-month-nav" data-d="1"
    style="padding:6px 12px;border:1.5px solid var(--border);border-radius:8px;background:none;cursor:pointer;font-size:12px;color:var(--text-muted)">다음 →</button>
</div>

<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
  ${[
    { label: '출근일', val: workdays,                           color: '#4F46E5' },
    { label: '정시',   val: ontime,                             color: '#10B981' },
    { label: '지각',   val: late,                               color: '#EF4444' },
    { label: '총 근무', val: _fmtMins(totalWork),              color: '#F59E0B' },
  ].map(k=>`
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
      <div style="font-size:15px;font-weight:800;color:${k.color}">${k.val}</div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${k.label}</div>
    </div>`).join('')}
</div>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">근무 유형 분포</div>
  ${WORK_TYPES.map(t => {
    const cnt = byType[t.key] || 0;
    const pct = workdays ? Math.round(cnt / workdays * 100) : 0;
    return `
<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
  <span style="font-size:14px;flex-shrink:0">${t.icon}</span>
  <span style="font-size:12px;color:var(--text);min-width:60px">${t.label}</span>
  <div style="flex:1;height:10px;background:#E2E8F0;border-radius:5px;overflow:hidden">
    <div style="height:100%;background:${t.color};border-radius:5px;width:${pct}%;transition:width .3s"></div>
  </div>
  <span style="font-size:12px;font-weight:700;color:${t.color};min-width:32px;text-align:right">${cnt}일</span>
</div>`;
  }).join('')}
</div>

${!monthLogs.length ? `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">이 달의 출퇴근 기록이 없습니다.</div>` : ''}`;
}

function _renderHistory(myLogs) {
  const sorted = [...myLogs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  if (!sorted.length) {
    return `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
      <div style="font-size:40px;margin-bottom:12px">📋</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:4px">출퇴근 기록이 없습니다</div>
      <div style="font-size:12px;margin-bottom:14px">출근 체크인부터 시작해 보세요.</div>
      <button onclick="window.location.hash='#/my'"
        style="padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">출근 하기</button>
    </div>`;
  }
  return sorted.map(l => {
    const wt = WORK_TYPES.find(t => t.key === l.workType) || WORK_TYPES[0];
    const isLate = l.checkIn && _minsDiff(STD_IN, l.checkIn) > 0;
    const workMins = l.checkIn && l.checkOut ? _minsDiff(l.checkIn, l.checkOut) - 60 : null;
    return `
<div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;margin-bottom:8px">
  <span style="font-size:20px;flex-shrink:0">${wt.icon}</span>
  <div style="flex:1">
    <div style="font-size:12px;font-weight:700;color:var(--text)">${l.date}</div>
    <div style="font-size:11px;color:var(--text-muted)">
      출근 ${l.checkIn||'--:--'} · 퇴근 ${l.checkOut||'--:--'}
      ${workMins!==null ? ` · ${_fmtMins(Math.max(0,workMins))}` : ''}
    </div>
  </div>
  ${isLate ? `<span style="font-size:10px;padding:3px 7px;background:#FEE2E2;color:#EF4444;border-radius:6px;font-weight:700">지각</span>` : l.checkIn ? `<span style="font-size:10px;padding:3px 7px;background:#D1FAE5;color:#059669;border-radius:6px;font-weight:700">정시</span>` : ''}
</div>`;
  }).join('');
}
