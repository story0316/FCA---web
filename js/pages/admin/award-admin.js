/**
 * award-admin.js — 직원 포상 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_award_nominations';

const AWARD_TYPES = [
  { key:'mvp',        label:'이달의 MVP',  icon:'🏆' },
  { key:'teamwork',   label:'팀워크 상',   icon:'🤝' },
  { key:'innovation', label:'혁신 상',     icon:'💡' },
  { key:'growth',     label:'성장 상',     icon:'🌱' },
  { key:'customer',   label:'고객 감동 상', icon:'⭐' },
];

const LEGACY_IDS = new Set(['AWN001', 'AWN002', 'AWN003', 'AWN004', 'AWN005']);

const STATUS_META = {
  pending:  { label:'검토 중', color:'#F59E0B' },
  approved: { label:'선정',   color:'#10B981' },
  rejected: { label:'미선정', color:'#94A3B8' },
};

function _getAll() {
  try {
    const d = JSON.parse(localStorage.getItem(LS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_IDS.has(r.id));
    if (cleaned.length !== list.length) _save(cleaned);
    return cleaned;
  } catch { return []; }
}
function _save(l) { localStorage.setItem(LS, JSON.stringify(l)); }

let _tab  = 'nominations';
let _root = null;

export function render(root) { _root=root; _tab='nominations'; _draw(); }
export function unmount() { _root=null;
  _tab = 'nominations';
}

function _draw() {
  const noms    = _getAll();
  const pending = noms.filter(n=>n.status==='pending').length;

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['nominations',`추천 목록${pending?` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending}</span>`:''}`],['winners','수상 현황']].map(([k,l])=>`
    <button class="awa-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='nominations' ? _renderNominations(noms) : _renderWinners(noms)}
  </div>
</div>`;

  _root.querySelectorAll('.awa-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderNominations(noms) {
  const pending  = noms.filter(n=>n.status==='pending').length;
  const approved = noms.filter(n=>n.status==='approved').length;

  return `
<!-- KPI -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
  ${[
    ['총 추천', `${noms.length}건`, '#4F46E5'],
    ['검토 중', `${pending}건`, '#F59E0B'],
    ['선정', `${approved}건`, '#10B981'],
  ].map(([l,v,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:18px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8">${l}</div>
  </div>`).join('')}
</div>

${[...noms].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(n=>{
  const meta  = STATUS_META[n.status];
  const atype = AWARD_TYPES.find(t=>t.key===n.awardType)||AWARD_TYPES[0];
  return `
<div style="background:var(--card-bg);border:1px solid ${n.status==='pending'?'#FCD34D':'var(--border)'};
     border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="display:flex;gap:8px;align-items:center">
      <span style="font-size:20px">${atype.icon}</span>
      <div>
        <div style="font-size:12px;font-weight:700">${atype.label}</div>
        <div style="font-size:11px;color:#94A3B8">추천인: ${n.nominatorName} → 대상: ${n.nomineeName}</div>
      </div>
    </div>
    <span style="font-size:11px;font-weight:700;color:${meta.color}">${meta.label}</span>
  </div>
  <div style="font-size:12px;color:#64748B;margin-bottom:${n.status==='pending'?'10':'0'}px">${n.reason}</div>
  ${n.status==='pending' ? `
  <div style="display:flex;gap:6px">
    <button class="awa-approve" data-id="${n.id}"
      style="flex:1;padding:8px;background:#10B981;color:#fff;border:none;border-radius:8px;
             font-size:12px;font-weight:700;cursor:pointer">선정</button>
    <button class="awa-reject" data-id="${n.id}"
      style="flex:1;padding:8px;background:none;border:1px solid #94A3B8;color:#94A3B8;border-radius:8px;
             font-size:12px;font-weight:700;cursor:pointer">미선정</button>
  </div>` : ''}
</div>`; }).join('')}`;
}

function _renderWinners(noms) {
  const approved = noms.filter(n=>n.status==='approved');
  if (!approved.length) return `
<div style="text-align:center;padding:48px;color:#94A3B8">
  <div style="font-size:32px;margin-bottom:8px">🏆</div>
  <div style="font-size:13px">선정된 수상자가 없습니다.</div>
</div>`;

  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700">수상자 목록</div>
  ${approved.map(n=>{
    const atype = AWARD_TYPES.find(t=>t.key===n.awardType)||AWARD_TYPES[0];
    return `
  <div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
    <span style="font-size:24px">${atype.icon}</span>
    <div style="flex:1">
      <div style="font-size:13px;font-weight:700">${n.nomineeName}</div>
      <div style="font-size:11px;color:#94A3B8">${atype.label} · ${n.createdAt}</div>
    </div>
    <span style="font-size:11px;font-weight:700;color:#10B981">선정</span>
  </div>`; }).join('')}
</div>`;
}

function _bindEvents() {
  _root.querySelectorAll('.awa-approve').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const noms=_getAll(); const n=noms.find(x=>x.id===btn.dataset.id); if(!n) return;
      n.status='approved'; _save(noms);
      showToast(`${n.nomineeName} 수상자로 선정됐습니다.`, 'success')
      addNotification({ type: 'success', title: 'Award (관리자)', body: '수상자로 선정됐습니다.' }); _draw();
    });
  });

  _root.querySelectorAll('.awa-reject').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const noms=_getAll(); const n=noms.find(x=>x.id===btn.dataset.id); if(!n) return;
      n.status='rejected'; _save(noms);
      showToast('미선정 처리됐습니다.', 'info'); _draw();
    });
  });
}
export function mount(root) { return render(root); }
