/**
 * org-chart.js — 조직도 편집·조회 (#/admin/org-chart)
 */

import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';
import {
  getOrgStructure, saveOrgStructure, buildTree, flattenTree, totalHeadcount,
} from '../../utils/org-engine.js';

let _expandedIds = new Set(['DEPT_CEO', 'DEPT_DEV']);
let _editMode    = false;

export function render(root) {
  _renderPage(root);
}

function _renderPage(root) {
  const org  = getOrgStructure();
  const tree = buildTree(org.departments);
  const flat = flattenTree(tree);
  if (!flat||!flat.length){root.innerHTML=`<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:48px;margin-bottom:12px">🏢</div><div style="font-size:14px;font-weight:600;margin-bottom:6px">조직도 데이터가 없습니다.</div><div style="font-size:12px">데이터가 축적되면 자동으로 표시됩니다.</div></div>`;return;}
  const total = org.departments.reduce((s, d) => s + (d.headcount || 0), 0);

  root.innerHTML = `
<div id="org-chart-wrap">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
    <div>
      <div style="font-weight:700;font-size:15px">전체 조직</div>
      <div style="font-size:12px;color:#64748B;margin-top:2px">총 ${total}명 · ${org.departments.length}개 부서</div>
    </div>
    <button id="toggle-edit" style="${_btnStyle(_editMode ? '#EF4444' : '#4F46E5')}">
      ${_editMode ? '✕ 편집 취소' : '✏️ 편집'}
    </button>
  </div>

  <!-- 조직 트리 -->
  <div id="org-tree">
    ${flat.map(node => _renderNode(node, org)).join('')}
  </div>

  ${_editMode ? _renderAddForm(org) : ''}
</div>
${_styles()}`;

  _bindEvents(root, org);
}

function _renderNode({ dept, depth, children }, org) {
  const hasChildren = children.length > 0;
  const isExpanded  = _expandedIds.has(dept.id);
  const manager     = org.managers?.[dept.managerId];
  const isHidden    = !_isVisible(dept, org.departments);

  if (isHidden) return '';

  const indent = depth * 20;
  const hc = dept.headcount || 0;

  return `
<div class="org-node" data-id="${dept.id}" style="padding-left:${indent}px">
  <div class="on-row">
    <button class="on-toggle ${!hasChildren ? 'invisible' : ''}"
            data-id="${dept.id}">${isExpanded ? '▾' : '▸'}</button>
    <div class="on-dept-icon" style="background:#4F46E520;color:#4F46E5">🏢</div>
    <div class="on-body">
      <div class="on-name">${dept.name}</div>
      <div class="on-meta">
        ${manager ? `${manager.name} (${manager.position}) · ` : ''}${hc}명
      </div>
    </div>
    ${_editMode ? `
    <div class="on-actions">
      <button class="btn-edit-dept" data-id="${dept.id}" title="편집">✏️</button>
      ${dept.parentId ? `<button class="btn-del-dept" data-id="${dept.id}" title="삭제">🗑</button>` : ''}
    </div>` : ''}
  </div>
</div>`;
}

function _isVisible(dept, departments) {
  if (!dept.parentId) return true;
  if (!_expandedIds.has(dept.parentId)) return false;
  const parent = departments.find(d => d.id === dept.parentId);
  return parent ? _isVisible(parent, departments) : false;
}

function _renderAddForm(org) {
  return `
<div class="add-dept-form" style="margin-top:16px;background:var(--card-bg);border:2px dashed var(--border);border-radius:14px;padding:16px">
  <div style="font-size:14px;font-weight:700;margin-bottom:12px">+ 부서 추가</div>
  <input id="new-dept-name" class="form-input" placeholder="부서명" style="margin-bottom:8px">
  <select id="new-dept-parent" class="form-input" style="margin-bottom:8px">
    <option value="">상위 부서 없음</option>
    ${org.departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
  </select>
  <input id="new-dept-hc" class="form-input" type="number" placeholder="인원수" min="0" style="margin-bottom:12px">
  <button id="add-dept-btn" style="${_btnStyle('#10B981')}">추가</button>
</div>`;
}

