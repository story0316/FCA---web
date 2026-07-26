import { setToken, setUser } from '../auth.js';
import { showToast } from '../components/toast.js'
import { addNotification } from '../components/notification-hub.js';

// Legacy demo invite codes (localStorage-only, for non-local deployments)
const DEMO_INVITE_CODES = {
  'FCA2026':   { role: 'staff',    level_code: 'L2', user_status: 'MEMBER' },
  'FCAJOIN':   { role: 'staff',    level_code: 'L1', user_status: 'MEMBER' },
  'ADMIN2026': { role: 'hr_admin', level_code: 'L4', user_status: 'MEMBER' },
};

const STATUS_HOME = { APPLICANT: '#/applicant', MEMBER: '#/dashboard', ALUMNI: '#/alumni' };

function isLocalBackend() {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

async function apiFetch(path, body) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function getLocalUsers() {
  try { return JSON.parse(localStorage.getItem('fca_registered_users') || '[]'); }
  catch { return []; }
}
function saveLocalUsers(users) {
  localStorage.setItem('fca_registered_users', JSON.stringify(users));
}

let _root = null;

export function mount(root) {
  _root = root;
  if (isLocalBackend()) {
    renderLocalLanding(root);
  } else {
    renderDemoStep1(root);
  }
}
export function unmount() { _root = null; }

// ── Local backend: landing screen ────────────────────────────────────────────

function renderLocalLanding(root) {
  root.innerHTML = `
    <div class="login-page">
      <div class="login-logo" aria-hidden="true">🏢</div>
      <h1 class="login-title">시작하기</h1>
      <p class="login-subtitle">새 조직을 만들거나 초대코드로 팀에 합류하세요</p>
      <div style="display:flex;flex-direction:column;gap:12px;max-width:360px;margin:24px auto 0">
        <button id="btn-new-org" class="btn btn-primary btn-block btn-lg"
                style="padding:18px;font-size:1rem">
          🏗️ 새 조직 만들기
          <div style="font-size:0.75rem;font-weight:400;margin-top:4px;opacity:0.85">
            HR 담당자로 독립 테스트 공간 생성
          </div>
        </button>
        <button id="btn-join" class="btn btn-block btn-lg"
                style="padding:18px;font-size:1rem;background:var(--surface);border:1.5px solid var(--border);color:var(--text)">
          🔑 초대코드로 가입
          <div style="font-size:0.75rem;font-weight:400;margin-top:4px;opacity:0.7">
            관리자에게 받은 코드로 팀 합류
          </div>
        </button>
        <div style="margin-top:12px;text-align:center;font-size:0.85rem;color:var(--text-muted)">
          이미 계정이 있으신가요?
          <a href="#/login" style="color:var(--primary);text-decoration:none;font-weight:600">로그인</a>
        </div>
      </div>
    </div>`;

  root.querySelector('#btn-new-org').addEventListener('click', () => renderNewOrgForm(root));
  root.querySelector('#btn-join').addEventListener('click', () => renderInviteStep1(root));
}

// ── Local backend: new org form ───────────────────────────────────────────────

function renderNewOrgForm(root) {
  root.innerHTML = `
    <div class="login-page">
      <div class="login-logo" aria-hidden="true">🏗️</div>
      <h1 class="login-title">새 조직 만들기</h1>
      <p class="login-subtitle">독립된 HR 테스트 공간을 생성합니다</p>
      <div class="login-card fade-in">
        <form id="new-org-form" novalidate autocomplete="on">
          <div class="form-group">
            <label class="form-label" for="org-name">조직명</label>
            <input class="form-input" type="text" id="org-name"
              placeholder="예: 테크스타트업(주)" autocomplete="organization" required>
            <div class="form-error" id="org-name-error" style="display:none">조직명을 입력해 주세요.</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="admin-name">관리자 이름</label>
            <input class="form-input" type="text" id="admin-name"
              placeholder="실명을 입력하세요" autocomplete="name" required>
            <div class="form-error" id="admin-name-error" style="display:none">이름을 입력해 주세요.</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="admin-email">이메일</label>
            <input class="form-input" type="email" id="admin-email"
              placeholder="이메일을 입력하세요" autocomplete="email" inputmode="email" required>
            <div class="form-error" id="admin-email-error" style="display:none">올바른 이메일 주소를 입력해 주세요.</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="admin-pw">비밀번호</label>
            <input class="form-input" type="password" id="admin-pw"
              placeholder="6자 이상" autocomplete="new-password" required>
            <div class="form-error" id="admin-pw-error" style="display:none">비밀번호를 6자 이상 입력해 주세요.</div>
          </div>
          <div id="org-error" class="form-error" style="display:none;margin-bottom:12px"></div>
          <button class="btn btn-primary btn-block btn-lg" type="submit" id="org-btn">조직 생성하기</button>
        </form>
        <div style="margin-top:16px;text-align:center">
          <a href="#" id="back-link"
             style="font-size:0.85rem;color:var(--text-muted);text-decoration:none">← 뒤로</a>
        </div>
      </div>
    </div>`;

  root.querySelector('#back-link').addEventListener('click', e => {
    e.preventDefault();
    renderLocalLanding(root);
  });

  const form     = root.querySelector('#new-org-form');
  const orgNameEl  = root.querySelector('#org-name');
  const adminNameEl = root.querySelector('#admin-name');
  const emailEl  = root.querySelector('#admin-email');
  const pwEl     = root.querySelector('#admin-pw');
  const errEl    = root.querySelector('#org-error');
  const btn      = root.querySelector('#org-btn');

  const fields = [
    [orgNameEl,   '#org-name-error',   v => v.trim().length > 0],
    [adminNameEl, '#admin-name-error', v => v.trim().length > 0],
    [emailEl,     '#admin-email-error',v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())],
    [pwEl,        '#admin-pw-error',   v => v.length >= 6],
  ];

  fields.forEach(([el]) => el.addEventListener('input', () => {
    errEl.style.display = 'none';
    el.classList.remove('error');
    el.closest('.form-group').querySelector('.form-error').style.display = 'none';
  }));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    let valid = true;
    fields.forEach(([el, errSel, check]) => {
      if (!check(el.value)) {
        root.querySelector(errSel).style.display = 'flex';
        el.classList.add('error');
        valid = false;
      }
    });
    if (!valid) return;

    btn.disabled = true;
    btn.textContent = '생성 중…';
    errEl.style.display = 'none';

    try {
      const data = await apiFetch('/api/orgs/register', {
        org_name:       orgNameEl.value.trim(),
        admin_name:     adminNameEl.value.trim(),
        admin_email:    emailEl.value.trim().toLowerCase(),
        admin_password: pwEl.value,
      });

      setToken(data.token);
      setUser(data.user);
      showToast(`${data.org.name} 조직이 생성됐습니다! 🎉`, 'success')
      addNotification({ type: 'success', title: 'register', body: '${data.org.name} 조직이 생성됐습니다! 🎉' });
      window.location.hash = '#/dashboard';
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'flex';
      btn.disabled = false;
      btn.textContent = '조직 생성하기';
    }
  });
}

