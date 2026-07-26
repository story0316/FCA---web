/**
 * team-checkin.js — 팀 분위기 체크 모듈
 *
 * 매주 팀 무드를 이모지 5단계로 기록하고 4주 트렌드를 시각화합니다.
 * 이 모듈은 Module System의 표준 인터페이스 실증 목적으로 작성됐습니다.
 *
 * ctx.api는 사용하지 않습니다 (permissions: []).
 * 모든 데이터는 ctx.store(namespaced localStorage)에 저장됩니다.
 */

export const meta = {
  id:          'team-checkin',
  name:        '팀 분위기 체크',
  version:     '1.0.0',
  author:      'system',
  permissions: [],
  description: '주간 팀 무드를 이모지 5단계로 기록하고 트렌드를 확인합니다.',
};

const MOODS = [
  { score: 1, emoji: '😫', label: '힘들어요' },
  { score: 2, emoji: '😔', label: '조금 지쳤어요' },
  { score: 3, emoji: '😐', label: '보통이에요' },
  { score: 4, emoji: '😊', label: '좋아요' },
  { score: 5, emoji: '🤩', label: '최고예요!' },
];

function getWeekKey(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Monday start
  return `w${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function weekLabel(key) {
  // key: w20260603 → "6/3 주"
  const y = parseInt(key.slice(1, 5));
  const m = parseInt(key.slice(5, 7));
  const d = parseInt(key.slice(7, 9));
  return `${m}/${d} 주`;
}

function getLast4Weeks() {
  const weeks = [];
  const now = new Date();
  for (let i = 3; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weeks.push(getWeekKey(d));
  }
  return weeks;
}

let _root = null;
let _ctx  = null;

export async function mount(root, ctx) {
  _root = root;
  _ctx  = ctx;
  render();
}

export function unmount() {
  _root = null;
  _ctx  = null;
}

function render() {
  if (!_root || !_ctx) return;

  const thisWeek      = getWeekKey();
  const myThisWeek    = _ctx.store.get(thisWeek);
  const alreadyDone   = myThisWeek !== null;
  const last4         = getLast4Weeks();
  const history       = last4.map(wk => ({ week: wk, score: _ctx.store.get(wk) }));

  // Build bar chart data
  const maxBarH = 60;
  const bars = history.map(h => {
    const score = h.score;
    const height = score ? Math.round((score / 5) * maxBarH) : 4;
    const mood = MOODS.find(m => m.score === score);
    const color = score
      ? ['#EF4444','#F97316','#EAB308','#22C55E','#3B82F6'][score - 1]
      : 'var(--border)';
    return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1">
        <div style="font-size:0.8rem">${score ? mood.emoji : ''}</div>
        <div style="
          width:32px;height:${height}px;background:${color};
          border-radius:6px 6px 2px 2px;transition:height .3s;
          align-self:flex-end;
        "></div>
        <div style="font-size:0.65rem;color:var(--text-muted)">${weekLabel(h.week)}</div>
      </div>`;
  }).join('');

  _root.innerHTML = `
    <div style="padding:20px;max-width:480px;margin:0 auto">

      <!-- 이번 주 체크인 -->
      <div class="card" style="padding:20px;margin-bottom:16px">
        <h2 style="font-size:1rem;font-weight:700;margin:0 0 4px">
          이번 주 팀 분위기는 어때요?
        </h2>
        <p style="font-size:0.8rem;color:var(--text-muted);margin:0 0 20px">
          ${weekLabel(thisWeek)} · ${alreadyDone ? '이미 제출했어요 ✓ (다시 선택하면 수정됩니다)' : '솔직하게 선택해보세요'}
        </p>

        <div style="display:flex;gap:8px;justify-content:space-between">
          ${MOODS.map(m => `
            <button class="mood-btn" data-score="${m.score}"
              style="
                flex:1;display:flex;flex-direction:column;align-items:center;
                gap:4px;padding:10px 4px;border-radius:12px;cursor:pointer;
                border:2px solid ${myThisWeek === m.score ? 'var(--primary)' : 'var(--border)'};
                background:${myThisWeek === m.score ? 'var(--primary-bg,#EEF2FF)' : 'var(--surface)'};
                font-size:1.6rem;line-height:1;transition:all .15s;
              ">
              ${m.emoji}
              <span style="font-size:0.58rem;color:var(--text-muted);line-height:1.2;text-align:center">
                ${m.label}
              </span>
            </button>
          `).join('')}
        </div>

        ${alreadyDone ? `
          <div style="margin-top:14px;padding:10px 14px;background:var(--primary-bg,#EEF2FF);
                      border-radius:8px;font-size:0.8rem;color:var(--primary);text-align:center">
            ✓ 이번 주 응답 완료 — ${MOODS.find(m => m.score === myThisWeek)?.emoji} ${MOODS.find(m => m.score === myThisWeek)?.label}
          </div>
        ` : ''}
      </div>

      <!-- 4주 트렌드 -->
      <div class="card" style="padding:20px;margin-bottom:16px">
        <h3 style="font-size:0.9rem;font-weight:700;margin:0 0 16px">나의 4주 트렌드</h3>
        <div style="display:flex;align-items:flex-end;gap:8px;height:${maxBarH + 30}px;
                    padding:0 4px">
          ${bars}
        </div>
      </div>

      <!-- 모듈 정보 -->
      <div style="font-size:0.72rem;color:var(--text-muted);text-align:center;padding:8px 0">
        팀원마다 개인 기록이 저장됩니다 · 데이터는 이 기기에만 보관됩니다
      </div>

    </div>`;

  // 무드 버튼 클릭
  _root.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const score = parseInt(btn.dataset.score);
      _ctx.store.set(thisWeek, score);
      const mood = MOODS.find(m => m.score === score);
      _ctx.showToast(`${mood.emoji} ${mood.label} — 저장됐습니다!`, 'success');
      render(); // re-render with updated selection
    });
  });
}
