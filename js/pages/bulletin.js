import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const CATEGORIES = ['공지', '자유', '정보공유', '구인구직', '분실물', '기타'];

const LS_KEY = 'hr_bulletin_posts';
const LEGACY_POST_IDS = new Set(['BP001','BP002','BP003','BP004','BP005']);

const CATEGORY_COLORS = {
  '공지': { bg: '#fee2e2', color: '#ef4444' },
  '자유': { bg: '#d1fae5', color: '#10b981' },
  '정보공유': { bg: '#dbeafe', color: '#3b82f6' },
  '구인구직': { bg: '#fef3c7', color: '#f59e0b' },
  '분실물': { bg: '#ede9fe', color: '#6366f1' },
  '기타': { bg: '#f3f4f6', color: '#6b7280' },
};

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId()   { return _session().empId || _session().userId || 'EMP001'; }
function _empName() { return _session().empName || '사용자'; }

function _load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw);
    const cleaned = all.filter(p => !LEGACY_POST_IDS.has(p.id));
    if (cleaned.length < all.length) localStorage.setItem(LS_KEY, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}
function _save(d) { localStorage.setItem(LS_KEY, JSON.stringify(d)); }

let _root = null;
let _activeTab = 'all';
let _filterCat = null;
let _detailId = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _root = root;
  _activeTab = 'all';
  _filterCat = null;
  _detailId = null;
  _render();
}

export function unmount() {
  delete window._buSetTab;
  delete window._buFilterCat;
  delete window._buOpenPost;
  delete window._buCloseDetail;
  delete window._buLike;
  delete window._buSubmit;
  delete window._buGoWrite;
  _root = null;
}

function _render() {
  if (!_root) return;
  _root.innerHTML = `
    <div class="page" style="height:100vh;overflow:hidden;background:var(--bg);display:flex;flex-direction:column;">
      <div style="background:var(--card-bg);padding:16px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);flex-shrink:0;">
        ${_detailId ? `<button onclick="window._buCloseDetail()" style="background:none;border:none;font-size:20px;cursor:pointer;padding:4px;">←</button>` :
          `<button onclick="window.navBack()" style="background:none;border:none;font-size:20px;cursor:pointer;padding:4px;">←</button>`}
        <h1 style="margin:0;font-size:17px;font-weight:700;color:var(--text);">${_detailId ? '게시글' : '사내 게시판'}</h1>
      </div>
      ${_detailId ? '' : `
      <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0;">
        <button onclick="window._buSetTab('all')"
          style="flex:1;padding:12px;border:none;background:none;font-size:13px;font-weight:600;cursor:pointer;color:${_activeTab==='all'?'#6366f1':'#6b7280'};border-bottom:2px solid ${_activeTab==='all'?'#6366f1':'transparent'};">
          전체
        </button>
        <button onclick="window._buSetTab('filter')"
          style="flex:1;padding:12px;border:none;background:none;font-size:13px;font-weight:600;cursor:pointer;color:${_activeTab==='filter'?'#6366f1':'#6b7280'};border-bottom:2px solid ${_activeTab==='filter'?'#6366f1':'transparent'};">
          카테고리
        </button>
        <button onclick="window._buSetTab('write')"
          style="flex:1;padding:12px;border:none;background:none;font-size:13px;font-weight:600;cursor:pointer;color:${_activeTab==='write'?'#6366f1':'#6b7280'};border-bottom:2px solid ${_activeTab==='write'?'#6366f1':'transparent'};">
          글쓰기
        </button>
      </div>`}
      <div class="page-content" style="overflow-y:auto;flex:1;">
        ${_detailId ? _renderDetail() : _activeTab === 'write' ? _renderWrite() : _renderPostList()}
      </div>
    </div>`;

  window._buSetTab = (t) => { _activeTab = t; _render(); };
  window._buFilterCat = (c) => { _filterCat = (_filterCat === c ? null : c); _render(); };
  window._buOpenPost  = (id) => {
    const posts = _load();
    const idx = posts.findIndex(p => p.id === id);
    if (idx > -1) { posts[idx].views = (posts[idx].views || 0) + 1; _save(posts); }
    _detailId = id; _render();
  };
  window._buCloseDetail = () => { _detailId = null; _render(); };
  window._buLike = (id) => {
    const posts = _load();
    const idx = posts.findIndex(p => p.id === id);
    if (idx > -1) { posts[idx].likes = (posts[idx].likes || 0) + 1; _save(posts); _render(); }
  };
  window._buSubmit = _handleSubmit;
  window._buGoWrite = () => { _activeTab = 'write'; _render(); };
}

