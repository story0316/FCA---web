/**
 * family-event-admin.js — 경조사 지원 관리 (관리자)
 */

import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_family_events';

const EVENT_TYPES = [
  { key: 'own_wedding',       label: '본인 결혼',  icon: '💍', days: 5,  gift: 300000 },
  { key: 'child_wedding',     label: '자녀 결혼',  icon: '🤵', days: 1,  gift: 100000 },
  { key: 'parent_death',      label: '부모 상',    icon: '🕯️', days: 5,  gift: 500000 },
  { key: 'spouse_death',      label: '배우자 상',  icon: '🕯️', days: 5,  gift: 500000 },
  { key: 'child_death',       label: '자녀 상',    icon: '🕯️', days: 3,  gift: 300000 },
  { key: 'own_birthday60',    label: '본인 회갑',  icon: '🎂', days: 1,  gift: 100000 },
  { key: 'sibling_death',     label: '형제자매 상', icon: '🕯️', days: 3, gift: 100000 },
  { key: 'grandparent_death', label: '조부모 상',  icon: '🕯️', days: 2,  gift: 100000 },
  { key: 'other',             label: '기타',       icon: '📋', days: 0,  gift: 0 },
];

const STATUS_META = {
  pending:  { label: '검토 중',  color: '#F59E0B', bg: '#FEF3C7' },
  approved: { label: '승인됨',   color: '#10B981', bg: '#D1FAE5' },
  rejected: { label: '반려됨',   color: '#EF4444', bg: '#FEE2E2' },
  paid:     { label: '지급완료', color: '#3B82F6', bg: '#DBEAFE' },
};

const STATUS_OPTIONS = [
  { key: 'pending',  label: '검토 중' },
  { key: 'approved', label: '승인됨' },
  { key: 'rejected', label: '반려됨' },
  { key: 'paid',     label: '지급완료' },
];

function _getAll() { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } }
function _save(l) { localStorage.setItem(LS, JSON.stringify(l)); }

let _filter = 'pending';

export function render(root) { _filter = 'pending'; _draw(root); }
export function unmount() { _filter = 'pending'; }

