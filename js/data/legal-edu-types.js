/**
 * legal-edu-types.js — 법정교육 유형 정의
 * 50인 사업장 의무 법정교육 4종
 */

export const LEGAL_EDU_TYPES = [
  {
    id:             'sexual_harassment',
    label:          '성희롱 예방교육',
    icon:           '🛡️',
    color:          '#EC4899',
    legalBasis:     '남녀고용평등법 제13조',
    frequencyMonths: 12,
    minHours:       1,
    desc:           '직장 내 성희롱 예방을 위한 연 1회 이상 의무 교육',
    penalty:        '500만원 이하 과태료',
  },
  {
    id:             'safety',
    label:          '산업안전보건교육',
    icon:           '⛑️',
    color:          '#F59E0B',
    legalBasis:     '산업안전보건법 제29조',
    frequencyMonths: 3,
    minHours:       6,
    desc:           '분기별 6시간 이상 의무 교육',
    penalty:        '500만원 이하 과태료',
  },
  {
    id:             'harassment_prevention',
    label:          '직장내 괴롭힘 예방교육',
    icon:           '🤝',
    color:          '#6366F1',
    legalBasis:     '근로기준법 제76조의3',
    frequencyMonths: 12,
    minHours:       1,
    desc:           '직장 내 괴롭힘 예방·대응을 위한 연 1회 의무 교육',
    penalty:        '500만원 과태료',
  },
  {
    id:             'privacy',
    label:          '개인정보보호교육',
    icon:           '🔒',
    color:          '#10B981',
    legalBasis:     '개인정보보호법 제28조',
    frequencyMonths: 12,
    minHours:       1,
    desc:           '개인정보 취급자 대상 연 1회 이상 의무 교육',
    penalty:        '1천만원 이하 과태료',
  },
];

export const LEGAL_EDU_MAP = Object.fromEntries(LEGAL_EDU_TYPES.map(t => [t.id, t]));

export const EDU_STATUS = {
  completed: { label: '이수 완료', icon: '✅', color: '#059669', bg: '#D1FAE5' },
  scheduled: { label: '예정',     icon: '📅', color: '#3B82F6', bg: '#DBEAFE' },
  overdue:   { label: '미이수',   icon: '⚠️', color: '#DC2626', bg: '#FEE2E2' },
};
