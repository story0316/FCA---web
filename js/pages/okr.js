/**
 * okr.js — OKR 목표 관리 (직원)
 */

import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS_MY_OKR = 'hr_my_okr';
const LS_TEAM_OKR = 'hr_team_okr';

const QUARTER = (() => {
  const m = new Date().getMonth();
  return `Q${Math.floor(m / 3) + 1}`;
})();
const YEAR = new Date().getFullYear();
const PERIOD = `${YEAR} ${QUARTER}`;

const DEMO_TEAM_OKR = [
  {
    id: 'TOKR001', period: PERIOD, owner: '경영진',
    objective: '제품 시장 적합성 달성 및 초기 고객 확보',
    keyResults: [
      { id:'tkr1', text:'유료 고객 50개사 확보', target:50, current:23, unit:'개사' },
      { id:'tkr2', text:'NPS 점수 45 이상 달성',  target:45, current:38, unit:'점' },
      { id:'tkr3', text:'월간 활성 사용자 1,000명', target:1000, current:650, unit:'명' },
    ],
  },
  {
    id: 'TOKR002', period: PERIOD, owner: '개발팀',
    objective: '제품 안정성 및 신기능 출시 가속',
    keyResults: [
      { id:'tkr4', text:'서비스 가용성 99.9% 유지', target:99.9, current:99.7, unit:'%' },
      { id:'tkr5', text:'스프린트 속도 20% 향상',   target:20,   current:12,   unit:'%' },
    ],
  },
  {
    id: 'TOKR003', period: PERIOD, owner: 'HR팀',
    objective: '인재 유지율 제고 및 조직 문화 강화',
    keyResults: [
      { id:'tkr6', text:'이직률 10% 이하 유지',      target:10,  current:7.5, unit:'%' },
      { id:'tkr7', text:'직원 만족도 4.2/5 이상',    target:4.2, current:3.9, unit:'점' },
      { id:'tkr8', text:'온보딩 완료율 100%',         target:100, current:88,  unit:'%' },
    ],
  },
];

function _getMyOkr() {
  const saved = localStorage.getItem(LS_MY_OKR);
  if (!saved) {
    const demo = [{
      id: 'MOKR001', period: PERIOD,
      objective: '팀 핵심 프로젝트 성공적 완수',
      keyResults: [
        { id:'mkr1', text:'주요 기능 3개 배포',   target:3,   current:1, unit:'개' },
        { id:'mkr2', text:'코드 리뷰 응답률 90%', target:90,  current:72, unit:'%' },
        { id:'mkr3', text:'기술 부채 20% 감소',   target:20,  current:8,  unit:'%' },
      ],
    }];
    localStorage.setItem(LS_MY_OKR, JSON.stringify(demo));
    return demo;
  }
  try { return JSON.parse(saved); } catch { return []; }
}

function _saveMyOkr(list) {
  localStorage.setItem(LS_MY_OKR, JSON.stringify(list));
  // dashboard/analytics reads 'hr_okr_goals' — keep in sync
  localStorage.setItem('hr_okr_goals', JSON.stringify(list));
}

function _getTeamOkr() {
  const saved = localStorage.getItem(LS_TEAM_OKR);
  if (!saved) { localStorage.setItem(LS_TEAM_OKR, JSON.stringify(DEMO_TEAM_OKR)); return DEMO_TEAM_OKR; }
  try { return JSON.parse(saved); } catch { return DEMO_TEAM_OKR; }
}

function _progress(current, target) {
  if (!target) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

function _progressColor(pct) {
  if (pct >= 75) return '#10B981';
  if (pct >= 40) return '#F59E0B';
  return '#EF4444';
}

let _tab = 'mine';  // 'mine' | 'team' | 'add'
let _editKr = null; // {okrId, krId, current}

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _tab = 'mine';
  _editKr = null;
  _render(root);
}

export function unmount() {
  _tab = 'mine';
  _editKr = null;
}

