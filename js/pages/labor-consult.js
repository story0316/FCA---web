import { isApplicant } from '../auth.js';
import showToast from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const CONSULT_TYPES = [
  { key: 'leave',    label: '휴가/휴직',    icon: '🌴' },
  { key: 'wage',     label: '임금/수당',    icon: '💰' },
  { key: 'worktime', label: '근로시간',     icon: '⏰' },
  { key: 'conflict', label: '직장 내 갈등', icon: '🤝' },
  { key: 'contract', label: '계약/해고',    icon: '📜' },
  { key: 'other',    label: '기타',         icon: '❓' },
];

const STATUS_META = {
  pending:  { label: '접수 완료', color: '#f59e0b', bg: '#fef3c7' },
  answered: { label: '답변 완료', color: '#10b981', bg: '#d1fae5' },
  closed:   { label: '종료',      color: '#6b7280', bg: '#f3f4f6' },
};

let _root = null;
let _activeTab = 'apply';
let _selectedType = null;

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId()   { return _session().empId || _session().userId || 'EMP001'; }
function _empName() { return _session().empName || '사용자'; }

function _getConsults() {
  try { return JSON.parse(localStorage.getItem('hr_labor_consults') || '[]'); } catch { return []; }
}
function _saveConsults(list) {
  localStorage.setItem('hr_labor_consults', JSON.stringify(list));
}

function _renderApplyTab() {
  return `
    <div style="padding:16px;display:flex;flex-direction:column;gap:16px;">
      <p style="margin:0;font-size:14px;color:var(--text-muted);">노무 관련 궁금한 사항을 상담 신청해 보세요. 담당자가 검토 후 답변 드립니다.</p>

      <div>
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:8px;">상담 유형 *</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${CONSULT_TYPES.map(t => `
            <button onclick="window._lcSelectType('${t.key}')"
              style="display:flex;align-items:center;gap:10px;padding:12px;border-radius:12px;border:2px solid ${_selectedType === t.key ? '#6366f1' : '#e5e7eb'};background:${_selectedType === t.key ? '#ede9fe' : '#fff'};cursor:pointer;text-align:left;">
              <span style="font-size:22px;">${t.icon}</span>
              <span style="font-size:13px;font-weight:600;color:var(--text);">${t.label}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <div>
        <label style="font-size:13px;font-weight:600;color:var(--text);display:block;margin-bottom:6px;">상담 내용 *</label>
        <textarea maxlength="500" id="lc-question" rows="5" placeholder="궁금하신 내용을 자세히 작성해 주세요."
          style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;resize:none;box-sizing:border-box;font-family:inherit;"></textarea>
      </div>

      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
        <input type="checkbox" id="lc-anon" style="width:18px;height:18px;accent-color:#6366f1;" />
        <span style="font-size:14px;color:var(--text);">익명으로 상담 신청</span>
      </label>

      <button onclick="window._lcSubmit()"
        style="width:100%;padding:14px;background:#6366f1;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;">
        상담 신청하기
      </button>
    </div>
  `;
}

function _renderMyTab() {
  const all = _getConsults().filter(r => r.empId === _empId());
  if (!all.length) {
    return `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:12px;">
        <span style="font-size:48px;">⚖️</span>
        <p style="margin:0;font-size:15px;font-weight:600;color:var(--text);">상담 내역이 없습니다</p>
        <p style="margin:0;font-size:13px;color:var(--text-muted);">노무 관련 궁금한 사항을 상담해 보세요.</p>
        <button onclick="window._lcSetTab('apply')"
          style="padding:10px 20px;background:#6366f1;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;margin-top:4px;">
          상담 신청
        </button>
      </div>
    `;
  }
  return `
    <div style="padding:16px;display:flex;flex-direction:column;gap:12px;">
      ${all.map(r => {
        const type = CONSULT_TYPES.find(t => t.key === r.type) || {};
        const meta = STATUS_META[r.status] || STATUS_META.pending;
        return `
          <div style="background:var(--card-bg);border-radius:14px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-size:14px;font-weight:700;color:var(--text);">${type.icon || ''} ${type.label || r.type}</span>
              <span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;background:${meta.bg};color:${meta.color};">${meta.label}</span>
            </div>
            <p style="margin:0 0 6px;font-size:13px;color:var(--text);">${r.anonymous ? '(익명)' : r.empName} · ${r.createdAt?.slice(0,10) || ''}</p>
            <p style="margin:0;font-size:13px;color:var(--text-muted);">${r.question}</p>
            ${r.status === 'answered' && r.answer ? `
              <div style="margin-top:10px;padding:10px;background:#f0fdf4;border-radius:8px;border-left:3px solid #10b981;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#10b981;">노무 담당자 답변</p>
                <p style="margin:0;font-size:13px;color:var(--text);">${r.answer}</p>
              </div>
            ` : ''}
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
        <h1 style="margin:0;font-size:17px;font-weight:700;color:var(--text);">노무 상담</h1>
      </div>
      <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0;">
        <button onclick="window._lcSetTab('apply')"
          style="flex:1;padding:12px;border:none;background:none;font-size:14px;font-weight:600;cursor:pointer;color:${_activeTab === 'apply' ? '#6366f1' : '#6b7280'};border-bottom:2px solid ${_activeTab === 'apply' ? '#6366f1' : 'transparent'};">
          상담 신청
        </button>
        <button onclick="window._lcSetTab('my')"
          style="flex:1;padding:12px;border:none;background:none;font-size:14px;font-weight:600;cursor:pointer;color:${_activeTab === 'my' ? '#6366f1' : '#6b7280'};border-bottom:2px solid ${_activeTab === 'my' ? '#6366f1' : 'transparent'};">
          내 상담
        </button>
      </div>
      <div class="page-content" style="overflow-y:auto;flex:1;">
        ${_activeTab === 'apply' ? _renderApplyTab() : _renderMyTab()}
      </div>
    </div>
  `;
}

window._lcSelectType = function(key) {
  _selectedType = key;
  _render();
};

window._lcSetTab = function(tab) {
  _activeTab = tab;
  _render();
};

window._lcSubmit = function() {
  const question = document.getElementById('lc-question')?.value?.trim();
  const anonymous = document.getElementById('lc-anon')?.checked || false;

  if (!_selectedType) return showToast('상담 유형을 선택해 주세요.', 'error');
  if (!question) return showToast('상담 내용을 입력해 주세요.', 'error');

  const list = _getConsults();
  list.unshift({
    id: 'LC' + Date.now(),
    empId: _empId(),
    empName: _empName(),
    type: _selectedType,
    question,
    anonymous,
    status: 'pending',
    answer: '',
    createdAt: new Date().toISOString(),
  });
  _saveConsults(list);
  _selectedType = null;
  _activeTab = 'my';
  showToast('상담 신청이 완료되었습니다.', 'success')
    addNotification({ type: 'success', title: '노무 상담', body: '상담 신청이 완료되었습니다.' });
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
  delete window._lcSelectType;
  delete window._lcSetTab;
  delete window._lcSubmit;
  _root = null;
  _selectedType = null;
}
