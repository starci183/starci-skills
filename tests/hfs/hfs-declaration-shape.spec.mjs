import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml } from '../../engine/yaml.mjs';
import { declarationShapeProblems } from '../../scripts/hfs/declaration-shape.mjs';
import { HfsSlotsError, loadSlotManifest, resolveRepoDeclaration } from '../../scripts/hfs/slots.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const Ajv2020 = (() => {
  const loaded = createRequire(import.meta.url)('ajv/dist/2020.js');
  return loaded.default ?? loaded;
})();
const validateSchema = new Ajv2020({ strict: false, allErrors: true, logger: false })
  .compile(parseYaml(fs.readFileSync(path.join(root, 'modules/schemas/hfs-repo.schema.yaml'), 'utf8')));
const manifest = loadSlotManifest();

const BASE = {
  hfs: 2,
  kind: 'app',
  project: 'demo',
  sides: {
    be: { apps: [{ name: 'core', kind: 'api' }, { name: 'cli', kind: 'cli' }] },
    fe: { apps: [{ name: 'web', kind: 'next' }] },
  },
};
const changed = (mutate) => {
  const declaration = structuredClone(BASE);
  mutate(declaration);
  return declaration;
};
const loaderRefuses = (declaration, code = 'HFS_DECLARATION_INVALID') => assert.throws(
  () => resolveRepoDeclaration(manifest, declaration),
  (error) => error instanceof HfsSlotsError && error.code === code,
  `expected ${code} for ${JSON.stringify(declaration)}`,
);

test('declarationShapeProblems covers top-level and side refusal paths', () => {
  const cases = [
    [null, 'hfs.json is not an object'],
    [changed((d) => { d.hfs = 0; }), 'hfs must be the pinned manifest major'],
    [changed((d) => { d.project = 'Bad_Name'; }), 'project must be a project name'],
    [changed((d) => { d.extra = true; }), 'unknown key extra'],
    [changed((d) => { d.browser = false; }), 'browser is `true`'],
    [changed((d) => { d.kind = 'service'; }), 'kind must be app'],
    [changed((d) => { delete d.sides.fe; }), 'sides must declare exactly be and fe'],
    [changed((d) => { d.sides.be = null; }), 'sides.be must be an object'],
    [changed((d) => { d.sides.be.extra = true; }), 'sides.be has unknown key extra'],
    [changed((d) => { d.sides.be.apps = []; }), 'sides.be.apps must list every be/apps/<name>'],
    [changed((d) => { d.sides.be.apps[0] = { name: 'Bad', kind: 'api' }; }), 'sides.be.apps[0] must be {name, kind}'],
    [changed((d) => { d.sides.be.apps[0].extra = true; }), 'sides.be.apps[0] must be {name, kind}'],
    [changed((d) => { d.sides.fe.apps[0].name = 'core'; }), 'app core is declared twice'],
    [changed((d) => { d.sides.be.optionalSlots = ['bad']; }), 'sides.be.optionalSlots must be a unique list of slot ids'],
    [changed((d) => { d.sides.be.patterns = ['queue', 'queue']; }), 'sides.be.patterns must be a unique list of pattern names'],
    [changed((d) => { d.sides.be.kinds = ['Bad']; }), 'sides.be.kinds must be a unique list of trigger kind names'],
    [changed((d) => { d.sides.fe.reads = ['']; }), 'sides.fe.reads must be a unique list of paths'],
    [changed((d) => { d.sides.fe.connections = []; }), 'connections belong to the be side'],
  ];

  for (const [declaration, message] of cases) {
    const problems = declarationShapeProblems(declaration, ['be', 'fe']);
    assert.ok(problems.some((problem) => problem.includes(message)), `${message}: ${problems.join('; ')}`);
  }

  const runtime = { hfs: 2, kind: 'runtime', project: 'starci', edition: 'lite' };
  assert.deepEqual(declarationShapeProblems(runtime, ['be', 'fe']), [
    'unknown key edition (a runtime declaration is {hfs, kind, project})',
  ]);
});

test('the Supabase block refuses every unsupported key and value shape', () => {
  const cases = [
    ['not an object', changed((d) => { d.supabase = 'yes'; }), 'supabase must be an object'],
    ['unknown key', changed((d) => { d.supabase = { region: 'local' }; }), 'supabase has unknown key region'],
    ['enableSignup', changed((d) => { d.supabase = { enableSignup: 'no' }; }), 'supabase.enableSignup must be true or false'],
    ['jwtExpiry non-integer', changed((d) => { d.supabase = { jwtExpiry: 1.5 }; }), 'supabase.jwtExpiry must be an integer'],
    ['jwtExpiry zero', changed((d) => { d.supabase = { jwtExpiry: 0 }; }), 'supabase.jwtExpiry must be an integer'],
    ['jwtExpiry too large', changed((d) => { d.supabase = { jwtExpiry: 3601 }; }), 'supabase.jwtExpiry must be an integer'],
    ['siteUrl', changed((d) => { d.supabase = { siteUrl: '' }; }), 'supabase.siteUrl must be a URL string'],
    ['redirectUrls', changed((d) => { d.supabase = { redirectUrls: [''] }; }), 'supabase.redirectUrls must be a list of strings'],
    ['forceRls', changed((d) => { d.supabase = { forceRls: 'public.audit' }; }), 'supabase.forceRls must be a list of strings'],
  ];

  for (const [label, declaration, message] of cases) {
    const problems = declarationShapeProblems(declaration, ['be', 'fe']);
    assert.ok(problems.some((problem) => problem.includes(message)), `${label}: ${problems.join('; ')}`);
  }
  const good = changed((d) => {
    d.supabase = {
      enableSignup: false,
      jwtExpiry: 3600,
      siteUrl: 'http://localhost:3000',
      redirectUrls: ['http://localhost:3000/auth/callback'],
      forceRls: ['public.audit'],
    };
  });
  assert.deepEqual(declarationShapeProblems(good, ['be', 'fe']), []);
});