function _renderPostList() {
  const posts = _load();
  let filtered = posts;
  if (_activeTab === 'filter' && _filterCat) {
    filtered = posts.filter(p => p.category === _filterCat);
  }

  return `
    <div style="padding:16px;display:flex;flex-direction:column;gap:10px;">
      ${_activeTab === 'filter' ? `
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:4px;">
          ${CATEGORIES.map(c => {
            const cc = CATEGORY_COLORS[c] || CATEGORY_COLORS['기타'];
            const active = _filterCat === c;
            return `<button onclick="window._buFilterCat('${c}')"
              style="padding:6px 14px;border-radius:20px;border:2px solid ${active?cc.color:'#e5e7eb'};background:${active?cc.bg:'#fff'};color:${active?cc.color:'#6b7280'};font-size:13px;font-weight:600;cursor:pointer;">${c}</button>`;
          }).join('')}
        </div>` : ''}
      ${!filtered.length ? `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;gap:12px;">
          <span style="font-size:48px;">📋</span>
          <p style="margin:0;font-size:15px;font-weight:600;color:var(--text);">게시글이 없습니다</p>
          <p style="margin:0;font-size:13px;color:var(--text-muted);">첫 번째 게시글을 작성해 보세요.</p>
          <button onclick="window._buGoWrite()" style="padding:10px 22px;background:#6366f1;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">글 작성하기</button>
        </div>` :
        filtered.map(p => {
          const cc = CATEGORY_COLORS[p.category] || CATEGORY_COLORS['기타'];
          return `
            <div onclick="window._buOpenPost('${p.id}')"
              style="background:var(--card-bg);border-radius:12px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,0.08);cursor:pointer;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="font-size:12px;font-weight:600;padding:2px 8px;border-radius:20px;background:${cc.bg};color:${cc.color};">${p.category}</span>
              </div>
              <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:var(--text);">${p.title}</p>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:12px;color:var(--text-muted);">${p.authorName} · ${p.createdAt}</span>
                <span style="font-size:12px;color:var(--text-muted);">👁 ${p.views || 0} ♥ ${p.likes || 0}</span>
              </div>
            </div>`;
        }).join('')}
    </div>`;
}

function _renderDetail() {
  const posts = _load();
  const post = posts.find(p => p.id === _detailId);
  if (!post) return `<div style="padding:40px;text-align:center;color:var(--text-muted);">게시글을 찾을 수 없습니다.</div>`;
  const cc = CATEGORY_COLORS[post.category] || CATEGORY_COLORS['기타'];
  return `
    <div style="padding:16px;max-width:600px;margin:0 auto;">
      <span style="font-size:12px;font-weight:600;padding:2px 8px;border-radius:20px;background:${cc.bg};color:${cc.color};">${post.category}</span>
      <h2 style="margin:12px 0 8px;font-size:18px;font-weight:700;color:var(--text);">${post.title}</h2>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border);">
        <span style="font-size:13px;color:var(--text-muted);">${post.authorName} · ${post.createdAt}</span>
        <span style="font-size:12px;color:var(--text-muted);">👁 ${post.views || 0}</span>
      </div>
      <p style="font-size:15px;color:var(--text);line-height:1.7;white-space:pre-wrap;margin:0 0 24px;">${post.content}</p>
      <button onclick="window._buLike('${post.id}')"
        style="display:flex;align-items:center;gap:6px;padding:10px 20px;border:1.5px solid var(--border);border-radius:20px;background:var(--card-bg);cursor:pointer;font-size:14px;color:var(--text-muted);">
        ♥ 좋아요 ${post.likes || 0}
      </button>
    </div>`;
}

function _renderWrite() {
  return `
    <div style="padding:16px;display:flex;flex-direction:column;gap:16px;">
      <div>
        <label style="font-size:13px;font-weight:600;color:var(--text);display:block;margin-bottom:6px;">카테고리 *</label>
        <select id="bu-cat" style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;box-sizing:border-box;background:var(--card-bg);">
          <option value="">카테고리 선택</option>
          ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
      <div>
        <label style="font-size:13px;font-weight:600;color:var(--text);display:block;margin-bottom:6px;">제목 *</label>
        <input id="bu-title" type="text" placeholder="제목을 입력해 주세요."
          style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;box-sizing:border-box;" />
      </div>
      <div>
        <label style="font-size:13px;font-weight:600;color:var(--text);display:block;margin-bottom:6px;">내용 *</label>
        <textarea maxlength="500" id="bu-content" rows="8" placeholder="내용을 입력해 주세요."
          style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;resize:vertical;box-sizing:border-box;font-family:inherit;"></textarea>
      </div>
      <button onclick="window._buSubmit()"
        style="width:100%;padding:14px;background:#6366f1;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;">
        게시하기
      </button>
    </div>`;
}

function _handleSubmit() {
  const cat     = document.getElementById('bu-cat')?.value;
  const title   = document.getElementById('bu-title')?.value?.trim();
  const content = document.getElementById('bu-content')?.value?.trim();

  if (!cat)     { showToast('카테고리를 선택해 주세요.', 'error'); return; }
  if (!title)   { showToast('제목을 입력해 주세요.', 'error'); return; }
  if (!content) { showToast('내용을 입력해 주세요.', 'error'); return; }

  const posts = _load();
  posts.unshift({
    id: 'BP' + Date.now(),
    authorId: _empId(),
    authorName: _empName(),
    category: cat,
    title,
    content,
    createdAt: new Date().toISOString().slice(0, 10),
    views: 0,
    likes: 0,
  });
  _save(posts);
  _activeTab = 'all';
  showToast('게시글이 등록되었습니다.', 'success')
    addNotification({ type: 'success', title: '게시판', body: '게시글이 등록되었습니다.' });
  _render();
}
