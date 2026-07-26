/**
 * counseling.js — 심리 상담 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_counseling_requests';

const COUNSELORS = [
  { id:'CS001', name:'박은지 상담사', specialty:'직무 스트레스·번아웃', bio:'임상심리사 2급, 7년 경력', available:'화·목 10:00~17:00', avatar:'🧑‍⚕️' },
  { id:'CS002', name:'김도현 상담사', specialty:'커리어·대인관계', bio:'상담심리 석사, 5년 경력', available:'월·수·금 13:00~18:00', avatar:'👨‍⚕️' },
];

const TOPICS = ['직무 스트레스', '커리어 고민', '번아웃 예방', '대인관계', '감정 조절', '기타'];

const STATUS_META = {
  pending:   { label:'대기',  color:'#F59E0B', bg:'#FEF3C7' },
  confirmed: { label:'확정',  color:'#3B82F6', bg:'#EFF6FF' },
  completed: { label:'완료',  color:'#10B981', bg:'#ECFDF5' },
  cancelled: { label:'취소',  color:'var(--text-muted)', bg:'#F1F5F9' },
};

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }
function _getAll()  { try { return JSON.parse(localStorage.getItem(LS)||'[]'); } catch { return []; } }
function _saveAll(l){ localStorage.setItem(LS, JSON.stringify(l)); }

let _tab    = 'list';
let _selCs  = null;
let _root   = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _root=root; _tab='list'; _selCs=null; _render(); }
export function unmount() { _tab = 'list'; _root=null; }

function _render() {
  const mine = _getAll().filter(r=>r.empId===_empId());

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="cs-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1"><div style="font-size:15px;font-weight:700">🧠 심리 상담</div><div style="font-size:11px;color:var(--text-muted)">예약 ${mine.length}건</div></div>
  </div>
  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['list','상담사 소개'],['apply','예약하기'],['mine','내 예약']].map(([k,l])=>`
    <button class="cs-tab" data-tab="${k}" style="flex:1;padding:10px;font-size:11px;font-weight:600;border:none;cursor:pointer;background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>
  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='mine' ? _renderMine(mine) : _tab==='apply' ? _renderApply() : _renderList()}
  </div>
</div>`;

  _root.querySelector('#cs-back').addEventListener('click',()=>window.navBack());
  _root.querySelectorAll('.cs-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _selCs=null; _render(); }));
  _root.querySelectorAll('.cs-select').forEach(btn=>btn.addEventListener('click',()=>{ _selCs=btn.dataset.id; _tab='apply'; _render(); }));
  _bindApply();
  _bindMine();
}

function _renderList() {
  return COUNSELORS.map(c=>`
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;gap:12px;margin-bottom:10px">
    <div style="font-size:36px">${c.avatar}</div>
    <div style="flex:1">
      <div style="font-size:14px;font-weight:700">${c.name}</div>
      <div style="font-size:11px;color:#4F46E5;font-weight:600;margin-bottom:2px">${c.specialty}</div>
      <div style="font-size:11px;color:var(--text-muted)">${c.bio}</div>
    </div>
  </div>
  <div style="font-size:11px;color:var(--text-muted);background:var(--bg);border-radius:8px;padding:8px;margin-bottom:10px">상담 가능: ${c.available}</div>
  <button class="cs-select" data-id="${c.id}" style="width:100%;padding:9px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">예약하기</button>
</div>`).join('');
}

function _renderApply() {
  const c = COUNSELORS.find(x=>x.id===_selCs);
  return `
${c?`<div style="background:#EEF2FF;border-radius:10px;padding:10px 12px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
  <span style="font-size:24px">${c.avatar}</span>
  <div><div style="font-size:12px;font-weight:700;color:#4F46E5">${c.name}</div><div style="font-size:10px;color:#4338CA">${c.specialty}</div></div>
</div>`:''}
<div style="display:flex;flex-direction:column;gap:10px">
  ${!c?`<div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">상담사 선택 *</div>
    <select id="cs-counselor" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px">
      <option value="">선택</option>
      ${COUNSELORS.map(x=>`<option value="${x.id}">${x.name} — ${x.specialty}</option>`).join('')}
    </select></div>`:''}
  <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">상담 주제 *</div>
    <select id="cs-topic" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px">
      <option value="">선택</option>
      ${TOPICS.map(t=>`<option value="${t}">${t}</option>`).join('')}
    </select></div>
  <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">희망 일시 *</div>
    <input id="cs-date" type="datetime-local" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
  <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">메모 (선택)</div>
    <textarea maxlength="500" id="cs-note" rows="3" placeholder="사전에 공유할 내용을 적어주세요 (비공개 처리)" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;resize:none;box-sizing:border-box"></textarea></div>
  <button id="cs-submit" style="padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">예약 신청</button>
</div>`;
}

function _renderMine(mine) {
  if (!mine.length) return `<div style="text-align:center;padding:48px 16px;color:var(--text-muted)"><div style="font-size:40px;margin-bottom:10px">🧠</div><div style="font-size:14px;font-weight:600;margin-bottom:4px">예약 내역이 없습니다</div>
      <button onclick="document.querySelector('[data-tab=apply]')?.click()" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">상담 예약</button>
    <div style="font-size:12px">상담사 소개를 보고 예약해 보세요!</div></div>`;
  return [...mine].sort((a,b)=>b.reqDate.localeCompare(a.reqDate)).map(r=>{
    const meta = STATUS_META[r.status]||STATUS_META.pending;
    return `<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;margin-bottom:6px">
    <div><div style="font-size:13px;font-weight:700">${r.topic}</div><div style="font-size:11px;color:var(--text-muted)">${r.counselorName} · ${r.reqDate}</div></div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>
  <div style="font-size:11px;color:var(--text-muted)">희망: ${r.prefDate}</div>
  ${r.confirmedDate?`<div style="font-size:11px;color:#3B82F6;font-weight:600;margin-top:4px">확정: ${r.confirmedDate}</div>`:''}
  ${r.status==='pending'||r.status==='confirmed'?`<button class="cs-cancel" data-id="${r.id}" style="margin-top:8px;width:100%;padding:6px;background:none;border:1px solid var(--text-muted);color:var(--text-muted);border-radius:8px;font-size:10px;cursor:pointer">취소</button>`:''}
</div>`; }).join('');
}

function _bindApply() {
  _root.querySelector('#cs-submit')?.addEventListener('click',()=>{
    const csId  = _selCs || _root.querySelector('#cs-counselor')?.value;
    const topic = _root.querySelector('#cs-topic')?.value;
    const date  = _root.querySelector('#cs-date')?.value;
    if (!csId||!topic||!date) { showToast('상담사·주제·희망 일시를 선택해 주세요.','error'); return; }
    const c = COUNSELORS.find(x=>x.id===csId);
    const all = _getAll();
    all.push({ id:'CR_'+Date.now(), empId:_empId(), empName:_empName(), counselorId:csId, counselorName:c?.name||csId, topic, prefDate:date.replace('T',' '), note:_root.querySelector('#cs-note')?.value.trim()||'', status:'pending', reqDate:new Date().toISOString().slice(0,10), confirmedDate:null });
    _saveAll(all);
    showToast('상담 예약이 신청됐습니다.','success')
    addNotification({ type: 'success', title: '상담 예약', body: '상담 예약이 신청됐습니다.' });
    _tab='mine'; _selCs=null; _render();
  });
}

function _bindMine() {
  _root.querySelectorAll('.cs-cancel').forEach(btn=>btn.addEventListener('click',()=>{
    const all=_getAll(); const r=all.find(x=>x.id===btn.dataset.id); if(!r) return;
    r.status='cancelled'; _saveAll(all); showToast('예약이 취소됐습니다.','info'); _render();
  }));
}
