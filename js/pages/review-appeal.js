import { isApplicant } from '../auth.js';
import showToast from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const APPEAL_REASONS = [
  '평가 기준 불명확',
  '근거 자료 부족',
  '비교 불공정',
  '절차 위반',
  '기타',
];

const STATUS_META = {
  pending:   { label: '접수',    color: '#f59e0b', bg: '#fef3c7' },
  reviewing: { label: '검토중',  color: '#3b82f6', bg: '#dbeafe' },
  resolved:  { label: '처리완료', color: '#10b981', bg: '#d1fae5' },
  rejected:  { label: '기각',    color: '#ef4444', bg: '#fee2e2' },
};

const LS_KEY = 'hr_review_appeals';

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId()   { return _session().empId || _session().userId || 'EMP001'; }
function _empName() { return _session().name  || _session().empName || '사용자'; }

function _load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      const demo = [{
        id: `RA_DEMO_${_empId()}`,
        empId: _empId(),
        empName: _empName(),
        evalYear: 2024,
        evalPeriod: '하반기',
        reason: '평가 기준 불명확',
        detail: '상반기 대비 업무량이 30% 증가했으나 평가 결과가 하락한 근거를 이해하기 어렵습니다.',
        desiredOutcome: '평가 기준과 근거 자료 공유를 요청합니다.',
        status: 'resolved',
        resolution: '평가 위원회 검토 결과, 추가 면담을 진행하여 평가 결과를 설명드렸습니다.',
        createdAt: '2025-01-15T09:00:00.000Z',
      }];
      localStorage.setItem(LS_KEY, JSON.stringify(demo));
      return demo;
    }
    return JSON.parse(raw);
  } catch { return []; }
}
function _save(d) { localStorage.setItem(LS_KEY, JSON.stringify(d)); }

let _root = null;
let _activeTab = 'apply';

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
  delete window._raSetTab;
  delete window._raSubmit;
  _root = null;
}

function _render() {
  if (!_root) return;
  _root.innerHTML = `
    <div class="page" style="height:100vh;overflow:hidden;background:var(--bg);display:flex;flex-direction:column;">
      <div style="background:var(--card-bg);padding:16px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);flex-shrink:0;">
        <button onclick="window.navBack()" style="background:none;border:none;font-size:20px;cursor:pointer;padding:4px;">←</button>
        <h1 style="margin:0;font-size:17px;font-weight:700;color:var(--text);">인사고과 이의신청</h1>
      </div>
      <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0;">
        <button onclick="window._raSetTab('apply')"
          style="flex:1;padding:12px;border:none;background:none;font-size:14px;font-weight:600;cursor:pointer;color:${_activeTab==='apply'?'#6366f1':'#6b7280'};border-bottom:2px solid ${_activeTab==='apply'?'#6366f1':'transparent'};">
          이의신청
        </button>
        <button onclick="window._raSetTab('history')"
          style="flex:1;padding:12px;border:none;background:none;font-size:14px;font-weight:600;cursor:pointer;color:${_activeTab==='history'?'#6366f1':'#6b7280'};border-bottom:2px solid ${_activeTab==='history'?'#6366f1':'transparent'};">
          신청 내역
        </button>
      </div>
      <div class="page-content" style="overflow-y:auto;flex:1;">
        ${_activeTab === 'apply' ? _renderApply() : _renderHistory()}
      </div>
    </div>`;

  window._raSetTab = (t) => { _activeTab = t; _render(); };
  window._raSubmit = _handleSubmit;
}

