/**
 * job-description.js — 직무기술서 열람
 */

const JOB_FAMILIES = [
  {
    id: 'hr',
    name: 'HR / 인사',
    icon: '👥',
    jobs: [
      {
        id: 'hr-generalist',
        title: 'HR 제너럴리스트',
        level: '사원~과장',
        summary: '채용·교육·평가·노무 전반을 담당하며 직원 생애주기 관리를 지원합니다.',
        competencies: ['전략적 인적자원 관리', '노무법령 이해', '데이터 분석', '커뮤니케이션', '프로젝트 관리'],
        responsibilities: [
          '채용 프로세스 운영 (공고~입사)',
          '온보딩·오프보딩 프로세스 관리',
          '근태·급여 데이터 처리',
          '교육훈련 수요조사 및 과정 운영',
          '직원 상담 및 고충 처리',
        ],
        kpis: ['채용 소요일수', '온보딩 완료율', '교육이수율', '직원만족도(eNPS)'],
        tools: ['HR OS', 'Excel', 'ZoomInfo', 'Notion'],
        growthPath: ['HR 담당 → HR 시니어 → HR BP → CHRO'],
        requirements: { edu: '학사 이상', exp: '0~5년', cert: ['PHR', 'SHRM-CP (우대)'] },
      },
      {
        id: 'recruiter',
        title: '채용 담당자',
        level: '사원~대리',
        summary: '직무 분석부터 온보딩까지 채용 풀사이클을 책임지는 포지션입니다.',
        competencies: ['소싱 전략', '인터뷰 스킬', '고용 브랜딩', '데이터 분석', '협상력'],
        responsibilities: [
          '채용 공고 작성 및 게시',
          '후보자 소싱 (LinkedIn, 서치펌, 리퍼럴)',
          '서류·면접 전형 운영',
          '처우 협상 및 오퍼 발송',
          '채용 KPI 리포트 작성',
        ],
        kpis: ['채용 충원율', '평균 채용 소요일', '오퍼 수락률', '신입 90일 유지율'],
        tools: ['ATS', 'LinkedIn Recruiter', 'CATS', 'Notion'],
        growthPath: ['채용 담당 → 시니어 채용 → 채용 매니저 → HR BP'],
        requirements: { edu: '학사 이상', exp: '0~3년', cert: ['CHRP (우대)'] },
      },
    ],
  },
  {
    id: 'dev',
    name: '개발 / 엔지니어링',
    icon: '💻',
    jobs: [
      {
        id: 'frontend',
        title: '프론트엔드 개발자',
        level: '주니어~시니어',
        summary: '사용자 인터페이스 설계 및 구현을 담당하며, 최적화된 웹 경험을 제공합니다.',
        competencies: ['React/Vue', 'TypeScript', '성능 최적화', '접근성', '협업 커뮤니케이션'],
        responsibilities: [
          'UI 컴포넌트 설계 및 개발',
          '디자인 시스템 구축 및 유지보수',
          '성능 측정 및 개선 (Lighthouse, Core Web Vitals)',
          'API 연동 및 상태 관리',
          '코드 리뷰 및 기술 문서 작성',
        ],
        kpis: ['스프린트 완료율', 'Lighthouse 점수', '버그 재발률', 'PR 리뷰 대기시간'],
        tools: ['React', 'TypeScript', 'Figma', 'Jest', 'Storybook'],
        growthPath: ['주니어 개발자 → 개발자 → 시니어 → 테크리드 → 엔지니어링 매니저'],
        requirements: { edu: '학사 이상 (관련 전공)', exp: '0~7년', cert: ['정보처리기사 (우대)'] },
      },
      {
        id: 'backend',
        title: '백엔드 개발자',
        level: '주니어~시니어',
        summary: 'API 설계부터 데이터베이스 운영까지 서버사이드 로직을 책임집니다.',
        competencies: ['Python/Java/Go', 'RESTful API', 'DB 설계', '시스템 아키텍처', '보안'],
        responsibilities: [
          'API 서버 설계 및 개발',
          '데이터베이스 모델링 및 쿼리 최적화',
          '마이크로서비스 아키텍처 구현',
          '성능 테스트 및 모니터링',
          '기술 부채 해소 및 리팩터링',
        ],
        kpis: ['API 응답시간 p99', '서비스 가용성', '배포 빈도', '사고 복구 시간'],
        tools: ['FastAPI/Spring', 'PostgreSQL', 'Redis', 'Docker', 'Prometheus'],
        growthPath: ['주니어 개발자 → 개발자 → 시니어 → 아키텍트 → CTO'],
        requirements: { edu: '학사 이상 (컴퓨터공학 우대)', exp: '0~7년', cert: ['AWS SA', 'CKAD (우대)'] },
      },
    ],
  },
  {
    id: 'marketing',
    name: '마케팅',
    icon: '📢',
    jobs: [
      {
        id: 'growth',
        title: '그로스 마케터',
        level: '사원~과장',
        summary: '데이터 기반 실험과 채널 최적화로 지속 가능한 성장을 만들어냅니다.',
        competencies: ['데이터 분석', 'A/B테스트', 'SEO/SEM', '퍼포먼스 마케팅', '콘텐츠 전략'],
        responsibilities: [
          '유입 채널별 성과 측정 및 최적화',
          'A/B 테스트 설계·실행·분석',
          'CRM 자동화 운영',
          '마케팅 예산 집행 및 ROI 보고',
          '크로스채널 캠페인 운영',
        ],
        kpis: ['CAC', 'LTV', 'ROAS', 'MQL→SQL 전환율'],
        tools: ['Google Analytics 4', 'Meta Ads', 'HubSpot', 'Amplitude', 'Looker'],
        growthPath: ['마케터 → 시니어 마케터 → 그로스 리드 → CMO'],
        requirements: { edu: '학사 이상', exp: '1~5년', cert: ['Google Ads 인증 (우대)'] },
      },
    ],
  },
  {
    id: 'finance',
    name: '재무 / 회계',
    icon: '💰',
    jobs: [
      {
        id: 'fp-analyst',
        title: 'FP&A 애널리스트',
        level: '사원~과장',
        summary: '경영 계획·예산·성과 분석을 통해 의사결정을 재무적으로 지원합니다.',
        competencies: ['재무 모델링', '예산 관리', '데이터 시각화', 'SQL', '비즈니스 인사이트'],
        responsibilities: [
          '연간 예산 수립 및 분기 재예측',
          '부서별 비용 분석 및 보고',
          '재무 대시보드 구축·유지',
          '투자 타당성 분석 지원',
          '월간 경영 보고서 작성',
        ],
        kpis: ['예산 대비 실적 정확도', '보고서 제출 적시성', '비용 절감 제안 건수'],
        tools: ['Excel', 'Power BI', 'SAP', 'SQL', 'Tableau'],
        growthPath: ['FP&A 애널리스트 → 시니어 → FP&A 매니저 → CFO'],
        requirements: { edu: '학사 이상 (경영/경제 우대)', exp: '0~5년', cert: ['CPA', 'CFA (우대)'] },
      },
    ],
  },
];

