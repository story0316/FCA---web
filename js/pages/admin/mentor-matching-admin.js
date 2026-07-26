/**
 * mentor-matching-admin.js — 멘토 매칭 관리 (관리자)
 */
import { showToast } from '../../components/toast.js'
import { addNotification } from '../../components/notification-hub.js';

const LS_MENTORS = 'hr_mentor_profiles';
const LS_MATCHES = 'hr_mentor_matches';

const MATCH_STATUS = {
  pending: { label: '대기',   color: '#F59E0B', bg: '#FEF3C7' },
  active:  { label: '진행 중', color: '#10B981', bg: '#ECFDF5' },
  ended:   { label: '종료',   color: '#94A3B8', bg: '#F1F5F9' },
};
const MENTOR_STATUS = {
  active:   { label: '활성',   color: '#10B981', bg: '#ECFDF5' },
  inactive: { label: '비활성', color: '#94A3B8', bg: '#F1F5F9' },
};

const LEGACY_MT_IDS = new Set(['MT001','MT002','MT003','MT004']);
const LEGACY_MX_IDS = new Set(['MX001','MX002','MX003','MX004','MX005']);

function _getMentors() {
  const s = localStorage.getItem(LS_MENTORS);
  if (!s) return [];
  try {
    const d = JSON.parse(s);
    const cleaned = d.filter(r => !LEGACY_MT_IDS.has(r.id));
    if (cleaned.length < d.length) localStorage.setItem(LS_MENTORS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}
function _saveMentors(l) { localStorage.setItem(LS_MENTORS, JSON.stringify(l)); }

function _getMatches() {
  const s = localStorage.getItem(LS_MATCHES);
  if (!s) return [];
  try {
    const d = JSON.parse(s);
    const cleaned = d.filter(r => !LEGACY_MX_IDS.has(r.id));
    if (cleaned.length < d.length) localStorage.setItem(LS_MATCHES, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}
function _saveMatches(l) { localStorage.setItem(LS_MATCHES, JSON.stringify(l)); }

let _tab  = 'matches';
let _root = null;

export function render(root) { _root = root; _tab = 'matches'; _draw(); }
export function unmount() { _root = null;
  _tab = 'matches';
}

function _draw() {
  const matches = _getMatches();
  const mentors = _getMentors();
  const pending = matches.filter(m => m.status === 'pending').length;

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[
      ['matches', `매칭 관리${pending ? ` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending}</span>` : ''}`],
      ['mentors', '멘토 현황'],
    ].map(([k, l]) => `
    <button class="mma-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;white-space:nowrap;border-bottom:2px solid ${_tab === k ? 'var(--primary)' : 'transparent'};color:${_tab === k ? 'var(--primary)' : '#94A3B8'}">${l}</button>`).join('')}
  </div>

  <div style="padding:14px 16px">
    ${_renderStats(matches, mentors)}
    ${_tab === 'matches' ? _renderMatches(matches) : _renderMentors(mentors, matches)}
  </div>
</div>`;

  _bindEvents();
}

function _renderStats(matches, mentors) {
  const activeMatches  = matches.filter(m => m.status === 'active').length;
  const activeMentors  = mentors.filter(m => m.status === 'active').length;
  const pendingMatches = matches.filter(m => m.status === 'pending').length;
  return `
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
  ${[['대기 매칭', pendingMatches, '#F59E0B'], ['진행 중', activeMatches, '#10B981'], ['활성 멘토', activeMentors, '#3B82F6']].map(([l, v, c]) => `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:18px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8">${l}</div>
  </div>`).join('')}
</div>`;
}

function _renderMatches(matches) {
  const list = [...matches].sort((a, b) => b.reqDate.localeCompare(a.reqDate));
  if (!list.length) return `
    <div style="text-align:center;padding:48px 16px;color:#94A3B8">
      <div style="font-size:36px;margin-bottom:10px">🤝</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:4px">매칭 내역이 없습니다</div>
      <div style="font-size:12px">멘토 매칭 신청이 아직 없습니다.</div>
    </div>`;
  return list.map(m => {
    const meta = MATCH_STATUS[m.status] || MATCH_STATUS.pending;
    return `
<div style="background:var(--card-bg);border:1px solid ${m.status === 'pending' ? '#FCD34D' : 'var(--border)'};border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div>
      <div style="font-size:14px;font-weight:700;color:var(--text)">🎓 ${m.mentorName} → ${m.menteeName}</div>
      <div style="font-size:11px;color:#94A3B8;margin-top:2px">${m.menteeDept} · 신청일: ${m.reqDate}</div>
    </div>
    <span style="background:${meta.bg};color:${meta.color};border-radius:99px;font-size:11px;font-weight:600;padding:3px 10px">${meta.label}</span>
  </div>
  <div style="background:var(--bg);border-radius:10px;padding:10px;font-size:12px;color:#64748B;margin-bottom:10px">
    📌 멘토링 분야: <strong>${m.area}</strong>
    ${m.startDate ? `<br>📅 시작일: ${m.startDate}` : ''}
  </div>
  ${m.status === 'pending' ? `
  <button class="mma-approve" data-id="${m.id}" style="width:100%;padding:9px;background:#ECFDF5;color:#10B981;border:1px solid #10B981;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer">✓ 매칭 승인</button>
  ` : m.status === 'active' ? `
  <button class="mma-end" data-id="${m.id}" style="width:100%;padding:9px;background:#F1F5F9;color:#64748B;border:1px solid #CBD5E1;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer">종료 처리</button>
  ` : ''}
</div>`;
  }).join('');
}

function _renderMentors(mentors, matches) {
  if (!mentors.length) return `
    <div style="text-align:center;padding:48px 16px;color:#94A3B8">
      <div style="font-size:36px;margin-bottom:10px">👨‍🏫</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:4px">멘토가 없습니다</div>
      <div style="font-size:12px">등록된 멘토가 없습니다.</div>
    </div>`;
  return mentors.map(mt => {
    const meta = MENTOR_STATUS[mt.status] || MENTOR_STATUS.active;
    const activeCount = matches.filter(mx => mx.mentorId === mt.id && mx.status === 'active').length;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="font-size:14px;font-weight:700;color:var(--text)">${mt.empName}</div>
        ${activeCount > 0 ? `<span style="background:#EFF6FF;color:#3B82F6;border-radius:99px;font-size:10px;font-weight:600;padding:2px 8px">매칭 ${activeCount}건</span>` : ''}
      </div>
      <div style="font-size:11px;color:#94A3B8;margin-top:2px">${mt.dept} · ${mt.role} · 경력 ${mt.career}년</div>
    </div>
    <span style="background:${meta.bg};color:${meta.color};border-radius:99px;font-size:11px;font-weight:600;padding:3px 10px">${meta.label}</span>
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">
    ${mt.skills.map(s => `<span style="background:var(--bg);border:1px solid var(--border);border-radius:99px;font-size:11px;color:#64748B;padding:2px 8px">${s}</span>`).join('')}
  </div>
  ${mt.status === 'active' ? `
  <button class="mma-deactivate" data-id="${mt.id}" style="width:100%;padding:9px;background:#FEF2F2;color:#EF4444;border:1px solid #EF4444;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer">비활성화</button>
  ` : `
  <div style="text-align:center;font-size:11px;color:#94A3B8;padding:4px">비활성 멘토</div>
  `}
</div>`;
  }).join('');
}

