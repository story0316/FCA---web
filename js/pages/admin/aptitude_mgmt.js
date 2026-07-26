/**
 * aptitude_mgmt.js — 인적성 검사 관리 (어드민)
 * HR Competency OS
 *
 * 기능: 문항 목록 / 활성화 토글 / 검사 설정 / 결과 현황
 * 저장소: localStorage (hr_apt_overrides / hr_apt_config / hr_apt_results)
 */

import { APTITUDE_QUESTIONS, DOMAIN_CONFIG, getActiveQuestions, countByDomain } from '../../data/aptitude_questions.js';
import { showToast }       from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

// ── State ───────────────────────────────────────────────────────
let _root = null;
let _state = {
  filterDomain:    'all',
  filterType:      'all',
  filterDiff:      'all',
  filterStatus:    'all',
  search:          '',
  page:            1,
  configOpen:      false,
  resultsOpen:     false,
  detailQ:         null,
  resFilterGrade:  'all',
  resSortBy:       'date',
  resSortDir:      'desc',
};
const PAGE_SIZE = 20;

// ── localStorage helpers ────────────────────────────────────────
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function getOverrides(){
  try { return JSON.parse(localStorage.getItem('hr_apt_overrides')||'{}'); } catch { return {}; }
}
function saveOverrides(o){ localStorage.setItem('hr_apt_overrides', JSON.stringify(o)); }

function getConfig(){
  const defaults = {};
  Object.entries(DOMAIN_CONFIG).forEach(([k,v]) => {
    defaults[k] = { count: v.count || 99, timeMin: v.timeMin };
  });
  try {
    const stored = JSON.parse(localStorage.getItem('hr_apt_config')||'{}');
    return { ...defaults, ...stored };
  } catch { return defaults; }
}
function saveConfig(c){ localStorage.setItem('hr_apt_config', JSON.stringify(c)); }

function getResults(){
  try { return JSON.parse(localStorage.getItem('hr_apt_results')||'[]'); } catch { return []; }
}

function isActive(q, overrides){
  if (overrides[q.id] !== undefined) return overrides[q.id];
  return q.active !== false;
}

// ── Filter & pagination ─────────────────────────────────────────
function filteredQuestions(){
  const ov = getOverrides();
  const st = _state;
  return APTITUDE_QUESTIONS.filter(q => {
    if (st.filterDomain !== 'all' && q.domain !== st.filterDomain) return false;
    if (st.filterType   !== 'all' && q.type   !== st.filterType)   return false;
    if (st.filterDiff   !== 'all' && String(q.difficulty) !== st.filterDiff) return false;
    if (st.filterStatus === 'active'   && !isActive(q, ov)) return false;
    if (st.filterStatus === 'inactive' &&  isActive(q, ov)) return false;
    if (st.search){
      const hay = (q.text||q.scenario||'').toLowerCase();
      if (!hay.includes(st.search.toLowerCase())) return false;
    }
    return true;
  });
}

// ── Render helpers ──────────────────────────────────────────────
function domainChip(domain, small = false){
  const d = DOMAIN_CONFIG[domain] || { name: domain, color:'#64748B', bg:'#F1F5F9' };
  const sz = small ? 'font-size:10px;padding:2px 6px' : 'font-size:11px;padding:3px 8px';
  return `<span style="${sz};background:${d.bg};color:${d.color};border-radius:20px;font-weight:600;white-space:nowrap;">${d.icon||''} ${esc(d.name)}</span>`;
}

function typeBadge(type){
  const map = { mcq:'객관식', sjt:'상황판단', likert:'성실성 척도' };
  const col = { mcq:'#4F46E5', sjt:'#059669', likert:'#D97706' };
  const bg  = { mcq:'#EEF2FF', sjt:'#ECFDF5', likert:'#FFFBEB' };
  return `<span style="font-size:10px;padding:2px 6px;background:${bg[type]||'#F1F5F9'};color:${col[type]||'#64748B'};border-radius:4px;font-weight:600;">${esc(map[type]||type)}</span>`;
}

function diffStars(d){
  return '★'.repeat(d) + '☆'.repeat(3-d);
}

function answerHint(q){
  if (q.type === 'mcq')    return `정답: ${String.fromCharCode(65 + q.correct)}`;
  if (q.type === 'sjt')    return `최선: ${String.fromCharCode(65 + q.best)} / 최악: ${String.fromCharCode(65 + q.worst)}`;
  if (q.type === 'likert') return q.direction === 1 ? '↑ 긍정' : '↓ 역채점';
  return '';
}

