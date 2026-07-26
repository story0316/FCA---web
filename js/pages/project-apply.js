/**
 * project-apply.js — 사내 공모 / 프로젝트 참여 신청
 */

import {getUser, isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js'
import { addNotification } from '../components/notification-hub.js';

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId() {
  const s = _session();
  return s.empId || s.userId || getUser()?.id || 'EMP001';
}

const LS_PROJECTS  = 'hr_projects';
const LS_APPLIES   = 'hr_project_applies';

const SKILL_TAGS = ['React','Python','SQL','데이터 분석','프로젝트 관리','디자인','마케팅','재무','HR','영어','일본어','중국어'];

const DEMO_PROJECTS = [
  {
    id: 'proj_001', title: 'AI 기반 고객 이탈 예측 모델', dept: '데이터팀',
    lead: '김데이터', deadline: '2026-07-31', headcount: 2, status: 'open',
    skills: ['Python','SQL','데이터 분석'], duration: '3개월',
    desc: '머신러닝을 활용해 고객 이탈 확률을 예측하는 모델을 개발합니다. 데이터 전처리부터 모델 배포까지 전 과정에 참여합니다.',
  },
  {
    id: 'proj_002', title: '글로벌 마케팅 캠페인 기획', dept: '마케팅팀',
    lead: '이마케팅', deadline: '2026-07-15', headcount: 1, status: 'open',
    skills: ['마케팅','영어','디자인'], duration: '2개월',
    desc: '동남아 시장 진출을 위한 SNS 마케팅 캠페인을 기획하고 실행합니다. 영어 커뮤니케이션 필수.',
  },
  {
    id: 'proj_003', title: 'ERP 시스템 개선 TF', dept: 'IT팀',
    lead: '박IT', deadline: '2026-08-31', headcount: 3, status: 'open',
    skills: ['React','SQL','프로젝트 관리'], duration: '4개월',
    desc: '내부 ERP 시스템의 UI/UX를 개선하고 신규 기능을 추가하는 TF입니다. 기획·개발·QA 협업.',
  },
  {
    id: 'proj_004', title: '신입사원 온보딩 프로그램 재설계', dept: 'HR팀',
    lead: '최HR', deadline: '2026-07-01', headcount: 2, status: 'open',
    skills: ['HR','프로젝트 관리','디자인'], duration: '2개월',
    desc: '입사 후 90일 온보딩 여정을 데이터 기반으로 재설계합니다. 콘텐츠 제작 및 파일럿 운영 포함.',
  },
  {
    id: 'proj_005', title: '탄소중립 보고서 작성 TF', dept: '전략팀',
    lead: '정전략', deadline: '2026-06-30', headcount: 2, status: 'closed',
    skills: ['재무','데이터 분석','영어'], duration: '1개월',
    desc: 'ESG 공시를 위한 탄소중립 보고서를 작성합니다. (모집 마감)',
  },
];

function _loadProjects() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_PROJECTS) || '[]');
    const ids = new Set(saved.map(p => p.id));
    return [...saved, ...DEMO_PROJECTS.filter(p => !ids.has(p.id))];
  } catch { return DEMO_PROJECTS; }
}

function _loadApplies() { try { return JSON.parse(localStorage.getItem(LS_APPLIES) || '[]'); } catch { return []; } }
function _saveApplies(d) { localStorage.setItem(LS_APPLIES, JSON.stringify(d)); }

const STATUS_BADGE = {
  open:    { label: '모집 중',   bg: '#D1FAE5', color: '#059669' },
  closed:  { label: '마감',      bg: '#F1F5F9', color: 'var(--text-muted)' },
  ongoing: { label: '진행 중',   bg: '#EFF6FF', color: '#3B82F6' },
};

const APPLY_META = {
  pending:  { label: '검토 중',  bg: '#FEF3C7', color: '#D97706' },
  approved: { label: '선발',     bg: '#D1FAE5', color: '#059669' },
  rejected: { label: '미선발',   bg: '#FEE2E2', color: '#EF4444' },
};

