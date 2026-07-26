/**
 * offboarding-mgmt.js — 오프보딩 체크리스트 관리 (관리자 탭)
 */

import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';
import { showFormModal } from '../../components/form-modal.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';

const LS_OFFBOARDING = 'hr_offboarding_tasks';
const LEGACY_DEMO_IDS = new Set(['EMP_RESIGN_001']);

const OFFBOARDING_TEMPLATE = [
  { id:'O01', label:'퇴직 신청서 수령',          dueDay:-14, category:'HR',   required:true },
  { id:'O02', label:'인수인계 문서 작성',         dueDay:-7,  category:'팀',   required:true },
  { id:'O03', label:'업무 인수인계 완료',         dueDay:-3,  category:'팀',   required:true },
  { id:'O04', label:'사원증·장비 반납',           dueDay:0,   category:'총무', required:true },
  { id:'O05', label:'회사 계정 비활성화',         dueDay:0,   category:'IT',   required:true },
  { id:'O06', label:'퇴직금 정산',               dueDay:14,  category:'재무', required:true },
  { id:'O07', label:'건강보험·고용보험 상실신고', dueDay:7,   category:'법무', required:true },
  { id:'O08', label:'이직확인서 발급',            dueDay:14,  category:'HR',   required:false },
  { id:'O09', label:'지식이전 세션 완료',         dueDay:-5,  category:'팀',   required:false },
  { id:'O10', label:'오프보딩 인터뷰',            dueDay:-1,  category:'HR',   required:false },
];

function _getOffboarding() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_OFFBOARDING) || '[]');
    const list = Array.isArray(saved) ? saved : [];
    const cleaned = list.filter(item => !LEGACY_DEMO_IDS.has(item.userId));
    if (cleaned.length !== list.length) _saveOffboarding(cleaned);
    return cleaned;
  }
  catch (_) { return []; }
}

function _saveOffboarding(list) {
  localStorage.setItem(LS_OFFBOARDING, JSON.stringify(list));
}

function _daysTo(lastDay) {
  const diff = Math.ceil((new Date(lastDay) - new Date()) / 86400000);
  if (diff < 0)  return { label: `퇴사 ${Math.abs(diff)}일 경과`, color: '#94A3B8' };
  if (diff === 0) return { label: '오늘 퇴사', color: '#EF4444' };
  return { label: `D-${diff}`, color: diff <= 7 ? '#EF4444' : '#F59E0B' };
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
  const list = _getOffboarding();

  if (!list.length) {
    root.innerHTML = `
<div style="text-align:center;padding:48px 20px;color:#94A3B8">
  <div style="font-size:40px;margin-bottom:10px">👋</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:4px">퇴직 예정자가 없습니다.</div>
  <div style="font-size:12px;margin-bottom:20px">퇴직자를 등록해 오프보딩을 시작하세요.</div>
  <button id="add-resign-btn-empty"
    style="background:#EF4444;color:#fff;border:none;border-radius:10px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer">
    + 퇴직자 등록
  </button>
</div>`;
    return;
  }

  root.innerHTML = `
<div id="offboarding-wrap">
  <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none;margin-bottom:16px">
    <button class="emp-chip ${!_selectedEmp ? 'active' : ''}" data-id="">전체 (${list.length}명)</button>
    ${list.map(e => `
      <button class="emp-chip ${_selectedEmp === e.userId ? 'active' : ''}" data-id="${e.userId}">
        ${e.name}
      </button>`).join('')}
    <button id="add-resign-btn" style="flex-shrink:0;background:#FEE2E2;color:#DC2626;border:none;border-radius:20px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer">+ 퇴직 등록</button>
  </div>
  <div id="offboarding-list">
    ${list.filter(e => !_selectedEmp || e.userId === _selectedEmp).map(e => _renderCard(e)).join('')}
  </div>
</div>
<style>
.emp-chip{flex-shrink:0;background:var(--card-bg);border:1.5px solid var(--border);border-radius:20px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;color:var(--text)}
.emp-chip.active{background:#4F46E5;border-color:#4F46E5;color:#fff}
.ob-card{background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px}
.ob-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
.ob-name{font-size:15px;font-weight:700}
.ob-dept{font-size:12px;color:#64748B;font-weight:400;margin-left:6px}
.ob-date{font-size:12px;color:#94A3B8;margin-top:2px}
.ob-pct{font-size:22px;font-weight:800}
.ob-bar-wrap{height:8px;background:var(--border);border-radius:4px;overflow:hidden;margin-bottom:6px}
.ob-bar{height:100%;border-radius:4px;transition:width .5s}
.ob-tasks{display:flex;flex-direction:column;gap:8px}
.ob-task{display:flex;align-items:center;gap:8px}
.ob-check{background:none;border:2px solid var(--border);border-radius:6px;width:28px;height:28px;font-size:14px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.ob-check.checked{border-color:#10B981}
.ob-task-body{flex:1;min-width:0}
.ob-task-label{font-size:13px}
.ob-task-label.strike{text-decoration:line-through;color:#94A3B8}
.ob-req{font-size:10px;background:#FEE2E2;color:#DC2626;padding:2px 5px;border-radius:4px;margin-left:4px;font-weight:600}
.ob-dday{font-size:11px;font-weight:600;flex-shrink:0}
.ob-dday.over{color:#DC2626}
</style>`;

}

