/**
 * interview-portal.js — 면접관 포털 (D-2)
 * 면접관으로 배정된 지원자 목록 조회 + 지원서·레퍼런스 정보 확인 + 면접 메모 작성
 */

import { showToast } from '../components/toast.js';
import { addNotification } from '../components/notification-hub.js';

function _getUser() {
  try { return JSON.parse(localStorage.getItem('hr_user') || '{}'); } catch { return {}; }
}

function _getApplicants() {
  try { return JSON.parse(localStorage.getItem('hr_applicants') || '[]'); } catch { return []; }
}

function _getRefs() {
  try { return JSON.parse(localStorage.getItem('hr_ref_requests') || '[]'); } catch { return []; }
}

function _getAppData() {
  try { return JSON.parse(localStorage.getItem('hr_applicant_form') || '{}'); } catch { return {}; }
}

let _selectedId = null;

export function render(root) { _renderPage(root); }
export async function mount(root) { return render(root); }
export function unmount() { _selectedId = null; }

function _renderPage(root) {
  if (_selectedId) { _renderDetail(root); return; }
  _renderList(root);
}

function _renderList(root) {
  const user = _getUser();
  const myName = user.name || '';
  const allApplicants = _getApplicants();

  // 배정된 면접 = interviewers 배열에 내 이름 포함
  // interviewers 형식: "김지수 (개발팀)" → 이름 부분만 추출해 정확 비교
  const assigned = myName ? allApplicants.filter(a =>
    Array.isArray(a.interviewers) &&
    a.interviewers.some(i => {
      const namePart = i.split('(')[0].trim();
      return namePart === myName;
    })
  ) : [];

  root.innerHTML = `
<div style="padding:16px">
  <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:4px">🎤 면접관 포털</div>
  <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px">배정된 면접 일정을 확인하고 평가를 기록하세요.</div>

  ${!assigned.length ? `
  <div style="text-align:center;padding:60px 24px;background:var(--card-bg);border:1px solid var(--border);border-radius:16px">
    <div style="font-size:40px;margin-bottom:12px">📋</div>
    <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:6px">배정된 면접이 없습니다</div>
    <div style="font-size:13px;color:var(--text-muted)">HR 담당자가 면접관을 배정하면 이 화면에 표시됩니다.</div>
  </div>` : assigned.map(a => {
    const refs = _getRefs();
    const ref  = refs.find(r => r.applicantId === a.id || r.applicantName === a.name);
    const refDone = ref?.referees?.length > 0 && ref.referees.every(r => r.status === 'completed');
    const stageLabel = { interview1:'1차 면접', interview2:'2차 면접' }[a.stage] || a.stage;
    const hasMemo = !!a.interviewMemo;
    return `
  <div class="appl-card" data-id="${a.id}"
    style="background:var(--card-bg);border:1.5px solid var(--border);border-radius:14px;
           padding:14px 16px;margin-bottom:10px;cursor:pointer">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:15px;font-weight:700;color:var(--text)">${a.name}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${a.email || ''} · 지원일 ${a.appliedAt || '-'}</div>
      </div>
      <span style="font-size:11px;padding:3px 9px;border-radius:9999px;font-weight:600;
        background:#F5F3FF;color:#8B5CF6">${stageLabel}</span>
    </div>
    <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
      ${ref ? (refDone
        ? `<span style="font-size:10px;padding:2px 8px;background:#D1FAE5;color:#065F46;border-radius:9999px;font-weight:600">✅ 레퍼런스 완료</span>`
        : `<span style="font-size:10px;padding:2px 8px;background:#FEF3C7;color:#92400E;border-radius:9999px;font-weight:600">⏳ 레퍼런스 진행 중</span>`)
      : `<span style="font-size:10px;padding:2px 8px;background:#F1F5F9;color:#64748B;border-radius:9999px">레퍼런스 없음</span>`}
      ${hasMemo ? `<span style="font-size:10px;padding:2px 8px;background:#EFF6FF;color:#3B82F6;border-radius:9999px;font-weight:600">📝 메모 작성됨</span>` : ''}
    </div>
  </div>`;
  }).join('')}
</div>`;

  root.querySelectorAll('.appl-card').forEach(card => {
    card.addEventListener('click', () => {
      _selectedId = card.dataset.id;
      _renderPage(root);
    });
  });
}

