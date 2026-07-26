/**
 * dashboard.js — 홈 대시보드 (#/dashboard)
 * Quick Action + 오늘 현황 + 자주 쓰는 메뉴 + 알림
 */

import { getUser, isAdmin, isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
import { getLeaveBalance } from '../utils/leave-engine.js';
import { showOnboardingIfNeeded } from '../components/onboarding.js';
import { getFrequent, recordVisit } from '../utils/nav-recents.js';
import { MENU_INDEX } from '../data/menu-index.js';
import { api } from '../api.js';

const TODAY = new Date().toISOString().slice(0, 10);
const TODAY_LABEL = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

function _session() { try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; } }
function _empId()   { const s = _session(); return s.empId || s.userId || getUser()?.id || 'demo'; }
function _fmt(n)    { return Number(n || 0).toLocaleString('ko-KR'); }

let _root = null;
let _evalPending = 0;

// ── 데이터 읽기 ───────────────────────────────────────────────

function _getTodayAtt() {
  try {
    const uid = _empId();
    const all = JSON.parse(localStorage.getItem('hr_attendance') || '[]');
    return all.find(r => r.empId === uid && r.date === TODAY) || null;
  } catch { return null; }
}

function _getLeave() {
  try {
    const user = getUser();
    return getLeaveBalance(user?.id || 'demo', user?.hireDate || '2024-01-01');
  } catch { return { remaining: 15, entitlement: 15 }; }
}

function _getPendingApprovals() {
  try {
    const uid = _empId();
    const all = JSON.parse(localStorage.getItem('hr_approvals') || '[]');
    return all.filter(a => a.requesterId === uid && a.status === 'pending').length;
  } catch { return 0; }
}

function _getNotices() {
  try {
    const all = JSON.parse(localStorage.getItem('hr_notices') || '[]');
    return all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 1);
  } catch { return []; }
}

async function _getPendingInstances() {
  try {
    const uid = getUser()?.id;
    if (!uid || uid === 'demo') return 0;
    const DONE = new Set(['completed', 'calibrated', 'approved', 'finalized', 'cancelled']);

    // Try live API first; falls back to localStorage cache if unavailable
    let instances = null;
    try {
      const result = await api.assessment.listInstances(uid);
      if (Array.isArray(result)) {
        instances = result;
        // Keep localStorage cache warm for app.js nav badge
        try { localStorage.setItem('fca_user_instances_' + uid, JSON.stringify(instances)); } catch {}
      }
    } catch {}

    if (!instances) {
      // Fallback to localStorage cache (e.g. demo mode or network error)
      instances = JSON.parse(localStorage.getItem('fca_user_instances_' + uid) || '[]');
    }

    return instances.filter(i => !DONE.has(i.status)).length;
  } catch { return 0; }
}

// ── 출근/퇴근 처리 ────────────────────────────────────────────

function _clockIn() {
  try {
    const uid = _empId();
    const all = JSON.parse(localStorage.getItem('hr_attendance') || '[]');
    if (all.find(r => r.empId === uid && r.date === TODAY && r.checkIn)) {
      showToast('이미 출근 처리되었습니다.', 'info'); return;
    }
    const now = new Date().toTimeString().slice(0, 5);
    all.push({ empId: uid, date: TODAY, checkIn: now, checkOut: null, status: 'present' });
    localStorage.setItem('hr_attendance', JSON.stringify(all));
    showToast(`출근 완료 (${now})`, 'success');
    addNotification({ type: 'success', title: '출근', body: `${now} 출근 처리되었습니다.` });
    if (_root) _draw(_root, _evalPending);
  } catch { showToast('출근 처리 실패', 'error'); }
}

