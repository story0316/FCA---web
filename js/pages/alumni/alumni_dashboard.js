/**
 * alumni_dashboard.js – Alumni Home Dashboard
 * HR Competency OS — Phase 3
 */

import { showToast } from '../../components/toast.js';

// ── Module state ─────────────────────────────────────────────────
let _root = null;

// ── Constants ────────────────────────────────────────────────────
const LS_ALUMNI_PROFILE = 'hr_alumni_profile';
const LS_DIAG_RESULTS   = 'hr_diag_results';
const LS_COMP_SESSIONS  = 'hr_comp_sessions';

// ── Demo data ────────────────────────────────────────────────────
const DEMO_ALUMNI_PROFILE = {
  name_ko:        '박동문',
  exitDate:       '2024-03-31',
  finalPosition:  'HR 매니저',
  tenureMonths:   38,
  lastLevelBadge: 'L3',
  finalCompScore: 4.2,
  boomerangStatus: 'INACTIVE',
};

const DEMO_COMP = [
  { name: '커뮤니케이션', score: 4.2 },
  { name: '문제 해결',    score: 3.8 },
  { name: '조직 개발',    score: 4.5 },
  { name: '인재 확보',    score: 3.6 },
  { name: 'AI 활용',      score: 3.2 },
];

const COMPANY_NEWS = [
  { icon: '🎉', title: '테크스타트업 Series B 투자 완료',   date: '2026-05-10', tag: '투자' },
  { icon: '📣', title: 'HR 직군 경력직 채용 공고 오픈',     date: '2026-05-15', tag: '채용', cta: true },
  { icon: '🏆', title: '2026 올해의 성과 시상식 개최',      date: '2026-05-20', tag: '소식' },
];

// ── Helpers ──────────────────────────────────────────────────────
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getAlumniProfile() {
  try {
    const raw = localStorage.getItem(LS_ALUMNI_PROFILE);
    return raw ? { ...DEMO_ALUMNI_PROFILE, ...JSON.parse(raw) } : { ...DEMO_ALUMNI_PROFILE };
  } catch {
    return { ...DEMO_ALUMNI_PROFILE };
  }
}

