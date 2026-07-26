/**
 * executive.js – 경영진 인재 현황 대시보드
 * P0: 조직 건강 스코어 / 이탈 위험 / 역량 준비도 / 승계 계획
 */

import { getUser, isAdmin } from '../auth.js';
import { showToast }        from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
import { api }              from '../api.js';
import { KEY_ROLES, loadDisplayEmployees } from '../data/demo_employees.js';
import { getRankedRisks, getOrgHealthSummary, RISK_COLOR, RISK_LABEL } from '../utils/retention.js';

let _root = null;

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function _loadEmployees() {
  try {
    const user = getUser();
    const orgId = user?.org_id;
    const users = await api.organization.listUsersRiskProfiles(orgId);
    if (Array.isArray(users) && users.length) return users;
  } catch {}
  return loadDisplayEmployees();
}

async function _loadOrgGoals(orgId) {
  try {
    const goals = await api.performance.getOrgGoals(orgId);
    return Array.isArray(goals) ? goals : null;
  } catch {
    return null;
  }
}

async function _loadOrgInstances(orgId) {
  try {
    const res = await api.assessment.listByOrg(orgId);
    return res?.instances || [];
  } catch {
    return [];
  }
}

async function _loadOrgReviews(orgId) {
  try {
    const reviews = await api.performance?.getOrgReviews?.(orgId);
    return Array.isArray(reviews) ? reviews : [];
  } catch {
    return [];
  }
}

export async function mount(container) {
  _root = container;
  if (!isAdmin()) {
    container.innerHTML = `
      <div class="empty-state" style="min-height:100vh">
        <div class="empty-state-icon">🔒</div>
        <div class="empty-state-title">접근 권한이 없습니다</div>
        <button class="btn btn-primary" onclick="window.navBack()">돌아가기</button>
      </div>`;
    return;
  }
  const user = getUser();
  const orgId = user?.org_id;
  const [employees, orgGoals, orgInstances, orgReviews] = await Promise.all([
    _loadEmployees(),
    _loadOrgGoals(orgId),
    _loadOrgInstances(orgId),
    _loadOrgReviews(orgId),
  ]);
  render(container, employees, orgGoals, orgInstances, orgReviews);
}

export function unmount() { _root = null; }

