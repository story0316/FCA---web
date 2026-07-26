/**
 * salary-raise-request.js — 연봉 인상 요청
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

const LS = 'hr_salary_raise_requests';

const REASONS = [
  { key: 'performance', label: '우수한 성과', icon: '🏆' },
  { key: 'market',      label: '시장 대비 낮은 급여', icon: '📊' },
  { key: 'role',        label: '직무 범위 확대', icon: '📈' },
  { key: 'tenure',      label: '장기 근속', icon: '⏳' },
  { key: 'skill',       label: '전문 역량 향상', icon: '🎓' },
  { key: 'other',       label: '기타', icon: '💬' },
];

const STATUS_META = {
  draft:     { label: '임시저장',  bg: '#F1F5F9', color: 'var(--text-muted)' },
  pending:   { label: '검토 중',   bg: '#FEF3C7', color: '#D97706' },
  approved:  { label: '승인',      bg: '#D1FAE5', color: '#059669' },
  negotiating:{ label: '협의 중', bg: '#EFF6FF', color: '#3B82F6' },
  rejected:  { label: '반려',      bg: '#FEE2E2', color: '#EF4444' },
};

// 데모 급여 데이터 (레벨별)
const DEMO_SALARY = {
  '사원': 3200, '주임': 3600, '대리': 4200, '과장': 5000,
  '차장': 5800, '부장': 6800, '이사': 8500,
};

function _load()    { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } }
function _save(d)   { localStorage.setItem(LS, JSON.stringify(d)); }
function _id()      { return 'srr_' + Date.now() + '_' + Math.random().toString(36).slice(2,5); }

let _tab = 'form';
let _reasons = [];
let _form = { currentSalary: '', targetSalary: '', detail: '', achievements: '' };

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'form'; _reasons = [];
  const user = getUser();
  const pos  = user?.position || user?.role || '대리';
  const base = DEMO_SALARY[pos] || 4200;
  _form = { currentSalary: String(base * 10000), targetSalary: '', detail: '', achievements: '' };
  _draw(root);
}
export function unmount() { _tab = 'form';}

function _draw(root) {
  const user = getUser();
  const uid  = user?.id || user?.employee_id || 'demo';
  const all  = _load().filter(r => r.userId === uid);
  const hasPending = all.some(r => r.status === 'pending' || r.status === 'negotiating');

  root.innerHTML = `
<div class="page-content" style="padding:16px;max-width:480px;margin:0 auto">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button onclick="window.navBack()" style="background:none;border:none;font-size:20px;cursor:pointer;padding:0">←</button>
    <div>
      <div style="font-size:17px;font-weight:800;color:var(--text)">연봉 인상 요청</div>
      <div style="font-size:11px;color:var(--text-muted)">${hasPending ? '검토 중인 요청이 있습니다' : '연 1회 제출 가능'}</div>
    </div>
  </div>

  <div style="display:flex;background:#F1F5F9;border-radius:10px;padding:3px;margin-bottom:16px">
    ${[{k:'form',l:'요청서 작성'},{k:'history',l:`내 이력 (${all.length})`}].map(t=>`
      <button class="srr-tab" data-t="${t.k}"
        style="flex:1;padding:8px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;
               background:${_tab===t.k?'#fff':'transparent'};color:${_tab===t.k?'#4F46E5':'var(--text-muted)'};
               box-shadow:${_tab===t.k?'0 1px 4px rgba(0,0,0,0.1)':'none'}">
        ${t.l}
      </button>`).join('')}
  </div>

  ${_tab === 'form'    ? _renderForm(user, hasPending) : ''}
  ${_tab === 'history' ? _renderHistory(all)           : ''}
</div>`;

  root.querySelectorAll('.srr-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _draw(root); });
  });

  if (_tab === 'form' && !hasPending) _bindForm(root, uid, user);
}

function _renderForm(user, hasPending) {
  const pos = user?.position || user?.role || '대리';
  const dept= user?.department || user?.dept || '소속팀';
  const cur = parseInt(_form.currentSalary) || 0;
  const tgt = parseInt(_form.targetSalary)  || 0;
  const diff= tgt - cur;
  const pct = cur > 0 && tgt > cur ? ((diff / cur) * 100).toFixed(1) : null;

  if (hasPending) return `
<div style="text-align:center;padding:32px 16px">
  <div style="font-size:40px;margin-bottom:12px">⏳</div>
  <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px">검토 중인 요청이 있습니다</div>
  <div style="font-size:12px;color:var(--text-muted);line-height:1.6">기존 요청의 결과가 확정된 후<br>새로운 요청을 제출할 수 있습니다.</div>
  <button onclick="document.querySelector('[data-t=history]').click()"
    style="margin-top:16px;padding:10px 24px;border:none;border-radius:9px;background:#4F46E5;color:#fff;font-size:13px;font-weight:700;cursor:pointer">
    진행 현황 보기
  </button>
</div>`;

  return `
<!-- 현재 정보 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">현재 급여 정보</div>
  <div style="display:flex;justify-content:space-between">
    <div style="text-align:center">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">직급</div>
      <div style="font-size:14px;font-weight:700;color:var(--text)">${pos}</div>
    </div>
    <div style="text-align:center">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">소속</div>
      <div style="font-size:14px;font-weight:700;color:var(--text)">${dept}</div>
    </div>
    <div style="text-align:center">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">현재 연봉</div>
      <div style="font-size:14px;font-weight:800;color:#4F46E5">${(cur/10000).toFixed(0)}만원</div>
    </div>
  </div>
</div>

<!-- 인상 요청 이유 -->
<div style="margin-bottom:14px">
  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">인상 요청 이유 (복수 선택)</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
    ${REASONS.map(r => `
      <button class="srr-reason" data-key="${r.key}"
        style="padding:9px 8px;border:2px solid ${_reasons.includes(r.key)?'#4F46E5':'var(--border)'};
               border-radius:10px;background:${_reasons.includes(r.key)?'#EEF2FF':'var(--card-bg)'};
               cursor:pointer;display:flex;align-items:center;gap:7px">
        <span style="font-size:18px">${r.icon}</span>
        <span style="font-size:11px;font-weight:600;color:${_reasons.includes(r.key)?'#4F46E5':'var(--text-muted)'};text-align:left">${r.label}</span>
      </button>`).join('')}
  </div>
</div>

<!-- 희망 연봉 -->
<div style="margin-bottom:12px">
  <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">희망 연봉 (원) <span style="color:#EF4444">*</span></div>
  <input id="srr-target" type="number" min="0" placeholder="희망 연봉" value="${_form.targetSalary}"
    style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:14px;font-weight:700;text-align:center;background:var(--card-bg);color:var(--text)">
</div>

${pct ? `
<div style="background:${parseFloat(pct)>15?'#FEF2F2':parseFloat(pct)>8?'#FFFBEB':'#F0FDF4'};border-radius:10px;padding:10px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
  <span style="font-size:12px;color:var(--text-muted)">인상률</span>
  <span style="font-size:18px;font-weight:900;color:${parseFloat(pct)>15?'#EF4444':parseFloat(pct)>8?'#D97706':'#10B981'}">+${pct}%</span>
  <span style="font-size:12px;color:var(--text-muted)">+${(diff/10000).toFixed(0)}만원</span>
</div>` : ''}

<!-- 주요 실적 -->
<div style="margin-bottom:12px">
  <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">주요 실적·기여 (구체적으로)</div>
  <textarea maxlength="500" id="srr-achievements" rows="3" placeholder="예: Q1 매출 목표 130% 달성, 신규 프로세스 도입으로 업무 효율 30% 개선..."
    style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:12px;background:var(--card-bg);color:var(--text);resize:none">${_form.achievements}</textarea>
</div>

<!-- 추가 사유 -->
<div style="margin-bottom:16px">
  <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">추가 사유</div>
  <textarea maxlength="500" id="srr-detail" rows="2" placeholder="추가로 전달하고 싶은 내용"
    style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:12px;background:var(--card-bg);color:var(--text);resize:none">${_form.detail}</textarea>
</div>

<div style="display:flex;gap:8px">
  <button id="srr-draft"  style="flex:1;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--card-bg);color:var(--text-muted);font-size:13px;font-weight:600;cursor:pointer">임시저장</button>
  <button id="srr-submit" style="flex:2;padding:12px;border:none;border-radius:10px;background:#4F46E5;color:#fff;font-size:14px;font-weight:700;cursor:pointer">제출하기</button>
</div>`;
}

function _renderHistory(all) {
  if (!all.length) return `
<div style="text-align:center;padding:40px 16px;color:var(--text-muted)">
  <div style="font-size:32px;margin-bottom:8px">💰</div>
  <div style="font-size:13px;margin-bottom:4px">제출된 요청이 없습니다</div>
  <div style="font-size:11px;margin-bottom:12px">연봉 인상 요청을 작성해 보세요.</div>
  <button onclick="document.querySelector('[data-sr-tab=request]')?.click()"
    style="padding:8px 18px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">요청서 작성하기</button>
</div>`;

  return all.slice().reverse().map(r => {
    const meta = STATUS_META[r.status] || STATUS_META.pending;
    const pct  = r.currentSalary && r.targetSalary ? (((r.targetSalary - r.currentSalary) / r.currentSalary) * 100).toFixed(1) : null;
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div>
      <div style="font-size:11px;color:var(--text-muted)">${r.createdAt?.slice(0,10) || ''}</div>
      <div style="font-size:16px;font-weight:900;color:#4F46E5;margin-top:2px">
        ${r.targetSalary ? (r.targetSalary/10000).toFixed(0)+'만원' : '-'}
        ${pct ? `<span style="font-size:12px;color:var(--text-muted);font-weight:400"> (+${pct}%)</span>` : ''}
      </div>
    </div>
    <span style="padding:4px 10px;border-radius:7px;font-size:12px;font-weight:700;background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>
  ${r.reasons?.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
    ${r.reasons.map(k => { const rr = REASONS.find(x=>x.key===k); return rr ? `<span style="font-size:11px;padding:2px 7px;background:#EEF2FF;border-radius:5px;color:#4F46E5">${rr.icon} ${rr.label}</span>` : ''; }).join('')}
  </div>` : ''}
  ${r.adminComment ? `<div style="font-size:11px;color:${r.status==='rejected'?'#EF4444':'#059669'};padding-top:6px;border-top:1px solid var(--border)">💬 ${r.adminComment}</div>` : ''}
</div>`;
  }).join('');
}

function _bindForm(root, uid, user) {
  root.querySelectorAll('.srr-reason').forEach(btn => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.key;
      if (_reasons.includes(k)) _reasons = _reasons.filter(r => r !== k);
      else _reasons.push(k);
      _draw(root);
    });
  });

  const targetEl = root.querySelector('#srr-target');
  targetEl?.addEventListener('input', () => {
    _form.targetSalary = targetEl.value;
    _form.achievements = root.querySelector('#srr-achievements')?.value || '';
    _form.detail       = root.querySelector('#srr-detail')?.value       || '';
    _draw(root);
  });

  const sync = () => {
    _form.targetSalary = root.querySelector('#srr-target')?.value       || '';
    _form.achievements = root.querySelector('#srr-achievements')?.value || '';
    _form.detail       = root.querySelector('#srr-detail')?.value       || '';
  };

  const submit = (status) => {
    sync();
    if (status === 'pending' && !_form.targetSalary) { showToast('희망 연봉을 입력해 주세요.', 'error'); return; }
    if (status === 'pending' && parseInt(_form.targetSalary) <= parseInt(_form.currentSalary)) {
      showToast('희망 연봉이 현재 연봉보다 높아야 합니다.', 'error'); return;
    }
    if (status === 'pending' && !_reasons.length) { showToast('인상 요청 이유를 선택해 주세요.', 'error'); return; }
    const all = _load();
    all.push({
      id:            _id(), userId: uid,
      userName:      user?.name || uid,
      dept:          user?.department || user?.dept || '',
      position:      user?.position || user?.role || '',
      currentSalary: parseInt(_form.currentSalary) || 0,
      targetSalary:  parseInt(_form.targetSalary)  || 0,
      reasons:       [..._reasons],
      achievements:  _form.achievements,
      detail:        _form.detail,
      status,
      createdAt:     new Date().toISOString(),
    });
    _save(all);
    showToast(status === 'draft' ? '임시 저장되었습니다.' : '연봉 인상 요청이 제출되었습니다.');
    addNotification({ type: 'success', title: '연봉 인상 요청', body: status === 'draft' ? '임시 저장되었습니다.' : '연봉 인상 요청이 제출되었습니다.' });
    _reasons = [];
    _tab = 'history';
    _draw(root);
  };

  root.querySelector('#srr-draft')?.addEventListener('click',  () => submit('draft'));
  root.querySelector('#srr-submit')?.addEventListener('click', () => submit('pending'));
}
