// Product-owned delivery helper for the codegen + Turbo build used by examples/lite-app/package.json.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function buildFrontend(run = spawnSync) {
  const commands = [
    ['run', 'codegen', '--silent'],
    ['exec', '--no', '--', 'turbo', 'run', 'build', '--filter=./fe/apps/*'],
  ];
  for (const args of commands) {
    const result = run('npm', args, { stdio: 'inherit', shell: process.platform === 'win32' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('Frontend build command failed');
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) buildFrontend();
