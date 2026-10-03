import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadSlotManifest, openHfs } from '../../scripts/hfs/slots.mjs';

const manifest = loadSlotManifest();

function slash(value) {
  return value.replaceAll(path.sep, '/');
}

function sameContent(file, content) {
  try { return fs.readFileSync(file, 'utf8') === content; } catch { return false; }
}

/**
 * One resettable Git fixture per architecture profile. Every reset reconciles the tree to the requested files, so a test
 * sees the same clean tracked state as a fresh repository while Git initialization and immutable HFS manifest parsing are
 * amortized across the spec process.
 */
export function hfsArchitectureFixture() {
  const fixtures = new Map();
  const hfsByRoot = new Map();
  const openedByDeclaration = new Map();

  const fixtureFor = profile => {
    if (!fixtures.has(profile)) {
      const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), `starci-architecture-${profile}-`));
      execFileSync('git', ['init', '-q'], { cwd: appRoot });
      fixtures.set(profile, { appRoot, root: path.join(appRoot, profile) });
    }
    return fixtures.get(profile);
  };

  const removeExtra = (directory, desired, appRoot) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (directory === appRoot && entry.name === '.git') continue;
      const target = path.join(directory, entry.name);
      const relative = slash(path.relative(appRoot, target));
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        if ([...desired].some(file => file.startsWith(`${relative}/`))) {
          removeExtra(target, desired, appRoot);
          if (fs.existsSync(target) && fs.readdirSync(target).length === 0) fs.rmdirSync(target);
        } else fs.rmSync(target, { recursive: true, force: true });
      } else if (!desired.has(relative)) fs.rmSync(target, { force: true });
    }
  };

  return {
    reset(profile, declaration, filesForAppRoot) {
      const fixture = fixtureFor(profile);
      const files = filesForAppRoot(fixture.appRoot);
      const desired = new Map(Object.entries(files).map(([relative, content]) => {
        const target = path.resolve(fixture.root, ...relative.split('/'));
        const appRelative = slash(path.relative(fixture.appRoot, target));
        if (appRelative === '..' || appRelative.startsWith('../')) throw Error(`Architecture fixture path leaves its app root: ${relative}`);
        return [appRelative, { content, target }];
      }));
      removeExtra(fixture.appRoot, new Set(desired.keys()), fixture.appRoot);
      for (const { content, target } of desired.values()) {
        if (sameContent(target, content)) continue;
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content);
      }
      execFileSync('git', ['add', '-A'], { cwd: fixture.appRoot });

      const key = `${profile}\0${JSON.stringify(declaration)}`;
      if (!openedByDeclaration.has(key)) openedByDeclaration.set(key, openHfs({ declaration, side: profile, manifest }));
      hfsByRoot.set(path.resolve(fixture.root), openedByDeclaration.get(key));
      return fixture.root;
    },

    openedHfs(root) {
      const opened = hfsByRoot.get(path.resolve(root));
      if (!opened) throw Error(`No prepared architecture fixture for ${root}`);
      return opened;
    },

    cleanup() {
      for (const { appRoot } of fixtures.values()) fs.rmSync(appRoot, { recursive: true, force: true });
      fixtures.clear();
      hfsByRoot.clear();
    },
  };
}
