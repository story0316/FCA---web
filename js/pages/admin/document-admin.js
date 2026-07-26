/**
 * document-admin.js — 서류 발급 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_document_requests';

const DOC_TYPES = [
  { key:'employment',  label:'재직증명서',        icon:'📄' },
  { key:'career',      label:'경력증명서',         icon:'📋' },
  { key:'salary',      label:'급여확인서',         icon:'💰' },
  { key:'tax',         label:'근로소득원천징수확인서', icon:'🧾' },
  { key:'insurance',   label:'건강보험료납부확인서', icon:'🏥' },
  { key:'pension',     label:'국민연금가입확인서',  icon:'📑' },
  { key:'retirement',  label:'퇴직증명서',         icon:'📰' },
];

const LEGACY_IDS = new Set(['DR001', 'DR002', 'DR003', 'DR004', 'DR005']);

const STATUS_META = {
  pending:  { label:'처리 중', color:'#F59E0B' },
  ready:    { label:'발급 완료', color:'#10B981' },
  issued:   { label:'수령 완료', color:'#94A3B8' },
  rejected: { label:'반려',    color:'#EF4444' },
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

let _tab  = 'pending';
let _root = null;

export function render(root) { _root=root; _tab='pending'; _draw(); }
export function unmount() { _root=null;
  _tab = 'pending';
}

function _draw() {
  const reqs    = _getAll();
  const pending = reqs.filter(r=>r.status==='pending').length;

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['pending',`대기${pending?` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending}</span>`:''}`],['all','전체 내역']].map(([k,l])=>`
    <button class="da-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_renderList(reqs)}
  </div>
</div>`;

  _root.querySelectorAll('.da-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderList(reqs) {
  const filtered = _tab==='pending'
    ? reqs.filter(r=>r.status==='pending')
    : [...reqs].sort((a,b)=>b.reqDate.localeCompare(a.reqDate));

  const pendN  = reqs.filter(r=>r.status==='pending').length;
  const readyN = reqs.filter(r=>r.status==='ready').length;
  const issuedN= reqs.filter(r=>r.status==='issued').length;

  return `
<!-- KPI -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
  ${[
    ['처리 대기', `${pendN}건`, '#F59E0B'],
    ['발급 완료', `${readyN}건`, '#10B981'],
    ['수령 완료', `${issuedN}건`, '#94A3B8'],
  ].map(([l,v,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:18px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8">${l}</div>
  </div>`).join('')}
</div>

${!filtered.length ? `
<div style="text-align:center;padding:40px;color:#94A3B8">
  <div style="font-size:32px;margin-bottom:8px">📄</div>
  <div style="font-size:13px">처리할 신청이 없습니다.</div>
</div>` : filtered.map(r=>{
  const meta = STATUS_META[r.status];
  const dt   = DOC_TYPES.find(t=>t.key===r.docType)||DOC_TYPES[0];
  return `
<div style="background:var(--card-bg);border:1px solid ${r.status==='pending'?'#FCD34D':'var(--border)'};
     border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="display:flex;gap:8px;align-items:center">
      <span style="font-size:20px">${dt.icon}</span>
      <div>
        <div style="font-size:13px;font-weight:700">${r.empName}</div>
        <div style="font-size:11px;color:#94A3B8">${r.reqDate} · ${dt.label} ${r.copies}부</div>
      </div>
    </div>
    <span style="font-size:11px;font-weight:700;color:${meta.color}">${meta.label}</span>
  </div>
  <div style="font-size:11px;color:#64748B;margin-bottom:${r.status==='pending'?'10':'0'}px">
    목적: ${r.purpose}${r.note?` · ${r.note}`:''}
  </div>
  ${r.status==='pending' ? `
  <div style="display:flex;gap:6px">
    <button class="da-ready" data-id="${r.id}"
      style="flex:1;padding:8px;background:#10B981;color:#fff;border:none;border-radius:8px;
             font-size:12px;font-weight:700;cursor:pointer">발급 완료</button>
    <button class="da-reject" data-id="${r.id}"
      style="flex:1;padding:8px;background:none;border:1px solid #EF4444;color:#EF4444;border-radius:8px;
             font-size:12px;font-weight:700;cursor:pointer">반려</button>
  </div>` : r.status==='ready' ? `
  <button class="da-issue" data-id="${r.id}"
    style="width:100%;padding:8px;background:#94A3B8;color:#fff;border:none;border-radius:8px;
           font-size:12px;font-weight:700;cursor:pointer;margin-top:8px">수령 확인</button>
  ` : ''}
</div>`; }).join('')}`;
}

function _bindEvents() {
  _root.querySelectorAll('.da-ready').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const reqs=_getAll(); const r=reqs.find(x=>x.id===btn.dataset.id); if(!r) return;
      r.status='ready'; _save(reqs);
      showToast(`${r.empName} 서류 발급 완료됐습니다.`, 'success')
      addNotification({ type: 'success', title: 'Document (관리자)', body: '서류 발급 완료됐습니다.' }); _draw();
    });
  });

  _root.querySelectorAll('.da-issue').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const reqs=_getAll(); const r=reqs.find(x=>x.id===btn.dataset.id); if(!r) return;
      r.status='issued'; _save(reqs);
      showToast('수령 확인 처리됐습니다.', 'success')
      addNotification({ type: 'success', title: 'Document (관리자)', body: '수령 확인 처리됐습니다.' }); _draw();
    });
  });

  _root.querySelectorAll('.da-reject').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const reqs=_getAll(); const r=reqs.find(x=>x.id===btn.dataset.id); if(!r) return;
      r.status='rejected'; _save(reqs);
      showToast('반려 처리됐습니다.', 'info'); _draw();
    });
  });
}
export function mount(root) { return render(root); }
