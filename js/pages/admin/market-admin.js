/**
 * market-admin.js — 사내 마켓 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_market_items';

const LEGACY_IDS = new Set(['MK001', 'MK002', 'MK003', 'MK004']);

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

let _tab  = 'active';
let _root = null;

export function render(root) { _root=root; _tab='active'; _draw(); }
export function unmount() { _root=null;
  _tab = 'active';
}

function _draw() {
  const all      = _getAll();
  const reported = all.filter(i=>i.status==='reported').length;

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['active','판매 중'],['reported',`신고${reported?` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${reported}</span>`:''}`],['all','전체']].map(([k,l])=>`
    <button class="mka-tab" data-tab="${k}" style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;white-space:nowrap;border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">${_renderList(all)}</div>
</div>`;

  _root.querySelectorAll('.mka-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderList(all) {
  const filtered = _tab==='active' ? all.filter(i=>i.status==='active') : _tab==='reported' ? all.filter(i=>i.status==='reported') : [...all].sort((a,b)=>b.postedAt.localeCompare(a.postedAt));
  const act=all.filter(i=>i.status==='active').length, sold=all.filter(i=>i.status==='sold').length, rep=all.filter(i=>i.status==='reported').length;
  return `
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
  ${[['판매 중',`${act}건`,'#4F46E5'],['판매 완료',`${sold}건`,'#10B981'],['신고',`${rep}건`,'#EF4444']].map(([l,v,c])=>`<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800;color:${c}">${v}</div><div style="font-size:10px;color:#94A3B8">${l}</div></div>`).join('')}
</div>
${!filtered.length?`<div style="text-align:center;padding:40px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">🛒</div><div style="font-size:13px">해당 물품이 없습니다.</div></div>`:filtered.map(item=>{
  const statusMeta={ active:{label:'판매 중',color:'#4F46E5',bg:'#EEF2FF'}, sold:{label:'판매 완료',color:'#10B981',bg:'#ECFDF5'}, removed:{label:'삭제됨',color:'#94A3B8',bg:'#F1F5F9'}, reported:{label:'신고됨',color:'#EF4444',bg:'#FEF2F2'} };
  const meta=statusMeta[item.status]||statusMeta.active;
  return `<div style="background:var(--card-bg);border:1px solid ${item.status==='reported'?'#FCA5A5':'var(--border)'};border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;margin-bottom:6px">
    <div><div style="font-size:13px;font-weight:700">${item.title}</div><div style="font-size:11px;color:#94A3B8">${item.sellerName} · ${item.category} · ${item.postedAt}</div></div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:13px;font-weight:800;color:#4F46E5">${item.price.toLocaleString()}원</span>
    <span style="font-size:10px;color:#94A3B8">상태: ${item.condition}</span>
  </div>
  ${item.status==='reported'?`<div style="display:flex;gap:6px;margin-top:8px"><button class="mka-restore" data-id="${item.id}" style="flex:1;padding:7px;background:#10B981;color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">복원</button><button class="mka-remove" data-id="${item.id}" style="flex:1;padding:7px;background:none;border:1px solid #EF4444;color:#EF4444;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">삭제</button></div>`:''}
  ${item.status==='active'?`<button class="mka-remove" data-id="${item.id}" style="margin-top:8px;width:100%;padding:6px;background:none;border:1px solid #94A3B8;color:#94A3B8;border-radius:8px;font-size:10px;cursor:pointer">관리자 삭제</button>`:''}
</div>`; }).join('')}`;
}

function _bindEvents() {
  _root.querySelectorAll('.mka-restore').forEach(btn=>btn.addEventListener('click',()=>{
    const all=_getAll(); const item=all.find(x=>x.id===btn.dataset.id); if(!item) return;
    item.status='active'; _saveAll(all); showToast('물품이 복원됐습니다.','success')
      addNotification({ type: 'success', title: 'Market (관리자)', body: '물품이 복원됐습니다.' }); _draw();
  }));
  _root.querySelectorAll('.mka-remove').forEach(btn=>btn.addEventListener('click',()=>{
    if (!confirm('물품을 삭제하시겠습니까?')) return;
    const all=_getAll(); const item=all.find(x=>x.id===btn.dataset.id); if(!item) return;
    item.status='removed'; _saveAll(all); showToast('물품이 삭제됐습니다.','info'); _draw();
  }));
}
export function mount(root) { return render(root); }
