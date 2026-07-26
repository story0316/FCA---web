/**
 * global-search.js — Full-screen search overlay
 *
 * Trigger: Cmd/Ctrl+K  or click the 🔍 button mounted by app.js
 * Searches: OKR goals, reviews, meetings, IDP, diagnostic kits, surveys
 */

import { getUser } from '../auth.js';

let _overlayEl = null;
let _btnEl     = null;
let _inputEl   = null;

// ── Page navigation index (always searched by title) ─────────
const PAGE_INDEX = [
  { icon:'🏠', text:'대시보드',        route:'#/dashboard' },
  { icon:'📅', text:'근태 관리',        route:'#/attendance' },
  { icon:'🏖️', text:'휴가 신청',        route:'#/leave/apply' },
  { icon:'🏖️', text:'내 휴가 현황',     route:'#/leave' },
  { icon:'💰', text:'급여명세서',        route:'#/payslip' },
  { icon:'🎯', text:'OKR 목표',         route:'#/goals' },
  { icon:'📋', text:'성과 리뷰',        route:'#/reviews' },
  { icon:'👥', text:'동료 평가',        route:'#/peer-review' },
  { icon:'🪞', text:'자기 평가',        route:'#/self-assessment' },
  { icon:'📈', text:'내 성장',          route:'#/growth' },
  { icon:'💬', text:'1:1 미팅',         route:'#/one-on-one' },
  { icon:'🧭', text:'온보딩',           route:'#/onboarding' },
  { icon:'🚪', text:'오프보딩',         route:'#/offboarding' },
  { icon:'🤝', text:'멘토링',           route:'#/mentoring' },
  { icon:'🚀', text:'AI 커리어 상담',   route:'#/ai-consult' },
  { icon:'🎓', text:'교육 과정',        route:'#/training' },
  { icon:'🌟', text:'칭찬 배지 (Kudos)', route:'#/kudos' },
  { icon:'📊', text:'펄스 서베이',      route:'#/pulse-survey' },
  { icon:'📝', text:'업무 일지',        route:'#/work-log' },
  { icon:'🎁', text:'복리후생',         route:'#/benefits' },
  { icon:'🎟️', text:'복지 포인트',      route:'#/welfare-points' },
  { icon:'📄', text:'증명서 발급',      route:'#/certificate' },
  { icon:'🚌', text:'통근 기록',        route:'#/commute' },
  { icon:'💼', text:'경력 개발 경로',   route:'#/career-path' },
  { icon:'🗺️', text:'조직도',           route:'#/org-chart' },
  { icon:'🏆', text:'성과 보상',        route:'#/rewards' },
  { icon:'💳', text:'복리후생 신청',    route:'#/benefit-enroll' },
  { icon:'📂', text:'기술 인벤토리',    route:'#/skill-inventory' },
  { icon:'🏡', text:'재택근무 신청',    route:'#/remote-work' },
  { icon:'🕐', text:'초과근무 신청',    route:'#/overtime-request' },
  { icon:'🧩', text:'진단 Kit',         route:'#/assessment' },
  { icon:'📅', text:'팀 캘린더',        route:'#/team-calendar' },
  { icon:'💡', text:'아이디어 박스',    route:'#/idea-box' },
  { icon:'🔔', text:'알림 설정',        route:'#/notification-settings' },
  { icon:'✈️', text:'출장 신청',        route:'#/business-trip' },
  { icon:'💸', text:'경비 청구',        route:'#/expense-claim' },
  { icon:'📣', text:'사내 게시판',      route:'#/bulletin' },
  { icon:'🍱', text:'구내식당 메뉴',    route:'#/lunch-order' },
  { icon:'🚗', text:'주차 등록',        route:'#/parking' },
  { icon:'💊', text:'건강 프로그램',    route:'#/health-program' },
  { icon:'🧘', text:'웰니스 체크',      route:'#/wellness-check' },
  { icon:'📰', text:'사내 뉴스레터',    route:'#/newsletter' },
  { icon:'🗳️', text:'사내 투표',        route:'#/vote' },
  { icon:'🎪', text:'사내 동아리',      route:'#/club' },
  { icon:'🎉', text:'팀 빌딩',          route:'#/team-building' },
  { icon:'🏅', text:'시상·포상',        route:'#/award' },
  { icon:'🌱', text:'봉사 활동',        route:'#/volunteer' },
  { icon:'📚', text:'도서 신청',        route:'#/book-request' },
  { icon:'🌐', text:'어학 수업',        route:'#/language-class' },
  { icon:'🔒', text:'비밀번호 변경',    route:'#/change-password' },
  { icon:'👤', text:'내 프로필',        route:'#/applicant/profile' },
];

