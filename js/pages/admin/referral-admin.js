/**
 * referral-admin.js — 추천 채용 관리
 */

import { loadDisplayEmployees } from '../../data/demo_employees.js';
import { showToast } from '../../components/toast.js'
import { addNotification } from '../../components/notification-hub.js';

const LS = 'hr_referrals';

const OPEN_POSITIONS = [
  { id: 'pos_001', title: '프론트엔드 개발자 (Senior)', dept: 'IT팀' },
  { id: 'pos_002', title: '데이터 분석가',               dept: '데이터팀' },
  { id: 'pos_003', title: '영업 매니저',                  dept: '영업팀' },
  { id: 'pos_004', title: 'HR 파트너',                    dept: 'HR팀' },
  { id: 'pos_005', title: '마케팅 플래너',                dept: '마케팅팀' },
  { id: 'pos_006', title: '재무 회계 담당자',             dept: '재무팀' },
];

const STATUS_META = {
  submitted: { label: '접수',      bg: '#EFF6FF', color: '#3B82F6' },
  reviewing: { label: '검토 중',   bg: '#FEF3C7', color: '#D97706' },
  interview: { label: '면접',      bg: '#EDE9FE', color: '#7C3AED' },
  hired:     { label: '채용 완료', bg: '#D1FAE5', color: '#059669' },
  rejected:  { label: '불합격',    bg: '#FEE2E2', color: '#EF4444' },
  withdrawn: { label: '취소',      bg: '#F1F5F9', color: '#64748B' },
};

const STAGE_ORDER = ['submitted','reviewing','interview','hired','rejected'];

let _employees = [];

function _load()  { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } }
function _save(d) { localStorage.setItem(LS, JSON.stringify(d)); }
function _emp(id) { return _employees.find(e => e.id === id || e.employee_id === id); }

function _seedDemo(all) {
  if (all.length >= 8) return all;
  const seeded = [...all];
  const statuses = ['submitted','reviewing','interview','hired','rejected','reviewing','submitted','interview'];
  _employees.slice(0, 8).forEach((emp, i) => {
    const label = '지원자 ' + (i + 1);
    seeded.push({
      id:             `demo_ref_${emp.id}`,
      referrerId:     emp.id || emp.employee_id,
      positionId:     OPEN_POSITIONS[i % OPEN_POSITIONS.length].id,
      candidateName:  label,
      candidatePhone: `010-${1000+i*11}-${2000+i*13}`,
      candidateEmail: `candidate${i+1}@example.com`,
      reason:         ['전 직장 동료, 해당 분야 5년 경력','대학 선배, React 전문가','영업 경험 풍부한 친구','HR 석사 졸업, 스타트업 경험','데이터 분석 전문가'][i%5],
      status:         statuses[i],
      incentivePaid:  statuses[i] === 'hired',
      incentiveAmount:statuses[i] === 'hired' ? 1000000 : 0,
      createdAt:      new Date(Date.now() - i * 86400000 * 4).toISOString(),
    });
  });
  return seeded;
}

let _tab = 'list';
let _sel = null;

export async function mount(root) {
  _tab = 'list'; _sel = null;
  root.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#94A3B8"><div style="font-size:32px;margin-bottom:8px">⏳</div><div style="font-size:13px">로딩 중…</div></div>`;
  _employees = await loadDisplayEmployees();
  _draw(root);
}

export function render(root) { _tab = 'list'; _sel = null; _draw(root); }
export function unmount() { _tab = 'list'; _sel = null; _employees = []; }

