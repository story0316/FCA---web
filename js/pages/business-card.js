/**
 * business-card.js — 명함 신청 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_business_cards';

const TYPES = [
  { key:'standard', label:'일반 명함',   desc:'기본 용지 80g · 무코팅',       price:8000  },
  { key:'premium',  label:'프리미엄 명함', desc:'고급 용지 300g · 무광 코팅',   price:18000 },
];
const QTYS = [50, 100, 200];

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session')||'{}'); } catch { return {}; }
}
function _user() {
  try { return JSON.parse(localStorage.getItem('hr_user')||'{}'); } catch { return {}; }
}
function _getData() {
  const s = localStorage.getItem(LS);
  if (!s) return [];
  try { return JSON.parse(s); } catch { return []; }
}
function _save(d) { localStorage.setItem(LS, JSON.stringify(d)); }

let _tab  = 'preview';
let _root = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _root = root; _tab = 'preview'; _render(); }
export function unmount() { _root = null; _tab = 'preview'; }

function _render() {
  if (!_root) return;
  const sess  = _session();
  const user  = _user();
  const empId = sess.empId || sess.userId || 'EMP001';
  const myReqs = _getData().filter(r => r.empId === empId);

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div class="top-bar" style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="bc-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">💼 명함 신청</div>
      <div style="font-size:11px;color:var(--text-muted)">신청 ${myReqs.length}건 · 배송 완료 ${myReqs.filter(r=>r.status==='delivered').length}건</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['preview','내 명함'],['request','신청하기'],['history','신청 내역']].map(([k,l])=>`
    <button class="bc-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='preview' ? _renderPreview(user, sess)
    : _tab==='request' ? _renderRequest()
    :                    _renderHistory(myReqs)}
  </div>
</div>`;

  _root.querySelector('#bc-back').addEventListener('click', ()=>window.navBack());
  _root.querySelectorAll('.bc-tab').forEach(b=>b.addEventListener('click',()=>{ _tab=b.dataset.tab; _render(); }));

  if (_tab === 'request') _bindRequest(empId, user, sess);
}

function _renderPreview(user, sess) {
  const name  = user.name_ko || sess.name || '사용자';
  const title = user.position || sess.position || '사원';
  const dept  = user.department || sess.dept || '소속 미지정';
  const email = user.email || sess.email || 'user@company.com';
  const phone = user.phone || '010-0000-0000';

  return `
<!-- 명함 카드 미리보기 -->
<div style="background:linear-gradient(135deg,#1E293B 0%,#334155 100%);border-radius:16px;
     padding:24px;margin-bottom:20px;color:#fff;position:relative;overflow:hidden;min-height:140px">
  <div style="position:absolute;top:-20px;right:-20px;width:100px;height:100px;
       border-radius:50%;background:rgba(255,255,255,0.05)"></div>
  <div style="position:absolute;bottom:-30px;right:30px;width:70px;height:70px;
       border-radius:50%;background:rgba(79,70,229,0.3)"></div>
  <div style="font-size:10px;letter-spacing:2px;opacity:0.6;margin-bottom:16px;text-transform:uppercase">HR Competency OS Inc.</div>
  <div style="font-size:20px;font-weight:800;letter-spacing:-0.5px;margin-bottom:4px">${name}</div>
  <div style="font-size:12px;opacity:0.8;margin-bottom:12px">${title} · ${dept}</div>
  <div style="font-size:11px;opacity:0.7;line-height:1.8">
    <div>📧 ${email}</div>
    <div>📞 ${phone}</div>
  </div>
</div>

<!-- 정보 안내 -->
<div style="background:#EEF2FF;border-radius:12px;padding:12px;border-left:4px solid #4F46E5">
  <div style="font-size:12px;font-weight:700;color:#4338CA;margin-bottom:6px">ℹ️ 명함 발주 안내</div>
  <div style="font-size:11px;color:#4338CA;line-height:1.7">
    · 신청 후 영업일 기준 <strong>5~7일</strong> 소요<br>
    · 직함·소속 변경 시 직접 HR팀에 문의<br>
    · 연간 2회(상·하반기) 무상 발급, 초과 시 자비 부담
  </div>
</div>

<button onclick="" id="bc-go-req"
  style="width:100%;margin-top:14px;padding:13px;background:#4F46E5;color:#fff;
         border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer">
  명함 신청하기 →
</button>`;
}

function _renderRequest() {
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="font-size:13px;font-weight:700;margin-bottom:14px">💼 명함 신청서</div>

  <!-- 종류 -->
  <div style="margin-bottom:14px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:8px">명함 종류</label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${TYPES.map((t,i)=>`
      <label class="bc-type-card" style="padding:12px;border:2px solid ${i===0?'#4F46E5':'var(--border)'};
             border-radius:12px;cursor:pointer;background:${i===0?'#EEF2FF':'transparent'}">
        <input type="radio" name="bc-type" value="${t.key}" ${i===0?'checked':''} style="position:absolute;opacity:0;pointer-events:none">
        <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:2px">${t.label}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">${t.desc}</div>
        <div style="font-size:12px;font-weight:800;color:#4F46E5">+${t.price.toLocaleString()}원/100장</div>
      </label>`).join('')}
    </div>
    <input type="hidden" id="bc-type-val" value="${TYPES[0].key}">
  </div>

  <!-- 수량 -->
  <div style="margin-bottom:14px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:8px">수량</label>
    <div style="display:flex;gap:8px">
      ${QTYS.map((q,i)=>`
      <button class="bc-qty-btn" data-qty="${q}"
        style="flex:1;padding:10px;border:2px solid ${i===0?'#4F46E5':'var(--border)'};border-radius:10px;
               font-size:13px;font-weight:700;cursor:pointer;
               background:${i===0?'#EEF2FF':'transparent'};
               color:${i===0?'#4F46E5':'var(--text)'}">${q}장</button>`).join('')}
    </div>
    <input type="hidden" id="bc-qty-val" value="50">
  </div>

  <!-- 배송 방법 -->
  <div style="margin-bottom:14px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:8px">수령 방법</label>
    <div style="display:flex;gap:8px">
      ${[['office','사무실 배송'],['pickup','HR팀 직접 수령']].map(([v,l],i)=>`
      <button class="bc-del-btn" data-del="${v}"
        style="flex:1;padding:10px;border:2px solid ${i===0?'#4F46E5':'var(--border)'};border-radius:10px;
               font-size:12px;font-weight:600;cursor:pointer;
               background:${i===0?'#EEF2FF':'transparent'};
               color:${i===0?'#4F46E5':'var(--text)'}">${l}</button>`).join('')}
    </div>
    <input type="hidden" id="bc-del-val" value="office">
  </div>

  <!-- 메모 -->
  <div style="margin-bottom:16px">
    <label style="font-size:11px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:4px">특이사항 (선택)</label>
    <input id="bc-note" type="text" placeholder="직함 수정 요청 또는 기타 안내사항"
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
             font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>

  <button id="bc-submit"
    style="width:100%;padding:13px;background:#4F46E5;color:#fff;border:none;border-radius:12px;
           font-size:14px;font-weight:700;cursor:pointer">신청하기</button>
</div>`;
}

function _renderHistory(reqs) {
  const STATUS = { pending:'대기', approved:'승인', printing:'인쇄 중', delivered:'배송 완료', rejected:'반려' };
  const SCOLOR = { pending:'#F59E0B', approved:'#3B82F6', printing:'#8B5CF6', delivered:'#10B981', rejected:'#EF4444' };
  const sorted = [...reqs].sort((a,b)=>b.reqDate.localeCompare(a.reqDate));

  if (!sorted.length) return `
<div style="text-align:center;padding:48px 16px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:10px">💼</div>
  <div style="font-size:14px;font-weight:600;margin-bottom:4px">신청 내역이 없습니다</div>
      <button onclick="location.hash='#/business-card'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">명함 신청</button>
    
  <div style="font-size:12px">첫 명함을 신청해 보세요!</div>
</div>`;

  return sorted.map(r=>{
    const t = TYPES.find(t=>t.key===r.type)||TYPES[0];
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
     padding:12px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div>
      <div style="font-size:13px;font-weight:700">${t.label} ${r.qty}장</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${r.reqDate} · ${r.delivery==='office'?'사무실 배송':'직접 수령'}</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;
                 background:${SCOLOR[r.status]}22;color:${SCOLOR[r.status]}">${STATUS[r.status]||r.status}</span>
  </div>
  ${r.note ? `<div style="font-size:11px;color:var(--text-muted);background:var(--bg);border-radius:6px;padding:6px 8px">${r.note}</div>` : ''}
</div>`;}).join('');
}

function _bindRequest(empId, user, sess) {
  // 명함 미리보기 → 신청 탭 이동
  _root.querySelector('#bc-go-req')?.addEventListener('click',()=>{ _tab='request'; _render(); });

  // 종류 선택 카드
  const typeCards  = _root.querySelectorAll('.bc-type-card');
  const typeHidden = _root.querySelector('#bc-type-val');
  typeCards.forEach(card=>{
    card.addEventListener('click',()=>{
      typeCards.forEach(c=>{ c.style.borderColor='var(--border)'; c.style.background='transparent'; });
      card.style.borderColor='#4F46E5'; card.style.background='#EEF2FF';
      const r = card.querySelector('input[type=radio]');
      if (r) { r.checked=true; if(typeHidden) typeHidden.value=r.value; }
    });
  });

  // 수량 버튼
  const qtyBtns  = _root.querySelectorAll('.bc-qty-btn');
  const qtyHidden = _root.querySelector('#bc-qty-val');
  qtyBtns.forEach(btn=>{
    btn.addEventListener('click',()=>{
      qtyBtns.forEach(b=>{ b.style.borderColor='var(--border)'; b.style.background='transparent'; b.style.color='var(--text)'; });
      btn.style.borderColor='#4F46E5'; btn.style.background='#EEF2FF'; btn.style.color='#4F46E5';
      if(qtyHidden) qtyHidden.value=btn.dataset.qty;
    });
  });

  // 배송 방법 버튼
  const delBtns  = _root.querySelectorAll('.bc-del-btn');
  const delHidden = _root.querySelector('#bc-del-val');
  delBtns.forEach(btn=>{
    btn.addEventListener('click',()=>{
      delBtns.forEach(b=>{ b.style.borderColor='var(--border)'; b.style.background='transparent'; b.style.color='var(--text)'; });
      btn.style.borderColor='#4F46E5'; btn.style.background='#EEF2FF'; btn.style.color='#4F46E5';
      if(delHidden) delHidden.value=btn.dataset.del;
    });
  });

  // 제출
  _root.querySelector('#bc-submit')?.addEventListener('click',()=>{
    const type     = typeHidden?.value || 'standard';
    const qty      = parseInt(qtyHidden?.value||'50');
    const delivery = delHidden?.value || 'office';
    const note     = _root.querySelector('#bc-note')?.value.trim()||'';

    const data = _getData();
    data.push({
      id:       'BC_'+Date.now(),
      empId,
      empName:  user.name_ko || sess.name || '직원',
      dept:     user.department || sess.dept || '미지정',
      pos:      user.position || sess.position || '사원',
      type, qty, delivery, note,
      status:   'pending',
      reqDate:  new Date().toISOString().slice(0,10),
    });
    _save(data);
    showToast('명함 신청이 완료됐습니다. 영업일 5~7일 소요됩니다.', 'success')
    addNotification({ type: 'success', title: '명함 신청', body: '명함 신청이 완료됐습니다. 영업일 5~7일 소요됩니다.' });
    _tab = 'history';
    _render();
  });
}
