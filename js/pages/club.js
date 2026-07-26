/**
 * club.js — 사내 동호회 (직원)
 * 동호회 가입·탈퇴·개설 신청
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_clubs';
const FOUNDING_LS = 'hr_club_foundings';

const LEGACY_CLUB_IDS = new Set(['CL001', 'CL002', 'CL003', 'CL004', 'CL005']);

const CATEGORIES = ['문화','스포츠','자기계발','게임','봉사','기타'];
const CAT_COLOR  = { '문화':'#8B5CF6','스포츠':'#10B981','자기계발':'#3B82F6','게임':'#F59E0B','봉사':'#EF4444','기타':'var(--text-muted)' };

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }

function _getClubs() {
  const s = localStorage.getItem(LS);
  if (!s) return [];
  try {
    const d = JSON.parse(s);
    const cleaned = d.filter(c => !LEGACY_CLUB_IDS.has(c.id));
    if (cleaned.length < d.length) localStorage.setItem(LS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}
function _save(l) { localStorage.setItem(LS, JSON.stringify(l)); }

let _tab       = 'list';
let _showForm  = false;
let _selCat    = '전체';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _tab='list'; _showForm=false; _selCat='전체'; _render(root); }
export function unmount() { _tab='list'; _showForm=false; }

function _render(root) {
  const clubs = _getClubs();
  const myClubs = clubs.filter(c=>c.members.includes(_empId()));

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div class="top-bar" style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="cl-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🎯 사내 동호회</div>
      <div style="font-size:11px;color:var(--text-muted)">가입 ${myClubs.length}개 · 전체 ${clubs.length}개</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['list','동호회 목록'],['mine','내 동호회']].map(([k,l])=>`
    <button class="cl-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='list' ? _renderList(clubs) : _renderMine(myClubs)}
  </div>
</div>`;

  root.querySelector('#cl-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.cl-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _showForm=false; _render(root); }));

  // 카테고리 필터
  root.querySelectorAll('.cl-cat-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{ _selCat=btn.dataset.cat; _render(root); });
  });

  // 가입/탈퇴
  root.querySelectorAll('.cl-join').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const clubs2 = _getClubs();
      const idx = clubs2.findIndex(c=>c.id===btn.dataset.id);
      if (idx===-1) return;
      const c = clubs2[idx];
      if (c.members.includes(_empId())) {
        
        c.members = c.members.filter(m=>m!==_empId());
        showToast(`"${c.name}" 탈퇴했습니다.`,'info');
      } else {
        if (c.members.length>=c.maxMembers) { showToast('정원이 마감되었습니다.','error'); return; }
        c.members.push(_empId());
        showToast(`"${c.name}" 가입 완료!`,'success')
    addNotification({ type: 'success', title: '동호회', body: '"" 가입 완료!' });
        addNotification({ type: 'system', title: `동호회 가입: ${c.name}`, body: '' });
      }
      _save(clubs2);
      _render(root);
    });
  });

  // 개설 폼
  root.querySelector('#cl-new-toggle')?.addEventListener('click',()=>{ _showForm=!_showForm; _render(root); });
  root.querySelector('#cl-create')?.addEventListener('click',()=>{
    const name = root.querySelector('#cl-new-name').value.trim();
    const cat  = root.querySelector('#cl-new-cat').value;
    const desc = root.querySelector('#cl-new-desc').value.trim();
    const max  = parseInt(root.querySelector('#cl-new-max').value)||15;
    const icon = root.querySelector('#cl-new-icon').value||'🎯';
    if (!name) { showToast('동호회 이름을 입력하세요.','error'); return; }
    if (!desc) { showToast('활동 소개를 입력하세요.','error'); return; }
    let requests = [];
    try { requests = JSON.parse(localStorage.getItem(FOUNDING_LS) || '[]'); } catch { requests = []; }
    if (requests.some(r => r.clubName === name && r.status === 'pending')) {
      showToast('같은 이름의 개설 신청이 이미 검토 중입니다.','error');
      return;
    }
    const session = (() => {
      try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
    })();
    requests.push({
      id: `CF_${Date.now()}`,
      clubName: name,
      icon,
      category: cat,
      desc,
      memberCount: 1,
      maxMembers: max,
      meetingCycle: 'monthly',
      reqBy: _empName(),
      reqById: _empId(),
      dept: session.dept || session.department || '소속 미지정',
      reqDate: new Date().toISOString().slice(0, 10),
      status: 'pending',
    });
    localStorage.setItem(FOUNDING_LS, JSON.stringify(requests));
    showToast(`"${name}" 동호회 개설을 신청했습니다.`,'success')
    addNotification({ type: 'success', title: '동호회', body: '"" 동호회 개설을 신청했습니다.' });
    _showForm=false; _render(root);
  });
}

function _renderList(clubs) {
  const cats = ['전체', ...CATEGORIES.filter(c=>clubs.some(cl=>cl.category===c))];
  const filtered = _selCat==='전체' ? clubs : clubs.filter(c=>c.category===_selCat);

  return `
<!-- 카테고리 필터 -->
<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
  ${cats.map(c=>`
  <button class="cl-cat-btn" data-cat="${c}"
    style="padding:5px 12px;font-size:11px;font-weight:600;border-radius:20px;cursor:pointer;
           border:1.5px solid ${_selCat===c?CAT_COLOR[c]||'#4F46E5':'var(--border)'};
           background:${_selCat===c?(CAT_COLOR[c]||'#4F46E5')+'22':'var(--card-bg)'};
           color:${_selCat===c?CAT_COLOR[c]||'#4F46E5':'var(--text-muted)'}">${c}</button>`).join('')}
</div>

<button id="cl-new-toggle"
  style="width:100%;padding:10px;background:${_showForm?'#EEF2FF':'#4F46E5'};
         color:${_showForm?'#4F46E5':'#fff'};border:${_showForm?'1.5px solid #4F46E5':'none'};
         border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:12px">
  ${_showForm?'✕ 취소':'+ 동호회 개설하기'}
</button>

${_showForm ? `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="display:grid;grid-template-columns:48px 1fr;gap:8px;margin-bottom:8px">
    <div>
      <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:3px;font-weight:600">아이콘</label>
      <input id="cl-new-icon" type="text" value="🎯" maxlength="2"
        style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:20px;background:var(--bg);color:var(--text);text-align:center;box-sizing:border-box">
    </div>
    <div>
      <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:3px;font-weight:600">동호회 이름</label>
      <input id="cl-new-name" type="text" placeholder="예: 영화 감상 모임"
        style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 80px;gap:8px;margin-bottom:8px">
    <div>
      <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:3px;font-weight:600">카테고리</label>
      <select id="cl-new-cat" style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text)">
        ${CATEGORIES.map(c=>`<option>${c}</option>`).join('')}
      </select>
    </div>
    <div>
      <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:3px;font-weight:600">최대 인원</label>
      <input id="cl-new-max" type="number" value="15" min="2" max="50"
        style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
  </div>
  <div style="margin-bottom:10px">
    <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:3px;font-weight:600">활동 소개</label>
    <textarea maxlength="500" id="cl-new-desc" rows="2" placeholder="모임 일정, 활동 내용을 소개하세요."
      style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;background:var(--bg);color:var(--text);box-sizing:border-box;resize:vertical"></textarea>
  </div>
  <button id="cl-create" style="width:100%;padding:10px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">개설 신청하기</button>
</div>` : ''}

${!filtered.length ? `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
  <div style="font-size:48px;margin-bottom:12px">🎪</div>
  <div style="font-size:14px;font-weight:600;color:var(--text-muted);margin-bottom:6px">해당 카테고리 동호회가 없습니다</div>
  <div style="font-size:12px;margin-bottom:16px">직접 동호회를 개설해 보세요!</div>
</div>` :
filtered.map(c=>{
  const isMember = c.members.includes(_empId());
  const full     = c.members.length >= c.maxMembers && !isMember;
  const catColor = CAT_COLOR[c.category]||'var(--text-muted)';
  return `
<div style="background:var(--card-bg);border:1px solid ${isMember?catColor+'55':'var(--border)'};border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
    <div style="display:flex;align-items:center;gap:10px">
      <div style="font-size:28px">${c.icon}</div>
      <div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
          <span style="font-size:13px;font-weight:700;color:var(--text)">${c.name}</span>
          ${isMember?`<span style="font-size:9px;padding:1px 6px;border-radius:6px;background:#EEF2FF;color:#4F46E5;font-weight:700">가입중</span>`:''}
        </div>
        <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;background:${catColor}22;color:${catColor}">${c.category}</span>
      </div>
    </div>
    <button class="cl-join" data-id="${c.id}"
      style="padding:6px 14px;border-radius:8px;font-size:11px;font-weight:700;cursor:${full?'not-allowed':'pointer'};flex-shrink:0;
             border:1.5px solid ${isMember?'#FCA5A5':full?'var(--border)':'#4F46E5'};
             background:${isMember?'#FEE2E2':full?'var(--bg)':'#EEF2FF'};
             color:${isMember?'#DC2626':full?'var(--text-muted)':'#4F46E5'}"
      ${full?'disabled':''}>
      ${isMember?'탈퇴':full?'마감':'가입'}
    </button>
  </div>
  <div style="font-size:12px;color:var(--text-muted);line-height:1.5;margin-bottom:8px">${c.desc}</div>
  <div style="display:flex;align-items:center;gap:10px">
    <div style="flex:1;background:#E2E8F0;border-radius:99px;height:4px">
      <div style="background:${catColor};height:4px;border-radius:99px;width:${Math.min(100,(c.members.length/c.maxMembers)*100)}%"></div>
    </div>
    <span style="font-size:11px;color:var(--text-muted);flex-shrink:0">${c.members.length}/${c.maxMembers}명</span>
  </div>
</div>`;
}).join('')}`;
}

function _renderMine(myClubs) {
  if (!myClubs.length) return `
<div style="text-align:center;padding:50px 20px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">🎯</div>
  <div style="font-size:13px;margin-bottom:6px">가입한 동호회가 없습니다.</div>
      <button onclick="location.hash='#/club'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">동호회 보기</button>
    
  <div style="font-size:11px">관심 있는 동호회에 가입해보세요!</div>
</div>`;

  return myClubs.map(c=>{
    const catColor = CAT_COLOR[c.category]||'var(--text-muted)';
    return `
<div style="background:var(--card-bg);border:1.5px solid ${catColor}44;border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
    <div style="font-size:32px">${c.icon}</div>
    <div style="flex:1">
      <div style="font-size:14px;font-weight:700;color:var(--text)">${c.name}</div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:2px">
        <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;background:${catColor}22;color:${catColor}">${c.category}</span>
        <span style="font-size:10px;color:var(--text-muted)">${c.members.length}명 활동 중</span>
      </div>
    </div>
    ${c.budget?`<div style="font-size:12px;font-weight:700;color:#10B981;text-align:right;flex-shrink:0">${c.budget.toLocaleString()}원<div style="font-size:9px;color:var(--text-muted);font-weight:400">예산</div></div>`:''}
  </div>
  <div style="font-size:12px;color:var(--text-muted);line-height:1.5;margin-bottom:8px">${c.desc}</div>
  <div style="font-size:10px;color:var(--text-muted)">개설일: ${c.createdAt}</div>
</div>`;
  }).join('');
}
