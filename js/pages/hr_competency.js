/**
 * hr_competency.js – HR Job Competency Tree Page
 * HR Competency OS
 *
 * Split-panel desktop / slide-panel mobile layout.
 * Left: collapsible category tree
 * Right: job detail with ASK tabs, level criteria, and recording diagnosis flow
 */

import { HR_JOB_TREE, getAllJobItems, getJobItemById } from '../data/hr_job_tree.js';
import { InterviewUI } from '../components/interview-ui.js';
import {getUser, isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js'
import { addNotification } from '../components/notification-hub.js';
import { api } from '../api.js';

// ── Constants ─────────────────────────────────────────────────
const SESSIONS_KEY = 'hr_comp_sessions';

// ── Module-level state ─────────────────────────────────────────
let _root           = null;
let _selectedCat    = null;   // expanded category id
let _selectedJob    = null;   // selected job item object (with category info)
let _activeAskTab   = 'ability';
let _recordingMode  = false;
let _recordingStep  = 'intro'; // 'intro' | 'question' | 'evaluating' | 'result'
let _currentQuestion = 0;
let _recordings     = {};     // { [questionId]: { transcript, duration, savedAt } }
let _evalResult     = null;
let _interviewUI    = null;

// ── Helpers ────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isMobile() {
  return window.innerWidth < 768;
}

// ── localStorage persistence ──────────────────────────────────

function saveSession(jobItemId, recordings, result) {
  const jobItem  = getJobItemById(jobItemId);
  const jobName  = jobItem?.name_ko || jobItemId;
  const level    = result?.level || null;
  const totalScore = result?.totalScore ?? result?.total_score ?? null;
  const entry = {
    jobId:      jobItemId,
    jobName,
    level,
    totalScore,
    recordings,
    result,
    completedAt: new Date().toISOString(),
  };
  try {
    const all = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]');
    const arr = Array.isArray(all) ? all : [];
    // Replace existing entry for same job or append
    const idx = arr.findIndex(s => s.jobId === jobItemId);
    if (idx >= 0) arr[idx] = entry; else arr.push(entry);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(arr));
  } catch (_) {}
  // Persist to Supabase (non-demo mode)
  api.hrComp.saveSession(jobItemId, {
    jobName, level, totalScore,
    recordings,
    evalResult: result,
  }).catch(e => console.warn('[HRComp] saveSession API error:', e));
}

function loadSession(jobItemId) {
  try {
    const all = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '{}');
    return all[jobItemId] || null;
  } catch (_) {
    return null;
  }
}

// ── Mock AI evaluation ────────────────────────────────────────

function buildHRCompEvalResult(recordings, jobItem) {
  const questionFeedback = jobItem.questions.map(q => {
    const rec = recordings[q.id];
    const transcript = rec?.transcript || '';
    const words = transcript.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Keywords from skill_ko
    const skillKeywords = jobItem.skill_ko.flatMap(s =>
      s.split(/[·,\s]+/).filter(w => w.length > 2)
    );
    const keywordMatches = skillKeywords.filter(kw => transcript.includes(kw)).length;
    const keywordScore = Math.min(30, keywordMatches * 6);

    // Length score (ideal: 200–600 chars Korean)
    const charCount = transcript.length;
    const lengthScore = charCount < 20  ? 10 :
                        charCount < 100 ? 30 :
                        charCount < 300 ? 55 :
                        charCount < 600 ? 70 : 60;

    // Specificity
    const hasNumbers = /\d/.test(transcript);
    const hasSTAR = ['결과', '성과', '개선', '처리', '해결'].some(w => transcript.includes(w));
    const specificityScore = (hasNumbers ? 15 : 0) + (hasSTAR ? 15 : 0) + (wordCount > 50 ? 10 : 0);

    const score = Math.min(100, lengthScore + keywordScore + specificityScore);

    const feedback =
      score >= 75 ? '구체적인 사례와 결과를 포함한 훌륭한 답변입니다.' :
      score >= 50 ? '답변 내용은 적절하나, 구체적 수치와 성과를 추가하면 더 좋습니다.' :
      score >= 25 ? '경험을 보다 구체적으로 설명하고 STAR 기법을 활용해 보세요.' :
                    '이 질문에 대한 경험 사례를 더 구체적으로 답변해 주세요.';

    return { questionId: q.id, questionText: q.text, score, feedback };
  });

  const totalScore = Math.round(
    questionFeedback.reduce((sum, qf) => sum + qf.score, 0) / questionFeedback.length
  );
  const level = totalScore >= 75 ? 'L3' : totalScore >= 50 ? 'L2' : 'L1';
  const levelLabels = { L1: '기초 수준', L2: '독립 수행 수준', L3: '전문가 수준' };

  return {
    total_score: totalScore,
    level,
    level_label: levelLabels[level],
    question_feedback: questionFeedback,
    evaluatedAt: new Date().toISOString(),
  };
}

