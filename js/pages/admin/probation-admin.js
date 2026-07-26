/**
 * probation-admin.js — 수습 평가 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_probation';
const STATUS_META = {
  in_probation: { label:'수습 중',  color:'#3B82F6', bg:'#EFF6FF' },
  passed:       { label:'통과',     color:'#10B981', bg:'#ECFDF5' },
  extended:     { label:'연장',     color:'#F59E0B', bg:'#FFFBEB' },
  failed:       { label:'미통과',   color:'#EF4444', bg:'#FEF2F2' },
};

const LEGACY_IDS = new Set(['EMP012','EMP013','EMP014','EMP009','EMP015']);

function _getData() {
  try {
    const d = JSON.parse(localStorage.getItem(LS) || '[]');
    const list = Array.isArray(d) ? d : [d].filter(Boolean);
    const cleaned = list.filter(r => !LEGACY_IDS.has(r.empId));
    if (cleaned.length !== list.length) _save(cleaned);
    return cleaned;
  } catch { return []; }
}
function _save(data) { localStorage.setItem(LS, JSON.stringify(data)); }

function _daysLeft(endDate) {
  return Math.ceil((new Date(endDate) - new Date()) / 86400000);
}
function _elapsed(start, end) {
  return Math.min(100, Math.max(0, Math.round(((Date.now()-new Date(start))/(new Date(end)-new Date(start)))*100)));
}

let _tab  = 'active';
let _root = null;

export function render(root) { _root = root; _tab = 'active'; _draw(); }
export function unmount()    { _root = null; _tab = 'active'; }

function _draw() {
  const data   = _getData();
  const active = data.filter(r=>r.status==='in_probation');

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['active',`수습 중 <span style="background:#3B82F6;color:#fff;border-radius:99px;font-size:10px;padding:1px 5px">${active.length}</span>`],['resolved','평가 완료'],['all','전체']].map(([k,l])=>`
    <button class="pba-tab" data-tab="${k}"
      style="padding:10px 16px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab===k?'var(--primary)':'transparent'};
             color:${_tab===k?'var(--primary)':'#94A3B8'}">${l}</button>`).join('')}
  </div>
  <div style="padding:14px 16px">
    ${_tab==='active'   ? _renderActive(active)
    : _tab==='resolved' ? _renderResolved(data.filter(r=>r.status!=='in_probation'))
    :                     _renderAll(data)}
  </div>
</div>`;

  _root.querySelectorAll('.pba-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderActive(list) {
  const saCount = list.filter(r=>r.selfAssessment).length;
  return `
<!-- 요약 -->
<div style="display:flex;gap:8px;margin-bottom:14px">
  ${[
    [`수습 중`, list.length, '#3B82F6'],
    [`자기평가 제출`, saCount, '#10B981'],
    [`미제출`, list.length-saCount, '#F59E0B'],
  ].map(([l,v,c])=>`
  <div style="flex:1;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:10px;text-align:center">
    <div style="font-size:20px;font-weight:800;color:${c}">${v}</div>
    <div style="font-size:10px;color:#94A3B8;margin-top:2px">${l}</div>
  </div>`).join('')}
</div>

${list.length===0 ? `<div style="text-align:center;padding:40px;color:#94A3B8">수습 중인 직원이 없습니다.</div>` :
list.map(r=>{
  const pct   = _elapsed(r.startDate, r.endDate);
  const dLeft = _daysLeft(r.endDate);
  const meta  = STATUS_META[r.status];
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div>
      <div style="font-size:13px;font-weight:700">${r.empName}</div>
      <div style="font-size:11px;color:#94A3B8">${r.dept} · ${r.pos}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:12px;font-weight:700;color:${dLeft<14?'#EF4444':'#64748B'}">
        ${dLeft>0?`D-${dLeft}`:`D+${Math.abs(dLeft)}`}
      </div>
      ${r.selfAssessment
        ? `<span style="font-size:10px;background:#ECFDF5;color:#059669;font-weight:700;padding:2px 6px;border-radius:99px">자기평가 ${r.selfAssessment.avgScore.toFixed(1)}점</span>`
        : `<span style="font-size:10px;background:#FEF3C7;color:#D97706;font-weight:700;padding:2px 6px;border-radius:99px">평가 미제출</span>`
      }
    </div>
  </div>
  <div style="background:#E2E8F0;border-radius:99px;height:6px;margin-bottom:4px">
    <div style="background:#3B82F6;height:6px;border-radius:99px;width:${pct}%"></div>
  </div>
  <div style="font-size:10px;color:#94A3B8;margin-bottom:10px">${r.startDate} ~ ${r.endDate} · ${pct}% 경과</div>

  <div style="margin-bottom:8px">
    <textarea class="pba-note" data-id="${r.empId}" rows="2"
      placeholder="관리자 피드백 메모 (선택)"
      style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;
             font-size:12px;background:var(--bg);color:var(--text);resize:none;box-sizing:border-box">${r.managerNote||''}</textarea>
  </div>
  <div style="display:flex;gap:6px">
    <button class="pba-pass"   data-id="${r.empId}"
      style="flex:1;padding:8px;background:#059669;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">통과</button>
    <button class="pba-extend" data-id="${r.empId}"
      style="flex:1;padding:8px;background:#D97706;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">연장 (+30일)</button>
    <button class="pba-fail"   data-id="${r.empId}"
      style="flex:1;padding:8px;background:none;border:1.5px solid #EF4444;color:#EF4444;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">미통과</button>
    <button class="pba-save-note" data-id="${r.empId}"
      style="padding:8px 10px;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:8px;font-size:11px;cursor:pointer">저장</button>
  </div>
</div>`;}).join('')}`;
}

function _renderResolved(list) {
  if (!list.length) return `<div style="text-align:center;padding:40px;color:#94A3B8">완료된 평가가 없습니다.</div>`;
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  ${list.map(r=>{
    const meta = STATUS_META[r.status];
    return `
  <div style="padding:12px 14px;border-bottom:1px solid var(--border)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <div>
        <span style="font-size:13px;font-weight:700">${r.empName}</span>
        <span style="font-size:11px;color:#94A3B8;margin-left:6px">${r.dept}</span>
      </div>
      <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;
                   background:${meta.bg};color:${meta.color}">${meta.label}</span>
    </div>
    <div style="font-size:11px;color:#94A3B8">
      ${r.startDate} ~ ${r.endDate}
      ${r.selfAssessment ? ` · 자기평가 ${r.selfAssessment.avgScore.toFixed(1)}점` : ''}
      ${r.managerNote ? ` · "${r.managerNote}"` : ''}
    </div>
  </div>`;}).join('')}
</div>`;
}

function _renderAll(data) {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;overflow:hidden">
  ${data.map(r=>{
    const meta = STATUS_META[r.status];
    return `
  <div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
    <div style="flex:1">
      <div style="font-size:13px;font-weight:600">${r.empName} <span style="font-size:10px;color:#94A3B8">${r.dept}</span></div>
      <div style="font-size:10px;color:#94A3B8">${r.startDate} ~ ${r.endDate}${r.selfAssessment?` · ${r.selfAssessment.avgScore.toFixed(1)}점`:''}</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;
                 background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>`;}).join('')}
</div>`;
}

function _bindEvents() {
  if (_tab !== 'active') return;

  _root.querySelectorAll('.pba-pass').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const d = _getData(); const r = d.find(x=>x.empId===btn.dataset.id); if(!r) return;
      r.status='passed'; _save(d); showToast(`${r.empName} 수습 통과 처리됐습니다.`, 'success')
      addNotification({ type: 'success', title: 'Probation (관리자)', body: '수습 통과 처리됐습니다.' }); _draw();
    });
  });

  _root.querySelectorAll('.pba-extend').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const d = _getData(); const r = d.find(x=>x.empId===btn.dataset.id); if(!r) return;
      const nd = new Date(r.endDate); nd.setDate(nd.getDate()+30);
      r.endDate = nd.toISOString().slice(0,10);
      r.status  = 'extended';
      _save(d); showToast(`${r.empName} 수습 30일 연장됐습니다.`, 'info'); _draw();
    });
  });

  _root.querySelectorAll('.pba-fail').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if (!confirm(`미통과 처리하시겠습니까?`)) return;
      const d = _getData(); const r = d.find(x=>x.empId===btn.dataset.id); if(!r) return;
      r.status='failed'; _save(d); showToast(`${r.empName} 미통과 처리됐습니다.`, 'error'); _draw();
    });
  });

  _root.querySelectorAll('.pba-save-note').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const note = _root.querySelector(`.pba-note[data-id="${btn.dataset.id}"]`)?.value||'';
      const d = _getData(); const r = d.find(x=>x.empId===btn.dataset.id); if(!r) return;
      r.managerNote=note; _save(d); showToast('메모가 저장됐습니다.', 'success')
      addNotification({ type: 'success', title: 'Probation (관리자)', body: '메모가 저장됐습니다.' });
    });
  });
}
export function mount(root) { return render(root); }
