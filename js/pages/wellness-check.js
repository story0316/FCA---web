/**
 * wellness-check.js — 마음건강 체크인
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

const LS = 'hr_wellness_checkins';

const MOODS = [
  { score: 5, emoji: '😄', label: '매우 좋음',  color: '#10B981' },
  { score: 4, emoji: '🙂', label: '좋음',        color: '#34D399' },
  { score: 3, emoji: '😐', label: '보통',         color: '#F59E0B' },
  { score: 2, emoji: '😔', label: '우울함',       color: '#F97316' },
  { score: 1, emoji: '😩', label: '매우 힘듦',   color: '#EF4444' },
];

const STRESS_LABELS = ['낮음', '약간', '보통', '높음', '매우 높음'];
const BURNOUT_LABELS= ['없음', '약간', '느낌', '심함', '극심함'];

const TIPS = [
  '5분 스트레칭으로 몸을 리셋해 보세요.',
  '잠깐 창문을 열고 신선한 공기를 마셔보세요.',
  '오늘 하루 잘하고 있는 것 3가지를 떠올려 보세요.',
  '좋아하는 음악을 틀고 10분 휴식을 가져보세요.',
  '동료에게 감사 메시지를 한 줄 보내보세요.',
  '충분한 수분을 섭취했나요? 물 한 잔 마셔보세요.',
  '점심시간에 짧은 산책을 권장합니다.',
  '퇴근 후 완전히 쉬는 시간을 확보해 보세요.',
];

function _load() { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } }
function _save(d) { localStorage.setItem(LS, JSON.stringify(d)); }

function _isoWeek() {
  const d = new Date(); d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 4 - (d.getDay()||7));
  const y = d.getFullYear();
  const w = Math.ceil(((d - new Date(y,0,1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2,'0')}`;
}

let _tab = 'checkin';
let _sel = { mood: null, stress: null, burnout: null, note: '', anonymous: false };

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'checkin';
  _sel = { mood: null, stress: null, burnout: null, note: '', anonymous: false };
  _draw(root);
}
export function unmount() { _tab = 'checkin';}

function _draw(root) {
  const user = getUser();
  const uid = _empId();
  const all  = _load();
  const mine = all.filter(c => c.userId === uid || c.anonymous);
  const thisWeek = _isoWeek();
  const submitted = all.find(c => c.userId === uid && c.week === thisWeek && !c.anonymous);

  root.innerHTML = `
<div class="page-content" style="padding:16px;max-width:480px;margin:0 auto">
  <!-- 헤더 -->
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button onclick="window.navBack()" style="background:none;border:none;font-size:20px;cursor:pointer;padding:0">←</button>
    <div>
      <div style="font-size:17px;font-weight:800;color:var(--text)">마음건강 체크인</div>
      <div style="font-size:11px;color:var(--text-muted)">매주 익명으로 제출됩니다</div>
    </div>
  </div>

  <!-- 탭 -->
  <div style="display:flex;background:#F1F5F9;border-radius:10px;padding:3px;margin-bottom:16px">
    ${[{k:'checkin',l:'체크인'},{k:'history',l:'내 기록'},{k:'tips',l:'웰니스 팁'}].map(t=>`
      <button class="wc-tab" data-t="${t.k}"
        style="flex:1;padding:8px 4px;border:none;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;
               background:${_tab===t.k?'#fff':'transparent'};color:${_tab===t.k?'#4F46E5':'var(--text-muted)'};
               box-shadow:${_tab===t.k?'0 1px 4px rgba(0,0,0,0.1)':'none'}">
        ${t.l}
      </button>`).join('')}
  </div>

  ${_tab === 'checkin' ? _renderCheckin(submitted, thisWeek) : ''}
  ${_tab === 'history' ? _renderHistory(mine) : ''}
  ${_tab === 'tips'    ? _renderTips()        : ''}
</div>`;

  root.querySelectorAll('.wc-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _draw(root); });
  });

  if (_tab === 'checkin' && !submitted) _bindCheckin(root);
}

function _renderCheckin(submitted, week) {
  if (submitted) {
    const mood = MOODS.find(m => m.score === submitted.mood);
    return `
<div style="text-align:center;padding:24px 16px">
  <div style="font-size:48px;margin-bottom:8px">${mood?.emoji || '🙂'}</div>
  <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px">이번 주 체크인 완료</div>
  <div style="font-size:11px;color:var(--text-muted);margin-bottom:16px">${week} · ${mood?.label || ''}</div>
  <div style="background:#EEF2FF;border-radius:12px;padding:12px;font-size:12px;color:#4F46E5;text-align:left">
    <div style="font-weight:700;margin-bottom:6px">이번 주 기록</div>
    <div>스트레스: <strong>${STRESS_LABELS[(submitted.stress||1)-1]}</strong></div>
    <div>소진 느낌: <strong>${BURNOUT_LABELS[(submitted.burnout||1)-1]}</strong></div>
    ${submitted.note ? `<div style="margin-top:6px;color:var(--text-muted)">"${submitted.note}"</div>` : ''}
  </div>
  <div style="font-size:11px;color:var(--text-muted);margin-top:12px">다음 주에 다시 체크인할 수 있습니다</div>
</div>`;
  }

  return `
<!-- 기분 선택 -->
<div style="margin-bottom:20px">
  <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">지금 기분이 어때요?</div>
  <div style="display:flex;justify-content:space-between;gap:6px">
    ${MOODS.map(m => `
      <button class="wc-mood" data-score="${m.score}"
        style="flex:1;padding:10px 4px;border:2px solid ${_sel.mood===m.score?m.color:'var(--border)'};
               border-radius:12px;background:${_sel.mood===m.score?m.color+'22':'var(--card-bg)'};
               cursor:pointer;text-align:center;transition:all .2s">
        <div style="font-size:26px">${m.emoji}</div>
        <div style="font-size:9px;color:${_sel.mood===m.score?m.color:'var(--text-muted)'};margin-top:2px;line-height:1.2">${m.label}</div>
      </button>`).join('')}
  </div>
</div>

<!-- 스트레스 -->
<div style="margin-bottom:16px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <span style="font-size:12px;font-weight:700;color:var(--text)">스트레스 수준</span>
    <span style="font-size:12px;color:#F59E0B;font-weight:600">${_sel.stress ? STRESS_LABELS[_sel.stress-1] : '-'}</span>
  </div>
  <div style="display:flex;gap:6px">
    ${[1,2,3,4,5].map(v=>`
      <button class="wc-stress" data-v="${v}"
        style="flex:1;height:36px;border:2px solid ${_sel.stress>=v?'#F59E0B':'var(--border)'};
               border-radius:8px;background:${_sel.stress>=v?'#FEF3C7':'var(--card-bg)'};cursor:pointer">
        <span style="font-size:11px;font-weight:700;color:${_sel.stress>=v?'#D97706':'var(--text-muted)'}">${v}</span>
      </button>`).join('')}
  </div>
</div>

<!-- 소진 -->
<div style="margin-bottom:16px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <span style="font-size:12px;font-weight:700;color:var(--text)">소진(번아웃) 느낌</span>
    <span style="font-size:12px;color:#EF4444;font-weight:600">${_sel.burnout ? BURNOUT_LABELS[_sel.burnout-1] : '-'}</span>
  </div>
  <div style="display:flex;gap:6px">
    ${[1,2,3,4,5].map(v=>`
      <button class="wc-burnout" data-v="${v}"
        style="flex:1;height:36px;border:2px solid ${_sel.burnout>=v?'#EF4444':'var(--border)'};
               border-radius:8px;background:${_sel.burnout>=v?'#FEE2E2':'var(--card-bg)'};cursor:pointer">
        <span style="font-size:11px;font-weight:700;color:${_sel.burnout>=v?'#EF4444':'var(--text-muted)'}">${v}</span>
      </button>`).join('')}
  </div>
</div>

<!-- 메모 -->
<div style="margin-bottom:16px">
  <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">하고 싶은 말 (선택, 익명)</div>
  <textarea maxlength="500" id="wc-note" rows="2" placeholder="오늘 느낀 점을 자유롭게..."
    style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;
           font-size:12px;background:var(--card-bg);color:var(--text);resize:none">${_sel.note}</textarea>
</div>

<!-- 익명 옵션 -->
<label style="display:flex;align-items:center;gap:8px;margin-bottom:16px;cursor:pointer">
  <input id="wc-anon" type="checkbox" ${_sel.anonymous?'checked':''} style="width:16px;height:16px;accent-color:#4F46E5">
  <span style="font-size:12px;color:var(--text)">완전 익명으로 제출 (내 이름 미포함)</span>
</label>

<button id="wc-submit" style="width:100%;padding:14px;border:none;border-radius:12px;background:#4F46E5;color:#fff;font-size:14px;font-weight:700;cursor:pointer">
  체크인 제출
</button>`;
}

function _renderHistory(mine) {
  const own = mine.filter(c => !c.anonymous).slice().reverse().slice(0, 12);
  if (!own.length) return `
<div style="text-align:center;padding:40px 16px;color:var(--text-muted)">
  <div style="font-size:32px;margin-bottom:8px">📅</div>
  <div style="font-size:13px">아직 체크인 기록이 없어요</div>
  <div style="font-size:11px;margin-top:4px">첫 번째 체크인을 제출해 보세요</div>
</div>`;

  const avgMood = (own.reduce((s,c) => s + c.mood, 0) / own.length).toFixed(1);
  const moodColor = avgMood >= 4 ? '#10B981' : avgMood >= 3 ? '#F59E0B' : '#EF4444';

  return `
<!-- 평균 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
  <div>
    <div style="font-size:11px;color:var(--text-muted)">최근 평균 기분</div>
    <div style="font-size:28px;font-weight:900;color:${moodColor}">${avgMood} / 5</div>
  </div>
  <div style="display:flex;gap:4px;align-items:flex-end;height:50px">
    ${own.slice(-8).map(c => {
      const h = Math.round((c.mood / 5) * 40) + 6;
      const col = MOODS.find(m => m.score === c.mood)?.color || 'var(--text-muted)';
      return `<div style="width:14px;height:${h}px;background:${col};border-radius:3px 3px 0 0;opacity:0.8"></div>`;
    }).join('')}
  </div>
</div>

${own.map(c => {
  const mood = MOODS.find(m => m.score === c.mood);
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:6px;display:flex;align-items:center;gap:12px">
  <span style="font-size:28px">${mood?.emoji || '😐'}</span>
  <div style="flex:1">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:12px;font-weight:700;color:${mood?.color || 'var(--text-muted)'}">${mood?.label || ''}</span>
      <span style="font-size:11px;color:var(--text-muted)">${c.week || ''}</span>
    </div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
      스트레스 ${STRESS_LABELS[(c.stress||1)-1]} · 소진 ${BURNOUT_LABELS[(c.burnout||1)-1]}
    </div>
    ${c.note ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">"${c.note}"</div>` : ''}
  </div>
</div>`;
}).join('')}`;
}

function _renderTips() {
  return `
<div style="background:linear-gradient(135deg,#EDE9FE,#EFF6FF);border-radius:14px;padding:16px;margin-bottom:14px;text-align:center">
  <div style="font-size:32px;margin-bottom:8px">💆</div>
  <div style="font-size:14px;font-weight:700;color:#4F46E5;margin-bottom:4px">오늘의 웰니스 팁</div>
  <div style="font-size:13px;color:var(--text-muted)">${TIPS[new Date().getDay() % TIPS.length]}</div>
</div>

${[
  { icon:'🧘', title:'마음 챙김', desc:'하루 5분 명상으로 집중력을 높이고 불안을 줄여보세요.' },
  { icon:'🚶', title:'활동하기', desc:'1시간마다 5분씩 일어나 스트레칭하세요. 허리·눈 건강에 좋아요.' },
  { icon:'💬', title:'소통하기', desc:'힘들 때 동료나 상사에게 솔직하게 이야기해 보세요.' },
  { icon:'😴', title:'충분한 수면', desc:'7~8시간 수면은 업무 집중력·감정 조절의 기본입니다.' },
  { icon:'📵', title:'디지털 디톡스', desc:'퇴근 후 업무 알림을 끄고 온전한 휴식을 취하세요.' },
  { icon:'📞', title:'전문가 상담', desc:'마음이 힘들 때는 EAP(사내 상담 프로그램)를 활용하세요. 완전 비밀보장.' },
].map(t => `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px;display:flex;gap:12px;align-items:flex-start">
  <span style="font-size:24px">${t.icon}</span>
  <div>
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px">${t.title}</div>
    <div style="font-size:12px;color:var(--text-muted)">${t.desc}</div>
  </div>
</div>`).join('')}`;
}

function _bindCheckin(root) {
  root.querySelectorAll('.wc-mood').forEach(btn => {
    btn.addEventListener('click', () => { _sel.mood = +btn.dataset.score; _draw(root); });
  });
  root.querySelectorAll('.wc-stress').forEach(btn => {
    btn.addEventListener('click', () => { _sel.stress = +btn.dataset.v; _draw(root); });
  });
  root.querySelectorAll('.wc-burnout').forEach(btn => {
    btn.addEventListener('click', () => { _sel.burnout = +btn.dataset.v; _draw(root); });
  });

  const noteEl = root.querySelector('#wc-note');
  const anonEl = root.querySelector('#wc-anon');
  noteEl?.addEventListener('input', () => { _sel.note = noteEl.value; });
  anonEl?.addEventListener('change', () => { _sel.anonymous = anonEl.checked; });

  root.querySelector('#wc-submit')?.addEventListener('click', () => {
    if (!_sel.mood) { showToast('기분을 선택해 주세요.', 'error'); return; }
    if (!_sel.stress) { showToast('스트레스 수준을 선택해 주세요.', 'error'); return; }
    if (!_sel.burnout) { showToast('소진 느낌을 선택해 주세요.', 'error'); return; }
    const user = getUser();
    const uid  = user?.id || user?.employee_id || 'demo';
    const all  = _load();
    all.push({
      id:       'wc_' + Date.now(),
      userId:   _sel.anonymous ? null : uid,
      dept:     user?.department || user?.dept || '',
      week:     _isoWeek(),
      date:     new Date().toISOString().slice(0,10),
      mood:     _sel.mood,
      stress:   _sel.stress,
      burnout:  _sel.burnout,
      note:     _sel.note,
      anonymous:_sel.anonymous,
    });
    _save(all);
    showToast('체크인이 제출되었습니다. 오늘도 수고했어요! 💙');
    addNotification({ type: 'success', title: '웰니스 체크인', body: '체크인이 제출되었습니다. 오늘도 수고했어요!' });
    _sel = { mood: null, stress: null, burnout: null, note: '', anonymous: false };
    _tab = 'history';
    _draw(root);
  });
}
