/**
 * tenure-award.js — 근속 포상 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js'
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_tenure_awards';

const MILESTONES = [
  { years:1,  label:'1년 근속',  icon:'🌱', reward:'소정의 상품권 5만원', color:'#10B981' },
  { years:3,  label:'3년 근속',  icon:'🌿', reward:'상품권 15만원 + 감사패', color:'#059669' },
  { years:5,  label:'5년 근속',  icon:'🏆', reward:'상품권 30만원 + 기념품', color:'#F59E0B' },
  { years:10, label:'10년 근속', icon:'🥇', reward:'상품권 80만원 + 특별 연차 3일', color:'#EF4444' },
  { years:15, label:'15년 근속', icon:'💎', reward:'상품권 150만원 + 특별 연차 5일', color:'#8B5CF6' },
  { years:20, label:'20년 근속', icon:'👑', reward:'상품권 300만원 + 특별 연차 7일 + 해외연수', color:'#4F46E5' },
];

function _session()  { try { return JSON.parse(localStorage.getItem('hr_session')||'{}'); } catch { return {}; } }
function _empId()    { return _session().empId || _session().userId || 'EMP001'; }
function _empName()  { return _session().name || '직원'; }
function _joinDate() { return _session().joinDate || _session().join_date || '2023-01-01'; }

function _demoAwards() {
  const uid = _empId(); const name = _empName(); const join = _joinDate();
  const years = Math.floor((Date.now() - new Date(join).getTime()) / (365.25 * 86400000));
  const milestone = years >= 10 ? '10년 근속' : years >= 5 ? '5년 근속' : years >= 3 ? '3년 근속' : '근속 예정';
  return [
    { id:`TA_${uid}_1`, empId:uid, empName:name, years, milestone, status: years >= 3 ? 'eligible' : 'upcoming', joinDate: join, awardDate: null },
  ];
}

function _getAwards() {
  const demo = _demoAwards();
  const s = localStorage.getItem(LS);
  if (!s) { localStorage.setItem(LS, JSON.stringify(demo)); return demo; }
  try {
    const d = JSON.parse(s);
    return [...demo.filter(da=>!d.find(a=>a.id===da.id)), ...d];
  } catch { return demo; }
}

function _yearsOfService(joinDate) {
  const diff = (Date.now() - new Date(joinDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return Math.floor(diff);
}

let _root = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _root=root; _render(); }
export function unmount() { _root=null; }

function _render() {
  const awards  = _getAwards();
  const myAward = awards.find(a=>a.empId===_empId());
  const joinDate= myAward?.joinDate || _joinDate();
  const years   = _yearsOfService(joinDate);
  const nextMilestone = MILESTONES.find(m=>m.years > years);
  const achieved = MILESTONES.filter(m=>m.years <= years);

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="ta-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🏅 근속 포상</div>
      <div style="font-size:11px;color:var(--text-muted)">현재 근속 ${years}년</div>
    </div>
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    <!-- 나의 근속 현황 -->
    <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border-radius:16px;padding:20px;margin-bottom:16px;color:#fff">
      <div style="font-size:11px;opacity:0.8;margin-bottom:6px">나의 근속 현황</div>
      <div style="font-size:36px;font-weight:800;margin-bottom:4px">${years}<span style="font-size:18px;font-weight:400">년</span></div>
      <div style="font-size:12px;opacity:0.8">입사일: ${joinDate}</div>
      ${nextMilestone ? `
      <div style="margin-top:12px;background:rgba(255,255,255,0.15);border-radius:10px;padding:10px">
        <div style="font-size:11px;opacity:0.8;margin-bottom:2px">다음 마일스톤까지</div>
        <div style="font-size:13px;font-weight:700">${nextMilestone.label} — ${nextMilestone.years - years}년 남음</div>
      </div>` : `
      <div style="margin-top:12px;font-size:13px;font-weight:700">🎉 최고 근속 마일스톤 달성!</div>`}
    </div>

    <!-- 포상 타임라인 -->
    <div style="font-size:13px;font-weight:700;margin-bottom:10px">포상 로드맵</div>
    ${MILESTONES.map(m=>{
      const done = years >= m.years;
      const isCurrent = achieved.length > 0 && achieved[achieved.length-1].years === m.years;
      return `
<div style="display:flex;gap:12px;margin-bottom:12px;align-items:flex-start">
  <div style="width:40px;height:40px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;
              background:${done?m.color+'22':'var(--bg)'};border:2px solid ${done?m.color:'var(--border)'};
              ${isCurrent?`box-shadow:0 0 0 3px ${m.color}44;`:''}">
    ${done?m.icon:'⬜'}
  </div>
  <div style="flex:1;background:var(--card-bg);border:1px solid ${done?m.color+'44':'var(--border)'};border-radius:12px;padding:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
      <span style="font-size:12px;font-weight:700;color:${done?m.color:'var(--text-muted)'}">${m.label}</span>
      ${done?`<span style="font-size:10px;background:${m.color}22;color:${m.color};padding:2px 7px;border-radius:99px;font-weight:700">달성</span>`:''}
    </div>
    <div style="font-size:11px;color:var(--text-muted)">${m.reward}</div>
  </div>
</div>`; }).join('')}

    <!-- 전체 수상자 현황 -->
    <div style="font-size:13px;font-weight:700;margin:16px 0 10px">최근 수상자</div>
    ${_renderAwardHistory(awards)}
  </div>
</div>`;

  _root.querySelector('#ta-back').addEventListener('click', ()=>window.navBack());
}

function _renderAwardHistory(awards) {
  const received = awards.filter(a=>a.status==='received');
  if (!received.length) return '<div style="text-align:center;padding:24px 16px;color:var(--text-muted);font-size:12px">아직 수상자가 없습니다.</div>';
  return received.map(a => {
    const icon = MILESTONES.find(m=>m.years===a.years)?.icon||'🏅';
    return `<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
  <div>
    <div style="font-size:12px;font-weight:700">${a.empName}</div>
    <div style="font-size:11px;color:var(--text-muted)">${a.milestone} · ${a.awardDate}</div>
  </div>
  <span style="font-size:20px">${icon}</span>
</div>`;
  }).join('');
}
