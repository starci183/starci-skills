import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings, connectionFiles, databaseFiles, TWO_CONNECTIONS } from '../helpers/hfs-arch-be-fixture.mjs';

// R84 connection-map (BE_CONNECTION_DUPLICATE): hfs.json connections, connection files, injectors, database module
// registrations and stack env files correspond one to one.

const CONNECTION = {
  ...databaseFiles,
  ...connectionFiles('primary', 'PRIMARY', 'PRIMARY'),
  ...connectionFiles('agentos', 'AGENTOS', 'AGENTOS'),
};
const APP_MODULE = names => `import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../src/modules/platform/database';
import { PRIMARY_CONNECTION } from '../../../src/modules/platform/database/primary.connection';
import { AGENTOS_CONNECTION } from '../../../src/modules/platform/database/agentos.connection';
@Module({ imports: [DatabaseModule.register({ connections: [${names.join(', ')}] })] })
export class AppModule {}
`;
const ONCE = APP_MODULE(['{ name: PRIMARY_CONNECTION }', '{ name: AGENTOS_CONNECTION }']);
const STACK = (primaryDb, agentosDb) => `# runtime env
PRIMARY_HOST=db.internal
PRIMARY_PORT=5432
PRIMARY_NAME=${primaryDb}
export AGENTOS_HOST="db.internal"
AGENTOS_PORT=5432
AGENTOS_NAME='${agentosDb}'
`;
const messages = (report, text) => findings(report, 'BE_CONNECTION_DUPLICATE').filter(item => item.message.includes(text));

test('BE: one connection file set per declared connection, one registration per app and distinct stack databases raise nothing', t => {
  const root = archFixture(t, {
    ...TWO_CONNECTIONS,
    files: { ...CONNECTION, 'apps/core/src/app.module.ts': ONCE, '../.starcistacks/dev/runtime/env/db.env': STACK('primary', 'agentos'), '../.starcistacks/prod/runtime/env/README.md': 'no values here\n' },
  });
  const report = runArch(root);
  assert.deepEqual(findings(report, 'BE_CONNECTION_DUPLICATE'), [], JSON.stringify(findings(report, 'BE_CONNECTION_DUPLICATE'), null, 1));
  assert.equal(report.coverage.hfsMachine.connectionMap.status, 'checked');
  assert.equal(report.coverage.hfsMachine.connectionMap.connections, 2);
  assert.equal(report.coverage.hfsMachine.connectionMap.registrations, 1);
  assert.equal(report.coverage.hfsMachine.connectionMap.stacksChecked, 1);
  assert.equal(report.coverage.hfsMachine.connectionMap.stacksSkipped, 1);
  assert.ok(report.coverage.checkedRuleIds.includes('BE_CONNECTION_DUPLICATE'));
});

test('BE: a declared connection without its three files is named per missing file', t => {
  const root = archFixture(t, {
    ...TWO_CONNECTIONS,
    files: { ...CONNECTION, 'src/modules/platform/database/agentos.connection.ts': null, 'src/modules/platform/database/agentos.decorators.ts': null, 'src/modules/platform/database/agentos.config.ts': null, 'apps/core/src/app.module.ts': 'export const AppModule = 1;\n' },
  });
  const hits = findings(runArch(root), 'BE_CONNECTION_DUPLICATE');
  assert.deepEqual(hits.map(item => item.path).sort(), [
    'src/modules/platform/database/agentos.config.ts',
    'src/modules/platform/database/agentos.connection.ts',
    'src/modules/platform/database/agentos.decorators.ts',
  ]);
});

test('BE: the connection constant must equal the name, and the injector must be the derived Inject<Pascal>EntityManager', t => {
  const root = archFixture(t, {
    ...TWO_CONNECTIONS,
    files: {
      ...CONNECTION,
      'src/modules/platform/database/primary.connection.ts': 'export const PRIMARY_CONNECTION = "main";\n',
      'src/modules/platform/database/agentos.decorators.ts': "import { getEntityManagerToken } from '@nestjs/typeorm';\nimport { AGENTOS_CONNECTION } from './agentos.connection';\ndeclare function injector(token: unknown): unknown;\nexport const InjectAgentEntityManager = () => injector(getEntityManagerToken(AGENTOS_CONNECTION));\n",
    },
  });
  const report = runArch(root);
  assert.equal(messages(report, 'must export `PRIMARY_CONNECTION = "primary"`').length, 1);
  assert.equal(messages(report, 'needs src/modules/platform/database/agentos.decorators.ts exporting InjectAgentosEntityManager').length, 1);
  assert.equal(messages(report, 'InjectAgentEntityManager is exported here').length, 1);
});

