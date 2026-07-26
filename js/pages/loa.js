import { isApplicant } from '../auth.js';
import showToast from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const TODAY = new Date().toISOString().slice(0,10);

const LOA_TYPES = [
  { key: 'illness', label: '상병 휴직', icon: '🏥' },
  { key: 'care', label: '가족돌봄 휴직', icon: '👨‍👩‍👧' },
  { key: 'study', label: '학업 휴직', icon: '📚' },
  { key: 'personal', label: '개인 사유', icon: '🧑' },
];

const STATUS_META = {
  pending:  { label: '검토 중',   color: '#f59e0b', bg: '#fef3c7' },
  approved: { label: '승인',      color: '#10b981', bg: '#d1fae5' },
  rejected: { label: '반려',      color: '#ef4444', bg: '#fee2e2' },
  active:   { label: '휴직 중',   color: '#6366f1', bg: '#ede9fe' },
  ended:    { label: '복직 완료', color: '#6b7280', bg: '#f3f4f6' },
};

let _root = null;
let _activeTab = 'apply';
let _selectedType = null;

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId()   { return _session().empId || _session().userId || 'EMP001'; }
function _empName() { return _session().empName || '사용자'; }

function _getRequests() {
  try { return JSON.parse(localStorage.getItem('hr_loa_requests') || '[]'); } catch { return []; }
}
function _saveRequests(list) {
  localStorage.setItem('hr_loa_requests', JSON.stringify(list));
}

function _daysBetween(start, end) {
  const ms = new Date(end) - new Date(start);
  return Math.max(0, Math.round(ms / 86400000));
}

