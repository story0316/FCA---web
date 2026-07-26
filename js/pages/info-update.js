/**
 * info-update.js — 개인정보 변경 신청 (직원)
 */
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
import { isApplicant } from '../auth.js';

const LS = 'hr_info_updates';

const UPDATE_FIELDS = [
  { key:'address',   label:'주소',     icon:'🏠', placeholder:'새 주소를 입력해 주세요' },
  { key:'phone',     label:'연락처',   icon:'📱', placeholder:'새 전화번호를 입력해 주세요' },
  { key:'emergency', label:'비상연락처', icon:'🆘', placeholder:'비상연락처 이름과 번호를 입력해 주세요' },
  { key:'bank',      label:'계좌정보', icon:'🏦', placeholder:'은행명과 계좌번호를 입력해 주세요' },
  { key:'family',    label:'가족관계', icon:'👨‍👩‍👧', placeholder:'변경된 가족관계 정보를 입력해 주세요' },
  { key:'other',     label:'기타',    icon:'📋', placeholder:'변경할 정보를 입력해 주세요' },
];

const STATUS_META = {
  pending:  { label:'검토 중', color:'#F59E0B', bg:'#FEF3C7' },
  approved: { label:'승인',   color:'#10B981', bg:'#ECFDF5' },
  rejected: { label:'반려',   color:'#EF4444', bg:'#FEF2F2' },
};

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }
function _getDept() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').dept||'소속 미지정'; } catch { return '소속 미지정'; } }
function _getAll()  { try { return JSON.parse(localStorage.getItem(LS)||'[]'); } catch { return []; } }
function _saveAll(l){ localStorage.setItem(LS, JSON.stringify(l)); }

let _tab    = 'apply';
let _selFld = '';
let _root   = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _root=root; _tab='apply'; _selFld=''; _render();
}
export function unmount() { _tab = 'apply'; _root=null; }

function _render() {
  const mine = _getAll().filter(r=>r.empId===_empId());

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="iu-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1"><div style="font-size:15px;font-weight:700">📋 개인정보 변경 신청</div><div style="font-size:11px;color:var(--text-muted)">신청 ${mine.length}건</div></div>
  </div>
  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['apply','신청하기'],['history','신청 내역']].map(([k,l])=>`
    <button class="iu-tab" data-tab="${k}" style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>
  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='apply' ? _renderApply() : _renderHistory(mine)}
  </div>
</div>`;

  _root.querySelector('#iu-back').addEventListener('click',()=>window.navBack());
  _root.querySelectorAll('.iu-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(); }));
  _root.querySelectorAll('.iu-field').forEach(btn=>btn.addEventListener('click',()=>{ _selFld=btn.dataset.key; _render(); }));
  _bindSubmit();
}

function _renderApply() {
  const field = UPDATE_FIELDS.find(f=>f.key===_selFld);
  return `
<div style="margin-bottom:14px">
  <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px">변경 항목 선택</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
    ${UPDATE_FIELDS.map(f=>`
    <button class="iu-field" data-key="${f.key}" style="background:${_selFld===f.key?'#EEF2FF':'var(--card-bg)'};border:2px solid ${_selFld===f.key?'#4F46E5':'var(--border)'};border-radius:10px;padding:10px 6px;cursor:pointer;text-align:center">
      <div style="font-size:18px;margin-bottom:2px">${f.icon}</div>
      <div style="font-size:10px;font-weight:700;color:${_selFld===f.key?'#4F46E5':'var(--text)'}">${f.label}</div>
    </button>`).join('')}
  </div>
</div>
${field?`<div style="display:flex;flex-direction:column;gap:10px">
  <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">현재 정보</div>
    <input id="iu-old" type="text" placeholder="현재 ${field.label}을 입력해 주세요" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
  <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">변경할 정보 *</div>
    <input id="iu-new" type="text" placeholder="${field.placeholder}" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
  <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">변경 사유</div>
    <textarea maxlength="500" id="iu-note" rows="2" placeholder="변경 사유를 간략히 작성해 주세요" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;resize:none;box-sizing:border-box"></textarea></div>
  <button id="iu-submit" style="padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">변경 신청</button>
</div>`:`<div style="text-align:center;padding:30px;color:var(--text-muted)"><div style="font-size:11px">변경할 항목을 선택하세요</div></div>`}`;
}

function _renderHistory(mine) {
  if (!mine.length) return `<div style="text-align:center;padding:48px 16px;color:var(--text-muted)"><div style="font-size:40px;margin-bottom:10px">📋</div><div style="font-size:14px;font-weight:600;margin-bottom:4px">신청 내역이 없습니다</div>
      <button onclick="location.hash='#/info-update'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">정보 수정 신청</button>
    </div>`;
  return [...mine].sort((a,b)=>b.reqDate.localeCompare(a.reqDate)).map(r=>{
    const meta  = STATUS_META[r.status]||STATUS_META.pending;
    const field = UPDATE_FIELDS.find(f=>f.key===r.field);
    return `<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;margin-bottom:6px">
    <div><div style="font-size:13px;font-weight:700">${field?field.icon+' '+field.label:r.field} 변경</div><div style="font-size:11px;color:var(--text-muted)">${r.reqDate}</div></div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>
  <div style="font-size:11px;color:var(--text-muted)">→ ${r.newVal}</div>
</div>`; }).join('');
}

function _bindSubmit() {
  _root.querySelector('#iu-submit')?.addEventListener('click',()=>{
    const newVal = _root.querySelector('#iu-new')?.value.trim();
    if (!_selFld||!newVal) { showToast('항목과 변경할 정보를 입력해 주세요.','error'); return; }
    const field = UPDATE_FIELDS.find(f=>f.key===_selFld);
    const all = _getAll();
    all.push({ id:'IU_'+Date.now(), empId:_empId(), empName:_empName(), dept:_getDept(), field:_selFld, oldVal:_root.querySelector('#iu-old')?.value.trim()||'(없음)', newVal, note:_root.querySelector('#iu-note')?.value.trim()||'', status:'pending', reqDate:new Date().toISOString().slice(0,10) });
    _saveAll(all);
    showToast(`${field?.label||_selFld} 변경 신청이 완료됐습니다.`,'success')
    addNotification({ type: 'success', title: '정보 수정', body: '변경 신청이 완료됐습니다.' });
    _tab='history'; _selFld=''; _render();
  });
}
