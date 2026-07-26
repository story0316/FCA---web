/**
 * workhours-engine.js — 연장·야간·휴일 근로 분류 + 주 52h 집계
 * 근로기준법 §53·56 기준
 */

// ── 상수 ──────────────────────────────────────────────────────
export const WEEKLY_LIMIT      = 52;   // 주 최대 근로 시간
export const WEEKLY_STD        = 40;   // 주 소정 근로 시간
export const DAILY_STD         = 8;    // 일 소정 근로 시간
export const OVERTIME_RATE     = 1.5;  // 연장 50% 가산
export const NIGHT_RATE        = 0.5;  // 야간 추가 50% 가산 (연장 중복 가능)
export const HOLIDAY_RATE_LOW  = 1.5;  // 휴일 8h 이내
export const HOLIDAY_RATE_HIGH = 2.0;  // 휴일 8h 초과

const NIGHT_START = 22; // 22:00
const NIGHT_END   =  6; // 06:00 (다음날)

// ── 순수 계산 ─────────────────────────────────────────────────

/**
 * 두 타임스탬프 사이 실 근로 시간 (소수, 시간 단위)
 */
export function calcWorkHours(inTs, outTs) {
  return Math.max(0, (outTs - inTs) / 3_600_000);
}

/**
 * 야간 근로 시간 (22:00~06:00 구간) 계산
 */
export function calcNightHours(inTs, outTs) {
  const totalMs = outTs - inTs;
  if (totalMs <= 0) return 0;

  let nightMs = 0;
  let cur = inTs;
  const end = outTs;

  // 1분 단위로 순회하면 느리므로 구간 분할 방식으로 계산
  const inDate  = new Date(inTs);
  const outDate = new Date(outTs);

  // 각 날짜에 대해 야간 구간(22~24, 0~6) 겹침 계산
  const daySet = new Set();
  const d = new Date(inDate);
  d.setHours(0, 0, 0, 0);
  while (d.getTime() <= outDate.getTime()) {
    daySet.add(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }

  for (const dateStr of daySet) {
    // 22:00 ~ 24:00 구간
    const n1s = new Date(dateStr + 'T22:00:00').getTime();
    const n1e = new Date(dateStr + 'T23:59:59.999').getTime() + 1;
    nightMs += Math.max(0, Math.min(end, n1e) - Math.max(cur, n1s));
    // 00:00 ~ 06:00 구간
    const n2s = new Date(dateStr + 'T00:00:00').getTime();
    const n2e = new Date(dateStr + 'T06:00:00').getTime();
    nightMs += Math.max(0, Math.min(end, n2e) - Math.max(cur, n2s));
  }

  return Math.max(0, nightMs / 3_600_000);
}

/**
 * 요일 기반 휴일 여부 (토·일)
 */
export function isHoliday(dateStr) {
  const d = new Date(dateStr).getDay();
  return d === 0 || d === 6;
}

/**
 * 일별 근로 분류
 * @returns {{ total, overtime, night, holiday, regular }}
 */
export function classifyDayHours(dateStr, inTs, outTs) {
  const total   = calcWorkHours(inTs, outTs);
  const night   = calcNightHours(inTs, outTs);
  const holiday = isHoliday(dateStr);

  if (holiday) {
    return { total, regular: 0, overtime: 0, night, holiday: total };
  }
  const regular  = Math.min(DAILY_STD, total);
  const overtime = Math.max(0, total - DAILY_STD);
  return { total, regular, overtime, night, holiday: 0 };
}

/**
 * 주간 기록 배열 → 주 52h 집계
 * @param {Array<{date,total,regular,overtime,night,holiday}>} days
 * @returns {{ weekTotal, weekOvertime, weekNight, weekHoliday, isOver52 }}
 */
export function weekSummary(days) {
  const weekTotal    = days.reduce((s, d) => s + d.total,    0);
  const weekOvertime = days.reduce((s, d) => s + d.overtime, 0);
  const weekNight    = days.reduce((s, d) => s + d.night,    0);
  const weekHoliday  = days.reduce((s, d) => s + d.holiday,  0);
  return {
    weekTotal: +weekTotal.toFixed(2),
    weekOvertime: +weekOvertime.toFixed(2),
    weekNight:    +weekNight.toFixed(2),
    weekHoliday:  +weekHoliday.toFixed(2),
    isOver52: weekTotal > WEEKLY_LIMIT,
  };
}

// ── localStorage 헬퍼 ─────────────────────────────────────────

const LS_ATT = 'hr_attendance';

export function getAttendanceRecords() {
  try { return JSON.parse(localStorage.getItem(LS_ATT) || '[]'); } catch { return []; }
}

/**
 * 특정 주의 출퇴근 기록을 분류 요약으로 변환
 * @param {string} weekMonday  'YYYY-MM-DD' (월요일)
 */
export function getWeekClassified(weekMonday) {
  const records = getAttendanceRecords();
  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(weekMonday);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const rec = records.find(r => r.date === dateStr);
    if (rec?.checkIn?.ts && rec?.checkOut?.ts) {
      days.push({
        date: dateStr,
        ...classifyDayHours(dateStr, rec.checkIn.ts, rec.checkOut.ts),
      });
    } else if (rec?.checkIn?.ts) {
      const now = Date.now();
      days.push({
        date: dateStr,
        ...classifyDayHours(dateStr, rec.checkIn.ts, now),
        inProgress: true,
      });
    }
  }
  return days;
}

/**
 * 이번 주 월요일 날짜 문자열
 */
export function thisWeekMonday() {
  const d = new Date();
  const day = d.getDay(); // 0=일
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
