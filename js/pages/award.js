/**
 * award.js — 직원 포상 추천 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
import { loadDisplayEmployees } from '../data/demo_employees.js';

const LS = 'hr_award_nominations';

const AWARD_TYPES = [
  { key:'mvp',         label:'이달의 MVP',  icon:'🏆', desc:'탁월한 성과를 낸 직원' },
  { key:'teamwork',    label:'팀워크 상',   icon:'🤝', desc:'협업에 뛰어난 기여를 한 직원' },
  { key:'innovation',  label:'혁신 상',     icon:'💡', desc:'새로운 아이디어나 방법을 도입한 직원' },
  { key:'growth',      label:'성장 상',     icon:'🌱', desc:'가장 눈에 띄게 성장한 직원' },
  { key:'customer',    label:'고객 감동 상', icon:'⭐', desc:'고객 만족도 향상에 기여한 직원' },
];

let _employees = [];

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }

const STATUS_META = {
  pending:  { label:'검토 중', color:'#F59E0B', bg:'#FEF3C7' },
  approved: { label:'선정',   color:'#10B981', bg:'#ECFDF5' },
  rejected: { label:'미선정', color:'var(--text-muted)', bg:'#F1F5F9' },
};

function _getAll()  { try { return JSON.parse(localStorage.getItem(LS)||'[]'); } catch { return []; } }
function _save(l)   { localStorage.setItem(LS, JSON.stringify(l)); }

let _tab     = 'nominate';
let _selType = 'mvp';
let _selEmp  = '';
let _root    = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _employees = await loadDisplayEmployees();
  _root=root; _tab='nominate'; _selType='mvp'; _selEmp=''; _render(); }
export function unmount() { _tab = 'nominate'; _root=null; }

function _render() {
  const myNoms = _getAll().filter(n=>n.nominatorId===_empId());

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="aw-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🏆 직원 포상 추천</div>
      <div style="font-size:11px;color:var(--text-muted)">내 추천 ${myNoms.length}건</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['nominate','추천하기'],['mine','내 추천'],['winners','수상자']].map(([k,l])=>`
    <button class="aw-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:11px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='nominate' ? _renderNominate()
    : _tab==='mine'     ? _renderMine(myNoms)
    :                     _renderWinners()}
  </div>
</div>`;

  _root.querySelector('#aw-back').addEventListener('click', ()=>window.navBack());
  _root.querySelectorAll('.aw-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(); }));
  if (_tab==='nominate') _bindNominate();
}

function _renderNominate() {
  const myId = _empId();
  const peers = _employees.filter(e=>e.id!==myId);

  return `
<!-- 포상 유형 -->
<div style="margin-bottom:14px">
  <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px">포상 유형 선택</div>
  ${AWARD_TYPES.map(t=>`
  <div class="aw-type" data-type="${t.key}"
    style="display:flex;align-items:center;gap:10px;padding:10px 12px;
           border-radius:10px;border:1.5px solid ${_selType===t.key?'#4F46E5':'var(--border)'};
           background:${_selType===t.key?'#EEF2FF':'var(--card-bg)'};cursor:pointer;margin-bottom:6px">
    <span style="font-size:20px">${t.icon}</span>
    <div style="flex:1">
      <div style="font-size:12px;font-weight:700;color:${_selType===t.key?'#4F46E5':'var(--text)'}">${t.label}</div>
      <div style="font-size:10px;color:var(--text-muted)">${t.desc}</div>
    </div>
    ${_selType===t.key?`<span style="color:#4F46E5;font-size:16px">✓</span>`:''}
  </div>`).join('')}
</div>

<!-- 추천 대상 -->
<div style="margin-bottom:14px">
  <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:6px">추천 대상</div>
  <select id="aw-emp"
    style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
           background:var(--bg);color:var(--text);font-size:12px">
    <option value="">-- 동료 선택 --</option>
    ${peers.map(e=>`<option value="${e.id}" data-name="${e.name}" ${_selEmp===e.id?'selected':''}>${e.name} (${e.dept})</option>`).join('')}
  </select>
</div>

<!-- 추천 사유 -->
<div style="margin-bottom:14px">
  <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px">추천 사유 *</div>
  <textarea maxlength="500" id="aw-reason" rows="4"
    placeholder="이 동료를 추천하는 이유를 구체적으로 입력해 주세요 (최소 30자)"
    style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
           background:var(--bg);color:var(--text);font-size:12px;resize:none;box-sizing:border-box"></textarea>
</div>

<button id="aw-submit"
  style="width:100%;padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;
         font-size:13px;font-weight:700;cursor:pointer">추천 제출</button>`;
}

function _renderMine(noms) {
  if (!noms.length) return `
<div style="text-align:center;padding:48px 16px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">🏆</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:4px">추천 내역이 없습니다</div>
      <button onclick="location.hash='#/award'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">동료 추천</button>
    
  <div style="font-size:12px">훌륭한 동료를 추천해 보세요!</div>
</div>`;

  return [...noms].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(n=>{
    const meta  = STATUS_META[n.status]||STATUS_META.pending;
    const atype = AWARD_TYPES.find(t=>t.key===n.awardType)||AWARD_TYPES[0];
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div style="display:flex;gap:8px;align-items:center">
      <span style="font-size:20px">${atype.icon}</span>
      <div>
        <div style="font-size:12px;font-weight:700">${atype.label}</div>
        <div style="font-size:11px;color:var(--text-muted)">추천 대상: ${n.nomineeName}</div>
      </div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;
                 background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>
  <div style="font-size:11px;color:var(--text-muted)">${n.reason}</div>
  <div style="font-size:10px;color:var(--text-muted);margin-top:4px">${n.createdAt}</div>
</div>`; }).join('');
}

function _renderWinners() {
  const approved = _getAll().filter(n=>n.status==='approved');
  if (!approved.length) return `
<div style="text-align:center;padding:48px 16px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">🏆</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:4px">선정된 수상자가 없습니다</div>
</div>`;

  return approved.map(n=>{
    const atype = AWARD_TYPES.find(t=>t.key===n.awardType)||AWARD_TYPES[0];
    return `
<div style="background:linear-gradient(135deg,#FEF3C7,#FDE68A);border:1px solid #FCD34D;
     border-radius:14px;padding:14px;margin-bottom:10px;text-align:center">
  <div style="font-size:32px;margin-bottom:6px">${atype.icon}</div>
  <div style="font-size:14px;font-weight:800;color:#92400E">${atype.label}</div>
  <div style="font-size:18px;font-weight:700;color:#78350F;margin:4px 0">${n.nomineeName}</div>
  <div style="font-size:11px;color:#92400E">${n.createdAt}</div>
</div>`; }).join('');
}

function _bindNominate() {
  _root.querySelectorAll('.aw-type').forEach(el=>{
    el.addEventListener('click',()=>{ _selType=el.dataset.type; _render(); });
  });

  _root.querySelector('#aw-emp')?.addEventListener('change',e=>{
    _selEmp=e.target.value;
  });

  _root.querySelector('#aw-submit')?.addEventListener('click',()=>{
    const empSel = _root.querySelector('#aw-emp');
    const empId  = empSel?.value;
    const empName = empSel?.options[empSel.selectedIndex]?.dataset.name;
    const reason = _root.querySelector('#aw-reason')?.value.trim();
    if (!empId)       { showToast('추천 대상을 선택해 주세요.', 'error'); return; }
    if (!reason || reason.length<10) { showToast('추천 사유를 10자 이상 입력해 주세요.', 'error'); return; }
    const noms = _getAll();
    noms.push({
      id:          'AWN_'+Date.now(),
      nominatorId: _empId(),
      nominatorName: _empName(),
      nomineeId:   empId,
      nomineeName: empName||empId,
      awardType:   _selType,
      reason,
      status:      'pending',
      createdAt:   new Date().toISOString().slice(0,10),
    });
    _save(noms);
    showToast('추천이 제출됐습니다.', 'success')
    addNotification({ type: 'success', title: '수상 추천', body: '추천이 제출됐습니다.' });
    _tab='mine'; _selEmp=''; _render();
  });
}
