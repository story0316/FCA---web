/**
 * leave-promotion.js — 연차 촉진 발송 관리 (관리자)
 * 근로기준법 제61조 — 법정 연차 촉진 통보 (1차/2차)
 */

import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';
import { getAllLeaveRequests, getLeaveBalance } from '../../utils/leave-engine.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';

const LS_PROMOTION = 'hr_leave_promotions';

let _employees = [];

const YEAR = new Date().getFullYear();

function _getPromotions() {
  try { return JSON.parse(localStorage.getItem(LS_PROMOTION) || '[]'); } catch { return []; }
}

function _savePromotions(list) {
  localStorage.setItem(LS_PROMOTION, JSON.stringify(list));
}

function _getYearsOfService(hireDate) {
  const hire = new Date(hireDate);
  const now  = new Date();
  return (now - hire) / (365.25 * 86400000);
}

function _calcRemainingLeave(emp) {
  const yos = _getYearsOfService(emp.hire_date || emp.hireDate);
  if (yos < 1) return 0;
  const entitlement = yos >= 3 ? 15 + Math.floor((yos - 1) / 2) : 15;
  const used = Math.floor(Math.random() * entitlement * 0.6);
  return Math.max(0, Math.min(entitlement, entitlement - used));
}

function _getPromoStatus(empId) {
  const promos = _getPromotions().filter(p => p.empId === empId && p.year === YEAR);
  const r1 = promos.find(p => p.round === 1);
  const r2 = promos.find(p => p.round === 2);
  return { r1, r2 };
}

export function render(root) {
  _renderPage(root);
}

export function unmount() {}

