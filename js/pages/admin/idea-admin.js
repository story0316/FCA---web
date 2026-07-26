/**
 * idea-admin.js — 아이디어 제안 관리 (관리자)
 */

import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_ideas';

const STATUS_OPTIONS = [
  { key:'pending',      label:'검토 대기' },
  { key:'reviewing',   label:'검토 중' },
  { key:'adopted',     label:'채택' },
  { key:'implementing',label:'구현 중' },
  { key:'done',        label:'완료' },
  { key:'rejected',    label:'미채택' },
];
const STATUS_META = {
  pending:     { color:'#F59E0B', bg:'#FEF3C7' },
  reviewing:   { color:'#3B82F6', bg:'#DBEAFE' },
  adopted:     { color:'#10B981', bg:'#D1FAE5' },
  implementing:{ color:'#8B5CF6', bg:'#EDE9FE' },
  done:        { color:'#059669', bg:'#D1FAE5' },
  rejected:    { color:'#EF4444', bg:'#FEE2E2' },
};

function _getAll() { try { return JSON.parse(localStorage.getItem(LS)||'[]'); } catch { return []; } }
function _save(l)  { localStorage.setItem(LS, JSON.stringify(l)); }

let _filter = 'pending';

export function render(root) { _filter='pending'; _draw(root); }
export function unmount() { _filter='pending'; }

function _draw(root) {
  const all = _getAll().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const counts = {};
  STATUS_OPTIONS.forEach(s=>{ counts[s.key]=all.filter(i=>i.status===s.key).length; });
  const filtered = _filter==='all'?all:all.filter(i=>i.status===_filter);

  root.innerHTML = `
<!-- 상태별 필터 -->
<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
  <button class="ia-filter" data-f="all"
    style="padding:5px 12px;font-size:11px;font-weight:600;border-radius:8px;cursor:pointer;
           border:1.5px solid ${_filter==='all'?'#4F46E5':'var(--border)'};
           background:${_filter==='all'?'#EEF2FF':'var(--card-bg)'};color:${_filter==='all'?'#4F46E5':'#64748B'}">
    전체 (${all.length})</button>
  ${STATUS_OPTIONS.map(s=>{
    const sm = STATUS_META[s.key]||{color:'#64748B',bg:'#F1F5F9'};
    const active = _filter===s.key;
    return `<button class="ia-filter" data-f="${s.key}"
      style="padding:5px 12px;font-size:11px;font-weight:600;border-radius:8px;cursor:pointer;
             border:1.5px solid ${active?sm.color:'var(--border)'};
             background:${active?sm.bg:'var(--card-bg)'};color:${active?sm.color:'#64748B'}">
      ${s.label} ${counts[s.key]?`(${counts[s.key]})`:''}
    </button>`;
  }).join('')}
</div>

${!filtered.length
  ?`<div style="text-align:center;padding:40px;color:#94A3B8;font-size:13px">해당 상태의 아이디어가 없습니다.</div>`
  : filtered.map(idea=>{
    const sm = STATUS_META[idea.status]||{color:'#64748B',bg:'#F1F5F9'};
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div>
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px">${idea.title}</div>
      <div style="font-size:11px;color:#64748B">${idea.empName} · ${idea.createdAt.slice(0,10)} · ❤️ ${(idea.likes||[]).length}</div>
    </div>
    <select class="ia-status-sel" data-id="${idea.id}"
      style="padding:5px 8px;border:1.5px solid ${sm.color};border-radius:8px;font-size:11px;font-weight:700;
             background:${sm.bg};color:${sm.color};cursor:pointer">
      ${STATUS_OPTIONS.map(s=>`<option value="${s.key}" ${idea.status===s.key?'selected':''}>${s.label}</option>`).join('')}
    </select>
  </div>
  <div style="font-size:12px;color:#64748B;line-height:1.5;margin-bottom:8px">${idea.content}</div>
  <div style="display:flex;gap:8px;align-items:center">
    <input class="ia-comment" data-id="${idea.id}" type="text"
      placeholder="관리자 코멘트 (선택)" value="${idea.adminComment||''}"
      style="flex:1;padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;background:var(--bg);color:var(--text)">
    <button class="ia-save" data-id="${idea.id}"
      style="padding:7px 14px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">저장</button>
  </div>
</div>`;
  }).join('')}`;

  root.querySelectorAll('.ia-filter').forEach(btn=>{
    btn.addEventListener('click',()=>{ _filter=btn.dataset.f; _draw(root); });
  });

  root.querySelectorAll('.ia-save').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const id      = btn.dataset.id;
      const status  = root.querySelector(`.ia-status-sel[data-id="${id}"]`).value;
      const comment = root.querySelector(`.ia-comment[data-id="${id}"]`).value.trim();
      const list    = _getAll();
      const idx     = list.findIndex(i=>i.id===id);
      if (idx!==-1) { list[idx].status=status; list[idx].adminComment=comment; _save(list); }
      showToast('저장되었습니다.','success')
      addNotification({ type: 'success', title: 'Idea (관리자)', body: '저장되었습니다.' });
      _draw(root);
    });
  });

  root.querySelectorAll('.ia-status-sel').forEach(sel=>{
    sel.addEventListener('change',()=>{
      const sm2 = STATUS_META[sel.value]||{color:'#64748B',bg:'#F1F5F9'};
      sel.style.borderColor = sm2.color;
      sel.style.background  = sm2.bg;
      sel.style.color       = sm2.color;
    });
  });
}
export function mount(root) { return render(root); }