// ── Tree rendering ─────────────────────────────────────────────

function renderTreePanel() {
  const categories = HR_JOB_TREE;

  const items = categories.map(cat => {
    const isOpen = _selectedCat === cat.id;
    const children = (cat.children || []).map(job => {
      const isActive = _selectedJob?.id === job.id;
      return `
        <div class="tree-item"
             data-job-id="${escapeHtml(job.id)}"
             style="
               padding:8px 12px 8px 36px;
               font-size:0.85rem;
               cursor:pointer;
               border-radius:6px;
               margin:2px 8px;
               transition:background 0.15s,color 0.15s;
               ${isActive
                 ? 'background:var(--primary-light);color:var(--primary);font-weight:600;'
                 : 'color:var(--text-muted);'}
             ">
          <span style="margin-right:6px;font-size:0.7rem">◆</span>${escapeHtml(job.name_ko)}
        </div>`;
    }).join('');

    return `
      <div class="tree-category" data-cat-id="${escapeHtml(cat.id)}">
        <div class="tree-cat-header"
             data-cat-id="${escapeHtml(cat.id)}"
             style="
               display:flex;
               align-items:center;
               justify-content:space-between;
               padding:10px 12px;
               cursor:pointer;
               border-radius:6px;
               margin:2px 8px;
               font-size:0.88rem;
               font-weight:600;
               color:var(--text);
               transition:background 0.15s;
             ">
          <span>${escapeHtml(cat.icon || '')} ${escapeHtml(cat.name_ko)}</span>
          <span style="font-size:0.7rem;color:var(--text-muted)">${isOpen ? '▼' : '▶'}</span>
        </div>
        <div class="tree-children"
             id="children-${escapeHtml(cat.id)}"
             style="display:${isOpen ? 'block' : 'none'}">
          ${children}
        </div>
      </div>`;
  }).join('');

  return `
    <div id="tree-panel"
         style="
           width:280px;
           flex-shrink:0;
           border-right:1px solid var(--border);
           background:var(--surface);
           overflow-y:auto;
           height:100%;
         ">
      <div style="padding:12px 16px;font-weight:700;color:var(--text-muted);
                  font-size:0.8rem;letter-spacing:.08em;border-bottom:1px solid var(--border)">
        HR 직무 체계
      </div>
      ${items}
    </div>`;
}

// ── ASK tab content ────────────────────────────────────────────

function renderAskItems(items) {
  return items.map((item, i) => `
    <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px">
      <span style="
        font-size:0.78rem;font-weight:700;color:var(--primary);
        background:var(--primary-light);border-radius:999px;
        min-width:22px;height:22px;display:flex;align-items:center;
        justify-content:center;flex-shrink:0;color:#fff;
      ">${i + 1}</span>
      <span style="font-size:0.85rem;color:var(--text);line-height:1.6">${escapeHtml(item)}</span>
    </div>`).join('');
}

// ── Level criteria rendering ───────────────────────────────────

function renderLevelCriteria(levelCriteria) {
  const levels = ['L3', 'L2', 'L1'];
  const bgMap   = { L3: '#ECFDF5', L2: '#EEF2FF', L1: '#FFF7ED' };
  const clrMap  = { L3: '#059669', L2: '#4F46E5', L1: '#D97706' };

  return levels.map(level => {
    const criteria = levelCriteria?.[level];
    if (!criteria) return '';
    return `
      <div style="
        display:flex;gap:10px;margin-bottom:8px;padding:10px;
        border-radius:8px;background:${bgMap[level]};
      ">
        <span style="font-weight:800;color:${clrMap[level]};min-width:24px">${level}</span>
        <span style="font-size:0.82rem;color:var(--text);line-height:1.6">${escapeHtml(criteria)}</span>
      </div>`;
  }).join('');
}

// ── Job detail panel ──────────────────────────────────────────

