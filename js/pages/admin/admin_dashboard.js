/**
 * admin_dashboard.js – HR Admin Dashboard
 * Tabs: 직원 배정 | 진단 Kit | 평가 템플릿
 */

import { api }                    from '../../api.js';
import { getUser }                from '../../auth.js';
import { showToast }              from '../../components/toast.js';
import { DIAGNOSTIC_KITS,
         getActiveKits }          from '../../data/diagnostic_kits.js';
import { DEMO_JOB_POSTINGS,
         DEMO_ALUMNI }           from '../../data/demo_jobs.js';
import { KEY_ROLES, loadDisplayEmployees } from '../../data/demo_employees.js';
import { getRankedRisks, getOrgHealthSummary, RISK_COLOR, RISK_LABEL } from '../../utils/retention.js';
import { getEmailConfig, saveEmailConfig, isEmailConfigured,
         sendInterviewSchedule, sendOffer, sendAssessmentInvite } from '../../utils/emailjs-service.js';
import { FEATURE_PACKAGES, getAllFlags, saveFlags, resetFlags, isAdminTabEnabled } from '../../utils/feature-flags.js';
import { getActivePersona, getPersonaAdminTabs, getPersonaAdminDefaultTab } from '../../utils/persona.js';
import { addNotification } from '../../components/notification-hub.js';

// ══════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════

const ASSIGNMENTS_KEY  = 'hr_admin_assignments';
const RANK_KEY         = 'hr_rank_settings';
const MAPPING_KEY      = 'hr_diag_mappings';
const JOB_POSTINGS_KEY = 'hr_job_postings';
const ALUMNI_CONTACTS_KEY = 'hr_alumni_contacts';

const DIAG_TYPES = [
  { id:'assessment', label:'역량 진단 (카드스와이프)', icon:'📋', color:'#4F46E5' },
  { id:'KIT_MBTI',   label:'MBTI',                    icon:'🧠', color:'#7C3AED' },
  { id:'KIT_DISC',   label:'DISC',                    icon:'🎯', color:'#F59E0B' },
  { id:'KIT_HOLLAND',label:'Holland Code',             icon:'🌐', color:'#10B981' },
  { id:'KIT_BIRKMAN',label:'Birkman',                  icon:'🔬', color:'#8B5CF6' },
  { id:'KIT_INTERVIEW',label:'AI 인터뷰',              icon:'🎤', color:'#EF4444' },
  { id:'hr_comp',    label:'HR 직무역량 트리',          icon:'🌳', color:'#059669' },
  { id:'survey',     label:'생애주기 서베이',           icon:'📝', color:'#64748B' },
];

const DEMO_TEMPLATES = [
  { id:'TPL_001', name_ko:'일반 직원 역량 평가',  job_family:'공통', level:'사원~과장', competency_count:5,  purpose:'annual' },
  { id:'TPL_002', name_ko:'HR 전문가 역량 평가',  job_family:'HR',   level:'전 직급',   competency_count:8,  purpose:'annual' },
];

// ══════════════════════════════════════════════════════════════
// Module state
// ══════════════════════════════════════════════════════════════

let _root = null;
let _state = {
  tab:          getPersonaAdminDefaultTab(getActivePersona()),
  employees:    [],
  templates:    DEMO_TEMPLATES,
  assignments:  {},
  kitPreview:   null,
  expandedType: null,
  rankSettings: { count: 5, levels: ['사원', '대리', '과장', '차장', '부장'] },
  diagMappings: {},
};

// ══════════════════════════════════════════════════════════════
// Mount / Unmount
// ══════════════════════════════════════════════════════════════

export async function mount(container) {
  _root = container;

  try {
    const saved = localStorage.getItem(ASSIGNMENTS_KEY);
    if (saved) _state.assignments = JSON.parse(saved);
  } catch (_) {}

  try {
    const savedRank = localStorage.getItem(RANK_KEY);
    if (savedRank) _state.rankSettings = JSON.parse(savedRank);
  } catch (_) {}

  try {
    const savedMap = localStorage.getItem(MAPPING_KEY);
    if (savedMap) _state.diagMappings = JSON.parse(savedMap);
  } catch (_) {}

  const user  = getUser();
  const orgId = user?.org_id || 'ORG001';
  try {
    const tpls = await api.templates.list(orgId);
    if (tpls?.length) _state.templates = tpls;
  } catch (_) {}

  // DB 직원 목록 로드 (DEMO_EMPLOYEES 대체)
  try {
    const emps = await loadDisplayEmployees(orgId);
    if (emps.length) _state.employees = emps;
  } catch (_) {}

  renderShell(container);

  // Support ?tab= from onboarding CTA links (e.g. #/admin?tab=employees)
  const hashQuery = window.location.hash.split('?')[1] || '';
  const tabParam  = new URLSearchParams(hashQuery).get('tab');
  if (tabParam && _root?.querySelector(`[data-tab="${tabParam}"]`)) {
    _state.tab = tabParam;
    updateTabUI();
  }

  renderTab();

  // Re-render when persona changes
  const _onPersonaChange = () => {
    _state.tab = getPersonaAdminDefaultTab(getActivePersona());
    renderShell(_root);
    updateTabUI();
    renderTab();
  };
  window.addEventListener('hr:persona-change', _onPersonaChange);
  // Store cleanup reference on the root element
  _root._personaCleanup = _onPersonaChange;
}

export function unmount() {
  if (_root?._personaCleanup) {
    window.removeEventListener('hr:persona-change', _root._personaCleanup);
  }
  _root = null;
}

// ══════════════════════════════════════════════════════════════
// Shell
// ══════════════════════════════════════════════════════════════

