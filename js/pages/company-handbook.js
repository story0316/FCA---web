/**
 * company-handbook.js — 회사 핸드북 (취업규칙·복무규정 열람)
 *
 * API 우선: GET /api/org/:org_id/handbook
 * - 성공 시 API 섹션/아티클 렌더
 * - 빈 응답 시 빈 상태 표시 (아이콘 + 안내 + 관리자 CTA)
 * - 오류 시 재시도 버튼 + showToast
 * - 하드코딩 fallback 없음
 */

import { showToast } from '../components/toast.js';
import { isApplicant } from '../auth.js';

// ── 모듈 상태 ──────────────────────────────────────────────────────────────────
let _expandedId    = null;
let _searchQuery   = '';
let _sections      = null;  // null=미로드, []= 빈 데이터, [...]=정상
let _effectiveDate = null;
let _loadError     = false;

// ── 진입점 ────────────────────────────────────────────────────────────────────
export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  }
  _expandedId    = null;
  _searchQuery   = '';
  _sections      = null;
  _effectiveDate = null;
  _loadError     = false;

  _drawLoading(root);
  await _loadHandbook(root);
}

export function unmount() {
  _expandedId    = null;
  _searchQuery   = '';
  _sections      = null;
  _effectiveDate = null;
  _loadError     = false;
}

// ── 데이터 로드 ───────────────────────────────────────────────────────────────
function _getOrgId() {
  try {
    const u = JSON.parse(localStorage.getItem('hr_user') || 'null');
    return u?.org_id || 'ORG001';
  } catch (_) {
    return 'ORG001';
  }
}

async function _loadHandbook(root) {
  try {
    const orgId = _getOrgId();
    const token = localStorage.getItem('hr_token') || '';
    const res   = await fetch(`/api/org/${encodeURIComponent(orgId)}/handbook`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }

    const data     = await res.json();
    _sections      = Array.isArray(data.sections) ? data.sections : [];
    _effectiveDate = data.effective_date || null;
    _loadError     = false;
  } catch (err) {
    _loadError = true;
    _sections  = null;
    showToast(`핸드북을 불러오지 못했습니다: ${err.message}`, 'error');
  }

  _draw(root);
}

// ── 로딩 화면 ─────────────────────────────────────────────────────────────────
function _drawLoading(root) {
  root.innerHTML = `
<div class="page">
  ${_headerHtml()}
  <div class="page-content" style="padding:40px 24px;text-align:center">
    <div style="font-size:36px;margin-bottom:12px">📖</div>
    <div style="font-size:14px;color:var(--text-muted)">핸드북을 불러오는 중...</div>
  </div>
</div>`;
}

// ── 오류 화면 ─────────────────────────────────────────────────────────────────
function _drawError(root, onRetry) {
  root.innerHTML = `
<div class="page">
  ${_headerHtml()}
  <div class="page-content" style="padding:48px 24px;text-align:center">
    <div style="font-size:48px;margin-bottom:16px">⚠️</div>
    <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">핸드북을 불러올 수 없습니다</div>
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:24px">서버 연결을 확인하고 다시 시도해주세요.</div>
    <button id="hb-retry-btn"
      style="padding:10px 24px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">
      🔄 다시 시도
    </button>
  </div>
</div>`;
  root.querySelector('#hb-retry-btn')?.addEventListener('click', onRetry);
}

// ── 빈 상태 화면 ──────────────────────────────────────────────────────────────
function _drawEmpty(root) {
  root.innerHTML = `
<div class="page">
  ${_headerHtml()}
  <div class="page-content" style="padding:48px 24px;text-align:center">
    <div style="font-size:48px;margin-bottom:16px">📭</div>
    <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">등록된 핸드북이 없습니다</div>
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:24px">관리자가 핸드북 내용을 등록하면 여기에 표시됩니다.</div>
    <button onclick="location.hash='#/admin'"
      style="padding:10px 24px;background:#EEF2FF;color:#4F46E5;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">
      관리자 페이지로 이동
    </button>
  </div>
</div>`;
}

// ── 헤더 공통 HTML ─────────────────────────────────────────────────────────────
function _headerHtml() {
  return `<div class="page-header" style="background:var(--card-bg);border-bottom:1px solid var(--border);padding:16px;display:flex;align-items:center;gap:12px">
    <button onclick="window.navBack()"
      style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0;line-height:1">←</button>
    <div>
      <div style="font-size:16px;font-weight:700;color:var(--text)">회사 핸드북</div>
      <div style="font-size:11px;color:var(--text-muted)">취업규칙 · 복무규정 · 복리후생 안내</div>
    </div>
  </div>`;
}

