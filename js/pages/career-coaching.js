/**
 * career-coaching.js — 커리어 코칭 신청 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
const TODAY = new Date().toISOString().slice(0,10);

const LS_REQS     = 'hr_coaching_requests';
const LS_SESSIONS = 'hr_coaching_sessions';

const COACHES = [
  { id:'COACH001', name:'이상훈 코치', title:'커리어 전문 코치', areas:['리더십 전환','커리어 설계','팀 관리'], avatar:'🎯', bio:'20년 기업 인사 경력, ICF 인증 코치', avail:true },
  { id:'COACH002', name:'박선영 코치', title:'직무 역량 전문가', areas:['기술 역량','직무 전환','성과 관리'],  avatar:'📊', bio:'HR 컨설팅 15년, 코칭 심리학 석사', avail:true },
  { id:'COACH003', name:'김태원 코치', title:'임원 코칭 전문가', areas:['임원 리더십','조직 변화','스트레스 관리'], avatar:'💡', bio:'글로벌 기업 임원 코칭 전문가', avail:false },
];

const TOPICS = ['커리어 방향 설계', '리더십 역량 개발', '직무 전환 준비', '성과 개선', '번아웃·스트레스 관리', '대인관계·팀 갈등', '기타'];

const STATUS_META = {
  pending:   { label:'검토 중',  color:'#F59E0B', bg:'#FEF3C7' },
  scheduled: { label:'일정 확정', color:'#3B82F6', bg:'#EFF6FF' },
  completed: { label:'완료',     color:'#10B981', bg:'#ECFDF5' },
  cancelled: { label:'취소',     color:'var(--text-muted)', bg:'#F1F5F9' },
};

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }

function _getReqs() { try { return JSON.parse(localStorage.getItem(LS_REQS)||'[]'); } catch { return []; } }
function _getSessions() { try { return JSON.parse(localStorage.getItem(LS_SESSIONS)||'[]'); } catch { return []; } }
function _saveReqs(l) { localStorage.setItem(LS_REQS, JSON.stringify(l)); }

let _tab       = 'coaches';
let _selCoach  = null;
let _selTopic  = '커리어 방향 설계';
let _root      = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _root=root; _tab='coaches'; _selCoach=null; _render(); }
export function unmount() { _tab = 'coaches'; _root=null; }

function _render() {
  const myReqs     = _getReqs().filter(r=>r.empId===_empId());
  const mySessions = _getSessions().filter(s=>s.empId===_empId());
  const scheduled  = myReqs.filter(r=>r.status==='scheduled').length;

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="cc-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🎯 커리어 코칭</div>
      <div style="font-size:11px;color:var(--text-muted)">세션 신청 ${myReqs.length}건</div>
    </div>
    ${scheduled ? `<div style="background:#3B82F6;color:#fff;border-radius:99px;padding:3px 10px;font-size:12px;font-weight:700">예정 ${scheduled}</div>` : ''}
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['coaches','코치 목록'],['request','신청하기'],['mine','내 세션']].map(([k,l])=>`
    <button class="cc-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:11px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='coaches' ? _renderCoaches()
    : _tab==='request' ? _renderRequest()
    :                    _renderMine(myReqs)}
  </div>
</div>`;

  _root.querySelector('#cc-back').addEventListener('click', ()=>window.navBack());
  _root.querySelectorAll('.cc-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(); }));
  if (_tab==='coaches') _bindCoaches();
  if (_tab==='request') _bindRequest();
}

function _renderCoaches() {
  return COACHES.map(c=>`
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px">
    <div style="width:44px;height:44px;border-radius:50%;background:#EEF2FF;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${c.avatar}</div>
    <div style="flex:1">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
        <span style="font-size:14px;font-weight:700">${c.name}</span>
        ${c.avail ? `<span style="font-size:10px;background:#D1FAE5;color:#10B981;padding:1px 6px;border-radius:99px;font-weight:700">가능</span>` : `<span style="font-size:10px;background:#F1F5F9;color:var(--text-muted);padding:1px 6px;border-radius:99px;font-weight:700">마감</span>`}
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">${c.title}</div>
      <div style="font-size:10px;color:var(--text-muted)">${c.bio}</div>
    </div>
  </div>
  <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px">
    ${c.areas.map(a=>`<span style="font-size:10px;background:#EEF2FF;color:#4F46E5;padding:3px 8px;border-radius:99px">${a}</span>`).join('')}
  </div>
  <button class="cc-select" data-id="${c.id}" data-name="${c.name}" ${c.avail?'':'disabled'}
    style="width:100%;padding:8px;background:${c.avail?'#4F46E5':'#F1F5F9'};color:${c.avail?'#fff':'var(--text-muted)'};
           border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:${c.avail?'pointer':'not-allowed'}">
    ${c.avail?'이 코치와 세션 신청':'현재 신청 불가'}
  </button>
</div>`).join('');
}

function _renderRequest() {
  const coach = _selCoach ? COACHES.find(c=>c.id===_selCoach) : null;
  return `
${coach ? `
<div style="background:#EEF2FF;border-radius:10px;padding:10px 12px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
  <span style="font-size:20px">${coach.avatar}</span>
  <div>
    <div style="font-size:12px;font-weight:700;color:#4F46E5">${coach.name}</div>
    <div style="font-size:10px;color:#4338CA">${coach.title}</div>
  </div>
</div>` : `
<div style="background:#FEF3C7;border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:#92400E">
  ⚠️ 코치 목록 탭에서 코치를 먼저 선택해 주세요.
</div>`}

<div style="margin-bottom:12px">
  <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">코칭 코치 *</div>
  <select id="cc-coach"
    style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
           background:var(--bg);color:var(--text);font-size:12px">
    <option value="">선택</option>
    ${COACHES.filter(c=>c.avail).map(c=>`<option value="${c.id}" data-name="${c.name}" ${_selCoach===c.id?'selected':''}>${c.avatar} ${c.name}</option>`).join('')}
  </select>
</div>

<div style="margin-bottom:12px">
  <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">코칭 주제</div>
  <select id="cc-topic"
    style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
           background:var(--bg);color:var(--text);font-size:12px">
    ${TOPICS.map(t=>`<option value="${t}" ${_selTopic===t?'selected':''}>${t}</option>`).join('')}
  </select>
</div>

<div style="margin-bottom:12px">
  <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">희망 일시</div>
  <input id="cc-date" type="date"
    style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
           background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box" min="${TODAY}">
</div>

<div style="margin-bottom:14px">
  <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">현재 상황 및 코칭 목표 *</div>
  <textarea maxlength="500" id="cc-goal" rows="4"
    placeholder="현재 어떤 어려움이 있는지, 코칭을 통해 무엇을 얻고 싶은지 자유롭게 써 주세요"
    style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
           background:var(--bg);color:var(--text);font-size:12px;resize:none;box-sizing:border-box"></textarea>
</div>

<button id="cc-submit"
  style="width:100%;padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;
         font-size:13px;font-weight:700;cursor:pointer">코칭 신청</button>`;
}

function _renderMine(reqs) {
  const sorted = [...reqs].sort((a,b)=>b.reqDate.localeCompare(a.reqDate));
  if (!sorted.length) return `
<div style="text-align:center;padding:48px 16px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">🎯</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:4px">신청한 코칭이 없습니다</div>
      <button onclick="location.hash='#/career-coaching'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">코칭 신청</button>
    
  <div style="font-size:12px">커리어 코칭을 통해 성장해 보세요!</div>
</div>`;

  return sorted.map(r=>{
    const meta = STATUS_META[r.status]||STATUS_META.pending;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div>
      <div style="font-size:13px;font-weight:700">${r.topic}</div>
      <div style="font-size:11px;color:var(--text-muted)">${r.coachName} · ${r.reqDate}</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;
                 background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>
  <div style="font-size:11px;color:var(--text-muted)">${r.goal.slice(0,60)}${r.goal.length>60?'…':''}</div>
  ${r.sessionDate?`<div style="font-size:11px;color:#3B82F6;margin-top:4px">📅 세션 일시: ${r.sessionDate}</div>`:''}
</div>`; }).join('');
}

function _bindCoaches() {
  _root.querySelectorAll('.cc-select').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if (btn.disabled) return;
      _selCoach = btn.dataset.id;
      _tab = 'request';
      _render();
    });
  });
}

function _bindRequest() {
  _root.querySelector('#cc-coach')?.addEventListener('change',e=>{ _selCoach=e.target.value||null; });
  _root.querySelector('#cc-topic')?.addEventListener('change',e=>{ _selTopic=e.target.value; });

  _root.querySelector('#cc-submit')?.addEventListener('click',()=>{
    const coachSel  = _root.querySelector('#cc-coach');
    const coachId   = coachSel?.value || _selCoach;
    const coachName = coachSel?.options[coachSel.selectedIndex]?.dataset.name || COACHES.find(c=>c.id===coachId)?.name;
    const topic     = _root.querySelector('#cc-topic')?.value || _selTopic;
    const date      = _root.querySelector('#cc-date')?.value;
    const goal      = _root.querySelector('#cc-goal')?.value.trim();
    if (!coachId)  { showToast('코치를 선택해 주세요.', 'error'); return; }
    if (!goal)     { showToast('코칭 목표를 입력해 주세요.', 'error'); return; }
    const reqs = _getReqs();
    reqs.push({
      id:          'CC_'+Date.now(),
      empId:       _empId(),
      empName:     _empName(),
      coachId,
      coachName:   coachName||coachId,
      topic,
      prefDate:    date,
      goal,
      status:      'pending',
      reqDate:     new Date().toISOString().slice(0,10),
      sessionDate: null,
    });
    _saveReqs(reqs);
    showToast('커리어 코칭 신청이 완료됐습니다.', 'success')
    addNotification({ type: 'success', title: '코칭 신청', body: '커리어 코칭 신청이 완료됐습니다.' });
    _tab='mine'; _selCoach=null; _render();
  });
}
