/**
 * recruitment.js — 채용 관리 (ATS) — 관리자
 */

import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';

const LS_JOBS = 'hr_jobs';
const LS_APPLICANTS = 'hr_applicants';
const LS_APPLICANT_DATA = 'hr_applicant_data';

// ATS stage → 지원자 포털 processStep 매핑
const STAGE_TO_PROCESS = {
  applied:    'DOCUMENT',
  screening:  'DOCUMENT',
  interview1: 'INTERVIEW',
  interview2: 'INTERVIEW',
  offer:      'OFFER',
  rejected:   'DOCUMENT',
};

// ATS stage 변경 시 hr_applicant_data.processStep 동기화
function _syncProcessStep(stage) {
  const processStep = STAGE_TO_PROCESS[stage];
  if (!processStep) return;
  try {
    const appl = JSON.parse(localStorage.getItem(LS_APPLICANT_DATA) || '{}');
    appl.processStep = processStep;
    localStorage.setItem(LS_APPLICANT_DATA, JSON.stringify(appl));
  } catch {}
}

const STAGES = [
  { key: 'applied',    label: '서류 접수',  color: '#64748B', bg: '#F1F5F9' },
  { key: 'screening',  label: '서류 검토',  color: '#3B82F6', bg: '#EFF6FF' },
  { key: 'interview1', label: '1차 면접',   color: '#8B5CF6', bg: '#F5F3FF' },
  { key: 'interview2', label: '2차 면접',   color: '#F59E0B', bg: '#FFFBEB' },
  { key: 'offer',      label: '최종 합격',  color: '#10B981', bg: '#F0FDF4' },
  { key: 'rejected',   label: '불합격',     color: '#EF4444', bg: '#FEF2F2' },
];

const DEMO_JOBS = [
  { id:'JOB001', title:'시니어 백엔드 개발자', dept:'개발팀', type:'정규직', status:'open', postedAt:'2026-05-20', deadline:'2026-06-30', desc:'Python/FastAPI 3년 이상 경력자' },
  { id:'JOB002', title:'HR 담당자', dept:'HR팀', type:'정규직', status:'open', postedAt:'2026-05-25', deadline:'2026-06-20', desc:'채용·노무 경험 2년 이상' },
  { id:'JOB003', title:'마케팅 인턴', dept:'마케팅팀', type:'인턴', status:'closed', postedAt:'2026-04-01', deadline:'2026-05-15', desc:'SNS 마케팅 경험자 우대' },
];

const DEMO_APPLICANTS = [
  { id:'APP001', jobId:'JOB001', name:'홍길동', email:'hong@example.com', phone:'010-1234-5678', stage:'interview1', appliedAt:'2026-05-22', note:'포트폴리오 우수', resumeUrl:'#' },
  { id:'APP002', jobId:'JOB001', name:'김철수', email:'kim@example.com', phone:'010-2345-6789', stage:'screening', appliedAt:'2026-05-23', note:'', resumeUrl:'#' },
  { id:'APP003', jobId:'JOB001', name:'이영희', email:'lee@example.com', phone:'010-3456-7890', stage:'interview2', appliedAt:'2026-05-24', note:'면접 인상 좋음', resumeUrl:'#' },
  { id:'APP004', jobId:'JOB001', name:'박민준', email:'park@example.com', phone:'010-4567-8901', stage:'rejected', appliedAt:'2026-05-21', note:'경력 미달', resumeUrl:'#' },
  { id:'APP005', jobId:'JOB002', name:'최수연', email:'choi@example.com', phone:'010-5678-9012', stage:'applied', appliedAt:'2026-05-26', note:'', resumeUrl:'#' },
  { id:'APP006', jobId:'JOB002', name:'정다은', email:'jung@example.com', phone:'010-6789-0123', stage:'interview1', appliedAt:'2026-05-27', note:'노무사 자격증 보유', resumeUrl:'#' },
];

function _getJobs() {
  const saved = localStorage.getItem(LS_JOBS);
  if (!saved) { localStorage.setItem(LS_JOBS, JSON.stringify(DEMO_JOBS)); return DEMO_JOBS; }
  try { return JSON.parse(saved); } catch { return DEMO_JOBS; }
}

