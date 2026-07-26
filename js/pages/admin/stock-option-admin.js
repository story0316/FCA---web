/**
 * stock-option-admin.js — 주식 매수 선택권 관리 (관리자)
 */
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_stock_options';

const LEGACY_IDS = new Set(['SOG001','SOG002','SOG003']);

function _load() {
  try {
    const d = JSON.parse(localStorage.getItem(LS) || '[]');
    const list = Array.isArray(d) ? d : [];
    const cleaned = list.filter(r => !LEGACY_IDS.has(r.id));
    if (cleaned.length !== list.length) _save(cleaned);
    return cleaned;
  } catch { return []; }
}

function _save(list) { localStorage.setItem(LS, JSON.stringify(list)); }

let _tab = '부여 현황';
let _root = null;

export function render(root) { _root = root; _tab = '부여 현황'; _draw(); }
export function unmount() { _root = null;
  _tab = '부여 현황';
}

function _draw() {
  if (!_root) return;
  const all = _load().sort((a, b) => (b.grantDate || '').localeCompare(a.grantDate || ''));

  const totalGranted  = all.reduce((s, r) => s + (r.grantedQty  || 0), 0);
  const totalVested   = all.reduce((s, r) => s + (r.vestedQty   || 0), 0);
  const totalExercised = all.reduce((s, r) => s + (r.exercisedQty || 0), 0);

  const tabList = ['부여 현황', '지급 등록'];

  _root.innerHTML = `
<div style="padding:0">
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${tabList.map(k => `
    <button class="soa-tab" data-tab="${k}"
      style="padding:10px 18px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab === k ? 'var(--primary)' : 'transparent'};
             color:${_tab === k ? 'var(--primary)' : '#94A3B8'}">${k}</button>`).join('')}
  </div>

  <div style="padding:14px 16px">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
      ${[
        { l: '총 부여량',     v: totalGranted.toLocaleString()   + '주', c: '#3B82F6' },
        { l: '행사가능 합계', v: totalVested.toLocaleString()    + '주', c: '#10B981' },
        { l: '행사 완료',     v: totalExercised.toLocaleString() + '주', c: '#8B5CF6' },
      ].map(k => `
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
           padding:12px;text-align:center">
        <div style="font-size:16px;font-weight:800;color:${k.c}">${k.v}</div>
        <div style="font-size:10px;color:#64748B;margin-top:2px">${k.l}</div>
      </div>`).join('')}
    </div>

    ${_tab === '부여 현황' ? _renderGrantList(all) : _renderGrantForm()}
  </div>
</div>`;

  _bindEvents();
}

function _renderGrantList(list) {
  if (!list.length) return `
  <div style="text-align:center;padding:48px 20px;color:#94A3B8">
    <div style="font-size:40px;margin-bottom:10px">📈</div>
    <div style="font-size:14px;font-weight:600;margin-bottom:4px">부여된 주식 선택권이 없습니다</div>
    <div style="font-size:12px">지급 등록 탭에서 새로운 부여를 등록하세요</div>
  </div>`;

  const statusMeta = {
    active:               { label: '활성',       bg: '#D1FAE5', color: '#059669' },
    partially_exercised:  { label: '일부 행사',   bg: '#EDE9FE', color: '#7C3AED' },
    fully_exercised:      { label: '전체 행사',   bg: '#DBEAFE', color: '#1D4ED8' },
    expired:              { label: '만료됨',      bg: '#F1F5F9', color: '#64748B' },
    cancelled:            { label: '취소됨',      bg: '#FEE2E2', color: '#EF4444' },
  };

  return list.map(r => {
    const st = statusMeta[r.status] || statusMeta.active;
    const vestedPct = r.grantedQty > 0 ? Math.round((r.vestedQty / r.grantedQty) * 100) : 0;
    return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:14px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--text)">📈 ${r.empName}</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">${r.dept} · ${r.empId}</div>
      </div>
      <span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:10px;
        color:${st.color};background:${st.bg};flex-shrink:0;margin-left:8px">${st.label}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:8px;font-size:11px;color:#64748B">
      <div>부여 수량: <span style="font-weight:700;color:#3B82F6">${(r.grantedQty||0).toLocaleString()}주</span></div>
      <div>행사가: <span style="font-weight:700;color:var(--text)">${(r.strikePrice||0).toLocaleString()}원</span></div>
      <div>행사가능: <span style="font-weight:700;color:#10B981">${(r.vestedQty||0).toLocaleString()}주</span></div>
      <div>행사 완료: <span style="font-weight:700;color:#8B5CF6">${(r.exercisedQty||0).toLocaleString()}주</span></div>
      <div>부여일: <span style="color:var(--text)">${r.grantDate}</span></div>
      <div>만료일: <span style="color:var(--text)">${r.expiryDate}</span></div>
    </div>
    <!-- 베스팅 진행률 바 -->
    <div style="margin-top:4px">
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#94A3B8;margin-bottom:4px">
        <span>베스팅 진행률</span>
        <span>${vestedPct}%</span>
      </div>
      <div style="height:6px;background:#F1F5F9;border-radius:99px;overflow:hidden">
        <div style="height:100%;width:${vestedPct}%;background:#10B981;border-radius:99px;transition:width 0.4s ease"></div>
      </div>
    </div>
  </div>`;
  }).join('');
}

