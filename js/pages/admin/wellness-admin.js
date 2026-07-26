/**
 * wellness-admin.js — 팀 웰니스 모니터링
 */

import { loadDisplayEmployees } from '../../data/demo_employees.js';

const LS = 'hr_wellness_checkins';

const MOODS = [
  { score: 5, emoji: '😄', label: '매우 좋음',  color: '#10B981' },
  { score: 4, emoji: '🙂', label: '좋음',        color: '#34D399' },
  { score: 3, emoji: '😐', label: '보통',         color: '#F59E0B' },
  { score: 2, emoji: '😔', label: '우울함',       color: '#F97316' },
  { score: 1, emoji: '😩', label: '매우 힘듦',   color: '#EF4444' },
];

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

let _employees = [];

function _load() { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } }

function _isoWeek(date) {
  const d = new Date(date); d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 4 - (d.getDay()||7));
  const y = d.getFullYear();
  const w = Math.ceil(((d - new Date(y,0,1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2,'0')}`;
}

// 데모 데이터 시딩
function _seedDemo(all) {
  if (all.length >= 20) return all;
  const depts = [...new Set(_employees.map(e => e.department || e.dept || '기타'))];
  const now = new Date();
  const seeded = [...all];
  _employees.slice(0, 18).forEach((emp, i) => {
    for (let w = 0; w < 4; w++) {
      const d = new Date(now); d.setDate(d.getDate() - w * 7 - Math.floor(Math.random()*3));
      const mood = Math.max(1, Math.min(5, Math.round(3 + Math.sin(i + w) * 1.5)));
      seeded.push({
        id:      `demo_wc_${emp.id}_${w}`,
        userId:  emp.id || emp.employee_id,
        dept:    emp.department || emp.dept || '기타',
        week:    _isoWeek(d.toISOString()),
        date:    d.toISOString().slice(0,10),
        mood,
        stress:  Math.max(1, Math.min(5, Math.round(3 - (mood - 3) * 0.8 + (Math.random() - 0.5)))),
        burnout: Math.max(1, Math.min(5, Math.round(3 - (mood - 3) * 0.6 + (Math.random() - 0.5)))),
        note:    '',
        anonymous: false,
      });
    }
  });
  return seeded;
}

let _tab = 'overview';

export async function mount(root) {
  _tab = 'overview';
  root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">⏳</div><div style="font-size:13px">로딩 중…</div></div>`;
  _employees = await loadDisplayEmployees();
  _draw(root);
}

export function render(root) { _tab = 'overview'; _draw(root); }
export function unmount() { _tab = 'overview'; _employees = []; }

function _draw(root) {
  const raw  = _load();
  const all  = _seedDemo(raw);

  const now = new Date();
  const thisWeek = _isoWeek(now.toISOString());
  const weekData = all.filter(c => c.week === thisWeek);
  const depts = [...new Set(_employees.map(e => e.department || e.dept || '기타'))].sort();

  const avgMood = all.length ? (all.reduce((s,c) => s + c.mood, 0) / all.length) : 3;
  const avgStress  = all.length ? (all.reduce((s,c) => s + (c.stress||3), 0) / all.length) : 3;
  const avgBurnout = all.length ? (all.reduce((s,c) => s + (c.burnout||3), 0) / all.length) : 3;

  const riskCount = all.filter(c => c.week === thisWeek && (c.mood <= 2 || c.burnout >= 4)).length;

  root.innerHTML = `
<!-- 탭 -->
<div style="display:flex;border-bottom:1px solid var(--border);margin-bottom:14px">
  ${[{k:'overview',l:'전체 현황'},{k:'dept',l:'부서별'},{k:'trend',l:'주간 추이'}].map(t=>`
    <button class="wa-tab" data-t="${t.k}"
      style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab===t.k?'#4F46E5':'transparent'};color:${_tab===t.k?'#4F46E5':'#64748B'}">
      ${t.l}
    </button>`).join('')}
</div>

${_tab === 'overview' ? _renderOverview(avgMood, avgStress, avgBurnout, riskCount, weekData, depts, all) : ''}
${_tab === 'dept'     ? _renderDept(depts, all, thisWeek) : ''}
${_tab === 'trend'    ? _renderTrend(all, now) : ''}`;

  root.querySelectorAll('.wa-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _draw(root); });
  });
}

function _moodColor(avg) {
  if (avg >= 4) return '#10B981';
  if (avg >= 3) return '#F59E0B';
  return '#EF4444';
}