function render(root, employees = [], orgGoals = null, orgInstances = [], orgReviews = []) {
  const ranked  = getRankedRisks(employees);
  const summary = getOrgHealthSummary(employees);
  const highRisk = ranked.filter(r => r.risk.level === 'HIGH');
  const atRisk   = ranked.filter(r => r.risk.level !== 'LOW');

  const healthColor = summary.orgHealth >= 80 ? 'var(--success)'
                    : summary.orgHealth >= 60 ? 'var(--warning)' : 'var(--danger)';

  root.innerHTML = `
    <div class="page" style="background:var(--bg)">
      <div class="top-bar">
        <button class="btn btn-ghost btn-sm" onclick="window.navBack()" style="padding:8px">←</button>
        <div class="top-bar-title">경영진 인재 현황</div>
        <button class="btn btn-outline btn-sm" id="exec-print-btn" style="font-size:0.72rem">🖨️ 보고서</button>
      </div>

      <div class="page-content" id="exec-printable" style="padding-bottom:80px">

        <!-- KPI 카드 6종 -->
        ${(function() {
          // 역량진단 완료율 — 실 API 데이터 우선, 없으면 localStorage fallback
          let diagRate = 0;
          const DONE_INST = new Set(['completed','calibrated','approved','finalized']);
          if (orgInstances.length > 0) {
            const doneUsers = new Set(
              orgInstances.filter(i => DONE_INST.has(i.status)).map(i => i.assessee_id).filter(Boolean)
            ).size;
            diagRate = employees.length > 0 ? Math.round(doneUsers / employees.length * 100) : 0;
          } else {
            try {
              const sessions = JSON.parse(localStorage.getItem('hr_comp_sessions') || '[]');
              const uniqueUsers = new Set(sessions.map(s => s.userId).filter(Boolean)).size;
              diagRate = employees.length > 0 ? Math.round(uniqueUsers / employees.length * 100) : 0;
            } catch {}
          }

          // 성과리뷰 완료율 — 실 API 데이터 우선, 없으면 localStorage fallback
          let reviewRate = 0;
          if (orgReviews.length > 0) {
            const reviewUsers = new Set(
              orgReviews.filter(r => r.status === 'COMPLETED').map(r => r.userId || r.reviewee_id).filter(Boolean)
            ).size;
            reviewRate = employees.length > 0 ? Math.round(reviewUsers / employees.length * 100) : 0;
          } else {
            try {
              const reviews = JSON.parse(localStorage.getItem('hr_perf_reviews') || '[]');
              const reviewUsers = new Set(reviews.filter(r => r.status === 'COMPLETED').map(r => r.userId).filter(Boolean)).size;
              reviewRate = employees.length > 0 ? Math.round(reviewUsers / employees.length * 100) : 0;
            } catch {}
          }

          const activeInst = orgInstances.filter(i => !DONE_INST.has(i.status) && i.status !== 'cancelled').length;
          const diagSrc = orgInstances.length > 0 ? 'API 기준' : `${employees.length}명 기준`;
          const reviewSrc = orgReviews.length > 0 ? 'API 기준' : '완료 상태 기준';

          return `
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
            ${kpiCard('조직 건강', summary.orgHealth + '/100', healthColor, '위험 신호 기반')}
            ${kpiCard('이탈 고위험', highRisk.length + '명', highRisk.length > 0 ? 'var(--danger)' : 'var(--success)', atRisk.length + '명 주의')}
            ${kpiCard('평균 eNPS', summary.avgEnps + '점', summary.avgEnps >= 7 ? 'var(--success)' : summary.avgEnps >= 5 ? 'var(--warning)' : 'var(--danger)', '최근 분기 기준')}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:${orgInstances.length > 0 ? '8' : '20'}px">
            ${kpiCard('L3 역량 비율', summary.l3Rate + '%', summary.l3Rate >= 30 ? 'var(--success)' : 'var(--warning)', '목표: 30%+')}
            ${kpiCard('역량진단 완료', diagRate + '%', diagRate >= 70 ? 'var(--success)' : diagRate >= 40 ? 'var(--warning)' : 'var(--text-muted)', diagSrc)}
            ${kpiCard('성과리뷰 완료', reviewRate + '%', reviewRate >= 80 ? 'var(--success)' : reviewRate >= 50 ? 'var(--warning)' : 'var(--text-muted)', reviewSrc)}
          </div>
          ${orgInstances.length > 0 ? `
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:20px">
            ${kpiCard('전체 평가', orgInstances.length + '건', 'var(--primary)', '전체 인스턴스')}
            ${kpiCard('진행 중', activeInst + '건', activeInst > 0 ? 'var(--warning)' : 'var(--text-muted)', '미완료 평가')}
            ${kpiCard('평가 완료', orgInstances.filter(i => DONE_INST.has(i.status)).length + '건', 'var(--success)', '완료된 인스턴스')}
          </div>` : ''}`;
        })()}

        <!-- 이탈 위험 인원 -->
        <div class="card" style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div style="font-weight:700;font-size:0.9rem">⚠️ 이탈 위험 인원</div>
            <span style="font-size:0.72rem;color:var(--text-muted)">${atRisk.length}명 / 전체 ${employees.length}명</span>
          </div>
          ${atRisk.length === 0
            ? `<div style="text-align:center;color:var(--success);padding:16px;font-size:0.85rem">✅ 현재 이탈 위험 인원이 없습니다</div>`
            : atRisk.map(({ emp, risk }) => riskRow(emp, risk)).join('')}
        </div>

        <!-- 역량 레벨 분포 -->
        <div class="card" style="margin-bottom:16px">
          <div style="font-weight:700;font-size:0.9rem;margin-bottom:14px">📊 역량 레벨 분포</div>
          ${levelDistribution(employees)}
        </div>

        <!-- eNPS 추세 -->
        <div class="card" style="margin-bottom:16px">
          <div style="font-weight:700;font-size:0.9rem;margin-bottom:14px">📈 eNPS 구성원 분포</div>
          ${enpsBreakdown(employees)}
        </div>

        <!-- 승계 계획 -->
        <div class="card" style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div style="font-weight:700;font-size:0.9rem">🏆 핵심 포지션 승계 계획</div>
          </div>
          ${KEY_ROLES.map(role => successionRow(role, employees)).join('')}
        </div>

        <!-- OKR 조직 현황 -->
        ${orgOkrSection(orgGoals)}

        <!-- 전사 역량 성장 트렌드 -->
        ${orgGrowthTrend()}

        <!-- 역량별 평균 점수 -->
        <div class="card" style="margin-bottom:16px">
          <div style="font-weight:700;font-size:0.9rem;margin-bottom:14px">🔬 구성원 역량 현황</div>
          ${employeeTable(ranked)}
        </div>

      </div>
    </div>`;

  _root.querySelector('#exec-print-btn').addEventListener('click', printReport);

  _root.querySelectorAll('.exec-1on1-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.appState = window.appState || {};
      window.appState.managerViewEmployee = btn.dataset.name;
      window.location.hash = '#/reviews';
    });
  });
}