function _renderGrantForm() {
  return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px">
    <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px">📈 주식 선택권 지급 등록</div>

    <div style="margin-bottom:12px">
      <label style="font-size:12px;font-weight:600;color:#64748B;display:block;margin-bottom:4px">직원 ID *</label>
      <input id="soa-empid" type="text" placeholder="예: EMP001"
        style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;
               font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div>
        <label style="font-size:12px;font-weight:600;color:#64748B;display:block;margin-bottom:4px">부여 수량 *</label>
        <input id="soa-qty" type="number" min="1" placeholder="주"
          style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;
                 font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;color:#64748B;display:block;margin-bottom:4px">행사가 (원) *</label>
        <input id="soa-strike" type="number" min="1" placeholder="원"
          style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;
                 font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <div>
        <label style="font-size:12px;font-weight:600;color:#64748B;display:block;margin-bottom:4px">부여일 *</label>
        <input id="soa-grant-date" type="date"
          style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;
                 font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;color:#64748B;display:block;margin-bottom:4px">만료일 *</label>
        <input id="soa-expiry-date" type="date"
          style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;
                 font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
      </div>
    </div>

    <button id="soa-submit"
      style="width:100%;background:var(--primary);color:#fff;border:none;border-radius:10px;
             padding:12px;font-size:14px;font-weight:700;cursor:pointer">
      지급 등록하기
    </button>
  </div>`;
}

function _bindEvents() {
  if (!_root) return;

  _root.querySelectorAll('.soa-tab').forEach(b =>
    b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(); }));

  const submitBtn = _root.querySelector('#soa-submit');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const empId      = (_root.querySelector('#soa-empid')?.value || '').trim();
      const qty        = parseInt(_root.querySelector('#soa-qty')?.value || '0', 10);
      const strike     = parseInt(_root.querySelector('#soa-strike')?.value || '0', 10);
      const grantDate  = (_root.querySelector('#soa-grant-date')?.value || '').trim();
      const expiryDate = (_root.querySelector('#soa-expiry-date')?.value || '').trim();

      if (!empId)           { showToast('직원 ID를 입력해주세요.', 'error'); return; }
      if (!qty || qty <= 0) { showToast('부여 수량을 올바르게 입력해주세요.', 'error'); return; }
      if (!strike || strike <= 0) { showToast('행사가를 올바르게 입력해주세요.', 'error'); return; }
      if (!grantDate)       { showToast('부여일을 선택해주세요.', 'error'); return; }
      if (!expiryDate)      { showToast('만료일을 선택해주세요.', 'error'); return; }
      if (expiryDate <= grantDate) { showToast('만료일은 부여일보다 이후여야 합니다.', 'error'); return; }

      const list = _load();
      const newGrant = {
        id: 'SOG' + Date.now(),
        empId,
        empName: empId,
        dept: '-',
        grantDate,
        expiryDate,
        grantedQty: qty,
        vestedQty: 0,
        exercisedQty: 0,
        strikePrice: strike,
        status: 'active',
        createdAt: new Date().toISOString().slice(0,10),
      };
      list.push(newGrant);
      _save(list);
      showToast('주식 선택권이 지급 등록되었습니다.', 'success')
      addNotification({ type: 'success', title: 'Stock Option (관리자)', body: '주식 선택권이 지급 등록되었습니다.' });
      _tab = '부여 현황';
      _draw();
    });
  }
}
export function mount(root) { return render(root); }
