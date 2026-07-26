/**
 * flexible-benefit.js — 선택적 복리후생 사용 신청 (직원)
 * Route: #/flexible-benefit
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_flexible_benefits';
const ANNUAL_LIMIT = 600000;

const BENEFIT_CATEGORIES = [
  { id:'culture', name:'문화·여가',    icon:'🎭', desc:'공연·전시·영화' },
  { id:'sports',  name:'스포츠·헬스',  icon:'🏃', desc:'헬스장·운동시설' },
  { id:'travel',  name:'여행·레저',    icon:'✈️', desc:'숙박·교통' },
  { id:'edu',     name:'자기계발',     icon:'📖', desc:'강의·도서' },
  { id:'health',  name:'건강·의료',    icon:'💊', desc:'병원·약국' },
  { id:'family',  name:'가족 친화',    icon:'👨‍👩‍👧', desc:'어린이집·돌봄' },
];

function _session() { try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; } }
function _empId()   { return _session().empId || _session().userId || 'EMP001'; }
function _empName() { return _session().name || '직원'; }
function _empDept() { return _session().dept || _session().department || '일반'; }

function _demoFlexBenefits() {
  const uid = _empId(); const name = _empName(); const dept = _empDept();
  return [
    { id:`FB_${uid}_1`, empId:uid, empName:name, category:'culture', itemName:'국립극장 공연 관람', amount:50000, receiptDate:'2026-03-10', note:'팀원 추천 공연', status:'approved', reqDate:'2026-03-12' },
    { id:`FB_${uid}_2`, empId:uid, empName:name, category:'sports',  itemName:'헬스장 3개월 이용권', amount:120000, receiptDate:'2026-04-01', note:'', status:'approved', reqDate:'2026-04-02' },
    { id:`FB_${uid}_3`, empId:uid, empName:name, category:'edu',     itemName:'프로그래밍 온라인 강의', amount:80000, receiptDate:'2026-05-15', note:'Udemy 강의', status:'pending', reqDate:'2026-05-16' },
  ];
}

function _load() {
  const demo = _demoFlexBenefits();
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
  const all  = _load();
  const mine = all.filter(x => x.empId === _empId());
  const used = mine.filter(x => x.status === 'approved').reduce((s, x) => s + x.amount, 0);
  const remaining = ANNUAL_LIMIT - used;

  root.innerHTML = `
<div style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg,#F8FAFC)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--card-bg,#fff);border-bottom:1px solid var(--border,#E2E8F0);flex-shrink:0">
    <button id="fb-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text,#1E293B);padding:0;line-height:1">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700;color:var(--text,#1E293B)">🎁 선택적 복리후생</div>
      <div style="font-size:11px;color:var(--text-muted)">잔여 ${remaining.toLocaleString()}원 / 연 ${ANNUAL_LIMIT.toLocaleString()}원</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg,#fff);border-bottom:1px solid var(--border,#E2E8F0);flex-shrink:0">
    ${[['apply','사용 신청'],['history','내역']].map(([k,l]) => `
    <button class="fb-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">
    ${_tab === 'apply' ? _renderApply(remaining) : _renderHistory(mine, used, remaining)}
  </div>
</div>`;

  root.querySelector('#fb-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.fb-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _render(root); }));

  if (_tab === 'apply') {
    root.querySelector('#fb-submit').addEventListener('click', () => _submit(root, remaining));
  }
}

function _renderApply(remaining) {
  const pct = Math.min(100, Math.round(((ANNUAL_LIMIT - remaining) / ANNUAL_LIMIT) * 100));

  return `
<div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border-radius:14px;padding:16px;margin-bottom:14px;color:#fff">
  <div style="font-size:12px;opacity:0.8;margin-bottom:6px">사용 가능 잔액</div>
  <div style="font-size:26px;font-weight:800;margin-bottom:10px">${remaining.toLocaleString()}<span style="font-size:14px;font-weight:400">원</span></div>
  <div style="background:rgba(255,255,255,0.25);border-radius:99px;height:6px;margin-bottom:5px">
    <div style="background:var(--card-bg);height:6px;border-radius:99px;width:${100-pct}%"></div>
  </div>
  <div style="font-size:11px;opacity:0.75">연간 한도 ${ANNUAL_LIMIT.toLocaleString()}원 중 ${(ANNUAL_LIMIT-remaining).toLocaleString()}원 사용</div>
</div>

<div style="background:var(--card-bg,#fff);border:1px solid var(--border,#E2E8F0);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:12px">
  <div>
    <label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:5px">카테고리 *</label>
    <select id="fb-category" style="width:100%;padding:10px 12px;border:1.5px solid var(--border,#E2E8F0);border-radius:8px;font-size:13px;background:var(--bg,#F8FAFC);color:var(--text,#1E293B)">
      <option value="">선택하세요</option>
      ${BENEFIT_CATEGORIES.map(c => `<option value="${c.id}">${c.icon} ${c.name} (${c.desc})</option>`).join('')}
    </select>
  </div>
  <div>
    <label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:5px">항목명 *</label>
    <input id="fb-itemname" type="text" placeholder="예: 헬스장 월 이용권"
      style="width:100%;padding:10px 12px;border:1.5px solid var(--border,#E2E8F0);border-radius:8px;font-size:13px;background:var(--bg,#F8FAFC);color:var(--text,#1E293B);box-sizing:border-box">
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div>
      <label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:5px">금액 (원) *</label>
      <input id="fb-amount" type="number" min="0" step="1000" placeholder="0"
        style="width:100%;padding:10px 12px;border:1.5px solid var(--border,#E2E8F0);border-radius:8px;font-size:13px;background:var(--bg,#F8FAFC);color:var(--text,#1E293B);box-sizing:border-box">
    </div>
    <div>
      <label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:5px">사용일 *</label>
      <input id="fb-date" type="date"
        style="width:100%;padding:10px 12px;border:1.5px solid var(--border,#E2E8F0);border-radius:8px;font-size:13px;background:var(--bg,#F8FAFC);color:var(--text,#1E293B);box-sizing:border-box">
    </div>
  </div>
  <div>
    <label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:5px">비고</label>
    <textarea maxlength="500" id="fb-note" rows="2" placeholder="추가 메모 (선택)"
      style="width:100%;padding:10px 12px;border:1.5px solid var(--border,#E2E8F0);border-radius:8px;font-size:13px;background:var(--bg,#F8FAFC);color:var(--text,#1E293B);box-sizing:border-box;resize:vertical"></textarea>
  </div>
  <button id="fb-submit"
    style="width:100%;padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">
    신청하기
  </button>
</div>`;
}

function _renderHistory(mine, used, remaining) {
  const catMap = Object.fromEntries(BENEFIT_CATEGORIES.map(c => [c.id, c]));
  const pct    = Math.min(100, Math.round((used / ANNUAL_LIMIT) * 100));

  return `
<div style="background:var(--card-bg,#fff);border:1px solid var(--border,#E2E8F0);border-radius:14px;padding:16px;margin-bottom:14px">
  <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">연간 잔여 한도</div>
  <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:8px">
    <div style="font-size:22px;font-weight:800;color:#4F46E5">${remaining.toLocaleString()}<span style="font-size:12px;font-weight:400;color:var(--text-muted)">원</span></div>
    <div style="font-size:11px;color:var(--text-muted)">사용 ${used.toLocaleString()}원 / 한도 ${ANNUAL_LIMIT.toLocaleString()}원</div>
  </div>
  <div style="background:#E2E8F0;border-radius:99px;height:8px">
    <div style="background:#4F46E5;height:8px;border-radius:99px;width:${pct}%;transition:width 0.3s"></div>
  </div>
  <div style="font-size:11px;color:var(--text-muted);margin-top:5px;text-align:right">${pct}% 사용</div>
</div>

${!mine.length ? `
<div style="text-align:center;padding:50px 20px;color:var(--text-muted)">
  <div style="font-size:44px;margin-bottom:12px">🎁</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:6px">사용 내역이 없습니다</div>
      <button onclick="location.hash='#/flexible-benefit'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">복리후생 신청</button>
    
  <div style="font-size:12px">복리후생을 사용해보세요!</div>
</div>` : mine.map(x => {
  const cat = catMap[x.category] || { icon:'🎁', name:x.category };
  return `
<div style="background:var(--card-bg,#fff);border:1px solid var(--border,#E2E8F0);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:20px">${cat.icon}</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text,#1E293B)">${x.itemName}</div>
        <div style="font-size:11px;color:var(--text-muted)">${cat.name} · ${x.receiptDate}</div>
      </div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;flex-shrink:0;
      background:${STATUS_BG[x.status]};color:${STATUS_COLOR[x.status]}">${STATUS_LABEL[x.status]}</span>
  </div>
  <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
    <span style="font-size:11px;color:var(--text-muted)">신청일: ${x.reqDate}</span>
    <span style="font-size:14px;font-weight:700;color:#4F46E5">${x.amount.toLocaleString()}원</span>
  </div>
  ${x.note ? `<div style="font-size:11px;color:var(--text-muted);margin-top:5px;padding-top:5px;border-top:1px solid var(--border,#E2E8F0)">${x.note}</div>` : ''}
</div>`;
}).join('')}`;
}

function _submit(root, remaining) {
  const category = root.querySelector('#fb-category').value;
  const itemName = root.querySelector('#fb-itemname').value.trim();
  const amount   = parseInt(root.querySelector('#fb-amount').value);
  const date     = root.querySelector('#fb-date').value;
  const note     = root.querySelector('#fb-note').value.trim();

  if (!category) { showToast('카테고리를 선택하세요.', 'error'); return; }
  if (!itemName) { showToast('항목명을 입력하세요.', 'error'); return; }
  if (!amount || amount <= 0) { showToast('금액을 입력하세요.', 'error'); return; }
  if (!date)     { showToast('사용일을 선택하세요.', 'error'); return; }
  if (amount > remaining) { showToast(`잔여 한도(${remaining.toLocaleString()}원)를 초과합니다.`, 'error'); return; }

  const list = _load();
  list.push({
    id:          'FB_' + Date.now(),
    empId:       _empId(),
    empName:     _empName(),
    category,
    itemName,
    amount,
    receiptDate: date,
    note,
    status:      'pending',
    reqDate:     new Date().toISOString().slice(0, 10),
  });
  _save(list);
  showToast('복리후생 사용 신청이 완료되었습니다!', 'success')
    addNotification({ type: 'success', title: '복리후생 사용', body: '복리후생 사용 신청이 완료되었습니다!' });
  _tab = 'history';
  _render(root);
}
