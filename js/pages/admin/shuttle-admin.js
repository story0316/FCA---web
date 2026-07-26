/**
 * shuttle-admin.js — 통근 셔틀 구독 관리 (관리자)
 */
import { showToast } from '../../components/toast.js'
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_shuttle_subscriptions';

const ROUTES = ['강남역 방면', '판교역 방면', '수원역 방면'];

const LEGACY_IDS = new Set(['SHT001','SHT002','SHT003','SHT004','SHT005','SHT006','SHT007','SHT008','SHT009','SHT010']);

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

let _tab = '구독 현황';
let _root = null;

export function render(root) { _root = root; _tab = '구독 현황'; _draw(); }
export function unmount() { _root = null;
  _tab = '구독 현황';
}

function _draw() {
  if (!_root) return;
  const all    = _load().sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  const active = all.filter(r => r.status === 'active');

  const tabList = ['구독 현황', '노선별 통계'];

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${tabList.map(k => `
    <button class="sha-tab" data-tab="${k}"
      style="padding:10px 18px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab === k ? 'var(--primary)' : 'transparent'};
             color:${_tab === k ? 'var(--primary)' : '#94A3B8'}">${k}</button>`).join('')}
  </div>

  <div style="padding:14px 16px">
    <!-- 총 구독자 카드 -->
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
         padding:14px;margin-bottom:14px;display:flex;align-items:center;gap:12px">
      <div style="width:44px;height:44px;background:#EFF6FF;border-radius:12px;
           display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">🚌</div>
      <div>
        <div style="font-size:22px;font-weight:800;color:#3B82F6">${active.length}명</div>
        <div style="font-size:12px;color:#64748B">현재 구독 중인 임직원</div>
      </div>
    </div>

    ${_tab === '구독 현황' ? _renderSubscriptions(active) : _renderRouteStats(all)}
  </div>
</div>`;

  _bindEvents();
}

function _renderSubscriptions(list) {
  if (!list.length) return `
  <div style="text-align:center;padding:48px 20px;color:#94A3B8">
    <div style="font-size:40px;margin-bottom:10px">🚌</div>
    <div style="font-size:14px;font-weight:600;margin-bottom:4px">구독 중인 임직원이 없습니다</div>
    <div style="font-size:12px">셔틀 구독 신청을 유도해 보세요</div>
  </div>`;

  return list.map(r => `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:14px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${r.empName}</div>
        <div style="font-size:11px;color:#64748B">${r.dept} · ${r.empId}</div>
      </div>
      <span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:10px;
        color:#059669;background:#D1FAE5">구독 중</span>
    </div>
    <div style="font-size:11px;color:#64748B;margin-bottom:8px">
      🚌 ${r.routeName} · 시작: ${r.startDate}
    </div>
    <button class="sha-cancel" data-id="${r.id}"
      style="width:100%;background:#FEE2E2;color:#DC2626;border:none;border-radius:8px;
             padding:8px;font-size:12px;font-weight:600;cursor:pointer">🚫 취소 처리</button>
  </div>`).join('');
}

function _renderRouteStats(all) {
  const active = all.filter(r => r.status === 'active');
  const MAX_BAR = 240;
  const maxCount = Math.max(...ROUTES.map(rt => active.filter(r => r.routeName === rt).length), 1);

  const routeColors = {
    '강남역 방면': '#3B82F6',
    '판교역 방면': '#10B981',
    '수원역 방면': '#8B5CF6',
  };

  const rows = ROUTES.map(rt => {
    const count   = active.filter(r => r.routeName === rt).length;
    const barW    = Math.round((count / maxCount) * MAX_BAR);
    const color   = routeColors[rt] || '#64748B';
    return `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
         padding:14px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:13px;font-weight:700;color:var(--text)">🚌 ${rt}</div>
        <div style="font-size:20px;font-weight:800;color:${color}">${count}명</div>
      </div>
      <div style="height:10px;background:#F1F5F9;border-radius:99px;overflow:hidden">
        <div style="height:100%;width:${barW}px;max-width:100%;background:${color};border-radius:99px;
             transition:width 0.4s ease"></div>
      </div>
    </div>`;
  });

  return rows.join('') || `
  <div style="text-align:center;padding:48px 20px;color:#94A3B8">
    <div style="font-size:40px;margin-bottom:10px">📊</div>
    <div style="font-size:14px;font-weight:600">통계 데이터가 없습니다</div>
  </div>`;
}

function _bindEvents() {
  if (!_root) return;

  _root.querySelectorAll('.sha-tab').forEach(b =>
    b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(); }));

  _root.querySelectorAll('.sha-cancel').forEach(btn =>
    btn.addEventListener('click', () => {
      const list = _load();
      const idx  = list.findIndex(r => r.id === btn.dataset.id);
      if (idx >= 0) { list[idx].status = 'cancelled'; list[idx].cancelledAt = new Date().toISOString().slice(0,10); _save(list); }
      showToast('구독이 취소 처리되었습니다.', 'info');
      addNotification({ type: 'info', title: '셔틀버스 관리', body: '구독이 취소 처리되었습니다.' });
      _draw();
    }));
}
export function mount(root) { return render(root); }
