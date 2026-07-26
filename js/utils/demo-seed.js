/**
 * demo-seed.js — 사용자별 독립 더미데이터 초기화
 *
 * 로그인 후 호출. userId별로 각 LS 키에 시드 데이터가 없으면 생성.
 * 기존 데이터는 건드리지 않음 (멱등적).
 *
 * 사용:
 *   import { seedDemoDataForUser } from './utils/demo-seed.js';
 *   seedDemoDataForUser(user);   // 로그인 직후 한 번
 */

import { buildPayslip } from './payslip-engine.js';

const TODAY = new Date().toISOString().slice(0, 10);

// 시드 데이터 버전 — 필드 구조 변경 시 올려서 기존 세션 재시드 강제
// v5: Phase 182 SEED_KEYS 대폭 확장 (70개+ 페이지 키 추가, 재시드 정리 대상 완결)
const SEED_VERSION = 'v5';
const SEED_KEYS = [
  // 핵심 시드 키 (demo-seed.js에서 직접 생성)
  'hr_okr_goals', 'hr_perf_reviews', 'hr_one_on_ones', 'hr_leave_requests',
  'hr_attendance', 'hr_commute_logs', 'hr_work_logs', 'hr_payslips',
  'hr_self_assessments', 'hr_peer_reviews', 'hr_idp_items',
  'hr_growth_history', 'hr_pulse_responses', 'hr_notifications',
  // 페이지 동적 데모 키 (Phase 163–166)
  'hr_salary_contracts', 'hr_points_history', 'hr_assets', 'hr_anniversaries',
  'hr_book_orders', 'hr_expense_claims', 'hr_health_exams', 'hr_id_card_requests',
  'hr_childcare_support', 'hr_language_classes', 'hr_flexible_benefits',
  'hr_goals', 'hr_meal_tickets', 'hr_parking_requests', 'hr_patents',
  'hr_personnel_orders', 'hr_relocation_requests', 'hr_shuttle_subscriptions',
  'hr_stock_options', 'hr_team_lunches', 'hr_tenure_awards', 'hr_trainers',
  'hr_uniform_requests', 'hr_work_from_abroad', 'hr_review_appeals', 'hr_ideas',
  // 신규 페이지 키 (Phase 173 — 사용자별 신청/등록 데이터)
  'hr_approvals', 'hr_benefit_enrollments', 'hr_business_cards',
  'hr_certificates', 'hr_clubs', 'hr_counseling_requests',
  'hr_desk_setups', 'hr_document_requests', 'hr_edu_support',
  'hr_expenses', 'hr_family_events', 'hr_flexible_work',
  'hr_green_activities', 'hr_info_updates', 'hr_internal_transfers',
  'hr_it_tickets', 'hr_overseas_requests', 'hr_overtime_requests',
  'hr_probation', 'hr_remote_work', 'hr_room_bookings',
  'hr_safety_reports', 'hr_skill_inventory', 'hr_team_building',
  'hr_team_calendar', 'hr_work_reports', 'hr_workshops',
  // Phase 182 — 추가 페이지 키 (재시드 시 정리 대상)
  'hr_award_nominations', 'hr_books', 'hr_book_requests', 'hr_bulletin_posts',
  'hr_business_trips', 'hr_coaching_requests', 'hr_career_paths',
  'hr_certifications', 'hr_childcare', 'hr_coffee_chat_profiles', 'hr_coffee_chat_matches',
  'hr_company_events', 'hr_event_rsvp', 'hr_contests', 'hr_contest_entries',
  'hr_emergency_contacts', 'hr_referrals', 'hr_emp_surveys', 'hr_emp_survey_responses',
  'hr_okr_checkins', 'hr_my_okr', 'hr_team_okr', 'hr_harassment_reports',
  'hr_health_checkups', 'hr_health_programs', 'hr_hp_enrollments',
  'hr_kudos', 'hr_labor_consults', 'hr_loa_requests', 'hr_lunch_orders',
  'hr_market_items', 'hr_meeting_notes', 'hr_mentor_profiles', 'hr_mentor_matches',
  'hr_mentoring_pairs', 'hr_newsletter_subs', 'hr_notices',
  'hr_offboarding_progress', 'hr_offboarding_handovers',
  'hr_onboarding_tasks', 'hr_onboarding_progress', 'hr_parental_leave_requests',
  'hr_peer_recognitions', 'hr_peer_cycles', 'hr_projects', 'hr_project_applies',
  'hr_raffles', 'hr_raffle_tickets', 'hr_remote_equipment',
  'hr_salary_raise_requests', 'hr_seminars', 'hr_seminar_enrollments',
  'hr_study_groups', 'hr_study_members', 'hr_supply_requests',
  'hr_internal_surveys', 'hr_survey_responses_v2', 'hr_trainer_applies',
  'hr_training_records', 'hr_vehicles', 'hr_vehicle_requests',
  'hr_volunteer_acts', 'hr_volunteer_enroll', 'hr_votes', 'hr_vote_ballots',
  'hr_welfare_points', 'hr_welfare_orders', 'hr_welfare_points_balance',
  'hr_wellness_checkins', 'hr_ws_enrollments', 'hr_asset_loans',
  'hr_recognitions', 'hr_peer_recognitions',
];

