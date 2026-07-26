/**
 * form-modal.js — 네이티브 prompt()/confirm() 대체용 인라인 폼 모달
 *
 * showFormModal({ title, fields, confirmLabel })
 *   → Promise<{ [name]: value } | null>  (취소 시 null)
 *
 * field: { name, label, type?, placeholder?, defaultValue?, required?, min?, max? }
 */

let _activeOverlay = null;

export function showFormModal({ title = '', fields = [], confirmLabel = '확인', cancelLabel = '취소' } = {}) {
  _closeActiveModal();

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;
      display:flex;align-items:flex-end;justify-content:center;
    `;

    const fieldHtml = fields.map(f => `
      <div style="margin-bottom:12px">
        <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted,#64748B);margin-bottom:4px">
          ${escHtml(f.label)}${f.required ? ' <span style="color:#EF4444">*</span>' : ''}
        </label>
        ${f.type === 'textarea'
          ? `<textarea name="${escHtml(f.name)}" placeholder="${escHtml(f.placeholder || '')}"
               rows="3" style="${_inputStyle()}">${escHtml(f.defaultValue || '')}</textarea>`
          : `<input name="${escHtml(f.name)}" type="${f.type || 'text'}"
               placeholder="${escHtml(f.placeholder || '')}"
               value="${escHtml(f.defaultValue || '')}"
               ${f.min != null ? `min="${f.min}"` : ''}
               ${f.max != null ? `max="${f.max}"` : ''}
               style="${_inputStyle()}">`
        }
      </div>
    `).join('');

    overlay.innerHTML = `
      <div style="
        background:var(--card-bg,#fff);border-radius:20px 20px 0 0;
        padding:20px;width:100%;max-width:480px;
        box-shadow:0 -4px 24px rgba(0,0,0,.12);
      ">
        <div style="width:36px;height:4px;background:var(--border,#E2E8F0);border-radius:2px;
             margin:0 auto 16px"></div>
        ${title ? `<div style="font-size:15px;font-weight:700;margin-bottom:14px">${escHtml(title)}</div>` : ''}
        <form id="_fm-form">
          ${fieldHtml}
          <div style="display:flex;gap:8px;margin-top:16px">
            <button type="button" id="_fm-cancel" style="${_btnStyle('var(--surface,#F1F5F9)','var(--text,#1E293B)')}">
              ${escHtml(cancelLabel)}
            </button>
            <button type="submit" id="_fm-ok" style="${_btnStyle('var(--primary,#4F46E5)','#fff')}">
              ${escHtml(confirmLabel)}
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);
    _activeOverlay = overlay;

    requestAnimationFrame(() => overlay.querySelector('input,textarea')?.focus());

    const close = (result) => {
      _closeActiveModal();
      resolve(result);
    };

    overlay.querySelector('#_fm-cancel').addEventListener('click', () => close(null));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });

    overlay.querySelector('#_fm-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target;
      const result = {};
      for (const f of fields) {
        const el = form.querySelector(`[name="${f.name}"]`);
        const val = el ? el.value.trim() : '';
        if (f.required && !val) { el?.focus(); return; }
        result[f.name] = val;
      }
      close(result);
    });

    const keyHandler = (e) => {
      if (e.key === 'Escape') { close(null); document.removeEventListener('keydown', keyHandler); }
    };
    document.addEventListener('keydown', keyHandler);
  });
}

function _closeActiveModal() {
  if (_activeOverlay) { _activeOverlay.remove(); _activeOverlay = null; }
}

function _inputStyle() {
  return 'width:100%;padding:9px 12px;border:1.5px solid var(--border,#E2E8F0);' +
         'border-radius:10px;font-size:14px;background:var(--card-bg,#fff);' +
         'color:var(--text,#1E293B);box-sizing:border-box;font-family:inherit;';
}

function _btnStyle(bg, color) {
  return `flex:1;padding:11px;border:none;border-radius:10px;font-size:14px;font-weight:600;` +
         `cursor:pointer;background:${bg};color:${color};`;
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