function renderShell(container) {
  container.innerHTML = `
    <div class="page" style="background:var(--bg)">

      <div class="top-bar">
        <button class="top-bar-back" onclick="window.navBack()" aria-label="뒤로">‹</button>
        <div class="top-bar-title">관리자 대시보드</div>
      </div>

      <div style="display:flex;gap:0;border-bottom:2px solid var(--border);
                  background:var(--surface);padding:0 12px;overflow-x:auto;-webkit-overflow-scrolling:touch">
        ${(() => {
          const SECTIONS = [
            { label: '🎯 인재 확보', keys: ['recruit','recruitment','recruitmentTracker','interviewerPortal','talentPool','aptitude','referralAdmin','alumniMgmt','intelligence'] },
            { label: '🚀 입·퇴사 관리', keys: ['onboarding','docReview','offboarding','idCardAdmin','deskSetupAdmin','uniformAdmin','remoteEquipmentAdmin'] },
            { label: '🏢 인사 조직', keys: ['employees','orgChart','personnel','personnelOrderAdmin','headcountPlan','transferAdmin','loaAdmin','infoUpdateAdmin','documentAdmin','hrDashboard','hrReport','rulebook','approvalAdmin','assetAdmin','itSupportAdmin','businessCardAdmin','suppliesAdmin','vehicleAdmin','bulletinAdmin','newsletterAdmin','noticeMgmt'] },
            { label: '⏱️ 근태 관리', keys: ['leaveMgmt','leavePromotion','workhours','overtimeAdmin','flexibleWorkAdmin','remoteWorkAdmin','workFromAbroadAdmin','commuteAdmin','teamCalendarAdmin','workReportAdmin','oneOnOneAdmin'] },
            { label: '💰 보상 복지', keys: ['payslipMgmt','wageLedger','compensationAdmin','salaryRaiseAdmin','salaryContractAdmin','benefitEnrollAdmin','welfareAdmin','welfareShopAdmin','flexibleBenefitAdmin','stockOptionAdmin','expenseAdmin','expenseMgmt','businessTripAdmin','childcareAdmin','relocationAdmin','mealTicketAdmin','cafeteriaAdmin','parkingAdmin','shuttleAdmin','pointsAdmin'] },
            { label: '📚 학습 성장', keys: ['trainingAdmin','legalEdu','certificationAdmin','eduSupportAdmin','languageClassAdmin','workshopAdmin','seminarAdmin','mentoringAdmin','mentorMatchingAdmin','careerCoachingAdmin','studyGroupAdmin','bookAdmin','bookOrderAdmin','trainerAdmin'] },
            { label: '📊 성과 목표', keys: ['perfReview','perfCalibration','peerReviewAdmin','selfAssessmentAdmin','probationAdmin','goalSettingAdmin','teamPerf','reviewAppealAdmin','assign','instances','kits','templates','policies','workflow','rank','mapping'] },
            { label: '🌟 직원 경험', keys: ['clubAdmin','clubFoundingAdmin','familyEventAdmin','anniversaryAdmin','healthCheckup','healthExamAdmin','healthProgramAdmin','wellnessAdmin','counselingAdmin','employeeSurveyAdmin','surveyBuilder','surveyResultsAdmin','pulseResults','enpsDashboard','awardAdmin','tenureAwardAdmin','peerReviewAdmin','peerRecognitionAdmin','kudosAdmin','ideaAdmin','greenAdmin','contestAdmin','volunteerAdmin','teamBuildingAdmin','companyEventAdmin','coffeeChatAdmin','laborConsultAdmin','overseasAdmin','voteAdmin','marketAdmin','teamLunchAdmin','raffleAdmin','patentAdmin','harassment','orgHealth'] },
            { label: '⚙️ 시스템', keys: ['invites','moduleBuilder','features'] },
          ];

          const ALL_TABS = [
            { key:'assign',    label:'직원 배정',   icon:'👥' },
            { key:'instances', label:'인스턴스',    icon:'📊' },
            { key:'kits',      label:'진단 Kit',    icon:'🧩' },
            { key:'templates', label:'평가 템플릿',  icon:'📋' },
            { key:'policies',  label:'정책 설정',   icon:'⚖️' },
            { key:'workflow',  label:'워크플로우',  icon:'🔀' },
            { key:'rank',      label:'직위 설정',   icon:'🏷️' },
            { key:'mapping',   label:'진단 매핑',   icon:'🗂️' },
            { key:'recruit',   label:'채용관리',    icon:'📢' },
            { key:'alumniMgmt',label:'동문관리',    icon:'🏅' },
            { key:'intelligence', label:'인재 인텔리전스', icon:'🎯' },
            { key:'teamPerf',    label:'팀 성과 현황',   icon:'📈' },
            { key:'employees',    label:'직원 관리',      icon:'🧑‍💼' },
            { key:'aptitude',    label:'인적성 관리',    icon:'🎯' },
            { key:'leaveMgmt',   label:'휴가 관리',     icon:'📅' },
            { key:'payslipMgmt', label:'임금명세서',    icon:'💰' },
            { key:'workhours',   label:'근무시간',      icon:'⏱️' },
            { key:'legalEdu',    label:'법정교육',      icon:'📚' },
            { key:'harassment',  label:'괴롭힘신고',    icon:'🛡️' },
            { key:'orgChart',    label:'조직도',        icon:'🏢' },
            { key:'personnel',   label:'인사발령',      icon:'📋' },
            { key:'hrDashboard', label:'HR KPI',        icon:'📊' },
            { key:'wageLedger',  label:'임금대장',      icon:'💳' },
            { key:'onboarding',  label:'온보딩',        icon:'🎉' },
            { key:'offboarding', label:'오프보딩',      icon:'👋' },
            { key:'expenseMgmt', label:'경비 승인',     icon:'💰' },
            { key:'hrReport',    label:'HR 보고서',     icon:'📈' },
            { key:'rulebook',    label:'취업규칙',      icon:'📜' },
            { key:'noticeMgmt',  label:'공지 관리',     icon:'📢' },
            { key:'pulseResults',label:'펄스 서베이',   icon:'📊' },
            { key:'assetAdmin',  label:'자산 관리',     icon:'🏷️' },
            { key:'leavePromotion', label:'연차 촉진',  icon:'📅' },
            { key:'recruitment',      label:'채용 관리',   icon:'💼' },
            { key:'interviewerPortal', label:'면접관 배정', icon:'🎤' },
            { key:'docReview',        label:'입사 서류',   icon:'📂' },
            { key:'perfReview',     label:'성과 평가',   icon:'📋' },
            { key:'healthCheckup',  label:'건강검진',    icon:'🏥' },
            { key:'surveyBuilder',  label:'설문 관리',   icon:'📋' },
            { key:'approvalAdmin',  label:'전자 결재',   icon:'✅' },
            { key:'trainingAdmin',  label:'교육 관리',   icon:'📚' },
            { key:'remoteWorkAdmin',label:'재택 관리',   icon:'🏠' },
            { key:'enpsDashboard', label:'eNPS',        icon:'📊' },
            { key:'ideaAdmin',       label:'아이디어',    icon:'💡' },
            { key:'familyEventAdmin', label:'경조사 관리', icon:'🎊' },
            { key:'talentPool',         label:'인재풀 관리',  icon:'🌟' },
            { key:'recruitmentTracker', label:'채용 트래커', icon:'📊' },
            { key:'compensationAdmin',  label:'보상 관리',   icon:'💰' },
            { key:'headcountPlan',      label:'인력 계획',   icon:'📈' },
            { key:'perfCalibration',    label:'성과 캘리브레이션', icon:'🎯' },
            { key:'surveyResultsAdmin', label:'설문 결과',    icon:'📊' },
            { key:'orgHealth',          label:'조직 건강',    icon:'💚' },
            { key:'transferAdmin',      label:'이동 신청 관리', icon:'🔄' },
            { key:'expenseAdmin',       label:'경비 승인',      icon:'🧾' },
            { key:'wellnessAdmin',      label:'웰니스 모니터링', icon:'💙' },
            { key:'certificationAdmin', label:'자격증 / 교육',  icon:'🎓' },
            { key:'projectAdmin',       label:'사내 공모 관리', icon:'🚀' },
            { key:'businessTripAdmin',  label:'출장 승인',      icon:'✈️' },
            { key:'cafeteriaAdmin',     label:'식수 / 메뉴',    icon:'🍱' },
            { key:'parkingAdmin',       label:'주차 배정',      icon:'🅿️' },
            { key:'salaryRaiseAdmin',   label:'연봉 인상 검토', icon:'💰' },
            { key:'referralAdmin',      label:'추천 채용',      icon:'🤝' },
            { key:'welfareAdmin',       label:'복지 포인트',    icon:'💎' },
            { key:'clubAdmin',          label:'사내 동호회',    icon:'🎯' },
            { key:'businessCardAdmin',  label:'명함 발주',      icon:'💼' },
            { key:'overtimeAdmin',      label:'연장근무 관리', icon:'⏰' },
            { key:'workReportAdmin',    label:'업무 보고',     icon:'📝' },
            { key:'commuteAdmin',       label:'출퇴근 통계',   icon:'📍' },
            { key:'benefitEnrollAdmin', label:'복리후생 관리', icon:'🎁' },
            { key:'probationAdmin',     label:'수습 평가',     icon:'🎓' },
            { key:'suppliesAdmin',      label:'비품 관리',     icon:'📦' },
            { key:'peerReviewAdmin',    label:'동료 평가',     icon:'🔄' },
            { key:'selfAssessmentAdmin',label:'자기평가 관리', icon:'📝' },
            { key:'teamCalendarAdmin',  label:'팀 캘린더 관리', icon:'📅' },
            { key:'bookAdmin',          label:'사내 도서',     icon:'📚' },
            { key:'workshopAdmin',      label:'워크샵 관리',   icon:'🏕️' },
            { key:'vehicleAdmin',       label:'차량 관리',     icon:'🚗' },
            { key:'itSupportAdmin',     label:'IT 지원',       icon:'🖥️' },
            { key:'awardAdmin',         label:'포상 관리',     icon:'🏆' },
            { key:'personnelOrderAdmin',label:'인사발령 등록', icon:'📋' },
            { key:'greenAdmin',         label:'그린 활동',     icon:'🌿' },
            { key:'documentAdmin',      label:'서류 발급',     icon:'📄' },
            { key:'flexibleWorkAdmin',  label:'유연근무 관리', icon:'⏰' },
            { key:'mentoringAdmin',     label:'멘토링 관리',   icon:'🤝' },
            { key:'companyEventAdmin',  label:'사내 행사',     icon:'🎉' },
            { key:'careerCoachingAdmin',label:'커리어 코칭',   icon:'🎯' },
            { key:'volunteerAdmin',     label:'자원봉사 관리', icon:'🤲' },
            { key:'studyGroupAdmin',    label:'스터디 그룹',   icon:'📚' },
            { key:'welfareShopAdmin',   label:'복지 포인트 샵', icon:'🛒' },
            { key:'eduSupportAdmin',    label:'교육비 지원',   icon:'🎓' },
            { key:'tenureAwardAdmin',   label:'근속 포상',     icon:'🏅' },
            { key:'counselingAdmin',    label:'심리 상담',     icon:'🧠' },
            { key:'overseasAdmin',      label:'해외 파견',     icon:'✈️' },
            { key:'salaryContractAdmin',label:'연봉 계약서',   icon:'📄' },
            { key:'voteAdmin',          label:'사내 투표',     icon:'🗳️' },
            { key:'healthProgramAdmin', label:'건강 프로그램', icon:'🏋️' },
            { key:'infoUpdateAdmin',    label:'개인정보 변경', icon:'📋' },
            { key:'marketAdmin',        label:'사내 마켓',     icon:'🛒' },
            { key:'trainerAdmin',       label:'사내 강사',     icon:'👨‍🏫' },
            { key:'teamBuildingAdmin',  label:'팀 빌딩',       icon:'🎊' },
            { key:'contestAdmin',       label:'사내 공모전',   icon:'🏆' },
            { key:'loaAdmin',           label:'휴직 관리',     icon:'🏖️' },
            { key:'oneOnOneAdmin',      label:'면담 관리',     icon:'💬' },
            { key:'laborConsultAdmin',  label:'노무 상담',     icon:'⚖️' },
            { key:'remoteEquipmentAdmin',label:'재택 장비',    icon:'💻' },
            { key:'coffeeChatAdmin',    label:'커피챗',        icon:'☕' },
            { key:'reviewAppealAdmin',  label:'인사고과 이의', icon:'📝' },
            { key:'bulletinAdmin',      label:'게시판 관리',   icon:'📌' },
            { key:'raffleAdmin',        label:'사내 추첨',     icon:'🎰' },
            { key:'pointsAdmin',        label:'포인트 관리',   icon:'💎' },
            { key:'newsletterAdmin',    label:'소식 관리',     icon:'📰' },
            { key:'peerRecognitionAdmin', label:'동료 칭찬',   icon:'🌟' },
            { key:'bookOrderAdmin',     label:'도서 신청',     icon:'📚' },
            { key:'seminarAdmin',       label:'세미나 관리',   icon:'🎤' },
            { key:'anniversaryAdmin',   label:'경조사',        icon:'🎊' },
            { key:'mealTicketAdmin',    label:'식권 관리',     icon:'🍱' },
            { key:'idCardAdmin',        label:'사원증 관리',   icon:'🪪' },
            { key:'goalSettingAdmin',   label:'목표 설정',     icon:'🎯' },
            { key:'workFromAbroadAdmin',label:'해외 원격근무', icon:'🌏' },
            { key:'uniformAdmin',       label:'유니폼 관리',   icon:'👕' },
            { key:'childcareAdmin',     label:'보육 지원',     icon:'👶' },
            { key:'languageClassAdmin', label:'어학 수강',     icon:'🗣️' },
            { key:'shuttleAdmin',       label:'통근 셔틀',     icon:'🚌' },
            { key:'healthExamAdmin',    label:'건강검진 예약', icon:'🩺' },
            { key:'employeeSurveyAdmin',label:'임직원 설문',   icon:'📊' },
            { key:'patentAdmin',        label:'직무발명',      icon:'💡' },
            { key:'teamLunchAdmin',     label:'팀 점심',       icon:'🍽️' },
            { key:'relocationAdmin',    label:'이사 지원',     icon:'🚚' },
            { key:'stockOptionAdmin',   label:'스톡옵션',      icon:'📈' },
            { key:'deskSetupAdmin',     label:'데스크 셋업',   icon:'🪑' },
            { key:'flexibleBenefitAdmin',label:'선택 복지',    icon:'🎁' },
            { key:'mentorMatchingAdmin',label:'멘토 매칭',     icon:'🤝' },
            { key:'clubFoundingAdmin',  label:'동호회 개설',   icon:'🎯' },
            { key:'invites',            label:'초대 관리',    icon:'🔑' },
            { key:'moduleBuilder', label:'모듈 빌더',   icon:'🏗️' },
            { key:'features',      label:'기능 관리',   icon:'⚙️' },
          ];

          const tabMap = Object.fromEntries(ALL_TABS.map(t => [t.key, t]));
          const pTabs = getPersonaAdminTabs(getActivePersona());
          const isEnabled = k => {
            const t = tabMap[k];
            if (!t) return false;
            if (pTabs === 'all') return isAdminTabEnabled(k);
            if (!Array.isArray(pTabs) || pTabs.length === 0) return isAdminTabEnabled(k);
            return pTabs.includes(k) && isAdminTabEnabled(k);
          };

          return SECTIONS.flatMap(sec => {
            const visibleTabs = sec.keys.map(k => tabMap[k]).filter(t => t && isEnabled(t.key));
            if (visibleTabs.length === 0) return [];
            return [
              `<span style="flex-shrink:0;align-self:center;padding:0 8px 0 12px;font-size:10px;font-weight:700;
                color:var(--text-muted);white-space:nowrap;opacity:0.6;letter-spacing:.3px">${sec.label}</span>`,
              ...visibleTabs.map(t => `
                <button class="admin-tab-btn" data-tab="${t.key}"
                        style="padding:12px 14px;font-size:0.83rem;font-weight:600;
                               background:none;border:none;cursor:pointer;white-space:nowrap;
                               border-bottom:2px solid transparent;margin-bottom:-2px;
                               color:var(--text-muted);transition:color .15s,border-color .15s">
                  ${t.icon} ${t.label}
                </button>
              `),
            ];
          }).join('');
        })()}
      </div>

      <div id="admin-tab-content" class="page-content"></div>
    </div>

    <style>
      .admin-tab-btn.active { color:var(--primary)!important; border-bottom-color:var(--primary)!important; }
      .kit-card { transition:box-shadow .15s; }
      .kit-card:hover { box-shadow:0 4px 16px rgba(0,0,0,.08); }
      .type-card { cursor:pointer; transition:border-color .2s; }
      .type-card:hover { border-color:var(--primary-light)!important; }
      .type-card.expanded { border-color:var(--primary)!important; }
    </style>
  `;

  container.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _state.tab = btn.dataset.tab;
      updateTabUI();
      renderTab();
    });
  });

  updateTabUI();
}

function updateTabUI() {
  _root?.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === _state.tab);
  });
}

async function renderTab() {
  const content = _root?.querySelector('#admin-tab-content');
  if (!content) return;
  content.innerHTML = '';

  // If persona has no admin tabs, show a friendly message
  const pTabs = getPersonaAdminTabs(getActivePersona());
  if (Array.isArray(pTabs) && pTabs.length === 0) {
    content.innerHTML = `
      <div style="padding:48px;text-align:center;color:var(--text-muted)">
        <div style="font-size:2.5rem;margin-bottom:12px">🔒</div>
        <p style="font-weight:600;margin-bottom:6px">이 모드에서는 관리자 기능이 없습니다</p>
        <p style="font-size:0.82rem">
          관리자 기능이 필요하면 <a href="#/persona-select" style="color:var(--primary)">모드를 전환</a>하세요.
        </p>
      </div>`;
    return;
  }
  if (_state.tab === 'assign')     renderAssignTab(content);
  if (_state.tab === 'instances')  renderInstancesTab(content);
  if (_state.tab === 'kits')       renderKitsTab(content);
  if (_state.tab === 'templates')  renderTemplatesTab(content);
  if (_state.tab === 'policies')   renderPoliciesTab(content);
  if (_state.tab === 'workflow')   renderWorkflowTab(content);
  if (_state.tab === 'rank')       renderRankTab(content);
  if (_state.tab === 'mapping')    renderMappingTab(content);
  if (_state.tab === 'recruit')    renderRecruitTab(content);
  if (_state.tab === 'alumniMgmt')   renderAlumniMgmtTab(content);
  if (_state.tab === 'intelligence') renderIntelligenceTab(content);
  if (_state.tab === 'teamPerf')    renderTeamPerfTab(content);
  if (_state.tab === 'employees')   renderEmployeeTab(content);
  if (_state.tab === 'aptitude')    renderAptitudeTab(content);
  if (_state.tab === 'leaveMgmt')   renderLeaveMgmtTab(content);
  if (_state.tab === 'payslipMgmt') renderPayslipMgmtTab(content);
  if (_state.tab === 'workhours')   renderWorkhoursTab(content);
  if (_state.tab === 'legalEdu')    renderLegalEduAdminTab(content);
  if (_state.tab === 'harassment')  renderHarassmentAdminTab(content);
  if (_state.tab === 'orgChart')    renderOrgChartTab(content);
  if (_state.tab === 'personnel')   renderPersonnelTab(content);
  if (_state.tab === 'hrDashboard') renderHrDashboardTab(content);
  if (_state.tab === 'wageLedger')  renderWageLedgerTab(content);
  if (_state.tab === 'onboarding')  renderOnboardingTab(content);
  if (_state.tab === 'offboarding') renderOffboardingTab(content);
  if (_state.tab === 'expenseMgmt') renderExpenseMgmtTab(content);
  if (_state.tab === 'hrReport')    renderHrReportTab(content);
  if (_state.tab === 'rulebook')    renderRulebookTab(content);
  if (_state.tab === 'noticeMgmt')  renderNoticeMgmtTab(content);
  if (_state.tab === 'pulseResults') renderPulseResultsTab(content);
  if (_state.tab === 'assetAdmin')   renderAssetAdminTab(content);
  if (_state.tab === 'leavePromotion') renderLeavePromotionTab(content);
  if (_state.tab === 'recruitment')    renderRecruitmentTab(content);
  if (_state.tab === 'perfReview')     renderPerfReviewTab(content);
  if (_state.tab === 'healthCheckup')  renderHealthCheckupTab(content);
  if (_state.tab === 'surveyBuilder')  renderSurveyBuilderTab(content);
  if (_state.tab === 'approvalAdmin')  renderApprovalAdminTab(content);
  if (_state.tab === 'trainingAdmin')  renderTrainingAdminTab(content);
  if (_state.tab === 'remoteWorkAdmin') renderRemoteWorkAdminTab(content);
  if (_state.tab === 'enpsDashboard')  renderEnpsDashboardTab(content);
  if (_state.tab === 'ideaAdmin')        renderIdeaAdminTab(content);
  if (_state.tab === 'familyEventAdmin') renderFamilyEventAdminTab(content);
  if (_state.tab === 'talentPool')            renderTalentPoolTab(content);
  if (_state.tab === 'recruitmentTracker')   renderRecruitmentTrackerTab(content);
  if (_state.tab === 'compensationAdmin')    renderCompensationAdminTab(content);
  if (_state.tab === 'headcountPlan')        renderHeadcountPlanTab(content);
  if (_state.tab === 'perfCalibration')      renderPerfCalibrationTab(content);
  if (_state.tab === 'surveyResultsAdmin')  renderSurveyResultsAdminTab(content);
  if (_state.tab === 'orgHealth')           renderOrgHealthTab(content);
  if (_state.tab === 'transferAdmin')       renderTransferAdminTab(content);
  if (_state.tab === 'expenseAdmin')        renderExpenseAdminTab(content);
  if (_state.tab === 'wellnessAdmin')       renderWellnessAdminTab(content);
  if (_state.tab === 'certificationAdmin')  renderCertificationAdminTab(content);
  if (_state.tab === 'projectAdmin')        renderProjectAdminTab(content);
  if (_state.tab === 'businessTripAdmin')   renderBusinessTripAdminTab(content);
  if (_state.tab === 'cafeteriaAdmin')      renderCafeteriaAdminTab(content);
  if (_state.tab === 'parkingAdmin')        renderParkingAdminTab(content);
  if (_state.tab === 'salaryRaiseAdmin')    renderSalaryRaiseAdminTab(content);
  if (_state.tab === 'referralAdmin')       renderReferralAdminTab(content);
  if (_state.tab === 'welfareAdmin')        renderWelfareAdminTab(content);
  if (_state.tab === 'clubAdmin')           renderClubAdminTab(content);
  if (_state.tab === 'businessCardAdmin')   renderBusinessCardAdminTab(content);
  if (_state.tab === 'overtimeAdmin')       renderOvertimeAdminTab(content);
  if (_state.tab === 'workReportAdmin')     renderWorkReportAdminTab(content);
  if (_state.tab === 'commuteAdmin')        renderCommuteAdminTab(content);
  if (_state.tab === 'benefitEnrollAdmin')  renderBenefitEnrollAdminTab(content);
  if (_state.tab === 'probationAdmin')      renderProbationAdminTab(content);
  if (_state.tab === 'suppliesAdmin')       renderSuppliesAdminTab(content);
  if (_state.tab === 'peerReviewAdmin')     renderPeerReviewAdminTab(content);
  if (_state.tab === 'selfAssessmentAdmin') renderSelfAssessmentAdminTab(content);
  if (_state.tab === 'teamCalendarAdmin')   renderTeamCalendarAdminTab(content);
  if (_state.tab === 'bookAdmin')           renderBookAdminTab(content);
  if (_state.tab === 'workshopAdmin')       renderWorkshopAdminTab(content);
  if (_state.tab === 'vehicleAdmin')        renderVehicleAdminTab(content);
  if (_state.tab === 'itSupportAdmin')      renderItSupportAdminTab(content);
  if (_state.tab === 'awardAdmin')          renderAwardAdminTab(content);
  if (_state.tab === 'personnelOrderAdmin') renderPersonnelOrderAdminTab(content);
  if (_state.tab === 'greenAdmin')          renderGreenAdminTab(content);
  if (_state.tab === 'documentAdmin')       renderDocumentAdminTab(content);
  if (_state.tab === 'flexibleWorkAdmin')   renderFlexibleWorkAdminTab(content);
  if (_state.tab === 'mentoringAdmin')      renderMentoringAdminTab(content);
  if (_state.tab === 'companyEventAdmin')   renderCompanyEventAdminTab(content);
  if (_state.tab === 'careerCoachingAdmin') renderCareerCoachingAdminTab(content);
  if (_state.tab === 'volunteerAdmin')     renderVolunteerAdminTab(content);
  if (_state.tab === 'studyGroupAdmin')    renderStudyGroupAdminTab(content);
  if (_state.tab === 'welfareShopAdmin')   renderWelfareShopAdminTab(content);
  if (_state.tab === 'eduSupportAdmin')    renderEduSupportAdminTab(content);
  if (_state.tab === 'tenureAwardAdmin')   renderTenureAwardAdminTab(content);
  if (_state.tab === 'counselingAdmin')    renderCounselingAdminTab(content);
  if (_state.tab === 'overseasAdmin')      renderOverseasAdminTab(content);
  if (_state.tab === 'salaryContractAdmin') renderSalaryContractAdminTab(content);
  if (_state.tab === 'voteAdmin')          renderVoteAdminTab(content);
  if (_state.tab === 'healthProgramAdmin') renderHealthProgramAdminTab(content);
  if (_state.tab === 'infoUpdateAdmin')    renderInfoUpdateAdminTab(content);
  if (_state.tab === 'marketAdmin')        renderMarketAdminTab(content);
  if (_state.tab === 'trainerAdmin')       renderTrainerAdminTab(content);
  if (_state.tab === 'teamBuildingAdmin')  renderTeamBuildingAdminTab(content);
  if (_state.tab === 'contestAdmin')       renderContestAdminTab(content);
  if (_state.tab === 'loaAdmin')           renderLoaAdminTab(content);
  if (_state.tab === 'oneOnOneAdmin')      renderOneOnOneAdminTab(content);
  if (_state.tab === 'laborConsultAdmin')  renderLaborConsultAdminTab(content);
  if (_state.tab === 'remoteEquipmentAdmin') renderRemoteEquipmentAdminTab(content);
  if (_state.tab === 'coffeeChatAdmin')    renderCoffeeChatAdminTab(content);
  if (_state.tab === 'reviewAppealAdmin')  renderReviewAppealAdminTab(content);
  if (_state.tab === 'bulletinAdmin')      renderBulletinAdminTab(content);
  if (_state.tab === 'raffleAdmin')        renderRaffleAdminTab(content);
  if (_state.tab === 'pointsAdmin')        renderPointsAdminTab(content);
  if (_state.tab === 'newsletterAdmin')    renderNewsletterAdminTab(content);
  if (_state.tab === 'peerRecognitionAdmin') renderPeerRecognitionAdminTab(content);
  if (_state.tab === 'bookOrderAdmin')     renderBookOrderAdminTab(content);
  if (_state.tab === 'seminarAdmin')       renderSeminarAdminTab(content);
  if (_state.tab === 'anniversaryAdmin')   renderAnniversaryAdminTab(content);
  if (_state.tab === 'mealTicketAdmin')    renderMealTicketAdminTab(content);
  if (_state.tab === 'idCardAdmin')        renderIdCardAdminTab(content);
  if (_state.tab === 'goalSettingAdmin')   renderGoalSettingAdminTab(content);
  if (_state.tab === 'workFromAbroadAdmin') await renderConnectedAdminTab(content, 'work-from-abroad-admin.js');
  if (_state.tab === 'uniformAdmin')         await renderConnectedAdminTab(content, 'uniform-admin.js');
  if (_state.tab === 'childcareAdmin')       await renderConnectedAdminTab(content, 'childcare-admin.js');
  if (_state.tab === 'languageClassAdmin')   await renderConnectedAdminTab(content, 'language-class-admin.js');
  if (_state.tab === 'shuttleAdmin')         await renderConnectedAdminTab(content, 'shuttle-admin.js');
  if (_state.tab === 'healthExamAdmin')      await renderConnectedAdminTab(content, 'health-exam-admin.js');
  if (_state.tab === 'employeeSurveyAdmin')  await renderConnectedAdminTab(content, 'employee-survey-admin.js');
  if (_state.tab === 'patentAdmin')          await renderConnectedAdminTab(content, 'patent-admin.js');
  if (_state.tab === 'teamLunchAdmin')       await renderConnectedAdminTab(content, 'team-lunch-admin.js');
  if (_state.tab === 'relocationAdmin')      await renderConnectedAdminTab(content, 'relocation-admin.js');
  if (_state.tab === 'stockOptionAdmin')     await renderConnectedAdminTab(content, 'stock-option-admin.js');
  if (_state.tab === 'deskSetupAdmin')       await renderConnectedAdminTab(content, 'desk-setup-admin.js');
  if (_state.tab === 'flexibleBenefitAdmin') await renderConnectedAdminTab(content, 'flexible-benefit-admin.js');
  if (_state.tab === 'mentorMatchingAdmin')  await renderConnectedAdminTab(content, 'mentor-matching-admin.js');
  if (_state.tab === 'clubFoundingAdmin')    await renderConnectedAdminTab(content, 'club-founding-admin.js');
  if (_state.tab === 'invites')             renderInviteTab(content);
  if (_state.tab === 'moduleBuilder')  renderModuleBuilderTab(content);
  if (_state.tab === 'features')       renderFeaturesTab(content);
  if (_state.tab === 'interviewerPortal') renderInterviewerPortalTab(content);
  if (_state.tab === 'docReview')         renderDocReviewTab(content);
}

// ══════════════════════════════════════════════════════════════
// Tab: 인스턴스 관리 (평가 진행 현황 + 전환)
// ══════════════════════════════════════════════════════════════

const STATUS_LABELS = {
  draft: '초안', self_evaluation: '자기평가', peer_evaluation: '동료평가',
  manager_evaluation: '관리자평가', calibration: '캘리브레이션', completed: '완료',
};
const STATUS_COLOR = {
  draft: '#94A3B8', self_evaluation: '#3B82F6', peer_evaluation: '#8B5CF6',
  manager_evaluation: '#F59E0B', calibration: '#EC4899', completed: '#10B981',
};

// ══════════════════════════════════════════════════════════════
// Tab: 인스턴스 관리 (평가 진행 현황 + 전환)
// ══════════════════════════════════════════════════════════════

function renderInstancesTab(content) {
  const user  = getUser();
  const orgId = user?.org_id || 'ORG001';
  content.innerHTML = `
    <div class="fade-in" id="instances-panel">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div>
          <div class="section-title" style="margin-bottom:2px">평가 인스턴스 현황</div>
          <div class="section-subtitle">조직 내 모든 평가 진행 상태와 전환 가능 여부를 확인합니다.</div>
        </div>
        <button id="refresh-instances-btn" class="btn btn-ghost btn-sm" style="min-height:36px">🔄 새로고침</button>
      </div>
      <div id="instances-list"><div class="loading-overlay" style="min-height:120px"><div class="spinner"></div></div></div>

      <!-- Calibration panel (cycle-level) -->
      <div style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px">
        <div style="font-size:0.88rem;font-weight:700;color:var(--text);margin-bottom:4px">⚖️ 캘리브레이션 (사이클 단위)</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">점수 계산이 완료된 인스턴스들에 대해 강제 분포 또는 편향 분석을 실행합니다.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input id="calib-cycle-id" type="text" placeholder="사이클 ID 입력"
                 style="flex:1;min-width:140px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:0.78rem;background:var(--surface)">
          <button id="calib-forced-btn" class="btn btn-sm"
                  style="background:#7C3AED;color:#fff;font-size:0.75rem;min-height:32px;padding:0 12px;white-space:nowrap">
            🎯 강제 분포 적용
          </button>
          <button id="calib-bias-btn" class="btn btn-sm btn-secondary"
                  style="font-size:0.75rem;min-height:32px;padding:0 12px;white-space:nowrap">
            🔍 편향 분석
          </button>
        </div>
        <div id="calib-result" style="margin-top:10px"></div>
      </div>
    </div>`;

  const listEl = content.querySelector('#instances-list');

  async function loadInstances() {
    listEl.innerHTML = `<div class="loading-overlay" style="min-height:120px"><div class="spinner"></div></div>`;
    try {
      const res = await api.assessment.listByOrg(orgId);
      const items = res?.instances || [];
      if (!items.length) {
        listEl.innerHTML = `<div class="empty-state" style="min-height:120px">
          <div class="empty-state-icon">📭</div>
          <div class="empty-state-title">평가 인스턴스 없음</div>
          <div class="empty-state-desc">직원 배정 탭에서 평가를 시작하세요.</div>
        </div>`;
        return;
      }
      // ── 완료율 요약 바 ───────────────────────────────────────
      const TERM = new Set(['completed','calibrated','approved','finalized']);
      const total     = items.length;
      const done      = items.filter(i => TERM.has(i.status)).length;
      const inProg    = items.filter(i => !TERM.has(i.status) && i.status !== 'cancelled').length;
      const cancelled = items.filter(i => i.status === 'cancelled').length;
      const pct       = Math.round(done / total * 100);
      const barColor  = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';
      listEl.innerHTML = `
        <div style="background:var(--surface);border-radius:var(--radius-md);padding:14px 16px;
                    margin-bottom:12px;border:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-size:0.82rem;font-weight:700;color:var(--text)">📊 전체 완료율</span>
            <span style="font-size:0.88rem;font-weight:800;color:${barColor}">${done} / ${total} (${pct}%)</span>
          </div>
          <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${barColor};border-radius:4px;transition:width .6s ease"></div>
          </div>
          <div style="display:flex;gap:14px;margin-top:8px;font-size:0.72rem;color:var(--text-muted)">
            <span>✅ 완료 ${done}</span>
            <span>⏳ 진행 ${inProg}</span>
            ${cancelled ? `<span>❌ 취소 ${cancelled}</span>` : ''}
          </div>
        </div>
      ` + items.map(inst => {
        const color = STATUS_COLOR[inst.status] || '#94A3B8';
        const label = STATUS_LABELS[inst.status] || inst.status;
        return `
        <div class="card" data-inst-id="${escapeHtml(inst.id)}"
             style="padding:12px 14px;margin-bottom:8px;border-left:3px solid ${color}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:0.88rem;margin-bottom:2px">
                ${escapeHtml(inst.assessee_name || inst.assessee_id)}
              </div>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px">
                ${escapeHtml(inst.template_name || '템플릿 없음')} · ${escapeHtml(inst.cycle_name || '')}
              </div>
              <span style="display:inline-block;padding:2px 8px;border-radius:999px;
                           background:${color}22;color:${color};font-size:0.72rem;font-weight:700">
                ${label}
              </span>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex-shrink:0">
              <button class="btn btn-sm btn-secondary check-transition-btn" data-id="${escapeHtml(inst.id)}"
                      style="font-size:0.72rem;min-height:30px;padding:0 10px">
                전환 상태 확인
              </button>
              <button class="btn btn-sm btn-secondary show-evaluators-btn" data-id="${escapeHtml(inst.id)}"
                      style="font-size:0.72rem;min-height:30px;padding:0 10px">
                👥 평가자 현황
              </button>
              <button class="btn btn-sm btn-primary do-transition-btn" data-id="${escapeHtml(inst.id)}"
                      style="font-size:0.72rem;min-height:30px;padding:0 10px"
                      ${inst.status === 'completed' ? 'disabled' : ''}>
                다음 단계 →
              </button>
              <button class="btn btn-sm compute-score-btn" data-id="${escapeHtml(inst.id)}"
                      style="font-size:0.72rem;min-height:30px;padding:0 10px;background:#7C3AED;color:#fff">
                📊 점수 계산
              </button>
              <button class="btn btn-sm get-evidence-btn" data-id="${escapeHtml(inst.id)}"
                      style="font-size:0.72rem;min-height:30px;padding:0 10px;background:#EC4899;color:#fff">
                📝 증거 요약
              </button>
              <button class="btn btn-sm generate-idp-btn" data-id="${escapeHtml(inst.id)}" data-assessee="${escapeHtml(inst.assessee_id || '')}"
                      style="font-size:0.72rem;min-height:30px;padding:0 10px;background:#059669;color:#fff">
                🌱 IDP 생성
              </button>
              ${(inst.status === 'draft' || inst.status === 'self_evaluation') ? `
              <button class="btn btn-sm send-invite-email-btn"
                      data-id="${escapeHtml(inst.id)}"
                      data-name="${escapeHtml(inst.assessee_name || inst.assessee_id || '')}"
                      data-cycle="${escapeHtml(inst.cycle_name || '역량 평가')}"
                      style="font-size:0.72rem;min-height:30px;padding:0 10px;background:#0EA5E9;color:#fff">
                📧 평가 초대
              </button>` : ''}
            </div>
          </div>
          <div class="transition-detail" id="detail-${escapeHtml(inst.id)}" style="display:none;margin-top:10px"></div>
          <div class="evaluator-detail" id="eval-${escapeHtml(inst.id)}" style="display:none;margin-top:10px"></div>
          <div class="score-result" id="score-${escapeHtml(inst.id)}" style="display:none;margin-top:10px"></div>
          <div class="evidence-detail" id="evidence-${escapeHtml(inst.id)}" style="display:none;margin-top:10px"></div>
          <div class="idp-result" id="idp-${escapeHtml(inst.id)}" style="display:none;margin-top:10px"></div>
        </div>`;
      }).join('');

      // "전환 상태 확인" 버튼
      listEl.querySelectorAll('.check-transition-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const detail = listEl.querySelector(`#detail-${id}`);
          if (detail.style.display === 'block') { detail.style.display = 'none'; return; }
          btn.disabled = true;
          btn.textContent = '조회 중...';
          try {
            const ts = await api.assessment.getTransitionStatus(id);
            if (!ts) { showTransitionDetail(detail, null); return; }
            showTransitionDetail(detail, ts);
          } catch (e) {
            detail.innerHTML = `<div style="color:var(--error);font-size:0.78rem">조회 실패: ${e.message}</div>`;
            detail.style.display = 'block';
          } finally {
            btn.disabled = false;
            btn.textContent = '전환 상태 확인';
          }
        });
      });

      // "👥 평가자 현황" 버튼
      listEl.querySelectorAll('.show-evaluators-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const panel = listEl.querySelector(`#eval-${id}`);
          if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
          btn.disabled = true;
          btn.textContent = '조회 중...';
          try {
            const [status, orgUsers] = await Promise.all([
              api.assessment.getStatus(id),
              api.organization.listUsers(orgId),
            ]);
            renderEvaluatorPanel(panel, id, status, orgUsers?.users || []);
          } catch (e) {
            panel.innerHTML = `<div style="color:var(--error);font-size:0.78rem">조회 실패: ${e.message}</div>`;
            panel.style.display = 'block';
          } finally {
            btn.disabled = false;
            btn.textContent = '👥 평가자 현황';
          }
        });
      });

      // "다음 단계 →" 버튼
      listEl.querySelectorAll('.do-transition-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const detail = listEl.querySelector(`#detail-${id}`);
          btn.disabled = true;
          btn.textContent = '처리 중...';
          try {
            const ts = await api.assessment.getTransitionStatus(id);
            if (!ts?.next_status) {
              showToast('전환 가능한 다음 단계가 없습니다.', 'error');
              showTransitionDetail(detail, ts);
              return;
            }
            const result = await api.assessment.transition(id, ts.next_status);
            if (result?.ok) {
              showToast(`✅ ${ts.current_label} → ${ts.next_label} 전환 완료`, 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '✅  →  전환 완료' });
              await loadInstances();
            } else {
              showTransitionDetail(detail, { ...ts, _error: result });
              showToast(result?.message || '전환 실패', 'error');
            }
          } catch (e) {
            showToast(`전환 오류: ${e.message}`, 'error');
          } finally {
            btn.disabled = false;
            btn.textContent = '다음 단계 →';
          }
        });
      });

      // "📊 점수 계산" 버튼
      listEl.querySelectorAll('.compute-score-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const scorePanel = listEl.querySelector(`#score-${id}`);
          if (scorePanel.style.display === 'block') { scorePanel.style.display = 'none'; return; }
          btn.disabled = true;
          btn.textContent = '계산 중...';
          try {
            const result = await api.assessment.computeScores(id);
            if (!result || result.ok === false) {
              const msg = result?.message || result?.error || '점수 계산 실패';
              scorePanel.innerHTML = `<div style="color:var(--error);font-size:0.78rem;padding:8px">❌ ${escapeHtml(msg)}</div>`;
              scorePanel.style.display = 'block';
              showToast(msg, 'error');
              return;
            }
            const gs = result.group_scores || {};
            const overall = gs.overall != null ? Number(gs.overall).toFixed(2) : '-';
            const rows = Object.entries(gs)
              .filter(([k]) => k !== 'overall')
              .map(([k, v]) => `<div style="display:flex;justify-content:space-between;font-size:0.75rem;padding:2px 0">
                <span style="color:var(--text-muted)">${escapeHtml(k)}</span>
                <span style="font-weight:600">${v != null ? Number(v).toFixed(2) : '-'}</span>
              </div>`).join('');
            scorePanel.innerHTML = `
              <div style="background:var(--primary-light,#EEF2FF);border-radius:8px;padding:10px 12px">
                <div style="font-size:0.82rem;font-weight:700;color:var(--primary);margin-bottom:6px">
                  📊 점수 계산 완료 — 전체 평균 ${overall}점
                </div>
                ${rows}
              </div>`;
            scorePanel.style.display = 'block';
            showToast(`✅ 점수 계산 완료 (전체 ${overall}점)`, 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '✅ 점수 계산 완료 (전체 점)' });
          } catch (e) {
            scorePanel.innerHTML = `<div style="color:var(--error);font-size:0.78rem;padding:8px">계산 오류: ${escapeHtml(e.message)}</div>`;
            scorePanel.style.display = 'block';
            showToast(`계산 오류: ${e.message}`, 'error');
          } finally {
            btn.disabled = false;
            btn.textContent = '📊 점수 계산';
          }
        });
      });

      // "📝 증거 요약" 버튼
      listEl.querySelectorAll('.get-evidence-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const evPanel = listEl.querySelector(`#evidence-${id}`);
          if (evPanel.style.display === 'block') { evPanel.style.display = 'none'; return; }
          btn.disabled = true;
          btn.textContent = '조회 중...';
          try {
            const result = await api.assessment.getEvidence(id);
            if (!result) {
              evPanel.innerHTML = `<div style="color:var(--error);font-size:0.78rem;padding:8px">❌ 증거 데이터 조회 실패</div>`;
              evPanel.style.display = 'block';
              return;
            }
            const count = result.evidence_count || 0;
            const insight = result.insight || '증거 분석 불가';
            const biasAnalysis = result.bias_analysis || {};
            const commentInsights = result.comment_insights || '';

            // Format bias analysis
            const biasList = Object.entries(biasAnalysis)
              .filter(([id]) => id !== 'unknown')
              .map(([evaluatorId, analysis]) => {
                const severity = analysis.bias_severity || 'low';
                const biasType = analysis.bias_type || 'balanced';
                const typeLabel = biasType === 'lenient' ? '관대' : biasType === 'strict' ? '엄격' : '중립';
                const severityBg = severity === 'high' ? '#FEE2E2' : severity === 'medium' ? '#FEF3C7' : '#F0FDF4';
                const severityText = severity === 'high' ? '#7F1D1D' : severity === 'medium' ? '#92400E' : '#166534';
                return `
                  <div style="background:${severityBg};border-left:3px solid ${severityText};padding:6px 8px;margin-bottom:6px;border-radius:3px">
                    <div style="font-size:0.75rem;color:${severityText};font-weight:600">
                      ${escapeHtml(evaluatorId)} — ${typeLabel} (심도: ${severity})
                    </div>
                    <div style="font-size:0.7rem;color:${severityText}">평균 점수: ${analysis.avg_score?.toFixed(2) || '-'} (${analysis.score_count || 0}건)</div>
                  </div>
                `;
              }).join('');

            evPanel.innerHTML = `
              <div style="background:#FDF2F8;border-radius:8px;padding:10px 12px;max-height:500px;overflow-y:auto">
                <div style="font-size:0.82rem;font-weight:700;color:#BE185D;margin-bottom:8px">
                  📝 증거 요약 — ${count}건 수집됨
                </div>

                <div style="font-size:0.78rem;color:var(--text);line-height:1.5;white-space:pre-wrap;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #E879F9">
                  ${escapeHtml(insight)}
                </div>

                ${biasList ? `
                <div style="margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #E879F9">
                  <div style="font-size:0.78rem;font-weight:600;color:#BE185D;margin-bottom:6px">⚖️ 평가자 편차 분석</div>
                  ${biasList}
                </div>
                ` : ''}

                ${commentInsights ? `
                <div>
                  <div style="font-size:0.78rem;font-weight:600;color:#BE185D;margin-bottom:6px">💬 코멘트 기반 인사이트</div>
                  <div style="font-size:0.75rem;color:var(--text);line-height:1.4;white-space:pre-wrap">
                    ${escapeHtml(commentInsights)}
                  </div>
                </div>
                ` : ''}
              </div>`;
            evPanel.style.display = 'block';
            showToast(`✅ 증거 분석 완료 (${count}건)`, 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '✅ 증거 분석 완료 (건)' });
          } catch (e) {
            evPanel.innerHTML = `<div style="color:var(--error);font-size:0.78rem;padding:8px">조회 오류: ${escapeHtml(e.message)}</div>`;
            evPanel.style.display = 'block';
          } finally {
            btn.disabled = false;
            btn.textContent = '📝 증거 요약';
          }
        });
      });

      // "🌱 IDP 생성" 버튼
      listEl.querySelectorAll('.generate-idp-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const idpPanel = listEl.querySelector(`#idp-${id}`);
          if (idpPanel.style.display === 'block') { idpPanel.style.display = 'none'; return; }
          btn.disabled = true;
          btn.textContent = '생성 중...';
          try {
            const result = await api.idp.generate({ instance_id: id });
            if (!result) {
              idpPanel.innerHTML = `<div style="color:var(--error);font-size:0.78rem;padding:8px">❌ IDP 생성 실패 (점수를 먼저 계산하세요)</div>`;
              idpPanel.style.display = 'block';
              showToast('IDP 생성 실패. 점수를 먼저 계산하세요.', 'error');
              return;
            }

            const created = result.items_created || 0;
            const items = result.idp_items || [];
            const priorityColors = { high: '#EF4444', medium: '#F59E0B', low: '#3B82F6' };

            const itemRows = items.slice(0, 5).map(item => {
              const pri = (item.priority || 'low').toLowerCase();
              const pColor = priorityColors[pri] || '#6B7280';
              return `
                <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #D1FAE5">
                  <span style="font-size:0.7rem;font-weight:600;color:${pColor};border:1px solid ${pColor};border-radius:3px;padding:1px 5px;min-width:36px;text-align:center">
                    ${escapeHtml(item.priority || 'Low')}
                  </span>
                  <div style="flex:1;min-width:0">
                    <div style="font-size:0.75rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                      ${escapeHtml(item.competency_name_ko || item.competency_id || '-')}
                    </div>
                    <div style="font-size:0.7rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                      ${escapeHtml(item.resource_title_ko || '-')}
                    </div>
                  </div>
                  <span style="font-size:0.7rem;color:var(--text-muted);flex-shrink:0">GAP ${Number(item.gap_score || 0).toFixed(1)}</span>
                </div>
              `;
            }).join('');

            idpPanel.innerHTML = `
              <div style="background:#ECFDF5;border-radius:8px;padding:10px 12px">
                <div style="font-size:0.82rem;font-weight:700;color:#065F46;margin-bottom:8px">
                  🌱 IDP 생성 완료 — ${created}개 개발 과제 생성됨
                </div>
                ${itemRows}
                ${items.length > 5 ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">외 ${items.length - 5}건</div>` : ''}
              </div>`;
            idpPanel.style.display = 'block';
            showToast(`✅ IDP ${created}건 생성 완료`, 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '✅ IDP 건 생성 완료' });
          } catch (e) {
            idpPanel.innerHTML = `<div style="color:var(--error);font-size:0.78rem;padding:8px">오류: ${escapeHtml(e.message)}</div>`;
            idpPanel.style.display = 'block';
            showToast(`IDP 오류: ${e.message}`, 'error');
          } finally {
            btn.disabled = false;
            btn.textContent = '🌱 IDP 생성';
          }
        });
      });

      // 평가 초대 이메일 버튼
      listEl.querySelectorAll('.send-invite-email-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const name      = btn.dataset.name;
          const cycleName = btn.dataset.cycle;
          const email     = prompt(`${name}님의 이메일 주소를 입력하세요.\n(빈칸이면 인앱 알림만 생성)`, '');
          if (email === null) return; // cancelled

          btn.disabled = true; btn.textContent = '발송 중…';
          if (email.trim()) {
            const res = await sendAssessmentInvite({
              toEmail: email.trim(), toName: name,
              cycleName, dueDate: '',
            });
            showToast(
              res.ok ? `${name}님에게 평가 초대 이메일을 발송했습니다.`
                     : `이메일 발송 실패 (${res.simulated ? '설정 필요' : res.error}). 인앱 알림으로 대체합니다.`,
              res.ok ? 'success' : 'info',
            );
          } else {
            showToast(`${name}님에게 평가 초대 인앱 알림을 전송했습니다.`, 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '님에게 평가 초대 인앱 알림을 전송했습니다.' });
          }
          btn.disabled = false; btn.textContent = '📧 평가 초대';
        });
      });

    } catch (e) {
      listEl.innerHTML = `<div style="color:var(--error);padding:16px;font-size:0.85rem">
        로드 실패: ${e.message}
      </div>`;
    }
  }

  content.querySelector('#refresh-instances-btn').addEventListener('click', loadInstances);
  loadInstances();

  // Calibration buttons
  const calibResult = content.querySelector('#calib-result');
  const getCycleId  = () => (content.querySelector('#calib-cycle-id')?.value || '').trim();

  content.querySelector('#calib-forced-btn').addEventListener('click', async () => {
    const cycleId = getCycleId();
    if (!cycleId) { showToast('사이클 ID를 입력하세요.', 'error'); return; }
    const btn = content.querySelector('#calib-forced-btn');
    btn.disabled = true;
    btn.textContent = '처리 중...';
    calibResult.innerHTML = '';
    try {
      const result = await api.assessment.calibrate(cycleId, { top_pct: 0.2, bottom_pct: 0.2 });
      if (!result || result.ok === false) {
        calibResult.innerHTML = `<div style="color:var(--error);font-size:0.78rem">❌ ${escapeHtml(result?.error || result?.message || '실패')}</div>`;
        return;
      }
      const s = result.summary || {};
      const rows = Object.entries(result.distribution || {})
        .sort((a, b) => a[1].rank - b[1].rank)
        .map(([instId, d]) => `
          <div style="display:flex;justify-content:space-between;font-size:0.73rem;padding:2px 0;border-bottom:1px solid var(--border)">
            <span style="color:var(--text-muted);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${escapeHtml(instId)}</span>
            <span style="margin:0 8px;font-weight:600">${Number(d.final_score).toFixed(2)}</span>
            <span class="badge ${d.level==='L3'?'badge-success':d.level==='L2'?'badge-primary':'badge-warning'}" style="font-size:0.68rem">${d.level}</span>
          </div>`).join('');
      calibResult.innerHTML = `
        <div style="background:#F5F3FF;border-radius:8px;padding:10px 12px">
          <div style="font-size:0.82rem;font-weight:700;color:#7C3AED;margin-bottom:8px">
            🎯 강제 분포 완료 — L3: ${s.L3||0}명 / L2: ${s.L2||0}명 / L1: ${s.L1||0}명
          </div>
          <div style="max-height:160px;overflow-y:auto">${rows}</div>
        </div>`;
      showToast(`✅ 강제 분포 적용 완료 (총 ${result.total}명)`, 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '✅ 강제 분포 적용 완료 (총 명)' });
    } catch (e) {
      calibResult.innerHTML = `<div style="color:var(--error);font-size:0.78rem">오류: ${escapeHtml(e.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '🎯 강제 분포 적용';
    }
  });

  content.querySelector('#calib-bias-btn').addEventListener('click', async () => {
    const cycleId = getCycleId();
    if (!cycleId) { showToast('사이클 ID를 입력하세요.', 'error'); return; }
    const btn = content.querySelector('#calib-bias-btn');
    btn.disabled = true;
    btn.textContent = '분석 중...';
    calibResult.innerHTML = '';
    try {
      const result = await api.assessment.biasReport(cycleId, { auto_correct: false });
      if (!result || result.ok === false) {
        calibResult.innerHTML = `<div style="color:var(--error);font-size:0.78rem">❌ ${escapeHtml(result?.error || result?.message || '실패')}</div>`;
        return;
      }
      const BIAS_KO = { leniency: '관대 편향', strictness: '엄격 편향', central: '중앙 편향', none: '정상' };
      const SEV_COLOR = { high: '#DC2626', medium: '#F59E0B', low: '#6B7280', none: '#10B981' };
      const rows = (result.bias_report || [])
        .filter(b => b.bias_type !== 'none')
        .map(b => `
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.73rem;padding:4px 0;border-bottom:1px solid var(--border)">
            <span style="color:var(--text-muted);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${escapeHtml(b.evaluator_id)}</span>
            <span style="margin:0 8px;color:${SEV_COLOR[b.severity]||'#6B7280'};font-weight:700">${escapeHtml(BIAS_KO[b.bias_type]||b.bias_type)}</span>
            <span style="width:50px;text-align:right;font-weight:600">δ ${b.delta>=0?'+':''}${Number(b.delta).toFixed(2)}</span>
          </div>`).join('');
      calibResult.innerHTML = `
        <div style="background:#FFFBEB;border-radius:8px;padding:10px 12px">
          <div style="font-size:0.82rem;font-weight:700;color:#92400E;margin-bottom:8px">
            🔍 편향 분석 완료 — ${result.biased_count}명 편향 감지 / 총 ${result.total_evaluators}명
          </div>
          ${rows || '<div style="color:var(--text-muted);font-size:0.75rem">편향 없음</div>'}
        </div>`;
      showToast(`편향 분석 완료: ${result.biased_count}명 감지`, result.biased_count > 0 ? 'error' : 'success');
    } catch (e) {
      calibResult.innerHTML = `<div style="color:var(--error);font-size:0.78rem">오류: ${escapeHtml(e.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '🔍 편향 분석';
    }
  });
}

function showTransitionDetail(el, ts) {
  if (!ts) {
    el.innerHTML = `<div style="font-size:0.78rem;color:var(--text-muted)">상태 정보 없음 (로컬 백엔드 전용)</div>`;
    el.style.display = 'block';
    return;
  }
  const canAdvance = ts.can_advance;
  const br = ts.block_reason;
  const snap = br?.instance_snapshot || {};

  el.innerHTML = `
    <div style="background:var(--surface-alt,#F8FAFC);border-radius:6px;padding:10px 12px;font-size:0.78rem">
      ${canAdvance
        ? `<div style="color:var(--success,#10B981);font-weight:700;margin-bottom:6px">
             ✅ 전환 가능: ${escapeHtml(ts.current_label)} → ${escapeHtml(ts.next_label || '')}
           </div>`
        : `<div style="color:var(--error,#EF4444);font-weight:700;margin-bottom:6px">
             🚫 전환 불가
           </div>
           ${br ? `
           <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:4px;padding:8px 10px;margin-bottom:6px">
             <div style="font-weight:600;margin-bottom:2px">차단 이유</div>
             <div style="color:#991B1B">${escapeHtml(br.hint_ko || '')}</div>
             ${br.condition ? `<div style="margin-top:4px;color:var(--text-muted);font-family:monospace">${escapeHtml(br.condition)}</div>` : ''}
           </div>` : ''}`
      }
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;color:var(--text-muted)">
        <span>자기평가</span><span style="color:${snap.self_completed ? '#10B981' : '#EF4444'}">${snap.self_completed ? '완료' : '미완료'}</span>
        <span>동료평가 응답</span><span style="color:${snap.peer_count >= 2 ? '#10B981' : '#F59E0B'}">${snap.peer_count ?? 0}명</span>
        <span>관리자평가</span><span style="color:${snap.manager_completed ? '#10B981' : '#EF4444'}">${snap.manager_completed ? '완료' : '미완료'}</span>
        <span>캘리브레이션</span><span style="color:${snap.calibration_completed ? '#10B981' : '#EF4444'}">${snap.calibration_completed ? '완료' : '미완료'}</span>
      </div>
    </div>`;
  el.style.display = 'block';
}

const EVALUATOR_TYPE_LABELS = {
  self: '자기평가', manager: '관리자평가', peer: '동료평가',
  subordinate: '부하평가', hr: 'HR평가',
};

function renderEvaluatorPanel(el, instanceId, statusData, orgUsers) {
  const assignments = statusData?.evaluator_assignments || [];
  const byType = {};
  for (const a of assignments) {
    if (!byType[a.evaluator_type]) byType[a.evaluator_type] = [];
    byType[a.evaluator_type].push(a);
  }

  const types = ['self', 'manager', 'peer', 'subordinate', 'hr'];

  el.innerHTML = `
    <div style="background:var(--surface-alt,#F8FAFC);border-radius:6px;padding:10px 12px;font-size:0.78rem">
      <div style="font-weight:700;margin-bottom:8px;color:var(--text)">배정된 평가자</div>
      ${types.map(type => {
        const list = byType[type] || [];
        const label = EVALUATOR_TYPE_LABELS[type] || type;
        return `
        <div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <span style="font-weight:600;color:var(--text)">${label}</span>
            <button class="add-evaluator-btn btn btn-ghost btn-sm"
                    data-type="${type}" data-iid="${escapeHtml(instanceId)}"
                    style="font-size:0.7rem;min-height:26px;padding:0 8px;color:var(--primary)">
              + 추가
            </button>
          </div>
          ${list.length === 0
            ? `<span style="color:var(--text-muted)">배정 없음</span>`
            : list.map(a => `
              <span style="display:inline-flex;align-items:center;gap:4px;
                           padding:2px 8px;margin:1px;border-radius:999px;
                           background:${a.status === 'completed' ? '#D1FAE5' : '#F1F5F9'};
                           color:${a.status === 'completed' ? '#065F46' : '#475569'};font-size:0.72rem">
                ${a.status === 'completed' ? '✅' : '⏳'} ${escapeHtml(a.evaluator_name || a.evaluator_id)}
              </span>`).join('')
          }
          <div class="assign-form" data-type="${type}" style="display:none;margin-top:6px">
            <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">조직 구성원 선택 (복수 선택 가능)</div>
            <div class="user-pick-list" style="display:flex;flex-wrap:wrap;gap:4px;max-height:120px;overflow-y:auto;
                         padding:6px;background:var(--surface);border:1px solid var(--border);border-radius:4px">
              ${orgUsers.map(u => `
                <label style="display:flex;align-items:center;gap:4px;padding:3px 7px;
                              border-radius:4px;cursor:pointer;font-size:0.72rem;
                              background:var(--surface-alt);white-space:nowrap">
                  <input type="checkbox" value="${escapeHtml(u.id)}" style="margin:0">
                  ${escapeHtml(u.name_ko || u.email)}
                </label>`).join('')}
            </div>
            <button class="do-assign-btn btn btn-primary btn-sm"
                    data-type="${type}" data-iid="${escapeHtml(instanceId)}"
                    style="margin-top:6px;font-size:0.72rem;min-height:28px">
              배정 저장
            </button>
          </div>
        </div>`;
      }).join('')}
    </div>`;

  el.style.display = 'block';

  // "+ 추가" 토글
  el.querySelectorAll('.add-evaluator-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const form = el.querySelector(`.assign-form[data-type="${btn.dataset.type}"]`);
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });
  });

  // "배정 저장"
  el.querySelectorAll('.do-assign-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const form = el.querySelector(`.assign-form[data-type="${btn.dataset.type}"]`);
      const checked = [...form.querySelectorAll('input[type=checkbox]:checked')].map(c => c.value);
      if (!checked.length) { showToast('최소 1명을 선택해주세요.', 'error'); return; }
      btn.disabled = true;
      btn.textContent = '저장 중...';
      try {
        const res = await api.assessment.assignEvaluators(btn.dataset.iid, btn.dataset.type, checked);
        if (res?.ok) {
          showToast(`${EVALUATOR_TYPE_LABELS[btn.dataset.type]} ${res.added}명 배정 완료`, 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '명 배정 완료' });
          // Refresh the panel
          const newStatus = await api.assessment.getStatus(btn.dataset.iid);
          const orgId = getUser()?.org_id || 'ORG001';
          const orgUsersRes = await api.organization.listUsers(orgId);
          renderEvaluatorPanel(el, btn.dataset.iid, newStatus, orgUsersRes?.users || []);
        } else {
          showToast(res?.error || '배정 실패', 'error');
          btn.disabled = false;
          btn.textContent = '배정 저장';
        }
      } catch (e) {
        showToast(`오류: ${e.message}`, 'error');
        btn.disabled = false;
        btn.textContent = '배정 저장';
      }
    });
  });
}

// ══════════════════════════════════════════════════════════════
// Tab 1 – 직원 배정
// ══════════════════════════════════════════════════════════════

function renderAssignTab(content) {
  const activeKits = getActiveKits();

  content.innerHTML = `
    <div class="fade-in">
      <div class="section-title" style="margin-bottom:4px">직원별 진단 배정</div>
      <div class="section-subtitle" style="margin-bottom:14px">
        각 직원에게 역량 평가 템플릿과 진단 Kit을 배정하세요.
      </div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px;
                  padding:10px 12px;background:var(--surface);border-radius:var(--radius-sm);
                  border:1px solid var(--border);font-size:0.78rem;color:var(--text-muted)">
        <span>📋 <strong>역량 템플릿</strong>: 카드 스와이프 역량 진단</span>
        <span>🧩 <strong>진단 Kit</strong>: 성격·행동 유형 진단</span>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px">
        ${_state.employees.map(emp => {
          const asgn = _state.assignments[emp.id] || {};
          return `
            <div class="card" style="padding:14px 16px">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                <div style="width:34px;height:34px;border-radius:50%;flex-shrink:0;
                            background:linear-gradient(135deg,var(--primary),var(--primary-light));
                            display:flex;align-items:center;justify-content:center;
                            font-size:0.85rem;font-weight:700;color:#fff">
                  ${escapeHtml((emp.name_ko || emp.name || '?')[0])}
                </div>
                <div>
                  <div style="font-weight:700;font-size:0.9rem">${escapeHtml(emp.name_ko || emp.name)}</div>
                  <div style="font-size:0.73rem;color:var(--text-muted)">${escapeHtml(emp.dept)} · ${escapeHtml(emp.level_code || emp.level || '')}</div>
                </div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <div style="flex:1;min-width:130px">
                  <label style="font-size:0.7rem;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">📋 역량 템플릿</label>
                  <select class="assign-tpl-select" data-emp-id="${emp.id}"
                          style="width:100%;padding:7px 10px;font-size:0.8rem;
                                 border:1.5px solid var(--border);border-radius:var(--radius-sm);
                                 background:var(--surface);color:var(--text)">
                    <option value="">배정 없음</option>
                    ${_state.templates.map(t => `
                      <option value="${t.id}" ${asgn.template_id === t.id ? 'selected' : ''}>
                        ${escapeHtml(t.name_ko || t.name)}
                      </option>`).join('')}
                  </select>
                </div>
                <div style="flex:1;min-width:130px">
                  <label style="font-size:0.7rem;font-weight:600;color:var(--text-muted);display:block;margin-bottom:3px">🧩 진단 Kit</label>
                  <select class="assign-kit-select" data-emp-id="${emp.id}"
                          style="width:100%;padding:7px 10px;font-size:0.8rem;
                                 border:1.5px solid var(--border);border-radius:var(--radius-sm);
                                 background:var(--surface);color:var(--text)">
                    <option value="">배정 없음</option>
                    ${activeKits.map(k => `
                      <option value="${k.id}" ${asgn.kit_id === k.id ? 'selected' : ''}>
                        ${k.icon} ${escapeHtml(k.name_ko)}
                      </option>`).join('')}
                  </select>
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>

      <button class="btn btn-primary btn-block" id="save-assignments-btn">💾 배정 저장</button>
    </div>
  `;

  content.querySelector('#save-assignments-btn')?.addEventListener('click', () => saveAssignments(content));
}

async function saveAssignments(content) {
  const updated = { ..._state.assignments };
  content.querySelectorAll('.card').forEach(card => {
    const tplSel = card.querySelector('.assign-tpl-select');
    const kitSel = card.querySelector('.assign-kit-select');
    if (!tplSel) return;
    const empId = tplSel.dataset.empId;
    if (!empId) return;
    updated[empId] = { template_id: tplSel.value || null, kit_id: kitSel?.value || null };
  });
  _state.assignments = updated;
  localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(updated));

  const user  = getUser();
  const orgId = user?.org_id || 'ORG001';
  for (const [empId, { template_id }] of Object.entries(updated)) {
    if (!template_id) continue;
    try {
      const cycle = await api.assessment.createCycle({ org_id: orgId, template_id, name: `관리자 배정 - ${new Date().toLocaleDateString('ko')}` });
      if (cycle?.id) await api.assessment.createInstance(cycle.id, { assessee_id: empId, assessor_id: empId, assessor_role: 'self' });
    } catch (_) {}
  }
  showToast('배정이 저장되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '배정이 저장되었습니다.' });
}

// ══════════════════════════════════════════════════════════════
// Tab 2 – 진단 Kit
// ══════════════════════════════════════════════════════════════

function renderKitsTab(content) {
  content.innerHTML = `
    <div class="fade-in">
      <div class="card" style="padding:14px 16px;margin-bottom:18px;
                                background:linear-gradient(135deg,#EEF2FF,#F5F3FF);
                                border:1.5px solid var(--primary-light)">
        <div style="font-weight:700;font-size:0.92rem;color:var(--primary);margin-bottom:5px">🧩 인적성 · 성격 진단 Kit</div>
        <div style="font-size:0.8rem;color:var(--text);line-height:1.6;word-break:keep-all">
          역량 진단과 별도로 구성원의 <strong>성격·행동·직업 흥미 유형</strong>을 파악하는 표준화 진단 도구입니다.
          활성화된 Kit은 직원이 스스로 진단하거나 관리자가 배정 탭에서 매핑할 수 있습니다.
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px" id="kit-cards-area">
        ${DIAGNOSTIC_KITS.map(kit => renderKitCard(kit)).join('')}
      </div>
    </div>
  `;
  bindKitCardEvents(content);
}

function renderKitCard(kit) {
  const isActive     = kit.active;
  const isPreviewing = _state.kitPreview === kit.id;
  return `
    <div class="card kit-card" data-kit-id="${kit.id}"
         style="padding:0;overflow:hidden;border:2px solid var(--border)">
      <div style="padding:16px;display:flex;align-items:center;gap:12px">
        <div style="font-size:2rem;line-height:1;flex-shrink:0">${kit.icon}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:4px">
            <div style="font-weight:700;font-size:0.92rem">${escapeHtml(kit.name_ko)}</div>
            <span style="padding:2px 8px;background:${kit.color}20;color:${kit.color};border-radius:999px;font-size:0.68rem;font-weight:700">
              ${escapeHtml(kit.tag_ko || kit.type)}
            </span>
            ${isActive
              ? `<span style="padding:2px 8px;background:#ECFDF5;color:#059669;border-radius:999px;font-size:0.68rem;font-weight:700">● 활성</span>`
              : `<span style="padding:2px 8px;background:#F1F5F9;color:#64748B;border-radius:999px;font-size:0.68rem;font-weight:700">준비중</span>`}
          </div>
          <div style="font-size:0.78rem;color:var(--text-muted);line-height:1.5;word-break:keep-all">
            ${escapeHtml(kit.description_ko)}
          </div>
          <div style="margin-top:5px;font-size:0.7rem;color:var(--text-light)">
            총 ${kit.question_count}문항 · 제공: ${escapeHtml(kit.vendor)}
          </div>
        </div>
      </div>
      ${isActive ? `
        <div style="display:flex;border-top:1px solid var(--border)">
          <button class="kit-preview-btn" data-kit-id="${kit.id}"
                  style="flex:1;padding:10px;font-size:0.8rem;font-weight:600;
                         background:none;border:none;cursor:pointer;color:var(--primary);
                         border-right:1px solid var(--border)">
            ${isPreviewing ? '▲ 닫기' : '▼ 문항·유형 미리보기'}
          </button>
          <button class="kit-start-btn" data-kit-id="${kit.id}"
                  style="flex:1;padding:10px;font-size:0.8rem;font-weight:600;
                         background:var(--primary);border:none;cursor:pointer;color:#fff">
            진단 시작 →
          </button>
        </div>
      ` : `
        <div style="border-top:1px solid var(--border);padding:9px 16px;
                    font-size:0.78rem;color:var(--text-muted);text-align:center">곧 출시 예정입니다</div>
      `}
      ${isPreviewing && kit.questions ? renderKitPreview(kit) : ''}
    </div>
  `;
}

function renderKitPreview(kit) {
  if (kit.id === 'KIT_MBTI') return renderMbtiPreview(kit);
  return `<div style="padding:16px;border-top:1px solid var(--border);background:#F8FAFC;font-size:0.8rem;color:var(--text-muted)">미리보기를 준비 중입니다.</div>`;
}

function renderMbtiPreview(kit) {
  const axes = [
    { key:'EI', label:'에너지 방향', left:'E 외향', right:'I 내향', color:'#4F46E5' },
    { key:'SN', label:'인식 기능',   left:'S 감각', right:'N 직관', color:'#7C3AED' },
    { key:'TF', label:'판단 기능',   left:'T 사고', right:'F 감정', color:'#2563EB' },
    { key:'JP', label:'생활 양식',   left:'J 판단', right:'P 인식', color:'#059669' },
  ];
  const byAxis = {};
  axes.forEach(a => { byAxis[a.key] = kit.questions.filter(q => q.axis === a.key); });

  return `
    <div style="border-top:1px solid var(--border);background:#F8FAFC;padding:16px">
      <div style="margin-bottom:14px">
        <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">4가지 진단 축 (총 ${kit.question_count}문항)</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${axes.map(a => `
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:0.72rem;font-weight:700;padding:3px 10px;background:${a.color}20;color:${a.color};border-radius:999px;min-width:48px;text-align:center">${a.key}</span>
              <span style="font-size:0.78rem;color:var(--text)">${a.label}</span>
              <span style="font-size:0.72rem;color:var(--text-muted);margin-left:auto">${a.left} ↔ ${a.right} · ${byAxis[a.key].length}문항</span>
            </div>`).join('')}
        </div>
      </div>
      <div>
        <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">16가지 유형</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">
          ${Object.entries(kit.types).map(([code, info]) => `
            <div class="type-card ${_state.expandedType === code ? 'expanded' : ''}" data-type="${code}"
                 style="padding:10px;background:var(--surface);border-radius:var(--radius-sm);border:2px solid ${_state.expandedType === code ? 'var(--primary)' : 'var(--border)'}">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                <span style="font-size:1.1rem">${info.emoji}</span>
                <div>
                  <div style="font-weight:700;font-size:0.82rem">${code}</div>
                  <div style="font-size:0.68rem;color:var(--text-muted)">${info.ko}</div>
                </div>
              </div>
              ${_state.expandedType === code ? `
                <div style="margin-top:7px;padding-top:7px;border-top:1px solid var(--border)">
                  <div style="font-size:0.73rem;color:var(--text);line-height:1.5;margin-bottom:7px;word-break:keep-all">${escapeHtml(info.desc)}</div>
                  <div style="margin-bottom:5px">
                    <div style="font-size:0.68rem;font-weight:700;color:#059669;margin-bottom:3px">💪 강점</div>
                    ${info.strengths.map(s => `<span style="display:inline-block;padding:2px 7px;margin:1px;background:#ECFDF5;color:#059669;border-radius:999px;font-size:0.66rem">${escapeHtml(s)}</span>`).join('')}
                  </div>
                  <div style="margin-bottom:5px">
                    <div style="font-size:0.68rem;font-weight:700;color:#F59E0B;margin-bottom:3px">🌱 성장 영역</div>
                    ${info.growth.map(g => `<span style="display:inline-block;padding:2px 7px;margin:1px;background:#FFFBEB;color:#92400E;border-radius:999px;font-size:0.66rem">${escapeHtml(g)}</span>`).join('')}
                  </div>
                  <div style="padding:7px;background:#F1F5F9;border-radius:var(--radius-sm)">
                    <div style="font-size:0.68rem;font-weight:700;color:var(--text-muted);margin-bottom:2px">⚙️ 업무 스타일</div>
                    <div style="font-size:0.71rem;color:var(--text);line-height:1.5;word-break:keep-all">${escapeHtml(info.work_style)}</div>
                  </div>
                </div>
              ` : `
                <div style="font-size:0.71rem;color:var(--text-light);line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:keep-all">${escapeHtml(info.desc)}</div>
              `}
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}

function bindKitCardEvents(content) {
  content.querySelectorAll('.kit-preview-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const kitId = btn.dataset.kitId;
      _state.kitPreview   = _state.kitPreview === kitId ? null : kitId;
      _state.expandedType = null;
      refreshKitCards(content);
    });
  });
  content.querySelectorAll('.kit-start-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.hash = `#/diagnostic?kit=${btn.dataset.kitId}`;
    });
  });
  bindTypeCardEvents(content);
}

