/**
 * aptitude_test.js — 인적성 검사 실시 페이지
 * HR Competency OS
 *
 * 6 섹션 순차 진행: 언어추론 → 수리추론 → 추리능력 → 상황판단 → 성실성 → 직무기초역량
 * 섹션별 타이머 · 자동 채점 · T점수 산출 · 결과 저장
 */

import { APTITUDE_QUESTIONS, DOMAIN_CONFIG, getActiveQuestions } from '../../data/aptitude_questions.js';
import { navigate } from '../../app.js';
import { getUser } from '../../auth.js';

// ── Module state ───────────────────────────────────────────────
let _root     = null;
let _timer    = null; // setInterval id
let _state    = {};

const LS_RESULT  = 'hr_apt_result';
const LS_OVERRIDES = 'hr_apt_overrides';

// Section order
const SECTION_ORDER = ['verbal','numerical','abstract','sjt','big5','ncs'];

// ── Helpers ────────────────────────────────────────────────────
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function getOverrides(){
  try { return JSON.parse(localStorage.getItem(LS_OVERRIDES)||'{}'); } catch { return {}; }
}

function getConfig(){
  try { return JSON.parse(localStorage.getItem('hr_apt_config')||'{}'); } catch { return {}; }
}

function initState(){
  const overrides = getOverrides();
  const config    = getConfig();
  const allQ      = getActiveQuestions(overrides);

  // Build sections: pick questions per domain, respect admin config counts
  const sections = SECTION_ORDER.map(domain => {
    const cfg = config[domain] || {};
    const qs  = allQ.filter(q => q.domain === domain);
    const max = cfg.count || qs.length;
    return {
      domain,
      meta: DOMAIN_CONFIG[domain],
      questions: qs.slice(0, max),
      timeMin: cfg.timeMin || DOMAIN_CONFIG[domain].timeMin,
    };
  }).filter(s => s.questions.length > 0);

  _state = {
    phase:      'intro',    // intro | section | result
    sectionIdx: 0,
    qIdx:       0,
    answers:    {},         // { questionId: answer }
    sjtPick:    {},         // { questionId: { best: idx, worst: idx } }
    secsLeft:   0,
    sections,
  };
}

function currentSection(){ return _state.sections[_state.sectionIdx]; }
function currentQ(){ return currentSection()?.questions[_state.qIdx]; }

// ── Timer ──────────────────────────────────────────────────────
function startTimer(){
  clearInterval(_timer);
  const sec = currentSection();
  _state.secsLeft = (sec?.timeMin || 10) * 60;
  _timer = setInterval(() => {
    _state.secsLeft--;
    updateTimerDisplay();
    if (_state.secsLeft <= 0) {
      clearInterval(_timer);
      advanceSection(true);
    }
  }, 1000);
}

function updateTimerDisplay(){
  const el = _root?.querySelector('#apt-timer');
  if (!el) return;
  const m = Math.floor(_state.secsLeft / 60);
  const s = String(_state.secsLeft % 60).padStart(2,'0');
  el.textContent = `${m}:${s}`;
  el.style.color = _state.secsLeft < 60 ? '#EF4444' : _state.secsLeft < 180 ? '#F59E0B' : '#10B981';
}

