/**
 * personnel-history.js — 인사발령 이력 관리
 */

import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';
import { api } from '../../api.js';

const TYPE_META = {
  promotion:    { label: '승진',     icon: '⬆️', color: '#10B981', bg: '#D1FAE5' },
  transfer:     { label: '부서이동', icon: '↔️', color: '#3B82F6', bg: '#DBEAFE' },
  title_change: { label: '직책변경', icon: '🏷️', color: '#8B5CF6', bg: '#EDE9FE' },
  salary:       { label: '급여조정', icon: '💰', color: '#F59E0B', bg: '#FEF3C7' },
  hire:         { label: '신규입사', icon: '🎉', color: '#059669', bg: '#D1FAE5' },
  resign:       { label: '퇴직',     icon: '👋', color: '#EF4444', bg: '#FEE2E2' },
};

let _filterType = 'all';
let _employees  = [];
let _history = [];
let _orgId = '';
let _loadError = '';

export async function mount(root) {
  _filterType = 'all';
  _history = [];
  _loadError = '';
  const user = _storedUser();
  _orgId = user.org_id || '';
  root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">⏳</div><div style="font-size:13px">인사발령 이력을 불러오는 중...</div></div>`;
  try {
    const [employees, history] = await Promise.all([
      loadDisplayEmployees(_orgId),
      api.personnelEvents.list(_orgId),
    ]);
    _employees = employees;
    _history = history || [];
  } catch (error) {
    _employees = await loadDisplayEmployees(_orgId).catch(() => []);
    _loadError = error.message || '인사발령 이력을 불러오지 못했습니다.';
  }
  _renderPage(root);
}

export function render(root) { _renderPage(root); }

