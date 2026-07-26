/**
 * doc-review.js — HR 관리자 입사 서류 검토/승인 (E-2)
 * hr_submitted_docs 읽기 → 승인/반려 → hr_user.docs_verified, hr_personnel_history 기록
 */

import { showToast } from '../../components/toast.js';
import { addNotification } from '../../components/notification-hub.js';

const LS_DOCS = 'hr_submitted_docs';

const DOC_LABELS = {
  id_cert:     '주민등록초본',
  diploma:     '졸업(재학)증명서',
  career_cert: '경력증명서',
  bankbook:    '통장 사본',
  family_cert: '가족관계증명서',
};

function _getDocs() {
  try { return JSON.parse(localStorage.getItem(LS_DOCS) || '[]'); } catch { return []; }
}

function _saveDocs(list) { localStorage.setItem(LS_DOCS, JSON.stringify(list)); }

export function render(root) { _renderPage(root); }
export async function mount(root) { return render(root); }

function _renderPage(root) {
  const docs = _getDocs();
  const pending  = docs.filter(d => d.status === 'pending_review');
  const approved = docs.filter(d => d.status === 'approved');
  const rejected = docs.filter(d => d.status === 'rejected');

  root.innerHTML = `
<div style="padding:16px">
  <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:4px">📂 입사 서류 검토</div>
  <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px">입사 예정자가 제출한 서류를 검토하고 승인하세요.</div>

  <!-- KPI -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
    ${[
      { label:'검토 대기',  value: pending.length,  color:'#F59E0B', bg:'#FEF3C7' },
      { label:'승인 완료',  value: approved.length, color:'#10B981', bg:'#D1FAE5' },
      { label:'반려',       value: rejected.length, color:'#EF4444', bg:'#FEE2E2' },
    ].map(k => `
    <div style="background:${k.bg};border-radius:12px;padding:12px;text-align:center">
      <div style="font-size:22px;font-weight:800;color:${k.color}">${k.value}</div>
      <div style="font-size:10px;color:${k.color};margin-top:2px;font-weight:600">${k.label}</div>
    </div>`).join('')}
  </div>

  ${!docs.length ? `
  <div style="text-align:center;padding:60px 24px;background:var(--card-bg);border:1px solid var(--border);border-radius:16px">
    <div style="font-size:40px;margin-bottom:12px">📄</div>
    <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:6px">제출된 서류가 없습니다</div>
    <div style="font-size:13px;color:var(--text-muted)">입사 예정자가 온보딩 서류를 제출하면 이 화면에 표시됩니다.</div>
  </div>` : `

  ${pending.length ? `
  <div style="font-size:12px;font-weight:700;color:#F59E0B;margin-bottom:8px">⏳ 검토 대기 (${pending.length}건)</div>
  ${pending.map(d => _docCard(d, root)).join('')}` : ''}

  ${approved.length ? `
  <div style="font-size:12px;font-weight:700;color:#10B981;margin-top:16px;margin-bottom:8px">✅ 승인 완료 (${approved.length}건)</div>
  ${approved.map(d => _docCard(d, root)).join('')}` : ''}

  ${rejected.length ? `
  <div style="font-size:12px;font-weight:700;color:#EF4444;margin-top:16px;margin-bottom:8px">❌ 반려 (${rejected.length}건)</div>
  ${rejected.map(d => _docCard(d, root)).join('')}` : ''}
  `}
</div>`;

  root.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', () => _updateDoc(btn.dataset.id, 'approved', root));
  });
  root.querySelectorAll('.reject-btn').forEach(btn => {
    btn.addEventListener('click', () => _updateDoc(btn.dataset.id, 'rejected', root));
  });
}

