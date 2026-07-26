/**
 * remote-work.js — 재택근무 신청 (직원)
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_remote_work';

const WORK_TYPES = [
  { key:'wfh',    label:'재택근무',   icon:'🏠', desc:'자택 근무' },
  { key:'hybrid', label:'거점 근무',  icon:'📍', desc:'위성 오피스·공유 오피스' },
  { key:'field',  label:'외근',       icon:'🚗', desc:'외부 방문·출장' },
];

const STATUS_META = {
  pending:  { label:'검토 중', color:'#F59E0B', bg:'#FEF3C7' },
  approved: { label:'승인',   color:'#10B981', bg:'#D1FAE5' },
  rejected: { label:'반려',   color:'#EF4444', bg:'#FEE2E2' },
};

// 월 재택근무 한도 (일)
const MONTHLY_LIMIT = 8;

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }
function _dept()    { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').department||'소속 미지정'; } catch { return '소속 미지정'; } }

function _getAll() { try { return JSON.parse(localStorage.getItem(LS)||'[]'); } catch { return []; } }
function _save(l)  { localStorage.setItem(LS, JSON.stringify(l)); }
function _mine()   { return _getAll().filter(r=>r.empId===_empId()); }

const TODAY = new Date().toISOString().slice(0,10);
const THIS_MONTH = TODAY.slice(0,7);

let _tab = 'apply';
let _selType = 'wfh';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _tab='apply'; _selType='wfh'; _render(root); }
export function unmount() { _tab='apply'; }

function _render(root) {
  const mine = _mine().sort((a,b)=>b.dates[0].localeCompare(a.dates[0]));
  const thisMonthApproved = mine
    .filter(r=>r.status==='approved' && r.dates.some(d=>d.startsWith(THIS_MONTH)))
    .flatMap(r=>r.dates.filter(d=>d.startsWith(THIS_MONTH))).length;
  const pending = mine.filter(r=>r.status==='pending').length;

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div class="top-bar" style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="rw-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🏠 재택근무 신청</div>
      <div style="font-size:11px;color:var(--text-muted)">이번 달 ${thisMonthApproved}/${MONTHLY_LIMIT}일 사용</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['apply','신청하기'],['history','내 신청']].map(([k,l])=>`
    <button class="rw-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}${k==='history'&&pending?` <span style="background:#EF4444;color:#fff;font-size:9px;border-radius:99px;padding:1px 5px">${pending}</span>`:''}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='apply' ? _renderApply(thisMonthApproved) : _renderHistory(mine)}
  </div>
</div>`;

  root.querySelector('#rw-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.rw-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(root); }));

  if (_tab === 'apply') {
    // 근무유형 카드 선택
    root.querySelectorAll('.rw-type-card').forEach(card=>{
      card.addEventListener('click',()=>{
        root.querySelectorAll('.rw-type-card').forEach(c=>{ c.style.borderColor='var(--border)'; c.style.background='transparent'; });
        card.style.borderColor='#4F46E5'; card.style.background='#EEF2FF';
        _selType = card.dataset.type;
      });
    });

    root.querySelector('#rw-submit')?.addEventListener('click',()=>{
      const dateFrom  = root.querySelector('#rw-date-from').value;
      const dateTo    = root.querySelector('#rw-date-to').value || dateFrom;
      const reason    = root.querySelector('#rw-reason').value.trim();
      if (!dateFrom) { showToast('날짜를 선택하세요.', 'error'); return; }
      if (!reason)   { showToast('사유를 입력하세요.', 'error'); return; }

      // 날짜 범위 → 평일만 추출
      const dates = _weekdays(dateFrom, dateTo);
      if (!dates.length) { showToast('선택한 기간에 평일이 없습니다.', 'error'); return; }

      // 월 한도 체크
      const projectedUsed = thisMonthApproved + dates.filter(d=>d.startsWith(THIS_MONTH)).length;
      if (projectedUsed > MONTHLY_LIMIT) {
        showToast(`월 한도(${MONTHLY_LIMIT}일)를 초과합니다. 관리자 승인이 필요할 수 있습니다.`, 'warning');
      }

      const list = _getAll();
      list.push({
        id: 'RW_'+Date.now(),
        empId: _empId(), empName: _empName(), dept: _dept(),
        type: _selType,
        typeName: WORK_TYPES.find(t=>t.key===_selType)?.label||_selType,
        dates, reason,
        status: 'pending',
        createdAt: new Date().toISOString(),
        comment: '',
      });
      _save(list);
      showToast(`재택근무 신청 완료 (${dates.length}일)`, 'success')
    addNotification({ type: 'success', title: '재택근무', body: `재택근무 신청: ${dateFrom}${dateTo !== dateFrom ? ` ~ ${dateTo}` : ''}` });
      _tab = 'history';
      _render(root);
    });
  }
}

function _weekdays(from, to) {
  const result = [];
  const cur = new Date(from);
  const end = new Date(to);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) result.push(cur.toISOString().slice(0,10));
    cur.setDate(cur.getDate()+1);
  }
  return result;
}

function _renderApply(used) {
  const pct = Math.min(100, Math.round((used/MONTHLY_LIMIT)*100));
  return `
<!-- 이번 달 사용 현황 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <div style="font-size:12px;font-weight:700;color:var(--text)">${THIS_MONTH} 재택근무 현황</div>
    <div style="font-size:12px;font-weight:800;color:${used>=MONTHLY_LIMIT?'#EF4444':'#4F46E5'}">${used}/${MONTHLY_LIMIT}일</div>
  </div>
  <div style="background:#E2E8F0;border-radius:99px;height:6px">
    <div style="background:${used>=MONTHLY_LIMIT?'#EF4444':'#4F46E5'};height:6px;border-radius:99px;width:${pct}%"></div>
  </div>
  <div style="font-size:10px;color:var(--text-muted);margin-top:4px">월 최대 ${MONTHLY_LIMIT}일 · 잔여 ${Math.max(0,MONTHLY_LIMIT-used)}일</div>
</div>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="font-size:13px;font-weight:700;margin-bottom:12px">📝 재택근무 신청</div>

  <!-- 근무 유형 -->
  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:6px;font-weight:600">근무 유형</label>
    <div style="display:flex;gap:8px">
      ${WORK_TYPES.map(t=>`
      <div class="rw-type-card" data-type="${t.key}"
        style="flex:1;padding:12px 8px;border:2px solid ${t.key===_selType?'#4F46E5':'var(--border)'};
               border-radius:10px;cursor:pointer;text-align:center;
               background:${t.key===_selType?'#EEF2FF':'transparent'}">
        <div style="font-size:20px;margin-bottom:3px">${t.icon}</div>
        <div style="font-size:11px;font-weight:700;color:var(--text)">${t.label}</div>
        <div style="font-size:9px;color:var(--text-muted);margin-top:1px">${t.desc}</div>
      </div>`).join('')}
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
    <div>
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">시작일</label>
      <input id="rw-date-from" type="date" min="${TODAY}" value="${TODAY}"
        style="width:100%;padding:9px 10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
    <div>
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">종료일</label>
      <input id="rw-date-to" type="date" min="${TODAY}" value="${TODAY}"
        style="width:100%;padding:9px 10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
  </div>

  <div style="margin-bottom:16px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">사유</label>
    <textarea maxlength="500" id="rw-reason" rows="3" placeholder="예: 집중 개발 업무, 개인 사정 등"
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box;resize:vertical"></textarea>
  </div>

  <button id="rw-submit"
    style="width:100%;background:#4F46E5;color:#fff;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer">신청하기</button>
</div>`;
}

function _renderHistory(mine) {
  if (!mine.length) return `
<div style="text-align:center;padding:50px 20px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">🏠</div>
  <div style="font-size:13px">신청 내역이 없습니다.</div>
      <button onclick="location.hash='#/remote-work'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">재택근무 신청</button>
    
</div>`;

  return mine.map(r=>{
    const t = WORK_TYPES.find(x=>x.key===r.type)||{icon:'🏠',label:r.type};
    const s = STATUS_META[r.status]||STATUS_META.pending;
    const dateStr = r.dates.length===1 ? r.dates[0] : `${r.dates[0]} ~ ${r.dates[r.dates.length-1]}`;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:20px">${t.icon}</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${t.label} · ${r.dates.length}일</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${dateStr}</div>
      </div>
    </div>
    <span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:8px;
      color:${s.color};background:${s.bg};flex-shrink:0;margin-left:8px">${s.label}</span>
  </div>
  <div style="font-size:11px;color:var(--text-muted);line-height:1.5">${r.reason}</div>
  ${r.comment && r.status!=='pending' ? `<div style="font-size:11px;font-weight:600;color:${s.color};margin-top:6px">💬 ${r.comment}</div>` : ''}
</div>`;
  }).join('');
}