function kpiCard(label, value, color, sub) {
  return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);
                padding:14px;text-align:center">
      <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px">${label}</div>
      <div style="font-size:1.6rem;font-weight:800;color:${color};line-height:1.1">${value}</div>
      <div style="font-size:0.65rem;color:var(--text-xlight);margin-top:4px">${sub}</div>
    </div>`;
}

function riskRow(emp, risk) {
  return `
    <div style="border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;margin-bottom:8px;
                border-left:3px solid ${RISK_COLOR[risk.level]}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div>
          <span style="font-size:0.88rem;font-weight:700">${emp.avatar} ${esc(emp.name)}</span>
          <span style="font-size:0.72rem;color:var(--text-muted);margin-left:6px">${esc(emp.role)} · ${emp.level}</span>
        </div>
        <span style="font-size:0.72rem;font-weight:700;color:${RISK_COLOR[risk.level]};
                     background:${RISK_COLOR[risk.level]}18;padding:2px 8px;border-radius:99px">
          ${RISK_LABEL[risk.level]} ${risk.score}점
        </span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">
        ${risk.signals.map(s => `<span style="font-size:0.68rem;background:var(--bg);
          border:1px solid var(--border);padding:2px 7px;border-radius:99px;color:var(--text-muted)">${s}</span>`).join('')}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${risk.actions.map(a => `
          <button class="action-btn btn btn-ghost btn-sm"
            data-emp="${emp.id}" data-name="${esc(emp.name)}" data-action="${esc(a)}"
            style="font-size:0.7rem;padding:3px 10px;color:var(--primary);border-color:var(--primary)20">
            ${a}
          </button>`).join('')}
        <button class="exec-1on1-btn btn btn-ghost btn-sm"
          data-name="${esc(emp.name)}"
          style="font-size:0.7rem;padding:3px 10px;color:var(--primary);border-color:var(--primary)20">
          💬 1:1 기록
        </button>
      </div>
    </div>`;
}

function levelDistribution(employees = []) {
  const levels = ['L1', 'L2', 'L3'];
  const total  = employees.length;
  return levels.map(lv => {
    const count = employees.filter(e => (e.level || e.level_code) === lv).length;
    const pct   = Math.round((count / total) * 100);
    const color = lv === 'L3' ? 'var(--success)' : lv === 'L2' ? 'var(--primary)' : 'var(--text-muted)';
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="width:28px;font-size:0.78rem;font-weight:700;color:${color}">${lv}</div>
        <div style="flex:1;height:10px;background:var(--border);border-radius:5px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:5px;transition:width 0.6s ease"></div>
        </div>
        <div style="font-size:0.78rem;color:var(--text-muted);min-width:60px;text-align:right">${count}명 (${pct}%)</div>
      </div>`;
  }).join('');
}

