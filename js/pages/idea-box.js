/**
 * idea-box.js — 아이디어 제안함 (직원)
 * 개선 제안 제출 · 좋아요 · 관리자 채택 현황
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_ideas';

const CATEGORIES = [
  { key:'process',  label:'업무 프로세스', icon:'⚙️', color:'#3B82F6' },
  { key:'culture',  label:'조직 문화',     icon:'🌱', color:'#10B981' },
  { key:'welfare',  label:'복리후생',       icon:'💝', color:'#EC4899' },
  { key:'tool',     label:'툴·인프라',     icon:'🛠️', color:'#F59E0B' },
  { key:'product',  label:'제품·서비스',   icon:'🚀', color:'#8B5CF6' },
  { key:'etc',      label:'기타',           icon:'💡', color:'var(--text-muted)' },
];

const STATUS_META = {
  pending:     { label:'검토 중',  color:'#F59E0B', bg:'#FEF3C7' },
  reviewing:   { label:'검토 중',  color:'#3B82F6', bg:'#DBEAFE' },
  adopted:     { label:'채택됨',   color:'#10B981', bg:'#D1FAE5' },
  implementing:{ label:'구현 중',  color:'#8B5CF6', bg:'#EDE9FE' },
  done:        { label:'완료',     color:'#059669', bg:'#D1FAE5' },
  rejected:    { label:'미채택',   color:'#EF4444', bg:'#FEE2E2' },
};

function _session()  { try { return JSON.parse(localStorage.getItem('hr_session')||'{}'); } catch { return {}; } }
function _empId()    { return _session().empId || _session().userId || 'EMP001'; }
function _empName()  { return _session().name || '직원'; }

function _getDemoIdeas() {
  const uid = _empId(); const name = _empName();
  return [
    { id:'ID001', empId:'SHARED_001', empName:'이민준', category:'culture', title:'매주 금요일 팀 런치 타임', content:'팀 소통 강화를 위해 매주 금요일 점심을 함께하는 문화를 만들어보면 어떨까요?', likes:[uid,'SHARED_003','SHARED_005'], status:'adopted', adminComment:'좋은 제안입니다! 다음 달부터 시행합니다.', createdAt:'2026-05-10T10:00:00Z' },
    { id:'ID002', empId:'SHARED_002', empName:'박서연', category:'tool', title:'슬랙 알림 규칙 정비', content:'업무 외 시간 슬랙 알림 차단 정책을 도입하면 워라밸 개선에 도움이 될 것 같습니다.', likes:[uid,'SHARED_004'], status:'reviewing', adminComment:'', createdAt:'2026-05-15T09:00:00Z' },
    { id:'ID003', empId:'SHARED_003', empName:'최동현', category:'process', title:'주간 업무 템플릿 표준화', content:'팀마다 다른 주간보고 형식을 통일하면 리뷰 시간이 줄어들 것 같습니다.', likes:['SHARED_002'], status:'pending', adminComment:'', createdAt:'2026-05-20T14:00:00Z' },
    { id:'ID004', empId:'SHARED_004', empName:'정유리', category:'welfare', title:'반려동물 동반 출근 데이', content:'월 1회 반려동물과 함께 출근하는 날을 운영하면 어떨까요?', likes:[uid,'SHARED_002','SHARED_003','SHARED_007'], status:'pending', adminComment:'', createdAt:'2026-05-25T11:00:00Z' },
    { id:`ID_${uid}`, empId:uid, empName:name, category:'product', title:'고객 피드백 자동 분류 시스템', content:'CS 데이터를 AI로 분류해 주간 인사이트 리포트를 자동화하면 의사결정이 빨라질 것 같습니다.', likes:['SHARED_004','SHARED_006'], status:'implementing', adminComment:'개발팀 Q3 로드맵에 포함했습니다.', createdAt:'2026-06-01T08:00:00Z' },
  ];
}

function _getAll() {
  const demo = _getDemoIdeas();
  const s = localStorage.getItem(LS);
  if (!s) { localStorage.setItem(LS, JSON.stringify(demo)); return demo; }
  try {
    const saved = JSON.parse(s);
    return [...demo.filter(d => !saved.find(x => x.id === d.id)), ...saved];
  } catch { return demo; }
}
function _save(l) { localStorage.setItem(LS, JSON.stringify(l)); }

let _tab      = 'feed';
let _selCat   = '전체';
let _showForm = false;
let _sort     = 'latest'; // latest | likes

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _tab='feed'; _selCat='전체'; _showForm=false; _sort='latest'; _render(root); }
export function unmount() { _sort = null; _tab='feed'; _showForm=false; }

function _render(root) {
  const all  = _getAll();
  const mine = all.filter(i=>i.empId===_empId());
  const adoptedCnt = all.filter(i=>['adopted','implementing','done'].includes(i.status)).length;

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div class="top-bar" style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="ib-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">💡 아이디어 제안함</div>
      <div style="font-size:11px;color:var(--text-muted)">전체 ${all.length}건 · 채택 ${adoptedCnt}건</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['feed','전체 피드'],['mine','내 제안']].map(([k,l])=>`
    <button class="ib-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='feed' ? _renderFeed(all) : _renderMine(mine)}
  </div>
</div>`;

  root.querySelector('#ib-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.ib-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _showForm=false; _render(root); }));

  root.querySelectorAll('.ib-cat-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{ _selCat=btn.dataset.cat; _render(root); });
  });
  root.querySelectorAll('.ib-sort-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{ _sort=btn.dataset.sort; _render(root); });
  });

  root.querySelector('#ib-new-toggle')?.addEventListener('click',()=>{ _showForm=!_showForm; _render(root); });
  root.querySelector('#ib-submit')?.addEventListener('click',()=>{
    const cat     = root.querySelector('#ib-cat').value;
    const title   = root.querySelector('#ib-title').value.trim();
    const content = root.querySelector('#ib-content').value.trim();
    if (!title)   { showToast('제목을 입력하세요.','error'); return; }
    if (!content) { showToast('내용을 입력하세요.','error'); return; }
    const list = _getAll();
    list.unshift({
      id:'ID_'+Date.now(), empId:_empId(), empName:_empName(),
      category:cat, title, content, likes:[], status:'pending',
      adminComment:'', createdAt:new Date().toISOString(),
    });
    _save(list);
    showToast('아이디어가 제출되었습니다!','success');
    addNotification({ type: 'system', title: `아이디어 제출: ${title}`, body: '' });
    _showForm=false; _tab='feed'; _render(root);
  });

  root.querySelectorAll('.ib-like').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const list = _getAll();
      const idx  = list.findIndex(i=>i.id===btn.dataset.id);
      if (idx===-1) return;
      const likes = list[idx].likes||[];
      if (likes.includes(_empId())) list[idx].likes = likes.filter(x=>x!==_empId());
      else list[idx].likes = [...likes, _empId()];
      _save(list);
      _render(root);
    });
  });
}

function _renderFeed(all) {
  const cats = ['전체', ...CATEGORIES.map(c=>c.key)];
  let filtered = _selCat==='전체' ? all : all.filter(i=>i.category===_selCat);
  if (_sort==='likes') filtered = [...filtered].sort((a,b)=>(b.likes?.length||0)-(a.likes?.length||0));
  else filtered = [...filtered].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));

  return `
<!-- 필터 + 정렬 -->
<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
  ${['전체',...CATEGORIES.map(c=>c.key)].map(k=>{
    const cat = CATEGORIES.find(c=>c.key===k);
    const label = cat?.label||'전체';
    const color = cat?.color||'#4F46E5';
    const active = _selCat===k;
    return `<button class="ib-cat-btn" data-cat="${k}"
      style="padding:4px 10px;font-size:10px;font-weight:600;border-radius:20px;cursor:pointer;
             border:1.5px solid ${active?color:'var(--border)'};
             background:${active?color+'22':'var(--card-bg)'};color:${active?color:'var(--text-muted)'}">
      ${cat?.icon||'💡'} ${label}</button>`;
  }).join('')}
</div>

<div style="display:flex;gap:6px;margin-bottom:12px">
  ${[['latest','최신순'],['likes','좋아요순']].map(([k,l])=>`
  <button class="ib-sort-btn" data-sort="${k}"
    style="padding:4px 10px;font-size:11px;font-weight:600;border-radius:8px;cursor:pointer;
           border:1.5px solid ${_sort===k?'#4F46E5':'var(--border)'};
           background:${_sort===k?'#EEF2FF':'var(--card-bg)'};color:${_sort===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
</div>

<button id="ib-new-toggle"
  style="width:100%;padding:10px;background:${_showForm?'#EEF2FF':'#4F46E5'};
         color:${_showForm?'#4F46E5':'#fff'};border:${_showForm?'1.5px solid #4F46E5':'none'};
         border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:12px">
  ${_showForm?'✕ 취소':'+ 아이디어 제안하기'}
</button>

${_showForm?`
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="margin-bottom:8px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px;font-weight:600">카테고리</label>
    <select id="ib-cat" style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text)">
      ${CATEGORIES.map(c=>`<option value="${c.key}">${c.icon} ${c.label}</option>`).join('')}
    </select>
  </div>
  <div style="margin-bottom:8px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px;font-weight:600">제목</label>
    <input id="ib-title" type="text" placeholder="한 줄로 아이디어를 설명해주세요"
      style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>
  <div style="margin-bottom:10px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px;font-weight:600">상세 내용</label>
    <textarea maxlength="500" id="ib-content" rows="4" placeholder="현재 문제점, 제안 내용, 기대 효과를 작성해주세요."
      style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;background:var(--bg);color:var(--text);box-sizing:border-box;resize:vertical;line-height:1.6"></textarea>
  </div>
  <button id="ib-submit" style="width:100%;padding:10px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">제출하기</button>
</div>`:''}

${!filtered.length?`<div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
  <div style="font-size:48px;margin-bottom:12px">💡</div>
  <div style="font-size:14px;font-weight:600;color:var(--text-muted);margin-bottom:6px">아이디어가 없습니다</div>
  <div style="font-size:12px;margin-bottom:16px">좋은 아이디어를 제안해 보세요!</div>
</div>`
: filtered.map(idea=>{
  const cat   = CATEGORIES.find(c=>c.key===idea.category)||{icon:'💡',label:idea.category,color:'var(--text-muted)'};
  const st    = STATUS_META[idea.status]||STATUS_META.pending;
  const liked = (idea.likes||[]).includes(_empId());
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
      <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;background:${cat.color}22;color:${cat.color}">${cat.icon} ${cat.label}</span>
      <span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:6px;background:${st.bg};color:${st.color}">${st.label}</span>
    </div>
    <span style="font-size:10px;color:var(--text-muted);flex-shrink:0">${idea.createdAt.slice(0,10)}</span>
  </div>
  <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">${idea.title}</div>
  <div style="font-size:12px;color:var(--text-muted);line-height:1.6;margin-bottom:10px">${idea.content}</div>
  ${idea.adminComment?`<div style="font-size:11px;color:#4F46E5;font-weight:600;background:#EEF2FF;border-radius:8px;padding:8px;margin-bottom:8px">💬 ${idea.adminComment}</div>`:''}
  <div style="display:flex;align-items:center;justify-content:space-between">
    <span style="font-size:11px;color:var(--text-muted)">by ${idea.empName}</span>
    <button class="ib-like" data-id="${idea.id}"
      style="display:flex;align-items:center;gap:4px;padding:5px 12px;border-radius:20px;cursor:pointer;
             border:1.5px solid ${liked?'#EF4444':'var(--border)'};
             background:${liked?'#FEE2E2':'var(--card-bg)'};color:${liked?'#EF4444':'var(--text-muted)'};font-size:12px;font-weight:600">
      ❤️ ${(idea.likes||[]).length}
    </button>
  </div>
</div>`;
}).join('')}`;
}

function _renderMine(mine) {
  if (!mine.length) return `
<div style="text-align:center;padding:50px 20px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">💡</div>
  <div style="font-size:13px;margin-bottom:6px">제출한 아이디어가 없습니다.</div>
      <button onclick="_showForm()" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">아이디어 제출</button>
    
  <div style="font-size:11px">좋은 아이디어를 공유해보세요!</div>
</div>`;

  const adopted = mine.filter(i=>['adopted','implementing','done'].includes(i.status)).length;
  const totalLikes = mine.reduce((s,i)=>s+(i.likes?.length||0),0);

  return `
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
  ${[
    {label:'제출',   value:mine.length+'건',  color:'#4F46E5'},
    {label:'채택',   value:adopted+'건',      color:'#10B981'},
    {label:'받은 ❤️', value:totalLikes+'개',  color:'#EF4444'},
  ].map(k=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
    <div style="font-size:16px;font-weight:800;color:${k.color}">${k.value}</div>
    <div style="font-size:10px;color:var(--text-muted);margin-top:1px">${k.label}</div>
  </div>`).join('')}
</div>
${mine.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(idea=>{
  const cat = CATEGORIES.find(c=>c.key===idea.category)||{icon:'💡',label:idea.category,color:'var(--text-muted)'};
  const st  = STATUS_META[idea.status]||STATUS_META.pending;
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
    <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;background:${cat.color}22;color:${cat.color}">${cat.icon} ${cat.label}</span>
    <span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:6px;background:${st.bg};color:${st.color}">${st.label}</span>
  </div>
  <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">${idea.title}</div>
  <div style="display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:11px;color:var(--text-muted)">${idea.createdAt.slice(0,10)}</span>
    <span style="font-size:11px;color:#EF4444;font-weight:600">❤️ ${(idea.likes||[]).length}</span>
  </div>
  ${idea.adminComment?`<div style="font-size:11px;color:#4F46E5;font-weight:600;margin-top:6px;background:#EEF2FF;border-radius:8px;padding:8px">💬 ${idea.adminComment}</div>`:''}
</div>`;
}).join('')}`;
}
