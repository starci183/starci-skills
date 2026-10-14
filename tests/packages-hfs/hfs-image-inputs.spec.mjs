// The images a declaration renders carry every input their build stage needs: a Next image creates the public folder the runtime stage copies
// out of the build stage (the scaffold writes none), and a lite back-end image copies the generated Supabase types its sources import.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appSource, imageFiles, renderTargets } from '../../packages/hfs/sync/index.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { loadSlotManifest, resolveRepoDeclaration } from '../../scripts/hfs/slots.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const MANIFEST = loadSlotManifest();
const declared = (example) => resolveRepoDeclaration(MANIFEST, JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', example, 'hfs.json'), 'utf8')));
const lines = (content) => content.split('\n');

test('a Next image creates its public folder in the build stage, before the runtime stage copies it', () => {
  for (const image of imageFiles(declared('shape-slot')).filter((file) => file.path.startsWith('fe/'))) {
    const text = lines(image.content);
    const made = text.findIndex((line) => /^RUN mkdir -p fe\/apps\/[\w-]+\/public$/.test(line));
    const built = text.findIndex((line) => line.startsWith('RUN node_modules/.bin/turbo run build'));
    const copied = text.findIndex((line) => /^COPY --from=build .* \/app\/fe\/apps\/[\w-]+\/public /.test(line));
    assert.ok(made > 0 && made < built && built < copied, `${image.path}: mkdir ${made}, build ${built}, copy ${copied}`);
  }
});

test('every image of a lite back end copies the generated Supabase types after the sources, and a full back end image never does', () => {
  const lite = imageFiles(declared('lite-app'));
  assert.deepEqual(lite.map((image) => image.path), ['be/apps/api/Dockerfile', 'be/apps/cli/Dockerfile']);
  for (const image of lite) {
    const text = lines(image.content);
    const src = text.indexOf('COPY be/src be/src');
    assert.ok(src > 0 && text[src + 1] === 'COPY supabase/types supabase/types', `${image.path} copies supabase/types right after be/src`);
  }
  for (const image of imageFiles(declared('ecommerce-app')).filter((file) => file.path.startsWith('be/'))) {
    assert.ok(!image.content.includes('supabase'), `${image.path} names no supabase input`);
  }
});

test('the lite skeleton api image, written by the scaffold, copies the generated Supabase types too', () => {
  const text = fs.readFileSync(path.join(ROOT, 'packages', 'hfs', 'templates', 'be', 'skeleton-lite', 'apps', 'api', 'Dockerfile'), 'utf8');
  assert.match(text, /COPY be\/src be\/src\nCOPY supabase\/types supabase\/types\n/);
});

test('lite sync includes an authored Next image in build scripts and CI while a hosted front end stays optional', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-lite-optional-image-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const hfs = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'lite-app', 'hfs.json'), 'utf8'));
  const app = resolveRepoDeclaration(MANIFEST, hfs);
  const rendered = () => renderTargets(hfs, { sonarExclusions: [] }, { source: appSource(root) });
  const scripts = targets => targets.find(target => target.path === 'package.json').scripts;
  const matrix = targets => parseYaml(targets.find(target => target.path === '.github/workflows/images.yml').content).jobs.image.strategy.matrix.include;
  const hosted = rendered();
  assert.equal(scripts(hosted)['docker:build:web'], undefined);
  assert.equal(matrix(hosted).some(image => image.name === 'web'), false);
  const file = path.join(root, 'fe', 'apps', 'web', 'Dockerfile');
  fs.mkdirSync(file, { recursive: true });
  assert.equal(appSource(root).hasImage('fe/apps/web/Dockerfile'), false, 'an image build requires a regular Dockerfile');
  fs.rmdirSync(file);
  fs.writeFileSync(file, 'FROM node:22.14.0-alpine3.21\n');
  const swarm = rendered();
  assert.equal(scripts(swarm)['docker:build:web'], 'docker build -f fe/apps/web/Dockerfile -t lite-app/web:dev .');
  assert.ok(scripts(swarm)['docker:build'].includes('npm run docker:build:web'));
  assert.ok(matrix(swarm).some(image => image.name === 'web' && image.file === 'fe/apps/web/Dockerfile'));
  assert.ok(imageFiles(app, appSource(root)).some(image => image.path === 'fe/apps/web/Dockerfile'));
});
