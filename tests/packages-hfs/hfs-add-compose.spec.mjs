// proves: BE_COMPOSITION_UNTYPED@lite
// proves: BE_COMPOSITION_UNTYPED@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { addKind } from '../../packages/hfs/scaffold/add.mjs';

const ts = createRequire(import.meta.url)('typescript');
const TEMPLATES = path.resolve(import.meta.dirname, '../../packages/hfs/templates/be');
const made = [];
test.after(() => {
  for (const root of made) fs.rmSync(root, { recursive: true, force: true });
});

const read = (root, relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const compositionText = (root, app) => {
  const folder = 'be/apps/api/src/compose';
  const groups = fs.readdirSync(path.join(root, folder), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.ts'))
    .map(entry => read(root, `${folder}/${entry.name}`));
  return [app, ...groups].join('\n');
};
const put = (root, relative, body) => {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
};
const copy = (source, root, relative) => {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const target = `${relative}/${entry.name.replaceAll('__app__', 'api')}`;
    if (entry.isDirectory()) copy(path.join(source, entry.name), root, target);
    else put(root, target, fs.readFileSync(path.join(source, entry.name), 'utf8').replaceAll('{{appPascal}}', 'Api').replaceAll('{{app}}', 'api'));
  }
};

const fixture = (edition, { groups = false } = {}) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-add-compose-'));
  made.push(root);
  put(root, 'hfs.json', `${JSON.stringify({ hfs: 3, kind: 'app', edition, project: 'demo', sides: {
    be: { apps: [{ name: 'api', kind: 'api' }], kinds: ['api'], connections: [
      { name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'api', isolation: 'schema', ...(edition === 'lite' ? { provider: 'supabase' } : {}) },
    ] },
    fe: { apps: [{ name: 'web', kind: 'next' }], reads: ['be/contracts/', ...(edition === 'lite' ? ['supabase/types/'] : [])] },
  } }, null, 2)}\n`);
  put(root, 'package.json', '{"dependencies":{}}\n');
  copy(path.join(TEMPLATES, 'skeleton/src'), root, 'be/src');
  copy(path.join(TEMPLATES, 'skeleton/apps/__app__/src'), root, 'be/apps/api/src');
  if (edition === 'lite') {
    copy(path.join(TEMPLATES, 'skeleton-lite/src'), root, 'be/src');
    copy(path.join(TEMPLATES, 'skeleton-lite/apps/api/src'), root, 'be/apps/api/src');
  }
  put(root, 'be/src/modules/domain/bookings/bookings.service.ts', 'export class BookingsService {}\n');
  put(root, 'be/src/modules/domain/bookings/index.ts', 'export { BookingsService } from "./bookings.service"\n');
  if (!groups) {
    fs.unlinkSync(path.join(root, 'be/apps/api/src/compose/domain.ts'));
    fs.unlinkSync(path.join(root, 'be/apps/api/src/compose/api.ts'));
    fs.unlinkSync(path.join(root, 'be/apps/api/src/compose/webhooks.ts'));
  }
  return root;
};

const add = (root, noun, name, now = () => Date.UTC(2026, 9, 2, 12, 34, 56)) => addKind({
  repoRoot: root, noun, name, options: { service: 'BookingsService=@modules/domain/bookings' }, now,
});
const occurrences = (text, value) => text.split(value).length - 1;
const snapshot = root => {
  const files = {};
  const visit = folder => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) visit(file);
      else files[path.relative(root, file)] = fs.readFileSync(file, 'utf8');
    }
  };
  visit(root);
  return files;
};
const assertGroup = (root, area, symbol) => {
  const group = read(root, `be/apps/api/src/compose/${area}.ts`);
  assert.match(group, /import type \{ DynamicModule, Type \} from "@nestjs\/common"/);
  assert.ok(group.includes(`export const ${area}Modules = (): Array<Type<unknown> | DynamicModule> => [`));
  assert.ok(group.includes(`    ${symbol},`));
  assert.equal(ts.transpileModule(group, { reportDiagnostics: true }).diagnostics.length, 0, 'the typed group parses');
  const app = read(root, 'be/apps/api/src/app.module.ts');
  assert.equal(occurrences(app, `import { ${area}Modules } from "./compose/${area}"`), 1);
  assert.equal(occurrences(app, `...${area}Modules()`), 1);
  assert.ok(!app.includes(symbol), 'the root spreads the group instead of duplicating its feature list');
  return group;
};

