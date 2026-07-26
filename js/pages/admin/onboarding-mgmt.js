/**
 * onboarding-mgmt.js — 온보딩 Task 관리 (관리자 탭)
 */

import { showToast } from '../../components/toast.js';
import { showFormModal } from '../../components/form-modal.js';
import { addNotification } from '../../components/notification-hub.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';

const LS_ONBOARDING = 'hr_onboarding_tasks';
const LEGACY_DEMO_IDS = new Set(['EMP_NEW_001', 'EMP_NEW_002']);

const ONBOARDING_TEMPLATE = [
  { id:'T01', label:'근로계약서 서명',        dueDay:1,  category:'법무', required:true },
  { id:'T02', label:'4대보험 신고',           dueDay:3,  category:'법무', required:true },
  { id:'T03', label:'사원증·PC 지급',         dueDay:1,  category:'총무', required:true },
  { id:'T04', label:'법정교육 오리엔테이션',  dueDay:5,  category:'교육', required:true },
  { id:'T05', label:'버디(멘토) 배정',        dueDay:3,  category:'HR',   required:true },
  { id:'T06', label:'팀 소개 미팅',           dueDay:7,  category:'팀',   required:false },
  { id:'T07', label:'업무 툴 계정 생성',      dueDay:2,  category:'IT',   required:true },
  { id:'T08', label:'보안 서약서 서명',        dueDay:5,  category:'법무', required:true },
  { id:'T09', label:'복리후생 안내',           dueDay:7,  category:'HR',   required:false },
  { id:'T10', label:'30일 체크인 면담',        dueDay:30, category:'HR',   required:false },
];

function _getOnboarding() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_ONBOARDING) || '[]');
    const list = Array.isArray(saved) ? saved : [];
    const cleaned = list.filter(item => !LEGACY_DEMO_IDS.has(item.userId));
    if (cleaned.length !== list.length) _saveOnboarding(cleaned);
    return cleaned;
  }
  catch (_) { return []; }
}

function _saveOnboarding(list) {
  localStorage.setItem(LS_ONBOARDING, JSON.stringify(list));
}

function _dDay(startDate, dueDay) {
  const due  = new Date(startDate);
  due.setDate(due.getDate() + dueDay - 1);
  const diff = Math.ceil((due - new Date()) / 86400000);
  if (diff < 0)  return { label: `D+${Math.abs(diff)}`, over: true };
  if (diff === 0) return { label: 'D-Day', over: false };
  return { label: `D-${diff}`, over: false };
}

let _selectedEmp = null;
let _employees   = [];
let _root        = null;

export async function mount(root) {
  _root = root;
  _selectedEmp = null;
  _employees   = await loadDisplayEmployees().catch(() => []);
  root.onclick = e => _handleClick(root, e);
  render(root);
}

export function unmount() {
  _selectedEmp = null;
  _employees   = [];
  if (_root) _root.onclick = null;
  _root = null;
}

export function render(root) {
  _renderPage(root);
}

function _renderPage(root) {
  const list = _getOnboarding();

  if (!list.length) {
    root.innerHTML = `
<div style="text-align:center;padding:48px 20px;color:#94A3B8">
  <div style="font-size:40px;margin-bottom:10px">🚀</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:4px">온보딩 진행자가 없습니다.</div>
  <div style="font-size:12px;margin-bottom:20px">신규 입사자를 등록해 온보딩을 시작하세요.</div>
  <button id="add-emp-btn-empty"
    style="background:#4F46E5;color:#fff;border:none;border-radius:10px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer">
    + 신규 입사자 등록
  </button>
</div>`;
    return;
  }

  root.innerHTML = `
<div id="onboarding-wrap">
  <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none;margin-bottom:16px">
    <button class="emp-chip ${!_selectedEmp ? 'active' : ''}" data-id="">전체 (${list.length}명)</button>
    ${list.map(e => `
      <button class="emp-chip ${_selectedEmp === e.userId ? 'active' : ''}" data-id="${e.userId}">
        ${e.name}
      </button>`).join('')}
    <button id="add-emp-btn" style="flex-shrink:0;background:#EEF2FF;color:#4338CA;border:none;border-radius:20px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer">+ 추가</button>
  </div>
  <div id="onboarding-list">
    ${list.filter(e => !_selectedEmp || e.userId === _selectedEmp).map(e => _renderEmpCard(e)).join('')}
  </div>
</div>`;

  _injectStyle(root);
}

function _renderEmpCard(emp) {
  const done  = emp.tasks.filter(t => t.done).length;
  const total = emp.tasks.length;
  const pct   = Math.round(done / total * 100);
  const pctColor = pct === 100 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';

  return `
<div class="ob-card">
  <div class="ob-header">
    <div>
      <div class="ob-name">${emp.name} <span class="ob-dept">${emp.dept}</span></div>
      <div class="ob-date">입사일 ${emp.startDate}</div>
    </div>
    <div class="ob-pct" style="color:${pctColor}">${pct}%</div>
  </div>
  <div class="ob-bar-wrap">
    <div class="ob-bar" style="width:${pct}%;background:${pctColor}"></div>
  </div>
  <div style="font-size:12px;color:#64748B;margin-bottom:12px">${done} / ${total} 완료</div>
  <div class="ob-tasks">
    ${emp.tasks.map(t => {
      const dd = !t.done ? _dDay(emp.startDate, t.dueDay) : null;
      return `
      <div class="ob-task">
        <button class="ob-check ${t.done ? 'checked' : ''}" data-emp="${emp.userId}" data-task="${t.id}">
          ${t.done ? '✅' : '○'}
        </button>
        <div class="ob-task-body">
          <span class="ob-task-label ${t.done ? 'strike' : ''}">${t.label}</span>
          ${t.required ? '<span class="ob-req">필수</span>' : ''}
        </div>
        ${!t.done ? `<span class="ob-dday ${dd.over ? 'over' : ''}">${dd.label}</span>` : ''}
      </div>`;
    }).join('')}
  </div>
</div>`;
}