function bindTypeCardEvents(content) {
  content.querySelectorAll('.type-card').forEach(card => {
    card.addEventListener('click', () => {
      _state.expandedType = _state.expandedType === card.dataset.type ? null : card.dataset.type;
      refreshKitCards(content);
    });
  });
}

function refreshKitCards(content) {
  const area = content.querySelector('#kit-cards-area');
  if (!area) return;
  area.innerHTML = DIAGNOSTIC_KITS.map(kit => renderKitCard(kit)).join('');
  bindKitCardEvents(content);
}

// ══════════════════════════════════════════════════════════════
// Tab 3 – 평가 템플릿
// ══════════════════════════════════════════════════════════════

function renderTemplatesTab(content) {
  content.innerHTML = `
    <div class="fade-in">
      <div class="section-title" style="margin-bottom:4px">평가 템플릿 목록</div>
      <div class="section-subtitle" style="margin-bottom:14px">역량 진단에 사용되는 평가 템플릿을 관리합니다.</div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px">
        ${_state.templates.map(t => {
          const assignCount = Object.values(_state.assignments).filter(a => a.template_id === t.id).length;
          return `
            <div class="card" style="padding:16px">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
                <div style="flex:1;min-width:0">
                  <div style="font-weight:700;font-size:0.92rem;margin-bottom:6px">${escapeHtml(t.name_ko || t.name)}</div>
                  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
                    ${t.job_family ? `<span class="badge badge-info">${escapeHtml(t.job_family)}</span>` : ''}
                    ${t.level      ? `<span class="badge badge-gray">${escapeHtml(t.level)}</span>` : ''}
                    ${t.competency_count ? `<span class="badge badge-primary">${t.competency_count}개 역량</span>` : ''}
                  </div>
                  ${t.description_ko ? `<div style="font-size:0.78rem;color:var(--text-muted);line-height:1.5">${escapeHtml(t.description_ko)}</div>` : ''}
                </div>
                <div style="text-align:right;flex-shrink:0">
                  <div style="font-size:1.5rem;font-weight:800;color:var(--primary)">${assignCount}</div>
                  <div style="font-size:0.68rem;color:var(--text-muted)">배정됨</div>
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>
      <button class="btn btn-primary btn-block" id="go-builder-btn">+ 새 평가 템플릿 만들기</button>
    </div>
  `;
  content.querySelector('#go-builder-btn')?.addEventListener('click', () => {
    window.location.hash = '#/admin/template-builder';
  });
}

// ══════════════════════════════════════════════════════════════
// Tab – 정책 설정 (Evaluator Policy Config)
// ══════════════════════════════════════════════════════════════

const POLICY_TYPE_LABELS = {
  SELF: '자기평가', MANAGER: '관리자', PEER: '동료', SUBORDINATE: '부하직원', HR: 'HR',
};

async function renderPoliciesTab(content) {
  const user  = getUser();
  const orgId = user?.org_id || 'ORG001';

  content.innerHTML = `
    <div class="fade-in" id="policies-panel">
      <div style="margin-bottom:12px">
        <div class="section-title" style="margin-bottom:2px">평가자 정책 설정</div>
        <div class="section-subtitle">각 평가 정책의 가중치·최소/최대 인원·필수 여부를 설정합니다.</div>
      </div>
      <div id="policies-list">
        <div class="loading-overlay" style="min-height:120px"><div class="spinner"></div></div>
      </div>
    </div>`;

  const listEl = content.querySelector('#policies-list');

  let policies;
  try {
    policies = await api.configs.list(orgId, 'policy');
  } catch (e) {
    listEl.innerHTML = `<div style="color:var(--error);padding:16px;font-size:0.85rem">로드 실패: ${e.message}</div>`;
    return;
  }

  if (!policies || !policies.length) {
    listEl.innerHTML = `
      <div class="empty-state" style="min-height:120px">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-title">정책 없음</div>
        <div class="empty-state-desc">로컬 백엔드 실행 시 정책을 편집할 수 있습니다.</div>
      </div>`;
    return;
  }

  listEl.innerHTML = policies.map(p => {
    const evaluators = p.config_json?.evaluators || [];
    const totalWeight = evaluators.reduce((s, e) => s + (e.weight || 0), 0);
    const wOk = Math.abs(totalWeight - 100) <= 0.5;
    const pid = escapeHtml(p.id);

    return `
      <div class="card" data-policy-id="${pid}" style="padding:14px 16px;margin-bottom:10px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:0.9rem">${escapeHtml(p.name)}</div>
            ${p.config_json?.description
              ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">${escapeHtml(p.config_json.description)}</div>`
              : ''}
          </div>
          <button class="toggle-policy-btn btn btn-ghost btn-sm"
                  data-pid="${pid}" style="font-size:0.72rem;min-height:28px;padding:0 10px;flex-shrink:0">
            ⚙️ 편집
          </button>
        </div>

        <div class="policy-chips" data-pid="${pid}" style="display:flex;flex-wrap:wrap;gap:4px">
          ${evaluators.map(e => `
            <span style="padding:2px 8px;border-radius:999px;font-size:0.72rem;font-weight:600;
                         background:var(--surface-alt);color:var(--text)">
              ${POLICY_TYPE_LABELS[e.type] || e.type} ${e.weight}%
            </span>`).join('')}
        </div>

        <div class="policy-form" data-pid="${pid}" style="display:none;margin-top:12px">
          <table style="width:100%;border-collapse:collapse;font-size:0.78rem;margin-bottom:10px">
            <thead>
              <tr style="color:var(--text-muted);font-size:0.71rem">
                <th style="text-align:left;padding:4px 6px;border-bottom:1px solid var(--border)">유형</th>
                <th style="padding:4px 6px;border-bottom:1px solid var(--border)">가중치(%)</th>
                <th style="padding:4px 6px;border-bottom:1px solid var(--border)">최소</th>
                <th style="padding:4px 6px;border-bottom:1px solid var(--border)">최대</th>
                <th style="padding:4px 6px;border-bottom:1px solid var(--border)">필수</th>
              </tr>
            </thead>
            <tbody>
              ${evaluators.map((e, idx) => `
                <tr>
                  <td style="padding:5px 6px;font-weight:600">${POLICY_TYPE_LABELS[e.type] || e.type}</td>
                  <td style="padding:3px 4px;text-align:center">
                    <input type="number" class="ev-weight" data-idx="${idx}"
                           value="${e.weight}" min="0" max="100" step="1"
                           style="width:56px;text-align:center;padding:4px 3px;
                                  border:1px solid var(--border);border-radius:4px;font-size:0.78rem">
                  </td>
                  <td style="padding:3px 4px;text-align:center">
                    <input type="number" class="ev-min" data-idx="${idx}"
                           value="${e.min_count ?? 1}" min="0" max="20"
                           style="width:44px;text-align:center;padding:4px 3px;
                                  border:1px solid var(--border);border-radius:4px;font-size:0.78rem">
                  </td>
                  <td style="padding:3px 4px;text-align:center">
                    <input type="number" class="ev-max" data-idx="${idx}"
                           value="${e.max_count ?? 1}" min="0" max="20"
                           style="width:44px;text-align:center;padding:4px 3px;
                                  border:1px solid var(--border);border-radius:4px;font-size:0.78rem">
                  </td>
                  <td style="padding:3px 4px;text-align:center">
                    <input type="checkbox" class="ev-required" data-idx="${idx}"
                           ${e.required ? 'checked' : ''}
                           style="width:16px;height:16px;cursor:pointer">
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>

          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <div class="weight-total" data-pid="${pid}"
                 style="font-size:0.75rem;font-weight:700;
                        color:${wOk ? 'var(--success,#10B981)' : 'var(--error,#EF4444)'}">
              합계: ${totalWeight}% ${wOk ? '✅' : '⚠️ 100%이어야 함'}
            </div>
            <button class="save-policy-btn btn btn-primary btn-sm"
                    data-pid="${pid}" style="font-size:0.75rem;min-height:30px;padding:0 14px">
              💾 저장
            </button>
          </div>
        </div>
      </div>`;
  }).join('');

  // Toggle edit form
  listEl.querySelectorAll('.toggle-policy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const form = listEl.querySelector(`.policy-form[data-pid="${btn.dataset.pid}"]`);
      const open = form.style.display !== 'none';
      form.style.display = open ? 'none' : 'block';
      btn.textContent = open ? '⚙️ 편집' : '✕ 닫기';
    });
  });

  // Live weight total
  listEl.querySelectorAll('.policy-form').forEach(form => {
    const pid = form.dataset.pid;
    const indicator = listEl.querySelector(`.weight-total[data-pid="${pid}"]`);
    form.querySelectorAll('.ev-weight').forEach(inp => {
      inp.addEventListener('input', () => {
        const total = [...form.querySelectorAll('.ev-weight')]
          .reduce((s, i) => s + (parseFloat(i.value) || 0), 0);
        const ok = Math.abs(total - 100) <= 0.5;
        indicator.textContent = `합계: ${total}% ${ok ? '✅' : '⚠️ 100%이어야 함'}`;
        indicator.style.color = ok ? 'var(--success,#10B981)' : 'var(--error,#EF4444)';
      });
    });
  });

  // Save
  listEl.querySelectorAll('.save-policy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pid = btn.dataset.pid;
      const form = listEl.querySelector(`.policy-form[data-pid="${pid}"]`);
      const policy = policies.find(p => p.id === pid);
      if (!policy) return;

      const baseEvaluators = policy.config_json?.evaluators || [];
      const evaluators = baseEvaluators.map((e, idx) => ({
        ...e,
        weight:    parseFloat(form.querySelector(`.ev-weight[data-idx="${idx}"]`)?.value) || 0,
        min_count: parseInt(form.querySelector(`.ev-min[data-idx="${idx}"]`)?.value, 10) || 0,
        max_count: parseInt(form.querySelector(`.ev-max[data-idx="${idx}"]`)?.value, 10) || 0,
        required:  form.querySelector(`.ev-required[data-idx="${idx}"]`)?.checked ?? false,
      }));

      const total = evaluators.reduce((s, e) => s + e.weight, 0);
      if (Math.abs(total - 100) > 0.5) {
        showToast(`가중치 합계가 100%이어야 합니다 (현재: ${total}%)`, 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = '저장 중...';
      try {
        const res = await api.configs.updatePolicy(pid, evaluators);
        if (res?.ok) {
          showToast(`✅ "${policy.name}" 정책이 저장되었습니다.`, 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '✅ "" 정책이 저장되었습니다.' });
          policy.config_json.evaluators = evaluators;
          const chips = listEl.querySelector(`.policy-chips[data-pid="${pid}"]`);
          if (chips) {
            chips.innerHTML = evaluators.map(e => `
              <span style="padding:2px 8px;border-radius:999px;font-size:0.72rem;font-weight:600;
                           background:var(--surface-alt);color:var(--text)">
                ${POLICY_TYPE_LABELS[e.type] || e.type} ${e.weight}%
              </span>`).join('');
          }
        } else {
          showToast(res?.error || '저장 실패', 'error');
        }
      } catch (e) {
        showToast(`오류: ${e.message}`, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '💾 저장';
      }
    });
  });
}

