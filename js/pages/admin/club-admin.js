/**
 * club-admin.js — 사내 동호회 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS_CLUBS = 'hr_clubs';
const LS_REQ   = 'hr_club_requests';

const CAT_COLOR = { '문화':'#8B5CF6','스포츠':'#10B981','자기계발':'#3B82F6','게임':'#F59E0B','봉사':'#EF4444','기타':'#64748B' };

const LEGACY_CLUB_IDS = new Set(['CL001', 'CL002', 'CL003', 'CL004', 'CL005', 'CL006']);

const LEGACY_REQ_IDS = new Set(['CR001', 'CR002', 'CR003']);

function _getClubs() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_CLUBS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(c => !LEGACY_CLUB_IDS.has(c.id));
    if (cleaned.length !== list.length) _saveClubs(cleaned);
    return cleaned;
  } catch { return []; }
}
function _saveClubs(l) { localStorage.setItem(LS_CLUBS, JSON.stringify(l)); }

function _getRequests() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_REQ) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_REQ_IDS.has(r.id));
    if (cleaned.length !== list.length) _saveRequests(cleaned);
    return cleaned;
  } catch { return []; }
}
function _saveRequests(l) { localStorage.setItem(LS_REQ, JSON.stringify(l)); }

let _tab  = 'overview';
let _root = null;

export function render(root) { _root = root; _tab = 'overview'; _draw(); }
export function unmount()    { _root = null; _tab = 'overview'; }

function _draw() {
  const clubs    = _getClubs();
  const requests = _getRequests();
  const pending  = requests.filter(r=>r.status==='pending').length;

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['overview','개요'],['clubs','동호회 목록'],['requests',`개설 신청${pending?` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending}</span>`:''}` ]].map(([k,l])=>`
    <button class="ca-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='overview' ? _renderOverview(clubs)
    : _tab==='clubs'    ? _renderClubs(clubs)
    :                     _renderRequests(requests)}
  </div>
</div>`;

  _root.querySelectorAll('.ca-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

// ── Tab: 개요 ───────────────────────────────────────────────────
function _renderOverview(clubs) {
  const active      = clubs.filter(c=>c.active);
  const totalMem    = clubs.reduce((s,c)=>s+c.members.length, 0);
  const totalBudget = clubs.filter(c=>c.active).reduce((s,c)=>s+c.budget, 0);

  // 카테고리별 집계
  const byCat = {};
  clubs.forEach(c=>{ byCat[c.category]=(byCat[c.category]||0)+1; });
  const maxCat = Math.max(...Object.values(byCat), 1);

  // 동호회별 회원 수 (활성만, 내림차순)
  const sorted = [...active].sort((a,b)=>b.members.length-a.members.length);
  const maxMem = sorted.length ? sorted[0].members.length : 1;

  return `
<!-- KPI -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
  ${[
    ['총 동호회', `${clubs.length}개`, '🎯', '#4F46E5'],
    ['활성 동호회', `${active.length}개`, '✅', '#10B981'],
    ['전체 회원', `${totalMem}명`, '👥', '#F59E0B'],
    ['연간 예산', `${(totalBudget/10000).toFixed(0)}만원`, '💰', '#EF4444'],
  ].map(([l,v,ic,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px">
    <div style="font-size:18px;margin-bottom:4px">${ic}</div>
    <div style="font-size:18px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8;margin-top:2px">${l}</div>
  </div>`).join('')}
</div>

<!-- 카테고리 분포 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
  <div style="font-size:13px;font-weight:700;margin-bottom:10px">카테고리별 동호회 수</div>
  ${Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([cat,cnt])=>{
    const pct = Math.round((cnt/maxCat)*100);
    const col = CAT_COLOR[cat]||'#94A3B8';
    return `
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
    <div style="width:52px;font-size:11px;font-weight:600;color:var(--text);text-align:right">${cat}</div>
    <div style="flex:1">
      <div style="background:#E2E8F0;border-radius:99px;height:7px">
        <div style="background:${col};height:7px;border-radius:99px;width:${pct}%"></div>
      </div>
    </div>
    <div style="font-size:11px;font-weight:700;color:${col};width:24px;text-align:right">${cnt}개</div>
  </div>`;}).join('')}
</div>

<!-- 활성 동호회 회원 수 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:10px">활성 동호회 회원 현황</div>
  ${sorted.map(c=>{
    const pct  = Math.round((c.members.length/maxMem)*100);
    const fill = Math.round((c.members.length/c.maxMembers)*100);
    const col  = fill>=90?'#EF4444':fill>=70?'#F59E0B':'#4F46E5';
    return `
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
    <span style="font-size:16px;flex-shrink:0">${c.icon}</span>
    <div style="flex:1;min-width:0">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px">
        <span style="font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.name}</span>
        <span style="color:${col};font-weight:700;flex-shrink:0;margin-left:4px">${c.members.length}/${c.maxMembers}명</span>
      </div>
      <div style="background:#E2E8F0;border-radius:99px;height:5px">
        <div style="background:${col};height:5px;border-radius:99px;width:${pct}%"></div>
      </div>
    </div>
  </div>`;}).join('')}
</div>`;
}

// ── Tab: 동호회 목록 ────────────────────────────────────────────
function _renderClubs(clubs) {
  return clubs.map(c=>`
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;align-items:flex-start;gap:10px">
    <div style="font-size:28px;flex-shrink:0;line-height:1">${c.icon}</div>
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
        <span style="font-size:13px;font-weight:700;color:var(--text)">${c.name}</span>
        <span style="font-size:10px;padding:1px 6px;border-radius:99px;
               background:${CAT_COLOR[c.category]||'#94A3B8'}22;
               color:${CAT_COLOR[c.category]||'#94A3B8'};font-weight:600">${c.category}</span>
        <span style="font-size:10px;padding:1px 6px;border-radius:99px;font-weight:600;
               background:${c.active?'#D1FAE5':'#FEE2E2'};
               color:${c.active?'#059669':'#EF4444'}">${c.active?'활성':'비활성'}</span>
      </div>
      <div style="font-size:11px;color:#94A3B8;margin-bottom:6px">${c.desc}</div>
      <div style="display:flex;gap:10px;font-size:11px;color:#64748B">
        <span>👥 ${c.members.length}/${c.maxMembers}명</span>
        <span>💰 월 ${c.budget.toLocaleString()}원</span>
        <span>📅 ${c.createdAt}</span>
      </div>
    </div>
  </div>
  <div style="display:flex;gap:6px;margin-top:10px">
    <button class="ca-toggle" data-id="${c.id}" data-active="${c.active}"
      style="flex:1;padding:7px;border:1px solid ${c.active?'#FEE2E2':'#D1FAE5'};border-radius:8px;
             font-size:11px;font-weight:700;cursor:pointer;
             background:${c.active?'#FFF5F5':'#F0FFF4'};
             color:${c.active?'#EF4444':'#059669'}">${c.active?'비활성 처리':'활성 복구'}</button>
    <button class="ca-budget" data-id="${c.id}" data-budget="${c.budget}"
      style="flex:1;padding:7px;border:1px solid var(--border);border-radius:8px;
             font-size:11px;font-weight:700;cursor:pointer;background:var(--bg);color:var(--text)">예산 수정</button>
  </div>
</div>`).join('');
}

// ── Tab: 개설 신청 ──────────────────────────────────────────────
function _renderRequests(requests) {
  const pending  = requests.filter(r=>r.status==='pending');
  const resolved = requests.filter(r=>r.status!=='pending');

  const pendingHtml = pending.length ? pending.map(r=>`
<div style="background:var(--card-bg);border:1.5px solid #FCD34D;border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
    <span style="font-size:24px">${r.icon}</span>
    <div style="flex:1">
      <div style="font-size:13px;font-weight:700">${r.name}</div>
      <div style="font-size:10px;color:#94A3B8">${r.category} · 신청: ${r.reqBy} · ${r.reqDate}</div>
    </div>
  </div>
  <div style="font-size:12px;color:#64748B;margin-bottom:6px">${r.desc}</div>
  <div style="display:flex;gap:10px;font-size:11px;color:#64748B;margin-bottom:10px">
    <span>👥 초기 인원 ${r.initMembers}명</span>
    <span>💰 월 ${r.budget.toLocaleString()}원 요청</span>
  </div>
  <div style="display:flex;gap:6px">
    <button class="ca-approve" data-id="${r.id}"
      style="flex:1;padding:8px;background:#059669;color:#fff;border:none;border-radius:8px;
             font-size:12px;font-weight:700;cursor:pointer">승인</button>
    <button class="ca-reject" data-id="${r.id}"
      style="flex:1;padding:8px;background:#EF4444;color:#fff;border:none;border-radius:8px;
             font-size:12px;font-weight:700;cursor:pointer">반려</button>
  </div>
</div>`).join('') : `
<div style="text-align:center;padding:30px;color:#94A3B8">
  <div style="font-size:32px;margin-bottom:8px">✅</div>
  <div style="font-size:13px">대기 중인 신청이 없습니다.</div>
</div>`;

  const resolvedHtml = resolved.length ? `
<div style="font-size:12px;font-weight:700;color:#94A3B8;margin:16px 0 8px">처리 완료 (${resolved.length}건)</div>
${resolved.map(r=>`
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
     padding:12px;margin-bottom:6px;display:flex;align-items:center;gap:8px;opacity:0.7">
  <span style="font-size:18px">${r.icon}</span>
  <div style="flex:1;font-size:12px">
    <span style="font-weight:600">${r.name}</span>
    <span style="color:#94A3B8;margin-left:6px">${r.reqBy}</span>
  </div>
  <span style="font-size:11px;font-weight:700;
    color:${r.status==='approved'?'#059669':'#EF4444'}">
    ${r.status==='approved'?'승인':'반려'}
  </span>
</div>`).join('')}` : '';

  return pendingHtml + resolvedHtml;
}

// ── Event binding ───────────────────────────────────────────────
function _bindEvents() {
  // 탭 toggle/budget 버튼
  _root.querySelectorAll('.ca-toggle').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const clubs  = _getClubs();
      const active = btn.dataset.active === 'true';
      const idx    = clubs.findIndex(c=>c.id===btn.dataset.id);
      if (idx < 0) return;
      clubs[idx].active = !active;
      _saveClubs(clubs);
      showToast(`${clubs[idx].name} ${!active?'활성화':'비활성 처리'}됨`, 'success')
      addNotification({ type: 'success', title: 'Club (관리자)', body: '됨' });
      _draw();
    });
  });

  _root.querySelectorAll('.ca-budget').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const cur = parseInt(btn.dataset.budget)||0;
      const val = prompt(`새 월 예산 (현재 ${cur.toLocaleString()}원):`, cur);
      if (val === null) return;
      const next = parseInt(val)||0;
      if (next < 0) { showToast('0 이상 입력하세요.', 'error'); return; }
      const clubs = _getClubs();
      const idx   = clubs.findIndex(c=>c.id===btn.dataset.id);
      if (idx < 0) return;
      clubs[idx].budget = next;
      _saveClubs(clubs);
      showToast(`예산이 ${next.toLocaleString()}원으로 변경됐습니다.`, 'success')
      addNotification({ type: 'success', title: 'Club (관리자)', body: '예산이 원으로 변경됐습니다.' });
      _draw();
    });
  });

  // 신청 승인/반려
  _root.querySelectorAll('.ca-approve').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const reqs = _getRequests();
      const req  = reqs.find(r=>r.id===btn.dataset.id);
      if (!req) return;
      req.status = 'approved';
      _saveRequests(reqs);
      // 동호회 목록에 추가
      const clubs = _getClubs();
      clubs.push({
        id:         req.id,
        name:       req.name,
        icon:       req.icon,
        category:   req.category,
        desc:       req.desc,
        members:    [],
        maxMembers: 20,
        budget:     req.budget,
        active:     true,
        createdAt:  new Date().toISOString().slice(0,10),
      });
      _saveClubs(clubs);
      showToast(`${req.name} 개설이 승인됐습니다.`, 'success')
      addNotification({ type: 'success', title: 'Club (관리자)', body: '개설이 승인됐습니다.' });
      _draw();
    });
  });

  _root.querySelectorAll('.ca-reject').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const reqs = _getRequests();
      const req  = reqs.find(r=>r.id===btn.dataset.id);
      if (!req) return;
      req.status = 'rejected';
      _saveRequests(reqs);
      showToast(`${req.name} 신청이 반려됐습니다.`, 'info');
      _draw();
    });
  });
}
export function mount(root) { return render(root); }
