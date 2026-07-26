/**
 * compensation-admin.js — 보상 관리 (직급별 연봉 밴드·인상률 시뮬레이션)
 */

import { showToast } from '../../components/toast.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';
import { addNotification } from '../../components/notification-hub.js';

const LS_BANDS = 'hr_salary_bands';
const LS_SIMS  = 'hr_salary_sims';

const DEFAULT_BANDS = [
  { level: '사원',   min: 30000000,  mid: 38000000,  max: 46000000,  icon: '🌱' },
  { level: '대리',   min: 40000000,  mid: 50000000,  max: 60000000,  icon: '🌿' },
  { level: '과장',   min: 55000000,  mid: 68000000,  max: 82000000,  icon: '🌳' },
  { level: '차장',   min: 70000000,  mid: 88000000,  max: 106000000, icon: '🏔️' },
  { level: '부장',   min: 90000000,  mid: 115000000, max: 140000000, icon: '🦅' },
  { level: '이사',   min: 120000000, mid: 160000000, max: 200000000, icon: '⭐' },
];

const PERF_RATES = {
  S: 8, A: 5, B: 3, C: 1, D: 0,
};

function _getBands() {
  try {
    const stored = JSON.parse(localStorage.getItem(LS_BANDS) || '[]');
    return stored.length ? stored : DEFAULT_BANDS;
  } catch { return DEFAULT_BANDS; }
}
function _saveBands(b) { localStorage.setItem(LS_BANDS, JSON.stringify(b)); }

function _fmtW(n) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  return `${(n / 10000).toFixed(0)}만`;
}

let _tab     = 'bands';
let _simData = {};
let _employees = [];

export async function mount(root) {
  _tab = 'bands'; _simData = {};
  root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">⏳</div><div style="font-size:13px">로딩 중…</div></div>`;
  _employees = await loadDisplayEmployees();
  _draw(root);
}

export function render(root) { _tab = 'bands'; _simData = {}; _draw(root); }
export function unmount() { _tab = 'bands'; _simData = {}; _employees = []; }

function _draw(root) {
  const bands = _getBands();

  root.innerHTML = `
<!-- 탭 -->
<div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:14px">
  ${[
    { key: 'bands', label: '연봉 밴드' },
    { key: 'sim',   label: '인상률 시뮬레이션' },
    { key: 'dist',  label: '직원 분포' },
  ].map(t => `
    <button class="ca-tab" data-t="${t.key}"
      style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab===t.key?'#4F46E5':'transparent'};color:${_tab===t.key?'#4F46E5':'#64748B'}">
      ${t.label}
    </button>`).join('')}
</div>

${_tab === 'bands' ? _renderBands(bands) : ''}
${_tab === 'sim'   ? _renderSim(bands)   : ''}
${_tab === 'dist'  ? _renderDist(bands)  : ''}`;

  root.querySelectorAll('.ca-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _draw(root); });
  });

  if (_tab === 'bands') {
    root.querySelectorAll('.ca-band-save').forEach(btn => {
      btn.addEventListener('click', () => {
        const level = btn.dataset.level;
        const bands2 = _getBands();
        const idx = bands2.findIndex(b => b.level === level);
        if (idx !== -1) {
          const min = Number(root.querySelector(`.ca-min[data-level="${level}"]`).value) * 10000;
          const mid = Number(root.querySelector(`.ca-mid[data-level="${level}"]`).value) * 10000;
          const max = Number(root.querySelector(`.ca-max[data-level="${level}"]`).value) * 10000;
          if (min > mid || mid > max) { showToast('최소 ≤ 중간 ≤ 최대 순서를 확인해주세요.', 'error'); return; }
          bands2[idx] = { ...bands2[idx], min, mid, max };
          _saveBands(bands2);
          showToast(`${level} 밴드가 저장되었습니다.`, 'success')
      addNotification({ type: 'success', title: 'Compensation (관리자)', body: '밴드가 저장되었습니다.' });
          _draw(root);
        }
      });
    });
  }

  if (_tab === 'sim') {
    root.querySelector('#ca-sim-run')?.addEventListener('click', () => {
      _simData = {};
      root.querySelectorAll('.ca-sim-rate').forEach(inp => {
        _simData[inp.dataset.perf] = Number(inp.value) || PERF_RATES[inp.dataset.perf];
      });
      _draw(root);
    });
    root.querySelector('#ca-sim-reset')?.addEventListener('click', () => {
      _simData = {};
      _draw(root);
    });
  }
}

