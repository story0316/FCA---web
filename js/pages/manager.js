/**
 * manager.js – 매니저 팀 현황 대시보드
 * 직보 역량 현황 / 미완료 과제 / 팀 OKR / eNPS 트렌드
 */

import {getUser, isAdmin, isApplicant } from '../auth.js';
import { showToast }        from '../components/toast.js';
import { api }              from '../api.js';
import { MGR_NODE, loadDisplayEmployees } from '../data/demo_employees.js';
import { getRankedRisks, RISK_COLOR, RISK_LABEL } from '../utils/retention.js';
import { addNotification }  from '../components/notification-hub.js';
import { LIFECYCLE_SURVEYS, LIFECYCLE_PHASES } from '../data/lifecycle_surveys.js';
const TODAY = new Date().toISOString().slice(0,10);

let _root = null;

const LS_COACHING = 'hr_coaching_notes';

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── 데이터 로드 ─────────────────────────────────────────────────

async function _loadEmployees() {
  const user  = getUser();
  const orgId = user?.org_id;
  return await loadDisplayEmployees(orgId);
}

async function _loadTeamReviews() {
  try {
    const user  = getUser();
    const orgId = user?.org_id;
    if (!orgId) return [];
    const reviews = await api.performance?.getOrgReviews?.(orgId);
    return Array.isArray(reviews) ? reviews : [];
  } catch {
    return [];
  }
}

async function _loadTeamGoals(employees) {
  // Try to load real DB goals for each team member in parallel
  try {
    if (!employees?.length) return [];
    const results = await Promise.allSettled(
      employees.map(emp => api.performance?.getGoals?.(emp.id || emp.user_id))
    );
    const allGoals = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && Array.isArray(r.value) && r.value.length) {
        r.value.forEach(g => {
          allGoals.push({
            ...g,
            ownerName: employees[i]?.name || employees[i]?.name_ko || '팀원',
          });
        });
      }
    });
    if (allGoals.length) return allGoals;
  } catch {}

  // Fallback: read localStorage (goals.js saves here)
  try {
    const user = getUser();
    const raw  = JSON.parse(localStorage.getItem('hr_okr_goals') || '[]');
    if (raw.length) return raw;
  } catch {}

  // Demo fallback
  return [
    { id:'g1', userId:'EMP001', ownerName:'김민준', objective:'AI 역량 강화 프로그램 완료',        keyResults:[{text:'온라인 과정 수료',progress:80},{text:'실습 프로젝트 제출',progress:45}] },
    { id:'g2', userId:'EMP002', ownerName:'이서연', objective:'고객 만족도 NPS +10 달성',          keyResults:[{text:'서비스 개선 3건 적용',progress:100},{text:'피드백 수집 체계 구축',progress:60}] },
    { id:'g3', userId:'EMP003', ownerName:'박지훈', objective:'데이터 기반 의사결정 체계 수립',     keyResults:[{text:'대시보드 구축',progress:70},{text:'주간 리포트 자동화',progress:30}] },
  ];
}

async function _loadTeamInstances(employees) {
  if (!employees?.length) return {};
  try {
    const results = await Promise.allSettled(
      employees.map(emp => api.assessment.listInstances(emp.id || emp.user_id))
    );
    const map = {};
    employees.forEach((emp, i) => {
      const r = results[i];
      map[emp.id || emp.user_id] = (r.status === 'fulfilled' && Array.isArray(r.value)) ? r.value : [];
    });
    return map;
  } catch {
    return {};
  }
}

// ── 마운트 ──────────────────────────────────────────────────────

export async function mount(container) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _root = container;

  // Show skeleton while loading
  container.innerHTML = `
    <div class="page" style="background:var(--bg);display:flex;flex-direction:column;height:100vh;overflow:hidden">
      <div class="top-bar" style="flex-shrink:0">
        <button class="btn btn-ghost btn-sm" onclick="window.navBack()" style="padding:8px">←</button>
        <div class="top-bar-title">팀 현황</div>
      </div>
      <div class="page-content" style="flex:1;overflow-y:auto;padding-top:16px">
        ${[1,2,3].map(() => '<div class="skeleton skeleton-card" style="height:90px;margin-bottom:12px"></div>').join('')}
      </div>
    </div>`;

  const employees = await _loadEmployees();
  const [teamGoals, teamReviews, instanceMap, myEvalTasks] = await Promise.all([
    _loadTeamGoals(employees),
    _loadTeamReviews(),
    _loadTeamInstances(employees),
    api.assessment.getPendingForMe().catch(() => []),
  ]);

  if (_root) render(container, employees, teamGoals, teamReviews, instanceMap, myEvalTasks);
}

export function unmount() { _root = null; }

// ── 렌더 ───────────────────────────────────────────────────────

