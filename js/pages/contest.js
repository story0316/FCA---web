/**
 * contest.js — 사내 공모전 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS_CONTESTS = 'hr_contests';
const LS_ENTRIES  = 'hr_contest_entries';

const DEMO_CONTESTS = [
  { id:'CN001', title:'2026 아이디어 공모전', category:'혁신', prize:'1등 100만원 / 2등 50만원 / 3등 30만원', deadline:'2026-06-30', desc:'업무 효율화·고객 경험 개선 아이디어 제안', icon:'💡', status:'open', entries:14 },
  { id:'CN002', title:'사내 포토 공모전', category:'문화', prize:'1등 상품권 50만원', deadline:'2026-07-15', desc:'직장 생활·사내 풍경 사진 공모', icon:'📸', status:'open', entries:8 },
  { id:'CN003', title:'UX 개선 해커톤', category:'기술', prize:'팀 시상 + 프로젝트 실행 기회', deadline:'2026-06-20', desc:'사내 시스템 UX 개선 아이디어 경쟁', icon:'🖥️', status:'open', entries:6 },
  { id:'CN004', title:'2025 베스트 직원 에세이', category:'문화', prize:'출판 기념품 + 사내 게재', deadline:'2025-12-20', desc:'직장 생활 에세이 공모 (완료)', icon:'✍️', status:'closed', entries:22 },
];

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }
function _getContests() {
  const s = localStorage.getItem(LS_CONTESTS);
  if (!s) { localStorage.setItem(LS_CONTESTS, JSON.stringify(DEMO_CONTESTS)); return DEMO_CONTESTS; }
  try {
    const d = JSON.parse(s);
    return [...DEMO_CONTESTS.filter(dc=>!d.find(c=>c.id===dc.id)), ...d];
  } catch { return DEMO_CONTESTS; }
}
function _getEntries() { try { return JSON.parse(localStorage.getItem(LS_ENTRIES)||'[]'); } catch { return []; } }
function _saveEntries(l) { localStorage.setItem(LS_ENTRIES, JSON.stringify(l)); }

let _tab     = 'open';
let _selCon  = null;
let _root    = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _root=root; _tab='open'; _selCon=null; _render(); }
export function unmount() { _tab = 'open'; _root=null; }

function _render() {
  const contests = _getContests();
  const entries  = _getEntries();
  const myEntries= entries.filter(e=>e.empId===_empId());

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="cn-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1"><div style="font-size:15px;font-weight:700">🏆 사내 공모전</div><div style="font-size:11px;color:var(--text-muted)">참가 ${myEntries.length}건</div></div>
    ${myEntries.length?`<div style="background:#F59E0B;color:#fff;border-radius:99px;padding:3px 10px;font-size:12px;font-weight:700">참가 ${myEntries.length}</div>`:''}
  </div>
  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['open','진행 중'],['mine','내 참가'],['closed','종료']].map(([k,l])=>`
    <button class="cn-tab" data-tab="${k}" style="flex:1;padding:10px;font-size:11px;font-weight:600;border:none;cursor:pointer;background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>
  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='mine' ? _renderMine(myEntries, contests) :
      _tab==='closed' ? _renderContests(contests.filter(c=>c.status==='closed'), entries) :
      _selCon ? _renderSubmit(_selCon, contests) : _renderContests(contests.filter(c=>c.status==='open'), entries)}
  </div>
</div>`;

  _root.querySelector('#cn-back').addEventListener('click',()=>{
    if (_selCon) { _selCon=null; _render(); } else window.navBack();
  });
  _root.querySelectorAll('.cn-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _selCon=null; _render(); }));
  _root.querySelectorAll('.cn-enter').forEach(btn=>btn.addEventListener('click',()=>{ _selCon=btn.dataset.id; _render(); }));
  if (_selCon) {
    _root.querySelector('#cn-submit')?.addEventListener('click',()=>{
      const title   = _root.querySelector('#cn-title')?.value.trim();
      const content = _root.querySelector('#cn-content')?.value.trim();
      if (!title||!content) { showToast('제목과 내용을 입력해 주세요.','error'); return; }
      const con = _getContests().find(c=>c.id===_selCon); if (!con) return;
      const entries = _getEntries();
      entries.push({ id:'CE_'+Date.now(), contestId:_selCon, contestTitle:con.title, empId:_empId(), empName:_empName(), title, content, submittedAt:new Date().toISOString().slice(0,10), result:null });
      _saveEntries(entries);
      showToast(`'${con.title}' 공모전에 응모가 완료됐습니다.`,'success');
      addNotification({ type: 'success', title: '공모전 응모 완료', body: `'${con.title}' 참여가 정상적으로 접수되었습니다.` });
      _selCon=null; _tab='mine'; _render();
    });
  }
}

function _renderContests(contests, entries) {
  if (!contests.length) return `<div style="text-align:center;padding:48px 16px;color:var(--text-muted)"><div style="font-size:40px;margin-bottom:10px">🏆</div><div style="font-size:13px">해당 공모전이 없습니다</div></div>`;
  return contests.map(c=>{
    const myEntry = entries.find(e=>e.contestId===c.id&&e.empId===_empId());
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;gap:10px;margin-bottom:8px">
    <span style="font-size:28px;flex-shrink:0">${c.icon}</span>
    <div style="flex:1">
      <div style="font-size:13px;font-weight:700">${c.title}</div>
      <div style="font-size:11px;color:var(--text-muted)">${c.category} · 마감: ${c.deadline}</div>
    </div>
  </div>
  <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">${c.desc}</div>
  <div style="font-size:11px;font-weight:700;color:#F59E0B;margin-bottom:10px">🏅 ${c.prize}</div>
  <div style="display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:11px;color:var(--text-muted)">응모 ${c.entries + entries.filter(e=>e.contestId===c.id).length}건</span>
    ${c.status==='open' ? (myEntry ? `<span style="font-size:12px;font-weight:700;color:#10B981">✓ 응모 완료</span>` : `<button class="cn-enter" data-id="${c.id}" style="padding:7px 16px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">응모하기</button>`) : `<span style="font-size:11px;color:var(--text-muted)">종료됨</span>`}
  </div>
</div>`; }).join('');
}

function _renderSubmit(conId, contests) {
  const c = contests.find(x=>x.id===conId); if(!c) return '';
  return `
<div style="background:#EEF2FF;border-radius:10px;padding:10px 12px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
  <span style="font-size:20px">${c.icon}</span>
  <div><div style="font-size:12px;font-weight:700;color:#4F46E5">${c.title}</div><div style="font-size:10px;color:#4338CA">마감: ${c.deadline}</div></div>
</div>
<div style="display:flex;flex-direction:column;gap:10px">
  <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">작품/아이디어 제목 *</div>
    <input id="cn-title" type="text" placeholder="응모작 제목" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
  <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">내용 *</div>
    <textarea maxlength="500" id="cn-content" rows="6" placeholder="아이디어·작품 내용을 자세히 작성해 주세요" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;resize:none;box-sizing:border-box"></textarea></div>
  <button id="cn-submit" style="padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">응모하기</button>
</div>`;
}

function _renderMine(myEntries, contests) {
  if (!myEntries.length) return `<div style="text-align:center;padding:48px 16px;color:var(--text-muted)"><div style="font-size:40px;margin-bottom:10px">🏆</div><div style="font-size:14px;font-weight:600;margin-bottom:8px">참가한 공모전이 없습니다</div><button onclick="document.querySelector('[data-tab=open]')?.click()" style="padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">공모전 목록 보기</button></div>`;
  return myEntries.map(e=>{
    return `<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;margin-bottom:6px">
    <div><div style="font-size:13px;font-weight:700">${e.title}</div><div style="font-size:11px;color:var(--text-muted)">${e.contestTitle} · ${e.submittedAt}</div></div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;background:${e.result?'#FEF3C7':'#EEF2FF'};color:${e.result?'#92400E':'#4F46E5'}">${e.result||'심사 중'}</span>
  </div>
</div>`; }).join('');
}
