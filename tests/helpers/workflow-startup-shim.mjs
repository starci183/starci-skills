export * from '../../scripts/api/node/exec-node.mjs';
export * from '../../scripts/machine/npm-ci.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export async function execNode() {
  const data = { ok: true, hostOk: true, fixture: true, summary: { ok: true }, applied: [], items: [],
    maintenance: { ok: true, ready: true, action: 'fixture', fixture: true } };
  return { error: null, stdout: JSON.stringify(data), stderr: '' };
}

export async function npmCi(ctx) {
  // This private external-install seam may apply a native owner fixture command while installation is awaited.
  // It never manufactures goal rows or approval values, and production has no corresponding flag or bypass.
  let revision = null;
  if (ctx.env?.STARCI_FAKE_INSTALL_OWNER_COMMAND) {
    const command = JSON.parse(ctx.env.STARCI_FAKE_INSTALL_OWNER_COMMAND);
    const result = spawnSync(command.executable, command.args, { cwd: fileURLToPath(new URL('../..', import.meta.url)),
      env: ctx.env, encoding: 'utf8', windowsHide: true, timeout: 120000 });
    if (result.status !== 0) throw Error(result.stderr || result.error?.message || 'native fixture owner revision failed');
    revision = JSON.parse(result.stdout);
  }
  const ok = ctx.env?.STARCI_FAKE_INSTALL_FAIL !== '1';
  return { code: ok ? 0 : 1, text: ok ? 'fixture installation boundary' : 'fixture registry unavailable',
    data: { schema: 'starci/npm-ci@1', ok, fixture: true, cwd: ctx.cwd, ms: 0, ...(revision ? { revision } : {}) } };
}
