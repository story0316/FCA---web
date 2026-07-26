/**
 * lunch-order.js — 사내 식당 / 점심 예약
 */

import {getUser, isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js'
import { addNotification } from '../components/notification-hub.js';

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId() {
  const s = _session();
  return s.empId || s.userId || getUser()?.id || 'EMP001';
}

const LS_ORDERS  = 'hr_lunch_orders';
const LS_PREF    = 'hr_lunch_pref';
const LS_MENU    = 'hr_lunch_menu';

const WEEKDAYS = ['월', '화', '수', '목', '금'];
const ALLERGENS = ['글루텐','유제품','달걀','땅콩','갑각류','생선','대두','견과류'];

const DEMO_MENU = {
  mon: { main:'된장찌개 + 불고기',  side:'김치·시금치나물·멸치볶음', dessert:'바나나', kcal:680, allergens:['글루텐','대두'] },
  tue: { main:'순두부찌개 + 제육볶음', side:'깍두기·콩나물·감자조림', dessert:'사과',   kcal:720, allergens:['대두','글루텐'] },
  wed: { main:'미역국 + 삼겹살구이',  side:'배추김치·나물·계란말이',  dessert:'귤',     kcal:810, allergens:['달걀'] },
  thu: { main:'김치찌개 + 닭갈비',    side:'깍두기·잡채·두부조림',    dessert:'요구르트',kcal:760, allergens:['글루텐','유제품','대두'] },
  fri: { main:'갈비탕 + 잡채',        side:'배추김치·도라지무침·어묵', dessert:'커피젤리',kcal:700, allergens:['글루텐','달걀'] },
};
const DAY_KEYS  = ['mon','tue','wed','thu','fri'];

function _loadOrders() { try { return JSON.parse(localStorage.getItem(LS_ORDERS) || '[]'); } catch { return []; } }
function _saveOrders(d){ localStorage.setItem(LS_ORDERS, JSON.stringify(d)); }
function _loadPref()   { try { return JSON.parse(localStorage.getItem(LS_PREF)   || '{}'); } catch { return {}; } }
function _savePref(d)  { localStorage.setItem(LS_PREF, JSON.stringify(d)); }
function _loadMenu()   {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_MENU) || '{}');
    return Object.keys(saved).length ? saved : DEMO_MENU;
  } catch { return DEMO_MENU; }
}

