/**
 * benefit-enroll.js — 선택적 복리후생 신청
 */

import {getUser, isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

function _session() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}'); } catch { return {}; } }

const LS = 'hr_benefit_enrollments';

const BENEFITS = [
  {
    id: 'health-plus',
    category: '건강',
    icon: '🏥',
    title: '실손의료보험 추가',
    desc: '기본 단체보험 외 실손 보장 추가 (입원·통원 포함)',
    cost: 15000,
    unit: '월',
    tags: ['보험', '건강'],
  },
  {
    id: 'dental',
    category: '건강',
    icon: '🦷',
    title: '치과 보험',
    desc: '스케일링·충치·임플란트 보장, 연간 한도 150만원',
    cost: 8000,
    unit: '월',
    tags: ['보험', '건강'],
  },
  {
    id: 'gym',
    category: '건강',
    icon: '💪',
    title: '피트니스 센터 지원',
    desc: '제휴 헬스장 월 이용권 (전국 300개 시설)',
    cost: 30000,
    unit: '월',
    tags: ['건강', '여가'],
  },
  {
    id: 'mental-health',
    category: '건강',
    icon: '🧘',
    title: '심리상담 지원',
    desc: '전문 심리상담사 월 2회 50분 세션',
    cost: 20000,
    unit: '월',
    tags: ['건강', '웰빙'],
  },
  {
    id: 'childcare',
    category: '가족',
    icon: '👶',
    title: '보육시설 지원',
    desc: '어린이집·유치원 비용 일부 지원 (월 최대 20만원)',
    cost: 0,
    unit: '별도 신청',
    tags: ['가족', '출산'],
    note: '별도 서류 제출 필요',
  },
  {
    id: 'elder-care',
    category: '가족',
    icon: '👴',
    title: '노인 돌봄 지원',
    desc: '부모·조부모 요양 비용 지원 (연간 최대 120만원)',
    cost: 0,
    unit: '연',
    tags: ['가족'],
    note: '별도 서류 제출 필요',
  },
  {
    id: 'commute-support',
    category: '교통',
    icon: '🚌',
    title: '교통비 추가 지원',
    desc: '기본 교통비 외 월 5만원 추가 지원',
    cost: 0,
    unit: '월',
    tags: ['교통'],
  },
  {
    id: 'parking',
    category: '교통',
    icon: '🅿️',
    title: '주차 지원',
    desc: '사내 주차장 월 정기권 (선착순)',
    cost: 50000,
    unit: '월',
    tags: ['교통'],
  },
  {
    id: 'study',
    category: '자기계발',
    icon: '📚',
    title: '자기계발비 추가',
    desc: '도서·강의·자격증 비용 월 최대 5만원 추가',
    cost: 0,
    unit: '월',
    tags: ['교육', '성장'],
  },
  {
    id: 'remote-equip',
    category: '업무',
    icon: '💻',
    title: '재택 장비 지원',
    desc: '모니터·의자·책상 구매 지원 (3년 1회, 최대 80만원)',
    cost: 0,
    unit: '3년 1회',
    tags: ['재택', '장비'],
  },
  {
    id: 'pet',
    category: '반려동물',
    icon: '🐾',
    title: '반려동물 보험',
    desc: '반려견·반려묘 의료비 보장 보험',
    cost: 12000,
    unit: '월',
    tags: ['반려동물'],
  },
  {
    id: 'subscription',
    category: '여가',
    icon: '🎬',
    title: '구독 서비스 지원',
    desc: 'OTT·음악·전자책 구독비 월 1만원 지원',
    cost: 0,
    unit: '월',
    tags: ['여가', '엔터'],
  },
];

const CATEGORIES = ['전체', ...new Set(BENEFITS.map(b => b.category))];

function _getEnrollments() { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } }
function _save(l) { localStorage.setItem(LS, JSON.stringify(l)); }

let _tab = 'catalog';
let _filterCat = '전체';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'catalog';
  _filterCat = '전체';
  _draw(root);
}

export function unmount() {
  _tab = 'catalog';
  _filterCat = '전체';
}

