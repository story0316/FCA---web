/**
 * onboarding.js — First-time onboarding tour for new hr_admin users.
 *
 * Shows a 4-step modal overlay the first time an hr_admin lands on the dashboard.
 * Persisted by localStorage key 'hr_onboarding_done'.
 *
 * Usage:
 *   import { showOnboardingIfNeeded } from '../components/onboarding.js';
 *   showOnboardingIfNeeded(user);   // call from dashboard mount()
 */

const LS_KEY = 'hr_onboarding_done';

const STEPS = [
  {
    icon: '🎉',
    title: 'HR OS 시작을 환영합니다!',
    desc: '조직이 생성됐어요. 데모 직원·역량·평가 템플릿이 미리 준비돼 있어서 지금 바로 탐색할 수 있습니다.',
    cta: null,
    ctaLabel: null,
  },
  {
    icon: '👥',
    title: '직원이 준비됐어요',
    desc: '6명의 데모 직원이 등록돼 있어요. 실제 팀원을 추가하거나 초대코드로 직접 가입하게 할 수 있습니다.',
    cta: '#/admin?tab=employees',
    ctaLabel: '직원 관리 보기',
  },
  {
    icon: '📋',
    title: '첫 평가를 만들어보세요',
    desc: '핵심 역량 5개와 기본 평가 템플릿이 준비됐어요. 평가 사이클을 만들고 직원들에게 배정할 수 있습니다.',
    cta: '#/admin?tab=templates',
    ctaLabel: '평가 템플릿 보기',
  },
  {
    icon: '🔑',
    title: '팀원을 초대하세요',
    desc: '초대코드를 생성해서 팀원들에게 공유하면, 팀원들이 직접 계정을 만들고 바로 참여할 수 있습니다.',
    cta: '#/admin?tab=invites',
    ctaLabel: '초대 관리 보기',
  },
];

let _overlay = null;
let _step    = 0;

export function showOnboardingIfNeeded(user) {
  if (!user || user.role !== 'hr_admin') return;
  if (localStorage.getItem(LS_KEY)) return;
  _step = 0;
  _render();
}

function _render() {
  _remove();

  _overlay = document.createElement('div');
  _overlay.id = 'onboarding-overlay';
  _overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    background:rgba(0,0,0,0.55);
    display:flex;align-items:center;justify-content:center;
    padding:20px;
    animation:ob-fade-in 0.2s ease;
  `;

  const step = STEPS[_step];
  const isLast = _step === STEPS.length - 1;
  const isFirst = _step === 0;

  _overlay.innerHTML = `
    <style>
      @keyframes ob-fade-in { from{opacity:0} to{opacity:1} }
      @keyframes ob-slide-up { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
      #onboarding-card { animation: ob-slide-up 0.25s ease; }
    </style>

    <div id="onboarding-card" style="
      background:var(--surface,#fff);
      border-radius:16px;
      padding:32px 28px 24px;
      max-width:380px;width:100%;
      box-shadow:0 20px 60px rgba(0,0,0,0.2);
      position:relative;
    ">
      <!-- 닫기 버튼 -->
      <button id="ob-close" aria-label="건너뛰기" style="
        position:absolute;top:14px;right:16px;
        background:none;border:none;cursor:pointer;
        font-size:1.2rem;color:var(--text-muted,#94a3b8);
        line-height:1;padding:4px;
      ">✕</button>

      <!-- 아이콘 -->
      <div style="font-size:3rem;text-align:center;margin-bottom:16px;line-height:1">
        ${step.icon}
      </div>

      <!-- 제목 -->
      <h2 style="
        font-size:1.1rem;font-weight:700;
        text-align:center;margin:0 0 10px;
        color:var(--text,#1e293b);
      ">${step.title}</h2>

      <!-- 설명 -->
      <p style="
        font-size:0.875rem;line-height:1.6;
        color:var(--text-muted,#64748b);
        text-align:center;margin:0 0 24px;
      ">${step.desc}</p>

      <!-- 진행 점 -->
      <div style="
        display:flex;gap:6px;justify-content:center;margin-bottom:24px;
      ">
        ${STEPS.map((_, i) => `
          <div style="
            width:${i === _step ? 20 : 7}px;height:7px;border-radius:4px;
            background:${i === _step ? 'var(--primary,#4F46E5)' : 'var(--border,#e2e8f0)'};
            transition:all 0.25s;
          "></div>
        `).join('')}
      </div>

      <!-- 버튼 영역 -->
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${step.cta ? `
          <a id="ob-cta" href="${step.cta}"
             style="
               display:block;text-align:center;
               background:var(--primary,#4F46E5);color:#fff;
               border-radius:10px;padding:12px;
               font-size:0.9rem;font-weight:600;
               text-decoration:none;
             ">
            ${step.ctaLabel}
          </a>
        ` : ''}
        <button id="ob-next" style="
          background:${isFirst ? 'var(--primary,#4F46E5)' : 'var(--bg,#f8fafc)'};
          color:${isFirst ? '#fff' : 'var(--text-muted,#64748b)'};
          border:${isFirst ? 'none' : '1px solid var(--border,#e2e8f0)'};
          border-radius:10px;padding:12px;
          font-size:0.9rem;font-weight:600;cursor:pointer;
        ">
          ${isFirst ? '시작하기 →' : isLast ? '완료' : '다음 →'}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(_overlay);

  _overlay.querySelector('#ob-close').addEventListener('click', _done);
  _overlay.querySelector('#ob-next').addEventListener('click', () => {
    if (isLast) {
      _done();
    } else {
      _step++;
      _render();
    }
  });

  if (step.cta) {
    _overlay.querySelector('#ob-cta').addEventListener('click', () => {
      _step++;
      if (_step < STEPS.length) {
        setTimeout(_render, 300);
      } else {
        _done();
      }
    });
  }

  // Click outside = close
  _overlay.addEventListener('click', e => {
    if (e.target === _overlay) _done();
  });
}

function _done() {
  localStorage.setItem(LS_KEY, '1');
  _remove();
}

function _remove() {
  if (_overlay) {
    _overlay.remove();
    _overlay = null;
  }
}
