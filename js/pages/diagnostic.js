/**
 * diagnostic.js – Diagnostic Kit Runner
 * Supports binary (MBTI) and likert5 (DISC, Holland, Birkman, Interview) kits
 * URL: #/diagnostic?kit=KIT_MBTI
 */

import { getKitById }  from '../data/diagnostic_kits.js';
import { getUser }      from '../auth.js';
import { showToast }    from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
import { api }          from '../api.js';

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId() {
  const s = _session();
  return s.empId || s.userId || getUser()?.id || 'EMP001';
}

const RESULTS_KEY = 'hr_diag_results';

const LIKERT_LABELS = ['', '전혀 그렇지 않다', '그렇지 않다', '보통이다', '그렇다', '매우 그렇다'];
const LIKERT_COLORS = ['', '#EF4444', '#F97316', '#F59E0B', '#22C55E', '#10B981'];

let _root    = null;
let _kit     = null;
let _answers = {};   // { questionId: value }

export async function mount(root) {
  _root    = root;
  _answers = {};

  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const kitId  = params.get('kit') || 'KIT_MBTI';
  _kit         = getKitById(kitId);

  if (!_kit || !_kit.active || !_kit.questions) {
    root.innerHTML = `
      <div class="page">
        <div class="top-bar">
          <button class="top-bar-back" aria-label="뒤로">‹</button>
          <div class="top-bar-title">진단 Kit</div>
        </div>
        <div class="empty-state" style="min-height:60vh">
          <div class="empty-state-icon">🚧</div>
          <div class="empty-state-title">준비 중입니다</div>
          <div class="empty-state-desc">해당 진단 Kit은 아직 준비 중입니다.</div>
          <button class="btn btn-primary" onclick="window.location.hash='#/assessment'" style="margin-top:20px">
            돌아가기
          </button>
        </div>
      </div>`;
    return;
  }

  // Show intro screen first
  renderIntro(root);
}

export function unmount() {
  _root    = null;
  _kit     = null;
  _answers = {};
}

// ── Intro screen ──────────────────────────────────────────────

function renderIntro(root) {
  root.innerHTML = `
    <div class="page" style="background:var(--bg)">
      <div class="top-bar">
        <button class="top-bar-back" aria-label="뒤로">‹</button>
        <div class="top-bar-title">진단 안내</div>
      </div>
      <div class="page-content">

        <!-- Kit header -->
        <div class="card" style="padding:24px 20px;text-align:center;margin-bottom:20px;
                                  background:linear-gradient(135deg,#EEF2FF,#F5F3FF);
                                  border:2px solid var(--primary-light)">
          <div style="font-size:3rem;margin-bottom:10px">${_kit.icon}</div>
          <div style="font-size:1.3rem;font-weight:800;color:var(--text);margin-bottom:6px">
            ${escapeHtml(_kit.name_ko)}
          </div>
          <div style="display:inline-block;padding:3px 12px;border-radius:999px;
                      background:${_kit.color}20;color:${_kit.color};
                      font-size:0.78rem;font-weight:700;margin-bottom:12px">
            ${escapeHtml(_kit.tag_ko)}
          </div>
          <div style="font-size:0.88rem;color:var(--text);line-height:1.65;word-break:keep-all">
            ${escapeHtml(_kit.description_ko)}
          </div>
        </div>

        <!-- Instructions -->
        <div class="card" style="padding:18px 16px;margin-bottom:20px">
          <div style="font-weight:700;font-size:0.9rem;margin-bottom:10px">📋 진단 안내</div>
          <div style="font-size:0.84rem;color:var(--text);line-height:1.7">
            ${_kit.format === 'binary' ? `
              <p style="margin:0 0 6px">총 <strong>${_kit.question_count}문항</strong>으로 구성됩니다.</p>
              <p style="margin:0 0 6px">각 문항에 대해 <strong>그렇다 / 그렇지 않다</strong>로 답해주세요.</p>
              <p style="margin:0">솔직하게 답할수록 더 정확한 결과를 얻을 수 있습니다.</p>
            ` : `
              <p style="margin:0 0 6px">총 <strong>${_kit.question_count}문항</strong>으로 구성됩니다.</p>
              <p style="margin:0 0 6px">각 문항에 대해 <strong>1(전혀 그렇지 않다) ~ 5(매우 그렇다)</strong>로 평가해주세요.</p>
              <p style="margin:0 0 6px">현재 자신의 모습을 있는 그대로 평가하세요. 좋게 보이려 하지 마세요.</p>
              <p style="margin:0">소요 시간: 약 <strong>${Math.ceil(_kit.question_count * 0.4)}분</strong></p>
            `}
          </div>
        </div>

        <button class="btn btn-primary btn-block btn-lg" id="start-diag-btn">
          진단 시작하기
        </button>
        <button class="btn btn-secondary btn-block" style="margin-top:10px"
                onclick="window.location.hash='#/assessment'">
          취소
        </button>
      </div>
    </div>
  `;

  root.querySelector('#start-diag-btn')?.addEventListener('click', () => {
    if (_kit.format === 'binary') {
      renderBinaryQuestion(root, 0);
    } else {
      renderLikertBatch(root, 0);
    }
  });
}

