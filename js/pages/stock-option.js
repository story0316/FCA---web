/**
 * stock-option.js — 스톡옵션 조회 (읽기 전용)
 * Route: #/stock-option
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS_KEY = 'hr_stock_options';

function _load() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } }
function _session() { try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; } }
function _uid()   { return _session().empId || _session().userId || 'EMP001'; }
function _uname() { return _session().name || '직원'; }

function _demoOptions() {
  const uid = _uid(); const name = _uname();
  return [
    { id: `so_${uid}_1`, empId: uid, empName: name, grantDate: '2023-03-01', grantQty: 10000, vestedQty: 7500, exercisableQty: 5000, strikePrice: 15000, currentPrice: 24000, expiryDate: '2028-03-01', status: 'active' },
    { id: `so_${uid}_2`, empId: uid, empName: name, grantDate: '2024-03-01', grantQty: 5000, vestedQty: 1250, exercisableQty: 0, strikePrice: 18000, currentPrice: 24000, expiryDate: '2029-03-01', status: 'active' },
    { id: `so_${uid}_3`, empId: uid, empName: name, grantDate: '2022-03-01', grantQty: 3000, vestedQty: 3000, exercisableQty: 3000, strikePrice: 10000, currentPrice: 24000, expiryDate: '2027-03-01', status: 'exercised' },
  ];
}

function _merged() {
  const demo = _demoOptions();
  const saved = _load();
  return [...demo.filter(d => !saved.find(x => x.id === d.id)), ...saved];
}

const STATUS_META = {
  active:   { label: '보유 중',  bg: '#D1FAE5', color: '#059669' },
  exercised:{ label: '행사 완료', bg: '#EDE9FE', color: '#7C3AED' },
  expired:  { label: '만료됨',   bg: '#F1F5F9', color: 'var(--text-muted)' },
};

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _render(root);
}

export function unmount() {}

function _render(root) {
  const empId = _uid();
  const options = _merged().filter(o => o.empId === empId);

  const totalGranted = options.reduce((s, o) => s + (o.grantQty || 0), 0);
  const totalVested  = options.reduce((s, o) => s + (o.vestedQty || 0), 0);
  const totalExercisable = options.reduce((s, o) => s + (o.exercisableQty || 0), 0);

  const activeOptions = options.filter(o => o.status === 'active');
  const currentPrice = activeOptions.length ? activeOptions[0].currentPrice : 0;
  const estimatedProfit = activeOptions.reduce((s, o) => {
    const profit = (o.currentPrice - o.strikePrice) * o.exercisableQty;
    return s + Math.max(0, profit);
  }, 0);

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="so-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700;color:var(--text)">📈 스톡옵션</div>
      <div style="font-size:11px;color:var(--text-muted)">현재가 ${currentPrice.toLocaleString()}원 기준</div>
    </div>
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">
    <div style="max-width:480px;margin:0 auto">

      <!-- 요약 헤더 카드 -->
      <div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 50%,#EC4899 100%);border-radius:16px;padding:20px;margin-bottom:16px;color:#fff">
        <div style="font-size:12px;opacity:0.8;margin-bottom:12px">스톡옵션 요약</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;text-align:center">
          <div style="border-right:1px solid rgba(255,255,255,0.2)">
            <div style="font-size:11px;opacity:0.75;margin-bottom:4px">총 부여량</div>
            <div style="font-size:20px;font-weight:800">${totalGranted.toLocaleString()}</div>
            <div style="font-size:10px;opacity:0.7">주</div>
          </div>
          <div style="border-right:1px solid rgba(255,255,255,0.2)">
            <div style="font-size:11px;opacity:0.75;margin-bottom:4px">베스팅 완료</div>
            <div style="font-size:20px;font-weight:800">${totalVested.toLocaleString()}</div>
            <div style="font-size:10px;opacity:0.7">주</div>
          </div>
          <div>
            <div style="font-size:11px;opacity:0.75;margin-bottom:4px">행사 가능</div>
            <div style="font-size:20px;font-weight:800">${totalExercisable.toLocaleString()}</div>
            <div style="font-size:10px;opacity:0.7">주</div>
          </div>
        </div>
        ${estimatedProfit > 0 ? `
        <div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.2)">
          <div style="font-size:11px;opacity:0.75;margin-bottom:4px">예상 차익 (행사 가능 기준)</div>
          <div style="font-size:22px;font-weight:800">+${estimatedProfit.toLocaleString()}원</div>
        </div>` : ''}
      </div>

      <!-- 공지 배너 -->
      <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:#92400E;line-height:1.5">
        ⚠️ 행사 관련 문의는 CFO팀으로 연락하세요<br>
        <span style="font-size:11px;opacity:0.8">cfo@company.com · 내선 3000</span>
      </div>

      <!-- 개별 부여 내역 -->
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">부여 내역</div>

      ${options.length === 0 ? `
      <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
        <div style="font-size:40px;margin-bottom:10px">📈</div>
        <div style="font-size:14px;font-weight:600;margin-bottom:6px">부여된 스톡옵션이 없습니다</div>
      <button onclick="location.hash='#/stock-option'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">스톡옵션 조회</button>
    
        <div style="font-size:12px">인사팀에 문의해 주세요</div>
      </div>` : options.map(o => {
        const meta = STATUS_META[o.status] || STATUS_META.active;
        const profit = (o.currentPrice - o.strikePrice) * o.exercisableQty;
        const vestedPct = o.grantQty > 0 ? Math.round((o.vestedQty / o.grantQty) * 100) : 0;
        return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <div>
      <div style="font-size:13px;font-weight:700;color:var(--text)">부여일 ${o.grantDate}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:1px">만료일 ${o.expiryDate}</div>
    </div>
    <span style="padding:4px 10px;border-radius:8px;font-size:11px;font-weight:700;background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>

  <!-- 수량 그리드 -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px">
    ${[
      ['총 부여', o.grantQty, '#F1F5F9', 'var(--text-muted)'],
      ['베스팅', o.vestedQty, '#EEF2FF', '#4F46E5'],
      ['행사가능', o.exercisableQty, '#D1FAE5', '#059669'],
    ].map(([label, qty, bg, color]) => `
    <div style="background:${bg};border-radius:10px;padding:10px;text-align:center">
      <div style="font-size:10px;color:${color};font-weight:600;margin-bottom:4px">${label}</div>
      <div style="font-size:15px;font-weight:800;color:${color}">${(qty || 0).toLocaleString()}</div>
      <div style="font-size:10px;color:${color};opacity:0.7">주</div>
    </div>`).join('')}
  </div>

  <!-- 베스팅 진행률 -->
  <div style="margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <span style="font-size:11px;color:var(--text-muted)">베스팅 진행률</span>
      <span style="font-size:11px;font-weight:700;color:#4F46E5">${vestedPct}%</span>
    </div>
    <div style="height:6px;background:#E2E8F0;border-radius:3px;overflow:hidden">
      <div style="width:${vestedPct}%;height:100%;background:linear-gradient(90deg,#4F46E5,#7C3AED);border-radius:3px;transition:width 0.3s"></div>
    </div>
  </div>

  <!-- 가격 정보 -->
  <div style="background:#F8FAFC;border-radius:10px;padding:10px 12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <span style="font-size:12px;color:var(--text-muted)">행사가</span>
      <span style="font-size:13px;font-weight:700;color:var(--text)">${(o.strikePrice || 0).toLocaleString()}원</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <span style="font-size:12px;color:var(--text-muted)">현재가</span>
      <span style="font-size:13px;font-weight:700;color:#059669">${(o.currentPrice || 0).toLocaleString()}원</span>
    </div>
    ${o.exercisableQty > 0 ? `
    <div style="border-top:1px solid var(--border);padding-top:6px;margin-top:4px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:12px;color:var(--text-muted)">행사시 예상 차익</span>
      <span style="font-size:14px;font-weight:800;color:${profit > 0 ? '#059669' : '#EF4444'}">
        ${profit >= 0 ? '+' : ''}${profit.toLocaleString()}원
      </span>
    </div>` : ''}
  </div>
</div>`;
      }).join('')}

      <!-- 하단 주의 안내 -->
      <div style="background:#F8FAFC;border:1px solid var(--border);border-radius:10px;padding:12px;margin-top:4px;margin-bottom:20px">
        <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:6px">📌 유의사항</div>
        <ul style="margin:0;padding-left:16px;font-size:11px;color:var(--text-muted);line-height:1.8">
          <li>스톡옵션 행사는 세금 및 법적 의무가 발생할 수 있습니다</li>
          <li>행사 전 반드시 CFO팀 또는 세무사와 상담하세요</li>
          <li>현재가는 마지막 기준일 기준이며 실시간 데이터가 아닙니다</li>
          <li>행사 관련 문의: CFO팀 cfo@company.com</li>
        </ul>
      </div>
    </div>
  </div>
</div>`;

  root.querySelector('#so-back').addEventListener('click', () => window.navBack());

  // Info button for CFO contact
  root.querySelectorAll('[data-cfo-contact]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      showToast('CFO팀 이메일: cfo@company.com · 내선 3000', 'info', 5000);
      addNotification({ type: 'info', title: '스톡옵션', body: 'CFO팀 이메일: cfo@company.com · 내선 3000' });
    });
  });
}
