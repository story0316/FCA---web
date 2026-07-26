/**
 * demo_jobs.js – Static demo job postings for Phase 3
 */

export const DEMO_JOB_POSTINGS = [
  {
    id: 'JOB_001',
    org_id: 'ORG001',
    title: 'HR Business Partner',
    dept: 'People & Culture팀',
    status: 'OPEN',
    published_at: '2025-05-01',
    deadline: '2026-06-30',
    required_competencies: ['COMP_CORE_COMM', 'COMP_FUNC_OD', 'COMP_FUNC_TA'],
    tags: ['HRBP', '조직개발', '인재확보'],
    jd_summary: '조직 성장을 함께할 HRBP를 모집합니다. 구성원 여정 설계부터 성과 관리까지 HR 전반을 담당합니다.',
    jd_full: `
■ 담당 업무
- 사업부 파트너로서 인력 계획, 채용, 조직 진단 지원
- 성과 관리 및 역량 개발 프로그램 운영
- 조직 문화 진단 및 변화 관리 프로젝트 수행

■ 자격 요건
- HR 관련 업무 3년 이상
- 커뮤니케이션 및 이해관계자 관리 역량
- 데이터 기반 의사결정 경험

■ 우대 사항
- 스타트업 HR 경험
- HRIS 시스템 운영 경험
    `.trim(),
  },
  {
    id: 'JOB_002',
    org_id: 'ORG001',
    title: 'C&B 전문가 (보상·복리후생)',
    dept: 'HR팀',
    status: 'OPEN',
    published_at: '2025-05-10',
    deadline: '2026-06-15',
    required_competencies: ['COMP_CORE_DATA', 'COMP_CORE_PROB'],
    tags: ['보상설계', '복리후생', '연봉협상'],
    jd_summary: '공정하고 경쟁력 있는 보상 체계 설계 및 운영을 담당하실 분을 찾습니다.',
    jd_full: `
■ 담당 업무
- 연봉 밴드 및 인센티브 체계 설계·운영
- 복리후생 제도 기획 및 벤치마킹
- 보상 데이터 분석 및 대외 비교 조사

■ 자격 요건
- C&B 또는 보상 관련 경력 2년 이상
- 엑셀/스프레드시트 고급 활용 능력
- 데이터 분석 역량

■ 우대 사항
- 노무 관련 법규 이해
- HRIS C&B 모듈 운영 경험
    `.trim(),
  },
  {
    id: 'JOB_003',
    org_id: 'ORG001',
    title: 'L&D 매니저 (인재개발)',
    dept: 'HR팀',
    status: 'OPEN',
    published_at: '2025-05-15',
    deadline: '2026-07-01',
    required_competencies: ['COMP_FUNC_OD', 'COMP_CORE_COMM', 'COMP_FUTURE_AI'],
    tags: ['교육기획', 'L&D', '역량개발'],
    jd_summary: '구성원의 성장을 이끌 학습·개발 프로그램을 기획·운영합니다.',
    jd_full: `
■ 담당 업무
- 연간 교육 로드맵 수립 및 프로그램 운영
- 역량 진단 결과 기반 개인별 성장 계획(IDP) 지원
- AI 기반 학습 솔루션 도입 및 효과 측정

■ 자격 요건
- 교육/HRD 관련 경력 3년 이상
- 러닝 디자인 및 콘텐츠 개발 경험
- 데이터 기반 교육 효과 분석 능력

■ 우대 사항
- LMS 운영 경험
- AI 기반 학습 도구 활용 경험
    `.trim(),
  },
  {
    id: 'JOB_004',
    org_id: 'ORG001',
    title: 'TA 스페셜리스트 (채용 전문가)',
    dept: 'People & Culture팀',
    status: 'OPEN',
    published_at: '2025-05-20',
    deadline: '2026-06-20',
    required_competencies: ['COMP_FUNC_TA', 'COMP_CORE_COMM'],
    tags: ['채용', '인터뷰', '인재확보'],
    jd_summary: '빠르게 성장하는 조직에 최적의 인재를 영입하는 핵심 역할입니다.',
    jd_full: `
■ 담당 업무
- 직군별 채용 전략 수립 및 실행
- 후보자 소싱, 인터뷰 설계 및 진행
- 채용 데이터 분석 및 채용 퀄리티 개선

■ 자격 요건
- 채용 실무 경력 2년 이상
- 다양한 채용 채널 활용 경험
- 뛰어난 커뮤니케이션 및 후보자 경험 관리 역량

■ 우대 사항
- ATS 운영 경험
- 기술직군 채용 경험
    `.trim(),
  },
];

export const DEMO_ALUMNI = [
  {
    id: 'ALUMNI_001',
    user_id: 'ALUMNI_USER_001',
    name_ko: '박동문',
    exit_date: '2024-03-31',
    exit_reason: 'personal',
    final_position: 'HR 매니저',
    tenure_months: 38,
    final_comp_score: 4.2,
    career_updated: true,
    boomerang_status: 'INTERESTED',
    rehire_score: 90,
    org_id: 'ORG001',
  },
  {
    id: 'ALUMNI_002',
    user_id: 'ALUMNI_USER_002',
    name_ko: '최서연',
    exit_date: '2023-11-30',
    exit_reason: 'job_change',
    final_position: 'HRBP',
    tenure_months: 24,
    final_comp_score: 3.8,
    career_updated: false,
    boomerang_status: 'INACTIVE',
    rehire_score: 60,
    org_id: 'ORG001',
  },
  {
    id: 'ALUMNI_003',
    user_id: 'ALUMNI_USER_003',
    name_ko: '이준혁',
    exit_date: '2024-08-31',
    exit_reason: 'study',
    final_position: '채용 스페셜리스트',
    tenure_months: 18,
    final_comp_score: 3.5,
    career_updated: true,
    boomerang_status: 'INACTIVE',
    rehire_score: 70,
    org_id: 'ORG001',
  },
];
