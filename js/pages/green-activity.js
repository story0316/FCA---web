/**
 * green-activity.js — 환경·그린 활동 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_green_activities';

const ACTIVITY_TYPES = [
  { key:'paperless',  label:'종이 절약',   icon:'📄', points:10, desc:'불필요한 출력 자제, 전자문서 사용' },
  { key:'transport',  label:'친환경 출퇴근', icon:'🚴', points:20, desc:'자전거·도보·대중교통 이용' },
  { key:'energy',     label:'에너지 절약', icon:'💡', points:15, desc:'불 끄기, 대기전력 차단, 절전 실천' },
  { key:'tumbler',    label:'텀블러 사용', icon:'♻️', points:10, desc:'일회용컵 대신 개인 컵·텀블러 사용' },
  { key:'recycling',  label:'분리수거',    icon:'🗑️', points:10, desc:'올바른 분리수거 실천' },
  { key:'volunteer',  label:'환경 봉사',   icon:'🌱', points:50, desc:'환경 정화 봉사 활동 참여' },
  { key:'other',      label:'기타 활동',   icon:'🌿', points:5,  desc:'기타 친환경 활동' },
];

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }

function _getAll() { try { return JSON.parse(localStorage.getItem(LS)||'[]'); } catch { return []; } }
function _save(l)  { localStorage.setItem(LS, JSON.stringify(l)); }

let _tab     = 'log';
let _selType = 'paperless';
let _root    = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _root=root; _tab='log'; _selType='paperless'; _render(); }
export function unmount() { _tab = 'log'; _root=null; }

function _render() {
  const myId     = _empId();
  const all      = _getAll();
  const myLogs   = all.filter(a=>a.empId===myId);
  const myPoints = myLogs.reduce((s,a)=>s+a.points,0);

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="gr-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🌿 그린 활동</div>
      <div style="font-size:11px;color:var(--text-muted)">활동 ${myLogs.length}건 · ${myPoints}포인트</div>
    </div>
    <div style="background:#D1FAE5;color:#10B981;border-radius:99px;padding:3px 10px;font-size:12px;font-weight:700">
      🌱 ${myPoints}P
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['log','활동 기록'],['mine','내 기록'],['rank','랭킹']].map(([k,l])=>`
    <button class="gr-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:11px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#10B981':'transparent'};
             color:${_tab===k?'#10B981':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='log'  ? _renderLog()
    : _tab==='mine' ? _renderMine(myLogs, myPoints)
    :                 _renderRank(all)}
  </div>
</div>`;

  _root.querySelector('#gr-back').addEventListener('click', ()=>window.navBack());
  _root.querySelectorAll('.gr-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(); }));
  if (_tab==='log') _bindLog();
}

function _renderLog() {
  return `
<!-- 활동 유형 선택 -->
<div style="margin-bottom:14px">
  <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px">활동 유형</div>
  ${ACTIVITY_TYPES.map(t=>`
  <div class="gr-type" data-type="${t.key}"
    style="display:flex;align-items:center;gap:10px;padding:10px 12px;
           border-radius:10px;border:1.5px solid ${_selType===t.key?'#10B981':'var(--border)'};
           background:${_selType===t.key?'#ECFDF5':'var(--card-bg)'};cursor:pointer;margin-bottom:6px">
    <span style="font-size:20px">${t.icon}</span>
    <div style="flex:1">
      <div style="font-size:12px;font-weight:700;color:${_selType===t.key?'#10B981':'var(--text)'}">${t.label}</div>
      <div style="font-size:10px;color:var(--text-muted)">${t.desc} · +${t.points}P</div>
    </div>
    <span style="font-size:12px;font-weight:700;color:#10B981">+${t.points}P</span>
  </div>`).join('')}
</div>

<!-- 메모 -->
<div style="margin-bottom:14px">
  <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">활동 메모 (선택)</div>
  <textarea maxlength="500" id="gr-memo" rows="3"
    placeholder="어떤 활동을 했는지 간략히 적어보세요"
    style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
           background:var(--card-bg);color:var(--text);font-size:12px;resize:none;box-sizing:border-box"></textarea>
</div>

<button id="gr-submit"
  style="width:100%;padding:12px;background:#10B981;color:#fff;border:none;border-radius:10px;
         font-size:13px;font-weight:700;cursor:pointer">활동 기록하기</button>`;
}

function _renderMine(logs, points) {
  const sorted = [...logs].sort((a,b)=>b.date.localeCompare(a.date));
  const thisMonth = new Date().toISOString().slice(0,7);
  const thisMonthPoints = logs.filter(l=>l.date.startsWith(thisMonth)).reduce((s,l)=>s+l.points,0);

  return `
<!-- 포인트 현황 -->
<div style="background:linear-gradient(135deg,#10B981,#059669);border-radius:16px;padding:16px;margin-bottom:14px;color:#fff">
  <div style="font-size:11px;opacity:0.8;margin-bottom:4px">누적 그린 포인트</div>
  <div style="font-size:32px;font-weight:800;margin-bottom:4px">🌱 ${points}P</div>
  <div style="font-size:12px;opacity:0.8">이번달 +${thisMonthPoints}P · 총 ${logs.length}건</div>
</div>

${!sorted.length ? `
<div style="text-align:center;padding:40px;color:var(--text-muted)">
  <div style="font-size:32px;margin-bottom:8px">🌿</div>
  <div style="font-size:13px">기록된 활동이 없습니다</div>
      <button onclick="location.hash='#/green-activity'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">활동 기록</button>
    
</div>` : `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700">활동 내역</div>
  ${sorted.map(l=>{
    const t = ACTIVITY_TYPES.find(x=>x.key===l.type)||ACTIVITY_TYPES[6];
    return `
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
    <span style="font-size:18px">${t.icon}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:12px;font-weight:600">${t.label}</div>
      ${l.memo?`<div style="font-size:10px;color:var(--text-muted)">${l.memo}</div>`:''}
      <div style="font-size:10px;color:var(--text-muted)">${l.date}</div>
    </div>
    <span style="font-size:12px;font-weight:700;color:#10B981">+${l.points}P</span>
  </div>`; }).join('')}
</div>`}`;
}

function _renderRank(all) {
  const empPoints = {};
  all.forEach(a=>{
    empPoints[a.empId] = (empPoints[a.empId]||{ name:a.empName, points:0 });
    empPoints[a.empId].points += a.points;
    empPoints[a.empId].name = a.empName;
  });
  const ranked = Object.entries(empPoints).map(([id,v])=>({ id, ...v }))
    .sort((a,b)=>b.points-a.points).slice(0,10);

  if (!ranked.length) return `
<div style="text-align:center;padding:48px;color:var(--text-muted)">
  <div style="font-size:32px;margin-bottom:8px">🏆</div>
  <div style="font-size:13px">아직 활동 기록이 없습니다.</div>
</div>`;

  const medals = ['🥇','🥈','🥉'];
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700">그린 히어로 랭킹 🌍</div>
  ${ranked.map((e,i)=>`
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
    <span style="font-size:18px;width:24px;text-align:center">${medals[i]||String(i+1)+'위'}</span>
    <div style="flex:1">
      <span style="font-size:13px;font-weight:700">${e.name}</span>
    </div>
    <span style="font-size:13px;font-weight:700;color:#10B981">🌱 ${e.points}P</span>
  </div>`).join('')}
</div>`;
}

function _bindLog() {
  _root.querySelectorAll('.gr-type').forEach(el=>{
    el.addEventListener('click',()=>{ _selType=el.dataset.type; _render(); });
  });

  _root.querySelector('#gr-submit')?.addEventListener('click',()=>{
    const memo = _root.querySelector('#gr-memo')?.value.trim();
    const type = ACTIVITY_TYPES.find(t=>t.key===_selType)||ACTIVITY_TYPES[0];
    const all  = _getAll();
    all.push({
      id:      'GA_'+Date.now(),
      empId:   _empId(),
      empName: _empName(),
      type:    _selType,
      points:  type.points,
      memo,
      date:    new Date().toISOString().slice(0,10),
    });
    _save(all);
    showToast(`${type.label} 활동이 기록됐습니다. +${type.points}P`, 'success')
    addNotification({ type: 'success', title: '환경 활동', body: '활동이 기록됐습니다. +P' });
    _tab='mine'; _render();
  });
}
