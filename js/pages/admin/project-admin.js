/**
 * project-admin.js — 사내 공모 프로젝트 관리
 */

import { loadDisplayEmployees } from '../../data/demo_employees.js';
import { showToast } from '../../components/toast.js'
import { addNotification } from '../../components/notification-hub.js';

const LS_PROJECTS = 'hr_projects';
const LS_APPLIES  = 'hr_project_applies';

const DEMO_PROJECTS = [
  { id:'proj_001', title:'AI 기반 고객 이탈 예측 모델', dept:'데이터팀', lead:'김데이터', deadline:'2026-07-31', headcount:2, status:'open', skills:['Python','SQL','데이터 분석'], duration:'3개월', desc:'머신러닝을 활용해 고객 이탈 확률을 예측하는 모델 개발.' },
  { id:'proj_002', title:'글로벌 마케팅 캠페인 기획',   dept:'마케팅팀', lead:'이마케팅', deadline:'2026-07-15', headcount:1, status:'open', skills:['마케팅','영어','디자인'],       duration:'2개월', desc:'동남아 시장 진출을 위한 SNS 마케팅 캠페인 기획·실행.' },
  { id:'proj_003', title:'ERP 시스템 개선 TF',          dept:'IT팀',     lead:'박IT',     deadline:'2026-08-31', headcount:3, status:'open', skills:['React','SQL','프로젝트 관리'],duration:'4개월', desc:'내부 ERP UI/UX 개선 및 신규 기능 추가 TF.' },
  { id:'proj_004', title:'신입사원 온보딩 재설계',       dept:'HR팀',     lead:'최HR',     deadline:'2026-07-01', headcount:2, status:'open', skills:['HR','프로젝트 관리','디자인'], duration:'2개월', desc:'입사 후 90일 온보딩 여정 데이터 기반 재설계.' },
  { id:'proj_005', title:'탄소중립 보고서 작성 TF',      dept:'전략팀',   lead:'정전략',   deadline:'2026-06-30', headcount:2, status:'closed',skills:['재무','데이터 분석','영어'],    duration:'1개월', desc:'ESG 공시용 탄소중립 보고서 작성.' },
];

let _employees = [];
let _depts = [];

const STATUS_LABEL = { open:'모집 중', closed:'마감', ongoing:'진행 중' };
const APPLY_META = {
  pending:  { label:'검토 중', bg:'#FEF3C7', color:'#D97706' },
  approved: { label:'선발',    bg:'#D1FAE5', color:'#059669' },
  rejected: { label:'미선발',  bg:'#FEE2E2', color:'#EF4444' },
};

function _loadProjects() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_PROJECTS) || '[]');
    const ids = new Set(saved.map(p => p.id));
    return [...saved, ...DEMO_PROJECTS.filter(p => !ids.has(p.id))];
  } catch { return DEMO_PROJECTS; }
}
function _saveProjects(d) {
  const real = d.filter(p => !DEMO_PROJECTS.find(dp => dp.id === p.id));
  localStorage.setItem(LS_PROJECTS, JSON.stringify(real));
}
function _loadApplies()  { try { return JSON.parse(localStorage.getItem(LS_APPLIES) || '[]'); } catch { return []; } }
function _saveApplies(d) { localStorage.setItem(LS_APPLIES, JSON.stringify(d)); }
function _emp(id)        { return _employees.find(e => e.id === id || e.employee_id === id); }

let _tab      = 'projects';
let _selProj  = null;
let _showForm = false;

export async function mount(root) {
  _tab = 'projects'; _selProj = null; _showForm = false;
  root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">⏳</div><div style="font-size:13px">로딩 중…</div></div>`;
  _employees = await loadDisplayEmployees();
  _depts = [...new Set(_employees.map(e => e.dept || e.department || '기타'))].sort();
  _draw(root);
}

export function render(root) { _tab = 'projects'; _selProj = null; _showForm = false; _draw(root); }
export function unmount() {
  _tab = 'projects'; _employees = []; _depts = [];
}

function _draw(root) {
  const projects = _loadProjects();
  const applies  = _loadApplies();
  const openCount= projects.filter(p => p.status === 'open').length;
  const pendCount = applies.filter(a => a.status === 'pending').length;

  root.innerHTML = `
<!-- 탭 -->
<div style="display:flex;border-bottom:1px solid var(--border);margin-bottom:14px">
  ${[{k:'projects',l:`프로젝트 (${projects.length})`},{k:'applies',l:`지원자 (${pendCount}건 대기)`}].map(t=>`
    <button class="pja-tab" data-t="${t.k}"
      style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab===t.k?'#4F46E5':'transparent'};color:${_tab===t.k?'#4F46E5':'#64748B'}">
      ${t.l}
    </button>`).join('')}
</div>

${_tab === 'projects' ? _renderProjects(projects, applies) : ''}
${_tab === 'applies'  ? _renderApplies(applies, projects) : ''}`;

  root.querySelectorAll('.pja-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _selProj = null; _showForm = false; _draw(root); });
  });

  root.querySelector('#pja-new-btn')?.addEventListener('click', () => { _showForm = !_showForm; _draw(root); });

  root.querySelectorAll('.pja-proj-item').forEach(el => {
    el.addEventListener('click', () => { _selProj = _selProj === el.dataset.id ? null : el.dataset.id; _draw(root); });
  });

  root.querySelector('#pja-proj-save')?.addEventListener('click', () => _saveNewProject(root));
  root.querySelector('#pja-proj-cancel')?.addEventListener('click', () => { _showForm = false; _draw(root); });

  root.querySelectorAll('.pja-status-sel').forEach(sel => {
    sel.addEventListener('change', e => { e.stopPropagation(); _updateProjStatus(sel.dataset.id, sel.value, root); });
  });

  root.querySelectorAll('.pja-approve').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); _updateApply(btn.dataset.id, 'approved', root); });
  });
  root.querySelectorAll('.pja-reject').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); _updateApply(btn.dataset.id, 'rejected', root); });
  });
}

