/**
 * family-event-workflow.js
 *
 * First Default Module migration. It reuses the existing employee and admin
 * implementations so current local data remains compatible during the move
 * from core pages to the module runtime.
 */

export const meta = {
  id: 'family-event-workflow',
  name: '경조사 신청·승인',
  version: '1.0.0',
  author: 'system',
  permissions: [],
  description: '경조금과 경조휴가 신청부터 HR 승인·지급까지 관리합니다.',
};

let activePage = null;

export async function mount(root, ctx) {
  const role = ctx.user?.role || 'staff';
  const isAdmin = role === 'hr_admin' || role === 'super_admin';

  activePage = isAdmin
    ? await import('../pages/admin/family-event-admin.js')
    : await import('../pages/family-event.js');

  if (typeof activePage.mount !== 'function') {
    throw new Error('경조사 화면에 mount() 함수가 없습니다');
  }

  await activePage.mount(root);
}

export function unmount() {
  if (typeof activePage?.unmount === 'function') {
    activePage.unmount();
  }
  activePage = null;
}
