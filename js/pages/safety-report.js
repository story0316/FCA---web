/**
 * safety-report.js — 안전사고 보고 (산업안전보건법 §26)
 */

import {getUser, isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
const TODAY = new Date().toISOString().slice(0,10);

function _session() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}'); } catch { return {}; } }

const LS = 'hr_safety_reports';

const INCIDENT_TYPES = [
  { key: 'accident',    label: '산업재해',    icon: '🚨', desc: '부상·질병 등 실제 재해 발생' },
  { key: 'near_miss',   label: '아차사고',    icon: '⚠️', desc: '재해가 될 뻔한 상황 (무재해 운동)' },
  { key: 'hazard',      label: '위험 요인',   icon: '🔍', desc: '잠재적 위험 환경·설비 발견' },
  { key: 'illness',     label: '직업성 질환', icon: '🏥', desc: '업무 관련 신체·정신 증상' },
];

const SEVERITY = [
  { key: 'critical', label: '중대사고',  color: '#EF4444', bg: '#FEE2E2' },
  { key: 'major',    label: '경상',      color: '#F59E0B', bg: '#FEF3C7' },
  { key: 'minor',    label: '경미',      color: '#3B82F6', bg: '#DBEAFE' },
  { key: 'near',     label: '아차사고',  color: '#8B5CF6', bg: '#EDE9FE' },
];

const BODY_PARTS = ['머리/얼굴','목','어깨/팔','손/손목','허리/등','다리/무릎','발/발목','눈','기타'];
const LOCATIONS  = ['사무실','공장/현장','주차장','계단/복도','화장실','외근지','출퇴근 중','기타'];

const STATUS_META = {
  submitted: { label: '접수됨',   color: '#3B82F6', bg: '#DBEAFE' },
  reviewing: { label: '조사 중',  color: '#F59E0B', bg: '#FEF3C7' },
  closed:    { label: '종결',     color: '#10B981', bg: '#D1FAE5' },
};

function _getAll() { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } }
function _save(l) { localStorage.setItem(LS, JSON.stringify(l)); }
function _id()    { return 'sr_' + Date.now() + '_' + Math.random().toString(36).slice(2,6); }

let _tab = 'report';
let _selectedType = null;

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
  _selectedType = null;
  _draw(root);
}
export function unmount() { _tab = 'report'; _selectedType = null; }

