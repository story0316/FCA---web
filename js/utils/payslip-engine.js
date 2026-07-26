/**
 * payslip-engine.js — 임금 계산 엔진
 * 근로기준법 §48 임금명세서 항목 기준
 */

// ── 4대 보험 요율 (2026 기준) ─────────────────────────────────
const INSURANCE_RATES = {
  pension:        0.045,    // 국민연금 (근로자 부담)
  health:         0.03545,  // 건강보험
  longCare:       0.004591, // 장기요양 (건강보험료의 12.95%)
  employment:     0.009,    // 고용보험
};

// ── 데모 급여 데이터 ──────────────────────────────────────────

const DEMO_SALARY = {
  userId:        'demo',
  effectiveDate: '2024-03-15',
  baseSalary:    3_000_000,
  allowances: [
    { id: 'position', label: '직책수당',   amount: 200_000, isFixed: true },
    { id: 'meal',     label: '식대보조금', amount: 100_000, isFixed: true },
  ],
};

const DEMO_PAYSLIPS_KEY = 'hr_payslips';

function _demoPayslips() {
  const now = new Date();
  const slips = [];
  for (let i = 1; i <= 5; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year  = d.getFullYear();
    const month = d.getMonth() + 1;
    const ovt   = i === 2 ? 12 : i === 3 ? 6 : 0;
    const slip  = buildPayslip('demo', year, month, 176, ovt, 0, 0, DEMO_SALARY);
    slip.issuedAt = new Date(year, month, 1).toISOString();
    slip.confirmedByEmployee = true;
    slips.push(slip);
  }
  return slips;
}

function _ensureDemo() {
  if (!localStorage.getItem(DEMO_PAYSLIPS_KEY)) {
    localStorage.setItem(DEMO_PAYSLIPS_KEY, JSON.stringify(_demoPayslips()));
  }
}

// ── 순수 계산 ─────────────────────────────────────────────────

/**
 * 시간급 계산 (통상임금 기준)
 * 월 소정근로시간 = 209시간 (주 40h + 주휴 8h) × 4.345주
 */
export function calcHourlyRate(baseSalary) {
  return Math.round(baseSalary / 209);
}

/**
 * 연장근로수당 (50% 가산)
 */
export function calcOvertimePay(baseSalary, overtimeHours) {
  return Math.round(calcHourlyRate(baseSalary) * 1.5 * overtimeHours);
}

/**
 * 야간근로 추가 수당 (50% 가산, 연장 중복)
 */
export function calcNightPay(baseSalary, nightHours) {
  return Math.round(calcHourlyRate(baseSalary) * 0.5 * nightHours);
}

/**
 * 휴일근로수당 (8h 이내 50%, 초과 100% 가산)
 */
export function calcHolidayPay(baseSalary, holidayHours) {
  const low  = Math.min(8, holidayHours);
  const high = Math.max(0, holidayHours - 8);
  const rate = calcHourlyRate(baseSalary);
  return Math.round(rate * 1.5 * low + rate * 2.0 * high);
}

/**
 * 4대보험 + 소득세 공제액 계산
 */
export function calcDeductions(grossPay) {
  const pension    = Math.round(grossPay * INSURANCE_RATES.pension);
  const health     = Math.round(grossPay * INSURANCE_RATES.health);
  const longCare   = Math.round(health   * (12.95 / 100));
  const employment = Math.round(grossPay * INSURANCE_RATES.employment);
  // 소득세: 간이세액표 근사 (총급여 기준 구간)
  const incomeTax  = _incomeTaxApprox(grossPay);
  const localTax   = Math.round(incomeTax * 0.1);
  const total      = pension + health + longCare + employment + incomeTax + localTax;
  return {
    items: [
      { id: 'pension',    label: '국민연금',    amount: pension },
      { id: 'health',     label: '건강보험',    amount: health },
      { id: 'longCare',   label: '장기요양',    amount: longCare },
      { id: 'employment', label: '고용보험',    amount: employment },
      { id: 'incomeTax',  label: '소득세',      amount: incomeTax },
      { id: 'localTax',   label: '지방소득세',  amount: localTax },
    ],
    total,
  };
}

function _incomeTaxApprox(gross) {
  // 간이세액표 근사 (단순 구간)
  if (gross <= 1_060_000)  return 0;
  if (gross <= 1_500_000)  return Math.round((gross - 1_060_000) * 0.06);
  if (gross <= 3_000_000)  return 26_400 + Math.round((gross - 1_500_000) * 0.15);
  if (gross <= 4_500_000)  return 251_400 + Math.round((gross - 3_000_000) * 0.24);
  return 611_400 + Math.round((gross - 4_500_000) * 0.35);
}

/**
 * 임금명세서 객체 생성
 */
export function buildPayslip(userId, year, month, normalHours, overtimeHours, nightHours, holidayHours, salaryRecord) {
  const base    = salaryRecord.baseSalary;
  const allAmt  = (salaryRecord.allowances || []).reduce((s, a) => s + a.amount, 0);
  const ovtPay  = calcOvertimePay(base, overtimeHours);
  const nigPay  = calcNightPay(base, nightHours);
  const holPay  = calcHolidayPay(base, holidayHours);
  const grossPay = base + allAmt + ovtPay + nigPay + holPay;
  const deductions = calcDeductions(grossPay);
  const netPay  = grossPay - deductions.total;

  return {
    id:          `PS_${year}_${String(month).padStart(2,'0')}_${userId}`,
    userId,
    year,
    month,
    normalHours,
    overtimeHours,
    nightHours,
    holidayHours,
    baseSalary:  base,
    allowances:  salaryRecord.allowances || [],
    overtimePay: ovtPay,
    nightPay:    nigPay,
    holidayPay:  holPay,
    grossPay,
    deductions:  deductions.items,
    totalDeduction: deductions.total,
    netPay,
    issuedAt:    null,
    confirmedByEmployee: false,
  };
}

// ── 데이터 I/O ────────────────────────────────────────────────

export function getPayslips(userId = 'demo') {
  _ensureDemo();
  const all = JSON.parse(localStorage.getItem(DEMO_PAYSLIPS_KEY) || '[]');
  return all.filter(p => p.userId === userId).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
}

export function getAllPayslips() {
  _ensureDemo();
  return JSON.parse(localStorage.getItem(DEMO_PAYSLIPS_KEY) || '[]');
}

export function savePayslip(slip) {
  _ensureDemo();
  const all = JSON.parse(localStorage.getItem(DEMO_PAYSLIPS_KEY) || '[]');
  const idx = all.findIndex(p => p.id === slip.id);
  if (idx >= 0) all[idx] = slip;
  else all.push(slip);
  localStorage.setItem(DEMO_PAYSLIPS_KEY, JSON.stringify(all));
}

export function getSalaryRecord(userId = 'demo') {
  const records = JSON.parse(localStorage.getItem('hr_salary_records') || '[]');
  return records.find(r => r.userId === userId) || DEMO_SALARY;
}

export function fmtKRW(n) {
  return (n || 0).toLocaleString('ko-KR') + '원';
}
