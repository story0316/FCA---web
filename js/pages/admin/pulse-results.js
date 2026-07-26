/**
 * pulse-results.js — 펄스 서베이 결과 분석 (관리자)
 */

import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';

const LS_PULSE = 'hr_pulse_responses';

const DIMENSIONS = [
  { id: 'workload',     label: '업무량',       icon: '💼' },
  { id: 'teamwork',     label: '팀워크',       icon: '🤝' },
  { id: 'leadership',   label: '리더십',       icon: '🌟' },
  { id: 'growth',       label: '성장',         icon: '📈' },
  { id: 'satisfaction', label: '전반적 만족',  icon: '😊' },
];

const SCORE_COLOR = (s) =>
  s >= 4.5 ? '#10B981' : s >= 3.5 ? '#22C55E' : s >= 2.5 ? '#F59E0B' : s >= 1.5 ? '#F97316' : '#EF4444';

function _getResponses() {
  try { return JSON.parse(localStorage.getItem(LS_PULSE) || '[]'); } catch { return []; }
}

function _avgBy(arr, dimId) {
  const vals = arr.map(r => r.scores?.[dimId]).filter(v => v > 0);
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
}

let _weeks = 8;
let _employeeCount = 0;

export function render(root) {
  _renderPage(root);
}

export function unmount() {
  _weeks = 8;
  _employeeCount = 0;
}

export async function mount(root) {
  root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">⏳</div><div style="font-size:13px">펄스 결과를 불러오는 중...</div></div>`;
  const employees = await loadDisplayEmployees();
  _employeeCount = employees.length;
  _renderPage(root);
}