async function _openAddModal(root, list) {
  const registeredIds = new Set(list.map(item => item.userId));
  const available = _employees.filter(emp => !registeredIds.has(emp.id));
  if (!available.length) {
    showToast(
      _employees.length ? '등록 가능한 직원이 없습니다.' : '직원 목록을 불러온 뒤 다시 시도해 주세요.',
      'info',
    );
    return;
  }
  const empOptions = available.map(e => ({
    value: e.id,
    label: `${e.name} (${e.dept || '부서 미지정'})`,
  }));

  const result = await showFormModal({
    title: '신규 입사자 등록',
    fields: [
      { name: 'empId', label: '직원 선택', type: 'select', options: empOptions, required: true },
      { name: 'start', label: '입사일', type: 'date', defaultValue: new Date().toISOString().slice(0, 10), required: true },
    ],
    confirmLabel: '온보딩 시작',
  });
  if (!result) return;

  const emp = available.find(e => e.id === result.empId);
  if (!emp) {
    showToast('선택한 직원을 확인할 수 없습니다.', 'error');
    return;
  }

  const newEmp = {
    userId: emp.id,
    name: emp.name,
    dept: emp.dept || emp.department || '',
    startDate: result.start,
    templateVersion: 1,
    tasks: ONBOARDING_TEMPLATE.map(t => ({ ...t, done: false, doneAt: null })),
  };
  list.push(newEmp);
  _saveOnboarding(list);
  showToast(`${emp.name} 온보딩이 시작되었습니다. 🎉`, 'success');
  addNotification({ type: 'success', title: 'Onboarding Mgmt (관리자)', body: `${emp.name} 온보딩이 시작되었습니다. 🎉` });
  _renderPage(root);
}

function _handleClick(root, event) {
  const list = _getOnboarding();
  const chip = event.target.closest('.emp-chip');
  if (chip) {
    _selectedEmp = chip.dataset.id || null;
    _renderPage(root);
    return;
  }
  if (event.target.closest('#add-emp-btn, #add-emp-btn-empty')) {
    _openAddModal(root, list);
    return;
  }
  const chk = event.target.closest('.ob-check');
  if (chk) {
    const emp = list.find(item => item.userId === chk.dataset.emp);
    if (!emp) return;
    const task = emp.tasks.find(t => t.id === chk.dataset.task);
    if (!task) return;
    task.done   = !task.done;
    task.doneAt = task.done ? new Date().toISOString().slice(0, 10) : null;
    _saveOnboarding(list);
    const done = emp.tasks.filter(t => t.done).length;
    if (task.done && done === emp.tasks.length) {
      showToast(`${emp.name} 온보딩이 100% 완료되었습니다! 🎉`, 'success');
      addNotification({ type: 'success', title: 'Onboarding Mgmt (관리자)', body: '온보딩이 100% 완료되었습니다! 🎉' });
    } else {
      showToast(task.done ? '완료 처리되었습니다.' : '미완료로 변경되었습니다.', 'info');
    }
    _renderPage(root);
  }
}

function _injectStyle(root) {
  if (root.querySelector('#ob-mgmt-style')) return;
  const s = document.createElement('style');
  s.id = 'ob-mgmt-style';
  s.textContent = `.emp-chip{flex-shrink:0;background:var(--card-bg);border:1.5px solid var(--border);border-radius:20px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;color:var(--text)}.emp-chip.active{background:#4F46E5;border-color:#4F46E5;color:#fff}.ob-card{background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px}.ob-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}.ob-name{font-size:15px;font-weight:700}.ob-dept{font-size:12px;color:#64748B;font-weight:400;margin-left:6px}.ob-date{font-size:12px;color:#94A3B8;margin-top:2px}.ob-pct{font-size:22px;font-weight:800}.ob-bar-wrap{height:8px;background:var(--border);border-radius:4px;overflow:hidden;margin-bottom:6px}.ob-bar{height:100%;border-radius:4px;transition:width .5s}.ob-tasks{display:flex;flex-direction:column;gap:8px}.ob-task{display:flex;align-items:center;gap:8px}.ob-check{background:none;border:2px solid var(--border);border-radius:6px;width:28px;height:28px;font-size:14px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center}.ob-check.checked{border-color:#10B981}.ob-task-body{flex:1;min-width:0}.ob-task-label{font-size:13px}.ob-task-label.strike{text-decoration:line-through;color:#94A3B8}.ob-req{font-size:10px;background:#FEE2E2;color:#DC2626;padding:2px 5px;border-radius:4px;margin-left:4px;font-weight:600}.ob-dday{font-size:11px;font-weight:600;flex-shrink:0}.ob-dday.over{color:#DC2626}`;
  root.appendChild(s);
}
