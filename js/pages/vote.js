/**
 * vote.js — 사내 투표 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS_VOTES   = 'hr_votes';
const LS_BALLOTS = 'hr_vote_ballots';

const DEMO_VOTES = [
  { id:'VT001', title:'2026년 사내 복지 우선순위', category:'복지', options:[{id:'o1',text:'식대 지원 확대',votes:8},{id:'o2',text:'교통비 지원',votes:5},{id:'o3',text:'건강검진 강화',votes:3}], status:'active', startDate:'2026-06-01', endDate:'2026-06-10', totalVoters:16 },
  { id:'VT002', title:'팀 행사 요일 선호도 조사', category:'행사', options:[{id:'o1',text:'금요일 오후',votes:7},{id:'o2',text:'토요일 오전',votes:4}], status:'active', startDate:'2026-06-03', endDate:'2026-06-07', totalVoters:11 },
  { id:'VT003', title:'사내 카페테리아 메뉴 개선', category:'시설', options:[{id:'o1',text:'한식 강화',votes:5},{id:'o2',text:'샐러드바 추가',votes:4},{id:'o3',text:'가격 인하',votes:3}], status:'closed', startDate:'2026-05-15', endDate:'2026-05-22', totalVoters:12 },
];

function _empId() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').userId||'EMP001'; } catch { return 'EMP001'; } }
function _getVotes() {
  const s = localStorage.getItem(LS_VOTES);
  if (!s) { localStorage.setItem(LS_VOTES, JSON.stringify(DEMO_VOTES)); return DEMO_VOTES; }
  try {
    const d = JSON.parse(s);
    return [...DEMO_VOTES.filter(dv=>!d.find(v=>v.id===dv.id)), ...d];
  } catch { return DEMO_VOTES; }
}
function _getBallots() { try { return JSON.parse(localStorage.getItem(LS_BALLOTS)||'[]'); } catch { return []; } }
function _saveBallots(l) { localStorage.setItem(LS_BALLOTS, JSON.stringify(l)); }

let _tab  = 'active';
let _root = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _root=root; _tab='active'; _render(); }
export function unmount() { _tab = 'active'; _root=null; }

function _render() {
  const votes   = _getVotes();
  const ballots = _getBallots();
  const myId    = _empId();

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="vt-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1"><div style="font-size:15px;font-weight:700">🗳️ 사내 투표</div><div style="font-size:11px;color:var(--text-muted)">진행 중 ${votes.filter(v=>v.status==='active').length}건</div></div>
  </div>
  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['active','진행 중'],['closed','종료']].map(([k,l])=>`
    <button class="vt-tab" data-tab="${k}" style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>
  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_renderVotes(votes.filter(v=>v.status===_tab), ballots, myId)}
  </div>
</div>`;

  _root.querySelector('#vt-back').addEventListener('click',()=>window.navBack());
  _root.querySelectorAll('.vt-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(); }));
  _bindVote(ballots, myId);
}

function _renderVotes(votes, ballots, myId) {
  if (!votes.length) return `<div style="text-align:center;padding:48px 16px;color:var(--text-muted)"><div style="font-size:40px;margin-bottom:10px">🗳️</div><div style="font-size:14px">해당 투표가 없습니다</div>
      <button onclick="location.hash='#/vote'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">투표 목록 보기</button>
    </div>`;
  return votes.map(v=>{
    const myBallot  = ballots.find(b=>b.voteId===v.id&&b.empId===myId);
    const newVotes  = ballots.filter(b=>b.voteId===v.id);
    const total     = v.totalVoters + newVotes.length;
    return `<div style="background:var(--card-bg);border:1px solid ${v.status==='active'&&!myBallot?'#A5B4FC':'var(--border)'};border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;margin-bottom:10px">
    <div><div style="font-size:13px;font-weight:700">${v.title}</div><div style="font-size:11px;color:var(--text-muted)">${v.category} · ~${v.endDate}</div></div>
    ${myBallot?`<span style="font-size:11px;font-weight:700;color:#10B981">✓ 참여 완료</span>`:v.status==='active'?`<span style="font-size:11px;font-weight:700;color:#4F46E5">참여 가능</span>`:``}
  </div>
  ${v.options.map(o=>{
    const cnt  = o.votes + ballots.filter(b=>b.voteId===v.id&&b.optionId===o.id).length;
    const pct  = total>0 ? Math.round(cnt/total*100) : 0;
    const mine = myBallot?.optionId===o.id;
    return `<div style="margin-bottom:8px">
      ${v.status==='active'&&!myBallot?
        `<button class="vt-vote" data-vid="${v.id}" data-oid="${o.id}" style="width:100%;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:8px;text-align:left;cursor:pointer;font-size:12px;color:var(--text)">${o.text}</button>`:
        `<div>
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px"><span style="font-weight:${mine?'700':'400'};color:${mine?'#4F46E5':'var(--text)'}">${o.text}${mine?' ✓':''}</span><span style="color:var(--text-muted)">${cnt}표 (${pct}%)</span></div>
          <div style="height:6px;background:var(--border);border-radius:3px"><div style="height:6px;background:${mine?'#4F46E5':'var(--text-muted)'};border-radius:3px;width:${pct}%"></div></div>
        </div>`}
    </div>`; }).join('')}
  <div style="font-size:10px;color:var(--text-muted);text-align:right;margin-top:4px">총 ${total}명 참여</div>
</div>`; }).join('');
}

function _bindVote(ballots, myId) {
  _root.querySelectorAll('.vt-vote').forEach(btn=>btn.addEventListener('click',()=>{
    const voteId   = btn.dataset.vid;
    const optionId = btn.dataset.oid;
    if (ballots.find(b=>b.voteId===voteId&&b.empId===myId)) { showToast('이미 투표하셨습니다.','error'); return; }
    ballots.push({ id:'B_'+Date.now(), voteId, optionId, empId:myId, votedAt:new Date().toISOString() });
    _saveBallots(ballots);
    showToast('투표가 완료됐습니다.','success')
    addNotification({ type: 'success', title: '투표', body: '투표가 완료됐습니다.' }); _render();
  }));
}
