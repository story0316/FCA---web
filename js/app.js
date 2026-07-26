/**
 * app.js – SPA Router & Bootstrap
 * HR Competency OS
 */

// Detect new deploys and force-reload so stale SW/HTTP caches don't persist.
// window.__BUILD_TS__ is injected by build.js into index.html on every deploy.
// Value 0 = local dev, skip the check.
;(function checkBuildVersion() {
  const ts = String(window.__BUILD_TS__ || 0);
  if (ts === '0') return;
  const stored = localStorage.getItem('hr_build_ts');
  localStorage.setItem('hr_build_ts', ts);
  if (stored && stored !== ts) {
    // New deploy detected — clear all SW caches then hard-reload
    if ('caches' in window) {
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).finally(() => {
        location.reload(true);
      });
    } else {
      location.reload(true);
    }
  }
}());

import { isLoggedIn, getUser, isAdmin, getUserStatus, isApplicant, isMember, isAlumni } from './auth.js';
import { recordVisit } from './utils/nav-recents.js';
import { showToast } from './components/toast.js';
import { mountFeedbackButton, unmountFeedbackButton } from './components/feedback-button.js';
import { mountNotificationBell, unmountNotificationBell } from './components/notification-hub.js';
import { runNotificationTriggers } from './utils/notification-triggers.js';
import { initTheme, mountThemeToggle, unmountThemeToggle } from './utils/theme.js';
import { mountSearchBtn, unmountSearchBtn } from './components/global-search.js';
// realtime.js는 외부 CDN(esm.sh)에 의존하므로 지연 로드
import { isRouteEnabled, isNavEnabled } from './utils/feature-flags.js';
import { getActivePersona, getPersonaNavItems, getUserPersonas, getPersonaDef } from './utils/persona.js';