// ── Local backend: invite code step 1 ────────────────────────────────────────

function renderInviteStep1(root) {
  root.innerHTML = `
    <div class="login-page">
      <div class="login-logo" aria-hidden="true">🔑</div>
      <h1 class="login-title">초대코드 확인</h1>
      <p class="login-subtitle">관리자에게 받은 초대코드를 입력하세요</p>
      <div class="login-card fade-in">
        <form id="invite-form" novalidate>
          <div class="form-group">
            <label class="form-label" for="invite-code">초대코드</label>
            <input class="form-input" type="text" id="invite-code"
              placeholder="8자리 코드" autocomplete="off" required
              style="letter-spacing:0.15em;text-transform:uppercase;font-size:1.1rem">
            <div class="form-error" id="code-error" style="display:none">유효하지 않은 초대코드입니다.</div>
          </div>
          <button class="btn btn-primary btn-block btn-lg" type="submit">다음 →</button>
        </form>
        <div style="margin-top:16px;text-align:center">
          <a href="#" id="back-link"
             style="font-size:0.85rem;color:var(--text-muted);text-decoration:none">← 뒤로</a>
        </div>
      </div>
    </div>`;

  root.querySelector('#back-link').addEventListener('click', e => {
    e.preventDefault();
    renderLocalLanding(root);
  });

  const codeInput = root.querySelector('#invite-code');
  const codeErr   = root.querySelector('#code-error');

  codeInput.addEventListener('input', () => {
    codeErr.style.display = 'none';
    codeInput.classList.remove('error');
    codeInput.value = codeInput.value.toUpperCase();
  });

  root.querySelector('#invite-form').addEventListener('submit', e => {
    e.preventDefault();
    const code = codeInput.value.trim().toUpperCase();
    if (!code) {
      codeErr.style.display = 'flex';
      codeInput.classList.add('error');
      return;
    }
    renderInviteStep2(root, code);
  });
}