function _draw(root) {
  const user = getUser();
  const uid  = _session().empId || _session().userId || user?.id || 'demo';
  const enrollments = _getEnrollments().filter(e => e.empId === uid);
  const enrolledIds = new Set(enrollments.map(e => e.benefitId));

  const shown = _filterCat === '전체' ? BENEFITS : BENEFITS.filter(b => b.category === _filterCat);
  const monthlyCost = enrollments
    .map(e => BENEFITS.find(b => b.id === e.benefitId))
    .filter(Boolean)
    .filter(b => b.unit === '월')
    .reduce((n, b) => n + b.cost, 0);

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden">
  <div class="page-header" style="flex-shrink:0;background:var(--card-bg);border-bottom:1px solid var(--border);padding:16px;display:flex;align-items:center;gap:12px">
    <button onclick="window.navBack()"
      style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0;line-height:1">←</button>
    <div>
      <div style="font-size:16px;font-weight:700;color:var(--text)">선택적 복리후생</div>
      <div style="font-size:11px;color:var(--text-muted)">나에게 맞는 혜택을 선택하세요</div>
    </div>
  </div>

  <div style="flex-shrink:0;display:flex;border-bottom:1px solid var(--border);background:var(--card-bg)">
    <button class="be-tab" data-t="catalog"
      style="flex:1;padding:12px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab==='catalog'?'#4F46E5':'transparent'};color:${_tab==='catalog'?'#4F46E5':'var(--text-muted)'}">카탈로그</button>
    <button class="be-tab" data-t="my"
      style="flex:1;padding:12px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab==='my'?'#4F46E5':'transparent'};color:${_tab==='my'?'#4F46E5':'var(--text-muted)'}">
      내 혜택 (${enrollments.length})</button>
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">
    ${_tab === 'catalog' ? _renderCatalog(shown, enrolledIds, monthlyCost) : _renderMy(enrollments, enrolledIds)}
  </div>
</div>`;

  root.querySelectorAll('.be-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _draw(root); });
  });

  if (_tab === 'catalog') {
    root.querySelectorAll('.be-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => { _filterCat = btn.dataset.cat; _draw(root); });
    });

    root.querySelectorAll('.be-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const bid = btn.dataset.id;
        const all = _getEnrollments();
        const idx = all.findIndex(e => e.empId === uid && e.benefitId === bid);
        if (idx !== -1) {
          all.splice(idx, 1);
          _save(all);
          showToast('혜택 신청이 취소되었습니다.', 'success');
        } else {
          all.push({ empId: uid, benefitId: bid, enrolledAt: new Date().toISOString() });
          _save(all);
          const b = BENEFITS.find(x => x.id === bid);
          showToast(`'${b?.title}' 신청 완료!`, 'success')
    addNotification({ type: 'success', title: '복리후생 신청', body: ''' 신청 완료!' });
          addNotification({ type: 'info', title: '복리후생 신청', message: `${b?.title} 신청이 접수되었습니다.` });
        }
        _draw(root);
      });
    });
  }

  if (_tab === 'my') {
    root.querySelectorAll('.be-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        const bid = btn.dataset.id;
        const all = _getEnrollments();
        const filtered = all.filter(e => !(e.empId === uid && e.benefitId === bid));
        _save(filtered);
        showToast('신청이 취소되었습니다.', 'success');
        _draw(root);
      });
    });
  }
}

function _renderCatalog(shown, enrolledIds, monthlyCost) {
  return `
<!-- 카테고리 필터 -->
<div style="display:flex;gap:6px;overflow-x:auto;margin-bottom:14px;padding-bottom:4px">
  ${CATEGORIES.map(cat => `
    <button class="be-cat-btn" data-cat="${cat}"
      style="flex-shrink:0;padding:5px 12px;border-radius:20px;border:1.5px solid ${_filterCat===cat?'#4F46E5':'var(--border)'};
             background:${_filterCat===cat?'#EEF2FF':'var(--card-bg)'};font-size:11px;font-weight:600;
             color:${_filterCat===cat?'#4F46E5':'var(--text-muted)'};cursor:pointer;white-space:nowrap">${cat}</button>`).join('')}
</div>

<!-- 요약 -->
<div style="background:#EEF2FF;border-radius:12px;padding:12px;margin-bottom:14px;display:flex;gap:12px">
  <div style="text-align:center;flex:1">
    <div style="font-size:18px;font-weight:800;color:#4F46E5">${enrolledIds.size}</div>
    <div style="font-size:10px;color:var(--text-muted)">신청 항목</div>
  </div>
  <div style="text-align:center;flex:1">
    <div style="font-size:18px;font-weight:800;color:#4F46E5">${monthlyCost.toLocaleString()}원</div>
    <div style="font-size:10px;color:var(--text-muted)">월 본인부담</div>
  </div>
  <div style="text-align:center;flex:1">
    <div style="font-size:18px;font-weight:800;color:#10B981">${BENEFITS.length - enrolledIds.size}</div>
    <div style="font-size:10px;color:var(--text-muted)">추가 가능</div>
  </div>
</div>

${shown.map(b => {
  const enrolled = enrolledIds.has(b.id);
  return `
<div style="background:var(--card-bg);border:${enrolled?'2px solid #4F46E5':'1px solid var(--border)'};border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:26px">${b.icon}</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${b.title}</div>
        <div style="font-size:11px;color:var(--text-muted)">${b.category}${b.cost>0?` · ${b.cost.toLocaleString()}원/${b.unit}`:b.unit!=='월'?` · ${b.unit}`:' · 무료'}</div>
      </div>
    </div>
    <button class="be-toggle" data-id="${b.id}"
      style="padding:6px 12px;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;
             background:${enrolled?'#EEF2FF':'#4F46E5'};color:${enrolled?'#4F46E5':'#fff'};flex-shrink:0">
      ${enrolled ? '신청됨 ✓' : '신청'}
    </button>
  </div>
  <div style="font-size:12px;color:var(--text-muted);line-height:1.5">${b.desc}</div>
  ${b.note ? `<div style="margin-top:6px;font-size:11px;color:#F59E0B">⚠️ ${b.note}</div>` : ''}
  <div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap">
    ${b.tags.map(t=>`<span style="padding:2px 7px;background:#F1F5F9;border-radius:6px;font-size:10px;color:var(--text-muted)">#${t}</span>`).join('')}
  </div>
</div>`;
}).join('')}`;
}

function _renderMy(enrollments, enrolledIds) {
  if (!enrollments.length) {
    return `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
      <div style="font-size:40px;margin-bottom:12px">🎁</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:6px">신청한 혜택이 없습니다</div>
      <button onclick="document.querySelector('[data-t=catalog]')?.click()" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">카탈로그 보기</button>
    
      <div style="font-size:12px">카탈로그 탭에서 원하는 혜택을 선택해보세요</div>
    </div>`;
  }
  const myBenefits = enrollments
    .map(e => ({ ...BENEFITS.find(b => b.id === e.benefitId), enrolledAt: e.enrolledAt }))
    .filter(Boolean);

  return myBenefits.map(b => `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px;display:flex;align-items:center;gap:10px">
  <span style="font-size:26px;flex-shrink:0">${b.icon}</span>
  <div style="flex:1">
    <div style="font-size:13px;font-weight:700;color:var(--text)">${b.title}</div>
    <div style="font-size:11px;color:var(--text-muted)">${b.category} · ${new Date(b.enrolledAt).toLocaleDateString('ko-KR')} 신청</div>
    <div style="font-size:11px;color:${b.cost>0?'#EF4444':'#10B981'};font-weight:700">
      ${b.cost > 0 ? `월 ${b.cost.toLocaleString()}원 부담` : '무료'}
    </div>
  </div>
  <button class="be-cancel" data-id="${b.id}"
    style="padding:5px 10px;background:var(--bg);color:var(--text-muted);border:1.5px solid var(--border);border-radius:8px;font-size:11px;cursor:pointer">취소</button>
</div>`).join('');
}
