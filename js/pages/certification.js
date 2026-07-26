/**
 * certification.js — 자격증 & 외부 교육 관리
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

const LS_CERTS  = 'hr_certifications';
const LS_EDULOG = 'hr_edu_logs';

const CERT_CATEGORIES = [
  { key: 'it',       label: 'IT / 기술',     icon: '💻' },
  { key: 'finance',  label: '재무 / 회계',   icon: '📊' },
  { key: 'hr',       label: 'HR / 노무',     icon: '👥' },
  { key: 'language', label: '어학',           icon: '🌐' },
  { key: 'pm',       label: '프로젝트 관리', icon: '📋' },
  { key: 'safety',   label: '안전 / 보건',   icon: '🦺' },
  { key: 'other',    label: '기타',           icon: '🎓' },
];

const EDU_TYPES = [
  { key: 'online',    label: '온라인 강의' },
  { key: 'offline',   label: '오프라인 교육' },
  { key: 'workshop',  label: '워크숍 / 세미나' },
  { key: 'conf',      label: '컨퍼런스' },
  { key: 'book',      label: '도서 구매' },
];

const REFUND_LIMIT = 300000; // 연간 30만원 한도

function _loadCerts()  { try { return JSON.parse(localStorage.getItem(LS_CERTS)  || '[]'); } catch { return []; } }
function _loadEdus()   { try { return JSON.parse(localStorage.getItem(LS_EDULOG) || '[]'); } catch { return []; } }
function _saveCerts(d) { localStorage.setItem(LS_CERTS,  JSON.stringify(d)); }
function _saveEdus(d)  { localStorage.setItem(LS_EDULOG, JSON.stringify(d)); }
function _uid()        { return 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2,5); }

const STATUS_META = {
  active:   { label: '유효',     bg: '#D1FAE5', color: '#059669' },
  expiring: { label: '갱신 임박', bg: '#FEF3C7', color: '#D97706' },
  expired:  { label: '만료',     bg: '#FEE2E2', color: '#EF4444' },
};
const REFUND_META = {
  pending:  { label: '검토 중',  bg: '#FEF3C7', color: '#D97706' },
  approved: { label: '승인',     bg: '#D1FAE5', color: '#059669' },
  rejected: { label: '반려',     bg: '#FEE2E2', color: '#EF4444' },
};

let _tab = 'certs';
let _showCertForm = false;
let _showEduForm  = false;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'certs'; _showCertForm = false; _showEduForm = false;
  _draw(root);
}
export function unmount() { _tab = 'certs';}

function _draw(root) {
  const user = getUser();
  const uid  = user?.id || user?.employee_id || 'demo';
  const certs = _loadCerts().filter(c => c.userId === uid);
  const edus  = _loadEdus().filter(e => e.userId === uid);

  const thisYear = new Date().getFullYear();
  const usedRefund = edus
    .filter(e => e.year === thisYear && (e.refundStatus === 'approved' || e.refundStatus === 'pending'))
    .reduce((s,e) => s + (e.refundAmt || 0), 0);

  root.innerHTML = `
<div class="page-content" style="padding:16px;max-width:480px;margin:0 auto">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button onclick="window.navBack()" style="background:none;border:none;font-size:20px;cursor:pointer;padding:0">←</button>
    <div>
      <div style="font-size:17px;font-weight:800;color:var(--text)">자격증 & 교육 이수</div>
      <div style="font-size:11px;color:var(--text-muted)">올해 환급 ${usedRefund.toLocaleString()}원 / ${REFUND_LIMIT.toLocaleString()}원</div>
    </div>
  </div>

  <!-- 탭 -->
  <div style="display:flex;background:#F1F5F9;border-radius:10px;padding:3px;margin-bottom:16px">
    ${[{k:'certs',l:`자격증 (${certs.length})`},{k:'edu',l:`교육 이수 (${edus.length})`}].map(t=>`
      <button class="cf-tab" data-t="${t.k}"
        style="flex:1;padding:8px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;
               background:${_tab===t.k?'#fff':'transparent'};color:${_tab===t.k?'#4F46E5':'var(--text-muted)'};
               box-shadow:${_tab===t.k?'0 1px 4px rgba(0,0,0,0.1)':'none'}">
        ${t.l}
      </button>`).join('')}
  </div>

  ${_tab === 'certs' ? _renderCerts(certs) : ''}
  ${_tab === 'edu'   ? _renderEdus(edus, usedRefund) : ''}
</div>`;

  root.querySelectorAll('.cf-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _showCertForm = false; _showEduForm = false; _draw(root); });
  });

  root.querySelector('#cf-add-cert')?.addEventListener('click', () => { _showCertForm = !_showCertForm; _draw(root); });
  root.querySelector('#cf-add-edu')?.addEventListener('click',  () => { _showEduForm  = !_showEduForm;  _draw(root); });

  if (_showCertForm) _bindCertForm(root, uid);
  if (_showEduForm)  _bindEduForm(root, uid);

  root.querySelectorAll('.cf-del-cert').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); _deleteCert(btn.dataset.id, root); });
  });
}

function _certStatus(expiryDate) {
  if (!expiryDate) return 'active';
  const diff = (new Date(expiryDate) - new Date()) / 86400000;
  if (diff < 0)   return 'expired';
  if (diff < 90)  return 'expiring';
  return 'active';
}

function _renderCerts(certs) {
  return `
<button id="cf-add-cert" style="width:100%;padding:11px;border:2px dashed #C7D2FE;border-radius:10px;background:#EEF2FF;
  color:#4F46E5;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:12px">
  + 자격증 등록
</button>

${_showCertForm ? _renderCertForm() : ''}

${certs.length === 0 && !_showCertForm ? `
<div style="text-align:center;padding:32px 16px;color:var(--text-muted)">
  <div style="font-size:32px;margin-bottom:8px">🎓</div>
  <div style="font-size:13px">등록된 자격증이 없습니다</div>
  <div style="font-size:11px;margin-top:4px">위 버튼으로 자격증을 추가해 보세요</div>
</div>` : ''}

${certs.map(c => {
  const cat = CERT_CATEGORIES.find(x => x.key === c.category) || { icon:'🎓', label:'기타' };
  const st  = _certStatus(c.expiryDate);
  const meta= STATUS_META[st];
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px;position:relative">
  <button class="cf-del-cert" data-id="${c.id}"
    style="position:absolute;top:10px;right:10px;background:none;border:none;font-size:16px;cursor:pointer;color:var(--text-muted)">✕</button>
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
    <span style="font-size:24px">${cat.icon}</span>
    <div>
      <div style="font-size:13px;font-weight:700;color:var(--text)">${c.name}</div>
      <div style="font-size:11px;color:var(--text-muted)">${c.issuer || ''} · 취득 ${c.acquiredDate || '-'}</div>
    </div>
  </div>
  <div style="display:flex;gap:6px;flex-wrap:wrap">
    <span style="padding:2px 8px;background:#EFF6FF;border-radius:5px;font-size:11px;color:#3B82F6">${cat.label}</span>
    <span style="padding:2px 8px;border-radius:5px;font-size:11px;font-weight:600;background:${meta.bg};color:${meta.color}">${meta.label}</span>
    ${c.expiryDate ? `<span style="font-size:11px;color:var(--text-muted)">만료 ${c.expiryDate}</span>` : ''}
    ${c.certNo ? `<span style="font-size:11px;color:var(--text-muted)">No. ${c.certNo}</span>` : ''}
  </div>
</div>`;
}).join('')}`;
}

function _renderCertForm() {
  return `
<div style="background:#F8FAFC;border:1px solid #C7D2FE;border-radius:12px;padding:14px;margin-bottom:12px">
  <div style="font-size:12px;font-weight:700;color:#4F46E5;margin-bottom:10px">자격증 정보 입력</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
    <div style="grid-column:1/-1">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">자격증 명 <span style="color:#EF4444">*</span></div>
      <input id="cf-cname" type="text" placeholder="예: 정보처리기사"
        style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">발급 기관</div>
      <input id="cf-issuer" type="text" placeholder="발급 기관"
        style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">자격증 번호</div>
      <input id="cf-certno" type="text" placeholder="선택"
        style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">취득일 <span style="color:#EF4444">*</span></div>
      <input id="cf-acquired" type="date"
        style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">만료일</div>
      <input id="cf-expiry" type="date"
        style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">카테고리</div>
      <select id="cf-cat" style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text)">
        ${CERT_CATEGORIES.map(c=>`<option value="${c.key}">${c.icon} ${c.label}</option>`).join('')}
      </select>
    </div>
  </div>
  <div style="display:flex;gap:8px">
    <button id="cf-cert-cancel" style="flex:1;padding:9px;border:1px solid var(--border);border-radius:8px;background:var(--card-bg);color:var(--text-muted);font-size:12px;cursor:pointer">취소</button>
    <button id="cf-cert-save"   style="flex:2;padding:9px;border:none;border-radius:8px;background:#4F46E5;color:#fff;font-size:12px;font-weight:700;cursor:pointer">저장</button>
  </div>
</div>`;
}

function _renderEdus(edus, usedRefund) {
  const remaining = Math.max(0, REFUND_LIMIT - usedRefund);
  return `
<!-- 환급 잔액 게이지 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:12px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
    <span style="font-size:12px;font-weight:700;color:var(--text)">올해 교육비 환급 잔액</span>
    <span style="font-size:12px;color:#4F46E5;font-weight:700">${remaining.toLocaleString()}원 남음</span>
  </div>
  <div style="height:8px;background:#E2E8F0;border-radius:4px;overflow:hidden">
    <div style="height:100%;width:${Math.min(100,(usedRefund/REFUND_LIMIT*100)).toFixed(0)}%;background:${usedRefund>=REFUND_LIMIT?'#EF4444':'#4F46E5'};border-radius:4px"></div>
  </div>
  <div style="font-size:10px;color:var(--text-muted);margin-top:4px">사용 ${usedRefund.toLocaleString()}원 / 한도 ${REFUND_LIMIT.toLocaleString()}원</div>
</div>

<button id="cf-add-edu" style="width:100%;padding:11px;border:2px dashed #C7D2FE;border-radius:10px;background:#EEF2FF;
  color:#4F46E5;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:12px">
  + 교육 이수 등록
</button>

${_showEduForm ? _renderEduForm() : ''}

${edus.length === 0 && !_showEduForm ? `
<div style="text-align:center;padding:32px 16px;color:var(--text-muted)">
  <div style="font-size:32px;margin-bottom:8px">📚</div>
  <div style="font-size:13px">등록된 교육 이수 기록이 없습니다</div>
</div>` : ''}

${edus.slice().reverse().map(e => {
  const type = EDU_TYPES.find(t => t.key === e.type) || { label: e.type };
  const refMeta = e.refundAmt > 0 ? (REFUND_META[e.refundStatus] || REFUND_META.pending) : null;
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div>
      <div style="font-size:13px;font-weight:700;color:var(--text)">${e.name}</div>
      <div style="font-size:11px;color:var(--text-muted)">${e.provider || ''} · ${e.date || ''}</div>
    </div>
    ${e.refundAmt > 0 ? `<span style="font-size:13px;font-weight:800;color:#4F46E5">${e.refundAmt.toLocaleString()}원</span>` : ''}
  </div>
  <div style="display:flex;gap:6px;flex-wrap:wrap">
    <span style="padding:2px 8px;background:#F1F5F9;border-radius:5px;font-size:11px;color:var(--text-muted)">${type.label}</span>
    ${e.hours ? `<span style="font-size:11px;color:var(--text-muted)">${e.hours}시간</span>` : ''}
    ${refMeta ? `<span style="padding:2px 7px;border-radius:5px;font-size:11px;font-weight:600;background:${refMeta.bg};color:${refMeta.color}">환급 ${refMeta.label}</span>` : ''}
  </div>
</div>`;
}).join('')}`;
}

function _renderEduForm() {
  return `
<div style="background:#F8FAFC;border:1px solid #C7D2FE;border-radius:12px;padding:14px;margin-bottom:12px">
  <div style="font-size:12px;font-weight:700;color:#4F46E5;margin-bottom:10px">교육 이수 기록</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
    <div style="grid-column:1/-1">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">교육명 <span style="color:#EF4444">*</span></div>
      <input id="cf-ename" type="text" placeholder="예: AWS Solutions Architect"
        style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">교육 기관</div>
      <input id="cf-provider" type="text" placeholder="기관명"
        style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">이수일 <span style="color:#EF4444">*</span></div>
      <input id="cf-edate" type="date"
        style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">이수 시간</div>
      <input id="cf-hours" type="number" min="0" placeholder="시간"
        style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">유형</div>
      <select id="cf-etype" style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text)">
        ${EDU_TYPES.map(t=>`<option value="${t.key}">${t.label}</option>`).join('')}
      </select>
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">환급 신청 금액 (원)</div>
      <input id="cf-refund" type="number" min="0" placeholder="0"
        style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
  </div>
  <div style="display:flex;gap:8px">
    <button id="cf-edu-cancel" style="flex:1;padding:9px;border:1px solid var(--border);border-radius:8px;background:var(--card-bg);color:var(--text-muted);font-size:12px;cursor:pointer">취소</button>
    <button id="cf-edu-save"   style="flex:2;padding:9px;border:none;border-radius:8px;background:#4F46E5;color:#fff;font-size:12px;font-weight:700;cursor:pointer">저장</button>
  </div>
</div>`;
}

function _bindCertForm(root, uid) {
  root.querySelector('#cf-cert-cancel')?.addEventListener('click', () => { _showCertForm = false; _draw(root); });
  root.querySelector('#cf-cert-save')?.addEventListener('click', () => {
    const name = root.querySelector('#cf-cname')?.value.trim();
    const acq  = root.querySelector('#cf-acquired')?.value;
    if (!name) { showToast('자격증 명을 입력해 주세요.', 'error'); return; }
    if (!acq)  { showToast('취득일을 입력해 주세요.', 'error'); return; }
    const certs = _loadCerts();
    certs.push({
      id:           _uid(),
      userId:       uid,
      name,
      issuer:       root.querySelector('#cf-issuer')?.value.trim() || '',
      certNo:       root.querySelector('#cf-certno')?.value.trim() || '',
      acquiredDate: acq,
      expiryDate:   root.querySelector('#cf-expiry')?.value || '',
      category:     root.querySelector('#cf-cat')?.value || 'other',
      createdAt:    new Date().toISOString(),
    });
    _saveCerts(certs);
    showToast('자격증이 등록되었습니다.');
    addNotification({ type: 'success', title: '자격증 관리', body: '자격증이 등록되었습니다.' });
    _showCertForm = false;
    _draw(root);
  });
}

function _bindEduForm(root, uid) {
  root.querySelector('#cf-edu-cancel')?.addEventListener('click', () => { _showEduForm = false; _draw(root); });
  root.querySelector('#cf-edu-save')?.addEventListener('click', () => {
    const name = root.querySelector('#cf-ename')?.value.trim();
    const date = root.querySelector('#cf-edate')?.value;
    if (!name) { showToast('교육명을 입력해 주세요.', 'error'); return; }
    if (!date) { showToast('이수일을 입력해 주세요.', 'error'); return; }
    const refundAmt = parseInt(root.querySelector('#cf-refund')?.value || '0') || 0;
    const edus = _loadEdus();
    edus.push({
      id:           _uid(),
      userId:       uid,
      name,
      provider:     root.querySelector('#cf-provider')?.value.trim() || '',
      date,
      year:         new Date(date).getFullYear(),
      hours:        parseInt(root.querySelector('#cf-hours')?.value || '0') || 0,
      type:         root.querySelector('#cf-etype')?.value || 'online',
      refundAmt,
      refundStatus: refundAmt > 0 ? 'pending' : null,
      createdAt:    new Date().toISOString(),
    });
    _saveEdus(edus);
    const eduMsg = refundAmt > 0 ? '교육 이수 기록 및 환급 신청이 제출되었습니다.' : '교육 이수 기록이 저장되었습니다.';
    showToast(eduMsg);
    addNotification({ type: 'success', title: '교육 이수', body: eduMsg });
    _showEduForm = false;
    _draw(root);
  });
}

function _deleteCert(id, root) {
  if (!confirm('자격증을 삭제하시겠습니까?')) return;
  const certs = _loadCerts().filter(c => c.id !== id);
  _saveCerts(certs);
  showToast('삭제되었습니다.');
  addNotification({ type: 'info', title: '자격증 관리', body: '삭제되었습니다.' });
  _draw(root);
}