// ── Local backend: invite code step 2 ────────────────────────────────────────

function renderInviteStep2(root, inviteToken) {
  root.innerHTML = `
    <div class="login-page">
      <div class="login-logo" aria-hidden="true">📝</div>
      <h1 class="login-title">계정 만들기</h1>
      <p class="login-subtitle">아래 정보를 입력해 계정을 만드세요</p>
      <div class="login-card fade-in">
        <form id="register-form" novalidate autocomplete="on">
          <div class="form-group">
            <label class="form-label" for="reg-name">이름</label>
            <input class="form-input" type="text" id="reg-name"
              placeholder="실명을 입력하세요" autocomplete="name" required>
            <div class="form-error" id="name-error" style="display:none">이름을 입력해 주세요.</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-email">이메일</label>
            <input class="form-input" type="email" id="reg-email"
              placeholder="이메일을 입력하세요" autocomplete="email" inputmode="email" required>
            <div class="form-error" id="email-error" style="display:none">올바른 이메일 주소를 입력해 주세요.</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-pw">비밀번호</label>
            <input class="form-input" type="password" id="reg-pw"
              placeholder="6자 이상" autocomplete="new-password" required>
            <div class="form-error" id="pw-error" style="display:none">비밀번호를 6자 이상 입력해 주세요.</div>
          </div>
          <div id="reg-error" class="form-error" style="display:none;margin-bottom:12px"></div>
          <button class="btn btn-primary btn-block btn-lg" type="submit" id="reg-btn">가입하기</button>
        </form>
        <div style="margin-top:16px;text-align:center">
          <a href="#" id="back-link"
             style="font-size:0.85rem;color:var(--text-muted);text-decoration:none">← 코드 다시 입력</a>
        </div>
      </div>
    </div>`;

  root.querySelector('#back-link').addEventListener('click', e => {
    e.preventDefault();
    renderInviteStep1(root);
  });

  const form    = root.querySelector('#register-form');
  const nameEl  = root.querySelector('#reg-name');
  const emailEl = root.querySelector('#reg-email');
  const pwEl    = root.querySelector('#reg-pw');
  const regErr  = root.querySelector('#reg-error');
  const regBtn  = root.querySelector('#reg-btn');

  [nameEl, emailEl, pwEl].forEach(el => el.addEventListener('input', () => {
    regErr.style.display = 'none';
    el.classList.remove('error');
    el.closest('.form-group').querySelector('.form-error').style.display = 'none';
  }));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name  = nameEl.value.trim();
    const email = emailEl.value.trim().toLowerCase();
    const pw    = pwEl.value;
    let valid   = true;

    if (!name) {
      root.querySelector('#name-error').style.display = 'flex';
      nameEl.classList.add('error');
      valid = false;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      root.querySelector('#email-error').style.display = 'flex';
      emailEl.classList.add('error');
      valid = false;
    }
    if (!pw || pw.length < 6) {
      root.querySelector('#pw-error').style.display = 'flex';
      pwEl.classList.add('error');
      valid = false;
    }
    if (!valid) return;

    regBtn.disabled = true;
    regBtn.textContent = '처리 중…';
    regErr.style.display = 'none';

    try {
      const data = await apiFetch('/api/auth/register', {
        invite_token: inviteToken,
        name,
        email,
        password: pw,
      });

      setToken(data.token);
      setUser(data.user);
      showToast(`환영합니다, ${name}님! 🎉`, 'success')
      addNotification({ type: 'success', title: 'register', body: '환영합니다, ${name}님! 🎉' });
      window.location.hash = STATUS_HOME[data.user.user_status] || '#/dashboard';
    } catch (err) {
      regErr.textContent = err.message;
      regErr.style.display = 'flex';
      regBtn.disabled = false;
      regBtn.textContent = '가입하기';
    }
  });
}

