/**
 * login.js – Login page (Persona-aware)
 * HR Competency OS
 */

import { api } from '../api.js';
import { handleLoginSuccess } from '../auth.js';
import { showToast } from '../components/toast.js'
import { addNotification } from '../components/notification-hub.js';
import { BUILD_DATE } from '../version.js';

const STATUS_HOME = { APPLICANT: '#/applicant', MEMBER: '#/dashboard', ALUMNI: '#/alumni' };

let _root = null;

export async function mount(root) {
  _root = root;
  render(root);
}

export function unmount() {
  _root = null;
}

function render(root) {
  root.innerHTML = `
    <div style="
      min-height:100vh;
      background:linear-gradient(160deg,#F0F4FF 0%,#F8F0FF 100%);
      display:flex;flex-direction:column;align-items:center;
      justify-content:flex-start;padding:48px 20px 40px;
    ">
      <!-- App icon -->
      <div style="
        width:72px;height:72px;border-radius:20px;
        background:#1E293B;display:flex;align-items:center;
        justify-content:center;font-size:2.2rem;
        margin-bottom:20px;
        box-shadow:0 8px 32px rgba(30,41,59,.20);
      ">🎯</div>

      <h1 style="font-size:1.5rem;font-weight:800;color:#1E293B;margin-bottom:4px;text-align:center">
        HR Competency OS
      </h1>
      <p style="font-size:0.82rem;color:var(--text-muted);margin:0 0 28px;text-align:center">
        직무 역량 진단 및 성장 관리 시스템
      </p>

      <!-- Social login buttons -->
      <div style="width:100%;max-width:360px;display:flex;flex-direction:column;gap:10px;margin-bottom:18px">
        <button id="kakao-btn" type="button" style="
          display:flex;align-items:center;justify-content:center;gap:10px;
          width:100%;padding:14px;border-radius:999px;border:none;
          background:#FEE500;color:#1E293B;font-size:0.92rem;font-weight:700;
          cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.08);
          transition:opacity .15s;
        ">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 1.5C4.86 1.5 1.5 4.19 1.5 7.5c0 2.09 1.23 3.93 3.09 5.05L3.75 15l3.33-1.84C7.64 13.27 8.31 13.38 9 13.38c4.14 0 7.5-2.69 7.5-5.88C16.5 4.19 13.14 1.5 9 1.5z" fill="#1E293B"/>
          </svg>
          카카오로 계속하기
        </button>
        <button id="google-btn" type="button" style="
          display:flex;align-items:center;justify-content:center;gap:10px;
          width:100%;padding:14px;border-radius:999px;border:1.5px solid #E2E8F0;
          background:var(--card-bg);color:#1E293B;font-size:0.92rem;font-weight:600;
          cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.06);
          transition:opacity .15s;
        ">
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path d="M16.51 8.17h-7.4v3.04h4.26c-.42 1.97-2.13 3.04-4.26 3.04A4.71 4.71 0 014.4 9.5a4.71 4.71 0 014.71-4.75c1.17 0 2.22.42 3.04 1.1l2.28-2.28A7.93 7.93 0 009.11 1.5 8 8 0 001.5 9.5a8 8 0 008 8c4.42 0 7.5-3.1 7.5-7.47 0-.5-.05-1.04-.15-1.4l.16.54z" fill="#4285F4"/>
            <path d="M2.3 5.45l2.64 1.94A4.71 4.71 0 019.11 4.75c1.17 0 2.22.42 3.04 1.1l2.28-2.28A7.93 7.93 0 009.11 1.5a8 8 0 00-6.81 3.95z" fill="#34A853"/>
            <path d="M9.11 17.5c2.1 0 3.88-.7 5.17-1.88l-2.39-1.96a4.71 4.71 0 01-2.78.88A4.71 4.71 0 014.4 11.4L1.78 13.4a8 8 0 007.33 4.1z" fill="#FBBC05"/>
            <path d="M16.51 8.17h-7.4v3.04h4.26c-.2.97-.79 1.8-1.6 2.35l2.39 1.96c1.4-1.3 2.21-3.22 2.21-5.4 0-.5-.05-1.04-.15-1.4l.29.45z" fill="#EA4335"/>
          </svg>
          Google로 계속하기
        </button>
      </div>

      <!-- Divider -->
      <div style="display:flex;align-items:center;gap:10px;width:100%;max-width:360px;margin-bottom:18px">
        <div style="flex:1;height:1px;background:#E2E8F0"></div>
        <span style="font-size:0.75rem;color:var(--text-muted);padding:0 6px">이메일로 로그인</span>
        <div style="flex:1;height:1px;background:#E2E8F0"></div>
      </div>

      <!-- Email login form -->
      <div style="width:100%;max-width:360px">
        <form id="login-form" novalidate autocomplete="on">
          <!-- Email input -->
          <div style="position:relative;margin-bottom:12px">
            <span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:1rem;color:var(--text-muted)">@</span>
            <input
              class="form-input"
              type="email"
              id="email"
              name="email"
              placeholder="이메일 주소"
              autocomplete="email"
              inputmode="email"
              required
              style="padding-left:36px;border-radius:12px;background:rgba(255,255,255,.9);border:1.5px solid #E2E8F0"
            >
            <div class="form-error" id="email-error" style="display:none">
              올바른 이메일 주소를 입력해 주세요.
            </div>
          </div>

          <!-- Password input -->
          <div style="position:relative;margin-bottom:16px">
            <span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:1rem;color:var(--text-muted)">🔒</span>
            <input
              class="form-input"
              type="password"
              id="password"
              name="password"
              placeholder="비밀번호"
              autocomplete="current-password"
              required
              style="padding-left:36px;padding-right:48px;border-radius:12px;background:rgba(255,255,255,.9);border:1.5px solid #E2E8F0"
            >
            <button
              type="button"
              id="pw-toggle"
              aria-label="비밀번호 표시/숨기기"
              style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1rem;padding:4px;min-height:auto;min-width:auto"
            >👁️</button>
            <div class="form-error" id="pw-error" style="display:none">
              비밀번호를 입력해 주세요.
            </div>
          </div>

          <div id="login-error" class="form-error" style="display:none;margin-bottom:12px"></div>

          <!-- Login button -->
          <button class="btn btn-primary btn-block btn-lg" type="submit" id="login-btn" style="
            border-radius:12px;
            background:linear-gradient(135deg,#3B82F6,#8B5CF6);
            border:none;font-weight:700;font-size:0.95rem;
            box-shadow:0 4px 16px rgba(59,130,246,.35);
          ">
            로그인
          </button>
        </form>

        <!-- Sign up link -->
        <div style="margin-top:16px;text-align:center;font-size:0.85rem;color:var(--text-muted)">
          계정이 없으신가요? <a href="#/register" style="color:#3B82F6;text-decoration:none;font-weight:700">회원가입</a>
        </div>
      </div>

      <!-- Admin link -->
      <button id="admin-mode-btn" type="button" style="
        margin-top:28px;background:none;border:none;cursor:pointer;
        font-size:0.75rem;color:var(--text-muted);padding:8px 16px;
      ">관리자</button>

      <!-- Version info -->
      <p style="margin-top:8px;font-size:0.7rem;color:#CBD5E1;text-align:center;line-height:1.6">
        HR Competency OS v1.0<br>
        <span style="font-size:0.66rem;opacity:0.7">업데이트: ${BUILD_DATE}</span>
      </p>
    </div>
  `;

  bindEvents(root);
}

