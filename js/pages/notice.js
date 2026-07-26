/**
 * notice.js — 공지사항 게시판 (직원용)
 */

import { getUser, isAdmin, isApplicant } from '../auth.js';

const LS_NOTICES = 'hr_notices';

function _getNotices() {
  const saved = localStorage.getItem(LS_NOTICES);
  if (!saved) {
    const today = new Date();
    const demo = [
      {
        id: 'N001', title: '[필독] 2026년 하계 휴가 일정 안내',
        category: 'HR', content: `안녕하세요. HR팀입니다.\n\n2026년 하계 집중 휴가 기간을 아래와 같이 안내드립니다.\n\n■ 기간: 2026년 8월 11일(월) ~ 8월 15일(금)\n■ 대상: 전 직원\n■ 방법: 연차 5일 사용 또는 무급휴가\n\n휴가 신청은 7월 31일까지 관리자 승인 받아 주시기 바랍니다.\n\n문의: HR팀 이지은 (내선 102)`,
        author: '이지은 (HR팀)', pinned: true, important: true,
        createdAt: new Date(today - 86400000 * 1).toISOString(),
        views: 45,
      },
      {
        id: 'N002', title: '2분기 전사 타운홀 미팅 개최 안내',
        category: '경영', content: `전 직원 여러분께\n\n2분기 경영 현황 공유 및 하반기 방향성을 논의하는 타운홀 미팅을 개최합니다.\n\n■ 일시: 2026년 6월 20일(금) 오후 3시\n■ 장소: 대회의실 (3층)\n■ 안건: Q2 성과 리뷰, H2 전략 방향, Q&A\n\n전 직원 필참 부탁드립니다.`,
        author: '김대표 (대표이사)', pinned: true, important: false,
        createdAt: new Date(today - 86400000 * 3).toISOString(),
        views: 38,
      },
      {
        id: 'N003', title: '사내 도서관 신규 도서 입고 안내',
        category: '복지', content: `도서 추가 입고 안내입니다.\n\n이번 달 추가된 도서 목록:\n- 린 스타트업 (에릭 리스)\n- 팀장의 탄생 (킴 스콧)\n- 원칙 (레이 달리오)\n- 하이 아웃풋 매니지먼트 (앤디 그로브)\n\n1층 도서관에서 대출 가능합니다. (2주 대출, 1회 연장 가능)`,
        author: '총무팀', pinned: false, important: false,
        createdAt: new Date(today - 86400000 * 5).toISOString(),
        views: 22,
      },
      {
        id: 'N004', title: '주차장 이용 정책 변경 안내',
        category: '총무', content: `지하 주차장 이용 정책이 6월 1일부터 변경됩니다.\n\n변경 내용:\n- 출퇴근 시간(07:00~09:00, 17:00~19:00) 직원 전용 구역 지정\n- 방문객 주차: B2 20-30번 구역\n- 연속 3시간 이상 주차 시 관리사무소 신고 필요\n\n협조 부탁드립니다.`,
        author: '총무팀', pinned: false, important: false,
        createdAt: new Date(today - 86400000 * 8).toISOString(),
        views: 31,
      },
      {
        id: 'N005', title: '6월 생일자 이벤트 안내 🎂',
        category: '복지', content: `6월 생일을 맞이하는 직원 여러분을 축하합니다!\n\n■ 생일 축하 선물: 케이크 + 문화상품권 3만원\n■ 지급 일시: 생일 당일 오전 11시 (부재 시 다음 날)\n■ 수령 장소: HR팀\n\n6월 생일자: 박철수, 오세훈, 김하늘 (총 3명)\n\n행복한 생일 되세요! 🎉`,
        author: 'HR팀', pinned: false, important: false,
        createdAt: new Date(today - 86400000 * 10).toISOString(),
        views: 56,
      },
    ];
    localStorage.setItem(LS_NOTICES, JSON.stringify(demo));
    return demo;
  }
  return JSON.parse(saved);
}

const CATEGORY_COLOR = {
  HR: '#4F46E5', 경영: '#EF4444', 복지: '#10B981', 총무: '#F59E0B', 기타: 'var(--text-muted)',
};

let _selectedId = null;
let _filterCat = 'all';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _renderPage(root);
}

export function unmount() {
  _selectedId = null;
  _filterCat = 'all';
}

function _renderPage(root) {
  if (_selectedId) { _renderDetail(root); return; }
  _renderList(root);
}