function renderJobDetail(jobItem) {
  const cat = jobItem.category || {};
  const askTabContent = renderAskTabContent(jobItem, _activeAskTab);

  const tabStyle = (tab) => `
    padding:10px 16px;
    font-size:0.85rem;
    font-weight:${_activeAskTab === tab ? '700' : '500'};
    color:${_activeAskTab === tab ? 'var(--primary)' : 'var(--text-muted)'};
    border:none;
    background:transparent;
    border-bottom:2px solid ${_activeAskTab === tab ? 'var(--primary)' : 'transparent'};
    cursor:pointer;
    transition:all 0.15s;
    font-family:var(--font-ko);
  `;

  return `
    <!-- Header -->
    <div style="padding:20px 16px;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="
          font-size:0.72rem;font-weight:700;
          background:${escapeHtml(cat.color || 'var(--primary)')};
          color:#fff;padding:2px 8px;border-radius:999px;
        ">${escapeHtml(cat.name_ko || '')}</span>
      </div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--text);margin-bottom:4px">
        ${escapeHtml(jobItem.name_ko)}
      </div>
      <div style="font-size:0.85rem;color:var(--text-muted);line-height:1.6">
        ${escapeHtml(jobItem.description_ko || '')}
      </div>
    </div>

    <!-- ASK Tabs -->
    <div style="display:flex;border-bottom:1px solid var(--border);overflow-x:auto">
      <button data-ask-tab="ability"   class="ask-tab" style="${tabStyle('ability')}">능력 (Ability)</button>
      <button data-ask-tab="skill"     class="ask-tab" style="${tabStyle('skill')}">기술 (Skill)</button>
      <button data-ask-tab="knowledge" class="ask-tab" style="${tabStyle('knowledge')}">지식 (Knowledge)</button>
    </div>

    <!-- Tab Content -->
    <div id="ask-tab-content" style="padding:16px">
      ${askTabContent}
    </div>

    <!-- Level Criteria -->
    <div style="padding:0 16px 16px">
      <div style="font-weight:700;font-size:0.9rem;margin-bottom:12px">📊 역량 수준 기준</div>
      ${renderLevelCriteria(jobItem.level_criteria)}
    </div>

    <!-- CTA -->
    <div style="padding:16px;border-top:1px solid var(--border)">
      <button class="btn btn-primary btn-block" id="start-diagnosis-btn">
        🎙️ 역량 진단 시작하기 (녹음)
      </button>
      <div style="font-size:0.76rem;color:var(--text-muted);text-align:center;margin-top:8px">
        5개 질문 · 음성 답변 · AI 역량 평가
      </div>
    </div>
  `;
}

function renderAskTabContent(jobItem, tab) {
  const map = {
    ability:   jobItem.ability_ko   || [],
    skill:     jobItem.skill_ko     || [],
    knowledge: jobItem.knowledge_ko || [],
  };
  const items = map[tab] || [];
  return items.length
    ? renderAskItems(items)
    : `<div style="color:var(--text-muted);font-size:0.85rem">내용이 없습니다.</div>`;
}

// ── Empty state ────────────────────────────────────────────────

function renderEmptyState() {
  return `
    <div style="
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      min-height:300px;color:var(--text-muted);text-align:center;padding:32px;
    ">
      <div style="font-size:3rem;margin-bottom:12px">🌳</div>
      <div style="font-weight:600;margin-bottom:8px">직무를 선택하세요</div>
      <div style="font-size:0.85rem;line-height:1.6">
        왼쪽 트리에서 HR 직무를 선택하면<br>역량 정의와 진단을 시작할 수 있습니다.
      </div>
    </div>`;
}

// ── Recording session screens ─────────────────────────────────

function renderRecordingIntro(jobItem) {
  return `
    <div class="card" style="margin:16px">
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:2rem">🎙️</div>
        <div style="font-weight:700;font-size:1.1rem">${escapeHtml(jobItem.name_ko)} 역량 진단</div>
        <div style="color:var(--text-muted);font-size:0.85rem">총 5개 질문 · 각 3분 이내 답변</div>
      </div>
      <div style="background:var(--bg);border-radius:8px;padding:12px;margin-bottom:16px">
        <div style="font-size:0.82rem;color:var(--text-muted)">진단 방법</div>
        <ul style="font-size:0.85rem;color:var(--text);margin:8px 0 0 16px;line-height:1.8">
          <li>각 질문을 읽고 음성으로 답변하세요</li>
          <li>STAR 기법(상황→과제→행동→결과)으로 구체적으로 답변하면 유리합니다</li>
          <li>모든 답변 후 AI가 역량 수준을 평가합니다</li>
        </ul>
      </div>
      <button class="btn btn-primary btn-block" id="start-recording-btn">진단 시작</button>
      <button class="btn btn-ghost btn-block" id="cancel-recording-btn" style="margin-top:8px">취소</button>
    </div>`;
}

