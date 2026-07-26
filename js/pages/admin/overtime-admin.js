/**
 * overtime-admin.js — 초과근무 승인 관리
 */

import { showToast } from '../../components/toast.js';
import { addNotificationForUser } from '../../components/notification-hub.js';

const LS = 'hr_overtime_requests';

const LEGACY_IDS = new Set(['OT001','OT002','OT003','OT004','OT005','OT006','OT007']);

const TYPE_LABEL = { extension: '연장근무', night: '야간근무', holiday: '휴일근무' };
const TYPE_COLOR = { extension: '#4F46E5', night: '#8B5CF6', holiday: '#F59E0B' };
const STATUS_COLOR = { pending: '#F59E0B', approved: '#10B981', rejected: '#EF4444' };
const STATUS_LABEL = { pending: '대기', approved: '승인', rejected: '반려' };

let _tab = 'overview';
let _root = null;

function _load() {
  try {
    const d = JSON.parse(localStorage.getItem(LS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_IDS.has(r.id));
    if (cleaned.length !== list.length) _save(cleaned);
    return cleaned;
  } catch { return []; }
}

function _save(data) {
  localStorage.setItem(LS, JSON.stringify(data));
}

export function render(root) {
  _root = root;
  _tab = 'overview';
  _draw();
}

export function unmount() {
  _root = null;
  _tab = 'overview';
}

function _draw() {
  if (!_root) return;
  const data = _load();
  const pending = data.filter(r => r.status === 'pending');
  const thisMonth = data.filter(r => r.date && r.date.startsWith('2026-06'));
  const approved = data.filter(r => r.status === 'approved');
  const totalPremium = data.reduce((s, r) => s + (r.premium || 0), 0);

  const tabs = [
    { key: 'overview', label: '개요' },
    { key: 'pending',  label: `승인 대기 (${pending.length})` },
    { key: 'all',      label: '전체 내역' },
  ];

  const tabsHtml = tabs.map(t => `
    <div data-tab="${t.key}" style="padding:10px 18px;cursor:pointer;font-size:14px;font-weight:600;
      border-bottom:3px solid ${_tab === t.key ? '#4F46E5' : 'transparent'};
      color:${_tab === t.key ? '#4F46E5' : '#6B7280'};white-space:nowrap;">
      ${t.label}
    </div>`).join('');

  let content = '';

  if (_tab === 'overview') {
    const typeCount = { extension: 0, night: 0, holiday: 0 };
    const typeHours = { extension: 0, night: 0, holiday: 0 };
    const deptHours = {};
    data.forEach(r => {
      typeCount[r.type] = (typeCount[r.type] || 0) + 1;
      typeHours[r.type] = (typeHours[r.type] || 0) + r.hours;
      deptHours[r.dept] = (deptHours[r.dept] || 0) + r.hours;
    });
    const maxType = Math.max(...Object.values(typeHours), 1);
    const maxDept = Math.max(...Object.values(deptHours), 1);

    const typeRows = Object.entries(typeHours).map(([t, h]) => `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
          <span>${TYPE_LABEL[t]}</span><span style="font-weight:600;">${h}h</span>
        </div>
        <div style="background:#F3F4F6;border-radius:4px;height:10px;overflow:hidden;">
          <div style="background:${TYPE_COLOR[t]};width:${(h/maxType*100).toFixed(1)}%;height:100%;border-radius:4px;"></div>
        </div>
      </div>`).join('');

    const deptRows = Object.entries(deptHours).map(([d, h]) => `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
          <span>${d}</span><span style="font-weight:600;">${h}h</span>
        </div>
        <div style="background:#F3F4F6;border-radius:4px;height:10px;overflow:hidden;">
          <div style="background:#4F46E5;width:${(h/maxDept*100).toFixed(1)}%;height:100%;border-radius:4px;"></div>
        </div>
      </div>`).join('');

    content = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
        ${_kpi('대기 중', `${pending.length}건`, '#F59E0B')}
        ${_kpi('이번 달', `${thisMonth.length}건`, '#4F46E5')}
        ${_kpi('승인', `${approved.length}건`, '#10B981')}
        ${_kpi('총 가산 금액', `${totalPremium.toLocaleString()}원`, '#8B5CF6')}
      </div>
      <div style="background:#fff;border-radius:12px;padding:16px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <div style="font-size:14px;font-weight:700;margin-bottom:12px;">근무 유형별</div>
        ${typeRows}
      </div>
      <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <div style="font-size:14px;font-weight:700;margin-bottom:12px;">부서별 초과근무 시간</div>
        ${deptRows}
      </div>`;
  }

  if (_tab === 'pending') {
    if (pending.length === 0) {
      content = `
        <div style="text-align:center;padding:60px 20px;color:#9CA3AF;">
          <div style="font-size:40px;margin-bottom:12px;">✅</div>
          <div style="font-size:16px;font-weight:600;margin-bottom:6px;">승인 대기 건이 없습니다</div>
          <div style="font-size:13px;">모든 초과근무 요청이 처리되었습니다.</div>
        </div>`;
    } else {
      content = pending.map(r => `
        <div data-id="${r.id}" style="background:#fff;border-radius:12px;padding:16px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <div>
              <span style="font-weight:700;font-size:15px;">${r.empName}</span>
              <span style="font-size:12px;color:#6B7280;margin-left:6px;">${r.dept}</span>
            </div>
            <span style="background:#FEF3C7;color:#92400E;font-size:11px;padding:3px 8px;border-radius:20px;font-weight:600;">대기</span>
          </div>
          <div style="font-size:13px;color:#374151;margin-bottom:4px;">
            <span style="background:#EEF2FF;color:#4338CA;padding:2px 8px;border-radius:10px;font-size:12px;margin-right:6px;">${TYPE_LABEL[r.type]}</span>
            ${r.date} · ${r.hours}시간
          </div>
          <div style="font-size:13px;color:#6B7280;margin-bottom:12px;">사유: ${r.reason}</div>
          <div style="font-size:13px;color:#8B5CF6;margin-bottom:12px;font-weight:600;">가산수당: ${(r.premium||0).toLocaleString()}원</div>
          <div style="display:flex;gap:8px;">
            <button data-action="approve" data-id="${r.id}" style="flex:1;padding:9px;background:#10B981;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">승인</button>
            <button data-action="reject"  data-id="${r.id}" style="flex:1;padding:9px;background:#EF4444;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">반려</button>
          </div>
        </div>`).join('');
    }
  }

  if (_tab === 'all') {
    const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));
    content = sorted.map(r => `
      <div style="background:#fff;border-radius:10px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:10px;box-shadow:0 1px 3px rgba(0,0,0,0.07);">
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:600;">${r.empName} <span style="font-size:12px;color:#6B7280;">${r.dept}</span></div>
          <div style="font-size:12px;color:#6B7280;margin-top:2px;">${TYPE_LABEL[r.type]} · ${r.date} · ${r.hours}h · ${(r.premium||0).toLocaleString()}원</div>
        </div>
        <span style="background:${STATUS_COLOR[r.status]}22;color:${STATUS_COLOR[r.status]};font-size:11px;padding:3px 8px;border-radius:20px;font-weight:600;white-space:nowrap;">${STATUS_LABEL[r.status]}</span>
      </div>`).join('');
  }

  _root.innerHTML = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;">
      <div style="padding:20px 16px 0;">
        <div style="font-size:20px;font-weight:800;color:#111827;margin-bottom:4px;">초과근무 관리</div>
        <div style="font-size:13px;color:#6B7280;margin-bottom:16px;">초과근무 신청 현황 및 승인 처리</div>
      </div>
      <div style="display:flex;overflow-x:auto;border-bottom:1px solid #E5E7EB;padding:0 16px;gap:4px;background:#fff;">
        ${tabsHtml}
      </div>
      <div style="padding:16px;">
        ${content}
      </div>
    </div>`;

  _root.querySelectorAll('[data-tab]').forEach(el => {
    el.addEventListener('click', () => { _tab = el.dataset.tab; _draw(); });
  });

  _root.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const data2 = _load();
      const rec = data2.find(r => r.id === id);
      if (!rec) return;
      rec.status = action === 'approve' ? 'approved' : 'rejected';
      _save(data2);
      showToast(action === 'approve' ? '✅ 승인 처리되었습니다.' : '❌ 반려 처리되었습니다.');
      addNotification({ type: 'success', title: '초과근무 관리', body: action === 'approve' ? '승인 처리되었습니다.' : '반려 처리되었습니다.' });
      if (rec?.empId) addNotificationForUser(rec.empId, { type: action === 'approve' ? 'success' : 'error', title: action === 'approve' ? '초과근무 승인' : '초과근무 반려', body: action === 'approve' ? '초과근무 신청이 승인되었습니다.' : '초과근무 신청이 반려되었습니다.', route: '#/work-report' });
      _draw();
    });
  });
}

function _kpi(label, value, color) {
  return `
    <div style="background:#fff;border-radius:12px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
      <div style="font-size:12px;color:#6B7280;margin-bottom:6px;">${label}</div>
      <div style="font-size:20px;font-weight:800;color:${color};">${value}</div>
    </div>`;
}
export function mount(root) { return render(root); }
