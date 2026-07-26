/**
 * aptitude_questions.js — 인적성 검사 문항 데이터
 * HR Competency OS
 *
 * 79문항: 언어추론(15) + 수리추론(15) + 추리능력(12) + 상황판단(12) + 성실성(13) + 직무기초역량(12)
 */

// ── 도메인 설정 ─────────────────────────────────────────────────
export const DOMAIN_CONFIG = {
  verbal:    { id:'verbal',    name:'언어추론',     nameEn:'Verbal Reasoning',    icon:'📖', gma:true,  weight:0.133, timeMin:12, color:'#4F46E5', bg:'#EEF2FF', desc:'독해·논리·유추 추론 능력' },
  numerical: { id:'numerical', name:'수리추론',     nameEn:'Numerical Reasoning', icon:'🔢', gma:true,  weight:0.133, timeMin:15, color:'#0891B2', bg:'#ECFEFF', desc:'자료해석·수열·응용계산 능력' },
  abstract:  { id:'abstract',  name:'추리능력',     nameEn:'Abstract Reasoning',  icon:'🧩', gma:true,  weight:0.133, timeMin:10, color:'#7C3AED', bg:'#F5F3FF', desc:'패턴인식·조건추리 능력' },
  sjt:       { id:'sjt',       name:'상황판단',     nameEn:'Situational Judgment', icon:'🎭', gma:false, weight:0.25,  timeMin:20, color:'#059669', bg:'#ECFDF5', desc:'직무 시나리오 기반 판단력 (Forced-choice)' },
  big5:      { id:'big5',      name:'성실성',       nameEn:'Conscientiousness',   icon:'🎯', gma:false, weight:0.20,  timeMin:8,  color:'#D97706', bg:'#FFFBEB', desc:'Big Five 성실성 척도 (7점 Likert)' },
  ncs:       { id:'ncs',       name:'직무기초역량', nameEn:'NCS Competencies',    icon:'🏗️', gma:false, weight:0.15,  timeMin:12, color:'#DC2626', bg:'#FEF2F2', desc:'NCS 기반 4개 직업기초능력' },
};