// ── Stats bar ───────────────────────────────────────────────────
function renderStats(){
  const ov      = getOverrides();
  const counts  = countByDomain(ov);
  const total   = APTITUDE_QUESTIONS.length;
  const active  = Object.values(counts).reduce((a,b)=>a+b, 0);
  const results = getResults();
  const config  = getConfig();
  const totalMin = Object.entries(DOMAIN_CONFIG).reduce((s,[k,v]) => s + (config[k]?.timeMin || v.timeMin), 0);

  const recentCount = results.filter(r => {
    try { return (Date.now() - new Date(r.date).getTime()) < 30*24*60*60*1000; } catch { return false; }
  }).length;

  return `
    <div style="background:#fff;border-bottom:1px solid var(--border,#E2E8F0);padding:12px 16px;">
      <!-- 요약 수치 -->
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px;">
        ${[
          ['📝 전체 문항', total+'개'],
          ['✅ 활성 문항', active+'개'],
          ['⏱️ 총 검사 시간', '약 '+totalMin+'분'],
          ['👥 최근 30일 응시', recentCount+'명'],
        ].map(([l,v])=>`
          <div style="display:flex;flex-direction:column;gap:1px;">
            <span style="font-size:10px;color:var(--text-muted,#94A3B8);">${l}</span>
            <span style="font-size:15px;font-weight:700;color:var(--text,#1E293B);">${v}</span>
          </div>`).join('')}
      </div>
      <!-- 도메인 칩 -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${Object.entries(DOMAIN_CONFIG).map(([k,d])=>`
          <div style="display:flex;align-items:center;gap:4px;padding:4px 10px;background:${d.bg};border-radius:20px;border:1px solid ${d.color}22;">
            <span style="font-size:11px;">${d.icon}</span>
            <span style="font-size:11px;font-weight:600;color:${d.color};">${esc(d.name)}</span>
            <span style="font-size:11px;color:${d.color};font-weight:700;">${counts[k]||0}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

// ── Config panel ────────────────────────────────────────────────
function renderConfigPanel(){
  const config = getConfig();
  const ov     = getOverrides();
  const open   = _state.configOpen;

  const rows = Object.entries(DOMAIN_CONFIG).map(([k,d])=>{
    const cfg = config[k] || {};
    const avail = APTITUDE_QUESTIONS.filter(q => q.domain === k && isActive(q, ov)).length;
    return `
      <tr style="border-bottom:1px solid var(--border,#E2E8F0);">
        <td style="padding:8px 10px;">${domainChip(k, true)}</td>
        <td style="padding:8px;text-align:center;font-size:13px;color:#64748B;">${avail}</td>
        <td style="padding:8px;text-align:center;">
          <input type="number" class="cfg-count" data-domain="${k}"
            min="1" max="${avail}" value="${Math.min(cfg.count||avail, avail)}"
            style="width:54px;padding:4px 6px;border:1.5px solid var(--border,#E2E8F0);border-radius:6px;font-size:13px;text-align:center;">
        </td>
        <td style="padding:8px;text-align:center;">
          <input type="number" class="cfg-time" data-domain="${k}"
            min="1" max="60" value="${cfg.timeMin||d.timeMin}"
            style="width:54px;padding:4px 6px;border:1.5px solid var(--border,#E2E8F0);border-radius:6px;font-size:13px;text-align:center;">
        </td>
        <td style="padding:8px;text-align:center;font-size:13px;font-weight:600;color:#4F46E5;">${Math.round(d.weight*100)}%</td>
      </tr>`;
  }).join('');

  return `
    <div style="background:#fff;border-bottom:1px solid var(--border,#E2E8F0);">
      <div id="cfg-header" style="padding:14px 16px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;">
        <span style="font-size:14px;font-weight:700;color:var(--text,#1E293B);">⚙️ 검사 설정</span>
        <span id="cfg-arrow" style="font-size:13px;color:#94A3B8;transition:transform .2s;${open?'transform:rotate(180deg)':''}">▼</span>
      </div>
      ${open ? `
      <div style="padding:0 16px 16px;">
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:380px;">
            <thead>
              <tr style="background:#F8FAFC;">
                <th style="padding:8px 10px;text-align:left;color:#475569;font-weight:600;">영역</th>
                <th style="padding:8px;text-align:center;color:#475569;font-weight:600;">활성 문항</th>
                <th style="padding:8px;text-align:center;color:#475569;font-weight:600;">출제 수</th>
                <th style="padding:8px;text-align:center;color:#475569;font-weight:600;">시간(분)</th>
                <th style="padding:8px;text-align:center;color:#475569;font-weight:600;">가중치</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <button id="cfg-save" style="margin-top:12px;padding:10px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">💾 설정 저장</button>
      </div>` : ''}
    </div>`;
}

// ── Question table ──────────────────────────────────────────────
function renderTable(){
  const ov   = getOverrides();
  const list = filteredQuestions();
  const total = list.length;
  const pages = Math.ceil(total / PAGE_SIZE) || 1;
  const page  = Math.min(_state.page, pages);
  const slice = list.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  const rows = slice.map(q => {
    const active = isActive(q, ov);
    const preview = (q.text || q.scenario || '').replace(/\n/g,' ').slice(0,45) + ((q.text||q.scenario||'').length>45?'…':'');
    return `
      <tr style="border-bottom:1px solid var(--border,#E2E8F0);background:${active?'#fff':'#FAFAFA'};">
        <td style="padding:8px 10px;font-size:11px;color:#94A3B8;font-weight:500;white-space:nowrap;">${esc(q.id)}</td>
        <td style="padding:8px;">${domainChip(q.domain, true)}</td>
        <td style="padding:8px;">${typeBadge(q.type)}</td>
        <td style="padding:8px;font-size:12px;color:#D97706;">${diffStars(q.difficulty)}</td>
        <td style="padding:8px;font-size:12px;color:${active?'#334155':'#94A3B8'};max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(q.text||q.scenario||'')}">${esc(preview)}</td>
        <td style="padding:8px;font-size:11px;color:#64748B;white-space:nowrap;">${esc(answerHint(q))}</td>
        <td style="padding:8px;">
          <button class="toggle-active" data-id="${q.id}" data-active="${active}"
            style="padding:4px 10px;border-radius:20px;border:none;cursor:pointer;font-size:11px;font-weight:600;
                   background:${active?'#DCFCE7':'#F1F5F9'};color:${active?'#16A34A':'#94A3B8'};">
            ${active?'활성':'비활성'}
          </button>
        </td>
        <td style="padding:8px;">
          <button class="view-detail" data-id="${q.id}"
            style="padding:4px 10px;background:#EEF2FF;color:#4F46E5;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">보기</button>
        </td>
      </tr>`;
  }).join('');

  const emptyRow = slice.length === 0
    ? `<tr><td colspan="8" style="padding:32px;text-align:center;color:#94A3B8;font-size:14px;">조건에 맞는 문항이 없습니다</td></tr>`
    : '';

  return `
    <div style="background:#fff;">
      <!-- Filter bar -->
      <div style="padding:12px 16px;display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid var(--border,#E2E8F0);background:#F8FAFC;">
        <select id="f-domain" style="${selStyle()}">
          <option value="all">전체 영역</option>
          ${Object.entries(DOMAIN_CONFIG).map(([k,d])=>`<option value="${k}" ${_state.filterDomain===k?'selected':''}>${d.icon} ${d.name}</option>`).join('')}
        </select>
        <select id="f-type" style="${selStyle()}">
          <option value="all">전체 유형</option>
          <option value="mcq"    ${_state.filterType==='mcq'?'selected':''}>객관식</option>
          <option value="sjt"    ${_state.filterType==='sjt'?'selected':''}>상황판단</option>
          <option value="likert" ${_state.filterType==='likert'?'selected':''}>성실성 척도</option>
        </select>
        <select id="f-diff" style="${selStyle()}">
          <option value="all">전체 난이도</option>
          <option value="1" ${_state.filterDiff==='1'?'selected':''}>★ 쉬움</option>
          <option value="2" ${_state.filterDiff==='2'?'selected':''}>★★ 보통</option>
          <option value="3" ${_state.filterDiff==='3'?'selected':''}>★★★ 어려움</option>
        </select>
        <select id="f-status" style="${selStyle()}">
          <option value="all"      ${_state.filterStatus==='all'?'selected':''}>전체 상태</option>
          <option value="active"   ${_state.filterStatus==='active'?'selected':''}>활성만</option>
          <option value="inactive" ${_state.filterStatus==='inactive'?'selected':''}>비활성만</option>
        </select>
        <input id="f-search" type="text" placeholder="문항 내용 검색…" value="${esc(_state.search)}"
          style="${selStyle()}width:auto;flex:1;min-width:120px;">
        <button id="f-reset" style="padding:6px 12px;background:#F1F5F9;color:#64748B;border:none;border-radius:8px;font-size:12px;cursor:pointer;">초기화</button>
      </div>

      <!-- Count -->
      <div style="padding:8px 16px;font-size:12px;color:#64748B;border-bottom:1px solid var(--border,#E2E8F0);">
        총 <strong style="color:#1E293B;">${total}개</strong> 문항 (페이지 ${page}/${pages})
      </div>

      <!-- Table -->
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:640px;">
          <thead>
            <tr style="background:#F8FAFC;border-bottom:2px solid var(--border,#E2E8F0);">
              <th style="padding:8px 10px;text-align:left;color:#475569;font-weight:600;white-space:nowrap;">ID</th>
              <th style="padding:8px;text-align:left;color:#475569;font-weight:600;">영역</th>
              <th style="padding:8px;text-align:left;color:#475569;font-weight:600;">유형</th>
              <th style="padding:8px;text-align:left;color:#475569;font-weight:600;">난이도</th>
              <th style="padding:8px;text-align:left;color:#475569;font-weight:600;">문항 내용</th>
              <th style="padding:8px;text-align:left;color:#475569;font-weight:600;">정답</th>
              <th style="padding:8px;text-align:center;color:#475569;font-weight:600;">상태</th>
              <th style="padding:8px;text-align:center;color:#475569;font-weight:600;">상세</th>
            </tr>
          </thead>
          <tbody>${rows}${emptyRow}</tbody>
        </table>
      </div>

      <!-- Pagination -->
      ${pages > 1 ? `
      <div style="padding:12px 16px;display:flex;justify-content:center;gap:8px;border-top:1px solid var(--border,#E2E8F0);">
        <button id="pg-prev" style="padding:6px 14px;background:#F1F5F9;border:none;border-radius:8px;font-size:13px;cursor:pointer;${page<=1?'opacity:0.4;pointer-events:none;':''}">← 이전</button>
        <span style="padding:6px 14px;font-size:13px;color:#64748B;">${page} / ${pages}</span>
        <button id="pg-next" style="padding:6px 14px;background:#F1F5F9;border:none;border-radius:8px;font-size:13px;cursor:pointer;${page>=pages?'opacity:0.4;pointer-events:none;':''}">다음 →</button>
      </div>` : ''}
    </div>`;
}

function selStyle(){
  return 'padding:6px 10px;border:1.5px solid var(--border,#E2E8F0);border-radius:8px;font-size:12px;background:#fff;cursor:pointer;';
}

// ── Results panel ───────────────────────────────────────────────
const GRADE_COLOR = {S:'#4F46E5',A:'#0891B2',B:'#059669',C:'#D97706',D:'#94A3B8'};
const GRADE_DESC  = {S:'상위 10%',A:'상위 25%',B:'상위 50%',C:'하위 50%',D:'하위 25%'};
const DOMAINS_DISPLAY = [
  { key:'gmaT',        label:'GMA',    tip:'언어+수리+추리 종합' },
  { key:'sjt',         label:'상황판단', tip:'Situational Judgment' },
  { key:'big5',        label:'성실성',   tip:'Big Five – Conscientiousness' },
  { key:'ncs',         label:'NCS',      tip:'직업기초역량' },
];

function _getDomainT(scores, key) {
  if (key === 'gmaT') return scores?.gmaT ?? null;
  return scores?.domains?.[key]?.tScore ?? null;
}

function renderResultsPanel(){
  const allResults = getResults();
  const open = _state.resultsOpen;
  const total = allResults.length;

  // Stats
  const gradeCounts = {S:0,A:0,B:0,C:0,D:0};
  let compositeSum = 0, compositeN = 0;
  allResults.forEach(r => {
    const g = r.scores?.grade;
    if (g && gradeCounts[g] !== undefined) gradeCounts[g]++;
    const c = r.scores?.composite;
    if (c != null) { compositeSum += c; compositeN++; }
  });
  const avgComposite = compositeN > 0 ? Math.round(compositeSum / compositeN) : '-';

  // Filter
  let rows = allResults.slice();
  if (_state.resFilterGrade !== 'all') {
    rows = rows.filter(r => r.scores?.grade === _state.resFilterGrade);
  }

  // Sort
  const dir = _state.resSortDir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    let va, vb;
    if (_state.resSortBy === 'date') {
      va = new Date(a.date || 0).getTime();
      vb = new Date(b.date || 0).getTime();
    } else if (_state.resSortBy === 'composite') {
      va = a.scores?.composite ?? 0;
      vb = b.scores?.composite ?? 0;
    } else if (_state.resSortBy === 'gma') {
      va = a.scores?.gmaT ?? 0;
      vb = b.scores?.gmaT ?? 0;
    } else if (_state.resSortBy === 'grade') {
      const order = {S:5,A:4,B:3,C:2,D:1};
      va = order[a.scores?.grade] ?? 0;
      vb = order[b.scores?.grade] ?? 0;
    } else {
      va = 0; vb = 0;
    }
    return (va - vb) * dir;
  });

  function sortTh(label, key) {
    const active = _state.resSortBy === key;
    const arrow  = active ? (_state.resSortDir === 'desc' ? ' ▼' : ' ▲') : '';
    return `<th data-sort="${key}" style="padding:7px 8px;text-align:center;color:${active?'#4F46E5':'#475569'};font-weight:600;cursor:pointer;white-space:nowrap;user-select:none;">${label}${arrow}</th>`;
  }

  const tableRows = rows.map(r => {
    const d    = r.date ? new Date(r.date).toLocaleDateString('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '-';
    const g    = r.scores?.grade || '-';
    const comp = r.scores?.composite ?? '-';
    const flag = r.scores?.flagged ? '<span title="응답 일관성 낮음" style="color:#D97706;">⚠️</span>' : '<span style="color:#10B981;">✓</span>';
    const uid  = r.userId || r.userName || '-';
    const gc   = GRADE_COLOR[g] || '#94A3B8';
    const domainCells = DOMAINS_DISPLAY.map(({ key }) => {
      const t = _getDomainT(r.scores, key);
      const col = t == null ? '#94A3B8' : t >= 60 ? '#059669' : t >= 45 ? '#0891B2' : '#D97706';
      return `<td style="padding:6px 8px;text-align:center;font-size:12px;font-weight:600;color:${col};">${t != null ? 'T'+t : '-'}</td>`;
    }).join('');
    return `
      <tr style="border-bottom:1px solid #F1F5F9;">
        <td style="padding:6px 8px;font-size:11px;color:#64748B;white-space:nowrap;">${d}</td>
        <td style="padding:6px 8px;font-size:11px;color:#475569;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(uid)}">${esc(uid.length > 12 ? uid.slice(0,10)+'…' : uid)}</td>
        <td style="padding:6px 8px;text-align:center;font-size:14px;font-weight:900;color:${gc};" title="${GRADE_DESC[g]||''}">${g}</td>
        <td style="padding:6px 8px;text-align:center;font-size:13px;font-weight:700;color:#1E293B;">T${comp}</td>
        ${domainCells}
        <td style="padding:6px 8px;text-align:center;font-size:13px;">${flag}</td>
      </tr>`;
  }).join('');

  const gradeFilterBtns = ['all','S','A','B','C','D'].map(g => {
    const active = _state.resFilterGrade === g;
    const col    = GRADE_COLOR[g] || '#475569';
    return `<button data-res-grade="${g}" style="padding:4px 10px;border-radius:20px;border:1.5px solid ${active ? col : '#E2E8F0'};background:${active ? col+'18' : '#fff'};color:${active ? col : '#64748B'};font-size:11px;font-weight:700;cursor:pointer;">${g === 'all' ? '전체' : g}</button>`;
  }).join('');

  return `
    <div style="background:#fff;border-top:1px solid var(--border,#E2E8F0);">
      <div id="res-header" style="padding:14px 16px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;">
        <div>
          <span style="font-size:14px;font-weight:700;color:var(--text,#1E293B);">📊 응시자 점수 현황</span>
          ${total > 0 ? `<span style="margin-left:8px;font-size:11px;color:#94A3B8;">${total}명 응시</span>` : ''}
        </div>
        <span id="res-arrow" style="font-size:13px;color:#94A3B8;transition:transform .2s;${open?'transform:rotate(180deg)':''}">▼</span>
      </div>

      ${open ? `
      <div style="padding:0 16px 16px;">

        <!-- 요약 카드 -->
        <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
          <div style="flex:1;min-width:70px;padding:10px 12px;background:#F8FAFC;border-radius:10px;border:1px solid #E2E8F0;">
            <div style="font-size:10px;color:#94A3B8;margin-bottom:2px;">총 응시자</div>
            <div style="font-size:18px;font-weight:800;color:#4F46E5;">${total}명</div>
          </div>
          <div style="flex:1;min-width:70px;padding:10px 12px;background:#F8FAFC;border-radius:10px;border:1px solid #E2E8F0;">
            <div style="font-size:10px;color:#94A3B8;margin-bottom:2px;">평균 T점수</div>
            <div style="font-size:18px;font-weight:800;color:#0891B2;">${avgComposite}</div>
          </div>
          <div style="flex:3;min-width:160px;padding:10px 12px;background:#F8FAFC;border-radius:10px;border:1px solid #E2E8F0;">
            <div style="font-size:10px;color:#94A3B8;margin-bottom:6px;">등급 분포</div>
            <div style="display:flex;gap:6px;">
              ${Object.entries(gradeCounts).map(([g,n])=>`
                <div style="flex:1;text-align:center;">
                  <div style="font-size:13px;font-weight:800;color:${GRADE_COLOR[g]};">${g}</div>
                  <div style="font-size:11px;color:#64748B;">${n}</div>
                </div>`).join('')}
            </div>
          </div>
        </div>

        ${total > 0 ? `
        <!-- 필터 & CSV -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
          <div style="display:flex;gap:6px;flex-wrap:wrap;">${gradeFilterBtns}</div>
          <button id="res-csv-btn" style="padding:5px 12px;border-radius:8px;border:1.5px solid #E2E8F0;background:#fff;color:#475569;font-size:11px;font-weight:600;cursor:pointer;">⬇ CSV</button>
        </div>

        <!-- 점수 테이블 -->
        <div style="overflow-x:auto;border-radius:10px;border:1px solid #E2E8F0;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:520px;">
            <thead>
              <tr style="background:#F8FAFC;border-bottom:1.5px solid #E2E8F0;">
                ${sortTh('응시일','date')}
                <th style="padding:7px 8px;text-align:left;color:#475569;font-weight:600;">응시자</th>
                ${sortTh('등급','grade')}
                ${sortTh('종합T','composite')}
                ${sortTh('GMA','gma')}
                <th style="padding:7px 8px;text-align:center;color:#475569;font-weight:600;">상황판단</th>
                <th style="padding:7px 8px;text-align:center;color:#475569;font-weight:600;">성실성</th>
                <th style="padding:7px 8px;text-align:center;color:#475569;font-weight:600;">NCS</th>
                <th style="padding:7px 8px;text-align:center;color:#475569;font-weight:600;">신뢰도</th>
              </tr>
            </thead>
            <tbody>${tableRows || `<tr><td colspan="9" style="padding:20px;text-align:center;color:#94A3B8;font-size:13px;">해당 등급의 응시 기록이 없습니다.</td></tr>`}</tbody>
          </table>
        </div>
        ` : `<p style="font-size:13px;color:#94A3B8;text-align:center;padding:20px 0;">아직 응시 기록이 없습니다.</p>`}

      </div>` : ''}
    </div>`;
}

