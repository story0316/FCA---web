/**
 * work-report.js — 주간 업무 보고
 */

import {getUser, isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

function _session() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}'); } catch { return {}; } }

const LS = 'hr_work_reports';

const STATUS_LABELS = { done: '완료', in_progress: '진행중', planned: '예정', blocked: '차단' };
const STATUS_COLORS = { done: '#10B981', in_progress: '#3B82F6', planned: 'var(--text-muted)', blocked: '#EF4444' };

function _getAll() { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } }
function _save(l) { localStorage.setItem(LS, JSON.stringify(l)); }
function _id() { return 'wr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6); }

function _isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `${d.getUTCFullYear()}-W${String(Math.ceil((((d - yearStart) / 86400000) + 1) / 7)).padStart(2, '0')}`;
}

function _weekLabel(isoWeek) {
  const [year, w] = isoWeek.split('-W');
  const simple = new Date(year, 0, 1 + (Number(w) - 1) * 7);
  const mon = new Date(simple);
  mon.setDate(simple.getDate() - (simple.getDay() || 7) + 1);
  const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
  return `${mon.getMonth()+1}/${mon.getDate()} ~ ${fri.getMonth()+1}/${fri.getDate()} (${year})`;
}

let _tab = 'write';
let _viewWeek = _isoWeek();

// Draft state
let _tasks = [];
let _nextWeekPlans = '';
let _issues = '';
let _shared = true;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  const user = getUser();
  const uid  = _session().empId || _session().userId || user?.id || 'demo';
  const allReports = _getAll();
  const thisWeek = _isoWeek();
  const existing = allReports.find(r => r.empId === uid && r.week === thisWeek);
  if (existing) {
    _tasks = existing.tasks || [];
    _nextWeekPlans = existing.nextWeekPlans || '';
    _issues = existing.issues || '';
    _shared = existing.shared !== false;
  } else {
    _tasks = [{ id: _id(), text: '', status: 'done' }];
    _nextWeekPlans = '';
    _issues = '';
    _shared = true;
  }
  _tab = 'write';
  _viewWeek = thisWeek;
  _draw(root);
}

export function unmount() { _tab = 'write';
  _tasks = [];
  _nextWeekPlans = '';
  _issues = '';
  _shared = true;
}

