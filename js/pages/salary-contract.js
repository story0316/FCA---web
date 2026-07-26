/**
 * salary-contract.js — 연봉 계약서 (직원)
 */
import { isApplicant } from '../auth.js';
import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

const LS = 'hr_salary_contracts';

function _session() { try { return JSON.parse(localStorage.getItem('hr_session')||'{}'); } catch { return {}; } }
function _empId()  { const s = _session(); return s.empId || s.userId || 'EMP001'; }
function _fmtKRW(n) { return (n/10000).toFixed(0)+'만원'; }

function _getDemoContracts() {
  const s = _session();
  const empId = _empId();
  const name = s.name || s.name_ko || '직원';
  const dept = s.dept || s.department || '소속 미지정';
  const base = s.baseSalary || 48000000;
  return [
    { id:`SC_${empId}_2026`, empId, empName:name, dept, year:2026, baseSalary:base, bonus:Math.round(base*0.125), totalComp:Math.round(base*1.125), status:'pending_sign', issuedDate:'2026-01-02', signedDate:null },
    { id:`SC_${empId}_2025`, empId, empName:name, dept, year:2025, baseSalary:Math.round(base*0.9), bonus:Math.round(base*0.1), totalComp:Math.round(base), status:'signed', issuedDate:'2025-01-02', signedDate:'2025-01-05' },
  ];
}

function _getAll() {
  const demos = _getDemoContracts();
  const s = localStorage.getItem(LS);
  if (!s) { localStorage.setItem(LS, JSON.stringify(demos)); return demos; }
  try {
    const d = JSON.parse(s);
    return [...demos.filter(dc=>!d.find(c=>c.id===dc.id)), ...d];
  } catch { return demos; }
}
function _saveAll(l) { localStorage.setItem(LS, JSON.stringify(l)); }

let _root = null;

export async function mount(root) {
  if (isApplicant()) {
    root.innerHTML = `<div style="padding:60px 24px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">재직 구성원 전용 기능입니다</div>
      <div style="font-size:13px;color:var(--text-muted)">입사 후 이용 가능합니다.</div>
    </div>`;
    return;
  } _root=root; _render(); }
export function unmount() { _root=null; }

function _render() {
  const mine = _getAll().filter(c=>c.empId===_empId()).sort((a,b)=>b.year-a.year);
  const pending = mine.filter(c=>c.status==='pending_sign').length;

  _root.innerHTML = `
<div class="page" style="display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--card-bg);border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="sc-back" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);padding:0">←</button>
    <div style="flex:1"><div style="font-size:15px;font-weight:700">📑 연봉 계약서</div><div style="font-size:11px;color:var(--text-muted)">서명 대기 ${pending}건</div></div>
    ${pending?`<div style="background:#EF4444;color:#fff;border-radius:99px;padding:3px 10px;font-size:12px;font-weight:700">${pending}</div>`:''}
  </div>
  <div class="page-content" style="flex:1;overflow-y:auto;padding:14px 16px">
    ${!mine.length?`<div style="text-align:center;padding:48px 16px;color:var(--text-muted)">
      <div style="font-size:40px;margin-bottom:10px">📑</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:6px;color:var(--text)">발행된 계약서가 없습니다</div>
      <button onclick="location.hash='#/salary-contract'" style="margin-top:14px;padding:9px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">근로계약서 요청</button>
    
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:20px">연봉 계약 시즌이 되면 인사팀이 발송해드립니다</div>
      <a href="#/salary-raise" style="display:inline-block;padding:10px 20px;background:#4F46E5;color:#fff;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none">
        연봉 인상 요청하기 →
      </a>
    </div>`:mine.map(c=>`
<div style="background:var(--card-bg);border:2px solid ${c.status==='pending_sign'?'#FCD34D':'var(--border)'};border-radius:14px;padding:14px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;margin-bottom:10px">
    <div><div style="font-size:14px;font-weight:700">${c.year}년 연봉 계약서</div><div style="font-size:11px;color:var(--text-muted)">${c.dept} · 발행일 ${c.issuedDate}</div></div>
    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;background:${c.status==='pending_sign'?'#FEF3C7':'#ECFDF5'};color:${c.status==='pending_sign'?'#92400E':'#10B981'}">${c.status==='pending_sign'?'서명 필요':'서명 완료'}</span>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;background:var(--bg);border-radius:10px;padding:10px;text-align:center;margin-bottom:${c.status==='pending_sign'?'12':'0'}px">
    <div><div style="font-size:16px;font-weight:800;color:#4F46E5">${_fmtKRW(c.baseSalary)}</div><div style="font-size:10px;color:var(--text-muted)">기본급</div></div>
    <div><div style="font-size:16px;font-weight:800;color:#F59E0B">${_fmtKRW(c.bonus)}</div><div style="font-size:10px;color:var(--text-muted)">성과급</div></div>
    <div><div style="font-size:16px;font-weight:800;color:#10B981">${_fmtKRW(c.totalComp)}</div><div style="font-size:10px;color:var(--text-muted)">총연봉</div></div>
  </div>
  ${c.status==='pending_sign'?`<button class="sc-sign" data-id="${c.id}" style="width:100%;padding:11px;background:#4F46E5;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">✍️ 전자 서명</button>`:''}
  ${c.signedDate?`<div style="font-size:11px;color:#10B981;margin-top:4px;text-align:center">✓ ${c.signedDate} 서명 완료</div>`:''}
</div>`).join('')}
  </div>
</div>`;

  _root.querySelector('#sc-back').addEventListener('click',()=>window.navBack());
  _root.querySelectorAll('.sc-sign').forEach(btn=>btn.addEventListener('click',()=>{
    const all=_getAll(); const c=all.find(x=>x.id===btn.dataset.id); if(!c) return;
    c.status='signed'; c.signedDate=new Date().toISOString().slice(0,10); _saveAll(all);
    showToast(`${c.year}년 연봉 계약서에 서명했습니다.`,'success')
    addNotification({ type: 'success', title: '근로계약서', body: '년 연봉 계약서에 서명했습니다.' }); _render();
  }));
}
