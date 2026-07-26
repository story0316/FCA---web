/**
 * salary-calc.js — 급여 계산기 (통상임금 · 평균임금 · 퇴직금)
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const MODES = [
  { id: 'ordinary', label: '통상임금', icon: '💵', desc: '시급·연장·야간수당 기준' },
  { id: 'average',  label: '평균임금', icon: '📊', desc: '퇴직·휴업·재해 보상 기준' },
  { id: 'severance',label: '퇴직금',  icon: '🏦', desc: '법정 퇴직금 예상액 계산' },
];

let _mode = 'ordinary';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _render(root);
}

export function unmount() { _mode = 'ordinary'; }

function _render(root) {
  root.innerHTML = `
<div class="page" style="background:var(--bg)">
  <div class="top-bar">
    <button class="btn btn-ghost btn-sm" onclick="window.navBack()" style="padding:8px;min-height:40px">←</button>
    <div class="top-bar-title" style="flex:1;text-align:center">💵 급여 계산기</div>
  </div>

  <div class="page-content" style="padding:16px">

    <!-- 모드 선택 -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px">
      ${MODES.map(m => `
      <button class="calc-mode-btn ${_mode===m.id?'active':''}" data-mode="${m.id}"
        style="border:2px solid ${_mode===m.id?'#4F46E5':'var(--border)'};border-radius:12px;
               padding:12px 8px;cursor:pointer;text-align:center;font-size:12px;
               background:${_mode===m.id?'#EEF2FF':'var(--card-bg)'};
               color:${_mode===m.id?'#4338CA':'var(--text)'};transition:all .15s">
        <div style="font-size:22px;margin-bottom:4px">${m.icon}</div>
        <div style="font-weight:700;font-size:13px">${m.label}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${m.desc}</div>
      </button>`).join('')}
    </div>

    <!-- 계산 폼 -->
    <div id="calc-form"></div>

    <!-- 결과 -->
    <div id="calc-result" style="display:none;background:linear-gradient(135deg,#4F46E5,#7C3AED);
         border-radius:16px;padding:20px;color:#fff;margin-top:20px">
    </div>

    <!-- 면책 -->
    <div style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:16px;line-height:1.6">
      본 계산기는 일반적인 법령 기준에 따른 예시입니다.<br>
      정확한 산정은 전문 노무사 확인을 권장합니다.
    </div>

  </div>
</div>`;

  root.querySelectorAll('.calc-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _mode = btn.dataset.mode;
      _render(root);
    });
  });

  const form = root.querySelector('#calc-form');
  if (_mode === 'ordinary') _renderOrdinaryForm(form, root);
  if (_mode === 'average')  _renderAverageForm(form, root);
  if (_mode === 'severance') _renderSeveranceForm(form, root);
}

function _card(label, fields) {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px">
  <div style="font-size:13px;font-weight:700;margin-bottom:12px;color:var(--text)">${label}</div>
  ${fields}
</div>`;
}

function _field(id, label, value, unit='원', type='number') {
  return `
<div style="margin-bottom:10px">
  <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">${label}</label>
  <div style="display:flex;align-items:center;gap:6px">
    <input id="${id}" type="${type}" value="${value}" min="0"
      style="flex:1;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:14px;background:var(--bg);color:var(--text);box-sizing:border-box">
    <span style="font-size:12px;color:var(--text-muted);flex-shrink:0">${unit}</span>
  </div>
</div>`;
}

function _resultRow(label, value, highlight=false) {
  return `<div style="display:flex;justify-content:space-between;align-items:center;
    padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.15)">
    <span style="font-size:13px;opacity:${highlight?'1':'0.8'};font-weight:${highlight?'700':'400'}">${label}</span>
    <span style="font-size:${highlight?'18px':'13px'};font-weight:700">${value}</span>
  </div>`;
}

function _fmt(n) {
  return Math.round(n).toLocaleString('ko-KR') + '원';
}

// ── 통상임금 ─────────────────────────────────────────────────

function _renderOrdinaryForm(container, root) {
  container.innerHTML = `
${_card('📌 임금 구성', `
  ${_field('base-pay',    '기본급',           3000000)}
  ${_field('meal-allow',  '식대 (고정)',       100000)}
  ${_field('job-allow',   '직책·직무수당',     100000)}
  ${_field('transport',   '교통비 (고정)',      50000)}
  ${_field('other-fixed', '기타 고정수당',          0)}
`)}
${_card('⏰ 근로 조건', `
  ${_field('weekly-hrs',  '소정근로시간 (주)',   40, '시간')}
  ${_field('monthly-hrs', '월 통상임금 환산시간 (기본 209h)', 209, '시간')}
`)}
<button id="calc-btn" class="btn btn-primary" style="width:100%;margin-top:4px">계산하기</button>`;

  container.querySelector('#calc-btn').addEventListener('click', () => {
    const g = id => parseFloat(root.querySelector(`#${id}`)?.value || 0);
    const ordinary = g('base-pay') + g('meal-allow') + g('job-allow') + g('transport') + g('other-fixed');
    const monthHrs = g('monthly-hrs') || 209;
    const hourly   = ordinary / monthHrs;
    const overtime = hourly * 1.5;
    const night    = hourly * 0.5;
    const holiday8 = hourly * 1.5;

    const res = root.querySelector('#calc-result');
    res.style.display = '';
    res.innerHTML = `
      <div style="font-size:14px;font-weight:700;margin-bottom:12px;opacity:0.9">📊 통상임금 계산 결과</div>
      ${_resultRow('통상임금 (월)', _fmt(ordinary), true)}
      ${_resultRow('통상 시급 (÷' + monthHrs + 'h)', _fmt(hourly))}
      ${_resultRow('연장근로 시급 (×1.5)', _fmt(overtime))}
      ${_resultRow('야간 가산 시급 (×0.5)', _fmt(night))}
      ${_resultRow('휴일근로 시급 8h 이내 (×1.5)', _fmt(holiday8))}
      <div style="font-size:11px;opacity:0.7;margin-top:10px;line-height:1.6">
        * 식대·교통비는 전 근로자 일률 지급 고정분만 포함<br>
        * 월 통상임금 환산 시간: 주40h → (40+주휴8)×(365/7÷12) ≈ 209h
      </div>`;
    res.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

// ── 평균임금 ─────────────────────────────────────────────────

function _renderAverageForm(container, root) {
  container.innerHTML = `
${_card('📅 퇴직 전 3개월 임금', `
  ${_field('m1-wage', '1개월 전 총 임금',  3200000)}
  ${_field('m2-wage', '2개월 전 총 임금',  3100000)}
  ${_field('m3-wage', '3개월 전 총 임금',  3000000)}
  ${_field('m1-days', '1개월 전 일수',     31, '일')}
  ${_field('m2-days', '2개월 전 일수',     28, '일')}
  ${_field('m3-days', '3개월 전 일수',     31, '일')}
`)}
<button id="calc-btn" class="btn btn-primary" style="width:100%;margin-top:4px">계산하기</button>`;

  container.querySelector('#calc-btn').addEventListener('click', () => {
    const g = id => parseFloat(root.querySelector(`#${id}`)?.value || 0);
    const totalWage = g('m1-wage') + g('m2-wage') + g('m3-wage');
    const totalDays = g('m1-days') + g('m2-days') + g('m3-days');
    const avgDaily  = totalDays > 0 ? totalWage / totalDays : 0;
    const avgMonthly = avgDaily * 30;

    const res = root.querySelector('#calc-result');
    res.style.display = '';
    res.innerHTML = `
      <div style="font-size:14px;font-weight:700;margin-bottom:12px;opacity:0.9">📊 평균임금 계산 결과</div>
      ${_resultRow('3개월 총 임금', _fmt(totalWage))}
      ${_resultRow('3개월 총 일수', totalDays + '일')}
      ${_resultRow('1일 평균임금', _fmt(avgDaily), true)}
      ${_resultRow('30일 평균임금 (퇴직금 산정 기준)', _fmt(avgMonthly))}
      <div style="font-size:11px;opacity:0.7;margin-top:10px;line-height:1.6">
        * 평균임금 = 퇴직 전 3개월 총 임금 ÷ 총 일수<br>
        * 평균임금이 통상임금보다 낮은 경우 통상임금을 적용합니다
      </div>`;
    res.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

// ── 퇴직금 ───────────────────────────────────────────────────

function _renderSeveranceForm(container, root) {
  container.innerHTML = `
${_card('📋 근속 정보', `
  ${_field('start-date', '입사일', '2022-01-01', '', 'date')}
  ${_field('end-date',   '퇴직일', new Date().toISOString().slice(0,10), '', 'date')}
`)}
${_card('💵 평균임금 (퇴직 전 3개월)', `
  ${_field('avg-wage3m', '3개월 총 임금', 9300000)}
  ${_field('avg-days3m', '3개월 총 일수', 90, '일')}
  ${_field('ord-monthly','통상임금 (월)', 3000000, '원 (최저 보장용)')}
`)}
<button id="calc-btn" class="btn btn-primary" style="width:100%;margin-top:4px">계산하기</button>`;

  container.querySelector('#calc-btn').addEventListener('click', () => {
    const g   = id => parseFloat(root.querySelector(`#${id}`)?.value || 0);
    const gS  = id => root.querySelector(`#${id}`)?.value || '';
    const start = new Date(gS('start-date'));
    const end   = new Date(gS('end-date'));
    const days  = Math.floor((end - start) / 86400000);
    const years = days / 365;

    if (days < 365) {
      showToast('1년 미만 근무자는 퇴직금이 발생하지 않습니다.', 'info');
      addNotification({ type: 'info', title: '급여 계산기', body: '1년 미만 근무자는 퇴직금이 발생하지 않습니다.' });
      return;
    }

    const totalWage = g('avg-wage3m');
    const totalDays = g('avg-days3m') || 90;
    const avgDaily  = totalWage / totalDays;
    const ordDaily  = g('ord-monthly') / 30;
    const useDaily  = Math.max(avgDaily, ordDaily);
    const severance = useDaily * 30 * years;

    const res = root.querySelector('#calc-result');
    res.style.display = '';
    res.innerHTML = `
      <div style="font-size:14px;font-weight:700;margin-bottom:12px;opacity:0.9">📊 퇴직금 계산 결과</div>
      ${_resultRow('근속일수', days + '일 (' + years.toFixed(2) + '년)')}
      ${_resultRow('1일 평균임금', _fmt(avgDaily))}
      ${_resultRow('1일 통상임금', _fmt(ordDaily))}
      ${_resultRow('적용 일급 (둘 중 높은 값)', _fmt(useDaily))}
      ${_resultRow('예상 퇴직금 (30일분 × 근속연수)', _fmt(severance), true)}
      <div style="font-size:11px;opacity:0.7;margin-top:10px;line-height:1.6">
        * 퇴직금 = 30일분 평균임금 × 재직연수<br>
        * 퇴직일로부터 14일 이내 지급 의무 (합의 시 연장 가능)<br>
        * 중간정산 이력이 있는 경우 기간 조정 필요
      </div>`;
    res.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}
