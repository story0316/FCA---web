/**
 * harassment-report.js — 직장내 괴롭힘 익명 신고 (#/harassment-report)
 * 근로기준법 제76조의2·3 기준
 * 신고자 ID를 저장하지 않아 익명성 보장
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
const TODAY = new Date().toISOString().slice(0,10);

const LS_REPORTS = 'hr_harassment_reports';

const REPORT_TYPES = [
  { id: 'verbal',    label: '언어적 괴롭힘', icon: '💬', desc: '폭언, 욕설, 모욕, 위협 등' },
  { id: 'physical',  label: '신체적 괴롭힘', icon: '✋', desc: '폭행, 강제, 신체 접촉 등' },
  { id: 'exclusion', label: '따돌림·고립',   icon: '🚫', desc: '집단 따돌림, 의도적 업무 배제 등' },
  { id: 'overwork',  label: '과도한 업무',   icon: '📋', desc: '부당 업무 지시, 과중 업무 부여 등' },
  { id: 'other',     label: '기타',          icon: '📢', desc: '위에 해당하지 않는 기타 유형' },
];

const STATUS_MAP = {
  received:      { label: '접수됨',   icon: '📬', color: '#3B82F6', bg: '#DBEAFE' },
  investigating: { label: '조사 중',  icon: '🔍', color: '#F59E0B', bg: '#FEF3C7' },
  resolved:      { label: '처리 완료', icon: '✅', color: '#059669', bg: '#D1FAE5' },
};

function _getReports() {
  return JSON.parse(localStorage.getItem(LS_REPORTS) || '[]');
}

function _saveReport(report) {
  const reports = _getReports();
  reports.push(report);
  localStorage.setItem(LS_REPORTS, JSON.stringify(reports));
}

let _selectedType = null;
let _activeTab    = 'report'; // 'report' | 'track'

export function render(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  root.innerHTML = `
<div class="page" id="harassment-page">
  <header class="top-bar">
    <button class="btn-icon back-btn" aria-label="뒤로">&#8592;</button>
    <h1 class="page-title">익명 신고 센터</h1>
  </header>

  <div class="page-content">

    <!-- 탭 -->
    <div class="tab-bar">
      <button class="tab-btn ${_activeTab==='report'?'active':''}" data-tab="report">🛡 신고하기</button>
      <button class="tab-btn ${_activeTab==='track'?'active':''}" data-tab="track">🔍 처리 현황</button>
    </div>

    <div id="tab-content">
      ${_activeTab === 'report' ? _renderReportForm() : _renderTrack()}
    </div>

  </div>
</div>
${_styles()}`;

  _bindEvents(root);
}

function _renderReportForm() {
  return `
<div id="report-form-wrap">
  <!-- 안내 배너 -->
  <div class="anon-banner">
    <span class="ab-icon">🔒</span>
    <div>
      <div class="ab-title">완전 익명 처리</div>
      <div class="ab-desc">신고자 정보는 일절 저장되지 않으며, 신고 번호로만 처리 현황을 확인할 수 있습니다.</div>
    </div>
  </div>

  <form id="harassment-form" novalidate>

    <!-- 유형 -->
    <div class="form-section">
      <label class="form-label">괴롭힘 유형 <span class="req">*</span></label>
      <div class="type-grid">
        ${REPORT_TYPES.map(t => `
          <button type="button" class="type-btn${_selectedType===t.id?' selected':''}" data-type="${t.id}">
            <span class="tb-icon">${t.icon}</span>
            <span class="tb-label">${t.label}</span>
          </button>`).join('')}
      </div>
      ${_selectedType ? `<p class="type-hint">${REPORT_TYPES.find(t=>t.id===_selectedType)?.desc||''}</p>` : ''}
    </div>

    <!-- 발생 일자 -->
    <div class="form-section">
      <label class="form-label" for="incident-date">발생 일자 <span class="req">*</span></label>
      <input type="date" id="incident-date" class="form-input"
        max="${new Date().toISOString().slice(0,10)}" required min="${TODAY}">
    </div>

    <!-- 신고 내용 -->
    <div class="form-section">
      <label class="form-label" for="report-desc">신고 내용 <span class="req">*</span></label>
      <textarea maxlength="500" id="report-desc" class="form-textarea" rows="5" required
        placeholder="발생 상황, 장소, 관련자 특징 등을 구체적으로 작성해 주세요. 신고자 정보는 절대 입력하지 마세요."></textarea>
      <div class="char-count" id="char-count">0 / 1000자</div>
    </div>

    <!-- 원하는 처리 방식 -->
    <div class="form-section">
      <label class="form-label">원하는 처리 방식</label>
      <div class="radio-group">
        <label class="radio-opt"><input type="radio" name="resolution" value="investigation" checked> 사실 조사 후 조치</label>
        <label class="radio-opt"><input type="radio" name="resolution" value="mediation"> 당사자 간 조정</label>
        <label class="radio-opt"><input type="radio" name="resolution" value="counseling"> 상담만 원함</label>
      </div>
    </div>

    <button type="submit" class="submit-btn">🛡 익명으로 신고하기</button>
  </form>
</div>`;
}

function _renderTrack() {
  return `
<div id="track-wrap" style="padding:16px">
  <div class="track-input-wrap">
    <input type="text" id="token-input" class="form-input" placeholder="신고 번호를 입력하세요 (예: HR-A1B2C3)">
    <button id="token-search-btn" class="track-search-btn">조회</button>
  </div>
  <div id="track-result" class="track-result-empty">
    <div class="tr-icon">🔍</div>
    <p class="tr-text">신고 번호를 입력하면 처리 현황을 확인할 수 있습니다.</p>
  </div>
</div>`;
}

function _bindEvents(root) {
  root.querySelector('.back-btn').addEventListener('click', () => window.navBack());

  // 탭 전환
  root.querySelector('.tab-bar').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    _activeTab = btn.dataset.tab;
    render(root);
  });

  // 유형 선택
  root.addEventListener('click', e => {
    const typeBtn = e.target.closest('.type-btn');
    if (typeBtn) {
      _selectedType = typeBtn.dataset.type;
      render(root);
    }
  });

  // 글자수
  root.querySelector('#report-desc')?.addEventListener('input', e => {
    const cnt = root.querySelector('#char-count');
    if (cnt) cnt.textContent = `${e.target.value.length} / 1000자`;
  });

  // 신고 제출
  root.querySelector('#harassment-form')?.addEventListener('submit', e => {
    e.preventDefault();
    _submit(root);
  });

  // 처리 현황 조회
  root.querySelector('#token-search-btn')?.addEventListener('click', () => {
    const token = root.querySelector('#token-input').value.trim().toUpperCase();
    _searchReport(root, token);
  });
}

function _submit(root) {
  if (!_selectedType) { showToast('괴롭힘 유형을 선택해 주세요.', 'error'); return; }
  const date = root.querySelector('#incident-date').value;
  const desc = root.querySelector('#report-desc').value.trim();
  const res  = root.querySelector('[name=resolution]:checked')?.value || 'investigation';

  if (!date) { showToast('발생 일자를 입력해 주세요.', 'error'); return; }
  if (desc.length < 20) { showToast('신고 내용을 20자 이상 작성해 주세요.', 'error'); return; }

  const token = 'HR-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const report = {
    id:             token,
    reportedAt:     new Date().toISOString(),
    type:           _selectedType,
    incidentDate:   date,
    description:    desc,
    resolution:     res,
    status:         'received',
    anonymousToken: token,
  };

  _saveReport(report);
  _selectedType = null;

  addNotification({
    type:    'system',
    title:   '⚠️ 괴롭힘 신고 접수',
    message: `새로운 익명 신고가 접수되었습니다. [${token}]`,
    link:    '#/admin',
  });

  // 완료 화면
  root.querySelector('#tab-content').innerHTML = `
<div class="success-screen">
  <div class="ss-icon">🛡️</div>
  <div class="ss-title">신고가 접수되었습니다</div>
  <div class="ss-token-label">신고 번호</div>
  <div class="ss-token">${token}</div>
  <p class="ss-desc">이 번호로 처리 현황 탭에서 진행 상황을 확인할 수 있습니다.<br>번호를 안전한 곳에 보관해 주세요.</p>
  <button class="btn-primary ss-btn" id="copy-token-btn">번호 복사하기</button>
</div>`;

  root.querySelector('#copy-token-btn').addEventListener('click', () => {
    navigator.clipboard?.writeText(token).then(() => showToast('신고 번호가 복사되었습니다.', 'success'));
  });
}

function _searchReport(root, token) {
  const resultEl = root.querySelector('#track-result');
  if (!token) { showToast('신고 번호를 입력해 주세요.', 'error'); return; }

  const reports = _getReports();
  const report  = reports.find(r => r.anonymousToken === token || r.id === token);

  if (!report) {
    resultEl.innerHTML = `<div class="tr-icon">❓</div><p class="tr-text">해당 신고 번호를 찾을 수 없습니다.</p>`;
    return;
  }

  const status = STATUS_MAP[report.status] || STATUS_MAP.received;
  const type   = REPORT_TYPES.find(t => t.id === report.type);

  resultEl.innerHTML = `
<div class="track-card">
  <div class="tc-header">
    <span class="tc-token">${report.id}</span>
    <span class="tc-badge" style="color:${status.color};background:${status.bg}">${status.icon} ${status.label}</span>
  </div>
  <div class="tc-row"><span class="tc-key">유형</span><span>${type?.icon} ${type?.label}</span></div>
  <div class="tc-row"><span class="tc-key">발생일</span><span>${report.incidentDate}</span></div>
  <div class="tc-row"><span class="tc-key">접수일</span><span>${report.reportedAt.slice(0,10)}</span></div>
  <div class="tc-progress">
    ${['received','investigating','resolved'].map((s,i) => {
      const cur = ['received','investigating','resolved'].indexOf(report.status);
      const active = i <= cur;
      return `<div class="tcp-step ${active?'active':''}">
        <div class="tcp-dot ${active?'filled':''}"></div>
        <div class="tcp-label">${['접수','조사 중','처리 완료'][i]}</div>
      </div>`;
    }).join('<div class="tcp-line"></div>')}
  </div>
</div>`;
}

function _styles() {
  return `<style>
#harassment-page .top-bar { display:flex; align-items:center; padding:12px 16px; gap:10px; background:var(--bg); border-bottom:1px solid var(--border); flex-shrink:0; }
#harassment-page .page-title { flex:1; font-size:18px; font-weight:700; margin:0; }

.tab-bar { display:flex; border-bottom:2px solid var(--border); margin:0; }
.tab-btn { flex:1; background:none; border:none; padding:14px; font-size:14px; font-weight:600; color:var(--text-secondary); cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-2px; }
.tab-btn.active { color:#4F46E5; border-bottom-color:#4F46E5; }

.anon-banner { display:flex; gap:12px; align-items:flex-start; background:#EEF2FF; border-radius:12px; padding:14px 16px; margin:16px 16px 0; }
.ab-icon  { font-size:22px; flex-shrink:0; }
.ab-title { font-size:14px; font-weight:700; color:#3730A3; margin-bottom:4px; }
.ab-desc  { font-size:12px; color:#4338CA; line-height:1.5; }

.form-section { padding:16px 16px 0; }
.form-label { display:block; font-size:14px; font-weight:600; margin-bottom:10px; }
.req { color:#EF4444; }
.type-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:8px; }
.type-btn { display:flex; flex-direction:column; align-items:center; gap:4px; padding:10px 6px; border:2px solid var(--border); border-radius:10px; background:var(--card-bg); cursor:pointer; transition:.15s; }
.type-btn.selected { border-color:#4F46E5; background:#EEF2FF; }
.tb-icon  { font-size:20px; }
.tb-label { font-size:11px; font-weight:600; text-align:center; }
.type-hint { font-size:12px; color:var(--text-secondary); padding:0 4px; }
.form-input { width:100%; padding:10px 12px; border:1.5px solid var(--border); border-radius:10px; font-size:14px; background:var(--card-bg); color:var(--text); box-sizing:border-box; }
.form-textarea { width:100%; padding:10px 12px; border:1.5px solid var(--border); border-radius:10px; font-size:14px; resize:vertical; background:var(--card-bg); color:var(--text); box-sizing:border-box; }
.form-input:focus, .form-textarea:focus { outline:none; border-color:#4F46E5; }
.char-count { font-size:11px; color:var(--text-secondary); text-align:right; margin-top:4px; }
.radio-group { display:flex; flex-direction:column; gap:10px; }
.radio-opt  { display:flex; align-items:center; gap:8px; font-size:14px; cursor:pointer; }
.submit-btn { display:block; width:calc(100% - 32px); margin:20px 16px 120px; background:#4F46E5; color:#fff; border:none; border-radius:12px; padding:15px; font-size:16px; font-weight:700; cursor:pointer; }

.track-input-wrap { display:flex; gap:8px; margin-bottom:16px; }
.track-search-btn { background:#4F46E5; color:#fff; border:none; border-radius:10px; padding:10px 16px; font-size:14px; font-weight:600; cursor:pointer; white-space:nowrap; }
.track-result-empty { text-align:center; padding:40px 0; }
.tr-icon { font-size:36px; margin-bottom:10px; }
.tr-text  { color:var(--text-secondary); font-size:14px; }

.track-card { background:var(--card-bg); border:1px solid var(--border); border-radius:14px; padding:16px; }
.tc-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
.tc-token  { font-size:15px; font-weight:800; font-family:monospace; }
.tc-badge  { font-size:12px; padding:4px 10px; border-radius:20px; font-weight:600; }
.tc-row    { display:flex; gap:10px; font-size:13px; padding:6px 0; border-bottom:1px dashed var(--border); }
.tc-key    { color:var(--text-secondary); min-width:44px; }
.tc-progress { display:flex; align-items:center; margin-top:16px; }
.tcp-step  { display:flex; flex-direction:column; align-items:center; gap:4px; flex:1; }
.tcp-dot   { width:16px; height:16px; border-radius:50%; border:2px solid var(--border); background:var(--bg); }
.tcp-dot.filled { background:#4F46E5; border-color:#4F46E5; }
.tcp-step.active .tcp-label { color:#4F46E5; font-weight:600; }
.tcp-label { font-size:11px; color:var(--text-secondary); text-align:center; }
.tcp-line  { flex:1; height:2px; background:var(--border); margin-bottom:16px; }

.success-screen { text-align:center; padding:40px 24px 120px; }
.ss-icon   { font-size:56px; margin-bottom:16px; }
.ss-title  { font-size:20px; font-weight:800; margin-bottom:20px; }
.ss-token-label { font-size:12px; color:var(--text-secondary); margin-bottom:8px; }
.ss-token  { font-size:28px; font-weight:900; font-family:monospace; color:#4F46E5; letter-spacing:2px; background:#EEF2FF; padding:12px 24px; border-radius:12px; display:inline-block; margin-bottom:16px; }
.ss-desc   { font-size:13px; color:var(--text-secondary); line-height:1.7; margin-bottom:24px; }
.ss-btn    { background:#4F46E5; color:#fff; border:none; border-radius:12px; padding:12px 28px; font-size:15px; font-weight:700; cursor:pointer; }
.btn-primary { display:inline-block; }
</style>`;
}

export function unmount() {
  _selectedType = null;
  _activeTab    = 'report';
}

export async function mount(root) { return render(root); }
