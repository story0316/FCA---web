/**
 * probation.js — 수습 평가 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_probation';
const QUESTIONS = [
  '직무 역량 발휘도',
  '팀워크 및 협업',
  '업무 태도 및 책임감',
  '목표 달성도',
  '조직 적응도',
];

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }

function _getMyRecord() {
  try {
    const raw = localStorage.getItem(LS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Admin might store an array — find mine
    if (Array.isArray(parsed)) return parsed.find(r=>r.empId===_empId())||null;
    // Employee stored single record
    if (parsed.empId === _empId()) return parsed;
    return null;
  } catch { return null; }
}
function _saveMyRecord(rec) {
  try {
    const raw = localStorage.getItem(LS);
    if (!raw) { localStorage.setItem(LS, JSON.stringify(rec)); return; }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const idx = parsed.findIndex(r=>r.empId===rec.empId);
      if (idx>=0) parsed[idx]=rec; else parsed.push(rec);
      localStorage.setItem(LS, JSON.stringify(parsed));
    } else {
      localStorage.setItem(LS, JSON.stringify(rec));
    }
  } catch { localStorage.setItem(LS, JSON.stringify(rec)); }
}

function _daysLeft(endDate) {
  const diff = new Date(endDate) - new Date();
  return Math.ceil(diff / 86400000);
}
function _elapsed(start, end) {
  const total = new Date(end) - new Date(start);
  const done  = Date.now() - new Date(start);
  return Math.min(100, Math.max(0, Math.round((done/total)*100)));
}

const STATUS_META = {
  in_probation: { label:'수습 중',   color:'#3B82F6', bg:'#EFF6FF' },
  passed:       { label:'통과',      color:'#10B981', bg:'#ECFDF5' },
  extended:     { label:'연장',      color:'#F59E0B', bg:'#FFFBEB' },
  failed:       { label:'미통과',    color:'#EF4444', bg:'#FEF2F2' },
};

let _tab    = 'status';
let _scores = [0, 0, 0, 0, 0];
let _root   = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _root = root; _tab = 'status'; _scores = [0,0,0,0,0]; _render();
}
export function unmount() { _root = null; _tab = 'status'; }

function _render() {
  if (!_root) return;
  let rec = _getMyRecord();
  if (!rec) {
    rec = {
      empId: _empId(), empName: _empName(),
      startDate: '2026-01-06', endDate: '2026-04-06',
      period: 90, status: 'in_probation',
      selfAssessment: null, managerNote: '',
    };
    _saveMyRecord(rec);
  }

  const meta = STATUS_META[rec.status] || STATUS_META.in_probation;
  const pct  = _elapsed(rec.startDate, rec.endDate);
  const dLeft = _daysLeft(rec.endDate);

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="pb-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">📋 수습 평가</div>
      <div style="font-size:11px;color:var(--text-muted)">${rec.period}일 수습 · ${rec.startDate} ~ ${rec.endDate}</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:99px;
                 background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['status','현황'],['assessment','자기평가']].map(([k,l])=>`
    <button class="pb-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='status' ? _renderStatus(rec, meta, pct, dLeft) : _renderAssessment(rec)}
  </div>
</div>`;

  _root.querySelector('#pb-back').addEventListener('click', ()=>window.navBack());
  _root.querySelectorAll('.pb-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(); }));
  if (_tab === 'assessment') _bindAssessment(rec);
}

function _renderStatus(rec, meta, pct, dLeft) {
  return `
<div style="background:${meta.bg};border:2px solid ${meta.color};border-radius:16px;
     padding:20px;text-align:center;margin-bottom:14px">
  <div style="font-size:36px;font-weight:900;color:${meta.color};margin-bottom:4px">${meta.label}</div>
  <div style="font-size:12px;color:${meta.color};opacity:0.8">${rec.period}일 수습 기간</div>
</div>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
  <div style="display:flex;justify-content:space-between;margin-bottom:8px">
    <span style="font-size:12px;font-weight:700">수습 기간 진행률</span>
    <span style="font-size:12px;color:#4F46E5;font-weight:700">${pct}%</span>
  </div>
  <div style="background:#E2E8F0;border-radius:99px;height:10px;margin-bottom:8px">
    <div style="background:#4F46E5;height:10px;border-radius:99px;width:${pct}%;transition:width 0.5s"></div>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted)">
    <span>${rec.startDate}</span>
    <span style="font-weight:700;color:${dLeft<14?'#EF4444':'var(--text-muted)'}">
      ${dLeft>0?`D-${dLeft}`:`D+${Math.abs(dLeft)}`}
    </span>
    <span>${rec.endDate}</span>
  </div>
</div>

${rec.selfAssessment ? `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
  <div style="font-size:13px;font-weight:700;margin-bottom:8px">✅ 자기평가 제출 완료</div>
  <div style="font-size:24px;font-weight:900;color:#4F46E5;text-align:center;padding:8px 0">
    ${rec.selfAssessment.avgScore.toFixed(1)} <span style="font-size:14px;color:var(--text-muted)">/ 5.0</span>
  </div>
  <div style="font-size:11px;color:var(--text-muted);text-align:center">${rec.selfAssessment.submitted} 제출</div>
</div>` : ''}

${rec.managerNote ? `
<div style="background:#F8FAFC;border:1px solid var(--border);border-radius:12px;padding:12px">
  <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:4px">관리자 피드백</div>
  <div style="font-size:13px;color:var(--text)">${rec.managerNote}</div>
</div>` : ''}`;
}

function _renderAssessment(rec) {
  if (rec.selfAssessment) {
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="font-size:13px;font-weight:700;margin-bottom:14px">📊 자기평가 결과</div>
  ${QUESTIONS.map((q,i)=>{
    const s = rec.selfAssessment.answers[i]||0;
    return `
  <div style="margin-bottom:12px">
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">${i+1}. ${q}</div>
    <div style="display:flex;gap:4px">
      ${[1,2,3,4,5].map(v=>`
      <span style="font-size:20px">${v<=s?'⭐':'☆'}</span>`).join('')}
      <span style="font-size:12px;font-weight:700;color:#4F46E5;margin-left:6px;align-self:center">${s}점</span>
    </div>
  </div>`;}).join('')}
  <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);
       display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:12px;color:var(--text-muted)">평균 점수</span>
    <span style="font-size:20px;font-weight:900;color:#4F46E5">${rec.selfAssessment.avgScore.toFixed(1)}</span>
  </div>
</div>`;
  }
  if (rec.status !== 'in_probation') {
    return `<div style="text-align:center;padding:40px;color:var(--text-muted)">
      <div style="font-size:32px;margin-bottom:8px">🔒</div>
      <div style="font-size:13px">자기평가 제출 기간이 종료됐습니다.</div>
    </div>`;
  }
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="font-size:13px;font-weight:700;margin-bottom:14px">📝 자기평가 작성</div>
  ${QUESTIONS.map((q,i)=>`
  <div style="margin-bottom:14px" data-qi="${i}">
    <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:6px">${i+1}. ${q}</div>
    <div style="display:flex;gap:6px">
      ${[1,2,3,4,5].map(v=>`
      <button class="pb-star" data-qi="${i}" data-val="${v}"
        style="font-size:22px;background:none;border:none;cursor:pointer;line-height:1;padding:2px">☆</button>`).join('')}
    </div>
  </div>`).join('')}
  <div style="margin-bottom:16px">
    <label style="font-size:11px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px">종합 의견 (선택)</label>
    <textarea maxlength="500" id="pb-opinion" rows="3" placeholder="수습 기간 동안의 느낀 점, 개선 의지 등을 작성해 주세요."
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text);resize:vertical;box-sizing:border-box"></textarea>
  </div>
  <button id="pb-submit-sa"
    style="width:100%;padding:13px;background:#4F46E5;color:#fff;border:none;border-radius:12px;
           font-size:14px;font-weight:700;cursor:pointer">자기평가 제출</button>
</div>`;
}

function _bindAssessment(rec) {
  if (rec.selfAssessment || rec.status !== 'in_probation') return;
  _root.querySelectorAll('.pb-star').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const qi  = parseInt(btn.dataset.qi);
      const val = parseInt(btn.dataset.val);
      _scores[qi] = val;
      // Update stars visual
      _root.querySelectorAll(`.pb-star[data-qi="${qi}"]`).forEach(s=>{
        s.textContent = parseInt(s.dataset.val) <= val ? '⭐' : '☆';
      });
    });
  });
  _root.querySelector('#pb-submit-sa')?.addEventListener('click',()=>{
    if (_scores.some(s=>s===0)) { showToast('모든 항목을 평가해 주세요.', 'error'); return; }
    const avg = +(_scores.reduce((a,b)=>a+b,0)/5).toFixed(1);
    const updated = _getMyRecord();
    updated.selfAssessment = {
      answers: [..._scores],
      submitted: new Date().toISOString().slice(0,10),
      avgScore: avg,
    };
    _saveMyRecord(updated);
    showToast('자기평가가 제출됐습니다.', 'success')
    addNotification({ type: 'success', title: '수습 평가', body: '자기평가가 제출됐습니다.' });
    _tab = 'status';
    _render();
  });
}
