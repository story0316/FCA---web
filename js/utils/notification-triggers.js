/**
 * notification-triggers.js — Smart notification auto-generator
 *
 * Runs once per session (or at most once per 6h) after login.
 * Checks OKR checkin recency, pending assessments, and 1:1 meeting gaps,
 * then calls addNotification() for any actionable items found.
 */

import { addNotification } from '../components/notification-hub.js';
import { getUser } from '../auth.js';

const LS_LAST_CHECK   = 'hr_notif_triggers_last';
const LS_GOALS        = 'hr_okr_goals';
const LS_CHECKINS     = 'hr_okr_checkins';
const LS_MEETINGS     = 'hr_one_on_ones';
const LS_NOTIFS       = 'hr_notifications';
const LS_REF_REQUESTS = 'hr_ref_requests';
const LS_REF_MINE     = 'hr_ref_my_request';
const LS_APPLICANT    = 'hr_applicant_data';
const LS_OFFERS       = 'hr_received_offers';
const LS_IDP          = 'hr_idp_items';
const LS_LEAVE        = 'hr_leave_requests';
const LS_PULSE        = 'hr_pulse_responses';
const LS_PEER_REVIEWS = 'hr_peer_reviews';
const LS_PAYSLIPS     = 'hr_payslips';
const CHECK_INTERVAL  = 6 * 60 * 60 * 1000; // 6 hours

// ── Public API ────────────────────────────────────────────────

export function runNotificationTriggers() {
  const user = getUser();
  if (!user?.id || user.id === 'demo') return;

  const last = Number(localStorage.getItem(LS_LAST_CHECK) || 0);
  if (Date.now() - last < CHECK_INTERVAL) return;
  localStorage.setItem(LS_LAST_CHECK, String(Date.now()));

  _checkOkrCheckins(user);
  _checkOneOnOnes(user);
  _checkAssessmentDeadlines(user);
  _checkIdpDeadlines(user);
  _checkReferenceStatus();
  _checkPendingOffer();
  _checkLeaveStatus(user);
  _checkPulseSurvey(user);
  _checkPeerReviewDeadline(user);
  _checkUnreadPayslip(user);
}

// ── OKR 체크인 리마인더 ────────────────────────────────────────

function _checkOkrCheckins(user) {
  const goals = _load(LS_GOALS, []).filter(g => g.userId === user.id);
  if (!goals.length) return;

  const checkins = _load(LS_CHECKINS, []).filter(c => c.userId === user.id);
  const now = Date.now();
  const STALE_DAYS = 14;

  goals.forEach(goal => {
    const myCheckins = checkins.filter(c => c.goalId === goal.id);
    const lastDate = myCheckins.length
      ? Math.max(...myCheckins.map(c => new Date(c.date || 0).getTime()))
      : 0;

    const daysSince = Math.floor((now - lastDate) / 86_400_000);

    if (daysSince >= STALE_DAYS) {
      const notifId = `okr_checkin_${goal.id}_${_weekKey()}`;
      if (_alreadyExists(notifId)) return;
      addNotification({
        id:    notifId,
        type:  'goal',
        title: 'OKR 체크인 리마인더',
        body:  `"${_truncate(goal.objective, 28)}" — ${daysSince === Infinity ? '아직 체크인 없음' : `마지막 체크인 ${daysSince}일 전`}`,
        route: '#/goals',
      });
    }
  });
}

// ── 1:1 미팅 리마인더 ──────────────────────────────────────────

function _checkOneOnOnes(user) {
  const meetings = _load(LS_MEETINGS, []).filter(m => m.userId === user.id);
  const now = Date.now();
  const STALE_DAYS = 30;

  if (!meetings.length) {
    const notifId = `one_on_one_new_${_monthKey()}`;
    if (_alreadyExists(notifId)) return;
    addNotification({
      id:    notifId,
      type:  'meeting',
      title: '1:1 미팅 예약 권장',
      body:  '이번 달 1:1 미팅이 아직 기록되지 않았습니다.',
      route: '#/reviews',
    });
    return;
  }

  const lastDate = Math.max(...meetings.map(m => new Date(m.date || 0).getTime()));
  const daysSince = Math.floor((now - lastDate) / 86_400_000);

  if (daysSince >= STALE_DAYS) {
    const notifId = `one_on_one_stale_${_monthKey()}`;
    if (_alreadyExists(notifId)) return;
    addNotification({
      id:    notifId,
      type:  'meeting',
      title: '1:1 미팅 리마인더',
      body:  `마지막 1:1 미팅으로부터 ${daysSince}일이 지났습니다. 미팅을 예약해 보세요.`,
      route: '#/reviews',
    });
  }
}

