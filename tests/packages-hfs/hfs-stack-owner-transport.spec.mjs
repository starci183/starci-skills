import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { acceptRelease, deployRelease, rollbackRelease } from '../../packages/hfs/stack/deploy.mjs';
import { fakeHost, fakeSops } from '../helpers/stack-fakes.mjs';

// On an operator machine every remote step of deploy, rollback and accept must go through the sealed ssh session (key file, pinned known_hosts,
// user@host from the ops member). The configured alias is for CI and --ssh-cmd only; a bare `ssh vps` there resolves to nothing.
const PEM = '-----BEGIN OPENSSH PRIVATE KEY-----\nBODY\n-----END OPENSSH PRIVATE KEY-----\n';
const ID = 'ab'.repeat(8);
const temps = [];
const tempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-owner-'));
  temps.push(dir);
  return dir;
};
after(() => { for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true }); });

function operator({ env = {}, alias = false, answer = () => ({ status: 0, stdout: '', stderr: '' }) } = {}) {
  const secretsDir = tempDir();
  for (const slug of ['ops', 'vps-ssh-key', 'vps-known-hosts']) fs.writeFileSync(path.join(secretsDir, `${slug}.enc`), '');
  const sshCalls = [];
  const host = fakeHost({ fileReader: (file) => fs.readFileSync(file, 'utf8'), overrides: { ssh: (args) => { sshCalls.push(args); return answer(args.at(-1)); } } });
  const sops = fakeSops({ members: { ops: { VPS_HOST: 'vps.example', VPS_USER: 'deploy' } }, binary: { 'vps-ssh-key': PEM, 'vps-known-hosts': 'vps.example ssh-ed25519 AAAA' } });
  const config = { stack: 'shop', secretsDir, remote: { host: 'vps', releasesBase: null, sealed: alias ? null : { ops: 'ops', sshKey: 'vps-ssh-key', knownHosts: 'vps-known-hosts' } } };
  return { ctx: host.ctx({ sops, env }), config, sshCalls };
}

const stubs = (dir) => ({
  renderRelease: async (ctx, cfg, options) => {
    fs.mkdirSync(options.out, { recursive: true });
    fs.writeFileSync(path.join(options.out, 'stack.yaml'), `services:\n  api:\n    image: registry.example/team/app-api@sha256:${'a1'.repeat(32)}\n`);
    fs.writeFileSync(path.join(options.out, 'release.json'), '{"secrets":[],"configs":[]}');
    return { ok: true, lines: [] };
  },
  provisionRelease: async () => ({ ok: true, lines: [] }),
  convergeStack: async () => ({ ok: true, lines: [] }),
  verifyStack: async () => ({ ok: true, lines: [] }),
  pruneStack: async () => ({ ok: true, lines: [] }),
  dir,
});

/** Every ssh invocation of the verb: the sealed session (-i key, user@host) and never the bare alias. */
function assertSealed(sshCalls) {
  assert.ok(sshCalls.length > 0, 'the verb reached the remote');
  for (const args of sshCalls) {
    assert.ok(args.includes('-i'), `ssh uses the sealed key: ${args.slice(0, 4).join(' ')}`);
    assert.ok(args.includes('deploy@vps.example'), 'ssh targets user@host from the ops member');
    assert.equal(args.includes('vps'), false, 'no bare ssh alias');
  }
}

test('deploy --execute reaches the manager through the sealed session, never the vps alias, and removes the key files', async () => {
  const { ctx, config, sshCalls } = operator();
  const out = tempDir();
  const result = await deployRelease(ctx, config, { sourceSha: 'a'.repeat(40), execute: true, out, skipPublic: true }, stubs());
  assert.equal(result.ok, true, result.lines.join(' | '));
  assertSealed(sshCalls);
  for (const args of sshCalls) assert.equal(fs.existsSync(path.dirname(args[args.indexOf('-i') + 1])), false, 'session directory removed');
});

test('accept and rollback use the sealed session too', async () => {
  const { ctx, config, sshCalls } = operator({ answer: (command) => ({ status: 0, stdout: command.includes('readlink') ? `${ID}
` : '', stderr: '' }) });
  const rolled = await rollbackRelease(ctx, config, {}, stubs());
  assert.equal(rolled.data.release, ID);
  const accepted = await acceptRelease(ctx, config, { release: ID }, stubs());
  assert.equal(accepted.ok, true);
  assertSealed(sshCalls);
});

test('the alias is used only without sealed members (CI) or with --ssh-cmd', async () => {
  const ci = operator({ env: { GITHUB_ACTIONS: 'true' } });
  await deployRelease(ci.ctx, ci.config, { sourceSha: 'a'.repeat(40), execute: true, out: tempDir() }, stubs()).catch(() => {});
  assert.ok(ci.sshCalls.length > 0);
  assert.ok(ci.sshCalls.every((args) => args.includes('vps') && !args.includes('-i')), 'CI keeps the alias');
  const explicit = operator({ answer: () => ({ status: 0, stdout: `${ID}
`, stderr: '' }) });
  await rollbackRelease(explicit.ctx, explicit.config, { sshCmd: 'ssh custom-host' }, stubs());
  assert.ok(explicit.sshCalls.every((args) => args.includes('custom-host')));
});