// ── Route registry ────────────────────────────────────────────
const routes = {
  '#/login':           () => import('./pages/login.js'),
  '#/register':        () => import('./pages/register.js'),
  '#/mode':            () => import('./pages/mode_switcher.js'),
  '#/persona-select':  () => import('./pages/persona-select.js'),
  '#/dashboard':  () => import('./pages/dashboard.js'),
  '#/assessment': () => import('./pages/assessment.js'),
  '#/results':    () => import('./pages/results.js'),
  '#/interview':  () => import('./pages/interview.js'),
  '#/idp':        () => import('./pages/idp.js'),
  '#/analytics':  () => import('./pages/analytics.js'),
  '#/diagnostic': () => import('./pages/diagnostic.js'),
  '#/admin':                  () => import('./pages/admin/admin_dashboard.js'),
  '#/admin/template-builder': () => import('./pages/admin/template_builder.js'),
  '#/admin/config':           () => import('./pages/admin/config_mgmt.js'),
  '#/survey':                 () => import('./pages/survey.js'),
  '#/diagnostics':            () => import('./pages/diagnostics.js'),
  '#/hr-competency':          () => import('./pages/hr_competency.js'),
  '#/journey':                () => import('./pages/journey.js'),
  '#/growth':                 () => import('./pages/growth.js'),
  '#/applicant':              () => import('./pages/applicant/applicant_dashboard.js'),
  '#/applicant/career':       () => import('./pages/applicant/career.js'),
  '#/applicant/reference':    () => import('./pages/applicant/reference.js'),
  '#/applicant/apply':        () => import('./pages/applicant/my_application.js'),
  '#/applicant/profile':      () => import('./pages/applicant/profile_settings.js'),
  '#/aptitude':               () => import('./pages/applicant/aptitude.js'),
  '#/aptitude/test':          () => import('./pages/applicant/aptitude_test.js'),
  '#/admin/aptitude':         () => import('./pages/admin/aptitude_mgmt.js'),
  '#/jobs':                   () => import('./pages/jobs.js'),
  '#/alumni':                 () => import('./pages/alumni/alumni_dashboard.js'),
  '#/alumni/boomerang':       () => import('./pages/alumni/boomerang.js'),
  '#/reference-check':        () => import('./pages/reference_check.js'),
  '#/goals':                  () => import('./pages/goals.js'),
  '#/reviews':                () => import('./pages/reviews.js'),
  '#/executive':              () => import('./pages/executive.js'),
  '#/manager':                () => import('./pages/manager.js'),
  '#/change-password':        () => import('./pages/change-password.js'),
  '#/modules':                () => import('./pages/modules-list.js'),
  '#/ai-consult':             () => import('./pages/ai_consult.js'),
  '#/attendance':             () => import('./pages/attendance.js'),
  '#/leave':                  () => import('./pages/leave.js'),
  '#/leave/apply':            () => import('./pages/leave-apply.js'),
  '#/admin/leave':            () => import('./pages/admin/leave-admin.js'),
  '#/payslip':                () => import('./pages/payslip.js'),
  '#/admin/workhours':        () => import('./pages/admin/workhours-report.js'),
  '#/legal-edu':              () => import('./pages/legal-edu.js'),
  '#/harassment-report':      () => import('./pages/harassment-report.js'),
  '#/parental-leave':         () => import('./pages/parental-leave.js'),
  '#/admin/hr-dashboard':     () => import('./pages/admin/hr-dashboard.js'),
  '#/benefits':               () => import('./pages/benefits.js'),
  '#/salary-calc':            () => import('./pages/salary-calc.js'),
  '#/kudos':                  () => import('./pages/kudos.js'),
  '#/notice':                 () => import('./pages/notice.js'),
  '#/pulse-survey':           () => import('./pages/pulse-survey.js'),
  '#/work-log':               () => import('./pages/work-log.js'),
  '#/meeting-note':           () => import('./pages/meeting-note.js'),
  '#/training':               () => import('./pages/training.js'),
  '#/asset-mgmt':             () => import('./pages/asset-mgmt.js'),
  '#/org-chart':              () => import('./pages/org-chart.js'),
  '#/okr':                    () => import('./pages/okr.js'),
  '#/expense':                () => import('./pages/expense.js'),
  '#/health-checkup':         () => import('./pages/health-checkup.js'),
  '#/mentoring':              () => import('./pages/mentoring.js'),
  '#/welfare-points':         () => import('./pages/welfare-points.js'),
  '#/room-booking':           () => import('./pages/room-booking.js'),
  '#/approval':               () => import('./pages/approval.js'),
  '#/certificate':            () => import('./pages/certificate.js'),
  '#/onboarding':             () => import('./pages/onboarding.js'),
  '#/skill-inventory':        () => import('./pages/skill-inventory.js'),
  '#/remote-work':            () => import('./pages/remote-work.js'),
  '#/peer-review':            () => import('./pages/peer-review.js'),
  '#/self-assessment':        () => import('./pages/self-assessment.js'),
  '#/offboarding':            () => import('./pages/offboarding.js'),
  '#/overtime-request':       () => import('./pages/overtime-request.js'),
  '#/club':                   () => import('./pages/club.js'),
  '#/idea-box':               () => import('./pages/idea-box.js'),
  '#/emergency-contact':      () => import('./pages/emergency-contact.js'),
  '#/team-calendar':          () => import('./pages/team-calendar.js'),
  '#/family-event':           () => import('./pages/family-event.js'),
  '#/company-handbook':       () => import('./pages/company-handbook.js'),
  '#/job-description':        () => import('./pages/job-description.js'),
  '#/survey-response':        () => import('./pages/survey-response.js'),
  '#/career-path':            () => import('./pages/career-path.js'),
  '#/work-report':            () => import('./pages/work-report.js'),
  '#/commute':                () => import('./pages/commute.js'),
  '#/benefit-enroll':         () => import('./pages/benefit-enroll.js'),
  '#/internal-transfer':      () => import('./pages/internal-transfer.js'),
  '#/safety-report':          () => import('./pages/safety-report.js'),
  '#/expense-claim':          () => import('./pages/expense-claim.js'),
  '#/wellness-check':         () => import('./pages/wellness-check.js'),
  '#/certification':          () => import('./pages/certification.js'),
  '#/project-apply':          () => import('./pages/project-apply.js'),
  '#/business-trip':          () => import('./pages/business-trip.js'),
  '#/lunch-order':            () => import('./pages/lunch-order.js'),
  '#/parking':                () => import('./pages/parking.js'),
  '#/salary-raise':           () => import('./pages/salary-raise-request.js'),
  '#/employee-referral':      () => import('./pages/employee-referral.js'),
  '#/business-card':          () => import('./pages/business-card.js'),
  '#/probation':              () => import('./pages/probation.js'),
  '#/supplies':               () => import('./pages/supplies-request.js'),
  '#/book-request':           () => import('./pages/book-request.js'),
  '#/workshop':               () => import('./pages/workshop.js'),
  '#/vehicle-request':        () => import('./pages/vehicle-request.js'),
  '#/it-support':             () => import('./pages/it-support.js'),
  '#/award':                  () => import('./pages/award.js'),
  '#/personnel-order':        () => import('./pages/personnel-order.js'),
  '#/green-activity':         () => import('./pages/green-activity.js'),
  '#/document-request':       () => import('./pages/document-request.js'),
  '#/flexible-work':          () => import('./pages/flexible-work.js'),
  '#/company-event':          () => import('./pages/company-event.js'),
  '#/career-coaching':        () => import('./pages/career-coaching.js'),
  '#/volunteer':              () => import('./pages/volunteer.js'),
  '#/study-group':            () => import('./pages/study-group.js'),
  '#/welfare-shop':           () => import('./pages/welfare-shop.js'),
  '#/edu-support':            () => import('./pages/edu-support.js'),
  '#/tenure-award':           () => import('./pages/tenure-award.js'),
  '#/counseling':             () => import('./pages/counseling.js'),
  '#/overseas':               () => import('./pages/overseas.js'),
  '#/salary-contract':        () => import('./pages/salary-contract.js'),
  '#/vote':                   () => import('./pages/vote.js'),
  '#/health-program':         () => import('./pages/health-program.js'),
  '#/info-update':            () => import('./pages/info-update.js'),
  '#/market':                 () => import('./pages/market.js'),
  '#/trainer':                () => import('./pages/trainer.js'),
  '#/team-building':          () => import('./pages/team-building.js'),
  '#/contest':                () => import('./pages/contest.js'),
  '#/loa':                    () => import('./pages/loa.js'),
  '#/one-on-one':             () => import('./pages/one-on-one.js'),
  '#/labor-consult':          () => import('./pages/labor-consult.js'),
  '#/remote-equipment':       () => import('./pages/remote-equipment.js'),
  '#/coffee-chat':            () => import('./pages/coffee-chat.js'),
  '#/review-appeal':          () => import('./pages/review-appeal.js'),
  '#/bulletin':               () => import('./pages/bulletin.js'),
  '#/raffle':                 () => import('./pages/raffle.js'),
  '#/points-history':         () => import('./pages/points-history.js'),
  '#/newsletter':             () => import('./pages/newsletter.js'),
  '#/peer-recognition':       () => import('./pages/peer-recognition.js'),
  '#/book-order':             () => import('./pages/book-order.js'),
  '#/seminar':                () => import('./pages/seminar.js'),
  '#/anniversary':            () => import('./pages/anniversary.js'),
  '#/meal-ticket':            () => import('./pages/meal-ticket.js'),
  '#/asset':                  () => import('./pages/asset.js'),
  '#/id-card':                () => import('./pages/id-card.js'),
  '#/goal-setting':           () => import('./pages/goal-setting.js'),
  '#/work-from-abroad':       () => import('./pages/work-from-abroad.js'),
  '#/uniform':                () => import('./pages/uniform.js'),
  '#/childcare':              () => import('./pages/childcare.js'),
  '#/language-class':         () => import('./pages/language-class.js'),
  '#/shuttle':                () => import('./pages/shuttle.js'),
  '#/health-exam':            () => import('./pages/health-exam.js'),
  '#/employee-survey':        () => import('./pages/employee-survey.js'),
  '#/patent':                 () => import('./pages/patent.js'),
  '#/team-lunch':             () => import('./pages/team-lunch.js'),
  '#/relocation':             () => import('./pages/relocation.js'),
  '#/stock-option':           () => import('./pages/stock-option.js'),
  '#/desk-setup':             () => import('./pages/desk-setup.js'),
  '#/flexible-benefit':       () => import('./pages/flexible-benefit.js'),
  '#/mentor-matching':        () => import('./pages/mentor-matching.js'),
  '#/work-anniversary':       () => import('./pages/work-anniversary.js'),
  '#/system-map':             () => import('./pages/system-map.js'),
  '#/notification-settings':  () => import('./pages/notification-settings.js'),
  '#/search':                 () => import('./pages/search.js'),
  '#/my':                     () => import('./pages/my.js'),
  '#/more':                   () => import('./pages/more.js'),
  '#/interview-portal':       () => import('./pages/interview-portal.js'),
  '#/admin/doc-review':       () => import('./pages/admin/doc-review.js'),
};

