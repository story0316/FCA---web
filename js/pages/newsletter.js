import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
import { isApplicant } from '../auth.js';

const CHANNELS = [
  { key: 'weekly',   label: '주간 HR 뉴스레터',   icon: '📰', freq: '매주 월요일',  desc: '주요 인사 소식·정책 업데이트' },
  { key: 'monthly',  label: '월간 경영 리포트',    icon: '📊', freq: '매월 1일',     desc: '경영 성과·전략 방향 공유' },
  { key: 'events',   label: '행사·이벤트 알림',    icon: '🎉', freq: '수시',         desc: '사내 행사·복지 소식 즉시 안내' },
  { key: 'learning', label: '학습·성장 뉴스레터',  icon: '📚', freq: '격주 금요일',  desc: '교육 기회·역량 개발 소식' },
];

const DEMO_ISSUES = [
  { id: 'NL001', channel: 'weekly',   title: '[주간 HR] 2026년 6월 1주차',     preview: '이번 주 HR 주요 소식: 하계 휴가 정책 안내, 신규 복지제도 도입 예고, 6월 전사 MT 참가 신청...', date: '2026-06-02', readCount: 87 },
  { id: 'NL002', channel: 'monthly',  title: '[월간 경영] 2026년 5월 경영 성과', preview: '5월 영업이익 전월 대비 12% 증가, 신규 고객사 3곳 확보, 하반기 신사업 로드맵 발표...', date: '2026-06-01', readCount: 134 },
  { id: 'NL003', channel: 'learning', title: '[학습소식] 6월 추천 온라인 강의 5선', preview: '리더십, 데이터 분석, UX 리서치, 재무 기초, 영어 비즈니스 커뮤니케이션 강의 할인 정보...', date: '2026-05-30', readCount: 56 },
];

const LS_SUBS   = 'hr_newsletter_subs';
const LS_ISSUES = 'hr_newsletter_issues';

const CHANNEL_COLORS = {
  weekly:   { bg: '#dbeafe', color: '#2563eb' },
  monthly:  { bg: '#d1fae5', color: '#059669' },
  events:   { bg: '#fef3c7', color: '#d97706' },
  learning: { bg: '#ede9fe', color: '#7c3aed' },
};

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId() { return _session().empId || 'EMP001'; }

function _loadSubs() {
  try {
    const raw = localStorage.getItem(LS_SUBS);
    if (!raw) {
      const defaults = { empId: _empId(), subscribed: ['weekly', 'events'] };
      localStorage.setItem(LS_SUBS, JSON.stringify([defaults]));
      return defaults;
    }
    const all = JSON.parse(raw);
    const mine = all.find(s => s.empId === _empId());
    if (!mine) {
      const defaults = { empId: _empId(), subscribed: ['weekly', 'events'] };
      all.push(defaults);
      localStorage.setItem(LS_SUBS, JSON.stringify(all));
      return defaults;
    }
    return mine;
  } catch { return { empId: _empId(), subscribed: ['weekly', 'events'] }; }
}

function _saveSubs(subscribed) {
  try {
    const raw = localStorage.getItem(LS_SUBS);
    let all = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex(s => s.empId === _empId());
    if (idx > -1) all[idx].subscribed = subscribed;
    else all.push({ empId: _empId(), subscribed });
    localStorage.setItem(LS_SUBS, JSON.stringify(all));
  } catch { /* ignore */ }
}

function _loadIssues() {
  try {
    const raw = localStorage.getItem(LS_ISSUES);
    if (!raw) { localStorage.setItem(LS_ISSUES, JSON.stringify(DEMO_ISSUES)); return [...DEMO_ISSUES]; }
    return JSON.parse(raw);
  } catch { return [...DEMO_ISSUES]; }
}

let _root = null;
let _activeTab = 'subs';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _root = root;
  _activeTab = 'subs';
  _render();
}

export function unmount() {
  delete window._nlSetTab;
  delete window._nlToggle;
  _root = null;
}

