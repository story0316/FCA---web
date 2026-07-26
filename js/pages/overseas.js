/**
 * overseas.js — 해외 파견·연수 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const TODAY = new Date().toISOString().slice(0,10);

const LS = 'hr_overseas_requests';

const OVERSEAS_TYPES = [
  { key:'dispatch',   label:'장기 파견',    icon:'🏢', desc:'해외 법인·파트너사 장기 파견' },
  { key:'training',   label:'해외 연수',    icon:'📚', desc:'해외 교육·훈련 프로그램 참가' },
  { key:'exchange',   label:'교환 근무',    icon:'🔄', desc:'해외 거점 단기 교환 근무' },
  { key:'conference', label:'해외 컨퍼런스', icon:'🎤', desc:'해외 컨퍼런스·세미나 참가' },
];

const STATUS_META = {
  pending:  { label:'검토 중', color:'#F59E0B', bg:'#FEF3C7' },
  approved: { label:'승인',   color:'#10B981', bg:'#ECFDF5' },
  rejected: { label:'반려',   color:'#EF4444', bg:'#FEF2F2' },
  ongoing:  { label:'진행 중', color:'#3B82F6', bg:'#EFF6FF' },
  completed:{ label:'완료',   color:'var(--text-muted)', bg:'#F1F5F9' },
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
  const mine = _getAll().filter(r=>r.empId===_empId());

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="ov-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1"><div style="font-size:15px;font-weight:700">✈️ 해외 파견·연수</div><div style="font-size:11px;color:var(--text-muted)">신청 ${mine.length}건</div></div>
  </div>
  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['apply','신청하기'],['history','신청 내역']].map(([k,l])=>`
    <button class="ov-tab" data-tab="${k}" style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>
  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='apply' ? _renderApply() : _renderHistory(mine)}
  </div>
</div>`;

  _root.querySelector('#ov-back').addEventListener('click',()=>window.navBack());
  _root.querySelectorAll('.ov-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(); }));
  _root.querySelectorAll('.ov-type').forEach(btn=>btn.addEventListener('click',()=>{ _selType=btn.dataset.key; _render(); }));
  _bindSubmit();
}

function _renderApply() {
  return `
<div style="margin-bottom:14px">
  <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px">신청 유형</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    ${OVERSEAS_TYPES.map(t=>`
    <button class="ov-type" data-key="${t.key}" style="background:${_selType===t.key?'#EEF2FF':'var(--card-bg)'};border:2px solid ${_selType===t.key?'#4F46E5':'var(--border)'};border-radius:12px;padding:10px;cursor:pointer;text-align:left">
      <div style="font-size:20px;margin-bottom:4px">${t.icon}</div>
      <div style="font-size:12px;font-weight:700;color:${_selType===t.key?'#4F46E5':'var(--text)'}">${t.label}</div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${t.desc}</div>
    </button>`).join('')}
  </div>
</div>
<div style="display:flex;flex-direction:column;gap:10px">
  <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">목적지 *</div>
    <input id="ov-dest" type="text" placeholder="예: 미국 뉴욕" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">출발일 *</div>
      <input id="ov-start" type="date" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box" min="${TODAY}"></div>
    <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">복귀일 *</div>
      <input id="ov-end" type="date" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
  </div>
  <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">목적 및 기대 효과 *</div>
    <textarea maxlength="500" id="ov-purpose" rows="3" placeholder="파견·연수의 목적과 기대 효과를 작성해 주세요" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;resize:none;box-sizing:border-box"></textarea></div>
  <button id="ov-submit" style="padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">신청하기</button>
</div>`;
}

function _renderHistory(mine) {
  if (!mine.length) return `<div style="text-align:center;padding:48px 16px;color:var(--text-muted)"><div style="font-size:40px;margin-bottom:10px">✈️</div><div style="font-size:14px;font-weight:600;margin-bottom:4px">신청 내역이 없습니다</div>
      <button onclick="document.querySelector('[data-tab=apply]')?.click()" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">파견 신청</button>
    <div style="font-size:12px">해외 파견·연수를 신청해 보세요!</div></div>`;
  return [...mine].sort((a,b)=>b.reqDate.localeCompare(a.reqDate)).map(r=>{
    const meta = STATUS_META[r.status]||STATUS_META.pending;
    const type = OVERSEAS_TYPES.find(t=>t.key===r.type);
    return `<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;margin-bottom:6px">
    <div><div style="font-size:13px;font-weight:700">${r.destination}</div><div style="font-size:11px;color:var(--text-muted)">${type?type.icon+' '+type.label:r.type} · ${r.startDate}~${r.endDate}</div></div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>
  <div style="font-size:11px;color:var(--text-muted)">${r.purpose}</div>
</div>`; }).join('');
}

function _bindSubmit() {
  _root.querySelector('#ov-submit')?.addEventListener('click',()=>{
    const dest    = _root.querySelector('#ov-dest')?.value.trim();
    const start   = _root.querySelector('#ov-start')?.value;
    const end     = _root.querySelector('#ov-end')?.value;
    const purpose = _root.querySelector('#ov-purpose')?.value.trim();
    if (!_selType) { showToast('신청 유형을 선택해 주세요.','error'); return; }
    if (!dest||!start||!end||!purpose) { showToast('모든 필수 항목을 입력해 주세요.','error'); return; }
    const type = OVERSEAS_TYPES.find(t=>t.key===_selType);
    const all = _getAll();
    all.push({ id:'OV_'+Date.now(), empId:_empId(), empName:_empName(), type:_selType, typeLabel:type?.label||_selType, destination:dest, startDate:start, endDate:end, purpose, status:'pending', reqDate:new Date().toISOString().slice(0,10) });
    _saveAll(all);
    showToast('해외 파견·연수 신청이 완료됐습니다.','success')
    addNotification({ type: 'success', title: '해외 파견', body: '해외 파견·연수 신청이 완료됐습니다.' });
    _tab='history'; _selType=''; _render();
  });
}