function _renderPage(root) {
  const responses = _getResponses();
  if (!responses.length) {
    root.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
        <div style="font-size:48px;margin-bottom:12px">💓</div>
        <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">아직 펄스 설문 응답이 없습니다.</div>
        <div style="font-size:12px;line-height:1.6;margin-bottom:18px">직원이 설문에 참여하면 응답률과 만족도 추이가 여기에 표시됩니다.</div>
        <button id="pulse-empty-cta" style="background:#4F46E5;color:#fff;border:none;border-radius:10px;padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer">펄스 설문으로 이동</button>
      </div>`;
    root.querySelector('#pulse-empty-cta')?.addEventListener('click', () => {
      window.location.hash = '#/pulse-survey';
    });
    return;
  }

  const allWeeks = [...new Set(responses.map(r => r.weekKey))].sort().reverse();
  const recentWeeks = allWeeks.slice(0, _weeks);
  const thisWeekData = responses.filter(r => r.weekKey === recentWeeks[0]);
  const respondentCount = new Set(thisWeekData.map(r => r.userId)).size;
  const responseRate = _employeeCount > 0
    ? `${Math.min(100, Math.round((respondentCount / _employeeCount) * 100))}%`
    : '산정 불가';

  const thisAvg = DIMENSIONS.reduce((acc, d) => {
    acc[d.id] = _avgBy(thisWeekData, d.id);
    return acc;
  }, {});
  const overallAvg = Object.values(thisAvg).reduce((s, v) => s + v, 0) / DIMENSIONS.length;

  const comments = responses.filter(r => r.comment && recentWeeks.slice(0,2).includes(r.weekKey));

  root.innerHTML = `
<div style="padding:16px">

  <!-- 헤더 -->
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div style="font-size:15px;font-weight:700">📊 펄스 서베이 분석</div>
    <button id="export-btn" style="background:#4F46E5;color:#fff;border:none;border-radius:10px;
      padding:7px 12px;font-size:12px;font-weight:600;cursor:pointer">📥 CSV</button>
  </div>

  <!-- 기간 선택 -->
  <div style="display:flex;gap:6px;margin-bottom:16px">
    ${[4, 8, 12].map(w => `
    <button class="week-btn" data-w="${w}"
      style="padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;
             border:2px solid ${_weeks===w?'#4F46E5':'var(--border)'};
             background:${_weeks===w?'#EEF2FF':'var(--card-bg)'};
             color:${_weeks===w?'#4338CA':'var(--text-muted)'}">${w}주</button>`).join('')}
    <div style="margin-left:auto;font-size:12px;color:#64748B;align-self:center">
      이번 주 응답률: <strong style="color:#4F46E5">${responseRate}</strong>
    </div>
  </div>

  <!-- 종합 KPI -->
  <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border-radius:16px;
       padding:20px;color:#fff;margin-bottom:16px;display:flex;align-items:center;gap:16px">
    <div style="text-align:center;flex-shrink:0">
      <div style="font-size:40px;font-weight:800">${overallAvg.toFixed(1)}</div>
      <div style="font-size:12px;opacity:0.8">/ 5.0</div>
    </div>
    <div style="flex:1">
      <div style="font-size:14px;font-weight:700;margin-bottom:6px">이번 주 전체 만족도</div>
      <div style="background:rgba(255,255,255,0.2);border-radius:6px;height:10px">
        <div style="background:#fff;height:100%;width:${overallAvg/5*100}%;border-radius:6px;transition:width .5s"></div>
      </div>
      <div style="font-size:11px;opacity:0.8;margin-top:6px">
        ${thisWeekData.length}명 응답 · ${recentWeeks[0]} 기준
      </div>
    </div>
  </div>

  <!-- 차원별 상세 -->
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
       padding:14px;margin-bottom:14px">
    <div style="font-size:13px;font-weight:700;margin-bottom:12px">차원별 점수</div>
    ${DIMENSIONS.map(d => {
      const avg = thisAvg[d.id];
      const prevData = responses.filter(r => r.weekKey === recentWeeks[1]);
      const prevAvg = _avgBy(prevData, d.id);
      const diff = avg - prevAvg;
      const color = SCORE_COLOR(avg);
      return `
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:14px">${d.icon}</span>
          <span style="font-size:13px;font-weight:600;color:var(--text)">${d.label}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          ${diff !== 0 ? `<span style="font-size:11px;color:${diff>0?'#10B981':'#EF4444'}">
            ${diff>0?'▲':'▼'} ${Math.abs(diff).toFixed(1)}</span>` : ''}
          <span style="font-size:14px;font-weight:800;color:${color}">${avg.toFixed(1)}</span>
        </div>
      </div>
      <div style="background:var(--border);border-radius:4px;height:8px;overflow:hidden">
        <div style="background:${color};height:100%;width:${avg/5*100}%;border-radius:4px;transition:width .6s"></div>
      </div>
    </div>`;
    }).join('')}
  </div>

  <!-- 주간 트렌드 -->
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
       padding:14px;margin-bottom:14px">
    <div style="font-size:13px;font-weight:700;margin-bottom:12px">📈 주간 트렌드</div>
    <div style="display:flex;align-items:flex-end;gap:6px;height:80px">
      ${recentWeeks.slice(0, _weeks).reverse().map((wk, i) => {
        const wkData = responses.filter(r => r.weekKey === wk);
        const wkAvg = DIMENSIONS.reduce((s, d) => s + _avgBy(wkData, d.id), 0) / DIMENSIONS.length;
        const h = Math.max(8, Math.round(wkAvg / 5 * 70));
        const color = SCORE_COLOR(wkAvg);
        return `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
          <div style="font-size:9px;color:${color};font-weight:700">${wkAvg.toFixed(1)}</div>
          <div style="width:100%;background:${color};border-radius:3px 3px 0 0;height:${h}px;
               transition:height .5s;opacity:${i===recentWeeks.slice(0,_weeks).reverse().length-1?'1':'0.7'}"></div>
          <div style="font-size:8px;color:#94A3B8;text-align:center;line-height:1.2">
            ${wk.slice(5).replace('-','.')}
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>

  <!-- 주요 코멘트 -->
  ${comments.length ? `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
    <div style="font-size:13px;font-weight:700;margin-bottom:10px">💬 최근 직원 의견</div>
    ${comments.slice(0, 5).map(r => `
    <div style="padding:10px;background:var(--bg);border-radius:10px;margin-bottom:6px;
         font-size:12px;color:var(--text);line-height:1.6;font-style:italic">
      "${r.comment}"
      <div style="font-size:10px;color:#94A3B8;margin-top:4px;text-align:right">
        ${r.weekKey} 주 · 익명
      </div>
    </div>`).join('')}
  </div>` : ''}

</div>`;

  root.querySelectorAll('.week-btn').forEach(btn => {
    btn.addEventListener('click', () => { _weeks = parseInt(btn.dataset.w); _renderPage(root); });
  });

  root.querySelector('#export-btn').addEventListener('click', () => _exportCSV(responses, recentWeeks));
}

function _exportCSV(responses, weeks) {
  const rows = [['주간', '응답수', ...DIMENSIONS.map(d => d.label)]];
  for (const wk of weeks) {
    const wkData = responses.filter(r => r.weekKey === wk);
    rows.push([wk, wkData.length, ...DIMENSIONS.map(d => _avgBy(wkData, d.id).toFixed(2))]);
  }
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'pulse-results.csv'; a.click();
  URL.revokeObjectURL(url);
  showToast('CSV 다운로드 완료', 'success');
  addNotification({ type: 'success', title: 'Pulse Results (관리자)', body: 'CSV 다운로드 완료' });
}