// ── Public routes (no auth required) ─────────────────────────
const PUBLIC_ROUTES = new Set(['#/login', '#/register', '#/reference-check', '#/mode']);

// ── Default home per user segment ────────────────────────────
const STATUS_HOME = { APPLICANT: '#/applicant', MEMBER: '#/dashboard', ALUMNI: '#/alumni' };

// ── Role-restricted routes ────────────────────────────────────
// APPLICANT-only routes (MEMBERs/ALUMNIs shouldn't see these)
const APPLICANT_ONLY_ROUTES = new Set([
  '#/applicant', '#/applicant/career', '#/applicant/reference',
  '#/applicant/apply', '#/applicant/profile', '#/aptitude', '#/aptitude/test',
]);
// MEMBER-only routes (APPLICANTs shouldn't access these)
const MEMBER_ONLY_ROUTES = new Set([
  '#/dashboard', '#/attendance', '#/leave', '#/leave/apply', '#/payslip',
  '#/goals', '#/reviews', '#/peer-review', '#/self-assessment', '#/growth',
  '#/onboarding', '#/offboarding', '#/probation', '#/salary-calc',
  '#/kudos', '#/pulse-survey', '#/work-log', '#/ai-consult',
  '#/benefits', '#/benefit-enroll', '#/welfare-points', '#/certificate',
  '#/training', '#/mentoring', '#/one-on-one', '#/commute',
  '#/notification-settings',
  // Phase 182: 누락된 직원 전용 라우트 추가
  '#/okr', '#/goal-setting', '#/idp', '#/flexible-benefit',
  '#/remote-work', '#/parental-leave', '#/loa', '#/career-path',
  '#/work-report', '#/welfare-shop',
  // Phase 202: Phase 199에서 isApplicant 가드 추가된 페이지 등록
  '#/assessment', '#/company-handbook', '#/info-update',
  '#/newsletter', '#/emergency-contact',
  // Phase 203: isApplicant 가드 있는 나머지 85개 라우트 일괄 등록
  '#/anniversary', '#/approval', '#/asset-mgmt', '#/asset', '#/award',
  '#/book-order', '#/book-request', '#/business-card', '#/business-trip',
  '#/career-coaching', '#/certification', '#/childcare', '#/club', '#/coffee-chat',
  '#/company-event', '#/contest', '#/counseling', '#/desk-setup', '#/document-request',
  '#/edu-support', '#/employee-referral', '#/employee-survey', '#/expense-claim', '#/expense',
  '#/family-event', '#/flexible-work', '#/green-activity', '#/harassment-report',
  '#/health-checkup', '#/health-exam', '#/health-program', '#/hr-competency',
  '#/id-card', '#/idea-box', '#/internal-transfer', '#/it-support',
  '#/journey', '#/labor-consult', '#/language-class', '#/legal-edu', '#/lunch-order',
  '#/manager', '#/market', '#/meal-ticket', '#/meeting-note', '#/mentor-matching',
  '#/org-chart', '#/overseas', '#/overtime-request', '#/parking', '#/patent',
  '#/peer-recognition', '#/personnel-order', '#/points-history', '#/project-apply',
  '#/raffle', '#/relocation', '#/remote-equipment',
  '#/review-appeal', '#/room-booking', '#/safety-report', '#/salary-contract',
  '#/salary-raise', '#/seminar', '#/shuttle', '#/skill-inventory', '#/stock-option',
  '#/study-group', '#/supplies', '#/survey-response', '#/team-building',
  '#/team-calendar', '#/team-lunch', '#/tenure-award', '#/trainer', '#/uniform',
  '#/vehicle-request', '#/volunteer', '#/vote', '#/wellness-check',
  '#/work-anniversary', '#/work-from-abroad', '#/workshop',
  // Phase 206: isApplicant 가드 추가된 페이지 등록
  '#/bulletin', '#/job-description', '#/modules', '#/notice',
  // Menu Renewal: new pages
  '#/search', '#/my', '#/more',
  // Phase 225: 누락된 직원 전용 라우트 추가
  '#/analytics', '#/executive',
  // Phase 229: isApplicant 가드 있으나 MEMBER_ONLY 누락된 라우트
  '#/diagnostics',
  // Phase 234: 면접관 포털 + 서류 검토
  '#/interview-portal', '#/admin/doc-review',
]);
// ADMIN-only routes (비관리자 직접 URL 접근 차단, #/admin/* 는 아래 startsWith 가드로 추가 처리)
const ADMIN_ONLY_ROUTES = new Set([
  '#/executive', '#/manager',
]);
// ALUMNI-only routes (비동문 접근 차단)
const ALUMNI_ONLY_ROUTES = new Set([
  '#/alumni', '#/alumni/boomerang',
]);

// ── Shared state (pass data between pages) ────────────────────
window.appState = window.appState || {};
// navBack을 전역 노출 — 인라인 onclick에서 window.history.back() 대체 가능
window.navBack = () => navBack();