// ── 평가 기한 리마인더 ─────────────────────────────────────────

function _checkAssessmentDeadlines(user) {
  // Check localStorage-based assessment instances (demo/offline)
  const instances = _load('fca_user_instances_' + user.id, []);
  if (!instances.length) return;

  const now = Date.now();
  const WARN_DAYS = 7;

  instances.forEach(inst => {
    if (inst.status !== 'draft' && inst.status !== 'self_evaluation') return;
    if (!inst.due_date) return;

    const due = new Date(inst.due_date).getTime();
    const daysLeft = Math.ceil((due - now) / 86_400_000);

    if (daysLeft <= WARN_DAYS && daysLeft > 0) {
      const notifId = `assessment_due_${inst.id}_${_weekKey()}`;
      if (_alreadyExists(notifId)) return;
      addNotification({
        id:    notifId,
        type:  'assessment',
        title: '평가 마감 임박',
        body:  `"${_truncate(inst.cycle_name || '역량 평가', 24)}" 마감까지 ${daysLeft}일 남았습니다.`,
        route: '#/assessment',
      });
    }

    if (daysLeft <= 0) {
      const notifId = `assessment_overdue_${inst.id}`;
      if (_alreadyExists(notifId)) return;
      addNotification({
        id:    notifId,
        type:  'assessment',
        title: '평가 기한 초과',
        body:  `"${_truncate(inst.cycle_name || '역량 평가', 24)}" 평가가 아직 완료되지 않았습니다.`,
        route: '#/assessment',
      });
    }
  });
}

// ── 레퍼런스 체크 상태 알림 ────────────────────────────────────

function _checkReferenceStatus() {
  const myReq = _load(LS_REF_MINE, null);
  if (!myReq || !myReq.referees?.length) return;

  const total     = myReq.referees.length;
  const completed = myReq.referees.filter(r => r.status === 'completed').length;
  if (completed === 0) return;

  const notifId = `ref_check_${myReq.id}_${completed}`;
  if (_alreadyExists(notifId)) return;

  addNotification({
    id:    notifId,
    type:  'system',
    title: `레퍼런스 ${completed}/${total}건 완료`,
    body:  '레퍼런스 탭에서 진행 현황을 확인하세요.',
    route: '#/applicant/reference',
  });
}

// ── 미확인 오퍼 레터 알림 ─────────────────────────────────────

function _checkPendingOffer() {
  const appData = _load(LS_APPLICANT, {});
  if (appData.processStep === 'OFFER' && !appData.offerStatus) {
    const notifId = `offer_pending_${_monthKey()}`;
    if (_alreadyExists(notifId)) return;
    addNotification({
      id:    notifId,
      type:  'system',
      title: '오퍼 레터가 도착했습니다',
      body:  '지원 현황 페이지에서 오퍼 레터를 확인하고 응답해 주세요.',
      route: '#/applicant/apply',
    });
  }

  const offers = _load(LS_OFFERS, []);
  const unread  = offers.filter(o => o.status === 'SENT');
  if (unread.length > 0) {
    const notifId = `direct_offer_${unread[0].id}`;
    if (_alreadyExists(notifId)) return;
    addNotification({
      id:    notifId,
      type:  'system',
      title: `HR 매니저로부터 직접 오퍼가 도착했습니다 (${unread.length}건)`,
      body:  '마이페이지에서 받은 오퍼를 확인하세요.',
      route: '#/applicant/profile',
    });
  }
}

// ── IDP 마감 리마인더 ──────────────────────────────────────────

function _checkIdpDeadlines(user) {
  const items = _load(LS_IDP, []).filter(i => i.status !== 'completed');
  if (!items.length) return;

  const now = Date.now();
  const overdue = items.filter(i => i.target_date && new Date(i.target_date).getTime() < now);
  const urgent  = items.filter(i => {
    if (!i.target_date) return false;
    const days = Math.ceil((new Date(i.target_date).getTime() - now) / 86400000);
    return days >= 0 && days <= 7;
  });

  if (overdue.length > 0) {
    const notifId = `idp_overdue_${_weekKey()}`;
    if (!_alreadyExists(notifId)) {
      addNotification({
        id:    notifId,
        type:  'system',
        title: `IDP ${overdue.length}건 마감 초과`,
        body:  `성장 계획 ${overdue.length}건이 마감일을 지났습니다. 상태를 업데이트하세요.`,
        route: '#/idp',
      });
    }
  } else if (urgent.length > 0) {
    const notifId = `idp_urgent_${_weekKey()}`;
    if (!_alreadyExists(notifId)) {
      addNotification({
        id:    notifId,
        type:  'system',
        title: `IDP ${urgent.length}건 마감 임박`,
        body:  `성장 계획 ${urgent.length}건의 마감이 7일 이내입니다.`,
        route: '#/idp',
      });
    }
  }
}