function _saveJobs(list) { localStorage.setItem(LS_JOBS, JSON.stringify(list)); }

function _getApplicants() {
  const saved = localStorage.getItem(LS_APPLICANTS);
  const base = saved ? (() => { try { return JSON.parse(saved); } catch { return DEMO_APPLICANTS; } })() : (() => { localStorage.setItem(LS_APPLICANTS, JSON.stringify(DEMO_APPLICANTS)); return DEMO_APPLICANTS; })();
  // A-2: hr_applicant_form 데이터를 ATS 카드에 병합 (이름 매칭 또는 최신 지원서)
  try {
    const form = JSON.parse(localStorage.getItem('hr_applicant_form') || '{}');
    if (form.name) {
      const idx = base.findIndex(a => a.name === form.name);
      if (idx >= 0) {
        base[idx] = Object.assign({}, base[idx], {
          email:      form.email    || base[idx].email,
          phone:      form.phone    || base[idx].phone,
          jobTitle:   form.jobTitle || base[idx].jobTitle,
          coverLetter: form.coverLetter || base[idx].coverLetter,
        });
      }
    }
  } catch {}
  return base;
}

function _saveApplicants(list) { localStorage.setItem(LS_APPLICANTS, JSON.stringify(list)); }

let _view = 'list';       // 'list' | 'kanban' | 'addJob' | 'addApplicant'
let _selectedJob = null;

export function render(root) { _renderPage(root); }
export function unmount() { _view = 'list'; _selectedJob = null; }

function _renderPage(root) {
  if (_view === 'kanban')       { _renderKanban(root); return; }
  if (_view === 'addJob')       { _renderAddJobForm(root); return; }
  if (_view === 'addApplicant') { _renderAddApplicantForm(root); return; }
  _renderList(root);
}

function _renderList(root) {
  const jobs = _getJobs();
  const applicants = _getApplicants();
  const open = jobs.filter(j => j.status === 'open').length;

  root.innerHTML = `
<div style="padding:16px">

  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
    <div style="font-size:15px;font-weight:700">💼 채용 관리</div>
    <button id="add-job-btn" style="background:#4F46E5;color:#fff;border:none;border-radius:10px;
      padding:7px 12px;font-size:12px;font-weight:600;cursor:pointer">+ 공고 등록</button>
  </div>

  <!-- KPI -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
    ${[
      { label:'진행 중 공고', value: open + '개',          color:'#4F46E5' },
      { label:'전체 지원자', value: applicants.length + '명', color:'#3B82F6' },
      { label:'최종 합격',   value: applicants.filter(a=>a.stage==='offer').length + '명', color:'#10B981' },
    ].map(k=>`
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
         padding:12px;text-align:center">
      <div style="font-size:20px;font-weight:800;color:${k.color}">${k.value}</div>
      <div style="font-size:10px;color:#64748B;margin-top:2px">${k.label}</div>
    </div>`).join('')}
  </div>

  <!-- 공고 목록 -->
  <div style="font-size:12px;font-weight:700;color:#64748B;margin-bottom:8px">채용 공고</div>
  ${!jobs.length ? `<div style="text-align:center;padding:30px;color:#94A3B8;font-size:13px">등록된 공고가 없습니다.</div>` :
    jobs.map(j => {
      const cnt = applicants.filter(a => a.jobId === j.id).length;
      const offerCnt = applicants.filter(a => a.jobId === j.id && a.stage === 'offer').length;
      return `
  <div class="job-row" data-id="${j.id}"
       style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
              padding:12px;margin-bottom:8px;cursor:pointer">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--text)">${j.title}</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">${j.dept} · ${j.type} · 마감 ${j.deadline}</div>
      </div>
      <span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:10px;flex-shrink:0;margin-left:8px;
        color:${j.status==='open'?'#10B981':'#94A3B8'};background:${j.status==='open'?'#D1FAE5':'#F1F5F9'}">
        ${j.status==='open'?'진행 중':'마감'}
      </span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:11px;color:#94A3B8">${j.desc}</div>
      <div style="font-size:12px;font-weight:700;color:#4F46E5">지원자 ${cnt}명${offerCnt?` · <span style="color:#10B981">합격 ${offerCnt}</span>`:''}
      </div>
    </div>
  </div>`;
    }).join('')}

</div>`;

  root.querySelector('#add-job-btn').addEventListener('click', () => { _view = 'addJob'; _renderPage(root); });
  root.querySelectorAll('.job-row').forEach(row => {
    row.addEventListener('click', () => {
      _selectedJob = _getJobs().find(j => j.id === row.dataset.id) || null;
      _view = 'kanban';
      _renderPage(root);
    });
  });
}

