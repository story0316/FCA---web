/**
 * business-trip-admin.js — 출장 승인 관리
 */

import { loadDisplayEmployees } from '../../data/demo_employees.js';
import { showToast } from '../../components/toast.js'
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_business_trips';

const PURPOSES = {
  client:   { label: '고객사 방문',   icon: '🤝' },
  conf:     { label: '컨퍼런스/전시', icon: '🎪' },
  training: { label: '교육/연수',      icon: '📚' },
  sales:    { label: '영업/제안',      icon: '💼' },
  audit:    { label: '현장 실사',      icon: '🔍' },
  other:    { label: '기타',           icon: '✈️' },
};

const STATUS_META = {
  draft:    { label: '임시저장',  bg: '#F1F5F9', color: '#64748B' },
  pending:  { label: '검토 중',   bg: '#FEF3C7', color: '#D97706' },
  approved: { label: '승인',      bg: '#D1FAE5', color: '#059669' },
  rejected: { label: '반려',      bg: '#FEE2E2', color: '#EF4444' },
  completed:{ label: '완료',      bg: '#EDE9FE', color: '#7C3AED' },
};

const MONTHLY_BUDGET = 10000000; // 월 1000만원 예산

let _employees = [];

function _load()    { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } }
function _save(d)   { localStorage.setItem(LS, JSON.stringify(d)); }
function _emp(id)   { return _employees.find(e => e.id === id || e.employee_id === id); }

// 데모 시딩
function _seed(all) {
  if (all.length >= 10) return all;
  const seeded = [...all];
  const dests = ['서울 강남', '부산', '제주', '오사카', '도쿄', '싱가포르', '상하이'];
  const keys  = Object.keys(PURPOSES);
  const trans = ['KTX/기차','항공','항공','자동차','버스'];
  const statuses = ['pending','approved','approved','rejected','completed'];
  _employees.slice(0,8).forEach((emp, i) => {
    const d = new Date(); d.setDate(d.getDate() + (i * 7 - 14));
    const end = new Date(d); end.setDate(end.getDate() + [1,2,3,1,4][i%5]);
    seeded.push({
      id:           `demo_bt_${emp.id}`,
      userId:       emp.id || emp.employee_id,
      purpose:      keys[i % keys.length],
      destination:  dests[i % dests.length],
      startDate:    d.toISOString().slice(0,10),
      endDate:      end.toISOString().slice(0,10),
      transport:    trans[i % trans.length],
      accommodation:i % 3 !== 0,
      budget:       [150000,320000,480000,200000,750000][i%5],
      detail:       '정기 방문 미팅',
      companions:   i%2===0 ? '' : _employees[(i+1)%(_employees.length||1)]?.name || '',
      status:       statuses[i % statuses.length],
      createdAt:    new Date(d.getTime() - 86400000 * 3).toISOString(),
    });
  });
  return seeded;
}

let _tab = 'pending';
let _sel  = null;

export async function mount(root) {
  _tab = 'pending'; _sel = null;
  root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">⏳</div><div style="font-size:13px">로딩 중…</div></div>`;
  _employees = await loadDisplayEmployees();
  _draw(root);
}

export function render(root) { _tab = 'pending'; _sel = null; _draw(root); }
export function unmount() { _tab = 'pending'; _sel = null; _employees = []; }

