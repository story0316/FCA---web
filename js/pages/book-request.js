/**
 * book-request.js — 사내 도서 신청 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

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
  { id:'BK010', title:'파이썬 머신러닝',        author:'Sebastian Raschka', category:'개발', cover:'📒', stock:2, rating:4.4 },
];

const CATEGORIES = ['전체', '개발', '경영', '성장', '데이터'];

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }

function _getBooks() {
  const s = localStorage.getItem(LS_BOOKS);
  if (!s) { localStorage.setItem(LS_BOOKS, JSON.stringify(DEMO_BOOKS)); return DEMO_BOOKS; }
  try { return JSON.parse(s); } catch { return DEMO_BOOKS; }
}
function _getReqs() { try { return JSON.parse(localStorage.getItem(LS_REQS)||'[]'); } catch { return []; } }
function _saveReqs(l) { localStorage.setItem(LS_REQS, JSON.stringify(l)); }

const STATUS_META = {
  pending:  { label:'검토 중',  color:'#F59E0B', bg:'#FEF3C7' },
  approved: { label:'승인',     color:'#3B82F6', bg:'#EFF6FF' },
  borrowed: { label:'대출중',   color:'#8B5CF6', bg:'#F5F3FF' },
  returned: { label:'반납 완료', color:'#10B981', bg:'#ECFDF5' },
  rejected: { label:'반려',     color:'#EF4444', bg:'#FEE2E2' },
};

let _tab  = 'catalog';
let _cat  = '전체';
let _root = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _root=root; _tab='catalog'; _cat='전체'; _render(); }
export function unmount() { _tab = 'catalog'; _root=null; }

function _render() {
  const myReqs = _getReqs().filter(r=>r.empId===_empId());
  const pending = myReqs.filter(r=>r.status==='pending'||r.status==='approved'||r.status==='borrowed').length;

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="bk-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">📚 사내 도서 신청</div>
      <div style="font-size:11px;color:var(--text-muted)">도서 ${_getBooks().length}권 · 신청 ${myReqs.length}건</div>
    </div>
    ${pending ? `<div style="background:#8B5CF6;color:#fff;border-radius:99px;padding:3px 10px;font-size:12px;font-weight:700">대출중 ${pending}</div>` : ''}
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['catalog','도서 목록'],['mine','내 신청']].map(([k,l])=>`
    <button class="bk-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='catalog' ? _renderCatalog() : _renderMine(myReqs)}
  </div>
</div>`;

  _root.querySelector('#bk-back').addEventListener('click', ()=>window.navBack());
  _root.querySelectorAll('.bk-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(); }));
  if (_tab==='catalog') _bindCatalog();
}

function _renderCatalog() {
  const books    = _getBooks();
  const filtered = _cat==='전체' ? books : books.filter(b=>b.category===_cat);
  const activeReqBks = new Set(_getReqs().filter(r=>r.empId===_empId()&&(r.status==='borrowed'||r.status==='approved'||r.status==='pending')).map(r=>r.bookId));

  return `
<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;margin-bottom:12px">
  ${CATEGORIES.map(c=>`
  <button class="bk-cat" data-cat="${c}"
    style="padding:6px 12px;border-radius:99px;border:none;cursor:pointer;white-space:nowrap;
           font-size:12px;font-weight:600;
           background:${_cat===c?'#4F46E5':'var(--bg)'};
           color:${_cat===c?'#fff':'var(--text-muted)'};
           border:1px solid ${_cat===c?'#4F46E5':'var(--border)'}">${c}</button>`).join('')}
</div>

${filtered.map(book=>{
  const myActive = activeReqBks.has(book.id);
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
     padding:12px;margin-bottom:8px;display:flex;gap:12px;align-items:flex-start">
  <div style="font-size:36px;flex-shrink:0;line-height:1">${book.cover}</div>
  <div style="flex:1;min-width:0">
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px">${book.title}</div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">${book.author} · ${book.category}</div>
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:11px;color:var(--text-muted)">재고 ${book.stock}권</span>
      <span style="font-size:11px;color:#F59E0B">★ ${book.rating}</span>
    </div>
  </div>
  <button class="bk-request" data-id="${book.id}" data-title="${book.title}"
    ${book.stock<=0||myActive?'disabled':''}
    style="padding:7px 12px;border:none;border-radius:8px;font-size:11px;font-weight:700;
           cursor:${book.stock<=0||myActive?'not-allowed':'pointer'};flex-shrink:0;
           background:${myActive?'#F5F3FF':book.stock<=0?'#F1F5F9':'#4F46E5'};
           color:${myActive?'#8B5CF6':book.stock<=0?'var(--text-muted)':'#fff'}">
    ${myActive?'신청중':book.stock<=0?'품절':'신청'}
  </button>
</div>`; }).join('')}`;
}

function _renderMine(reqs) {
  const sorted = [...reqs].sort((a,b)=>b.reqDate.localeCompare(a.reqDate));
  if (!sorted.length) return `
<div style="text-align:center;padding:48px 16px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">📚</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:4px">신청 내역이 없습니다</div>
      <button onclick="location.hash='#/book-request'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">도서 신청</button>
    
  <div style="font-size:12px">읽고 싶은 도서를 신청해 보세요!</div>
</div>`;

  return sorted.map(r=>{
    const meta = STATUS_META[r.status]||STATUS_META.pending;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div style="font-size:13px;font-weight:700">${r.bookTitle}</div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;
                 background:${meta.bg};color:${meta.color};flex-shrink:0;margin-left:8px">${meta.label}</span>
  </div>
  <div style="font-size:11px;color:var(--text-muted)">${r.reqDate} · ${r.dueDate?`반납 ${r.dueDate}`:''}</div>
</div>`;}).join('');
}

function _bindCatalog() {
  _root.querySelectorAll('.bk-cat').forEach(b=>b.addEventListener('click',()=>{ _cat=b.dataset.cat; _render(); }));
  _root.querySelectorAll('.bk-request').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if (btn.disabled) return;
      const reqs = _getReqs();
      const due  = new Date(); due.setDate(due.getDate()+14);
      reqs.push({
        id:        'BR_'+Date.now(),
        empId:     _empId(),
        empName:   _empName(),
        bookId:    btn.dataset.id,
        bookTitle: btn.dataset.title,
        status:    'pending',
        reqDate:   new Date().toISOString().slice(0,10),
        dueDate:   due.toISOString().slice(0,10),
      });
      _saveReqs(reqs);
      showToast(`"${btn.dataset.title}" 신청이 완료됐습니다.`, 'success')
    addNotification({ type: 'success', title: '도서 신청', body: '"" 신청이 완료됐습니다.' });
      _tab = 'mine';
      _render();
    });
  });
}
