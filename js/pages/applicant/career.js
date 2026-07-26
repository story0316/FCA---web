/**
 * career.js – Applicant Career Branding Hub
 * HR Competency OS — Phase 3
 *
 * Passive career management page: competency portfolio, kit badges, survey history.
 * Separate from the active hiring pipeline (applicant_dashboard.js).
 */

import { getUser }   from '../../auth.js';
import { showToast } from '../../components/toast.js';

// ── Module state ─────────────────────────────────────────────────
let _root      = null;
let _editing   = false;

// ── localStorage keys ────────────────────────────────────────────
const LS_CAREER_SUMMARY   = 'hr_career_summary';
const LS_COMP_SESSIONS    = 'hr_comp_sessions';
const LS_DIAG_RESULTS     = 'hr_diag_results';
const LS_SURVEY_RESPONSES = 'hr_survey_responses';
const LS_USER             = 'hr_user';

// ── Kit labels ───────────────────────────────────────────────────
const KIT_LABELS = {
  KIT_MBTI:      'MBTI',
  KIT_DISC:      'DISC',
  KIT_BIRKMAN:   '버크만 스타일',
  KIT_HOLLAND:   'Holland RIASEC',
  KIT_INTERVIEW: 'AI 인터뷰',
};

// ── Comp axis labels for display ─────────────────────────────────
const COMP_DISPLAY = {
  COMM:     '커뮤니케이션',
  OD:       '조직 개발',
  TA:       '인재 확보',
  DATA:     '데이터 분석',
  PROB:     '문제 해결',
  LEAD:     '리더십',
  AI:       'AI 활용',
  FUTURE_AI:'AI 역량',
};

// ── Demo defaults ─────────────────────────────────────────────────
const DEMO_SUMMARY = {
  targetJob: 'HR Business Partner',
  headline:  '사람과 조직을 연결하는 HR 전문가를 꿈꿉니다',
  updatedAt: '2025-05-01',
};

const DEMO_COMP = [
  { name: '커뮤니케이션', score: 4.0 },
  { name: '조직 개발',    score: 3.7 },
  { name: '인재 확보',    score: 3.5 },
  { name: '데이터 분석',  score: 3.2 },
  { name: '문제 해결',    score: 3.8 },
];

// ── Helpers ───────────────────────────────────────────────────────
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getUserName() {
  try {
    const u = JSON.parse(localStorage.getItem(LS_USER) || '{}');
    return u.name_ko || u.name || u.email?.split('@')[0] || '지원자';
  } catch {
    return getUser()?.name_ko || getUser()?.email?.split('@')[0] || '지원자';
  }
}

function getSummary() {
  try {
    const raw = localStorage.getItem(LS_CAREER_SUMMARY);
    return raw ? { ...DEMO_SUMMARY, ...JSON.parse(raw) } : { ...DEMO_SUMMARY };
  } catch {
    return { ...DEMO_SUMMARY };
  }
}

function getAptitudeResult() {
  try {
    const user = getUser();
    const uid  = user?.id || user?.user_id || 'anonymous';
    const r = JSON.parse(localStorage.getItem(`hr_apt_result_${uid}`) || localStorage.getItem('hr_apt_result') || 'null');
    return r;
  } catch { return null; }
}

function saveSummary(data) {
  try {
    localStorage.setItem(LS_CAREER_SUMMARY, JSON.stringify({ ...data, updatedAt: new Date().toISOString().slice(0, 10) }));
  } catch { /* quota */ }
}

function getCompData() {
  try {
    const sessions = JSON.parse(localStorage.getItem(LS_COMP_SESSIONS) || '[]');
    if (Array.isArray(sessions) && sessions.length > 0) {
      const latest = sessions.slice(-1)[0];
      if (Array.isArray(latest.scores) && latest.scores.length > 0) {
        return latest.scores.map(s => ({
          name:  s.name_ko || s.label || s.name || '역량',
          score: Number(s.as_is_score || s.score || 3.0),
        }));
      }
    }
  } catch {}
  return null;
}

function hasHRCompSession() {
  try {
    const sessions = JSON.parse(localStorage.getItem(LS_COMP_SESSIONS) || '[]');
    return Array.isArray(sessions) && sessions.length > 0;
  } catch { return false; }
}

