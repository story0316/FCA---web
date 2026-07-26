/**
 * team-building.js — 팀 빌딩 이벤트 신청 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_team_building';

const ACTIVITY_TYPES = [
  { key:'dinner',   label:'팀 회식',    icon:'🍽️', desc:'팀원과 함께하는 식사 모임' },
  { key:'sports',   label:'스포츠 활동', icon:'⚽', desc:'풋살·볼링·테니스 등 체육 활동' },
  { key:'workshop', label:'워크숍 여행', icon:'🏕️', desc:'당일 또는 1박 2일 팀 워크숍' },
  { key:'game',     label:'게임·레크',  icon:'🎮', desc:'실내 게임·방탈출·보드게임' },
  { key:'culture',  label:'문화·예술',  icon:'🎨', desc:'공연·전시·영화 단체 관람' },
  { key:'etc',      label:'기타',       icon:'✨', desc:'직접 입력' },
];

const STATUS_META = {
  pending:  { label:'검토 중', color:'#F59E0B', bg:'#FEF3C7' },
  approved: { label:'승인',   color:'#10B981', bg:'#ECFDF5' },
  rejected: { label:'반려',   color:'#EF4444', bg:'#FEF2F2' },
  completed:{ label:'완료',   color:'var(--text-muted)', bg:'#F1F5F9' },
};

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }
function _getDept() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').dept||'소속 미지정'; } catch { return '소속 미지정'; } }
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
  const year = mine.filter(r=>r.reqDate.startsWith('2026')&&(r.status==='approved'||r.status==='completed')).reduce((s,r)=>s+r.budget,0);

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="tb-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1"><div style="font-size:15px;font-weight:700">🎊 팀 빌딩</div><div style="font-size:11px;color:var(--text-muted)">신청 ${mine.length}건 · 사용 ${year.toLocaleString()}원</div></div>
  </div>
  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['apply','신청하기'],['history','신청 내역']].map(([k,l])=>`
    <button class="tb-tab" data-tab="${k}" style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>
  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='apply' ? _renderApply() : _renderHistory(mine)}
  </div>
</div>`;

  _root.querySelector('#tb-back').addEventListener('click',()=>window.navBack());
  _root.querySelectorAll('.tb-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(); }));
  _bindForm();
}

function _renderApply() {
  return `
<div style="background:linear-gradient(135deg,#10B981,#059669);border-radius:14px;padding:14px;margin-bottom:14px;color:#fff">
  <div style="font-size:11px;opacity:0.8;margin-bottom:3px">팀 빌딩 예산 안내</div>
  <div style="font-size:14px;font-weight:700">1인당 연 50,000원 지원</div>
  <div style="font-size:10px;opacity:0.7;margin-top:2px">팀장 승인 후 법인카드로 집행 가능</div>
</div>
<div style="margin-bottom:14px">
  <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px">활동 유형</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
    ${ACTIVITY_TYPES.map(t=>`
    <button class="tb-type" data-key="${t.key}" style="background:${_selType===t.key?'#EEF2FF':'var(--card-bg)'};border:2px solid ${_selType===t.key?'#4F46E5':'var(--border)'};border-radius:12px;padding:8px;cursor:pointer;text-align:center">
      <div style="font-size:18px;margin-bottom:2px">${t.icon}</div>
      <div style="font-size:10px;font-weight:700;color:${_selType===t.key?'#4F46E5':'var(--text)'}">${t.label}</div>
    </button>`).join('')}
  </div>
</div>
<div style="display:flex;flex-direction:column;gap:10px">
  <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">활동명 *</div>
    <input id="tb-title" type="text" placeholder="예: 3분기 개발팀 회식" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">예정 일자 *</div>
      <input id="tb-date" type="date" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
    <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">신청 예산 (원)</div>
      <input id="tb-budget" type="number" min="0" placeholder="0" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
  </div>
  <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">참가 인원</div>
    <input id="tb-headcount" type="number" min="2" value="5" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
  <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">신청 사유</div>
    <textarea maxlength="500" id="tb-note" rows="2" placeholder="활동 목적 및 기대 효과" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;resize:none;box-sizing:border-box"></textarea></div>
  <button id="tb-submit" style="padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">신청하기</button>
</div>`;
}

function _renderHistory(mine) {
  if (!mine.length) return `<div style="text-align:center;padding:48px 16px;color:var(--text-muted)"><div style="font-size:40px;margin-bottom:10px">🎊</div><div style="font-size:14px;font-weight:600;margin-bottom:4px">신청 내역이 없습니다</div>
      <button onclick="document.querySelector('[data-tab=apply]')?.click()" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">신청하기</button>
    <div style="font-size:12px">팀원과 함께하는 활동을 신청해 보세요!</div></div>`;
  return [...mine].sort((a,b)=>b.reqDate.localeCompare(a.reqDate)).map(r=>{
    const meta = STATUS_META[r.status]||STATUS_META.pending;
    const type = ACTIVITY_TYPES.find(t=>t.key===r.type);
    return `<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;margin-bottom:6px">
    <div><div style="font-size:13px;font-weight:700">${r.title}</div><div style="font-size:11px;color:var(--text-muted)">${type?type.icon+' '+type.label:r.type} · ${r.eventDate||r.reqDate}</div></div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>
  <div style="font-size:12px;font-weight:700;color:#4F46E5">${r.budget?r.budget.toLocaleString()+'원':''}</div>
</div>`; }).join('');
}

function _bindForm() {
  _root.querySelectorAll('.tb-type').forEach(btn=>btn.addEventListener('click',()=>{ _selType=btn.dataset.key; _render(); }));
  _root.querySelector('#tb-submit')?.addEventListener('click',()=>{
    const title = _root.querySelector('#tb-title')?.value.trim();
    const date  = _root.querySelector('#tb-date')?.value;
    if (!_selType) { showToast('활동 유형을 선택해 주세요.','error'); return; }
    if (!title||!date) { showToast('활동명과 예정 일자를 입력해 주세요.','error'); return; }
    const type = ACTIVITY_TYPES.find(t=>t.key===_selType);
    const all = _getAll();
    all.push({ id:'TB_'+Date.now(), empId:_empId(), empName:_empName(), dept:_getDept(), type:_selType, typeLabel:type?.label||_selType, title, eventDate:date, budget:parseInt(_root.querySelector('#tb-budget')?.value)||0, headcount:parseInt(_root.querySelector('#tb-headcount')?.value)||5, note:_root.querySelector('#tb-note')?.value.trim(), status:'pending', reqDate:new Date().toISOString().slice(0,10) });
    _saveAll(all);
    showToast('팀 빌딩 신청이 완료됐습니다.','success')
    addNotification({ type: 'success', title: '팀빌딩', body: '팀 빌딩 신청이 완료됐습니다.' });
    _tab='history'; _selType=''; _render();
  });
}
