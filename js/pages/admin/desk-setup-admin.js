/**
 * desk-setup-admin.js — 책상 세팅 신청 관리 (관리자)
 */
import { showToast } from '../../components/toast.js'
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_desk_setups';

const STATUS_META = {
  pending:   { label: '대기',   color: '#F59E0B', bg: '#FEF3C7' },
  approved:  { label: '승인',   color: '#10B981', bg: '#ECFDF5' },
  delivered: { label: '배송완료', color: '#3B82F6', bg: '#EFF6FF' },
};

const ITEM_LABELS = {
  monitor:  { label: '모니터',   icon: '🖥️' },
  keyboard: { label: '키보드',   icon: '⌨️' },
  mouse:    { label: '마우스',   icon: '🖱️' },
  chair:    { label: '의자',     icon: '🪑' },
  desk:     { label: '책상',     icon: '🪵' },
  headset:  { label: '헤드셋',   icon: '🎧' },
  webcam:   { label: '웹캠',     icon: '📷' },
};

const LEGACY_DS_IDS = new Set(['DS001','DS002','DS003','DS004','DS005','DS006','DS007','DS008']);

function _getAll() {
  const s = localStorage.getItem(LS);
  if (!s) return [];
  try {
    const d = JSON.parse(s);
    const cleaned = d.filter(r => !LEGACY_DS_IDS.has(r.id));
    if (cleaned.length < d.length) localStorage.setItem(LS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}
function _saveAll(l) { localStorage.setItem(LS, JSON.stringify(l)); }

let _tab  = 'requests';
let _root = null;

export function render(root) { _root = root; _tab = 'requests'; _draw(); }
export function unmount() { _root = null;
  _tab = 'requests';
}

function _draw() {
  const all = _getAll();
  const pending   = all.filter(r => r.status === 'pending').length;
  const approved  = all.filter(r => r.status === 'approved').length;
  const delivered = all.filter(r => r.status === 'delivered').length;

  // 품목별 통계
  const itemStats = {};
  Object.keys(ITEM_LABELS).forEach(k => { itemStats[k] = 0; });
  all.forEach(r => { if (itemStats[r.itemType] !== undefined) itemStats[r.itemType]++; });
  const maxCount = Math.max(...Object.values(itemStats), 1);

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[
      ['requests', `신청 현황${pending ? ` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending}</span>` : ''}`],
      ['stats',    '품목별 통계'],
    ].map(([k, l]) => `
    <button class="dsa-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;white-space:nowrap;border-bottom:2px solid ${_tab === k ? 'var(--primary)' : 'transparent'};color:${_tab === k ? 'var(--primary)' : '#94A3B8'}">${l}</button>`).join('')}
  </div>

  <div style="padding:14px 16px">
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
      ${[['대기', pending, '#F59E0B'], ['승인', approved, '#10B981'], ['배송완료', delivered, '#3B82F6']].map(([l, v, c]) => `
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:${c}">${v}건</div>
        <div style="font-size:10px;color:#94A3B8">${l}</div>
      </div>`).join('')}
    </div>

    ${_tab === 'requests' ? _renderRequests(all) : _renderStats(itemStats, maxCount)}
  </div>
</div>`;

  _bindEvents();
}

function _renderRequests(all) {
  const list = [...all].sort((a, b) => b.reqDate.localeCompare(a.reqDate));
  if (!list.length) return `
    <div style="text-align:center;padding:48px 16px;color:#94A3B8">
      <div style="font-size:36px;margin-bottom:10px">🖥️</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:4px">신청 내역이 없습니다</div>
      <div style="font-size:12px">책상 세팅 신청이 아직 없습니다.</div>
    </div>`;
  return list.map(r => {
    const meta = STATUS_META[r.status] || STATUS_META.pending;
    const item = ITEM_LABELS[r.itemType] || { label: r.itemType, icon: '📦' };
    return `
<div style="background:var(--card-bg);border:1px solid ${r.status === 'pending' ? '#FCD34D' : 'var(--border)'};border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div>
      <div style="font-size:14px;font-weight:700;color:var(--text)">${r.empName} <span style="font-size:11px;font-weight:400;color:#94A3B8">${r.dept}</span></div>
      <div style="font-size:12px;color:#64748B;margin-top:2px">신청일: ${r.reqDate}</div>
    </div>
    <span style="background:${meta.bg};color:${meta.color};border-radius:99px;font-size:11px;font-weight:600;padding:3px 10px">${meta.label}</span>
  </div>
  <div style="background:var(--bg);border-radius:10px;padding:10px;font-size:12px;color:#64748B;margin-bottom:10px">
    ${item.icon} <strong>${item.label}</strong> — ${r.itemName}
  </div>
  ${r.status === 'pending' ? `
  <button class="dsa-approve" data-id="${r.id}" style="width:100%;padding:9px;background:#ECFDF5;color:#10B981;border:1px solid #10B981;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer">✓ 승인</button>
  ` : r.status === 'approved' ? `
  <button class="dsa-deliver" data-id="${r.id}" style="width:100%;padding:9px;background:#EFF6FF;color:#3B82F6;border:1px solid #3B82F6;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer">🚚 배송완료 처리</button>
  ` : ''}
</div>`;
  }).join('');
}

function _renderStats(itemStats, maxCount) {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:14px">품목별 신청 현황</div>
  ${Object.entries(ITEM_LABELS).map(([k, { label, icon }]) => {
    const count = itemStats[k] || 0;
    const pct = Math.round((count / maxCount) * 100);
    return `
  <div style="margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
      <span>${icon} ${label}</span>
      <span style="font-weight:700;color:var(--primary)">${count}건</span>
    </div>
    <div style="background:var(--border);border-radius:99px;height:8px;overflow:hidden">
      <div style="background:var(--primary);height:100%;border-radius:99px;width:${pct}%;transition:width 0.4s ease"></div>
    </div>
  </div>`;
  }).join('')}
</div>`;
}

function _bindEvents() {
  if (!_root) return;

  _root.querySelectorAll('.dsa-tab').forEach(b => {
    b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(); });
  });

  _root.querySelectorAll('.dsa-approve').forEach(b => {
    b.addEventListener('click', () => {
      const all = _getAll();
      const idx = all.findIndex(r => r.id === b.dataset.id);
      if (idx < 0) return;
      all[idx].status = 'approved';
      _saveAll(all);
      showToast('신청이 승인되었습니다.');
      addNotification({ type: 'success', title: '자리 설정 관리', body: '신청이 승인되었습니다.' });
      _draw();
    });
  });

  _root.querySelectorAll('.dsa-deliver').forEach(b => {
    b.addEventListener('click', () => {
      const all = _getAll();
      const idx = all.findIndex(r => r.id === b.dataset.id);
      if (idx < 0) return;
      all[idx].status = 'delivered';
      _saveAll(all);
      showToast('배송완료로 처리되었습니다.');
      addNotification({ type: 'success', title: '자리 설정 관리', body: '배송완료로 처리되었습니다.' });
      _draw();
    });
  });
}
export function mount(root) { return render(root); }
