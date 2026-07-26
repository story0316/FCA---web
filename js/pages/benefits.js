/**
 * benefits.js — 복리후생 안내 + 경비 신청 (#/benefits)
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { BENEFITS, BENEFIT_CATEGORIES, CLAIM_TYPES } from '../data/benefits-catalog.js';
import { addNotification } from '../components/notification-hub.js';

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId() {
  const s = _session();
  return s.empId || s.userId || s.id || 'EMP001';
}

const LS_CLAIMS = 'hr_expense_claims';
const DEMO_USER = 'demo';

let _activeCategory = 'all';
let _showForm       = false;
let _claimType      = 'condolence';

function _getClaims(userId) {
  return JSON.parse(localStorage.getItem(LS_CLAIMS) || '[]')
    .filter(c => c.userId === userId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

function _saveClaim(claim) {
  const all = JSON.parse(localStorage.getItem(LS_CLAIMS) || '[]');
  all.push(claim);
  localStorage.setItem(LS_CLAIMS, JSON.stringify(all));
}

function _usedThisYear(userId, claimType) {
  const y = new Date().getFullYear();
  return JSON.parse(localStorage.getItem(LS_CLAIMS) || '[]')
    .filter(c => c.userId === userId && c.type === claimType &&
                 c.submittedAt.startsWith(String(y)) && c.status !== 'rejected')
    .reduce((s, c) => s + c.amount, 0);
}

export function render(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  const user   = JSON.parse(localStorage.getItem('hr_user') || '{}');
  const userId = _empId();
  const claims = _getClaims(userId);

  const filtered = _activeCategory === 'all'
    ? BENEFITS
    : BENEFITS.filter(b => b.category === _activeCategory);

  root.innerHTML = `
<div class="page" id="benefits-page">
  <header class="top-bar">
    <button class="btn-icon back-btn">&#8592;</button>
    <h1 class="page-title">복리후생</h1>
    <button class="btn-claim-open btn-sm-primary" id="open-claim-btn">+ 신청</button>
  </header>

  <div class="page-content">

    <!-- 카테고리 필터 -->
    <div class="category-bar">
      <button class="cat-btn ${_activeCategory==='all'?'active':''}" data-cat="all">전체</button>
      ${BENEFIT_CATEGORIES.map(c => `
        <button class="cat-btn ${_activeCategory===c.id?'active':''}" data-cat="${c.id}">
          ${c.icon} ${c.label}
        </button>`).join('')}
    </div>

    <!-- 혜택 목록 -->
    <div class="benefits-list">
      ${filtered.length === 0
        ? `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
            <div style="font-size:40px;margin-bottom:12px">🎁</div>
            <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:6px">해당 카테고리에 혜택이 없습니다</div>
            <div style="font-size:12px">다른 카테고리를 선택해보세요</div>
           </div>`
        : filtered.map(b => _renderBenefitCard(b)).join('')}
    </div>

    <!-- 신청 내역 -->
    ${claims.length ? `
    <div class="claims-section">
      <div class="section-title">내 신청 내역</div>
      ${claims.slice(0, 5).map(c => _renderClaimRow(c)).join('')}
    </div>` : ''}

  </div>
</div>

<!-- 신청 바텀시트 -->
${_showForm ? _renderClaimSheet(userId) : ''}
${_styles()}`;

  _bindEvents(root, userId);
}

function _renderBenefitCard(b) {
  return `
<div class="benefit-card">
  <div class="bc-left">
    <span class="bc-icon" style="background:${b.color}18;color:${b.color}">${b.icon}</span>
  </div>
  <div class="bc-body">
    <div class="bc-label">${b.label}</div>
    <div class="bc-desc">${b.desc}</div>
    <div class="bc-detail">${b.detail}</div>
    ${b.amount ? `<div class="bc-amount">${b.amount.toLocaleString()}원</div>` : ''}
  </div>
  ${b.claimable ? `<button class="btn-quick-claim" data-type="${b.claimType}">신청</button>` : ''}
</div>`;
}

function _renderClaimRow(c) {
  const type   = CLAIM_TYPES[c.type] || { label: c.type, icon: '📋' };
  const status = { pending:{ label:'검토 중',color:'#F59E0B',bg:'#FEF3C7' }, approved:{ label:'승인',color:'#059669',bg:'#D1FAE5' }, rejected:{ label:'반려',color:'#DC2626',bg:'#FEE2E2' } }[c.status] || { label:c.status,color:'var(--text-muted)',bg:'#F1F5F9' };
  return `
<div class="claim-row">
  <span>${type.icon} ${type.label}</span>
  <span>${c.amount.toLocaleString()}원</span>
  <span class="cr-desc">${c.description}</span>
  <span class="cr-badge" style="color:${status.color};background:${status.bg}">${status.label}</span>
</div>`;
}

function _renderClaimSheet(userId) {
  const maxAmt = CLAIM_TYPES[_claimType]?.maxAmount || 300_000;
  const used   = _usedThisYear(userId, _claimType);
  const remain = Math.max(0, maxAmt - used);

  return `
<div class="bottom-sheet-overlay" id="claim-overlay">
  <div class="bottom-sheet" id="claim-sheet">
    <div class="bs-handle"></div>
    <div class="bs-title">경비 신청</div>
    <form id="claim-form">
      <label class="form-label">신청 유형</label>
      <div class="claim-type-row">
        ${Object.entries(CLAIM_TYPES).map(([k, v]) => `
          <button type="button" class="ct-btn${_claimType===k?' selected':''}" data-ct="${k}">
            ${v.icon} ${v.label}
          </button>`).join('')}
      </div>
      <div class="remain-banner">
        올해 잔여 한도 <strong>${remain.toLocaleString()}원</strong> / ${maxAmt.toLocaleString()}원
      </div>
      <label class="form-label">금액 <span class="req">*</span></label>
      <input type="number" id="claim-amount" class="form-input" placeholder="금액 (원)" min="1" max="${remain}" required>
      <label class="form-label" style="margin-top:10px">내용 <span class="req">*</span></label>
      <input type="text" id="claim-desc" class="form-input" placeholder="예: 도서 구매, 부친상" required>
      <label class="form-label" style="margin-top:10px">날짜</label>
      <input type="date" id="claim-date" class="form-input" value="${new Date().toISOString().slice(0,10)}">
      <button type="submit" class="submit-btn" style="margin-top:16px">신청하기</button>
    </form>
  </div>
</div>`;
}

function _bindEvents(root, userId) {
  root.querySelector('.back-btn').addEventListener('click', () => window.navBack());

  root.querySelector('.category-bar').addEventListener('click', e => {
    const btn = e.target.closest('.cat-btn');
    if (!btn) return;
    _activeCategory = btn.dataset.cat;
    render(root);
  });

  root.querySelector('#open-claim-btn')?.addEventListener('click', () => {
    _showForm = true; render(root);
  });

  root.addEventListener('click', e => {
    const qb = e.target.closest('.btn-quick-claim');
    if (qb) { _claimType = qb.dataset.type; _showForm = true; render(root); }
  });

  const overlay = document.getElementById('claim-overlay');
  if (overlay) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) { _showForm = false; render(root); }
    });

    document.querySelectorAll('.ct-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _claimType = btn.dataset.ct; render(root);
      });
    });

    document.getElementById('claim-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const amount = parseInt(document.getElementById('claim-amount').value, 10);
      const desc   = document.getElementById('claim-desc').value.trim();
      const date   = document.getElementById('claim-date').value;
      const max    = CLAIM_TYPES[_claimType]?.maxAmount || 300_000;
      const used   = _usedThisYear(userId, _claimType);

      if (!amount || amount <= 0)               { showToast('금액을 입력해 주세요.', 'error'); return; }
      if (amount > max - used)                  { showToast(`잔여 한도(${(max-used).toLocaleString()}원)를 초과합니다.`, 'error'); return; }
      if (!desc)                                { showToast('내용을 입력해 주세요.', 'error'); return; }

      _saveClaim({ id:'EXP'+Date.now(), userId, type:_claimType, amount, description:desc, date, status:'pending', submittedAt:new Date().toISOString() });
      _showForm = false;
      showToast('경비 신청이 접수되었습니다. ✅', 'success')
    addNotification({ type: 'success', title: '복리후생', body: '경비 신청이 접수되었습니다. ✅' });
      render(root);
    });
  }
}

function _styles() {
  return `<style>
#benefits-page .top-bar { display:flex;align-items:center;padding:12px 16px;gap:10px;background:var(--bg);border-bottom:1px solid var(--border);flex-shrink:0; }
#benefits-page .page-title { flex:1;font-size:18px;font-weight:700;margin:0; }
.btn-sm-primary { background:#4F46E5;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer; }

.category-bar { display:flex;gap:6px;padding:12px 16px 8px;overflow-x:auto;scrollbar-width:none; }
.category-bar::-webkit-scrollbar{display:none}
.cat-btn { flex-shrink:0;background:var(--card-bg);border:1.5px solid var(--border);border-radius:20px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;color:var(--text); }
.cat-btn.active { background:#4F46E5;border-color:#4F46E5;color:#fff; }

.benefits-list { padding:0 16px;display:flex;flex-direction:column;gap:10px;margin-bottom:8px; }
.benefit-card { display:flex;gap:12px;align-items:flex-start;background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px; }
.bc-left { flex-shrink:0; }
.bc-icon { width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px; }
.bc-body { flex:1;min-width:0; }
.bc-label  { font-size:14px;font-weight:700;margin-bottom:3px; }
.bc-desc   { font-size:12px;color:var(--text-secondary); }
.bc-detail { font-size:11px;color:var(--text-muted);margin-top:3px;line-height:1.5; }
.bc-amount { margin-top:6px;font-size:14px;font-weight:800;color:#4F46E5; }
.btn-quick-claim { flex-shrink:0;background:#EEF2FF;color:#4338CA;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;align-self:center; }

.claims-section { padding:8px 16px 100px; }
.section-title { font-size:15px;font-weight:700;margin-bottom:10px; }
.claim-row { display:grid;grid-template-columns:auto auto 1fr auto;gap:8px;align-items:center;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:6px;font-size:13px; }
.cr-desc { color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.cr-badge { font-size:11px;padding:3px 8px;border-radius:20px;font-weight:600;white-space:nowrap; }

.bottom-sheet-overlay { position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:flex-end; }
.bottom-sheet { background:var(--bg);border-radius:20px 20px 0 0;padding:16px 20px 40px;width:100%;max-height:90vh;overflow-y:auto; }
.bs-handle { width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 16px; }
.bs-title { font-size:17px;font-weight:800;margin-bottom:16px; }
.claim-type-row { display:flex;gap:8px;margin-bottom:12px; }
.ct-btn { flex:1;background:var(--card-bg);border:2px solid var(--border);border-radius:10px;padding:9px 6px;font-size:12px;font-weight:600;cursor:pointer; }
.ct-btn.selected { border-color:#4F46E5;background:#EEF2FF;color:#4338CA; }
.remain-banner { background:#F0FDF4;color:#059669;border-radius:8px;padding:8px 12px;font-size:13px;margin-bottom:12px; }
.remain-banner strong { font-size:16px; }
.form-label { display:block;font-size:13px;font-weight:600;margin-bottom:6px; }
.req { color:#EF4444; }
.form-input { width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;background:var(--card-bg);color:var(--text);box-sizing:border-box; }
.form-input:focus { outline:none;border-color:#4F46E5; }
.submit-btn { display:block;width:100%;background:#4F46E5;color:#fff;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer; }
</style>`;
}

export function unmount() {
  _showForm = false;
  _activeCategory = 'all';
}
