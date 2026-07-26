/**
 * peer-recognition-admin.js — 동료 칭찬 관리 (관리자)
 */
import { showToast } from '../../components/toast.js'
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_peer_recognitions';

const LEGACY_PR_IDS = new Set(['PR001','PR002','PR003','PR004','PR005','PR006','PR007','PR008']);

const CATEGORIES = ['협업', '창의성', '리더십', '문제해결', '친절함', '성과달성'];

const CAT_COLOR = {
  '협업':    '#3B82F6',
  '창의성':  '#8B5CF6',
  '리더십':  '#F59E0B',
  '문제해결':'#EF4444',
  '친절함':  '#10B981',
  '성과달성':'#EC4899',
};

function _load() {
  const s = localStorage.getItem(LS);
  if (!s) return [];
  try {
    const d = JSON.parse(s);
    const cleaned = d.filter(r => !LEGACY_PR_IDS.has(r.id));
    if (cleaned.length < d.length) localStorage.setItem(LS, JSON.stringify(cleaned));
    return cleaned;
  } catch { return []; }
}

function _save(list) { localStorage.setItem(LS, JSON.stringify(list)); }

let _tab = '전체현황';
let _root = null;

export function render(root) { _root = root; _tab = '전체현황'; _draw(); }
export function unmount() { _root = null;
  _tab = '전체현황';
}

function _draw() {
  const all = _load().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const now = new Date().toISOString().slice(0, 7);
  const thisMonth = all.filter(r => (r.createdAt || '').startsWith(now));

  _root.innerHTML = `
<div style="padding:0">
  <!-- 탭 -->
  <div style="display:flex;border-bottom:1px solid var(--border);background:var(--card-bg);overflow-x:auto">
    ${[['전체현황','전체 현황'],['카테고리통계','카테고리 통계']].map(([k,l]) => `
    <button class="pra-tab" data-tab="${k}"
      style="padding:10px 18px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;white-space:nowrap;
             border-bottom:2px solid ${_tab === k ? 'var(--primary)' : 'transparent'};
             color:${_tab === k ? 'var(--primary)' : '#94A3B8'}">${l}</button>`).join('')}
  </div>

  <div style="padding:14px 16px">
    <!-- 통계 카드 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
      ${[
        { l: '총 건수',    v: all.length + '건',       c: '#4F46E5' },
        { l: '이번 달',    v: thisMonth.length + '건',  c: '#10B981' },
      ].map(k => `
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
           padding:14px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:${k.c}">${k.v}</div>
        <div style="font-size:11px;color:#64748B;margin-top:3px">${k.l}</div>
      </div>`).join('')}
    </div>

    ${_tab === '전체현황' ? _renderList(all) : _renderStats(all)}
  </div>
</div>`;

  _root.querySelectorAll('.pra-tab').forEach(b =>
    b.addEventListener('click', () => { _tab = b.dataset.tab; _draw(); }));
  _bindEvents();
}

function _renderList(all) {
  if (!all.length) return `
  <div style="text-align:center;padding:40px 20px;color:#94A3B8">
    <div style="font-size:36px;margin-bottom:8px">🌟</div>
    <div style="font-size:13px;font-weight:600">아직 칭찬이 없습니다</div>
    <div style="font-size:12px;margin-top:4px">동료 칭찬이 접수되면 여기에 표시됩니다</div>
  </div>`;

  return all.map(r => {
    const c = CAT_COLOR[r.category] || '#64748B';
    return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
       padding:14px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <div style="font-size:13px;font-weight:700;color:var(--text)">
        ${r.fromName} → ${r.toName}
      </div>
      <span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:10px;
        color:#fff;background:${c}">${r.category}</span>
    </div>
    <div style="font-size:12px;color:#475569;line-height:1.5">"${r.message}"</div>
    <div style="font-size:11px;color:#94A3B8;margin-top:6px">${r.createdAt}</div>
  </div>`;
  }).join('');
}

function _renderStats(all) {
  const max = Math.max(1, ...CATEGORIES.map(c => all.filter(r => r.category === c).length));
  return `
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
    <div style="font-size:13px;font-weight:700;margin-bottom:14px">카테고리별 분포</div>
    ${CATEGORIES.map(cat => {
      const count = all.filter(r => r.category === cat).length;
      const pct   = max > 0 ? Math.round(count / max * 100) : 0;
      const color = CAT_COLOR[cat] || '#64748B';
      return `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:12px;font-weight:600;color:var(--text)">${cat}</span>
        <span style="font-size:12px;font-weight:700;color:${color}">${count}건</span>
      </div>
      <div style="height:10px;background:#E2E8F0;border-radius:5px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:5px;transition:width .4s"></div>
      </div>
    </div>`;
    }).join('')}
  </div>`;
}

function _bindEvents() {
  // No action buttons in this module; tabs handled in _draw
}
export function mount(root) { return render(root); }