function _renderOverview(avgMood, avgStress, avgBurnout, riskCount, weekData, depts, all) {
  const mColor = _moodColor(avgMood);
  const participation = weekData.length;
  const total = (_employees.length || 1);

  return `
<!-- 종합 지수 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:16px;padding:16px;margin-bottom:14px;text-align:center">
  <div style="font-size:11px;color:#64748B;margin-bottom:4px">팀 평균 기분 지수</div>
  <div style="font-size:48px;font-weight:900;color:${mColor}">${avgMood.toFixed(1)}</div>
  <div style="font-size:12px;color:#64748B">${MOODS.find(m=>Math.round(avgMood)===m.score)?.label || ''}</div>
  <div style="height:10px;background:#E2E8F0;border-radius:5px;margin-top:10px;overflow:hidden">
    <div style="height:100%;background:${mColor};width:${(avgMood/5*100).toFixed(0)}%;border-radius:5px"></div>
  </div>
</div>

<!-- KPI -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
  ${[
    { l:'이번 주 참여', v:`${participation}명`, sub:`전체 ${total}명`, c:'#4F46E5' },
    { l:'위험 신호',    v:`${riskCount}건`,     sub:'기분·소진 주의', c: riskCount>0?'#EF4444':'#10B981' },
    { l:'평균 스트레스',v:`${avgStress.toFixed(1)}/5`,   sub:'1=낮음 5=높음', c:'#F59E0B' },
    { l:'평균 소진감',  v:`${avgBurnout.toFixed(1)}/5`, sub:'1=없음 5=극심', c:'#8B5CF6' },
  ].map(k=>`
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px">
      <div style="font-size:20px;font-weight:900;color:${k.c}">${k.v}</div>
      <div style="font-size:11px;font-weight:700;color:var(--text)">${k.l}</div>
      <div style="font-size:10px;color:#94A3B8">${k.sub}</div>
    </div>`).join('')}
</div>

${riskCount > 0 ? `
<!-- 위험 알림 -->
<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:12px;margin-bottom:14px">
  <div style="font-size:12px;font-weight:700;color:#EF4444;margin-bottom:4px">⚠️ 이번 주 주의 신호 ${riskCount}건</div>
  <div style="font-size:11px;color:#64748B">기분 점수 2 이하 또는 소진 점수 4 이상 응답자가 있습니다. EAP 안내 또는 1:1 대화를 권장합니다.</div>
</div>` : `
<div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:12px;margin-bottom:14px">
  <div style="font-size:12px;font-weight:700;color:#10B981;margin-bottom:2px">✅ 이번 주 팀 상태 양호</div>
  <div style="font-size:11px;color:#64748B">위험 신호 응답자가 없습니다. 좋은 상태를 유지하고 있습니다!</div>
</div>`}

<!-- 기분 분포 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px">
  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px">기분 분포 (이번 주)</div>
  ${MOODS.map(m => {
    const cnt = weekData.filter(c => c.mood === m.score).length;
    const pct = weekData.length ? Math.round(cnt / weekData.length * 100) : 0;
    return `
<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
  <span style="font-size:16px;width:24px">${m.emoji}</span>
  <div style="flex:1;height:14px;background:#E2E8F0;border-radius:4px;overflow:hidden">
    <div style="height:100%;width:${pct}%;background:${m.color};border-radius:4px"></div>
  </div>
  <span style="font-size:11px;color:#64748B;width:36px;text-align:right">${cnt}명 (${pct}%)</span>
</div>`;
  }).join('')}
</div>`;
}

function _renderDept(depts, all, thisWeek) {
  return `
<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px">부서별 평균 기분 지수 (최근 4주)</div>
${depts.map(dept => {
  const deptData = all.filter(c => c.dept === dept);
  if (!deptData.length) return '';
  const avg = deptData.reduce((s,c) => s + c.mood, 0) / deptData.length;
  const thisW = deptData.filter(c => c.week === thisWeek);
  const avgThisW = thisW.length ? thisW.reduce((s,c) => s + c.mood, 0) / thisW.length : avg;
  const col = _moodColor(avg);
  const headcount = _employees.filter(e => (e.department||e.dept||'기타') === dept).length;
  const riskCnt = thisW.filter(c => c.mood <= 2 || c.burnout >= 4).length;
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <div>
      <div style="font-size:13px;font-weight:700;color:var(--text)">${dept}</div>
      <div style="font-size:10px;color:#94A3B8">${headcount}명 · 이번 주 참여 ${thisW.length}명</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:22px;font-weight:900;color:${col}">${avg.toFixed(1)}</div>
      ${riskCnt > 0 ? `<div style="font-size:10px;color:#EF4444">⚠️ 주의 ${riskCnt}명</div>` : ''}
    </div>
  </div>
  <div style="height:8px;background:#E2E8F0;border-radius:4px;overflow:hidden">
    <div style="height:100%;width:${(avg/5*100).toFixed(0)}%;background:${col};border-radius:4px"></div>
  </div>
</div>`;
}).join('')}`;
}

function _renderTrend(all, now) {
  const weeks = Array.from({length:6}, (_,i) => {
    const d = new Date(now); d.setDate(d.getDate() - i * 7);
    return _isoWeek(d.toISOString());
  }).reverse();

  const weekLabels = weeks.map((w,i) => i === weeks.length-1 ? '이번 주' : `-${weeks.length-1-i}주`);

  return `
${[
  { title:'평균 기분 지수', key:'mood',    colors:['#EF4444','#10B981'], good:3.5 },
  { title:'평균 스트레스',  key:'stress',  colors:['#10B981','#EF4444'], good:2.5, invert:true },
  { title:'평균 소진감',    key:'burnout', colors:['#10B981','#EF4444'], good:2.5, invert:true },
].map(metric => {
  const vals = weeks.map(w => {
    const wData = all.filter(c => c.week === w);
    return wData.length ? wData.reduce((s,c) => s + (c[metric.key]||3), 0) / wData.length : 0;
  });
  const maxV = 5;
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px">${metric.title} (6주)</div>
  <div style="display:flex;align-items:flex-end;gap:6px;height:80px">
    ${vals.map((v,i) => {
      const h = Math.max(4, Math.round((v / maxV) * 68));
      const isGood = metric.invert ? v <= metric.good : v >= metric.good;
      return `
<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">
  <div style="font-size:9px;color:#64748B;margin-bottom:2px">${v > 0 ? v.toFixed(1) : '-'}</div>
  <div style="width:100%;height:${h}px;background:${v>0?(isGood?metric.colors[1]:metric.colors[0]):'#E2E8F0'};border-radius:3px 3px 0 0"></div>
  <div style="font-size:9px;color:#94A3B8;margin-top:4px">${weekLabels[i]}</div>
</div>`;
    }).join('')}
  </div>
</div>`;
}).join('')}`;
}