function _renderBands(bands) {
  if (!bands || !bands.length) return `<div style="text-align:center;padding:48px 20px;color:#94A3B8"><div style="font-size:40px;margin-bottom:10px">💰</div><div style="font-size:14px;font-weight:600;margin-bottom:4px">보상 내역이 없습니다.</div></div>`;

  return `
<div style="margin-bottom:8px">
  ${bands.map(b => `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
    <span style="font-size:20px">${b.icon}</span>
    <span style="font-size:14px;font-weight:700;color:var(--text)">${b.level}</span>
  </div>
  <!-- 밴드 시각화 -->
  <div style="position:relative;height:28px;background:#E2E8F0;border-radius:6px;margin-bottom:10px;overflow:hidden">
    <div style="position:absolute;top:0;left:0;height:100%;background:#C7D2FE;border-radius:6px;width:100%"></div>
    <div style="position:absolute;top:4px;left:50%;transform:translateX(-50%);height:20px;background:#4F46E5;border-radius:4px;width:2px"></div>
    <div style="position:absolute;top:8px;left:4px;font-size:9px;color:#4F46E5;font-weight:700">${_fmtW(b.min)}</div>
    <div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);font-size:9px;color:#fff;font-weight:700;background:#4F46E5;padding:1px 4px;border-radius:3px">${_fmtW(b.mid)}</div>
    <div style="position:absolute;top:8px;right:4px;font-size:9px;color:#4F46E5;font-weight:700">${_fmtW(b.max)}</div>
  </div>
  <!-- 편집 -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:6px;align-items:end">
    <div>
      <div style="font-size:10px;color:#64748B;margin-bottom:3px">최소(만원)</div>
      <input type="number" class="ca-min" data-level="${b.level}" value="${b.min/10000}"
        style="width:100%;padding:6px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:12px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
    <div>
      <div style="font-size:10px;color:#64748B;margin-bottom:3px">중간(만원)</div>
      <input type="number" class="ca-mid" data-level="${b.level}" value="${b.mid/10000}"
        style="width:100%;padding:6px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:12px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
    <div>
      <div style="font-size:10px;color:#64748B;margin-bottom:3px">최대(만원)</div>
      <input type="number" class="ca-max" data-level="${b.level}" value="${b.max/10000}"
        style="width:100%;padding:6px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:12px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
    <button class="ca-band-save" data-level="${b.level}"
      style="padding:7px 10px;background:#4F46E5;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">저장</button>
  </div>
</div>`).join('')}
</div>`;
}