// ── Current mounted page module ───────────────────────────────
let currentModule = null;
let currentHash   = null;

// ── 내비게이션 히스토리 스택 ──────────────────────────────────
// 브라우저 history.back()은 SPA에서 예측 불가 — 자체 스택으로 관리
const _navStack  = [];  // [ '#/search', '#/jobs', ... ]

// 탭바 루트 — 이 라우트에서 뒤로가기 하면 홈으로
const _TAB_ROOTS = new Set([
  '#/dashboard', '#/diagnostics', '#/growth', '#/payslip', '#/my',
  '#/applicant', '#/alumni', '#/login', '#/register', '#/mode',
]);

export function navBack() {
  // 스택에서 현재 페이지 제거하고 이전 페이지로
  _navStack.pop();                          // 현재 라우트 제거
  const prev = _navStack.pop();             // 이전 라우트 (pop해서 라우터가 다시 push)
  if (prev) {
    window.location.hash = prev;
  } else {
    const status = getUserStatus();
    window.location.hash = { MEMBER: '#/dashboard', APPLICANT: '#/applicant', ALUMNI: '#/alumni' }[status] || '#/dashboard';
  }
}

// ── App root element ─────────────────────────────────────────
const appRoot = document.getElementById('app');
const bottomNav = document.getElementById('bottom-nav');
const sideNav   = document.getElementById('side-nav');

// ── Bottom nav: show/hide & active item ─────────────────────
const NAV_HIDDEN_ROUTES = new Set(['#/login', '#/register', '#/change-password', '#/persona-select']);

// Nav configs per segment
const NAV_CONFIGS = {
  APPLICANT: [
    { route: '#/mode',              icon: 'MODE', label: 'Mode',    adminOnly: true },
    { route: '#/applicant',         icon: '📋',   label: '현황',
      related: ['#/applicant/apply'] },
    { route: '#/jobs',              icon: '📢',   label: '채용공고' },
    { route: '#/applicant/career',  icon: '💼',   label: '커리어',
      related: ['#/diagnostic', '#/hr-competency', '#/diagnostics', '#/survey',
                '#/applicant/reference', '#/reference-check'] },
    { route: '#/applicant/profile', icon: '👤',   label: '내프로필' },
  ],
  MEMBER: [
    { route: '#/mode',        icon: 'MODE', label: 'Mode',  adminOnly: true },
    { route: '#/dashboard',   icon: '🏠',   label: '홈' },
    { route: '#/diagnostics', icon: '🎯',   label: '조직기여',
      related: ['#/okr', '#/goal-setting', '#/reviews', '#/peer-review', '#/self-assessment',
                '#/probation', '#/review-appeal', '#/assessment', '#/diagnostic',
                '#/hr-competency', '#/survey', '#/interview', '#/pulse-survey',
                '#/results', '#/employee-survey', '#/idea-box', '#/analytics'] },
    { route: '#/growth',      icon: '📈',   label: '성장',
      related: ['#/idp', '#/journey', '#/training', '#/legal-edu', '#/certification',
                '#/edu-support', '#/language-class', '#/workshop', '#/seminar',
                '#/mentoring', '#/mentor-matching', '#/career-coaching', '#/career-path',
                '#/skill-inventory', '#/one-on-one', '#/modules'] },
    { route: '#/payslip',     icon: '💰',   label: '보상',
      related: ['#/salary-calc', '#/salary-contract', '#/salary-raise', '#/stock-option',
                '#/benefits', '#/benefit-enroll', '#/welfare-points', '#/welfare-shop',
                '#/flexible-benefit', '#/kudos', '#/peer-recognition', '#/award',
                '#/tenure-award', '#/family-event', '#/raffle', '#/points-history'] },
    { route: '#/my',          icon: '🛟',   label: '지원',
      related: ['#/attendance', '#/commute', '#/leave', '#/leave/apply', '#/parental-leave',
                '#/loa', '#/overtime-request', '#/flexible-work', '#/remote-work',
                '#/work-from-abroad', '#/expense', '#/business-trip', '#/expense-claim',
                '#/document-request', '#/certificate', '#/info-update', '#/emergency-contact',
                '#/childcare', '#/relocation', '#/internal-transfer', '#/org-chart',
                '#/notice', '#/ai-consult', '#/more', '#/system-map', '#/approval',
                '#/room-booking', '#/parking', '#/shuttle', '#/meal-ticket', '#/it-support',
                '#/asset', '#/supplies', '#/book-order', '#/business-card', '#/salary-raise',
                '#/personnel-order', '#/id-card', '#/uniform', '#/desk-setup',
                '#/remote-equipment', '#/health-exam', '#/health-program', '#/wellness-check',
                '#/counseling', '#/green-activity', '#/safety-report', '#/harassment-report',
                '#/club', '#/study-group', '#/coffee-chat', '#/volunteer', '#/contest',
                '#/market', '#/vote', '#/newsletter', '#/bulletin', '#/notice',
                '#/team-building', '#/team-lunch', '#/team-calendar', '#/work-report'] },
    { route: '#/manager',     icon: '👥',   label: '팀관리', adminOnly: true },
    { route: '#/admin',       icon: '⚙️',   label: '어드민', adminOnly: true },
  ],
  ALUMNI: [
    { route: '#/mode', icon: 'MODE', label: 'Mode', adminOnly: true },
    { route: '#/alumni',           icon: '🏅', label: '나의이력' },
    { route: '#/alumni/boomerang', icon: '💼', label: '재입사협의' },
    { route: '#/diagnostic',       icon: '🧪', label: '진단Kit' },
  ],
};