// ══════════════════════════════════════════════════════════════
// Binary format (MBTI)
// ══════════════════════════════════════════════════════════════

function renderBinaryQuestion(root, index) {
  const questions = _kit.questions;
  const total     = questions.length;

  if (index >= total) { renderResult(root); return; }

  const q   = questions[index];
  const pct = Math.round((index / total) * 100);

  root.innerHTML = `
    <div class="page" style="background:var(--bg)">
      <div class="top-bar">
        <button class="top-bar-back" id="diag-back" aria-label="뒤로">‹</button>
        <div class="top-bar-title">${escapeHtml(_kit.name_ko)}</div>
        <div class="top-bar-action" style="font-size:13px;color:var(--text-muted)">${index + 1} / ${total}</div>
      </div>
      <div class="page-content">

        <div style="margin-bottom:24px">
          <div class="progress-bar">
            <div class="progress-bar-fill" style="width:${pct}%;transition:width 0.4s ease;
                         background:${_kit.color}"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:4px;
                      font-size:0.72rem;color:var(--text-muted)">
            <span>진행률 ${pct}%</span><span>남은 문항 ${total - index}개</span>
          </div>
        </div>

        <div class="card" style="padding:28px 20px;margin-bottom:24px;text-align:center">
          <div style="font-size:0.75rem;font-weight:700;color:${_kit.color};
                      letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px">
            Q${index + 1}
          </div>
          <div style="font-size:1.05rem;font-weight:600;color:var(--text);
                      line-height:1.65;word-break:keep-all">
            ${escapeHtml(q.text)}
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px">
          <button class="diag-answer-btn" data-agree="true"
                  style="padding:16px;font-size:0.95rem;border:2px solid var(--border);
                         background:var(--surface);border-radius:var(--radius);
                         color:var(--text);font-weight:600;cursor:pointer;transition:all 0.15s">
            <span style="font-size:1.2rem;margin-right:8px">✅</span> 그렇다
          </button>
          <button class="diag-answer-btn" data-agree="false"
                  style="padding:16px;font-size:0.95rem;border:2px solid var(--border);
                         background:var(--surface);border-radius:var(--radius);
                         color:var(--text);font-weight:600;cursor:pointer;transition:all 0.15s">
            <span style="font-size:1.2rem;margin-right:8px">❌</span> 그렇지 않다
          </button>
        </div>

        <div style="text-align:center;margin-top:20px">
          <button id="diag-skip"
                  style="background:none;border:none;color:var(--text-muted);
                         font-size:0.82rem;cursor:pointer;text-decoration:underline">
            건너뛰기
          </button>
        </div>
      </div>
    </div>
  `;

  root.querySelectorAll('.diag-answer-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = _kit.color; btn.style.background = `${_kit.color}15`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.borderColor = 'var(--border)'; btn.style.background = 'var(--surface)';
    });
    btn.addEventListener('click', () => {
      const agree = btn.dataset.agree === 'true';
      _answers[q.id] = agree ? q.high : (q.axis.replace(q.high, ''));
      renderBinaryQuestion(root, index + 1);
    });
  });

  root.querySelector('#diag-back')?.addEventListener('click', () => {
    index === 0 ? window.location.hash = '#/assessment' : renderBinaryQuestion(root, index - 1);
  });
  root.querySelector('#diag-skip')?.addEventListener('click', () => {
    renderBinaryQuestion(root, index + 1);
  });
}