// ══════════════════════════════════════════════════════════════
// Tab – 워크플로우 설정 (Workflow Builder MVP)
// ══════════════════════════════════════════════════════════════

const CONDITION_SUGGESTIONS = [
  'self_completed == true',
  'peer_count >= 2',
  'peer_count >= 1',
  'manager_completed == true',
  'calibration_completed == true',
  'admin_confirmed == true',
  'open_date_reached == true',
  'all_completed == true',
];

async function renderWorkflowTab(content) {
  const user  = getUser();
  const orgId = user?.org_id || 'ORG001';

  content.innerHTML = `
    <div class="fade-in" id="workflow-panel">
      <div style="margin-bottom:12px">
        <div class="section-title" style="margin-bottom:2px">워크플로우 설정</div>
        <div class="section-subtitle">평가 진행 단계와 전환 조건을 편집합니다. ↑↓로 순서 변경, 🗑으로 삭제.</div>
      </div>
      <datalist id="wf-condition-list">
        ${CONDITION_SUGGESTIONS.map(c => `<option value="${escapeHtml(c)}">`).join('')}
      </datalist>
      <div id="workflow-list">
        <div class="loading-overlay" style="min-height:120px"><div class="spinner"></div></div>
      </div>
    </div>`;

  const listEl = content.querySelector('#workflow-list');

  let workflows;
  try {
    workflows = await api.configs.list(orgId, 'workflow');
  } catch (e) {
    listEl.innerHTML = `<div style="color:var(--error);padding:16px;font-size:0.85rem">로드 실패: ${e.message}</div>`;
    return;
  }

  if (!workflows || !workflows.length) {
    listEl.innerHTML = `
      <div class="empty-state" style="min-height:120px">
        <div class="empty-state-icon">🔀</div>
        <div class="empty-state-title">워크플로우 없음</div>
        <div class="empty-state-desc">로컬 백엔드 실행 시 편집할 수 있습니다.</div>
      </div>`;
    return;
  }

  listEl.innerHTML = workflows.map(wf => {
    const steps = wf.config_json?.steps || [];
    const wfId  = escapeHtml(wf.id);
    return `
      <div class="card" style="padding:14px 16px;margin-bottom:10px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:0.9rem">${escapeHtml(wf.name)}</div>
            ${wf.config_json?.description
              ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">${escapeHtml(wf.config_json.description)}</div>`
              : ''}
          </div>
          <button class="toggle-wf-btn btn btn-ghost btn-sm"
                  data-wfid="${wfId}" style="font-size:0.72rem;min-height:28px;padding:0 10px;flex-shrink:0">
            ⚙️ 편집
          </button>
        </div>

        <div class="wf-chips" data-wfid="${wfId}" style="display:flex;flex-wrap:wrap;gap:4px;align-items:center">
          ${wfStepChips(steps)}
        </div>

        <div class="wf-form" data-wfid="${wfId}" style="display:none;margin-top:12px">
          <div style="font-size:0.72rem;padding:6px 8px;background:#FEF9C3;border:1px solid #FDE047;
                      border-radius:4px;margin-bottom:8px">
            ⚠️ 상태 ID 변경 시 진행 중인 평가 인스턴스에 영향을 줄 수 있습니다.
          </div>
          <div class="steps-container" data-wfid="${wfId}">
            ${steps.map(s => wfStepRow(s)).join('')}
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:8px;gap:8px;flex-wrap:wrap">
            <button class="add-step-btn btn btn-ghost btn-sm"
                    data-wfid="${wfId}" style="font-size:0.75rem;min-height:30px">
              + 단계 추가
            </button>
            <button class="save-wf-btn btn btn-primary btn-sm"
                    data-wfid="${wfId}" style="font-size:0.75rem;min-height:30px;padding:0 14px">
              💾 저장
            </button>
          </div>
        </div>
      </div>`;
  }).join('');

  // Toggle
  listEl.querySelectorAll('.toggle-wf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const form = listEl.querySelector(`.wf-form[data-wfid="${btn.dataset.wfid}"]`);
      const open = form.style.display !== 'none';
      form.style.display = open ? 'none' : 'block';
      btn.textContent = open ? '⚙️ 편집' : '✕ 닫기';
    });
  });

  // Add step
  listEl.querySelectorAll('.add-step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const container = listEl.querySelector(`.steps-container[data-wfid="${btn.dataset.wfid}"]`);
      const div = document.createElement('div');
      div.innerHTML = wfStepRow({ status: '', label_ko: '', condition: '' });
      const row = div.firstElementChild;
      container.appendChild(row);
      bindWfRowEvents(row);
    });
  });

  // Bind row events for existing rows
  listEl.querySelectorAll('.step-row').forEach(row => bindWfRowEvents(row));

  // Save
  listEl.querySelectorAll('.save-wf-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const wfId     = btn.dataset.wfid;
      const container = listEl.querySelector(`.steps-container[data-wfid="${wfId}"]`);
      const steps    = [...container.querySelectorAll('.step-row')].map(row => ({
        status:    row.querySelector('.step-status')?.value?.trim()    || '',
        label_ko:  row.querySelector('.step-label')?.value?.trim()     || '',
        condition: row.querySelector('.step-condition')?.value?.trim() || null,
      }));

      if (steps.some(s => !s.status || !s.label_ko)) {
        showToast('상태 ID와 한국어 라벨은 필수입니다.', 'error');
        return;
      }

      btn.disabled = true; btn.textContent = '저장 중...';
      try {
        const res = await api.configs.updateWorkflow(wfId, steps);
        if (res?.ok) {
          showToast('✅ 워크플로우 저장 완료', 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '✅ 워크플로우 저장 완료' });
          const wf = workflows.find(w => w.id === wfId);
          if (wf) wf.config_json.steps = res.steps;
          const chips = listEl.querySelector(`.wf-chips[data-wfid="${wfId}"]`);
          if (chips) chips.innerHTML = wfStepChips(res.steps);
        } else {
          showToast(res?.error || '저장 실패', 'error');
        }
      } catch (e) {
        showToast(`오류: ${e.message}`, 'error');
      } finally {
        btn.disabled = false; btn.textContent = '💾 저장';
      }
    });
  });
}

function wfStepChips(steps) {
  return steps.map((s, i) => {
    const label = escapeHtml(s.label_ko || s.status || s.step || '');
    const arrow = i < steps.length - 1 ? '<span style="color:var(--text-muted);font-size:0.7rem">→</span>' : '';
    return `<span style="padding:2px 8px;border-radius:999px;font-size:0.72rem;font-weight:600;
                         background:var(--surface-alt);color:var(--text)">${label}</span>${arrow}`;
  }).join('');
}

function wfStepRow(s) {
  const status    = escapeHtml(s.status || s.step || '');
  const label     = escapeHtml(s.label_ko || '');
  const condition = escapeHtml(s.condition || '');
  return `
    <div class="step-row" style="padding:6px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px">
        <div style="display:flex;flex-direction:column;gap:1px;flex-shrink:0">
          <button class="step-up btn btn-ghost"
                  style="padding:0 5px;min-height:16px;font-size:0.62rem;line-height:1">▲</button>
          <button class="step-dn btn btn-ghost"
                  style="padding:0 5px;min-height:16px;font-size:0.62rem;line-height:1">▼</button>
        </div>
        <input type="text" class="step-status" value="${status}"
               placeholder="상태 ID (예: self_evaluation)"
               style="flex:1;min-width:0;font-size:0.75rem;padding:4px 6px;font-family:monospace;
                      border:1px solid var(--border);border-radius:4px">
        <input type="text" class="step-label" value="${label}"
               placeholder="한국어 라벨 (예: 자기평가)"
               style="flex:1;min-width:0;font-size:0.75rem;padding:4px 6px;
                      border:1px solid var(--border);border-radius:4px">
        <button class="step-del btn btn-ghost"
                style="color:var(--error,#EF4444);padding:0 6px;min-height:28px;font-size:0.8rem;flex-shrink:0">
          🗑
        </button>
      </div>
      <div style="padding-left:30px">
        <input type="text" class="step-condition" value="${condition}"
               list="wf-condition-list"
               placeholder="전환 조건 (빈칸 = 무조건 전환, 예: self_completed == true)"
               style="width:100%;font-size:0.72rem;padding:4px 6px;
                      border:1px solid var(--border);border-radius:4px;box-sizing:border-box">
      </div>
    </div>`;
}

function bindWfRowEvents(row) {
  row.querySelector('.step-up')?.addEventListener('click', () => {
    const prev = row.previousElementSibling;
    if (prev?.classList.contains('step-row')) row.parentElement.insertBefore(row, prev);
  });
  row.querySelector('.step-dn')?.addEventListener('click', () => {
    const next = row.nextElementSibling;
    if (next?.classList.contains('step-row')) row.parentElement.insertBefore(next, row);
  });
  row.querySelector('.step-del')?.addEventListener('click', () => {
    if (row.parentElement.querySelectorAll('.step-row').length <= 1) {
      showToast('최소 1개 이상의 단계가 필요합니다.', 'error');
      return;
    }
    row.remove();
  });
}

// ══════════════════════════════════════════════════════════════
// Tab 4 – 직위 설정 (Rank Configuration)
// ══════════════════════════════════════════════════════════════

function renderRankTab(content) {
  const { count, levels } = _state.rankSettings;

  content.innerHTML = `
    <div class="fade-in">
      <div class="section-title" style="margin-bottom:4px">직위 단계 설정</div>
      <div class="section-subtitle" style="margin-bottom:16px">
        조직의 직위 체계를 설정하세요 (최소 3단계 ~ 최대 7단계).
      </div>

      <!-- Step count selector -->
      <div class="card" style="padding:16px;margin-bottom:16px">
        <label style="font-size:0.82rem;font-weight:700;color:var(--text);display:block;margin-bottom:10px">
          🏷️ 직위 단계 수
        </label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${[3,4,5,6,7].map(n => `
            <button class="rank-count-btn" data-count="${n}"
                    style="padding:8px 16px;border-radius:var(--radius-sm);font-size:0.85rem;
                           font-weight:700;cursor:pointer;border:2px solid;transition:all 0.15s;
                           background:${n === count ? 'var(--primary)' : 'var(--surface)'};
                           color:${n === count ? '#fff' : 'var(--text-muted)'};
                           border-color:${n === count ? 'var(--primary)' : 'var(--border)'}">
              ${n}단계
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Level name inputs -->
      <div class="card" style="padding:16px;margin-bottom:16px">
        <label style="font-size:0.82rem;font-weight:700;color:var(--text);display:block;margin-bottom:10px">
          📝 각 직위 이름
        </label>
        <div id="rank-level-inputs" style="display:flex;flex-direction:column;gap:10px">
          ${Array.from({ length: count }, (_, i) => `
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:28px;height:28px;border-radius:50%;
                          background:var(--primary);color:#fff;
                          display:flex;align-items:center;justify-content:center;
                          font-size:0.8rem;font-weight:700;flex-shrink:0">${i + 1}</div>
              <input class="rank-level-input" data-idx="${i}" type="text"
                     value="${escapeHtml(levels[i] || '')}"
                     placeholder="직위 이름 (예: 사원, 대리, 과장...)"
                     style="flex:1;padding:9px 12px;font-size:0.85rem;
                            border:1.5px solid var(--border);border-radius:var(--radius-sm);
                            background:var(--bg);color:var(--text);outline:none;
                            font-family:inherit" />
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Preview -->
      <div class="card" style="padding:14px;margin-bottom:16px;background:#EEF2FF;border:1.5px solid var(--primary-light)">
        <div style="font-size:0.78rem;font-weight:700;color:var(--primary);margin-bottom:8px">미리보기</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap" id="rank-preview">
          ${Array.from({ length: count }, (_, i) =>
            `<span style="padding:4px 12px;background:var(--primary);color:#fff;
                          border-radius:999px;font-size:0.75rem;font-weight:600">
              ${escapeHtml(levels[i] || `직위 ${i + 1}`)}
            </span>`
          ).join('')}
        </div>
      </div>

      <button class="btn btn-primary btn-block" id="save-rank-btn">💾 직위 설정 저장</button>
    </div>
  `;

  // Count buttons
  content.querySelectorAll('.rank-count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newCount = Number(btn.dataset.count);
      const inputs = content.querySelectorAll('.rank-level-input');
      const currentLevels = Array.from(inputs).map(i => i.value.trim());
      _state.rankSettings = {
        count: newCount,
        levels: Array.from({ length: newCount }, (_, i) => currentLevels[i] || _state.rankSettings.levels[i] || `직위 ${i + 1}`),
      };
      renderRankTab(content);
    });
  });

  // Live preview update
  content.querySelectorAll('.rank-level-input').forEach(input => {
    input.addEventListener('input', () => {
      const idx = Number(input.dataset.idx);
      const preview = content.querySelector('#rank-preview');
      if (!preview) return;
      const inputs = content.querySelectorAll('.rank-level-input');
      const names = Array.from(inputs).map(i => i.value.trim() || `직위 ${Number(i.dataset.idx) + 1}`);
      preview.innerHTML = names.map(n =>
        `<span style="padding:4px 12px;background:var(--primary);color:#fff;border-radius:999px;font-size:0.75rem;font-weight:600">${escapeHtml(n)}</span>`
      ).join('');
    });
  });

  // Save
  content.querySelector('#save-rank-btn')?.addEventListener('click', () => {
    const inputs  = content.querySelectorAll('.rank-level-input');
    const newLevels = Array.from(inputs).map(i => i.value.trim() || `직위 ${Number(i.dataset.idx) + 1}`);
    _state.rankSettings.levels = newLevels;
    localStorage.setItem(RANK_KEY, JSON.stringify(_state.rankSettings));
    showToast('직위 설정이 저장되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '직위 설정이 저장되었습니다.' });
  });
}

// ══════════════════════════════════════════════════════════════
// Tab 5 – 진단 매핑 (Diagnostic × Rank Matrix)
// ══════════════════════════════════════════════════════════════