function _draw(root) {
  const raw = _load();
  const all = _seedDemo(raw);

  const totalRefs   = all.length;
  const hiredCount  = all.filter(r => r.status === 'hired').length;
  const convRate    = totalRefs ? Math.round(hiredCount / totalRefs * 100) : 0;
  const paidTotal   = all.filter(r => r.incentivePaid).reduce((s,r) => s+(r.incentiveAmount||0), 0);

  root.innerHTML = `
<!-- KPI -->
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:14px">
  ${[
    { l:'총 추천',   v: totalRefs,   c:'#4F46E5' },
    { l:'진행 중',   v: all.filter(r=>r.status==='reviewing'||r.status==='interview').length, c:'#F59E0B' },
    { l:'채용 완료', v: hiredCount,  c:'#10B981' },
    { l:'전환율',    v: convRate+'%',c: convRate>=20?'#10B981':convRate>=10?'#F59E0B':'#EF4444' },
  ].map(k=>`
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:8px;text-align:center">
      <div style="font-size:18px;font-weight:900;color:${k.c}">${k.v}</div>
      <div style="font-size:10px;color:#64748B">${k.l}</div>
    </div>`).join('')}
</div>

<!-- 인센티브 지급 현황 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
  <div>
    <div style="font-size:11px;color:#64748B">총 인센티브 지급액</div>
    <div style="font-size:20px;font-weight:900;color:#4F46E5">${paidTotal.toLocaleString()}원</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:11px;color:#64748B">미지급 대상</div>
    <div style="font-size:20px;font-weight:900;color:#F59E0B">${all.filter(r=>r.status==='hired'&&!r.incentivePaid).length}건</div>
  </div>
</div>

<!-- 채용 단계 퍼널 -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:14px">
  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px">채용 단계별 현황</div>
  ${STAGE_ORDER.map(s => {
    const cnt = all.filter(r => r.status === s).length;
    const pct = totalRefs ? Math.round(cnt / totalRefs * 100) : 0;
    const meta = STATUS_META[s];
    return `
<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
  <span style="width:60px;font-size:11px;color:${meta.color};font-weight:600">${meta.label}</span>
  <div style="flex:1;height:12px;background:#E2E8F0;border-radius:4px;overflow:hidden">
    <div style="height:100%;width:${pct}%;background:${meta.color};border-radius:4px"></div>
  </div>
  <span style="font-size:11px;color:#64748B;width:28px;text-align:right">${cnt}명</span>
</div>`;
  }).join('')}
</div>

<!-- 탭 -->
<div style="display:flex;border-bottom:1px solid var(--border);margin-bottom:12px">
  ${[{k:'list',l:'전체 목록'},{k:'by-pos',l:'공고별'},{k:'incentive',l:'인센티브'}].map(t=>`
    <button class="ra-tab" data-t="${t.k}"
      style="flex:1;padding:9px 4px;font-size:11px;font-weight:600;border:none;cursor:pointer;background:none;
             border-bottom:2px solid ${_tab===t.k?'#4F46E5':'transparent'};color:${_tab===t.k?'#4F46E5':'#64748B'}">
      ${t.l}
    </button>`).join('')}
</div>

${_tab === 'list'      ? _renderList(all)     : ''}
${_tab === 'by-pos'    ? _renderByPos(all)    : ''}
${_tab === 'incentive' ? _renderIncentive(all): ''}

<div id="ra-detail">${_sel ? _renderDetail(all) : ''}</div>`;

  root.querySelectorAll('.ra-tab').forEach(btn => {
    btn.addEventListener('click', () => { _tab = btn.dataset.t; _sel = null; _draw(root); });
  });

  root.querySelectorAll('.ra-item').forEach(el => {
    el.addEventListener('click', () => {
      _sel = _sel === el.dataset.id ? null : el.dataset.id;
      document.getElementById('ra-detail').innerHTML = _renderDetail(_seedDemo(_load()));
      _bindDetail(root);
    });
  });

  root.querySelectorAll('.ra-pay-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); _payIncentive(btn.dataset.id, root); });
  });

  _bindDetail(root);
}

function _renderList(all) {
  return all.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(r => _refCard(r)).join('');
}

function _renderByPos(all) {
  return OPEN_POSITIONS.map(p => {
    const pRefs = all.filter(r => r.positionId === p.id);
    if (!pRefs.length) return '';
    return `
<div style="margin-bottom:14px">
  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:6px">${p.title} <span style="font-weight:400;color:#94A3B8">(${pRefs.length}명)</span></div>
  ${pRefs.map(r => _refCard(r)).join('')}
</div>`;
  }).join('');
}

function _renderIncentive(all) {
  const hiredNotPaid = all.filter(r => r.status === 'hired' && !r.incentivePaid);
  const paid         = all.filter(r => r.incentivePaid);

  return `
${hiredNotPaid.length ? `
<div style="font-size:12px;font-weight:700;color:#D97706;margin-bottom:8px">⏳ 인센티브 미지급 (${hiredNotPaid.length}건)</div>
${hiredNotPaid.map(r => {
  const emp = _emp(r.referrerId);
  return `
<div style="background:var(--card-bg);border:1px solid #FCD34D;border-radius:11px;padding:11px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">
  <div>
    <div style="font-size:12px;font-weight:700;color:var(--text)">${r.candidateName} 채용</div>
    <div style="font-size:11px;color:#64748B">추천자: ${emp?emp.name:r.referrerId}</div>
  </div>
  <button class="ra-pay-btn" data-id="${r.id}"
    style="padding:7px 14px;border:none;border-radius:7px;background:#4F46E5;color:#fff;font-size:11px;font-weight:700;cursor:pointer">
    💰 지급 처리
  </button>
</div>`;
}).join('')}
<div style="height:1px;background:var(--border);margin:12px 0"></div>` : ''}

<div style="font-size:12px;font-weight:700;color:#10B981;margin-bottom:8px">✅ 지급 완료 (${paid.length}건)</div>
${paid.length ? paid.map(r => {
  const emp = _emp(r.referrerId);
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:5px;display:flex;justify-content:space-between;align-items:center">
  <div>
    <div style="font-size:12px;font-weight:700;color:var(--text)">${r.candidateName}</div>
    <div style="font-size:11px;color:#64748B">추천자: ${emp?emp.name:r.referrerId}</div>
  </div>
  <span style="font-size:13px;font-weight:800;color:#10B981">${(r.incentiveAmount||0).toLocaleString()}원</span>
</div>`;
}).join('') : `<div style="text-align:center;padding:20px;color:#94A3B8;font-size:12px">지급 내역 없음</div>`}`;
}

function _refCard(r) {
  const emp  = _emp(r.referrerId);
  const pos  = OPEN_POSITIONS.find(p => p.id === r.positionId);
  const meta = STATUS_META[r.status] || STATUS_META.submitted;
  return `