let _selectedFamily = null;
let _selectedJob    = null;
let _searchQuery    = '';

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _selectedFamily = null;
  _selectedJob    = null;
  _searchQuery    = '';
  _draw(root);
}

export function unmount() {
  _selectedFamily = null;
  _selectedJob    = null;
  _searchQuery    = '';
}

function _allJobs() {
  return JOB_FAMILIES.flatMap(f => f.jobs.map(j => ({ ...j, familyName: f.name, familyIcon: f.icon, familyId: f.id })));
}

function _draw(root) {
  if (_selectedJob) { _drawDetail(root); return; }

  const q = _searchQuery.toLowerCase();
  const allJobs = _allJobs();
  const filtered = q
    ? allJobs.filter(j => j.title.toLowerCase().includes(q) || j.summary.toLowerCase().includes(q) || j.competencies.some(c => c.toLowerCase().includes(q)))
    : _selectedFamily
      ? allJobs.filter(j => j.familyId === _selectedFamily)
      : allJobs;

  const totalJobs = allJobs.length;

  root.innerHTML = `
<div class="page">
  <div class="page-header" style="background:var(--card-bg);border-bottom:1px solid var(--border);padding:16px;display:flex;align-items:center;gap:12px">
    <button onclick="window.navBack()"
      style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0;line-height:1">←</button>
    <div>
      <div style="font-size:16px;font-weight:700;color:var(--text)">직무기술서</div>
      <div style="font-size:11px;color:var(--text-muted)">역할별 요구역량 · KPI · 성장경로</div>
    </div>
  </div>

  <div class="page-content" style="padding:16px">
    <!-- 검색 -->
    <div style="position:relative;margin-bottom:12px">
      <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:14px">🔍</span>
      <input id="jd-search" type="text" placeholder="직무명 또는 역량 검색…" value="${_searchQuery}"
        style="width:100%;padding:10px 12px 10px 36px;border:1.5px solid var(--border);border-radius:10px;
               font-size:13px;background:var(--card-bg);color:var(--text);box-sizing:border-box">
    </div>

    <!-- 직무군 필터 -->
    ${!q ? `<div style="display:flex;gap:6px;overflow-x:auto;margin-bottom:14px;padding-bottom:4px">
      <button class="jd-fam-btn" data-id=""
        style="flex-shrink:0;padding:6px 12px;border-radius:20px;border:1.5px solid ${!_selectedFamily?'#4F46E5':'var(--border)'};
               background:${!_selectedFamily?'#EEF2FF':'var(--card-bg)'};font-size:11px;font-weight:600;
               color:${!_selectedFamily?'#4F46E5':'var(--text-muted)'};cursor:pointer;white-space:nowrap">
        전체 (${totalJobs})
      </button>
      ${JOB_FAMILIES.map(f => `
        <button class="jd-fam-btn" data-id="${f.id}"
          style="flex-shrink:0;padding:6px 12px;border-radius:20px;border:1.5px solid ${_selectedFamily===f.id?'#4F46E5':'var(--border)'};
                 background:${_selectedFamily===f.id?'#EEF2FF':'var(--card-bg)'};font-size:11px;font-weight:600;
                 color:${_selectedFamily===f.id?'#4F46E5':'var(--text-muted)'};cursor:pointer;white-space:nowrap">
          ${f.icon} ${f.name} (${f.jobs.length})
        </button>`).join('')}
    </div>` : ''}

    <!-- 직무 카드 목록 -->
    ${!filtered.length
      ? `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
          <div style="font-size:36px;margin-bottom:10px">🔍</div>
          <div style="font-size:14px;font-weight:600">'${q}'에 해당하는 직무가 없습니다</div>
        </div>`
      : filtered.map(j => `
        <button class="jd-job-card" data-id="${j.id}" data-fid="${j.familyId}"
          style="width:100%;text-align:left;background:var(--card-bg);border:1px solid var(--border);border-radius:14px;
                 padding:14px;margin-bottom:10px;cursor:pointer;display:block">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--text)">${j.title}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${j.familyIcon} ${j.familyName} · ${j.level}</div>
            </div>
            <span style="font-size:16px">›</span>
          </div>
          <div style="font-size:12px;color:var(--text-muted);line-height:1.5;margin-bottom:8px">${j.summary}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${j.competencies.slice(0,3).map(c => `<span style="padding:2px 7px;background:#EEF2FF;border-radius:6px;font-size:10px;color:#4F46E5;font-weight:600">${c}</span>`).join('')}
            ${j.competencies.length > 3 ? `<span style="padding:2px 7px;background:#F1F5F9;border-radius:6px;font-size:10px;color:var(--text-muted)">+${j.competencies.length-3}</span>` : ''}
          </div>
        </button>`).join('')}
  </div>
</div>`;

  root.querySelector('#jd-search')?.addEventListener('input', e => {
    _searchQuery = e.target.value;
    _draw(root);
  });

  root.querySelectorAll('.jd-fam-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _selectedFamily = btn.dataset.id || null;
      _draw(root);
    });
  });

  root.querySelectorAll('.jd-job-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const fam = JOB_FAMILIES.find(f => f.id === btn.dataset.fid);
      _selectedJob = fam?.jobs.find(j => j.id === btn.dataset.id) || null;
      if (_selectedJob) _selectedJob._fam = fam;
      _draw(root);
    });
  });
}