function _getNavBadge(route) {
  try {
    const TERMINAL = new Set(['completed', 'calibrated', 'approved', 'finalized', 'cancelled']);
    if (route === '#/diagnostics') {
      const userId = JSON.parse(localStorage.getItem('hr_user') || '{}')?.id;
      if (userId && userId !== 'demo') {
        const inst = JSON.parse(localStorage.getItem('fca_user_instances_' + userId) || '[]');
        if (inst.length > 0) return inst.filter(i => !TERMINAL.has(i.status)).length;
      }
      return parseInt(localStorage.getItem('hr_nav_badge_diag') || '0', 10);
    }
    if (route === '#/growth') {
      const today = Date.now();
      const userId = JSON.parse(localStorage.getItem('hr_user') || '{}')?.id;
      if (userId) {
        const idp = JSON.parse(localStorage.getItem('hr_idp_items') || '[]');
        const idpOver = idp.filter(i =>
          i.status !== 'completed' && i.status !== 'done' &&
          (i.target_date || i.dueDate) &&
          new Date(i.target_date || i.dueDate).getTime() < today
        ).length;
        const goals = JSON.parse(localStorage.getItem('hr_okr_goals') || '[]')
          .filter(g => g.userId === userId);
        const goalOver = goals.filter(g =>
          (g.progress || 0) < 100 && g.deadline && new Date(g.deadline).getTime() < today
        ).length;
        if (idpOver + goalOver > 0) return idpOver + goalOver;
      }
      return parseInt(localStorage.getItem('hr_nav_badge_growth') || '0', 10);
    }
  } catch {}
  return 0;
}

export function refreshNavBadges({ pendingInstances = null, idpItems = null, goals = null } = {}) {
  try {
    const TERMINAL = new Set(['completed', 'calibrated', 'approved', 'finalized', 'cancelled']);
    if (pendingInstances !== null) {
      const pending = (Array.isArray(pendingInstances) ? pendingInstances : [])
        .filter(i => !TERMINAL.has(i.status)).length;
      localStorage.setItem('hr_nav_badge_diag', String(pending));
    }
    if (idpItems !== null || goals !== null) {
      const today = Date.now();
      let growthBadge = 0;
      if (Array.isArray(idpItems)) {
        growthBadge += idpItems.filter(item =>
          item.status !== 'done' && item.dueDate && new Date(item.dueDate).getTime() < today
        ).length;
      }
      if (Array.isArray(goals)) {
        growthBadge += goals.filter(g =>
          g.progress < 100 && g.deadline && new Date(g.deadline).getTime() < today
        ).length;
      }
      localStorage.setItem('hr_nav_badge_growth', String(growthBadge));
    }
    if (currentHash) updateBottomNav(currentHash);
  } catch {}
}

window.addEventListener('hr:navbadge', (e) => {
  try { refreshNavBadges(e.detail || {}); } catch {}
});

function updateBottomNav(routeKey) {
  if (!bottomNav) return;

  // 1. Hide nav on hidden routes
  if (NAV_HIDDEN_ROUTES.has(routeKey)) {
    bottomNav.classList.add('hidden');
    unmountFeedbackButton();
    unmountNotificationBell();
    unmountThemeToggle();
    unmountSearchBtn();
    return;
  }

  // 2. Show nav
  bottomNav.classList.remove('hidden');

  // 3. Mount feedback button + notification bell + theme toggle + search
  mountFeedbackButton();
  mountNotificationBell();
  mountThemeToggle();
  mountSearchBtn();

  // 4. Get current segment's nav config — persona overrides for MEMBER
  const status       = getUserStatus();
  const user         = getUser();
  const userPersonas = getUserPersonas(user);
  const personaItems = status === 'MEMBER'
    ? getPersonaNavItems(getActivePersona(), userPersonas)
    : null;
  const navItems     = personaItems || (NAV_CONFIGS[status] || NAV_CONFIGS.MEMBER);

  // 5. Render nav HTML
  const navHtml = navItems
    .filter(item => personaItems ? true : !(item.adminOnly && !isAdmin()))
    .filter(item => isNavEnabled(item.route))
    .map(item => {
      const isActive = routeKey === item.route
        || routeKey.startsWith(item.route + '/')
        || (item.related || []).some(r => routeKey === r || routeKey.startsWith(r + '/'));
      const adminId  = item.adminOnly ? ' id="nav-admin"' : '';
      const badge    = _getNavBadge(item.route);
      const badgeHtml = badge > 0
        ? `<span style="position:absolute;top:2px;right:calc(50% - 22px);background:#EF4444;color:#fff;border-radius:999px;font-size:0.52rem;font-weight:700;min-width:14px;height:14px;display:flex;align-items:center;justify-content:center;padding:0 3px;line-height:1;pointer-events:none;z-index:1">${badge > 9 ? '9+' : badge}</span>`
        : '';
      const iconContent = item.icon === 'MODE'
        ? `<span class="nav-icon" style="font-size:0.58rem;font-weight:800;letter-spacing:0">MODE</span>`
        : `<span class="nav-icon">${item.icon}</span>`;
      return `<a href="${item.route}" data-route="${item.route}"${adminId} aria-label="${item.label}"${isActive ? ' class="active"' : ''} style="position:relative">
        ${badgeHtml}
        ${iconContent}
        ${item.label}
      </a>`;
    })
    .join('');

  const logoutBtn = `<button id="nav-logout-btn" aria-label="로그아웃"
    style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
           flex:1;border:none;background:none;cursor:pointer;color:var(--text-muted);
           font-size:0.595rem;padding:5px 4px 6px;min-height:auto">
    <span class="nav-icon">🚪</span>로그아웃
  </button>`;

  bottomNav.innerHTML = navHtml + logoutBtn;

  bottomNav.querySelector('#nav-logout-btn')?.addEventListener('click', async () => {
    // If proxying as another user, return to admin instead of full logout
    const proxyOrig = localStorage.getItem('fca_proxy_original');
    if (proxyOrig) {
      try {
        const orig = JSON.parse(proxyOrig);
        localStorage.setItem('hr_token', orig.token);
        localStorage.setItem('hr_user', orig.user);
        localStorage.removeItem('fca_proxy_original');
        showToast('관리자 계정으로 돌아왔습니다.', 'success');
        window.location.hash = '#/dashboard';
      } catch (_) {
        performLogout();
      }
      return;
    }
    performLogout();
  });
}

