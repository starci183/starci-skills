#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import prettier from 'prettier';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { loadSlotManifest, resolveRepoDeclaration } from '../hfs/slots.mjs';
import { qualityServices } from '../hfs/ci-declaration.mjs';
import { discoverExampleApps, EXAMPLES_ROOT } from '../lib/example-refs.mjs';
import { readTextFile } from '../lib/read-text.mjs';
import { mapInOrder } from '../lib/in-order.mjs';
import { isMain } from '../lib/is-main.mjs';
import { appSource, renderRepo, renderTargets, writtenContent } from '../../packages/hfs/sync/index.mjs';
import { skeletonOf, starterDeclaration } from '../../packages/hfs/scaffold/app.mjs';
import { supabasePortVars } from '../../packages/hfs/scaffold/supabase-ports.mjs';
import { declaredStack } from '../../packages/hfs/sync/stack-images.mjs';
import { renderReadmeBadges } from '../../packages/hfs/sync/readme-badges.mjs';

const CODE = 'RT_RENDERED_NOT_PRETTIER';
const USAGE = 'usage: starci runtime check --only rendered-prettier [-- --root <runtime tree>]';

/** Judge whole files after sync applies file, scripts and marked-block ownership, including README prose outside its block. */
function wholeFiles(root, targets) {
  return targets.map(target => ({ path: target.path, content: writtenContent(target, readTextFile(root, target.path) ?? '') }));
}

/** Every service axis crosses every other axis, including absent build values and private badges without a public token. */
function serviceCases() {
  const axes = [
    ['sonar', ['sonarcloud', 'sonarqube', 'disabled']],
    ['codecov', ['enabled', 'optional', 'disabled', 'flag']],
    ['build', ['absent', 'present', 'two-apps']],
    ['privateBadges', ['public', 'private', 'tokens']],
    ['dependabot', [true, false]],
    ['audit', [true, false]],
  ];
  return axes.reduce((cases, [name, values]) => cases.flatMap(item => values.map(value => ({ ...item, [name]: value }))), [{}]);
}

/** Matrix values are public literal configuration, with conflicting per-app URLs and a gate fallback that must never overwrite them. */
function matrixDeclaration(app, item) {
  const sonar = { provider: item.sonar === 'sonarcloud' ? 'sonarcloud' : 'sonarqube', mode: item.sonar === 'disabled' ? 'disabled' : 'hosted', host: { public: 'https://sonar.example.test' }, organization: 'render-check', projects: [{ key: 'render-check' }] };
  const codecov = { mode: item.codecov === 'disabled' ? 'disabled' : 'hosted', optional: item.codecov === 'optional', ...(item.codecov === 'flag' ? { flag: 'unit-tests' } : {}) };
  if (item.privateBadges === 'tokens') { sonar.badgeToken = 'sqb_example_badge'; codecov.badgeToken = 'example_badge'; }
  const apps = app.sides.fe.apps;
  const selected = item.build === 'two-apps' ? apps : apps.slice(0, 1);
  const images = item.build === 'absent' ? {} : Object.fromEntries(selected.map(entry => [entry.name, { app: entry.name, buildArgs: { values: { NEXT_PUBLIC_SITE_URL: 'https://' + entry.name + '.example.test' } } }]));
  return {
    ci: { github: { repository: 'starci/render-check', visibility: item.privateBadges === 'public' ? 'public' : 'private' } },
    services: { sonar, codecov, dependabot: item.dependabot ? {} : { ecosystems: [] }, audit: { level: item.audit ? 'moderate' : 'high', omitDev: item.audit } },
    environments: { production: { deploy: { images } } },
    release: { gates: item.build === 'absent' ? [] : [{ name: 'build-fe', env: { NEXT_PUBLIC_SITE_URL: 'https://fallback.example.test', BUILD_MODE: 'production' } }] },
  };
}

/** An in-memory manifest uses the same quality, badge and image-environment derivation as the filesystem source reader. */
function matrixSource(source, declaration) {
  return {
    ...source,
    read: file => file === '../.starcistacks/application-stacks.yaml' ? JSON.stringify(declaration) : source.read(file),
    quality: qualityServices(declaration), qualityDeclared: true,
    badges: renderReadmeBadges(declaration),
    stack: declaredStack(declaration),
  };
}

/** Scaffold-style expansion shares the real skeleton renderer and writes no lockfiles, identities or sealed members. */
function scaffoldFixture(root, declaration, manifest) {
  const app = resolveRepoDeclaration(manifest, declaration);
  const vars = { sonarGate: 'starci-quality', timestamp: '20261018000000', registryVisibility: 'public', ...supabasePortVars(app.project) };
  const files = ['app', 'be', 'fe'].flatMap(scope => skeletonOf(scope, app, vars));
  files.push({ path: 'package.json', content: JSON.stringify({ name: app.project, repository: 'https://github.com/starci/render-check', scripts: {} }) });
  for (const file of files) {
    const absolute = path.join(root, file.path);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, file.content);
  }
  return appSource(root);
}

