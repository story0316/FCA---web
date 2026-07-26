/**
 * approval.js — 전자 결재 (직원)
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const TODAY = new Date().toISOString().slice(0,10);

const LS = 'hr_approvals';

const DOC_TYPES = [
  { key:'leave',    label:'휴가 신청',   icon:'🏖️' },
  { key:'expense',  label:'지출 결의',   icon:'💸' },
  { key:'biz_trip', label:'출장 신청',   icon:'✈️' },
  { key:'purchase', label:'물품 구매',   icon:'🛒' },
  { key:'overtime', label:'초과근무',    icon:'⏰' },
  { key:'etc',      label:'기타',        icon:'📄' },
];

const STATUS_META = {
  pending:  { label:'결재 대기', color:'#F59E0B', bg:'#FEF3C7' },
  approved: { label:'승인',     color:'#10B981', bg:'#D1FAE5' },
  rejected: { label:'반려',     color:'#EF4444', bg:'#FEE2E2' },
};

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }

function _getAll() { try { return JSON.parse(localStorage.getItem(LS)||'[]'); } catch { return []; } }
function _save(l)  { localStorage.setItem(LS, JSON.stringify(l)); }

let _tab = 'apply';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _tab = 'apply'; _render(root); }
export function unmount() { _tab = 'apply'; }

function _render(root) {
  const mine = _getAll().filter(a => a.empId === _empId())
    .sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  const pending  = mine.filter(a => a.status === 'pending').length;
  const approved = mine.filter(a => a.status === 'approved').length;

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div class="top-bar" style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="ap-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">📋 전자 결재</div>
      <div style="font-size:11px;color:var(--text-muted)">대기 <strong style="color:#F59E0B">${pending}건</strong> · 승인 <strong style="color:#10B981">${approved}건</strong></div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['apply','기안 작성'],['inbox','내 결재함']].map(([k,l])=>`
    <button class="ap-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab === 'apply' ? _renderApply() : _renderInbox(mine)}
  </div>
</div>`;

  root.querySelector('#ap-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.ap-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _render(root); }));

  // 문서 유형 카드 선택
  if (_tab === 'apply') {
    const cards  = root.querySelectorAll('.ap-type-card');
    const hidden = root.querySelector('#ap-type');
    cards.forEach(card => {
      const radio = card.querySelector('input[type=radio]');
      if (radio?.checked) { card.style.borderColor='#4F46E5'; card.style.background='#EEF2FF'; }
      card.addEventListener('click', () => {
        cards.forEach(c => { c.style.borderColor='var(--border)'; c.style.background='transparent'; });
        card.style.borderColor='#4F46E5'; card.style.background='#EEF2FF';
        if (radio)  radio.checked = true;
        if (hidden) hidden.value  = radio?.value||'';
      });
    });

    root.querySelector('#ap-submit')?.addEventListener('click', () => {
      const type    = root.querySelector('#ap-type').value;
      const title   = root.querySelector('#ap-title').value.trim();
      const content = root.querySelector('#ap-content').value.trim();
      const amount  = parseInt(root.querySelector('#ap-amount').value.replace(/,/g,''))||0;
      const dateFrom = root.querySelector('#ap-date-from').value;
      const dateTo   = root.querySelector('#ap-date-to').value;
      if (!title)   { showToast('제목을 입력하세요.', 'error'); return; }
      if (!content) { showToast('내용을 입력하세요.', 'error'); return; }

      const list = _getAll();
      const docType = DOC_TYPES.find(d=>d.key===type);
      list.push({
        id: 'APV_'+Date.now(),
        empId: _empId(), empName: _empName(),
        type, typeName: docType?.label||type,
        title, content, amount, dateFrom, dateTo,
        status: 'pending',
        createdAt: new Date().toISOString(),
        approver: '관리자',
        comment: '',
      });
      _save(list);
      showToast('결재 신청이 완료되었습니다.', 'success');
      addNotification({ type: 'system', title: `결재 신청: ${title}`, body: '' });
      _tab = 'inbox';
      _render(root);
    });
  }
}

function _renderApply() {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="font-size:13px;font-weight:700;margin-bottom:12px">📝 기안 작성</div>

  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:6px;font-weight:600">문서 유형</label>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
      ${DOC_TYPES.map((t,i)=>`
      <label class="ap-type-card" style="display:flex;flex-direction:column;align-items:center;padding:10px 6px;
             border:2px solid ${i===0?'#4F46E5':'var(--border)'};border-radius:10px;cursor:pointer;
             background:${i===0?'#EEF2FF':'transparent'}">
        <input type="radio" name="ap-type-radio" value="${t.key}" ${i===0?'checked':''} style="position:absolute;opacity:0;pointer-events:none">
        <div style="font-size:20px;margin-bottom:3px">${t.icon}</div>
        <div style="font-size:10px;font-weight:600;text-align:center;color:var(--text)">${t.label}</div>
      </label>`).join('')}
    </div>
    <input type="hidden" id="ap-type" value="${DOC_TYPES[0].key}">
  </div>

  <div style="margin-bottom:10px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">제목</label>
    <input id="ap-title" type="text" placeholder="예: 7월 연차 신청"
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
    <div>
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">시작일</label>
      <input id="ap-date-from" type="date"
        style="width:100%;padding:9px 10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box" min="${TODAY}">
    </div>
    <div>
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">종료일</label>
      <input id="ap-date-to" type="date"
        style="width:100%;padding:9px 10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
  </div>

  <div style="margin-bottom:10px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">금액 (원, 해당 시)</label>
    <input id="ap-amount" type="number" min="0" placeholder="해당 없으면 비워두세요"
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>

  <div style="margin-bottom:16px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">내용·사유</label>
    <textarea maxlength="500" id="ap-content" rows="4" placeholder="결재 사유 및 상세 내용을 입력하세요."
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box;resize:vertical"></textarea>
  </div>

  <button id="ap-submit"
    style="width:100%;background:#4F46E5;color:#fff;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer">결재 상신</button>
</div>`;
}

function _renderInbox(docs) {
  if (!docs.length) return `
<div style="text-align:center;padding:50px 20px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">📭</div>
  <div style="font-size:13px">결재 내역이 없습니다.</div>
  <button onclick="document.querySelector('[data-tab=apply]')?.click()" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">결재 요청</button>
</div>`;

  return docs.map(d => {
    const t = DOC_TYPES.find(x=>x.key===d.type)||{icon:'📄',label:d.type};
    const s = STATUS_META[d.status]||STATUS_META.pending;
    const dateStr = d.createdAt ? d.createdAt.slice(0,10) : '';
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
      <span style="font-size:20px;flex-shrink:0">${t.icon}</span>
      <div style="min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.title}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${t.label} · ${dateStr}</div>
      </div>
    </div>
    <span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:8px;
      color:${s.color};background:${s.bg};flex-shrink:0;margin-left:8px">${s.label}</span>
  </div>
  ${d.amount ? `<div style="font-size:12px;color:#4F46E5;font-weight:600;margin-bottom:4px">💰 ${d.amount.toLocaleString()}원</div>` : ''}
  ${d.dateFrom ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">📅 ${d.dateFrom}${d.dateTo && d.dateTo!==d.dateFrom?` ~ ${d.dateTo}`:''}</div>` : ''}
  <div style="font-size:11px;color:var(--text-muted);line-height:1.5;border-top:1px solid var(--border);padding-top:6px;margin-top:4px">${d.content}</div>
  ${d.comment && d.status!=='pending' ? `<div style="font-size:11px;font-weight:600;color:${s.color};margin-top:6px">💬 ${d.comment}</div>` : ''}
</div>`;
  }).join('');
}