test('BE: a capability-specific injector, a second path to the token and an undeclared connection are refused', t => {
  const root = archFixture(t, {
    ...TWO_CONNECTIONS,
    files: {
      ...CONNECTION,
      'src/modules/platform/database/collab.connection.ts': 'export const COLLAB_CONNECTION = "collab";\n',
      'src/modules/domain/collab/index.ts': "export { InjectCollabEntityManager } from './collab.decorators';\n",
      'src/modules/domain/collab/collab.decorators.ts': `import { getEntityManagerToken, InjectEntityManager } from '@nestjs/typeorm';
import { PRIMARY_CONNECTION } from '../../platform/database/primary.connection';
declare function injector(token: unknown): unknown;
export const InjectCollabEntityManager = () => injector(getEntityManagerToken(PRIMARY_CONNECTION));
export const second = () => InjectEntityManager('primary');
export const ghost = () => InjectEntityManager('nowhere');
`,
      'src/modules/domain/collab/collab.data.ts': "import { InjectDataSource } from '@nestjs/typeorm';\nexport const source = InjectDataSource();\n",
    },
  });
  const report = runArch(root);
  assert.equal(messages(report, 'InjectCollabEntityManager is exported here').length, 1);
  assert.equal(messages(report, 'getEntityManagerToken(primary) belongs in').length, 1);
  assert.equal(messages(report, 'InjectEntityManager(primary) belongs in').length, 1);
  assert.equal(messages(report, 'names connection nowhere').length, 1);
  assert.equal(messages(report, 'InjectDataSource() reaches the DataSource').length, 1);
  assert.equal(messages(report, 'belongs to connection collab, which hfs.json does not declare').length, 1);
});

test('BE: one injector call per connection inside its decorators file', t => {
  const root = archFixture(t, {
    ...TWO_CONNECTIONS,
    files: {
      ...CONNECTION,
      'src/modules/platform/database/primary.decorators.ts': `import { getEntityManagerToken } from '@nestjs/typeorm';
import { PRIMARY_CONNECTION } from './primary.connection';
declare function injector(token: unknown): unknown;
export const InjectPrimaryEntityManager = () => injector(getEntityManagerToken(PRIMARY_CONNECTION));
export const again = () => injector(getEntityManagerToken(PRIMARY_CONNECTION));
`,
    },
  });
  assert.equal(messages(runArch(root), 'resolves connection primary more than once').length, 1);
});

test('BE: a config reading a key outside its prefix, or another connection\'s prefix, is refused', t => {
  const root = archFixture(t, {
    ...TWO_CONNECTIONS,
    files: {
      ...CONNECTION,
      'src/modules/platform/database/primary.config.ts': "export const primaryConfig = () => ({ host: process.env.PRIMARY_HOST, url: process.env.DATABASE_URL, other: 'AGENTOS_HOST' });\n",
    },
  });
  const hits = messages(runArch(root), 'reads');
  assert.equal(hits.length, 2, JSON.stringify(hits.map(item => item.message)));
  assert.ok(hits.some(item => item.message.includes('DATABASE_URL')));
  assert.ok(hits.some(item => item.message.includes('AGENTOS_HOST')));
});

test('BE: an app passing one connection twice to the database module registration is refused, once each is fine', t => {
  const root = archFixture(t, {
    ...TWO_CONNECTIONS,
    files: { ...CONNECTION, 'apps/core/src/app.module.ts': APP_MODULE(['{ name: PRIMARY_CONNECTION }', '{ name: AGENTOS_CONNECTION }', '{ name: PRIMARY_CONNECTION }']) },
  });
  const hits = messages(runArch(root), 'more than once');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].connection, 'primary');
  assert.equal(hits[0].app, 'core');
  assert.equal(hits[0].path, 'apps/core/src/app.module.ts');
});

test('BE: two connections resolving to one host, port and database in a stack env are one database', t => {
  const root = archFixture(t, {
    ...TWO_CONNECTIONS,
    files: {
      ...CONNECTION,
      'apps/core/src/app.module.ts': ONCE,
      '../.starcistacks/dev/runtime/env/db.env': STACK('shared', 'shared'),
      '../.starcistacks/prod/runtime/env/db.env': STACK('primary', 'agentos'),
      '../.starcistacks/staging/runtime/env/db.env': 'PRIMARY_HOST=only-host\n',
    },
  });
  const report = runArch(root);
  const hits = messages(report, 'same database');
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.equal(hits[0].env, 'dev');
  assert.equal(hits[0].path, '../.starcistacks/dev/runtime/env', 'the app root stack, relative to the be side the machine judges');
  assert.equal(report.coverage.hfsMachine.connectionMap.stacksChecked, 2);
  assert.equal(report.coverage.hfsMachine.connectionMap.stacksSkipped, 1);
});