function render(root, employees, teamGoals, teamReviews = [], instanceMap = {}, myEvalTasks = []) {
  const ranked  = getRankedRisks(employees);
  const high    = ranked.filter(r => r.risk.level === 'HIGH');
  const pending = getPendingTasks(employees);

  // eNPS 팀 평균 계산
  const enpsValues = employees
    .map(e => (e.enpsHistory || []).slice(-1)[0])
    .filter(v => v !== undefined && v !== null);
  const enpsAvg = enpsValues.length
    ? (enpsValues.reduce((s, v) => s + Number(v), 0) / enpsValues.length).toFixed(1)
    : null;
  const enpsColor = enpsAvg == null ? 'var(--text-muted)'
    : enpsAvg >= 8 ? 'var(--success)' : enpsAvg >= 6 ? 'var(--warning)' : 'var(--danger)';

  root.innerHTML = `
    <div class="page" style="background:var(--bg);display:flex;flex-direction:column;height:100vh;overflow:hidden">
      <div class="top-bar" style="flex-shrink:0">
        <button class="btn btn-ghost btn-sm" onclick="window.navBack()" style="padding:8px">←</button>
        <div class="top-bar-title">팀 현황</div>
        <span style="font-size:0.72rem;color:var(--text-muted);padding-right:4px">${employees.length}명</span>
      </div>

      <!-- 고정 KPI 배너 -->
      <div style="flex-shrink:0;background:var(--bg);padding:10px 16px 8px;border-bottom:1px solid var(--border)">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">
          ${miniCard('팀원', employees.length + '명', 'var(--primary)')}
          ${miniCard('이탈 위험', high.length + '명', high.length > 0 ? 'var(--danger)' : 'var(--success)')}
          ${miniCard('미완료', pending.length + '건', pending.length > 0 ? 'var(--warning)' : 'var(--success)')}
          ${miniCard('eNPS', enpsAvg !== null ? enpsAvg + '점' : '-', enpsColor)}
        </div>
      </div>

      <!-- 탭 바 (좌우 스크롤 가능) -->
      <div style="flex-shrink:0;display:flex;background:var(--surface);border-bottom:1.5px solid var(--border);overflow-x:auto;scrollbar-width:none;">
        <button id="mgr-tab-list"   style="flex:0 0 auto;padding:10px 14px;font-size:0.8rem;font-weight:700;border:none;background:none;cursor:pointer;border-bottom:2.5px solid var(--primary);color:var(--primary);white-space:nowrap">📋 조치 과제</button>
        <button id="mgr-tab-team"   style="flex:0 0 auto;padding:10px 14px;font-size:0.8rem;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2.5px solid transparent;color:var(--text-muted);white-space:nowrap">👥 팀 상세</button>
        <button id="mgr-tab-assess" style="flex:0 0 auto;padding:10px 14px;font-size:0.8rem;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2.5px solid transparent;color:var(--text-muted);white-space:nowrap">📊 팀 평가</button>
        <button id="mgr-tab-survey" style="flex:0 0 auto;padding:10px 14px;font-size:0.8rem;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2.5px solid transparent;color:var(--text-muted);white-space:nowrap">🗳️ 서베이 현황</button>
        <button id="mgr-tab-org"    style="flex:0 0 auto;padding:10px 14px;font-size:0.8rem;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2.5px solid transparent;color:var(--text-muted);white-space:nowrap">🗺️ 조직도</button>
        <button id="mgr-tab-review" style="flex:0 0 auto;padding:10px 14px;font-size:0.8rem;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2.5px solid transparent;color:var(--text-muted);white-space:nowrap">📝 리뷰</button>
        <button id="mgr-tab-1on1"   style="flex:0 0 auto;padding:10px 14px;font-size:0.8rem;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2.5px solid transparent;color:var(--text-muted);white-space:nowrap">💬 1:1 현황</button>
      </div>

      <div class="page-content" style="flex:1;overflow-y:auto;padding-bottom:80px" id="mgr-content">

        <!-- ① 조치 과제 탭 -->
        <div id="mgr-view-list">
          ${renderMyEvalAssignments(myEvalTasks)}
          ${renderPendingSection(pending)}
          ${renderTeamOkr(teamGoals)}
          ${renderTeamEnpsChart(employees)}
          ${renderTeamReviews(teamReviews)}
        </div>

        <!-- ② 팀 상세 탭 -->
        <div id="mgr-view-team" style="display:none">
          <div style="margin-bottom:6px;font-size:0.75rem;color:var(--text-muted)">
            리스크 순 정렬 · 카드 탭하면 코칭 노트
          </div>
          ${ranked.map(({ emp, risk }) => memberCard(emp, risk, instanceMap[emp.id || emp.user_id] || [])).join('')}
        </div>

        <!-- ③ 팀 평가 현황 탭 -->
        <div id="mgr-view-assess" style="display:none">
          ${renderTeamAssessments(employees, instanceMap)}
        </div>

        <!-- ④ 서베이 현황 탭 -->
        <div id="mgr-view-survey" style="display:none">
          ${renderSurveyMatrix(employees)}
        </div>

        <!-- ⑤ 조직도 탭 -->
        <div id="mgr-view-org" style="display:none">
          ${renderOrgChart(employees, instanceMap, pending)}
        </div>

        <!-- ⑤ 리뷰 현황 탭 -->
        <div id="mgr-view-review" style="display:none">
          ${renderReviewStatus(employees, teamReviews)}
        </div>

        <!-- ⑦ 1:1 현황 탭 -->
        <div id="mgr-view-1on1" style="display:none">
          ${renderTeamOneOnOne(employees)}
        </div>

      </div>
    </div>

    <!-- 평가자 배정 모달 -->
    <div id="assign-eval-modal" style="display:none;position:fixed;inset:0;z-index:300;
         background:rgba(0,0,0,0.5);align-items:flex-end">
      <div style="width:100%;max-width:480px;margin:0 auto;background:var(--surface);
                  border-radius:20px 20px 0 0;padding:22px 18px 36px;max-height:85vh;overflow-y:auto">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <div style="font-weight:700;font-size:1rem">👥 평가자 배정</div>
          <button id="assign-eval-close" style="border:none;background:none;font-size:1.2rem;cursor:pointer;color:var(--text-muted)">✕</button>
        </div>
        <div id="assign-eval-subject" style="font-size:0.82rem;color:var(--primary);margin-bottom:14px;font-weight:600"></div>

        <!-- 평가자 유형 탭 -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px" id="assign-eval-types"></div>

        <!-- 사용자 목록 -->
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px">배정할 평가자를 선택하세요 (복수 가능)</div>
        <div id="assign-eval-user-list" style="max-height:240px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:6px 0"></div>

        <!-- 저장 버튼 -->
        <button id="assign-eval-save" class="btn btn-primary" style="width:100%;margin-top:14px">배정 저장</button>
      </div>
    </div>

    <!-- 코칭 노트 모달 -->
    <div id="coaching-modal" style="display:none;position:fixed;inset:0;z-index:300;
         background:rgba(0,0,0,0.5);align-items:flex-end">
      <div style="width:100%;max-width:480px;margin:0 auto;background:var(--surface);
                  border-radius:20px 20px 0 0;padding:22px 18px 36px">
        <div style="font-weight:700;font-size:1rem;margin-bottom:4px">💬 코칭 노트</div>
        <div id="coaching-target-name" style="font-size:0.82rem;color:var(--primary);margin-bottom:14px;font-weight:600"></div>
        <div id="coaching-prev-notes" style="max-height:120px;overflow-y:auto;margin-bottom:12px"></div>
        <textarea maxlength="500" id="coaching-note-input" class="form-input" rows="3"
          placeholder="오늘 면담 내용, 관찰 사항, 다음 목표..."
          style="resize:vertical;min-height:70px;margin-bottom:12px"></textarea>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <select id="coaching-type-select" class="form-input" style="font-size:0.82rem">
            <option value="1:1">💬 1:1 면담</option>
            <option value="coaching">🎯 코칭</option>
            <option value="feedback">📝 피드백</option>
            <option value="goal">🎯 목표 설정</option>
          </select>
          <input id="coaching-date-input" type="date" class="form-input" style="font-size:0.82rem" min="${TODAY}">
        </div>
        <div style="display:flex;gap:8px">
          <button id="coaching-save-btn" class="btn btn-primary" style="flex:1">저장</button>
          <button id="coaching-1on1-btn" class="btn btn-outline" style="flex:1">1:1 기록 →</button>
          <button id="coaching-close-btn" class="btn btn-ghost" style="flex:0 0 44px;padding:0">✕</button>
        </div>
      </div>
    </div>`;

  // ── 탭 전환 ────────────────────────────────────────────────────
  const tabList   = root.querySelector('#mgr-tab-list');
  const tabTeam   = root.querySelector('#mgr-tab-team');
  const tabAssess = root.querySelector('#mgr-tab-assess');
  const tabSurvey = root.querySelector('#mgr-tab-survey');
  const tabOrg    = root.querySelector('#mgr-tab-org');
  const tabReview = root.querySelector('#mgr-tab-review');
  const tab1on1   = root.querySelector('#mgr-tab-1on1');
  const viewList   = root.querySelector('#mgr-view-list');
  const viewTeam   = root.querySelector('#mgr-view-team');
  const viewAssess = root.querySelector('#mgr-view-assess');
  const viewSurvey = root.querySelector('#mgr-view-survey');
  const viewOrg    = root.querySelector('#mgr-view-org');
  const viewReview = root.querySelector('#mgr-view-review');
  const view1on1   = root.querySelector('#mgr-view-1on1');
  const ALL_TABS  = [tabList, tabTeam, tabAssess, tabSurvey, tabOrg, tabReview, tab1on1];
  const ALL_VIEWS = [viewList, viewTeam, viewAssess, viewSurvey, viewOrg, viewReview, view1on1];

  function switchTab(activeTab, activeView) {
    ALL_TABS.forEach(t => { if (t) { t.style.borderBottomColor = 'transparent'; t.style.color = 'var(--text-muted)'; t.style.fontWeight = '600'; } });
    ALL_VIEWS.forEach(v => { if (v) v.style.display = 'none'; });
    if (activeTab)  { activeTab.style.borderBottomColor = 'var(--primary)'; activeTab.style.color = 'var(--primary)'; activeTab.style.fontWeight = '700'; }
    if (activeView) activeView.style.display = '';
  }

  switchTab(tabList, viewList); // default

  tabList?.addEventListener('click',   () => switchTab(tabList, viewList));
  tabTeam?.addEventListener('click',   () => switchTab(tabTeam, viewTeam));
  tabAssess?.addEventListener('click', () => switchTab(tabAssess, viewAssess));
  tabSurvey?.addEventListener('click', () => { switchTab(tabSurvey, viewSurvey); bindSurveyReqBtns(root); });
  tabOrg?.addEventListener('click',    () => switchTab(tabOrg, viewOrg));
  tabReview?.addEventListener('click', () => switchTab(tabReview, viewReview));
  tab1on1?.addEventListener('click',   () => switchTab(tab1on1, view1on1));

  // ── Action button handlers ──────────────────────────────────────
  let _coachingTarget = null;

  function openCoachingModal(empId, empName) {
    _coachingTarget = { id: empId, name: empName };
    const modal = root.querySelector('#coaching-modal');
    const target = root.querySelector('#coaching-target-name');
    const prevEl = root.querySelector('#coaching-prev-notes');
    const dateIn = root.querySelector('#coaching-date-input');
    if (!modal) return;

    if (target) target.textContent = empName + '님';
    if (dateIn) dateIn.value = new Date().toISOString().slice(0, 10);

    // Load previous notes
    let notes = [];
    try { notes = JSON.parse(localStorage.getItem(LS_COACHING) || '[]').filter(n => n.empId === empId); } catch {}
    if (prevEl) {
      prevEl.innerHTML = notes.length ? notes.slice(0, 3).map(n => `
        <div style="font-size:0.75rem;padding:6px 8px;background:var(--bg);border-radius:6px;margin-bottom:4px">
          <span style="color:var(--text-muted)">${n.date} · ${n.type}</span><br>
          ${esc(n.note)}
        </div>`).join('') : `<div style="font-size:0.75rem;color:var(--text-muted);padding:4px 0">이전 기록 없음</div>`;
    }

    modal.style.display = 'flex';
  }

  root.querySelectorAll('.member-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const name   = btn.dataset.name;
      const empId  = btn.dataset.empId || name;
      if (action === '1:1' || action === 'coaching') {
        openCoachingModal(empId, name);
      } else if (action === 'idp') {
        window.appState = window.appState || {};
        window.appState.managerViewEmployee = name;
        window.location.hash = '#/growth';
        showToast(`${name}님의 성장 계획 페이지로 이동합니다.`, 'info');
      } else if (action === 'assess') {
        window.location.hash = '#/assessment';
      }
    });
  });

  // 조직도 노드 클릭 → 코칭 모달
  root.querySelectorAll('.org-node').forEach(node => {
    node.addEventListener('click', () => {
      openCoachingModal(node.dataset.empId, node.dataset.empName);
    });
  });

  // Coaching modal events
  root.querySelector('#coaching-close-btn')?.addEventListener('click', () => {
    const modal = root.querySelector('#coaching-modal');
    if (modal) modal.style.display = 'none';
  });

  root.querySelector('#coaching-save-btn')?.addEventListener('click', () => {
    const note = root.querySelector('#coaching-note-input')?.value?.trim();
    const type = root.querySelector('#coaching-type-select')?.value || '1:1';
    const date = root.querySelector('#coaching-date-input')?.value || new Date().toISOString().slice(0, 10);
    if (!note || !_coachingTarget) return;

    let notes = [];
    try { notes = JSON.parse(localStorage.getItem(LS_COACHING) || '[]'); } catch {}
    notes.unshift({ id: `CN_${Date.now()}`, empId: _coachingTarget.id, empName: _coachingTarget.name, type, date, note, createdAt: new Date().toISOString() });
    localStorage.setItem(LS_COACHING, JSON.stringify(notes));

    showToast(`${_coachingTarget.name}님 코칭 노트가 저장되었습니다.`, 'success')
    addNotification({ type: 'success', title: '관리자', body: '님 코칭 노트가 저장되었습니다.' });
    const modal = root.querySelector('#coaching-modal');
    if (modal) modal.style.display = 'none';
  });

  root.querySelector('#coaching-1on1-btn')?.addEventListener('click', () => {
    if (_coachingTarget) {
      window.appState = window.appState || {};
      window.appState.managerViewEmployee = _coachingTarget.name;
    }
    const modal = root.querySelector('#coaching-modal');
    if (modal) modal.style.display = 'none';
    window.location.hash = '#/reviews';
    showToast(`${_coachingTarget?.name || ''}님 1:1 미팅 기록으로 이동합니다.`, 'info');
  });

  // Team review rows — click to open manager comment modal
  root.querySelectorAll('.team-review-row').forEach(row => {
    row.addEventListener('click', () => _openManagerCommentModal(row.dataset.reviewId, root));
  });

  // 조치 과제 접기/펴기 (헤더 클릭)
  root.querySelector('#pending-header')?.addEventListener('click', () => {
    const body = root.querySelector('#pending-body');
    const icon = root.querySelector('#pending-toggle-icon');
    if (!body) return;
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : '';
    if (icon) icon.textContent = open ? '▶' : '▼';
  });

  // 개인 진행 요청 푸시
  root.querySelectorAll('.task-push-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const name = btn.dataset.empName;
      const task = btn.dataset.task;
      addNotification({
        type:  'reminder',
        title: `[진행 요청] ${task}`,
        body:  `관리자가 ${name}님에게 '${task}' 처리를 요청했습니다.`,
        route: '#/growth',
      });
      showToast(`${name}님에게 진행 요청을 보냈습니다.`, 'success')
    addNotification({ type: 'success', title: '관리자', body: '님에게 진행 요청을 보냈습니다.' });
      btn.textContent = '✓ 요청됨';
      btn.disabled = true;
      btn.style.opacity = '0.55';
    });
  });

  // 리뷰 요청 버튼
  root.querySelectorAll('.remind-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.empName;
      addNotification({
        type:  'system',
        title: `${name}님 리뷰 작성 요청`,
        body:  `관리자가 ${name}님에게 성과 리뷰 작성을 요청했습니다. 성과 리뷰 탭에서 작성해 주세요.`,
        route: '#/reviews',
      });
      showToast(`${name}님에게 리뷰 작성 알림을 보냈습니다.`, 'success')
    addNotification({ type: 'success', title: '관리자', body: '님에게 리뷰 작성 알림을 보냈습니다.' });
      btn.textContent = '✓ 요청됨';
      btn.disabled = true;
      btn.style.opacity = '0.6';
    });
  });

  // ── 평가자 배정 모달 이벤트 ─────────────────────────────────────
  let _assignCtx = null;  // { instanceId, subjectName, evalType }

  root.querySelector('#assign-eval-close')?.addEventListener('click', () => {
    root.querySelector('#assign-eval-modal').style.display = 'none';
  });

  // 이벤트 델리게이션 — 동적 렌더링 버튼 처리
  root.querySelector('#mgr-view-assess')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.assign-eval-btn');
    if (!btn) return;
    {
      const iid     = btn.dataset.iid;
      const subject = btn.dataset.subject;
      const modal   = root.querySelector('#assign-eval-modal');
      const subjEl  = root.querySelector('#assign-eval-subject');
      const typesEl = root.querySelector('#assign-eval-types');
      const listEl  = root.querySelector('#assign-eval-user-list');

      if (!modal) return;
      _assignCtx = { instanceId: iid, subjectName: subject, evalType: 'peer' };
      if (subjEl) subjEl.textContent = `${subject}님 인스턴스`;

      // 유형 탭 렌더링
      const EVAL_TYPES = [
        { key: 'manager',     label: '상사평가' },
        { key: 'peer',        label: '동료평가' },
        { key: 'subordinate', label: '부하평가' },
        { key: 'customer',    label: '고객평가' },
      ];
      if (typesEl) {
        typesEl.innerHTML = EVAL_TYPES.map(t =>
          `<button class="assign-type-chip" data-type="${t.key}" style="
            padding:5px 12px;border-radius:99px;border:1.5px solid ${t.key === 'peer' ? 'var(--primary)' : 'var(--border)'};
            background:${t.key === 'peer' ? 'var(--primary)' : 'transparent'};
            color:${t.key === 'peer' ? '#fff' : 'var(--text-muted)'};
            font-size:0.75rem;font-weight:600;cursor:pointer">${t.label}</button>`
        ).join('');
        typesEl.querySelectorAll('.assign-type-chip').forEach(chip => {
          chip.addEventListener('click', () => {
            _assignCtx.evalType = chip.dataset.type;
            typesEl.querySelectorAll('.assign-type-chip').forEach(c => {
              c.style.background = c.dataset.type === _assignCtx.evalType ? 'var(--primary)' : 'transparent';
              c.style.color      = c.dataset.type === _assignCtx.evalType ? '#fff' : 'var(--text-muted)';
              c.style.borderColor = c.dataset.type === _assignCtx.evalType ? 'var(--primary)' : 'var(--border)';
            });
          });
        });
      }

      // 사용자 목록 로드
      if (listEl) {
        listEl.innerHTML = '<div style="padding:12px;font-size:0.78rem;color:var(--text-muted)">사용자 로드 중…</div>';
        modal.style.display = 'flex';
        try {
          const user = getUser();
          const orgId = user?.org_id;
          const res = orgId ? await api.organization.listUsers(orgId) : null;
          const orgUsers = (res?.users || (Array.isArray(res) ? res : [])).filter(u => u.id !== (btn.dataset.assesseeId || ''));
          if (!orgUsers.length) {
            listEl.innerHTML = '<div style="padding:12px;font-size:0.78rem;color:var(--text-muted)">사용자 없음</div>';
          } else {
            listEl.innerHTML = orgUsers.map(u =>
              `<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border)">
                <input type="checkbox" value="${esc(u.id)}" style="width:16px;height:16px;flex-shrink:0">
                <div>
                  <div style="font-size:0.82rem;font-weight:600;color:var(--text)">${esc(u.name || u.name_ko || u.email)}</div>
                  <div style="font-size:0.7rem;color:var(--text-muted)">${esc(u.dept || u.department || u.role || '')}</div>
                </div>
              </label>`
            ).join('');
          }
        } catch {
          listEl.innerHTML = '<div style="padding:12px;font-size:0.78rem;color:var(--danger)">사용자 목록 로드 실패</div>';
        }
      } else {
        modal.style.display = 'flex';
      }
    }
  });

  root.querySelector('#assign-eval-save')?.addEventListener('click', async () => {
    if (!_assignCtx) return;
    const listEl  = root.querySelector('#assign-eval-user-list');
    const saveBtn = root.querySelector('#assign-eval-save');
    const checked = [...(listEl?.querySelectorAll('input[type=checkbox]:checked') || [])].map(c => c.value);
    if (!checked.length) { showToast('최소 1명을 선택해주세요.', 'warning'); return; }

    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중…';
    try {
      const res = await api.assessment.assignEvaluators(_assignCtx.instanceId, _assignCtx.evalType, checked);
      if (res?.ok) {
        const LABEL = { manager:'상사평가', peer:'동료평가', subordinate:'부하평가', customer:'고객평가' };
        showToast(`${LABEL[_assignCtx.evalType] || '평가자'} ${res.added ?? checked.length}명 배정 완료`, 'success')
    addNotification({ type: 'success', title: '관리자', body: '명 배정 완료' });
        root.querySelector('#assign-eval-modal').style.display = 'none';
      } else {
        showToast(res?.error || '배정 실패', 'error');
      }
    } catch (e) {
      showToast(`오류: ${e.message}`, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '배정 저장';
    }
  });
}

