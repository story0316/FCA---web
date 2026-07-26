/**
 * rulebook-mgmt.js — 취업규칙 버전 관리 + 직원 동의 수집
 * 근로기준법 제93조 — 10인 이상 사업장 신고 의무
 */

import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';
import { loadDisplayEmployees } from '../../data/demo_employees.js';

const LS_RULEBOOK = 'hr_rulebook_versions';
const LS_CONSENT  = 'hr_rulebook_consents';

let _employees = [];

const REQUIRED_SECTIONS = [
  '시업·종업 시각 및 휴게시간', '휴일', '휴가',
  '임금·임금산정기간·지급시기·지급방법',
  '퇴직금', '안전·보건', '재해보상', '표창·제재',
];

function _getVersions() {
  const saved = localStorage.getItem(LS_RULEBOOK);
  if (!saved) {
    const demo = [
      {
        id: 'RB_001', version: '2024.01', name: '2024년 취업규칙',
        status: 'active', createdAt: '2024-01-15',
        sections: REQUIRED_SECTIONS,
        changeType: 'minor',
        changeReason: '임금지급일 변경 (25일 → 마지막 근무일)',
        consentRequired: false,
        content: '제1조 목적: 본 취업규칙은 회사와 근로자의 권리와 의무를 정함을 목적으로 한다.\n...',
      },
      {
        id: 'RB_002', version: '2023.03', name: '2023년 3월 개정',
        status: 'archived', createdAt: '2023-03-01',
        sections: REQUIRED_SECTIONS,
        changeType: 'major',
        changeReason: '연장근로 한도 변경, 휴가 정책 개정 (불이익 변경)',
        consentRequired: true,
        content: '...',
      },
    ];
    localStorage.setItem(LS_RULEBOOK, JSON.stringify(demo));
    return demo;
  }
  return JSON.parse(saved);
}

function _saveVersions(list) {
  localStorage.setItem(LS_RULEBOOK, JSON.stringify(list));
}

function _getConsents() {
  const saved = localStorage.getItem(LS_CONSENT);
  if (!saved) {
    const demo = _employees.map(e => e.name).map((name, i) => ({
      name, rbId: 'RB_001', consented: i < 7,
      consentedAt: i < 7 ? '2024-01-20' : null,
    }));
    localStorage.setItem(LS_CONSENT, JSON.stringify(demo));
    return demo;
  }
  return JSON.parse(saved);
}

function _saveConsents(list) {
  localStorage.setItem(LS_CONSENT, JSON.stringify(list));
}

let _selectedRb = null;
let _view = 'list'; // 'list' | 'detail' | 'new'

export function render(root) {
  _renderPage(root);
}

export function unmount() {
  _selectedRb = null;
  _view = 'list';
}

function _renderPage(root) {

  if (_view === 'new')    { _renderNewForm(root); return; }
  if (_view === 'detail') { _renderDetail(root);  return; }
  _renderList(root);
}

// ── 목록 뷰 ─────────────────────────────────────────────────

