/**
 * change-password.js — 비밀번호 변경 페이지
 * 첫 로그인 강제 변경 + 일반 변경 모두 지원
 */

import { api } from '../api.js';
import { getUser } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

export function mount(root) {
  const isFirstLogin = localStorage.getItem('hr_must_change_password') === '1';

  root.innerHTML = `
    <div class="page" style="background:var(--bg);display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px">
      <div class="card fade-in" style="width:100%;max-width:400px;padding:32px 28px">

        <div style="text-align:center;margin-bottom:28px">
          <div style="font-size:2.2rem;margin-bottom:8px">🔐</div>
          <h2 style="font-size:1.1rem;font-weight:700;color:var(--text);margin-bottom:6px">
            ${isFirstLogin ? '초기 비밀번호 변경' : '비밀번호 변경'}
          </h2>
          ${isFirstLogin ? `
            <p style="font-size:0.78rem;color:var(--text-muted);line-height:1.5">
              계정 보안을 위해 초기 비밀번호를<br>새 비밀번호로 변경해 주세요.
            </p>
          ` : ''}
        </div>

        <form id="change-pw-form" novalidate>
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label" for="current-pw">현재 비밀번호</label>
            <input type="password" id="current-pw" class="form-input"
                   placeholder="현재 비밀번호 입력" autocomplete="current-password" />
          </div>

          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label" for="new-pw">새 비밀번호</label>
            <input type="password" id="new-pw" class="form-input"
                   placeholder="6자 이상" autocomplete="new-password" />
          </div>

          <div class="form-group" style="margin-bottom:20px">
            <label class="form-label" for="confirm-pw">새 비밀번호 확인</label>
            <input type="password" id="confirm-pw" class="form-input"
                   placeholder="새 비밀번호 재입력" autocomplete="new-password" />
          </div>

          <div id="pw-error" class="form-error" style="display:none;margin-bottom:14px"></div>

          <button type="submit" class="btn btn-primary btn-block" id="change-btn">
            비밀번호 변경
          </button>

          ${!isFirstLogin ? `
            <button type="button" id="back-btn" class="btn btn-ghost btn-block"
                    style="margin-top:10px">취소</button>
          ` : ''}
        </form>
      </div>
    </div>
  `;

  _bind(root, isFirstLogin);
}

export function unmount() {}

function _bind(root, isFirstLogin) {
  const form      = root.querySelector('#change-pw-form');
  const currentEl = root.querySelector('#current-pw');
  const newEl     = root.querySelector('#new-pw');
  const confirmEl = root.querySelector('#confirm-pw');
  const errorEl   = root.querySelector('#pw-error');
  const submitBtn = root.querySelector('#change-btn');

  root.querySelector('#back-btn')?.addEventListener('click', () => {
    window.location.hash = '#/dashboard';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';

    if (!currentEl.value) {
      _showErr(errorEl, '현재 비밀번호를 입력해 주세요.');
      return currentEl.focus();
    }
    if (!newEl.value || newEl.value.length < 6) {
      _showErr(errorEl, '새 비밀번호는 6자 이상이어야 합니다.');
      return newEl.focus();
    }
    if (newEl.value !== confirmEl.value) {
      _showErr(errorEl, '새 비밀번호가 일치하지 않습니다.');
      return confirmEl.focus();
    }

    submitBtn.disabled   = true;
    submitBtn.innerHTML  = '<span class="spinner"></span> 변경 중...';

    try {
      await api.auth.changePassword(currentEl.value, newEl.value);
      localStorage.removeItem('hr_must_change_password');
      showToast('비밀번호가 변경되었습니다. 🔒', 'success')
      addNotification({ type: 'success', title: 'change password', body: '비밀번호가 변경되었습니다. 🔒' });
      window.location.hash = '#/dashboard';
    } catch (err) {
      const msg = err.message === 'Current password is incorrect'
        ? '현재 비밀번호가 올바르지 않습니다.'
        : (err.message === 'demo_mode' ? '데모 모드에서는 비밀번호를 변경할 수 없습니다.' : '비밀번호 변경 중 오류가 발생했습니다.');
      _showErr(errorEl, msg);
      submitBtn.disabled  = false;
      submitBtn.textContent = '비밀번호 변경';
    }
  });
}

function _showErr(el, msg) {
  el.textContent     = msg;
  el.style.display   = 'flex';
}
