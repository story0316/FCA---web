/**
 * id-card.js — 사원증 재발급 신청 (직원용)
 * Route: #/id-card
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_id_card_requests';

const REASON_TYPES = {
  lost:        '분실',
  damaged:     '훼손',
  info_change: '정보변경',
  new_issue:   '신규발급',
};

const REASON_ICON = {
  lost: '🔍', damaged: '💔', info_change: '✏️', new_issue: '🆕',
};

const STATUS_META = {
  pending:    { label: '신청 완료', color: '#D97706', bg: '#FEF3C7', dot: '#F59E0B' },
  processing: { label: '처리 중',  color: '#4F46E5', bg: '#EEF2FF', dot: '#6366F1' },
  completed:  { label: '발급 완료', color: '#059669', bg: '#D1FAE5', dot: '#10B981' },
};

function _demoIdCards() {
  const uid = _uid(); const name = _uname(); const dept = _udept();
  return [
    { id: `idc_${uid}_1`, empId: uid, empName: name, dept, reason: 'lost', note: '지하철에서 분실한 것으로 추정됩니다.', status: 'completed', reqDate: '2026-04-15', completedDate: '2026-04-18' },
    { id: `idc_${uid}_2`, empId: uid, empName: name, dept, reason: 'info_change', note: '부서 이동으로 인한 정보 변경 요청', status: 'processing', reqDate: '2026-06-01', completedDate: null },
  ];
}

function _load() {
  const demo = _demoIdCards();
  try {
    const saved = JSON.parse(localStorage.getItem(LS) || '[]');
    if (!saved || !saved.length) return [...demo];
    return [...demo.filter(d => !saved.find(x => x.id === d.id)), ...saved];
  } catch { return [...demo]; }
}
function _save(list) { localStorage.setItem(LS, JSON.stringify(list)); }
function _uid()  { try { return JSON.parse(localStorage.getItem('hr_session') || '{}').empId  || 'EMP001'; } catch { return 'EMP001'; } }
function _uname(){ try { return JSON.parse(localStorage.getItem('hr_session') || '{}').name   || '사용자'; } catch { return '사용자'; } }
function _udept(){ try { return JSON.parse(localStorage.getItem('hr_session') || '{}').dept   || '소속 미지정'; } catch { return '소속 미지정'; } }
function _today(){ return new Date().toISOString().slice(0, 10); }

let _tab = 'apply';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'apply';
  _draw(root);
}

export function unmount() { _tab = 'apply'; }

function _draw(root) {
  const uid  = _uid();
  const mine = _load().filter(r => r.empId === uid).sort((a, b) => b.reqDate.localeCompare(a.reqDate));

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="idc-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🪪 사원증 재발급</div>
      <div style="font-size:11px;color:var(--text-muted)">신청 내역 ${mine.length}건</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['apply','신청하기'],['history','신청 내역']].map(([k,l]) => `
    <button class="idc-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab === 'apply' ? _renderApply() : _renderHistory(mine)}
  </div>
</div>`;

  root.querySelector('#idc-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.idc-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(root); }));

  if (_tab === 'apply') {
    root.querySelector('#idc-submit-btn')?.addEventListener('click', () => _handleSubmit(root, uid));
  }
}

function _renderApply() {
  return `
<div style="background:#FEF3C7;border:1px solid #FCD34D;border-radius:12px;padding:12px;margin-bottom:14px;font-size:12px;color:#92400E">
  ⏱️ <strong>처리 기간: 3~5 영업일</strong> (분실의 경우 보안팀 확인 후 처리)
</div>

<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:6px">신청 사유 <span style="color:#EF4444">*</span></label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${Object.entries(REASON_TYPES).map(([k,v], i) => `
      <label class="idc-reason-label" style="display:flex;align-items:center;gap:8px;padding:12px;
             border:2px solid var(--border);border-radius:10px;cursor:pointer;background:var(--bg)">
        <input type="radio" name="idc-reason" value="${k}"
          style="accent-color:#4F46E5" ${i===0?'checked':''}>
        <div>
          <div style="font-size:16px">${REASON_ICON[k] || '📋'}</div>
          <div style="font-size:12px;font-weight:600;color:var(--text)">${v}</div>
        </div>
      </label>`).join('')}
    </div>
  </div>

  <div style="margin-bottom:16px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">비고 (선택)</label>
    <textarea maxlength="500" id="idc-note" placeholder="분실 경위, 훼손 상태 등을 간략히 기재해 주세요"
      style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);
             border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);
             height:80px;resize:vertical"></textarea>
  </div>

  <button id="idc-submit-btn"
    style="width:100%;background:#4F46E5;color:#fff;border:none;border-radius:12px;
           padding:13px;font-size:14px;font-weight:700;cursor:pointer">신청하기</button>
</div>`;
}

function _renderHistory(mine) {
  if (!mine.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:48px;margin-bottom:12px">🪪</div>
  <div style="font-size:15px;font-weight:600;margin-bottom:6px">신청 내역이 없어요</div>
  <div style="font-size:13px;margin-bottom:14px">사원증 재발급이 필요하시면 신청해 주세요.</div>
  <button onclick="document.querySelector('[data-tab=apply]')?.click()" style="padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">사원증 신청</button>
</div>`;

  const STEPS = ['pending', 'processing', 'completed'];
  const STEP_LABEL = { pending: '신청', processing: '처리 중', completed: '발급 완료' };

  return mine.map(r => {
    const s    = STATUS_META[r.status] || STATUS_META.pending;
    const curStepIdx = STEPS.indexOf(r.status);

    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:22px">${REASON_ICON[r.reason] || '📋'}</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${REASON_TYPES[r.reason] || r.reason}</div>
        <div style="font-size:11px;color:var(--text-muted)">신청일 ${r.reqDate}</div>
      </div>
    </div>
    <span style="flex-shrink:0;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:600;
      background:${s.bg};color:${s.color}">${s.label}</span>
  </div>

  ${r.note ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;line-height:1.4">${r.note}</div>` : ''}

  <div style="display:flex;align-items:center;gap:0">
    ${STEPS.map((step, i) => {
      const done   = i <= curStepIdx;
      const active = i === curStepIdx;
      const dotColor = done ? s.dot : '#E2E8F0';
      return `
      <div style="display:flex;align-items:center;flex:1">
        <div style="display:flex;flex-direction:column;align-items:center;flex:1">
          <div style="width:${active?14:10}px;height:${active?14:10}px;border-radius:50%;
               background:${dotColor};border:2px solid ${done?s.dot:'#E2E8F0'};
               transition:all 0.2s"></div>
          <div style="font-size:9px;color:${done?s.color:'var(--text-muted)'};margin-top:3px;font-weight:${active?700:400}">
            ${STEP_LABEL[step]}
          </div>
        </div>
        ${i < STEPS.length-1 ? `<div style="flex:1;height:2px;background:${i<curStepIdx?s.dot:'#E2E8F0'};margin-bottom:14px"></div>` : ''}
      </div>`;
    }).join('')}
  </div>

  ${r.completedDate ? `<div style="font-size:11px;color:#059669;margin-top:8px;text-align:center">✓ ${r.completedDate} 발급 완료</div>` : ''}
</div>`;
  }).join('');
}

function _handleSubmit(root, uid) {
  const reasonEl = root.querySelector('input[name="idc-reason"]:checked');
  const reason   = reasonEl?.value;
  const note     = root.querySelector('#idc-note')?.value.trim();

  if (!reason) { showToast('신청 사유를 선택해 주세요.', 'error'); return; }

  const all = _load();
  const pending = all.find(r => r.empId === uid && (r.status === 'pending' || r.status === 'processing'));
  if (pending) { showToast('이미 처리 중인 신청이 있습니다.', 'warning'); return; }

  const newItem = {
    id: 'idc_' + Date.now(),
    empId: uid, empName: _uname(), dept: _udept(),
    reason, note,
    status: 'pending', reqDate: _today(), completedDate: null,
  };
  _save([...all.filter(x => !_demoIdCards().find(d => d.id === x.id)), newItem]);
  showToast('사원증 재발급이 신청되었습니다. 3~5 영업일 내 처리됩니다.', 'success')
    addNotification({ type: 'success', title: '사원증 신청', body: '사원증 재발급이 신청되었습니다. 3~5 영업일 내 처리됩니다.' });
  _tab = 'history';
  _draw(root);
}
