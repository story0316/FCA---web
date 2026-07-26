/**
 * team-lunch.js — 팀 점심 신청 (직원)
 * Route: #/team-lunch
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_team_lunches';

function _session() { try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; } }
function _empId()   { return _session().empId || _session().userId || 'EMP001'; }
function _empName() { return _session().name || '직원'; }
function _dept()    { return _session().dept || _session().department || '일반'; }

function _demoTeamLunch() {
  const uid = _empId(); const name = _empName(); const dept = _dept();
  return [
    { id:`TL_${uid}_1`, empId:uid, empName:name, dept, headcount:5, restaurant:'한우마을', date:'2026-05-15', budget:150000, purpose:'팀 프로젝트 완료 기념', status:'approved', reqDate:'2026-05-10' },
    { id:`TL_${uid}_2`, empId:uid, empName:name, dept, headcount:4, restaurant:'스시오마카세', date:'2026-06-20', budget:120000, purpose:'신규 팀원 환영 점심', status:'pending', reqDate:'2026-06-01' },
  ];
}

function _load() {
  const demo = _demoTeamLunch();
  try {
    const saved = JSON.parse(localStorage.getItem(LS) || '[]');
    return [...demo.filter(d => !saved.find(x => x.id === d.id)), ...saved];
  } catch { return demo; }
}
function _save(list) { localStorage.setItem(LS, JSON.stringify(list)); }

const STATUS_LABEL = { pending:'검토중', approved:'승인', rejected:'반려' };
const STATUS_COLOR = { pending:'#F59E0B', approved:'#10B981', rejected:'#EF4444' };
const STATUS_BG    = { pending:'#FFFBEB', approved:'#ECFDF5', rejected:'#FEF2F2' };

let _tab = 'apply';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'apply';
  _render(root);
}

export function unmount() {
  _tab = 'apply';
}

function _render(root) {
  const list = _load();
  const mine = list.filter(x => x.empId === _empId());

  root.innerHTML = `
<div style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg,#F8FAFC)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--card-bg,#fff);border-bottom:1px solid var(--border,#E2E8F0);flex-shrink:0">
    <button id="tl-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text,#1E293B);padding:0;line-height:1">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700;color:var(--text,#1E293B)">🍱 팀 점심 신청</div>
      <div style="font-size:11px;color:var(--text-muted)">신청 ${mine.length}건</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg,#fff);border-bottom:1px solid var(--border,#E2E8F0);flex-shrink:0">
    ${[['apply','신청하기'],['history','신청 내역']].map(([k,l]) => `
    <button class="tl-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">
    ${_tab === 'apply' ? _renderApply() : _renderHistory(mine)}
  </div>
</div>`;

  root.querySelector('#tl-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.tl-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _render(root); }));

  if (_tab === 'apply') {
    root.querySelector('#tl-submit').addEventListener('click', () => _submit(root));
  }
}

function _renderApply() {
  return `
<div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:10px;padding:11px 14px;margin-bottom:14px;display:flex;gap:8px;align-items:flex-start">
  <span style="font-size:14px">ℹ️</span>
  <span style="font-size:12px;color:#4338CA;line-height:1.5">1인 최대 30,000원 지원 · 월 1회</span>
</div>

<div style="background:var(--card-bg,#fff);border:1px solid var(--border,#E2E8F0);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:12px">
  <div>
    <label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:5px">식당명 *</label>
    <input id="tl-restaurant" type="text" placeholder="예: 한우마을"
      style="width:100%;padding:10px 12px;border:1.5px solid var(--border,#E2E8F0);border-radius:8px;font-size:13px;background:var(--bg,#F8FAFC);color:var(--text,#1E293B);box-sizing:border-box">
  </div>
  <div>
    <label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:5px">식사 일자 *</label>
    <input id="tl-date" type="date"
      style="width:100%;padding:10px 12px;border:1.5px solid var(--border,#E2E8F0);border-radius:8px;font-size:13px;background:var(--bg,#F8FAFC);color:var(--text,#1E293B);box-sizing:border-box">
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div>
      <label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:5px">인원 수 *</label>
      <input id="tl-headcount" type="number" min="2" max="20" placeholder="명"
        style="width:100%;padding:10px 12px;border:1.5px solid var(--border,#E2E8F0);border-radius:8px;font-size:13px;background:var(--bg,#F8FAFC);color:var(--text,#1E293B);box-sizing:border-box">
    </div>
    <div>
      <label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:5px">총 예산 (원) *</label>
      <input id="tl-budget" type="number" min="0" step="1000" placeholder="0"
        style="width:100%;padding:10px 12px;border:1.5px solid var(--border,#E2E8F0);border-radius:8px;font-size:13px;background:var(--bg,#F8FAFC);color:var(--text,#1E293B);box-sizing:border-box">
    </div>
  </div>
  <div>
    <label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:5px">목적 *</label>
    <textarea maxlength="500" id="tl-purpose" rows="3" placeholder="팀 점심 신청 목적을 입력하세요."
      style="width:100%;padding:10px 12px;border:1.5px solid var(--border,#E2E8F0);border-radius:8px;font-size:13px;background:var(--bg,#F8FAFC);color:var(--text,#1E293B);box-sizing:border-box;resize:vertical"></textarea>
  </div>
  <button id="tl-submit"
    style="width:100%;padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-top:2px">
    신청하기
  </button>
</div>`;
}

function _renderHistory(mine) {
  if (!mine.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:44px;margin-bottom:12px">🍱</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:6px">신청 내역이 없습니다</div>
      <button onclick="document.querySelector('[data-tab=apply]')?.click()" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">신청하기</button>
    
  <div style="font-size:12px">팀 점심을 신청해보세요!</div>
</div>`;

  return mine.map(x => `
<div style="background:var(--card-bg,#fff);border:1px solid var(--border,#E2E8F0);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
    <div>
      <div style="font-size:14px;font-weight:700;color:var(--text,#1E293B);margin-bottom:3px">${x.restaurant}</div>
      <div style="font-size:11px;color:var(--text-muted)">${x.date} · ${x.headcount}명</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;
      background:${STATUS_BG[x.status]};color:${STATUS_COLOR[x.status]};flex-shrink:0">${STATUS_LABEL[x.status]}</span>
  </div>
  <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">${x.purpose}</div>
  <div style="display:flex;align-items:center;justify-content:space-between">
    <span style="font-size:11px;color:var(--text-muted)">신청일: ${x.reqDate}</span>
    <span style="font-size:13px;font-weight:700;color:#4F46E5">${x.budget.toLocaleString()}원</span>
  </div>
</div>`).join('');
}

function _submit(root) {
  const restaurant = root.querySelector('#tl-restaurant').value.trim();
  const date       = root.querySelector('#tl-date').value;
  const headcount  = parseInt(root.querySelector('#tl-headcount').value);
  const budget     = parseInt(root.querySelector('#tl-budget').value);
  const purpose    = root.querySelector('#tl-purpose').value.trim();

  if (!restaurant) { showToast('식당명을 입력하세요.', 'error'); return; }
  if (!date)       { showToast('식사 일자를 선택하세요.', 'error'); return; }
  if (!headcount || headcount < 2) { showToast('인원 수를 2명 이상 입력하세요.', 'error'); return; }
  if (!budget || budget <= 0)      { showToast('예산을 입력하세요.', 'error'); return; }
  if (!purpose)    { showToast('목적을 입력하세요.', 'error'); return; }

  const perPerson = budget / headcount;
  if (perPerson > 30000) {
    showToast(`1인당 예산이 ${Math.round(perPerson).toLocaleString()}원으로 30,000원을 초과합니다.`, 'warning');
  }

  const list = _load();
  const newItem = {
    id: 'TL_' + Date.now(),
    empId: _empId(),
    empName: _empName(),
    dept: _dept(),
    headcount,
    restaurant,
    date,
    budget,
    purpose,
    status: 'pending',
    reqDate: new Date().toISOString().slice(0, 10),
  };
  list.push(newItem);
  _save(list);
  showToast('팀 점심 신청이 완료되었습니다!', 'success')
    addNotification({ type: 'success', title: '팀 점심', body: '팀 점심 신청이 완료되었습니다!' });
  _tab = 'history';
  _render(root);
}
