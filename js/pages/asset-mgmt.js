/**
 * asset-mgmt.js — 사내 자산 대출·반납 (직원용)
 */

import {getUser, isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId() {
  const s = _session();
  return s.empId || s.userId || getUser()?.id || 'EMP001';
}

const LS_ASSETS  = 'hr_assets';
const LS_LOANS   = 'hr_asset_loans';

const CATEGORY_META = {
  laptop:  { icon: '💻', label: '노트북',     color: '#3B82F6' },
  monitor: { icon: '🖥️', label: '모니터',     color: '#8B5CF6' },
  phone:   { icon: '📱', label: '휴대폰',     color: '#10B981' },
  tablet:  { icon: '📟', label: '태블릿',     color: '#F59E0B' },
  vehicle: { icon: '🚗', label: '차량',       color: '#EF4444' },
  other:   { icon: '📦', label: '기타',       color: 'var(--text-muted)' },
};

const STATUS_META = {
  available: { label: '대출 가능', color: '#10B981', bg: '#D1FAE5' },
  on_loan:   { label: '대출 중',   color: '#F59E0B', bg: '#FEF3C7' },
  repair:    { label: '수리 중',   color: '#EF4444', bg: '#FEE2E2' },
};

const LOAN_STATUS = {
  pending:   { label: '승인 대기', color: '#F59E0B', bg: '#FEF3C7' },
  approved:  { label: '대출 중',   color: '#3B82F6', bg: '#EFF6FF' },
  returned:  { label: '반납 완료', color: '#10B981', bg: '#D1FAE5' },
  rejected:  { label: '반려',      color: 'var(--text-muted)', bg: '#F1F5F9' },
};

function _getAssets() {
  const saved = localStorage.getItem(LS_ASSETS);
  if (!saved) {
    const demo = [
      { id:'AST001', name:'MacBook Pro 14" (2023)', category:'laptop', serial:'MBP-2023-001', status:'available', location:'IT창고', purchasedAt:'2023-03-15' },
      { id:'AST002', name:'MacBook Pro 14" (2023)', category:'laptop', serial:'MBP-2023-002', status:'on_loan',   location:'개발팀', purchasedAt:'2023-03-15' },
      { id:'AST003', name:'Dell 27" 4K 모니터',     category:'monitor', serial:'DEL-4K-003',  status:'available', location:'IT창고', purchasedAt:'2022-09-01' },
      { id:'AST004', name:'Dell 27" 4K 모니터',     category:'monitor', serial:'DEL-4K-004',  status:'available', location:'IT창고', purchasedAt:'2022-09-01' },
      { id:'AST005', name:'iPhone 15 Pro',           category:'phone',   serial:'IPH-15-005',  status:'available', location:'IT창고', purchasedAt:'2023-11-01' },
      { id:'AST006', name:'iPad Pro 12.9" (2022)',   category:'tablet',  serial:'IPD-22-006',  status:'on_loan',   location:'마케팅팀', purchasedAt:'2022-12-01' },
      { id:'AST007', name:'쏘나타 DN8 (가나1234)',    category:'vehicle', serial:'KIA-DN8-007', status:'available', location:'주차장 B1', purchasedAt:'2021-06-01' },
      { id:'AST008', name:'무선 마우스/키보드 세트',  category:'other',   serial:'KB-SET-008',  status:'available', location:'IT창고', purchasedAt:'2023-01-01' },
    ];
    localStorage.setItem(LS_ASSETS, JSON.stringify(demo));
    return demo;
  }
  return JSON.parse(saved);
}

function _getLoans() {
  const saved = localStorage.getItem(LS_LOANS);
  if (!saved) {
    const today = new Date();
    const demo = [
      { id:'LN001', userId:'demo', userName:'나', assetId:'AST002', assetName:'MacBook Pro 14"',
        purpose:'재택근무용', startDate: new Date(today - 86400000*10).toISOString().slice(0,10),
        endDate: new Date(today + 86400000*20).toISOString().slice(0,10),
        status:'approved', approvedAt: new Date(today - 86400000*9).toISOString().slice(0,10) },
    ];
    localStorage.setItem(LS_LOANS, JSON.stringify(demo));
    return demo;
  }
  return JSON.parse(saved);
}

function _saveLoans(list) {
  localStorage.setItem(LS_LOANS, JSON.stringify(list));
}

let _tab = 'catalog';    // 'catalog' | 'my'
let _filterCat = 'all';
let _showForm = false;
let _selectedAsset = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'catalog'; _filterCat = 'all'; _showForm = false; _selectedAsset = null;
  _renderPage(root);
}