function _renderList(root) {
  const versions = _getVersions();
  if (!versions.length) { root.innerHTML = `<div style="text-align:center;padding:48px 20px;color:#94A3B8"><div style="font-size:40px;margin-bottom:10px">📖</div><div style="font-size:14px;font-weight:600;margin-bottom:4px">규정이 없습니다.</div></div>`; return; }
  const active = versions.find(v => v.status === 'active');

  root.innerHTML = `
<div style="padding:16px">

  <!-- 상단 -->
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
    <div style="font-size:15px;font-weight:700">📜 취업규칙 관리</div>
    <button id="new-btn" style="background:#4F46E5;color:#fff;border:none;border-radius:10px;
      padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer">+ 새 버전</button>
  </div>

  <!-- 법령 안내 배너 -->
  <div style="background:#EEF2FF;border-radius:12px;padding:12px;margin-bottom:16px;border-left:4px solid #4F46E5">
    <div style="font-size:12px;font-weight:700;color:#4338CA;margin-bottom:4px">⚖️ 근로기준법 제93조</div>
    <div style="font-size:11px;color:#3730A3;line-height:1.6">
      10인 이상 사업장은 취업규칙을 작성·신고해야 합니다.<br>
      불이익 변경 시 근로자 과반수(또는 노조)의 동의가 필요합니다.
    </div>
  </div>

  <!-- 현행 버전 -->
  ${active ? `
  <div style="background:var(--card-bg);border:2px solid #4F46E5;border-radius:14px;padding:14px;margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <div>
        <span style="font-size:14px;font-weight:700">${active.name}</span>
        <span style="background:#D1FAE5;color:#065F46;font-size:11px;padding:2px 8px;
          border-radius:10px;margin-left:8px;font-weight:600">현행</span>
      </div>
      <div style="font-size:12px;color:#64748B">${active.version}</div>
    </div>
    <div style="font-size:12px;color:#64748B;margin-bottom:10px">
      ${active.createdAt} 시행 · ${active.changeType === 'major' ? '불이익 변경' : '일반 변경'}
    </div>
    ${_consentSummary(active.id)}
    <button class="view-detail-btn" data-id="${active.id}"
      style="width:100%;background:none;border:1.5px solid #4F46E5;border-radius:8px;
        padding:8px;font-size:13px;font-weight:600;color:#4F46E5;cursor:pointer;margin-top:10px">
      상세 보기 / 동의 관리 →
    </button>
  </div>` : ''}

  <!-- 이전 버전 목록 -->
  <div style="font-size:12px;font-weight:700;color:#64748B;margin-bottom:8px">이전 버전</div>
  ${versions.filter(v => v.status !== 'active').map(v => `
  <div class="rb-card" data-id="${v.id}"
    style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
      padding:12px;margin-bottom:8px;cursor:pointer;opacity:0.75">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <span style="font-size:13px;font-weight:600">${v.name}</span>
        <span style="background:#F1F5F9;color:#64748B;font-size:10px;padding:2px 7px;
          border-radius:10px;margin-left:6px">보관됨</span>
      </div>
      <div style="font-size:11px;color:#94A3B8">${v.version}</div>
    </div>
    <div style="font-size:11px;color:#94A3B8;margin-top:4px">${v.createdAt} · ${v.changeReason}</div>
  </div>`).join('')}

  <!-- 필수 기재사항 체크 -->
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
      padding:14px;margin-top:14px">
    <div style="font-size:13px;font-weight:700;margin-bottom:10px">✅ 필수 기재사항 (법정 14항목 중 8개 핵심)</div>
    ${REQUIRED_SECTIONS.map(s => `
    <div style="display:flex;align-items:center;gap:8px;padding:5px 0;
        border-bottom:1px solid var(--border);font-size:12px">
      <span style="color:#10B981;font-size:14px">✅</span>
      <span style="color:var(--text)">${s}</span>
    </div>`).join('')}
  </div>

</div>`;

  root.querySelector('#new-btn')?.addEventListener('click', () => {
    _view = 'new'; _renderPage(root);
  });
  root.querySelectorAll('.view-detail-btn, .rb-card').forEach(btn => {
    btn.addEventListener('click', () => {
      _selectedRb = btn.dataset.id;
      _view = 'detail';
      _renderPage(root);
    });
  });
}

function _consentSummary(rbId) {
  const consents = _getConsents().filter(c => c.rbId === rbId);
  if (!consents.length) return '';
  const done = consents.filter(c => c.consented).length;
  const pct  = Math.round(done / consents.length * 100);
  const color = pct === 100 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';
  return `
    <div style="font-size:12px;color:#64748B;margin-bottom:6px">직원 동의 현황</div>
    <div style="background:var(--border);border-radius:4px;height:6px;overflow:hidden;margin-bottom:4px">
      <div style="background:${color};height:100%;width:${pct}%;border-radius:4px;transition:width .5s"></div>
    </div>
    <div style="font-size:12px;color:#64748B">${done} / ${consents.length}명 동의 완료 (${pct}%)</div>`;
}

// ── 상세/동의 뷰 ──────────────────────────────────────────────