function _bindEvents(root, org) {
  root.querySelector('#toggle-edit')?.addEventListener('click', () => {
    _editMode = !_editMode;
    _renderPage(root);
  });

  // 토글 expand/collapse
  root.querySelector('#org-tree')?.addEventListener('click', e => {
    const toggleBtn = e.target.closest('.on-toggle');
    if (toggleBtn && !e.target.closest('.on-actions')) {
      const id = toggleBtn.dataset.id;
      if (_expandedIds.has(id)) _expandedIds.delete(id);
      else _expandedIds.add(id);
      _renderPage(root);
    }

    const editBtn = e.target.closest('.btn-edit-dept');
    if (editBtn) {
      const id   = editBtn.dataset.id;
      const dept = org.departments.find(d => d.id === id);
      if (!dept) return;
      const newName = prompt('부서명 변경:', dept.name);
      if (newName && newName.trim()) {
        dept.name = newName.trim();
        saveOrgStructure(org);
        showToast('부서명이 변경되었습니다.', 'success')
      addNotification({ type: 'success', title: 'org chart', body: '부서명이 변경되었습니다.' });
        _renderPage(root);
      }
    }

    const delBtn = e.target.closest('.btn-del-dept');
    if (delBtn) {
      const id = delBtn.dataset.id;
      if (!confirm('이 부서를 삭제하시겠습니까? 하위 부서도 함께 삭제됩니다.')) return;
      org.departments = org.departments.filter(d => d.id !== id && d.parentId !== id);
      saveOrgStructure(org);
      showToast('부서가 삭제되었습니다.', 'info');
      _renderPage(root);
    }
  });

  root.querySelector('#add-dept-btn')?.addEventListener('click', () => {
    const name     = root.querySelector('#new-dept-name').value.trim();
    const parentId = root.querySelector('#new-dept-parent').value || null;
    const hc       = parseInt(root.querySelector('#new-dept-hc').value || '0', 10);
    if (!name) { showToast('부서명을 입력해 주세요.', 'error'); return; }
    const newDept = {
      id:         'DEPT_' + Date.now(),
      name,
      parentId,
      managerId:  null,
      headcount:  hc,
    };
    org.departments.push(newDept);
    saveOrgStructure(org);
    showToast(`"${name}" 부서가 추가되었습니다.`, 'success');
    _renderPage(root);
  });
}

function _btnStyle(bg) {
  return `background:${bg};color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;`;
}

function _styles() {
  return `<style>
.org-node { border-left:2px solid var(--border); margin-left:8px; }
.org-node:last-child { border-left-color:transparent; }
.on-row { display:flex; align-items:center; gap:8px; padding:8px 6px; border-radius:10px; cursor:default; }
.on-row:hover { background:var(--surface,#F8FAFC); }
.on-toggle { background:none; border:1px solid var(--border); border-radius:6px; width:22px; height:22px; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.on-toggle.invisible { visibility:hidden; }
.on-dept-icon { width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; }
.on-body { flex:1; min-width:0; }
.on-name { font-size:14px; font-weight:700; }
.on-meta { font-size:11px; color:#94A3B8; margin-top:1px; }
.on-actions { display:flex; gap:4px; }
.btn-edit-dept, .btn-del-dept { background:none; border:none; font-size:14px; cursor:pointer; padding:4px; border-radius:6px; }
.btn-del-dept:hover { background:#FEE2E2; }
.form-input { width:100%; padding:9px 12px; border:1.5px solid var(--border); border-radius:10px; font-size:14px; background:var(--card-bg); color:var(--text); box-sizing:border-box; }
</style>`;
}

export function unmount() {
  _editMode = false;
}
export function mount(root) { return render(root); }
