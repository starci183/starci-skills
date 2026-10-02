// The host-agent preflight of one launch (contract change host-agent-preflight): before anything is trusted or started,
// the agent the route names must be usable on THIS host. Three refusals, each typed:
//   agent-disabled-on-host   Orca's own settings (orca-data.json of the active profile, settings.disabledTuiAgents) disable it;
//   agent-binary-missing     its CLI binary (the card's start.cli, or Orca's agentCmdOverrides command) is not on PATH;
//   agent-bypass-missing     Orca's settings.agentDefaultArgs for the agent lack the card's bypassFlag (an approval prompt no one answers);
//   model-not-listed         the model is no model the runtime declares for that provider (a provider that declares none, like Cursor whose
//                            models Orca lists dynamically, is not judged) (prices.yaml, the registry defaults,
//                            the runtimes.yaml pool models); a card with no model flag (Devin) takes no model.
// No agent list is hard-coded: the card, Orca's settings and PATH decide. A test process reads none of them unless a spec passes
// its own `settingsFile` / `pathDirs` (the host's real settings must not decide a spec's verdict).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { isSpecRun } from '../lib/env.mjs';
import { appDataBase } from '../lib/app-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const readYaml = (rel) => { try { return parseYaml(fs.readFileSync(path.join(root, rel), 'utf8')); } catch { return null; } };
const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };

/** Orca's userData folder (STARCI_ORCA_USER_DATA re-roots it, as for Orca's CODEX_HOME in agent/trust.mjs). */
export function orcaUserData({ env = process.env, platform = process.platform, home = os.homedir() } = {}) {
  if (env.STARCI_ORCA_USER_DATA) return env.STARCI_ORCA_USER_DATA;
  return path.join(appDataBase({ env, platform, home }), 'orca');
}

/** The settings file of Orca's active profile: <userData>/profiles/<activeProfileId>/orca-data.json. */
export function orcaSettingsFile(opts = {}) {
  const data = orcaUserData(opts);
  const profile = readJson(path.join(data, 'orca-profile-index.json'))?.activeProfileId ?? 'local-default';
  return path.join(data, 'profiles', profile, 'orca-data.json');
}

/** The models the runtime declares for `provider`. */
export function modelsOfProvider(provider) {
  const found = new Set();
  for (const [id, row] of Object.entries(readYaml('modules/models/prices.yaml')?.models ?? {})) if (row?.provider === provider) found.add(id);
  for (const v of Object.values(readYaml('modules/models/registry.yaml')?.defaults?.[provider] ?? {})) if (typeof v === 'string') found.add(v);
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.provider === provider && node.models && typeof node.models === 'object') for (const v of Object.values(node.models)) if (typeof v === 'string') found.add(v);
    for (const v of Object.values(node)) walk(v);
  };
  walk(readYaml('modules/models/runtimes.yaml'));
  return found;
}

const onPath = (binary, { pathDirs, platform, env = process.env }) => {
  const exts = platform === 'win32' ? ['', ...(env.PATHEXT || '.EXE;.CMD;.BAT').split(';').map((e) => e.toLowerCase())] : [''];
  return pathDirs.some((dir) => exts.some((ext) => { try { return fs.statSync(path.join(dir, binary + ext)).isFile(); } catch { return false; } }));
};

/**
 * {ok:true} or {ok:false, code, error}. `card` is the agent card (loadAdapter). Injectable for specs: settingsFile, pathDirs,
 * platform, env, models (a Set replacing the declared models).
 */
export function hostAgentVerdict({ provider, model = null, card, env = process.env, platform = process.platform, settingsFile = null, pathDirs = null, models = null }) {
  if (!settingsFile && !pathDirs && isSpecRun(env)) return { ok: true, skipped: 'a test process does not read the host agents' };
  const agent = card?.start?.agentArgument ?? provider;
  const settings = readJson(settingsFile ?? orcaSettingsFile({ env, platform }))?.settings ?? {};
  if ((settings.disabledTuiAgents ?? []).includes(agent)) {
    return { ok: false, code: 'agent-disabled-on-host', error: `agent '${agent}' is disabled in Orca's settings (disabledTuiAgents): enable it in Orca or route the role to another agent` };
  }
  const flag = card?.start?.bypassFlag;
  if (flag && !String(settings.agentDefaultArgs?.[agent] ?? '').includes(flag)) {
    return { ok: false, code: 'agent-bypass-missing', error: `agent '${agent}' has no '${flag}' in Orca's agentDefaultArgs: a worker would stop at an approval prompt no one answers; add it in Orca's settings` };
  }
  const override = settings.agentCmdOverrides?.[agent];
  const binary = (typeof override === 'string' && override.trim() ? override.trim().split(/\s+/)[0] : null) ?? card?.start?.cli ?? agent;
  const dirs = pathDirs ?? String(env.PATH || env.Path || '').split(path.delimiter).filter(Boolean);
  if (!path.isAbsolute(binary) && !onPath(binary, { pathDirs: dirs, platform, env })) {
    return { ok: false, code: 'agent-binary-missing', error: `agent '${agent}' needs the CLI binary '${binary}', which is not on PATH: install it or route the role to another agent` };
  }
  if (card?.start?.modelArgument !== false && model) {
    const listed = models ?? modelsOfProvider(provider);
    if (listed.size && !listed.has(model)) return { ok: false, code: 'model-not-listed', error: `model '${model}' is not a model the runtime declares for provider '${provider}' (modules/models: prices, registry defaults, runtime pools)` };
  }
  return { ok: true };
}