async function performLogout() {
  try { const { stopRealtime } = await import('./utils/realtime.js'); stopRealtime(); } catch (_) {}
  try { await import('./api.js').then(m => m.api.auth.logout()); } catch (_) {}
  const { logout } = await import('./auth.js');
  logout();
}

// ── Desktop sidebar nav ──────────────────────────────────────
function updateSideNav(routeKey) {
  if (!sideNav) return;

  if (NAV_HIDDEN_ROUTES.has(routeKey)) {
    sideNav.classList.add('hidden');
    document.body.classList.remove('has-sidenav');
    return;
  }
  sideNav.classList.remove('hidden');
  document.body.classList.add('has-sidenav');

  const status       = getUserStatus();
  const user         = getUser();
  const userPersonas = getUserPersonas(user);
  const personaItems = status === 'MEMBER'
    ? getPersonaNavItems(getActivePersona(), userPersonas)
    : null;
  const navItems     = personaItems || (NAV_CONFIGS[status] || NAV_CONFIGS.MEMBER);

  const links = navItems
    .filter(item => personaItems ? true : !(item.adminOnly && !isAdmin()))
    .filter(item => isNavEnabled(item.route))
    .map(item => {
      const isActive = routeKey === item.route
        || routeKey.startsWith(item.route + '/')
        || (item.related || []).some(r => routeKey === r || routeKey.startsWith(r + '/'));
      return `<a href="${item.route}" class="desktop-nav-item${isActive ? ' active' : ''}"
                 aria-label="${item.label}">
        <span class="icon">${item.icon}</span>
        <span>${item.label}</span>
      </a>`;
    })
    .join('');

  const userName   = user?.name_ko || user?.email?.split('@')[0] || '사용자';
  const userRole   = user?.role === 'admin' ? '관리자' : user?.role === 'hr_admin' ? 'HR 관리자' : '직원';
  const activeDef  = getPersonaDef(getActivePersona());

  sideNav.innerHTML = `
    <div class="desktop-nav-logo">
      <span style="font-size:1.1rem;margin-right:6px">🎯</span>HR Competency OS
    </div>
    <div style="flex:1;overflow-y:auto;padding-bottom:8px">${links}</div>
    <div class="desktop-nav-footer">
      <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;margin-bottom:4px">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--primary-bg);
                    display:flex;align-items:center;justify-content:center;font-size:0.8rem;flex-shrink:0">
          👤
        </div>
        <div style="min-width:0">
          <div style="font-size:0.78rem;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${userName}
          </div>
          <div style="font-size:0.68rem;color:var(--text-muted)">${userRole}</div>
          ${userPersonas.length > 1 ? `
            <a href="#/persona-select"
               style="display:inline-flex;align-items:center;gap:4px;margin-top:4px;
                      font-size:0.65rem;font-weight:600;color:${activeDef.color};
                      text-decoration:none;padding:2px 8px;border-radius:10px;
                      background:${activeDef.bg}">
              ${activeDef.icon} ${activeDef.label} 전환
            </a>
          ` : ''}
        </div>
      </div>
      <button id="side-nav-logout" class="desktop-nav-item" style="color:var(--text-muted)">
        <span class="icon">🚪</span><span>로그아웃</span>
      </button>
    </div>`;

  sideNav.querySelector('#side-nav-logout')?.addEventListener('click', () => {
    const proxyOrig = localStorage.getItem('fca_proxy_original');
    if (proxyOrig) {
      try {
        const orig = JSON.parse(proxyOrig);
        localStorage.setItem('hr_token', orig.token);
        localStorage.setItem('hr_user', orig.user);
        localStorage.removeItem('fca_proxy_original');
        showToast('관리자 계정으로 돌아왔습니다.', 'success');
        window.location.hash = '#/dashboard';
      } catch (_) { performLogout(); }
      return;
    }
    performLogout();
  });
}

/**
 * Navigate to a route, optionally passing state.
 * @param {string} hash - e.g. '#/dashboard'
 * @param {Object} state - data to store in appState before navigation
 */
export function navigate(hash, state = {}) {
  if (state && typeof state === 'object') {
    Object.assign(window.appState, state);
  }
  window.location.hash = hash;
}

/**
 * Main router function. Called on every hashchange.
 */