function _drawDetail(root) {
  const j = _selectedJob;

  root.innerHTML = `
<div class="page">
  <div class="page-header" style="background:var(--card-bg);border-bottom:1px solid var(--border);padding:16px;display:flex;align-items:center;gap:12px">
    <button id="jd-back"
      style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0;line-height:1">←</button>
    <div>
      <div style="font-size:16px;font-weight:700;color:var(--text)">${j.title}</div>
      <div style="font-size:11px;color:var(--text-muted)">${j._fam?.icon || ''} ${j._fam?.name || ''} · ${j.level}</div>
    </div>
  </div>

  <div class="page-content" style="padding:16px">

    <!-- 요약 -->
    <div style="background:#EEF2FF;border-radius:12px;padding:14px;margin-bottom:14px">
      <div style="font-size:12px;color:#4F46E5;line-height:1.6">${j.summary}</div>
    </div>

    <!-- 핵심 역량 -->
    <div style="margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px">🎯 핵심 역량</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${j.competencies.map(c => `<span style="padding:5px 10px;background:#EEF2FF;border-radius:8px;font-size:12px;color:#4F46E5;font-weight:600">${c}</span>`).join('')}
      </div>
    </div>

    <!-- 주요 업무 -->
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px">📋 주요 업무</div>
      ${j.responsibilities.map(r => `
        <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:6px">
          <span style="color:#4F46E5;flex-shrink:0;margin-top:1px">•</span>
          <span style="font-size:12px;color:#475569;line-height:1.5">${r}</span>
        </div>`).join('')}
    </div>

    <!-- KPI -->
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px">📊 성과 지표 (KPI)</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${j.kpis.map(k => `<span style="padding:5px 10px;background:#D1FAE5;border-radius:8px;font-size:12px;color:#059669;font-weight:600">${k}</span>`).join('')}
      </div>
    </div>

    <!-- 도구 -->
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px">🛠️ 주요 도구</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${j.tools.map(t => `<span style="padding:5px 10px;background:#F1F5F9;border-radius:8px;font-size:12px;color:#475569;font-weight:600">${t}</span>`).join('')}
      </div>
    </div>

    <!-- 성장 경로 -->
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px">🗺️ 성장 경로</div>
      ${j.growthPath.map(p => `<div style="font-size:12px;color:#475569;line-height:1.6">${p}</div>`).join('')}
    </div>

    <!-- 자격요건 -->
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px">📌 자격요건</div>
      <div style="display:grid;gap:6px;font-size:12px;color:#475569">
        <div><span style="font-weight:600;color:var(--text)">학력:</span> ${j.requirements.edu}</div>
        <div><span style="font-weight:600;color:var(--text)">경력:</span> ${j.requirements.exp}</div>
        <div><span style="font-weight:600;color:var(--text)">자격증:</span> ${j.requirements.cert.join(', ') || '없음'}</div>
      </div>
    </div>

  </div>
</div>`;

  root.querySelector('#jd-back')?.addEventListener('click', () => {
    _selectedJob = null;
    _draw(root);
  });
}import { isApplicant } from '../auth.js';