const SOURCES = [
  {
    key:   'pages',
    icon:  '🔗',
    label: '메뉴 / 페이지',
    load() {
      return PAGE_INDEX.map(p => ({ text: p.text, sub: p.route.replace('#/', ''), route: p.route, _icon: p.icon }));
    },
  },
  {
    key:   'okr',
    icon:  '🎯',
    label: 'OKR 목표',
    route: '#/goals',
    load(uid) {
      try {
        return JSON.parse(localStorage.getItem('hr_okr_goals') || '[]')
          .filter(g => !uid || g.userId === uid)
          .flatMap(g => [
            { text: g.objective || '', sub: (g.period || '') + ' 기간', route: '#/goals' },
            ...(g.keyResults || []).map(kr => ({
              text: kr.text || '', sub: `KR · ${g.objective?.slice(0,20) || ''}`, route: '#/goals',
            })),
          ]);
      } catch { return []; }
    },
  },
  {
    key:   'reviews',
    icon:  '📋',
    label: '성과 리뷰',
    route: '#/reviews',
    load(uid) {
      try {
        return JSON.parse(localStorage.getItem('hr_perf_reviews') || '[]')
          .filter(r => !uid || r.userId === uid)
          .map(r => ({ text: r.highlights || r.date || '성과 리뷰', sub: r.date || '', route: '#/reviews' }));
      } catch { return []; }
    },
  },
  {
    key:   'meetings',
    icon:  '💬',
    label: '1:1 미팅',
    load(uid) {
      try {
        return JSON.parse(localStorage.getItem('hr_one_on_ones') || '[]')
          .filter(m => !uid || m.userId === uid)
          .flatMap(m => [
            { text: m.agenda || `${m.partner || ''} 님과 미팅`, sub: m.date || '', route: '#/one-on-one' },
            ...(m.actionItems || []).map(ai => ({
              text: ai.text || '', sub: `액션 아이템 · ${m.partner || ''}`, route: '#/one-on-one',
            })),
          ]);
      } catch { return []; }
    },
  },
  {
    key:   'leave',
    icon:  '🏖️',
    label: '휴가',
    load(uid) {
      try {
        return JSON.parse(localStorage.getItem('hr_leave_requests') || '[]')
          .filter(r => !uid || r.userId === uid)
          .map(r => ({
            text: `${r.leaveType || '휴가'} ${r.startDate || ''}${r.endDate ? '~'+r.endDate : ''}`,
            sub:  r.status === 'approved' ? '승인됨' : r.status === 'rejected' ? '반려됨' : '처리 중',
            route: '#/leave',
          }));
      } catch { return []; }
    },
  },
  {
    key:   'idp',
    icon:  '📈',
    label: 'IDP',
    load() {
      try {
        return JSON.parse(localStorage.getItem('hr_idp_items') || '[]')
          .map(i => ({
            text: i.resource_title_ko || i.action_type || 'IDP 과제',
            sub:  i.competency_name_ko || '',
            route: '#/growth',
          }));
      } catch { return []; }
    },
  },
  {
    key:   'diag',
    icon:  '🧩',
    label: '진단 Kit',
    load() {
      try {
        const raw = JSON.parse(localStorage.getItem('hr_diag_results') || '{}');
        return Object.entries(raw).map(([id, r]) => ({
          text: id.replace('KIT_', '') + ' 진단 결과',
          sub:  r?.savedAt ? '완료 · ' + String(r.savedAt).slice(0, 10) : '완료',
          route: '#/assessment',
        }));
      } catch { return []; }
    },
  },
  {
    key:   'survey',
    icon:  '📝',
    label: '서베이',
    load() {
      try {
        const raw = JSON.parse(localStorage.getItem('hr_survey_responses') || '{}');
        return Object.entries(raw).map(([k, r]) => ({
          text: r?.surveyName || r?.phase || k,
          sub:  r?.submittedAt ? '제출 · ' + String(r.submittedAt).slice(0, 10) : '',
          route: '#/pulse-survey',
        }));
      } catch { return []; }
    },
  },
  {
    key:   'worklogs',
    icon:  '📝',
    label: '업무 일지',
    load(uid) {
      try {
        return JSON.parse(localStorage.getItem('hr_work_logs') || '[]')
          .filter(l => !uid || l.userId === uid)
          .slice(-10)
          .map(l => ({
            text: l.title || l.content?.slice(0, 30) || '업무 일지',
            sub:  l.date || '',
            route: '#/work-log',
          }));
      } catch { return []; }
    },
  },
];

