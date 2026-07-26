/**
 * desk-setup.js — 책상 비품 신청 (직원)
 * Route: #/desk-setup
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_desk_setups';

const SETUP_ITEMS = [
  { id:'monitor',  name:'모니터 추가',  desc:'27인치 이하',    icon:'🖥️' },
  { id:'keyboard', name:'키보드',       desc:'유무선',         icon:'⌨️' },
  { id:'mouse',    name:'마우스',       desc:'유무선',         icon:'🖱️' },
  { id:'chair',    name:'의자 교체',    desc:'허리 지지형',    icon:'🪑' },
  { id:'desk',     name:'높낮이 책상',  desc:'스탠딩 데스크',  icon:'🪞' },
  { id:'headset',  name:'헤드셋',       desc:'노이즈 캔슬링',  icon:'🎧' },
  { id:'webcam',   name:'웹캠',         desc:'화상회의용',     icon:'📷' },
];

function _session() { try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; } }
function _empId()   { return _session().empId || _session().userId || 'EMP001'; }
function _empName() { return _session().name || '직원'; }

const DEMO_BASE = [];

function _load() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS) || '[]');
    return [...DEMO_BASE.filter(d => !saved.find(x => x.id === d.id)), ...saved];
  } catch { return []; }
}
function _save(list) { localStorage.setItem(LS, JSON.stringify(list)); }

const STATUS_LABEL = { pending:'검토중', approved:'승인', rejected:'반려' };
const STATUS_COLOR = { pending:'#F59E0B', approved:'#10B981', rejected:'#EF4444' };
const STATUS_BG    = { pending:'#FFFBEB', approved:'#ECFDF5', rejected:'#FEF2F2' };

let _tab = 'items';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'items';
  _render(root);
}

export function unmount() {
  _tab = 'items';
}

function _render(root) {
  const allRequests = _load();
  const myRequests  = allRequests.filter(r => r.empId === _empId());
  const myItemIds   = myRequests.map(r => r.itemId);

  root.innerHTML = `
<div style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg,#F8FAFC)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--card-bg,#fff);border-bottom:1px solid var(--border,#E2E8F0);flex-shrink:0">
    <button id="ds-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text,#1E293B);padding:0;line-height:1">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700;color:var(--text,#1E293B)">🖥️ 비품 신청</div>
      <div style="font-size:11px;color:var(--text-muted)">신청 ${myRequests.length}건</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg,#fff);border-bottom:1px solid var(--border,#E2E8F0);flex-shrink:0">
    ${[['items','비품 목록'],['mine','내 신청']].map(([k,l]) => `
    <button class="ds-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">
    ${_tab === 'items' ? _renderItems(myItemIds) : _renderMine(myRequests)}
  </div>
</div>`;

  root.querySelector('#ds-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.ds-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _render(root); }));

  if (_tab === 'items') {
    root.querySelectorAll('.ds-request-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemId = btn.dataset.id;
        const item   = SETUP_ITEMS.find(i => i.id === itemId);
        if (!item) return;

        const allList = _load();
        const alreadyRequested = allList.some(r => r.empId === _empId() && r.itemId === itemId);
        if (alreadyRequested) { showToast('이미 신청한 비품입니다.', 'warning'); return; }

        allList.push({
          id:       'DS_' + Date.now(),
          empId:    _empId(),
          empName:  _empName(),
          itemId:   itemId,
          itemName: item.name,
          status:   'pending',
          reqDate:  new Date().toISOString().slice(0, 10),
        });
        _save(allList);
        showToast(`"${item.name}" 신청이 완료되었습니다!`, 'success')
    addNotification({ type: 'success', title: '비품 신청', body: '"" 신청이 완료되었습니다!' });
        _render(root);
      });
    });
  }
}

function _renderItems(myItemIds) {
  return `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
  ${SETUP_ITEMS.map(item => {
    const requested = myItemIds.includes(item.id);
    return `
<div style="background:var(--card-bg,#fff);border:1.5px solid ${requested?'#C7D2FE':'var(--border,#E2E8F0)'};border-radius:14px;padding:14px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px">
  <div style="font-size:32px">${item.icon}</div>
  <div style="font-size:13px;font-weight:700;color:var(--text,#1E293B)">${item.name}</div>
  <div style="font-size:11px;color:var(--text-muted)">${item.desc}</div>
  <button class="ds-request-btn" data-id="${item.id}"
    style="margin-top:4px;width:100%;padding:7px;border-radius:8px;font-size:12px;font-weight:700;cursor:${requested?'not-allowed':'pointer'};
           border:1.5px solid ${requested?'#C7D2FE':'#4F46E5'};
           background:${requested?'#EEF2FF':'#4F46E5'};
           color:${requested?'#818CF8':'#fff'}"
    ${requested?'disabled':''}>
    ${requested?'신청됨':'신청하기'}
  </button>
</div>`;
  }).join('')}
</div>`;
}

function _renderMine(myRequests) {
  if (!myRequests.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:44px;margin-bottom:12px">🖥️</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:6px">신청 내역이 없습니다</div>
      <button onclick="location.hash='#/desk-setup'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">비품 신청</button>
    
  <div style="font-size:12px">필요한 비품을 신청해보세요!</div>
</div>`;

  const itemInfo = Object.fromEntries(SETUP_ITEMS.map(i => [i.id, i]));

  return myRequests.map(r => {
    const item = itemInfo[r.itemId] || {};
    return `
<div style="background:var(--card-bg,#fff);border:1px solid var(--border,#E2E8F0);border-radius:14px;padding:14px;margin-bottom:10px;display:flex;align-items:center;gap:12px">
  <div style="font-size:28px;flex-shrink:0">${item.icon || '📦'}</div>
  <div style="flex:1;min-width:0">
    <div style="font-size:14px;font-weight:700;color:var(--text,#1E293B)">${r.itemName}</div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:2px">신청일: ${r.reqDate}</div>
  </div>
  <span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;flex-shrink:0;
    background:${STATUS_BG[r.status]};color:${STATUS_COLOR[r.status]}">${STATUS_LABEL[r.status]}</span>
</div>`;
  }).join('');
}
