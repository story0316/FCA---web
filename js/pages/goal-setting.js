/**
 * goal-setting.js — OKR 목표 설정 (직원용)
 * Route: #/goal-setting
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_goals';

const PERIODS = ['2026-Q2', '2026-Q3', '2026-Q4'];

const STATUS_META = {
  active:    { label: '진행 중', bg: '#EEF2FF', color: '#4F46E5' },
  completed: { label: '완료',   bg: '#D1FAE5', color: '#059669' },
};

function _demoGoals() {
  const uid = _uid(); const name = _uname(); const dept = _udept();
  return [
    { id: `goal_${uid}_1`, empId: uid, empName: name, dept, title: '핵심 업무 역량 강화', period: '2026-Q2',
      keyResults: [
        { id: `kr_${uid}_1`, text: '핵심 프로젝트 성과 지표 20% 개선', progress: 75 },
        { id: `kr_${uid}_2`, text: '팀 내 지식 공유 세션 2회 진행', progress: 60 },
        { id: `kr_${uid}_3`, text: '분기 자기평가 완료', progress: 90 },
      ], status: 'active', createdAt: '2026-04-01T09:00:00Z' },
    { id: `goal_${uid}_2`, empId: uid, empName: name, dept, title: '개인 역량 개발 계획 달성', period: '2026-Q2',
      keyResults: [
        { id: `kr_${uid}_4`, text: '온라인 강의 2개 이수', progress: 50 },
        { id: `kr_${uid}_5`, text: '독서 기록 월 1권', progress: 33 },
      ], status: 'active', createdAt: '2026-04-02T10:00:00Z' },
  ];
}

function _load() {
  const demo = _demoGoals();
  try {
    const saved = JSON.parse(localStorage.getItem(LS) || '[]');
  if (!saved || !saved.length) { root.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:40px;margin-bottom:10px">🎯</div><div style="font-size:14px;font-weight:600;margin-bottom:4px">목표가 없습니다.</div><div style="font-size:12px;margin-bottom:14px">새 목표를 설정해 성장을 시작하세요.</div><button onclick="location.hash='#/goals'" style="padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">목표 설정</button></div>`; return; }
    return [...demo.filter(d => !saved.find(x => x.id === d.id)), ...saved];
  } catch { return [...demo]; }
}
function _save(list) {
  localStorage.setItem(LS, JSON.stringify(list));
  // goals.js / dashboard reads 'hr_okr_goals' — keep in sync
  localStorage.setItem('hr_okr_goals', JSON.stringify(list));
}
function _uid()  { try { return JSON.parse(localStorage.getItem('hr_session') || '{}').empId  || 'EMP001'; } catch { return 'EMP001'; } }
function _uname(){ try { return JSON.parse(localStorage.getItem('hr_session') || '{}').name   || '사용자'; } catch { return '사용자'; } }
function _udept(){ try { return JSON.parse(localStorage.getItem('hr_session') || '{}').dept   || '소속 미지정'; } catch { return '소속 미지정'; } }

let _tab = 'list';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'list';
  _draw(root);
}

export function unmount() { _tab = 'list'; }

function _draw(root) {
  const uid   = _uid();
  const mine  = _load().filter(g => g.empId === uid).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="gs-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🎯 목표 설정 (OKR)</div>
      <div style="font-size:11px;color:var(--text-muted)">내 목표 ${mine.length}개</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['list','내 목표'],['create','목표 등록']].map(([k,l]) => `
    <button class="gs-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab === 'list' ? _renderList(mine) : _renderCreate()}
  </div>
</div>`;

  root.querySelector('#gs-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.gs-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(root); }));

  if (_tab === 'create') {
    root.querySelector('#gs-submit-btn')?.addEventListener('click', () => _handleSubmit(root, uid));
  }

  if (_tab === 'list') {
    root.querySelectorAll('.gs-progress-input').forEach(input => {
      input.addEventListener('change', () => _updateProgress(input.dataset.goalId, input.dataset.krId, parseInt(input.value), root));
    });
  }
}

function _avg(krs) {
  if (!krs.length) return 0;
  return Math.round(krs.reduce((s, k) => s + (k.progress || 0), 0) / krs.length);
}

function _progressColor(pct) {
  if (pct >= 80) return '#059669';
  if (pct >= 50) return '#4F46E5';
  if (pct >= 30) return '#D97706';
  return '#EF4444';
}

function _renderList(mine) {
  if (!mine.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:48px;margin-bottom:12px">🎯</div>
  <div style="font-size:15px;font-weight:600;margin-bottom:6px">등록된 목표가 없어요</div>
  <div style="font-size:13px">목표를 등록하여 성장을 추적해 보세요.</div>
</div>`;

  return mine.map(g => {
    const overall = _avg(g.keyResults);
    const s = STATUS_META[g.status] || STATUS_META.active;
    const color = _progressColor(overall);

    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="flex:1;min-width:0;margin-right:10px">
      <div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:2px">${g.title}</div>
      <div style="font-size:11px;color:var(--text-muted)">${g.period} · 핵심결과 ${g.keyResults.length}개</div>
    </div>
    <span style="flex-shrink:0;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:600;
      background:${s.bg};color:${s.color}">${s.label}</span>
  </div>

  <div style="margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <span style="font-size:11px;color:var(--text-muted)">전체 진행률</span>
      <span style="font-size:13px;font-weight:800;color:${color}">${overall}%</span>
    </div>
    <div style="height:8px;background:#F1F5F9;border-radius:4px;overflow:hidden">
      <div style="height:100%;width:${overall}%;background:${color};border-radius:4px;transition:width 0.3s"></div>
    </div>
  </div>

  <div style="display:flex;flex-direction:column;gap:8px">
    ${g.keyResults.map(kr => {
      const krColor = _progressColor(kr.progress);
      return `
    <div style="background:#F8FAFC;border-radius:10px;padding:10px">
      <div style="font-size:12px;color:var(--text);margin-bottom:6px;line-height:1.4">${kr.text}</div>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="flex:1;height:6px;background:#E2E8F0;border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${kr.progress}%;background:${krColor};border-radius:3px;transition:width 0.3s"></div>
        </div>
        <input type="number" class="gs-progress-input" min="0" max="100"
          data-goal-id="${g.id}" data-kr-id="${kr.id}" value="${kr.progress}"
          style="width:52px;padding:3px 6px;border:1px solid var(--border);border-radius:6px;
                 font-size:11px;font-weight:700;text-align:center;background:var(--bg);color:${krColor}">
        <span style="font-size:11px;color:var(--text-muted)">%</span>
      </div>
    </div>`;
    }).join('')}
  </div>
</div>`;
  }).join('');
}

function _renderCreate() {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">목표명 (Objective) <span style="color:#EF4444">*</span></label>
    <input id="gs-title" type="text" placeholder="예: 백엔드 서비스 안정성 강화"
      style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);
             border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
  </div>

  <div style="margin-bottom:14px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">기간 <span style="color:#EF4444">*</span></label>
    <select id="gs-period"
      style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text)">
      ${PERIODS.map(p => `<option value="${p}">${p}</option>`).join('')}
    </select>
  </div>

  <div style="border-top:1px solid var(--border);padding-top:14px;margin-bottom:14px">
    <div style="font-size:12px;font-weight:700;color:#4F46E5;margin-bottom:10px">핵심결과 (Key Results)</div>

    <div style="margin-bottom:10px">
      <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">
        핵심결과 1 <span style="color:#EF4444">*</span>
      </label>
      <input id="gs-kr1" type="text" placeholder="예: API 응답 시간 평균 200ms 이하 달성"
        style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid var(--border);
               border-radius:10px;font-size:12px;background:var(--bg);color:var(--text)">
    </div>

    <div style="margin-bottom:10px">
      <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">
        핵심결과 2
      </label>
      <input id="gs-kr2" type="text" placeholder="예: 단위 테스트 커버리지 80% 이상"
        style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid var(--border);
               border-radius:10px;font-size:12px;background:var(--bg);color:var(--text)">
    </div>

    <div style="margin-bottom:4px">
      <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">
        핵심결과 3
      </label>
      <input id="gs-kr3" type="text" placeholder="예: 장애 발생 건수 전 분기 대비 50% 감소"
        style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid var(--border);
               border-radius:10px;font-size:12px;background:var(--bg);color:var(--text)">
    </div>
  </div>

  <button id="gs-submit-btn"
    style="width:100%;background:#4F46E5;color:#fff;border:none;border-radius:12px;
           padding:13px;font-size:14px;font-weight:700;cursor:pointer">목표 등록하기 🎯</button>
</div>`;
}

function _handleSubmit(root, uid) {
  const title  = root.querySelector('#gs-title')?.value.trim();
  const period = root.querySelector('#gs-period')?.value;
  const kr1    = root.querySelector('#gs-kr1')?.value.trim();
  const kr2    = root.querySelector('#gs-kr2')?.value.trim();
  const kr3    = root.querySelector('#gs-kr3')?.value.trim();

  if (!title) { showToast('목표명을 입력해 주세요.', 'error'); return; }
  if (!period){ showToast('기간을 선택해 주세요.', 'error'); return; }
  if (!kr1)   { showToast('핵심결과 1을 입력해 주세요.', 'error'); return; }

  const krs = [];
  if (kr1) krs.push({ id: 'kr_' + Date.now() + '_1', text: kr1, progress: 0 });
  if (kr2) krs.push({ id: 'kr_' + Date.now() + '_2', text: kr2, progress: 0 });
  if (kr3) krs.push({ id: 'kr_' + Date.now() + '_3', text: kr3, progress: 0 });

  const all = _load();
  const newGoal = {
    id: 'goal_' + Date.now(),
    empId: uid, empName: _uname(), dept: _udept(),
    title, period, keyResults: krs,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  _save([...all.filter(x => !_demoGoals().find(d => d.id === x.id)), newGoal]);
  showToast('목표가 등록되었습니다! 꾸준히 달성해 나가세요. 🎯', 'success')
    addNotification({ type: 'success', title: '목표 설정', body: '목표가 등록되었습니다! 꾸준히 달성해 나가세요. 🎯' });
  _tab = 'list';
  _draw(root);
}

function _updateProgress(goalId, krId, value, root) {
  if (isNaN(value) || value < 0 || value > 100) {
    showToast('진행률은 0~100 사이 값이어야 합니다.', 'error'); return;
  }
  const all = _load();
  const goal = all.find(g => g.id === goalId);
  if (!goal) return;
  const kr = goal.keyResults.find(k => k.id === krId);
  if (!kr) return;
  kr.progress = value;

  const avg = _avg(goal.keyResults);
  if (avg >= 100) goal.status = 'completed';
  else goal.status = 'active';

  _save(all);
  showToast('진행률이 업데이트되었습니다.', 'success')
    addNotification({ type: 'success', title: '목표 설정', body: '진행률이 업데이트되었습니다.' });
  _draw(root);
}
