/**
 * room-booking.js — 회의실 예약 (직원)
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_room_bookings';

const ROOMS = [
  { id:'R01', name:'한라 (소)',  capacity:4,  floor:'2F', amenities:'TV·화이트보드' },
  { id:'R02', name:'백두 (중)',  capacity:8,  floor:'3F', amenities:'TV·화이트보드·화상장비' },
  { id:'R03', name:'지리 (대)',  capacity:16, floor:'3F', amenities:'프로젝터·화이트보드·화상장비' },
  { id:'R04', name:'설악 (세미나)', capacity:24, floor:'4F', amenities:'프로젝터·마이크·음향' },
];

const SLOTS = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30',
               '13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30',
               '17:00','17:30'];

function _empId()   { try { const s=JSON.parse(localStorage.getItem('hr_session')||'{}'); return s.empId||s.userId||'EMP001'; } catch { return 'EMP001'; } }
function _empName() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}').name||'직원'; }   catch { return '직원'; } }

function _getBookings() { try { return JSON.parse(localStorage.getItem(LS)||'[]'); } catch { return []; } }
function _saveBookings(l) { localStorage.setItem(LS, JSON.stringify(l)); }

function _toMin(hhmm) { const [h,m] = hhmm.split(':').map(Number); return h*60+m; }
function _endSlot(start, dur) {
  const m = _toMin(start) + dur;
  return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
}
function _isConflict(roomId, date, newStart, newDur, excludeId) {
  return _getBookings().some(b => {
    if (b.id === excludeId || b.roomId !== roomId || b.date !== date || b.status === 'cancelled') return false;
    const ns = _toMin(newStart), ne = ns + newDur;
    const bs = _toMin(b.startTime), be = bs + b.duration;
    return ns < be && ne > bs;
  });
}

let _tab = 'book';
let _selDate = new Date().toISOString().slice(0,10);
let _selRoom = ROOMS[0].id;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _tab = 'book'; _selDate = new Date().toISOString().slice(0,10); _selRoom = ROOMS[0].id; _render(root); }
export function unmount() { _tab = 'book'; }

function _render(root) {
  const myBookings = _getBookings()
    .filter(b => b.empId === _empId())
    .sort((a,b) => (b.date+b.startTime).localeCompare(a.date+a.startTime));

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div class="top-bar" style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="rb-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🏢 회의실 예약</div>
      <div style="font-size:11px;color:var(--text-muted)">예약 현황 · 신청 · 내 예약</div>
    </div>
  </div>

  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['book','예약 신청'],['schedule','예약 현황'],['mine','내 예약']].map(([k,l])=>`
    <button class="rb-tab" data-tab="${k}"
      style="flex:1;padding:10px;font-size:12px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===k?'#4F46E5':'transparent'};
             color:${_tab===k?'#4F46E5':'var(--text-muted)'}">${l}</button>`).join('')}
  </div>

  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab==='book'     ? _renderBook()
    : _tab==='schedule' ? _renderSchedule()
    :                     _renderMine(myBookings)}
  </div>
</div>`;

  root.querySelector('#rb-back').addEventListener('click', () => window.navBack());
  root.querySelectorAll('.rb-tab').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; _render(root); }));

  // 예약 신청 폼
  root.querySelector('#rb-submit')?.addEventListener('click', () => {
    const roomId  = root.querySelector('#rb-room').value;
    const date    = root.querySelector('#rb-date').value;
    const start   = root.querySelector('#rb-start').value;
    const dur     = parseInt(root.querySelector('#rb-dur').value)||60;
    const title   = root.querySelector('#rb-title').value.trim();
    const headcnt = parseInt(root.querySelector('#rb-headcount').value)||1;
    if (!date)  { showToast('날짜를 선택하세요.', 'error'); return; }
    if (!title) { showToast('회의 제목을 입력하세요.', 'error'); return; }
    if (_isConflict(roomId, date, start, dur, null)) {
      showToast('해당 시간에 이미 예약이 있습니다.', 'error'); return;
    }
    const room = ROOMS.find(r=>r.id===roomId);
    if (room && headcnt > room.capacity) {
      showToast(`${room.name} 최대 인원(${room.capacity}명)을 초과합니다.`, 'error'); return;
    }
    const bookings = _getBookings();
    bookings.push({
      id: 'RB_'+Date.now(),
      empId: _empId(), empName: _empName(),
      roomId, roomName: room?.name||roomId,
      date, startTime: start, duration: dur,
      endTime: _endSlot(start, dur),
      title, headcount: headcnt, status: 'confirmed',
      createdAt: new Date().toISOString(),
    });
    _saveBookings(bookings);
    showToast(`${room?.name||roomId} 예약이 완료되었습니다.`, 'success')
    addNotification({ type: 'success', title: '회의실 예약', body: '예약이 완료되었습니다.' });
    addNotification({ type: 'system', title: `회의실 예약: ${room?.name||roomId} ${date} ${start}`, body: '' });
    _tab = 'mine';
    _render(root);
  });

  // 예약 취소 버튼들
  root.querySelectorAll('.rb-cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      
      const bookings = _getBookings();
      const idx = bookings.findIndex(b => b.id === btn.dataset.id);
      if (idx !== -1) { bookings[idx].status = 'cancelled'; _saveBookings(bookings); showToast('예약이 취소되었습니다.', 'info'); }
      showToast('예약이 취소되었습니다.', 'info');
      _render(root);
    });
  });

  // 예약 현황 — 날짜·회의실 필터
  root.querySelector('#sch-date')?.addEventListener('change', e => { _selDate = e.target.value; _render(root); });
  root.querySelectorAll('.sch-room-btn').forEach(btn => {
    btn.addEventListener('click', () => { _selRoom = btn.dataset.room; _render(root); });
  });
}

function _renderBook() {
  const today = new Date().toISOString().slice(0,10);
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px">
  <div style="font-size:13px;font-weight:700;margin-bottom:12px">📅 회의실 예약 신청</div>

  <div style="margin-bottom:12px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">회의실 선택</label>
    <select id="rb-room" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
      ${ROOMS.map(r=>`<option value="${r.id}">${r.name} (최대 ${r.capacity}명) · ${r.floor}</option>`).join('')}
    </select>
  </div>

  <!-- 회의실 정보 -->
  <div style="background:var(--bg);border-radius:10px;padding:10px;margin-bottom:12px">
    ${ROOMS.map((r,i)=>`
    <div class="rb-room-info" data-room="${r.id}" style="display:${i===0?'block':'none'}">
      <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:2px">${r.name} · ${r.floor}</div>
      <div style="font-size:11px;color:var(--text-muted)">최대 ${r.capacity}명 · ${r.amenities}</div>
    </div>`).join('')}
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
    <div>
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">날짜</label>
      <input id="rb-date" type="date" min="${today}" value="${today}"
        style="width:100%;padding:9px 10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
    <div>
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">시작 시간</label>
      <select id="rb-start" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
        ${SLOTS.map(s=>`<option value="${s}">${s}</option>`).join('')}
      </select>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
    <div>
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">사용 시간</label>
      <select id="rb-dur" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text)">
        ${[30,60,90,120,180,240].map(d=>`<option value="${d}">${d<60?d+'분':d/60+'시간'}</option>`).join('')}
      </select>
    </div>
    <div>
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">참석 인원</label>
      <input id="rb-headcount" type="number" min="1" max="30" value="4"
        style="width:100%;padding:9px 10px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
    </div>
  </div>

  <div style="margin-bottom:16px">
    <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">회의 제목</label>
    <input id="rb-title" type="text" placeholder="예: 주간 팀 스탠드업"
      style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);box-sizing:border-box">
  </div>

  <button id="rb-submit"
    style="width:100%;background:#4F46E5;color:#fff;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer">예약하기</button>
</div>`;
}

function _renderSchedule() {
  const bookings = _getBookings().filter(b => b.date === _selDate && b.status !== 'cancelled');
  const roomMap  = {};
  bookings.forEach(b => { (roomMap[b.roomId] = roomMap[b.roomId]||[]).push(b); });

  return `
<div style="margin-bottom:12px">
  <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">날짜 선택</label>
  <input id="sch-date" type="date" value="${_selDate}"
    style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;background:var(--card-bg);color:var(--text);box-sizing:border-box">
</div>

<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
  ${ROOMS.map(r=>`
  <button class="sch-room-btn" data-room="${r.id}"
    style="padding:6px 12px;font-size:11px;font-weight:600;border-radius:8px;cursor:pointer;border:1.5px solid ${_selRoom===r.id?'#4F46E5':'var(--border)'};
           background:${_selRoom===r.id?'#EEF2FF':'var(--card-bg)'};color:${_selRoom===r.id?'#4F46E5':'var(--text-muted)'}">${r.name}</button>`).join('')}
</div>

${(() => {
  const room = ROOMS.find(r=>r.id===_selRoom);
  const slots = (roomMap[_selRoom]||[]).sort((a,b)=>a.startTime.localeCompare(b.startTime));
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px">
  <div style="font-size:13px;font-weight:700;margin-bottom:4px">${room?.name||_selRoom}</div>
  <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">${room?.floor} · 최대 ${room?.capacity}명 · ${room?.amenities}</div>
  ${SLOTS.filter((_,i)=>i%2===0).map(slotHour => {
    const slot = SLOTS.find(s=>s===slotHour)||slotHour;
    const booking = slots.find(b => {
      const bs = _toMin(b.startTime), be = bs+b.duration;
      return _toMin(slot) >= bs && _toMin(slot) < be;
    });
    return `
  <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">
    <div style="font-size:11px;color:var(--text-muted);width:40px;flex-shrink:0">${slotHour}</div>
    ${booking
      ? `<div style="flex:1;background:#EEF2FF;border-radius:8px;padding:6px 10px;border-left:3px solid #4F46E5">
           <div style="font-size:11px;font-weight:700;color:#4338CA">${booking.title}</div>
           <div style="font-size:10px;color:#6366F1">${booking.empName} · ${booking.startTime}~${booking.endTime} · ${booking.headcount}명</div>
         </div>`
      : `<div style="flex:1;font-size:11px;color:#CBD5E1">사용 가능</div>`}
  </div>`;
  }).join('')}
  ${!slots.length ? `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">예약된 일정이 없습니다.</div>
      <button onclick="location.hash='#/room-booking'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">회의실 예약</button>
    ` : ''}
</div>`;
})()}`;
}

function _renderMine(bookings) {
  const upcoming = bookings.filter(b => b.status !== 'cancelled' && b.date >= new Date().toISOString().slice(0,10));
  const past     = bookings.filter(b => b.status === 'cancelled' || b.date < new Date().toISOString().slice(0,10));

  const _card = (b, showCancel) => {
    const isPast = b.date < new Date().toISOString().slice(0,10) || b.status === 'cancelled';
    return `
  <div style="background:var(--card-bg);border:1px solid ${b.status==='cancelled'?'#FEE2E2':isPast?'var(--border)':'#C7D2FE'};
       border-radius:12px;padding:12px;margin-bottom:8px;opacity:${isPast?'0.7':'1'}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${b.title}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${b.roomName} · ${b.date}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${b.startTime}~${b.endTime} · ${b.headcount}명</div>
      </div>
      ${b.status==='cancelled'
        ? `<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:8px;background:#FEE2E2;color:#DC2626">취소됨</span>`
        : showCancel
          ? `<button class="rb-cancel-btn" data-id="${b.id}"
               style="font-size:11px;font-weight:600;padding:4px 10px;border:1px solid #FCA5A5;border-radius:8px;
                      background:#FEF2F2;color:#DC2626;cursor:pointer">취소</button>`
          : `<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:8px;background:#D1FAE5;color:#10B981">완료</span>`}
    </div>
  </div>`;
  };

  return `
${upcoming.length ? `
<div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px;margin-top:4px">예정된 예약 (${upcoming.length}건)</div>
${upcoming.map(b=>_card(b,true)).join('')}
` : `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
  <div style="font-size:48px;margin-bottom:12px">📅</div>
  <div style="font-size:14px;font-weight:600;color:var(--text-muted);margin-bottom:6px">예정된 예약이 없습니다</div>
  <div style="font-size:12px;margin-bottom:16px">회의실을 예약하면 여기에 표시됩니다.</div>
  <button onclick="document.querySelector('.rb-tab[data-t=book]')?.click()"
    style="padding:8px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">
    예약하기
  </button>
</div>`}

${past.length ? `
<div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px;margin-top:12px">지난 예약</div>
${past.map(b=>_card(b,false)).join('')}` : ''}`;
}
