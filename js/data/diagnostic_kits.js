/**
 * diagnostic_kits.js – Shared registry for diagnostic / personality kits
 * HR Competency OS
 *
 * Export:
 *   DIAGNOSTIC_KITS  – full array (active + inactive)
 *   getActiveKits()  – filter by active === true
 *   getKitById(id)   – find single kit by id
 */

// ══════════════════════════════════════════════════════════════
// KIT 1 — MBTI Questions (20 items, 5 per axis, Korean)
// ══════════════════════════════════════════════════════════════

const MBTI_QUESTIONS = [
  // ── E / I ────────────────────────────────────────────────────
  { id:  1, text: '처음 만난 자리에서도 자연스럽게 대화를 주도하는 편이다.',                      axis: 'EI', high: 'E' },
  { id:  2, text: '많은 사람과 어울린 후에는 혼자만의 시간이 필요하다.',                          axis: 'EI', high: 'I' },
  { id:  3, text: '문제가 생기면 혼자 고민하기보다 다른 사람과 이야기하며 답을 찾는다.',            axis: 'EI', high: 'E' },
  { id:  4, text: '넓은 인맥보다 깊고 친밀한 소수 관계를 더 선호한다.',                           axis: 'EI', high: 'I' },
  { id:  5, text: '파티나 모임에서 에너지를 얻고 활기를 되찾는다.',                               axis: 'EI', high: 'E' },
  // ── S / N ────────────────────────────────────────────────────
  { id:  6, text: '검증된 방법과 실질적인 경험을 새로운 이론보다 더 신뢰한다.',                    axis: 'SN', high: 'S' },
  { id:  7, text: '미래의 가능성과 큰 그림을 그리는 데서 동기를 얻는다.',                         axis: 'SN', high: 'N' },
  { id:  8, text: '세부 사항과 정확한 수치·사실을 중요하게 여긴다.',                              axis: 'SN', high: 'S' },
  { id:  9, text: '현재 상황보다 "이렇게 될 수도 있다"는 아이디어에 더 흥미를 느낀다.',            axis: 'SN', high: 'N' },
  { id: 10, text: '상상력과 직관보다 현실적인 감각이 더 강점이라고 생각한다.',                    axis: 'SN', high: 'S' },
  // ── T / F ────────────────────────────────────────────────────
  { id: 11, text: '의사결정 시 논리와 객관적 사실을 감정보다 우선한다.',                           axis: 'TF', high: 'T' },
  { id: 12, text: '옳고 그름보다 상대의 감정과 관계가 더 중요할 때가 있다.',                       axis: 'TF', high: 'F' },
  { id: 13, text: '비판이 논리적으로 타당하다면 감정적으로 불편해도 받아들인다.',                   axis: 'TF', high: 'T' },
  { id: 14, text: '팀의 화합과 분위기가 최적의 결과만큼 중요하다고 생각한다.',                     axis: 'TF', high: 'F' },
  { id: 15, text: '공정함이 친절함보다 더 중요한 가치라고 생각한다.',                              axis: 'TF', high: 'T' },
  // ── J / P ────────────────────────────────────────────────────
  { id: 16, text: '계획을 세우고 그대로 실행할 때 가장 편안하다.',                                axis: 'JP', high: 'J' },
  { id: 17, text: '상황에 따라 즉흥적으로 대응하는 것이 스트레스가 적다.',                         axis: 'JP', high: 'P' },
  { id: 18, text: '마감 기한을 엄격히 지키며 미리 끝내는 것을 선호한다.',                          axis: 'JP', high: 'J' },
  { id: 19, text: '결정을 오래 미루고 여러 선택지를 열어두는 것이 편하다.',                         axis: 'JP', high: 'P' },
  { id: 20, text: '체계적이고 구조화된 환경에서 더 좋은 성과를 낸다.',                             axis: 'JP', high: 'J' },
];

// ══════════════════════════════════════════════════════════════
// KIT 1 — MBTI Types (all 16, Korean)
// ══════════════════════════════════════════════════════════════

