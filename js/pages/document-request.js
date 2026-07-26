/**
 * document-request.js — 서류·증명서 발급 신청 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_document_requests';

const DOC_TYPES = [
  { key:'employment',  label:'재직증명서',       icon:'📄', desc:'현재 재직 중임을 증명하는 서류', processDays:1 },
  { key:'career',      label:'경력증명서',        icon:'📋', desc:'근무 경력을 증명하는 서류', processDays:2 },
  { key:'salary',      label:'급여확인서',        icon:'💰', desc:'급여 수준을 확인하는 서류', processDays:2 },
  { key:'tax',         label:'근로소득원천징수확인서', icon:'🧾', desc:'연간 원천징수 내역 확인서', processDays:3 },
  { key:'insurance',   label:'건강보험료납부확인서', icon:'🏥', desc:'건강보험료 납부 내역 확인서', processDays:2 },
  { key:'pension',     label:'국민연금가입확인서',  icon:'📑', desc:'국민연금 가입 내역 확인서', processDays:1 },
  { key:'retirement',  label:'퇴직증명서',        icon:'📰', desc:'퇴직 사실을 증명하는 서류', processDays:3 },
];

const PURPOSES = ['금융기관 제출', '임대차 계약', '비자 신청', '학자금 대출', '정부 기관 제출', '기타'];

const STATUS_META = {
  pending:  { label:'처리 중', color:'#F59E0B', bg:'#FEF3C7' },
  ready:    { label:'발급 완료', color:'#10B981', bg:'#ECFDF5' },
  issued:   { label:'수령 완료', color:'var(--text-muted)', bg:'#F1F5F9' },
  rejected: { label:'반려',    color:'#EF4444', bg:'#FEE2E2' },
};

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }

function _getAll() { try { return JSON.parse(localStorage.getItem(LS)||'[]'); } catch { return []; } }
function _save(l)  { localStorage.setItem(LS, JSON.stringify(l)); }

let _tab     = 'request';
let _selType = 'employment';
let _selPurp = '금융기관 제출';
let _root    = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _root=root; _tab='request'; _selType='employment'; _render(); }
export function unmount() { _tab = 'request'; _root=null; }

function _render() {
  const myReqs  = _getAll().filter(r=>r.empId===_empId());
  const pending = myReqs.filter(r=>r.status==='pending').length;

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="dr-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">📄 서류 발급 신청</div>
      <div style="font-size:11px;color:var(--text-muted)">처리중 ${pending}건 · 전체 ${myReqs.length}건</div>
    </div>
    ${pending ? `<div style="background:#F59E0B;color:#fff;border-radius:99px;padding:3px 10px;font-size:12px;font-weight:700">${pending}</div>` : ''}
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['request','신청하기'],['mine','신청 내역']].map(([k,l])=>`
    <button class="dr-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='request' ? _renderRequest() : _renderMine(myReqs)}
  </div>
</div>`;

  _root.querySelector('#dr-back').addEventListener('click', ()=>window.navBack());
  _root.querySelectorAll('.dr-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(); }));
  if (_tab==='request') _bindRequest();
}

function _renderRequest() {
  const sel = DOC_TYPES.find(t=>t.key===_selType)||DOC_TYPES[0];
  return `
<!-- 서류 유형 -->
<div style="margin-bottom:14px">
  <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px">서류 종류 선택</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
    ${DOC_TYPES.map(t=>`
    <div class="dr-type" data-type="${t.key}"
      style="padding:10px;border-radius:10px;border:1.5px solid ${_selType===t.key?'#4F46E5':'var(--border)'};
             background:${_selType===t.key?'#EEF2FF':'var(--card-bg)'};cursor:pointer">
      <div style="font-size:16px;margin-bottom:3px">${t.icon}</div>
      <div style="font-size:11px;font-weight:700;color:${_selType===t.key?'#4F46E5':'var(--text)'}">${t.label}</div>
      <div style="font-size:9px;color:var(--text-muted);margin-top:1px">처리 ${t.processDays}일</div>
    </div>`).join('')}
  </div>
</div>

<!-- 선택된 서류 정보 -->
<div style="background:#EEF2FF;border-radius:10px;padding:10px;margin-bottom:14px">
  <div style="font-size:11px;font-weight:700;color:#4F46E5;margin-bottom:2px">${sel.icon} ${sel.label}</div>
  <div style="font-size:11px;color:#4338CA">${sel.desc}</div>
  <div style="font-size:10px;color:#6366F1;margin-top:3px">예상 처리 기간: ${sel.processDays}일</div>
</div>

<!-- 부수 -->
<div style="margin-bottom:12px">
  <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">발급 부수</div>
  <select id="dr-copies"
    style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
           background:var(--bg);color:var(--text);font-size:12px">
    <option value="1">1부</option>
    <option value="2">2부</option>
    <option value="3">3부</option>
  </select>
</div>

<!-- 사용 목적 -->
<div style="margin-bottom:12px">
  <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">사용 목적</div>
  <select id="dr-purpose"
    style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
           background:var(--bg);color:var(--text);font-size:12px">
    ${PURPOSES.map(p=>`<option value="${p}" ${_selPurp===p?'selected':''}>${p}</option>`).join('')}
  </select>
</div>

<!-- 비고 -->
<div style="margin-bottom:14px">
  <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">비고 (선택)</div>
  <input id="dr-note" type="text" placeholder="특이사항 또는 특별 요청 사항"
    style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
           background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
</div>

<button id="dr-submit"
  style="width:100%;padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;
         font-size:13px;font-weight:700;cursor:pointer">발급 신청</button>`;
}

function _renderMine(reqs) {
  const sorted = [...reqs].sort((a,b)=>b.reqDate.localeCompare(a.reqDate));
  if (!sorted.length) return `
<div style="text-align:center;padding:48px 16px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">📄</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:4px">신청 내역이 없습니다</div>
      <button onclick="location.hash='#/document-request'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">서류 신청</button>
    
  <div style="font-size:12px">필요한 서류를 신청해 보세요!</div>
</div>`;

  return sorted.map(r=>{
    const meta = STATUS_META[r.status]||STATUS_META.pending;
    const dt   = DOC_TYPES.find(t=>t.key===r.docType)||DOC_TYPES[0];
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:20px">${dt.icon}</span>
      <div>
        <div style="font-size:13px;font-weight:700">${dt.label}</div>
        <div style="font-size:11px;color:var(--text-muted)">${r.copies}부 · ${r.purpose}</div>
      </div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;
                 background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>
  <div style="font-size:10px;color:var(--text-muted)">${r.reqDate}${r.note?` · ${r.note}`:''}</div>
  ${r.status==='ready' ? `<div style="background:#ECFDF5;border-radius:6px;padding:8px;margin-top:8px;font-size:11px;color:#065F46">✅ 서류 발급이 완료됐습니다. 인사팀에서 수령해 주세요.</div>` : ''}
</div>`; }).join('');
}

function _bindRequest() {
  _root.querySelectorAll('.dr-type').forEach(el=>{
    el.addEventListener('click',()=>{ _selType=el.dataset.type; _render(); });
  });

  _root.querySelector('#dr-purpose')?.addEventListener('change',e=>{ _selPurp=e.target.value; });

  _root.querySelector('#dr-submit')?.addEventListener('click',()=>{
    const copies  = _root.querySelector('#dr-copies')?.value||'1';
    const purpose = _root.querySelector('#dr-purpose')?.value||'기타';
    const note    = _root.querySelector('#dr-note')?.value.trim();
    const reqs    = _getAll();
    const dt      = DOC_TYPES.find(t=>t.key===_selType)||DOC_TYPES[0];
    reqs.push({
      id:      'DR_'+Date.now(),
      empId:   _empId(),
      empName: _empName(),
      docType: _selType,
      copies,
      purpose,
      note,
      status:  'pending',
      reqDate: new Date().toISOString().slice(0,10),
      dueDate: (() => { const d=new Date(); d.setDate(d.getDate()+dt.processDays); return d.toISOString().slice(0,10); })(),
    });
    _save(reqs);
    showToast(`${dt.label} 발급 신청이 완료됐습니다.`, 'success')
    addNotification({ type: 'success', title: '서류 신청', body: '발급 신청이 완료됐습니다.' });
    _tab='mine'; _render();
  });
}