// ── Scoring ────────────────────────────────────────────────────
function computeScores(){
  const results = {};
  const overrides = getOverrides();
  const allQ = getActiveQuestions(overrides);

  SECTION_ORDER.forEach(domain => {
    const qs = allQ.filter(q => q.domain === domain);
    if (!qs.length){ results[domain] = null; return; }

    let raw = 0, max = 0;

    qs.forEach(q => {
      if (q.type === 'mcq'){
        max += 1;
        if (_state.answers[q.id] === q.correct) raw += 1;
      } else if (q.type === 'sjt'){
        max += 2;
        const pick = _state.sjtPick[q.id] || {};
        if (pick.best  === q.best)  raw += 1;
        if (pick.worst === q.worst) raw += 1;
      } else if (q.type === 'likert'){
        if (q.detection) return;
        max += 1;
        const ans = _state.answers[q.id]; // 1-7
        if (ans == null) return;
        const norm = ((q.direction === -1 ? (8 - ans) : ans) - 1) / 6; // 0-1
        raw += norm;
      }
    });

    const rawPct = max > 0 ? raw / max : 0;
    // T-score: mean assumed 0.55, sd 0.15; clamped 20-80
    const z = (rawPct - 0.55) / 0.15;
    const tScore = Math.min(80, Math.max(20, Math.round(50 + 10 * z)));
    const pct    = Math.round(rawPct * 100);
    results[domain] = { tScore, rawPct: Math.round(rawPct * 100), correct: Math.round(raw), total: Math.round(max) };
  });

  // GMA = mean T of verbal + numerical + abstract
  const gmaScores = ['verbal','numerical','abstract'].map(d => results[d]?.tScore).filter(v => v!=null);
  const gmaT = gmaScores.length ? Math.round(gmaScores.reduce((a,b)=>a+b,0)/gmaScores.length) : 0;

  // Composite
  const composite = Math.round(
    (gmaT * 0.40) +
    ((results.sjt?.tScore  || 50) * 0.25) +
    ((results.big5?.tScore || 50) * 0.20) +
    ((results.ncs?.tScore  || 50) * 0.15)
  );

  // Grade
  let grade = 'D';
  if (composite >= 67) grade = 'S';
  else if (composite >= 58) grade = 'A';
  else if (composite >= 50) grade = 'B';
  else if (composite >= 43) grade = 'C';

  // Social desirability check
  const detectionQs = getActiveQuestions(overrides).filter(q => q.detection);
  const flagCount = detectionQs.filter(q => (_state.answers[q.id] || 0) >= 7).length;
  const flagged = flagCount >= 2;

  return { domains: results, gmaT, composite, grade, flagged };
}

