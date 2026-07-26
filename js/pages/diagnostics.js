/**
 * diagnostics.js — 진단 센터 (리뉴얼)
 *
 * 탭 구조: 공통역량 | 직무전문성 | 서베이
 *
 * 공통역량: 역량 진단(카드스와이프) + 진단 Kit(MBTI/DISC/Holland/Birkman)
 * 직무전문성: HR 직무역량 트리 + AI 역량 인터뷰
 * 서베이: 생애주기 서베이 + 직무서베이
 *
 * 화면 이탈 없이 모든 진입점을 하나의 허브에서 관리.
 */

import { getUser, isApplicant } from '../auth.js';
import { api } from '../api.js';
import { renderWorkflowBadge } from '../components/workflow-badge.js';

let _root = null;
let _tab  = 'common';   // 'common' | 'job' | 'survey'
let _instances      = [];
let _evaluatorTasks = [];

function _esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function _date(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

// ── 데이터 로딩 ───────────────────────────────────────────────

function _getDiagResults()  { try { return JSON.parse(localStorage.getItem('hr_diag_results') || '{}'); } catch { return {}; } }
function _getCompSessions() { try { return JSON.parse(localStorage.getItem('hr_comp_sessions') || '[]'); } catch { return []; } }
function _getSurveyResp()   { try { return JSON.parse(localStorage.getItem('hr_survey_responses') || '{}'); } catch { return {}; } }

// ── 진단 Kit 정의 ─────────────────────────────────────────────

const KITS = [
  { id: 'KIT_MBTI',      label: 'MBTI',       icon: '🧠', desc: '성격 유형 진단', color: '#6366F1', bg: '#EEF2FF' },
  { id: 'KIT_DISC',      label: 'DISC',        icon: '🎯', desc: '행동 유형 진단', color: '#F59E0B', bg: '#FFFBEB' },
  { id: 'KIT_HOLLAND',   label: 'Holland',     icon: '🌐', desc: '직업 흥미 코드', color: '#10B981', bg: '#ECFDF5' },
  { id: 'KIT_BIRKMAN',   label: 'Birkman',     icon: '🔬', desc: '직무 적합성',   color: '#3B82F6', bg: '#EFF6FF' },
  { id: 'KIT_INTERVIEW', label: '인터뷰 역량 자가진단', icon: '🎤', desc: '역량 면접 자기평가', color: '#8B5CF6', bg: '#F5F3FF' },
];

// ── Mount / Unmount ───────────────────────────────────────────

export async function mount(container) {
  if (isApplicant()) {
    container.innerHTML = `
<div style="padding:60px 24px;text-align:center;background:var(--bg);min-height:100vh">
  <div style="font-size:48px;margin-bottom:16px">🔒</div>
  <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용</div>
  <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
</div>`;
    return;
  }

  _root = container;

  // URL 파라미터로 탭 지정 가능 (#/diagnostics?tab=job)
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const tabParam = params.get('tab');
  if (['common','job','survey'].includes(tabParam)) _tab = tabParam;

  _draw();

  // 비동기 인스턴스 로딩
  try {
    const user   = getUser();
    const userId = user?.id || user?.user_id;
    if (userId && localStorage.getItem('hr_token') !== 'demo-token') {
      const [rawInst, evalData] = await Promise.allSettled([
        api.assessment.listInstances(userId),
        api.assessment.getPendingForMe(),
      ]);
      _instances      = rawInst.status === 'fulfilled'
        ? (Array.isArray(rawInst.value) ? rawInst.value : (rawInst.value?.instances || []))
        : [];
      _evaluatorTasks = evalData.status === 'fulfilled' ? (evalData.value || []) : [];
      if (_root) _draw();
    }
  } catch {}
}

export function unmount() {
  _root = null;
  _instances = [];
  _evaluatorTasks = [];
}

// ── 메인 렌더 ────────────────────────────────────────────────

function _draw() {
  if (!_root) return;

  const diagResults  = _getDiagResults();
  const compSessions = _getCompSessions();
  const surveyResp   = _getSurveyResp();

  const hasAssessment = compSessions.some(s => s.type === 'assessment' || !s.type);
  const kitsDone      = KITS.filter(k => !!diagResults[k.id]).length;
  const surveyDone    = Object.keys(surveyResp).length;
  const hrSessions    = compSessions.filter(s => s.source === 'hr_competency' || s.category === 'HR');

  _root.innerHTML = `
<div class="page" style="background:var(--bg)">

  <!-- 탑바 -->
  <div class="top-bar">
    <div class="top-bar-title">🔬 진단 센터</div>
    <a href="#/results" style="font-size:12px;font-weight:700;color:var(--primary);
       text-decoration:none;white-space:nowrap">결과 →</a>
  </div>

  <!-- 진행 중인 평가 알림 배너 -->
  ${_renderPendingBanner()}

  <!-- 탭 바 -->
  <div style="display:flex;border-bottom:1.5px solid var(--border);background:var(--surface);
              position:sticky;top:60px;z-index:10;flex-shrink:0">
    ${_tabBtn('common', '공통역량',   hasAssessment || kitsDone > 0 ? `${(hasAssessment?1:0)+kitsDone}완료` : '')}
    ${_tabBtn('job',    '직무역량',   hrSessions.length > 0 ? `${hrSessions.length}회 완료` : '')}
    ${_tabBtn('survey', '서베이·참여', surveyDone > 0 ? `${surveyDone}/6` : '')}
  </div>

  <!-- 탭 콘텐츠 -->
  <div class="page-content" id="diag-tab-content">
    ${_tab === 'common'  ? _renderCommon(diagResults, compSessions, hasAssessment, kitsDone) : ''}
    ${_tab === 'job'     ? _renderJob(hrSessions) : ''}
    ${_tab === 'survey'  ? _renderSurvey(surveyResp, surveyDone) : ''}
  </div>

</div>`;

  // 탭 클릭 이벤트
  _root.querySelectorAll('[data-diag-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      _tab = btn.dataset.diagTab;
      _draw();
      // 탭 전환 시 콘텐츠 상단으로 스크롤
      _root.querySelector('.page-content')?.scrollTo(0, 0);
    });
  });
}