function renderRecordingQuestion(jobItem, questionIndex) {
  const questions = jobItem.questions || [];
  const total     = questions.length;
  const current   = questionIndex;
  const question  = questions[current];
  const progress  = total > 0 ? Math.round(((current) / total) * 100) : 0;
  const isLast    = current === total - 1;
  const rec       = _recordings[question?.id];
  const hasSaved  = !!rec;

  return `
    <div style="padding:16px">
      <!-- Progress -->
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px">
        질문 ${current + 1} / ${total}
      </div>
      <div style="height:4px;background:#E2E8F0;border-radius:999px;margin-bottom:20px">
        <div style="
          height:100%;background:var(--primary);border-radius:999px;
          width:${progress}%;transition:width 0.4s ease;
        "></div>
      </div>

      <!-- Question -->
      <div style="
        font-size:0.95rem;font-weight:600;color:var(--text);
        line-height:1.65;margin-bottom:16px;word-break:keep-all;
      ">
        ${escapeHtml(question?.text || '')}
      </div>

      <!-- InterviewUI mount point -->
      <div id="interview-ui-container"></div>

      <!-- Save / Next controls -->
      <div style="margin-top:12px">
        <div id="saved-indicator" style="
          display:${hasSaved ? 'block' : 'none'};
          color:#059669;font-size:0.85rem;text-align:center;margin-bottom:8px;
        ">✓ 답변이 저장되었습니다</div>
        <button class="btn btn-primary btn-block" id="next-question-btn"
                ${hasSaved ? '' : 'disabled'}>
          ${isLast ? '완료 — AI 평가받기' : '다음 질문'}
        </button>
        ${current > 0 ? `
          <button class="btn btn-ghost btn-sm btn-block" id="prev-q-btn"
                  style="margin-top:8px">이전 질문</button>
        ` : ''}
      </div>
    </div>`;
}

function renderEvaluating() {
  return `
    <div style="text-align:center;padding:40px 20px">
      <div class="spinner spinner-lg"></div>
      <div style="margin-top:16px;font-weight:600">AI 역량 평가 중...</div>
      <div style="color:var(--text-muted);font-size:0.85rem">잠시만 기다려주세요</div>
    </div>`;
}

