/**
 * self-assessment.js — 자기평가 (직원)
 * 역량 자기평가 + 성과 요약 + 성장 계획
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_self_assessments';

const COMPETENCIES = [
  { key:'expertise',     label:'업무 전문성',   desc:'담당 직무에 필요한 전문 지식과 기술 보유 수준' },
  { key:'goal',          label:'목표 달성',     desc:'설정한 목표를 기한 내 달성하는 능력' },
  { key:'collaboration', label:'협업·팀워크',   desc:'팀원과 협력하여 공동 목표를 달성하는 능력' },
  { key:'communication', label:'커뮤니케이션',  desc:'명확하고 효과적으로 정보를 전달·공유하는 능력' },
  { key:'initiative',    label:'주도성·혁신',   desc:'업무를 스스로 개선하고 새로운 방법을 도입하는 능력' },
  { key:'growth',        label:'성장·학습',     desc:'새로운 지식을 습득하고 역량을 지속적으로 향상시키는 능력' },
];

const SCORE_LABELS = ['', '매우 부족', '부족', '보통', '우수', '탁월'];
const SCORE_COLORS = ['','#EF4444','#F59E0B','var(--text-muted)','#3B82F6','#10B981'];

const HALF = new Date().getMonth() < 6 ? '상반기' : '하반기';
const CYCLE_NAME = `${new Date().getFullYear()}년 ${HALF} 자기평가`;
const DEADLINE = new Date().getMonth() < 6 ? `${new Date().getFullYear()}-06-30` : `${new Date().getFullYear()}-12-31`;

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }
function _dept()    { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').department||'소속 미지정'; } catch { return '소속 미지정'; } }

function _getAll() { try { return JSON.parse(localStorage.getItem(LS)||'[]'); } catch { return []; } }
function _save(l)  { localStorage.setItem(LS, JSON.stringify(l)); }
function _myCurrent() { return _getAll().find(a => a.empId===_empId() && a.cycle===CYCLE_NAME); }

let _tab = 'form';
let _scores = {};
let _draft  = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'form';
  const existing = _myCurrent();
  if (existing) { _scores = {...(existing.scores||{})}; _draft = existing; _tab = existing.submitted ? 'done' : 'form'; }
  else _scores = {};
  _render(root);
}
export function unmount() { _tab='form'; _scores={}; _draft=null; }

function _render(root) {
  const submitted = _myCurrent()?.submitted;
  const history   = _getAll().filter(a=>a.empId===_empId()).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div class="top-bar" style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="sa-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">📝 자기평가</div>
      <div style="font-size:11px;color:var(--text-muted)">${CYCLE_NAME} · 마감 ${DEADLINE}</div>
    </div>
    ${submitted ? `<span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:8px;background:#D1FAE5;color:#10B981">제출 완료</span>` : ''}
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['form', submitted?'평가 보기':'평가 작성'],['history','이전 평가']].map(([k,l])=>`
    <button class="sa-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='form' ? _renderForm(submitted) : _renderHistory(history)}
  </div>
</div>`;

  root.querySelector('#sa-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.sa-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(root); }));

  if (_tab==='form' && !submitted) {
    // 별점 바인딩
    root.querySelectorAll('.sa-star-row').forEach(row=>{
      const comp = row.dataset.comp;
      row.querySelectorAll('.sa-star').forEach(star=>{
        star.addEventListener('click',()=>{
          _scores[comp] = parseInt(star.dataset.val);
          _renderStars(root, comp, _scores[comp]);
          _updateAvg(root);
        });
      });
    });

    root.querySelector('#sa-save-draft')?.addEventListener('click',()=>_saveDraft(root, false));
    root.querySelector('#sa-submit')?.addEventListener('click',()=>_saveDraft(root, true));
  }
}

function _renderStars(root, comp, val) {
  const row = root.querySelector(`.sa-star-row[data-comp="${comp}"]`);
  if (!row) return;
  row.querySelectorAll('.sa-star').forEach(s=>{
    const v = parseInt(s.dataset.val);
    s.textContent = v<=val ? '★' : '☆';
    s.style.color  = v<=val ? '#F59E0B' : '#CBD5E1';
  });
  const lbl = row.querySelector('.sa-score-label');
  if (lbl) { lbl.textContent = SCORE_LABELS[val]||''; lbl.style.color = SCORE_COLORS[val]||'var(--text-muted)'; }
}

function _updateAvg(root) {
  const vals = Object.values(_scores).filter(Boolean);
  const avg  = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : '-';
  const el   = root.querySelector('#sa-avg');
  if (el) el.textContent = avg;
}

function _saveDraft(root, submit) {
  const achievements = root.querySelector('#sa-achieve').value.trim();
  const challenges   = root.querySelector('#sa-challenge').value.trim();
  const goals        = root.querySelector('#sa-goals').value.trim();
  const support      = root.querySelector('#sa-support').value.trim();

  if (submit) {
    const missing = COMPETENCIES.filter(c=>!_scores[c.key]);
    if (missing.length) { showToast(`"${missing[0].label}" 점수를 선택하세요.`, 'error'); return; }
    if (!achievements) { showToast('주요 성과를 입력하세요.', 'error'); return; }
    if (!goals)        { showToast('성장 계획을 입력하세요.', 'error'); return; }
  }

  const list = _getAll().filter(a=>!(a.empId===_empId()&&a.cycle===CYCLE_NAME));
  const entry = {
    id: _draft?.id || 'SA_'+Date.now(),
    empId: _empId(), empName: _empName(), dept: _dept(),
    cycle: CYCLE_NAME,
    scores: {..._scores},
    achievements, challenges, goals, support,
    submitted: submit,
    createdAt: _draft?.createdAt || new Date().toISOString(),
    submittedAt: submit ? new Date().toISOString() : null,
  };
  list.push(entry);
  _save(list);
  _draft = entry;

  if (submit) {
    showToast('자기평가가 제출되었습니다.', 'success');
    addNotification({ type: 'system', title: `${CYCLE_NAME} 자기평가 제출 완료`, body: '' });
    _tab = 'form';
    _render(root);
  } else {
    showToast('임시 저장되었습니다.', 'info');
  }
}

function _renderForm(readonly) {
  const existing = _myCurrent();
  const scores   = existing?.scores || _scores;
  const avgVal   = Object.values(scores).filter(Boolean);
  const avg      = avgVal.length ? (avgVal.reduce((a,b)=>a+b,0)/avgVal.length).toFixed(1) : '-';

  return `
<!-- 종합 점수 카드 -->
<div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);border-radius:14px;
     padding:16px;margin-bottom:14px;color:#fff;display:flex;align-items:center;gap:14px">
  <div style="text-align:center;flex-shrink:0">
    <div style="font-size:36px;font-weight:900" id="sa-avg">${avg}</div>
    <div style="font-size:10px;opacity:0.75;margin-top:2px">종합 평균</div>
  </div>
  <div style="flex:1">
    <div style="font-size:13px;font-weight:700;margin-bottom:4px">${_empName()} · ${_dept()}</div>
    <div style="font-size:11px;opacity:0.8">${CYCLE_NAME}</div>
    <div style="font-size:10px;opacity:0.65;margin-top:2px">6개 역량 자기평가</div>
  </div>
</div>

<!-- 역량별 평가 -->
${COMPETENCIES.map(c=>{
  const sv = scores[c.key]||0;
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:2px">${c.label}</div>
  <div style="font-size:10px;color:var(--text-muted);margin-bottom:8px">${c.desc}</div>
  <div class="sa-star-row" data-comp="${c.key}" style="display:flex;align-items:center;gap:4px">
    ${[1,2,3,4,5].map(v=>`
    <button class="sa-star" data-val="${v}"
      style="font-size:26px;background:none;border:none;cursor:${readonly?'default':'pointer'};
             padding:0;line-height:1;color:${sv>=v?'#F59E0B':'#CBD5E1'};
             pointer-events:${readonly?'none':'auto'}">${sv>=v?'★':'☆'}</button>`).join('')}
    <span class="sa-score-label" style="font-size:11px;font-weight:600;margin-left:6px;color:${SCORE_COLORS[sv]||'var(--text-muted)'}">${sv?SCORE_LABELS[sv]:readonly?'미평가':'선택하세요'}</span>
  </div>
</div>`;
}).join('')}

<!-- 서술형 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:12px">서술형 평가</div>

  ${[
    {id:'sa-achieve',  label:'✅ 주요 성과 (필수)',  ph:'이번 평가 기간의 핵심 성과와 기여를 구체적으로 작성하세요.',    val:existing?.achievements||''},
    {id:'sa-challenge',label:'🔧 개선이 필요한 점',  ph:'업무에서 어려웠던 점, 개선하고 싶은 역량을 솔직하게 작성하세요.', val:existing?.challenges||''},
    {id:'sa-goals',    label:'🎯 성장 계획 (필수)',  ph:'다음 기간 집중할 역량 개발 목표와 실행 방안을 작성하세요.',     val:existing?.goals||''},
    {id:'sa-support',  label:'💬 조직에 바라는 점', ph:'업무 환경, 지원, 교육 등 필요한 사항을 자유롭게 작성하세요.',    val:existing?.support||''},
  ].map(f=>`
  <div style="margin-bottom:12px">
    <label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px">${f.label}</label>
    <textarea maxlength="500" id="${f.id}" rows="3" placeholder="${f.ph}" ${readonly?'readonly':''}
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:12px;background:${readonly?'var(--bg)':'var(--bg)'};color:var(--text);
             box-sizing:border-box;resize:vertical;line-height:1.6;
             opacity:${readonly?0.8:1}">${f.val}</textarea>
  </div>`).join('')}
</div>

${!readonly ? `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
  <button id="sa-save-draft"
    style="padding:12px;background:var(--card-bg);color:#4F46E5;border:1.5px solid #4F46E5;
           border-radius:12px;font-size:13px;font-weight:700;cursor:pointer">임시 저장</button>
  <button id="sa-submit"
    style="padding:12px;background:#4F46E5;color:#fff;border:none;
           border-radius:12px;font-size:13px;font-weight:700;cursor:pointer">최종 제출</button>
</div>
<div style="font-size:10px;color:var(--text-muted);text-align:center;margin-top:6px">제출 후에는 수정이 불가합니다</div>
` : `<div style="text-align:center;padding:12px;background:#D1FAE5;border-radius:10px;font-size:12px;font-weight:700;color:#10B981">✓ ${existing?.submittedAt?.slice(0,10)} 제출 완료</div>`}`;
}

function _renderHistory(history) {
  const past = history.filter(a=>a.cycle!==CYCLE_NAME && a.submitted);
  if (!past.length) return `
<div style="text-align:center;padding:40px 20px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">📂</div>
  <div style="font-size:13px">이전 평가 기록이 없습니다.</div>
      <button onclick="location.hash='#/self-assessment'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">자기 평가 작성</button>
    
</div>`;

  return past.map(a=>{
    const vals = Object.values(a.scores||{}).filter(Boolean);
    const avg  = vals.length ? (vals.reduce((x,y)=>x+y,0)/vals.length).toFixed(1) : '-';
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <div style="font-size:13px;font-weight:700;color:var(--text)">${a.cycle}</div>
    <div style="font-size:18px;font-weight:900;color:#F59E0B">${avg}</div>
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:6px">
    ${COMPETENCIES.map(c=>{
      const sv = a.scores?.[c.key]||0;
      return sv?`<span style="font-size:10px;padding:2px 8px;border-radius:8px;background:${SCORE_COLORS[sv]}22;color:${SCORE_COLORS[sv]};font-weight:600">${c.label} ${sv}</span>`:'';
    }).filter(Boolean).join('')}
  </div>
  ${a.achievements?`<div style="font-size:11px;color:var(--text-muted);margin-top:8px;line-height:1.5;border-top:1px solid var(--border);padding-top:8px">${a.achievements}</div>`:''}
</div>`;
  }).join('');
}