// ── Detail modal ────────────────────────────────────────────────
function renderDetailModal(qId){
  const q  = APTITUDE_QUESTIONS.find(x => x.id === qId);
  if (!q) return;
  const ov = getOverrides();
  const active = isActive(q, ov);
  const d  = DOMAIN_CONFIG[q.domain] || {};

  let optionsHtml = '';
  if (q.type === 'mcq'){
    optionsHtml = q.options.map((opt,i) => {
      const isCorrect = i === q.correct;
      return `<div style="padding:10px 12px;border-radius:8px;border:1.5px solid ${isCorrect?'#4F46E5':'#E2E8F0'};background:${isCorrect?'#EEF2FF':'#F8FAFC'};margin-bottom:6px;display:flex;align-items:center;gap:8px;">
        <span style="width:22px;height:22px;border-radius:50%;background:${isCorrect?'#4F46E5':'#E2E8F0'};color:${isCorrect?'#fff':'#64748B'};font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${String.fromCharCode(65+i)}</span>
        <span style="font-size:13px;color:${isCorrect?'#4F46E5':'#334155'};font-weight:${isCorrect?700:400};">${esc(opt)}</span>
        ${isCorrect?`<span style="margin-left:auto;font-size:11px;color:#4F46E5;font-weight:700;">✓ 정답</span>`:''}
      </div>`;
    }).join('');
  } else if (q.type === 'sjt'){
    optionsHtml = q.options.map((opt,i) => {
      const isBest  = i === q.best;
      const isWorst = i === q.worst;
      const bg = isBest ? '#ECFDF5' : isWorst ? '#FEF2F2' : '#F8FAFC';
      const bc = isBest ? '#059669' : isWorst ? '#DC2626' : '#E2E8F0';
      return `<div style="padding:10px 12px;border-radius:8px;border:1.5px solid ${bc};background:${bg};margin-bottom:6px;display:flex;align-items:flex-start;gap:8px;">
        <span style="width:22px;height:22px;border-radius:50%;background:${bc};color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">${String.fromCharCode(65+i)}</span>
        <span style="font-size:13px;color:#334155;flex:1;">${esc(opt)}</span>
        ${isBest?`<span style="flex-shrink:0;font-size:11px;color:#059669;font-weight:700;">✅ 최선</span>`:''}
        ${isWorst?`<span style="flex-shrink:0;font-size:11px;color:#DC2626;font-weight:700;">❌ 최악</span>`:''}
      </div>`;
    }).join('');
  } else if (q.type === 'likert'){
    optionsHtml = `
      <div style="background:#FFFBEB;border-radius:8px;padding:12px;margin-bottom:8px;">
        <p style="margin:0 0 8px;font-size:12px;color:#D97706;font-weight:600;">7점 척도 (1=전혀 아니다 ~ 7=매우 그렇다)</p>
        <div style="display:flex;gap:4px;margin-bottom:6px;">
          ${[1,2,3,4,5,6,7].map(v=>`<div style="flex:1;text-align:center;padding:8px 4px;background:#fff;border-radius:6px;border:1.5px solid #E2E8F0;font-size:13px;font-weight:700;color:#D97706;">${v}</div>`).join('')}
        </div>
        <p style="margin:0;font-size:12px;color:#64748B;">채점 방향: ${q.direction===1?'↑ 정방향 (높을수록 성실성 높음)':'↓ 역채점 (낮을수록 성실성 높음)'}</p>
        ${q.detection?`<p style="margin:6px 0 0;font-size:11px;color:#EF4444;font-weight:600;">⚠️ 사회적 바람직성 탐지 문항 — 7점 응답 시 허위응답 플래그</p>`:''}
      </div>`;
  }

  const el = document.createElement('div');
  el.id = '_apt-modal';
  el.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9998;"></div>
    <div style="position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;pointer-events:none;">
      <div style="width:100%;max-width:560px;max-height:90vh;background:#fff;border-radius:20px 20px 0 0;overflow-y:auto;pointer-events:all;padding:20px 20px 32px;">
        <!-- 헤더 -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-size:12px;font-weight:600;color:#94A3B8;">${esc(q.id)}</span>
            ${domainChip(q.domain)}
            ${typeBadge(q.type)}
            <span style="font-size:11px;color:#D97706;">${diffStars(q.difficulty)}</span>
          </div>
          <button id="_apt-modal-close" style="background:#F1F5F9;border:none;border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer;color:#475569;">✕ 닫기</button>
        </div>

        <!-- 문항 내용 -->
        <div style="background:#F8FAFC;border-radius:10px;padding:14px;margin-bottom:14px;border-left:3px solid ${d.color||'#4F46E5'};">
          <p style="margin:0;font-size:14px;color:#1E293B;line-height:1.7;white-space:pre-wrap;">${esc(q.text||q.scenario||'')}</p>
        </div>

        <!-- 선택지 -->
        <div style="margin-bottom:14px;">${optionsHtml}</div>

        <!-- 메타 정보 -->
        <div style="background:#F8FAFC;border-radius:8px;padding:10px 12px;margin-bottom:16px;display:flex;flex-wrap:wrap;gap:12px;">
          <div><span style="font-size:10px;color:#94A3B8;">카테고리</span><br><span style="font-size:12px;font-weight:600;color:#334155;">${esc(q.category||'-')}</span></div>
          <div><span style="font-size:10px;color:#94A3B8;">난이도</span><br><span style="font-size:12px;font-weight:600;color:#D97706;">${diffStars(q.difficulty)}</span></div>
          <div><span style="font-size:10px;color:#94A3B8;">상태</span><br><span style="font-size:12px;font-weight:600;color:${active?'#16A34A':'#94A3B8'};">${active?'활성':'비활성'}</span></div>
        </div>

        <!-- 활성화 토글 버튼 -->
        <button id="_apt-modal-toggle" data-id="${q.id}" data-active="${active}"
          style="width:100%;padding:13px;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;
                 background:${active?'#FEF2F2':'#ECFDF5'};color:${active?'#DC2626':'#059669'};">
          ${active ? '⛔ 이 문항 비활성화' : '✅ 이 문항 활성화'}
        </button>
      </div>
    </div>`;

  document.body.appendChild(el);

  el.querySelector('div[style*="rgba(0,0,0"]')?.addEventListener('click', closeModal);
  el.querySelector('#_apt-modal-close')?.addEventListener('click', closeModal);
  el.querySelector('#_apt-modal-toggle')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.id;
    const wasActive = e.currentTarget.dataset.active === 'true';
    const ov = getOverrides();
    ov[id] = !wasActive;
    saveOverrides(ov);
    closeModal();
    render(_root);
  });
}

function closeModal(){
  document.getElementById('_apt-modal')?.remove();
}

// ── Full page render ────────────────────────────────────────────
function render(container){
  container.innerHTML = `
    <div id="apt-mgmt-page" style="min-height:100vh;background:var(--bg,#F8FAFC);padding-bottom:60px;">

      <!-- Top bar -->
      <div style="background:#fff;border-bottom:1px solid var(--border,#E2E8F0);padding:12px 16px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:20;">
        <button id="mgmt-back" style="background:#F1F5F9;border:none;padding:7px 13px;border-radius:8px;font-size:13px;cursor:pointer;color:#475569;">← 관리자</button>
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--text,#1E293B);">🎯 인적성 검사 관리</div>
          <div style="font-size:11px;color:#94A3B8;">문항 관리 · 검사 설정 · 결과 현황</div>
        </div>
      </div>

      <!-- Stats -->
      ${renderStats()}

      <!-- Config panel -->
      ${renderConfigPanel()}

      <!-- Question table -->
      ${renderTable()}

      <!-- Results panel -->
      ${renderResultsPanel()}

    </div>`;

  bindEvents(container);
}

// ── Events ──────────────────────────────────────────────────────
function bindEvents(container){
  container.querySelector('#mgmt-back')?.addEventListener('click', () => {
    window.location.hash = '#/admin';
  });

  // Config panel toggle
  container.querySelector('#cfg-header')?.addEventListener('click', () => {
    _state.configOpen = !_state.configOpen;
    render(container);
  });

  // Config save
  container.querySelector('#cfg-save')?.addEventListener('click', () => {
    const cfg = getConfig();
    container.querySelectorAll('.cfg-count').forEach(inp => {
      const d = inp.dataset.domain;
      if (!cfg[d]) cfg[d] = {};
      cfg[d].count = parseInt(inp.value)||1;
    });
    container.querySelectorAll('.cfg-time').forEach(inp => {
      const d = inp.dataset.domain;
      if (!cfg[d]) cfg[d] = {};
      cfg[d].timeMin = parseInt(inp.value)||5;
    });
    saveConfig(cfg);
    showToast('검사 설정이 저장되었습니다', 'success');
    addNotification({ type: 'success', title: 'aptitude mgmt', body: '검사 설정이 저장되었습니다.' });
    render(container);
  });

  // Filters
  container.querySelector('#f-domain')?.addEventListener('change', e => { _state.filterDomain = e.target.value; _state.page=1; render(container); });
  container.querySelector('#f-type')?.addEventListener('change',   e => { _state.filterType   = e.target.value; _state.page=1; render(container); });
  container.querySelector('#f-diff')?.addEventListener('change',   e => { _state.filterDiff   = e.target.value; _state.page=1; render(container); });
  container.querySelector('#f-status')?.addEventListener('change', e => { _state.filterStatus = e.target.value; _state.page=1; render(container); });
  container.querySelector('#f-search')?.addEventListener('input',  e => { _state.search = e.target.value; _state.page=1; render(container); });
  container.querySelector('#f-reset')?.addEventListener('click', () => {
    _state.filterDomain = 'all'; _state.filterType = 'all';
    _state.filterDiff   = 'all'; _state.filterStatus = 'all';
    _state.search = ''; _state.page = 1;
    render(container);
  });

  // Pagination
  container.querySelector('#pg-prev')?.addEventListener('click', () => { _state.page--; render(container); });
  container.querySelector('#pg-next')?.addEventListener('click', () => { _state.page++; render(container); });

  // Toggle active in table
  container.querySelectorAll('.toggle-active').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const wasActive = btn.dataset.active === 'true';
      const ov = getOverrides();
      ov[id] = !wasActive;
      saveOverrides(ov);
      render(container);
    });
  });

  // View detail
  container.querySelectorAll('.view-detail').forEach(btn => {
    btn.addEventListener('click', () => {
      renderDetailModal(btn.dataset.id);
    });
  });

  // Results panel toggle
  container.querySelector('#res-header')?.addEventListener('click', () => {
    _state.resultsOpen = !_state.resultsOpen;
    render(container);
  });

  // Results: grade filter buttons
  container.querySelectorAll('[data-res-grade]').forEach(btn => {
    btn.addEventListener('click', () => {
      _state.resFilterGrade = btn.dataset.resGrade;
      render(container);
    });
  });

  // Results: sortable column headers
  container.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (_state.resSortBy === key) {
        _state.resSortDir = _state.resSortDir === 'desc' ? 'asc' : 'desc';
      } else {
        _state.resSortBy  = key;
        _state.resSortDir = 'desc';
      }
      render(container);
    });
  });

  // Results: CSV download
  container.querySelector('#res-csv-btn')?.addEventListener('click', () => {
    const results = getResults();
    const header = ['응시일시','응시자ID','등급','종합T','GMA-T','상황판단T','성실성T','NCS-T','신뢰도'];
    const csvRows = results.map(r => {
      const d = r.date ? new Date(r.date).toLocaleString('ko-KR') : '';
      const s = r.scores || {};
      return [
        d,
        r.userId || '',
        s.grade || '',
        s.composite ?? '',
        s.gmaT ?? '',
        s.domains?.sjt?.tScore ?? '',
        s.domains?.big5?.tScore ?? '',
        s.domains?.ncs?.tScore ?? '',
        s.flagged ? '낮음' : '정상',
      ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(',');
    });
    const csv = [header.join(','), ...csvRows].join('\n');
    const blob = new Blob(['﻿'+csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `인적성_결과_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ── Toast ───────────────────────────────────────────────────────
function _showToast(msg){
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1E293B;color:#fff;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:600;z-index:99999;pointer-events:none;white-space:nowrap;';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

// ── Public API ──────────────────────────────────────────────────
export async function mount(container){
  _root = container;
  render(container);
}

export function unmount(){
  closeModal();
  _root = null;
}
