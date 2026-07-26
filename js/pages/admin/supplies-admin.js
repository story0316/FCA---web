/**
 * supplies-admin.js — 비품·소모품 재고 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification, addNotificationForUser } from '../../components/notification-hub.js';

const LS_ITEMS = 'hr_supply_items';
const LS_REQS  = 'hr_supply_requests';

const DEMO_ITEMS = [
  { id:'SUP001', name:'A4 복사지 (500매)',  category:'사무용품', unit:'박스', stock:20, icon:'📄', maxQty:5,  reorderAt:5  },
  { id:'SUP002', name:'볼펜 (10개입)',       category:'사무용품', unit:'팩',  stock:15, icon:'✏️', maxQty:3,  reorderAt:5  },
  { id:'SUP003', name:'형광펜 세트',         category:'사무용품', unit:'세트', stock:8, icon:'🖊️', maxQty:2,  reorderAt:3  },
  { id:'SUP004', name:'노트 A5',            category:'사무용품', unit:'권',  stock:30, icon:'📒', maxQty:5,  reorderAt:10 },
  { id:'SUP005', name:'포스트잇 (3색)',      category:'사무용품', unit:'팩',  stock:12, icon:'🗒️', maxQty:3,  reorderAt:5  },
  { id:'SUP006', name:'USB 8GB',           category:'전자기기', unit:'개',  stock:5,  icon:'💾', maxQty:2,  reorderAt:3  },
  { id:'SUP007', name:'마우스 패드',         category:'전자기기', unit:'개',  stock:7,  icon:'🖱️', maxQty:1,  reorderAt:3  },
  { id:'SUP008', name:'핸드 크림',          category:'생활용품', unit:'개',  stock:10, icon:'🧴', maxQty:2,  reorderAt:3  },
  { id:'SUP009', name:'마스크 (50매)',       category:'생활용품', unit:'박스', stock:6, icon:'😷', maxQty:2,  reorderAt:3  },
  { id:'SUP010', name:'클리어파일 (10매)',   category:'사무용품', unit:'개',  stock:20, icon:'📁', maxQty:5,  reorderAt:5  },
  { id:'SUP011', name:'화이트보드 마커(4색)', category:'사무용품', unit:'세트', stock:4, icon:'🖊️', maxQty:2, reorderAt:3  },
  { id:'SUP012', name:'티슈 (3팩)',          category:'생활용품', unit:'묶음', stock:15,icon:'🧻', maxQty:3,  reorderAt:5  },
];

const LEGACY_REQ_IDS = new Set(['SR_001','SR_002','SR_003','SR_004','SR_005']);

const STATUS_META = {
  pending:   { label:'대기',    color:'#F59E0B' },
  approved:  { label:'승인',   color:'#3B82F6' },
  delivered: { label:'지급 완료', color:'#10B981' },
  rejected:  { label:'반려',   color:'#EF4444' },
};

function _getItems() {
  const s = localStorage.getItem(LS_ITEMS);
  if (!s) { localStorage.setItem(LS_ITEMS, JSON.stringify(DEMO_ITEMS)); return DEMO_ITEMS; }
  try { return JSON.parse(s); } catch { return DEMO_ITEMS; }
}
function _saveItems(l) { localStorage.setItem(LS_ITEMS, JSON.stringify(l)); }
function _getReqs() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_REQS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_REQ_IDS.has(r.id));
    if (cleaned.length !== list.length) _saveReqs(cleaned);
    return cleaned;
  } catch { return []; }
}
function _saveReqs(l) { localStorage.setItem(LS_REQS, JSON.stringify(l)); }

let _tab  = 'stock';
let _root = null;

export function render(root) { _root = root; _tab = 'stock'; _draw(); }
export function unmount()    { _root = null; _tab = 'stock'; }

function _draw() {
  const reqs    = _getReqs();
  const pending = reqs.filter(r=>r.status==='pending').length;

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['stock','재고 현황'],['requests',`신청 처리${pending?` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending}</span>`:''}`],['history','지급 내역']].map(([k,l])=>`
    <button class="sa-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='stock'    ? _renderStock()
    : _tab==='requests' ? _renderRequests(reqs.filter(r=>r.status!=='delivered'&&r.status!=='rejected'))
    :                     _renderHistory(reqs)}
  </div>
</div>`;

  _root.querySelectorAll('.sa-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

// ── 재고 현황 ───────────────────────────────────────────────────
function _renderStock() {
  const items   = _getItems();
  const lowItems = items.filter(i=>i.stock<=i.reorderAt);

  return `
<!-- 경보 -->
${lowItems.length ? `
<div style="background:#FEF3C7;border:1px solid #FCD34D;border-radius:12px;padding:12px;margin-bottom:12px">
  <div style="font-size:12px;font-weight:700;color:#D97706;margin-bottom:4px">⚠️ 재주문 필요 ${lowItems.length}종</div>
  <div style="font-size:11px;color:#92400E">${lowItems.map(i=>`${i.icon} ${i.name} (${i.stock}${i.unit})`).join(' · ')}</div>
</div>` : ''}

<!-- KPI -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
  ${[
    ['총 품목', `${items.length}종`, '#4F46E5'],
    ['재고 부족', `${lowItems.length}종`, '#EF4444'],
    ['정상 재고', `${items.length-lowItems.length}종`, '#10B981'],
  ].map(([l,v,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:18px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8;margin-top:1px">${l}</div>
  </div>`).join('')}
</div>

<!-- 품목 재고 목록 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700">품목별 재고</div>
  ${items.map(item=>{
    const low = item.stock<=item.reorderAt;
    return `
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
    <span style="font-size:18px;flex-shrink:0">${item.icon}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:12px;font-weight:600">${item.name}</div>
      <div style="font-size:10px;color:#94A3B8">${item.category}</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
      <button class="sa-restock" data-id="${item.id}"
        style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;
               font-size:10px;cursor:pointer;background:var(--bg);color:var(--text)">입고</button>
      <span style="font-size:12px;font-weight:700;color:${low?'#EF4444':'#10B981'};min-width:40px;text-align:right">
        ${item.stock} ${item.unit}
      </span>
    </div>
  </div>`;}).join('')}
</div>`;
}

// ── 신청 처리 ───────────────────────────────────────────────────
function _renderRequests(list) {
  const sorted = [...list].sort((a,b)=>b.reqDate.localeCompare(a.reqDate));
  if (!sorted.length) return `<div style="text-align:center;padding:40px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">✅</div><div style="font-size:13px">처리할 신청이 없습니다.</div></div>`;

  return sorted.map(r=>{
    const meta = STATUS_META[r.status];
    return `
<div style="background:var(--card-bg);border:1px solid ${r.status==='pending'?'#FCD34D':'var(--border)'};
     border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div>
      <div style="font-size:13px;font-weight:700">${r.empName}</div>
      <div style="font-size:11px;color:#94A3B8">${r.reqDate}</div>
    </div>
    <span style="font-size:11px;font-weight:700;color:${meta.color}">${meta.label}</span>
  </div>
  ${r.items.map(it=>`
  <div style="font-size:12px;padding:3px 0;color:#64748B">${it.icon} ${it.name} × ${it.qty}${it.unit}</div>`).join('')}
  ${r.status==='pending' ? `
  <div style="display:flex;gap:6px;margin-top:10px">
    <button class="sa-deliver" data-id="${r.id}"
      style="flex:1;padding:8px;background:#10B981;color:#fff;border:none;border-radius:8px;
             font-size:12px;font-weight:700;cursor:pointer">지급 처리</button>
    <button class="sa-approve" data-id="${r.id}"
      style="flex:1;padding:8px;background:#3B82F6;color:#fff;border:none;border-radius:8px;
             font-size:12px;font-weight:700;cursor:pointer">승인</button>
    <button class="sa-reject" data-id="${r.id}"
      style="flex:1;padding:8px;background:none;border:1px solid #EF4444;color:#EF4444;border-radius:8px;
             font-size:12px;font-weight:700;cursor:pointer">반려</button>
  </div>` : r.status==='approved' ? `
  <div style="margin-top:8px">
    <button class="sa-deliver" data-id="${r.id}"
      style="width:100%;padding:8px;background:#10B981;color:#fff;border:none;border-radius:8px;
             font-size:12px;font-weight:700;cursor:pointer">지급 완료 처리</button>
  </div>` : ''}
</div>`;}).join('');
}

// ── 지급 내역 ───────────────────────────────────────────────────
function _renderHistory(reqs) {
  const sorted = [...reqs].sort((a,b)=>b.reqDate.localeCompare(a.reqDate));
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  ${sorted.map(r=>{
    const meta = STATUS_META[r.status];
    return `
  <div style="padding:12px 14px;border-bottom:1px solid var(--border)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <span style="font-size:13px;font-weight:600">${r.empName}</span>
      <span style="font-size:11px;font-weight:700;color:${meta.color}">${meta.label}</span>
    </div>
    <div style="font-size:11px;color:#94A3B8">${r.reqDate} · ${r.items.map(it=>`${it.icon}${it.qty}${it.unit}`).join(' ')}</div>
  </div>`;}).join('')}
</div>`;
}

function _bindEvents() {
  // 재고 입고
  _root.querySelectorAll('.sa-restock').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const qty = parseInt(prompt('입고 수량을 입력하세요:', '10'))||0;
      if (qty<=0) return;
      const items = _getItems();
      const idx   = items.findIndex(i=>i.id===btn.dataset.id);
      if (idx<0) return;
      items[idx].stock += qty;
      _saveItems(items);
      showToast(`입고 완료: +${qty} ${items[idx].unit}`, 'success')
      addNotification({ type: 'success', title: 'Supplies (관리자)', body: '입고 완료: +' });
      _draw();
    });
  });

  // 승인
  _root.querySelectorAll('.sa-approve').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const reqs = _getReqs(); const r = reqs.find(x=>x.id===btn.dataset.id); if(!r) return;
      r.status='approved'; _saveReqs(reqs);
      showToast(`${r.empName} 신청 승인됐습니다.`, 'success');
      addNotification({ type: 'success', title: '비품 신청 승인 (관리자)', body: '신청 승인됐습니다.' });
      if (r.empId) addNotificationForUser(r.empId, { type: 'success', title: '비품 신청 승인', body: '비품 신청이 승인되었습니다.', route: '#/market' });
      _draw();
    });
  });

  // 지급 완료
  _root.querySelectorAll('.sa-deliver').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const reqs  = _getReqs(); const r = reqs.find(x=>x.id===btn.dataset.id); if(!r) return;
      r.status='delivered'; _saveReqs(reqs);
      // 재고 차감
      const items = _getItems();
      r.items.forEach(ri=>{
        const idx = items.findIndex(i=>i.id===ri.id);
        if(idx>=0) items[idx].stock = Math.max(0, items[idx].stock - ri.qty);
      });
      _saveItems(items);
      showToast(`${r.empName} 지급 완료 처리됐습니다.`, 'success')
      addNotification({ type: 'success', title: 'Supplies (관리자)', body: '지급 완료 처리됐습니다.' }); _draw();
    });
  });

  // 반려
  _root.querySelectorAll('.sa-reject').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const reqs = _getReqs(); const r = reqs.find(x=>x.id===btn.dataset.id); if(!r) return;
      r.status='rejected'; _saveReqs(reqs);
      showToast(`${r.empName} 신청이 반려됐습니다.`, 'info');
      if (r.empId) addNotificationForUser(r.empId, { type: 'error', title: '비품 신청 반려', body: '비품 신청이 반려되었습니다.', route: '#/market' });
      _draw();
    });
  });
}
export function mount(root) { return render(root); }