function _renderPage(root) {
  const today = new Date();
  const month = today.getMonth() + 1;

  const empsWithLeave = _employees
    .filter(e => _getYearsOfService(e.hire_date || e.hireDate) >= 1)
    .map(e => ({
      ...e,
      remaining: _calcRemainingLeave(e),
      promoStatus: _getPromoStatus(e.id),
    }))
    .filter(e => e.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);

  const needPromo1 = empsWithLeave.filter(e => !e.promoStatus.r1 && month >= 6 && e.remaining >= 3);
  const needPromo2 = empsWithLeave.filter(e => e.promoStatus.r1 && !e.promoStatus.r2 && month >= 10 && e.remaining > 0);
  const allSent    = empsWithLeave.filter(e => e.promoStatus.r1);

  root.innerHTML = `
<div style="padding:16px">

  <!-- 헤더 -->
  <div style="font-size:15px;font-weight:700;margin-bottom:14px">📅 연차 촉진 관리</div>

  <!-- 법령 안내 -->
  <div style="background:#EEF2FF;border-radius:12px;padding:12px;margin-bottom:16px;border-left:4px solid #4F46E5">
    <div style="font-size:12px;font-weight:700;color:#4338CA;margin-bottom:4px">⚖️ 근로기준법 제61조 — 연차 촉진</div>
    <div style="font-size:11px;color:#3730A3;line-height:1.7">
      <strong>1차 촉진</strong>: 사용 기간 만료 6개월 전 (7월 이전) — 잔여일수 서면 통지<br>
      <strong>2차 촉진</strong>: 만료 2개월 전 (10월 이전) — 사용 시기 지정 통보<br>
      법정 절차 이행 시 미사용 연차수당 <strong>지급 의무 면제</strong>
    </div>
  </div>

  <!-- 현황 KPI -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
    ${[
      { label:'촉진 대상',   value: empsWithLeave.length + '명', color:'#4F46E5' },
      { label:'1차 발송 필요', value: needPromo1.length + '명',   color:'#F59E0B' },
      { label:'2차 발송 필요', value: needPromo2.length + '명',   color:'#EF4444' },
    ].map(k => `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
         padding:12px;text-align:center">
      <div style="font-size:22px;font-weight:800;color:${k.color}">${k.value}</div>
      <div style="font-size:10px;color:#64748B;margin-top:2px">${k.label}</div>
    </div>`).join('')}
  </div>

  <!-- 1차 촉진 대기 -->
  ${needPromo1.length ? `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
       padding:14px;margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div>
        <div style="font-size:13px;font-weight:700">📨 1차 촉진 대상 (${needPromo1.length}명)</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">잔여 연차 3일 이상 · 미발송</div>
      </div>
      <button id="send-all-1" style="background:#4F46E5;color:#fff;border:none;border-radius:8px;
        padding:7px 12px;font-size:12px;font-weight:600;cursor:pointer">전체 발송</button>
    </div>
    ${needPromo1.map(e => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--text)">${e.name}</div>
        <div style="font-size:11px;color:#64748B">${e.dept} · 잔여 <strong style="color:#EF4444">${e.remaining}일</strong></div>
      </div>
      <button class="send-1-btn" data-id="${e.id}" data-name="${e.name}" data-rem="${e.remaining}"
        style="background:#EEF2FF;color:#4338CA;border:none;border-radius:8px;
               padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer">발송</button>
    </div>`).join('')}
  </div>` : `
  <div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:12px;padding:12px;margin-bottom:12px">
    <div style="font-size:13px;color:#15803D;font-weight:600">✅ 1차 촉진 발송 완료 또는 대상 없음</div>
  </div>`}

  <!-- 2차 촉진 대기 -->
  ${needPromo2.length ? `
  <div style="background:var(--card-bg);border:2px solid #F59E0B;border-radius:14px;
       padding:14px;margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div>
        <div style="font-size:13px;font-weight:700;color:#D97706">⚡ 2차 촉진 대상 (${needPromo2.length}명)</div>
        <div style="font-size:11px;color:#92400E;margin-top:2px">1차 발송 완료 · 아직 미사용</div>
      </div>
      <button id="send-all-2" style="background:#F59E0B;color:#fff;border:none;border-radius:8px;
        padding:7px 12px;font-size:12px;font-weight:600;cursor:pointer">전체 발송</button>
    </div>
    ${needPromo2.map(e => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--text)">${e.name}</div>
        <div style="font-size:11px;color:#64748B">${e.dept} · 잔여 <strong style="color:#EF4444">${e.remaining}일</strong> · 1차: ${e.promoStatus.r1?.sentAt?.slice(0,10)}</div>
      </div>
      <button class="send-2-btn" data-id="${e.id}" data-name="${e.name}" data-rem="${e.remaining}"
        style="background:#FEF3C7;color:#92400E;border:none;border-radius:8px;
               padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer">발송</button>
    </div>`).join('')}
  </div>` : ''}

  <!-- 발송 이력 -->
  <div style="font-size:12px;font-weight:700;color:#64748B;margin-bottom:8px">발송 이력</div>
  ${_getPromotions().filter(p => p.year === YEAR).length === 0
    ? `<div style="text-align:center;padding:28px;color:#94A3B8">
        <div style="font-size:32px;margin-bottom:8px">📭</div>
        <div style="font-size:13px">발송 이력이 없습니다.</div>
      </div>`
    : _getPromotions().filter(p => p.year === YEAR)
        .sort((a,b) => b.sentAt.localeCompare(a.sentAt))
        .map(p => `
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;
           padding:10px 12px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <span style="font-size:12px;font-weight:600;color:var(--text)">${p.empName}</span>
          <span style="background:${p.round===1?'#EEF2FF':'#FEF3C7'};color:${p.round===1?'#4338CA':'#92400E'};
            font-size:10px;padding:2px 7px;border-radius:8px;font-weight:700;margin-left:6px">${p.round}차 촉진</span>
        </div>
        <div style="font-size:11px;color:#94A3B8">${p.sentAt.slice(0,10)} · 잔여 ${p.remaining}일</div>
      </div>`).join('')}

</div>`;

  // 1차 발송 개별
  root.querySelectorAll('.send-1-btn').forEach(btn => _bindSend(btn, root, 1));
  root.querySelectorAll('.send-2-btn').forEach(btn => _bindSend(btn, root, 2));

  // 전체 발송
  root.querySelector('#send-all-1')?.addEventListener('click', () => {
    needPromo1.forEach(e => _sendPromotion(e.id, e.name, e.remaining, 1));
    showToast(`${needPromo1.length}명에게 1차 연차 촉진을 발송했습니다.`, 'success')
      addNotification({ type: 'success', title: 'Leave Promotion (관리자)', body: '명에게 1차 연차 촉진을 발송했습니다.' });
    addNotification({ type: 'system', title: `연차 1차 촉진 ${needPromo1.length}명 발송 완료`, body: '' });
    _renderPage(root);
  });

  root.querySelector('#send-all-2')?.addEventListener('click', () => {
    needPromo2.forEach(e => _sendPromotion(e.id, e.name, e.remaining, 2));
    showToast(`${needPromo2.length}명에게 2차 연차 촉진을 발송했습니다.`, 'success')
      addNotification({ type: 'success', title: 'Leave Promotion (관리자)', body: '명에게 2차 연차 촉진을 발송했습니다.' });
    addNotification({ type: 'system', title: `연차 2차 촉진 ${needPromo2.length}명 발송 완료`, body: '' });
    _renderPage(root);
  });
}

function _bindSend(btn, root, round) {
  btn.addEventListener('click', () => {
    _sendPromotion(btn.dataset.id, btn.dataset.name, parseInt(btn.dataset.rem), round);
    showToast(`${btn.dataset.name}님에게 ${round}차 연차 촉진을 발송했습니다.`, 'success')
      addNotification({ type: 'success', title: 'Leave Promotion (관리자)', body: '님에게 차 연차 촉진을 발송했습니다.' });
    _renderPage(root);
  });
}

function _sendPromotion(empId, empName, remaining, round) {
  const promos = _getPromotions();
  if (promos.find(p => p.empId === empId && p.year === YEAR && p.round === round)) return;
  promos.push({
    id: `PROMO_${empId}_${YEAR}_${round}`,
    empId, empName, remaining, round, year: YEAR,
    sentAt: new Date().toISOString(),
  });
  _savePromotions(promos);
}
export async function mount(root) {
  _employees = await loadDisplayEmployees();
  return render(root);
}
