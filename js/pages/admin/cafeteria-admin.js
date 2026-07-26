/**
 * cafeteria-admin.js — 식수 현황 & 메뉴 관리
 */

import { loadDisplayEmployees } from '../../data/demo_employees.js';
import { showToast } from '../../components/toast.js'
import { addNotification } from '../../components/notification-hub.js';

const LS_ORDERS = 'hr_lunch_orders';
const LS_MENU   = 'hr_lunch_menu';

const WEEKDAYS = ['월요일','화요일','수요일','목요일','금요일'];
const DAY_KEYS = ['mon','tue','wed','thu','fri'];

const DEMO_MENU = {
  mon: { main:'된장찌개 + 불고기',    side:'김치·시금치나물·멸치볶음',   dessert:'바나나',    kcal:680, allergens:['글루텐','대두'] },
  tue: { main:'순두부찌개 + 제육볶음', side:'깍두기·콩나물·감자조림',     dessert:'사과',      kcal:720, allergens:['대두','글루텐'] },
  wed: { main:'미역국 + 삼겹살구이',  side:'배추김치·나물·계란말이',      dessert:'귤',        kcal:810, allergens:['달걀'] },
  thu: { main:'김치찌개 + 닭갈비',    side:'깍두기·잡채·두부조림',        dessert:'요구르트',  kcal:760, allergens:['글루텐','유제품','대두'] },
  fri: { main:'갈비탕 + 잡채',        side:'배추김치·도라지무침·어묵',    dessert:'커피젤리',  kcal:700, allergens:['글루텐','달걀'] },
};

let _employees = [];

function _loadOrders() { try { return JSON.parse(localStorage.getItem(LS_ORDERS) || '[]'); } catch { return []; } }
function _loadMenu()   {
  try {
    const s = JSON.parse(localStorage.getItem(LS_MENU) || '{}');
    return Object.keys(s).length ? s : JSON.parse(JSON.stringify(DEMO_MENU));
  } catch { return JSON.parse(JSON.stringify(DEMO_MENU)); }
}
function _saveMenu(d)  { localStorage.setItem(LS_MENU, JSON.stringify(d)); }

function _isoWeek() {
  const d = new Date(); d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 4 - (d.getDay()||7));
  const y = d.getFullYear();
  const w = Math.ceil(((d - new Date(y,0,1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2,'0')}`;
}

// 데모 주문 시딩
function _seedOrders(orders) {
  const week = _isoWeek();
  const hasDemo = orders.some(o => o.id?.startsWith('demo_lo'));
  if (hasDemo) return orders;
  const seeded = [...orders];
  _employees.slice(0, 20).forEach((emp, i) => {
    const cnt = [3,4,5,2,4][i % 5];
    DAY_KEYS.slice(0, cnt).forEach(key => {
      seeded.push({
        id:        `demo_lo_${emp.id}_${key}`,
        userId:    emp.id || emp.employee_id,
        week,
        dayKey:    key,
        orderedAt: new Date().toISOString(),
      });
    });
  });
  return seeded;
}

let _tab    = 'status';
let _editDay = null;
let _editForm = {};

export async function mount(root) {
  _tab = 'status'; _editDay = null;
  root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">⏳</div><div style="font-size:13px">로딩 중…</div></div>`;
  _employees = await loadDisplayEmployees();
  _draw(root);
}

export function render(root) { _tab = 'status'; _editDay = null; _draw(root); }
export function unmount() { _tab = 'status'; _editDay = null; _employees = []; }

function _draw(root) {
  const rawOrders = _loadOrders();
  const orders    = _seedOrders(rawOrders);
  if (!orders||!orders.length){root.innerHTML=`<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:48px;margin-bottom:12px">🍽️</div><div style="font-size:14px;font-weight:600;margin-bottom:6px">식단 정보가 없습니다.</div><div style="font-size:12px">데이터가 축적되면 자동으로 표시됩니다.</div></div>`;return;}
  const menu      = _loadMenu();
  const week      = _isoWeek();
  const thisWeek  = orders.filter(o => o.week === week);
  const totalEmp  = (_employees.length || 1);
  const totalOrders = thisWeek.length;

  root.innerHTML = `
<!-- 탭 -->
<div style="display:flex;border-bottom:1px solid var(--border);margin-bottom:14px">
  ${[{k:'status',l:'식수 현황'},{k:'menu',l:'메뉴 관리'}].map(t=>`
    <button class="ca-tab" data-t="${t.k}"
      style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab===t.k?'#4F46E5':'transparent'};color:${_tab===t.k?'#4F46E5':'#64748B'}">
      ${t.l}
    </button>`).join('')}
</div>

${_tab === 'status' ? _renderStatus(thisWeek, menu, totalEmp) : ''}
${_tab === 'menu'   ? _renderMenu(menu)   : ''}`;

  root.querySelectorAll('.ca-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _editDay = null; _draw(root); });
  });

  root.querySelectorAll('.ca-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _editDay  = btn.dataset.day;
      _editForm = { ...(menu[_editDay] || { main:'', side:'', dessert:'', kcal:'', allergens:[] }) };
      _draw(root);
    });
  });

  if (_editDay) _bindEditForm(root, menu);
}

