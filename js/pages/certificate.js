/**
 * certificate.js — 증명서 발급 신청 (직원)
 * 재직증명서 · 경력증명서 · 급여확인서
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_certificates';

const CERT_TYPES = [
  {
    key: 'employment',
    label: '재직증명서',
    icon: '🏢',
    desc: '현재 재직 중임을 증명하는 서류',
    purposes: ['금융기관 제출', '관공서 제출', '보험 가입', '비자 신청', '기타'],
  },
  {
    key: 'career',
    label: '경력증명서',
    icon: '📁',
    desc: '재직 기간 및 담당 업무를 증명하는 서류',
    purposes: ['이직 지원', '자격증 취득', '관공서 제출', '기타'],
  },
  {
    key: 'salary',
    label: '급여확인서',
    icon: '💰',
    desc: '급여 수준을 증명하는 서류',
    purposes: ['금융기관 대출', '임대 계약', '관공서 제출', '기타'],
  },
  {
    key: 'career_end',
    label: '퇴직증명서',
    icon: '👋',
    desc: '퇴직 사실 및 근무 기간을 증명',
    purposes: ['실업급여 신청', '이직 지원', '관공서 제출', '기타'],
    disabled: true,
  },
];

const LANG_OPTIONS = ['국문', '영문'];
const COPIES_OPTIONS = [1, 2, 3, 5];

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }
function _dept()    { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').department||'소속 미지정'; } catch { return '소속 미지정'; } }
function _position(){ try { return JSON.parse(localStorage.getItem('hr_session')||'{}').position||'주임'; }   catch { return '주임'; } }

function _getRecords() { try { return JSON.parse(localStorage.getItem(LS)||'[]'); } catch { return []; } }
function _save(l) { localStorage.setItem(LS, JSON.stringify(l)); }

const HIRE_DATE = '2024-03-01';

let _tab = 'apply';
let _selType = CERT_TYPES[0].key;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _tab = 'apply'; _selType = CERT_TYPES[0].key; _render(root); }
export function unmount() { _tab = 'apply'; }

function _render(root) {
  const myRecords = _getRecords()
    .filter(r => r.empId === _empId())
    .sort((a,b) => b.createdAt.localeCompare(a.createdAt));

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div class="top-bar" style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="cert-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">📄 증명서 발급</div>
      <div style="font-size:11px;color:var(--text-muted)">재직·경력·급여확인서 즉시 발급</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['apply','발급 신청'],['history','발급 내역']].map(([k,l])=>`
    <button class="cert-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab === 'apply' ? _renderApply() : _renderHistory(myRecords)}
  </div>
</div>`;

  root.querySelector('#cert-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.cert-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _render(root); }));

  if (_tab === 'apply') {
    // 증명서 유형 카드 선택
    root.querySelectorAll('.cert-type-card').forEach(card => {
      card.addEventListener('click', () => {
        if (card.dataset.disabled === 'true') return;
        root.querySelectorAll('.cert-type-card').forEach(c => {
          c.style.borderColor = 'var(--border)';
          c.style.background  = 'transparent';
        });
        card.style.borderColor = '#4F46E5';
        card.style.background  = '#EEF2FF';
        _selType = card.dataset.type;
        _updatePurposes(root);
      });
    });

    root.querySelector('#cert-issue-btn')?.addEventListener('click', () => _issue(root));
  }
}

function _updatePurposes(root) {
  const def = CERT_TYPES.find(t=>t.key===_selType);
  const sel = root.querySelector('#cert-purpose');
  if (!sel || !def) return;
  sel.innerHTML = def.purposes.map(p=>`<option value="${p}">${p}</option>`).join('');
}

function _issue(root) {
  const purpose = root.querySelector('#cert-purpose').value;
  const lang    = root.querySelector('#cert-lang').value;
  const copies  = parseInt(root.querySelector('#cert-copies').value)||1;
  const def     = CERT_TYPES.find(t=>t.key===_selType);

  const record = {
    id: 'CERT_'+Date.now(),
    empId: _empId(), empName: _empName(),
    dept: _dept(), position: _position(),
    type: _selType, typeName: def?.label||_selType,
    purpose, lang, copies,
    hireDate: HIRE_DATE,
    issueDate: new Date().toISOString().slice(0,10),
    createdAt: new Date().toISOString(),
    status: 'issued',
    serial: 'CERT-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-5),
  };

  const list = _getRecords();
  list.push(record);
  _save(list);

  // 미리보기 모달
  _showPreview(root, record);
  addNotification({ type: 'system', title: `${def?.label} 발급 완료 (${record.serial})`, body: '' });
  showToast(`${def?.label} 발급이 완료되었습니다.`, 'success')
    addNotification({ type: 'success', title: '증명서 신청', body: '발급이 완료되었습니다.' });
}

function _showPreview(root, r) {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center';

  const today = r.issueDate;
  const workYears = Math.floor((new Date(today)-new Date(r.hireDate))/(365.25*24*3600*1000));
  const workMonths = Math.floor(((new Date(today)-new Date(r.hireDate))%(365.25*24*3600*1000))/(30.44*24*3600*1000));

  modal.innerHTML = `
<div style="background:var(--card-bg);width:100%;max-width:480px;border-radius:20px 20px 0 0;
     padding:20px;max-height:90vh;overflow-y:auto;color:#000">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div style="font-size:15px;font-weight:700;color:#1E293B">미리보기</div>
    <button id="cert-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-muted)">✕</button>
  </div>

  <!-- 증명서 본문 -->
  <div style="border:2px solid #1E293B;border-radius:8px;padding:24px;font-family:'Malgun Gothic',sans-serif">
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:20px;font-weight:900;letter-spacing:6px;color:#1E293B">${r.typeName}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Certificate of ${r.type==='employment'?'Employment':r.type==='career'?'Career':r.type==='salary'?'Salary':'Employment'}</div>
    </div>

    <table style="width:100%;font-size:12px;border-collapse:collapse;margin-bottom:16px">
      ${[
        ['성    명', r.empName],
        ['부    서', r.dept],
        ['직    위', r.position],
        ['입 사 일', r.hireDate],
        ['재 직 기 간', `${r.hireDate} ~ 현재 (${workYears}년 ${workMonths}개월)`],
      ].map(([k,v])=>`<tr>
        <td style="padding:6px 0;border-bottom:1px solid #E2E8F0;color:var(--text-muted);width:80px">${k}</td>
        <td style="padding:6px 0;border-bottom:1px solid #E2E8F0;font-weight:600;color:#1E293B">${v}</td>
      </tr>`).join('')}
    </table>

    <div style="font-size:12px;color:#1E293B;line-height:1.8;margin-bottom:16px">
      위 사람은 당사에 재직 중임을 증명합니다.<br>
      제출처: ${r.purpose}
    </div>

    <div style="text-align:right;font-size:12px;color:var(--text-muted);margin-bottom:12px">
      발급일: ${today}<br>
      발급번호: ${r.serial}
    </div>

    <div style="text-align:center;border-top:1px solid #E2E8F0;padding-top:12px">
      <div style="font-size:14px;font-weight:900;color:#1E293B;margin-bottom:4px">HR Competency Inc.</div>
      <div style="font-size:11px;color:var(--text-muted)">대표이사 (인)</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px">
    <button id="cert-download"
      style="padding:12px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">
      📥 PDF 다운로드
    </button>
    <button id="cert-close2"
      style="padding:12px;background:var(--bg);color:var(--text);border:1.5px solid var(--border);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">
      닫기
    </button>
  </div>
</div>`;

  document.body.appendChild(modal);
  const close = () => { modal.remove(); _tab = 'history'; _render(root); };
  modal.querySelector('#cert-close').addEventListener('click', close);
  modal.querySelector('#cert-close2').addEventListener('click', close);
  modal.querySelector('#cert-download').addEventListener('click', () => {
    showToast('PDF 다운로드가 시작됩니다.', 'info');
    close();
  });
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
}

function _renderApply() {
  const def = CERT_TYPES.find(t=>t.key===_selType);
  return `
<!-- 증명서 유형 선택 -->
<div style="margin-bottom:14px">
  <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:6px;font-weight:600">증명서 종류</label>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    ${CERT_TYPES.map(t=>`
    <div class="cert-type-card" data-type="${t.key}" data-disabled="${t.disabled||false}"
      style="padding:14px;border:2px solid ${_selType===t.key?'#4F46E5':'var(--border)'};border-radius:12px;
             cursor:${t.disabled?'not-allowed':'pointer'};opacity:${t.disabled?0.45:1};
             background:${_selType===t.key?'#EEF2FF':'var(--card-bg)'}">
      <div style="font-size:24px;margin-bottom:4px">${t.icon}</div>
      <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:2px">${t.label}</div>
      <div style="font-size:10px;color:var(--text-muted)">${t.desc}</div>
      ${t.disabled?`<div style="font-size:10px;color:#F59E0B;margin-top:4px;font-weight:600">퇴직자 전용</div>`:''}
    </div>`).join('')}
  </div>
</div>

<!-- 발급 옵션 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:12px">발급 옵션</div>

  <div style="margin-bottom:10px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">제출 목적</label>
    <select id="cert-purpose"
      style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
      ${(def?.purposes||[]).map(p=>`<option value="${p}">${p}</option>`).join('')}
    </select>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
    <div>
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">언어</label>
      <select id="cert-lang"
        style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
        ${LANG_OPTIONS.map(l=>`<option value="${l}">${l}</option>`).join('')}
      </select>
    </div>
    <div>
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">발급 부수</label>
      <select id="cert-copies"
        style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
        ${COPIES_OPTIONS.map(n=>`<option value="${n}">${n}부</option>`).join('')}
      </select>
    </div>
  </div>
</div>

<!-- 발급자 정보 미리보기 -->
<div style="background:#F8FAFC;border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:14px">
  <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:8px">발급 정보 확인</div>
  ${[['이름', _empName()],['부서', _dept()],['직위', _position()],['입사일', HIRE_DATE]].map(([k,v])=>`
  <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px">
    <span style="color:var(--text-muted)">${k}</span>
    <span style="font-weight:600;color:var(--text)">${v}</span>
  </div>`).join('')}
</div>

<button id="cert-issue-btn"
  style="width:100%;background:#4F46E5;color:#fff;border:none;border-radius:12px;
         padding:13px;font-size:14px;font-weight:700;cursor:pointer">즉시 발급</button>

<div style="font-size:10px;color:var(--text-muted);text-align:center;margin-top:8px">
  발급 즉시 미리보기 및 PDF 다운로드 가능합니다
</div>`;
}

function _renderHistory(records) {
  if (!records.length) return `
<div style="text-align:center;padding:50px 20px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">📭</div>
  <div style="font-size:13px">발급 내역이 없습니다.</div>
  <button onclick="document.querySelector('[data-tab=apply]')?.click()" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">서류 신청</button>
</div>`;

  return records.map(r => {
    const def = CERT_TYPES.find(t=>t.key===r.type)||{icon:'📄',label:r.typeName};
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:8px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
    <span style="font-size:24px">${def.icon}</span>
    <div style="flex:1">
      <div style="font-size:13px;font-weight:700;color:var(--text)">${r.typeName}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${r.issueDate} · ${r.lang} · ${r.copies}부</div>
    </div>
    <span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:8px;background:#D1FAE5;color:#10B981">발급완료</span>
  </div>
  <div style="font-size:11px;color:var(--text-muted)">제출처: ${r.purpose} · 발급번호: ${r.serial}</div>
</div>`;
  }).join('');
}
