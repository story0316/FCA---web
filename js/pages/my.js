/**
 * my.js — 내 것 (#/my)
 * 근태·급여·복지·결재 통합 개인 허브
 */

import { getUser, isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';

const TODAY = new Date().toISOString().slice(0, 10);

function _session() { try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; } }
function _empId()   { const s = _session(); return s.empId || s.userId || getUser()?.id || 'demo'; }
function _fmt(n)    { return Number(n || 0).toLocaleString('ko-KR'); }

// ── 데이터 읽기 ───────────────────────────────────────────────

function _getTodayAtt() {
  try {
    const uid  = _empId();
    const all  = JSON.parse(localStorage.getItem('hr_attendance') || '[]');
    return all.find(r => r.empId === uid && r.date === TODAY) || null;
  } catch { return null; }
}

function _getLeaveBalance() {
  try {
    const uid      = _empId();
    const policies = JSON.parse(localStorage.getItem('hr_leave_policies') || '[]');
    const mine     = policies.find(p => p.empId === uid);
    if (mine) return { remaining: mine.remaining ?? mine.annual ?? 15, annual: mine.annual ?? 15 };
    return { remaining: 15, annual: 15 };
  } catch { return { remaining: 15, annual: 15 }; }
}

function _getLatestPayslip() {
  try {
    const uid  = _empId();
    const all  = JSON.parse(localStorage.getItem('hr_payslips') || '[]');
    const mine = all.filter(p => p.empId === uid || p.userId === uid)
                    .sort((a, b) => (b.yearMonth || b.period || '').localeCompare(a.yearMonth || a.period || ''));
    return mine[0] || null;
  } catch { return null; }
}

function _getWelfarePoints() {
  try {
    const uid  = _empId();
    const all  = JSON.parse(localStorage.getItem('hr_welfare_points') || '[]');
    const mine = all.find(p => p.empId === uid || p.userId === uid);
    return mine ? (mine.balance ?? mine.points ?? 0) : 0;
  } catch { return 0; }
}

function _getPendingApprovals() {
  try {
    const uid  = _empId();
    const all  = JSON.parse(localStorage.getItem('hr_approvals') || '[]');
    return all.filter(a => a.requesterId === uid && a.status === 'pending').length;
  } catch { return 0; }
}

function _getLeaveRequests() {
  try {
    const uid = _empId();
    const all = JSON.parse(localStorage.getItem('hr_leave_requests') || '[]');
    return all.filter(r => r.empId === uid || r.userId === uid)
              .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
              .slice(0, 3);
  } catch { return []; }
}

// ── 출근 처리 ─────────────────────────────────────────────────

function _clockIn(root) {
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
    _draw(root);
  } catch { showToast('출근 처리 실패', 'error'); }
}

function _clockOut(root) {
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
    _draw(root);
  } catch { showToast('퇴근 처리 실패', 'error'); }
}

// ── 렌더 ──────────────────────────────────────────────────────