function _renderStatus(thisWeek, menu, totalEmp) {
  const total = thisWeek.length;
  const avgPerDay = DAY_KEYS.length ? Math.round(total / DAY_KEYS.length) : 0;

  return `
<!-- 이번 주 요약 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
    <div>
      <div style="font-size:24px;font-weight:900;color:#4F46E5">${total}</div>
      <div style="font-size:10px;color:#64748B">이번 주 총 예약</div>
    </div>
    <div>
      <div style="font-size:24px;font-weight:900;color:#10B981">${avgPerDay}</div>
      <div style="font-size:10px;color:#64748B">일 평균 식수</div>
    </div>
    <div>
      <div style="font-size:24px;font-weight:900;color:#F59E0B">${Math.round(total / (totalEmp * DAY_KEYS.length) * 100)}%</div>
      <div style="font-size:10px;color:#64748B">주간 예약률</div>
    </div>
  </div>
</div>

<!-- 요일별 식수 바차트 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:12px">요일별 식수 현황</div>
  <div style="display:flex;align-items:flex-end;gap:8px;height:90px">
    ${DAY_KEYS.map((key, i) => {
      const cnt = thisWeek.filter(o => o.dayKey === key).length;
      const h   = totalEmp ? Math.round((cnt / totalEmp) * 72) + 8 : 8;
      const pct = totalEmp ? Math.round(cnt / totalEmp * 100) : 0;
      return `
<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">
  <div style="font-size:10px;color:#4F46E5;font-weight:700;margin-bottom:2px">${cnt}</div>
  <div style="width:100%;height:${h}px;background:${pct>=70?'#4F46E5':pct>=50?'#818CF8':'#C7D2FE'};border-radius:4px 4px 0 0"></div>
  <div style="font-size:10px;color:#94A3B8;margin-top:4px">${WEEKDAYS[i].slice(0,1)}</div>
</div>`;
    }).join('')}
  </div>
  <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:10px;color:#94A3B8">
    <span>예약 현황</span><span>전체 인원 ${totalEmp}명 기준</span>
  </div>
</div>

<!-- 요일별 상세 -->
${DAY_KEYS.map((key, i) => {
  const dayOrders = thisWeek.filter(o => o.dayKey === key);
  const m = menu[key];
  const pct = totalEmp ? Math.round(dayOrders.length / totalEmp * 100) : 0;
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
    <span style="font-size:12px;font-weight:700;color:var(--text)">${WEEKDAYS[i]}</span>
    <span style="font-size:12px;font-weight:700;color:#4F46E5">${dayOrders.length}명 (${pct}%)</span>
  </div>
  ${m ? `<div style="font-size:11px;color:#64748B;margin-bottom:4px">🍱 ${m.main}</div>` : ''}
  <div style="height:6px;background:#E2E8F0;border-radius:3px;overflow:hidden">
    <div style="height:100%;width:${pct}%;background:#4F46E5;border-radius:3px"></div>
  </div>
</div>`;
}).join('')}`;
}

function _renderMenu(menu) {
  return `
<div style="font-size:11px;color:#64748B;margin-bottom:12px">메뉴를 클릭해 수정하세요</div>

${_editDay ? _renderEditForm(menu) : ''}

