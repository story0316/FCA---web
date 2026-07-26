import { isApplicant } from '../auth.js';
import showToast from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const EQUIP_ITEMS = [
  { key: 'monitor',  label: '모니터',        icon: '🖥️', maxQty: 1 },
  { key: 'keyboard', label: '키보드',         icon: '⌨️', maxQty: 1 },
  { key: 'mouse',    label: '마우스',         icon: '🖱️', maxQty: 1 },
  { key: 'headset',  label: '헤드셋',         icon: '🎧', maxQty: 1 },
  { key: 'webcam',   label: '웹캠',           icon: '📸', maxQty: 1 },
  { key: 'desk',     label: '스탠딩 데스크',  icon: '🪑', maxQty: 1 },
];

const STATUS_META = {
  pending:  { label: '검토중',  color: '#f59e0b', bg: '#fef3c7' },
  approved: { label: '승인',   color: '#10b981', bg: '#d1fae5' },
  shipped:  { label: '배송중', color: '#3b82f6', bg: '#dbeafe' },
  received: { label: '수령완료', color: '#6b7280', bg: '#f3f4f6' },
  rejected: { label: '반려',   color: '#ef4444', bg: '#fee2e2' },
};

const LS_KEY = 'hr_remote_equipment';

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId()   { return _session().empId || _session().userId || 'EMP001'; }
function _empName() { return _session().empName || '사용자'; }

function _load()  { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } }
function _save(d) { localStorage.setItem(LS_KEY, JSON.stringify(d)); }

let _root = null;
let _activeTab = 'apply';
let _selected = new Set();

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _root = root;
  _activeTab = 'apply';
  _selected = new Set();
  _render();
}

export function unmount() { _selected = null;
  delete window._reToggle;
  delete window._reSetTab;
  delete window._reSubmit;
  _root = null;
}

function _render() {
  if (!_root) return;
  _root.innerHTML = `
    <div class="page" style="height:100vh;overflow:hidden;background:var(--bg);display:flex;flex-direction:column;">
      <div style="background:var(--card-bg);padding:16px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);flex-shrink:0;">
        <button onclick="window.navBack()" style="background:none;border:none;font-size:20px;cursor:pointer;padding:4px;">←</button>
        <h1 style="margin:0;font-size:17px;font-weight:700;color:var(--text);">재택 장비 신청</h1>
      </div>
      <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0;">
        <button onclick="window._reSetTab('apply')"
          style="flex:1;padding:12px;border:none;background:none;font-size:14px;font-weight:600;cursor:pointer;color:${_activeTab==='apply'?'#6366f1':'#6b7280'};border-bottom:2px solid ${_activeTab==='apply'?'#6366f1':'transparent'};">
          장비 신청
        </button>
        <button onclick="window._reSetTab('history')"
          style="flex:1;padding:12px;border:none;background:none;font-size:14px;font-weight:600;cursor:pointer;color:${_activeTab==='history'?'#6366f1':'#6b7280'};border-bottom:2px solid ${_activeTab==='history'?'#6366f1':'transparent'};">
          신청 내역
        </button>
      </div>
      <div class="page-content" style="overflow-y:auto;flex:1;">
        ${_activeTab === 'apply' ? _renderApply() : _renderHistory()}
      </div>
    </div>`;

  window._reSetTab = (t) => { _activeTab = t; _render(); };
  window._reToggle = (k) => {
    if (_selected.has(k)) _selected.delete(k); else _selected.add(k);
    _render();
  };
  window._reSubmit = _handleSubmit;
}

