/**
 * newsletter-admin.js — 뉴스레터 관리 (관리자)
 */

import { showToast } from '../../components/toast.js'
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_newsletter_issues';

const DEMO_ISSUES = [
  { id:'NL001', channel:'weekly',  channelLabel:'주간 HR 뉴스레터',  title:'[주간 HR] 2026년 6월 1주차',     content:'이번 주 HR 주요 소식...', date:'2026-06-02', readCount:87,  status:'sent' },
  { id:'NL002', channel:'monthly', channelLabel:'월간 경영 리포트',   title:'[월간] 2026년 5월 경영 리포트',  content:'5월 주요 경영 지표...', date:'2026-06-01', readCount:124, status:'sent' },
  { id:'NL003', channel:'events',  channelLabel:'행사·이벤트 알림',   title:'[행사] 6월 사내 행사 일정 안내', content:'6월 예정 행사...',     date:'2026-06-03', readCount:65,  status:'sent' },
];

const CHANNEL_LABELS = {
  weekly:   '주간 HR',
  monthly:  '월간 경영',
  events:   '행사·이벤트',
  learning: '학습·성장',
};

const CHANNEL_COLORS = {
  weekly:   { bg:'#EEF2FF', color:'#4F46E5' },
  monthly:  { bg:'#D1FAE5', color:'#10B981' },
  events:   { bg:'#FEF3C7', color:'#F59E0B' },
  learning: { bg:'#DBEAFE', color:'#3B82F6' },
};

function _load() {
  try { const saved = JSON.parse(localStorage.getItem(LS)||'[]');
    return [...DEMO_ISSUES.filter(d=>!saved.find(x=>x.id===d.id)), ...saved]; }
  catch { return [...DEMO_ISSUES]; }
}
function _save(list) { localStorage.setItem(LS, JSON.stringify(list)); }

const thisMonth = new Date().toISOString().slice(0, 7);

let _tab = 'history';
let _root = null;

export function render(root) { _root = root; _tab = 'history'; _draw(); }
export function unmount() { _root = null;
  _tab = 'history';
}

function _draw() {
  const all        = _load();
  const channels   = new Set(all.map(i => i.channel)).size;
  const thisMonthN = all.filter(i => i.date && i.date.startsWith(thisMonth)).length;

  const tabs = [
    { key:'history', label:`발행 내역 (${all.length})` },
    { key:'compose', label:'새 소식 작성' },
  ];

  let contentHtml = '';
  if (_tab === 'history') {
    const sorted = [...all].sort((a,b) => b.date.localeCompare(a.date));
    contentHtml = sorted.length === 0
      ? `<div style="text-align:center;padding:48px 0;color:#94A3B8">
           <div style="font-size:36px;margin-bottom:8px">&#128240;</div>
           <div style="font-size:13px">발행된 뉴스레터가 없습니다.</div>
         </div>`
      : sorted.map(i => {
          const cc = CHANNEL_COLORS[i.channel] || { bg:'#F1F5F9', color:'#64748B' };
          return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${cc.bg};color:${cc.color}">${i.channelLabel}</span>
    <span style="font-size:11px;color:#94A3B8">${i.date}</span>
  </div>
  <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:6px;line-height:1.4">${i.title}</div>
  <div style="font-size:12px;color:#94A3B8">읽음 ${i.readCount}명</div>
</div>`;
        }).join('');
  } else {
    const channelOptions = Object.entries(CHANNEL_LABELS).map(([val, label]) =>
      `<option value="${val}">${label}</option>`
    ).join('');
    contentHtml = `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="display:grid;gap:12px">
    <div>
      <label style="display:block;font-size:12px;font-weight:600;color:#64748B;margin-bottom:4px">채널</label>
      <select id="nl-channel" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--card-bg);color:var(--text)">
        ${channelOptions}
      </select>
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;color:#64748B;margin-bottom:4px">제목</label>
      <input id="nl-title" type="text" placeholder="뉴스레터 제목을 입력하세요"
        style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;color:#64748B;margin-bottom:4px">내용</label>
      <textarea id="nl-content" rows="6" placeholder="내용을 입력하세요..."
        style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;
               resize:vertical;background:var(--card-bg);color:var(--text)"></textarea>
    </div>
    <button id="nl-publish" style="padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">발행</button>
  </div>
</div>`;
  }

  _root.innerHTML = `
<div style="padding:16px;max-width:600px;margin:0 auto">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button id="nl-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text)">&#8592;</button>
    <h2 style="margin:0;font-size:17px;font-weight:700;color:var(--text)">뉴스레터 관리</h2>
  </div>

  <!-- Stats -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
    ${[
      { label:'총 발행',      val:all.length,    color:'#4F46E5' },
      { label:'구독 채널',    val:channels+'개', color:'#10B981' },
      { label:'이번 달 발행', val:thisMonthN,    color:'#F59E0B' },
    ].map(s=>`
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;text-align:center">
      <div style="font-size:20px;font-weight:700;color:${s.color}">${s.val}</div>
      <div style="font-size:11px;color:#64748B;margin-top:2px">${s.label}</div>
    </div>`).join('')}
  </div>

  <!-- Tabs -->
  <div style="display:flex;gap:6px;margin-bottom:14px">
    ${tabs.map(t=>`
    <button class="nl-tab" data-tab="${t.key}" style="
      padding:7px 14px;font-size:12px;font-weight:600;border-radius:20px;cursor:pointer;
      border:1.5px solid ${_tab===t.key?'#4F46E5':'var(--border)'};
      background:${_tab===t.key?'#EEF2FF':'var(--card-bg)'};
      color:${_tab===t.key?'#4F46E5':'#64748B'}">${t.label}</button>`).join('')}
  </div>

  <!-- Content -->
  <div id="nl-content-area">${contentHtml}</div>
</div>`;

  _bindEvents();
}

function _bindEvents() {
  _root.querySelector('#nl-back')?.addEventListener('click', () => window.navBack());

  _root.querySelectorAll('.nl-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.tab; _draw(); });
  });

  _root.querySelector('#nl-publish')?.addEventListener('click', () => {
    const channel = _root.querySelector('#nl-channel')?.value;
    const title   = _root.querySelector('#nl-title')?.value.trim();
    const content = _root.querySelector('#nl-content')?.value.trim();
    if (!title)   { showToast('제목을 입력해 주세요.'); return; }
    if (!content) { showToast('내용을 입력해 주세요.'); return; }
    const channelLabel = CHANNEL_LABELS[channel] || channel;
    const all = _load();
    all.push({
      id: 'NL' + Date.now(),
      channel,
      channelLabel,
      title,
      content,
      date: new Date().toISOString().slice(0, 10),
      readCount: 0,
      status: 'sent',
    });
    _save(all);
    showToast('뉴스레터가 발행되었습니다.');
    addNotification({ type: 'success', title: '뉴스레터 관리', body: '뉴스레터가 발행되었습니다.' });
    _tab = 'history';
    _draw();
  });
}
export function mount(root) { return render(root); }
