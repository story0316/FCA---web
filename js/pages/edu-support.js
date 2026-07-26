/**
 * edu-support.js — 교육비 지원 신청 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_edu_support';

const SUPPORT_TYPES = [
  { key:'language',    label:'어학원·자격증', icon:'🌍', limit:500000, desc:'영어·일본어·중국어 등 어학 교육비' },
  { key:'graduate',    label:'대학원 학비',   icon:'🎓', limit:3000000, desc:'직무 관련 대학원 학비 일부 지원' },
  { key:'seminar',     label:'세미나·컨퍼런스', icon:'🎤', limit:300000, desc:'직무 관련 외부 세미나·컨퍼런스' },
  { key:'online',      label:'온라인 강의',   icon:'💻', limit:200000, desc:'Coursera·Udemy·국내 강의 플랫폼' },
  { key:'book',        label:'도서 구매',     icon:'📚', limit:100000, desc:'업무·자기계발 관련 도서' },
  { key:'cert',        label:'자격증 시험',   icon:'📋', limit:200000, desc:'직무 관련 자격증 응시료' },
];

const STATUS_META = {
  pending:  { label:'검토 중', color:'#F59E0B', bg:'#FEF3C7' },
  approved: { label:'승인',   color:'#10B981', bg:'#ECFDF5' },
  rejected: { label:'반려',   color:'#EF4444', bg:'#FEF2F2' },
  paid:     { label:'지급 완료', color:'#3B82F6', bg:'#EFF6FF' },
};

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }
function _getAll()  { try { return JSON.parse(localStorage.getItem(LS)||'[]'); } catch { return []; } }
function _saveAll(l){ localStorage.setItem(LS, JSON.stringify(l)); }

let _tab     = 'apply';
let _selType = '';
let _root    = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _root=root; _tab='apply'; _selType=''; _render(); }
export function unmount() { _tab = 'apply'; _root=null; }

function _render() {
  const all   = _getAll();
  const mine  = all.filter(r=>r.empId===_empId());
  const approved = mine.filter(r=>r.status==='approved'||r.status==='paid').reduce((s,r)=>s+r.amount,0);

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="es-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🎓 교육비 지원</div>
      <div style="font-size:11px;color:var(--text-muted)">신청 ${mine.length}건 · 승인 ${approved.toLocaleString()}원</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['apply','신청하기'],['history','신청 내역']].map(([k,l])=>`
    <button class="es-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='apply' ? _renderApply() : _renderHistory(mine)}
  </div>
</div>`;

  _root.querySelector('#es-back').addEventListener('click', ()=>window.navBack());
  _root.querySelectorAll('.es-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(); }));
  _bindForm();
}

function _renderApply() {
  const sel = _selType ? SUPPORT_TYPES.find(t=>t.key===_selType) : null;

  return `
<div style="margin-bottom:14px">
  <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px">지원 유형 선택</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    ${SUPPORT_TYPES.map(t=>`
    <button class="es-type" data-key="${t.key}"
      style="background:${_selType===t.key?'#EEF2FF':'var(--card-bg)'};border:2px solid ${_selType===t.key?'#4F46E5':'var(--border)'};
             border-radius:12px;padding:10px;cursor:pointer;text-align:left">
      <div style="font-size:18px;margin-bottom:4px">${t.icon}</div>
      <div style="font-size:11px;font-weight:700;color:${_selType===t.key?'#4F46E5':'var(--text)'}">${t.label}</div>
      <div style="font-size:10px;color:var(--text-muted)">최대 ${t.limit.toLocaleString()}원</div>
    </button>`).join('')}
  </div>
</div>

${sel ? `
<div style="background:#EEF2FF;border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:#4338CA">
  ${sel.icon} ${sel.label} — ${sel.desc} (최대 ${sel.limit.toLocaleString()}원/건)
</div>` : ''}

<div style="display:flex;flex-direction:column;gap:10px">
  <div>
    <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">기관·강의명 *</div>
    <input id="es-name" type="text" placeholder="예: 영단기 토익 강의, Coursera ML 과정"
      style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
             background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">신청 금액 *</div>
      <input id="es-amount" type="number" min="1" placeholder="원"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
               background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
    </div>
    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">교육 기간</div>
      <input id="es-period" type="text" placeholder="예: 2026-06~2026-08"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
               background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
    </div>
  </div>
  <div>
    <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">신청 사유</div>
    <textarea maxlength="500" id="es-reason" rows="3" placeholder="직무 연관성 및 교육 목적을 간략히 적어 주세요"
      style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
             background:var(--bg);color:var(--text);font-size:12px;resize:none;box-sizing:border-box"></textarea>
  </div>
  <button id="es-submit"
    style="width:100%;padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;
           font-size:13px;font-weight:700;cursor:pointer">신청하기</button>
</div>`;
}

function _renderHistory(mine) {
  if (!mine.length) return `
<div style="text-align:center;padding:48px 16px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">🎓</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:4px">신청 내역이 없습니다</div>
      <button onclick="document.querySelector('[data-tab=apply]')?.click()" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">교육비 신청</button>
    
  <div style="font-size:12px">교육비 지원을 신청해 보세요!</div>
</div>`;

  return [...mine].sort((a,b)=>b.reqDate.localeCompare(a.reqDate)).map(r=>{
    const meta = STATUS_META[r.status]||STATUS_META.pending;
    const type = SUPPORT_TYPES.find(t=>t.key===r.type);
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div>
      <div style="font-size:13px;font-weight:700">${r.courseName}</div>
      <div style="font-size:11px;color:var(--text-muted)">${type?type.label:r.type} · ${r.reqDate}</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;
                 background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>
  <div style="font-size:12px;font-weight:700;color:#4F46E5">${r.amount.toLocaleString()}원</div>
  ${r.reason?`<div style="font-size:11px;color:var(--text-muted);margin-top:4px">${r.reason}</div>`:''}
</div>`; }).join('');
}

function _bindForm() {
  _root.querySelectorAll('.es-type').forEach(btn=>{
    btn.addEventListener('click',()=>{ _selType=btn.dataset.key; _render(); });
  });

  _root.querySelector('#es-submit')?.addEventListener('click',()=>{
    const name   = _root.querySelector('#es-name')?.value.trim();
    const amount = parseInt(_root.querySelector('#es-amount')?.value);
    if (!_selType) { showToast('지원 유형을 선택해 주세요.', 'error'); return; }
    if (!name)     { showToast('기관·강의명을 입력해 주세요.', 'error'); return; }
    if (!amount||amount<=0) { showToast('신청 금액을 입력해 주세요.', 'error'); return; }
    const type = SUPPORT_TYPES.find(t=>t.key===_selType);
    if (type && amount > type.limit) { showToast(`최대 지원 금액(${type.limit.toLocaleString()}원)을 초과했습니다.`, 'error'); return; }
    const all = _getAll();
    all.push({
      id:         'ES_'+Date.now(),
      empId:      _empId(),
      empName:    _empName(),
      type:       _selType,
      courseName: name,
      amount,
      period:     _root.querySelector('#es-period')?.value||'',
      reason:     _root.querySelector('#es-reason')?.value.trim(),
      status:     'pending',
      reqDate:    new Date().toISOString().slice(0,10),
    });
    _saveAll(all);
    showToast('교육비 지원 신청이 완료됐습니다.', 'success')
    addNotification({ type: 'success', title: '교육비 신청', body: '교육비 지원 신청이 완료됐습니다.' });
    _tab='history'; _selType=''; _render();
  });
}
