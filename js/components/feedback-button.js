/**
 * feedback-button.js – Floating in-app feedback button with screen capture
 * - 화면 캡쳐: html2canvas (CDN) → 자동 캡쳐
 * - Fallback: 파일 업로드 (image/*)
 * - Saves screenshot + text to localStorage + Supabase
 */

const LS_KEY        = 'hr_feedbacks';
const H2C_CDN       = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
const MAX_IMG_BYTES = 80 * 1024; // 80KB target for localStorage

let _mounted    = false;
let _btnEl      = null;
let _modalEl    = null;
let _screenshot = null; // base64 data URL

// ── Public API ────────────────────────────────────────────────

export function mountFeedbackButton() {
  if (_mounted) return;
  _mounted = true;

  _btnEl = document.createElement('button');
  _btnEl.id = 'feedback-float-btn';
  _btnEl.setAttribute('aria-label', '피드백 보내기');
  _btnEl.innerHTML = `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  `;
  Object.assign(_btnEl.style, {
    position:       'fixed',
    right:          '16px',
    bottom:         'calc(var(--bottom-nav-height,64px) + var(--safe-bottom,0px) + 16px)',
    zIndex:         '150',
    width:          '44px',
    height:         '44px',
    borderRadius:   '50%',
    background:     'var(--primary,#4F46E5)',
    color:          '#fff',
    border:         'none',
    cursor:         'pointer',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    boxShadow:      '0 4px 16px rgba(79,70,229,0.4)',
    transition:     'transform 0.15s',
    WebkitTapHighlightColor: 'transparent',
  });

  _btnEl.addEventListener('click', openModal);
  _btnEl.addEventListener('mouseenter', () => { _btnEl.style.transform = 'scale(1.1)'; });
  _btnEl.addEventListener('mouseleave', () => { _btnEl.style.transform = ''; });
  document.body.appendChild(_btnEl);
}

export function unmountFeedbackButton() {
  _btnEl?.remove();
  _modalEl?.remove();
  _btnEl = _modalEl = null;
  _mounted = false;
  _screenshot = null;
}

// ── Modal ─────────────────────────────────────────────────────