function _renderKanban(root) {
  if (!_selectedJob) { _view = 'list'; _renderPage(root); return; }
  const j = _selectedJob;
  const applicants = _getApplicants().filter(a => a.jobId === j.id);

  root.innerHTML = `
<div style="padding:16px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
    <button id="back-btn" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text)">←</button>
    <div>
      <div style="font-size:14px;font-weight:700;color:var(--text)">${j.title}</div>
      <div style="font-size:11px;color:#64748B">${j.dept} · 지원자 ${applicants.length}명</div>
    </div>
    <button id="add-applicant-btn" style="margin-left:auto;background:#4F46E5;color:#fff;border:none;
      border-radius:10px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer">+ 지원자 추가</button>
  </div>

  <!-- 파이프라인 카드 -->
  ${STAGES.filter(s => s.key !== 'rejected').map(stage => {
    const list = applicants.filter(a => a.stage === stage.key);
    return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:12px;margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:10px;
          color:${stage.color};background:${stage.bg}">${stage.label}</span>
        <span style="font-size:12px;font-weight:700;color:#64748B">${list.length}명</span>
      </div>
    </div>
    ${!list.length ? `<div style="font-size:12px;color:#CBD5E1;text-align:center;padding:8px 0">지원자 없음</div>` :
      list.map(a => {
        // C-2: 레퍼런스 체크 완료 배지
        const refs = (() => { try { return JSON.parse(localStorage.getItem('hr_ref_requests') || '[]'); } catch { return []; } })();
        const ref  = refs.find(r => r.applicantId === a.id || r.applicantName === a.name);
        const refDone = ref?.referees?.length > 0 && ref.referees.every(r => r.status === 'completed');
        const refBadge = ref
          ? (refDone
            ? `<span style="font-size:9px;padding:2px 6px;background:#D1FAE5;color:#065F46;border-radius:9999px;font-weight:600">✅ 레퍼런스 완료</span>`
            : `<span style="font-size:9px;padding:2px 6px;background:#FEF3C7;color:#92400E;border-radius:9999px;font-weight:600">⏳ 레퍼런스 진행 중</span>`)
          : '';
        return `
    <div style="background:var(--bg);border-radius:10px;padding:10px;margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="font-size:13px;font-weight:600;color:var(--text)">${a.name}</span>
            ${refBadge}
          </div>
          <div style="font-size:11px;color:var(--text-muted)">${a.email} · ${a.phone || ''} · ${a.appliedAt}</div>
          ${a.jobTitle ? `<div style="font-size:10px;color:#8B5CF6;margin-top:1px">💼 ${a.jobTitle}</div>` : ''}
          ${a.note ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">💬 ${a.note}</div>` : ''}
          ${a.coverLetter ? `<div style="font-size:10px;color:#64748B;margin-top:2px;background:var(--card-bg);border-radius:6px;padding:4px 6px;max-height:40px;overflow:hidden">"${a.coverLetter.slice(0,80)}${a.coverLetter.length>80?'…':''}"</div>` : ''}
        </div>
      </div>
      ${a.interviewers?.length ? `<div style="font-size:10px;color:#8B5CF6;margin-bottom:4px">🎤 면접관: ${a.interviewers.join(', ')}</div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <select class="stage-sel" data-id="${a.id}"
          style="flex:1;padding:5px 8px;border:1.5px solid var(--border);border-radius:8px;
                 font-size:11px;background:var(--bg);color:var(--text);cursor:pointer">
          ${STAGES.map(s=>`<option value="${s.key}" ${a.stage===s.key?'selected':''}>${s.label}</option>`).join('')}
        </select>
        ${(a.stage === 'interview1' || a.stage === 'interview2') ? `
        <button class="assign-btn" data-id="${a.id}"
          style="padding:5px 10px;border:1.5px solid #8B5CF6;border-radius:8px;
                 font-size:11px;background:var(--bg);color:#8B5CF6;cursor:pointer">🎤 면접관</button>` : ''}
        <button class="note-btn" data-id="${a.id}" data-note="${encodeURIComponent(a.note||'')}"
          style="padding:5px 10px;border:1.5px solid var(--border);border-radius:8px;
                 font-size:11px;background:var(--bg);color:#64748B;cursor:pointer">📝 메모</button>
      </div>
    </div>`;
      }).join('')}
  </div>`;
  }).join('')}

  <!-- 불합격 -->
  ${(() => {
    const rejected = applicants.filter(a => a.stage === 'rejected');
    if (!rejected.length) return '';
    return `
  <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:12px;margin-bottom:10px">
    <div style="font-size:12px;font-weight:700;color:#EF4444;margin-bottom:8px">❌ 불합격 (${rejected.length}명)</div>
    ${rejected.map(a=>`
    <div style="display:flex;justify-content:space-between;align-items:center;
         padding:6px 0;border-bottom:1px solid #FECACA">
      <div>
        <div style="font-size:12px;font-weight:600;color:#64748B">${a.name}</div>
        <div style="font-size:11px;color:#94A3B8">${a.note||'메모 없음'}</div>
      </div>
      <select class="stage-sel" data-id="${a.id}"
        style="padding:4px 6px;border:1px solid #FECACA;border-radius:7px;
               font-size:11px;background:#fff;color:#64748B;cursor:pointer">
        ${STAGES.map(s=>`<option value="${s.key}" ${a.stage===s.key?'selected':''}>${s.label}</option>`).join('')}
      </select>
    </div>`).join('')}
  </div>`;
  })()}

