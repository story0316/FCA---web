/**
 * aptitude.js – 인적성 검사 소개 & 입장 페이지
 * HR Competency OS
 *
 * 검사 Why / 4영역 구조 / 연구 근거 / 시작 CTA
 * 상세 설명은 아코디언으로 접어두고 클릭 시 펼침
 */

import { navigate } from '../../app.js';

// ── State ─────────────────────────────────────────────────────────
let _root = null;

// ── Data ─────────────────────────────────────────────────────────
const DOMAINS = [
  {
    id: 'gma',
    icon: '🧮',
    name: '인지능력',
    weight: 40,
    tagline: '가장 강력한 직무 성과 예측 지표',
    color: '#4F46E5',
    bg: '#EEF2FF',
    border: '#C7D2FE',
    sub: [
      { label: '언어추론', q: 15, min: 12, desc: '독해·논리·어휘 유추 — 복잡한 정보를 정확히 이해하고 전달하는 능력' },
      { label: '수리추론', q: 15, min: 15, desc: '자료해석·응용계산 — 숫자 기반 의사결정과 비즈니스 분석 능력' },
      { label: '추리능력', q: 15, min: 10, desc: '패턴·귀납·연역 — 제한된 정보로 빠르게 결론을 도출하는 능력' },
    ],
    research: {
      validity: 0.51,
      source: 'Schmidt & Hunter (1998)',
      note: '85년·85만 명 메타분석. General Mental Ability(g-factor)는 직무 복잡도가 높을수록 예측력이 더 높아집니다.',
      ref: 'Psychological Bulletin, 124(2), 262–274',
    },
  },
  {
    id: 'sjt',
    icon: '🎭',
    name: '상황판단',
    weight: 25,
    tagline: '실무 판단력을 시나리오로 측정',
    color: '#0891B2',
    bg: '#ECFEFF',
    border: '#A5F3FC',
    sub: [
      { label: '직무 상황', q: 8, min: null, desc: '압박·우선순위·갈등 상황에서의 의사결정 — 정답 없는 문제를 어떻게 풀어가는지' },
      { label: '대인관계 상황', q: 6, min: null, desc: '팀워크·리더십·갈등 해결 — 실제 조직에서 발생하는 관계 역학 판단' },
    ],
    research: {
      validity: 0.34,
      source: 'McDaniel et al. (2001)',
      note: 'Forced-choice SJT(최적 행동 선택 방식)는 인지능력 검사와 점증적 타당도(incremental validity)를 가집니다 — 둘을 함께 쓸 때 예측력이 각각보다 높습니다.',
      ref: 'Journal of Applied Psychology, 86(4), 730–740',
    },
  },
  {
    id: 'big5',
    icon: '🎯',
    name: '성실성',
    weight: 20,
    tagline: 'Big Five 중 직무 성과 예측력 1위',
    color: '#059669',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    sub: [
      { label: '자기규율', q: null, min: null, desc: '목표를 세우고 방해 없이 달성하는 능력 — 업무 몰입도의 핵심' },
      { label: '목표지향성', q: null, min: null, desc: '성취 욕구와 경쟁력 — 높은 성과자의 가장 뚜렷한 특징' },
      { label: '신중성', q: null, min: null, desc: '충동 통제와 계획성 — 실수 빈도와 역상관' },
    ],
    research: {
      validity: 0.31,
      source: 'Barrick & Mount (1991)',
      note: 'Big Five 성격요인 중 성실성(Conscientiousness)만이 모든 직군에 걸쳐 일관된 예측력을 보입니다. 사회적 바람직성(social desirability) 탐지 문항을 삽입해 허위 응답을 필터링합니다.',
      ref: 'Personnel Psychology, 44(1), 1–26',
    },
  },
  {
    id: 'ncs',
    icon: '🏗️',
    name: '직무기초역량',
    weight: 15,
    tagline: 'NCS 기반 한국 직업 표준 4개 영역',
    color: '#D97706',
    bg: '#FFFBEB',
    border: '#FDE68A',
    sub: [
      { label: '의사소통능력', q: null, min: null, desc: '문서 이해·작성, 경청, 언어 표현 — NCS 10대 직업기초능력 1번' },
      { label: '문제해결능력', q: null, min: null, desc: '사고력·문제처리능력 — 직무 현장 이슈 해결 역량' },
      { label: '정보능력', q: null, min: null, desc: '컴퓨터·정보 처리 — 디지털 전환 시대 필수 기초' },
      { label: '대인관계능력', q: null, min: null, desc: '팀워크·리더십·갈등관리·협상 — 조직 적응의 기반' },
    ],
    research: {
      validity: null,
      source: '한국산업인력공단 NCS (2015)',
      note: '국가직무능력표준(NCS)은 산업현장에서 직무를 수행하기 위해 요구되는 지식·기술·태도를 표준화한 국가 공인 체계입니다.',
      ref: 'www.ncs.go.kr',
    },
  },
];

