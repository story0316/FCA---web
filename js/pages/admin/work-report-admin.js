/**
 * work-report-admin.js — 주간 업무보고 관리
 */

import { showToast } from '../../components/toast.js'
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_work_reports';
const TOTAL_EMPLOYEES = 12;

const LEGACY_IDS = new Set(['WR001','WR002','WR003','WR004','WR005','WR006','WR007']);

let _tab = 'weekly';
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

export function render(root) {
  _root = root;
  _tab = 'weekly';
  _draw();
}

export function unmount() {
  _root = null;
  _tab = 'weekly';
}

function _draw() {
  if (!_root) return;
  const data = _load();

  const tabs = [
    { key: 'weekly', label: '주간 현황' },
    { key: 'list',   label: '보고서 목록' },
  ];

  const tabsHtml = tabs.map(t => `
    <div data-tab="${t.key}" style="padding:10px 18px;cursor:pointer;font-size:14px;font-weight:600;
      border-bottom:3px solid ${_tab === t.key ? '#4F46E5' : 'transparent'};
      color:${_tab === t.key ? '#4F46E5' : '#6B7280'};white-space:nowrap;">
      ${t.label}
    </div>`).join('');

  let content = '';

  if (_tab === 'weekly') {
    const currentWeek = '2026-W23';
    const thisWeekReports = data.filter(r => r.week === currentWeek);
    const submittedNames = thisWeekReports.map(r => r.empName);
    const submittedCount = thisWeekReports.length;
    const pct = Math.round((submittedCount / TOTAL_EMPLOYEES) * 100);

    // Dept breakdown for this week
    const deptMap = {};
    thisWeekReports.forEach(r => {
      deptMap[r.dept] = (deptMap[r.dept] || 0) + 1;
    });

    const allDepts = ['개발', '인사', '마케팅', '영업', '디자인', '재무'];
    const deptRows = allDepts.map(dept => {
      const cnt = deptMap[dept] || 0;
      const barW = cnt > 0 ? Math.min(100, cnt * 25) : 0;
      return `
        <tr>
          <td style="padding:8px 10px;font-size:13px;color:#374151;">${dept}</td>
          <td style="padding:8px 10px;font-size:13px;text-align:center;font-weight:600;">${cnt}명</td>
          <td style="padding:8px 10px;min-width:100px;">
            <div style="background:#F3F4F6;border-radius:4px;height:8px;overflow:hidden;">
              <div style="background:#4F46E5;width:${barW}%;height:100%;border-radius:4px;"></div>
            </div>
          </td>
        </tr>`;
    }).join('');

    const submittedBadges = submittedNames.map(n =>
      `<span style="background:#D1FAE5;color:#065F46;font-size:12px;padding:3px 10px;border-radius:20px;font-weight:600;">${n}</span>`
    ).join(' ');

    // Estimate not-submitted (total - submitted unique users this week)
    const notSubmittedCount = TOTAL_EMPLOYEES - submittedCount;
    const notSubmittedBadges = notSubmittedCount > 0
      ? Array.from({ length: notSubmittedCount }, (_, i) =>
          `<span style="background:#FEE2E2;color:#991B1B;font-size:12px;padding:3px 10px;border-radius:20px;font-weight:600;">미제출</span>`
        ).join(' ')
      : '';

    content = `
      <div style="background:#fff;border-radius:12px;padding:16px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <div style="font-size:14px;font-weight:700;margin-bottom:4px;">이번 주(W23) 제출 현황</div>
        <div style="font-size:26px;font-weight:800;color:#4F46E5;margin-bottom:8px;">${submittedCount} / ${TOTAL_EMPLOYEES}명</div>
        <div style="background:#F3F4F6;border-radius:8px;height:14px;overflow:hidden;margin-bottom:6px;">
          <div style="background:linear-gradient(90deg,#4F46E5,#818CF8);width:${pct}%;height:100%;border-radius:8px;transition:width .4s;"></div>
        </div>
        <div style="font-size:12px;color:#6B7280;text-align:right;">완료율 ${pct}%</div>
      </div>

      <div style="background:#fff;border-radius:12px;padding:16px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <div style="font-size:14px;font-weight:700;margin-bottom:10px;">부서별 제출 현황</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid #E5E7EB;">
              <th style="padding:6px 10px;font-size:12px;color:#9CA3AF;text-align:left;">부서</th>
              <th style="padding:6px 10px;font-size:12px;color:#9CA3AF;text-align:center;">제출</th>
              <th style="padding:6px 10px;font-size:12px;color:#9CA3AF;text-align:left;">현황</th>
            </tr>
          </thead>
          <tbody>${deptRows}</tbody>
        </table>
      </div>

      <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <div style="font-size:14px;font-weight:700;margin-bottom:10px;">제출 완료 (${submittedCount}명)</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:${notSubmittedCount > 0 ? '16px' : '0'};">
          ${submittedBadges || '<span style="color:#9CA3AF;font-size:13px;">없음</span>'}
        </div>
        ${notSubmittedCount > 0 ? `
          <div style="font-size:14px;font-weight:700;margin-bottom:10px;color:#EF4444;">미제출 (${notSubmittedCount}명)</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">${notSubmittedBadges}</div>
        ` : ''}
      </div>`;
  }

  if (_tab === 'list') {
    const sorted = [...data].sort((a, b) => {
      if (b.week !== a.week) return b.week.localeCompare(a.week);
      return b.submittedAt.localeCompare(a.submittedAt);
    });

    if (sorted.length === 0) {
      content = `
        <div style="text-align:center;padding:60px 20px;color:#9CA3AF;">
          <div style="font-size:40px;margin-bottom:12px;">📋</div>
          <div style="font-size:16px;font-weight:600;margin-bottom:6px;">보고서가 없습니다</div>
          <div style="font-size:13px;">제출된 주간 업무보고가 없습니다.</div>
        </div>`;
    } else {
      content = sorted.map(r => {
        const taskDone = r.tasks.filter(t => t.status === 'done').length;
        return `
          <div style="background:#fff;border-radius:10px;padding:13px 14px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,0.07);">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div>
                <span style="font-weight:700;font-size:14px;">${r.empName}</span>
                <span style="font-size:12px;color:#6B7280;margin-left:6px;">${r.dept}</span>
              </div>
              <span style="font-size:12px;color:#6B7280;">${r.submittedAt}</span>
            </div>
            <div style="margin-top:5px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <span style="background:#EEF2FF;color:#4338CA;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;">${r.week}</span>
              <span style="font-size:12px;color:#6B7280;">완료 ${taskDone}/${r.tasks.length}건</span>
              <span style="font-size:12px;color:#9CA3AF;font-style:italic;">다음 주: ${r.nextWeekPlans}</span>
            </div>
          </div>`;
      }).join('');
    }
  }

  _root.innerHTML = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;">
      <div style="padding:20px 16px 0;">
        <div style="font-size:20px;font-weight:800;color:#111827;margin-bottom:4px;">주간 업무보고</div>
        <div style="font-size:13px;color:#6B7280;margin-bottom:16px;">팀원 업무보고 제출 현황 및 내용 확인</div>
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
export function mount(root) { return render(root); }