</div>`;

  root.querySelector('#back-btn').addEventListener('click', () => { _view = 'list'; _renderPage(root); });
  root.querySelector('#add-applicant-btn').addEventListener('click', () => { _view = 'addApplicant'; _renderPage(root); });

  root.querySelectorAll('.stage-sel').forEach(sel => {
    sel.addEventListener('change', () => {
      const list = _getApplicants();
      const idx = list.findIndex(a => a.id === sel.dataset.id);
      if (idx >= 0) {
        list[idx].stage = sel.value;
        _saveApplicants(list);
        _syncProcessStep(sel.value);
        if (sel.value === 'offer') {
          addNotification({ type: 'system', title: `${list[idx].name}님이 최종 합격 처리되었습니다.`, body: '' });
        }
        showToast('단계가 변경되었습니다.', 'success');
      } else {
        showToast('지원자를 찾을 수 없습니다.', 'error');
      }
      _renderPage(root);
    });
  });

  root.querySelectorAll('.note-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prev = decodeURIComponent(btn.dataset.note);
      const note = prompt('메모를 입력하세요:', prev);
      if (note === null) return;
      const list = _getApplicants();
      const idx = list.findIndex(a => a.id === btn.dataset.id);
      if (idx >= 0) { list[idx].note = note; _saveApplicants(list); }
      showToast('메모가 저장되었습니다.', 'success');
      _renderPage(root);
    });
  });

  root.querySelectorAll('.assign-btn').forEach(btn => {
    btn.addEventListener('click', () => _showInterviewerModal(root, btn.dataset.id));
  });
}

async function _showInterviewerModal(root, applicantId) {
  const empList = await loadDisplayEmployees().catch(() => []);
  if (!empList.length) {
    showToast('면접관으로 지정할 직원 데이터를 불러오지 못했습니다.', 'warning');
    return;
  }
  const employees = empList.map(
    e => `${e.name} (${e.dept || e.department || '부서 미지정'})`,
  );

  const applicants = _getApplicants();
  const appl = applicants.find(a => a.id === applicantId);
  const current = appl?.interviewers || [];

  // 모달 오버레이
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9000;display:flex;align-items:flex-end;justify-content:center';
  overlay.innerHTML = `