const MBTI_TYPES = {
  INTJ: {
    ko: '전략가', emoji: '🏛️',
    desc: '독립적이고 결단력 있는 전략적 사고자.',
    strengths: ['전략적 사고', '장기 계획 수립', '독립적 문제 해결'],
    growth:    ['공감·관계 형성', '유연성', '협업 소통'],
    work_style: '혼자 깊이 사고한 후 결론을 공유하며 비효율을 싫어합니다.',
  },
  INTP: {
    ko: '사색가', emoji: '🔬',
    desc: '논리적 분석과 이론 탐구를 즐기는 혁신가.',
    strengths: ['논리 분석', '창의적 문제 해결', '개념화 능력'],
    growth:    ['실행력·완결성', '대인 관계 표현', '기한 준수'],
    work_style: '아이디어 탐색에 몰입하며 새로운 시스템 설계를 선호합니다.',
  },
  ENTJ: {
    ko: '통솔자', emoji: '👑',
    desc: '타고난 리더십과 전략적 안목을 가진 추진력 있는 지도자.',
    strengths: ['리더십', '의사결정', '전략 실행'],
    growth:    ['타인 감정 배려', '인내심·경청', '세부 실행 위임'],
    work_style: '큰 그림을 그리고 빠르게 실행에 옮깁니다.',
  },
  ENTP: {
    ko: '변론가', emoji: '⚡',
    desc: '창의적이고 도전적인 아이디어를 쏟아내는 혁신가.',
    strengths: ['창의적 사고', '빠른 학습', '설득력'],
    growth:    ['지속성·마무리', '감정적 공감', '세부 사항 주의'],
    work_style: '브레인스토밍을 즐기고 반론을 통해 아이디어를 다듬습니다.',
  },
  INFJ: {
    ko: '옹호자', emoji: '🌱',
    desc: '이상주의적이고 통찰력 있는 조용한 변화 촉진자.',
    strengths: ['통찰력', '장기 비전', '공감 능력'],
    growth:    ['경계 설정', '완벽주의 조절', '자기 표현'],
    work_style: '깊은 의미와 목적이 있는 일에서 동기를 얻습니다.',
  },
  INFP: {
    ko: '중재자', emoji: '🎨',
    desc: '가치와 이상에 헌신하는 열정적인 이상주의자.',
    strengths: ['창의적 표현', '공감·경청', '가치 중심 사고'],
    growth:    ['갈등 직면', '구조화된 실행', '비판 수용'],
    work_style: '자유롭고 의미 있는 환경에서 번창합니다.',
  },
  ENFJ: {
    ko: '선도자', emoji: '🌟',
    desc: '카리스마 있고 공감 능력이 높은 사람 중심의 리더.',
    strengths: ['관계 형성', '조직 동기부여', '코칭·육성'],
    growth:    ['자기 돌봄', '감정 소진 방지', '위임 능력'],
    work_style: '팀이 최선을 발휘하도록 돕는 데 에너지를 씁니다.',
  },
  ENFP: {
    ko: '활동가', emoji: '🌈',
    desc: '열정적이고 창의적인 자유로운 영혼.',
    strengths: ['열정·에너지', '창의력', '관계 형성'],
    growth:    ['집중력 유지', '마감 준수', '루틴 확립'],
    work_style: '아이디어와 사람 사이를 활발히 연결합니다.',
  },
  ISTJ: {
    ko: '청렴결백한 논리주의자', emoji: '📐',
    desc: '신뢰할 수 있고 사실에 기반한 성실한 실행자.',
    strengths: ['신뢰성', '체계적 실행', '세부 지향'],
    growth:    ['변화 수용', '유연성', '감정 표현'],
    work_style: '규칙과 절차를 철저히 따르며 꼼꼼하게 완수합니다.',
  },
  ISFJ: {
    ko: '용감한 수호자', emoji: '🛡️',
    desc: '헌신적이고 따뜻한 보호자. 조직의 안정적 기반을 지킵니다.',
    strengths: ['세심한 배려', '팀 지원', '지속성'],
    growth:    ['자기주장', '변화 적응', '우선순위 설정'],
    work_style: '조용히 뒤에서 팀을 지원하며 배려를 실천합니다.',
  },
  ESTJ: {
    ko: '관리자', emoji: '📋',
    desc: '현실적이고 조직적인 관리자. 질서와 효율을 중요시합니다.',
    strengths: ['조직 관리', '명확한 의사소통', '실행력'],
    growth:    ['유연성', '감정 민감도', '새로운 접근 수용'],
    work_style: '명확한 목표와 구조 안에서 팀을 이끕니다.',
  },
  ESFJ: {
    ko: '사교적인 외교관', emoji: '🤝',
    desc: '협력적이고 타인 지향적인 팀의 화합을 이끄는 조력자.',
    strengths: ['관계 유지', '팀 화합', '실질적 지원'],
    growth:    ['비판 수용', '자기 욕구 인식', '독립적 판단'],
    work_style: '팀의 분위기를 살피고 모든 사람이 포함되도록 합니다.',
  },
  ISTP: {
    ko: '만능 재주꾼', emoji: '🔧',
    desc: '대담하고 실용적인 문제 해결사. 도구와 메커니즘을 즐겨 다룹니다.',
    strengths: ['실용적 문제 해결', '침착한 위기 대응', '기술적 능숙'],
    growth:    ['감정 표현', '장기 계획', '소통 강화'],
    work_style: '직접 손으로 문제를 해결하고 효율적인 방법을 찾습니다.',
  },
  ISFP: {
    ko: '호기심 많은 예술가', emoji: '🎵',
    desc: '유연하고 개방적인 매력적인 예술가 기질.',
    strengths: ['심미적 감각', '공감 능력', '현재 집중'],
    growth:    ['자기 표현 강화', '장기 목표 설정', '갈등 해결'],
    work_style: '조화롭고 자유로운 환경에서 창의적으로 기여합니다.',
  },
  ESTP: {
    ko: '사업가', emoji: '🚀',
    desc: '에너지 넘치고 인지력이 빠른 행동 지향적 실용주의자.',
    strengths: ['빠른 실행', '위기 대응', '설득력'],
    growth:    ['장기 사고', '감정적 공감', '세부 사항 주의'],
    work_style: '현장에서 직접 문제를 파악하고 즉시 행동합니다.',
  },
  ESFP: {
    ko: '연예인', emoji: '🎤',
    desc: '즉흥적이고 활기찬 엔터테이너. 모든 순간을 즐깁니다.',
    strengths: ['팀 활기', '현재 집중', '관계 형성'],
    growth:    ['계획 수립', '집중력 유지', '장기 사고'],
    work_style: '팀에 에너지와 긍정을 불어넣으며 협업을 촉진합니다.',
  },
};

// ══════════════════════════════════════════════════════════════
// KIT 2 — DISC Questions (28 items, 7 per dimension)
// ══════════════════════════════════════════════════════════════

const DISC_QUESTIONS = [
  // ── D (주도형 / Dominance) ────────────────────────────────────
  { id:  1, text: '도전적인 목표를 설정하고 장애물을 돌파하는 데서 성취감을 느낀다.',                  dimension: 'D', weight:  1 },
  { id:  2, text: '의사결정을 내려야 할 때 필요한 정보를 빠르게 파악하고 즉시 결단한다.',              dimension: 'D', weight:  1 },
  { id:  3, text: '다른 사람의 반대 의견에도 내 입장을 명확하게 유지하는 편이다.',                    dimension: 'D', weight:  1 },
  { id:  4, text: '경쟁적인 환경에서 오히려 더 강한 집중력과 동기를 경험한다.',                       dimension: 'D', weight:  1 },
  { id:  5, text: '그룹에서 방향을 제시하고 주도권을 갖는 역할을 자연스럽게 맡는다.',                 dimension: 'D', weight:  1 },
  { id:  6, text: '목표 달성이 지연될 경우 규칙이나 절차보다 결과를 우선한다.',                       dimension: 'D', weight:  1 },
  { id:  7, text: '새롭고 어려운 과제가 주어졌을 때 압박보다 흥미를 먼저 느낀다.',                    dimension: 'D', weight:  1 },
  // ── I (사교형 / Influence) ────────────────────────────────────
  { id:  8, text: '처음 만나는 사람과도 쉽게 대화를 시작하고 분위기를 이끌어간다.',                   dimension: 'I', weight:  1 },
  { id:  9, text: '사람들이 나의 열정과 긍정적 에너지에 영향을 받는다는 것을 느낀다.',                 dimension: 'I', weight:  1 },
  { id: 10, text: '타인을 설득하거나 영감을 불어넣는 것이 특기라고 생각한다.',                        dimension: 'I', weight:  1 },
  { id: 11, text: '칭찬과 인정을 받을 때 특히 더 좋은 성과를 발휘한다.',                             dimension: 'I', weight:  1 },
  { id: 12, text: '발표나 공개 석상에서 이야기하는 것이 어색하지 않고 오히려 즐겁다.',                 dimension: 'I', weight:  1 },
  { id: 13, text: '팀 활동이나 협업이 혼자 일하는 것보다 훨씬 활력이 넘친다.',                        dimension: 'I', weight:  1 },
  { id: 14, text: '관계를 통해 업무 목표를 달성하는 방식을 의도적으로 활용한다.',                     dimension: 'I', weight:  1 },
  // ── S (안정형 / Steadiness) ───────────────────────────────────
  { id: 15, text: '급격한 변화보다 안정적이고 예측 가능한 업무 환경을 선호한다.',                     dimension: 'S', weight:  1 },
  { id: 16, text: '한 번 맡은 일은 완수될 때까지 포기하지 않고 일관되게 추진한다.',                   dimension: 'S', weight:  1 },
  { id: 17, text: '팀의 화합이 깨지지 않도록 갈등 상황에서 조율 역할을 자처한다.',                    dimension: 'S', weight:  1 },
  { id: 18, text: '다른 사람의 감정과 어려움을 세심하게 파악하고 배려한다.',                          dimension: 'S', weight:  1 },
  { id: 19, text: '검증된 방법과 정해진 루틴 안에서 일할 때 가장 효율적이다.',                        dimension: 'S', weight:  1 },
  { id: 20, text: '위기 상황에서도 침착하고 차분하게 반응하는 편이다.',                               dimension: 'S', weight:  1 },
  { id: 21, text: '팀원이 힘들어할 때 먼저 다가가서 지지와 도움을 제공한다.',                         dimension: 'S', weight:  1 },
  // ── C (신중형 / Conscientiousness) ───────────────────────────
  { id: 22, text: '업무를 시작하기 전에 충분한 자료와 정보를 수집·분석한다.',                         dimension: 'C', weight:  1 },
  { id: 23, text: '세부 사항의 오류를 방지하기 위해 여러 차례 검토하고 확인한다.',                    dimension: 'C', weight:  1 },
  { id: 24, text: '데이터와 사실에 근거한 의사결정이 직관적 판단보다 신뢰할 수 있다.',                 dimension: 'C', weight:  1 },
  { id: 25, text: '정확성과 품질은 속도보다 항상 더 중요하다고 생각한다.',                            dimension: 'C', weight:  1 },
  { id: 26, text: '규정, 절차, 품질 기준을 철저히 준수하는 것이 기본이라 여긴다.',                    dimension: 'C', weight:  1 },
  { id: 27, text: '업무 시작 전에 명확한 기대치, 기준, 방향을 파악해야 안심이 된다.',                  dimension: 'C', weight:  1 },
  { id: 28, text: '부정적 피드백이나 비판을 받을 때 자신에 대한 평가로 받아들이는 편이다.',             dimension: 'C', weight:  1 },
];

