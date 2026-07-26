/**
 * uniform-admin.js — 유니폼 신청 승인 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_uniform_requests';

const LEGACY_UNI_IDS = new Set(['UNI001','UNI002','UNI003','UNI004','UNI005','UNI006','UNI007']);

function _load() {
  const s = localStorage.getItem(LS);
  if (!s) return [];
  try {
    const d = JSON.parse(s);
    const cleaned = d.filter(r => !LEGACY_UNI_IDS.has(r.id));
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
  if (!_root) return;
  const all       = _load().sort((a, b) => (b.requestedAt || '').localeCompare(a.requestedAt || ''));
  const pending   = all.filter(r => r.status === 'pending');
  const approved  = all.filter(r => r.status === 'approved');
  const delivered = all.filter(r => r.status === 'delivered');
  const rejected  = all.filter(r => r.status === 'rejected');

  const tabList = [
    ['대기', `대기${pending.length ? ` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending.length}</span>` : ''}`],
    ['승인', '승인'],
    ['전체', '전체'],
  ];

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${tabList.map(([k, l]) => `
    <button class="una-tab" data-tab="${k}"
      style="padding:10px 18px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab === k ? 'var(--primary)' : 'transparent'};
             color:${_tab === k ? 'var(--primary)' : '#94A3B8'}">${l}</button>`).join('')}
  </div>

  <div style="padding:14px 16px">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
      ${[
        { l: '대기',    v: pending.length   + '건', c: '#F59E0B' },
        { l: '승인',    v: approved.length  + '건', c: '#10B981' },
        { l: '배송완료', v: delivered.length + '건', c: '#8B5CF6' },
      ].map(k => `
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
           padding:12px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:${k.c}">${k.v}</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">${k.l}</div>
      </div>`).join('')}
    </div>

    ${_tab === '대기' ? _renderItems(pending, 'pending') :
      _tab === '승인' ? _renderItems([...approved, ...delivered], 'approved') :
      _renderItems(all, 'all')}
  </div>
</div>`;

  _bindEvents();
}

function _renderItems(list, mode) {
  if (!list.length) return `
  <div style="text-align:center;padding:48px 20px;color:#94A3B8">
    <div style="font-size:40px;margin-bottom:10px">👔</div>
    <div style="font-size:14px;font-weight:600;margin-bottom:4px">해당 신청이 없습니다</div>
    <div style="font-size:12px">유니폼 신청 내역이 없어요</div>
  </div>`;

  const statusMeta = {
    pending:   { label: '대기중',   bg: '#FEF3C7', color: '#D97706' },
    approved:  { label: '승인',     bg: '#D1FAE5', color: '#059669' },
    rejected:  { label: '반려',     bg: '#FEE2E2', color: '#EF4444' },
    delivered: { label: '배송완료', bg: '#EDE9FE', color: '#7C3AED' },
  };

  return list.map(r => {
    const st = statusMeta[r.status] || statusMeta.pending;
    return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:14px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--text)">👔 ${r.type} · ${r.size} · ${r.qty}벌</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">${r.empName} · ${r.dept}</div>
      </div>
      <span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:10px;
        color:${st.color};background:${st.bg};flex-shrink:0;margin-left:8px">${st.label}</span>
    </div>
    <div style="font-size:11px;color:#94A3B8;margin-bottom:4px">사유: ${r.reason}</div>
    <div style="font-size:11px;color:#94A3B8;margin-bottom:8px">신청일: ${r.requestedAt}</div>
    ${r.status === 'pending' ? `
    <div style="display:flex;gap:8px">
      <button class="una-approve" data-id="${r.id}"
        style="flex:1;background:#D1FAE5;color:#065F46;border:none;border-radius:8px;
               padding:8px;font-size:12px;font-weight:600;cursor:pointer">✅ 승인</button>
      <button class="una-reject" data-id="${r.id}"
        style="flex:1;background:#FEE2E2;color:#DC2626;border:none;border-radius:8px;
               padding:8px;font-size:12px;font-weight:600;cursor:pointer">❌ 반려</button>
    </div>` : ''}
    ${r.status === 'approved' ? `
    <div style="margin-top:4px">
      <button class="una-deliver" data-id="${r.id}"
        style="width:100%;background:#EDE9FE;color:#5B21B6;border:none;border-radius:8px;
               padding:8px;font-size:12px;font-weight:600;cursor:pointer">🚚 배송 완료 처리</button>
    </div>` : ''}
  </div>`;
  }).join('');
}

function _bindEvents() {
  if (!_root) return;

  _root.querySelectorAll('.una-tab').forEach(b =>
    b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(); }));

  _root.querySelectorAll('.una-approve').forEach(btn =>
    btn.addEventListener('click', () => {
      const list = _load();
      const idx  = list.findIndex(r => r.id === btn.dataset.id);
      if (idx >= 0) { list[idx].status = 'approved'; list[idx].approvedAt = new Date().toISOString().slice(0,10); _save(list); }
      showToast('유니폼 신청이 승인되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Uniform (관리자)', body: '유니폼 신청이 승인되었습니다.' });
      _draw();
    }));

  _root.querySelectorAll('.una-reject').forEach(btn =>
    btn.addEventListener('click', () => {
      const list = _load();
      const idx  = list.findIndex(r => r.id === btn.dataset.id);
      if (idx >= 0) { list[idx].status = 'rejected'; list[idx].rejectedAt = new Date().toISOString().slice(0,10); _save(list); }
      showToast('반려되었습니다.', 'info');
      _draw();
    }));

  _root.querySelectorAll('.una-deliver').forEach(btn =>
    btn.addEventListener('click', () => {
      const list = _load();
      const idx  = list.findIndex(r => r.id === btn.dataset.id);
      if (idx >= 0) { list[idx].status = 'delivered'; list[idx].deliveredAt = new Date().toISOString().slice(0,10); _save(list); }
      showToast('배송 완료 처리되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Uniform (관리자)', body: '배송 완료 처리되었습니다.' });
      _draw();
    }));
}
export function mount(root) { return render(root); }
