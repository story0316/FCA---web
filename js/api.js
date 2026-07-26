/**
 * api.js – Supabase client + HR Competency API interface
 * HR Competency OS
 *
 * All methods return null in demo mode (hr_token === 'demo-token').
 * Page-level code is responsible for falling back to demo data when null is returned.
 *
 * AI evaluation (Anthropic Claude) is intentionally DISABLED.
 * Interview scoring is always done client-side via buildDemoEvalResult().
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { seedDemoDataForUser } from './utils/demo-seed.js';

const SUPABASE_URL  = 'https://njqhtxtirwhffxnhwbqo.supabase.co';
const SUPABASE_ANON = 'sb_publishable_4tyDyQh12xIDKmscGBkmPQ_tD0I0hIh';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);


function isLocalBackend() {
  const h = window.location.hostname;
  return h === 'localhost'
    || h === '127.0.0.1'
    || h === '0.0.0.0'
    || h.endsWith('.onrender.com');
}

async function localFetch(path, opts = {}) {
  const r = await fetch(path, opts);
  const ct = (r.headers.get('content-type') || '');
  const data = ct.includes('application/json') ? await r.json().catch(() => null) : await r.text().catch(() => '');
  if (!r.ok) {
    const msg = (data && data.error) ? data.error : (typeof data === 'string' ? data : 'Request failed');
    throw new Error(msg);
  }
  return data;
}

function authHeaders(extra = {}) {
  const token = localStorage.getItem('hr_token');
  return token ? { ...extra, 'Authorization': `Bearer ${token}` } : { ...extra };
}

// Aliases used by legacy-style fetch blocks — LOCAL_BACKEND is always same-origin
const LOCAL_BACKEND = '';
function localHeaders(extra = {}) { return authHeaders(extra); }

// ── Seeded demo accounts (always available, no registration needed) ──────────
const SEEDED_ACCOUNTS = [
  {
    id: 'TEST_EMP_001',
    email: 'test@test.com',
    _pw: btoa('1234'),
    name_ko: '김지훈',
    org_id: 'ORG001',
    role: 'staff',
    level_code: 'L2',
    user_status: 'MEMBER',
    dept: '개발팀',
    hire_date: '2023-03-15',
    position: '선임 개발자',
  },
  {
    id: 'TEST_EMP_002',
    email: 'hr@test.com',
    _pw: btoa('1234'),
    name_ko: '이수연',
    org_id: 'ORG001',
    role: 'staff',
    level_code: 'L3',
    user_status: 'MEMBER',
    dept: 'HR팀',
    hire_date: '2021-07-01',
    position: 'HR 매니저',
  },
  {
    id: 'TEST_EMP_003',
    email: 'mkt@test.com',
    _pw: btoa('1234'),
    name_ko: '박준혁',
    org_id: 'ORG001',
    role: 'staff',
    level_code: 'L1',
    user_status: 'MEMBER',
    dept: '마케팅팀',
    hire_date: '2024-01-10',
    position: '마케팅 기획',
  },
];

// ── Helpers ────────────────────────────────────────────────────

function isDemo() {
  return localStorage.getItem('hr_token') === 'demo-token';
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem('hr_user');
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

// Client-side weighted score computation — stores results in computed_scores
async function computeAndSaveScores(instanceId) {
  if (isDemo() || !instanceId) return null;
  try {
    const { data: responses } = await supabase
      .from('assessment_responses')
      .select('*')
      .eq('instance_id', instanceId);

    if (!responses || responses.length === 0) return null;

    const byComp = {};
    for (const r of responses) {
      if (!byComp[r.competency_id]) byComp[r.competency_id] = [];
      byComp[r.competency_id].push(r);
    }

    const avg = arr => arr.length ? arr.reduce((s, r) => s + (r.score || 0), 0) / arr.length : null;

    const computed = Object.entries(byComp).map(([compId, resps]) => {
      const selfScore    = avg(resps.filter(r => r.evaluator_type === 'self'));
      const managerScore = avg(resps.filter(r => r.evaluator_type === 'manager'));
      const peerAvg      = avg(resps.filter(r => r.evaluator_type === 'peer'));

      let finalScore = 0, totalWeight = 0;
      if (selfScore    != null) { finalScore += selfScore    * 0.3; totalWeight += 0.3; }
      if (managerScore != null) { finalScore += managerScore * 0.5; totalWeight += 0.5; }
      if (peerAvg      != null) { finalScore += peerAvg      * 0.2; totalWeight += 0.2; }
      if (totalWeight > 0) finalScore /= totalWeight;

      return {
        instance_id:   instanceId,
        competency_id: compId,
        self_score:    selfScore,
        manager_score: managerScore,
        peer_avg:      peerAvg,
        final_score:   finalScore || selfScore || 0,
      };
    });

    if (computed.length > 0) {
      await supabase
        .from('computed_scores')
        .upsert(computed, { onConflict: 'instance_id,competency_id' });
    }
    return computed;
  } catch (err) {
    console.error('[API] computeAndSaveScores error:', err);
    return null;
  }
}

// ── API surface ────────────────────────────────────────────────

export const api = {

  auth: {
    login: async (email, password) => {
      const normalizedEmail = email.trim().toLowerCase();

      // 0. Seeded demo accounts (hardcoded, always available)
      const seeded = SEEDED_ACCOUNTS.find(u => u.email === normalizedEmail);
      if (seeded) {
        const expectedHash = btoa(unescape(encodeURIComponent(password)));
        if (seeded._pw !== expectedHash) throw new Error('비밀번호가 올바르지 않습니다.');
        const { _pw, ...safeUser } = seeded;
        const token = `local_${seeded.id}`;
        localStorage.setItem('hr_token', token);
        localStorage.setItem('hr_user', JSON.stringify(safeUser));
        seedDemoDataForUser(safeUser);
        return { token, user: safeUser };
      }

      // 1. Check locally registered users (works on GitHub Pages and everywhere)
      try {
        const regUsers = JSON.parse(localStorage.getItem('fca_registered_users') || '[]');
        const localUser = regUsers.find(u => u.email === normalizedEmail);
        if (localUser) {
          const expectedHash = btoa(unescape(encodeURIComponent(password)));
          if (localUser._pw !== expectedHash) throw new Error('비밀번호가 올바르지 않습니다.');
          const token = `local_${localUser.id}`;
          const { _pw, ...safeUser } = localUser;
          localStorage.setItem('hr_token', token);
          localStorage.setItem('hr_user', JSON.stringify(safeUser));
          seedDemoDataForUser(safeUser);
          return { token, user: safeUser };
        }
      } catch (e) {
        if (e.message === '비밀번호가 올바르지 않습니다.') throw e;
      }

      // 2. Local backend (localhost development only)
      if (isLocalBackend()) {
        const d = await localFetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
        return d;
      }

      // 3. Supabase fallback
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message || '이메일 또는 비밀번호가 올바르지 않습니다.');

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      const user = {
        id:         data.user.id,
        email:      data.user.email,
        name_ko:    profile?.name_ko    || data.user.email,
        org_id:     profile?.org_id     || 'ORG001',
        role:       profile?.role       || 'staff',
        level_code: profile?.level_code || 'L1',
        user_status: profile?.user_status || 'MEMBER',
      };

      const token = data.session.access_token;
      localStorage.setItem('hr_token', token);
      localStorage.setItem('hr_user', JSON.stringify(user));
      seedDemoDataForUser(user);
      return { token, user };
    },

    me: async () => {
      if (isDemo()) return getStoredUser();
      if (isLocalBackend()) {
        const token = localStorage.getItem('hr_token');
        if (!token) return null;
        const d = await localFetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } });
        return d && d.user ? d.user : null;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', user.id).single();
      return profile || user;
    },

    logout: async () => {
      // Local backend: best-effort server-side token invalidation
      if (!isDemo() && isLocalBackend()) {
        const token = localStorage.getItem('hr_token');
        if (token) {
          try {
            await fetch('/api/auth/logout', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
          } catch (_) {}
        }
      }
      if (!isDemo() && !isLocalBackend()) await supabase.auth.signOut().catch(() => {});
      localStorage.removeItem('hr_token');
      localStorage.removeItem('hr_user');
      return null;
    },

    changePassword: async (currentPassword, newPassword) => {
      if (isDemo()) throw new Error('demo_mode');
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        const r = await fetch('/api/auth/change-password', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error || 'password_change_failed');
        }
        return r.json();
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
      return { status: 'ok' };
    },
  },

  competencies: {
    list: async (orgId, params = {}) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const q = new URLSearchParams();
        if (params.category) q.set('category', params.category);
        const d = await localFetch(`/api/org/${encodeURIComponent(orgId)}/competencies${q.toString() ? '?' + q.toString() : ''}`, {
          headers: authHeaders(),
        });
        return d?.competencies || [];
      }
      let ids = null;
      if (params.template_id) {
        const { data: tpl } = await supabase
          .from('assessment_templates')
          .select('competency_ids')
          .eq('id', params.template_id)
          .single();
        if (tpl?.competency_ids?.length) ids = tpl.competency_ids;
      }
      let query = supabase
        .from('competencies')
        .select('*')
        .eq('org_id', orgId)
        .eq('active', true);
      if (ids) query = query.in('id', ids);
      const { data } = await query.order('axis_order');
      return data;
    },

    get: async (id) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const d = await localFetch(`/api/competencies/${encodeURIComponent(id)}`, { headers: authHeaders() });
        return d?.competency || null;
      }
      const { data } = await supabase.from('competencies').select('*').eq('id', id).single();
      return data;
    },
  },

  templates: {
    list: async (orgId) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const d = await localFetch(`/api/org/${encodeURIComponent(orgId)}/templates`, { headers: authHeaders() });
        return d?.templates || [];
      }
      const { data } = await supabase
        .from('assessment_templates')
        .select('*')
        .eq('org_id', orgId);
      return data;
    },

    get: async (templateId) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const d = await localFetch(`/api/templates/${encodeURIComponent(templateId)}`, { headers: authHeaders() });
        return d?.template || null;
      }
      const { data } = await supabase
        .from('assessment_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      return data;
    },

    create: async (orgId, data) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const d = await localFetch(`/api/org/${encodeURIComponent(orgId)}/templates`, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(data || {}),
        });
        return d?.template || null;
      }
      const { data: inserted } = await supabase
        .from('assessment_templates')
        .insert({ ...data, org_id: orgId })
        .select()
        .single();
      return inserted;
    },
  },

  assessment: {
    listCycles: async (orgId) => {
      if (isDemo()) return [];
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        const r = await fetch(`/api/org/${encodeURIComponent(orgId)}/cycles`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!r.ok) return [];
        const d = await r.json();
        return d.cycles || [];
      }
      return [];
    },

    createCycle: async (data) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        const r = await fetch('/api/cycles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            org_id:      data.org_id,
            template_id: data.template_id,
            name:        data.name || '역량 진단 ' + new Date().toLocaleDateString('ko'),
            cycle_type:  data.cycle_type || 'standard',
          }),
        });
        if (!r.ok) throw new Error('create_cycle_failed');
        return r.json();
      }
      const { data: inserted, error } = await supabase
        .from('assessment_cycles')
        .insert({
          org_id:      data.org_id,
          template_id: data.template_id,
          cycle_name:  data.name || '역량 진단 ' + new Date().toLocaleDateString('ko'),
          status:      'open',
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return inserted;
    },

    createInstance: async (cycleId, data) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        const r = await fetch(`/api/cycles/${encodeURIComponent(cycleId)}/instances`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            assessee_id:    data.assessee_id,
            evaluator_type: data.evaluator_type || 'self',
          }),
        });
        if (!r.ok) throw new Error('create_instance_failed');
        return r.json();
      }
      const { data: cycle } = await supabase
        .from('assessment_cycles')
        .select('template_id')
        .eq('id', cycleId)
        .single();
      const { data: inserted, error } = await supabase
        .from('assessment_instances')
        .insert({
          cycle_id:    cycleId,
          template_id: cycle?.template_id || null,
          assessee_id: data.assessee_id,
          status:      'draft',
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return inserted;
    },

    submitResponses: async (instanceId, data) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        const responses = data.responses || [];
        const evaluator_type = responses[0]?.assessor_role || data.evaluator_type || 'self';
        const payload = {
          evaluator_type,
          scores: responses.map(r => ({
            competency_id: r.competency_id,
            score:         r.score,
            comment:       r.comment || '',
            evidence_ref:  r.evidence_ref || '',
          })),
        };
        const r = await fetch(`/api/instances/${encodeURIComponent(instanceId)}/responses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        return r.ok ? r.json().catch(() => null) : null;
      }
      const user = getStoredUser();
      const rows = (data.responses || []).map(r => ({
        instance_id:    instanceId,
        evaluator_id:   user?.id || 'unknown',
        evaluator_type: r.assessor_role || 'self',
        competency_id:  r.competency_id,
        score:          r.score,
        comment:        r.comment || null,
      }));
      if (rows.length) {
        await supabase.from('assessment_responses').insert(rows);
      }
      if (!data.partial) {
        await supabase
          .from('assessment_instances')
          .update({ status: 'submitted' })
          .eq('id', instanceId);
      }
      return null;
    },

    getStatus: async (instanceId) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        const r = await fetch(`/api/instances/${encodeURIComponent(instanceId)}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        return r.ok ? r.json() : null;
      }
      const { data } = await supabase
        .from('assessment_instances')
        .select('*, assessment_cycles(template_id)')
        .eq('id', instanceId)
        .single();
      if (!data) return null;
      return {
        ...data,
        template_id: data.template_id || data.assessment_cycles?.template_id,
      };
    },

    getResults: async (instanceId) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        const r = await fetch(`/api/instances/${encodeURIComponent(instanceId)}/results`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!r.ok) return null;
        const data = await r.json().catch(() => null);
        if (!data) return null;
        // Transform backend format → frontend scores array format
        const radar   = data.radar_data || {};
        const labels  = radar.labels || [];
        const compIds = radar.competency_ids || [];
        const asIs    = radar.as_is || [];
        const toBe    = radar.to_be || [];
        const indiv   = data.individual_scores || {};
        const scores  = compIds.map((compId, i) => ({
          competency_id:      compId,
          competency_name_ko: labels[i] || compId,
          as_is_score:        asIs[i] ?? 0,
          to_be_score:        toBe[i] ?? null,
          level:              (indiv[compId] || {}).level_determined || 'L1',
          self_score:         (indiv[compId] || {}).self_score ?? null,
          manager_score:      (indiv[compId] || {}).manager_score ?? null,
          peer_avg:           (indiv[compId] || {}).peer_avg ?? null,
          category:           (indiv[compId] || {}).category || 'core',
        }));
        const overall  = (data.group_scores || {}).overall || 0;
        const topLevel = overall >= 4.0 ? 'L3' : overall >= 3.0 ? 'L2' : 'L1';
        return {
          scores,
          final_score:      overall,
          final_rating:     topLevel,
          show_ai_interview: data.interview_triggered || false,
          group_scores:     data.group_scores,
          ai_summary:       data.ai_summary,
          user:             data.user,
          cycle_name:       data.cycle_name,
        };
      }
      // Supabase fallback
      const { data: sbScores } = await supabase
        .from('computed_scores')
        .select('*, competencies(name_ko, category)')
        .eq('instance_id', instanceId);
      if (!sbScores || sbScores.length === 0) return null;
      return {
        instance_id: instanceId,
        scores: sbScores.map(s => ({
          competency_id:      s.competency_id,
          competency_name_ko: s.competencies?.name_ko || s.competency_id,
          category:           s.competencies?.category || 'core',
          as_is_score:        s.final_score,
          self_score:         s.self_score,
          manager_score:      s.manager_score,
          peer_avg:           s.peer_avg,
          final_score:        s.final_score,
        })),
      };
    },

    computeScores: async (instanceId) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        const r = await fetch(`/api/instances/${encodeURIComponent(instanceId)}/compute`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await r.json().catch(() => ({}));
        return r.ok ? { ok: true, ...data } : { ok: false, status: r.status, ...data };
      }
      return computeAndSaveScores(instanceId);
    },

    getEvidence: async (instanceId) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        const r = await fetch(`/api/instances/${encodeURIComponent(instanceId)}/evidence`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        return r.ok ? r.json().catch(() => null) : null;
      }
      return null;
    },

    calibrate: async (cycleId, opts = {}) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        const r = await fetch(`/api/cycles/${encodeURIComponent(cycleId)}/calibrate`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(opts),
        });
        const data = await r.json().catch(() => ({}));
        return r.ok ? { ok: true, ...data } : { ok: false, ...data };
      }
      return null;
    },

    biasReport: async (cycleId, opts = {}) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        const r = await fetch(`/api/cycles/${encodeURIComponent(cycleId)}/bias-report`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(opts),
        });
        const data = await r.json().catch(() => ({}));
        return r.ok ? { ok: true, ...data } : { ok: false, ...data };
      }
      return null;
    },

    transition: async (instanceId, newStatus) => {
      if (isDemo()) return { ok: false, error: 'demo_mode' };
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        const r = await fetch(`/api/instances/${encodeURIComponent(instanceId)}/transition`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ new_status: newStatus }),
        });
        const data = await r.json().catch(() => ({}));
        return r.ok ? { ok: true, ...data } : { ok: false, status: r.status, ...data };
      }
      const { error } = await supabase.from('assessment_instances').update({ status: newStatus }).eq('id', instanceId);
      return error ? { ok: false, error: error.message } : { ok: true };
    },

    getTransitionStatus: async (instanceId) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        const r = await fetch(`/api/instances/${encodeURIComponent(instanceId)}/transition-status`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        return r.ok ? r.json() : null;
      }
      return null;
    },

    listByOrg: async (orgId) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        const r = await fetch(`/api/orgs/${encodeURIComponent(orgId)}/instances`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        return r.ok ? r.json() : null;
      }
      return null;
    },

    assignEvaluators: async (instanceId, evaluatorType, evaluatorIds) => {
      if (isDemo()) return { ok: false, error: 'demo_mode' };
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        const r = await fetch(`/api/instances/${encodeURIComponent(instanceId)}/assign-evaluators`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ evaluator_type: evaluatorType, evaluator_ids: evaluatorIds }),
        });
        const data = await r.json().catch(() => ({}));
        return r.ok ? { ok: true, ...data } : { ok: false, ...data };
      }
      return { ok: false, error: 'local_only' };
    },

    listInstances: async (userId) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        const r = await fetch(`/api/users/${encodeURIComponent(userId)}/instances`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!r.ok) return [];
        const data = await r.json().catch(() => null);
        return data?.instances || [];
      }
      const { data } = await supabase
        .from('assessment_instances')
        .select('*')
        .eq('assessee_id', userId)
        .order('created_at', { ascending: false });
      return data;
    },

    getPendingForMe: async () => {
      if (isDemo()) return [];
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        const r = await fetch('/api/my/pending', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!r.ok) return [];
        const data = await r.json().catch(() => null);
        return data?.pending_assignments || [];
      }
      return [];
    },
  },

  organization: {
    listUsers: async (orgId) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        const r = await fetch(`/api/org/${encodeURIComponent(orgId)}/users`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        return r.ok ? r.json() : null;
      }
      return null;
    },

    listUsersRiskProfiles: async (orgId) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        const r = await fetch(`/api/org/${encodeURIComponent(orgId)}/users/risk-profiles`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!r.ok) return null;
        const data = await r.json();
        return data.users || null;
      }
      return null;
    },
  },

  interview: {
    start: async (data) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        // Normalize level → level_code for backend
        const payload = { ...data };
        if (payload.level && !payload.level_code) { payload.level_code = payload.level; delete payload.level; }
        const r = await fetch('/api/interview/start', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return r.ok ? r.json().catch(() => null) : null;
      }
      return null;
    },
    evaluate: async (data) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        // Normalize field names for backend
        const payload = { ...data };
        if (payload.level && !payload.level_code) { payload.level_code = payload.level; delete payload.level; }
        if (payload.duration_secs != null && payload.duration_seconds == null) {
          payload.duration_seconds = payload.duration_secs; delete payload.duration_secs;
        }
        const r = await fetch('/api/interview/evaluate', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return r.ok ? r.json().catch(() => null) : null;
      }
      return null;
    },

    saveRecordings: async (instanceId, recordings) => {
      if (isDemo()) return null;
      const user = getStoredUser();
      if (!user?.id) return null;
      const rows = Object.entries(recordings).map(([compId, rec]) => ({
        user_id:       user.id,
        instance_id:   instanceId || 'INST_UNKNOWN',
        competency_id: compId,
        transcript:    rec.transcript,
        status:        'recorded',
      }));
      if (rows.length) {
        await supabase
          .from('interview_sessions')
          .upsert(rows, { onConflict: 'user_id,competency_id,instance_id' });
      }
      return null;
    },

    saveBatchResults: async (instanceId, evalResults, competencies) => {
      if (isDemo()) return null;
      const user = getStoredUser();
      if (!user?.id) return null;
      const rows = Object.entries(evalResults).map(([compId, r]) => {
        const comp = (competencies || []).find(c => c.competency_id === compId);
        return {
          user_id:            user.id,
          instance_id:        instanceId || 'INST_UNKNOWN',
          competency_id:      compId,
          competency_name_ko: comp?.competency_name_ko || compId,
          context_score:      r.context_score,
          action_score:       r.action_score,
          risk_score:         r.risk_score,
          total_score:        r.total_score,
          feedback_ko:        r.feedback_ko,
          strengths_json:     r.strengths_ko    || [],
          improvements_json:  r.improvements_ko || [],
          status:             'evaluated',
        };
      });
      if (rows.length) {
        await supabase
          .from('interview_sessions')
          .upsert(rows, { onConflict: 'user_id,competency_id,instance_id' });
      }
      return null;
    },
  },

  idp: {
    generate: async (data) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        const r = await fetch('/api/idp/generate', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(data || {}),
        });
        return r.ok ? r.json().catch(() => null) : null;
      }
      return null;
    },
    get: async (userId, cycle) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      // local_XXX 계정: LS에서 직접 읽기
      if (token?.startsWith('local_')) {
        try {
          const all = JSON.parse(localStorage.getItem('hr_idp_items') || '[]');
          const items = all.filter(i => i.userId === userId);
          return items.length > 0 ? items : null;
        } catch { return null; }
      }
      if (isLocalBackend()) {
        const q = new URLSearchParams();
        if (cycle) q.set('cycle', cycle);
        const r = await fetch(`/api/idp/${encodeURIComponent(userId)}?${q}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        return r.ok ? r.json().catch(() => null) : null;
      }
      const { data } = await supabase
        .from('idp_items')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      return data;
    },
    update: async (userId, itemId, data) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      // local_XXX 계정: LS에서 직접 업데이트
      if (token?.startsWith('local_')) {
        try {
          const all = JSON.parse(localStorage.getItem('hr_idp_items') || '[]');
          const idx = all.findIndex(i => i.id === itemId && i.userId === userId);
          if (idx >= 0) { all[idx] = { ...all[idx], ...data }; }
          localStorage.setItem('hr_idp_items', JSON.stringify(all));
          return all[idx] || null;
        } catch { return null; }
      }
      if (isLocalBackend()) {
        const r = await fetch(`/api/idp/${encodeURIComponent(userId)}/items/${encodeURIComponent(itemId)}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(data || {}),
        });
        return r.ok ? r.json().catch(() => null) : null;
      }
      const { data: updated } = await supabase
        .from('idp_items')
        .update(data)
        .eq('id', itemId)
        .select()
        .single();
      return updated;
    },
  },

  analytics: {
    orgHeatmap: async (orgId, cycle, opts = {}) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        const q = new URLSearchParams();
        if (cycle) q.set('cycle', cycle);
        if (opts.excludeIncomplete) q.set('exclude_incomplete', 'true');
        if (opts.status) q.set('status', opts.status);
        const r = await fetch(`/api/analytics/org/${encodeURIComponent(orgId)}?${q}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        return r.ok ? r.json().catch(() => null) : null;
      }
      return null;
    },

    individual: async (userId, cycle, opts = {}) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        const q = new URLSearchParams();
        if (cycle) q.set('cycle', cycle);
        if (opts.excludeIncomplete) q.set('exclude_incomplete', 'true');
        if (opts.status) q.set('status', opts.status);
        const r = await fetch(`/api/analytics/individual/${encodeURIComponent(userId)}?${q}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        return r.ok ? r.json().catch(() => null) : null;
      }
      return null;
    },

    gap: async (orgId, cycle, opts = {}) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      if (isLocalBackend()) {
        const q = new URLSearchParams({ org_id: orgId });
        if (cycle) q.set('cycle', cycle);
        if (opts.excludeIncomplete) q.set('exclude_incomplete', 'true');
        if (opts.status) q.set('status', opts.status);
        const r = await fetch(`/api/analytics/gap?${q}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        return r.ok ? r.json().catch(() => null) : null;
      }
      return null;
    },
  },

  survey: {
    saveResponse: async (surveyId, data) => {
      if (isDemo()) return null;
      const user = getStoredUser();
      if (!user?.id) return null;
      if (isLocalBackend()) {
        await fetch(`${LOCAL_BACKEND}/api/survey/responses`, {
          method: 'POST', headers: localHeaders(),
          body: JSON.stringify({
            userId: user.id, org_id: user.org_id,
            surveyId, surveyName: data.surveyName,
            phase: data.phase, answers: data.answers || {},
          }),
        }).catch(() => null);
        return null;
      }
      const { error } = await supabase
        .from('survey_responses')
        .upsert({
          id:           `${user.id}_${surveyId}`,
          user_id:      user.id,
          org_id:       user.org_id || null,
          survey_id:    surveyId,
          survey_name:  data.surveyName  || null,
          phase:        data.phase       || null,
          answers:      data.answers     || {},
          submitted_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      if (error) console.warn('[API] survey.saveResponse:', error.message);
      return null;
    },

    getResponses: async (userId) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const r = await fetch(`${LOCAL_BACKEND}/api/survey/responses/${userId}`, { headers: localHeaders() });
        if (!r.ok) return null;
        const d = await r.json();
        return d.responses || [];
      }
      const { data } = await supabase
        .from('survey_responses')
        .select('*')
        .eq('user_id', userId)
        .order('submitted_at', { ascending: false });
      return data;
    },
  },

  hrComp: {
    saveSession: async (jobId, data) => {
      if (isDemo()) return null;
      const user = getStoredUser();
      if (!user?.id) return null;
      if (isLocalBackend()) {
        await fetch(`${LOCAL_BACKEND}/api/hr-comp/sessions`, {
          method: 'POST', headers: localHeaders(),
          body: JSON.stringify({
            userId: user.id, org_id: user.org_id,
            jobId, jobName: data.jobName,
            recordings: data.recordings || {},
            evalResult: data.evalResult || {},
            level: data.level, totalScore: data.totalScore,
          }),
        }).catch(() => null);
        return null;
      }
      const { error } = await supabase
        .from('hr_comp_sessions')
        .insert({
          user_id:     user.id,
          org_id:      user.org_id || null,
          job_id:      jobId,
          job_name:    data.jobName    || null,
          recordings:  data.recordings || {},
          eval_result: data.evalResult || {},
          level:       data.level      || null,
          total_score: data.totalScore || null,
        });
      if (error) console.warn('[API] hrComp.saveSession:', error.message);
      return null;
    },

    getSessions: async (userId) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const r = await fetch(`${LOCAL_BACKEND}/api/hr-comp/sessions/${userId}`, { headers: localHeaders() });
        if (!r.ok) return null;
        const d = await r.json();
        return d.sessions || [];
      }
      const { data } = await supabase
        .from('hr_comp_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      return data;
    },
  },

  diagnostic: {
    saveResult: async (kitId, data) => {
      if (isDemo()) return null;
      const user = getStoredUser();
      if (!user?.id) return null;
      if (isLocalBackend()) {
        await fetch(`${LOCAL_BACKEND}/api/diagnostic/results`, {
          method: 'POST', headers: localHeaders(),
          body: JSON.stringify({
            userId: user.id, org_id: user.org_id,
            kitId, typeCode: data.typeCode,
            scores: data.scores || {},
          }),
        }).catch(() => null);
        return null;
      }
      const { error } = await supabase
        .from('diagnostic_results')
        .upsert({
          id:        `${user.id}_${kitId}`,
          user_id:   user.id,
          org_id:    user.org_id || null,
          kit_id:    kitId,
          type_code: data.typeCode || null,
          scores:    data.scores   || {},
          saved_at:  new Date().toISOString(),
        }, { onConflict: 'id' });
      if (error) console.warn('[API] diagnostic.saveResult:', error.message);
      return null;
    },

    getResults: async (userId) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const r = await fetch(`${LOCAL_BACKEND}/api/diagnostic/results/${userId}`, { headers: localHeaders() });
        if (!r.ok) return null;
        const d = await r.json();
        return d.results || [];
      }
      const { data } = await supabase
        .from('diagnostic_results')
        .select('*')
        .eq('user_id', userId);
      return data;
    },
  },

  org: {
    get: async (orgId) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const r = await fetch(`${LOCAL_BACKEND}/api/org/${encodeURIComponent(orgId)}`, { headers: localHeaders() });
        return r.ok ? (await r.json()).organization : null;
      }
      const { data } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();
      return data;
    },
    members: async (orgId) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const r = await fetch(`${LOCAL_BACKEND}/api/org/${encodeURIComponent(orgId)}/users`, { headers: localHeaders() });
        return r.ok ? (await r.json()).users : null;
      }
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('org_id', orgId);
      return data;
    },
    families: async (orgId) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const d = await localFetch(`/api/org/${encodeURIComponent(orgId)}/families`, { headers: authHeaders() });
        return d?.job_families || [];
      }
      return null;
    },
  },

  employees: {
    list: async (orgId, { status = 'MEMBER' } = {}) => {
      if (isLocalBackend()) {
        const d = await localFetch(`/api/org/${encodeURIComponent(orgId)}/employees?status=${status}`, { headers: authHeaders() });
        return d?.employees || [];
      }
      if (isDemo()) return null;
      return null;
    },

    directory: async (orgId) => {
      if (isLocalBackend()) {
        const d = await localFetch(`/api/org/${encodeURIComponent(orgId)}/directory`, { headers: authHeaders() });
        return d?.members || [];
      }
      return null;
    },

    get: async (userId) => {
      if (isLocalBackend()) {
        const d = await localFetch(`/api/employees/${encodeURIComponent(userId)}`, { headers: authHeaders() });
        return d?.employee || null;
      }
      return null;
    },

    create: async (orgId, data) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        return await localFetch(`/api/org/${encodeURIComponent(orgId)}/employees`, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(data),
        });
      }
      return null;
    },

    update: async (userId, data) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        return await localFetch(`/api/employees/${encodeURIComponent(userId)}`, {
          method: 'PUT',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(data),
        });
      }
      return null;
    },

    updateProfile: async (userId, data) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        return await localFetch(`/api/employees/${encodeURIComponent(userId)}/profile`, {
          method: 'PATCH',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(data),
        });
      }
      return null;
    },

    deactivate: async (userId) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        return await localFetch(`/api/employees/${encodeURIComponent(userId)}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
      }
      return null;
    },

    resetPassword: async (userId, tempPassword = null) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const body = tempPassword ? { password: tempPassword } : {};
        const r = await fetch(`/api/employees/${encodeURIComponent(userId)}/reset-password`, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(body),
        });
        if (!r.ok) return null;
        return r.json();
      }
      return null;
    },
  },

  personnelEvents: {
    list: async (orgId, params = {}) => {
      if (!isLocalBackend()) return null;
      const query = new URLSearchParams();
      if (params.type && params.type !== 'all') query.set('type', params.type);
      if (params.userId) query.set('user_id', params.userId);
      const suffix = query.toString() ? `?${query}` : '';
      const data = await localFetch(
        `/api/org/${encodeURIComponent(orgId)}/personnel-events${suffix}`,
        { headers: authHeaders() },
      );
      return data?.events || [];
    },

    create: async (orgId, event) => {
      if (!isLocalBackend()) {
        throw new Error('인사발령 API는 서버 배포 환경에서만 사용할 수 있습니다.');
      }
      const data = await localFetch(
        `/api/org/${encodeURIComponent(orgId)}/personnel-events`,
        {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(event),
        },
      );
      return data?.event || null;
    },
  },

  configs: {
    list: async (orgId, type) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const qs = type ? `?type=${encodeURIComponent(type)}` : '';
        const d = await localFetch(`/api/org/${encodeURIComponent(orgId)}/configs${qs}`, { headers: authHeaders() });
        // When type is provided: {type, configs:[...]}; else {configs:{scale:[...],...}}
        return d?.configs ?? null;
      }
      return null;
    },
    get: async (type, configId) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const d = await localFetch(`/api/configs/${encodeURIComponent(type)}/${encodeURIComponent(configId)}`, { headers: authHeaders() });
        return d?.config ?? null;
      }
      return null;
    },
    updatePolicy: async (policyId, evaluators) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        return await localFetch(`/api/evaluator-policies/${encodeURIComponent(policyId)}`, {
          method: 'PATCH',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ evaluators }),
        });
      }
      return null;
    },
    updateWorkflow: async (configId, steps) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        return await localFetch(`/api/workflow-configs/${encodeURIComponent(configId)}`, {
          method: 'PATCH',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ steps }),
        });
      }
      return null;
    },
  },

  applicant: {
    getProfile: async (userId) => {
      if (isDemo()) return null;
      const { data } = await supabase
        .from('applicant_profiles').select('*').eq('user_id', userId).maybeSingle();
      return data;
    },
    saveProfile: async (data) => {
      if (isDemo()) return null;
      const user = getStoredUser();
      await supabase.from('applicant_profiles').upsert(
        { ...data, user_id: user?.id, org_id: user?.org_id, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,job_posting_id' }
      );
      return null;
    },
    updateVisibility: async (data) => {
      if (isDemo()) return null;
      const user = getStoredUser();
      await supabase.from('applicant_profiles')
        .update({ profile_public: data.resume, competency_public: data.competency, resume_public: data.resume, updated_at: new Date().toISOString() })
        .eq('user_id', user?.id);
      return null;
    },
    updateProcessStep: async (userId, step) => {
      if (isDemo()) return null;
      await supabase.from('applicant_profiles').update({ process_step: step }).eq('user_id', userId);
      return null;
    },
  },

  jobs: {
    list: async (orgId) => {
      if (isDemo()) return null;
      const { data } = await supabase
        .from('job_postings').select('*').eq('org_id', orgId).eq('status', 'OPEN')
        .order('created_at', { ascending: false });
      return data;
    },
    save: async (data) => {
      if (isDemo()) return null;
      const user = getStoredUser();
      const row = { ...data, org_id: user?.org_id || 'ORG001' };
      if (row.id) {
        await supabase.from('job_postings').upsert(row, { onConflict: 'id' });
      } else {
        await supabase.from('job_postings').insert(row);
      }
      return null;
    },
  },

  offers: {
    list: async (applicantUserId) => {
      if (isDemo()) return null;
      const { data } = await supabase
        .from('offer_letters').select('*').eq('applicant_user_id', applicantUserId)
        .order('sent_at', { ascending: false });
      return data;
    },
    respond: async (offerId, action, message) => {
      if (isDemo()) return null;
      await supabase.from('offer_letters')
        .update({ status: action, negotiation_message: message || null, responded_at: new Date().toISOString() })
        .eq('id', offerId);
      return null;
    },
    sendDirect: async (data) => {
      if (isDemo()) return null;
      const user = getStoredUser();
      await supabase.from('recruiter_direct_offers').insert({ ...data, recruiter_id: user?.id, org_id: user?.org_id });
      return null;
    },
    getDirect: async (applicantUserId) => {
      if (isDemo()) return null;
      const { data } = await supabase
        .from('recruiter_direct_offers').select('*').eq('applicant_user_id', applicantUserId)
        .order('created_at', { ascending: false });
      return data;
    },
  },

  alumni: {
    getProfile: async (userId) => {
      if (isDemo()) return null;
      const { data } = await supabase
        .from('alumni_profiles').select('*').eq('user_id', userId).maybeSingle();
      return data;
    },
    saveBoomerang: async (data) => {
      if (isDemo()) return null;
      const user = getStoredUser();
      await supabase.from('alumni_profiles').upsert(
        { ...data, user_id: user?.id, org_id: user?.org_id },
        { onConflict: 'user_id' }
      );
      return null;
    },
    getHRContacts: async (userId) => {
      if (isDemo()) return null;
      const { data } = await supabase
        .from('recruiter_direct_offers').select('*').eq('applicant_user_id', userId)
        .order('created_at', { ascending: false });
      return data;
    },
  },

  feedback: {
    save: async (entry) => {
      if (isDemo()) return null;
      const user = getStoredUser();
      const { error } = await supabase
        .from('system_feedbacks')
        .insert({
          id:         entry.id,
          user_id:    user?.id || null,
          org_id:     user?.org_id || null,
          page_hash:  entry.page_hash || null,
          message:    entry.message,
          screenshot: entry.screenshot || null,
          created_at: entry.created_at || new Date().toISOString(),
        });
      if (error) console.warn('[API] feedback.save:', error.message);
      return null;
    },
  },

  performance: {
    saveGoal: async (data) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const res = await fetch(`${LOCAL_BACKEND}/api/performance/goals`, {
          method: 'POST',
          headers: localHeaders(),
          body: JSON.stringify(data),
        });
        return res.ok ? res.json() : null;
      }
      const user = getStoredUser();
      await supabase.from('okr_items').upsert(
        { ...data, user_id: user?.id, org_id: user?.org_id },
        { onConflict: 'id' }
      );
      return null;
    },

    getGoals: async (userId) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      if (token?.startsWith('local_')) {
        try {
          const all = JSON.parse(localStorage.getItem('hr_okr_goals') || '[]');
          return all.filter(g => g.userId === userId);
        } catch { return []; }
      }
      if (isLocalBackend()) {
        const res = await fetch(`${LOCAL_BACKEND}/api/performance/goals/${userId}`, {
          headers: localHeaders(),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.goals || [];
      }
      const { data } = await supabase
        .from('okr_items').select('*').eq('user_id', userId)
        .order('created_at', { ascending: false });
      return data;
    },

    getOrgGoals: async (orgId) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const res = await fetch(`${LOCAL_BACKEND}/api/org/${encodeURIComponent(orgId)}/goals`, {
          headers: localHeaders(),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.goals || [];
      }
      const { data } = await supabase
        .from('okr_items').select('*, users(name_ko)').eq('org_id', orgId)
        .order('created_at', { ascending: false });
      return (data || []).map(r => ({ ...r, ownerName: r.users?.name_ko || '' }));
    },

    saveCheckin: async (data) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const res = await fetch(`${LOCAL_BACKEND}/api/performance/checkins`, {
          method: 'POST',
          headers: localHeaders(),
          body: JSON.stringify(data),
        });
        return res.ok ? res.json() : null;
      }
      const user = getStoredUser();
      await supabase.from('okr_checkins').insert({ ...data, user_id: user?.id });
      return null;
    },

    saveReview: async (data) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const res = await fetch(`${LOCAL_BACKEND}/api/performance/reviews`, {
          method: 'POST',
          headers: localHeaders(),
          body: JSON.stringify(data),
        });
        return res.ok ? res.json() : null;
      }
      const user = getStoredUser();
      await supabase.from('performance_reviews').upsert(
        { ...data, user_id: user?.id, org_id: user?.org_id },
        { onConflict: 'id' }
      );
      return null;
    },

    getReviews: async (userId) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      if (token?.startsWith('local_')) {
        try {
          const all = JSON.parse(localStorage.getItem('hr_perf_reviews') || '[]');
          return all.filter(r => r.userId === userId);
        } catch { return []; }
      }
      if (isLocalBackend()) {
        const res = await fetch(`${LOCAL_BACKEND}/api/performance/reviews/${userId}`, {
          headers: localHeaders(),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.reviews || [];
      }
      const { data } = await supabase
        .from('performance_reviews').select('*').eq('user_id', userId)
        .order('submitted_at', { ascending: false });
      return data;
    },

    saveMeeting: async (data) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const res = await fetch(`${LOCAL_BACKEND}/api/performance/meetings`, {
          method: 'POST',
          headers: localHeaders(),
          body: JSON.stringify(data),
        });
        return res.ok ? res.json() : null;
      }
      const user = getStoredUser();
      await supabase.from('one_on_ones').insert({ ...data, user_id: user?.id, org_id: user?.org_id });
      return null;
    },

    getMeetings: async (userId) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      if (token?.startsWith('local_')) {
        try {
          const all = JSON.parse(localStorage.getItem('hr_one_on_ones') || '[]');
          return all.filter(m => m.empId === userId || m.userId === userId);
        } catch { return []; }
      }
      if (isLocalBackend()) {
        const res = await fetch(`${LOCAL_BACKEND}/api/performance/meetings/${userId}`, {
          headers: localHeaders(),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.meetings || [];
      }
      const { data } = await supabase
        .from('one_on_ones').select('*').eq('user_id', userId)
        .order('meeting_date', { ascending: false });
      return data;
    },

    deleteGoal: async (goalId) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const res = await fetch(`${LOCAL_BACKEND}/api/performance/goals/${goalId}`, {
          method: 'DELETE', headers: localHeaders(),
        });
        return res.ok;
      }
      await supabase.from('okr_items').delete().eq('id', goalId);
      return true;
    },

    deleteReview: async (reviewId) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const res = await fetch(`${LOCAL_BACKEND}/api/performance/reviews/${reviewId}`, {
          method: 'DELETE', headers: localHeaders(),
        });
        return res.ok;
      }
      await supabase.from('performance_reviews').delete().eq('id', reviewId);
      return true;
    },

    deleteMeeting: async (meetingId) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const res = await fetch(`${LOCAL_BACKEND}/api/performance/meetings/${meetingId}`, {
          method: 'DELETE', headers: localHeaders(),
        });
        return res.ok;
      }
      await supabase.from('one_on_ones').delete().eq('id', meetingId);
      return true;
    },

    saveHistory: async (entry) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const res = await fetch(`${LOCAL_BACKEND}/api/growth/history`, {
          method: 'POST', headers: localHeaders(), body: JSON.stringify(entry),
        });
        return res.ok ? res.json() : null;
      }
      const user = getStoredUser();
      await supabase.from('growth_history').upsert(
        { id: entry.id, user_id: user?.id, org_id: user?.org_id,
          date: entry.date, cycle_name: entry.cycleName,
          final_score: entry.final_score, final_rating: entry.final_rating,
          scores: entry.scores },
        { onConflict: 'id' }
      );
      return null;
    },

    getHistory: async (userId) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const res = await fetch(`${LOCAL_BACKEND}/api/growth/history/${userId}`, {
          headers: localHeaders(),
        });
        if (!res.ok) return { history: [] };
        const data = await res.json();
        return { history: data.history || [] };
      }
      const { data } = await supabase
        .from('growth_history').select('*').eq('user_id', userId)
        .order('date', { ascending: true });
      return { history: data || [] };
    },

    getOrgReviews: async (orgId) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const res = await fetch(`${LOCAL_BACKEND}/api/org/${encodeURIComponent(orgId)}/reviews`, {
          headers: localHeaders(),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.reviews || [];
      }
      const { data } = await supabase
        .from('performance_reviews')
        .select('*, users(name_ko)')
        .eq('org_id', orgId)
        .order('submitted_at', { ascending: false });
      return (data || []).map(r => ({ ...r, ownerName: r.users?.name_ko || '' }));
    },

    saveManagerComment: async (reviewId, comment) => {
      if (isDemo()) return null;
      if (isLocalBackend()) {
        const res = await fetch(
          `${LOCAL_BACKEND}/api/performance/reviews/${encodeURIComponent(reviewId)}/manager-comment`,
          { method: 'PATCH', headers: localHeaders(), body: JSON.stringify({ managerComment: comment }) }
        );
        return res.ok ? res.json() : null;
      }
      await supabase.from('performance_reviews')
        .update({ manager_comment: comment }).eq('id', reviewId);
      return null;
    },
  },

  // ── 출퇴근 (commute) ─────────────────────────────────────────
  commute: {
    getLogs: async (userId) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      // local_XXX 계정: commute.js가 LS를 직접 읽으므로 null 반환
      if (token?.startsWith('local_')) return null;
      if (isLocalBackend()) return null;
      const { data } = await supabase
        .from('commute_logs')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(90);
      return data || [];
    },

    saveLog: async (log) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      // local_XXX 계정: LS 저장은 commute.js에서 직접 처리
      if (token?.startsWith('local_')) return null;
      if (isLocalBackend()) return null;
      const user = getStoredUser();
      const { data } = await supabase
        .from('commute_logs')
        .upsert({
          id:         log.id,
          user_id:    user?.id,
          org_id:     user?.org_id,
          date:       log.date,
          work_type:  log.workType,
          check_in:   log.checkIn || null,
          check_out:  log.checkOut || null,
          note:       log.note || null,
        }, { onConflict: 'id' })
        .select()
        .single();
      return data;
    },
  },

  // ── 휴가 (leave) ──────────────────────────────────────────────
  leave: {
    getRequests: async (userId) => {
      if (isDemo()) return null;
      const token = localStorage.getItem('hr_token');
      // local_XXX: leave-engine이 LS를 직접 읽으므로 null 반환 (중복 병합 방지)
      if (token?.startsWith('local_')) return null;
      if (isLocalBackend()) return null;
      const { data } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      return data || [];
    },

    createRequest: async (req) => {
      if (isDemo()) return null;
      if (isLocalBackend()) return null;
      const user = getStoredUser();
      const { data, error } = await supabase
        .from('leave_requests')
        .insert({
          user_id:    user?.id,
          org_id:     user?.org_id,
          leave_type: req.leaveType,
          start_date: req.startDate,
          end_date:   req.endDate,
          days:       req.days,
          reason:     req.reason || null,
          status:     'pending',
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },

    cancelRequest: async (requestId) => {
      if (isDemo()) return null;
      if (isLocalBackend()) return null;
      await supabase
        .from('leave_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId);
      return true;
    },
  },

  // ── HR 보고서 집계 (report) ───────────────────────────────────
  report: {
    async getLeaveStats(orgId, startDate, endDate) {
      if (isDemo() || isLocalBackend()) return null;
      const { data } = await supabase
        .from('leave_requests')
        .select('id, status, days, leave_type')
        .eq('org_id', orgId)
        .gte('start_date', startDate)
        .lte('start_date', endDate);
      return data || [];
    },
    async getCommuteStats(orgId, startDate, endDate) {
      if (isDemo() || isLocalBackend()) return null;
      const { data } = await supabase
        .from('commute_logs')
        .select('id, user_id, work_type, check_in, check_out')
        .eq('org_id', orgId)
        .gte('date', startDate)
        .lte('date', endDate);
      return data || [];
    },
    async getOkrStats(orgId) {
      if (isDemo() || isLocalBackend()) return null;
      const { data } = await supabase
        .from('okr_items')
        .select('id, status, progress')
        .eq('org_id', orgId);
      return data || [];
    },
    async getPerformanceStats(orgId) {
      if (isDemo() || isLocalBackend()) return null;
      const { data } = await supabase
        .from('performance_reviews')
        .select('id, status, overall_score')
        .eq('org_id', orgId);
      return data || [];
    },
    async getHeadcount(orgId) {
      if (isDemo() || isLocalBackend()) return null;
      const { count } = await supabase
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('status', 'active');
      return count != null ? { total: count } : null;
    },
  },
};