function renderEvalResult(jobItem, result) {
  const levelColorMap = { L3: '#059669', L2: '#4F46E5', L1: '#D97706' };
  const levelColor = levelColorMap[result.level] || 'var(--text)';

  // Score breakdown bars: content richness, specificity, expertise
  const scoreLabels = ['내용 풍부성', '구체성', '전문성'];
  const avgFeedback = result.question_feedback || [];

  // Derive three dimension scores from per-question data
  const avgTotal = result.total_score;
  // Approximate the three scores using the feedback scores variance
  const scoreValues = avgFeedback.map(f => f.score);
  const dimScores = [
    scoreValues.length ? Math.round(scoreValues.reduce((s, v) => s + v, 0) / scoreValues.length) : avgTotal,
    Math.min(100, Math.round(avgTotal * 0.9 + (avgFeedback.filter(f => /\d/.test(f.questionText)).length * 3))),
    Math.min(100, Math.round(avgTotal * 0.85 + (avgFeedback.filter(f => f.score >= 50).length * 4))),
  ];

  const dimColors = ['#4F46E5', '#059669', '#F59E0B'];

  const scoreBars = scoreLabels.map((label, i) => {
    const val = dimScores[i];
    return `
      <div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:0.82rem;font-weight:600;color:var(--text)">${escapeHtml(label)}</span>
          <span style="font-size:0.82rem;font-weight:700;color:${dimColors[i]}">${val}점</span>
        </div>
        <div style="height:8px;background:#E2E8F0;border-radius:999px;overflow:hidden">
          <div style="
            height:100%;background:${dimColors[i]};
            border-radius:999px;width:${val}%;
            transition:width 0.8s cubic-bezier(0.34,1.56,0.64,1);
          "></div>
        </div>
      </div>`;
  }).join('');

  const questionFeedbackHtml = (result.question_feedback || []).map((fb, i) => `
    <div style="
      border-left:3px solid ${fb.score >= 75 ? '#059669' : fb.score >= 50 ? '#4F46E5' : '#F59E0B'};
      padding:10px 12px;margin-bottom:10px;background:var(--bg);border-radius:0 6px 6px 0;
    ">
      <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:4px">
        Q${i + 1} — ${fb.score}점
      </div>
      <div style="font-size:0.82rem;color:var(--text);line-height:1.55">
        ${escapeHtml(fb.feedback)}
      </div>
    </div>`).join('');

  return `
    <!-- Score hero -->
    <div class="card" style="
      background:linear-gradient(135deg,#EEF2FF,#F5F3FF);
      border:2px solid var(--primary-light);
      padding:24px;text-align:center;margin-bottom:16px;
    ">
      <div style="font-size:0.75rem;font-weight:700;color:var(--primary);letter-spacing:.1em">
        ${escapeHtml(jobItem.name_ko)} 역량 진단 결과
      </div>
      <div style="font-size:2.5rem;font-weight:800;color:var(--text);margin:8px 0">
        ${result.total_score}점
      </div>
      <div style="font-size:1.1rem;font-weight:600;color:${levelColor}">
        ${result.level} 수준 — ${escapeHtml(result.level_label)}
      </div>
      <div style="margin-top:12px;font-size:0.85rem;color:var(--text-muted)">
        ${escapeHtml(jobItem.level_criteria?.[result.level] || '')}
      </div>
    </div>

    <!-- Score breakdown -->
    <div class="card" style="padding:16px;margin-bottom:12px">
      <div style="font-weight:700;margin-bottom:12px">📊 평가 영역별 점수</div>
      ${scoreBars}
    </div>

    <!-- Per-question feedback -->
    <div class="card" style="padding:16px;margin-bottom:12px">
      <div style="font-weight:700;margin-bottom:12px">💬 질문별 피드백</div>
      ${questionFeedbackHtml}
    </div>

    <!-- Actions -->
    <div style="padding:0 0 16px;display:flex;flex-direction:column;gap:10px">
      <a href="#/growth" class="btn btn-primary btn-block"
         style="text-decoration:none;text-align:center">
        📈 내 성장 페이지에서 결과 확인하기 →
      </a>
      <button class="btn btn-outline btn-block" id="retry-diagnosis-btn">
        🔄 다시 진단하기
      </button>
      <button class="btn btn-ghost btn-block" id="back-to-detail-btn">
        ← 직무 상세로 돌아가기
      </button>
    </div>
  `;
}

// ── Right content panel ────────────────────────────────────────

function renderRightContent() {
  if (!_selectedJob) {
    return renderEmptyState();
  }

  if (_recordingMode) {
    if (_recordingStep === 'intro') {
      return renderRecordingIntro(_selectedJob);
    }
    if (_recordingStep === 'question') {
      return renderRecordingQuestion(_selectedJob, _currentQuestion);
    }
    if (_recordingStep === 'evaluating') {
      return renderEvaluating();
    }
    if (_recordingStep === 'result' && _evalResult) {
      return renderEvalResult(_selectedJob, _evalResult);
    }
  }

  return renderJobDetail(_selectedJob);
}

// ── Bind tree events ───────────────────────────────────────────

function bindTreeEvents(root) {
  const treePanel = root.querySelector('#tree-panel');
  if (!treePanel) return;

  // Category header toggle
  treePanel.querySelectorAll('.tree-cat-header').forEach(header => {
    header.addEventListener('click', () => {
      const catId = header.dataset.catId;
      if (_selectedCat === catId) {
        _selectedCat = null;
      } else {
        _selectedCat = catId;
      }
      rerenderTree(root);
    });
  });

  // Job item selection
  treePanel.querySelectorAll('.tree-item').forEach(item => {
    item.addEventListener('click', () => {
      const jobId = item.dataset.jobId;
      const allItems = getAllJobItems();
      const found = allItems.find(j => j.id === jobId);
      if (!found) return;

      _selectedJob     = found;
      _recordingMode   = false;
      _recordingStep   = 'intro';
      _activeAskTab    = 'ability';
      _currentQuestion = 0;
      _recordings      = {};
      _evalResult      = null;

      if (_interviewUI) {
        _interviewUI.destroy();
        _interviewUI = null;
      }

      // On mobile: switch to detail view
      if (isMobile()) {
        showDetailPanel(root);
      }

      rerenderTree(root);
      rerenderRight(root);
    });
  });
}

// ── Bind right panel events ────────────────────────────────────