${DAY_KEYS.map((key, i) => {
  const m = menu[key];
  if (_editDay === key) return '';
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
    <span style="font-size:13px;font-weight:700;color:var(--text)">${WEEKDAYS[i]}</span>
    <button class="ca-edit-btn" data-day="${key}"
      style="padding:4px 10px;border:1px solid #C7D2FE;border-radius:6px;background:#EEF2FF;color:#4F46E5;font-size:11px;font-weight:600;cursor:pointer">
      수정
    </button>
  </div>
  ${m ? `
  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:3px">🍱 ${m.main}</div>
  <div style="font-size:11px;color:#64748B;margin-bottom:2px">반찬: ${m.side}</div>
  <div style="font-size:11px;color:#64748B;margin-bottom:4px">후식: ${m.dessert} · ${m.kcal} kcal</div>
  ${m.allergens?.length ? `<div style="font-size:10px;color:#F59E0B">⚠️ ${m.allergens.join(', ')}</div>` : ''}
  ` : `<div style="font-size:11px;color:#94A3B8">메뉴 미등록</div>`}
</div>`;
}).join('')}`;
}

function _renderEditForm(menu) {
  const m = _editForm;
  const ALLERGENS = ['글루텐','유제품','달걀','땅콩','갑각류','생선','대두','견과류'];
  const checked = m.allergens || [];
  const wi = DAY_KEYS.indexOf(_editDay);
  return `
<div style="background:#F8FAFC;border:2px solid #4F46E5;border-radius:14px;padding:14px;margin-bottom:12px">
  <div style="font-size:13px;font-weight:700;color:#4F46E5;margin-bottom:10px">${WEEKDAYS[wi]} 메뉴 편집</div>
  <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">
    <div>
      <div style="font-size:11px;color:#64748B;margin-bottom:3px">메인 메뉴</div>
      <input id="ca-main" type="text" value="${m.main||''}" placeholder="예: 된장찌개 + 불고기"
        style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
    <div>
      <div style="font-size:11px;color:#64748B;margin-bottom:3px">반찬</div>
      <input id="ca-side" type="text" value="${m.side||''}" placeholder="예: 김치·나물·볶음"
        style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <div style="font-size:11px;color:#64748B;margin-bottom:3px">후식</div>
        <input id="ca-dessert" type="text" value="${m.dessert||''}" placeholder="과일/음료"
          style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text)">
      </div>
      <div>
        <div style="font-size:11px;color:#64748B;margin-bottom:3px">칼로리 (kcal)</div>
        <input id="ca-kcal" type="number" value="${m.kcal||''}" placeholder="0"
          style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text)">
      </div>
    </div>
    <div>
      <div style="font-size:11px;color:#64748B;margin-bottom:5px">알레르기 성분</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${ALLERGENS.map(a=>`
          <label style="display:flex;align-items:center;gap:4px;padding:4px 9px;border:1px solid ${checked.includes(a)?'#F59E0B':'var(--border)'};border-radius:7px;background:${checked.includes(a)?'#FEF3C7':'var(--card-bg)'};cursor:pointer;font-size:11px">
            <input class="ca-allergen" type="checkbox" data-a="${a}" ${checked.includes(a)?'checked':''} style="accent-color:#F59E0B">
            ${a}
          </label>`).join('')}
      </div>
    </div>
  </div>
  <div style="display:flex;gap:8px">
    <button id="ca-edit-cancel" style="flex:1;padding:9px;border:1px solid var(--border);border-radius:8px;background:var(--card-bg);color:#64748B;font-size:12px;cursor:pointer">취소</button>
    <button id="ca-edit-save"   style="flex:2;padding:9px;border:none;border-radius:8px;background:#4F46E5;color:#fff;font-size:12px;font-weight:700;cursor:pointer">저장</button>
  </div>
</div>`;
}

function _bindEditForm(root, menu) {
  root.querySelectorAll('.ca-allergen').forEach(cb => {
    cb.addEventListener('change', () => {
      const a = cb.dataset.a;
      const list = _editForm.allergens || [];
      if (cb.checked) { if (!list.includes(a)) list.push(a); }
      else { const i = list.indexOf(a); if (i >= 0) list.splice(i, 1); }
      _editForm.allergens = list;
    });
  });

  root.querySelector('#ca-edit-cancel')?.addEventListener('click', () => { _editDay = null; _draw(root); });
  root.querySelector('#ca-edit-save')?.addEventListener('click', () => {
    const main = root.querySelector('#ca-main')?.value.trim();
    if (!main) { showToast('메인 메뉴를 입력해 주세요.', 'error'); return; }
    const updated = { ..._loadMenu() };
    updated[_editDay] = {
      main,
      side:      root.querySelector('#ca-side')?.value.trim()    || '',
      dessert:   root.querySelector('#ca-dessert')?.value.trim() || '',
      kcal:      parseInt(root.querySelector('#ca-kcal')?.value  || '0') || 0,
      allergens: _editForm.allergens || [],
    };
    _saveMenu(updated);
    showToast('메뉴가 저장되었습니다.');
    addNotification({ type: 'success', title: '구내식당 관리', body: '메뉴가 저장되었습니다.' });
    _editDay = null;
    _draw(root);
  });
}