for (const edition of ['lite', 'full']) {
  for (const groups of [false, true]) {
    test(`${edition}: add api ${groups ? 'updates a skeleton group' : 'creates a missing typed group'} and preserves its siblings`, () => {
      const root = fixture(edition, { groups });
      const env = read(root, 'be/apps/api/src/api.env.ts');
      const options = read(root, 'be/apps/api/src/api.options.ts');
      const original = read(root, 'be/apps/api/src/app.module.ts');
      const platform = read(root, 'be/apps/api/src/compose/platform.ts');
      const first = add(root, 'api', 'bookings');
      assert.equal(first.created.includes('be/apps/api/src/compose/api.ts'), !groups);
      assertGroup(root, 'api', 'BookingsGraphqlModule');
      const app = read(root, 'be/apps/api/src/app.module.ts');
      const domain = read(root, 'be/apps/api/src/compose/domain.ts');
      assert.equal(first.created.includes('be/apps/api/src/compose/domain.ts'), !groups);
      assert.equal(occurrences(domain, 'IdentityModule.register('), 1);
      assert.equal(occurrences(domain, 'LivenessModule.register('), 1);
      assert.equal(occurrences(domain, 'NoteModule.register('), edition === 'full' ? 1 : 0);
      assert.ok(app.includes('import { AuthGuard, CredentialGuard } from "@modules/domain/identity"'));
      assert.ok(app.includes(edition === 'lite' ? '...domainModules(verifyAccessToken)' : '...domainModules()'));
      assert.equal(app.split('            providers: [')[1], original.split('            providers: [')[1]);
      assert.equal(read(root, 'be/apps/api/src/compose/platform.ts'), platform);
      const second = add(root, 'api', 'availability');
      assert.ok(!second.created.includes('be/apps/api/src/compose/api.ts'));
      const group = assertGroup(root, 'api', 'AvailabilityGraphqlModule');
      assert.ok(group.includes('    BookingsGraphqlModule,'));
      assert.equal(occurrences(group, '    GraphqlModule.register({ isGlobal: true }),'), 1);
      assert.equal(read(root, 'be/apps/api/src/app.module.ts'), app, 'a later feature only changes the area group');
      assert.equal(read(root, 'be/apps/api/src/api.env.ts'), env);
      assert.equal(read(root, 'be/apps/api/src/api.options.ts'), options);
      assert.equal(read(root, 'be/apps/api/src/compose/domain.ts'), domain);
      assert.throws(() => add(root, 'api', 'bookings'), { code: 'HFS_ADD_EXISTS' });
      assert.equal(read(root, 'be/apps/api/src/compose/api.ts'), group, 'a refused duplicate leaves the group unchanged');
    });
  }

  test(`${edition}: signed webhooks share one typed area group and keep provider registrations distinct`, () => {
    const root = fixture(edition);
    const first = add(root, 'webhook', 'calendar');
    assert.ok(first.created.includes('be/apps/api/src/compose/webhooks.ts'));
    const second = add(root, 'webhook', 'payment', () => Date.UTC(2026, 9, 2, 12, 35, 56));
    assert.ok(!second.created.includes('be/apps/api/src/compose/webhooks.ts'));
    const group = assertGroup(root, 'webhooks', 'PaymentHttpModule');
    assert.ok(group.includes('    CalendarHttpModule,'));
    if (edition === 'lite') {
      assert.equal(occurrences(group, '    CalendarInboxModule.register({ isGlobal: true }),'), 1);
      assert.equal(occurrences(group, '    PaymentInboxModule.register({ isGlobal: true }),'), 1);
      const app = read(root, 'be/apps/api/src/app.module.ts');
      assert.doesNotMatch(app, /CalendarInboxModule|PaymentInboxModule/);
      const composition = compositionText(root, app);
      for (const symbol of ['InboxModule', 'EventBusModule']) {
        assert.equal([...composition.matchAll(new RegExp(String.raw`\b${symbol}\.register\(`, 'g'))].length, 1, `${symbol} is composed once`);
        assert.match(composition, new RegExp(String.raw`\b${symbol}\.register\(\{ isGlobal: true \}\)`));
      }
      assert.match(read(root, 'be/apps/api/src/api.env.ts'), /calendar: parseWebhookProviderConfig/);
      assert.match(read(root, 'be/apps/api/src/api.env.ts'), /payment: parseWebhookProviderConfig/);
      assert.match(read(root, 'be/apps/api/src/main.ts'), /rawBody: true/);
    }
    assert.throws(() => add(root, 'webhook', 'calendar'), { code: 'HFS_ADD_EXISTS' });
    assert.equal(read(root, 'be/apps/api/src/compose/webhooks.ts'), group);
  });

  test(`${edition}: moving a GraphQL registration preserves existing area members without duplicates`, () => {
    const root = fixture(edition, { groups: true });
    const appPath = 'be/apps/api/src/app.module.ts';
    put(root, appPath, read(root, appPath)
      .replace('import { Module }', 'import { GraphqlModule } from "@modules/platform/graphql"\nimport { Module }')
      .replace('...platformModules(options),', '...platformModules(options),\n                GraphqlModule.register({ isGlobal: true }),'));
    const apiPath = 'be/apps/api/src/compose/api.ts';
    put(root, apiPath, read(root, apiPath)
      .replace('import type {', 'import { ExistingModule } from "@features/api/existing";\nimport type {')
      .replace('=> []', '=> [\n    ExistingModule,\n]'));
    add(root, 'api', 'bookings');
    const group = assertGroup(root, 'api', 'BookingsGraphqlModule');
    assert.equal(occurrences(group, '    GraphqlModule.register({ isGlobal: true }),'), 1);
    assert.equal(occurrences(group, '    ExistingModule,'), 1);
    assert.ok(group.includes('import { ExistingModule } from "@features/api/existing";'));
    assert.ok(!read(root, appPath).includes('GraphqlModule'));
  });

  for (const noun of ['api', 'webhook']) {
    test(`${edition}: add ${noun} distinguishes a generated member from a sibling with the same suffix`, () => {
      const root = fixture(edition, { groups: true });
      const area = noun === 'api' ? 'api' : 'webhooks';
      const generated = noun === 'api' ? 'BookingsGraphqlModule' : 'BookingsHttpModule';
      const sibling = `Existing${generated}`;
      const relative = `be/apps/api/src/compose/${area}.ts`;
      put(root, relative, read(root, relative)
        .replace('import type {', `import { ${sibling} } from "@features/${area}/existing"\nimport type {`)
        .replace('=> []', `=> [\n    ${sibling},\n]`));
      add(root, noun, 'bookings');
      const group = assertGroup(root, area, generated);
      assert.equal(occurrences(group, `    ${sibling},`), 1);
      assert.equal(occurrences(group, `    ${generated},`), 1);
    });
  }

  test(`${edition}: an incompatible area group is refused without replacing it`, () => {
    const root = fixture(edition);
    const body = 'export const apiModules = () => []\n';
    put(root, 'be/apps/api/src/compose/api.ts', body);
    const before = snapshot(root);
    assert.throws(() => add(root, 'api', 'bookings'), { code: 'HFS_ADD_WIRE_INVALID' });
    assert.equal(read(root, 'be/apps/api/src/compose/api.ts'), body);
    assert.deepEqual(snapshot(root), before, 'preflight refuses the group before generating or wiring files');
  });

  test(`${edition}: a root imports array inside a comment is refused before generating files`, () => {
    const root = fixture(edition);
    const relative = 'be/apps/api/src/app.module.ts';
    put(root, relative, `/*\nimports: [\n]\n*/\n${read(root, relative).replace('imports: [', 'imports: makeImports(')}`);
    const before = snapshot(root);
    assert.throws(() => add(root, 'api', 'bookings'), { code: 'HFS_ADD_WIRE_INVALID' });
    assert.deepEqual(snapshot(root), before);
  });
}

test('lite: incompatible webhook environment wiring is refused before generating the provider', () => {
  const root = fixture('lite');
  const relative = 'be/apps/api/src/api.env.ts';
  put(root, relative, read(root, relative).replace('"@modules/platform/http-security"', '"@modules/custom/http-security"'));
  const before = snapshot(root);
  assert.throws(() => add(root, 'webhook', 'calendar'), { code: 'HFS_ADD_WIRE_INVALID' });
  assert.deepEqual(snapshot(root), before);
});
