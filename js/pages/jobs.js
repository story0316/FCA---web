/**
 * jobs.js – Job Listings Page
 * HR Competency OS — Phase 3
 *
 * Accessible to all segments:
 *   APPLICANT → "지원하기" (purple) → saves to hr_applicant_data, navigates #/applicant/apply
 *   Others    → "상세보기" (grey outline, read-only)
 *
 * Features: filter chips (전체 / HR / People & Culture), expand/collapse JD
 */

import { showToast }         from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';
import { isApplicant }       from '../auth.js';
import { DEMO_JOB_POSTINGS } from '../data/demo_jobs.js';

// ── Module state ─────────────────────────────────────────────────
let _root         = null;
let _activeFilter = '전체';
let _expandedJobs = new Set();   // job ids whose JD is expanded

// ── localStorage key ─────────────────────────────────────────────
const LS_APPLICANT_DATA = 'hr_applicant_data';

// ── Filter definitions ───────────────────────────────────────────
const FILTERS = ['전체', 'HR', 'People & Culture'];

// ── Helpers ──────────────────────────────────────────────────────
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDeadline(dateStr) {
  try {
    const d     = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff  = Math.round((d - today) / 86400000);
    if (diff < 0)  return { label: '마감',           color: 'var(--text-muted)', bg: '#F1F5F9' };
    if (diff === 0) return { label: 'D-Day',          color: '#EF4444', bg: '#FEE2E2' };
    if (diff <= 7)  return { label: `D-${diff}`,      color: '#F97316', bg: '#FFF7ED' };
    return             { label: `D-${diff}`,      color: '#4F46E5', bg: '#EEF2FF' };
  } catch {
    return { label: dateStr, color: 'var(--text-muted)', bg: '#F1F5F9' };
  }
}