function _renderDetail(root) {
  const versions = _getVersions();
  const rb = versions.find(v => v.id === _selectedRb);
  if (!rb) { _view = 'list'; _renderPage(root); return; }

  const consents = _getConsents().filter(c => c.rbId === rb.id);

  root.innerHTML = `
<div style="padding:16px">

  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button id="back-btn" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text)">←</button>
    <div style="font-size:15px;font-weight:700">${rb.name}</div>
    ${rb.status === 'active'
      ? '<span style="background:#D1FAE5;color:#065F46;font-size:11px;padding:3px 10px;border-radius:10px;font-weight:600">현행</span>'
      : '<span style="background:#F1F5F9;color:#64748B;font-size:11px;padding:3px 10px;border-radius:10px;font-weight:600">보관됨</span>'}
  </div>

  <!-- 기본 정보 -->
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
      padding:14px;margin-bottom:12px">
    ${_drow('버전', rb.version)}
    ${_drow('시행일', rb.createdAt)}
    ${_drow('변경 유형', rb.changeType === 'major' ? '🔴 불이익 변경 (과반수 동의 필요)' : '🟢 일반 변경 (의견 청취)')}
    ${_drow('변경 사유', rb.changeReason)}
  </div>

  <!-- 내용 미리보기 -->
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
      padding:14px;margin-bottom:12px">
    <div style="font-size:13px;font-weight:700;margin-bottom:8px">📄 내용 미리보기</div>
    <div style="font-size:12px;color:#64748B;line-height:1.8;white-space:pre-line;
        max-height:160px;overflow-y:auto;padding:8px;background:var(--bg);
        border-radius:8px;border:1px solid var(--border)">${rb.content || '내용 없음'}</div>
  </div>

  <!-- 동의 현황 -->
  ${rb.changeType === 'major' ? `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
      padding:14px;margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-size:13px;font-weight:700">👥 직원 동의 현황</div>
      <button id="remind-btn" style="background:#EEF2FF;color:#4338CA;border:none;border-radius:8px;
        padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer">📢 미동의자 알림</button>
    </div>
    ${_consentSummary(rb.id)}
    <div style="margin-top:12px">
      ${consents.map(c => `
      <div style="display:flex;align-items:center;justify-content:space-between;
          padding:7px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="color:${c.consented?'#10B981':'#EF4444'};font-size:14px">
            ${c.consented?'✅':'○'}
          </span>
          <span style="font-size:13px;color:var(--text)">${c.name}</span>
        </div>
        <div style="font-size:11px;color:#94A3B8">
          ${c.consented ? c.consentedAt : '미동의'}
        </div>
      </div>`).join('')}
    </div>
    ${!consents.length
      ? `<button id="init-consent-btn" class="btn btn-primary" style="width:100%;margin-top:10px">
           동의 수집 시작 (${_employees.length}명)
         </button>`
      : ''}
  </div>` : `
  <div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:12px;padding:12px;margin-bottom:12px">
    <div style="font-size:12px;color:#15803D;font-weight:600">✅ 일반 변경 — 의견 청취만으로 시행 가능</div>
    <div style="font-size:11px;color:#166534;margin-top:4px">근로기준법 제94조: 불이익 변경이 아닌 경우 의견 청취 후 고용노동부 신고</div>
  </div>`}

  ${rb.status === 'archived' ? `
  <button id="restore-btn" class="btn btn-primary" style="width:100%;margin-bottom:8px">
    현행 버전으로 복원
  </button>` : ''}

</div>`;

  root.querySelector('#back-btn').addEventListener('click', () => {
    _view = 'list'; _renderPage(root);
  });

  root.querySelector('#remind-btn')?.addEventListener('click', () => {
    const undone = consents.filter(c => !c.consented).length;
    showToast(`${undone}명에게 동의 요청 알림이 발송되었습니다.`, 'success')
      addNotification({ type: 'success', title: 'Rulebook Mgmt (관리자)', body: '명에게 동의 요청 알림이 발송되었습니다.' });
  });

  root.querySelector('#init-consent-btn')?.addEventListener('click', () => {
    const newConsents = _employees.map(e => e.name).map(name => ({
      name, rbId: rb.id, consented: false, consentedAt: null,
    }));
    _saveConsents(newConsents);
    showToast('동의 수집이 시작되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Rulebook Mgmt (관리자)', body: '동의 수집이 시작되었습니다.' });
    _renderPage(root);
  });

  root.querySelector('#restore-btn')?.addEventListener('click', () => {
    const versions = _getVersions();
    versions.forEach(v => { v.status = v.id === rb.id ? 'active' : 'archived'; });
    _saveVersions(versions);
    showToast('현행 버전으로 복원되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Rulebook Mgmt (관리자)', body: '현행 버전으로 복원되었습니다.' });
    _view = 'list'; _renderPage(root);
  });
}

function _drow(label, value) {
  return `<div style="display:flex;justify-content:space-between;align-items:flex-start;
      padding:6px 0;border-bottom:1px solid var(--border)">
    <span style="font-size:12px;color:#64748B;flex-shrink:0;width:100px">${label}</span>
    <span style="font-size:13px;color:var(--text);text-align:right">${value}</span>
  </div>`;
}

