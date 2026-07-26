/**
 * onboarding.js — 온보딩 체크리스트 (Phase 137)
 * Day1 / Week1 / Month1 단계별 탭 + 진행률 + growth_history 저장
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
import { api } from '../api.js';

const LS_TASKS    = 'hr_onboarding_tasks';
const LS_PROGRESS = 'hr_onboarding_progress';

// ── 단계별 태스크 정의 ──────────────────────────────────────
const STAGES = [
  {
    id: 'pre',
    label: '입사 전',
    icon: '📋',
    desc: '입사 전 필수 서류 제출',
    color: '#6366F1',
    bg: '#EEF2FF',
    tasks: [
      { id:'P01', label:'주민등록초본 제출',    category:'서류', required:true,  dueDay:0, docKey:'id_cert' },
      { id:'P02', label:'졸업(재학)증명서 제출', category:'서류', required:true,  dueDay:0, docKey:'diploma' },
      { id:'P03', label:'경력증명서 제출',       category:'서류', required:false, dueDay:0, docKey:'career_cert' },
      { id:'P04', label:'통장 사본 제출',        category:'서류', required:true,  dueDay:0, docKey:'bankbook' },
      { id:'P05', label:'가족관계증명서 제출',   category:'서류', required:false, dueDay:0, docKey:'family_cert' },
    ],
  },
  {
    id: 'day1',
    label: 'Day 1',
    icon: '🌅',
    desc: '입사 첫날 완료 필수',
    color: '#EF4444',
    bg: '#FEE2E2',
    tasks: [
      { id:'D01', label:'근로계약서 서명',      category:'법무', required:true,  dueDay:1 },
      { id:'D02', label:'사원증·PC 지급',        category:'총무', required:true,  dueDay:1 },
      { id:'D03', label:'업무 툴 계정 생성',     category:'IT',   required:true,  dueDay:1 },
      { id:'D04', label:'팀원 인사',             category:'팀',   required:false, dueDay:1 },
      { id:'D05', label:'자리 배정 확인',        category:'총무', required:false, dueDay:1 },
    ],
  },
  {
    id: 'week1',
    label: 'Week 1',
    icon: '🌿',
    desc: '첫 주 (7일 이내)',
    color: '#F59E0B',
    bg: '#FEF3C7',
    tasks: [
      { id:'W01', label:'4대보험 신고',           category:'법무', required:true,  dueDay:3 },
      { id:'W02', label:'보안 서약서 서명',        category:'법무', required:true,  dueDay:5 },
      { id:'W03', label:'법정교육 오리엔테이션',  category:'교육', required:true,  dueDay:5 },
      { id:'W04', label:'버디(멘토) 배정',        category:'HR',   required:true,  dueDay:3 },
      { id:'W05', label:'복리후생 안내',           category:'HR',   required:false, dueDay:7 },
      { id:'W06', label:'팀 소개 미팅',           category:'팀',   required:false, dueDay:7 },
      { id:'W07', label:'보안·개인정보 교육',     category:'교육', required:true,  dueDay:7 },
    ],
  },
  {
    id: 'month1',
    label: 'Month 1',
    icon: '🌳',
    desc: '30일 이내',
    color: '#10B981',
    bg: '#D1FAE5',
    tasks: [
      { id:'M01', label:'업무 목표(OKR) 설정',   category:'HR',   required:true,  dueDay:14 },
      { id:'M02', label:'멘토 1:1 미팅',          category:'HR',   required:false, dueDay:14 },
      { id:'M03', label:'부서 업무 파악 보고서',  category:'팀',   required:false, dueDay:21 },
      { id:'M04', label:'30일 체크인 면담',       category:'HR',   required:true,  dueDay:30 },
      { id:'M05', label:'필수 사내 시스템 숙지',  category:'IT',   required:true,  dueDay:21 },
      { id:'M06', label:'첫 번째 업무 결과물 제출', category:'팀', required:false, dueDay:30 },
    ],
  },
];

const ALL_TASKS = STAGES.flatMap(s => s.tasks.map(t => ({ ...t, stage: s.id })));

const CAT_COLOR = {
  '법무':'#EF4444', '총무':'#3B82F6', '교육':'#8B5CF6',
  'HR':'#10B981',   '팀':'#F59E0B',   'IT':'#06B6D4',
};

function _getUser() {
  try { return JSON.parse(localStorage.getItem('hr_user') || '{}'); } catch { return {}; }
}

function _empId() {
  const u = _getUser();
  if (u.id || u.userId) return u.id || u.userId;
  try { const s = JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId || s.userId || 'EMP001'; } catch { return 'EMP001'; }
}

function _hireDate() {
  const u = _getUser();
  // B-3: hr_user → hr_applicant_data → 오늘 날짜 순서로 fallback (하드코딩 제거)
  return u.hireDate
    || (() => { try { return JSON.parse(localStorage.getItem('hr_applicant_data') || '{}').hireDate; } catch { return null; } })()
    || new Date().toISOString().slice(0, 10);
}

function _getTasks() {
  return ALL_TASKS;
}

function _getProgress() {
  try {
    const all = JSON.parse(localStorage.getItem(LS_PROGRESS) || '{}');
    return all[_empId()] || {};
  } catch { return {}; }
}

function _saveProgress(prog) {
  try {
    const all = JSON.parse(localStorage.getItem(LS_PROGRESS) || '{}');
    all[_empId()] = prog;
    localStorage.setItem(LS_PROGRESS, JSON.stringify(all));
  } catch {}
}

function _daysSince() {
  const hire = _hireDate();
  return Math.max(0, Math.floor((Date.now() - new Date(hire)) / (1000*60*60*24)));
}

let _activeStage = 'day1';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _activeStage = 'day1';
  _render(root);
}

export function unmount() {}

function _render(root) {
  const tasks    = _getTasks();
  const progress = _getProgress();
  const daysSince = _daysSince();
  const hire     = _hireDate();

  const done   = tasks.filter(t => progress[t.id]?.done).length;
  const total  = tasks.length;
  const pct    = Math.round((done / total) * 100);

  const req     = tasks.filter(t => t.required);
  const reqDone = req.filter(t => progress[t.id]?.done).length;

  root.innerHTML = `
<div class="page" id="ob-page" style="background:var(--bg)">
  <div class="top-bar" style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="ob-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🎉 온보딩 체크리스트</div>
      <div style="font-size:11px;color:var(--text-muted)">입사 ${daysSince}일차 · 필수 ${reqDone}/${req.length}개 완료</div>
    </div>
  </div>

  <div class="page-content" style="padding:14px 16px">

    <!-- 전체 진행률 카드 -->
    <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border-radius:16px;
         padding:18px;margin-bottom:14px;color:#fff">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div>
          <div style="font-size:11px;opacity:0.8;margin-bottom:2px">전체 온보딩 진행률</div>
          <div style="font-size:34px;font-weight:900;line-height:1">${pct}<span style="font-size:18px">%</span></div>
        </div>
        <div style="font-size:44px">${pct===100?'🎊':daysSince<7?'🌱':'🌿'}</div>
      </div>
      <div style="background:rgba(255,255,255,0.25);border-radius:99px;height:8px;margin-bottom:8px">
        <div style="background:var(--card-bg);height:8px;border-radius:99px;width:${pct}%;transition:width 0.4s"></div>
      </div>
      <div style="display:flex;gap:12px;font-size:11px;opacity:0.85">
        <span>${done}/${total}개 완료</span>
        <span>·</span>
        <span>입사일 ${hire}</span>
        <span>·</span>
        <span>D+${daysSince}</span>
      </div>
    </div>

    <!-- 단계별 진행 요약 바 -->
    <div style="display:flex;gap:8px;margin-bottom:14px">
      ${STAGES.map(s => {
        const stageTasks = tasks.filter(t => t.stage === s.id);
        const stageDone  = stageTasks.filter(t => progress[t.id]?.done).length;
        const stagePct   = stageTasks.length ? Math.round(stageDone / stageTasks.length * 100) : 0;
        return `<div style="flex:1;background:var(--card-bg);border:1.5px solid ${_activeStage===s.id?s.color:'var(--border)'};
                     border-radius:12px;padding:10px 8px;text-align:center;cursor:pointer;transition:all 0.15s"
                     class="stage-tab" data-stage="${s.id}">
          <div style="font-size:18px">${s.icon}</div>
          <div style="font-size:11px;font-weight:700;margin:2px 0;color:${_activeStage===s.id?s.color:'var(--text)'}">${s.label}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:5px">${stageDone}/${stageTasks.length}</div>
          <div style="background:var(--border);border-radius:99px;height:4px">
            <div style="background:${s.color};height:4px;border-radius:99px;width:${stagePct}%;transition:width 0.3s"></div>
          </div>
        </div>`;
      }).join('')}
    </div>

    <!-- 활성 단계 태스크 목록 -->
    <div id="ob-task-list">
      ${_renderStage(STAGES.find(s => s.id === _activeStage), progress, daysSince)}
    </div>

  </div>
</div>`;

  _bindEvents(root, progress, daysSince);
}

function _renderStage(stage, progress, daysSince) {
  if (!stage) return '';

  const tasks  = stage.tasks;
  const done   = tasks.filter(t => progress[t.id]?.done).length;
  const pct    = tasks.length ? Math.round(done / tasks.length * 100) : 0;

  return `
<div style="background:var(--card-bg);border-radius:16px;border:1px solid var(--border);overflow:hidden">
  <!-- 섹션 헤더 -->
  <div style="background:${stage.bg};padding:14px 16px;border-bottom:1px solid ${stage.color}33">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:15px;font-weight:700;color:${stage.color}">${stage.icon} ${stage.label}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${stage.desc}</div>
      </div>
      <div style="font-size:22px;font-weight:900;color:${stage.color}">${pct}%</div>
    </div>
    <div style="background:rgba(255,255,255,0.5);border-radius:99px;height:6px;margin-top:10px">
      <div style="background:${stage.color};height:6px;border-radius:99px;width:${pct}%;transition:width 0.4s"></div>
    </div>
  </div>

  <!-- 태스크 목록 -->
  <div style="padding:8px 0">
    ${tasks.map(t => {
      const isDone   = progress[t.id]?.done;
      const doneAt   = progress[t.id]?.doneAt;
      const isOverdue = !isDone && t.dueDay < daysSince;
      const catColor  = CAT_COLOR[t.category] || 'var(--text-muted)';

      return `
<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;
     border-bottom:1px solid var(--border);opacity:${isDone?0.65:1}">
  <button class="ob-check" data-id="${t.id}" data-stage="${stage.id}"
    style="width:26px;height:26px;border-radius:50%;flex-shrink:0;cursor:pointer;
           border:2px solid ${isDone?stage.color:isOverdue?'#EF4444':'#CBD5E1'};
           background:${isDone?stage.color:'transparent'};
           display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px">
    ${isDone?'✓':''}
  </button>
  <div style="flex:1;min-width:0">
    <div style="font-size:13px;font-weight:${isDone?400:600};color:var(--text);
         text-decoration:${isDone?'line-through':'none'}">${t.label}</div>
    <div style="display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap">
      <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:6px;
        background:${catColor}22;color:${catColor}">${t.category}</span>
      <span style="font-size:10px;color:${isOverdue?'#EF4444':'var(--text-muted)'}">
        ${isOverdue?'⚠️ D+':'D+'}${t.dueDay} 이내${isOverdue?' 초과':''}
      </span>
      ${t.required ? `<span style="font-size:10px;color:#EF4444;font-weight:600">필수</span>` : ''}
    </div>
    ${isDone && doneAt ? `<div style="font-size:10px;color:#10B981;margin-top:2px">완료: ${doneAt.slice(0,10)}</div>` : ''}
  </div>
</div>`;
    }).join('')}
  </div>
</div>`;
}

function _bindEvents(root, progress, daysSince) {
  root.querySelector('#ob-back')?.addEventListener('click', () => window.navBack());

  // 단계 탭 전환
  root.querySelectorAll('.stage-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      _activeStage = tab.dataset.stage;
      _render(root);
    });
  });

  // 체크박스
  root.querySelectorAll('.ob-check').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id     = btn.dataset.id;
      const prog   = _getProgress();
      const wasDone = prog[id]?.done;

      prog[id] = { done: !wasDone, doneAt: !wasDone ? new Date().toISOString() : null };
      _saveProgress(prog);

      if (!wasDone) {
        const task = ALL_TASKS.find(t => t.id === id);
        showToast(`"${task?.label}" 완료!`, 'success');
        addNotification({ type: 'success', title: '온보딩', body: `"${task?.label}" 완료!` });

        // E-1: 입사 서류 항목 완료 시 HR 담당자에게 알림 + hr_submitted_docs 기록
        if (task?.docKey) {
          try {
            const docs = JSON.parse(localStorage.getItem('hr_submitted_docs') || '[]');
            const user = _getUser();
            docs.push({
              id:        'DOC_' + Date.now(),
              userId:    user.id || 'NEW',
              name:      user.name || '신규 입사자',
              docKey:    task.docKey,
              docLabel:  task.label,
              status:    'pending_review',
              submittedAt: new Date().toISOString(),
            });
            localStorage.setItem('hr_submitted_docs', JSON.stringify(docs));
            // HR 관리자 알림
            const notifs = JSON.parse(localStorage.getItem('hr_notifications') || '[]');
            notifs.unshift({
              id: 'NOTIF_DOC_' + Date.now(), type: 'action',
              title: `입사 서류 검토 요청 — ${task.label}`,
              body:  `${user.name || '신규 입사자'}님이 서류를 제출했습니다.`,
              link:  '#/admin', read: false, createdAt: new Date().toISOString(),
            });
            localStorage.setItem('hr_notifications', JSON.stringify(notifs));
          } catch {}
        }

        // Supabase growth_history 저장 (완료 시)
        const user = _getUser();
        if (user.id) {
          api.growth?.saveHistory?.({
            id: `onboarding_${id}_${user.id}`,
            date: new Date().toISOString().slice(0, 10),
            cycleName: `온보딩_${task?.stage || ''}`,
            final_score: null,
            final_rating: '온보딩완료',
            scores: { task_id: id, task_label: task?.label },
          }).catch(() => {});
        }

        // 전체 완료 체크
        const allTasks = _getTasks();
        const updatedProg = _getProgress();
        const allDone = allTasks.every(t => updatedProg[t.id]?.done);
        if (allDone) {
          addNotification({ type: 'success', title: '온보딩 완료', body: '온보딩 체크리스트를 모두 완료했습니다!' });
          showToast('온보딩 완료! 수고하셨습니다 🎊', 'success');

          // G-1: hr_user에 온보딩 완료 플래그 저장
          try {
            const hrUser = _getUser();
            if (!hrUser.onboarding_completed) {
              hrUser.onboarding_completed = true;
              hrUser.onboarding_completed_at = new Date().toISOString();
              localStorage.setItem('hr_user', JSON.stringify(hrUser));
              // HR 관리자에게 온보딩 완료 알림
              const notifs = JSON.parse(localStorage.getItem('hr_notifications') || '[]');
              notifs.unshift({
                id:        'NOTIF_ONBOARD_DONE_' + Date.now(),
                type:      'success',
                title:     `온보딩 완료 — ${hrUser.name || '신규 입사자'}`,
                body:      '모든 온보딩 항목을 완료했습니다. 인사 DB를 확정해 주세요.',
                link:      '#/admin',
                read:      false,
                createdAt: new Date().toISOString(),
              });
              localStorage.setItem('hr_notifications', JSON.stringify(notifs));
            }
          } catch {}
        }

        // 단계 완료 체크
        const stage = STAGES.find(s => s.id === btn.dataset.stage);
        if (stage) {
          const stageDoneNow = stage.tasks.every(t => updatedProg[t.id]?.done);
          if (stageDoneNow) {
            addNotification({ type: 'system', title: `🌟 ${stage.label} 온보딩 단계를 완료했습니다!`, body: '' });
          }
        }
      }

      _render(root);
    });
  });
}
