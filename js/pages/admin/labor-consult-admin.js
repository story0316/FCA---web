/**
 * labor-consult-admin.js — 노무 상담 관리 (관리자)
 */

import { showToast } from '../../components/toast.js'
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_labor_consults';

const LEGACY_IDS = new Set(['LC001', 'LC002', 'LC003']);

const STATUS_META = {
  pending:  { label:'대기',      color:'#F59E0B', bg:'#FEF3C7' },
  answered: { label:'답변 완료', color:'#10B981', bg:'#D1FAE5' },
  closed:   { label:'종료',      color:'#94A3B8', bg:'#F1F5F9' },
};

function _load() {
  try {
    const d = JSON.parse(localStorage.getItem(LS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_IDS.has(r.id));
    if (cleaned.length !== list.length) _save(cleaned);
    return cleaned;
  } catch { return []; }
}
function _save(list) { localStorage.setItem(LS, JSON.stringify(list)); }

let _tab = 'pending';
let _root = null;

export function render(root) { _root = root; _tab = 'pending'; _draw(); }
export function unmount() { _root = null;
  _tab = 'pending';
}

function _draw() {
  const all = _load();
  const pending  = all.filter(r => r.status === 'pending');
  const answered = all.filter(r => r.status === 'answered');

  const tabs = [
    { key:'pending', label:`답변 대기 (${pending.length})` },
    { key:'all',     label:`전체 (${all.length})` },
  ];

  const list = _tab === 'pending' ? pending : all;

  _root.innerHTML = `
<div style="padding:16px;max-width:600px;margin:0 auto">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button id="lc-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text)">&#8592;</button>
    <h2 style="margin:0;font-size:17px;font-weight:700;color:var(--text)">노무 상담 관리</h2>
  </div>

  <!-- Stats -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
    ${[
      { label:'대기',      val:pending.length,  color:'#F59E0B' },
      { label:'답변 완료', val:answered.length, color:'#10B981' },
      { label:'전체',      val:all.length,      color:'#64748B' },
    ].map(s=>`
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;text-align:center">
      <div style="font-size:20px;font-weight:700;color:${s.color}">${s.val}</div>
      <div style="font-size:11px;color:#64748B;margin-top:2px">${s.label}</div>
    </div>`).join('')}
  </div>

  <!-- Tabs -->
  <div style="display:flex;gap:6px;margin-bottom:14px">
    ${tabs.map(t=>`
    <button class="lc-tab" data-tab="${t.key}" style="
      padding:7px 14px;font-size:12px;font-weight:600;border-radius:20px;cursor:pointer;
      border:1.5px solid ${_tab===t.key?'#4F46E5':'var(--border)'};
      background:${_tab===t.key?'#EEF2FF':'var(--card-bg)'};
      color:${_tab===t.key?'#4F46E5':'#64748B'}">${t.label}</button>`).join('')}
  </div>

  <!-- List -->
  <div id="lc-list">
    ${list.length === 0
      ? `<div style="text-align:center;padding:48px 0;color:#94A3B8">
           <div style="font-size:36px;margin-bottom:8px">⚖️</div>
           <div style="font-size:13px">상담 요청이 없습니다.</div>
         </div>`
      : list.map(r => _card(r)).join('')}
  </div>
</div>`;

  _bindEvents();
}

function _card(r) {
  const sm = STATUS_META[r.status] || STATUS_META.pending;
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
    <div>
      <div style="font-size:14px;font-weight:700;color:var(--text)">${r.anonymous ? '익명' : r.empName}</div>
      <div style="font-size:11px;color:#64748B;margin-top:2px">${r.typeLabel} · 신청일 ${r.reqDate}</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${sm.bg};color:${sm.color}">${sm.label}</span>
  </div>

  <div style="background:#F8FAFC;border-radius:8px;padding:10px;margin-bottom:10px">
    <div style="font-size:11px;color:#94A3B8;margin-bottom:4px">Q. 질문</div>
    <div style="font-size:13px;color:var(--text);line-height:1.5">${r.question}</div>
  </div>

  ${r.status === 'answered' && r.answer ? `
  <div style="background:#F0FDF4;border-left:3px solid #10B981;padding:10px;border-radius:0 8px 8px 0;margin-bottom:10px">
    <div style="font-size:11px;color:#10B981;margin-bottom:4px">A. 답변</div>
    <div style="font-size:13px;color:var(--text);line-height:1.5">${r.answer}</div>
  </div>` : ''}

  ${r.status === 'pending' ? `
  <textarea class="lc-answer" data-id="${r.id}" rows="3" placeholder="답변을 입력하세요..."
    style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;
           resize:vertical;margin-bottom:8px;background:var(--card-bg);color:var(--text)"></textarea>
  <button class="lc-submit" data-id="${r.id}" style="width:100%;padding:10px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">답변 등록</button>
  ` : ''}
</div>`;
}

function _bindEvents() {
  _root.querySelector('#lc-back')?.addEventListener('click', () => window.navBack());

  _root.querySelectorAll('.lc-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.tab; _draw(); });
  });

  _root.querySelectorAll('.lc-submit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const ta = _root.querySelector(`.lc-answer[data-id="${id}"]`);
      const answer = ta ? ta.value.trim() : '';
      if (!answer) { showToast('답변 내용을 입력해 주세요.'); return; }
      const all = _load();
      const idx = all.findIndex(r => r.id === id);
      if (idx < 0) return;
      all[idx].status = 'answered';
      all[idx].answer = answer;
      _save(all);
      showToast('답변이 등록되었습니다.');
      addNotification({ type: 'success', title: '노동 상담 관리', body: '답변이 등록되었습니다.' });
      _draw();
    });
  });
}
export function mount(root) { return render(root); }
