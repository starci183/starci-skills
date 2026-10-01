// Shared file sets for the backend composition and data machine specs (connection-map, sql-owner, register-once,
// error-masked, default-deny-app-guard, entrypoint-only-in-apps, error-codes). Package imports stay unresolved on purpose:
// the checks recognise a framework symbol by the package it is imported from, and a fixture needs no node_modules.
import { archFixture, runArch, findings } from './hfs-arch-fixture.mjs';

export { archFixture, runArch, findings };

/** platform/database with the `sql` tag and the entity manager injector of the `primary` connection. */
export const databaseFiles = {
  'src/modules/platform/database/index.ts': "export { sql } from './sql';\nexport { DatabaseModule } from './database.module';\n",
  'src/modules/platform/database/sql.ts': 'export const sql = (strings: TemplateStringsArray, ...values: unknown[]): string => strings.join("?") + values.length;\n',
  'src/modules/platform/database/database.module.ts': "import { Module } from '@nestjs/common';\n@Module({})\nexport class DatabaseModule {\n  static register(options: { connections: { name: string }[] }) { return { module: DatabaseModule, ...options }; }\n}\n",
};

export const connectionFiles = (name, prefix, constant) => ({
  [`src/modules/platform/database/${name}.connection.ts`]: `export const ${constant}_CONNECTION = "${name}";\n`,
  [`src/modules/platform/database/${name}.decorators.ts`]: `import { getEntityManagerToken } from '@nestjs/typeorm';\nimport { ${constant}_CONNECTION } from './${name}.connection';\ndeclare function injector(token: unknown): unknown;\nexport const Inject${name[0].toUpperCase()}${name.slice(1)}EntityManager = () => injector(getEntityManagerToken(${constant}_CONNECTION));\n`,
  [`src/modules/platform/database/${name}.config.ts`]: `export const ${name}Config = () => ({ host: process.env.${prefix}_HOST, port: process.env.${prefix}_PORT, name: process.env.${prefix}_NAME });\n`,
});

/** archFixture options: two declared connections need the migrate app hfs.json requires beside them. */
export const TWO_CONNECTIONS = {
  declaration: { connections: [{ name: 'primary', envPrefix: 'PRIMARY' }, { name: 'agentos', envPrefix: 'AGENTOS' }] },
  apps: [{ name: 'core', kind: 'api' }, { name: 'migrate', kind: 'migrate' }],
};

/** A domain capability with one entity: table, primary key column, optional extra column source. */
export const entityFiles = (capability, table, columns = '') => ({
  [`src/modules/domain/${capability}/index.ts`]: `export const ${capability} = 1;\n`,
  [`src/modules/domain/${capability}/persistence/entities/${capability}.entity.ts`]:
    `import { Column, Entity, PrimaryColumn } from 'typeorm';\n@Entity("${table}")\nexport class ${capability[0].toUpperCase()}${capability.slice(1)}Entity {\n  @PrimaryColumn({ name: 'id', type: 'uuid' }) id!: string;\n${columns}}\n`,
});

/** platform/errors with an ExceptionFilter and a GraphQL formatError. */
export const errorsFiles = {
  'src/modules/platform/errors/index.ts': "export { AllExceptionsFilter } from './all-exceptions.filter';\nexport { formatError } from './format-error';\n",
  'src/modules/platform/errors/all-exceptions.filter.ts': 'export class AllExceptionsFilter { catch(): void {} }\n',
  'src/modules/platform/errors/format-error.ts': 'export const formatError = (error: unknown): unknown => error;\n',
};