async function router() {
  const hash = window.location.hash || '#/';

  // Exact or prefix match
  let routeKey = hash.split('?')[0]; // strip query string if any

  // Default route
  if (routeKey === '#/' || routeKey === '' || routeKey === '#') {
    if (isLoggedIn()) {
      const status = getUserStatus();
      window.location.hash = STATUS_HOME[status] || '#/dashboard';
    } else {
      window.location.hash = '#/login';
    }
    return;
  }

  // Auth guard
  if (!PUBLIC_ROUTES.has(routeKey) && !isLoggedIn()) {
    window.location.hash = '#/login';
    return;
  }

  // Redirect logged-in users away from login/register
  if ((routeKey === '#/login' || routeKey === '#/register') && isLoggedIn()) {
    const status = getUserStatus();
    window.location.hash = STATUS_HOME[status] || '#/dashboard';
    return;
  }

  // Role guard: APPLICANT cannot access MEMBER-only routes
  if (isLoggedIn() && isApplicant() && MEMBER_ONLY_ROUTES.has(routeKey)) {
    window.location.hash = '#/applicant';
    return;
  }

  // Role guard: non-admin cannot access admin routes (#/admin/* + ADMIN_ONLY_ROUTES)
  if (isLoggedIn() && !isAdmin() && (ADMIN_ONLY_ROUTES.has(routeKey) || routeKey.startsWith('#/admin'))) {
    const status = getUserStatus();
    window.location.hash = STATUS_HOME[status] || '#/dashboard';
    return;
  }

  // Role guard: non-alumni cannot access alumni routes
  if (isLoggedIn() && !isAlumni() && ALUMNI_ONLY_ROUTES.has(routeKey)) {
    const status = getUserStatus();
    window.location.hash = STATUS_HOME[status] || '#/dashboard';
    return;
  }

  // Role guard: MEMBER/ALUMNI cannot access APPLICANT-only routes
  if (isLoggedIn() && !isApplicant() && APPLICANT_ONLY_ROUTES.has(routeKey)) {
    const status = getUserStatus();
    window.location.hash = STATUS_HOME[status] || '#/dashboard';
    return;
  }

  // Module host: #/module/:moduleId
  if (routeKey.startsWith('#/module/')) {
    routes['#/module-host'] = routes['#/module-host']
      || (() => import('./pages/module-host.js'));
    const loader2 = routes['#/module-host'];
    updateBottomNav('#/modules');
    updateSideNav('#/modules');
    appRoot.innerHTML = `<div class="loading-overlay" style="min-height:100vh"><div class="spinner spinner-lg"></div></div>`;
    try {
      const mod = await loader2();
      if (window.location.hash.split('?')[0] !== currentHash) return;
      currentModule = mod;
      if (typeof mod.mount === 'function') await mod.mount(appRoot, window.appState);
    } catch (err) { renderError(err.message); }
    return;
  }

  // Find route loader
  const loader = routes[routeKey];
  if (!loader) {
    renderNotFound();
    return;
  }

  // Feature flag guard
  if (!isRouteEnabled(routeKey)) {
    renderComingSoon();
    return;
  }

  // 히스토리 스택 업데이트
  if (_TAB_ROOTS.has(routeKey)) {
    _navStack.length = 0;  // 탭 루트 진입 시 스택 초기화
    _removeFloatingBack(); // floating 뒤로가기 버튼 제거
  }
  _navStack.push(routeKey);
  if (_navStack.length > 40) _navStack.shift(); // 최대 40개

  // Unmount previous page
  if (currentModule && typeof currentModule.unmount === 'function') {
    try {
      currentModule.unmount();
    } catch (e) {
      console.warn('[Router] Unmount error:', e);
    }
  }
  currentModule = null;
  currentHash   = routeKey;

  // Update browser tab title
  const PAGE_TITLES = {
    '#/dashboard':'대시보드', '#/attendance':'출근 체크인', '#/leave':'휴가 관리',
    '#/leave/apply':'휴가 신청', '#/payslip':'급여명세서', '#/goals':'목표 관리',
    '#/reviews':'성과 리뷰', '#/peer-review':'동료 평가', '#/self-assessment':'자기평가',
    '#/growth':'성장 관리', '#/okr':'OKR', '#/idp':'개발 계획', '#/career-path':'커리어 경로',
    '#/mentoring':'멘토링', '#/one-on-one':'1:1 미팅', '#/training':'교육 관리',
    '#/benefits':'복리후생', '#/welfare-points':'복지포인트', '#/welfare-shop':'복지몰',
    '#/commute':'통근 관리', '#/remote-work':'재택근무', '#/parental-leave':'육아휴직',
    '#/loa':'휴직 신청', '#/approval':'전자결재', '#/notification-settings':'알림 설정',
    '#/profile':'프로필', '#/org-chart':'조직도', '#/ai-consult':'AI 상담',
    '#/login':'로그인', '#/register':'회원가입',
    '#/search':'메뉴 검색', '#/my':'내 것', '#/more':'더보기',
  };
  const pageTitle = PAGE_TITLES[routeKey];
  document.title = pageTitle ? `${pageTitle} — HR Competency OS` : 'HR Competency OS';

  // Scroll to top on route change
  document.querySelector('#app-root')?.scrollTo?.(0, 0);

  // Update nav (bottom on mobile, sidebar on desktop)
  updateBottomNav(routeKey);
  updateSideNav(routeKey);

  // Show loading state
  appRoot.innerHTML = `<div class="loading-overlay"><div class="spinner spinner-lg"></div></div>`;

  try {
    const mod = await loader();
    // Guard: route may have changed while loading
    if (window.location.hash.split('?')[0] !== currentHash) return;

    currentModule = mod;
    if (typeof mod.mount === 'function') {
      await mod.mount(appRoot, window.appState);
    } else if (typeof mod.render === 'function') {
      await mod.render(appRoot);
    } else {
      console.error('[Router] Page module missing mount()/render():', routeKey);
      renderError('페이지 모듈을 불러올 수 없습니다.');
    }
    // 페이지 전환 fade-in
    appRoot.style.animation = 'none';
    requestAnimationFrame(() => {
      appRoot.style.animation = 'page-fade-in 0.18s ease both';
    });
    // 전역 뒤로가기 버튼 주입
    _injectBackButton(routeKey);
    // 자주 쓰는 메뉴 학습 (skip 목록은 nav-recents.js 내부에서 처리)
    if (isLoggedIn()) recordVisit(routeKey);
  } catch (err) {
    console.error('[Router] Page load error:', err);
    renderError(err.message);
  }
}

function renderComingSoon() {
  appRoot.innerHTML = `
    <div class="empty-state" style="min-height:100vh">
      <div class="empty-state-icon">🔒</div>
      <div class="empty-state-title">아직 준비 중입니다</div>
      <div class="empty-state-desc">이 기능은 현재 비활성화되어 있습니다.<br>관리자에게 문의하세요.</div>
      <button class="btn btn-primary" onclick="history.back()">돌아가기</button>
    </div>`;
}

function renderNotFound() {
  appRoot.innerHTML = `
    <div class="empty-state" style="min-height:100vh">
      <div class="empty-state-icon">🗺️</div>
      <div class="empty-state-title">페이지를 찾을 수 없습니다</div>
      <div class="empty-state-desc">요청하신 페이지가 존재하지 않습니다.</div>
      <button class="btn btn-primary" onclick="window.location.hash='#/dashboard'">홈으로</button>
    </div>`;
}