function _docCard(d, root) {
  const isPending = d.status === 'pending_review';
  const statusColor = { pending_review:'#F59E0B', approved:'#10B981', rejected:'#EF4444' }[d.status];
  const statusLabel = { pending_review:'검토 대기', approved:'승인', rejected:'반려' }[d.status];
  return `
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
     padding:12px 14px;margin-bottom:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div>
      <div style="font-size:13px;font-weight:700;color:var(--text)">${DOC_LABELS[d.docKey] || d.docLabel || d.docKey}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${d.name} · ${d.submittedAt ? d.submittedAt.slice(0,10) : ''}</div>
    </div>
    <span style="font-size:11px;font-weight:600;padding:3px 9px;border-radius:9999px;
      color:${statusColor};background:${statusColor}22">${statusLabel}</span>
  </div>
  ${isPending ? `
  <div style="display:flex;gap:8px;margin-top:8px">
    <button class="approve-btn" data-id="${d.id}"
      style="flex:1;background:#10B981;color:#fff;border:none;border-radius:8px;
             padding:8px;font-size:12px;font-weight:700;cursor:pointer">✅ 승인</button>
    <button class="reject-btn" data-id="${d.id}"
      style="flex:1;background:#EF4444;color:#fff;border:none;border-radius:8px;
             padding:8px;font-size:12px;font-weight:700;cursor:pointer">❌ 반려</button>
  </div>` : ''}
</div>`;
}

function _updateDoc(docId, newStatus, root) {
  const docs = _getDocs();
  const idx = docs.findIndex(d => d.id === docId);
  if (idx < 0) return;

  docs[idx].status = newStatus;
  docs[idx].reviewedAt = new Date().toISOString();
  _saveDocs(docs);

  const doc = docs[idx];

  // 승인 시: 해당 직원 hr_user의 docs_verified 갱신 + 인사 이력 기록
  if (newStatus === 'approved') {
    try {
      // hr_user (현재 로그인된 사용자가 본인이면 갱신 — 데모 환경에서는 userId 매칭)
      const hrUser = JSON.parse(localStorage.getItem('hr_user') || '{}');
      if (hrUser.id === doc.userId || !doc.userId || doc.userId === 'NEW') {
        hrUser.docs_verified = true;
        localStorage.setItem('hr_user', JSON.stringify(hrUser));
      }

      // 인사 이력
      const history = JSON.parse(localStorage.getItem('hr_personnel_history') || '[]');
      history.unshift({
        id:            'PH_DOC_' + Date.now(),
        userId:        doc.userId || 'NEW',
        name:          doc.name,
        dept:          '신규 입사',
        type:          'hire',
        prevValue:     null,
        newValue:      `서류 승인: ${DOC_LABELS[doc.docKey] || doc.docLabel}`,
        effectiveDate: new Date().toISOString().slice(0, 10),
        memo:          'HR 담당자 서류 검토 완료',
      });
      localStorage.setItem('hr_personnel_history', JSON.stringify(history));

      // 직원에게 승인 알림
      const notifs = JSON.parse(localStorage.getItem('hr_notifications') || '[]');
      notifs.unshift({
        id:        'NOTIF_DOCAPPROVE_' + Date.now(),
        type:      'success',
        title:     `서류 승인 완료 — ${DOC_LABELS[doc.docKey] || doc.docLabel}`,
        body:      '제출하신 서류가 승인되었습니다.',
        link:      '#/onboarding',
        read:      false,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('hr_notifications', JSON.stringify(notifs));
    } catch {}

    showToast('서류가 승인되었습니다. ✅', 'success');
    addNotification({ type: 'success', title: '서류 승인', body: `${doc.name} · ${DOC_LABELS[doc.docKey] || doc.docLabel}` });
  } else {
    // 반려 알림
    try {
      const notifs = JSON.parse(localStorage.getItem('hr_notifications') || '[]');
      notifs.unshift({
        id:        'NOTIF_DOCREJECT_' + Date.now(),
        type:      'warning',
        title:     `서류 재제출 요청 — ${DOC_LABELS[doc.docKey] || doc.docLabel}`,
        body:      '서류가 반려되었습니다. 온보딩 페이지에서 다시 제출해 주세요.',
        link:      '#/onboarding',
        read:      false,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('hr_notifications', JSON.stringify(notifs));
    } catch {}

    showToast('서류가 반려되었습니다.', 'warning');
  }

  _renderPage(root);
}