function _draw(root) {
  const user = getUser();
  const uid  = _session().empId || _session().userId || user?.id || 'demo';
  const empName = user?.name || user?.email?.split('@')[0] || '직원';
  const allReports = _getAll();
  const myReports  = allReports.filter(r => r.empId === uid).sort((a, b) => b.week.localeCompare(a.week));
  const sharedReports = allReports.filter(r => r.shared && r.empId !== uid)
    .filter(r => r.week === _viewWeek)
    .sort((a, b) => a.empName.localeCompare(b.empName));

  const thisWeek = _isoWeek();

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden">
  <div class="page-header" style="flex-shrink:0;background:var(--card-bg);border-bottom:1px solid var(--border);padding:16px;display:flex;align-items:center;gap:12px">
    <button onclick="window.navBack()"
      style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0;line-height:1">←</button>
    <div>
      <div style="font-size:16px;font-weight:700;color:var(--text)">주간 업무 보고</div>
      <div style="font-size:11px;color:var(--text-muted)">${_weekLabel(thisWeek)}</div>
    </div>
  </div>

  <div style="flex-shrink:0;display:flex;border-bottom:1px solid var(--border);background:var(--card-bg)">
    <button class="wr-tab" data-t="write"
      style="flex:1;padding:12px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab==='write'?'#4F46E5':'transparent'};color:${_tab==='write'?'#4F46E5':'var(--text-muted)'}">
      ✏️ 작성</button>
    <button class="wr-tab" data-t="history"
      style="flex:1;padding:12px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab==='history'?'#4F46E5':'transparent'};color:${_tab==='history'?'#4F46E5':'var(--text-muted)'}">
      📋 내 이력 (${myReports.length})</button>
    <button class="wr-tab" data-t="team"
      style="flex:1;padding:12px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab==='team'?'#4F46E5':'transparent'};color:${_tab==='team'?'#4F46E5':'var(--text-muted)'}">
      👥 팀 보고</button>
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">
    ${_tab === 'write'   ? _renderWrite(uid, empName, thisWeek)       : ''}
    ${_tab === 'history' ? _renderHistory(myReports)                   : ''}
    ${_tab === 'team'    ? _renderTeam(sharedReports, thisWeek)        : ''}
  </div>
</div>`;

  root.querySelectorAll('.wr-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _draw(root); });
  });

  if (_tab === 'write') _bindWrite(root, uid, empName, thisWeek);
  if (_tab === 'team') {
    root.querySelectorAll('.wr-week-nav').forEach(btn => {
      btn.addEventListener('click', () => {
        const [y, w] = _viewWeek.split('-W');
        const delta = Number(btn.dataset.d);
        const newW = Number(w) + delta;
        _viewWeek = `${y}-W${String(Math.max(1, Math.min(52, newW))).padStart(2, '0')}`;
        _draw(root);
      });
    });
  }
}

function _renderWrite(uid, empName, thisWeek) {
  const allReports = _getAll();
  const existing = allReports.find(r => r.empId === uid && r.week === thisWeek);
  const submitted = !!existing;

  return `
${submitted ? `<div style="background:#D1FAE5;border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:#059669;font-weight:600">
  ✅ 이번 주 보고가 제출되었습니다. 수정 후 재제출 가능합니다.
</div>` : ''}

<!-- 이번 주 업무 -->
<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px">이번 주 업무</div>
<div id="wr-tasks">
  ${_tasks.map((t, i) => `
  <div class="wr-task-row" data-idx="${i}" style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
    <select class="wr-task-status" data-idx="${i}"
      style="padding:7px 8px;border:1.5px solid ${STATUS_COLORS[t.status]||'var(--border)'};border-radius:8px;font-size:11px;font-weight:700;
             background:${t.status==='done'?'#D1FAE5':t.status==='in_progress'?'#DBEAFE':t.status==='blocked'?'#FEE2E2':'#F1F5F9'};
             color:${STATUS_COLORS[t.status]||'var(--text-muted)'};cursor:pointer;flex-shrink:0">
      ${Object.entries(STATUS_LABELS).map(([k,v])=>`<option value="${k}" ${t.status===k?'selected':''}>${v}</option>`).join('')}
    </select>
    <input class="wr-task-text" data-idx="${i}" type="text" placeholder="업무 내용을 입력하세요" value="${t.text}"
      style="flex:1;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;background:var(--bg);color:var(--text)">
    <button class="wr-task-del" data-idx="${i}"
      style="padding:6px 8px;background:none;border:1.5px solid var(--border);border-radius:8px;font-size:12px;cursor:pointer;color:var(--text-muted);flex-shrink:0">✕</button>
  </div>`).join('')}
</div>
<button id="wr-add-task"
  style="width:100%;padding:9px;border:1.5px dashed var(--border);border-radius:8px;background:none;font-size:12px;color:var(--text-muted);cursor:pointer;margin-bottom:16px">
  + 업무 추가
</button>

<!-- 다음 주 계획 -->
<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:6px">다음 주 계획</div>
<textarea maxlength="500" id="wr-next-plan" rows="3" placeholder="다음 주 주요 업무 계획을 작성하세요…"
  style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;background:var(--bg);color:var(--text);resize:vertical;box-sizing:border-box;margin-bottom:14px">${_nextWeekPlans}</textarea>

<!-- 이슈/건의사항 -->
<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:6px">이슈 / 건의사항 <span style="font-size:11px;color:var(--text-muted)">(선택)</span></div>
<textarea maxlength="500" id="wr-issues" rows="2" placeholder="진행 중 이슈나 지원이 필요한 사항을 작성하세요…"
  style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;background:var(--bg);color:var(--text);resize:vertical;box-sizing:border-box;margin-bottom:14px">${_issues}</textarea>

<!-- 공유 여부 -->
<label style="display:flex;align-items:center;gap:10px;margin-bottom:16px;cursor:pointer">
  <input id="wr-shared" type="checkbox" ${_shared?'checked':''} style="width:16px;height:16px;cursor:pointer">
  <span style="font-size:12px;color:#475569">팀원에게 공개 (팀 보고 탭에서 열람 가능)</span>
</label>

<button id="wr-submit"
  style="width:100%;padding:13px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">
  ${submitted ? '수정 제출' : '제출하기'}
</button>`;
}

function _renderHistory(myReports) {
  if (!myReports.length) {
    return `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
      <div style="font-size:40px;margin-bottom:12px">📋</div>
      <div style="font-size:14px;font-weight:600">아직 제출한 보고가 없습니다</div>
      <button onclick="location.hash='#/work-report'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">업무보고 작성</button>
    
    </div>`;
  }
  return myReports.map(r => {
    const done = r.tasks?.filter(t=>t.status==='done').length || 0;
    const total = r.tasks?.length || 0;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <div>
      <div style="font-size:12px;font-weight:700;color:var(--text)">${_weekLabel(r.week)}</div>
      <div style="font-size:11px;color:var(--text-muted)">완료 ${done}/${total} 업무</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:18px;font-weight:800;color:#4F46E5">${total?Math.round(done/total*100):0}%</div>
      ${r.shared ? `<span style="font-size:10px;color:#10B981">공개</span>` : `<span style="font-size:10px;color:var(--text-muted)">비공개</span>`}
    </div>
  </div>
  ${(r.tasks||[]).map(t=>`
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
      <span style="width:6px;height:6px;border-radius:50%;background:${STATUS_COLORS[t.status]||'var(--text-muted)'};flex-shrink:0"></span>
      <span style="font-size:11px;color:#475569">${t.text||'(내용 없음)'}</span>
      <span style="font-size:10px;color:${STATUS_COLORS[t.status]||'var(--text-muted)'};margin-left:auto">${STATUS_LABELS[t.status]||''}</span>
    </div>`).join('')}
</div>`;
  }).join('');
}

