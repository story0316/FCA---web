/**
 * work-log.js — 업무일지 (일간 기록 · 주간 요약)
 */

import {getUser, isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId() {
  const s = _session();
  return s.empId || s.userId || getUser()?.id || 'EMP001';
}

const LS_LOG = 'hr_work_logs';

function _getLogs() {
  try { return JSON.parse(localStorage.getItem(LS_LOG) || '[]'); } catch { return []; }
}

function _saveLogs(list) {
  localStorage.setItem(LS_LOG, JSON.stringify(list));
}

function _today() {
  return new Date().toISOString().slice(0, 10);
}

function _weekDates(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 5 }, (_, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    return dt.toISOString().slice(0, 10);
  });
}

function _weekLabel(dateStr) {
  const dates = _weekDates(dateStr);
  return `${dates[0].slice(5).replace('-', '.')} ~ ${dates[4].slice(5).replace('-', '.')} 주`;
}

const DAY_LABELS = ['월', '화', '수', '목', '금'];

let _view = 'today'; // 'today' | 'week' | 'edit'
let _editDate = null;
let _selectedDate = _today();

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _selectedDate = _today();
  _renderPage(root);
}

export function unmount() {
  _view = 'today';
  _editDate = null;
  _selectedDate = null;
}

function _renderPage(root) {
  if (_view === 'edit') { _renderEditForm(root); return; }
  if (_view === 'week') { _renderWeekView(root); return; }
  _renderTodayView(root);
}

// ── 오늘 뷰 ─────────────────────────────────────────────────

function _renderTodayView(root) {
  const user = getUser();
  const logs = _getLogs();
  const userId = _empId();
  const todayLog = logs.find(l => l.date === _today() && l.userId === userId);
  const todayDate = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

  root.innerHTML = `
<div class="page" style="background:var(--bg)">
  <div class="top-bar">
    <button class="btn btn-ghost btn-sm" onclick="window.navBack()" style="padding:8px;min-height:40px">←</button>
    <div class="top-bar-title" style="flex:1;text-align:center">📝 업무일지</div>
    <button id="week-btn" style="padding:8px;background:none;border:none;cursor:pointer;
      font-size:12px;font-weight:600;color:#4F46E5;min-height:40px">주간 ›</button>
  </div>

  <div class="page-content" style="padding:16px">

    <!-- 날짜 헤더 -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div>
        <div style="font-size:18px;font-weight:800;color:var(--text)">${todayDate}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">오늘의 업무일지</div>
      </div>
      ${todayLog
        ? `<span style="background:#D1FAE5;color:#065F46;font-size:12px;padding:4px 10px;border-radius:10px;font-weight:600">✓ 작성 완료</span>`
        : `<span style="background:#FEF3C7;color:#92400E;font-size:12px;padding:4px 10px;border-radius:10px;font-weight:600">미작성</span>`}
    </div>

    ${todayLog ? _logCard(todayLog, true) : `
    <div style="background:var(--card-bg);border:2px dashed var(--border);border-radius:14px;
         padding:40px;text-align:center;margin-bottom:16px">
      <div style="font-size:36px;margin-bottom:10px">📝</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:6px;color:var(--text)">오늘의 일지를 작성해보세요</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px">오늘 한 일·내일 계획·메모를 기록하세요</div>
      <button id="write-today-btn" class="btn btn-primary" style="padding:10px 24px">✏️ 오늘 일지 작성</button>
    </div>`}

    <!-- 최근 일지 -->
    <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px">최근 기록</div>
    ${_recentLogs(logs, userId)}

  </div>
</div>`;

  root.querySelector('#week-btn').addEventListener('click', () => { _view = 'week'; _renderPage(root); });
  root.querySelector('#write-today-btn')?.addEventListener('click', () => {
    _editDate = _today(); _view = 'edit'; _renderPage(root);
  });
  root.querySelectorAll('.edit-log-btn').forEach(btn => {
    btn.addEventListener('click', () => { _editDate = btn.dataset.date; _view = 'edit'; _renderPage(root); });
  });
}