function bindRightEvents(root) {
  const rightPanel = root.querySelector('#right-panel');
  if (!rightPanel) return;

  // Mobile back button
  const backBtn = rightPanel.querySelector('#mobile-back-btn');
  backBtn?.addEventListener('click', () => {
    showTreePanel(root);
  });

  // ASK tab switching
  rightPanel.querySelectorAll('.ask-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      _activeAskTab = tab.dataset.askTab;
      rerenderRight(root);
    });
  });

  // Start diagnosis button
  rightPanel.querySelector('#start-diagnosis-btn')?.addEventListener('click', () => {
    _recordingMode   = true;
    _recordingStep   = 'intro';
    _currentQuestion = 0;
    _recordings      = {};
    _evalResult      = null;
    rerenderRight(root);
  });

  // Recording intro: start
  rightPanel.querySelector('#start-recording-btn')?.addEventListener('click', () => {
    _recordingStep = 'question';
    _currentQuestion = 0;
    rerenderRight(root);
    mountInterviewUI(root);
  });

  // Recording intro: cancel
  rightPanel.querySelector('#cancel-recording-btn')?.addEventListener('click', () => {
    _recordingMode = false;
    rerenderRight(root);
  });

  // Question screen: previous
  rightPanel.querySelector('#prev-q-btn')?.addEventListener('click', () => {
    if (_currentQuestion > 0) {
      if (_interviewUI) { _interviewUI.destroy(); _interviewUI = null; }
      _currentQuestion--;
      rerenderRight(root);
      mountInterviewUI(root);
    }
  });

  // Question screen: next/complete
  rightPanel.querySelector('#next-question-btn')?.addEventListener('click', () => {
    const questions = _selectedJob?.questions || [];
    const isLast = _currentQuestion === questions.length - 1;

    if (_interviewUI) { _interviewUI.destroy(); _interviewUI = null; }

    if (isLast) {
      _recordingStep = 'evaluating';
      rerenderRight(root);
      runEvaluation(root);
    } else {
      _currentQuestion++;
      rerenderRight(root);
      mountInterviewUI(root);
    }
  });

  // Result: retry
  rightPanel.querySelector('#retry-diagnosis-btn')?.addEventListener('click', () => {
    _recordingMode   = true;
    _recordingStep   = 'intro';
    _currentQuestion = 0;
    _recordings      = {};
    _evalResult      = null;
    rerenderRight(root);
  });

  // Result: back to detail
  rightPanel.querySelector('#back-to-detail-btn')?.addEventListener('click', () => {
    _recordingMode = false;
    rerenderRight(root);
  });
}

// ── InterviewUI lifecycle ──────────────────────────────────────

function mountInterviewUI(root) {
  if (!_selectedJob) return;
  const questions = _selectedJob.questions || [];
  const question  = questions[_currentQuestion];
  if (!question) return;

  const uiContainer = root.querySelector('#interview-ui-container');
  if (!uiContainer) return;

  if (_interviewUI) {
    _interviewUI.destroy();
    _interviewUI = null;
  }

  _interviewUI = new InterviewUI(uiContainer, {
    maxDuration: 180,
    onComplete: (transcript, duration) => {
      _recordings[question.id] = {
        transcript,
        duration,
        savedAt: new Date().toISOString(),
      };

      const indicator = root.querySelector('#saved-indicator');
      if (indicator) indicator.style.display = 'block';

      const nextBtn = root.querySelector('#next-question-btn');
      if (nextBtn) nextBtn.disabled = false;

      showToast('답변이 저장되었습니다', 'success', 2000);
    },
  });

  _interviewUI.setQuestion(question.text);
}

// ── Evaluation runner ──────────────────────────────────────────

async function runEvaluation(root) {
  // Simulate async evaluation delay (300ms)
  await new Promise(resolve => setTimeout(resolve, 800));

  _evalResult    = buildHRCompEvalResult(_recordings, _selectedJob);
  _recordingStep = 'result';

  // Persist session
  saveSession(_selectedJob.id, _recordings, _evalResult);

  rerenderRight(root);

  showToast('역량 평가가 완료되었습니다!', 'success')
      addNotification({ type: 'success', title: 'hr_competency', body: '역량 평가가 완료되었습니다!' });
}

// ── Partial re-renders ─────────────────────────────────────────

function rerenderTree(root) {
  const treePanel = root.querySelector('#tree-panel');
  if (!treePanel) return;

  // Replace with fresh tree HTML
  const newTree = document.createElement('div');
  newTree.innerHTML = renderTreePanel();
  const newTreeEl = newTree.firstElementChild;
  treePanel.replaceWith(newTreeEl);

  bindTreeEvents(root);
}