// ══════════════════════════════════════════════════════════════
// KIT 2 — DISC Types
// ══════════════════════════════════════════════════════════════

const DISC_TYPES = {
  D: {
    ko: '주도형', emoji: '🦁',
    desc: '결단력 있고 도전 지향적인 성과 중심 리더. 높은 목표를 설정하고 과감하게 추진합니다.',
    strengths: ['빠른 의사결정', '목표 달성 추진력', '도전적 사고', '리더십'],
    growth: ['세부 사항 주의', '타인 감정 배려', '인내심', '경청'],
    work_style: '직접적이고 결과 중심적으로 행동합니다. 속도를 중시하며 권한 위임을 선호합니다.',
    stress_behavior: '조급해지거나 독단적이 될 수 있으며, 통제력을 잃는 상황을 힘들어합니다.',
    motivation: '도전, 권한, 성과, 경쟁',
    ideal_env: '자율성이 높고 도전적인 목표가 있는 환경',
  },
  I: {
    ko: '사교형', emoji: '🦋',
    desc: '열정적이고 설득력 있는 관계 중심 인플루언서. 긍정적 분위기로 팀을 이끕니다.',
    strengths: ['관계 형성', '설득력', '창의적 브레인스토밍', '팀 동기부여'],
    growth: ['마무리·완결성', '세부 사항 집중', '시간 관리', '객관적 분석'],
    work_style: '사람과의 관계를 통해 성과를 만들어냅니다. 표현이 풍부하고 낙관적입니다.',
    stress_behavior: '과잉 약속이나 감정적 반응이 나타날 수 있으며, 거절을 힘들어합니다.',
    motivation: '인정, 관계, 자유, 재미',
    ideal_env: '다양한 사람과 교류하고 창의성을 발휘할 수 있는 환경',
  },
  S: {
    ko: '안정형', emoji: '🌲',
    desc: '신뢰할 수 있고 일관된 팀의 든든한 버팀목. 조화와 지속성을 가장 중요시합니다.',
    strengths: ['신뢰성', '인내심', '팀 조화', '경청·공감'],
    growth: ['변화 주도', '직접적 자기주장', '우선순위 설정', '빠른 결단'],
    work_style: '꾸준하고 예측 가능하게 행동합니다. 갈등을 최소화하고 팀을 지원합니다.',
    stress_behavior: '변화에 저항하거나 갈등을 지나치게 회피할 수 있습니다.',
    motivation: '안정성, 조화, 팀 협력, 진정한 감사',
    ideal_env: '명확한 역할과 안정적인 인간관계가 있는 환경',
  },
  C: {
    ko: '신중형', emoji: '🔭',
    desc: '정확하고 분석적인 품질 지향 전문가. 높은 기준을 설정하고 철저하게 실행합니다.',
    strengths: ['정확성·품질', '체계적 분석', '문제 예방', '전문성'],
    growth: ['빠른 결정', '감정 표현', '불완전성 수용', '사람 중심 소통'],
    work_style: '신중하고 분석적으로 접근합니다. 충분한 정보를 바탕으로 결론을 도출합니다.',
    stress_behavior: '과도한 분석 마비나 완벽주의로 마감을 놓칠 수 있습니다.',
    motivation: '정확성, 전문성, 명확한 기대, 질적 성과',
    ideal_env: '명확한 기준·절차가 있고 전문성이 존중받는 환경',
  },
  DI: {
    ko: '개척형', emoji: '🚀',
    desc: '주도적이면서도 대인관계가 탁월한 카리스마형 리더.',
    strengths: ['비전 제시', '팀 동기부여', '결단과 설득'],
    growth: ['세부 실행', '안정적 마무리'],
    work_style: '높은 에너지로 팀을 이끌며 새로운 가능성을 만들어냅니다.',
    stress_behavior: '과부하 시 충동적 결정.',
    motivation: '영향력, 성취',
    ideal_env: '역동적인 변화 주도 환경',
  },
  IS: {
    ko: '조력형', emoji: '🌟',
    desc: '사람을 우선하며 따뜻한 신뢰로 팀을 연결하는 조력자.',
    strengths: ['관계 유지', '팀 지원', '공감적 리더십'],
    growth: ['자기주장', '빠른 결정'],
    work_style: '사람과 팀을 최우선에 두고 협력으로 결과를 만듭니다.',
    stress_behavior: '자기 필요를 무시하며 과부하.',
    motivation: '관계, 인정',
    ideal_env: '사람 중심 협업 환경',
  },
  SC: {
    ko: '전문가형', emoji: '🧪',
    desc: '꼼꼼하고 안정적인 신뢰할 수 있는 실무 전문가.',
    strengths: ['정확성', '체계적 실행', '품질'],
    growth: ['변화 수용', '주도적 의사소통'],
    work_style: '규정과 프로세스를 철저히 따르며 최고 품질을 추구합니다.',
    stress_behavior: '변화 시 불안과 과도한 확인.',
    motivation: '정확성, 안정',
    ideal_env: '명확한 절차와 전문성이 존중되는 환경',
  },
  CD: {
    ko: '혁신분석형', emoji: '⚙️',
    desc: '논리적이고 결과 지향적인 고효율 문제 해결사.',
    strengths: ['분석적 의사결정', '정확한 실행', '문제 해결'],
    growth: ['대인 관계', '감정적 유연성'],
    work_style: '데이터와 논리로 최적 결론을 도출하고 신속히 실행합니다.',
    stress_behavior: '비판적이거나 냉담하게 보일 수 있음.',
    motivation: '효율, 정확성, 성과',
    ideal_env: '성과 중심 전문 환경',
  },
};