// ── Render: Intro ──────────────────────────────────────────────
function renderIntro(){
  const totalMin = _state.sections.reduce((s,sec) => s + sec.timeMin, 0);
  const totalQ   = _state.sections.reduce((s,sec) => s + sec.questions.length, 0);

  _root.innerHTML = `
    <div style="min-height:100vh;background:var(--bg,#F8FAFC);padding:0 0 80px;">

      <div style="background:linear-gradient(135deg,#1E293B 0%,#334155 100%);padding:48px 20px 28px;color:#fff;text-align:center;">
        <button id="test-back" style="position:absolute;top:48px;left:16px;background:rgba(255,255,255,0.12);border:none;color:#fff;padding:6px 12px;border-radius:8px;font-size:13px;cursor:pointer;">← 소개</button>
        <div style="font-size:2rem;margin-bottom:8px;">🎯</div>
        <h1 style="margin:0;font-size:20px;font-weight:800;">인적성 검사 시작</h1>
        <p style="margin:8px 0 0;font-size:13px;opacity:0.75;">총 ${totalQ}문항 · 약 ${totalMin}분</p>
      </div>

      <div style="padding:16px;display:flex;flex-direction:column;gap:12px;">

        <!-- 주의사항 -->
        <div style="background:#FFF7ED;border-radius:12px;padding:16px;border:1.5px solid #FED7AA;">
          <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#C2410C;">⚠️ 검사 전 주의사항</p>
          ${['각 섹션에는 시간 제한이 있습니다. 시간이 종료되면 자동으로 다음 섹션으로 넘어갑니다.',
             '섹션 간 이동은 불가합니다. 이전 섹션으로 돌아갈 수 없습니다.',
             '성실성 척도(상황판단 포함)는 정답이 없습니다. 솔직하게 답변하세요.',
             '결과는 커리어 프로필에 저장되며 원하는 경우 HR 담당자에게 공개할 수 있습니다.',
          ].map(t=>`<p style="margin:4px 0;font-size:12px;color:#9A3412;line-height:1.5;">• ${esc(t)}</p>`).join('')}
        </div>

        <!-- 섹션 구성 -->
        <div style="background:#fff;border-radius:12px;padding:16px;border:1px solid var(--border,#E2E8F0);">
          <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:var(--text,#1E293B);">📋 검사 구성</p>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${_state.sections.map((sec,i) => `
              <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:${sec.meta.bg};border-radius:8px;border:1px solid ${sec.meta.bg};">
                <span style="width:24px;height:24px;background:${sec.meta.color};color:#fff;border-radius:50%;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i+1}</span>
                <span style="font-size:1.1rem;">${sec.meta.icon}</span>
                <div style="flex:1;">
                  <span style="font-size:13px;font-weight:600;color:${sec.meta.color};">${esc(sec.meta.name)}</span>
                  <span style="font-size:11px;color:#64748B;margin-left:8px;">${sec.questions.length}문항 · ${sec.timeMin}분</span>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <button id="test-start" style="padding:16px;background:linear-gradient(135deg,#4F46E5,#7C3AED);color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;width:100%;">
          🚀 검사 시작하기
        </button>

      </div>
    </div>`;

  _root.querySelector('#test-back')?.addEventListener('click', () => navigate('#/aptitude'));
  _root.querySelector('#test-start')?.addEventListener('click', () => {
    _state.phase = 'section';
    startTimer();
    renderSection();
  });
}

// ── Render: Section ────────────────────────────────────────────
function renderSection(){
  const sec = currentSection();
  const q   = currentQ();
  if (!sec || !q){ advanceSection(); return; }

  const qi    = _state.qIdx;
  const total = sec.questions.length;
  const pct   = Math.round((qi / total) * 100);

  const secIdx  = _state.sectionIdx;
  const secTotal = _state.sections.length;

  _root.innerHTML = `
    <div style="min-height:100vh;background:var(--bg,#F8FAFC);display:flex;flex-direction:column;">

      <!-- Top bar -->
      <div style="background:#fff;border-bottom:1px solid var(--border,#E2E8F0);padding:10px 16px;position:sticky;top:0;z-index:10;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div>
            <span style="font-size:13px;font-weight:700;color:${sec.meta.color};">${sec.meta.icon} ${esc(sec.meta.name)}</span>
            <span style="font-size:12px;color:#94A3B8;margin-left:8px;">섹션 ${secIdx+1}/${secTotal}</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:13px;color:#64748B;">${qi+1} / ${total}</span>
            <span id="apt-timer" style="font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;color:#10B981;min-width:44px;text-align:right;"></span>
          </div>
        </div>
        <!-- Progress bar -->
        <div style="height:4px;background:#E2E8F0;border-radius:2px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${sec.meta.color};border-radius:2px;transition:width .3s;"></div>
        </div>
      </div>

      <!-- Question area -->
      <div style="padding:16px 16px 8px;" id="q-area">
        ${renderQuestion(q)}
      </div>

      <!-- Navigation -->
      <div style="padding:12px 16px;background:#fff;border-top:1px solid var(--border,#E2E8F0);display:flex;gap:10px;position:sticky;bottom:0;">
        <button id="btn-prev" style="flex:1;padding:13px;background:#F1F5F9;color:#475569;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;${qi===0?'opacity:0.4;pointer-events:none;':''}">← 이전</button>
        <button id="btn-next" style="flex:2;padding:13px;background:${sec.meta.color};color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">
          ${qi < total-1 ? '다음 →' : secIdx < secTotal-1 ? '다음 섹션 →' : '제출하기 ✓'}
        </button>
      </div>
    </div>`;

  updateTimerDisplay();
  bindQuestionEvents();
}

function renderQuestion(q){
  if (q.type === 'mcq'){
    const saved = _state.answers[q.id];
    return `
      <div style="margin-bottom:16px;">
        <p style="margin:0 0 16px;font-size:15px;font-weight:500;color:var(--text,#1E293B);line-height:1.6;">${esc(q.text)}</p>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${q.options.map((opt,i) => `
            <button class="mcq-opt" data-idx="${i}" style="padding:12px 14px;text-align:left;border-radius:10px;border:2px solid ${saved===i?'#4F46E5':'#E2E8F0'};background:${saved===i?'#EEF2FF':'#fff'};color:${saved===i?'#4F46E5':'#334155'};font-size:13px;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:10px;">
              <span style="width:24px;height:24px;border-radius:50%;background:${saved===i?'#4F46E5':'#E2E8F0'};color:${saved===i?'#fff':'#64748B'};font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${String.fromCharCode(65+i)}</span>
              ${esc(opt)}
            </button>`).join('')}
        </div>
      </div>`;
  }

  if (q.type === 'sjt'){
    const pick = _state.sjtPick[q.id] || {};
    return `
      <div style="margin-bottom:16px;">
        <div style="background:#F8FAFC;border-radius:10px;padding:14px;margin-bottom:14px;border-left:3px solid #059669;">
          <p style="margin:0;font-size:14px;color:#1E293B;line-height:1.6;">${esc(q.scenario)}</p>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:10px;">
          <div style="flex:1;padding:8px;background:#ECFDF5;border-radius:8px;text-align:center;font-size:12px;font-weight:600;color:#059669;">✅ 가장 적절한 행동</div>
          <div style="flex:1;padding:8px;background:#FEF2F2;border-radius:8px;text-align:center;font-size:12px;font-weight:600;color:#DC2626;">❌ 가장 부적절한 행동</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${q.options.map((opt,i) => {
            const isBest  = pick.best  === i;
            const isWorst = pick.worst === i;
            const bg    = isBest ? '#ECFDF5' : isWorst ? '#FEF2F2' : '#fff';
            const border = isBest ? '#059669' : isWorst ? '#DC2626' : '#E2E8F0';
            return `
              <div style="padding:12px 14px;border-radius:10px;border:2px solid ${border};background:${bg};display:flex;align-items:center;gap:8px;">
                <span style="width:24px;height:24px;border-radius:50%;background:#E2E8F0;color:#64748B;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${String.fromCharCode(65+i)}</span>
                <span style="flex:1;font-size:13px;color:#334155;">${esc(opt)}</span>
                <div style="display:flex;gap:4px;flex-shrink:0;">
                  <button class="sjt-best" data-idx="${i}" title="가장 적절"
                    style="width:28px;height:28px;border-radius:6px;border:none;cursor:pointer;font-size:14px;background:${isBest?'#059669':'#E2E8F0'};color:${isBest?'#fff':'#94A3B8'};">✓</button>
                  <button class="sjt-worst" data-idx="${i}" title="가장 부적절"
                    style="width:28px;height:28px;border-radius:6px;border:none;cursor:pointer;font-size:14px;background:${isWorst?'#DC2626':'#E2E8F0'};color:${isWorst?'#fff':'#94A3B8'};">✗</button>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  if (q.type === 'likert'){
    const saved = _state.answers[q.id];
    const labels = ['전혀 아니다','','','보통','','','매우 그렇다'];
    return `
      <div style="margin-bottom:16px;">
        ${q.detection ? `<div style="background:#FFFBEB;border-radius:6px;padding:6px 10px;margin-bottom:8px;font-size:11px;color:#D97706;">솔직하게 응답해주세요</div>` : ''}
        <p style="margin:0 0 20px;font-size:15px;font-weight:500;color:var(--text,#1E293B);line-height:1.6;">${esc(q.text)}</p>
        <div style="display:flex;gap:4px;justify-content:center;margin-bottom:8px;">
          ${[1,2,3,4,5,6,7].map(v => `
            <button class="likert-opt" data-val="${v}"
              style="width:40px;height:40px;border-radius:8px;border:2px solid ${saved===v?'#D97706':'#E2E8F0'};background:${saved===v?'#FEF3C7':'#fff'};color:${saved===v?'#D97706':'#64748B'};font-size:14px;font-weight:700;cursor:pointer;flex-shrink:0;">
              ${v}
            </button>`).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;padding:0 4px;">
          <span style="font-size:10px;color:#94A3B8;">전혀 아니다</span>
          <span style="font-size:10px;color:#94A3B8;">매우 그렇다</span>
        </div>
      </div>`;
  }

  return `<p style="color:#94A3B8;">알 수 없는 문항 유형</p>`;
}

// ── Question events ────────────────────────────────────────────
function bindQuestionEvents(){
  const q = currentQ();
  if (!q) return;

  _root.querySelector('#btn-prev')?.addEventListener('click', () => {
    if (_state.qIdx > 0){ _state.qIdx--; renderSection(); }
  });

  _root.querySelector('#btn-next')?.addEventListener('click', () => {
    const sec = currentSection();
    if (_state.qIdx < sec.questions.length - 1){
      _state.qIdx++;
      renderSection();
    } else {
      advanceSection(false);
    }
  });

  // MCQ options
  _root.querySelectorAll('.mcq-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      _state.answers[q.id] = parseInt(btn.dataset.idx);
      renderSection();
    });
  });

  // SJT best/worst
  _root.querySelectorAll('.sjt-best').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      const pick = _state.sjtPick[q.id] || {};
      if (pick.worst === idx) return; // can't be both
      _state.sjtPick[q.id] = { ...pick, best: idx };
      renderSection();
    });
  });
  _root.querySelectorAll('.sjt-worst').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      const pick = _state.sjtPick[q.id] || {};
      if (pick.best === idx) return;
      _state.sjtPick[q.id] = { ...pick, worst: idx };
      renderSection();
    });
  });

  // Likert options
  _root.querySelectorAll('.likert-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      _state.answers[q.id] = parseInt(btn.dataset.val);
      renderSection();
    });
  });
}

// ── Section advance ────────────────────────────────────────────
function advanceSection(timeUp = false){
  clearInterval(_timer);

  if (_state.sectionIdx < _state.sections.length - 1){
    _state.sectionIdx++;
    _state.qIdx = 0;
    renderSectionTransition(timeUp);
  } else {
    // All done
    finalize();
  }
}

function renderSectionTransition(timeUp){
  const sec = currentSection();
  _root.innerHTML = `
    <div style="min-height:100vh;background:var(--bg,#F8FAFC);display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="background:#fff;border-radius:16px;padding:32px 24px;text-align:center;max-width:320px;width:100%;">
        <div style="font-size:2.5rem;margin-bottom:12px;">${timeUp ? '⏰' : '✅'}</div>
        <h2 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1E293B;">
          ${timeUp ? '시간이 종료되었습니다' : '섹션 완료!'}
        </h2>
        <p style="margin:0 0 24px;font-size:14px;color:#64748B;">
          다음 섹션: <strong style="color:${sec.meta.color};">${sec.meta.icon} ${esc(sec.meta.name)}</strong><br>
          <span style="font-size:12px;">${sec.questions.length}문항 · ${sec.timeMin}분</span>
        </p>
        <button id="next-sec-btn" style="width:100%;padding:14px;background:${sec.meta.color};color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;">
          시작하기 →
        </button>
      </div>
    </div>`;

  _root.querySelector('#next-sec-btn')?.addEventListener('click', () => {
    startTimer();
    renderSection();
  });
}

// ── Finalize & save result ─────────────────────────────────────
function finalize(){
  clearInterval(_timer);
  const scores = computeScores();
  const user = getUser();
  const record = {
    id:        Date.now().toString(),
    userId:    user?.id || 'anonymous',
    date:      new Date().toISOString(),
    scores,
    answers:   _state.answers,
    sjtPick:   _state.sjtPick,
  };

  // Save to localStorage (keyed by userId to avoid cross-user contamination)
  try {
    const userKey = `hr_apt_result_${record.userId}`;
    localStorage.setItem(userKey, JSON.stringify(record));
    // Also write to legacy key for admin stats panel
    localStorage.setItem(LS_RESULT, JSON.stringify(record));
    const allKey = `hr_apt_results_${record.userId}`;
    const all = JSON.parse(localStorage.getItem(allKey) || '[]');
    all.unshift(record);
    localStorage.setItem(allKey, JSON.stringify(all.slice(0, 50)));
    // Legacy aggregate key for admin stats
    const allLegacy = JSON.parse(localStorage.getItem('hr_apt_results') || '[]');
    allLegacy.unshift(record);
    localStorage.setItem('hr_apt_results', JSON.stringify(allLegacy.slice(0, 200)));
  } catch {}

  renderResult(scores);
}

// ── Render: Result ─────────────────────────────────────────────
function renderResult(scores){
  const { domains, gmaT, composite, grade, flagged } = scores;

  const gradeColor = {S:'#4F46E5',A:'#0891B2',B:'#059669',C:'#D97706',D:'#94A3B8'}[grade]||'#94A3B8';
  const gradeDesc  = {S:'상위 10%',A:'상위 25%',B:'상위 50%',C:'하위 50%',D:'하위 25%'}[grade]||'';

  const domainRows = SECTION_ORDER.map(domain => {
    const d    = domains[domain];
    const meta = DOMAIN_CONFIG[domain];
    if (!d) return '';
    const barW = Math.round((d.tScore - 20) / 60 * 100);
    return `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:12px;font-weight:600;color:${meta.color};">${meta.icon} ${esc(meta.name)}</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:11px;color:#94A3B8;">${d.correct}/${d.total}${domain==='big5'?'':' 정답'}</span>
            <span style="font-size:12px;font-weight:700;color:${meta.color};">T${d.tScore}</span>
          </div>
        </div>
        <div style="height:8px;background:#E2E8F0;border-radius:4px;overflow:hidden;">
          <div style="width:${barW}%;height:100%;background:${meta.color};border-radius:4px;transition:width 1s ease;"></div>
        </div>
      </div>`;
  }).join('');

  _root.innerHTML = `
    <div style="min-height:100vh;background:var(--bg,#F8FAFC);padding:0 0 80px;">

      <!-- 결과 헤더 -->
      <div style="background:linear-gradient(135deg,${gradeColor} 0%,${gradeColor}CC 100%);padding:48px 20px 28px;color:#fff;text-align:center;">
        <p style="margin:0 0 4px;font-size:13px;opacity:0.8;">인적성 검사 결과</p>
        <div style="font-size:4rem;font-weight:900;line-height:1;">${grade}</div>
        <p style="margin:4px 0 0;font-size:13px;opacity:0.85;">${gradeDesc}</p>
        <div style="margin-top:12px;font-size:1.5rem;font-weight:700;">종합 T점수 ${composite}</div>
      </div>

      <div style="padding:16px;display:flex;flex-direction:column;gap:14px;">

        ${flagged ? `
          <div style="background:#FFFBEB;border-radius:10px;padding:14px;border:1.5px solid #FDE68A;">
            <p style="margin:0;font-size:13px;color:#D97706;">⚠️ <strong>신뢰도 주의</strong>: 일부 응답에서 사회적 바람직성 경향이 감지되었습니다. 결과 해석 시 참고하세요.</p>
          </div>` : ''}

        <!-- 종합 점수 카드 -->
        <div style="background:#fff;border-radius:12px;padding:18px;border:1px solid var(--border,#E2E8F0);">
          <h2 style="margin:0 0 14px;font-size:14px;font-weight:700;color:var(--text,#1E293B);">📊 영역별 T점수</h2>
          <div style="background:#EEF2FF;border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:13px;font-weight:600;color:#4F46E5;">인지능력 (GMA) 종합</span>
            <span style="font-size:16px;font-weight:800;color:#4F46E5;">T${gmaT}</span>
          </div>
          ${domainRows}
          <p style="margin:10px 0 0;font-size:11px;color:#94A3B8;">T점수: 평균=50, SD=10. 50 이상이면 평균 이상입니다.</p>
        </div>

        <!-- 등급 기준 -->
        <div style="background:#fff;border-radius:12px;padding:18px;border:1px solid var(--border,#E2E8F0);">
          <h2 style="margin:0 0 12px;font-size:14px;font-weight:700;color:var(--text,#1E293B);">🏅 등급 기준</h2>
          <div style="display:flex;gap:6px;">
            ${[['S','T≥67','상위 10%','#4F46E5'],['A','T≥58','상위 25%','#0891B2'],['B','T≥50','상위 50%','#059669'],['C','T≥43','하위 50%','#D97706'],['D','T<43','하위 25%','#94A3B8']].map(([g,t,desc,c])=>`
              <div style="flex:1;text-align:center;padding:8px 4px;border-radius:8px;background:${grade===g?c:'#F8FAFC'};border:2px solid ${grade===g?c:'#E2E8F0'};">
                <div style="font-size:16px;font-weight:800;color:${grade===g?'#fff':c};">${g}</div>
                <div style="font-size:9px;color:${grade===g?'rgba(255,255,255,0.85)':'#94A3B8'};margin-top:2px;">${t}</div>
              </div>`).join('')}
          </div>
        </div>

        <!-- 액션 버튼 -->
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button id="res-idp" style="padding:14px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">
            🌱 성장 계획 세우기 (IDP)
          </button>
          <button id="res-career" style="padding:14px;background:#F1F5F9;color:#475569;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">
            💼 커리어 프로필에서 확인
          </button>
        </div>

      </div>
    </div>`;

  // Animate bars after render
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      _root.querySelectorAll('[style*="transition:width"]').forEach(el => {
        const cur = el.style.width;
        el.style.width = '0%';
        requestAnimationFrame(() => { el.style.width = cur; });
      });
    });
  });

  _root.querySelector('#res-idp')?.addEventListener('click',    () => navigate('#/idp'));
  _root.querySelector('#res-career')?.addEventListener('click', () => navigate('#/applicant/career'));
}

// ── Public API ─────────────────────────────────────────────────
export async function mount(container){
  _root = container;
  initState();
  _state.phase = 'intro';
  renderIntro();
}

export function unmount(){
  clearInterval(_timer);
  _root  = null;
  _timer = null;
}
