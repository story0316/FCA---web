/**
 * journey.js – 내 여정 (My Journey)
 * 3대 축: 공통역량 / 직무전문성 / 조직경험
 * + 진단 목적 가이드 테이블 + 실 API 이력 타임라인
 */

import { api }    from '../api.js';
import {getUser, isApplicant } from '../auth.js';

function _session() {
  try { return JSON.parse(localStorage.getItem('hr_session') || '{}'); } catch { return {}; }
}
function _empId() {
  const s = _session();
  return s.empId || s.userId || getUser()?.id || 'EMP001';
}

const LS_DIAG   = 'hr_diag_results';
const LS_SURVEY = 'hr_survey_responses';
const LS_COMP   = 'hr_comp_sessions';

let _root      = null;
let _instances = [];
let _idpItems  = [];

// ── Diagnostic purpose guide data ────────────────────────────

const DIAG_GUIDE = [
  {
    type: '역량 진단\n(카드스와이프)',
    axis: '공통역량',
    purpose: '5대 핵심역량 자가진단',
    target: '전 직원',
    timing: '반기/연간',
    color: '#4F46E5',
  },
  {
    type: 'MBTI',
    axis: '공통역량',
    purpose: '성격 유형 이해·팀 협업 설계',
    target: '전 직원',
    timing: '채용/신규입사',
    color: '#7C3AED',
  },
  {
    type: 'DISC',
    axis: '공통역량',
    purpose: '행동 유형 분석·소통 스타일',
    target: '전 직원',
    timing: '연간',
    color: '#F59E0B',
  },
  {
    type: 'Holland',
    axis: '직무전문성',
    purpose: '직업 흥미·직무 적합도 탐색',
    target: '전 직원',
    timing: '채용/이동 검토',
    color: '#10B981',
  },
  {
    type: 'Birkman',
    axis: '직무전문성',
    purpose: '동기·스트레스·니즈 심층 진단',
    target: '리더/핵심인재',
    timing: '승진/코칭',
    color: '#8B5CF6',
  },
  {
    type: 'AI 인터뷰',
    axis: '직무전문성',
    purpose: '행동 기반 역량 심층 검증',
    target: '리더/승진 후보',
    timing: '평가/승진',
    color: '#EF4444',
  },
  {
    type: 'HR 직무역량\n트리',
    axis: '직무전문성',
    purpose: 'HR 소분류 ASK 자가진단',
    target: 'HR 직군',
    timing: '연간/이동 전',
    color: '#059669',
  },
  {
    type: '생애주기\n서베이',
    axis: '조직경험',
    purpose: '채용→재직→퇴직 전 단계 피드백',
    target: '전 직원·HR',
    timing: '각 단계별',
    color: 'var(--text-muted)',
  },
];

// ── Phase meta for 조직경험 ───────────────────────────────────

const PHASE_META = {
  hiring:      { name: '채용',   icon: '🎯', color: '#4F46E5' },
  onboarding:  { name: '온보딩', icon: '🚀', color: '#10B981' },
  performance: { name: '평가',   icon: '📊', color: '#F59E0B' },
  development: { name: '육성',   icon: '🌱', color: '#059669' },
  engagement:  { name: '재직',   icon: '💡', color: '#8B5CF6' },
  offboarding: { name: '퇴직',   icon: '🏁', color: 'var(--text-muted)' },
};

// ── Mount / Unmount ───────────────────────────────────────────