// ── 관리자 코멘트 모달 ────────────────────────────────────────────

function _openManagerCommentModal(reviewId, root) {
  document.getElementById('_mgr-modal-manager')?.remove();

  const overlay = document.createElement('div');
  overlay.id = '_mgr-modal-manager';
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;
    display:flex;align-items:flex-end;justify-content:center`;

  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:16px 16px 0 0;
                padding:20px 20px 32px;width:100%;max-width:480px">
      <div style="width:36px;height:4px;border-radius:2px;background:var(--border);margin:0 auto 16px"></div>
      <div style="font-weight:700;font-size:0.95rem;margin-bottom:14px">💬 관리자 코멘트 작성</div>
      <textarea maxlength="500" id="_mgr-text-manager" class="form-control" rows="4"
        placeholder="성과에 대한 평가 및 다음 기간 기대사항을 작성해 주세요"
        style="resize:none;font-size:0.85rem"></textarea>
      <div style="display:flex;gap:10px;margin-top:14px">
        <button id="_mgr-cancel-manager" class="btn btn-ghost" style="flex:1">취소</button>
        <button id="_mgr-save-manager"   class="btn btn-primary" style="flex:2">저장</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#_mgr-cancel-manager').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#_mgr-save-manager').addEventListener('click', async () => {
    const comment = overlay.querySelector('#_mgr-text-manager').value.trim();
    if (!comment) { showToast('코멘트를 입력해주세요.', 'warning'); return; }
    overlay.remove();
    showToast('관리자 코멘트가 저장되었습니다.', 'success');
    try {
      await api.performance?.saveManagerComment?.(reviewId, comment);
    } catch {
      showToast('서버 저장 실패 — 재시도해주세요.', 'warning');
    }
    // Refresh badge in row
    const row = root.querySelector(`.team-review-row[data-review-id="${reviewId}"]`);
    if (row) {
      const badge = row.querySelector('.mgr-badge-slot');
      if (badge) badge.outerHTML = `<span style="font-size:0.9rem" title="코멘트 완료">✅</span>`;
    }
  });
}

// ── 팀 OKR ──────────────────────────────────────────────────────

function renderTeamOkr(teamGoals) {
  const goals = teamGoals || [];

  if (!goals.length) {
    return `
      <div class="card" style="margin-bottom:16px;padding:14px">
        <div style="font-weight:700;font-size:0.88rem;margin-bottom:8px">🎯 팀 OKR 현황</div>
        <div style="font-size:0.8rem;color:var(--text-muted);text-align:center;padding:16px 0">
          등록된 OKR이 없습니다.<br>
          <a href="#/goals" style="color:var(--primary);font-size:0.75rem">OKR 설정하기 →</a>
        </div>
      </div>`;
  }

  const allKrs  = goals.flatMap(g => {
    const krs = Array.isArray(g.keyResults) ? g.keyResults
      : (typeof g.key_results_json === 'string' ? JSON.parse(g.key_results_json || '[]') : []);
    return krs;
  });
  const avgProg = allKrs.length
    ? Math.round(allKrs.reduce((s, kr) => s + (kr.progress || 0), 0) / allKrs.length)
    : 0;
  const onTrack = goals.filter(g => {
    const krs = Array.isArray(g.keyResults) ? g.keyResults
      : (typeof g.key_results_json === 'string' ? JSON.parse(g.key_results_json || '[]') : []);
    const avg = krs.length ? krs.reduce((s, kr) => s + (kr.progress || 0), 0) / krs.length : 0;
    return avg >= 70;
  }).length;
  const barColor = avgProg >= 70 ? 'var(--success)' : avgProg >= 40 ? 'var(--warning)' : 'var(--danger)';

  return `
    <div class="card" style="margin-bottom:16px;padding:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-weight:700;font-size:0.88rem">🎯 팀 OKR 현황</div>
        <span style="font-size:0.72rem;color:var(--text-muted)">${goals.length}개 목표</span>
      </div>

      <!-- 팀 평균 진척 -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${avgProg}%;background:${barColor};border-radius:4px;transition:width .6s ease"></div>
        </div>
        <div style="font-size:0.88rem;font-weight:800;color:${barColor};min-width:36px">${avgProg}%</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <div style="background:var(--bg);border-radius:var(--radius-sm);padding:8px;text-align:center">
          <div style="font-size:1.2rem;font-weight:800;color:var(--success)">${onTrack}</div>
          <div style="font-size:0.65rem;color:var(--text-muted)">정상 진행 (70%↑)</div>
        </div>
        <div style="background:var(--bg);border-radius:var(--radius-sm);padding:8px;text-align:center">
          <div style="font-size:1.2rem;font-weight:800;color:var(--warning)">${goals.length - onTrack}</div>
          <div style="font-size:0.65rem;color:var(--text-muted)">주의 필요</div>
        </div>
      </div>

      ${goals.slice(0, 5).map(g => {
        const krs = Array.isArray(g.keyResults) ? g.keyResults
          : (typeof g.key_results_json === 'string' ? JSON.parse(g.key_results_json || '[]') : []);
        const avg = krs.length ? Math.round(krs.reduce((s, kr) => s + (kr.progress || 0), 0) / krs.length) : 0;
        const col = avg >= 70 ? 'var(--success)' : avg >= 40 ? 'var(--warning)' : 'var(--danger)';
        const owner = g.ownerName ? `<span style="font-size:0.65rem;color:var(--text-muted);margin-left:4px">${esc(g.ownerName)}</span>` : '';
        return `
          <div style="padding:7px 0;border-top:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <div style="font-size:0.78rem;font-weight:600;color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                ${esc(g.objective || g.title || 'OKR')}${owner}
              </div>
              <span style="font-size:0.75rem;font-weight:700;color:${col};margin-left:8px;flex-shrink:0">${avg}%</span>
            </div>
            <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden">
              <div style="height:100%;width:${avg}%;background:${col};border-radius:2px"></div>
            </div>
          </div>`;
      }).join('')}

      <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/goals'"
              style="width:100%;margin-top:10px;font-size:0.75rem">OKR 전체 보기 →</button>
    </div>
  `;
}

// ── 팀 성과 리뷰 ─────────────────────────────────────────────────

function renderTeamReviews(reviews) {
  const SCORE_COLORS = { 5: '#10B981', 4: '#3B82F6', 3: '#F59E0B', 2: '#F97316', 1: '#EF4444' };
  const SCORE_LABELS = { 5: '탁월', 4: '우수', 3: '보통', 2: '미흡', 1: '부족' };
  const _YEAR = new Date().getFullYear();
  const CYCLE_LABEL = { H1: `${_YEAR} 상반기`, H2: `${_YEAR} 하반기`, ANNUAL: `${_YEAR} 연간` };

  const recent = reviews.slice(0, 10);

  const statsHtml = (() => {
    if (!reviews.length) return '';
    const avgGoal = reviews.reduce((s, r) => s + (r.goalAchievement || 0), 0) / reviews.length;
    const avgComp = reviews.reduce((s, r) => s + (r.competencyScore || 0), 0) / reviews.length;
    const noComment = reviews.filter(r => !r.managerComment).length;
    return `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
        <div style="background:var(--bg);border-radius:var(--radius-sm);padding:8px;text-align:center">
          <div style="font-size:0.65rem;color:var(--text-muted)">평균 목표달성</div>
          <div style="font-size:1.1rem;font-weight:700;color:${SCORE_COLORS[Math.round(avgGoal)] || 'var(--primary)'}">
            ${avgGoal.toFixed(1)}
          </div>
        </div>
        <div style="background:var(--bg);border-radius:var(--radius-sm);padding:8px;text-align:center">
          <div style="font-size:0.65rem;color:var(--text-muted)">평균 역량발휘</div>
          <div style="font-size:1.1rem;font-weight:700;color:${SCORE_COLORS[Math.round(avgComp)] || 'var(--primary)'}">
            ${avgComp.toFixed(1)}
          </div>
        </div>
        <div style="background:var(--bg);border-radius:var(--radius-sm);padding:8px;text-align:center">
          <div style="font-size:0.65rem;color:var(--text-muted)">미코멘트</div>
          <div style="font-size:1.1rem;font-weight:700;color:${noComment > 0 ? 'var(--danger)' : 'var(--success)'}">
            ${noComment}건
          </div>
        </div>
      </div>`;
  })();

  const rowsHtml = recent.map(r => {
    const gScore = r.goalAchievement || 0;
    const cScore = r.competencyScore  || 0;
    const hasComment = !!r.managerComment;
    return `
      <div class="team-review-row" data-review-id="${esc(r.id)}"
           style="display:flex;align-items:center;gap:10px;padding:8px 0;
                  border-bottom:1px solid var(--border);cursor:pointer">
        <div style="flex:1;min-width:0">
          <div style="font-size:0.82rem;font-weight:600;color:var(--text)">
            ${esc(r.ownerName || r.userId || '')}
            <span style="font-size:0.7rem;color:var(--text-muted);font-weight:400;margin-left:4px">
              ${esc(CYCLE_LABEL[r.cycle] || r.cycle || '')}
            </span>
          </div>
          ${r.keyAchievements ? `
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;
                 white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${esc(r.keyAchievements.split('\n')[0])}
            </div>` : ''}
        </div>
        <div style="display:flex;gap:5px;align-items:center;flex-shrink:0">
          <span style="font-size:0.72rem;padding:2px 6px;border-radius:var(--radius-full);
                background:${SCORE_COLORS[gScore]}20;color:${SCORE_COLORS[gScore]};font-weight:600">
            목${gScore} ${SCORE_LABELS[gScore] || ''}
          </span>
          <span style="font-size:0.72rem;padding:2px 6px;border-radius:var(--radius-full);
                background:${SCORE_COLORS[cScore]}20;color:${SCORE_COLORS[cScore]};font-weight:600">
            역${cScore} ${SCORE_LABELS[cScore] || ''}
          </span>
          ${!hasComment
            ? `<span class="mgr-badge-slot" style="font-size:0.65rem;color:var(--danger);font-weight:600;white-space:nowrap">미코멘트</span>`
            : `<span class="mgr-badge-slot" style="font-size:0.9rem" title="코멘트 완료">✅</span>`}
        </div>
      </div>`;
  }).join('');

  return `
    <div class="card" style="margin-bottom:16px;padding:14px 16px" id="team-reviews-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-weight:700;font-size:0.88rem">📋 팀 성과 리뷰</div>
        <span style="font-size:0.72rem;color:var(--text-muted)">${reviews.length}건</span>
      </div>
      ${!reviews.length ? `
        <div style="font-size:0.82rem;color:var(--text-muted);text-align:center;padding:16px 0">
          제출된 성과 리뷰가 없습니다
        </div>` : statsHtml + `<div id="team-review-rows">${rowsHtml}</div>`}
    </div>`;
}

// ── 팀 eNPS 트렌드 차트 ─────────────────────────────────────────

function renderTeamEnpsChart(employees) {
  // Aggregate: for each time slot (index), average eNPS across employees that have that slot
  const series = employees
    .map(e => e.enpsHistory || [])
    .filter(h => h.length > 0);

  if (!series.length) return '';

  const maxLen = Math.max(...series.map(h => h.length));
  if (maxLen < 2) return '';

  // Build aligned average series (use last N points)
  const N = Math.min(maxLen, 6);
  const avgSeries = Array.from({ length: N }, (_, i) => {
    const vals = series
      .map(h => h[h.length - N + i])
      .filter(v => v !== undefined && v !== null);
    return vals.length ? vals.reduce((s, v) => s + Number(v), 0) / vals.length : null;
  }).filter(v => v !== null);

  if (avgSeries.length < 2) return '';

  const W = 200; const H = 48;
  const minV = Math.min(...avgSeries, 0);
  const maxV = Math.max(...avgSeries, 10);
  const xOf = i => (i / (avgSeries.length - 1)) * W;
  const yOf = v => H - ((v - minV) / (maxV - minV + 0.001)) * H;
  const line = avgSeries.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');

  const lastVal = avgSeries[avgSeries.length - 1];
  const prevVal = avgSeries[avgSeries.length - 2];
  const delta   = lastVal - prevVal;
  const dColor  = delta >= 0 ? 'var(--success)' : 'var(--danger)';

  const enpsColor = lastVal >= 8 ? 'var(--success)' : lastVal >= 6 ? 'var(--warning)' : 'var(--danger)';

  return `
    <div class="card" style="margin-bottom:16px;padding:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-weight:700;font-size:0.88rem">📊 팀 eNPS 트렌드</div>
        <div style="display:flex;align-items:baseline;gap:6px">
          <span style="font-size:1.3rem;font-weight:800;color:${enpsColor}">${lastVal.toFixed(1)}</span>
          <span style="font-size:0.72rem;font-weight:700;color:${dColor}">
            ${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}
          </span>
        </div>
      </div>

      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:48px" aria-hidden="true">
        <!-- Zero / mid guide lines -->
        <line x1="0" y1="${yOf(6).toFixed(1)}" x2="${W}" y2="${yOf(6).toFixed(1)}"
              stroke="var(--border)" stroke-width="1" stroke-dasharray="4,3"/>
        <path d="${line}" fill="none" stroke="${enpsColor}" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"/>
        <!-- Area fill -->
        <path d="${line} L${xOf(avgSeries.length-1).toFixed(1)},${H} L0,${H} Z"
              fill="${enpsColor}" opacity="0.08"/>
        <!-- Last point dot -->
        <circle cx="${xOf(avgSeries.length-1).toFixed(1)}" cy="${yOf(lastVal).toFixed(1)}"
                r="3.5" fill="${enpsColor}"/>
      </svg>
      <div style="display:flex;justify-content:space-between;margin-top:4px">
        <span style="font-size:0.62rem;color:var(--text-muted)">${N}회 측정 전</span>
        <span style="font-size:0.62rem;color:var(--text-muted)">최근</span>
      </div>

      <!-- eNPS 분포 (9-10 / 7-8 / 0-6) -->
      ${_renderEnpsDistribution(employees)}
    </div>
  `;
}

function _renderEnpsDistribution(employees) {
  const latest = employees
    .map(e => (e.enpsHistory || []).slice(-1)[0])
    .filter(v => v !== undefined && v !== null)
    .map(Number);
  if (!latest.length) return '';

  const promoters = latest.filter(v => v >= 9).length;
  const passives  = latest.filter(v => v >= 7 && v < 9).length;
  const detractors= latest.filter(v => v < 7).length;
  const n = latest.length;
  const enpsScore = Math.round(((promoters - detractors) / n) * 100);

  return `
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:0.72rem;color:var(--text-muted)">eNPS 점수</span>
        <span style="font-size:0.88rem;font-weight:800;color:${enpsScore >= 20 ? 'var(--success)' : enpsScore >= 0 ? 'var(--warning)' : 'var(--danger)'}">
          ${enpsScore >= 0 ? '+' : ''}${enpsScore}
        </span>
      </div>
      <div style="display:flex;height:6px;border-radius:3px;overflow:hidden;margin-bottom:6px">
        <div style="width:${(promoters/n*100).toFixed(0)}%;background:var(--success)"></div>
        <div style="width:${(passives/n*100).toFixed(0)}%;background:var(--warning)"></div>
        <div style="width:${(detractors/n*100).toFixed(0)}%;background:var(--danger)"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.62rem;color:var(--text-muted)">
        <span>추천 ${promoters}명</span>
        <span>중립 ${passives}명</span>
        <span>비추천 ${detractors}명</span>
      </div>
    </div>
  `;
}

// ── 팀 평가 현황 탭 ──────────────────────────────────────────────

function renderTeamAssessments(employees, instanceMap) {
  const TERM = new Set(['completed', 'calibrated', 'approved', 'finalized', 'cancelled']);
  const DONE = new Set(['completed', 'calibrated', 'approved', 'finalized']);
  const STATUS_LABEL = {
    draft: '초안', self_evaluation: '자기평가', manager_evaluation: '상사평가',
    peer_evaluation: '동료평가', calibration: '조율', completed: '완료',
    calibrated: '캘리브레이션', approved: '승인', finalized: '최종', cancelled: '취소',
  };
  const STATUS_COLOR = {
    draft: 'var(--text-muted)', self_evaluation: '#4F46E5', manager_evaluation: '#8B5CF6',
    peer_evaluation: '#0EA5E9', calibration: '#EC4899',
    completed: '#10B981', calibrated: '#10B981', approved: '#10B981', finalized: '#10B981',
    cancelled: 'var(--text-muted)',
  };

  const cards = employees.map(emp => {
    const empId    = emp.id || emp.user_id;
    const name     = emp.name || emp.name_ko || '팀원';
    const dept     = emp.dept || emp.department || '';
    const instances = instanceMap[empId] || [];
    const active   = instances.filter(i => !TERM.has(i.status));
    const done     = instances.filter(i => DONE.has(i.status));

    const instRows = instances.length === 0
      ? `<div style="font-size:0.75rem;color:var(--text-muted);padding:8px 0">평가 없음</div>`
      : instances.slice(0, 5).map(inst => {
          const st    = inst.status || 'draft';
          const stCol = STATUS_COLOR[st] || 'var(--text-muted)';
          const stLbl = STATUS_LABEL[st] || st;
          const cycle = inst.cycle_name || inst.cycle_id || '사이클';
          const isDone = DONE.has(st);
          const iid    = inst.id || inst.instance_id || '';

          const actionBtn = isDone
            ? `<button onclick="window.appState=window.appState||{};window.appState.instanceId='${esc(iid)}';window.location.hash='#/results'"
                 style="font-size:0.68rem;padding:3px 8px;border-radius:6px;border:1px solid var(--border);
                        background:transparent;color:var(--primary);cursor:pointer;white-space:nowrap">결과 보기</button>`
            : `<button class="assign-eval-btn" data-iid="${esc(iid)}" data-subject="${esc(name)}" data-assessee-id="${esc(empId)}"
                 style="font-size:0.68rem;padding:3px 8px;border-radius:6px;border:1px solid var(--primary)25;
                        background:var(--primary)10;color:var(--primary);cursor:pointer;white-space:nowrap">평가자 배정</button>`;

          return `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--border)">
              <span style="width:7px;height:7px;border-radius:50%;background:${stCol};flex-shrink:0"></span>
              <div style="flex:1;min-width:0">
                <div style="font-size:0.78rem;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(cycle)}</div>
                <span style="font-size:0.68rem;font-weight:700;color:${stCol}">${stLbl}</span>
              </div>
              ${actionBtn}
            </div>`;
        }).join('');

    const summaryColor = active.length > 0 ? 'var(--primary)' : done.length > 0 ? 'var(--success)' : 'var(--text-muted)';
    const summaryText  = active.length > 0 ? `⏳ ${active.length}건 진행 중` : done.length > 0 ? `✅ ${done.length}건 완료` : '평가 없음';

    return `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;margin-bottom:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div>
            <div style="font-weight:700;font-size:0.88rem">${esc(name)}</div>
            <div style="font-size:0.7rem;color:var(--text-muted)">${esc(dept)}</div>
          </div>
          <span style="font-size:0.68rem;font-weight:700;color:${summaryColor}">${summaryText}</span>
        </div>
        ${instRows}
      </div>`;
  }).join('');

  return `
    <div style="padding-top:8px">
      <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">
        팀원별 평가 인스턴스 현황 · 진행 중인 인스턴스에 평가자를 배정하세요
      </div>
      ${employees.length === 0
        ? '<div class="empty-state" style="padding:40px 0"><div class="empty-state-icon">📊</div><div class="empty-state-title">팀원이 없습니다</div></div>'
        : cards}
    </div>`;
}