function _renderCard(emp) {
  const done  = emp.tasks.filter(t => t.done).length;
  const total = emp.tasks.length;
  const pct   = Math.round(done / total * 100);
  const pctColor = pct === 100 ? '#10B981' : '#EF4444';
  const dday  = _daysTo(emp.lastDay);
  const undone = emp.tasks.filter(t => !t.done && t.required);

  return `
<div class="ob-card">
  <div class="ob-header">
    <div>
      <div class="ob-name">${emp.name}<span class="ob-dept">${emp.dept}</span></div>
      <div class="ob-date">퇴사일 ${emp.lastDay} <strong style="color:${dday.color}">${dday.label}</strong></div>
      ${emp.reason ? `<div style="font-size:11px;color:#94A3B8;margin-top:2px">사유: ${emp.reason}</div>` : ''}
    </div>
    <div class="ob-pct" style="color:${pctColor}">${pct}%</div>
  </div>
  <div class="ob-bar-wrap">
    <div class="ob-bar" style="width:${pct}%;background:${pctColor}"></div>
  </div>
  <div style="font-size:12px;color:#64748B;margin-bottom:12px">${done} / ${total} 완료</div>
  ${undone.length ? `<div style="background:#FEF2F2;border-radius:8px;padding:8px 10px;margin-bottom:10px;font-size:12px;color:#DC2626;font-weight:600">
    ⚠️ 필수 미완료 ${undone.length}건: ${undone.map(t => t.label).join(', ')}
  </div>` : ''}
  <div class="ob-tasks">
    ${emp.tasks.map(t => {
      const over = !t.done && new Date(emp.lastDay).setDate(new Date(emp.lastDay).getDate() + t.dueDay) < Date.now();
      return `
      <div class="ob-task">
        <button class="ob-check ${t.done ? 'checked' : ''}" data-emp="${emp.userId}" data-task="${t.id}">
          ${t.done ? '✅' : '○'}
        </button>
        <div class="ob-task-body">
          <span class="ob-task-label ${t.done ? 'strike' : ''}">${t.label}</span>
          ${t.required ? '<span class="ob-req">필수</span>' : ''}
        </div>
        <span class="ob-dday ${over ? 'over' : ''}" style="color:${t.done ? '#10B981' : ''}">
          ${t.done ? '완료' : t.dueDay <= 0 ? `퇴사 ${Math.abs(t.dueDay)}일 전` : `퇴사 후 ${t.dueDay}일`}
        </span>
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
    label: `${e.name} (${e.dept || e.department || '부서 미지정'})`,
  }));

  const result = await showFormModal({
    title: '퇴직자 등록',
    fields: [
      { name: 'empId', label: '직원 선택', type: 'select', options: empOptions, required: true },
      { name: 'lastDay', label: '퇴사일', type: 'date', defaultValue: new Date().toISOString().slice(0, 10), required: true },
      { name: 'reason', label: '퇴직 사유 (선택)', placeholder: '개인 사유' },
    ],
    confirmLabel: '오프보딩 시작',
  });
  if (!result) return;

  const emp = available.find(e => e.id === result.empId);
  if (!emp) {
    showToast('선택한 직원을 확인할 수 없습니다.', 'error');
    return;
  }

  list.push({
    userId: emp.id,
    name: emp.name,
    dept: emp.dept || emp.department || '',
    lastDay:    result.lastDay,
    resignDate: new Date().toISOString().slice(0, 10),
    reason:     result.reason || '',
    tasks:      OFFBOARDING_TEMPLATE.map(t => ({ ...t, done: false, doneAt: null })),
  });
  _saveOffboarding(list);
  showToast(`${emp.name} 오프보딩이 시작되었습니다.`, 'success');
  addNotification({ type: 'success', title: 'Offboarding Mgmt (관리자)', body: `${emp.name} 오프보딩이 시작되었습니다.` });
  _renderPage(root);
}

function _handleClick(root, event) {
  const list = _getOffboarding();
  const chip = event.target.closest('.emp-chip');
  if (chip) {
    _selectedEmp = chip.dataset.id || null;
    _renderPage(root);
    return;
  }
  if (event.target.closest('#add-resign-btn, #add-resign-btn-empty')) {
    _openAddModal(root, list);
    return;
  }
  const chk = event.target.closest('.ob-check');
  if (chk) {
    const emp  = list.find(x => x.userId === chk.dataset.emp);
    if (!emp) return;
    const task = emp.tasks.find(t => t.id === chk.dataset.task);
    if (!task) return;
    task.done   = !task.done;
    task.doneAt = task.done ? new Date().toISOString().slice(0, 10) : null;
    _saveOffboarding(list);
    showToast(task.done ? '완료 처리되었습니다.' : '미완료로 변경되었습니다.', 'info');
    _renderPage(root);
  }
}
