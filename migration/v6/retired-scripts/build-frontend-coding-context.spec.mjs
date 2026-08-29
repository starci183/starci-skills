import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { buildSnapshot, publishSnapshot } from './build-frontend-coding-context.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-fe-context-'));
  fs.mkdirSync(path.join(root, 'src/components/composites/cards/SurfaceCard'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/components/composites/cards/SurfaceCard/index.tsx'), `
    export interface SurfaceCardProps {
      /** Outside label required by the active Grammar. */
      label: string;
      state?: 'ready' | 'checked';
    }
    /** Safe nested surface for complex, stateful lists. */
    export function SurfaceCard(props: SurfaceCardProps) { return <section data-principle="surface-in-surface">{props.label}</section>; }
    /** Closed structural law. */
    export const SURFACE_CARD_GRAMMAR = { label: 'outside' } as const;
  `);
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'test@starci.dev'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'StarCi Test'], { cwd: root });
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'fixture'], { cwd: root });
  return root;
}

test('exports plain JSON component, props, descriptions, and structure signals without executing source', () => {
  const root = fixture();
  const snapshot = buildSnapshot({ project: 'academy', sourceRoot: root });
  const surface = snapshot.components.find((item) => item.name === 'SurfaceCard');
  assert.equal(surface.layer, 'composites');
  assert.match(surface.description, /Safe nested surface/);
  assert.equal(surface.props.fields.label.required, true);
  assert.equal(surface.props.fields.state.required, false);
  assert.ok(surface.signals.includes('surface-in-surface'));
  assert.equal(snapshot.grammarRegistries[0].name, 'SURFACE_CARD_GRAMMAR');
});

test('publishes atomically and reuses an identical generation by hash', () => {
  const root = fixture();
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-fe-output-'));
  const snapshot = buildSnapshot({ project: 'academy', sourceRoot: root });
  const created = publishSnapshot({ snapshot, outputRoot });
  const reused = publishSnapshot({ snapshot, outputRoot });
  assert.equal(created.action, 'created');
  assert.equal(reused.action, 'reused');
  assert.equal(reused.snapshotSha256, created.snapshotSha256);
  assert.ok(fs.existsSync(created.generationPath));
  assert.equal(path.relative(outputRoot, created.currentPath).replaceAll('\\', '/'), '.worktrees/coding-context/frontend/current.json');
  assert.doesNotMatch(path.relative(outputRoot, created.currentPath).replaceAll('\\', '/'), /\.worktrees\/academy\//);
});
