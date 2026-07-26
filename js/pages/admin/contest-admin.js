/**
 * contest-admin.js — 사내 공모전 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS_CONTESTS = 'hr_contests';
const LS_ENTRIES  = 'hr_contest_entries';

const DEMO_CONTESTS = [
  { id:'CN001', title:'2026 아이디어 공모전', category:'혁신', prize:'1등 100만원 / 2등 50만원 / 3등 30만원', deadline:'2026-06-30', desc:'업무 효율화·고객 경험 개선 아이디어 제안', icon:'💡', status:'open', entries:14 },
  { id:'CN002', title:'사내 포토 공모전', category:'문화', prize:'1등 상품권 50만원', deadline:'2026-07-15', desc:'직장 생활·사내 풍경 사진 공모', icon:'📸', status:'open', entries:8 },
  { id:'CN003', title:'UX 개선 해커톤', category:'기술', prize:'팀 시상 + 프로젝트 실행 기회', deadline:'2026-06-20', desc:'사내 시스템 UX 개선 아이디어 경쟁', icon:'🖥️', status:'open', entries:6 },
  { id:'CN004', title:'2025 베스트 직원 에세이', category:'문화', prize:'출판 기념품 + 사내 게재', deadline:'2025-12-20', desc:'직장 생활 에세이 공모 (완료)', icon:'✍️', status:'closed', entries:22 },
];

function _getContests() {
  const s = localStorage.getItem(LS_CONTESTS);
  if (!s) { localStorage.setItem(LS_CONTESTS, JSON.stringify(DEMO_CONTESTS)); return DEMO_CONTESTS; }
  try {
    const d = JSON.parse(s);
    return [...DEMO_CONTESTS.filter(dc=>!d.find(c=>c.id===dc.id)), ...d];
  } catch { return DEMO_CONTESTS; }
}
function _saveContests(l) { localStorage.setItem(LS_CONTESTS, JSON.stringify(l)); }
function _getEntries()    { try { return JSON.parse(localStorage.getItem(LS_ENTRIES)||'[]'); } catch { return []; } }
function _saveEntries(l)  { localStorage.setItem(LS_ENTRIES, JSON.stringify(l)); }

let _tab  = 'contests';
let _root = null;

export function render(root) { _root=root; _tab='contests'; _draw(); }
export function unmount() { _root=null;
  _tab = 'contests';
}

function _draw() {
  const contests = _getContests();
  const entries  = _getEntries();

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['contests','공모전 관리'],['entries','응모작'],['create','공모전 등록']].map(([k,l])=>`
    <button class="cna-tab" data-tab="${k}" style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;white-space:nowrap;border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='create' ? _renderCreate() : _tab==='entries' ? _renderEntries(contests, entries) : _renderContests(contests, entries)}
  </div>
</div>`;

  _root.querySelectorAll('.cna-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderContests(contests, entries) {
  return `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
  ${[['진행 중',`${contests.filter(c=>c.status==='open').length}개`,'#4F46E5'],['총 응모',`${entries.length}건`,'#F59E0B']].map(([l,v,c])=>`<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:${c}">${v}</div><div style="font-size:10px;color:#94A3B8">${l}</div></div>`).join('')}
</div>
${contests.map(c=>{
  const entCnt=entries.filter(e=>e.contestId===c.id).length+c.entries;
  return `<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;margin-bottom:8px">
    <div style="display:flex;gap:8px;align-items:center">
      <span style="font-size:24px">${c.icon}</span>
      <div><div style="font-size:13px;font-weight:700">${c.title}</div><div style="font-size:11px;color:#94A3B8">${c.category} · 마감 ${c.deadline}</div></div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;background:${c.status==='open'?'#EEF2FF':'#F1F5F9'};color:${c.status==='open'?'#4F46E5':'#94A3B8'}">${c.status==='open'?'진행 중':'종료'}</span>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:12px;font-weight:700;color:#F59E0B">응모 ${entCnt}건</span>
    ${c.status==='open'?`<button class="cna-close" data-id="${c.id}" style="padding:5px 12px;background:none;border:1px solid #EF4444;color:#EF4444;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer">종료</button>`:''}
  </div>
</div>`; }).join('')}`;
}

function _renderEntries(contests, entries) {
  if (!entries.length) return `<div style="text-align:center;padding:40px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">🏆</div><div style="font-size:13px">응모작이 없습니다.</div></div>`;
  return [...entries].sort((a,b)=>b.submittedAt.localeCompare(a.submittedAt)).map(e=>`
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;margin-bottom:6px">
    <div><div style="font-size:13px;font-weight:700">${e.title}</div><div style="font-size:11px;color:#94A3B8">${e.empName} · ${e.contestTitle} · ${e.submittedAt}</div></div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;background:${e.result?'#FEF3C7':'#EEF2FF'};color:${e.result?'#92400E':'#4F46E5'}">${e.result||'심사 중'}</span>
  </div>
  <div style="font-size:11px;color:#64748B;background:var(--bg);border-radius:8px;padding:8px;margin-bottom:8px">${e.content.slice(0,80)}${e.content.length>80?'...':''}</div>
  ${!e.result?`<div style="display:flex;gap:6px">
    <button class="cna-award" data-id="${e.id}" data-r="1위" style="flex:1;padding:6px;background:#F59E0B;color:#fff;border:none;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer">1위</button>
    <button class="cna-award" data-id="${e.id}" data-r="2위" style="flex:1;padding:6px;background:#94A3B8;color:#fff;border:none;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer">2위</button>
    <button class="cna-award" data-id="${e.id}" data-r="3위" style="flex:1;padding:6px;background:#92400E;color:#fff;border:none;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer">3위</button>
    <button class="cna-award" data-id="${e.id}" data-r="가작" style="flex:1;padding:6px;background:#4F46E5;color:#fff;border:none;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer">가작</button>
  </div>`:''}
</div>`).join('');
}

function _renderCreate() {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:14px">공모전 등록</div>
  <div style="display:flex;flex-direction:column;gap:10px">
    <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">공모전 제목 *</div>
      <input id="cna-title" type="text" placeholder="예: 2026 아이디어 공모전" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">카테고리</div>
        <input id="cna-cat" type="text" placeholder="혁신/문화/기술" value="혁신" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
      <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">마감일 *</div>
        <input id="cna-deadline" type="date" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
    </div>
    <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">시상 내용</div>
      <input id="cna-prize" type="text" placeholder="예: 1등 100만원" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
    <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">공모전 설명</div>
      <textarea id="cna-desc" rows="3" placeholder="공모전 내용과 참여 방법 등" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;resize:none;box-sizing:border-box"></textarea></div>
    <button id="cna-submit" style="padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">공모전 등록</button>
  </div>
</div>`;
}

function _bindEvents() {
  _root.querySelectorAll('.cna-close').forEach(btn=>btn.addEventListener('click',()=>{
    const contests=_getContests(); const c=contests.find(x=>x.id===btn.dataset.id); if(!c) return;
    c.status='closed'; _saveContests(contests); showToast('공모전이 종료됐습니다.','info'); _draw();
  }));
  _root.querySelectorAll('.cna-award').forEach(btn=>btn.addEventListener('click',()=>{
    const entries=_getEntries(); const e=entries.find(x=>x.id===btn.dataset.id); if(!e) return;
    const rank=btn.dataset.r;
    if (!confirm(`'${e.title}' 작품을 ${rank}로 선정하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    e.result=rank; _saveEntries(entries);
    showToast(`${e.empName} 님의 작품이 ${rank}로 선정됐습니다.`,'success');
    addNotification({ type: 'success', title: '공모전 심사 완료', body: `'${e.title}' 작품이 ${rank}(으)로 선정되었습니다.` });
    _draw();
  }));
  _root.querySelector('#cna-submit')?.addEventListener('click',()=>{
    const title=_root.querySelector('#cna-title')?.value.trim();
    const deadline=_root.querySelector('#cna-deadline')?.value;
    if (!title||!deadline) { showToast('제목과 마감일을 입력해 주세요.','error'); return; }
    const contests=_getContests();
    contests.push({ id:'CN'+Date.now(), title, category:_root.querySelector('#cna-cat')?.value.trim()||'일반', prize:_root.querySelector('#cna-prize')?.value.trim()||'미정', deadline, desc:_root.querySelector('#cna-desc')?.value.trim()||'', icon:'🏆', status:'open', entries:0 });
    _saveContests(contests);
    showToast('공모전이 등록됐습니다.','success');
    addNotification({ type: 'success', title: '공모전 등록', body: `'${title}' 공모전이 등록됐습니다.` });
    _tab='contests'; _draw();
  });
}
export function mount(root) { return render(root); }
