/**
 * work-anniversary.js — 근속 기념일 (직원)
 * Route: #/work-anniversary
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const MILESTONES = [
  { years:1,  label:'1년',  badge:'🥉', reward:'감사 카드',                     color:'#CD7F32' },
  { years:3,  label:'3년',  badge:'🥈', reward:'상품권 10만원',                 color:'#9CA3AF' },
  { years:5,  label:'5년',  badge:'🥇', reward:'포상금 30만원 + 추가 휴가 1일', color:'#F59E0B' },
  { years:10, label:'10년', badge:'💎', reward:'포상금 100만원 + 안식 휴가 1주', color:'#3B82F6' },
  { years:15, label:'15년', badge:'👑', reward:'포상금 200만원',                 color:'#8B5CF6' },
  { years:20, label:'20년', badge:'🏆', reward:'포상금 500만원 + 안식 여행',    color:'#EF4444' },
];

function _session() { try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; } }

function _calcInfo(joinDateStr) {
  const today    = new Date();
  const joinDate = new Date(joinDateStr);
  const todayY   = today.getFullYear();
  const todayM   = today.getMonth();
  const todayD   = today.getDate();

  // Years of service (elapsed full years)
  let yearsServed = todayY - joinDate.getFullYear();
  const annivThisYearDate = new Date(todayY, joinDate.getMonth(), joinDate.getDate());
  if (today < annivThisYearDate) yearsServed--;

  // Next anniversary date
  let nextAnnivYear = todayY;
  if (today >= annivThisYearDate) nextAnnivYear = todayY + 1;
  const nextAnnivDate = new Date(nextAnnivYear, joinDate.getMonth(), joinDate.getDate());
  const dDiff = Math.ceil((nextAnnivDate - today) / (1000 * 60 * 60 * 24));

  return { yearsServed: Math.max(0, yearsServed), dDiff, nextAnnivDate, joinDate };
}

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

export function unmount() {}

function _render(root) {
  const session  = _session();
  const rawJoin  = session.joinDate || '2022-03-15';
  const isMock   = !session.joinDate;
  const info     = _calcInfo(rawJoin);

  const { yearsServed, dDiff, nextAnnivDate, joinDate } = info;

  const nextMilestone = MILESTONES.find(m => m.years > yearsServed);
  const nextMilestoneYears = nextMilestone ? nextMilestone.years - yearsServed : null;

  root.innerHTML = `
<div style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg,#F8FAFC)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--card-bg,#fff);border-bottom:1px solid var(--border,#E2E8F0);flex-shrink:0">
    <button id="wa-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text,#1E293B);padding:0;line-height:1">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700;color:var(--text,#1E293B)">🎂 근속 기념일</div>
      <div style="font-size:11px;color:var(--text-muted)">입사일 ${rawJoin}${isMock?' (예시)':''}</div>
    </div>
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">
    ${isMock ? `<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#92400E">
      ⚠️ 입사일 정보가 없어 예시(2022-03-15)로 표시합니다.
    </div>` : ''}

    <!-- 메인 카드 -->
    <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border-radius:16px;padding:20px;margin-bottom:16px;color:#fff;text-align:center">
      <div style="font-size:11px;opacity:0.75;margin-bottom:4px">현재 근속 연수</div>
      <div style="font-size:40px;font-weight:800;margin-bottom:4px">${yearsServed}<span style="font-size:18px;font-weight:400">년</span></div>
      <div style="font-size:12px;opacity:0.8;margin-bottom:16px">입사일: ${rawJoin}</div>
      <div style="background:rgba(255,255,255,0.15);border-radius:12px;padding:12px">
        <div style="font-size:11px;opacity:0.75;margin-bottom:4px">다음 기념일까지</div>
        <div style="font-size:28px;font-weight:800">D-${dDiff}</div>
        <div style="font-size:11px;opacity:0.75;margin-top:2px">${nextAnnivDate.toLocaleDateString('ko-KR', {year:'numeric',month:'long',day:'numeric'})}</div>
      </div>
      ${nextMilestone ? `<div style="margin-top:12px;font-size:12px;opacity:0.85">
        다음 마일스톤 ${nextMilestone.label}까지 <strong>${nextMilestoneYears}년</strong> 남음
      </div>` : `<div style="margin-top:12px;font-size:12px;opacity:0.85">🏆 최고 마일스톤 달성!</div>`}
    </div>

    <!-- 마일스톤 타임라인 -->
    <div style="background:var(--card-bg,#fff);border:1px solid var(--border,#E2E8F0);border-radius:14px;padding:16px">
      <div style="font-size:14px;font-weight:700;color:var(--text,#1E293B);margin-bottom:14px">🏅 마일스톤 타임라인</div>
      ${MILESTONES.map((m, idx) => {
        const passed  = yearsServed >= m.years;
        const current = yearsServed >= m.years && (idx === MILESTONES.length - 1 || yearsServed < MILESTONES[idx+1].years);
        return `
<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:${idx < MILESTONES.length-1 ? '0' : '0'}">
  <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">
    <div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;
      background:${passed?m.color+'22':'var(--bg,#F8FAFC)'};border:2px solid ${passed?m.color:'var(--border,#E2E8F0)'};
      ${current?`box-shadow:0 0 0 3px ${m.color}44`:''}">${passed ? m.badge : '○'}</div>
    ${idx < MILESTONES.length-1 ? `<div style="width:2px;height:28px;background:${passed?m.color+'44':'var(--border,#E2E8F0)'}"></div>` : ''}
  </div>
  <div style="flex:1;padding-top:5px;padding-bottom:${idx < MILESTONES.length-1 ? '28px' : '0'}">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
      <span style="font-size:13px;font-weight:700;color:${passed?m.color:'var(--text-muted)'}">${m.label}</span>
      ${current ? `<span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:6px;background:${m.color}22;color:${m.color}">현재</span>` : ''}
      ${passed && !current ? `<span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:6px;background:#ECFDF5;color:#10B981">달성</span>` : ''}
    </div>
    <div style="font-size:12px;color:${passed?'#475569':'var(--text-muted)'}">${m.reward}</div>
  </div>
</div>`;
      }).join('')}
    </div>
  </div>
</div>`;

  root.querySelector('#wa-back').addEventListener('click', () => window.navBack());
}