<div style="background:var(--card-bg);border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:480px;max-height:70vh;overflow-y:auto">
  <div style="font-size:15px;font-weight:700;margin-bottom:4px;color:var(--text)">🎤 면접관 지정</div>
  <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px">${appl?.name} · 복수 선택 가능</div>
  <div id="emp-list" style="display:flex;flex-direction:column;gap:8px">
    ${employees.map((e, i) => `
    <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;
      border:1.5px solid ${current.includes(e)?'#8B5CF6':'var(--border)'};
      border-radius:10px;cursor:pointer;background:${current.includes(e)?'#F5F3FF':'var(--bg)'}">
      <input type="checkbox" data-emp="${encodeURIComponent(e)}" ${current.includes(e)?'checked':''} style="width:16px;height:16px;accent-color:#8B5CF6">
      <span style="font-size:13px;color:var(--text)">${e}</span>
    </label>`).join('')}
  </div>
  <div style="display:flex;gap:8px;margin-top:16px">
    <button id="assign-save" style="flex:1;background:#8B5CF6;color:#fff;border:none;border-radius:10px;padding:12px;font-size:14px;font-weight:700;cursor:pointer">저장</button>
    <button id="assign-cancel" style="flex:1;background:var(--bg);border:1.5px solid var(--border);border-radius:10px;padding:12px;font-size:14px;color:var(--text);cursor:pointer">취소</button>
  </div>
</div>`;

  document.body.appendChild(overlay);

  overlay.querySelector('#assign-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#assign-save').addEventListener('click', () => {
    const checked = [...overlay.querySelectorAll('input[type=checkbox]:checked')]
      .map(cb => decodeURIComponent(cb.dataset.emp));

    const list = _getApplicants();
    const idx = list.findIndex(a => a.id === applicantId);
    if (idx >= 0) {
      list[idx].interviewers = checked;
      _saveApplicants(list);

      // D-1: 면접관에게 알림
      if (checked.length) {
        const notifs = JSON.parse(localStorage.getItem('hr_notifications') || '[]');
        checked.forEach(emp => {
          notifs.unshift({
            id:        'NOTIF_INTERVIEW_' + Date.now() + '_' + Math.random().toString(36).slice(2),
            type:      'action',
            title:     `면접 배정 안내 — ${appl?.name}`,
            body:      `${list[idx].stage === 'interview1' ? '1차' : '2차'} 면접관으로 배정되었습니다. 면접 포털을 확인하세요.`,
            link:      '#/interview-portal',
            read:      false,
            createdAt: new Date().toISOString(),
          });
        });
        localStorage.setItem('hr_notifications', JSON.stringify(notifs));
      }
    }
    showToast(`면접관이 지정되었습니다. (${checked.length}명)`, 'success');
    overlay.remove();
    _renderPage(root);
  });
}

function _renderAddJobForm(root) {
  root.innerHTML = `
<div style="padding:16px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button id="back-btn" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text)">←</button>
    <div style="font-size:15px;font-weight:700">💼 채용 공고 등록</div>
  </div>
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
    ${_fld('job-title','공고 제목','시니어 백엔드 개발자','text')}

    <div style="margin-bottom:12px">
      <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">부서</label>
      <select id="job-dept" style="width:100%;padding:9px;border:1.5px solid var(--border);
        border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
        ${['개발팀','HR팀','마케팅팀','영업팀','재무팀','경영지원'].map(d=>`<option>${d}</option>`).join('')}
      </select>
    </div>

    <div style="margin-bottom:12px">
      <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">고용 형태</label>
      <select id="job-type" style="width:100%;padding:9px;border:1.5px solid var(--border);
        border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
        <option>정규직</option><option>계약직</option><option>인턴</option><option>파트타임</option>
      </select>
    </div>

    ${_fld('job-deadline','지원 마감일','2026-06-30','date')}

    <div style="margin-bottom:12px">
      <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">공고 내용</label>
      <textarea id="job-desc" placeholder="주요 업무, 자격 요건, 우대 사항…"
        style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
               font-size:13px;background:var(--bg);color:var(--text);
               box-sizing:border-box;height:90px;resize:vertical"></textarea>
    </div>
  </div>
  <button id="save-btn" style="width:100%;margin-top:14px;background:#4F46E5;color:#fff;border:none;
    border-radius:12px;padding:14px;font-size:14px;font-weight:700;cursor:pointer">등록하기</button>