// ══════════════════════════════════════════════════════════════
// Likert5 format (DISC, Holland, Birkman, Interview)
// Renders 5 questions per page
// ══════════════════════════════════════════════════════════════

const BATCH_SIZE = 5;

function renderLikertBatch(root, startIndex) {
  const questions = _kit.questions;
  const total     = questions.length;

  if (startIndex >= total) { renderResult(root); return; }

  const batch   = questions.slice(startIndex, startIndex + BATCH_SIZE);
  const pageNum = Math.floor(startIndex / BATCH_SIZE) + 1;
  const pages   = Math.ceil(total / BATCH_SIZE);
  const pct     = Math.round((startIndex / total) * 100);

  root.innerHTML = `
    <div class="page" style="background:var(--bg)">
      <div class="top-bar">
        <button class="top-bar-back" id="diag-back" aria-label="뒤로">‹</button>
        <div class="top-bar-title">${escapeHtml(_kit.name_ko)}</div>
        <div class="top-bar-action" style="font-size:12px;color:var(--text-muted)">${pageNum} / ${pages}p</div>
      </div>
      <div class="page-content">

        <div style="margin-bottom:20px">
          <div class="progress-bar">
            <div class="progress-bar-fill" style="width:${pct}%;transition:width 0.4s ease;
                         background:${_kit.color}"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:4px;
                      font-size:0.72rem;color:var(--text-muted)">
            <span>진행률 ${pct}%</span><span>남은 ${total - startIndex}문항</span>
          </div>
        </div>

        <!-- Likert scale header -->
        <div style="display:flex;margin-bottom:8px;padding:0 4px">
          <div style="flex:1;font-size:0.72rem;color:var(--text-muted)">문항</div>
          <div style="display:flex;gap:2px;width:170px;flex-shrink:0">
            ${[1,2,3,4,5].map(n => `
              <div style="width:30px;text-align:center;font-size:0.6rem;color:var(--text-muted);line-height:1.2">
                ${n}<br>${n === 1 ? '전혀' : n === 3 ? '보통' : n === 5 ? '매우' : ''}
              </div>`).join('')}
          </div>
        </div>

        <!-- Questions -->
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px">
          ${batch.map((q, batchIdx) => {
            const qIdx = startIndex + batchIdx;
            const saved = _answers[q.id];
            return `
              <div class="card" style="padding:14px 12px" data-q-id="${q.id}">
                <div style="display:flex;align-items:flex-start;gap:8px">
                  <div style="flex:1;min-width:0">
                    <div style="font-size:0.72rem;font-weight:700;color:${_kit.color};margin-bottom:4px">Q${qIdx + 1}</div>
                    <div style="font-size:0.85rem;color:var(--text);line-height:1.55;word-break:keep-all">
                      ${escapeHtml(q.text)}
                    </div>
                  </div>
                  <div style="display:flex;gap:2px;flex-shrink:0;align-items:center;padding-top:4px">
                    ${[1,2,3,4,5].map(n => `
                      <button class="likert-btn" data-q-id="${q.id}" data-val="${n}"
                              style="width:30px;height:30px;border-radius:50%;border:2px solid ${saved === n ? _kit.color : 'var(--border)'};
                                     background:${saved === n ? _kit.color : 'var(--surface)'};
                                     color:${saved === n ? '#fff' : 'var(--text-muted)'};
                                     font-size:0.78rem;font-weight:700;cursor:pointer;
                                     transition:all 0.15s;flex-shrink:0">
                        ${n}
                      </button>`).join('')}
                  </div>
                </div>
              </div>`;
          }).join('')}
        </div>

        <div style="display:flex;gap:10px">
          ${startIndex > 0 ? `
            <button class="btn btn-secondary" id="diag-prev" style="flex:1">← 이전</button>
          ` : ''}
          <button class="btn btn-primary" id="diag-next" style="flex:2"
                  ${batch.some(q => _answers[q.id] === undefined) ? '' : ''}>
            ${startIndex + batch.length >= total ? '결과 보기 →' : '다음 →'}
          </button>
        </div>

        <div style="text-align:center;margin-top:10px;font-size:0.75rem;color:var(--text-muted)">
          미응답 문항은 중간값(3)으로 처리됩니다
        </div>
      </div>
    </div>
  `;

  // Likert button clicks
  root.querySelectorAll('.likert-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const qId = btn.dataset.qId;
      const val  = parseInt(btn.dataset.val);
      _answers[qId] = val;
      // Update button styles in this batch
      root.querySelectorAll(`.likert-btn[data-q-id="${qId}"]`).forEach(b => {
        const bVal = parseInt(b.dataset.val);
        const isSelected = bVal === val;
        b.style.borderColor  = isSelected ? _kit.color : 'var(--border)';
        b.style.background   = isSelected ? _kit.color : 'var(--surface)';
        b.style.color        = isSelected ? '#fff'     : 'var(--text-muted)';
      });
    });
  });

  root.querySelector('#diag-next')?.addEventListener('click', () => {
    // Fill in any skipped with middle value 3
    batch.forEach(q => {
      if (_answers[q.id] === undefined) _answers[q.id] = 3;
    });
    renderLikertBatch(root, startIndex + BATCH_SIZE);
  });

  root.querySelector('#diag-prev')?.addEventListener('click', () => {
    renderLikertBatch(root, Math.max(0, startIndex - BATCH_SIZE));
  });

  root.querySelector('#diag-back')?.addEventListener('click', () => {
    if (startIndex === 0) {
      renderIntro(root);
    } else {
      renderLikertBatch(root, startIndex - BATCH_SIZE);
    }
  });
}