test('connections refuse malformed fields and accept only the absent, postgres and supabase provider values', () => {
  const connection = { name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'database' };
  const malformed = [
    changed((d) => { d.sides.be.connections = {}; }),
    changed((d) => { d.sides.be.connections = [{ ...connection, name: 'Bad' }]; }),
    changed((d) => { d.sides.be.connections = [{ ...connection, envPrefix: 'lower' }]; }),
    changed((d) => { d.sides.be.connections = [{ ...connection, owner: 'Bad' }]; }),
    changed((d) => { d.sides.be.connections = [{ ...connection, isolation: 'tenant' }]; }),
    changed((d) => { d.sides.be.connections = [{ ...connection, provider: 'sqlite' }]; }),
    changed((d) => { d.sides.be.connections = [{ ...connection, extra: true }]; }),
    changed((d) => { const { isolation, ...missing } = connection; d.sides.be.connections = [missing]; }),
  ];
  for (const declaration of malformed) {
    const problems = declarationShapeProblems(declaration, ['be', 'fe']);
    assert.ok(problems.some((problem) => problem.startsWith('connections must be a list')), problems.join('; '));
    loaderRefuses(declaration);
  }

  for (const provider of [undefined, 'postgres', 'supabase']) {
    const declaration = changed((d) => {
      d.sides.be.connections = [{ ...connection, ...(provider === undefined ? {} : { provider }) }];
    });
    assert.deepEqual(declarationShapeProblems(declaration, ['be', 'fe']), []);
    assert.equal(validateSchema(declaration), true, JSON.stringify(validateSchema.errors));
    assert.equal(resolveRepoDeclaration(manifest, declaration).sides.be.connections[0].provider, provider);
  }
});

test('manifest-dependent declaration refusals cover owners, duplicate connections, env overlap and reads', () => {
  const connection = { name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'database' };
  const cases = [
    [changed((d) => { d.sides.be.connections = [{ ...connection, owner: 'cli' }]; }), 'which is not a api or worker app'],
    [changed((d) => { d.sides.be.connections = [connection, { ...connection, envPrefix: 'SECONDARY_DB' }]; }), 'connections names must be unique'],
    [changed((d) => { d.sides.be.connections = [connection, { ...connection, name: 'audit', envPrefix: 'PRIMARY_DB_READ' }]; }), 'share env keys'],
    [changed((d) => { d.sides.fe.reads = ['be/private/']; }), 'may read only'],
  ];
  for (const [declaration, message] of cases) {
    loaderRefuses(declaration);
    assert.throws(
      () => resolveRepoDeclaration(manifest, declaration),
      (error) => error.details.problems.some((problem) => problem.includes(message)),
      message,
    );
  }
});

test('the AJV schema and loader agree on every schema-level refusal, including edition values', () => {
  const schemaInvalid = [
    null,
    changed((d) => { d.hfs = 0; }),
    changed((d) => { d.project = 'Bad_Name'; }),
    changed((d) => { d.extra = true; }),
    changed((d) => { d.browser = false; }),
    changed((d) => { d.kind = 'service'; }),
    changed((d) => { delete d.sides.fe; }),
    changed((d) => { d.sides.be = null; }),
    changed((d) => { d.sides.be.extra = true; }),
    changed((d) => { d.sides.be.apps = []; }),
    changed((d) => { d.sides.be.apps[0] = { name: 'Bad', kind: 'api' }; }),
    changed((d) => { d.sides.be.optionalSlots = ['bad']; }),
    changed((d) => { d.sides.be.optionalSlots = ['be.persistence', 'be.persistence']; }),
    changed((d) => { d.sides.be.patterns = ['queue', 'queue']; }),
    changed((d) => { d.sides.be.kinds = ['Bad']; }),
    changed((d) => { d.sides.fe.reads = ['']; }),
    changed((d) => { d.sides.fe.connections = []; }),
    changed((d) => { d.supabase = { jwtExpiry: 3601 }; }),
    changed((d) => { d.sides.be.connections = [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'database', provider: 'sqlite' }]; }),
  ];
  for (const declaration of schemaInvalid) {
    assert.equal(validateSchema(declaration), false, `schema accepted ${JSON.stringify(declaration)}`);
    loaderRefuses(declaration);
  }

  for (const edition of ['basic', 2, null]) {
    const declaration = changed((d) => { d.edition = edition; });
    assert.equal(validateSchema(declaration), false, `schema accepted edition ${JSON.stringify(edition)}`);
    loaderRefuses(declaration, 'HFS_EDITION_INVALID');
  }

  for (const edition of [undefined, 'full', 'lite']) {
    const declaration = changed((d) => {
      if (edition === undefined) delete d.edition;
      else d.edition = edition;
    });
    assert.equal(validateSchema(declaration), true, JSON.stringify(validateSchema.errors));
    assert.equal(resolveRepoDeclaration(manifest, declaration).edition, edition ?? 'full');
  }
});
