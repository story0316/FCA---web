/**
 * enps-dashboard.js — eNPS & 직원 만족도 대시보드 (관리자)
 * 데이터 소스: 공통 DB user_profiles.enps_score + enps_history_json (API 경유)
 * Pulse 서베이 응답: hr_pulse_responses localStorage
 */

import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';

const LS_PULSE = 'hr_pulse_responses';

const DIMENSIONS = [
  { id:'workload',   label:'업무량',   icon:'💼' },
  { id:'teamwork',   label:'팀워크',   icon:'🤝' },
  { id:'leadership', label:'리더십',   icon:'🌟' },
  { id:'growth',     label:'성장',     icon:'📈' },
  { id:'balance',    label:'워라밸',   icon:'⚖️' },
  { id:'culture',    label:'문화',     icon:'🏢' },
];

function _calcEnps(responses) {
  if (!responses.length) return 0;
  const promoters  = responses.filter(r => r.score >= 9).length;
  const detractors = responses.filter(r => r.score <= 6).length;
  return Math.round(((promoters - detractors) / responses.length) * 100);
}

/**
 * DB 직원 배열에서 eNPS 응답 형식으로 변환.
 * enps_score → 현재 월 응답, enpsHistory → 과거 월별 이력.
 */
function _buildEnpsFromEmployees(employees) {
  const now = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const responses = [];

  employees.forEach(e => {
    const dept = e.dept || e.department || '미지정';
    // 현재 enps_score → 이번 달 응답
    if (e.enpsScore != null) {
      responses.push({ empId: e.id, score: e.enpsScore, month: curMonth, dept });
    }
    // enpsHistory → 월별 과거 이력
    if (Array.isArray(e.enpsHistory)) {
      e.enpsHistory.forEach(h => {
        if (h.month && h.score != null) {
          responses.push({ empId: e.id, score: h.score, month: h.month, dept });
        }
      });
    }
  });
  return responses;
}

function _getPulse() { try { return JSON.parse(localStorage.getItem(LS_PULSE) || '[]'); } catch { return []; } }

let _selMonth = null;

export async function mount(root) {
  _selMonth = null;
  root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">⏳</div><div style="font-size:13px">eNPS 데이터 로딩 중…</div></div>`;
  const employees = await loadDisplayEmployees();
  const allEnps   = _buildEnpsFromEmployees(employees);
  if (!allEnps.length) {
    root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:48px;margin-bottom:12px">💓</div><div style="font-size:14px;font-weight:600;margin-bottom:6px">eNPS 데이터가 없습니다.</div><div style="font-size:12px">직원 프로필에 eNPS 점수를 등록하면 자동으로 표시됩니다.</div></div>`;
    return;
  }
  const months = [...new Set(allEnps.map(r => r.month))].sort().reverse();
  if (!_selMonth) _selMonth = months[0] || '';
  _draw(root, allEnps, months);
}

export function render(root) { _draw(root, [], []); }
export function unmount() { _selMonth = null; }