// ── 팀원 카드 ────────────────────────────────────────────────────

function memberCard(emp, risk, instances = []) {
  const enpsHistory = emp.enpsHistory || emp.enps_history || [];
  const enpsLatest  = enpsHistory.slice(-1)[0];
  const enpsColor   = enpsLatest == null ? 'var(--text-muted)'
    : enpsLatest >= 8 ? 'var(--success)' : enpsLatest >= 6 ? 'var(--warning)' : 'var(--danger)';
  const avatar     = emp.avatar || '👤';
  const name       = emp.name || emp.name_ko || '미상';
  const level      = emp.level || emp.level_code || '-';
  const dept       = emp.dept || emp.department || '';
  const roleLabel  = dept ? `${esc(emp.role)} · ${esc(dept)} · ${level}` : level;
  const compScore  = (emp.competencyScore || 0).toFixed(1);
  const tenureVal  = emp.tenure ?? ((emp.yrs || emp.years_experience || 0) * 12);

  // eNPS 스파크라인
  const sparkline  = enpsHistory.length >= 2 ? _sparkline(enpsHistory.slice(-5), 56, 18) : null;

  // Assessment status badge
  const TERM = new Set(['completed','calibrated','approved','finalized','cancelled']);
  const DONE = new Set(['completed','calibrated','approved','finalized']);
  const activeInst = instances.filter(i => !TERM.has(i.status)).length;
  const doneInst   = instances.filter(i => DONE.has(i.status)).length;
  const assessBadge = instances.length === 0
    ? `<span style="font-size:0.68rem;color:var(--text-muted)">평가 없음</span>`
    : activeInst > 0
    ? `<span style="font-size:0.68rem;font-weight:700;color:var(--primary)">⏳ ${activeInst}건 진행 중</span>`
    : `<span style="font-size:0.68rem;font-weight:700;color:var(--success)">✓ ${doneInst}건 완료</span>`;

  return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);
                padding:14px;margin-bottom:10px;border-left:3px solid ${RISK_COLOR[risk.level]}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div>
          <div style="font-weight:700;font-size:0.9rem">${avatar} ${esc(name)}</div>
          <div style="font-size:0.72rem;color:var(--text-muted)">${roleLabel}</div>
        </div>
        <span style="font-size:0.7rem;font-weight:700;color:${RISK_COLOR[risk.level]};
                     background:${RISK_COLOR[risk.level]}15;padding:2px 8px;border-radius:99px">
          ${RISK_LABEL[risk.level]}
        </span>
      </div>

      <!-- 지표 한 줄 -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
        ${statChip('역량점수', compScore + '점', 'var(--primary)')}
        <div style="background:var(--bg);border-radius:var(--radius-sm);padding:6px;text-align:center">
          <div style="font-size:0.62rem;color:var(--text-muted)">eNPS</div>
          <div style="display:flex;align-items:center;justify-content:center;gap:4px;margin-top:1px">
            <span style="font-size:0.88rem;font-weight:700;color:${enpsColor}">${enpsLatest ?? '-'}</span>
            ${sparkline ? `<svg viewBox="0 0 56 18" style="width:40px;height:14px;flex-shrink:0">${sparkline}</svg>` : ''}
          </div>
        </div>
        ${statChip('재직', tenureVal + '개월', 'var(--text-muted)')}
      </div>

      <!-- 평가 상태 -->
      <div style="margin-bottom:8px;display:flex;align-items:center;gap:6px">
        <span style="font-size:0.62rem;color:var(--text-muted)">평가</span>
        ${assessBadge}
      </div>

      <!-- 위험 신호 -->
      ${risk.signals.length > 0 ? `
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">
          ${risk.signals.map(s => `<span style="font-size:0.67rem;background:var(--bg);
            border:1px solid var(--border);padding:2px 6px;border-radius:99px;color:var(--text-muted)">${s}</span>`).join('')}
        </div>` : ''}

      <!-- 액션 버튼 -->
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${risk.level !== 'LOW' ? `
          <button class="btn btn-ghost btn-sm member-action-btn"
            data-action="1:1" data-name="${esc(name)}"
            style="font-size:0.72rem;padding:4px 10px;color:var(--primary);border-color:var(--primary)30">
            💬 1:1 면담
          </button>
          <button class="btn btn-ghost btn-sm member-action-btn"
            data-action="idp" data-name="${esc(name)}"
            style="font-size:0.72rem;padding:4px 10px;color:var(--text-muted)">
            📝 IDP 확인
          </button>` : `
          <span style="font-size:0.72rem;color:var(--success)">✅ 안정 상태</span>`}
      </div>
    </div>`;
}

