/**
 * market.js — 사내 마켓 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_market_items';

const CATEGORIES = ['전체','전자기기','도서','스포츠','패션','생활용품','식품','기타'];
const CONDITIONS  = [{ key:'상', label:'상 (거의 새것)' },{ key:'중', label:'중 (사용감 있음)' },{ key:'하', label:'하 (결함 있음)' }];

const LEGACY_MK_IDS = new Set(['MK001','MK002','MK003','MK004']);

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }
function _getAll() {
  const s = localStorage.getItem(LS);
  if (!s) return [];
  try {
    const d = JSON.parse(s);
    const cleaned = d.filter(i => !LEGACY_MK_IDS.has(i.id));
    if (cleaned.length < d.length) localStorage.setItem(LS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}
function _saveAll(l) { localStorage.setItem(LS, JSON.stringify(l)); }

let _tab    = 'browse';
let _catFlt = '전체';
let _root   = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _root=root; _tab='browse'; _catFlt='전체'; _render(); }
export function unmount() { _tab = 'browse'; _root=null; }

function _render() {
  const all  = _getAll();
  const mine = all.filter(i=>i.sellerId===_empId());

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="mk-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1"><div style="font-size:15px;font-weight:700">🛍️ 사내 마켓</div><div style="font-size:11px;color:var(--text-muted)">판매 중 ${all.filter(i=>i.status==='active').length}건</div></div>
  </div>
  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['browse','전체 물품'],['mine','내 물품'],['sell','판매 등록']].map(([k,l])=>`
    <button class="mk-tab" data-tab="${k}" style="flex:1;padding:10px;font-size:11px;font-weight:600;border:none;cursor:pointer;background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>
  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='sell' ? _renderSell() : _tab==='mine' ? _renderMine(mine) : _renderBrowse(all)}
  </div>
</div>`;

  _root.querySelector('#mk-back').addEventListener('click',()=>window.navBack());
  _root.querySelectorAll('.mk-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(); }));
  _root.querySelectorAll('.mk-cat').forEach(btn=>btn.addEventListener('click',()=>{ _catFlt=btn.dataset.cat; _render(); }));
  _root.querySelectorAll('.mk-contact').forEach(btn=>btn.addEventListener('click',()=>{ showToast(`연락처: ${btn.dataset.contact}`,'info'); }));
  _root.querySelectorAll('.mk-sold').forEach(btn=>btn.addEventListener('click',()=>{
    const all=_getAll(); const item=all.find(x=>x.id===btn.dataset.id); if(!item) return;
    item.status='sold'; _saveAll(all); showToast('판매 완료 처리됐습니다.','success')
    addNotification({ type: 'success', title: '사내 장터', body: '판매 완료 처리됐습니다.' }); _render();
  }));
  _bindSell();
}

function _renderBrowse(all) {
  const filtered = _catFlt==='전체' ? all.filter(i=>i.status==='active') : all.filter(i=>i.status==='active'&&i.category===_catFlt);
  return `
<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:10px;-webkit-overflow-scrolling:touch">
  ${CATEGORIES.map(c=>`<button class="mk-cat" data-cat="${c}" style="flex-shrink:0;padding:4px 10px;border-radius:99px;border:1px solid ${_catFlt===c?'#4F46E5':'var(--border)'};background:${_catFlt===c?'#4F46E5':'var(--card-bg)'};color:${_catFlt===c?'#fff':'var(--text)'};font-size:11px;cursor:pointer">${c}</button>`).join('')}
</div>
${!filtered.length?`<div style="text-align:center;padding:40px;color:var(--text-muted)"><div style="font-size:32px;margin-bottom:8px">🛍️</div><div style="font-size:13px">해당 물품이 없습니다.</div></div>`:filtered.map(item=>`
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;margin-bottom:4px">
    <div style="font-size:13px;font-weight:700">${item.title}</div>
    <span style="font-size:11px;color:var(--text-muted)">${item.condition}</span>
  </div>
  <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">${item.desc}</div>
  <div style="display:flex;justify-content:space-between;align-items:center">
    <div><span style="font-size:15px;font-weight:800;color:#4F46E5">${item.price.toLocaleString()}원</span><span style="font-size:10px;color:var(--text-muted);margin-left:6px">${item.sellerName} · ${item.category}</span></div>
    <button class="mk-contact" data-contact="${item.contact}" style="padding:6px 12px;background:#10B981;color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">연락하기</button>
  </div>
</div>`).join('')}`;
}

function _renderMine(mine) {
  if (!mine.length) return `<div style="text-align:center;padding:48px 16px;color:var(--text-muted)"><div style="font-size:40px;margin-bottom:10px">🛍️</div><div style="font-size:14px;font-weight:600;margin-bottom:4px">등록한 물품이 없습니다</div>
      <button onclick="location.hash='#/market'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">물품 등록</button>
    <div style="font-size:12px">판매할 물품을 등록해 보세요!</div></div>`;
  return mine.map(item=>`
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;margin-bottom:4px">
    <div style="font-size:13px;font-weight:700">${item.title}</div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;background:${item.status==='active'?'#EEF2FF':item.status==='sold'?'#ECFDF5':'#F1F5F9'};color:${item.status==='active'?'#4F46E5':item.status==='sold'?'#10B981':'var(--text-muted)'}">${item.status==='active'?'판매 중':item.status==='sold'?'판매 완료':'삭제됨'}</span>
  </div>
  <div style="font-size:14px;font-weight:800;color:#4F46E5;margin-bottom:6px">${item.price.toLocaleString()}원</div>
  ${item.status==='active'?`<button class="mk-sold" data-id="${item.id}" style="width:100%;padding:7px;background:#10B981;color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">판매 완료 처리</button>`:''}
</div>`).join('');
}

function _renderSell() {
  return `
<div style="display:flex;flex-direction:column;gap:10px">
  <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">물품명 *</div>
    <input id="mk-title" type="text" placeholder="판매할 물품명" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">카테고리</div>
      <select id="mk-cat" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px">
        ${CATEGORIES.filter(c=>c!=='전체').map(c=>`<option value="${c}">${c}</option>`).join('')}
      </select></div>
    <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">상태</div>
      <select id="mk-cond" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px">
        ${CONDITIONS.map(c=>`<option value="${c.key}">${c.label}</option>`).join('')}
      </select></div>
  </div>
  <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">가격 (원) *</div>
    <input id="mk-price" type="number" min="0" placeholder="0" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
  <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">설명</div>
    <textarea maxlength="500" id="mk-desc" rows="3" placeholder="물품 상태, 구매 시기 등" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;resize:none;box-sizing:border-box"></textarea></div>
  <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">연락 방법 *</div>
    <input id="mk-contact" type="text" placeholder="예: 내선 1234 / 사내 메신저" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
  <button id="mk-submit" style="padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">등록하기</button>
</div>`;
}

function _bindSell() {
  _root.querySelector('#mk-submit')?.addEventListener('click',()=>{
    const title   = _root.querySelector('#mk-title')?.value.trim();
    const price   = parseInt(_root.querySelector('#mk-price')?.value)||0;
    const contact = _root.querySelector('#mk-contact')?.value.trim();
    if (!title||!contact) { showToast('물품명과 연락 방법을 입력해 주세요.','error'); return; }
    const all = _getAll();
    all.push({ id:'MK_'+Date.now(), sellerId:_empId(), sellerName:_empName(), title, category:_root.querySelector('#mk-cat')?.value||'기타', price, condition:_root.querySelector('#mk-cond')?.value||'중', desc:_root.querySelector('#mk-desc')?.value.trim()||'', contact, status:'active', postedAt:new Date().toISOString().slice(0,10) });
    _saveAll(all);
    showToast('물품이 등록됐습니다.','success')
    addNotification({ type: 'success', title: '사내 장터', body: '물품이 등록됐습니다.' });
    _tab='mine'; _render();
  });
}
