#!/usr/bin/env node
// check-example-render.mjs - the examples are their render. Every example app (examples/<name>/hfs.json of kind app) is judged by the
// runtime's own HFS, from this checkout and with no app install: its tracked tree against the slot manifest (a file outside the standard shape,
// such as an extra file in .starcistacks), every managed file against what the renderer of packages/hfs/sync writes for its hfs.json today (the
// workflows, the ignore files, the quality config, the scripts), the Sonar and gitignore blocks. It is the fast half of `starci app lint`:
// no eslint, no architecture machine, no emit and no formatter run, so it fits in `npm run check`; the heavy rows (lint, builds, images, suites)
// stay in the L4 plan (scripts/supervisor/release-l4.mjs). A renderer, template or canon change that leaves an example behind, or an example
// edited by hand off its standard, fails here the day it lands instead of at the release cut.
//
//   starci runtime check --only example-render [-- --root <runtime tree>]
//
// Exit 0: every example is its render. Exit 1: findings. Exit 2: bad arguments.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { checkRepo, trackedFiles } from '../hfs/check.mjs';
import { discoverExampleApps } from '../lib/example-refs.mjs';
import { mapInOrder } from '../lib/in-order.mjs';
import { isMain } from '../lib/is-main.mjs';
import { managedFindings } from '../../packages/hfs/sync/managed.mjs';

const USAGE = 'usage: starci runtime check --only example-render [-- --root <runtime tree>]';

/** What sync loads from the jest preset an app installs: the Sonar exclusions. The runtime reads them from its own packages/jest-preset, so no app install is needed. */
const presetsOf = (root) => ({ sonarExclusions: createRequire(path.join(root, 'package.json'))('./packages/jest-preset/index.cjs').sonarExclusions() });

/** The findings of the app at `repoRoot` judged by the runtime tree `root`: [{example, code, path, message}] (example is `name`), error-level only. */
export async function exampleRenderFindings(root, name, repoRoot = path.join(root, 'examples', name)) {
  const tracked = trackedFiles(repoRoot);
  const extraFindings = await managedFindings({ repoRoot, tracked, presets: presetsOf(root), parseYaml });
  const result = checkRepo({ repoRoot, root, extraFindings, surface: 'check' });
  return result.findings.filter((finding) => finding.level === 'error').map((finding) => ({ example: name, code: finding.code, path: finding.path ?? '', message: finding.message }));
}

/** Every example's findings: [{example, code, path, message}], by example then as reported. */
export async function checkExampleRender(root = skillRoot) {
  return (await mapInOrder(discoverExampleApps(root), (name) => exampleRenderFindings(root, name))).flat();
}

async function main(argv) {
  const rootAt = argv.indexOf('--root');
  if (argv.some((arg, at) => arg !== '--root' && argv[at - 1] !== '--root')) { process.stderr.write(`${USAGE}\n`); return 2; }
  const root = rootAt >= 0 && argv[rootAt + 1] && fs.existsSync(argv[rootAt + 1]) ? path.resolve(argv[rootAt + 1]) : skillRoot;
  const findings = await checkExampleRender(root);
  for (const finding of findings) process.stdout.write(`${finding.code} examples/${finding.example}/${finding.path}: ${finding.message}\n`);
  process.stdout.write(findings.length ? `example-render: ${findings.length} finding(s)\n` : `example-render: ${discoverExampleApps(root).length} example app(s) are their render\n`);
  return findings.length ? 1 : 0;
}

if (isMain(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
