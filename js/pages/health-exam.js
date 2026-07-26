/**
 * health-exam.js — 건강검진 예약
 * Route: #/health-exam
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS_KEY = 'hr_health_exams';

const EXAM_TYPES = { basic: '기본검진', premium: '종합검진', womens: '여성검진', executive: '임원검진' };
const HOSPITALS = ['서울아산병원', '서울삼성병원', '강남세브란스', '연세의료원', '분당서울대병원'];

const TYPE_ICONS = { basic: '🩺', premium: '🏥', womens: '👩‍⚕️', executive: '⭐' };

const STATUS_META = {
  scheduled:  { label: '예약됨',   bg: '#DBEAFE', color: '#2563EB' },
  completed:  { label: '검진 완료', bg: '#D1FAE5', color: '#059669' },
  cancelled:  { label: '취소됨',   bg: '#F1F5F9', color: 'var(--text-muted)' },
};

function _load() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } }
function _save(d) { localStorage.setItem(LS_KEY, JSON.stringify(d)); }
function _id() { return 'he_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5); }
function _today() { return new Date().toISOString().slice(0, 10); }
function _session() { try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; } }
function _uid()   { return _session().empId || _session().userId || 'EMP001'; }
function _uname() { return _session().name || '직원'; }
function _udept() { return _session().dept || _session().department || '일반'; }

function _demoExams() {
  const uid = _uid(); const name = _uname(); const dept = _udept();
  return [
    { id: `he_${uid}_1`, empId: uid, empName: name, dept, examType: 'basic', hospital: '강남세브란스', examDate: '2026-07-15', status: 'scheduled', reqDate: '2026-06-01' },
    { id: `he_${uid}_2`, empId: uid, empName: name, dept, examType: 'premium', hospital: '서울아산병원', examDate: '2025-08-20', status: 'completed', reqDate: '2025-07-15' },
  ];
}

function _merged() {
  const demo = _demoExams();
  const saved = _load();
  return [...demo.filter(d => !saved.find(x => x.id === d.id)), ...saved];
}

let _tab = 'book';
let _form = {};

function _blankForm() {
  return { examType: 'basic', hospital: HOSPITALS[0], examDate: '' };
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
  _tab = 'book';
  _form = _blankForm();
  _render(root);
}

export function unmount() { _tab = 'book';}

function _render(root) {
  const session = _session();
  const empId = _uid();
  const all = _merged().filter(r => r.empId === empId);

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="he-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700;color:var(--text)">🏥 건강검진 예약</div>
      <div style="font-size:11px;color:var(--text-muted)">총 ${all.length}건 · 예약됨 ${all.filter(r => r.status === 'scheduled').length}건</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['book', '검진 예약'], ['history', '내 검진 내역']].map(([k, l]) => `
    <button class="he-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab === k ? '#4F46E5' : 'transparent'};
             color:${_tab === k ? '#4F46E5' : 'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">
    ${_tab === 'book' ? _renderForm() : _renderHistory(all)}
  </div>
</div>`;

  root.querySelector('#he-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.he-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _render(root); }));
  if (_tab === 'book') _bindForm(root, empId, session);
}

function _renderForm() {
  return `
<div style="max-width:480px;margin:0 auto">
  <div style="background:linear-gradient(135deg,#059669,#10B981);border-radius:12px;padding:12px 16px;margin-bottom:16px;color:#fff">
    <div style="font-size:13px;font-weight:700;margin-bottom:2px">✅ 연 1회 전액 지원</div>
    <div style="font-size:11px;opacity:0.85">본인 부담금 없음 · 예약 확인 후 안내 메일 발송</div>
  </div>

  <div style="margin-bottom:14px">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;font-weight:600">검진 유형 <span style="color:#EF4444">*</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${Object.entries(EXAM_TYPES).map(([k, v]) => `
      <button class="he-type" data-key="${k}"
        style="padding:14px 8px;border:2px solid ${_form.examType === k ? '#4F46E5' : 'var(--border)'};
               border-radius:12px;background:${_form.examType === k ? '#EEF2FF' : 'var(--card-bg)'};cursor:pointer;text-align:center">
        <div style="font-size:24px;margin-bottom:4px">${TYPE_ICONS[k]}</div>
        <div style="font-size:12px;color:${_form.examType === k ? '#4F46E5' : 'var(--text)'};font-weight:600">${v}</div>
      </button>`).join('')}
    </div>
  </div>

  <div style="margin-bottom:12px">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">병원 선택 <span style="color:#EF4444">*</span></div>
    <select id="he-hospital"
      style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text)">
      ${HOSPITALS.map(h => `<option value="${h}" ${_form.hospital === h ? 'selected' : ''}>${h}</option>`).join('')}
    </select>
  </div>

  <div style="margin-bottom:16px">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600">희망 검진일 <span style="color:#EF4444">*</span></div>
    <input id="he-date" type="date" value="${_form.examDate}" min="${_today()}"
      style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text)">
    <div style="font-size:11px;color:var(--text-muted);margin-top:4px">* 최종 일정은 병원 확인 후 안내됩니다</div>
  </div>

  <button id="he-submit"
    style="width:100%;padding:13px;border:none;border-radius:12px;background:#4F46E5;color:#fff;font-size:14px;font-weight:700;cursor:pointer">
    검진 예약하기
  </button>
</div>`;
}

function _renderHistory(all) {
  if (!all.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">🏥</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:6px">검진 내역이 없습니다</div>
      <button onclick="location.hash='#/health-exam'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">검진 예약</button>
    
  <div style="font-size:12px">건강검진을 예약해 보세요</div>
</div>`;

  return `<div style="max-width:480px;margin:0 auto">${all.slice().reverse().map(r => {
    const meta = STATUS_META[r.status] || STATUS_META.scheduled;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:24px">${TYPE_ICONS[r.examType] || '🩺'}</span>
      <div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">${EXAM_TYPES[r.examType] || r.examType}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${r.hospital}</div>
      </div>
    </div>
    <span style="padding:3px 9px;border-radius:6px;font-size:11px;font-weight:600;background:${meta.bg};color:${meta.color};white-space:nowrap">${meta.label}</span>
  </div>
  <div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:6px;border-top:1px solid var(--border)">
    <span style="padding:2px 8px;background:#F1F5F9;border-radius:5px;font-size:11px;color:var(--text-muted)">📅 ${r.examDate}</span>
    <span style="padding:2px 8px;background:#F1F5F9;border-radius:5px;font-size:11px;color:var(--text-muted)">신청 ${r.reqDate}</span>
  </div>
</div>`;
  }).join('')}</div>`;
}

function _bindForm(root, empId, session) {
  root.querySelectorAll('.he-type').forEach(btn => {
    btn.addEventListener('click', () => { _form.examType = btn.dataset.key; _render(root); });
  });

  root.querySelector('#he-submit')?.addEventListener('click', () => {
    _form.hospital = root.querySelector('#he-hospital')?.value || HOSPITALS[0];
    _form.examDate = root.querySelector('#he-date')?.value || '';

    if (!_form.examDate) { showToast('희망 검진일을 선택해 주세요.', 'error'); return; }
    if (_form.examDate < _today()) { showToast('검진일은 오늘 이후 날짜여야 합니다.', 'error'); return; }

    const saved = _load();
    saved.push({
      id: _id(),
      empId,
      empName: session.name || '직원',
      dept: session.department || '미지정',
      examType: _form.examType,
      hospital: _form.hospital,
      examDate: _form.examDate,
      status: 'scheduled',
      reqDate: _today(),
    });
    _save(saved);
    showToast('건강검진이 예약되었습니다.', 'success')
    addNotification({ type: 'success', title: '건강검진', body: '건강검진이 예약되었습니다.' });
    _form = _blankForm();
    _tab = 'history';
    _render(root);
  });
}
