/**
 * anniversary.js — 경조사 신청 (직원용)
 * Route: #/anniversary
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
const TODAY = new Date().toISOString().slice(0,10);

const LS = 'hr_anniversaries';

const ANNIV_TYPES = {
  marriage:    '결혼',
  birth:       '출산',
  parent_death:'부모상',
  spouse_death:'배우자상',
  child_death: '자녀상',
  birthday:    '생일',
};

const ANNIV_BENEFITS = {
  marriage:    '경조금 30만원 + 5일 경조휴가',
  birth:       '경조금 30만원 + 3일 경조휴가',
  parent_death:'경조금 20만원 + 5일 경조휴가',
  spouse_death:'경조금 20만원 + 5일 경조휴가',
  child_death: '경조금 20만원 + 3일 경조휴가',
  birthday:    '케이크 쿠폰',
};

const ANNIV_ICON = {
  marriage: '💍', birth: '👶', parent_death: '🌿',
  spouse_death: '🌿', child_death: '🌿', birthday: '🎂',
};

const STATUS_META = {
  pending:  { label: '검토 중', bg: '#FEF3C7', color: '#D97706' },
  approved: { label: '승인',   bg: '#D1FAE5', color: '#059669' },
};

function _demoAnniversaries() {
  const uid = _uid(); const name = _uname(); const dept = _udept();
  return [
    { id: `anniv_${uid}_1`, empId: uid, empName: name, dept, type: 'birthday', eventDate: '2026-06-15', note: '', status: 'approved', reqDate: '2026-06-01' },
    { id: `anniv_${uid}_2`, empId: uid, empName: name, dept, type: 'marriage', eventDate: '2026-07-20', note: '부산 롯데호텔', status: 'pending', reqDate: '2026-06-05' },
    { id: `anniv_${uid}_3`, empId: uid, empName: name, dept, type: 'parent_death', eventDate: '2026-03-22', note: '부친상', status: 'approved', reqDate: '2026-03-22' },
  ];
}

function _load() {
  const demo = _demoAnniversaries();
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

let _tab      = 'apply';
let _selType  = 'marriage';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab     = 'apply';
  _selType = 'marriage';
  _draw(root);
}

export function unmount() { _tab = 'apply'; _selType = 'marriage'; }

function _draw(root) {
  const uid  = _uid();
  const mine = _load().filter(a => a.empId === uid).sort((a, b) => b.reqDate.localeCompare(a.reqDate));

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="an-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🎊 경조사 신청</div>
      <div style="font-size:11px;color:var(--text-muted)">신청 내역 ${mine.length}건</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['apply','신청하기'],['history','신청 내역']].map(([k,l]) => `
    <button class="an-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab === 'apply' ? _renderApply() : _renderHistory(mine)}
  </div>
</div>`;

  root.querySelector('#an-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.an-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(root); }));

  if (_tab === 'apply') {
    const typeSelect = root.querySelector('#an-type');
    typeSelect?.addEventListener('change', () => { _selType = typeSelect.value; _draw(root); });
    root.querySelector('#an-submit-btn')?.addEventListener('click', () => _handleSubmit(root, uid));
  }
}

function _renderApply() {
  const benefit = ANNIV_BENEFITS[_selType];
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">경조사 구분 <span style="color:#EF4444">*</span></label>
    <select id="an-type"
      style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text)">
      ${Object.entries(ANNIV_TYPES).map(([k,v]) =>
        `<option value="${k}" ${_selType===k?'selected':''}>${ANNIV_ICON[k] || ''} ${v}</option>`
      ).join('')}
    </select>
  </div>

  ${benefit ? `
  <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;padding:12px;margin-bottom:14px;
       display:flex;align-items:center;gap:10px">
    <span style="font-size:24px">${ANNIV_ICON[_selType] || '🎊'}</span>
    <div>
      <div style="font-size:11px;color:#065F46;font-weight:600;margin-bottom:2px">지원 혜택</div>
      <div style="font-size:13px;color:#059669;font-weight:700">${benefit}</div>
    </div>
  </div>` : ''}

  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">경조일 <span style="color:#EF4444">*</span></label>
    <input id="an-date" type="date" value="${_today()}"
      style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);
             border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)" min="${TODAY}">
  </div>

  <div style="margin-bottom:16px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">비고 (선택)</label>
    <textarea maxlength="500" id="an-note" placeholder="예: 부산 롯데호텔 예식장, 첫째 아이 등"
      style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);
             border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);
             height:70px;resize:vertical"></textarea>
  </div>

  <button id="an-submit-btn"
    style="width:100%;background:#4F46E5;color:#fff;border:none;border-radius:12px;
           padding:13px;font-size:14px;font-weight:700;cursor:pointer">신청하기</button>
</div>`;
}

function _renderHistory(mine) {
  if (!mine.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:48px;margin-bottom:12px">🎊</div>
  <div style="font-size:15px;font-weight:600;margin-bottom:6px">신청 내역이 없어요</div>
  <div style="font-size:13px;margin-bottom:14px">경조사가 있으시면 신청해 주세요.</div>
  <button onclick="document.querySelector('.an-tab[data-tab=apply]')?.click()" style="padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">경조사 신청</button>
</div>`;

  return mine.map(a => {
    const s = STATUS_META[a.status] || STATUS_META.pending;
    const benefit = ANNIV_BENEFITS[a.type] || '';
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:24px">${ANNIV_ICON[a.type] || '🎊'}</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${ANNIV_TYPES[a.type] || a.type}</div>
        <div style="font-size:11px;color:var(--text-muted)">${a.eventDate}${a.note ? ' · ' + a.note : ''}</div>
      </div>
    </div>
    <span style="flex-shrink:0;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:600;
      background:${s.bg};color:${s.color}">${s.label}</span>
  </div>
  ${benefit ? `<div style="font-size:11px;color:#059669;margin-top:4px">✓ ${benefit}</div>` : ''}
  <div style="font-size:10px;color:var(--text-muted);margin-top:4px">신청일 ${a.reqDate}</div>
</div>`;
  }).join('');
}

function _handleSubmit(root, uid) {
  const type  = root.querySelector('#an-type')?.value;
  const date  = root.querySelector('#an-date')?.value;
  const note  = root.querySelector('#an-note')?.value.trim();

  if (!type) { showToast('경조사 구분을 선택해 주세요.', 'error'); return; }
  if (!date) { showToast('경조일을 선택해 주세요.', 'error'); return; }

  const all = _load();
  const newItem = {
    id: 'anniv_' + Date.now(),
    empId: uid, empName: _uname(), dept: _udept(),
    type, eventDate: date, note,
    status: 'pending', reqDate: _today(),
  };
  _save([...all.filter(x => !_demoAnniversaries().find(d => d.id === x.id)), newItem]);
  showToast(`${ANNIV_TYPES[type]} 경조사 신청이 완료되었습니다.`, 'success')
    addNotification({ type: 'success', title: '기념일 등록', body: '경조사 신청이 완료되었습니다.' });
  _tab = 'history';
  _draw(root);
}
