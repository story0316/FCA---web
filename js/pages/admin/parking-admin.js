/**
 * parking-admin.js — 주차 신청 승인 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_parking_requests';

const LEGACY_PKR_IDS = new Set(['PKR001','PKR002','PKR003','PKR004','PKR005','PKR006']);

const TYPE_META = {
  '월정기권': { label: '월정기권', color: '#4F46E5', bg: '#EEF2FF' },
  '일일권':   { label: '일일권',   color: '#0891B2', bg: '#ECFEFF' },
};

function _load() {
  const s = localStorage.getItem(LS);
  if (!s) return [];
  try {
    const d = JSON.parse(s);
    const cleaned = d.filter(r => !LEGACY_PKR_IDS.has(r.id));
    if (cleaned.length < d.length) localStorage.setItem(LS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}

function _save(list) { localStorage.setItem(LS, JSON.stringify(list)); }

let _tab = '대기';
let _root = null;

export function render(root) { _root = root; _tab = '대기'; _draw(); }
export function unmount() { _root = null;
  _tab = '대기';
}

function _draw() {
  const all = _load().sort((a, b) => (b.requestedAt || '').localeCompare(a.requestedAt || ''));
  const pending  = all.filter(r => r.status === 'pending');
  const approved = all.filter(r => r.status === 'approved');
  const rejected = all.filter(r => r.status === 'rejected');

  _root.innerHTML = `
<div style="padding:0">
  <!-- 탭 -->
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[
      ['대기', `대기${pending.length ? ` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending.length}</span>` : ''}`],
      ['승인', '승인'],
      ['전체', '전체'],
    ].map(([k, l]) => `
    <button class="pka-tab" data-tab="${k}"
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

    ${_tab === '대기' ? _renderItems(pending, true) :
      _tab === '승인' ? _renderItems(approved, false) :
      _renderItems(all, false)}
  </div>
</div>`;

  _root.querySelectorAll('.pka-tab').forEach(b =>
    b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderItems(list, showActions) {
  if (!list.length) return `
  <div style="text-align:center;padding:40px 20px;color:#94A3B8">
    <div style="font-size:36px;margin-bottom:8px">🚗</div>
    <div style="font-size:13px;font-weight:600">해당 신청이 없습니다</div>
  </div>`;

  const statusMeta = {
    pending:  { label: '대기중', bg: '#FEF3C7', color: '#D97706' },
    approved: { label: '승인',   bg: '#D1FAE5', color: '#059669' },
    rejected: { label: '반려',   bg: '#FEE2E2', color: '#EF4444' },
  };

  return list.map(r => {
    const st = statusMeta[r.status] || statusMeta.pending;
    const tp = TYPE_META[r.type] || TYPE_META['월정기권'];
    return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:14px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${r.empName}
          <span style="font-size:11px;color:#64748B;font-weight:400"> · ${r.dept}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
          <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:8px;
            color:${tp.color};background:${tp.bg}">${tp.label}</span>
          <span style="font-size:12px;font-weight:700;color:var(--text)">🚗 ${r.carNo}</span>
        </div>
        <div style="font-size:11px;color:#94A3B8;margin-top:4px">기간: ${r.period}</div>
        <div style="font-size:11px;color:#94A3B8;margin-top:1px">신청일: ${r.requestedAt}</div>
      </div>
      <span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:10px;
        color:${st.color};background:${st.bg};flex-shrink:0">${st.label}</span>
    </div>
    ${showActions && r.status === 'pending' ? `
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="pka-approve" data-id="${r.id}"
        style="flex:1;background:#D1FAE5;color:#065F46;border:none;border-radius:8px;
               padding:8px;font-size:12px;font-weight:600;cursor:pointer">✅ 승인</button>
      <button class="pka-reject" data-id="${r.id}"
        style="flex:1;background:#FEE2E2;color:#DC2626;border:none;border-radius:8px;
               padding:8px;font-size:12px;font-weight:600;cursor:pointer">❌ 반려</button>
    </div>` : ''}
  </div>`;
  }).join('');
}

function _bindEvents() {
  if (!_root) return;

  _root.querySelectorAll('.pka-approve').forEach(btn =>
    btn.addEventListener('click', () => {
      const list = _load();
      const idx  = list.findIndex(r => r.id === btn.dataset.id);
      if (idx >= 0) { list[idx].status = 'approved'; list[idx].approvedAt = new Date().toISOString().slice(0,10); _save(list); }
      showToast('주차 신청이 승인되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Parking (관리자)', body: '주차 신청이 승인되었습니다.' });
      _draw();
    }));

  _root.querySelectorAll('.pka-reject').forEach(btn =>
    btn.addEventListener('click', () => {
      const list = _load();
      const idx  = list.findIndex(r => r.id === btn.dataset.id);
      if (idx >= 0) { list[idx].status = 'rejected'; list[idx].rejectedAt = new Date().toISOString().slice(0,10); _save(list); }
      showToast('반려되었습니다.', 'info');
      _draw();
    }));
}
export function mount(root) { return render(root); }