// ── 새 버전 등록 ─────────────────────────────────────────────

function _renderNewForm(root) {
  root.innerHTML = `
<div style="padding:16px">

  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button id="back-btn" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text)">←</button>
    <div style="font-size:15px;font-weight:700">📝 새 취업규칙 버전 등록</div>
  </div>

  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px">
    ${_formField('rb-name',    '버전명',      '2026년 취업규칙', 'text')}
    ${_formField('rb-version', '버전 번호',   '2026.01', 'text')}
    ${_formField('rb-date',    '시행일',       new Date().toISOString().slice(0,10), 'date')}
    ${_formField('rb-reason',  '변경 사유',   '연장근로 정책 변경', 'text')}

    <div style="margin-bottom:10px">
      <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">변경 유형</label>
      <select id="rb-type" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);
        border-radius:10px;font-size:14px;background:var(--bg);color:var(--text)">
        <option value="minor">일반 변경 (의견 청취)</option>
        <option value="major">불이익 변경 (과반수 동의 필수)</option>
      </select>
    </div>

    <div style="margin-bottom:10px">
      <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">내용 (요약)</label>
      <textarea id="rb-content" placeholder="취업규칙 주요 내용을 입력하세요..."
        style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
          font-size:13px;background:var(--bg);color:var(--text);height:100px;resize:vertical;
          box-sizing:border-box;font-family:inherit"></textarea>
    </div>
  </div>

  <div style="background:#FEF3C7;border-radius:12px;padding:12px;margin-bottom:14px">
    <div style="font-size:12px;font-weight:700;color:#92400E;margin-bottom:4px">📋 신고 체크리스트</div>
    <div style="font-size:11px;color:#78350F;line-height:1.8">
      ☐ 고용노동부 관할 지청 신고 (변경 후 지체 없이)<br>
      ☐ 불이익 변경 시 근로자 과반수 동의서 첨부<br>
      ☐ 전 직원 공지 및 게시판 게재<br>
      ☐ 미신고 시 500만원 이하 과태료
    </div>
  </div>

  <button id="save-btn" class="btn btn-primary" style="width:100%">저장 및 현행 버전으로 등록</button>

</div>`;

  root.querySelector('#back-btn').addEventListener('click', () => {
    _view = 'list'; _renderPage(root);
  });

  root.querySelector('#save-btn').addEventListener('click', () => {
    const g = id => root.querySelector(`#${id}`)?.value?.trim() || '';
    const name = g('rb-name');
    if (!name) { showToast('버전명을 입력하세요.', 'error'); return; }

    const versions = _getVersions();
    versions.forEach(v => { if (v.status === 'active') v.status = 'archived'; });
    const newRb = {
      id: 'RB_' + Date.now(),
      version: g('rb-version'),
      name,
      status: 'active',
      createdAt: g('rb-date'),
      sections: REQUIRED_SECTIONS,
      changeType: g('rb-type'),
      changeReason: g('rb-reason'),
      consentRequired: root.querySelector('#rb-type')?.value === 'major',
      content: g('rb-content'),
    };
    versions.unshift(newRb);
    _saveVersions(versions);

    if (newRb.changeType === 'major') {
      const consents = _employees.map(e => e.name).map(name => ({
        name, rbId: newRb.id, consented: false, consentedAt: null,
      }));
      _saveConsents(consents);
      showToast('새 버전 등록 완료. 불이익 변경으로 동의 수집이 시작됩니다.', 'success')
      addNotification({ type: 'success', title: 'Rulebook Mgmt (관리자)', body: '새 버전 등록 완료. 불이익 변경으로 동의 수집이 시작됩니다.' });
    } else {
      showToast('새 취업규칙 버전이 등록되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Rulebook Mgmt (관리자)', body: '새 취업규칙 버전이 등록되었습니다.' });
    }
    _view = 'list'; _renderPage(root);
  });
}

function _formField(id, label, placeholder, type='text') {
  return `
<div style="margin-bottom:10px">
  <label style="font-size:11px;color:#64748B;display:block;margin-bottom:4px;font-weight:600">${label}</label>
  <input id="${id}" type="${type}" value="${placeholder}"
    style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
      font-size:14px;background:var(--bg);color:var(--text);box-sizing:border-box">
</div>`;
}
export async function mount(root) {
  _employees = await loadDisplayEmployees();
  return render(root);
}
