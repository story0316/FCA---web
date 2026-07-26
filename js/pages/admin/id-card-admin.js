/**
 * id-card-admin.js — 사원증 발급 신청 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_id_card_requests';

const REASON_META = {
  new:       { label: '신규 발급',  icon: '🆕', color: '#4F46E5' },
  lost:      { label: '분실 재발급', icon: '🔍', color: '#F59E0B' },
  damaged:   { label: '파손 교체',  icon: '💔', color: '#EF4444' },
  update:    { label: '정보 변경',  icon: '✏️', color: '#10B981' },
  expired:   { label: '기간 만료',  icon: '📅', color: '#8B5CF6' },
};

const LEGACY_IDS = new Set(['IDC001','IDC002','IDC003','IDC004','IDC005','IDC006','IDC007']);

function _load() {
  try {
    const d = JSON.parse(localStorage.getItem(LS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_IDS.has(r.id));
    if (cleaned.length !== list.length) _save(cleaned);
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
  const all        = _load().sort((a, b) => (b.requestedAt || '').localeCompare(a.requestedAt || ''));
  const pending    = all.filter(r => r.status === 'pending');
  const processing = all.filter(r => r.status === 'processing');
  const completed  = all.filter(r => r.status === 'completed');

  _root.innerHTML = `
<div style="padding:0">
  <!-- 탭 -->
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[
      ['대기',   `대기${pending.length ? ` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending.length}</span>` : ''}`],
      ['처리중',  `처리 중${processing.length ? ` <span style="background:#F59E0B;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${processing.length}</span>` : ''}`],
      ['전체',   '전체'],
    ].map(([k, l]) => `
    <button class="ica-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab === k ? 'var(--primary)' : 'transparent'};
             color:${_tab === k ? 'var(--primary)' : '#94A3B8'}">${l}</button>`).join('')}
  </div>

  <div style="padding:14px 16px">
    <!-- 통계 카드 -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
      ${[
        { l: '대기',     v: pending.length    + '건', c: '#F59E0B' },
        { l: '처리 중',  v: processing.length + '건', c: '#3B82F6' },
        { l: '발급 완료', v: completed.length  + '건', c: '#10B981' },
      ].map(k => `
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
           padding:12px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:${k.c}">${k.v}</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">${k.l}</div>
      </div>`).join('')}
    </div>

    ${_tab === '대기'   ? _renderItems(pending, 'pending') :
      _tab === '처리중' ? _renderItems(processing, 'processing') :
      _renderItems(all, 'all')}
  </div>
</div>`;

  _root.querySelectorAll('.ica-tab').forEach(b =>
    b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderItems(list, mode) {
  if (!list.length) return `
  <div style="text-align:center;padding:40px 20px;color:#94A3B8">
    <div style="font-size:36px;margin-bottom:8px">🪪</div>
    <div style="font-size:13px;font-weight:600">해당 신청이 없습니다</div>
  </div>`;

  const statusMeta = {
    pending:    { label: '대기중',   bg: '#FEF3C7', color: '#D97706' },
    processing: { label: '처리 중',  bg: '#DBEAFE', color: '#1D4ED8' },
    completed:  { label: '발급 완료', bg: '#D1FAE5', color: '#059669' },
  };

  return list.map(r => {
    const st   = statusMeta[r.status] || statusMeta.pending;
    const rmeta = REASON_META[r.reason] || { label: r.reason, icon: '📋', color: '#64748B' };
    return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:14px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
      <div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:8px;
            color:${rmeta.color};background:${rmeta.color}18">${rmeta.icon} ${rmeta.label}</span>
        </div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${r.empName}
          <span style="font-size:11px;color:#64748B;font-weight:400"> · ${r.position}</span>
        </div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">${r.dept} · ${r.empId}</div>
        <div style="font-size:11px;color:#94A3B8;margin-top:1px">신청일: ${r.requestedAt}</div>
        ${r.completedDate ? `<div style="font-size:11px;color:#059669;margin-top:1px">발급일: ${r.completedDate}</div>` : ''}
      </div>
      <span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:10px;
        color:${st.color};background:${st.bg};flex-shrink:0">${st.label}</span>
    </div>
    ${r.status === 'pending' ? `
    <button class="ica-process" data-id="${r.id}"
      style="width:100%;background:#DBEAFE;color:#1D4ED8;border:none;border-radius:8px;
             padding:8px;font-size:12px;font-weight:600;cursor:pointer;margin-top:8px">⚙️ 처리 시작</button>` : ''}
    ${r.status === 'processing' ? `
    <button class="ica-complete" data-id="${r.id}"
      style="width:100%;background:#D1FAE5;color:#065F46;border:none;border-radius:8px;
             padding:8px;font-size:12px;font-weight:600;cursor:pointer;margin-top:8px">✅ 발급 완료</button>` : ''}
  </div>`;
  }).join('');
}

function _bindEvents() {
  if (!_root) return;

  _root.querySelectorAll('.ica-process').forEach(btn =>
    btn.addEventListener('click', () => {
      const list = _load();
      const idx  = list.findIndex(r => r.id === btn.dataset.id);
      if (idx >= 0) { list[idx].status = 'processing'; list[idx].processedAt = new Date().toISOString().slice(0,10); _save(list); }
      showToast('처리가 시작되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Id Card (관리자)', body: '처리가 시작되었습니다.' });
      _draw();
    }));

  _root.querySelectorAll('.ica-complete').forEach(btn =>
    btn.addEventListener('click', () => {
      const today = new Date().toISOString().slice(0,10);
      const list  = _load();
      const idx   = list.findIndex(r => r.id === btn.dataset.id);
      if (idx >= 0) { list[idx].status = 'completed'; list[idx].completedDate = today; _save(list); }
      showToast('사원증 발급이 완료되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Id Card (관리자)', body: '사원증 발급이 완료되었습니다.' });
      _draw();
    }));
}
export function mount(root) { return render(root); }
