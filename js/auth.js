/**
 * auth.js – Authentication state management
 * HR Competency OS
 */

const TOKEN_KEY = 'hr_token';
const USER_KEY  = 'hr_user';

/**
 * Persists token to localStorage.
 * @param {string} token
 */
export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

/**
 * Retrieves token from localStorage.
 * @returns {string|null}
 */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Persists user profile to localStorage.
 * @param {Object} user
 */
export function setUser(user) {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem('hr_session', JSON.stringify({
      ...user,
      userId: user.userId || user.id,
      empId: user.empId || user.id,
      name: user.name || user.name_ko,
      dept: user.dept || user.department || user.department_name,
      joinDate: user.joinDate || user.join_date,
    }));
  } else {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('hr_session');
  }
}

/**
 * Retrieves user profile from localStorage.
 * @returns {Object|null}
 */
export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Returns true if a token is present.
 * Does not validate the token with the server.
 */
export function isLoggedIn() {
  return Boolean(getToken());
}

/**
 * Clears all auth state and redirects to login.
 */
export function logout() {
  setToken(null);
  setUser(null);
  localStorage.removeItem('hr_active_persona');
  window.location.hash = '#/login';
}

/**
 * Stores both token and user after successful login.
 * @param {{ token: string, user: Object }} loginResponse
 */
export function handleLoginSuccess(loginResponse) {
  if (!loginResponse) return;
  setToken(loginResponse.token);
  setUser(loginResponse.user);
}

/**
 * Returns the user's role.
 * @returns {string|null}
 */
export function getUserRole() {
  const user = getUser();
  return user ? user.role : null;
}

// Role hierarchy: staff < manager < director < hr_admin < super_admin
const ROLE_ORDER = {
  staff: 0, employee: 0,          // 'employee' kept for legacy compat
  manager: 1,
  director: 2,
  hr_admin: 3, admin: 3,          // 'admin' kept for legacy compat
  super_admin: 4,
};

/**
 * Returns true if current user has given role or higher.
 */
export function hasRole(requiredRole) {
  const userRole = getUserRole();
  if (!userRole) return false;
  return (ROLE_ORDER[userRole] ?? -1) >= (ROLE_ORDER[requiredRole] ?? 999);
}

/**
 * Returns true if the current user is an HR admin or super admin.
 */
export function isAdmin() {
  return hasRole('hr_admin');
}

/**
 * Returns the user's segment status.
 * @returns {'APPLICANT'|'MEMBER'|'ALUMNI'}
 */
export function getUserStatus() {
  const user = getUser();
  return (user && user.user_status) ? user.user_status : 'MEMBER';
}

export function isApplicant() { return getUserStatus() === 'APPLICANT'; }
export function isMember()    { return getUserStatus() === 'MEMBER'; }
export function isAlumni()    { return getUserStatus() === 'ALUMNI'; }