function bindEvents(root) {
  const form      = root.querySelector('#login-form');
  const emailEl   = root.querySelector('#email');
  const pwEl      = root.querySelector('#password');
  const pwToggle  = root.querySelector('#pw-toggle');
  const loginBtn  = root.querySelector('#login-btn');
  const loginErr  = root.querySelector('#login-error');

  // Social login buttons → "준비 중" toast
  root.querySelector('#kakao-btn')?.addEventListener('click', () => {
    showToast('카카오 로그인은 준비 중입니다 🚧', 'info');
  });
  root.querySelector('#google-btn')?.addEventListener('click', () => {
    showToast('Google 로그인은 준비 중입니다 🚧', 'info');
  });

  // Admin mode link
  root.querySelector('#admin-mode-btn')?.addEventListener('click', () => {
    _showAdminPwModal(root);
  });

  // Show/hide password
  pwToggle.addEventListener('click', () => {
    const isHidden = pwEl.type === 'password';
    pwEl.type = isHidden ? 'text' : 'password';
    pwToggle.textContent = isHidden ? '🙈' : '👁️';
  });

  // Clear errors on input
  emailEl.addEventListener('input', () => clearError('email-error', emailEl, loginErr));
  pwEl.addEventListener('input',    () => clearError('pw-error',    pwEl,    loginErr));

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email    = emailEl.value.trim();
    const password = pwEl.value;
    let valid      = true;

    // Validate
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFieldError('email-error', emailEl);
      valid = false;
    }
    if (!password) {
      showFieldError('pw-error', pwEl);
      valid = false;
    }
    if (!valid) return;

    // Loading state
    loginBtn.disabled    = true;
    loginBtn.innerHTML   = '<span class="spinner"></span> 로그인 중...';
    loginErr.style.display = 'none';

    try {
      const result = await api.auth.login(email, password);

      if (!result || !result.token) {
        throw new Error(result?.message || '로그인에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.');
      }

      handleLoginSuccess(result);
      showToast('환영합니다! 🎉', 'success')
      addNotification({ type: 'success', title: 'login', body: '환영합니다! 🎉' });

      // Persona-aware redirect
      const { getUserPersonas, clearActivePersona, setActivePersona } = await import('../utils/persona.js');
      clearActivePersona(); // always reset on fresh login
      const personas = getUserPersonas(result.user);
      if (personas.length > 1) {
        window.location.hash = '#/persona-select';
      } else {
        setActivePersona(personas[0] || 'employee');
        if (result.user?.must_change_password) {
          localStorage.setItem('hr_must_change_password', '1');
          window.location.hash = '#/change-password';
        } else {
          window.location.hash = STATUS_HOME[result.user?.user_status] || '#/dashboard';
        }
      }

    } catch (err) {
      const msg = err.message || '';
      const friendly = msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')
        ? '서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.'
        : msg.includes('invalid') || msg.includes('wrong') || msg.includes('incorrect') || msg.includes('401')
        ? '이메일 또는 비밀번호가 올바르지 않습니다.'
        : msg || '로그인 중 오류가 발생했습니다.';
      loginErr.textContent   = friendly;
      loginErr.style.display = 'flex';
      loginBtn.disabled      = false;
      loginBtn.textContent   = '로그인';
      pwEl.value             = '';
      pwEl.focus();
    }
  });
}