// ══════════════════════════════════════════════════════════════
// KIT 3 — Birkman Questions (40 items, 10 per quadrant)
// ══════════════════════════════════════════════════════════════

const BIRKMAN_QUESTIONS = [
  // ── RED (직접형) ──────────────────────────────────────────────
  { id:  1, text: '결과를 달성하기 위해 속도를 높이고 장애물을 직접 제거한다.',                       dimension: 'RED',    weight: 1 },
  { id:  2, text: '권한을 갖고 독립적으로 결정을 내리는 것이 자연스럽다.',                            dimension: 'RED',    weight: 1 },
  { id:  3, text: '경쟁적인 상황에서 최고가 되고자 하는 강한 욕구를 느낀다.',                         dimension: 'RED',    weight: 1 },
  { id:  4, text: '다른 사람의 눈치보다 효율과 결과를 더 우선한다.',                                  dimension: 'RED',    weight: 1 },
  { id:  5, text: '변화를 주도하고 새로운 도전을 시작하는 것을 즐긴다.',                              dimension: 'RED',    weight: 1 },
  { id:  6, text: '직접적이고 솔직한 피드백을 주고받는 것이 관계를 더 견고하게 만든다.',               dimension: 'RED',    weight: 1 },
  { id:  7, text: '과정보다 결과로 나 자신을 평가하고 싶다.',                                        dimension: 'RED',    weight: 1 },
  { id:  8, text: '압박이 심한 상황에서도 명확한 목표와 행동 계획을 유지한다.',                        dimension: 'RED',    weight: 1 },
  { id:  9, text: '리스크가 있더라도 대담한 결정을 선택하는 편이다.',                                 dimension: 'RED',    weight: 1 },
  { id: 10, text: '팀이 막혀 있을 때 내가 먼저 방향을 제시하고 돌파구를 만든다.',                     dimension: 'RED',    weight: 1 },
  // ── YELLOW (사교형) ───────────────────────────────────────────
  { id: 11, text: '다양한 사람과 어울리며 새로운 아이디어와 가능성을 탐색하는 것이 즐겁다.',            dimension: 'YELLOW', weight: 1 },
  { id: 12, text: '나의 열정과 낙관주의가 팀 분위기에 긍정적 영향을 미친다.',                         dimension: 'YELLOW', weight: 1 },
  { id: 13, text: '사람들이 나를 통해 영감을 얻거나 동기를 부여받는 경우가 있다.',                     dimension: 'YELLOW', weight: 1 },
  { id: 14, text: '네트워킹과 관계 형성이 나의 업무 추진 방식의 핵심이다.',                           dimension: 'YELLOW', weight: 1 },
  { id: 15, text: '프레젠테이션, 발표, 설득 상황에서 에너지가 솟구친다.',                             dimension: 'YELLOW', weight: 1 },
  { id: 16, text: '팀원들이 나를 접근하기 쉽고 따뜻한 사람으로 인식하길 원한다.',                     dimension: 'YELLOW', weight: 1 },
  { id: 17, text: '협업 과정에서 아이디어를 공유하고 다른 관점을 통합하는 것을 즐긴다.',               dimension: 'YELLOW', weight: 1 },
  { id: 18, text: '자유로운 분위기에서 창의적 사고가 최대로 발현된다.',                               dimension: 'YELLOW', weight: 1 },
  { id: 19, text: '새로운 사람을 만나는 상황에서 먼저 다가가 대화를 시작한다.',                        dimension: 'YELLOW', weight: 1 },
  { id: 20, text: '목표 달성보다 과정에서 사람들과 함께 성장하는 것이 더 중요하다.',                   dimension: 'YELLOW', weight: 1 },
  // ── GREEN (지원형) ────────────────────────────────────────────
  { id: 21, text: '팀원이 어려움을 겪을 때 조용히 옆에서 도움을 제공하는 것이 의미 있다.',             dimension: 'GREEN',  weight: 1 },
  { id: 22, text: '신뢰와 충성심이 업무 관계의 가장 중요한 가치라고 생각한다.',                        dimension: 'GREEN',  weight: 1 },
  { id: 23, text: '변화가 많은 환경보다 안정적이고 예측 가능한 환경에서 더 잘 일한다.',                dimension: 'GREEN',  weight: 1 },
  { id: 24, text: '나는 팀의 지속적이고 일관된 지원자 역할을 자연스럽게 맡는다.',                      dimension: 'GREEN',  weight: 1 },
  { id: 25, text: '다른 사람의 감정 변화나 심리적 상태를 민감하게 포착한다.',                         dimension: 'GREEN',  weight: 1 },
  { id: 26, text: '그룹 내 갈등이 생기면 자연스럽게 중재자 역할을 맡는다.',                           dimension: 'GREEN',  weight: 1 },
  { id: 27, text: '오랫동안 한 조직에 헌신하며 안정적인 관계를 쌓는 것을 선호한다.',                   dimension: 'GREEN',  weight: 1 },
  { id: 28, text: '칭찬보다 조용히 감사를 받는 것이 더 진심어린 인정으로 느껴진다.',                   dimension: 'GREEN',  weight: 1 },
  { id: 29, text: '서두르는 결정보다 충분한 공감과 논의를 거친 합의를 선호한다.',                      dimension: 'GREEN',  weight: 1 },
  { id: 30, text: '팀의 분위기가 좋아야 내 개인 성과도 높아진다고 생각한다.',                         dimension: 'GREEN',  weight: 1 },
  // ── BLUE (분석형) ─────────────────────────────────────────────
  { id: 31, text: '충분한 자료와 데이터를 확보한 후에야 결론을 내리는 것이 안전하다.',                  dimension: 'BLUE',   weight: 1 },
  { id: 32, text: '업무의 모든 세부 사항이 정확하게 처리되어야 한다고 생각한다.',                      dimension: 'BLUE',   weight: 1 },
  { id: 33, text: '체계적인 계획과 명확한 기준 없이 일을 시작하는 것이 불편하다.',                     dimension: 'BLUE',   weight: 1 },
  { id: 34, text: '복잡한 문제를 구조적으로 분해하고 단계별로 해결하는 것이 자연스럽다.',               dimension: 'BLUE',   weight: 1 },
  { id: 35, text: '품질보다 속도를 우선시하는 문화에서는 일하기가 어렵다.',                            dimension: 'BLUE',   weight: 1 },
  { id: 36, text: '혼자 깊이 집중하는 시간이 팀 회의보다 더 생산적으로 느껴진다.',                     dimension: 'BLUE',   weight: 1 },
  { id: 37, text: '규칙과 절차가 명확하게 정의된 조직에서 안정감을 느낀다.',                           dimension: 'BLUE',   weight: 1 },
  { id: 38, text: '비판적 검토와 독립적 분석을 통해 최선의 결론을 도출한다.',                         dimension: 'BLUE',   weight: 1 },
  { id: 39, text: '내가 만드는 결과물은 언제나 기준 이상의 품질을 갖춰야 한다.',                       dimension: 'BLUE',   weight: 1 },
  { id: 40, text: '감정보다 논리와 데이터에 근거한 의사결정을 신뢰한다.',                              dimension: 'BLUE',   weight: 1 },
];

