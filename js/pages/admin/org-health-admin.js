/**
 * org-health-admin.js — 조직 건강 지수 대시보드
 * 실데이터 기반: loadDisplayEmployees() + hr_internal_transfers + enps/enpsHistory 필드
 * 원천 데이터가 없는 지표(이직률·충원율·유지율)는 조작하지 않고 "데이터 없음"으로 표시
 */

import { loadDisplayEmployees } from '../../data/demo_employees.js';

const LS_TRANSFERS = 'hr_internal_transfers';

function _getTransfers() { try { return JSON.parse(localStorage.getItem(LS_TRANSFERS) || '[]'); } catch { return []; } }

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

function _scoreHigh(val, thresholds) {
  if (val === null) return { grade: '-', color: '#94A3B8', bg: '#F1F5F9' };
  const [good, warn] = thresholds;
  if (val >= good) return { grade: 'A', color: '#10B981', bg: '#D1FAE5' };
  if (val >= warn) return { grade: 'B', color: '#F59E0B', bg: '#FEF3C7' };
  return { grade: 'C', color: '#EF4444', bg: '#FEE2E2' };
}

let _tab = 'overview';
let _employees = [];

export async function mount(root) {
  _tab = 'overview';
  root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">⏳</div><div style="font-size:13px">조직 건강 지표 로딩 중…</div></div>`;
  _employees = await loadDisplayEmployees();
  _draw(root);
}
export function render(root) { _draw(root); }
export function unmount() { _tab = 'overview'; _employees = []; }

function _computeEnps(employees) {
  const scored = employees.filter(e => typeof e.enpsScore === 'number' && e.enpsScore !== null);
  if (!scored.length) return null;
  const promoters  = scored.filter(e => e.enpsScore >= 9).length;
  const detractors = scored.filter(e => e.enpsScore <= 6).length;
  return Math.round(((promoters - detractors) / scored.length) * 100);
}

function _computeEnpsHistory(employees) {
  // enpsHistory: [{month, score}] 또는 배열이 없으면 skip
  const byMonth = {};
  employees.forEach(e => {
    if (!Array.isArray(e.enpsHistory)) return;
    e.enpsHistory.forEach(h => {
      const k = h.month || h.date?.slice(0, 7);
      if (!k) return;
      if (!byMonth[k]) byMonth[k] = [];
      byMonth[k].push(h.score ?? h.enps_score ?? null);
    });
  });
  return Object.entries(byMonth)
    .filter(([, scores]) => scores.some(s => s !== null))
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, scores]) => {
      const valid = scores.filter(s => typeof s === 'number');
      const avg = valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
      return { month, value: avg };
    });
}

function _draw(root) {
  const totalEmp = _employees.length;
  const transfers = _getTransfers();
  const pendingTransfers = transfers.filter(t => t.status === 'pending').length;

  const enps = _computeEnps(_employees);
  const enpsHistory = _computeEnpsHistory(_employees);

  // 데이터 전혀 없을 때 빈 상태
  if (!totalEmp && !transfers.length) {
    root.innerHTML = `
<div style="text-align:center;padding:60px 20px;color:#94A3B8">
  <div style="font-size:48px;margin-bottom:12px">🏥</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:6px;color:var(--text)">조직 건강 데이터가 없습니다</div>
  <div style="font-size:12px;margin-bottom:20px">직원 데이터나 인사이동 데이터가 축적되면 자동으로 표시됩니다.</div>
  <button onclick="window.location.hash='#/admin?tab=employees'"
    style="padding:10px 20px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">
    👥 직원 관리로 이동
  </button>
</div>`;
    return;
  }

  const eScore = _scoreHigh(enps, [30, 10]);

  root.innerHTML = `
<div style="display:flex;border-bottom:1px solid var(--border);margin-bottom:14px">
  ${[{k:'overview',l:'종합 현황'},{k:'trend',l:'eNPS 추이'},{k:'dept',l:'부서별'}].map(t=>`
    <button class="oh-tab" data-t="${t.k}"
      style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab===t.k?'#4F46E5':'transparent'};color:${_tab===t.k?'#4F46E5':'#64748B'}">
      ${t.l}
    </button>`).join('')}
</div>

${_tab === 'overview' ? _renderOverview(enps, eScore, totalEmp, pendingTransfers) : ''}
${_tab === 'trend'    ? _renderTrend(enpsHistory) : ''}
${_tab === 'dept'     ? _renderDept() : ''}`;

  root.querySelectorAll('.oh-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _draw(root); });
  });
}

