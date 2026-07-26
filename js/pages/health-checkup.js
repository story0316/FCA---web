/**
 * health-checkup.js — 건강검진 관리 (직원)
 * 산업안전보건법 제129조 — 일반검진 연 1회 의무
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS_CHECKUPS = 'hr_health_checkups';
const LS_SCHEDULE = 'hr_checkup_schedule';

const YEAR = new Date().getFullYear();

const CHECKUP_ITEMS = [
  '신체계측 (신장·체중·BMI)',
  '혈압·맥박',
  '시력·청력',
  '흉부 X-ray',
  '혈액 검사 (CBC·혈당·콜레스테롤)',
  '간 기능 검사 (AST·ALT)',
  '신장 기능 (크레아티닌)',
  '요검사 (단백·당)',
];

const CLINICS = [
  { id:'CL001', name:'서울 검진센터', addr:'서울 강남구 테헤란로 123', tel:'02-1234-5678', available:'평일 08:00~17:00' },
  { id:'CL002', name:'국민건강 클리닉', addr:'서울 서초구 방배동 456', tel:'02-2345-6789', available:'평일·토 09:00~18:00' },
  { id:'CL003', name:'하나메디컬', addr:'서울 마포구 공덕동 789', tel:'02-3456-7890', available:'평일 08:30~16:30' },
];

const DEMO_HISTORY = [
  { id:'HCK001', year:YEAR-1, date:`${YEAR-1}-06-15`, clinic:'서울 검진센터', status:'done', result:'정상', note:'혈압 경계 (주의)' },
  { id:'HCK002', year:YEAR-2, date:`${YEAR-2}-07-20`, clinic:'국민건강 클리닉', status:'done', result:'정상', note:'' },
];

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name    || '직원'; }   catch { return '직원'; } }

function _getHistory() {
  const s = localStorage.getItem(LS_CHECKUPS);
  if (!s) { localStorage.setItem(LS_CHECKUPS, JSON.stringify(DEMO_HISTORY)); return DEMO_HISTORY; }
  try { return JSON.parse(s); } catch { return DEMO_HISTORY; }
}
function _saveHistory(l) { localStorage.setItem(LS_CHECKUPS, JSON.stringify(l)); }

function _getSchedule() {
  try { return JSON.parse(localStorage.getItem(LS_SCHEDULE) || '{}'); } catch { return {}; }
}
function _saveSchedule(o) { localStorage.setItem(LS_SCHEDULE, JSON.stringify(o)); }

let _tab = 'status';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'status';
  _render(root);
}

export function unmount() { _tab = 'status'; }

function _render(root) {
  const history  = _getHistory().filter(h => h.empId === _empId() || !h.empId);
  const schedule = _getSchedule();
  const thisYear = history.find(h => h.year === YEAR);
  const booked   = schedule.date ? schedule : null;

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">

  <div class="top-bar" style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="ob-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🏥 건강검진 관리</div>
      <div style="font-size:11px;color:var(--text-muted)">산업안전보건법 §129 — 연 1회 의무검진</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['status','현황'],['book','예약 신청'],['history','검진 이력']].map(([k,l])=>`
    <button class="hc-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab === 'status'  ? _renderStatus(thisYear, booked)
    : _tab === 'book'    ? _renderBook(booked)
    :                      _renderHistory(history)}
  </div>
</div>`;

  root.querySelector('#ob-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.hc-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _render(root); }));

  root.querySelector('#book-submit-btn')?.addEventListener('click', () => {
    const date   = root.querySelector('#book-date').value;
    const clinic = root.querySelector('#book-clinic').value;
    if (!date) { showToast('날짜를 선택하세요.', 'error'); return; }
    _saveSchedule({ date, clinic, bookedAt: new Date().toISOString() });
    showToast(`${date} 예약이 완료되었습니다.`, 'success')
    addNotification({ type: 'success', title: '건강검진', body: '예약이 완료되었습니다.' });
    addNotification({ type: 'system', title: `건강검진 예약 완료: ${date}`, body: '' });
    _tab = 'status';
    _render(root);
  });

  root.querySelector('#book-cancel-btn')?.addEventListener('click', () => {
    
    _saveSchedule({});
    showToast('예약이 취소되었습니다.', 'info');
    _render(root);
  });
}

function _renderStatus(thisYear, booked) {
  const done = !!thisYear;
  return `
<!-- 올해 현황 카드 -->
<div style="background:${done?'linear-gradient(135deg,#10B981 0%,#059669 100%)':'linear-gradient(135deg,#F59E0B 0%,#D97706 100%)'};
     border-radius:16px;padding:20px;margin-bottom:14px;color:#fff;text-align:center">
  <div style="font-size:36px;margin-bottom:8px">${done?'✅':'⚠️'}</div>
  <div style="font-size:16px;font-weight:700;margin-bottom:4px">
    ${YEAR}년 건강검진 ${done?'완료':'미완료'}
  </div>
  <div style="font-size:12px;opacity:0.85">
    ${done ? `${thisYear.date} · ${thisYear.clinic}` : '연내 건강검진을 받아야 합니다.'}
  </div>
  ${!done ? `<button class="hc-tab" data-tab="book"
    style="margin-top:14px;background:rgba(255,255,255,0.25);color:#fff;border:none;
           border-radius:10px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer">
    예약 신청하기</button>` : ''}
</div>

<!-- 예약 현황 -->
${booked ? `
<div style="background:var(--card-bg);border:1.5px solid #4F46E5;border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="font-size:12px;font-weight:700;color:#4F46E5;margin-bottom:8px">📅 예약된 검진</div>
  <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px">${booked.date}</div>
  <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">${booked.clinic}</div>
  <button id="book-cancel-btn"
    style="background:#FEE2E2;color:#DC2626;border:none;border-radius:8px;
           padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer">예약 취소</button>
</div>` : ''}

<!-- 검진 항목 안내 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:10px">🔬 일반 건강검진 항목</div>
  ${CHECKUP_ITEMS.map(item=>`
  <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
    <span style="font-size:12px;color:#10B981">✓</span>
    <span style="font-size:12px;color:var(--text)">${item}</span>
  </div>`).join('')}
  <div style="font-size:10px;color:var(--text-muted);margin-top:8px">산업안전보건법 시행규칙 별표 12 기준</div>
</div>`;
}

function _renderBook(booked) {
  return `
${booked ? `
<div style="background:#FEF3C7;border:1.5px solid #F59E0B;border-radius:14px;padding:12px;margin-bottom:14px">
  <div style="font-size:12px;font-weight:700;color:#D97706;margin-bottom:4px">⚠️ 이미 예약된 검진이 있습니다</div>
  <div style="font-size:12px;color:#92400E">${booked.date} · ${booked.clinic}</div>
</div>` : ''}

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="font-size:13px;font-weight:700;margin-bottom:12px">📅 검진 예약 신청</div>

  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">검진 희망일</label>
    <input id="book-date" type="date" min="${new Date().toISOString().slice(0,10)}"
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>

  <div style="margin-bottom:16px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:8px;font-weight:600">검진 기관 선택</label>
    <select id="book-clinic"
      style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text)">
      ${CLINICS.map(c=>`<option value="${c.name}">${c.name}</option>`).join('')}
    </select>
  </div>

  <!-- 기관 정보 -->
  ${CLINICS.map(c=>`
  <div style="background:var(--bg);border-radius:10px;padding:10px;margin-bottom:8px">
    <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:4px">${c.name}</div>
    <div style="font-size:11px;color:var(--text-muted)">${c.addr}</div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:2px">📞 ${c.tel} · ${c.available}</div>
  </div>`).join('')}

  <button id="book-submit-btn"
    style="width:100%;margin-top:8px;background:#4F46E5;color:#fff;border:none;border-radius:12px;
           padding:13px;font-size:14px;font-weight:700;cursor:pointer">예약 신청</button>
</div>`;
}

function _renderHistory(history) {
  const sorted = [...history].sort((a,b) => b.year - a.year);
  return `
${!sorted.length ? `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
      <div style="font-size:48px;margin-bottom:12px">🏥</div>
      <div style="font-size:14px;font-weight:600;color:var(--text-muted);margin-bottom:6px">검진 이력이 없습니다</div>
      <div style="font-size:12px;margin-bottom:16px">건강검진을 받으면 이력이 여기에 표시됩니다.</div>
      <button onclick="location.hash='#/health-checkup'" style="padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">검진 예약</button>
    </div>` :
  sorted.map(h => {
    const isNormal = h.result === '정상';
    return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:14px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
      <div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">${h.year}년 건강검진</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${h.date} · ${h.clinic}</div>
      </div>
      <span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:10px;
        color:${isNormal?'#10B981':'#F59E0B'};background:${isNormal?'#D1FAE5':'#FEF3C7'}">
        ${h.result}
      </span>
    </div>
    ${h.note ? `<div style="font-size:11px;color:#F59E0B;font-weight:600">⚠️ ${h.note}</div>` : ''}
  </div>`;
  }).join('')}`;
}
