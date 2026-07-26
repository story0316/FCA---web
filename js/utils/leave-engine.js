/**
 * leave-engine.js — 연차·휴가 계산 순수 함수 + 데이터 헬퍼
 */

import { LEAVE_TYPES, LEAVE_TYPE_MAP } from '../data/leave-types.js';

// ── 순수 계산 함수 ─────────────────────────────────────────────

/**
 * 근속 연수 (년 단위, 소수 가능)
 * @param {string} hireDateStr  'YYYY-MM-DD'
 * @param {Date|string} [asOf]  기준일 (기본: 오늘)
 * @returns {number}
 */
export function yearsOfService(hireDateStr, asOf = new Date()) {
  const hire = new Date(hireDateStr);
  const ref  = new Date(asOf);
  let years = ref.getFullYear() - hire.getFullYear();
  const mDiff = ref.getMonth() - hire.getMonth();
  if (mDiff < 0 || (mDiff === 0 && ref.getDate() < hire.getDate())) years--;
  return Math.max(0, years);
}

/**
 * 연차 발생 일수 (근로기준법 §60)
 *  - 1년 미만: 월 1일씩 최대 11일
 *  - 1년 이상: 15일 기본, 2년마다 1일 가산 (최대 25일)
 */
export function calcAnnualEntitlement(hireDateStr, asOf = new Date()) {
  const yrs = yearsOfService(hireDateStr, asOf);
  if (yrs < 1) return calcFirstYearAccrual(hireDateStr, asOf);
  return Math.min(25, 15 + Math.floor((yrs - 1) / 2));
}

/**
 * 1년 미만 월별 발생 (만 1개월 근무마다 1일, 최대 11일)
 */
export function calcFirstYearAccrual(hireDateStr, asOf = new Date()) {
  const hire = new Date(hireDateStr);
  const ref  = new Date(asOf);
  let months = (ref.getFullYear() - hire.getFullYear()) * 12 + (ref.getMonth() - hire.getMonth());
  if (ref.getDate() < hire.getDate()) months--;
  return Math.max(0, Math.min(11, months));
}

/**
 * 두 날짜 사이 영업일 수 (시작~종료 포함)
 */