</div>`;

  root.querySelector('#back-btn').addEventListener('click', () => { _view = 'list'; _renderPage(root); });
  root.querySelector('#save-btn').addEventListener('click', () => {
    const title = root.querySelector('#job-title').value.trim();
    if (!title) { showToast('공고 제목을 입력하세요.', 'error'); return; }
    const jobs = _getJobs();
    const now = new Date().toISOString().slice(0,10);
    jobs.push({
      id: 'JOB' + Date.now(),
      title,
      dept: root.querySelector('#job-dept').value,
      type: root.querySelector('#job-type').value,
      status: 'open',
      postedAt: now,
      deadline: root.querySelector('#job-deadline').value || now,
      desc: root.querySelector('#job-desc').value.trim(),
    });
    _saveJobs(jobs);
    showToast('채용 공고가 등록되었습니다.', 'success');
    addNotification({ type: 'system', title: `새 채용 공고 등록: ${title}`, body: '' });
    _view = 'list'; _renderPage(root);
  });
}

function _renderAddApplicantForm(root) {
  const j = _selectedJob;
  root.innerHTML = `
<div style="padding:16px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button id="back-btn" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text)">←</button>
    <div>
      <div style="font-size:14px;font-weight:700">지원자 추가</div>
      <div style="font-size:11px;color:#64748B">${j?.title || ''}</div>
    </div>
  </div>
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
    ${_fld('ap-name','이름','홍길동','text')}
    ${_fld('ap-email','이메일','hong@example.com','email')}
    ${_fld('ap-phone','연락처','010-1234-5678','tel')}

    <div style="margin-bottom:12px">
      <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">초기 단계</label>
      <select id="ap-stage" style="width:100%;padding:9px;border:1.5px solid var(--border);
        border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
        ${STAGES.map(s=>`<option value="${s.key}">${s.label}</option>`).join('')}
      </select>
    </div>

    <div style="margin-bottom:12px">
      <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">메모</label>
      <textarea id="ap-note" placeholder="특이사항, 인상 등…"
        style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
               font-size:13px;background:var(--bg);color:var(--text);
               box-sizing:border-box;height:70px;resize:vertical"></textarea>
    </div>
  </div>
  <button id="save-btn" style="width:100%;margin-top:14px;background:#4F46E5;color:#fff;border:none;
    border-radius:12px;padding:14px;font-size:14px;font-weight:700;cursor:pointer">추가하기</button>
</div>`;

  root.querySelector('#back-btn').addEventListener('click', () => { _view = 'kanban'; _renderPage(root); });
  root.querySelector('#save-btn').addEventListener('click', () => {
    const name = root.querySelector('#ap-name').value.trim();
    if (!name) { showToast('이름을 입력하세요.', 'error'); return; }
    const list = _getApplicants();
    list.push({
      id: 'APP' + Date.now(),
      jobId: j.id,
      name,
      email: root.querySelector('#ap-email').value.trim(),
      phone: root.querySelector('#ap-phone').value.trim(),
      stage: root.querySelector('#ap-stage').value,
      appliedAt: new Date().toISOString().slice(0,10),
      note: root.querySelector('#ap-note').value.trim(),
      resumeUrl: '#',
    });
    _saveApplicants(list);
    showToast(`${name}님이 추가되었습니다.`, 'success')
      addNotification({ type: 'success', title: 'Recruitment (관리자)', body: '님이 추가되었습니다.' });
    _view = 'kanban'; _renderPage(root);
  });
}

function _fld(id, label, placeholder, type) {
  return `<div style="margin-bottom:12px">
    <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">${label}</label>
    <input id="${id}" type="${type}" placeholder="${placeholder}" value="${type==='date'?placeholder:''}"
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>`;
}
export function mount(root) { return render(root); }