function _clearUserSeedData(userId) {
  SEED_KEYS.forEach(key => {
    try {
      const all = JSON.parse(localStorage.getItem(key) || '[]');
      const filtered = all.filter(
        i => i.userId !== userId && i.empId !== userId &&
             i.revieweeId !== userId && i.user_id !== userId
      );
      localStorage.setItem(key, JSON.stringify(filtered));
    } catch {}
  });
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function daysLater(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function thisYear() { return new Date().getFullYear(); }
function thisMonth() { return String(new Date().getMonth() + 1).padStart(2, '0'); }

// ── 사용자별 데이터 프로필 ────────────────────────────────────

const USER_PROFILES = {
  TEST_EMP_001: {
    name_ko: '김지훈', dept: '개발팀', position: '선임 개발자', level: 'L2',
    hireDate: '2023-03-15', baseSalary: 4800000,
    goalTheme: 'AI 기반 제품 개선',
    peerPartner: '이수연', peerPartnerId: 'TEST_EMP_002',
    managerName: '박준혁', managerId: 'TEST_EMP_003',
  },
  TEST_EMP_002: {
    name_ko: '이수연', dept: 'HR팀', position: 'HR 매니저', level: 'L3',
    hireDate: '2021-07-01', baseSalary: 5500000,
    goalTheme: 'HR 디지털 전환 로드맵',
    peerPartner: '박준혁', peerPartnerId: 'TEST_EMP_003',
    managerName: '김지훈', managerId: 'TEST_EMP_001',
  },
  TEST_EMP_003: {
    name_ko: '박준혁', dept: '마케팅팀', position: '마케팅 기획', level: 'L1',
    hireDate: '2024-01-10', baseSalary: 3800000,
    goalTheme: '브랜드 인지도 2배 향상',
    peerPartner: '김지훈', peerPartnerId: 'TEST_EMP_001',
    managerName: '이수연', managerId: 'TEST_EMP_002',
  },
};

// ── 헬퍼 ─────────────────────────────────────────────────────

function _get(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function _getObj(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
}

function _set(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

function _hasUserData(key, userId, field = 'userId') {
  const items = _get(key);
  return items.some(i => i[field] === userId || i.empId === userId || i.user_id === userId);
}

// ── 시드 함수들 ──────────────────────────────────────────────

function seedOkrGoals(userId, profile) {
  if (_hasUserData('hr_okr_goals', userId)) return;
  const year = thisYear();
  const goals = [
    {
      id: `G_${userId}_1`, userId,
      period: 'H1', year,
      objective: profile.goalTheme,
      status: 'IN_PROGRESS',
      createdAt: daysAgo(60),
      keyResults: [
        { id: `KR_${userId}_1a`, text: '핵심 지표 20% 개선', progress: 65, unit: '%' },
        { id: `KR_${userId}_1b`, text: '팀 역량 교육 3회 완료', progress: 100, unit: '%' },
        { id: `KR_${userId}_1c`, text: '분기 리뷰 문서화 100%', progress: 40, unit: '%' },
      ],
    },
    {
      id: `G_${userId}_2`, userId,
      period: 'H1', year,
      objective: '개인 역량 강화 — 자기주도 학습',
      status: 'IN_PROGRESS',
      createdAt: daysAgo(45),
      keyResults: [
        { id: `KR_${userId}_2a`, text: '온라인 과정 2개 이수', progress: 50, unit: '%' },
        { id: `KR_${userId}_2b`, text: '월간 1:1 피드백 세션 6회', progress: 83, unit: '%' },
      ],
    },
  ];
  const existing = _get('hr_okr_goals');
  _set('hr_okr_goals', [...existing, ...goals]);
}

function seedPerfReviews(userId, profile) {
  if (_hasUserData('hr_perf_reviews', userId)) return;
  const year = thisYear();
  const reviews = [
    {
      id: `PR_${userId}_1`, userId,
      cycle: 'H1', reviewerType: 'self', status: 'COMPLETED',
      date: daysAgo(90), submittedAt: new Date(Date.now() - 90 * 86400000).toISOString(),
      goalAchievement: 4, competencyScore: 4, competencyDemo: 4,
      keyAchievements: `${profile.dept} 핵심 프로젝트 성공적 기여. 동료 협업 우수.`,
      highlights: `${profile.dept} 핵심 프로젝트 성공적 기여. 동료 협업 우수.`,
      improvements: '문서화 습관 개선 필요. 일정 관리 강화.',
      nextGoals: `${year}년 ${profile.goalTheme} 집중 추진`,
    },
    {
      id: `PR_${userId}_2`, userId,
      cycle: 'H2', reviewerType: 'self', status: 'COMPLETED',
      date: daysAgo(180), submittedAt: new Date(Date.now() - 180 * 86400000).toISOString(),
      goalAchievement: 3, competencyScore: 4, competencyDemo: 4,
      keyAchievements: '신규 업무 빠른 적응. 팀원 지원 활발.',
      highlights: '신규 업무 빠른 적응. 팀원 지원 활발.',
      improvements: '우선순위 조율 역량 향상 필요.',
      nextGoals: '역량 진단 완료 후 IDP 수립',
    },
  ];
  const existing = _get('hr_perf_reviews');
  _set('hr_perf_reviews', [...existing, ...reviews]);
}

function seedOneOnOnes(userId, profile) {
  if (_hasUserData('hr_one_on_ones', userId, 'empId')) return;
  const meetings = [
    {
      id: `OO_${userId}_1`, empId: userId,
      partner: profile.managerName, partnerId: profile.managerId,
      date: daysAgo(7),
      agenda: '분기 목표 점검 및 하반기 계획',
      notes: '현재 OKR 진행률 양호. 하반기 핵심 과제 우선순위 조정 합의.',
      actionItems: [
        { id: `AI_${userId}_1a`, text: 'IDP 업데이트 제출', done: false },
        { id: `AI_${userId}_1b`, text: '프로젝트 킥오프 자료 준비', done: true },
      ],
    },
    {
      id: `OO_${userId}_2`, empId: userId,
      partner: profile.managerName, partnerId: profile.managerId,
      date: daysAgo(21),
      agenda: '역량 개발 계획 논의',
      notes: '강점/보완 영역 파악. 외부 교육 지원 신청 결정.',
      actionItems: [
        { id: `AI_${userId}_2a`, text: '교육 지원 신청서 작성', done: true },
      ],
    },
  ];
  const existing = _get('hr_one_on_ones');
  _set('hr_one_on_ones', [...existing, ...meetings]);
}

function seedLeaveRequests(userId, profile) {
  if (_hasUserData('hr_leave_requests', userId)) return;
  const requests = [
    {
      id: `LR_${userId}_1`, userId,
      leaveType: '연차', startDate: daysAgo(30), endDate: daysAgo(29),
      days: 2, reason: '개인 사유', status: 'approved',
      appliedAt: daysAgo(33), approvedAt: daysAgo(32),
    },
    {
      id: `LR_${userId}_2`, userId,
      leaveType: '연차', startDate: daysLater(14), endDate: daysLater(15),
      days: 2, reason: '가족 행사', status: 'pending',
      appliedAt: daysAgo(2),
    },
    {
      id: `LR_${userId}_3`, userId,
      leaveType: '반차', startDate: daysAgo(10), endDate: daysAgo(10),
      days: 0.5, reason: '병원 방문', status: 'approved',
      appliedAt: daysAgo(11), approvedAt: daysAgo(11),
    },
  ];
  const existing = _get('hr_leave_requests');
  _set('hr_leave_requests', [...existing, ...requests]);
}

function seedAttendance(userId, profile) {
  const existing = JSON.parse(localStorage.getItem('hr_attendance') || '[]');
  const hasData = existing.some(r => (r.userId || 'demo') === userId);
  if (hasData) return;

  const records = [];
  for (let i = 1; i <= 10; i++) {
    const d = new Date();
    const offset = i + (d.getDay() === 0 ? 1 : d.getDay() === 6 ? 2 : 0);
    d.setDate(d.getDate() - offset);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const dateKey = d.toISOString().slice(0, 10);
    const inH = 8 + Math.floor(Math.random() * 2);
    const inM = Math.floor(Math.random() * 30);
    const outH = inH + 8 + Math.floor(Math.random() * 2);
    const outM = Math.floor(Math.random() * 60);
    const inTs  = new Date(d.getFullYear(), d.getMonth(), d.getDate(), inH, inM).getTime();
    const outTs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), outH, outM).getTime();
    records.push({
      date: dateKey, userId,
      checkIn:  { ts: inTs,  time: `${String(inH).padStart(2,'0')}:${String(inM).padStart(2,'0')}`,  address: '사무실' },
      checkOut: { ts: outTs, time: `${String(outH).padStart(2,'0')}:${String(outM).padStart(2,'0')}`, address: '사무실' },
    });
  }
  const all = [...existing, ...records];
  localStorage.setItem('hr_attendance', JSON.stringify(all));
}

function seedCommuteLogs(userId, profile) {
  const existing = _get('hr_commute_logs');
  if (existing.some(l => l.empId === userId)) return;
  const logs = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const dateKey = d.toISOString().slice(0, 10);
    const inH = 8 + Math.floor(Math.random() * 2);
    const inM = Math.floor(Math.random() * 30);
    logs.push({
      id: `CL_${userId}_${i}`,
      empId: userId,
      date: dateKey,
      workType: 'office',
      checkIn: `${String(inH).padStart(2,'0')}:${String(inM).padStart(2,'0')}`,
      checkOut: `${String(inH + 9).padStart(2,'0')}:00`,
    });
  }
  _set('hr_commute_logs', [...existing, ...logs]);
}

function seedWorkLogs(userId, profile) {
  if (_hasUserData('hr_work_logs', userId)) return;
  const logs = [
    {
      id: `WL_${userId}_1`, userId,
      date: daysAgo(1),
      title: `${profile.goalTheme} 관련 진행 보고`,
      content: '오늘 주요 업무: 주간 진행 보고서 작성, 팀 미팅 참여, 코드 리뷰 3건',
      category: '업무보고',
    },
    {
      id: `WL_${userId}_2`, userId,
      date: daysAgo(2),
      title: '팀 협업 회의 및 계획 수립',
      content: '분기 목표 점검 회의 참석. 다음 주 작업 계획 수립 완료.',
      category: '회의',
    },
    {
      id: `WL_${userId}_3`, userId,
      date: daysAgo(5),
      title: '개인 역량 교육 수료',
      content: `온라인 교육 과정 1개 수료. ${profile.dept} 관련 최신 트렌드 학습.`,
      category: '교육',
    },
  ];
  const existing = _get('hr_work_logs');
  _set('hr_work_logs', [...existing, ...logs]);
}

function seedPayslips(userId, profile) {
  if (_hasUserData('hr_payslips', userId)) return;
  const base = profile.baseSalary;
  const salaryRecord = {
    baseSalary: base,
    allowances: [
      { id: 'meal',     label: '식대보조금', amount: 100_000, isFixed: true },
      { id: 'position', label: '직책수당',   amount: profile.level === 'L3' ? 300_000 : profile.level === 'L2' ? 200_000 : 100_000, isFixed: true },
    ],
  };
  const slips = [];
  for (let m = 0; m < 3; m++) {
    const d = new Date();
    d.setMonth(d.getMonth() - (m + 1));
    const year  = d.getFullYear();
    const month = d.getMonth() + 1;
    const ovtH  = m === 1 ? 10 : m === 2 ? 5 : 0;
    const slip  = buildPayslip(userId, year, month, 176, ovtH, 0, 0, salaryRecord);
    slip.id       = `PS_${userId}_${year}_${String(month).padStart(2,'0')}`;
    slip.issuedAt = `${year}-${String(month).padStart(2,'0')}-25T09:00:00`;
    slip.isRead   = m > 0;
    slip.confirmedByEmployee = m > 0;
    slips.push(slip);
  }
  const existing = _get('hr_payslips');
  _set('hr_payslips', [...existing, ...slips]);
}

function seedSelfAssessments(userId, profile) {
  if (_hasUserData('hr_self_assessments', userId, 'empId')) return;
  const assessments = [
    {
      id: `SA_${userId}_1`, empId: userId,
      period: `${thisYear()}-H1`,
      submittedAt: daysAgo(14),
      scores: { leadership: 4, communication: 4, problemSolving: 3, teamwork: 5, adaptability: 4 },
      strengths: `${profile.dept} 내 협업 역량과 커뮤니케이션을 강점으로 꼽습니다.`,
      improvements: '데이터 기반 의사결정 능력 향상이 필요합니다.',
      goals: `${profile.goalTheme} 관련 핵심 성과 달성`,
    },
  ];
  const existing = _get('hr_self_assessments');
  _set('hr_self_assessments', [...existing, ...assessments]);
}

function seedPeerReviews(userId, profile) {
  if (_hasUserData('hr_peer_reviews', userId, 'revieweeId')) return;
  const COMPETENCIES = ['communication', 'collaboration', 'problemSolving', 'initiative', 'reliability'];
  const scores = {};
  COMPETENCIES.forEach(c => { scores[c] = 3 + Math.floor(Math.random() * 2); });
  const avg = Object.values(scores).reduce((s, v) => s + v, 0) / COMPETENCIES.length;
  const reviews = [
    {
      id: `PEER_${userId}_recv_1`,
      reviewerId: profile.peerPartnerId,
      reviewerName: profile.peerPartner,
      revieweeId: userId,
      revieweeName: profile.name_ko,
      cycleId: `CYCLE_${thisYear()}_H1`,
      date: daysAgo(20),
      scores,
      overallScore: parseFloat(avg.toFixed(1)),
      comment: `${profile.name_ko}님은 팀 프로젝트에 적극 기여하며 신뢰할 수 있는 동료입니다.`,
    },
  ];
  const existing = _get('hr_peer_reviews');
  _set('hr_peer_reviews', [...existing, ...reviews]);
}

function seedIdpItems(userId, profile) {
  if (_hasUserData('hr_idp_items', userId)) return;
  const items = [
    {
      id: `IDP_${userId}_1`, userId,
      competency_name_ko: '커뮤니케이션',
      resource_title_ko: '비즈니스 글쓰기 마스터 클래스',
      action_type: '온라인 강의',
      priority: 'high',
      status: 'in_progress',
      target_date: new Date(Date.now() + 30 * 86400000).toISOString(),
      created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    },
    {
      id: `IDP_${userId}_2`, userId,
      competency_name_ko: '문제해결',
      resource_title_ko: '데이터 기반 의사결정 워크북',
      action_type: '도서 학습',
      priority: 'medium',
      status: 'not_started',
      target_date: new Date(Date.now() + 60 * 86400000).toISOString(),
      created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    },
    {
      id: `IDP_${userId}_3`, userId,
      competency_name_ko: '리더십',
      resource_title_ko: '사내 멘토링 프로그램 참여',
      action_type: '멘토링',
      priority: 'medium',
      status: 'completed',
      target_date: new Date(Date.now() - 10 * 86400000).toISOString(),
      created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
      completed_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
  ];
  const existing = _get('hr_idp_items');
  _set('hr_idp_items', [...existing, ...items]);
}

function seedGrowthHistory(userId) {
  const key = 'hr_growth_history';
  const existing = _get(key);
  if (existing.some(h => h.userId === userId)) return;
  const history = [];
  for (let i = 3; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i * 2);
    history.push({
      userId,
      savedAt: d.toISOString(),
      final_score: (3.0 + i * 0.2 + Math.random() * 0.3).toFixed(2),
      scores: [
        { competency_name_ko: '커뮤니케이션', as_is_score: 3 + i * 0.3, to_be_score: 4.5 },
        { competency_name_ko: '문제해결', as_is_score: 3.2 + i * 0.2, to_be_score: 4.0 },
        { competency_name_ko: '협업', as_is_score: 3.5 + i * 0.1, to_be_score: 4.5 },
        { competency_name_ko: '리더십', as_is_score: 2.8 + i * 0.3, to_be_score: 4.0 },
      ],
    });
  }
  _set(key, [...existing, ...history]);
}

function seedPulseSurveyResponses(userId) {
  const key = 'hr_pulse_responses';
  const existing = _get(key);
  if (existing.some(r => r.userId === userId)) return;
  const responses = [
    {
      id: `PULSE_${userId}_1`, userId,
      weekKey: daysAgo(7).slice(0, 8) + '01',
      submittedAt: daysAgo(7),
      scores: { engagement: 4, workload: 3, management: 4, growth: 4, wellbeing: 3 },
      comment: '업무 강도는 적절하지만 성장 기회를 더 원합니다.',
    },
  ];
  _set(key, [...existing, ...responses]);
}

function seedNotifications(userId, profile) {
  const key = 'hr_notifications';
  const existing = _get(key);
  if (existing.some(n => n.userId === userId)) return;
  const notifs = [
    {
      id: `NOTIF_${userId}_1`, userId,
      type: 'leave_approved',
      title: '휴가 신청 승인',
      message: `${daysAgo(30)} 신청하신 연차 휴가가 승인되었습니다.`,
      isRead: true,
      createdAt: daysAgo(29),
    },
    {
      id: `NOTIF_${userId}_2`, userId,
      type: 'peer_review_reminder',
      title: '동료 평가 마감 안내',
      message: `${profile.peerPartner}님의 동료 평가 마감이 3일 남았습니다.`,
      isRead: false,
      createdAt: daysAgo(1),
    },
    {
      id: `NOTIF_${userId}_3`, userId,
      type: 'payslip_issued',
      title: '급여명세서 발급',
      message: `${thisYear()}년 ${thisMonth()}월 급여명세서가 발급되었습니다.`,
      isRead: false,
      createdAt: daysAgo(3),
    },
  ];
  _set(key, [...existing, ...notifs]);
}

// ── 메인 진입점 ──────────────────────────────────────────────

export function seedDemoDataForUser(user) {
  if (!user?.id) return;
  const userId = user.id;
  const flagKey = `hr_demo_seeded_${userId}`;

  // 버전이 다르면 기존 시드 데이터 제거 후 재시드
  if (localStorage.getItem(flagKey) && localStorage.getItem(flagKey) !== SEED_VERSION) {
    _clearUserSeedData(userId);
    localStorage.removeItem(flagKey);
  }

  const profile = USER_PROFILES[userId];
  if (!profile) {
    _seedMinimal(userId, user);
    return;
  }

  seedOkrGoals(userId, profile);
  seedPerfReviews(userId, profile);
  seedOneOnOnes(userId, profile);
  seedLeaveRequests(userId, profile);
  seedAttendance(userId, profile);
  seedCommuteLogs(userId, profile);
  seedWorkLogs(userId, profile);
  seedPayslips(userId, profile);
  seedSelfAssessments(userId, profile);
  seedPeerReviews(userId, profile);
  seedIdpItems(userId, profile);
  seedGrowthHistory(userId);
  seedPulseSurveyResponses(userId);
  seedNotifications(userId, profile);

  localStorage.setItem(flagKey, SEED_VERSION);
}

function _seedMinimal(userId, user) {
  const flagKey = `hr_demo_seeded_${userId}`;
  if (localStorage.getItem(flagKey) === SEED_VERSION) return;
  const profile = {
    name_ko: user.name_ko || user.name || '직원',
    dept: user.dept || '일반',
    position: user.position || '',
    baseSalary: 4000000,
    goalTheme: '업무 역량 강화',
    peerPartner: '관리자', peerPartnerId: 'TEST_EMP_001',
    managerName: '관리자', managerId: 'TEST_EMP_001',
  };
  seedOkrGoals(userId, profile);
  seedLeaveRequests(userId, profile);
  seedPayslips(userId, profile);
  seedNotifications(userId, profile);
  localStorage.setItem(flagKey, SEED_VERSION);
}
