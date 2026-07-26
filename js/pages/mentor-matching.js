/**
 * mentor-matching.js — 멘토 매칭 (직원)
 * Route: #/mentor-matching
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS_MENTORS  = 'hr_mentor_profiles';
const LS_MATCHES  = 'hr_mentor_matches';

const LEGACY_MENTOR_IDS = new Set(['MNT001', 'MNT002', 'MNT003', 'MNT004']);

function _session() { try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; } }
function _empId()   { return _session().userId || 'EMP001'; }
function _empName() { return _session().name || '직원'; }

function _loadMentors() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_MENTORS) || '[]');
    const cleaned = saved.filter(m => !LEGACY_MENTOR_IDS.has(m.id));
    if (cleaned.length < saved.length) localStorage.setItem(LS_MENTORS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}

function _loadMatches() {
  try { return JSON.parse(localStorage.getItem(LS_MATCHES) || '[]'); } catch { return []; }
}
function _saveMatches(list) { localStorage.setItem(LS_MATCHES, JSON.stringify(list)); }

const STATUS_LABEL = { pending:'신청중', active:'멘토링 중', completed:'완료', rejected:'거절' };
const STATUS_COLOR = { pending:'#F59E0B', active:'#10B981', completed:'var(--text-muted)', rejected:'#EF4444' };
const STATUS_BG    = { pending:'#FFFBEB', active:'#ECFDF5', completed:'#F1F5F9', rejected:'#FEF2F2' };

let _tab = 'find';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'find';
  _render(root);
}

export function unmount() {
  _tab = 'find';
}

function _render(root) {
  const mentors = _loadMentors().filter(m => m.status === 'active');
  const matches = _loadMatches();
  const myMatches = matches.filter(m => m.menteeId === _empId());

  root.innerHTML = `
<div style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg,#F8FAFC)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--card-bg,#fff);border-bottom:1px solid var(--border,#E2E8F0);flex-shrink:0">
    <button id="mm-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text,#1E293B);padding:0;line-height:1">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700;color:var(--text,#1E293B)">🤝 멘토 매칭</div>
      <div style="font-size:11px;color:var(--text-muted)">활동 멘토 ${mentors.length}명 · 내 멘토링 ${myMatches.length}건</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg,#fff);border-bottom:1px solid var(--border,#E2E8F0);flex-shrink:0">
    ${[['find','멘토 찾기'],['mine','내 멘토링']].map(([k,l]) => `
    <button class="mm-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">
    ${_tab === 'find' ? _renderFind(mentors, myMatches) : _renderMine(myMatches, mentors)}
  </div>
</div>`;

  root.querySelector('#mm-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.mm-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _render(root); }));

  if (_tab === 'find') {
    root.querySelectorAll('.mm-apply-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mentorId  = btn.dataset.id;
        const mentorEmpId = btn.dataset.empid;
        const mentorName  = btn.dataset.name;

        if (mentorEmpId === _empId()) {
          showToast('본인은 멘토로 신청할 수 없습니다.', 'error');
          return;
        }

        const matches = _loadMatches();
        const already = matches.find(m => m.menteeId === _empId() && m.mentorId === mentorId && m.status !== 'rejected' && m.status !== 'completed');
        if (already) {
          showToast('이미 신청한 멘토입니다.', 'warning');
          return;
        }

        matches.push({
          id:          'MCH_' + Date.now(),
          mentorId,
          mentorEmpId,
          mentorName,
          menteeId:    _empId(),
          menteeName:  _empName(),
          status:      'pending',
          reqDate:     new Date().toISOString().slice(0, 10),
        });
        _saveMatches(matches);
        showToast(`${mentorName} 멘토에게 멘토링을 신청했습니다!`, 'success')
    addNotification({ type: 'success', title: '멘토 신청', body: '멘토에게 멘토링을 신청했습니다!' });
        _render(root);
      });
    });
  }
}

function _renderFind(mentors, myMatches) {
  if (!mentors.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:44px;margin-bottom:12px">🤝</div>
  <div style="font-size:14px;font-weight:600">활동 중인 멘토가 없습니다</div>
      <button onclick="location.hash='#/mentor-matching'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">멘토 찾기</button>
    
</div>`;

  const EXPERTISE_COLORS = ['#4F46E5','#7C3AED','#0EA5E9','#10B981','#F59E0B','#EF4444'];

  return mentors.map((mentor, idx) => {
    const color = EXPERTISE_COLORS[idx % EXPERTISE_COLORS.length];
    const alreadyApplied = myMatches.some(m => m.mentorId === mentor.id && m.status !== 'rejected' && m.status !== 'completed');
    const isSelf = mentor.empId === _empId();

    return `
<div style="background:var(--card-bg,#fff);border:1px solid var(--border,#E2E8F0);border-radius:14px;padding:16px;margin-bottom:12px">
  <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:10px">
    <div style="width:44px;height:44px;border-radius:50%;background:${color}22;border:2px solid ${color}44;
      display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;color:${color};font-weight:700">
      ${mentor.empName[0]}
    </div>
    <div style="flex:1;min-width:0">
      <div style="font-size:14px;font-weight:700;color:var(--text,#1E293B)">${mentor.empName}</div>
      <div style="font-size:11px;color:var(--text-muted)">${mentor.dept} · 경력 ${mentor.career}년</div>
      <div style="display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;margin-top:4px;
        background:${color}15;color:${color}">${mentor.expertise}</div>
    </div>
  </div>
  <div style="font-size:12px;color:var(--text-muted);line-height:1.6;margin-bottom:10px">${mentor.bio}</div>
  <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px">
    ${mentor.topics.map(t => `<span style="font-size:10px;padding:3px 8px;border-radius:6px;background:var(--bg,#F8FAFC);color:var(--text-muted);border:1px solid var(--border,#E2E8F0)">${t}</span>`).join('')}
  </div>
  <button class="mm-apply-btn" data-id="${mentor.id}" data-empid="${mentor.empId}" data-name="${mentor.empName}"
    style="width:100%;padding:9px;border-radius:8px;font-size:12px;font-weight:700;cursor:${alreadyApplied||isSelf?'not-allowed':'pointer'};
           border:1.5px solid ${alreadyApplied||isSelf?'var(--border,#E2E8F0)':'#4F46E5'};
           background:${alreadyApplied||isSelf?'var(--bg,#F8FAFC)':'#4F46E5'};
           color:${alreadyApplied||isSelf?'var(--text-muted)':'#fff'}"
    ${alreadyApplied||isSelf?'disabled':''}>
    ${isSelf ? '본인' : alreadyApplied ? '신청완료' : '멘토링 신청'}
  </button>
</div>`;
  }).join('');
}

function _renderMine(myMatches, mentors) {
  if (!myMatches.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:44px;margin-bottom:12px">🤝</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:6px">신청한 멘토링이 없습니다</div>
  <div style="font-size:12px">관심 있는 멘토에게 신청해보세요!</div>
</div>`;

  const mentorMap = Object.fromEntries(mentors.map(m => [m.id, m]));

  return myMatches.map(match => {
    const mentor = mentorMap[match.mentorId] || {};
    return `
<div style="background:var(--card-bg,#fff);border:1px solid var(--border,#E2E8F0);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
    <div>
      <div style="font-size:14px;font-weight:700;color:var(--text,#1E293B)">${match.mentorName}</div>
      <div style="font-size:11px;color:var(--text-muted)">${mentor.dept || ''} · ${mentor.expertise || ''}</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;flex-shrink:0;
      background:${STATUS_BG[match.status]||'#F1F5F9'};color:${STATUS_COLOR[match.status]||'var(--text-muted)'}">
      ${STATUS_LABEL[match.status]||match.status}
    </span>
  </div>
  ${mentor.topics ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">
    ${mentor.topics.map(t => `<span style="font-size:10px;padding:3px 8px;border-radius:6px;background:var(--bg,#F8FAFC);color:var(--text-muted);border:1px solid var(--border,#E2E8F0)">${t}</span>`).join('')}
  </div>` : ''}
  <div style="font-size:11px;color:var(--text-muted)">신청일: ${match.reqDate}</div>
</div>`;
  }).join('');
}
