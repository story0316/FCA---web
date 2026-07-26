/**
 * certification-admin.js — 자격증 / 교육 현황 관리
 */

import { loadDisplayEmployees } from '../../data/demo_employees.js';
import { showToast } from '../../components/toast.js';
import { addNotificationForUser } from '../../components/notification-hub.js';

const LS_CERTS  = 'hr_certifications';
const LS_EDULOG = 'hr_edu_logs';

const CERT_CATEGORIES = {
  it:       { label: 'IT / 기술',     icon: '💻' },
  finance:  { label: '재무 / 회계',   icon: '📊' },
  hr:       { label: 'HR / 노무',     icon: '👥' },
  language: { label: '어학',           icon: '🌐' },
  pm:       { label: '프로젝트 관리', icon: '📋' },
  safety:   { label: '안전 / 보건',   icon: '🦺' },
  other:    { label: '기타',           icon: '🎓' },
};

const REFUND_META = {
  pending:  { label: '검토 중',  bg: '#FEF3C7', color: '#D97706' },
  approved: { label: '승인',     bg: '#D1FAE5', color: '#059669' },
  rejected: { label: '반려',     bg: '#FEE2E2', color: '#EF4444' },
};

const DEMO_CERT_NAMES = [
  { name: '정보처리기사',        category: 'it',       issuer: '한국산업인력공단' },
  { name: 'AWS Solutions Arch.', category: 'it',       issuer: 'Amazon' },
  { name: '재경관리사',          category: 'finance',  issuer: '한국CFO협회' },
  { name: 'SHRM-CP',             category: 'hr',       issuer: 'SHRM' },
  { name: 'OPIc IH',             category: 'language', issuer: 'ACTFL' },
  { name: 'PMP',                 category: 'pm',       issuer: 'PMI' },
  { name: '산업안전기사',        category: 'safety',   issuer: '한국산업인력공단' },
];

let _employees = [];

function _loadCerts() { try { return JSON.parse(localStorage.getItem(LS_CERTS)  || '[]'); } catch { return []; } }
function _loadEdus()  { try { return JSON.parse(localStorage.getItem(LS_EDULOG) || '[]'); } catch { return []; } }
function _saveEdus(d) { localStorage.setItem(LS_EDULOG, JSON.stringify(d)); }
function _emp(id)     { return _employees.find(e => e.id === id || e.employee_id === id); }

function _seedDemo(certs) {
  if (certs.length >= 10) return certs;
  const seeded = [...certs];
  _employees.slice(0, 12).forEach((emp, i) => {
    const n = DEMO_CERT_NAMES[i % DEMO_CERT_NAMES.length];
    const acq = new Date(); acq.setFullYear(acq.getFullYear() - (i % 3));
    const exp = new Date(acq); exp.setFullYear(exp.getFullYear() + 2);
    seeded.push({
      id:           `demo_cert_${emp.id}_${i}`,
      userId:       emp.id || emp.employee_id,
      name:         n.name,
      issuer:       n.issuer,
      category:     n.category,
      acquiredDate: acq.toISOString().slice(0,10),
      expiryDate:   exp.toISOString().slice(0,10),
      certNo:       `CERT-${1000 + i}`,
    });
  });
  return seeded;
}

function _seedEduDemo(edus) {
  if (edus.length >= 8) return edus;
  const seeded = [...edus];
  const eduNames = ['AWS 클라우드 기초', 'Python 데이터 분석', '리더십 역량 강화', 'Excel 고급 과정', '노무관리 실무'];
  _employees.slice(0, 8).forEach((emp, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (i % 6));
    seeded.push({
      id:           `demo_edu_${emp.id}`,
      userId:       emp.id || emp.employee_id,
      name:         eduNames[i % eduNames.length],
      provider:     ['패스트캠퍼스','인프런','HR아카데미','LinkedIn Learning'][i%4],
      date:         d.toISOString().slice(0,10),
      year:         d.getFullYear(),
      hours:        [8,16,24,4,12][i%5],
      type:         ['online','offline','workshop','online','conf'][i%5],
      refundAmt:    [0,50000,150000,0,80000][i%5],
      refundStatus: ['pending','approved','pending','approved','rejected'][i%5],
    });
  });
  return seeded;
}

let _tab = 'certs';
let _selectedEdu = null;

export async function mount(root) {
  _tab = 'certs'; _selectedEdu = null;
  root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">⏳</div><div style="font-size:13px">로딩 중…</div></div>`;
  _employees = await loadDisplayEmployees();
  _draw(root);
}

