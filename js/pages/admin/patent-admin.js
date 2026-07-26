/**
 * patent-admin.js — 특허 출원 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_patents';

const PATENT_TYPE_META = {
  '발명': { icon: '💡', color: '#F59E0B' },
  '실용신안': { icon: '🔧', color: '#3B82F6' },
  '디자인': { icon: '🎨', color: '#EC4899' },
  '상표': { icon: '™️', color: '#10B981' },
};

const LEGACY_PAT_IDS = new Set(['PAT001','PAT002','PAT003','PAT004','PAT005','PAT006','PAT007']);

function _load() {
  const s = localStorage.getItem(LS);
  if (!s) return [];
  try {
    const d = JSON.parse(s);
    const cleaned = d.filter(r => !LEGACY_PAT_IDS.has(r.id));
    if (cleaned.length < d.length) localStorage.setItem(LS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}

function _save(list) { localStorage.setItem(LS, JSON.stringify(list)); }

let _tab = '제출됨';
let _root = null;

export function render(root) { _root = root; _tab = '제출됨'; _draw(); }
export function unmount() { _root = null;
  _tab = '제출됨';
}

function _draw() {
  if (!_root) return;
  const all        = _load().sort((a, b) => (b.filedDate || '').localeCompare(a.filedDate || ''));
  const submitted  = all.filter(r => r.status === 'submitted');
  const reviewing  = all.filter(r => r.status === 'reviewing');
  const registered = all.filter(r => r.status === 'registered');
  const rejected   = all.filter(r => r.status === 'rejected');

  const tabList = [
    ['제출됨', `제출됨${submitted.length ? ` <span style="background:#F59E0B;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${submitted.length}</span>` : ''}`],
    ['심사 중', `심사 중${reviewing.length ? ` <span style="background:#3B82F6;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${reviewing.length}</span>` : ''}`],
    ['전체', '전체'],
  ];

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${tabList.map(([k, l]) => `
    <button class="pta-tab" data-tab="${k}"
      style="padding:10px 18px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab === k ? 'var(--primary)' : 'transparent'};
             color:${_tab === k ? 'var(--primary)' : '#94A3B8'}">${l}</button>`).join('')}
  </div>

  <div style="padding:14px 16px">
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px">
      ${[
        { l: '제출',   v: submitted.length  + '건', c: '#F59E0B' },
        { l: '심사 중', v: reviewing.length  + '건', c: '#3B82F6' },
        { l: '등록',   v: registered.length + '건', c: '#10B981' },
        { l: '반려',   v: rejected.length   + '건', c: '#EF4444' },
      ].map(k => `
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
           padding:12px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:${k.c}">${k.v}</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">${k.l}</div>
      </div>`).join('')}
    </div>

    ${_tab === '제출됨' ? _renderItems(submitted, 'submitted') :
      _tab === '심사 중' ? _renderItems(reviewing, 'reviewing') :
      _renderItems(all, 'all')}
  </div>
</div>`;

  _bindEvents();
}

function _renderItems(list, mode) {
  if (!list.length) return `
  <div style="text-align:center;padding:48px 20px;color:#94A3B8">
    <div style="font-size:40px;margin-bottom:10px">💡</div>
    <div style="font-size:14px;font-weight:600;margin-bottom:4px">해당 특허 건이 없습니다</div>
    <div style="font-size:12px">특허 출원 내역이 없어요</div>
  </div>`;

  const statusMeta = {
    submitted:  { label: '제출됨', bg: '#FEF3C7', color: '#D97706' },
    reviewing:  { label: '심사 중', bg: '#DBEAFE', color: '#1D4ED8' },
    registered: { label: '등록',   bg: '#D1FAE5', color: '#059669' },
    rejected:   { label: '반려',   bg: '#FEE2E2', color: '#EF4444' },
  };

  return list.map(r => {
    const st   = statusMeta[r.status] || statusMeta.submitted;
    const tmeta = PATENT_TYPE_META[r.type] || { icon: '📄', color: '#64748B' };
    return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:14px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div style="flex:1;min-width:0;margin-right:8px">
        <div style="font-size:13px;font-weight:700;color:var(--text);line-height:1.4">${tmeta.icon} ${r.title}</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">${r.empName} · ${r.dept}</div>
      </div>
      <span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:10px;
        color:${st.color};background:${st.bg};flex-shrink:0">${st.label}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:8px;font-size:11px;color:#64748B">
      <div>유형: <span style="color:${tmeta.color};font-weight:600">${r.type}</span></div>
      <div>기술 분야: <span style="color:var(--text)">${r.techField}</span></div>
      <div style="grid-column:1/-1">발명자: <span style="color:var(--text)">${(r.inventors || []).join(', ')}</span></div>
      <div>출원일: <span style="color:var(--text)">${r.filedDate}</span></div>
    </div>
    ${r.status === 'submitted' ? `
    <div style="margin-top:4px">
      <button class="pta-review" data-id="${r.id}"
        style="width:100%;background:#DBEAFE;color:#1E40AF;border:none;border-radius:8px;
               padding:8px;font-size:12px;font-weight:600;cursor:pointer">🔍 심사 시작</button>
    </div>` : ''}
    ${r.status === 'reviewing' ? `
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="pta-register" data-id="${r.id}"
        style="flex:1;background:#D1FAE5;color:#065F46;border:none;border-radius:8px;
               padding:8px;font-size:12px;font-weight:600;cursor:pointer">✅ 등록</button>
      <button class="pta-reject" data-id="${r.id}"
        style="flex:1;background:#FEE2E2;color:#DC2626;border:none;border-radius:8px;
               padding:8px;font-size:12px;font-weight:600;cursor:pointer">❌ 반려</button>
    </div>` : ''}
  </div>`;
  }).join('');
}

function _bindEvents() {
  if (!_root) return;

  _root.querySelectorAll('.pta-tab').forEach(b =>
    b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(); }));

  _root.querySelectorAll('.pta-review').forEach(btn =>
    btn.addEventListener('click', () => {
      const list = _load();
      const idx  = list.findIndex(r => r.id === btn.dataset.id);
      if (idx >= 0) { list[idx].status = 'reviewing'; list[idx].reviewStartedAt = new Date().toISOString().slice(0,10); _save(list); }
      showToast('심사가 시작되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Patent (관리자)', body: '심사가 시작되었습니다.' });
      _draw();
    }));

  _root.querySelectorAll('.pta-register').forEach(btn =>
    btn.addEventListener('click', () => {
      const list = _load();
      const idx  = list.findIndex(r => r.id === btn.dataset.id);
      if (idx >= 0) { list[idx].status = 'registered'; list[idx].registeredAt = new Date().toISOString().slice(0,10); _save(list); }
      showToast('특허가 등록되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Patent (관리자)', body: '특허가 등록되었습니다.' });
      _draw();
    }));

  _root.querySelectorAll('.pta-reject').forEach(btn =>
    btn.addEventListener('click', () => {
      const list = _load();
      const idx  = list.findIndex(r => r.id === btn.dataset.id);
      if (idx >= 0) { list[idx].status = 'rejected'; list[idx].rejectedAt = new Date().toISOString().slice(0,10); _save(list); }
      showToast('반려되었습니다.', 'info');
      _draw();
    }));
}
export function mount(root) { return render(root); }