function _renderTeam(sharedReports, thisWeek) {
  return `
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
  <button class="wr-week-nav" data-d="-1"
    style="padding:6px 10px;border:1.5px solid var(--border);border-radius:8px;background:none;cursor:pointer;font-size:12px;color:var(--text-muted)">← 이전</button>
  <span style="font-size:12px;font-weight:700;color:var(--text)">${_weekLabel(_viewWeek)}</span>
  <button class="wr-week-nav" data-d="1"
    style="padding:6px 10px;border:1.5px solid var(--border);border-radius:8px;background:none;cursor:pointer;font-size:12px;color:var(--text-muted)">다음 →</button>
</div>

${!sharedReports.length
  ? `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
      <div style="font-size:40px;margin-bottom:12px">👥</div>
      <div style="font-size:14px;font-weight:600">이번 주 공개된 팀 보고가 없습니다</div>
    </div>`
  : sharedReports.map(r => {
    const done  = r.tasks?.filter(t=>t.status==='done').length || 0;
    const total = r.tasks?.length || 0;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <div style="font-size:13px;font-weight:700;color:var(--text)">${r.empName}</div>
    <div style="font-size:18px;font-weight:800;color:${done===total&&total?'#10B981':'#4F46E5'}">${total?Math.round(done/total*100):0}%</div>
  </div>
  ${(r.tasks||[]).map(t=>`
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
      <span style="width:6px;height:6px;border-radius:50%;background:${STATUS_COLORS[t.status]||'var(--text-muted)'};flex-shrink:0"></span>
      <span style="font-size:11px;color:#475569">${t.text||'(내용 없음)'}</span>
      <span style="font-size:10px;color:${STATUS_COLORS[t.status]||'var(--text-muted)'};margin-left:auto">${STATUS_LABELS[t.status]||''}</span>
    </div>`).join('')}
  ${r.nextWeekPlans ? `<div style="margin-top:8px;padding:8px;background:var(--bg);border-radius:6px;font-size:11px;color:var(--text-muted)"><span style="font-weight:600">다음주:</span> ${r.nextWeekPlans}</div>` : ''}
  ${r.issues ? `<div style="margin-top:6px;padding:8px;background:#FEF3C7;border-radius:6px;font-size:11px;color:#D97706"><span style="font-weight:600">이슈:</span> ${r.issues}</div>` : ''}
</div>`;
  }).join('')}`;
}

function _bindWrite(root, uid, empName, thisWeek) {
  root.querySelector('#wr-add-task')?.addEventListener('click', () => {
    _tasks.push({ id: _id(), text: '', status: 'done' });
    _draw(root);
  });

  root.querySelectorAll('.wr-task-del').forEach(btn => {
    btn.addEventListener('click', () => {
      _tasks.splice(Number(btn.dataset.idx), 1);
      if (!_tasks.length) _tasks.push({ id: _id(), text: '', status: 'done' });
      _draw(root);
    });
  });

  root.querySelectorAll('.wr-task-status').forEach(sel => {
    sel.addEventListener('change', () => {
      _tasks[Number(sel.dataset.idx)].status = sel.value;
      sel.style.borderColor = STATUS_COLORS[sel.value] || 'var(--border)';
      sel.style.background  = sel.value==='done'?'#D1FAE5':sel.value==='in_progress'?'#DBEAFE':sel.value==='blocked'?'#FEE2E2':'#F1F5F9';
      sel.style.color       = STATUS_COLORS[sel.value] || 'var(--text-muted)';
    });
  });

  root.querySelectorAll('.wr-task-text').forEach(inp => {
    inp.addEventListener('input', () => { _tasks[Number(inp.dataset.idx)].text = inp.value; });
  });

  root.querySelector('#wr-next-plan')?.addEventListener('input', e => { _nextWeekPlans = e.target.value; });
  root.querySelector('#wr-issues')?.addEventListener('input', e => { _issues = e.target.value; });
  root.querySelector('#wr-shared')?.addEventListener('change', e => { _shared = e.target.checked; });

  root.querySelector('#wr-submit')?.addEventListener('click', () => {
    const validTasks = _tasks.filter(t => t.text.trim());
    if (!validTasks.length) { showToast('최소 1개의 업무를 입력해주세요.', 'error'); return; }

    const all = _getAll();
    const idx = all.findIndex(r => r.empId === uid && r.week === thisWeek);
    const record = { id: idx>=0 ? all[idx].id : _id(), empId: uid, empName, week: thisWeek, tasks: validTasks, nextWeekPlans: _nextWeekPlans.trim(), issues: _issues.trim(), shared: _shared, submittedAt: new Date().toISOString() };
    if (idx >= 0) all[idx] = record; else all.push(record);
    _save(all);
    showToast('업무 보고가 제출되었습니다! 📋', 'success');
    addNotification({ type: 'info', title: '주간 보고 제출', message: `${_weekLabel(thisWeek)} 보고가 저장되었습니다.` });
    _tab = 'history';
    _draw(root);
  });
}
