/**
 * business-card-admin.js — 명함 발주 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification, addNotificationForUser } from '../../components/notification-hub.js';

const LS = 'hr_business_cards';

const STATUS_LABEL = { pending:'대기', approved:'승인', printing:'인쇄 중', delivered:'배송 완료', rejected:'반려' };
const STATUS_COLOR = { pending:'#F59E0B', approved:'#3B82F6', printing:'#8B5CF6', delivered:'#10B981', rejected:'#EF4444' };
const STATUS_FLOW  = { pending:'approved', approved:'printing', printing:'delivered' };

const LEGACY_IDS = new Set(['BC001', 'BC002', 'BC003', 'BC004', 'BC005', 'BC006', 'BC007']);

function _getData() {
  try {
    const d = JSON.parse(localStorage.getItem(LS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_IDS.has(r.id));
    if (cleaned.length !== list.length) _save(cleaned);
    return cleaned;
  } catch { return []; }
}
function _save(d) { localStorage.setItem(LS, JSON.stringify(d)); }

let _tab  = 'overview';
let _root = null;

export function render(root) { _root = root; _tab = 'overview'; _draw(); }
export function unmount()    { _root = null; _tab = 'overview'; }

function _draw() {
  const data    = _getData();
  const pending = data.filter(r=>r.status==='pending').length;

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['overview','개요'],['pending',`대기 신청${pending?` <span style="background:#EF4444;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${pending}</span>`:''}`],['all','전체 내역']].map(([k,l])=>`
    <button class="bca-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='overview' ? _renderOverview(data)
    : _tab==='pending'  ? _renderPending(data)
    :                     _renderAll(data)}
  </div>
</div>`;

  _root.querySelectorAll('.bca-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents(data);
}

// ── Tab: 개요 ───────────────────────────────────────────────────
function _renderOverview(data) {
  const thisMonth = new Date().toISOString().slice(0,7);
  const mo        = data.filter(r=>r.reqDate.startsWith(thisMonth));
  const totalQty  = data.filter(r=>r.status==='delivered').reduce((s,r)=>s+r.qty, 0);
  const pending   = data.filter(r=>r.status==='pending').length;

  // 월별 발주 수량 트렌드
  const byMonth = {};
  data.forEach(r=>{ const m=r.reqDate.slice(0,7); byMonth[m]=(byMonth[m]||0)+r.qty; });
  const months  = Object.keys(byMonth).sort().slice(-6);
  const maxQty  = Math.max(...months.map(m=>byMonth[m]||0), 1);

  // 종류별
  const stdCnt  = data.filter(r=>r.type==='standard').length;
  const prmCnt  = data.filter(r=>r.type==='premium').length;

  return `
<!-- KPI -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
  ${[
    ['이번 달 신청', `${mo.length}건`, '📋', '#4F46E5'],
    ['대기 중', `${pending}건`, '⏳', '#F59E0B'],
    ['누적 배송 완료', `${data.filter(r=>r.status==='delivered').length}건`, '✅', '#10B981'],
    ['총 발주 수량', `${totalQty.toLocaleString()}장`, '💼', '#8B5CF6'],
  ].map(([l,v,ic,c])=>`
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px">
    <div style="font-size:18px;margin-bottom:4px">${ic}</div>
    <div style="font-size:18px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8;margin-top:2px">${l}</div>
  </div>`).join('')}
</div>

<!-- 종류 비율 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
  <div style="font-size:13px;font-weight:700;margin-bottom:10px">명함 종류 비율</div>
  ${[['일반 명함', stdCnt, '#3B82F6'],['프리미엄 명함', prmCnt, '#8B5CF6']].map(([l,c,col])=>{
    const total = stdCnt + prmCnt || 1;
    const pct = Math.round((c/total)*100);
    return `
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
    <div style="width:64px;font-size:11px;font-weight:600;color:var(--text)">${l}</div>
    <div style="flex:1">
      <div style="background:#E2E8F0;border-radius:99px;height:6px">
        <div style="background:${col};height:6px;border-radius:99px;width:${pct}%"></div>
      </div>
    </div>
    <div style="font-size:11px;font-weight:700;color:${col};width:40px;text-align:right">${c}건(${pct}%)</div>
  </div>`;}).join('')}
</div>

<!-- 월별 발주 수량 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:12px">월별 발주 수량 추이</div>
  <div style="display:flex;align-items:flex-end;gap:6px;height:70px">
    ${months.map(m=>{
      const qty = byMonth[m]||0;
      const h   = Math.round((qty/maxQty)*60)+4;
      return `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
      <div style="font-size:9px;color:#64748B">${qty||''}</div>
      <div style="width:100%;background:#4F46E5;border-radius:4px 4px 0 0;height:${h}px"></div>
      <div style="font-size:8px;color:#94A3B8">${m.slice(5)}월</div>
    </div>`;}).join('')}
  </div>
</div>`;
}

// ── Tab: 대기 신청 ──────────────────────────────────────────────
function _renderPending(data) {
  const pending = data.filter(r=>r.status==='pending');

  if (!pending.length) return `
<div style="text-align:center;padding:40px;color:#94A3B8">
  <div style="font-size:32px;margin-bottom:8px">✅</div>
  <div style="font-size:13px">대기 중인 신청이 없습니다.</div>
</div>`;

  return pending.map(r=>`
<div style="background:var(--card-bg);border:1.5px solid #FCD34D;border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div>
      <div style="font-size:13px;font-weight:700">${r.empName}</div>
      <div style="font-size:11px;color:#94A3B8">${r.dept} · ${r.pos}</div>
    </div>
    <div style="font-size:11px;color:#94A3B8">${r.reqDate}</div>
  </div>
  <div style="display:flex;gap:10px;font-size:11px;color:#64748B;margin-bottom:6px">
    <span>💼 ${r.type==='premium'?'프리미엄':'일반'} ${r.qty}장</span>
    <span>📦 ${r.delivery==='office'?'사무실 배송':'직접 수령'}</span>
  </div>
  ${r.note ? `<div style="font-size:11px;color:#64748B;background:#F8FAFC;border-radius:6px;padding:6px 8px;margin-bottom:8px">"${r.note}"</div>` : ''}
  <div style="display:flex;gap:6px">
    <button class="bca-next" data-id="${r.id}" data-next="${STATUS_FLOW[r.status]||''}"
      style="flex:1;padding:8px;background:#4F46E5;color:#fff;border:none;border-radius:8px;
             font-size:12px;font-weight:700;cursor:pointer">승인</button>
    <button class="bca-reject" data-id="${r.id}"
      style="flex:1;padding:8px;background:none;border:1px solid #EF4444;color:#EF4444;border-radius:8px;
             font-size:12px;font-weight:700;cursor:pointer">반려</button>
  </div>
</div>`).join('');
}

// ── Tab: 전체 내역 ──────────────────────────────────────────────
function _renderAll(data) {
  const sorted = [...data].sort((a,b)=>b.reqDate.localeCompare(a.reqDate));
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  ${sorted.map(r=>`
  <div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:600;color:var(--text)">${r.empName}</div>
      <div style="font-size:10px;color:#94A3B8;margin-top:1px">${r.dept} · ${r.type==='premium'?'프리미엄':'일반'} ${r.qty}장 · ${r.reqDate}</div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
      ${r.status !== 'delivered' && r.status !== 'rejected' && STATUS_FLOW[r.status] ? `
      <button class="bca-next" data-id="${r.id}" data-next="${STATUS_FLOW[r.status]}"
        style="padding:4px 8px;background:#EEF2FF;color:#4F46E5;border:none;border-radius:6px;
               font-size:10px;font-weight:700;cursor:pointer">→ ${STATUS_LABEL[STATUS_FLOW[r.status]]}</button>` : ''}
      <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;
                   background:${STATUS_COLOR[r.status]}22;color:${STATUS_COLOR[r.status]}">${STATUS_LABEL[r.status]||r.status}</span>
    </div>
  </div>`).join('')}
</div>`;
}

function _bindEvents(data) {
  _root.querySelectorAll('.bca-next').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const d    = _getData();
      const item = d.find(r=>r.id===btn.dataset.id);
      if (!item) return;
      const next = btn.dataset.next;
      if (!next) return;
      item.status = next;
      _save(d);
      showToast(`${item.empName} 명함 → ${STATUS_LABEL[next]}으로 변경됐습니다.`, 'success');
      addNotification({ type: 'success', title: '명함 처리 (관리자)', body: `명함 → ${STATUS_LABEL[next]}으로 변경됐습니다.` });
      if (next === 'delivered' && item.empId) addNotificationForUser(item.empId, { type: 'success', title: '명함 발급 완료', body: '명함이 발급되어 전달될 예정입니다.', route: '#/market' });
      _draw();
    });
  });

  _root.querySelectorAll('.bca-reject').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const d    = _getData();
      const item = d.find(r=>r.id===btn.dataset.id);
      if (!item) return;
      item.status = 'rejected';
      _save(d);
      showToast(`${item.empName} 신청이 반려됐습니다.`, 'info');
      if (item.empId) addNotificationForUser(item.empId, { type: 'error', title: '명함 신청 반려', body: '명함 신청이 반려되었습니다.', route: '#/market' });
      _draw();
    });
  });
}
export function mount(root) { return render(root); }