function openModal() {
  if (_modalEl) return;
  _screenshot = null;

  const overlay = document.createElement('div');
  overlay.id = 'feedback-modal-overlay';
  Object.assign(overlay.style, {
    position:   'fixed',
    inset:      '0',
    zIndex:     '300',
    background: 'rgba(0,0,0,0.55)',
    display:    'flex',
    alignItems: 'flex-end',
  });

  overlay.innerHTML = `
    <div id="feedback-modal" style="
      width:100%;background:var(--surface,#fff);
      border-radius:20px 20px 0 0;
      padding:22px 18px 28px;
      box-shadow:0 -4px 24px rgba(0,0,0,0.15);
      max-height:92vh;overflow-y:auto;
      animation:fbSlideUp 0.25s ease;
    ">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div style="font-weight:700;font-size:1rem;color:var(--text)">💬 피드백 보내기</div>
        <button id="feedback-close-btn" style="
          width:30px;height:30px;border-radius:50%;border:none;
          background:var(--border,#E2E8F0);cursor:pointer;font-size:1rem;
          display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>
      </div>

      <!-- Page info -->
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px">
        📍 <code style="background:var(--bg,#F8FAFC);padding:2px 6px;border-radius:4px;font-size:0.76rem">
          ${escHtml(window.location.hash || '#/')}
        </code>
      </div>

      <!-- Screenshot section -->
      <div style="margin-bottom:12px">
        <div style="font-size:0.8rem;font-weight:700;color:var(--text);margin-bottom:8px">
          📸 화면 캡쳐 <span style="font-weight:400;color:var(--text-muted)">(선택)</span>
        </div>

        <!-- Screenshot preview (hidden until captured/uploaded) -->
        <div id="screenshot-preview" style="display:none;margin-bottom:8px;position:relative">
          <img id="screenshot-img" src="" alt="캡쳐된 화면"
               style="width:100%;border-radius:8px;border:1.5px solid var(--border);
                      max-height:160px;object-fit:cover;display:block" />
          <button id="screenshot-remove-btn" style="
            position:absolute;top:6px;right:6px;
            width:24px;height:24px;border-radius:50%;border:none;
            background:rgba(0,0,0,0.6);color:#fff;cursor:pointer;
            font-size:0.75rem;display:flex;align-items:center;justify-content:center">✕</button>
          <div id="screenshot-size-label" style="
            font-size:0.68rem;color:var(--text-muted);margin-top:4px;text-align:right"></div>
        </div>

        <!-- Capture / upload buttons -->
        <div id="screenshot-actions" style="display:flex;gap:8px">
          <button id="auto-capture-btn" style="
            flex:1;padding:9px 10px;border-radius:var(--radius-sm,8px);
            border:1.5px dashed var(--primary,#4F46E5);
            background:var(--primary-light,#EEF2FF);
            color:var(--primary,#4F46E5);cursor:pointer;
            font-size:0.8rem;font-weight:600;font-family:inherit;
            display:flex;align-items:center;justify-content:center;gap:6px;
            transition:opacity 0.15s">
            <span id="capture-icon">📷</span>
            <span id="capture-label">화면 자동 캡쳐</span>
          </button>
          <label style="
            flex:1;padding:9px 10px;border-radius:var(--radius-sm,8px);
            border:1.5px dashed var(--border,#E2E8F0);
            background:var(--bg,#F8FAFC);
            color:var(--text-muted);cursor:pointer;
            font-size:0.8rem;font-weight:600;
            display:flex;align-items:center;justify-content:center;gap:6px">
            📁 파일 업로드
            <input id="screenshot-file-input" type="file" accept="image/*"
                   style="display:none" />
          </label>
        </div>
      </div>

      <!-- Message textarea -->
      <textarea id="feedback-text" rows="4"
        placeholder="불편한 점, 개선 요청, 아이디어 등 자유롭게 작성해주세요."
        style="width:100%;padding:11px 12px;
               border:1.5px solid var(--border,#E2E8F0);
               border-radius:var(--radius-md,10px);
               font-size:0.85rem;font-family:inherit;
               resize:vertical;background:var(--bg,#F8FAFC);
               color:var(--text);outline:none;
               box-sizing:border-box;min-height:90px;
               margin-bottom:12px">
      </textarea>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <button id="feedback-cancel-btn" class="btn btn-outline btn-block">취소</button>
        <button id="feedback-submit-btn" class="btn btn-primary btn-block">보내기</button>
      </div>
    </div>

    <style>
      @keyframes fbSlideUp {
        from { transform: translateY(100%); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }
    </style>
  `;

  overlay.querySelector('#feedback-close-btn').addEventListener('click', closeModal);
  overlay.querySelector('#feedback-cancel-btn').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  overlay.querySelector('#auto-capture-btn').addEventListener('click', handleAutoCapture);
  overlay.querySelector('#screenshot-file-input').addEventListener('change', handleFileUpload);
  overlay.querySelector('#screenshot-remove-btn').addEventListener('click', removeScreenshot);
  overlay.querySelector('#feedback-submit-btn').addEventListener('click', submitFeedback);

  document.body.appendChild(overlay);
  _modalEl = overlay;
  setTimeout(() => _modalEl?.querySelector('#feedback-text')?.focus(), 50);
}

function closeModal() {
  _modalEl?.remove();
  _modalEl = null;
  _screenshot = null;
}

// ── Auto capture via html2canvas ──────────────────────────────

async function handleAutoCapture() {
  const btn       = _modalEl?.querySelector('#auto-capture-btn');
  const labelEl   = _modalEl?.querySelector('#capture-label');
  const iconEl    = _modalEl?.querySelector('#capture-icon');
  if (!btn) return;

  btn.disabled = true;
  if (iconEl) iconEl.textContent = '⏳';
  if (labelEl) labelEl.textContent = '캡쳐 중...';

  try {
    // Briefly hide the overlay so we capture the page underneath
    if (_modalEl) _modalEl.style.visibility = 'hidden';
    await sleep(80);

    // Load html2canvas on demand
    await loadH2C();

    const appEl = document.querySelector('#app') || document.body;
    const canvas = await window.html2canvas(appEl, {
      logging:     false,
      useCORS:     true,
      allowTaint:  true,
      scale:       0.45,
      imageTimeout: 3000,
    });

    if (_modalEl) _modalEl.style.visibility = '';

    // Compress to JPEG and resize if needed
    const dataUrl = compressCanvas(canvas);
    setScreenshot(dataUrl);

    if (iconEl) iconEl.textContent = '✅';
    if (labelEl) labelEl.textContent = '다시 캡쳐';
  } catch (err) {
    if (_modalEl) _modalEl.style.visibility = '';
    console.warn('[Feedback] auto-capture failed:', err.message);
    if (iconEl) iconEl.textContent = '⚠️';
    if (labelEl) labelEl.textContent = '캡쳐 실패 (파일 업로드 이용)';
  } finally {
    btn.disabled = false;
  }
}

function handleFileUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      // Resize & compress via canvas
      const maxW = 800;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      setScreenshot(compressCanvas(cv));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  // reset input so same file can be re-selected
  e.target.value = '';
}

function removeScreenshot() {
  _screenshot = null;
  const preview = _modalEl?.querySelector('#screenshot-preview');
  const actions = _modalEl?.querySelector('#screenshot-actions');
  const iconEl  = _modalEl?.querySelector('#capture-icon');
  const labelEl = _modalEl?.querySelector('#capture-label');
  if (preview) preview.style.display = 'none';
  if (actions) actions.style.display = 'flex';
  if (iconEl)  iconEl.textContent  = '📷';
  if (labelEl) labelEl.textContent = '화면 자동 캡쳐';
}

function setScreenshot(dataUrl) {
  _screenshot = dataUrl;
  const preview  = _modalEl?.querySelector('#screenshot-preview');
  const imgEl    = _modalEl?.querySelector('#screenshot-img');
  const actions  = _modalEl?.querySelector('#screenshot-actions');
  const sizeLabel= _modalEl?.querySelector('#screenshot-size-label');
  if (imgEl)   imgEl.src = dataUrl;
  if (preview) preview.style.display = 'block';
  if (actions) actions.style.display = 'none';
  if (sizeLabel) {
    const kb = Math.round(dataUrl.length * 0.75 / 1024);
    sizeLabel.textContent = `${kb} KB`;
  }
}

// ── Submit ────────────────────────────────────────────────────

async function submitFeedback() {
  const textarea = _modalEl?.querySelector('#feedback-text');
  const message  = textarea?.value?.trim();
  if (!message) { textarea?.focus(); return; }

  const btn = _modalEl?.querySelector('#feedback-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = '전송 중...'; }

  const entry = {
    id:         crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
    page_hash:  window.location.hash || '#/',
    message,
    screenshot: _screenshot || null,
    created_at: new Date().toISOString(),
  };

  // LocalStorage — store without screenshot if too big
  try {
    const noImg  = { ...entry, screenshot: entry.screenshot ? '[captured]' : null };
    const stored = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    stored.unshift(noImg);
    localStorage.setItem(LS_KEY, JSON.stringify(stored.slice(0, 50)));
  } catch {}

  // Supabase (fire-and-forget)
  try {
    const { api } = await import('../api.js');
    if (api.feedback?.save) await api.feedback.save(entry).catch(() => {});
  } catch {}

  // Success screen
  const modal = _modalEl?.querySelector('#feedback-modal');
  if (modal) {
    modal.innerHTML = `
      <div style="text-align:center;padding:32px 0 16px">
        <div style="font-size:2.8rem;margin-bottom:14px">${_screenshot ? '📸✅' : '✅'}</div>
        <div style="font-weight:700;font-size:1rem;color:var(--text);margin-bottom:6px">피드백 감사합니다!</div>
        <div style="font-size:0.82rem;color:var(--text-muted)">
          ${_screenshot ? '화면 캡쳐와 함께 ' : ''}의견을 잘 받았습니다.
        </div>
      </div>
    `;
    setTimeout(closeModal, 1800);
  }
}

// ── Helpers ───────────────────────────────────────────────────

function loadH2C() {
  return new Promise((resolve, reject) => {
    if (window.html2canvas) { resolve(); return; }
    if (document.querySelector(`script[src="${H2C_CDN}"]`)) {
      // already injected, wait for it
      const check = setInterval(() => {
        if (window.html2canvas) { clearInterval(check); resolve(); }
      }, 50);
      setTimeout(() => { clearInterval(check); reject(new Error('html2canvas timeout')); }, 8000);
      return;
    }
    const s = document.createElement('script');
    s.src = H2C_CDN;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('html2canvas load failed'));
    document.head.appendChild(s);
  });
}

function compressCanvas(canvas) {
  // Try JPEG at decreasing quality until under MAX_IMG_BYTES
  for (const q of [0.5, 0.35, 0.2]) {
    const d = canvas.toDataURL('image/jpeg', q);
    if (d.length * 0.75 <= MAX_IMG_BYTES) return d;
  }
  return canvas.toDataURL('image/jpeg', 0.15);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