// ── eNPS 스파크라인 SVG ─────────────────────────────────────────

function _sparkline(values, W = 56, H = 18) {
  if (!values || values.length < 2) return '';
  const nums = values.map(Number).filter(v => !isNaN(v));
  if (nums.length < 2) return '';
  const minV = Math.min(...nums);
  const maxV = Math.max(...nums);
  const range = maxV - minV || 1;
  const xOf = i => (i / (nums.length - 1)) * W;
  const yOf = v => H - ((v - minV) / range) * (H - 2) - 1;
  const path = nums.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');
  const last = nums[nums.length - 1];
  const prev = nums[nums.length - 2];
  const color = last >= prev ? 'var(--success)' : 'var(--danger)';
  return `<path d="${path}" fill="none" stroke="${color}" stroke-width="1.8"
            stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
          <circle cx="${xOf(nums.length-1).toFixed(1)}" cy="${yOf(last).toFixed(1)}"
                  r="2.2" fill="${color}"/>`;
}

// ── 헬퍼 ────────────────────────────────────────────────────────

function miniCard(label, value, color) {
  return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);
                padding:10px;text-align:center">
      <div style="font-size:0.62rem;color:var(--text-muted);margin-bottom:2px">${label}</div>
      <div style="font-size:1.2rem;font-weight:800;color:${color}">${value}</div>
    </div>`;
}

function statChip(label, value, color) {
  return `
    <div style="background:var(--bg);border-radius:var(--radius-sm);padding:6px;text-align:center">
      <div style="font-size:0.62rem;color:var(--text-muted)">${label}</div>
      <div style="font-size:0.88rem;font-weight:700;color:${color}">${value}</div>
    </div>`;
}

function getPendingTasks(employees) {
  const now = Date.now();
  const DAY = 1000 * 60 * 60 * 24;
  const tasks = [];

  employees.forEach(emp => {
    const assessDays = emp.lastAssessmentDate
      ? Math.floor((now - new Date(emp.lastAssessmentDate).getTime()) / DAY) : 999;
    const idpDays = emp.lastIdpUpdate
      ? Math.floor((now - new Date(emp.lastIdpUpdate).getTime()) / DAY) : 999;
    const enps = (emp.enpsHistory || []).slice(-1)[0];
    const name = emp.name || emp.name_ko || '?';

    const empId = emp.id || emp.user_id;
    if (assessDays > 180) {
      tasks.push({
        empId, empName: name, icon: '🔬',
        task: '역량 진단 미실시',
        desc: `${Math.round(assessDays / 30)}개월째 미실시`,
        urgency: assessDays > 270 ? '즉시' : '이번 달',
        urgentColor: assessDays > 270 ? 'var(--danger)' : 'var(--warning)',
      });
    }
    if (idpDays > 120) {
      tasks.push({
        empId, empName: name, icon: '📝',
        task: 'IDP 미갱신',
        desc: `${Math.round(idpDays / 30)}개월째 업데이트 없음`,
        urgency: '이번 달',
        urgentColor: 'var(--warning)',
      });
    }
    if (enps !== undefined && enps !== null && Number(enps) <= 4) {
      tasks.push({
        empId, empName: name, icon: '💬',
        task: '1:1 면담 권장',
        desc: `eNPS ${enps}점 — 즉각 소통 필요`,
        urgency: '즉시',
        urgentColor: 'var(--danger)',
      });
    }
  });

  return tasks.sort((a, b) => (a.urgency === '즉시' ? -1 : 1));
}

const _EVAL_LABELS = { self: '자기평가', manager: '상사평가', peer: '동료평가', subordinate: '부하평가', customer: '고객평가' };

function renderMyEvalAssignments(tasks) {
  const pending = (tasks || []).filter(a => a.assignment_status === 'pending');
  if (!pending.length) return '';

  const rows = pending.map(a => {
    const label = _EVAL_LABELS[a.evaluator_type] || a.evaluator_type || '평가';
    const due   = a.end_date
      ? `<span style="color:var(--warning);font-weight:600"> · ${new Date(a.end_date).toLocaleDateString('ko')}</span>`
      : '';
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer"
           onclick="window.appState=window.appState||{};window.appState.instanceId='${a.instance_id||''}';window.appState.evaluatorMode=true;window.appState.evaluatorType='${a.evaluator_type||'manager'}';window.appState.subjectName='${(a.subject_name||'').replace(/'/g,'')}';window.location.hash='#/assessment'">
        <div style="font-size:1.1rem;flex-shrink:0">👤</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.84rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${a.subject_name || '대상자'} 님 · ${a.cycle_name || '역량 진단'}
          </div>
          <div style="font-size:0.73rem;color:var(--text-muted)">
            <span style="background:#EFF6FF;color:#3B82F6;padding:1px 6px;border-radius:8px;font-weight:600">${label}</span>${due}
          </div>
        </div>
        <div style="font-size:0.8rem;color:var(--primary);font-weight:700;flex-shrink:0">평가 →</div>
      </div>`;
  }).join('');

  return `
    <div style="background:#FFF7ED;border:1.5px solid var(--warning,#F59E0B);border-radius:10px;
                margin-bottom:16px;overflow:hidden">
      <div style="padding:10px 14px;display:flex;align-items:center;justify-content:space-between;
                  border-bottom:1px solid rgba(245,158,11,0.2)">
        <div style="font-size:0.88rem;font-weight:700;color:#92400E">⚡ 내 평가 배정 (${pending.length}건)</div>
        <div style="font-size:0.72rem;color:#92400E;font-weight:600">즉시 완료 필요</div>
      </div>
      ${rows}
    </div>`;
}

