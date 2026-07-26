/**
 * welfare-points.js — 복지 포인트 (직원)
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS_POINTS = 'hr_welfare_points';
const ANNUAL_LIMIT = 600000; // 연간 한도 60만원

const CATEGORIES = [
  { key:'culture',  label:'문화·여가',    icon:'🎭', examples:'영화·공연·도서' },
  { key:'health',   label:'건강·스포츠',  icon:'💪', examples:'헬스·수영·필라테스' },
  { key:'edu',      label:'자기계발',     icon:'📚', examples:'강의·자격증·세미나' },
  { key:'family',   label:'가족 친화',    icon:'👨‍👩‍👧', examples:'여행·가족 식사' },
  { key:'meal',     label:'식사·카페',    icon:'🍽️', examples:'점심·카페' },
  { key:'other',    label:'기타',         icon:'🎁', examples:'기타 복지 항목' },
];

const DEMO_HISTORY = [
  { id:'WP001', category:'culture', amount:30000, desc:'영화관람권 2매',        date:'2026-05-10', status:'approved' },
  { id:'WP002', category:'health',  amount:50000, desc:'헬스장 월 이용권',       date:'2026-04-15', status:'approved' },
  { id:'WP003', category:'edu',     amount:80000, desc:'온라인 강의 수강',       date:'2026-03-20', status:'approved' },
  { id:'WP004', category:'meal',    amount:25000, desc:'팀 점심 식대',           date:'2026-02-28', status:'approved' },
  { id:'WP005', category:'family',  amount:120000,'desc':'가족 여행 숙박',       date:'2026-01-05', status:'approved' },
];

function _empId() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').userId||'EMP001'; } catch { return 'EMP001'; } }

function _getData() {
  const s = localStorage.getItem(LS_POINTS);
  if (!s) {
    const demo = { empId:_empId(), history:DEMO_HISTORY };
    localStorage.setItem(LS_POINTS, JSON.stringify(demo));
    return demo;
  }
  try { return JSON.parse(s); } catch { return { empId:_empId(), history:[] }; }
}
function _save(d) { localStorage.setItem(LS_POINTS, JSON.stringify(d)); }

let _tab = 'balance';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _tab = 'balance'; _render(root); }
export function unmount() { _tab = 'balance'; }

function _render(root) {
  const data     = _getData();
  const history  = data.history || [];
  const usedAmt  = history.filter(h=>h.status==='approved').reduce((s,h)=>s+h.amount,0);
  const remaining = Math.max(0, ANNUAL_LIMIT - usedAmt);
  const usedPct   = Math.min(100, Math.round((usedAmt/ANNUAL_LIMIT)*100));

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div class="top-bar" style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="ob-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">💎 복지 포인트</div>
      <div style="font-size:11px;color:var(--text-muted)">잔여 <strong style="color:#4F46E5">${remaining.toLocaleString()}원</strong> / 연간 ${(ANNUAL_LIMIT/10000).toFixed(0)}만원</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['balance','잔액 현황'],['use','사용 신청'],['history','사용 내역']].map(([k,l])=>`
    <button class="wp-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='balance' ? _renderBalance(usedAmt, remaining, usedPct, history)
    : _tab==='use'     ? _renderUse()
    :                    _renderHistory(history)}
  </div>
</div>`;

  root.querySelector('#ob-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.wp-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _render(root); }));

  // 카테고리 카드 선택
  if (_tab === 'use') {
    const catCards = root.querySelectorAll('.wp-cat-card');
    const catHidden = root.querySelector('#wp-cat');
    catCards.forEach(card => {
      card.addEventListener('click', () => {
        catCards.forEach(c => { c.style.borderColor = 'var(--border)'; c.style.background = 'transparent'; });
        card.style.borderColor = '#4F46E5';
        card.style.background  = '#EEF2FF';
        const radio = card.querySelector('input[type=radio]');
        if (radio) { radio.checked = true; if (catHidden) catHidden.value = radio.value; }
      });
    });
  }

  // 사용 신청
  root.querySelector('#wp-submit-btn')?.addEventListener('click', () => {
    const cat    = root.querySelector('#wp-cat').value;
    const amount = parseInt(root.querySelector('#wp-amount').value)||0;
    const desc   = root.querySelector('#wp-desc').value.trim();
    const date   = root.querySelector('#wp-date').value;
    if (!amount || amount <= 0) { showToast('금액을 입력하세요.', 'error'); return; }
    if (!desc)   { showToast('사용 내역을 입력하세요.', 'error'); return; }
    if (!date)   { showToast('사용일을 선택하세요.', 'error'); return; }
    const data2 = _getData();
    const usedSoFar = (data2.history||[]).filter(h=>h.status==='approved').reduce((s,h)=>s+h.amount,0);
    if (usedSoFar + amount > ANNUAL_LIMIT) {
      showToast(`연간 한도(${(ANNUAL_LIMIT/10000).toFixed(0)}만원)를 초과합니다.`, 'error'); return;
    }
    data2.history = data2.history || [];
    data2.history.push({ id:'WP_'+Date.now(), category:cat, amount, desc, date, status:'approved' });
    _save(data2);
    showToast('복지 포인트 사용이 등록되었습니다.', 'success')
    addNotification({ type: 'success', title: '복지포인트', body: '복지 포인트 사용이 등록되었습니다.' });
    _tab = 'history';
    _render(root);
  });
}

function _renderBalance(usedAmt, remaining, usedPct, history) {
  const byCat = {};
  CATEGORIES.forEach(c => { byCat[c.key] = 0; });
  history.filter(h=>h.status==='approved').forEach(h => { byCat[h.category] = (byCat[h.category]||0) + h.amount; });

  return `
<!-- 잔액 카드 -->
<div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);border-radius:16px;
     padding:20px;margin-bottom:14px;color:#fff;text-align:center">
  <div style="font-size:12px;opacity:0.8;margin-bottom:6px">${new Date().getFullYear()}년 잔여 포인트</div>
  <div style="font-size:36px;font-weight:900;margin-bottom:4px">${remaining.toLocaleString()}<span style="font-size:18px">원</span></div>
  <div style="font-size:12px;opacity:0.75">사용 ${usedAmt.toLocaleString()}원 / 한도 ${ANNUAL_LIMIT.toLocaleString()}원</div>
  <div style="background:rgba(255,255,255,0.2);border-radius:99px;height:8px;margin-top:14px">
    <div style="background:var(--card-bg);height:8px;border-radius:99px;width:${usedPct}%"></div>
  </div>
  <div style="font-size:10px;opacity:0.7;margin-top:4px">${usedPct}% 사용</div>
</div>

<!-- 카테고리별 사용 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:10px">카테고리별 사용</div>
  ${CATEGORIES.map(c => {
    const amt = byCat[c.key]||0;
    if (!amt) return '';
    const pct = ANNUAL_LIMIT ? Math.round((amt/ANNUAL_LIMIT)*100) : 0;
    return `
  <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
    <span style="font-size:18px;flex-shrink:0">${c.icon}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:3px">${c.label}</div>
      <div style="background:#E2E8F0;border-radius:99px;height:4px">
        <div style="background:#4F46E5;height:4px;border-radius:99px;width:${pct}%"></div>
      </div>
    </div>
    <div style="font-size:12px;font-weight:700;color:#4F46E5;flex-shrink:0">${amt.toLocaleString()}원</div>
  </div>`;
  }).filter(Boolean).join('')}
  ${!Object.values(byCat).some(v=>v>0) ? `<div style="text-align:center;padding:20px;color:var(--text-muted)">
    <div style="font-size:32px;margin-bottom:6px">💎</div>
    <div style="font-size:12px">사용 내역이 없습니다.</div>
    <button onclick="location.hash='#/welfare-shop'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">복지포인트 사용</button>
    ` : ''}
</div>

<!-- 복지 제도 안내 -->
<div style="background:#EEF2FF;border-radius:12px;padding:12px;border-left:4px solid #4F46E5">
  <div style="font-size:12px;font-weight:700;color:#4338CA;margin-bottom:6px">ℹ️ 복지 포인트 안내</div>
  ${CATEGORIES.map(c=>`
  <div style="font-size:11px;color:#3730A3;margin-bottom:2px">${c.icon} ${c.label}: ${c.examples}</div>`).join('')}
</div>`;
}

function _renderUse() {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="font-size:13px;font-weight:700;margin-bottom:12px">💎 복지 포인트 사용 신청</div>

  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:6px;font-weight:600">카테고리</label>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
      ${CATEGORIES.map((c,i)=>`
      <label class="wp-cat-card" style="display:flex;flex-direction:column;align-items:center;padding:10px 6px;
             border:2px solid ${i===0?'#4F46E5':'var(--border)'};border-radius:10px;cursor:pointer;
             background:${i===0?'#EEF2FF':'transparent'}">
        <input type="radio" name="wp-cat-radio" value="${c.key}" ${i===0?'checked':''} style="position:absolute;opacity:0;pointer-events:none">
        <div style="font-size:20px;margin-bottom:3px">${c.icon}</div>
        <div style="font-size:10px;font-weight:600;text-align:center;color:var(--text)">${c.label}</div>
      </label>`).join('')}
    </div>
    <input type="hidden" id="wp-cat" value="${CATEGORIES[0].key}">
  </div>

  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">금액 (원)</label>
    <input id="wp-amount" type="number" min="0" placeholder="예: 30000"
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>

  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">사용일</label>
    <input id="wp-date" type="date" value="${new Date().toISOString().slice(0,10)}"
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>

  <div style="margin-bottom:16px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">사용 내역</label>
    <input id="wp-desc" type="text" placeholder="예: 넷플릭스 구독, 헬스장 1개월권"
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>

  <button id="wp-submit-btn"
    style="width:100%;background:#4F46E5;color:#fff;border:none;border-radius:12px;
           padding:13px;font-size:14px;font-weight:700;cursor:pointer">신청하기</button>
</div>`;
}

function _renderHistory(history) {
  const sorted = [...history].sort((a,b) => b.date.localeCompare(a.date));
  const total  = sorted.filter(h=>h.status==='approved').reduce((s,h)=>s+h.amount,0);
  return `
<div style="display:flex;justify-content:space-between;align-items:center;
     background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
     padding:12px 14px;margin-bottom:12px">
  <div style="font-size:12px;color:var(--text-muted)">총 사용 금액</div>
  <div style="font-size:16px;font-weight:800;color:#4F46E5">${total.toLocaleString()}원</div>
</div>
${!sorted.length ? `<div style="text-align:center;padding:36px;color:var(--text-muted)">
  <div style="font-size:36px;margin-bottom:10px">🎁</div>
  <div style="font-size:13px">사용 내역이 없습니다.</div>
  <button onclick="location.hash='#/welfare-shop'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">포인트 사용하기</button>
</div>` :
  sorted.map(h => {
    const cat = CATEGORIES.find(c=>c.key===h.category)||{icon:'🎁',label:h.category};
    return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:12px;margin-bottom:6px;display:flex;align-items:center;gap:10px">
    <div style="font-size:22px;flex-shrink:0">${cat.icon}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:600;color:var(--text)">${h.desc}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${cat.label} · ${h.date}</div>
    </div>
    <div style="font-size:14px;font-weight:800;color:#4F46E5;flex-shrink:0">-${h.amount.toLocaleString()}원</div>
  </div>`;
  }).join('')}`;
}
