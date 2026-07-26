/**
 * expense-admin.js — 경비 신청 승인 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_expenses';
const LS_CLAIMS = 'hr_expense_claims';

const LEGACY_RECORDS = new Map([
  ['EXP001', ['김민준', '외부 미팅 교통비']],
  ['EXP002', ['이서연', '고객사 식대']],
  ['EXP003', ['박지호', '출장 숙박비']],
  ['EXP004', ['최지우', '사무용품 구매']],
  ['EXP005', ['강민서', '교육 자료 인쇄비']],
  ['EXP006', ['윤성호', '세미나 참가비']],
  ['EXP007', ['임소연', '거래처 접대비']],
]);

function _normalizeClaim(r) {
  if (r.empName) return {
    ...r,
    status: r.status === 'submitted' ? 'pending' : r.status,
  };
  return {
    id: r.id,
    empName: r.userName || r.userId || '직원',
    dept: r.dept || '-',
    title: r.purpose || r.title || r.category || '-',
    amount: r.totalAmount || r.amount || 0,
    category: r.category || '-',
    status: r.status === 'submitted' ? 'pending' : (r.status || 'pending'),
    date: r.date || r.createdAt?.slice(0,10) || '',
    _raw: r,
  };
}

function _load() {
  const s = localStorage.getItem(LS);
  const parsedAdmin = s ? (() => { try { return JSON.parse(s); } catch { return []; } })() : [];
  const adminListRaw = Array.isArray(parsedAdmin) ? parsedAdmin : [];
  const adminList = adminListRaw.filter(r => {
    const signature = LEGACY_RECORDS.get(r.id);
    return !signature || r.empName !== signature[0] || r.title !== signature[1];
  });
  if (adminList.length !== adminListRaw.length) localStorage.setItem(LS, JSON.stringify(adminList));
  const parsedClaims = (() => { try { return JSON.parse(localStorage.getItem(LS_CLAIMS)||'[]'); } catch { return []; } })();
  const claimRaw = Array.isArray(parsedClaims) ? parsedClaims : [];
  const claims = claimRaw.filter(r => r.status !== 'draft').map(_normalizeClaim);
  return [...adminList,
          ...claims.filter(c => !adminList.find(r => r.id === c.id))];
}

function _updateStatus(id, status) {
  const parsedAdmin = (() => {
    try { return JSON.parse(localStorage.getItem(LS) || '[]'); }
    catch { return []; }
  })();
  const adminList = Array.isArray(parsedAdmin) ? parsedAdmin : [];
  const adminRecord = adminList.find(record => record.id === id);
  if (adminRecord) {
    adminRecord.status = status;
    adminRecord[status === 'approved' ? 'approvedAt' : 'rejectedAt'] =
      new Date().toISOString().slice(0, 10);
    localStorage.setItem(LS, JSON.stringify(adminList));
    return true;
  }

  const parsedClaims = (() => {
    try { return JSON.parse(localStorage.getItem(LS_CLAIMS) || '[]'); }
    catch { return []; }
  })();
  const claims = Array.isArray(parsedClaims) ? parsedClaims : [];
  const claim = claims.find(record => record.id === id);
  if (!claim) return false;
  claim.status = status;
  claim[status === 'approved' ? 'approvedAt' : 'rejectedAt'] =
    new Date().toISOString().slice(0, 10);
  localStorage.setItem(LS_CLAIMS, JSON.stringify(claims));
  return true;
}

let _tab = '대기';
let _root = null;

export function render(root) { _root = root; _tab = '대기'; _draw(); }
export function unmount() { _root = null;
  _tab = '대기';
}

function _draw() {
  const all = _load().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const pending  = all.filter(r => r.status === 'pending');
  const approved = all.filter(r => r.status === 'approved');
  const rejected = all.filter(r => r.status === 'rejected');
  const totalApproved = approved.reduce((s, r) => s + (r.amount || 0), 0);

  const tabs = [['대기', `대기 ${pending.length > 0 ? `<span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending.length}</span>` : ''}`], ['승인', '승인'], ['전체', '전체']];

  _root.innerHTML = `
<div style="padding:0">
  <!-- 탭 -->
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${tabs.map(([k, l]) => `
    <button class="exa-tab" data-tab="${k}"
      style="padding:10px 18px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab === k ? 'var(--primary)' : 'transparent'};
             color:${_tab === k ? 'var(--primary)' : '#94A3B8'}">${l}</button>`).join('')}
  </div>

  <div style="padding:14px 16px">
    <!-- 통계 카드 -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
      ${[
        { l: '대기',  v: pending.length  + '건', c: '#F59E0B' },
        { l: '승인',  v: approved.length + '건', c: '#10B981' },
        { l: '반려',  v: rejected.length + '건', c: '#EF4444' },
      ].map(k => `
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
           padding:12px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:${k.c}">${k.v}</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">${k.l}</div>
      </div>`).join('')}
    </div>

    <!-- 승인 총액 -->
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
         padding:12px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:12px;color:#64748B;font-weight:600">총 승인 금액</span>
      <span style="font-size:16px;font-weight:800;color:#10B981">${totalApproved.toLocaleString()}원</span>
    </div>

    ${_tab === '대기' ? _renderItems(pending, true, false) :
      _tab === '승인' ? _renderItems(approved, false, false) :
      _renderItems(all, false, false)}
  </div>
</div>`;

  _root.querySelectorAll('.exa-tab').forEach(b =>
    b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderItems(list, showActions) {
  if (!list.length) return `
  <div style="text-align:center;padding:40px 20px;color:#94A3B8">
    <div style="font-size:36px;margin-bottom:8px">📋</div>
    <div style="font-size:13px;font-weight:600">해당 항목이 없습니다</div>
  </div>`;

  const statusMeta = {
    pending:  { label: '대기중', bg: '#FEF3C7', color: '#D97706' },
    approved: { label: '승인',   bg: '#D1FAE5', color: '#059669' },
    rejected: { label: '반려',   bg: '#FEE2E2', color: '#EF4444' },
  };

  return list.map(r => {
    const st = statusMeta[r.status] || statusMeta.pending;
    return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:14px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${r.title}</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">${r.empName} · ${r.dept} · ${r.date}</div>
        <div style="font-size:11px;color:#94A3B8;margin-top:1px">${r.category}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:14px;font-weight:800;color:var(--text)">${(r.amount||0).toLocaleString()}원</div>
        <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:8px;
          color:${st.color};background:${st.bg}">${st.label}</span>
      </div>
    </div>
    ${showActions && r.status === 'pending' ? `
    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="exa-approve" data-id="${r.id}"
        style="flex:1;background:#D1FAE5;color:#065F46;border:none;border-radius:8px;
               padding:8px;font-size:12px;font-weight:600;cursor:pointer">✅ 승인</button>
      <button class="exa-reject" data-id="${r.id}"
        style="flex:1;background:#FEE2E2;color:#DC2626;border:none;border-radius:8px;
               padding:8px;font-size:12px;font-weight:600;cursor:pointer">❌ 반려</button>
    </div>` : ''}
  </div>`;
  }).join('');
}

function _bindEvents() {
  if (!_root) return;

  _root.querySelectorAll('.exa-approve').forEach(btn =>
    btn.addEventListener('click', () => {
      const list = _load();
      const idx  = list.findIndex(r => r.id === btn.dataset.id);
      if (idx < 0 || !_updateStatus(list[idx].id, 'approved')) return;
      showToast('승인되었습니다.', 'success');
      addNotification({ type: 'success', title: 'Expense (관리자)', body: '승인되었습니다.' });
      _draw();
    }));

  _root.querySelectorAll('.exa-reject').forEach(btn =>
    btn.addEventListener('click', () => {
      const list = _load();
      const idx  = list.findIndex(r => r.id === btn.dataset.id);
      if (idx < 0 || !_updateStatus(list[idx].id, 'rejected')) return;
      showToast('반려되었습니다.', 'info');
      _draw();
    }));
}
export function mount(root) { return render(root); }