// Quick nav shortcuts (always shown when query is empty)
const SHORTCUTS = [
  { icon: '🏠', text: '대시보드',     route: '#/dashboard' },
  { icon: '🎯', text: 'OKR 목표',     route: '#/goals' },
  { icon: '📋', text: '성과 리뷰',    route: '#/reviews' },
  { icon: '📈', text: '내 성장',      route: '#/growth' },
  { icon: '🏖️', text: '휴가 신청',    route: '#/leave/apply' },
  { icon: '💰', text: '급여명세서',   route: '#/payslip' },
  { icon: '💬', text: '1:1 미팅',     route: '#/one-on-one' },
  { icon: '🧩', text: '진단 Kit',     route: '#/assessment' },
  { icon: '🔔', text: '알림 설정',    route: '#/notification-settings' },
];

// ── Public ─────────────────────────────────────────────────────

export function mountSearchBtn() {
  if (_btnEl) return;

  _btnEl = document.createElement('button');
  _btnEl.id = 'global-search-btn';
  _btnEl.setAttribute('aria-label', '검색 (Cmd+K)');
  Object.assign(_btnEl.style, {
    position:   'fixed',
    top:        '10px',
    right:      '92px',  // left of theme toggle btn
    zIndex:     '1100',
    width:      '36px',
    height:     '36px',
    borderRadius: '50%',
    border:     'none',
    background: 'var(--surface-raised)',
    boxShadow:  'var(--shadow-sm)',
    cursor:     'pointer',
    fontSize:   '1rem',
    display:    'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });
  _btnEl.textContent = '🔍';
  _btnEl.addEventListener('click', openSearch);
  document.body.appendChild(_btnEl);

  // Keyboard shortcut
  document.addEventListener('keydown', _onKeydown);
}

export function unmountSearchBtn() {
  if (_btnEl) { _btnEl.remove(); _btnEl = null; }
  document.removeEventListener('keydown', _onKeydown);
  closeSearch();
}

export function openSearch() {
  if (_overlayEl) return;
  _buildOverlay();
  document.body.appendChild(_overlayEl);
  requestAnimationFrame(() => {
    _overlayEl.style.opacity = '1';
    _inputEl?.focus();
  });
}

export function closeSearch() {
  if (!_overlayEl) return;
  _overlayEl.style.opacity = '0';
  setTimeout(() => { _overlayEl?.remove(); _overlayEl = null; _inputEl = null; }, 180);
}

// ── Build overlay ──────────────────────────────────────────────

function _buildOverlay() {
  _overlayEl = document.createElement('div');
  Object.assign(_overlayEl.style, {
    position:   'fixed',
    inset:      '0',
    zIndex:     '2000',
    background: 'rgba(0,0,0,0.55)',
    display:    'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '72px',
    opacity:    '0',
    transition: 'opacity 180ms ease',
    backdropFilter: 'blur(4px)',
  });

  const box = document.createElement('div');
  Object.assign(box.style, {
    width:        'min(560px, 92vw)',
    background:   'var(--surface)',
    borderRadius: 'var(--radius-xl)',
    boxShadow:    'var(--shadow-xl)',
    overflow:     'hidden',
    maxHeight:    '70vh',
    display:      'flex',
    flexDirection: 'column',
  });

  // Search input row
  const inputRow = document.createElement('div');
  Object.assign(inputRow.style, {
    display:    'flex',
    alignItems: 'center',
    gap:        '10px',
    padding:    '14px 16px',
    borderBottom: '1px solid var(--border)',
  });
  inputRow.innerHTML = `<span style="font-size:1.1rem;flex-shrink:0">🔍</span>`;

  _inputEl = document.createElement('input');
  Object.assign(_inputEl.style, {
    flex:       '1',
    border:     'none',
    background: 'transparent',
    font:       'inherit',
    fontSize:   '1rem',
    color:      'var(--text)',
    outline:    'none',
  });
  _inputEl.placeholder = '검색어 입력… (예: OKR, 리뷰, IDP)';
  inputRow.appendChild(_inputEl);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'ESC';
  Object.assign(closeBtn.style, {
    border:     '1px solid var(--border)',
    background: 'var(--bg)',
    borderRadius: '4px',
    padding:    '2px 6px',
    fontSize:   '0.68rem',
    color:      'var(--text-muted)',
    cursor:     'pointer',
    flexShrink: '0',
  });
  closeBtn.addEventListener('click', closeSearch);
  inputRow.appendChild(closeBtn);

  // Results area
  const resultsEl = document.createElement('div');
  Object.assign(resultsEl.style, {
    overflowY:  'auto',
    flex:       '1',
    padding:    '8px',
  });

  box.appendChild(inputRow);
  box.appendChild(resultsEl);
  _overlayEl.appendChild(box);

  // Close on backdrop click
  _overlayEl.addEventListener('click', (e) => {
    if (e.target === _overlayEl) closeSearch();
  });

  // Render shortcuts initially
  _renderResults(resultsEl, '');

  // Debounced search
  let timer;
  _inputEl.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => _renderResults(resultsEl, _inputEl.value), 80);
  });

  // Keyboard nav in results
  _inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeSearch(); return; }
    if (e.key === 'ArrowDown') {
      const first = resultsEl.querySelector('.sr-item');
      first?.focus();
    }
  });
}