export function unmount() {
  _tab = 'catalog'; _filterCat = 'all'; _showForm = false; _selectedAsset = null;
}

function _renderPage(root) {
  if (_showForm) { _renderLoanForm(root); return; }
  const user = getUser();
  const userId = _empId();
  const assets  = _getAssets();
  const loans   = _getLoans();
  const myLoans = loans.filter(l => l.userId === userId && l.status !== 'returned');
  const cats    = ['all', ...new Set(assets.map(a => a.category))];

  const filtered = assets.filter(a =>
    _filterCat === 'all' || a.category === _filterCat
  );

  root.innerHTML = `
<div class="page" style="background:var(--bg)">
  <div class="top-bar">
    <button class="btn btn-ghost btn-sm" onclick="window.navBack()" style="padding:8px;min-height:40px">←</button>
    <div class="top-bar-title" style="flex:1;text-align:center">🏷️ 자산 관리</div>
    <div style="min-width:40px"></div>
  </div>

  <!-- 탭 -->
  <div style="display:flex;border-bottom:2px solid var(--border);background:var(--surface)">
    ${[{key:'catalog',label:'자산 목록'},{key:'my',label:`내 대출 (${myLoans.length})`}].map(t => `
    <button class="ast-tab" data-tab="${t.key}"
      style="flex:1;padding:12px;font-size:13px;font-weight:600;background:none;border:none;
             cursor:pointer;border-bottom:2px solid ${_tab===t.key?'#4F46E5':'transparent'};
             margin-bottom:-2px;color:${_tab===t.key?'#4F46E5':'var(--text-muted)'}">
      ${t.label}
    </button>`).join('')}
  </div>

  <div class="page-content" style="padding:16px">

    ${_tab === 'my' ? _renderMyLoans(myLoans) : `
    <!-- 카테고리 필터 -->
    <div style="display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin-bottom:14px;padding-bottom:2px">
      ${cats.map(c => {
        const meta = CATEGORY_META[c];
        const color = meta?.color || '#4F46E5';
        return `<button class="cat-btn" data-cat="${c}"
          style="flex-shrink:0;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;
                 cursor:pointer;border:2px solid ${_filterCat===c?color:'var(--border)'};
                 background:${_filterCat===c?color+'15':'var(--card-bg)'};
                 color:${_filterCat===c?color:'var(--text-muted)'}">
          ${meta?.icon || ''} ${c === 'all' ? '전체' : meta?.label || c}
        </button>`;
      }).join('')}
    </div>

    <!-- 가용 카운트 -->
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">
      총 ${filtered.length}개 · 대출 가능 ${filtered.filter(a=>a.status==='available').length}개
    </div>

    <!-- 자산 목록 -->
    ${filtered.map(a => {
      const cat = CATEGORY_META[a.category] || CATEGORY_META.other;
      const st  = STATUS_META[a.status] || STATUS_META.available;
      return `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
         padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px">
      <div style="width:44px;height:44px;border-radius:12px;background:${cat.color}15;
           display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">
        ${cat.icon}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--text);
             white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.name}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
          ${cat.label} · ${a.location}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:10px;
          color:${st.color};background:${st.bg};margin-bottom:6px">${st.label}</div>
        ${a.status === 'available'
          ? `<button class="loan-req-btn" data-id="${a.id}" data-name="${a.name}"
               style="padding:5px 10px;background:#4F46E5;color:#fff;border:none;
                      border-radius:8px;font-size:11px;font-weight:600;cursor:pointer">
               대출 신청
             </button>`
          : `<div style="font-size:10px;color:var(--text-muted)">대출불가</div>`}
      </div>
    </div>`;
    }).join('')}`}

  </div>
</div>`;

  root.querySelectorAll('.ast-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.tab; _renderPage(root); });
  });
  root.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => { _filterCat = btn.dataset.cat; _renderPage(root); });
  });
  root.querySelectorAll('.loan-req-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _selectedAsset = { id: btn.dataset.id, name: btn.dataset.name };
      _showForm = true; _renderPage(root);
    });
  });

  // 반납 버튼 (my 탭)
  root.querySelectorAll('.return-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const loans = _getLoans();
      const idx = loans.findIndex(l => l.id === btn.dataset.id);
      if (idx >= 0) {
        loans[idx].status = 'returned';
        loans[idx].returnedAt = new Date().toISOString().slice(0, 10);
        _saveLoans(loans);
      }
      showToast('반납 처리되었습니다.', 'success');
      _renderPage(root);
    });
  });
}