function renderMappingTab(content) {
  const { count, levels } = _state.rankSettings;
  const mappings = _state.diagMappings;

  content.innerHTML = `
    <div class="fade-in">
      <div class="section-title" style="margin-bottom:4px">진단 × 직위 매핑</div>
      <div class="section-subtitle" style="margin-bottom:12px">
        각 직위에 필요한 진단 종류를 체크박스로 설정하세요.
      </div>

      <div class="card" style="padding:0;overflow:hidden;margin-bottom:16px">
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
          <table style="width:100%;border-collapse:collapse;font-size:0.78rem;min-width:420px">
            <thead>
              <tr style="background:var(--border)">
                <th style="padding:11px 14px;text-align:left;font-weight:700;color:var(--text-muted);min-width:130px;white-space:nowrap">진단 종류</th>
                ${levels.slice(0, count).map((lv, i) => `
                  <th style="padding:11px 8px;text-align:center;font-weight:700;color:var(--primary);
                             white-space:nowrap;min-width:52px">
                    <div style="font-size:0.68rem;color:var(--text-light)">Lv.${i + 1}</div>
                    <div>${escapeHtml(lv)}</div>
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${DIAG_TYPES.map((dt, rowIdx) => {
                const checked = mappings[dt.id] || [];
                return `
                  <tr style="border-top:1px solid var(--border);background:${rowIdx % 2 === 0 ? 'var(--surface)' : '#F8FAFC'}">
                    <td style="padding:11px 14px">
                      <div style="display:flex;align-items:center;gap:7px">
                        <span style="font-size:1rem">${dt.icon}</span>
                        <div>
                          <div style="font-weight:600;color:var(--text)">${dt.label}</div>
                        </div>
                      </div>
                    </td>
                    ${levels.slice(0, count).map((_, colIdx) => `
                      <td style="padding:10px 8px;text-align:center">
                        <label style="display:flex;align-items:center;justify-content:center;cursor:pointer">
                          <input type="checkbox" class="mapping-cb"
                                 data-diag="${dt.id}" data-col="${colIdx}"
                                 ${checked.includes(colIdx) ? 'checked' : ''}
                                 style="width:18px;height:18px;cursor:pointer;accent-color:${dt.color}" />
                        </label>
                      </td>
                    `).join('')}
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Legend -->
      <div class="card" style="padding:12px 14px;margin-bottom:16px;background:#F8FAFC">
        <div style="font-size:0.75rem;color:var(--text-muted);line-height:1.6">
          ☑️ <strong>체크</strong>: 해당 직위에 진단이 <strong>필수</strong>로 배정됨<br>
          □ <strong>미체크</strong>: 해당 직위는 진단 대상 제외 (선택 가능)
        </div>
      </div>

      <button class="btn btn-primary btn-block" id="save-mapping-btn">💾 매핑 저장</button>
    </div>
  `;

  content.querySelector('#save-mapping-btn')?.addEventListener('click', () => {
    const newMappings = {};
    content.querySelectorAll('.mapping-cb').forEach(cb => {
      const diagId = cb.dataset.diag;
      const colIdx = Number(cb.dataset.col);
      if (!newMappings[diagId]) newMappings[diagId] = [];
      if (cb.checked) newMappings[diagId].push(colIdx);
    });
    _state.diagMappings = newMappings;
    localStorage.setItem(MAPPING_KEY, JSON.stringify(newMappings));
    showToast('진단 매핑이 저장되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '진단 매핑이 저장되었습니다.' });
  });
}

// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// Reference Check Section (inside Tab 6)
// ══════════════════════════════════════════════════════════════

const REF_QUESTIONS_LABELS = {
  Q_REL: '관계', Q_TENURE: '협업 기간', Q_PERFORM: '직무 능력',
  Q_STRENGTH: '핵심 강점', Q_COMM: '소통/협업', Q_COMM_DESC: '소통 스타일',
  Q_LEAD: '리더십', Q_TRUST: '신뢰도', Q_IMPROVE: '개선 필요 사항',
  Q_REHIRE: '재협업 의사', Q_REHIRE_REASON: '재협업 이유', Q_COMMENT: '추가 의견',
};
const SCALE_LABELS = ['', '매우 미흡', '미흡', '보통', '우수', '매우 우수'];

function renderRefCheckSection() {
  let requests = [];
  try { requests = JSON.parse(localStorage.getItem('hr_ref_requests') || '[]'); } catch {}

  // Inject demo data if empty
  if (!requests.length) {
    requests = [{
      id: 'REF_DEMO',
      applicantName: '이지원',
      jobTitle: 'HR Business Partner',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      referees: [
        { id: 'RD1', token: 'tok_demo_ref1', name: '김기훈', relation: '직속 상사', email: 'kihoon@prev.com', status: 'completed', submittedAt: new Date(Date.now() - 86400000).toISOString(), responses: { Q_REL: '직속 상사', Q_TENURE: '2~3년', Q_PERFORM: 4, Q_STRENGTH: '데이터 기반 의사결정이 탁월합니다.', Q_COMM: 5, Q_COMM_DESC: '팀원들과 소통이 매우 원활합니다.', Q_LEAD: 4, Q_TRUST: 5, Q_IMPROVE: '좀 더 적극적인 자기주장이 필요합니다.', Q_REHIRE: 'yes', Q_REHIRE_REASON: '함께 일하면 시너지가 납니다.', Q_COMMENT: '' } },
        { id: 'RD2', token: 'tok_demo_ref2', name: '이소연', relation: '동료', email: 'soyeon@prev.com', status: 'pending', submittedAt: null, responses: {} },
      ],
    }];
  }

  if (!requests.length) return `
    <div class="section-title" style="margin-bottom:8px">📋 레퍼런스 체크 내역</div>
    <div class="card" style="padding:32px 16px;text-align:center;color:var(--text-muted)">
      <div style="font-size:32px;margin-bottom:8px">📋</div>
      <div style="font-size:0.85rem">레퍼런스 체크 요청이 없습니다.</div>
    </div>`;

  return `
    <div class="section-title" style="margin-bottom:8px">📋 레퍼런스 체크 내역</div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:4px;">
      ${requests.map(req => {
        const total = req.referees.length;
        const done  = req.referees.filter(r => r.status === 'completed').length;
        const pct   = total ? Math.round((done / total) * 100) : 0;
        const color = pct === 100 ? '#059669' : pct > 0 ? '#4F46E5' : '#F59E0B';
        return `
          <div class="card" style="padding:14px 16px;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px;">
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:0.9rem;margin-bottom:2px;">${escapeHtml(req.applicantName)}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);">${escapeHtml(req.jobTitle)} · ${new Date(req.createdAt).toLocaleDateString('ko-KR')}</div>
              </div>
              <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
                <span style="padding:3px 9px;border-radius:20px;font-size:0.7rem;font-weight:700;
                             background:${color}15;color:${color};">${done}/${total} 완료</span>
                <a href="#/admin?tab=recruitment" style="padding:3px 8px;background:#EEF2FF;color:#4F46E5;
                   border-radius:7px;font-size:0.7rem;font-weight:600;text-decoration:none;white-space:nowrap">ATS ↗</a>
              </div>
            </div>
            <div style="height:4px;background:#E2E8F0;border-radius:2px;overflow:hidden;margin-bottom:10px;">
              <div style="height:100%;width:${pct}%;background:${color};border-radius:2px;"></div>
            </div>
            <!-- Referee list -->
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${req.referees.map(r => {
                const st = r.status === 'completed';
                return `
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;
                               padding:8px 10px;background:var(--bg,#F8FAFC);border-radius:7px;
                               border:1px solid var(--border,#E2E8F0);">
                    <div style="flex:1;min-width:0;">
                      <span style="font-size:0.82rem;font-weight:600;color:var(--text,#1E293B);">${escapeHtml(r.name)}</span>
                      <span style="font-size:0.72rem;color:var(--text-muted,#64748B);margin-left:6px;">${escapeHtml(r.relation)}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                      <span style="font-size:0.7rem;font-weight:600;color:${st ? '#059669' : '#F59E0B'}">
                        ${st ? '✅ 완료' : '⏳ 대기'}
                      </span>
                      ${st ? `
                        <button class="ref-pdf-btn"
                                data-req-id="${escapeHtml(req.id)}"
                                data-ref-id="${escapeHtml(r.id)}"
                                title="결과 보기"
                                style="width:30px;height:30px;border-radius:6px;border:1px solid var(--primary,#4F46E5);
                                       background:#EEF2FF;color:var(--primary,#4F46E5);cursor:pointer;
                                       font-size:0.85rem;display:flex;align-items:center;justify-content:center;
                                       flex-shrink:0;">
                          📄
                        </button>` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function buildPdfContent(req, ref) {
  const SCALE_LBL = (v) => v ? `${v}점 (${SCALE_LABELS[v] || ''})` : '—';
  const rows = Object.entries(REF_QUESTIONS_LABELS).map(([id, label]) => {
    let val = ref.responses[id];
    if (val === undefined || val === null || val === '') val = '—';
    else if (id === 'Q_REHIRE') val = val === 'yes' ? '예' : '아니요';
    else if (typeof val === 'number') val = SCALE_LBL(val);
    return `
      <tr>
        <td style="padding:10px 12px;border:1px solid #E2E8F0;font-size:12px;font-weight:600;color:#475569;background:#F8FAFC;white-space:nowrap;vertical-align:top;width:120px;">${label}</td>
        <td style="padding:10px 12px;border:1px solid #E2E8F0;font-size:13px;color:#1E293B;line-height:1.6;">${escapeHtml(String(val))}</td>
      </tr>`;
  }).join('');

  const submittedAt = ref.submittedAt ? new Date(ref.submittedAt).toLocaleString('ko-KR') : '—';

  return `
    <div id="printable-ref" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:700px;margin:0 auto;">
      <div style="border-bottom:3px solid #4F46E5;padding-bottom:16px;margin-bottom:20px;">
        <h1 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#1E293B;">레퍼런스 체크 결과</h1>
        <p style="margin:0;font-size:13px;color:#64748B;">제출일: ${escapeHtml(submittedAt)}</p>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
        <div style="padding:14px;background:#EEF2FF;border-radius:8px;">
          <p style="margin:0 0 4px;font-size:11px;color:#6366F1;font-weight:600;">지원자</p>
          <p style="margin:0;font-size:15px;font-weight:700;color:#1E293B;">${escapeHtml(req.applicantName)}</p>
          <p style="margin:2px 0 0;font-size:12px;color:#64748B;">${escapeHtml(req.jobTitle)}</p>
        </div>
        <div style="padding:14px;background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0;">
          <p style="margin:0 0 4px;font-size:11px;color:#64748B;font-weight:600;">레퍼런스 제공자</p>
          <p style="margin:0;font-size:15px;font-weight:700;color:#1E293B;">${escapeHtml(ref.name)}</p>
          <p style="margin:2px 0 0;font-size:12px;color:#64748B;">${escapeHtml(ref.relation)}</p>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;">
        ${rows}
      </table>

      <p style="margin:16px 0 0;font-size:11px;color:#94A3B8;text-align:center;">
        본 레퍼런스 체크 결과는 채용 심사 목적으로만 사용됩니다.
      </p>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════
// Tab 6 – 채용관리
// ══════════════════════════════════════════════════════════════

function renderRecruitTab(content) {
  let jobs = [];
  try { jobs = JSON.parse(localStorage.getItem(JOB_POSTINGS_KEY) || 'null') || DEMO_JOB_POSTINGS; }
  catch (_) { jobs = DEMO_JOB_POSTINGS; }

  // Simulate applicant funnel from hr_applicant_data
  let applicantData = null;
  try { applicantData = JSON.parse(localStorage.getItem('hr_applicant_data')); } catch (_) {}

  const funnelData = applicantData ? [
    { name: '이지원', jobTitle: applicantData.jobTitle || 'HR Business Partner', step: applicantData.processStep || 'DOCUMENT', applyDate: applicantData.applyDate || '2026-05-15' }
  ] : [
    { name: '이지원',  jobTitle: 'HR Business Partner', step: 'PRE_INTERVIEW',      applyDate: '2026-05-15' },
    { name: '김하은',  jobTitle: 'C&B 전문가',           step: 'DOCUMENT',           applyDate: '2026-05-18' },
    { name: '박서준',  jobTitle: 'TA 스페셜리스트',       step: 'INTERVIEW_SCHEDULE', applyDate: '2026-05-10' },
  ];

  const STEP_LABELS = { DOCUMENT:'서류 접수', PRE_INTERVIEW:'사전 진단', INTERVIEW_SCHEDULE:'면접 조율', INTERVIEW:'면접 진행', OFFER:'오퍼 레터', ACCEPTED:'입사 완료', REJECTED:'불합격' };
  const STEP_COLORS = { DOCUMENT:'#64748B', PRE_INTERVIEW:'#F59E0B', INTERVIEW_SCHEDULE:'#3B82F6', INTERVIEW:'#8B5CF6', OFFER:'#10B981', ACCEPTED:'#059669', REJECTED:'#EF4444' };

  // Talent pool — visibility settings from localStorage
  let visibility = {};
  try { visibility = JSON.parse(localStorage.getItem('hr_profile_visibility') || '{}'); } catch (_) {}
  const talentPool = (visibility.competency || visibility.resume) ? [
    { name: '이지원', jobTitle: 'APPLICANT_001', competencyPublic: visibility.competency, resumePublic: visibility.resume }
  ] : [];

  const emailCfg = getEmailConfig();
  const emailOk  = isEmailConfigured();

  content.innerHTML = `
    <div class="fade-in" style="padding-bottom:24px">

      <!-- Email 설정 -->
      <div class="section-title" style="margin-bottom:8px">📧 이메일 발송 설정 (EmailJS)</div>
      <div class="card" style="padding:14px 16px;margin-bottom:18px;border-left:3px solid ${emailOk ? 'var(--success)' : 'var(--warning)'}">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:${emailOk ? '0' : '12px'}">
          <div>
            <div style="font-weight:700;font-size:0.88rem">${emailOk ? '✅ 이메일 발송 활성화됨' : '⚠️ 이메일 미설정 (시뮬레이션 모드)'}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">
              ${emailOk
                ? `서비스 ID: ${escapeHtml(emailCfg.serviceId)}`
                : 'EmailJS 계정 연결 시 실제 이메일을 발송할 수 있습니다.'}
            </div>
          </div>
          <button id="toggle-email-cfg" class="btn btn-ghost btn-sm" style="flex-shrink:0;font-size:0.75rem">
            ${emailOk ? '수정' : '설정'}
          </button>
        </div>
        <div id="email-cfg-form" style="display:none">
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
            <div>
              <label style="font-size:0.73rem;color:var(--text-muted);display:block;margin-bottom:3px">Public Key</label>
              <input id="ejs-public-key" class="form-input" type="text" placeholder="user_xxxxx" value="${escapeHtml(emailCfg?.publicKey || '')}" style="font-size:0.8rem">
            </div>
            <div>
              <label style="font-size:0.73rem;color:var(--text-muted);display:block;margin-bottom:3px">Service ID</label>
              <input id="ejs-service-id" class="form-input" type="text" placeholder="service_xxxxx" value="${escapeHtml(emailCfg?.serviceId || '')}" style="font-size:0.8rem">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
              <div>
                <label style="font-size:0.65rem;color:var(--text-muted);display:block;margin-bottom:3px">면접 Template ID</label>
                <input id="ejs-tpl-interview" class="form-input" type="text" placeholder="template_interview" value="${escapeHtml(emailCfg?.templateInterview || '')}" style="font-size:0.75rem;padding:6px 8px">
              </div>
              <div>
                <label style="font-size:0.65rem;color:var(--text-muted);display:block;margin-bottom:3px">오퍼 Template ID</label>
                <input id="ejs-tpl-offer" class="form-input" type="text" placeholder="template_offer" value="${escapeHtml(emailCfg?.templateOffer || '')}" style="font-size:0.75rem;padding:6px 8px">
              </div>
              <div>
                <label style="font-size:0.65rem;color:var(--text-muted);display:block;margin-bottom:3px">평가초대 Template ID</label>
                <input id="ejs-tpl-assessment" class="form-input" type="text" placeholder="template_assessment" value="${escapeHtml(emailCfg?.templateAssessment || '')}" style="font-size:0.75rem;padding:6px 8px">
              </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:4px">
              <button id="save-email-cfg" class="btn btn-primary btn-sm" style="flex:1">저장</button>
              <button id="cancel-email-cfg" class="btn btn-ghost btn-sm" style="flex:1">취소</button>
              ${emailOk ? `<button id="clear-email-cfg" class="btn btn-ghost btn-sm" style="color:var(--danger)">삭제</button>` : ''}
            </div>
          </div>
          <div style="margin-top:8px;font-size:0.68rem;color:var(--text-muted);line-height:1.6">
            💡 <a href="https://www.emailjs.com" target="_blank" style="color:var(--primary)">emailjs.com</a> 에서 무료 계정 생성 후
            Email Service, Template 3종 (면접/오퍼/평가초대)을 설정하세요.
            Template 변수: <code>{{to_name}}</code> <code>{{to_email}}</code> <code>{{message}}</code> 등
          </div>
        </div>
      </div>

      <!-- Job Postings -->
      <div class="section-title" style="margin-bottom:8px">📢 채용공고 관리</div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:18px">
        ${jobs.map(j => `
          <div class="card" style="padding:14px 16px">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
              <div>
                <div style="font-weight:700;font-size:0.92rem;margin-bottom:3px">${escapeHtml(j.title)}</div>
                <div style="font-size:0.75rem;color:var(--text-muted)">${escapeHtml(j.dept || '')} · 마감: ${escapeHtml(j.deadline || '-')}</div>
                <div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap">
                  ${(j.tags || []).map(t => `<span style="padding:2px 7px;background:var(--primary-light,#EEF2FF);color:var(--primary);border-radius:999px;font-size:0.68rem;font-weight:600">${escapeHtml(t)}</span>`).join('')}
                </div>
              </div>
              <span style="flex-shrink:0;padding:3px 9px;background:#ECFDF5;color:#059669;border-radius:999px;font-size:0.7rem;font-weight:700">${escapeHtml(j.status)}</span>
            </div>
          </div>
        `).join('')}
        <button class="btn btn-ghost btn-block" id="add-job-btn" style="border:1.5px dashed var(--border);color:var(--primary)">+ 새 공고 작성</button>
      </div>

      <!-- Job posting form (hidden by default) -->
      <div id="job-form-area" style="display:none;margin-bottom:18px">
        <div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:12px">새 채용공고 작성</div>
          <div class="form-group" style="margin-bottom:10px">
            <label class="form-label">직무명</label>
            <input id="job-title-input" class="form-input" type="text" placeholder="예: HRBP 매니저">
          </div>
          <div class="form-group" style="margin-bottom:10px">
            <label class="form-label">부서</label>
            <input id="job-dept-input" class="form-input" type="text" placeholder="예: People & Culture팀">
          </div>
          <div class="form-group" style="margin-bottom:10px">
            <label class="form-label">마감일</label>
            <input id="job-deadline-input" class="form-input" type="date">
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label">채용 공고 내용</label>
            <textarea id="job-jd-input" class="form-input" rows="4" placeholder="담당 업무, 자격 요건 등을 입력하세요" style="resize:vertical;min-height:80px"></textarea>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-primary" id="save-job-btn" style="flex:1">저장</button>
            <button class="btn btn-ghost" id="cancel-job-btn" style="flex:1">취소</button>
          </div>
        </div>
      </div>

      <!-- Applicant Funnel -->
      <div class="section-title" style="margin-bottom:8px">👥 지원자 현황</div>
      <div class="card" style="padding:0;overflow:hidden;margin-bottom:18px">
        <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
          <thead>
            <tr style="background:var(--bg);border-bottom:1.5px solid var(--border)">
              <th style="padding:10px 12px;text-align:left;font-weight:700">이름</th>
              <th style="padding:10px 8px;text-align:left;font-weight:700">지원 직무</th>
              <th style="padding:10px 8px;text-align:center;font-weight:700">단계</th>
              <th style="padding:10px 8px;text-align:center;font-weight:700">액션</th>
            </tr>
          </thead>
          <tbody>
            ${funnelData.map((a, i) => `
              <tr style="border-bottom:1px solid var(--border);${i % 2 === 1 ? 'background:#FAFBFC' : ''}">
                <td style="padding:10px 12px;font-weight:600">${escapeHtml(a.name)}</td>
                <td style="padding:10px 8px;color:var(--text-muted);font-size:0.78rem">${escapeHtml(a.jobTitle)}</td>
                <td style="padding:10px 8px;text-align:center">
                  <span style="padding:2px 8px;background:${(STEP_COLORS[a.step]||'#64748B')}20;color:${STEP_COLORS[a.step]||'#64748B'};border-radius:999px;font-size:0.7rem;font-weight:700">
                    ${STEP_LABELS[a.step] || a.step}
                  </span>
                </td>
                <td style="padding:10px 8px;text-align:center">
                  ${a.step === 'DOCUMENT' ? `<button class="btn-funnel-action" data-name="${escapeHtml(a.name)}" data-action="pass_doc" style="padding:4px 10px;border-radius:6px;border:1.5px solid #F59E0B;background:none;color:#B45309;cursor:pointer;font-size:0.73rem;font-weight:600">서류 합격</button>` : ''}
                  ${a.step === 'PRE_INTERVIEW' ? `<button class="btn-funnel-action" data-name="${escapeHtml(a.name)}" data-action="schedule" style="padding:4px 10px;border-radius:6px;border:1.5px solid var(--primary);background:none;color:var(--primary);cursor:pointer;font-size:0.73rem;font-weight:600">면접 일정 발송</button>` : ''}
                  ${a.step === 'INTERVIEW_SCHEDULE' ? `<span style="font-size:0.73rem;color:#3B82F6">⏳ 일정 선택 대기</span>` : ''}
                  ${a.step === 'INTERVIEW' ? `<button class="btn-funnel-action" data-name="${escapeHtml(a.name)}" data-action="offer" style="padding:4px 10px;border-radius:6px;border:1.5px solid #10B981;background:none;color:#10B981;cursor:pointer;font-size:0.73rem;font-weight:600">오퍼 발송</button>` : ''}
                  ${(a.step === 'OFFER' || a.step === 'ACCEPTED') ? '<span style="font-size:0.73rem;color:#059669">✅ 완료</span>' : ''}
                  ${a.step === 'REJECTED' ? '<span style="font-size:0.73rem;color:#EF4444">불합격</span>' : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Talent Pool -->
      <div class="section-title" style="margin-bottom:8px">🌟 인재 풀 (공개 프로필)</div>
      ${talentPool.length === 0 ? `
        <div class="card" style="padding:32px 16px;text-align:center;color:var(--text-muted)">
          <div style="font-size:32px;margin-bottom:8px">🌟</div>
          <div style="font-size:0.85rem;margin-bottom:4px">역량진단 결과 또는 이력서를 공개한 지원자가 없습니다.</div>
          <div style="font-size:0.75rem">지원자가 마이페이지에서 공개 설정 시 여기에 노출됩니다.</div>
        </div>
      ` : talentPool.map(p => `
        <div class="card" style="padding:14px 16px;margin-bottom:10px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <div>
              <div style="font-weight:700;margin-bottom:4px">이지원</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                ${p.competencyPublic ? `<span style="padding:2px 7px;background:#EEF2FF;color:#4F46E5;border-radius:999px;font-size:0.7rem;font-weight:600">📊 역량진단 공개</span>` : ''}
                ${p.resumePublic ? `<span style="padding:2px 7px;background:#ECFDF5;color:#059669;border-radius:999px;font-size:0.7rem;font-weight:600">📄 이력서 공개</span>` : ''}
              </div>
            </div>
            <button class="send-offer-btn" data-name="이지원" data-user-id="APPLICANT_001"
                    style="padding:7px 14px;border-radius:8px;border:none;background:var(--primary);color:#fff;cursor:pointer;font-size:0.8rem;font-weight:600;white-space:nowrap">
              오퍼 보내기
            </button>
          </div>
        </div>
      `).join('')}
      <!-- Reference Check Results -->
      ${renderRefCheckSection()}
    </div>

    <!-- Reference PDF Modal -->
    <div id="ref-pdf-overlay" style="display:none;position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,0.7);overflow-y:auto;">
      <div id="ref-pdf-modal" style="background:#fff;min-height:100vh;padding:0;">
        <div id="ref-pdf-topbar" style="position:sticky;top:0;z-index:10;background:#fff;border-bottom:1px solid #E2E8F0;
                                        padding:12px 16px;display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:14px;font-weight:700;color:#1E293B;">📄 레퍼런스 체크 결과</span>
          <div style="display:flex;gap:8px;align-items:center;">
            <button id="ref-pdf-print-btn" onclick="window.print()"
                    style="padding:7px 14px;background:#4F46E5;color:#fff;border:none;border-radius:7px;
                           font-size:13px;font-weight:600;cursor:pointer;">
              🖨️ 인쇄 / PDF 저장
            </button>
            <button id="ref-pdf-close-btn"
                    style="width:32px;height:32px;border-radius:50%;border:none;background:#F1F5F9;
                           color:#64748B;font-size:18px;cursor:pointer;display:flex;align-items:center;
                           justify-content:center;line-height:1;">
              ×
            </button>
          </div>
        </div>
        <div id="ref-pdf-content" style="padding:24px 20px;"></div>
      </div>
    </div>

    <!-- Offer Modal -->
    <div id="offer-modal-overlay" style="display:none;position:fixed;inset:0;z-index:400;background:rgba(0,0,0,0.55);display:none;align-items:flex-end">
      <div id="offer-modal" style="width:100%;background:var(--surface);border-radius:20px 20px 0 0;padding:22px 18px 32px">
        <div style="font-weight:700;font-size:1rem;margin-bottom:14px">💌 오퍼 보내기</div>
        <div class="form-group" style="margin-bottom:10px">
          <label class="form-label">지원 직무</label>
          <select id="offer-job-select" class="form-input">
            ${DEMO_JOB_POSTINGS.map(j => `<option value="${j.id}">${escapeHtml(j.title)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:10px">
          <label class="form-label">수신 이메일 <span style="font-size:0.7rem;color:var(--text-muted)">(선택 — 이메일 설정 시 실제 발송)</span></label>
          <input id="offer-to-email" class="form-input" type="email" placeholder="applicant@email.com">
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label class="form-label">메시지</label>
          <textarea id="offer-message-input" class="form-input" rows="4" placeholder="지원자에게 보낼 메시지를 입력하세요" style="resize:vertical;min-height:80px"></textarea>
        </div>
        <div style="display:flex;gap:8px">
          <button id="send-offer-confirm-btn" class="btn btn-primary" style="flex:1">전송</button>
          <button id="close-offer-modal-btn" class="btn btn-ghost" style="flex:1">취소</button>
        </div>
      </div>
    </div>
  `;

  // Reference Check PDF buttons
  content.querySelectorAll('.ref-pdf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const reqId = btn.dataset.reqId;
      const refId = btn.dataset.refId;
      let requests = [];
      try { requests = JSON.parse(localStorage.getItem('hr_ref_requests') || '[]'); } catch {}
      if (!requests.length) {
        requests = [{ id:'REF_DEMO', applicantName:'이지원', jobTitle:'HR Business Partner', createdAt: new Date().toISOString(), referees:[
          { id:'RD1', name:'김기훈', relation:'직속 상사', status:'completed', submittedAt: new Date().toISOString(),
            responses:{ Q_REL:'직속 상사', Q_TENURE:'2~3년', Q_PERFORM:4, Q_STRENGTH:'데이터 기반 의사결정이 탁월합니다.', Q_COMM:5, Q_COMM_DESC:'팀원들과 소통이 매우 원활합니다.', Q_LEAD:4, Q_TRUST:5, Q_IMPROVE:'좀 더 적극적인 자기주장이 필요합니다.', Q_REHIRE:'yes', Q_REHIRE_REASON:'함께 일하면 시너지가 납니다.', Q_COMMENT:'' } }
        ]}];
      }
      const req = requests.find(r => r.id === reqId);
      const ref = req?.referees.find(r => r.id === refId);
      if (!req || !ref) { showToast('결과를 불러올 수 없습니다.', 'error'); return; }

      const overlay = document.getElementById('ref-pdf-overlay');
      const contentEl = document.getElementById('ref-pdf-content');
      if (!overlay || !contentEl) return;

      contentEl.innerHTML = buildPdfContent(req, ref);
      overlay.style.display = 'block';

      let printStyle = document.getElementById('ref-print-style');
      if (!printStyle) {
        printStyle = document.createElement('style');
        printStyle.id = 'ref-print-style';
        printStyle.textContent = `@media print { body > *:not(#ref-pdf-overlay) { display:none!important; } #ref-pdf-topbar { display:none!important; } #ref-pdf-overlay { position:static!important; overflow:visible!important; } }`;
        document.head.appendChild(printStyle);
      }
    });
  });

  document.getElementById('ref-pdf-close-btn')?.addEventListener('click', () => {
    const overlay = document.getElementById('ref-pdf-overlay');
    if (overlay) overlay.style.display = 'none';
  });

  // Email config toggle
  content.querySelector('#toggle-email-cfg')?.addEventListener('click', () => {
    const form = content.querySelector('#email-cfg-form');
    if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
  });
  content.querySelector('#cancel-email-cfg')?.addEventListener('click', () => {
    const form = content.querySelector('#email-cfg-form');
    if (form) form.style.display = 'none';
  });
  content.querySelector('#save-email-cfg')?.addEventListener('click', () => {
    const publicKey          = content.querySelector('#ejs-public-key')?.value.trim();
    const serviceId          = content.querySelector('#ejs-service-id')?.value.trim();
    const templateInterview  = content.querySelector('#ejs-tpl-interview')?.value.trim();
    const templateOffer      = content.querySelector('#ejs-tpl-offer')?.value.trim();
    const templateAssessment = content.querySelector('#ejs-tpl-assessment')?.value.trim();
    if (!publicKey || !serviceId) { showToast('Public Key와 Service ID는 필수입니다.', 'error'); return; }
    saveEmailConfig({ publicKey, serviceId, templateInterview, templateOffer, templateAssessment });
    showToast('이메일 설정이 저장되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '이메일 설정이 저장되었습니다.' });
    renderRecruitTab(content);
  });
  content.querySelector('#clear-email-cfg')?.addEventListener('click', () => {
    localStorage.removeItem('hr_emailjs_config');
    showToast('이메일 설정이 삭제되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '이메일 설정이 삭제되었습니다.' });
    renderRecruitTab(content);
  });

  // Job form toggle
  content.querySelector('#add-job-btn')?.addEventListener('click', () => {
    const area = content.querySelector('#job-form-area');
    if (area) area.style.display = 'block';
    content.querySelector('#add-job-btn').style.display = 'none';
  });
  content.querySelector('#cancel-job-btn')?.addEventListener('click', () => {
    const area = content.querySelector('#job-form-area');
    if (area) area.style.display = 'none';
    content.querySelector('#add-job-btn').style.display = '';
  });
  content.querySelector('#save-job-btn')?.addEventListener('click', () => {
    const title    = content.querySelector('#job-title-input')?.value?.trim();
    const dept     = content.querySelector('#job-dept-input')?.value?.trim();
    const deadline = content.querySelector('#job-deadline-input')?.value;
    const jd       = content.querySelector('#job-jd-input')?.value?.trim();
    if (!title) { showToast('직무명을 입력하세요.', 'error'); return; }
    const newJob = { id: `JOB_${Date.now()}`, title, dept, deadline, jd_summary: jd, status: 'OPEN', tags: [], published_at: new Date().toISOString().slice(0, 10) };
    let existing = [];
    try { existing = JSON.parse(localStorage.getItem(JOB_POSTINGS_KEY) || 'null') || [...DEMO_JOB_POSTINGS]; } catch (_) { existing = [...DEMO_JOB_POSTINGS]; }
    existing.unshift(newJob);
    localStorage.setItem(JOB_POSTINGS_KEY, JSON.stringify(existing));
    api.jobs.save(newJob).catch(() => {});
    showToast('채용공고가 저장되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '채용공고가 저장되었습니다.' });
    renderRecruitTab(content);
  });

  // Funnel actions
  content.querySelectorAll('.btn-funnel-action').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      const name   = btn.dataset.name;
      const email  = btn.dataset.email || '';
      btn.disabled = true;
      btn.textContent = '발송 중…';

      // ATS hr_applicants stage 역방향 동기화
      function _syncAtsStage(newStage) {
        try {
          const list = JSON.parse(localStorage.getItem('hr_applicants') || '[]');
          const appl = JSON.parse(localStorage.getItem('hr_applicant_data') || '{}');
          const idx  = list.findIndex(a =>
            a.name === appl.applicantName || a.name === name
          );
          if (idx >= 0) { list[idx].stage = newStage; localStorage.setItem('hr_applicants', JSON.stringify(list)); }
        } catch {}
      }

      if (action === 'pass_doc') {
        const appl = JSON.parse(localStorage.getItem('hr_applicant_data') || '{}');
        appl.processStep = 'PRE_INTERVIEW';
        localStorage.setItem('hr_applicant_data', JSON.stringify(appl));
        _syncAtsStage('screening');
        showToast(`${name}님 서류 합격 처리 완료. 사전 진단 단계로 전환되었습니다.`, 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '님 서류 합격 처리 완료. 사전 진단 단계로 전환되었습니다.' });
      } else if (action === 'schedule') {
        const slots = [
          { id: 'SLOT_1', label: '5/28(화) 14:00', duration: '60분', location: '화상 면접' },
          { id: 'SLOT_2', label: '5/29(수) 10:00', duration: '60분', location: '화상 면접' },
          { id: 'SLOT_3', label: '5/30(목) 15:00', duration: '60분', location: '화상 면접' },
        ];
        const appl = JSON.parse(localStorage.getItem('hr_applicant_data') || '{}');
        appl.availableSlots = slots;
        appl.processStep    = 'INTERVIEW_SCHEDULE';
        localStorage.setItem('hr_applicant_data', JSON.stringify(appl));
        _syncAtsStage('interview1');

        if (email) {
          const res = await sendInterviewSchedule({
            toEmail: email, toName: name,
            orgName: '테크스타트업',
            interviewDate: '일정 선택 후 확정',
            message: '아래 링크에서 면접 가능 일정을 선택해 주세요.',
          });
          showToast(
            res.ok ? `${name}님에게 면접 일정 이메일을 발송했습니다.`
                   : `${name}님에게 면접 일정 링크를 전송했습니다. (${res.simulated ? '시뮬레이션' : '실패: ' + res.error})`,
            res.ok ? 'success' : 'info',
          );
        } else {
          showToast(`${name}님에게 면접 일정 선택 링크를 발송했습니다.`, 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '님에게 면접 일정 선택 링크를 발송했습니다.' });
        }
      } else if (action === 'offer') {
        const appl = JSON.parse(localStorage.getItem('hr_applicant_data') || '{}');
        appl.processStep = 'OFFER';
        localStorage.setItem('hr_applicant_data', JSON.stringify(appl));
        _syncAtsStage('offer');

        if (email) {
          const res = await sendOffer({
            toEmail: email, toName: name,
            orgName: '테크스타트업', jobTitle: '지원 포지션',
            message: '귀하의 역량과 열정에 감사드리며 입사 제안을 드립니다.',
          });
          showToast(
            res.ok ? `${name}님에게 오퍼 레터 이메일을 발송했습니다.`
                   : `${name}님에게 오퍼 레터를 전송했습니다. (${res.simulated ? '시뮬레이션' : '실패: ' + res.error})`,
            res.ok ? 'success' : 'info',
          );
        } else {
          showToast(`${name}님에게 오퍼 레터를 발송했습니다.`, 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '님에게 오퍼 레터를 발송했습니다.' });
        }
      }

      // Re-render recruit tab so table reflects updated step
      renderRecruitTab(content);
    });
  });

  // Talent pool offer modal
  let _targetUserId = null;
  content.querySelectorAll('.send-offer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _targetUserId = btn.dataset.userId;
      const modal = content.querySelector('#offer-modal-overlay');
      if (modal) modal.style.display = 'flex';
    });
  });
  content.querySelector('#close-offer-modal-btn')?.addEventListener('click', () => {
    const modal = content.querySelector('#offer-modal-overlay');
    if (modal) modal.style.display = 'none';
  });
  content.querySelector('#send-offer-confirm-btn')?.addEventListener('click', async () => {
    const message   = content.querySelector('#offer-message-input')?.value?.trim();
    const toEmail   = content.querySelector('#offer-to-email')?.value?.trim() || '';
    const jobSelect = content.querySelector('#offer-job-select');
    const jobId     = jobSelect?.value;
    const jobTitle  = jobSelect?.options[jobSelect.selectedIndex]?.text || '';
    if (!message) { showToast('메시지를 입력하세요.', 'error'); return; }

    const confirmBtn = content.querySelector('#send-offer-confirm-btn');
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '발송 중…'; }

    const offer = { id: `OFFER_RD_${Date.now()}`, recruiterName: 'HR 매니저', orgName: '테크스타트업', jobTitle, jobPostingId: jobId, message, status: 'SENT', createdAt: new Date().toISOString() };
    let existing = [];
    try { existing = JSON.parse(localStorage.getItem('hr_received_offers') || '[]'); } catch (_) {}
    existing.unshift(offer);
    localStorage.setItem('hr_received_offers', JSON.stringify(existing));
    api.offers.sendDirect({ applicant_user_id: _targetUserId, job_posting_id: jobId, message }).catch(() => {});

    if (toEmail) {
      const res = await sendOffer({ toEmail, toName: '지원자', orgName: '테크스타트업', jobTitle, message });
      showToast(
        res.ok ? `이메일로 오퍼를 발송했습니다. (${toEmail})`
               : '오퍼를 전송했습니다. 지원자의 마이페이지에 노출됩니다.',
        'success',
      );
    } else {
      showToast('오퍼를 전송했습니다. 지원자의 마이페이지에 노출됩니다.', 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '오퍼를 전송했습니다. 지원자의 마이페이지에 노출됩니다.' });
    }

    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = '전송'; }
    const modal = content.querySelector('#offer-modal-overlay');
    if (modal) modal.style.display = 'none';
  });
}

// ══════════════════════════════════════════════════════════════
// Tab 7 – 동문관리
// ══════════════════════════════════════════════════════════════

function calcRehireScore(alumni) {
  let score = 0;
  if ((alumni.finalCompScore || 0) >= 4.0)                               score += 40;
  if (['personal', 'study', 'family'].includes(alumni.exitReason))       score += 30;
  if ((alumni.tenureMonths || 0) >= 24)                                  score += 20;
  if (alumni.careerUpdated)                                               score += 10;
  return score;
}

function renderAlumniMgmtTab(content) {
  const alumniList = DEMO_ALUMNI.map(a => ({
    ...a,
    rehire_score: a.rehire_score ?? calcRehireScore(a),
  }));

  const scoreColor = s => s >= 75 ? '#059669' : s >= 50 ? '#F59E0B' : '#94A3B8';
  const scoreLabel = s => s >= 75 ? '🟢 재영입 추천' : s >= 50 ? '🟡 검토' : '⚪ 보류';

  const EXIT_LABELS = { personal:'개인사정', study:'학업', family:'가정', job_change:'이직', retirement:'퇴직' };

  content.innerHTML = `
    <div class="fade-in" style="padding-bottom:24px">
      <div class="section-title" style="margin-bottom:4px">동문(Alumni) 관리</div>
      <div class="section-subtitle" style="margin-bottom:14px">재영입 가능성을 평가하고 연락을 관리합니다.</div>

      <!-- Boomerang 자기신청 목록 -->
      ${(() => {
        let apps = [];
        try { apps = JSON.parse(localStorage.getItem('hr_boomerang_requests') || '[]'); } catch {}
        if (!apps.length) return '';
        return `
        <div class="section-title" style="margin-bottom:8px">📬 재입사 자기신청</div>
        <div class="card" style="padding:0;overflow:hidden;margin-bottom:18px">
          ${apps.map(a => `
            <div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px">
              <div>
                <div style="font-weight:600;font-size:0.85rem">${escapeHtml(a.targetJobTitle || '-')}</div>
                <div style="font-size:0.72rem;color:var(--text-muted)">현재: ${escapeHtml(a.currentCompany || '-')} · 신청일: ${(a.appliedAt||'').slice(0,10)}</div>
              </div>
              <span style="padding:2px 8px;background:#EEF2FF;color:#4F46E5;border-radius:999px;font-size:0.7rem;font-weight:700;white-space:nowrap">자기신청</span>
            </div>`).join('')}
        </div>`;
      })()}

      <!-- Alumni table -->
      <div class="card" style="padding:0;overflow:hidden;margin-bottom:18px">
        <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
          <thead>
            <tr style="background:var(--bg);border-bottom:1.5px solid var(--border)">
              <th style="padding:10px 12px;text-align:left;font-weight:700">이름</th>
              <th style="padding:10px 8px;text-align:left;font-weight:700">퇴직일/직위</th>
              <th style="padding:10px 8px;text-align:center;font-weight:700">재영입 점수</th>
              <th style="padding:10px 8px;text-align:center;font-weight:700">액션</th>
            </tr>
          </thead>
          <tbody>
            ${alumniList.map((a, i) => `
              <tr style="border-bottom:1px solid var(--border);${i % 2 === 1 ? 'background:#FAFBFC' : ''}">
                <td style="padding:10px 12px">
                  <div style="font-weight:600">${escapeHtml(a.name_ko)}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">${escapeHtml(EXIT_LABELS[a.exitReason] || a.exitReason || '-')}</div>
                </td>
                <td style="padding:10px 8px;color:var(--text-muted);font-size:0.78rem">
                  ${escapeHtml(a.exit_date || '-')}<br>
                  <span style="color:var(--text)">${escapeHtml(a.finalPosition || '-')}</span>
                </td>
                <td style="padding:10px 8px;text-align:center">
                  <div style="font-size:1rem;font-weight:700;color:${scoreColor(a.rehire_score)}">${a.rehire_score}</div>
                  <div style="font-size:0.68rem;color:${scoreColor(a.rehire_score)};margin-top:2px">${scoreLabel(a.rehire_score)}</div>
                </td>
                <td style="padding:10px 8px;text-align:center">
                  <button class="alumni-contact-btn"
                          data-alumni-id="${a.id}"
                          data-alumni-name="${escapeHtml(a.name_ko)}"
                          data-alumni-user-id="${escapeHtml(a.user_id)}"
                          style="padding:5px 10px;border-radius:7px;border:1.5px solid var(--primary);
                                 background:none;color:var(--primary);cursor:pointer;
                                 font-size:0.73rem;font-weight:600;white-space:nowrap">
                    연락하기
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Scoring rubric -->
      <div class="card" style="padding:12px 14px;background:#F8FAFC;margin-bottom:18px">
        <div style="font-size:0.75rem;font-weight:700;color:var(--text);margin-bottom:6px">재영입 적합도 점수 산정 기준</div>
        <div style="font-size:0.73rem;color:var(--text-muted);line-height:1.7">
          🏆 역량 최종 점수 4.0 이상 → +40점<br>
          😊 긍정적 퇴직 사유 (개인/학업/가정) → +30점<br>
          📅 재직기간 2년 이상 → +20점<br>
          🔄 Boomerang 관심 표명 → +10점
        </div>
      </div>
    </div>

    <!-- Contact Modal -->
    <div id="alumni-contact-modal" style="display:none;position:fixed;inset:0;z-index:400;background:rgba(0,0,0,0.55);align-items:flex-end">
      <div style="width:100%;background:var(--surface);border-radius:20px 20px 0 0;padding:22px 18px 32px">
        <div style="font-weight:700;font-size:1rem;margin-bottom:4px">💬 동문에게 연락하기</div>
        <div id="alumni-contact-target" style="font-size:0.82rem;color:var(--text-muted);margin-bottom:14px"></div>
        <div class="form-group" style="margin-bottom:10px">
          <label class="form-label">관심 직무</label>
          <select id="alumni-job-select" class="form-input">
            ${DEMO_JOB_POSTINGS.map(j => `<option value="${j.id}">${escapeHtml(j.title)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label class="form-label">메시지</label>
          <textarea id="alumni-message-input" class="form-input" rows="4" placeholder="안녕하세요, 다시 함께 일하고 싶습니다..." style="resize:vertical;min-height:80px"></textarea>
        </div>
        <div style="display:flex;gap:8px">
          <button id="send-alumni-contact-btn" class="btn btn-primary" style="flex:1">전송</button>
          <button id="close-alumni-contact-btn" class="btn btn-ghost" style="flex:1">취소</button>
        </div>
      </div>
    </div>
  `;

  let _contactTargetUserId = null;
  let _contactTargetName   = null;

  content.querySelectorAll('.alumni-contact-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _contactTargetUserId = btn.dataset.alumniUserId;
      _contactTargetName   = btn.dataset.alumniName;
      const modal = content.querySelector('#alumni-contact-modal');
      const label = content.querySelector('#alumni-contact-target');
      if (label) label.textContent = `수신자: ${_contactTargetName}`;
      if (modal) modal.style.display = 'flex';
    });
  });

  content.querySelector('#close-alumni-contact-btn')?.addEventListener('click', () => {
    const modal = content.querySelector('#alumni-contact-modal');
    if (modal) modal.style.display = 'none';
  });

  content.querySelector('#send-alumni-contact-btn')?.addEventListener('click', () => {
    const message   = content.querySelector('#alumni-message-input')?.value?.trim();
    const jobSelect = content.querySelector('#alumni-job-select');
    const jobTitle  = jobSelect?.options[jobSelect?.selectedIndex]?.text || '';
    if (!message) { showToast('메시지를 입력하세요.', 'error'); return; }
    const contact = {
      id:            `CONTACT_${Date.now()}`,
      recruiterName: 'HR 매니저',
      jobTitle,
      message,
      status:        'SENT',
      createdAt:     new Date().toISOString(),
      targetUserId:  _contactTargetUserId,
    };
    // Save to shared localStorage key read by boomerang.js tab 2
    let existing = [];
    try { existing = JSON.parse(localStorage.getItem(ALUMNI_CONTACTS_KEY) || '[]'); } catch (_) {}
    existing.unshift(contact);
    localStorage.setItem(ALUMNI_CONTACTS_KEY, JSON.stringify(existing));
    showToast(`${_contactTargetName}님에게 메시지를 전송했습니다.`, 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '님에게 메시지를 전송했습니다.' });
    const modal = content.querySelector('#alumni-contact-modal');
    if (modal) modal.style.display = 'none';
  });
}