function _renderApply() {
  return `
    <div style="padding:16px;display:flex;flex-direction:column;gap:16px;">
      <div style="background:#fef9c3;border:1px solid #fde047;border-radius:10px;padding:12px;display:flex;gap:10px;align-items:flex-start;">
        <span style="font-size:18px;flex-shrink:0;">ℹ️</span>
        <p style="margin:0;font-size:13px;color:#713f12;line-height:1.5;">이의신청은 평가 결과 통보 후 14일 이내 가능합니다.</p>
      </div>
      <div>
        <label style="font-size:13px;font-weight:600;color:var(--text);display:block;margin-bottom:6px;">평가 연도 *</label>
        <input id="ra-year" type="number" value="2025" min="2020" max="2030"
          style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;box-sizing:border-box;" />
      </div>
      <div>
        <label style="font-size:13px;font-weight:600;color:var(--text);display:block;margin-bottom:6px;">평가 기간 *</label>
        <select id="ra-period"
          style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;box-sizing:border-box;background:var(--card-bg);">
          <option value="">선택하세요</option>
          <option value="상반기">상반기</option>
          <option value="하반기">하반기</option>
          <option value="연간">연간</option>
        </select>
      </div>
      <div>
        <label style="font-size:13px;font-weight:600;color:var(--text);display:block;margin-bottom:6px;">이의신청 사유 *</label>
        <select id="ra-reason"
          style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;box-sizing:border-box;background:var(--card-bg);">
          <option value="">사유를 선택하세요</option>
          ${APPEAL_REASONS.map(r => `<option value="${r}">${r}</option>`).join('')}
        </select>
      </div>
      <div>
        <label style="font-size:13px;font-weight:600;color:var(--text);display:block;margin-bottom:6px;">상세 내용 *</label>
        <textarea maxlength="500" id="ra-detail" rows="4" placeholder="이의신청 사유를 구체적으로 작성해 주세요."
          style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;resize:none;box-sizing:border-box;font-family:inherit;"></textarea>
      </div>
      <div>
        <label style="font-size:13px;font-weight:600;color:var(--text);display:block;margin-bottom:6px;">희망 결과</label>
        <textarea maxlength="500" id="ra-desired" rows="3" placeholder="원하는 결과를 작성해 주세요. (선택)"
          style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;resize:none;box-sizing:border-box;font-family:inherit;"></textarea>
      </div>
      <button onclick="window._raSubmit()"
        style="width:100%;padding:14px;background:#6366f1;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;">
        이의신청 제출
      </button>
    </div>`;
}

function _renderHistory() {
  const all = _load().filter(r => r.empId === _empId());
  if (!all.length) return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:12px;">
      <span style="font-size:48px;">📝</span>
      <p style="margin:0;font-size:15px;font-weight:600;color:var(--text);">신청 내역이 없습니다</p>
      <p style="margin:0;font-size:13px;color:var(--text-muted);">인사고과에 이의가 있으면 신청해 보세요.</p>
      <button onclick="window._raSetTab('apply')"
        style="padding:10px 20px;background:#6366f1;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;margin-top:4px;">
        이의신청하기
      </button>
    </div>`;

  return `
    <div style="padding:16px;display:flex;flex-direction:column;gap:12px;">
      ${all.map(r => {
        const meta = STATUS_META[r.status] || STATUS_META.pending;
        return `
          <div style="background:var(--card-bg);border-radius:14px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-size:14px;font-weight:700;color:var(--text);">${r.evalYear}년 ${r.evalPeriod}</span>
              <span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;background:${meta.bg};color:${meta.color};">${meta.label}</span>
            </div>
            <p style="margin:0 0 4px;font-size:13px;color:var(--text-muted);">사유: ${r.reason}</p>
            <p style="margin:0 0 4px;font-size:13px;color:var(--text);">${r.detail}</p>
            ${r.status === 'resolved' && r.resolution ? `
              <div style="margin-top:10px;padding:10px;background:#f0fdf4;border-radius:8px;border-left:3px solid #10b981;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#10b981;">처리 결과</p>
                <p style="margin:0;font-size:13px;color:var(--text);">${r.resolution}</p>
              </div>` : ''}
          </div>`;
      }).join('')}
    </div>`;
}

function _handleSubmit() {
  const year    = parseInt(document.getElementById('ra-year')?.value || '0');
  const period  = document.getElementById('ra-period')?.value;
  const reason  = document.getElementById('ra-reason')?.value;
  const detail  = document.getElementById('ra-detail')?.value?.trim();
  const desired = document.getElementById('ra-desired')?.value?.trim();

  if (!year || year < 2020) { showToast('올바른 평가 연도를 입력해 주세요.', 'error'); return; }
  if (!period)  { showToast('평가 기간을 선택해 주세요.', 'error'); return; }
  if (!reason)  { showToast('이의신청 사유를 선택해 주세요.', 'error'); return; }
  if (!detail)  { showToast('상세 내용을 입력해 주세요.', 'error'); return; }

  const list = _load();
  list.unshift({
    id: 'RA' + Date.now(),
    empId: _empId(),
    empName: _empName(),
    evalYear: year,
    evalPeriod: period,
    reason,
    detail,
    desiredOutcome: desired || '',
    status: 'pending',
    resolution: '',
    createdAt: new Date().toISOString(),
  });
  _save(list);
  _activeTab = 'history';
  showToast('이의신청이 제출되었습니다.', 'success')
    addNotification({ type: 'success', title: '평가 이의', body: '이의신청이 제출되었습니다.' });
  _render();
}