// ── 메인 렌더 ─────────────────────────────────────────────────────────────────
function _draw(root) {
  if (_loadError) {
    _drawError(root, async () => {
      _loadError = false;
      _drawLoading(root);
      await _loadHandbook(root);
    });
    return;
  }

  if (Array.isArray(_sections) && _sections.length === 0) {
    _drawEmpty(root);
    return;
  }

  const sections = _sections || [];
  const q        = _searchQuery.toLowerCase();

  const filtered = q
    ? sections.map(s => ({
        ...s,
        articles: s.articles.filter(a =>
          a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q)
        ),
      })).filter(s => s.articles.length)
    : sections;

  const totalArticles = sections.reduce((n, s) => n + s.articles.length, 0);

  root.innerHTML = `
<div class="page">
  ${_headerHtml()}

  <div class="page-content" style="padding:16px">

    <!-- 검색 -->
    <div style="position:relative;margin-bottom:16px">
      <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:14px">🔍</span>
      <input id="hb-search" type="text" placeholder="조항 검색 (예: 연차, 경조사…)" value="${_escHtml(_searchQuery)}"
        style="width:100%;padding:10px 12px 10px 36px;border:1.5px solid var(--border);border-radius:10px;
               font-size:13px;background:var(--card-bg);color:var(--text);box-sizing:border-box">
    </div>

    <!-- 요약 배지 -->
    ${!q ? `<div style="display:flex;gap:8px;margin-bottom:16px;overflow-x:auto;padding-bottom:4px">
      ${sections.map(s => `
        <button class="hb-sec-btn" data-id="${_escHtml(s.id)}"
          style="flex-shrink:0;padding:6px 12px;border-radius:20px;border:1.5px solid var(--border);
                 background:var(--card-bg);font-size:11px;font-weight:600;color:var(--text-muted);cursor:pointer;white-space:nowrap">
          ${s.icon} ${_escHtml(s.title)}
        </button>`).join('')}
    </div>` : ''}

    <!-- 통계 -->
    <div style="background:#EEF2FF;border-radius:12px;padding:12px;margin-bottom:16px;display:flex;gap:16px">
      <div style="text-align:center;flex:1">
        <div style="font-size:20px;font-weight:800;color:#4F46E5">${sections.length}</div>
        <div style="font-size:10px;color:var(--text-muted)">챕터</div>
      </div>
      <div style="text-align:center;flex:1">
        <div style="font-size:20px;font-weight:800;color:#4F46E5">${totalArticles}</div>
        <div style="font-size:10px;color:var(--text-muted)">조항</div>
      </div>
      <div style="text-align:center;flex:1">
        <div style="font-size:14px;font-weight:700;color:#10B981">최신</div>
        <div style="font-size:10px;color:var(--text-muted)">${_effectiveDate ? _effectiveDate + ' 개정' : '최신 버전'}</div>
      </div>
    </div>

    ${!filtered.length ? `
      <div style="text-align:center;padding:40px;color:var(--text-muted)">
        <div style="font-size:36px;margin-bottom:10px">🔍</div>
        <div style="font-size:14px;font-weight:600;margin-bottom:4px">검색 결과 없음</div>
        <div style="font-size:12px">'${_escHtml(q)}'에 해당하는 조항이 없습니다</div>
      </div>` :
    filtered.map(sec => {
      const expanded = _expandedId === sec.id || !!q;
      return `
<div class="hb-section" data-id="${_escHtml(sec.id)}"
  style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;margin-bottom:10px;overflow:hidden">
  <button class="hb-sec-toggle" data-id="${_escHtml(sec.id)}"
    style="width:100%;padding:14px;display:flex;align-items:center;justify-content:space-between;
           background:none;border:none;cursor:pointer;text-align:left">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:20px">${sec.icon}</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${_escHtml(sec.title)}</div>
        <div style="font-size:11px;color:var(--text-muted)">제${sec.articles[0].no}조 ~ 제${sec.articles[sec.articles.length-1].no}조</div>
      </div>
    </div>
    <span style="color:var(--text-muted);font-size:16px;transition:transform .2s;${expanded ? 'transform:rotate(180deg)' : ''}">▼</span>
  </button>
  ${expanded ? `<div style="padding:0 14px 14px;border-top:1px solid var(--border)">
    ${sec.articles.map(a => `
      <div style="padding:12px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="background:#EEF2FF;color:#4F46E5;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:700">제${a.no}조</span>
          <span style="font-size:12px;font-weight:700;color:var(--text)">${_escHtml(a.title)}</span>
        </div>
        <div style="font-size:12px;color:#475569;line-height:1.6">${_escHtml(a.content)}</div>
      </div>`).join('')}
  </div>` : ''}
</div>`;
    }).join('')}

    <!-- 푸터 안내 -->
    <div style="margin-top:16px;padding:12px;background:var(--bg);border-radius:10px;font-size:11px;color:var(--text-muted);text-align:center;line-height:1.6">
      본 핸드북은 정보 제공 목적이며, 법적 효력은 공식 취업규칙 원본에 있습니다.<br>
      문의: hr@company.com · 내선 1234
    </div>
  </div>
</div>`;

  const searchInput = root.querySelector('#hb-search');
  searchInput?.addEventListener('input', () => {
    _searchQuery = searchInput.value;
    _draw(root);
  });

  root.querySelectorAll('.hb-sec-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      _expandedId = _expandedId === id ? null : id;
      _draw(root);
    });
  });

  root.querySelectorAll('.hb-sec-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _expandedId = btn.dataset.id;
      _draw(root);
      const el = root.querySelector(`.hb-section[data-id="${btn.dataset.id}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────
function _escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
