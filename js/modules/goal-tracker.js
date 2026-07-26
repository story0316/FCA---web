/**
 * goal-tracker.js — OKR 진행 현황 모듈
 *
 * 사용자의 목표 목록을 불러와 진행률 바로 표시합니다.
 * ctx.api.getGoals() / ctx.api.saveGoal() 을 사용합니다 (write:goals 권한 필요).
 */

export const meta = {
  id:          'goal-tracker',
  name:        'OKR 진행 현황',
  version:     '1.0.0',
  author:      'system',
  permissions: ['write:goals'],
  description: '나의 OKR 목표와 진행률을 한눈에 확인하고 업데이트합니다.',
};

const CATEGORY_COLORS = {
  '성과': '#3B82F6',
  '성장': '#8B5CF6',
  '협업': '#10B981',
  '기타': '#94A3B8',
};

let _root = null;
let _ctx  = null;

export async function mount(root, ctx) {
  _root = root;
  _ctx  = ctx;
  root.innerHTML = `<div style="padding:20px;text-align:center"><div class="spinner"></div></div>`;
  let goals = [];
  try {
    goals = await ctx.api.getGoals();
  } catch {
    goals = [];
  }
  render(goals);
}

export function unmount() {
  _root = null;
  _ctx  = null;
}

function render(goals) {
  if (!_root) return;

  const totalGoals    = goals.length;
  const doneGoals     = goals.filter(g => (g.progress || 0) >= 1).length;
  const avgProgress   = totalGoals
    ? Math.round(goals.reduce((s, g) => s + (g.progress || 0), 0) / totalGoals * 100)
    : 0;

  _root.innerHTML = `
    <div style="padding:20px;max-width:520px;margin:0 auto">

      <!-- 요약 카드 -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px">
        ${[
          { label: '전체 목표', value: totalGoals, color: '#3B82F6', icon: '🎯' },
          { label: '완료',      value: doneGoals,  color: '#10B981', icon: '✅' },
          { label: '평균 진행', value: `${avgProgress}%`, color: '#F59E0B', icon: '📈' },
        ].map(s => `
          <div class="card" style="padding:14px;text-align:center">
            <div style="font-size:1.4rem;margin-bottom:4px">${s.icon}</div>
            <div style="font-size:1.3rem;font-weight:700;color:${s.color}">${s.value}</div>
            <div style="font-size:0.68rem;color:var(--text-muted)">${s.label}</div>
          </div>`).join('')}
      </div>

      <!-- 목표 목록 -->
      ${totalGoals === 0 ? `
        <div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">
          <div style="font-size:2.5rem;margin-bottom:12px">🎯</div>
          <p style="font-weight:600;margin-bottom:6px">등록된 목표가 없습니다</p>
          <p style="font-size:0.82rem">아래 버튼으로 첫 번째 목표를 추가해보세요.</p>
        </div>
      ` : goals.map((g, i) => {
        const pct   = Math.min(100, Math.round((g.progress || 0) * 100));
        const color = pct >= 80 ? '#10B981' : pct >= 50 ? '#3B82F6' : pct >= 20 ? '#F59E0B' : '#EF4444';
        const cat   = g.category || '기타';
        const catColor = CATEGORY_COLORS[cat] || '#94A3B8';
        return `
          <div class="card" style="padding:16px;margin-bottom:12px" data-goal-idx="${i}">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
              <div>
                <span style="font-size:0.62rem;font-weight:700;padding:2px 7px;border-radius:10px;
                             background:${catColor}22;color:${catColor}">${cat}</span>
                <div style="font-weight:700;font-size:0.92rem;margin-top:5px">${escHtml(g.title || '목표')}</div>
              </div>
              <div style="font-size:1.1rem;font-weight:800;color:${color};min-width:42px;text-align:right">
                ${pct}%
              </div>
            </div>
            ${g.description ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:10px">${escHtml(g.description)}</div>` : ''}
            <div style="background:var(--border);border-radius:4px;height:6px;overflow:hidden;margin-bottom:10px">
              <div style="width:${pct}%;height:100%;background:${color};border-radius:4px;transition:width .4s ease"></div>
            </div>
            <input type="range" class="progress-slider" data-idx="${i}"
                   min="0" max="100" value="${pct}"
                   style="width:100%;accent-color:${color};cursor:pointer">
          </div>`;
      }).join('')}

      <!-- 새 목표 추가 -->
      <div id="add-goal-form" style="display:none" class="card">
        <div style="padding:16px">
          <h3 style="font-size:0.9rem;font-weight:700;margin-bottom:12px">새 목표 추가</h3>
          <input id="goal-title" class="form-input" placeholder="목표 제목" style="width:100%;padding:8px;margin-bottom:8px">
          <input id="goal-desc"  class="form-input" placeholder="설명 (선택)" style="width:100%;padding:8px;margin-bottom:8px">
          <div style="display:flex;gap:8px;margin-bottom:12px">
            <select id="goal-cat" class="form-input" style="flex:1;padding:8px">
              ${Object.keys(CATEGORY_COLORS).map(c => `<option>${c}</option>`).join('')}
            </select>
            <input id="goal-due" class="form-input" type="date" style="flex:1;padding:8px">
          </div>
          <div style="display:flex;gap:8px">
            <button id="cancel-goal" class="btn btn-sm"
                    style="flex:1;background:var(--surface);border:1px solid var(--border)">취소</button>
            <button id="save-goal"   class="btn btn-primary btn-sm" style="flex:1">저장</button>
          </div>
        </div>
      </div>

      <button id="add-goal-btn" class="btn btn-primary"
              style="width:100%;margin-top:8px;padding:12px">
        + 새 목표 추가
      </button>

      <div style="font-size:0.7rem;color:var(--text-muted);text-align:center;margin-top:16px">
        슬라이더를 드래그하면 진행률이 업데이트됩니다
      </div>
    </div>`;

  // Progress sliders
  _root.querySelectorAll('.progress-slider').forEach(slider => {
    slider.addEventListener('change', async () => {
      const idx  = parseInt(slider.dataset.idx);
      const goal = goals[idx];
      if (!goal) return;
      const newPct = parseInt(slider.value);
      goal.progress = newPct / 100;
      try {
        await _ctx.api.saveGoal({ ...goal, progress: goal.progress });
        _ctx.showToast(`진행률 ${newPct}% 저장!`, 'success');
        render(goals);
      } catch {
        _ctx.showToast('저장 실패 — 데모 모드에서는 반영되지 않습니다', 'info');
        render(goals);
      }
    });
  });

  // Add goal toggle
  const addBtn  = _root.querySelector('#add-goal-btn');
  const form    = _root.querySelector('#add-goal-form');
  addBtn?.addEventListener('click', () => {
    form.style.display = '';
    addBtn.style.display = 'none';
  });
  _root.querySelector('#cancel-goal')?.addEventListener('click', () => {
    form.style.display = 'none';
    addBtn.style.display = '';
  });

  _root.querySelector('#save-goal')?.addEventListener('click', async () => {
    const title = _root.querySelector('#goal-title').value.trim();
    if (!title) { _ctx.showToast('목표 제목을 입력해주세요', 'error'); return; }
    const newGoal = {
      title,
      description: _root.querySelector('#goal-desc').value.trim(),
      category:    _root.querySelector('#goal-cat').value,
      due_date:    _root.querySelector('#goal-due').value || null,
      progress:    0,
    };
    try {
      await _ctx.api.saveGoal(newGoal);
      _ctx.showToast('목표가 추가됐습니다!', 'success');
      const updated = await _ctx.api.getGoals().catch(() => [...goals, newGoal]);
      render(updated);
    } catch {
      goals.push(newGoal);
      _ctx.showToast('저장됐습니다 (로컬 임시 저장)', 'info');
      render([...goals]);
    }
  });
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
