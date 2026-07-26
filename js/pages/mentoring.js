/**
 * mentoring.js — 멘토링 프로그램 (직원)
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS_PAIRS    = 'hr_mentoring_pairs';
const LS_SESSIONS = 'hr_mentoring_sessions';

const MENTORS = [];

const LEGACY_PAIR_IDS = new Set(['PAIR001']);
const LEGACY_SES_IDS  = new Set(['SES001','SES002','SES003']);

function _empId()   { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').userId  || 'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name    || '직원'; }   catch { return '직원'; } }

function _getPairs() {
  const s = localStorage.getItem(LS_PAIRS);
  if (!s) return [];
  try {
    const d = JSON.parse(s);
    const cleaned = d.filter(r => !LEGACY_PAIR_IDS.has(r.id));
    if (cleaned.length < d.length) localStorage.setItem(LS_PAIRS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}
function _savePairs(l) { localStorage.setItem(LS_PAIRS, JSON.stringify(l)); }

function _getSessions() {
  const s = localStorage.getItem(LS_SESSIONS);
  if (!s) return [];
  try {
    const d = JSON.parse(s);
    const cleaned = d.filter(r => !LEGACY_SES_IDS.has(r.id));
    if (cleaned.length < d.length) localStorage.setItem(LS_SESSIONS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}
function _saveSessions(l) { localStorage.setItem(LS_SESSIONS, JSON.stringify(l)); }

let _tab    = 'my';      // 'my' | 'find' | 'addSession'
let _activePair = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'my';
  _activePair = null;
  _render(root);
}
export function unmount() { _tab = 'my'; _activePair = null; }

function _render(root) {
  if (_tab === 'addSession') { _renderAddSession(root); return; }

  const empId  = _empId();
  const pairs  = _getPairs();
  const myPair = pairs.find(p => p.menteeId === empId && p.status === 'active');
  const sessions = myPair ? _getSessions().filter(s => s.pairId === myPair.id) : [];

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div class="top-bar" style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="ob-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🤝 멘토링 프로그램</div>
      <div style="font-size:11px;color:var(--text-muted)">${myPair ? `매칭 완료 · ${sessions.length}회 세션` : '멘토를 찾아 성장하세요'}</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['my','내 멘토링'],['find','멘토 찾기']].map(([k,l])=>`
    <button class="mt-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab === 'my' ? _renderMy(myPair, sessions) : _renderFind(pairs, empId)}
  </div>
</div>`;

  root.querySelector('#ob-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.mt-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _render(root); }));

  root.querySelector('#add-session-btn')?.addEventListener('click', () => {
    _activePair = myPair;
    _tab = 'addSession';
    _render(root);
  });

  root.querySelectorAll('.complete-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sessions2 = _getSessions();
      const ses = sessions2.find(s => s.id === btn.dataset.sesId);
      if (ses) {
        const idx = ses.actionItems.indexOf(btn.dataset.action);
        // Toggle: mark by wrapping in ~~
        if (idx >= 0 && !btn.dataset.action.startsWith('~~')) {
          ses.actionItems[idx] = '~~' + btn.dataset.action + '~~';
        }
        _saveSessions(sessions2);
      }
      _render(root);
    });
  });

  root.querySelectorAll('.request-mentor-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mentor = MENTORS.find(m => m.id === btn.dataset.id);
      if (!mentor) return;
      const pairs2 = _getPairs();
      if (pairs2.find(p => p.menteeId === empId && p.status === 'active')) {
        showToast('이미 진행 중인 멘토링이 있습니다.', 'error'); return;
      }
      pairs2.push({
        id: 'PAIR_'+Date.now(),
        mentorId: mentor.id, mentorName: mentor.name,
        menteeId: empId,     menteeName: _empName(),
        status: 'active',
        startDate: new Date().toISOString().slice(0,10),
        goal: '',
        sessions: 0,
      });
      _savePairs(pairs2);
      showToast(`${mentor.name}님과 멘토링이 시작되었습니다!`, 'success')
    addNotification({ type: 'success', title: '멘토링', body: '님과 멘토링이 시작되었습니다!' });
      addNotification({ type: 'system', title: `멘토링 매칭: ${mentor.name} ↔ ${_empName()}`, body: '' });
      _tab = 'my';
      _render(root);
    });
  });
}

function _renderMy(pair, sessions) {
  if (!pair) return `
<div style="text-align:center;padding:50px 20px;color:var(--text-muted)">
  <div style="font-size:44px;margin-bottom:12px">🤝</div>
  <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:6px">아직 멘토링이 없습니다</div>
  <div style="font-size:12px;margin-bottom:20px">멘토 찾기 탭에서 멘토를 신청해보세요.</div>
  <button class="mt-tab" data-tab="find"
    style="background:#4F46E5;color:#fff;border:none;border-radius:12px;
           padding:12px 24px;font-size:13px;font-weight:700;cursor:pointer">
    멘토 찾기 →
  </button>
</div>`;

  const mentor = MENTORS.find(m => m.id === pair.mentorId) || { name:pair.mentorId, avatar:'👤', areas:[] };
  const done   = sessions.filter(s => s.completed).length;

  return `
<!-- 멘토 카드 -->
<div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);border-radius:16px;
     padding:18px;margin-bottom:14px;color:#fff">
  <div style="font-size:11px;opacity:0.8;margin-bottom:8px">나의 멘토</div>
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
    <div style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.2);
         display:flex;align-items:center;justify-content:center;font-size:24px">${mentor.avatar}</div>
    <div>
      <div style="font-size:16px;font-weight:800">${mentor.name}</div>
      <div style="font-size:12px;opacity:0.8">${mentor.title||''} · ${mentor.dept||''}</div>
    </div>
  </div>
  <div style="font-size:11px;opacity:0.8;margin-bottom:6px">멘토링 목표</div>
  <div style="font-size:12px;line-height:1.5;margin-bottom:12px">${pair.goal||'목표를 설정하세요'}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div style="background:rgba(255,255,255,0.15);border-radius:10px;padding:10px;text-align:center">
      <div style="font-size:18px;font-weight:800">${done}</div>
      <div style="font-size:10px;opacity:0.8">완료 세션</div>
    </div>
    <div style="background:rgba(255,255,255,0.15);border-radius:10px;padding:10px;text-align:center">
      <div style="font-size:18px;font-weight:800">${sessions.length - done}</div>
      <div style="font-size:10px;opacity:0.8">진행 예정</div>
    </div>
  </div>
</div>

<!-- 세션 추가 버튼 -->
<button id="add-session-btn"
  style="width:100%;background:#EEF2FF;color:#4338CA;border:1.5px dashed #4F46E5;
         border-radius:12px;padding:12px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:14px">
  + 세션 기록 추가
</button>

<!-- 세션 목록 -->
<div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px">세션 기록 (${sessions.length}회)</div>
${!sessions.length ? `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">기록된 세션이 없습니다.</div>` :
  [...sessions].reverse().map(s => `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
     padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div>
      <div style="font-size:13px;font-weight:700;color:var(--text)">${s.topic}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${s.date} · ${s.duration}분</div>
    </div>
    <span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:8px;
      color:${s.completed?'#10B981':'#F59E0B'};background:${s.completed?'#D1FAE5':'#FEF3C7'}">
      ${s.completed?'완료':'예정'}
    </span>
  </div>
  ${s.note ? `<div style="font-size:12px;color:var(--text);line-height:1.5;margin-bottom:8px;
    background:var(--bg);border-radius:8px;padding:8px">${s.note}</div>` : ''}
  ${s.actionItems?.length ? `
  <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:4px">액션 아이템</div>
  ${s.actionItems.map((a,i)=>`
  <div style="display:flex;align-items:center;gap:6px;padding:4px 0">
    <span style="font-size:12px">${a.startsWith('~~')?'✅':'◻'}</span>
    <span style="font-size:12px;color:${a.startsWith('~~')?'var(--text-muted)':'var(--text)'};
         text-decoration:${a.startsWith('~~')?'line-through':'none'}">
      ${a.replace(/^~~|~~$/g,'')}
    </span>
  </div>`).join('')}` : ''}
</div>`).join('')}`;
}

function _renderFind(pairs, empId) {
  if (!MENTORS.length) return `
    <div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
      <div style="font-size:40px;margin-bottom:10px">🎓</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:4px">등록된 멘토가 없습니다</div>
      <div style="font-size:12px">관리자가 멘토를 등록하면 신청할 수 있습니다.</div>
    </div>`;
  const activePairMentorIds = pairs.filter(p => p.menteeId === empId && p.status === 'active').map(p => p.mentorId);
  return MENTORS.map(m => {
    const isMatched = activePairMentorIds.includes(m.id);
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
     padding:14px;margin-bottom:10px">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
    <div style="width:44px;height:44px;border-radius:50%;background:#EEF2FF;flex-shrink:0;
         display:flex;align-items:center;justify-content:center;font-size:22px">${m.avatar}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:14px;font-weight:700;color:var(--text)">${m.name}</div>
      <div style="font-size:11px;color:var(--text-muted)">${m.title} · ${m.dept}</div>
    </div>
    ${isMatched ? `<span style="font-size:11px;font-weight:600;color:#10B981;background:#D1FAE5;padding:4px 10px;border-radius:8px">매칭 중</span>` :
    `<button class="request-mentor-btn" data-id="${m.id}"
      style="background:#4F46E5;color:#fff;border:none;border-radius:10px;
             padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer">신청</button>`}
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:5px">
    ${m.areas.map(a=>`<span style="font-size:11px;background:#F1F5F9;color:var(--text-muted);
      padding:3px 8px;border-radius:8px">${a}</span>`).join('')}
  </div>
</div>`;
  }).join('');
}

function _renderAddSession(root) {
  root.innerHTML = `
<div style="padding:16px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button id="back-btn" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text)">←</button>
    <div style="font-size:15px;font-weight:700">📝 세션 기록 추가</div>
  </div>
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
    ${_fld('ses-date','날짜',new Date().toISOString().slice(0,10),'date')}
    ${_fld('ses-topic','주제','예: 커리어 방향 설정','text')}
    <div style="margin-bottom:12px">
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">소요 시간</label>
      <select id="ses-duration" style="width:100%;padding:9px;border:1.5px solid var(--border);
        border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
        <option value="30">30분</option><option value="45">45분</option>
        <option value="60" selected>60분</option><option value="90">90분</option><option value="120">2시간</option>
      </select>
    </div>
    <div style="margin-bottom:12px">
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">세션 내용 요약</label>
      <textarea maxlength="500" id="ses-note" placeholder="오늘 논의한 내용…"
        style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
               font-size:13px;background:var(--bg);color:var(--text);
               box-sizing:border-box;height:80px;resize:vertical"></textarea>
    </div>
    ${_fld('ses-actions','액션 아이템 (쉼표로 구분)','예: 책 읽기, 프로젝트 적용','text')}
    <div style="margin-bottom:0">
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">완료 여부</label>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input id="ses-done" type="checkbox" checked>
        <span style="font-size:13px;color:var(--text)">세션 완료</span>
      </label>
    </div>
  </div>
  <button id="save-btn" style="width:100%;margin-top:14px;background:#4F46E5;color:#fff;border:none;
    border-radius:12px;padding:14px;font-size:14px;font-weight:700;cursor:pointer">저장하기</button>
</div>`;

  root.querySelector('#back-btn').addEventListener('click', () => { _tab = 'my'; _render(root); });
  root.querySelector('#save-btn').addEventListener('click', () => {
    const topic = root.querySelector('#ses-topic').value.trim();
    if (!topic) { showToast('주제를 입력하세요.', 'error'); return; }
    const sessions = _getSessions();
    const rawActions = root.querySelector('#ses-actions').value.trim();
    sessions.push({
      id: 'SES_'+Date.now(),
      pairId: _activePair.id,
      date:     root.querySelector('#ses-date').value,
      duration: parseInt(root.querySelector('#ses-duration').value),
      topic,
      note:     root.querySelector('#ses-note').value.trim(),
      actionItems: rawActions ? rawActions.split(',').map(a=>a.trim()).filter(Boolean) : [],
      completed: root.querySelector('#ses-done').checked,
    });
    _saveSessions(sessions);
    showToast('세션이 기록되었습니다.', 'success');
    _tab = 'my';
    _render(root);
  });
}

function _fld(id, label, placeholder, type) {
  return `<div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">${label}</label>
    <input id="${id}" type="${type}" placeholder="${type!=='date'?placeholder:''}" value="${type==='date'?placeholder:''}"
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>`;
}
