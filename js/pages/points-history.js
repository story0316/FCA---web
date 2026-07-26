import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js'
import { addNotification } from '../components/notification-hub.js';

function _makeDemoHistory(empId) {
  return [
    { id:`PH_${empId}_1`, userId:empId, type:'earn',  desc:'2026년 복지포인트 지급',           amount: 300000, balance: 300000, date:'2026-01-02' },
    { id:`PH_${empId}_2`, userId:empId, type:'spend', desc:'복지포인트샵 - 스타벅스 1만원권',  amount: -10000, balance: 290000, date:'2026-02-14' },
    { id:`PH_${empId}_3`, userId:empId, type:'earn',  desc:'우수사원 포인트 지급',             amount:  50000, balance: 340000, date:'2026-02-28' },
    { id:`PH_${empId}_4`, userId:empId, type:'spend', desc:'복지포인트샵 - 도서 구입',         amount: -25000, balance: 315000, date:'2026-03-10' },
    { id:`PH_${empId}_5`, userId:empId, type:'spend', desc:'복지포인트샵 - 헬스장 이용권',     amount: -60000, balance: 255000, date:'2026-03-22' },
    { id:`PH_${empId}_6`, userId:empId, type:'earn',  desc:'생일 포인트 지급',                 amount:  20000, balance: 275000, date:'2026-04-01' },
    { id:`PH_${empId}_7`, userId:empId, type:'spend', desc:'복지포인트샵 - 넷플릭스 3개월권',  amount: -17900, balance: 257100, date:'2026-04-15' },
    { id:`PH_${empId}_8`, userId:empId, type:'earn',  desc:'추천 채용 포인트',                 amount: 100000, balance: 357100, date:'2026-05-01' },
    { id:`PH_${empId}_9`, userId:empId, type:'spend', desc:'복지포인트샵 - 여행 숙박권',       amount:-150000, balance: 207100, date:'2026-05-20' },
    { id:`PH_${empId}_10`,userId:empId, type:'earn',  desc:'사내 커피챗 참여 포인트',          amount:   5000, balance: 212100, date:'2026-06-01' },
  ];
}

const LS_KEY = 'hr_points_history';

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId() { return _session().empId || _session().userId || 'EMP001'; }

function _load() {
  const empId = _empId();
  const demo = _makeDemoHistory(empId);
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) { localStorage.setItem(LS_KEY, JSON.stringify(demo)); return [...demo]; }
    const all = JSON.parse(raw);
    const mine = all.filter(h => !h.userId || h.userId === empId);
    if (!mine.length) {
      localStorage.setItem(LS_KEY, JSON.stringify([...all, ...demo]));
      return [...demo];
    }
    return mine;
  } catch { return [...demo]; }
}

function _fmt(n) {
  return (n >= 0 ? '+' : '') + n.toLocaleString('ko-KR') + 'P';
}

let _root = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _root = root;
  _render();
}

export function unmount() {
  _root = null;
}

function _render() {
  if (!_root) return;
  const history = _load().slice().reverse();
  const currentBalance = history.length > 0 ? (history[0].balance || 0) : 0;

  _root.innerHTML = `
    <div class="page" style="height:100vh;overflow:hidden;background:var(--bg);display:flex;flex-direction:column;">
      <div style="background:var(--card-bg);padding:16px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);flex-shrink:0;">
        <button onclick="window.navBack()" style="background:none;border:none;font-size:20px;cursor:pointer;padding:4px;">←</button>
        <h1 style="margin:0;font-size:17px;font-weight:700;color:var(--text);">포인트 내역</h1>
      </div>
      <div class="page-content" style="overflow-y:auto;flex:1;">
        <div style="padding:16px;display:flex;flex-direction:column;gap:12px;">

          <!-- Balance Card -->
          <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:16px;padding:20px;color:#fff;">
            <p style="margin:0 0 6px;font-size:13px;opacity:0.85;">총 잔액</p>
            <p style="margin:0;font-size:28px;font-weight:800;">${currentBalance.toLocaleString('ko-KR')}<span style="font-size:16px;font-weight:400;margin-left:4px;">P</span></p>
            <p style="margin:8px 0 0;font-size:12px;opacity:0.75;">복지포인트샵에서 사용하세요</p>
          </div>

          <!-- Transaction List -->
          <div style="background:var(--card-bg);border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
            <div style="padding:14px 16px;border-bottom:1px solid var(--border);">
              <p style="margin:0;font-size:14px;font-weight:700;color:var(--text);">거래 내역</p>
            </div>
            ${!history.length ? `
              <div style="padding:40px;text-align:center;color:var(--text-muted);">
                <div style="font-size:40px;margin-bottom:10px;">💳</div>
                <p style="margin:0;font-size:14px;">포인트 내역이 없습니다.</p>
              </div>
      <button onclick="location.hash='#/welfare-points'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">복지포인트 보기</button>
    ` :
              history.map((tx, idx) => {
                const isEarn = tx.type === 'earn';
                const amtColor = isEarn ? '#10b981' : '#ef4444';
                const amtStr = tx.amount > 0 ? `+${tx.amount.toLocaleString('ko-KR')}P` : `${tx.amount.toLocaleString('ko-KR')}P`;
                return `
                  <div style="padding:14px 16px;${idx < history.length-1?'border-bottom:1px solid #f3f4f6':''};">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                      <div style="flex:1;min-width:0;">
                        <p style="margin:0 0 3px;font-size:14px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${tx.desc}</p>
                        <p style="margin:0;font-size:12px;color:var(--text-muted);">${tx.date}</p>
                      </div>
                      <div style="text-align:right;flex-shrink:0;">
                        <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:${amtColor};">${amtStr}</p>
                        <p style="margin:0;font-size:11px;color:var(--text-muted);">잔액 ${tx.balance.toLocaleString('ko-KR')}P</p>
                      </div>
                    </div>
                  </div>`;
              }).join('')}
          </div>
        </div>
      </div>
    </div>`;
}