export function render(root) { _tab = 'certs'; _selectedEdu = null; _draw(root); }
export function unmount() { _tab = 'certs'; _selectedEdu = null; _employees = []; }

function _draw(root) {
  const rawCerts = _loadCerts();
  const certs    = _seedDemo(rawCerts);
  const rawEdus  = _loadEdus();
  const edus     = _seedEduDemo(rawEdus);

  const pendingRefunds = edus.filter(e => e.refundStatus === 'pending' && e.refundAmt > 0).length;

  root.innerHTML = `
<!-- 탭 -->
<div style="display:flex;border-bottom:1px solid var(--border);margin-bottom:14px">
  ${[
    { k:'certs', l:'자격증 현황' },
    { k:'edu',   l:`교육비 환급 ${pendingRefunds>0?`(${pendingRefunds})`:''}` },
  ].map(t=>`
    <button class="ca-tab" data-t="${t.k}"
      style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab===t.k?'#4F46E5':'transparent'};color:${_tab===t.k?'#4F46E5':'#64748B'}">
      ${t.l}
    </button>`).join('')}
</div>

${_tab === 'certs' ? _renderCerts(certs) : ''}
${_tab === 'edu'   ? _renderEdu(edus)   : ''}`;

  root.querySelectorAll('.ca-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _selectedEdu = null; _draw(root); });
  });

  root.querySelectorAll('.ca-edu-item').forEach(el => {
    el.addEventListener('click', () => {
      _selectedEdu = _selectedEdu === el.dataset.id ? null : el.dataset.id;
      _draw(root);
    });
  });

  if (_selectedEdu && _tab === 'edu') _bindRefundDetail(root);
}

function _renderCerts(certs) {
  const catCounts = {};
  certs.forEach(c => { catCounts[c.category] = (catCounts[c.category]||0) + 1; });

  const depts = [...new Set(_employees.map(e => e.department||e.dept||'기타'))].sort();
  const empWithCert = new Set(certs.map(c => c.userId));

  return `
<!-- KPI -->
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
    <div style="font-size:22px;font-weight:900;color:#4F46E5">${certs.length}</div>
    <div style="font-size:10px;color:#64748B">총 자격증</div>
  </div>
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
    <div style="font-size:22px;font-weight:900;color:#10B981">${empWithCert.size}</div>
    <div style="font-size:10px;color:#64748B">보유 직원</div>
  </div>
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
    <div style="font-size:22px;font-weight:900;color:#F59E0B">${certs.filter(c => { const d=(new Date(c.expiryDate)-new Date())/86400000; return d>=0&&d<90; }).length}</div>
    <div style="font-size:10px;color:#64748B">갱신 임박</div>
  </div>
</div>

<!-- 카테고리 분포 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:14px">
  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">카테고리 분포</div>
  ${Object.entries(catCounts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>{
    const cat = CERT_CATEGORIES[k] || { icon:'🎓', label:'기타' };
    const pct = Math.round(v / certs.length * 100);
    return `
<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
  <span style="font-size:14px;width:20px">${cat.icon}</span>
  <span style="font-size:11px;color:var(--text);width:72px">${cat.label}</span>
  <div style="flex:1;height:10px;background:#E2E8F0;border-radius:4px;overflow:hidden">
    <div style="height:100%;width:${pct}%;background:#4F46E5;border-radius:4px"></div>
  </div>
  <span style="font-size:11px;color:#64748B;width:28px;text-align:right">${v}개</span>
</div>`;
  }).join('')}
</div>

<!-- 부서별 보유 현황 -->
<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">부서별 현황</div>
${depts.map(dept => {
  const empIds = _employees.filter(e=>(e.department||e.dept||'기타')===dept).map(e=>e.id||e.employee_id);
  const dCerts = certs.filter(c => empIds.includes(c.userId));
  const withCert = new Set(dCerts.map(c=>c.userId)).size;
  const total = empIds.length;
  const pct = total ? Math.round(withCert/total*100) : 0;
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:6px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
    <span style="font-size:12px;font-weight:700;color:var(--text)">${dept}</span>
    <span style="font-size:12px;color:#4F46E5;font-weight:700">${dCerts.length}개</span>
  </div>
  <div style="height:6px;background:#E2E8F0;border-radius:3px;overflow:hidden">
    <div style="height:100%;width:${pct}%;background:#4F46E5;border-radius:3px"></div>
  </div>
  <div style="font-size:10px;color:#94A3B8;margin-top:3px">보유 직원 ${withCert}/${total}명 (${pct}%)</div>
</div>`;
}).join('')}`;
}

function _renderEdu(edus) {
  const pending = edus.filter(e => e.refundStatus === 'pending' && e.refundAmt > 0);
  const total   = edus.reduce((s,e) => s + (e.refundAmt||0), 0);
  const approved= edus.filter(e=>e.refundStatus==='approved').reduce((s,e)=>s+(e.refundAmt||0),0);

  return `