// ══════════════════════════════════════════════════════════════
// KIT 3 — Birkman Types
// ══════════════════════════════════════════════════════════════

const BIRKMAN_TYPES = {
  RED: {
    ko: '직접형 (Red)', emoji: '🔴',
    desc: '행동 지향적이고 결과 중심적인 직접형. 빠른 실행과 명확한 책임감으로 성과를 만들어냅니다.',
    strengths: ['빠른 실행력', '결과 집중', '도전 정신', '리더십'],
    growth: ['타인 감정 배려', '과정 중시', '팀 기여 인정', '인내심'],
    work_style: '직접적이고 속도감 있게 일합니다. 자율성과 권한이 주어진 환경에서 최고 성과를 발휘합니다.',
    needs: '명확한 목표, 의사결정 권한, 빠른 피드백, 경쟁 환경',
    stress_behavior: '권한이 제한되거나 의사결정이 늦어질 때 독단적이거나 조급해집니다.',
    ideal_roles: ['사업개발', '경영진', '프로젝트 리더', '스타트업 창업가'],
  },
  YELLOW: {
    ko: '사교형 (Yellow)', emoji: '🟡',
    desc: '관계 지향적이고 표현이 풍부한 사교형. 영감과 에너지로 사람들을 연결하고 동기를 부여합니다.',
    strengths: ['관계 형성', '동기 부여', '창의적 아이디어', '유연한 소통'],
    growth: ['마무리·실행력', '세부 사항 집중', '객관적 분석', '시간 관리'],
    work_style: '다양한 사람과의 교류를 통해 에너지를 얻고 창의적 환경에서 탁월합니다.',
    needs: '사회적 인정, 창의적 자유, 다양한 관계, 협업적 분위기',
    stress_behavior: '인정받지 못하거나 고립될 때 과잉 약속이나 산만함이 나타납니다.',
    ideal_roles: ['마케팅·PR', 'HR HRBP', '영업', '코칭·퍼실리테이터'],
  },
  GREEN: {
    ko: '지원형 (Green)', emoji: '🟢',
    desc: '신뢰롭고 일관된 팀의 안전망. 공감과 헌신으로 조직의 심리적 안전을 지킵니다.',
    strengths: ['신뢰성', '공감·경청', '팀 응집력', '인내심'],
    growth: ['변화 주도', '직접적 자기주장', '빠른 적응', '자기 경계 설정'],
    work_style: '조용하고 일관되게 팀을 지원합니다. 신뢰 기반의 장기적 관계를 통해 성과를 만듭니다.',
    needs: '안정적 환경, 신뢰 관계, 충분한 적응 시간, 진정한 감사',
    stress_behavior: '변화가 급격하거나 신뢰가 깨질 때 저항하거나 내부로 침잠합니다.',
    ideal_roles: ['L&D', '고객 성공', '운영 관리', '멘토·코치'],
  },
  BLUE: {
    ko: '분석형 (Blue)', emoji: '🔵',
    desc: '논리적이고 체계적인 심층 분석가. 높은 기준과 정밀한 사고로 복잡한 문제를 해결합니다.',
    strengths: ['분석적 사고', '정확성', '독립적 판단', '전문성'],
    growth: ['빠른 결정', '감정 표현', '불완전성 수용', '대인 유연성'],
    work_style: '충분한 정보를 바탕으로 심층 분석 후 행동합니다. 혼자 집중하는 환경에서 최고 성과를 냅니다.',
    needs: '명확한 기준, 분석 시간, 자율적 심층 작업, 전문성 인정',
    stress_behavior: '정보가 불충분하거나 품질 기준이 낮을 때 과도하게 비판적이거나 마비됩니다.',
    ideal_roles: ['데이터 분석', '전략 기획', '재무', '연구개발', 'IT 아키텍처'],
  },
};

// ══════════════════════════════════════════════════════════════
// KIT 4 — Interview Questions (30 items, 5 per competency)
// ══════════════════════════════════════════════════════════════