function _renderMyLoans(loans) {
  if (!loans.length) return `
    <div style="text-align:center;padding:48px;color:var(--text-muted)">
      <div style="font-size:40px;margin-bottom:10px">🏷️</div>
      <div style="font-weight:600;margin-bottom:6px">대출 중인 자산이 없습니다</div>
      <button onclick="location.hash='#/asset-mgmt'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">자산 대출 신청</button>
    
      <div style="font-size:13px">자산 목록에서 필요한 장비를 신청하세요</div>
    </div>`;
  return loans.map(l => {
    const st = LOAN_STATUS[l.status] || LOAN_STATUS.pending;
    return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:14px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">${l.assetName}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
          ${l.startDate} ~ ${l.endDate}
        </div>
      </div>
      <span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:10px;
        color:${st.color};background:${st.bg}">${st.label}</span>
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:${l.status==='approved'?'10px':'0'}">
      신청 목적: ${l.purpose}
    </div>
    ${l.status === 'approved' ? `
    <button class="return-btn" data-id="${l.id}"
      style="width:100%;background:#FEE2E2;color:#DC2626;border:none;border-radius:8px;
             padding:8px;font-size:13px;font-weight:600;cursor:pointer">
      반납 신청
    </button>` : ''}
  </div>`;
  }).join('');
}

function _renderLoanForm(root) {
  const user = getUser();
  const today = new Date().toISOString().slice(0, 10);
  const next2w = new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10);

  root.innerHTML = `
<div class="page" style="background:var(--bg)">
  <div class="top-bar">
    <button id="back-btn" class="btn btn-ghost btn-sm" style="padding:8px;min-height:40px">←</button>
    <div class="top-bar-title" style="flex:1;text-align:center">자산 대출 신청</div>
    <div style="min-width:40px"></div>
  </div>

  <div class="page-content" style="padding:16px">

    <div style="background:#EEF2FF;border-radius:12px;padding:12px;margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;color:#4338CA">
        💻 ${_selectedAsset?.name}
      </div>
      <div style="font-size:11px;color:#6366F1;margin-top:3px">이 자산을 대출 신청합니다</div>
    </div>

    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px">
      ${_ff2('loan-start', '대출 시작일', today, 'date')}
      ${_ff2('loan-end',   '반납 예정일', next2w, 'date')}
      <div style="margin-bottom:0">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">사용 목적</label>
        <textarea maxlength="500" id="loan-purpose" placeholder="대출 목적을 입력하세요 (예: 재택근무, 출장 등)"
          style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:10px;
                 font-size:13px;background:var(--bg);color:var(--text);height:80px;resize:none;
                 box-sizing:border-box;font-family:inherit;line-height:1.5"></textarea>
      </div>
    </div>

    <div style="background:#FEF3C7;border-radius:12px;padding:12px;margin-bottom:16px;font-size:12px;color:#92400E;line-height:1.6">
      ⚠️ 자산 대출 유의사항<br>
      • 분실·파손 시 변상 책임이 발생할 수 있습니다<br>
      • 반납 예정일 초과 시 자동 알림이 발송됩니다<br>
      • 승인 후 IT팀에서 자산을 수령하세요
    </div>

    <button id="submit-btn" class="btn btn-primary" style="width:100%">신청하기</button>

  </div>
</div>`;

  root.querySelector('#back-btn').addEventListener('click', () => { _showForm = false; _renderPage(root); });

  root.querySelector('#submit-btn').addEventListener('click', () => {
    const start   = root.querySelector('#loan-start').value;
    const end     = root.querySelector('#loan-end').value;
    const purpose = root.querySelector('#loan-purpose').value.trim();
    if (!purpose) { showToast('사용 목적을 입력하세요.', 'error'); return; }
    if (end < start) { showToast('반납일이 시작일보다 이릅니다.', 'error'); return; }

    const loans = _getLoans();
    loans.push({
      id: 'LN_' + Date.now(),
      userId: user?.id || 'demo',
      userName: user?.name_ko || user?.name || '나',
      assetId: _selectedAsset.id,
      assetName: _selectedAsset.name,
      purpose, startDate: start, endDate: end,
      status: 'pending',
      requestedAt: new Date().toISOString().slice(0, 10),
    });
    _saveLoans(loans);
    addNotification({ type: 'system', title: `자산 대출 신청이 접수되었습니다: ${_selectedAsset.name}`, body: '' });
    showToast('대출 신청이 완료되었습니다. 승인을 기다려주세요.', 'success');
    _showForm = false; _tab = 'my'; _renderPage(root);
  });
}

function _ff2(id, label, value, type) {
  return `<div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">${label}</label>
    <input id="${id}" type="${type}" value="${value}"
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>`;
}
