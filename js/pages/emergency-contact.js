/**
 * emergency-contact.js — 비상연락망 (직원)
 * 비상연락처 등록·수정 + 회사 긴급 연락처 조회
 */

import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
import { isApplicant } from '../auth.js';

const LS = 'hr_emergency_contacts';

const RELATIONS = ['배우자','부모','자녀','형제/자매','친척','기타'];

const COMPANY_CONTACTS = [
  { label:'대표이사',      name:'대표이사실',  tel:'010-0000-0001', icon:'👔' },
  { label:'HR팀장',        name:'HR팀',        tel:'010-0000-0005', icon:'👥' },
  { label:'총무팀',        name:'총무팀',  tel:'02-1234-5678',  icon:'🏢' },
  { label:'보안/안전',     name:'경비팀',  tel:'02-1234-5679',  icon:'🔒' },
  { label:'의료(AED)',     name:'응급처치담당',tel:'119',        icon:'🏥' },
  { label:'소방서',        name:'119',     tel:'119',           icon:'🚒' },
  { label:'경찰서',        name:'112',     tel:'112',           icon:'🚔' },
];

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }

function _getMine() {
  try {
    const all = JSON.parse(localStorage.getItem(LS)||'{}');
    return all[_empId()] || [];
  } catch { return []; }
}
function _saveMine(list) {
  try {
    const all = JSON.parse(localStorage.getItem(LS)||'{}');
    all[_empId()] = list;
    localStorage.setItem(LS, JSON.stringify(all));
  } catch {}
}

let _tab      = 'mine';
let _editId   = null;
let _showForm = false;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab='mine'; _editId=null; _showForm=false; _render(root);
}
export function unmount() { _tab='mine'; _editId=null; _showForm=false; }

function _render(root) {
  const contacts = _getMine();

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div class="top-bar" style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="ec-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🆘 비상연락망</div>
      <div style="font-size:11px;color:var(--text-muted)">비상연락처 ${contacts.length}명 등록</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['mine','내 비상연락처'],['company','회사 긴급연락처']].map(([k,l])=>`
    <button class="ec-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='mine' ? _renderMine(contacts) : _renderCompany()}
  </div>
</div>`;

  root.querySelector('#ec-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.ec-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _showForm=false; _editId=null; _render(root); }));

  if (_tab==='mine') {
    root.querySelector('#ec-add-toggle')?.addEventListener('click',()=>{
      _showForm=!_showForm; _editId=null; _render(root);
    });

    root.querySelector('#ec-save')?.addEventListener('click',()=>{
      const name     = root.querySelector('#ec-name').value.trim();
      const relation = root.querySelector('#ec-relation').value;
      const tel      = root.querySelector('#ec-tel').value.trim();
      const tel2     = root.querySelector('#ec-tel2').value.trim();
      const note     = root.querySelector('#ec-note').value.trim();
      if (!name) { showToast('이름을 입력하세요.','error'); return; }
      if (!tel)  { showToast('연락처를 입력하세요.','error'); return; }

      const list = _getMine();
      if (_editId) {
        const idx = list.findIndex(c=>c.id===_editId);
        if (idx!==-1) list[idx] = {...list[idx], name, relation, tel, tel2, note};
        showToast('수정되었습니다.','success')
    addNotification({ type: 'success', title: '비상연락처', body: '수정되었습니다.' });
      } else {
        list.push({ id:'EC_'+Date.now(), name, relation, tel, tel2, note, primary: list.length===0 });
        showToast('비상연락처가 등록되었습니다.','success')
    addNotification({ type: 'success', title: '비상연락처', body: '비상연락처가 등록되었습니다.' });
      }
      _saveMine(list);
      _showForm=false; _editId=null; _render(root);
    });

    root.querySelectorAll('.ec-edit-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        _editId=btn.dataset.id; _showForm=true; _render(root);
        const c = _getMine().find(x=>x.id===_editId);
        if (!c) return;
        root.querySelector('#ec-name').value     = c.name||'';
        root.querySelector('#ec-relation').value = c.relation||'배우자';
        root.querySelector('#ec-tel').value      = c.tel||'';
        root.querySelector('#ec-tel2').value     = c.tel2||'';
        root.querySelector('#ec-note').value     = c.note||'';
      });
    });

    root.querySelectorAll('.ec-del-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        if (!confirm('비상연락처를 삭제하시겠습니까?')) return;
        _saveMine(_getMine().filter(c=>c.id!==btn.dataset.id));
        showToast('삭제되었습니다.','info');
        _render(root);
      });
    });

    root.querySelectorAll('.ec-primary-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const list = _getMine().map(c=>({...c, primary: c.id===btn.dataset.id}));
        _saveMine(list);
        _render(root);
      });
    });
  }
}

