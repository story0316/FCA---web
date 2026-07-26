/**
 * peer-recognition.js — 동료 칭찬 (받은 칭찬 / 보내기)
 * Route: #/peer-recognition
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_peer_recognitions';

const CATEGORIES = ['협업', '창의성', '리더십', '문제해결', '친절함', '성과달성'];

const CAT_COLOR = {
  '협업':   { bg: '#EEF2FF', color: '#4F46E5' },
  '창의성': { bg: '#FDF4FF', color: '#9333EA' },
  '리더십': { bg: '#FEF3C7', color: '#D97706' },
  '문제해결':{ bg: '#ECFDF5', color: '#059669' },
  '친절함': { bg: '#FFF1F2', color: '#E11D48' },
  '성과달성':{ bg: '#EFF6FF', color: '#2563EB' },
};

const LEGACY_REC_IDS = new Set(['rec001','rec002','rec003','rec004','rec005']);

function _load() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS) || '[]');
    const cleaned = saved.filter(r => !LEGACY_REC_IDS.has(r.id));
    if (cleaned.length < saved.length) localStorage.setItem(LS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}
function _save(list) { localStorage.setItem(LS, JSON.stringify(list)); }
function _uid()  { try { return JSON.parse(localStorage.getItem('hr_session') || '{}').empId  || 'EMP001'; } catch { return 'EMP001'; } }
function _uname(){ try { return JSON.parse(localStorage.getItem('hr_session') || '{}').name   || '사용자'; } catch { return '사용자'; } }
function _gid()  { return 'rec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6); }
function _fmt(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

let _tab = 'received';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'received';
  _draw(root);
}

export function unmount() { _tab = 'received'; }

function _draw(root) {
  const uid   = _uid();
  const uname = _uname();
  const all   = _load();
  const received = all.filter(r => r.toId === uid).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="pr-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🌟 동료 칭찬</div>
      <div style="font-size:11px;color:var(--text-muted)">받은 칭찬 ${received.length}개</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['received','받은 칭찬'],['send','보내기']].map(([k,l]) => `
    <button class="pr-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab === 'received' ? _renderReceived(received) : _renderSend(uname)}
  </div>
</div>`;

  root.querySelector('#pr-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.pr-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(root); }));

  if (_tab === 'send') {
    root.querySelector('#pr-send-btn')?.addEventListener('click', () => _handleSend(root, uid, uname));
  }
}

function _renderReceived(received) {
  if (!received.length) return `
<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
  <div style="font-size:48px;margin-bottom:12px">🌟</div>
  <div style="font-size:15px;font-weight:600;margin-bottom:6px">아직 받은 칭찬이 없어요</div>
  <div style="font-size:13px">동료에게 먼저 칭찬을 보내보세요!</div>
</div>`;

  const catCount = {};
  received.forEach(r => { catCount[r.category] = (catCount[r.category] || 0) + 1; });
  const topCat = Object.entries(catCount).sort((a,b) => b[1]-a[1])[0];

  return `
<div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border-radius:16px;padding:20px;margin-bottom:16px;color:#fff">
  <div style="font-size:13px;opacity:0.85;margin-bottom:4px">총 받은 칭찬</div>
  <div style="font-size:36px;font-weight:900;margin-bottom:8px">${received.length}개 🌟</div>
  ${topCat ? `<div style="font-size:12px;background:rgba(255,255,255,0.2);display:inline-block;padding:4px 10px;border-radius:20px">
    가장 많이 받은 칭찬: <strong>${topCat[0]}</strong> (${topCat[1]}회)
  </div>` : ''}
</div>

${received.map(r => {
  const meta = CAT_COLOR[r.category] || { bg: '#F1F5F9', color: '#475569' };
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:8px">
      <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#4F46E5,#7C3AED);
           display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px">
        ${r.isAnon ? '?' : r.fromName.charAt(0)}
      </div>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${r.isAnon ? '익명' : r.fromName}</div>
        <div style="font-size:11px;color:var(--text-muted)">${_fmt(r.createdAt)}</div>
      </div>
    </div>
    <span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;
      background:${meta.bg};color:${meta.color}">${r.category}</span>
  </div>
  <div style="font-size:13px;color:var(--text);line-height:1.6;background:#F8FAFC;
       border-radius:10px;padding:10px;border-left:3px solid ${meta.color}">
    "${r.message}"
  </div>
</div>`;
}).join('')}`;
}

function _renderSend(uname) {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:14px">칭찬 보내기</div>

  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">수신자 이름 <span style="color:#EF4444">*</span></label>
    <input id="pr-to-name" type="text" placeholder="예: 홍길동"
      style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);
             border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
  </div>

  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:6px">카테고리 <span style="color:#EF4444">*</span></label>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
      ${CATEGORIES.map((cat, i) => {
        const m = CAT_COLOR[cat] || { bg: '#F1F5F9', color: '#475569' };
        return `
      <label class="pr-cat-label" style="display:flex;align-items:center;justify-content:center;padding:8px 4px;
             border:2px solid var(--border);border-radius:10px;cursor:pointer;font-size:11px;font-weight:600;
             color:var(--text);text-align:center;transition:all 0.15s">
        <input type="radio" name="pr-cat" value="${cat}"
          style="position:absolute;opacity:0;pointer-events:none" ${i===0?'checked':''}>
        ${cat}
      </label>`;
      }).join('')}
    </div>
  </div>

  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">칭찬 메시지 <span style="color:#EF4444">*</span></label>
    <textarea maxlength="500" id="pr-message" placeholder="구체적인 상황과 함께 칭찬을 전해보세요 (최소 10자)"
      style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);
             border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);
             height:90px;resize:vertical"></textarea>
  </div>

  <div style="margin-bottom:16px;display:flex;align-items:center;gap:8px">
    <input type="checkbox" id="pr-anon" style="width:16px;height:16px;accent-color:#4F46E5">
    <label for="pr-anon" style="font-size:13px;color:var(--text);cursor:pointer">익명으로 보내기</label>
  </div>

  <button id="pr-send-btn"
    style="width:100%;background:#4F46E5;color:#fff;border:none;border-radius:12px;
           padding:13px;font-size:14px;font-weight:700;cursor:pointer">
    칭찬 보내기 🌟
  </button>
</div>`;
}

function _handleSend(root, uid, uname) {
  const toName  = root.querySelector('#pr-to-name')?.value.trim();
  const catEl   = root.querySelector('input[name="pr-cat"]:checked');
  const category = catEl?.value || CATEGORIES[0];
  const message = root.querySelector('#pr-message')?.value.trim();
  const isAnon  = root.querySelector('#pr-anon')?.checked || false;

  if (!toName)              { showToast('수신자 이름을 입력해 주세요.', 'error'); return; }
  if (!message || message.length < 10) { showToast('칭찬 메시지를 10자 이상 입력해 주세요.', 'error'); return; }

  const list = _load();
  list.push({
    id: _gid(),
    fromId: uid, fromName: isAnon ? '익명' : uname,
    toId: 'EMP_' + Date.now(), toName,
    category, message,
    createdAt: new Date().toISOString(),
    isAnon,
  });
  _save(list);
  showToast(`${toName}님께 칭찬을 보냈습니다! 🌟`, 'success')
    addNotification({ type: 'success', title: '동료 인정', body: '님께 칭찬을 보냈습니다! 🌟' });
  _tab = 'received';
  _draw(root);
}
