/**
 * attendance.js — 위치 기반 근태 관리
 * 출근/퇴근 기록, 주간 현황, 월간 통계
 */

import {getUser, isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { weekSummary, getWeekClassified, thisWeekMonday, WEEKLY_LIMIT } from '../utils/workhours-engine.js';
import { addNotification } from '../components/notification-hub.js';

let _root    = null;
let _timerID = null;

const LS_ATT = 'hr_attendance';

// ── 데이터 헬퍼 ─────────────────────────────────────────────

function _uid() {
  try { return JSON.parse(localStorage.getItem('hr_user') || '{}').id || 'demo'; } catch { return 'demo'; }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getRecords() {
  const uid = _uid();
  try {
    const all = JSON.parse(localStorage.getItem(LS_ATT) || '[]');
    return all.filter(r => (r.userId || 'demo') === uid);
  } catch { return []; }
}

function saveRecords(list) {
  const uid = _uid();
  try {
    const all = JSON.parse(localStorage.getItem(LS_ATT) || '[]');
    const others = all.filter(r => (r.userId || 'demo') !== uid);
    localStorage.setItem(LS_ATT, JSON.stringify([...others, ...list]));
  } catch {}
}

function getToday() {
  const key = todayKey();
  return getRecords().find(r => r.date === key) || null;
}

function upsertToday(patch) {
  const key  = todayKey();
  const uid  = _uid();
  const list = getRecords();
  const idx  = list.findIndex(r => r.date === key);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch, userId: uid };
  } else {
    list.unshift({ date: key, userId: uid, ...patch });
  }
  saveRecords(list);
  return list[idx >= 0 ? idx : 0];
}

// ── 위치 획득 + 역지오코딩 ───────────────────────────────────

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('geolocation_unsupported'));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: 8000,
      maximumAge: 30000,
      enableHighAccuracy: true,
    });
  });
}

