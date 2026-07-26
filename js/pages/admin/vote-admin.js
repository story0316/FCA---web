/**
 * vote-admin.js — 사내 투표 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS_VOTES   = 'hr_votes';
const LS_BALLOTS = 'hr_vote_ballots';

const DEMO_VOTES = [
  { id:'VT001', title:'2026년 사내 복지 우선순위', category:'복지', options:[{id:'o1',text:'식대 지원 확대',votes:8},{id:'o2',text:'교통비 지원',votes:5},{id:'o3',text:'건강검진 강화',votes:3}], status:'active', startDate:'2026-06-01', endDate:'2026-06-10', totalVoters:16, createdBy:'admin' },
  { id:'VT002', title:'팀 행사 요일 선호도 조사', category:'행사', options:[{id:'o1',text:'금요일 오후',votes:7},{id:'o2',text:'토요일 오전',votes:4}], status:'active', startDate:'2026-06-03', endDate:'2026-06-07', totalVoters:11, createdBy:'admin' },
  { id:'VT003', title:'사내 카페테리아 메뉴 개선', category:'시설', options:[{id:'o1',text:'한식 강화',votes:5},{id:'o2',text:'샐러드바 추가',votes:4},{id:'o3',text:'가격 인하',votes:3}], status:'closed', startDate:'2026-05-15', endDate:'2026-05-22', totalVoters:12, createdBy:'admin' },
];

function _getVotes() {
  const s = localStorage.getItem(LS_VOTES);
  if (!s) { localStorage.setItem(LS_VOTES, JSON.stringify(DEMO_VOTES)); return DEMO_VOTES; }
  try {
    const d = JSON.parse(s);
    return [...DEMO_VOTES.filter(dv=>!d.find(v=>v.id===dv.id)), ...d];
  } catch { return DEMO_VOTES; }
}
function _saveVotes(l) { localStorage.setItem(LS_VOTES, JSON.stringify(l)); }
function _getBallots() { try { return JSON.parse(localStorage.getItem(LS_BALLOTS)||'[]'); } catch { return []; } }

let _tab  = 'active';
let _root = null;

export function render(root) { _root=root; _tab='active'; _draw(); }
export function unmount() { _root=null;
  _tab = 'active';
}

function _draw() {
  const votes   = _getVotes();
  const ballots = _getBallots();
  const active  = votes.filter(v=>v.status==='active').length;

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['active',`진행 중${active?` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${active}</span>`:''}`],['closed','종료'],['create','투표 생성']].map(([k,l])=>`
    <button class="vta-tab" data-tab="${k}" style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;white-space:nowrap;border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='create' ? _renderCreate() : _renderList(votes, ballots)}
  </div>
</div>`;

  _root.querySelectorAll('.vta-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderList(votes, ballots) {
  const filtered = _tab==='active' ? votes.filter(v=>v.status==='active') : votes.filter(v=>v.status==='closed');
  const act=votes.filter(v=>v.status==='active').length, cls=votes.filter(v=>v.status==='closed').length;
  return `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
  ${[['진행 중',`${act}건`,'#4F46E5'],['종료',`${cls}건`,'#94A3B8']].map(([l,v,c])=>`<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:${c}">${v}</div><div style="font-size:10px;color:#94A3B8">${l}</div></div>`).join('')}
</div>
${!filtered.length?`<div style="text-align:center;padding:40px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">🗳️</div><div style="font-size:13px">해당 투표가 없습니다.</div></div>`:filtered.map(v=>{
  const vBallots  = ballots.filter(b=>b.voteId===v.id);
  const totalVotes= vBallots.length + v.totalVoters;
  const maxVotes  = Math.max(...v.options.map(o=>o.votes + vBallots.filter(b=>b.optionId===o.id).length), 1);
  return `<div style="background:var(--card-bg);border:1px solid ${v.status==='active'?'#A5B4FC':'var(--border)'};border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;margin-bottom:8px">
    <div><div style="font-size:13px;font-weight:700">${v.title}</div><div style="font-size:11px;color:#94A3B8">${v.category} · ${v.startDate}~${v.endDate}</div></div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;background:${v.status==='active'?'#EEF2FF':'#F1F5F9'};color:${v.status==='active'?'#4F46E5':'#94A3B8'}">${v.status==='active'?'진행 중':'종료'}</span>
  </div>
  <div style="font-size:11px;color:#94A3B8;margin-bottom:8px">총 ${totalVotes}명 참여</div>
  ${v.options.map(o=>{
    const cnt  = o.votes + vBallots.filter(b=>b.optionId===o.id).length;
    const pct  = totalVotes>0 ? Math.round(cnt/totalVotes*100) : 0;
    const isTop= cnt===maxVotes && totalVotes>0;
    return `<div style="margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px"><span style="font-weight:${isTop?'700':'400'};color:${isTop?'#4F46E5':'var(--text)'}">${o.text}</span><span style="color:#94A3B8">${cnt}표 (${pct}%)</span></div>
      <div style="height:6px;background:var(--border);border-radius:3px"><div style="height:6px;background:${isTop?'#4F46E5':'#94A3B8'};border-radius:3px;width:${pct}%"></div></div>
    </div>`; }).join('')}
  ${v.status==='active'?`<button class="vta-close" data-id="${v.id}" style="margin-top:8px;width:100%;padding:7px;background:none;border:1px solid #EF4444;color:#EF4444;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">투표 종료</button>`:''}
</div>`; }).join('')}`;
}

function _renderCreate() {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:14px">새 투표 만들기</div>
  <div style="display:flex;flex-direction:column;gap:10px">
    <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">투표 제목 *</div>
      <input id="vta-title" type="text" placeholder="투표 제목" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">카테고리</div>
        <input id="vta-cat" type="text" placeholder="예: 복지" value="일반" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
      <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">마감일 *</div>
        <input id="vta-end" type="date" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
    </div>
    <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">선택지 (줄바꿈으로 구분) *</div>
      <textarea id="vta-opts" rows="4" placeholder="선택지 1&#10;선택지 2&#10;선택지 3" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;resize:none;box-sizing:border-box"></textarea></div>
    <button id="vta-create" style="padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">투표 생성</button>
  </div>
</div>`;
}

function _bindEvents() {
  _root.querySelectorAll('.vta-close').forEach(btn=>btn.addEventListener('click',()=>{
    const votes=_getVotes(); const v=votes.find(x=>x.id===btn.dataset.id); if(!v) return;
    v.status='closed'; _saveVotes(votes); showToast('투표가 종료됐습니다.','info'); _draw();
  }));
  _root.querySelector('#vta-create')?.addEventListener('click',()=>{
    const title=_root.querySelector('#vta-title')?.value.trim();
    const end=_root.querySelector('#vta-end')?.value;
    const optsRaw=_root.querySelector('#vta-opts')?.value.trim();
    if (!title||!end||!optsRaw) { showToast('제목, 마감일, 선택지를 입력해 주세요.','error'); return; }
    const opts=optsRaw.split('\n').map(t=>t.trim()).filter(Boolean).map((t,i)=>({id:'o'+(i+1),text:t,votes:0}));
    if (opts.length<2) { showToast('선택지를 2개 이상 입력해 주세요.','error'); return; }
    const votes=_getVotes();
    votes.push({ id:'VT'+Date.now(), title, category:_root.querySelector('#vta-cat')?.value.trim()||'일반', options:opts, status:'active', startDate:new Date().toISOString().slice(0,10), endDate:end, totalVoters:0, createdBy:'admin' });
    _saveVotes(votes); showToast('투표가 생성됐습니다.','success')
      addNotification({ type: 'success', title: 'Vote (관리자)', body: '투표가 생성됐습니다.' }); _tab='active'; _draw();
  });
}
export function mount(root) { return render(root); }
