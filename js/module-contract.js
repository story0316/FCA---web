/**
 * Browser-side checks for Module Contract v0.1.
 *
 * Server validation remains authoritative. These checks stop incompatible
 * modules before mount() receives a platform context.
 */

export const MODULE_CONTRACT_VERSION = '0.1';

export const MODULE_PERMISSIONS = Object.freeze([
  'read:employees',
  'read:surveys',
  'read:assessments',
  'read:analytics',
  'write:goals',
  'write:surveys',
]);

const PERMISSION_SET = new Set(MODULE_PERMISSIONS);
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function sameStringSet(left, right) {
  return left.length === right.length && left.every(value => right.includes(value));
}

export function validateRuntimeModule(moduleId, mod, declaredMeta = null) {
  if (!mod || typeof mod !== 'object') {
    throw new Error(`Module "${moduleId}" did not load as an ES module`);
  }
  if (typeof mod.mount !== 'function') {
    throw new Error(`Module "${moduleId}" must export a mount() function`);
  }

  const meta = mod.meta;
  if (!meta || typeof meta !== 'object') {
    throw new Error(`Module "${moduleId}" must export a meta object`);
  }
  if (meta.id !== moduleId) {
    throw new Error(`Module "${moduleId}" meta.id does not match its registry id`);
  }
  if (typeof meta.name !== 'string' || !meta.name.trim()) {
    throw new Error(`Module "${moduleId}" meta.name is required`);
  }
  if (typeof meta.version !== 'string' || !SEMVER_RE.test(meta.version)) {
    throw new Error(`Module "${moduleId}" meta.version must be valid SemVer`);
  }
  if (!Array.isArray(meta.permissions) || meta.permissions.some(p => typeof p !== 'string')) {
    throw new Error(`Module "${moduleId}" meta.permissions must be an array of strings`);
  }
  if (new Set(meta.permissions).size !== meta.permissions.length) {
    throw new Error(`Module "${moduleId}" has duplicate permissions`);
  }

  const unsupported = meta.permissions.filter(permission => !PERMISSION_SET.has(permission));
  if (unsupported.length) {
    throw new Error(`Module "${moduleId}" requests unsupported permissions: ${unsupported.join(', ')}`);
  }

  if (declaredMeta) {
    const declaredPermissions = declaredMeta.permissions || [];
    if (
      meta.version !== declaredMeta.version
      || !sameStringSet(meta.permissions, declaredPermissions)
    ) {
      throw new Error(`Module "${moduleId}" runtime metadata differs from its registry contract`);
    }
  }

  return {
    ...meta,
    contract_version: MODULE_CONTRACT_VERSION,
    permissions: [...meta.permissions],
  };
}