function _renderOverview(enps, eScore, totalEmp, pendingTransfers) {
  const hColor = enps === null ? '#94A3B8' : enps >= 30 ? '#10B981' : enps >= 10 ? '#F59E0B' : '#EF4444';

  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:16px;padding:16px;margin-bottom:14px;text-align:center">
  <div style="font-size:11px;color:#64748B;margin-bottom:6px">eNPS (직원 순추천 지수)</div>
  <div style="font-size:48px;font-weight:900;color:${hColor}">${enps !== null ? (enps >= 0 ? '+' : '') + enps : '—'}</div>
  <div style="font-size:12px;color:#64748B;margin-top:4px">${enps === null ? '설문 데이터 없음' : enps >= 30 ? '🟢 양호' : enps >= 10 ? '🟡 주의' : '🔴 위험'}</div>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
  ${[
    { label: '총 인원',   val: totalEmp ? `${totalEmp}명` : '—',            color: '#4F46E5', icon: '👥' },
    { label: '이동 대기', val: `${pendingTransfers}건`,                       color: pendingTransfers > 3 ? '#EF4444' : '#64748B', icon: '🔄' },
  ].map(k=>`
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:12px;display:flex;align-items:center;gap:10px">
      <span style="font-size:22px">${k.icon}</span>
      <div>
        <div style="font-size:18px;font-weight:800;color:${k.color}">${k.val}</div>
        <div style="font-size:10px;color:#64748B">${k.label}</div>
      </div>
    </div>`).join('')}
</div>

<div style="display:flex;flex-direction:column;gap:8px">
  <!-- eNPS — 실데이터 -->
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;display:flex;align-items:center;gap:12px">
    <div style="width:32px;height:32px;border-radius:8px;background:${eScore.bg};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:${eScore.color};flex-shrink:0">${eScore.grade}</div>
    <div style="flex:1">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:12px;font-weight:700;color:var(--text)">eNPS</span>
        <span style="font-size:14px;font-weight:800;color:${eScore.color}">${enps !== null ? (enps >= 0 ? '+' : '') + enps : '—'}</span>
      </div>
      <div style="font-size:10px;color:#94A3B8">${enps !== null ? '기준 >30 · 직원 설문 집계' : '직원 eNPS 설문 데이터 없음'}</div>
    </div>
  </div>

  <!-- 데이터 없는 지표 — 조작 없이 명시 -->
  ${[
    { label: '이직률',      note: '퇴사 이벤트 데이터 필요' },
    { label: '채용 충원율', note: '채용 공고·완료 데이터 필요' },
    { label: '직원 유지율', note: '재직 기간 이력 데이터 필요' },
  ].map(m => `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;display:flex;align-items:center;gap:12px;opacity:0.6">
      <div style="width:32px;height:32px;border-radius:8px;background:#F1F5F9;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;color:#94A3B8;flex-shrink:0">-</div>
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:12px;font-weight:700;color:var(--text)">${m.label}</span>
          <span style="font-size:12px;color:#94A3B8">데이터 없음</span>
        </div>
        <div style="font-size:10px;color:#94A3B8">${m.note}</div>
      </div>
    </div>`).join('')}
</div>`;
}

function _renderTrend(enpsHistory) {
  if (!enpsHistory.length) {
    return `<div style="text-align:center;padding:48px 20px;color:#94A3B8">
      <div style="font-size:40px;margin-bottom:10px">📊</div>
      <div style="font-size:13px;font-weight:600;margin-bottom:6px;color:var(--text)">eNPS 이력 데이터가 없습니다</div>
      <div style="font-size:12px">직원 eNPS 설문을 진행하면 월별 추이가 표시됩니다.</div>
    </div>`;
  }

  const values = enpsHistory.map(h => h.value).filter(v => v !== null);
  const maxVal = Math.max(...values, 50);
  const minVal = Math.min(...values, -10);
  const range  = maxVal - minVal || 1;

  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px">eNPS 추이 (최근 ${enpsHistory.length}개월)</div>
  <div style="display:flex;align-items:flex-end;gap:6px;height:80px">
    ${enpsHistory.map(h => {
      const v = h.value;
      if (v === null) return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">
        <div style="font-size:9px;color:#94A3B8;margin-bottom:2px">-</div>
        <div style="width:100%;height:4px;background:#E2E8F0;border-radius:3px 3px 0 0"></div>
        <div style="font-size:9px;color:#94A3B8;margin-top:4px">${h.month?.slice(5) || ''}</div>
      </div>`;
      const h_px = Math.round(((v - minVal) / range) * 70);
      const color = v >= 30 ? '#10B981' : v >= 10 ? '#F59E0B' : '#EF4444';
      return `
<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">
  <div style="font-size:9px;color:#64748B;margin-bottom:2px">${v >= 0 ? '+' : ''}${v}</div>
  <div style="width:100%;height:${Math.max(4,h_px)}px;background:${color};border-radius:3px 3px 0 0"></div>
  <div style="font-size:9px;color:#94A3B8;margin-top:4px">${h.month?.slice(5) || ''}</div>
</div>`;
    }).join('')}
  </div>
</div>`;
}

function _renderDept() {
  const depts = [...new Set(_employees.map(e => e.dept || e.department || '기타'))].sort();
  const transfers = _getTransfers();

  if (!depts.length) {
    return `<div style="text-align:center;padding:48px 20px;color:#94A3B8">
      <div style="font-size:40px;margin-bottom:10px">🏢</div>
      <div style="font-size:13px">부서 데이터가 없습니다.</div>
    </div>`;
  }

  return `
<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">부서별 인원 및 이동 현황</div>
${depts.map(dept => {
  const headcount = _employees.filter(e => (e.dept || e.department || '기타') === dept).length;
  const deptTransfers = transfers.filter(t => t.from === dept || t.to === dept);
  const inbound  = deptTransfers.filter(t => t.to   === dept && t.status === 'approved').length;
  const outbound = deptTransfers.filter(t => t.from === dept && t.status === 'approved').length;
  const pending  = deptTransfers.filter(t => t.status === 'pending').length;

  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <span style="font-size:13px;font-weight:700;color:var(--text)">${dept}</span>
    <span style="font-size:12px;font-weight:700;color:#4F46E5">${headcount}명</span>
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <span style="padding:3px 8px;background:#D1FAE5;border-radius:6px;font-size:11px;color:#059669">↩ 유입 ${inbound}</span>
    <span style="padding:3px 8px;background:#FEE2E2;border-radius:6px;font-size:11px;color:#EF4444">↪ 유출 ${outbound}</span>
    ${pending ? `<span style="padding:3px 8px;background:#FEF3C7;border-radius:6px;font-size:11px;color:#D97706">대기 ${pending}</span>` : ''}
  </div>
</div>`;
}).join('')}`;
}
