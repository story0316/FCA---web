/**
 * mentoring-admin.js — 멘토링 프로그램 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';

const LS_PAIRS    = 'hr_mentoring_pairs';
const LS_SESSIONS = 'hr_mentoring_sessions';

let _mentors = [];

const LEGACY_PAIR_IDS = new Set(['PAIR001', 'PAIR002', 'PAIR003']);

const LEGACY_SESSION_IDS = new Set(['SES001', 'SES002', 'SES003', 'SES004', 'SES005']);

function _getPairs() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_PAIRS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(p => !LEGACY_PAIR_IDS.has(p.id));
    if (cleaned.length !== list.length) _savePairs(cleaned);
    return cleaned;
  } catch { return []; }
}
function _savePairs(l) { localStorage.setItem(LS_PAIRS, JSON.stringify(l)); }
function _getSessions() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_SESSIONS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(s => !LEGACY_SESSION_IDS.has(s.id));
    if (cleaned.length !== list.length) localStorage.setItem(LS_SESSIONS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}

let _tab  = 'pairs';
let _root = null;

export async function mount(root) {
  _root = root; _tab = 'pairs';
  _mentors = await loadDisplayEmployees().catch(() => []);
  _draw();
}
export function render(root) { _root=root; _tab='pairs'; _draw(); }
export function unmount() { _root=null; _tab='pairs'; _mentors=[]; }

function _draw() {
  const pairs    = _getPairs();
  const sessions = _getSessions();
  const active   = pairs.filter(p=>p.status==='active').length;

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['pairs','멘토링 쌍'],['sessions','세션 현황'],['match','매칭 등록']].map(([k,l])=>`
    <button class="mta-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='pairs'    ? _renderPairs(pairs, sessions)
    : _tab==='sessions' ? _renderSessions(sessions, pairs)
    :                     _renderMatch()}
  </div>
</div>`;

  _root.querySelectorAll('.mta-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderPairs(pairs, sessions) {
  const active    = pairs.filter(p=>p.status==='active').length;
  const completed = pairs.filter(p=>p.status==='completed').length;
  const totalSessions = sessions.length;

  if (!pairs.length) return `<div style="text-align:center;padding:48px 20px;color:#94A3B8"><div style="font-size:40px;margin-bottom:10px">🤝</div><div style="font-size:14px;font-weight:600;margin-bottom:4px">멘토링 쌍이 없습니다</div><div style="font-size:12px">매칭 탭에서 멘토-멘티를 연결해 주세요.</div></div>`;

  return `
<!-- KPI -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
  ${[
    ['진행중', `${active}쌍`, '#4F46E5'],
    ['완료', `${completed}쌍`, '#10B981'],
    ['총 세션', `${totalSessions}회`, '#F59E0B'],
  ].map(([l,v,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:18px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8">${l}</div>
  </div>`).join('')}
</div>

${pairs.map(p=>{
  const pSessions = sessions.filter(s=>s.pairId===p.id);
  const done      = pSessions.filter(s=>s.completed).length;
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div>
      <div style="font-size:13px;font-weight:700">
        ${p.mentorName} → ${p.menteeName}
      </div>
      <div style="font-size:11px;color:#94A3B8">${p.startDate} ~ ${p.endDate}</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;
                 background:${p.status==='active'?'#EEF2FF':'#F1F5F9'};color:${p.status==='active'?'#4F46E5':'#94A3B8'}">
      ${p.status==='active'?'진행중':'완료'}
    </span>
  </div>
  <div style="font-size:11px;color:#64748B;margin-bottom:8px">목표: ${p.goal}</div>
  <div style="display:flex;justify-content:space-between;font-size:11px">
    <span style="color:#94A3B8">세션 ${done}/${pSessions.length}회 완료</span>
    ${p.status==='active' ? `
    <button class="mta-complete" data-id="${p.id}"
      style="padding:3px 8px;font-size:10px;border:1px solid #94A3B8;color:#94A3B8;background:none;border-radius:6px;cursor:pointer">종료</button>` : ''}
  </div>
</div>`; }).join('')}`;
}

function _renderSessions(sessions, pairs) {
  const sorted = [...sessions].sort((a,b)=>b.date.localeCompare(a.date));
  const done   = sessions.filter(s=>s.completed).length;
  const pend   = sessions.filter(s=>!s.completed).length;

  return `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
  ${[
    ['완료된 세션', `${done}회`, '#10B981'],
    ['예정 세션',   `${pend}회`, '#F59E0B'],
  ].map(([l,v,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:20px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8">${l}</div>
  </div>`).join('')}
</div>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  ${sorted.map(s=>{
    const p = pairs.find(x=>x.id===s.pairId);
    return `
  <div style="padding:10px 14px;border-bottom:1px solid var(--border)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
      <span style="font-size:12px;font-weight:600">${s.topic}</span>
      <span style="font-size:11px;font-weight:700;color:${s.completed?'#10B981':'#F59E0B'}">${s.completed?'완료':'예정'}</span>
    </div>
    <div style="font-size:10px;color:#94A3B8">${p?`${p.mentorName}→${p.menteeName}`:''} · ${s.date} · ${s.duration}분</div>
  </div>`; }).join('')}
</div>`;
}

function _renderMatch() {
  const mentors = _mentors;
  const mentees = [];

  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:14px">멘토링 매칭 등록</div>

  <div style="display:flex;flex-direction:column;gap:10px">
    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">멘토 *</div>
      <select id="mta-mentor"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
               background:var(--bg);color:var(--text);font-size:12px">
        <option value="">선택</option>
        ${mentors.length ? mentors.map(m=>`<option value="${m.id}" data-name="${m.name}">${m.avatar} ${m.name} (${m.dept})</option>`).join('') : '<option disabled>직원 데이터 없음</option>'}
      </select>
    </div>

    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">멘티 *</div>
      <select id="mta-mentee"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
               background:var(--bg);color:var(--text);font-size:12px">
        <option value="">선택</option>
        ${mentees.map(m=>`<option value="${m.id}" data-name="${m.name}">${m.name} (${m.dept})</option>`).join('')}
      </select>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">시작일</div>
        <input id="mta-start" type="date"
          style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
                 background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">종료일</div>
        <input id="mta-end" type="date"
          style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
                 background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
      </div>
    </div>

    <div>
      <div style="font-size:11px;font-weight:600;margin-bottom:4px;color:#64748B">멘토링 목표</div>
      <input id="mta-goal" type="text" placeholder="예: 기술 역량 강화, HR 커리어 전환"
        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;
               background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box">
    </div>

    <button id="mta-submit"
      style="padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;
             font-size:13px;font-weight:700;cursor:pointer">매칭 등록</button>
  </div>
</div>`;
}

function _bindEvents() {
  _root.querySelectorAll('.mta-complete').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const pairs=_getPairs(); const p=pairs.find(x=>x.id===btn.dataset.id); if(!p) return;
      p.status='completed'; _savePairs(pairs);
      showToast('멘토링이 종료됐습니다.', 'info'); _draw();
    });
  });

  _root.querySelector('#mta-submit')?.addEventListener('click',()=>{
    const mentorSel = _root.querySelector('#mta-mentor');
    const menteeSel = _root.querySelector('#mta-mentee');
    const mentorId   = mentorSel?.value;
    const mentorName = mentorSel?.options[mentorSel.selectedIndex]?.dataset.name;
    const menteeId   = menteeSel?.value;
    const menteeName = menteeSel?.options[menteeSel.selectedIndex]?.dataset.name;
    const start      = _root.querySelector('#mta-start')?.value;
    const end        = _root.querySelector('#mta-end')?.value;
    const goal       = _root.querySelector('#mta-goal')?.value.trim();

    if (!mentorId || !menteeId) { showToast('멘토와 멘티를 선택해 주세요.', 'error'); return; }
    if (!start || !end)         { showToast('기간을 입력해 주세요.', 'error'); return; }

    const pairs = _getPairs();
    pairs.push({
      id:          'PAIR'+Date.now(),
      mentorId,
      mentorName:  mentorName||mentorId,
      menteeId,
      menteeName:  menteeName||menteeId,
      status:      'active',
      startDate:   start,
      endDate:     end,
      goal:        goal||'-',
      sessions:    0,
    });
    _savePairs(pairs);
    showToast('멘토링 매칭이 등록됐습니다.', 'success')
      addNotification({ type: 'success', title: 'Mentoring (관리자)', body: '멘토링 매칭이 등록됐습니다.' });
    _tab='pairs'; _draw();
  });
}
