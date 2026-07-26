/**
 * ai_consult.js — AI 노무·인사 상담 페이지
 * Phase 135: 카테고리 탭 + KB 매칭 강화 + 빠른 질문 칩
 */

import {getUser, isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js'
import { addNotification } from '../components/notification-hub.js';
import { KB_50 } from '../data/labor-law-kb-50.js';

let _root = null;

const LS_HISTORY = 'hr_ai_consult_history';

// ── 카테고리 정의 ───────────────────────────────────────────
const CATEGORIES = [
  { id: 'all',    label: '전체',     icon: '💬' },
  { id: 'time',   label: '근태·휴가', icon: '⏱️' },
  { id: 'fire',   label: '해고·징계', icon: '⚖️' },
  { id: 'wage',   label: '임금·급여', icon: '💰' },
  { id: 'ins',    label: '4대보험',   icon: '🛡️' },
  { id: 'contract', label: '근로계약', icon: '📄' },
];

// ── Mock AI 지식베이스 ────────────────────────────────────
const KB = [
  {
    category: 'wage',
    tags: ['퇴직금', '퇴직', 'severance'],
    q: '퇴직금 계산법을 알려주세요.',
    a: `**퇴직금 계산 기준** (근로자퇴직급여보장법 제8조)

퇴직금 = **평균임금 × 30일 × (재직일수 / 365)**

**평균임금**: 퇴직 전 3개월 총 임금 ÷ 3개월 총 일수

> 예시: 월 300만원 × 3개월 = 900만원, 92일 기준
> 평균임금 = 900만 ÷ 92 ≈ 97,826원/일
> 재직 2년 → 퇴직금 ≈ 97,826 × 30 × (730/365) ≈ **5,869,560원**

**주의사항**
- 1년 이상 근무 + 주 15시간 이상 근무 요건 충족 필요
- 수습기간도 재직기간에 포함됩니다
- 퇴직일로부터 **14일 이내** 지급 의무

복잡한 케이스(분할 지급, 중간정산 등)는 전문 노무사 확인을 권장합니다.`
  },
  {
    category: 'time',
    tags: ['연차', '연차휴가', '유급휴가', '연차수당'],
    q: '연차 일수와 수당 계산법은?',
    a: `**연차휴가 발생 기준** (근로기준법 제60조)

| 근속기간 | 연차일수 |
|---------|---------|
| 1년 미만 | 매 개근 1개월마다 1일 (최대 11일) |
| 1년 이상 | 15일 |
| 3년 이상 | 15일 + 2년마다 1일 추가 (최대 25일) |

**연차수당 = 통상임금 × 미사용 연차일수**
- 통상임금: 기본급 + 고정 수당 (식대, 직책수당 등 포함 여부 주의)
- 연차 사용 촉진 제도 시행 시 미사용 수당 면제 가능

**1년 미만 연차**: 입사 첫 해는 월 1개씩 발생, 이듬해 15일에서 차감합니다.`
  },
  {
    category: 'fire',
    tags: ['해고', '정리해고', '해고예고', '권고사직'],
    q: '해고 절차와 해고예고 기준은?',
    a: `**해고 관련 핵심 규정**

**해고예고** (근로기준법 제26조)
- 해고 **30일 전** 서면 통보 의무
- 미이행 시 **30일분 통상임금**을 해고예고수당으로 지급
- 예외: 천재지변, 귀책사유 있는 근로자, 수습기간 3개월 이내

**부당해고 구제**
- 해고가 부당하다고 판단 시 **3개월 이내** 노동위원회에 구제신청
- 복직 또는 금전 보상 명령 가능

**정리해고 요건** (제24조) — 4가지 모두 충족 필요
1. 긴박한 경영상 필요
2. 해고 회피 노력
3. 합리적·공정한 기준에 따른 대상자 선정
4. 노동조합·근로자 대표와 50일 전 협의

⚠️ **해고는 반드시 서면으로** 이유를 명시해야 합니다.`
  },
  {
    category: 'time',
    tags: ['야근', '시간외수당', '초과근무', '주52시간', '연장근무'],
    q: '야근·초과근무 수당 계산법은?',
    a: `**초과근무 수당** (근로기준법 제56조)

| 구분 | 할증률 |
|------|-------|
| 연장근로 (주 40시간 초과) | **통상임금 × 50%** 가산 |
| 야간근로 (22:00~06:00) | **통상임금 × 50%** 가산 |
| 휴일근로 (8시간 이내) | **통상임금 × 50%** 가산 |
| 휴일근로 (8시간 초과) | **통상임금 × 100%** 가산 |

**주 52시간 상한제**
- 법정근로 40시간 + 연장근로 최대 12시간 = **주 52시간**
- 5인 미만 사업장은 일부 규정 예외 적용

**포괄임금제** 유효성 논란: 실제 초과근무 시간이 포괄 범위를 초과하면 추가 지급 의무가 발생합니다.`
  },
  {
    category: 'ins',
    tags: ['4대보험', '사회보험', '건강보험', '국민연금', '고용보험', '산재'],
    q: '4대보험 사업주 부담률은?',
    a: `**4대 보험 요율 (2026년 기준)**

| 보험 | 근로자 | 사업주 |
|------|--------|--------|
| 국민연금 | 4.5% | 4.5% |
| 건강보험 | 3.545% | 3.545% |
| 장기요양 | 건강보험료의 12.95% | 동일 |
| 고용보험 | 0.9% | 0.9~1.65% (규모별) |
| 산재보험 | - | 업종별 상이 (평균 1.47%) |

**총 사업주 부담**: 급여의 약 **10~12%** 수준

**참고**
- 두루누리 지원사업: 10인 미만 사업장, 월급 270만원 미만 근로자 → 보험료 80% 지원
- 신규 채용 시 고용보험 가입 신고는 입사일로부터 **14일 이내**`
  },
  {
    category: 'wage',
    tags: ['최저임금', '주휴수당', '시급', '최저'],
    q: '최저임금과 주휴수당 계산법은?',
    a: `**최저임금 (2026년)**
- 시급: **10,030원**
- 월급 환산 (주 40시간, 월 209시간): **2,096,270원**

**주휴수당** — 주 15시간 이상 근무 + 개근 시 지급 의무
- 주휴수당 = **1일 소정근로시간 × 시급**
- 주 5일 × 8시간 근무자: 8시간 × 10,030 = **80,240원/주**

**시급 계산 시 주의**
주휴수당 포함 월 환산: (주 40시간 + 주휴 8시간) × 4.345주 = **209시간**
→ 최저 월급 = 10,030 × 209 = **2,096,270원**

주휴수당 미지급은 근로기준법 위반으로 **3년 이하 징역 또는 3천만원 이하 벌금**`
  },
  {
    category: 'contract',
    tags: ['계약직', '기간제', '무기계약직', '계약갱신', '촉탁'],
    q: '기간제 근로자 무기계약 전환 기준은?',
    a: `**기간제 근로자 보호** (기간제법 제4조)

**2년 초과 시 무기계약 전환**
- 동일 사업장에서 2년 초과 계속 고용 시 **기간의 정함이 없는 근로계약** 체결한 것으로 간주
- 예외: 만 55세 이상, 전문직, 특정 기간·사업 완료를 위한 경우

**계약 갱신 거절 시**
- 근로자가 갱신 기대권을 가질 정당한 사유가 있는 경우 부당해고에 준하여 구제 가능
- 계약 만료 전 갱신 여부를 **명시적으로 통보**하는 것이 분쟁 예방에 유리

**파견근로** 구분: 파견법상 허용 업종 외 파견은 직접고용 의무 발생 가능

계약서 작성 시 근무기간, 업무 범위, 임금, 갱신 조건을 반드시 명시하세요.`
  },
  {
    category: 'fire',
    tags: ['성희롱', '직장내괴롭힘', '괴롭힘', '고충', '징계'],
    q: '직장 내 괴롭힘·성희롱 처리 절차는?',
    a: `**직장 내 괴롭힘** (근로기준법 제76조의2)

**사업주 의무**
1. 신고 접수 즉시 **조사 실시** 의무
2. 피해자 보호 조치 (근무 장소 변경, 유급휴가 등)
3. 행위자에 대한 **징계 등 필요한 조치**
4. 피해자에게 불이익 처우 금지

**조사 절차**
신고 접수 → 당사자 분리 → 사실관계 조사 → 조치 결정 → 결과 통보

**직장 내 성희롱** (남녀고용평등법 제12조)
- 고충 처리 창구 운영 의무 (10인 이상)
- 성희롱 예방 교육 연 1회 이상 실시 의무
- 피해자 불이익 조치 시 **500만원 이하 과태료**

⚠️ 신고자·피해자에 대한 불이익 처우는 별도 처벌 대상입니다.`
  },
  {
    category: 'contract',
    tags: ['취업규칙', '취규', '취업규칙변경', '사규'],
    q: '취업규칙 변경 절차는?',
    a: `**취업규칙** (근로기준법 제93조~97조)

**작성·신고 의무**: 상시 10인 이상 사업장

**변경 절차**
- **유리한 변경**: 과반수 노조(없으면 근로자 과반수)의 **의견 청취** 후 신고
- **불리한 변경**: 과반수 노조(없으면 근로자 과반수)의 **동의** 필요

**동의 없는 불리한 변경**
- 원칙적으로 효력 없음
- 예외: 사회통념상 합리성 인정 시 유효 가능 (판례 상 제한적)

**신고 기관**: 관할 고용노동지청에 변경 후 즉시 신고

취업규칙 내 징계 조항, 임금 체계 변경 등은 분쟁 가능성이 높으므로 **변경 전 노무사 검토**를 권장합니다.`
  },
  {
    category: 'contract',
    tags: ['근로계약서', '근로계약', '서면계약', '계약서'],
    q: '근로계약서 필수 기재 사항은?',
    a: `**근로계약서 필수 기재 사항** (근로기준법 제17조)

**반드시 서면으로 명시해야 할 항목**
1. 임금 (구성항목, 계산방법, 지급방법)
2. 소정근로시간
3. 주휴일 등 휴일
4. 연차유급휴가
5. 취업 장소 및 업무 내용

**서면 미교부 시**: 500만원 이하 과태료

**기간제·단시간 근로자 추가 기재**
- 계약 기간
- 근로일 및 근로일별 근로시간 (단시간)

**전자 근로계약서**: 전자서명법에 따라 전자 방식으로도 체결 가능

근로계약서는 **입사일 전 또는 당일**에 작성·교부해야 합니다.`
  },
  {
    category: 'time',
    tags: ['육아휴직', '출산휴가', '모성보호', '육아기', '임신'],
    q: '육아휴직·출산휴가 관련 규정은?',
    a: `**출산휴가** (남녀고용평등법 제18조·근로기준법 제74조)

**출산전후휴가**
- 기간: 총 **90일** (다태아 120일)
- 최초 60일은 유급 (사업주 부담)
- 나머지 30일은 고용보험에서 급여 지급

**육아휴직** (남녀고용평등법 제19조)
- 대상: 만 8세 이하 또는 초등학교 2학년 이하 자녀
- 기간: 자녀 1인당 **최대 1년** (부모 각각 1년)
- 급여: 통상임금의 **80%** (상한 150만원, 하한 70만원)

**사업주 의무**
- 육아휴직 거부 불가 (1명 이상 사업장)
- 복직 시 동일 업무 또는 동등 수준 부여 의무
- 불이익 처우 금지

육아기 근로시간 단축도 별도 신청 가능합니다 (주 15~35시간).`
  },
  {
    category: 'wage',
    tags: ['급여명세서', '임금명세서', '명세서', '급여내역'],
    q: '임금명세서 교부 의무가 있나요?',
    a: `**임금명세서 교부 의무** (근로기준법 제48조, 2021.11.19. 시행)

**모든 사업장** (사업장 규모 무관) 의무 적용

**필수 기재 항목**
- 근로자 성명, 생년월일, 사원번호 등 식별 정보
- 임금 지급일
- 임금 총액
- 기본급, 각종 수당, 공제 항목 및 금액
- 실지급액

**교부 방법**: 서면 또는 전자 방법 (이메일·앱 등)

**미교부 시**: 500만원 이하 과태료

임금명세서는 **임금 지급 시마다** 교부해야 합니다.`
  },
  {
    category: 'time',
    tags: ['재택근무', '원격근무', '재택', '유연근무'],
    q: '재택근무 시 근태 관리 방법은?',
    a: `**재택근무(원격근무) 근태 관리**

**법적 근거**: 근로기준법상 별도 규정 없음 → 취업규칙 또는 별도 규정으로 정함

**권장 관리 방법**
- 출·퇴근 시간 기록: 사내 시스템, 메신저 로그인 등
- 업무 일지 또는 일일 보고 제도 운영
- 화상회의 출석 등 실근무 확인 수단 병행

**재택근무 수당**
- 법정 의무 없음, 단 취업규칙·계약에 명시 시 지급 의무 발생
- 통신비·전기료 실비 지원은 비과세 혜택 가능

**주의 사항**
- 재택 중에도 초과근무 수당 지급 의무는 동일 적용
- 업무 지시·감독 가능한 범위에서만 재택근무 적법성 인정`
  },
  ...KB_50,
];

const DISCLAIMER = `\n\n---\n*이 답변은 일반적인 법령 정보를 기반으로 한 AI 안내이며, 법적 효력을 갖는 자문이 아닙니다. 개별 케이스는 반드시 전문 노무사와 확인하세요.*`;

const FALLBACK = `죄송합니다, 해당 질문에 대한 정확한 답변 데이터가 부족합니다.

**관련 상담 채널**
- 고용노동부 고객상담센터: **1350** (평일 09:00~18:00)
- 노동청 방문 상담: 전국 48개 지청
- 공인노무사 매칭: [전국 공인노무사회](https://www.kcplaa.or.kr)

자주 묻는 질문을 선택하시거나 카테고리 탭을 눌러 관련 주제를 확인해 보세요.`;

// ── KB 매칭 (상위 2개 관련 답변 반환) ───────────────────
function matchKB(query, categoryFilter) {
  const q = query.toLowerCase();
  const pool = categoryFilter && categoryFilter !== 'all'
    ? KB.filter(item => item.category === categoryFilter)
    : KB;

  const scored = pool
    .map(item => {
      const matchCount = item.tags.filter(tag => q.includes(tag.toLowerCase())).length;
      const inAnswer = item.a && q.split(/\s+/).some(w => w.length > 1 && item.a.toLowerCase().includes(w)) ? 0.5 : 0;
      return { item, score: matchCount + inAnswer };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return null;

  if (scored.length === 1) return scored[0].item.a + DISCLAIMER;

  const top = scored.slice(0, 2);
  if (top[0].score === top[1].score || top[1].score >= top[0].score * 0.7) {
    return top.map(x => x.item.a).join('\n\n---\n\n') + DISCLAIMER;
  }
  return top[0].item.a + DISCLAIMER;
}

// ── History helpers ──────────────────────────────────────
function getHistory() {
  try { return JSON.parse(localStorage.getItem(LS_HISTORY) || '[]'); } catch { return []; }
}

function saveHistory(msgs) {
  try { localStorage.setItem(LS_HISTORY, JSON.stringify(msgs.slice(-60))); } catch {}
}

// ── Markdown-lite renderer ───────────────────────────────
function md(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--surface);padding:1px 5px;border-radius:4px;font-size:0.8em">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^#{1,3}\s+(.+)/gm, '<strong style="font-size:0.92rem;display:block;margin-top:4px">$1</strong>')
    .replace(/^\| (.+)/gm, (_, row) => {
      const cells = row.split('|').map(c => c.trim());
      const cols = cells.length;
      return `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px;font-size:0.78rem;padding:3px 0;border-bottom:1px solid var(--border)">${cells.map(c => `<span>${c}</span>`).join('')}</div>`;
    })
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:8px 0">')
    .replace(/^\d+\. (.+)/gm, '<div style="padding-left:12px;margin:2px 0">• $1</div>')
    .replace(/\n/g, '<br>');
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── 카테고리별 빠른 질문 칩 ──────────────────────────────
function getQuickChips(catId) {
  const pool = catId === 'all' ? KB : KB.filter(item => item.category === catId);
  return pool.filter(item => item.q).slice(0, 6);
}

// ── Main render ──────────────────────────────────────────
let _currentCategory = 'all';

function render(root) {
  const msgs = getHistory();

  root.innerHTML = `
    <div class="page" id="ai-consult-page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden">
      <div class="top-bar" style="border-bottom:1px solid var(--border);flex-shrink:0">
        <button class="btn btn-ghost btn-sm" onclick="window.navBack()" style="padding:8px;min-height:40px">←</button>
        <div style="flex:1;text-align:center;font-weight:700;font-size:15px">🤖 AI 노무·인사 상담</div>
        <button id="clear-btn" class="btn btn-ghost btn-sm" style="font-size:0.72rem;color:var(--text-muted);min-height:40px">초기화</button>
      </div>

      <!-- 카테고리 탭 -->
      <div id="cat-tabs" style="display:flex;gap:4px;padding:8px 12px;overflow-x:auto;scrollbar-width:none;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--surface)">
        ${CATEGORIES.map(c => `
          <button class="cat-tab${_currentCategory === c.id ? ' active' : ''}" data-cat="${c.id}"
            style="white-space:nowrap;padding:5px 12px;border-radius:20px;border:1.5px solid ${_currentCategory === c.id ? '#4F46E5' : 'var(--border)'};
                   background:${_currentCategory === c.id ? '#4F46E5' : 'var(--bg)'};
                   color:${_currentCategory === c.id ? '#fff' : 'var(--text)'};
                   font-size:0.75rem;font-weight:${_currentCategory === c.id ? '700' : '500'};
                   cursor:pointer;flex-shrink:0;transition:all 0.15s">
            ${c.icon} ${c.label}
          </button>`).join('')}
      </div>

      <div class="page-content" id="chat-scroll" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:0">

        <!-- 인트로 배너 -->
        <div id="intro-banner" style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);
             border-radius:14px;padding:20px;margin-bottom:16px;color:#fff;
             ${msgs.length ? 'display:none' : ''}">
          <div style="font-size:1.4rem;margin-bottom:6px">🤖</div>
          <div style="font-weight:700;font-size:1rem;margin-bottom:4px">AI 노무·인사 상담</div>
          <div style="font-size:0.78rem;opacity:0.85;line-height:1.6">
            퇴직금·연차·해고·야근수당·4대보험 등 인사 실무 궁금증을 바로 확인하세요.
            <br>카테고리를 선택하거나 아래 자주 묻는 질문을 눌러 시작하세요.
          </div>
        </div>

        <!-- 빠른 질문 칩 -->
        <div id="faq-section" style="margin-bottom:12px">
          <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;font-weight:500">💡 자주 묻는 질문</div>
          <div id="faq-chips" style="display:flex;flex-wrap:wrap;gap:8px">
            ${_renderChips(_currentCategory)}
          </div>
        </div>

        <!-- 채팅 메시지 -->
        <div id="chat-messages" style="display:flex;flex-direction:column;gap:12px;padding-bottom:8px">
          ${msgs.map(m => renderMsg(m)).join('')}
        </div>

      </div>

      <!-- 입력바 -->
      <div style="padding:10px 12px 12px;border-top:1px solid var(--border);
                  background:var(--surface);flex-shrink:0;
                  padding-bottom:calc(12px + var(--safe-bottom,0px))">
        <div style="display:flex;gap:8px;align-items:flex-end">
          <textarea maxlength="500" id="chat-input" placeholder="노무·인사 관련 질문을 입력하세요..."
            style="flex:1;padding:10px 12px;border:1.5px solid var(--border);border-radius:12px;
                   font-size:0.85rem;color:var(--text);background:var(--bg);resize:none;
                   height:44px;max-height:120px;box-sizing:border-box;outline:none;
                   font-family:inherit;line-height:1.4;overflow-y:auto"></textarea>
          <button id="send-btn" style="width:44px;height:44px;background:#4F46E5;color:#fff;
                  border:none;border-radius:12px;cursor:pointer;font-size:1.1rem;
                  display:flex;align-items:center;justify-content:center;flex-shrink:0;
                  transition:opacity 0.15s">▲</button>
        </div>
        <div style="font-size:0.65rem;color:var(--text-muted);margin-top:5px;text-align:center">
          일반적인 법령 안내 목적 · 법적 효력 없음 · 개별 케이스는 전문 노무사 확인 필요
        </div>
      </div>
    </div>
  `;

  bindEvents(root, msgs);
}

function _renderChips(catId) {
  const chips = getQuickChips(catId);
  if (!chips.length) return '<div style="font-size:0.78rem;color:var(--text-muted)">해당 카테고리에 등록된 질문이 없습니다.</div>';
  return chips.map(item => `
    <button class="faq-chip" data-q="${esc(item.q)}"
      style="padding:6px 12px;border:1.5px solid var(--border);border-radius:20px;
             background:var(--surface);font-size:0.78rem;color:var(--text);
             cursor:pointer;transition:all 0.15s;min-height:auto">
      ${esc(item.q)}
    </button>`).join('');
}

function renderMsg(m) {
  const isUser = m.role === 'user';
  return `
    <div style="display:flex;${isUser ? 'justify-content:flex-end' : 'justify-content:flex-start'};gap:8px;align-items:flex-end">
      ${!isUser ? `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#4F46E5,#7C3AED);
                               display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">🤖</div>` : ''}
      <div style="max-width:82%;padding:10px 13px;border-radius:${isUser ? '16px 16px 4px 16px' : '4px 16px 16px 16px'};
                  background:${isUser ? '#4F46E5' : 'var(--surface)'};
                  color:${isUser ? '#fff' : 'var(--text)'};
                  border:${isUser ? 'none' : '1px solid var(--border)'};
                  font-size:0.82rem;line-height:1.6;word-break:break-word">
        ${isUser ? esc(m.text) : md(m.text)}
        <div style="font-size:0.62rem;margin-top:4px;opacity:0.6;text-align:right">${formatTime(m.ts)}</div>
      </div>
    </div>
  `;
}

function formatTime(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function scrollToBottom(root) {
  const el = root.querySelector('#chat-scroll');
  if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
}

function appendMsg(root, msgs, msg) {
  const el = root.querySelector('#chat-messages');
  if (el) {
    const div = document.createElement('div');
    div.innerHTML = renderMsg(msg);
    el.appendChild(div.firstElementChild);
  }
  msgs.push(msg);
  saveHistory(msgs);
  scrollToBottom(root);
}

function showTyping(root) {
  const el = root.querySelector('#chat-messages');
  if (!el) return;
  const div = document.createElement('div');
  div.id = 'typing-indicator';
  div.innerHTML = `
    <div style="display:flex;justify-content:flex-start;gap:8px;align-items:flex-end">
      <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#4F46E5,#7C3AED);
                  display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">🤖</div>
      <div style="padding:10px 14px;border-radius:4px 16px 16px 16px;background:var(--surface);
                  border:1px solid var(--border);display:flex;gap:5px;align-items:center">
        <span style="width:7px;height:7px;background:var(--text-muted);border-radius:50%;animation:typing-dot 1s infinite 0s"></span>
        <span style="width:7px;height:7px;background:var(--text-muted);border-radius:50%;animation:typing-dot 1s infinite 0.2s"></span>
        <span style="width:7px;height:7px;background:var(--text-muted);border-radius:50%;animation:typing-dot 1s infinite 0.4s"></span>
      </div>
    </div>`;
  el.appendChild(div);
  scrollToBottom(root);
}

function removeTyping(root) {
  root.querySelector('#typing-indicator')?.remove();
}

async function sendMessage(root, msgs, text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  root.querySelector('#intro-banner')?.style && (root.querySelector('#intro-banner').style.display = 'none');

  const userMsg = { role: 'user', text: trimmed, ts: Date.now() };
  appendMsg(root, msgs, userMsg);

  const input = root.querySelector('#chat-input');
  if (input) { input.value = ''; input.style.height = '44px'; }

  showTyping(root);

  const delay = 500 + Math.random() * 700;
  await new Promise(r => setTimeout(r, delay));
  removeTyping(root);

  const answer = matchKB(trimmed, _currentCategory) || FALLBACK + DISCLAIMER;
  const aiMsg = { role: 'ai', text: answer, ts: Date.now() };
  appendMsg(root, msgs, aiMsg);
}

function _bindChipEvents(root, msgs) {
  root.querySelectorAll('.faq-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.dataset.q;
      if (q) sendMessage(root, msgs, q);
    });
    chip.addEventListener('mouseenter', () => {
      chip.style.background  = 'var(--primary-light,#EEF2FF)';
      chip.style.borderColor = '#4F46E5';
      chip.style.color       = '#4F46E5';
    });
    chip.addEventListener('mouseleave', () => {
      chip.style.background  = 'var(--surface)';
      chip.style.borderColor = 'var(--border)';
      chip.style.color       = 'var(--text)';
    });
  });
}

function bindEvents(root, msgs) {
  const input   = root.querySelector('#chat-input');
  const sendBtn = root.querySelector('#send-btn');

  function doSend() {
    const text = input?.value?.trim();
    if (text) sendMessage(root, msgs, text);
  }

  sendBtn?.addEventListener('click', doSend);

  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  });

  input?.addEventListener('input', () => {
    input.style.height = '44px';
    const h = Math.min(input.scrollHeight, 120);
    input.style.height = h + 'px';
  });

  // 카테고리 탭 클릭
  root.querySelector('#cat-tabs')?.addEventListener('click', e => {
    const btn = e.target.closest('.cat-tab');
    if (!btn) return;
    _currentCategory = btn.dataset.cat;

    root.querySelectorAll('.cat-tab').forEach(t => {
      const isActive = t.dataset.cat === _currentCategory;
      t.style.background   = isActive ? '#4F46E5' : 'var(--bg)';
      t.style.color        = isActive ? '#fff' : 'var(--text)';
      t.style.borderColor  = isActive ? '#4F46E5' : 'var(--border)';
      t.style.fontWeight   = isActive ? '700' : '500';
    });

    const faqChips = root.querySelector('#faq-chips');
    if (faqChips) {
      faqChips.innerHTML = _renderChips(_currentCategory);
      _bindChipEvents(root, msgs);
    }
  });

  _bindChipEvents(root, msgs);

  // 초기화
  root.querySelector('#clear-btn')?.addEventListener('click', () => {
    
    localStorage.removeItem(LS_HISTORY);
    _currentCategory = 'all';
    render(root);
    showToast('대화 기록이 초기화되었습니다.', 'info');
      addNotification({ type: 'info', title: 'AI 상담', body: '대화 기록이 초기화되었습니다.' });
  });

  scrollToBottom(root);
}

// ── CSS 주입 ─────────────────────────────────────────────
const STYLE_ID = 'ai-consult-style';
function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes typing-dot {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-5px); opacity: 1; }
    }
    #cat-tabs::-webkit-scrollbar { display: none; }
    #ai-consult-page .top-bar {
      display: flex; align-items: center; padding: 8px 12px; gap: 8px;
      background: var(--bg); flex-shrink: 0;
    }
  `;
  document.head.appendChild(s);
}

// ── Public API ───────────────────────────────────────────
export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _root = root;
  _currentCategory = 'all';
  injectStyle();
  render(root);
}

export function unmount() {
  _root = null;
  _currentCategory = 'all';
}