function _draw(root) {
  const all = _getAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const counts = {};
  STATUS_OPTIONS.forEach(s => { counts[s.key] = all.filter(e => e.status === s.key).length; });
  const filtered = _filter === 'all' ? all : all.filter(e => e.status === _filter);

  // KPI
  const totalGift = all.filter(e => e.status === 'paid')
    .reduce((sum, e) => {
      const t = EVENT_TYPES.find(x => x.key === e.eventType);
      return sum + (t?.gift || 0);
    }, 0);

  root.innerHTML = `
<!-- KPI -->
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
  ${[
    { label: '전체',    val: all.length,              color: '#4F46E5' },
    { label: '검토 중', val: counts.pending || 0,     color: '#F59E0B' },
    { label: '승인',    val: counts.approved || 0,    color: '#10B981' },
    { label: '지급완료', val: `${(totalGift/10000).toFixed(0)}만`,  color: '#3B82F6' },
  ].map(k => `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
      <div style="font-size:18px;font-weight:800;color:${k.color}">${k.val}</div>
      <div style="font-size:10px;color:#64748B;margin-top:2px">${k.label}</div>
    </div>`).join('')}
</div>

<!-- 필터 -->
<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
  <button class="fea-filter" data-f="all"
    style="padding:5px 12px;font-size:11px;font-weight:600;border-radius:8px;cursor:pointer;
           border:1.5px solid ${_filter==='all'?'#4F46E5':'var(--border)'};
           background:${_filter==='all'?'#EEF2FF':'var(--card-bg)'};color:${_filter==='all'?'#4F46E5':'#64748B'}">
    전체 (${all.length})</button>
  ${STATUS_OPTIONS.map(s => {
    const sm = STATUS_META[s.key];
    const active = _filter === s.key;
    return `<button class="fea-filter" data-f="${s.key}"
      style="padding:5px 12px;font-size:11px;font-weight:600;border-radius:8px;cursor:pointer;
             border:1.5px solid ${active ? sm.color : 'var(--border)'};
             background:${active ? sm.bg : 'var(--card-bg)'};color:${active ? sm.color : '#64748B'}">
      ${s.label} ${counts[s.key] ? `(${counts[s.key]})` : ''}
    </button>`;
  }).join('')}
</div>

${!filtered.length
  ? `<div style="text-align:center;padding:40px;color:#94A3B8;font-size:13px">해당 상태의 경조사 신청이 없습니다.</div>`
  : filtered.map(ev => {
    const evType = EVENT_TYPES.find(t => t.key === ev.eventType) || { label: ev.eventType, icon: '📋', gift: 0, days: 0 };
    const sm = STATUS_META[ev.status] || STATUS_META.pending;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:22px">${evType.icon}</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${ev.empName}</div>
        <div style="font-size:11px;color:#64748B">${evType.label} · ${ev.createdAt.slice(0,10)}</div>
      </div>
    </div>
    <select class="fea-status-sel" data-id="${ev.id}"
      style="padding:5px 8px;border:1.5px solid ${sm.color};border-radius:8px;font-size:11px;font-weight:700;
             background:${sm.bg};color:${sm.color};cursor:pointer">
      ${STATUS_OPTIONS.map(s => `<option value="${s.key}" ${ev.status===s.key?'selected':''}>${s.label}</option>`).join('')}
    </select>
  </div>
  <div style="font-size:12px;color:#64748B;margin-bottom:8px">${ev.note}</div>
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
    ${evType.days > 0 ? `<span style="padding:3px 8px;background:#F1F5F9;border-radius:6px;font-size:11px;color:#475569">🏖️ ${evType.days}일 경조휴가</span>` : ''}
    ${evType.gift > 0 ? `<span style="padding:3px 8px;background:#F1F5F9;border-radius:6px;font-size:11px;color:#475569">💰 경조금 ${(evType.gift/10000).toFixed(0)}만원</span>` : ''}
    ${ev.eventDate ? `<span style="padding:3px 8px;background:#F1F5F9;border-radius:6px;font-size:11px;color:#475569">📅 ${ev.eventDate}</span>` : ''}
    ${ev.account ? `<span style="padding:3px 8px;background:#F1F5F9;border-radius:6px;font-size:11px;color:#475569">🏦 ${ev.account}</span>` : ''}
  </div>
  <div style="display:flex;gap:8px;align-items:center">
    <input class="fea-comment" data-id="${ev.id}" type="text"
      placeholder="담당자 코멘트 (선택)" value="${ev.adminComment || ''}"
      style="flex:1;padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;background:var(--bg);color:var(--text)">
    <button class="fea-save" data-id="${ev.id}"
      style="padding:7px 14px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">저장</button>
  </div>
</div>`;
  }).join('')}`;

  root.querySelectorAll('.fea-filter').forEach(btn => {
    btn.addEventListener('click', () => { _filter = btn.dataset.f; _draw(root); });
  });

  root.querySelectorAll('.fea-save').forEach(btn => {
    btn.addEventListener('click', () => {
      const id      = btn.dataset.id;
      const status  = root.querySelector(`.fea-status-sel[data-id="${id}"]`).value;
      const comment = root.querySelector(`.fea-comment[data-id="${id}"]`).value.trim();
      const list    = _getAll();
      const idx     = list.findIndex(e => e.id === id);
      if (idx !== -1) { list[idx].status = status; list[idx].adminComment = comment; _save(list); }
      showToast('저장되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Family Event (관리자)', body: '저장되었습니다.' });
      _draw(root);
    });
  });

  root.querySelectorAll('.fea-status-sel').forEach(sel => {
    sel.addEventListener('change', () => {
      const sm2 = STATUS_META[sel.value] || { color: '#64748B', bg: '#F1F5F9' };
      sel.style.borderColor = sm2.color;
      sel.style.background  = sm2.bg;
      sel.style.color       = sm2.color;
    });
  });
}
export function mount(root) { return render(root); }
