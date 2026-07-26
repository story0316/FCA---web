/**
 * realtime.js — Supabase Realtime subscriptions
 *
 * Listens for:
 *   - assessment_instances: INSERT (new assignment), UPDATE (status change)
 *   - idp_items: INSERT (new IDP generated)
 *
 * Each event generates an addNotification() call.
 * Falls back silently if Supabase is unavailable (demo/local mode).
 */

import { supabase }       from '../api.js';
import { addNotification } from '../components/notification-hub.js';
import { getUser }         from '../auth.js';

let _channel = null;
let _orgId   = null;

// ── Public ─────────────────────────────────────────────────────

export function startRealtime() {
  const user = getUser();
  if (!user?.id || user.id === 'demo') return;
  if (_channel) return;             // already running

  const isLocalMode = Boolean(localStorage.getItem('hr_local_backend'));
  if (isLocalMode) return;          // skip for local SQLite backend

  const orgId = user.org_id || user.organization_id;
  _orgId = orgId;

  try {
    _channel = supabase
      .channel(`org_${orgId}_events`)

      // ── New assessment instance assigned to this user ──────────
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'assessment_instances',
          filter: `assessee_id=eq.${user.id}`,
        },
        (payload) => {
          const inst = payload.new;
          addNotification({
            id:    `rt_inst_${inst.id}`,
            type:  'assessment',
            title: '새 역량 평가 배정',
            body:  `새로운 역량 평가가 배정되었습니다. 지금 바로 확인하세요.`,
            route: '#/assessment',
          });
        },
      )

      // ── Assessment instance status changed ─────────────────────
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'assessment_instances',
          filter: `assessee_id=eq.${user.id}`,
        },
        (payload) => {
          const inst   = payload.new;
          const old    = payload.old;
          if (inst.status === old.status) return;

          const STATUS_MSG = {
            manager_evaluation: '관리자 평가 단계로 전환되었습니다.',
            calibration:        '캘리브레이션 단계로 전환되었습니다.',
            completed:          '역량 평가가 완료되었습니다. 결과를 확인하세요.',
          };
          const msg = STATUS_MSG[inst.status];
          if (!msg) return;

          addNotification({
            id:    `rt_status_${inst.id}_${inst.status}`,
            type:  'assessment',
            title: '평가 상태 변경',
            body:  msg,
            route: '#/results',
          });
        },
      )

      // ── New IDP items generated ────────────────────────────────
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'idp_items',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          addNotification({
            id:    `rt_idp_${payload.new.id}`,
            type:  'idp',
            title: 'IDP 개발 과제 생성',
            body:  `새로운 개인 성장 계획이 생성되었습니다. 확인해 보세요.`,
            route: '#/growth',
          });
        },
      )

      // ── Org-level cycle status changes (admin) ─────────────────
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'assessment_cycles',
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          const cycle = payload.new;
          const old   = payload.old;
          if (cycle.status === old.status) return;
          if (cycle.status !== 'closed') return;
          addNotification({
            id:    `rt_cycle_closed_${cycle.id}`,
            type:  'system',
            title: '평가 사이클 종료',
            body:  `"${cycle.cycle_name || '평가 사이클'}"이 종료되었습니다.`,
            route: '#/analytics',
          });
        },
      )

      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] channel error — stopping');
          stopRealtime();
        }
      });
  } catch (err) {
    console.warn('[Realtime] init failed:', err.message);
  }
}

export function stopRealtime() {
  if (_channel) {
    supabase.removeChannel(_channel).catch(() => {});
    _channel = null;
  }
}