function _logCard(log, isToday = false) {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
     padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
    <div style="font-size:13px;font-weight:700;color:var(--text)">${log.date}</div>
    <button class="edit-log-btn" data-date="${log.date}"
      style="background:none;border:1px solid var(--border);border-radius:7px;
             padding:4px 10px;font-size:11px;color:var(--text-muted);cursor:pointer">수정</button>
  </div>
  ${log.didToday ? `
  <div style="margin-bottom:8px">
    <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:4px">✅ 오늘 한 일</div>
    <div style="font-size:13px;color:var(--text);line-height:1.6;white-space:pre-line">${log.didToday}</div>
  </div>` : ''}
  ${log.willTomorrow ? `
  <div style="margin-bottom:8px">
    <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:4px">📌 내일 할 일</div>
    <div style="font-size:13px;color:var(--text);line-height:1.6;white-space:pre-line">${log.willTomorrow}</div>
  </div>` : ''}
  ${log.blockers ? `
  <div style="background:#FEF3C7;border-radius:8px;padding:8px 10px">
    <div style="font-size:11px;font-weight:700;color:#92400E;margin-bottom:2px">⚠️ 블로커</div>
    <div style="font-size:12px;color:#78350F;line-height:1.5;white-space:pre-line">${log.blockers}</div>
  </div>` : ''}
  ${log.mood ? `<div style="font-size:18px;margin-top:8px;text-align:right">${log.mood}</div>` : ''}
</div>`;
}

function _recentLogs(logs, userId) {
  const recent = logs.filter(l => l.userId === userId && l.date !== _today())
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  if (!recent.length) return `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">아직 기록이 없습니다.</div>
      <button onclick="location.hash='#/work-log'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">업무 기록 작성</button>
    `;
  return recent.map(l => _logCard(l)).join('');
}

// ── 주간 뷰 ─────────────────────────────────────────────────

function _renderWeekView(root) {
  const user = getUser();
  const userId = _empId();
  const logs = _getLogs();
  const weekDates = _weekDates(_selectedDate);
  const weekLog = weekDates.map(d => ({ date: d, log: logs.find(l => l.date === d && l.userId === userId) }));

  root.innerHTML = `
<div class="page" style="background:var(--bg)">
  <div class="top-bar">
    <button id="back-btn" class="btn btn-ghost btn-sm" style="padding:8px;min-height:40px">←</button>
    <div class="top-bar-title" style="flex:1;text-align:center">${_weekLabel(_selectedDate)}</div>
    <div style="display:flex;gap:2px;padding-right:8px">
      <button id="prev-week" style="padding:6px 8px;background:none;border:none;cursor:pointer;
        font-size:16px;color:var(--text)">‹</button>
      <button id="next-week" style="padding:6px 8px;background:none;border:none;cursor:pointer;
        font-size:16px;color:var(--text)">›</button>
    </div>
  </div>

  <div class="page-content" style="padding:16px">

    <!-- 주간 완성도 -->
    <div style="display:flex;gap:8px;margin-bottom:16px">
      ${weekLog.map((item, i) => {
        const hasLog = !!item.log;
        const isPast = item.date <= _today();
        const isToday = item.date === _today();
        return `
      <div class="day-cell ${hasLog?'has-log':''}" data-date="${item.date}"
        style="flex:1;text-align:center;padding:10px 4px;border-radius:12px;cursor:pointer;
               background:${isToday?'#4F46E5':hasLog?'#D1FAE5':'var(--card-bg)'};
               border:2px solid ${isToday?'#4F46E5':hasLog?'#10B981':'var(--border)'};
               opacity:${!isPast?'0.4':'1'}">
        <div style="font-size:11px;font-weight:600;color:${isToday?'rgba(255,255,255,0.8)':'var(--text-muted)'}">${DAY_LABELS[i]}</div>
        <div style="font-size:10px;margin-top:2px;color:${isToday?'rgba(255,255,255,0.7)':'var(--text-muted)'}">${item.date.slice(5).replace('-','.')}</div>
        <div style="font-size:16px;margin-top:4px">${hasLog?'✅':isPast?'○':'·'}</div>
      </div>`;
      }).join('')}
    </div>

    <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">
      이번 주 작성: ${weekLog.filter(x => x.log).length} / 5일
    </div>

    <!-- 요일별 일지 -->
    ${weekLog.map(item => {
      if (!item.log) return '';
      return `<div style="margin-bottom:10px">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:4px">${item.date}</div>
        ${_logCard(item.log)}
      </div>`;
    }).filter(Boolean).join('') || `
    <div style="text-align:center;padding:32px;color:var(--text-muted)">
      <div style="font-size:32px;margin-bottom:8px">📭</div>
      <div style="margin-bottom:14px">이번 주 아직 작성된 일지가 없습니다.</div>
      <button onclick="document.querySelector('#write-today-btn')?.click()" style="padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">오늘 일지 작성</button>
    </div>`}

  </div>
</div>`;

  root.querySelector('#back-btn').addEventListener('click', () => { _view = 'today'; _renderPage(root); });
  root.querySelector('#prev-week').addEventListener('click', () => {
    const d = new Date(_selectedDate); d.setDate(d.getDate() - 7);
    _selectedDate = d.toISOString().slice(0, 10); _renderPage(root);
  });
  root.querySelector('#next-week').addEventListener('click', () => {
    const d = new Date(_selectedDate); d.setDate(d.getDate() + 7);
    _selectedDate = d.toISOString().slice(0, 10); _renderPage(root);
  });
  root.querySelectorAll('.day-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      if (cell.dataset.date > _today()) return;
      _editDate = cell.dataset.date; _view = 'edit'; _renderPage(root);
    });
  });
  root.querySelectorAll('.edit-log-btn').forEach(btn => {
    btn.addEventListener('click', () => { _editDate = btn.dataset.date; _view = 'edit'; _renderPage(root); });
  });
}

// ── 작성 폼 ─────────────────────────────────────────────────

const MOODS = ['😄', '😊', '😐', '😕', '😞'];

function _renderEditForm(root) {
  const user = getUser();
  const userId = _empId();
  const logs = _getLogs();
  const existing = logs.find(l => l.date === _editDate && l.userId === userId);

  let selectedMood = existing?.mood || null;

  root.innerHTML = `
<div class="page" style="background:var(--bg)">
  <div class="top-bar">
    <button id="back-btn" class="btn btn-ghost btn-sm" style="padding:8px;min-height:40px">←</button>
    <div class="top-bar-title" style="flex:1;text-align:center">${_editDate} 업무일지</div>
    <div style="min-width:40px"></div>
  </div>

  <div class="page-content" style="padding:16px">

    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:10px">
      <label style="font-size:12px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:6px">✅ 오늘 한 일</label>
      <textarea maxlength="500" id="did-today" placeholder="오늘 완료한 작업을 기록하세요..."
        style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:10px;
               font-size:13px;background:var(--bg);color:var(--text);height:100px;resize:none;
               box-sizing:border-box;font-family:inherit;line-height:1.5">${existing?.didToday || ''}</textarea>
    </div>

    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:10px">
      <label style="font-size:12px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:6px">📌 내일 할 일</label>
      <textarea maxlength="500" id="will-tomorrow" placeholder="내일 진행할 작업을 계획하세요..."
        style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:10px;
               font-size:13px;background:var(--bg);color:var(--text);height:80px;resize:none;
               box-sizing:border-box;font-family:inherit;line-height:1.5">${existing?.willTomorrow || ''}</textarea>
    </div>

    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:10px">
      <label style="font-size:12px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:6px">⚠️ 블로커 / 이슈 (선택)</label>
      <textarea maxlength="500" id="blockers" placeholder="업무 진행을 막는 이슈가 있다면 기록하세요..."
        style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:10px;
               font-size:13px;background:var(--bg);color:var(--text);height:60px;resize:none;
               box-sizing:border-box;font-family:inherit;line-height:1.5">${existing?.blockers || ''}</textarea>
    </div>

    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px">
      <label style="font-size:12px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:8px">오늘의 기분</label>
      <div style="display:flex;gap:10px;justify-content:center">
        ${MOODS.map(m => `
        <button class="mood-btn" data-mood="${m}"
          style="font-size:28px;padding:8px;border:2px solid ${selectedMood===m?'#4F46E5':'var(--border)'};
                 border-radius:12px;cursor:pointer;background:${selectedMood===m?'#EEF2FF':'var(--bg)'};
                 transition:all .15s">${m}</button>`).join('')}
      </div>
    </div>

    <button id="save-btn" class="btn btn-primary" style="width:100%">
      ${existing ? '수정 완료' : '저장하기'}
    </button>

  </div>
</div>`;

  root.querySelector('#back-btn').addEventListener('click', () => {
    _view = _selectedDate === _today() ? 'today' : 'week';
    _renderPage(root);
  });

  root.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedMood = btn.dataset.mood;
      root.querySelectorAll('.mood-btn').forEach(b => {
        b.style.borderColor = 'var(--border)';
        b.style.background = 'var(--bg)';
      });
      btn.style.borderColor = '#4F46E5';
      btn.style.background = '#EEF2FF';
    });
  });

  root.querySelector('#save-btn').addEventListener('click', () => {
    const didToday     = root.querySelector('#did-today').value.trim();
    const willTomorrow = root.querySelector('#will-tomorrow').value.trim();
    const blockers     = root.querySelector('#blockers').value.trim();

    if (!didToday && !willTomorrow) {
      showToast('오늘 한 일 또는 내일 할 일을 입력하세요.', 'error'); return;
    }

    const logs = _getLogs();
    const idx = logs.findIndex(l => l.date === _editDate && l.userId === userId);
    const entry = {
      id: existing?.id || 'WL_' + Date.now(),
      userId, date: _editDate, didToday, willTomorrow, blockers,
      mood: selectedMood, updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) logs[idx] = entry; else logs.push(entry);
    _saveLogs(logs);
    showToast(existing ? '업무일지가 수정되었습니다.' : '업무일지가 저장되었습니다.', 'success');
    addNotification({ type: 'success', title: '업무 기록', body: existing ? '업무일지가 수정되었습니다.' : '업무일지가 저장되었습니다.' });
    _view = 'today'; _renderPage(root);
  });
}
