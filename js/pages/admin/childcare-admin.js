/**
 * childcare-admin.js — 보육 지원 신청 승인 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_childcare';

const LEGACY_CC_IDS = new Set(['CC001','CC002','CC003','CC004','CC005','CC006']);

const CARE_TYPE_META = {
  daycare:    { label: '어린이집', icon: '🏫' },
  babysitter: { label: '베이비시터', icon: '👶' },
  afterschool:{ label: '방과후 돌봄', icon: '📚' },
  kindergarten:{ label: '유치원', icon: '🎒' },
};

function _load() {
  const s = localStorage.getItem(LS);
  if (!s) return [];
  try {
    const d = JSON.parse(s);
    const cleaned = d.filter(r => !LEGACY_CC_IDS.has(r.id));
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
  const all      = _load().sort((a, b) => (b.requestedAt || '').localeCompare(a.requestedAt || ''));
  const pending  = all.filter(r => r.status === 'pending');
  const approved = all.filter(r => r.status === 'approved');
  const rejected = all.filter(r => r.status === 'rejected');

  const tabList = [
    ['대기', `대기${pending.length ? ` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending.length}</span>` : ''}`],
    ['승인', '승인'],
    ['전체', '전체'],
  ];

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${tabList.map(([k, l]) => `
    <button class="cca-tab" data-tab="${k}"
      style="padding:10px 18px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab === k ? 'var(--primary)' : 'transparent'};
             color:${_tab === k ? 'var(--primary)' : '#94A3B8'}">${l}</button>`).join('')}
  </div>

  <div style="padding:14px 16px">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
      ${[
        { l: '대기', v: pending.length  + '건', c: '#F59E0B' },
        { l: '승인', v: approved.length + '건', c: '#10B981' },
        { l: '반려', v: rejected.length + '건', c: '#EF4444' },
      ].map(k => `
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
           padding:12px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:${k.c}">${k.v}</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">${k.l}</div>
      </div>`).join('')}
    </div>

    ${_tab === '대기' ? _renderItems(pending) :
      _tab === '승인' ? _renderItems(approved) :
      _renderItems(all)}
  </div>
</div>`;

  _bindEvents();
}

function _renderItems(list) {
  if (!list.length) return `
  <div style="text-align:center;padding:48px 20px;color:#94A3B8">
    <div style="font-size:40px;margin-bottom:10px">🧒</div>
    <div style="font-size:14px;font-weight:600;margin-bottom:4px">해당 신청이 없습니다</div>
    <div style="font-size:12px">보육 지원 신청 내역이 없어요</div>
  </div>`;

  const statusMeta = {
    pending:  { label: '대기중', bg: '#FEF3C7', color: '#D97706' },
    approved: { label: '승인',   bg: '#D1FAE5', color: '#059669' },
    rejected: { label: '반려',   bg: '#FEE2E2', color: '#EF4444' },
  };

  return list.map(r => {
    const st   = statusMeta[r.status] || statusMeta.pending;
    const care = CARE_TYPE_META[r.careType] || { label: r.careType, icon: '👶' };
    return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:14px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--text)">${care.icon} ${care.label}</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">${r.empName} · ${r.dept}</div>
      </div>
      <span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:10px;
        color:${st.color};background:${st.bg};flex-shrink:0;margin-left:8px">${st.label}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:8px;font-size:11px;color:#64748B">
      <div>아이 이름: <span style="font-weight:600;color:var(--text)">${r.childName}</span></div>
      <div>나이: <span style="font-weight:600;color:var(--text)">${r.childAge}세</span></div>
      <div>월 이용료: <span style="font-weight:600;color:#3B82F6">${r.monthlyFee.toLocaleString()}원</span></div>
      <div>시작일: <span style="color:var(--text)">${r.startDate}</span></div>
    </div>
    <div style="font-size:11px;color:#94A3B8;margin-bottom:8px">신청일: ${r.requestedAt}</div>
    ${r.status === 'pending' ? `
    <div style="display:flex;gap:8px">
      <button class="cca-approve" data-id="${r.id}"
        style="flex:1;background:#D1FAE5;color:#065F46;border:none;border-radius:8px;
               padding:8px;font-size:12px;font-weight:600;cursor:pointer">✅ 승인</button>
      <button class="cca-reject" data-id="${r.id}"
        style="flex:1;background:#FEE2E2;color:#DC2626;border:none;border-radius:8px;
               padding:8px;font-size:12px;font-weight:600;cursor:pointer">❌ 반려</button>
    </div>` : ''}
  </div>`;
  }).join('');
}

function _bindEvents() {
  if (!_root) return;

  _root.querySelectorAll('.cca-tab').forEach(b =>
    b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(); }));

  _root.querySelectorAll('.cca-approve').forEach(btn =>
    btn.addEventListener('click', () => {
      const list = _load();
      const idx  = list.findIndex(r => r.id === btn.dataset.id);
      if (idx >= 0) { list[idx].status = 'approved'; list[idx].approvedAt = new Date().toISOString().slice(0,10); _save(list); }
      showToast('보육 지원 신청이 승인되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Childcare (관리자)', body: '보육 지원 신청이 승인되었습니다.' });
      _draw();
    }));

  _root.querySelectorAll('.cca-reject').forEach(btn =>
    btn.addEventListener('click', () => {
      const list = _load();
      const idx  = list.findIndex(r => r.id === btn.dataset.id);
      if (idx >= 0) { list[idx].status = 'rejected'; list[idx].rejectedAt = new Date().toISOString().slice(0,10); _save(list); }
      showToast('반려되었습니다.', 'info');
      _draw();
    }));
}
export function mount(root) { return render(root); }
