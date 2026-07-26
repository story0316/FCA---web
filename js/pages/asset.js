/**
 * asset.js — 비품/자산 신청 (직원용)
 * Route: #/asset
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_assets';

const ASSET_TYPES = {
  stationery:  '사무용품',
  electronics: '전자기기',
  furniture:   '가구',
  software:    '소프트웨어',
  etc:         '기타',
};

const ASSET_ICON = {
  stationery: '🖊️', electronics: '💻', furniture: '🪑',
  software: '💿', etc: '📦',
};

const STATUS_META = {
  pending:   { label: '검토 중',  bg: '#FEF3C7', color: '#D97706' },
  approved:  { label: '승인',    bg: '#D1FAE5', color: '#059669' },
  rejected:  { label: '반려',    bg: '#FEE2E2', color: '#EF4444' },
  delivered: { label: '지급 완료', bg: '#EEF2FF', color: '#4F46E5' },
};

function _demoAssets() {
  const uid = _uid(); const name = _uname(); const dept = _udept();
  return [
    { id: `ast_${uid}_1`, empId: uid, empName: name, dept, type: 'electronics', itemName: '외장 모니터', quantity: 1, reason: '재택근무 환경 개선 및 업무 효율 향상', status: 'delivered', reqDate: '2026-05-10' },
    { id: `ast_${uid}_2`, empId: uid, empName: name, dept, type: 'stationery', itemName: 'A4 용지 5박스', quantity: 5, reason: '사무용 프린트 용지 소진', status: 'approved', reqDate: '2026-06-01' },
    { id: `ast_${uid}_3`, empId: uid, empName: name, dept, type: 'software', itemName: 'Figma 연간 라이선스', quantity: 1, reason: 'UI/UX 디자인 협업 툴 필요', status: 'pending', reqDate: '2026-06-03' },
  ];
}

function _load() {
  const demo = _demoAssets();
  try {
    const saved = JSON.parse(localStorage.getItem(LS) || '[]');
  if (!saved || !saved.length) { root.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:40px;margin-bottom:10px">💼</div><div style="font-size:14px;font-weight:600;margin-bottom:4px">자산 내역이 없습니다.</div><div style="font-size:12px;margin-bottom:14px">자산 신청은 관리자에게 문의하세요.</div></div>`; return; }
    return [...demo.filter(d => !saved.find(x => x.id === d.id)), ...saved];
  } catch { return [...demo]; }
}
function _save(list) { localStorage.setItem(LS, JSON.stringify(list)); }
function _uid()  { try { return JSON.parse(localStorage.getItem('hr_session') || '{}').empId  || 'EMP001'; } catch { return 'EMP001'; } }
function _uname(){ try { return JSON.parse(localStorage.getItem('hr_session') || '{}').name   || '사용자'; } catch { return '사용자'; } }
function _udept(){ try { return JSON.parse(localStorage.getItem('hr_session') || '{}').dept   || '소속 미지정'; } catch { return '소속 미지정'; } }
function _today(){ return new Date().toISOString().slice(0, 10); }

let _tab = 'apply';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'apply';
  _draw(root);
}

export function unmount() { _tab = 'apply'; }

function _draw(root) {
  const uid  = _uid();
  const mine = _load().filter(a => a.empId === uid).sort((a, b) => b.reqDate.localeCompare(a.reqDate));

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="ast-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">📦 비품/자산 신청</div>
      <div style="font-size:11px;color:var(--text-muted)">신청 내역 ${mine.length}건</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['apply','신청하기'],['history','신청 내역']].map(([k,l]) => `
    <button class="ast-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab === 'apply' ? _renderApply() : _renderHistory(mine)}
  </div>
</div>`;

  root.querySelector('#ast-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.ast-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(root); }));

  if (_tab === 'apply') {
    root.querySelector('#ast-submit-btn')?.addEventListener('click', () => _handleSubmit(root, uid));
  }
}

function _renderApply() {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">유형 <span style="color:#EF4444">*</span></label>
    <select id="ast-type"
      style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text)">
      ${Object.entries(ASSET_TYPES).map(([k,v]) =>
        `<option value="${k}">${ASSET_ICON[k] || '📦'} ${v}</option>`
      ).join('')}
    </select>
  </div>

  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">품목명 <span style="color:#EF4444">*</span></label>
    <input id="ast-item" type="text" placeholder="예: 외장 모니터, 마우스, A4용지"
      style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);
             border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
  </div>

  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">수량 <span style="color:#EF4444">*</span></label>
    <input id="ast-qty" type="number" min="1" placeholder="1" value="1"
      style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);
             border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
  </div>

  <div style="margin-bottom:16px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">신청 사유 <span style="color:#EF4444">*</span></label>
    <textarea maxlength="500" id="ast-reason" placeholder="신청 목적과 필요성을 간략히 작성해 주세요"
      style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);
             border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);
             height:80px;resize:vertical"></textarea>
  </div>

  <button id="ast-submit-btn"
    style="width:100%;background:#4F46E5;color:#fff;border:none;border-radius:12px;
           padding:13px;font-size:14px;font-weight:700;cursor:pointer">신청하기</button>
</div>`;
}

function _renderHistory(mine) {
  if (!mine.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:48px;margin-bottom:12px">📦</div>
  <div style="font-size:15px;font-weight:600;margin-bottom:6px">신청 내역이 없어요</div>
  <div style="font-size:13px">필요한 비품이나 자산을 신청해 보세요.</div>
</div>`;

  return mine.map(a => {
    const s = STATUS_META[a.status] || STATUS_META.pending;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;margin-right:10px">
      <span style="font-size:22px;flex-shrink:0">${ASSET_ICON[a.type] || '📦'}</span>
      <div style="min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--text)">${a.itemName}</div>
        <div style="font-size:11px;color:var(--text-muted)">${ASSET_TYPES[a.type] || a.type} · ${a.quantity}개</div>
      </div>
    </div>
    <span style="flex-shrink:0;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:600;
      background:${s.bg};color:${s.color}">${s.label}</span>
  </div>
  <div style="font-size:11px;color:var(--text-muted);line-height:1.4">${a.reason}</div>
  <div style="font-size:10px;color:var(--text-muted);margin-top:4px">신청일 ${a.reqDate}</div>
</div>`;
  }).join('');
}

function _handleSubmit(root, uid) {
  const type   = root.querySelector('#ast-type')?.value;
  const item   = root.querySelector('#ast-item')?.value.trim();
  const qty    = parseInt(root.querySelector('#ast-qty')?.value || '0');
  const reason = root.querySelector('#ast-reason')?.value.trim();

  if (!type)          { showToast('유형을 선택해 주세요.', 'error'); return; }
  if (!item)          { showToast('품목명을 입력해 주세요.', 'error'); return; }
  if (!qty || qty < 1){ showToast('수량을 올바르게 입력해 주세요.', 'error'); return; }
  if (!reason)        { showToast('신청 사유를 입력해 주세요.', 'error'); return; }

  const all = _load();
  const newItem = {
    id: 'ast_' + Date.now(),
    empId: uid, empName: _uname(), dept: _udept(),
    type, itemName: item, quantity: qty, reason,
    status: 'pending', reqDate: _today(),
  };
  const demoIds = new Set(_demoAssets().map(d => d.id));
  _save([...all.filter(x => !demoIds.has(x.id)), newItem]);
  showToast('비품/자산 신청이 완료되었습니다.', 'success')
    addNotification({ type: 'success', title: '자산 신청', body: '비품/자산 신청이 완료되었습니다.' });
  _tab = 'history';
  _draw(root);
}