function _renderResults(container, query) {
  const q   = query.trim().toLowerCase();
  const uid = getUser()?.id;

  if (!q) {
    container.innerHTML = `
      <div style="padding:4px 8px 2px;font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em">빠른 이동</div>
      ${SHORTCUTS.map(s => _itemHtml(s.icon, s.text, '', s.route)).join('')}
      <div style="padding:8px 8px 2px;margin-top:4px;font-size:0.72rem;color:var(--text-muted);border-top:1px solid var(--border)">
        💡 휴가, OKR, 급여, 교육, 진단 등 키워드로 검색하세요
      </div>
    `;
    _bindItems(container);
    return;
  }

  const hits = [];
  for (const src of SOURCES) {
    const items = src.load(uid).filter(i =>
      (i.text || '').toLowerCase().includes(q) ||
      (i.sub  || '').toLowerCase().includes(q)
    );
    if (items.length) {
      // Pages source shows up to 6, others up to 4
      hits.push({ src, items: items.slice(0, src.key === 'pages' ? 6 : 4) });
    }
  }

  if (!hits.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:32px 16px;color:var(--text-muted);font-size:0.85rem">
        "${_esc(query)}" 에 대한 검색 결과가 없습니다.
      </div>`;
    return;
  }

  container.innerHTML = hits.map(({ src, items }) => `
    <div style="margin-bottom:4px">
      <div style="padding:6px 8px;font-size:0.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em">
        ${src.icon} ${src.label}
      </div>
      ${items.map(i => _itemHtml(i._icon || src.icon, i.text, i.sub, i.route)).join('')}
    </div>
  `).join('');

  _bindItems(container);
}

function _itemHtml(icon, text, sub, route) {
  return `
    <button class="sr-item" data-route="${_esc(route)}"
            style="display:flex;align-items:center;gap:10px;width:100%;text-align:left;
                   padding:9px 10px;border:none;background:none;cursor:pointer;
                   border-radius:var(--radius-sm);transition:background 100ms">
      <span style="font-size:1rem;width:20px;text-align:center;flex-shrink:0">${icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:0.85rem;font-weight:600;color:var(--text);
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(text)}</div>
        ${sub ? `<div style="font-size:0.7rem;color:var(--text-muted)">${_esc(sub)}</div>` : ''}
      </div>
      <span style="font-size:0.7rem;color:var(--text-light);flex-shrink:0">→</span>
    </button>`;
}

function _bindItems(container) {
  container.querySelectorAll('.sr-item').forEach(btn => {
    btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--bg-subtle)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'none'; });
    btn.addEventListener('click', () => {
      closeSearch();
      window.location.hash = btn.dataset.route;
    });
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { btn.nextElementSibling?.focus(); }
      if (e.key === 'ArrowUp')   { btn.previousElementSibling?.focus() || _inputEl?.focus(); }
      if (e.key === 'Enter')     { closeSearch(); window.location.hash = btn.dataset.route; }
      if (e.key === 'Escape')    { closeSearch(); }
    });
  });
}

function _onKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    _overlayEl ? closeSearch() : openSearch();
  }
  if (e.key === 'Escape' && _overlayEl) closeSearch();
}

function _esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