function _renderApply() {
  return `
    <div style="padding:16px;display:flex;flex-direction:column;gap:16px;">
      <p style="margin:0;font-size:14px;color:var(--text-muted);">재택근무에 필요한 장비를 신청하세요. 여러 항목을 선택할 수 있습니다.</p>
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:8px;">장비 선택 *</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${EQUIP_ITEMS.map(e => `
            <button onclick="window._reToggle('${e.key}')"
              style="display:flex;align-items:center;gap:10px;padding:14px;border-radius:12px;border:2px solid ${_selected.has(e.key)?'#6366f1':'#e5e7eb'};background:${_selected.has(e.key)?'#ede9fe':'#fff'};cursor:pointer;text-align:left;">
              <span style="font-size:24px;">${e.icon}</span>
              <span style="font-size:13px;font-weight:600;color:var(--text);">${e.label}</span>
              ${_selected.has(e.key)?'<span style="margin-left:auto;color:#6366f1;font-size:16px;">✓</span>':''}
            </button>`).join('')}
        </div>
      </div>
      <div>
        <label style="font-size:13px;font-weight:600;color:var(--text);display:block;margin-bottom:6px;">배송 주소 *</label>
        <input id="re-addr" type="text" placeholder="배송받을 주소를 입력해 주세요."
          style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;box-sizing:border-box;" />
      </div>
      <div>
        <label style="font-size:13px;font-weight:600;color:var(--text);display:block;margin-bottom:6px;">기타 요청사항</label>
        <textarea maxlength="500" id="re-note" rows="3" placeholder="추가로 요청할 사항이 있으면 작성해 주세요. (선택)"
          style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;resize:none;box-sizing:border-box;font-family:inherit;"></textarea>
      </div>
      <button onclick="window._reSubmit()"
        style="width:100%;padding:14px;background:#6366f1;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;">
        신청하기
      </button>
    </div>`;
}

function _renderHistory() {
  const all = _load().filter(r => r.empId === _empId());
  if (!all.length) return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:12px;">
      <span style="font-size:48px;">🖥️</span>
      <p style="margin:0;font-size:15px;font-weight:600;color:var(--text);">신청 내역이 없습니다</p>
      <p style="margin:0;font-size:13px;color:var(--text-muted);">재택 장비를 신청해 보세요.</p>
      <button onclick="window._reSetTab('apply')"
        style="padding:10px 20px;background:#6366f1;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;margin-top:4px;">
        신청하기
      </button>
    </div>`;
  return `
    <div style="padding:16px;display:flex;flex-direction:column;gap:12px;">
      ${all.map(r => {
        const meta = STATUS_META[r.status] || STATUS_META.pending;
        const itemLabels = (r.items || []).map(k => EQUIP_ITEMS.find(e => e.key === k)?.label || k).join(', ');
        return `
          <div style="background:var(--card-bg);border-radius:14px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-size:14px;font-weight:700;color:var(--text);">장비 신청</span>
              <span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;background:${meta.bg};color:${meta.color};">${meta.label}</span>
            </div>
            <p style="margin:0 0 4px;font-size:13px;color:var(--text);">📦 ${itemLabels}</p>
            <p style="margin:0 0 4px;font-size:13px;color:var(--text-muted);">📍 ${r.address}</p>
            <p style="margin:0;font-size:12px;color:var(--text-muted);">${r.createdAt?.slice(0,10) || ''}</p>
          </div>`;
      }).join('')}
    </div>`;
}

function _handleSubmit() {
  const address = document.getElementById('re-addr')?.value?.trim();
  const note    = document.getElementById('re-note')?.value?.trim();

  if (!_selected.size) { showToast('장비를 하나 이상 선택해 주세요.', 'error'); return; }
  if (!address)        { showToast('배송 주소를 입력해 주세요.', 'error'); return; }

  const list = _load();
  list.unshift({
    id: 'RE' + Date.now(),
    empId: _empId(),
    empName: _empName(),
    items: [..._selected],
    address,
    note: note || '',
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  _save(list);
  _selected = new Set();
  _activeTab = 'history';
  showToast('장비 신청이 완료되었습니다.', 'success')
    addNotification({ type: 'success', title: '재택 장비', body: '장비 신청이 완료되었습니다.' });
  _render();
}
