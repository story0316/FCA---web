/**
 * trainer.js — 사내 강사 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS_TRAINERS = 'hr_trainers';
const LS_APPLIES  = 'hr_trainer_applies';

function _session()  { try { return JSON.parse(localStorage.getItem('hr_session')||'{}'); } catch { return {}; } }
function _empId()    { return _session().empId || _session().userId || 'EMP001'; }
function _empName()  { return _session().name || '직원'; }
function _getDept()  { return _session().dept || _session().department || '일반'; }

const LEGACY_TR_IDS = new Set(['TR001','TR003']);

function _currentUserEntry() {
  const uid = _empId(); const name = _empName(); const dept = _getDept();
  return { id:`TR_${uid}`, empId:uid, empName:name, dept, expertise:'업무 전문성', topics:['직무 역량 강화','팀 노하우 공유'], bio:`${dept} 경력 보유`, status:'active', sessions:0 };
}

function _getTrainers() {
  const s = localStorage.getItem(LS_TRAINERS);
  const uid = _empId();
  if (!s) {
    const init = [_currentUserEntry()];
    localStorage.setItem(LS_TRAINERS, JSON.stringify(init));
    return init;
  }
  try {
    const d = JSON.parse(s);
    const cleaned = d.filter(r => !LEGACY_TR_IDS.has(r.id));
    if (cleaned.length < d.length) localStorage.setItem(LS_TRAINERS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}
function _getApplies()    { try { return JSON.parse(localStorage.getItem(LS_APPLIES)||'[]'); } catch { return []; } }
function _saveApplies(l)  { localStorage.setItem(LS_APPLIES, JSON.stringify(l)); }

let _tab  = 'list';
let _root = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _root=root; _tab='list'; _render(); }
export function unmount() { _tab = 'list'; _root=null; }

function _render() {
  const trainers  = _getTrainers();
  const applies   = _getApplies();
  const isTrainer = trainers.some(t=>t.empId===_empId()&&(t.status==='active'||t.status==='pending'));
  const myApply   = applies.find(a=>a.empId===_empId());

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="tr-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1"><div style="font-size:15px;font-weight:700">👨‍🏫 사내 강사</div><div style="font-size:11px;color:var(--text-muted)">활동 강사 ${trainers.filter(t=>t.status==='active').length}명</div></div>
    ${isTrainer?`<span style="font-size:11px;font-weight:700;background:#10B981;color:#fff;border-radius:99px;padding:3px 10px">강사 등록</span>`:''}
  </div>
  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['list','강사 목록'],['apply','강사 신청']].map(([k,l])=>`
    <button class="tr-tab" data-tab="${k}" style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>
  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='apply' ? _renderApply(isTrainer, myApply) : _renderList(trainers)}
  </div>
</div>`;

  _root.querySelector('#tr-back').addEventListener('click',()=>window.navBack());
  _root.querySelectorAll('.tr-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(); }));
  _bindApply(isTrainer);
}

function _renderList(trainers) {
  const active = trainers.filter(t=>t.status==='active');
  if (!active.length) return `<div style="text-align:center;padding:48px 16px;color:var(--text-muted)"><div style="font-size:40px;margin-bottom:10px">👨‍🏫</div><div style="font-size:14px">등록된 강사가 없습니다.</div>
      <button onclick="location.hash='#/trainer'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">강사 등록</button>
    </div>`;
  return active.map(t=>`
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="margin-bottom:8px">
    <div style="font-size:13px;font-weight:700">${t.empName}</div>
    <div style="font-size:11px;color:#4F46E5;font-weight:600">${t.expertise}</div>
    <div style="font-size:11px;color:var(--text-muted)">${t.dept} · 세션 ${t.sessions}회</div>
  </div>
  <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">${t.bio}</div>
  <div style="display:flex;flex-wrap:wrap;gap:4px">
    ${t.topics.map(tp=>`<span style="font-size:10px;background:#EEF2FF;color:#4F46E5;border-radius:4px;padding:2px 8px">${tp}</span>`).join('')}
  </div>
</div>`).join('');
}

function _renderApply(isTrainer, myApply) {
  if (isTrainer) return `<div style="text-align:center;padding:40px;color:#10B981"><div style="font-size:40px;margin-bottom:10px">✅</div><div style="font-size:14px;font-weight:700">이미 강사로 등록되어 있습니다</div></div>`;
  if (myApply) return `<div style="text-align:center;padding:40px;color:#F59E0B"><div style="font-size:40px;margin-bottom:10px">⏳</div><div style="font-size:14px;font-weight:700">강사 신청이 검토 중입니다</div><div style="font-size:11px;color:var(--text-muted);margin-top:6px">승인까지 영업일 기준 3일이 소요됩니다</div></div>`;
  return `
<div style="background:#EEF2FF;border-radius:12px;padding:12px;margin-bottom:14px;font-size:11px;color:#4338CA">
  사내 강사로 등록하면 동료에게 지식을 나누고 강의 수당을 받을 수 있습니다.
</div>
<div style="display:flex;flex-direction:column;gap:10px">
  <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">전문 분야 *</div>
    <input id="tr-exp" type="text" placeholder="예: JavaScript·React 개발" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
  <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">강의 가능 주제 (쉼표 구분) *</div>
    <input id="tr-topics" type="text" placeholder="예: React 기초, 상태관리, 성능 최적화" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;box-sizing:border-box"></div>
  <div><div style="font-size:11px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">경력 및 자격 소개 *</div>
    <textarea maxlength="500" id="tr-bio" rows="3" placeholder="관련 경력, 자격증, 프로젝트 경험 등" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;resize:none;box-sizing:border-box"></textarea></div>
  <button id="tr-submit" style="padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">강사 신청</button>
</div>`;
}

function _bindApply(isTrainer) {
  _root.querySelector('#tr-submit')?.addEventListener('click',()=>{
    if (isTrainer) return;
    const exp    = _root.querySelector('#tr-exp')?.value.trim();
    const topics = _root.querySelector('#tr-topics')?.value.trim();
    const bio    = _root.querySelector('#tr-bio')?.value.trim();
    if (!exp||!topics||!bio) { showToast('모든 항목을 입력해 주세요.','error'); return; }
    const applies = _getApplies();
    applies.push({ id:'TA_'+Date.now(), empId:_empId(), empName:_empName(), dept:_getDept(), expertise:exp, topics:topics.split(',').map(t=>t.trim()).filter(Boolean), bio, status:'pending', appliedAt:new Date().toISOString().slice(0,10) });
    _saveApplies(applies);
    showToast('강사 신청이 완료됐습니다. 승인 후 목록에 표시됩니다.','success')
    addNotification({ type: 'success', title: '강사 등록', body: '강사 신청이 완료됐습니다. 승인 후 목록에 표시됩니다.' });
    _render();
  });
}
