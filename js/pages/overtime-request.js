/**
 * overtime-request.js — 연장·야간·휴일 근무 신청 (직원)
 * 근로기준법 제56조 — 연장 50%, 야간 50%, 휴일 50/100% 가산
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_overtime_requests';

const OT_TYPES = [
  { key:'extension', label:'연장근무', icon:'⏰', desc:'1일 8시간 초과 근무', rate:0.5 },
  { key:'night',     label:'야간근무', icon:'🌙', desc:'22:00~06:00 근무',   rate:0.5 },
  { key:'holiday',   label:'휴일근무', icon:'📅', desc:'주휴일·공휴일 근무', rate:0.5 },
];

const STATUS_META = {
  pending:  { label:'검토 중', color:'#F59E0B', bg:'#FEF3C7' },
  approved: { label:'승인',   color:'#10B981', bg:'#D1FAE5' },
  rejected: { label:'반려',   color:'#EF4444', bg:'#FEE2E2' },
};

// 기본 시급 (데모용)
const BASE_HOURLY = 18000;

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }
function _dept()    { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').department||'소속 미지정'; } catch { return '소속 미지정'; } }

function _getAll() { try { return JSON.parse(localStorage.getItem(LS)||'[]'); } catch { return []; } }
function _save(l)  { localStorage.setItem(LS, JSON.stringify(l)); }
function _mine()   { return _getAll().filter(r=>r.empId===_empId()); }

const TODAY = new Date().toISOString().slice(0,10);
const THIS_MONTH = TODAY.slice(0,7);

let _tab     = 'apply';
let _selType = 'extension';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _tab='apply'; _selType='extension'; _render(root); }
export function unmount() { _tab='apply'; }

function _calcPremium(hours, type) {
  const t = OT_TYPES.find(x=>x.key===type);
  const rate = type==='holiday' ? (hours>8?1.0:0.5) : (t?.rate||0.5);
  return Math.round(BASE_HOURLY * hours * rate);
}

function _render(root) {
  const mine = _mine().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const thisMonthHours = mine
    .filter(r=>r.status==='approved' && r.date.startsWith(THIS_MONTH))
    .reduce((s,r)=>s+(r.hours||0), 0);
  const pending = mine.filter(r=>r.status==='pending').length;

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div class="top-bar" style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="ot-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">⏱️ 연장·휴일 근무 신청</div>
      <div style="font-size:11px;color:var(--text-muted)">이번 달 승인 ${thisMonthHours}시간 · 대기 ${pending}건</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['apply','신청하기'],['history','내 신청']].map(([k,l])=>`
    <button class="ot-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='apply' ? _renderApply(thisMonthHours) : _renderHistory(mine)}
  </div>
</div>`;

  root.querySelector('#ot-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.ot-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(root); }));

  if (_tab==='apply') {
    root.querySelectorAll('.ot-type-card').forEach(card=>{
      card.addEventListener('click',()=>{
        root.querySelectorAll('.ot-type-card').forEach(c=>{ c.style.borderColor='var(--border)'; c.style.background='transparent'; });
        card.style.borderColor='#4F46E5'; card.style.background='#EEF2FF';
        _selType = card.dataset.type;
        _updatePreview(root);
      });
    });

    root.querySelector('#ot-hours')?.addEventListener('input', ()=>_updatePreview(root));

    root.querySelector('#ot-submit')?.addEventListener('click',()=>{
      const date   = root.querySelector('#ot-date').value;
      const start  = root.querySelector('#ot-start').value;
      const end    = root.querySelector('#ot-end').value;
      const hours  = parseFloat(root.querySelector('#ot-hours').value)||0;
      const reason = root.querySelector('#ot-reason').value.trim();
      if (!date)   { showToast('날짜를 선택하세요.','error'); return; }
      if (!hours || hours<=0) { showToast('시간을 입력하세요.','error'); return; }
      if (hours>12)  { showToast('1회 최대 12시간까지 신청 가능합니다.','error'); return; }
      if (!reason) { showToast('사유를 입력하세요.','error'); return; }

      const premium = _calcPremium(hours, _selType);
      const list = _getAll();
      list.push({
        id: 'OT_'+Date.now(),
        empId:_empId(), empName:_empName(), dept:_dept(),
        type:_selType, typeName:OT_TYPES.find(t=>t.key===_selType)?.label||_selType,
        date, startTime:start, endTime:end, hours, reason,
        premium, status:'pending',
        createdAt: new Date().toISOString(), comment:'',
      });
      _save(list);
      showToast(`${OT_TYPES.find(t=>t.key===_selType)?.label} 신청 완료!`,'success')
    addNotification({ type: 'success', title: '초과근무', body: '신청 완료!' });
      addNotification({ type: 'system', title: `연장근무 신청: ${date} ${hours}시간`, body: '' });
      _tab='history'; _render(root);
    });
  }
}

function _updatePreview(root) {
  const hours = parseFloat(root.querySelector('#ot-hours')?.value)||0;
  const premium = _calcPremium(hours, _selType);
  const el = root.querySelector('#ot-preview');
  if (el) el.textContent = premium>0 ? `예상 가산임금: ${premium.toLocaleString()}원` : '';
}

function _renderApply(usedHours) {
  const MONTHLY_LIMIT = 52; // 근로기준법 제53조: 연장근무 월 52시간 이내
  const pct = Math.min(100, Math.round((usedHours/MONTHLY_LIMIT)*100));

  return `
<!-- 이번 달 현황 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="display:flex;justify-content:space-between;margin-bottom:8px">
    <div style="font-size:12px;font-weight:700;color:var(--text)">${THIS_MONTH} 연장근무 현황</div>
    <div style="font-size:12px;font-weight:800;color:${usedHours>=MONTHLY_LIMIT?'#EF4444':'#4F46E5'}">${usedHours}/${MONTHLY_LIMIT}시간</div>
  </div>
  <div style="background:#E2E8F0;border-radius:99px;height:6px;margin-bottom:4px">
    <div style="background:${usedHours>=MONTHLY_LIMIT?'#EF4444':'#4F46E5'};height:6px;border-radius:99px;width:${pct}%"></div>
  </div>
  <div style="font-size:10px;color:var(--text-muted)">근로기준법 §53 — 연장근무 월 최대 ${MONTHLY_LIMIT}시간</div>
</div>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="font-size:13px;font-weight:700;margin-bottom:12px">⏱️ 연장근무 신청</div>

  <!-- 근무 유형 -->
  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:6px;font-weight:600">근무 유형</label>
    <div style="display:flex;gap:8px">
      ${OT_TYPES.map(t=>`
      <div class="ot-type-card" data-type="${t.key}"
        style="flex:1;padding:10px 6px;border:2px solid ${t.key===_selType?'#4F46E5':'var(--border)'};
               border-radius:10px;cursor:pointer;text-align:center;
               background:${t.key===_selType?'#EEF2FF':'transparent'}">
        <div style="font-size:18px;margin-bottom:2px">${t.icon}</div>
        <div style="font-size:10px;font-weight:700;color:var(--text)">${t.label}</div>
        <div style="font-size:9px;color:var(--text-muted);margin-top:1px">+${(t.rate*100).toFixed(0)}%</div>
      </div>`).join('')}
    </div>
  </div>

  <div style="margin-bottom:10px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">날짜</label>
    <input id="ot-date" type="date" value="${TODAY}"
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
    <div>
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">시작</label>
      <input id="ot-start" type="time" value="18:00"
        style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:10px;font-size:12px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
    <div>
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">종료</label>
      <input id="ot-end" type="time" value="21:00"
        style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:10px;font-size:12px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
    <div>
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">시간 수</label>
      <input id="ot-hours" type="number" value="3" min="0.5" max="12" step="0.5"
        style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:10px;font-size:12px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
  </div>

  <div id="ot-preview" style="font-size:12px;color:#10B981;font-weight:700;margin-bottom:10px;min-height:18px"></div>

  <div style="margin-bottom:14px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">사유</label>
    <textarea maxlength="500" id="ot-reason" rows="3" placeholder="연장근무가 필요한 이유를 구체적으로 작성하세요."
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box;resize:vertical"></textarea>
  </div>

  <button id="ot-submit"
    style="width:100%;background:#4F46E5;color:#fff;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer">신청하기</button>

  <div style="font-size:10px;color:var(--text-muted);text-align:center;margin-top:6px">근로기준법 제56조 — 연장·야간·휴일근로 가산임금 적용</div>
</div>`;
}

function _renderHistory(mine) {
  if (!mine.length) return `
<div style="text-align:center;padding:50px 20px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">📋</div>
  <div style="font-size:13px">신청 내역이 없습니다.</div>
      <button onclick="document.querySelector('[data-tab=apply]')?.click()" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">연장근무 신청</button>
    
</div>`;

  const approved = mine.filter(r=>r.status==='approved');
  const totalHours   = approved.reduce((s,r)=>s+(r.hours||0),0);
  const totalPremium = approved.reduce((s,r)=>s+(r.premium||0),0);

  return `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:16px;font-weight:800;color:#4F46E5">${totalHours}시간</div>
    <div style="font-size:10px;color:var(--text-muted)">승인 연장시간</div>
  </div>
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:16px;font-weight:800;color:#10B981">${totalPremium.toLocaleString()}원</div>
    <div style="font-size:10px;color:var(--text-muted)">예상 가산임금</div>
  </div>
</div>
${mine.map(r=>{
  const t = OT_TYPES.find(x=>x.key===r.type)||{icon:'⏰',label:r.typeName};
  const s = STATUS_META[r.status]||STATUS_META.pending;
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:13px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:18px">${t.icon}</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${t.label} · ${r.hours}시간</div>
        <div style="font-size:11px;color:var(--text-muted)">${r.date}${r.startTime?` ${r.startTime}~${r.endTime}`:''}</div>
      </div>
    </div>
    <span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:8px;color:${s.color};background:${s.bg}">${s.label}</span>
  </div>
  <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">${r.reason}</div>
  ${r.premium?`<div style="font-size:11px;font-weight:600;color:#10B981">가산 예상: ${r.premium.toLocaleString()}원</div>`:''}
  ${r.comment&&r.status!=='pending'?`<div style="font-size:11px;font-weight:600;color:${s.color};margin-top:4px">💬 ${r.comment}</div>`:''}
</div>`;
}).join('')}`;
}
