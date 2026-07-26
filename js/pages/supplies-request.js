/**
 * supplies-request.js — 소모품·비품 신청 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS_ITEMS = 'hr_supply_items';
const LS_REQS  = 'hr_supply_requests';

const DEMO_ITEMS = [
  { id:'SUP001', name:'A4 복사지 (500매)',  category:'사무용품', unit:'박스', stock:20, icon:'📄', maxQty:5  },
  { id:'SUP002', name:'볼펜 (10개입)',       category:'사무용품', unit:'팩',  stock:15, icon:'✏️', maxQty:3  },
  { id:'SUP003', name:'형광펜 세트',         category:'사무용품', unit:'세트', stock:8,  icon:'🖊️', maxQty:2  },
  { id:'SUP004', name:'노트 A5',            category:'사무용품', unit:'권',  stock:30, icon:'📒', maxQty:5  },
  { id:'SUP005', name:'포스트잇 (3색)',      category:'사무용품', unit:'팩',  stock:12, icon:'🗒️', maxQty:3  },
  { id:'SUP006', name:'USB 8GB',           category:'전자기기', unit:'개',  stock:5,  icon:'💾', maxQty:2  },
  { id:'SUP007', name:'마우스 패드',         category:'전자기기', unit:'개',  stock:7,  icon:'🖱️', maxQty:1  },
  { id:'SUP008', name:'핸드 크림',          category:'생활용품', unit:'개',  stock:10, icon:'🧴', maxQty:2  },
  { id:'SUP009', name:'마스크 (50매)',       category:'생활용품', unit:'박스', stock:6,  icon:'😷', maxQty:2  },
  { id:'SUP010', name:'클리어파일 (10매)',   category:'사무용품', unit:'개',  stock:20, icon:'📁', maxQty:5  },
  { id:'SUP011', name:'화이트보드 마커 (4색)', category:'사무용품', unit:'세트', stock:4, icon:'🖊️', maxQty:2 },
  { id:'SUP012', name:'티슈 (3팩)',          category:'생활용품', unit:'묶음', stock:15, icon:'🧻', maxQty:3  },
];

const CATEGORIES = ['전체', '사무용품', '전자기기', '생활용품'];

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }

function _getItems() {
  const s = localStorage.getItem(LS_ITEMS);
  if (!s) { localStorage.setItem(LS_ITEMS, JSON.stringify(DEMO_ITEMS)); return DEMO_ITEMS; }
  try { return JSON.parse(s); } catch { return DEMO_ITEMS; }
}
function _getReqs() { try { return JSON.parse(localStorage.getItem(LS_REQS)||'[]'); } catch { return []; } }
function _saveReqs(l) { localStorage.setItem(LS_REQS, JSON.stringify(l)); }

const STATUS_META = {
  pending:   { label:'검토 중', color:'#F59E0B', bg:'#FEF3C7' },
  approved:  { label:'승인',   color:'#3B82F6', bg:'#EFF6FF' },
  delivered: { label:'지급 완료', color:'#10B981', bg:'#ECFDF5' },
  rejected:  { label:'반려',   color:'#EF4444', bg:'#FEE2E2' },
};

let _tab   = 'request';
let _cat   = '전체';
let _cart  = {}; // itemId → qty
let _root  = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _root = root; _tab='request'; _cat='전체'; _cart={}; _render(); }
export function unmount() { _root = null; _tab='request'; _cart={}; }

function _cartTotal() { return Object.values(_cart).reduce((s,v)=>s+v,0); }

function _render() {
  if (!_root) return;
  const myReqs = _getReqs().filter(r=>r.empId===_empId());
  const cartN  = _cartTotal();

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="sr-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">📦 소모품·비품 신청</div>
      <div style="font-size:11px;color:var(--text-muted)">신청 ${myReqs.length}건 · 지급 완료 ${myReqs.filter(r=>r.status==='delivered').length}건</div>
    </div>
    ${cartN ? `<div style="background:#EF4444;color:#fff;border-radius:99px;padding:3px 10px;font-size:12px;font-weight:700">장바구니 ${cartN}</div>` : ''}
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['request','신청하기'],['mine','내 신청'],['catalog','품목 안내']].map(([k,l])=>`
    <button class="sr-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='request' ? _renderRequest()
    : _tab==='mine'    ? _renderMine(myReqs)
    :                    _renderCatalog()}
  </div>
</div>`;

  _root.querySelector('#sr-back').addEventListener('click', ()=>window.navBack());
  _root.querySelectorAll('.sr-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(); }));
  if (_tab==='request') _bindRequest();
}

function _renderRequest() {
  const items = _getItems();
  const filtered = _cat==='전체' ? items : items.filter(i=>i.category===_cat);

  return `
<!-- 카테고리 필터 -->
<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;margin-bottom:12px">
  ${CATEGORIES.map(c=>`
  <button class="sr-cat" data-cat="${c}"
    style="padding:6px 12px;border-radius:99px;border:none;cursor:pointer;white-space:nowrap;
           font-size:12px;font-weight:600;
           background:${_cat===c?'#4F46E5':'var(--bg)'};
           color:${_cat===c?'#fff':'var(--text-muted)'};
           border:1px solid ${_cat===c?'#4F46E5':'var(--border)'}">${c}</button>`).join('')}
</div>

<!-- 품목 목록 -->
${filtered.map(item=>{
  const qty = _cart[item.id]||0;
  const low = item.stock<=3;
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
     padding:12px;margin-bottom:8px;display:flex;align-items:center;gap:10px">
  <div style="font-size:28px;flex-shrink:0">${item.icon}</div>
  <div style="flex:1;min-width:0">
    <div style="font-size:13px;font-weight:600;color:var(--text)">${item.name}</div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:1px">
      ${item.category} · 단위: ${item.unit}
      ${low ? `<span style="color:#EF4444;font-weight:700;margin-left:4px">재고 부족(${item.stock})</span>` : `<span style="color:#10B981">재고 ${item.stock}</span>`}
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
    <button class="sr-minus" data-id="${item.id}"
      style="width:28px;height:28px;border-radius:50%;border:1px solid var(--border);
             background:var(--bg);cursor:pointer;font-size:16px;line-height:1">−</button>
    <span style="width:20px;text-align:center;font-size:13px;font-weight:700">${qty}</span>
    <button class="sr-plus" data-id="${item.id}" data-max="${item.maxQty}" data-stock="${item.stock}"
      style="width:28px;height:28px;border-radius:50%;border:none;
             background:${qty>0?'#4F46E5':'var(--border)'};cursor:pointer;font-size:16px;line-height:1;
             color:${qty>0?'#fff':'var(--text)'}">+</button>
  </div>
</div>`;}).join('')}

<!-- 신청 버튼 -->
${_cartTotal()>0 ? `
<div style="position:sticky;bottom:0;padding:12px 0 0;background:var(--bg)">
  <button id="sr-submit"
    style="width:100%;padding:13px;background:#4F46E5;color:#fff;border:none;border-radius:12px;
           font-size:14px;font-weight:700;cursor:pointer">
    선택 품목 신청하기 (${_cartTotal()}종)
  </button>
</div>` : ''}`;
}

function _renderMine(reqs) {
  const sorted = [...reqs].sort((a,b)=>b.reqDate.localeCompare(a.reqDate));
  if (!sorted.length) return `
<div style="text-align:center;padding:48px 16px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">📦</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:4px">신청 내역이 없습니다</div>
      <button onclick="location.hash='#/supplies'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">소모품 신청</button>
    
  <div style="font-size:12px">필요한 소모품을 신청해 보세요!</div>
</div>`;

  return sorted.map(r=>{
    const meta = STATUS_META[r.status]||STATUS_META.pending;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="font-size:13px;font-weight:700">신청 #${r.id.slice(-4)}</div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;
                 background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>
  <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">${r.reqDate}</div>
  ${r.items.map(it=>`
  <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;
       border-bottom:1px solid var(--border)">
    <span>${it.icon} ${it.name}</span>
    <span style="font-weight:700">${it.qty}${it.unit}</span>
  </div>`).join('')}
</div>`;}).join('');
}

function _renderCatalog() {
  const items = _getItems();
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700">
    품목 현황 (${items.length}종)
  </div>
  ${items.map(item=>{
    const low = item.stock<=3;
    return `
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
    <span style="font-size:18px">${item.icon}</span>
    <div style="flex:1">
      <div style="font-size:12px;font-weight:600">${item.name}</div>
      <div style="font-size:10px;color:var(--text-muted)">${item.category} · 최대 ${item.maxQty}${item.unit}/회</div>
    </div>
    <span style="font-size:11px;font-weight:700;color:${low?'#EF4444':'#10B981'}">${item.stock}${item.unit}</span>
  </div>`;}).join('')}
</div>`;
}

function _bindRequest() {
  _root.querySelectorAll('.sr-cat').forEach(b=>b.addEventListener('click',()=>{ _cat=b.dataset.cat; _render(); }));

  _root.querySelectorAll('.sr-plus').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const id    = btn.dataset.id;
      const max   = parseInt(btn.dataset.max)||1;
      const stock = parseInt(btn.dataset.stock)||0;
      const cur   = _cart[id]||0;
      if (cur >= max)   { showToast(`최대 ${max}개까지 신청 가능합니다.`, 'error'); return; }
      if (cur >= stock) { showToast('재고가 부족합니다.', 'error'); return; }
      _cart[id] = cur + 1;
      _render();
    });
  });

  _root.querySelectorAll('.sr-minus').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const id  = btn.dataset.id;
      const cur = _cart[id]||0;
      if (cur <= 0) return;
      if (cur === 1) delete _cart[id]; else _cart[id] = cur - 1;
      _render();
    });
  });

  _root.querySelector('#sr-submit')?.addEventListener('click',()=>{
    const items = _getItems();
    const reqItems = Object.entries(_cart).map(([id,qty])=>{
      const item = items.find(i=>i.id===id);
      return { id, name: item?.name||id, icon: item?.icon||'📦', qty, unit: item?.unit||'개' };
    });
    if (!reqItems.length) return;

    const reqs = _getReqs();
    reqs.push({
      id:      'SR_'+Date.now(),
      empId:   _empId(),
      empName: _empName(),
      items:   reqItems,
      status:  'pending',
      reqDate: new Date().toISOString().slice(0,10),
    });
    _saveReqs(reqs);
    _cart = {};
    showToast('신청이 완료됐습니다. 검토 후 지급됩니다.', 'success')
    addNotification({ type: 'success', title: '소모품 신청', body: '신청이 완료됐습니다. 검토 후 지급됩니다.' });
    _tab = 'mine';
    _render();
  });
}