// ── 탭 버튼 ──────────────────────────────────────────────────

function _tabBtn(id, label, badge) {
  const active = _tab === id;
  return `
<button data-diag-tab="${id}"
  style="flex:1;padding:12px 4px 10px;background:none;border:none;cursor:pointer;
         font-size:13px;font-weight:${active ? '700' : '500'};
         color:${active ? 'var(--primary)' : 'var(--text-muted)'};
         border-bottom:2.5px solid ${active ? 'var(--primary)' : 'transparent'};
         margin-bottom:-1.5px;transition:color .15s;display:flex;flex-direction:column;
         align-items:center;gap:3px">
  ${_esc(label)}
  ${badge ? `<span style="font-size:9px;padding:1px 6px;border-radius:9999px;
    background:${active ? 'var(--primary)' : 'var(--bg-subtle)'};
    color:${active ? '#fff' : 'var(--text-muted)'};">${_esc(badge)}</span>` : ''}
</button>`;
}

// ── 탭1: 공통역량 ────────────────────────────────────────────

function _renderCommon(diagResults, compSessions, hasAssessment, kitsDone) {
  const lastAssess = compSessions.find(s => s.type === 'assessment' || !s.type);

  return `
<!-- ① 역량 진단 (카드스와이프) -->
<div style="margin-bottom:20px">
  <div style="display:flex;align-items:center;gap:6px;margin-bottom:12px">
    <span style="font-size:16px">📊</span>
    <div style="font-size:14px;font-weight:700;color:var(--text)">역량 진단</div>
    <span class="badge ${hasAssessment ? 'badge-success' : 'badge-gray'}" style="margin-left:auto">
      ${hasAssessment ? '완료' : '미완료'}
    </span>
  </div>
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px">
    <p style="font-size:13px;color:var(--text-muted);line-height:1.6;margin-bottom:14px">
      조직이 정의한 <strong>5대 핵심역량</strong>을 카드 스와이프로 자기 평가합니다.<br>
      결과를 바탕으로 IDP(개발 계획)가 자동 생성됩니다.
    </p>
    ${hasAssessment ? `
    <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;
                background:var(--success-light);border-radius:8px;margin-bottom:12px;
                font-size:12px;color:var(--success)">
      <span>✅</span>
      <span>마지막 진단: ${_date(lastAssess?.createdAt || lastAssess?.savedAt)}</span>
      <a href="#/growth" style="margin-left:auto;color:var(--success);font-weight:700;
         font-size:11px;text-decoration:none">성장 계획 보기 →</a>
    </div>` : ''}
    <div style="display:flex;gap:8px">
      <a href="#/assessment" class="btn btn-primary btn-sm"
         style="flex:1;text-decoration:none;text-align:center">
        ${hasAssessment ? '🔄 재진단' : '🚀 시작하기'}
      </a>
      ${hasAssessment ? `<a href="#/results" class="btn btn-outline btn-sm"
         style="flex:1;text-decoration:none;text-align:center">결과 보기</a>` : ''}
    </div>
  </div>
</div>

<!-- ② 진단 Kit -->
<div>
  <div style="display:flex;align-items:center;gap:6px;margin-bottom:12px">
    <span style="font-size:16px">🧩</span>
    <div style="font-size:14px;font-weight:700;color:var(--text)">진단 Kit</div>
    <span style="font-size:11px;color:${kitsDone > 0 ? 'var(--success)' : 'var(--text-muted)'};
                 font-weight:700;margin-left:auto">${kitsDone}/${KITS.length} 완료</span>
  </div>
  <p style="font-size:13px;color:var(--text-muted);line-height:1.6;margin-bottom:12px">
    MBTI·DISC 등 표준 도구로 성격·행동·직업 흥미를 파악합니다.
  </p>
  <div style="display:flex;flex-direction:column;gap:8px">
    ${KITS.map(kit => {
      const done   = !!diagResults[kit.id];
      const result = diagResults[kit.id];
      return `
<a href="#/diagnostic?kit=${kit.id}" style="text-decoration:none">
  <div style="display:flex;align-items:center;gap:12px;padding:13px 14px;
              background:var(--surface);border:1.5px solid ${done ? 'var(--success)' : 'var(--border)'};
              border-radius:12px;transition:border-color .15s"
       onmouseover="this.style.borderColor='${done ? 'var(--success)' : kit.color}'"
       onmouseout="this.style.borderColor='${done ? 'var(--success)' : 'var(--border)'}'">
    <div style="width:40px;height:40px;border-radius:10px;background:${kit.bg};
                display:flex;align-items:center;justify-content:center;
                font-size:20px;flex-shrink:0">${kit.icon}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:700;color:${done ? 'var(--success)' : 'var(--text)'}">
        ${kit.label}
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:1px">
        ${done
          ? `${result.typeCode || '완료'}${result.savedAt ? ' · ' + _date(result.savedAt) : ''}`
          : kit.desc}
      </div>
    </div>
    <span style="font-size:${done ? '16' : '14'}px;color:${done ? 'var(--success)' : 'var(--text-light)'}">
      ${done ? '✓' : '›'}
    </span>
  </div>
</a>`;
    }).join('')}
  </div>
</div>`;
}

// ── 탭2: 직무전문성 ──────────────────────────────────────────

function _renderJob(hrSessions) {
  const lastHr = hrSessions[hrSessions.length - 1];

  const completionBanner = lastHr ? `
<div style="background:linear-gradient(135deg,#EEF2FF,#F5F3FF);border:1.5px solid #C7D2FE;
            border-radius:12px;padding:14px 16px;margin-bottom:16px;
            display:flex;align-items:center;justify-content:space-between;gap:12px">
  <div>
    <div style="font-size:12px;font-weight:700;color:#4F46E5;margin-bottom:3px">
      🌳 직무역량 진단 완료 · ${hrSessions.length}개 직무
    </div>
    <div style="font-size:11px;color:var(--text-muted)">
      최근: ${_esc(lastHr.jobName || lastHr.jobId)}
      ${lastHr.level ? ` · ${_esc(lastHr.level)}` : ''}
      ${lastHr.totalScore != null ? ` · ${lastHr.totalScore}점` : ''}
    </div>
  </div>
  <a href="#/growth" style="white-space:nowrap;font-size:11px;font-weight:700;
     color:#4F46E5;text-decoration:none;padding:6px 12px;background:#EEF2FF;
     border-radius:20px;flex-shrink:0">
    성장 보기 →
  </a>
</div>` : '';

  return `
${completionBanner}
<!-- ══ 그룹1: 역량 검증 ══ -->
<div style="margin-bottom:24px">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;
              padding:8px 12px;background:linear-gradient(90deg,#EEF2FF,transparent);
              border-left:3px solid #6366F1;border-radius:0 8px 8px 0">
    <span style="font-size:15px">🎯</span>
    <div>
      <div style="font-size:13px;font-weight:800;color:#4F46E5">역량 검증</div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:1px">면접 준비 · 기초 능력 측정</div>
    </div>
  </div>

  <!-- AI 모의 면접 연습 -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span style="font-size:18px">🎤</span>
      <div style="font-size:13px;font-weight:700;color:var(--text)">AI 모의 면접 연습</div>
    </div>
    <p style="font-size:12px;color:var(--text-muted);line-height:1.6;margin-bottom:12px">
      역량 기반 구조화 면접을 AI와 함께 연습합니다.<br>
      음성 응답 → AI 평가 → 개선 포인트 피드백.
    </p>
    <a href="#/interview" class="btn btn-primary btn-sm btn-block"
       style="text-decoration:none;text-align:center">🎤 인터뷰 시작</a>
  </div>

  <!-- 인적성 검사 -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span style="font-size:18px">🧠</span>
      <div style="font-size:13px;font-weight:700;color:var(--text)">인적성 검사</div>
    </div>
    <p style="font-size:12px;color:var(--text-muted);line-height:1.6;margin-bottom:12px">
      언어·수리·공간·추리 영역의 표준화 인적성 검사.<br>
      지원자 및 신규 입사자 대상 역량 베이스라인 측정.
    </p>
    <a href="#/aptitude" class="btn btn-outline btn-sm btn-block"
       style="text-decoration:none;text-align:center">인적성 검사 시작</a>
  </div>
</div>

<!-- ══ 그룹2: 직무 심화 진단 ══ -->
<div>
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;
              padding:8px 12px;background:linear-gradient(90deg,#F0FDF4,transparent);
              border-left:3px solid #10B981;border-radius:0 8px 8px 0">
    <span style="font-size:15px">🌱</span>
    <div>
      <div style="font-size:13px;font-weight:800;color:#059669">직무 심화 진단</div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:1px">재직 중 심화 · HR 전문성 · 관심 직무 탐색</div>
    </div>
  </div>

  <!-- HR 직무역량 트리 -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span style="font-size:18px">🌳</span>
      <div style="font-size:13px;font-weight:700;color:var(--text)">HR 직무역량 트리</div>
      <span class="badge ${hrSessions.length > 0 ? 'badge-success' : 'badge-gray'}" style="margin-left:auto;font-size:10px">
        ${hrSessions.length > 0 ? `${hrSessions.length}회 진단` : '미시작'}
      </span>
    </div>
    <p style="font-size:12px;color:var(--text-muted);line-height:1.6;margin-bottom:12px">
      HR 직무를 <strong>채용·노무·HRBP·L&D·C&B</strong> 5개 영역으로 세분화하고,<br>
      각 직무의 ASK(지식·기술·태도) 기준으로 현재 수준을 진단합니다.
    </p>
    ${hrSessions.length > 0 ? `
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
      ${hrSessions.slice(-3).reverse().map(s => `
      <div style="font-size:11px;padding:3px 10px;background:var(--primary-bg);
                  color:var(--primary);border-radius:20px;font-weight:600">
        ${_esc(s.jobName || s.jobId)} ${s.level ? `· Lv.${s.level}` : ''}
      </div>`).join('')}
    </div>` : ''}
    ${hrSessions.length > 0 ? `
    <a href="#/growth" class="btn btn-outline btn-sm btn-block"
       style="text-decoration:none;text-align:center;margin-bottom:8px">
      📈 성장 페이지에서 결과 확인
    </a>` : ''}
    <a href="#/hr-competency" class="btn btn-primary btn-sm btn-block"
       style="text-decoration:none;text-align:center">
      ${hrSessions.length > 0 ? '🔄 재진단 / 다른 직무 진단' : '🌳 직무 역량 탐색 시작'}
    </a>
  </div>

  <!-- 직무 서베이 -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span style="font-size:18px">📝</span>
      <div style="font-size:13px;font-weight:700;color:var(--text)">직무 서베이</div>
    </div>
    <p style="font-size:12px;color:var(--text-muted);line-height:1.6;margin-bottom:12px">
      HR·개발·마케팅·영업·기획 등 관심 직무를 선택하고<br>
      해당 역량에 맞는 맞춤 서베이에 응답합니다.
    </p>
    <a href="#/survey?tab=job" class="btn btn-outline btn-sm btn-block"
       style="text-decoration:none;text-align:center">직무 서베이 시작</a>
  </div>
</div>`;
}

// ── 탭3: 서베이 ──────────────────────────────────────────────

function _renderSurvey(surveyResp, surveyDone) {
  const PHASES = [
    { key: 'hiring',     label: '채용',   icon: '📢', color: '#6366F1' },
    { key: 'onboarding', label: '온보딩', icon: '🚀', color: '#10B981' },
    { key: 'development',label: '육성',   icon: '📚', color: '#8B5CF6' },
    { key: 'evaluation', label: '평가',   icon: '📊', color: '#F59E0B' },
    { key: 'retention',  label: '재직',   icon: '🏢', color: '#3B82F6' },
    { key: 'exit',       label: '퇴직',   icon: '👋', color: '#EF4444' },
  ];

  return `
<!-- 생애주기 안내 -->
<div style="background:var(--primary-bg);border:1px solid var(--primary-border);
            border-radius:12px;padding:14px;margin-bottom:20px">
  <div style="font-size:13px;font-weight:700;color:var(--primary);margin-bottom:6px">
    📋 생애주기 서베이란?
  </div>
  <div style="font-size:12px;color:var(--text-muted);line-height:1.7">
    채용부터 퇴직까지 <strong>6단계 생애주기</strong>마다 조직 경험을 측정합니다.<br>
    구성원 경험 데이터는 HR 정책 개선에 활용됩니다.
  </div>
</div>

<!-- 6단계 진행 현황 -->
<div style="margin-bottom:20px">
  <div style="display:flex;align-items:center;gap:6px;margin-bottom:12px">
    <span style="font-size:16px">📈</span>
    <div style="font-size:14px;font-weight:700;color:var(--text)">생애주기 서베이</div>
    <span style="font-size:11px;font-weight:700;color:var(--info);margin-left:auto">
      ${surveyDone}/6 완료
    </span>
  </div>
  <div style="display:flex;flex-direction:column;gap:8px">
    ${PHASES.map(p => {
      const done = !!surveyResp[p.key];
      const resp = surveyResp[p.key];
      return `
<div style="display:flex;align-items:center;gap:12px;padding:13px 14px;
            background:var(--surface);border:1.5px solid ${done ? p.color + '55' : 'var(--border)'};
            border-radius:12px;cursor:pointer"
     onclick="window.location.hash='#/survey?phase=${p.key}'">
  <div style="width:36px;height:36px;border-radius:9px;
              background:${done ? p.color + '22' : 'var(--bg-subtle)'};
              display:flex;align-items:center;justify-content:center;
              font-size:18px;flex-shrink:0">${p.icon}</div>
  <div style="flex:1">
    <div style="font-size:13px;font-weight:700;color:${done ? 'var(--text)' : 'var(--text)'}">
      ${p.label} 단계
    </div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:1px">
      ${done
        ? (resp.answeredAt ? `완료 · ${_date(resp.answeredAt)}` : '완료')
        : '응답 전'}
    </div>
  </div>
  <span style="font-size:${done ? 16 : 14}px;color:${done ? p.color : 'var(--text-light)'}">
    ${done ? '✓' : '›'}
  </span>
</div>`;
    }).join('')}
  </div>
</div>

<!-- 펄스 서베이 -->
<div>
  <div style="display:flex;align-items:center;gap:6px;margin-bottom:12px">
    <span style="font-size:16px">💓</span>
    <div style="font-size:14px;font-weight:700;color:var(--text)">펄스 서베이</div>
    <span class="badge badge-info" style="margin-left:auto;font-size:10px">월간</span>
  </div>
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px">
    <p style="font-size:13px;color:var(--text-muted);line-height:1.6;margin-bottom:14px">
      5분 이내의 짧은 월간 체크인으로<br>현재 업무 만족도와 조직 분위기를 공유합니다.
    </p>
    <a href="#/pulse-survey" class="btn btn-outline btn-sm btn-block"
       style="text-decoration:none;text-align:center">💓 지금 응답하기</a>
  </div>
</div>`;
}

// ── 진행 중인 평가 배너 ───────────────────────────────────────

function _renderPendingBanner() {
  const TERMINAL = new Set(['completed','calibrated','approved','finalized','cancelled']);
  const active   = _instances.filter(i => !TERMINAL.has(i.status));
  const pending  = _evaluatorTasks.filter(a => a.assignment_status === 'pending');
  const total    = active.length + pending.length;
  if (!total) return '';

  const EVAL_LABELS = { self:'자기평가', manager:'상사평가', peer:'동료평가', subordinate:'부하평가', customer:'고객평가' };

  return `
<div style="background:#EEF2FF;border-bottom:1px solid var(--primary-border);padding:10px 16px">
  <div style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:8px">
    📋 진행 중인 평가 ${total}건
  </div>
  ${active.slice(0,3).map(inst => {
    const id = inst.id || inst.instance_id;
    return `
<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;
            background:var(--surface);border-radius:8px;margin-bottom:4px;cursor:pointer"
     onclick="window.appState={...(window.appState||{}),instanceId:'${_esc(id)}'}; window.location.hash='#/assessment'">
  <span style="font-size:14px">📋</span>
  <div style="flex:1;min-width:0;font-size:12px;font-weight:600;color:var(--text);
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
    ${_esc(inst.cycle_name || inst.cycleName || '역량 진단')}
  </div>
  ${renderWorkflowBadge(inst.status || 'draft')}
</div>`;
  }).join('')}
  ${pending.slice(0,3).map(a => {
    const label = EVAL_LABELS[a.evaluator_type] || a.evaluator_type || '평가';
    return `
<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;
            background:var(--surface);border-radius:8px;margin-bottom:4px;cursor:pointer"
     onclick="window.appState={...(window.appState||{}),instanceId:'${_esc(a.instance_id)}',evaluatorMode:true,evaluatorType:'${_esc(a.evaluator_type||'peer')}',subjectName:'${_esc(a.subject_name||'')}'}; window.location.hash='#/assessment'">
  <span style="font-size:14px">👥</span>
  <div style="flex:1;min-width:0;font-size:12px;font-weight:600;color:var(--text);
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
    ${_esc(a.subject_name || '대상자')} 님 · ${_esc(label)}
  </div>
  <span style="font-size:10px;padding:2px 6px;background:#EFF6FF;color:#3B82F6;
               border-radius:9999px;font-weight:600;white-space:nowrap">${_esc(label)}</span>
</div>`;
  }).join('')}
</div>`;
}