let _tab = 'list';
let _selectedProj = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _tab = 'list'; _selectedProj = null; _draw(root); }
export function unmount() { _tab = 'list';
  _selectedProj = null;
}

function _draw(root) {
  const user = getUser();
  const uid  = user?.id || user?.employee_id || 'demo';
  const projects = _loadProjects();
  const applies  = _loadApplies();
  const myApplies= applies.filter(a => a.userId === uid);

  root.innerHTML = `
<div class="page-content" style="padding:16px;max-width:480px;margin:0 auto">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button onclick="window.navBack()" style="background:none;border:none;font-size:20px;cursor:pointer;padding:0">←</button>
    <div>
      <div style="font-size:17px;font-weight:800;color:var(--text)">사내 공모 참여</div>
      <div style="font-size:11px;color:var(--text-muted)">현재 모집 중 ${projects.filter(p=>p.status==='open').length}개</div>
    </div>
  </div>

  <!-- 탭 -->
  <div style="display:flex;background:#F1F5F9;border-radius:10px;padding:3px;margin-bottom:16px">
    ${[{k:'list',l:'공모 목록'},{k:'mine',l:`내 지원 (${myApplies.length})`}].map(t=>`
      <button class="pa-tab" data-t="${t.k}"
        style="flex:1;padding:8px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;
               background:${_tab===t.k?'#fff':'transparent'};color:${_tab===t.k?'#4F46E5':'var(--text-muted)'};
               box-shadow:${_tab===t.k?'0 1px 4px rgba(0,0,0,0.1)':'none'}">
        ${t.l}
      </button>`).join('')}
  </div>

  ${_tab === 'list' ? _renderList(projects, applies, uid) : ''}
  ${_tab === 'mine' ? _renderMine(myApplies, projects) : ''}
</div>`;

  root.querySelectorAll('.pa-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _selectedProj = null; _draw(root); });
  });

  root.querySelectorAll('.pa-proj').forEach(el => {
    el.addEventListener('click', () => {
      _selectedProj = _selectedProj === el.dataset.id ? null : el.dataset.id;
      _draw(root);
    });
  });

  root.querySelectorAll('.pa-apply-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); _apply(btn.dataset.id, uid, root); });
  });
  root.querySelectorAll('.pa-cancel-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); _cancelApply(btn.dataset.id, uid, root); });
  });
}