function showFieldError(errorId, input) {
  const el = document.getElementById(errorId);
  if (el) el.style.display = 'flex';
  if (input) input.classList.add('error');
  if (input) input.focus();
}

function clearError(errorId, input, globalError) {
  const el = document.getElementById(errorId);
  if (el) el.style.display = 'none';
  if (input) input.classList.remove('error');
  if (globalError) globalError.style.display = 'none';
}

// ── 관리자 비밀번호 확인 모달 ────────────────────────────────────

function _showAdminPwModal(root) {
  document.getElementById('_admin-pw-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = '_admin-pw-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;
    display:flex;align-items:center;justify-content:center;padding:20px;
  `;

  overlay.innerHTML = `
    <div style="
      background:var(--card-bg);border-radius:16px;padding:28px 24px;
      width:100%;max-width:320px;box-shadow:0 20px 60px rgba(0,0,0,0.2);
    ">
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:2rem;margin-bottom:8px">🔐</div>
        <div style="font-weight:700;font-size:1rem;color:#1E293B">관리자 인증</div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px">관리자 비밀번호를 입력하세요</div>
      </div>

      <input
        id="_admin-pw-input"
        type="password"
        inputmode="numeric"
        maxlength="10"
        placeholder="비밀번호"
        style="
          width:100%;box-sizing:border-box;
          border:1.5px solid #E2E8F0;border-radius:10px;
          padding:12px 14px;font-size:1.1rem;text-align:center;
          letter-spacing:0.3em;outline:none;
          transition:border-color .2s;
        "
      >
      <div id="_admin-pw-error" style="
        display:none;color:#EF4444;font-size:0.75rem;
        text-align:center;margin-top:8px;font-weight:600;
      ">비밀번호가 올바르지 않습니다</div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px">
        <button id="_admin-pw-cancel" style="
          padding:11px;border-radius:10px;border:1.5px solid #E2E8F0;
          background:transparent;color:var(--text-muted);font-size:0.85rem;
          font-weight:600;cursor:pointer;
        ">취소</button>
        <button id="_admin-pw-ok" style="
          padding:11px;border-radius:10px;border:none;
          background:#4F46E5;color:#fff;font-size:0.85rem;
          font-weight:700;cursor:pointer;
        ">확인</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const input   = overlay.querySelector('#_admin-pw-input');
  const errEl   = overlay.querySelector('#_admin-pw-error');
  const okBtn   = overlay.querySelector('#_admin-pw-ok');
  const cancelBtn = overlay.querySelector('#_admin-pw-cancel');

  const ADMIN_PW = localStorage.getItem('hr_admin_pin') || String(1).padStart(4, '0');

  function attempt() {
    const val = input.value;
    if (val === ADMIN_PW) {
      overlay.remove();
      window.location.hash = '#/mode';
    } else {
      errEl.style.display = 'block';
      input.style.borderColor = '#EF4444';
      input.value = '';
      input.focus();
      setTimeout(() => {
        errEl.style.display = 'none';
        input.style.borderColor = '#E2E8F0';
      }, 2000);
    }
  }

  input.addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); });
  input.addEventListener('input',   () => { errEl.style.display = 'none'; input.style.borderColor = '#E2E8F0'; });
  okBtn.addEventListener('click',   attempt);
  cancelBtn.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  setTimeout(() => input.focus(), 50);
}
