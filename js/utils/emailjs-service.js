/**
 * emailjs-service.js — Thin wrapper around EmailJS Browser SDK
 *
 * Configuration stored in localStorage under 'hr_emailjs_config':
 *   { publicKey, serviceId, templateInterview, templateOffer, templateAssessment }
 *
 * If not configured, all send methods resolve with { ok: false, simulated: true }
 * so callers can show appropriate UI without crashing.
 */

const LS_CONFIG_KEY = 'hr_emailjs_config';
let _loaded = false;

// ── Config helpers ────────────────────────────────────────────

export function getEmailConfig() {
  try { return JSON.parse(localStorage.getItem(LS_CONFIG_KEY) || 'null'); }
  catch { return null; }
}

export function saveEmailConfig(config) {
  localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(config));
}

export function isEmailConfigured() {
  const c = getEmailConfig();
  return !!(c?.publicKey && c?.serviceId);
}

// ── EmailJS loader ────────────────────────────────────────────

async function _loadSDK() {
  if (_loaded && window.emailjs) return window.emailjs;
  return new Promise((resolve, reject) => {
    if (window.emailjs) { _loaded = true; resolve(window.emailjs); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
    s.onload = () => { _loaded = true; resolve(window.emailjs); };
    s.onerror = () => reject(new Error('EmailJS SDK 로드 실패'));
    document.head.appendChild(s);
  });
}

// ── Send methods ──────────────────────────────────────────────

/**
 * Send interview schedule link to applicant.
 * @param {{ toEmail, toName, orgName, interviewDate, interviewLink }} params
 */
export async function sendInterviewSchedule(params) {
  return _send('templateInterview', {
    to_email:        params.toEmail,
    to_name:         params.toName || '지원자',
    org_name:        params.orgName || '귀사',
    interview_date:  params.interviewDate || '추후 안내',
    interview_link:  params.interviewLink || '',
    message:         params.message || '',
  });
}

/**
 * Send offer letter to applicant.
 * @param {{ toEmail, toName, orgName, jobTitle, message }} params
 */
export async function sendOffer(params) {
  return _send('templateOffer', {
    to_email:  params.toEmail,
    to_name:   params.toName || '지원자',
    org_name:  params.orgName || '귀사',
    job_title: params.jobTitle || '',
    message:   params.message || '',
  });
}

/**
 * Send assessment invitation to employee.
 * @param {{ toEmail, toName, cycleName, dueDate, link }} params
 */
export async function sendAssessmentInvite(params) {
  return _send('templateAssessment', {
    to_email:   params.toEmail,
    to_name:    params.toName || '구성원',
    cycle_name: params.cycleName || '역량 평가',
    due_date:   params.dueDate || '',
    link:       params.link || window.location.origin + '/#/assessment',
  });
}

// ── Core sender ───────────────────────────────────────────────

async function _send(templateKey, templateParams) {
  const config = getEmailConfig();

  if (!isEmailConfigured()) {
    return { ok: false, simulated: true, reason: 'not_configured' };
  }

  const templateId = config[templateKey];
  if (!templateId) {
    return { ok: false, simulated: true, reason: 'no_template_id' };
  }

  try {
    const ejs = await _loadSDK();
    ejs.init({ publicKey: config.publicKey });
    await ejs.send(config.serviceId, templateId, templateParams);
    return { ok: true };
  } catch (err) {
    console.warn('[EmailJS] send failed:', err);
    return { ok: false, error: err.message };
  }
}