function _bindEvents() {
  if (!_root) return;

  _root.querySelectorAll('.mma-tab').forEach(b => {
    b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(); });
  });

  _root.querySelectorAll('.mma-approve').forEach(b => {
    b.addEventListener('click', () => {
      const all = _getMatches();
      const idx = all.findIndex(m => m.id === b.dataset.id);
      if (idx < 0) return;
      all[idx].status = 'active';
      all[idx].startDate = new Date().toISOString().slice(0, 10);
      _saveMatches(all);
      showToast('매칭이 승인되었습니다.');
      addNotification({ type: 'success', title: '멘토 매칭 관리', body: '매칭이 승인되었습니다.' });
      _draw();
    });
  });

  _root.querySelectorAll('.mma-end').forEach(b => {
    b.addEventListener('click', () => {
      const all = _getMatches();
      const idx = all.findIndex(m => m.id === b.dataset.id);
      if (idx < 0) return;
      all[idx].status = 'ended';
      _saveMatches(all);
      showToast('매칭이 종료 처리되었습니다.');
      addNotification({ type: 'info', title: '멘토 매칭 관리', body: '매칭이 종료 처리되었습니다.' });
      _draw();
    });
  });

  _root.querySelectorAll('.mma-deactivate').forEach(b => {
    b.addEventListener('click', () => {
      const all = _getMentors();
      const idx = all.findIndex(m => m.id === b.dataset.id);
      if (idx < 0) return;
      all[idx].status = 'inactive';
      _saveMentors(all);
      showToast('멘토가 비활성화되었습니다.', 'warning');
      addNotification({ type: 'warning', title: '멘토 매칭 관리', body: '멘토가 비활성화되었습니다.' });
      _draw();
    });
  });
}
export function mount(root) { return render(root); }