function _render(root) {
  if (_tab === 'add') { _renderAddForm(root); return; }

  const myOkrs  = _getMyOkr();
  const teamOkrs = _getTeamOkr().filter(o => o.period === PERIOD);

  const avgMyPct = (() => {
    const krs = myOkrs.flatMap(o => o.keyResults);
    if (!krs.length) return 0;
    return Math.round(krs.reduce((s, k) => s + _progress(k.current, k.target), 0) / krs.length);
  })();

  root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">

  <!-- 상단 -->
  <div class="top-bar" style="display:flex;align-items:center;gap:10px;padding:12px 16px;
       background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="ob-back" style="background:none;border:none;font-size:20px;cursor:pointer;
            color:var(--text);padding:0">←</button>
    <div style="flex:1">
      <div style="font-size:15px;font-weight:700">🎯 OKR 목표 관리</div>
      <div style="font-size:11px;color:var(--text-muted)">${PERIOD} · 내 달성률 <strong style="color:${_progressColor(avgMyPct)}">${avgMyPct}%</strong></div>
    </div>
    <button id="add-okr-btn" style="background:#4F46E5;color:#fff;border:none;border-radius:10px;
      padding:7px 12px;font-size:12px;font-weight:600;cursor:pointer">+ OKR 추가</button>
  </div>

  <!-- 탭 -->
  <div style="display:flex;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    ${[['mine','내 OKR'],['team','팀 OKR']].map(([key,lbl])=>`
    <button class="okr-tab" data-tab="${key}"
      style="flex:1;padding:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;
             background:none;border-bottom:2px solid ${_tab===key?'#4F46E5':'transparent'};
             color:${_tab===key?'#4F46E5':'var(--text-muted)'}">${lbl}</button>`).join('')}
  </div>

  <!-- 내용 -->
  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${_tab === 'mine' ? _renderMine(myOkrs) : _renderTeam(teamOkrs)}
  </div>

</div>

${_editKr ? _renderEditModal() : ''}
`;

  root.querySelector('#ob-back').addEventListener('click', () => window.navBack());
  root.querySelector('#add-okr-btn').addEventListener('click', () => { _tab = 'add'; _render(root); });
  root.querySelectorAll('.okr-tab').forEach(btn =>
    btn.addEventListener('click', () => { _tab = btn.dataset.tab; _render(root); })
  );

  root.querySelectorAll('.update-kr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _editKr = { okrId: btn.dataset.okrId, krId: btn.dataset.krId, current: parseFloat(btn.dataset.current) };
      _render(root);
    });
  });

  if (_editKr) {
    root.querySelector('#edit-modal-backdrop')?.addEventListener('click', () => { _editKr = null; _render(root); });
    root.querySelector('#edit-cancel')?.addEventListener('click', () => { _editKr = null; _render(root); });
    root.querySelector('#edit-save')?.addEventListener('click', () => {
      const val = parseFloat(root.querySelector('#edit-val').value);
      if (isNaN(val)) { showToast('숫자를 입력하세요.', 'error'); return; }
      const list = _getMyOkr();
      const okr = list.find(o => o.id === _editKr.okrId);
      if (okr) {
        const kr = okr.keyResults.find(k => k.id === _editKr.krId);
        if (kr) kr.current = val;
      }
      _saveMyOkr(list);
      showToast('진행률이 업데이트되었습니다.', 'success');
      addNotification({ type: 'success', title: 'OKR', body: '진행률이 업데이트되었습니다.' });
      _editKr = null;
      _render(root);
    });
  }
}

function _renderMine(okrs) {
  if (!okrs.length) return `
<div style="text-align:center;padding:50px 20px;color:var(--text-muted)">
  <div style="font-size:40px;margin-bottom:12px">🎯</div>
  <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:6px">OKR이 없습니다</div>
      <button onclick="location.hash='#/okr'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">OKR 작성</button>
    
  <div style="font-size:12px">+ OKR 추가 버튼을 눌러 목표를 설정하세요.</div>
</div>`;

  return okrs.map(okr => {
    const krs = okr.keyResults;
    const avg = Math.round(krs.reduce((s, k) => s + _progress(k.current, k.target), 0) / krs.length);
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
     padding:14px;margin-bottom:12px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
    <div style="flex:1;min-width:0">
      <div style="font-size:11px;font-weight:700;color:#4F46E5;margin-bottom:4px">${okr.period}</div>
      <div style="font-size:13px;font-weight:700;color:var(--text);line-height:1.4">${okr.objective}</div>
    </div>
    <div style="font-size:22px;font-weight:800;color:${_progressColor(avg)};margin-left:12px;flex-shrink:0">${avg}%</div>
  </div>

  <!-- 전체 Progress bar -->
  <div style="background:#E2E8F0;border-radius:99px;height:6px;margin-bottom:12px">
    <div style="background:${_progressColor(avg)};height:6px;border-radius:99px;
         width:${avg}%;transition:width 0.3s"></div>
  </div>

  <!-- Key Results -->
  <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px">핵심 결과 (KR)</div>
  ${krs.map(kr => {
    const pct = _progress(kr.current, kr.target);
    return `
  <div style="padding:8px 0;border-bottom:1px solid var(--border)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <div style="font-size:12px;color:var(--text);flex:1;min-width:0;padding-right:8px">${kr.text}</div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <span style="font-size:12px;font-weight:700;color:${_progressColor(pct)}">${kr.current}/${kr.target}${kr.unit}</span>
        <button class="update-kr-btn" data-okr-id="${okr.id}" data-kr-id="${kr.id}" data-current="${kr.current}"
          style="background:#EEF2FF;color:#4338CA;border:none;border-radius:7px;
                 padding:3px 8px;font-size:11px;font-weight:600;cursor:pointer">수정</button>
      </div>
    </div>
    <div style="background:#E2E8F0;border-radius:99px;height:4px">
      <div style="background:${_progressColor(pct)};height:4px;border-radius:99px;width:${pct}%"></div>
    </div>
  </div>`;
  }).join('')}
</div>`;
  }).join('');
}

