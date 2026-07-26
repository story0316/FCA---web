/**
 * offboarding.js — 퇴직 체크리스트 (직원)
 * 인수인계·반납·행정 완료 추적
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS_PROGRESS = 'hr_offboarding_progress';
const LS_HANDOVER = 'hr_offboarding_handovers';

const CHECKLIST = [
  // 인수인계
  { id:'OB01', phase:'인수인계', label:'업무 인수인계 문서 작성',    dueDay:-14, required:true,  icon:'📄' },
  { id:'OB02', phase:'인수인계', label:'후임자 교육 완료',            dueDay:-7,  required:true,  icon:'🎓' },
  { id:'OB03', phase:'인수인계', label:'진행 중 프로젝트 현황 공유',  dueDay:-7,  required:true,  icon:'📊' },
  { id:'OB04', phase:'인수인계', label:'거래처·파트너 연락처 정리',   dueDay:-5,  required:false, icon:'📇' },
  // 반납
  { id:'OB05', phase:'반납',     label:'노트북·업무 장비 반납',       dueDay:-1,  required:true,  icon:'💻' },
  { id:'OB06', phase:'반납',     label:'사원증·출입 카드 반납',       dueDay:-1,  required:true,  icon:'🪪' },
  { id:'OB07', phase:'반납',     label:'도서·자료 반납',              dueDay:-3,  required:false, icon:'📚' },
  { id:'OB08', phase:'반납',     label:'회사 차량 반납 (해당 시)',    dueDay:-1,  required:false, icon:'🚗' },
  // 계정·접근권한
  { id:'OB09', phase:'계정',     label:'업무 파일·폴더 정리 및 이관', dueDay:-3,  required:true,  icon:'🗂️' },
  { id:'OB10', phase:'계정',     label:'개인 데이터 삭제 확인',       dueDay:-1,  required:true,  icon:'🗑️' },
  // 행정·복리후생
  { id:'OB11', phase:'행정',     label:'퇴직금 계좌 등록',           dueDay:-5,  required:true,  icon:'💰' },
  { id:'OB12', phase:'행정',     label:'건강보험 상실 신고 확인',     dueDay:0,   required:true,  icon:'🏥' },
  { id:'OB13', phase:'행정',     label:'고용보험 이직확인서 수령',    dueDay:0,   required:true,  icon:'📋' },
  { id:'OB14', phase:'행정',     label:'퇴직 소득세 원천징수영수증',  dueDay:14,  required:false, icon:'📑' },
  // 마무리
  { id:'OB15', phase:'마무리',   label:'퇴직 면담 (Exit Interview)',  dueDay:-3,  required:true,  icon:'💬' },
  { id:'OB16', phase:'마무리',   label:'팀원 작별 인사',              dueDay:0,   required:false, icon:'👋' },
];

const PHASE_COLOR = {
  '인수인계':'#4F46E5', '반납':'#F59E0B', '계정':'#EF4444', '행정':'#10B981', '마무리':'#8B5CF6',
};

const RESIGN_DATE = '2026-07-31'; // 퇴직 예정일 (데모)

function _empId() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').userId||'EMP001'; } catch { return 'EMP001'; } }

function _daysUntil() {
  return Math.round((new Date(RESIGN_DATE) - Date.now()) / (1000*60*60*24));
}

function _getProgress() {
  try {
    const all = JSON.parse(localStorage.getItem(LS_PROGRESS)||'{}');
    return all[_empId()] || {};
  } catch { return {}; }
}
function _saveProgress(prog) {
  try {
    const all = JSON.parse(localStorage.getItem(LS_PROGRESS)||'{}');
    all[_empId()] = prog;
    localStorage.setItem(LS_PROGRESS, JSON.stringify(all));
  } catch {}
}
function _getHandovers() { try { return JSON.parse(localStorage.getItem(LS_HANDOVER)||'[]').filter(h=>h.empId===_empId()); } catch { return []; } }
function _saveHandovers(l) {
  try {
    const all = JSON.parse(localStorage.getItem(LS_HANDOVER)||'[]').filter(h=>h.empId!==_empId());
    localStorage.setItem(LS_HANDOVER, JSON.stringify([...all, ...l]));
  } catch {}
}

let _tab = 'checklist';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _tab='checklist'; _render(root); }
export function unmount() { _tab='checklist'; }

function _render(root) {
  const prog = _getProgress();
  const done = CHECKLIST.filter(t=>prog[t.id]?.done).length;
  const req  = CHECKLIST.filter(t=>t.required);
  const reqDone = req.filter(t=>prog[t.id]?.done).length;
  const pct  = Math.round((done/CHECKLIST.length)*100);
  const daysLeft = _daysUntil();

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div class="top-bar" style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="off-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">👋 퇴직 체크리스트</div>
      <div style="font-size:11px;color:var(--text-muted)">퇴직 예정일 ${RESIGN_DATE} · ${daysLeft>=0?`D-${daysLeft}`:'퇴직일 경과'}</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['checklist','체크리스트'],['handover','인수인계 메모']].map(([k,l])=>`
    <button class="off-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='checklist' ? _renderChecklist(prog, done, reqDone, req.length, pct, daysLeft) : _renderHandover()}
  </div>
</div>`;

  root.querySelector('#off-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.off-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(root); }));

  if (_tab==='checklist') {
    root.querySelectorAll('.off-check').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const prog2 = _getProgress();
        const was   = prog2[btn.dataset.id]?.done;
        prog2[btn.dataset.id] = { done:!was, doneAt:!was?new Date().toISOString():null };
        _saveProgress(prog2);
        if (!was) {
          const task = CHECKLIST.find(t=>t.id===btn.dataset.id);
          showToast(`"${task?.label}" 완료!`, 'success')
    addNotification({ type: 'success', title: '오프보딩', body: '"" 완료!' });
          const p2 = _getProgress();
          if (CHECKLIST.every(t=>p2[t.id]?.done)) addNotification({ type: 'success', title: '오프보딩 완료', body: '퇴직 체크리스트를 모두 완료했습니다!' });
        }
        _render(root);
      });
    });
  }

  if (_tab==='handover') {
    root.querySelector('#off-ho-add')?.addEventListener('click',()=>{
      const title   = root.querySelector('#off-ho-title').value.trim();
      const content = root.querySelector('#off-ho-content').value.trim();
      const to      = root.querySelector('#off-ho-to').value.trim();
      if (!title)   { showToast('업무명을 입력하세요.','error'); return; }
      if (!content) { showToast('내용을 입력하세요.','error'); return; }
      const list = _getHandovers();
      list.push({ id:'HO_'+Date.now(), empId:_empId(), title, content, to, createdAt:new Date().toISOString() });
      _saveHandovers(list);
      showToast('인수인계 메모가 저장되었습니다.','success');
      root.querySelector('#off-ho-title').value = '';
      root.querySelector('#off-ho-content').value = '';
      root.querySelector('#off-ho-to').value = '';
      _render(root);
    });

    root.querySelectorAll('.off-ho-del').forEach(btn=>{
      btn.addEventListener('click',()=>{
        if (!confirm('인수인계 항목을 삭제하시겠습니까?')) return;
        _saveHandovers(_getHandovers().filter(h=>h.id!==btn.dataset.id));
        showToast('삭제되었습니다.','info');
        _render(root);
      });
    });
  }
}

function _renderChecklist(prog, done, reqDone, reqTotal, pct, daysLeft) {
  const phases = [...new Set(CHECKLIST.map(t=>t.phase))];

  return `
<!-- 진행률 카드 -->
<div style="background:linear-gradient(135deg,${pct===100?'#10B981':'#4F46E5'} 0%,${pct===100?'#059669':'#7C3AED'} 100%);
     border-radius:14px;padding:16px;margin-bottom:14px;color:#fff">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
    <div>
      <div style="font-size:12px;opacity:0.8;margin-bottom:2px">퇴직 준비 현황</div>
      <div style="font-size:30px;font-weight:900">${pct}<span style="font-size:16px">%</span></div>
    </div>
    <div style="font-size:36px">${pct===100?'🎊':'📋'}</div>
  </div>
  <div style="background:rgba(255,255,255,0.25);border-radius:99px;height:6px;margin-bottom:6px">
    <div style="background:var(--card-bg);height:6px;border-radius:99px;width:${pct}%"></div>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:11px;opacity:0.8">
    <span>${done}/${CHECKLIST.length}개 완료</span>
    <span>필수 ${reqDone}/${reqTotal}개</span>
  </div>
</div>

<!-- D-day 카드 -->
${daysLeft>=0 ? `
<div style="background:${daysLeft<=3?'#FEE2E2':daysLeft<=7?'#FEF3C7':'#EEF2FF'};border-radius:12px;padding:12px;margin-bottom:14px;
     display:flex;align-items:center;gap:10px">
  <div style="font-size:28px">${daysLeft<=3?'⚠️':daysLeft<=7?'⏰':'📅'}</div>
  <div>
    <div style="font-size:13px;font-weight:700;color:${daysLeft<=3?'#DC2626':daysLeft<=7?'#D97706':'#4F46E5'}">퇴직까지 D-${daysLeft}일</div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${RESIGN_DATE} · 미완료 ${CHECKLIST.length-done}개 남음</div>
  </div>
</div>` : ''}

<!-- 단계별 체크리스트 -->
${phases.map(phase=>{
  const tasks    = CHECKLIST.filter(t=>t.phase===phase);
  const phaseDone = tasks.filter(t=>prog[t.id]?.done).length;
  const phColor  = PHASE_COLOR[phase]||'var(--text-muted)';
  return `
<div style="margin-bottom:14px">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
    <div style="display:flex;align-items:center;gap:6px">
      <div style="width:10px;height:10px;border-radius:50%;background:${phColor}"></div>
      <span style="font-size:12px;font-weight:700;color:var(--text-muted)">${phase}</span>
    </div>
    <span style="font-size:11px;color:${phColor};font-weight:600">${phaseDone}/${tasks.length}</span>
  </div>
  ${tasks.map(t=>{
    const isDone = prog[t.id]?.done;
    return `
  <div style="background:var(--card-bg);border:1px solid ${isDone?phColor+'44':'var(--border)'};border-radius:10px;
       padding:11px;margin-bottom:5px;display:flex;align-items:center;gap:10px;
       opacity:${isDone?0.65:1}">
    <button class="off-check" data-id="${t.id}"
      style="width:24px;height:24px;border-radius:50%;flex-shrink:0;cursor:pointer;
             border:2px solid ${isDone?phColor:'#CBD5E1'};
             background:${isDone?phColor:'transparent'};
             display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px">
      ${isDone?'✓':''}
    </button>
    <span style="font-size:16px;flex-shrink:0">${t.icon}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:12px;font-weight:${isDone?400:600};color:var(--text);
           text-decoration:${isDone?'line-through':'none'}">${t.label}</div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:1px">
        ${t.required?`<span style="color:#EF4444">필수</span> · `:''}
        퇴직 ${t.dueDay<=0?Math.abs(t.dueDay)+'일 전':t.dueDay+'일 후'}
      </div>
    </div>
    ${isDone&&prog[t.id]?.doneAt?`<div style="font-size:9px;color:#10B981;flex-shrink:0">${prog[t.id].doneAt.slice(0,10)}</div>`:''}
  </div>`;
  }).join('')}
</div>`;
}).join('')}`;
}

function _renderHandover() {
  const items = _getHandovers();
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:12px">📝 인수인계 메모 추가</div>

  <div style="margin-bottom:8px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px;font-weight:600">업무명</label>
    <input id="off-ho-title" type="text" placeholder="예: 월간 리포트 작성"
      style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>
  <div style="margin-bottom:8px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px;font-weight:600">후임자</label>
    <input id="off-ho-to" type="text" placeholder="예: 김철수 주임"
      style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>
  <div style="margin-bottom:10px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px;font-weight:600">상세 내용</label>
    <textarea maxlength="500" id="off-ho-content" rows="4" placeholder="업무 절차, 주의사항, 관련 파일 위치 등을 작성하세요."
      style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;
             font-size:12px;background:var(--bg);color:var(--text);box-sizing:border-box;resize:vertical;line-height:1.6"></textarea>
  </div>
  <button id="off-ho-add" style="width:100%;padding:10px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">메모 저장</button>
</div>

${!items.length ? `<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:12px">저장된 인수인계 메모가 없습니다.</div>` :
items.map(h=>`
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
    <div style="font-size:13px;font-weight:700;color:var(--text)">${h.title}</div>
    <button class="off-ho-del" data-id="${h.id}"
      style="background:#FEE2E2;color:#DC2626;border:none;border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer;flex-shrink:0;margin-left:8px">삭제</button>
  </div>
  ${h.to?`<div style="font-size:11px;color:#4F46E5;font-weight:600;margin-bottom:4px">→ ${h.to}</div>`:''}
  <div style="font-size:11px;color:var(--text-muted);line-height:1.6">${h.content}</div>
  <div style="font-size:10px;color:var(--text-muted);margin-top:4px">${h.createdAt?.slice(0,10)||''}</div>
</div>`).join('')}`;
}