function formatTenure(exitDate, tenureMonths) {
  try {
    const exit = new Date(exitDate);
    const startMs = exit - tenureMonths * 30 * 24 * 60 * 60 * 1000;
    const start = new Date(startMs);
    const fmt = (d) =>
      `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `${tenureMonths}개월 (${fmt(start)} ~ ${fmt(exit)})`;
  } catch {
    return `${tenureMonths}개월`;
  }
}

function scoreBar(score) {
  const pct = Math.round((score / 5) * 100);
  const color = score >= 4.0 ? '#4F46E5' : score >= 3.5 ? '#0EA5E9' : '#94A3B8';
  return `
    <div style="flex:1;height:8px;background:#E2E8F0;border-radius:4px;overflow:hidden;">
      <div style="width:${pct}%;height:100%;background:${color};border-radius:4px;transition:width 0.4s;"></div>
    </div>`;
}

// ── Competency data from localStorage (falls back to DEMO_COMP) ──
function getCompData() {
  // Try assessment scores from comp_sessions
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
  return DEMO_COMP;
}

// ── Inline SVG Radar Chart ────────────────────────────────────────
function renderRadarSvg(items) {
  const SIZE   = 160;
  const CX     = SIZE / 2;
  const CY     = SIZE / 2;
  const R      = 60;
  const MAX    = 5;
  const n      = items.length;
  const color  = '#4F46E5';

  const angle  = i => (Math.PI * 2 * i / n) - Math.PI / 2;
  const pt     = (i, r) => ({
    x: CX + r * Math.cos(angle(i)),
    y: CY + r * Math.sin(angle(i)),
  });

  // Grid rings (5 levels)
  const gridRings = [1,2,3,4,5].map(lvl => {
    const r = (lvl / MAX) * R;
    const pts = Array.from({ length: n }, (_, i) => pt(i, r));
    return `<polygon points="${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}"
              fill="none" stroke="#E2E8F0" stroke-width="${lvl === 5 ? 1.5 : 1}"/>`;
  }).join('');

  // Axis lines
  const axes = Array.from({ length: n }, (_, i) => {
    const outer = pt(i, R);
    return `<line x1="${CX}" y1="${CY}" x2="${outer.x.toFixed(1)}" y2="${outer.y.toFixed(1)}" stroke="#E2E8F0" stroke-width="1"/>`;
  }).join('');

  // Data polygon
  const dataPts = items.map((item, i) => pt(i, (Math.min(item.score, MAX) / MAX) * R));
  const polygon = `<polygon points="${dataPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}"
    fill="${color}22" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;

  // Dots
  const dots = dataPts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${color}"/>`).join('');

  // Labels
  const labelOffset = 18;
  const labels = items.map((item, i) => {
    const outer = pt(i, R + labelOffset);
    const anchor = outer.x < CX - 5 ? 'end' : outer.x > CX + 5 ? 'start' : 'middle';
    const shortName = item.name.length > 5 ? item.name.slice(0, 5) : item.name;
    return `<text x="${outer.x.toFixed(1)}" y="${(outer.y + 4).toFixed(1)}"
      text-anchor="${anchor}" font-size="9" fill="#64748B" font-family="'Noto Sans KR',sans-serif">
      ${shortName}
    </text>`;
  }).join('');

  return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:8px 0">
      <svg viewBox="0 0 ${SIZE} ${SIZE}" style="width:160px;height:160px;overflow:visible" aria-hidden="true">
        ${gridRings}${axes}${polygon}${dots}${labels}
      </svg>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;width:100%;max-width:260px">
        ${items.map(item => {
          const pct = Math.round((item.score / MAX) * 100);
          const barColor = item.score >= 4.0 ? '#4F46E5' : item.score >= 3.5 ? '#0EA5E9' : '#94A3B8';
          return `
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:11px;color:#1E293B;width:56px;flex-shrink:0;overflow:hidden;
                           text-overflow:ellipsis;white-space:nowrap">${esc(item.name)}</span>
              <div style="flex:1;height:5px;background:#E2E8F0;border-radius:3px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:${barColor};border-radius:3px"></div>
              </div>
              <span style="font-size:11px;font-weight:700;color:${barColor};width:22px;text-align:right">${item.score.toFixed(1)}</span>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ── Render ───────────────────────────────────────────────────────
function render(container, profile) {
  const tenureStr  = formatTenure(profile.exitDate, profile.tenureMonths);
  const compItems  = getCompData();
  const radarHtml  = renderRadarSvg(compItems);

  const newsHtml = COMPANY_NEWS.map((n, i) => `
    <div style="background:#fff;border-radius:8px;padding:14px 16px;border:1px solid var(--border,#E2E8F0);
                box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <span style="font-size:22px;line-height:1;flex-shrink:0;">${esc(n.icon)}</span>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <span style="font-size:10px;padding:2px 8px;border-radius:20px;font-weight:600;
                         background:${n.cta ? '#EEF2FF' : '#F1F5F9'};
                         color:${n.cta ? '#4F46E5' : '#64748B'};">${esc(n.tag)}</span>
            <span style="font-size:11px;color:var(--text-muted,#64748B);">${esc(n.date)}</span>
          </div>
          <p style="margin:0;font-size:13px;font-weight:600;color:var(--text,#1E293B);line-height:1.4;">${esc(n.title)}</p>
          ${n.cta ? `<button data-news-cta="${i}" style="margin-top:8px;padding:5px 12px;background:#4F46E5;color:#fff;
                       border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">
                       채용공고 보기
                     </button>` : ''}
        </div>
      </div>
    </div>`).join('');

  container.innerHTML = `
    <div id="alumni-dashboard" style="min-height:100vh;background:var(--bg,#F8FAFC);padding:0 0 80px;">

      <!-- 웰컴 배너 -->
      <div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:48px 20px 28px;color:#fff;">
        <p style="margin:0 0 4px;font-size:14px;opacity:0.85;">동문 포털에 오신 것을 환영합니다</p>
        <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;">
          안녕하세요, ${esc(profile.name_ko)}님 👋
        </h1>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;">
          <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.18);
                      padding:6px 12px;border-radius:20px;font-size:13px;">
            <span>🗓️</span>
            <span>재직 기간: ${esc(tenureStr)}</span>
          </div>
          <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,215,0,0.22);
                      padding:6px 12px;border-radius:20px;font-size:13px;font-weight:700;color:#FDE68A;">
            <span>🏅</span>
            <span>${esc(profile.lastLevelBadge)} 달성</span>
          </div>
        </div>
      </div>

      <div style="padding:20px 16px;display:flex;flex-direction:column;gap:16px;">

        <!-- 나의 이력 요약 -->
        <div style="background:#fff;border-radius:10px;padding:20px 16px;
                    box-shadow:0 1px 4px rgba(0,0,0,0.08);border:1px solid var(--border,#E2E8F0);">
          <h2 style="margin:0 0 4px;font-size:15px;font-weight:700;color:var(--text,#1E293B);">나의 이력 요약</h2>
          <p style="margin:0 0 14px;font-size:12px;color:var(--text-muted,#64748B);">최종 직책: ${esc(profile.finalPosition)}</p>

          <!-- 역량 레이더 차트 -->
          <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:var(--text,#1E293B);">재직 중 역량 수준</p>
          ${radarHtml}

          <!-- 진단 Kits -->
          <p style="margin:14px 0 8px;font-size:13px;font-weight:600;color:var(--text,#1E293B);">완료한 진단 Kit</p>
          <div style="display:flex;flex-wrap:wrap;gap:6px;" id="alumni-kits-chips">
            ${(function() {
              try {
                const d = JSON.parse(localStorage.getItem(LS_DIAG_RESULTS) || '{}');
                const keys = Object.keys(d);
                if (keys.length > 0) return keys.map(k => {
                  const label = k.replace('KIT_', '');
                  return `<span style="padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;
                               background:#D1FAE5;color:#059669;">✔ ${esc(label)}</span>`;
                }).join('');
              } catch {}
              return ['MBTI', 'DISC', '에니어그램'].map(k => `
                <span style="padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;
                             background:#D1FAE5;color:#059669;">✔ ${esc(k)}</span>`).join('');
            })()}
          </div>

          <!-- 설문 요약 -->
          <div style="margin-top:12px;padding:10px 14px;background:#F8FAFC;border-radius:8px;
                      border:1px solid var(--border,#E2E8F0);display:flex;align-items:center;gap:8px;">
            <span style="font-size:16px;">📋</span>
            <span style="font-size:13px;color:var(--text,#1E293B);">설문 완료: <strong>${(function() {
              try { return Object.keys(JSON.parse(localStorage.getItem('hr_survey_responses') || '{}')).length; } catch { return 3; }
            })()} 단계 완료</strong></span>
          </div>
        </div>

        <!-- 회사 소식 -->
        <div>
          <h2 style="margin:0 0 12px;font-size:15px;font-weight:700;color:var(--text,#1E293B);">
            📰 회사 소식
          </h2>
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${newsHtml}
          </div>
        </div>

        <!-- 재입사 CTA -->
        <div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);border-radius:12px;
                    padding:24px 20px;color:#fff;">
          <p style="margin:0 0 4px;font-size:22px;line-height:1;">💼</p>
          <h3 style="margin:4px 0 6px;font-size:17px;font-weight:700;">재입사를 원하시나요?</h3>
          <p style="margin:0 0 16px;font-size:13px;opacity:0.85;">HR팀에서 언제든지 환영합니다</p>
          <button id="boomerang-cta"
                  style="width:100%;padding:13px;background:#fff;color:#4F46E5;border:none;
                         border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;
                         box-shadow:0 2px 8px rgba(0,0,0,0.15);transition:opacity 0.15s;">
            재입사 협의하기 →
          </button>
        </div>

      </div>
    </div>
  `;

  // Bind: news CTA buttons
  container.querySelectorAll('[data-news-cta]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.hash = '#/jobs';
    });
  });

  // Bind: boomerang CTA
  const boomerangBtn = container.querySelector('#boomerang-cta');
  if (boomerangBtn) {
    boomerangBtn.addEventListener('click', () => window.location.hash = '#/alumni/boomerang');
    boomerangBtn.addEventListener('mouseenter', () => { boomerangBtn.style.opacity = '0.88'; });
    boomerangBtn.addEventListener('mouseleave', () => { boomerangBtn.style.opacity = '1'; });
  }
}

// ── Public API ───────────────────────────────────────────────────
export async function mount(container, appState) {
  _root = container;
  const profile = getAlumniProfile();
  render(container, profile);
}

export function unmount() {
  _root = null;
}