function rerenderRight(root) {
  const rightContent = root.querySelector('#right-content');
  if (!rightContent) return;

  rightContent.innerHTML = buildRightInner();
  bindRightEvents(root);

  // If in question step, mount InterviewUI
  if (_recordingMode && _recordingStep === 'question') {
    mountInterviewUI(root);
  }
}

function buildRightInner() {
  const mobile = isMobile();
  const mobileBack = mobile && _selectedJob ? `
    <div style="
      padding:12px 16px;border-bottom:1px solid var(--border);
      display:flex;align-items:center;gap:8px;background:var(--surface);
    ">
      <button id="mobile-back-btn" class="btn btn-ghost btn-sm"
              style="padding:4px 10px;min-height:32px">
        ← 목록
      </button>
      <span style="font-size:0.85rem;color:var(--text-muted)">
        ${escapeHtml(_selectedJob?.name_ko || '')}
      </span>
    </div>` : '';

  return mobileBack + renderRightContent();
}

// ── Mobile panel visibility ────────────────────────────────────

function showDetailPanel(root) {
  const treeWrapper = root.querySelector('#tree-panel-wrapper');
  const rightPanel  = root.querySelector('#right-panel');
  if (!treeWrapper || !rightPanel) return;

  treeWrapper.style.transform = 'translateX(-100%)';
  rightPanel.style.transform  = 'translateX(0)';
  rightPanel.style.display    = 'flex';
}

function showTreePanel(root) {
  const treeWrapper = root.querySelector('#tree-panel-wrapper');
  const rightPanel  = root.querySelector('#right-panel');
  if (!treeWrapper || !rightPanel) return;

  treeWrapper.style.transform = 'translateX(0)';
  rightPanel.style.transform  = 'translateX(100%)';

  // After transition, hide right panel on mobile
  setTimeout(() => {
    if (isMobile()) rightPanel.style.display = 'none';
  }, 320);
}

// ── Main render ────────────────────────────────────────────────

function render(root) {
  const mobile = isMobile();

  // Ensure first category is expanded by default
  if (!_selectedCat && HR_JOB_TREE.length > 0) {
    _selectedCat = HR_JOB_TREE[0].id;
  }

  root.innerHTML = `
    <div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden">

      <!-- Top Bar -->
      <div class="top-bar" style="flex-shrink:0">
        <button onclick="window.navBack()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0 8px 0 0;line-height:1">←</button>
        <div class="top-bar-title">HR 직무역량</div>
        <div style="width:60px"></div>
      </div>

      <!-- Split panel container -->
      <div id="hr-comp-body" style="
        display:flex;
        flex:1;
        overflow:hidden;
        position:relative;
      ">

        <!-- Left: Tree Panel -->
        <div id="tree-panel-wrapper" style="
          ${mobile ? `
            position:absolute;inset:0;
            z-index:10;
            transition:transform 0.3s ease;
            transform:translateX(0);
            width:100%;
          ` : `
            width:280px;
            flex-shrink:0;
          `}
          height:100%;
          overflow-y:auto;
          background:var(--surface);
          border-right:1px solid var(--border);
        ">
          <div style="padding:12px 16px;font-weight:700;color:var(--text-muted);
                      font-size:0.8rem;letter-spacing:.08em;border-bottom:1px solid var(--border)">
            HR 직무 체계
          </div>
          <div id="tree-inner">
            ${renderTreeItems()}
          </div>
        </div>

        <!-- Right: Content Panel -->
        <div id="right-panel" class="page-content" style="
          flex:1;
          overflow-y:auto;
          background:var(--bg);
          ${mobile ? `
            position:absolute;inset:0;
            z-index:10;
            transition:transform 0.3s ease;
            transform:translateX(100%);
            display:${_selectedJob ? 'flex' : 'none'};
            flex-direction:column;
          ` : `
            display:flex;
            flex-direction:column;
          `}
        ">
          <div id="right-content" style="flex:1">
            ${buildRightInner()}
          </div>
        </div>

      </div>
    </div>`;

  bindTreeItemEvents(root);
  bindRightEvents(root);

  // If job already selected on mobile, show detail
  if (mobile && _selectedJob) {
    const treeWrapper = root.querySelector('#tree-panel-wrapper');
    const rightPanel  = root.querySelector('#right-panel');
    if (treeWrapper) treeWrapper.style.transform = 'translateX(-100%)';
    if (rightPanel)  { rightPanel.style.display = 'flex'; rightPanel.style.transform = 'translateX(0)'; }
  }

  if (_recordingMode && _recordingStep === 'question') {
    mountInterviewUI(root);
  }
}

