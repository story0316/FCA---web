/**
 * employee-referral.js — 직원 추천 프로그램
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

const LS = 'hr_referrals';

const OPEN_POSITIONS = [
  { id: 'pos_001', title: '프론트엔드 개발자 (Senior)', dept: 'IT팀',     skills: ['React','TypeScript','CSS'] },
  { id: 'pos_002', title: '데이터 분석가',               dept: '데이터팀', skills: ['Python','SQL','Tableau'] },
  { id: 'pos_003', title: '영업 매니저',                  dept: '영업팀',   skills: ['B2B 영업','협상','CRM'] },
  { id: 'pos_004', title: 'HR 파트너',                    dept: 'HR팀',     skills: ['노무관리','채용','조직문화'] },
  { id: 'pos_005', title: '마케팅 플래너',                dept: '마케팅팀', skills: ['디지털마케팅','콘텐츠','SNS'] },
  { id: 'pos_006', title: '재무 회계 담당자',             dept: '재무팀',   skills: ['회계','세무','ERP'] },
];

const INCENTIVES = [
  { stage: '서류 통과',  amount: 100000,  icon: '📋' },
  { stage: '최종 합격',  amount: 500000,  icon: '🎉' },
  { stage: '3개월 재직', amount: 400000,  icon: '⭐' },
];

const STATUS_META = {
  submitted: { label: '접수',      bg: '#EFF6FF', color: '#3B82F6' },
  reviewing: { label: '검토 중',   bg: '#FEF3C7', color: '#D97706' },
  interview: { label: '면접',      bg: '#EDE9FE', color: '#7C3AED' },
  hired:     { label: '채용 완료', bg: '#D1FAE5', color: '#059669' },
  rejected:  { label: '불합격',    bg: '#FEE2E2', color: '#EF4444' },
  withdrawn: { label: '취소',      bg: '#F1F5F9', color: 'var(--text-muted)' },
};

function _load()  { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } }
function _save(d) { localStorage.setItem(LS, JSON.stringify(d)); }
function _id()    { return 'ref_' + Date.now() + '_' + Math.random().toString(36).slice(2,5); }

let _tab       = 'positions';
let _selPos    = null;
let _showForm  = false;
let _formPos   = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'positions'; _selPos = null; _showForm = false; _formPos = null;
  _draw(root);
}
export function unmount() { _tab = 'positions';}

function _draw(root) {
  const user = getUser();
  const uid  = user?.id || user?.employee_id || 'demo';
  const mine = _load().filter(r => r.referrerId === uid);
  const totalIncentive = mine.filter(r => r.incentivePaid)
    .reduce((s,r) => s + (r.incentiveAmount||0), 0);

  root.innerHTML = `
<div class="page-content" style="padding:16px;max-width:480px;margin:0 auto">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button onclick="window.navBack()" style="background:none;border:none;font-size:20px;cursor:pointer;padding:0">←</button>
    <div>
      <div style="font-size:17px;font-weight:800;color:var(--text)">직원 추천 프로그램</div>
      <div style="font-size:11px;color:var(--text-muted)">누적 인센티브 ${totalIncentive.toLocaleString()}원</div>
    </div>
  </div>

  <div style="display:flex;background:#F1F5F9;border-radius:10px;padding:3px;margin-bottom:16px">
    ${[{k:'positions',l:'채용 공고'},{k:'my-refs',l:`내 추천 (${mine.length})`},{k:'incentive',l:'인센티브'}].map(t=>`
      <button class="er-tab" data-t="${t.k}"
        style="flex:1;padding:7px 4px;border:none;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;
               background:${_tab===t.k?'#fff':'transparent'};color:${_tab===t.k?'#4F46E5':'var(--text-muted)'};
               box-shadow:${_tab===t.k?'0 1px 4px rgba(0,0,0,0.1)':'none'}">
        ${t.l}
      </button>`).join('')}
  </div>

  ${_tab === 'positions' ? _renderPositions() : ''}
  ${_tab === 'my-refs'   ? _renderMyRefs(mine) : ''}
  ${_tab === 'incentive' ? _renderIncentive(mine) : ''}
</div>`;

  root.querySelectorAll('.er-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _selPos = null; _showForm = false; _draw(root); });
  });

  root.querySelectorAll('.er-pos').forEach(el => {
    el.addEventListener('click', () => {
      _selPos = _selPos === el.dataset.id ? null : el.dataset.id;
      _showForm = false;
      _draw(root);
    });
  });

  root.querySelectorAll('.er-refer-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      _formPos = btn.dataset.id;
      _showForm = true;
      _selPos   = btn.dataset.id;
      _draw(root);
    });
  });

  if (_showForm) _bindForm(root, uid);
}

function _renderPositions() {
  return OPEN_POSITIONS.map(p => {
    const isSelected = _selPos === p.id;
    return `
<div class="er-pos" data-id="${p.id}"
  style="background:var(--card-bg);border:1px solid ${isSelected?'#4F46E5':'var(--border)'};
         border-radius:14px;padding:14px;margin-bottom:10px;cursor:pointer">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div>
      <div style="font-size:14px;font-weight:800;color:var(--text)">${p.title}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${p.dept}</div>
    </div>
    <span style="padding:3px 9px;background:#D1FAE5;border-radius:6px;font-size:11px;color:#059669;font-weight:600">모집 중</span>
  </div>
  <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:${isSelected?'12px':'0'}">
    ${p.skills.map(s=>`<span style="padding:2px 8px;background:#EEF2FF;border-radius:5px;font-size:11px;color:#4F46E5">${s}</span>`).join('')}
  </div>
  ${isSelected && !_showForm ? `
  <div style="border-top:1px solid var(--border);padding-top:10px">
    <div style="display:flex;gap:8px;margin-bottom:6px;font-size:11px;color:var(--text-muted)">
      <span>🎁 최종합격 인센티브:</span><strong style="color:#4F46E5">최대 100만원</strong>
    </div>
    <button class="er-refer-btn" data-id="${p.id}"
      style="width:100%;padding:11px;border:none;border-radius:9px;background:#4F46E5;color:#fff;font-size:13px;font-weight:700;cursor:pointer">
      🙋 지인 추천하기
    </button>
  </div>` : ''}
  ${isSelected && _showForm && _formPos === p.id ? _renderForm(p) : ''}
</div>`;
  }).join('');
}

function _renderForm(pos) {
  return `
<div style="border-top:1px solid var(--border);padding-top:12px">
  <div style="font-size:12px;font-weight:700;color:#4F46E5;margin-bottom:10px">추천 정보 입력</div>
  <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">추천인 이름 <span style="color:#EF4444">*</span></div>
        <input id="er-name" type="text" placeholder="홍길동"
          style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text)">
      </div>
      <div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">연락처 <span style="color:#EF4444">*</span></div>
        <input id="er-phone" type="tel" placeholder="010-0000-0000"
          style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text)">
      </div>
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">이메일</div>
      <input id="er-email" type="email" placeholder="example@email.com"
        style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--card-bg);color:var(--text)">
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">관계 및 추천 사유</div>
      <textarea maxlength="500" id="er-reason" rows="2" placeholder="예: 전 직장 동료, 해당 직무 3년 경험 보유..."
        style="width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border);border-radius:7px;font-size:12px;background:var(--card-bg);color:var(--text);resize:none"></textarea>
    </div>
  </div>
  <div style="display:flex;gap:8px">
    <button id="er-form-cancel" style="flex:1;padding:9px;border:1px solid var(--border);border-radius:8px;background:var(--card-bg);color:var(--text-muted);font-size:12px;cursor:pointer">취소</button>
    <button id="er-form-submit" style="flex:2;padding:9px;border:none;border-radius:8px;background:#4F46E5;color:#fff;font-size:12px;font-weight:700;cursor:pointer">추천 제출</button>
  </div>
</div>`;
}

function _renderMyRefs(mine) {
  if (!mine.length) return `
<div style="text-align:center;padding:40px 16px;color:var(--text-muted)">
  <div style="font-size:32px;margin-bottom:8px">👥</div>
  <div style="font-size:13px">추천한 지인이 없습니다</div>
  <div style="font-size:11px;margin-top:4px">채용 공고 탭에서 추천을 시작해 보세요</div>
</div>`;

  return mine.slice().reverse().map(r => {
    const meta = STATUS_META[r.status] || STATUS_META.submitted;
    const pos  = OPEN_POSITIONS.find(p => p.id === r.positionId);
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div>
      <div style="font-size:13px;font-weight:700;color:var(--text)">${r.candidateName}</div>
      <div style="font-size:11px;color:var(--text-muted)">${pos?.title || r.positionId}</div>
    </div>
    <span style="padding:3px 9px;border-radius:6px;font-size:11px;font-weight:600;background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted)">
    <span>📅 ${r.createdAt?.slice(0,10)||''}</span>
    ${r.incentivePaid ? `<span style="color:#10B981;font-weight:700">🎁 인센티브 ${(r.incentiveAmount||0).toLocaleString()}원 지급</span>` : ''}
  </div>
</div>`;
  }).join('');
}

function _renderIncentive(mine) {
  const hired = mine.filter(r => r.status === 'hired').length;
  const total = mine.filter(r => r.incentivePaid).reduce((s,r) => s + (r.incentiveAmount||0), 0);

  return `
<!-- 내 인센티브 현황 -->
<div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border-radius:16px;padding:20px;margin-bottom:16px;text-align:center;color:#fff">
  <div style="font-size:11px;opacity:.8;margin-bottom:4px">누적 인센티브 수령</div>
  <div style="font-size:36px;font-weight:900;">${total.toLocaleString()}원</div>
  <div style="font-size:12px;opacity:.8;margin-top:4px">채용 완료 ${hired}명 · 진행 중 ${mine.filter(r=>r.status==='interview'||r.status==='reviewing').length}명</div>
</div>

<!-- 인센티브 구조 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">인센티브 지급 구조</div>
  ${INCENTIVES.map((inc, i) => `
  <div style="display:flex;align-items:center;gap:10px;padding:10px 0;${i < INCENTIVES.length-1?'border-bottom:1px solid var(--border)':''}">
    <span style="font-size:24px">${inc.icon}</span>
    <div style="flex:1">
      <div style="font-size:12px;font-weight:700;color:var(--text)">${inc.stage}</div>
      <div style="font-size:10px;color:var(--text-muted)">추천인이 해당 단계 통과 시</div>
    </div>
    <div style="font-size:16px;font-weight:900;color:#4F46E5">${inc.amount.toLocaleString()}원</div>
  </div>`).join('')}
  <div style="margin-top:10px;padding:10px;background:#EEF2FF;border-radius:8px;font-size:11px;color:#4F46E5;text-align:center">
    최종 합격 + 3개월 재직 시 총 <strong>1,000,000원</strong> 지급
  </div>
</div>

<!-- 유의사항 -->
<div style="background:#FFFBEB;border-radius:10px;padding:12px;font-size:11px;color:#92400E;line-height:1.7">
  <div style="font-weight:700;margin-bottom:4px">⚠️ 유의사항</div>
  • 이미 채용 프로세스가 진행 중인 후보자는 추천 불가<br>
  • 동일 후보 중복 추천 시 최초 추천자에게만 인센티브 지급<br>
  • 인센티브는 과세 대상 소득으로 원천징수 후 지급
</div>`;
}

function _bindForm(root, uid) {
  root.querySelector('#er-form-cancel')?.addEventListener('click', () => {
    _showForm = false; _formPos = null; _draw(root);
  });
  root.querySelector('#er-form-submit')?.addEventListener('click', () => {
    const name  = root.querySelector('#er-name')?.value.trim();
    const phone = root.querySelector('#er-phone')?.value.trim();
    if (!name)  { showToast('추천인 이름을 입력해 주세요.', 'error'); return; }
    if (!phone) { showToast('연락처를 입력해 주세요.', 'error'); return; }
    const all = _load();
    const dup = all.find(r => r.referrerId !== uid && r.candidateName === name && r.positionId === _formPos);
    if (dup) { showToast('이미 다른 직원이 추천한 후보자입니다.', 'error'); return; }
    all.push({
      id:            _id(),
      referrerId:    uid,
      positionId:    _formPos,
      candidateName: name,
      candidatePhone:phone,
      candidateEmail:root.querySelector('#er-email')?.value.trim() || '',
      reason:        root.querySelector('#er-reason')?.value.trim() || '',
      status:        'submitted',
      incentivePaid: false,
      incentiveAmount:0,
      createdAt:     new Date().toISOString(),
    });
    _save(all);
    showToast('추천이 제출되었습니다! 감사합니다 🎉');
      addNotification({ type: 'success', title: '임직원 추천', body: '추천이 제출되었습니다! 감사합니다.' });
    _showForm = false; _formPos = null; _selPos = null;
    _tab = 'my-refs';
    _draw(root);
  });
}
