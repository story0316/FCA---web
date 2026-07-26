/**
 * leave-types.js — 휴가 유형 정의
 */

export const LEAVE_TYPES = [
  {
    id:               'annual',
    label:            '연차',
    icon:             '🌴',
    color:            '#4F46E5',
    isPaid:           true,
    deductsBalance:   true,
    requiresApproval: true,
    maxDays:          25,
    desc:             '근로기준법상 유급 연차휴가',
  },
  {
    id:               'half',
    label:            '반차',
    icon:             '🌤',
    color:            '#6366F1',
    isPaid:           true,
    deductsBalance:   true,
    requiresApproval: true,
    maxDays:          null,
    halfDayValue:     0.5,
    desc:             '오전/오후 반일 연차 (0.5일 차감)',
  },
  {
    id:               'sick',
    label:            '병가',
    icon:             '🏥',
    color:            '#EF4444',
    isPaid:           false,
    deductsBalance:   false,
    requiresApproval: false,
    maxDays:          60,
    desc:             '질병·부상으로 인한 무급 휴가',
  },
  {
    id:               'family',
    label:            '경조휴가',
    icon:             '🎊',
    color:            '#F59E0B',
    isPaid:           true,
    deductsBalance:   false,
    requiresApproval: true,
    maxDays:          5,
    desc:             '결혼·장례 등 경조사 유급 휴가',
  },
  {
    id:               'parental',
    label:            '육아휴직',
    icon:             '👶',
    color:            '#10B981',
    isPaid:           false,
    deductsBalance:   false,
    requiresApproval: true,
    maxDays:          365,
    desc:             '만 8세 이하 자녀 육아 (남녀고용평등법)',
  },
  {
    id:               'other',
    label:            '기타',
    icon:             '📋',
    color:            '#64748B',
    isPaid:           false,
    deductsBalance:   false,
    requiresApproval: true,
    maxDays:          null,
    desc:             '기타 사유 무급 휴가',
  },
];

export const LEAVE_TYPE_MAP = Object.fromEntries(LEAVE_TYPES.map(t => [t.id, t]));

export const LEAVE_STATUS = {
  pending:   { label: '검토 중', color: '#F59E0B', bg: '#FEF3C7', icon: '⏳' },
  approved:  { label: '승인',   color: '#059669', bg: '#D1FAE5', icon: '✅' },
  rejected:  { label: '반려',   color: '#DC2626', bg: '#FEE2E2', icon: '❌' },
  cancelled: { label: '취소',   color: '#94A3B8', bg: '#F1F5F9', icon: '⊘'  },
};