function _renderDetail(root) {
  const applicants = _getApplicants();
  const a = applicants.find(ap => ap.id === _selectedId);
  if (!a) { _selectedId = null; _renderPage(root); return; }

  const refs  = _getRefs();
  const ref   = refs.find(r => r.applicantId === a.id || r.applicantName === a.name);
  const appForm = _getAppData();
  const stageLabel = { interview1:'1차 면접', interview2:'2차 면접' }[a.stage] || a.stage;

  root.innerHTML = `
<div style="padding:16px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
    <button id="back-btn" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text)">←</button>
    <div>
      <div style="font-size:15px;font-weight:700;color:var(--text)">${a.name}</div>
      <div style="font-size:11px;color:var(--text-muted)">${stageLabel}</div>
    </div>
  </div>

  <!-- 지원서 요약 -->
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">📄 지원서 정보</div>
    ${_infoRow('이름',       a.name || '-')}
    ${_infoRow('이메일',     a.email || '-')}
    ${_infoRow('전화번호',   a.phone || '-')}
    ${_infoRow('지원 직군',  appForm?.jobTitle || a.jobTitle || '-')}
    ${_infoRow('지원일',     a.appliedAt || '-')}
    ${_infoRow('HR 메모',    a.note || '없음')}
    ${a.resumeUrl && a.resumeUrl !== '#' ? `
    <a href="${a.resumeUrl}" target="_blank"
       style="display:inline-block;margin-top:8px;padding:6px 14px;background:#EFF6FF;
              color:#3B82F6;border-radius:8px;font-size:12px;font-weight:600;text-decoration:none">
      📎 이력서 열기
    </a>` : ''}
  </div>

  <!-- 레퍼런스 체크 결과 -->
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">🔍 레퍼런스 체크</div>
    ${!ref ? `<div style="font-size:13px;color:var(--text-muted)">레퍼런스 체크 요청 없음</div>` : `
    ${_infoRow('상태', ref.referees?.every(r => r.status === 'completed') ? '✅ 완료' : '⏳ 진행 중')}
    ${ref.referees?.length ? ref.referees.map(r => `
    <div style="margin-top:8px;padding:8px 10px;background:var(--bg);border-radius:10px">
      <div style="font-size:12px;font-weight:600;color:var(--text)">${r.name || '-'} (${r.relation || '-'})</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${r.feedback || '응답 대기 중'}</div>
    </div>`).join('') : ''}`}
  </div>

  <!-- 면접 메모 -->
  <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">📝 면접 메모</div>
    <textarea id="interview-memo" placeholder="면접 내용, 인상, 평가 등을 자유롭게 기록하세요…"
      style="width:100%;min-height:120px;padding:10px 12px;border:1.5px solid var(--border);
             border-radius:10px;font-size:13px;background:var(--bg);color:var(--text);
             box-sizing:border-box;resize:vertical">${a.interviewMemo || ''}</textarea>

    <!-- 면접 점수 -->
    <div style="margin-top:12px">
      <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px">면접 평가 점수</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        ${[
          { key:'scoreComm',    label:'커뮤니케이션' },
          { key:'scoreLogic',   label:'논리적 사고' },
          { key:'scoreMotiv',   label:'동기·열정' },
        ].map(s => `
        <div style="text-align:center">
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">${s.label}</div>
          <select id="${s.key}" style="width:100%;padding:6px;border:1.5px solid var(--border);
            border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);text-align:center">
            <option value="">-</option>
            ${[1,2,3,4,5].map(n => `<option value="${n}" ${a[s.key]==n?'selected':''}>${n}점</option>`).join('')}
          </select>
        </div>`).join('')}
      </div>
    </div>

    <button id="save-memo-btn" style="width:100%;margin-top:12px;background:#8B5CF6;color:#fff;
      border:none;border-radius:10px;padding:12px;font-size:14px;font-weight:700;cursor:pointer">
      메모·평가 저장
    </button>
  </div>
</div>`;

  root.querySelector('#back-btn').addEventListener('click', () => {
    _selectedId = null;
    _renderPage(root);
  });

  root.querySelector('#save-memo-btn').addEventListener('click', () => {
    const list = _getApplicants();
    const idx = list.findIndex(ap => ap.id === _selectedId);
    if (idx < 0) return;
    list[idx].interviewMemo  = root.querySelector('#interview-memo').value.trim();
    list[idx].scoreComm  = root.querySelector('#scoreComm').value;
    list[idx].scoreLogic = root.querySelector('#scoreLogic').value;
    list[idx].scoreMotiv = root.querySelector('#scoreMotiv').value;
    localStorage.setItem('hr_applicants', JSON.stringify(list));
    showToast('면접 메모·평가가 저장되었습니다.', 'success');
    addNotification({ type: 'success', title: '면접 평가 저장', body: `${list[idx].name} 면접 메모 저장` });
    _renderPage(root);
  });
}

function _infoRow(label, value) {
  return `<div style="display:flex;gap:8px;margin-bottom:6px;font-size:13px">
    <span style="color:var(--text-muted);min-width:72px;flex-shrink:0">${label}</span>
    <span style="color:var(--text);font-weight:500">${value}</span>
  </div>`;
}
