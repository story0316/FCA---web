/**
 * welfare-shop-admin.js — 복지 포인트 샵 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS_ITEMS  = 'hr_welfare_items';
const LS_ORDERS = 'hr_welfare_orders';

const DEMO_ITEMS = [
  { id:'WI001', name:'편의점 상품권 1만원', category:'상품권', points:10000, stock:50, icon:'🎫', desc:'CU·GS25·세븐일레븐 사용 가능' },
  { id:'WI002', name:'문화상품권 5만원', category:'상품권', points:50000, stock:30, icon:'🎭', desc:'영화·공연·도서 전용 문화상품권' },
  { id:'WI003', name:'요가/헬스 1개월 이용권', category:'건강', points:80000, stock:20, icon:'💪', desc:'제휴 헬스클럽 1개월 자유 이용' },
  { id:'WI004', name:'스타벅스 아메리카노 10잔', category:'식음료', points:55000, stock:100, icon:'☕', desc:'스타벅스 Tall 사이즈 음료 10잔' },
  { id:'WI005', name:'에어팟 케이스 크레딧', category:'가전', points:150000, stock:10, icon:'🎧', desc:'Apple 공인 쇼핑몰 크레딧' },
  { id:'WI006', name:'여행 숙박권 제주도 1박', category:'여행', points:200000, stock:5, icon:'✈️', desc:'제휴 호텔 1박 숙박 바우처' },
];

const LEGACY_ORDER_IDS = new Set(['WO001','WO002','WO003','WO004']);

const STATUS_META = {
  processing: { label:'처리 중', color:'#F59E0B', bg:'#FEF3C7' },
  shipped:    { label:'발송 완료', color:'#3B82F6', bg:'#EFF6FF' },
  done:       { label:'수령 완료', color:'#10B981', bg:'#ECFDF5' },
};

function _getItems() {
  const s = localStorage.getItem(LS_ITEMS);
  if (!s) { localStorage.setItem(LS_ITEMS, JSON.stringify(DEMO_ITEMS)); return DEMO_ITEMS; }
  try {
    const d = JSON.parse(s);
    return [...DEMO_ITEMS.filter(di=>!d.find(i=>i.id===di.id)), ...d];
  } catch { return DEMO_ITEMS; }
}
function _saveItems(l) { localStorage.setItem(LS_ITEMS, JSON.stringify(l)); }
function _getOrders() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_ORDERS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_ORDER_IDS.has(r.id));
    if (cleaned.length !== list.length) _saveOrders(cleaned);
    return cleaned;
  } catch { return []; }
}
function _saveOrders(l) { localStorage.setItem(LS_ORDERS, JSON.stringify(l)); }

const CATEGORIES = ['상품권', '건강', '식음료', '가전', '여행', '기타'];

let _tab  = 'orders';
let _root = null;

export function render(root) { _root=root; _tab='orders'; _draw(); }
export function unmount() { _root=null;
  _tab = 'orders';
}

function _draw() {
  const items  = _getItems();
  const orders = _getOrders();
  const pending = orders.filter(o=>o.status==='processing').length;

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['orders',`주문 현황${pending?` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending}</span>`:''}`],['items','상품 관리']].map(([k,l])=>`
    <button class="wsa-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='orders' ? _renderOrders(orders, items) : _renderItems(items)}
  </div>
</div>`;

  _root.querySelectorAll('.wsa-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderOrders(orders, items) {
  const proc = orders.filter(o=>o.status==='processing').length;
  const ship  = orders.filter(o=>o.status==='shipped').length;
  const done  = orders.filter(o=>o.status==='done').length;

  const kpi = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
  ${[['총 주문',orders.length+'건','#4F46E5'],['처리 중',proc+'건','#F59E0B'],['발송',ship+'건','#3B82F6'],['완료',done+'건','#10B981']].map(([l,v,c])=>`<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800;color:${c}">${v}</div><div style="font-size:10px;color:#94A3B8">${l}</div></div>`).join('')}
</div>`;

  if (!orders.length) return kpi + '<div style="text-align:center;padding:48px 20px;color:#94A3B8"><div style="font-size:40px;margin-bottom:10px">🛍️</div><div style="font-size:14px;font-weight:600;margin-bottom:4px">주문이 없습니다</div><div style="font-size:12px">직원이 복지몰에서 주문하면 여기에 표시됩니다.</div></div>';

  return kpi + [...orders].sort((a,b)=>b.orderedAt.localeCompare(a.orderedAt)).map(o=>{
    const meta = STATUS_META[o.status]||{ label:o.status, color:'#94A3B8', bg:'#F1F5F9' };
    const bc = o.status==='processing' ? '#FCD34D' : 'var(--border)';
    return `<div style="background:var(--card-bg);border:1px solid ${bc};border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div>
      <div style="font-size:13px;font-weight:700">${o.empName} · ${o.itemName}</div>
      <div style="font-size:11px;color:#94A3B8">${o.orderedAt} · ${o.points.toLocaleString()}P</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;background:${meta.bg};color:${meta.color};white-space:nowrap">${meta.label}</span>
  </div>
  ${o.status==='processing' ? '<div style="display:flex;gap:6px"><button class="wsa-ship" data-id="'+o.id+'" style="flex:1;padding:8px;background:#3B82F6;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">발송 처리</button></div>' : ''}
  ${o.status==='shipped' ? '<button class="wsa-done" data-id="'+o.id+'" style="width:100%;padding:8px;background:#10B981;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">수령 확인</button>' : ''}
</div>`;
  }).join('');
}

function _renderItems(items) {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:14px">
  ${items.map(item=>`
  <div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px">
    <span style="font-size:20px;flex-shrink:0">${item.icon}</span>
    <div style="flex:1">
      <div style="font-size:12px;font-weight:700">${item.name}</div>
      <div style="font-size:10px;color:#94A3B8">${item.points.toLocaleString()}P · 재고 ${item.stock}개</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
      <button class="wsa-stock-up" data-id="${item.id}"
        style="padding:3px 8px;font-size:10px;background:#EEF2FF;color:#4F46E5;border:none;border-radius:6px;cursor:pointer">재고+10</button>
      <button class="wsa-stock-down" data-id="${item.id}" ${item.stock<10?'disabled':''}
        style="padding:3px 8px;font-size:10px;background:${item.stock<10?'#F1F5F9':'#FEF3C7'};color:${item.stock<10?'#94A3B8':'#92400E'};border:none;border-radius:6px;cursor:${item.stock<10?'not-allowed':'pointer'}">재고-10</button>
    </div>
  </div>`).join('')}
</div>`;
}

function _bindEvents() {
  _root.querySelectorAll('.wsa-ship').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const orders=_getOrders(); const o=orders.find(x=>x.id===btn.dataset.id); if(!o) return;
      o.status='shipped'; _saveOrders(orders);
      showToast('발송 처리됐습니다.', 'success')
      addNotification({ type: 'success', title: 'Welfare Shop (관리자)', body: '발송 처리됐습니다.' }); _draw();
    });
  });

  _root.querySelectorAll('.wsa-done').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const orders=_getOrders(); const o=orders.find(x=>x.id===btn.dataset.id); if(!o) return;
      o.status='done'; _saveOrders(orders);
      showToast('수령 완료 처리됐습니다.', 'success')
      addNotification({ type: 'success', title: 'Welfare Shop (관리자)', body: '수령 완료 처리됐습니다.' }); _draw();
    });
  });

  _root.querySelectorAll('.wsa-stock-up').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const items=_getItems(); const item=items.find(x=>x.id===btn.dataset.id); if(!item) return;
      item.stock+=10; _saveItems(items);
      showToast('재고가 추가됐습니다.', 'success')
      addNotification({ type: 'success', title: 'Welfare Shop (관리자)', body: '재고가 추가됐습니다.' }); _draw();
    });
  });

  _root.querySelectorAll('.wsa-stock-down').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if (btn.disabled) return;
      const items=_getItems(); const item=items.find(x=>x.id===btn.dataset.id); if(!item) return;
      item.stock=Math.max(0,item.stock-10); _saveItems(items);
      showToast('재고가 감소됐습니다.', 'info'); _draw();
    });
  });
}
export function mount(root) { return render(root); }