function _draw(root, allEnps, months) {
  if (!allEnps.length) {
    root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:48px;margin-bottom:12px">💓</div><div style="font-size:14px;font-weight:600;margin-bottom:6px">eNPS 데이터가 없습니다.</div><div style="font-size:12px">직원 프로필에 eNPS 점수를 등록하면 자동으로 표시됩니다.</div></div>`;
    return;
  }
  const monthData  = allEnps.filter(r=>r.month===_selMonth);
  const enpsScore  = _calcEnps(monthData);
  const promoters  = monthData.filter(r=>r.score>=9).length;
  const passives   = monthData.filter(r=>r.score>=7&&r.score<=8).length;
  const detractors = monthData.filter(r=>r.score<=6).length;

  // 부서별 eNPS
  const depts = [...new Set(allEnps.map(r=>r.dept))];
  const deptScores = depts.map(d=>{
    const data = monthData.filter(r=>r.dept===d);
    return { dept:d, score:_calcEnps(data), count:data.length };
  }).sort((a,b)=>b.score-a.score);

  // 월별 트렌드
  const trend = months.slice(0,6).reverse().map(m=>{
    const data = allEnps.filter(r=>r.month===m);
    return { month:m, score:_calcEnps(data), count:data.length };
  });

  // Pulse 차원 평균
  const pulse = _getPulse();
  const dimAvg = DIMENSIONS.map(d=>{
    const vals = pulse.map(p=>p[d.id]).filter(v=>v!=null&&v>0);
    const avg  = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
    return { ...d, avg, count:vals.length };
  });

  const enpsColor = enpsScore>=50?'#10B981':enpsScore>=0?'#F59E0B':'#EF4444';
  const enpsLabel = enpsScore>=50?'매우 긍정적':enpsScore>=0?'보통':'개선 필요';

  root.innerHTML = `
<!-- 월 선택 -->
<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
  ${months.map(m=>`
  <button class="enps-month-btn" data-month="${m}"
    style="padding:5px 12px;font-size:11px;font-weight:600;border-radius:8px;cursor:pointer;
           border:1.5px solid ${_selMonth===m?'#4F46E5':'var(--border)'};
           background:${_selMonth===m?'#EEF2FF':'var(--card-bg)'};
           color:${_selMonth===m?'#4F46E5':'#64748B'}">${m}</button>`).join('')}
</div>

<!-- eNPS 메인 카드 -->
<div style="background:linear-gradient(135deg,${enpsColor} 0%,${enpsColor}cc 100%);
     border-radius:16px;padding:20px;margin-bottom:14px;color:#fff;text-align:center">
  <div style="font-size:12px;opacity:0.85;margin-bottom:4px">eNPS (직원 추천 지수)</div>
  <div style="font-size:56px;font-weight:900;line-height:1">${enpsScore>0?'+':''}${enpsScore}</div>
  <div style="font-size:13px;font-weight:700;margin-top:4px;opacity:0.9">${enpsLabel}</div>
  <div style="font-size:11px;opacity:0.7;margin-top:4px">응답 ${monthData.length}명</div>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:16px">
    ${[
      {label:'추천자 (9-10점)', value:promoters+'명', bg:'rgba(255,255,255,0.25)'},
      {label:'중립자 (7-8점)', value:passives+'명',   bg:'rgba(255,255,255,0.15)'},
      {label:'비추자 (0-6점)', value:detractors+'명', bg:'rgba(0,0,0,0.15)'},
    ].map(g=>`
    <div style="background:${g.bg};border-radius:10px;padding:8px">
      <div style="font-size:16px;font-weight:800">${g.value}</div>
      <div style="font-size:9px;opacity:0.85;margin-top:2px">${g.label}</div>
    </div>`).join('')}
  </div>
</div>

<!-- 점수 분포 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:10px">점수 분포</div>
  <div style="display:flex;align-items:flex-end;gap:4px;height:60px">
    ${[0,1,2,3,4,5,6,7,8,9,10].map(score=>{
      const cnt = monthData.filter(r=>r.score===score).length;
      const maxCnt = Math.max(1,...[0,1,2,3,4,5,6,7,8,9,10].map(s=>monthData.filter(r=>r.score===s).length));
      const h = Math.round((cnt/maxCnt)*50)||0;
      const col = score>=9?'#10B981':score>=7?'#F59E0B':'#EF4444';
      return `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
      <div style="font-size:8px;color:#94A3B8">${cnt||''}</div>
      <div style="width:100%;background:${col};border-radius:3px 3px 0 0;height:${h}px;min-height:${cnt?4:0}px"></div>
      <div style="font-size:9px;color:#64748B">${score}</div>
    </div>`;
    }).join('')}
  </div>
</div>

<!-- 월별 트렌드 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:10px">📈 월별 eNPS 트렌드</div>
  <div style="display:flex;align-items:flex-end;gap:8px;height:70px;margin-bottom:6px">
    ${trend.map(t=>{
      const norm = Math.max(0,(t.score+100)/200);
      const h = Math.round(norm*55)+5;
      const col = t.score>=50?'#10B981':t.score>=0?'#F59E0B':'#EF4444';
      return `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
      <div style="font-size:9px;font-weight:700;color:${col}">${t.score>0?'+':''}${t.score}</div>
      <div style="width:100%;background:${col};border-radius:4px 4px 0 0;height:${h}px"></div>
      <div style="font-size:9px;color:#64748B">${t.month.slice(5)}</div>
    </div>`;
    }).join('')}
  </div>
</div>

<!-- 부서별 eNPS -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:10px">🏢 부서별 eNPS</div>
  ${deptScores.filter(d=>d.count>0).map(d=>{
    const col = d.score>=50?'#10B981':d.score>=0?'#F59E0B':'#EF4444';
    const barPct = Math.max(0,(d.score+100)/2);
    return `
  <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
    <div style="font-size:12px;font-weight:600;color:var(--text);width:70px;flex-shrink:0">${d.dept}</div>
    <div style="flex:1;background:#E2E8F0;border-radius:99px;height:5px">
      <div style="background:${col};height:5px;border-radius:99px;width:${barPct}%"></div>
    </div>
    <div style="font-size:12px;font-weight:800;color:${col};flex-shrink:0;width:36px;text-align:right">${d.score>0?'+':''}${d.score}</div>
  </div>`;
  }).join('')}
  ${!deptScores.filter(d=>d.count>0).length?`<div style="text-align:center;padding:16px;color:#94A3B8;font-size:12px">데이터 없음</div>`:''}
</div>

<!-- Pulse 만족도 차원 -->
${pulse.length ? `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:10px">💡 펄스 서베이 차원별 현황</div>
  ${dimAvg.map(d=>{
    const pct = d.avg ? (d.avg/5)*100 : 0;
    const col = d.avg>=4?'#10B981':d.avg>=3?'#F59E0B':'#EF4444';
    return d.count>0?`
  <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
    <span style="font-size:16px;flex-shrink:0">${d.icon}</span>
    <div style="flex:1">
      <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:3px">${d.label}</div>
      <div style="background:#E2E8F0;border-radius:99px;height:4px">
        <div style="background:${col};height:4px;border-radius:99px;width:${pct}%"></div>
      </div>
    </div>
    <div style="font-size:13px;font-weight:800;color:${col};flex-shrink:0">${d.avg.toFixed(1)}</div>
  </div>`:'';
  }).filter(Boolean).join('')}
</div>` : ''}

<!-- 인사이트 -->
<div style="background:#EEF2FF;border-left:4px solid #4F46E5;border-radius:10px;padding:12px">
  <div style="font-size:12px;font-weight:700;color:#4338CA;margin-bottom:6px">💡 AI 인사이트</div>
  <div style="font-size:11px;color:#3730A3;line-height:1.7">
    ${enpsScore>=50
      ? '직원 만족도가 매우 높습니다. 추천자 비율이 높으니 채용 레퍼럴 프로그램 활성화를 고려해보세요.'
      : enpsScore>=0
      ? '만족도가 보통 수준입니다. 중립자(7-8점)를 추천자로 전환하기 위한 맞춤 액션 플랜이 필요합니다.'
      : `주의가 필요합니다. 비추천자(${detractors}명) 대상 1:1 면담을 진행하고 핵심 이탈 우려 요인을 파악하세요.`}
  </div>
</div>`;

  root.querySelectorAll('.enps-month-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{ _selMonth=btn.dataset.month; _draw(root, allEnps, months); });
  });
}
