import fs from 'node:fs';
import path from 'node:path';
import { archFixture } from './hfs-arch-fixture.mjs';

function snapshot(target) {
  if (!fs.existsSync(target)) return { kind: 'missing' };
  const stat = fs.lstatSync(target);
  if (stat.isDirectory()) {
    return {
      kind: 'directory',
      entries: fs.readdirSync(target).map(name => [name, snapshot(path.join(target, name))]),
    };
  }
  if (stat.isSymbolicLink()) return { kind: 'symlink', target: fs.readlinkSync(target) };
  return { kind: 'file', content: fs.readFileSync(target) };
}

function restore(target, saved) {
  fs.rmSync(target, { recursive: true, force: true });
  if (saved.kind === 'missing') return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (saved.kind === 'file') {
    fs.writeFileSync(target, saved.content);
    return;
  }
  if (saved.kind === 'symlink') {
    fs.symlinkSync(saved.target, target);
    return;
  }
  fs.mkdirSync(target, { recursive: true });
  for (const [name, entry] of saved.entries) restore(path.join(target, name), entry);
}

/**
 * Build one real architecture fixture for the spec process, then apply each case as a reversible filesystem overlay.
 * The git repository and canonical tree survive every check; finally restores the exact pre-case bytes, so cases do not
 * depend on execution order.
 */
export function reusableArchFixture(options) {
  let cleanup;
  const root = archFixture({ after: callback => { cleanup = callback; } }, options);
  const appRoot = path.dirname(root);

  const targetOf = relative => {
    const target = path.resolve(root, ...relative.split('/'));
    const fromApp = path.relative(appRoot, target);
    if (fromApp.startsWith('..') || path.isAbsolute(fromApp)) throw new Error(`fixture overlay escapes its app: ${relative}`);
    return target;
  };

  return {
    root,
    withFiles(files, run) {
      const changes = Object.entries(files).map(([relative, content]) => {
        const target = targetOf(relative);
        return { target, content, saved: snapshot(target) };
      });
      try {
        for (const { target, content } of changes) {
          fs.rmSync(target, { recursive: true, force: true });
          if (content === null) continue;
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, content);
        }
        return run(root);
      } finally {
        for (const { target, saved } of changes.reverse()) restore(target, saved);
      }
    },
    close() {
      cleanup?.();
      cleanup = undefined;
    },
  };
}