function _renderPage(root) {
  const filtered = _filterType === 'all'
    ? _history
    : _history.filter(h => h.type === _filterType);

  if (_loadError) {
    root.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
        <div style="font-size:44px;margin-bottom:12px">⚠️</div>
        <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">인사발령 이력을 불러오지 못했습니다.</div>
        <div style="font-size:12px;line-height:1.6;margin-bottom:18px">${_escape(_loadError)}</div>
        <button id="history-retry-btn" style="${_btnStyle('#4F46E5')}">다시 시도</button>
      </div>`;
    root.querySelector('#history-retry-btn')?.addEventListener('click', () => mount(root));
    return;
  }

  root.innerHTML = `
<div id="personnel-history-wrap">
  <!-- 필터 + 추가 버튼 -->
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap">
    <select id="type-filter" style="${_selectStyle()}">
      <option value="all">전체 유형</option>
      ${Object.entries(TYPE_META).map(([k, v]) =>
        `<option value="${k}" ${_filterType===k?'selected':''}>${v.icon} ${v.label}</option>`
      ).join('')}
    </select>
    <button id="add-history-btn" style="${_btnStyle('#4F46E5')}">+ 발령 등록</button>
    <button id="export-csv-btn" style="${_btnStyle('#64748B')}">CSV</button>
  </div>

  <!-- 통계 칩 -->
  <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:14px;scrollbar-width:none">
    ${Object.entries(TYPE_META).map(([k, v]) => {
      const cnt = _history.filter(h => h.type === k).length;
      return `<div style="flex-shrink:0;background:${v.bg};color:${v.color};padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700">
        ${v.icon} ${v.label} ${cnt}
      </div>`;
    }).join('')}
  </div>

  <!-- 발령 목록 -->
  <div id="history-list">
    ${filtered.length ? filtered.map(h => _renderCard(h)).join('') : `
    <div style="text-align:center;padding:40px;color:#94A3B8">
      <div style="font-size:36px;margin-bottom:10px">📋</div>
      <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:6px">${_filterType === 'all' ? '등록된 인사발령이 없습니다.' : '해당 유형의 발령 내역이 없습니다.'}</div>
      <div style="font-size:12px;margin-bottom:14px">승진, 이동, 입·퇴사 이력을 등록해 조직 변경 기록을 관리하세요.</div>
      ${_filterType === 'all' ? `<button id="empty-add-history-btn" style="${_btnStyle('#4F46E5')}">첫 발령 등록</button>` : ''}
    </div>`}
  </div>

  <!-- 등록 모달 -->
  <div id="add-modal" style="display:none"></div>
</div>`;

  _bindEvents(root);
}

function _renderCard(h) {
  const meta = TYPE_META[h.type] || TYPE_META.hire;
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin-bottom:10px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
    <span style="width:36px;height:36px;border-radius:10px;background:${meta.bg};color:${meta.color};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${meta.icon}</span>
    <div style="flex:1">
      <div style="font-size:14px;font-weight:700">${_escape(h.name)} <span style="font-size:12px;font-weight:400;color:#64748B">${_escape(h.dept)}</span></div>
      <div style="font-size:12px;color:#94A3B8">${_escape(h.effectiveDate)}</div>
    </div>
    <span style="font-size:12px;padding:3px 10px;border-radius:20px;font-weight:600;color:${meta.color};background:${meta.bg}">${meta.label}</span>
  </div>
  <div style="display:flex;align-items:center;gap:8px;font-size:13px">
    ${h.prevValue ? `<span style="color:#94A3B8;text-decoration:line-through">${_escape(h.prevValue)}</span><span style="color:#94A3B8">→</span>` : ''}
    <span style="font-weight:600;color:${meta.color}">${_escape(h.newValue)}</span>
  </div>
  ${h.memo ? `<div style="font-size:12px;color:#94A3B8;margin-top:6px">📝 ${_escape(h.memo)}</div>` : ''}
</div>`;
}

function _bindEvents(root) {
  root.querySelector('#type-filter')?.addEventListener('change', e => {
    _filterType = e.target.value;
    _renderPage(root);
  });

  root.querySelector('#add-history-btn')?.addEventListener('click', () => {
    _showAddModal(root);
  });

  root.querySelector('#export-csv-btn')?.addEventListener('click', () => {
    const rows = [
      ['발령일', '이름', '부서', '유형', '변경 전', '변경 후', '메모'],
      ..._history.map(h => [
        h.effectiveDate, h.name, h.dept,
        TYPE_META[h.type]?.label || h.type,
        h.prevValue || '', h.newValue || '', h.memo || '',
      ]),
    ];
    const csv  = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = '인사발령이력.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast('CSV 다운로드 완료', 'success')
    addNotification({ type: 'success', title: 'Personnel History (관리자)', body: 'CSV 다운로드 완료' });
  });

  root.querySelector('#empty-add-history-btn')?.addEventListener('click', () => {
    _showAddModal(root);
  });
}

function _showAddModal(root) {
  const modal = root.querySelector('#add-modal');
  modal.style.display = 'block';
  const empOptions = _employees.length
    ? _employees.map(e => `<option value="${_escape(e.id)}">${_escape(e.name)} (${_escape(e.dept || '미지정')})</option>`).join('')
    : '<option value="">직원 목록 없음</option>';

  modal.innerHTML = `
<div style="background:var(--card-bg);border:2px solid var(--border);border-radius:16px;padding:20px;margin-top:16px">
  <div style="font-size:15px;font-weight:700;margin-bottom:14px">발령 등록</div>
  <div style="display:flex;flex-direction:column;gap:10px">
    <select id="m-emp" class="form-input">
      <option value="">직원 선택 *</option>
      ${empOptions}
    </select>
    <select id="m-type" class="form-input">
      ${Object.entries(TYPE_META).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}
    </select>
    <input id="m-prev"  class="form-input" placeholder="변경 전 (선택)">
    <input id="m-new"   class="form-input" placeholder="변경 후 *">
    <input id="m-date"  class="form-input" type="date" value="${new Date().toISOString().slice(0,10)}">
    <input id="m-memo"  class="form-input" placeholder="메모 (선택)">
    <div style="display:flex;gap:8px;margin-top:4px">
      <button id="m-save" style="${_btnStyle('#4F46E5')}">저장</button>
      <button id="m-cancel" style="${_btnStyle('#94A3B8')}">취소</button>
    </div>
  </div>
</div>
<style>
.form-input { width:100%; padding:9px 12px; border:1.5px solid var(--border); border-radius:10px; font-size:14px; background:var(--card-bg); color:var(--text); box-sizing:border-box; }
</style>`;

  root.querySelector('#m-cancel').addEventListener('click', () => {
    modal.style.display = 'none';
    modal.innerHTML = '';
  });

  root.querySelector('#m-save').addEventListener('click', async () => {
    const empSel = root.querySelector('#m-emp');
    const userId = empSel.value;
    const nval   = root.querySelector('#m-new').value.trim();
    const effectiveDate = root.querySelector('#m-date').value;
    if (!userId || !nval || !effectiveDate) {
      showToast('직원, 변경 후 값, 적용일은 필수입니다.', 'error');
      return;
    }

    const saveButton = root.querySelector('#m-save');
    saveButton.disabled = true;
    saveButton.textContent = '저장 중...';
    const rec = {
      userId,
      type:          root.querySelector('#m-type').value,
      prevValue:     root.querySelector('#m-prev').value.trim() || null,
      newValue:      nval,
      effectiveDate,
      memo:          root.querySelector('#m-memo').value.trim(),
    };
    try {
      const created = await api.personnelEvents.create(_orgId, rec);
      if (!created) throw new Error('등록 결과를 확인하지 못했습니다.');
      _history.unshift(created);
      _history.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
      showToast('발령이 등록되었습니다.', 'success');
      addNotification({
        type: 'success',
        title: '인사발령',
        body: `${created.name || '직원'}님의 ${TYPE_META[created.type]?.label || '인사발령'}이 등록되었습니다.`,
      });
      modal.style.display = 'none';
      _renderPage(root);
    } catch (error) {
      showToast(error.message || '발령 등록에 실패했습니다.', 'error');
      saveButton.disabled = false;
      saveButton.textContent = '저장';
    }
  });
}

function _storedUser() {
  try {
    return JSON.parse(localStorage.getItem('hr_user') || '{}');
  } catch {
    return {};
  }
}

function _escape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function _selectStyle() {
  return 'border:1.5px solid var(--border);border-radius:8px;padding:7px 12px;font-size:13px;background:var(--card-bg);color:var(--text);cursor:pointer;';
}
function _btnStyle(bg) {
  return `background:${bg};color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;`;
}

export function unmount() {
  _filterType = 'all';
  _employees  = [];
  _history = [];
  _orgId = '';
  _loadError = '';
}