// ── Demo/Supabase mode: original 2-step invite code flow (localStorage) ──────

let _demoProfile = null;

function renderDemoStep1(root) {
  _demoProfile = null;
  root.innerHTML = `
    <div class="login-page">
      <div class="login-logo" aria-hidden="true">🔑</div>
      <h1 class="login-title">회원가입</h1>
      <p class="login-subtitle">초대코드가 있으신 분만 가입할 수 있습니다</p>
      <div class="login-card fade-in">
        <form id="invite-form" novalidate>
          <div class="form-group">
            <label class="form-label" for="invite-code">초대코드</label>
            <input class="form-input" type="text" id="invite-code"
              placeholder="초대코드를 입력하세요" autocomplete="off" required
              style="letter-spacing:0.1em;text-transform:uppercase">
            <div class="form-error" id="code-error" style="display:none">
              유효하지 않은 초대코드입니다. 관리자에게 문의하세요.
            </div>
          </div>
          <button class="btn btn-primary btn-block btn-lg" type="submit">다음 →</button>
        </form>
        <div style="margin-top:20px;text-align:center;font-size:0.85rem;color:var(--text-muted)">
          이미 계정이 있으신가요?
          <a href="#/login" style="color:var(--primary);text-decoration:none;font-weight:600">로그인</a>
        </div>
      </div>
    </div>`;

  const form      = root.querySelector('#invite-form');
  const codeInput = root.querySelector('#invite-code');
  const codeErr   = root.querySelector('#code-error');

  codeInput.addEventListener('input', () => {
    codeErr.style.display = 'none';
    codeInput.classList.remove('error');
    codeInput.value = codeInput.value.toUpperCase();
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const code = codeInput.value.trim().toUpperCase();

    // 1. Hardcoded demo codes
    let profile = DEMO_INVITE_CODES[code];

    // 2. Admin-created codes stored in localStorage
    if (!profile) {
      try {
        const lsTokens = JSON.parse(localStorage.getItem('hr_invite_tokens') || '[]');
        const match = lsTokens.find(t =>
          (t.code || t.token) === code &&
          t.active !== false &&
          (!t.max_uses || (t.uses || 0) < t.max_uses) &&
          (!t.expires_at || new Date(t.expires_at) > new Date())
        );
        if (match) {
          profile = { role: match.role, level_code: match.level_code || 'L2', user_status: match.user_status || 'MEMBER' };
          match.uses = (match.uses || 0) + 1;
          localStorage.setItem('hr_invite_tokens', JSON.stringify(lsTokens));
        }
      } catch {}
    }

    if (!profile) {
      codeErr.style.display = 'flex';
      codeInput.classList.add('error');
      return;
    }
    _demoProfile = profile;
    renderDemoStep2(root, profile);
  });
}

