/**
 * team-lunch-admin.js — 팀 점심 식사 관리 (관리자)
 */
import { showToast } from '../../components/toast.js'
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_team_lunches';

const STATUS_META = {
  pending:  { label: '대기',   color: '#F59E0B', bg: '#FEF3C7' },
  approved: { label: '승인',   color: '#10B981', bg: '#ECFDF5' },
  rejected: { label: '반려',   color: '#EF4444', bg: '#FEF2F2' },
};

const LEGACY_TL_IDS = new Set(['TL001','TL002','TL003','TL004','TL005']);

function _getAll() {
  const s = localStorage.getItem(LS);
  if (!s) return [];
  try {
    const d = JSON.parse(s);
    const cleaned = d.filter(r => !LEGACY_TL_IDS.has(r.id));
    if (cleaned.length < d.length) localStorage.setItem(LS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}
function _saveAll(l) { localStorage.setItem(LS, JSON.stringify(l)); }

let _tab  = 'pending';
let _root = null;

export function render(root) { _root = root; _tab = 'pending'; _draw(); }
export function unmount() { _root = null;
  _tab = 'pending';
}

function _draw() {
  const all     = _getAll();
  const pending = all.filter(r => r.status === 'pending').length;
  const approved = all.filter(r => r.status === 'approved').length;
  const rejected = all.filter(r => r.status === 'rejected').length;
  const totalBudget = all.filter(r => r.status === 'approved').reduce((s, r) => s + r.budget, 0);

  const filtered = _tab === 'pending'
    ? all.filter(r => r.status === 'pending')
    : _tab === 'approved'
      ? all.filter(r => r.status === 'approved' || r.status === 'rejected')
      : [...all].sort((a, b) => b.reqDate.localeCompare(a.reqDate));

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[
      ['pending',  `대기${pending ? ` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending}</span>` : ''}`],
      ['approved', '승인'],
      ['all',      '전체'],
    ].map(([k, l]) => `
    <button class="tla-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;white-space:nowrap;border-bottom:2px solid ${_tab === k ? 'var(--primary)' : 'transparent'};color:${_tab === k ? 'var(--primary)' : '#94A3B8'}">${l}</button>`).join('')}
  </div>

  <div style="padding:14px 16px">
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
      ${[['대기', pending, '#F59E0B'], ['승인', approved, '#10B981'], ['반려', rejected, '#EF4444']].map(([l, v, c]) => `
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:${c}">${v}건</div>
        <div style="font-size:10px;color:#94A3B8">${l}</div>
      </div>`).join('')}
    </div>
    <div style="background:linear-gradient(135deg,#F59E0B,#D97706);border-radius:12px;padding:12px;margin-bottom:16px;color:#fff;text-align:center">
      <div style="font-size:10px;opacity:0.85;margin-bottom:2px">승인된 총 예산</div>
      <div style="font-size:20px;font-weight:800">${totalBudget.toLocaleString()}원</div>
    </div>

    ${!filtered.length
      ? `<div style="text-align:center;padding:48px 16px;color:#94A3B8">
           <div style="font-size:36px;margin-bottom:10px">🍽️</div>
           <div style="font-size:14px;font-weight:600;margin-bottom:4px">신청 내역이 없습니다</div>
           <div style="font-size:12px">해당 상태의 팀 점심 신청이 없습니다.</div>
         </div>`
      : filtered.map(r => {
          const meta = STATUS_META[r.status] || STATUS_META.pending;
          return `
<div style="background:var(--card-bg);border:1px solid ${r.status === 'pending' ? '#FCD34D' : 'var(--border)'};border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div>
      <div style="font-size:14px;font-weight:700;color:var(--text)">${r.empName} <span style="font-size:11px;font-weight:400;color:#94A3B8">${r.dept}</span></div>
      <div style="font-size:12px;color:#64748B;margin-top:2px">신청일: ${r.reqDate}</div>
    </div>
    <span style="background:${meta.bg};color:${meta.color};border-radius:99px;font-size:11px;font-weight:600;padding:3px 10px">${meta.label}</span>
  </div>
  <div style="background:var(--bg);border-radius:10px;padding:10px;font-size:12px;color:#64748B;display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
    <div>🍴 <strong>${r.restaurant}</strong></div>
    <div>📅 ${r.date}</div>
    <div>👥 ${r.headcount}명</div>
    <div>💰 ${r.budget.toLocaleString()}원</div>
  </div>
  ${r.status === 'pending' ? `
  <div style="display:flex;gap:8px">
    <button class="tla-approve" data-id="${r.id}" style="flex:1;padding:9px;background:#ECFDF5;color:#10B981;border:1px solid #10B981;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer">✓ 승인</button>
    <button class="tla-reject"  data-id="${r.id}" style="flex:1;padding:9px;background:#FEF2F2;color:#EF4444;border:1px solid #EF4444;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer">✕ 반려</button>
  </div>` : ''}
</div>`;
        }).join('')}
  </div>
</div>`;

  _bindEvents();
}

function _bindEvents() {
  if (!_root) return;

  _root.querySelectorAll('.tla-tab').forEach(b => {
    b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(); });
  });

  _root.querySelectorAll('.tla-approve').forEach(b => {
    b.addEventListener('click', () => {
      const all = _getAll();
      const idx = all.findIndex(r => r.id === b.dataset.id);
      if (idx < 0) return;
      all[idx].status = 'approved';
      _saveAll(all);
      showToast('팀 점심 신청이 승인되었습니다.');
      addNotification({ type: 'success', title: '팀 점심 관리', body: '팀 점심 신청이 승인되었습니다.' });
      _draw();
    });
  });

  _root.querySelectorAll('.tla-reject').forEach(b => {
    b.addEventListener('click', () => {
      const all = _getAll();
      const idx = all.findIndex(r => r.id === b.dataset.id);
      if (idx < 0) return;
      all[idx].status = 'rejected';
      _saveAll(all);
      showToast('팀 점심 신청이 반려되었습니다.', 'error');
      _draw();
    });
  });
}
export function mount(root) { return render(root); }