function _draw(root) {
  const raw = _load();
  const all = _seed(raw);

  const now   = new Date().toISOString().slice(0,7);
  const month = all.filter(t => t.startDate?.startsWith(now));
  const monthBudget = month.filter(t => t.status === 'approved' || t.status === 'completed')
    .reduce((s,t) => s + (t.budget||0), 0);
  const budgetPct = Math.min(100, Math.round(monthBudget / MONTHLY_BUDGET * 100));
  const budgetColor = budgetPct >= 80 ? '#EF4444' : budgetPct >= 60 ? '#F59E0B' : '#10B981';

  const counts = { pending: 0, approved: 0, rejected: 0, completed: 0 };
  all.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });

  root.innerHTML = `
<!-- 이번 달 예산 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="display:flex;justify-content:space-between;margin-bottom:6px">
    <span style="font-size:12px;font-weight:700;color:var(--text)">이번 달 출장 예산 소진</span>
    <span style="font-size:12px;color:#64748B">${monthBudget.toLocaleString()}원 / ${MONTHLY_BUDGET.toLocaleString()}원</span>
  </div>
  <div style="height:10px;background:#E2E8F0;border-radius:5px;overflow:hidden">
    <div style="height:100%;width:${budgetPct}%;background:${budgetColor};border-radius:5px;transition:width .4s"></div>
  </div>
  <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:10px;color:#94A3B8">
    <span>0</span><span style="color:${budgetColor};font-weight:700">${budgetPct}%</span><span>100%</span>
  </div>
</div>

<!-- KPI -->
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:14px">
  ${[
    { l:'검토 중',  v: counts.pending,   c:'#F59E0B' },
    { l:'승인',     v: counts.approved,  c:'#10B981' },
    { l:'반려',     v: counts.rejected,  c:'#EF4444' },
    { l:'완료',     v: counts.completed, c:'#7C3AED' },
  ].map(k=>`
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:8px;text-align:center">
      <div style="font-size:20px;font-weight:900;color:${k.c}">${k.v}</div>
      <div style="font-size:10px;color:#64748B">${k.l}</div>
    </div>`).join('')}
</div>

<!-- 탭 -->
<div style="display:flex;border-bottom:1px solid var(--border);margin-bottom:12px">
  ${Object.entries(STATUS_META).filter(([k])=>k!=='draft').map(([k,m])=>`
    <button class="bta-tab" data-t="${k}"
      style="flex:1;padding:8px 4px;font-size:10px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};color:${_tab===k?'#4F46E5':'#64748B'}">
      ${m.label}
    </button>`).join('')}
</div>

<!-- 목록 -->
<div id="bta-list">${_renderList(all)}</div>
<div id="bta-detail">${_sel ? _renderDetail(all) : ''}</div>`;

  root.querySelectorAll('.bta-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _sel = null; _draw(root); });
  });
  root.querySelectorAll('.bta-item').forEach(el => {
    el.addEventListener('click', () => {
      _sel = _sel === el.dataset.id ? null : el.dataset.id;
      document.getElementById('bta-detail').innerHTML = _renderDetail(_seed(_load()));
      _bindDetail(root);
    });
  });
  _bindDetail(root);
}

function _renderList(all) {
  const filtered = all.filter(t => t.status === _tab);
  if (!filtered.length) return `
<div style="text-align:center;padding:30px 16px;color:#94A3B8">
  <div style="font-size:28px;margin-bottom:6px">📭</div>
  <div style="font-size:12px">${STATUS_META[_tab]?.label} 건이 없습니다</div>
</div>`;

  return filtered.map(t => {
    const emp  = _emp(t.userId);
    const purp = PURPOSES[t.purpose] || { icon:'✈️', label:'기타' };
    const meta = STATUS_META[t.status] || STATUS_META.pending;
    const days = Math.max(1, Math.round((new Date(t.endDate) - new Date(t.startDate)) / 86400000) + 1);
    return `
<div class="bta-item" data-id="${t.id}"
  style="background:var(--card-bg);border:1px solid ${_sel===t.id?'#4F46E5':'var(--border)'};
         border-radius:11px;padding:12px;margin-bottom:7px;cursor:pointer">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:5px">
    <div style="display:flex;gap:8px;align-items:center">
      <span style="font-size:20px">${purp.icon}</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${emp ? emp.name : t.userId}</div>
        <div style="font-size:11px;color:#64748B">${emp ? (emp.department||emp.dept||'') : ''} · ${t.destination}</div>
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:12px;font-weight:700;color:#4F46E5">${(t.budget||0).toLocaleString()}원</div>
      <div style="font-size:10px;color:#94A3B8">${days}박 ${days}일</div>
    </div>
  </div>
  <div style="display:flex;gap:6px;font-size:11px;color:#94A3B8">
    <span>${t.startDate} ~ ${t.endDate}</span>
    <span>· ${t.transport}</span>
    ${t.accommodation ? '<span>· 숙박</span>' : ''}
  </div>
</div>`;
  }).join('');
}

