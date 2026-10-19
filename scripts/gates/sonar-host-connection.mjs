import {DEFAULT_HOST, readSonarDeclaration, resolveConfig} from './sonar-local.mjs';
import {findDeclaration} from './sonar-declaration.mjs';
import {runtimeHostRoot} from './runtime-host.mjs';
import {safeSonarHost, sonarAdministrativeConfig} from './sonar-credentials.mjs';
import {readCustody} from './sonar-ext-custody.mjs';

/**
 * Resolve only the native self-host administrator for an accepted managed action. Native public
 * configuration owns its origin and explicit aliases; caller environment cannot retarget the value.
 */
export function sonarHostCredential({ref, role, target, env}) {
  const refuse = code => {throw Object.assign(new Error(code), {code});};
  if (ref?.hostConnection !== 'sonar-selfhost-admin' || role !== 'admin'
      || !['sonar-server', 'sonar-community'].includes(target?.provider)) return refuse('sonar-host-connection-scope-refused');
  const cwd = runtimeHostRoot({}), found = findDeclaration(cwd);
  const declared = found ? readSonarDeclaration(found.file, found.repoRoot) : null;
  if (declared?.provider && declared.provider !== 'sonarqube') return refuse('sonar-host-connection-provider-refused');
  if (declared?.mode === 'disabled') return refuse('sonar-host-connection-disabled');
  const selectedHost = declared?.mode === 'hosted' ? declared.hostPublic : declared?.hostLocal;
  const nativeHost = selectedHost === undefined || selectedHost === null ? DEFAULT_HOST : safeSonarHost(selectedHost);
  if (!nativeHost) return refuse('sonar-host-connection-origin-refused');
  const origins = new Set([nativeHost]), publicHost = safeSonarHost(declared?.hostPublic);
  if (publicHost) origins.add(publicHost);
  if (!origins.has(target.origin)) return refuse('sonar-host-connection-origin-refused');
  const cfg = sonarAdministrativeConfig(resolveConfig({cwd, host: nativeHost}, env));
  const admin = readCustody(cfg, cfg.adminToken, {remember: value => value});
  if (!admin.present) return refuse('sonar-host-credential-unavailable');
  return admin.value;
}
