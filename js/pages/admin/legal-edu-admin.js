/**
 * legal-edu-admin.js — 관리자 법정교육 일정 관리 탭
 */

import { showToast } from '../../components/toast.js';
import { LEGAL_EDU_TYPES, LEGAL_EDU_MAP, EDU_STATUS } from '../../data/legal-edu-types.js';
import { addNotification } from '../../components/notification-hub.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';

const LS_SCHEDULE   = 'hr_legal_edu_schedule';
const LS_ATTENDEES  = 'hr_edu_attendees';

let _employees = [];

function _getSchedule() {
  const saved = JSON.parse(localStorage.getItem(LS_SCHEDULE) || 'null');
  if (saved) return saved;
  const y = new Date().getFullYear();
  const demo = [
    { id:'sexual_harassment', scheduledDate:`${y}-03-15`, completedDate:`${y}-03-15`, completedHours:1, status:'completed', provider:'온라인 e-러닝', attendees:_employees.map(e=>e.name) },
    { id:'safety',            scheduledDate:`${y}-03-20`, completedDate:`${y}-03-20`, completedHours:6, status:'completed', provider:'안전보건공단 위탁', attendees:_employees.map(e=>e.name) },
    { id:'harassment_prevention', scheduledDate:`${y}-09-01`, completedDate:null, completedHours:0, status:'scheduled', provider:null, attendees:[] },
    { id:'privacy',           scheduledDate:`${y}-10-15`, completedDate:null, completedHours:0, status:'scheduled', provider:null, attendees:[] },
  ];
  localStorage.setItem(LS_SCHEDULE, JSON.stringify(demo));
  return demo;
}

export function render(root) {
  _renderPage(root);
}

function _renderPage(root) {

  const schedule = _getSchedule();
  const overdue  = schedule.filter(s => {
    if (s.status === 'completed') return false;
    return new Date(s.scheduledDate) < new Date();
  }).map(s => ({ ...s, status: 'overdue' }));

  
  if (!schedule.length) { root.innerHTML = `<div style="text-align:center;padding:48px 20px;color:#94A3B8"><div style="font-size:40px;margin-bottom:10px">⚖️</div><div style="font-size:14px;font-weight:600;margin-bottom:4px">법정 교육 일정이 없습니다.</div></div>`; return; }
root.innerHTML = `
<div id="legal-edu-admin-wrap">

  ${overdue.length ? `
  <div style="background:#FEF2F2;border:1.5px solid #EF4444;border-radius:12px;padding:14px 16px;margin-bottom:16px">
    <div style="font-size:14px;font-weight:700;color:#DC2626;margin-bottom:8px">⚠️ 미이수 경고</div>
    ${overdue.map(s => `<div style="font-size:13px;margin-bottom:4px">
      ${LEGAL_EDU_MAP[s.id]?.icon} ${LEGAL_EDU_MAP[s.id]?.label} — 예정일 ${s.scheduledDate} 경과
    </div>`).join('')}
  </div>` : ''}

  <!-- 현황 요약 -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
    ${[
      { label:'완료', count: schedule.filter(s=>s.status==='completed').length, color:'#10B981', bg:'#F0FDF4' },
      { label:'예정', count: schedule.filter(s=>s.status==='scheduled').length, color:'#3B82F6', bg:'#EFF6FF' },
      { label:'미이수', count: overdue.length, color:'#EF4444', bg:'#FEF2F2' },
    ].map(c => `<div style="background:${c.bg};border-radius:12px;padding:14px;text-align:center">
      <div style="font-size:24px;font-weight:800;color:${c.color}">${c.count}</div>
      <div style="font-size:11px;color:#64748B">${c.label}</div>
    </div>`).join('')}
  </div>

  <!-- 교육별 목록 -->
  <div id="edu-admin-list">
    ${schedule.map(s => _renderAdminCard(s, overdue.some(o=>o.id===s.id))).join('')}
  </div>

  <!-- 새 일정 추가 버튼 -->
  <button id="add-schedule-btn" style="width:100%;background:var(--card-bg);border:2px dashed var(--border);border-radius:12px;padding:14px;font-size:14px;font-weight:600;color:var(--text-secondary);cursor:pointer;margin-top:8px">
    + 교육 일정 추가
  </button>
</div>`;

  _bindEvents(root, schedule);
}