function _renderSim(bands) {
  const simRates = Object.keys(PERF_RATES).reduce((acc, k) => ({ ...acc, [k]: _simData[k] ?? PERF_RATES[k] }), {});

  // 총 인건비 시뮬
  const employees = _employees.slice(0, 20);
  const totalBase  = employees.reduce((n, e) => n + (e.salary || 50000000), 0);
  const totalAfter = employees.reduce((n, e) => {
    const perf = ['S','A','B','C','D'][Math.floor(Math.random() * 3)];
    return n + (e.salary || 50000000) * (1 + simRates[perf] / 100);
  }, 0);
  const totalIncrease = totalAfter - totalBase;

  return `
<!-- 인상률 설정 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px">등급별 인상률 설정 (%)</div>
  ${Object.entries(PERF_RATES).map(([grade, defaultRate]) => {
    const rate = simRates[grade];
    const color = grade==='S'?'#059669':grade==='A'?'#10B981':grade==='B'?'#3B82F6':grade==='C'?'#F59E0B':'#EF4444';
    return `
<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
  <span style="width:28px;height:28px;border-radius:8px;background:${color};color:#fff;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${grade}</span>
  <input type="range" class="ca-sim-rate" data-perf="${grade}" min="0" max="15" step="0.5" value="${rate}"
    style="flex:1;accent-color:${color}">
  <span style="font-size:13px;font-weight:700;color:${color};min-width:36px;text-align:right">${rate}%</span>
</div>`;
  }).join('')}
  <div style="display:flex;gap:8px;margin-top:12px">
    <button id="ca-sim-run" style="flex:1;padding:10px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">시뮬레이션 실행</button>
    <button id="ca-sim-reset" style="padding:10px 14px;background:var(--bg);color:#64748B;border:1.5px solid var(--border);border-radius:8px;font-size:12px;cursor:pointer">초기화</button>
  </div>
</div>

<!-- 결과 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px">예상 인건비 영향 (샘플 20명 기준)</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
    ${[
      { label: '현재 총 인건비',  val: _fmtW(totalBase),     color: '#64748B' },
      { label: '예상 증가분',     val: '+' + _fmtW(totalIncrease), color: '#EF4444' },
      { label: '인상 후 인건비', val: _fmtW(Math.round(totalAfter)), color: '#4F46E5' },
    ].map(k => `
      <div style="text-align:center;padding:10px;background:var(--bg);border-radius:10px">
        <div style="font-size:15px;font-weight:800;color:${k.color}">${k.val}</div>
        <div style="font-size:9px;color:#94A3B8;margin-top:2px">${k.label}</div>
      </div>`).join('')}
  </div>
  <!-- 등급별 기준 연봉 예시 -->
  ${bands.map(b => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="font-size:12px;font-weight:700;color:var(--text);min-width:28px">${b.level}</span>
      <span style="font-size:11px;color:#64748B;flex:1">중간 ${_fmtW(b.mid)}</span>
      <div style="display:flex;gap:4px">
        ${['S','A','B'].map(g => `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:#EEF2FF;color:#4F46E5;font-weight:600">${g}+${simRates[g]}%→${_fmtW(Math.round(b.mid*(1+simRates[g]/100)))}</span>`).join('')}
      </div>
    </div>`).join('')}
</div>

<div style="padding:10px 12px;background:#FEF3C7;border-radius:10px;font-size:11px;color:#D97706">
  ⚠️ 시뮬레이션은 중간값 기준 추정치입니다. 실제 개인별 연봉은 별도 협의가 필요합니다.
</div>`;
}

function _renderDist(bands) {
  const employees = _employees.slice(0, 20);

  return `
<div style="margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px">직급별 인원 및 평균 연봉 분포</div>
  ${bands.map(b => {
    const inBand = employees.filter(e => {
      const sal = e.salary || 50000000;
      return sal >= b.min && sal <= b.max;
    });
    const avgSal = inBand.length ? Math.round(inBand.reduce((n, e) => n + (e.salary || 50000000), 0) / inBand.length) : 0;
    const pct = inBand.length ? Math.round(((avgSal - b.min) / (b.max - b.min)) * 100) : 50;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <div style="display:flex;align-items:center;gap:6px">
      <span style="font-size:18px">${b.icon}</span>
      <span style="font-size:13px;font-weight:700;color:var(--text)">${b.level}</span>
    </div>
    <div style="text-align:right">
      <div style="font-size:12px;font-weight:700;color:#4F46E5">${inBand.length}명</div>
      <div style="font-size:10px;color:#64748B">${avgSal ? '평균 ' + _fmtW(avgSal) : '데이터 없음'}</div>
    </div>
  </div>
  <div style="position:relative;height:12px;background:#E2E8F0;border-radius:6px;overflow:hidden">
    <div style="height:100%;background:#C7D2FE;border-radius:6px;width:100%"></div>
    ${avgSal ? `<div style="position:absolute;top:0;left:0;height:100%;background:#4F46E5;border-radius:6px;width:${pct}%"></div>` : ''}
  </div>
  <div style="display:flex;justify-content:space-between;margin-top:3px">
    <span style="font-size:9px;color:#94A3B8">${_fmtW(b.min)}</span>
    <span style="font-size:9px;color:#4F46E5;font-weight:600">${_fmtW(b.mid)} (중간)</span>
    <span style="font-size:9px;color:#94A3B8">${_fmtW(b.max)}</span>
  </div>
</div>`;
  }).join('')}
</div>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">연봉 밴드 가이드</div>
  <div style="font-size:12px;color:#64748B;line-height:1.7">
    • <strong>밴드 하위 25%</strong> 이하: 빠른 인상 또는 직무 재분류 검토<br>
    • <strong>밴드 중간 75%</strong> 구간: 성과 기반 표준 인상<br>
    • <strong>밴드 상위 10%</strong> 이상: 인상 최소화, 직급 승진 우선 검토<br>
    • 밴드 초과 시: 직무 재정의 또는 예외 처리 필요
  </div>
</div>`;
}
