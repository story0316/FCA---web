/**
 * menu-index.js — 전체 메뉴 Single Source of Truth
 *
 * 5탭 카테고리:
 *   contribution  — 조직기여 (성과·목표·평가·진단)
 *   growth        — 성장     (학습·경력개발·IDP)
 *   reward        — 보상     (급여·복지·포상)
 *   support       — 지원     (근태·서류·생활·안전)
 *
 * tab   필드: 해당 기능이 속하는 탭
 * roles 필드: 없으면 모든 직원 공개 / 'admin' = 관리자 전용
 * group 필드: more.js 아코디언 서브그룹 헤더
 */

export const DOMAINS = [

  /* ────────── 조직기여 ────────── */
  {
    id: 'performance', icon: '📊', nameKo: '성과 목표', name: 'Performance & Goals',
    color: '#14B8A6', bg: '#F0FDFA', tab: 'contribution',
    features: [
      { icon: '🎯', title: 'OKR',           hash: '#/okr',             group: '목표' },
      { icon: '🏁', title: '목표 설정',     hash: '#/goal-setting',    group: '목표' },
      { icon: '📋', title: '성과 리뷰',     hash: '#/reviews',         group: '평가' },
      { icon: '🔄', title: '동료 평가',     hash: '#/peer-review',     group: '평가' },
      { icon: '📝', title: '자기평가',      hash: '#/self-assessment', group: '평가' },
      { icon: '🔬', title: '수습 평가',     hash: '#/probation',       group: '평가' },
      { icon: '⚖️', title: '인사고과 이의', hash: '#/review-appeal',   group: '평가' },
    ],
  },
  {
    id: 'diagnostic', icon: '🔬', nameKo: '역량 진단', name: 'Diagnostics',
    color: '#6366F1', bg: '#EEF2FF', tab: 'contribution',
    features: [
      { icon: '🧬', title: '진단 센터',  hash: '#/diagnostics',   group: '진단' },
      { icon: '🧪', title: '진단 Kit',   hash: '#/diagnostic',    group: '진단' },
      { icon: '📋', title: '역량 평가',  hash: '#/assessment',    group: '진단' },
      { icon: '📊', title: '결과 보기',  hash: '#/results',       group: '진단' },
      { icon: '🧠', title: 'HR 역량',    hash: '#/hr-competency', group: '진단' },
      { icon: '📈', title: '분석',       hash: '#/analytics',     group: '진단' },
      { icon: '🎤', title: '인터뷰',     hash: '#/interview',     group: '진단' },
    ],
  },
  {
    id: 'pulse', icon: '💓', nameKo: '조직 소통', name: 'Pulse & Engagement',
    color: '#F59E0B', bg: '#FFFBEB', tab: 'contribution',
    features: [
      { icon: '💓', title: '펄스 서베이',   hash: '#/pulse-survey',    group: '소통·제안' },
      { icon: '📊', title: '임직원 설문',   hash: '#/employee-survey', group: '소통·제안' },
      { icon: '📋', title: '서베이',        hash: '#/survey',          group: '소통·제안' },
      { icon: '💡', title: '아이디어 제안', hash: '#/idea-box',        group: '소통·제안' },
    ],
  },

  /* ────────── 성장 ────────── */
  {
    id: 'learning', icon: '📚', nameKo: '학습 실행', name: 'Learning & Education',
    color: '#EC4899', bg: '#FDF2F8', tab: 'growth',
    features: [
      { icon: '📈', title: '내 성장',     hash: '#/growth',          group: '학습 실행' },
      { icon: '📈', title: 'IDP',         hash: '#/idp',             group: '학습 실행' },
      { icon: '🎓', title: '사내 교육',   hash: '#/training',        group: '학습 실행' },
      { icon: '📚', title: '법정교육',    hash: '#/legal-edu',       group: '학습 실행' },
      { icon: '🏅', title: '자격증',      hash: '#/certification',   group: '학습 실행' },
      { icon: '💳', title: '교육비 지원', hash: '#/edu-support',     group: '학습 실행' },
      { icon: '🗣️', title: '어학 수강',   hash: '#/language-class',  group: '학습 실행' },
      { icon: '🏕️', title: '워크샵',      hash: '#/workshop',        group: '학습 실행' },
      { icon: '🎤', title: '세미나',      hash: '#/seminar',         group: '학습 실행' },
      { icon: '🧩', title: '모듈',        hash: '#/modules',         group: '학습 실행' },
    ],
  },
  {
    id: 'career', icon: '🗺️', nameKo: '경력 개발', name: 'Career Development',
    color: '#8B5CF6', bg: '#F5F3FF', tab: 'growth',
    features: [
      { icon: '🤝', title: '멘토링',          hash: '#/mentoring',       group: '경력 개발' },
      { icon: '🔗', title: '멘토 매칭',       hash: '#/mentor-matching', group: '경력 개발' },
      { icon: '🎯', title: '커리어 코칭',     hash: '#/career-coaching', group: '경력 개발' },
      { icon: '🧠', title: '스킬 인벤토리',  hash: '#/skill-inventory', group: '경력 개발' },
      { icon: '🗺️', title: '경력 개발 경로', hash: '#/career-path',     group: '경력 개발' },
      { icon: '🤝', title: '1:1 미팅',        hash: '#/one-on-one',      group: '경력 개발' },
    ],
  },

  /* ────────── 보상 ────────── */
  {
    id: 'compensation', icon: '💰', nameKo: '급여 보상', name: 'Compensation',
    color: '#10B981', bg: '#ECFDF5', tab: 'reward',
    features: [
      { icon: '💰', title: '급여명세서',      hash: '#/payslip',          group: '급여·보상' },
      { icon: '💵', title: '급여 계산',       hash: '#/salary-calc',      group: '급여·보상' },
      { icon: '📑', title: '연봉 계약',       hash: '#/salary-contract',  group: '급여·보상' },
      { icon: '📈', title: '연봉 인상 요청',  hash: '#/salary-raise',     group: '급여·보상' },
      { icon: '📊', title: '스톡옵션',        hash: '#/stock-option',     group: '급여·보상' },
    ],
  },
  {
    id: 'benefits', icon: '🎁', nameKo: '복지 혜택', name: 'Benefits & Welfare',
    color: '#3B82F6', bg: '#EFF6FF', tab: 'reward',
    features: [
      { icon: '🎁', title: '복리후생',         hash: '#/benefits',         group: '복지' },
      { icon: '✅', title: '복지 혜택 등록',  hash: '#/benefit-enroll',   group: '복지' },
      { icon: '💎', title: '복지 포인트',     hash: '#/welfare-points',   group: '복지' },
      { icon: '🛒', title: '복지 포인트 샵',  hash: '#/welfare-shop',     group: '복지' },
      { icon: '🎀', title: '선택 복지',       hash: '#/flexible-benefit', group: '복지' },
    ],
  },
  {
    id: 'recognition', icon: '🏆', nameKo: '인정 포상', name: 'Recognition & Awards',
    color: '#F97316', bg: '#FFF7ED', tab: 'reward',
    features: [
      { icon: '👏', title: '칭찬 보내기',   hash: '#/kudos',             group: '인정·포상' },
      { icon: '🌟', title: '동료 칭찬',     hash: '#/peer-recognition',  group: '인정·포상' },
      { icon: '🏆', title: '포상 추천',     hash: '#/award',             group: '인정·포상' },
      { icon: '🎖️', title: '근속 포상',     hash: '#/tenure-award',      group: '인정·포상' },
      { icon: '🎊', title: '경조사 지원',   hash: '#/family-event',      group: '인정·포상' },
      { icon: '🎰', title: '사내 추첨',     hash: '#/raffle',            group: '인정·포상' },
      { icon: '💳', title: '포인트 내역',   hash: '#/points-history',    group: '인정·포상' },
    ],
  },

  /* ────────── 지원 ────────── */
  {
    id: 'time', icon: '⏱️', nameKo: '근태 관리', name: 'Time & Attendance',
    color: '#EF4444', bg: '#FEF2F2', tab: 'support',
    features: [
      { icon: '📍', title: '근태',            hash: '#/attendance',       group: '출근·휴가' },
      { icon: '⏰', title: '출퇴근',          hash: '#/commute',          group: '출근·휴가' },
      { icon: '📅', title: '휴가',            hash: '#/leave',            group: '출근·휴가' },
      { icon: '👶', title: '모성보호',        hash: '#/parental-leave',   group: '출근·휴가' },
      { icon: '🏖️', title: '휴직 신청',      hash: '#/loa',              group: '출근·휴가' },
      { icon: '⌚', title: '연장근무',        hash: '#/overtime-request', group: '근무 형태' },
      { icon: '🕐', title: '유연근무',        hash: '#/flexible-work',    group: '근무 형태' },
      { icon: '🏠', title: '재택근무',        hash: '#/remote-work',      group: '근무 형태' },
      { icon: '🌏', title: '해외 원격근무',  hash: '#/work-from-abroad', group: '근무 형태' },
    ],
  },
  {
    id: 'expense', icon: '💸', nameKo: '경비 출장', name: 'Expense & Travel',
    color: '#0EA5E9', bg: '#F0F9FF', tab: 'support',
    features: [
      { icon: '💸', title: '경비 정산',  hash: '#/expense',         group: '경비·출장' },
      { icon: '✈️', title: '출장 신청',  hash: '#/business-trip',   group: '경비·출장' },
      { icon: '🚗', title: '차량 신청',  hash: '#/vehicle-request', group: '경비·출장' },
      { icon: '🅿️', title: '주차 관리', hash: '#/parking',         group: '경비·출장' },
      { icon: '🚌', title: '통근 셔틀',  hash: '#/shuttle',         group: '경비·출장' },
    ],
  },
  {
    id: 'hr_docs', icon: '📄', nameKo: '인사 서류', name: 'HR Documents',
    color: '#6366F1', bg: '#EEF2FF', tab: 'support',
    features: [
      { icon: '✏️', title: '개인정보 변경',   hash: '#/info-update',       group: '인사 서류' },
      { icon: '🆘', title: '비상연락망',      hash: '#/emergency-contact', group: '인사 서류' },
      { icon: '📄', title: '서류 발급',       hash: '#/document-request',  group: '인사 서류' },
      { icon: '📜', title: '증명서 발급',     hash: '#/certificate',       group: '인사 서류' },
      { icon: '🔄', title: '사내 이동 신청', hash: '#/internal-transfer', group: '인사 서류' },
      { icon: '🪪', title: '명함 신청',       hash: '#/business-card',     group: '인사 서류' },
      { icon: '🪪', title: '사원증',          hash: '#/id-card',           group: '인사 서류' },
    ],
  },
  {
    id: 'life', icon: '🌿', nameKo: '생활 편의', name: 'Life & Convenience',
    color: '#10B981', bg: '#ECFDF5', tab: 'support',
    features: [
      { icon: '✅', title: '전자결재',      hash: '#/approval',     group: '생활 편의' },
      { icon: '📢', title: '공지사항',      hash: '#/notice',       group: '생활 편의' },
      { icon: '📌', title: '게시판',        hash: '#/bulletin',     group: '생활 편의' },
      { icon: '🍱', title: '식권',          hash: '#/meal-ticket',  group: '생활 편의' },
      { icon: '📚', title: '도서 신청',     hash: '#/book-order',   group: '생활 편의' },
      { icon: '📦', title: '비품 신청',     hash: '#/supplies',     group: '생활 편의' },
      { icon: '💻', title: 'IT 지원',       hash: '#/it-support',   group: '생활 편의' },
      { icon: '🖥️', title: '자산 관리',    hash: '#/asset',        group: '생활 편의' },
      { icon: '🏢', title: '회의실 예약',  hash: '#/room-booking', group: '생활 편의' },
      { icon: '👶', title: '보육 지원',     hash: '#/childcare',    group: '생활 편의' },
      { icon: '🚚', title: '이사 지원',     hash: '#/relocation',   group: '생활 편의' },
    ],
  },
  {
    id: 'wellbeing', icon: '🩺', nameKo: '건강·커뮤니티', name: 'Wellbeing & Community',
    color: '#14B8A6', bg: '#F0FDFA', tab: 'support',
    features: [
      { icon: '🩺', title: '건강검진',        hash: '#/health-exam',       group: '건강·웰니스' },
      { icon: '🏋️', title: '건강 프로그램',  hash: '#/health-program',    group: '건강·웰니스' },
      { icon: '💙', title: '마음건강 체크인', hash: '#/wellness-check',    group: '건강·웰니스' },
      { icon: '🧠', title: '심리 상담',       hash: '#/counseling',        group: '건강·웰니스' },
      { icon: '🎪', title: '사내 동호회',     hash: '#/club',              group: '커뮤니티' },
      { icon: '📖', title: '스터디 그룹',     hash: '#/study-group',       group: '커뮤니티' },
      { icon: '☕', title: '커피챗',          hash: '#/coffee-chat',       group: '커뮤니티' },
      { icon: '🍽️', title: '팀 점심',         hash: '#/team-lunch',        group: '커뮤니티' },
      { icon: '🌿', title: '그린 활동',       hash: '#/green-activity',    group: '커뮤니티' },
      { icon: '🚨', title: '안전사고 보고',  hash: '#/safety-report',     group: '안전·신고' },
      { icon: '🛡️', title: '익명신고',        hash: '#/harassment-report', group: '안전·신고' },
    ],
  },

  /* ────────── 관리자 전용 ────────── */
  {
    id: 'talent', icon: '🎯', nameKo: '인재 확보', name: 'Talent Acquisition',
    color: '#6366F1', bg: '#EEF2FF', tab: 'support',
    features: [
      { icon: '📢', title: '채용공고',     hash: '#/jobs',              group: '채용' },
      { icon: '📋', title: '지원자 현황',  hash: '#/applicant',         group: '채용', roles: ['admin'] },
      { icon: '🧪', title: '인적성 관리',  hash: '#/aptitude',          group: '채용', roles: ['admin'] },
      { icon: '🤝', title: '직원 추천',    hash: '#/employee-referral', group: '채용' },
    ],
  },
  {
    id: 'onboarding', icon: '🚀', nameKo: '입·퇴사 관리', name: 'Onboarding & Offboarding',
    color: '#10B981', bg: '#ECFDF5', tab: 'support',
    features: [
      { icon: '🎉', title: '온보딩',       hash: '#/onboarding',       group: '입사' },
      { icon: '🪑', title: '데스크 셋업',  hash: '#/desk-setup',       group: '입사' },
      { icon: '👕', title: '유니폼 신청',  hash: '#/uniform',          group: '입사' },
      { icon: '💻', title: '재택 장비',    hash: '#/remote-equipment', group: '입사' },
      { icon: '👋', title: '오프보딩',     hash: '#/offboarding',      group: '퇴사' },
    ],
  },
  {
    id: 'people', icon: '🏢', nameKo: '인사 조직', name: 'People & Organization',
    color: '#F59E0B', bg: '#FFFBEB', tab: 'support',
    features: [
      { icon: '🏢', title: '조직도',   hash: '#/org-chart',       group: '조직' },
      { icon: '📋', title: '인사발령', hash: '#/personnel-order', group: '조직', roles: ['admin'] },
    ],
  },
];

// 검색용 flat 인덱스
export const MENU_INDEX = DOMAINS.flatMap(d =>
  d.features.map(f => ({
    ...f,
    domain:      d.nameKo,
    domainColor: d.color,
    domainBg:    d.bg,
    domainId:    d.id,
    tab:         f.tab || d.tab,
  }))
);
