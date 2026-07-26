/**
 * language-class.js — 어학 수강 지원 신청
 * Route: #/language-class
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS_KEY = 'hr_language_classes';

const LANGUAGES = { english: '영어', japanese: '일본어', chinese: '중국어', german: '독일어', spanish: '스페인어', etc: '기타' };
const LEVELS = { beginner: '초급', intermediate: '중급', advanced: '고급' };
const LANG_FLAGS = { english: '🇺🇸', japanese: '🇯🇵', chinese: '🇨🇳', german: '🇩🇪', spanish: '🇪🇸', etc: '🌐' };

const STATUS_META = {
  pending:  { label: '검토 중', bg: '#FEF3C7', color: '#D97706' },
  approved: { label: '승인',    bg: '#D1FAE5', color: '#059669' },
  rejected: { label: '반려',    bg: '#FEE2E2', color: '#EF4444' },
};

function _load() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } }
function _save(d) { localStorage.setItem(LS_KEY, JSON.stringify(d)); }
function _id() { return 'lc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5); }
function _today() { return new Date().toISOString().slice(0, 10); }
function _session() { try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; } }
function _uid()   { return _session().empId || _session().userId || 'EMP001'; }
function _uname() { return _session().name || '직원'; }
function _udept() { return _session().dept || _session().department || '일반'; }

function _demoLanguageClasses() {
  const uid = _uid(); const name = _uname(); const dept = _udept();
  return [
    { id: `lc_${uid}_1`, empId: uid, empName: name, dept, language: 'english', level: 'intermediate', institution: '파고다 어학원', monthlyFee: 120000, startDate: '2026-07-01', endDate: '2026-12-31', status: 'approved', reqDate: '2026-05-15' },
    { id: `lc_${uid}_2`, empId: uid, empName: name, dept, language: 'japanese', level: 'beginner', institution: '야마하 일본어 학원', monthlyFee: 100000, startDate: '2026-08-01', endDate: '2027-01-31', status: 'pending', reqDate: '2026-06-01' },
  ];
}

function _merged() {
  const demo = _demoLanguageClasses();
  const saved = _load();
  return [...demo.filter(d => !saved.find(x => x.id === d.id)), ...saved];
}

let _tab = 'apply';
let _form = {};

function _blankForm() {
  return { language: 'english', level: 'beginner', institution: '', monthlyFee: '', startDate: _today(), endDate: '' };
}

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'apply';
  _form = _blankForm();
  _render(root);
}

export function unmount() { _tab = 'apply';}

function _render(root) {
  const session = _session();
  const empId = _uid();
  const all = _merged().filter(r => r.empId === empId);

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="lc-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700;color:var(--text)">📖 어학 수강 지원</div>
      <div style="font-size:11px;color:var(--text-muted)">총 ${all.length}건 · 검토 중 ${all.filter(r => r.status === 'pending').length}건</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['apply', '신청하기'], ['history', '신청 내역']].map(([k, l]) => `
    <button class="lc-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab === k ? '#4F46E5' : 'transparent'};
             color:${_tab === k ? '#4F46E5' : 'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">
    ${_tab === 'apply' ? _renderForm() : _renderHistory(all)}
  </div>
</div>`;

  root.querySelector('#lc-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.lc-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _render(root); }));
  if (_tab === 'apply') _bindForm(root, empId, session);
}

function _renderForm() {
  return `
<div style="max-width:480px;margin:0 auto">
  <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border-radius:12px;padding:12px 16px;margin-bottom:16px;color:#fff">
    <div style="font-size:13px;font-weight:700;margin-bottom:2px">💰 연간 최대 120만원 지원</div>
    <div style="font-size:11px;opacity:0.85">수료 후 실비 정산 · 영수증 제출 필수</div>
  </div>

  <div style="margin-bottom:14px">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;font-weight:600">언어 선택 <span style="color:#EF4444">*</span></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
      ${Object.entries(LANGUAGES).map(([k, v]) => `
      <button class="lc-lang" data-key="${k}"
        style="padding:12px 6px;border:2px solid ${_form.language === k ? '#4F46E5' : 'var(--border)'};
               border-radius:10px;background:${_form.language === k ? '#EEF2FF' : 'var(--card-bg)'};cursor:pointer">
        <div style="font-size:20px;margin-bottom:2px">${LANG_FLAGS[k]}</div>
        <div style="font-size:11px;color:${_form.language === k ? '#4F46E5' : 'var(--text-muted)'};font-weight:600">${v}</div>
      </button>`).join('')}
    </div>
  </div>

  <div style="margin-bottom:12px">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">수준 <span style="color:#EF4444">*</span></div>
    <div style="display:flex;gap:8px">
      ${Object.entries(LEVELS).map(([k, v]) => `
      <button class="lc-level" data-key="${k}"
        style="flex:1;padding:10px;border:2px solid ${_form.level === k ? '#4F46E5' : 'var(--border)'};
               border-radius:10px;background:${_form.level === k ? '#EEF2FF' : 'var(--card-bg)'};cursor:pointer;
               font-size:12px;font-weight:600;color:${_form.level === k ? '#4F46E5' : 'var(--text-muted)'}">${v}</button>`).join('')}
    </div>
  </div>

  <div style="margin-bottom:12px">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">학원명 <span style="color:#EF4444">*</span></div>
    <input id="lc-inst" type="text" placeholder="수강할 학원 이름을 입력해 주세요" value="${_form.institution}"
      style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text)">
  </div>

  <div style="margin-bottom:12px">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">월 수강료 (원) <span style="color:#EF4444">*</span></div>
    <input id="lc-fee" type="number" min="0" placeholder="0" value="${_form.monthlyFee}"
      style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text)">
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">수강 시작일 <span style="color:#EF4444">*</span></div>
      <input id="lc-start" type="date" value="${_form.startDate}"
        style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">수강 종료일 <span style="color:#EF4444">*</span></div>
      <input id="lc-end" type="date" value="${_form.endDate}"
        style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
  </div>

  <button id="lc-submit"
    style="width:100%;padding:13px;border:none;border-radius:12px;background:#4F46E5;color:#fff;font-size:14px;font-weight:700;cursor:pointer">
    신청하기
  </button>
</div>`;
}

function _renderHistory(all) {
  if (!all.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">📖</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:6px">신청 내역이 없습니다</div>
      <button onclick="document.querySelector('[data-tab=apply]')?.click()" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">수강 신청</button>
    
  <div style="font-size:12px">어학 수강을 신청해 보세요</div>
</div>`;

  return `<div style="max-width:480px;margin:0 auto">${all.slice().reverse().map(r => {
    const meta = STATUS_META[r.status] || STATUS_META.pending;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:24px">${LANG_FLAGS[r.language] || '🌐'}</span>
      <div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">${LANGUAGES[r.language] || r.language} · ${LEVELS[r.level] || r.level}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${r.institution}</div>
      </div>
    </div>
    <span style="padding:3px 9px;border-radius:6px;font-size:11px;font-weight:600;background:${meta.bg};color:${meta.color};white-space:nowrap">${meta.label}</span>
  </div>
  <div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:6px;border-top:1px solid var(--border)">
    <span style="padding:2px 8px;background:#F1F5F9;border-radius:5px;font-size:11px;color:var(--text-muted)">${r.startDate} ~ ${r.endDate}</span>
    <span style="padding:2px 8px;background:#EEF2FF;border-radius:5px;font-size:11px;color:#4F46E5;font-weight:600">${(r.monthlyFee || 0).toLocaleString()}원/월</span>
  </div>
</div>`;
  }).join('')}</div>`;
}

function _bindForm(root, empId, session) {
  root.querySelectorAll('.lc-lang').forEach(btn => {
    btn.addEventListener('click', () => { _form.language = btn.dataset.key; _render(root); });
  });
  root.querySelectorAll('.lc-level').forEach(btn => {
    btn.addEventListener('click', () => { _form.level = btn.dataset.key; _render(root); });
  });

  root.querySelector('#lc-submit')?.addEventListener('click', () => {
    _form.institution = root.querySelector('#lc-inst')?.value.trim() || '';
    _form.monthlyFee = parseInt(root.querySelector('#lc-fee')?.value) || '';
    _form.startDate = root.querySelector('#lc-start')?.value || _today();
    _form.endDate = root.querySelector('#lc-end')?.value || '';

    if (!_form.institution) { showToast('학원명을 입력해 주세요.', 'error'); return; }
    if (!_form.monthlyFee) { showToast('월 수강료를 입력해 주세요.', 'error'); return; }
    if (!_form.endDate) { showToast('수강 종료일을 입력해 주세요.', 'error'); return; }
    if (new Date(_form.endDate) < new Date(_form.startDate)) { showToast('종료일이 시작일보다 빠릅니다.', 'error'); return; }

    const saved = _load();
    saved.push({
      id: _id(),
      empId,
      empName: session.name || '직원',
      dept: session.department || '미지정',
      language: _form.language,
      level: _form.level,
      institution: _form.institution,
      monthlyFee: _form.monthlyFee,
      startDate: _form.startDate,
      endDate: _form.endDate,
      status: 'pending',
      reqDate: _today(),
    });
    _save(saved);
    showToast('어학 수강 지원 신청이 완료되었습니다.', 'success')
    addNotification({ type: 'success', title: '어학 수강', body: '어학 수강 지원 신청이 완료되었습니다.' });
    _form = _blankForm();
    _tab = 'history';
    _render(root);
  });
}