function _renderApplyTab() {
  return `
    <div style="padding:16px;display:flex;flex-direction:column;gap:16px;">
      <p style="margin:0;font-size:14px;color:var(--text-muted);">휴직 유형을 선택하고 신청서를 작성해 주세요.</p>

      <div>
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:8px;">휴직 유형 *</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${LOA_TYPES.map(t => `
            <button id="loa-type-${t.key}" onclick="window._loaSelectType('${t.key}')"
              style="display:flex;align-items:center;gap:10px;padding:14px;border-radius:12px;border:2px solid ${_selectedType === t.key ? '#6366f1' : '#e5e7eb'};background:${_selectedType === t.key ? '#ede9fe' : '#fff'};cursor:pointer;text-align:left;">
              <span style="font-size:24px;">${t.icon}</span>
              <span style="font-size:13px;font-weight:600;color:var(--text);">${t.label}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="font-size:13px;font-weight:600;color:var(--text);display:block;margin-bottom:6px;">휴직 시작일 *</label>
          <input type="date" id="loa-start" min="${TODAY}" value="${TODAY}" style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;box-sizing:border-box;" />
        </div>
        <div>
          <label style="font-size:13px;font-weight:600;color:var(--text);display:block;margin-bottom:6px;">휴직 종료일 *</label>
          <input type="date" id="loa-end" min="${TODAY}" style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;box-sizing:border-box;" />
        </div>
        <div>
          <label style="font-size:13px;font-weight:600;color:var(--text);display:block;margin-bottom:6px;">휴직 사유 *</label>
          <textarea maxlength="500" id="loa-reason" rows="3" placeholder="휴직이 필요한 사유를 구체적으로 작성해 주세요."
            style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;resize:none;box-sizing:border-box;font-family:inherit;"></textarea>
        </div>
        <div>
          <label style="font-size:13px;font-weight:600;color:var(--text);display:block;margin-bottom:6px;">복직 계획</label>
          <textarea maxlength="500" id="loa-return" rows="2" placeholder="복직 후 업무 복귀 계획을 작성해 주세요. (선택)"
            style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;resize:none;box-sizing:border-box;font-family:inherit;"></textarea>
        </div>
      </div>

      <button onclick="window._loaSubmit()"
        style="width:100%;padding:14px;background:#6366f1;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;">
        신청하기
      </button>
    </div>
  `;
}

function _renderHistoryTab() {
  const all = _getRequests().filter(r => r.empId === _empId());
  if (!all.length) {
    return `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:12px;">
        <span style="font-size:48px;">📋</span>
        <p style="margin:0;font-size:15px;font-weight:600;color:var(--text);">신청 내역이 없습니다</p>
        <p style="margin:0;font-size:13px;color:var(--text-muted);">첫 번째 휴직 신청을 작성해 보세요.</p>
        <button onclick="window._loaSetTab('apply')"
          style="padding:10px 20px;background:#6366f1;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;margin-top:4px;">
          신청하기
        </button>
      </div>
    `;
  }
  return `
    <div style="padding:16px;display:flex;flex-direction:column;gap:12px;">
      ${all.map(r => {
        const type = LOA_TYPES.find(t => t.key === r.type) || {};
        const meta = STATUS_META[r.status] || STATUS_META.pending;
        const days = _daysBetween(r.startDate, r.endDate);
        return `
          <div style="background:var(--card-bg);border-radius:14px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-size:14px;font-weight:700;color:var(--text);">${type.icon || ''} ${type.label || r.type}</span>
              <span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;background:${meta.bg};color:${meta.color};">${meta.label}</span>
            </div>
            <p style="margin:0 0 4px;font-size:13px;color:var(--text-muted);">${r.startDate} ~ ${r.endDate} (${days}일)</p>
            <p style="margin:0;font-size:13px;color:var(--text);">${r.reason}</p>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function _render() {
  if (!_root) return;
  _root.innerHTML = `
    <div class="page" style="height:100vh;overflow:hidden;background:var(--bg);display:flex;flex-direction:column;">
      <div style="background:var(--card-bg);padding:16px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);flex-shrink:0;">
        <button onclick="window.navBack()" style="background:none;border:none;font-size:20px;cursor:pointer;padding:4px;">←</button>
        <h1 style="margin:0;font-size:17px;font-weight:700;color:var(--text);">휴직 신청</h1>
      </div>
      <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0;">
        <button onclick="window._loaSetTab('apply')"
          style="flex:1;padding:12px;border:none;background:none;font-size:14px;font-weight:600;cursor:pointer;color:${_activeTab === 'apply' ? '#6366f1' : '#6b7280'};border-bottom:2px solid ${_activeTab === 'apply' ? '#6366f1' : 'transparent'};">
          신청하기
        </button>
        <button onclick="window._loaSetTab('history')"
          style="flex:1;padding:12px;border:none;background:none;font-size:14px;font-weight:600;cursor:pointer;color:${_activeTab === 'history' ? '#6366f1' : '#6b7280'};border-bottom:2px solid ${_activeTab === 'history' ? '#6366f1' : 'transparent'};">
          신청 내역
        </button>
      </div>
      <div class="page-content" style="overflow-y:auto;flex:1;">
        ${_activeTab === 'apply' ? _renderApplyTab() : _renderHistoryTab()}
      </div>
    </div>
  `;
}

window._loaSelectType = function(key) {
  _selectedType = key;
  _render();
};

window._loaSetTab = function(tab) {
  _activeTab = tab;
  _render();
};

window._loaSubmit = function() {
  const start = document.getElementById('loa-start')?.value;
  const end = document.getElementById('loa-end')?.value;
  const reason = document.getElementById('loa-reason')?.value?.trim();
  const returnPlan = document.getElementById('loa-return')?.value?.trim();

  if (!_selectedType) return showToast('휴직 유형을 선택해 주세요.', 'error');
  if (!start) return showToast('시작일을 입력해 주세요.', 'error');
  if (!end) return showToast('종료일을 입력해 주세요.', 'error');
  if (new Date(end) <= new Date(start)) return showToast('종료일은 시작일보다 이후여야 합니다.', 'error');
  if (!reason) return showToast('휴직 사유를 입력해 주세요.', 'error');

  const list = _getRequests();
  list.unshift({
    id: 'LOA' + Date.now(),
    empId: _empId(),
    empName: _empName(),
    type: _selectedType,
    startDate: start,
    endDate: end,
    reason,
    returnPlan: returnPlan || '',
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  _saveRequests(list);
  _selectedType = null;
  _activeTab = 'history';
  showToast('휴직 신청이 완료되었습니다.', 'success')
    addNotification({ type: 'success', title: '휴직 신청', body: '휴직 신청이 완료되었습니다.' });
  _render();
};

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
  _selectedType = null;
  _render();
}

export function unmount() {
  delete window._loaSelectType;
  delete window._loaSetTab;
  delete window._loaSubmit;
  _root = null;
  _selectedType = null;
}