<!-- KPI -->
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
    <div style="font-size:18px;font-weight:900;color:#F59E0B">${pending.length}</div>
    <div style="font-size:10px;color:#64748B">검토 대기</div>
  </div>
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
    <div style="font-size:14px;font-weight:900;color:#10B981">${approved.toLocaleString()}원</div>
    <div style="font-size:10px;color:#64748B">승인 합계</div>
  </div>
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
    <div style="font-size:14px;font-weight:900;color:#4F46E5">${edus.length}</div>
    <div style="font-size:10px;color:#64748B">총 이수 건</div>
  </div>
</div>

${edus.slice().reverse().map(e => {
  const emp = _emp(e.userId);
  const refMeta = e.refundAmt > 0 ? (REFUND_META[e.refundStatus] || REFUND_META.pending) : null;
  const isSelected = _selectedEdu === e.id;
  return `
<div class="ca-edu-item" data-id="${e.id}"
  style="background:var(--card-bg);border:1px solid ${isSelected?'#4F46E5':'var(--border)'};
         border-radius:11px;padding:12px;margin-bottom:6px;cursor:pointer">
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <div style="font-size:13px;font-weight:700;color:var(--text)">${e.name}</div>
      <div style="font-size:11px;color:#64748B">${emp?emp.name:e.userId} · ${e.date||''}</div>
    </div>
    ${e.refundAmt > 0 ? `<div style="text-align:right">
      <div style="font-size:13px;font-weight:800;color:#4F46E5">${(e.refundAmt||0).toLocaleString()}원</div>
      ${refMeta ? `<span style="padding:2px 7px;border-radius:5px;font-size:10px;font-weight:600;background:${refMeta.bg};color:${refMeta.color}">${refMeta.label}</span>` : ''}
    </div>` : ''}
  </div>
  ${isSelected && e.refundAmt > 0 && e.refundStatus === 'pending' ? `
  <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;gap:8px">
    <button id="ca-approve-${e.id}" style="flex:1;padding:8px;background:#10B981;color:#fff;border:none;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer">✅ 승인</button>
    <button id="ca-reject-${e.id}"  style="flex:1;padding:8px;background:#EF4444;color:#fff;border:none;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer">❌ 반려</button>
  </div>` : ''}
</div>`;
}).join('')}`;
}

function _bindRefundDetail(root) {
  const all = _seedEduDemo(_loadEdus());
  all.forEach(e => {
    const approveBtn = root.querySelector(`#ca-approve-${e.id}`);
    const rejectBtn  = root.querySelector(`#ca-reject-${e.id}`);
    if (approveBtn) approveBtn.addEventListener('click', ev => { ev.stopPropagation(); _updateRefund(e.id, 'approved', root); });
    if (rejectBtn)  rejectBtn.addEventListener('click',  ev => { ev.stopPropagation(); _updateRefund(e.id, 'rejected', root); });
  });
}

function _updateRefund(id, status, root) {
  const edus = _loadEdus();
  const idx  = edus.findIndex(e => e.id === id);
  if (idx < 0) { showToast('데모 데이터는 수정할 수 없습니다.', 'error'); _selectedEdu = null; _draw(root); return; }
  edus[idx].refundStatus = status;
  edus[idx].processedAt  = new Date().toISOString();
  _saveEdus(edus);
  showToast(status === 'approved' ? '환급 신청이 승인되었습니다.' : '환급 신청이 반려되었습니다.');
      addNotification({ type: 'success', title: '자격증 관리', body: status === 'approved' ? '환급 신청이 승인되었습니다.' : '환급 신청이 반려되었습니다.' });
  const edu = edus[idx];
  if (edu?.empId) addNotificationForUser(edu.empId, { type: status === 'approved' ? 'success' : 'error', title: status === 'approved' ? '자격증 환급 승인' : '자격증 환급 반려', body: status === 'approved' ? '자격증 교육비 환급 신청이 승인되었습니다.' : '자격증 교육비 환급 신청이 반려되었습니다.', route: '#/certification' });
  _selectedEdu = null;
  _draw(root);
}