<div class="ra-item" data-id="${r.id}"
  style="background:var(--card-bg);border:1px solid ${_sel===r.id?'#4F46E5':'var(--border)'};
         border-radius:11px;padding:11px;margin-bottom:6px;cursor:pointer">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
    <div>
      <div style="font-size:13px;font-weight:700;color:var(--text)">${r.candidateName}</div>
      <div style="font-size:11px;color:#64748B">추천자: ${emp?emp.name:r.referrerId} · ${pos?.title||''}</div>
    </div>
    <span style="padding:2px 8px;border-radius:5px;font-size:11px;font-weight:600;background:${meta.bg};color:${meta.color}">${meta.label}</span>
  </div>
  <div style="font-size:10px;color:#94A3B8">${r.createdAt?.slice(0,10)||''}</div>
</div>`;
}

function _renderDetail(all) {
  const r = all.find(x => x.id === _sel);
  if (!r) return '';
  const emp  = _emp(r.referrerId);
  const pos  = OPEN_POSITIONS.find(p => p.id === r.positionId);
  const meta = STATUS_META[r.status] || STATUS_META.submitted;

  return `
<div style="background:var(--card-bg);border:2px solid #4F46E5;border-radius:14px;padding:16px;margin-top:4px">
  <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:12px">상세 / 단계 변경</div>
  <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px;font-size:12px">
    <div style="display:flex;gap:8px"><span style="color:#94A3B8;width:64px;flex-shrink:0">후보자</span><span style="font-weight:700;color:var(--text)">${r.candidateName}</span></div>
    <div style="display:flex;gap:8px"><span style="color:#94A3B8;width:64px;flex-shrink:0">연락처</span><span style="color:var(--text)">${r.candidatePhone}</span></div>
    <div style="display:flex;gap:8px"><span style="color:#94A3B8;width:64px;flex-shrink:0">공고</span><span style="color:var(--text)">${pos?.title||'-'}</span></div>
    <div style="display:flex;gap:8px"><span style="color:#94A3B8;width:64px;flex-shrink:0">추천자</span><span style="color:var(--text)">${emp?emp.name:r.referrerId}</span></div>
    ${r.reason ? `<div style="display:flex;gap:8px"><span style="color:#94A3B8;width:64px;flex-shrink:0">추천 사유</span><span style="color:var(--text)">${r.reason}</span></div>` : ''}
    <div style="display:flex;gap:8px"><span style="color:#94A3B8;width:64px;flex-shrink:0">현재 단계</span><span style="padding:2px 8px;border-radius:5px;font-size:11px;font-weight:600;background:${meta.bg};color:${meta.color}">${meta.label}</span></div>
  </div>

  <div style="font-size:11px;color:#64748B;margin-bottom:6px">단계 변경</div>
  <div style="display:flex;gap:5px;flex-wrap:wrap">
    ${STAGE_ORDER.map(s => {
      const m = STATUS_META[s];
      return `<button class="ra-stage-btn" data-stage="${s}" data-id="${r.id}"
        style="flex:1;min-width:56px;padding:7px 4px;border:2px solid ${r.status===s?m.color:'var(--border)'};border-radius:7px;
               background:${r.status===s?m.bg:'var(--card-bg)'};color:${r.status===s?m.color:'#64748B'};font-size:10px;font-weight:700;cursor:pointer">
        ${m.label}
      </button>`;
    }).join('')}
  </div>
</div>`;
}

function _bindDetail(root) {
  root.querySelectorAll('.ra-stage-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      _updateStage(btn.dataset.id, btn.dataset.stage, root);
    });
  });
}

function _updateStage(id, stage, root) {
  const all = _load();
  const idx = all.findIndex(r => r.id === id);
  if (idx < 0) { showToast('데모 데이터는 수정할 수 없습니다.', 'error'); _sel = null; _draw(root); return; }
  all[idx].status = stage;
  _save(all);
  showToast(`"${STATUS_META[stage]?.label}" 단계로 변경되었습니다.`);
      addNotification({ type: "success", title: "추천 채용 관리", body: `"${STATUS_META[stage]?.label}" 단계로 변경되었습니다.` });
  _sel = null;
  _draw(root);
}

function _payIncentive(id, root) {
  const all = _load();
  const idx = all.findIndex(r => r.id === id);
  if (idx < 0) { showToast('데모 데이터는 수정할 수 없습니다.', 'error'); _draw(root); return; }
  all[idx].incentivePaid   = true;
  all[idx].incentiveAmount = 1000000;
  all[idx].paidAt          = new Date().toISOString();
  _save(all);
  showToast('인센티브 1,000,000원 지급 처리 완료 🎉');
  _draw(root);
}
