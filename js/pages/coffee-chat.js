import { isApplicant } from '../auth.js';
import showToast from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LEGACY_CP_IDS = new Set(['CP001','CP002','CP003','CP004','CP005']);

const LS_PROFILES = 'hr_coffee_chat_profiles';
const LS_MATCHES  = 'hr_coffee_chat_matches';

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId()   { return _session().empId || _session().userId || 'EMP001'; }
function _empName() { return _session().empName || '사용자'; }

function _profiles() {
  const stored = localStorage.getItem(LS_PROFILES);
  if (!stored) return [];
  try {
    const d = JSON.parse(stored);
    const cleaned = d.filter(p => !LEGACY_CP_IDS.has(p.id));
    if (cleaned.length < d.length) localStorage.setItem(LS_PROFILES, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}

function _matches()      { try { return JSON.parse(localStorage.getItem(LS_MATCHES) || '[]'); } catch { return []; } }
function _saveMatches(d) { localStorage.setItem(LS_MATCHES, JSON.stringify(d)); }

const STATUS_META = {
  pending:   { label: '대기중', color: '#f59e0b', bg: '#fef3c7' },
  confirmed: { label: '확정',   color: '#10b981', bg: '#d1fae5' },
  completed: { label: '완료',   color: '#6b7280', bg: '#f3f4f6' },
  cancelled: { label: '취소됨', color: '#ef4444', bg: '#fee2e2' },
};

let _root = null;
let _activeTab = 'list';

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
  _activeTab = 'list';
  _render();
}

export function unmount() {
  delete window._ccSetTab;
  delete window._ccRequest;
  _root = null;
}

function _render() {
  if (!_root) return;
  _root.innerHTML = `
    <div class="page" style="height:100vh;overflow:hidden;background:var(--bg);display:flex;flex-direction:column;">
      <div style="background:var(--card-bg);padding:16px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);flex-shrink:0;">
        <button onclick="window.navBack()" style="background:none;border:none;font-size:20px;cursor:pointer;padding:4px;">←</button>
        <h1 style="margin:0;font-size:17px;font-weight:700;color:var(--text);">사내 커피챗</h1>
      </div>
      <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0;">
        <button onclick="window._ccSetTab('list')"
          style="flex:1;padding:12px;border:none;background:none;font-size:14px;font-weight:600;cursor:pointer;color:${_activeTab==='list'?'#6366f1':'#6b7280'};border-bottom:2px solid ${_activeTab==='list'?'#6366f1':'transparent'};">
          참가자 목록
        </button>
        <button onclick="window._ccSetTab('matches')"
          style="flex:1;padding:12px;border:none;background:none;font-size:14px;font-weight:600;cursor:pointer;color:${_activeTab==='matches'?'#6366f1':'#6b7280'};border-bottom:2px solid ${_activeTab==='matches'?'#6366f1':'transparent'};">
          내 매칭
        </button>
      </div>
      <div class="page-content" style="overflow-y:auto;flex:1;">
        ${_activeTab === 'list' ? _renderList() : _renderMatches()}
      </div>
    </div>`;

  window._ccSetTab = (t) => { _activeTab = t; _render(); };
  window._ccRequest = _handleRequest;
}

function _renderList() {
  const profiles = _profiles().filter(p => p.empId !== _empId());
  const myMatches = _matches().filter(m => m.requesterId === _empId());
  const requestedTo = new Set(myMatches.map(m => m.targetEmpId));

  if (!profiles.length) return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:12px;">
      <span style="font-size:48px;">☕</span>
      <p style="margin:0;font-size:15px;font-weight:600;color:var(--text);">참가자가 없습니다</p>
    </div>`;

  return `
    <div style="padding:16px;display:flex;flex-direction:column;gap:12px;">
      <p style="margin:0;font-size:14px;color:var(--text-muted);">함께 커피챗 할 동료를 찾아보세요.</p>
      ${profiles.map(p => {
        const alreadyRequested = requestedTo.has(p.empId);
        return `
          <div style="background:var(--card-bg);border-radius:14px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px;flex-shrink:0;">
                  ${p.empName.charAt(0)}
                </div>
                <div>
                  <div style="font-size:15px;font-weight:700;color:var(--text);">${p.empName}</div>
                  <div style="font-size:12px;color:var(--text-muted);">${p.dept}</div>
                </div>
              </div>
              <button onclick="window._ccRequest('${p.empId}')" ${alreadyRequested?'disabled':''}
                style="padding:8px 14px;background:${alreadyRequested?'#f3f4f6':'#6366f1'};color:${alreadyRequested?'#9ca3af':'#fff'};border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:${alreadyRequested?'default':'pointer'};">
                ${alreadyRequested?'신청됨':'커피챗 신청'}
              </button>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
              <span style="font-size:12px;background:#ede9fe;color:#6366f1;padding:3px 8px;border-radius:20px;">💡 ${p.interest}</span>
              <span style="font-size:12px;background:#e0f2fe;color:#0284c7;padding:3px 8px;border-radius:20px;">🕐 ${p.availTime}</span>
            </div>
            <p style="margin:0;font-size:13px;color:var(--text);">${p.bio}</p>
          </div>`;
      }).join('')}
    </div>`;
}

function _renderMatches() {
  const myMatches = _matches().filter(m => m.requesterId === _empId());
  if (!myMatches.length) return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:12px;">
      <span style="font-size:48px;">☕</span>
      <p style="margin:0;font-size:15px;font-weight:600;color:var(--text);">매칭 내역이 없습니다</p>
      <p style="margin:0;font-size:13px;color:var(--text-muted);">동료에게 커피챗을 신청해 보세요.</p>
      <button onclick="window._ccSetTab('list')"
        style="padding:10px 20px;background:#6366f1;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;margin-top:4px;">
        참가자 보기
      </button>
    </div>`;

  return `
    <div style="padding:16px;display:flex;flex-direction:column;gap:12px;">
      ${myMatches.map(m => {
        const meta = STATUS_META[m.status] || STATUS_META.pending;
        return `
          <div style="background:var(--card-bg);border-radius:14px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span style="font-size:14px;font-weight:700;color:var(--text);">☕ ${m.targetEmpName}</span>
              <span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;background:${meta.bg};color:${meta.color};">${meta.label}</span>
            </div>
            <p style="margin:0;font-size:13px;color:var(--text-muted);">${m.targetDept} · ${m.createdAt?.slice(0,10) || ''}</p>
          </div>`;
      }).join('')}
    </div>`;
}

function _handleRequest(targetEmpId) {
  const profiles = _profiles();
  const target = profiles.find(p => p.empId === targetEmpId);
  if (!target) { showToast('참가자 정보를 찾을 수 없습니다.', 'error'); return; }
  if (targetEmpId === _empId()) { showToast('자기 자신에게는 신청할 수 없습니다.', 'error'); return; }

  const matches = _matches();
  const dup = matches.find(m => m.requesterId === _empId() && m.targetEmpId === targetEmpId);
  if (dup) { showToast('이미 신청한 상대입니다.', 'error'); return; }

  matches.unshift({
    id: 'CC' + Date.now(),
    requesterId: _empId(),
    requesterName: _empName(),
    targetEmpId: target.empId,
    targetEmpName: target.empName,
    targetDept: target.dept,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  _saveMatches(matches);
  showToast(`${target.empName}님께 커피챗 신청을 보냈습니다.`, 'success')
    addNotification({ type: 'success', title: '커피챗', body: '님께 커피챗 신청을 보냈습니다.' });
  _render();
}
