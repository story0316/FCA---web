/**
 * coffee-chat-admin.js — 커피챗 매칭 관리 (관리자)
 */

import { showToast } from '../../components/toast.js'
import { addNotification } from '../../components/notification-hub.js';

const LS_PROFILES = 'hr_coffee_chat_profiles';
const LS_MATCHES  = 'hr_coffee_chat_matches';

const LEGACY_PROFILE_IDS = new Set(['CP001', 'CP002', 'CP003', 'CP004', 'CP005']);
const LEGACY_MATCH_IDS   = new Set(['CM001', 'CM002', 'CM003']);

const STATUS_META_MATCH = {
  pending:   { label:'대기',  color:'#F59E0B', bg:'#FEF3C7' },
  confirmed: { label:'확정',  color:'#3B82F6', bg:'#DBEAFE' },
  completed: { label:'완료',  color:'#10B981', bg:'#D1FAE5' },
  cancelled: { label:'취소',  color:'#94A3B8', bg:'#F1F5F9' },
};

function _loadProfiles() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_PROFILES) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_PROFILE_IDS.has(r.id));
    if (cleaned.length !== list.length) _saveProfiles(cleaned);
    return cleaned;
  } catch { return []; }
}
function _saveProfiles(list) { localStorage.setItem(LS_PROFILES, JSON.stringify(list)); }

function _loadMatches() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_MATCHES) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_MATCH_IDS.has(r.id));
    if (cleaned.length !== list.length) _saveMatches(cleaned);
    return cleaned;
  } catch { return []; }
}
function _saveMatches(list) { localStorage.setItem(LS_MATCHES, JSON.stringify(list)); }

let _tab = 'profiles';
let _root = null;

export function render(root) { _root = root; _tab = 'profiles'; _draw(); }
export function unmount() { _root = null;
  _tab = 'profiles';
}

function _draw() {
  const profiles = _loadProfiles();
  const matches  = _loadMatches();
  const active   = profiles.filter(p => p.status === 'active');
  const pending  = matches.filter(m => m.status === 'pending');
  const completed = matches.filter(m => m.status === 'completed');

  const tabs = [
    { key:'profiles', label:'참가자 관리' },
    { key:'matches',  label:'매칭 현황' },
  ];

  _root.innerHTML = `
<div style="padding:16px;max-width:600px;margin:0 auto">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button id="cc-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text)">&#8592;</button>
    <h2 style="margin:0;font-size:17px;font-weight:700;color:var(--text)">커피챗 관리</h2>
  </div>

  <!-- Stats -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
    ${[
      { label:'참가자',    val:active.length,    color:'#10B981' },
      { label:'매칭 신청', val:pending.length,   color:'#F59E0B' },
      { label:'매칭 완료', val:completed.length, color:'#3B82F6' },
    ].map(s=>`
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;text-align:center">
      <div style="font-size:20px;font-weight:700;color:${s.color}">${s.val}</div>
      <div style="font-size:11px;color:#64748B;margin-top:2px">${s.label}</div>
    </div>`).join('')}
  </div>

  <!-- Tabs -->
  <div style="display:flex;gap:6px;margin-bottom:14px">
    ${tabs.map(t=>`
    <button class="cc-tab" data-tab="${t.key}" style="
      padding:7px 14px;font-size:12px;font-weight:600;border-radius:20px;cursor:pointer;
      border:1.5px solid ${_tab===t.key?'#4F46E5':'var(--border)'};
      background:${_tab===t.key?'#EEF2FF':'var(--card-bg)'};
      color:${_tab===t.key?'#4F46E5':'#64748B'}">${t.label}</button>`).join('')}
  </div>

  <!-- Content -->
  <div id="cc-content">
    ${_tab === 'profiles' ? _profilesHtml(profiles) : _matchesHtml(matches)}
  </div>
</div>`;

  _bindEvents();
}

function _profilesHtml(profiles) {
  if (profiles.length === 0) return `
    <div style="text-align:center;padding:48px 0;color:#94A3B8">
      <div style="font-size:36px;margin-bottom:8px">&#9749;</div>
      <div style="font-size:13px">등록된 참가자가 없습니다.</div>
    </div>`;
  return profiles.map(p => `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div style="flex:1">
      <div style="font-size:14px;font-weight:700;color:var(--text)">${p.empName}</div>
      <div style="font-size:11px;color:#64748B;margin-top:2px">${p.dept} · ${p.interest}</div>
      <div style="font-size:11px;color:#94A3B8;margin-top:2px">${p.availTime}</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;
        background:${p.status==='active'?'#D1FAE5':'#F1F5F9'};
        color:${p.status==='active'?'#10B981':'#94A3B8'}">${p.status==='active'?'활성':'비활성'}</span>
      <button class="cc-toggle" data-id="${p.id}" data-status="${p.status}"
        style="padding:6px 12px;font-size:11px;font-weight:600;border-radius:8px;cursor:pointer;
        border:1px solid ${p.status==='active'?'#EF4444':'#10B981'};
        background:transparent;
        color:${p.status==='active'?'#EF4444':'#10B981'}">${p.status==='active'?'비활성화':'활성화'}</button>
    </div>
  </div>
</div>`).join('');
}

function _matchesHtml(matches) {
  if (matches.length === 0) return `
    <div style="text-align:center;padding:48px 0;color:#94A3B8">
      <div style="font-size:36px;margin-bottom:8px">&#128203;</div>
      <div style="font-size:13px">매칭 내역이 없습니다.</div>
    </div>`;
  return matches.map(m => {
    const sm = STATUS_META_MATCH[m.status] || STATUS_META_MATCH.pending;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="font-size:13px;font-weight:600;color:var(--text)">${m.requesterName} &#8594; ${m.targetName}</div>
    <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${sm.bg};color:${sm.color}">${sm.label}</span>
  </div>
  <div style="font-size:12px;color:#64748B">${m.topic}</div>
  <div style="font-size:11px;color:#94A3B8;margin-top:4px">신청일 ${m.reqDate}</div>
</div>`;
  }).join('');
}

function _bindEvents() {
  _root.querySelector('#cc-back')?.addEventListener('click', () => window.navBack());

  _root.querySelectorAll('.cc-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.tab; _draw(); });
  });

  _root.querySelectorAll('.cc-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const profiles = _loadProfiles();
      const idx = profiles.findIndex(p => p.id === btn.dataset.id);
      if (idx < 0) return;
      const next = profiles[idx].status === 'active' ? 'inactive' : 'active';
      profiles[idx].status = next;
      _saveProfiles(profiles);
      showToast(next === 'active' ? '활성화되었습니다.' : '비활성화되었습니다.');
      addNotification({ type: 'success', title: '커피챗 관리', body: next === 'active' ? '활성화되었습니다.' : '비활성화되었습니다.' });
      _draw();
    });
  });
}
export function mount(root) { return render(root); }
