/**
 * commute-admin.js — 출퇴근 관리
 */

import { showToast } from '../../components/toast.js'
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_commute_logs';
const TODAY = '2026-06-05';
const LATE_CUTOFF = '09:10';

const LEGACY_IDS = new Set(['CM001','CM002','CM003','CM004','CM005','CM006','CM007','CM008','CM009','CM010','CM011','CM012','CM013','CM014']);

const TYPE_LABEL = { office: '사무실', remote: '재택', field: '외근', business: '출장' };
const TYPE_COLOR = { office: '#4F46E5', remote: '#10B981', field: '#F59E0B', business: '#8B5CF6' };

let _tab = 'today';
let _root = null;

function _load() {
  try {
    const d = JSON.parse(localStorage.getItem(LS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_IDS.has(r.id));
    if (cleaned.length !== list.length) localStorage.setItem(LS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}

function _isLate(checkIn) {
  return checkIn > LATE_CUTOFF;
}

export function render(root) {
  _root = root;
  _tab = 'today';
  _draw();
}

export function unmount() {
  _root = null;
  _tab = 'today';
}

function _draw() {
  if (!_root) return;
  const data = _load();

  const tabs = [
    { key: 'today', label: '오늘 현황' },
    { key: 'stats', label: '근태 통계' },
  ];

  const tabsHtml = tabs.map(t => `
    <div data-tab="${t.key}" style="padding:10px 18px;cursor:pointer;font-size:14px;font-weight:600;
      border-bottom:3px solid ${_tab === t.key ? '#4F46E5' : 'transparent'};
      color:${_tab === t.key ? '#4F46E5' : '#6B7280'};white-space:nowrap;">
      ${t.label}
    </div>`).join('');

  let content = '';

  if (_tab === 'today') {
    const todayLogs = data.filter(r => r.date === TODAY);
    const lateCount    = todayLogs.filter(r => _isLate(r.checkIn)).length;
    const remoteCount  = todayLogs.filter(r => r.type === 'remote').length;
    const fieldCount   = todayLogs.filter(r => r.type === 'field' || r.type === 'business').length;
    const total        = todayLogs.length;

    // Type distribution
    const typeCounts = {};
    todayLogs.forEach(r => { typeCounts[r.type] = (typeCounts[r.type] || 0) + 1; });
    const typeOrder = ['office', 'remote', 'field', 'business'];
    const typeBars = typeOrder.map(tp => {
      const cnt = typeCounts[tp] || 0;
      const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
      return cnt > 0 ? `
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
            <span style="display:flex;align-items:center;gap:6px;">
              <span style="width:10px;height:10px;border-radius:50%;background:${TYPE_COLOR[tp]};display:inline-block;"></span>
              ${TYPE_LABEL[tp]}
            </span>
            <span style="font-weight:600;">${cnt}명 (${pct}%)</span>
          </div>
          <div style="background:#F3F4F6;border-radius:4px;height:10px;overflow:hidden;">
            <div style="background:${TYPE_COLOR[tp]};width:${pct}%;height:100%;border-radius:4px;"></div>
          </div>
        </div>` : '';
    }).join('');

    // Check-in list
    const sorted = [...todayLogs].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    const checkInRows = sorted.map(r => {
      const late = _isLate(r.checkIn);
      return `
        <div style="display:flex;align-items:center;padding:10px 0;border-bottom:1px solid #F3F4F6;gap:10px;">
          <div style="flex:1;min-width:0;">
            <span style="font-weight:600;font-size:14px;">${r.empName}</span>
            <span style="font-size:12px;color:#6B7280;margin-left:6px;">${r.dept}</span>
          </div>
          <span style="background:${TYPE_COLOR[r.type]}22;color:${TYPE_COLOR[r.type]};font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;">
            ${TYPE_LABEL[r.type]}
          </span>
          <span style="font-size:13px;font-weight:600;color:#111827;min-width:42px;text-align:right;">${r.checkIn}</span>
          ${late ? `<span style="background:#FEE2E2;color:#B91C1C;font-size:11px;padding:2px 7px;border-radius:10px;font-weight:600;">지각</span>` : ''}
        </div>`;
    }).join('');

    content = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
        ${_kpi('출근', `${total}명`, '#4F46E5')}
        ${_kpi('지각', `${lateCount}명`, '#EF4444')}
        ${_kpi('재택', `${remoteCount}명`, '#10B981')}
        ${_kpi('외근·출장', `${fieldCount}명`, '#F59E0B')}
      </div>
      <div style="background:#fff;border-radius:12px;padding:16px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <div style="font-size:14px;font-weight:700;margin-bottom:12px;">근무 유형 분포</div>
        ${typeBars || '<div style="font-size:13px;color:#9CA3AF;">데이터 없음</div>'}
      </div>
      <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <div style="font-size:14px;font-weight:700;margin-bottom:4px;">오늘 출근 목록</div>
        <div style="font-size:12px;color:#6B7280;margin-bottom:10px;">${TODAY} 기준 · ${total}명</div>
        ${checkInRows || '<div style="font-size:13px;color:#9CA3AF;padding:20px 0;text-align:center;">출근 기록이 없습니다.</div>'}
      </div>`;
  }

  if (_tab === 'stats') {
    // Get last 7 distinct dates in desc order
    const allDates = [...new Set(data.map(r => r.date))].sort((a, b) => b.localeCompare(a)).slice(0, 7);

    const dayRows = allDates.map(date => {
      const logs = data.filter(r => r.date === date);
      const late = logs.filter(r => _isLate(r.checkIn)).length;
      const avgMins = logs.length > 0 ? Math.round(logs.reduce((s, r) => s + r.workMins, 0) / logs.length) : 0;
      const avgH = Math.floor(avgMins / 60);
      const avgM = avgMins % 60;
      return `
        <div style="background:#fff;border-radius:10px;padding:13px 14px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,0.07);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-weight:700;font-size:14px;">${date}</span>
            <span style="font-size:12px;color:#6B7280;">평균 ${avgH}h ${avgM}m</span>
          </div>
          <div style="display:flex;gap:12px;font-size:13px;">
            <span style="color:#4F46E5;font-weight:600;">출근 ${logs.length}명</span>
            <span style="color:#EF4444;font-weight:600;">지각 ${late}명</span>
          </div>
        </div>`;
    }).join('');

    // Dept breakdown (all data)
    const deptMap = {};
    data.forEach(r => {
      if (!deptMap[r.dept]) deptMap[r.dept] = { total: 0, late: 0 };
      deptMap[r.dept].total++;
      if (_isLate(r.checkIn)) deptMap[r.dept].late++;
    });
    const maxTotal = Math.max(...Object.values(deptMap).map(d => d.total), 1);
    const deptBars = Object.entries(deptMap).sort((a, b) => b[1].total - a[1].total).map(([dept, d]) => `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
          <span>${dept}</span>
          <span style="font-weight:600;color:#374151;">${d.total}건
            ${d.late > 0 ? `<span style="color:#EF4444;font-size:11px;"> / 지각 ${d.late}</span>` : ''}
          </span>
        </div>
        <div style="background:#F3F4F6;border-radius:4px;height:10px;overflow:hidden;">
          <div style="background:#4F46E5;width:${(d.total/maxTotal*100).toFixed(1)}%;height:100%;border-radius:4px;"></div>
        </div>
      </div>`).join('');

    content = `
      <div style="margin-bottom:20px;">
        <div style="font-size:14px;font-weight:700;margin-bottom:10px;">최근 7일 일별 현황</div>
        ${dayRows || '<div style="font-size:13px;color:#9CA3AF;text-align:center;padding:20px 0;">데이터 없음</div>'}
      </div>
      <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <div style="font-size:14px;font-weight:700;margin-bottom:12px;">부서별 출근 현황</div>
        ${deptBars}
      </div>`;
  }

  _root.innerHTML = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;">
      <div style="padding:20px 16px 0;">
        <div style="font-size:20px;font-weight:800;color:#111827;margin-bottom:4px;">출퇴근 관리</div>
        <div style="font-size:13px;color:#6B7280;margin-bottom:16px;">직원 출퇴근 현황 및 근태 통계</div>
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
}

function _kpi(label, value, color) {
  return `
    <div style="background:#fff;border-radius:12px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
      <div style="font-size:12px;color:#6B7280;margin-bottom:6px;">${label}</div>
      <div style="font-size:20px;font-weight:800;color:${color};">${value}</div>
    </div>`;
}
export function mount(root) { return render(root); }
