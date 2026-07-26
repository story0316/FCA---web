import { isApplicant } from '../auth.js';
import showToast from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const TOPICS = ['업무 피드백', '커리어 고민', '팀 내 이슈', '복지/처우', '기타'];

const STATUS_META = {
  pending:   { label: '대기 중',  color: '#f59e0b', bg: '#fef3c7' },
  confirmed: { label: '확정',     color: '#10b981', bg: '#d1fae5' },
  completed: { label: '완료',     color: '#6b7280', bg: '#f3f4f6' },
  cancelled: { label: '취소됨',   color: '#ef4444', bg: '#fee2e2' },
};

let _root = null;
let _activeTab = 'apply';

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId()   { return _session().empId   || 'EMP001'; }
function _empName() { return _session().empName || '사용자'; }

function _getRequests() {
  try { return JSON.parse(localStorage.getItem('hr_one_on_ones') || '[]'); } catch { return []; }
}
function _saveRequests(list) {
  localStorage.setItem('hr_one_on_ones', JSON.stringify(list));
}

function _renderApplyTab() {
  return `
    <div style="padding:16px;display:flex;flex-direction:column;gap:16px;">
      <p style="margin:0;font-size:14px;color:var(--text-muted);">팀장과의 면담을 신청합니다. 원하는 주제와 일정을 선택해 주세요.</p>

      <div>
        <label style="font-size:13px;font-weight:600;color:var(--text);display:block;margin-bottom:6px;">면담 주제 *</label>
        <select id="oo1-topic" style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;box-sizing:border-box;background:var(--card-bg);">
          <option value="">주제를 선택하세요</option>
          ${TOPICS.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
      </div>

      <div>
        <label style="font-size:13px;font-weight:600;color:var(--text);display:block;margin-bottom:6px;">희망 일시 *</label>
        <input type="datetime-local" id="oo1-datetime"
          style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;box-sizing:border-box;" />
      </div>

      <div>
        <label style="font-size:13px;font-weight:600;color:var(--text);display:block;margin-bottom:6px;">전달 사항</label>
        <textarea maxlength="500" id="oo1-note" rows="4" placeholder="면담에서 다루고 싶은 내용을 미리 작성해 주세요. (선택)"
          style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;resize:none;box-sizing:border-box;font-family:inherit;"></textarea>
      </div>

      <button onclick="window._oo1Submit()"
        style="width:100%;padding:14px;background:#6366f1;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;">
        면담 신청하기
      </button>
    </div>
  `;
}

function _renderHistoryTab() {
  const all = _getRequests().filter(r => r.empId === _empId());
  if (!all.length) {
    return `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:12px;">
        <span style="font-size:48px;">💬</span>
        <p style="margin:0;font-size:15px;font-weight:600;color:var(--text);">면담 신청 내역이 없습니다</p>
        <p style="margin:0;font-size:13px;color:var(--text-muted);">팀장과의 면담을 신청해 보세요.</p>
        <button onclick="window._oo1SetTab('apply')"
          style="padding:10px 20px;background:#6366f1;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;margin-top:4px;">
          신청하기
        </button>
      </div>
    `;
  }
  return `
    <div style="padding:16px;display:flex;flex-direction:column;gap:12px;">
      ${all.map(r => {
        const meta = STATUS_META[r.status] || STATUS_META.pending;
        const dt = r.preferredDatetime ? new Date(r.preferredDatetime).toLocaleString('ko-KR', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '-';
        return `
          <div style="background:var(--card-bg);border-radius:14px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-size:14px;font-weight:700;color:var(--text);">${r.topic}</span>
              <span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;background:${meta.bg};color:${meta.color};">${meta.label}</span>
            </div>
            <p style="margin:0 0 4px;font-size:13px;color:var(--text-muted);">희망 일시: ${dt}</p>
            <p style="margin:0 0 4px;font-size:13px;color:var(--text-muted);">담당 팀장: ${r.managerName}</p>
            ${r.note ? `<p style="margin:4px 0 0;font-size:13px;color:var(--text);">${r.note}</p>` : ''}
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
        <h1 style="margin:0;font-size:17px;font-weight:700;color:var(--text);">면담 신청</h1>
      </div>
      <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0;">
        <button onclick="window._oo1SetTab('apply')"
          style="flex:1;padding:12px;border:none;background:none;font-size:14px;font-weight:600;cursor:pointer;color:${_activeTab === 'apply' ? '#6366f1' : '#6b7280'};border-bottom:2px solid ${_activeTab === 'apply' ? '#6366f1' : 'transparent'};">
          신청하기
        </button>
        <button onclick="window._oo1SetTab('history')"
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

window._oo1SetTab = function(tab) {
  _activeTab = tab;
  _render();
};

window._oo1Submit = function() {
  const topic = document.getElementById('oo1-topic')?.value;
  const datetime = document.getElementById('oo1-datetime')?.value;
  const note = document.getElementById('oo1-note')?.value?.trim();

  if (!topic) return showToast('면담 주제를 선택해 주세요.', 'error');
  if (!datetime) return showToast('희망 일시를 입력해 주세요.', 'error');

  const list = _getRequests();
  list.unshift({
    id: 'OO1' + Date.now(),
    empId: _empId(),
    empName: _empName(),
    topic,
    preferredDatetime: datetime,
    note: note || '',
    managerName: '팀장',
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  _saveRequests(list);
  _activeTab = 'history';
  showToast('면담 신청이 완료되었습니다.', 'success')
    addNotification({ type: 'success', title: '1:1 미팅', body: '면담 신청이 완료되었습니다.' });
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
  _render();
}

export function unmount() {
  delete window._oo1SetTab;
  delete window._oo1Submit;
  _root = null;
}
