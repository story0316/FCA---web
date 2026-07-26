/**
 * study-group.js — 사내 스터디 그룹 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS_GROUPS  = 'hr_study_groups';
const LS_MEMBERS = 'hr_study_members';

const LEGACY_SG_IDS = new Set(['SG001', 'SG002', 'SG003', 'SG004']);

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }

function _getGroups() {
  const s = localStorage.getItem(LS_GROUPS);
  if (!s) return [];
  try {
    const d = JSON.parse(s);
    const cleaned = d.filter(g => !LEGACY_SG_IDS.has(g.id));
    if (cleaned.length < d.length) localStorage.setItem(LS_GROUPS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}
function _saveGroups(l) { localStorage.setItem(LS_GROUPS, JSON.stringify(l)); }
function _getMembers() { try { return JSON.parse(localStorage.getItem(LS_MEMBERS)||'[]'); } catch { return []; } }
function _saveMembers(l) { localStorage.setItem(LS_MEMBERS, JSON.stringify(l)); }

const CATEGORIES = ['기술', '어학', '자기계발', '비즈니스', '기타'];

let _tab  = 'list';
let _root = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _root=root; _tab='list'; _render(); }
export function unmount() { _tab = 'list'; _root=null; }

function _render() {
  const groups  = _getGroups();
  const members = _getMembers();
  const myGroups= members.filter(m=>m.empId===_empId());

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="sg-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">📚 스터디 그룹</div>
      <div style="font-size:11px;color:var(--text-muted)">참여 ${myGroups.length}개</div>
    </div>
    ${myGroups.length ? `<div style="background:#4F46E5;color:#fff;border-radius:99px;padding:3px 10px;font-size:12px;font-weight:700">참여 ${myGroups.length}</div>` : ''}
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['list','스터디 목록'],['mine','내 스터디'],['create','개설하기']].map(([k,l])=>`
    <button class="sg-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:11px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='list'   ? _renderList(groups, members)
    : _tab==='mine'   ? _renderMine(myGroups, groups)
    :                   _renderCreate()}
  </div>
</div>`;

  _root.querySelector('#sg-back').addEventListener('click', ()=>window.navBack());
  _root.querySelectorAll('.sg-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(); }));
  _bindList();
}

function _renderList(groups, members) {
  const myIds = new Set(members.filter(m=>m.empId===_empId()).map(m=>m.groupId));

  return groups.map(g=>{
    const cnt     = members.filter(m=>m.groupId===g.id).length;
    const joined  = myIds.has(g.id);
    const full    = cnt >= g.capacity;
    const isLeader= g.leader === _empId();
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;gap:10px;margin-bottom:8px">
    <span style="font-size:28px;flex-shrink:0">${g.icon}</span>
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
        <span style="font-size:13px;font-weight:700">${g.title}</span>
        <span style="font-size:10px;background:#EEF2FF;color:#4F46E5;padding:1px 6px;border-radius:99px">${g.category}</span>
        ${isLeader?`<span style="font-size:10px;background:#FEF3C7;color:#92400E;padding:1px 6px;border-radius:99px">리더</span>`:''}
      </div>
      <div style="font-size:11px;color:var(--text-muted)">${g.day}</div>
    </div>
  </div>
  <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">${g.desc}</div>
  <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;margin-bottom:10px">
    <span style="color:var(--text-muted)">리더: ${g.leaderName} · ${cnt}/${g.capacity}명</span>
    <span style="font-weight:700;color:${full?'#EF4444':cnt/g.capacity>=0.8?'#F59E0B':'#10B981'}">${Math.round(cnt/g.capacity*100)}%</span>
  </div>
  <button class="sg-join" data-id="${g.id}" data-title="${g.title}" ${joined||full||isLeader?'disabled':''}
    style="width:100%;padding:9px;border:none;border-radius:8px;font-size:12px;font-weight:700;
           cursor:${joined||full||isLeader?'not-allowed':'pointer'};
           background:${joined||isLeader?'#D1FAE5':full?'#F1F5F9':'#4F46E5'};
           color:${joined||isLeader?'#10B981':full?'var(--text-muted)':'#fff'}">
    ${isLeader?'✓ 내가 개설':''+joined?'✓ 참여 중':full?'마감':'참여하기'}
  </button>
</div>`; }).join('');
}

function _renderMine(myGroups, groups) {
  if (!myGroups.length) return `
<div style="text-align:center;padding:48px 16px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">📚</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:4px">참여 중인 스터디가 없습니다</div>
      <button onclick="location.hash='#/study-group'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">스터디 찾기</button>
    
  <div style="font-size:12px">스터디에 참여하거나 직접 개설해 보세요!</div>
</div>`;

  return myGroups.map(m=>{
    const g = groups.find(x=>x.id===m.groupId);
    if (!g) return '';
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;gap:10px;align-items:center">
    <span style="font-size:24px">${g.icon}</span>
    <div style="flex:1">
      <div style="font-size:13px;font-weight:700">${g.title}</div>
      <div style="font-size:11px;color:var(--text-muted)">${g.day}</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;
                 background:${g.leader===_empId()?'#FEF3C7':'#ECFDF5'};
                 color:${g.leader===_empId()?'#92400E':'#10B981'}">
      ${g.leader===_empId()?'리더':'멤버'}
    </span>
  </div>
</div>`; }).join('');
}

function _renderCreate() {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:14px">스터디 그룹 개설</div>
  <div style="display:flex;flex-direction:column;gap:10px">
    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">스터디명 *</div>
      <input id="sg-title" type="text" placeholder="스터디 그룹 이름"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
               background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">카테고리</div>
        <select id="sg-cat" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px">
          ${CATEGORIES.map(c=>`<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">최대 인원</div>
        <input id="sg-cap" type="number" value="8" min="2"
          style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
      </div>
    </div>
    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">모임 일정</div>
      <input id="sg-day" type="text" placeholder="예: 매주 화요일 19:00"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
               background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
    </div>
    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">소개 *</div>
      <textarea maxlength="500" id="sg-desc" rows="3" placeholder="스터디 목표·방식·선호 인원 등을 자유롭게 적어 주세요"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
               background:var(--bg);color:var(--text);font-size:12px;resize:none;box-sizing:border-box"></textarea>
    </div>
    <button id="sg-submit" style="padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">개설하기</button>
  </div>
</div>`;
}

function _bindList() {
  _root.querySelectorAll('.sg-join').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if (btn.disabled) return;
      const members = _getMembers();
      members.push({ id:'SGM_'+Date.now(), groupId:btn.dataset.id, empId:_empId(), empName:_empName(), joinedAt:new Date().toISOString().slice(0,10) });
      _saveMembers(members);
      showToast(`"${btn.dataset.title}" 스터디에 참여했습니다.`, 'success')
    addNotification({ type: 'success', title: '스터디', body: '"" 스터디에 참여했습니다.' });
      _render();
    });
  });

  _root.querySelector('#sg-submit')?.addEventListener('click',()=>{
    const title = _root.querySelector('#sg-title')?.value.trim();
    const desc  = _root.querySelector('#sg-desc')?.value.trim();
    if (!title||!desc) { showToast('스터디명과 소개를 입력해 주세요.', 'error'); return; }
    const ICONS = { '기술':'💻', '어학':'🌍', '자기계발':'📖', '비즈니스':'💼', '기타':'✨' };
    const cat   = _root.querySelector('#sg-cat')?.value||'기타';
    const groups = _getGroups();
    const newG = {
      id:          'SG'+Date.now(),
      title,
      category:    cat,
      leader:      _empId(),
      leaderName:  _empName(),
      desc,
      capacity:    parseInt(_root.querySelector('#sg-cap')?.value)||8,
      day:         _root.querySelector('#sg-day')?.value||'미정',
      icon:        ICONS[cat]||'✨',
      status:      'open',
      createdAt:   new Date().toISOString().slice(0,10),
    };
    groups.push(newG);
    _saveGroups(groups);
    const members = _getMembers();
    members.push({ id:'SGM_'+Date.now(), groupId:newG.id, empId:_empId(), empName:_empName(), joinedAt:new Date().toISOString().slice(0,10) });
    _saveMembers(members);
    showToast('스터디 그룹이 개설됐습니다.', 'success')
    addNotification({ type: 'success', title: '스터디', body: '스터디 그룹이 개설됐습니다.' });
    _tab='list'; _render();
  });
}
