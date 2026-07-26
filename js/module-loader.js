/**
 * module-loader.js — HR OS Module System Core
 *
 * Loads, sandboxes and mounts user-created or built-in modules.
 *
 * Module interface (every module must export):
 *   export const meta = { id, name, version, author, permissions }
 *   export async function mount(root, ctx) { ... }
 *   export function unmount() { ... }
 *
 * ctx object passed to mount():
 *   ctx.user      — current logged-in user
 *   ctx.api       — safe API methods (limited to declared permissions)
 *   ctx.store     — namespaced localStorage key-value store
 *   ctx.navigate  — SPA navigation helper
 *   ctx.showToast — toast helper
 */

import { validateRuntimeModule } from './module-contract.js';

// ── Built-in module registry ──────────────────────────────────────────────────
// Phase 1: modules are static files. Phase 2 (AI builder) will serve from DB.

const BUILTIN_REGISTRY = {
  'team-checkin': () => import('./modules/team-checkin.js'),
  'goal-tracker': () => import('./modules/goal-tracker.js'),
  'family-event-workflow': () => import('./modules/family-event-workflow.js'),
};

// ── Permission → API method map ───────────────────────────────────────────────

function _localFetch(path, opts = {}) {
  const token = localStorage.getItem('hr_token');
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(path, { ...opts, headers })
    .then(r => r.json().catch(() => ({})));
}

function _buildApi(permissions, user) {
  const orgId = user.org_id;
  const api   = {};

  if (permissions.includes('read:employees')) {
    api.getEmployees = () =>
      _localFetch(`/api/org/${orgId}/employees?status=ALL`).then(d => d.employees || []);
  }

  if (permissions.includes('read:surveys')) {
    api.getSurveyResponses = (uid = user.id) =>
      _localFetch(`/api/survey/responses/${uid}`).then(d => d.responses || []);
  }

  if (permissions.includes('read:assessments')) {
    api.getInstances = (uid = user.id) =>
      _localFetch(`/api/users/${uid}/instances`).then(d => d.instances || []);
  }

  if (permissions.includes('read:analytics')) {
    api.getAnalytics = (uid = user.id, cycleId) => {
      const qs = cycleId ? `?cycle=${cycleId}` : '';
      return _localFetch(`/api/analytics/individual/${uid}${qs}`);
    };
  }

  if (permissions.includes('write:goals')) {
    api.getGoals = (uid = user.id) =>
      _localFetch(`/api/performance/goals/${uid}`).then(d => d.goals || []);
    api.saveGoal = goal =>
      _localFetch('/api/performance/goals', {
        method: 'POST', body: JSON.stringify({ ...goal, user_id: user.id, org_id: orgId }),
      });
  }

  if (permissions.includes('write:surveys')) {
    api.saveSurveyResponse = data =>
      _localFetch('/api/survey/responses', {
        method: 'POST', body: JSON.stringify({ ...data, user_id: user.id, org_id: orgId }),
      });
  }

  return api;
}

// ── Sandboxed store (namespaced localStorage) ─────────────────────────────────

function _buildStore(moduleId) {
  const ns = `mod_${moduleId}_`;
  return {
    get:    key => { try { return JSON.parse(localStorage.getItem(ns + key)); } catch { return null; } },
    set:    (key, val) => localStorage.setItem(ns + key, JSON.stringify(val)),
    remove: key  => localStorage.removeItem(ns + key),
    keys:   ()   => Object.keys(localStorage)
      .filter(k => k.startsWith(ns))
      .map(k => k.slice(ns.length)),
  };
}

// ── Dynamic code loader via Blob URL ─────────────────────────────────────────

async function _loadFromCode(code) {
  const blob = new Blob([code], { type: 'text/javascript' });
  const url  = URL.createObjectURL(blob);
  try {
    return await import(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve and load a module by ID.
 * Tries built-in registry first, then falls back to the API for DB modules.
 */
export async function resolveModule(moduleId) {
  // 1. Built-in static module
  if (BUILTIN_REGISTRY[moduleId]) {
    const mod = await BUILTIN_REGISTRY[moduleId]();
    validateRuntimeModule(moduleId, mod);
    return mod;
  }

  // 2. DB module — fetch code and load via Blob URL
  const token = localStorage.getItem('hr_token');
  const resp  = await fetch(`/api/modules/${moduleId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) throw new Error(`Module "${moduleId}" not found`);

  const { module: modData } = await resp.json();
  const meta = modData.meta || {};

  // Built-in file path stored in meta
  if (meta.builtin && meta.src) {
    const mod = await import(meta.src);
    validateRuntimeModule(moduleId, mod, meta);
    return mod;
  }

  // Inline code stored in DB
  if (modData.code) {
    const mod = await _loadFromCode(modData.code);
    validateRuntimeModule(moduleId, mod, meta);
    return mod;
  }

  throw new Error(`Module "${moduleId}" has no loadable code`);
}

/**
 * Full lifecycle: resolve → validate → create ctx → mount.
 * Returns { unmount } so the caller can clean up.
 */
export async function mountModule(moduleId, containerEl, user) {
  const mod = await resolveModule(moduleId);

  const meta        = validateRuntimeModule(moduleId, mod);
  const permissions = meta.permissions || [];

  const ctx = {
    user,
    api:      _buildApi(permissions, user),
    store:    _buildStore(moduleId),
    navigate: hash => { window.location.hash = hash; },
    showToast: (msg, type = 'info') =>
      import('./components/toast.js').then(m => m.showToast(msg, type)),
  };

  await mod.mount(containerEl, ctx);

  return {
    unmount: () => {
      try { if (typeof mod.unmount === 'function') mod.unmount(); } catch {}
    },
  };
}