function renderDemoStep2(root, profile) {
  root.innerHTML = `
    <div class="login-page">
      <div class="login-logo" aria-hidden="true">📝</div>
      <h1 class="login-title">계정 만들기</h1>
      <p class="login-subtitle">아래 정보를 입력해 계정을 만드세요</p>
      <div class="login-card fade-in">
        <form id="register-form" novalidate autocomplete="on">
          <div class="form-group">
            <label class="form-label" for="reg-name">이름</label>
            <input class="form-input" type="text" id="reg-name"
              placeholder="실명을 입력하세요" autocomplete="name" required>
            <div class="form-error" id="name-error" style="display:none">이름을 입력해 주세요.</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-email">이메일</label>
            <input class="form-input" type="email" id="reg-email"
              placeholder="이메일을 입력하세요" autocomplete="email" inputmode="email" required>
            <div class="form-error" id="email-error" style="display:none">올바른 이메일 주소를 입력해 주세요.</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-pw">비밀번호</label>
            <input class="form-input" type="password" id="reg-pw"
              placeholder="6자 이상" autocomplete="new-password" required>
            <div class="form-error" id="pw-error" style="display:none">비밀번호를 6자 이상 입력해 주세요.</div>
          </div>
          <div id="reg-error" class="form-error" style="display:none;margin-bottom:12px"></div>
          <button class="btn btn-primary btn-block btn-lg" type="submit" id="reg-btn">가입하기</button>
        </form>
        <div style="margin-top:20px;text-align:center;font-size:0.85rem;color:var(--text-muted)">
          이미 계정이 있으신가요?
          <a href="#/login" style="color:var(--primary);text-decoration:none;font-weight:600">로그인</a>
        </div>
      </div>
    </div>`;

  const form    = root.querySelector('#register-form');
  const nameEl  = root.querySelector('#reg-name');
  const emailEl = root.querySelector('#reg-email');
  const pwEl    = root.querySelector('#reg-pw');
  const regErr  = root.querySelector('#reg-error');
  const regBtn  = root.querySelector('#reg-btn');

  [nameEl, emailEl, pwEl].forEach(el => el.addEventListener('input', () => {
    regErr.style.display = 'none';
    el.classList.remove('error');
    el.closest('.form-group').querySelector('.form-error').style.display = 'none';
  }));

  form.addEventListener('submit', e => {
    e.preventDefault();
    const name  = nameEl.value.trim();
    const email = emailEl.value.trim().toLowerCase();
    const pw    = pwEl.value;
    let valid   = true;

    if (!name) {
      root.querySelector('#name-error').style.display = 'flex';
      nameEl.classList.add('error');
      valid = false;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      root.querySelector('#email-error').style.display = 'flex';
      emailEl.classList.add('error');
      valid = false;
    }
    if (!pw || pw.length < 6) {
      root.querySelector('#pw-error').style.display = 'flex';
      pwEl.classList.add('error');
      valid = false;
    }
    if (!valid) return;

    const users = getLocalUsers();
    if (users.find(u => u.email === email)) {
      regErr.textContent = '이미 사용 중인 이메일입니다.';
      regErr.style.display = 'flex';
      return;
    }

    const newUser = {
      id: `user_${Date.now()}`,
      email,
      name_ko: name,
      org_id: 'ORG001',
      role: profile.role,
      level_code: profile.level_code,
      user_status: profile.user_status,
      _pw: btoa(unescape(encodeURIComponent(pw))),
    };
    users.push(newUser);
    saveLocalUsers(users);

    const token = `local_${newUser.id}`;
    setToken(token);
    const { _pw, ...safeUser } = newUser;
    setUser(safeUser);

    showToast(`환영합니다, ${name}님! 🎉`, 'success')
      addNotification({ type: 'success', title: 'register', body: '환영합니다, ${name}님! 🎉' });
    window.location.hash = STATUS_HOME[profile.user_status] || '#/dashboard';
  });
}
