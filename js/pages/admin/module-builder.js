/**
 * module-builder.js — AI-assisted module code generator (mock mode)
 *
 * USE_MOCK_AI=true: all code generation is client-side keyword scaffolding.
 * The preview panel uses Blob URL import (same mechanism as module-loader.js).
 */

import { getUser } from '../../auth.js';
import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';
import { validateRuntimeModule } from '../../module-contract.js';

let _root = null;
let _messages = [];
let _generatedCode = '';
let _previewCleanup = null;

// ── Mock code scaffolds ───────────────────────────────────────────────────────

const SCAFFOLDS = {
  goal: (name) => `
export const meta = {
  id:          '${toId(name)}',
  name:        '${name}',
  version:     '1.0.0',
  author:      'custom',
  permissions: ['write:goals'],
  description: '${name} — OKR 목표 진행 현황',
};

export async function mount(root, ctx) {
  root.innerHTML = '<div style="padding:20px"><div class="spinner"></div></div>';
  const goals = await ctx.api.getGoals().catch(() => []);
  render(root, ctx, goals);
}

export function unmount() {}

function render(root, ctx, goals) {
  if (!goals.length) {
    root.innerHTML = \`
      <div style="padding:40px;text-align:center;color:var(--text-muted)">
        <div style="font-size:2rem;margin-bottom:12px">🎯</div>
        <p>등록된 목표가 없습니다.</p>
      </div>\`;
    return;
  }
  root.innerHTML = \`
    <div style="padding:20px;max-width:480px;margin:0 auto">
      <h2 style="font-size:1rem;font-weight:700;margin-bottom:16px">목표 진행 현황</h2>
      \${goals.map(g => {
        const pct = Math.min(100, Math.round((g.progress || 0) * 100));
        const color = pct >= 70 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#EF4444';
        return \`
          <div class="card" style="padding:16px;margin-bottom:12px">
            <div style="font-weight:600;margin-bottom:6px">\${g.title || '목표'}</div>
            <div style="background:var(--border);border-radius:4px;height:8px;overflow:hidden;margin-bottom:6px">
              <div style="width:\${pct}%;height:100%;background:\${color};border-radius:4px;transition:width .4s"></div>
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);display:flex;justify-content:space-between">
              <span>\${g.category || ''}</span><span>\${pct}%</span>
            </div>
          </div>\`;
      }).join('')}
    </div>\`;
}`.trim(),

  survey: (name) => `
export const meta = {
  id:          '${toId(name)}',
  name:        '${name}',
  version:     '1.0.0',
  author:      'custom',
  permissions: ['write:surveys'],
  description: '${name} — 간단 서베이',
};

const QUESTIONS = [
  { id: 'q1', text: '오늘 업무 만족도는?', type: 'scale' },
  { id: 'q2', text: '팀 협업은 원활했나요?', type: 'scale' },
  { id: 'q3', text: '개선이 필요한 점은?', type: 'text' },
];

export async function mount(root, ctx) {
  render(root, ctx);
}

export function unmount() {}

function render(root, ctx) {
  const saved = ctx.store.get('last_response') || {};
  root.innerHTML = \`
    <div style="padding:20px;max-width:480px;margin:0 auto">
      <h2 style="font-size:1rem;font-weight:700;margin-bottom:16px">\${meta.name}</h2>
      \${QUESTIONS.map(q => \`
        <div class="card" style="padding:16px;margin-bottom:12px">
          <p style="font-weight:600;margin-bottom:10px">\${q.text}</p>
          \${q.type === 'scale'
            ? '<div style="display:flex;gap:8px;justify-content:space-between">'
              + [1,2,3,4,5].map(v => \`<button class="scale-btn" data-qid="\${q.id}" data-val="\${v}"
                  style="flex:1;padding:8px;border-radius:8px;cursor:pointer;font-weight:700;
                         border:2px solid \${saved[q.id]===v?'var(--primary)':'var(--border)'};
                         background:\${saved[q.id]===v?'var(--primary-bg,#EEF2FF)':'var(--surface)'}">\${v}</button>\`).join('')
              + '</div>'
            : \`<textarea class="form-input text-answer" data-qid="\${q.id}"
                  style="width:100%;padding:8px;resize:vertical;min-height:60px"
                  placeholder="자유롭게 입력하세요">\${saved[q.id] || ''}</textarea>\`}
        </div>\`).join('')}
      <button id="submit-survey" class="btn btn-primary" style="width:100%;margin-top:8px">제출</button>
      \${saved._submitted ? '<p style="text-align:center;margin-top:12px;color:#10B981;font-size:0.85rem">✓ 이미 제출됐습니다</p>' : ''}
    </div>\`;

  root.querySelectorAll('.scale-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const upd = ctx.store.get('last_response') || {};
      upd[btn.dataset.qid] = parseInt(btn.dataset.val);
      ctx.store.set('last_response', upd);
      render(root, ctx);
    });
  });

  root.querySelector('#submit-survey')?.addEventListener('click', () => {
    const resp = ctx.store.get('last_response') || {};
    QUESTIONS.filter(q => q.type === 'text').forEach(q => {
      const ta = root.querySelector(\`.text-answer[data-qid="\${q.id}"]\`);
      if (ta) resp[q.id] = ta.value;
    });
    resp._submitted = true;
    ctx.store.set('last_response', resp);
    ctx.showToast('서베이가 제출됐습니다!', 'success')
      addNotification({ type: 'success', title: 'Module Builder (관리자)', body: '서베이가 제출됐습니다!' });
    render(root, ctx);
  });
}`.trim(),

  checkin: (name) => `
export const meta = {
  id:          '${toId(name)}',
  name:        '${name}',
  version:     '1.0.0',
  author:      'custom',
  permissions: [],
  description: '${name} — 주간 체크인',
};

export async function mount(root, ctx) {
  render(root, ctx);
}

export function unmount() {}

function render(root, ctx) {
  const today  = new Date().toISOString().slice(0, 10);
  const saved  = ctx.store.get(today);
  root.innerHTML = \`
    <div style="padding:20px;max-width:480px;margin:0 auto">
      <div class="card" style="padding:20px">
        <h2 style="font-size:1rem;font-weight:700;margin-bottom:4px">\${meta.name}</h2>
        <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:16px">오늘의 상태를 기록하세요</p>
        <textarea id="checkin-text" class="form-input"
          style="width:100%;padding:12px;resize:vertical;min-height:100px"
          placeholder="오늘 진행한 업무, 느낀 점, 내일 계획...">\${saved || ''}</textarea>
        <button id="save-btn" class="btn btn-primary" style="width:100%;margin-top:12px">저장</button>
        \${saved ? '<p style="text-align:center;margin-top:10px;color:#10B981;font-size:0.8rem">✓ 오늘 기록 완료</p>' : ''}
      </div>
    </div>\`;

  root.querySelector('#save-btn')?.addEventListener('click', () => {
    const text = root.querySelector('#checkin-text').value.trim();
    if (!text) return ctx.showToast('내용을 입력해주세요', 'error');
    ctx.store.set(today, text);
    ctx.showToast('저장됐습니다!', 'success')
      addNotification({ type: 'success', title: 'Module Builder (관리자)', body: '저장됐습니다!' });
    render(root, ctx);
  });
}`.trim(),

  default: (name) => `
export const meta = {
  id:          '${toId(name)}',
  name:        '${name}',
  version:     '1.0.0',
  author:      'custom',
  permissions: [],
  description: '${name}',
};

export async function mount(root, ctx) {
  root.innerHTML = \`
    <div style="padding:40px;text-align:center">
      <div style="font-size:3rem;margin-bottom:16px">🧩</div>
      <h2 style="font-size:1.1rem;font-weight:700;margin-bottom:8px">\${meta.name}</h2>
      <p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:24px">
        모듈이 준비됐습니다. 아래 버튼을 클릭해보세요.
      </p>
      <button id="hello-btn" class="btn btn-primary">👋 안녕하세요!</button>
    </div>\`;

  root.querySelector('#hello-btn')?.addEventListener('click', () => {
    ctx.showToast('모듈이 작동 중입니다!', 'success')
      addNotification({ type: 'success', title: 'Module Builder (관리자)', body: '모듈이 작동 중입니다!' });
  });
}

export function unmount() {}`.trim(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toId(name) {
  const ascii = name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  if (ascii) return ascii;

  const hash = Array.from(name).reduce(
    (value, char) => ((value * 31) + char.codePointAt(0)) >>> 0,
    2166136261,
  );
  return `custom-${hash.toString(36)}`;
}

function isLocalBackend() {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

function mockGenerate(prompt) {
  const p = prompt.toLowerCase();
  const name = prompt.trim().slice(0, 30) || '새 모듈';

  if (p.includes('okr') || p.includes('목표') || p.includes('goal'))
    return { code: SCAFFOLDS.goal(name), type: 'goal' };
  if (p.includes('설문') || p.includes('서베이') || p.includes('survey'))
    return { code: SCAFFOLDS.survey(name), type: 'survey' };
  if (p.includes('체크인') || p.includes('checkin') || p.includes('일지') || p.includes('직원') || p.includes('팀'))
    return { code: SCAFFOLDS.checkin(name), type: 'checkin' };
  return { code: SCAFFOLDS.default(name), type: 'default' };
}

// ── Preview ───────────────────────────────────────────────────────────────────

async function runPreview(code, container) {
  if (_previewCleanup) {
    try { _previewCleanup(); } catch {}
    _previewCleanup = null;
  }
  container.innerHTML = '<div style="display:flex;align-items:center;gap:8px;color:var(--text-muted);font-size:0.85rem;padding:16px"><div class="spinner"></div> 프리뷰 렌더링 중…</div>';

  try {
    const blob = new Blob([code], { type: 'text/javascript' });
    const url  = URL.createObjectURL(blob);
    let mod;
    try {
      mod = await import(url);
    } finally {
      URL.revokeObjectURL(url);
    }

    validateRuntimeModule(mod.meta?.id || 'preview-module', mod);

    const user = getUser() || {};
    const ns   = `preview_${Date.now()}_`;
    const ctx  = {
      user,
      api: {},
      store: {
        get:    key => { try { return JSON.parse(localStorage.getItem(ns + key)); } catch { return null; } },
        set:    (key, val) => localStorage.setItem(ns + key, JSON.stringify(val)),
        remove: key => localStorage.removeItem(ns + key),
        keys:   () => Object.keys(localStorage).filter(k => k.startsWith(ns)).map(k => k.slice(ns.length)),
      },
      navigate: () => {},
      showToast: (msg, type) => import('../../components/toast.js').then(m => m.showToast(msg, type)),
    };

    container.innerHTML = '';
    await mod.mount(container, ctx);

    _previewCleanup = () => {
      if (typeof mod.unmount === 'function') try { mod.unmount(); } catch {}
      Object.keys(localStorage).filter(k => k.startsWith(ns)).forEach(k => localStorage.removeItem(k));
    };
  } catch (err) {
    container.innerHTML = `
      <div style="padding:16px;color:#EF4444;font-size:0.82rem;font-family:monospace;
                  background:var(--surface);border-radius:8px;border:1px solid #FCA5A5">
        ⚠️ ${err.message}
      </div>`;
  }
}

// ── Render ───────────────────────────────────────────────────────────────────

export async function mount(root) {
  _root = root;
  _messages = [];
  _generatedCode = '';

  root.innerHTML = `
    <div style="display:flex;height:calc(100vh - 110px);overflow:hidden">

      <!-- Left: chat panel -->
      <div style="width:360px;flex-shrink:0;display:flex;flex-direction:column;
                  border-right:1px solid var(--border)">
        <div style="padding:14px 16px;border-bottom:1px solid var(--border);
                    font-weight:700;font-size:0.9rem">
          🏗️ 모듈 빌더
          <span style="font-size:0.7rem;font-weight:400;color:var(--text-muted);margin-left:6px">
            Mock AI (USE_MOCK_AI=true)
          </span>
        </div>

        <div id="chat-history" style="flex:1;overflow-y:auto;padding:12px;
                                      display:flex;flex-direction:column;gap:10px">
          <div style="padding:12px;background:var(--primary-bg,#EEF2FF);
                      border-radius:10px;font-size:0.83rem;color:var(--primary)">
            원하는 모듈을 설명해주세요.<br>
            예: "OKR 목표 관리", "주간 체크인", "팀 설문"
          </div>
        </div>

        <div style="padding:10px;border-top:1px solid var(--border);display:flex;gap:8px">
          <input id="chat-input" class="form-input" placeholder="모듈 설명을 입력하세요"
                 style="flex:1;padding:8px 12px;font-size:0.85rem">
          <button id="generate-btn" class="btn btn-primary"
                  style="padding:8px 14px;font-size:0.85rem;white-space:nowrap">
            생성
          </button>
        </div>
      </div>

      <!-- Right: code + preview -->
      <div style="flex:1;display:flex;flex-direction:column;overflow:hidden">

        <!-- Code editor area -->
        <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;
                    border-bottom:1px solid var(--border)">
          <div style="padding:10px 14px;border-bottom:1px solid var(--border);
                      display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:0.82rem;font-weight:600;color:var(--text-muted)">📝 코드</span>
            <div style="display:flex;gap:6px">
              <button id="preview-btn" class="btn btn-sm"
                      style="font-size:0.75rem;padding:5px 10px;
                             background:var(--surface);border:1px solid var(--border)">
                ▶ 프리뷰
              </button>
              <button id="save-btn" class="btn btn-primary btn-sm"
                      style="font-size:0.75rem;padding:5px 10px" disabled>
                💾 저장
              </button>
            </div>
          </div>
          <textarea id="code-editor"
            style="flex:1;width:100%;padding:14px;font-family:monospace;font-size:0.78rem;
                   line-height:1.6;background:var(--bg);color:var(--text);
                   border:none;resize:none;outline:none;tab-size:2"
            placeholder="← 채팅에서 모듈을 생성하면 여기에 코드가 표시됩니다"
            spellcheck="false"></textarea>
        </div>

        <!-- Live preview area -->
        <div style="flex:1;overflow-y:auto;background:var(--bg)">
          <div style="padding:10px 14px;border-bottom:1px solid var(--border)">
            <span style="font-size:0.82rem;font-weight:600;color:var(--text-muted)">👁 라이브 프리뷰</span>
          </div>
          <div id="preview-container" style="min-height:200px;padding:0">
            <div style="padding:32px;text-align:center;color:var(--text-muted);font-size:0.85rem">
              코드를 생성하고 ▶ 프리뷰를 클릭하세요
            </div>
          </div>
        </div>
      </div>
    </div>`;

  const chatHistory  = root.querySelector('#chat-history');
  const chatInput    = root.querySelector('#chat-input');
  const generateBtn  = root.querySelector('#generate-btn');
  const codeEditor   = root.querySelector('#code-editor');
  const previewBtn   = root.querySelector('#preview-btn');
  const saveBtn      = root.querySelector('#save-btn');
  const previewCont  = root.querySelector('#preview-container');

  function addMessage(role, text) {
    const el = document.createElement('div');
    el.style.cssText = role === 'user'
      ? 'align-self:flex-end;background:var(--primary);color:#fff;border-radius:10px 10px 2px 10px;padding:10px 14px;font-size:0.83rem;max-width:85%'
      : 'background:var(--surface);border:1px solid var(--border);border-radius:10px 10px 10px 2px;padding:10px 14px;font-size:0.83rem;max-width:85%';
    el.textContent = text;
    chatHistory.appendChild(el);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  async function handleGenerate() {
    const prompt = chatInput.value.trim();
    if (!prompt) return;
    chatInput.value = '';

    addMessage('user', prompt);
    generateBtn.disabled = true;
    generateBtn.textContent = '생성 중…';

    await new Promise(r => setTimeout(r, 600)); // mock delay

    const { code, type } = mockGenerate(prompt);
    _generatedCode = code;

    const typeLabels = { goal: 'OKR 목표 모듈', survey: '서베이 모듈', checkin: '체크인 모듈', default: '기본 모듈' };
    addMessage('ai', `✅ ${typeLabels[type]}을 생성했습니다! 코드를 확인하고 프리뷰를 눌러 동작을 확인해보세요.`);

    codeEditor.value = code;
    saveBtn.disabled = false;

    generateBtn.disabled = false;
    generateBtn.textContent = '생성';
  }

  generateBtn.addEventListener('click', handleGenerate);
  chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } });

  codeEditor.addEventListener('input', () => {
    _generatedCode = codeEditor.value;
    saveBtn.disabled = !_generatedCode.trim();
  });

  previewBtn.addEventListener('click', () => {
    const code = codeEditor.value.trim();
    if (!code) return showToast('코드를 먼저 생성해주세요', 'error');
    runPreview(code, previewCont);
  });

  saveBtn.addEventListener('click', async () => {
    const code = codeEditor.value.trim();
    if (!code) return;

    if (!isLocalBackend()) {
      showToast('로컬 백엔드에서만 저장할 수 있습니다', 'error');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중…';

    try {
      let metaObj = {};
      const match = code.match(/export\s+const\s+meta\s*=\s*(\{[\s\S]*?\});/);
      if (match) {
        try { metaObj = eval(`(${match[1]})`); } catch {}
      }

      const token = localStorage.getItem('hr_token');
      const r = await fetch('/api/modules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          id:          metaObj.id || `custom-${Date.now()}`,
          name:        metaObj.name || '새 모듈',
          description: metaObj.description || '',
          code,
          meta: {
            version: metaObj.version || '1.0.0',
            permissions: metaObj.permissions || [],
          },
          status:      'active',
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || '저장 실패');
      showToast('모듈이 저장됐습니다!', 'success')
      addNotification({ type: 'success', title: 'Module Builder (관리자)', body: '모듈이 저장됐습니다!' });
      addMessage('ai', `✅ 모듈이 저장됐습니다. 모듈 마켓플레이스(#/modules)에서 확인하세요.`);
    } catch (err) {
      showToast(err.message, 'error');
    }

    saveBtn.disabled = false;
    saveBtn.textContent = '💾 저장';
  });
}

export function unmount() {
  if (_previewCleanup) {
    try { _previewCleanup(); } catch {}
    _previewCleanup = null;
  }
  _root = null;
  _messages = [];
  _generatedCode = '';
}
