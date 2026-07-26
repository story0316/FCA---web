/**
 * patent.js — 직무발명 신고
 * Route: #/patent
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS_KEY = 'hr_patents';

const PATENT_TYPES = { invention: '직무발명', improvement: '개량발명', design: '디자인', trademark: '상표' };
const TYPE_ICONS = { invention: '💡', improvement: '🔧', design: '🎨', trademark: '™️' };

const STATUS_META = {
  submitted:  { label: '접수됨',   bg: '#DBEAFE', color: '#2563EB' },
  reviewing:  { label: '검토 중',   bg: '#FEF3C7', color: '#D97706' },
  registered: { label: '등록 완료', bg: '#D1FAE5', color: '#059669' },
  rejected:   { label: '반려됨',   bg: '#FEE2E2', color: '#EF4444' },
};

function _load() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } }
function _save(d) { localStorage.setItem(LS_KEY, JSON.stringify(d)); }
function _id() { return 'pat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5); }
function _today() { return new Date().toISOString().slice(0, 10); }
function _session() { try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; } }
function _uid()   { return _session().empId || _session().userId || 'EMP001'; }
function _uname() { return _session().name || '직원'; }
function _udept() { return _session().dept || _session().department || '일반'; }

function _demoPatents() {
  const uid = _uid(); const name = _uname(); const dept = _udept();
  return [
    { id: `pat_${uid}_1`, empId: uid, empName: name, dept, type: 'invention', title: 'AI 기반 역량 자동 평가 시스템', description: '직원의 업무 패턴을 분석하여 역량 수준을 자동으로 평가하는 AI 모델', techField: '인공지능/머신러닝', coInventors: '', status: 'registered', reqDate: '2025-11-10' },
    { id: `pat_${uid}_2`, empId: uid, empName: name, dept, type: 'improvement', title: '모바일 HR 앱 UX 개선 기술', description: '기존 HR 시스템의 모바일 접근성을 향상시키는 UI/UX 개선 방법', techField: '소프트웨어/UI', coInventors: '', status: 'reviewing', reqDate: '2026-03-15' },
  ];
}

function _merged() {
  const demo = _demoPatents();
  const saved = _load();
  return [...demo.filter(d => !saved.find(x => x.id === d.id)), ...saved];
}

let _tab = 'report';
let _form = {};

function _blankForm() {
  return { type: 'invention', title: '', techField: '', description: '', coInventors: '' };
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
  _tab = 'report';
  _form = _blankForm();
  _render(root);
}

export function unmount() { _tab = 'report';}

function _render(root) {
  const session = _session();
  const empId = _uid();
  const all = _merged().filter(r => r.empId === empId);

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="pat-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700;color:var(--text)">💡 직무발명 신고</div>
      <div style="font-size:11px;color:var(--text-muted)">총 ${all.length}건 · 등록 완료 ${all.filter(r => r.status === 'registered').length}건</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['report', '신고하기'], ['mypatents', '내 발명']].map(([k, l]) => `
    <button class="pat-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab === k ? '#4F46E5' : 'transparent'};
             color:${_tab === k ? '#4F46E5' : 'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">
    ${_tab === 'report' ? _renderForm() : _renderMyPatents(all)}
  </div>
</div>`;

  root.querySelector('#pat-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.pat-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _render(root); }));
  if (_tab === 'report') _bindForm(root, empId, session);
}

function _renderForm() {
  return `
<div style="max-width:480px;margin:0 auto">
  <div style="background:#EEF2FF;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#4F46E5;line-height:1.6">
    💡 직무발명은 접수 후 특허팀 검토를 거쳐 출원 절차를 진행합니다.<br>
    보상금 지급은 등록 완료 후 별도 안내됩니다.
  </div>

  <div style="margin-bottom:14px">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;font-weight:600">발명 유형 <span style="color:#EF4444">*</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${Object.entries(PATENT_TYPES).map(([k, v]) => `
      <button class="pat-type" data-key="${k}"
        style="padding:14px 8px;border:2px solid ${_form.type === k ? '#4F46E5' : 'var(--border)'};
               border-radius:12px;background:${_form.type === k ? '#EEF2FF' : 'var(--card-bg)'};cursor:pointer;text-align:center">
        <div style="font-size:22px;margin-bottom:4px">${TYPE_ICONS[k]}</div>
        <div style="font-size:12px;color:${_form.type === k ? '#4F46E5' : 'var(--text)'};font-weight:600">${v}</div>
      </button>`).join('')}
    </div>
  </div>

  <div style="margin-bottom:12px">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">발명 명칭 <span style="color:#EF4444">*</span></div>
    <input id="pat-title" type="text" placeholder="발명의 명칭을 입력해 주세요" value="${_form.title}"
      style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text)">
  </div>

  <div style="margin-bottom:12px">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">기술 분야 <span style="color:#EF4444">*</span></div>
    <input id="pat-field" type="text" placeholder="예: 인공지능, 반도체, 바이오" value="${_form.techField}"
      style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text)">
  </div>

  <div style="margin-bottom:12px">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">내용 설명 <span style="color:#EF4444">*</span></div>
    <textarea maxlength="500" id="pat-desc" rows="4" placeholder="발명의 목적, 구성, 효과 등을 설명해 주세요"
      style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text);resize:none">${_form.description}</textarea>
  </div>

  <div style="margin-bottom:16px">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">공동발명자 (선택)</div>
    <input id="pat-co" type="text" placeholder="예: 이영희 과장, 박철수 주임" value="${_form.coInventors}"
      style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text)">
  </div>

  <button id="pat-submit"
    style="width:100%;padding:13px;border:none;border-radius:12px;background:#4F46E5;color:#fff;font-size:14px;font-weight:700;cursor:pointer">
    발명 신고하기
  </button>
</div>`;
}

function _renderMyPatents(all) {
  if (!all.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">💡</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:6px">신고된 발명이 없습니다</div>
      <button onclick="location.hash='#/patent'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">발명 신고</button>
    
  <div style="font-size:12px">직무발명을 신고해 보세요</div>
</div>`;

  return `<div style="max-width:480px;margin:0 auto">${all.slice().reverse().map(r => {
    const meta = STATUS_META[r.status] || STATUS_META.submitted;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="display:flex;align-items:center;gap:10px;flex:1">
      <span style="font-size:24px">${TYPE_ICONS[r.type] || '💡'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.title}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${PATENT_TYPES[r.type] || r.type} · ${r.techField}</div>
      </div>
    </div>
    <span style="margin-left:8px;padding:3px 9px;border-radius:6px;font-size:11px;font-weight:600;background:${meta.bg};color:${meta.color};white-space:nowrap">${meta.label}</span>
  </div>
  <div style="font-size:11px;color:var(--text-muted);padding-top:6px;border-top:1px solid var(--border)">
    ${r.coInventors ? `공동발명자: ${r.coInventors} · ` : ''}신고일 ${r.reqDate}
  </div>
</div>`;
  }).join('')}</div>`;
}

function _bindForm(root, empId, session) {
  root.querySelectorAll('.pat-type').forEach(btn => {
    btn.addEventListener('click', () => { _form.type = btn.dataset.key; _render(root); });
  });

  root.querySelector('#pat-submit')?.addEventListener('click', () => {
    _form.title = root.querySelector('#pat-title')?.value.trim() || '';
    _form.techField = root.querySelector('#pat-field')?.value.trim() || '';
    _form.description = root.querySelector('#pat-desc')?.value.trim() || '';
    _form.coInventors = root.querySelector('#pat-co')?.value.trim() || '';

    if (!_form.title) { showToast('발명 명칭을 입력해 주세요.', 'error'); return; }
    if (!_form.techField) { showToast('기술 분야를 입력해 주세요.', 'error'); return; }
    if (!_form.description) { showToast('내용 설명을 입력해 주세요.', 'error'); return; }

    const saved = _load();
    saved.push({
      id: _id(),
      empId,
      empName: session.name || '직원',
      dept: session.department || '미지정',
      type: _form.type,
      title: _form.title,
      description: _form.description,
      techField: _form.techField,
      coInventors: _form.coInventors,
      status: 'submitted',
      reqDate: _today(),
    });
    _save(saved);
    showToast('직무발명 신고가 접수되었습니다.', 'success')
    addNotification({ type: 'success', title: '특허 신고', body: '직무발명 신고가 접수되었습니다.' });
    _form = _blankForm();
    _tab = 'mypatents';
    _render(root);
  });
}