function getKitBadges() {
  try {
    const raw = localStorage.getItem(LS_DIAG_RESULTS);
    if (!raw) return [];
    const results = JSON.parse(raw);
    return Object.entries(results).map(([kitId, result]) => ({
      kitId,
      label: KIT_LABELS[kitId] || kitId.replace('KIT_', ''),
      typeCode: result?.typeCode || null,
      savedAt:  result?.savedAt || null,
    }));
  } catch { return []; }
}

function getSurveys() {
  try {
    const raw = localStorage.getItem(LS_SURVEY_RESPONSES);
    if (!raw) return [];
    const resp = JSON.parse(raw);
    if (typeof resp !== 'object') return [];
    return Object.entries(resp)
      .filter(([, v]) => v?.submittedAt)
      .map(([id, v]) => ({
        id,
        name: v.surveyName || id,
        submittedAt: v.submittedAt,
      }))
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  } catch { return []; }
}

// ── Inline SVG Radar Chart (same pattern as alumni_dashboard.js) ──
function renderRadarSvg(items) {
  const SIZE  = 150;
  const CX    = SIZE / 2;
  const CY    = SIZE / 2;
  const R     = 54;
  const MAX   = 5;
  const n     = items.length;
  const color = '#4F46E5';

  const angle = i => (Math.PI * 2 * i / n) - Math.PI / 2;
  const pt    = (i, r) => ({
    x: CX + r * Math.cos(angle(i)),
    y: CY + r * Math.sin(angle(i)),
  });

  const gridRings = [1, 2, 3, 4, 5].map(lvl => {
    const r   = (lvl / MAX) * R;
    const pts = Array.from({ length: n }, (_, i) => pt(i, r));
    return `<polygon points="${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}"
              fill="none" stroke="#E2E8F0" stroke-width="${lvl === 5 ? 1.5 : 1}"/>`;
  }).join('');

  const axes = Array.from({ length: n }, (_, i) => {
    const outer = pt(i, R);
    return `<line x1="${CX}" y1="${CY}" x2="${outer.x.toFixed(1)}" y2="${outer.y.toFixed(1)}" stroke="#E2E8F0" stroke-width="1"/>`;
  }).join('');

  const dataPts = items.map((item, i) => pt(i, (Math.min(item.score, MAX) / MAX) * R));
  const polygon = `<polygon points="${dataPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}"
    fill="${color}22" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
  const dots = dataPts.map(p =>
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${color}"/>`
  ).join('');

  const labels = items.map((item, i) => {
    const outer  = pt(i, R + 17);
    const anchor = outer.x < CX - 5 ? 'end' : outer.x > CX + 5 ? 'start' : 'middle';
    const short  = item.name.length > 5 ? item.name.slice(0, 5) : item.name;
    return `<text x="${outer.x.toFixed(1)}" y="${(outer.y + 4).toFixed(1)}"
      text-anchor="${anchor}" font-size="9" fill="#64748B" font-family="'Noto Sans KR',sans-serif">
      ${short}
    </text>`;
  }).join('');

  const legend = items.map(item => {
    const pct      = Math.round((item.score / MAX) * 100);
    const barColor = item.score >= 4.0 ? '#4F46E5' : item.score >= 3.5 ? '#0EA5E9' : '#94A3B8';
    return `
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:11px;color:#1E293B;width:60px;flex-shrink:0;overflow:hidden;
                     text-overflow:ellipsis;white-space:nowrap;">${esc(item.name)}</span>
        <div style="flex:1;height:5px;background:#E2E8F0;border-radius:3px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${barColor};border-radius:3px;"></div>
        </div>
        <span style="font-size:11px;font-weight:700;color:${barColor};width:24px;text-align:right;">${item.score.toFixed(1)}</span>
      </div>`;
  }).join('');

  return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:4px 0;">
      <svg viewBox="0 0 ${SIZE} ${SIZE}" style="width:150px;height:150px;overflow:visible;" aria-hidden="true">
        ${gridRings}${axes}${polygon}${dots}${labels}
      </svg>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;width:100%;max-width:280px;">
        ${legend}
      </div>
    </div>`;
}

// ── Render ────────────────────────────────────────────────────────
function render(container) {
  const name        = getUserName();
  const summary     = getSummary();
  const compData    = getCompData();
  const hasHRComp   = hasHRCompSession();
  const kitBadges   = getKitBadges();
  const surveys = getSurveys();

  // Radar or placeholder
  const radarSection = compData
    ? `
      <div style="margin-top:4px;">
        ${renderRadarSvg(compData)}
      </div>`
    : `
      <div style="padding:20px;text-align:center;background:#F8FAFC;border-radius:8px;border:1.5px dashed #CBD5E1;">
        <p style="margin:0 0 8px;font-size:13px;color:#64748B;">아직 HR 역량 진단을 받지 않았습니다.</p>
        <button id="goto-hr-comp" style="padding:8px 16px;background:#4F46E5;color:#fff;border:none;
                border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">
          HR 역량 진단 시작하기 →
        </button>
      </div>`;

  // HR comp badge
  const hrBadge = hasHRComp
    ? `<div style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;
                   background:linear-gradient(135deg,#4F46E5,#7C3AED);color:#fff;
                   border-radius:20px;font-size:12px;font-weight:700;margin-top:10px;">
         🏆 HR 역량 인증 완료
       </div>` : '';

  // Kit badges grid
  const kitBadgesHtml = kitBadges.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${kitBadges.map(k => `
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px;
                      padding:10px 14px;background:#EEF2FF;border-radius:10px;
                      border:1.5px solid #C7D2FE;min-width:72px;text-align:center;">
            <span style="font-size:20px;">🧠</span>
            <span style="font-size:12px;font-weight:700;color:#4F46E5;">${esc(k.label)}</span>
            ${k.typeCode ? `<span style="font-size:10px;color:#6366F1;font-weight:600;">${esc(k.typeCode)}</span>` : ''}
          </div>`).join('')}
      </div>`
    : `<div style="padding:16px;text-align:center;background:#F8FAFC;border-radius:8px;
                   border:1.5px dashed #CBD5E1;font-size:13px;color:#64748B;">
         진단을 추가하면 HR 담당자에게 더 잘 보입니다.
       </div>`;

  // Kit suggestion (show kits not yet done)
  const doneKits = new Set(kitBadges.map(k => k.kitId));
  const ALL_KITS = ['KIT_MBTI', 'KIT_DISC', 'KIT_BIRKMAN', 'KIT_HOLLAND', 'KIT_INTERVIEW'];
  const suggestKits = ALL_KITS.filter(k => !doneKits.has(k)).slice(0, 3);
  const suggestHtml = suggestKits.length
    ? `<div style="margin-top:10px;padding:12px;background:#FFFBEB;border-radius:8px;border:1px solid #FDE68A;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#D97706;">
          💡 이런 진단을 추가해보세요
        </p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${suggestKits.map(k =>
            `<button class="goto-kit" data-kit="${esc(k)}"
               style="padding:5px 12px;background:#fff;color:#D97706;border:1px solid #FDE68A;
                      border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;">
               ${esc(KIT_LABELS[k] || k.replace('KIT_', ''))} 진단 →
             </button>`
          ).join('')}
        </div>
      </div>` : '';

  // Survey section
  const surveyHtml = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${surveys.length ? '10px' : '0'};">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:18px;">🗳️</span>
        <span style="font-size:14px;font-weight:600;color:var(--text,#1E293B);">
          ${surveys.length ? `${surveys.length}개 참여` : '참여 이력 없음'}
        </span>
      </div>
      <button id="goto-survey"
        style="padding:7px 14px;background:#EEF2FF;color:#4F46E5;border:none;border-radius:8px;
               font-size:12px;font-weight:600;cursor:pointer;">
        서베이 참여 →
      </button>
    </div>
    ${surveys.slice(0, 3).map(s => `
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:8px 10px;background:#F8FAFC;border-radius:8px;margin-bottom:6px;
                  border:1px solid #E2E8F0;">
        <div style="min-width:0">
          <div style="font-size:12px;font-weight:600;color:#1E293B;
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(s.name)}</div>
          <div style="font-size:11px;color:#94A3B8;margin-top:1px;">
            ${s.submittedAt ? new Date(s.submittedAt).toLocaleDateString('ko-KR', {month:'short',day:'numeric'}) : ''}
          </div>
        </div>
        <span style="font-size:11px;padding:2px 8px;background:#DCFCE7;color:#16A34A;
                     border-radius:99px;font-weight:600;white-space:nowrap;flex-shrink:0;margin-left:8px;">완료</span>
      </div>`).join('')}`;

  // Summary edit form or display
  const summaryContent = _editing
    ? `
      <div id="summary-edit" style="display:flex;flex-direction:column;gap:10px;">
        <div>
          <label style="font-size:12px;color:#64748B;font-weight:500;">희망 직무</label>
          <input id="edit-target-job" type="text" value="${esc(summary.targetJob)}"
            style="width:100%;margin-top:4px;padding:8px 12px;border:1.5px solid #CBD5E1;
                   border-radius:8px;font-size:14px;box-sizing:border-box;"/>
        </div>
        <div>
          <label style="font-size:12px;color:#64748B;font-weight:500;">한 줄 소개</label>
          <textarea id="edit-headline" rows="2"
            style="width:100%;margin-top:4px;padding:8px 12px;border:1.5px solid #CBD5E1;
                   border-radius:8px;font-size:13px;resize:none;box-sizing:border-box;
                   line-height:1.5;">${esc(summary.headline)}</textarea>
        </div>
        <div style="display:flex;gap:8px;">
          <button id="save-summary"
            style="flex:1;padding:10px;background:#4F46E5;color:#fff;border:none;border-radius:8px;
                   font-size:14px;font-weight:600;cursor:pointer;">저장</button>
          <button id="cancel-edit"
            style="padding:10px 16px;background:#F1F5F9;color:#64748B;border:none;border-radius:8px;
                   font-size:14px;font-weight:600;cursor:pointer;">취소</button>
        </div>
      </div>`
    : `
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="font-size:18px;">🎯</span>
          <span style="font-size:14px;font-weight:600;color:var(--text,#1E293B);">
            ${esc(summary.targetJob)}
          </span>
        </div>
        <p style="margin:0;font-size:13px;color:var(--text-muted,#64748B);line-height:1.6;">
          ${esc(summary.headline)}
        </p>
        <p style="margin:8px 0 0;font-size:11px;color:#94A3B8;">
          마지막 업데이트: ${esc(summary.updatedAt)}
        </p>
      </div>`;

  container.innerHTML = `
    <div id="career-page" style="min-height:100vh;background:var(--bg,#F8FAFC);padding:0 0 80px;">

      <!-- 헤더 -->
      <div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:48px 20px 24px;color:#fff;">
        <p style="margin:0 0 4px;font-size:13px;opacity:0.8;">${esc(name)}님의</p>
        <h1 style="margin:0;font-size:22px;font-weight:700;">💼 커리어 프로필</h1>
        <p style="margin:8px 0 0;font-size:12px;opacity:0.75;">
          역량 포트폴리오를 공개하면 HR 담당자가 먼저 오퍼를 보낼 수 있습니다
        </p>
      </div>

      <div style="padding:16px;display:flex;flex-direction:column;gap:14px;">

        <!-- 1. 커리어 요약 카드 -->
        <div style="background:#fff;border-radius:10px;padding:18px 16px;
                    border:1px solid var(--border,#E2E8F0);box-shadow:0 1px 4px rgba(0,0,0,0.06);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h2 style="margin:0;font-size:14px;font-weight:700;color:var(--text,#1E293B);">
              나의 커리어 요약
            </h2>
            ${!_editing ? `<button id="edit-summary"
              style="padding:5px 12px;background:#F1F5F9;color:#64748B;border:none;border-radius:6px;
                     font-size:12px;font-weight:600;cursor:pointer;">✏️ 편집</button>` : ''}
          </div>
          ${summaryContent}
        </div>

        <!-- 2. 역량 포트폴리오 -->
        <div style="background:#fff;border-radius:10px;padding:18px 16px;
                    border:1px solid var(--border,#E2E8F0);box-shadow:0 1px 4px rgba(0,0,0,0.06);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h2 style="margin:0;font-size:14px;font-weight:700;color:var(--text,#1E293B);">
              📊 역량 포트폴리오
            </h2>
            <button id="goto-hr-comp-nav"
              style="padding:5px 12px;background:#EEF2FF;color:#4F46E5;border:none;border-radius:6px;
                     font-size:12px;font-weight:600;cursor:pointer;">
              역량 진단 추가 →
            </button>
          </div>
          ${radarSection}
          ${hrBadge}
          ${!hasHRComp ? '' : `
            <p style="margin:10px 0 0;font-size:11px;color:#94A3B8;">
              ※ 진단 결과 공개 여부는 <a href="#/applicant/profile" style="color:#6366F1">내프로필</a>에서 설정할 수 있습니다
            </p>`}
        </div>

        <!-- 3. 인적성 검사 진입/결과 카드 -->
        ${(function() {
          const apt = getAptitudeResult();
          const GRADE_COLOR = {S:'#4F46E5',A:'#0891B2',B:'#059669',C:'#D97706',D:'#94A3B8'};
          const GRADE_DESC  = {S:'상위 10%',A:'상위 25%',B:'상위 50%',C:'하위 50%',D:'하위 25%'};
          if (apt?.scores) {
            const g = apt.scores.grade || 'B';
            const gc = GRADE_COLOR[g] || '#94A3B8';
            const gd = GRADE_DESC[g] || '';
            const comp = apt.scores.composite;
            const gma  = apt.scores.gmaT;
            const domains = apt.scores.domains || {};
            const dateStr = apt.date ? new Date(apt.date).toLocaleDateString('ko-KR',{month:'short',day:'numeric'}) : '';
            return `
              <div id="goto-aptitude" style="background:linear-gradient(135deg,#1E293B 0%,#334155 100%);border-radius:12px;padding:16px 18px;cursor:pointer;box-shadow:0 2px 8px rgba(30,41,59,0.18);">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                  <div style="background:${gc};width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <span style="font-size:22px;font-weight:900;color:#fff;">${g}</span>
                  </div>
                  <div style="flex:1;min-width:0;">
                    <div style="font-size:14px;font-weight:700;color:#fff;">인적성 검사 완료</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.65);margin-top:2px;">${gd} · 종합 T${comp} ${dateStr ? '· ' + dateStr : ''}</div>
                  </div>
                  <span style="font-size:11px;color:rgba(255,255,255,0.5);">재검사 →</span>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  ${[
                    ['GMA', 'T' + (gma ?? '-'), '#A5B4FC'],
                    ['상황판단', 'T' + (domains.sjt?.tScore ?? '-'), '#6EE7B7'],
                    ['성실성', 'T' + (domains.big5?.tScore ?? '-'), '#FDE68A'],
                    ['NCS', 'T' + (domains.ncs?.tScore ?? '-'), '#FCA5A5'],
                  ].map(([l, v, c]) => `
                    <div style="background:rgba(255,255,255,0.1);border-radius:8px;padding:6px 10px;text-align:center;flex:1;min-width:54px;">
                      <div style="font-size:13px;font-weight:700;color:${c};">${v}</div>
                      <div style="font-size:10px;color:rgba(255,255,255,0.55);margin-top:1px;">${l}</div>
                    </div>`).join('')}
                </div>
              </div>`;
          }
          return `
            <div id="goto-aptitude" style="background:linear-gradient(135deg,#1E293B 0%,#334155 100%);border-radius:12px;padding:16px 18px;cursor:pointer;box-shadow:0 2px 8px rgba(30,41,59,0.18);">
              <div style="display:flex;align-items:center;gap:12px;">
                <span style="font-size:2rem;flex-shrink:0;">🎯</span>
                <div style="flex:1;min-width:0;">
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px;">
                    <span style="font-size:14px;font-weight:700;color:#fff;">인적성 검사</span>
                    <span style="font-size:10px;font-weight:700;color:#1E293B;background:#A5B4FC;padding:2px 8px;border-radius:20px;">과학적 채용 도구</span>
                  </div>
                  <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.7);line-height:1.4;">
                    인지능력 · 상황판단 · 성실성 · 직무기초 — 직무 성과를 예측하는 4영역 검사
                  </p>
                </div>
                <span style="font-size:18px;color:rgba(255,255,255,0.5);flex-shrink:0;">→</span>
              </div>
              <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
                ${[['r=0.51','인지능력 예측력'],['45분','검사 시간'],['4영역','측정 구조'],['근거 있음','논문 기반']].map(([v,l]) => `
                  <div style="background:rgba(255,255,255,0.1);border-radius:8px;padding:6px 10px;text-align:center;flex:1;min-width:54px;">
                    <div style="font-size:13px;font-weight:700;color:#A5B4FC;">${v}</div>
                    <div style="font-size:10px;color:rgba(255,255,255,0.6);margin-top:1px;">${l}</div>
                  </div>`).join('')}
              </div>
            </div>`;
        })()}

        <!-- 4. 진단 Kit 뱃지 -->
        <div style="background:#fff;border-radius:10px;padding:18px 16px;
                    border:1px solid var(--border,#E2E8F0);box-shadow:0 1px 4px rgba(0,0,0,0.06);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h2 style="margin:0;font-size:14px;font-weight:700;color:var(--text,#1E293B);">
              🧠 진단 Kit
            </h2>
            <button id="goto-diag"
              style="padding:5px 12px;background:#EEF2FF;color:#4F46E5;border:none;border-radius:6px;
                     font-size:12px;font-weight:600;cursor:pointer;">
              진단 추가 →
            </button>
          </div>
          ${kitBadgesHtml}
          ${suggestHtml}
        </div>

        <!-- 4. 서베이 이력 -->
        <div style="background:#fff;border-radius:10px;padding:18px 16px;
                    border:1px solid var(--border,#E2E8F0);box-shadow:0 1px 4px rgba(0,0,0,0.06);">
          <h2 style="margin:0 0 12px;font-size:14px;font-weight:700;color:var(--text,#1E293B);">
            🗳️ 서베이 참여
          </h2>
          ${surveyHtml}
          <p style="margin:8px 0 0;font-size:11px;color:#94A3B8;">
            서베이 참여 이력도 커리어 지표로 활용됩니다
          </p>
        </div>

        <!-- Quick links row -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div style="background:#EEF2FF;border-radius:10px;padding:14px 16px;
                      border:1px solid #C7D2FE;cursor:pointer;" id="goto-profile">
            <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#4F46E5;">👤 내프로필</p>
            <p style="margin:0;font-size:11px;color:#6366F1;line-height:1.4;">
              공개 범위 설정<br>받은 오퍼 확인
            </p>
          </div>
          <div style="background:#F0FDF4;border-radius:10px;padding:14px 16px;
                      border:1px solid #BBF7D0;cursor:pointer;" id="goto-reference">
            <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#059669;">📝 레퍼런스</p>
            <p style="margin:0;font-size:11px;color:#10B981;line-height:1.4;">
              추천인 관리<br>평판 조회 상태
            </p>
          </div>
        </div>

      </div>
    </div>`;

  bindEvents(container, summary);
}

// ── Event binding ─────────────────────────────────────────────────
function bindEvents(container, summary) {
  // Summary edit/save/cancel
  container.querySelector('#edit-summary')?.addEventListener('click', () => {
    _editing = true;
    render(container);
  });

  container.querySelector('#save-summary')?.addEventListener('click', () => {
    const targetJob = container.querySelector('#edit-target-job')?.value?.trim();
    const headline  = container.querySelector('#edit-headline')?.value?.trim();
    if (!targetJob || !headline) {
      showToast('모든 항목을 입력해주세요', 'warning');
      return;
    }
    saveSummary({ ...summary, targetJob, headline });
    _editing = false;
    render(container);
    showToast('커리어 요약이 저장되었습니다', 'success');
  });

  container.querySelector('#cancel-edit')?.addEventListener('click', () => {
    _editing = false;
    render(container);
  });

  // Navigate to HR Competency
  container.querySelector('#goto-hr-comp')?.addEventListener('click', () => {
    window.location.hash = '#/hr-competency';
  });
  container.querySelector('#goto-hr-comp-nav')?.addEventListener('click', () => {
    window.location.hash = '#/hr-competency';
  });

  // Navigate to Aptitude test
  container.querySelector('#goto-aptitude')?.addEventListener('click', () => {
    window.location.hash = '#/aptitude';
  });

  // Navigate to Diagnostics (kit)
  container.querySelector('#goto-diag')?.addEventListener('click', () => {
    window.location.hash = '#/diagnostics';
  });

  // Kit suggestion buttons
  container.querySelectorAll('.goto-kit').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.hash = '#/diagnostics';
    });
  });

  // Navigate to Survey
  container.querySelector('#goto-survey')?.addEventListener('click', () => {
    window.location.hash = '#/survey';
  });

  // Navigate to Profile Settings
  container.querySelector('#goto-profile')?.addEventListener('click', () => {
    window.location.hash = '#/applicant/profile';
  });

  // Navigate to Reference Check
  container.querySelector('#goto-reference')?.addEventListener('click', () => {
    window.location.hash = '#/applicant/reference';
  });
}

// ── Public API ────────────────────────────────────────────────────
export async function mount(container) {
  _root    = container;
  _editing = false;
  render(container);
}

export function unmount() {
  _root    = null;
  _editing = false;
}