function enpsBreakdown(employees = []) {
  const promoters  = employees.filter(e => (e.enpsHistory || []).slice(-1)[0] >= 8).length;
  const passives   = employees.filter(e => { const v = (e.enpsHistory || []).slice(-1)[0]; return v >= 6 && v < 8; }).length;
  const detractors = employees.filter(e => (e.enpsHistory || []).slice(-1)[0] < 6).length;
  const total = employees.length;

  const rows = [
    { label: '추천자 (8-10점)', count: promoters,  color: 'var(--success)' },
    { label: '중립자 (6-7점)', count: passives,    color: 'var(--warning)' },
    { label: '비추천자 (0-5점)', count: detractors, color: 'var(--danger)' },
  ];
  return rows.map(r => {
    const pct = Math.round((r.count / total) * 100);
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="width:90px;font-size:0.72rem;color:var(--text-muted)">${r.label}</div>
        <div style="flex:1;height:10px;background:var(--border);border-radius:5px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${r.color};border-radius:5px"></div>
        </div>
        <div style="font-size:0.78rem;font-weight:600;color:${r.color};min-width:40px;text-align:right">${r.count}명</div>
      </div>`;
  }).join('') + `
    <div style="font-size:0.72rem;color:var(--text-muted);text-align:right;margin-top:4px">
      eNPS = ${Math.round(((promoters - detractors) / total) * 100)}
      <span style="margin-left:4px;font-size:0.65rem">(추천자% − 비추천자%)</span>
    </div>`;
}

function successionRow(role, employees = []) {
  const critColor = role.criticality === 'HIGH' ? 'var(--danger)' : 'var(--warning)';
  const hasCandidates = role.candidates.length > 0;
  return `
    <div style="border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div>
          <span style="font-weight:700;font-size:0.88rem">${esc(role.title)}</span>
          <span style="font-size:0.72rem;color:var(--text-muted);margin-left:6px">${esc(role.dept)}</span>
        </div>
        <span style="font-size:0.7rem;font-weight:700;color:${critColor};
                     background:${critColor}15;padding:2px 8px;border-radius:99px">
          ${role.criticality === 'HIGH' ? '🔴 핵심' : '🟡 중요'}
        </span>
      </div>
      ${hasCandidates
        ? role.candidates.map(c => {
            const emp = employees.find(e => e.id === c.empId);
            if (!emp) return '';
            const barColor = c.readiness >= 80 ? 'var(--success)' : c.readiness >= 60 ? 'var(--warning)' : 'var(--danger)';
            return `
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <span style="font-size:0.78rem;min-width:64px">${emp.avatar} ${esc(emp.name)}</span>
                <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden">
                  <div style="height:100%;width:${c.readiness}%;background:${barColor};border-radius:3px"></div>
                </div>
                <span style="font-size:0.7rem;color:var(--text-muted);min-width:70px;text-align:right">${esc(c.readinessLabel)}</span>
              </div>`;
          }).join('')
        : `<div style="font-size:0.78rem;color:var(--danger);padding:4px 0">⚠️ 내부 후보 없음 — 외부 채용 또는 육성 계획 필요</div>`}
    </div>`;
}

function employeeTable(ranked) {
  return `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
        <thead>
          <tr style="border-bottom:2px solid var(--border)">
            <th style="text-align:left;padding:6px 8px;color:var(--text-muted);font-weight:600">구성원</th>
            <th style="text-align:center;padding:6px 4px;color:var(--text-muted);font-weight:600">레벨</th>
            <th style="text-align:center;padding:6px 4px;color:var(--text-muted);font-weight:600">역량점수</th>
            <th style="text-align:center;padding:6px 4px;color:var(--text-muted);font-weight:600">eNPS</th>
            <th style="text-align:center;padding:6px 4px;color:var(--text-muted);font-weight:600">위험</th>
          </tr>
        </thead>
        <tbody>
          ${ranked.map(({ emp, risk }) => `
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:8px 8px">
                <span style="font-weight:600">${emp.avatar} ${esc(emp.name)}</span>
                <div style="font-size:0.68rem;color:var(--text-muted)">${esc(emp.role)}</div>
              </td>
              <td style="text-align:center;padding:8px 4px;font-weight:700;
                         color:${emp.level === 'L3' ? 'var(--success)' : emp.level === 'L2' ? 'var(--primary)' : 'var(--text-muted)'}">
                ${emp.level}
              </td>
              <td style="text-align:center;padding:8px 4px;font-weight:600">
                ${emp.competencyScore.toFixed(1)}
              </td>
              <td style="text-align:center;padding:8px 4px">
                ${(emp.enpsHistory || []).slice(-1)[0] || '-'}
              </td>
              <td style="text-align:center;padding:8px 4px">
                <span style="font-size:0.7rem;font-weight:700;color:${RISK_COLOR[risk.level]};
                             padding:2px 7px;border-radius:99px;background:${RISK_COLOR[risk.level]}15">
                  ${RISK_LABEL[risk.level].split(' ')[0]}
                </span>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── OKR 조직 현황 ──────────────────────────────────────────────

function orgOkrSection(orgGoals = null) {
  let goals = orgGoals;

  // Fall back to localStorage, then demo data
  if (!goals) {
    try { goals = JSON.parse(localStorage.getItem('hr_okr_goals') || '[]'); } catch { goals = []; }
  }

  if (!goals.length) {
    goals = [
      { objective:'전사 AI 역량 강화',       keyResults:[{progress:75},{progress:60},{progress:82}] },
      { objective:'고객 만족도 NPS 80 달성', keyResults:[{progress:88},{progress:55}] },
      { objective:'데이터 기반 의사결정 체계', keyResults:[{progress:40},{progress:65},{progress:30}] },
      { objective:'신규 사업 파이프라인 구축', keyResults:[{progress:50},{progress:70}] },
    ];
  }

  const krs       = goals.flatMap(g => g.keyResults || []);
  const avgProg   = krs.length ? Math.round(krs.reduce((s, kr) => s + (kr.progress || 0), 0) / krs.length) : 0;
  const onTrack   = goals.filter(g => {
    const avg = (g.keyResults || []).reduce((s, kr) => s + (kr.progress || 0), 0) / Math.max(1, (g.keyResults || []).length);
    return avg >= 70;
  }).length;
  const barColor  = avgProg >= 70 ? 'var(--success)' : avgProg >= 40 ? 'var(--warning)' : 'var(--danger)';

  return `
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div style="font-weight:700;font-size:0.9rem">🎯 전사 OKR 달성 현황</div>
        <span style="font-size:0.72rem;color:var(--text-muted)">${goals.length}개 목표</span>
      </div>

      <!-- 전체 진척 게이지 -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <div style="position:relative;width:72px;height:72px;flex-shrink:0">
          <svg viewBox="0 0 36 36" style="width:100%;height:100%;transform:rotate(-90deg)">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" stroke-width="3"/>
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="${barColor}" stroke-width="3"
                    stroke-dasharray="${avgProg} ${100 - avgProg}" stroke-linecap="round"/>
          </svg>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
                      font-size:1rem;font-weight:800;color:${barColor}">${avgProg}%</div>
        </div>
        <div style="flex:1">
          <div style="font-size:0.82rem;font-weight:700;color:var(--text);margin-bottom:4px">전사 평균 달성률</div>
          <div style="display:flex;gap:10px;font-size:0.72rem">
            <span style="color:var(--success)">✅ 정상 ${onTrack}개</span>
            <span style="color:var(--warning)">⚠ 주의 ${goals.length - onTrack}개</span>
          </div>
        </div>
      </div>

      <!-- 목표별 바 -->
      ${goals.slice(0, 4).map(g => {
        const avg = (g.keyResults || []).length
          ? Math.round((g.keyResults || []).reduce((s, kr) => s + (kr.progress || 0), 0) / (g.keyResults || []).length)
          : 0;
        const col = avg >= 70 ? 'var(--success)' : avg >= 40 ? 'var(--warning)' : 'var(--danger)';
        return `
          <div style="margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
              <div style="font-size:0.78rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:75%">
                ${esc(g.objective)}
              </div>
              <span style="font-size:0.75rem;font-weight:700;color:${col};flex-shrink:0;margin-left:4px">${avg}%</span>
            </div>
            <div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${avg}%;background:${col};border-radius:3px;transition:width .6s ease"></div>
            </div>
          </div>`;
      }).join('')}
    </div>
  `;
}

// ── 전사 역량 성장 트렌드 ─────────────────────────────────────

function orgGrowthTrend() {
  const history = (() => {
    try { return JSON.parse(localStorage.getItem('hr_growth_history') || '[]'); } catch { return []; }
  })();

  // Use history or demo data
  const data = history.length >= 2 ? history : [
    { date:'2025-10-15', final_score:3.10 },
    { date:'2025-12-20', final_score:3.35 },
    { date:'2026-03-10', final_score:3.55 },
    { date:'2026-06-01', final_score:3.74 },
  ];

  const recent    = data.slice(-6);
  const scores    = recent.map(h => Number(h.final_score));
  const minV      = Math.max(0,   Math.min(...scores) - 0.3);
  const maxV      = Math.min(5.0, Math.max(...scores) + 0.3);
  const W = 300; const H = 60; const PX = 20; const PY = 10;

  const xOf = i => PX + (i / (recent.length - 1)) * (W - PX * 2);
  const yOf = v => PY + (1 - (v - minV) / (maxV - minV)) * (H - PY * 2);
  const pts = recent.map((h, i) => ({ x: xOf(i), y: yOf(h.final_score), h }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = line + ` L${pts[pts.length-1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`;

  const first   = scores[0];
  const last    = scores[scores.length - 1];
  const totalDelta = (last - first).toFixed(2);
  const deltaColor = Number(totalDelta) >= 0 ? 'var(--success)' : 'var(--danger)';

  return `
    <div class="card" style="margin-bottom:16px;padding:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-weight:700;font-size:0.9rem">📈 역량 성장 트렌드</div>
        <span style="font-size:0.8rem;font-weight:700;padding:3px 10px;border-radius:99px;
               background:${Number(totalDelta) >= 0 ? '#ECFDF5' : '#FFF1F2'};color:${deltaColor}">
          ${Number(totalDelta) >= 0 ? '▲' : '▼'} ${Math.abs(Number(totalDelta)).toFixed(2)} 전 기간 대비
        </span>
      </div>

      <svg viewBox="0 0 ${W} ${H + 18}" style="width:100%;height:auto;display:block"
           role="img" aria-label="전사 역량 성장 추이">
        <defs>
          <linearGradient id="og-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#4F46E5" stop-opacity="0.15"/>
            <stop offset="100%" stop-color="#4F46E5" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${area}" fill="url(#og-grad)"/>
        <path d="${line}" fill="none" stroke="#4F46E5" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"/>
        ${pts.map((p, i) => `
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}"
                  r="${i === pts.length - 1 ? 5 : 3}" fill="${i === pts.length - 1 ? '#4F46E5' : '#fff'}"
                  stroke="#4F46E5" stroke-width="2"/>
          <text x="${p.x.toFixed(1)}" y="${Math.max(8, p.y - 6).toFixed(1)}"
                text-anchor="middle" font-size="9"
                fill="${i === pts.length - 1 ? '#4F46E5' : 'var(--text-muted)'}"
                font-weight="${i === pts.length - 1 ? '700' : '400'}">${p.h.final_score.toFixed(1)}</text>
          <text x="${p.x.toFixed(1)}" y="${H + 16}" text-anchor="middle" font-size="8" fill="var(--text-muted)">
            ${(() => { try { const d = new Date(p.h.date); return `${d.getMonth()+1}/${d.getDate()}`; } catch { return ''; } })()}
          </text>
        `).join('')}
      </svg>

      <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;
                  border-top:1px solid var(--border);font-size:0.72rem;color:var(--text-muted)">
        <span>최저 <strong>${Math.min(...scores).toFixed(2)}</strong></span>
        <span>최신 <strong style="color:var(--primary)">${last.toFixed(2)}</strong> / 5.0</span>
        <span>최고 <strong>${Math.max(...scores).toFixed(2)}</strong></span>
      </div>
    </div>
  `;
}

function printReport() {
  const style = document.createElement('style');
  style.id = '_exec_print_style';
  style.textContent = `
    @media print {
      .top-bar, .bottom-nav, button, .no-print { display: none !important; }
      body { background:var(--card-bg) !important; }
      .card { border: 1px solid #ddd !important; box-shadow: none !important; }
    }`;
  document.head.appendChild(style);
  window.addEventListener('afterprint', () => {
    document.getElementById('_exec_print_style')?.remove();
  }, { once: true });
  window.print();
  showToast('인쇄 창이 열렸습니다.', 'success')
      addNotification({ type: 'success', title: 'executive', body: '인쇄 창이 열렸습니다.' });
}