function _renderList(root) {
  const notices = _getNotices();
  const admin = isAdmin();
  const cats = ['all', ...new Set(notices.map(n => n.category))];
  const filtered = _filterCat === 'all' ? notices : notices.filter(n => n.category === _filterCat);
  const pinned = filtered.filter(n => n.pinned);
  const normal = filtered.filter(n => !n.pinned);

  root.innerHTML = `
<div class="page" style="background:var(--bg)">
  <div class="top-bar">
    <button class="btn btn-ghost btn-sm" onclick="window.navBack()" style="padding:8px;min-height:40px">←</button>
    <div class="top-bar-title" style="flex:1;text-align:center">📢 공지사항</div>
    ${admin ? `<button id="write-btn" style="padding:8px 12px;background:#4F46E5;color:#fff;
      border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;min-height:40px">
      + 작성</button>` : '<div style="min-width:40px"></div>'}
  </div>

  <div class="page-content" style="padding:16px">

    <!-- 카테고리 필터 -->
    <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;margin-bottom:16px">
      ${cats.map(c => `
      <button class="cat-filter-btn" data-cat="${c}"
        style="flex-shrink:0;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;
               cursor:pointer;border:2px solid ${_filterCat===c?(CATEGORY_COLOR[c]||'#4F46E5'):'var(--border)'};
               background:${_filterCat===c?((CATEGORY_COLOR[c]||'#4F46E5')+'15'):'var(--card-bg)'};
               color:${_filterCat===c?(CATEGORY_COLOR[c]||'#4F46E5'):'var(--text-muted)'}">
        ${c === 'all' ? '전체' : c}
      </button>`).join('')}
    </div>

    <!-- 고정 공지 -->
    ${pinned.length ? `
    <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:0.05em;margin-bottom:6px">📌 고정 공지</div>
    ${pinned.map(n => _noticeCard(n)).join('')}
    <div style="height:1px;background:var(--border);margin:12px 0"></div>` : ''}

    <!-- 일반 공지 -->
    ${normal.length
      ? normal.map(n => _noticeCard(n)).join('')
      : `<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:13px">
           <div style="font-size:40px;margin-bottom:10px">📭</div>
           공지사항이 없습니다.
         </div>`}

  </div>
</div>`;

  root.querySelectorAll('.cat-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => { _filterCat = btn.dataset.cat; _renderPage(root); });
  });
  root.querySelectorAll('.notice-item').forEach(item => {
    item.addEventListener('click', () => { _selectedId = item.dataset.id; _renderPage(root); });
  });
  root.querySelector('#write-btn')?.addEventListener('click', () => {
    window.location.hash = '#/admin?tab=noticeMgmt';
  });
}

function _noticeCard(n) {
  const catColor = CATEGORY_COLOR[n.category] || 'var(--text-muted)';
  return `
<div class="notice-item" data-id="${n.id}"
  style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
         padding:14px;margin-bottom:8px;cursor:pointer;transition:border-color .15s"
  onmouseover="this.style.borderColor='#4F46E5'" onmouseout="this.style.borderColor='var(--border)'">
  <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
    ${n.pinned ? '<span style="font-size:12px">📌</span>' : ''}
    ${n.important ? '<span style="background:#FEE2E2;color:#DC2626;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:700">중요</span>' : ''}
    <span style="background:${catColor}15;color:${catColor};font-size:11px;padding:2px 8px;
      border-radius:10px;font-weight:600">${n.category}</span>
    <span style="font-size:11px;color:var(--text-muted);margin-left:auto">${n.createdAt.slice(0,10)}</span>
  </div>
  <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px;
       white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n.title}</div>
  <div style="font-size:12px;color:var(--text-muted);display:flex;justify-content:space-between">
    <span>${n.author}</span>
    <span>👁 ${n.views}</span>
  </div>
</div>`;
}

function _renderDetail(root) {
  const notices = _getNotices();
  const n = notices.find(x => x.id === _selectedId);
  if (!n) { _selectedId = null; _renderPage(root); return; }

  const idx = notices.findIndex(x => x.id === _selectedId);
  const prev = notices[idx - 1];
  const next = notices[idx + 1];
  const catColor = CATEGORY_COLOR[n.category] || 'var(--text-muted)';

  n.views = (n.views || 0) + 1;
  localStorage.setItem(LS_NOTICES, JSON.stringify(notices));

  root.innerHTML = `
<div class="page" style="background:var(--bg)">
  <div class="top-bar">
    <button id="back-btn" class="btn btn-ghost btn-sm" style="padding:8px;min-height:40px">←</button>
    <div class="top-bar-title" style="flex:1;text-align:center">공지사항</div>
    <div style="min-width:40px"></div>
  </div>

  <div class="page-content" style="padding:16px">

    <!-- 제목 영역 -->
    <div style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
        ${n.pinned ? '<span style="font-size:14px">📌</span>' : ''}
        ${n.important ? '<span style="background:#FEE2E2;color:#DC2626;font-size:11px;padding:3px 8px;border-radius:4px;font-weight:700">중요</span>' : ''}
        <span style="background:${catColor}15;color:${catColor};font-size:11px;padding:3px 10px;
          border-radius:10px;font-weight:600">${n.category}</span>
      </div>
      <div style="font-size:18px;font-weight:700;color:var(--text);line-height:1.4;margin-bottom:8px">
        ${n.title}
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);
           padding-bottom:12px;border-bottom:1px solid var(--border)">
        <span>${n.author}</span>
        <span>${n.createdAt.slice(0,10)} · 👁 ${n.views}</span>
      </div>
    </div>

    <!-- 본문 -->
    <div style="font-size:14px;color:var(--text);line-height:1.8;white-space:pre-line;
         min-height:200px;margin-bottom:24px">${n.content}</div>

    <!-- 이전/다음 -->
    <div style="border-top:1px solid var(--border);padding-top:12px">
      ${prev ? `
      <div class="nav-notice-btn" data-id="${prev.id}"
        style="padding:12px;cursor:pointer;border-radius:10px;margin-bottom:4px"
        onmouseover="this.style.background='var(--surface)'" onmouseout="this.style.background=''">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">▲ 이전 글</div>
        <div style="font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${prev.title}
        </div>
      </div>` : ''}
      ${next ? `
      <div class="nav-notice-btn" data-id="${next.id}"
        style="padding:12px;cursor:pointer;border-radius:10px"
        onmouseover="this.style.background='var(--surface)'" onmouseout="this.style.background=''">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">▼ 다음 글</div>
        <div style="font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${next.title}
        </div>
      </div>` : ''}
    </div>

  </div>
</div>`;

  root.querySelector('#back-btn').addEventListener('click', () => {
    _selectedId = null; _renderPage(root);
  });
  root.querySelectorAll('.nav-notice-btn').forEach(btn => {
    btn.addEventListener('click', () => { _selectedId = btn.dataset.id; _renderPage(root); });
  });
}