const INTERVIEW_QUESTIONS = [
  // ── LEADERSHIP (리더십) ───────────────────────────────────────
  { id:  1, text: '나는 팀이 방향을 잃었을 때 명확한 비전을 제시하고 행동을 이끌 수 있다.',            dimension: 'LEADERSHIP',     weight: 1 },
  { id:  2, text: '구성원의 강점을 파악하여 역할을 배분하고 팀 성과를 극대화한 경험이 있다.',           dimension: 'LEADERSHIP',     weight: 1 },
  { id:  3, text: '직급이나 권한이 없어도 설득과 협력으로 팀을 목표로 이끈 경험이 있다.',              dimension: 'LEADERSHIP',     weight: 1 },
  { id:  4, text: '어려운 의사결정을 내려야 할 때 원칙에 기반한 판단을 유지할 수 있다.',               dimension: 'LEADERSHIP',     weight: 1 },
  { id:  5, text: '내 리더십 스타일과 팀원들에게 미치는 영향에 대해 명확하게 설명할 수 있다.',          dimension: 'LEADERSHIP',     weight: 1 },
  // ── PROBLEM_SOLVING (문제해결력) ──────────────────────────────
  { id:  6, text: '모호한 상황에서도 핵심 문제를 정의하고 구조화하여 접근하는 능력이 있다.',            dimension: 'PROBLEM_SOLVING', weight: 1 },
  { id:  7, text: '데이터와 정성적 정보를 통합하여 실질적인 해결책을 도출한 경험이 있다.',             dimension: 'PROBLEM_SOLVING', weight: 1 },
  { id:  8, text: '기존 방식이 효과가 없을 때 창의적 대안을 찾아 실험하고 개선한 경험이 있다.',         dimension: 'PROBLEM_SOLVING', weight: 1 },
  { id:  9, text: '문제 해결 과정에서 이해관계자의 의견을 수렴하고 합의를 이끌어낸 경험이 있다.',       dimension: 'PROBLEM_SOLVING', weight: 1 },
  { id: 10, text: '내가 해결한 복잡한 문제의 사례를 STAR 방식(상황-과제-행동-결과)으로 설명할 수 있다.', dimension: 'PROBLEM_SOLVING', weight: 1 },
  // ── COLLABORATION (협업·팀워크) ───────────────────────────────
  { id: 11, text: '의견 충돌이 있는 팀 상황에서도 신뢰를 유지하며 협력 결과를 이끌어낸 경험이 있다.',   dimension: 'COLLABORATION',  weight: 1 },
  { id: 12, text: '다양한 배경과 관점을 가진 구성원과 효과적으로 함께 일할 수 있다.',                  dimension: 'COLLABORATION',  weight: 1 },
  { id: 13, text: '나의 기여가 드러나지 않더라도 팀 목표를 위해 역할을 수행한 경험이 있다.',            dimension: 'COLLABORATION',  weight: 1 },
  { id: 14, text: '팀원의 실수나 어려움을 발견했을 때 건설적으로 지원하고 함께 해결한 경험이 있다.',     dimension: 'COLLABORATION',  weight: 1 },
  { id: 15, text: '내가 팀에서 맡는 전형적인 역할과 그것이 팀 성과에 기여하는 방식을 설명할 수 있다.',   dimension: 'COLLABORATION',  weight: 1 },
  // ── COMMUNICATION (커뮤니케이션) ──────────────────────────────
  { id: 16, text: '복잡한 내용을 다양한 청중의 수준에 맞게 명확하게 설명할 수 있다.',                   dimension: 'COMMUNICATION', weight: 1 },
  { id: 17, text: '어려운 메시지(거절, 비판, 나쁜 소식)를 적절하고 솔직하게 전달한 경험이 있다.',        dimension: 'COMMUNICATION', weight: 1 },
  { id: 18, text: '상대방의 의도를 정확히 파악하기 위해 경청하고 확인 질문을 하는 편이다.',              dimension: 'COMMUNICATION', weight: 1 },
  { id: 19, text: '서면(보고서, 이메일, 제안서)과 구두 발표 모두에서 설득력 있게 전달할 수 있다.',       dimension: 'COMMUNICATION', weight: 1 },
  { id: 20, text: '다른 부서나 이해관계자와의 커뮤니케이션에서 오해를 예방하고 해소한 경험이 있다.',      dimension: 'COMMUNICATION', weight: 1 },
  // ── ADAPTABILITY (변화적응력) ──────────────────────────────────
  { id: 21, text: '갑작스러운 우선순위 변경이나 계획 변경 상황에서 유연하게 대응한 경험이 있다.',         dimension: 'ADAPTABILITY',  weight: 1 },
  { id: 22, text: '익숙하지 않은 영역이나 새로운 기술을 빠르게 습득하여 성과를 낸 경험이 있다.',          dimension: 'ADAPTABILITY',  weight: 1 },
  { id: 23, text: '실패나 좌절 이후 원인을 분석하고 더 나은 방법으로 재도전한 경험이 있다.',              dimension: 'ADAPTABILITY',  weight: 1 },
  { id: 24, text: '조직 변화(구조 개편, 전략 전환)의 불확실성을 긍정적으로 수용하고 적응한 경험이 있다.', dimension: 'ADAPTABILITY',  weight: 1 },
  { id: 25, text: '내가 성장한 가장 큰 실패 경험을 구체적으로 설명하고 교훈을 도출할 수 있다.',           dimension: 'ADAPTABILITY',  weight: 1 },
  // ── ACHIEVEMENT (성과지향성) ───────────────────────────────────
  { id: 26, text: '명확한 목표를 설정하고 측정 가능한 결과를 만들어낸 경험이 구체적으로 있다.',           dimension: 'ACHIEVEMENT',   weight: 1 },
  { id: 27, text: '목표 달성이 어려울 것으로 보일 때도 포기하지 않고 대안을 찾아 완수한 경험이 있다.',    dimension: 'ACHIEVEMENT',   weight: 1 },
  { id: 28, text: '내 업무 성과를 정량·정성적 지표로 측정하고 개선한 경험이 있다.',                     dimension: 'ACHIEVEMENT',   weight: 1 },
  { id: 29, text: '경쟁적이거나 압박이 높은 상황에서도 집중력을 유지하며 높은 성과를 낸 경험이 있다.',    dimension: 'ACHIEVEMENT',   weight: 1 },
  { id: 30, text: '가장 자랑스러운 성과를 수치와 맥락을 포함하여 명확하게 설명할 수 있다.',               dimension: 'ACHIEVEMENT',   weight: 1 },
];

// ══════════════════════════════════════════════════════════════
// KIT 4 — Interview Types (competency profiles)
// ══════════════════════════════════════════════════════════════

const INTERVIEW_TYPES = {
  LEADERSHIP: {
    ko: '리더십 역량', emoji: '👑',
    desc: '방향 제시와 팀 동기부여',
    level_desc: {
      5: '탁월 - 복잡한 조직 변화를 이끈 검증된 리더십 사례 보유',
      4: '우수 - 다양한 리더십 경험과 구체적 성과 보유',
      3: '보통 - 기본적 리더십 경험 있음, 확장 필요',
      2: '개발 필요 - 리더십 개념 이해하나 경험 부족',
      1: '초기 단계 - 리더십 역할 경험 매우 제한적',
    },
  },
  PROBLEM_SOLVING: {
    ko: '문제해결력', emoji: '🔍',
    desc: '복잡한 문제 구조화 및 해결',
    level_desc: {
      5: '탁월 - 구조적·창의적 문제 해결 다수 사례 및 임팩트',
      4: '우수 - 체계적 접근으로 복잡한 문제 해결 경험 다수',
      3: '보통 - 기본적 문제해결 능력, 복잡도 향상 필요',
      2: '개발 필요 - 방법론 이해하나 실전 경험 부족',
      1: '초기 단계 - 구조적 문제해결 경험 매우 제한적',
    },
  },
  COLLABORATION: {
    ko: '협업·팀워크', emoji: '🤝',
    desc: '다양한 구성원과의 시너지',
    level_desc: {
      5: '탁월 - 다기능 팀에서의 협업 리더십 및 갈등 해소 사례',
      4: '우수 - 다양한 협업 상황에서 긍정적 기여 경험 다수',
      3: '보통 - 협업 경험 있음, 다양성 확장 필요',
      2: '개발 필요 - 협업 의지 있으나 경험 제한적',
      1: '초기 단계 - 팀 협업 경험 매우 초기 수준',
    },
  },
  COMMUNICATION: {
    ko: '커뮤니케이션', emoji: '💬',
    desc: '명확한 전달 및 경청',
    level_desc: {
      5: '탁월 - 다양한 청중 대상 고수준 구두·서면 커뮤니케이션',
      4: '우수 - 설득력 있는 발표 및 보고서 작성 경험 다수',
      3: '보통 - 기본 커뮤니케이션 역량, 정교화 필요',
      2: '개발 필요 - 명확한 전달에 어려움, 훈련 필요',
      1: '초기 단계 - 구조적 커뮤니케이션 경험 초기',
    },
  },
  ADAPTABILITY: {
    ko: '변화적응력', emoji: '🌊',
    desc: '불확실성 속 유연한 대응',
    level_desc: {
      5: '탁월 - 대규모 변화 상황에서 탄력적 리더십 발휘',
      4: '우수 - 여러 변화 상황에서 적응과 성장 경험 명확',
      3: '보통 - 적응 의지 있음, 고강도 변화 경험 필요',
      2: '개발 필요 - 변화 상황에서 불안이 높아 지원 필요',
      1: '초기 단계 - 변화 대응 경험 매우 제한적',
    },
  },
  ACHIEVEMENT: {
    ko: '성과지향성', emoji: '🎯',
    desc: '목표 설정과 달성 집착',
    level_desc: {
      5: '탁월 - 어려운 목표를 수치로 달성한 다수의 강력한 사례',
      4: '우수 - 측정 가능한 성과를 지속 달성한 트랙레코드',
      3: '보통 - 성과 지향성 있음, 임팩트 수준 향상 필요',
      2: '개발 필요 - 성과 목표 설정 및 측정 훈련 필요',
      1: '초기 단계 - 성과 기반 사고 및 경험 초기 단계',
    },
  },
};