// ══════════════════════════════════════════════════════════════
// Result computation
// ══════════════════════════════════════════════════════════════

function computeResult() {
  const kit = _kit;
  const questions = kit.questions;

  if (kit.format === 'binary') {
    // MBTI: count letters per axis
    const counts = { E:0,I:0, S:0,N:0, T:0,F:0, J:0,P:0 };
    Object.entries(_answers).forEach(([id, letter]) => {
      if (letter && counts[letter] !== undefined) counts[letter]++;
    });
    const answeredCount = Object.keys(_answers).length;
    const minRequired = Math.ceil((kit.questions?.length || 0) * 0.4);
    if (answeredCount < minRequired) {
      return { primaryType: null, insufficient: true, answeredCount, minRequired };
    }
    const type = `${counts.E>counts.I?'E':'I'}${counts.S>counts.N?'S':'N'}${counts.T>counts.F?'T':'F'}${counts.J>counts.P?'J':'P'}`;
    return { primaryType: type, typeInfo: kit.types?.[type], scores: counts };
  }

  // Likert5: sum scores per dimension
  const dimScores = {};
  const dimCounts = {};
  questions.forEach(q => {
    const dim = q.dimension;
    if (!dim) return;
    const raw = _answers[q.id] ?? 3;
    const val = q.weight === -1 ? (6 - raw) : raw;
    dimScores[dim] = (dimScores[dim] || 0) + val;
    dimCounts[dim] = (dimCounts[dim] || 0) + 1;
  });

  // Normalize to 0-100
  const normalized = {};
  Object.keys(dimScores).forEach(dim => {
    const max = dimCounts[dim] * 5;
    normalized[dim] = Math.round((dimScores[dim] / max) * 100);
  });

  // Primary type = highest scoring dimension
  const primaryDim = Object.entries(normalized).sort((a,b) => b[1]-a[1])[0]?.[0];
  const secondaryDim = Object.entries(normalized).sort((a,b) => b[1]-a[1])[1]?.[0];

  // Combination check (for DISC)
  let typeKey = primaryDim;
  if (kit.id === 'KIT_DISC' && secondaryDim) {
    const combo = `${primaryDim}${secondaryDim}`;
    if (kit.types?.[combo]) typeKey = combo;
  }

  return {
    primaryType:   typeKey,
    primaryDim,
    secondaryDim,
    typeInfo:      kit.types?.[typeKey] || kit.types?.[primaryDim],
    scores:        normalized,
    dimCounts,
  };
}