function _renderAdminCard(s, isOverdue) {
  const type   = LEGAL_EDU_MAP[s.id];
  const status = isOverdue ? EDU_STATUS.overdue : EDU_STATUS[s.status] || EDU_STATUS.scheduled;
  const isDone = s.status === 'completed' && !isOverdue;

  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="width:38px;height:38px;border-radius:10px;background:${type.color}20;color:${type.color};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${type.icon}</span>
      <div>
        <div style="font-size:14px;font-weight:700">${type.label}</div>
        <div style="font-size:11px;color:#94A3B8">${type.legalBasis}</div>
      </div>
    </div>
    <span style="font-size:12px;padding:4px 10px;border-radius:20px;font-weight:600;color:${status.color};background:${status.bg}">
      ${status.icon} ${status.label}
    </span>
  </div>
  <div style="font-size:12px;color:#64748B;display:flex;flex-direction:column;gap:4px;margin-bottom:12px">
    <div>예정일: <strong>${s.scheduledDate}</strong></div>
    ${isDone ? `<div>이수일: ${s.completedDate} · ${s.completedHours}시간 · ${s.provider||''}</div>
    <div>이수자: ${(s.attendees||[]).length}명</div>` : ''}
    <div>의무시간: ${type.minHours}시간 이상 · ${type.frequencyMonths}개월 주기</div>
  </div>
  ${!isDone ? `
  <div style="display:flex;gap:8px">
    <button class="btn-mark-done" data-id="${s.id}"
      style="flex:1;background:#D1FAE5;color:#059669;border:none;border-radius:10px;padding:9px;font-size:13px;font-weight:600;cursor:pointer">
      ✅ 이수 완료 처리
    </button>
    <button class="btn-send-remind" data-id="${s.id}"
      style="background:#EEF2FF;color:#4338CA;border:none;border-radius:10px;padding:9px 14px;font-size:13px;font-weight:600;cursor:pointer">
      📨 알림
    </button>
  </div>` : ''}
</div>`;
}

function _bindEvents(root, schedule) {
  root.addEventListener('click', e => {
    const doneBtn   = e.target.closest('.btn-mark-done');
    const remindBtn = e.target.closest('.btn-send-remind');

    if (doneBtn) {
      const id   = doneBtn.dataset.id;
      const today = new Date().toISOString().slice(0, 10);
      const saved = JSON.parse(localStorage.getItem(LS_SCHEDULE) || '[]');
      const idx   = saved.findIndex(s => s.id === id);
      if (idx >= 0) {
        saved[idx] = {
          ...saved[idx],
          status:         'completed',
          completedDate:  today,
          completedHours: LEGAL_EDU_MAP[id]?.minHours || 1,
          provider:       '자체 실시',
          attendees:      _employees.map(e=>e.name),
        };
        localStorage.setItem(LS_SCHEDULE, JSON.stringify(saved));
        showToast('이수 완료 처리되었습니다. ✅', 'success')
      addNotification({ type: 'success', title: 'Legal Edu (관리자)', body: '이수 완료 처리되었습니다. ✅' });
        _renderPage(root);
      }
    }

    if (remindBtn) {
      const id   = remindBtn.dataset.id;
      const type = LEGAL_EDU_MAP[id];
      showToast(`"${type?.label}" 교육 알림이 전 직원에게 발송되었습니다. 📨`, 'success')
      addNotification({ type: 'success', title: 'Legal Edu (관리자)', body: '"" 교육 알림이 전 직원에게 발송되었습니다. 📨' });
    }

    if (e.target.id === 'add-schedule-btn') {
      showToast('이미 4종 법정교육이 등록되어 있습니다.', 'info');
    }
  });
}

export function unmount() {}
export async function mount(root) {
  _employees = await loadDisplayEmployees();
  return render(root);
}