function _renderProjects(projects, applies) {
  return `
<!-- KPI -->
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
  ${[
    { l:'총 프로젝트', v: projects.length,                              c:'#4F46E5' },
    { l:'모집 중',     v: projects.filter(p=>p.status==='open').length,  c:'#10B981' },
    { l:'총 지원',     v: applies.length,                                c:'#F59E0B' },
  ].map(k=>`
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
      <div style="font-size:22px;font-weight:900;color:${k.c}">${k.v}</div>
      <div style="font-size:10px;color:#64748B">${k.l}</div>
    </div>`).join('')}
</div>

<!-- 새 프로젝트 -->
<button id="pja-new-btn" style="width:100%;padding:10px;border:2px dashed #C7D2FE;border-radius:10px;
  background:#EEF2FF;color:#4F46E5;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:10px">
  + 새 프로젝트 공모 등록
</button>

${_showForm ? _renderForm() : ''}

${projects.map(p => {
  const appCount = applies.filter(a => a.projectId === p.id).length;
  const isSelected = _selProj === p.id;
  const stColor = p.status==='open'?'#059669':p.status==='ongoing'?'#3B82F6':'#64748B';
  const stBg    = p.status==='open'?'#D1FAE5':p.status==='ongoing'?'#EFF6FF':'#F1F5F9';
  return `
<div class="pja-proj-item" data-id="${p.id}"
  style="background:var(--card-bg);border:1px solid ${isSelected?'#4F46E5':'var(--border)'};
         border-radius:12px;padding:12px;margin-bottom:8px;cursor:pointer">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div style="flex:1;margin-right:8px">
      <div style="font-size:13px;font-weight:700;color:var(--text)">${p.title}</div>
      <div style="font-size:11px;color:#64748B">${p.dept} · 마감 ${p.deadline} · ${p.headcount}명</div>
    </div>
    <span style="padding:3px 8px;border-radius:6px;font-size:10px;font-weight:600;background:${stBg};color:${stColor};flex-shrink:0">${STATUS_LABEL[p.status]||p.status}</span>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center">
    <div style="display:flex;gap:5px;flex-wrap:wrap">
      ${p.skills.map(s=>`<span style="padding:1px 7px;background:#F1F5F9;border-radius:5px;font-size:10px;color:#64748B">${s}</span>`).join('')}
    </div>
    <span style="font-size:11px;color:#4F46E5;font-weight:700">${appCount}명 지원</span>
  </div>
  ${isSelected ? `
  <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
    <div style="font-size:11px;color:#64748B;margin-bottom:8px">${p.desc}</div>
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:11px;color:#64748B">상태 변경:</span>
      <select class="pja-status-sel" data-id="${p.id}"
        style="flex:1;padding:6px;border:1px solid var(--border);border-radius:7px;font-size:12px;background:var(--card-bg);color:var(--text)">
        ${['open','ongoing','closed'].map(s=>`<option value="${s}" ${p.status===s?'selected':''}>${STATUS_LABEL[s]}</option>`).join('')}
      </select>
    </div>
  </div>` : ''}
</div>`;
}).join('')}`;
}