export function businessDays(startStr, endStr) {
  let count = 0;
  const cur = new Date(startStr);
  const end = new Date(endStr);
  cur.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * 반차 포함 실제 차감 일수
 *  - type 'half' → 0.5
 *  - 나머지 → businessDays(start, end)
 */
export function calcDeductDays(leaveType, startStr, endStr) {
  if (leaveType === 'half') return 0.5;
  return businessDays(startStr, endStr);
}

// ── 데모 데이터 ───────────────────────────────────────────────

const DEMO_HIRE_DATE = '2024-03-15';
const DEMO_USER_ID   = 'demo';

function _today() {
  return new Date().toISOString().slice(0, 10);
}

const DEMO_REQUESTS = [
  {
    id: 'lr001', userId: 'demo', type: 'annual', status: 'approved',
    startDate: '2026-01-02', endDate: '2026-01-03', days: 2,
    reason: '신정 연휴 연장', createdAt: '2025-12-20',
  },
  {
    id: 'lr002', userId: 'demo', type: 'annual', status: 'approved',
    startDate: '2026-02-27', endDate: '2026-02-27', days: 1,
    reason: '개인 사유', createdAt: '2026-02-20',
  },
  {
    id: 'lr003', userId: 'demo', type: 'half', status: 'approved',
    startDate: '2026-03-14', endDate: '2026-03-14', days: 0.5,
    reason: '오전 반차', createdAt: '2026-03-10',
  },
  {
    id: 'lr004', userId: 'demo', type: 'sick', status: 'approved',
    startDate: '2026-04-10', endDate: '2026-04-10', days: 1,
    reason: '감기', createdAt: '2026-04-10',
  },
  {
    id: 'lr005', userId: 'demo', type: 'annual', status: 'pending',
    startDate: '2026-06-20', endDate: '2026-06-20', days: 1,
    reason: '개인 용무', createdAt: '2026-06-01',
  },
];

const DEMO_ADMIN_REQUESTS = [
  {
    id: 'lr010', userId: 'user1', userName: '김지수', type: 'annual', status: 'pending',
    startDate: '2026-06-10', endDate: '2026-06-12', days: 3,
    reason: '여름 휴가', createdAt: '2026-06-02',
  },
  {
    id: 'lr011', userId: 'user2', userName: '이민준', type: 'half', status: 'pending',
    startDate: '2026-06-09', endDate: '2026-06-09', days: 0.5,
    reason: '오후 반차 – 병원', createdAt: '2026-06-03',
  },
  {
    id: 'lr012', userId: 'user3', userName: '박서연', type: 'family', status: 'pending',
    startDate: '2026-06-15', endDate: '2026-06-16', days: 2,
    reason: '가족 경조사', createdAt: '2026-06-03',
  },
];

// ── localStorage I/O ───────────────────────────────────────────

const LS_REQUESTS   = 'hr_leave_requests';
const LS_POLICIES   = 'hr_leave_policies';

function _seed(key, value) {
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

function _ensureDemo() {
  _seed(LS_REQUESTS, DEMO_REQUESTS);
}

export function getLeaveRequests(userId = null) {
  _ensureDemo();
  const all = JSON.parse(localStorage.getItem(LS_REQUESTS) || '[]');
  if (!userId) return all;
  return all.filter(r => r.userId === userId);
}

export function getAllLeaveRequests() {
  _ensureDemo();
  const own  = JSON.parse(localStorage.getItem(LS_REQUESTS) || '[]');
  const admin = JSON.parse(localStorage.getItem('hr_admin_leave_requests') || 'null');
  if (!admin) {
    localStorage.setItem('hr_admin_leave_requests', JSON.stringify(DEMO_ADMIN_REQUESTS));
    return [...own, ...DEMO_ADMIN_REQUESTS];
  }
  return [...own, ...admin];
}

export function saveLeaveRequest(req) {
  _ensureDemo();
  const all = JSON.parse(localStorage.getItem(LS_REQUESTS) || '[]');
  const idx = all.findIndex(r => r.id === req.id);
  if (idx >= 0) all[idx] = req;
  else all.push(req);
  localStorage.setItem(LS_REQUESTS, JSON.stringify(all));
}

export function updateRequestStatus(reqId, status, reviewNote = '') {
  // Check own requests first
  const own = JSON.parse(localStorage.getItem(LS_REQUESTS) || '[]');
  const oi  = own.findIndex(r => r.id === reqId);
  if (oi >= 0) {
    own[oi] = { ...own[oi], status, reviewNote, reviewedAt: _today() };
    localStorage.setItem(LS_REQUESTS, JSON.stringify(own));
    return;
  }
  // Admin list
  const adm = JSON.parse(localStorage.getItem('hr_admin_leave_requests') || JSON.stringify(DEMO_ADMIN_REQUESTS));
  const ai  = adm.findIndex(r => r.id === reqId);
  if (ai >= 0) {
    adm[ai] = { ...adm[ai], status, reviewNote, reviewedAt: _today() };
    localStorage.setItem('hr_admin_leave_requests', JSON.stringify(adm));
  }
}

export function cancelLeaveRequest(reqId) {
  updateRequestStatus(reqId, 'cancelled');
}

/**
 * 사용자의 연차 현황 집계
 */
export function getLeaveBalance(userId = DEMO_USER_ID, hireDateStr = DEMO_HIRE_DATE) {
  const entitlement = calcAnnualEntitlement(hireDateStr);
  const requests = getLeaveRequests(userId);
  const usedAnnual = requests
    .filter(r => (r.type === 'annual' || r.type === 'half') &&
                 (r.status === 'approved' || r.status === 'pending'))
    .reduce((s, r) => s + (r.days || 0), 0);
  return {
    entitlement,
    used:      usedAnnual,
    pending:   requests.filter(r => r.status === 'pending').length,
    remaining: Math.max(0, entitlement - usedAnnual),
    hireDate:  hireDateStr,
    years:     yearsOfService(hireDateStr),
  };
}

export function getLeavePolicy() {
  return JSON.parse(localStorage.getItem(LS_POLICIES) || 'null') || {
    allowHalfDay:       true,
    requireReason:      true,
    minAdvanceDays:     1,
    maxConsecutiveDays: 15,
    annualResetMonth:   1,
  };
}
