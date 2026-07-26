/**
 * meal-ticket-admin.js — 식권 신청 관리 및 배정 현황 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_meal_tickets';

const LEGACY_MTKT_IDS = new Set(['MT001','MT002','MT003','MT004','MT005','MT006','MT007']);

function _load() {
  const s = localStorage.getItem(LS);
  if (!s) return [];
  try {
    const d = JSON.parse(s);
    const cleaned = d.filter(r => !LEGACY_MTKT_IDS.has(r.id));
    if (cleaned.length < d.length) localStorage.setItem(LS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}

function _save(list) { localStorage.setItem(LS, JSON.stringify(list)); }

// Track which row is in inline-edit mode
let _editId = null;
let _tab = '신청관리';
let _root = null;

export function render(root) { _root = root; _tab = '신청관리'; _editId = null; _draw(); }
export function unmount() { _root = null;
  _tab = '신청관리';
}

function _draw() {
  const all       = _load();
  const currMonth = new Date().toISOString().slice(0, 7);
  const pending   = all.filter(r => r.status === 'pending');
  const allocated = all.filter(r => r.status === 'allocated' && (r.month || '').startsWith(currMonth));
  const totalAllocated = allocated.reduce((s, r) => s + (r.allocated || 0), 0);

  _root.innerHTML = `
<div style="padding:0">
  <!-- 탭 -->
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[
      ['신청관리', `신청 관리${pending.length ? ` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending.length}</span>` : ''}`],
      ['배정현황', '배정 현황'],
    ].map(([k, l]) => `
    <button class="mta-tab" data-tab="${k}"
      style="padding:10px 18px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab === k ? 'var(--primary)' : 'transparent'};
             color:${_tab === k ? 'var(--primary)' : '#94A3B8'}">${l}</button>`).join('')}
  </div>

  <div style="padding:14px 16px">
    ${_tab === '신청관리' ? `
    <!-- 통계 카드 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
      ${[
        { l: '대기 신청',     v: pending.length + '건', c: '#F59E0B' },
        { l: '이번 달 배정',  v: allocated.length + '건', c: '#10B981' },
      ].map(k => `
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
           padding:14px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:${k.c}">${k.v}</div>
        <div style="font-size:11px;color:#64748B;margin-top:3px">${k.l}</div>
      </div>`).join('')}
    </div>
    ${_renderRequests(pending)}` : `
    <!-- 배정 현황 통계 카드 -->
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
         padding:14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:12px;color:#64748B;font-weight:600">${currMonth} 총 배정 식권</span>
      <span style="font-size:20px;font-weight:800;color:#4F46E5">${totalAllocated}매</span>
    </div>
    ${_renderAllocated(allocated)}`}
  </div>
</div>`;

  _root.querySelectorAll('.mta-tab').forEach(b =>
    b.addEventListener('click', () => { _tab = b.dataset.tab; _editId = null; _draw(); }));
  _bindEvents();
}

function _renderRequests(list) {
  if (!list.length) return `
  <div style="text-align:center;padding:40px 20px;color:#94A3B8">
    <div style="font-size:36px;margin-bottom:8px">🎫</div>
    <div style="font-size:13px;font-weight:600">대기 중인 신청이 없습니다</div>
  </div>`;

  return list.map(r => `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:14px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${r.empName}
          <span style="font-size:11px;color:#64748B;font-weight:400"> · ${r.dept}</span>
        </div>
        <div style="font-size:11px;color:#94A3B8;margin-top:2px">${r.month} · 신청 ${r.requestCount}매 · ${r.requestedAt}</div>
      </div>
      <span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:10px;
        color:#D97706;background:#FEF3C7">대기중</span>
    </div>
    ${_editId === r.id ? `
    <div style="display:flex;gap:8px;align-items:center;margin-top:8px" id="edit-row-${r.id}">
      <input type="number" id="mta-count-${r.id}" value="${r.requestCount}" min="0"
        style="flex:1;padding:8px 12px;border:1.5px solid #4F46E5;border-radius:8px;
               font-size:13px;background:var(--bg);color:var(--text)">
      <button class="mta-confirm" data-id="${r.id}"
        style="background:#4F46E5;color:#fff;border:none;border-radius:8px;
               padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer">확인</button>
      <button class="mta-cancel"
        style="background:#F1F5F9;color:#64748B;border:none;border-radius:8px;
               padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer">취소</button>
    </div>` : `
    <button class="mta-allocate" data-id="${r.id}"
      style="width:100%;background:#EEF2FF;color:#4F46E5;border:none;border-radius:8px;
             padding:8px;font-size:12px;font-weight:600;cursor:pointer;margin-top:4px">🎫 배정하기</button>`}
  </div>`).join('');
}

function _renderAllocated(list) {
  if (!list.length) return `
  <div style="text-align:center;padding:40px 20px;color:#94A3B8">
    <div style="font-size:36px;margin-bottom:8px">📊</div>
    <div style="font-size:13px;font-weight:600">이번 달 배정 내역이 없습니다</div>
  </div>`;

  return list.map(r => `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:13px;font-weight:700;color:var(--text)">${r.empName}
        <span style="font-size:11px;color:#64748B;font-weight:400"> · ${r.dept}</span>
      </div>
      <div style="font-size:11px;color:#94A3B8;margin-top:2px">${r.month} · 신청 ${r.requestCount}매</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:18px;font-weight:800;color:#10B981">${r.allocated}매</div>
      <div style="font-size:10px;color:#94A3B8">배정 완료</div>
    </div>
  </div>`).join('');
}

function _bindEvents() {
  if (!_root) return;

  _root.querySelectorAll('.mta-allocate').forEach(btn =>
    btn.addEventListener('click', () => {
      _editId = btn.dataset.id;
      _draw();
    }));

  _root.querySelectorAll('.mta-cancel').forEach(btn =>
    btn.addEventListener('click', () => {
      _editId = null;
      _draw();
    }));

  _root.querySelectorAll('.mta-confirm').forEach(btn =>
    btn.addEventListener('click', () => {
      const id    = btn.dataset.id;
      const input = _root.querySelector(`#mta-count-${id}`);
      const val   = parseInt(input?.value || '0', 10);
      if (isNaN(val) || val < 0) { showToast('올바른 수량을 입력하세요.', 'error'); return; }
      const list = _load();
      const idx  = list.findIndex(r => r.id === id);
      if (idx >= 0) {
        list[idx].status    = 'allocated';
        list[idx].allocated = val;
        list[idx].allocatedAt = new Date().toISOString().slice(0,10);
        _save(list);
      }
      showToast(`${val}매가 배정되었습니다.`, 'success')
      addNotification({ type: 'success', title: 'Meal Ticket (관리자)', body: '매가 배정되었습니다.' });
      _editId = null;
      _draw();
    }));
}
export function mount(root) { return render(root); }