function _render() {
  if (!_root) return;
  _root.innerHTML = `
    <div class="page" style="height:100vh;overflow:hidden;background:var(--bg);display:flex;flex-direction:column;">
      <div style="background:var(--card-bg);padding:16px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);flex-shrink:0;">
        <button onclick="window.navBack()" style="background:none;border:none;font-size:20px;cursor:pointer;padding:4px;">←</button>
        <h1 style="margin:0;font-size:17px;font-weight:700;color:var(--text);">사내 소식 구독</h1>
      </div>
      <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0;">
        <button onclick="window._nlSetTab('subs')"
          style="flex:1;padding:12px;border:none;background:none;font-size:14px;font-weight:600;cursor:pointer;color:${_activeTab==='subs'?'#6366f1':'#6b7280'};border-bottom:2px solid ${_activeTab==='subs'?'#6366f1':'transparent'};">
          구독 설정
        </button>
        <button onclick="window._nlSetTab('issues')"
          style="flex:1;padding:12px;border:none;background:none;font-size:14px;font-weight:600;cursor:pointer;color:${_activeTab==='issues'?'#6366f1':'#6b7280'};border-bottom:2px solid ${_activeTab==='issues'?'#6366f1':'transparent'};">
          최신 소식
        </button>
      </div>
      <div class="page-content" style="overflow-y:auto;flex:1;">
        ${_activeTab === 'subs' ? _renderSubs() : _renderIssues()}
      </div>
    </div>`;

  window._nlSetTab = (t) => { _activeTab = t; _render(); };
  window._nlToggle = _handleToggle;
}

function _renderSubs() {
  const myPrefs = _loadSubs();
  const subscribed = new Set(myPrefs.subscribed || []);

  return `
    <div style="padding:16px;display:flex;flex-direction:column;gap:12px;">
      <p style="margin:0;font-size:14px;color:var(--text-muted);">구독할 채널을 선택하면 이메일로 소식을 받아볼 수 있습니다.</p>
      ${CHANNELS.map(ch => {
        const active = subscribed.has(ch.key);
        const cc = CHANNEL_COLORS[ch.key] || { bg: '#f3f4f6', color: '#6b7280' };
        return `
          <div style="background:var(--card-bg);border-radius:14px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);display:flex;align-items:center;gap:14px;">
            <span style="font-size:28px;flex-shrink:0;">${ch.icon}</span>
            <div style="flex:1;min-width:0;">
              <p style="margin:0 0 3px;font-size:14px;font-weight:700;color:var(--text);">${ch.label}</p>
              <p style="margin:0 0 3px;font-size:12px;color:var(--text-muted);">${ch.desc}</p>
              <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;background:${cc.bg};color:${cc.color};">${ch.freq}</span>
            </div>
            <button onclick="window._nlToggle('${ch.key}')"
              style="flex-shrink:0;width:48px;height:28px;border-radius:14px;border:none;background:${active?'#6366f1':'#d1d5db'};cursor:pointer;position:relative;transition:background 0.2s;">
              <span style="position:absolute;top:3px;${active?'right:3px':'left:3px'};width:22px;height:22px;background:var(--card-bg);border-radius:50%;display:block;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></span>
            </button>
          </div>`;
      }).join('')}
    </div>`;
}

function _renderIssues() {
  const issues = _loadIssues();

  if (!issues.length) return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:12px;">
      <span style="font-size:48px;">📰</span>
      <p style="margin:0;font-size:15px;font-weight:600;color:var(--text);">최신 소식이 없습니다</p>
      <p style="margin:0;font-size:12px;color:var(--text-muted)">공지사항에서 최신 소식을 확인해 보세요.</p>
      <button onclick="window.location.hash='#/notice'"
        style="padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">공지사항 보기</button>
    </div>`;

  return `
    <div style="padding:16px;display:flex;flex-direction:column;gap:12px;">
      ${issues.map(issue => {
        const ch = CHANNELS.find(c => c.key === issue.channel);
        const cc = CHANNEL_COLORS[issue.channel] || { bg: '#f3f4f6', color: '#6b7280' };
        return `
          <div style="background:var(--card-bg);border-radius:14px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <span style="font-size:14px;">${ch?.icon || '📄'}</span>
              <span style="font-size:12px;font-weight:600;padding:2px 8px;border-radius:20px;background:${cc.bg};color:${cc.color};">${ch?.label || issue.channel}</span>
              <span style="font-size:12px;color:var(--text-muted);margin-left:auto;">${issue.date}</span>
            </div>
            <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:var(--text);">${issue.title}</p>
            <p style="margin:0 0 8px;font-size:13px;color:var(--text-muted);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${issue.preview}</p>
            <p style="margin:0;font-size:12px;color:var(--text-muted);">읽음 ${issue.readCount}명</p>
          </div>`;
      }).join('')}
    </div>`;
}

function _handleToggle(key) {
  const myPrefs = _loadSubs();
  const subscribed = new Set(myPrefs.subscribed || []);
  const ch = CHANNELS.find(c => c.key === key);

  if (subscribed.has(key)) {
    subscribed.delete(key);
    showToast(`${ch?.label || key} 구독을 해제했습니다.`, 'info');
  } else {
    subscribed.add(key);
    showToast(`${ch?.label || key} 구독을 시작했습니다.`, 'success')
    addNotification({ type: 'success', title: '뉴스레터', body: '구독을 시작했습니다.' });
  }
  _saveSubs([...subscribed]);
  _render();
}