function _draw(root) {
  const user = getUser();
  const uid  = _session().empId || _session().userId || user?.id || 'demo';
  const myReports = _getAll().filter(r => r.empId === uid).sort((a,b) => b.createdAt.localeCompare(a.createdAt));

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden">
  <div class="page-header" style="flex-shrink:0;background:var(--card-bg);border-bottom:1px solid var(--border);padding:16px;display:flex;align-items:center;gap:12px">
    <button onclick="window.navBack()"
      style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0;line-height:1">←</button>
    <div>
      <div style="font-size:16px;font-weight:700;color:var(--text)">안전사고 보고</div>
      <div style="font-size:11px;color:var(--text-muted)">산업안전보건법 §26 — 위험요인 즉시 보고</div>
    </div>
  </div>

  <div style="flex-shrink:0;display:flex;border-bottom:1px solid var(--border);background:var(--card-bg)">
    <button class="sf-tab" data-t="report"
      style="flex:1;padding:12px;font-size:13px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab==='report'?'#EF4444':'transparent'};color:${_tab==='report'?'#EF4444':'var(--text-muted)'}">
      🚨 보고하기</button>
    <button class="sf-tab" data-t="history"
      style="flex:1;padding:12px;font-size:13px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab==='history'?'#4F46E5':'transparent'};color:${_tab==='history'?'#4F46E5':'var(--text-muted)'}">
      내 보고 (${myReports.length})</button>
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:16px">
    ${_tab === 'report'  ? _renderReport() : ''}
    ${_tab === 'history' ? _renderHistory(myReports) : ''}
  </div>
</div>`;

  root.querySelectorAll('.sf-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _draw(root); });
  });

  if (_tab === 'report') _bindReport(root, uid, user);
}

function _renderReport() {
  const sel = _selectedType ? INCIDENT_TYPES.find(t => t.key === _selectedType) : null;

  return `
<!-- 긴급 안내 -->
<div style="background:#FEE2E2;border:1.5px solid #EF4444;border-radius:12px;padding:12px;margin-bottom:16px">
  <div style="font-size:12px;font-weight:700;color:#EF4444;margin-bottom:4px">🚨 긴급 상황 시</div>
  <div style="font-size:11px;color:#7F1D1D;line-height:1.6">
    인명 피해가 있거나 즉각 대응이 필요한 경우<br>
    <strong>119</strong> 또는 내선 <strong>안전팀 1119</strong>로 먼저 연락하세요.
  </div>
</div>

<!-- 유형 선택 -->
<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">사고 유형 선택</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
  ${INCIDENT_TYPES.map(t => {
    const active = _selectedType === t.key;
    return `<button class="sf-type-btn" data-key="${t.key}"
      style="padding:12px;border-radius:12px;border:2px solid ${active?'#EF4444':'var(--border)'};
             background:${active?'#FEE2E2':'var(--card-bg)'};cursor:pointer;text-align:left">
      <div style="font-size:22px;margin-bottom:4px">${t.icon}</div>
      <div style="font-size:11px;font-weight:700;color:${active?'#EF4444':'var(--text)'}">${t.label}</div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:2px;line-height:1.4">${t.desc}</div>
    </button>`;
  }).join('')}
</div>

${sel ? `
<form id="sf-form">
  <div style="display:flex;flex-direction:column;gap:12px">
    <!-- 발생일시 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <label style="font-size:11px;font-weight:700;color:var(--text);display:block;margin-bottom:4px">발생일 <span style="color:#EF4444">*</span></label>
        <input id="sf-date" type="date" required
          style="width:100%;padding:9px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;background:var(--bg);color:var(--text);box-sizing:border-box" min="${TODAY}">
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:var(--text);display:block;margin-bottom:4px">발생 시간</label>
        <input id="sf-time" type="time"
          style="width:100%;padding:9px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;background:var(--bg);color:var(--text);box-sizing:border-box">
      </div>
    </div>

    <!-- 발생 장소 -->
    <div>
      <label style="font-size:11px;font-weight:700;color:var(--text);display:block;margin-bottom:4px">발생 장소 <span style="color:#EF4444">*</span></label>
      <select id="sf-location" required
        style="width:100%;padding:9px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text)">
        <option value="">선택하세요</option>
        ${LOCATIONS.map(l => `<option value="${l}">${l}</option>`).join('')}
      </select>
    </div>

    ${_selectedType === 'accident' || _selectedType === 'illness' ? `
    <!-- 심각도 & 부위 -->
    <div>
      <label style="font-size:11px;font-weight:700;color:var(--text);display:block;margin-bottom:6px">심각도 <span style="color:#EF4444">*</span></label>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${SEVERITY.map(s => `
          <button type="button" class="sf-sev-btn" data-key="${s.key}"
            style="padding:6px 12px;border-radius:20px;border:1.5px solid ${s.color};background:${s.bg};
                   color:${s.color};font-size:11px;font-weight:700;cursor:pointer">
            ${s.label}
          </button>`).join('')}
      </div>
      <input type="hidden" id="sf-severity">
    </div>
    <div>
      <label style="font-size:11px;font-weight:700;color:var(--text);display:block;margin-bottom:6px">피해 부위 (해당 시)</label>
      <div style="display:flex;gap:5px;flex-wrap:wrap">
        ${BODY_PARTS.map(b => `
          <button type="button" class="sf-body-btn" data-part="${b}"
            style="padding:5px 10px;border-radius:20px;border:1.5px solid var(--border);background:var(--bg);
                   color:var(--text-muted);font-size:11px;cursor:pointer">
            ${b}
          </button>`).join('')}
      </div>
      <input type="hidden" id="sf-body-part">
    </div>` : ''}

    <!-- 상황 설명 -->
    <div>
      <label style="font-size:11px;font-weight:700;color:var(--text);display:block;margin-bottom:4px">상황 설명 <span style="color:#EF4444">*</span></label>
      <textarea maxlength="500" id="sf-desc" rows="4" required
        placeholder="어떤 상황에서 발생했는지 구체적으로 작성해주세요. 목격자, 관련 장비, 진행 중이던 작업 등을 포함해 주세요."
        style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;background:var(--bg);color:var(--text);resize:vertical;box-sizing:border-box"></textarea>
    </div>

    <!-- 즉각 조치 -->
    <div>
      <label style="font-size:11px;font-weight:700;color:var(--text);display:block;margin-bottom:4px">즉각 조치 내용</label>
      <textarea maxlength="500" id="sf-action" rows="2"
        placeholder="취한 응급 조치나 대응 내용을 작성해주세요."
        style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;background:var(--bg);color:var(--text);resize:vertical;box-sizing:border-box"></textarea>
    </div>

    <!-- 익명 여부 -->
    <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
      <input id="sf-anon" type="checkbox" style="width:16px;height:16px;cursor:pointer">
      <span style="font-size:12px;color:#475569">익명으로 보고 (보고자 정보 비공개)</span>
    </label>

    <button type="submit"
      style="width:100%;padding:13px;background:#EF4444;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">
      🚨 보고 접수
    </button>
  </div>
</form>` : `
<div style="text-align:center;padding:40px 20px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:12px">⚠️</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:6px">사고 유형을 선택해주세요</div>
  <div style="font-size:12px">위에서 해당 유형을 선택하면 보고서 양식이 표시됩니다</div>
</div>`}`;
}

function _renderHistory(reports) {
  if (!reports.length) {
    return `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
      <div style="font-size:40px;margin-bottom:12px">✅</div>
      <div style="font-size:14px;font-weight:600">보고 이력이 없습니다</div>
      <button onclick="document.querySelector('[data-t=report]')?.click()" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">안전 신고</button>
    
    </div>`;
  }
  return reports.map(r => {
    const t  = INCIDENT_TYPES.find(x => x.key === r.incidentType) || { icon: '⚠️', label: r.incidentType };
    const sm = STATUS_META[r.status] || STATUS_META.submitted;
    const sv = r.severity ? SEVERITY.find(s => s.key === r.severity) : null;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:22px">${t.icon}</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${t.label}</div>
        <div style="font-size:11px;color:var(--text-muted)">${r.incidentDate} ${r.incidentTime||''} · ${r.location}</div>
      </div>
    </div>
    <span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${sm.bg};color:${sm.color};flex-shrink:0">${sm.label}</span>
  </div>
  ${sv ? `<span style="padding:3px 8px;background:${sv.bg};color:${sv.color};border-radius:6px;font-size:11px;font-weight:700;margin-bottom:8px;display:inline-block">${sv.label}</span>` : ''}
  <div style="font-size:12px;color:var(--text-muted);line-height:1.5;margin-top:4px">${r.description}</div>
  ${r.adminComment ? `<div style="margin-top:8px;padding:8px;background:var(--bg);border-radius:8px;font-size:11px;color:var(--text-muted)"><span style="font-weight:600">안전팀 코멘트:</span> ${r.adminComment}</div>` : ''}
</div>`;
  }).join('');
}

