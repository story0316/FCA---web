/**
 * green-admin.js — 환경·그린 활동 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_green_activities';

const ACTIVITY_TYPES = [
  { key:'paperless',  label:'종이 절약',    icon:'📄', points:10 },
  { key:'transport',  label:'친환경 출퇴근', icon:'🚴', points:20 },
  { key:'energy',     label:'에너지 절약',  icon:'💡', points:15 },
  { key:'tumbler',    label:'텀블러 사용',  icon:'♻️', points:10 },
  { key:'recycling',  label:'분리수거',     icon:'🗑️', points:10 },
  { key:'volunteer',  label:'환경 봉사',    icon:'🌱', points:50 },
  { key:'other',      label:'기타',         icon:'🌿', points:5  },
];

const LEGACY_IDS = new Set(['GA001','GA002','GA003','GA004','GA005','GA006','GA007','GA008']);

function _getAll() {
  try {
    const d = JSON.parse(localStorage.getItem(LS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_IDS.has(r.id));
    if (cleaned.length !== list.length) localStorage.setItem(LS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}

let _tab  = 'overview';
let _root = null;

export function render(root) { _root=root; _tab='overview'; _draw(); }
export function unmount() { _root=null;
  _tab = 'overview';
}

function _draw() {
  const activities = _getAll();
  const totalPoints= activities.reduce((s,a)=>s+a.points,0);
  const thisMonth  = new Date().toISOString().slice(0,7);
  const monthActivities = activities.filter(a=>a.date.startsWith(thisMonth));

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['overview','활동 현황'],['stats','유형별 통계']].map(([k,l])=>`
    <button class="gra-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'#10B981':'transparent'};
             color:${_tab===k?'#10B981':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='overview' ? _renderOverview(activities, monthActivities, totalPoints)
    :                     _renderStats(activities)}
  </div>
</div>`;

  _root.querySelectorAll('.gra-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
}

function _renderOverview(activities, monthActivities, totalPoints) {
  if (!activities || !activities.length) return `<div style="text-align:center;padding:48px 20px;color:#94A3B8"><div style="font-size:40px;margin-bottom:10px">🌱</div><div style="font-size:14px;font-weight:600;margin-bottom:4px">그린 활동이 없습니다.</div></div>`;

  const participants = new Set(activities.map(a=>a.empId)).size;
  const monthPoints  = monthActivities.reduce((s,a)=>s+a.points,0);

  // per-employee ranking
  const empMap = {};
  activities.forEach(a=>{
    empMap[a.empId] = empMap[a.empId] || { name:a.empName, points:0, count:0 };
    empMap[a.empId].points += a.points;
    empMap[a.empId].count++;
  });
  const ranked = Object.values(empMap).sort((a,b)=>b.points-a.points);

  return `
<!-- KPI -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
  ${[
    ['총 활동', `${activities.length}건`, '#10B981'],
    ['이번달', `${monthActivities.length}건`, '#3B82F6'],
    ['총 포인트', `${totalPoints}P`, '#F59E0B'],
  ].map(([l,v,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:16px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8">${l}</div>
  </div>`).join('')}
</div>

<!-- 랭킹 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:12px">
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700">
    그린 히어로 랭킹 🌍
  </div>
  ${ranked.slice(0,8).map((e,i)=>{
    const medals = ['🥇','🥈','🥉'];
    return `
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
    <span style="font-size:16px;width:22px;text-align:center">${medals[i]||`${i+1}`}</span>
    <div style="flex:1">
      <div style="font-size:12px;font-weight:600">${e.name}</div>
      <div style="font-size:10px;color:#94A3B8">${e.count}건 활동</div>
    </div>
    <span style="font-size:13px;font-weight:700;color:#10B981">🌱 ${e.points}P</span>
  </div>`; }).join('')}
</div>

<!-- 최근 활동 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700">최근 활동</div>
  ${[...activities].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10).map(a=>{
    const t = ACTIVITY_TYPES.find(x=>x.key===a.type)||ACTIVITY_TYPES[6];
    return `
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
    <span style="font-size:16px">${t.icon}</span>
    <div style="flex:1">
      <div style="font-size:12px;font-weight:600">${a.empName} · ${t.label}</div>
      <div style="font-size:10px;color:#94A3B8">${a.date}${a.memo?` · ${a.memo}`:''}</div>
    </div>
    <span style="font-size:11px;font-weight:700;color:#10B981">+${a.points}P</span>
  </div>`; }).join('')}
</div>`;
}

function _renderStats(activities) {
  const typeStats = ACTIVITY_TYPES.map(t=>{
    const list   = activities.filter(a=>a.type===t.key);
    const points = list.reduce((s,a)=>s+a.points,0);
    return { ...t, count:list.length, totalPoints:points };
  }).filter(t=>t.count>0).sort((a,b)=>b.count-a.count);

  const maxCount = typeStats.reduce((m,t)=>Math.max(m,t.count),1);

  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
  <div style="font-size:13px;font-weight:700;margin-bottom:12px">유형별 활동 현황</div>
  ${typeStats.map(t=>`
  <div style="margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
      <span style="font-weight:600">${t.icon} ${t.label}</span>
      <span style="font-weight:700;color:#10B981">${t.count}건 · ${t.totalPoints}P</span>
    </div>
    <div style="background:var(--bg);border-radius:6px;height:6px">
      <div style="height:100%;border-radius:6px;background:#10B981;width:${t.count/maxCount*100}%"></div>
    </div>
  </div>`).join('')}
</div>

<div style="background:linear-gradient(135deg,#ECFDF5,#D1FAE5);border-radius:14px;padding:14px;text-align:center">
  <div style="font-size:24px;margin-bottom:6px">🌍</div>
  <div style="font-size:13px;font-weight:700;color:#065F46;margin-bottom:4px">전사 그린 포인트 합산</div>
  <div style="font-size:28px;font-weight:800;color:#10B981">${activities.reduce((s,a)=>s+a.points,0)}P</div>
  <div style="font-size:11px;color:#047857;margin-top:4px">총 ${new Set(activities.map(a=>a.empId)).size}명 참여</div>
</div>`;
}
export function mount(root) { return render(root); }