/** Cache identical rendered bytes per target path so the service matrix stays fast while every case remains independently checked. */
function formatJudge(root) {
  const cache = new Map();
  const config = path.join(root, 'packages/prettier-config/index.cjs');
  return async file => {
    const key = file.path + '\0' + file.content;
    if (!cache.has(key)) cache.set(key, (async () => {
      const info = await prettier.getFileInfo(file.path);
      if (!info.inferredParser) return true;
      const options = await prettier.resolveConfig(file.path, { config });
      return prettier.check(file.content, { ...options, filepath: file.path });
    })());
    return cache.get(key);
  };
}

/** A format failure always names its service case and target before any parser detail. */
async function caseFindings(name, files, judge) {
  return (await Promise.all(files.map(async file => {
    try { return await judge(file) ? [] : [{ code: CODE, case: name, path: file.path }]; }
    catch (error) { return [{ code: CODE, case: name, path: file.path, message: error.message }]; }
  }))).flat();
}

/** Render all examples, all starter shapes and the per-edition service matrix without network or an app installation. */
async function renderedPrettierFindings(root = skillRoot, { readTemplate } = {}) {
  const presets = { sonarExclusions: createRequire(path.join(root, 'package.json'))('./packages/jest-preset/index.cjs').sonarExclusions() };
  const manifest = loadSlotManifest({ root });
  const judge = formatJudge(root);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-rendered-prettier-'));
  try {
    const examples = await mapInOrder(discoverExampleApps(root), async name => {
      const appRoot = path.join(root, 'examples', name);
      const { hfs, targets } = await renderRepo(appRoot, { presets, parseYaml });
      const rendered = readTemplate ? renderTargets(hfs, presets, { manifest, source: appSource(appRoot), readTemplate }) : targets;
      return caseFindings('example/' + name, wholeFiles(appRoot, rendered), judge);
    });
    // Each example's own declaration is re-scaffolded as a starter shape (the slot shape included), beside the full and lite starters.
    const starters = ['full', 'lite'].map(shape => ({ shape, declaration: starterDeclaration('render-' + shape, manifest, shape) }));
    const fromExamples = discoverExampleApps(root).map(name => ({ shape: 'example-' + name, declaration: JSON.parse(readTextFile(root, `${EXAMPLES_ROOT}/${name}/hfs.json`)),
      stacks: readTextFile(root, `${EXAMPLES_ROOT}/${name}/.starcistacks/application-stacks.yaml`) }));
    const scaffolds = await mapInOrder([...starters, ...fromExamples], async ({ shape, declaration, stacks }) => {
      const appRoot = path.join(temporary, shape);
      scaffoldFixture(appRoot, declaration, manifest);
      if (stacks !== undefined) fs.writeFileSync(path.join(appRoot, '.starcistacks/application-stacks.yaml'), stacks ?? '');
      const source = appSource(appRoot);
      const base = renderTargets(declaration, presets, { manifest, source, readTemplate });
      const findings = await caseFindings('scaffold/' + shape, wholeFiles(appRoot, base), judge);
      if (stacks !== undefined) return findings;
      const matrixApp = structuredClone(declaration);
      if (matrixApp.sides.fe.apps.length === 1) matrixApp.sides.fe.apps.push({ name: 'landing', kind: 'next' });
      const matrix = await mapInOrder(serviceCases(), item => {
        const doc = matrixDeclaration(matrixApp, item);
        const targets = renderTargets(matrixApp, presets, { manifest, source: matrixSource(source, doc), readTemplate });
        return caseFindings(shape + '/' + Object.values(item).join('/'), wholeFiles(appRoot, targets), judge);
      });
      return [...findings, ...matrix.flat()];
    });
    return [...examples.flat(), ...scaffolds.flat()];
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

/** The runtime driver accepts only an optional tree root and returns findings as a failing exit status. */
async function main(argv) {
  if (argv.length && (argv.length !== 2 || argv[0] !== '--root' || !argv[1])) { process.stderr.write(USAGE + '\n'); return 2; }
  const findings = await renderedPrettierFindings(argv.length ? path.resolve(argv[1]) : skillRoot);
  for (const finding of findings) process.stdout.write(`${finding.code} ${finding.case} ${finding.path}${finding.message ? ': ' + finding.message : ''}\n`);
  if (!findings.length) process.stdout.write('rendered-prettier: examples, scaffolds and service matrix are prettier-clean\n');
  return findings.length ? 1 : 0;
}

if (isMain(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
