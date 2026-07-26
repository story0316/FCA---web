/**
 * org-chart.js — 조직도 (직원)
 * 데이터: 공통 DB user_profiles.department 기반으로 동적 그루핑
 */

import { isApplicant, getUser } from '../auth.js';
import { showToast } from '../components/toast.js';
import { loadDisplayEmployees } from '../data/demo_employees.js';

// 부서별 색상 팔레트 (순환)
const DEPT_COLORS = [
  { color: '#4F46E5', bg: '#EEF2FF' },
  { color: '#3B82F6', bg: '#EFF6FF' },
  { color: '#8B5CF6', bg: '#F5F3FF' },
  { color: '#F59E0B', bg: '#FFFBEB' },
  { color: '#10B981', bg: '#F0FDF4' },
  { color: '#EF4444', bg: '#FEF2F2' },
  { color: '#EC4899', bg: '#FDF2F8' },
  { color: '#06B6D4', bg: '#ECFEFF' },
];

const ROLE_TITLE = {
  director: '디렉터', manager: '매니저', hr_admin: 'HR 어드민',
  staff: '팀원', admin: '관리자',
};

function _buildOrgData(employees, orgName) {
  // 부서별 그루핑
  const deptMap = {};
  employees.forEach(e => {
    const dept = e.dept || e.department || '미지정';
    if (!deptMap[dept]) deptMap[dept] = [];
    deptMap[dept].push(e);
  });

  const deptNames = Object.keys(deptMap).sort();
  const departments = deptNames.map((name, i) => {
    const { color, bg } = DEPT_COLORS[i % DEPT_COLORS.length];
    const members = deptMap[name];
    // manager/director를 팀장으로, 나머지는 멤버
    const headIdx = members.findIndex(m => m.role === 'manager' || m.role === 'director' || m.role === 'hr_admin');
    const head = headIdx !== -1 ? members[headIdx] : members[0];
    const rest = members.filter((_, idx) => idx !== (headIdx !== -1 ? headIdx : 0));
    return {
      id:      `dept-${name}`,
      name,
      color,
      bg,
      head:    { id: head.id, name: head.name, title: ROLE_TITLE[head.role] || head.role, avatar: head.avatar || '👤' },
      members: rest.map(m => ({ id: m.id, name: m.name, title: ROLE_TITLE[m.role] || m.role, avatar: m.avatar || '👤' })),
    };
  });

  return { company: orgName || 'HR Competency OS', departments };
}

let _mode = 'tree';
let _search = '';
let _selected = null;
let _orgData = { company: 'HR Competency OS', departments: [] };

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _mode = 'tree'; _search = ''; _selected = null;
  root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8">
    <div style="font-size:32px;margin-bottom:8px">⏳</div>
    <div style="font-size:13px">조직도 로딩 중…</div>
  </div>`;

  const user = getUser();
  const employees = await loadDisplayEmployees(user?.org_id);
  const orgName = user?.org_id || 'HR Competency OS';

  if (!employees.length) {
    root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8">
      <div style="font-size:48px;margin-bottom:12px">🏢</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:6px">조직도 데이터가 없습니다</div>
      <div style="font-size:12px">직원 프로필에 부서 정보를 등록하면 자동으로 표시됩니다.</div>
    </div>`;
    return;
  }

  _orgData = _buildOrgData(employees, orgName);
  _render(root);
}

export function unmount() {
  _mode = 'tree'; _search = ''; _selected = null;
  _orgData = { company: 'HR Competency OS', departments: [] };
}

function _allMembers() {
  const all = [];
  _orgData.departments.forEach(d => {
    all.push({ ...d.head, dept: d.name, color: d.color, bg: d.bg, isHead: true });
    d.members.forEach(m => all.push({ ...m, dept: d.name, color: d.color, bg: d.bg, isHead: false }));
  });
  return all;
}

