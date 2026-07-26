/**
 * book-order.js — 도서 구매 신청 (직원용)
 * Route: #/book-order
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_book_orders';

const STATUS_META = {
  pending:  { label: '검토 중', bg: '#FEF3C7', color: '#D97706' },
  approved: { label: '승인',   bg: '#D1FAE5', color: '#059669' },
  rejected: { label: '반려',   bg: '#FEE2E2', color: '#EF4444' },
  ordered:  { label: '주문 완료', bg: '#EEF2FF', color: '#4F46E5' },
};

function _demoBookOrders() {
  const uid = _uid(); const name = _uname(); const dept = _udept();
  return [
    { id: `book_${uid}_1`, empId: uid, empName: name, dept, title: '클린 코드', author: '로버트 C. 마틴', publisher: '인사이트', price: 33000, reason: '코드 품질 향상을 위한 학습', status: 'ordered', reqDate: '2026-05-10' },
    { id: `book_${uid}_2`, empId: uid, empName: name, dept, title: '도메인 주도 설계', author: '에릭 에반스', publisher: '위키북스', price: 48000, reason: '서비스 아키텍처 설계 역량 강화', status: 'approved', reqDate: '2026-05-25' },
    { id: `book_${uid}_3`, empId: uid, empName: name, dept, title: '팀 토폴로지', author: '매튜 스켈턴', publisher: '에이콘', price: 32000, reason: '팀 구조와 협업 방식 이해', status: 'pending', reqDate: '2026-06-01' },
  ];
}

function _load() {
  const demo = _demoBookOrders();
  try {
    const saved = JSON.parse(localStorage.getItem(LS) || '[]');
  if (!saved || !saved.length) { root.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:40px;margin-bottom:10px">📚</div><div style="font-size:14px;font-weight:600;margin-bottom:4px">도서 신청 내역이 없습니다.</div><div style="font-size:12px;margin-bottom:14px">월 1권 / 5만원 이내 도서를 신청해 보세요.</div><button onclick="location.hash='#/book-request'" style="padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">도서 신청</button></div>`; return; }
    return [...demo.filter(d => !saved.find(x => x.id === d.id)), ...saved];
  } catch { return [...demo]; }
}
function _save(list) { localStorage.setItem(LS, JSON.stringify(list)); }
function _uid()  { try { return JSON.parse(localStorage.getItem('hr_session') || '{}').empId  || 'EMP001'; } catch { return 'EMP001'; } }
function _uname(){ try { return JSON.parse(localStorage.getItem('hr_session') || '{}').name   || '사용자'; } catch { return '사용자'; } }
function _udept(){ try { return JSON.parse(localStorage.getItem('hr_session') || '{}').dept   || '소속 미지정'; } catch { return '소속 미지정'; } }
function _today(){ return new Date().toISOString().slice(0, 10); }

let _tab = 'apply';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'apply';
  _draw(root);
}

export function unmount() { _tab = 'apply'; }

function _draw(root) {
  const uid  = _uid();
  const mine = _load().filter(b => b.empId === uid).sort((a, b) => b.reqDate.localeCompare(a.reqDate));

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="bo-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">📚 도서 구매 신청</div>
      <div style="font-size:11px;color:var(--text-muted)">신청 내역 ${mine.length}건</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['apply','신청하기'],['history','신청 내역']].map(([k,l]) => `
    <button class="bo-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab === 'apply' ? _renderApply() : _renderHistory(mine)}
  </div>
</div>`;

  root.querySelector('#bo-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.bo-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(root); }));

  if (_tab === 'apply') {
    root.querySelector('#bo-submit-btn')?.addEventListener('click', () => _handleSubmit(root, uid));
  }
}

function _renderApply() {
  return `
<div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:12px;padding:12px;margin-bottom:14px;font-size:12px;color:#3730A3">
  📖 <strong>도서 지원 안내:</strong> 월 1권 / 5만원 이내 지원 (업무 관련 도서에 한함)
</div>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">도서명 <span style="color:#EF4444">*</span></label>
    <input id="bo-title" type="text" placeholder="예: 클린 코드"
      style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);
             border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
  </div>

  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">저자</label>
    <input id="bo-author" type="text" placeholder="예: 로버트 C. 마틴"
      style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);
             border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
  </div>

  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">출판사</label>
    <input id="bo-publisher" type="text" placeholder="예: 인사이트"
      style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);
             border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
  </div>

  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">가격 (원) <span style="color:#EF4444">*</span></label>
    <input id="bo-price" type="number" min="0" placeholder="예: 33000" min="0"
      style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);
             border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
  </div>

  <div style="margin-bottom:16px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">신청 사유 <span style="color:#EF4444">*</span></label>
    <textarea maxlength="500" id="bo-reason" placeholder="업무와의 연관성 및 학습 목적을 간략히 작성해 주세요"
      style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);
             border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);
             height:80px;resize:vertical"></textarea>
  </div>

  <button id="bo-submit-btn"
    style="width:100%;background:#4F46E5;color:#fff;border:none;border-radius:12px;
           padding:13px;font-size:14px;font-weight:700;cursor:pointer">신청하기</button>
</div>`;
}

function _renderHistory(mine) {
  if (!mine.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:48px;margin-bottom:12px">📚</div>
  <div style="font-size:15px;font-weight:600;margin-bottom:6px">신청 내역이 없어요</div>
  <div style="font-size:13px">월 1권 / 5만원 이내 도서를 신청해 보세요.</div>
</div>`;

  return `
<div style="background:#EEF2FF;border-radius:10px;padding:10px;margin-bottom:12px;font-size:11px;color:#3730A3">
  📖 월 1권 / 5만원 이내 지원
</div>
${mine.map(b => {
  const s = STATUS_META[b.status] || STATUS_META.pending;
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div style="flex:1;min-width:0;margin-right:10px">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px">${b.title}</div>
      <div style="font-size:11px;color:var(--text-muted)">${[b.author, b.publisher].filter(Boolean).join(' · ')}</div>
    </div>
    <span style="flex-shrink:0;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:600;
      background:${s.bg};color:${s.color}">${s.label}</span>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:13px;font-weight:700;color:#4F46E5">${(b.price||0).toLocaleString()}원</span>
    <span style="font-size:11px;color:var(--text-muted)">${b.reqDate}</span>
  </div>
</div>`;
}).join('')}`;
}

function _handleSubmit(root, uid) {
  const title     = root.querySelector('#bo-title')?.value.trim();
  const author    = root.querySelector('#bo-author')?.value.trim();
  const publisher = root.querySelector('#bo-publisher')?.value.trim();
  const price     = parseInt(root.querySelector('#bo-price')?.value || '0');
  const reason    = root.querySelector('#bo-reason')?.value.trim();

  if (!title)             { showToast('도서명을 입력해 주세요.', 'error'); return; }
  if (!price || price <= 0) { showToast('가격을 올바르게 입력해 주세요.', 'error'); return; }
  if (price > 50000)      { showToast('도서 지원 한도는 5만원입니다.', 'warning'); return; }
  if (!reason)            { showToast('신청 사유를 입력해 주세요.', 'error'); return; }

  const all = _load();
  const newItem = {
    id: 'book_' + Date.now(),
    empId: uid, empName: _uname(), dept: _udept(),
    title, author, publisher, price, reason,
    status: 'pending', reqDate: _today(),
  };
  _save([...all.filter(x => !_demoBookOrders().find(d => d.id === x.id)), newItem]);
  showToast('도서 구매 신청이 완료되었습니다.', 'success')
    addNotification({ type: 'success', title: '도서 주문', body: '도서 구매 신청이 완료되었습니다.' });
  _tab = 'history';
  _draw(root);
}