async function resolveAddress(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ko`;
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await r.json();
    const addr = data.address || {};
    const parts = [
      addr.city || addr.county || addr.state,
      addr.suburb || addr.neighbourhood || addr.town,
      addr.road,
    ].filter(Boolean);
    return parts.slice(0, 2).join(' ') || data.display_name?.split(',')[0] || '위치 확인됨';
  } catch {
    return '위치 확인됨 (GPS)';
  }
}

// ── 시간 포맷 ────────────────────────────────────────────────

function fmt(ts) {
  return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

function elapsed(fromTs, toTs = Date.now()) {
  const sec = Math.floor((toTs - fromTs) / 1000);
  const h   = Math.floor(sec / 3600);
  const m   = Math.floor((sec % 3600) / 60);
  const s   = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function workHoursLabel(fromTs, toTs) {
  const min  = Math.floor((toTs - fromTs) / 60000);
  const h    = Math.floor(min / 60);
  const m    = min % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

// ── 데모 주간 기록 생성 ──────────────────────────────────────

function demoWeek() {
  const today  = new Date();
  const dow    = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));

  const real = getRecords();
  const days = [];

  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = d.toISOString().slice(0, 10);

    // If today or future, skip demo generation
    const isToday  = key === todayKey();
    const isFuture = d > today && !isToday;

    const realRec = real.find(r => r.date === key);
    if (realRec) { days.push({ ...realRec, isToday }); continue; }
    if (isToday || isFuture) { days.push({ date: key, isToday, isFuture }); continue; }

    // Generate demo past record
    const inH  = 8 + Math.floor(Math.random() * 2);
    const inM  = Math.floor(Math.random() * 30);
    const outH = inH + 8 + Math.floor(Math.random() * 2);
    const outM = Math.floor(Math.random() * 60);
    const inTs  = new Date(d.getFullYear(), d.getMonth(), d.getDate(), inH, inM).getTime();
    const outTs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), outH, outM).getTime();
    days.push({
      date:     key,
      checkIn:  { ts: inTs,  time: `${String(inH).padStart(2,'0')}:${String(inM).padStart(2,'0')}`, address: '사무실' },
      checkOut: { ts: outTs, time: `${String(outH).padStart(2,'0')}:${String(outM).padStart(2,'0')}`, address: '사무실' },
      isToday:  false,
    });
  }
  return days;
}

// ── 렌더링 ──────────────────────────────────────────────────

function render(root) {
  const today  = getToday();
  const user   = getUser();
  const name   = user?.name_ko || user?.name || '직원';
  const now    = new Date();
  const dateLabel = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });

  const isWorking  = today?.checkIn && !today?.checkOut;
  const isDone     = today?.checkIn && today?.checkOut;

  root.innerHTML = `
    <div class="page" style="background:var(--bg)">
      <div class="top-bar">
        <button onclick="window.navBack()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0 8px 0 0;line-height:1">←</button>
        <div class="top-bar-title">📍 근태 관리</div>
      </div>

      <div class="page-content" style="padding:16px;display:flex;flex-direction:column;gap:16px">

        <!-- 오늘 날짜 + 상태 헤더 -->
        <div style="text-align:center;padding:4px 0 8px">
          <div style="font-size:0.82rem;color:var(--text-muted)">${dateLabel}</div>
          <div style="font-size:1rem;font-weight:700;color:var(--text);margin-top:2px">${name}님 안녕하세요 👋</div>
        </div>

        <!-- 메인 카드 -->
        ${renderMainCard(today, isWorking, isDone)}

        <!-- 주 52h 게이지 -->
        ${renderWeeklyGauge()}

        <!-- 이번 주 현황 -->
        ${renderWeekCard()}

        <!-- 월간 통계 -->
        ${renderMonthStats()}

      </div>
    </div>`;

  bindEvents(root);
  if (isWorking) startTimer(root, today.checkIn.ts);
}

function renderMainCard(today, isWorking, isDone) {
  if (isDone) {
    const hrs = workHoursLabel(today.checkIn.ts, today.checkOut.ts);
    return `
      <div style="background:linear-gradient(135deg,#059669 0%,#10B981 100%);
                  border-radius:16px;padding:28px 24px;color:#fff;text-align:center">
        <div style="font-size:2.4rem;margin-bottom:10px">🎉</div>
        <div style="font-weight:700;font-size:1.1rem;margin-bottom:16px">오늘 근무 완료!</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
          <div style="background:rgba(255,255,255,0.2);border-radius:10px;padding:12px 8px">
            <div style="font-size:0.68rem;opacity:0.85;margin-bottom:4px">출근</div>
            <div style="font-weight:700;font-size:1rem">${today.checkIn.time}</div>
          </div>
          <div style="background:rgba(255,255,255,0.2);border-radius:10px;padding:12px 8px">
            <div style="font-size:0.68rem;opacity:0.85;margin-bottom:4px">퇴근</div>
            <div style="font-weight:700;font-size:1rem">${today.checkOut.time}</div>
          </div>
          <div style="background:rgba(255,255,255,0.2);border-radius:10px;padding:12px 8px">
            <div style="font-size:0.68rem;opacity:0.85;margin-bottom:4px">총 근무</div>
            <div style="font-weight:700;font-size:0.88rem">${hrs}</div>
          </div>
        </div>
        ${today.checkIn.address ? `<div style="font-size:0.72rem;opacity:0.75;margin-top:12px">📍 ${today.checkIn.address}</div>` : ''}
      </div>`;
  }

  if (isWorking) {
    return `
      <div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);
                  border-radius:16px;padding:28px 24px;color:#fff;text-align:center">
        <div style="font-size:0.82rem;opacity:0.8;margin-bottom:4px">출근 완료 ✅</div>
        <div style="font-weight:700;font-size:1rem;margin-bottom:4px">${today.checkIn.time} 출근</div>
        ${today.checkIn.address ? `<div style="font-size:0.72rem;opacity:0.75;margin-bottom:16px">📍 ${today.checkIn.address}</div>` : '<div style="margin-bottom:16px"></div>'}
        <div style="background:rgba(255,255,255,0.15);border-radius:12px;padding:14px;margin-bottom:20px">
          <div style="font-size:0.7rem;opacity:0.8;margin-bottom:4px">⏱ 현재 근무 시간</div>
          <div id="work-timer" style="font-size:2rem;font-weight:700;font-family:monospace;letter-spacing:2px">
            ${elapsed(today.checkIn.ts)}
          </div>
        </div>
        <button id="checkout-btn"
          style="width:100%;padding:15px;background:var(--card-bg);color:#4F46E5;border:none;
                 border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;
                 box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:opacity 0.15s">
          퇴근하기 →
        </button>
      </div>`;
  }

  // 출근 전
  return `
    <div style="background:var(--surface);border:2px dashed var(--border);
                border-radius:16px;padding:32px 24px;text-align:center">
      <div style="font-size:2.6rem;margin-bottom:12px">📍</div>
      <div style="font-weight:700;font-size:1rem;color:var(--text);margin-bottom:6px">아직 출근하지 않았습니다</div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:24px;line-height:1.6">
        버튼을 누르면 현재 위치를 확인하여<br>출근 시간이 기록됩니다
      </div>
      <button id="checkin-btn"
        style="width:100%;padding:16px;
               background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);
               color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:700;
               cursor:pointer;box-shadow:0 4px 16px rgba(79,70,229,0.35);
               transition:opacity 0.15s;display:flex;align-items:center;
               justify-content:center;gap:8px">
        <span style="font-size:1.2rem">📍</span> 출근하기
      </button>
      <div style="font-size:0.68rem;color:var(--text-muted);margin-top:10px">
        위치 정보 접근 권한이 필요합니다
      </div>
    </div>`;
}

function renderWeekCard() {
  const days     = demoWeek();
  const DOW      = ['월', '화', '수', '목', '금'];
  const today    = todayKey();

  return `
    <div class="card" style="padding:16px">
      <div style="font-weight:700;font-size:0.88rem;margin-bottom:12px">📅 이번 주 출근 현황</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${days.map((d, i) => {
          const isToday  = d.date === today;
          const isFuture = d.isFuture;
          const hasCi    = !!d.checkIn;
          const hasCo    = !!d.checkOut;
          const inTime   = d.checkIn?.time  || '—';
          const outTime  = d.checkOut?.time || (hasCi ? '근무 중' : '—');
          const hrs      = hasCi && hasCo ? workHoursLabel(d.checkIn.ts, d.checkOut.ts) : '';
          const dot      = isFuture ? '○' : hasCo ? '✅' : hasCi ? '⏳' : '○';
          const dotColor = isFuture ? '#CBD5E1' : hasCo ? '#10B981' : hasCi ? '#F59E0B' : '#CBD5E1';
          const rowBg    = isToday ? 'background:var(--primary-light,#EEF2FF);border:1px solid var(--primary)' : 'background:var(--surface);border:1px solid var(--border)';

          return `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;
                        border-radius:10px;${rowBg}">
              <div style="width:28px;height:28px;border-radius:50%;
                          background:${dotColor}22;display:flex;align-items:center;
                          justify-content:center;font-size:0.9rem;flex-shrink:0">
                ${dot}
              </div>
              <div style="flex-shrink:0;min-width:20px">
                <div style="font-size:0.85rem;font-weight:${isToday ? '700' : '500'};
                            color:${isToday ? 'var(--primary)' : 'var(--text)'}">
                  ${DOW[i]}
                </div>
              </div>
              <div style="flex:1;min-width:0">
                ${isFuture ? `<span style="font-size:0.75rem;color:var(--text-muted)">예정</span>` :
                  !hasCi    ? `<span style="font-size:0.75rem;color:var(--text-muted)">미출근</span>` : `
                  <div style="display:flex;align-items:center;gap:6px;font-size:0.78rem;color:var(--text)">
                    <span>${inTime}</span>
                    <span style="color:var(--text-muted)">→</span>
                    <span style="color:${hasCo ? 'var(--text)' : '#F59E0B'}">${outTime}</span>
                  </div>`}
              </div>
              ${hrs ? `<div style="font-size:0.72rem;font-weight:600;color:var(--text-muted);flex-shrink:0">${hrs}</div>` : ''}
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

function renderWeeklyGauge() {
  try {
    const monday   = thisWeekMonday();
    const days     = getWeekClassified(monday);
    const summary  = weekSummary(days);
    // Fallback: estimate from demoWeek if no real records
    const total    = summary.weekTotal || _estimateWeekHours();
    const overtime = summary.weekOvertime || Math.max(0, total - 40);
    const night    = summary.weekNight   || 0;
    const pct      = Math.min(100, Math.round((total / WEEKLY_LIMIT) * 100));
    const isOver   = total > WEEKLY_LIMIT;
    const isWarn   = !isOver && total > 48;
    const barColor = isOver ? '#EF4444' : isWarn ? '#F59E0B' : '#4F46E5';
    const badge    = isOver
      ? `<span style="background:#FEE2E2;color:#DC2626;font-size:11px;padding:3px 8px;border-radius:20px;font-weight:600">52h 초과</span>`
      : isWarn
      ? `<span style="background:#FEF3C7;color:#D97706;font-size:11px;padding:3px 8px;border-radius:20px;font-weight:600">주의</span>`
      : '';

    return `<div class="card" style="padding:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-weight:700;font-size:0.88rem">⏱️ 이번 주 근무시간</div>
        ${badge}
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <div style="flex:1">
          <div style="height:10px;background:var(--border);border-radius:5px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${barColor};border-radius:5px;transition:width .5s"></div>
          </div>
        </div>
        <span style="font-size:16px;font-weight:800;color:${barColor};white-space:nowrap">${total.toFixed(1)}h</span>
      </div>
      <div style="display:flex;gap:16px;font-size:12px;color:var(--text-muted)">
        <span>소정 40h</span>
        <span style="color:#F59E0B">연장 ${overtime.toFixed(1)}h</span>
        <span style="color:#6366F1">야간 ${night.toFixed(1)}h</span>
        <span style="margin-left:auto">한도 ${WEEKLY_LIMIT}h</span>
      </div>
    </div>`;
  } catch { return ''; }
}

function _estimateWeekHours() {
  // 데모 주간 시간 추정 (demoWeek 기반)
  const days = demoWeek();
  return days.reduce((s, d) => {
    if (d.checkIn?.ts && d.checkOut?.ts) {
      return s + Math.max(0, (d.checkOut.ts - d.checkIn.ts) / 3_600_000);
    }
    return s;
  }, 0);
}

function renderMonthStats() {
  const now   = new Date();
  const month = now.getMonth();
  const year  = now.getFullYear();

  // Count real + demo records for this month
  const allRec = getRecords().filter(r => {
    const d = new Date(r.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  // Estimate total work days in month (weekdays up to today)
  let workdays = 0;
  for (let d = 1; d <= now.getDate(); d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow !== 0 && dow !== 6) workdays++;
  }

  // Use demo: assume 80% attendance for days without real data
  const demoCount  = Math.max(workdays - allRec.length, 0);
  const demoAttend = Math.round(demoCount * 0.92);
  const totalAttend = allRec.length + demoAttend;

  const avgMinutes = 9 * 60 + Math.floor(Math.random() * 60); // ~9h avg
  const avgLabel   = `${Math.floor(avgMinutes / 60)}시간 ${avgMinutes % 60}분`;

  const attendPct = workdays > 0 ? Math.min(100, Math.round((totalAttend / workdays) * 100)) : 0;

  return `
    <div class="card" style="padding:16px">
      <div style="font-weight:700;font-size:0.88rem;margin-bottom:12px">
        📊 ${now.getMonth() + 1}월 근태 현황
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px">
        <div style="text-align:center;padding:12px 6px;background:var(--surface);border-radius:10px">
          <div style="font-size:1.4rem;font-weight:800;color:var(--primary)">${totalAttend}</div>
          <div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px">출근일</div>
        </div>
        <div style="text-align:center;padding:12px 6px;background:var(--surface);border-radius:10px">
          <div style="font-size:1.4rem;font-weight:800;color:var(--success)">${attendPct}%</div>
          <div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px">출근률</div>
        </div>
        <div style="text-align:center;padding:12px 6px;background:var(--surface);border-radius:10px">
          <div style="font-size:1rem;font-weight:700;color:var(--text)">${avgLabel}</div>
          <div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px">평균 근무</div>
        </div>
      </div>
      <!-- 출근률 바 -->
      <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${attendPct}%;background:var(--success);
                    border-radius:3px;transition:width 0.6s ease"></div>
      </div>
      <div style="font-size:0.7rem;color:var(--text-muted);margin-top:5px">
        이번 달 영업일 ${workdays}일 기준
      </div>
    </div>`;
}

// ── 타이머 ──────────────────────────────────────────────────

function startTimer(root, fromTs) {
  clearInterval(_timerID);
  _timerID = setInterval(() => {
    const el = root.querySelector('#work-timer');
    if (el) el.textContent = elapsed(fromTs);
    else clearInterval(_timerID);
  }, 1000);
}

// ── 이벤트 바인딩 ────────────────────────────────────────────

function bindEvents(root) {
  // 출근하기
  root.querySelector('#checkin-btn')?.addEventListener('click', async () => {
    const btn = root.querySelector('#checkin-btn');
    if (btn) {
      btn.disabled  = true;
      btn.innerHTML = '<span style="font-size:1.2rem">📡</span> 위치 확인 중...';
      btn.style.opacity = '0.7';
    }

    try {
      let address = '위치 확인됨';
      let lat = null, lng = null;

      try {
        const pos = await getPosition();
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        address = await resolveAddress(lat, lng);
      } catch (e) {
        // Geolocation denied or unsupported — record without location
        address = '위치 정보 없음';
      }

      const now   = Date.now();
      const time  = fmt(now);
      const rec   = upsertToday({
        checkIn: { ts: now, time, address, lat, lng },
      });

      showToast(`출근 완료! ${time} · ${address} 📍`, 'success')
    addNotification({ type: 'success', title: '출근 체크인', body: '출근 완료!  ·  📍' });
      render(root); // Re-render with working state
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span style="font-size:1.2rem">📍</span> 출근하기';
        btn.style.opacity = '1';
      }
      showToast('출근 기록 중 오류가 발생했습니다.', 'error');
    }
  });

  // 퇴근하기
  root.querySelector('#checkout-btn')?.addEventListener('click', async () => {
    const btn = root.querySelector('#checkout-btn');
    if (btn) {
      btn.disabled  = true;
      btn.textContent = '위치 확인 중...';
      btn.style.opacity = '0.7';
    }

    let address = '위치 확인됨';
    try {
      const pos = await getPosition();
      address = await resolveAddress(pos.coords.latitude, pos.coords.longitude);
    } catch { address = '위치 정보 없음'; }

    const now  = Date.now();
    const time = fmt(now);
    const rec  = getToday();
    upsertToday({ checkOut: { ts: now, time, address } });

    clearInterval(_timerID);
    const hrs = rec?.checkIn ? workHoursLabel(rec.checkIn.ts, now) : '';
    showToast(`퇴근 완료! ${time}${hrs ? ' · ' + hrs + ' 근무' : ''} 🏠`, 'success')
    addNotification({ type: 'success', title: '출근 체크인', body: '퇴근 완료!  🏠' });
    render(root);
  });
}

// ── Public API ───────────────────────────────────────────────

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _root = root;
  render(root);
}

export function unmount() {
  clearInterval(_timerID);
  _timerID = null;
  _root    = null;
}