function _render(root) {
  const total = _allMembers().length;

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">

  <!-- 상단 바 -->
  <div class="top-bar" style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="ob-back" style="background:none;border:none;font-size:20px;cursor:pointer;
            color:var(--text);padding:0;line-height:1">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700;color:var(--text)">🏢 조직도</div>
      <div style="font-size:11px;color:var(--text-muted)">${_orgData.company} · 임직원 ${total}명</div>
    </div>
    <!-- 보기 전환 -->
    <div style="display:flex;gap:4px;background:var(--bg);border-radius:10px;padding:3px">
      <button id="mode-tree" style="padding:5px 10px;border:none;border-radius:8px;font-size:12px;
              font-weight:600;cursor:pointer;background:${_mode==='tree'?'#4F46E5':'transparent'};
              color:${_mode==='tree'?'#fff':'var(--text-muted)'}">트리</button>
      <button id="mode-dept" style="padding:5px 10px;border:none;border-radius:8px;font-size:12px;
              font-weight:600;cursor:pointer;background:${_mode==='dept'?'#4F46E5':'transparent'};
              color:${_mode==='dept'?'#fff':'var(--text-muted)'}">부서별</button>
    </div>
  </div>

  <!-- 검색 -->
  <div style="padding:10px 16px;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <div style="position:relative">
      <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:14px">🔍</span>
      <input id="ob-search" type="text" placeholder="이름 또는 부서 검색…" value="${_search}"
        style="width:100%;padding:8px 10px 8px 32px;border:1.5px solid var(--border);
               border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
  </div>

  <!-- 내용 -->
  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_search && !_hasAnyMatch() ? `
    <div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
      <div style="font-size:40px;margin-bottom:12px">🔍</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:6px;color:var(--text)">'${_search}' 검색 결과 없음</div>
      <div style="font-size:12px">이름 또는 부서명으로 다시 검색해보세요</div>
    </div>` : _mode === 'tree' ? _renderTree() : _renderDepts()}
  </div>

</div>

${_selected ? _renderModal(_selected) : ''}
`;

  root.querySelector('#ob-back').addEventListener('click', () => window.navBack());
  root.querySelector('#mode-tree').addEventListener('click', () => { _mode = 'tree'; _render(root); });
  root.querySelector('#mode-dept').addEventListener('click', () => { _mode = 'dept'; _render(root); });

  const searchEl = root.querySelector('#ob-search');
  searchEl.addEventListener('input', e => { _search = e.target.value; _render(root); });

  root.querySelectorAll('.emp-card').forEach(card => {
    card.addEventListener('click', () => {
      const found = _allMembers().find(m => m.id === card.dataset.id);
      if (found) { _selected = found; _render(root); }
    });
  });

  if (_selected) {
    root.querySelector('#modal-close')?.addEventListener('click', () => { _selected = null; _render(root); });
    root.querySelector('#modal-backdrop')?.addEventListener('click', () => { _selected = null; _render(root); });
  }
}

function _matchSearch(name, dept) {
  if (!_search) return true;
  const q = _search.toLowerCase();
  return name.toLowerCase().includes(q) || dept.toLowerCase().includes(q);
}

function _hasAnyMatch() {
  const allMembers = _allMembers();
  return allMembers.some(m => _matchSearch(m.name, m.dept || ''));
}

function _renderTree() {
  const depts = _orgData.departments;
  if (!depts.length) return '<div style="text-align:center;padding:40px;color:var(--text-muted)">부서 정보가 없습니다.</div>';

  return `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
  ${depts.map(dept => `
  <div style="background:var(--card-bg);border:1.5px solid ${dept.color}33;border-radius:14px;padding:10px">
    <div style="font-size:11px;font-weight:700;color:${dept.color};
         background:${dept.bg};padding:3px 8px;border-radius:8px;
         display:inline-block;margin-bottom:8px">${dept.name}</div>
    ${_empCard(dept.head, dept.name, dept.color, dept.bg)}
    ${dept.members.filter(m => _matchSearch(m.name, dept.name)).map(m =>
      _empCard(m, dept.name, dept.color, dept.bg, true)
    ).join('')}
  </div>`).join('')}