// ══════════════════════════════════════════════════════════════
// KIT 5 — Holland RIASEC Questions (30 items, 5 per type)
// ══════════════════════════════════════════════════════════════

const HOLLAND_QUESTIONS = [
  // ── R (현실형 / Realistic) ────────────────────────────────────
  { id:  1, text: '기계나 장비를 직접 다루고 수리하는 작업이 흥미롭다.',                              dimension: 'R', weight: 1 },
  { id:  2, text: '컴퓨터, 장비, 도구를 사용하는 실무 기술을 익히는 것이 좋다.',                      dimension: 'R', weight: 1 },
  { id:  3, text: '야외 활동이나 신체를 사용하는 업무가 사무직보다 더 적합하다.',                      dimension: 'R', weight: 1 },
  { id:  4, text: '구체적이고 실용적인 결과물을 만들어내는 작업에서 만족감을 느낀다.',                  dimension: 'R', weight: 1 },
  { id:  5, text: '데이터나 이론보다 실제로 손으로 만지고 구현하는 작업이 더 재미있다.',               dimension: 'R', weight: 1 },
  // ── I (탐구형 / Investigative) ───────────────────────────────
  { id:  6, text: '복잡한 문제의 원인을 분석하고 이론을 검증하는 과정이 즐겁다.',                      dimension: 'I', weight: 1 },
  { id:  7, text: '새로운 지식을 학습하고 현상을 이해하는 데 시간 가는 줄 모른다.',                    dimension: 'I', weight: 1 },
  { id:  8, text: '데이터와 증거에 기반해 결론을 도출하는 작업이 가장 보람차다.',                      dimension: 'I', weight: 1 },
  { id:  9, text: '가설을 세우고 실험·검증을 통해 답을 찾는 방식을 선호한다.',                        dimension: 'I', weight: 1 },
  { id: 10, text: '과학적·논리적 방법으로 세상의 작동 원리를 이해하고 싶다.',                         dimension: 'I', weight: 1 },
  // ── A (예술형 / Artistic) ────────────────────────────────────
  { id: 11, text: '글쓰기, 그림, 음악, 디자인 등 창의적 표현 활동이 즐겁다.',                         dimension: 'A', weight: 1 },
  { id: 12, text: '정해진 틀 없이 자유롭게 아이디어를 표현할 수 있는 환경을 선호한다.',                dimension: 'A', weight: 1 },
  { id: 13, text: '미적 감각과 창의성을 활용하는 업무에서 더 좋은 성과를 낸다.',                      dimension: 'A', weight: 1 },
  { id: 14, text: '독창적인 방법으로 문제를 해결하거나 새로운 것을 만드는 일이 흥미롭다.',              dimension: 'A', weight: 1 },
  { id: 15, text: '예술, 문화, 디자인 분야의 작업이 나의 강점과 잘 맞는다고 생각한다.',               dimension: 'A', weight: 1 },
  // ── S (사회형 / Social) ───────────────────────────────────────
  { id: 16, text: '다른 사람의 성장과 발전을 돕는 일에서 강한 의미를 찾는다.',                        dimension: 'S', weight: 1 },
  { id: 17, text: '교육, 코칭, 상담을 통해 타인의 문제를 해결하는 것이 보람차다.',                    dimension: 'S', weight: 1 },
  { id: 18, text: '팀원이나 지인이 어려울 때 먼저 다가가 지지하고 조언한다.',                         dimension: 'S', weight: 1 },
  { id: 19, text: '사람 중심의 서비스·복지·교육 관련 일이 적성에 맞는다.',                           dimension: 'S', weight: 1 },
  { id: 20, text: '개인보다 집단의 이익과 사회적 가치를 우선시하는 편이다.',                          dimension: 'S', weight: 1 },
  // ── E (진취형 / Enterprising) ────────────────────────────────
  { id: 21, text: '사업 아이디어를 구상하고 직접 추진하는 기업가적 활동이 매력적이다.',                dimension: 'E', weight: 1 },
  { id: 22, text: '사람들을 설득하고 행동을 이끄는 역할이 자연스럽게 느껴진다.',                       dimension: 'E', weight: 1 },
  { id: 23, text: '협상, 영업, 마케팅처럼 목표를 설정하고 달성하는 활동이 즐겁다.',                    dimension: 'E', weight: 1 },
  { id: 24, text: '조직에서 리더십을 발휘하고 의사결정을 주도하는 위치를 목표로 한다.',                dimension: 'E', weight: 1 },
  { id: 25, text: '경쟁적인 비즈니스 환경에서 성과를 만들어내는 일이 의욕을 높인다.',                 dimension: 'E', weight: 1 },
  // ── C (관습형 / Conventional) ────────────────────────────────
  { id: 26, text: '문서, 데이터, 숫자를 정확하게 처리하고 관리하는 업무가 적성에 맞는다.',              dimension: 'C', weight: 1 },
  { id: 27, text: '명확한 규정과 절차에 따라 체계적으로 일하는 환경을 선호한다.',                      dimension: 'C', weight: 1 },
  { id: 28, text: '회계, 법무, 행정, 재무 등 정밀성이 요구되는 업무에 강하다.',                       dimension: 'C', weight: 1 },
  { id: 29, text: '데이터를 정리하고 체계화하는 작업에서 만족감을 느낀다.',                            dimension: 'C', weight: 1 },
  { id: 30, text: '세부 사항과 정확성이 가장 중요한 업무에서 최고의 성과를 낸다.',                     dimension: 'C', weight: 1 },
];

// ══════════════════════════════════════════════════════════════
// KIT 5 — Holland Types
// ══════════════════════════════════════════════════════════════