test('BE: a config that reads <PREFIX>_DATABASE compares that key, not <PREFIX>_NAME', t => {
  const root = archFixture(t, {
    ...TWO_CONNECTIONS,
    files: {
      ...CONNECTION,
      'src/modules/platform/database/agentos.config.ts': 'export const agentosConfig = () => ({ host: process.env.AGENTOS_HOST, port: process.env.AGENTOS_PORT, database: process.env.AGENTOS_DATABASE });\n',
      '../.starcistacks/dev/runtime/env/db.env': 'PRIMARY_HOST=h\nPRIMARY_PORT=1\nPRIMARY_NAME=x\nAGENTOS_HOST=h\nAGENTOS_PORT=1\nAGENTOS_DATABASE=x\nAGENTOS_NAME=other\n',
    },
  });
  assert.equal(messages(runArch(root), 'same database').length, 1);
});

// A bounded context is its own database or its own schema of a shared one (hfs.json isolation); splitting a schema out is an env change.
const SCHEMA_CONNECTIONS = {
  declaration: { connections: [{ name: 'primary', envPrefix: 'PRIMARY', owner: 'core', isolation: 'schema' }, { name: 'agentos', envPrefix: 'AGENTOS', owner: 'core', isolation: 'schema' }] },
  apps: TWO_CONNECTIONS.apps,
};
const schemaConfig = (name, prefix) => `export const ${name}Config = () => ({ host: process.env.${prefix}_HOST, port: process.env.${prefix}_PORT, name: process.env.${prefix}_NAME, schema: process.env.${prefix}_SCHEMA });\n`;
const SCHEMA_FILES = { ...CONNECTION, 'src/modules/platform/database/primary.config.ts': schemaConfig('primary', 'PRIMARY'), 'src/modules/platform/database/agentos.config.ts': schemaConfig('agentos', 'AGENTOS'), 'apps/core/src/app.module.ts': ONCE };
const SHARED_ENV = (primarySchema, agentosSchema) => `PRIMARY_HOST=db\nPRIMARY_PORT=5432\nPRIMARY_NAME=app\nPRIMARY_SCHEMA=${primarySchema}\nAGENTOS_HOST=db\nAGENTOS_PORT=5432\nAGENTOS_NAME=app\nAGENTOS_SCHEMA=${agentosSchema}\n`;

test('BE: two schema contexts in one database with distinct schemas are fine, the same schema is one database', t => {
  const fine = archFixture(t, { ...SCHEMA_CONNECTIONS, files: { ...SCHEMA_FILES, '../.starcistacks/dev/runtime/env/db.env': SHARED_ENV('main', 'agent') } });
  assert.deepEqual(findings(runArch(fine), 'BE_CONNECTION_DUPLICATE'), []);
  const clash = archFixture(t, { ...SCHEMA_CONNECTIONS, files: { ...SCHEMA_FILES, '../.starcistacks/dev/runtime/env/db.env': SHARED_ENV('main', 'main') } });
  const hits = messages(runArch(clash), 'same database');
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.match(hits[0].message, /schema main/);
  const missing = archFixture(t, { ...SCHEMA_CONNECTIONS, files: { ...SCHEMA_FILES, '../.starcistacks/dev/runtime/env/db.env': 'PRIMARY_HOST=db\nPRIMARY_PORT=5432\nPRIMARY_NAME=app\nAGENTOS_HOST=db\nAGENTOS_PORT=5432\nAGENTOS_NAME=app\n' } });
  assert.equal(messages(runArch(missing), 'same database').length, 1, 'two schema contexts with no schema value are one database');
});

test('BE: a context that is its own database shares it with no schema context', t => {
  const mixed = { declaration: { connections: [{ name: 'primary', envPrefix: 'PRIMARY', owner: 'core', isolation: 'database' }, SCHEMA_CONNECTIONS.declaration.connections[1]] }, apps: TWO_CONNECTIONS.apps };
  const root = archFixture(t, { ...mixed, files: { ...SCHEMA_FILES, '../.starcistacks/dev/runtime/env/db.env': SHARED_ENV('main', 'agent') } });
  assert.equal(messages(runArch(root), 'same database').length, 1);
});

test('BE: a schema context whose config never reads <PREFIX>_SCHEMA is refused, a database context needs no schema key', t => {
  const root = archFixture(t, { ...SCHEMA_CONNECTIONS, files: { ...SCHEMA_FILES, 'src/modules/platform/database/agentos.config.ts': connectionFiles('agentos', 'AGENTOS', 'AGENTOS')['src/modules/platform/database/agentos.config.ts'] } });
  const hits = messages(runArch(root), 'must read AGENTOS_SCHEMA');
  assert.equal(hits.length, 1, JSON.stringify(hits.map(item => item.message)));
  assert.equal(hits[0].path, 'src/modules/platform/database/agentos.config.ts');
  const database = archFixture(t, { ...TWO_CONNECTIONS, files: { ...CONNECTION, 'apps/core/src/app.module.ts': ONCE } });
  assert.deepEqual(messages(runArch(database), 'SCHEMA'), []);
});