function _renderDetail(all) {
  const t = all.find(x => x.id === _sel);
  if (!t) return '';
  const emp  = _emp(t.userId);
  const purp = PURPOSES[t.purpose] || { icon:'✈️', label:'기타' };
  const meta = STATUS_META[t.status] || STATUS_META.pending;
  const days = Math.max(1, Math.round((new Date(t.endDate) - new Date(t.startDate)) / 86400000) + 1);

  return `
<div style="background:var(--card-bg);border:2px solid #4F46E5;border-radius:14px;padding:16px;margin-top:4px">
  <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:12px">상세 / 처리</div>
  <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:14px;font-size:12px">
    <div style="display:flex;gap:8px"><span style="color:#94A3B8;width:72px;flex-shrink:0">신청자</span><span style="font-weight:700;color:var(--text)">${emp?emp.name:t.userId}</span></div>
    <div style="display:flex;gap:8px"><span style="color:#94A3B8;width:72px;flex-shrink:0">소속</span><span style="color:var(--text)">${emp?(emp.department||emp.dept||'-'):'-'}</span></div>
    <div style="display:flex;gap:8px"><span style="color:#94A3B8;width:72px;flex-shrink:0">출장지</span><span style="font-weight:700;color:var(--text)">${t.destination}</span></div>
    <div style="display:flex;gap:8px"><span style="color:#94A3B8;width:72px;flex-shrink:0">목적</span><span style="color:var(--text)">${purp.icon} ${purp.label}</span></div>
    <div style="display:flex;gap:8px"><span style="color:#94A3B8;width:72px;flex-shrink:0">일정</span><span style="color:var(--text)">${t.startDate} ~ ${t.endDate} (${days}박 ${days}일)</span></div>
    <div style="display:flex;gap:8px"><span style="color:#94A3B8;width:72px;flex-shrink:0">교통</span><span style="color:var(--text)">${t.transport}${t.accommodation?' · 숙박':''}</span></div>
    <div style="display:flex;gap:8px"><span style="color:#94A3B8;width:72px;flex-shrink:0">예상경비</span><span style="font-weight:800;font-size:14px;color:#4F46E5">${(t.budget||0).toLocaleString()}원</span></div>
    ${t.companions ? `<div style="display:flex;gap:8px"><span style="color:#94A3B8;width:72px;flex-shrink:0">동행자</span><span style="color:var(--text)">${t.companions}</span></div>` : ''}
    ${t.detail ? `<div style="display:flex;gap:8px"><span style="color:#94A3B8;width:72px;flex-shrink:0">내용</span><span style="color:var(--text)">${t.detail}</span></div>` : ''}
    <div style="display:flex;gap:8px"><span style="color:#94A3B8;width:72px;flex-shrink:0">상태</span><span style="padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;background:${meta.bg};color:${meta.color}">${meta.label}</span></div>
  </div>

  <textarea id="bta-comment" placeholder="처리 코멘트 (선택)" rows="2"
    style="width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--border);border-radius:8px;
           font-size:12px;background:var(--card-bg);color:var(--text);resize:none;margin-bottom:10px">${t.adminComment||''}</textarea>

  <div style="display:flex;gap:8px;flex-wrap:wrap">
    ${t.status !== 'approved'  ? `<button id="bta-approve"  style="flex:1;padding:9px;background:#10B981;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">✅ 승인</button>` : ''}
    ${t.status === 'approved'  ? `<button id="bta-complete" style="flex:1;padding:9px;background:#7C3AED;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">✈️ 완료 처리</button>` : ''}
    ${t.status !== 'rejected'  ? `<button id="bta-reject"   style="flex:1;padding:9px;background:#EF4444;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">❌ 반려</button>` : ''}
  </div>
</div>`;
}

function _bindDetail(root) {
  const getComment = () => (root.querySelector('#bta-comment') || { value: '' }).value.trim();
  root.querySelector('#bta-approve')?.addEventListener('click',  () => _update(root, 'approved',  getComment()));
  root.querySelector('#bta-complete')?.addEventListener('click', () => _update(root, 'completed', getComment()));
  root.querySelector('#bta-reject')?.addEventListener('click',   () => _update(root, 'rejected',  getComment()));
}

function _update(root, newStatus, comment) {
  const all = _load();
  const idx = all.findIndex(t => t.id === _sel);
  if (idx < 0) { showToast('데모 데이터는 수정할 수 없습니다.', 'error'); _sel = null; _draw(root); return; }
  all[idx].status = newStatus;
  all[idx].adminComment = comment;
  all[idx].processedAt  = new Date().toISOString();
  _save(all);
  showToast(`"${STATUS_META[newStatus]?.label}" 처리 완료`);
      addNotification({ type: "success", title: "출장 신청 관리", body: `"${STATUS_META[newStatus]?.label}" 처리 완료` });
  _tab = newStatus;
  _sel = null;
  _draw(root);
}