function _clockOut() {
  try {
    const uid = _empId();
    const all = JSON.parse(localStorage.getItem('hr_attendance') || '[]');
    const idx = all.findIndex(r => r.empId === uid && r.date === TODAY);
    if (idx === -1) { showToast('출근 기록이 없습니다.', 'warning'); return; }
    if (all[idx].checkOut) { showToast('이미 퇴근 처리되었습니다.', 'info'); return; }
    const now = new Date().toTimeString().slice(0, 5);
    all[idx].checkOut = now;
    localStorage.setItem('hr_attendance', JSON.stringify(all));
    showToast(`퇴근 완료 (${now})`, 'success');
    if (_root) _draw(_root, _evalPending);
  } catch { showToast('퇴근 처리 실패', 'error'); }
}

// ── 렌더 ──────────────────────────────────────────────────────

function _draw(root, evalPending = 0) {
  const user    = getUser();
  const name    = user?.name_ko || user?.name || user?.email?.split('@')[0] || '사용자';
  const admin   = isAdmin();
  const att     = _getTodayAtt();
  const leave   = _getLeave();
  const pending = _getPendingApprovals();
  const notices = _getNotices();

  // 자주 쓰는 메뉴 (nav-recents 기반) — admin 전용 메뉴는 관리자에게만 노출
  const frequent = getFrequent(8)
    .map(r => MENU_INDEX.find(m => m.hash === r.hash))
    .filter(Boolean)
    .filter(m => !m.roles || m.roles.includes('admin') ? admin : true);

  const attStatus = att?.checkIn
    ? (att.checkOut ? `${att.checkIn} 출근 · ${att.checkOut} 퇴근 완료` : `${att.checkIn} 출근 중`)
    : '미출근';
  const attColor = att?.checkIn ? (att.checkOut ? '#10B981' : '#4F46E5') : '#F59E0B';
  const leavePct = leave.entitlement > 0
    ? Math.round((leave.remaining / leave.entitlement) * 100) : 0;
  const leaveColor = leavePct > 50 ? '#10B981' : leavePct > 20 ? '#F59E0B' : '#EF4444';

  root.innerHTML = `
<div class="page" style="background:var(--bg)">
  <div class="top-bar">
    <div style="flex:1">
      <div style="font-size:16px;font-weight:800;color:var(--text)">안녕하세요, ${_esc(name)}님 👋</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${TODAY_LABEL}</div>
    </div>
    ${admin ? `
    <button onclick="window.location.hash='#/admin'"
      style="padding:6px 12px;background:#EEF2FF;color:#4F46E5;border:none;
             border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">⚙️ 어드민</button>` : ''}
  </div>

  <div class="page-content" style="padding:16px;padding-bottom:32px">

    <!-- 알림 배너 (평가 대기, 결재 대기) -->
    ${(evalPending > 0 || pending > 0) ? `
    <div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:12px;
                padding:12px 14px;margin-bottom:16px;display:flex;align-items:center;gap:10px">
      <span style="font-size:20px">⚠️</span>
      <div style="flex:1;font-size:12px;color:#92400E;font-weight:600">
        ${[
          evalPending > 0 ? `평가 진행 중 ${evalPending}건` : '',
          pending > 0     ? `결재 대기 ${pending}건` : '',
        ].filter(Boolean).join(' · ')}
      </div>
      <button onclick="window.location.hash='#/diagnostics'"
        style="font-size:11px;color:#92400E;background:none;border:none;
               cursor:pointer;font-weight:700;flex-shrink:0">확인 →</button>
    </div>` : ''}

    <!-- Quick Action 4개 -->
    <div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.06em;
                  margin-bottom:10px">⚡ 빠른 실행</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
        <button id="db-clockin"
          style="display:flex;flex-direction:column;align-items:center;gap:6px;
                 padding:14px 4px;background:${att?.checkIn ? 'var(--card-bg)' : '#4F46E5'};
                 color:${att?.checkIn ? 'var(--text-muted)' : '#fff'};border:1.5px solid ${att?.checkIn ? 'var(--border)' : '#4F46E5'};
                 border-radius:12px;cursor:pointer">
          <span style="font-size:22px">📍</span>
          <span style="font-size:10px;font-weight:700">${att?.checkIn ? '출근 완료' : '출근'}</span>
        </button>
        <button id="db-clockout"
          style="display:flex;flex-direction:column;align-items:center;gap:6px;
                 padding:14px 4px;background:${att?.checkOut ? 'var(--card-bg)' : (att?.checkIn ? '#EF4444' : 'var(--card-bg)')};
                 color:${att?.checkOut ? 'var(--text-muted)' : (att?.checkIn ? '#fff' : 'var(--text-muted)')};
                 border:1.5px solid ${att?.checkIn && !att?.checkOut ? '#EF4444' : 'var(--border)'};
                 border-radius:12px;cursor:pointer">
          <span style="font-size:22px">🏁</span>
          <span style="font-size:10px;font-weight:700">${att?.checkOut ? '퇴근 완료' : '퇴근'}</span>
        </button>
        <button onclick="window.location.hash='#/leave/apply'"
          style="display:flex;flex-direction:column;align-items:center;gap:6px;
                 padding:14px 4px;background:var(--card-bg);border:1.5px solid var(--border);
                 border-radius:12px;cursor:pointer">
          <span style="font-size:22px">📅</span>
          <span style="font-size:10px;font-weight:700;color:var(--text)">휴가 신청</span>
        </button>
        <button onclick="window.location.hash='#/expense'"
          style="display:flex;flex-direction:column;align-items:center;gap:6px;
                 padding:14px 4px;background:var(--card-bg);border:1.5px solid var(--border);
                 border-radius:12px;cursor:pointer">
          <span style="font-size:22px">💸</span>
          <span style="font-size:10px;font-weight:700;color:var(--text)">경비 청구</span>
        </button>
      </div>
    </div>

    <!-- 오늘 현황 카드 -->
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
                padding:14px;margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:12px">📊 오늘 현황</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        <div style="text-align:center;padding:10px;background:var(--bg);border-radius:10px">
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">근태</div>
          <div style="font-size:11px;font-weight:700;color:${attColor}">
            ${att?.checkIn ? (att.checkOut ? '퇴근 완료' : '출근 중') : '미출근'}
          </div>
          ${att?.checkIn ? `<div style="font-size:9px;color:var(--text-muted);margin-top:2px">${att.checkIn}</div>` : ''}
        </div>
        <div style="text-align:center;padding:10px;background:var(--bg);border-radius:10px">
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">잔여 휴가</div>
          <div style="font-size:18px;font-weight:800;color:${leaveColor}">${leave.remaining ?? '--'}</div>
          <div style="font-size:9px;color:var(--text-muted)">/ ${leave.entitlement ?? '--'}일</div>
        </div>
        <div style="text-align:center;padding:10px;background:var(--bg);border-radius:10px;
                    cursor:pointer" onclick="window.location.hash='#/approval'">
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">결재 대기</div>
          <div style="font-size:18px;font-weight:800;color:${pending > 0 ? '#EF4444' : '#10B981'}">${pending}</div>
          <div style="font-size:9px;color:var(--text-muted)">건</div>
        </div>
      </div>
    </div>

    <!-- 자주 쓰는 메뉴 -->
    ${frequent.length ? `
    <div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.06em;margin-bottom:10px">
        🕐 자주 쓰는 메뉴
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
        ${frequent.slice(0, 8).map(item => `
        <button onclick="window.location.hash='${item.hash}'"
          style="display:flex;flex-direction:column;align-items:center;gap:5px;
                 padding:12px 4px;background:var(--card-bg);border:1.5px solid var(--border);
                 border-radius:10px;cursor:pointer">
          <span style="font-size:20px">${item.icon}</span>
          <span style="font-size:10px;font-weight:600;color:var(--text);
                       text-align:center;line-height:1.3;word-break:keep-all">${_esc(item.title)}</span>
        </button>`).join('')}
      </div>
    </div>` : `
    <div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.06em;margin-bottom:10px">
        🚀 시작하기
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
        ${[
          { icon: '📍', title: '근태',     hash: '#/attendance' },
          { icon: '📅', title: '휴가',     hash: '#/leave' },
          { icon: '💰', title: '급여',     hash: '#/payslip' },
          { icon: '🎁', title: '복지',     hash: '#/benefits' },
          { icon: '📈', title: '성장',     hash: '#/growth' },
          { icon: '🔬', title: '진단',     hash: '#/diagnostics' },
          { icon: '✅', title: '결재',     hash: '#/approval' },
          { icon: '☰',  title: '더보기',  hash: '#/more' },
        ].map(item => `
        <button onclick="window.location.hash='${item.hash}'"
          style="display:flex;flex-direction:column;align-items:center;gap:5px;
                 padding:12px 4px;background:var(--card-bg);border:1.5px solid var(--border);
                 border-radius:10px;cursor:pointer">
          <span style="font-size:20px">${item.icon}</span>
          <span style="font-size:10px;font-weight:600;color:var(--text)">${item.title}</span>
        </button>`).join('')}
      </div>
    </div>`}

    <!-- 공지사항 최신 1건 -->
    ${notices.length ? `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
                padding:14px;margin-bottom:16px;cursor:pointer"
         onclick="window.location.hash='#/notice'">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span style="font-size:14px">📢</span>
        <span style="font-size:11px;font-weight:700;color:var(--text-muted)">최신 공지</span>
        <span style="margin-left:auto;font-size:11px;color:#4F46E5;font-weight:600">전체 보기 →</span>
      </div>
      <div style="font-size:13px;font-weight:600;color:var(--text);
                  white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
        ${_esc(notices[0].title)}
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:3px">${notices[0].author || ''}</div>
    </div>` : ''}

    <!-- 바로가기 링크 모음 -->
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${[
        { icon: '🏢', label: '조직도',     hash: '#/org-chart' },
        { icon: '📊', label: '내 성장',    hash: '#/growth' },
        { icon: '🤖', label: 'AI 상담',   hash: '#/ai-consult' },
        { icon: '🗺️', label: '전체 메뉴', hash: '#/more' },
      ].map(l => `
      <button onclick="window.location.hash='${l.hash}'"
        style="display:flex;align-items:center;gap:6px;padding:8px 14px;
               background:var(--card-bg);border:1.5px solid var(--border);
               border-radius:20px;cursor:pointer;font-size:12px;
               font-weight:600;color:var(--text)">
        ${l.icon} ${l.label}
      </button>`).join('')}
    </div>

  </div>
</div>`;

  // 출근/퇴근 버튼
  root.querySelector('#db-clockin')?.addEventListener('click', () => {
    if (!att?.checkIn) _clockIn();
  });
  root.querySelector('#db-clockout')?.addEventListener('click', () => {
    if (att?.checkIn && !att?.checkOut) _clockOut();
  });
}

function _esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `
<div style="padding:60px 24px;text-align:center;background:var(--bg);min-height:100vh">
  <div style="font-size:56px;margin-bottom:20px">👋</div>
  <div style="font-size:17px;font-weight:800;color:var(--text);margin-bottom:8px">환영합니다!</div>
  <div style="font-size:13px;color:var(--text-muted);line-height:1.6;margin-bottom:32px">
    채용 절차가 진행 중입니다.<br>면접 일정, 결과, 합격 안내를 확인하세요.
  </div>
  <div style="display:flex;flex-direction:column;gap:10px;max-width:280px;margin:0 auto">
    <button onclick="location.hash='#/interview'"
      style="padding:14px;background:#4F46E5;color:#fff;border:none;
             border-radius:12px;font-size:14px;font-weight:700;cursor:pointer">
      📅 면접 일정 확인
    </button>
    <button onclick="location.hash='#/results'"
      style="padding:14px;background:var(--card-bg);color:var(--text);
             border:1px solid var(--border);border-radius:12px;font-size:14px;
             font-weight:700;cursor:pointer">
      📋 전형 결과 확인
    </button>
  </div>
</div>`;
    return;
  }

  _root = root;

  // Fetch live assessment pending count (updates localStorage cache for nav badge too)
  _evalPending = await _getPendingInstances();
  _draw(root, _evalPending);
  showOnboardingIfNeeded(getUser());
}

export function unmount() {
  _root = null;
  _evalPending = 0;
}
