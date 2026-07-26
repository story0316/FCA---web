/**
 * notice-admin.js — 공지사항 관리 (관리자)
 */

import { getUser } from '../../auth.js';
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS_NOTICES = 'hr_notices';

const CATEGORIES = ['HR', '경영', '복지', '총무', '기타'];

function _getNotices() {
  try { return JSON.parse(localStorage.getItem(LS_NOTICES) || '[]'); } catch { return []; }
}

function _saveNotices(list) {
  localStorage.setItem(LS_NOTICES, JSON.stringify(list));
}

let _view = 'list'; // 'list' | 'edit'
let _editId = null;

export function render(root) {
  _renderPage(root);
}

export function unmount() {
  _view = 'list';
  _editId = null;
}

function _renderPage(root) {
  if (_view === 'edit') { _renderEditForm(root); return; }
  _renderList(root);
}

function _renderList(root) {
  const notices = _getNotices();

  root.innerHTML = `
<div style="padding:16px">

  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
    <div style="font-size:15px;font-weight:700">📢 공지사항 관리</div>
    <button id="new-btn" style="background:#4F46E5;color:#fff;border:none;border-radius:10px;
      padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer">+ 새 공지</button>
  </div>

  <div style="font-size:12px;color:#64748B;margin-bottom:10px">총 ${notices.length}개 공지</div>

  ${notices.length === 0
    ? `<div style="text-align:center;padding:40px;color:#94A3B8;font-size:13px">
         <div style="font-size:36px;margin-bottom:10px">📭</div>
         공지사항이 없습니다. 새 공지를 작성해보세요.
       </div>`
    : notices.map(n => `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:12px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px">
          ${n.pinned ? '<span style="font-size:12px">📌</span>' : ''}
          ${n.important ? '<span style="background:#FEE2E2;color:#DC2626;font-size:10px;padding:2px 5px;border-radius:4px;font-weight:700">중요</span>' : ''}
          <span style="font-size:11px;color:#64748B;padding:1px 7px;background:var(--bg);
            border:1px solid var(--border);border-radius:8px">${n.category}</span>
        </div>
        <div style="font-size:13px;font-weight:600;color:var(--text);
             white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n.title}</div>
        <div style="font-size:11px;color:#94A3B8;margin-top:3px">
          ${n.createdAt.slice(0,10)} · 👁 ${n.views || 0}
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="pin-btn" data-id="${n.id}" title="${n.pinned?'고정 해제':'상단 고정'}"
          style="padding:5px 8px;border:1px solid var(--border);border-radius:7px;
                 background:${n.pinned?'#EEF2FF':'var(--bg)'};color:${n.pinned?'#4F46E5':'#64748B'};
                 cursor:pointer;font-size:12px">📌</button>
        <button class="edit-btn" data-id="${n.id}"
          style="padding:5px 10px;border:1px solid #4F46E5;border-radius:7px;
                 background:#EEF2FF;color:#4F46E5;cursor:pointer;font-size:12px;font-weight:600">수정</button>
        <button class="del-btn" data-id="${n.id}"
          style="padding:5px 10px;border:1px solid #EF4444;border-radius:7px;
                 background:#FEE2E2;color:#EF4444;cursor:pointer;font-size:12px;font-weight:600">삭제</button>
      </div>
    </div>
  </div>`).join('')}

</div>`;

  root.querySelector('#new-btn').addEventListener('click', () => {
    _editId = null; _view = 'edit'; _renderPage(root);
  });

  root.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _editId = btn.dataset.id; _view = 'edit'; _renderPage(root);
    });
  });

  root.querySelectorAll('.pin-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const list = _getNotices();
      const n = list.find(x => x.id === btn.dataset.id);
      if (n) { n.pinned = !n.pinned; _saveNotices(list); _renderPage(root); }
    });
  });

  root.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('공지사항을 삭제하시겠습니까?')) return;
      const list = _getNotices().filter(x => x.id !== btn.dataset.id);
      _saveNotices(list);
      showToast('삭제되었습니다.', 'info');
      _renderPage(root);
    });
  });
}

function _renderEditForm(root) {
  const notices  = _getNotices();
  const existing = _editId ? notices.find(n => n.id === _editId) : null;
  const user = getUser();

  root.innerHTML = `
<div style="padding:16px">

  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button id="back-btn" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text)">←</button>
    <div style="font-size:15px;font-weight:700">${existing ? '공지 수정' : '새 공지 작성'}</div>
  </div>

  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px">

    <div style="margin-bottom:10px">
      <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">제목</label>
      <input id="n-title" type="text" value="${existing?.title || ''}"
        placeholder="공지 제목을 입력하세요"
        style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
               font-size:14px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>

    <div style="margin-bottom:10px">
      <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">카테고리</label>
      <select id="n-cat" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);
        border-radius:10px;font-size:14px;background:var(--bg);color:var(--text)">
        ${CATEGORIES.map(c => `<option value="${c}" ${existing?.category===c?'selected':''}>${c}</option>`).join('')}
      </select>
    </div>

    <div style="margin-bottom:10px">
      <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">본문</label>
      <textarea id="n-content" placeholder="공지 내용을 입력하세요..."
        style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;
               font-size:13px;background:var(--bg);color:var(--text);height:180px;resize:vertical;
               box-sizing:border-box;font-family:inherit;line-height:1.6">${existing?.content || ''}</textarea>
    </div>

    <div style="display:flex;gap:16px">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px">
        <input type="checkbox" id="n-pinned" ${existing?.pinned?'checked':''}
          style="width:16px;height:16px;cursor:pointer">
        📌 상단 고정
      </label>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px">
        <input type="checkbox" id="n-important" ${existing?.important?'checked':''}
          style="width:16px;height:16px;cursor:pointer">
        ❗ 중요 표시
      </label>
    </div>
  </div>

  <button id="save-btn" class="btn btn-primary" style="width:100%;margin-bottom:8px">
    ${existing ? '수정 완료' : '공지 게시'}
  </button>

</div>`;

  root.querySelector('#back-btn').addEventListener('click', () => {
    _view = 'list'; _renderPage(root);
  });

  root.querySelector('#save-btn').addEventListener('click', () => {
    const title   = root.querySelector('#n-title').value.trim();
    const content = root.querySelector('#n-content').value.trim();
    if (!title)   { showToast('제목을 입력하세요.', 'error'); return; }
    if (!content) { showToast('내용을 입력하세요.', 'error'); return; }

    const list = _getNotices();
    const authorName = user?.name_ko || user?.name || '관리자';

    if (existing) {
      const idx = list.findIndex(n => n.id === _editId);
      if (idx >= 0) {
        list[idx] = {
          ...list[idx],
          title,
          category: root.querySelector('#n-cat').value,
          content,
          pinned:    root.querySelector('#n-pinned').checked,
          important: root.querySelector('#n-important').checked,
        };
      }
      showToast('공지가 수정되었습니다.', 'success');
    } else {
      const newNotice = {
        id: 'N_' + Date.now(),
        title,
        category: root.querySelector('#n-cat').value,
        content,
        author: authorName,
        pinned:    root.querySelector('#n-pinned').checked,
        important: root.querySelector('#n-important').checked,
        createdAt: new Date().toISOString(),
        views: 0,
      };
      list.unshift(newNotice);
      addNotification({ type: 'system', title: `새 공지: "${title}" — ${authorName}`, body: '' });
      showToast('공지가 게시되었습니다.', 'success');
    }
    _saveNotices(list);
    _view = 'list'; _renderPage(root);
  });
}
export function mount(root) { return render(root); }