function _draw(root) {
  const att       = _getTodayAtt();
  const leave     = _getLeaveBalance();
  const payslip   = _getLatestPayslip();
  const points    = _getWelfarePoints();
  const pending   = _getPendingApprovals();
  const leaveReqs = _getLeaveRequests();

  const attStatus = att?.checkIn
    ? (att.checkOut ? `${att.checkIn} 출근 · ${att.checkOut} 퇴근` : `${att.checkIn} 출근 중`)
    : '미출근';
  const attColor = att?.checkIn ? (att.checkOut ? '#10B981' : '#4F46E5') : '#F59E0B';

  root.innerHTML = `
<div class="page" style="background:var(--bg)">
  <div class="top-bar">
    <div class="top-bar-title">👤 내 것</div>
  </div>

  <div class="page-content" style="padding:16px;padding-bottom:32px">

    <!-- KPI 3개 -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px">
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
                  padding:12px;text-align:center">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">출근</div>
        <div style="font-size:10px;font-weight:700;color:${attColor};line-height:1.4">
          ${att?.checkIn ? (att.checkOut ? '퇴근 완료' : '출근 중') : '미출근'}
        </div>
      </div>
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
                  padding:12px;text-align:center">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">잔여 휴가</div>
        <div style="font-size:18px;font-weight:800;color:#4F46E5">${leave.remaining}</div>
        <div style="font-size:9px;color:var(--text-muted)">/ ${leave.annual}일</div>
      </div>
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
                  padding:12px;text-align:center">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">결재 대기</div>
        <div style="font-size:18px;font-weight:800;color:${pending > 0 ? '#EF4444' : '#10B981'}">${pending}</div>
        <div style="font-size:9px;color:var(--text-muted)">건</div>
      </div>
    </div>

    <!-- 오늘 근태 -->
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
                padding:16px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:13px;font-weight:700;color:var(--text)">⏱️ 오늘 근태</div>
        <button onclick="window.location.hash='#/attendance'"
          style="font-size:11px;color:#4F46E5;background:none;border:none;cursor:pointer;font-weight:600">
          전체 보기 →
        </button>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px">${attStatus}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <button id="my-clockin"
          style="padding:11px;background:${att?.checkIn ? '#F1F5F9' : '#4F46E5'};
                 color:${att?.checkIn ? 'var(--text-muted)' : '#fff'};border:none;border-radius:10px;
                 font-size:13px;font-weight:700;cursor:${att?.checkIn ? 'default' : 'pointer'}">
          ${att?.checkIn ? '✅ 출근 완료' : '📍 출근하기'}
        </button>
        <button id="my-clockout"
          style="padding:11px;background:${att?.checkOut ? '#F1F5F9' : (att?.checkIn ? '#EF4444' : '#F1F5F9')};
                 color:${att?.checkOut ? 'var(--text-muted)' : (att?.checkIn ? '#fff' : 'var(--text-muted)')};
                 border:none;border-radius:10px;font-size:13px;font-weight:700;
                 cursor:${att?.checkIn && !att?.checkOut ? 'pointer' : 'default'}">
          ${att?.checkOut ? '✅ 퇴근 완료' : '🏁 퇴근하기'}
        </button>
      </div>
    </div>

    <!-- 휴가 -->
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
                padding:16px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:13px;font-weight:700;color:var(--text)">📅 휴가</div>
        <button onclick="window.location.hash='#/leave'"
          style="font-size:11px;color:#4F46E5;background:none;border:none;cursor:pointer;font-weight:600">
          신청 내역 →
        </button>
      </div>
      <!-- 잔여 프로그레스 -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden">
          <div style="height:100%;background:#4F46E5;border-radius:4px;
                      width:${Math.round((leave.remaining/leave.annual)*100)}%;transition:width .4s"></div>
        </div>
        <span style="font-size:12px;font-weight:700;color:#4F46E5;flex-shrink:0">
          ${leave.remaining}/${leave.annual}일
        </span>
      </div>
      <!-- 최근 신청 -->
      ${leaveReqs.length ? leaveReqs.map(r => `
      <div style="display:flex;justify-content:space-between;align-items:center;
                  padding:8px 0;border-top:1px solid var(--border)">
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--text)">${r.leaveType || r.type || '연차'}</div>
          <div style="font-size:10px;color:var(--text-muted)">${r.startDate || r.date || ''} ~ ${r.endDate || r.date || ''}</div>
        </div>
        <span style="font-size:10px;padding:2px 8px;border-radius:6px;font-weight:700;
          background:${r.status==='approved'?'#D1FAE5':r.status==='rejected'?'#FEE2E2':'#FEF3C7'};
          color:${r.status==='approved'?'#059669':r.status==='rejected'?'#DC2626':'#D97706'}">
          ${r.status==='approved'?'승인':r.status==='rejected'?'반려':'대기'}
        </span>
      </div>`).join('') : `
      <div style="text-align:center;padding:16px 8px;color:var(--text-muted)">
        <div style="font-size:28px;margin-bottom:6px">📭</div>
        <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px">신청 내역이 없습니다</div>
        <div style="font-size:11px">휴가를 신청하면 여기에 표시됩니다.</div>
      </div>`}
      <button onclick="window.location.hash='#/leave/apply'"
        style="width:100%;margin-top:10px;padding:10px;background:#EEF2FF;color:#4F46E5;
               border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">
        + 휴가 신청
      </button>
    </div>

    <!-- 급여 -->
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
                padding:16px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:13px;font-weight:700;color:var(--text)">💰 급여</div>
        <button onclick="window.location.hash='#/payslip'"
          style="font-size:11px;color:#4F46E5;background:none;border:none;cursor:pointer;font-weight:600">
          명세서 →
        </button>
      </div>
      ${payslip ? `
      <div style="display:flex;justify-content:space-between;align-items:flex-end">
        <div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">
            ${payslip.yearMonth || payslip.period || ''} 실수령액
          </div>
          <div style="font-size:22px;font-weight:800;color:var(--text)">
            ₩${_fmt(payslip.netPay || payslip.netAmount || payslip.amount)}
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:10px;color:var(--text-muted)">공제 합계</div>
          <div style="font-size:13px;font-weight:700;color:#EF4444">
            -₩${_fmt(payslip.totalDeductions || payslip.deductions)}
          </div>
        </div>
      </div>` : `
      <div style="text-align:center;padding:16px 8px;color:var(--text-muted)">
        <div style="font-size:28px;margin-bottom:6px">💳</div>
        <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px">급여 명세서가 없습니다</div>
        <div style="font-size:11px;margin-bottom:10px">이번 달 급여 지급 후 확인할 수 있습니다.</div>
        <button onclick="window.location.hash='#/ai-consult'"
          style="padding:7px 16px;background:#EEF2FF;color:#4F46E5;border:none;
                 border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">HR 문의하기</button>
      </div>`}
    </div>

    <!-- 복지 포인트 -->
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
                padding:16px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:13px;font-weight:700;color:var(--text)">🎁 복지 포인트</div>
        <button onclick="window.location.hash='#/welfare-points'"
          style="font-size:11px;color:#4F46E5;background:none;border:none;cursor:pointer;font-weight:600">
          내역 →
        </button>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:26px;font-weight:800;color:#8B5CF6">
          ${_fmt(points)}<span style="font-size:13px;font-weight:600;margin-left:2px">P</span>
        </div>
        <button onclick="window.location.hash='#/welfare-shop'"
          style="padding:8px 16px;background:#8B5CF6;color:#fff;border:none;
                 border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">
          쇼핑하기
        </button>
      </div>
    </div>

    <!-- 빠른 링크 -->
    <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.06em;
                margin-bottom:10px">자주 쓰는 기능</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
      ${[
        { icon: '📍', label: '근태', hash: '#/attendance' },
        { icon: '💸', label: '경비', hash: '#/expense' },
        { icon: '⏱️', label: '초과근무', hash: '#/overtime-request' },
        { icon: '✅', label: '결재', hash: '#/approval' },
        { icon: '📜', label: '증명서', hash: '#/certificate' },
        { icon: '📋', label: '재택근무', hash: '#/remote-work' },
        { icon: '🏥', label: '건강검진', hash: '#/health-exam' },
        { icon: '💳', label: '복리후생', hash: '#/benefits' },
      ].map(l => `
      <button onclick="window.location.hash='${l.hash}'"
        style="display:flex;flex-direction:column;align-items:center;gap:5px;
               padding:12px 4px;background:var(--card-bg);border:1.5px solid var(--border);
               border-radius:10px;cursor:pointer;transition:border-color .15s">
        <span style="font-size:20px">${l.icon}</span>
        <span style="font-size:10px;font-weight:600;color:var(--text)">${l.label}</span>
      </button>`).join('')}
    </div>

  </div>
</div>`;

  root.querySelector('#my-clockin')?.addEventListener('click', () => {
    if (!att?.checkIn) _clockIn(root);
  });
  root.querySelector('#my-clockout')?.addEventListener('click', () => {
    if (att?.checkIn && !att?.checkOut) _clockOut(root);
  });
}

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `
<div class="page" style="background:var(--bg)">
  <div class="top-bar"><div class="top-bar-title">👤 내 것</div></div>
  <div class="page-content" style="padding:60px 24px;text-align:center">
    <div style="font-size:48px;margin-bottom:16px">🔒</div>
    <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용</div>
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:20px">입사 후 이용 가능합니다.</div>
    <button onclick="window.location.hash='#/applicant'"
      style="padding:10px 24px;background:#4F46E5;color:#fff;border:none;border-radius:10px;
             font-size:13px;font-weight:700;cursor:pointer">내 지원 현황 보기</button>
  </div>
</div>`;
    return;
  }
  _draw(root);
}
export function unmount() {}
