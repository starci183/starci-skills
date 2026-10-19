import { secretHits, secretNameLike } from './secret-patterns.mjs';

const PARENT_KEYS = ['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR'];
const PARENT_ENV_KEYS = new Set(PARENT_KEYS.map(key => key.toUpperCase()));
const RESERVED_ENV = /^(?:NODE_|OPENSSL_|STARCI_|SOPS_|LD_|DYLD_|PYTHON|PATH$|PATHEXT$|COMSPEC$|HOME$|USERPROFILE$|APPDATA$|LOCALAPPDATA$|WORKSPACE_SEED_INPUT$)/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Workspace and member selectors are UUIDs, never arbitrary strings forwarded to an application command. */
export const isAppWorkspaceId = value => typeof value === 'string' && UUID.test(value);

/** Public and private bindings use the same fixed boundary; executable loader settings are refused. */
export function appProvisionEnv(publicValues, privateValues, parentEnv = {}) {
  const result = Object.fromEntries(PARENT_KEYS.filter(key => typeof parentEnv[key] === 'string').map(key => [key, parentEnv[key]]));
  for (const [key, value] of Object.entries(publicValues ?? {})) {
    if (secretNameLike(key) || secretHits('target.env', `${key}=${value}`).length) throw new Error('APP_ACCESS_PUBLIC_SECRET_REFUSED');
  }
  for (const values of [publicValues, privateValues]) {
    for (const [key, value] of Object.entries(values ?? {})) {
      if (!/^[A-Z][A-Z0-9_]*$/.test(key) || RESERVED_ENV.test(key) || PARENT_ENV_KEYS.has(key) || typeof value !== 'string' || Object.hasOwn(result, key))
        throw new Error('APP_ACCESS_ENV_BINDING_REFUSED');
      result[key] = value;
    }
  }
  return result;
}
