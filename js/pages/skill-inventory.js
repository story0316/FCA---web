/**
 * skill-inventory.js — 스킬 인벤토리 (직원)
 * 보유 스킬·자격증 등록 / 팀 스킬 현황 조회
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_skill_inventory';

const SKILL_CATEGORIES = [
  { key:'lang',   label:'프로그래밍',  icon:'💻', examples:['JavaScript','Python','Java','TypeScript','Go','Rust','C++'] },
  { key:'infra',  label:'인프라·DevOps',icon:'⚙️', examples:['AWS','Docker','Kubernetes','Terraform','Linux','CI/CD'] },
  { key:'data',   label:'데이터·AI',   icon:'📊', examples:['SQL','Tableau','PyTorch','TensorFlow','Pandas','Spark'] },
  { key:'biz',    label:'비즈니스',    icon:'📈', examples:['Excel','PowerPoint','Figma','Jira','Notion','SAP'] },
  { key:'lang2',  label:'어학',        icon:'🌐', examples:['영어','일본어','중국어','독일어'] },
  { key:'cert',   label:'자격증',      icon:'🏆', examples:['정보처리기사','SQLD','AWS SAA','PMP','CPA','변호사'] },
];

const LEVELS = ['입문', '기초', '중급', '고급', '전문가'];
const LEVEL_COLOR = ['var(--text-muted)','#3B82F6','#10B981','#F59E0B','#EF4444'];

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }

function _getAll() { try { return JSON.parse(localStorage.getItem(LS)||'[]'); } catch { return []; } }
function _save(l)  { localStorage.setItem(LS, JSON.stringify(l)); }
function _mine()   { return _getAll().filter(s=>s.empId===_empId()); }

let _tab = 'my';
let _addCat = SKILL_CATEGORIES[0].key;
let _showAddForm = false;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _tab='my'; _showAddForm=false; _render(root); }
export function unmount() { _tab='my'; _showAddForm=false; }

function _render(root) {
  const mine = _mine().sort((a,b)=>a.category.localeCompare(b.category));
  const all  = _getAll();

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div class="top-bar" style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="sk-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🧠 스킬 인벤토리</div>
      <div style="font-size:11px;color:var(--text-muted)">내 스킬 ${mine.length}개 등록됨</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['my','내 스킬'],['team','팀 현황']].map(([k,l])=>`
    <button class="sk-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='my' ? _renderMy(mine) : _renderTeam(all)}
  </div>
</div>`;

  root.querySelector('#sk-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.sk-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _showAddForm=false; _render(root); }));

  if (_tab === 'my') {
    root.querySelector('#sk-add-toggle')?.addEventListener('click', () => { _showAddForm=!_showAddForm; _render(root); });

    // 카테고리 카드 선택 (폼)
    root.querySelectorAll('.sk-cat-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        _addCat=btn.dataset.cat;
        root.querySelectorAll('.sk-cat-btn').forEach(b=>{
          b.style.borderColor='var(--border)'; b.style.background='transparent'; b.style.color='var(--text-muted)';
        });
        btn.style.borderColor='#4F46E5'; btn.style.background='#EEF2FF'; btn.style.color='#4F46E5';
        _updateExamples(root);
      });
    });

    root.querySelector('#sk-save')?.addEventListener('click',()=>{
      const name  = root.querySelector('#sk-name').value.trim();
      const level = parseInt(root.querySelector('#sk-level').value)||2;
      const note  = root.querySelector('#sk-note').value.trim();
      if (!name) { showToast('스킬명을 입력하세요.', 'error'); return; }
      const list = _getAll();
      const dup  = list.find(s=>s.empId===_empId()&&s.name.toLowerCase()===name.toLowerCase());
      if (dup) { showToast('이미 등록된 스킬입니다.', 'error'); return; }
      list.push({ id:'SK_'+Date.now(), empId:_empId(), empName:_empName(), category:_addCat, name, level, note, addedAt:new Date().toISOString() });
      _save(list);
      showToast(`"${name}" 등록 완료!`, 'success')
    addNotification({ type: 'success', title: '스킬 등록', body: '"" 등록 완료!' });
      _showAddForm = false;
      _render(root);
    });

    root.querySelectorAll('.sk-delete').forEach(btn=>{
      btn.addEventListener('click',()=>{
        if (!confirm('스킬을 삭제하시겠습니까?')) return;
        const list=_getAll().filter(s=>s.id!==btn.dataset.id);
        _save(list);
        showToast('스킬이 삭제되었습니다.', 'info');
        _render(root);
      });
    });

    root.querySelectorAll('.sk-level-up,.sk-level-dn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const list=_getAll();
        const idx=list.findIndex(s=>s.id===btn.dataset.id);
        if (idx===-1) return;
        const delta = btn.classList.contains('sk-level-up')?1:-1;
        list[idx].level = Math.min(4,Math.max(0,(list[idx].level||2)+delta));
        _save(list);
        _render(root);
      });
    });
  }
}

function _updateExamples(root) {
  const cat = SKILL_CATEGORIES.find(c=>c.key===_addCat);
  const ex  = root.querySelector('#sk-examples');
  if (ex && cat) ex.textContent = '예: '+cat.examples.join(', ');
}

function _renderMy(mine) {
  const byCat = {};
  SKILL_CATEGORIES.forEach(c=>{ byCat[c.key]=[]; });
  mine.forEach(s=>{ (byCat[s.category]=byCat[s.category]||[]).push(s); });

  return `
<button id="sk-add-toggle"
  style="width:100%;padding:11px;background:${_showAddForm?'#EEF2FF':'#4F46E5'};
         color:${_showAddForm?'#4F46E5':'#fff'};border:${_showAddForm?'1.5px solid #4F46E5':'none'};
         border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:14px">
  ${_showAddForm?'✕ 취소':'+ 스킬 추가'}
</button>

${_showAddForm ? `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px">
  <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px">카테고리</div>
  <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
    ${SKILL_CATEGORIES.map(c=>`
    <button class="sk-cat-btn" data-cat="${c.key}"
      style="padding:6px 12px;font-size:11px;font-weight:600;border-radius:8px;cursor:pointer;
             border:1.5px solid ${c.key===_addCat?'#4F46E5':'var(--border)'};
             background:${c.key===_addCat?'#EEF2FF':'var(--card-bg)'};
             color:${c.key===_addCat?'#4F46E5':'var(--text-muted)'}">${c.icon} ${c.label}</button>`).join('')}
  </div>

  <div style="margin-bottom:10px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">스킬명</label>
    <input id="sk-name" type="text" placeholder="${SKILL_CATEGORIES.find(c=>c.key===_addCat)?.examples[0]||''}"
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    <div id="sk-examples" style="font-size:10px;color:var(--text-muted);margin-top:4px">예: ${SKILL_CATEGORIES.find(c=>c.key===_addCat)?.examples.join(', ')||''}</div>
  </div>

  <div style="margin-bottom:10px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">숙련도</label>
    <select id="sk-level" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
      ${LEVELS.map((l,i)=>`<option value="${i}">${l}</option>`).join('')}
    </select>
  </div>

  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">메모 (선택)</label>
    <input id="sk-note" type="text" placeholder="예: 자격증 번호, 취득일 등"
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>

  <button id="sk-save" style="width:100%;background:#4F46E5;color:#fff;border:none;border-radius:10px;padding:11px;font-size:13px;font-weight:700;cursor:pointer">등록하기</button>
</div>` : ''}

${!mine.length ? `
<div style="text-align:center;padding:40px 20px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">🧩</div>
  <div style="font-size:13px;margin-bottom:8px">등록된 스킬이 없습니다.</div>
      <button onclick="location.hash='#/skill-inventory'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">스킬 등록</button>
    
  <div style="font-size:11px">보유한 스킬과 자격증을 등록해보세요.</div>
</div>` : SKILL_CATEGORIES.map(cat=>{
  const catSkills = byCat[cat.key]||[];
  if (!catSkills.length) return '';
  return `
<div style="margin-bottom:14px">
  <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:6px">${cat.icon} ${cat.label}</div>
  ${catSkills.map(s=>{
    const lv    = Math.min(4,s.level||0);
    const lc    = LEVEL_COLOR[lv];
    const lname = LEVELS[lv];
    return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;
       padding:10px 12px;margin-bottom:6px;display:flex;align-items:center;gap:10px">
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:700;color:var(--text)">${s.name}</div>
      ${s.note?`<div style="font-size:11px;color:var(--text-muted);margin-top:1px">${s.note}</div>`:''}
    </div>
    <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
      <button class="sk-level-dn" data-id="${s.id}" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--border);background:var(--bg);cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center">-</button>
      <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:8px;background:${lc}22;color:${lc}">${lname}</span>
      <button class="sk-level-up" data-id="${s.id}" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--border);background:var(--bg);cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center">+</button>
      <button class="sk-delete" data-id="${s.id}" style="width:22px;height:22px;border-radius:50%;border:none;background:#FEE2E2;color:#DC2626;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center">✕</button>
    </div>
  </div>`;
  }).join('')}
</div>`;
}).filter(Boolean).join('')}`;
}

function _renderTeam(all) {
  // 스킬별 집계
  const skillMap = {};
  all.forEach(s=>{
    const key = s.category+'::'+s.name;
    if (!skillMap[key]) skillMap[key]={name:s.name, category:s.category, count:0, avgLevel:0, levels:[]};
    skillMap[key].count++;
    skillMap[key].levels.push(s.level||0);
  });
  Object.values(skillMap).forEach(sm=>{
    sm.avgLevel = sm.levels.reduce((a,b)=>a+b,0)/sm.levels.length;
  });

  const topSkills = Object.values(skillMap).sort((a,b)=>b.count-a.count).slice(0,15);

  // 카테고리별 보유자 수
  const catCount = {};
  SKILL_CATEGORIES.forEach(c=>{ catCount[c.key]=new Set(); });
  all.forEach(s=>{ if (catCount[s.category]) catCount[s.category].add(s.empId); });

  return `
<!-- 팀 요약 -->
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:14px">
  ${[
    {label:'등록 직원', value:new Set(all.map(s=>s.empId)).size+'명', color:'#4F46E5'},
    {label:'전체 스킬', value:all.length+'개', color:'#10B981'},
    {label:'스킬 유형', value:Object.keys(skillMap).length+'종', color:'#F59E0B'},
  ].map(k=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
    <div style="font-size:16px;font-weight:800;color:${k.color}">${k.value}</div>
    <div style="font-size:10px;color:var(--text-muted);margin-top:1px">${k.label}</div>
  </div>`).join('')}
</div>

<!-- 카테고리별 보유 현황 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:10px">카테고리별 보유 현황</div>
  ${SKILL_CATEGORIES.map(c=>{
    const cnt = catCount[c.key]?.size||0;
    return cnt>0?`
  <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">
    <span style="font-size:16px;width:24px;flex-shrink:0">${c.icon}</span>
    <div style="flex:1">
      <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:2px">${c.label}</div>
      <div style="background:#E2E8F0;border-radius:99px;height:4px">
        <div style="background:#4F46E5;height:4px;border-radius:99px;width:${Math.min(100,cnt*20)}%"></div>
      </div>
    </div>
    <div style="font-size:12px;font-weight:700;color:#4F46E5;flex-shrink:0">${cnt}명</div>
  </div>`:'';
  }).filter(Boolean).join('')}
</div>

<!-- 보유자 多 TOP 스킬 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:10px">🏆 팀 TOP 스킬</div>
  ${!topSkills.length
    ? `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">등록된 스킬이 없습니다.</div>`
    : topSkills.map((s,i)=>{
      const avgLv = Math.round(s.avgLevel);
      const lc = LEVEL_COLOR[Math.min(4,avgLv)];
      return `
  <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
    <div style="font-size:12px;font-weight:800;color:var(--text-muted);width:20px;text-align:center">${i+1}</div>
    <div style="flex:1">
      <div style="font-size:12px;font-weight:700;color:var(--text)">${s.name}</div>
      <div style="font-size:10px;color:var(--text-muted)">${SKILL_CATEGORIES.find(c=>c.key===s.category)?.label||s.category}</div>
    </div>
    <div style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:8px;background:${lc}22;color:${lc};flex-shrink:0">${LEVELS[avgLv]||'중급'}</div>
    <div style="font-size:12px;font-weight:700;color:var(--text-muted);flex-shrink:0">${s.count}명</div>
  </div>`;
    }).join('')}
</div>`;
}