function _renderTeam(okrs) {
  if (!okrs.length) return `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
    <div style="font-size:48px;margin-bottom:12px">🎯</div>
    <div style="font-size:14px;font-weight:600;color:var(--text-muted);margin-bottom:6px">팀 OKR이 없습니다</div>
    <div style="font-size:12px;margin-bottom:16px">관리자가 OKR을 등록하면 여기에 표시됩니다.</div>
  </div>`;
  return okrs.map(okr => {
    const krs = okr.keyResults;
    const avg = Math.round(krs.reduce((s, k) => s + _progress(k.current, k.target), 0) / krs.length);
    return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
     padding:14px;margin-bottom:12px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div>
      <span style="font-size:11px;font-weight:700;color:#4F46E5;background:#EEF2FF;
            padding:2px 8px;border-radius:8px;margin-right:6px">${okr.owner}</span>
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-top:6px;line-height:1.4">${okr.objective}</div>
    </div>
    <div style="font-size:22px;font-weight:800;color:${_progressColor(avg)};flex-shrink:0;margin-left:10px">${avg}%</div>
  </div>
  <div style="background:#E2E8F0;border-radius:99px;height:5px;margin-bottom:10px">
    <div style="background:${_progressColor(avg)};height:5px;border-radius:99px;width:${avg}%"></div>
  </div>
  ${krs.map(kr => {
    const pct = _progress(kr.current, kr.target);
    return `
  <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">
    <div style="flex:1;font-size:12px;color:var(--text)">${kr.text}</div>
    <span style="font-size:12px;font-weight:700;color:${_progressColor(pct)};white-space:nowrap">
      ${kr.current}/${kr.target}${kr.unit}
    </span>
  </div>`;
  }).join('')}
</div>`;
  }).join('');
}

function _renderEditModal() {
  const list = _getMyOkr();
  const okr = list.find(o => o.id === _editKr.okrId);
  const kr  = okr?.keyResults.find(k => k.id === _editKr.krId);
  if (!kr) return '';

  return `
<div id="edit-modal-backdrop"
     style="position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:3000;
            display:flex;align-items:flex-end;justify-content:center">
  <div style="background:var(--card-bg);border-radius:20px 20px 0 0;width:100%;max-width:480px;
       padding:24px 20px 36px" onclick="event.stopPropagation()">
    <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px">진행률 업데이트</div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px">${kr.text}</div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
      <input id="edit-val" type="number" value="${kr.current}" min="0" max="${kr.target * 2}"
        style="flex:1;padding:12px;border:2px solid #4F46E5;border-radius:12px;
               font-size:16px;font-weight:700;text-align:center;background:var(--bg);color:var(--text)">
      <div style="font-size:14px;color:var(--text-muted)">/ ${kr.target} ${kr.unit}</div>
    </div>
    <div style="display:flex;gap:8px">
      <button id="edit-cancel" style="flex:1;padding:12px;border:1.5px solid var(--border);border-radius:12px;
              background:var(--bg);color:var(--text);font-size:13px;font-weight:600;cursor:pointer">취소</button>
      <button id="edit-save" style="flex:1;padding:12px;border:none;border-radius:12px;
              background:#4F46E5;color:#fff;font-size:13px;font-weight:600;cursor:pointer">저장</button>
    </div>
  </div>
</div>`;
}

function _renderAddForm(root) {
  let krCount = 3;

  const renderForm = () => {
    root.innerHTML = `
<div style="padding:16px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <button id="back-btn" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text)">←</button>
    <div style="font-size:15px;font-weight:700">🎯 OKR 추가</div>
  </div>

  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px">
    <div style="margin-bottom:14px">
      <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600">목표 (Objective)</label>
      <textarea maxlength="500" id="okr-obj" placeholder="달성하고 싶은 큰 방향성을 입력하세요…"
        style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;
               font-size:13px;background:var(--bg);color:var(--text);
               box-sizing:border-box;height:70px;resize:vertical"></textarea>
    </div>

    <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:8px">핵심 결과 (Key Results)</div>
    ${Array.from({length:krCount}, (_,i)=>`
    <div style="background:var(--bg);border-radius:10px;padding:10px;margin-bottom:8px">
      <div style="font-size:10px;color:var(--text-muted);margin-bottom:6px">KR ${i+1}</div>
      <input id="kr-text-${i}" type="text" placeholder="측정 가능한 결과 지표…"
        style="width:100%;padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;
               font-size:12px;background:var(--card-bg);color:var(--text);box-sizing:border-box;margin-bottom:6px">
      <div style="display:grid;grid-template-columns:1fr 1fr 80px;gap:6px">
        <div>
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px">현재값</div>
          <input id="kr-cur-${i}" type="number" min="0" value="0" placeholder="0"
            style="width:100%;padding:6px 8px;border:1.5px solid var(--border);border-radius:8px;
                   font-size:12px;background:var(--card-bg);color:var(--text);box-sizing:border-box">
        </div>
        <div>
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px">목표값</div>
          <input id="kr-tar-${i}" type="number" min="0" value="100" placeholder="100"
            style="width:100%;padding:6px 8px;border:1.5px solid var(--border);border-radius:8px;
                   font-size:12px;background:var(--card-bg);color:var(--text);box-sizing:border-box">
        </div>
        <div>
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px">단위</div>
          <input id="kr-unit-${i}" type="text" value="%" placeholder="%"
            style="width:100%;padding:6px 8px;border:1.5px solid var(--border);border-radius:8px;
                   font-size:12px;background:var(--card-bg);color:var(--text);box-sizing:border-box">
        </div>
      </div>
    </div>`).join('')}

    <button id="add-kr-btn"
      style="width:100%;padding:8px;border:1.5px dashed var(--border);border-radius:10px;
             background:none;color:var(--text-muted);font-size:12px;font-weight:600;cursor:pointer">
      + KR 추가
    </button>
  </div>

  <button id="save-btn" style="width:100%;background:#4F46E5;color:#fff;border:none;
    border-radius:12px;padding:14px;font-size:14px;font-weight:700;cursor:pointer">저장하기</button>
</div>`;

    root.querySelector('#back-btn').addEventListener('click', () => { _tab = 'mine'; _render(root); });
    root.querySelector('#add-kr-btn').addEventListener('click', () => { krCount++; renderForm(); });
    root.querySelector('#save-btn').addEventListener('click', () => {
      const obj = root.querySelector('#okr-obj').value.trim();
      if (!obj) { showToast('목표를 입력하세요.', 'error'); return; }
      const krs = [];
      for (let i = 0; i < krCount; i++) {
        const text = root.querySelector(`#kr-text-${i}`)?.value.trim();
        if (!text) continue;
        krs.push({
          id: `mkr_${Date.now()}_${i}`,
          text,
          current: parseFloat(root.querySelector(`#kr-cur-${i}`).value) || 0,
          target:  parseFloat(root.querySelector(`#kr-tar-${i}`).value) || 100,
          unit:    root.querySelector(`#kr-unit-${i}`).value.trim() || '%',
        });
      }
      if (!krs.length) { showToast('KR을 최소 1개 입력하세요.', 'error'); return; }
      const list = _getMyOkr();
      list.push({ id: 'MOKR_' + Date.now(), period: PERIOD, objective: obj, keyResults: krs });
      _saveMyOkr(list);
      showToast('OKR이 저장되었습니다.', 'success');
      addNotification({ type: 'success', title: 'OKR', body: 'OKR이 저장되었습니다.' });
      _tab = 'mine';
      _render(root);
    });
  };

  renderForm();
}
