import path from 'node:path';
import { list } from '../lib/list.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

const nameOf = (item) => typeof item === 'string' ? item : item?.name;

/** A public CI variable declares either a manifest value or an owner-supplied value, never both. */
function variableProblems(item, at, invalid) {
  const hasValue = item != null && Object.hasOwn(item, 'value');
  const hasOwnerValue = item != null && Object.hasOwn(item, 'ownerValue');
  if (hasValue && hasOwnerValue) invalid(at, 'a variable has either a value or ownerValue');
  else if (!hasValue && item?.ownerValue !== true) invalid(at, 'a variable needs a value or ownerValue: true');
}

/** Each CI name belongs to one class and scope; declarations contain names and public configuration only. */
export function readCiDeclaration(doc) {
  const problems = [], seen = new Set();
  const invalid = (at, message) => problems.push({ code: 'CI_DECLARATION_INVALID', at, message });
  const normalize = (entries, at, dependabot = false, variable = false) => list(entries).map((item, index) => {
    const where = `${at}[${index}]`, name = item?.name;
    if (seen.has(name)) invalid(`${where}.name`, 'a name must appear once across all CI classes');
    seen.add(name);
    if (typeof name !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(name) || name.startsWith('GITHUB_')) invalid(`${where}.name`, 'use an uppercase CI name outside the reserved GITHUB_ namespace');
    const scope = dependabot ? 'repository' : item?.scope;
    if (!['repository', 'environment'].includes(scope)) invalid(`${where}.scope`, 'scope must be repository or environment');
    if (scope === 'environment' && (typeof item?.environment !== 'string' || !/^[a-z][a-z0-9-]*$/.test(item.environment))) invalid(`${where}.environment`, 'environment scope requires an environment name');
    if ((dependabot || scope !== 'environment') && item && Object.hasOwn(item, 'environment')) invalid(`${where}.environment`, 'only environment scope may name an environment');
    if (variable) variableProblems(item, where, invalid);
    return { name, scope, environment: item?.environment ?? null, purpose: item?.purpose ?? null,
      optional: item?.optional === true, ...(variable ? { value: item?.value, ownerValue: item?.ownerValue === true } : {}) };
  });
  const ci = doc?.ci;
  const secrets = normalize(ci?.secrets, 'ci.secrets');
  const vars = normalize(ci?.vars, 'ci.vars', false, true);
  const dependabotSecrets = normalize(ci?.dependabot?.secrets, 'ci.dependabot.secrets', true);
  return { secrets, vars, dependabotSecrets, problems };
}

/** Missing quality blocks preserve the existing rendered defaults; disabled services remain explicitly disabled. */
export function qualityServices(doc, { example = false } = {}) {
  const services = doc?.services ?? {}, sonar = services.sonar, codecov = services.codecov ?? {};
  const dependabot = services.dependabot ?? {}, audit = services.audit ?? {};
  return {
    sonar: !sonar || sonar.mode === 'disabled' ? null : {
      provider: sonar.provider, mode: sonar.mode, optional: sonar.optional ?? sonar.provider === 'sonarqube', host: sonar.host?.public || sonar.host?.local || null,
      organization: sonar.organization ?? null,
      organizationVar: sonar.ci?.organizationVar ?? (sonar.provider === 'sonarcloud' && (example || list(sonar.runtimeSecrets).length > 0) && !list(sonar.credentials).length ? 'SONAR_ORGANIZATION' : null), projectKey: sonar.projects?.[0]?.key ?? null,
      qualityGate: sonar.qualityGate ?? (example ? 'starci-quality-lite' : 'starci-quality'), wiring: sonar.ci?.wiring ?? 'required',
      token: sonar.ci?.token || nameOf(sonar.ci?.secrets?.[0]) || 'SONAR_TOKEN', hostVar: sonar.ci?.hostVar || 'SONAR_HOST_URL',
    },
    codecov: { optional: codecov.optional ?? false, enabled: codecov.mode !== 'disabled', auth: codecov.auth ?? 'oidc', token: codecov.ci?.token ?? null,
      flag: codecov.flag ?? null, target: codecov.target ?? 100, components: codecov.components ?? 'auto', required: codecov.required ?? true, wiring: codecov.ci?.wiring ?? 'required' },
    dependabot: { ecosystems: [...(dependabot.ecosystems ?? ['npm', 'github-actions', 'docker'])],
      schedule: { interval: 'weekly', ...dependabot.schedule }, groups: { minorPatch: 'grouped', major: 'per-package', ...dependabot.groups },
      ignore: [...(dependabot.ignore ?? ['@starci/*'])], security: dependabot.security ?? 'immediate' },
    audit: { level: audit.level ?? 'high', omitDev: audit.omitDev ?? true, in: [...(audit.in ?? ['release-gate', 'ci'])] },
  };
}

/** Enumerate a missing directory as empty; all filesystem access uses the caller's injected synchronous seam. */
function entries(dir, fs) {
  try { return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

/** Read only encrypted envelope key names, never decrypting or returning any sealed value. */
export function sealedKeyNames(root, { fs }) {
  const out = [], base = path.join(root, '.starcistacks');
  for (const env of entries(base, fs).filter((entry) => entry.isDirectory())) {
    for (const member of entries(path.join(base, env.name, 'secrets'), fs).filter((entry) => entry.isFile() && entry.name.endsWith('.enc'))) {
      const file = `.starcistacks/${env.name}/secrets/${member.name}`;
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      const dotenv = [...source.matchAll(/^([A-Za-z_][A-Za-z0-9_]*)=ENC\[/gm)].map((match) => match[1]).filter((key) => !key.startsWith('sops_'));
      let keys = dotenv;
      if (!dotenv.length) {
        const doc = parseYaml(source);
        keys = doc && typeof doc === 'object' && !Array.isArray(doc) ? Object.keys(doc).filter((key) => key !== 'sops' && !key.startsWith('sops_')) : [];
      }
      for (const key of keys) out.push({ env: env.name, member: member.name.slice(0, -4), key, file });
    }
  }
  return out;
}

/** Collect every static secrets and vars reference inside workflow expressions, excluding the automatic GitHub token. */
export function workflowReferences(root, { fs }) {
  const out = [], dir = path.join(root, '.github', 'workflows');
  for (const entry of entries(dir, fs).filter((item) => item.isFile() && /\.ya?ml$/i.test(item.name))) {
    const file = `.github/workflows/${entry.name}`, source = fs.readFileSync(path.join(root, file), 'utf8');
    for (const expression of source.matchAll(/\$\{\{([^}]*)/g)) {
      for (const match of expression[1].matchAll(/\b(secrets|vars)\.([A-Z][A-Z0-9_]*)/g)) {
        if (match[2] !== 'GITHUB_TOKEN') out.push({ file, kind: match[1], name: match[2] });
      }
    }
  }
  return out;
}

/** Service CI bindings name the shared declaration classes, including the readable legacy lists. */
export function ciNamesOfServices(doc) {
  const out = [];
  for (const [service, entry] of Object.entries(doc?.services ?? {})) {
    const ci = entry?.ci ?? {};
    if (ci.token) out.push({ service, name: ci.token, kind: 'secret' });
    if (ci.hostVar) out.push({ service, name: ci.hostVar, kind: 'var' });
    if (ci.organizationVar) out.push({ service, name: ci.organizationVar, kind: 'var' });
    for (const item of list(ci.secrets)) out.push({ service, name: nameOf(item), kind: 'secret' });
    for (const item of list(ci.vars)) out.push({ service, name: nameOf(item), kind: 'var' });
  }
  return out;
}