// ══════════════════════════════════════════════════════════════
// Tab: 인재 인텔리전스 (People Intelligence)
// ══════════════════════════════════════════════════════════════

async function renderIntelligenceTab(content) {
  const user     = getUser();
  const orgId    = user?.org_id || 'ORG001';
  const employees = _state.employees || [];
  const ranked  = getRankedRisks(employees);
  const summary = getOrgHealthSummary(employees);
  const esc = escapeHtml;

  // Fetch real org instances for accurate completion rate
  let orgInstances = [];
  try {
    const res = await api.assessment.listByOrg(orgId);
    orgInstances = res?.instances || [];
  } catch {}

  const healthColor = summary.orgHealth >= 80 ? 'var(--success)'
                    : summary.orgHealth >= 60 ? 'var(--warning)' : 'var(--danger)';

  // 진단 완료율 — 실 API 우선, localStorage fallback
  const DONE_INST = new Set(['completed','calibrated','approved','finalized']);
  let diagRate = 0;
  if (orgInstances.length > 0) {
    const doneUsers = new Set(
      orgInstances.filter(i => DONE_INST.has(i.status)).map(i => i.assessee_id).filter(Boolean)
    ).size;
    diagRate = employees.length > 0 ? Math.round(doneUsers / employees.length * 100) : 0;
  } else {
    try {
      const sessions = JSON.parse(localStorage.getItem('hr_comp_sessions') || '[]');
      const diagUsers = new Set(sessions.map(s => s.userId).filter(Boolean)).size;
      diagRate = employees.length > 0 ? Math.round(diagUsers / employees.length * 100) : 0;
    } catch {}
  }

  // OKR 평균 달성률
  let avgOkr = 0;
  try {
    const goals = JSON.parse(localStorage.getItem('hr_okr_goals') || '[]');
    const krs = goals.flatMap(g => g.keyResults || []);
    avgOkr = krs.length ? Math.round(krs.reduce((s, kr) => s + (kr.progress || 0), 0) / krs.length) : 0;
  } catch {}

  const activeInst = orgInstances.filter(i => !DONE_INST.has(i.status) && i.status !== 'cancelled').length;

  content.innerHTML = `
    <div style="padding:16px">

      <!-- KPI 요약 -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
        ${iKpi('조직 건강', summary.orgHealth + '/100', healthColor)}
        ${iKpi('고위험 인원', ranked.filter(r=>r.risk.level==='HIGH').length + '명', ranked.filter(r=>r.risk.level==='HIGH').length > 0 ? 'var(--danger)' : 'var(--success)')}
        ${iKpi('평균 eNPS', summary.avgEnps + '점', summary.avgEnps >= 7 ? 'var(--success)' : 'var(--warning)')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:${orgInstances.length > 0 ? '8' : '20'}px">
        ${iKpi('L3 비율', summary.l3Rate + '%', summary.l3Rate >= 30 ? 'var(--success)' : 'var(--warning)')}
        ${iKpi('역량진단 완료', diagRate + '%', diagRate >= 70 ? 'var(--success)' : diagRate >= 40 ? 'var(--warning)' : 'var(--text-muted)')}
        ${iKpi('OKR 달성률', avgOkr + '%', avgOkr >= 70 ? 'var(--success)' : avgOkr >= 40 ? 'var(--warning)' : 'var(--danger)')}
      </div>
      ${orgInstances.length > 0 ? `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:20px">
        ${iKpi('전체 평가', orgInstances.length + '건', 'var(--primary)')}
        ${iKpi('진행 중', activeInst + '건', activeInst > 0 ? 'var(--warning)' : 'var(--text-muted)')}
        ${iKpi('평가 완료', orgInstances.filter(i => DONE_INST.has(i.status)).length + '건', 'var(--success)')}
      </div>` : ''}

      <!-- 전체 리스크 테이블 -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-weight:700;font-size:0.88rem">📋 전체 구성원 리스크 현황</div>
        <button id="intel-risk-csv-btn" class="btn btn-ghost btn-sm"
                style="font-size:0.72rem;padding:4px 10px">📥 CSV</button>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;margin-bottom:20px">
        <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
          <thead>
            <tr style="background:var(--bg);border-bottom:2px solid var(--border)">
              <th style="text-align:left;padding:10px 12px;font-weight:600;color:var(--text-muted)">구성원</th>
              <th style="text-align:center;padding:10px 6px;font-weight:600;color:var(--text-muted)">레벨</th>
              <th style="text-align:center;padding:10px 6px;font-weight:600;color:var(--text-muted)">역량점수</th>
              <th style="text-align:center;padding:10px 6px;font-weight:600;color:var(--text-muted)">eNPS</th>
              <th style="text-align:center;padding:10px 6px;font-weight:600;color:var(--text-muted)">위험도</th>
              <th style="text-align:left;padding:10px 6px;font-weight:600;color:var(--text-muted)">위험 신호</th>
              <th style="text-align:center;padding:10px 6px;font-weight:600;color:var(--text-muted)">권장 액션</th>
            </tr>
          </thead>
          <tbody>
            ${ranked.map(({ emp, risk }) => {
              // 1:1 미팅 최근성 체크
              let daysSince1on1 = null;
              try {
                const meetings = JSON.parse(localStorage.getItem('hr_one_on_ones') || '[]')
                  .filter(m => m.userId === emp.id || m.managerName === emp.name);
                if (meetings.length > 0) {
                  const last = Math.max(...meetings.map(m => new Date(m.createdAt || m.meetingDate || 0).getTime()));
                  daysSince1on1 = Math.floor((Date.now() - last) / 86_400_000);
                }
              } catch {}
              return `
              <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:10px 12px">
                  <span style="font-weight:600">${emp.avatar} ${esc(emp.name)}</span>
                  <div style="font-size:0.68rem;color:var(--text-muted)">${esc(emp.role)}</div>
                  ${daysSince1on1 !== null ? `<div style="font-size:0.65rem;color:${daysSince1on1 > 30 ? 'var(--warning)' : 'var(--success)'}">1:1 ${daysSince1on1}일 전</div>` : ''}
                </td>
                <td style="text-align:center;padding:10px 6px;font-weight:700;
                           color:${emp.level==='L3'?'var(--success)':emp.level==='L2'?'var(--primary)':'var(--text-muted)'}">
                  ${emp.level}
                </td>
                <td style="text-align:center;padding:10px 6px;font-weight:600">${emp.competencyScore.toFixed(1)}</td>
                <td style="text-align:center;padding:10px 6px">
                  <span style="font-weight:700;color:${
                    (emp.enpsHistory||[]).slice(-1)[0]>=8?'var(--success)':
                    (emp.enpsHistory||[]).slice(-1)[0]>=6?'var(--warning)':'var(--danger)'}">
                    ${(emp.enpsHistory||[]).slice(-1)[0]??'-'}
                  </span>
                </td>
                <td style="text-align:center;padding:10px 6px">
                  <span style="font-size:0.72rem;font-weight:700;color:${RISK_COLOR[risk.level]};
                               padding:3px 8px;border-radius:99px;background:${RISK_COLOR[risk.level]}15">
                    ${RISK_LABEL[risk.level]}
                  </span>
                </td>
                <td style="padding:10px 6px">
                  <div style="display:flex;flex-wrap:wrap;gap:3px">
                    ${risk.signals.map(s=>`<span style="font-size:0.65rem;background:var(--bg);
                      border:1px solid var(--border);padding:2px 6px;border-radius:99px">${s}</span>`).join('')||
                      '<span style="font-size:0.72rem;color:var(--success)">이상 없음</span>'}
                  </div>
                </td>
                <td style="padding:10px 6px;text-align:center">
                  ${risk.level !== 'LOW' ? `
                    <button class="intel-action-btn btn btn-ghost btn-sm"
                      data-emp="${esc(emp.id)}" data-name="${esc(emp.name)}"
                      style="font-size:0.7rem;padding:3px 8px;color:var(--primary)">
                      1:1 메모
                    </button>` : `<span style="color:var(--success);font-size:0.72rem">✅</span>`}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- 승계 계획 -->
      <div style="font-weight:700;font-size:0.88rem;margin-bottom:10px">🏆 핵심 포지션 승계 계획</div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px">
        ${KEY_ROLES.map(role => {
          const critColor = role.criticality === 'HIGH' ? 'var(--danger)' : 'var(--warning)';
          return `
            <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <div>
                  <span style="font-weight:700;font-size:0.88rem">${esc(role.title)}</span>
                  <span style="font-size:0.72rem;color:var(--text-muted);margin-left:6px">${esc(role.dept)}</span>
                </div>
                <span style="font-size:0.7rem;font-weight:700;color:${critColor};
                             background:${critColor}15;padding:2px 8px;border-radius:99px">
                  ${role.criticality === 'HIGH' ? '🔴 핵심' : '🟡 중요'}
                </span>
              </div>
              ${role.candidates.length === 0
                ? `<div style="font-size:0.78rem;color:var(--danger)">⚠️ 내부 후보 없음 — 채용 또는 집중 육성 필요</div>`
                : role.candidates.map(c => {
                    const emp = employees.find(e=>e.id===c.empId);
                    if (!emp) return '';
                    const bc = c.readiness>=80?'var(--success)':c.readiness>=60?'var(--warning)':'var(--danger)';
                    return `
                      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                        <span style="font-size:0.78rem;min-width:72px">${emp.avatar} ${esc(emp.name)}</span>
                        <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden">
                          <div style="height:100%;width:${c.readiness}%;background:${bc};border-radius:3px"></div>
                        </div>
                        <span style="font-size:0.7rem;color:var(--text-muted);min-width:72px;text-align:right">
                          ${c.readiness}% · ${esc(c.readinessLabel)}
                        </span>
                      </div>`;
                  }).join('')}
            </div>`;
        }).join('')}
      </div>

      <!-- 보정(Calibration) 도구 -->
      <div style="font-weight:700;font-size:0.88rem;margin-bottom:10px">⚖️ 성과 보정 (Calibration)</div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;margin-bottom:8px">
        ${calibrationView(ranked)}
      </div>

    </div>`;

  // 1:1 메모 버튼 → 리뷰 페이지로 이동 (매니저 컨텍스트 전달)
  content.querySelectorAll('.intel-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name;
      window.appState = window.appState || {};
      window.appState.managerViewEmployee = name;
      window.location.hash = '#/reviews';
    });
  });

  // CSV export for risk table
  content.querySelector('#intel-risk-csv-btn')?.addEventListener('click', () => {
    const rows = [['이름', '역할', '레벨', '역량점수', 'eNPS', '위험도', '위험 신호']];
    ranked.forEach(({ emp, risk }) => {
      rows.push([
        emp.name || '',
        emp.role || '',
        emp.level || '',
        (emp.competencyScore || 0).toFixed(1),
        (emp.enpsHistory || []).slice(-1)[0] ?? '',
        RISK_LABEL[risk.level] || risk.level,
        (risk.signals || []).join('; '),
      ]);
    });
    const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `risk_report_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function iKpi(label, value, color) {
  return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);
                padding:12px;text-align:center">
      <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:2px">${label}</div>
      <div style="font-size:1.3rem;font-weight:800;color:${color}">${value}</div>
    </div>`;
}

function calibrationView(ranked) {
  const total = ranked.length;
  const top    = ranked.filter(r => r.emp.competencyScore >= 4.0);
  const mid    = ranked.filter(r => r.emp.competencyScore >= 3.0 && r.emp.competencyScore < 4.0);
  const low    = ranked.filter(r => r.emp.competencyScore < 3.0);

  const topPct = Math.round(top.length / total * 100);
  const midPct = Math.round(mid.length / total * 100);
  const lowPct = Math.round(low.length / total * 100);

  const buckets = [
    { label: '고성과 (4.0+)', list: top, color: 'var(--success)', pct: topPct, target: 20 },
    { label: '성장 (3.0-3.9)', list: mid, color: 'var(--primary)', pct: midPct, target: 70 },
    { label: '개발 필요 (<3.0)', list: low, color: 'var(--danger)', pct: lowPct, target: 10 },
  ];

  return buckets.map(b => `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:4px">
        <span style="font-weight:600;color:${b.color}">${b.label}</span>
        <span style="color:var(--text-muted)">${b.list.length}명 (${b.pct}%) · 목표 ${b.target}%
          ${Math.abs(b.pct - b.target) > 10 ? `<span style="color:var(--warning)"> ⚠️</span>` : ''}</span>
      </div>
      <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;margin-bottom:4px">
        <div style="height:100%;width:${b.pct}%;background:${b.color};border-radius:4px;transition:width .5s ease"></div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        ${b.list.map(r=>`<span style="font-size:0.68rem;background:${b.color}15;
          border:1px solid ${b.color}40;padding:2px 7px;border-radius:99px">${r.emp.avatar} ${escapeHtml(r.emp.name)}</span>`).join('')}
      </div>
    </div>`).join('');
}

// ══════════════════════════════════════════════════════════════
// 팀 성과 현황 탭
// ══════════════════════════════════════════════════════════════

const TP_PERIODS = { H1: '상반기', H2: '하반기', ANNUAL: '연간' };

function _tpGetAllGoals() {
  try { return JSON.parse(localStorage.getItem('hr_okr_goals') || '[]'); } catch { return []; }
}
function _tpGetAllCheckins() {
  try { return JSON.parse(localStorage.getItem('hr_okr_checkins') || '[]'); } catch { return []; }
}

function _tpAvgProgress(goals) {
  if (!goals.length) return 0;
  const all = goals.flatMap(g => g.keyResults || []);
  if (!all.length) return 0;
  return Math.round(all.reduce((s, kr) => s + (kr.progress || 0), 0) / all.length);
}

function _tpStatusBadge(pct) {
  if (pct >= 80) return { label: '순항', color: 'var(--success)' };
  if (pct >= 50) return { label: '진행', color: 'var(--warning)' };
  if (pct > 0)   return { label: '위험', color: 'var(--danger)' };
  return { label: '미시작', color: 'var(--text-muted)' };
}

function _tpLastCheckinDate(checkins, userId) {
  const mine = checkins.filter(c => c.userId === userId);
  if (!mine.length) return null;
  mine.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return mine[0].date || null;
}

function renderTeamPerfTab(content) {
  const esc = escapeHtml;
  const allGoals    = _tpGetAllGoals();
  const allCheckins = _tpGetAllCheckins();
  const employees   = _state.employees || [];

  let activePeriod = content.dataset.period || 'H1';

  function render() {
    const period = activePeriod;
    const empRows = employees.map(emp => {
      const uid   = emp.id;
      const goals = allGoals.filter(g => g.userId === uid && g.period === period);
      const avg   = _tpAvgProgress(goals);
      const badge = _tpStatusBadge(avg);
      const lastCk = _tpLastCheckinDate(allCheckins, uid);
      return { emp, goals, avg, badge, lastCk };
    });

    // KPI summary
    const total      = empRows.length;
    const withGoals  = empRows.filter(r => r.goals.length > 0).length;
    const overallAvg = empRows.length
      ? Math.round(empRows.reduce((s, r) => s + r.avg, 0) / empRows.length)
      : 0;
    const atRisk     = empRows.filter(r => r.goals.length > 0 && r.avg < 50).length;
    const completed  = empRows.filter(r => r.avg >= 80).length;

    content.innerHTML = `
      <div style="padding:16px">

        <!-- 기간 필터 -->
        <div style="display:flex;gap:6px;margin-bottom:16px">
          ${Object.entries(TP_PERIODS).map(([k, v]) => `
            <button data-tp-period="${k}" style="padding:6px 14px;border-radius:99px;font-size:0.8rem;font-weight:600;
              border:1.5px solid ${k === period ? 'var(--primary)' : 'var(--border)'};
              background:${k === period ? 'var(--primary)' : 'var(--surface)'};
              color:${k === period ? '#fff' : 'var(--text-muted)'};cursor:pointer">
              ${v}
            </button>`).join('')}
        </div>

        <!-- KPI 카드 -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:20px">
          ${_tpKpi('목표 설정', withGoals + '/' + total + '명', 'var(--primary)')}
          ${_tpKpi('평균 진척률', overallAvg + '%', overallAvg >= 70 ? 'var(--success)' : overallAvg >= 40 ? 'var(--warning)' : 'var(--danger)')}
          ${_tpKpi('순항 (≥80%)', completed + '명', 'var(--success)')}
          ${_tpKpi('위험 (<50%)', atRisk + '명', atRisk > 0 ? 'var(--danger)' : 'var(--text-muted)')}
        </div>

        <!-- 구성원 테이블 -->
        <div style="font-weight:700;font-size:0.88rem;margin-bottom:10px">📋 구성원별 OKR 현황 (${TP_PERIODS[period]})</div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;margin-bottom:20px">
          <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
            <thead>
              <tr style="background:var(--bg);border-bottom:2px solid var(--border)">
                <th style="text-align:left;padding:10px 12px;font-weight:600;color:var(--text-muted)">구성원</th>
                <th style="text-align:center;padding:10px 8px;font-weight:600;color:var(--text-muted)">목표 수</th>
                <th style="text-align:left;padding:10px 8px;font-weight:600;color:var(--text-muted)">평균 진척률</th>
                <th style="text-align:center;padding:10px 8px;font-weight:600;color:var(--text-muted)">최근 체크인</th>
                <th style="text-align:center;padding:10px 8px;font-weight:600;color:var(--text-muted)">상태</th>
              </tr>
            </thead>
            <tbody>
              ${empRows.map(({ emp, goals, avg, badge, lastCk }) => `
                <tr class="tp-emp-row" data-uid="${esc(emp.id)}" style="border-bottom:1px solid var(--border);cursor:pointer;transition:background .1s"
                    onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
                  <td style="padding:10px 12px">
                    <span style="font-weight:600">${esc(emp.avatar || '👤')} ${esc(emp.name || emp.name_ko || '')}</span>
                    <div style="font-size:0.68rem;color:var(--text-muted)">${esc(emp.level || emp.level_code || '')} · ${esc(emp.role || '')}</div>
                  </td>
                  <td style="text-align:center;padding:10px 8px;font-weight:700;color:${goals.length ? 'var(--primary)' : 'var(--text-muted)'}">
                    ${goals.length}
                  </td>
                  <td style="padding:10px 8px">
                    <div style="display:flex;align-items:center;gap:6px">
                      <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden">
                        <div style="height:100%;width:${avg}%;background:${badge.color};border-radius:3px;transition:width .5s ease"></div>
                      </div>
                      <span style="font-size:0.75rem;font-weight:700;color:${badge.color};min-width:36px">${goals.length ? avg + '%' : '-'}</span>
                    </div>
                  </td>
                  <td style="text-align:center;padding:10px 8px;font-size:0.75rem;color:var(--text-muted)">
                    ${lastCk ? lastCk.slice(0, 10) : '-'}
                  </td>
                  <td style="text-align:center;padding:10px 8px">
                    <span style="font-size:0.72rem;font-weight:700;color:${badge.color};
                                 padding:3px 8px;border-radius:99px;background:${badge.color}18">
                      ${goals.length ? badge.label : '미설정'}
                    </span>
                  </td>
                </tr>
                <tr class="tp-detail-row" id="tp-detail-${esc(emp.id)}" style="display:none;background:var(--bg)">
                  <td colspan="5" style="padding:0 16px 12px 40px">
                    ${goals.length ? goals.map(g => {
                      const gAvg = _tpAvgProgress([g]);
                      return `
                        <div style="margin-top:10px;padding:10px;background:var(--surface);border:1px solid var(--border);border-radius:8px">
                          <div style="font-weight:600;font-size:0.82rem;margin-bottom:6px">${esc(g.objective)}</div>
                          ${(g.keyResults || []).map(kr => `
                            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                              <span style="font-size:0.72rem;color:var(--text-muted);flex:1">${esc(kr.text)}</span>
                              <div style="width:80px;height:5px;background:var(--border);border-radius:3px;overflow:hidden;flex-shrink:0">
                                <div style="height:100%;width:${kr.progress || 0}%;background:${_tpStatusBadge(kr.progress || 0).color};border-radius:3px"></div>
                              </div>
                              <span style="font-size:0.72rem;font-weight:700;color:${_tpStatusBadge(kr.progress || 0).color};min-width:30px">${kr.progress || 0}%</span>
                            </div>`).join('')}
                        </div>`;
                    }).join('') : `<div style="margin-top:10px;text-align:center;padding:8px;color:var(--text-muted)"><span style="font-size:1rem">🎯</span> <span style="font-size:0.8rem">이 기간에 설정된 목표가 없습니다.</span></div>`}
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <!-- 전체 진척률 분포 -->
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;margin-bottom:20px">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:12px">📊 진척률 분포</div>
          ${_tpProgressBuckets(empRows)}
        </div>

      </div>`;

    // Period filter click
    content.querySelectorAll('[data-tp-period]').forEach(btn => {
      btn.addEventListener('click', () => {
        activePeriod = btn.dataset.tpPeriod;
        content.dataset.period = activePeriod;
        render();
      });
    });

    // Row expand/collapse
    content.querySelectorAll('.tp-emp-row').forEach(row => {
      row.addEventListener('click', () => {
        const detail = content.querySelector(`#tp-detail-${row.dataset.uid}`);
        if (detail) {
          detail.style.display = detail.style.display === 'none' ? 'table-row' : 'none';
        }
      });
    });
  }

  render();
}

function _tpKpi(label, value, color) {
  return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);
                padding:10px 8px;text-align:center">
      <div style="font-size:1rem;font-weight:800;color:${color}">${value}</div>
      <div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px">${label}</div>
    </div>`;
}

function _tpProgressBuckets(rows) {
  const total = rows.length;
  if (!total) return '<div style="color:var(--text-muted);font-size:0.8rem">데이터 없음</div>';

  const buckets = [
    { label: '순항 (≥80%)',   filter: r => r.goals.length && r.avg >= 80, color: 'var(--success)' },
    { label: '진행 (50~79%)', filter: r => r.goals.length && r.avg >= 50 && r.avg < 80, color: 'var(--warning)' },
    { label: '위험 (<50%)',   filter: r => r.goals.length && r.avg < 50, color: 'var(--danger)' },
    { label: '미설정',        filter: r => !r.goals.length, color: 'var(--text-muted)' },
  ];

  return buckets.map(b => {
    const list = rows.filter(b.filter);
    const pct  = Math.round(list.length / total * 100);
    return `
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:4px">
          <span style="font-weight:600;color:${b.color}">${b.label}</span>
          <span style="color:var(--text-muted)">${list.length}명 (${pct}%)</span>
        </div>
        <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;margin-bottom:4px">
          <div style="height:100%;width:${pct}%;background:${b.color};border-radius:4px;transition:width .5s ease"></div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${list.map(r => `<span style="font-size:0.68rem;background:${b.color}15;border:1px solid ${b.color}40;
            padding:2px 7px;border-radius:99px">${escapeHtml(r.emp.avatar || '👤')} ${escapeHtml(r.emp.name || r.emp.name_ko || '')}</span>`).join('')}
        </div>
      </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
// Tab: 기능 관리 (Feature Flags)
// ══════════════════════════════════════════════════════════════

function renderFeaturesTab(content) {
  const flags = getAllFlags();

  content.innerHTML = `
    <div class="fade-in" style="padding:16px;max-width:640px;margin:0 auto">
      <div style="margin-bottom:20px">
        <div class="section-title" style="margin-bottom:4px">기능 패키지 관리</div>
        <div class="section-subtitle">기능을 켜거나 끄면 즉시 모든 사용자에게 반영됩니다.<br>비활성화된 기능은 하단 메뉴에서 숨겨지고 접근 시 "준비 중" 화면이 표시됩니다.</div>
      </div>

      <div id="feature-pkg-list" style="display:flex;flex-direction:column;gap:12px">
        ${FEATURE_PACKAGES.map(pkg => {
          const on = flags[pkg.key] !== undefined ? flags[pkg.key] : pkg.defaultOn;
          return `
            <div class="card" style="padding:16px 18px;display:flex;align-items:center;gap:14px;
                                     border:2px solid ${on ? 'var(--primary)' : 'var(--border)'};
                                     transition:border-color .2s" data-pkg="${escapeHtml(pkg.key)}">
              <div style="font-size:1.6rem;flex-shrink:0;width:36px;text-align:center">${pkg.icon}</div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:0.95rem;color:var(--text)">${escapeHtml(pkg.label)}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">${escapeHtml(pkg.description)}</div>
              </div>
              <label class="feature-toggle" style="flex-shrink:0;position:relative;width:44px;height:24px;cursor:pointer">
                <input type="checkbox" data-key="${escapeHtml(pkg.key)}" ${on ? 'checked' : ''}
                       style="position:absolute;opacity:0;width:0;height:0">
                <span class="feature-toggle-track" style="
                  position:absolute;inset:0;border-radius:12px;
                  background:${on ? 'var(--primary)' : 'var(--border)'};
                  transition:background .2s">
                </span>
                <span class="feature-toggle-thumb" style="
                  position:absolute;top:3px;left:${on ? '23px' : '3px'};
                  width:18px;height:18px;border-radius:50%;background:#fff;
                  box-shadow:0 1px 4px rgba(0,0,0,.25);
                  transition:left .2s">
                </span>
              </label>
            </div>`;
        }).join('')}
      </div>

      <div style="display:flex;gap:10px;margin-top:20px">
        <button id="features-reset-btn" class="btn btn-ghost" style="flex:1">
          🔄 기본값으로 초기화
        </button>
        <button id="features-all-on-btn" class="btn btn-outline" style="flex:1">
          ✅ 전체 활성화
        </button>
      </div>

      <div id="features-saved-msg" style="display:none;margin-top:12px;text-align:center;
           font-size:0.8rem;color:var(--success);font-weight:600">
        ✅ 저장되었습니다 — 페이지를 새로고침하면 모든 사용자에게 적용됩니다.
      </div>
    </div>

    <style>
      .feature-toggle input:focus-visible + .feature-toggle-track { outline:2px solid var(--primary); outline-offset:2px; }
    </style>
  `;

  // 토글 이벤트
  content.querySelectorAll('input[data-key]').forEach(input => {
    input.addEventListener('change', () => {
      const key = input.dataset.key;
      const on  = input.checked;

      // 저장
      const current = getAllFlags();
      current[key]  = on;
      saveFlags(current);

      // 카드 border 색상 업데이트
      const card  = content.querySelector(`[data-pkg="${key}"]`);
      const track = input.nextElementSibling;
      const thumb = track?.nextElementSibling;
      if (card)  card.style.borderColor  = on ? 'var(--primary)' : 'var(--border)';
      if (track) track.style.background  = on ? 'var(--primary)' : 'var(--border)';
      if (thumb) thumb.style.left        = on ? '23px' : '3px';

      _showSavedMsg(content);
    });
  });

  // 초기화 버튼
  content.querySelector('#features-reset-btn')?.addEventListener('click', () => {
    if (!confirm('모든 기능을 기본값으로 초기화하시겠습니까?')) return;
    resetFlags();
    renderFeaturesTab(content);
  });

  // 전체 활성화
  content.querySelector('#features-all-on-btn')?.addEventListener('click', () => {
    const all = {};
    FEATURE_PACKAGES.forEach(p => { all[p.key] = true; });
    saveFlags(all);
    renderFeaturesTab(content);
  });
}

function _showSavedMsg(content) {
  const msg = content.querySelector('#features-saved-msg');
  if (!msg) return;
  msg.style.display = 'block';
  clearTimeout(msg._timer);
  msg._timer = setTimeout(() => { msg.style.display = 'none'; }, 3000);
}

// ══════════════════════════════════════════════════════════════
// Tab: 직원 관리
// ══════════════════════════════════════════════════════════════

let _empState = {
  employees: [],
  filter: 'MEMBER',
  search: '',
  loading: false,
  instanceMap: {},
};

async function renderEmployeeTab(content) {
  const user = getUser();
  const orgId = user?.org_id;

  content.innerHTML = `
    <div style="padding:16px">
      <div id="emp-spinner" style="text-align:center;padding:40px;color:var(--text-muted)">
        ⏳ 직원 목록 로딩 중…
      </div>
    </div>`;

  // 로드
  let employees = [];
  try {
    const res = await api.employees?.list?.(orgId, { status: 'ALL' });
    employees = Array.isArray(res) && res.length ? res : _state.employees;
  } catch {
    employees = _state.employees;
  }
  _empState.employees = employees;

  // Fetch assessment instances for MEMBER employees in parallel
  try {
    const memberEmps = employees.filter(e => e.user_status === 'MEMBER');
    const instResults = await Promise.all(
      memberEmps.map(e => api.assessment.listInstances(e.id).catch(() => null))
    );
    const map = {};
    memberEmps.forEach((e, i) => { map[e.id] = instResults[i] || []; });
    _empState.instanceMap = map;
  } catch {
    _empState.instanceMap = {};
  }

  _renderEmployeeUI(content, orgId);
}