function _bindReport(root, uid, user) {
  root.querySelectorAll('.sf-type-btn').forEach(btn => {
    btn.addEventListener('click', () => { _selectedType = btn.dataset.key; _draw(root); });
  });

  let selectedSeverity = '';
  let selectedBodyPart = '';

  root.querySelectorAll('.sf-sev-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedSeverity = btn.dataset.key;
      const sev = SEVERITY.find(s => s.key === selectedSeverity);
      root.querySelectorAll('.sf-sev-btn').forEach(b => {
        const s = SEVERITY.find(x => x.key === b.dataset.key);
        b.style.borderWidth = b.dataset.key === selectedSeverity ? '2.5px' : '1.5px';
        b.style.fontWeight  = b.dataset.key === selectedSeverity ? '900' : '700';
      });
      const h = root.querySelector('#sf-severity');
      if (h) h.value = selectedSeverity;
    });
  });

  root.querySelectorAll('.sf-body-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedBodyPart = btn.dataset.part;
      root.querySelectorAll('.sf-body-btn').forEach(b => {
        const sel = b.dataset.part === selectedBodyPart;
        b.style.borderColor = sel ? '#EF4444' : 'var(--border)';
        b.style.background  = sel ? '#FEE2E2' : 'var(--bg)';
        b.style.color       = sel ? '#EF4444' : 'var(--text-muted)';
      });
      const h = root.querySelector('#sf-body-part');
      if (h) h.value = selectedBodyPart;
    });
  });

  root.querySelector('#sf-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const _submitBtn = root.querySelector('button[type="submit"]');
    if (_submitBtn) _submitBtn.disabled = true;
    const date     = root.querySelector('#sf-date').value;
    const time     = root.querySelector('#sf-time')?.value || '';
    const location = root.querySelector('#sf-location').value;
    const desc     = root.querySelector('#sf-desc').value.trim();
    const action   = root.querySelector('#sf-action')?.value.trim() || '';
    const anon     = root.querySelector('#sf-anon').checked;

    if (!date || !location || !desc) { showToast('발생일, 장소, 상황 설명은 필수입니다.', 'error'); return; }

    const empName = anon ? '익명' : (user?.name || user?.email?.split('@')[0] || '직원');
    const all = _getAll();
    all.push({
      id: _id(), empId: anon ? 'anon' : uid, empName,
      incidentType: _selectedType,
      incidentDate: date, incidentTime: time,
      location, severity: selectedSeverity,
      bodyPart: selectedBodyPart,
      description: desc, immediateAction: action,
      status: 'submitted',
      adminComment: null,
      createdAt: new Date().toISOString(),
    });
    _save(all);
    showToast('안전사고 보고가 접수되었습니다. 감사합니다.', 'success');
    if (_submitBtn) _submitBtn.disabled = false;
    addNotification({ type: 'warning', title: '안전사고 보고 접수', message: `${INCIDENT_TYPES.find(t=>t.key===_selectedType)?.label} 보고가 안전팀에 전달되었습니다.` });
    _selectedType = null;
    _tab = 'history';
    _draw(root);
  });
}