const VALIDITY_BARS = [
  { label: '인지능력 (GMA)',     r: 0.51, color: '#4F46E5' },
  { label: '구조화 면접',        r: 0.51, color: '#7C3AED' },
  { label: '작업표본 검사',      r: 0.54, color: '#0891B2' },
  { label: '성실성 (Big Five)',  r: 0.31, color: '#059669' },
  { label: '상황판단 (SJT)',     r: 0.34, color: '#0EA5E9' },
  { label: 'MBTI 등 유형검사',   r: 0.12, color: '#94A3B8' },
];

// ── Helpers ────────────────────────────────────────────────────────
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Render ────────────────────────────────────────────────────────
function render(container) {
  container.innerHTML = `
    <div id="aptitude-page" style="min-height:100vh;background:var(--bg,#F8FAFC);padding:0 0 80px;">

      <!-- 상단 헤더 -->
      <div style="background:linear-gradient(135deg,#1E293B 0%,#334155 100%);padding:48px 20px 28px;color:#fff;position:relative;overflow:hidden;">
        <div style="position:absolute;top:-20px;right:-20px;width:160px;height:160px;background:rgba(255,255,255,0.03);border-radius:50%;pointer-events:none;"></div>
        <button id="apt-back" style="position:absolute;top:48px;left:16px;background:rgba(255,255,255,0.12);border:none;color:#fff;padding:6px 12px;border-radius:8px;font-size:13px;cursor:pointer;">← 뒤로</button>
        <div style="text-align:center;margin-top:12px;">
          <div style="font-size:2.2rem;margin-bottom:8px;">🎯</div>
          <h1 style="margin:0;font-size:20px;font-weight:800;letter-spacing:-0.3px;">인적성 검사</h1>
          <p style="margin:6px 0 0;font-size:13px;opacity:0.75;line-height:1.5;">
            직무 성과를 과학적으로 예측하는<br>4영역 표준화 검사
          </p>
        </div>
      </div>

      <div style="padding:16px;display:flex;flex-direction:column;gap:14px;">

        <!-- WHY 카드 ───────────────────────────────────────── -->
        <div style="background:#fff;border-radius:14px;padding:18px 16px;border:1px solid var(--border,#E2E8F0);box-shadow:0 1px 4px rgba(0,0,0,0.06);">

          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <span style="font-size:18px;">💡</span>
            <h2 style="margin:0;font-size:15px;font-weight:700;color:var(--text,#1E293B);">왜 인적성 검사인가?</h2>
          </div>

          <!-- 3-point 요약 -->
          <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px;">
            ${[
              ['MBTI·DISC는 채용 도구로 부적합', 'meta-analysis 검증 결과 직무 성과 예측력 r≈0.12 — 사실상 무효'],
              ['인지능력은 단일 최강 예측 지표', '85년·85만 명 연구 기반, r=0.51 — 직무 복잡도가 높을수록 예측력 ↑'],
              ['4가지 영역 조합으로 정확도 극대화', '인지능력 + 상황판단 + 성실성의 조합은 각각보다 예측력이 높습니다 (점증적 타당도)'],
            ].map(([title, desc]) => `
              <div style="display:flex;gap:10px;align-items:flex-start;">
                <span style="width:20px;height:20px;background:#4F46E5;color:#fff;border-radius:50%;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">✓</span>
                <div>
                  <p style="margin:0;font-size:13px;font-weight:600;color:#1E293B;">${esc(title)}</p>
                  <p style="margin:2px 0 0;font-size:12px;color:#64748B;line-height:1.5;">${esc(desc)}</p>
                </div>
              </div>`).join('')}
          </div>

          <!-- 예측 타당도 바 차트 (요약: 항상 표시) -->
          <div style="background:#F8FAFC;border-radius:10px;padding:14px;">
            <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:#475569;">📊 도구별 직무 성과 예측 타당도 (r)</p>
            ${VALIDITY_BARS.map(b => `
              <div style="margin-bottom:7px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                  <span style="font-size:11px;color:${b.label.includes('MBTI') ? '#94A3B8' : '#334155'};font-weight:${b.label.includes('MBTI') ? '400' : '500'};">${esc(b.label)}</span>
                  <span style="font-size:11px;font-weight:700;color:${b.color};">${b.r.toFixed(2)}</span>
                </div>
                <div style="height:7px;background:#E2E8F0;border-radius:4px;overflow:hidden;">
                  <div style="height:100%;width:${Math.round(b.r / 0.6 * 100)}%;background:${b.color};border-radius:4px;transition:width 0.8s ease;"></div>
                </div>
              </div>`).join('')}
            <p style="margin:8px 0 0;font-size:10px;color:#94A3B8;">출처: Schmidt & Hunter (1998), Psychological Bulletin · Barrick & Mount (1991), Personnel Psychology</p>
          </div>

        </div>

        <!-- 4영역 카드들 ──────────────────────────────────── -->
        <div style="background:#fff;border-radius:14px;padding:18px 16px;border:1px solid var(--border,#E2E8F0);box-shadow:0 1px 4px rgba(0,0,0,0.06);">
          <h2 style="margin:0 0 14px;font-size:15px;font-weight:700;color:var(--text,#1E293B);">🗂️ 검사 구성 4영역</h2>

          <div style="display:flex;flex-direction:column;gap:10px;">
            ${DOMAINS.map(d => `
              <div class="domain-card" data-domain="${d.id}"
                   style="border-radius:12px;border:1.5px solid ${d.border};background:${d.bg};overflow:hidden;cursor:pointer;">
                <!-- 헤더 행 (항상 표시) -->
                <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;">
                  <span style="font-size:1.6rem;flex-shrink:0;">${d.icon}</span>
                  <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                      <span style="font-size:14px;font-weight:700;color:${d.color};">${esc(d.name)}</span>
                      <span style="font-size:11px;font-weight:700;color:#fff;background:${d.color};padding:2px 8px;border-radius:20px;">${d.weight}%</span>
                      ${d.research.validity ? `<span style="font-size:10px;color:${d.color};font-weight:600;">r=${d.research.validity}</span>` : ''}
                    </div>
                    <p style="margin:2px 0 0;font-size:12px;color:#475569;">${esc(d.tagline)}</p>
                  </div>
                  <span class="domain-toggle" style="font-size:14px;color:#94A3B8;flex-shrink:0;transition:transform 0.2s;">▼</span>
                </div>
                <!-- 상세 (기본 숨김) -->
                <div class="domain-detail" style="display:none;padding:0 14px 14px;border-top:1px solid ${d.border};">
                  <div style="padding-top:12px;display:flex;flex-direction:column;gap:8px;">
                    ${d.sub.map(s => `
                      <div style="display:flex;gap:8px;align-items:flex-start;">
                        <span style="width:6px;height:6px;border-radius:50%;background:${d.color};margin-top:6px;flex-shrink:0;"></span>
                        <div>
                          <span style="font-size:13px;font-weight:600;color:#1E293B;">${esc(s.label)}</span>
                          ${s.q ? `<span style="font-size:11px;color:#94A3B8;margin-left:6px;">${s.q}문항${s.min ? ` · ${s.min}분` : ''}</span>` : ''}
                          <p style="margin:2px 0 0;font-size:12px;color:#64748B;line-height:1.5;">${esc(s.desc)}</p>
                        </div>
                      </div>`).join('')}
                  </div>
                  <!-- 연구 근거 -->
                  <div style="margin-top:12px;padding:10px 12px;background:rgba(255,255,255,0.7);border-radius:8px;border-left:3px solid ${d.color};">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${d.color};">📖 측정 근거</p>
                    <p style="margin:0;font-size:12px;color:#334155;line-height:1.6;">${esc(d.research.note)}</p>
                    <p style="margin:6px 0 0;font-size:10px;color:#94A3B8;">${esc(d.research.source)} · ${esc(d.research.ref)}</p>
                  </div>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <!-- 점수 체계 ───────────────────────────────────────── -->
        <div style="background:#fff;border-radius:14px;padding:18px 16px;border:1px solid var(--border,#E2E8F0);box-shadow:0 1px 4px rgba(0,0,0,0.06);">
          <div id="score-header" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;">
            <h2 style="margin:0;font-size:15px;font-weight:700;color:var(--text,#1E293B);">📐 점수 체계 &amp; 등급</h2>
            <span id="score-toggle" style="font-size:14px;color:#94A3B8;transition:transform 0.2s;">▼</span>
          </div>

          <!-- 요약 (항상 표시) -->
          <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
            ${[['S','상위 10%','#4F46E5'],['A','상위 25%','#0891B2'],['B','상위 50%','#059669'],['C','하위 50%','#D97706'],['D','하위 25%','#94A3B8']]
              .map(([g, desc, col]) => `
              <div style="flex:1;min-width:52px;text-align:center;padding:10px 6px;background:#F8FAFC;border-radius:10px;border:1.5px solid #E2E8F0;">
                <div style="font-size:18px;font-weight:800;color:${col};">${g}</div>
                <div style="font-size:10px;color:#64748B;margin-top:2px;">${desc}</div>
              </div>`).join('')}
          </div>

          <!-- 상세 수식 (접힘) -->
          <div id="score-detail" style="display:none;margin-top:14px;">
            <div style="background:#F8FAFC;border-radius:10px;padding:14px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#334155;">종합 예측 점수 산출식</p>
              <div style="font-family:monospace;font-size:12px;color:#4F46E5;background:#EEF2FF;padding:10px 12px;border-radius:8px;line-height:1.8;">
                점수 = <strong>0.40</strong> × 인지능력<br>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ <strong>0.25</strong> × 상황판단<br>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ <strong>0.20</strong> × 성실성<br>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ <strong>0.15</strong> × 직무기초역량
              </div>
              <p style="margin:10px 0 0;font-size:12px;color:#475569;line-height:1.6;">
                각 영역은 <strong>T점수</strong>(평균 50, SD 10)로 표준화됩니다. 백분위와 등급이 함께 제공되며, 지원한 직무의 성과 예측 프로파일과 비교할 수 있습니다.
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#94A3B8;">
                가중치는 Viswesvaran &amp; Ones (1995) 메타분석 기반 · 검사-재검사 신뢰도 목표: r≥0.85
              </p>
            </div>
          </div>
        </div>

        <!-- 상용 서비스 비교 ───────────────────────────────── -->
        <div style="background:#fff;border-radius:14px;padding:18px 16px;border:1px solid var(--border,#E2E8F0);box-shadow:0 1px 4px rgba(0,0,0,0.06);">
          <div id="compare-header" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;">
            <h2 style="margin:0;font-size:15px;font-weight:700;color:var(--text,#1E293B);">🏢 상용 검사와 비교</h2>
            <span id="compare-toggle" style="font-size:14px;color:#94A3B8;">▼</span>
          </div>
          <div id="compare-detail" style="display:none;margin-top:14px;overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead>
                <tr style="background:#F1F5F9;">
                  <th style="padding:8px;text-align:left;color:#475569;font-weight:600;border-radius:6px 0 0 6px;">영역</th>
                  <th style="padding:8px;text-align:center;color:#475569;font-weight:600;">GSAT<br><span style="font-weight:400;font-size:10px;">삼성</span></th>
                  <th style="padding:8px;text-align:center;color:#475569;font-weight:600;">SKCT<br><span style="font-weight:400;font-size:10px;">SK</span></th>
                  <th style="padding:8px;text-align:center;color:#4F46E5;font-weight:700;border-radius:0 6px 6px 0;">본 검사</th>
                </tr>
              </thead>
              <tbody>
                ${[
                  ['인지능력 (GMA)',    '✅ 4영역', '✅',       '✅ 3영역'],
                  ['상황판단 (SJT)',    '❌',       '✅',       '✅'],
                  ['성격 (Big Five)',   '❌',       '✅ 심층역량','✅ 성실성'],
                  ['NCS 기반',          '부분',     '❌',       '✅'],
                  ['예측 타당도 공개',  '❌',       '❌',       '✅ 논문 인용'],
                ].map(([row, a, b, c], i) => `
                  <tr style="background:${i % 2 ? '#F8FAFC' : '#fff'};border-bottom:1px solid #F1F5F9;">
                    <td style="padding:8px;color:#334155;font-weight:500;">${esc(row)}</td>
                    <td style="padding:8px;text-align:center;color:#64748B;">${esc(a)}</td>
                    <td style="padding:8px;text-align:center;color:#64748B;">${esc(b)}</td>
                    <td style="padding:8px;text-align:center;color:#4F46E5;font-weight:600;">${esc(c)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- CTA ─────────────────────────────────────────────── -->
        <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border-radius:14px;padding:22px 20px;text-align:center;color:#fff;">
          <p style="margin:0 0 4px;font-size:13px;opacity:0.85;">총 4영역 · 약 45분</p>
          <h3 style="margin:0 0 16px;font-size:18px;font-weight:800;">지금 검사를 시작하세요</h3>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <button id="apt-start" style="padding:14px 24px;background:#fff;color:#4F46E5;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;width:100%;">
              🚀 검사 시작하기
            </button>
            <p style="margin:4px 0 0;font-size:11px;opacity:0.7;">결과는 커리어 프로필에 자동 저장되어 HR 담당자에게 공개할 수 있습니다</p>
          </div>
        </div>

      </div>
    </div>`;

  bindEvents(container);
}

// ── Event binding ─────────────────────────────────────────────────
function bindEvents(container) {
  // 뒤로 가기
  container.querySelector('#apt-back')?.addEventListener('click', () => {
    history.length > 1 ? window.navBack() : (window.location.hash = '#/applicant/career');
  });

  // 도메인 카드 아코디언
  container.querySelectorAll('.domain-card').forEach(card => {
    card.addEventListener('click', () => {
      const detail = card.querySelector('.domain-detail');
      const toggle = card.querySelector('.domain-toggle');
      if (!detail) return;
      const isOpen = detail.style.display !== 'none';
      detail.style.display = isOpen ? 'none' : 'block';
      if (toggle) toggle.style.transform = isOpen ? '' : 'rotate(180deg)';
    });
  });

  // 점수 체계 아코디언
  container.querySelector('#score-header')?.addEventListener('click', () => {
    const det = container.querySelector('#score-detail');
    const tog = container.querySelector('#score-toggle');
    if (!det) return;
    const open = det.style.display !== 'none';
    det.style.display = open ? 'none' : 'block';
    if (tog) tog.style.transform = open ? '' : 'rotate(180deg)';
  });

  // 비교 아코디언
  container.querySelector('#compare-header')?.addEventListener('click', () => {
    const det = container.querySelector('#compare-detail');
    const tog = container.querySelector('#compare-toggle');
    if (!det) return;
    const open = det.style.display !== 'none';
    det.style.display = open ? 'none' : 'block';
    if (tog) tog.style.transform = open ? '' : 'rotate(180deg)';
  });

  container.querySelector('#apt-start')?.addEventListener('click', () => {
    navigate('#/aptitude/test');
  });
}

function _showComingSoon(container) {
  const existing = document.getElementById('_apt-coming-soon');
  if (existing) { existing.remove(); return; }

  const el = document.createElement('div');
  el.id = '_apt-coming-soon';
  el.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9998;display:flex;align-items:flex-end;"></div>
    <div style="position:fixed;bottom:0;left:0;right:0;max-width:500px;margin:0 auto;background:#fff;border-radius:20px 20px 0 0;z-index:9999;padding:24px 20px 36px;animation:slideUp 0.22s ease-out">
      <div style="width:40px;height:4px;background:#E2E8F0;border-radius:2px;margin:0 auto 20px;"></div>
      <div style="text-align:center;">
        <div style="font-size:2.5rem;margin-bottom:10px;">🚧</div>
        <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1E293B;">검사 준비 중</h3>
        <p style="margin:0 0 20px;font-size:14px;color:#64748B;line-height:1.6;">
          문항 데이터베이스와 채점 엔진을 구축 중입니다.<br>
          곧 정식 오픈됩니다!
        </p>
        <div style="background:#EEF2FF;border-radius:10px;padding:14px;text-align:left;margin-bottom:20px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#4F46E5;">준비 중인 기능</p>
          ${['45문항 인지능력 검사 (타이머 포함)','14문항 상황판단 시나리오','성실성 10문항 척도','NCS 직무기초 15문항','자동 T점수 산출 + 결과 리포트'].map(t =>
            `<p style="margin:3px 0;font-size:12px;color:#475569;">• ${t}</p>`).join('')}
        </div>
        <button id="_apt-cs-close" style="width:100%;padding:13px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">확인</button>
      </div>
    </div>`;

  document.body.appendChild(el);
  el.querySelector('#_apt-cs-close')?.addEventListener('click', () => el.remove());
  el.querySelector('div[style*="rgba(0,0,0"]')?.addEventListener('click', () => el.remove());

  if (!document.getElementById('_slide-up-style')) {
    const st = document.createElement('style');
    st.id = '_slide-up-style';
    st.textContent = `@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`;
    document.head.appendChild(st);
  }
}

// ── Public API ────────────────────────────────────────────────────
export async function mount(container) {
  _root = container;
  render(container);
}

export function unmount() {
  _root = null;
  document.getElementById('_apt-coming-soon')?.remove();
}