// ── Tree item inner HTML (for initial render & re-render) ──────

function renderTreeItems() {
  const categories = HR_JOB_TREE;

  return categories.map(cat => {
    const isOpen = _selectedCat === cat.id;
    const children = (cat.children || []).map(job => {
      const isActive = _selectedJob?.id === job.id;
      return `
        <div class="tree-item"
             data-job-id="${escapeHtml(job.id)}"
             style="
               padding:8px 12px 8px 36px;
               font-size:0.85rem;
               cursor:pointer;
               border-radius:6px;
               margin:2px 8px;
               transition:background 0.15s,color 0.15s;
               ${isActive
                 ? 'background:var(--primary-light);color:#fff;font-weight:600;'
                 : 'color:var(--text-muted);'}
             ">
          <span style="margin-right:6px;font-size:0.7rem">◆</span>${escapeHtml(job.name_ko)}
        </div>`;
    }).join('');

    return `
      <div class="tree-category" data-cat-id="${escapeHtml(cat.id)}">
        <div class="tree-cat-header"
             data-cat-id="${escapeHtml(cat.id)}"
             style="
               display:flex;
               align-items:center;
               justify-content:space-between;
               padding:10px 12px;
               cursor:pointer;
               border-radius:6px;
               margin:2px 8px;
               font-size:0.88rem;
               font-weight:600;
               color:var(--text);
               background:${isOpen ? 'var(--bg)' : 'transparent'};
               transition:background 0.15s;
             ">
          <span>${escapeHtml(cat.icon || '')} ${escapeHtml(cat.name_ko)}</span>
          <span style="font-size:0.7rem;color:var(--text-muted)">${isOpen ? '▼' : '▶'}</span>
        </div>
        <div class="tree-children"
             id="children-${escapeHtml(cat.id)}"
             style="display:${isOpen ? 'block' : 'none'}">
          ${children}
        </div>
      </div>`;
  }).join('');
}

// ── Bind tree item events (for #tree-inner) ────────────────────

function bindTreeItemEvents(root) {
  const treeInner = root.querySelector('#tree-inner');
  if (!treeInner) return;

  treeInner.querySelectorAll('.tree-cat-header').forEach(header => {
    header.addEventListener('click', () => {
      const catId = header.dataset.catId;
      _selectedCat = _selectedCat === catId ? null : catId;
      refreshTreeInner(root);
    });
  });

  treeInner.querySelectorAll('.tree-item').forEach(item => {
    item.addEventListener('click', () => {
      const jobId  = item.dataset.jobId;
      const allItems = getAllJobItems();
      const found  = allItems.find(j => j.id === jobId);
      if (!found) return;

      _selectedJob     = found;
      _recordingMode   = false;
      _recordingStep   = 'intro';
      _activeAskTab    = 'ability';
      _currentQuestion = 0;
      _recordings      = {};
      _evalResult      = null;

      if (_interviewUI) { _interviewUI.destroy(); _interviewUI = null; }

      refreshTreeInner(root);
      rerenderRight(root);

      if (isMobile()) {
        const treeWrapper = root.querySelector('#tree-panel-wrapper');
        const rightPanel  = root.querySelector('#right-panel');
        if (treeWrapper) treeWrapper.style.transform = 'translateX(-100%)';
        if (rightPanel)  {
          rightPanel.style.display   = 'flex';
          rightPanel.style.transform = 'translateX(0)';
        }
      }
    });
  });
}

function refreshTreeInner(root) {
  const treeInner = root.querySelector('#tree-inner');
  if (!treeInner) return;
  treeInner.innerHTML = renderTreeItems();
  bindTreeItemEvents(root);
}

// ── mount / unmount exports ────────────────────────────────────

export async function mount(root, state) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _root            = root;
  _selectedCat     = null;
  _selectedJob     = null;
  _activeAskTab    = 'ability';
  _recordingMode   = false;
  _recordingStep   = 'intro';
  _currentQuestion = 0;
  _recordings      = {};
  _evalResult      = null;

  if (_interviewUI) {
    _interviewUI.destroy();
    _interviewUI = null;
  }

  render(root);
}

export function unmount() {
  if (_interviewUI) {
    _interviewUI.destroy();
    _interviewUI = null;
  _selectedCat = null;
  _selectedJob = null;
  _currentQuestion = null;
}
  _root = null;
}