const HOLLAND_TYPES = {
  R: {
    ko: '현실형', emoji: '🔧',
    desc: '실용적이고 현실적인 문제 해결사. 구체적인 도구와 기술 활용을 선호합니다.',
    strengths: ['기술적 능숙', '실용적 판단', '체계적 실행', '문제 해결'],
    growth: ['추상적 사고', '창의적 표현', '대인 관계', '이론 학습'],
    work_style: '직접 손으로 만들고 실행합니다. 명확한 결과물에 만족감을 느낍니다.',
    careers: ['엔지니어', '건축가', 'IT 시스템 관리자', '제조·생산 관리', '데이터 엔지니어', '품질 관리'],
    ideal_env: '실무 중심, 도구·기술 활용, 명확한 결과물',
  },
  I: {
    ko: '탐구형', emoji: '🔬',
    desc: '지적 호기심이 넘치는 분석가. 데이터와 논리로 세상의 원리를 탐구합니다.',
    strengths: ['분석적 사고', '연구 능력', '개념화', '독립적 문제 해결'],
    growth: ['실용적 실행', '리더십', '설득력', '감정적 공감'],
    work_style: '깊이 있는 연구와 분석을 통해 통찰을 도출합니다.',
    careers: ['데이터 사이언티스트', '연구원', '컨설턴트', '의사', '약사', 'UX 리서처', '전략 기획'],
    ideal_env: '연구·분석 중심, 지적 자율성, 전문성 존중',
  },
  A: {
    ko: '예술형', emoji: '🎨',
    desc: '창의적이고 독창적인 표현가. 새로운 아이디어와 미적 감각으로 가치를 만듭니다.',
    strengths: ['창의성', '독창적 사고', '심미적 감각', '표현력'],
    growth: ['구조·체계 수용', '반복 업무 인내', '데이터 활용', '상업적 관점'],
    work_style: '자유로운 환경에서 창의적 탐구를 통해 작업합니다.',
    careers: ['UX·UI 디자이너', '콘텐츠 크리에이터', '브랜드 매니저', '작가', '광고 기획', '영상 프로듀서'],
    ideal_env: '자율적·창의적 환경, 심미적 가치, 표현의 자유',
  },
  S: {
    ko: '사회형', emoji: '🤝',
    desc: '타인의 성장을 돕는 공감적 지원자. 교육과 상담으로 사람과 사회에 기여합니다.',
    strengths: ['공감 능력', '코칭·육성', '팀 지원', '갈등 조율'],
    growth: ['독립적 분석', '데이터 기반 판단', '자기주장', '경쟁 환경 적응'],
    work_style: '사람과의 관계 속에서 의미를 찾고 타인을 돕는 데 에너지를 씁니다.',
    careers: ['HR HRBP', 'L&D 담당자', '심리상담사', '교육 기획', '사회복지사', '고객 성공 매니저'],
    ideal_env: '사람 중심, 협력적, 사회적 가치 지향',
  },
  E: {
    ko: '진취형', emoji: '🚀',
    desc: '목표 지향적인 추진력의 기업가. 사람을 이끌고 비즈니스 성과를 창출합니다.',
    strengths: ['리더십', '설득력', '사업 감각', '성과 추진력'],
    growth: ['세부 사항 주의', '분석적 사고', '경청', '안정성 유지'],
    work_style: '도전적인 목표를 설정하고 팀을 이끌며 결과를 만들어냅니다.',
    careers: ['사업개발', '영업·마케팅 리더', 'CEO·창업가', '투자 심사역', '프로덕트 매니저', '전략 컨설턴트'],
    ideal_env: '경쟁적·결과 중심, 리더십 발휘, 자율적 환경',
  },
  C: {
    ko: '관습형', emoji: '📐',
    desc: '체계적이고 정확한 데이터 관리자. 명확한 절차와 높은 정확성으로 조직을 지탱합니다.',
    strengths: ['정확성', '체계적 관리', '데이터 처리', '규정 준수'],
    growth: ['창의적 사고', '변화 적응', '자율적 판단', '불확실성 수용'],
    work_style: '명확한 기준과 프로세스 안에서 최고의 정확성을 추구합니다.',
    careers: ['재무·회계', '법무 컴플라이언스', '데이터 분석가', '경영 기획', '품질 관리', '운영 관리'],
    ideal_env: '구조화된 절차, 정확성 중시, 안정적 환경',
  },
};

// ══════════════════════════════════════════════════════════════
// Kit registry
// ══════════════════════════════════════════════════════════════

export const DIAGNOSTIC_KITS = [
  // ── 1. MBTI ───────────────────────────────────────────────────
  {
    id:             'KIT_MBTI',
    name_ko:        'MBTI 성격 유형 검사',
    type:           'personality',
    icon:           '🧠',
    color:          '#4F46E5',
    description_ko: '4가지 축(E/I, S/N, T/F, J/P)으로 개인의 성격 유형을 파악하고, 각 유형의 강점·성장 영역을 역량 개발에 연계합니다.',
    question_count: 20,
    active:         true,
    is_default:     true,
    vendor:         '자체',
    tag_ko:         '성격유형',
    format:         'binary',
    questions:      MBTI_QUESTIONS,
    types:          MBTI_TYPES,
  },

  // ── 2. DISC ───────────────────────────────────────────────────
  {
    id:             'KIT_DISC',
    name_ko:        'DISC 행동 유형 검사',
    type:           'behavioral',
    icon:           '📊',
    color:          '#10B981',
    description_ko: 'Dominance·Influence·Steadiness·Conscientiousness 4가지 행동 유형으로 직장 내 소통·업무 스타일을 진단합니다. 28문항으로 구성됩니다.',
    question_count: 28,
    active:         true,
    is_default:     false,
    vendor:         '자체',
    tag_ko:         '행동유형',
    format:         'likert5',
    questions:      DISC_QUESTIONS,
    types:          DISC_TYPES,
  },

  // ── 3. Birkman ────────────────────────────────────────────────
  {
    id:             'KIT_BIRKMAN',
    name_ko:        '버크만 스타일 조직행동 진단',
    type:           'behavioral',
    icon:           '🧩',
    color:          '#8B5CF6',
    description_ko: 'Red·Yellow·Green·Blue 4가지 조직행동 스타일로 개인의 실제 행동 패턴과 심리적 욕구를 진단합니다. 40문항으로 구성됩니다.',
    question_count: 40,
    active:         true,
    is_default:     false,
    vendor:         '자체',
    tag_ko:         '조직행동',
    format:         'likert5',
    questions:      BIRKMAN_QUESTIONS,
    types:          BIRKMAN_TYPES,
  },

  // ── 4. Interview ──────────────────────────────────────────────
  {
    id:             'KIT_INTERVIEW',
    name_ko:        '채용 인터뷰 역량 자가진단',
    type:           'interview',
    icon:           '🎤',
    color:          '#EF4444',
    description_ko: '채용 인터뷰 핵심 역량 6가지를 자가진단합니다. 직무 면접 준비 수준과 강점·보완 영역을 파악하세요.',
    question_count: 30,
    active:         true,
    is_default:     false,
    vendor:         '자체',
    tag_ko:         '인터뷰',
    format:         'likert5',
    questions:      INTERVIEW_QUESTIONS,
    types:          INTERVIEW_TYPES,
  },

  // ── 5. Holland RIASEC ─────────────────────────────────────────
  {
    id:             'KIT_HOLLAND',
    name_ko:        'Holland RIASEC 직업 흥미 검사',
    type:           'interest',
    icon:           '🎯',
    color:          '#F59E0B',
    description_ko: 'Holland RIASEC 모델 기반으로 6가지 직업 흥미 유형을 진단합니다. 나의 직업 적성과 최적 환경을 발견하세요.',
    question_count: 30,
    active:         true,
    is_default:     false,
    vendor:         '자체',
    tag_ko:         '직업흥미',
    format:         'likert5',
    questions:      HOLLAND_QUESTIONS,
    types:          HOLLAND_TYPES,
  },
];

/**
 * Returns only active kits.
 * @returns {Array}
 */
export function getActiveKits() {
  return DIAGNOSTIC_KITS.filter(k => k.active);
}

/**
 * Finds a kit by its id string.
 * @param {string} id
 * @returns {Object|undefined}
 */
export function getKitById(id) {
  return DIAGNOSTIC_KITS.find(k => k.id === id);
}