function _renderEmployeeUI(content, orgId) {
  const { employees, filter, search } = _empState;

  const filtered = employees.filter(e => {
    const matchStatus = filter === 'ALL' || e.user_status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || (e.name_ko || e.name || '').toLowerCase().includes(q)
      || (e.email || '').toLowerCase().includes(q)
      || (e.department || e.dept || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const statusCount = (s) => employees.filter(e => e.user_status === s).length;

  content.innerHTML = `
    <div style="padding:16px">

      <!-- 헤더 액션 -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:160px">
          <input id="emp-search" type="text" placeholder="이름·이메일·부서 검색…"
                 value="${escapeHtml(search)}"
                 style="width:100%;padding:8px 12px;border:1px solid var(--border);
                        border-radius:var(--radius);font-size:0.85rem;background:var(--bg)">
        </div>
        <button id="emp-import-btn" class="btn btn-ghost btn-sm"
                style="font-size:0.8rem;white-space:nowrap">📥 CSV 가져오기</button>
        <button id="emp-add-btn" class="btn btn-primary btn-sm"
                style="font-size:0.8rem;white-space:nowrap">+ 직원 추가</button>
      </div>

      <!-- 상태 필터 -->
      <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">
        ${[
          { key:'MEMBER',  label:`재직 (${statusCount('MEMBER')})` },
          { key:'ALUMNI',  label:`퇴직 (${statusCount('ALUMNI')})` },
          { key:'ALL',     label:`전체 (${employees.length})` },
        ].map(f => `
          <button class="emp-filter-btn" data-f="${f.key}"
                  style="padding:5px 12px;border-radius:20px;font-size:0.78rem;font-weight:600;
                         cursor:pointer;border:1px solid ${_empState.filter === f.key ? 'var(--primary)' : 'var(--border)'};
                         background:${_empState.filter === f.key ? 'var(--primary)' : 'var(--surface)'};
                         color:${_empState.filter === f.key ? '#fff' : 'var(--text-muted)'}">
            ${f.label}
          </button>
        `).join('')}
      </div>

      <!-- 직원 테이블 -->
      ${filtered.length === 0 ? `
        <div style="text-align:center;padding:40px;color:var(--text-muted)">
          <div style="font-size:2rem;margin-bottom:8px">👤</div>
          <div>${search ? '검색 결과가 없습니다.' : '등록된 직원이 없습니다.'}</div>
          ${!search ? `<button id="emp-add-btn2" class="btn btn-primary btn-sm" style="margin-top:12px">+ 직원 추가</button>` : ''}
        </div>
      ` : `
        <div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius-lg)">
          <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
            <thead>
              <tr style="background:var(--surface);border-bottom:1px solid var(--border)">
                <th style="padding:10px 12px;text-align:left;font-weight:600;color:var(--text-muted)">이름</th>
                <th style="padding:10px 12px;text-align:left;font-weight:600;color:var(--text-muted);display:none" class="col-dept">부서</th>
                <th style="padding:10px 12px;text-align:left;font-weight:600;color:var(--text-muted)">레벨</th>
                <th style="padding:10px 12px;text-align:left;font-weight:600;color:var(--text-muted)">역량점수</th>
                <th style="padding:10px 12px;text-align:left;font-weight:600;color:var(--text-muted)">eNPS</th>
                <th style="padding:10px 12px;text-align:left;font-weight:600;color:var(--text-muted)">평가</th>
                <th style="padding:10px 12px;text-align:left;font-weight:600;color:var(--text-muted)">상태</th>
                <th style="padding:10px 8px;text-align:right;font-weight:600;color:var(--text-muted)">액션</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(emp => {
                const name      = escapeHtml(emp.name || emp.name_ko || '');
                const email     = escapeHtml(emp.email || '');
                const dept      = escapeHtml(emp.department || emp.dept || '');
                const level     = escapeHtml(emp.level || emp.level_code || '-');
                const compScore = (emp.competencyScore || emp.competency_score || 0).toFixed(1);
                const enpsArr   = emp.enpsHistory || emp.enps_history || [];
                const enpsLast  = enpsArr.slice(-1)[0] ?? '-';
                const enpsColor = enpsLast === '-' ? 'var(--text-muted)'
                                : enpsLast >= 8  ? 'var(--success)'
                                : enpsLast >= 6  ? 'var(--warning)' : 'var(--danger)';
                const statusBadge = emp.user_status === 'MEMBER'
                  ? `<span style="color:var(--success);font-size:0.75rem">● 재직</span>`
                  : emp.user_status === 'ALUMNI'
                  ? `<span style="color:var(--text-muted);font-size:0.75rem">● 퇴직</span>`
                  : `<span style="color:var(--warning);font-size:0.75rem">● ${emp.user_status}</span>`;
                const TERM_SET = new Set(['completed','calibrated','approved','finalized','cancelled']);
                const DONE_SET = new Set(['completed','calibrated','approved','finalized']);
                const empInst   = _empState.instanceMap[emp.id] || [];
                const doneCount = empInst.filter(i => DONE_SET.has(i.status)).length;
                const activeCount = empInst.filter(i => !TERM_SET.has(i.status)).length;
                const assessBadge = empInst.length === 0
                  ? `<span style="color:var(--text-muted);font-size:0.75rem">–</span>`
                  : activeCount > 0
                  ? `<span style="color:var(--primary);font-size:0.75rem;font-weight:600">⏳ ${activeCount}건</span>`
                  : `<span style="color:var(--success);font-size:0.75rem;font-weight:600">✓ ${doneCount}건</span>`;
                const pwBadge = emp.mustChangePassword
                  ? `<span title="초기 비밀번호 미변경" style="font-size:0.68rem;color:var(--warning);margin-left:4px">🔑</span>`
                  : '';
                return `
                  <tr style="border-bottom:1px solid var(--border);transition:background .1s"
                      onmouseenter="this.style.background='var(--surface)'"
                      onmouseleave="this.style.background=''">
                    <td style="padding:10px 12px">
                      <div style="font-weight:600">${emp.avatar || '👤'} ${name}${pwBadge}</div>
                      <div style="font-size:0.72rem;color:var(--text-muted)">${email}</div>
                      ${dept ? `<div style="font-size:0.72rem;color:var(--text-muted)">${dept}</div>` : ''}
                    </td>
                    <td style="padding:10px 12px">${level}</td>
                    <td style="padding:10px 12px">
                      <span style="font-weight:700;color:${Number(compScore) >= 4 ? 'var(--success)' : Number(compScore) >= 3 ? 'var(--warning)' : 'var(--danger)'}">
                        ${compScore}
                      </span>
                    </td>
                    <td style="padding:10px 12px;font-weight:600;color:${enpsColor}">${enpsLast}</td>
                    <td style="padding:10px 12px">${assessBadge}</td>
                    <td style="padding:10px 12px">${statusBadge}</td>
                    <td style="padding:10px 8px;text-align:right">
                      <button class="btn btn-ghost btn-sm emp-edit-btn" data-id="${escapeHtml(emp.id)}"
                              style="font-size:0.75rem;padding:4px 8px">✏️</button>
                      <button class="btn btn-ghost btn-sm emp-enps-btn" data-id="${escapeHtml(emp.id)}"
                              title="eNPS 입력" style="font-size:0.75rem;padding:4px 8px">📊</button>
                      ${emp.user_status !== 'ALUMNI' ? `
                        <button class="btn btn-ghost btn-sm emp-deact-btn" data-id="${escapeHtml(emp.id)}"
                                style="font-size:0.75rem;padding:4px 8px;color:var(--danger)">🚪</button>
                      ` : ''}
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}

      <!-- CSV 템플릿 안내 -->
      <div style="margin-top:12px;padding:10px 12px;background:var(--surface);border-radius:var(--radius);
                  font-size:0.75rem;color:var(--text-muted)">
        📄 CSV 형식: <code>name_ko, email, department, level_code, role, years_experience, hire_date</code>
        &nbsp;·&nbsp;
        <a id="emp-csv-template" href="#" style="color:var(--primary)">템플릿 다운로드</a>
      </div>
    </div>`;

  // ── 이벤트 바인딩 ────────────────────────────────────────────

  content.querySelector('#emp-search')?.addEventListener('input', e => {
    _empState.search = e.target.value;
    _renderEmployeeUI(content, orgId);
  });

  content.querySelectorAll('.emp-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _empState.filter = btn.dataset.f;
      _renderEmployeeUI(content, orgId);
    });
  });

  content.querySelector('#emp-add-btn')?.addEventListener('click',  () => _openEmpModal(content, orgId, null));
  content.querySelector('#emp-add-btn2')?.addEventListener('click', () => _openEmpModal(content, orgId, null));
  content.querySelector('#emp-import-btn')?.addEventListener('click', () => _openCsvImport(content, orgId));

  content.querySelectorAll('.emp-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const emp = _empState.employees.find(e => e.id === btn.dataset.id);
      if (emp) _openEmpModal(content, orgId, emp);
    });
  });

  content.querySelectorAll('.emp-enps-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const emp = _empState.employees.find(e => e.id === btn.dataset.id);
      if (emp) _openEnpsModal(content, orgId, emp);
    });
  });

  content.querySelectorAll('.emp-deact-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const emp = _empState.employees.find(e => e.id === btn.dataset.id);
      if (!emp) return;
      if (!confirm(`${emp.name || emp.name_ko}님을 퇴직 처리하시겠습니까?`)) return;
      try {
        await api.employees?.deactivate?.(emp.id);
        emp.user_status = 'ALUMNI';
        showToast('퇴직 처리되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '퇴직 처리되었습니다.' });
        _renderEmployeeUI(content, orgId);
      } catch { showToast('처리 실패', 'error'); }
    });
  });

  content.querySelector('#emp-csv-template')?.addEventListener('click', e => {
    e.preventDefault();
    const csv = 'name_ko,email,department,level_code,role,years_experience,hire_date\n홍길동,hong@example.com,개발팀,L2,staff,3,2022-03-01\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'employee_template.csv'; a.click();
    URL.revokeObjectURL(url);
  });
}

// ── 직원 추가/편집 모달 ──────────────────────────────────────

function _openEmpModal(content, orgId, emp) {
  const isEdit = !!emp;
  const overlay = document.createElement('div');
  overlay.id = 'emp-modal-overlay';
  overlay.className = 'desktop-modal-center';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9000;
    display:flex;align-items:flex-end;justify-content:center`;

  overlay.innerHTML = `
    <div style="background:var(--bg);border-radius:20px 20px 0 0;width:100%;max-width:540px;
                padding:24px;max-height:90vh;overflow-y:auto">
      <div style="font-weight:700;font-size:1rem;margin-bottom:20px">
        ${isEdit ? '✏️ 직원 정보 수정' : '➕ 직원 추가'}
      </div>

      <div style="display:flex;flex-direction:column;gap:12px">
        ${_empField('이름 *', 'name_ko', emp?.name || emp?.name_ko || '', 'text', isEdit)}
        ${!isEdit ? _empField('이메일 *', 'email', emp?.email || '', 'email') : `
          <div style="font-size:0.82rem;color:var(--text-muted)">이메일: ${escapeHtml(emp?.email || '')}</div>`}
        ${_empField('부서', 'department', emp?.department || emp?.dept || '', 'text')}
        ${_empSelect('직위 레벨', 'level_code', emp?.level || emp?.level_code || 'L1',
            ['L1','L2','L3','L4'].map(l => ({ v:l, l:l })))}
        ${_empSelect('역할', 'role', emp?.role || 'staff',
            [{v:'staff',l:'직원'},{v:'manager',l:'매니저'},{v:'hr_admin',l:'HR 관리자'},{v:'admin',l:'시스템 관리자'}])}
        ${_empField('근속 연수', 'years_experience', emp?.yrs ?? emp?.years_experience ?? 0, 'number')}
        ${_empField('입사일', 'hire_date', emp?.hire_date || '', 'date')}
        ${_empField('전화번호', 'phone', emp?.phone || '', 'tel')}
        ${isEdit ? '' : `
          <div style="font-size:0.75rem;color:var(--text-muted)">
            ※ 초기 비밀번호: 이메일 @ 앞 부분 (예: hong@example.com → hong)
          </div>`}
      </div>

      ${isEdit ? `
        <hr style="border:none;border-top:1px solid var(--border);margin:20px 0">
        <div>
          <div style="font-size:0.82rem;font-weight:600;color:var(--text-muted);margin-bottom:8px">🔐 비밀번호 재설정</div>
          <button id="emp-reset-pw-btn" class="btn btn-ghost btn-sm" style="width:100%;border:1px solid var(--border)">
            임시 비밀번호 발급
          </button>
          <div id="emp-reset-pw-result" style="display:none;margin-top:8px;padding:10px;background:#ECFDF5;
               border-radius:var(--radius);font-size:0.8rem">
            임시 비밀번호: <strong id="emp-temp-pw-val"></strong>
            <br><span style="color:var(--text-muted);font-size:0.72rem">직원에게 직접 전달해 주세요. 첫 로그인 후 변경됩니다.</span>
          </div>
        </div>` : ''}

      <div style="display:flex;gap:8px;margin-top:20px">
        <button id="emp-modal-cancel" class="btn btn-ghost" style="flex:1">취소</button>
        <button id="emp-modal-save"   class="btn btn-primary" style="flex:1">
          ${isEdit ? '저장' : '추가'}
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelector('#emp-modal-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  // Reset password button (edit mode only)
  overlay.querySelector('#emp-reset-pw-btn')?.addEventListener('click', async () => {
    const btn = overlay.querySelector('#emp-reset-pw-btn');
    btn.disabled = true;
    btn.textContent = '발급 중...';
    try {
      const res = await api.employees?.resetPassword?.(emp.id);
      if (res?.temp_password) {
        overlay.querySelector('#emp-temp-pw-val').textContent = res.temp_password;
        overlay.querySelector('#emp-reset-pw-result').style.display = 'block';
        btn.textContent = '재발급';
      } else {
        showToast('비밀번호 재설정 실패', 'error');
        btn.textContent = '임시 비밀번호 발급';
      }
    } catch {
      showToast('비밀번호 재설정 실패', 'error');
      btn.textContent = '임시 비밀번호 발급';
    } finally {
      btn.disabled = false;
    }
  });

  overlay.querySelector('#emp-modal-save').addEventListener('click', async () => {
    const get = id => overlay.querySelector(`#emp-f-${id}`)?.value?.trim() || '';
    const data = {
      name_ko:          get('name_ko'),
      email:            get('email') || emp?.email,
      department:       get('department'),
      level_code:       get('level_code') || 'L1',
      role:             get('role') || 'staff',
      years_experience: parseInt(get('years_experience')) || 0,
      hire_date:        get('hire_date') || null,
      phone:            get('phone') || null,
    };
    if (!data.name_ko) { showToast('이름을 입력해주세요.', 'error'); return; }
    if (!isEdit && !data.email) { showToast('이메일을 입력해주세요.', 'error'); return; }

    try {
      if (isEdit) {
        const res = await api.employees?.update?.(emp.id, { name_ko: data.name_ko, level_code: data.level_code, role: data.role, years_experience: data.years_experience });
        await api.employees?.updateProfile?.(emp.id, { department: data.department, hire_date: data.hire_date, phone: data.phone });
        const idx = _empState.employees.findIndex(e => e.id === emp.id);
        if (idx >= 0) _empState.employees[idx] = { ..._empState.employees[idx], ...data, name: data.name_ko };
        showToast('저장되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '저장되었습니다.' });
      } else {
        const res = await api.employees?.create?.(orgId, data);
        if (res?.employee) {
          _empState.employees.push({ ...res.employee, name: res.employee.name_ko, avatar: '👤', enpsHistory: [], competencyScore: 0 });
          // Show temp password before closing
          if (res.temp_password) {
            _showTempPasswordResult(overlay, res.employee, res.temp_password, content, orgId);
            return;
          }
          showToast('직원이 추가되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '직원이 추가되었습니다.' });
        } else {
          _empState.employees.push({ id: `USR_${Date.now()}`, ...data, name: data.name_ko, user_status: 'MEMBER', avatar: '👤', enpsHistory: [], competencyScore: 0 });
          showToast('직원이 추가되었습니다. (로컬)', 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '직원이 추가되었습니다. (로컬)' });
        }
      }
      overlay.remove();
      _renderEmployeeUI(content, orgId);
    } catch (e) {
      showToast(e.message || '저장 실패', 'error');
    }
  });
}

function _showTempPasswordResult(overlay, employee, tempPw, content, orgId) {
  const name = employee.name_ko || employee.name || '';
  overlay.querySelector('div').innerHTML = `
    <div style="text-align:center;padding:8px 0">
      <div style="font-size:2rem;margin-bottom:12px">✅</div>
      <div style="font-weight:700;font-size:1rem;margin-bottom:6px">직원 추가 완료</div>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:20px">${escapeHtml(name)} 님이 추가되었습니다.</div>

      <div style="background:#EEF2FF;border-radius:var(--radius);padding:14px;margin-bottom:20px;text-align:left">
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px">초기 로그인 정보 (직원에게 공유)</div>
        <div style="font-size:0.82rem;margin-bottom:4px">
          <span style="color:var(--text-muted)">이메일:</span>
          <strong style="margin-left:6px">${escapeHtml(employee.email || '')}</strong>
        </div>
        <div style="font-size:0.82rem;margin-bottom:8px">
          <span style="color:var(--text-muted)">초기 비밀번호:</span>
          <strong style="margin-left:6px;font-size:1rem;letter-spacing:0.05em">${escapeHtml(tempPw)}</strong>
        </div>
        <div style="font-size:0.7rem;color:var(--text-muted)">⚠️ 첫 로그인 시 비밀번호 변경이 요구됩니다.</div>
      </div>

      <button id="emp-result-close" class="btn btn-primary btn-block">확인</button>
    </div>
  `;
  overlay.querySelector('#emp-result-close').addEventListener('click', () => {
    overlay.remove();
    _renderEmployeeUI(content, orgId);
  });
}

function _empField(label, id, value, type = 'text', readonly = false) {
  return `
    <div>
      <label style="font-size:0.78rem;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px">${label}</label>
      <input id="emp-f-${id}" type="${type}" value="${escapeHtml(String(value))}"
             ${readonly ? 'readonly style="background:var(--surface);color:var(--text-muted)"' : ''}
             style="width:100%;padding:8px 10px;border:1px solid var(--border);
                    border-radius:var(--radius);font-size:0.85rem;background:var(--bg)">
    </div>`;
}

function _empSelect(label, id, value, options) {
  return `
    <div>
      <label style="font-size:0.78rem;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px">${label}</label>
      <select id="emp-f-${id}"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);
                     border-radius:var(--radius);font-size:0.85rem;background:var(--bg)">
        ${options.map(o => `<option value="${o.v}" ${o.v === value ? 'selected' : ''}>${o.l}</option>`).join('')}
      </select>
    </div>`;
}

// ── eNPS 입력 모달 ───────────────────────────────────────────

function _openEnpsModal(content, orgId, emp) {
  const name    = emp.name || emp.name_ko || '';
  const history = emp.enpsHistory || emp.enps_history || [];
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9000;
    display:flex;align-items:center;justify-content:center;padding:20px`;

  overlay.innerHTML = `
    <div style="background:var(--bg);border-radius:var(--radius-lg);width:100%;max-width:360px;padding:24px">
      <div style="font-weight:700;font-size:1rem;margin-bottom:4px">📊 eNPS 입력</div>
      <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:20px">${escapeHtml(name)}</div>

      ${history.length ? `
        <div style="margin-bottom:16px;padding:10px;background:var(--surface);border-radius:var(--radius);font-size:0.78rem">
          <div style="font-weight:600;margin-bottom:6px;color:var(--text-muted)">이전 기록</div>
          <div style="display:flex;gap:6px;align-items:flex-end">
            ${history.slice(-5).map((v, i, arr) => {
              const h  = Math.round((v / 10) * 40);
              const cl = v >= 8 ? 'var(--success)' : v >= 6 ? 'var(--warning)' : 'var(--danger)';
              const delta = i > 0 ? v - arr[i - 1] : null;
              return `<div style="text-align:center">
                <div style="width:24px;height:${h}px;background:${cl};border-radius:3px 3px 0 0;margin-bottom:2px"></div>
                <div style="font-weight:700;font-size:0.8rem;color:${cl}">${v}</div>
                ${delta !== null ? `<div style="font-size:0.65rem;color:${delta >= 0 ? 'var(--success)' : 'var(--danger)'}">${delta >= 0 ? '+' : ''}${delta}</div>` : '<div style="font-size:0.65rem"> </div>'}
              </div>`;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <div style="margin-bottom:16px">
        <label style="font-size:0.82rem;font-weight:600;margin-bottom:8px;display:block">
          이번 분기 eNPS 점수 (0~10)
        </label>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${Array.from({length:11}, (_,i) => `
            <button class="enps-btn" data-v="${i}"
                    style="width:40px;height:40px;border-radius:var(--radius);font-weight:700;
                           font-size:0.85rem;cursor:pointer;border:1px solid var(--border);
                           background:var(--surface);transition:all .1s"
                    onmouseenter="this.style.background='var(--primary)';this.style.color='#fff'"
                    onmouseleave="if(!this.classList.contains('selected')){this.style.background='var(--surface)';this.style.color=''}">
              ${i}
            </button>`).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.7rem;
                    color:var(--text-muted);margin-top:4px;padding:0 2px">
          <span>전혀 추천 안 함</span><span>적극 추천</span>
        </div>
        <input id="enps-value" type="hidden" value="">
      </div>

      <div style="display:flex;gap:8px">
        <button id="enps-cancel" class="btn btn-ghost" style="flex:1">취소</button>
        <button id="enps-save"   class="btn btn-primary" style="flex:1">저장</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  let selected = null;
  overlay.querySelectorAll('.enps-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.enps-btn').forEach(b => {
        b.classList.remove('selected');
        b.style.background = 'var(--surface)';
        b.style.color = '';
      });
      btn.classList.add('selected');
      btn.style.background = 'var(--primary)';
      btn.style.color = '#fff';
      selected = parseInt(btn.dataset.v);
      overlay.querySelector('#enps-value').value = selected;
    });
  });

  overlay.querySelector('#enps-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#enps-save').addEventListener('click', async () => {
    if (selected === null) { showToast('점수를 선택해주세요.', 'error'); return; }
    const newHistory = [...history, selected];
    try {
      await api.employees?.updateProfile?.(emp.id, { enpsHistory: newHistory, enps_score: selected });
      emp.enpsHistory = newHistory;
      const idx = _empState.employees.findIndex(e => e.id === emp.id);
      if (idx >= 0) _empState.employees[idx].enpsHistory = newHistory;
      showToast('eNPS가 저장되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: 'eNPS가 저장되었습니다.' });
      overlay.remove();
      _renderEmployeeUI(content, orgId);
    } catch { showToast('저장 실패', 'error'); }
  });
}

// ── CSV 임포트 모달 ──────────────────────────────────────────

function _openCsvImport(content, orgId) {
  const overlay = document.createElement('div');
  overlay.className = 'desktop-modal-center';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9000;
    display:flex;align-items:flex-end;justify-content:center`;

  overlay.innerHTML = `
    <div style="background:var(--bg);border-radius:20px 20px 0 0;width:100%;max-width:600px;
                padding:24px;max-height:85vh;overflow-y:auto">
      <div style="font-weight:700;font-size:1rem;margin-bottom:6px">📥 직원 CSV 가져오기</div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:20px">
        헤더: <code>name_ko, email, department, level_code, role, years_experience, hire_date</code>
      </div>

      <div id="csv-drop-zone"
           style="border:2px dashed var(--border);border-radius:var(--radius-lg);padding:32px;
                  text-align:center;cursor:pointer;margin-bottom:16px;transition:border-color .2s"
           onclick="document.getElementById('csv-file-input').click()">
        <div style="font-size:2rem;margin-bottom:8px">📂</div>
        <div style="font-weight:600;margin-bottom:4px">클릭하거나 파일을 드래그하세요</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">.csv 파일 지원</div>
        <input id="csv-file-input" type="file" accept=".csv,text/csv" style="display:none">
      </div>

      <div id="csv-preview" style="display:none">
        <div style="font-weight:600;font-size:0.85rem;margin-bottom:8px" id="csv-count"></div>
        <div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius);
                    max-height:240px;overflow-y:auto">
          <table style="width:100%;border-collapse:collapse;font-size:0.78rem" id="csv-preview-table"></table>
        </div>
        <div id="csv-errors" style="margin-top:8px;color:var(--danger);font-size:0.75rem"></div>
      </div>

      <div style="display:flex;gap:8px;margin-top:20px">
        <button id="csv-cancel" class="btn btn-ghost" style="flex:1">취소</button>
        <button id="csv-import-confirm" class="btn btn-primary" style="flex:1;display:none">
          일괄 추가
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  let parsedRows = [];

  const dropZone  = overlay.querySelector('#csv-drop-zone');
  const fileInput = overlay.querySelector('#csv-file-input');

  ['dragenter','dragover'].forEach(ev => dropZone.addEventListener(ev, e => {
    e.preventDefault(); dropZone.style.borderColor = 'var(--primary)';
  }));
  ['dragleave','drop'].forEach(ev => dropZone.addEventListener(ev, e => {
    e.preventDefault(); dropZone.style.borderColor = 'var(--border)';
    if (ev === 'drop' && e.dataTransfer.files[0]) _readCsvFile(e.dataTransfer.files[0]);
  }));
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) _readCsvFile(fileInput.files[0]); });

  function _readCsvFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const lines = e.target.result.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) { showToast('데이터가 없습니다.', 'error'); return; }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g,''));
      const requiredCols = ['name_ko', 'email'];
      const missing = requiredCols.filter(c => !headers.includes(c));
      if (missing.length) { showToast(`필수 컬럼 없음: ${missing.join(', ')}`, 'error'); return; }

      const errors = [];
      parsedRows = lines.slice(1).map((line, i) => {
        const vals = line.split(',').map(v => v.trim().replace(/^["']|["']$/g,''));
        const row  = {};
        headers.forEach((h, j) => { row[h] = vals[j] || ''; });
        if (!row.name_ko) errors.push(`행 ${i+2}: 이름 없음`);
        if (!row.email?.includes('@')) errors.push(`행 ${i+2}: 이메일 형식 오류`);
        return row;
      });

      const preview = overlay.querySelector('#csv-preview');
      const table   = overlay.querySelector('#csv-preview-table');
      const countEl = overlay.querySelector('#csv-count');
      const errEl   = overlay.querySelector('#csv-errors');
      const confirmBtn = overlay.querySelector('#csv-import-confirm');

      countEl.textContent = `총 ${parsedRows.length}명 미리보기`;
      errEl.innerHTML = errors.length ? `⚠️ ${errors.slice(0,3).join(' · ')}${errors.length>3?' 외 '+(errors.length-3)+'건':''}` : '';

      table.innerHTML = `
        <thead><tr style="background:var(--surface)">
          ${headers.slice(0,6).map(h => `<th style="padding:6px 8px;text-align:left;font-weight:600;font-size:0.75rem;color:var(--text-muted)">${h}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${parsedRows.slice(0,10).map(r => `<tr style="border-top:1px solid var(--border)">
            ${headers.slice(0,6).map(h => `<td style="padding:6px 8px">${escapeHtml(r[h]||'')}</td>`).join('')}
          </tr>`).join('')}
          ${parsedRows.length > 10 ? `<tr><td colspan="${Math.min(headers.length,6)}" style="padding:6px 8px;color:var(--text-muted);font-style:italic">… 외 ${parsedRows.length-10}명</td></tr>` : ''}
        </tbody>`;

      preview.style.display = 'block';
      confirmBtn.style.display = errors.length === parsedRows.length ? 'none' : 'block';
      confirmBtn.textContent = `일괄 추가 (${parsedRows.filter((_,i) => !errors.some(e => e.startsWith(`행 ${i+2}`))).length}명)`;
    };
    reader.readAsText(file, 'utf-8');
  }

  overlay.querySelector('#csv-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#csv-import-confirm').addEventListener('click', async () => {
    const btn = overlay.querySelector('#csv-import-confirm');
    btn.textContent = '추가 중…';
    btn.disabled = true;

    let ok = 0, fail = 0;
    for (const row of parsedRows) {
      if (!row.name_ko || !row.email?.includes('@')) { fail++; continue; }
      try {
        const res = await api.employees?.create?.(orgId, {
          name_ko:          row.name_ko,
          email:            row.email,
          department:       row.department || null,
          level_code:       row.level_code || 'L1',
          role:             row.role || 'staff',
          years_experience: parseInt(row.years_experience) || 0,
          hire_date:        row.hire_date || null,
        });
        if (res?.employee) {
          _empState.employees.push({
            ...res.employee,
            name: res.employee.name_ko,
            avatar: '👤', enpsHistory: [], competencyScore: 0,
          });
        } else {
          // demo mode
          _empState.employees.push({
            id: `USR_${Date.now()}_${ok}`, ...row, name: row.name_ko,
            user_status: 'MEMBER', avatar: '👤', enpsHistory: [], competencyScore: 0,
          });
        }
        ok++;
      } catch { fail++; }
    }

    overlay.remove();
    showToast(`${ok}명 추가 완료${fail ? ` (${fail}명 실패)` : ''}.`, ok ? 'success' : 'error');
    _renderEmployeeUI(content, orgId);
  });
}

// ══════════════════════════════════════════════════════════════
// Tab: 인적성 검사 관리
// ══════════════════════════════════════════════════════════════

async function renderAptitudeTab(c)          { await renderConnectedAdminTab(c, 'aptitude_mgmt.js'); }
async function renderLeaveMgmtTab(c)         { await renderConnectedAdminTab(c, 'leave-admin.js'); }
async function renderPayslipMgmtTab(c)       { await renderConnectedAdminTab(c, 'payslip-admin.js'); }
async function renderWorkhoursTab(c)         { await renderConnectedAdminTab(c, 'workhours-report.js'); }
async function renderLegalEduAdminTab(c)     { await renderConnectedAdminTab(c, 'legal-edu-admin.js'); }
async function renderHarassmentAdminTab(c)   { await renderConnectedAdminTab(c, 'harassment-admin.js'); }
async function renderOrgChartTab(c)          { await renderConnectedAdminTab(c, 'org-chart.js'); }
async function renderPersonnelTab(c)         { await renderConnectedAdminTab(c, 'personnel-history.js'); }
async function renderHrDashboardTab(c)       { await renderConnectedAdminTab(c, 'hr-dashboard.js'); }
async function renderWageLedgerTab(c)        { await renderConnectedAdminTab(c, 'wage-ledger.js'); }
async function renderOnboardingTab(c)        { await renderConnectedAdminTab(c, 'onboarding-mgmt.js'); }
async function renderOffboardingTab(c)       { await renderConnectedAdminTab(c, 'offboarding-mgmt.js'); }

// ══════════════════════════════════════════════════════════════
// Tab: 경비 승인
// ══════════════════════════════════════════════════════════════

async function renderExpenseMgmtTab(container) {
  const LS   = 'hr_expense_claims';
  const TYPE = { condolence:'경조금', self_dev:'자기계발비', business:'업무비용' };
  const ST   = { pending:{ l:'검토 중',c:'#F59E0B',b:'#FEF3C7' }, approved:{ l:'승인',c:'#059669',b:'#D1FAE5' }, rejected:{ l:'반려',c:'#DC2626',b:'#FEE2E2' } };

  const claims = JSON.parse(localStorage.getItem(LS) || '[]')
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  if (!claims.length) {
    container.innerHTML = `<div style="text-align:center;padding:48px 20px">
      <div style="font-size:36px;margin-bottom:12px">💸</div>
      <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px">경비 신청 내역이 없습니다</div>
      <div style="font-size:13px;color:#94A3B8">직원이 경비를 신청하면 여기에 표시됩니다.</div>
    </div>`;
    return;
  }

  container.innerHTML = `<div style="padding:16px">
    ${claims.map(c => {
      const s = ST[c.status] || ST.pending;
      return `<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div>
            <span style="font-size:14px;font-weight:700">${TYPE[c.type]||c.type}</span>
            <span style="font-size:12px;color:#64748B;margin-left:8px">${c.amount.toLocaleString()}원</span>
          </div>
          <span style="font-size:12px;padding:3px 10px;border-radius:20px;font-weight:600;color:${s.c};background:${s.b}">${s.l}</span>
        </div>
        <div style="font-size:12px;color:#94A3B8">${c.description} · ${c.submittedAt.slice(0,10)}</div>
        ${c.status === 'pending' ? `<div style="display:flex;gap:8px;margin-top:10px">
          <button data-approve="${c.id}" style="flex:1;background:#D1FAE5;color:#059669;border:none;border-radius:8px;padding:8px;font-size:13px;font-weight:600;cursor:pointer">✅ 승인</button>
          <button data-reject="${c.id}" style="flex:1;background:#FEE2E2;color:#DC2626;border:none;border-radius:8px;padding:8px;font-size:13px;font-weight:600;cursor:pointer">❌ 반려</button>
        </div>` : ''}
      </div>`;
    }).join('')}
  </div>`;

  container.querySelectorAll('[data-approve]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.approve;
      const all = JSON.parse(localStorage.getItem(LS) || '[]');
      const idx = all.findIndex(x => x.id === id);
      if (idx >= 0) { all[idx].status = 'approved'; localStorage.setItem(LS, JSON.stringify(all)); }
      showToast('경비 신청을 승인했습니다.', 'success');
      addNotification({ type: 'success', title: '경비 관리 (관리자)', body: '경비 신청을 승인했습니다.' });
      renderExpenseMgmtTab(container);
    });
  });
  container.querySelectorAll('[data-reject]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.reject;
      const all = JSON.parse(localStorage.getItem(LS) || '[]');
      const idx = all.findIndex(x => x.id === id);
      if (idx >= 0) { all[idx].status = 'rejected'; localStorage.setItem(LS, JSON.stringify(all)); }
      showToast('경비 신청을 반려했습니다.', 'error');
      addNotification({ type: 'error', title: '경비 관리 (관리자)', body: '경비 신청을 반려했습니다.' });
      renderExpenseMgmtTab(container);
    });
  });
}

