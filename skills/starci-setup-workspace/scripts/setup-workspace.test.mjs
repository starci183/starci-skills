import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'setup-workspace.mjs');

function git(repository, args) {
  return execFileSync('git', ['-C', repository, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

async function makeRepository(repository) {
  await mkdir(repository, { recursive: true });
  git(repository, ['init']);
  git(repository, ['remote', 'add', 'origin', `https://example.invalid/${path.basename(repository)}.git`]);
  await writeFile(path.join(repository, 'marker.txt'), repository, 'utf8');
  git(repository, ['add', 'marker.txt']);
  git(repository, ['-c', 'user.name=StarCi Test', '-c', 'user.email=test@starci.local', 'commit', '-m', 'test']);
}

test('writes one config per role using direct disk paths and no repo aliases', async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'starci-workspace-'));
  try {
    const source = path.join(temporaryRoot, 'source');
    const frontend = path.join(temporaryRoot, 'frontend');
    await makeRepository(source);
    await makeRepository(frontend);
    await mkdir(path.join(source, '.claude', 'context'), { recursive: true });
    await mkdir(path.join(source, '.claude', 'skills'), { recursive: true });
    await mkdir(path.join(source, '.workflows'), { recursive: true });
    await writeFile(path.join(source, 'AGENTS.md'), '# test\n', 'utf8');
    await writeFile(path.join(source, '.gitignore'), '.workspace/\n', 'utf8');
    await mkdir(path.join(frontend, 'src', 'components', 'contracts'), { recursive: true });
    await writeFile(path.join(frontend, 'src', 'components', 'contracts', 'index.ts'), 'export {};\n', 'utf8');

    const command = [script, '--source', source, '--project', 'academy', '--target', `fe=${frontend}`, '--target', `be=${source}`];
    execFileSync(process.execPath, command, { encoding: 'utf8' });
    execFileSync(process.execPath, command, { encoding: 'utf8' });
    execFileSync(process.execPath, [script, '--source', source, '--check'], { encoding: 'utf8' });

    const fe = JSON.parse(await readFile(path.join(source, '.workspace', 'academy', 'fe', 'config.json'), 'utf8'));
    const be = JSON.parse(await readFile(path.join(source, '.workspace', 'academy', 'be', 'config.json'), 'utf8'));
    assert.equal(fe.role, 'fe');
    assert.equal(fe.repository.diskPath, await realpath(frontend));
    assert.equal(fe.repository.gitRepository, 'https://example.invalid/frontend.git');
    assert.equal('workspace' in fe.repository, false);
    assert.equal('alias' in fe.repository, false);
    assert.equal(fe.context.contractSource, 'discovered:src/components/contracts/index.ts');
    assert.equal(await realpath(fe.context.contract), await realpath(path.join(frontend, 'src', 'components', 'contracts', 'index.ts')));
    assert.equal(be.role, 'be');
    assert.equal(be.repository.diskPath, await realpath(source));
    assert.equal('workspace' in be.repository, false);
    assert.equal('alias' in be.repository, false);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