function renderError(message) {
  const _hash = window.location.hash;
  appRoot.innerHTML = `
    <div class="empty-state" style="min-height:100vh;padding:40px 20px">
      <div class="empty-state-icon">⚠️</div>
      <div class="empty-state-title">오류가 발생했습니다</div>
      <div class="empty-state-desc" style="max-width:280px;margin:0 auto 20px">${message || '잠시 후 다시 시도해 주세요.'}</div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="window.location.hash='${_hash}';router()">다시 시도</button>
        <button class="btn" style="border:1.5px solid var(--border);border-radius:10px;padding:10px 20px;background:none;cursor:pointer;font-size:14px" onclick="window.location.hash='#/dashboard'">홈으로</button>
      </div>
    </div>`;
}

// ── Toast container setup ─────────────────────────────────────
function setupToastContainer() {
  if (!document.getElementById('toast-container')) {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
}

// ── Offline / Online detection ───────────────────────────────
window.addEventListener('offline', () =>
  showToast('인터넷 연결이 끊겼습니다. 캐시 데이터로 표시됩니다.', 'warning', 5000));
window.addEventListener('online', () =>
  showToast('인터넷이 연결되었습니다.', 'success', 2000));

// ── Global error handler ─────────────────────────────────────
window.addEventListener('unhandledrejection', (e) => {
  console.error('[App] Unhandled promise rejection:', e.reason);
  showToast(
    (e.reason && e.reason.message) ? e.reason.message : '알 수 없는 오류가 발생했습니다.',
    'error'
  );
});
window.onerror = (msg, src, line) => {
  console.error(`[App] JS Error: ${msg} @ ${src}:${line}`);
  return false; // don't suppress default browser error handling
};

// ── 전역 뒤로가기 버튼 주입 ──────────────────────────────────
function _injectBackButton(routeKey) {
  // 탭 루트는 뒤로가기 불필요
  if (_TAB_ROOTS.has(routeKey)) return;
  // 스택 깊이 1이면 뒤로가기 의미 없음
  if (_navStack.length <= 1) return;

  // 1. 이미 탑바-뒤로가기 버튼이 있으면 navBack() 으로 교체
  //    단, id가 있는 버튼은 페이지 자체 로직(이전 질문 등)이 붙어있으므로 건드리지 않음
  const existingBack = appRoot.querySelector('.top-bar-back:not([id])');
  if (existingBack) {
    existingBack.onclick = (e) => { e.preventDefault(); navBack(); };
    return;
  }
  // id가 있는 뒤로가기는 페이지 자체 핸들링 — float 버튼 추가 불필요
  if (appRoot.querySelector('.top-bar-back[id]')) return;

  // 2. 탑바가 있지만 뒤로가기 버튼이 없는 경우 — 버튼 삽입
  const topBar = appRoot.querySelector('.top-bar');
  if (topBar) {
    const btn = document.createElement('button');
    btn.className = 'top-bar-back';
    btn.setAttribute('aria-label', '뒤로');
    btn.innerHTML = '‹';
    btn.addEventListener('click', navBack);
    topBar.insertBefore(btn, topBar.firstChild);
    return;
  }

  // 3. 탑바가 아예 없는 페이지 — floating 뒤로가기 버튼 오버레이
  const existing = document.getElementById('global-back-btn');
  if (existing) existing.remove();

  const fab = document.createElement('button');
  fab.id = 'global-back-btn';
  fab.setAttribute('aria-label', '뒤로가기');
  fab.innerHTML = '‹';
  fab.style.cssText = `
    position: fixed;
    top: calc(env(safe-area-inset-top, 0px) + 12px);
    left: 12px;
    z-index: 850;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(15,23,42,0.10);
    box-shadow: 0 2px 12px rgba(15,23,42,0.12);
    font-size: 22px;
    font-weight: 700;
    color: var(--text);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 100ms ease, box-shadow 100ms ease;
    line-height: 1;
    padding-bottom: 1px;
  `;
  fab.addEventListener('click', navBack);
  fab.addEventListener('mouseenter', () => { fab.style.boxShadow = '0 4px 20px rgba(15,23,42,0.18)'; });
  fab.addEventListener('mouseleave', () => { fab.style.boxShadow = '0 2px 12px rgba(15,23,42,0.12)'; });
  fab.addEventListener('mousedown', () => { fab.style.transform = 'scale(0.92)'; });
  fab.addEventListener('mouseup',   () => { fab.style.transform = 'scale(1)'; });
  document.body.appendChild(fab);

  // 다크모드 대응
  if (document.documentElement.dataset.theme === 'dark') {
    fab.style.background = 'rgba(30,41,59,0.92)';
    fab.style.borderColor = 'rgba(255,255,255,0.10)';
    fab.style.color = '#F1F5F9';
  }
}

// 페이지 이동 시 floating 버튼 제거 (탑바 있는 페이지에서는 필요 없음)
function _removeFloatingBack() {
  document.getElementById('global-back-btn')?.remove();
}

// ── 탑바 스크롤 그림자 ────────────────────────────────────────
function _setupTopBarShadow() {
  const observer = new MutationObserver(() => {
    const pc = document.querySelector('.page-content');
    if (!pc) return;
    const topBar = document.querySelector('.top-bar');
    if (!topBar) return;
    const onScroll = () => {
      topBar.classList.toggle('scrolled', pc.scrollTop > 4);
    };
    pc.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  });
  observer.observe(document.getElementById('app'), { childList: true, subtree: false });
}

// ── Init ─────────────────────────────────────────────────────
function init() {
  initTheme();
  setupToastContainer();
  _setupTopBarShadow();
  window.addEventListener('hashchange', router);
  router();
  // Run smart notification triggers + Realtime after a short delay (non-blocking)
  setTimeout(async () => {
    if (isLoggedIn()) {
      runNotificationTriggers();
      try { const { startRealtime } = await import('./utils/realtime.js'); startRealtime(); } catch (_) {}
    }
  }, 3000);
}

document.addEventListener('DOMContentLoaded', init);
// Also run immediately if DOM is already ready
if (document.readyState !== 'loading') {
  init();
}