// ══════════════════════════════════════════════════════════════
// Tab: 초대 관리
// ══════════════════════════════════════════════════════════════

function isLocalBackendAdmin() {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

async function renderInviteTab(container) {
  const user    = getUser();
  const orgId   = user?.org_id;
  const isLocal = isLocalBackendAdmin();
  const LS_KEY  = 'hr_invite_tokens';

  function getLsTokens() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
  }
  function saveLsTokens(t) { localStorage.setItem(LS_KEY, JSON.stringify(t)); }
  function genCode() {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({length: 8}, () => c[Math.floor(Math.random() * c.length)]).join('');
  }

  container.innerHTML = `
    <div style="padding:16px;max-width:560px;margin:0 auto">
      ${!isLocal ? `<div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:10px 12px;font-size:0.78rem;color:#1E40AF;margin-bottom:16px">
        ℹ️ 웹 배포 환경입니다. 생성된 초대코드는 <strong>이 브라우저의 로컬 저장소</strong>에 저장됩니다.
        같은 기기의 Chrome에서만 사용 가능합니다. 크로스 디바이스 공유는 Supabase 연동이 필요합니다.
      </div>` : ''}

      <h2 style="font-size:1.05rem;font-weight:700;margin-bottom:4px">초대코드 생성</h2>
      <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:16px">
        생성된 코드를 팀원에게 공유하면, 팀원이 자신의 계정을 직접 만들 수 있습니다.
      </p>

      <div class="card" style="padding:16px;margin-bottom:20px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div>
            <label style="font-size:0.75rem;color:var(--text-muted);display:block;margin-bottom:4px">역할</label>
            <select id="inv-role" class="form-input" style="padding:8px">
              <option value="staff">직원 (staff)</option>
              <option value="manager">매니저 (manager)</option>
              <option value="hr_admin">HR 관리자</option>
            </select>
          </div>
          <div>
            <label style="font-size:0.75rem;color:var(--text-muted);display:block;margin-bottom:4px">직급코드</label>
            <select id="inv-level" class="form-input" style="padding:8px">
              ${['L1','L2','L3','L4','L5'].map(l => `<option value="${l}"${l==='L2'?' selected':''}>${l}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:0.75rem;color:var(--text-muted);display:block;margin-bottom:4px">최대 사용 횟수</label>
            <input id="inv-max" type="number" class="form-input" value="10" min="1" max="100" style="padding:8px">
          </div>
          <div>
            <label style="font-size:0.75rem;color:var(--text-muted);display:block;margin-bottom:4px">유효 기간 (시간)</label>
            <input id="inv-hours" type="number" class="form-input" value="72" min="1" max="720" style="padding:8px">
          </div>
        </div>
        <button id="gen-invite-btn" class="btn btn-primary" style="width:100%">초대코드 생성</button>
      </div>

      <div id="invite-result" style="display:none;background:var(--card-bg);border:1.5px solid var(--primary);border-radius:10px;padding:16px;margin-bottom:20px">
        <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px">생성된 초대코드</div>
        <div style="display:flex;align-items:center;gap:8px">
          <div id="invite-code-display"
               style="flex:1;font-size:1.4rem;font-weight:700;letter-spacing:0.15em;
                      font-family:monospace;color:var(--primary);background:var(--bg);
                      padding:10px 14px;border-radius:8px;border:1.5px solid var(--primary)">
          </div>
          <button id="copy-invite-btn" class="btn btn-sm"
                  style="background:var(--surface);border:1px solid var(--border)">
            📋 복사
          </button>
        </div>
        <div id="invite-meta" style="font-size:0.75rem;color:var(--text-muted);margin-top:8px"></div>
      </div>

      <h3 style="font-size:0.9rem;font-weight:700;margin-bottom:8px">기존 초대코드</h3>
      <div id="invite-list" style="font-size:0.8rem;color:var(--text-muted)">불러오는 중…</div>
    </div>`;

  function renderInviteList(invites) {
    const el = container.querySelector('#invite-list');
    if (!invites.length) {
      el.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted)">
        <div style="font-size:2rem;margin-bottom:8px">🔑</div>
        <div>아직 생성된 초대코드가 없습니다.</div>
        <div style="font-size:0.75rem;margin-top:4px;opacity:0.7">기본 코드: FCA2026 · FCAJOIN · ADMIN2026</div>
      </div>`;
      return;
    }
    el.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
        <thead>
          <tr style="border-bottom:1px solid var(--border);color:var(--text-muted)">
            <th style="text-align:left;padding:6px 8px">코드</th>
            <th style="text-align:left;padding:6px 8px">역할</th>
            <th style="text-align:center;padding:6px 8px">사용</th>
            <th style="text-align:left;padding:6px 8px">상태</th>
            <th style="padding:4px"></th>
          </tr>
        </thead>
        <tbody>
          ${invites.map((inv, i) => {
            const code    = inv.token || inv.code;
            const expired = inv.expires_at && new Date(inv.expires_at) < new Date();
            const full    = inv.max_uses && (inv.uses || 0) >= inv.max_uses;
            const inactive = inv.active === false;
            const status  = inactive ? '비활성' : expired ? '만료' : full ? '소진' : '활성';
            const color   = (expired || full || inactive) ? '#EF4444' : '#10B981';
            return `
              <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:6px 8px;font-family:monospace;font-weight:700;letter-spacing:0.1em">
                  ${escapeHtml(code)}
                </td>
                <td style="padding:6px 8px">${escapeHtml(inv.role)} (${escapeHtml(inv.level_code||'L2')})</td>
                <td style="padding:6px 8px;text-align:center">${inv.uses||0}/${inv.max_uses||'∞'}</td>
                <td style="padding:6px 8px">
                  <span style="color:${color};font-weight:600">${status}</span>
                  ${inv.expires_at ? `<br><span style="opacity:0.6">${inv.expires_at.slice(0,10)}</span>` : ''}
                </td>
                <td style="padding:4px">
                  ${!isLocal ? `<button class="del-inv-btn" data-idx="${i}"
                    style="background:none;border:none;color:#EF4444;font-size:0.75rem;cursor:pointer;padding:2px 6px">✕</button>` : ''}
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;

    if (!isLocal) {
      el.querySelectorAll('.del-inv-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const tokens = getLsTokens();
          tokens.splice(parseInt(btn.dataset.idx), 1);
          saveLsTokens(tokens);
          showToast('초대코드가 삭제됐습니다.', 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '초대코드가 삭제됐습니다.' });
          loadInvites();
        });
      });
    }
  }

  async function loadInvites() {
    if (isLocal) {
      try {
        const r = await fetch(`/api/orgs/${orgId}/invites`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('hr_token')}` },
        });
        if (!r.ok) throw new Error();
        const data = await r.json();
        renderInviteList(data.invites || []);
      } catch {
        container.querySelector('#invite-list').textContent = '초대코드를 불러올 수 없습니다.';
      }
    } else {
      renderInviteList(getLsTokens());
    }
  }

  container.querySelector('#gen-invite-btn').addEventListener('click', async () => {
    const btn = container.querySelector('#gen-invite-btn');
    btn.disabled = true;
    btn.textContent = '생성 중…';

    try {
      if (isLocal) {
        const r = await fetch(`/api/orgs/${orgId}/invites`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('hr_token')}`,
          },
          body: JSON.stringify({
            role:          container.querySelector('#inv-role').value,
            level_code:    container.querySelector('#inv-level').value,
            max_uses:      parseInt(container.querySelector('#inv-max').value) || 10,
            expires_hours: parseInt(container.querySelector('#inv-hours').value) || 72,
          }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Failed');

        container.querySelector('#invite-result').style.display = '';
        container.querySelector('#invite-code-display').textContent = data.invite_token;
        container.querySelector('#invite-meta').textContent =
          `역할: ${data.role} · 최대 ${data.max_uses}명 · 만료: ${data.expires_at?.slice(0,16)} UTC`;
        showToast('초대코드가 생성됐습니다!', 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '초대코드가 생성됐습니다!' });
        loadInvites();
      } else {
        const code      = genCode();
        const maxUses   = parseInt(container.querySelector('#inv-max').value) || 10;
        const hours     = parseInt(container.querySelector('#inv-hours').value) || 72;
        const expiresAt = new Date(Date.now() + hours * 3_600_000).toISOString();
        const newToken  = {
          id: `inv_${Date.now()}`,
          code,
          role:        container.querySelector('#inv-role').value,
          level_code:  container.querySelector('#inv-level').value,
          user_status: 'MEMBER',
          max_uses:    maxUses,
          uses:        0,
          expires_at:  expiresAt,
          created_at:  new Date().toISOString(),
          active:      true,
        };
        const tokens = getLsTokens();
        tokens.unshift(newToken);
        saveLsTokens(tokens);

        container.querySelector('#invite-result').style.display = '';
        container.querySelector('#invite-code-display').textContent = code;
        container.querySelector('#invite-meta').textContent =
          `역할: ${newToken.role} (${newToken.level_code}) · 최대 ${maxUses}명 · 만료: ${expiresAt.slice(0,10)}`;
        showToast('초대코드가 생성됐습니다!', 'success')
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '초대코드가 생성됐습니다!' });
        loadInvites();
      }
    } catch (err) {
      showToast(err.message || '생성 실패', 'error');
    }
    btn.disabled = false;
    btn.textContent = '초대코드 생성';
  });

  container.querySelector('#copy-invite-btn').addEventListener('click', () => {
    const code = container.querySelector('#invite-code-display').textContent.trim();
    navigator.clipboard.writeText(code).then(() => {
      showToast('클립보드에 복사됐습니다', 'success');
      addNotification({ type: 'success', title: 'Dashboard (관리자)', body: '클립보드에 복사됐습니다' });
    });
  });

  loadInvites();
}

// ══════════════════════════════════════════════════════════════
// Tab: HR 보고서
// ══════════════════════════════════════════════════════════════

async function renderHrReportTab(c)             { await renderConnectedAdminTab(c, 'hr-report.js'); }
async function renderRulebookTab(c)             { await renderConnectedAdminTab(c, 'rulebook-mgmt.js'); }
async function renderPulseResultsTab(c)         { await renderConnectedAdminTab(c, 'pulse-results.js'); }
async function renderNoticeMgmtTab(c)           { await renderConnectedAdminTab(c, 'notice-admin.js'); }
async function renderAssetAdminTab(c)           { await renderConnectedAdminTab(c, 'asset-admin.js'); }
async function renderLeavePromotionTab(c)       { await renderConnectedAdminTab(c, 'leave-promotion.js'); }
async function renderApprovalAdminTab(c)        { await renderConnectedAdminTab(c, 'approval-admin.js'); }
async function renderIdeaAdminTab(c)            { await renderConnectedAdminTab(c, 'idea-admin.js'); }
async function renderReferralAdminTab(c)        { await renderConnectedAdminTab(c, 'referral-admin.js'); }
async function renderOvertimeAdminTab(c)        { await renderConnectedAdminTab(c, 'overtime-admin.js'); }
async function renderWorkReportAdminTab(c)      { await renderConnectedAdminTab(c, 'work-report-admin.js'); }
async function renderCommuteAdminTab(c)         { await renderConnectedAdminTab(c, 'commute-admin.js'); }
async function renderBenefitEnrollAdminTab(c)   { await renderConnectedAdminTab(c, 'benefit-enroll-admin.js'); }
async function renderSuppliesAdminTab(c)        { await renderConnectedAdminTab(c, 'supplies-admin.js'); }
async function renderProbationAdminTab(c)       { await renderConnectedAdminTab(c, 'probation-admin.js'); }
async function renderBusinessCardAdminTab(c)    { await renderConnectedAdminTab(c, 'business-card-admin.js'); }
async function renderClubAdminTab(c)            { await renderConnectedAdminTab(c, 'club-admin.js'); }
async function renderWelfareAdminTab(c)         { await renderConnectedAdminTab(c, 'welfare-admin.js'); }
async function renderSalaryRaiseAdminTab(c)     { await renderConnectedAdminTab(c, 'salary-raise-admin.js'); }
async function renderParkingAdminTab(c)         { await renderConnectedAdminTab(c, 'parking-admin.js'); }
async function renderCafeteriaAdminTab(c)       { await renderConnectedAdminTab(c, 'cafeteria-admin.js'); }
async function renderBusinessTripAdminTab(c)    { await renderConnectedAdminTab(c, 'business-trip-admin.js'); }
async function renderProjectAdminTab(c)         { await renderConnectedAdminTab(c, 'project-admin.js'); }
async function renderCertificationAdminTab(c)   { await renderConnectedAdminTab(c, 'certification-admin.js'); }
async function renderWellnessAdminTab(c)        { await renderConnectedAdminTab(c, 'wellness-admin.js'); }
async function renderExpenseAdminTab(c)         { await renderConnectedAdminTab(c, 'expense-admin.js'); }
async function renderTransferAdminTab(c)        { await renderConnectedAdminTab(c, 'transfer-admin.js'); }
async function renderOrgHealthTab(c)            { await renderConnectedAdminTab(c, 'org-health-admin.js'); }
async function renderSurveyResultsAdminTab(c)   { await renderConnectedAdminTab(c, 'survey-results-admin.js'); }
async function renderPerfCalibrationTab(c)      { await renderConnectedAdminTab(c, 'performance-calibration.js'); }
async function renderHeadcountPlanTab(c)        { await renderConnectedAdminTab(c, 'headcount-plan.js'); }
async function renderCompensationAdminTab(c)    { await renderConnectedAdminTab(c, 'compensation-admin.js'); }
async function renderRecruitmentTrackerTab(c)   { await renderConnectedAdminTab(c, 'recruitment-tracker.js'); }
async function renderTalentPoolTab(c)           { await renderConnectedAdminTab(c, 'talent-pool-admin.js'); }
async function renderFamilyEventAdminTab(c)     { await renderConnectedAdminTab(c, 'family-event-admin.js'); }
async function renderEnpsDashboardTab(c)        { await renderConnectedAdminTab(c, 'enps-dashboard.js'); }
async function renderRemoteWorkAdminTab(c)      { await renderConnectedAdminTab(c, 'remote-work-admin.js'); }
async function renderTrainingAdminTab(c)        { await renderConnectedAdminTab(c, 'training-admin.js'); }
async function renderSurveyBuilderTab(c)        { await renderConnectedAdminTab(c, 'survey-builder.js'); }

function renderHealthCheckupTab(container) {
  const LS = 'hr_health_checkups';
  const YEAR = new Date().getFullYear();
  const EMPLOYEES = (_state.employees || []).map(e => ({ id: e.id, name: e.name, dept: e.dept || e.department || '기타' }));
  const records = JSON.parse(localStorage.getItem(LS) || '[]');
  const doneIds = new Set(records.filter(r => r.year === YEAR).map(r => r.empId));
  const done    = EMPLOYEES.filter(e => doneIds.has(e.id));
  const pending = EMPLOYEES.filter(e => !doneIds.has(e.id));
  const pct     = Math.round((done.length / EMPLOYEES.length) * 100);

  container.innerHTML = `<div style="padding:16px">
    <div style="font-size:15px;font-weight:700;margin-bottom:14px">🏥 건강검진 관리 (${YEAR}년)</div>

    <div style="background:#EEF2FF;border-radius:12px;padding:12px;margin-bottom:14px;border-left:4px solid #4F46E5">
      <div style="font-size:12px;font-weight:700;color:#4338CA;margin-bottom:2px">⚖️ 산업안전보건법 제129조</div>
      <div style="font-size:11px;color:#3730A3">사업주는 근로자에게 연 1회 이상 일반 건강검진을 실시해야 합니다.</div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
      ${[
        { label:'전체 직원',  value:EMPLOYEES.length+'명', color:'#4F46E5' },
        { label:'검진 완료',  value:done.length+'명',      color:'#10B981' },
        { label:'이행률',     value:pct+'%',               color:pct>=80?'#10B981':pct>=50?'#F59E0B':'#EF4444' },
      ].map(k=>`
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
           padding:10px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:${k.color}">${k.value}</div>
        <div style="font-size:10px;color:#64748B;margin-top:2px">${k.label}</div>
      </div>`).join('')}
    </div>

    <!-- 진행 바 -->
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748B;margin-bottom:6px">
        <span>검진 이행률</span><span>${done.length} / ${EMPLOYEES.length}명</span>
      </div>
      <div style="background:#E2E8F0;border-radius:99px;height:10px">
        <div style="background:${pct>=80?'#10B981':pct>=50?'#F59E0B':'#EF4444'};height:10px;border-radius:99px;width:${pct}%"></div>
      </div>
    </div>

    ${pending.length ? `
    <div style="font-size:12px;font-weight:700;color:#EF4444;margin-bottom:8px">⚠️ 미수검 (${pending.length}명)</div>
    ${pending.map(e=>`
    <div style="background:var(--card-bg);border:1.5px solid #FEE2E2;border-radius:10px;
         padding:10px 12px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--text)">${e.name}</div>
        <div style="font-size:11px;color:#64748B">${e.dept}</div>
      </div>
      <span style="font-size:11px;font-weight:600;color:#EF4444;background:#FEE2E2;padding:3px 9px;border-radius:8px">미수검</span>
    </div>`).join('')}` : ''}

    ${done.length ? `
    <div style="font-size:12px;font-weight:700;color:#10B981;margin-bottom:8px;margin-top:${pending.length?'14px':'0'}">✅ 수검 완료 (${done.length}명)</div>
    ${done.map(e=>{
      const rec = records.find(r=>r.empId===e.id && r.year===YEAR) || records.find(r=>r.year===YEAR) || {};
      return `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;
         padding:10px 12px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--text)">${e.name}</div>
        <div style="font-size:11px;color:#64748B">${e.dept} · ${rec.date||''}</div>
      </div>
      <span style="font-size:11px;font-weight:600;color:#10B981;background:#D1FAE5;padding:3px 9px;border-radius:8px">
        ${rec.result||'완료'}
      </span>
    </div>`;}).join('')}` : ''}
  </div>`;
}

async function renderPerfReviewTab(c)    { await renderConnectedAdminTab(c, 'performance-review.js'); }
async function renderRecruitmentTab(c)   { await renderConnectedAdminTab(c, 'recruitment.js'); }
async function renderModuleBuilderTab(c) { await renderConnectedAdminTab(c, 'module-builder.js'); }

async function renderPeerReviewAdminTab(c)       { await renderConnectedAdminTab(c, 'peer-review-admin.js'); }
async function renderSelfAssessmentAdminTab(c)   { await renderConnectedAdminTab(c, 'self-assessment-admin.js'); }
async function renderTeamCalendarAdminTab(c)     { await renderConnectedAdminTab(c, 'team-calendar-admin.js'); }
async function renderBookAdminTab(c)             { await renderConnectedAdminTab(c, 'book-admin.js'); }
async function renderWorkshopAdminTab(c)         { await renderConnectedAdminTab(c, 'workshop-admin.js'); }
async function renderVehicleAdminTab(c)          { await renderConnectedAdminTab(c, 'vehicle-admin.js'); }
async function renderItSupportAdminTab(c)        { await renderConnectedAdminTab(c, 'it-support-admin.js'); }
async function renderAwardAdminTab(c)            { await renderConnectedAdminTab(c, 'award-admin.js'); }
async function renderPersonnelOrderAdminTab(c)   { await renderConnectedAdminTab(c, 'personnel-order-admin.js'); }
async function renderGreenAdminTab(c)            { await renderConnectedAdminTab(c, 'green-admin.js'); }
async function renderDocumentAdminTab(c)         { await renderConnectedAdminTab(c, 'document-admin.js'); }
async function renderFlexibleWorkAdminTab(c)     { await renderConnectedAdminTab(c, 'flexible-work-admin.js'); }
async function renderMentoringAdminTab(c)        { await renderConnectedAdminTab(c, 'mentoring-admin.js'); }
async function renderCompanyEventAdminTab(c)     { await renderConnectedAdminTab(c, 'company-event-admin.js'); }
async function renderCareerCoachingAdminTab(c)   { await renderConnectedAdminTab(c, 'career-coaching-admin.js'); }
async function renderVolunteerAdminTab(c)        { await renderConnectedAdminTab(c, 'volunteer-admin.js'); }
async function renderStudyGroupAdminTab(c)       { await renderConnectedAdminTab(c, 'study-group-admin.js'); }
async function renderWelfareShopAdminTab(c)      { await renderConnectedAdminTab(c, 'welfare-shop-admin.js'); }
async function renderEduSupportAdminTab(c)       { await renderConnectedAdminTab(c, 'edu-support-admin.js'); }
async function renderTenureAwardAdminTab(c)      { await renderConnectedAdminTab(c, 'tenure-award-admin.js'); }
async function renderCounselingAdminTab(c)       { await renderConnectedAdminTab(c, 'counseling-admin.js'); }
async function renderOverseasAdminTab(c)         { await renderConnectedAdminTab(c, 'overseas-admin.js'); }
async function renderSalaryContractAdminTab(c)   { await renderConnectedAdminTab(c, 'salary-contract-admin.js'); }
async function renderVoteAdminTab(c)             { await renderConnectedAdminTab(c, 'vote-admin.js'); }
async function renderHealthProgramAdminTab(c)    { await renderConnectedAdminTab(c, 'health-program-admin.js'); }
async function renderInfoUpdateAdminTab(c)       { await renderConnectedAdminTab(c, 'info-update-admin.js'); }
async function renderMarketAdminTab(c)           { await renderConnectedAdminTab(c, 'market-admin.js'); }
async function renderTrainerAdminTab(c)          { await renderConnectedAdminTab(c, 'trainer-admin.js'); }
async function renderTeamBuildingAdminTab(c)     { await renderConnectedAdminTab(c, 'team-building-admin.js'); }
async function renderContestAdminTab(c)          { await renderConnectedAdminTab(c, 'contest-admin.js'); }
async function renderLoaAdminTab(c)              { await renderConnectedAdminTab(c, 'loa-admin.js'); }
async function renderOneOnOneAdminTab(c)         { await renderConnectedAdminTab(c, 'one-on-one-admin.js'); }
async function renderLaborConsultAdminTab(c)     { await renderConnectedAdminTab(c, 'labor-consult-admin.js'); }
async function renderRemoteEquipmentAdminTab(c)  { await renderConnectedAdminTab(c, 'remote-equipment-admin.js'); }
async function renderCoffeeChatAdminTab(c)       { await renderConnectedAdminTab(c, 'coffee-chat-admin.js'); }
async function renderReviewAppealAdminTab(c)     { await renderConnectedAdminTab(c, 'review-appeal-admin.js'); }
async function renderBulletinAdminTab(c)         { await renderConnectedAdminTab(c, 'bulletin-admin.js'); }
async function renderRaffleAdminTab(c)           { await renderConnectedAdminTab(c, 'raffle-admin.js'); }
async function renderPointsAdminTab(c)           { await renderConnectedAdminTab(c, 'points-admin.js'); }
async function renderNewsletterAdminTab(c)       { await renderConnectedAdminTab(c, 'newsletter-admin.js'); }
async function renderPeerRecognitionAdminTab(c)  { await renderConnectedAdminTab(c, 'peer-recognition-admin.js'); }
async function renderBookOrderAdminTab(c)        { await renderConnectedAdminTab(c, 'book-order-admin.js'); }
async function renderSeminarAdminTab(c)          { await renderConnectedAdminTab(c, 'seminar-admin.js'); }
async function renderAnniversaryAdminTab(c)      { await renderConnectedAdminTab(c, 'anniversary-admin.js'); }
async function renderMealTicketAdminTab(c)       { await renderConnectedAdminTab(c, 'meal-ticket-admin.js'); }
async function renderIdCardAdminTab(c)           { await renderConnectedAdminTab(c, 'id-card-admin.js'); }
async function renderGoalSettingAdminTab(c)      { await renderConnectedAdminTab(c, 'goal-setting-admin.js'); }

const _connectedAdminModules = new Map();

async function renderInterviewerPortalTab(c) { await renderConnectedAdminTab(c, '../interview-portal.js'); }
async function renderDocReviewTab(c)         { await renderConnectedAdminTab(c, 'doc-review.js'); }

async function renderConnectedAdminTab(container, fileName) {
  container.innerHTML = '<div style="padding:24px"><div class="spinner"></div></div>';
  const _showErr = (msg) => {
    container.innerHTML = `<div class="empty-state" style="padding:40px">
      <div class="empty-state-icon">⚠️</div>
      <div class="empty-state-title">관리 화면을 불러오지 못했습니다</div>
      <div class="empty-state-desc">${escapeHtml(msg || '알 수 없는 오류')}</div>
      <button class="btn btn-primary" style="margin-top:16px" onclick="location.reload()">새로고침</button>
    </div>`;
  };
  try {
    // 실패한 캐시는 재시도할 수 있도록 저장 전 검증
    let module = _connectedAdminModules.get(fileName);
    if (!module) {
      module = await import(`./${fileName}`);
      if (typeof module.render !== 'function' && typeof module.mount !== 'function') {
        throw new Error(`${fileName}: render/mount 함수가 없습니다`);
      }
      _connectedAdminModules.set(fileName, module);
    }
    container.innerHTML = '<div></div>';
    const div = container.querySelector('div');
    try {
      if (typeof module.render === 'function') {
        await module.render(div);
      } else if (typeof module.mount === 'function') {
        await module.mount(div);
      }
    } catch (renderErr) {
      console.error(`[AdminTab] ${fileName} render error:`, renderErr);
      // 렌더 실패 시 캐시 제거하여 다음 접근 시 재시도 가능
      _connectedAdminModules.delete(fileName);
      _showErr(renderErr.message);
    }
  } catch (err) {
    console.error(`[AdminTab] ${fileName} load error:`, err);
    _connectedAdminModules.delete(fileName);
    _showErr(err.message);
  }
}

// ══════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