function _renderList(projects, applies, uid) {
  const open = projects.filter(p => p.status === 'open');
  const closed = projects.filter(p => p.status !== 'open');

  return [...open, ...closed].map(p => {
    const badge = STATUS_BADGE[p.status] || STATUS_BADGE.open;
    const myApp = applies.find(a => a.projectId === p.id && a.userId === uid);
    const appCount = applies.filter(a => a.projectId === p.id).length;
    const isSelected = _selectedProj === p.id;

    return `
<div class="pa-proj" data-id="${p.id}"
  style="background:var(--card-bg);border:1px solid ${isSelected?'#4F46E5':'var(--border)'};
         border-radius:14px;padding:14px;margin-bottom:10px;cursor:pointer">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="flex:1;margin-right:8px">
      <div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:2px">${p.title}</div>
      <div style="font-size:11px;color:var(--text-muted)">${p.dept} · 리드: ${p.lead}</div>
    </div>
    <span style="padding:3px 9px;border-radius:6px;font-size:11px;font-weight:600;background:${badge.bg};color:${badge.color};flex-shrink:0">${badge.label}</span>
  </div>

  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
    ${p.skills.map(s=>`<span style="padding:2px 8px;background:#EEF2FF;border-radius:5px;font-size:11px;color:#4F46E5">${s}</span>`).join('')}
  </div>

  <div style="display:flex;gap:12px;font-size:11px;color:var(--text-muted);margin-bottom:${isSelected?'10px':'0'}">
    <span>📅 마감 ${p.deadline}</span>
    <span>👥 ${p.headcount}명 모집</span>
    <span>⏱ ${p.duration}</span>
    <span>📋 지원 ${appCount}명</span>
  </div>

  ${isSelected ? `
  <div style="border-top:1px solid var(--border);padding-top:10px;margin-top:2px">
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;line-height:1.6">${p.desc}</div>
    ${p.status === 'open' ? (myApp
      ? `<div style="display:flex;align-items:center;justify-content:space-between">
           <span style="font-size:12px;padding:4px 10px;border-radius:7px;background:${APPLY_META[myApp.status]?.bg};color:${APPLY_META[myApp.status]?.color};font-weight:700">
             ${APPLY_META[myApp.status]?.label || '검토 중'}
           </span>
           ${myApp.status==='pending' ? `<button class="pa-cancel-btn" data-id="${p.id}" style="padding:7px 14px;border:1px solid #EF4444;border-radius:7px;background:none;color:#EF4444;font-size:11px;font-weight:700;cursor:pointer">지원 취소</button>` : ''}
         </div>`
      : `<button class="pa-apply-btn" data-id="${p.id}"
           style="width:100%;padding:11px;border:none;border-radius:9px;background:#4F46E5;color:#fff;font-size:13px;font-weight:700;cursor:pointer">
           🙋 참여 신청하기
         </button>`)
      : `<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:8px 0">모집이 마감되었습니다</div>`}
  </div>` : ''}
</div>`;
  }).join('');
}

function _renderMine(myApplies, projects) {
  if (!myApplies.length) return `
<div style="text-align:center;padding:40px 16px;color:var(--text-muted)">
  <div style="font-size:32px;margin-bottom:8px">📋</div>
  <div style="font-size:13px">지원한 공모가 없습니다</div>
  <div style="font-size:11px;margin-top:4px">공모 목록에서 관심 있는 프로젝트에 지원해 보세요</div>
</div>`;

  return myApplies.slice().reverse().map(a => {
    const proj = projects.find(p => p.id === a.projectId);
    if (!proj) return '';
    const meta = APPLY_META[a.status] || APPLY_META.pending;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div>
      <div style="font-size:13px;font-weight:700;color:var(--text)">${proj.title}</div>
      <div style="font-size:11px;color:var(--text-muted)">${proj.dept} · 지원일 ${a.appliedAt?.slice(0,10)||''}</div>
    </div>
    <span style="padding:3px 9px;border-radius:6px;font-size:11px;font-weight:600;background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>
  <div style="display:flex;gap:6px;flex-wrap:wrap">
    ${proj.skills.map(s=>`<span style="padding:2px 7px;background:#EEF2FF;border-radius:5px;font-size:11px;color:#4F46E5">${s}</span>`).join('')}
  </div>
</div>`;
  }).join('');
}

function _apply(projectId, uid, root) {
  const applies = _loadApplies();
  if (applies.find(a => a.projectId === projectId && a.userId === uid)) {
    showToast('이미 지원하셨습니다.', 'error'); return;
  }
  applies.push({ id: 'app_'+Date.now(), projectId, userId: uid, status: 'pending', appliedAt: new Date().toISOString() });
  _saveApplies(applies);
  showToast('참여 신청이 제출되었습니다! 검토 후 연락드리겠습니다. 🎉');
      addNotification({ type: 'success', title: '프로젝트 지원', body: '참여 신청이 제출되었습니다!' });
  _draw(root);
}

function _cancelApply(projectId, uid, root) {
  const applies = _loadApplies().filter(a => !(a.projectId === projectId && a.userId === uid));
  _saveApplies(applies);
  showToast('지원이 취소되었습니다.');
      addNotification({ type: 'info', title: '프로젝트 지원', body: '지원이 취소되었습니다.' });
  _draw(root);
}