function _renderForm() {
  return `
<div style="background:#F8FAFC;border:1px solid #C7D2FE;border-radius:12px;padding:14px;margin-bottom:12px">
  <div style="font-size:12px;font-weight:700;color:#4F46E5;margin-bottom:10px">프로젝트 등록</div>
  <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">
    <div>
      <div style="font-size:11px;color:#64748B;margin-bottom:3px">프로젝트 명 <span style="color:#EF4444">*</span></div>
      <input id="pja-title" type="text" placeholder="프로젝트 이름"
        style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <div style="font-size:11px;color:#64748B;margin-bottom:3px">주관 부서</div>
        <select id="pja-dept" style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text)">
          ${_depts.map(d=>`<option>${d}</option>`).join('')}
        </select>
      </div>
      <div>
        <div style="font-size:11px;color:#64748B;margin-bottom:3px">모집 인원</div>
        <input id="pja-hc" type="number" min="1" value="2"
          style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text)">
      </div>
      <div>
        <div style="font-size:11px;color:#64748B;margin-bottom:3px">마감일 <span style="color:#EF4444">*</span></div>
        <input id="pja-deadline" type="date"
          style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text)">
      </div>
      <div>
        <div style="font-size:11px;color:#64748B;margin-bottom:3px">기간</div>
        <input id="pja-duration" type="text" placeholder="예: 3개월"
          style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text)">
      </div>
    </div>
    <div>
      <div style="font-size:11px;color:#64748B;margin-bottom:3px">설명</div>
      <textarea id="pja-desc" rows="2" placeholder="프로젝트 목적 및 역할"
        style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text);resize:none"></textarea>
    </div>
  </div>
  <div style="display:flex;gap:8px">
    <button id="pja-proj-cancel" style="flex:1;padding:9px;border:1px solid var(--border);border-radius:8px;background:var(--card-bg);color:#64748B;font-size:12px;cursor:pointer">취소</button>
    <button id="pja-proj-save"   style="flex:2;padding:9px;border:none;border-radius:8px;background:#4F46E5;color:#fff;font-size:12px;font-weight:700;cursor:pointer">등록</button>
  </div>
</div>`;
}

function _renderApplies(applies, projects) {
  if (!applies.length) return `
<div style="text-align:center;padding:40px 16px;color:#94A3B8">
  <div style="font-size:28px;margin-bottom:6px">📭</div>
  <div style="font-size:12px">지원자가 없습니다</div>
</div>`;

  const grouped = {};
  applies.forEach(a => { if (!grouped[a.projectId]) grouped[a.projectId] = []; grouped[a.projectId].push(a); });

  return Object.entries(grouped).map(([pid, apps]) => {
    const proj = projects.find(p => p.id === pid);
    return `
<div style="margin-bottom:14px">
  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">
    ${proj?.title || pid} <span style="font-weight:400;color:#94A3B8">(${apps.length}명)</span>
  </div>
  ${apps.map(a => {
    const emp = _emp(a.userId);
    const meta = APPLY_META[a.status] || APPLY_META.pending;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:6px">
  <div style="display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:12px;font-weight:700;color:var(--text)">${emp?emp.name:a.userId}</div>
      <div style="font-size:10px;color:#94A3B8">${emp?(emp.department||emp.dept||''):''} · ${a.appliedAt?.slice(0,10)||''}</div>
    </div>
    <div style="display:flex;gap:6px;align-items:center">
      <span style="padding:2px 8px;border-radius:5px;font-size:11px;font-weight:600;background:${meta.bg};color:${meta.color}">${meta.label}</span>
      ${a.status==='pending' ? `
      <button class="pja-approve" data-id="${a.id}" style="padding:5px 10px;background:#10B981;color:#fff;border:none;border-radius:6px;font-size:11px;cursor:pointer">선발</button>
      <button class="pja-reject"  data-id="${a.id}" style="padding:5px 10px;background:#EF4444;color:#fff;border:none;border-radius:6px;font-size:11px;cursor:pointer">반려</button>
      ` : ''}
    </div>
  </div>
</div>`;
  }).join('')}
</div>`;
  }).join('');
}

function _saveNewProject(root) {
  const title    = root.querySelector('#pja-title')?.value.trim();
  const deadline = root.querySelector('#pja-deadline')?.value;
  if (!title)    { showToast('프로젝트 명을 입력해 주세요.', 'error'); return; }
  if (!deadline) { showToast('마감일을 입력해 주세요.', 'error'); return; }
  const projects = _loadProjects();
  const user = _employees[0];
  projects.unshift({
    id:       'proj_' + Date.now(),
    title,
    dept:     root.querySelector('#pja-dept')?.value || '',
    lead:     user?.name || '관리자',
    deadline,
    headcount:parseInt(root.querySelector('#pja-hc')?.value || '2') || 2,
    status:   'open',
    skills:   [],
    duration: root.querySelector('#pja-duration')?.value.trim() || '',
    desc:     root.querySelector('#pja-desc')?.value.trim() || '',
  });
  _saveProjects(projects);
  showToast('새 프로젝트가 등록되었습니다.');
  _showForm = false;
  _draw(root);
}

function _updateProjStatus(id, status, root) {
  const all = _loadProjects();
  const idx = all.findIndex(p => p.id === id);
  if (idx >= 0) { all[idx].status = status; _saveProjects(all); }
  showToast('상태가 변경되었습니다.');
  _selProj = null;
  _draw(root);
}

function _updateApply(id, status, root) {
  const all = _loadApplies();
  const idx = all.findIndex(a => a.id === id);
  if (idx < 0) { showToast('데모 지원자는 수정할 수 없습니다.', 'error'); return; }
  all[idx].status = status;
  _saveApplies(all);
  showToast(status === 'approved' ? '선발 처리되었습니다.' : '미선발 처리되었습니다.');
      addNotification({ type: 'success', title: '프로젝트 관리', body: status === 'approved' ? '선발 처리되었습니다.' : '미선발 처리되었습니다.' });
  _draw(root);
}