function renderPendingSection(pending) {
  if (!pending.length) return `
    <div style="display:flex;align-items:center;gap:10px;padding:14px 16px;background:var(--surface);
                border-radius:var(--radius-md);border:1px solid var(--border);margin-bottom:16px">
      <span style="font-size:1.3rem">✅</span>
      <div style="font-size:0.84rem;font-weight:600;color:var(--success)">조치 필요 과제 없음</div>
    </div>`;

  return `
    <div style="background:var(--card-bg);border-radius:10px;border:1px solid var(--border);
                box-shadow:0 1px 4px rgba(0,0,0,0.06);margin-bottom:16px;overflow:hidden">
      <!-- 헤더 (클릭하면 접기) -->
      <div id="pending-header" style="display:flex;align-items:center;justify-content:space-between;
           padding:12px 16px;cursor:pointer;background:#FFFBEB;border-bottom:1px solid #FDE68A;">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:1rem">⚠️</span>
          <span style="font-size:0.88rem;font-weight:700;color:#92400E">조치 필요 과제</span>
          <span style="font-size:0.72rem;padding:2px 8px;border-radius:99px;background:#FEF3C7;
                       color:#D97706;font-weight:700">${pending.length}건</span>
        </div>
        <span id="pending-toggle-icon" style="font-size:0.7rem;color:#92400E">▼</span>
      </div>
      <!-- 과제 목록 (접기 가능) -->
      <div id="pending-body">
        ${pending.map((p, i) => `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;
                      border-bottom:${i < pending.length - 1 ? '1px solid var(--border)' : 'none'};
                      background:${p.urgency === '즉시' ? '#FEF2F2' : '#fff'}">
            <span style="font-size:1rem;flex-shrink:0">${p.icon}</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:0.82rem;font-weight:600;color:var(--text)">
                ${esc(p.empName)} · ${esc(p.task)}
              </div>
              <div style="font-size:0.7rem;color:var(--text-muted);margin-top:1px">${esc(p.desc)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
              <span style="font-size:0.68rem;color:${p.urgentColor};font-weight:700">${p.urgency}</span>
              <button class="task-push-btn"
                data-emp-id="${esc(p.empId || '')}"
                data-emp-name="${esc(p.empName)}"
                data-task="${esc(p.task)}"
                style="font-size:0.66rem;padding:3px 8px;border-radius:6px;border:1px solid ${p.urgentColor};
                       color:${p.urgentColor};background:transparent;cursor:pointer;white-space:nowrap;
                       font-weight:600;">
                🔔 요청
              </button>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

// ── 조직도 뷰 ────────────────────────────────────────────────────

function renderOrgChart(employees, instanceMap, pending) {
  // ── 리스크 색상 ──────────────────────────────────────────────
  const RISK_BG     = { HIGH:'#FEF2F2', MEDIUM:'#FFFBEB', LOW:'#F0FDF4' };
  const RISK_BORDER = { HIGH:'#FCA5A5', MEDIUM:'#FDE68A', LOW:'#6EE7B7' };
  const RISK_BADGE  = { HIGH:'🔴', MEDIUM:'🟡', LOW:'🟢' };

  // ── 리스크 계산 (retention util 대신 간단히 직접 계산) ────────
  const now = Date.now(); const DAY = 86400000;
  function empRisk(e) {
    const ad = e.lastAssessmentDate ? Math.floor((now - new Date(e.lastAssessmentDate).getTime()) / DAY) : 999;
    const enps = (e.enpsHistory||[]).slice(-1)[0];
    if (ad > 270 || (enps != null && Number(enps) <= 3)) return 'HIGH';
    if (ad > 180 || (enps != null && Number(enps) <= 5)) return 'MEDIUM';
    return 'LOW';
  }

  // ── 과제 인덱스 ──────────────────────────────────────────────
  const pendingByEmp = {};
  pending.forEach(p => {
    if (!pendingByEmp[p.empName]) pendingByEmp[p.empName] = [];
    pendingByEmp[p.empName].push(p);
  });

  // ── 노드 카드 렌더 ───────────────────────────────────────────
  function orgNodeCard(emp, isRoot = false) {
    const empId    = emp.id || emp.user_id || emp.id;
    const name     = emp.name || emp.name_ko || '?';
    const role     = emp.role || '';
    const level    = emp.level || '';
    const dept     = emp.dept || emp.department || '';
    const avatar   = emp.avatar || '👤';
    const dColor   = emp.dept_color || 'var(--text-muted)';
    const compScore= (emp.competencyScore || 0).toFixed(1);
    const enps     = (emp.enpsHistory||[]).slice(-1)[0];
    const risk     = isRoot ? 'LOW' : empRisk(emp);
    const issues   = pendingByEmp[name] || [];

    const bgCol    = isRoot ? '#EEF2FF' : RISK_BG[risk];
    const borderCol= isRoot ? '#C7D2FE' : RISK_BORDER[risk];

    const chipHtml = issues.slice(0, 2).map(p =>
      `<span style="font-size:0.58rem;padding:1px 5px;border-radius:99px;background:${p.urgentColor}18;
               color:${p.urgentColor};border:1px solid ${p.urgentColor}40;white-space:nowrap">${p.icon}</span>`
    ).join('');

    return `
      <div class="org-node" data-emp-id="${esc(empId)}" data-emp-name="${esc(name)}"
        style="display:inline-flex;flex-direction:column;align-items:center;
               background:${bgCol};border:2px solid ${borderCol};border-radius:12px;
               min-width:90px;max-width:110px;cursor:pointer;overflow:hidden;
               box-shadow:0 1px 4px rgba(0,0,0,0.08);position:relative;flex-shrink:0">
        <!-- 부서 컬러 바 -->
        <div style="width:100%;height:5px;background:${dColor}"></div>
        <div style="padding:8px 8px 7px;display:flex;flex-direction:column;align-items:center;gap:3px;width:100%">
          <!-- 아바타 + 리스크 뱃지 -->
          <div style="position:relative;line-height:1">
            <span style="font-size:1.7rem">${avatar}</span>
            ${!isRoot ? `<span style="position:absolute;bottom:-2px;right:-6px;font-size:0.65rem">${RISK_BADGE[risk]}</span>` : ''}
          </div>
          <!-- 이름 -->
          <div style="font-size:0.78rem;font-weight:700;color:var(--text);text-align:center;
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;padding:0 4px">${esc(name)}</div>
          <!-- 역할 -->
          <div style="font-size:0.6rem;color:var(--text-muted);text-align:center;line-height:1.3;
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;padding:0 4px">${esc(role || level)}</div>
          <!-- KPI -->
          <div style="display:flex;gap:5px;margin-top:2px">
            <span style="font-size:0.6rem;color:var(--primary);font-weight:700">${compScore}</span>
            ${enps != null ? `<span style="font-size:0.6rem;color:${Number(enps)>=7?'#059669':Number(enps)>=5?'#D97706':'#EF4444'};font-weight:700">e${enps}</span>` : ''}
          </div>
          ${chipHtml ? `<div style="display:flex;gap:3px;flex-wrap:wrap;justify-content:center">${chipHtml}</div>` : ''}
        </div>
      </div>`;
  }

  // ── 트리 구조 구성 ───────────────────────────────────────────
  // 루트 = MGR_NODE (팀장)
  const root = MGR_NODE || { id:'EMP_MGR', name:'팀장', role:'HR팀장', dept:'HR본부', dept_color:'#4F46E5', avatar:'🧑‍💼' };
  const empMap = {};
  (employees||[]).forEach(e => { empMap[e.id || e.user_id] = e; });

  // Level 1: reports_to === root.id
  const lv1 = (employees||[]).filter(e => (e.reports_to === root.id) || (!e.reports_to));
  // Level 2: reports_to는 lv1 중 하나
  const lv1Ids = new Set(lv1.map(e => e.id || e.user_id));
  const lv2By = {}; // parent_id → [children]
  (employees||[]).forEach(e => {
    if (e.reports_to && lv1Ids.has(e.reports_to)) {
      if (!lv2By[e.reports_to]) lv2By[e.reports_to] = [];
      lv2By[e.reports_to].push(e);
    }
  });

  // ── 레벨2 서브트리 렌더 ──────────────────────────────────────
  function renderSubtree(parent) {
    const children = lv2By[parent.id || parent.user_id] || [];
    const parentCard = orgNodeCard(parent);
    if (!children.length) return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:0">
        ${parentCard}
      </div>`;

    const childrenHtml = children.map(c => `
      <div style="display:flex;flex-direction:column;align-items:center;">
        <!-- 수직선 아래 -->
        <div style="width:2px;height:14px;background:#CBD5E1"></div>
        ${orgNodeCard(c)}
      </div>`).join('');

    return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:0">
        ${parentCard}
        <!-- 수직선 -->
        <div style="width:2px;height:14px;background:#CBD5E1"></div>
        <!-- 자식 가로 묶음 -->
        <div style="display:flex;align-items:flex-start;gap:10px;position:relative">
          <!-- 수평 연결선 -->
          ${children.length > 1 ? `
          <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);
                      height:2px;background:#CBD5E1;
                      width:calc(100% - 40px);"></div>` : ''}
          ${childrenHtml}
        </div>
      </div>`;
  }

  // ── 전체 트리 렌더 ───────────────────────────────────────────
  const lv1Html = lv1.map(e => renderSubtree(e)).join('');

  return `
    <div style="overflow-x:auto;padding-bottom:8px;">
      <!-- 범례 -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:0.68rem;color:var(--text-muted);
                  margin-bottom:12px;padding:8px 0">
        <span>🔴 고위험</span><span>🟡 관찰</span><span>🟢 안정</span>
        <span>· 카드 탭→코칭 노트</span>
      </div>

      <!-- 루트 (팀장) -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:0;min-width:max-content">
        ${orgNodeCard(root, true)}
        <!-- 루트 → lv1 수직선 -->
        <div style="width:2px;height:18px;background:#CBD5E1"></div>
        <!-- lv1 수평 브랜치 -->
        <div style="position:relative;display:flex;align-items:flex-start;gap:14px">
          ${lv1.length > 1 ? `
          <div style="position:absolute;top:0;left:0;right:0;height:2px;background:#CBD5E1"></div>` : ''}
          ${lv1Html}
        </div>
      </div>
    </div>
  `;
}

function renderReviewStatus(employees, teamReviews) {
  const allReviews = (() => {
    try { return [...(Array.isArray(teamReviews) ? teamReviews : []), ...JSON.parse(localStorage.getItem('hr_perf_reviews') || '[]')]; }
    catch { return []; }
  })();

  const CYCLES = ['H1', 'H2', 'ANNUAL'];
  const CYCLE_LABEL = { H1: '상반기', H2: '하반기', ANNUAL: '연간' };
  const year = new Date().getFullYear();

  // Build completion map: empId → { cycle → reviewerType[] }
  const completedMap = {};
  allReviews.forEach(r => {
    const uid = r.userId || r.user_id;
    if (!uid) return;
    if (!completedMap[uid]) completedMap[uid] = {};
    const cycle = r.cycle || 'H1';
    if (!completedMap[uid][cycle]) completedMap[uid][cycle] = new Set();
    completedMap[uid][cycle].add(r.reviewerType || 'self');
  });

  const RTYPE_LABEL = { self: '자기평가', manager: '상사', peer: '동료' };
  const RTYPE_COL   = { self: '#4F46E5', manager: '#059669', peer: '#D97706' };

  const rows = employees.map(emp => {
    const empId = emp.id || emp.user_id;
    const name  = emp.name || emp.name_ko || '팀원';
    const doneMap = completedMap[empId] || {};

    const cols = CYCLES.map(cycle => {
      const done = doneMap[cycle] || new Set();
      if (done.size === 0) return `<td style="text-align:center;padding:8px 6px;"><span style="font-size:0.7rem;color:var(--text-muted);">미완료</span></td>`;
      const chips = [...done].map(t =>
        `<span style="font-size:0.62rem;padding:1px 6px;border-radius:99px;background:${RTYPE_COL[t]}18;color:${RTYPE_COL[t]};border:1px solid ${RTYPE_COL[t]}30;white-space:nowrap;">${RTYPE_LABEL[t]||t}</span>`
      ).join(' ');
      return `<td style="text-align:center;padding:8px 6px;">${chips}</td>`;
    }).join('');

    const hasAll = CYCLES.every(c => (doneMap[c] || new Set()).size > 0);
    const hasSelf = CYCLES.some(c => (doneMap[c] || new Set()).has('self'));

    return `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:10px 8px;">
          <div style="font-size:0.82rem;font-weight:600;color:var(--text)">${esc(name)}</div>
          <div style="font-size:0.68rem;color:var(--text-muted)">${esc(emp.dept||emp.department||emp.level||'')}</div>
        </td>
        ${cols}
        <td style="padding:8px 6px;text-align:center;">
          <button class="remind-btn" data-emp-id="${esc(empId)}" data-emp-name="${esc(name)}"
            style="font-size:0.68rem;padding:4px 8px;border-radius:6px;border:1px solid var(--border);
                   background:${hasSelf?'#F0FDF4':'#FEF2F2'};color:${hasSelf?'#059669':'#EF4444'};
                   cursor:pointer;white-space:nowrap;">
            ${hasSelf ? '✓ 완료' : '🔔 요청'}
          </button>
        </td>
      </tr>`;
  }).join('');

  return `
    <div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin:12px 0 8px;font-weight:600">${year}년 성과 리뷰 제출 현황</div>
      <div style="overflow-x:auto;border:1px solid var(--border);border-radius:10px;background:var(--card-bg);">
        <table style="width:100%;border-collapse:collapse;font-size:0.8rem;min-width:340px">
          <thead>
            <tr style="background:var(--bg);border-bottom:1.5px solid var(--border)">
              <th style="padding:10px 8px;text-align:left;font-size:0.72rem;color:var(--text-muted);font-weight:600">팀원</th>
              ${CYCLES.map(c => `<th style="padding:10px 6px;text-align:center;font-size:0.72rem;color:var(--text-muted);font-weight:600">${CYCLE_LABEL[c]}</th>`).join('')}
              <th style="padding:10px 6px;text-align:center;font-size:0.72rem;color:var(--text-muted);font-weight:600">액션</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;">🔔 요청 버튼을 누르면 해당 팀원에게 리뷰 작성 알림이 전송됩니다.</p>
    </div>
  `;
}

// ── 서베이 매트릭스 ────────────────────────────────────────────────

function _surveyHash(empId, surveyId) {
  let h = 0;
  for (const c of String(empId) + String(surveyId)) h = (h * 31 + c.charCodeAt(0)) & 0xFFFFFFFF;
  return Math.abs(h) % 100;
}

function _surveyStatus(empId, surveyId) {
  const v = _surveyHash(empId, surveyId);
  if (v < 55) return 'done';
  if (v < 72) return 'requested';
  return 'pending';
}

function renderSurveyMatrix(employees) {
  // 직원 대상 라이프사이클 서베이 중 phase별 최대 2개 선택
  const PHASE_ORDER = ['onboarding', 'performance', 'development', 'engagement'];
  const phaseCnt = {};
  const keySurveys = [];
  for (const s of (LIFECYCLE_SURVEYS || [])) {
    if (s.special_type) continue;
    if (s.audience !== 'employee' && s.audience !== 'both') continue;
    if (!PHASE_ORDER.includes(s.phase)) continue;
    const cnt = phaseCnt[s.phase] || 0;
    if (cnt < 2) { keySurveys.push(s); phaseCnt[s.phase] = cnt + 1; }
  }
  keySurveys.sort((a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase));

  if (!keySurveys.length) return '<p style="color:var(--text-muted);font-size:0.85rem;padding:20px 0;">서베이 데이터가 없습니다.</p>';

  // 컬럼 헤더
  const headerCols = keySurveys.map(s => {
    const phase = (LIFECYCLE_PHASES || []).find(p => p.id === s.phase);
    const doneN  = employees.filter(e => _surveyStatus(e.id || e.user_id, s.id) === 'done').length;
    return `
      <th style="min-width:68px;padding:8px 4px 6px;text-align:center;vertical-align:bottom;
        border-bottom:2px solid ${phase?.color || 'var(--border)'};
        background:${phase ? phase.color + '0d' : 'var(--bg)'};font-weight:600;">
        <div style="font-size:1rem;margin-bottom:3px;">${esc(s.icon || '📋')}</div>
        <div style="font-size:0.58rem;color:${phase?.color || 'var(--text-muted)'};font-weight:700;
          line-height:1.3;word-break:keep-all;padding:0 2px;">
          ${esc(s.name_ko.length > 9 ? s.name_ko.slice(0, 8) + '…' : s.name_ko)}
        </div>
        <div style="font-size:0.58rem;color:var(--text-muted);margin-top:3px;">
          ${doneN}/${employees.length}명
        </div>
      </th>`;
  }).join('');

  // 직원 행
  const rows = employees.map(emp => {
    const empId  = emp.id || emp.user_id || emp.email || '';
    const name   = emp.name_ko || emp.name || '팀원';
    const role   = emp.role || emp.dept || '';
    const doneN  = keySurveys.filter(s => _surveyStatus(empId, s.id) === 'done').length;
    const pct    = Math.round((doneN / keySurveys.length) * 100);

    const cells = keySurveys.map(s => {
      const status = _surveyStatus(empId, s.id);
      if (status === 'done') {
        return `<td style="text-align:center;padding:10px 4px;"><span style="font-size:1.1rem;">✅</span></td>`;
      }
      if (status === 'requested') {
        return `<td style="text-align:center;padding:10px 4px;">
          <span style="font-size:0.65rem;padding:2px 6px;border-radius:20px;
            background:#FEF3C7;color:#D97706;font-weight:700;">요청중</span>
        </td>`;
      }
      return `<td style="text-align:center;padding:10px 4px;">
        <button class="survey-req-btn"
          data-emp-id="${esc(empId)}"
          data-emp-name="${esc(name)}"
          data-survey-id="${esc(s.id)}"
          data-survey-name="${esc(s.name_ko)}"
          style="font-size:0.68rem;padding:3px 8px;border-radius:6px;
            border:1.5px solid var(--border);background:var(--surface);
            color:var(--text-muted);cursor:pointer;white-space:nowrap;
            transition:all 120ms;">
          요청
        </button>
      </td>`;
    }).join('');

    return `
      <tr style="border-bottom:1px solid var(--border);">
        <td style="padding:10px 12px;position:sticky;left:0;background:var(--surface);
          z-index:1;border-right:1px solid var(--border);min-width:100px;">
          <div style="font-size:0.85rem;font-weight:700;color:var(--text);">${esc(name)}</div>
          <div style="font-size:0.68rem;color:var(--text-muted);margin-top:1px;">${esc(role)}</div>
          <div style="display:flex;align-items:center;gap:5px;margin-top:5px;">
            <div style="flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:#4F46E5;border-radius:2px;"></div>
            </div>
            <span style="font-size:0.6rem;color:var(--text-muted);white-space:nowrap;">${doneN}/${keySurveys.length}</span>
          </div>
        </td>
        ${cells}
      </tr>`;
  }).join('');

  return `
    <div style="margin-bottom:14px;">
      <div style="font-size:0.82rem;font-weight:700;color:var(--text);margin-bottom:4px;">
        🗳️ 팀 서베이 참여 매트릭스
      </div>
      <div style="font-size:0.72rem;color:var(--text-muted);">
        ✅ 완료 &nbsp;·&nbsp; <span style="color:#D97706;font-weight:600;">요청중</span> &nbsp;·&nbsp; 요청 버튼 = 참여 독려
      </div>
    </div>

    <div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--surface);">
      <table style="border-collapse:collapse;width:max-content;min-width:100%;">
        <thead>
          <tr style="border-bottom:1px solid var(--border);">
            <th style="padding:10px 12px;text-align:left;font-size:0.75rem;font-weight:700;
              color:var(--text);white-space:nowrap;position:sticky;left:0;background:var(--bg);
              z-index:2;border-right:1px solid var(--border);border-bottom:2px solid var(--border);">
              팀원
            </th>
            ${headerCols}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <p style="font-size:0.7rem;color:var(--text-muted);margin-top:10px;">
      🔔 "요청" 버튼을 누르면 해당 팀원에게 서베이 참여 알림이 전송됩니다.
    </p>
  `;
}

function bindSurveyReqBtns(root) {
  root.querySelectorAll('.survey-req-btn').forEach(btn => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      const { empName, surveyName, empId, surveyId } = btn.dataset;
      btn.textContent      = '요청됨';
      btn.style.background = '#FEF3C7';
      btn.style.color      = '#D97706';
      btn.style.borderColor= '#FDE68A';
      btn.style.fontWeight = '700';
      btn.disabled         = true;

      showToast(`${empName}님에게 "${surveyName}" 참여 요청을 보냈습니다.`, 'success')
    addNotification({ type: 'success', title: '관리자', body: '님에게 "" 참여 요청을 보냈습니다.' });
      addNotification({
        type: 'survey_request',
        title: '서베이 참여 요청 발송',
        body: `${empName}님에게 "${surveyName}" 서베이 참여 요청이 전송되었습니다.`,
        time: new Date().toISOString(),
      });
    });
  });
}

// ── 팀원 1:1 현황 대시보드 ──────────────────────────────────────

function renderTeamOneOnOne(employees) {
  let allMeetings = [];
  try { allMeetings = JSON.parse(localStorage.getItem('hr_one_on_ones') || '[]'); } catch {}

  const today = new Date();
  const thirtyDaysAgo = new Date(today - 30 * 86400000);
  const sevenDaysLater = new Date(today.getTime() + 7 * 86400000);

  const rows = employees.map(emp => {
    const empId = emp.id || emp.user_id;
    const name  = emp.name_ko || emp.name || '팀원';
    const myWith = allMeetings.filter(m =>
      (m.userId === empId || m.partnerId === empId || m.partnerName === name)
    );
    const recent = myWith.filter(m => m.date && new Date(m.date) >= thirtyDaysAgo);
    const upcoming = myWith.filter(m => {
      if (!m.scheduledAt && !m.nextDate) return false;
      const d = new Date(m.scheduledAt || m.nextDate);
      return d >= today && d <= sevenDaysLater;
    });
    const lastMeeting = myWith
      .filter(m => m.date && new Date(m.date) <= today)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    const pendingActions = myWith.flatMap(m => (m.actionItems || []).filter(ai => !ai.done)).length;

    const daysSince = lastMeeting
      ? Math.floor((today - new Date(lastMeeting.date)) / 86400000)
      : null;
    const statusColor = daysSince === null ? 'var(--text-muted)'
      : daysSince <= 14 ? '#059669'
      : daysSince <= 30 ? '#D97706'
      : '#DC2626';
    const statusLabel = daysSince === null ? '기록 없음'
      : daysSince === 0 ? '오늘'
      : `${daysSince}일 전`;

    return { name, empId, recent: recent.length, upcoming: upcoming.length, lastMeeting, daysSince, statusColor, statusLabel, pendingActions };
  });

  const noData = rows.every(r => r.lastMeeting == null && r.recent === 0);

  const summaryDone   = rows.filter(r => r.daysSince !== null && r.daysSince <= 14).length;
  const summaryAt     = rows.filter(r => r.daysSince !== null && r.daysSince > 14 && r.daysSince <= 30).length;
  const summaryOver   = rows.filter(r => r.daysSince === null || r.daysSince > 30).length;
  const summaryUpcoming = rows.reduce((s, r) => s + r.upcoming, 0);

  return `
<div style="padding:14px 14px 0">
  <!-- KPI 요약 카드 -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;text-align:center">
      <div style="font-size:1.4rem;font-weight:800;color:#059669">${summaryDone}</div>
      <div style="font-size:0.68rem;color:var(--text-muted)">14일 내 완료</div>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;text-align:center">
      <div style="font-size:1.4rem;font-weight:800;color:#D97706">${summaryAt}</div>
      <div style="font-size:0.68rem;color:var(--text-muted)">14~30일 경과</div>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;text-align:center">
      <div style="font-size:1.4rem;font-weight:800;color:#DC2626">${summaryOver}</div>
      <div style="font-size:0.68rem;color:var(--text-muted)">30일 초과/없음</div>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;text-align:center">
      <div style="font-size:1.4rem;font-weight:800;color:var(--primary)">${summaryUpcoming}</div>
      <div style="font-size:0.68rem;color:var(--text-muted)">7일 내 예정</div>
    </div>
  </div>

  ${noData ? `
  <div style="text-align:center;padding:40px 20px;color:var(--text-muted)">
    <div style="font-size:2.5rem;margin-bottom:12px">💬</div>
    <div style="font-weight:700;font-size:0.95rem;margin-bottom:6px">1:1 미팅 기록이 없습니다</div>
    <div style="font-size:0.8rem;margin-bottom:16px">팀원과의 1:1 미팅을 기록하면 현황이 표시됩니다.</div>
    <a href="#/one-on-one" style="display:inline-block;padding:8px 18px;background:var(--primary);color:#fff;border-radius:var(--radius-sm);font-size:0.82rem;font-weight:600;text-decoration:none">1:1 미팅 기록하기</a>
  </div>` : `
  <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">팀원별 1:1 현황 (최근 30일 기준)</div>
  <div style="display:flex;flex-direction:column;gap:8px">
    ${rows.map(r => `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 14px;
                display:flex;align-items:center;gap:12px">
      <div style="width:36px;height:36px;border-radius:50%;background:var(--primary-light);
                  display:flex;align-items:center;justify-content:center;font-size:0.9rem;font-weight:700;
                  color:var(--primary);flex-shrink:0">${esc(r.name.charAt(0))}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:0.88rem">${esc(r.name)}</div>
        <div style="font-size:0.74rem;color:var(--text-muted);margin-top:1px">
          최근 30일 ${r.recent}건
          ${r.pendingActions > 0 ? `· <span style="color:#D97706">액션 ${r.pendingActions}건 미완</span>` : ''}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:0.8rem;font-weight:700;color:${r.statusColor}">${esc(r.statusLabel)}</div>
        ${r.upcoming > 0
          ? `<div style="font-size:0.7rem;color:var(--primary);margin-top:2px">📅 ${r.upcoming}건 예정</div>`
          : `<a href="#/one-on-one" style="font-size:0.7rem;color:var(--primary);text-decoration:none">+ 일정 잡기</a>`
        }
      </div>
    </div>`).join('')}
  </div>`}
</div>`;
}
