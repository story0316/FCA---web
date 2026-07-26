/**
 * book-admin.js — 사내 도서 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification, addNotificationForUser } from '../../components/notification-hub.js';

const LS_BOOKS = 'hr_books';
const LS_REQS  = 'hr_book_requests';

const DEMO_BOOKS = [
  { id:'BK001', title:'클린 코드',             author:'로버트 C. 마틴', category:'개발', cover:'📗', stock:2, rating:4.8 },
  { id:'BK002', title:'함께 자라기',            author:'김창준',         category:'성장', cover:'📘', stock:3, rating:4.7 },
  { id:'BK003', title:'린 스타트업',            author:'에릭 리스',       category:'경영', cover:'📙', stock:1, rating:4.5 },
  { id:'BK004', title:'넛지',                  author:'리처드 탈러',     category:'경영', cover:'📕', stock:2, rating:4.4 },
  { id:'BK005', title:'데이터로 말하라',         author:'콜 누스바우머',   category:'데이터', cover:'📒', stock:1, rating:4.6 },
  { id:'BK006', title:'OKR 전설의 벤처투자자',   author:'존 도어',         category:'경영', cover:'📗', stock:3, rating:4.5 },
  { id:'BK007', title:'하버드 비즈니스 리뷰',   author:'HBR',            category:'경영', cover:'📘', stock:5, rating:4.3 },
  { id:'BK008', title:'소프트 스킬',            author:'존 소메즈',       category:'성장', cover:'📙', stock:2, rating:4.2 },
  { id:'BK009', title:'구글이 목표를 달성하는 방식', author:'래리 페이지', category:'경영', cover:'📕', stock:1, rating:4.6 },
  { id:'BK010', title:'파이썬 머신러닝',        author:'Sebastian Raschka', category:'데이터', cover:'📒', stock:2, rating:4.4 },
];

const LEGACY_REQ_IDS = new Set(['BR001', 'BR002', 'BR003', 'BR004', 'BR005']);

const STATUS_META = {
  pending:  { label:'검토 중',  color:'#F59E0B' },
  approved: { label:'승인',     color:'#3B82F6' },
  borrowed: { label:'대출중',   color:'#8B5CF6' },
  returned: { label:'반납 완료', color:'#10B981' },
  rejected: { label:'반려',     color:'#EF4444' },
};

function _getBooks() {
  const s = localStorage.getItem(LS_BOOKS);
  if (!s) { localStorage.setItem(LS_BOOKS, JSON.stringify(DEMO_BOOKS)); return DEMO_BOOKS; }
  try { return JSON.parse(s); } catch { return DEMO_BOOKS; }
}
function _saveBooks(l) { localStorage.setItem(LS_BOOKS, JSON.stringify(l)); }
function _getReqs() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_REQS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_REQ_IDS.has(r.id));
    if (cleaned.length !== list.length) _saveReqs(cleaned);
    return cleaned;
  } catch { return []; }
}
function _saveReqs(l) { localStorage.setItem(LS_REQS, JSON.stringify(l)); }

let _tab  = 'requests';
let _root = null;

export function render(root) { _root=root; _tab='requests'; _draw(); }
export function unmount() { _root=null;
  _tab = 'requests';
}

function _draw() {
  const reqs    = _getReqs();
  const pending = reqs.filter(r=>r.status==='pending').length;

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['requests',`신청 처리${pending?` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending}</span>`:''}`],['books','도서 관리']].map(([k,l])=>`
    <button class="ba-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='requests' ? _renderRequests(reqs) : _renderBooks()}
  </div>
</div>`;

  _root.querySelectorAll('.ba-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderRequests(reqs) {
  const pending  = reqs.filter(r=>r.status==='pending');
  const active   = reqs.filter(r=>r.status==='borrowed'||r.status==='approved');
  const history  = reqs.filter(r=>r.status==='returned'||r.status==='rejected');
  const all      = [...pending, ...active, ...history];

  return `
<!-- KPI -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
  ${[
    ['대기 중', `${pending.length}건`, '#F59E0B'],
    ['대출 중', `${active.length}건`,  '#8B5CF6'],
    ['처리 완료', `${history.length}건`, '#10B981'],
  ].map(([l,v,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:18px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8;margin-top:1px">${l}</div>
  </div>`).join('')}
</div>

${!all.length ? `
<div style="text-align:center;padding:40px;color:#94A3B8">
  <div style="font-size:32px;margin-bottom:8px">📚</div>
  <div style="font-size:13px">신청 내역이 없습니다.</div>
</div>` : all.map(r=>{
  const meta = STATUS_META[r.status];
  return `
<div style="background:var(--card-bg);border:1px solid ${r.status==='pending'?'#FCD34D':'var(--border)'};
     border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div>
      <div style="font-size:13px;font-weight:700">${r.empName}</div>
      <div style="font-size:11px;color:#94A3B8">${r.reqDate}</div>
    </div>
    <span style="font-size:11px;font-weight:700;color:${meta.color}">${meta.label}</span>
  </div>
  <div style="font-size:12px;color:#64748B;margin-bottom:${r.status==='pending'?'10':'0'}px">
    📚 ${r.bookTitle}${r.dueDate?` · 반납 ${r.dueDate}`:''}
  </div>
  ${r.status==='pending' ? `
  <div style="display:flex;gap:6px">
    <button class="ba-lend" data-id="${r.id}"
      style="flex:1;padding:8px;background:#8B5CF6;color:#fff;border:none;border-radius:8px;
             font-size:12px;font-weight:700;cursor:pointer">대출 처리</button>
    <button class="ba-reject" data-id="${r.id}"
      style="flex:1;padding:8px;background:none;border:1px solid #EF4444;color:#EF4444;border-radius:8px;
             font-size:12px;font-weight:700;cursor:pointer">반려</button>
  </div>` : r.status==='borrowed' ? `
  <button class="ba-return" data-id="${r.id}"
    style="width:100%;padding:8px;background:#10B981;color:#fff;border:none;border-radius:8px;
           font-size:12px;font-weight:700;cursor:pointer;margin-top:8px">반납 처리</button>
  ` : ''}
</div>`; }).join('')}`;
}

function _renderBooks() {
  const books = _getBooks();
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700">도서 목록 (${books.length}권)</div>
  ${books.map(book=>`
  <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
    <span style="font-size:20px;flex-shrink:0">${book.cover}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:12px;font-weight:600">${book.title}</div>
      <div style="font-size:10px;color:#94A3B8">${book.author} · ${book.category}</div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
      <button class="ba-restock" data-id="${book.id}"
        style="padding:3px 7px;font-size:10px;border:1px solid var(--border);border-radius:6px;
               background:var(--bg);color:var(--text);cursor:pointer">입고</button>
      <span style="font-size:12px;font-weight:700;color:${book.stock<=1?'#EF4444':'#10B981'}">${book.stock}권</span>
    </div>
  </div>`).join('')}
</div>`;
}

function _bindEvents() {
  _root.querySelectorAll('.ba-lend').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const reqs = _getReqs(); const r = reqs.find(x=>x.id===btn.dataset.id); if(!r) return;
      r.status='borrowed';
      const books = _getBooks(); const bk = books.find(b=>b.id===r.bookId);
      if (bk) bk.stock = Math.max(0, bk.stock-1);
      _saveReqs(reqs); _saveBooks(books);
      showToast(`${r.empName} 대출 처리됐습니다.`, 'success');
      addNotification({ type: 'success', title: '도서 대출 (관리자)', body: '대출 처리됐습니다.' });
      if (r.empId) addNotificationForUser(r.empId, { type: 'success', title: '도서 대출 승인', body: `도서 대출 신청이 승인되었습니다.`, route: '#/book-request' });
      _draw();
    });
  });

  _root.querySelectorAll('.ba-return').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const reqs = _getReqs(); const r = reqs.find(x=>x.id===btn.dataset.id); if(!r) return;
      r.status='returned';
      const books = _getBooks(); const bk = books.find(b=>b.id===r.bookId);
      if (bk) bk.stock++;
      _saveReqs(reqs); _saveBooks(books);
      showToast(`${r.empName} 반납 처리됐습니다.`, 'success')
      addNotification({ type: 'success', title: 'Book (관리자)', body: '반납 처리됐습니다.' }); _draw();
    });
  });

  _root.querySelectorAll('.ba-reject').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const reqs = _getReqs(); const r = reqs.find(x=>x.id===btn.dataset.id); if(!r) return;
      r.status='rejected'; _saveReqs(reqs);
      showToast(`반려 처리됐습니다.`, 'info');
      if (r.empId) addNotificationForUser(r.empId, { type: 'error', title: '도서 대출 반려', body: '도서 대출 신청이 반려되었습니다.', route: '#/book-request' });
      _draw();
    });
  });

  _root.querySelectorAll('.ba-restock').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const qty = parseInt(prompt('입고 수량을 입력하세요:','1'))||0;
      if(qty<=0) return;
      const books = _getBooks(); const bk = books.find(b=>b.id===btn.dataset.id); if(!bk) return;
      bk.stock += qty; _saveBooks(books);
      showToast(`입고 완료: +${qty}권`, 'success')
      addNotification({ type: 'success', title: 'Book (관리자)', body: '입고 완료: +권' }); _draw();
    });
  });
}
export function mount(root) { return render(root); }