</div>`;
}

function _renderDepts() {
  return _orgData.departments.map(dept => {
    const visible = [dept.head, ...dept.members].filter(m => _matchSearch(m.name, dept.name));
    if (!visible.length) return '';
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
     padding:12px;margin-bottom:10px">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
    <div style="width:4px;height:20px;background:${dept.color};border-radius:2px"></div>
    <div style="font-size:13px;font-weight:700;color:var(--text)">${dept.name}</div>
    <div style="font-size:11px;color:var(--text-muted)">${dept.members.length + 1}명</div>
  </div>
  <div style="display:flex;flex-direction:column;gap:6px">
    ${visible.map(m => `
    <div class="emp-card" data-id="${m.id}"
         style="display:flex;align-items:center;gap:10px;padding:8px 10px;
                border-radius:10px;cursor:pointer;transition:background 0.15s;
                background:${m === dept.head ? dept.bg : 'transparent'};
                border:1px solid ${m === dept.head ? dept.color+'44' : 'transparent'}">
      <div style="width:36px;height:36px;border-radius:50%;background:${dept.bg};flex-shrink:0;
           display:flex;align-items:center;justify-content:center;font-size:18px">${m.avatar}</div>
      <div style="min-width:0">
        <div style="font-size:13px;font-weight:${m === dept.head ? '700' : '600'};color:var(--text)">${m.name}</div>
        <div style="font-size:11px;color:var(--text-muted)">${m.title}${m === dept.head ? ' <span style="color:'+dept.color+'">●</span>' : ''}</div>
      </div>
    </div>`).join('')}
  </div>
</div>`;
  }).join('');
}

function _empCard(m, dept, color, bg, compact = false) {
  if (!_matchSearch(m.name, dept)) return '';
  return `
<div class="emp-card" data-id="${m.id}"
     style="display:flex;align-items:center;gap:8px;padding:${compact?'5px 8px':'8px 10px'};
            margin-bottom:${compact?'4px':'6px'};border-radius:10px;cursor:pointer;
            background:${compact?'transparent':bg};border:1px solid ${compact?'transparent':color+'33'}">
  <div style="width:${compact?'28px':'32px'};height:${compact?'28px':'32px'};border-radius:50%;
       background:${bg};flex-shrink:0;display:flex;align-items:center;
       justify-content:center;font-size:${compact?'14px':'16px'}">${m.avatar}</div>
  <div style="min-width:0">
    <div style="font-size:${compact?'12px':'13px'};font-weight:${compact?'500':'700'};
         color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.name}</div>
    <div style="font-size:10px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.title}</div>
  </div>
</div>`;
}

function _renderModal(m) {
  const badges = [
    { label: '부서', value: m.dept },
    { label: '직책', value: m.title },
  ];
  return `
<div id="modal-backdrop"
     style="position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:3000;
            display:flex;align-items:flex-end;justify-content:center">
  <div style="background:var(--card-bg);border-radius:20px 20px 0 0;width:100%;max-width:480px;
       padding:24px 20px 36px;animation:slideUp 0.22s ease" onclick="event.stopPropagation()">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="width:56px;height:56px;border-radius:50%;background:${m.bg};
             display:flex;align-items:center;justify-content:center;font-size:28px">${m.avatar}</div>
        <div>
          <div style="font-size:18px;font-weight:800;color:var(--text)">${m.name}</div>
          <div style="font-size:13px;color:var(--text-muted);margin-top:2px">${m.title}</div>
        </div>
      </div>
      <button id="modal-close"
              style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text-muted);padding:4px">✕</button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
      ${badges.map(b => `
      <div style="background:var(--bg);border-radius:10px;padding:10px 12px">
        <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px">${b.label}</div>
        <div style="font-size:13px;font-weight:600;color:var(--text)">${b.value}</div>
      </div>`).join('')}
    </div>

    <div style="display:flex;gap:8px">
      <button onclick="document.getElementById('modal-backdrop').click()"
        style="flex:1;padding:12px;border:1.5px solid var(--border);border-radius:12px;
               background:var(--bg);color:var(--text);font-size:13px;font-weight:600;cursor:pointer">
        닫기
      </button>
      <button onclick="showToast && showToast('메시지 기능은 준비 중입니다.','info')"
        style="flex:1;padding:12px;border:none;border-radius:12px;background:#4F46E5;
               color:#fff;font-size:13px;font-weight:600;cursor:pointer">
        💬 메시지
      </button>
    </div>
  </div>
</div>`;
}