function _renderMine(contacts) {
  const editing = _editId ? _getMine().find(c=>c.id===_editId) : null;

  return `
<div style="background:#FEF3C7;border-left:4px solid #F59E0B;border-radius:10px;padding:10px;margin-bottom:14px">
  <div style="font-size:11px;font-weight:700;color:#92400E;margin-bottom:3px">⚠️ 비상연락처 안내</div>
  <div style="font-size:10px;color:#92400E;line-height:1.6">업무 중 응급상황 발생 시 연락할 가족·지인을 등록해주세요. 정보는 보안 처리됩니다.</div>
</div>

<button id="ec-add-toggle"
  style="width:100%;padding:10px;background:${_showForm?'#EEF2FF':'#4F46E5'};
         color:${_showForm?'#4F46E5':'#fff'};border:${_showForm?'1.5px solid #4F46E5':'none'};
         border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:12px">
  ${_showForm? (_editId?'✕ 수정 취소':'✕ 취소') : '+ 비상연락처 추가'}
</button>

${_showForm?`
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px">${_editId?'비상연락처 수정':'새 비상연락처 등록'}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
    <div>
      <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:3px;font-weight:600">이름</label>
      <input id="ec-name" type="text" placeholder="홍길동"
        style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
    <div>
      <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:3px;font-weight:600">관계</label>
      <select id="ec-relation" style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text)">
        ${RELATIONS.map(r=>`<option>${r}</option>`).join('')}
      </select>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
    <div>
      <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:3px;font-weight:600">연락처 (필수)</label>
      <input id="ec-tel" type="tel" placeholder="010-0000-0000"
        style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
    <div>
      <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:3px;font-weight:600">보조 연락처</label>
      <input id="ec-tel2" type="tel" placeholder="선택"
        style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
  </div>
  <div style="margin-bottom:10px">
    <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:3px;font-weight:600">메모</label>
    <input id="ec-note" type="text" placeholder="예: 오전만 통화 가능, 해외 거주"
      style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>
  <button id="ec-save" style="width:100%;padding:10px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">${_editId?'수정 완료':'등록하기'}</button>
</div>`:''}

${!contacts.length?`
<div style="text-align:center;padding:40px 20px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">📵</div>
  <div style="font-size:13px;margin-bottom:6px">등록된 비상연락처가 없습니다.</div>
      <button onclick="location.hash='#/emergency-contact'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">연락처 등록</button>
    
  <div style="font-size:11px">긴급 상황을 대비해 연락처를 등록해주세요.</div>
</div>`
: contacts.map(c=>`
<div style="background:var(--card-bg);border:1.5px solid ${c.primary?'#4F46E5':'var(--border)'};border-radius:12px;padding:14px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div style="display:flex;align-items:center;gap:10px">
      <div style="width:40px;height:40px;border-radius:50%;background:${c.primary?'#EEF2FF':'#F1F5F9'};
           display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">
        ${c.relation==='배우자'?'💑':c.relation==='부모'?'👪':c.relation==='자녀'?'👶':'👤'}
      </div>
      <div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:14px;font-weight:700;color:var(--text)">${c.name}</span>
          <span style="font-size:10px;color:var(--text-muted)">${c.relation}</span>
          ${c.primary?`<span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:6px;background:#EEF2FF;color:#4F46E5">주 연락처</span>`:''}
        </div>
        <div style="font-size:12px;color:#4F46E5;font-weight:600;margin-top:2px">📞 ${c.tel}</div>
        ${c.tel2?`<div style="font-size:11px;color:var(--text-muted)">📞 ${c.tel2}</div>`:''}
        ${c.note?`<div style="font-size:10px;color:var(--text-muted);margin-top:2px">${c.note}</div>`:''}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;margin-left:8px">
      <button class="ec-edit-btn" data-id="${c.id}"
        style="padding:4px 10px;font-size:11px;background:#EEF2FF;color:#4F46E5;border:none;border-radius:6px;cursor:pointer">수정</button>
      <button class="ec-del-btn" data-id="${c.id}"
        style="padding:4px 10px;font-size:11px;background:#FEE2E2;color:#DC2626;border:none;border-radius:6px;cursor:pointer">삭제</button>
      ${!c.primary?`<button class="ec-primary-btn" data-id="${c.id}"
        style="padding:4px 10px;font-size:10px;background:var(--bg);color:var(--text-muted);border:1px solid var(--border);border-radius:6px;cursor:pointer">주 연락처</button>`:''}
    </div>
  </div>
</div>`).join('')}`;
}

function _renderCompany() {
  return `
<div style="background:#FEE2E2;border-left:4px solid #EF4444;border-radius:10px;padding:10px;margin-bottom:14px">
  <div style="font-size:11px;font-weight:700;color:#991B1B;margin-bottom:3px">🆘 긴급 상황 발생 시</div>
  <div style="font-size:10px;color:#991B1B;line-height:1.6">인명 위험 → 즉시 119·112 신고 후 HR팀 통보<br>업무 긴급 → 담당 팀장 → HR팀 순서로 연락</div>
</div>

${COMPANY_CONTACTS.map(c=>`
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:13px;margin-bottom:8px;
     display:flex;align-items:center;gap:12px">
  <div style="font-size:24px;flex-shrink:0">${c.icon}</div>
  <div style="flex:1">
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:1px">${c.label}</div>
    <div style="font-size:13px;font-weight:700;color:var(--text)">${c.name}</div>
  </div>
  <a href="tel:${c.tel.replace(/-/g,'')}"
    style="padding:7px 14px;background:#EEF2FF;color:#4F46E5;border:1px solid #C7D2FE;
           border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;flex-shrink:0">
    📞 ${c.tel}
  </a>
</div>`).join('')}`;
}