function matchFilter(job) {
  if (_activeFilter === '전체') return true;
  return (job.dept || '').includes(_activeFilter);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Load jobs ────────────────────────────────────────────────────
async function loadJobs() {
  try {
    const { api } = await import('../api.js');
    if (api && api.jobs && typeof api.jobs.list === 'function') {
      const result = await api.jobs.list('ORG001');
      if (result && Array.isArray(result) && result.length) return result;
    }
  } catch { /* fall through to demo data */ }
  return DEMO_JOB_POSTINGS;
}

// ── Render ───────────────────────────────────────────────────────
function render(container, jobs) {
  const applicant    = isApplicant();
  const filteredJobs = jobs.filter(matchFilter);

  // Filter chips HTML
  const filtersHtml = FILTERS.map(f => {
    const active = f === _activeFilter;
    return `<button data-filter="${esc(f)}"
      style="padding:7px 16px;border-radius:20px;border:none;font-size:13px;font-weight:600;
             cursor:pointer;transition:all 0.15s;white-space:nowrap;
             background:${active ? '#4F46E5' : '#fff'};
             color:${active ? '#fff' : 'var(--text-muted)'};
             border:1.5px solid ${active ? '#4F46E5' : '#E2E8F0'};">
      ${esc(f)}
    </button>`;
  }).join('');

  // Job cards HTML
  const jobsHtml = filteredJobs.length
    ? filteredJobs.map(job => {
        const dl        = formatDeadline(job.deadline);
        const expanded  = _expandedJobs.has(job.id);
        const tagsHtml  = (job.tags || []).map(t =>
          `<span style="padding:3px 8px;background:#EEF2FF;color:#4F46E5;border-radius:20px;
                        font-size:11px;font-weight:600;">${esc(t)}</span>`
        ).join('');
        const compTagsHtml = (job.required_competencies || []).map(c => {
          const label = c.replace('COMP_FUNC_', '').replace('COMP_CORE_', '').replace('COMP_FUTURE_', '');
          return `<span style="padding:3px 8px;background:#FFF7ED;color:#D97706;border-radius:20px;
                               font-size:11px;font-weight:600;">⚡ ${esc(label)}</span>`;
        }).join('');

        const ctaBtn = applicant
          ? `<button data-apply="${esc(job.id)}" data-title="${esc(job.title)}"
               style="width:100%;padding:12px;background:#4F46E5;color:#fff;border:none;
                      border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;
                      transition:opacity 0.15s;margin-top:12px;">
               지원하기
             </button>`
          : `<button data-view="${esc(job.id)}"
               style="width:100%;padding:12px;background:var(--card-bg);color:var(--text-muted);
                      border:1.5px solid #E2E8F0;border-radius:8px;font-size:14px;
                      font-weight:600;cursor:pointer;transition:opacity 0.15s;margin-top:12px;">
               상세보기
             </button>`;

        const expandedSection = expanded ? `
          <div style="margin-top:12px;padding:14px;background:#F8FAFC;border-radius:8px;
                      border:1px solid #E2E8F0;">
            <pre style="margin:0;font-size:13px;color:#1E293B;line-height:1.7;
                        white-space:pre-wrap;font-family:inherit;">${esc(job.jd_full)}</pre>
            ${ctaBtn}
          </div>` : '';

        return `
          <div class="job-card" data-job-id="${esc(job.id)}"
            style="background:var(--card-bg);border-radius:10px;padding:18px 16px;
                   border:1px solid ${expanded ? '#4F46E5' : '#E2E8F0'};
                   box-shadow:0 1px 4px rgba(0,0,0,0.06);cursor:pointer;
                   transition:border-color 0.15s;">

            <!-- 헤더 행 -->
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
              <div style="flex:1;min-width:0;">
                <h3 style="margin:0 0 3px;font-size:15px;font-weight:700;color:#1E293B;
                            line-height:1.3;">${esc(job.title)}</h3>
                <p style="margin:0 0 10px;font-size:12px;color:var(--text-muted);">${esc(job.dept)}</p>
                <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:${compTagsHtml ? '6px' : '10px'};">
                  ${tagsHtml}
                </div>
                ${compTagsHtml ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;">${compTagsHtml}</div>` : ''}
              </div>
              <div style="flex-shrink:0;text-align:right;">
                <span style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:12px;
                              font-weight:700;background:${dl.bg};color:${dl.color};">
                  ${dl.label}
                </span>
                <p style="margin:4px 0 0;font-size:10px;color:var(--text-muted);">~${esc(job.deadline)}</p>
              </div>
            </div>

            <!-- 요약 -->
            <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;
                      display:-webkit-box;-webkit-line-clamp:${expanded ? 'unset' : '2'};
                      -webkit-box-orient:vertical;overflow:hidden;">
              ${esc(job.jd_summary)}
            </p>

            <!-- 접기/펼치기 힌트 -->
            <p style="margin:8px 0 0;font-size:12px;color:#4F46E5;font-weight:600;">
              ${expanded ? '▲ 접기' : '▼ 자세히 보기'}
            </p>

            <!-- 확장 영역 -->
            ${expandedSection}
          </div>`;
      }).join('')
    : `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
         <div style="font-size:40px;margin-bottom:10px">📋</div>
         <div style="font-size:14px;font-weight:600;margin-bottom:4px;color:var(--text-muted)">해당하는 공고가 없습니다</div>
         <div style="font-size:12px">다른 필터를 선택해 보세요.</div>
       </div>`;

  container.innerHTML = `
    <div id="jobs-page" style="min-height:100vh;background:#F8FAFC;padding:0 0 80px;">

      <!-- 헤더 -->
      <div style="background:var(--card-bg);padding:48px 20px 16px;border-bottom:1px solid #E2E8F0;">
        <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#1E293B;">📢 채용공고</h1>
        <p style="margin:0;font-size:13px;color:var(--text-muted);">현재 모집 중인 포지션</p>
      </div>

      <div style="padding:16px 16px 0;">

        <!-- 필터 칩 -->
        <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:16px;
                    scrollbar-width:none;">
          ${filtersHtml}
        </div>

        <!-- 공고 개수 -->
        <p style="margin:0 0 14px;font-size:12px;color:var(--text-muted);">
          ${filteredJobs.length}개의 포지션
        </p>

        <!-- 공고 목록 -->
        <div id="jobs-list" style="display:flex;flex-direction:column;gap:12px;">
          ${jobsHtml}
        </div>
      </div>
    </div>
  `;

  bindEvents(container, jobs, applicant);
}

// ── Event binding ─────────────────────────────────────────────────
function bindEvents(container, jobs, applicant) {
  // Filter chips
  container.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeFilter = btn.dataset.filter;
      render(container, jobs);
    });
  });

  // Card expand/collapse (click on card body, not CTA buttons)
  container.querySelectorAll('.job-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Ignore clicks on buttons inside the card
      if (e.target.closest('button[data-apply], button[data-view]')) return;

      const jobId = card.dataset.jobId;
      if (_expandedJobs.has(jobId)) {
        _expandedJobs.delete(jobId);
      } else {
        _expandedJobs.add(jobId);
      }
      render(container, jobs);
    });
  });

  // "지원하기" buttons (applicant only)
  container.querySelectorAll('[data-apply]').forEach(btn => {
    btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.85'; });
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '1'; });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const jobId    = btn.dataset.apply;
      const jobTitle = btn.dataset.title;

      try {
        const existing = (() => {
          try { return JSON.parse(localStorage.getItem(LS_APPLICANT_DATA) || 'null'); } catch { return null; }
        })();
        const data = {
          ...(existing || {}),
          jobPostingId: jobId,
          jobTitle:     jobTitle,
          processStep:  'DOCUMENT',
          applyDate:    todayStr(),
        };
        localStorage.setItem(LS_APPLICANT_DATA, JSON.stringify(data));
      } catch { /* quota exceeded */ }

      showToast('지원서 작성 화면으로 이동합니다', 'info');
      addNotification({ type: 'info', title: '채용 공고', body: '지원서 작성 화면으로 이동합니다.' });
      window.location.hash = '#/applicant/apply';
    });
  });

  // "상세보기" buttons (non-applicant — expand already handled by card click; button is cosmetic)
  container.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.85'; });
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '1'; });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Card toggle is handled by the card click handler above; this just prevents bubble
      const jobId = btn.dataset.view;
      if (_expandedJobs.has(jobId)) {
        _expandedJobs.delete(jobId);
      } else {
        _expandedJobs.add(jobId);
      }
      render(container, jobs);
    });
  });
}

// ── Public API ───────────────────────────────────────────────────
export async function mount(container, appState) {
  _root         = container;
  _activeFilter = '전체';
  _expandedJobs = new Set();

  // Show skeleton while loading
  container.innerHTML = `
    <div style="padding:60px 20px;text-align:center;color:var(--text-muted);font-size:14px;">
      공고를 불러오는 중...
    </div>`;

  const jobs = await loadJobs();
  if (_root !== container) return;   // unmounted while loading
  render(container, jobs);
}

export function unmount() {
  _root = null;
}
