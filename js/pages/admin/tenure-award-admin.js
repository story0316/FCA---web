/**
 * tenure-award-admin.js — 근속 포상 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';

const LS = 'hr_tenure_awards';

const MILESTONES = [
  { years:1,  label:'1년 근속',  icon:'🌱', reward:'소정의 상품권 5만원', color:'#10B981' },
  { years:3,  label:'3년 근속',  icon:'🌿', reward:'상품권 15만원 + 감사패', color:'#059669' },
  { years:5,  label:'5년 근속',  icon:'🏆', reward:'상품권 30만원 + 기념품', color:'#F59E0B' },
  { years:10, label:'10년 근속', icon:'🥇', reward:'상품권 80만원 + 특별 연차 3일', color:'#EF4444' },
  { years:15, label:'15년 근속', icon:'💎', reward:'상품권 150만원 + 특별 연차 5일', color:'#8B5CF6' },
  { years:20, label:'20년 근속', icon:'👑', reward:'상품권 300만원 + 특별 연차 7일 + 해외연수', color:'#4F46E5' },
];

const LEGACY_IDS = new Set(['TA001','TA002','TA003','TA004']);

function _getAll() {
  try {
    const d = JSON.parse(localStorage.getItem(LS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_IDS.has(r.id));
    if (cleaned.length !== list.length) _saveAll(cleaned);
    return cleaned;
  } catch { return []; }
}
function _saveAll(l) { localStorage.setItem(LS, JSON.stringify(l)); }

let _employees = [];

let _tab  = 'eligible';
let _root = null;

export function render(root) { _root=root; _tab='eligible'; _draw(); }
export function unmount() { _root=null;
  _tab = 'eligible';
}

function _draw() {
  const all  = _getAll();
  const elig = all.filter(a=>a.status==='eligible').length;

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['eligible',`수여 대기${elig?` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${elig}</span>`:''}`],['history','수상 이력'],['register','대상 등록']].map(([k,l])=>`
    <button class="taa-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='eligible'  ? _renderEligible(all)
    : _tab==='history'   ? _renderHistory(all)
    :                      _renderRegister()}
  </div>
</div>`;

  _root.querySelectorAll('.taa-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderEligible(all) {
  const eligible = all.filter(a=>a.status==='eligible');
  const received = all.filter(a=>a.status==='received').length;

  return `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
  ${[['수여 대기',`${eligible.length}명`,'#F59E0B'],['수여 완료',`${received}명`,'#10B981']].map(([l,v,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:20px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8">${l}</div>
  </div>`).join('')}
</div>

${!eligible.length ? `
<div style="text-align:center;padding:40px;color:#94A3B8">
  <div style="font-size:32px;margin-bottom:8px">🏅</div>
  <div style="font-size:13px">수여 대기 중인 직원이 없습니다.</div>
</div>` : eligible.map(a=>{
  const m = MILESTONES.find(x=>x.years===a.years)||MILESTONES[0];
  return `
<div style="background:var(--card-bg);border:2px solid ${m.color}44;border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="display:flex;gap:10px;align-items:center">
      <span style="font-size:28px">${m.icon}</span>
      <div>
        <div style="font-size:13px;font-weight:700">${a.empName}</div>
        <div style="font-size:11px;color:#94A3B8">${a.dept||''} · 입사 ${a.joinDate}</div>
      </div>
    </div>
    <span style="font-size:12px;font-weight:800;color:${m.color}">${m.label}</span>
  </div>
  <div style="font-size:11px;color:#64748B;margin-bottom:10px">포상: ${m.reward}</div>
  <button class="taa-award" data-id="${a.id}"
    style="width:100%;padding:8px;background:${m.color};color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">
    포상 수여 처리
  </button>
</div>`; }).join('')}`;
}

function _renderHistory(all) {
  const received = [...all].filter(a=>a.status==='received').sort((a,b)=>b.awardDate.localeCompare(a.awardDate));
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700">
    수상 이력 · 총 ${received.length}명
  </div>
  ${!received.length ? `<div style="padding:24px;text-align:center;color:#94A3B8;font-size:12px">수상 이력이 없습니다.</div>` :
  received.map(a=>{
    const m = MILESTONES.find(x=>x.years===a.years)||MILESTONES[0];
    return `
  <div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px">
    <span style="font-size:20px">${m.icon}</span>
    <div style="flex:1">
      <div style="font-size:12px;font-weight:700">${a.empName}</div>
      <div style="font-size:10px;color:#94A3B8">${m.label} · 수여 ${a.awardDate}</div>
    </div>
    <span style="font-size:10px;font-weight:700;color:${m.color};background:${m.color}11;padding:2px 7px;border-radius:99px">완료</span>
  </div>`; }).join('')}
</div>`;
}

function _renderRegister() {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:14px">근속 포상 대상 등록</div>
  <div style="display:flex;flex-direction:column;gap:10px">
    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">직원 *</div>
      <select id="taa-emp"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
               background:var(--bg);color:var(--text);font-size:12px">
        <option value="">선택</option>
        ${_employees.map(e=>`<option value="${e.id}" data-name="${e.name}" data-dept="${e.dept}" data-join="${e.join_date || e.joinDate || e.hire_date || ''}">${e.name} (${e.dept})</option>`).join('')}
      </select>
    </div>
    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">마일스톤 *</div>
      <select id="taa-milestone"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
               background:var(--bg);color:var(--text);font-size:12px">
        <option value="">선택</option>
        ${MILESTONES.map(m=>`<option value="${m.years}">${m.icon} ${m.label}</option>`).join('')}
      </select>
    </div>
    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">입사일</div>
      <input id="taa-join" type="date"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
               background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
    </div>
    <button id="taa-submit"
      style="padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;
             font-size:13px;font-weight:700;cursor:pointer">대상 등록</button>
  </div>
</div>`;
}

function _bindEvents() {
  _root.querySelectorAll('.taa-award').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const all=_getAll(); const a=all.find(x=>x.id===btn.dataset.id); if(!a) return;
      a.status='received'; a.awardDate=new Date().toISOString().slice(0,10);
      _saveAll(all);
      showToast(`${a.empName} 근속 포상 수여 완료됐습니다.`, 'success')
      addNotification({ type: 'success', title: 'Tenure Award (관리자)', body: '근속 포상 수여 완료됐습니다.' }); _draw();
    });
  });

  _root.querySelector('#taa-emp')?.addEventListener('change',e=>{
    const opt = e.target.options[e.target.selectedIndex];
    const joinInput = _root.querySelector('#taa-join');
    if (joinInput && opt.dataset.join) joinInput.value = opt.dataset.join;
  });

  _root.querySelector('#taa-submit')?.addEventListener('click',()=>{
    const empSel = _root.querySelector('#taa-emp');
    const mSel   = _root.querySelector('#taa-milestone');
    const empId  = empSel?.value;
    const empOpt = empSel?.options[empSel.selectedIndex];
    const years  = parseInt(mSel?.value);
    const joinDate = _root.querySelector('#taa-join')?.value;
    if (!empId||!years) { showToast('직원과 마일스톤을 선택해 주세요.', 'error'); return; }
    const m = MILESTONES.find(x=>x.years===years);
    const all = _getAll();
    all.push({
      id:        'TA'+Date.now(),
      empId,
      empName:   empOpt?.dataset.name||empId,
      dept:      empOpt?.dataset.dept||'',
      years,
      milestone: m?.label||`${years}년 근속`,
      status:    'eligible',
      joinDate:  joinDate||'',
      awardDate: null,
    });
    _saveAll(all);
    showToast('포상 대상이 등록됐습니다.', 'success')
      addNotification({ type: 'success', title: 'Tenure Award (관리자)', body: '포상 대상이 등록됐습니다.' });
    _tab='eligible'; _draw();
  });
}
export async function mount(root) {
  _employees = await loadDisplayEmployees();
  return render(root);
}
