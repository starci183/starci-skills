import { canonicalJSON } from '../../../engine/canonical-json.mjs';
import { inspectCiProvisionCli } from './inspect-ci-provision-cli.mjs';
import { runProgram } from './run-program.mjs';
import { ciNativeArguments, ciChildEnvironment } from '../../lib/provision-ci-contract.mjs';

const EMPTY_INPUT = 'CI_VALUE_EMPTY: a secret value is required on stdin';

/**
 * Empty stdin reaches the existing native guards and stops before GitHub or any private value is
 * opened. Only the owner's exact empty-value refusal admits this bridge; other output stays private.
 */
export function preflightCiProvision(input, { run = runProgram } = {}) {
  if (canonicalJSON(inspectCiProvisionCli(input.repoRoot)) !== canonicalJSON(input.nativeIdentity)) throw new Error('CI_ACCESS_NATIVE_DRIFT');
  let result;
  try {
    result = run(process.execPath, ciNativeArguments(input), { cwd: input.repoRoot, env: ciChildEnvironment(input.parentEnv),
      shell: false, input: '', timeout: input.timeoutMs, maxBuffer: 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch { throw new Error('CI_ACCESS_GUARD_UNAVAILABLE'); }
  if (result.error || result.status !== 2 || String(result.stdout ?? '').trim()
    || String(result.stderr ?? '').trim() !== EMPTY_INPUT) throw new Error('CI_ACCESS_GUARD_REFUSED');
}