// ── 문항 데이터 ─────────────────────────────────────────────────
export const APTITUDE_QUESTIONS = [

  // ════════════════════════════════════════════
  // 언어추론 (verbal) — 15문항
  // ════════════════════════════════════════════

  // 유추 5개 ──────────────────────────────────
  { id:'VR001', domain:'verbal', type:'mcq', category:'유추', difficulty:1, active:true,
    text:'의사 : 환자 = 교사 : ?',
    options:['학교','교육','학생','수업','칠판'],
    correct:2 },

  { id:'VR002', domain:'verbal', type:'mcq', category:'유추', difficulty:1, active:true,
    text:'씨앗 : 발아 = 노력 : ?',
    options:['땀','성공','과정','시간','피로'],
    correct:1 },

  { id:'VR003', domain:'verbal', type:'mcq', category:'유추', difficulty:1, active:true,
    text:'붓 : 화가 = 청진기 : ?',
    options:['병원','환자','의사','수술','처방'],
    correct:2 },

  { id:'VR004', domain:'verbal', type:'mcq', category:'유추', difficulty:1, active:true,
    text:'가뭄 : 홍수 = 불황 : ?',
    options:['침체','적자','호황','실업','물가'],
    correct:2 },

  { id:'VR005', domain:'verbal', type:'mcq', category:'유추', difficulty:1, active:true,
    text:'사전 : 단어 = 지도 : ?',
    options:['여행','지형','나라','거리','방향'],
    correct:2 },

  // 논리추론 5개 ──────────────────────────────
  { id:'VR006', domain:'verbal', type:'mcq', category:'논리추론', difficulty:2, active:true,
    text:'「모든 팀장은 주간 보고서를 작성한다. 박씨는 주간 보고서를 작성하지 않는다.」\n다음 중 반드시 참인 것은?',
    options:['박씨는 어떤 보고서도 쓰지 않는다','박씨는 팀장이 아니다','팀장이 아닌 사람은 보고서를 쓰지 않는다','박씨는 팀원이다','보고서를 안 쓰는 팀장도 있다'],
    correct:1 },

  { id:'VR007', domain:'verbal', type:'mcq', category:'논리추론', difficulty:2, active:true,
    text:'「A이면 B이다. B이면 C이다. A가 성립한다.」\n다음 중 반드시 참인 것은?',
    options:['B가 성립하지 않는다','C가 성립한다','C이면 A이다','B가 아니면 C가 아니다','A가 아니면 C가 아니다'],
    correct:1 },

  { id:'VR008', domain:'verbal', type:'mcq', category:'논리추론', difficulty:2, active:true,
    text:'「갑은 을보다 키가 크다. 병은 을보다 키가 작다.」\n다음 중 반드시 참인 것은?',
    options:['갑이 가장 크다','병이 가장 작다','갑은 병보다 크다','을은 2등이다','키 순서는 갑-을-병이다'],
    correct:2 },

  { id:'VR009', domain:'verbal', type:'mcq', category:'논리추론', difficulty:2, active:true,
    text:'「모든 영업직원은 영어를 구사할 수 있다. 최씨는 영어를 구사하지 못한다.」\n다음 중 반드시 참인 것은?',
    options:['최씨는 영업직원이 아니다','최씨는 다른 외국어를 구사한다','영업직원은 최씨보다 능력이 좋다','영어 구사자만 영업직원이 될 수 있다','최씨는 영업 외의 직군이다'],
    correct:0 },

  { id:'VR010', domain:'verbal', type:'mcq', category:'논리추론', difficulty:3, active:true,
    text:'「A는 B보다 먼저 발표한다. C는 B보다 나중에 발표한다. D는 C보다 먼저, B보다 나중에 발표한다.」\n발표 순서로 올바른 것은?',
    options:['A-B-C-D','A-B-D-C','B-A-D-C','A-D-B-C','D-A-B-C'],
    correct:1 },

  // 독해추론 5개 ──────────────────────────────
  { id:'VR011', domain:'verbal', type:'mcq', category:'독해추론', difficulty:2, active:true,
    text:'「최근 기업들이 재택근무를 줄이는 추세다. 기업들은 협업 효율 저하와 조직문화 약화를 이유로 든다. 그러나 일부 연구에서 재택근무자의 개인 생산성이 더 높다는 결과가 나왔다.」\n이 글에서 추론할 수 있는 것은?',
    options:['재택근무는 반드시 폐지되어야 한다','협업 효율과 개인 생산성은 서로 다른 문제일 수 있다','기업의 판단이 연구 결과보다 정확하다','재택근무자는 항상 사무실 근무자보다 생산성이 높다','협업 효율이 낮으면 기업 성과도 낮다'],
    correct:1 },

  { id:'VR012', domain:'verbal', type:'mcq', category:'독해추론', difficulty:2, active:true,
    text:'「인공지능은 단순 반복 업무를 대체하고 있다. 반면 창의성, 감성지능, 복잡한 판단이 필요한 업무는 오히려 수요가 늘어나고 있다. 미래 인재는 기술 이해와 인간적 역량을 함께 갖춰야 한다.」\n글의 핵심 주장으로 가장 적절한 것은?',
    options:['AI는 결국 모든 직업을 대체한다','창의적 역량이 있으면 기술은 불필요하다','미래에는 기술 이해와 인간적 역량이 함께 필요하다','단순 반복 업무는 앞으로도 사라지지 않는다','기업은 AI 도입을 서둘러야 한다'],
    correct:2 },

  { id:'VR013', domain:'verbal', type:'mcq', category:'독해추론', difficulty:3, active:true,
    text:'「성과급 제도가 동기부여에 효과적이라는 주장이 있다. 그러나 단기 성과에만 집중하게 만들어 장기 혁신을 저해한다는 반론도 있다. 협업 환경에서는 개인 성과급이 경쟁을 심화시켜 팀워크를 약화시킨다.」\n이 글에서 직접적으로 알 수 없는 내용은?',
    options:['성과급은 단기 성과에 집중시킨다','팀 환경에서 성과급은 경쟁을 유발한다','성과급이 없는 기업의 성과 수준','성과급이 장기 혁신을 저해할 수 있다','성과급이 동기부여에 효과적이라는 주장이 있다'],
    correct:2 },

  { id:'VR014', domain:'verbal', type:'mcq', category:'독해추론', difficulty:2, active:true,
    text:'「우리 팀의 신제품 출시가 예상보다 3개월 앞당겨졌다. 마케팅팀은 출시 6개월 전부터 캠페인을 준비해왔다. 경쟁사는 비슷한 제품을 내년 초에 출시할 예정이다.」\n반드시 참인 것은?',
    options:['신제품은 경쟁사보다 늦게 출시된다','마케팅팀은 출시 전부터 준비했다','경쟁사는 우리 팀 계획을 몰랐다','신제품 출시가 앞당겨진 이유는 경쟁사 때문이다','마케팅 캠페인이 충분히 준비되지 않았다'],
    correct:1 },

  { id:'VR015', domain:'verbal', type:'mcq', category:'독해추론', difficulty:2, active:true,
    text:'「조용한 환경에서 학습하면 기억에 더 오래 남는다. 소음이 많으면 집중력이 낮아진다. 도서관은 카페보다 소음이 적다.」\n이 글의 내용과 일치하는 추론은?',
    options:['카페에서는 학습 효과가 전혀 없다','도서관에서 공부하면 성적이 반드시 오른다','도서관이 카페보다 학습에 유리할 가능성이 높다','조용한 사람은 기억력이 좋다','소음 차단만 되면 카페와 도서관은 차이가 없다'],
    correct:2 },

  // ════════════════════════════════════════════
  // 수리추론 (numerical) — 15문항
  // ════════════════════════════════════════════

  // 수열 5개 ──────────────────────────────────
  { id:'NR001', domain:'numerical', type:'mcq', category:'수열', difficulty:1, active:true,
    text:'다음 수열의 빈칸에 들어갈 수는?\n2, 5, 10, 17, 26, ( ? )',
    options:['33','35','37','39','41'],
    correct:2 },

  { id:'NR002', domain:'numerical', type:'mcq', category:'수열', difficulty:1, active:true,
    text:'다음 수열의 빈칸에 들어갈 수는?\n1, 1, 2, 3, 5, 8, ( ? )',
    options:['10','12','13','15','16'],
    correct:2 },

  { id:'NR003', domain:'numerical', type:'mcq', category:'수열', difficulty:1, active:true,
    text:'다음 수열의 빈칸에 들어갈 수는?\n81, 27, 9, 3, ( ? )',
    options:['0','1','2','3','0.5'],
    correct:1 },

  { id:'NR004', domain:'numerical', type:'mcq', category:'수열', difficulty:2, active:true,
    text:'다음 수열의 빈칸에 들어갈 수는?\n2, 3, 5, 7, 11, 13, ( ? )',
    options:['14','15','17','19','21'],
    correct:2 },

  { id:'NR005', domain:'numerical', type:'mcq', category:'수열', difficulty:1, active:true,
    text:'다음 수열의 빈칸에 들어갈 수는?\n1, 4, 9, 16, 25, ( ? )',
    options:['30','34','36','38','49'],
    correct:2 },

  // 자료해석 5개 ──────────────────────────────
  { id:'NR006', domain:'numerical', type:'mcq', category:'자료해석', difficulty:2, active:true,
    text:'아래 자료는 A팀의 분기별 매출(억 원)이다.\n\n2022년: 100 / 110 / 120 / 120  (합계 450억)\n2023년: 110 / 120 / 130 / 140  (합계 500억)\n\n2022년 대비 2023년 전체 매출 증가율은?',
    options:['약 8%','약 11%','약 15%','약 20%','약 25%'],
    correct:1 },

  { id:'NR007', domain:'numerical', type:'mcq', category:'자료해석', difficulty:1, active:true,
    text:'팀원 5명의 이번 주 야근 시간이 각각 3시간, 5시간, 7시간, 4시간, 6시간이었다.\n평균 야근 시간은?',
    options:['4시간','4.5시간','5시간','5.5시간','6시간'],
    correct:2 },

  { id:'NR008', domain:'numerical', type:'mcq', category:'자료해석', difficulty:2, active:true,
    text:'전체 직원 100명 중 남성이 60%, 여성이 40%이다.\n남성 중 팀장 비율은 25%, 여성 중 팀장 비율은 20%이다.\n팀장은 총 몇 명인가?',
    options:['18명','20명','21명','23명','25명'],
    correct:3 },

  { id:'NR009', domain:'numerical', type:'mcq', category:'자료해석', difficulty:1, active:true,
    text:'작년 매출이 200억 원이었고 올해 매출이 230억 원이다.\n작년 대비 올해 매출 증가율은?',
    options:['10%','12%','15%','18%','20%'],
    correct:2 },

  { id:'NR010', domain:'numerical', type:'mcq', category:'자료해석', difficulty:1, active:true,
    text:'제품의 원가가 8,000원이고 판매가가 10,000원이다.\n판매가 기준 이익률은?',
    options:['15%','18%','20%','25%','30%'],
    correct:2 },

  // 응용계산 5개 ──────────────────────────────
  { id:'NR011', domain:'numerical', type:'mcq', category:'응용계산', difficulty:1, active:true,
    text:'회의실 예약 가능 시간은 오전 9시~오후 6시(총 9시간)이다.\n오늘 6시간이 예약되었다면 남은 가용 시간의 비율은?',
    options:['약 22%','약 33%','약 40%','약 50%','약 67%'],
    correct:1 },

  { id:'NR012', domain:'numerical', type:'mcq', category:'응용계산', difficulty:3, active:true,
    text:'A팀만 작업하면 20일이 걸린다.\nA팀과 B팀이 함께 작업하면 12일이 걸린다.\nB팀만 작업하면 며칠이 걸리는가?',
    options:['24일','28일','30일','36일','40일'],
    correct:2 },

  { id:'NR013', domain:'numerical', type:'mcq', category:'응용계산', difficulty:1, active:true,
    text:'정가 50,000원인 제품을 20% 할인하여 판매한다.\n판매 가격은?',
    options:['30,000원','35,000원','40,000원','42,000원','45,000원'],
    correct:2 },

  { id:'NR014', domain:'numerical', type:'mcq', category:'응용계산', difficulty:1, active:true,
    text:'올해 신입 채용 인원은 작년보다 40% 증가했다.\n작년에 50명을 채용했다면 올해 채용 인원은?',
    options:['60명','65명','70명','75명','80명'],
    correct:2 },

  { id:'NR015', domain:'numerical', type:'mcq', category:'응용계산', difficulty:2, active:true,
    text:'4명이 함께 작업하면 프로젝트를 6일에 완료할 수 있다.\n같은 프로젝트를 3일 안에 완료하려면 몇 명이 필요한가?\n(각 인원의 작업 능력은 동일하다고 가정)',
    options:['6명','7명','8명','9명','10명'],
    correct:2 },

  // ════════════════════════════════════════════
  // 추리능력 (abstract) — 12문항
  // ════════════════════════════════════════════

  // 수열/패턴 7개 ─────────────────────────────
  { id:'AR001', domain:'abstract', type:'mcq', category:'문자수열', difficulty:1, active:true,
    text:'다음 문자 수열의 빈칸에 들어갈 알파벳은?\nA, C, E, G, ( ? )',
    options:['H','I','J','K','L'],
    correct:1 },

  { id:'AR002', domain:'abstract', type:'mcq', category:'수열패턴', difficulty:2, active:true,
    text:'다음 수열의 빈칸에 들어갈 수는?\n3, 6, 11, 18, 27, ( ? )',
    options:['36','37','38','40','42'],
    correct:2 },

  { id:'AR003', domain:'abstract', type:'mcq', category:'수열패턴', difficulty:1, active:true,
    text:'다음 수열의 빈칸에 들어갈 수는?\n1, 2, 4, 8, 16, ( ? )',
    options:['24','28','30','32','36'],
    correct:3 },

  { id:'AR004', domain:'abstract', type:'mcq', category:'수열패턴', difficulty:2, active:true,
    text:'다음 수열의 빈칸에 들어갈 수는?\n3, 7, 15, 31, ( ? )',
    options:['55','57','61','63','67'],
    correct:3 },

  { id:'AR005', domain:'abstract', type:'mcq', category:'수열패턴', difficulty:2, active:true,
    text:'다음 수열의 빈칸에 들어갈 수는?\n100, 91, 83, 76, 70, ( ? )',
    options:['63','64','65','66','67'],
    correct:2 },

  { id:'AR006', domain:'abstract', type:'mcq', category:'수열패턴', difficulty:2, active:true,
    text:'다음 수열의 빈칸에 들어갈 수는?\n1, 3, 7, 13, 21, ( ? )',
    options:['28','29','31','33','35'],
    correct:2 },

  { id:'AR007', domain:'abstract', type:'mcq', category:'문자수열', difficulty:2, active:true,
    text:'다음 문자 수열의 빈칸에 들어갈 알파벳은?\nZ, X, V, T, ( ? )',
    options:['P','Q','R','S','U'],
    correct:2 },

  // 조건추리 5개 ──────────────────────────────
  { id:'AR008', domain:'abstract', type:'mcq', category:'조건추리', difficulty:2, active:true,
    text:'A, B, C, D 4명이 1~4위를 차지했다(동점 없음).\n\n조건:\n• A는 2위이다\n• B는 C보다 순위가 높다(숫자가 작다)\n• D는 4위가 아니다\n\nC의 순위는?',
    options:['1위','2위','3위','4위','알 수 없다'],
    correct:3 },

  { id:'AR009', domain:'abstract', type:'mcq', category:'조건추리', difficulty:2, active:true,
    text:'빨강, 파랑, 초록, 노랑 카드 4장을 일렬로 배열한다.\n\n조건:\n• 빨강은 파랑 바로 왼쪽에 있다\n• 초록은 노랑보다 왼쪽에 있다\n• 노랑은 파랑보다 왼쪽에 있다\n\n왼쪽부터 순서로 올바른 것은?',
    options:['초록-노랑-빨강-파랑','빨강-파랑-초록-노랑','초록-빨강-노랑-파랑','빨강-초록-노랑-파랑','노랑-초록-빨강-파랑'],
    correct:0 },

  { id:'AR010', domain:'abstract', type:'mcq', category:'조건추리', difficulty:3, active:true,
    text:'A, B, C, D, E 5명이 발표 순서를 정한다.\n\n조건:\n• A는 B보다 먼저 발표한다\n• C는 B보다 나중에 발표한다\n• D는 C보다 먼저 발표하지만 B보다는 나중에 발표한다\n\n가능한 발표 순서는?',
    options:['A-B-C-D-E','A-B-D-C-E','B-A-D-C-E','A-D-B-C-E','D-A-B-C-E'],
    correct:1 },

  { id:'AR011', domain:'abstract', type:'mcq', category:'조건추리', difficulty:3, active:true,
    text:'갑, 을, 병 세 사람 중 오직 1명만 진실을 말한다.\n\n갑: "을이 거짓말쟁이다."\n을: "나는 거짓말쟁이가 아니다."\n병: "갑이 진실을 말한다."\n\n진실을 말하는 사람은?',
    options:['갑','을','병','알 수 없다'],
    correct:1 },

  { id:'AR012', domain:'abstract', type:'mcq', category:'조건추리', difficulty:1, active:true,
    text:'현수, 민준, 지원, 수아 4명이 시험을 쳤다.\n\n조건:\n• 현수는 민준보다 점수가 높다\n• 지원은 현수보다 점수가 높다\n• 수아는 민준보다 점수가 낮다\n\n점수가 가장 낮은 사람은?',
    options:['민준','수아','현수','지원','알 수 없다'],
    correct:1 },

  // ════════════════════════════════════════════
  // 상황판단 (sjt) — 12문항 (Forced-choice)
  // best: 전문가 합의 최선 행동 인덱스
  // worst: 전문가 합의 최악 행동 인덱스
  // ════════════════════════════════════════════

  { id:'SJT001', domain:'sjt', type:'sjt', category:'직무 판단', difficulty:2, active:true,
    scenario:'당신은 중요한 보고서를 오늘 오후 5시까지 팀장에게 제출해야 한다. 오후 3시에 작업 도중 데이터 오류를 발견했다. 수정하면 제출 기한을 넘길 것이 확실하다.',
    options:[
      '오류를 무시하고 예정대로 제출한다',
      '팀장에게 즉시 상황을 보고하고 판단을 구한다',
      '팀원들에게 도움을 요청해 남은 시간 내 수정을 시도한다',
      '오류가 있음을 주석으로 명시하고 제출한다',
      '기한을 어기더라도 수정 후 제출한다',
    ],
    best:1, worst:0 },

  { id:'SJT002', domain:'sjt', type:'sjt', category:'의견 표현', difficulty:2, active:true,
    scenario:'팀 회의에서 상사가 방향을 제시했다. 당신은 그 방향이 잘못되었다는 명확한 근거 데이터를 갖고 있다. 다른 팀원들은 아무도 이의를 제기하지 않는다.',
    options:[
      '회의 중 데이터와 근거를 들어 다른 방향을 제안한다',
      '회의 후 상사에게 개인적으로 우려 사항을 전달한다',
      '아무 말도 하지 않고 상사의 지시를 따른다',
      '동료들에게 먼저 의견을 구한 뒤 상사에게 보고한다',
      '상사의 지시에 따르되 실패 시를 대비해 백업 플랜을 준비한다',
    ],
    best:0, worst:2 },

  { id:'SJT003', domain:'sjt', type:'sjt', category:'윤리 판단', difficulty:3, active:true,
    scenario:'동료가 업무 중 실수를 했고, 이를 덮어달라고 당신에게 부탁했다. 이 실수가 방치되면 고객에게 직접적인 피해가 발생할 수 있는 상황이다.',
    options:[
      '동료를 위해 실수를 덮어준다',
      '동료에게 스스로 보고할 것을 강력히 권고한다',
      '고객 피해를 먼저 최소화하는 조치를 취하고 이후 팀장에게 보고한다',
      '즉시 팀장에게 단독으로 보고한다',
      '직접 고객에게 연락해 상황을 설명한다',
    ],
    best:2, worst:0 },

  { id:'SJT004', domain:'sjt', type:'sjt', category:'위기 대응', difficulty:2, active:true,
    scenario:'오늘 중요한 클라이언트 발표가 있다. 발표 30분 전, 준비한 발표 자료 파일이 갑자기 열리지 않는다.',
    options:[
      '발표를 취소해달라고 요청한다',
      'IT팀에 즉시 도움을 요청하면서 동시에 구두 발표를 준비한다',
      '파일 없이 구두로만 발표한다',
      '발표 역할을 동료에게 넘긴다',
      '클라이언트에게 기술적 문제를 미리 알리고 양해를 구한다',
    ],
    best:1, worst:0 },

  { id:'SJT005', domain:'sjt', type:'sjt', category:'팀 협업', difficulty:2, active:true,
    scenario:'마감 전날 팀원이 갑자기 병가를 냈다. 해당 팀원이 담당하던 핵심 작업이 절반밖에 완료되지 않은 상태다.',
    options:[
      '혼자 밤새워 나머지 작업을 마무리한다',
      '팀장에게 즉시 상황을 보고하고 마감 연장 또는 추가 인력 지원을 요청한다',
      '나머지 팀원들과 작업을 분배해 처리한다',
      '미완성 상태로 제출한다',
      '팀원에게 연락해 재택에서라도 마무리해달라고 부탁한다',
    ],
    best:1, worst:3 },

  { id:'SJT006', domain:'sjt', type:'sjt', category:'의사결정', difficulty:2, active:true,
    scenario:'중요한 프로젝트를 두 가지 방법으로 진행할 수 있다. 방법 A는 안전하나 성과가 적다. 방법 B는 위험하나 성공하면 큰 성과를 낼 수 있다. 최종 결정을 당신 혼자 내려야 하는 상황이다.',
    options:[
      '안전한 방법 A를 선택한다',
      '성과가 큰 방법 B를 선택한다',
      '의사결정권자에게 보고하고 판단을 구한다',
      '두 방법을 절충해 혼합 방식으로 진행한다',
      '추가 정보를 수집하면서 결정을 미룬다',
    ],
    best:2, worst:1 },

  { id:'SJT007', domain:'sjt', type:'sjt', category:'규정 준수', difficulty:3, active:true,
    scenario:'업무 중 상사가 회사 내부 규정에 어긋나는 지시를 했다. 지시를 따르면 팀의 단기 성과에 도움이 되지만 명백한 규정 위반이다.',
    options:[
      '성과를 위해 지시를 그대로 따른다',
      '상사에게 규정 위반 사실을 조심스럽게 알리고 다른 방법을 제안한다',
      '즉시 인사팀 또는 컴플라이언스 담당자에게 신고한다',
      '팀원들과 상의한 뒤 결정한다',
      '일단 지시를 따르되 이후에 규정 개정을 건의한다',
    ],
    best:1, worst:0 },

  { id:'SJT008', domain:'sjt', type:'sjt', category:'팀 관계', difficulty:2, active:true,
    scenario:'팀 내 특정 팀원이 반복적으로 업무를 회피하고 있어 다른 팀원들의 부담이 늘어나고 있다. 모두가 불만을 갖고 있지만 아무도 직접 이야기하지 않는다.',
    options:[
      '나도 그냥 참고 넘어간다',
      '팀장에게 상황을 보고한다',
      '해당 팀원과 직접 대화해 솔직한 피드백을 전달한다',
      '팀원들과 함께 팀장에게 단체로 이야기한다',
      '해당 팀원의 업무를 내가 대신 처리한다',
    ],
    best:2, worst:0 },

  { id:'SJT009', domain:'sjt', type:'sjt', category:'업무 균형', difficulty:1, active:true,
    scenario:'팀에 신입이 들어왔다. 당신은 현재 업무가 매우 바쁜 상황이지만 팀장이 신입 교육을 맡아달라고 했다.',
    options:[
      '바쁘다고 정중히 거절한다',
      '최소한의 교육만 빠르게 마친다',
      '교육 계획을 효율적으로 짜고 본인 업무와 병행한다',
      '신입에게 스스로 파악하도록 한다',
      '다른 팀원에게 교육을 미룬다',
    ],
    best:2, worst:3 },

  { id:'SJT010', domain:'sjt', type:'sjt', category:'고객 대응', difficulty:2, active:true,
    scenario:'클라이언트가 기존 계약서에 포함되지 않은 추가 요청을 해왔다. 이를 처리하면 팀의 업무량이 크게 늘지만 거절하면 관계가 어색해질 수 있다.',
    options:[
      '추가 요청을 즉시 수용한다',
      '계약 범위를 벗어난다고 바로 거절한다',
      '팀장에게 보고한 후 추가 비용·일정 협의를 제안한다',
      '가능한 부분만 처리하고 나머지는 다음 계약으로 미룬다',
      '현재 팀 상황을 솔직히 설명하고 클라이언트에게 우선순위를 정해달라고 한다',
    ],
    best:2, worst:0 },

  { id:'SJT011', domain:'sjt', type:'sjt', category:'프로젝트 관리', difficulty:2, active:true,
    scenario:'6개월 프로젝트의 중간 점검에서 예상치 못한 기술적 문제가 발견됐다. 이대로 진행하면 3개월 내 완료가 불가능하다.',
    options:[
      '팀원들을 독려해 초과 근무로 기한을 맞추려 한다',
      '이해관계자들에게 즉시 상황을 보고하고 일정·범위를 재협의한다',
      '기술적 문제를 최대한 숨기고 기한 연장만 요청한다',
      '외부 전문가를 투입해 문제를 해결한다',
      '프로젝트 범위를 축소해 기한을 맞춘다',
    ],
    best:1, worst:2 },

  { id:'SJT012', domain:'sjt', type:'sjt', category:'공정성', difficulty:3, active:true,
    scenario:'당신이 직접 작성한 기획안을 상사가 자신의 이름으로 경영진에게 보고했다. 당신의 기여는 공식적으로 인정받지 못했다.',
    options:[
      '경영진에게 직접 연락해 본인이 작성자임을 알린다',
      '상사에게 개인적으로 이 문제를 정중하게 이야기한다',
      '아무것도 하지 않는다',
      '동료들에게 이 상황을 알린다',
      '인사팀에 공식 민원을 제기한다',
    ],
    best:1, worst:2 },

  // ════════════════════════════════════════════
  // 성실성 (big5) — 13문항 (7점 Likert)
  // direction: 1=정방향(높을수록 성실), -1=역방향(역채점)
  // detection: true = 사회적 바람직성 탐지 문항
  // ════════════════════════════════════════════

  { id:'CON001', domain:'big5', type:'likert', category:'자기규율', difficulty:1, active:true, detection:false, direction:1,
    text:'나는 맡은 일은 반드시 기한 안에 완료한다.' },

  { id:'CON002', domain:'big5', type:'likert', category:'자기규율', difficulty:1, active:true, detection:false, direction:1,
    text:'나는 업무를 시작하기 전에 체계적인 계획을 세운다.' },

  { id:'CON003', domain:'big5', type:'likert', category:'집중력', difficulty:1, active:true, detection:false, direction:1,
    text:'나는 방해 요소가 있어도 작업을 완료할 때까지 집중을 유지한다.' },

  { id:'CON004', domain:'big5', type:'likert', category:'목표지향성', difficulty:1, active:true, detection:false, direction:1,
    text:'나는 목표를 달성하기 위해 꾸준히 노력하는 편이다.' },

  { id:'CON005', domain:'big5', type:'likert', category:'신중성', difficulty:1, active:true, detection:false, direction:1,
    text:'나는 제출 전에 작업 내용을 꼼꼼하게 재검토한다.' },

  { id:'CON006', domain:'big5', type:'likert', category:'목표지향성', difficulty:1, active:true, detection:false, direction:1,
    text:'나는 어렵고 복잡한 과제도 회피하지 않고 정면으로 해결한다.' },

  { id:'CON007', domain:'big5', type:'likert', category:'완수성', difficulty:1, active:true, detection:false, direction:1,
    text:'나는 한번 시작한 일은 끝까지 완수하는 편이다.' },

  { id:'CON008', domain:'big5', type:'likert', category:'자기규율', difficulty:1, active:true, detection:false, direction:-1,
    text:'나는 계획을 세워도 중간에 자주 변경하거나 포기하는 편이다.' },

  { id:'CON009', domain:'big5', type:'likert', category:'자기규율', difficulty:1, active:true, detection:false, direction:-1,
    text:'나는 마감 직전에 몰아서 작업하는 경우가 많다.' },

  { id:'CON010', domain:'big5', type:'likert', category:'도전성', difficulty:1, active:true, detection:false, direction:-1,
    text:'나는 복잡하고 도전적인 업무보다 단순하고 익숙한 업무를 선호한다.' },

  { id:'CON_D01', domain:'big5', type:'likert', category:'탐지', difficulty:1, active:true, detection:true, direction:1,
    text:'나는 지금까지 살면서 약속을 한 번도 어긴 적이 없다.' },

  { id:'CON_D02', domain:'big5', type:'likert', category:'탐지', difficulty:1, active:true, detection:true, direction:1,
    text:'나는 업무에서 단 한 번도 실수를 한 적이 없다.' },

  { id:'CON_D03', domain:'big5', type:'likert', category:'탐지', difficulty:1, active:true, detection:true, direction:1,
    text:'나는 어떤 상황에서도 항상 모든 규칙을 완벽하게 준수한다.' },

  // ════════════════════════════════════════════
  // 직무기초역량 (ncs) — 12문항 (4지선다)
  // ════════════════════════════════════════════

  // 의사소통능력 3개 ───────────────────────────
  { id:'NCS001', domain:'ncs', type:'mcq', category:'의사소통', difficulty:1, active:true,
    text:'업무 보고서 작성 시 논리적 흐름으로 가장 자연스러운 구조는?',
    options:['결론 → 문제 → 원인 → 대안','문제 → 원인 → 대안 → 결론','원인 → 대안 → 문제 → 결론','문제 → 결론 → 원인 → 대안'],
    correct:1 },

  { id:'NCS002', domain:'ncs', type:'mcq', category:'의사소통', difficulty:1, active:true,
    text:'업무 이메일에서 CC(참조)의 올바른 사용 목적은?',
    options:['비밀리에 내용을 전달할 때','수신인의 즉각적인 의사결정이 필요할 때','내용을 알고 있어야 하는 관계자에게 동시에 발송할 때','긴급 연락이 필요한 상황에서'],
    correct:2 },

  { id:'NCS003', domain:'ncs', type:'mcq', category:'의사소통', difficulty:1, active:true,
    text:'다음 중 효과적인 경청 방법이 아닌 것은?',
    options:['상대방의 말을 끊지 않고 끝까지 듣는다','고개를 끄덕이며 이해를 표현한다','상대방의 말 중 틀린 부분을 즉시 바로잡는다','핵심 내용을 요약해 확인한다'],
    correct:2 },

  // 문제해결능력 3개 ───────────────────────────
  { id:'NCS004', domain:'ncs', type:'mcq', category:'문제해결', difficulty:2, active:true,
    text:'같은 문제가 반복적으로 발생할 때 가장 효과적인 해결 방법은?',
    options:['문제 발생 시마다 즉각 대응한다','근본 원인을 파악하고 재발 방지 조치를 취한다','관련 부서에 문제를 이관한다','매뉴얼에 따라 정해진 절차대로 처리한다'],
    correct:1 },

  { id:'NCS005', domain:'ncs', type:'mcq', category:'문제해결', difficulty:1, active:true,
    text:'5-Why 기법에 대한 설명으로 옳은 것은?',
    options:['5명에게 의견을 수집하는 브레인스토밍 방법','"왜?"를 반복 질문해 문제의 근본 원인을 찾는 방법','5가지 해결책을 도출하는 방법','5분 안에 빠른 결정을 내리는 방법'],
    correct:1 },

  { id:'NCS006', domain:'ncs', type:'mcq', category:'문제해결', difficulty:2, active:true,
    text:'아이젠하워 매트릭스에서 즉시 직접 처리해야 하는 업무는?',
    options:['중요하지 않고 긴급하지도 않은 업무','중요하고 긴급한 업무','중요하지만 긴급하지 않은 업무','중요하지 않지만 긴급한 업무'],
    correct:1 },

  // 정보능력 3개 ──────────────────────────────
  { id:'NCS007', domain:'ncs', type:'mcq', category:'정보', difficulty:1, active:true,
    text:'스프레드시트에서 A1:A10 범위의 평균을 구하는 함수는?',
    options:['SUM(A1:A10)','COUNT(A1:A10)','AVERAGE(A1:A10)','MAX(A1:A10)'],
    correct:2 },

  { id:'NCS008', domain:'ncs', type:'mcq', category:'정보', difficulty:1, active:true,
    text:'업무 데이터를 안전하게 관리하기 위한 가장 기본적인 방법은?',
    options:['중요 데이터는 기억하고 별도로 저장하지 않는다','정기적으로 백업하고 접근 권한을 관리한다','모든 데이터를 공개 폴더에 저장해 공유한다','데이터는 한 곳에만 집중 보관한다'],
    correct:1 },

  { id:'NCS009', domain:'ncs', type:'mcq', category:'정보', difficulty:2, active:true,
    text:'피싱(Phishing) 이메일의 특징이 아닌 것은?',
    options:['발신자 주소가 공식 도메인과 미묘하게 다르다','개인정보나 비밀번호 입력을 유도한다','의심스러운 첨부파일 실행을 요구한다','회사 공식 보안 시스템이 발송한 인증된 메일이다'],
    correct:3 },

  // 대인관계능력 3개 ───────────────────────────
  { id:'NCS010', domain:'ncs', type:'mcq', category:'대인관계', difficulty:1, active:true,
    text:'팀원 간 갈등이 발생했을 때 가장 건설적인 대응 방법은?',
    options:['갈등을 무시하고 자연스럽게 해소되길 기다린다','직위가 높은 사람의 의견을 따른다','양측의 이야기를 경청하고 공통된 해결책을 찾는다','갈등의 원인이 된 사람에게 책임을 묻는다'],
    correct:2 },

  { id:'NCS011', domain:'ncs', type:'mcq', category:'대인관계', difficulty:2, active:true,
    text:'조직 내 협업을 방해하는 요소와 가장 거리가 먼 것은?',
    options:['정보를 독점하고 공유하지 않는 문화','불명확한 역할 분담','팀원 간 솔직한 피드백 문화','부서 이기주의'],
    correct:2 },

  { id:'NCS012', domain:'ncs', type:'mcq', category:'대인관계', difficulty:1, active:true,
    text:'리더십에 대한 설명으로 가장 적절한 것은?',
    options:['리더십은 직위를 가진 사람만 발휘할 수 있다','리더십은 타인에게 영향력을 미쳐 목표 달성을 이끄는 능력이다','리더십은 강압적인 방식으로 팀을 통솔하는 것이다','리더십과 관리(Management)는 동일한 개념이다'],
    correct:1 },
];

// ── Helper functions ────────────────────────────────────────────

/** localStorage 오버라이드를 적용해 활성 문항만 반환 */
export function getActiveQuestions(overrides = {}) {
  return APTITUDE_QUESTIONS.filter(q => {
    if (overrides[q.id] !== undefined) return overrides[q.id];
    return q.active !== false;
  });
}

/** 특정 도메인의 활성 문항만 반환 */
export function getQuestionsByDomain(domain, overrides = {}) {
  return getActiveQuestions(overrides).filter(q => q.domain === domain);
}

/** 도메인별 문항 수 집계 */
export function countByDomain(overrides = {}) {
  const active = getActiveQuestions(overrides);
  const result = {};
  Object.keys(DOMAIN_CONFIG).forEach(d => {
    result[d] = active.filter(q => q.domain === d).length;
  });
  return result;
}