export async function mount(container) {
  if (isApplicant()) {
    container.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _root      = container;
  _instances = [];
  _idpItems  = [];

  // 스켈레톤 먼저 표시
  container.innerHTML = `
    <div class="page" style="background:var(--bg)">
      <div class="top-bar"><div class="top-bar-title">내 여정</div></div>
      <div class="page-content" style="padding-bottom:32px">
        ${[1,2,3].map(() => '<div class="skeleton skeleton-card" style="height:90px;margin-bottom:12px"></div>').join('')}
      </div>
    </div>`;

  await _loadApiData();
  if (_root) render(container);
}

export function unmount() {
  _root      = null;
  _instances = [];
  _idpItems  = [];
}

async function _loadApiData() {
  try {
    const user   = getUser();
    const userId = user?.id || user?.user_id;
    if (!userId || userId === 'demo') return;

    const [instRes, idpRes] = await Promise.allSettled([
      api.assessment.listInstances(userId),
      api.idp.get(userId),
    ]);

    if (instRes.status === 'fulfilled') {
      const raw = instRes.value;
      _instances = Array.isArray(raw) ? raw : (raw?.instances || []);
      try { localStorage.setItem('fca_user_instances_' + userId, JSON.stringify(_instances)); } catch {}
    }
    if (idpRes.status === 'fulfilled') {
      const raw = idpRes.value;
      _idpItems = raw?.items || (Array.isArray(raw) ? raw : []);
    }
  } catch {}
}

// ── Main render ───────────────────────────────────────────────

function render(root) {
  const { axis1, axis2, axis3 } = gatherAxisData();

  root.innerHTML = `
    <div class="page" style="background:var(--bg)">
      <div class="top-bar">
        <div class="top-bar-title">내 여정</div>
      </div>

      <div class="page-content fade-in" style="padding-bottom:32px">

        <!-- 역량 평가 현황 (API 실 데이터) -->
        ${renderAssessmentSummary()}

        <!-- 3대 축 요약 카드 -->
        <div style="margin-bottom:24px">
          <div class="section-title" style="margin-bottom:12px">📍 나의 성장 현황</div>
          <div style="display:grid;grid-template-columns:1fr;gap:12px">
            ${renderAxisCard('공통역량', '⚙️', '#4F46E5', axis1.score, axis1.detail, '#/assessment')}
            ${renderAxisCard('직무전문성', '🌳', '#059669', axis2.score, axis2.detail, '#/hr-competency')}
            ${renderAxisCard('조직경험', '🏢', '#8B5CF6', axis3.score, axis3.detail, '#/survey')}
          </div>
        </div>

        <!-- 진단 목적 가이드 -->
        <div style="margin-bottom:24px">
          <div class="section-title" style="margin-bottom:4px">📖 진단 목적 가이드</div>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px">
            각 진단 도구의 목적과 대상을 확인하세요
          </div>
          <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:var(--radius-md);border:1px solid var(--border)">
            <table style="width:100%;border-collapse:collapse;font-size:0.76rem;background:var(--surface)">
              <thead>
                <tr style="background:var(--border)">
                  <th style="padding:10px 12px;text-align:left;font-weight:700;color:var(--text-muted);white-space:nowrap;min-width:80px">진단 종류</th>
                  <th style="padding:10px 8px;text-align:left;font-weight:700;color:var(--text-muted);white-space:nowrap">축</th>
                  <th style="padding:10px 8px;text-align:left;font-weight:700;color:var(--text-muted);min-width:120px">목적</th>
                  <th style="padding:10px 8px;text-align:left;font-weight:700;color:var(--text-muted);white-space:nowrap">대상</th>
                  <th style="padding:10px 8px;text-align:left;font-weight:700;color:var(--text-muted);white-space:nowrap">시점</th>
                </tr>
              </thead>
              <tbody>
                ${DIAG_GUIDE.map((g, i) => `
                  <tr style="border-top:1px solid var(--border);background:${i % 2 === 0 ? 'var(--surface)' : '#F8FAFC'}">
                    <td style="padding:10px 12px;font-weight:600;color:var(--text);white-space:pre-line;line-height:1.4">
                      <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${g.color};margin-right:6px;flex-shrink:0;vertical-align:middle"></span>${g.type}
                    </td>
                    <td style="padding:10px 8px">
                      <span style="padding:2px 7px;border-radius:999px;font-size:0.68rem;font-weight:700;background:${g.color}20;color:${g.color};white-space:nowrap">${g.axis}</span>
                    </td>
                    <td style="padding:10px 8px;color:var(--text);line-height:1.4">${g.purpose}</td>
                    <td style="padding:10px 8px;color:var(--text-muted);white-space:nowrap">${g.target}</td>
                    <td style="padding:10px 8px;color:var(--text-muted);white-space:nowrap">${g.timing}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 조직경험 phase 타임라인 -->
        ${renderOrgExperienceTimeline(axis3.phaseMap)}

        <!-- 내 여정 타임라인 -->
        ${renderPersonalTimeline()}

        <!-- 빠른 이동 -->
        <div class="section-title" style="margin-bottom:10px">🚀 빠른 진단 시작</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${[
            { label: '역량 진단', icon: '📋', hash: '#/assessment', color: '#4F46E5' },
            { label: 'HR 직무역량', icon: '🌳', hash: '#/hr-competency', color: '#059669' },
            { label: '생애주기 서베이', icon: '📝', hash: '#/survey', color: '#8B5CF6' },
            { label: '내 성장 보기', icon: '📈', hash: '#/growth', color: '#EF4444' },
          ].map(a => `
            <button onclick="window.location.hash='${a.hash}'"
                    style="display:flex;align-items:center;gap:8px;padding:14px;
                           background:var(--surface);border:1.5px solid var(--border);
                           border-radius:var(--radius-md);cursor:pointer;font-size:0.83rem;
                           font-weight:600;color:var(--text);text-align:left;
                           transition:border-color 0.15s">
              <span style="font-size:1.2rem">${a.icon}</span>
              ${a.label}
            </button>
          `).join('')}
        </div>

      </div>
    </div>
  `;
}

// ── Assessment summary (API) ──────────────────────────────────

function renderAssessmentSummary() {
  if (!_instances.length) return '';

  const DONE  = new Set(['completed', 'calibrated', 'approved', 'finalized']);
  const TERM  = new Set([...DONE, 'cancelled']);
  const done  = _instances.filter(i => DONE.has(i.status));
  const active = _instances.filter(i => !TERM.has(i.status));
  const total = _instances.length;

  const STATUS_LABEL = {
    draft: '초안', self_evaluation: '자기평가', manager_evaluation: '상사평가',
    peer_evaluation: '동료평가', calibration: '조율', completed: '완료',
    calibrated: '캘리브레이션 완료', approved: '승인', finalized: '최종 확정',
  };
  const STATUS_COLOR = {
    draft: 'var(--text-muted)', self_evaluation: '#4F46E5', manager_evaluation: '#8B5CF6',
    peer_evaluation: '#0EA5E9', calibration: '#EC4899',
    completed: '#10B981', calibrated: '#10B981', approved: '#10B981', finalized: '#10B981',
  };

  const instCards = _instances.slice(0, 5).map(inst => {
    const st   = inst.status || 'draft';
    const col  = STATUS_COLOR[st] || 'var(--text-muted)';
    const lbl  = STATUS_LABEL[st] || st;
    const name = inst.cycle_name || inst.cycle_id || '평가 사이클';
    const iid  = inst.id || inst.instance_id || '';
    const action = DONE.has(st)
      ? `onclick="window.appState=window.appState||{};window.appState.instanceId='${_esc(iid)}';window.location.hash='#/results'"`
      : `onclick="window.location.hash='#/diagnostics'"`;
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer"
           ${action}>
        <span style="width:8px;height:8px;border-radius:50%;background:${col};flex-shrink:0"></span>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.8rem;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(name)}</div>
          <span style="font-size:0.68rem;color:${col};font-weight:700">${lbl}</span>
        </div>
        <span style="font-size:0.7rem;color:var(--text-muted);flex-shrink:0">${DONE.has(st) ? '결과 보기 →' : '진행 중'}</span>
      </div>`;
  }).join('');

  return `
    <div style="margin-bottom:20px">
      <div class="section-title" style="margin-bottom:10px">📋 역량 평가 이력</div>
      <div class="card" style="padding:14px">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
          <div style="text-align:center;background:var(--bg);border-radius:8px;padding:8px">
            <div style="font-size:1.3rem;font-weight:800;color:var(--primary)">${total}</div>
            <div style="font-size:0.62rem;color:var(--text-muted)">전체</div>
          </div>
          <div style="text-align:center;background:var(--bg);border-radius:8px;padding:8px">
            <div style="font-size:1.3rem;font-weight:800;color:var(--success)">${done.length}</div>
            <div style="font-size:0.62rem;color:var(--text-muted)">완료</div>
          </div>
          <div style="text-align:center;background:var(--bg);border-radius:8px;padding:8px">
            <div style="font-size:1.3rem;font-weight:800;color:${active.length > 0 ? 'var(--warning)' : 'var(--text-muted)'}">${active.length}</div>
            <div style="font-size:0.62rem;color:var(--text-muted)">진행 중</div>
          </div>
        </div>
        ${instCards}
        ${total > 5 ? `<div style="text-align:center;padding-top:6px"><a href="#/diagnostics" style="font-size:0.75rem;color:var(--primary)">전체 보기 →</a></div>` : ''}
      </div>
    </div>`;
}

