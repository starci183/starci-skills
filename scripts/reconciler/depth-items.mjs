// The config row orca-depth reports config.yaml orca.maxWorkerDepth; with STARCI_ORCA_LIVE=1 (and Orca reachable) it
// also measures Orca's real limit with no-op workers it starts and releases (scripts/agent/depth-probe.mjs) and is red
// when the two differ.
import { orcaSettings } from '../../engine/orca-config.mjs';
import { compareMeasuredDepth } from '../lib/worker-depth.mjs';
import { green, red, warn } from './checklist-items.mjs';
import { SKILL_ROOT } from './state.mjs';

/**
 * The orca-depth row: config.yaml orca.maxWorkerDepth, which must equal the Orca app's worker depth setting (Orca has
 * no read of it). Only with STARCI_ORCA_LIVE=1 and Orca reachable is Orca's limit measured (no-op workers, all
 * released) and compared: red on a mismatch or a worker the probe could not release. Seam: probe.
 */
export async function depthItems({ env = process.env, config = null, orcaOk = false, probe = null } = {}) {
  const NAME = 'Orca worker depth (orca.maxWorkerDepth)';
  let settings;
  try { settings = orcaSettings(config ?? {}); }
  catch (error) { return [red('config', 'orca-depth', NAME, String(error?.message ?? error).slice(0, 300), 'fix config.yaml orca.maxWorkerDepth (an integer equal to the Orca app setting)')]; }
  const configured = settings.maxWorkerDepth;
  const base = `orca.maxWorkerDepth ${configured} (${settings.source}); it must equal the Orca app's worker depth setting`;
  if (env.STARCI_ORCA_LIVE !== '1') return [green('config', 'orca-depth', NAME, `${base}; not measured (STARCI_ORCA_LIVE=1 measures it)`, { required: false })];
  if (!orcaOk) return [warn('config', 'orca-depth', NAME, `${base}; not measured: Orca is not reachable`, 'open Orca, then run start --check with STARCI_ORCA_LIVE=1 again')];
  const measure = probe ?? (async (opts) => (await import('../agent/depth-probe.mjs')).probeWorkerDepth(opts));
  let measured;
  try { measured = await measure({ entry: env.ORCA_TERMINAL_HANDLE || null, worktree: SKILL_ROOT, agent: env.STARCI_DEPTH_PROBE_AGENT || 'claude' }); }
  catch (error) { measured = { ok: false, error: String(error?.message ?? error) }; }
  const leaked = (measured?.released ?? []).filter((w) => !w.released);
  if (leaked.length) return [red('config', 'orca-depth', NAME, `${base}; the probe could not release ${leaked.map((w) => w.dispatchId).join(', ')}`, 'orca orchestration worker-release --dispatch <id> for each, then run the check again')];
  const cmp = compareMeasuredDepth({ configured, measured: measured?.ok ? measured.measured : null });
  if (cmp.status === 'match') return [green('config', 'orca-depth', NAME, `${cmp.detail} (probe depths ${(measured.depths ?? []).join(', ')})`)];
  if (cmp.status === 'mismatch') return [red('config', 'orca-depth', NAME, cmp.detail, `set config.yaml orca.maxWorkerDepth: ${cmp.measured}, or change the Orca app setting to ${configured}`)];
  return [warn('config', 'orca-depth', NAME, `${cmp.detail}: ${measured?.error ?? 'the probe returned nothing'}`, 'run start --check with STARCI_ORCA_LIVE=1 again')];
}