// ── 휴가 승인/반려 결과 알림 ──────────────────────────────────
function _checkLeaveStatus(user) {
  const requests = _load(LS_LEAVE, []).filter(r => r.userId === user.id);
  requests.forEach(r => {
    if (r.status === 'approved') {
      const notifId = `leave_approved_${r.id}`;
      if (_alreadyExists(notifId)) return;
      addNotification({
        id:    notifId,
        type:  'system',
        title: '휴가 신청 승인됨',
        body:  `${r.type} (${r.startDate} ~ ${r.endDate}) 이 승인되었습니다.`,
        route: '#/leave',
      });
    } else if (r.status === 'rejected') {
      const notifId = `leave_rejected_${r.id}`;
      if (_alreadyExists(notifId)) return;
      addNotification({
        id:    notifId,
        type:  'system',
        title: '휴가 신청 반려됨',
        body:  `${r.type} (${r.startDate} ~ ${r.endDate}) 이 반려되었습니다. 사유를 확인하세요.`,
        route: '#/leave',
      });
    }
  });
}

// ── 펄스 서베이 미응답 리마인더 ───────────────────────────────
function _checkPulseSurvey(user) {
  const weekKey = _currentWeekKey();
  const responses = _load(LS_PULSE, []);
  const alreadyAnswered = responses.some(
    r => r.weekKey === weekKey && r.userId === user.id
  );
  if (alreadyAnswered) return;

  const notifId = `pulse_survey_${weekKey}`;
  if (_alreadyExists(notifId)) return;
  addNotification({
    id:    notifId,
    type:  'system',
    title: '이번 주 펄스 서베이 미응답',
    body:  '익명으로 참여하는 주간 만족도 체크입니다. 1분이면 충분해요.',
    route: '#/pulse-survey',
  });
}

// ── 동료 평가 마감 D-3 리마인더 ───────────────────────────────
function _checkPeerReviewDeadline(user) {
  const reviews = _load(LS_PEER_REVIEWS, []);
  const myReviews = reviews.filter(r => r.evaluatorId === user.id && r.status === 'pending');
  if (!myReviews.length) return;

  const now = Date.now();
  myReviews.forEach(r => {
    if (!r.deadline) return;
    const daysLeft = Math.ceil((new Date(r.deadline).getTime() - now) / 86_400_000);
    if (daysLeft > 3 || daysLeft < 0) return;

    const notifId = `peer_review_due_${r.id}_d${daysLeft}`;
    if (_alreadyExists(notifId)) return;
    addNotification({
      id:    notifId,
      type:  'assessment',
      title: `동료 평가 마감 D-${daysLeft}`,
      body:  `${r.targetName || '동료'}님에 대한 평가를 아직 완료하지 않았습니다.`,
      route: '#/peer-review',
    });
  });
}

// ── 미확인 급여명세서 알림 ─────────────────────────────────────
function _checkUnreadPayslip(user) {
  const payslips = _load(LS_PAYSLIPS, []).filter(
    p => p.userId === user.id && !p.readAt
  );
  if (!payslips.length) return;

  const notifId = `payslip_unread_${_monthKey()}`;
  if (_alreadyExists(notifId)) return;
  addNotification({
    id:    notifId,
    type:  'system',
    title: `급여명세서 ${payslips.length}건 미확인`,
    body:  '이번 달 급여명세서가 발행되었습니다. 확인해 보세요.',
    route: '#/payslip',
  });
}

// ── Helpers ───────────────────────────────────────────────────

function _load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}

function _alreadyExists(id) {
  const notifs = _load(LS_NOTIFS, []);
  return notifs.some(n => n.id === id);
}

function _truncate(str, maxLen) {
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

function _weekKey() {
  const d = new Date();
  const week = Math.floor(d.getDate() / 7);
  return `${d.getFullYear()}W${d.getMonth()}${week}`;
}

function _currentWeekKey() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay() + 1); // 이번 주 월요일
  return d.toISOString().slice(0, 10);
}

function _monthKey() {
  const d = new Date();
  return `${d.getFullYear()}M${d.getMonth()}`;
}