// ── Axis card ─────────────────────────────────────────────────

function renderAxisCard(title, icon, color, score, detail, href) {
  const pct = Math.min(100, Math.round(score));
  return `
    <div class="card" style="padding:16px;border-left:4px solid ${color}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:1.4rem">${icon}</span>
          <div style="font-weight:700;font-size:0.95rem;color:var(--text)">${title}</div>
        </div>
        <button onclick="window.location.hash='${href}'"
                style="font-size:0.75rem;color:${color};background:${color}15;
                       border:none;padding:4px 10px;border-radius:999px;cursor:pointer;font-weight:600">
          진단하기 →
        </button>
      </div>
      <div style="margin-bottom:8px">
        <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width 0.6s ease"></div>
        </div>
      </div>
      <div style="font-size:0.78rem;color:var(--text-muted)">${detail}</div>
    </div>
  `;
}

// ── Org Experience timeline ────────────────────────────────────

function renderOrgExperienceTimeline(phaseMap) {
  const phases = Object.entries(PHASE_META);
  return `
    <div style="margin-bottom:24px">
      <div class="section-title" style="margin-bottom:12px">🏢 조직경험 타임라인</div>
      <div style="display:flex;flex-direction:column;gap:0">
        ${phases.map(([key, meta], i) => {
          const count = (phaseMap[key] || []).length;
          const isLast = i === phases.length - 1;
          return `
            <div style="display:flex;align-items:flex-start;gap:12px;position:relative">
              <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">
                <div style="width:36px;height:36px;border-radius:50%;
                            background:${count > 0 ? meta.color : 'var(--border)'};
                            display:flex;align-items:center;justify-content:center;
                            font-size:1rem;color:#fff;font-weight:700;
                            border:3px solid ${count > 0 ? meta.color + '40' : 'var(--border)'}">
                  ${meta.icon}
                </div>
                ${!isLast ? `<div style="width:2px;min-height:28px;background:${count > 0 ? meta.color + '40' : 'var(--border)'}"></div>` : ''}
              </div>
              <div style="padding-bottom:${isLast ? 0 : 16}px;padding-top:6px;flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-weight:700;font-size:0.88rem;color:${count > 0 ? 'var(--text)' : 'var(--text-muted)'}">
                    ${meta.name}
                  </span>
                  ${count > 0
                    ? `<span style="padding:2px 7px;border-radius:999px;background:${meta.color}20;color:${meta.color};font-size:0.68rem;font-weight:700">${count}개 완료</span>`
                    : `<span style="font-size:0.72rem;color:var(--text-light)">미완료</span>`
                  }
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ── Personal history timeline ─────────────────────────────────

function renderPersonalTimeline() {
  let events = [];

  try {
    const diagResults = JSON.parse(localStorage.getItem(LS_DIAG) || '{}');
    Object.entries(diagResults).forEach(([kitId, r]) => {
      if (!r?.savedAt) return;
      events.push({ date: r.savedAt, icon: '🧩', color: '#7C3AED', label: kitId.replace('KIT_', '') + ' 진단', detail: r.typeCode || '완료' });
    });
  } catch {}

  try {
    const sessions = JSON.parse(localStorage.getItem(LS_COMP) || '[]');
    if (Array.isArray(sessions)) {
      sessions.forEach(s => {
        const d = s.createdAt || s.savedAt;
        if (!d) return;
        events.push({ date: d, icon: '🌳', color: '#059669', label: 'HR 역량 진단', detail: (s.category || s.source || '') + (s.level ? ' · ' + s.level : '') });
      });
    }
  } catch {}

  try {
    const surveyResp = JSON.parse(localStorage.getItem(LS_SURVEY) || '{}');
    Object.values(surveyResp).forEach(s => {
      const d = s.completedAt || s.answeredAt;
      if (!d) return;
      events.push({ date: d, icon: '📝', color: '#8B5CF6', label: '생애주기 서베이', detail: s.phase || '' });
    });
  } catch {}

  // API 인스턴스 이벤트 추가
  const DONE_SET = new Set(['completed', 'calibrated', 'approved', 'finalized']);
  _instances.forEach(inst => {
    const date = inst.created_at || inst.updatedAt;
    if (!date) return;
    const isDone = DONE_SET.has(inst.status);
    events.push({
      date,
      icon: isDone ? '✅' : '📋',
      color: isDone ? '#10B981' : '#4F46E5',
      label: inst.cycle_name || '역량 평가',
      detail: isDone ? '평가 완료' : '진행 중',
    });
  });

  // API IDP 이벤트 추가 (완료 항목만)
  _idpItems.filter(i => i.status === 'completed').forEach(item => {
    const date = item.updated_at || item.target_date;
    if (!date) return;
    events.push({
      date,
      icon: '🌱',
      color: '#059669',
      label: item.competency_name_ko || 'IDP 완료',
      detail: item.resource_title_ko || '',
    });
  });

  if (!events.length) return '';

  events.sort((a, b) => new Date(b.date) - new Date(a.date));

  const fmt = iso => {
    try {
      const d = new Date(iso);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    } catch { return ''; }
  };

  return `
    <div style="margin-bottom:24px">
      <div class="section-title" style="margin-bottom:12px">📅 나의 활동 기록</div>
      <div style="position:relative">
        <div style="position:absolute;left:15px;top:0;bottom:0;width:1.5px;background:var(--border)"></div>
        ${events.slice(0, 8).map(ev => `
          <div style="display:flex;gap:12px;margin-bottom:12px;padding-left:2px">
            <div style="flex-shrink:0;width:30px;height:30px;border-radius:50%;
                        background:${ev.color}15;border:2px solid ${ev.color};
                        display:flex;align-items:center;justify-content:center;
                        font-size:0.75rem;z-index:1;position:relative">
              ${ev.icon}
            </div>
            <div style="flex:1;background:var(--surface);border:1px solid var(--border);
                        border-radius:var(--radius-sm);padding:8px 12px">
              <div style="font-size:0.8rem;font-weight:700;color:var(--text)">${ev.label}</div>
              <div style="font-size:0.7rem;color:var(--text-muted);margin-top:1px">
                ${ev.detail ? ev.detail + ' · ' : ''}${fmt(ev.date)}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ── Data gathering ────────────────────────────────────────────

function gatherAxisData() {
  // 1. 공통역량 (hr_diag_results)
  let diagResults = {};
  try { diagResults = JSON.parse(localStorage.getItem(LS_DIAG) || '{}'); } catch {}
  const kitCount  = Object.keys(diagResults).length;
  const totalKits = 5;
  const axis1 = {
    score:  Math.round((kitCount / totalKits) * 100),
    detail: kitCount > 0
      ? `${kitCount}/${totalKits}개 진단 완료`
      : '아직 완료한 진단이 없습니다',
  };

  // 2. 직무전문성 (hr_comp_sessions)
  let compSessions = [];
  try {
    const raw = JSON.parse(localStorage.getItem(LS_COMP) || '[]');
    compSessions = Array.isArray(raw) ? raw : [];
  } catch {}
  const l3Count = compSessions.filter(s => s.level === 'L3').length;
  const l2Count = compSessions.filter(s => s.level === 'L2').length;
  const axis2Score = compSessions.length === 0 ? 0 :
    Math.min(100, Math.round((l3Count * 3 + l2Count * 2 + (compSessions.length - l3Count - l2Count)) / (compSessions.length * 3) * 100));
  const axis2 = {
    score:  axis2Score,
    detail: compSessions.length > 0
      ? `${compSessions.length}개 직무 진단 완료 (L3: ${l3Count}, L2: ${l2Count})`
      : '아직 완료한 직무역량 진단이 없습니다',
  };

  // 3. 조직경험 (hr_survey_responses)
  let surveyResp = {};
  try { surveyResp = JSON.parse(localStorage.getItem(LS_SURVEY) || '{}'); } catch {}
  const surveys = Object.values(surveyResp);
  const phaseMap = {};
  surveys.forEach(s => {
    const phase = s.phase || 'unknown';
    if (!phaseMap[phase]) phaseMap[phase] = [];
    phaseMap[phase].push(s);
  });
  const phaseCount = Object.keys(phaseMap).filter(k => k !== 'unknown').length;
  const axis3 = {
    score:  Math.round((phaseCount / 6) * 100),
    detail: surveys.length > 0
      ? `${surveys.length}개 서베이 완료 (${phaseCount}/6 단계 경험)`
      : '아직 완료한 서베이가 없습니다',
    phaseMap,
  };

  return { axis1, axis2, axis3 };
}

function _esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
