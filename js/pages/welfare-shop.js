/**
 * welfare-shop.js — 복지 포인트 샵 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS_ITEMS  = 'hr_welfare_items';
const LS_ORDERS = 'hr_welfare_orders';
const LS_POINTS = 'hr_welfare_points_balance';

const DEMO_ITEMS = [
  { id:'WI001', name:'편의점 상품권 1만원', category:'상품권', points:10000, stock:50, icon:'🎫', desc:'CU·GS25·세븐일레븐 사용 가능' },
  { id:'WI002', name:'문화상품권 5만원', category:'상품권', points:50000, stock:30, icon:'🎭', desc:'영화·공연·도서 전용 문화상품권' },
  { id:'WI003', name:'요가/헬스 1개월 이용권', category:'건강', points:80000, stock:20, icon:'💪', desc:'제휴 헬스클럽 1개월 자유 이용' },
  { id:'WI004', name:'스타벅스 아메리카노 10잔', category:'식음료', points:55000, stock:100, icon:'☕', desc:'스타벅스 Tall 사이즈 음료 10잔' },
  { id:'WI005', name:'에어팟 케이스 크레딧', category:'가전', points:150000, stock:10, icon:'🎧', desc:'Apple 공인 쇼핑몰 크레딧' },
  { id:'WI006', name:'여행 숙박권 제주도 1박', category:'여행', points:200000, stock:5, icon:'✈️', desc:'제휴 호텔 1박 숙박 바우처' },
];

function _empId() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; } catch { return '직원'; } }

function _getItems() {
  const s = localStorage.getItem(LS_ITEMS);
  if (!s) { localStorage.setItem(LS_ITEMS, JSON.stringify(DEMO_ITEMS)); return DEMO_ITEMS; }
  try {
    const d = JSON.parse(s);
    return [...DEMO_ITEMS.filter(di=>!d.find(i=>i.id===di.id)), ...d];
  } catch { return DEMO_ITEMS; }
}
function _saveItems(l) { localStorage.setItem(LS_ITEMS, JSON.stringify(l)); }
function _getOrders() { try { return JSON.parse(localStorage.getItem(LS_ORDERS)||'[]'); } catch { return []; } }
function _saveOrders(l) { localStorage.setItem(LS_ORDERS, JSON.stringify(l)); }
function _getBalance() {
  const b = localStorage.getItem(LS_POINTS+'_'+_empId());
  return b ? parseInt(b) : 300000;
}
function _setBalance(v) { localStorage.setItem(LS_POINTS+'_'+_empId(), String(v)); }

const CATEGORIES = ['전체', '상품권', '건강', '식음료', '가전', '여행'];

let _tab    = 'shop';
let _selCat = '전체';
let _root   = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _root=root; _tab='shop'; _selCat='전체'; _render(); }
export function unmount() { _tab = 'shop'; _root=null; }

function _render() {
  const items   = _getItems();
  const orders  = _getOrders();
  const myOrders= orders.filter(o=>o.empId===_empId());
  const balance = _getBalance();

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="ws-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🛒 복지 포인트 샵</div>
      <div style="font-size:11px;color:var(--text-muted)">주문 ${myOrders.length}건</div>
    </div>
    <div style="background:#4F46E5;color:#fff;border-radius:10px;padding:4px 12px;font-size:12px;font-weight:700">
      ${balance.toLocaleString()}P
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['shop','상품 목록'],['orders','내 주문']].map(([k,l])=>`
    <button class="ws-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='shop' ? _renderShop(items, balance) : _renderOrders(myOrders, items)}
  </div>
</div>`;

  _root.querySelector('#ws-back').addEventListener('click', ()=>window.navBack());
  _root.querySelectorAll('.ws-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(); }));
  _bindShop();
}

function _renderShop(items, balance) {
  const filtered = _selCat==='전체' ? items : items.filter(i=>i.category===_selCat);

  return `
<div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border-radius:14px;padding:16px;margin-bottom:14px;color:#fff">
  <div style="font-size:11px;opacity:0.8;margin-bottom:4px">사용 가능 포인트</div>
  <div style="font-size:28px;font-weight:800">${balance.toLocaleString()}P</div>
  <div style="font-size:10px;opacity:0.7;margin-top:4px">매월 1일 포인트 지급 | 당월 미사용 포인트는 이월됩니다</div>
</div>

<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;margin-bottom:12px">
  ${CATEGORIES.map(c=>`
  <button class="ws-cat" data-cat="${c}"
    style="padding:6px 12px;border-radius:99px;border:none;cursor:pointer;white-space:nowrap;
           font-size:12px;font-weight:600;
           background:${_selCat===c?'#4F46E5':'var(--bg)'};
           color:${_selCat===c?'#fff':'var(--text-muted)'};
           border:1px solid ${_selCat===c?'#4F46E5':'var(--border)'}">${c}</button>`).join('')}
</div>

${filtered.map(item=>{
  const canBuy = balance >= item.points && item.stock > 0;
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:8px">
    <div style="width:48px;height:48px;border-radius:12px;background:#EEF2FF;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">${item.icon}</div>
    <div style="flex:1">
      <div style="font-size:13px;font-weight:700;margin-bottom:2px">${item.name}</div>
      <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">${item.desc}</div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:14px;font-weight:800;color:#4F46E5">${item.points.toLocaleString()}P</span>
        <span style="font-size:10px;color:var(--text-muted)">재고 ${item.stock}개</span>
      </div>
    </div>
  </div>
  <button class="ws-buy" data-id="${item.id}" data-name="${item.name}" data-points="${item.points}"
    ${!canBuy?'disabled':''}
    style="width:100%;padding:9px;border:none;border-radius:8px;font-size:12px;font-weight:700;
           cursor:${canBuy?'pointer':'not-allowed'};
           background:${item.stock===0?'#F1F5F9':canBuy?'#4F46E5':'#FEF3C7'};
           color:${item.stock===0?'var(--text-muted)':canBuy?'#fff':'#92400E'}">
    ${item.stock===0?'품절':canBuy?'구매하기':'포인트 부족'}
  </button>
</div>`; }).join('')}`;
}

function _renderOrders(myOrders, items) {
  if (!myOrders.length) return `
<div style="text-align:center;padding:48px 16px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">🛒</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:4px">주문 내역이 없습니다</div>
      <button onclick="location.hash='#/welfare-shop'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">복지몰 가기</button>
    
  <div style="font-size:12px">복지 포인트로 상품을 구매해 보세요!</div>
</div>`;

  return [...myOrders].sort((a,b)=>b.orderedAt.localeCompare(a.orderedAt)).map(o=>{
    const item = items.find(i=>i.id===o.itemId);
    const STATUS = { processing:'처리 중', shipped:'발송 완료', done:'수령 완료' };
    const COLOR  = { processing:'#F59E0B', shipped:'#3B82F6', done:'#10B981' };
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div style="display:flex;gap:10px;align-items:center">
      <span style="font-size:20px">${item?item.icon:'📦'}</span>
      <div>
        <div style="font-size:12px;font-weight:700">${o.itemName}</div>
        <div style="font-size:10px;color:var(--text-muted)">${o.orderedAt} · ${o.points.toLocaleString()}P</div>
      </div>
    </div>
    <span style="font-size:11px;font-weight:700;color:${COLOR[o.status]||'var(--text-muted)'}">${STATUS[o.status]||o.status}</span>
  </div>
</div>`; }).join('');
}

function _bindShop() {
  _root.querySelectorAll('.ws-cat').forEach(b=>b.addEventListener('click',()=>{ _selCat=b.dataset.cat; _render(); }));

  _root.querySelectorAll('.ws-buy').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if (btn.disabled) return;
      const points = parseInt(btn.dataset.points);
      const bal    = _getBalance();
      if (bal < points) { showToast('포인트가 부족합니다.', 'error'); return; }
      const items = _getItems();
      const item  = items.find(i=>i.id===btn.dataset.id);
      if (!item || item.stock <= 0) { showToast('품절된 상품입니다.', 'error'); return; }
      item.stock--;
      _saveItems(items);
      _setBalance(bal - points);
      const orders = _getOrders();
      orders.push({ id:'WO_'+Date.now(), empId:_empId(), empName:_empName(), itemId:item.id, itemName:item.name, points, status:'processing', orderedAt:new Date().toISOString().slice(0,10) });
      _saveOrders(orders);
      showToast(`"${btn.dataset.name}" 구매가 완료됐습니다!`, 'success')
    addNotification({ type: 'success', title: '복지몰', body: '"" 구매가 완료됐습니다!' });
      _render();
    });
  });
}