// ══════════════════════════════════════════════════════════════
// Result screen
// ══════════════════════════════════════════════════════════════

function renderResult(root) {
  const result   = computeResult();

  if (result.insufficient) {
    root.innerHTML = `
      <div class="page" style="background:var(--bg)">
        <div class="top-bar">
          <button class="top-bar-back" aria-label="뒤로">‹</button>
          <div class="top-bar-title">진단 결과</div>
        </div>
        <div class="page-content" style="display:flex;align-items:center;justify-content:center;min-height:60vh">
          <div class="card" style="padding:32px 24px;text-align:center;max-width:320px">
            <div style="font-size:2.5rem;margin-bottom:12px">🤔</div>
            <div style="font-size:1.1rem;font-weight:700;color:var(--text);margin-bottom:8px">응답이 부족합니다</div>
            <div style="font-size:0.88rem;color:var(--text-muted);line-height:1.6;margin-bottom:20px">
              신뢰할 수 있는 결과를 위해 최소 ${result.minRequired}개 이상의 문항에 응답해 주세요.<br>
              현재 <strong>${result.answeredCount}개</strong> 응답됨.
            </div>
            <button class="btn btn-primary btn-block" onclick="window.location.hash='#/assessment'">
              진단 다시 시작
            </button>
          </div>
        </div>
      </div>`;
    return;
  }

  const typeCode = result.primaryType;
  const typeInfo = result.typeInfo;
  const scores   = result.scores;

  // Save to localStorage
  const user  = getUser();
  const saved = JSON.parse(localStorage.getItem(RESULTS_KEY) || '{}');
  saved[_kit.id] = { kitId:_kit.id, userId:user?.id, typeCode, typeInfo, scores, savedAt:new Date().toISOString() };
  localStorage.setItem(RESULTS_KEY, JSON.stringify(saved));
  // Persist to Supabase (non-demo mode)
  api.diagnostic.saveResult(_kit.id, { typeCode, scores }).catch(e =>
    console.warn('[Diagnostic] saveResult API error:', e)
  );

  // Build score bars for likert kits (skip for Birkman/Holland — they have dedicated sections)
  const scoreBars = (_kit.format !== 'binary' && scores && _kit.id !== 'KIT_BIRKMAN' && _kit.id !== 'KIT_HOLLAND') ? `
    <div class="card" style="padding:18px 16px;margin-bottom:12px">
      <div style="font-weight:700;font-size:0.9rem;color:var(--text);margin-bottom:12px">📊 차원별 점수</div>
      ${Object.entries(scores).map(([dim, pct]) => {
        const label = _kit.types?.[dim]?.ko || dim;
        return `
          <div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="font-size:0.8rem;font-weight:600">${escapeHtml(label)}</span>
              <span style="font-size:0.8rem;color:var(--text-muted)">${pct}%</span>
            </div>
            <div style="height:8px;background:#E2E8F0;border-radius:999px;overflow:hidden">
              <div style="height:100%;background:${_kit.color};border-radius:999px;
                          width:${pct}%;transition:width 0.6s ease"></div>
            </div>
          </div>`;
      }).join('')}
    </div>
  ` : '';

  // Build Birkman 4-color comparison table
  const birkmanSection = (_kit.id === 'KIT_BIRKMAN') ? (() => {
    const COLOR_META = {
      RED:    { bg:'#FEE2E2', text:'#991B1B', label:'🔴 직접형 (Red)' },
      YELLOW: { bg:'#FEF9C3', text:'#854D0E', label:'🟡 사교형 (Yellow)' },
      GREEN:  { bg:'#DCFCE7', text:'#166534', label:'🟢 지원형 (Green)' },
      BLUE:   { bg:'#DBEAFE', text:'#1E40AF', label:'🔵 분석형 (Blue)' },
    };
    const sorted = Object.entries(scores).sort((a,b) => b[1]-a[1]);
    return `
  <div class="card" style="padding:18px 16px;margin-bottom:12px">
    <div style="font-weight:700;font-size:0.9rem;color:var(--text);margin-bottom:12px">🎨 4가지 스타일 순위</div>
    ${sorted.map(([dim, pct], i) => {
      const meta = COLOR_META[dim] || { bg:'#F1F5F9', text:'#475569', label: dim };
      return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="width:24px;height:24px;border-radius:50%;background:${meta.bg};border:2px solid ${meta.text};
                    display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:800;
                    color:${meta.text};flex-shrink:0">${i+1}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px">
            <span style="font-size:0.82rem;font-weight:600;color:${meta.text}">${meta.label}</span>
            <span style="font-size:0.8rem;font-weight:700;color:${meta.text}">${pct}%</span>
          </div>
          <div style="height:7px;background:#E2E8F0;border-radius:99px;overflow:hidden">
            <div style="height:100%;background:${meta.text};border-radius:99px;width:${pct}%;transition:width 0.6s ease"></div>
          </div>
        </div>
      </div>`;
    }).join('')}
    <div style="margin-top:8px;padding:10px;background:#F8FAFC;border-radius:var(--radius-sm);font-size:0.78rem;color:var(--text-muted);line-height:1.5">
      💡 가장 높은 스타일이 일상적 행동 패턴, 두 번째 스타일이 보조 패턴입니다. 모든 스타일이 상황에 따라 발현됩니다.
    </div>
  </div>`;
  })() : '';

  // Build Holland RIASEC top-3 career match
  const hollandSection = (_kit.id === 'KIT_HOLLAND') ? (() => {
    const RIASEC_LABEL = { R:'현실형(R)', I:'탐구형(I)', A:'예술형(A)', S:'사회형(S)', E:'진취형(E)', C:'관습형(C)' };
    const RIASEC_COLOR = { R:'#F59E0B', I:'#6366F1', A:'#EC4899', S:'#10B981', E:'#EF4444', C:'#3B82F6' };
    const sorted = Object.entries(scores).sort((a,b) => b[1]-a[1]);
    const top3 = sorted.slice(0, 3).map(([d]) => d).join('');
    const top3Types = sorted.slice(0, 3).map(([d]) => _kit.types?.[d]);
    return `
  <div class="card" style="padding:18px 16px;margin-bottom:12px">
    <div style="font-weight:700;font-size:0.9rem;color:var(--text);margin-bottom:4px">🎯 나의 RIASEC 코드</div>
    <div style="font-size:1.4rem;font-weight:800;color:var(--primary);margin-bottom:12px;letter-spacing:0.1em">${top3}</div>
    ${sorted.map(([dim, pct]) => {
      const color = RIASEC_COLOR[dim] || 'var(--text-muted)';
      const label = RIASEC_LABEL[dim] || dim;
      return `
      <div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px">
          <span style="font-size:0.8rem;font-weight:600">${label}</span>
          <span style="font-size:0.8rem;font-weight:700;color:${color}">${pct}%</span>
        </div>
        <div style="height:6px;background:#E2E8F0;border-radius:99px;overflow:hidden">
          <div style="height:100%;background:${color};border-radius:99px;width:${pct}%;transition:width 0.6s ease"></div>
        </div>
      </div>`;
    }).join('')}
  </div>
  <div class="card" style="padding:18px 16px;margin-bottom:12px">
    <div style="font-weight:700;font-size:0.9rem;color:var(--text);margin-bottom:10px">💼 상위 3개 유형 적합 직무</div>
    ${top3Types.map((t, i) => t ? `
    <div style="padding:10px 12px;background:var(--bg);border-radius:var(--radius-sm);margin-bottom:8px">
      <div style="font-size:0.82rem;font-weight:700;margin-bottom:4px">${t.emoji || ''} ${t.ko || ''}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        ${(t.careers || []).map(c => `<span style="padding:2px 9px;background:#EEF2FF;color:var(--primary);border-radius:99px;font-size:0.74rem;font-weight:600">${escapeHtml(c)}</span>`).join('')}
      </div>
    </div>` : '').join('')}
  </div>`;
  })() : '';

  // Build level description for interview kit
  const levelSection = (_kit.id === 'KIT_INTERVIEW' && typeInfo?.level_desc) ? `
    <div class="card" style="padding:18px 16px;margin-bottom:12px">
      <div style="font-weight:700;font-size:0.9rem;color:var(--text);margin-bottom:10px">📈 역량 수준 기준표</div>
      ${Object.entries(typeInfo.level_desc).reverse().map(([lvl, desc]) => {
        const isTop = result.scores?.[result.primaryDim];
        const highlight = isTop >= (parseInt(lvl)-1)*20 && isTop < parseInt(lvl)*20;
        return `
          <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px;
                      padding:8px;border-radius:var(--radius-sm);
                      background:${parseInt(lvl)===5?'#ECFDF5':parseInt(lvl)===4?'#EEF2FF':'var(--bg)'}">
            <span style="font-size:1rem;flex-shrink:0">${lvl === '5'?'⭐':lvl==='4'?'✅':lvl==='3'?'🔵':lvl==='2'?'🟡':'🔴'}</span>
            <div style="font-size:0.78rem;color:var(--text);line-height:1.5">${escapeHtml(desc)}</div>
          </div>`;
      }).join('')}
    </div>
  ` : '';

  root.innerHTML = `
    <div class="page" style="background:var(--bg)">
      <div class="top-bar">
        <button class="top-bar-back" aria-label="홈">‹</button>
        <div class="top-bar-title">진단 결과</div>
      </div>
      <div class="page-content">

        <!-- Hero -->
        <div class="card" style="padding:24px 20px;text-align:center;margin-bottom:16px;
                                  background:linear-gradient(135deg,#EEF2FF,#F5F3FF);
                                  border:2px solid var(--primary-light)">
          <div style="font-size:2.8rem;margin-bottom:8px">${typeInfo?.emoji || _kit.icon}</div>
          <div style="font-size:0.72rem;font-weight:700;color:var(--primary);letter-spacing:.1em;margin-bottom:4px">
            ${escapeHtml(_kit.name_ko)} 결과
          </div>
          <div style="font-size:1.8rem;font-weight:800;color:var(--text);margin-bottom:4px">
            ${typeCode || ''}
          </div>
          ${typeInfo ? `
            <div style="font-size:1.05rem;font-weight:600;color:${_kit.color};margin-bottom:10px">
              ${escapeHtml(typeInfo.ko)}
            </div>
            <div style="font-size:0.88rem;color:var(--text);line-height:1.65;word-break:keep-all">
              ${escapeHtml(typeInfo.desc)}
            </div>
          ` : ''}
        </div>

        ${scoreBars}
        ${birkmanSection}
        ${hollandSection}

        ${typeInfo?.strengths ? `
          <div class="card" style="padding:18px 16px;margin-bottom:12px">
            <div style="font-weight:700;font-size:0.9rem;color:var(--text);margin-bottom:10px">💪 강점</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${typeInfo.strengths.map(s => `
                <span style="padding:4px 12px;background:#ECFDF5;color:#059669;
                             border-radius:999px;font-size:0.82rem;font-weight:600">
                  ${escapeHtml(s)}
                </span>`).join('')}
            </div>
          </div>
        ` : ''}

        ${typeInfo?.growth ? `
          <div class="card" style="padding:18px 16px;margin-bottom:12px">
            <div style="font-weight:700;font-size:0.9rem;color:var(--text);margin-bottom:10px">🌱 성장 영역</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${typeInfo.growth.map(g => `
                <span style="padding:4px 12px;background:#FFFBEB;color:#92400E;
                             border-radius:999px;font-size:0.82rem;font-weight:600">
                  ${escapeHtml(g)}
                </span>`).join('')}
            </div>
          </div>
        ` : ''}

        ${typeInfo?.work_style ? `
          <div class="card" style="padding:18px 16px;margin-bottom:12px">
            <div style="font-weight:700;font-size:0.9rem;color:var(--text);margin-bottom:8px">⚙️ 업무 스타일</div>
            <div style="font-size:0.88rem;color:var(--text);line-height:1.65;word-break:keep-all">
              ${escapeHtml(typeInfo.work_style)}
            </div>
          </div>
        ` : ''}

        ${typeInfo?.stress_behavior ? `
          <div class="card" style="padding:18px 16px;margin-bottom:12px">
            <div style="font-weight:700;font-size:0.9rem;color:var(--text);margin-bottom:8px">⚡ 스트레스 반응</div>
            <div style="font-size:0.88rem;color:var(--text);line-height:1.65;word-break:keep-all">
              ${escapeHtml(typeInfo.stress_behavior)}
            </div>
          </div>
        ` : ''}

        ${typeInfo?.needs ? `
          <div class="card" style="padding:18px 16px;margin-bottom:12px">
            <div style="font-weight:700;font-size:0.9rem;color:var(--text);margin-bottom:8px">🔋 최적 환경 조건</div>
            <div style="font-size:0.88rem;color:var(--text);line-height:1.65">
              ${escapeHtml(typeInfo.needs)}
            </div>
          </div>
        ` : ''}

        ${typeInfo?.careers ? `
          <div class="card" style="padding:18px 16px;margin-bottom:12px">
            <div style="font-weight:700;font-size:0.9rem;color:var(--text);margin-bottom:10px">💼 적합 직무</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${typeInfo.careers.map(c => `
                <span style="padding:4px 12px;background:#EEF2FF;color:var(--primary);
                             border-radius:999px;font-size:0.82rem;font-weight:600">
                  ${escapeHtml(c)}
                </span>`).join('')}
            </div>
          </div>
        ` : ''}

        ${typeInfo?.ideal_roles ? `
          <div class="card" style="padding:18px 16px;margin-bottom:12px">
            <div style="font-weight:700;font-size:0.9rem;color:var(--text);margin-bottom:10px">💼 적합 역할</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${typeInfo.ideal_roles.map(r => `
                <span style="padding:4px 12px;background:#EEF2FF;color:var(--primary);
                             border-radius:999px;font-size:0.82rem;font-weight:600">
                  ${escapeHtml(r)}
                </span>`).join('')}
            </div>
          </div>
        ` : ''}

        ${levelSection}

        <!-- Actions -->
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:20px">
          <button class="btn btn-primary btn-block btn-lg"
                  onclick="window.location.hash='#/dashboard'">🏠 홈으로</button>
          <button class="btn btn-secondary btn-block" id="retake-btn">🔄 다시 진단하기</button>
          <button class="btn btn-secondary btn-block"
                  onclick="window.location.hash='#/assessment'">🧩 다른 진단 Kit 선택</button>
        </div>

      </div>
    </div>
  `;

  root.querySelector('#retake-btn')?.addEventListener('click', () => {
    _answers = {};
    renderIntro(root);
  });
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