function _isoWeek() {
  const d = new Date(); d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const y = d.getFullYear();
  const w = Math.ceil(((d - new Date(y,0,1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2,'0')}`;
}

function _todayKey() {
  const dow = new Date().getDay();
  return DAY_KEYS[dow - 1] || null;
}

let _tab = 'this-week';
let _editPref = false;
let _tempPref = {};

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'this-week'; _editPref = false;
  _tempPref = { ..._loadPref() };
  _draw(root);
}
export function unmount() { _tab = 'this-week';}

function _draw(root) {
  const user    = getUser();
  const uid     = user?.id || user?.employee_id || 'demo';
  const week    = _isoWeek();
  const menu    = _loadMenu();
  const orders  = _loadOrders();
  const pref    = _loadPref();
  const todayK  = _todayKey();

  const myOrders = orders.filter(o => o.userId === uid && o.week === week);
  const orderedDays = new Set(myOrders.map(o => o.dayKey));
  const totalOrders = myOrders.length;

  root.innerHTML = `
<div class="page-content" style="padding:16px;max-width:480px;margin:0 auto">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button onclick="window.navBack()" style="background:none;border:none;font-size:20px;cursor:pointer;padding:0">←</button>
    <div>
      <div style="font-size:17px;font-weight:800;color:var(--text)">사내 식당</div>
      <div style="font-size:11px;color:var(--text-muted)">이번 주 예약 ${totalOrders}/5일</div>
    </div>
  </div>

  <div style="display:flex;background:#F1F5F9;border-radius:10px;padding:3px;margin-bottom:16px">
    ${[{k:'this-week',l:'이번 주 메뉴'},{k:'history',l:'예약 내역'},{k:'pref',l:'식이 설정'}].map(t=>`
      <button class="lo-tab" data-t="${t.k}"
        style="flex:1;padding:7px 4px;border:none;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;
               background:${_tab===t.k?'#fff':'transparent'};color:${_tab===t.k?'#4F46E5':'var(--text-muted)'};
               box-shadow:${_tab===t.k?'0 1px 4px rgba(0,0,0,0.1)':'none'}">
        ${t.l}
      </button>`).join('')}
  </div>

  ${_tab === 'this-week' ? _renderWeek(menu, orderedDays, todayK, week, uid, orders, pref) : ''}
  ${_tab === 'history'   ? _renderHistory(orders, uid, menu) : ''}
  ${_tab === 'pref'      ? _renderPref(pref) : ''}
</div>`;

  root.querySelectorAll('.lo-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _draw(root); });
  });

  root.querySelectorAll('.lo-order-btn').forEach(btn => {
    btn.addEventListener('click', () => _toggleOrder(btn.dataset.day, uid, week, root));
  });

  if (_tab === 'pref') _bindPref(root);
}

function _renderWeek(menu, orderedDays, todayK, week, uid, orders, pref) {
  const allergyList = pref.allergens || [];

  return WEEKDAYS.map((wd, i) => {
    const key  = DAY_KEYS[i];
    const m    = menu[key];
    const isOrdered = orderedDays.has(key);
    const isToday   = key === todayK;
    const isPast    = todayK ? DAY_KEYS.indexOf(key) < DAY_KEYS.indexOf(todayK) : false;

    const hasAllergen = m && allergyList.some(a => m.allergens?.includes(a));
    const borderColor = isOrdered ? '#4F46E5' : isToday ? '#10B981' : 'var(--border)';

    return `
<div style="background:var(--card-bg);border:2px solid ${borderColor};border-radius:14px;padding:14px;margin-bottom:10px;opacity:${isPast?0.6:1}">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <div style="display:flex;gap:8px;align-items:center">
      <span style="font-size:13px;font-weight:800;color:${isToday?'#10B981':'var(--text)'}">${wd}요일</span>
      ${isToday ? '<span style="padding:2px 7px;background:#DCFCE7;border-radius:5px;font-size:10px;color:#16A34A;font-weight:700">오늘</span>' : ''}
      ${hasAllergen ? '<span style="padding:2px 7px;background:#FEF3C7;border-radius:5px;font-size:10px;color:#D97706;font-weight:700">⚠️ 알레르기</span>' : ''}
    </div>
    ${!m ? '' : `<span style="font-size:10px;color:var(--text-muted)">${m.kcal} kcal</span>`}
  </div>

  ${m ? `
  <div style="margin-bottom:10px">
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:3px">🍱 ${m.main}</div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">반찬: ${m.side}</div>
    <div style="font-size:11px;color:var(--text-muted)">후식: ${m.dessert}</div>
    ${m.allergens?.length ? `<div style="font-size:10px;color:#F59E0B;margin-top:4px">알레르기 정보: ${m.allergens.join(', ')}</div>` : ''}
  </div>
  ${!isPast ? `
  <button class="lo-order-btn" data-day="${key}"
    style="width:100%;padding:10px;border:none;border-radius:9px;
           background:${isOrdered?'#EEF2FF':'#4F46E5'};
           color:${isOrdered?'#4F46E5':'#fff'};font-size:12px;font-weight:700;cursor:pointer">
    ${isOrdered ? '✓ 예약 취소' : '+ 점심 예약'}
  </button>` : `<div style="font-size:11px;color:var(--text-muted);text-align:center">지난 식단입니다</div>`}
  ` : `<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:8px 0">메뉴 미등록</div>`}
</div>`;
  }).join('');
}

function _renderHistory(orders, uid, menu) {
  const myAll = orders.filter(o => o.userId === uid).slice().reverse();
  if (!myAll.length) return `
<div style="text-align:center;padding:40px 16px;color:var(--text-muted)">
  <div style="font-size:32px;margin-bottom:8px">🍱</div>
  <div style="font-size:13px;margin-bottom:14px">예약 내역이 없습니다</div>
  <button onclick="document.querySelector('.lo-tab[data-t=this-week]')?.click()" style="padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">이번 주 메뉴 보기</button>
</div>`;

  const weekly = {};
  myAll.forEach(o => { if (!weekly[o.week]) weekly[o.week] = []; weekly[o.week].push(o); });

  return Object.entries(weekly).map(([wk, items]) => `
<div style="margin-bottom:14px">
  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:6px">${wk} (${items.length}일 예약)</div>
  ${items.map(o => {
    const dayIdx = DAY_KEYS.indexOf(o.dayKey);
    const wd = WEEKDAYS[dayIdx] || o.dayKey;
    const m = (o.week === _isoWeek() ? menu : DEMO_MENU)[o.dayKey];
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:9px;padding:10px;margin-bottom:5px;display:flex;align-items:center;gap:10px">
  <span style="font-size:22px">🍱</span>
  <div>
    <div style="font-size:12px;font-weight:700;color:var(--text)">${wd}요일 ${m ? '· ' + m.main : ''}</div>
    <div style="font-size:10px;color:var(--text-muted)">${o.orderedAt?.slice(0,10) || ''}</div>
  </div>
</div>`;
  }).join('')}
</div>`).join('');
}

function _renderPref(pref) {
  const checked = _editPref ? (_tempPref.allergens || []) : (pref.allergens || []);
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px">
  <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">알레르기 / 식이 제한</div>
  <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">해당 성분이 포함된 메뉴에 경고 표시가 나타납니다</div>
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">
    ${ALLERGENS.map(a => `
      <label style="display:flex;align-items:center;gap:5px;padding:6px 10px;border:1px solid ${checked.includes(a)?'#4F46E5':'var(--border)'};border-radius:8px;background:${checked.includes(a)?'#EEF2FF':'var(--card-bg)'};cursor:pointer">
        <input class="lo-allergy" type="checkbox" data-a="${a}" ${checked.includes(a)?'checked':''} style="accent-color:#4F46E5">
        <span style="font-size:12px;color:${checked.includes(a)?'#4F46E5':'var(--text)'}">${a}</span>
      </label>`).join('')}
  </div>

  <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px">식단 유형</div>
  <div style="display:flex;gap:8px;margin-bottom:14px">
    ${['일반','채식','할랄'].map(t=>`
      <button class="lo-diet" data-d="${t}"
        style="flex:1;padding:9px;border:2px solid ${((_editPref?_tempPref.diet:pref.diet)||'일반')===t?'#4F46E5':'var(--border)'};
               border-radius:9px;background:${((_editPref?_tempPref.diet:pref.diet)||'일반')===t?'#EEF2FF':'var(--card-bg)'};
               color:${((_editPref?_tempPref.diet:pref.diet)||'일반')===t?'#4F46E5':'var(--text-muted)'};font-size:12px;font-weight:600;cursor:pointer">
        ${t}
      </button>`).join('')}
  </div>

  <button id="lo-pref-save" style="width:100%;padding:12px;border:none;border-radius:10px;background:#4F46E5;color:#fff;font-size:13px;font-weight:700;cursor:pointer">
    설정 저장
  </button>
</div>`;
}

function _bindPref(root) {
  _editPref = true;
  root.querySelectorAll('.lo-allergy').forEach(cb => {
    cb.addEventListener('change', () => {
      const a = cb.dataset.a;
      const list = _tempPref.allergens || [];
      if (cb.checked) { if (!list.includes(a)) list.push(a); }
      else { const idx = list.indexOf(a); if (idx >= 0) list.splice(idx, 1); }
      _tempPref.allergens = list;
      _draw(root);
    });
  });
  root.querySelectorAll('.lo-diet').forEach(btn => {
    btn.addEventListener('click', () => { _tempPref.diet = btn.dataset.d; _draw(root); });
  });
  root.querySelector('#lo-pref-save')?.addEventListener('click', () => {
    _savePref({ ..._tempPref });
    _editPref = false;
    showToast('식이 설정이 저장되었습니다.');
    addNotification({ type: 'success', title: '점심 주문', body: '식이 설정이 저장되었습니다.' });
    _draw(root);
  });
}

function _toggleOrder(dayKey, uid, week, root) {
  const orders = _loadOrders();
  const idx    = orders.findIndex(o => o.userId === uid && o.week === week && o.dayKey === dayKey);
  if (idx >= 0) {
    orders.splice(idx, 1);
    _saveOrders(orders);
    showToast('예약이 취소되었습니다.');
    addNotification({ type: 'info', title: '점심 주문', body: '예약이 취소되었습니다.' });
  } else {
    orders.push({ id: 'lo_'+Date.now(), userId: uid, week, dayKey, orderedAt: new Date().toISOString() });
    _saveOrders(orders);
    showToast('점심이 예약되었습니다! 🍱');
    addNotification({ type: 'success', title: '점심 주문', body: '점심이 예약되었습니다!' });
  }
  _draw(root);
}
