/**
 * health-exam-admin.js — 건강검진 예약 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_health_exams';

const EXAM_TYPE_META = {
  '일반 건강검진':  { icon: '🏥', color: '#3B82F6' },
  '정밀 건강검진':  { icon: '🔬', color: '#8B5CF6' },
  '구강 검진':     { icon: '🦷', color: '#10B981' },
  '안과 검진':     { icon: '👁️', color: '#F59E0B' },
  '암 정기 검진':   { icon: '🩺', color: '#EF4444' },
};

const LEGACY_IDS = new Set(['HEA001','HEA002','HEA003','HEA004','HEA005','HEA006','HEA007']);

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

let _tab = '예약';
let _root = null;

export function render(root) { _root = root; _tab = '예약'; _draw(); }
export function unmount() { _root = null;
  _tab = '예약';
}

function _draw() {
  if (!_root) return;
  const all       = _load().sort((a, b) => (a.examDate || '').localeCompare(b.examDate || ''));
  const scheduled = all.filter(r => r.status === 'scheduled');
  const completed = all.filter(r => r.status === 'completed');
  const cancelled = all.filter(r => r.status === 'cancelled');

  const tabList = [
    ['예약', `예약${scheduled.length ? ` <span style="background:#3B82F6;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${scheduled.length}</span>` : ''}`],
    ['완료', '완료'],
    ['전체', '전체'],
  ];

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${tabList.map(([k, l]) => `
    <button class="hea-tab" data-tab="${k}"
      style="padding:10px 18px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab === k ? 'var(--primary)' : 'transparent'};
             color:${_tab === k ? 'var(--primary)' : '#94A3B8'}">${l}</button>`).join('')}
  </div>

  <div style="padding:14px 16px">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
      ${[
        { l: '예약',  v: scheduled.length + '건', c: '#3B82F6' },
        { l: '완료',  v: completed.length + '건', c: '#10B981' },
        { l: '취소',  v: cancelled.length + '건', c: '#EF4444' },
      ].map(k => `
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
           padding:12px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:${k.c}">${k.v}</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">${k.l}</div>
      </div>`).join('')}
    </div>

    ${_tab === '예약' ? _renderItems(scheduled, 'scheduled') :
      _tab === '완료' ? _renderItems(completed, 'completed') :
      _renderItems(all, 'all')}
  </div>
</div>`;

  _bindEvents();
}

function _renderItems(list, mode) {
  if (!list.length) return `
  <div style="text-align:center;padding:48px 20px;color:#94A3B8">
    <div style="font-size:40px;margin-bottom:10px">🏥</div>
    <div style="font-size:14px;font-weight:600;margin-bottom:4px">해당 건강검진 내역이 없습니다</div>
    <div style="font-size:12px">건강검진 예약 내역이 없어요</div>
  </div>`;

  const statusMeta = {
    scheduled: { label: '예약',   bg: '#DBEAFE', color: '#1D4ED8' },
    completed: { label: '완료',   bg: '#D1FAE5', color: '#059669' },
    cancelled: { label: '취소됨', bg: '#FEE2E2', color: '#EF4444' },
  };

  return list.map(r => {
    const st   = statusMeta[r.status] || statusMeta.scheduled;
    const emeta = EXAM_TYPE_META[r.examType] || { icon: '🏥', color: '#64748B' };
    return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:14px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--text)">${emeta.icon} ${r.examType}</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">${r.empName} · ${r.dept} · ${r.empId}</div>
      </div>
      <span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:10px;
        color:${st.color};background:${st.bg};flex-shrink:0;margin-left:8px">${st.label}</span>
    </div>
    <div style="font-size:11px;color:#64748B;margin-bottom:8px">
      🏥 ${r.hospital} · 검진일: <strong>${r.examDate}</strong>
    </div>
    <div style="font-size:11px;color:#94A3B8;margin-bottom:8px">신청일: ${r.requestedAt}</div>
    ${r.status === 'scheduled' ? `
    <div style="display:flex;gap:8px">
      <button class="hea-complete" data-id="${r.id}"
        style="flex:1;background:#D1FAE5;color:#065F46;border:none;border-radius:8px;
               padding:8px;font-size:12px;font-weight:600;cursor:pointer">✅ 완료 처리</button>
      <button class="hea-cancel" data-id="${r.id}"
        style="flex:1;background:#FEE2E2;color:#DC2626;border:none;border-radius:8px;
               padding:8px;font-size:12px;font-weight:600;cursor:pointer">❌ 취소</button>
    </div>` : ''}
  </div>`;
  }).join('');
}

function _bindEvents() {
  if (!_root) return;

  _root.querySelectorAll('.hea-tab').forEach(b =>
    b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(); }));

  _root.querySelectorAll('.hea-complete').forEach(btn =>
    btn.addEventListener('click', () => {
      const list = _load();
      const idx  = list.findIndex(r => r.id === btn.dataset.id);
      if (idx >= 0) { list[idx].status = 'completed'; list[idx].completedAt = new Date().toISOString().slice(0,10); _save(list); }
      showToast('건강검진이 완료 처리되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Health Exam (관리자)', body: '건강검진이 완료 처리되었습니다.' });
      _draw();
    }));

  _root.querySelectorAll('.hea-cancel').forEach(btn =>
    btn.addEventListener('click', () => {
      const list = _load();
      const idx  = list.findIndex(r => r.id === btn.dataset.id);
      if (idx >= 0) { list[idx].status = 'cancelled'; list[idx].cancelledAt = new Date().toISOString().slice(0,10); _save(list); }
      showToast('건강검진이 취소되었습니다.', 'info');
      _draw();
    }));
}
export function mount(root) { return render(root); }
